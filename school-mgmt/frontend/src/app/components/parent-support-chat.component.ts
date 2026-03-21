import {
  Component,
  computed,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MessageService } from '../services/message.service';
import { StudentItem, StudentService } from '../services/student.service';
import { UserItem, UserService } from '../services/user.service';

interface SupportParticipant {
  _id: string;
  fullName: string;
  role: string;
}

interface SupportConversation {
  _id: string;
  participants: SupportParticipant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  conversationKind?: string;
  topicStudentId?:
    | string
    | {
        _id: string;
        fullName?: string;
        studentCode?: string;
      };
  topicStudentName?: string;
}

interface SupportMessage {
  _id: string;
  senderId: {
    _id: string;
    fullName: string;
    role: string;
  };
  senderType?: string;
  handoffTicketId?: string;
  handoffTicketCode?: string;
  content: string;
  readAt?: string | null;
  createdAt?: string;
}

interface QuickAction {
  key: string;
  label: string;
  prompt: string;
}

const SUPPORT_ROLES = ['DIRECTOR', 'OPS', 'SALE'];
const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'progress',
    label: 'Tiến độ',
    prompt: 'Cho mình hỏi hiện tại con đang học đến phần nào và tiến độ lớp ra sao?',
  },
  {
    key: 'homework',
    label: 'Bài tập',
    prompt: 'Hiện tại con có bài tập nào cần làm hoặc cần nộp không?',
  },
  {
    key: 'schedule',
    label: 'Lịch học',
    prompt: 'Cho mình hỏi lịch học sắp tới của con là khi nào?',
  },
  {
    key: 'teacher-feedback',
    label: 'Nhận xét',
    prompt: 'Nhờ trung tâm gửi giúp nhận xét gần nhất của giáo viên về tình hình học của con.',
  },
  {
    key: 'reschedule',
    label: 'Đổi lịch',
    prompt: 'Mình cần được hỗ trợ đổi lịch học cho con, nhờ trung tâm kiểm tra giúp.',
  },
];

