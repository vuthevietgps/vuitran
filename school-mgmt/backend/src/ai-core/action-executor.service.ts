import { BadRequestException, Injectable } from '@nestjs/common';
import { StudentsService } from '../students/students.service';
import { ClassesService } from '../classes/classes.service';
import { LeadsService } from '../leads/leads.service';
import { TicketsService } from '../tickets/tickets.service';
import { AdsService } from '../ads/ads.service';
import { AdGroupStatus } from '../ads/schemas/ad-group.schema';
import { toUtcDateOnlyString } from '../ads/ads.utils';
import { SessionsService } from '../sessions/sessions.service';
import { AttendanceService } from '../attendance/attendance.service';
import { TrialEnrollmentsService } from '../trial-enrollments/trial-enrollments.service';
import { QuizzesService } from '../quizzes/quizzes.service';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  AiActionDiffItem,
  AiActionKey,
  AiActionPreview,
  AiEntityType,
} from './ai-core.types';
import { AiActionPolicyService } from './action-policy.service';

const FIELD_LABELS: Record<string, string> = {
  studentCode: 'Ma hoc vien',
  fullName: 'Ten hoc vien',
  age: 'Tuoi',
  studentBirthMonth: 'Thang sinh hoc vien',
  parentBirthMonth: 'Thang sinh phu huynh',
  parentName: 'Ten phu huynh',
  parentPhone: 'So dien thoai phu huynh',
  parentUserId: 'Tai khoan phu huynh chinh',
  parentUserIds: 'Tai khoan phu huynh lien ket',
  studentUserId: 'Tai khoan hoc vien',
  faceImage: 'Anh hoc vien',
  productPackage: 'Goi san pham',
  level: 'Trinh do',
  studentType: 'Loai hoc vien',
  saleId: 'Sale phu trach',
  saleName: 'Ten sale phu trach',
  parentEmail: 'Email phu huynh',
  studentName: 'Ten hoc sinh',
  studentGrade: 'Khoi lop hoc sinh',
  interestedSubjects: 'Mon quan tam',
  source: 'Nguon lead',
  adGroupId: 'Nhom quang cao',
  adGroupName: 'Ten nhom quang cao',
  referredBy: 'Nguoi gioi thieu',
  referredByUserId: 'Tai khoan gioi thieu',
  estimatedValue: 'Gia tri uoc tinh',
  tags: 'Nhan lead',
  notes: 'Ghi chu',
  status: 'Trang thai',
  nextFollowUp: 'Lich cham soc tiep theo',
  method: 'Phuong thuc lien he',
  type: 'Loai ticket',
  subject: 'Mon hoc / tieu de',
  description: 'Mo ta',
  priority: 'Do uu tien',
  sessionId: 'Buoi hoc',
  sourceConversationId: 'Hoi thoai nguon',
  payrollId: 'Payroll lien quan',
  ledgerEntryId: 'Ledger lien quan',
  attachments: 'File dinh kem',
  substituteTeacherId: 'Giao vien day thay',
  substituteFromDate: 'Ngay bat dau day thay',
  substituteToDate: 'Ngay ket thuc day thay',
  assignedTo: 'Nguoi duoc giao',
  content: 'Noi dung comment',
  isInternal: 'Ghi chu noi bo',
  cancelReason: 'Ly do huy buoi',
  newScheduledDate: 'Ngay hoc moi',
  newStartTime: 'Gio bat dau moi',
  newEndTime: 'Gio ket thuc moi',
  durationMinutes: 'Thoi luong moi',
  date: 'Ngay diem danh',
  assessmentScore: 'Diem danh gia',
  trialSessionsUsed: 'So buoi test da dung',
  experienceTeacherId: 'Giao vien trai nghiem',
  productId: 'San pham',
  testDate: 'Ngay test',
  testStartTime: 'Gio bat dau test',
  testEndTime: 'Gio ket thuc test',
  decisionAt: 'Thoi diem quyet dinh',
  decisionNotes: 'Ghi chu quyet dinh',
  name: 'Ten lop',
  code: 'Ma lop',
  teacherId: 'Giao vien',
  invoiceId: 'Hoa don',
  classMode: 'Che do lop',
  productPackageId: 'Goi san pham',
  coTeachers: 'Dong giao vien',
  studentIds: 'Hoc vien trong lop',
  grade: 'Khoi lop',
  learningGoals: 'Muc tieu hoc tap',
  curriculum: 'Chuong trinh hoc',
  pricePerSession: 'Gia thu moi buoi',
  teacherPayPerSession: 'Luong GV moi buoi',
  teacherPayPerStudent: 'Luong GV moi hoc vien',
  baseDuration: 'Thoi luong co so',
  sessionDuration: 'Thoi luong moi buoi',
  revenuePerStudent: 'Doanh thu moi hoc vien',
  teacherSalaryCost: 'Chi phi luong GV',
  maxStudents: 'Si so toi da',
  requestType: 'Loai yeu cau cap nhat',
  adAccountId: 'Tai khoan quang cao',
  platform: 'Nen tang quang cao',
  platformCampaignId: 'Ma campaign/adset tren nen tang',
  dailyBudget: 'Ngan sach ngay',
  effectiveDate: 'Ngay hieu luc',
  reason: 'Ly do',
  startDate: 'Ngay bat dau',
  endDate: 'Ngay ket thuc',
  targetAudience: 'Tep khach hang',
  trackingKeys: 'Tracking keys',
  score: 'Diem bai tap',
  feedback: 'Nhan xet bai tap',
  manualScore: 'Diem quiz',
  manualFeedback: 'Nhan xet quiz',
};

