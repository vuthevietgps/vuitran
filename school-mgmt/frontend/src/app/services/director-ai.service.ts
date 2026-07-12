import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type AiAssistantType =
  | 'DIRECTOR_OPERATIONS'
  | 'ACCOUNTING_OPERATIONS'
  | 'OPS_OPERATIONS'
  | 'TEACHER_SUPPORT'
  | 'EXPERIENCE_TEACHER_SUPPORT'
  | 'PARENT_SUPPORT'
  | 'STUDENT_SUPPORT'
  | 'SALE_OPERATIONS'
  | 'ADS_OPERATIONS'
  | 'SHAREHOLDER_INSIGHTS'
  | 'INTERNAL_SUPPORT'
  | 'LEAD_CARE';

export type DirectorAiContextMode =
  | 'AUTO'
  | 'OVERVIEW'
  | 'FINANCE'
  | 'ACCOUNTING'
  | 'OPERATIONS'
  | 'SALES'
  | 'HR'
  | 'GUIDE';

export interface DirectorAiChatPayload {
  message: string;
  assistantType?: AiAssistantType;
  sessionId?: string;
  fromDate?: string;
  toDate?: string;
  contextMode?: DirectorAiContextMode;
  filters?: Record<string, unknown>;
  activeRoute?: string;
  entityContext?: {
    type: string;
    id: string;
  };
  actionDraft?: {
    actionKey: string;
    entityType?: string;
    entityId?: string;
    payload: Record<string, unknown>;
  };
}

export interface DirectorAiContextPlanItem {
  key: string;
  label: string;
  businessMeaning?: string;
  endpoint?: string;
  route?: string;
  serviceMethod?: string;
  riskLevel: string;
  operation?: string;
  requiresConfirmation?: boolean;
  requiresApproval?: boolean;
  dataPolicy: string;
  dateRange?: {
    fromDate: string;
    toDate: string;
  };
}

export interface DirectorAiChatResponse {
  sessionId: string;
  messageId: string;
  assistantType?: AiAssistantType;
  answer: string;
  source: 'AI_API' | 'FALLBACK' | 'ACTION_DRAFT';
  contextKeys: string[];
  toolKeys?: string[];
  contextPlan: DirectorAiContextPlanItem[];
  tokenConfigured: boolean;
  aiError?: string;
  actionDraft?: Record<string, any>;
}

export type DirectorAiActionResponse = Record<string, any>;

