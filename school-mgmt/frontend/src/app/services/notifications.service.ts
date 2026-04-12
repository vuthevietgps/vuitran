import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

export type NotificationPriorityValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type NotificationRecipientGroup =
  | 'PARENTS'
  | 'TEACHERS'
  | 'SALES'
  | 'OPS'
  | 'ACCOUNTING'
  | 'ALL_STAFF';

export interface NotificationPreferences {
  enableEmailNotif: boolean;
  enableZaloNotif: boolean;
  enableSmsNotif: boolean;
  phone: string;
}

export interface BulkNotificationPayload {
  recipientGroup: NotificationRecipientGroup;
  title: string;
  message: string;
  priority?: NotificationPriorityValue;
  link?: string;
}

export interface BulkNotificationPreview {
  recipientGroup: NotificationRecipientGroup;
  recipientLabel: string;
  title: string;
  message: string;
  priority: NotificationPriorityValue;
  link?: string;
  channels: string[];
  totalRecipients: number;
  sampleRecipients: Array<{
    recipientId: string;
    fullName: string;
    role: string;
    email?: string;
  }>;
}

export interface BulkNotificationResult extends BulkNotificationPreview {
  successCount: number;
  failedCount: number;
  errors: Array<{
    recipientId: string;
    recipientName: string;
    recipientRole: string;
    error: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/notifications`;

  getMyNotifications(params: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
    const query: Record<string, string> = {};
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    if (params.unreadOnly) query['unreadOnly'] = 'true';
    return firstValueFrom(this.http.get<any>(this.base, { params: query }));
  }

  getUnreadCount() {
    return firstValueFrom(this.http.get<{ count: number }>(`${this.base}/unread-count`));
  }

  markAsRead(id: string) {
    return firstValueFrom(this.http.patch<any>(`${this.base}/${id}/read`, {}));
  }

  markAllAsRead() {
    return firstValueFrom(this.http.patch<any>(`${this.base}/mark-all-read`, {}));
  }

  getPreferences() {
    return firstValueFrom(this.http.get<NotificationPreferences>(`${this.base}/preferences`));
  }

  updatePreferences(payload: Partial<NotificationPreferences>) {
    return firstValueFrom(this.http.patch<{ success: boolean }>(`${this.base}/preferences`, payload));
  }

  previewBulkNotification(payload: BulkNotificationPayload) {
    return firstValueFrom(this.http.post<BulkNotificationPreview>(`${this.base}/bulk-preview`, payload));
  }

  sendBulkNotification(payload: BulkNotificationPayload) {
    return firstValueFrom(this.http.post<BulkNotificationResult>(`${this.base}/bulk-send`, payload));
  }
}
