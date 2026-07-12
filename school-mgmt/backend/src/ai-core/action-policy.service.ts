import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  AiActionKey,
  AiActionPreview,
  AiCoreRiskLevel,
  AiEntityType,
} from './ai-core.types';

interface ActionPolicy {
  actionKey: AiActionKey;
  entityType: AiEntityType;
  allowedRoles: readonly Role[];
  allowedFields: readonly string[];
  requiredFields: readonly string[];
  riskLevel: AiCoreRiskLevel;
  requiresApproval: boolean;
}

export interface AiActionFieldSchema {
  actionKey: AiActionKey;
  entityType: AiEntityType;
  requiredFields: readonly string[];
  optionalFields: readonly string[];
  allowedFields: readonly string[];
}

const STUDENT_CREATE_FIELDS = [
  'studentCode',
  'fullName',
  'age',
  'studentBirthMonth',
  'parentBirthMonth',
  'parentName',
  'parentPhone',
  'parentUserId',
  'parentUserIds',
  'studentUserId',
  'faceImage',
  'productPackage',
  'level',
  'studentType',
  'saleId',
  'saleName',
] as const;

const STUDENT_UPDATE_FIELDS = [
  'studentCode',
  'fullName',
  'age',
  'studentBirthMonth',
  'parentBirthMonth',
  'parentName',
  'parentPhone',
  'parentUserId',
  'parentUserIds',
  'studentUserId',
  'faceImage',
  'productPackage',
  'level',
  'studentType',
  'saleId',
  'saleName',
] as const;

const CLASS_CREATE_FIELDS = [
  'name',
  'code',
  'teacherId',
  'saleId',
  'invoiceId',
  'classMode',
  'productPackageId',
  'coTeachers',
  'studentIds',
  'subject',
  'grade',
  'learningGoals',
  'curriculum',
  'pricePerSession',
  'teacherPayPerSession',
  'teacherPayPerStudent',
  'baseDuration',
  'sessionDuration',
  'revenuePerStudent',
  'teacherSalaryCost',
  'maxStudents',
] as const;

const CLASS_UPDATE_FIELDS = [
  ...CLASS_CREATE_FIELDS,
  'requestType',
] as const;

const LEAD_CREATE_FIELDS = [
  'parentName',
  'parentPhone',
  'parentEmail',
  'studentName',
  'studentGrade',
  'interestedSubjects',
  'source',
  'adGroupId',
  'adGroupName',
  'referredBy',
  'referredByUserId',
  'estimatedValue',
  'tags',
  'notes',
  'tracking',
] as const;

const LEAD_UPDATE_FIELDS = [
  ...LEAD_CREATE_FIELDS,
  'status',
  'saleId',
  'saleName',
  'nextFollowUp',
] as const;

const LEAD_CONTACT_FIELDS = [
  'method',
  'notes',
  'nextFollowUp',
] as const;

const TICKET_CREATE_FIELDS = [
  'type',
  'subject',
  'description',
  'priority',
  'sessionId',
  'classId',
  'studentId',
  'teacherId',
  'parentId',
  'sourceConversationId',
  'payrollId',
  'ledgerEntryId',
  'attachments',
  'substituteTeacherId',
  'substituteFromDate',
  'substituteToDate',
] as const;

const TICKET_UPDATE_FIELDS = [
  'priority',
  'assignedTo',
] as const;

const TICKET_COMMENT_FIELDS = [
  'content',
  'attachments',
  'isInternal',
] as const;

const SESSION_FINALIZE_FIELDS = [
  'reason',
] as const;

const SESSION_CANCEL_FIELDS = [
  'cancelReason',
] as const;

const SESSION_RESCHEDULE_FIELDS = [
  'newScheduledDate',
  'newStartTime',
  'newEndTime',
  'durationMinutes',
  'reason',
] as const;

const SESSION_NO_SHOW_FIELDS = [
  'reason',
] as const;

const ATTENDANCE_MARK_FIELDS = [
  'classId',
  'studentId',
  'date',
  'status',
  'notes',
] as const;

const TRIAL_UPDATE_FIELDS = [
  'status',
  'classId',
  'productId',
  'experienceTeacherId',
  'testDate',
  'testStartTime',
  'testEndTime',
  'assessmentScore',
  'trialSessionsUsed',
  'studentId',
  'orderId',
  'invoiceId',
  'decisionAt',
  'notes',
  'decisionNotes',
] as const;