export interface DirectorAiMessageItem {
  _id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  contextKeys?: string[];
  toolKeys?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface DirectorAiSessionItem {
  _id: string;
  title: string;
  lastContextKeys?: string[];
  lastToolKeys?: string[];
  lastMessageAt?: string;
  updatedAt: string;
}

export type AiFeedbackCategory =
  | 'WRONG_DATA'
  | 'MISSING_CONTEXT'
  | 'BAD_ACTION'
  | 'BAD_TONE'
  | 'UNSAFE'
  | 'TOO_GENERIC'
  | 'OTHER';

export type AiFeedbackSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AiActionDraftStatus =
  | 'PENDING_CONFIRMATION'
  | 'PENDING_APPROVAL'
  | 'EXECUTED'
  | 'REJECTED'
  | 'FAILED'
  | 'EXPIRED';

export interface AiFeedbackPayload {
  source: 'AI_CORE' | 'DIRECTOR_AI' | 'PARENT_SUPPORT' | 'CHATBOT_AUTO_REPLY' | 'OTHER';
  assistantType?: string;
  sessionId?: string;
  messageId?: string;
  activeRoute?: string;
  contextKeys?: string[];
  toolKeys?: string[];
  userMessage?: string;
  assistantAnswer?: string;
  category?: AiFeedbackCategory;
  severity?: AiFeedbackSeverity;
  reason?: string;
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class DirectorAiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/ai`;
  private readonly feedbackBase = `${environment.apiBase}/ai-feedback`;
  private readonly defaultAssistantType: AiAssistantType = 'DIRECTOR_OPERATIONS';

  chat(payload: DirectorAiChatPayload) {
    return firstValueFrom(
      this.http.post<any>(`${this.base}/chat`, {
        ...payload,
        assistantType: payload.assistantType || this.defaultAssistantType,
      }),
    ).then((response) => this.mapChatResponse(response));
  }

  listSessions(assistantType: AiAssistantType = this.defaultAssistantType) {
    return firstValueFrom(
      this.http.get<{ data: any[] }>(`${this.base}/sessions`, {
        params: { assistantType },
      }),
    ).then((response) => ({
      data: (response.data || []).map((item) => this.mapSession(item)),
    }));
  }

  getMessages(sessionId: string, limit = 50) {
    return firstValueFrom(
      this.http.get<{ data: any[] }>(`${this.base}/messages`, {
        params: { sessionId, limit },
      }),
    ).then((response) => ({
      data: (response.data || []).map((item) => this.mapMessage(item)),
    }));
  }

  getToolCatalog(assistantType: AiAssistantType = this.defaultAssistantType) {
    return firstValueFrom(
      this.http.get<any[]>(`${this.base}/tools`, {
        params: { assistantType },
      }),
    ).then((tools) => tools.map((tool) => this.mapToolPlanItem(tool)));
  }

  listActionDrafts(
    assistantType: AiAssistantType = this.defaultAssistantType,
    limit = 50,
    status?: AiActionDraftStatus,
  ) {
    const params: Record<string, string> = {
      assistantType,
      limit: String(limit),
    };
    if (status) params['status'] = status;

    return firstValueFrom(
      this.http.get<{ data: DirectorAiActionResponse[] }>(`${this.base}/actions`, { params }),
    ).then((response) => ({
      data: response.data || [],
    }));
  }

  listApprovalActionDrafts(
    assistantType: AiAssistantType = this.defaultAssistantType,
    limit = 50,
    status?: AiActionDraftStatus,
  ) {
    const params: Record<string, string> = {
      assistantType,
      limit: String(limit),
    };
    if (status) params['status'] = status;

    return firstValueFrom(
      this.http.get<{ data: DirectorAiActionResponse[] }>(`${this.base}/actions/approvals`, { params }),
    ).then((response) => ({
      data: response.data || [],
    }));
  }

  submitFeedback(payload: AiFeedbackPayload) {
    return firstValueFrom(
      this.http.post<{ id: string; status: string; duplicateMerged?: boolean }>(
        this.feedbackBase,
        payload,
      ),
    );
  }

  confirmActionDraft(id: string, confirmationText?: string) {
    return firstValueFrom(
      this.http.post<DirectorAiActionResponse>(`${this.base}/actions/${id}/confirm`, {
        confirmationText,
      }),
    );
  }

  rejectActionDraft(id: string, reason?: string) {
    return firstValueFrom(
      this.http.post<DirectorAiActionResponse>(`${this.base}/actions/${id}/reject`, {
        reason,
      }),
    );
  }

  approveActionDraft(id: string, approvalNote?: string) {
    return firstValueFrom(
      this.http.post<DirectorAiActionResponse>(`${this.base}/actions/${id}/approve`, {
        approvalNote,
      }),
    );
  }

  private mapChatResponse(response: any): DirectorAiChatResponse {
    const toolKeys = response?.toolKeys || response?.contextKeys || [];
    return {
      ...response,
      contextKeys: toolKeys,
      toolKeys,
      contextPlan: (response?.contextPlan || []).map((item: any) => this.mapToolPlanItem(item)),
      tokenConfigured: Boolean(response?.tokenConfigured),
    };
  }

  private mapSession(item: any): DirectorAiSessionItem {
    const lastToolKeys = item?.lastToolKeys || item?.lastContextKeys || [];
    return {
      ...item,
      lastContextKeys: lastToolKeys,
      lastToolKeys,
    };
  }

  private mapMessage(item: any): DirectorAiMessageItem {
    const toolKeys = item?.toolKeys || item?.contextKeys || [];
    return {
      ...item,
      contextKeys: toolKeys,
      toolKeys,
    };
  }

  private mapToolPlanItem(item: any): DirectorAiContextPlanItem {
    return {
      ...item,
      endpoint: item?.endpoint || item?.route,
      route: item?.route || item?.endpoint,
      dataPolicy: item?.dataPolicy || item?.contextPolicy || item?.dataScope || '',
      riskLevel: item?.riskLevel || 'LOW',
    };
  }
}
