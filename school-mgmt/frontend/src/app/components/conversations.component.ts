import { Component, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatbotService, ConversationItem, MessageItem, FanpageItem } from '../services/chatbot.service';
import { AuthService } from '../services/auth.service';
import { ChatbotSocketService } from '../services/chatbot-socket.service';
import { UserService, UserItem } from '../services/user.service';
import { Role } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';

const PLATFORM_LABELS: Record<string, string> = { FACEBOOK: 'Facebook', TIKTOK: 'TikTok' };
const STATUS_LABELS: Record<string, string> = { AI_HANDLING: 'AI xử lý', HUMAN_HANDLING: 'Nhân viên', CLOSED: 'Đã đóng' };
const STATUS_COLORS: Record<string, string> = { AI_HANDLING: '#3b82f6', HUMAN_HANDLING: '#10b981', CLOSED: '#6b7280' };

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Hội thoại Chatbot</h2>
      <p>Quản lý hội thoại với khách hàng từ fanpage.</p>
    </div>
  </header>

  <app-flow-guide featureKey="conversations"></app-flow-guide>

  <div class="conv-layout">
    <!-- LEFT: Conversation List -->
    <div class="conv-list-panel">
      <div class="list-filters">
        <input placeholder="Tìm tên, SĐT..." [(ngModel)]="searchKeyword" (ngModelChange)="loadConversations()" />
        <select [(ngModel)]="filterStatus" (ngModelChange)="loadConversations()">
          <option value="">Tất cả</option>
          <option value="AI_HANDLING">AI xử lý</option>
          <option value="HUMAN_HANDLING">Nhân viên</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
        <select [(ngModel)]="filterFanpageId" (ngModelChange)="loadConversations()">
          <option value="">Tất cả fanpage</option>
          <option *ngFor="let fp of fanpages()" [value]="fp._id">{{fp.name}}</option>
        </select>
      </div>

      <div class="conv-cards" *ngIf="conversations().length; else emptyConvs">
        <div class="conv-card"
          *ngFor="let c of conversations()"
          [class.selected]="selectedConv()?._id === c._id"
          (click)="selectConversation(c)">
          <div class="conv-card-header">
            <span class="customer-name">{{c.customerName || 'Khách #' + c.platformUserId.slice(-6)}}</span>
            <span class="conv-time">{{formatTime(c.lastMessageAt)}}</span>
          </div>
          <div class="conv-card-meta">
            <span class="badge small" [style.background]="statusColor(c.status)">{{statusLabel(c.status)}}</span>
            <span class="platform-tag">{{platformLabel(c.platform)}}</span>
            <span class="conv-count">{{c.messageCount}} tin</span>
          </div>
          <div class="conv-card-fanpage">{{c.fanpageName}}</div>
        </div>
      </div>
      <ng-template #emptyConvs>
        <div class="empty-list">Chưa có hội thoại.</div>
      </ng-template>

      <!-- Pagination -->
      <div class="list-pagination" *ngIf="totalConvs() > 20">
        <button class="ghost" (click)="prevPage()" [disabled]="convPage <= 1">&#9664;</button>
        <span>{{convPage}}/{{totalPages()}}</span>
        <button class="ghost" (click)="nextPage()" [disabled]="convPage >= totalPages()">&#9654;</button>
      </div>
    </div>

    <!-- CENTER: Chat Messages -->
    <div class="chat-panel" *ngIf="selectedConv(); else noSelection">
      <div class="chat-header">
        <div class="chat-header-info">
          <strong>{{selectedConv()!.customerName || 'Khách #' + selectedConv()!.platformUserId.slice(-6)}}</strong>
          <span class="badge small" [style.background]="statusColor(selectedConv()!.status)">{{statusLabel(selectedConv()!.status)}}</span>
          <span class="platform-tag">{{platformLabel(selectedConv()!.platform)}} - {{selectedConv()!.fanpageName}}</span>
        </div>
        <div class="chat-header-actions">
          <button class="primary small" *ngIf="selectedConv()!.status === 'AI_HANDLING'" (click)="takeover()">Tiếp quản</button>
          <button class="secondary small" *ngIf="selectedConv()!.status === 'HUMAN_HANDLING'" (click)="release()">Trả AI</button>
          <button class="ghost small" *ngIf="selectedConv()!.status !== 'CLOSED'" (click)="closeConversation()">Đóng</button>
        </div>
      </div>

      <div class="messages-area" #messagesArea (scroll)="onMessagesScroll($event)">
        <div class="messages-list">
          <div *ngFor="let msg of messages()"
            class="message-bubble"
            [class.customer]="msg.senderType === 'CUSTOMER'"
            [class.ai]="msg.senderType === 'AI'"
            [class.agent]="msg.senderType === 'HUMAN_AGENT'">
            <div class="msg-sender">
              <span class="sender-label" *ngIf="msg.senderType === 'CUSTOMER'">Khách hàng</span>
              <span class="sender-label ai-label" *ngIf="msg.senderType === 'AI'">AI</span>
              <span class="sender-label agent-label" *ngIf="msg.senderType === 'HUMAN_AGENT'">{{msg.senderName || 'Nhân viên'}}</span>
              <span class="msg-time">{{formatTime(msg.createdAt)}}</span>
            </div>
            <div class="msg-content">{{msg.content}}</div>
            <div class="msg-status" *ngIf="msg.status === 'FAILED'">
              <span class="failed-badge">Gửi thất bại</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input" *ngIf="selectedConv()!.status === 'HUMAN_HANDLING'">
        <textarea [(ngModel)]="messageInput" placeholder="Nhập tin nhắn..." rows="2"
          (keydown.enter)="$event.preventDefault(); sendMessage()"></textarea>
        <button class="primary" (click)="sendMessage()" [disabled]="!messageInput.trim() || sending()">
          {{sending() ? 'Đang gửi...' : 'Gửi'}}
        </button>
      </div>
      <div class="chat-input-disabled" *ngIf="selectedConv()!.status === 'AI_HANDLING'">
        <p>AI đang xử lý hội thoại. Nhấn "Tiếp quản" để gửi tin nhắn.</p>
      </div>
      <div class="chat-input-disabled" *ngIf="selectedConv()!.status === 'CLOSED'">
        <p>Hội thoại đã đóng.</p>
      </div>
    </div>
    <ng-template #noSelection>
      <div class="chat-panel no-selection">
        <div class="empty-chat">Chọn một hội thoại để xem tin nhắn</div>
      </div>
    </ng-template>

    <!-- RIGHT: Customer Sidebar -->
    <div class="sidebar-panel" *ngIf="selectedConv()">
      <div class="sidebar-section">
        <h4>Thông tin khách hàng</h4>
        <label>Tên</label>
        <input [(ngModel)]="sidebarForm.customerName" placeholder="Tên khách" (blur)="updateCustomerInfo()" />
        <label>Số điện thoại</label>
        <input [(ngModel)]="sidebarForm.customerPhone" placeholder="SĐT" (blur)="updateCustomerInfo()" />
        <label>Email</label>
        <input [(ngModel)]="sidebarForm.customerEmail" placeholder="Email" (blur)="updateCustomerInfo()" />
      </div>

      <div class="sidebar-section">
        <h4>Thông tin hội thoại</h4>
        <div class="info-row"><span class="info-label">Mã:</span> <span>{{selectedConv()!.conversationCode}}</span></div>
        <div class="info-row"><span class="info-label">Fanpage:</span> <span>{{selectedConv()!.fanpageName}}</span></div>
        <div class="info-row"><span class="info-label">Nền tảng:</span> <span>{{platformLabel(selectedConv()!.platform)}}</span></div>
        <div class="info-row" *ngIf="selectedConv()!.assignedAgentName">
          <span class="info-label">Nhân viên:</span> <span>{{selectedConv()!.assignedAgentName}}</span>
        </div>
        <div class="info-row" *ngIf="selectedConv()!.adGroupName">
          <span class="info-label">Nhóm QC:</span> <span class="badge small" style="background:#8b5cf6">{{selectedConv()!.adGroupName}}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <h4>Ghi chú</h4>
        <textarea [(ngModel)]="sidebarForm.notes" rows="3" placeholder="Ghi chú..." (blur)="updateCustomerInfo()"></textarea>
      </div>

      <div class="sidebar-section" *ngIf="!selectedConv()!.leadId">
        <h4>Tạo Lead</h4>
        <button class="primary full-width" (click)="showLeadForm.set(true)" *ngIf="!showLeadForm()">+ Tạo Lead từ hội thoại</button>
        <div *ngIf="showLeadForm()" class="inline-form">
          <label>Tên phụ huynh *</label>
          <input [(ngModel)]="leadForm.parentName" />
          <label>SĐT *</label>
          <input [(ngModel)]="leadForm.parentPhone" />
          <label>Email</label>
          <input [(ngModel)]="leadForm.parentEmail" />
          <label>Tên học sinh</label>
          <input [(ngModel)]="leadForm.studentName" />
          <label *ngIf="!isSaleRole">Sale phá»¥ trÃ¡ch</label>
          <select *ngIf="!isSaleRole" [(ngModel)]="leadForm.saleId">
            <option value="">-- Chá»n sale --</option>
            <option *ngFor="let sale of sales()" [value]="sale._id">{{sale.fullName}}</option>
          </select>
          <label *ngIf="isSaleRole">Sale phá»¥ trÃ¡ch</label>
          <input *ngIf="isSaleRole" [value]="currentUserName" disabled />
          <label>Ghi chú</label>
          <textarea [(ngModel)]="leadForm.notes" rows="2"></textarea>
          <div class="form-actions">
            <button class="secondary" (click)="showLeadForm.set(false)">Hủy</button>
            <button class="primary" (click)="createLead()" [disabled]="savingLead()">{{savingLead() ? 'Đang tạo...' : 'Tạo Lead'}}</button>
          </div>
          <p class="error" *ngIf="leadError()">{{leadError()}}</p>
        </div>
      </div>
      <div class="sidebar-section" *ngIf="selectedConv()!.leadId">
        <div class="linked-entity">Lead đã tạo</div>
      </div>

      <div class="sidebar-section" *ngIf="!selectedConv()!.orderId">
        <h4>Tạo Đơn hàng</h4>
        <button class="primary full-width" (click)="showOrderForm.set(true)" *ngIf="!showOrderForm()">+ Tạo đơn từ hội thoại</button>
        <div *ngIf="showOrderForm()" class="inline-form">
          <label>Tên phụ huynh *</label>
          <input [(ngModel)]="orderForm.parentName" />
          <label>SĐT *</label>
          <input [(ngModel)]="orderForm.parentPhone" />
          <label>Tên học sinh</label>
          <input [(ngModel)]="orderForm.studentName" />
          <label *ngIf="!isSaleRole">Sale phá»¥ trÃ¡ch</label>
          <select *ngIf="!isSaleRole" [(ngModel)]="orderForm.saleId">
            <option value="">-- Chá»n sale --</option>
            <option *ngFor="let sale of sales()" [value]="sale._id">{{sale.fullName}}</option>
          </select>
          <label *ngIf="isSaleRole">Sale phá»¥ trÃ¡ch</label>
          <input *ngIf="isSaleRole" [value]="currentUserName" disabled />
          <label>Ghi chú</label>
          <textarea [(ngModel)]="orderForm.notes" rows="2"></textarea>
          <p class="hint">Các mục sản phẩm có thể thêm sau khi tạo đơn.</p>
          <div class="form-actions">
            <button class="secondary" (click)="showOrderForm.set(false)">Hủy</button>
            <button class="primary" (click)="createOrder()" [disabled]="savingOrder()">{{savingOrder() ? 'Đang tạo...' : 'Tạo đơn'}}</button>
          </div>
          <p class="error" *ngIf="orderError()">{{orderError()}}</p>
        </div>
      </div>
      <div class="sidebar-section" *ngIf="selectedConv()!.orderId">
        <div class="linked-entity">Đơn hàng đã tạo</div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; height: calc(100vh - 70px); box-sizing: border-box; }
    .page-header { margin-bottom: 16px; }
    .page-header h2 { margin: 0 0 4px; font-size: 22px; }
    .page-header p { margin: 0; color: #666; font-size: 14px; }

    .conv-layout { display: flex; gap: 16px; height: calc(100% - 60px); }

    /* LEFT PANEL */
    .conv-list-panel { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; overflow: hidden; }
    .list-filters { padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; flex-direction: column; gap: 6px; }
    .list-filters input, .list-filters select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; width: 100%; box-sizing: border-box; }
    .conv-cards { flex: 1; overflow-y: auto; }
    .conv-card { padding: 12px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background .15s; }
    .conv-card:hover { background: #f8fafc; }
    .conv-card.selected { background: #eff6ff; border-left: 3px solid #2563eb; }
    .conv-card-header { display: flex; justify-content: space-between; align-items: center; }
    .customer-name { font-weight: 600; font-size: 13px; color: #1f2937; }
    .conv-time { font-size: 11px; color: #9ca3af; }
    .conv-card-meta { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
    .platform-tag { font-size: 11px; color: #6b7280; }
    .conv-count { font-size: 11px; color: #9ca3af; }
    .conv-card-fanpage { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .empty-list { text-align: center; padding: 40px 16px; color: #9ca3af; font-size: 13px; }
    .list-pagination { padding: 8px 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: center; align-items: center; gap: 12px; font-size: 12px; color: #6b7280; }

    /* CENTER PANEL */
    .chat-panel { flex: 1; display: flex; flex-direction: column; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; overflow: hidden; min-width: 0; }
    .chat-panel.no-selection { justify-content: center; align-items: center; }
    .empty-chat { color: #9ca3af; font-size: 14px; }
    .chat-header { padding: 12px 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .chat-header-info { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chat-header-info strong { font-size: 14px; }
    .chat-header-actions { display: flex; gap: 6px; }

    .messages-area { flex: 1; overflow-y: auto; padding: 16px; background: #f8fafc; }
    .messages-list { display: flex; flex-direction: column; gap: 12px; }

    .message-bubble { max-width: 75%; padding: 10px 14px; border-radius: 12px; }
    .message-bubble.customer { align-self: flex-start; background: #fff; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
    .message-bubble.ai { align-self: flex-start; background: #dbeafe; border: 1px solid #93c5fd; border-bottom-left-radius: 4px; }
    .message-bubble.agent { align-self: flex-end; background: #dcfce7; border: 1px solid #86efac; border-bottom-right-radius: 4px; margin-left: auto; }
    .msg-sender { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .sender-label { font-size: 11px; font-weight: 600; color: #6b7280; }
    .sender-label.ai-label { color: #2563eb; }
    .sender-label.agent-label { color: #16a34a; }
    .msg-time { font-size: 10px; color: #9ca3af; }
    .msg-content { font-size: 13px; line-height: 1.5; color: #1f2937; white-space: pre-wrap; word-break: break-word; }
    .msg-status .failed-badge { font-size: 10px; color: #ef4444; }

    .chat-input { padding: 12px 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; align-items: flex-end; }
    .chat-input textarea { flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 13px; resize: none; font-family: inherit; }
    .chat-input-disabled { padding: 12px 16px; border-top: 1px solid #e5e7eb; text-align: center; }
    .chat-input-disabled p { margin: 0; color: #9ca3af; font-size: 13px; }

    /* RIGHT PANEL */
    .sidebar-panel { width: 280px; flex-shrink: 0; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; overflow-y: auto; padding: 16px; }
    .sidebar-section { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
    .sidebar-section:last-child { border-bottom: none; }
    .sidebar-section h4 { margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #374151; text-transform: uppercase; }
    .sidebar-section label { display: block; font-size: 12px; color: #6b7280; margin: 8px 0 2px; }
    .sidebar-section input, .sidebar-section textarea, .sidebar-section select { width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; box-sizing: border-box; }
    .sidebar-section textarea { resize: vertical; }
    .info-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; color: #4b5563; }
    .info-label { color: #9ca3af; }
    .linked-entity { padding: 8px 12px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; font-size: 12px; color: #16a34a; font-weight: 500; text-align: center; }

    .inline-form { margin-top: 8px; }
    .inline-form label { font-size: 11px; margin: 6px 0 2px; }
    .inline-form input, .inline-form textarea { font-size: 12px; padding: 5px 8px; }
    .form-actions { display: flex; gap: 6px; margin-top: 10px; }
    .hint { font-size: 11px; color: #9ca3af; margin: 4px 0; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; color: #fff; }
    .badge.small { padding: 1px 6px; font-size: 9px; }

    button.primary { padding: 6px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; }
    button.primary:hover { background: #1d4ed8; }
    button.primary:disabled { opacity: .6; cursor: not-allowed; }
    button.primary.small { padding: 4px 12px; font-size: 11px; }
    button.primary.full-width { width: 100%; }
    button.secondary { padding: 6px 16px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 12px; }
    button.secondary.small { padding: 4px 12px; font-size: 11px; }
    button.ghost { padding: 4px 10px; background: none; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 11px; }
    button.ghost.small { padding: 3px 8px; }
    .error { color: #ef4444; font-size: 11px; margin-top: 4px; }

    @media (max-width: 1200px) {
      .sidebar-panel { width: 240px; }
      .conv-list-panel { width: 260px; }
    }
    @media (max-width: 900px) {
      .conv-layout { flex-direction: column; height: auto; }
      .conv-list-panel, .chat-panel, .sidebar-panel { width: 100%; }
      .chat-panel { min-height: 400px; }
    }
  `],
})
export class ConversationsComponent implements OnInit, OnDestroy {
  @ViewChild('messagesArea') messagesArea!: ElementRef;

  // Conversation list
  conversations = signal<ConversationItem[]>([]);
  totalConvs = signal(0);
  convPage = 1;
  searchKeyword = '';
  filterStatus = '';
  filterFanpageId = '';
  fanpages = signal<FanpageItem[]>([]);
  sales = signal<UserItem[]>([]);
  isSaleRole = false;
  currentUserId = '';
  currentUserName = '';

  totalPages = computed(() => Math.ceil(this.totalConvs() / 20) || 1);

  // Selected conversation
  selectedConv = signal<ConversationItem | null>(null);
  messages = signal<MessageItem[]>([]);
  messageInput = '';
  sending = signal(false);

  // Messages pagination for infinite scroll
  private messagesPage = 1;
  private messageTotal = 0;
  private loadingMoreMessages = false;

  // Sidebar form
  sidebarForm = { customerName: '', customerPhone: '', customerEmail: '', notes: '' };

  // Lead/Order forms
  showLeadForm = signal(false);
  leadForm = { parentName: '', parentPhone: '', parentEmail: '', studentName: '', notes: '', saleId: '' };
  savingLead = signal(false);
  leadError = signal('');

  showOrderForm = signal(false);
  orderForm = { parentName: '', parentPhone: '', studentName: '', notes: '', saleId: '' };
  savingOrder = signal(false);
  orderError = signal('');

  private socketSubs: Subscription[] = [];

  constructor(
    private chatbotService: ChatbotService,
    private authService: AuthService,
    private socketService: ChatbotSocketService,
    private userService: UserService,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    const currentUser = this.authService.userSignal();
    this.isSaleRole = currentUser?.role === Role.SALE;
    this.currentUserId = currentUser?.sub || '';
    this.currentUserName = currentUser?.fullName || '';
    this.loadFanpages();
    if (!this.isSaleRole) {
      void this.loadSales();
    }
    this.loadConversations();

    // Connect WebSocket and subscribe to real-time events
    this.socketService.connect();

    // New message in the open conversation
    this.socketSubs.push(
      this.socketService.newMessage$.subscribe(event => {
        this.ngZone.run(() => {
          const conv = this.selectedConv();
          if (!conv || event.conversationId !== conv._id) return;
          const current = this.messages();
          // Avoid duplicate messages
          if (current.some(m => m._id === event.message._id)) return;
          this.messages.set([...current, event.message]);
          this.messageTotal++;
          setTimeout(() => this.scrollToBottom(), 50);
        });
      })
    );

    // Conversation list updates (new conv, status change, last message)
    this.socketSubs.push(
      this.socketService.conversationUpdated$.subscribe(event => {
        this.ngZone.run(() => {
        const incoming = event.conversation;
        const list = this.conversations();
        const idx = list.findIndex(c => c._id === incoming._id);
        if (idx !== -1) {
          const merged = { ...list[idx], ...incoming };
          const updated = [...list];
          updated.splice(idx, 1);
          this.conversations.set([merged, ...updated]);

          const selected = this.selectedConv();
          if (selected?._id === merged._id) {
            this.selectedConv.set({ ...selected, ...incoming });
          }
        } else {
          // New conversation not yet in list — re-fetch page 1
          void this.loadConversations();
        }
        });
      })
    );
  }

  ngOnDestroy() {
    this.socketSubs.forEach(s => s.unsubscribe());
    const conv = this.selectedConv();
    if (conv) this.socketService.leaveConversation(conv._id);
    this.socketService.disconnect();
  }

  platformLabel(p: string) { return PLATFORM_LABELS[p] || p; }
  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#999'; }

  formatTime(d?: string) {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`;
    if (diff < 86400000) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  // ─── Load data ──────────────────────────────────────────────

  async loadFanpages() {
    try {
      const res = await this.chatbotService.listFanpages({ limit: '100' });
      this.fanpages.set(res.data);
    } catch {}
  }

  async loadSales() {
    this.sales.set(await this.userService.listSales());
  }

  async loadConversations() {
    try {
      const params: Record<string, string> = { page: String(this.convPage), limit: '20' };
      if (this.searchKeyword) params['search'] = this.searchKeyword;
      if (this.filterStatus) params['status'] = this.filterStatus;
      if (this.filterFanpageId) params['fanpageId'] = this.filterFanpageId;
      const res = await this.chatbotService.listConversations(params);
      this.conversations.set(res.data);
      this.totalConvs.set(res.total);
    } catch {}
  }

  prevPage() { if (this.convPage > 1) { this.convPage--; this.loadConversations(); } }
  nextPage() { if (this.convPage < this.totalPages()) { this.convPage++; this.loadConversations(); } }

  // ─── Select conversation ────────────────────────────────────

  async selectConversation(conv: ConversationItem) {
    // Leave previous conversation room
    const prev = this.selectedConv();
    if (prev) this.socketService.leaveConversation(prev._id);

    this.selectedConv.set(conv);
    this.sidebarForm = {
      customerName: conv.customerName || '',
      customerPhone: conv.customerPhone || '',
      customerEmail: conv.customerEmail || '',
      notes: conv.notes || '',
    };

    // Pre-fill lead/order forms
    this.leadForm = {
      parentName: conv.customerName || '', parentPhone: conv.customerPhone || '',
      parentEmail: conv.customerEmail || '', studentName: '', notes: '', saleId: this.defaultSaleId(conv),
    };
    this.orderForm = {
      parentName: conv.customerName || '', parentPhone: conv.customerPhone || '',
      studentName: '', notes: '', saleId: this.defaultSaleId(conv),
    };
    this.showLeadForm.set(false);
    this.showOrderForm.set(false);

    // Reset pagination and load first page of messages
    this.messagesPage = 1;
    this.messageTotal = 0;
    this.loadingMoreMessages = false;
    await this.loadMessages(true);

    // Join WebSocket room for real-time updates
    this.socketService.joinConversation(conv._id);
  }

  private defaultSaleId(conv: ConversationItem): string {
    if (this.isSaleRole) return this.currentUserId;
    const assignedId = conv.assignedAgentId || '';
    return this.sales().some((sale) => sale._id === assignedId) ? assignedId : '';
  }

  async loadMessages(initial = false) {
    const conv = this.selectedConv();
    if (!conv) return;
    try {
      const pageSize = 50;
      const res = await this.chatbotService.getMessages(conv._id, {
        page: String(this.messagesPage),
        limit: String(pageSize),
      });
      this.messageTotal = res.total;
      if (initial) {
        this.messages.set(res.data);
        setTimeout(() => this.scrollToBottom(), 100);
      } else {
        // Prepend older messages, preserve scroll position
        const area = this.messagesArea?.nativeElement as HTMLElement;
        const prevHeight = area?.scrollHeight ?? 0;
        this.messages.set([...res.data, ...this.messages()]);
        setTimeout(() => {
          if (area) area.scrollTop = area.scrollHeight - prevHeight;
        }, 50);
      }
    } catch {}
  }

  /** Called when user scrolls to the top — load the previous page */
  async onMessagesScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (el.scrollTop !== 0) return;
    if (this.loadingMoreMessages) return;
    if (this.messages().length >= this.messageTotal) return;

    this.loadingMoreMessages = true;
    this.messagesPage++;
    await this.loadMessages(false);
    this.loadingMoreMessages = false;
  }

  private scrollToBottom() {
    try {
      if (this.messagesArea?.nativeElement) {
        this.messagesArea.nativeElement.scrollTop = this.messagesArea.nativeElement.scrollHeight;
      }
    } catch {}
  }

  // ─── Chat actions ───────────────────────────────────────────

  async sendMessage() {
    const conv = this.selectedConv();
    if (!conv || !this.messageInput.trim()) return;
    this.sending.set(true);
    const content = this.messageInput.trim();
    const res = await this.chatbotService.sendMessage(conv._id, content);
    this.sending.set(false);
    if (res.ok) {
      this.messageInput = '';
      // The sent message will arrive via WebSocket. As a fallback, reload if
      // the socket is not yet subscribed to this conversation room.
      await this.loadMessages(true);
    }
  }

  async takeover() {
    const conv = this.selectedConv();
    if (!conv) return;
    const res = await this.chatbotService.takeoverConversation(conv._id);
    if (res.ok) {
      const updated = await this.chatbotService.getConversation(conv._id);
      this.selectedConv.set(updated);
      await this.loadConversations();
    }
  }

  async release() {
    const conv = this.selectedConv();
    if (!conv) return;
    const res = await this.chatbotService.releaseConversation(conv._id);
    if (res.ok) {
      const updated = await this.chatbotService.getConversation(conv._id);
      this.selectedConv.set(updated);
      await this.loadConversations();
    }
  }

  async closeConversation() {
    const conv = this.selectedConv();
    if (!conv) return;
    if (!confirm('Đóng hội thoại này?')) return;
    const res = await this.chatbotService.updateConversation(conv._id, { status: 'CLOSED' });
    if (res.ok) {
      const updated = await this.chatbotService.getConversation(conv._id);
      this.selectedConv.set(updated);
      await this.loadConversations();
    }
  }

  // ─── Sidebar ────────────────────────────────────────────────

  async updateCustomerInfo() {
    const conv = this.selectedConv();
    if (!conv) return;
    await this.chatbotService.updateConversation(conv._id, {
      customerName: this.sidebarForm.customerName,
      customerPhone: this.sidebarForm.customerPhone,
      customerEmail: this.sidebarForm.customerEmail,
      notes: this.sidebarForm.notes,
    });
  }

  // ─── Create Lead ────────────────────────────────────────────

  async createLead() {
    const conv = this.selectedConv();
    if (!conv) return;
    if (!this.leadForm.parentName || !this.leadForm.parentPhone) {
      this.leadError.set('Tên và SĐT là bắt buộc');
      return;
    }
    this.savingLead.set(true);
    this.leadError.set('');
    const res = await this.chatbotService.createLeadFromConversation(conv._id, this.leadForm);
    this.savingLead.set(false);
    if (res.ok) {
      this.showLeadForm.set(false);
      // Refresh conversation to get leadId
      const updated = await this.chatbotService.getConversation(conv._id);
      this.selectedConv.set(updated);
      await this.loadConversations();
    } else {
      this.leadError.set(res.message || 'Tạo lead thất bại');
    }
  }

  // ─── Create Order ───────────────────────────────────────────

  async createOrder() {
    const conv = this.selectedConv();
    if (!conv) return;
    if (!this.orderForm.parentName || !this.orderForm.parentPhone) {
      this.orderError.set('Tên và SĐT là bắt buộc');
      return;
    }
    this.savingOrder.set(true);
    this.orderError.set('');
    const res = await this.chatbotService.createOrderFromConversation(conv._id, {
      ...this.orderForm,
      items: [],
    });
    this.savingOrder.set(false);
    if (res.ok) {
      this.showOrderForm.set(false);
      const updated = await this.chatbotService.getConversation(conv._id);
      this.selectedConv.set(updated);
      await this.loadConversations();
    } else {
      this.orderError.set(res.message || 'Tạo đơn thất bại');
    }
  }
}