const AD_GROUP_CREATE_FIELDS = [
  'name',
  'adAccountId',
  'platform',
  'platformCampaignId',
  'dailyBudget',
  'startDate',
  'endDate',
  'targetAudience',
  'notes',
  'trackingKeys',
] as const;

const AD_BUDGET_FIELDS = [
  'dailyBudget',
  'effectiveDate',
  'reason',
] as const;

const AD_GROUP_STATUS_FIELDS = [
  'status',
  'effectiveDate',
  'reason',
] as const;

const AD_COST_SYNC_FIELDS = [
  'adAccountId',
  'date',
  'lookbackDays',
  'reason',
] as const;

const HOMEWORK_GRADE_FIELDS = [
  'score',
  'feedback',
] as const;

const QUIZ_GRADE_FIELDS = [
  'manualScore',
  'manualFeedback',
] as const;

const ADS_MUTATION_ROLES = [Role.DIRECTOR, Role.OPS, Role.ADSMANAGER] as const;
const LEARNING_REVIEW_ROLES = [Role.DIRECTOR, Role.OPS, Role.EXPERIENCE_TEACHER] as const;

const ACTION_POLICIES: Partial<Record<AiActionKey, ActionPolicy>> = {
  [AiActionKey.CREATE_STUDENT]: {
    actionKey: AiActionKey.CREATE_STUDENT,
    entityType: AiEntityType.STUDENT,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: STUDENT_CREATE_FIELDS,
    requiredFields: ['studentCode', 'fullName', 'age', 'parentName', 'parentPhone', 'faceImage'],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.UPDATE_STUDENT]: {
    actionKey: AiActionKey.UPDATE_STUDENT,
    entityType: AiEntityType.STUDENT,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: STUDENT_UPDATE_FIELDS,
    requiredFields: [],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.CREATE_CLASS]: {
    actionKey: AiActionKey.CREATE_CLASS,
    entityType: AiEntityType.CLASS,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: CLASS_CREATE_FIELDS,
    requiredFields: ['name', 'code', 'teacherId'],
    riskLevel: 'HIGH',
    requiresApproval: false,
  },
  [AiActionKey.UPDATE_CLASS]: {
    actionKey: AiActionKey.UPDATE_CLASS,
    entityType: AiEntityType.CLASS,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: CLASS_UPDATE_FIELDS,
    requiredFields: [],
    riskLevel: 'HIGH',
    requiresApproval: false,
  },
  [AiActionKey.CREATE_LEAD]: {
    actionKey: AiActionKey.CREATE_LEAD,
    entityType: AiEntityType.LEAD,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: LEAD_CREATE_FIELDS,
    requiredFields: ['parentName', 'parentPhone'],
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  [AiActionKey.UPDATE_LEAD]: {
    actionKey: AiActionKey.UPDATE_LEAD,
    entityType: AiEntityType.LEAD,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: LEAD_UPDATE_FIELDS,
    requiredFields: [],
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  [AiActionKey.ADD_LEAD_CONTACT]: {
    actionKey: AiActionKey.ADD_LEAD_CONTACT,
    entityType: AiEntityType.LEAD,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE],
    allowedFields: LEAD_CONTACT_FIELDS,
    requiredFields: ['method'],
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  [AiActionKey.CREATE_TICKET]: {
    actionKey: AiActionKey.CREATE_TICKET,
    entityType: AiEntityType.TICKET,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER, Role.PARENT],
    allowedFields: TICKET_CREATE_FIELDS,
    requiredFields: ['type', 'subject', 'description'],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.UPDATE_TICKET]: {
    actionKey: AiActionKey.UPDATE_TICKET,
    entityType: AiEntityType.TICKET,
    allowedRoles: [Role.DIRECTOR, Role.OPS],
    allowedFields: TICKET_UPDATE_FIELDS,
    requiredFields: [],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.ADD_TICKET_COMMENT]: {
    actionKey: AiActionKey.ADD_TICKET_COMMENT,
    entityType: AiEntityType.TICKET,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.TEACHER, Role.PARENT],
    allowedFields: TICKET_COMMENT_FIELDS,
    requiredFields: ['content'],
    riskLevel: 'LOW',
    requiresApproval: false,
  },
  [AiActionKey.FINALIZE_SESSION]: {
    actionKey: AiActionKey.FINALIZE_SESSION,
    entityType: AiEntityType.SESSION,
    allowedRoles: [Role.DIRECTOR, Role.OPS],
    allowedFields: SESSION_FINALIZE_FIELDS,
    requiredFields: [],
    riskLevel: 'HIGH',
    requiresApproval: false,
  },
  [AiActionKey.CANCEL_SESSION]: {
    actionKey: AiActionKey.CANCEL_SESSION,
    entityType: AiEntityType.SESSION,
    allowedRoles: [Role.DIRECTOR, Role.OPS],
    allowedFields: SESSION_CANCEL_FIELDS,
    requiredFields: ['cancelReason'],
    riskLevel: 'HIGH',
    requiresApproval: false,
  },
  [AiActionKey.RESCHEDULE_SESSION]: {
    actionKey: AiActionKey.RESCHEDULE_SESSION,
    entityType: AiEntityType.SESSION,
    allowedRoles: [Role.DIRECTOR, Role.OPS],
    allowedFields: SESSION_RESCHEDULE_FIELDS,
    requiredFields: ['newScheduledDate'],
    riskLevel: 'HIGH',
    requiresApproval: false,
  },
  [AiActionKey.MARK_SESSION_NO_SHOW]: {
    actionKey: AiActionKey.MARK_SESSION_NO_SHOW,
    entityType: AiEntityType.SESSION,
    allowedRoles: [Role.DIRECTOR, Role.OPS],
    allowedFields: SESSION_NO_SHOW_FIELDS,
    requiredFields: [],
    riskLevel: 'HIGH',
    requiresApproval: false,
  },
  [AiActionKey.MARK_ATTENDANCE]: {
    actionKey: AiActionKey.MARK_ATTENDANCE,
    entityType: AiEntityType.ATTENDANCE,
    allowedRoles: [Role.DIRECTOR, Role.OPS],
    allowedFields: ATTENDANCE_MARK_FIELDS,
    requiredFields: ['classId', 'studentId', 'date', 'status'],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.UPDATE_TRIAL_ENROLLMENT]: {
    actionKey: AiActionKey.UPDATE_TRIAL_ENROLLMENT,
    entityType: AiEntityType.TRIAL_ENROLLMENT,
    allowedRoles: [Role.DIRECTOR, Role.OPS, Role.SALE, Role.EXPERIENCE_TEACHER],
    allowedFields: TRIAL_UPDATE_FIELDS,
    requiredFields: [],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.ADJUST_AD_BUDGET]: {
    actionKey: AiActionKey.ADJUST_AD_BUDGET,
    entityType: AiEntityType.AD_GROUP,
    allowedRoles: ADS_MUTATION_ROLES,
    allowedFields: AD_BUDGET_FIELDS,
    requiredFields: ['dailyBudget'],
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  [AiActionKey.PAUSE_AD_GROUP]: {
    actionKey: AiActionKey.PAUSE_AD_GROUP,
    entityType: AiEntityType.AD_GROUP,
    allowedRoles: ADS_MUTATION_ROLES,
    allowedFields: AD_GROUP_STATUS_FIELDS,
    requiredFields: ['status'],
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  [AiActionKey.RESUME_AD_GROUP]: {
    actionKey: AiActionKey.RESUME_AD_GROUP,
    entityType: AiEntityType.AD_GROUP,
    allowedRoles: ADS_MUTATION_ROLES,
    allowedFields: AD_GROUP_STATUS_FIELDS,
    requiredFields: ['status'],
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  [AiActionKey.CREATE_AD_GROUP_DRAFT]: {
    actionKey: AiActionKey.CREATE_AD_GROUP_DRAFT,
    entityType: AiEntityType.AD_GROUP,
    allowedRoles: ADS_MUTATION_ROLES,
    allowedFields: AD_GROUP_CREATE_FIELDS,
    requiredFields: ['name', 'adAccountId', 'platform'],
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  [AiActionKey.SYNC_AD_COSTS]: {
    actionKey: AiActionKey.SYNC_AD_COSTS,
    entityType: AiEntityType.AD_GROUP,
    allowedRoles: [Role.DIRECTOR],
    allowedFields: AD_COST_SYNC_FIELDS,
    requiredFields: ['adAccountId', 'date'],
    riskLevel: 'HIGH',
    requiresApproval: true,
  },
  [AiActionKey.GRADE_HOMEWORK]: {
    actionKey: AiActionKey.GRADE_HOMEWORK,
    entityType: AiEntityType.SESSION,
    allowedRoles: LEARNING_REVIEW_ROLES,
    allowedFields: HOMEWORK_GRADE_FIELDS,
    requiredFields: ['score', 'feedback'],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
  [AiActionKey.GRADE_QUIZ_ATTEMPT]: {
    actionKey: AiActionKey.GRADE_QUIZ_ATTEMPT,
    entityType: AiEntityType.QUIZ_ATTEMPT,
    allowedRoles: LEARNING_REVIEW_ROLES,
    allowedFields: QUIZ_GRADE_FIELDS,
    requiredFields: ['manualScore', 'manualFeedback'],
    riskLevel: 'MEDIUM',
    requiresApproval: false,
  },
};

@Injectable()
export class AiActionPolicyService {
  getPolicy(actionKey: AiActionKey): ActionPolicy {
    const policy = ACTION_POLICIES[actionKey];
    if (!policy) {
      throw new BadRequestException('Action AI chua duoc ho tro');
    }
    return policy;
  }

  getFieldSchema(actionKey: AiActionKey): AiActionFieldSchema {
    const policy = this.getPolicy(actionKey);
    const required = new Set(policy.requiredFields);
    return {
      actionKey,
      entityType: policy.entityType,
      requiredFields: policy.requiredFields,
      optionalFields: policy.allowedFields.filter((field) => !required.has(field)),
      allowedFields: policy.allowedFields,
    };
  }

  assertCanDraft(actionKey: AiActionKey, user: JwtPayload) {
    const policy = this.getPolicy(actionKey);
    if (!policy) {
      throw new BadRequestException('Action AI chua duoc ho tro');
    }
    if (!policy.allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Ban khong co quyen tao nhap hanh dong nay');
    }
  }

  sanitizeAndValidatePayload(actionKey: AiActionKey, payload: Record<string, unknown>, user: JwtPayload) {
    this.assertCanDraft(actionKey, user);
    const policy = this.getPolicy(actionKey);
    const input = payload || {};
    const fields = Object.keys(input);
    const disallowed = fields.filter((field) => !policy.allowedFields.includes(field));
    if (disallowed.length) {
      throw new BadRequestException(`Field khong duoc phep cho ${actionKey}: ${disallowed.join(', ')}`);
    }

    for (const field of policy.requiredFields) {
      if (input[field] === undefined || input[field] === null || input[field] === '') {
        throw new BadRequestException(`Thieu field bat buoc: ${field}`);
      }
    }

    if (fields.length === 0) {
      throw new BadRequestException('Payload action khong duoc de trong');
    }

    this.assertBasicFieldValidity(actionKey, input);
    return this.normalizePayload(input);
  }

  assertEntityTarget(actionKey: AiActionKey, entityId?: string) {
    if ([
      AiActionKey.UPDATE_STUDENT,
      AiActionKey.UPDATE_CLASS,
      AiActionKey.UPDATE_LEAD,
      AiActionKey.ADD_LEAD_CONTACT,
      AiActionKey.UPDATE_TICKET,
      AiActionKey.ADD_TICKET_COMMENT,
      AiActionKey.FINALIZE_SESSION,
      AiActionKey.CANCEL_SESSION,
      AiActionKey.RESCHEDULE_SESSION,
      AiActionKey.MARK_SESSION_NO_SHOW,
      AiActionKey.UPDATE_TRIAL_ENROLLMENT,
      AiActionKey.ADJUST_AD_BUDGET,
      AiActionKey.PAUSE_AD_GROUP,
      AiActionKey.RESUME_AD_GROUP,
      AiActionKey.GRADE_HOMEWORK,
      AiActionKey.GRADE_QUIZ_ATTEMPT,
    ].includes(actionKey) && !entityId) {
      throw new BadRequestException('Action update can entityId');
    }
    if (entityId && !Types.ObjectId.isValid(entityId)) {
      throw new BadRequestException('entityId khong hop le');
    }
  }

  buildActionMeta(actionKey: AiActionKey): Pick<
    AiActionPreview,
    'entityType' | 'riskLevel' | 'requiresApproval' | 'requiresConfirmation'
  > {
    const policy = this.getPolicy(actionKey);
    return {
      entityType: policy.entityType,
      riskLevel: policy.riskLevel,
      requiresApproval: policy.requiresApproval,
      requiresConfirmation: true,
    };
  }

  private assertBasicFieldValidity(actionKey: AiActionKey, payload: Record<string, unknown>) {
    if (payload.parentPhone !== undefined) {
      const phone = String(payload.parentPhone).trim();
      if (!/^[0-9+\-()\s]{6,20}$/.test(phone)) {
        throw new BadRequestException('parentPhone khong hop le');
      }
    }

    if (payload.parentEmail !== undefined && payload.parentEmail !== '') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(payload.parentEmail))) {
        throw new BadRequestException('parentEmail khong hop le');
      }
    }

    if (payload.age !== undefined) {
      const age = Number(payload.age);
      if (!Number.isInteger(age) || age < 3 || age > 25) {
        throw new BadRequestException('age phai la so nguyen tu 3 den 25');
      }
    }

    for (const field of ['studentBirthMonth', 'parentBirthMonth']) {
      if (payload[field] !== undefined) {
        const month = Number(payload[field]);
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          throw new BadRequestException(`${field} phai tu 1 den 12`);
        }
      }
    }

    for (const field of [
      'parentUserId',
      'studentUserId',
      'saleId',
      'teacherId',
      'invoiceId',
      'productPackageId',
      'adGroupId',
      'referredByUserId',
      'sessionId',
      'classId',
      'studentId',
      'parentId',
      'sourceConversationId',
      'payrollId',
      'ledgerEntryId',
      'substituteTeacherId',
      'assignedTo',
      'adAccountId',
      'productId',
      'experienceTeacherId',
      'orderId',
    ]) {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== '') {
        if (!Types.ObjectId.isValid(String(payload[field]))) {
          throw new BadRequestException(`${field} khong phai MongoId hop le`);
        }
      }
    }

    for (const field of ['interestedSubjects', 'tags', 'attachments', 'trackingKeys']) {
      if (payload[field] !== undefined) {
        if (!Array.isArray(payload[field])) {
          throw new BadRequestException(`${field} phai la mang`);
        }
        if (!(payload[field] as unknown[]).every((value) => typeof value === 'string')) {
          throw new BadRequestException(`${field} chi duoc chua chuoi`);
        }
      }
    }

    for (const field of ['parentUserIds', 'studentIds']) {
      if (payload[field] !== undefined) {
        if (!Array.isArray(payload[field])) {
          throw new BadRequestException(`${field} phai la mang`);
        }
        for (const value of payload[field] as unknown[]) {
          if (!Types.ObjectId.isValid(String(value))) {
            throw new BadRequestException(`${field} co id khong hop le`);
          }
        }
      }
    }

    for (const field of [
      'pricePerSession',
      'teacherPayPerSession',
      'teacherPayPerStudent',
      'revenuePerStudent',
      'teacherSalaryCost',
      'dailyBudget',
      'durationMinutes',
      'trialSessionsUsed',
      'assessmentScore',
    ]) {
      if (payload[field] !== undefined) {
        const value = Number(payload[field]);
        if (!Number.isFinite(value) || value < 0) {
          throw new BadRequestException(`${field} khong duoc am`);
        }
      }
    }

    if (payload.lookbackDays !== undefined) {
      const lookbackDays = Number(payload.lookbackDays);
      if (!Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > 14) {
        throw new BadRequestException('lookbackDays phai la so nguyen tu 1 den 14');
      }
    }

    if (payload.score !== undefined) {
      const score = Number(payload.score);
      if (!Number.isFinite(score) || score < 0 || score > 10) {
        throw new BadRequestException('score phai nam trong khoang 0 den 10');
      }
    }

    if (payload.manualScore !== undefined) {
      const manualScore = Number(payload.manualScore);
      if (!Number.isFinite(manualScore) || manualScore < 0) {
        throw new BadRequestException('manualScore khong duoc am');
      }
    }

    for (const field of ['baseDuration', 'sessionDuration']) {
      if (payload[field] !== undefined && Number(payload[field]) < 15) {
        throw new BadRequestException(`${field} phai toi thieu 15`);
      }
    }

    if (payload.durationMinutes !== undefined && Number(payload.durationMinutes) < 15) {
      throw new BadRequestException('durationMinutes phai toi thieu 15');
    }

    if (payload.assessmentScore !== undefined && Number(payload.assessmentScore) > 100) {
      throw new BadRequestException('assessmentScore phai tu 0 den 100');
    }

    if (payload.maxStudents !== undefined && Number(payload.maxStudents) < 1) {
      throw new BadRequestException('maxStudents phai toi thieu 1');
    }

    if (actionKey === AiActionKey.CREATE_CLASS && payload.classMode !== undefined) {
      if (!['ONLINE', 'OFFLINE'].includes(String(payload.classMode))) {
        throw new BadRequestException('classMode phai la ONLINE hoac OFFLINE');
      }
    }

    if (payload.source !== undefined) {
      if (!['FACEBOOK', 'GOOGLE', 'TIKTOK', 'ZALO', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'OTHER'].includes(String(payload.source))) {
        throw new BadRequestException('source lead khong hop le');
      }
    }

    if (payload.status !== undefined) {
      if ([AiActionKey.PAUSE_AD_GROUP, AiActionKey.RESUME_AD_GROUP].includes(actionKey)) {
        if (!['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(String(payload.status))) {
          throw new BadRequestException('status ad group khong hop le');
        }
      } else if (actionKey === AiActionKey.UPDATE_LEAD) {
        if (!['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED', 'CONVERTED', 'NOT_INTERESTED', 'NO_RESPONSE'].includes(String(payload.status))) {
          throw new BadRequestException('status lead khong hop le');
        }
      } else if (actionKey === AiActionKey.MARK_ATTENDANCE) {
        if (!['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(String(payload.status))) {
          throw new BadRequestException('status attendance khong hop le');
        }
      } else if (actionKey === AiActionKey.UPDATE_TRIAL_ENROLLMENT) {
        if (!['PENDING_TRIAL', 'WAITING_DECISION', 'CONVERTED', 'REJECTED'].includes(String(payload.status))) {
          throw new BadRequestException('status trial enrollment khong hop le');
        }
      }
    }

    if (payload.platform !== undefined) {
      if (!['FACEBOOK', 'GOOGLE', 'TIKTOK'].includes(String(payload.platform))) {
        throw new BadRequestException('platform ads khong hop le');
      }
    }

    if (actionKey === AiActionKey.PAUSE_AD_GROUP && payload.status !== 'PAUSED') {
      throw new BadRequestException('PAUSE_AD_GROUP chi duoc dat status=PAUSED');
    }

    if (actionKey === AiActionKey.RESUME_AD_GROUP && payload.status !== 'ACTIVE') {
      throw new BadRequestException('RESUME_AD_GROUP chi duoc dat status=ACTIVE');
    }

    for (const field of ['startDate', 'endDate', 'effectiveDate', 'date', 'newScheduledDate', 'testDate', 'decisionAt']) {
      if (payload[field] !== undefined && Number.isNaN(Date.parse(String(payload[field])))) {
        throw new BadRequestException(`${field} khong phai ngay hop le`);
      }
    }

    for (const field of ['newStartTime', 'newEndTime', 'testStartTime', 'testEndTime']) {
      if (payload[field] !== undefined && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(payload[field]))) {
        throw new BadRequestException(`${field} phai co dinh dang HH:mm`);
      }
    }

    if (payload.startDate !== undefined && payload.endDate !== undefined) {
      if (Date.parse(String(payload.startDate)) > Date.parse(String(payload.endDate))) {
        throw new BadRequestException('startDate khong duoc sau endDate');
      }
    }

    if (payload.method !== undefined) {
      if (!['CALL', 'ZALO', 'EMAIL', 'MEET', 'SMS', 'OTHER'].includes(String(payload.method))) {
        throw new BadRequestException('method lien he khong hop le');
      }
    }

    if (payload.type !== undefined) {
      if (!['DISPUTE', 'REFUND_REQUEST', 'TEACHER_COMPLAINT', 'PARENT_COMPLAINT', 'SCHEDULE_ISSUE', 'PAYMENT_ISSUE', 'SUBSTITUTE_TEACHER', 'OTHER'].includes(String(payload.type))) {
        throw new BadRequestException('type ticket khong hop le');
      }
    }

    if (payload.priority !== undefined) {
      if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(String(payload.priority))) {
        throw new BadRequestException('priority ticket khong hop le');
      }
    }

    if (payload.content !== undefined && String(payload.content).trim().length < 1) {
      throw new BadRequestException('content khong duoc de trong');
    }

    for (const field of ['feedback', 'manualFeedback']) {
      if (payload[field] !== undefined) {
        const text = String(payload[field]).trim();
        if (text.length < 3) {
          throw new BadRequestException(`${field} can co nhan xet cu the hon`);
        }
        if (text.length > 2000) {
          throw new BadRequestException(`${field} khong duoc vuot qua 2000 ky tu`);
        }
      }
    }
  }

  private normalizePayload(payload: Record<string, unknown>) {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') {
        normalized[key] = value.trim();
      } else {
        normalized[key] = value;
      }
    }
    return normalized;
  }
}
