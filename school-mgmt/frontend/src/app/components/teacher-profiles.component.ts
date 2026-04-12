import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BankInfo,
  TeacherFullProfile,
  TeacherLinkedUser,
  TeacherProfile,
  TeacherProfileUpdatePayload,
  TeacherService,
} from '../services/teacher.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface TeacherEditForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  subjects: string;
  grades: string;
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string;
  bio: string;
  yearsOfExperience: number;
  pricePerSession: number;
  pricePerHour: number | null;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  bankBranch: string;
  managedSales: string[];
}

@Component({
  selector: 'app-teacher-profiles',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent, RouterLink],
  template: `
  <app-flow-guide featureKey="teacher-profiles"></app-flow-guide>
  <div class="profiles-page">
    <div class="section-tabs" *ngIf="canViewRegistrations()">
      <a routerLink="/app/teacher-profiles" class="tab-link active">Ho so giao vien</a>
      <a routerLink="/app/teacher-registrations" class="tab-link">Giao vien dang ky</a>
    </div>
    <section *ngIf="!selectedId">
      <div class="header">
        <div>
          <h2>Ho so giao vien</h2>
          <p class="subtext">Sale chi thay giao vien va lop hoc trong pham vi cua minh.</p>
        </div>
        <div class="controls">
          <input class="search-input" [(ngModel)]="searchText" (input)="filterTeachers()" placeholder="Tim ten, ma TK, email, mon hoc" />
          <select data-testid="teacher-status-filter" [(ngModel)]="statusFilter" (change)="filterTeachers()">
            <option value="ALL">Tat ca</option>
            <option value="ACTIVE">Dang hoat dong</option>
            <option value="APPROVED">Da duyet</option>
            <option value="PENDING">Cho duyet</option>
            <option value="SUSPENDED">Tam ngung</option>
            <option value="INACTIVE">Khong hoat dong</option>
          </select>
        </div>
      </div>

      <div *ngIf="loading()" class="loading">Dang tai danh sach giao vien...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <div *ngIf="filteredList.length > 0" class="teachers-grid">
        <article
          *ngFor="let teacher of filteredList"
          class="teacher-card"
          [attr.data-testid]="'teacher-card-' + teacher._id"
          (click)="openProfile(teacher._id)">
          <div class="tc-header">
            <div class="tc-avatar">{{ getInitials(teacher) }}</div>
            <div class="tc-info">
              <h4>{{ getUserName(teacher) }}</h4>
              <div class="muted">{{ getUserCode(teacher) || 'Chua co ma TK' }}</div>
              <div class="muted">{{ getUserEmail(teacher) }}</div>
            </div>
            <span
              class="badge"
              data-testid="teacher-list-status-badge"
              [attr.data-status]="teacher.status">{{ statusLabel(teacher.status) }}</span>
          </div>

          <div class="chips" *ngIf="teacher.subjects?.length">
            <span class="tag" *ngFor="let subject of teacher.subjects">{{ subject }}</span>
          </div>
          <div class="chips" *ngIf="getManagedSales(teacher).length">
            <span class="manager-chip" *ngFor="let manager of getManagedSales(teacher)">{{ getManagerName(manager) }}</span>
          </div>

          <div class="stats-row">
            <div><strong>{{ teacher.totalSessions || 0 }}</strong><span>Buoi day</span></div>
            <div><strong>{{ teacher.activeClasses || 0 }}</strong><span>Lop dang day</span></div>
            <div><strong>{{ teacher.rating || 'N/A' }}</strong><span>Danh gia</span></div>
            <div><strong>{{ teacher.yearsOfExperience || 0 }}</strong><span>Nam KN</span></div>
          </div>
        </article>
      </div>

      <div *ngIf="filteredList.length === 0 && !loading()" class="empty">Khong tim thay giao vien nao</div>
    </section>

    <section *ngIf="selectedId">
      <div class="header">
        <button class="ghost-btn" (click)="closeProfile()">&larr; Quay lai</button>
        <div class="detail-title">
          <h2>Chi tiet giao vien</h2>
          <p class="subtext" *ngIf="isSale()">Sale chi thay lop, hoc sinh va buoi hoc thuoc sale cua minh.</p>
        </div>
        <div class="detail-actions">
          <button *ngIf="canApproveSelected()" class="secondary-btn" (click)="approveSelected()">Duyet</button>
          <button
            *ngIf="canSuspendSelected()"
            class="danger-btn"
            data-testid="teacher-suspend-button"
            (click)="suspendSelected()">Vo hieu hoa</button>
          <button
            *ngIf="canActivateSelected()"
            class="secondary-btn"
            data-testid="teacher-activate-button"
            (click)="activateSelected()">Kich hoat lai</button>
          <button *ngIf="canEditSelected()" class="primary-btn" (click)="openEditModal()">Sua</button>
        </div>
      </div>

      <div *ngIf="detailLoading()" class="loading">Dang tai ho so...</div>
      <div *ngIf="detailError()" class="error">{{ detailError() }}</div>

      <div *ngIf="fullProfile() as fp">
        <div class="stats-strip" [class.sale-view]="isSale()">
          <div class="stat-card"><strong>{{ fp.sessions.totalCount }}</strong><span>Tong buoi day</span></div>
          <div class="stat-card" *ngIf="showFinance()"><strong>{{ fp.payroll.totalPaid | number:'1.0-0' }}d</strong><span>Tong thu nhap</span></div>
          <div class="stat-card" *ngIf="!showFinance()"><strong>{{ getManagedSales(profileData()).length }}</strong><span>Sale quan ly</span></div>
          <div class="stat-card"><strong>{{ fp.classes.totalActive }}</strong><span>Lop dang day</span></div>
          <div class="stat-card"><strong>{{ profileData()?.rating || 'N/A' }}</strong><span>Danh gia</span></div>
        </div>

        <div class="content-grid">
          <section class="card">
            <h3>Thong tin tai khoan</h3>
            <div class="info-grid">
              <div><label>Ma TK</label><span>{{ getProfileUserCode(profileData()) || 'Chua co' }}</span></div>
              <div><label>Trang thai</label><span class="badge" data-testid="teacher-detail-status-badge" [attr.data-status]="profileData()?.status">{{ statusLabel(profileData()?.status || '') }}</span></div>
              <div><label>Ho ten</label><span>{{ getProfileUserName(profileData()) }}</span></div>
              <div><label>Email</label><span>{{ getProfileUserEmail(profileData()) }}</span></div>
              <div><label>So dien thoai</label><span>{{ getProfileUserPhone(profileData()) || 'Chua cap nhat' }}</span></div>
              <div><label>Kinh nghiem</label><span>{{ profileData()?.yearsOfExperience || 0 }} nam</span></div>
            </div>
            <div class="field-block">
              <label>Sale quan ly</label>
              <div class="chips" *ngIf="getManagedSales(profileData()).length; else noManagers">
                <span class="manager-chip" *ngFor="let manager of getManagedSales(profileData()); let idx = index">Sale quan ly {{ idx + 1 }}: {{ getManagerName(manager) }}</span>
              </div>
              <ng-template #noManagers><p class="muted">Chua khai bao sale quan ly.</p></ng-template>
            </div>
            <div class="field-block" *ngIf="profileData()?.bio">
              <label>Gioi thieu</label>
              <p class="bio-text">{{ profileData()?.bio }}</p>
            </div>
          </section>

          <section class="card">
            <h3>Thong tin giang day</h3>
            <div class="info-grid">
              <div>
                <label>Mon day</label>
                <div class="chips">
                  <span class="tag" *ngFor="let subject of profileData()?.subjects || []">{{ subject }}</span>
                  <span *ngIf="!(profileData()?.subjects || []).length" class="muted">Chua cap nhat</span>
                </div>
              </div>
              <div>
                <label>Khoi lop</label>
                <div class="chips">
                  <span class="tag gray" *ngFor="let grade of profileData()?.grades || []">{{ grade }}</span>
                  <span *ngIf="!(profileData()?.grades || []).length" class="muted">Chua cap nhat</span>
                </div>
              </div>
              <div><label>Hinh thuc</label><span>{{ teachingModeLabel(profileData()?.teachingMode || '') }}</span></div>
              <div><label>Khu vuc</label><span>{{ (profileData()?.locations || []).join(', ') || 'Chua cap nhat' }}</span></div>
              <div><label>Gia/buoi</label><span>{{ profileData()?.pricePerSession | number:'1.0-0' }}d</span></div>
              <div *ngIf="profileData()?.pricePerHour"><label>Gia/gio</label><span>{{ profileData()?.pricePerHour | number:'1.0-0' }}d</span></div>
            </div>
          </section>

          <section class="card" *ngIf="showFinance() && profileData()?.bankInfo">
            <h3>Thong tin ngan hang</h3>
            <div class="info-grid">
              <div><label>Ngan hang</label><span>{{ profileData()?.bankInfo?.bankName }}</span></div>
              <div><label>So TK</label><span>{{ profileData()?.bankInfo?.accountNumber }}</span></div>
              <div><label>Chu TK</label><span>{{ profileData()?.bankInfo?.accountHolderName }}</span></div>
              <div *ngIf="profileData()?.bankInfo?.branch"><label>Chi nhanh</label><span>{{ profileData()?.bankInfo?.branch }}</span></div>
            </div>
          </section>

          <section class="card wide">
            <h3>Lop dang day ({{ fp.classes.totalActive }})</h3>
            <div *ngIf="fp.classes.active.length; else noClasses" class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ten lop</th>
                    <th>Ma lop</th>
                    <th>Hoc sinh</th>
                    <th>Gia/buoi</th>
                    <th *ngIf="showFinance()">Luong GV/buoi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let classItem of fp.classes.active">
                    <td>{{ classItem.name }}</td>
                    <td>{{ classItem.code }}</td>
                    <td>{{ getStudentNames(classItem.students) }}</td>
                    <td>{{ classItem.pricePerSession | number:'1.0-0' }}d</td>
                    <td *ngIf="showFinance()">{{ classItem.teacherPayPerSession | number:'1.0-0' }}d</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #noClasses><p class="muted">Chua co lop dang day.</p></ng-template>
          </section>
          <section class="card" *ngIf="objectEntries(fp.sessions.byStatus).length">
            <h3>Thong ke buoi hoc</h3>
            <div class="session-stats">
              <div *ngFor="let item of objectEntries(fp.sessions.byStatus)" class="session-row">
                <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
                <span>{{ item[1].count }} buoi</span>
                <span *ngIf="showFinance()" class="money">{{ item[1].totalPayout | number:'1.0-0' }}d</span>
              </div>
            </div>
          </section>

          <section class="card wide" *ngIf="fp.sessions.recent.length">
            <h3>Buoi day gan day</h3>
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ngay</th>
                    <th>Lop</th>
                    <th>Hoc sinh</th>
                    <th>Trang thai</th>
                    <th *ngIf="showFinance()">Luong</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let session of fp.sessions.recent">
                    <td>{{ session.scheduledDate | date:'dd/MM/yyyy' }}</td>
                    <td>{{ session.classId?.name || 'N/A' }}</td>
                    <td>{{ session.studentId?.fullName || 'N/A' }}</td>
                    <td><span class="badge" [attr.data-status]="session.status">{{ session.status }}</span></td>
                    <td *ngIf="showFinance()">{{ session.teacherPayout | number:'1.0-0' }}d</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  </div>

  <div class="modal-backdrop" *ngIf="showEditModal()">
    <div class="modal">
      <div class="header compact">
        <h3>Sua ho so giao vien</h3>
        <button type="button" class="ghost-btn" (click)="closeEditModal()">Dong</button>
      </div>

      <form (ngSubmit)="saveProfile()" class="edit-form">
        <div class="form-grid">
          <label>Ho ten<input [(ngModel)]="editForm.fullName" name="fullName" required /></label>
          <label>Email<input [(ngModel)]="editForm.email" name="email" type="email" required /></label>
          <label>So dien thoai<input [(ngModel)]="editForm.phone" name="phone" /></label>
          <label *ngIf="isDirector()">Mat khau moi
            <input [(ngModel)]="editForm.password" name="password" type="password" autocomplete="new-password" placeholder="Bo trong neu khong doi" />
          </label>
          <label>Hinh thuc day
            <select [(ngModel)]="editForm.teachingMode" name="teachingMode">
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
              <option value="BOTH">Ca hai</option>
            </select>
          </label>
          <label>Mon day<input [(ngModel)]="editForm.subjects" name="subjects" placeholder="Toan, Van, Anh" /></label>
          <label>Khoi lop<input [(ngModel)]="editForm.grades" name="grades" placeholder="Lop 6, Lop 7" /></label>
          <label>Khu vuc<input [(ngModel)]="editForm.locations" name="locations" placeholder="Q1, Q3" /></label>
          <label>Kinh nghiem (nam)<input [(ngModel)]="editForm.yearsOfExperience" name="yearsOfExperience" type="number" min="0" /></label>
          <label>Gia/buoi<input [(ngModel)]="editForm.pricePerSession" name="pricePerSession" type="number" min="0" /></label>
          <label>Gia/gio<input [(ngModel)]="editForm.pricePerHour" name="pricePerHour" type="number" min="0" /></label>
        </div>

        <label class="full-width">Gioi thieu<textarea [(ngModel)]="editForm.bio" name="bio" rows="4"></textarea></label>

        <div *ngIf="showFinance()" class="sales-editor">
          <div class="header compact">
            <h4>Thong tin ngan hang</h4>
          </div>
          <div class="form-grid">
            <label>Ngan hang<input [(ngModel)]="editForm.bankName" name="bankName" /></label>
            <label>So TK<input [(ngModel)]="editForm.accountNumber" name="accountNumber" /></label>
            <label>Chu TK<input [(ngModel)]="editForm.accountHolderName" name="accountHolderName" /></label>
            <label>Chi nhanh<input [(ngModel)]="editForm.bankBranch" name="bankBranch" /></label>
          </div>
        </div>

        <div *ngIf="isDirector()" class="sales-editor">
          <div class="header compact">
            <h4>Sale quan ly</h4>
            <button type="button" class="secondary-btn" (click)="addManagedSaleSlot()">+ Them sale</button>
          </div>
          <div *ngIf="!editForm.managedSales.length" class="muted">Chua co sale quan ly nao.</div>
          <div *ngFor="let saleId of editForm.managedSales; let idx = index" class="sale-row">
            <label>
              Sale quan ly {{ idx + 1 }}
              <select [ngModel]="saleId" (ngModelChange)="updateManagedSaleSlot(idx, $event)" [name]="'managedSale' + idx">
                <option value="">-- Chon sale --</option>
                <option *ngFor="let sale of salesOptions()" [value]="sale._id">{{ sale.fullName }}{{ sale.userCode ? ' (' + sale.userCode + ')' : '' }}</option>
              </select>
            </label>
            <button type="button" class="danger-btn" (click)="removeManagedSaleSlot(idx)">Xoa</button>
          </div>
        </div>

        <div *ngIf="formError()" class="error">{{ formError() }}</div>
        <div class="form-actions">
          <button type="button" class="ghost-btn" (click)="closeEditModal()">Huy</button>
          <button type="submit" class="primary-btn" [disabled]="saving()">{{ saving() ? 'Dang luu...' : 'Luu thay doi' }}</button>
        </div>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .profiles-page { padding: 24px; max-width: 1280px; margin: 0 auto; }
    .section-tabs { display: flex; gap: 10px; margin-bottom: 18px; }
    .tab-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #334155;
      text-decoration: none;
      font-weight: 600;
    }
    .tab-link.active { background: #0f766e; border-color: #0f766e; color: #fff; }
    .header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .header.compact { margin-bottom: 12px; }
    h2, h3, h4 { margin: 0; color: #1e293b; }
    .subtext, .muted { margin: 0; color: #64748b; font-size: 13px; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    input, select, textarea { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; }
    .search-input { min-width: 240px; }
    .loading, .empty { text-align: center; padding: 36px; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 10px; }
    .teachers-grid, .content-grid { display: grid; gap: 16px; }
    .teachers-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .content-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 20px; }
    .teacher-card, .card, .stat-card, .modal { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06); }
    .teacher-card { padding: 18px; cursor: pointer; }
    .card { padding: 20px; }
    .wide { grid-column: span 2; }
    .tc-header { display: flex; gap: 12px; align-items: flex-start; }
    .tc-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #0f766e, #22c55e); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; }
    .tc-info { flex: 1; min-width: 0; }
    .tc-info h4 { margin-bottom: 4px; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .tag, .manager-chip, .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .tag { background: #dbeafe; color: #1d4ed8; }
    .tag.gray { background: #f1f5f9; color: #334155; }
    .manager-chip { background: #fef3c7; color: #92400e; }
    .badge { background: #e2e8f0; color: #475569; }
    .badge[data-status="ACTIVE"] { background: #dcfce7; color: #166534; }
    .badge[data-status="APPROVED"] { background: #dbeafe; color: #1d4ed8; }
    .badge[data-status="PENDING"] { background: #fef3c7; color: #a16207; }
    .badge[data-status="SUSPENDED"], .badge[data-status="CANCELLED"] { background: #fee2e2; color: #b91c1c; }
    .badge[data-status="INACTIVE"] { background: #f1f5f9; color: #475569; }
    .badge[data-status="FINALIZED"], .badge[data-status="PAID"] { background: #dcfce7; color: #166534; }
    .badge[data-status="SCHEDULED"] { background: #dbeafe; color: #1d4ed8; }
    .badge[data-status="TEACHER_COMPLETED"] { background: #fef3c7; color: #a16207; }
    .stats-row, .info-grid, .stats-strip, .form-grid { display: grid; gap: 10px; }
    .stats-row, .stats-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .stats-strip.sale-view { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .stats-row div, .stat-card { padding: 12px; background: #f8fafc; border-radius: 12px; }
    .stats-row strong, .stat-card strong { display: block; color: #0f172a; }
    .stats-row span, .stat-card span { font-size: 12px; color: #64748b; }
    .stat-card { background: #fff; }
    .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; }
    .info-grid label, .field-block label { display: block; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .field-block { margin-top: 14px; }
    .bio-text { margin: 6px 0 0; color: #334155; white-space: pre-line; }
    .table-wrap { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px; }
    .data-table th, .data-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    .data-table th { color: #64748b; font-size: 11px; text-transform: uppercase; }
    .session-stats { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .session-row { display: flex; align-items: center; gap: 12px; }
    .money { margin-left: auto; color: #059669; font-weight: 600; }
    .ghost-btn, .secondary-btn, .danger-btn, .primary-btn { border: none; border-radius: 10px; padding: 10px 14px; cursor: pointer; }
    .ghost-btn { background: #fff; border: 1px solid #cbd5e1; color: #334155; }
    .secondary-btn { background: #e2e8f0; color: #0f172a; }
    .danger-btn { background: #fee2e2; color: #b91c1c; }
    .primary-btn { background: #0f766e; color: #fff; }
    .primary-btn:disabled { opacity: .6; cursor: not-allowed; }
    .detail-title { flex: 1; min-width: 220px; }
    .detail-actions { display: flex; gap: 8px; align-items: center; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; }
    .modal { width: min(820px, 100%); max-height: calc(100vh - 40px); overflow: auto; padding: 20px; }
    .edit-form { display: flex; flex-direction: column; gap: 16px; }
    .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .form-grid label, .full-width, .sale-row label { display: flex; flex-direction: column; gap: 6px; color: #334155; }
    .full-width { width: 100%; }
    .sales-editor { border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .sale-row { display: flex; align-items: end; gap: 10px; margin-top: 10px; }
    .sale-row label { flex: 1; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; }
    @media (max-width: 960px) {
      .content-grid, .info-grid, .form-grid { grid-template-columns: 1fr; }
      .wide { grid-column: span 1; }
      .stats-row, .stats-strip, .stats-strip.sale-view { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sale-row { flex-direction: column; align-items: stretch; }
    }
    @media (max-width: 640px) {
      .profiles-page { padding: 16px; }
      .teachers-grid { grid-template-columns: 1fr; }
      .controls { width: 100%; }
      .search-input { min-width: 0; flex: 1; }
    }
  `],
})
export class TeacherProfilesComponent implements OnInit {
  allTeachers: TeacherProfile[] = [];
  filteredList: TeacherProfile[] = [];
  loading = signal(false);
  error = signal('');
  searchText = '';
  statusFilter = 'ALL';
  selectedId: string | null = null;
  fullProfile = signal<TeacherFullProfile | null>(null);
  detailLoading = signal(false);
  detailError = signal('');
  showEditModal = signal(false);
  saving = signal(false);
  formError = signal('');
  salesOptions = signal<UserItem[]>([]);
  editForm: TeacherEditForm = this.blankForm();