@Injectable()
export class AiActionExecutorService {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly classesService: ClassesService,
    private readonly leadsService: LeadsService,
    private readonly ticketsService: TicketsService,
    private readonly adsService: AdsService,
    private readonly policyService: AiActionPolicyService,
    private readonly sessionsService?: SessionsService,
    private readonly attendanceService?: AttendanceService,
    private readonly trialEnrollmentsService?: TrialEnrollmentsService,
    private readonly quizzesService?: QuizzesService,
  ) {}

  async buildPreview(input: {
    actionKey: AiActionKey;
    entityId?: string;
    payload: Record<string, unknown>;
    user: JwtPayload;
  }): Promise<AiActionPreview> {
    this.policyService.assertEntityTarget(input.actionKey, input.entityId);
    let payload = this.policyService.sanitizeAndValidatePayload(input.actionKey, input.payload, input.user);
    if (input.actionKey === AiActionKey.CREATE_AD_GROUP_DRAFT) {
      payload = this.withAdGroupDraftDefaults(payload);
    }
    const meta = this.policyService.buildActionMeta(input.actionKey);
    const before = await this.loadBefore(input.actionKey, input.entityId, input.user);
    const diff = this.buildDiff(input.actionKey, before, payload);

    if (!diff.length) {
      throw new BadRequestException('Khong co thay doi nao de tao nhap');
    }

    return {
      actionKey: input.actionKey,
      entityType: meta.entityType,
      entityId: input.entityId,
      payload,
      before,
      diff,
      riskLevel: meta.riskLevel,
      requiresConfirmation: meta.requiresConfirmation,
      requiresApproval: meta.requiresApproval,
      warnings: this.buildWarnings(input.actionKey, payload, input.user),
    };
  }

  async execute(preview: Pick<AiActionPreview, 'actionKey' | 'entityId' | 'payload'>, user: JwtPayload) {
    this.policyService.assertCanDraft(preview.actionKey, user);

    switch (preview.actionKey) {
      case AiActionKey.CREATE_STUDENT:
        return this.studentsService.create({ ...preview.payload }, user);
      case AiActionKey.UPDATE_STUDENT:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId hoc vien');
        return this.studentsService.update(preview.entityId, { ...preview.payload }, user);
      case AiActionKey.CREATE_CLASS:
        return this.classesService.create({ ...preview.payload } as any, user);
      case AiActionKey.UPDATE_CLASS:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId lop hoc');
        return this.classesService.update(preview.entityId, { ...preview.payload } as any, user);
      case AiActionKey.CREATE_LEAD:
        return this.leadsService.create({ ...preview.payload } as any, user);
      case AiActionKey.UPDATE_LEAD:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId lead');
        return this.leadsService.update(preview.entityId, { ...preview.payload } as any, user);
      case AiActionKey.ADD_LEAD_CONTACT:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId lead');
        return this.leadsService.addContact(preview.entityId, { ...preview.payload } as any, user);
      case AiActionKey.CREATE_TICKET:
        return this.ticketsService.create({ ...preview.payload } as any, user.sub, user.role);
      case AiActionKey.UPDATE_TICKET:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId ticket');
        return this.ticketsService.update(preview.entityId, { ...preview.payload } as any);
      case AiActionKey.ADD_TICKET_COMMENT:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId ticket');
        return this.ticketsService.addComment(preview.entityId, user.sub, { ...preview.payload } as any, user);
      case AiActionKey.FINALIZE_SESSION:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId buoi hoc');
        if (!this.sessionsService) throw new BadRequestException('Session service chua san sang');
        return this.sessionsService.manualFinalize(preview.entityId, user.sub);
      case AiActionKey.CANCEL_SESSION:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId buoi hoc');
        if (!this.sessionsService) throw new BadRequestException('Session service chua san sang');
        return this.sessionsService.cancel(preview.entityId, user.sub, user.role, {
          cancelReason: String(preview.payload.cancelReason || ''),
        });
      case AiActionKey.RESCHEDULE_SESSION:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId buoi hoc');
        if (!this.sessionsService) throw new BadRequestException('Session service chua san sang');
        return this.sessionsService.reschedule(preview.entityId, user, {
          newScheduledDate: String(preview.payload.newScheduledDate || ''),
          newStartTime: preview.payload.newStartTime ? String(preview.payload.newStartTime) : undefined,
          newEndTime: preview.payload.newEndTime ? String(preview.payload.newEndTime) : undefined,
          durationMinutes: preview.payload.durationMinutes !== undefined ? Number(preview.payload.durationMinutes) : undefined,
          reason: preview.payload.reason ? String(preview.payload.reason) : undefined,
        });
      case AiActionKey.MARK_SESSION_NO_SHOW:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId buoi hoc');
        if (!this.sessionsService) throw new BadRequestException('Session service chua san sang');
        return this.sessionsService.markNoShow(preview.entityId, user);
      case AiActionKey.MARK_ATTENDANCE:
        if (!this.attendanceService) throw new BadRequestException('Attendance service chua san sang');
        return this.attendanceService.markAttendance({
          classId: String(preview.payload.classId || ''),
          studentId: String(preview.payload.studentId || ''),
          date: String(preview.payload.date || ''),
          status: preview.payload.status as any,
          notes: preview.payload.notes ? String(preview.payload.notes) : undefined,
        }, user);
      case AiActionKey.UPDATE_TRIAL_ENROLLMENT:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId hoc thu/test');
        if (!this.trialEnrollmentsService) throw new BadRequestException('Trial enrollment service chua san sang');
        return this.trialEnrollmentsService.update(preview.entityId, { ...preview.payload } as any, user);
      case AiActionKey.ADJUST_AD_BUDGET:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId nhom quang cao');
        return this.adsService.updateGroup(preview.entityId, {
          dailyBudget: Number(preview.payload.dailyBudget),
        });
      case AiActionKey.PAUSE_AD_GROUP:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId nhom quang cao');
        return this.adsService.updateGroup(preview.entityId, {
          status: AdGroupStatus.PAUSED,
        });
      case AiActionKey.RESUME_AD_GROUP:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId nhom quang cao');
        return this.adsService.updateGroup(preview.entityId, {
          status: AdGroupStatus.ACTIVE,
        });
      case AiActionKey.CREATE_AD_GROUP_DRAFT:
        return this.adsService.createGroup({
          ...this.withAdGroupDraftDefaults(preview.payload),
          status: AdGroupStatus.PAUSED,
        } as any, user);
      case AiActionKey.SYNC_AD_COSTS:
        return this.syncAdCostsFromAction(preview.payload);
      case AiActionKey.GRADE_HOMEWORK:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId bai tap/session');
        if (!this.sessionsService) throw new BadRequestException('Session service chua san sang');
        return this.sessionsService.gradeHomework(preview.entityId, user, {
          score: Number(preview.payload.score),
          feedback: String(preview.payload.feedback || ''),
        });
      case AiActionKey.GRADE_QUIZ_ATTEMPT:
        if (!preview.entityId) throw new BadRequestException('Thieu entityId quiz attempt');
        if (!this.quizzesService) throw new BadRequestException('Quiz service chua san sang');
        return this.quizzesService.gradeAttempt(preview.entityId, {
          manualScore: Number(preview.payload.manualScore),
          manualFeedback: String(preview.payload.manualFeedback || ''),
        }, user);
      default:
        throw new BadRequestException('Action AI chua duoc ho tro');
    }
  }

  private async loadBefore(actionKey: AiActionKey, entityId: string | undefined, user: JwtPayload) {
    if (actionKey === AiActionKey.UPDATE_STUDENT) {
      return this.toPlain(await this.studentsService.findOne(entityId!, user));
    }
    if (actionKey === AiActionKey.UPDATE_CLASS) {
      return this.toPlain(await this.classesService.findOne(entityId!, user));
    }
    if (actionKey === AiActionKey.UPDATE_LEAD || actionKey === AiActionKey.ADD_LEAD_CONTACT) {
      return this.toPlain(await this.leadsService.findOne(entityId!, user));
    }
    if (actionKey === AiActionKey.UPDATE_TICKET || actionKey === AiActionKey.ADD_TICKET_COMMENT) {
      return this.toPlain(await this.ticketsService.findById(entityId!, user));
    }
    if ([
      AiActionKey.FINALIZE_SESSION,
      AiActionKey.CANCEL_SESSION,
      AiActionKey.RESCHEDULE_SESSION,
      AiActionKey.MARK_SESSION_NO_SHOW,
    ].includes(actionKey)) {
      if (!this.sessionsService) return undefined;
      return this.toPlain(await this.sessionsService.findById(entityId!, user));
    }
    if (actionKey === AiActionKey.UPDATE_TRIAL_ENROLLMENT) {
      if (!this.trialEnrollmentsService) return undefined;
      return this.toPlain(await this.trialEnrollmentsService.findOne(entityId!, user));
    }
    if (actionKey === AiActionKey.GRADE_HOMEWORK) {
      if (!this.sessionsService) return undefined;
      return this.toPlain(await this.sessionsService.getHomeworkForGradingDetail(entityId!, user));
    }
    if (actionKey === AiActionKey.GRADE_QUIZ_ATTEMPT) {
      if (!this.quizzesService) return undefined;
      return this.toPlain(await this.quizzesService.findAttemptForGrading(entityId!, user));
    }
    if ([
      AiActionKey.ADJUST_AD_BUDGET,
      AiActionKey.PAUSE_AD_GROUP,
      AiActionKey.RESUME_AD_GROUP,
    ].includes(actionKey)) {
      return this.toPlain(await this.adsService.findOneGroup(entityId!));
    }
    return undefined;
  }

  private buildDiff(actionKey: AiActionKey, before: Record<string, unknown> | undefined, payload: Record<string, unknown>) {
    return Object.entries(payload)
      .map(([field, after]) => {
        const beforeValue = before ? this.readBeforeValue(actionKey, before, field) : undefined;
        return {
          field,
          label: FIELD_LABELS[field] || field,
          before: beforeValue,
          after,
        };
      })
      .filter((item) => !this.areEquivalent(item.before, item.after));
  }

  private readBeforeValue(actionKey: AiActionKey, before: Record<string, unknown>, field: string): unknown {
    if (actionKey === AiActionKey.UPDATE_CLASS) {
      if (field === 'teacherId') return this.readObjectIdLike(before.teacher);
      if (field === 'saleId') return this.readObjectIdLike(before.sale);
      if (field === 'invoiceId') return this.readObjectIdLike(before.invoiceId);
      if (field === 'productPackageId') return this.readObjectIdLike(before.productPackage);
      if (field === 'studentIds') return this.toIdArray(before.students);
    }

    if (actionKey === AiActionKey.UPDATE_STUDENT && field === 'productPackage') {
      return this.readObjectIdLike(before.productPackage);
    }

    if (actionKey === AiActionKey.RESCHEDULE_SESSION) {
      if (field === 'newScheduledDate') return this.formatDateOnly(before.scheduledDate);
      if (field === 'newStartTime') return before.scheduledStartTime;
      if (field === 'newEndTime') return before.scheduledEndTime;
      if (field === 'durationMinutes') return before.durationMinutes;
    }

    if (actionKey === AiActionKey.CANCEL_SESSION && field === 'cancelReason') {
      return (before.cancellation as any)?.cancelReason;
    }

    if (actionKey === AiActionKey.UPDATE_TRIAL_ENROLLMENT) {
      if (field === 'classId') return this.readObjectIdLike(before.classId);
      if (field === 'productId') return this.readObjectIdLike(before.productId);
      if (field === 'experienceTeacherId') return this.readObjectIdLike(before.experienceTeacherId);
      if (field === 'studentId') return this.readObjectIdLike(before.studentId);
      if (field === 'orderId') return this.readObjectIdLike(before.orderId);
      if (field === 'invoiceId') return this.readObjectIdLike(before.invoiceId);
      if (field === 'testDate' || field === 'decisionAt') return this.formatDateOnly(before[field]);
    }

    if (actionKey === AiActionKey.GRADE_HOMEWORK) {
      const evaluation = before.evaluation as Record<string, unknown> | undefined;
      if (field === 'score') return evaluation?.homeworkScore;
      if (field === 'feedback') return evaluation?.homeworkFeedback;
    }

    return before[field];
  }

  private buildWarnings(actionKey: AiActionKey, payload: Record<string, unknown>, user: JwtPayload): string[] {
    const warnings: string[] = [];
    if ([AiActionKey.CREATE_CLASS, AiActionKey.UPDATE_CLASS].includes(actionKey)) {
      if (
        payload.pricePerSession !== undefined
        || payload.teacherPayPerSession !== undefined
        || payload.teacherPayPerStudent !== undefined
        || payload.baseDuration !== undefined
        || payload.sessionDuration !== undefined
      ) {
        warnings.push('Co thay doi lien quan hoc phi/luong/thoi luong; can doc preview ky truoc khi xac nhan.');
      }
    }
    if (user.role === 'SALE' && actionKey === AiActionKey.UPDATE_CLASS) {
      warnings.push('Neu thay doi thuoc dien can duyet, service lop hoc se tao yeu cau cho Ops/Director thay vi cap nhat truc tiep.');
    }
    if (actionKey === AiActionKey.CREATE_TICKET && payload.type === 'REFUND_REQUEST') {
      warnings.push('Ticket hoan tien chi la yeu cau ho tro; viec hoan tien can workflow rieng va quyen phu hop.');
    }
    if ([
      AiActionKey.FINALIZE_SESSION,
      AiActionKey.CANCEL_SESSION,
      AiActionKey.RESCHEDULE_SESSION,
      AiActionKey.MARK_SESSION_NO_SHOW,
    ].includes(actionKey)) {
      warnings.push('Thao tac buoi hoc co the anh huong so buoi, vi phu huynh, payroll giao vien va SLA; can doi chieu report/attendance truoc khi xac nhan.');
    }
    if (actionKey === AiActionKey.MARK_ATTENDANCE) {
      warnings.push('Diem danh co the tao/cap nhat lien ket buoi hoc va anh huong tinh so buoi; can doi chieu lop, hoc sinh va ngay truoc khi xac nhan.');
    }
    if (actionKey === AiActionKey.UPDATE_TRIAL_ENROLLMENT) {
      warnings.push('Cap nhat hoc thu/test co the anh huong lich test, ho so hoc vien, order/invoice va quyet dinh convert/reject.');
    }
    if ([
      AiActionKey.ADJUST_AD_BUDGET,
      AiActionKey.PAUSE_AD_GROUP,
      AiActionKey.RESUME_AD_GROUP,
      AiActionKey.CREATE_AD_GROUP_DRAFT,
      AiActionKey.SYNC_AD_COSTS,
    ].includes(actionKey)) {
      warnings.push('Day la thao tac ads rui ro cao; he thong chi cap nhat ERP/sync theo API noi bo va can xac nhan truoc khi thuc thi.');
    }
    if (actionKey === AiActionKey.ADD_TICKET_COMMENT && payload.isInternal) {
      warnings.push('Comment noi bo chi hien thi cho nhan su noi bo co quyen.');
    }
    if ([AiActionKey.GRADE_HOMEWORK, AiActionKey.GRADE_QUIZ_ATTEMPT].includes(actionKey)) {
      warnings.push('Can doi chieu bai nop, rubric/hoc lieu lien quan va chi xac nhan khi feedback phu hop voi bang chung.');
    }
    return warnings;
  }

  private async syncAdCostsFromAction(payload: Record<string, unknown>) {
    const adAccountId = String(payload.adAccountId || '');
    const lookbackDays = payload.lookbackDays ? Number(payload.lookbackDays) : 1;
    const baseDate = new Date(String(payload.date));
    let synced = 0;
    const results: Array<{ date: string; synced: number }> = [];

    for (let offset = 0; offset < lookbackDays; offset += 1) {
      const syncDate = new Date(baseDate);
      syncDate.setUTCDate(baseDate.getUTCDate() - offset);
      const dateStr = toUtcDateOnlyString(syncDate);
      const count = await this.adsService.syncAccountCosts(adAccountId, dateStr);
      synced += count;
      results.push({ date: dateStr, synced: count });
    }

    return {
      ok: true,
      adAccountId,
      synced,
      results,
    };
  }

  private withAdGroupDraftDefaults(payload: Record<string, unknown>): Record<string, unknown> {
    const output = { ...payload };
    const name = String(output.name || 'ad-group-draft');
    const platform = String(output.platform || 'ADS');
    const suffix = this.buildDraftSuffix(name);

    if (!output.platformCampaignId) {
      output.platformCampaignId = `DRAFT-${platform}-${suffix}`;
    }

    if (!Array.isArray(output.trackingKeys) || !output.trackingKeys.length) {
      output.trackingKeys = [`draft-${platform.toLowerCase()}-${suffix.toLowerCase()}`];
    }

    const baseNote = 'AI draft only. Replace platformCampaignId after publishing/syncing the real platform campaign or ad set.';
    const currentNotes = String(output.notes || '').trim();
    output.notes = currentNotes.includes(baseNote)
      ? currentNotes
      : currentNotes ? `${currentNotes}\n${baseNote}` : baseNote;
    return output;
  }

  private buildDraftSuffix(value: string) {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'draft';
    return `${slug}-${Date.now().toString(36)}`;
  }

  private toPlain(value: any): Record<string, unknown> {
    if (!value) return {};
    if (typeof value.toObject === 'function') return value.toObject();
    return JSON.parse(JSON.stringify(value));
  }

  private readObjectIdLike(value: unknown): unknown {
    if (!value) return value;
    if (typeof value === 'string') return value;
    if (typeof (value as any).toHexString === 'function') return (value as any).toHexString();
    if (typeof (value as any).toString === 'function' && (value as any)._bsontype === 'ObjectId') {
      return (value as any).toString();
    }
    if (typeof value === 'object') {
      const objectValue = value as Record<string, any>;
      if (objectValue._id) return this.readObjectIdLike(objectValue._id);
      if (objectValue.id) return objectValue.id;
    }
    return value;
  }

  private formatDateOnly(value: unknown): unknown {
    if (!value) return value;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString().slice(0, 10);
  }

  private toIdArray(value: unknown): unknown[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => this.readObjectIdLike(item));
  }

  private areEquivalent(left: unknown, right: unknown): boolean {
    return JSON.stringify(this.normalizeForCompare(left)) === JSON.stringify(this.normalizeForCompare(right));
  }

  private normalizeForCompare(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeForCompare(item)).sort();
    }
    if (value && typeof value === 'object') {
      return this.readObjectIdLike(value);
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  }
}
