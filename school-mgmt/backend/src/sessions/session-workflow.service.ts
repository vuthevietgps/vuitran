import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  Session,
  SessionDocument,
  SessionStatus,
  CancelledByRole,
} from './schemas/session.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
} from '../attendance/schemas/attendance.schema';

import { CompleteSessionDto } from './dto/complete-session.dto';
import { ConfirmSessionDto } from './dto/confirm-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { RescheduleSessionDto } from './dto/reschedule-session.dto';
import { SubmitTeachingReportDto } from './dto/submit-teaching-report.dto';
import { BulkTeachingReportDto } from './dto/bulk-teaching-report.dto';
import { SessionSettlementService } from './session-settlement.service';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotificationPriority,
  NotificationType,
} from '../notifications/schemas/notification.schema';
import { PayrollTransactionService } from '../payroll/payroll-transaction.service';
import { HoldReason } from '../payroll/schemas/payroll-transaction.schema';
import { TicketsService } from '../tickets/tickets.service';
import { TicketType, TicketPriority } from '../tickets/schemas/ticket.schema';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';
import { getClassPricingConfigAt } from '../classes/student-config.utils';

import {
  objectIdToString,
  toSafeNumber,
  extractErrorMessage,
  shouldKeepZeroTeacherPayout,
  roundMoneyDownToThousand,
  calcHoursBefore,
} from './helpers/session.utils';
import {
  calculateTeachingReportDeadline,
  calculateVietnamLateHours,
} from './helpers/vietnam-timezone.utils';
import { ClassMode } from '../classes/schemas/class.schema';
import { SessionsService } from './sessions.service';
import { StorageUrlService } from '../common/storage-url.service';
import { PayrollTransactionStatus } from '../payroll/schemas/payroll-transaction.schema';
import {
  ReportTemplate,
  ReportTemplateDocument,
  ReportTemplateDynamicField,
} from '../report-templates/schemas/report-template.schema';

// ─── Constants ───────────────────────────────────────────────────────
const TEACHING_REPORT_DEADLINE_HOURS = 24;

type TeachingReportDynamicValue = string | number | boolean;

type TeachingReportDynamicValueMap = Record<string, TeachingReportDynamicValue>;

type TeachingReportTemplateContext = {
  templateId?: string;
  templateTitle?: string;
  templateVersion?: number;
  dynamicFieldSchemaSnapshot: ReportTemplateDynamicField[];
};

type TeachingReportInput = Pick<
  SubmitTeachingReportDto,
  | 'lessonContent'
  | 'studentAttitude'
  | 'recordingUrl'
  | 'teacherComment'
  | 'homework'
  | 'additionalNotes'
  | 'templateId'
  | 'dynamicFieldValues'
>;

type PreparedTeachingReportPayload = {
  lessonContent: string;
  studentAttitude?: string;
  recordingUrl?: string;
  recordingFileKey?: string;
  teacherComment?: string;
  homework?: string;
  additionalNotes?: string;
  templateId?: Types.ObjectId;
  templateTitle?: string;
  templateVersion?: number;
  dynamicFieldValues?: TeachingReportDynamicValueMap;
  dynamicFieldSchemaSnapshot?: ReportTemplateDynamicField[];
};

@Injectable()
export class SessionWorkflowService {
  private readonly logger = new Logger(SessionWorkflowService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(ReportTemplate.name)
    private reportTemplateModel: Model<ReportTemplateDocument>,
    @Inject(forwardRef(() => WalletsService))
    private walletsService: WalletsService,
    private notificationsService: NotificationsService,
    private payrollTxService: PayrollTransactionService,
    private ticketsService: TicketsService,
    private studentSupportSnapshotService: StudentSupportSnapshotService,
    private sessionSettlementService: SessionSettlementService,
    @Inject(forwardRef(() => SessionsService))
    private sessionsService: SessionsService,
    private readonly storageUrlService: StorageUrlService,
  ) {}

  private hasQualifiedTeachingReportContent(lessonContent?: string | null): boolean {
    return typeof lessonContent === 'string' && lessonContent.trim().length >= 20;
  }

  private cloneDynamicFieldSchema(
    fields?: ReportTemplateDynamicField[] | null,
  ): ReportTemplateDynamicField[] {
    if (!Array.isArray(fields) || fields.length === 0) {
      return [];
    }

    return fields
      .map((field) => ({
        key: String(field.key || '').trim(),
        label: String(field.label || '').trim(),
        type: field.type || 'textarea',
        required: field.required === true,
        placeholder: field.placeholder?.trim() || undefined,
        maxLength: typeof field.maxLength === 'number' ? field.maxLength : undefined,
        order: typeof field.order === 'number' ? field.order : 0,
        defaultValue: field.defaultValue?.trim() || undefined,
        options: Array.isArray(field.options)
          ? field.options
              .map((option) => ({
                value: String(option.value || '').trim(),
                label: String(option.label || '').trim(),
              }))
              .filter((option) => option.value && option.label)
          : undefined,
      }))
      .filter((field) => field.key && field.label)
      .sort((left, right) => (left.order || 0) - (right.order || 0));
  }

