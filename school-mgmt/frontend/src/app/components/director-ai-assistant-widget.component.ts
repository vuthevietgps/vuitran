import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AiAssistantType,
  AiFeedbackCategory,
  AiFeedbackPayload,
  DirectorAiChatResponse,
  DirectorAiContextMode,
  DirectorAiMessageItem,
  DirectorAiService,
} from '../services/director-ai.service';
import { AuthService } from '../services/auth.service';

interface UiMessage {
  role: 'USER' | 'ASSISTANT';
  content: string;
  messageId?: string;
  contextKeys?: string[];
  source?: 'AI_API' | 'FALLBACK' | 'ACTION_DRAFT';
  actionDraft?: Record<string, any>;
  feedbackSaved?: boolean;
}

interface AssistantUiConfig {
  title: string;
  subtitle: string;
  quickPrompts: string[];
}

const ASSISTANT_BY_ROLE: Record<string, AiAssistantType> = {
  DIRECTOR: 'DIRECTOR_OPERATIONS',
  ACCOUNTING: 'ACCOUNTING_OPERATIONS',
  OPS: 'OPS_OPERATIONS',
  TEACHER: 'TEACHER_SUPPORT',
  EXPERIENCE_TEACHER: 'EXPERIENCE_TEACHER_SUPPORT',
  PARENT: 'PARENT_SUPPORT',
  STUDENT: 'STUDENT_SUPPORT',
  SALE: 'SALE_OPERATIONS',
  ADSMANAGER: 'ADS_OPERATIONS',
  SHAREHOLDER: 'SHAREHOLDER_INSIGHTS',
};

const ASSISTANT_UI_CONFIG: Record<AiAssistantType, AssistantUiConfig> = {
  DIRECTOR_OPERATIONS: {
    title: 'Tro ly Giam doc',
    subtitle: 'Dieu hanh tu dashboard, phe duyet, tai chinh va van hanh.',
    quickPrompts: [
      'Hom nay can xu ly gi?',
      'Con gi cho toi duyet?',
      'Rui ro tai chinh?',
      'Dong tien va cong no?',
      'Quang cao nao can can thiep?',
      'Audit he thong co bat thuong?',
      'Van hanh co diem nghen?',
    ],
  },
  ACCOUNTING_OPERATIONS: {
    title: 'Tro ly Ke toan',
    subtitle: 'Theo doi hoa don, vi, cong no, cashflow va queue doi soat.',
    quickPrompts: [
      'Hom nay ke toan can xu ly gi?',
      'Hoa don/top-up nao dang ton?',
      'Cong no nao can thu truoc?',
      'Dong tien tuan nay co rui ro khong?',
      'Cuoi thang can doi soat gi?',
    ],
  },
  OPS_OPERATIONS: {
    title: 'Tro ly Van hanh',
    subtitle: 'Dieu phoi lop, buoi hoc, ticket, attendance va hoc thu/test.',
    quickPrompts: [
      'OPS dau ngay: SLA/session/ticket nao can xu ly truoc?',
      'Session nao can finalize/no-show hom nay?',
      'Ticket nao qua SLA hoac can assign lai?',
      'Doi soat attendance hom nay co sai lech gi?',
      'Hoc thu/test nao can chot quyet dinh?',
    ],
  },
  TEACHER_SUPPORT: {
    title: 'Tro ly Giao vien',
    subtitle: 'Lich day, bao cao day, lop phu trach va viec can lam.',
    quickPrompts: [
      'Hom nay toi day lop nao?',
      'Diem danh lop hom nay the nao?',
      'Tim hoc lieu cho buoi toi',
      'Buoi nao toi chua nop bao cao?',
      'Lich day sap toi cua toi?',
      'Thu nhap/pending payout cua toi?',
      'Toi co tin nhan/ticket nao can xu ly?',
    ],
  },
  EXPERIENCE_TEACHER_SUPPORT: {
    title: 'Tro ly Giao vien review',
    subtitle: 'Queue cham bai, review hoc lieu, quiz va chat luong hoc tap.',
    quickPrompts: [
      'Hom nay toi can cham gi?',
      'Bai nao can cham truoc?',
      'Quiz nao can cham tay?',
      'Queue review co rui ro gi?',
      'Can uu tien feedback nao?',
      'Huong dan cham bai tap?',
    ],
  },
  PARENT_SUPPORT: {
    title: 'Tro ly Phu huynh',
    subtitle: 'Lich hoc, tien do, hoa don, vi va ticket cua con.',
    quickPrompts: [
      'Tuan nay con toi can lam gi?',
      'Lich hoc sap toi cua con?',
      'Tinh hinh hoc cua con toi?',
      'Hoa don nao chua thanh toan?',
      'Ticket cua toi dang den dau?',
    ],
  },
  STUDENT_SUPPORT: {
    title: 'Tro ly Hoc sinh',
    subtitle: 'Lich hoc, bai tap, quiz, hoc lieu va ke hoach hoc tap.',
    quickPrompts: [
      'Hom nay em can hoc gi?',
      'Bai tap/quiz nao can lam?',
      'Lich hoc sap toi cua em?',
      'Em can on phan nao?',
    ],
  },
  SALE_OPERATIONS: {
    title: 'Tro ly Sales',
    subtitle: 'Lead follow-up, order pipeline, hoc thu/test va hoa hong.',
    quickPrompts: [
      'Lead nao can follow-up hom nay?',
      'Pipeline cua toi dang nghen o dau?',
      'Order nao can bo sung?',
      'Hoc thu/test nao can chot?',
      'Hoa hong/doanh thu ca nhan?',
    ],
  },
  ADS_OPERATIONS: {
    title: 'Tro ly Ads',
    subtitle: 'Ads analytics, CPL/CPO/ROI, action required va guardrail ngan sach.',
    quickPrompts: [
      'Quang cao nao can toi uu hom nay?',
      'Ad group nao nen theo doi?',
      'Ngan sach ads co rui ro gi?',
      'Kenh nao dot tien ma khong ra lead?',
    ],
  },
  SHAREHOLDER_INSIGHTS: {
    title: 'Bao cao Co dong',
    subtitle: 'Investor metrics, tai chinh aggregate, retention va runway.',
    quickPrompts: [
      'Bao cao investor thang nay?',
      'Runway va burn rate the nao?',
      'Rui ro tai chinh lon nhat?',
      'Retention co rui ro khong?',
      'Unit economics co tot khong?',
      'Nen hoi ban dieu hanh cau nao?',
    ],
  },
  INTERNAL_SUPPORT: {
    title: 'Tro ly noi bo',
    subtitle: 'Huong dan dung he thong va tra cuu theo quyen dang nhap.',
    quickPrompts: [
      'Quy trinh dau ngay la gi?',
      'Muon xem cong no thi vao dau?',
      'Tro ly duoc phep lam gi?',
    ],
  },
  LEAD_CARE: {
    title: 'Tro ly Cham soc lead',
    subtitle: 'Hoi thoai, lead, product va order trong pipeline cham soc.',
    quickPrompts: [
      'Lead nao can cham soc?',
      'Soan tin nhan cho phu huynh?',
      'Conversation nao can takeover?',
    ],
  },
};

