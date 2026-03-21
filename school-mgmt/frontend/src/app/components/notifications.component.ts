import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationsService } from '../services/notifications.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

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

    <div class="notifications-list">
      <div *ngIf="!notifications.length && !loading" class="empty">
        Không có thông báo nào
      </div>

      <div *ngFor="let n of notifications"
           class="notification-item"
           [class.unread]="!n.isRead"
           [class.high]="n.priority === 'HIGH' || n.priority === 'URGENT'"
           (click)="handleClick(n)">
        <div class="notif-icon">
          <span>{{ getIcon(n.type) }}</span>
        </div>
        <div class="notif-body">
          <div class="notif-title">{{ n.title }}</div>
          <div class="notif-message">{{ n.message }}</div>
          <div class="notif-meta">
            <span class="notif-time">{{ timeAgo(n.createdAt) }}</span>
            <span class="notif-priority" *ngIf="n.priority === 'HIGH' || n.priority === 'URGENT'"
                  [class.urgent]="n.priority === 'URGENT'">
              {{ n.priority === 'URGENT' ? 'Khẩn cấp' : 'Quan trọng' }}
            </span>
          </div>
        </div>
        <div class="notif-status">
          <span class="dot" [class.unread]="!n.isRead"></span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" *ngIf="totalPages > 1">
      <button (click)="goPage(page - 1)" [disabled]="page <= 1">&laquo; Trước</button>
      <span>Trang {{ page }}/{{ totalPages }}</span>
      <button (click)="goPage(page + 1)" [disabled]="page >= totalPages">Sau &raquo;</button>
    </div>

    <div *ngIf="loading" class="loading">Đang tải...</div>
  </div>
  `,
  styles: [`
    .container { padding:24px; max-width:800px; margin:0 auto; }
    h2 { margin:0; color:#1e293b; font-size:22px; }
    .header-row { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
    .header-actions { display:flex; align-items:center; gap:10px; }
    .unread-badge { background:#dc2626; color:#fff; padding:4px 12px; border-radius:999px; font-size:12px; font-weight:600; }
    .btn-mark-all {
      padding:6px 14px; border:1px solid #e2e8f0; border-radius:6px; background:#fff;
      color:#2563eb; font-size:12px; font-weight:500; cursor:pointer; transition:background .15s;
    }
    .btn-mark-all:hover { background:#eff6ff; }
    .filter-select { padding:6px 10px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px; background:#fff; }
    .notifications-list { display:flex; flex-direction:column; gap:4px; }
    .notification-item {
      display:flex; align-items:flex-start; gap:12px; padding:14px 16px;
      background:#fff; border-radius:8px; cursor:pointer; transition:background .15s;
      border-left:3px solid transparent;
    }
    .notification-item:hover { background:#f8fafc; }
    .notification-item.unread { background:#eff6ff; border-left-color:#2563eb; }
    .notification-item.high { border-left-color:#f59e0b; }
    .notification-item.high.unread { border-left-color:#dc2626; background:#fef2f2; }
    .notif-icon { font-size:22px; min-width:32px; text-align:center; padding-top:2px; }
    .notif-body { flex:1; }
    .notif-title { font-weight:600; font-size:14px; color:#1e293b; margin-bottom:2px; }
    .notif-message { font-size:13px; color:#64748b; line-height:1.4; }
    .notif-meta { display:flex; gap:10px; align-items:center; margin-top:6px; }
    .notif-time { font-size:11px; color:#94a3b8; }
    .notif-priority {
      font-size:10px; padding:2px 8px; border-radius:999px; font-weight:600;
      background:#fef3c7; color:#92400e;
    }
    .notif-priority.urgent { background:#fecaca; color:#991b1b; }
    .dot { width:8px; height:8px; border-radius:50%; background:#e2e8f0; display:inline-block; }
    .dot.unread { background:#2563eb; }
    .notif-status { padding-top:6px; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:16px; margin-top:20px; }
    .pagination button { padding:6px 14px; border:1px solid #e2e8f0; border-radius:6px; background:#fff; cursor:pointer; font-size:13px; }
    .pagination button:disabled { opacity:.4; cursor:default; }
    .pagination span { font-size:13px; color:#64748b; }
    .empty { text-align:center; padding:48px; color:#94a3b8; font-size:14px; }
    .loading { text-align:center; padding:24px; color:#64748b; }
  `]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private svc = inject(NotificationsService);
  private router = inject(Router);

  notifications: any[] = [];
  unreadCount = 0;
  loading = false;
  page = 1;
  totalPages = 1;
  filterMode = 'all';

  private refreshInterval: any;

  async ngOnInit() {
    await this.loadNotifications();
    // Poll every 30 seconds
    this.refreshInterval = setInterval(() => this.loadUnreadCount(), 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async loadNotifications() {
    this.loading = true;
    try {
      const result = await this.svc.getMyNotifications({
        page: this.page,
        limit: 20,
        unreadOnly: this.filterMode === 'unread',
      });
      this.notifications = result.data || [];
      this.totalPages = result.totalPages || 1;
      this.unreadCount = result.unreadCount || 0;
    } catch (err) {
      console.error('Load notifications error:', err);
    } finally {
      this.loading = false;
    }
  }

  async loadUnreadCount() {
    try {
      const { count } = await this.svc.getUnreadCount();
      this.unreadCount = count;
    } catch {}
  }

  async handleClick(n: any) {
    if (!n.isRead) {
      await this.svc.markAsRead(n._id);
      n.isRead = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  async markAllRead() {
    await this.svc.markAllAsRead();
    this.notifications.forEach(n => n.isRead = true);
    this.unreadCount = 0;
  }

  async goPage(p: number) {
    this.page = p;
    await this.loadNotifications();
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      PAYROLL_PENDING: '💰', PAYROLL_APPROVED: '✅', PAYROLL_REJECTED: '❌',
      INVOICE_PENDING: '📄', INVOICE_APPROVED: '✅',
      TOPUP_PENDING: '💳', TOPUP_APPROVED: '✅', TOPUP_REJECTED: '❌',
      TEACHER_PENDING: '👤', TEACHER_APPROVED: '✅',
      TICKET_NEW: '🎫', TICKET_OVERDUE: '⚠️', TICKET_RESOLVED: '✅',
      SESSION_CONFLICT: '⚡', WALLET_LOW_BALANCE: '💸', SYSTEM: '🔔',
    };
    return icons[type] || '🔔';
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }
}
