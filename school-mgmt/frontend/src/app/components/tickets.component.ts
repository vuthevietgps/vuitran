import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  TicketService,
  TicketItem,
  TicketComment,
  TicketType,
  TicketStatus,
  TicketPriority,
  TICKET_TYPE_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TicketListResult,
  TicketStats,
} from '../services/ticket.service';
import { AuthService } from '../services/auth.service';
import { Role, ROLE_LABELS } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <!-- ═══════════ LIST VIEW ═══════════ -->
  <div *ngIf="!selectedTicket()" class="tickets-page">
    <header class="page-header">
      <div>
        <h2>Hỗ trợ &amp; Ticket</h2>
        <p>Quản lý yêu cầu hỗ trợ, khiếu nại và theo dõi trạng thái xử lý.</p>
      </div>
      <button class="primary" (click)="openCreateModal()">+ Tạo Ticket</button>
    </header>

  <app-flow-guide featureKey="tickets"></app-flow-guide>

    <!-- Stats -->
    <div class="stats-bar" *ngIf="isOpsOrDirector() && serverStats()">
      <div class="stat-card">
        <span class="stat-value">{{ getStatCount('OPEN') }}</span>
        <span class="stat-label">Mới tạo</span>
      </div>
      <div class="stat-card warning">
        <span class="stat-value">{{ getStatCount('IN_PROGRESS') }}</span>
        <span class="stat-label">Đang xử lý</span>
      </div>
      <div class="stat-card info">
        <span class="stat-value">{{ getStatCount('WAITING_INFO') }}</span>
        <span class="stat-label">Chờ thông tin</span>
      </div>
      <div class="stat-card success">
        <span class="stat-value">{{ getStatCount('RESOLVED') + getStatCount('CLOSED') }}</span>
        <span class="stat-label">Đã giải quyết</span>
      </div>
      <div class="stat-card danger" *ngIf="serverStats()!.overdueCount > 0">
        <span class="stat-value">{{ serverStats()!.overdueCount }}</span>
        <span class="stat-label">Quá hạn</span>
      </div>
    </div>

    <!-- Tabs for OPS -->
    <div class="tabs" *ngIf="isStaff()">
      <button [class.active]="activeTab === 'all'" (click)="switchTab('all')">Tất cả</button>
      <button [class.active]="activeTab === 'assigned'" (click)="switchTab('assigned')" *ngIf="isOps()">Được giao cho tôi</button>
      <button [class.active]="activeTab === 'my'" (click)="switchTab('my')">Tôi tạo</button>
    </div>

    <!-- Filters -->
    <div class="filters">
      <select [(ngModel)]="filter.status" (change)="load()">
        <option value="">Mọi trạng thái</option>
        <option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</option>
      </select>
      <select [(ngModel)]="filter.type" (change)="load()">
        <option value="">Mọi loại</option>
        <option *ngFor="let t of typeOptions" [value]="t.value">{{ t.label }}</option>
      </select>
      <select [(ngModel)]="filter.priority" (change)="load()" *ngIf="isStaff()">
        <option value="">Mọi mức ưu tiên</option>
        <option *ngFor="let p of priorityOptions" [value]="p.value">{{ p.label }}</option>
      </select>
      <input type="text" [ngModel]="searchKeyword()" (ngModelChange)="searchKeyword.set($event)" placeholder="Tìm mã ticket, tiêu đề..." class="search-input" />
    </div>

    <!-- Ticket List -->
    <div *ngIf="loading()" class="loading-bar">Đang tải...</div>
    <div class="ticket-list" *ngIf="!loading() && filteredTickets().length; else emptyState">
      <div class="ticket-card" *ngFor="let t of filteredTickets()" (click)="viewTicket(t)" [class.overdue]="t.isOverdue">
        <div class="ticket-card-header">
          <span class="ticket-code">{{ t.ticketCode }}</span>
          <span class="badge priority" [class]="'priority-' + t.priority.toLowerCase()">{{ priorityLabel(t.priority) }}</span>
          <span class="badge status" [class]="'status-' + t.status.toLowerCase()">{{ statusLabel(t.status) }}</span>
          <span class="overdue-tag" *ngIf="t.isOverdue">QUÁ HẠN</span>
        </div>
        <div class="ticket-card-body">
          <h4 class="ticket-subject">{{ t.subject }}</h4>
          <p class="ticket-meta">
            <span class="type-tag">{{ typeLabel(t.type) }}</span>
            <span class="separator">·</span>
            <span>{{ t.createdBy.fullName || 'N/A' }}</span>
            <span class="role-badge">{{ roleLabel(t.createdByRole) }}</span>
            <span class="separator">·</span>
            <span>{{ formatDate(t.createdAt) }}</span>
          </p>
          <p class="ticket-desc">{{ truncate(t.description, 120) }}</p>
        </div>
        <div class="ticket-card-footer">
          <span *ngIf="t.assignedTo" class="assigned-to">
            Xử lý: <strong>{{ t.assignedTo.fullName }}</strong>
          </span>
          <span *ngIf="!t.assignedTo && isStaff()" class="unassigned">Chưa phân công</span>
          <span *ngIf="t.classId" class="ref-badge">{{ t.classId.code || t.classId.name }}</span>
        </div>
      </div>
    </div>
    <ng-template #emptyState>
      <div class="empty-state" *ngIf="!loading()">
        <p>Không có ticket nào{{ filter.status || filter.type ? ' phù hợp với bộ lọc' : '' }}.</p>
        <button class="primary" (click)="openCreateModal()">Tạo ticket mới</button>
      </div>
    </ng-template>

    <!-- Pagination -->
    <div class="pagination" *ngIf="totalPages() > 1">
      <button (click)="goPage(currentPage() - 1)" [disabled]="currentPage() <= 1">&laquo; Trước</button>
      <span>Trang {{ currentPage() }} / {{ totalPages() }}</span>
      <button (click)="goPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()">Sau &raquo;</button>
    </div>
  </div>

  <!-- ═══════════ DETAIL VIEW ═══════════ -->
  <div *ngIf="selectedTicket()" class="ticket-detail-page">
    <button class="back-btn" (click)="closeDetail()">&larr; Quay lại danh sách</button>

    <div class="detail-layout">
      <!-- Left: Ticket Info + Conversation -->
      <div class="detail-main">
        <!-- Header -->
        <div class="detail-header">
          <div class="detail-header-top">
            <span class="ticket-code">{{ selectedTicket()!.ticketCode }}</span>
            <span class="badge priority" [class]="'priority-' + selectedTicket()!.priority.toLowerCase()">{{ priorityLabel(selectedTicket()!.priority) }}</span>
            <span class="badge status" [class]="'status-' + selectedTicket()!.status.toLowerCase()">{{ statusLabel(selectedTicket()!.status) }}</span>
            <span class="overdue-tag" *ngIf="selectedTicket()!.isOverdue">QUÁ HẠN</span>
          </div>
          <h2 class="detail-subject">{{ selectedTicket()!.subject }}</h2>
          <div class="detail-meta">
            <span class="type-tag">{{ typeLabel(selectedTicket()!.type) }}</span>
            <span class="separator">·</span>
            <span>Tạo bởi: <strong>{{ selectedTicket()!.createdBy.fullName }}</strong> ({{ roleLabel(selectedTicket()!.createdByRole) }})</span>
            <span class="separator">·</span>
            <span>{{ formatDateTime(selectedTicket()!.createdAt) }}</span>
          </div>
        </div>

        <!-- Description -->
        <div class="detail-description">
          <h4>Mô tả</h4>
          <p>{{ selectedTicket()!.description }}</p>
          <div *ngIf="selectedTicket()!.attachments?.length" class="attachments">
            <span *ngFor="let a of selectedTicket()!.attachments" class="attachment-link">📎 {{ getFileName(a) }}</span>
          </div>
        </div>

        <!-- References -->
        <div class="detail-refs" *ngIf="hasReferences()">
          <h4>Thông tin liên quan</h4>
          <div class="ref-grid">
            <div *ngIf="selectedTicket()!.classId" class="ref-item">
              <span class="ref-label">Lớp học:</span>
              <span>{{ selectedTicket()!.classId.code }} - {{ selectedTicket()!.classId.name }}</span>
            </div>
            <div *ngIf="selectedTicket()!.studentId" class="ref-item">
              <span class="ref-label">Học sinh:</span>
              <span>{{ selectedTicket()!.studentId.fullName }} ({{ selectedTicket()!.studentId.studentCode }})</span>
            </div>
            <div *ngIf="selectedTicket()!.teacherId" class="ref-item">
              <span class="ref-label">Giáo viên:</span>
              <span>{{ selectedTicket()!.teacherId.fullName }}</span>
            </div>
            <div *ngIf="selectedTicket()!.sessionId" class="ref-item">
              <span class="ref-label">Buổi học:</span>
              <span>{{ formatDate(selectedTicket()!.sessionId.scheduledDate) }}</span>
            </div>
          </div>
        </div>

        <!-- Resolution -->
        <div class="detail-resolution" *ngIf="selectedTicket()!.resolution">
          <h4>Kết quả xử lý</h4>
          <div class="resolution-card" [class]="'outcome-' + selectedTicket()!.resolution!.outcome.toLowerCase()">
            <div class="resolution-outcome">
              <span class="outcome-badge">{{ outcomeLabel(selectedTicket()!.resolution!.outcome) }}</span>
              <span *ngIf="selectedTicket()!.resolution!.refundAmount" class="refund-amount">
                Hoàn tiền: {{ formatCurrency(selectedTicket()!.resolution!.refundAmount) }}
              </span>
            </div>
            <p>{{ selectedTicket()!.resolution!.summary }}</p>
            <small>Xử lý bởi: {{ selectedTicket()!.resolution!.resolvedBy?.fullName }} · {{ formatDateTime(selectedTicket()!.resolution!.resolvedAt) }}</small>
          </div>
        </div>

        <!-- Conversation -->
        <div class="conversation">
          <h4>Trao đổi ({{ comments().length }})</h4>
          <div class="comments-list">
            <div *ngFor="let c of comments()" class="comment" [class.internal]="c.isInternal" [class.own]="c.userId._id === currentUserId()">
              <div class="comment-header">
                <strong>{{ c.userId.fullName }}</strong>
                <span class="comment-role">{{ roleLabel(c.userId.role) }}</span>
                <span *ngIf="c.isInternal" class="internal-badge">Nội bộ</span>
                <span class="comment-time">{{ formatDateTime(c.createdAt) }}</span>
              </div>
              <div class="comment-body">{{ c.content }}</div>
              <div *ngIf="c.attachments?.length" class="comment-attachments">
                <span *ngFor="let a of c.attachments" class="attachment-link">📎 {{ getFileName(a) }}</span>
              </div>
            </div>
            <div *ngIf="comments().length === 0" class="no-comments">Chưa có trao đổi nào.</div>
          </div>

          <!-- Reply box -->
          <div class="reply-box" *ngIf="canComment()">
            <textarea [(ngModel)]="newComment" placeholder="Nhập nội dung trả lời..." rows="3"></textarea>
            <div class="reply-actions">
                <label *ngIf="isOpsOrDirector()" class="internal-check">
                <input type="checkbox" [(ngModel)]="newCommentInternal" />
                Ghi chú nội bộ (PH/GV không thấy)
              </label>
              <button class="primary" (click)="submitComment()" [disabled]="!newComment.trim() || submittingComment()">
                {{ submittingComment() ? 'Đang gửi...' : 'Gửi trả lời' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Actions Sidebar -->
      <div class="detail-sidebar">
        <h4>Hành động</h4>

        <!-- Workflow actions for OPS/DIRECTOR -->
        <div class="action-group" *ngIf="isOpsOrDirector()">
          <button class="action-btn start" (click)="doAction('start')"
            *ngIf="['OPEN','WAITING_INFO'].includes(selectedTicket()!.status)">
            ▶ Nhận xử lý
          </button>
          <button class="action-btn info" (click)="doAction('request-info')"
            *ngIf="['OPEN','IN_PROGRESS'].includes(selectedTicket()!.status)">
            ❓ Yêu cầu thông tin
          </button>
          <button class="action-btn resolve" (click)="openResolveModal()"
            *ngIf="!['RESOLVED','CLOSED','CANCELLED'].includes(selectedTicket()!.status)">
            ✅ Giải quyết
          </button>
          <button class="action-btn close-ticket" (click)="doAction('close')"
            *ngIf="selectedTicket()!.status === 'RESOLVED'">
            🔒 Đóng ticket
          </button>
          <button class="action-btn reopen" (click)="doAction('reopen')"
            *ngIf="['RESOLVED','CLOSED'].includes(selectedTicket()!.status)">
            🔄 Mở lại
          </button>
        </div>

        <!-- Cancel for creator -->
        <div class="action-group" *ngIf="isCreator() && !['RESOLVED','CLOSED','CANCELLED'].includes(selectedTicket()!.status)">
          <button class="action-btn cancel" (click)="doAction('cancel')">
            ✕ Hủy ticket
          </button>
        </div>

        <!-- Assign / Priority for staff -->
        <div class="action-group" *ngIf="isOpsOrDirector() && !['RESOLVED','CLOSED','CANCELLED'].includes(selectedTicket()!.status)">
          <h5>Ưu tiên</h5>
          <select [(ngModel)]="editPriority" (change)="updatePriority()">
            <option *ngFor="let p of priorityOptions" [value]="p.value">{{ p.label }}</option>
          </select>
        </div>

        <div class="action-group" *ngIf="canOpenSourceConversation()">
          <h5>Chat h\u1ED7 tr\u1EE3</h5>
          <button class="action-btn chat-link" (click)="openSourceConversation()">
            M\u1EDF h\u1ED9i tho\u1EA1i g\u1ED1c
          </button>
        </div>

        <!-- Info -->
        <div class="sidebar-info">
          <h5>Thông tin</h5>
          <div class="info-row">
            <span class="info-label">Trạng thái:</span>
            <span class="badge status" [class]="'status-' + selectedTicket()!.status.toLowerCase()">{{ statusLabel(selectedTicket()!.status) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mức ưu tiên:</span>
            <span class="badge priority" [class]="'priority-' + selectedTicket()!.priority.toLowerCase()">{{ priorityLabel(selectedTicket()!.priority) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Hạn xử lý:</span>
            <span [class.overdue-text]="selectedTicket()!.isOverdue">{{ selectedTicket()!.dueDate ? formatDateTime(selectedTicket()!.dueDate!) : '—' }}</span>
          </div>
          <div class="info-row" *ngIf="selectedTicket()!.assignedTo">
            <span class="info-label">Phụ trách:</span>
            <span>{{ selectedTicket()!.assignedTo!.fullName }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════ CREATE MODAL ═══════════ -->
  <div class="modal-backdrop" *ngIf="showCreateModal()" (click)="closeCreateModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Tạo Ticket mới</h3>
        <button class="close-btn" (click)="closeCreateModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Loại yêu cầu *</label>
          <select [(ngModel)]="createForm.type">
            <option value="">-- Chọn loại --</option>
            <option *ngFor="let t of typeOptions" [value]="t.value">{{ t.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tiêu đề *</label>
          <input type="text" [(ngModel)]="createForm.subject" placeholder="Nhập tiêu đề ticket..." />
        </div>
        <div class="form-group">
          <label>Mô tả chi tiết *</label>
          <textarea [(ngModel)]="createForm.description" rows="5" placeholder="Mô tả vấn đề cần hỗ trợ..."></textarea>
        </div>
        <div class="form-group" *ngIf="isStaff()">
          <label>Mức ưu tiên</label>
          <select [(ngModel)]="createForm.priority">
            <option *ngFor="let p of priorityOptions" [value]="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="form-error" *ngIf="createError()">{{ createError() }}</div>
      </div>
      <div class="modal-footer">
        <button class="ghost" (click)="closeCreateModal()">Hủy</button>
        <button class="primary" (click)="submitCreate()" [disabled]="creating()">
          {{ creating() ? 'Đang tạo...' : 'Tạo Ticket' }}
        </button>
      </div>
    </div>
  </div>

  <!-- ═══════════ RESOLVE MODAL ═══════════ -->
  <div class="modal-backdrop" *ngIf="showResolveModal()" (click)="closeResolveModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Giải quyết Ticket</h3>
        <button class="close-btn" (click)="closeResolveModal()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Kết quả *</label>
          <select [(ngModel)]="resolveForm.outcome">
            <option value="APPROVED">Chấp thuận</option>
            <option value="REJECTED">Từ chối</option>
            <option value="PARTIAL">Chấp thuận một phần</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tóm tắt kết quả *</label>
          <textarea [(ngModel)]="resolveForm.summary" rows="4" placeholder="Mô tả kết quả xử lý..."></textarea>
        </div>
        <div class="form-group" *ngIf="resolveForm.outcome === 'APPROVED' || resolveForm.outcome === 'PARTIAL'">
          <label>Số tiền hoàn (nếu có)</label>
          <input type="number" [(ngModel)]="resolveForm.refundAmount" min="0" placeholder="0" />
        </div>
        <div class="form-error" *ngIf="resolveError()">{{ resolveError() }}</div>
      </div>
      <div class="modal-footer">
        <button class="ghost" (click)="closeResolveModal()">Hủy</button>
        <button class="primary" (click)="submitResolve()" [disabled]="resolving()">
          {{ resolving() ? 'Đang xử lý...' : 'Xác nhận' }}
        </button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    /* ═══ PAGE LAYOUT ═══ */
    .tickets-page, .ticket-detail-page { padding: 24px; max-width: 1400px; }

    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
    }
    .page-header h2 { margin: 0 0 4px; font-size: 22px; color: #0f172a; }
    .page-header p { margin: 0; color: #64748b; font-size: 14px; }

    /* ═══ BUTTONS ═══ */
    .primary {
      background: #2563eb; color: #fff; border: none; padding: 8px 18px;
      border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;
      transition: background 0.15s;
    }
    .primary:hover { background: #1d4ed8; }
    .primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .ghost {
      background: transparent; border: 1px solid #cbd5e1; padding: 8px 18px;
      border-radius: 6px; color: #475569; font-size: 13px; cursor: pointer;
    }
    .ghost:hover { background: #f1f5f9; }

    /* ═══ STATS BAR ═══ */
    .stats-bar {
      display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .stat-card {
      background: #fff; padding: 14px 20px; border-radius: 8px; min-width: 120px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 2px;
      border-left: 3px solid #2563eb;
    }
    .stat-card.warning { border-left-color: #f59e0b; }
    .stat-card.info { border-left-color: #8b5cf6; }
    .stat-card.success { border-left-color: #10b981; }
    .stat-card.danger { border-left-color: #ef4444; }
    .stat-value { font-size: 22px; font-weight: 700; color: #0f172a; }
    .stat-label { font-size: 12px; color: #64748b; }

    /* ═══ TABS ═══ */
    .tabs {
      display: flex; gap: 4px; margin-bottom: 16px; background: #fff;
      border-radius: 8px; padding: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    .tabs button {
      background: transparent; border: none; padding: 8px 20px; border-radius: 6px;
      font-size: 13px; cursor: pointer; color: #64748b; font-weight: 500;
    }
    .tabs button.active { background: #2563eb; color: #fff; font-weight: 600; }
    .tabs button:hover:not(.active) { background: #f1f5f9; }

    /* ═══ FILTERS ═══ */
    .filters {
      display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;
    }
    .filters select, .filters input, .search-input {
      padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 13px; background: #fff; color: #334155;
    }
    .search-input { flex: 1; min-width: 200px; }

    /* ═══ TICKET CARDS LIST ═══ */
    .ticket-list { display: flex; flex-direction: column; gap: 8px; }
    .ticket-card {
      background: #fff; border-radius: 8px; padding: 16px 20px; cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.15s, border-color 0.15s;
      border-left: 3px solid transparent;
    }
    .ticket-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-left-color: #2563eb; }
    .ticket-card.overdue { border-left-color: #ef4444; }

    .ticket-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .ticket-code { font-weight: 700; font-size: 13px; color: #2563eb; font-family: monospace; }

    .ticket-card-body { margin-bottom: 8px; }
    .ticket-subject { margin: 0 0 4px; font-size: 15px; color: #0f172a; font-weight: 600; }
    .ticket-meta { margin: 0; font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .ticket-desc { margin: 6px 0 0; font-size: 13px; color: #475569; line-height: 1.4; }

    .ticket-card-footer { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #64748b; }
    .assigned-to { color: #475569; }
    .unassigned { color: #f59e0b; font-weight: 500; }

    /* ═══ BADGES ═══ */
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .status-open { background: #dbeafe; color: #1e40af; }
    .status-in_progress { background: #fef3c7; color: #92400e; }
    .status-waiting_info { background: #ede9fe; color: #5b21b6; }
    .status-resolved { background: #d1fae5; color: #065f46; }
    .status-closed { background: #e2e8f0; color: #475569; }
    .status-cancelled { background: #fecaca; color: #991b1b; }

    .priority-low { background: #e2e8f0; color: #475569; }
    .priority-medium { background: #dbeafe; color: #1e40af; }
    .priority-high { background: #fed7aa; color: #c2410c; }
    .priority-urgent { background: #fecaca; color: #991b1b; }

    .type-tag {
      display: inline-block; padding: 1px 6px; border-radius: 3px;
      background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 500;
    }
    .role-badge {
      display: inline-block; padding: 0 5px; border-radius: 3px;
      background: #ede9fe; color: #5b21b6; font-size: 10px; font-weight: 600;
    }
    .overdue-tag {
      display: inline-block; padding: 2px 6px; border-radius: 3px;
      background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.6;} }
    .ref-badge {
      display: inline-block; padding: 1px 6px; border-radius: 3px;
      background: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 500;
    }
    .separator { color: #cbd5e1; }

    /* ═══ LOADING ═══ */
    .loading-bar {
      text-align: center; padding: 40px 20px; color: #64748b;
      font-size: 15px; background: #fff; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }

    /* ═══ EMPTY ═══ */
    .empty-state {
      text-align: center; padding: 60px 20px; background: #fff;
      border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .empty-state p { color: #64748b; margin-bottom: 16px; font-size: 15px; }

    /* ═══ PAGINATION ═══ */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 16px;
      margin-top: 16px; padding: 12px;
    }
    .pagination button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer; font-size: 13px; color: #334155;
    }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 13px; color: #64748b; }

    /* ═══ DETAIL PAGE ═══ */
    .back-btn {
      background: none; border: none; color: #2563eb; cursor: pointer;
      font-size: 14px; font-weight: 500; padding: 0; margin-bottom: 16px;
    }
    .back-btn:hover { text-decoration: underline; }

    .detail-layout { display: flex; gap: 24px; align-items: flex-start; }
    .detail-main { flex: 1; min-width: 0; }
    .detail-sidebar {
      width: 280px; flex-shrink: 0; background: #fff; border-radius: 8px;
      padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); position: sticky; top: 24px;
    }
    @media (max-width: 900px) {
      .detail-layout { flex-direction: column; }
      .detail-sidebar { width: 100%; position: static; }
    }

    .detail-header {
      background: #fff; border-radius: 8px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 16px;
    }
    .detail-header-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .detail-subject { margin: 0 0 8px; font-size: 20px; color: #0f172a; }
    .detail-meta { font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

    .detail-description, .detail-refs, .detail-resolution, .conversation {
      background: #fff; border-radius: 8px; padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 16px;
    }
    .detail-description h4, .detail-refs h4, .detail-resolution h4, .conversation h4 {
      margin: 0 0 12px; font-size: 14px; color: #0f172a; font-weight: 600;
    }
    .detail-description p { margin: 0; color: #334155; line-height: 1.6; white-space: pre-wrap; font-size: 14px; }

    .ref-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
    .ref-item { display: flex; gap: 8px; font-size: 13px; }
    .ref-label { color: #64748b; font-weight: 500; min-width: 80px; }

    /* ═══ RESOLUTION ═══ */
    .resolution-card {
      padding: 16px; border-radius: 6px; border-left: 4px solid #10b981;
    }
    .resolution-card.outcome-approved { border-left-color: #10b981; background: #f0fdf4; }
    .resolution-card.outcome-rejected { border-left-color: #ef4444; background: #fef2f2; }
    .resolution-card.outcome-partial { border-left-color: #f59e0b; background: #fffbeb; }
    .resolution-card.outcome-cancelled { border-left-color: #64748b; background: #f8fafc; }
    .resolution-outcome { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .outcome-badge {
      display: inline-block; padding: 3px 10px; border-radius: 4px;
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      background: #0f172a; color: #fff;
    }
    .refund-amount { color: #10b981; font-weight: 700; font-size: 15px; }
    .resolution-card p { margin: 0 0 6px; color: #334155; font-size: 14px; }
    .resolution-card small { color: #64748b; font-size: 12px; }

    /* ═══ COMMENTS / CONVERSATION ═══ */
    .comments-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
    .comment {
      padding: 12px 16px; border-radius: 8px; background: #f8fafc;
      border-left: 3px solid #e2e8f0;
    }
    .comment.own { border-left-color: #2563eb; background: #eff6ff; }
    .comment.internal { border-left-color: #f59e0b; background: #fffbeb; }
    .comment-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
      font-size: 13px; flex-wrap: wrap;
    }
    .comment-header strong { color: #0f172a; }
    .comment-role { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: #e2e8f0; color: #475569; }
    .internal-badge {
      font-size: 10px; padding: 1px 5px; border-radius: 3px;
      background: #f59e0b; color: #fff; font-weight: 600;
    }
    .comment-time { color: #94a3b8; font-size: 12px; margin-left: auto; }
    .comment-body { color: #334155; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
    .comment-attachments { margin-top: 6px; }
    .no-comments { color: #94a3b8; font-size: 13px; text-align: center; padding: 20px; }

    /* ═══ REPLY BOX ═══ */
    .reply-box { border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .reply-box textarea {
      width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 14px; resize: vertical; font-family: inherit; box-sizing: border-box;
      min-height: 80px;
    }
    .reply-box textarea:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15); }
    .reply-actions {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 8px; flex-wrap: wrap; gap: 8px;
    }
    .internal-check { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .internal-check input { cursor: pointer; }

    /* ═══ SIDEBAR ACTIONS ═══ */
    .detail-sidebar h4, .detail-sidebar h5 {
      margin: 0 0 12px; font-size: 14px; color: #0f172a; font-weight: 600;
    }
    .detail-sidebar h5 { font-size: 12px; color: #64748b; margin: 16px 0 8px; text-transform: uppercase; }
    .action-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
    .action-group select {
      width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px;
    }
    .action-btn {
      width: 100%; padding: 8px 12px; border: none; border-radius: 6px;
      font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s;
      text-align: left;
    }
    .action-btn.start { background: #dbeafe; color: #1e40af; }
    .action-btn.start:hover { background: #bfdbfe; }
    .action-btn.info { background: #ede9fe; color: #5b21b6; }
    .action-btn.info:hover { background: #ddd6fe; }
    .action-btn.resolve { background: #d1fae5; color: #065f46; }
    .action-btn.resolve:hover { background: #a7f3d0; }
    .action-btn.close-ticket { background: #e2e8f0; color: #334155; }
    .action-btn.close-ticket:hover { background: #cbd5e1; }
    .action-btn.reopen { background: #fef3c7; color: #92400e; }
    .action-btn.reopen:hover { background: #fde68a; }
    .action-btn.cancel { background: #fecaca; color: #991b1b; }
    .action-btn.cancel:hover { background: #fca5a5; }
    .action-btn.chat-link { background: #ccfbf1; color: #0f766e; }
    .action-btn.chat-link:hover { background: #99f6e4; }

    .sidebar-info { border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .info-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; }
    .info-label { color: #64748b; }
    .overdue-text { color: #ef4444; font-weight: 600; }

    /* ═══ ATTACHMENTS ═══ */
    .attachments, .comment-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .attachment-link {
      font-size: 12px; color: #2563eb; cursor: pointer; padding: 2px 6px;
      background: #eff6ff; border-radius: 4px;
    }

    /* ═══ MODALS ═══ */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 1000; padding: 20px;
    }
    .modal {
      background: #fff; border-radius: 12px; width: 100%; max-width: 560px;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 24px; border-bottom: 1px solid #e2e8f0;
    }
    .modal-header h3 { margin: 0; font-size: 18px; color: #0f172a; }
    .close-btn {
      background: none; border: none; font-size: 24px; cursor: pointer;
      color: #64748b; padding: 0; line-height: 1;
    }
    .modal-body { padding: 20px 24px; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 24px; border-top: 1px solid #e2e8f0;
    }

    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #334155; }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 14px; font-family: inherit; box-sizing: border-box;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.15);
    }
    .form-error { color: #ef4444; font-size: 13px; margin-top: 8px; padding: 8px 12px; background: #fef2f2; border-radius: 6px; }
  `],
})
export class TicketsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  // ─── Options ───
  typeOptions = Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  statusOptions = Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  priorityOptions = Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => ({ value, label }));

  // ─── State ───
  tickets = signal<TicketItem[]>([]);
  totalPages = signal(1);
  currentPage = signal(1);
  serverStats = signal<TicketStats | null>(null);
  selectedTicket = signal<TicketItem | null>(null);
  comments = signal<TicketComment[]>([]);
  showCreateModal = signal(false);
  showResolveModal = signal(false);
  creating = signal(false);
  resolving = signal(false);
  submittingComment = signal(false);
  createError = signal('');
  resolveError = signal('');
  loading = signal(false);

  // ─── Filters ───
  activeTab = 'my';
  filter: { status: string; type: string; priority: string } = { status: '', type: '', priority: '' };
  searchKeyword = signal('');

  // ─── Forms ───
  createForm = { type: '', subject: '', description: '', priority: 'MEDIUM' };
  resolveForm = { outcome: 'APPROVED', summary: '', refundAmount: 0 };
  newComment = '';
  newCommentInternal = false;
  editPriority = '';

  constructor(
    private ticketService: TicketService,
    private auth: AuthService,
  ) {
    // Set default tab based on role
    const role = this.auth.userSignal()?.role;
    if (role === Role.OPS) {
      this.activeTab = 'assigned';
    } else if (role === Role.DIRECTOR || role === Role.ACCOUNTING) {
      this.activeTab = 'all';
    } else {
      this.activeTab = 'my';
    }
    this.load();
    if (this.isOpsOrDirector()) this.loadStats();

    const requestedTicketId = this.route.snapshot.queryParamMap.get('ticketId');
    if (requestedTicketId) {
      void this.openTicketById(requestedTicketId, true);
    }
  }

  // ─── Helpers ───
  currentUserId(): string { return this.auth.userSignal()?.sub || ''; }
  isStaff(): boolean { return this.auth.hasRole([Role.OPS, Role.DIRECTOR, Role.ACCOUNTING]); }
  isOpsOrDirector(): boolean { return this.auth.hasRole([Role.OPS, Role.DIRECTOR]); }
  isOps(): boolean { return this.auth.hasRole([Role.OPS]); }
  isParent(): boolean { return this.auth.hasRole([Role.PARENT]); }
  isCreator(): boolean {
    const t = this.selectedTicket();
    return !!t && t.createdBy?._id === this.currentUserId();
  }
  canComment(): boolean {
    const t = this.selectedTicket();
    if (!t) return false;
    return !['CLOSED', 'CANCELLED'].includes(t.status);
  }
  hasReferences(): boolean {
    const t = this.selectedTicket();
    return !!t && !!(t.classId || t.studentId || t.teacherId || t.sessionId);
  }

  typeLabel(type: string): string { return TICKET_TYPE_LABELS[type] || type; }
  statusLabel(status: string): string { return TICKET_STATUS_LABELS[status] || status; }
  priorityLabel(priority: string): string { return TICKET_PRIORITY_LABELS[priority] || priority; }
  roleLabel(role: string): string { return ROLE_LABELS[role] || role; }
  outcomeLabel(outcome: string): string {
    const m: Record<string, string> = { APPROVED: 'Chấp thuận', REJECTED: 'Từ chối', PARTIAL: 'Một phần', CANCELLED: 'Đã hủy' };
    return m[outcome] || outcome;
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatDateTime(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  formatCurrency(n: number): string {
    return new Intl.NumberFormat('vi-VN').format(n) + 'đ';
  }

  getFileName(url: string): string {
    return url.split('/').pop() || url;
  }

  private getSourceConversationId(ticket = this.selectedTicket()): string {
    if (!ticket?.sourceConversationId) return '';
    return typeof ticket.sourceConversationId === 'string'
      ? ticket.sourceConversationId
      : ticket.sourceConversationId._id || '';
  }

  getStatCount(status: string): number {
    const stats = this.serverStats();
    if (!stats) return 0;
    const entry = stats.byStatus.find((s: any) => s._id === status);
    return entry ? entry.count : 0;
  }

  canOpenSourceConversation(): boolean {
    return (this.isParent() || this.isOpsOrDirector()) && !!this.getSourceConversationId();
  }

  filteredTickets = computed(() => {
    const kw = this.searchKeyword().trim().toLowerCase();
    if (!kw) return this.tickets();
    return this.tickets().filter(t =>
      t.ticketCode.toLowerCase().includes(kw) ||
      t.subject.toLowerCase().includes(kw) ||
      t.createdBy?.fullName?.toLowerCase().includes(kw)
    );
  });

  // ─── Data loading ───
  async load(page = 1) {
    this.loading.set(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (this.filter.status) params['status'] = this.filter.status;
      if (this.filter.type) params['type'] = this.filter.type;
      if (this.filter.priority) params['priority'] = this.filter.priority;

      let result: TicketListResult;
      if (this.activeTab === 'assigned') {
        result = await this.ticketService.getAssignedToMe(params);
      } else if (this.activeTab === 'my' || !this.isStaff()) {
        result = await this.ticketService.getMyTickets(params);
      } else {
        result = await this.ticketService.findAll(params);
      }

      this.tickets.set(result.data);
      this.totalPages.set(result.meta.totalPages);
      this.currentPage.set(result.meta.page);
    } catch (e) {
      console.error('Failed to load tickets', e);
    } finally {
      this.loading.set(false);
    }
  }

  async loadStats() {
    try {
      const stats = await this.ticketService.getStats();
      this.serverStats.set(stats);
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    this.load();
  }

  goPage(p: number) { this.load(p); }

  // ─── View detail ───
  private async openTicketById(ticketId: string, syncRoute = false) {
    try {
      const full = await this.ticketService.findById(ticketId);
      this.selectedTicket.set(full);
      this.editPriority = full.priority;
      await this.loadComments(full._id);
      if (syncRoute) {
        void this.syncTicketQueryParam(full._id);
      }
    } catch (e) {
      console.error('Failed to load ticket', e);
      if (syncRoute) {
        void this.syncTicketQueryParam(null);
      }
    }
  }

  async viewTicket(ticket: TicketItem) {
    await this.openTicketById(ticket._id, true);
  }

  openSourceConversation() {
    const conversationId = this.getSourceConversationId();
    if (!conversationId) return;

    const targetRoute = this.isParent() ? '/app/parent-chat' : '/app/messages';

    void this.router.navigate([targetRoute], {
      queryParams: { conversationId },
    });
  }

  private syncTicketQueryParam(ticketId: string | null) {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ticketId: ticketId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  async loadComments(ticketId: string) {
    try {
      const c = await this.ticketService.getComments(ticketId);
      this.comments.set(c);
    } catch (e) {
      console.error('Failed to load comments', e);
    }
  }

  closeDetail() {
    this.selectedTicket.set(null);
    this.comments.set([]);
    this.newComment = '';
    this.newCommentInternal = false;
    void this.syncTicketQueryParam(null);
    this.load(this.currentPage());
  }

  // ─── Create ───
  openCreateModal() { this.createForm = { type: '', subject: '', description: '', priority: 'MEDIUM' }; this.createError.set(''); this.showCreateModal.set(true); }
  closeCreateModal() { this.showCreateModal.set(false); }

  async submitCreate() {
    if (!this.createForm.type || !this.createForm.subject || !this.createForm.description) {
      this.createError.set('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    this.creating.set(true);
    this.createError.set('');
    try {
      await this.ticketService.create(this.createForm);
      this.closeCreateModal();
      this.load();
    } catch (e: any) {
      this.createError.set(e?.message || 'Không thể tạo ticket');
    } finally {
      this.creating.set(false);
    }
  }

  // ─── Resolve ───
  openResolveModal() { this.resolveForm = { outcome: 'APPROVED', summary: '', refundAmount: 0 }; this.resolveError.set(''); this.showResolveModal.set(true); }
  closeResolveModal() { this.showResolveModal.set(false); }

  async submitResolve() {
    if (!this.resolveForm.summary) { this.resolveError.set('Vui lòng nhập tóm tắt kết quả.'); return; }
    this.resolving.set(true);
    this.resolveError.set('');
    try {
      const updated = await this.ticketService.resolve(this.selectedTicket()!._id, this.resolveForm);
      this.selectedTicket.set(updated);
      this.closeResolveModal();
      await this.loadComments(updated._id);
    } catch (e: any) {
      this.resolveError.set(e?.message || 'Không thể giải quyết ticket');
    } finally {
      this.resolving.set(false);
    }
  }

  // ─── Comment ───
  async submitComment() {
    const t = this.selectedTicket();
    if (!t || !this.newComment.trim()) return;
    this.submittingComment.set(true);
    try {
      await this.ticketService.addComment(t._id, {
        content: this.newComment.trim(),
        isInternal: this.newCommentInternal,
      });
      this.newComment = '';
      this.newCommentInternal = false;
      // Reload both ticket (for status auto-transition) and comments
      const [full] = await Promise.all([
        this.ticketService.findById(t._id),
        this.loadComments(t._id),
      ]);
      this.selectedTicket.set(full);
    } catch (e) {
      console.error('Failed to add comment', e);
    } finally {
      this.submittingComment.set(false);
    }
  }

  // ─── Workflow actions ───
  async doAction(action: string) {
    const t = this.selectedTicket();
    if (!t) return;
    const confirmMsg: Record<string, string> = {
      start: 'Nhận xử lý ticket này?',
      'request-info': 'Yêu cầu thêm thông tin?',
      close: 'Đóng ticket này?',
      cancel: 'Hủy ticket này?',
      reopen: 'Mở lại ticket này?',
    };
    if (!confirm(confirmMsg[action] || `Thực hiện ${action}?`)) return;

    try {
      let updated: TicketItem;
      switch (action) {
        case 'start': updated = await this.ticketService.startProcessing(t._id); break;
        case 'request-info': updated = await this.ticketService.requestInfo(t._id); break;
        case 'close': updated = await this.ticketService.close(t._id); break;
        case 'cancel': updated = await this.ticketService.cancel(t._id); break;
        case 'reopen': updated = await this.ticketService.reopen(t._id); break;
        default: return;
      }
      // Reload full ticket with populated refs
      const full = await this.ticketService.findById(t._id);
      this.selectedTicket.set(full);
    } catch (e: any) {
      alert(e?.message || 'Thao tác thất bại');
    }
  }

  // ─── Update Priority ───
  async updatePriority() {
    const t = this.selectedTicket();
    if (!t || !this.editPriority) return;
    try {
      await this.ticketService.update(t._id, { priority: this.editPriority });
      const full = await this.ticketService.findById(t._id);
      this.selectedTicket.set(full);
    } catch (e: any) {
      alert(e?.message || 'Không thể cập nhật mức ưu tiên');
    }
  }
}
