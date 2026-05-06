import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
} from './schemas/attendance.schema';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateAttendanceDto, BulkAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { GenerateAttendanceLinkDto, StudentAttendanceDto } from './dto/generate-link.dto';
import { ClassesService } from '../classes/classes.service';
import { normalizeDate } from '../common/utils/date.utils';
import {
  ClassLean,
  getUserId,
  isTeacher,
  isCountedAttendanceStatus,
  normalizeInteractiveAttendanceStatus,
  normalizeBulkAttendanceStatus,
  assertClassAccess,
  getSubstituteInfo,
  resolveAttendanceTeacherId,
  getOpsCheckerId,
} from './attendance.utils';
import { AttendanceSessionBridgeService } from './attendance-session-bridge.service';
import { AttendanceQueryService } from './attendance-query.service';
import { AttendanceLinkService } from './attendance-link.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly classesService: ClassesService,
    private readonly sessionBridgeService: AttendanceSessionBridgeService,
    private readonly queryService: AttendanceQueryService,
    private readonly linkService: AttendanceLinkService,
  ) {}

  private async ensureClassForCode(classCode: string, user: JwtPayload): Promise<ClassLean> {
    const code = classCode.trim().toUpperCase();
    const existing = await this.classModel.findOne({ code }).lean<ClassLean>();
    if (existing) return existing;

    const teacherId = isTeacher(user)
      ? new Types.ObjectId(getUserId(user))
      : new Types.ObjectId();

    const doc = await this.classModel.create({
      name: `Lớp ${code}`,
      code,
      teacher: teacherId,
      students: [],
    });
    return doc.toObject() as ClassLean;
  }

  async markAttendance(dto: CreateAttendanceDto, user: JwtPayload) {
    const date = normalizeDate(dto.date);
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    assertClassAccess(classroom, user, date);
    const normalizedStatus = normalizeInteractiveAttendanceStatus(dto.status);

    const studentInClass = classroom.students?.some(
      (s: any) => s.toString() === dto.studentId,
    );
    if (!studentInClass) {
      throw new BadRequestException('Học sinh không thuộc lớp này');
    }

    const subInfo = getSubstituteInfo(classroom, user, date);
    const attendanceTeacherId = resolveAttendanceTeacherId(classroom, user, date);
    const opsChecker = getOpsCheckerId(user);

    const result = normalizedStatus
      ? await this.sessionBridgeService.processOneStudent({
          classId: dto.classId,
          studentId: dto.studentId,
          date,
          status: normalizedStatus,
          notes: dto.notes || '',
          teacherId: attendanceTeacherId,
          classroom,
          substitutePayRate: subInfo?.payRate,
          checkedBy: opsChecker,
        })
      : {
          attendance: null,
          sessionCreated: await this.sessionBridgeService.clearAttendanceRecord({
            classId: dto.classId,
            studentId: dto.studentId,
            date,
          }),
        };

    let offlineSummary:
      | { attendedCount: number; perStudentTeacherPay: number; totalTeacherPayout: number; minimumApplied: boolean }
      | null = null;
    if ((classroom as any).classMode === ClassMode.OFFLINE) {
      offlineSummary = await this.sessionBridgeService.recomputeOfflineTeacherPayoutForDay({
        classId: dto.classId,
        date,
        classroom,
      });
    }

    const populated = result.attendance?._id
      ? await this.attendanceModel
          .findById(result.attendance._id)
          .populate('studentId', 'fullName age parentName')
          .populate('classId', 'name code')
          .lean()
      : null;

    return {
      ...(populated || {}),
      sessionCreated: result.sessionCreated,
      ...(offlineSummary
        ? {
            classMode: 'OFFLINE',
            attendedCount: offlineSummary.attendedCount,
            teacherPayPerStudent: offlineSummary.perStudentTeacherPay,
            totalTeacherPayout: offlineSummary.totalTeacherPayout,
            minimumTeacherPayoutApplied: offlineSummary.minimumApplied,
          }
        : {}),
    };
  }

  async bulkMarkAttendance(dto: BulkAttendanceDto, user: JwtPayload) {
    const date = normalizeDate(dto.date);
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    assertClassAccess(classroom, user, date);

    const isOffline = (classroom as any).classMode === ClassMode.OFFLINE;

    const subInfo = getSubstituteInfo(classroom, user, date);
    const attendanceTeacherId = resolveAttendanceTeacherId(classroom, user, date);
    const opsChecker = getOpsCheckerId(user);

    const students = await this.queryService.loadStudentsForClass(classroom, user, date);
    const allowedIds = new Set(students.map((s) => s._id.toString()));

    let attendedCount = 0;
    let teacherPayPerStudent = Number((classroom as any).teacherPayPerStudent ?? 0);
    let totalTeacherPayout = 0;
    let minimumTeacherPayoutApplied = false;

    const results: any[] = [];
    const errors: Array<{ studentId: string; message: string }> = [];
    let sessionsCreated = 0;
    let totalProcessed = 0;
    const submittedIds = new Set<string>();

    for (const item of dto.attendances) {
      if (!allowedIds.has(item.studentId)) {
        errors.push({
          studentId: item.studentId,
          message: 'Học sinh không thuộc lớp học này',
        });
        continue;
      }

      try {
        submittedIds.add(item.studentId);
        const normalizedStatus = normalizeBulkAttendanceStatus(item.status);
        if (normalizedStatus) {
          const result = await this.sessionBridgeService.processOneStudent({
            classId: dto.classId,
            studentId: item.studentId,
            date,
            status: normalizedStatus,
            notes: item.notes || '',
            teacherId: attendanceTeacherId,
            classroom,
            substitutePayRate: subInfo?.payRate,
            checkedBy: opsChecker,
          });
          results.push(result.attendance);
          if (result.sessionCreated) sessionsCreated++;
        } else {
          await this.sessionBridgeService.clearAttendanceRecord({
            classId: dto.classId,
            studentId: item.studentId,
            date,
          });
        }
        totalProcessed++;
      } catch (err: any) {
        errors.push({
          studentId: item.studentId,
          message: err.message || 'Lỗi không xác định',
        });
      }
    }

    if (isOffline) {
      for (const student of students) {
        const sid = student._id.toString();
        if (submittedIds.has(sid)) continue;

        try {
          const result = await this.sessionBridgeService.processOneStudent({
            classId: dto.classId,
            studentId: sid,
            date,
            status: AttendanceStatus.ABSENT,
            notes: 'Khong co mat (OFFLINE auto-absent)',
            teacherId: attendanceTeacherId,
            classroom,
            substitutePayRate: subInfo?.payRate,
            checkedBy: opsChecker,
          });
          results.push(result.attendance);
          if (result.sessionCreated) sessionsCreated++;
        } catch (err: any) {
          errors.push({
            studentId: sid,
            message: err.message || 'Lỗi không xác định',
          });
        }
      }

      const summary = await this.sessionBridgeService.recomputeOfflineTeacherPayoutForDay({
        classId: dto.classId,
        date,
        classroom,
      });
      attendedCount = summary.attendedCount;
      teacherPayPerStudent = summary.perStudentTeacherPay;
      totalTeacherPayout = summary.totalTeacherPayout;
      minimumTeacherPayoutApplied = summary.minimumApplied;

      this.logger.log(
        `[OFFLINE] Class ${dto.classId}: attended=${attendedCount}, ` +
          `teacherPayPerStudent=${teacherPayPerStudent}, ` +
          `totalTeacherPayout=${totalTeacherPayout}, ` +
          `minimumApplied=${minimumTeacherPayoutApplied}`,
      );
    }

    return {
      success: results,
      errors,
      sessionsCreated,
      totalProcessed,
      totalErrors: errors.length,
      ...(isOffline
        ? {
            attendedCount,
            classMode: 'OFFLINE',
            teacherPayPerStudent,
            totalTeacherPayout,
            minimumTeacherPayoutApplied,
          }
        : {}),
    };
  }

  async updateAttendance(id: string, dto: UpdateAttendanceDto, user: JwtPayload) {
    const mongoSession = await this.connection.startSession();
    let classroomForRecompute: ClassLean | null = null;
    let classIdForRecompute: Types.ObjectId | null = null;
    let dateForRecompute: Date | null = null;

    try {
      mongoSession.startTransaction();

      const attendance = await this.attendanceModel.findById(id).session(mongoSession);
      if (!attendance) throw new BadRequestException('Khong tim thay ban ghi diem danh');

      const classroom = await this.classModel
        .findById(attendance.classId)
        .lean<ClassLean>();
      assertClassAccess(classroom, user, attendance.date);
      classroomForRecompute = classroom;
      classIdForRecompute = attendance.classId;
      dateForRecompute = attendance.date;

      const existingFinalized = await this.sessionBridgeService.findFinalizedSessionForAttendance(
        attendance.classId,
        attendance.studentId,
        attendance.date,
        mongoSession,
      );
      if (existingFinalized) {
        throw new BadRequestException(
          'Buoi hoc da duoc xac nhan hoan thanh (FINALIZED). Khong the thay doi diem danh.',
        );
      }

      const subInfo = getSubstituteInfo(classroom, user, attendance.date);
      const attendanceTeacherId = resolveAttendanceTeacherId(classroom, user, attendance.date);

      const prevStatus = attendance.status;
      const newStatus = dto.status || prevStatus;

      const wasCounted = isCountedAttendanceStatus(prevStatus);
      const isCounted = isCountedAttendanceStatus(newStatus);

      if (!wasCounted && isCounted) {
        const sid = await this.sessionBridgeService.syncSessionForAttendance({
          classId: attendance.classId,
          studentId: attendance.studentId,
          teacherId: attendanceTeacherId,
          date: attendance.date,
          classroom,
          substitutePayRate: subInfo?.payRate,
          mongoSession,
        });
        if (!sid) {
          throw new ConflictException(
            'Khong the dong bo session cho diem danh hien tai. Vui long thu lai.',
          );
        }
        attendance.sessionId = sid;
      } else if (wasCounted && !isCounted) {
        if (attendance.sessionId) {
          await this.sessionBridgeService.cancelLinkedSession(attendance.sessionId, mongoSession);
          attendance.sessionId = undefined;
        }
      }

      if (dto.status) attendance.status = dto.status;
      if (dto.notes !== undefined) attendance.notes = dto.notes;
      attendance.teacherId = attendanceTeacherId;
      await attendance.save({ session: mongoSession });

      await mongoSession.commitTransaction();
    } catch (err) {
      if (mongoSession.inTransaction()) {
        await mongoSession.abortTransaction();
      }
      throw err;
    } finally {
      await mongoSession.endSession();
    }

    if (
      classroomForRecompute &&
      classIdForRecompute &&
      dateForRecompute &&
      (classroomForRecompute as any).classMode === ClassMode.OFFLINE
    ) {
      await this.sessionBridgeService.recomputeOfflineTeacherPayoutForDay({
        classId: classIdForRecompute,
        date: dateForRecompute,
        classroom: classroomForRecompute,
      });
    }

    return this.attendanceModel
      .findById(id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .lean();
  }

  // Delegate to AttendanceQueryService
  async getAttendanceByClass(classId: string, date: string, user: JwtPayload) {
    return this.queryService.getAttendanceByClass(classId, date, user);
  }

  async getStudentAttendanceHistory(studentId: string, classId?: string, actor?: JwtPayload) {
    return this.queryService.getStudentAttendanceHistory(studentId, classId, actor);
  }

  async getAttendanceStats(classId: string, startDate: string, endDate: string, user: JwtPayload) {
    return this.queryService.getAttendanceStats(classId, startDate, endDate, user);
  }

  async getAttendanceReport(
    startDate: string, endDate: string, classId?: string,
    actor?: JwtPayload, page?: number, limit?: number,
  ) {
    return this.queryService.getAttendanceReport(startDate, endDate, classId, actor, page, limit);
  }

  async getTeacherClassAssignments(user: JwtPayload) {
    return this.queryService.getTeacherClassAssignments(user);
  }

  async getChildrenAttendance(parentUserId: string, fromDate?: string, toDate?: string) {
    return this.queryService.getChildrenAttendance(parentUserId, fromDate, toDate);
  }

  async getChildrenAttendanceStats(parentUserId: string, fromDate?: string, toDate?: string) {
    return this.queryService.getChildrenAttendanceStats(parentUserId, fromDate, toDate);
  }

  async getClassesWithStudents(user: JwtPayload) {
    return this.queryService.getClassesWithStudents(user);
  }

  async getAttendanceReportClasses(user: JwtPayload, search?: string, limit?: number) {
    return this.queryService.getAttendanceReportClasses(user, search, limit);
  }

  // Delegate to AttendanceLinkService
  async generateAttendanceLink(dto: GenerateAttendanceLinkDto, user: JwtPayload) {
    return this.linkService.generateAttendanceLink(dto, user);
  }

  async getAttendanceByToken(token: string) {
    return this.linkService.getAttendanceByToken(token);
  }

  async submitStudentAttendance(dto: StudentAttendanceDto) {
    return this.linkService.submitStudentAttendance(dto);
  }
}