@Component({
  selector: 'app-director-ai-assistant-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="director-ai-panel" data-testid="director-ai-assistant">
      <div class="assistant-head">
        <div>
          <h3>{{ assistantTitle() }}</h3>
          <p>{{ assistantSubtitle() }}</p>
        </div>
        <div class="assistant-controls">
          <button
            type="button"
            class="new-chat-btn"
            (click)="startNewChat()"
            [disabled]="loading()"
            title="Bat dau mot doan chat moi">
            + Chat moi
          </button>
          <select [(ngModel)]="contextMode" aria-label="Pham vi du lieu">
            <option value="AUTO">Tu dong</option>
            <option value="OVERVIEW">Tong quan</option>
            <option value="FINANCE">Tai chinh</option>
            <option value="ACCOUNTING">Ke toan</option>
            <option value="OPERATIONS">Van hanh</option>
            <option value="SALES">Kinh doanh</option>
            <option value="HR">Nhan su</option>
            <option value="GUIDE">Huong dan</option>
          </select>
          <input type="date" [(ngModel)]="fromDate" aria-label="Tu ngay">
          <input type="date" [(ngModel)]="toDate" aria-label="Den ngay">
        </div>
      </div>

      <div class="quick-actions">
        <button type="button" *ngFor="let prompt of quickPrompts" (click)="sendQuick(prompt)">
          {{ prompt }}
        </button>
      </div>

      <div class="chat-frame" #messagesArea>
        <div *ngIf="messages().length === 0 && !loading()" class="empty-state">
          Chua co hoi thoai trong phien nay.
        </div>
        <article
          *ngFor="let message of messages(); let i = index"
          class="message"
          [class.user]="message.role === 'USER'"
          [class.assistant]="message.role === 'ASSISTANT'">
          <div class="bubble">
            <p>{{ message.content }}</p>
            <div class="context-tags" *ngIf="message.contextKeys?.length">
              <span *ngFor="let key of message.contextKeys">{{ contextLabel(key) }}</span>
              <span *ngIf="message.source === 'FALLBACK'" class="fallback-tag">fallback</span>
              <span *ngIf="message.source === 'ACTION_DRAFT'" class="action-tag">nhap hanh dong</span>
            </div>
            <div class="action-preview" *ngIf="message.actionDraft as actionDraft">
              <div class="action-preview-head">
                <div>
                  <strong>{{ actionDraftTitle(actionDraft) }}</strong>
                  <span>{{ actionDraftTarget(actionDraft) }}</span>
                </div>
                <em [attr.data-risk]="actionDraft['riskLevel'] || 'LOW'">
                  {{ actionDraft['riskLevel'] || 'LOW' }}
                </em>
              </div>
              <div class="action-diff" *ngIf="draftDiff(actionDraft).length">
                <div *ngFor="let item of draftDiff(actionDraft)">
                  <span>{{ item.label || item.field }}</span>
                  <code>{{ formatDraftValue(item.before) }}</code>
                  <b>-></b>
                  <code>{{ formatDraftValue(item.after) }}</code>
                </div>
              </div>
              <div class="action-warnings" *ngIf="draftWarnings(actionDraft).length">
                <span *ngFor="let warning of draftWarnings(actionDraft)">{{ warning }}</span>
              </div>
              <div class="action-buttons" *ngIf="canActOnDraft(actionDraft) || canApproveDraft(actionDraft); else actionStatus">
                <ng-container *ngIf="canActOnDraft(actionDraft)">
                  <button type="button" (click)="confirmDraft(actionDraft)" [disabled]="loading()">
                    Xac nhan
                  </button>
                  <button type="button" class="reject" (click)="rejectDraft(actionDraft)" [disabled]="loading()">
                    Huy nhap
                  </button>
                </ng-container>
                <ng-container *ngIf="canApproveDraft(actionDraft)">
                  <button type="button" (click)="approveDraft(actionDraft)" [disabled]="loading()">
                    Phe duyet
                  </button>
                </ng-container>
              </div>
              <ng-template #actionStatus>
                <div class="action-status">{{ actionDraftStatus(actionDraft) }}</div>
              </ng-template>
            </div>
            <div class="feedback-box" *ngIf="message.role === 'ASSISTANT'">
              <button
                type="button"
                class="feedback-open"
                *ngIf="!message.feedbackSaved && feedbackIndex() !== i"
                (click)="openFeedback(i)"
                [disabled]="feedbackSubmitting()">
                Chua thoa dang
              </button>
              <span class="feedback-saved" *ngIf="message.feedbackSaved">Da luu vao backlog AI</span>
              <form class="feedback-form" *ngIf="feedbackIndex() === i" (ngSubmit)="submitFeedback(i)">
                <div class="feedback-row">
                  <select [(ngModel)]="feedbackCategory" name="feedbackCategory" aria-label="Loai loi AI">
                    <option *ngFor="let category of feedbackCategories" [ngValue]="category.value">
                      {{ category.label }}
                    </option>
                  </select>
                </div>
                <textarea
                  [(ngModel)]="feedbackReason"
                  name="feedbackReason"
                  rows="2"
                  maxlength="3000"
                  placeholder="Noi dung nao chua dung, thieu du lieu, hoac can nang cap?"></textarea>
                <div class="feedback-submit-row">
                  <button type="submit" [disabled]="feedbackSubmitting()">Luu log</button>
                  <button type="button" class="feedback-cancel" (click)="cancelFeedback()" [disabled]="feedbackSubmitting()">
                    Huy
                  </button>
                </div>
                <div class="feedback-error" *ngIf="feedbackError()">{{ feedbackError() }}</div>
              </form>
            </div>
          </div>
        </article>
        <div *ngIf="loading()" class="typing">Dang doc context phu hop...</div>
      </div>

      <div class="composer">
        <textarea
          [(ngModel)]="draft"
          rows="2"
          placeholder="Nhap lenh dieu hanh..."
          (keydown.enter)="handleComposerEnter($event)"
          data-testid="director-ai-input"></textarea>
        <button type="button" (click)="send()" [disabled]="loading() || !draft.trim()" data-testid="director-ai-send">
          Gui
        </button>
      </div>

      <div *ngIf="lastResponse()" class="context-plan">
        <span
          *ngFor="let item of lastResponse()!.contextPlan"
          [attr.data-risk]="item.riskLevel"
          [attr.data-confirm]="item.requiresConfirmation ? 'true' : null"
          [title]="contextPlanTitle(item)">
          {{ item.label }}
          <small *ngIf="item.requiresConfirmation">xac nhan</small>
        </span>
      </div>
      <div *ngIf="error()" class="assistant-error">{{ error() }}</div>
    </section>
  `,
  styles: [`
    :host {
      display:block;
      min-width:0;
    }
    .director-ai-panel {
      background:#fff;
      border:1px solid #dbe3ef;
      border-radius:10px;
      padding:22px;
      margin-bottom:0;
      box-shadow:0 1px 3px rgba(15,23,42,0.07);
      min-width:0;
      min-height:calc(100vh - 150px);
      display:flex;
      flex-direction:column;
    }
    .assistant-head {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:16px;
      margin-bottom:12px;
    }
    .assistant-head h3 {
      margin:0;
      color:#0f172a;
      font-size:21px;
    }
    .assistant-head p {
      margin:4px 0 0;
      color:#64748b;
      font-size:14px;
      line-height:1.5;
    }
    .assistant-controls {
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .new-chat-btn {
      border:1px solid #1d4ed8;
      border-radius:6px;
      background:#eff6ff;
      color:#1d4ed8;
      padding:7px 10px;
      font-size:14px;
      font-weight:700;
      cursor:pointer;
      min-width:92px;
      white-space:nowrap;
    }
    .new-chat-btn:hover:not(:disabled) {
      background:#dbeafe;
    }
    .new-chat-btn:disabled {
      border-color:#cbd5e1;
      background:#f1f5f9;
      color:#94a3b8;
      cursor:not-allowed;
    }
    .assistant-controls select,
    .assistant-controls input {
      border:1px solid #cbd5e1;
      border-radius:6px;
      padding:8px 10px;
      font-size:14px;
      background:#fff;
      color:#0f172a;
    }
    .quick-actions {
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-bottom:12px;
    }
    .quick-actions button {
      border:1px solid #cbd5e1;
      background:#f8fafc;
      color:#334155;
      border-radius:6px;
      padding:8px 11px;
      font-size:13px;
      font-weight:600;
      cursor:pointer;
    }
    .quick-actions button:hover { background:#eef2f7; }
    .chat-frame {
      height:clamp(620px, 70vh, 900px);
      flex:1 1 auto;
      overflow:auto;
      border:1px solid #e2e8f0;
      background:#f8fafc;
      border-radius:8px;
      padding:12px;
      display:flex;
      flex-direction:column;
      gap:10px;
    }
    .empty-state,
    .typing {
      color:#64748b;
      font-size:14px;
      padding:10px 2px;
    }
    .message {
      display:flex;
      max-width:88%;
    }
    .message.user { align-self:flex-end; justify-content:flex-end; }
    .message.assistant { align-self:flex-start; }
    .bubble {
      border-radius:10px;
      padding:12px 14px;
      font-size:14.5px;
      line-height:1.6;
      box-shadow:0 1px 2px rgba(15,23,42,0.06);
      overflow-wrap:anywhere;
      white-space:pre-wrap;
    }
    .message.user .bubble {
      background:#1d4ed8;
      color:#fff;
    }
    .message.assistant .bubble {
      background:#fff;
      color:#0f172a;
      border:1px solid #e2e8f0;
    }
    .bubble p { margin:0; }
    .context-tags {
      display:flex;
      gap:6px;
      flex-wrap:wrap;
      margin-top:8px;
    }
    .context-tags span,
    .context-plan span {
      display:inline-flex;
      align-items:center;
      gap:4px;
      border-radius:999px;
      background:#e2e8f0;
      color:#475569;
      padding:3px 8px;
      font-size:12px;
      font-weight:700;
    }
    .context-tags .fallback-tag {
      background:#fef3c7;
      color:#92400e;
    }
    .context-tags .action-tag {
      background:#dcfce7;
      color:#166534;
    }
    .action-preview {
      margin-top:10px;
      border:1px solid #bbf7d0;
      border-radius:8px;
      background:#f0fdf4;
      padding:10px;
      white-space:normal;
      color:#14532d;
    }
    .action-preview-head {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:10px;
      margin-bottom:8px;
    }
    .action-preview-head div {
      display:flex;
      flex-direction:column;
      gap:2px;
      min-width:0;
    }
    .action-preview-head strong {
      color:#052e16;
      font-size:13px;
    }
    .action-preview-head span {
      color:#166534;
      font-size:12px;
      overflow-wrap:anywhere;
    }
    .action-preview-head em {
      border-radius:999px;
      background:#dcfce7;
      color:#166534;
      padding:3px 7px;
      font-style:normal;
      font-size:11px;
      font-weight:800;
      white-space:nowrap;
    }
    .action-preview-head em[data-risk="MEDIUM"] {
      background:#fef3c7;
      color:#92400e;
    }
    .action-preview-head em[data-risk="HIGH"],
    .action-preview-head em[data-risk="CRITICAL"] {
      background:#fee2e2;
      color:#991b1b;
    }
    .action-diff {
      display:flex;
      flex-direction:column;
      gap:5px;
      margin-top:6px;
    }
    .action-diff div {
      display:grid;
      grid-template-columns:minmax(90px, 1fr) minmax(0, 1fr) auto minmax(0, 1fr);
      gap:6px;
      align-items:center;
      font-size:12px;
    }
    .action-diff span {
      color:#166534;
      font-weight:800;
      overflow-wrap:anywhere;
    }
    .action-diff code {
      background:#fff;
      border:1px solid #bbf7d0;
      border-radius:5px;
      padding:3px 5px;
      color:#0f172a;
      font-size:11px;
      overflow-wrap:anywhere;
      white-space:pre-wrap;
    }
    .action-diff b {
      color:#15803d;
      font-size:11px;
    }
    .action-warnings {
      display:flex;
      flex-direction:column;
      gap:4px;
      margin-top:8px;
    }
    .action-warnings span {
      border:1px solid #fde68a;
      border-radius:6px;
      background:#fffbeb;
      color:#92400e;
      padding:5px 7px;
      font-size:12px;
      font-weight:700;
    }
    .action-buttons {
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:9px;
    }
    .action-buttons button {
      border:0;
      border-radius:6px;
      background:#15803d;
      color:#fff;
      padding:7px 10px;
      font-size:12px;
      font-weight:800;
      cursor:pointer;
    }
    .action-buttons button.reject {
      background:#991b1b;
    }
    .action-buttons button:disabled {
      background:#94a3b8;
      cursor:not-allowed;
    }
    .action-status {
      margin-top:8px;
      color:#166534;
      font-size:12px;
      font-weight:800;
    }
    .feedback-box {
      margin-top:9px;
      border-top:1px solid #e2e8f0;
      padding-top:8px;
      white-space:normal;
    }
    .feedback-open {
      border:1px solid #fecaca;
      border-radius:6px;
      background:#fef2f2;
      color:#991b1b;
      padding:5px 8px;
      font-size:12px;
      font-weight:700;
      cursor:pointer;
    }
    .feedback-open:hover:not(:disabled) {
      background:#fee2e2;
    }
    .feedback-open:disabled {
      cursor:not-allowed;
      opacity:.65;
    }
    .feedback-saved {
      display:inline-flex;
      color:#166534;
      background:#dcfce7;
      border-radius:6px;
      padding:4px 7px;
      font-size:12px;
      font-weight:700;
    }
    .feedback-form {
      display:flex;
      flex-direction:column;
      gap:7px;
    }
    .feedback-row select,
    .feedback-form textarea {
      width:100%;
      border:1px solid #cbd5e1;
      border-radius:6px;
      padding:7px 9px;
      font:inherit;
      font-size:13px;
      background:#fff;
      color:#0f172a;
    }
    .feedback-form textarea {
      resize:vertical;
      min-height:62px;
    }
    .feedback-submit-row {
      display:flex;
      gap:8px;
      align-items:center;
    }
    .feedback-submit-row button {
      border:0;
      border-radius:6px;
      background:#991b1b;
      color:#fff;
      padding:6px 9px;
      font-size:12px;
      font-weight:800;
      cursor:pointer;
    }
    .feedback-submit-row button:disabled {
      background:#94a3b8;
      cursor:not-allowed;
    }
    .feedback-submit-row .feedback-cancel {
      border:1px solid #cbd5e1;
      background:#fff;
      color:#334155;
    }
    .feedback-error {
      color:#b91c1c;
      font-size:12px;
      font-weight:700;
    }
    .composer {
      display:flex;
      gap:10px;
      margin-top:12px;
      align-items:flex-end;
    }
    .composer textarea {
      flex:1;
      min-width:0;
      resize:vertical;
      border:1px solid #cbd5e1;
      border-radius:8px;
      padding:9px 11px;
      font:inherit;
      font-size:15px;
      color:#0f172a;
    }
    .composer button {
      border:0;
      border-radius:8px;
      background:#0f172a;
      color:#fff;
      padding:10px 16px;
      font-weight:700;
      cursor:pointer;
      min-width:72px;
    }
    .composer button:disabled {
      background:#94a3b8;
      cursor:not-allowed;
    }
    .context-plan {
      display:flex;
      gap:6px;
      flex-wrap:wrap;
      margin-top:10px;
    }
    .context-plan span[data-risk="MEDIUM"] {
      background:#fef3c7;
      color:#92400e;
    }
    .context-plan span[data-confirm="true"] {
      background:#fee2e2;
      color:#991b1b;
    }
    .context-plan small {
      font-size:10px;
      font-weight:800;
      text-transform:uppercase;
    }
    .assistant-error {
      margin-top:10px;
      color:#b91c1c;
      background:#fef2f2;
      border:1px solid #fecaca;
      border-radius:8px;
      padding:9px 11px;
      font-size:13px;
    }
    @media (max-width:768px) {
      .assistant-head,
      .composer {
        flex-direction:column;
        align-items:stretch;
      }
      .assistant-controls { justify-content:flex-start; }
      .assistant-controls input,
      .assistant-controls select { flex:1 1 130px; min-width:0; }
      .message { max-width:100%; }
      .director-ai-panel { min-height:calc(100vh - 150px); padding:16px; }
      .chat-frame { height:520px; min-height:420px; }
      .action-diff div {
        grid-template-columns:1fr;
      }
      .action-diff b {
        display:none;
      }
    }
  `],
})
export class DirectorAiAssistantWidgetComponent implements OnInit {
  @ViewChild('messagesArea') messagesArea?: ElementRef<HTMLDivElement>;

  messages = signal<UiMessage[]>([]);
  loading = signal(false);
  error = signal('');
  lastResponse = signal<DirectorAiChatResponse | null>(null);
  feedbackIndex = signal<number | null>(null);
  feedbackSubmitting = signal(false);
  feedbackError = signal('');

  draft = '';
  sessionId = '';
  contextMode: DirectorAiContextMode = 'AUTO';
  fromDate = '';
  toDate = '';
  feedbackReason = '';
  feedbackCategory: AiFeedbackCategory = 'TOO_GENERIC';

  readonly feedbackCategories: Array<{ value: AiFeedbackCategory; label: string }> = [
    { value: 'TOO_GENERIC', label: 'Qua chung chung' },
    { value: 'WRONG_DATA', label: 'Sai so lieu' },
    { value: 'MISSING_CONTEXT', label: 'Thieu context' },
    { value: 'BAD_ACTION', label: 'De xuat hanh dong sai' },
    { value: 'BAD_TONE', label: 'Giong dieu khong phu hop' },
    { value: 'UNSAFE', label: 'Rui ro/an toan' },
    { value: 'OTHER', label: 'Khac' },
  ];

  get quickPrompts() {
    return this.assistantConfig().quickPrompts;
  }

  private readonly contextLabels: Record<string, string> = {
    daily_tasks: 'viec ngay',
    pending_approvals_summary: 'cho duyet',
    director_dashboard: 'dashboard',
    accounting_dashboard: 'ke toan',
    ops_dashboard: 'van hanh',
    ops_deep_sla_packet: 'packet ops',
    ops_sessions: 'buoi hoc',
    ops_open_tickets: 'ticket mo',
    ops_assigned_tickets: 'ticket cua toi',
    ops_attendance_report: 'attendance',
    ops_attendance_classes: 'lop diem danh',
    ops_trial_summary: 'trial summary',
    ops_trial_enrollments: 'trial/test',
    ops_trial_available_slots: 'slot test',
    pending_approval_session_changes: 'doi lich cho duyet',
    financial_overview: 'tai chinh',
    financial_alerts: 'canh bao',
    shareholder_investor_metrics: 'investor',
    shareholder_guide: 'co dong',
    profit_and_loss: 'p&l',
    revenue_report: 'doanh thu',
    sales_dashboard: 'sales',
    aging_report: 'cong no',
    cash_flow: 'dong tien',
    ads_actions_required: 'ads action',
    audit_stats: 'audit',
    teacher_kpi: 'kpi gv',
    employee_performance: 'nhan su',
    retention: 'duy tri',
    forecast: 'du bao',
    director_guide: 'huong dan',
    homework_grading_queue: 'bai tap',
    quiz_grading_queue: 'quiz',
    quiz_attempt_detail: 'bai quiz',
    teaching_materials_search: 'hoc lieu',
    teaching_material_chunks_search: 'noi dung hoc lieu',
    teaching_material_detail: 'hoc lieu chi tiet',
    teacher_guide: 'guide giao vien',
  };

  constructor(
    private readonly directorAiService: DirectorAiService,
    private readonly auth: AuthService,
  ) {}

  async ngOnInit() {
    await this.loadLatestSession();
  }

  assistantTitle() {
    return this.assistantConfig().title;
  }

  assistantSubtitle() {
    return this.assistantConfig().subtitle;
  }

  async sendQuick(prompt: string) {
    this.draft = prompt;
    await this.send();
  }

  handleComposerEnter(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey) return;
    keyboardEvent.preventDefault();
    void this.send();
  }

  startNewChat() {
    if (this.loading()) return;
    this.sessionId = '';
    this.draft = '';
    this.messages.set([]);
    this.lastResponse.set(null);
    this.error.set('');
    this.scrollSoon();
  }

  async send() {
    const content = this.draft.trim();
    if (!content || this.loading()) return false;

    this.error.set('');
    this.loading.set(true);
    this.draft = '';
    this.messages.update((items) => [...items, { role: 'USER', content }]);
    this.scrollSoon();

    try {
      const response = await this.directorAiService.chat({
        message: content,
        assistantType: this.currentAssistantType(),
        sessionId: this.sessionId || undefined,
        contextMode: this.contextMode,
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined,
        activeRoute: this.currentRoute(),
        entityContext: this.currentEntityContext(),
      });
      this.sessionId = response.sessionId;
      this.lastResponse.set(response);
      const actionDraft = this.toUiActionDraft(response.actionDraft);
      if (actionDraft) {
        this.syncExistingActionDraft(actionDraft);
      }
      this.messages.update((items) => [
        ...items,
        {
          role: 'ASSISTANT',
          content: response.answer,
          messageId: response.messageId,
          contextKeys: response.contextKeys,
          source: response.source,
          actionDraft,
        },
      ]);
      return true;
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong the goi tro ly giam doc.');
      this.messages.update((items) => items.slice(0, -1));
      return false;
    } finally {
      this.loading.set(false);
      this.scrollSoon();
    }
  }

  contextLabel(key: string) {
    return this.contextLabels[key] || key;
  }

  contextPlanTitle(item: DirectorAiChatResponse['contextPlan'][number]) {
    return [
      item.businessMeaning,
      item.endpoint ? `API: ${item.endpoint}` : undefined,
      item.dataPolicy ? `Du lieu: ${item.dataPolicy}` : undefined,
    ].filter(Boolean).join('\n');
  }

  draftDiff(actionDraft: Record<string, any>) {
    return Array.isArray(actionDraft?.['diff'])
      ? actionDraft['diff'].slice(0, 6)
      : [];
  }

  draftWarnings(actionDraft: Record<string, any>) {
    return Array.isArray(actionDraft?.['warnings'])
      ? actionDraft['warnings'].slice(0, 4)
      : [];
  }

  actionDraftTitle(actionDraft: Record<string, any>) {
    return [
      actionDraft?.['actionKey'] || 'ACTION_DRAFT',
      actionDraft?.['id'] ? `#${actionDraft['id']}` : undefined,
    ].filter(Boolean).join(' ');
  }

  actionDraftTarget(actionDraft: Record<string, any>) {
    return [
      actionDraft?.['entityType'],
      actionDraft?.['entityId'],
    ].filter(Boolean).join('/') || 'Chua gan doi tuong';
  }

  actionDraftStatus(actionDraft: Record<string, any>) {
    const status = String(actionDraft?.['status'] || '').trim();
    if (status === 'PENDING_APPROVAL') return 'Cho phe duyet';
    if (status === 'EXECUTED') return 'Da thuc thi';
    if (status === 'REJECTED') return 'Da huy';
    if (status === 'FAILED') return 'Thuc thi loi';
    if (status === 'EXPIRED') return 'Da het han';
    if (status === 'CONFIRMING') return 'Dang xac nhan...';
    if (status === 'REJECTING') return 'Dang huy...';
    if (status === 'APPROVING') return 'Dang phe duyet...';
    return status || 'Khong con cho xac nhan';
  }

  canActOnDraft(actionDraft: Record<string, any>) {
    return Boolean(actionDraft?.['id'])
      && actionDraft?.['status'] === 'PENDING_CONFIRMATION'
      && actionDraft?.['requiresConfirmation'] !== false;
  }

  canApproveDraft(actionDraft: Record<string, any>) {
    return Boolean(actionDraft?.['id'])
      && actionDraft?.['status'] === 'PENDING_APPROVAL'
      && this.auth.userSignal()?.role === 'DIRECTOR';
  }

  formatDraftValue(value: unknown) {
    if (value === undefined || value === null || value === '') return '(trong)';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  async confirmDraft(actionDraft: Record<string, any>) {
    await this.submitDraftCommand(actionDraft, 'xac nhan nhap');
  }

  async rejectDraft(actionDraft: Record<string, any>) {
    await this.submitDraftCommand(actionDraft, 'huy nhap');
  }

  async approveDraft(actionDraft: Record<string, any>) {
    await this.submitApprovalCommand(actionDraft);
  }

  openFeedback(index: number) {
    if (this.feedbackSubmitting()) return;
    this.feedbackIndex.set(index);
    this.feedbackReason = '';
    this.feedbackCategory = 'TOO_GENERIC';
    this.feedbackError.set('');
  }

  cancelFeedback() {
    if (this.feedbackSubmitting()) return;
    this.feedbackIndex.set(null);
    this.feedbackReason = '';
    this.feedbackError.set('');
  }

  async submitFeedback(index: number) {
    const message = this.messages()[index];
    if (!message || message.role !== 'ASSISTANT' || this.feedbackSubmitting()) return;

    this.feedbackSubmitting.set(true);
    this.feedbackError.set('');

    const payload: AiFeedbackPayload = {
      source: 'AI_CORE',
      assistantType: this.currentAssistantType(),
      sessionId: this.sessionId || undefined,
      messageId: message.messageId,
      activeRoute: this.currentRoute(),
      userMessage: this.findPreviousUserMessage(index),
      assistantAnswer: message.content,
      category: this.feedbackCategory,
      severity: this.feedbackCategory === 'UNSAFE' ? 'HIGH' : 'MEDIUM',
      reason: this.feedbackReason,
      contextKeys: message.contextKeys,
      metadata: {
        responseSource: message.source,
      },
    };

    try {
      await this.directorAiService.submitFeedback(payload);
      this.messages.update((items) => items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, feedbackSaved: true } : item,
      ));
      this.feedbackIndex.set(null);
      this.feedbackReason = '';
    } catch (err: any) {
      this.feedbackError.set(err?.error?.message || 'Khong the luu feedback AI.');
    } finally {
      this.feedbackSubmitting.set(false);
    }
  }

  private currentAssistantType(): AiAssistantType {
    const role = this.auth.userSignal()?.role || '';
    return ASSISTANT_BY_ROLE[role] || 'INTERNAL_SUPPORT';
  }

  private assistantConfig(): AssistantUiConfig {
    return ASSISTANT_UI_CONFIG[this.currentAssistantType()] || ASSISTANT_UI_CONFIG.INTERNAL_SUPPORT;
  }

  private currentRoute() {
    return typeof window !== 'undefined' ? window.location.pathname : undefined;
  }

  private currentEntityContext() {
    if (typeof window === 'undefined') return undefined;

    const params = new URLSearchParams(window.location.search || '');
    const candidates: Array<{ param: string; type: string }> = [
      { param: 'ticketId', type: 'ticket' },
      { param: 'studentId', type: 'student' },
      { param: 'classId', type: 'class' },
      { param: 'leadId', type: 'lead' },
      { param: 'sessionId', type: 'session' },
      { param: 'trialEnrollmentId', type: 'trial_enrollment' },
      { param: 'attendanceId', type: 'attendance' },
      { param: 'attemptId', type: 'quiz_attempt' },
      { param: 'quizAttemptId', type: 'quiz_attempt' },
      { param: 'materialId', type: 'teaching_material' },
      { param: 'adGroupId', type: 'ad_group' },
      { param: 'invoiceId', type: 'invoice' },
      { param: 'orderId', type: 'order' },
      { param: 'parentId', type: 'parent' },
      { param: 'teacherId', type: 'teacher' },
      { param: 'userId', type: 'user' },
    ];

    for (const candidate of candidates) {
      const id = params.get(candidate.param)?.trim();
      if (id && this.isMongoId(id)) {
        return { type: candidate.type, id };
      }
    }

    return undefined;
  }

  private async loadLatestSession() {
    try {
      const sessions = await this.directorAiService.listSessions(this.currentAssistantType());
      const latest = sessions.data?.[0];
      if (!latest?._id) return;

      this.sessionId = latest._id;
      const [messages, actionDrafts, approvalDrafts] = await Promise.all([
        this.directorAiService.getMessages(latest._id, 20),
        this.directorAiService.listActionDrafts(this.currentAssistantType(), 50),
        this.loadApprovalDraftsForCurrentRole(),
      ]);
      const actionDraftById = this.indexActionDrafts([
        ...actionDrafts.data,
        ...approvalDrafts,
      ]);
      this.messages.set(messages.data.map((item) => this.mapMessage(item, actionDraftById)));
      this.scrollSoon();
    } catch {
      this.messages.set([]);
    }
  }

  private mapMessage(
    item: DirectorAiMessageItem,
    actionDraftById: Map<string, Record<string, any>> = new Map(),
  ): UiMessage {
    const messageDraft = this.toUiActionDraft(item.metadata?.['actionDraft']);
    const latestDraft = messageDraft?.['id']
      ? actionDraftById.get(String(messageDraft['id']))
      : undefined;

    return {
      role: item.role,
      content: item.content,
      messageId: item._id,
      contextKeys: item.contextKeys || item.toolKeys,
      source: item.metadata?.['source'],
      actionDraft: latestDraft || messageDraft,
    };
  }

  private findPreviousUserMessage(index: number) {
    for (let i = index - 1; i >= 0; i -= 1) {
      const item = this.messages()[i];
      if (item?.role === 'USER') return item.content;
    }
    return undefined;
  }

  private toUiActionDraft(actionDraft: Record<string, any> | undefined) {
    return actionDraft?.['id'] ? actionDraft : undefined;
  }

  private indexActionDrafts(actionDrafts: Array<Record<string, any>>) {
    const indexed = new Map<string, Record<string, any>>();
    for (const actionDraft of actionDrafts || []) {
      if (actionDraft?.['id']) {
        indexed.set(String(actionDraft['id']), actionDraft);
      }
    }
    return indexed;
  }

  private async submitDraftCommand(actionDraft: Record<string, any>, command: 'xac nhan nhap' | 'huy nhap') {
    if (this.loading() || !actionDraft?.['id']) return;
    const draftId = String(actionDraft['id']);
    const isConfirm = command === 'xac nhan nhap';
    const pendingStatus = isConfirm ? 'CONFIRMING' : 'REJECTING';
    this.error.set('');
    this.loading.set(true);
    this.markActionDraftStatus(draftId, pendingStatus);
    this.messages.update((items) => [
      ...items,
      {
        role: 'USER',
        content: isConfirm ? `Xac nhan nhap ${draftId}` : `Huy nhap ${draftId}`,
      },
    ]);
    this.scrollSoon();

    try {
      const result = isConfirm
        ? await this.directorAiService.confirmActionDraft(draftId, 'Confirmed from AI assistant widget')
        : await this.directorAiService.rejectActionDraft(draftId, 'Rejected from AI assistant widget');
      const updatedDraft = this.toUiActionDraft(result);
      if (updatedDraft) {
        this.syncExistingActionDraft(updatedDraft);
      }
      this.messages.update((items) => [
        ...items,
        {
          role: 'ASSISTANT',
          content: this.formatActionCommandResult(result, isConfirm),
          source: 'ACTION_DRAFT',
          actionDraft: updatedDraft,
        },
      ]);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong the cap nhat nhap hanh dong.');
      this.markActionDraftStatus(draftId, 'PENDING_CONFIRMATION');
      this.messages.update((items) => items.slice(0, -1));
    } finally {
      this.loading.set(false);
      this.scrollSoon();
    }
  }

  private async submitApprovalCommand(actionDraft: Record<string, any>) {
    if (this.loading() || !actionDraft?.['id']) return;
    const draftId = String(actionDraft['id']);
    this.error.set('');
    this.loading.set(true);
    this.markActionDraftStatus(draftId, 'APPROVING');
    this.messages.update((items) => [
      ...items,
      {
        role: 'USER',
        content: `Phe duyet nhap ${draftId}`,
      },
    ]);
    this.scrollSoon();

    try {
      const result = await this.directorAiService.approveActionDraft(
        draftId,
        'Approved from AI assistant widget',
      );
      const updatedDraft = this.toUiActionDraft(result);
      if (updatedDraft) {
        this.syncExistingActionDraft(updatedDraft);
      }
      this.messages.update((items) => [
        ...items,
        {
          role: 'ASSISTANT',
          content: this.formatActionApprovalResult(result),
          source: 'ACTION_DRAFT',
          actionDraft: updatedDraft,
        },
      ]);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Khong the phe duyet nhap hanh dong.');
      this.markActionDraftStatus(draftId, 'PENDING_APPROVAL');
      this.messages.update((items) => items.slice(0, -1));
    } finally {
      this.loading.set(false);
      this.scrollSoon();
    }
  }

  private async loadApprovalDraftsForCurrentRole() {
    if (this.auth.userSignal()?.role !== 'DIRECTOR') return [];
    const response = await this.directorAiService.listApprovalActionDrafts(
      this.currentAssistantType(),
      50,
      'PENDING_APPROVAL',
    );
    return response.data;
  }

  private formatActionCommandResult(result: Record<string, any>, confirmed: boolean) {
    const id = result?.['id'] || '';
    const actionKey = result?.['actionKey'] || 'ACTION_DRAFT';
    const status = String(result?.['status'] || '');
    const target = [
      result?.['entityType'],
      result?.['entityId'],
    ].filter(Boolean).join('/');

    if (confirmed && status === 'PENDING_APPROVAL') {
      return [
        `Da xac nhan nhap ${id} va chuyen sang hang cho phe duyet.`,
        `Action: ${actionKey}.`,
        target ? `Doi tuong: ${target}.` : undefined,
        'Chua thuc thi thay doi vi action nay can approval rieng.',
      ].filter(Boolean).join('\n');
    }

    return [
      confirmed ? `Da thuc thi nhap ${id}.` : `Da huy nhap ${id}.`,
      `Action: ${actionKey}.`,
      target ? `Doi tuong: ${target}.` : undefined,
      confirmed ? 'Thao tac da duoc ghi audit log.' : undefined,
    ].filter(Boolean).join('\n');
  }

  private formatActionApprovalResult(result: Record<string, any>) {
    const id = result?.['id'] || '';
    const actionKey = result?.['actionKey'] || 'ACTION_DRAFT';
    const target = [
      result?.['entityType'],
      result?.['entityId'],
    ].filter(Boolean).join('/');

    return [
      `Da phe duyet va thuc thi nhap ${id}.`,
      `Action: ${actionKey}.`,
      target ? `Doi tuong: ${target}.` : undefined,
      'Thao tac da duoc ghi audit log.',
    ].filter(Boolean).join('\n');
  }

  private syncExistingActionDraft(actionDraft: Record<string, any>) {
    const draftId = actionDraft?.['id'];
    if (!draftId) return;

    this.messages.update((items) => items.map((item) => {
      if (item.actionDraft?.['id'] !== draftId) return item;
      return {
        ...item,
        actionDraft: {
          ...item.actionDraft,
          ...actionDraft,
        },
      };
    }));
  }

  private markActionDraftStatus(draftId: string, status: string) {
    this.messages.update((items) => items.map((item) => {
      if (item.actionDraft?.['id'] !== draftId) return item;
      return {
        ...item,
        actionDraft: {
          ...item.actionDraft,
          status,
        },
      };
    }));
  }

  private isMongoId(value: string) {
    return /^[0-9a-f]{24}$/i.test(value);
  }

  private scrollSoon() {
    setTimeout(() => {
      const el = this.messagesArea?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
