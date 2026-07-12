import { Injectable } from '@nestjs/common';
import {
  AiActionKey,
  AiEntityResolution,
  AiEntityType,
} from './ai-core.types';
import { PreviewAiActionDto } from './dto/ai-action.dto';
import { AiActionFieldSchema, AiActionPolicyService } from './action-policy.service';

export type AiActionMissingFieldsDecision = {
  type: 'MISSING_FIELDS';
  actionKey: AiActionKey;
  entityType: AiEntityType;
  providedPayload: Record<string, unknown>;
  missingRequiredFields: string[];
  schema: AiActionFieldSchema;
  sourceMessage: string;
};

export type AiActionChatDecision =
  | { type: 'CONFIRM'; draftId?: string }
  | { type: 'REJECT'; draftId?: string }
  | { type: 'PREVIEW'; draft: PreviewAiActionDto }
  | AiActionMissingFieldsDecision
  | { type: 'NONE' };

const FIELD_LABELS: Record<string, string> = {
  studentCode: 'Ma hoc sinh',
  fullName: 'Ho ten hoc sinh',
  age: 'Tuoi hoc sinh',
  studentBirthMonth: 'Thang sinh hoc sinh',
  parentBirthMonth: 'Thang sinh phu huynh',
  parentName: 'Ten phu huynh',
  parentPhone: 'So dien thoai phu huynh',
  parentUserId: 'Tai khoan phu huynh chinh',
  parentUserIds: 'Tai khoan phu huynh lien ket',
  studentUserId: 'Tai khoan hoc sinh',
  faceImage: 'Anh khuon mat hoc sinh',
  productPackage: 'Goi san pham',
  level: 'Trinh do',
  studentType: 'Loai hoc sinh',
  saleId: 'Sale phu trach',
  saleName: 'Ten sale phu trach',
  name: 'Ten lop',
  code: 'Ma lop',
  teacherId: 'Giao vien',
  invoiceId: 'Hoa don',
  classMode: 'Hinh thuc lop',
  productPackageId: 'Goi san pham',
  coTeachers: 'Dong giao vien',
  studentIds: 'Danh sach hoc sinh',
  subject: 'Tieu de/mon hoc',
  grade: 'Khoi/lop',
  learningGoals: 'Muc tieu hoc tap',
  curriculum: 'Chuong trinh hoc',
  pricePerSession: 'Hoc phi moi buoi',
  teacherPayPerSession: 'Luong GV moi buoi',
  teacherPayPerStudent: 'Luong GV moi hoc sinh',
  baseDuration: 'Thoi luong co so',
  sessionDuration: 'Thoi luong moi buoi',
  revenuePerStudent: 'Doanh thu moi hoc sinh',
  teacherSalaryCost: 'Chi phi luong giao vien',
  maxStudents: 'Si so toi da',
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
  tags: 'Nhan',
  notes: 'Ghi chu',
  tracking: 'Tracking marketing',
  type: 'Loai ticket',
  description: 'Mo ta',
  priority: 'Do uu tien',
  sessionId: 'Buoi hoc lien quan',
  classId: 'Lop lien quan',
  studentId: 'Hoc sinh lien quan',
  parentId: 'Phu huynh lien quan',
  sourceConversationId: 'Hoi thoai nguon',
  payrollId: 'Bang luong lien quan',
  ledgerEntryId: 'Giao dich lien quan',
  attachments: 'File dinh kem',
  assignedTo: 'Nguoi phu trach',
  content: 'Noi dung binh luan',
  isInternal: 'Binh luan noi bo',
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
  substituteTeacherId: 'Giao vien day thay',
  substituteFromDate: 'Ngay bat dau day thay',
  substituteToDate: 'Ngay ket thuc day thay',
  adAccountId: 'Tai khoan quang cao',
  platform: 'Nen tang quang cao',
  platformCampaignId: 'Ma campaign/adset tren nen tang',
  dailyBudget: 'Ngan sach ngay',
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
export class AiActionPlannerService {
  constructor(private readonly policy: AiActionPolicyService) {}

  planFromChat(message: string, entityResolution?: AiEntityResolution): AiActionChatDecision {
    const confirmation = this.parseConfirmation(message);
    if (confirmation) return confirmation;

    const entityAction = this.planUpdateFromChat(message, entityResolution);
    if (entityAction.type !== 'NONE') return entityAction;

    const standaloneAction = this.planStandaloneOpsActionFromChat(message);
    if (standaloneAction.type !== 'NONE') return standaloneAction;

    const createAction = this.planCreateFromChat(message);
    if (createAction.type !== 'NONE') return createAction;

    return { type: 'NONE' };
  }

  formatMissingFieldsAnswer(decision: AiActionMissingFieldsDecision) {
    const requiredLines = decision.schema.requiredFields
      .map((field) => `- ${field}: ${this.label(field)}`);
    const optionalLines = decision.schema.optionalFields
      .slice(0, 12)
      .map((field) => `- ${field}: ${this.label(field)}`);
    const providedLines = Object.entries(decision.providedPayload)
      .map(([field, value]) => `- ${field}: ${this.formatValue(value)}`);

    return [
      `Toi chua tao nhap ${decision.actionKey} vi con thieu du lieu bat buoc.`,
      'Cac truong bat buoc can cung cap:',
      ...requiredLines,
      optionalLines.length ? 'Cac truong tuy chon co the cung cap them:' : undefined,
      ...optionalLines,
      providedLines.length ? 'Du lieu toi da doc duoc tu yeu cau hien tai:' : undefined,
      ...providedLines,
      'Hay gui lai theo mau: field=value, moi dong mot truong. Khi du truong, toi se tong hop thanh ban nhap de anh/chi xac nhan truoc khi tao.',
    ].filter(Boolean).join('\n');
  }

  private planCreateFromChat(message: string): AiActionChatDecision {
    const normalized = this.normalizeText(message);
    if (this.hasTicketCommentIntent(normalized) && /\b(ticket|yeu cau ho tro)\b/.test(normalized)) {
      return { type: 'NONE' };
    }

    if (!/\b(tao|them|lap|mo)\b/.test(normalized)) {
      return { type: 'NONE' };
    }

    const target = this.detectCreateTarget(normalized);
    if (!target) return { type: 'NONE' };

    const payload = this.extractCreatePayload(target.actionKey, message);
    const schema = this.policy.getFieldSchema(target.actionKey);
    const missingRequiredFields = schema.requiredFields
      .filter((field) => this.isMissing(payload[field]));

    if (missingRequiredFields.length) {
      return {
        type: 'MISSING_FIELDS',
        actionKey: target.actionKey,
        entityType: target.entityType,
        providedPayload: payload,
        missingRequiredFields,
        schema,
        sourceMessage: message,
      };
    }

    return {
      type: 'PREVIEW',
      draft: {
        actionKey: target.actionKey,
        entityType: target.entityType,
        payload,
        sourceMessage: message,
      },
    };
  }

  private planUpdateFromChat(
    message: string,
    entityResolution?: AiEntityResolution,
  ): AiActionChatDecision {
    const normalized = this.normalizeText(message);
    const selected = entityResolution?.selected;
    if (!selected || entityResolution.status !== 'RESOLVED') {
      return { type: 'NONE' };
    }

    if (selected.type === AiEntityType.TICKET) {
      const commentPayload = this.extractTicketCommentPayload(message);
      if (this.hasTicketCommentIntent(normalized) && Object.keys(commentPayload).length) {
        return {
          type: 'PREVIEW',
          draft: {
            actionKey: AiActionKey.ADD_TICKET_COMMENT,
            entityType: AiEntityType.TICKET,
            entityId: selected.id,
            payload: commentPayload,
            sourceMessage: message,
          },
        };
      }
    }

    const gradingAction = this.planGradingFromChat(message, selected);
    if (gradingAction.type !== 'NONE') return gradingAction;

    if (selected.type === AiEntityType.SESSION) {
      const sessionAction = this.planSessionActionFromChat(message, selected.id);
      if (sessionAction.type !== 'NONE') return sessionAction;
    }

    if (selected.type === AiEntityType.TRIAL_ENROLLMENT) {
      const trialAction = this.planTrialUpdateFromChat(message, selected.id);
      if (trialAction.type !== 'NONE') return trialAction;
    }

    if (!/\b(sua|cap nhat|doi|thay|chinh|dat|gan|giao|assign)\b/.test(normalized)) {
      return { type: 'NONE' };
    }

    if (selected.type === AiEntityType.STUDENT) {
      const payload = this.extractStudentUpdatePayload(message);
      if (Object.keys(payload).length) {
        return {
          type: 'PREVIEW',
          draft: {
            actionKey: AiActionKey.UPDATE_STUDENT,
            entityType: AiEntityType.STUDENT,
            entityId: selected.id,
            payload,
            sourceMessage: message,
          },
        };
      }
    }

    if (selected.type === AiEntityType.CLASS) {
      const payload = this.extractClassUpdatePayload(message);
      if (Object.keys(payload).length) {
        return {
          type: 'PREVIEW',
          draft: {
            actionKey: AiActionKey.UPDATE_CLASS,
            entityType: AiEntityType.CLASS,
            entityId: selected.id,
            payload,
            sourceMessage: message,
          },
        };
      }
    }

    if (selected.type === AiEntityType.TICKET) {
      const payload = this.extractTicketUpdatePayload(message);
      if (Object.keys(payload).length) {
        return {
          type: 'PREVIEW',
          draft: {
            actionKey: AiActionKey.UPDATE_TICKET,
            entityType: AiEntityType.TICKET,
            entityId: selected.id,
            payload,
            sourceMessage: message,
          },
        };
      }
    }

    return { type: 'NONE' };
  }

  private planGradingFromChat(
    message: string,
    selected: NonNullable<AiEntityResolution['selected']>,
  ): AiActionChatDecision {
    const normalized = this.normalizeText(message);
    if (!/\b(cham|cho|cho diem|diem|grade|score|feedback|nhan xet)\b/.test(normalized)) {
      return { type: 'NONE' };
    }

    if (selected.type === AiEntityType.SESSION) {
      const payload = this.extractHomeworkGradePayload(message);
      if (!Object.keys(payload).length) return { type: 'NONE' };
      return this.previewOrMissingRequiredFields(
        AiActionKey.GRADE_HOMEWORK,
        AiEntityType.SESSION,
        selected.id,
        payload,
        message,
      );
    }

    if (selected.type === AiEntityType.QUIZ_ATTEMPT) {
      const payload = this.extractQuizGradePayload(message);
      if (!Object.keys(payload).length) return { type: 'NONE' };
      return this.previewOrMissingRequiredFields(
        AiActionKey.GRADE_QUIZ_ATTEMPT,
        AiEntityType.QUIZ_ATTEMPT,
        selected.id,
        payload,
        message,
      );
    }

    return { type: 'NONE' };
  }

  private planSessionActionFromChat(message: string, entityId: string): AiActionChatDecision {
    const normalized = this.normalizeText(message);
    if (/\b(finalize|chot|chot buoi|xac nhan chot|hoan tat buoi)\b/.test(normalized)) {
      return this.previewOrMissingRequiredFields(
        AiActionKey.FINALIZE_SESSION,
        AiEntityType.SESSION,
        entityId,
        { reason: this.extractReason(message) || 'Yeu cau chot buoi tu tro ly AI' },
        message,
      );
    }

    if (/\b(huy buoi|huy lich|cancel session|cancel buoi|cancel)\b/.test(normalized)) {
      return this.previewOrMissingRequiredFields(
        AiActionKey.CANCEL_SESSION,
        AiEntityType.SESSION,
        entityId,
        this.extractSessionCancelPayload(message),
        message,
      );
    }

    if (/\b(doi lich|doi buoi|doi sang|reschedule|chuyen lich)\b/.test(normalized)) {
      return this.previewOrMissingRequiredFields(
        AiActionKey.RESCHEDULE_SESSION,
        AiEntityType.SESSION,
        entityId,
        this.extractSessionReschedulePayload(message),
        message,
      );
    }

    if (/\b(no show|noshow|bao no show|vang khong phep|khong day|khong hoc)\b/.test(normalized)) {
      return this.previewOrMissingRequiredFields(
        AiActionKey.MARK_SESSION_NO_SHOW,
        AiEntityType.SESSION,
        entityId,
        { reason: this.extractReason(message) || 'Yeu cau danh dau no-show tu tro ly AI' },
        message,
      );
    }

    return { type: 'NONE' };
  }

  private planTrialUpdateFromChat(message: string, entityId: string): AiActionChatDecision {
    const normalized = this.normalizeText(message);
    if (!/\b(hoc thu|trial|test|cap nhat|chot|convert|reject|tu choi|lich test|giao vien trai nghiem)\b/.test(normalized)) {
      return { type: 'NONE' };
    }

    const explicit = this.extractExplicitFieldAssignments(message);
    const payload: Record<string, unknown> = {
      status: explicit.status || this.extractTrialStatus(message),
      classId: explicit.classId,
      productId: explicit.productId,
      experienceTeacherId: explicit.experienceTeacherId,
      testDate: explicit.testDate || this.extractDateAfterMarker(message, ['testDate', 'ngay test', 'lich test']),
      testStartTime: explicit.testStartTime || this.extractTimeAfterMarker(message, ['testStartTime', 'gio bat dau test', 'bat dau test']),
      testEndTime: explicit.testEndTime || this.extractTimeAfterMarker(message, ['testEndTime', 'gio ket thuc test', 'ket thuc test']),
      assessmentScore: explicit.assessmentScore,
      trialSessionsUsed: explicit.trialSessionsUsed,
      studentId: explicit.studentId,
      orderId: explicit.orderId,
      invoiceId: explicit.invoiceId,
      decisionAt: explicit.decisionAt || this.extractDateAfterMarker(message, ['decisionAt', 'ngay quyet dinh', 'ngay chot']),
      notes: explicit.notes || this.extractTextAfterMarker(message, ['ghi chu', 'notes', 'note']),
      decisionNotes: explicit.decisionNotes || this.extractTextAfterMarker(message, ['decisionNotes', 'ghi chu quyet dinh']),
    };

    return this.previewOrMissingRequiredFields(
      AiActionKey.UPDATE_TRIAL_ENROLLMENT,
      AiEntityType.TRIAL_ENROLLMENT,
      entityId,
      payload,
      message,
    );
  }

  private planStandaloneOpsActionFromChat(message: string): AiActionChatDecision {
    const normalized = this.normalizeText(message);
    if (!/\b(diem danh|attendance|mark attendance|ghi nhan vang|ghi nhan co mat)\b/.test(normalized)) {
      return { type: 'NONE' };
    }

    const status = this.extractAttendanceStatus(message);
    if (!status) {
      return { type: 'NONE' };
    }

    const explicit = this.extractExplicitFieldAssignments(message);
    const payload: Record<string, unknown> = {
      classId: explicit.classId,
      studentId: explicit.studentId,
      date: explicit.date || this.extractDateAfterMarker(message, ['date', 'ngay']),
      status: explicit.status || status,
      notes: explicit.notes || this.extractTextAfterMarker(message, ['ghi chu', 'notes', 'note']),
    };

    return this.previewOrMissingRequiredFields(
      AiActionKey.MARK_ATTENDANCE,
      AiEntityType.ATTENDANCE,
      undefined,
      payload,
      message,
    );
  }

  private previewOrMissingRequiredFields(
    actionKey: AiActionKey,
    entityType: AiEntityType,
    entityId: string | undefined,
    payload: Record<string, unknown>,
    message: string,
  ): AiActionChatDecision {
    const schema = this.policy.getFieldSchema(actionKey);
    const allowed = new Set(schema.allowedFields);
    const cleanedPayload = this.removeEmptyValues(Object.fromEntries(
      Object.entries(payload || {}).filter(([field]) => allowed.has(field)),
    ));
    const missingRequiredFields = schema.requiredFields
      .filter((field) => this.isMissing(cleanedPayload[field]));

    if (missingRequiredFields.length) {
      return {
        type: 'MISSING_FIELDS',
        actionKey,
        entityType,
        providedPayload: cleanedPayload,
        missingRequiredFields,
        schema,
        sourceMessage: message,
      };
    }

    if (!Object.keys(cleanedPayload).length) {
      return { type: 'NONE' };
    }

    return {
      type: 'PREVIEW',
      draft: {
        actionKey,
        entityType,
        entityId,
        payload: cleanedPayload,
        sourceMessage: message,
      },
    };
  }

  private detectCreateTarget(normalized: string): { actionKey: AiActionKey; entityType: AiEntityType } | null {
    if (/\b(hoc sinh|hoc vien|student)\b/.test(normalized)) {
      return { actionKey: AiActionKey.CREATE_STUDENT, entityType: AiEntityType.STUDENT };
    }
    if (/\b(lead|khach hang tiem nang|kh tiem nang|khach moi)\b/.test(normalized)) {
      return { actionKey: AiActionKey.CREATE_LEAD, entityType: AiEntityType.LEAD };
    }
    if (/\b(ticket|yeu cau ho tro|khieu nai|su co)\b/.test(normalized)) {
      return { actionKey: AiActionKey.CREATE_TICKET, entityType: AiEntityType.TICKET };
    }
    if (/\b(ad group|nhom quang cao|campaign|chien dich quang cao|chien dich qc|quang cao)\b/.test(normalized)) {
      return { actionKey: AiActionKey.CREATE_AD_GROUP_DRAFT, entityType: AiEntityType.AD_GROUP };
    }
    if (/\b(lop|class)\b/.test(normalized)) {
      return { actionKey: AiActionKey.CREATE_CLASS, entityType: AiEntityType.CLASS };
    }
    return null;
  }

  private extractCreatePayload(actionKey: AiActionKey, message: string): Record<string, unknown> {
    const explicitFields = this.extractExplicitFieldAssignments(message);
    const inferred = this.extractInferredCreatePayload(actionKey, message);
    return this.removeEmptyValues({ ...inferred, ...explicitFields });
  }

  private extractInferredCreatePayload(actionKey: AiActionKey, message: string): Record<string, unknown> {
    if (actionKey === AiActionKey.CREATE_STUDENT) {
      return this.extractStudentCreatePayload(message);
    }
    if (actionKey === AiActionKey.CREATE_CLASS) {
      return this.extractClassCreatePayload(message);
    }
    if (actionKey === AiActionKey.CREATE_LEAD) {
      return this.extractLeadCreatePayload(message);
    }
    if (actionKey === AiActionKey.CREATE_TICKET) {
      return this.extractTicketCreatePayload(message);
    }
    if (actionKey === AiActionKey.CREATE_AD_GROUP_DRAFT) {
      return this.extractAdGroupCreatePayload(message);
    }
    return {};
  }

  private extractStudentCreatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    payload.studentCode = this.extractTextAfterMarker(message, ['ma hoc sinh', 'ma hoc vien', 'student code', 'ma']);
    payload.fullName = this.extractNameValue(message, ['ten hoc sinh', 'ten hoc vien', 'hoc sinh ten', 'hoc vien ten']);
    payload.age = this.extractNumberAfter(message, ['tuoi']);
    payload.parentName = this.extractNameValue(message, ['ten phu huynh', 'phu huynh ten']);
    payload.parentPhone = this.extractPhone(message);
    payload.faceImage = this.extractUrlAfterMarker(message, ['anh', 'face image', 'faceImage']);
    payload.level = this.extractTextAfterMarker(message, ['trinh do', 'level']);
    payload.productPackage = this.extractTextAfterMarker(message, ['goi', 'goi san pham', 'package']);
    return this.removeEmptyValues(payload);
  }

  private extractClassCreatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    payload.name = this.extractNameValue(message, ['ten lop', 'lop ten']);
    payload.code = this.extractTextAfterMarker(message, ['ma lop', 'code']);
    payload.teacherId = this.extractObjectIdAfterMarker(message, ['teacherId', 'giao vien id', 'teacher id']);
    payload.saleId = this.extractObjectIdAfterMarker(message, ['saleId', 'sale id']);
    payload.subject = this.extractTextAfterMarker(message, ['mon', 'subject']);
    payload.grade = this.extractTextAfterMarker(message, ['khoi', 'grade']);
    payload.classMode = this.extractEnum(message, ['online', 'offline'], { online: 'ONLINE', offline: 'OFFLINE' });
    payload.maxStudents = this.extractNumberAfter(message, ['si so', 'toi da', 'max students']);
    return this.removeEmptyValues(payload);
  }

  private extractLeadCreatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    payload.parentName = this.extractNameValue(message, ['ten phu huynh', 'phu huynh ten', 'khach ten', 'ten khach']);
    payload.parentPhone = this.extractPhone(message);
    payload.parentEmail = this.extractEmail(message);
    payload.studentName = this.extractNameValue(message, ['ten hoc sinh', 'hoc sinh ten']);
    payload.studentGrade = this.extractTextAfterMarker(message, ['lop', 'khoi', 'grade']);
    payload.interestedSubjects = this.extractListAfterMarker(message, ['mon quan tam', 'mon hoc', 'subjects']);
    payload.source = this.extractLeadSource(message);
    payload.notes = this.extractTextAfterMarker(message, ['ghi chu', 'note', 'notes']);
    return this.removeEmptyValues(payload);
  }

  private extractTicketCreatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    payload.type = this.extractTicketType(message);
    payload.subject = this.extractTextAfterMarker(message, ['tieu de', 'subject', 've viec', 've']);
    payload.description = this.extractTextAfterMarker(message, ['mo ta', 'noi dung', 'description']);
    payload.priority = this.extractTicketPriority(message);
    payload.studentId = this.extractObjectIdAfterMarker(message, ['studentId', 'hoc sinh id']);
    payload.classId = this.extractObjectIdAfterMarker(message, ['classId', 'lop id']);
    payload.sessionId = this.extractObjectIdAfterMarker(message, ['sessionId', 'buoi hoc id']);
    return this.removeEmptyValues(payload);
  }

  private extractAdGroupCreatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    payload.name = this.extractNameValue(message, [
      'ten nhom quang cao',
      'ten ad group',
      'ad group ten',
      'ten campaign',
      'ten chien dich',
      'campaign ten',
      'name',
    ]);
    payload.adAccountId = this.extractObjectIdAfterMarker(message, [
      'adAccountId',
      'ad account id',
      'tai khoan quang cao',
      'ad account',
    ]);
    payload.platform = this.extractAdPlatform(message);
    payload.platformCampaignId = this.extractTextAfterMarker(message, [
      'platformCampaignId',
      'platform campaign id',
      'campaign id',
      'adset id',
      'ad set id',
      'ma campaign',
      'ma adset',
      'ma chien dich',
    ]);
    payload.dailyBudget = this.extractMoneyAfterMarker(message, [
      'dailyBudget',
      'daily budget',
      'ngan sach ngay',
      'budget ngay',
      'ngan sach',
      'budget',
    ]);
    payload.startDate = this.extractDateAfterMarker(message, ['startDate', 'start date', 'ngay bat dau', 'bat dau']);
    payload.endDate = this.extractDateAfterMarker(message, ['endDate', 'end date', 'ngay ket thuc', 'ket thuc']);
    payload.targetAudience = this.extractTextAfterMarker(message, [
      'targetAudience',
      'target audience',
      'tep khach',
      'doi tuong',
      'audience',
    ]);
    payload.notes = this.extractTextAfterMarker(message, ['ghi chu', 'notes', 'note']);
    payload.trackingKeys = this.extractListAfterMarker(message, [
      'trackingKeys',
      'tracking keys',
      'tracking key',
      'tracking',
    ]);
    return this.removeEmptyValues(payload);
  }

  private parseConfirmation(message: string): AiActionChatDecision | undefined {
    const normalized = this.normalizeText(message);
    const draftId = message.match(/\b[0-9a-f]{24}\b/i)?.[0];

    if (/\b(xac nhan nhap|duyet nhap|dong y thuc hien|thuc hien nhap|confirm draft)\b/.test(normalized)) {
      return { type: 'CONFIRM', draftId };
    }

    if (/\b(huy nhap|bo nhap|tu choi nhap|khong thuc hien|reject draft)\b/.test(normalized)) {
      return { type: 'REJECT', draftId };
    }

    return undefined;
  }

  private extractStudentUpdatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    const phone = this.extractPhone(message);
    if (phone && /\b(sdt|so dien thoai|dien thoai|phone)\b/.test(this.normalizeText(message))) {
      payload.parentPhone = phone;
    }

    const age = this.extractNumberAfter(message, ['tuoi']);
    if (age !== undefined) payload.age = age;

    const level = this.extractTextAfterMarker(message, ['trinh do', 'level']);
    if (level) payload.level = level;

    return payload;
  }

  private extractClassUpdatePayload(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const subject = this.extractTextAfterMarker(message, ['mon', 'subject']);
    if (subject) payload.subject = subject;

    const grade = this.extractTextAfterMarker(message, ['khoi', 'grade']);
    if (grade) payload.grade = grade;

    const maxStudents = this.extractNumberAfter(message, ['si so', 'toi da', 'max students', 'maxstudents']);
    if (maxStudents !== undefined) payload.maxStudents = maxStudents;

    const name = this.extractTextAfterMarker(message, ['ten lop']);
    if (name) payload.name = name;

    return payload;
  }

  private extractTicketUpdatePayload(message: string): Record<string, unknown> {
    const explicitFields = this.extractExplicitFieldAssignments(message);
    const payload: Record<string, unknown> = {};

    const priority = this.extractTicketPriority(message);
    if (priority) {
      payload.priority = priority;
    } else if (typeof explicitFields.priority === 'string') {
      payload.priority = explicitFields.priority.toUpperCase();
    }

    const assignedTo = explicitFields.assignedTo
      || this.extractObjectIdAfterMarker(message, [
        'assignedTo',
        'assigned to',
        'assignee',
        'nguoi phu trach id',
        'nguoi xu ly id',
        'giao cho',
        'assign',
      ]);
    if (assignedTo) payload.assignedTo = String(assignedTo);

    return this.removeEmptyValues(payload);
  }

  private extractHomeworkGradePayload(message: string): Record<string, unknown> {
    const explicitFields = this.extractExplicitFieldAssignments(message);
    const payload: Record<string, unknown> = {};

    const explicitScore = explicitFields.score;
    const score = explicitScore !== undefined
      ? this.parseDecimalNumber(explicitScore)
      : this.extractScoreValue(message);
    if (score !== undefined) payload.score = score;

    const feedback = explicitFields.feedback
      || explicitFields.manualFeedback
      || this.extractGradeFeedback(message);
    if (feedback) payload.feedback = String(feedback);

    return this.removeEmptyValues(payload);
  }

  private extractQuizGradePayload(message: string): Record<string, unknown> {
    const explicitFields = this.extractExplicitFieldAssignments(message);
    const payload: Record<string, unknown> = {};

    const explicitScore = explicitFields.manualScore ?? explicitFields.score;
    const score = explicitScore !== undefined
      ? this.parseDecimalNumber(explicitScore)
      : this.extractScoreValue(message);
    if (score !== undefined) payload.manualScore = score;

    const feedback = explicitFields.manualFeedback
      || explicitFields.feedback
      || this.extractGradeFeedback(message);
    if (feedback) payload.manualFeedback = String(feedback);

    return this.removeEmptyValues(payload);
  }

  private extractTicketCommentPayload(message: string): Record<string, unknown> {
    const explicitFields = this.extractExplicitFieldAssignments(message);
    const payload: Record<string, unknown> = {};
    const explicitContent = explicitFields.content
      || explicitFields.description
      || explicitFields.notes;
    const content = this.trimTicketCommentContent(
      explicitContent ? String(explicitContent) : this.extractTicketCommentContent(message),
    );
    if (content) payload.content = content;

    if (Array.isArray(explicitFields.attachments)) {
      payload.attachments = explicitFields.attachments;
    }

    const isInternal = explicitFields.isInternal ?? this.extractTicketCommentInternalFlag(message);
    if (isInternal !== undefined) payload.isInternal = isInternal;

    return this.removeEmptyValues(payload);
  }

  private hasTicketCommentIntent(normalized: string): boolean {
    return /\b(comment|binh luan|ghi chu|phan hoi|tra loi|bo sung|noi them)\b/.test(normalized);
  }

  private extractTicketCommentContent(message: string): string | undefined {
    const direct = message.match(
      /\b(?:content|noi\s*dung(?:\s*comment)?|comment|binh\s*luan|ghi\s*chu|phan\s*hoi|tra\s*loi)\s*(?:=|:|-|la)\s*([\s\S]+)$/i,
    );
    if (direct?.[1]) return direct[1];

    const afterTicket = message.match(
      /\b(?:ticket|yeu\s*cau\s*ho\s*tro)\b[^:\n]{0,80}:\s*([\s\S]+)$/i,
    );
    return afterTicket?.[1];
  }

  private trimTicketCommentContent(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const stripped = value
      .replace(/^\s*(?:content|noi\s*dung(?:\s*comment)?|comment|binh\s*luan|ghi\s*chu|phan\s*hoi|tra\s*loi)\s*(?:=|:|-|la)\s*/i, '')
      .replace(/[.?!]+$/g, '')
      .trim();
    if (!stripped) return undefined;
    return stripped.length > 1000 ? stripped.slice(0, 1000).trim() : stripped;
  }

  private extractTicketCommentInternalFlag(message: string): boolean | undefined {
    const normalized = this.normalizeText(message);
    if (/\b(noi bo|internal|private|rieng tu)\b/.test(normalized)) return true;
    if (/\b(cong khai|public)\b/.test(normalized)) return false;
    return undefined;
  }

  private extractSessionCancelPayload(message: string): Record<string, unknown> {
    const explicit = this.extractExplicitFieldAssignments(message);
    return {
      cancelReason: explicit.cancelReason
        || explicit.reason
        || this.extractTextAfterMarker(message, ['cancelReason', 'ly do huy', 'ly do', 'reason']),
    };
  }

  private extractSessionReschedulePayload(message: string): Record<string, unknown> {
    const explicit = this.extractExplicitFieldAssignments(message);
    return {
      newScheduledDate: explicit.newScheduledDate
        || this.extractDateAfterMarker(message, ['newScheduledDate', 'ngay moi', 'doi sang', 'doi lich sang', 'chuyen sang']),
      newStartTime: explicit.newStartTime
        || this.extractTimeAfterMarker(message, ['newStartTime', 'gio bat dau moi', 'bat dau luc', 'tu luc']),
      newEndTime: explicit.newEndTime
        || this.extractTimeAfterMarker(message, ['newEndTime', 'gio ket thuc moi', 'ket thuc luc', 'den luc']),
      durationMinutes: explicit.durationMinutes
        || this.extractNumberAfter(message, ['durationMinutes', 'thoi luong']),
      reason: explicit.reason || this.extractReason(message),
    };
  }

  private extractReason(message: string): string | undefined {
    return this.extractTextAfterMarker(message, ['reason', 'ly do', 'ghi chu', 'notes', 'note']);
  }

  private extractTrialStatus(message: string): string | undefined {
    const normalized = this.normalizeText(message);
    if (/\b(convert|converted|chuyen doi|chot hoc|dong y hoc|dang ky hoc)\b/.test(normalized)) return 'CONVERTED';
    if (/\b(reject|rejected|tu choi|khong hoc|khong chuyen doi)\b/.test(normalized)) return 'REJECTED';
    if (/\b(waiting decision|cho quyet dinh|can chot|cho chot)\b/.test(normalized)) return 'WAITING_DECISION';
    if (/\b(pending trial|cho test|cho hoc thu)\b/.test(normalized)) return 'PENDING_TRIAL';
    return undefined;
  }

  private extractAttendanceStatus(message: string): string | undefined {
    const explicit = this.extractExplicitFieldAssignments(message).status;
    if (typeof explicit === 'string') return explicit.toUpperCase();
    const normalized = this.normalizeText(message);
    if (/\b(co mat|present|di hoc)\b/.test(normalized)) return 'PRESENT';
    if (/\b(vang|absent|nghi hoc)\b/.test(normalized)) return 'ABSENT';
    if (/\b(tre|late|di tre)\b/.test(normalized)) return 'LATE';
    if (/\b(co phep|excused|vang phep)\b/.test(normalized)) return 'EXCUSED';
    return undefined;
  }

  private extractExplicitFieldAssignments(message: string): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const normalizedAliases: Record<string, string> = {
      maHocSinh: 'studentCode',
      maHocVien: 'studentCode',
      tenHocSinh: 'fullName',
      tenHocVien: 'fullName',
      hoTenHocSinh: 'fullName',
      tuoi: 'age',
      tenPhuHuynh: 'parentName',
      sdtPhuHuynh: 'parentPhone',
      soDienThoaiPhuHuynh: 'parentPhone',
      anhHocSinh: 'faceImage',
      tenLop: 'name',
      maLop: 'code',
      giaoVienId: 'teacherId',
      mon: 'subject',
      khoi: 'grade',
      siSo: 'maxStudents',
      tenKhach: 'parentName',
      sdt: 'parentPhone',
      email: 'parentEmail',
      tieuDe: 'subject',
      noiDung: 'description',
      moTa: 'description',
      loai: 'type',
      uuTien: 'priority',
      nguoiPhuTrachId: 'assignedTo',
      nguoiXuLyId: 'assignedTo',
      giaoCho: 'assignedTo',
      giaoChoId: 'assignedTo',
      noiDungComment: 'content',
      noiDungBinhLuan: 'content',
      binhLuan: 'content',
      comment: 'content',
      noiBo: 'isInternal',
      reason: 'reason',
      lyDo: 'reason',
      ghiChu: 'notes',
      note: 'notes',
      notes: 'notes',
      lyDoHuy: 'cancelReason',
      cancelReason: 'cancelReason',
      newScheduledDate: 'newScheduledDate',
      ngayMoi: 'newScheduledDate',
      ngayDoiLich: 'newScheduledDate',
      newStartTime: 'newStartTime',
      gioBatDauMoi: 'newStartTime',
      newEndTime: 'newEndTime',
      gioKetThucMoi: 'newEndTime',
      durationMinutes: 'durationMinutes',
      thoiLuong: 'durationMinutes',
      classId: 'classId',
      lopId: 'classId',
      studentId: 'studentId',
      hocSinhId: 'studentId',
      date: 'date',
      ngay: 'date',
      status: 'status',
      trangThai: 'status',
      productId: 'productId',
      sanPhamId: 'productId',
      experienceTeacherId: 'experienceTeacherId',
      giaoVienTraiNghiemId: 'experienceTeacherId',
      testDate: 'testDate',
      ngayTest: 'testDate',
      testStartTime: 'testStartTime',
      gioBatDauTest: 'testStartTime',
      testEndTime: 'testEndTime',
      gioKetThucTest: 'testEndTime',
      assessmentScore: 'assessmentScore',
      diemDanhGia: 'assessmentScore',
      trialSessionsUsed: 'trialSessionsUsed',
      soBuoiTest: 'trialSessionsUsed',
      orderId: 'orderId',
      invoiceId: 'invoiceId',
      decisionAt: 'decisionAt',
      ngayQuyetDinh: 'decisionAt',
      decisionNotes: 'decisionNotes',
      ghiChuQuyetDinh: 'decisionNotes',
      taiKhoanQuangCao: 'adAccountId',
      adAccount: 'adAccountId',
      adAccountId: 'adAccountId',
      nenTang: 'platform',
      nenTangQuangCao: 'platform',
      campaignId: 'platformCampaignId',
      adsetId: 'platformCampaignId',
      adSetId: 'platformCampaignId',
      maCampaign: 'platformCampaignId',
      maAdset: 'platformCampaignId',
      maChienDich: 'platformCampaignId',
      dailyBudget: 'dailyBudget',
      nganSach: 'dailyBudget',
      nganSachNgay: 'dailyBudget',
      budget: 'dailyBudget',
      budgetNgay: 'dailyBudget',
      ngayBatDau: 'startDate',
      startDate: 'startDate',
      ngayKetThuc: 'endDate',
      endDate: 'endDate',
      tepKhach: 'targetAudience',
      doiTuong: 'targetAudience',
      audience: 'targetAudience',
      targetAudience: 'targetAudience',
      tracking: 'trackingKeys',
      trackingKey: 'trackingKeys',
      trackingKeys: 'trackingKeys',
      diem: 'score',
      diemBaiTap: 'score',
      score: 'score',
      homeworkScore: 'score',
      nhanXet: 'feedback',
      nhanXetBaiTap: 'feedback',
      feedback: 'feedback',
      manualScore: 'manualScore',
      diemQuiz: 'manualScore',
      quizScore: 'manualScore',
      manualFeedback: 'manualFeedback',
      nhanXetQuiz: 'manualFeedback',
    };

    for (const rawLine of message.split(/\r?\n|;/)) {
      const match = rawLine.match(/^\s*([A-Za-z0-9_\-\s]+)\s*[:=]\s*(.+?)\s*$/);
      if (!match) continue;
      const rawKey = match[1].trim();
      const normalizedKey = this.toCamelAlias(rawKey);
      const field = normalizedAliases[normalizedKey] || rawKey;
      payload[field] = this.coerceExplicitValue(field, match[2].trim());
    }

    return payload;
  }

  private coerceExplicitValue(field: string, value: string): unknown {
    if ([
      'age',
      'studentBirthMonth',
      'parentBirthMonth',
      'maxStudents',
      'dailyBudget',
      'score',
      'manualScore',
      'durationMinutes',
      'assessmentScore',
      'trialSessionsUsed',
    ].includes(field)) {
      const numberValue = field === 'dailyBudget' ? this.parseMoney(value) : Number(value);
      return Number.isFinite(numberValue) ? numberValue : value;
    }
    if (['interestedSubjects', 'tags', 'attachments', 'studentIds', 'parentUserIds', 'trackingKeys'].includes(field)) {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    if (field === 'isInternal') {
      return this.parseBoolean(value);
    }
    if (field === 'status') {
      return value.trim().toUpperCase();
    }
    return value;
  }

  private extractPhone(message: string): string | undefined {
    const explicit = message.match(/(?:sdt|so dien thoai|dien thoai|phone)[^0-9+]*(?:thanh|sang|la|=|:)?[^0-9+]*([0-9+\-()\s]{6,20})/i);
    if (explicit?.[1]) return explicit[1].trim().replace(/\s+/g, '');
    const anyPhone = message.match(/\b(0\d{8,10}|\+84\d{8,10})\b/);
    return anyPhone?.[1];
  }

  private extractEmail(message: string): string | undefined {
    return message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  }

  private extractNumberAfter(message: string, markers: string[]): number | undefined {
    const normalized = this.normalizeText(message);
    for (const marker of markers) {
      const markerIndex = normalized.indexOf(this.normalizeText(marker));
      if (markerIndex < 0) continue;
      const tail = normalized.slice(markerIndex + marker.length);
      const match = tail.match(/\b(\d{1,4})\b/);
      if (match) return Number(match[1]);
    }
    return undefined;
  }

  private extractScoreValue(message: string): number | undefined {
    const patterns = [
      /(?:diem|điểm|score|grade)\s*(?:=|:|-|la|là)?\s*(\d{1,3}(?:[,.]\d{1,2})?)/i,
      /(?:cho|cham|chấm)\s*(\d{1,3}(?:[,.]\d{1,2})?)(?:\s*\/\s*\d{1,3})?\s*(?:diem|điểm)?/i,
      /(\d{1,3}(?:[,.]\d{1,2})?)\s*(?:\/\s*\d{1,3})?\s*(?:diem|điểm|score)/i,
    ];

    for (const pattern of patterns) {
      const value = this.parseDecimalNumber(message.match(pattern)?.[1]);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private parseDecimalNumber(value: unknown): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized) {
      return undefined;
    }
    const numberValue = Number(normalized);
    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  private extractGradeFeedback(message: string): string | undefined {
    const explicit = this.extractTextAfterMarker(message, [
      'nhan xet',
      'nhận xét',
      'feedback',
      'manual feedback',
      'loi nhan xet',
      'lời nhận xét',
      'gop y',
      'góp ý',
    ]);
    if (explicit) return explicit;

    const tail = message.match(/\b(?:vi|vì|ly do|lý do)\s+([\s\S]{3,500})$/i)?.[1];
    return this.trimExtractedValue(tail);
  }

  private extractNameValue(message: string, markers: string[]): string | undefined {
    return this.extractTextAfterMarker(message, markers)
      || this.extractQuotedValue(message);
  }

  private extractTextAfterMarker(message: string, markers: string[]): string | undefined {
    const normalized = this.normalizeText(message);
    for (const marker of markers) {
      const normalizedMarker = this.normalizeText(marker);
      const markerIndex = normalized.indexOf(normalizedMarker);
      if (markerIndex < 0) continue;
      const tail = message.slice(this.approximateOriginalIndex(message, markerIndex + normalizedMarker.length));
      const match = tail.match(/(?:thanh|sang|la|=|:)?\s+(.+)/i);
      const value = this.trimExtractedValue(match?.[1]);
      if (value && value.length <= 160) return value;
    }
    return undefined;
  }

  private trimExtractedValue(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const nextFieldMarker = [
      'ma',
      'ten',
      'tuoi',
      'sdt',
      'so dien thoai',
      'dien thoai',
      'phone',
      'phu huynh',
      'anh',
      'face image',
      'goi',
      'package',
      'trinh do',
      'level',
      'teacherid',
      'giao vien',
      'saleid',
      'sale id',
      'mon',
      'subject',
      'khoi',
      'grade',
      'si so',
      'email',
      'nguon',
      'source',
      'ghi chu',
      'note',
      'notes',
      'tieu de',
      'noi dung',
      'mo ta',
      'loai',
      'uu tien',
      'priority',
      'studentid',
      'classid',
      'sessionid',
      'adaccountid',
      'ad account',
      'platform',
      'campaign id',
      'adset id',
      'dailybudget',
      'daily budget',
      'ngan sach',
      'budget',
      'startdate',
      'enddate',
      'ngay bat dau',
      'ngay ket thuc',
      'target audience',
      'tep khach',
      'doi tuong',
      'tracking',
      'diem',
      'score',
      'grade',
      'nhan xet',
      'feedback',
      'manual feedback',
      'gop y',
    ].join('|');
    const stopAtNextField = new RegExp(
      `[,;.]\\s+(?=(?:${nextFieldMarker})\\b|[A-Za-z][A-Za-z0-9_ -]*\\s*(?:=|:))`,
      'i',
    );

    return value
      .split(stopAtNextField)[0]
      .replace(/[.?!]+$/g, '')
      .trim();
  }

  private extractListAfterMarker(message: string, markers: string[]): string[] | undefined {
    const value = this.extractTextAfterMarker(message, markers);
    if (!value) return undefined;
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  private extractQuotedValue(message: string): string | undefined {
    return message.match(/["“”']([^"“”']{2,120})["“”']/)?.[1]?.trim();
  }

  private extractUrlAfterMarker(message: string, markers: string[]): string | undefined {
    const url = message.match(/https?:\/\/\S+/i)?.[0];
    if (!url) return undefined;
    const normalized = this.normalizeText(message);
    return markers.some((marker) => normalized.includes(this.normalizeText(marker))) ? url : undefined;
  }

  private extractObjectIdAfterMarker(message: string, markers: string[]): string | undefined {
    const normalized = this.normalizeText(message);
    for (const marker of markers) {
      const markerIndex = normalized.indexOf(this.normalizeText(marker));
      if (markerIndex < 0) continue;
      const tail = message.slice(this.approximateOriginalIndex(message, markerIndex));
      const id = tail.match(/\b[0-9a-f]{24}\b/i)?.[0];
      if (id) return id;
    }
    return undefined;
  }

  private extractDateAfterMarker(message: string, markers: string[]): string | undefined {
    const normalized = this.normalizeText(message);
    for (const marker of markers) {
      const markerIndex = normalized.indexOf(this.normalizeText(marker));
      if (markerIndex < 0) continue;
      const tail = message.slice(this.approximateOriginalIndex(message, markerIndex));
      const match = tail.match(/\b(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/);
      const normalizedDate = this.normalizeDateValue(match?.[1]);
      if (normalizedDate) return normalizedDate;
    }
    return undefined;
  }

  private extractTimeAfterMarker(message: string, markers: string[]): string | undefined {
    const normalized = this.normalizeText(message);
    for (const marker of markers) {
      const markerIndex = normalized.indexOf(this.normalizeText(marker));
      if (markerIndex < 0) continue;
      const tail = message.slice(this.approximateOriginalIndex(message, markerIndex + marker.length));
      const match = tail.match(/(?:la|=|:|luc|vao)?\s*(\d{1,2})(?::|h)(\d{2})?\b/i);
      if (!match) continue;
      const hour = Number(match[1]);
      const minute = match[2] === undefined ? 0 : Number(match[2]);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
      if (!Number.isInteger(minute) || minute < 0 || minute > 59) continue;
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return undefined;
  }

  private extractMoneyAfterMarker(message: string, markers: string[]): number | undefined {
    const normalized = this.normalizeText(message);
    for (const marker of markers) {
      const markerIndex = normalized.indexOf(this.normalizeText(marker));
      if (markerIndex < 0) continue;
      const tail = message.slice(this.approximateOriginalIndex(message, markerIndex + marker.length));
      const match = tail.match(/(?:la|=|:)?\s*([0-9][0-9.,\s]*(?:k|nghin|ngan|tr|trieu|m)?)/i);
      const value = this.parseMoney(match?.[1]);
      if (Number.isFinite(value)) return value;
    }
    return undefined;
  }

  private extractAdPlatform(message: string): string | undefined {
    const normalized = this.normalizeText(message);
    if (normalized.includes('facebook') || normalized.includes('meta')) return 'FACEBOOK';
    if (normalized.includes('google')) return 'GOOGLE';
    if (normalized.includes('tiktok') || normalized.includes('tik tok')) return 'TIKTOK';
    return undefined;
  }

  private extractEnum(message: string, values: string[], map: Record<string, string>) {
    const normalized = this.normalizeText(message);
    const found = values.find((value) => normalized.includes(value));
    return found ? map[found] : undefined;
  }

  private extractLeadSource(message: string): string | undefined {
    const normalized = this.normalizeText(message);
    if (normalized.includes('facebook')) return 'FACEBOOK';
    if (normalized.includes('google')) return 'GOOGLE';
    if (normalized.includes('tiktok')) return 'TIKTOK';
    if (normalized.includes('zalo')) return 'ZALO';
    if (normalized.includes('website')) return 'WEBSITE';
    if (normalized.includes('gioi thieu') || normalized.includes('referral')) return 'REFERRAL';
    if (normalized.includes('walk in') || normalized.includes('truc tiep')) return 'WALK_IN';
    return undefined;
  }

  private parseMoney(value: string | undefined): number {
    if (!value) return Number.NaN;
    const compact = value.toLowerCase().replace(/\s+/g, '');
    const hasMillionSuffix = /(trieu|triệu|tr|m)$/.test(compact);
    const hasThousandSuffix = /(k|nghin|ngan)$/.test(compact);
    const numericPart = compact.replace(/[^0-9.,]/g, '');
    if (!numericPart) return Number.NaN;
    if (hasMillionSuffix || hasThousandSuffix) {
      const decimalValue = Number(numericPart.replace(',', '.'));
      if (!Number.isFinite(decimalValue)) return Number.NaN;
      return Math.round(decimalValue * (hasMillionSuffix ? 1_000_000 : 1_000));
    }
    const integerValue = Number(numericPart.replace(/[^0-9]/g, ''));
    return Number.isFinite(integerValue) ? integerValue : Number.NaN;
  }

  private parseBoolean(value: string): boolean | string {
    const normalized = this.normalizeText(value);
    if (['true', 'yes', 'y', '1', 'noi bo', 'internal', 'private'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0', 'cong khai', 'public'].includes(normalized)) return false;
    return value;
  }

  private normalizeDateValue(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const parts = value.split(/[/-]/).map((part) => part.padStart(2, '0'));
    if (parts.length !== 3) return undefined;
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  private extractTicketType(message: string): string | undefined {
    const normalized = this.normalizeText(message);
    if (normalized.includes('hoan tien') || normalized.includes('refund')) return 'REFUND_REQUEST';
    if (normalized.includes('giao vien') && normalized.includes('khieu nai')) return 'TEACHER_COMPLAINT';
    if (normalized.includes('phu huynh') && normalized.includes('khieu nai')) return 'PARENT_COMPLAINT';
    if (normalized.includes('lich') || normalized.includes('doi buoi')) return 'SCHEDULE_ISSUE';
    if (normalized.includes('thanh toan') || normalized.includes('hoc phi')) return 'PAYMENT_ISSUE';
    if (normalized.includes('day thay')) return 'SUBSTITUTE_TEACHER';
    if (normalized.includes('khieu nai') || normalized.includes('tranh chap')) return 'DISPUTE';
    return undefined;
  }

  private extractTicketPriority(message: string): string | undefined {
    const normalized = this.normalizeText(message);
    if (normalized.includes('khan') || normalized.includes('urgent')) return 'URGENT';
    if (normalized.includes('cao') || normalized.includes('high')) return 'HIGH';
    if (normalized.includes('thap') || normalized.includes('low')) return 'LOW';
    if (normalized.includes('trung binh') || normalized.includes('medium')) return 'MEDIUM';
    return undefined;
  }

  private removeEmptyValues(payload: Record<string, unknown>): Record<string, unknown> {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (this.isMissing(value)) continue;
      output[key] = value;
    }
    return output;
  }

  private isMissing(value: unknown): boolean {
    return value === undefined
      || value === null
      || value === ''
      || (Array.isArray(value) && value.length === 0);
  }

  private label(field: string) {
    return FIELD_LABELS[field] || field;
  }

  private formatValue(value: unknown) {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private toCamelAlias(value: string) {
    const words = this.normalizeText(value).split(' ').filter(Boolean);
    return words
      .map((word, index) => index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join('');
  }

  private approximateOriginalIndex(message: string, normalizedIndex: number) {
    return Math.min(message.length, normalizedIndex);
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[đĐÄ‘]/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }
}
