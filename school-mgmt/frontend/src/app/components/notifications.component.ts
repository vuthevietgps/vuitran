import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {
  type BulkNotificationPayload,
  type BulkNotificationPreview,
  type BulkNotificationResult,
  type NotificationPriorityValue,
  type NotificationRecipientGroup,
  NotificationsService,
} from '../services/notifications.service';
import { Role, ROLE_LABELS } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  type: string;
  priority: NotificationPriorityValue;
  isRead: boolean;
  createdAt: string;
  link?: string;
};

type BulkFormState = {
  recipientGroup: NotificationRecipientGroup;
  title: string;
  message: string;
  priority: NotificationPriorityValue;
  link: string;
};

const BULK_GROUP_OPTIONS: Array<{ value: NotificationRecipientGroup; label: string }> = [
  { value: 'PARENTS', label: 'Phụ huynh' },
  { value: 'TEACHERS', label: 'Giáo viên' },
  { value: 'SALES', label: 'Sale' },
  { value: 'OPS', label: 'Vận hành' },
  { value: 'ACCOUNTING', label: 'Kế toán' },
  { value: 'ALL_STAFF', label: 'Toàn bộ nhân sự nội bộ' },
];

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
    <app-flow-guide featureKey="notifications"></app-flow-guide>

    <div class="container">
      <div class="header-row">
        <h2>&#128276; Thông báo</h2>
        <div class="header-actions">
          <span class="unread-badge" *ngIf="unreadCount > 0">{{ unreadCount }} chưa đọc</span>
          <button class="btn-mark-all" (click)="markAllRead()" *ngIf="unreadCount > 0">
            &#10003; Đánh dấu tất cả đã đọc
          </button>
          <select [(ngModel)]="filterMode" (change)="loadNotifications()" class="filter-select">
            <option value="all">Tất cả</option>
            <option value="unread">Chưa đọc</option>
          </select>
        </div>
      </div>

      <section
        *ngIf="canSendBulkNotifications"
        class="bulk-card"
        data-testid="bulk-notification-card">
        <div class="bulk-card-header">
          <div>
            <h3>Gửi thông báo hàng loạt</h3>
            <p>Admin/OPS có thể preview nội dung trước khi xác nhận gửi đúng nhóm nhận.</p>
          </div>
        </div>

        <div class="bulk-grid">
          <label class="form-field">
            <span>Nhóm nhận</span>
            <select
              [(ngModel)]="bulkForm.recipientGroup"
              (ngModelChange)="resetBulkWorkflow()"
              class="bulk-select"
              data-testid="bulk-recipient-group">
              <option *ngFor="let option of bulkGroupOptions" [value]="option.value">{{ option.label }}</option>
            </select>
          </label>

          <label class="form-field">
            <span>Mức ưu tiên</span>
            <select
              [(ngModel)]="bulkForm.priority"
              (ngModelChange)="resetBulkWorkflow()"
              class="bulk-select"
              data-testid="bulk-priority">
              <option value="LOW">Thấp</option>
              <option value="MEDIUM">Trung bình</option>
              <option value="HIGH">Quan trọng</option>
              <option value="URGENT">Khẩn cấp</option>
            </select>
          </label>

          <label class="form-field full-width">
            <span>Tiêu đề</span>
            <input
              [(ngModel)]="bulkForm.title"
              (ngModelChange)="resetBulkWorkflow()"
              class="bulk-input"
              data-testid="bulk-title"
              placeholder="Ví dụ: Lịch nghỉ lễ 30/4" />
          </label>

          <label class="form-field full-width">
            <span>Nội dung</span>
            <textarea
              [(ngModel)]="bulkForm.message"
              (ngModelChange)="resetBulkWorkflow()"
              class="bulk-textarea"
              data-testid="bulk-message"
              rows="4"
              placeholder="Nhập nội dung cần gửi tới nhóm nhận"></textarea>
          </label>

          <label class="form-field full-width">
            <span>Link đính kèm</span>
            <input
              [(ngModel)]="bulkForm.link"
              (ngModelChange)="resetBulkWorkflow()"
              class="bulk-input"
              data-testid="bulk-link"
              placeholder="/app/notifications" />
          </label>
        </div>

        <div class="bulk-actions">
          <button
            class="btn-preview"
            (click)="previewBulkNotification()"
            [disabled]="!canPreviewBulk || previewLoading"
            data-testid="bulk-preview-button">
            {{ previewLoading ? 'Đang preview...' : 'Preview' }}
          </button>
          <button
            class="btn-confirm"
            (click)="confirmBulkSend()"
            [disabled]="!bulkPreview || bulkPreview.totalRecipients === 0 || sendingBulk"
            data-testid="bulk-confirm-button">
            {{ sendingBulk ? 'Đang gửi...' : 'Xác nhận gửi' }}
          </button>
        </div>

        <p class="bulk-error" *ngIf="bulkError" data-testid="bulk-error">{{ bulkError }}</p>

        <div *ngIf="bulkPreview" class="bulk-preview" data-testid="bulk-preview-panel">
          <div class="preview-meta">
            <span class="preview-chip" data-testid="bulk-preview-group">{{ bulkPreview.recipientLabel }}</span>
            <span class="preview-chip" data-testid="bulk-preview-total">{{ bulkPreview.totalRecipients }} người nhận</span>
            <span class="preview-chip" data-testid="bulk-preview-priority">{{ getPriorityLabel(bulkPreview.priority) }}</span>
          </div>
          <div class="preview-title" data-testid="bulk-preview-title">{{ bulkPreview.title }}</div>
          <div class="preview-message" data-testid="bulk-preview-message">{{ bulkPreview.message }}</div>
          <div class="preview-link" *ngIf="bulkPreview.link" data-testid="bulk-preview-link">{{ bulkPreview.link }}</div>

          <div class="preview-recipients" *ngIf="bulkPreview.sampleRecipients.length > 0">
            <div class="preview-recipient" *ngFor="let recipient of bulkPreview.sampleRecipients" data-testid="bulk-preview-recipient">
              <span class="recipient-name">{{ recipient.fullName }}</span>
              <span class="recipient-role">{{ getRoleLabel(recipient.role) }}</span>
            </div>
          </div>
        </div>

        <div *ngIf="bulkResult" class="bulk-result" data-testid="bulk-result-panel">
          <div class="bulk-result-summary" data-testid="bulk-result-summary">
            Thành công {{ bulkResult.successCount }}, Lỗi {{ bulkResult.failedCount }}
          </div>
          <div class="bulk-result-errors" *ngIf="bulkResult.errors.length > 0">
            <div class="bulk-result-error" *ngFor="let error of bulkResult.errors" data-testid="bulk-result-error">
              <span class="result-recipient">{{ error.recipientName }}</span>
              <span class="result-role">{{ getRoleLabel(error.recipientRole) }}</span>
              <span class="result-message">{{ error.error }}</span>
            </div>
          </div>
        </div>
      </section>

      <div class="notifications-list">
        <div *ngIf="!notifications.length && !loading" class="empty">Không có thông báo nào</div>

        <div
          *ngFor="let notification of notifications"
          class="notification-item"
          [class.unread]="!notification.isRead"
          [class.high]="notification.priority === 'HIGH' || notification.priority === 'URGENT'"
          (click)="handleClick(notification)">
          <div class="notif-icon">
            <span>{{ getIcon(notification.type) }}</span>
          </div>
          <div class="notif-body">
            <div class="notif-title">{{ notification.title }}</div>
            <div class="notif-message">{{ notification.message }}</div>
            <div class="notif-meta">
              <span class="notif-time">{{ timeAgo(notification.createdAt) }}</span>
              <span
                class="notif-priority"
                *ngIf="notification.priority === 'HIGH' || notification.priority === 'URGENT'"
                [class.urgent]="notification.priority === 'URGENT'">
                {{ notification.priority === 'URGENT' ? 'Khẩn cấp' : 'Quan trọng' }}
              </span>
            </div>
          </div>
          <div class="notif-status">
            <span class="dot" [class.unread]="!notification.isRead"></span>
          </div>
        </div>
      </div>

      <div class="pagination" *ngIf="totalPages > 1">
        <button (click)="goPage(page - 1)" [disabled]="page <= 1">&laquo; Trước</button>
        <span>Trang {{ page }}/{{ totalPages }}</span>
        <button (click)="goPage(page + 1)" [disabled]="page >= totalPages">Sau &raquo;</button>
      </div>

      <div *ngIf="loading" class="loading">Đang tải...</div>
    </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 960px; margin: 0 auto; }
    h2 { margin: 0; color: #1e293b; font-size: 22px; }
    h3 { margin: 0; color: #0f172a; font-size: 18px; }
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .unread-badge {
      background: #dc2626;
      color: #fff;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .btn-mark-all {
      padding: 6px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      color: #2563eb;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background .15s;
    }
    .btn-mark-all:hover { background: #eff6ff; }
    .filter-select, .bulk-select, .bulk-input, .bulk-textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      background: #fff;
      color: #0f172a;
    }
    .filter-select { width: auto; min-width: 120px; }
    .bulk-card {
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      border: 1px solid #dbeafe;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 22px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .bulk-card-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }
    .bulk-card-header p {
      margin: 6px 0 0;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;
    }
    .bulk-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .form-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: #334155;
      font-size: 13px;
      font-weight: 600;
    }
    .form-field.full-width { grid-column: 1 / -1; }
    .bulk-textarea {
      resize: vertical;
      min-height: 112px;
      font: inherit;
    }
    .bulk-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    .btn-preview, .btn-confirm {
      padding: 9px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-preview {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-confirm {
      background: #2563eb;
      color: #fff;
    }
    .btn-preview:disabled, .btn-confirm:disabled {
      opacity: .55;
      cursor: not-allowed;
    }
    .bulk-error {
      margin: 12px 0 0;
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
    }
    .bulk-preview, .bulk-result {
      margin-top: 16px;
      border: 1px solid #dbeafe;
      border-radius: 12px;
      background: #fff;
      padding: 16px;
    }
    .preview-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .preview-chip {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 600;
    }
    .preview-title {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .preview-message, .preview-link {
      margin-top: 8px;
      color: #475569;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .preview-recipients {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .preview-recipient {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 12px;
    }
    .recipient-name { color: #0f172a; font-weight: 600; }
    .recipient-role { color: #475569; }
    .bulk-result-summary {
      font-size: 14px;
      font-weight: 700;
      color: #166534;
    }
    .bulk-result-errors {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bulk-result-error {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      gap: 8px;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fff7ed;
      color: #9a3412;
      font-size: 12px;
      align-items: start;
    }
    .result-recipient { font-weight: 700; color: #7c2d12; }
    .result-role { color: #9a3412; }
    .result-message { color: #c2410c; }
    .notifications-list { display: flex; flex-direction: column; gap: 4px; }
    .notification-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      transition: background .15s;
      border-left: 3px solid transparent;
    }
    .notification-item:hover { background: #f8fafc; }
    .notification-item.unread { background: #eff6ff; border-left-color: #2563eb; }
    .notification-item.high { border-left-color: #f59e0b; }
    .notification-item.high.unread { border-left-color: #dc2626; background: #fef2f2; }
    .notif-icon { font-size: 22px; min-width: 32px; text-align: center; padding-top: 2px; }
    .notif-body { flex: 1; }
    .notif-title { font-weight: 600; font-size: 14px; color: #1e293b; margin-bottom: 2px; }
    .notif-message { font-size: 13px; color: #64748b; line-height: 1.4; }
    .notif-meta { display: flex; gap: 10px; align-items: center; margin-top: 6px; }
    .notif-time { font-size: 11px; color: #94a3b8; }
    .notif-priority {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      background: #fef3c7;
      color: #92400e;
    }
    .notif-priority.urgent { background: #fecaca; color: #991b1b; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #e2e8f0; display: inline-block; }
    .dot.unread { background: #2563eb; }
    .notif-status { padding-top: 6px; }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-top: 20px;
    }
    .pagination button {
      padding: 6px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
    }
    .pagination button:disabled { opacity: .4; cursor: default; }
    .pagination span { font-size: 13px; color: #64748b; }
    .empty { text-align: center; padding: 48px; color: #94a3b8; font-size: 14px; }
    .loading { text-align: center; padding: 24px; color: #64748b; }

    @media (max-width: 720px) {
      .container { padding: 16px; }
      .bulk-grid { grid-template-columns: 1fr; }
      .bulk-actions { justify-content: stretch; }
      .btn-preview, .btn-confirm { width: 100%; }
      .bulk-result-error { grid-template-columns: 1fr; }
    }
  `],
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  notifications: NotificationItem[] = [];
  unreadCount = 0;
  loading = false;
  page = 1;
  totalPages = 1;
  filterMode = 'all';

  bulkGroupOptions = BULK_GROUP_OPTIONS;
  bulkForm: BulkFormState = {
    recipientGroup: 'PARENTS',
    title: '',
    message: '',
    priority: 'MEDIUM',
    link: '/app/notifications',
  };
  bulkPreview: BulkNotificationPreview | null = null;
  bulkResult: BulkNotificationResult | null = null;
  bulkError = '';
  previewLoading = false;
  sendingBulk = false;

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  get canSendBulkNotifications(): boolean {
    return [Role.DIRECTOR, Role.OPS].includes(this.auth.userSignal()?.role as Role);
  }

  get canPreviewBulk(): boolean {
    return this.bulkForm.title.trim().length > 0 && this.bulkForm.message.trim().length > 0;
  }

  async ngOnInit() {
    await this.loadNotifications();
    this.refreshInterval = setInterval(() => this.loadUnreadCount(), 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  async loadNotifications() {
    this.loading = true;
    try {
      const result = await this.notificationsService.getMyNotifications({
        page: this.page,
        limit: 20,
        unreadOnly: this.filterMode === 'unread',
      });
      this.notifications = result.data || [];
      this.totalPages = result.totalPages || 1;
      this.unreadCount = result.unreadCount || 0;
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      this.loading = false;
    }
  }

  async loadUnreadCount() {
    try {
      const { count } = await this.notificationsService.getUnreadCount();
      this.unreadCount = count;
    } catch {
      // Ignore polling errors to keep inbox interactive.
    }
  }

  async handleClick(notification: NotificationItem) {
    if (!notification.isRead) {
      await this.notificationsService.markAsRead(notification._id);
      notification.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  async markAllRead() {
    await this.notificationsService.markAllAsRead();
    this.notifications = this.notifications.map((notification) => ({
      ...notification,
      isRead: true,
    }));
    this.unreadCount = 0;
  }

  async goPage(nextPage: number) {
    this.page = nextPage;
    await this.loadNotifications();
  }

  resetBulkWorkflow() {
    this.bulkPreview = null;
    this.bulkResult = null;
    this.bulkError = '';
  }

  async previewBulkNotification() {
    if (!this.canSendBulkNotifications || !this.canPreviewBulk) {
      return;
    }

    this.previewLoading = true;
    this.bulkError = '';
    this.bulkResult = null;

    try {
      this.bulkPreview = await this.notificationsService.previewBulkNotification(this.getBulkPayload());
    } catch (error) {
      this.bulkPreview = null;
      this.bulkError = this.readHttpError(error, 'Không thể preview thông báo hàng loạt.');
    } finally {
      this.previewLoading = false;
    }
  }

  async confirmBulkSend() {
    if (!this.canSendBulkNotifications || !this.bulkPreview || this.bulkPreview.totalRecipients === 0) {
      return;
    }

    this.sendingBulk = true;
    this.bulkError = '';

    try {
      this.bulkResult = await this.notificationsService.sendBulkNotification(this.getBulkPayload());
      this.bulkPreview = this.bulkResult;
      await this.loadNotifications();
    } catch (error) {
      this.bulkError = this.readHttpError(error, 'Không thể gửi thông báo hàng loạt.');
    } finally {
      this.sendingBulk = false;
    }
  }

  getPriorityLabel(priority: NotificationPriorityValue): string {
    switch (priority) {
      case 'LOW':
        return 'Thấp';
      case 'HIGH':
        return 'Quan trọng';
      case 'URGENT':
        return 'Khẩn cấp';
      default:
        return 'Trung bình';
    }
  }

  getRoleLabel(role: string): string {
    return ROLE_LABELS[role] || role;
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      PAYROLL_PENDING: '💰',
      PAYROLL_APPROVED: '✅',
      PAYROLL_REJECTED: '❌',
      INVOICE_PENDING: '📄',
      INVOICE_APPROVED: '✅',
      TOPUP_PENDING: '💳',
      TOPUP_APPROVED: '✅',
      TOPUP_REJECTED: '❌',
      TEACHER_PENDING: '👤',
      TEACHER_APPROVED: '✅',
      TICKET_NEW: '🎫',
      TICKET_OVERDUE: '⚠️',
      TICKET_RESOLVED: '✅',
      SESSION_CONFLICT: '⚡',
      WALLET_LOW_BALANCE: '💸',
      SYSTEM: '🔔',
    };
    return icons[type] || '🔔';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  private getBulkPayload(): BulkNotificationPayload {
    return {
      recipientGroup: this.bulkForm.recipientGroup,
      title: this.bulkForm.title.trim(),
      message: this.bulkForm.message.trim(),
      priority: this.bulkForm.priority,
      link: this.bulkForm.link.trim() || undefined,
    };
  }

  private readHttpError(error: unknown, fallback: string): string {
    const message = (error as any)?.error?.message || (error as any)?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
  }
}
