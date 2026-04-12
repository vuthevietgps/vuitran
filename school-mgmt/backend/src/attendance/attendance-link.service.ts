import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
} from './schemas/attendance.schema';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { GenerateAttendanceLinkDto, StudentAttendanceDto } from './dto/generate-link.dto';
import { randomBytes } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { validateAndProcessBase64Image } from '../common/utils/image-validation.utils';
import { normalizeDate } from '../common/utils/date.utils';
import { StorageUrlService } from '../common/storage-url.service';
import {
  ClassLean,
  assertClassAccess,
  getAttendancePermissions,
  resolveAttendanceTeacherId,
  isCountedAttendanceStatus,
} from './attendance.utils';
import { AttendanceSessionBridgeService } from './attendance-session-bridge.service';

const MIN_PUBLIC_ATTENDANCE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AttendanceLinkService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    private readonly sessionBridgeService: AttendanceSessionBridgeService,
    private readonly storageUrlService: StorageUrlService,
  ) {}

  private calculateTokenExpiresAt(attendanceDate: Date, now = new Date()): Date {
    const minimumExpiresAt = new Date(now.getTime() + MIN_PUBLIC_ATTENDANCE_TOKEN_TTL_MS);
    const attendanceDayEnd = new Date(attendanceDate);
    attendanceDayEnd.setUTCDate(attendanceDayEnd.getUTCDate() + 1);
    attendanceDayEnd.setUTCMilliseconds(-1);

    return attendanceDayEnd.getTime() > minimumExpiresAt.getTime()
      ? attendanceDayEnd
      : minimumExpiresAt;
  }

  async generateAttendanceLink(dto: GenerateAttendanceLinkDto, user: JwtPayload) {
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    const date = normalizeDate(dto.date);
    assertClassAccess(classroom, user, date);
    const permissions = getAttendancePermissions(classroom, user, date);
    if (!permissions.canGenerateLink) {
      throw new ForbiddenException(
        permissions.blockedReason || 'Ban khong co quyen tao link diem danh cho lop hoc nay.',
      );
    }

    const studentInClass = classroom.students?.some(
      (s: any) => s.toString() === dto.studentId,
    );
    if (!studentInClass) {
      throw new BadRequestException('Hoc sinh khong thuoc lop nay');
    }

    const attendanceTeacherId = resolveAttendanceTeacherId(classroom, user, date);

    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = this.calculateTokenExpiresAt(date);

    const classObjId = new Types.ObjectId(dto.classId);
    const studentObjId = new Types.ObjectId(dto.studentId);

    const finalizedSession = await this.sessionBridgeService.findFinalizedSessionForAttendance(
      classObjId,
      studentObjId,
      date,
    );
    if (finalizedSession) {
      throw new BadRequestException(
        'Buá»•i há»c Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c nháº­n hoÃ n thÃ nh (FINALIZED). KhÃ´ng thá»ƒ táº¡o láº¡i link Ä‘iá»ƒm danh.',
      );
    }

    const existingAttendance = await this.attendanceModel.findOne({
      classId: dto.classId,
      studentId: dto.studentId,
      date,
    });

    if (existingAttendance) {
      const alreadyMarkedPresent =
        existingAttendance.attendedAt ||
        isCountedAttendanceStatus(existingAttendance.status);
      if (alreadyMarkedPresent) {
        throw new BadRequestException(
          'Há»c sinh Ä‘Ã£ Ä‘Æ°á»£c Ä‘iá»ƒm danh cho ngÃ y nÃ y. KhÃ´ng thá»ƒ táº¡o láº¡i link.',
        );
      }

      if (existingAttendance.sessionId) {
        const linkedSession = await this.sessionModel
          .findById(existingAttendance.sessionId)
          .select('status')
          .lean();
        if (
          linkedSession &&
          !['CANCELLED', 'RESCHEDULED'].includes((linkedSession as any).status)
        ) {
          throw new BadRequestException(
            'Buá»•i há»c Ä‘Ã£ cÃ³ session Ä‘ang hoáº¡t Ä‘á»™ng. KhÃ´ng thá»ƒ táº¡o láº¡i link Ä‘iá»ƒm danh.',
          );
        }
      }

      existingAttendance.teacherId = attendanceTeacherId;
      existingAttendance.status = undefined as any;
      existingAttendance.notes = '';
      existingAttendance.sessionId = undefined;
      existingAttendance.attendanceToken = token;
      existingAttendance.tokenExpiresAt = tokenExpiresAt;
      existingAttendance.imageUrl = undefined;
      existingAttendance.imageFileKey = undefined;
      existingAttendance.attendedAt = undefined;
      await existingAttendance.save();
    } else {
      await this.attendanceModel.create({
        classId: dto.classId,
        studentId: dto.studentId,
        teacherId: attendanceTeacherId,
        date,
        attendanceToken: token,
        tokenExpiresAt,
        imageUrl: null,
        imageFileKey: null,
        attendedAt: null,
      });
    }

    const att = await this.attendanceModel
      .findOne({ classId: dto.classId, studentId: dto.studentId, date })
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code');

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const attendanceUrl = `${baseUrl}/student-attendance/${token}`;

    return {
      attendance: this.storageUrlService.transformSensitiveAssetUrls(att?.toObject ? att.toObject() : att),
      attendanceUrl,
      token,
      expiresAt: tokenExpiresAt,
    };
  }

  async getAttendanceByToken(token: string) {
    const att = await this.attendanceModel
      .findOne({ attendanceToken: token })
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();

    if (!att) throw new NotFoundException('Link Ä‘iá»ƒm danh khÃ´ng há»£p lá»‡');
    if (att.tokenExpiresAt && new Date() > att.tokenExpiresAt) {
      throw new BadRequestException('Link Ä‘iá»ƒm danh Ä‘Ã£ háº¿t háº¡n');
    }
    if (att.attendedAt) {
      throw new BadRequestException('ÄÃ£ Ä‘iá»ƒm danh rá»“i, khÃ´ng thá»ƒ Ä‘iá»ƒm danh láº¡i');
    }
    return this.storageUrlService.transformSensitiveAssetUrls(att);
  }

  async submitStudentAttendance(dto: StudentAttendanceDto) {
    const attendance = await this.attendanceModel.findOne({
      attendanceToken: dto.token,
    });
    if (!attendance) throw new NotFoundException('Link Ä‘iá»ƒm danh khÃ´ng há»£p lá»‡');
    if (attendance.tokenExpiresAt && new Date() > attendance.tokenExpiresAt) {
      throw new BadRequestException('Link Ä‘iá»ƒm danh Ä‘Ã£ háº¿t háº¡n');
    }
    if (attendance.attendedAt) {
      throw new BadRequestException('ÄÃ£ Ä‘iá»ƒm danh rá»“i');
    }

    const normalizedImageBase64 = dto.imageBase64?.trim();
    const imageData = validateAndProcessBase64Image(
      normalizedImageBase64,
      5,
      `attendance_${attendance._id}`,
    );

    const uploadsDir = join(process.cwd(), 'uploads', 'attendance');
    await mkdir(uploadsDir, { recursive: true, mode: 0o700 });
    await writeFile(join(uploadsDir, imageData.filename), imageData.buffer, {
      mode: 0o600,
    });

    attendance.status = AttendanceStatus.PRESENT;
    attendance.imageUrl = `/uploads/attendance/${imageData.filename}`;
    attendance.imageFileKey = `attendance/${imageData.filename}`;
    attendance.attendedAt = new Date();
    await attendance.save();

    const classroom = await this.classModel
      .findById(attendance.classId)
      .lean<ClassLean>();
    if (classroom) {
      const sid = await this.sessionBridgeService.syncSessionForAttendance({
        classId: attendance.classId,
        studentId: attendance.studentId,
        teacherId: attendance.teacherId,
        date: attendance.date,
        classroom,
      });
      if (sid) {
        attendance.sessionId = sid;
        await attendance.save();
      }

      if ((classroom as any).classMode === ClassMode.OFFLINE) {
        await this.sessionBridgeService.recomputeOfflineTeacherPayoutForDay({
          classId: attendance.classId,
          date: attendance.date,
          classroom,
        });
      }
    }

    const savedAttendance = await this.attendanceModel
      .findById(attendance._id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();
    return this.storageUrlService.transformSensitiveAssetUrls(savedAttendance);
  }
}
