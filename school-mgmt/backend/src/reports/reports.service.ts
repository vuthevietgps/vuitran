import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import {
  PayrollTransaction,
  PayrollTransactionDocument,
} from '../payroll/schemas/payroll-transaction.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { normalizeDate } from '../common/utils/date.utils';
import { InlineUpdateDto } from './dto/inline-update.dto';
import { StorageUrlService } from '../common/storage-url.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(PayrollTransaction.name)
    private readonly payrollTxModel: Model<PayrollTransactionDocument>,
    private readonly storageUrlService: StorageUrlService,
  ) {}

  private objectIdToString(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Types.ObjectId) return value.toString();
    if (value?._id) return this.objectIdToString(value._id);
    if (typeof value.toString === 'function') {
      const str = value.toString();
      return str && str !== '[object Object]' ? str : null;
    }
    return null;
  }

  private buildShareholderDisplayLabel(prefix: string, code: unknown, fallbackId: unknown): string {
    const normalizedCode = typeof code === 'string' ? code.trim() : '';
    if (normalizedCode) {
      return normalizedCode;
    }

    const id = this.objectIdToString(fallbackId);
    if (id) {
      return `${prefix} #${id.slice(-6).toUpperCase()}`;
    }

    return `${prefix} #AN_DANH`;
  }

  private sanitizeTeachingReportRowForShareholder(row: any) {
    const studentLabel = this.buildShareholderDisplayLabel(
      'HS',
      row?.studentId?.studentCode,
      row?.studentId?._id,
    );
    const teacherLabel = this.buildShareholderDisplayLabel(
      'GV',
      row?.teacherId?.userCode,
      row?.teacherId?._id,
    );

    return {
      ...row,
      imageUrl: undefined,
      salaryAmount: null,
      penaltyAmount: null,
      bonusAmount: null,
      studentId: row?.studentId
        ? {
            ...row.studentId,
            fullName: studentLabel,
            age: undefined,
            faceImage: undefined,
          }
        : row?.studentId,
      teacherId: row?.teacherId
        ? {
            ...row.teacherId,
            fullName: teacherLabel,
            email: undefined,
          }
        : row?.teacherId,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // GET /reports/teaching
  // Aggregation pipeline: Attendance → Sessions (SSOT teaching report)
  //                                  → PayrollTransactions (SSOT salary)
  //                                  → Students, Classrooms, Users
  // ──────────────────────────────────────────────────────────────────────

  async getTeachingReport(
    startDate: string,
    endDate: string,
    classId?: string,
    teacherId?: string,
    actor?: JwtPayload,
    page: number = 1,
    limit: number = 20,
  ) {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const matchStage: any = {
      date: { $gte: start, $lte: end },
      status: 'PRESENT',
    };

    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException('classId không hợp lệ');
      }
      matchStage.classId = new Types.ObjectId(classId);
    }

    // TEACHER role chỉ được xem dữ liệu của chính mình
    if (actor?.role === Role.TEACHER) {
      matchStage.teacherId = new Types.ObjectId(actor.sub ?? actor._id);
    } else if (teacherId) {
      if (!Types.ObjectId.isValid(teacherId)) {
        throw new BadRequestException('teacherId không hợp lệ');
      }
      matchStage.teacherId = new Types.ObjectId(teacherId);
    }

    const skip = (page - 1) * limit;

    const result = await this.attendanceModel.aggregate([
      { $match: matchStage },

      // 1. Join với Sessions (SSOT: teachingReport, status, parentFeedback)
      {
        $lookup: {
          from: 'sessions',
          localField: 'sessionId',
          foreignField: '_id',
          as: 'sessionData',
        },
      },
      { $unwind: { path: '$sessionData', preserveNullAndEmptyArrays: true } },

      // 2. Join với PayrollTransaction (SSOT: lương, trạng thái thanh toán)
      {
        $lookup: {
          from: 'payrolltransactions',
          localField: 'sessionId',
          foreignField: 'sessionId',
          as: 'payrollData',
        },
      },
      { $unwind: { path: '$payrollData', preserveNullAndEmptyArrays: true } },

      // 3. Join với Students
      {
        $lookup: {
          from: 'students',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },

      // 4. Join với Classrooms
      {
        $lookup: {
          from: 'classrooms',
          localField: 'classId',
          foreignField: '_id',
          as: 'classroom',
        },
      },
      { $unwind: { path: '$classroom', preserveNullAndEmptyArrays: true } },

      // 5. Join với Users (Teachers)
      {
        $lookup: {
          from: 'users',
          localField: 'teacherId',
          foreignField: '_id',
          as: 'teacher',
        },
      },
      { $unwind: { path: '$teacher', preserveNullAndEmptyArrays: true } },

      { $sort: { date: -1, attendedAt: -1 } },

      // 6. $facet: song song đếm tổng và lấy data có phân trang
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: skip },
            { $limit: limit },
            // Project: gom dữ liệu từ đúng SSOT về một shape thống nhất
            {
              $project: {
                _id: 1,
                attendanceId: '$_id',
                date: 1,
                attendedAt: 1,
                imageUrl: 1,
                sessionDuration: 1,
                sessionIndex: 1,
                sessionId: 1,

                // ── Từ SESSIONS (SSOT) ──────────────────────────────────────
                sessionContent: '$sessionData.teachingReport.lessonContent',
                studentAttitude: '$sessionData.teachingReport.studentAttitude',
                comment: '$sessionData.teachingReport.teacherComment',
                recordLink: '$sessionData.teachingReport.recordingUrl',
                homework: '$sessionData.teachingReport.homework',
                additionalNotes: '$sessionData.teachingReport.additionalNotes',
                reportSubmittedAt: '$sessionData.teachingReport.submittedAt',
                isLateReport: '$sessionData.teachingReport.isLateSubmission',
                lateHours: '$sessionData.teachingReport.lateSubmissionHours',
                hasTeachingReport: '$sessionData.hasTeachingReport',
                sessionStatus: '$sessionData.status',
                parentConfirm: '$sessionData.parentFeedback.isSatisfied',

                // ── Từ PAYROLLTRANSACTIONS (SSOT) ────────────────────────────
                salaryAmount: '$payrollData.finalSalary',
                paymentStatus: '$payrollData.status',
                penaltyAmount: '$payrollData.penaltyAmount',
                bonusAmount: '$payrollData.bonusAmount',

                // ── Thông tin liên quan ──────────────────────────────────────
                studentId: {
                  _id: '$student._id',
                  studentCode: '$student.studentCode',
                  fullName: '$student.fullName',
                  age: '$student.age',
                  faceImage: '$student.faceImage',
                },
                classId: {
                  _id: '$classroom._id',
                  code: '$classroom.code',
                  name: '$classroom.name',
                },
                teacherId: {
                  _id: '$teacher._id',
                  fullName: '$teacher.fullName',
                  email: '$teacher.email',
                  userCode: '$teacher.userCode',
                },
              },
            },
          ],
        },
      },
    ]);

    const fetchedData = actor?.role === Role.SHAREHOLDER
      ? (result[0]?.data ?? []).map((row: any) => this.sanitizeTeachingReportRowForShareholder(row))
      : (result[0]?.data ?? []);
    const total = result[0]?.metadata?.length > 0 ? result[0].metadata[0].total : 0;

    return {
      data: this.storageUrlService.transformSensitiveAssetUrls(fetchedData),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // PATCH /reports/:attendanceId/inline-update
  // Phân luồng cập nhật về đúng SSOT:
  //   • sessionContent / comment / recordLink → Sessions.teachingReport
  //   • imageUrl                              → Attendance.imageUrl
  // ──────────────────────────────────────────────────────────────────────

  async updateReportRow(
    attendanceId: string,
    dto: InlineUpdateDto,
    actor?: JwtPayload,
  ) {
    if (!Types.ObjectId.isValid(attendanceId)) {
      throw new BadRequestException('attendanceId không hợp lệ');
    }

    const attendance = await this.attendanceModel.findById(attendanceId).lean();
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }

    // TEACHER chỉ được sửa bản ghi của chính mình
    if (actor?.role === Role.TEACHER) {
      const actorId = actor.sub ?? actor._id;
      if (attendance.teacherId?.toString() !== actorId) {
        throw new ForbiddenException('Không có quyền sửa bản ghi này');
      }
    }

    if (!attendance.sessionId) {
      throw new BadRequestException(
        'Bản ghi điểm danh này chưa liên kết với Session',
      );
    }

    // Kiểm tra PayrollTransaction đã APPROVED/PAID → không cho sửa
    const payrollTx = await this.payrollTxModel
      .findOne({ sessionId: attendance.sessionId })
      .lean();
    if (payrollTx && ['APPROVED', 'PAID'].includes(payrollTx.status as string)) {
      throw new ForbiddenException(
        'Không thể sửa báo cáo khi lương đã được duyệt hoặc chi trả',
      );
    }

    const sessionUpdate: Record<string, any> = {};
    const attendanceUpdate: Record<string, any> = {};

    // ── Phân luồng về đúng SSOT ─────────────────────────────────────────
    if (dto.sessionContent !== undefined) {
      sessionUpdate['teachingReport.lessonContent'] = dto.sessionContent;
    }
    if (dto.comment !== undefined) {
      sessionUpdate['teachingReport.teacherComment'] = dto.comment;
    }
    if (dto.recordLink !== undefined) {
      sessionUpdate['teachingReport.recordingUrl'] = dto.recordLink;
    }
    if (dto.imageUrl !== undefined) {
      attendanceUpdate.imageUrl = dto.imageUrl;
    }

    const promises: Promise<any>[] = [];

    if (Object.keys(sessionUpdate).length > 0) {
      sessionUpdate['teachingReport.lastUpdatedAt'] = new Date();
      promises.push(
        this.sessionModel.findByIdAndUpdate(
          attendance.sessionId,
          { $set: sessionUpdate },
          { new: true },
        ),
      );
    }

    if (Object.keys(attendanceUpdate).length > 0) {
      promises.push(
        this.attendanceModel.findByIdAndUpdate(
          attendanceId,
          { $set: attendanceUpdate },
          { new: true },
        ),
      );
    }

    if (promises.length === 0) {
      throw new BadRequestException('Không có trường nào được cập nhật');
    }

    await Promise.all(promises);
    return { success: true };
  }
}