@Component({
  selector: 'app-parent-support-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <header class="page-header">
    <div>
      <h2>Chat hỗ trợ phụ huynh</h2>
      <p>Trao đổi trực tiếp với sale hoặc vận hành đang phụ trách con của bạn.</p>
    </div>
    <button type="button" class="secondary" (click)="startFresh()" *ngIf="selectedConversation() || draft">
      Bắt đầu lại
    </button>
  </header>

  <div class="support-layout">
    <aside class="left-panel">
      <section class="setup-card">
        <div class="section-heading">
          <div>
            <div class="section-title">Bắt đầu nhanh</div>
            <p class="section-subtitle">
              Chọn học sinh và người phụ trách để AI đọc đúng tiến độ, bài tập và lịch học.
            </p>
          </div>
        </div>

        <label>
          <span>Chọn học sinh</span>
          <select [(ngModel)]="selectedStudentId" (ngModelChange)="handleSelectionChange()">
            <option value="">-- Chọn học sinh --</option>
            <option *ngFor="let student of students()" [value]="student._id">
              {{ student.fullName }}{{ student.studentCode ? ' - ' + student.studentCode : '' }}
            </option>
          </select>
        </label>

        <label>
          <span>Chọn người hỗ trợ</span>
          <select [(ngModel)]="selectedSupportId" (ngModelChange)="handleSelectionChange()">
            <option value="">-- Chọn người hỗ trợ --</option>
            <option *ngFor="let support of supportContacts()" [value]="support._id">
              {{ support.fullName }} ({{ roleLabel(support.role) }})
            </option>
          </select>
        </label>

        <div class="context-card" *ngIf="selectedStudentRecord() as student">
          <div class="context-row">
            <strong>{{ student.fullName }}</strong>
            <span class="student-badge">{{ student.studentCode || 'Đang theo dõi' }}</span>
          </div>
          <div class="context-meta">
            <div>
              <span class="meta-label">Phụ huynh</span>
              <strong>{{ student.parentName || 'Tài khoản hiện tại' }}</strong>
            </div>
            <div>
              <span class="meta-label">Gói học</span>
              <strong>{{ student.productPackage?.name || 'Đang cập nhật' }}</strong>
            </div>
          </div>
        </div>

        <div class="context-card support-card" *ngIf="selectedSupportRecord() as support">
          <div class="context-row">
            <strong>{{ support.fullName }}</strong>
            <span class="support-badge">{{ roleLabel(support.role) }}</span>
          </div>
          <p class="helper context-note">{{ supportHint() }}</p>
        </div>

        <p class="helper" *ngIf="supportContacts().length">
          AI sẽ trả lời nhanh các câu hỏi về tiến độ, bài tập, lịch học; case nhạy cảm sẽ tự chuyển ticket.
        </p>
        <p class="empty" *ngIf="!supportContacts().length && !loading()">
          Chưa có người hỗ trợ khả dụng cho tài khoản này.
        </p>
      </section>

      <section class="conversation-card">
        <div class="section-heading">
          <div>
            <div class="section-title">Hội thoại gần đây</div>
            <p class="section-subtitle">
              Ưu tiên hiển thị các hội thoại khớp với học sinh hoặc người hỗ trợ đang chọn.
            </p>
          </div>
          <span class="section-count">{{ orderedConversations().length }}</span>
        </div>
        <div class="conversation-list" *ngIf="orderedConversations().length; else emptyConversations">
          <button
            type="button"
            class="conversation-item"
            *ngFor="let conv of orderedConversations()"
            [class.active]="selectedConversation()?._id === conv._id"
            (click)="selectConversation(conv)">
            <div class="conversation-top">
              <strong>{{ getSupportName(conv) }}</strong>
              <span>{{ formatTime(conv.lastMessageAt) }}</span>
            </div>
            <div class="conversation-middle">
              <span class="student-badge" *ngIf="getStudentName(conv)">{{ getStudentName(conv) }}</span>
              <span class="match-badge" *ngIf="selectedSupportId && getSupportId(conv) === selectedSupportId">Đang chọn</span>
              <span class="unread-badge" *ngIf="(conv.unreadCount || 0) > 0">{{ conv.unreadCount }}</span>
            </div>
            <div class="conversation-preview">{{ conv.lastMessage || 'Chưa có tin nhắn' }}</div>
          </button>
        </div>
        <ng-template #emptyConversations>
          <div class="empty">
            Chưa có hội thoại nào. Chọn học sinh, chọn người hỗ trợ rồi dùng câu hỏi mẫu để bắt đầu nhanh.
          </div>
        </ng-template>
      </section>
    </aside>

    <section class="chat-panel">
      <div class="chat-header">
        <div class="chat-header-main">
          <div>
            <strong>{{ activeHeaderTitle() }}</strong>
            <p>{{ activeHeaderSubtitle() }}</p>
          </div>
          <div class="header-chips">
            <span class="header-chip" *ngIf="selectedStudentRecord() as student">
              {{ student.studentCode || student.fullName }}
            </span>
            <span class="header-chip" *ngIf="selectedSupportRecord() as support">
              {{ roleLabel(support.role) }}
            </span>
          </div>
        </div>
        <div class="ticket-banner" *ngIf="activeHandoffTicket() as handoff">
          <div class="ticket-banner-top">
            <span class="ticket-banner-label">Ticket đang theo dõi</span>
            <span class="ticket-chip">{{ handoff.code }}</span>
          </div>
          <p>
            Yêu cầu nhạy cảm đã được chuyển sang ticket để trung tâm xử lý tiếp.
          </p>
          <a
            class="ticket-banner-link"
            routerLink="/app/tickets"
            [queryParams]="{ ticketId: handoff.id }">
            Mở ticket
          </a>
        </div>
      </div>

      <div class="chat-body" #messagesArea>
        <div class="loading" *ngIf="loadingMessages()">Đang tải tin nhắn...</div>
        <div class="empty chat-empty" *ngIf="!messages().length && !loadingMessages()">
          <strong>Sẵn sàng hỗ trợ</strong>
          <p>Hỏi về tiến độ, bài tập, lịch học hoặc nhấn một câu hỏi mẫu bên dưới để bắt đầu nhanh.</p>
        </div>

        <div class="message-list" *ngIf="messages().length">
          <div
            *ngFor="let message of messages()"
            class="message"
            [class.ai]="message.senderType === 'AI'"
            [class.sent]="message.senderId._id === currentUserId()"
            [class.received]="message.senderId._id !== currentUserId()">
            <div class="sender" *ngIf="message.senderId._id !== currentUserId()">
              {{ message.senderId.fullName }}
            </div>
            <div class="bubble">{{ message.content }}</div>
            <div class="message-actions" *ngIf="message.handoffTicketId && message.handoffTicketCode">
              <span class="ticket-chip">{{ message.handoffTicketCode }}</span>
              <a
                class="ticket-link"
                routerLink="/app/tickets"
                [queryParams]="{ ticketId: message.handoffTicketId }">
                Xem ticket
              </a>
            </div>
            <div class="meta">{{ formatTime(message.createdAt) }}</div>
          </div>
        </div>
      </div>

      <div class="composer">
        <div class="quick-chip-row">
          <button
            type="button"
            class="quick-chip"
            *ngFor="let action of quickActions"
            (click)="applyQuickAction(action)">
            {{ action.label }}
          </button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
        <textarea
          #composerInput
          [(ngModel)]="draft"
          rows="3"
          [placeholder]="composerPlaceholder()"
          [disabled]="sending() || !canCompose()"
          (keydown.enter)="$event.preventDefault(); sendMessage()"></textarea>
        <div class="composer-actions">
          <span class="helper">{{ composeHint() }}</span>
          <button type="button" class="primary" (click)="sendMessage()" [disabled]="!canSend()">
            {{ sending() ? 'Đang gửi...' : 'Gửi tin nhắn' }}
          </button>
        </div>
      </div>
    </section>
  </div>
  `,
  styles: [`
    :host { display:block; padding:24px; }
    .page-header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:16px;
      margin-bottom:16px;
    }
    .page-header h2 { margin:0 0 6px; color:#0f172a; }
    .page-header p { margin:0; color:#64748b; font-size:14px; }

    .support-layout { display:grid; grid-template-columns: 360px minmax(0, 1fr); gap:16px; min-height: calc(100vh - 180px); }
    .left-panel { display:flex; flex-direction:column; gap:16px; }
    .setup-card, .conversation-card, .chat-panel { background:#fff; border:1px solid #e2e8f0; border-radius:14px; box-shadow:0 10px 30px rgba(15, 23, 42, 0.04); }
    .setup-card, .conversation-card { padding:16px; }
    .section-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
    .setup-card label { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; font-size:13px; color:#334155; }
    .setup-card select, textarea { width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:10px; padding:10px 12px; font:inherit; }
    .setup-card select:focus, textarea:focus { outline:none; border-color:#0f766e; box-shadow:0 0 0 3px rgba(15, 118, 110, 0.12); }
    .helper { color:#64748b; font-size:12px; line-height:1.5; }
    .section-title { font-size:13px; font-weight:700; color:#334155; margin-bottom:4px; }
    .section-subtitle { margin:0; color:#64748b; font-size:12px; line-height:1.5; }
    .section-count {
      display:inline-flex; align-items:center; justify-content:center; min-width:28px; height:28px;
      padding:0 10px; border-radius:999px; background:#ecfeff; color:#0f766e; font-size:12px; font-weight:700;
    }
    .context-card {
      margin:10px 0 14px; padding:12px; border:1px solid #dbeafe; border-radius:12px; background:#f8fbff;
    }
    .support-card { border-color:#d1fae5; background:#f0fdf4; }
    .context-row { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .context-row strong { color:#0f172a; font-size:13px; }
    .context-meta { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
    .meta-label {
      display:block; margin-bottom:4px; color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;
    }
    .context-note { margin:0; }
    .conversation-list { display:flex; flex-direction:column; gap:10px; max-height:420px; overflow:auto; }
    .conversation-item { width:100%; text-align:left; border:1px solid #e2e8f0; background:#f8fafc; border-radius:12px; padding:12px; cursor:pointer; }
    .conversation-item.active { border-color:#0f766e; background:#ecfeff; }
    .conversation-item:hover { background:#f1f5f9; }
    .conversation-top, .conversation-middle { display:flex; justify-content:space-between; gap:8px; align-items:center; }
    .conversation-top strong { color:#0f172a; font-size:13px; }
    .conversation-top span { color:#94a3b8; font-size:11px; white-space:nowrap; }
    .conversation-preview { margin-top:8px; color:#64748b; font-size:12px; line-height:1.4; }
    .student-badge { display:inline-flex; align-items:center; padding:3px 8px; border-radius:999px; background:#e0f2fe; color:#0369a1; font-size:11px; font-weight:600; }
    .support-badge { display:inline-flex; align-items:center; padding:3px 8px; border-radius:999px; background:#dcfce7; color:#166534; font-size:11px; font-weight:700; }
    .match-badge { color:#0f766e; font-size:11px; font-weight:700; }
    .unread-badge { min-width:18px; height:18px; padding:0 6px; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; background:#dc2626; color:#fff; font-size:10px; font-weight:700; }

    .chat-panel { display:flex; flex-direction:column; min-height:0; overflow:hidden; }
    .chat-header { padding:18px 20px; border-bottom:1px solid #e2e8f0; background:linear-gradient(135deg, #0f766e, #155e75); color:#fff; }
    .chat-header-main { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
    .chat-header strong { font-size:16px; }
    .chat-header p { margin:4px 0 0; color:rgba(255,255,255,0.82); font-size:12px; }
    .header-chips { display:flex; gap:8px; flex-wrap:wrap; }
    .header-chip {
      display:inline-flex; align-items:center; padding:5px 10px; border-radius:999px;
      background:rgba(255,255,255,0.18); color:#fff; font-size:11px; font-weight:700;
    }
    .ticket-banner { margin-top:14px; padding:12px 14px; border-radius:12px; background:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.18); max-width:420px; }
    .ticket-banner-top { display:flex; align-items:center; justify-content:space-between; gap:12px; }
    .ticket-banner-label { font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:rgba(255,255,255,0.72); }
    .ticket-banner .ticket-chip { background:rgba(255,255,255,0.18); color:#fff; }
    .ticket-banner p { margin:8px 0 10px; }
    .ticket-banner-link { display:inline-flex; align-items:center; font-size:12px; font-weight:700; color:#fff; text-decoration:none; }
    .ticket-banner-link:hover { text-decoration:underline; }
    .chat-body { flex:1; min-height:300px; overflow:auto; background:#f8fafc; padding:20px; }
    .chat-empty {
      margin:auto; max-width:460px; text-align:center; background:#fff; border:1px dashed #cbd5e1;
      border-radius:18px; padding:24px; box-shadow:0 10px 24px rgba(15, 23, 42, 0.06);
    }
    .chat-empty strong { display:block; color:#0f172a; margin-bottom:8px; font-size:16px; }
    .chat-empty p { margin:0; color:#64748b; font-size:13px; line-height:1.6; }
    .message-list { display:flex; flex-direction:column; gap:12px; }
    .message { max-width:72%; display:flex; flex-direction:column; gap:4px; }
    .message.sent { align-self:flex-end; }
    .message.received { align-self:flex-start; }
    .sender { font-size:11px; color:#0f766e; font-weight:700; padding-left:6px; }
    .bubble { padding:11px 14px; border-radius:14px; font-size:13px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
    .message.sent .bubble { background:#0f766e; color:#fff; border-bottom-right-radius:4px; }
    .message.received .bubble { background:#fff; color:#0f172a; border:1px solid #e2e8f0; border-bottom-left-radius:4px; }
    .message.ai .bubble { background:#eef2ff; color:#312e81; border-color:#c7d2fe; }
    .message.ai .sender { color:#4338ca; }
    .message-actions { display:flex; align-items:center; gap:8px; padding:0 6px; flex-wrap:wrap; }
    .ticket-chip { display:inline-flex; align-items:center; padding:4px 8px; border-radius:999px; background:#dbeafe; color:#1d4ed8; font-size:11px; font-weight:700; }
    .ticket-link { font-size:11px; font-weight:700; color:#1d4ed8; text-decoration:none; }
    .ticket-link:hover { text-decoration:underline; }
    .meta { font-size:10px; color:#94a3b8; padding:0 6px; }
    .message.sent .meta { text-align:right; }

    .composer { border-top:1px solid #e2e8f0; padding:16px; background:#fff; }
    .quick-chip-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
    .quick-chip {
      border:1px solid #cbd5e1; border-radius:999px; background:#fff; color:#334155;
      padding:6px 12px; font-size:12px; font-weight:700; cursor:pointer;
    }
    .quick-chip:hover { border-color:#0f766e; color:#0f766e; background:#f0fdfa; }
    .composer textarea { min-height:96px; resize:vertical; }
    .composer-actions { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-top:12px; }
    .primary, .secondary { border:none; border-radius:10px; font-weight:700; cursor:pointer; }
    .primary { background:#0f766e; color:#fff; padding:10px 18px; }
    .primary:hover { background:#115e59; }
    .primary:disabled { opacity:0.6; cursor:not-allowed; }
    .secondary { background:#e2e8f0; color:#0f172a; padding:10px 14px; }
    .secondary:hover { background:#cbd5e1; }
    .error { margin:0 0 10px; color:#b91c1c; font-size:12px; }
    .empty, .loading { color:#64748b; font-size:13px; }

    @media (max-width: 1080px) {
      .support-layout { grid-template-columns: 1fr; }
      .conversation-list { max-height:none; }
      .message { max-width:85%; }
    }
    @media (max-width: 720px) {
      :host { padding:16px; }
      .page-header, .chat-header-main, .composer-actions { flex-direction:column; align-items:stretch; }
      .context-meta { grid-template-columns:1fr; }
    }
  `],
})
export class ParentSupportChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesArea') messagesArea?: ElementRef<HTMLDivElement>;
  @ViewChild('composerInput') composerInput?: ElementRef<HTMLTextAreaElement>;

  private readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly studentService = inject(StudentService);
  private readonly userService = inject(UserService);

  readonly quickActions = QUICK_ACTIONS;

  conversations = signal<SupportConversation[]>([]);
  messages = signal<SupportMessage[]>([]);
  students = signal<StudentItem[]>([]);
  supportContacts = signal<UserItem[]>([]);
  selectedConversation = signal<SupportConversation | null>(null);
  loading = signal(false);
  loadingMessages = signal(false);
  sending = signal(false);
  error = signal('');

  selectedStudentId = '';
  selectedSupportId = '';
  draft = '';
  activeHandoffTicket = computed(() => {
    const latestHandoffMessage = [...this.messages()]
      .reverse()
      .find((message) => !!message.handoffTicketId && !!message.handoffTicketCode);

    if (!latestHandoffMessage) return null;

    return {
      id: latestHandoffMessage.handoffTicketId as string,
      code: latestHandoffMessage.handoffTicketCode as string,
    };
  });

  private conversationPoller: ReturnType<typeof setInterval> | null = null;
  private messagePoller: ReturnType<typeof setInterval> | null = null;
  private requestedConversationId = '';

  ngOnInit(): void {
    this.requestedConversationId = this.route.snapshot.queryParamMap.get('conversationId') || '';
    this.bootstrap();
  }

  ngOnDestroy(): void {
    if (this.conversationPoller) clearInterval(this.conversationPoller);
    if (this.messagePoller) clearInterval(this.messagePoller);
  }

  currentUserId(): string {
    return this.auth.userSignal()?.sub || '';
  }

  selectedStudentRecord(): StudentItem | undefined {
    return this.students().find((student) => student._id === this.selectedStudentId);
  }

  selectedSupportRecord(): UserItem | undefined {
    return this.supportContacts().find((support) => support._id === this.selectedSupportId);
  }

  orderedConversations(): SupportConversation[] {
    return [...this.conversations()].sort((left, right) => {
      const rankDiff = this.getConversationRank(right) - this.getConversationRank(left);
      if (rankDiff !== 0) return rankDiff;
      return this.getConversationTimestamp(right) - this.getConversationTimestamp(left);
    });
  }

  async bootstrap() {
    this.loading.set(true);
    try {
      const [students, supportContacts] = await Promise.all([
        this.studentService.list(),
        this.userService.listDirectory(),
      ]);

      this.students.set(students);
      this.supportContacts.set(
        supportContacts.filter((user) => SUPPORT_ROLES.includes(user.role)),
      );

      this.applySmartDefaults();
      await this.loadConversations();
      this.conversationPoller = setInterval(() => {
        void this.refreshConversationsSilently();
      }, 10000);
    } catch {
      this.error.set('Không thể tải dữ liệu chat hỗ trợ.');
    } finally {
      this.loading.set(false);
    }
  }

  async loadConversations(resetSelection = true) {
    const rawConversations = await this.messageService.listConversations();
    const normalized = (rawConversations || []).filter((conversation: SupportConversation) => {
      if (conversation.conversationKind === 'PARENT_SUPPORT') return true;
      return conversation.participants?.some((participant) => SUPPORT_ROLES.includes(participant.role));
    });

    this.conversations.set(normalized);
    this.applySmartDefaults();

    const requestedConversation = this.requestedConversationId
      ? normalized.find((conversation) => conversation._id === this.requestedConversationId) || null
      : null;

    if (requestedConversation && this.selectedConversation()?._id !== requestedConversation._id) {
      await this.selectConversation(requestedConversation, false);
      return;
    }

    if (this.requestedConversationId && !requestedConversation && !this.selectedConversation()) {
      this.requestedConversationId = '';
      void this.syncConversationQueryParam(null);
    }

    if (resetSelection && normalized.length && !this.selectedConversation()) {
      const preferred = this.findPreferredConversation(normalized);
      if (preferred) {
        await this.selectConversation(preferred);
        return;
      }
    }

    const selected = this.selectedConversation();
    if (selected) {
      const updated = normalized.find((conversation) => conversation._id === selected._id) || null;
      this.selectedConversation.set(updated);
    }
  }

  async selectConversation(conversation: SupportConversation, syncRoute = true) {
    this.selectedConversation.set(conversation);
    this.requestedConversationId = conversation._id;
    this.selectedStudentId = this.getStudentId(conversation);
    this.selectedSupportId = this.getSupportId(conversation);
    this.error.set('');
    if (syncRoute) {
      void this.syncConversationQueryParam(conversation._id);
    }
    await this.loadMessages(conversation._id);
    await this.messageService.markRead(conversation._id);
    this.startMessagePolling(conversation._id);
  }

  async loadMessages(conversationId: string) {
    this.loadingMessages.set(true);
    try {
      const response = await this.messageService.listMessages(conversationId, 1, 100);
      this.messages.set(response.messages || []);
      setTimeout(() => this.scrollToBottom(), 50);
    } finally {
      this.loadingMessages.set(false);
    }
  }

  handleSelectionChange() {
    this.error.set('');
    this.applySmartDefaults();
    const existing = this.findExistingConversation(this.selectedSupportId, this.selectedStudentId);
    if (existing) {
      void this.selectConversation(existing);
      return;
    }

    this.selectedConversation.set(null);
    this.messages.set([]);
    this.requestedConversationId = '';
    void this.syncConversationQueryParam(null);
    if (this.messagePoller) {
      clearInterval(this.messagePoller);
      this.messagePoller = null;
    }
    this.focusComposer();
  }

  canCompose(): boolean {
    return !!this.selectedSupportId && (!!this.selectedStudentId || !this.students().length);
  }

  canSend(): boolean {
    return this.canCompose() && !!this.draft.trim() && !this.sending();
  }

  async sendMessage() {
    const content = this.draft.trim();
    if (!content || !this.canCompose()) return;

    this.sending.set(true);
    this.error.set('');

    try {
      const currentConversation = this.selectedConversation();
      if (currentConversation) {
        await this.messageService.sendToConversation(currentConversation._id, content);
      } else {
        await this.messageService.sendSupportMessage(
          this.selectedSupportId,
          content,
          this.selectedStudentId || undefined,
        );
      }

      this.draft = '';
      await this.loadConversations(false);
      const conversation =
        this.selectedConversation()
        || this.findExistingConversation(this.selectedSupportId, this.selectedStudentId);

      if (conversation) {
        await this.selectConversation(conversation);
      }
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Không thể gửi tin nhắn lúc này.');
    } finally {
      this.sending.set(false);
      this.focusComposer();
    }
  }

  applyQuickAction(action: QuickAction) {
    if (!this.selectedStudentId && this.students().length === 1) {
      this.selectedStudentId = this.students()[0]._id;
    }

    if (!this.selectedSupportId) {
      this.selectedSupportId = this.findPreferredSupportId(this.selectedStudentId);
    }

    const existing = this.findExistingConversation(this.selectedSupportId, this.selectedStudentId);
    if (existing && this.selectedConversation()?._id !== existing._id) {
      void this.selectConversation(existing);
    }

    this.draft = action.prompt;
    this.error.set('');
    this.focusComposer();
  }

  startFresh() {
    this.selectedConversation.set(null);
    this.messages.set([]);
    this.error.set('');
    this.draft = '';
    this.requestedConversationId = '';
    this.selectedStudentId = this.students().length === 1 ? this.students()[0]._id : '';
    this.selectedSupportId = '';
    this.applySmartDefaults();
    void this.syncConversationQueryParam(null);
    if (this.messagePoller) {
      clearInterval(this.messagePoller);
      this.messagePoller = null;
    }
  }

  composeHint(): string {
    if (!this.selectedStudentId && this.students().length > 1) {
      return 'Chọn học sinh để AI đọc đúng tiến độ, bài tập và lịch học.';
    }

    if (!this.selectedSupportId) {
      return 'Chọn người hỗ trợ hoặc bấm câu hỏi mẫu để hệ thống gợi ý nhanh hơn.';
    }

    if (this.activeHandoffTicket()) {
      return 'Tin nhắn mới sẽ tiếp tục cập nhật trong cùng luồng ticket nếu cần.';
    }

    return 'AI trả lời nhanh câu hỏi học tập; đổi lịch, thanh toán và khiếu nại sẽ tự chuyển ticket.';
  }

  composerPlaceholder(): string {
    const student = this.selectedStudentRecord();
    if (student) {
      return `Ví dụ: Hôm nay ${student.fullName} học đến phần nào, bài tập nào cần nộp, hoặc cần hỗ trợ đổi lịch?`;
    }

    return 'Ví dụ: Hôm nay con học đến phần nào, bài tập nào cần nộp, hoặc xin hỗ trợ đổi lịch?';
  }

  supportHint(): string {
    const existing = this.findExistingConversation(this.selectedSupportId, this.selectedStudentId);
    if (existing) {
      return 'Bạn đang nối lại đúng luồng hội thoại đã trao đổi trước đó.';
    }

    if (this.supportContacts().length === 1) {
      return 'Hệ thống đã tự chọn người hỗ trợ duy nhất khả dụng cho tài khoản này.';
    }

    return 'Giữ đúng người phụ trách sẽ giúp câu trả lời và quá trình xử lý nhất quán hơn.';
  }

  activeHeaderTitle(): string {
    if (this.selectedConversation()) {
      return this.getSupportName(this.selectedConversation()!);
    }

    const support = this.selectedSupportRecord();
    return support?.fullName || 'Hội thoại hỗ trợ';
  }

  activeHeaderSubtitle(): string {
    const student = this.selectedStudentRecord();
    if (student) {
      return `Đang trao đổi về học sinh: ${student.fullName}`;
    }

    return 'Chọn học sinh và người hỗ trợ để bắt đầu.';
  }

  getSupportName(conversation: SupportConversation): string {
    return this.getOtherParticipant(conversation)?.fullName || 'Trung tâm';
  }

  getSupportId(conversation: SupportConversation): string {
    return this.getOtherParticipant(conversation)?._id || '';
  }

  getStudentId(conversation: SupportConversation): string {
    const rawStudent = conversation.topicStudentId;
    if (!rawStudent) return '';
    return typeof rawStudent === 'string' ? rawStudent : rawStudent._id || '';
  }

  getStudentName(conversation: SupportConversation): string {
    if (conversation.topicStudentName) return conversation.topicStudentName;
    if (!conversation.topicStudentId || typeof conversation.topicStudentId === 'string') return '';
    return conversation.topicStudentId.fullName || '';
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      DIRECTOR: 'Giám đốc',
      OPS: 'Vận hành',
      SALE: 'Sale phụ trách',
    };

    return labels[role] || role;
  }

  formatTime(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60_000) return 'Vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút`;
    if (diff < 86_400_000) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  private getOtherParticipant(conversation: SupportConversation): SupportParticipant | undefined {
    const currentUserId = this.currentUserId();
    return (conversation.participants || []).find((participant) => participant._id !== currentUserId);
  }

  private findExistingConversation(supportId: string, studentId: string): SupportConversation | null {
    if (!supportId) return null;
    return this.conversations().find((conversation) => {
      return this.getSupportId(conversation) === supportId
        && this.getStudentId(conversation) === (studentId || '');
    }) || null;
  }

  private findPreferredConversation(conversations: SupportConversation[]): SupportConversation | null {
    if (!conversations.length) return null;

    if (this.selectedStudentId && this.selectedSupportId) {
      const exact = conversations.find((conversation) =>
        this.getStudentId(conversation) === this.selectedStudentId
        && this.getSupportId(conversation) === this.selectedSupportId);
      if (exact) return exact;
    }

    if (this.selectedStudentId) {
      const studentMatch = conversations.find((conversation) =>
        this.getStudentId(conversation) === this.selectedStudentId);
      if (studentMatch) return studentMatch;
    }

    if (this.selectedSupportId) {
      const supportMatch = conversations.find((conversation) =>
        this.getSupportId(conversation) === this.selectedSupportId);
      if (supportMatch) return supportMatch;
    }

    return conversations[0];
  }

  private findPreferredSupportId(studentId?: string): string {
    if (studentId) {
      const existing = this.conversations().find((conversation) =>
        this.getStudentId(conversation) === studentId);
      if (existing) {
        return this.getSupportId(existing);
      }
    }

    if (this.supportContacts().length === 1) {
      return this.supportContacts()[0]._id;
    }

    return '';
  }

  private applySmartDefaults() {
    const students = this.students();
    const supports = this.supportContacts();

    if (this.selectedStudentId && !students.some((student) => student._id === this.selectedStudentId)) {
      this.selectedStudentId = '';
    }

    if (this.selectedSupportId && !supports.some((support) => support._id === this.selectedSupportId)) {
      this.selectedSupportId = '';
    }

    if (!this.selectedStudentId && students.length === 1) {
      this.selectedStudentId = students[0]._id;
    }

    if (!this.selectedSupportId) {
      this.selectedSupportId = this.findPreferredSupportId(this.selectedStudentId);
    }
  }

  private getConversationRank(conversation: SupportConversation): number {
    let score = 0;
    if (this.selectedConversation()?._id === conversation._id) score += 1000;
    if (this.selectedStudentId && this.getStudentId(conversation) === this.selectedStudentId) score += 200;
    if (this.selectedSupportId && this.getSupportId(conversation) === this.selectedSupportId) score += 100;
    score += Math.min(conversation.unreadCount || 0, 9) * 5;
    return score;
  }

  private getConversationTimestamp(conversation: SupportConversation): number {
    if (!conversation.lastMessageAt) return 0;
    return new Date(conversation.lastMessageAt).getTime() || 0;
  }

  private focusComposer() {
    setTimeout(() => this.composerInput?.nativeElement.focus(), 0);
  }

  private startMessagePolling(conversationId: string) {
    if (this.messagePoller) clearInterval(this.messagePoller);
    this.messagePoller = setInterval(async () => {
      try {
        const selected = this.selectedConversation();
        if (!selected || selected._id !== conversationId) return;
        const response = await this.messageService.listMessages(conversationId, 1, 100);
        this.messages.set(response.messages || []);
        setTimeout(() => this.scrollToBottom(), 50);
      } catch {
        // Ignore transient polling failures and keep the current chat visible.
      }
    }, 5000);
  }

  private async refreshConversationsSilently() {
    try {
      await this.loadConversations(false);
    } catch {
      // Ignore transient polling failures and let the next cycle retry.
    }
  }

  private syncConversationQueryParam(conversationId: string | null) {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { conversationId: conversationId || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private scrollToBottom() {
    const container = this.messagesArea?.nativeElement;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }
}
