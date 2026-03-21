import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

// ─── Interfaces ───────────────────────────────────────────

export interface FanpageItem {
  _id: string;
  fanpageCode: string;
  name: string;
  platform: string;
  pageId: string;
  pageAccessToken?: string;
  description?: string;
  syncSource?: string;
  businessId?: string;
  businessName?: string;
  syncTokenId?: string;
  syncTokenLabel?: string;
  lastSyncedAt?: string;
  adAccountId?: string;
  adAccountName?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
  openaiTokenId?: string;
  openaiTokenLabel?: string;
  openaiModel?: string;
  status: string;
  aiAutoReplyEnabled: boolean;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenAITokenItem {
  _id: string;
  label: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPromptPrefix?: string;
  status: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface AiAssistantProfileItem {
  _id: string;
  assistantType: string;
  label: string;
  description?: string;
  rulesPrompt?: string;
  defaultOpenAITokenId?: string;
  defaultOpenAITokenLabel?: string;
  defaultOpenAIModel?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationItem {
  _id: string;
  conversationCode: string;
  fanpageId: string;
  fanpageName?: string;
  platform: string;
  platformUserId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  lastMessageAt?: string;
  messageCount?: number;
  adRefParam?: string;
  adGroupId?: string;
  adGroupName?: string;
  leadId?: string;
  orderId?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageItem {
  _id: string;
  conversationId: string;
  senderType: string;
  senderName?: string;
  senderUserId?: string;
  content: string;
  platformMessageId?: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private apiUrl = `${environment.apiBase}/chatbot`;

  constructor(private http: HttpClient) {}

  private buildParams(params?: Record<string, string>): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return httpParams;
  }

  // ─── Fanpages ───────────────────────────────────────────────

  async listFanpages(params?: Record<string, string>): Promise<PaginatedResponse<FanpageItem>> {
    return this.http.get<PaginatedResponse<FanpageItem>>(
      `${this.apiUrl}/fanpages`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<FanpageItem>>;
  }

  async getFanpage(id: string): Promise<FanpageItem> {
    return this.http.get<FanpageItem>(
      `${this.apiUrl}/fanpages/${id}`,
    ).toPromise() as Promise<FanpageItem>;
  }

  async createFanpage(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/fanpages`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Tạo fanpage thất bại' };
    }
  }

  async updateFanpage(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/fanpages/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cập nhật thất bại' };
    }
  }

  async deleteFanpage(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/fanpages/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xóa thất bại' };
    }
  }

  // ─── OpenAI Tokens ──────────────────────────────────────────

  async listOpenAITokens(): Promise<OpenAITokenItem[]> {
    return this.http.get<OpenAITokenItem[]>(
      `${this.apiUrl}/openai-tokens`,
    ).toPromise() as Promise<OpenAITokenItem[]>;
  }

  async createOpenAIToken(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/openai-tokens`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Tạo token thất bại' };
    }
  }

  async updateOpenAIToken(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/openai-tokens/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cập nhật thất bại' };
    }
  }

  async deleteOpenAIToken(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/openai-tokens/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xóa thất bại' };
    }
  }

  // ─── Conversations ──────────────────────────────────────────

  async listAiAssistantProfiles(): Promise<AiAssistantProfileItem[]> {
    return this.http.get<AiAssistantProfileItem[]>(
      `${this.apiUrl}/ai-assistant-profiles`,
    ).toPromise() as Promise<AiAssistantProfileItem[]>;
  }

  async createAiAssistantProfile(data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/ai-assistant-profiles`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Tao AI profile that bai' };
    }
  }

  async updateAiAssistantProfile(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/ai-assistant-profiles/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cap nhat AI profile that bai' };
    }
  }

  async deleteAiAssistantProfile(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.delete(`${this.apiUrl}/ai-assistant-profiles/${id}`).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Xoa AI profile that bai' };
    }
  }

  async listConversations(params?: Record<string, string>): Promise<PaginatedResponse<ConversationItem>> {
    return this.http.get<PaginatedResponse<ConversationItem>>(
      `${this.apiUrl}/conversations`, { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<ConversationItem>>;
  }

  async getConversation(id: string): Promise<ConversationItem> {
    return this.http.get<ConversationItem>(
      `${this.apiUrl}/conversations/${id}`,
    ).toPromise() as Promise<ConversationItem>;
  }

  async updateConversation(id: string, data: any): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.patch(`${this.apiUrl}/conversations/${id}`, data).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Cập nhật thất bại' };
    }
  }

  async takeoverConversation(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/conversations/${id}/takeover`, {}).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Tiếp quản thất bại' };
    }
  }

  async releaseConversation(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/conversations/${id}/release`, {}).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Trả AI thất bại' };
    }
  }

  // ─── Messages ───────────────────────────────────────────────

  async getMessages(conversationId: string, params?: Record<string, string>): Promise<PaginatedResponse<MessageItem>> {
    return this.http.get<PaginatedResponse<MessageItem>>(
      `${this.apiUrl}/conversations/${conversationId}/messages`,
      { params: this.buildParams(params) },
    ).toPromise() as Promise<PaginatedResponse<MessageItem>>;
  }

  async sendMessage(conversationId: string, content: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.http.post(`${this.apiUrl}/conversations/${conversationId}/messages`, { content }).toPromise();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Gửi tin nhắn thất bại' };
    }
  }

  // ─── Lead/Order from Conversation ───────────────────────────

  async createLeadFromConversation(conversationId: string, data: any): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const result = await this.http.post<any>(
        `${this.apiUrl}/conversations/${conversationId}/create-lead`, data,
      ).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Tạo lead thất bại' };
    }
  }

  async createOrderFromConversation(conversationId: string, data: any): Promise<{ ok: boolean; message?: string; data?: any }> {
    try {
      const result = await this.http.post<any>(
        `${this.apiUrl}/conversations/${conversationId}/create-order`, data,
      ).toPromise();
      return { ok: true, data: result };
    } catch (err: any) {
      return { ok: false, message: err.error?.message || 'Tạo đơn hàng thất bại' };
    }
  }
}
