import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export enum TicketType {
  DISPUTE = 'DISPUTE',
  REFUND_REQUEST = 'REFUND_REQUEST',
  TEACHER_COMPLAINT = 'TEACHER_COMPLAINT',
  PARENT_COMPLAINT = 'PARENT_COMPLAINT',
  SCHEDULE_ISSUE = 'SCHEDULE_ISSUE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  SUBSTITUTE_TEACHER = 'SUBSTITUTE_TEACHER',
  OTHER = 'OTHER',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_INFO = 'WAITING_INFO',
  WAITING_REFUND = 'WAITING_REFUND',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const TICKET_TYPE_LABELS: Record<string, string> = {
  [TicketType.DISPUTE]: 'Tranh ch\u1EA5p bu\u1ED5i h\u1ECDc',
  [TicketType.REFUND_REQUEST]: 'Y\u00EAu c\u1EA7u ho\u00E0n ti\u1EC1n',
  [TicketType.TEACHER_COMPLAINT]: 'Khi\u1EBFu n\u1EA1i gi\u00E1o vi\u00EAn',
  [TicketType.PARENT_COMPLAINT]: 'Khi\u1EBFu n\u1EA1i ph\u1EE5 huynh',
  [TicketType.SCHEDULE_ISSUE]: 'V\u1EA5n \u0111\u1EC1 l\u1ECBch h\u1ECDc',
  [TicketType.PAYMENT_ISSUE]: 'V\u1EA5n \u0111\u1EC1 thanh to\u00E1n',
  [TicketType.SUBSTITUTE_TEACHER]: 'GV d\u1EA1y thay',
  [TicketType.OTHER]: 'Kh\u00E1c',
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  [TicketStatus.OPEN]: 'M\u1EDBi t\u1EA1o',
  [TicketStatus.IN_PROGRESS]: '\u0110ang x\u1EED l\u00FD',
  [TicketStatus.WAITING_INFO]: 'Ch\u1EDD th\u00F4ng tin',
  [TicketStatus.WAITING_REFUND]: 'Ch\u1EDD ho\u00E0n ti\u1EC1n',
  [TicketStatus.RESOLVED]: '\u0110\u00E3 gi\u1EA3i quy\u1EBFt',
  [TicketStatus.CLOSED]: '\u0110\u00E3 \u0111\u00F3ng',
  [TicketStatus.CANCELLED]: '\u0110\u00E3 h\u1EE7y',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  [TicketPriority.LOW]: 'Th\u1EA5p',
  [TicketPriority.MEDIUM]: 'Trung b\u00ECnh',
  [TicketPriority.HIGH]: 'Cao',
  [TicketPriority.URGENT]: 'Kh\u1EA9n c\u1EA5p',
};

export interface TicketItem {
  _id: string;
  ticketCode: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  createdBy: { _id: string; fullName: string; email: string; role: string };
  createdByRole: string;
  assignedTo?: { _id: string; fullName: string; email: string };
  sessionId?: any;
  classId?: any;
  studentId?: any;
  teacherId?: any;
  parentId?: any;
  sourceConversationId?: string | { _id: string };
  resolution?: {
    summary: string;
    outcome: string;
    refundAmount: number;
    refundLedgerEntryId?: string | { _id: string };
    refundPaidAt?: string;
    refundPaidBy?: { _id: string; fullName: string };
    resolvedBy?: { _id: string; fullName: string };
    resolvedAt: string;
  };
  attachments: string[];
  dueDate?: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  _id: string;
  ticketId: string;
  userId: { _id: string; fullName: string; email: string; role: string };
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
}

export interface TicketStats {
  byStatus: { _id: string; count: number }[];
  byType: { _id: string; count: number }[];
  byPriority: { _id: string; count: number }[];
  overdueCount: number;
}

export interface TicketListResult {
  data: TicketItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly base = `${environment.apiBase}/tickets`;
  private readonly http = inject(HttpClient);

  private buildParams(params: Record<string, any>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  async findAll(params: Record<string, string> = {}): Promise<TicketListResult> {
    return firstValueFrom(
      this.http.get<TicketListResult>(this.base, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  async getMyTickets(params: Record<string, string> = {}): Promise<TicketListResult> {
    return firstValueFrom(
      this.http.get<TicketListResult>(`${this.base}/my-tickets`, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  async getAssignedToMe(params: Record<string, string> = {}): Promise<TicketListResult> {
    return firstValueFrom(
      this.http.get<TicketListResult>(`${this.base}/assigned-to-me`, {
        params: this.buildParams(params),
        withCredentials: true,
      }),
    );
  }

  async findById(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.get<TicketItem>(`${this.base}/${id}`, { withCredentials: true }),
    );
  }

  async create(data: any): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(this.base, data, { withCredentials: true }),
    );
  }

  async update(id: string, data: any): Promise<TicketItem> {
    return firstValueFrom(
      this.http.patch<TicketItem>(`${this.base}/${id}`, data, { withCredentials: true }),
    );
  }

  async getComments(ticketId: string): Promise<TicketComment[]> {
    try {
      return await firstValueFrom(
        this.http.get<TicketComment[]>(`${this.base}/${ticketId}/comments`, {
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async addComment(
    ticketId: string,
    data: { content: string; isInternal?: boolean },
  ): Promise<TicketComment> {
    return firstValueFrom(
      this.http.post<TicketComment>(`${this.base}/${ticketId}/comments`, data, {
        withCredentials: true,
      }),
    );
  }

  async startProcessing(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/start`, {}, { withCredentials: true }),
    );
  }

  async requestInfo(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/request-info`, {}, { withCredentials: true }),
    );
  }

  async resolve(
    id: string,
    data: { summary: string; outcome: string; refundAmount?: number },
  ): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/resolve`, data, {
        withCredentials: true,
      }),
    );
  }

  async close(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/close`, {}, { withCredentials: true }),
    );
  }

  async cancel(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/cancel`, {}, { withCredentials: true }),
    );
  }

  async reopen(id: string): Promise<TicketItem> {
    return firstValueFrom(
      this.http.post<TicketItem>(`${this.base}/${id}/reopen`, {}, { withCredentials: true }),
    );
  }

  async getStats(): Promise<TicketStats> {
    return firstValueFrom(
      this.http.get<TicketStats>(`${this.base}/stats`, { withCredentials: true }),
    );
  }
}
