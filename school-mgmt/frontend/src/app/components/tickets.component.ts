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
  templateUrl: './tickets.component.html',
  styleUrls: ['./tickets.component.css'],
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
  workflowActionPending = signal(false);
  createError = signal('');
  resolveError = signal('');
  loading = signal(false);

  // ─── Filters ───
  activeTab = 'my';
  filter: { status: string; type: string; priority: string; overdue: boolean } = {
    status: '',
    type: '',
    priority: '',
    overdue: false,
  };
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
    this.applyInitialQueryParams();
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

  refundLedgerWarningMessage(): string {
    return 'Ticket refund nay chua duoc lien ket LedgerEntry giao dich vi. Ke toan can tao giao dich hoan tien truoc khi dong ticket.';
  }

  getRefundLedgerEntryId(ticket = this.selectedTicket()): string {
    const value = ticket?.resolution?.refundLedgerEntryId;
    if (!value) return '';
    return typeof value === 'string' ? value : value._id || '';
  }

  requiresRefundLedgerBeforeClose(ticket = this.selectedTicket()): boolean {
    if (!ticket) return false;
    if (ticket.type !== TicketType.REFUND_REQUEST) return false;
    if (ticket.status !== TicketStatus.RESOLVED) return false;
    const refundAmount = Number(ticket.resolution?.refundAmount || 0);
    if (refundAmount <= 0) return false;
    return !this.getRefundLedgerEntryId(ticket);
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
      if (this.filter.overdue) params['overdue'] = 'true';

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

  private applyInitialQueryParams() {
    const query = this.route.snapshot.queryParamMap;
    const requestedTab = query.get('tab');
    if (requestedTab === 'all' && this.isStaff()) {
      this.activeTab = 'all';
    } else if (requestedTab === 'assigned' && this.isOps()) {
      this.activeTab = 'assigned';
    } else if (requestedTab === 'my') {
      this.activeTab = 'my';
    }

    const status = query.get('status');
    if (status && this.statusOptions.some((item) => item.value === status)) {
      this.filter.status = status;
    }

    const type = query.get('type');
    if (type && this.typeOptions.some((item) => item.value === type)) {
      this.filter.type = type;
    }

    const priority = query.get('priority');
    if (priority && this.priorityOptions.some((item) => item.value === priority)) {
      this.filter.priority = priority;
    }

    this.filter.overdue = query.get('overdue') === 'true';
  }

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
    if (this.creating()) return;
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
    if (this.resolving()) return;
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
    if (this.workflowActionPending()) return;
    if (action === 'close' && this.requiresRefundLedgerBeforeClose(t)) {
      alert(this.refundLedgerWarningMessage());
      return;
    }
    const confirmMsg: Record<string, string> = {
      start: 'Nhận xử lý ticket này?',
      'request-info': 'Yêu cầu thêm thông tin?',
      close: 'Đóng ticket này?',
      cancel: 'Hủy ticket này?',
      reopen: 'Mở lại ticket này?',
    };
    if (!confirm(confirmMsg[action] || `Thực hiện ${action}?`)) return;

    try {
      this.workflowActionPending.set(true);
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
    } finally {
      this.workflowActionPending.set(false);
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
