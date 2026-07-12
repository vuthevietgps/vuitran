import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';

export type AiCoreOperation =
  | 'READ_SUMMARY'
  | 'READ_DETAIL'
  | 'DRAFT_ONLY'
  | 'WRITE_PREVIEW'
  | 'WRITE_EXECUTE'
  | 'EXPORT_PREVIEW';

export type AiCoreDataScope =
  | 'GLOBAL'
  | 'ROLE_SCOPE'
  | 'OWN_RECORDS'
  | 'OWN_CHILDREN'
  | 'ASSIGNED_RECORDS'
  | 'NO_DATABASE';

export type AiCoreRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export enum AiEntityType {
  AUTO = 'auto',
  USER = 'user',
  PARENT = 'parent',
  TEACHER = 'teacher',
  STUDENT = 'student',
  CLASS = 'class',
  INVOICE = 'invoice',
  ORDER = 'order',
  LEAD = 'lead',
  TICKET = 'ticket',
  SESSION = 'session',
  ATTENDANCE = 'attendance',
  TRIAL_ENROLLMENT = 'trial_enrollment',
  QUIZ_ATTEMPT = 'quiz_attempt',
  TEACHING_MATERIAL = 'teaching_material',
  AD_GROUP = 'ad_group',
}

export type AiEntityResolutionStatus = 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND';
export type AiEntityConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export enum AiActionKey {
  CREATE_STUDENT = 'CREATE_STUDENT',
  UPDATE_STUDENT = 'UPDATE_STUDENT',
  CREATE_CLASS = 'CREATE_CLASS',
  UPDATE_CLASS = 'UPDATE_CLASS',
  CREATE_LEAD = 'CREATE_LEAD',
  UPDATE_LEAD = 'UPDATE_LEAD',
  ADD_LEAD_CONTACT = 'ADD_LEAD_CONTACT',
  CREATE_TICKET = 'CREATE_TICKET',
  UPDATE_TICKET = 'UPDATE_TICKET',
  ADD_TICKET_COMMENT = 'ADD_TICKET_COMMENT',
  FINALIZE_SESSION = 'FINALIZE_SESSION',
  CANCEL_SESSION = 'CANCEL_SESSION',
  RESCHEDULE_SESSION = 'RESCHEDULE_SESSION',
  MARK_SESSION_NO_SHOW = 'MARK_SESSION_NO_SHOW',
  MARK_ATTENDANCE = 'MARK_ATTENDANCE',
  UPDATE_TRIAL_ENROLLMENT = 'UPDATE_TRIAL_ENROLLMENT',
  ADJUST_AD_BUDGET = 'ADJUST_AD_BUDGET',
  PAUSE_AD_GROUP = 'PAUSE_AD_GROUP',
  RESUME_AD_GROUP = 'RESUME_AD_GROUP',
  CREATE_AD_GROUP_DRAFT = 'CREATE_AD_GROUP_DRAFT',
  SYNC_AD_COSTS = 'SYNC_AD_COSTS',
  GRADE_HOMEWORK = 'GRADE_HOMEWORK',
  GRADE_QUIZ_ATTEMPT = 'GRADE_QUIZ_ATTEMPT',
}

export enum AiActionDraftStatus {
  PENDING_CONFIRMATION = 'PENDING_CONFIRMATION',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  EXECUTED = 'EXECUTED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export type AiBusinessCapability =
  | 'DAILY_WORK'
  | 'EXECUTIVE_OVERVIEW'
  | 'FINANCE_CONTROL'
  | 'INVOICE_WALLET'
  | 'PAYROLL_COMPENSATION'
  | 'SALES_CRM'
  | 'LEARNING_OPERATIONS'
  | 'SUPPORT_TICKETS'
  | 'ADS_MARKETING'
  | 'HR_TEACHERS'
  | 'LEARNING_CONTENT'
  | 'COMMUNICATION_EXPORT'
  | 'ADMIN_SECURITY'
  | 'PROCUREMENT_OPEX'
  | 'SYSTEM_GUIDE';

export interface AiToolDefinition {
  key: string;
  capability: AiBusinessCapability;
  label: string;
  businessName: string;
  businessMeaning: string;
  route: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'STATIC';
  serviceMethod: string;
  operation: AiCoreOperation;
  allowedRoles: readonly Role[];
  allowedAssistantTypes: readonly AiAssistantType[];
  dataScope: AiCoreDataScope;
  inputSchemaSummary: string;
  outputSchemaSummary: string;
  defaultFilters: {
    dateRange?: 'none' | 'current_day' | 'current_month' | 'service_default' | 'static';
    limit?: number;
    status?: readonly string[];
  };
  contextPolicy: string;
  writePolicy: string;
  riskLevel: AiCoreRiskLevel;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  requiresAudit: boolean;
  enabled: boolean;
}

export interface AiSituationDefinition {
  key: string;
  capability: AiBusinessCapability;
  userIntent: string;
  examples: readonly string[];
  triggerKeywords: readonly string[];
  allowedAssistantTypes: readonly AiAssistantType[];
  allowedRoles: readonly Role[];
  operation: AiCoreOperation;
  dataScope: AiCoreDataScope;
  defaultWorkflow: string;
  candidateTools: readonly string[];
  requiredEntities: readonly string[];
  contextPolicy: string;
  missingDataPolicy: string;
  writePolicy: string;
  riskLevel: AiCoreRiskLevel;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  requiresAudit: boolean;
}

export interface AiAuthContext {
  user: JwtPayload;
  assistantType: AiAssistantType;
}

export interface AiToolInput {
  fromDate?: string;
  toDate?: string;
  filters?: Record<string, unknown>;
  entityContext?: {
    type: string;
    id: string;
  };
}

export interface AiToolResult {
  key: string;
  label: string;
  sourceRoute: string;
  data: unknown;
  metadata: {
    truncated: boolean;
    totalItems?: number;
    shownItems?: number;
    warnings?: string[];
  };
}

export interface AiOpenAIConfig {
  key: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptPrefix?: string;
  source: 'DB_TOKEN' | 'ENV';
}

export interface AiOpenAIUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedPromptTokens?: number;
  estimatedCompletionTokens?: number;
  estimatedTotalTokens?: number;
}

export interface AiOpenAIResult {
  content: string;
  model: string;
  latencyMs: number;
  usage: AiOpenAIUsage;
}

export interface AiEntityCandidate {
  type: Exclude<AiEntityType, AiEntityType.AUTO>;
  id: string;
  label: string;
  code?: string;
  score: number;
  confidence: AiEntityConfidence;
  matchedFields: string[];
  summary: Record<string, unknown>;
}

export interface AiEntityResolution {
  query: string;
  normalizedQuery: string;
  requestedType: AiEntityType;
  status: AiEntityResolutionStatus;
  candidates: AiEntityCandidate[];
  selected?: AiEntityCandidate;
  needsConfirmation: boolean;
  message?: string;
}

export interface AiActionDiffItem {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface AiActionPreview {
  actionKey: AiActionKey;
  entityType: AiEntityType;
  entityId?: string;
  payload: Record<string, unknown>;
  before?: Record<string, unknown>;
  diff: AiActionDiffItem[];
  riskLevel: AiCoreRiskLevel;
  requiresConfirmation: boolean;
  requiresApproval: boolean;
  warnings: string[];
}
