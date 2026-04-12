import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AiSuggestionPreview, MessageService } from '../services/message.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface Participant {
  _id: string;
  fullName: string;
  role: string;
}

interface Conversation {
  _id: string;
  participants: Participant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  conversationKind?: string;
  topicStudentId?:
    | string
    | {
        _id: string;
        fullName?: string;
        studentCode?: string;
      };
  topicStudentName?: string;
  viewerIsParticipant?: boolean;
}

interface Message {
  _id: string;
  senderId: { _id: string; fullName: string; role: string };
  senderType?: string;
  handoffTicketId?: string;
  handoffTicketCode?: string;
  content: string;
  readAt?: string | null;
  createdAt?: string;
}

interface UserItem {
  _id: string;
  fullName: string;
  role: string;
  email: string;
}

interface MessageAiPreview extends AiSuggestionPreview {}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Tin nhan & ho tro</h2>
      <p>Theo doi chat noi bo va hoi thoai ho tro phu huynh trong cung mot man hinh.</p>
    </div>
    <button class="primary" *ngIf="canStartDirectChat()" (click)="toggleNewConversation()">
      + Tin nhan moi
    </button>
  </header>

  <app-flow-guide featureKey="messages"></app-flow-guide>

  <div class="msg-layout">
    <div class="conv-list-panel">
      <div class="list-tabs">
        <button
          type="button"
          [class.active]="conversationFilter === 'all'"
          (click)="setConversationFilter('all')">
          Tat ca
        </button>
        <button
          type="button"
          [class.active]="conversationFilter === 'support'"
          (click)="setConversationFilter('support')">
          Ho tro PH
        </button>
        <button
          type="button"
          [class.active]="conversationFilter === 'direct'"
          (click)="setConversationFilter('direct')">
          Noi bo
        </button>
      </div>

      <div class="list-search">
        <input
          placeholder="Tim kiem hoi thoai..."
          [(ngModel)]="searchKeyword"
          (ngModelChange)="filterConversations()" />
      </div>

      <div class="conv-cards" *ngIf="filteredConversations().length; else emptyConvs">
        <div
          class="conv-card"
          *ngFor="let conversation of filteredConversations()"
          [class.selected]="selectedConv()?._id === conversation._id"
          (click)="selectConversation(conversation)">
          <div class="conv-card-header">
            <span class="contact-name">{{ getConversationTitle(conversation) }}</span>
            <span class="conv-time">{{ formatTime(conversation.lastMessageAt) }}</span>
          </div>
          <div class="conv-card-tags">
            <span class="kind-tag support" *ngIf="isParentSupport(conversation)">Ho tro PH</span>
            <span class="kind-tag observer" *ngIf="conversation.viewerIsParticipant === false">
              Mo tu ticket
            </span>
            <span class="student-tag" *ngIf="getStudentName(conversation)">
              {{ getStudentName(conversation) }}
            </span>
          </div>
          <div class="conv-card-preview">
            <span class="last-msg">{{ conversation.lastMessage || 'Chua co tin nhan' }}</span>
            <span class="unread-badge" *ngIf="conversation.unreadCount > 0">
              {{ conversation.unreadCount }}
            </span>
          </div>
        </div>
      </div>
      <ng-template #emptyConvs>
        <div class="empty-list">Chua co hoi thoai nao.</div>
      </ng-template>
    </div>

    <div class="chat-panel" *ngIf="selectedConv() || showNewChat(); else noSelection">
      <div class="chat-header" *ngIf="showNewChat() && !selectedConv()">
        <div class="chat-header-info">
          <strong>Tin nhan moi</strong>
        </div>
        <div class="new-chat-recipient">
          <label>Gui den:</label>
          <select [(ngModel)]="selectedUserId" (ngModelChange)="onRecipientSelected()">
            <option value="">-- Chon nhan vien --</option>
            <option *ngFor="let user of availableUsers()" [value]="user._id">
              {{ user.fullName }} ({{ roleLabel(user.role) }})
            </option>
          </select>
        </div>
      </div>

      <div class="chat-header" *ngIf="selectedConv() as conversation">
        <div class="chat-header-main">
          <div class="chat-header-info">
            <strong>{{ getConversationTitle(conversation) }}</strong>
            <span class="role-tag">{{ getConversationRole(conversation) }}</span>
          </div>
          <div class="chat-header-tags">
            <span class="kind-tag support" *ngIf="isParentSupport(conversation)">Ho tro PH</span>
            <span class="student-tag light" *ngIf="getStudentName(conversation)">
              HS: {{ getStudentName(conversation) }}
            </span>
            <span class="kind-tag observer" *ngIf="conversation.viewerIsParticipant === false">
              Xem tu ticket
            </span>
          </div>
        </div>
      </div>

      <div class="messages-area" #messagesArea>
        <div class="messages-list">
          <div
            *ngFor="let msg of messages()"
            class="message-bubble"
            [class.sent]="isOwnMessage(msg)"
            [class.received]="!isOwnMessage(msg)"
            [class.ai]="msg.senderType === 'AI'">
            <div class="msg-sender" *ngIf="!isOwnMessage(msg)">
              <span class="sender-label">{{ msg.senderId.fullName }}</span>
            </div>
            <div class="msg-content">{{ msg.content }}</div>
            <div class="msg-actions" *ngIf="msg.handoffTicketId && msg.handoffTicketCode">
              <span class="ticket-chip">{{ msg.handoffTicketCode }}</span>
              <a
                class="ticket-link"
                routerLink="/app/tickets"
                [queryParams]="{ ticketId: msg.handoffTicketId }">
                Xem ticket
              </a>
            </div>
            <div class="msg-meta">
              <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
              <span class="msg-read" *ngIf="isOwnMessage(msg) && msg.readAt">Da doc</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chat-input">
        <div class="chat-ai-toolbar" *ngIf="selectedConv() && isParentSupport(selectedConv()!)">
          <button
            type="button"
            class="secondary suggest-button"
            data-testid="messages-ai-suggest-button"
            (click)="suggestAiReply()"
            [disabled]="suggesting() || sending()">
            {{ suggesting() ? 'Dang goi y AI...' : 'Goi y AI' }}
          </button>
          <span class="ai-toolbar-note">AI chi tao ban nhap de agent xem truoc, chua gui vao hoi thoai.</span>
        </div>
        <div
          class="ai-preview-panel"
          *ngIf="aiPreview() as preview"
          data-testid="messages-ai-suggest-preview">
          <div class="ai-preview-header">
            <span class="kind-tag ai-preview-tag">Ban nhap AI</span>
            <div class="ai-preview-actions">
              <button
                type="button"
                class="secondary small"
                data-testid="messages-ai-suggest-apply"
                (click)="applyAiSuggestion()">
                Chen vao o nhap
              </button>
              <button
                type="button"
                class="ghost small"
                data-testid="messages-ai-suggest-discard"
                (click)="discardAiSuggestion()">
                Bo goi y
              </button>
            </div>
          </div>
          <div class="ai-preview-content">{{ preview.content }}</div>
        </div>
        <textarea
          [(ngModel)]="messageInput"
          [placeholder]="messagePlaceholder()"
          rows="2"
          (keydown.enter)="$event.preventDefault(); sendMessage()"
          [disabled]="sending() || (showNewChat() && !selectedUserId && !selectedConv())"></textarea>
        <button
          class="primary"
          (click)="sendMessage()"
          [disabled]="!messageInput.trim() || sending() || (showNewChat() && !selectedUserId && !selectedConv())">
          {{ sending() ? 'Dang gui...' : 'Gui' }}
        </button>
      </div>
    </div>

    <ng-template #noSelection>
      <div class="chat-panel no-selection">
        <div class="empty-chat">Chon mot hoi thoai hoac mo tu ticket de xem trao doi.</div>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    :host {
      display: block;
      padding: 24px;
      height: calc(100vh - 70px);
      box-sizing: border-box;
      font-family: 'Segoe UI', sans-serif;
    }

    .page-header {
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .page-header h2 { margin: 0 0 4px; font-size: 22px; color: #1f2937; }
    .page-header p { margin: 0; color: #666; font-size: 14px; }

    .msg-layout { display: flex; gap: 16px; height: calc(100% - 60px); }

    .conv-list-panel {
      width: 340px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fff;
      overflow: hidden;
    }
    .list-tabs {
      display: flex;
      gap: 8px;
      padding: 12px 12px 0;
      background: #fff;
      flex-wrap: wrap;
    }
    .list-tabs button {
      border: 1px solid #e5e7eb;
      background: #f8fafc;
      color: #475569;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .list-tabs button.active {
      background: #fff7ed;
      border-color: #fdba74;
      color: #c2410c;
    }
    .list-search { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .list-search input {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      width: 100%;
      box-sizing: border-box;
    }
    .list-search input:focus {
      outline: none;
      border-color: #f97316;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
    }
    .conv-cards { flex: 1; overflow-y: auto; }
    .conv-card {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background 0.15s;
    }
    .conv-card:hover { background: #fff7ed; }
    .conv-card.selected { background: #fff7ed; border-left: 3px solid #f97316; }
    .conv-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .contact-name {
      font-weight: 600;
      font-size: 13px;
      color: #1f2937;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .conv-time { font-size: 11px; color: #9ca3af; white-space: nowrap; }
    .conv-card-tags {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .conv-card-preview {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .last-msg {
      font-size: 12px;
      color: #6b7280;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .kind-tag,
    .student-tag,
    .role-tag {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    .kind-tag.support { background: #ffedd5; color: #c2410c; }
    .kind-tag.observer { background: #e0f2fe; color: #0369a1; }
    .student-tag { background: #eef2ff; color: #4338ca; }
    .student-tag.light { background: rgba(255, 255, 255, 0.14); color: #fff; }
    .unread-badge {
      background: #f97316;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 5px;
      flex-shrink: 0;
    }
    .empty-list { text-align: center; padding: 40px 16px; color: #9ca3af; font-size: 13px; }

    .chat-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fff;
      overflow: hidden;
      min-width: 0;
    }
    .chat-panel.no-selection { justify-content: center; align-items: center; }
    .empty-chat { color: #9ca3af; font-size: 14px; }

    .chat-header {
      padding: 14px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #1f2937, #374151);
      color: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .chat-header-main { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
    .chat-header-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .chat-header-info strong { font-size: 15px; }
    .role-tag { background: rgba(255, 255, 255, 0.15); color: #fff; }
    .chat-header-tags { display: flex; flex-wrap: wrap; gap: 6px; }

    .new-chat-recipient { display: flex; align-items: center; gap: 8px; }
    .new-chat-recipient label { font-size: 13px; white-space: nowrap; }
    .new-chat-recipient select {
      padding: 6px 10px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 6px;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      min-width: 200px;
    }
    .new-chat-recipient select option { color: #1f2937; background: #fff; }

    .messages-area { flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc; }
    .messages-list { display: flex; flex-direction: column; gap: 10px; }
    .message-bubble {
      max-width: 72%;
      padding: 10px 14px;
      border-radius: 14px;
    }
    .message-bubble.received {
      align-self: flex-start;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-bottom-left-radius: 4px;
    }
    .message-bubble.sent {
      align-self: flex-end;
      background: #f97316;
      color: #fff;
      border-bottom-right-radius: 4px;
      margin-left: auto;
    }
    .message-bubble.ai {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      color: #312e81;
    }
    .msg-sender { margin-bottom: 2px; }
    .sender-label { font-size: 11px; font-weight: 600; color: #f97316; }
    .message-bubble.ai .sender-label { color: #4338ca; }
    .msg-content {
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .msg-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .ticket-chip {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #dbeafe;
      color: #1d4ed8;
    }
    .ticket-link {
      font-size: 11px;
      font-weight: 700;
      color: #1d4ed8;
      text-decoration: none;
    }
    .ticket-link:hover { text-decoration: underline; }
    .msg-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      justify-content: flex-end;
    }
    .msg-time { font-size: 10px; opacity: 0.7; }
    .message-bubble.sent .msg-time { color: rgba(255, 255, 255, 0.8); }
    .message-bubble.received .msg-time,
    .message-bubble.ai .msg-time { color: #9ca3af; }
    .msg-read { font-size: 9px; color: rgba(255, 255, 255, 0.7); }

    .chat-input {
      padding: 14px 20px;
      border-top: 1px solid #e5e7eb;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: flex-end;
    }
    .chat-ai-toolbar {
      grid-column: 1 / -1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .suggest-button { white-space: nowrap; }
    .ai-toolbar-note { font-size: 12px; color: #64748b; }
    .ai-preview-panel {
      grid-column: 1 / -1;
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #c7d2fe;
      background: #eef2ff;
    }
    .ai-preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .ai-preview-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .ai-preview-tag { background: #c7d2fe; color: #312e81; }
    .ai-preview-content {
      color: #312e81;
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    .chat-input textarea {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 13px;
      resize: none;
      font-family: inherit;
    }
    .chat-input textarea:focus {
      outline: none;
      border-color: #f97316;
      box-shadow: 0 0 0 2px rgba(249, 115, 22, 0.15);
    }

    button.primary {
      padding: 8px 20px;
      background: #f97316;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background 0.15s;
    }
    button.primary:hover { background: #ea580c; }
    button.primary:disabled { opacity: 0.6; cursor: not-allowed; }
    button.secondary {
      padding: 8px 14px;
      background: #fff;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    button.secondary:hover { background: #f8fafc; }
    button.secondary.small,
    button.ghost.small { padding: 6px 10px; font-size: 12px; }
    button.ghost {
      padding: 8px 14px;
      background: transparent;
      color: #4338ca;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    button.ghost:hover { text-decoration: underline; }

    @media (max-width: 900px) {
      .msg-layout { flex-direction: column; height: auto; }
      .conv-list-panel, .chat-panel { width: 100%; }
      .chat-panel { min-height: 420px; }
      .message-bubble { max-width: 85%; }
      .chat-ai-toolbar { align-items: stretch; }
    }
  `],
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesArea') messagesArea?: ElementRef<HTMLDivElement>;

  private readonly messageService = inject(MessageService);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  conversations = signal<Conversation[]>([]);
  filteredConversations = signal<Conversation[]>([]);
  selectedConv = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  availableUsers = signal<UserItem[]>([]);
  sending = signal(false);
  suggesting = signal(false);
  showNewChat = signal(false);
  currentUserId = signal('');
  currentUserRole = signal('');
  aiPreview = signal<MessageAiPreview | null>(null);

  searchKeyword = '';
  messageInput = '';
  selectedUserId = '';
  conversationFilter: 'all' | 'direct' | 'support' = 'all';

  private convPollingInterval: ReturnType<typeof setInterval> | null = null;
  private msgPollingInterval: ReturnType<typeof setInterval> | null = null;
  private requestedConversationId = '';

  ngOnInit() {
    const user = this.authService.userSignal();
    if (user) {
      this.currentUserId.set(user.sub);
      this.currentUserRole.set(user.role);
    }

    this.requestedConversationId = this.route.snapshot.queryParamMap.get('conversationId') || '';
    void this.bootstrap();
  }

  ngOnDestroy() {
    if (this.convPollingInterval) clearInterval(this.convPollingInterval);
    if (this.msgPollingInterval) clearInterval(this.msgPollingInterval);
  }

  private async bootstrap() {
    await Promise.all([this.loadConversations(), this.loadUsers()]);
    this.convPollingInterval = setInterval(() => {
      void this.loadConversations();
    }, 10000);
  }

  async loadConversations() {
    try {
      const data = await this.messageService.listConversations();
      const selected = this.selectedConv();
      const merged = selected && !data.some((conversation: Conversation) => conversation._id === selected._id)
        ? [selected, ...data]
        : data;

      this.conversations.set(merged);

      await this.ensureRequestedConversationLoaded();

      const active = this.selectedConv();
      if (active) {
        const updated = this.conversations().find((conversation) => conversation._id === active._id);
        if (updated) {
          this.selectedConv.set(updated);
        }
      }

      this.filterConversations();
    } catch {}
  }

  async loadUsers() {
    if (!this.canStartDirectChat()) return;

    try {
      const data = await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/directory`, { withCredentials: true }),
      );
      const currentId = this.currentUserId();
      this.availableUsers.set(data.filter((user) => user._id !== currentId));
    } catch {}
  }

  filterConversations() {
    const keyword = this.searchKeyword.toLowerCase().trim();
    const byKind = this.conversations().filter((conversation) => {
      if (this.conversationFilter === 'support') return this.isParentSupport(conversation);
      if (this.conversationFilter === 'direct') return !this.isParentSupport(conversation);
      return true;
    });

    if (!keyword) {
      this.filteredConversations.set(byKind);
      return;
    }

    this.filteredConversations.set(
      byKind.filter((conversation) => {
        const title = this.getConversationTitle(conversation).toLowerCase();
        const student = this.getStudentName(conversation).toLowerCase();
        const lastMessage = (conversation.lastMessage || '').toLowerCase();
        return title.includes(keyword) || student.includes(keyword) || lastMessage.includes(keyword);
      }),
    );
  }

  setConversationFilter(filter: 'all' | 'direct' | 'support') {
    this.conversationFilter = filter;
    this.filterConversations();
  }

  async selectConversation(conversation: Conversation, syncRoute = true) {
    this.showNewChat.set(false);
    this.selectedUserId = '';
    this.selectedConv.set(conversation);
    this.aiPreview.set(null);
    this.requestedConversationId = conversation._id;

    if (syncRoute) {
      void this.syncConversationQueryParam(conversation._id);
    }

    await this.loadMessages(conversation._id);
    await this.markAsRead(conversation);
    this.startMessagePolling(conversation._id);
  }

  async loadMessages(conversationId: string) {
    try {
      const res = await this.messageService.listMessages(conversationId, 1, 100);
      const msgs: Message[] = res.messages || res;
      this.messages.set(msgs);
      setTimeout(() => this.scrollToBottom(), 100);
    } catch {}
  }

  async markAsRead(conversation: Conversation) {
    if (conversation.viewerIsParticipant === false || conversation.unreadCount <= 0) {
      return;
    }

    try {
      await this.messageService.markRead(conversation._id);
      const updated = { ...conversation, unreadCount: 0 };
      this.selectedConv.set(updated);
      this.conversations.update((list) =>
        list.map((item) => item._id === conversation._id ? updated : item),
      );
      this.filterConversations();
    } catch {}
  }

  private startMessagePolling(conversationId: string) {
    if (this.msgPollingInterval) clearInterval(this.msgPollingInterval);
    this.msgPollingInterval = setInterval(async () => {
      const selected = this.selectedConv();
      if (!selected || selected._id !== conversationId) return;

      try {
        const res = await this.messageService.listMessages(conversationId, 1, 100);
        const msgs: Message[] = res.messages || res;
        const oldCount = this.messages().length;
        this.messages.set(msgs);
        if (msgs.length > oldCount) {
          setTimeout(() => this.scrollToBottom(), 100);
          await this.markAsRead(selected);
        }
      } catch {}
    }, 5000);
  }

  toggleNewConversation() {
    if (!this.canStartDirectChat()) return;

    this.showNewChat.set(!this.showNewChat());
    if (this.showNewChat()) {
      this.selectedConv.set(null);
      this.messages.set([]);
      this.aiPreview.set(null);
      this.selectedUserId = '';
      this.messageInput = '';
      this.requestedConversationId = '';
      void this.syncConversationQueryParam(null);
      if (this.msgPollingInterval) clearInterval(this.msgPollingInterval);
    }
  }

  onRecipientSelected() {
    if (!this.selectedUserId) return;

    const existing = this.conversations().find((conversation) =>
      !this.isParentSupport(conversation)
      && conversation.participants.some((participant) => participant._id === this.selectedUserId),
    );

    if (existing) {
      void this.selectConversation(existing);
      this.showNewChat.set(false);
    }
  }

  async sendMessage() {
    const content = this.messageInput.trim();
    if (!content) return;
    this.sending.set(true);

    try {
      const selected = this.selectedConv();
      if (selected) {
        await this.messageService.sendToConversation(selected._id, content);
        this.messageInput = '';
        this.aiPreview.set(null);
        await this.loadMessages(selected._id);
        await this.loadConversations();
      } else if (this.selectedUserId) {
        await this.messageService.sendMessage(this.selectedUserId, content);
        this.messageInput = '';
        this.aiPreview.set(null);
        this.showNewChat.set(false);
        await this.loadConversations();
        const newConversation = this.conversations().find((conversation) =>
          !this.isParentSupport(conversation)
          && conversation.participants.some((participant) => participant._id === this.selectedUserId),
        );
        if (newConversation) {
          await this.selectConversation(newConversation);
        }
        this.selectedUserId = '';
      }
    } catch {}

    this.sending.set(false);
  }

  async suggestAiReply() {
    const selected = this.selectedConv();
    if (!selected || !this.isParentSupport(selected)) return;

    this.suggesting.set(true);
    try {
      const preview = await this.messageService.previewAiSuggestion(selected._id);
      this.aiPreview.set(preview);
    } catch {
      this.aiPreview.set(null);
    } finally {
      this.suggesting.set(false);
    }
  }

  applyAiSuggestion() {
    const preview = this.aiPreview();
    if (!preview) return;
    this.messageInput = preview.content;
  }

  discardAiSuggestion() {
    this.aiPreview.set(null);
  }

  canStartDirectChat(): boolean {
    return this.currentUserRole() !== 'PARENT';
  }

  isParentSupport(conversation: Conversation): boolean {
    return conversation.conversationKind === 'PARENT_SUPPORT';
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId?._id === this.currentUserId();
  }

  getConversationTitle(conversation: Conversation): string {
    if (this.isParentSupport(conversation)) {
      const parent = conversation.participants.find((participant) => participant.role === 'PARENT');
      if (parent?.fullName) return parent.fullName;
    }

    const currentId = this.currentUserId();
    const other = conversation.participants.find((participant) => participant._id !== currentId);
    return other?.fullName || conversation.participants[0]?.fullName || 'Khong ro';
  }

  getConversationRole(conversation: Conversation): string {
    if (this.isParentSupport(conversation)) {
      return 'Phu huynh';
    }

    const currentId = this.currentUserId();
    const other = conversation.participants.find((participant) => participant._id !== currentId);
    return other ? this.roleLabel(other.role) : '';
  }

  getStudentName(conversation: Conversation): string {
    if (conversation.topicStudentName) return conversation.topicStudentName;
    if (!conversation.topicStudentId || typeof conversation.topicStudentId === 'string') return '';
    return conversation.topicStudentId.fullName || '';
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      DIRECTOR: 'Giam doc',
      ACCOUNTING: 'Ke toan',
      OPS: 'Van hanh',
      ADSMANAGER: 'Ads manager',
      TEACHER: 'Giao vien',
      PARENT: 'Phu huynh',
      SALE: 'Sale',
      AI: 'Tro ly AI',
    };
    return map[role] || role;
  }

  messagePlaceholder(): string {
    if (this.showNewChat() && !this.selectedConv()) {
      return 'Nhap tin nhan noi bo...';
    }

    if (this.selectedConv() && this.isParentSupport(this.selectedConv()!)) {
      return 'Nhap noi dung ho tro phu huynh...';
    }

    return 'Nhap tin nhan...';
  }

  formatTime(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Vua xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phut`;
    if (diff < 86400000) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  private async ensureRequestedConversationLoaded() {
    if (!this.requestedConversationId) return;

    const existing = this.conversations().find(
      (conversation) => conversation._id === this.requestedConversationId,
    );
    if (existing) {
      if (this.selectedConv()?._id !== existing._id) {
        await this.selectConversation(existing, false);
      }
      return;
    }

    try {
      const conversation = await this.messageService.getConversation(this.requestedConversationId);
      this.conversations.update((list) => [
        conversation,
        ...list.filter((item) => item._id !== conversation._id),
      ]);
      if (this.selectedConv()?._id !== conversation._id) {
        await this.selectConversation(conversation, false);
      }
    } catch {
      this.requestedConversationId = '';
      if (!this.selectedConv()) {
        void this.syncConversationQueryParam(null);
      }
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
    try {
      const element = this.messagesArea?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    } catch {}
  }
}