  private isDynamicValuePresent(
    field: ReportTemplateDynamicField,
    value: TeachingReportDynamicValue | undefined,
  ): boolean {
    if (field.type === 'checkbox') {
      return value === true;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (typeof value === 'boolean') {
      return value;
    }

    return typeof value === 'string' && value.trim().length > 0;
  }

  private formatDynamicValueForSummary(value: TeachingReportDynamicValue): string {
    if (typeof value === 'boolean') {
      return value ? 'Co' : 'Khong';
    }

    return String(value).trim();
  }

  private normalizeAndValidateDynamicFieldValues(
    fields: ReportTemplateDynamicField[],
    rawValues?: Record<string, unknown>,
  ): TeachingReportDynamicValueMap {
    if (!fields.length) {
      return {};
    }

    const values =
      rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)
        ? rawValues
        : {};

    const normalized: TeachingReportDynamicValueMap = {};

    for (const field of fields) {
      const rawValue = (values as Record<string, unknown>)[field.key];
      let nextValue: TeachingReportDynamicValue | undefined;

      switch (field.type) {
        case 'checkbox': {
          const checked =
            rawValue === true
            || rawValue === 'true'
            || rawValue === 1
            || rawValue === '1';
          nextValue = checked;
          if (field.required && nextValue !== true) {
            throw new BadRequestException(`Truong ${field.label} bat buoc phai duoc chon`);
          }
          break;
        }
        case 'number': {
          if (rawValue == null || rawValue === '') {
            nextValue = undefined;
          } else {
            const numericValue = Number(rawValue);
            if (!Number.isFinite(numericValue)) {
              throw new BadRequestException(`Truong ${field.label} phai la so hop le`);
            }
            nextValue = numericValue;
          }
          break;
        }
        default: {
          const textValue =
            typeof rawValue === 'string'
              ? rawValue.trim()
              : rawValue == null
                ? ''
                : String(rawValue).trim();
          nextValue = textValue || undefined;
          break;
        }
      }

      if (!this.isDynamicValuePresent(field, nextValue)) {
        if (field.required) {
          throw new BadRequestException(`Truong ${field.label} khong duoc de trong`);
        }
        continue;
      }

      if (typeof nextValue === 'string') {
        if (field.maxLength && nextValue.length > field.maxLength) {
          throw new BadRequestException(
            `Truong ${field.label} khong duoc vuot qua ${field.maxLength} ky tu`,
          );
        }

        if (field.type === 'url') {
          try {
            const parsedUrl = new URL(nextValue);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
              throw new Error('unsupported-protocol');
            }
          } catch {
            throw new BadRequestException(`Truong ${field.label} phai la URL hop le`);
          }
        }

        if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
          const allowedValues = new Set(field.options.map((option) => option.value));
          if (!allowedValues.has(nextValue)) {
            throw new BadRequestException(`Gia tri cua truong ${field.label} khong hop le`);
          }
        }
      }

