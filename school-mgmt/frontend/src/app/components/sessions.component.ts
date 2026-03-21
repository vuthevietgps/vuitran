import { CommonModule } from '@angular/common';
import { Component, signal, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SessionItem, SessionService, SessionQueryParams } from '../services/session.service';
import { ClassItem, ClassService } from '../services/class.service';
import { AuthService } from '../services/auth.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý buổi học</h2>
      <p>Xem và quản lý các buổi học, theo dõi tiến trình dạy &amp; thanh toán.</p>
    </div>
    <button class="primary" (click)="openCreate()" *ngIf="canCreate()">+ Tạo buổi học</button>
  </header>
  <app-flow-guide featureKey="sessions"></app-flow-guide>

  <!-- Stats bar -->
  <div class="stats-bar" *ngIf="stats()">
    <div class="stat-card">
      <span class="stat-value">{{stats()!.totalSessions}}</span>
      <span class="stat-label">Tổng buổi</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{formatCurrency(stats()!.totalRevenue)}}</span>
      <span class="stat-label">Doanh thu</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{formatCurrency(stats()!.totalTeacherCost)}}</span>
      <span class="stat-label">Chi phí GV</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{{formatCurrency(stats()!.totalRevenue - stats()!.totalTeacherCost)}}</span>
      <span class="stat-label">Lợi nhuận</span>
    </div>
  </div>

  <!-- Filter bar -->
  <div class="filters">
    <select [(ngModel)]="filter.classId" (change)="load()">
      <option value="">Tất cả lớp</option>
      <option *ngFor="let c of classes()" [value]="c._id">{{c.code}} - {{c.name}}</option>
    </select>
    <select [(ngModel)]="filter.status" (change)="load()">
      <option value="">Mọi trạng thái</option>
      <option value="SCHEDULED">Đã lên lịch</option>
      <option value="TEACHER_COMPLETED">GV hoàn thành</option>
      <option value="PARENT_CONFIRMED">PH xác nhận</option>
      <option value="FINALIZED">Đã chốt</option>
      <option value="CANCELLED">Đã hủy</option>
      <option value="NO_SHOW">Vắng</option>
    </select>
    <input type="date" [(ngModel)]="filter.fromDate" (change)="load()" placeholder="Từ ngày" />
    <input type="date" [(ngModel)]="filter.toDate" (change)="load()" placeholder="Đến ngày" />
  </div>

  <!-- Sessions table -->
  <table class="data" *ngIf="sessions().length; else empty">
    <thead>
      <tr>
        <th>Lớp</th>
        <th>Học sinh</th>
        <th>Giáo viên</th>
        <th>Ngày</th>
        <th>Giờ</th>
        <th>Học phí</th>
        <th>Lương GV</th>
        <th>Trạng thái</th>
        <th>Hành động</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let s of sessions()" [class]="'row-' + s.status.toLowerCase()">
        <td>{{s.classId.code || '—'}}</td>
        <td>{{s.studentId.fullName}} <small *ngIf="s.studentId.studentCode">({{s.studentId.studentCode}})</small></td>
        <td>{{s.teacherId.fullName}}</td>
        <td>{{s.scheduledDate | date:'dd/MM/yyyy'}}</td>
        <td>{{s.scheduledStartTime}} – {{s.scheduledEndTime}}</td>
        <td [class.zero-finance]="s.status === 'NO_SHOW' || s.status === 'CANCELLED'">
          {{formatCurrency(s.amountCharged)}}
          <span *ngIf="s.status === 'NO_SHOW'" class="zero-note" title="Vắng mặt — không thu phí">⊘</span>
          <span *ngIf="s.status === 'CANCELLED'" class="zero-note" title="Đã hủy — không thu phí">⊘</span>
        </td>
        <td [class.zero-finance]="s.status === 'NO_SHOW' || s.status === 'CANCELLED'">
          {{formatCurrency(s.teacherPayout)}}
          <span *ngIf="s.status === 'NO_SHOW'" class="zero-note" title="Vắng mặt — không tính lương GV">⊘</span>
          <span *ngIf="s.status === 'CANCELLED'" class="zero-note" title="Đã hủy — không tính lương GV">⊘</span>
        </td>
        <td><span class="badge" [class]="'badge-' + s.status.toLowerCase()">{{statusLabel(s.status)}}</span></td>
        <td class="actions-cell">
          <button class="ghost sm" (click)="viewDetail(s)" title="Chi tiết">👁️</button>
          <ng-container *ngIf="s.status === 'SCHEDULED'">
            <button class="ghost sm" (click)="completeSession(s)" *ngIf="isTeacher()">✅ Hoàn thành</button>
            <button class="ghost sm" (click)="cancelSession(s)" *ngIf="canCreate()">❌ Hủy</button>
          </ng-container>
          <button class="ghost sm" (click)="confirmSession(s)" *ngIf="s.status === 'TEACHER_COMPLETED' && isParent()">✔️ Xác nhận</button>
          <button class="ghost sm" (click)="finalizeSession(s)" *ngIf="s.status === 'TEACHER_COMPLETED' && canCreate()">🔒 Chốt</button>
          <button class="danger sm" (click)="remove(s)" *ngIf="s.status === 'SCHEDULED' && isDirector()">🗑️</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty-msg">Không có buổi học nào.</p></ng-template>

  <!-- Pagination -->
  <div class="pagination" *ngIf="totalPages() > 1">
    <button (click)="goPage(currentPage() - 1)" [disabled]="currentPage() <= 1">&laquo;</button>
    <span>Trang {{currentPage()}} / {{totalPages()}}</span>
    <button (click)="goPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()">&raquo;</button>
  </div>

  <!-- Create modal -->
  <div class="modal-backdrop" *ngIf="showCreateModal()">
    <div class="modal">
      <h3>Tạo buổi học</h3>
      <div class="tab-bar">
        <button [class.active]="createMode === 'single'" (click)="createMode = 'single'">Tạo 1 buổi</button>
        <button [class.active]="createMode === 'bulk'" (click)="createMode = 'bulk'">Tạo hàng loạt</button>
      </div>
      <form (ngSubmit)="submitCreate()">
        <label>Lớp học
          <select [(ngModel)]="createForm.classId" name="classId" required (change)="onCreateClassChange()">
            <option value="" disabled>-- Chọn lớp --</option>
            <option *ngFor="let c of classes()" [value]="c._id">{{c.code}} - {{c.name}}</option>
          </select>
        </label>

        <div *ngIf="createMode === 'single'">
          <label>Học sinh
            <select [(ngModel)]="createForm.studentId" name="studentId" required>
              <option value="" disabled>-- Chọn HS --</option>
              <option *ngFor="let st of selectedClassStudents()" [value]="st._id">{{st.fullName}}</option>
            </select>
          </label>
          <label>Ngày học
            <input type="date" [(ngModel)]="createForm.scheduledDate" name="scheduledDate" required />
          </label>
          <div class="row-2">
            <label>Giờ bắt đầu
              <input type="time" [(ngModel)]="createForm.scheduledStartTime" name="startTime" required />
            </label>
            <label>Giờ kết thúc
              <input type="time" [(ngModel)]="createForm.scheduledEndTime" name="endTime" required />
            </label>
          </div>
        </div>

        <div *ngIf="createMode === 'bulk'">
          <label>Ngày học
            <input type="date" [(ngModel)]="createForm.scheduledDate" name="bulkDate" required />
          </label>
          <div class="row-2">
            <label>Giờ bắt đầu
              <input type="time" [(ngModel)]="createForm.scheduledStartTime" name="bulkStart" required />
            </label>
            <label>Giờ kết thúc
              <input type="time" [(ngModel)]="createForm.scheduledEndTime" name="bulkEnd" required />
            </label>
          </div>
          <p class="hint">Sẽ tạo buổi cho tất cả học sinh trong lớp.</p>
        </div>

        <div class="modal-actions">
          <button type="button" class="ghost" (click)="showCreateModal.set(false)">Hủy</button>
          <button type="submit" class="primary">Tạo</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Detail modal -->
  <div class="modal-backdrop" *ngIf="showDetailModal()">
    <div class="modal modal-lg">
      <h3>Chi tiết buổi học</h3>
      <div class="detail-grid" *ngIf="selectedSession()">
        <div class="detail-row"><span>Lớp:</span><span>{{selectedSession()?.classId?.name}} ({{selectedSession()?.classId?.code}})</span></div>
        <div class="detail-row"><span>Học sinh:</span><span>{{selectedSession()?.studentId?.fullName}}</span></div>
        <div class="detail-row"><span>Giáo viên:</span><span>{{selectedSession()?.teacherId?.fullName}}</span></div>
        <div class="detail-row"><span>Ngày:</span><span>{{selectedSession()?.scheduledDate | date:'dd/MM/yyyy'}}</span></div>
        <div class="detail-row"><span>Giờ:</span><span>{{selectedSession()?.scheduledStartTime}} – {{selectedSession()?.scheduledEndTime}}</span></div>
        <div class="detail-row"><span>Học phí:</span><span>{{formatCurrency(selectedSession()?.amountCharged || 0)}}</span></div>
        <div class="detail-row"><span>Lương GV:</span><span>{{formatCurrency(selectedSession()?.teacherPayout || 0)}}</span></div>
        <div class="detail-row"><span>Trạng thái:</span><span class="badge" [class]="'badge-' + (selectedSession()?.status || '').toLowerCase()">{{statusLabel(selectedSession()?.status || '')}}</span></div>
        <div class="detail-row" *ngIf="selectedSession()?.topicsCovered"><span>Nội dung:</span><span>{{selectedSession()?.topicsCovered}}</span></div>
        <div class="detail-row" *ngIf="selectedSession()?.homework"><span>BTVN:</span><span>{{selectedSession()?.homework}}</span></div>
        <div class="detail-row" *ngIf="selectedSession()?.teacherNotes"><span>Ghi chú GV:</span><span>{{selectedSession()?.teacherNotes}}</span></div>
        <div class="detail-row" *ngIf="selectedSession()?.parentNotes"><span>Ghi chú PH:</span><span>{{selectedSession()?.parentNotes}}</span></div>
        <div class="detail-row" *ngIf="selectedSession()?.parentRating"><span>Đánh giá PH:</span><span>{{'⭐'.repeat(selectedSession()?.parentRating || 0)}}</span></div>
      </div>
      <div class="modal-actions">
        <button class="ghost" (click)="showDetailModal.set(false)">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Complete modal (for teacher) -->
  <div class="modal-backdrop" *ngIf="showCompleteModal()">
    <div class="modal">
      <h3>Hoàn thành buổi dạy</h3>
      <form (ngSubmit)="submitComplete()">
        <label>Nội dung đã dạy
          <textarea [(ngModel)]="completeForm.topicsCovered" name="topicsCovered" rows="3"></textarea>
        </label>
        <label>Bài tập về nhà
          <textarea [(ngModel)]="completeForm.homework" name="homework" rows="2"></textarea>
        </label>
        <label>Ghi chú
          <textarea [(ngModel)]="completeForm.teacherNotes" name="teacherNotes" rows="2"></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="ghost" (click)="showCompleteModal.set(false)">Hủy</button>
          <button type="submit" class="primary">Hoàn thành</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Confirm modal (for parent) -->
  <div class="modal-backdrop" *ngIf="showConfirmModal()">
    <div class="modal">
      <h3>Xác nhận buổi học</h3>
      <form (ngSubmit)="submitConfirm()">
        <label>Đánh giá (1-5 sao)
          <input type="number" [(ngModel)]="confirmForm.rating" name="rating" min="1" max="5" />
        </label>
        <label>Ghi chú
          <textarea [(ngModel)]="confirmForm.parentNotes" name="parentNotes" rows="2"></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="ghost" (click)="showConfirmModal.set(false)">Hủy</button>
          <button type="submit" class="primary">Xác nhận</button>
        </div>
      </form>
    </div>
  </div>
  `,
  styles: [`
    :host { display:block; padding:24px; font-family:'Segoe UI',sans-serif; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; }
    .page-header h2 { margin:0; color:#1e293b; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600; }
    .primary:hover { background:#1d4ed8; }
    .ghost { background:none; border:1px solid #cbd5e1; color:#334155; padding:6px 14px; border-radius:6px; cursor:pointer; }
    .ghost:hover { background:#f1f5f9; }
    .ghost.sm, .danger.sm { padding:4px 8px; font-size:12px; }
    .danger { background:#dc2626; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; }
    .danger:hover { background:#b91c1c; }

    .stats-bar { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:18px; }
    .stat-card { background:#fff; border-radius:8px; padding:14px 18px; box-shadow:0 1px 3px rgba(0,0,0,0.08); text-align:center; }
    .stat-value { display:block; font-size:20px; font-weight:700; color:#1e293b; }
    .stat-label { font-size:12px; color:#64748b; }

    .filters { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .filters select, .filters input { padding:7px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; background:#fff; }

    .data { width:100%; border-collapse:separate; border-spacing:0; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .data th { text-align:left; background:#f1f5f9; padding:10px 12px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .data td { padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:13px; }
    .data tr:last-child td { border-bottom:none; }
    .data tr:hover td { background:#f8fafc; }

    .actions-cell { white-space:nowrap; }
    .actions-cell button { margin-right:4px; }

    .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; text-transform:uppercase; }
    .badge-scheduled { background:#dbeafe; color:#1d4ed8; }
    .badge-teacher_completed { background:#fef3c7; color:#92400e; }
    .badge-parent_confirmed { background:#d1fae5; color:#065f46; }
    .badge-finalized { background:#dcfce7; color:#166534; }
    .badge-cancelled { background:#fee2e2; color:#991b1b; }
    .badge-no_show { background:#fce7f3; color:#9d174d; }

    .row-cancelled td { opacity:0.5; }
    .row-no_show td { opacity:0.65; }
    .zero-finance { color:#94a3b8; }
    .zero-note { font-size:10px; color:#94a3b8; margin-left:3px; cursor:help; }

    .pagination { display:flex; align-items:center; gap:12px; justify-content:center; margin-top:16px; }
    .pagination button { background:#fff; border:1px solid #cbd5e1; padding:6px 14px; border-radius:6px; cursor:pointer; }
    .pagination button:disabled { opacity:.4; cursor:default; }

    .empty-msg { color:#64748b; padding:32px 0; text-align:center; }

    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; border-radius:12px; padding:28px; width:500px; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-lg { width:600px; }
    .modal h3 { margin:0 0 16px; color:#1e293b; }
    .modal label { display:block; margin-bottom:10px; font-size:13px; font-weight:500; color:#334155; }
    .modal input, .modal select, .modal textarea { width:100%; margin-top:4px; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box; }
    .modal textarea { resize:vertical; }
    .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }
    .row-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; }

    .tab-bar { display:flex; gap:6px; margin-bottom:14px; }
    .tab-bar button { background:#f1f5f9; border:1px solid #e2e8f0; padding:6px 16px; border-radius:6px; cursor:pointer; font-size:13px; }
    .tab-bar button.active { background:#2563eb; color:#fff; border-color:#2563eb; }

    .hint { color:#64748b; font-size:12px; font-style:italic; margin:6px 0; }

    .detail-grid { display:grid; gap:8px; }
    .detail-row { display:grid; grid-template-columns:140px 1fr; gap:8px; font-size:13px; padding:4px 0; border-bottom:1px solid #f1f5f9; }
    .detail-row span:first-child { color:#64748b; font-weight:500; }
  `]
})
export class SessionsComponent implements OnInit {
  private sessionSvc = inject(SessionService);
  private classSvc = inject(ClassService);
  private auth: AuthService;

  sessions = signal<SessionItem[]>([]);
  classes = signal<ClassItem[]>([]);
  stats = signal<{ totalSessions: number; totalRevenue: number; totalTeacherCost: number; byStatus: any } | null>(null);
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  showCompleteModal = signal(false);
  showConfirmModal = signal(false);
  selectedSession = signal<SessionItem | null>(null);
  selectedClassStudents = signal<any[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);

  createMode: 'single' | 'bulk' = 'single';

  filter: SessionQueryParams = { classId: '', status: '', fromDate: '', toDate: '' };

  createForm: any = { classId: '', studentId: '', scheduledDate: '', scheduledStartTime: '', scheduledEndTime: '' };
  completeForm: any = { topicsCovered: '', homework: '', teacherNotes: '' };
  confirmForm: any = { rating: 5, parentNotes: '' };
  actionSessionId = '';

  constructor(auth: AuthService) {
    this.auth = auth;
  }

  ngOnInit(): void {
    this.load();
    this.loadClasses();
  }

  async load(): Promise<void> {
    const params: SessionQueryParams = { page: this.currentPage(), limit: 20 };
    if (this.filter.classId) params.classId = this.filter.classId;
    if (this.filter.status) params.status = this.filter.status;
    if (this.filter.fromDate) params.fromDate = this.filter.fromDate;
    if (this.filter.toDate) params.toDate = this.filter.toDate;

    const res = await this.sessionSvc.list(params);
    this.sessions.set(res.data || []);
    this.totalPages.set(res.meta?.totalPages || 1);

    // Load stats for management roles
    if (this.canCreate()) {
      const statsParams: any = {};
      if (this.filter.classId) statsParams.classId = this.filter.classId;
      if (this.filter.fromDate) statsParams.fromDate = this.filter.fromDate;
      if (this.filter.toDate) statsParams.toDate = this.filter.toDate;
      const st = await this.sessionSvc.getStats(statsParams);
      this.stats.set(st);
    }
  }

  async loadClasses(): Promise<void> {
    const res = await this.classSvc.list();
    this.classes.set(res);
  }

  goPage(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.load();
  }

  openCreate(): void {
    this.createForm = { classId: '', studentId: '', scheduledDate: '', scheduledStartTime: '', scheduledEndTime: '' };
    this.createMode = 'single';
    this.selectedClassStudents.set([]);
    this.showCreateModal.set(true);
  }

  onCreateClassChange(): void {
    const cls = this.classes().find(c => c._id === this.createForm.classId);
    if (cls?.students) {
      this.selectedClassStudents.set(cls.students);
    } else {
      this.selectedClassStudents.set([]);
    }
    this.createForm.studentId = '';
  }

  async submitCreate(): Promise<void> {
    if (this.createMode === 'bulk') {
      const ok = await this.sessionSvc.bulkCreate({
        classId: this.createForm.classId,
        scheduledDate: this.createForm.scheduledDate,
        scheduledStartTime: this.createForm.scheduledStartTime,
        scheduledEndTime: this.createForm.scheduledEndTime,
      });
      if (ok) {
        this.showCreateModal.set(false);
        this.load();
      } else {
        alert('Lỗi khi tạo hàng loạt');
      }
    } else {
      const ok = await this.sessionSvc.create({
        classId: this.createForm.classId,
        studentId: this.createForm.studentId,
        scheduledDate: this.createForm.scheduledDate,
        scheduledStartTime: this.createForm.scheduledStartTime,
        scheduledEndTime: this.createForm.scheduledEndTime,
      });
      if (ok) {
        this.showCreateModal.set(false);
        this.load();
      } else {
        alert('Lỗi khi tạo buổi học');
      }
    }
  }

  viewDetail(s: SessionItem): void {
    this.selectedSession.set(s);
    this.showDetailModal.set(true);
  }

  completeSession(s: SessionItem): void {
    this.actionSessionId = s._id;
    this.completeForm = { topicsCovered: '', homework: '', teacherNotes: '' };
    this.showCompleteModal.set(true);
  }

  async submitComplete(): Promise<void> {
    const ok = await this.sessionSvc.teacherComplete(this.actionSessionId, this.completeForm);
    if (ok) {
      this.showCompleteModal.set(false);
      this.load();
    } else {
      alert('Lỗi khi hoàn thành buổi học');
    }
  }

  confirmSession(s: SessionItem): void {
    this.actionSessionId = s._id;
    this.confirmForm = { rating: 5, parentNotes: '' };
    this.showConfirmModal.set(true);
  }

  async submitConfirm(): Promise<void> {
    const ok = await this.sessionSvc.parentConfirm(this.actionSessionId, this.confirmForm);
    if (ok) {
      this.showConfirmModal.set(false);
      this.load();
    } else {
      alert('Lỗi khi xác nhận buổi học');
    }
  }

  async finalizeSession(s: SessionItem): Promise<void> {
    if (!confirm('Chốt buổi học này? Sẽ trừ ví học sinh và ghi nhận lương GV.')) return;
    const ok = await this.sessionSvc.finalize(s._id);
    if (ok) this.load();
    else alert('Lỗi khi chốt buổi học');
  }

  async cancelSession(s: SessionItem): Promise<void> {
    const reason = prompt('Lý do hủy buổi học:');
    if (!reason) return;
    const ok = await this.sessionSvc.cancel(s._id, reason);
    if (ok) this.load();
    else alert('Lỗi khi hủy buổi học');
  }

  async remove(s: SessionItem): Promise<void> {
    if (!confirm('Xóa buổi học này?')) return;
    const ok = await this.sessionSvc.remove(s._id);
    if (ok) this.load();
  }

  formatCurrency(n: number): string {
    return (n || 0).toLocaleString('vi-VN') + ' ₫';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      'SCHEDULED': 'Đã lên lịch',
      'TEACHER_COMPLETED': 'GV hoàn thành',
      'PARENT_CONFIRMED': 'PH xác nhận',
      'FINALIZED': 'Đã chốt',
      'CANCELLED': 'Đã hủy',
      'NO_SHOW': 'Vắng',
    };
    return map[status] || status;
  }

  canCreate(): boolean {
    const r = this.auth.userSignal()?.role;
    return r === 'DIRECTOR' || r === 'OPS';
  }

  isTeacher(): boolean { return this.auth.userSignal()?.role === 'TEACHER'; }
  isParent(): boolean { return this.auth.userSignal()?.role === 'PARENT'; }
  isDirector(): boolean { return this.auth.userSignal()?.role === 'DIRECTOR'; }
}
