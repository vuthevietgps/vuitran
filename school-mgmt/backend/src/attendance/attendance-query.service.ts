import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Attendance,
  AttendanceDocument,
  COUNTED_ATTENDANCE_STATUSES,
} from './schemas/attendance.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { normalizeDate, buildDateFilter } from '../common/utils/date.utils';
import { StorageUrlService } from '../common/storage-url.service';
import {
  ClassLean,
  StudentLean,
  getUserId,
  isTeacher,
  assertClassAccess,
  getAttendancePermissions,
} from './attendance.utils';

@Injectable()
export class AttendanceQueryService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    private readonly storageUrlService: StorageUrlService,
  ) {}

  async loadStudentsForClass(
    classroom: ClassLean,
    user: JwtPayload,
    date?: Date,
  ): Promise<StudentLean[]> {
    const cls = await this.classModel
      .findById(classroom._id)
      .populate('students', 'fullName age parentName studentCode faceImage parentPhone')
      .lean();
    return ((cls as any)?.students as StudentLean[]) || [];
  }

  async getAttendanceByClass(classId: string, date: string, user: JwtPayload) {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    const attendanceDate = normalizeDate(date);
    assertClassAccess(classroom, user, attendanceDate);
    const students = await this.loadStudentsForClass(classroom, user, attendanceDate);

    const attendances = await this.attendanceModel
      .find({ classId, date: attendanceDate })
      .populate('studentId', 'fullName age parentName studentCode')
      .lean();

    const attendanceMap = new Map<string, any>();
    for (const att of attendances) {
      const sid = att.studentId?._id?.toString() ?? att.studentId?.toString();
      if (sid) attendanceMap.set(sid, att);
    }

    const sorted = [...students].sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'base' }),
    );

    const attendanceList = sorted.map((student) => {
      const sid = student._id.toString();
      const existing = attendanceMap.get(sid);
      return {
        student: {
          _id: sid,
          fullName: student.fullName,
          age: (student as any).age,
          parentName: (student as any).parentName,
          studentCode: (student as any).studentCode,
        },
        attendance: existing
          ? {
              _id: existing._id?.toString(),
              classId: existing.classId?.toString(),
              studentId: sid,
              date: existing.date,
              status: existing.status,
              notes: existing.notes || '',
              attendedAt: existing.attendedAt || null,
              imageUrl: existing.imageUrl || null,
              sessionId: existing.sessionId?.toString() || null,
            }
          : {
              _id: null,
              classId,
              studentId: sid,
              date: attendanceDate,
              status: null,
              notes: '',
              attendedAt: null,
              imageUrl: null,
              sessionId: null,
            },
      };
    });

    return this.storageUrlService.transformSensitiveAssetUrls({
      class: {
        _id: (classroom as any)._id,
        name: classroom.name,
        code: (classroom as any).code,
      },
      date: attendanceDate,
      permissions: getAttendancePermissions(classroom, user, attendanceDate),
      attendanceList,
    });
  }

  async getStudentAttendanceHistory(
    studentId: string,
    classId?: string,
    actor?: JwtPayload,
  ) {
    const filter: any = { studentId: new Types.ObjectId(studentId) };
    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException('classId khong hop le');
      }
      filter.classId = new Types.ObjectId(classId);
    }
    if (actor?.role === Role.TEACHER) {
      filter.teacherId = new Types.ObjectId(getUserId(actor));
    }

    const history = await this.attendanceModel
      .find({ ...filter, status: { $exists: true, $ne: null } })
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .sort({ date: -1 })
      .lean();
    return this.storageUrlService.transformSensitiveAssetUrls(history);
  }

  async getAttendanceStats(
    classId: string,
    startDate: string,
    endDate: string,
    user: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    assertClassAccess(classroom, user);

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const stats = await this.attendanceModel.aggregate([
      {
        $match: {
          classId: new Types.ObjectId(classId),
          date: { $gte: start, $lte: end },
          status: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return { classId, period: { startDate, endDate }, statistics: stats };
  }

  async getAttendanceReport(
    startDate: string,
    endDate: string,
    classId?: string,
    actor?: JwtPayload,
    page: number = 1,
    limit: number = 20,
  ) {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const filter: any = {
      date: { $gte: start, $lte: end },
      status: { $in: [...COUNTED_ATTENDANCE_STATUSES] },
    };
    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException('classId khong hop le');
      }
      filter.classId = new Types.ObjectId(classId);
    }
    if (actor?.role === Role.TEACHER) {
      filter.teacherId = new Types.ObjectId(getUserId(actor));
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .populate('studentId', 'fullName age parentName faceImage studentCode totalPurchasedSessions')
        .populate('classId', 'name code')
        .populate('teacherId', 'fullName email')
        .sort({ date: -1, attendedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.attendanceModel.countDocuments(filter),
    ]);

    return this.storageUrlService.transformSensitiveAssetUrls({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  }

  async getTeacherClassAssignments(user: JwtPayload) {
    if (!isTeacher(user)) {
      throw new ForbiddenException('Chỉ giáo viên mới sử dụng chức năng này');
    }

    const teacherId = new Types.ObjectId(getUserId(user));
    const classes = await this.classModel
      .find({
        $or: [
          { teacher: teacherId },
          { 'substituteTeachers.teacherId': teacherId },
          { 'coTeachers.teacherId': teacherId },
        ],
      })
      .populate('students', 'fullName age parentName studentCode parentPhone')
      .lean();

    return classes.map((cls: any) => ({
      classId: cls._id.toString(),
      classCode: cls.code || '',
      className: cls.name || `Lớp ${cls.code}`,
      studentCount: cls.students?.length || 0,
      students: (cls.students || [])
        .map((s: any) => ({
          studentId: s._id.toString(),
          fullName: s.fullName || '',
          studentCode: s.studentCode || '',
          age: s.age,
          parentName: s.parentName || '',
          parentPhone: s.parentPhone || '',
        }))
        .sort((a: any, b: any) =>
          a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' }),
        ),
    })).sort((a: any, b: any) =>
      a.classCode.localeCompare(b.classCode, 'vi', { sensitivity: 'base' }),
    );
  }

  async getChildrenAttendance(parentUserId: string, fromDate?: string, toDate?: string) {
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);
    const filter: any = {
      studentId: { $in: childIds },
      status: { $exists: true, $ne: null },
    };
    const dateFilter = buildDateFilter(fromDate, toDate);
    if (dateFilter) filter.date = dateFilter;

    const records = await this.attendanceModel
      .find(filter)
      .populate('classId', 'name code')
      .sort({ date: -1 })
      .lean();

    const grouped = children.map((child) => {
      const studentRecords = records.filter(
        (r) => (r as any).studentId?.toString() === child._id.toString(),
      );
      return {
        student: child,
        records: studentRecords.map((r: any) => ({
          _id: r._id,
          date: r.date,
          status: r.status,
          className: r.classId?.name || '',
          classCode: r.classId?.code || '',
          notes: r.notes || '',
          parentConfirm: r.parentConfirm,
        })),
      };
    });

    return { children: grouped };
  }

  async getChildrenAttendanceStats(parentUserId: string, fromDate?: string, toDate?: string) {
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);

    const match: any = {
      studentId: { $in: childIds },
      status: { $exists: true, $ne: null },
    };
    const dateFilter = buildDateFilter(fromDate, toDate);
    if (dateFilter) {
      match.date = dateFilter;
    }

    const stats = await this.attendanceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { student: '$studentId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = children.map((child) => {
      const childStats = stats.filter(
        (s) => s._id.student.toString() === child._id.toString(),
      );
      const total = childStats.reduce((sum, s) => sum + s.count, 0);
      const present = childStats.find((s) => s._id.status === 'PRESENT')?.count || 0;
      const absent = childStats.find((s) => s._id.status === 'ABSENT')?.count || 0;
      const late = childStats.find((s) => s._id.status === 'LATE')?.count || 0;

      return {
        student: child,
        total,
        present,
        absent,
        late,
        presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
        absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
      };
    });

    return { children: result };
  }

  async getClassesWithStudents(user: JwtPayload) {
    const filter: any = {};

    if (isTeacher(user)) {
      const teacherId = new Types.ObjectId(getUserId(user));
      filter.$or = [
        { teacher: teacherId },
        { 'substituteTeachers.teacherId': teacherId },
        { 'coTeachers.teacherId': teacherId },
      ];
    }

    const classes = await this.classModel
      .find(filter)
      .populate('students', 'fullName age parentName studentCode parentPhone')
      .lean();

    return classes.map((cls: any) => ({
      classId: cls._id.toString(),
      classCode: cls.code || '',
      className: cls.name || `Lớp ${cls.code}`,
      studentCount: cls.students?.length || 0,
      students: (cls.students || [])
        .map((s: any) => ({
          studentId: s._id.toString(),
          fullName: s.fullName || '',
          studentCode: s.studentCode || '',
          age: s.age,
          parentName: s.parentName || '',
          parentPhone: s.parentPhone || '',
        }))
        .sort((a: any, b: any) =>
          a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' }),
        ),
    })).sort((a: any, b: any) =>
      a.classCode.localeCompare(b.classCode, 'vi', { sensitivity: 'base' }),
    );
  }
}