      if (nextValue !== undefined) {
        normalized[field.key] = nextValue;
      }
    }

    return normalized;
  }

  private buildLessonContentFromDynamicFields(
    fields: ReportTemplateDynamicField[],
    values: TeachingReportDynamicValueMap,
  ): string {
    return fields
      .filter((field) => this.isDynamicValuePresent(field, values[field.key]))
      .map((field) => `${field.label}: ${this.formatDynamicValueForSummary(values[field.key])}`)
      .join('\n')
      .trim();
  }

  private resolveLegacyTeachingReportValue(
    key: keyof Pick<
      PreparedTeachingReportPayload,
      'studentAttitude' | 'recordingUrl' | 'teacherComment' | 'homework' | 'additionalNotes'
    >,
    dtoValue: string | undefined,
    dynamicValues: TeachingReportDynamicValueMap,
  ): string | undefined {
    if (typeof dtoValue === 'string' && dtoValue.trim()) {
      return dtoValue.trim();
    }

    const dynamicValue = dynamicValues[key];
    return typeof dynamicValue === 'string' && dynamicValue.trim()
      ? dynamicValue.trim()
      : undefined;
  }

  private async resolveTeachingReportTemplateContext(
    session: { classId?: unknown; teachingReport?: any },
    teacherUserId: string,
    templateId?: string,
  ): Promise<TeachingReportTemplateContext> {
    const existingTemplateId = objectIdToString(session.teachingReport?.templateId);
    const existingTemplateTitle =
      typeof session.teachingReport?.templateTitle === 'string'
        ? session.teachingReport.templateTitle
        : undefined;
    const existingTemplateVersion =
      typeof session.teachingReport?.templateVersion === 'number'
        ? session.teachingReport.templateVersion
        : undefined;
    const existingSnapshot = this.cloneDynamicFieldSchema(
      session.teachingReport?.dynamicFieldSchemaSnapshot,
    );

    if (!templateId) {
      return {
        templateId: existingTemplateId || undefined,
        templateTitle: existingTemplateTitle,
        templateVersion: existingTemplateVersion,
        dynamicFieldSchemaSnapshot: existingSnapshot,
      };
    }

    if (!Types.ObjectId.isValid(templateId)) {
      throw new BadRequestException('Template bao cao khong hop le');
    }

    const template = await this.reportTemplateModel.findById(templateId).lean();
    if (!template) {
      if (existingTemplateId === templateId && existingSnapshot.length > 0) {
        return {
          templateId: existingTemplateId,
          templateTitle: existingTemplateTitle,
          templateVersion: existingTemplateVersion,
          dynamicFieldSchemaSnapshot: existingSnapshot,
        };
      }
      throw new NotFoundException('Template bao cao khong ton tai');
    }

    const templateOwnerId = objectIdToString((template as any).teacherId);
    if (!(template as any).isGlobal && templateOwnerId !== teacherUserId) {
      throw new ForbiddenException('Ban khong co quyen su dung template bao cao nay');
    }

    const templateClassId = objectIdToString((template as any).classId);
    const sessionClassId = objectIdToString(session.classId);
    if (templateClassId && templateClassId !== sessionClassId) {
      throw new BadRequestException('Template bao cao khong ap dung cho lop hoc nay');
    }

    return {
      templateId: objectIdToString((template as any)._id) || templateId,
      templateTitle: template.title,
      templateVersion: typeof template.version === 'number' ? template.version : 1,
      dynamicFieldSchemaSnapshot: this.cloneDynamicFieldSchema(
        (template as any).dynamicFields,
      ),
    };
  }

  private async prepareTeachingReportPayload(
    session: { classId?: unknown; teachingReport?: any },
    teacherUserId: string,
    dto: TeachingReportInput,
  ): Promise<PreparedTeachingReportPayload> {
    const templateContext = await this.resolveTeachingReportTemplateContext(
      session,
      teacherUserId,
      dto.templateId,
    );
    const dynamicFieldValues = this.normalizeAndValidateDynamicFieldValues(
      templateContext.dynamicFieldSchemaSnapshot,
      dto.dynamicFieldValues,
    );

    const lessonContent =
      typeof dto.lessonContent === 'string' && dto.lessonContent.trim()
        ? dto.lessonContent.trim()
        : this.buildLessonContentFromDynamicFields(
            templateContext.dynamicFieldSchemaSnapshot,
            dynamicFieldValues,
          );

    if (!this.hasQualifiedTeachingReportContent(lessonContent)) {
      throw new BadRequestException('Noi dung bao cao giang day khong hop le');
    }

    const recordingUrl = this.resolveLegacyTeachingReportValue(
      'recordingUrl',
      dto.recordingUrl,
      dynamicFieldValues,
    );

    return {
      lessonContent,
      studentAttitude: this.resolveLegacyTeachingReportValue(
        'studentAttitude',
        dto.studentAttitude,
        dynamicFieldValues,
      ),
      recordingUrl,
      recordingFileKey:
        this.storageUrlService.extractAssetKey(recordingUrl) ?? undefined,
      teacherComment: this.resolveLegacyTeachingReportValue(
        'teacherComment',
        dto.teacherComment,
        dynamicFieldValues,
      ),
      homework: this.resolveLegacyTeachingReportValue(
        'homework',
        dto.homework,
        dynamicFieldValues,
      ),
      additionalNotes: this.resolveLegacyTeachingReportValue(
        'additionalNotes',
        dto.additionalNotes,
        dynamicFieldValues,
      ),
      templateId: templateContext.templateId
        ? new Types.ObjectId(templateContext.templateId)
        : undefined,
      templateTitle: templateContext.templateTitle,
      templateVersion: templateContext.templateVersion,
      dynamicFieldValues:
        Object.keys(dynamicFieldValues).length > 0 ? dynamicFieldValues : undefined,
      dynamicFieldSchemaSnapshot:
        templateContext.dynamicFieldSchemaSnapshot.length > 0
          ? templateContext.dynamicFieldSchemaSnapshot
          : undefined,
    };
  }

  // ──────────────────────────────────────────────────────────────────
  //  TEACHER COMPLETE  (SCHEDULED → TEACHER_COMPLETED)
  // ──────────────────────────────────────────────────────────────────

  async teacherComplete(
    sessionId: string,
    teacherUserId: string,
    dto: CompleteSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Không thể hoàn thành buổi học ở trạng thái ${session.status}`,
      );
    }

    if (!(await this.canTeacherAccessSession(session, teacherUserId, 'attendance'))) {
      throw new ForbiddenException('Bạn không phải GV của buổi học này');
    }

    if (dto.topicsCovered) session.topicsCovered = dto.topicsCovered;
    if (dto.homework) session.homework = dto.homework;
    if (dto.teacherNotes) session.teacherNotes = dto.teacherNotes;
    if (dto.actualStartTime) session.actualStartTime = new Date(dto.actualStartTime);
    if (dto.actualEndTime) session.actualEndTime = new Date(dto.actualEndTime);

    const evaluation = session.evaluation || {} as any;
    if (dto.lessonObjective) evaluation.lessonObjective = dto.lessonObjective;
    if (dto.lessonContent) evaluation.lessonContent = dto.lessonContent;
    if (dto.materialsUsed) evaluation.materialsUsed = dto.materialsUsed;
    if (dto.skillsTaught) evaluation.skillsTaught = dto.skillsTaught;
    if (dto.studentPerformance) evaluation.studentPerformance = dto.studentPerformance;
    if (dto.studentEngagement) evaluation.studentEngagement = dto.studentEngagement;
    if (dto.comprehensionLevel) evaluation.comprehensionLevel = dto.comprehensionLevel;
    if (dto.strengthsObserved) evaluation.strengthsObserved = dto.strengthsObserved;
    if (dto.areasOfImprovement) evaluation.areasOfImprovement = dto.areasOfImprovement;
    if (dto.homeworkAssigned) {
      evaluation.homeworkAssigned = dto.homeworkAssigned;
      evaluation.homeworkStatus = 'ASSIGNED';
    }
    if (dto.homeworkDeadline) evaluation.homeworkDeadline = new Date(dto.homeworkDeadline);
    if (dto.progressPercent !== undefined) evaluation.progressPercent = dto.progressPercent;
    if (dto.curriculumItemsCompleted) evaluation.curriculumItemsCompleted = dto.curriculumItemsCompleted;
    if (dto.nextSessionPlan) evaluation.nextSessionPlan = dto.nextSessionPlan;
    if (dto.overallComment) evaluation.overallComment = dto.overallComment;
    session.evaluation = evaluation;

    session.status = SessionStatus.TEACHER_COMPLETED;
    session.confirmation.teacherCompletedAt = new Date();

    const savedSession = await session.save();
    await this.ensureAttendanceForCompletedSession(savedSession);
    this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'teacherComplete');
    return savedSession;
  }

  // ──────────────────────────────────────────────────────────────────
  //  TEACHING REPORT (Báo cáo giảng dạy — bắt buộc để tính lương)
  // ──────────────────────────────────────────────────────────────────

  async submitTeachingReport(
    sessionId: string,
    teacherUserId: string,
    dto: SubmitTeachingReportDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (!(await this.canTeacherAccessSession(session, teacherUserId, 'reports'))) {
      throw new ForbiddenException('Bạn không phải GV của buổi học này');
    }

    const allowedForReport = [
      SessionStatus.TEACHER_COMPLETED,
      SessionStatus.PARENT_CONFIRMED,
      SessionStatus.FINALIZED,
    ];
    if (!allowedForReport.includes(session.status)) {
      throw new BadRequestException(
        'Chỉ nộp báo cáo cho buổi học đã hoàn thành',
      );
    }

    // ─── FIX FREEZE: Check PayrollTransaction status ─────────────────────
    const existingPayrollTx = await this.payrollTxService.getBySessionId(sessionId);
    if (existingPayrollTx) {
      const lockedStatuses = ['APPROVED', 'PAID'];
      if (lockedStatuses.includes(existingPayrollTx.status)) {
        throw new BadRequestException(
          `Không thể sửa báo cáo - Lương buổi học này đã được ${
            existingPayrollTx.status === 'PAID' ? 'thanh toán' : 'duyệt'
          }. Vui lòng liên hệ kế toán nếu cần điều chỉnh.`,
        );
      }
    }

    if (!this.hasQualifiedTeachingReportContent(dto.lessonContent)) {
      throw new BadRequestException('Nội dung báo cáo giảng dạy không hợp lệ');
    }

    const deadline = calculateTeachingReportDeadline(
      session.scheduledDate,
      TEACHING_REPORT_DEADLINE_HOURS,
    );

    const now = new Date();
    const lateHours = calculateVietnamLateHours(now, deadline);
    const isLate = lateHours > 0;

    const isUpdate = session.hasTeachingReport && session.teachingReport;
    const currentVersion = session.teachingReport?.version || 0;
    const preparedTeachingReport = await this.prepareTeachingReportPayload(
      session,
      teacherUserId,
      dto,
    );

    session.teachingReport = {
      lessonContent: preparedTeachingReport.lessonContent,
      studentAttitude: preparedTeachingReport.studentAttitude,
      recordingUrl: preparedTeachingReport.recordingUrl,
      recordingFileKey: preparedTeachingReport.recordingFileKey,
      teacherComment: preparedTeachingReport.teacherComment,
      homework: preparedTeachingReport.homework,
      additionalNotes: preparedTeachingReport.additionalNotes,
      templateId: preparedTeachingReport.templateId,
      templateTitle: preparedTeachingReport.templateTitle,
      templateVersion: preparedTeachingReport.templateVersion,
      dynamicFieldValues: preparedTeachingReport.dynamicFieldValues,
      dynamicFieldSchemaSnapshot: preparedTeachingReport.dynamicFieldSchemaSnapshot,
      submittedAt: isUpdate ? session.teachingReport!.submittedAt : now,
      deadline,
      isLateSubmission: isUpdate ? session.teachingReport!.isLateSubmission : isLate,
      lateSubmissionHours: isUpdate ? session.teachingReport!.lateSubmissionHours : lateHours,
      version: currentVersion + 1,
      lastUpdatedAt: now,
    };
    session.hasTeachingReport = true;

    if (toSafeNumber(session.teacherPayout, 0) <= 0 && !shouldKeepZeroTeacherPayout(session)) {
      const classroomId = objectIdToString(session.classId);
      const classroom = await this.classModel
        .findById(classroomId)
        .select(
          'classMode pricingSnapshot durationSnapshots pricePerSession teacherPayPerSession teacherPayPerStudent baseDuration sessionDuration',
        )
        .lean();
      const fallbackTeacherPayout = this.computeTeacherPayoutFallback(session, classroom);
      if (fallbackTeacherPayout > 0) {
        session.teacherPayout = fallbackTeacherPayout;
      }
    }

    if (isLate && !isUpdate) {
      this.logger.warn(
        `Late teaching report submission: Session ${sessionId} by teacher ${teacherUserId} - ${lateHours}h late`,
      );
    }

    this.logger.log(
      `Teaching report ${isUpdate ? 'updated' : 'submitted'} for session ${sessionId} by teacher ${teacherUserId} (version ${currentVersion + 1})`,
    );

    const savedSession = await session.save();

    if (!this.hasQualifiedTeachingReportContent(savedSession.teachingReport?.lessonContent)) {
      this.logger.warn(
        `Skipped payroll creation for session ${sessionId}: teaching report is unqualified`,
      );
      this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'submitTeachingReport');
      return savedSession;
    }

    if (
      !isUpdate &&
      savedSession.teacherPayout &&
      savedSession.teacherPayout > 0 &&
      !(savedSession.sessionType === 'TRIAL' && (savedSession as any).trialRejectedNoPay)
    ) {
      try {
        await this.payrollTxService.createFromSession({
          teacherId: savedSession.teacherId.toString(),
          sessionId: savedSession._id.toString(),
          classId: savedSession.classId.toString(),
          studentId: savedSession.studentId.toString(),
          sessionDate: savedSession.scheduledDate,
          baseSalary: savedSession.teacherPayout,
          isLateReport: isLate,
          lateHours,
          reportDeadline: deadline,
          reportSubmittedAt: now,
          createdBy: teacherUserId,
        });
      } catch (err) {
        this.logger.error(
          `Failed to create PayrollTransaction for session ${sessionId}: ${(err as Error).message}`,
        );
      }
    }

    this.triggerStudentSupportSnapshotRefreshForSession(savedSession, 'submitTeachingReport');
    return this.storageUrlService.transformSensitiveAssetUrls(savedSession.toObject({ depopulate: false })) as any;
  }

  async bulkSubmitTeachingReport(
    classId: string,
    date: string,
    teacherUserId: string,
    dto: BulkTeachingReportDto,
  ): Promise<{ updatedCount: number; skippedCount: number; results: { sessionId: string; status: string; action: string }[] }> {
    const classObjectId = new Types.ObjectId(classId);
    const classroom = await this.classModel
      .findById(classObjectId)
      .select('_id coTeachers teacher')
      .lean();
    if (!classroom) {
      throw new NotFoundException('Lop hoc khong ton tai');
    }
    if (!this.hasClassCoTeacherPermission(classroom, teacherUserId, 'reports')) {
      const primaryTeacherId = objectIdToString((classroom as any)?.teacher);
      if (primaryTeacherId !== teacherUserId) {
        throw new ForbiddenException('Ban khong co quyen nop bao cao cho lop nay');
      }
    }

    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const sessions = await this.sessionModel.find({
      classId: classObjectId,
      scheduledDate: { $gte: dayStart, $lt: dayEnd },
      status: {
        $in: [
          SessionStatus.TEACHER_COMPLETED,
          SessionStatus.PARENT_CONFIRMED,
          SessionStatus.FINALIZED,
        ],
      },
    }).lean();

    if (sessions.length === 0) {
      throw new NotFoundException(
        `Không tìm thấy buổi học nào cho lớp ${classId} ngày ${date} của giáo viên này`,
      );
    }

    const accessibleSessions: any[] = [];
    for (const sess of sessions as any[]) {
      if (await this.canTeacherAccessSession(sess, teacherUserId, 'reports')) {
        accessibleSessions.push(sess);
      }
    }
    if (accessibleSessions.length === 0) {
      throw new ForbiddenException('Ban khong co quyen nop bao cao cho lop nay');
    }

    if (!this.hasQualifiedTeachingReportContent(dto.lessonContent)) {
      throw new BadRequestException('Nội dung báo cáo giảng dạy không hợp lệ');
    }

    // ─── FIX FREEZE: Batch check PayrollTransaction status ─────────────
    const sessionIds = accessibleSessions.map((s) => s._id.toString());
    const lockedSessionIds = new Set<string>();
    for (const sid of sessionIds) {
      const payrollTx = await this.payrollTxService.getBySessionId(sid);
      if (payrollTx && ['APPROVED', 'PAID'].includes(payrollTx.status)) {
        lockedSessionIds.add(sid);
      }
    }

    const now = new Date();
    const results: { sessionId: string; status: string; action: string }[] = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const sess of accessibleSessions) {
      const sessionIdStr = sess._id.toString();

      if (lockedSessionIds.has(sessionIdStr)) {
        results.push({ sessionId: sessionIdStr, status: sess.status, action: 'SKIPPED_LOCKED' });
        skippedCount++;
        continue;
      }

      if ((sess as any).isTeacherPaid) {
        results.push({ sessionId: sessionIdStr, status: sess.status, action: 'SKIPPED_PAID' });
        skippedCount++;
        continue;
      }

      const deadline = calculateTeachingReportDeadline(
        sess.scheduledDate,
        TEACHING_REPORT_DEADLINE_HOURS,
      );
      const lateHours = calculateVietnamLateHours(now, deadline);
      const isLate = lateHours > 0;

      const isUpdate = (sess as any).hasTeachingReport && (sess as any).teachingReport;
      const currentVersion = (sess as any).teachingReport?.version || 0;
      const preparedTeachingReport = await this.prepareTeachingReportPayload(
        sess as any,
        teacherUserId,
        dto,
      );

      await this.sessionModel.findByIdAndUpdate(sess._id, {
        $set: {
          teachingReport: {
            lessonContent: preparedTeachingReport.lessonContent,
            studentAttitude: preparedTeachingReport.studentAttitude,
            recordingUrl: preparedTeachingReport.recordingUrl,
            recordingFileKey: preparedTeachingReport.recordingFileKey,
            teacherComment: preparedTeachingReport.teacherComment,
            homework: preparedTeachingReport.homework,
            additionalNotes: preparedTeachingReport.additionalNotes,
            templateId: preparedTeachingReport.templateId,
            templateTitle: preparedTeachingReport.templateTitle,
            templateVersion: preparedTeachingReport.templateVersion,
            dynamicFieldValues: preparedTeachingReport.dynamicFieldValues,
            dynamicFieldSchemaSnapshot: preparedTeachingReport.dynamicFieldSchemaSnapshot,
            submittedAt: isUpdate ? (sess as any).teachingReport.submittedAt : now,
            deadline,
            isLateSubmission: isUpdate ? (sess as any).teachingReport.isLateSubmission : isLate,
            lateSubmissionHours: isUpdate ? (sess as any).teachingReport.lateSubmissionHours : lateHours,
            version: currentVersion + 1,
            lastUpdatedAt: now,
          },
          hasTeachingReport: true,
        },
      });

      results.push({ sessionId: sess._id.toString(), status: sess.status, action: isUpdate ? 'UPDATED' : 'SUBMITTED' });
      updatedCount++;
    }

    this.logger.log(
      `Bulk teaching report by teacher ${teacherUserId} for class ${classId} on ${date}: updated=${updatedCount}, skipped=${skippedCount}`,
    );

    if (updatedCount > 0) {
      this.triggerStudentSupportSnapshotRefreshForSessions(
        accessibleSessions.filter(
          (session) =>
            !lockedSessionIds.has(session._id.toString()) && !(session as any).isTeacherPaid,
        ),
        'bulkSubmitTeachingReport',
      );
    }

    return { updatedCount, skippedCount, results };
  }

  // ──────────────────────────────────────────────────────────────────
  //  PARENT CONFIRM  (TEACHER_COMPLETED → PARENT_CONFIRMED)
  // ──────────────────────────────────────────────────────────────────

  async parentConfirm(
    sessionId: string,
    parentUserId: string,
    dto: ConfirmSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.TEACHER_COMPLETED) {
      throw new BadRequestException(
        'Chỉ xác nhận được buổi học đã được GV hoàn thành',
      );
    }

    const hasRequiredTeachingReport =
      session.hasTeachingReport
      && !!session.teachingReport?.lessonContent?.trim();
    if (!hasRequiredTeachingReport) {
      throw new BadRequestException(
        'Ch\u1ec9 x\u00e1c nh\u1eadn \u0111\u01b0\u1ee3c khi bu\u1ed5i h\u1ecdc \u0111\u00e3 c\u00f3 b\u00e1o c\u00e1o gi\u1ea3ng d\u1ea1y',
      );
    }

    const ownerParentId = await this.resolveParentUserIdForSession({
      parentUserId: session.parentUserId,
      studentId: session.studentId,
    });
    if (!ownerParentId || ownerParentId !== parentUserId) {
      throw new ForbiddenException('Ban khong phai PH cua hoc sinh nay');
    }
    const resolvedParentRating = dto.parentRating ?? dto.rating;
    const resolvedOverallRating = dto.overallRating ?? dto.rating;

    if (dto.parentNotes) session.parentNotes = dto.parentNotes;
    if (resolvedParentRating !== undefined) session.parentRating = resolvedParentRating;

    const feedback = session.parentFeedback || {} as any;
    if (dto.parentNotes) feedback.parentNotes = dto.parentNotes;
    if (resolvedOverallRating !== undefined) feedback.overallRating = resolvedOverallRating;
    if (dto.teachingQualityRating) feedback.teachingQualityRating = dto.teachingQualityRating;
    if (dto.communicationRating) feedback.communicationRating = dto.communicationRating;
    if (dto.concerns) feedback.concerns = dto.concerns;
    if (dto.isSatisfied !== undefined) feedback.isSatisfied = dto.isSatisfied;
    session.parentFeedback = feedback;

    const shouldHoldSalary =
      dto.isSatisfied === false ||
      (resolvedOverallRating !== undefined && resolvedOverallRating <= 2);

    const nextStatus = shouldHoldSalary ? SessionStatus.PARENT_CONFIRMED : SessionStatus.FINALIZED;

    const updatePayload: any = {
      status: nextStatus,
      parentNotes: dto.parentNotes || session.parentNotes,
      parentRating: resolvedParentRating ?? session.parentRating,
      parentFeedback: session.parentFeedback,
      'confirmation.parentConfirmedAt': new Date(),
    };

    if (!shouldHoldSalary) {
      updatePayload['confirmation.finalizedAt'] = new Date();
    }

    const updated = await this.sessionModel.findOneAndUpdate(
      { _id: sessionId, status: SessionStatus.TEACHER_COMPLETED },
      { $set: updatePayload },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Buổi học đã được chốt bởi hệ thống');
    }

      if (!shouldHoldSalary) {
        await this.sessionSettlementService.settleFinalizedSession(updated);
      }

    if (shouldHoldSalary) {
      try {
        const holdDescription = dto.isSatisfied === false
          ? `Phụ huynh không hài lòng: ${dto.concerns || 'Không có lý do cụ thể'}`
          : `Đánh giá tổng quan thấp: ${dto.overallRating}/5 sao`;

        const ticket = await this.ticketsService.create(
          {
            type: TicketType.PARENT_COMPLAINT,
            priority: TicketPriority.HIGH,
            subject: `[Tự động] Khiếu nại lớp ${(updated.classId as any)?.code || 'N/A'} - Đánh giá kém`,
            description: `Phụ huynh đánh giá thấp buổi học ngày ${updated.scheduledDate.toLocaleDateString('vi-VN')}.\nLý do hệ thống ghi nhận: ${holdDescription}\n\nGhi chú của phụ huynh: ${dto.parentNotes || 'Không có'}\n\nĐề nghị OPS liên hệ phụ huynh để tìm hiểu nguyên nhân, sau đó chốt buổi học hoặc hủy/hoàn tiền.`,
            sessionId: updated._id.toString(),
            classId: updated.classId.toString(),
            studentId: updated.studentId.toString(),
            teacherId: updated.teacherId.toString(),
          },
          parentUserId,
          Role.PARENT,
        );

        await this.payrollTxService.holdSalary(
          updated._id.toString(),
          HoldReason.PARENT_REJECTED,
          holdDescription,
          parentUserId,
          ticket._id.toString(),
        );

        this.logger.warn(
          `Ticket ${ticket.ticketCode} created and PayrollTransaction HELD for session ${sessionId}: ${holdDescription}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to create complaint ticket or hold salary for session ${sessionId}: ${(err as Error).message}`,
        );
      }
    }

    this.triggerStudentSupportSnapshotRefreshForSession(updated, 'parentConfirm');
    return updated;
  }

  // ──────────────────────────────────────────────────────────────────
  //  OPS/DIRECTOR MANUAL FINALIZE
  // ──────────────────────────────────────────────────────────────────

  async manualFinalize(sessionId: string, userId: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    const hasRequiredTeachingReport =
      session.hasTeachingReport
      && !!session.teachingReport?.lessonContent?.trim();
    if (!hasRequiredTeachingReport) {
      throw new BadRequestException(
        'Chỉ xác nhận lương được khi buổi học đã có báo cáo giảng dạy đầy đủ',
      );
    }

    if (session.status === SessionStatus.FINALIZED) {
      if (session.confirmation?.finalizedBy) {
        return session;
      }

      const setPayload: Record<string, any> = {
        'confirmation.finalizedBy': new Types.ObjectId(userId),
      };
      if (!session.confirmation?.finalizedAt) {
        setPayload['confirmation.finalizedAt'] = new Date();
      }

      const confirmed = await this.sessionModel.findOneAndUpdate(
        {
          _id: sessionId,
          status: SessionStatus.FINALIZED,
          $or: [
            { 'confirmation.finalizedBy': { $exists: false } },
            { 'confirmation.finalizedBy': null },
          ],
        },
        { $set: setPayload },
        { new: true },
      );

      if (confirmed) {
        return confirmed;
      }

      const reloaded = await this.sessionModel.findById(sessionId);
      if (!reloaded) throw new NotFoundException('Buổi học không tồn tại');
      return reloaded;
    }

    const allowedStatuses = [
      SessionStatus.TEACHER_COMPLETED,
      SessionStatus.PARENT_CONFIRMED,
    ];
    if (!allowedStatuses.includes(session.status)) {
      throw new BadRequestException(
        `Không thể chốt buổi học ở trạng thái ${session.status}`,
      );
    }

    const updated = await this.sessionModel.findOneAndUpdate(
      {
        _id: sessionId,
        status: { $in: [SessionStatus.TEACHER_COMPLETED, SessionStatus.PARENT_CONFIRMED] },
      },
      {
        $set: {
          status: SessionStatus.FINALIZED,
          'confirmation.finalizedAt': new Date(),
          'confirmation.finalizedBy': new Types.ObjectId(userId),
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new BadRequestException(
        'Buổi học đã được chốt bởi hệ thống hoặc người dùng khác',
      );
    }

      await this.sessionSettlementService.settleFinalizedSession(updated);

    this.triggerStudentSupportSnapshotRefreshForSession(updated, 'manualFinalize');
    return updated;
  }

  // ──────────────────────────────────────────────────────────────────
  //  CANCEL SESSION
  // ──────────────────────────────────────────────────────────────────

  async cancel(
    sessionId: string,
    userId: string,
    userRole: Role,
    dto: CancelSessionDto,
  ): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (
      [SessionStatus.FINALIZED, SessionStatus.CANCELLED, SessionStatus.RESCHEDULED].includes(
        session.status,
      )
    ) {
      throw new BadRequestException(
        `Không thể hủy buổi học ở trạng thái ${session.status}`,
      );
    }

    if (userRole === Role.PARENT && session.status === SessionStatus.TEACHER_COMPLETED) {
      throw new BadRequestException(
        'Giáo viên đã hoàn thành buổi học, phụ huynh không thể hủy. Vui lòng liên hệ OPS.',
      );
    }

    const payrollTx = await this.payrollTxService.getBySessionId(sessionId);
    if (session.isTeacherPaid || payrollTx?.status === PayrollTransactionStatus.PAID) {
      throw new BadRequestException(
        'Buổi học đã khóa sổ lương. Không thể rollback thông thường; cần clawback/adjustment audit riêng.',
      );
    }

    let cancelledByRole: CancelledByRole;
    if (userRole === Role.TEACHER) {
      cancelledByRole = CancelledByRole.TEACHER;
      if (session.teacherId && session.teacherId.toString() !== userId) {
        throw new ForbiddenException('Bạn không phải giáo viên của buổi học này');
      }
    } else if (userRole === Role.PARENT) {
      cancelledByRole = CancelledByRole.PARENT;
      const ownerParentId = await this.resolveParentUserIdForSession({
        parentUserId: session.parentUserId,
        studentId: session.studentId,
      });
      if (!ownerParentId || ownerParentId !== userId) {
        throw new ForbiddenException('Ban khong phai PH cua hoc sinh nay');
      }
    } else {
      cancelledByRole = CancelledByRole.OPS;
    }

    const classroom = await this.classModel.findById(session.classId).lean();
    const policy = classroom?.cancelPolicy;
    const hoursBeforeSession = calcHoursBefore(session.scheduledDate, session.scheduledStartTime);
    const isLate = policy ? hoursBeforeSession < policy.hoursBeforeSession : false;

    const originalAmountCharged = session.amountCharged;
    const refundAmount = originalAmountCharged;

    session.status = SessionStatus.CANCELLED;
    session.amountCharged = 0;
    session.teacherPayout = 0;
    session.cancellation = {
      cancelledBy: cancelledByRole,
      cancelledByUserId: new Types.ObjectId(userId),
      cancelReason: dto.cancelReason,
      cancelledAt: new Date(),
      refundPercent: 100,
      refundAmount,
      isLateCancellation: isLate,
    };

    const saved = await session.save();

    if (refundAmount > 0 && session.parentUserId && session.isPaid) {
      try {
        await this.walletsService.refundForSession({
          parentUserId: session.parentUserId.toString(),
          sessionId: saved._id.toString(),
          classId: session.classId.toString(),
          studentId: session.studentId.toString(),
          refundAmount,
        });
      } catch (err) {
        this.logger.warn(`Refund failed for session ${saved._id}: ${(err as Error).message}`);
      }
    }

    this.triggerStudentSupportSnapshotRefreshForSession(saved, 'cancelSession');
    return saved;
  }

  // ──────────────────────────────────────────────────────────────────
  //  RESCHEDULE (dời lịch)
  // ──────────────────────────────────────────────────────────────────

  async reschedule(
    sessionId: string,
    actor: JwtPayload,
    dto: RescheduleSessionDto,
  ): Promise<{ oldSession: SessionDocument; newSession: SessionDocument }> {
    const oldSession = await this.sessionModel.findById(sessionId);
    if (!oldSession) throw new NotFoundException('Buoi hoc khong ton tai');
    const actorId = actor?.sub ?? actor?._id;
    if (oldSession.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chi doi lich duoc buoi o trang thai SCHEDULED',
      );
    }

    if (actor?.role === Role.TEACHER && oldSession.teacherId.toString() !== actorId) {
      throw new ForbiddenException('Ban khong phai giao vien cua buoi hoc nay');
    }

    const classroom = await this.classModel.findById(oldSession.classId).lean();
    if (classroom?.cancelPolicy && !classroom.cancelPolicy.allowReschedule) {
      throw new BadRequestException('Lớp này không cho phép dời lịch');
    }

    const newSession = await this.sessionsService.create(
      {
        classId: oldSession.classId.toString(),
        studentId: oldSession.studentId.toString(),
        teacherId: oldSession.teacherId.toString(),
        parentUserId: oldSession.parentUserId?.toString(),
        scheduledDate: dto.newScheduledDate,
        scheduledStartTime: dto.newStartTime,
        scheduledEndTime: dto.newEndTime,
        durationMinutes: dto.durationMinutes ?? oldSession.durationMinutes,
        sessionType: (oldSession as any).sessionType,
        amountCharged: oldSession.amountCharged,
        teacherPayout: oldSession.teacherPayout,
        sessionNumber: oldSession.sessionNumber,
      },
      actorId,
      actor,
      { skipSnapshotRefresh: true },
    );

    newSession.rescheduledFromId = oldSession._id as Types.ObjectId;
    await newSession.save();

    const oldSessionId = oldSession._id as Types.ObjectId;
    await this.sessionModel.updateOne(
      { _id: oldSessionId },
      {
        $set: {
          status: SessionStatus.RESCHEDULED,
          rescheduledToId: newSession._id as Types.ObjectId,
        },
      },
    );

    oldSession.status = SessionStatus.RESCHEDULED;
    oldSession.rescheduledToId = newSession._id as Types.ObjectId;

    await this.refreshStudentSupportSnapshotForSession(oldSession, 'rescheduleSession');
    return { oldSession, newSession };
  }

  // ──────────────────────────────────────────────────────────────────
  //  MARK NO-SHOW
  // ──────────────────────────────────────────────────────────────────

  async markNoShow(sessionId: string, actor: JwtPayload): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (session.status !== SessionStatus.SCHEDULED) {
      throw new BadRequestException(
        'Chỉ đánh dấu vắng được buổi SCHEDULED',
      );
    }

    if (actor?.role === Role.TEACHER && session.teacherId.toString() !== actor.sub) {
      throw new ForbiddenException('Ban khong phai giao vien cua buoi hoc nay');
    }
    session.status = SessionStatus.NO_SHOW;
    session.amountCharged = 0;
    session.teacherPayout = 0;
    const saved = await session.save();

    return saved;
  }

  // ──────────────────────────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────

  private async ensureAttendanceForCompletedSession(session: SessionDocument): Promise<void> {
    const attendanceDate = new Date(session.scheduledDate);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    await this.attendanceModel.findOneAndUpdate(
      {
        classId: session.classId,
        studentId: session.studentId,
        date: attendanceDate,
      },
      {
        $set: {
          teacherId: session.teacherId,
          status: AttendanceStatus.PRESENT,
          sessionId: session._id,
          sessionDuration: session.durationMinutes,
          attendedAt: session.confirmation?.teacherCompletedAt || new Date(),
        },
        $setOnInsert: {
          notes: '',
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  private async resolveParentUserIdForSession(session: {
    parentUserId?: any;
    studentId: any;
  }): Promise<string | null> {
    const direct = objectIdToString(session.parentUserId);
    if (direct) return direct;

    const student = await this.studentModel
      .findById(session.studentId)
      .select('parentUserId')
      .lean();
    return objectIdToString((student as any)?.parentUserId);
  }

  private hasClassCoTeacherPermission(
    classroom: any,
    teacherId: string,
    permission: 'attendance' | 'reports' | 'any' = 'any',
  ): boolean {
    const coTeachers = Array.isArray(classroom?.coTeachers) ? classroom.coTeachers : [];
    if (coTeachers.length === 0) {
      return false;
    }

    return coTeachers.some((coTeacher: any) => {
      if (objectIdToString(coTeacher?.teacherId) !== teacherId) {
        return false;
      }

      if (permission === 'attendance') {
        return coTeacher?.canManageAttendance !== false;
      }

      if (permission === 'reports') {
        return coTeacher?.canManageReports !== false;
      }

      return true;
    });
  }

  private async canTeacherAccessSession(
    session: { teacherId?: any; classId?: any },
    teacherUserId: string,
    permission: 'attendance' | 'reports' | 'any',
  ): Promise<boolean> {
    if (objectIdToString(session.teacherId) === teacherUserId) {
      return true;
    }

    const classroomId = objectIdToString(session.classId);
    if (!classroomId) {
      return false;
    }

    const classroom = await this.classModel
      .findById(classroomId)
      .select('_id coTeachers teacher')
      .lean();
    return this.hasClassCoTeacherPermission(classroom, teacherUserId, permission);
  }

  private computeTeacherPayoutFallback(
    session: {
      teacherPayout?: number;
      status?: SessionStatus | string;
      scheduledDate?: Date | string | null;
      durationMinutes?: number | null;
    },
    classroom: any | null,
  ): number {
    const currentTeacherPayout = toSafeNumber(session.teacherPayout, 0);
    if (currentTeacherPayout > 0 || !classroom || shouldKeepZeroTeacherPayout(session)) {
      return currentTeacherPayout;
    }

    const effectiveAt = session.scheduledDate || undefined;
    const classPricing = getClassPricingConfigAt(classroom, effectiveAt);

    if (classroom.classMode === ClassMode.OFFLINE) {
      return roundMoneyDownToThousand(
        toSafeNumber(classPricing.teacherPayPerStudent, 0),
      );
    }

    const durationMinutes =
      toSafeNumber(session.durationMinutes, classPricing.sessionDuration || 60)
      || classPricing.sessionDuration
      || 60;

    const pricing = getClassPricingConfigAt(classroom, effectiveAt);
    const referenceDuration = toSafeNumber(pricing.baseDuration, 60) || 60;
    const teacherPayPerSession = toSafeNumber(pricing.teacherPayPerSession, 0);
    const ratio = durationMinutes / referenceDuration;

    return roundMoneyDownToThousand(teacherPayPerSession * ratio);
  }

  private triggerStudentSupportSnapshotRefreshForSession(
    session: { parentUserId?: any; studentId?: any },
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotForSession(session, reason);
  }

  private triggerStudentSupportSnapshotRefreshForSessions(
    sessions: Array<{ parentUserId?: any; studentId?: any }>,
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotsForSessions(sessions, reason);
  }

  private async refreshStudentSupportSnapshotForSession(
    session: { parentUserId?: any; studentId?: any },
    reason: string,
  ): Promise<void> {
    const studentId = objectIdToString(session.studentId);
    if (!studentId) return;

    const parentUserId = await this.resolveParentUserIdForSession({
      parentUserId: session.parentUserId,
      studentId: session.studentId,
    });
    if (!parentUserId) return;

    try {
      await this.studentSupportSnapshotService.rebuild(parentUserId, studentId);
    } catch (err) {
      this.logger.warn(
        `[StudentSupportSnapshot] Failed to refresh for student ${studentId} (${reason}): ${extractErrorMessage(err)}`,
      );
    }
  }

  private async refreshStudentSupportSnapshotsForSessions(
    sessions: Array<{ parentUserId?: any; studentId?: any }>,
    reason: string,
  ): Promise<void> {
    const resolvedParents = new Map<string, string | null>();
    const refreshedKeys = new Set<string>();

    for (const session of sessions) {
      const studentId = objectIdToString(session.studentId);
      if (!studentId) continue;

      let parentUserId = objectIdToString(session.parentUserId);
      if (!parentUserId) {
        if (resolvedParents.has(studentId)) {
          parentUserId = resolvedParents.get(studentId) || null;
        } else {
          parentUserId = await this.resolveParentUserIdForSession({
            parentUserId: session.parentUserId,
            studentId: session.studentId,
          });
          resolvedParents.set(studentId, parentUserId);
        }
      }

      if (!parentUserId) continue;

      const refreshKey = `${parentUserId}:${studentId}`;
      if (refreshedKeys.has(refreshKey)) continue;
      refreshedKeys.add(refreshKey);

      try {
        await this.studentSupportSnapshotService.rebuild(parentUserId, studentId);
      } catch (err) {
        this.logger.warn(
          `[StudentSupportSnapshot] Failed to refresh for student ${studentId} (${reason}): ${extractErrorMessage(err)}`,
        );
      }
    }
  }
}