  constructor(
    private teacherService: TeacherService,
    private userService: UserService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}
  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.selectedId = id;
      if (id) {
        void this.loadFullProfile(id);
      } else {
        this.fullProfile.set(null);
        this.detailError.set('');
      }
    });
    void this.loadTeachers();
    if (this.isDirector()) void this.loadSales();
  }

  isDirector(): boolean { return this.auth.userSignal()?.role === 'DIRECTOR'; }
  isOps(): boolean { return this.auth.userSignal()?.role === 'OPS'; }
  isSale(): boolean { return this.auth.userSignal()?.role === 'SALE'; }
  canViewRegistrations(): boolean { return this.isDirector() || this.isOps(); }
  showFinance(): boolean { return !this.isSale(); }

  canEditSelected(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'SALE' || role === 'ACCOUNTING';
  }

  canApproveSelected(): boolean {
    return (this.isDirector() || this.isOps()) && this.profileData()?.status === 'PENDING';
  }

  canSuspendSelected(): boolean {
    return (this.isDirector() || this.isOps()) && this.profileData()?.status === 'ACTIVE';
  }

  canActivateSelected(): boolean {
    return (this.isDirector() || this.isOps())
      && ['APPROVED', 'SUSPENDED', 'INACTIVE'].includes(this.profileData()?.status || '');
  }

  async loadTeachers() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.allTeachers = await this.teacherService.getAllTeachers();
      this.filterTeachers();
    } catch (e: any) {
      this.error.set(this.getErrorMessage(e, 'Loi tai danh sach giao vien'));
    } finally {
      this.loading.set(false);
    }
  }

  async loadSales() {
    try {
      const sales = await this.userService.listSales();
      this.salesOptions.set((sales || []).filter((item) => item.role === 'SALE'));
    } catch {
      this.salesOptions.set([]);
    }
  }

  filterTeachers() {
    let list = [...this.allTeachers];
    if (this.statusFilter !== 'ALL') list = list.filter((teacher) => teacher.status === this.statusFilter);
    if (this.searchText.trim()) {
      const keyword = this.searchText.toLowerCase().trim();
      list = list.filter((teacher) => {
        const searchable = [
          this.getUserName(teacher),
          this.getUserCode(teacher),
          this.getUserEmail(teacher),
          ...(teacher.subjects || []),
          ...this.getManagedSales(teacher).map((manager) => this.getManagerName(manager)),
        ].filter(Boolean).join(' ').toLowerCase();
        return searchable.includes(keyword);
      });
    }
    this.filteredList = list;
  }

  async openProfile(id: string) { await this.router.navigate(['/app/teacher-profiles', id]); }
  async closeProfile() { this.showEditModal.set(false); await this.router.navigate(['/app/teacher-profiles']); }

  async loadFullProfile(id: string) {
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      this.fullProfile.set(await this.teacherService.getFullProfile(id));
    } catch (e: any) {
      this.detailError.set(this.getErrorMessage(e, 'Loi tai ho so chi tiet'));
    } finally {
      this.detailLoading.set(false);
    }
  }

  async approveSelected() {
    if (!this.selectedId || !this.canApproveSelected()) return;
    if (!confirm('Duyet giao vien nay?')) return;

    this.detailError.set('');
    try {
      await this.teacherService.approve(this.selectedId);
      await this.refreshSelectedProfile();
    } catch (e: any) {
      this.detailError.set(this.getErrorMessage(e, 'Khong the duyet giao vien'));
    }
  }

  async suspendSelected() {
    if (!this.selectedId || !this.canSuspendSelected()) return;
    if (!confirm('Vo hieu hoa giao vien nay?')) return;

    this.detailError.set('');
    try {
      await this.teacherService.suspend(this.selectedId);
      await this.refreshSelectedProfile();
    } catch (e: any) {
      this.detailError.set(this.getErrorMessage(e, 'Khong the vo hieu hoa giao vien'));
    }
  }

  async activateSelected() {
    if (!this.selectedId || !this.canActivateSelected()) return;
    if (!confirm('Kich hoat lai giao vien nay?')) return;

    this.detailError.set('');
    try {
      await this.teacherService.activate(this.selectedId);
      await this.refreshSelectedProfile();
    } catch (e: any) {
      this.detailError.set(this.getErrorMessage(e, 'Khong the kich hoat lai giao vien'));
    }
  }

  openEditModal() {
    const profile = this.profileData();
    if (!profile) return;
    this.editForm = {
      fullName: this.getProfileUserName(profile),
      email: this.getProfileUserEmail(profile),
      phone: this.getProfileUserPhone(profile),
      password: '',
      subjects: (profile.subjects || []).join(', '),
      grades: (profile.grades || []).join(', '),
      teachingMode: (profile.teachingMode || 'BOTH') as 'ONLINE' | 'OFFLINE' | 'BOTH',
      locations: (profile.locations || []).join(', '),
      bio: profile.bio || '',
      yearsOfExperience: profile.yearsOfExperience || 0,
      pricePerSession: profile.pricePerSession || 0,
      pricePerHour: profile.pricePerHour ?? null,
      bankName: profile.bankInfo?.bankName || '',
      accountNumber: profile.bankInfo?.accountNumber || '',
      accountHolderName: profile.bankInfo?.accountHolderName || '',
      bankBranch: profile.bankInfo?.branch || '',
      managedSales: this.getManagedSales(profile).map((manager) => this.getManagerId(manager)).filter(Boolean),
    };
    if (this.isDirector() && !this.editForm.managedSales.length) this.editForm.managedSales = [''];
    this.formError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal() { this.showEditModal.set(false); this.formError.set(''); }
  addManagedSaleSlot() { this.editForm.managedSales = [...this.editForm.managedSales, '']; }
  updateManagedSaleSlot(index: number, saleId: string) { this.editForm.managedSales = this.editForm.managedSales.map((item, idx) => idx === index ? saleId : item); }
  removeManagedSaleSlot(index: number) { this.editForm.managedSales = this.editForm.managedSales.filter((_, idx) => idx !== index); }

  async saveProfile() {
    if (!this.selectedId) return;
    const fullName = this.editForm.fullName.trim();
    const email = this.editForm.email.trim();
    if (!fullName || !email) {
      this.formError.set('Ho ten va email la bat buoc.');
      return;
    }

    const payload: TeacherProfileUpdatePayload = {
      user: {
        fullName,
        email,
        phone: this.editForm.phone.trim() || undefined,
      },
      subjects: this.parseCommaList(this.editForm.subjects),
      grades: this.parseCommaList(this.editForm.grades),
      teachingMode: this.editForm.teachingMode,
      locations: this.parseCommaList(this.editForm.locations),
      bio: this.editForm.bio.trim(),
      yearsOfExperience: Number(this.editForm.yearsOfExperience || 0),
      pricePerSession: Number(this.editForm.pricePerSession || 0),
      pricePerHour: this.editForm.pricePerHour ? Number(this.editForm.pricePerHour) : undefined,
    };
    if (this.isDirector() && this.editForm.password.trim()) {
      payload.user = {
        ...payload.user,
        password: this.editForm.password.trim(),
      };
    }
    const bankInfoResult = this.buildBankInfoPayload();
    if (bankInfoResult.error) {
      this.formError.set(bankInfoResult.error);
      return;
    }
    if (bankInfoResult.bankInfo) {
      payload.bankInfo = bankInfoResult.bankInfo;
    }
    if (this.isDirector()) {
      payload.managedSales = Array.from(new Set(this.editForm.managedSales.map((saleId) => saleId.trim()).filter(Boolean)));
    }

    this.saving.set(true);
    this.formError.set('');
    try {
      await this.teacherService.updateProfile(this.selectedId, payload);
      this.showEditModal.set(false);
      await this.refreshSelectedProfile();
    } catch (e: any) {
      this.formError.set(this.getErrorMessage(e, 'Khong the cap nhat ho so giao vien'));
    } finally {
      this.saving.set(false);
    }
  }

  profileData(): TeacherProfile | null { return this.fullProfile()?.profile || null; }
  parseCommaList(value: string): string[] { return value.split(',').map((item) => item.trim()).filter(Boolean); }
  buildBankInfoPayload(): { bankInfo?: BankInfo; error?: string } {
    if (!this.showFinance()) {
      return {};
    }
    const bankName = this.editForm.bankName.trim();
    const accountNumber = this.editForm.accountNumber.trim();
    const accountHolderName = this.editForm.accountHolderName.trim();
    const branch = this.editForm.bankBranch.trim();
    if (!bankName && !accountNumber && !accountHolderName && !branch) {
      return {};
    }
    if (!bankName || !accountNumber || !accountHolderName) {
      return {
        error: 'Vui long nhap day du ten ngan hang, so tai khoan va chu tai khoan.',
      };
    }
    return {
      bankInfo: {
        bankName,
        accountNumber,
        accountHolderName,
        branch: branch || undefined,
      },
    };
  }
  blankForm(): TeacherEditForm {
    return {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      subjects: '',
      grades: '',
      teachingMode: 'BOTH',
      locations: '',
      bio: '',
      yearsOfExperience: 0,
      pricePerSession: 0,
      pricePerHour: null,
      bankName: '',
      accountNumber: '',
      accountHolderName: '',
      bankBranch: '',
      managedSales: [],
    };
  }

  getInitials(profile: TeacherProfile): string {
    const name = this.getUserName(profile).trim();
    if (!name) return 'GV';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }

  getUserName(profile: TeacherProfile | null): string { const user = profile?.userId; return typeof user === 'object' ? user.fullName || 'N/A' : 'N/A'; }
  getUserCode(profile: TeacherProfile | null): string { const user = profile?.userId; return typeof user === 'object' ? user.userCode || '' : ''; }
  getUserEmail(profile: TeacherProfile | null): string { const user = profile?.userId; return typeof user === 'object' ? user.email || '' : ''; }
  getProfileUserName(profile: TeacherProfile | null): string { return this.getUserName(profile); }
  getProfileUserCode(profile: TeacherProfile | null): string { return this.getUserCode(profile); }
  getProfileUserEmail(profile: TeacherProfile | null): string { return this.getUserEmail(profile); }
  getProfileUserPhone(profile: TeacherProfile | null): string { const user = profile?.userId; return typeof user === 'object' ? user.phone || '' : ''; }

  getManagedSales(profile: TeacherProfile | null): TeacherLinkedUser[] {
    if (!profile || !Array.isArray(profile.managedSales)) return [];
    return profile.managedSales.filter((item): item is TeacherLinkedUser => typeof item === 'object');
  }

  getManagerName(manager: TeacherLinkedUser | string): string { return typeof manager === 'object' ? manager.fullName || manager.email || 'Sale' : manager; }
  getManagerId(manager: TeacherLinkedUser | string): string { return typeof manager === 'object' ? manager._id : manager; }
  getStudentNames(students: Array<{ fullName?: string; studentCode?: string }> | undefined): string { return !students?.length ? 'Chua co hoc sinh' : students.map((student) => student.fullName || student.studentCode || 'Hoc sinh').join(', '); }

  statusLabel(status: string): string {
    return ({ PENDING: 'Cho duyet', APPROVED: 'Da duyet', ACTIVE: 'Dang hoat dong', SUSPENDED: 'Tam ngung', INACTIVE: 'Khong hoat dong' } as Record<string, string>)[status] || status;
  }

  teachingModeLabel(mode: string): string {
    return ({ ONLINE: 'Online', OFFLINE: 'Offline', BOTH: 'Ca hai' } as Record<string, string>)[mode] || mode;
  }

  objectEntries(obj: Record<string, any> | null | undefined): [string, any][] { return obj ? Object.entries(obj) : []; }

  private getErrorMessage(error: any, fallback: string): string {
    return this.normalizeErrorMessage(error?.error?.message)
      || this.normalizeErrorMessage(error?.message)
      || fallback;
  }

  private async refreshSelectedProfile() {
    if (!this.selectedId) {
      return;
    }
    await Promise.all([this.loadTeachers(), this.loadFullProfile(this.selectedId)]);
  }

  private normalizeErrorMessage(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => this.normalizeErrorMessage(item))
        .filter((item): item is string => !!item);
      return normalized.length ? normalized.join(', ') : null;
    }
    if (typeof value === 'object') {
      return this.normalizeErrorMessage(value.message)
        || this.normalizeErrorMessage(value.error)
        || null;
    }
    return String(value);
  }
}
