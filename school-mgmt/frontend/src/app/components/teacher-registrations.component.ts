import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {
  TeacherRegistration,
  TeacherRegistrationConvertPayload,
  TeacherRegistrationService,
  TeacherRegistrationUpdatePayload,
} from '../services/teacher-registration.service';
import { UserItem, UserService } from '../services/user.service';

interface RegistrationDetailForm {
  fullName: string;
  phone: string;
  email: string;
  subjects: string;
  grades: string;
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string;
  yearsOfExperience: number;
  bio: string;
  interviewNotes: string;
  adminNotes: string;
  status: 'NEW' | 'INTERVIEWING' | 'APPROVED' | 'CONVERTED' | 'REJECTED';
}

interface RegistrationConvertForm {
  fullName: string;
  phone: string;
  email: string;
  userCode: string;
  password: string;
  subjects: string;
  grades: string;
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string;
  yearsOfExperience: number;
  bio: string;
  pricePerSession: number;
  pricePerHour: number | null;
  managedSales: string[];
}

@Component({
  selector: 'app-teacher-registrations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="registrations-page">
    <div class="section-tabs">
      <a routerLink="/app/teacher-profiles" class="tab-link">Ho so giao vien</a>
      <a routerLink="/app/teacher-registrations" class="tab-link active">Giao vien dang ky</a>
    </div>

    <section *ngIf="!selectedId">
      <div class="header">
        <div>
          <h2>Giao vien dang ky</h2>
          <p class="subtext">
            Ung vien tu landing page se vao day. Sau phong van, co the chuyen thang thanh ho so giao vien.
          </p>
        </div>
        <div class="controls">
          <input
            class="search-input"
            [(ngModel)]="searchText"
            (input)="filterRegistrations()"
            placeholder="Tim ma don, ten, so dien thoai, email"
          />
          <select [(ngModel)]="statusFilter" (change)="filterRegistrations()">
            <option value="ALL">Tat ca</option>
            <option value="NEW">Moi dang ky</option>
            <option value="INTERVIEWING">Dang phong van</option>
            <option value="APPROVED">Dat phong van</option>
            <option value="CONVERTED">Da tao ho so</option>
            <option value="REJECTED">Tu choi</option>
          </select>
        </div>
      </div>

      <div class="summary-grid" *ngIf="!loading()">
        <article class="summary-card">
          <strong>{{ registrations.length }}</strong>
          <span>Tong ung vien</span>
        </article>
        <article class="summary-card">
          <strong>{{ countByStatus('NEW') }}</strong>
          <span>Moi dang ky</span>
        </article>
        <article class="summary-card">
          <strong>{{ countByStatus('INTERVIEWING') }}</strong>
          <span>Dang phong van</span>
        </article>
        <article class="summary-card">
          <strong>{{ countByStatus('APPROVED') }}</strong>
          <span>Dat phong van</span>
        </article>
      </div>

      <div *ngIf="loading()" class="loading">Dang tai danh sach ung vien...</div>
      <div *ngIf="error()" class="error">{{ error() }}</div>

      <div *ngIf="filteredRegistrations.length > 0" class="registration-grid">
        <article
          *ngFor="let registration of filteredRegistrations"
          class="registration-card"
          (click)="openDetail(registration._id)">
          <div class="card-header">
            <div>
              <div class="code">{{ registration.applicationCode }}</div>
              <h3>{{ registration.fullName }}</h3>
            </div>
            <span class="badge" [attr.data-status]="registration.status">
              {{ statusLabel(registration.status) }}
            </span>
          </div>

          <div class="contact-line">{{ registration.phone }}</div>
          <div class="muted">{{ registration.email || 'Chua co email' }}</div>

          <div class="chips" *ngIf="registration.subjects?.length">
            <span class="tag" *ngFor="let subject of registration.subjects">{{ subject }}</span>
          </div>
          <div class="chips" *ngIf="registration.grades?.length">
            <span class="tag gray" *ngFor="let grade of registration.grades">{{ grade }}</span>
          </div>

          <div class="meta-row">
            <span>{{ teachingModeLabel(registration.teachingMode) }}</span>
            <span>{{ registration.yearsOfExperience || 0 }} nam KN</span>
            <span>{{ registration.createdAt | date:'dd/MM/yyyy' }}</span>
          </div>
        </article>
      </div>

      <div *ngIf="filteredRegistrations.length === 0 && !loading()" class="empty">
        Chua co ung vien nao phu hop bo loc.
      </div>
    </section>

    <section *ngIf="selectedId">
      <div class="header">
        <button class="ghost-btn" (click)="closeDetail()">&larr; Quay lai</button>
        <div class="detail-title">
          <h2>Chi tiet ung vien giao vien</h2>
          <p class="subtext">Cap nhat ket qua phong van va chuyen thanh ho so giao vien khi dat.</p>
        </div>
        <div class="detail-actions" *ngIf="detail()">
          <button class="secondary-btn" *ngIf="canSetStatus('INTERVIEWING')" (click)="quickSetStatus('INTERVIEWING')">
            Dang phong van
          </button>
          <button class="secondary-btn" *ngIf="canSetStatus('APPROVED')" (click)="quickSetStatus('APPROVED')">
            Dat phong van
          </button>
          <button class="danger-btn" *ngIf="canSetStatus('REJECTED')" (click)="quickSetStatus('REJECTED')">
            Tu choi
          </button>
          <button class="primary-btn" *ngIf="canConvert()" (click)="openConvertModal()">
            Tao ho so giao vien
          </button>
        </div>
      </div>

      <div *ngIf="detailLoading()" class="loading">Dang tai ung vien...</div>
      <div *ngIf="detailError()" class="error">{{ detailError() }}</div>

      <form *ngIf="detail()" class="detail-grid" (ngSubmit)="saveDetail()">
        <section class="card">
          <h3>Thong tin dang ky</h3>
          <div class="form-grid">
            <label>Ma dang ky<input [ngModel]="detail()?.applicationCode" name="applicationCode" disabled /></label>
            <label>Trang thai
              <select [(ngModel)]="detailForm.status" name="status">
                <option value="NEW">Moi dang ky</option>
                <option value="INTERVIEWING">Dang phong van</option>
                <option value="APPROVED">Dat phong van</option>
                <option value="CONVERTED">Da tao ho so</option>
                <option value="REJECTED">Tu choi</option>
              </select>
            </label>
            <label>Ho ten<input [(ngModel)]="detailForm.fullName" name="fullName" required /></label>
            <label>So dien thoai<input [(ngModel)]="detailForm.phone" name="phone" required /></label>
            <label>Email<input [(ngModel)]="detailForm.email" name="email" type="email" /></label>
            <label>So nam kinh nghiem<input [(ngModel)]="detailForm.yearsOfExperience" name="yearsOfExperience" type="number" min="0" /></label>
            <label>Mon day<input [(ngModel)]="detailForm.subjects" name="subjects" placeholder="Toan, Van, Anh" /></label>
            <label>Khoi lop<input [(ngModel)]="detailForm.grades" name="grades" placeholder="Lop 1, Lop 2" /></label>
            <label>Hinh thuc day
              <select [(ngModel)]="detailForm.teachingMode" name="teachingMode">
                <option value="BOTH">Ca hai</option>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </label>
            <label>Khu vuc<input [(ngModel)]="detailForm.locations" name="locations" placeholder="Q1, Thu Duc" /></label>
          </div>
          <label class="full-width">Gioi thieu<textarea [(ngModel)]="detailForm.bio" name="bio" rows="5"></textarea></label>
        </section>

        <section class="card">
          <h3>Phong van va xu ly</h3>
          <div class="info-grid">
            <div>
              <label>Ngay tao</label>
              <span>{{ detail()?.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <div>
              <label>Landing page</label>
              <span>{{ detail()?.sourcePage || 'teacher-recruitment' }}</span>
            </div>
            <div>
              <label>Da phong van luc</label>
              <span>{{ detail()?.interviewedAt ? (detail()?.interviewedAt | date:'dd/MM/yyyy HH:mm') : 'Chua cap nhat' }}</span>
            </div>
            <div>
              <label>Da chot luc</label>
              <span>{{ detail()?.decidedAt ? (detail()?.decidedAt | date:'dd/MM/yyyy HH:mm') : 'Chua cap nhat' }}</span>
            </div>
            <div *ngIf="detail()?.convertedUserCode">
              <label>Ma tai khoan da tao</label>
              <span>{{ detail()?.convertedUserCode }}</span>
            </div>
          </div>

          <label class="full-width">Ghi chu phong van
            <textarea [(ngModel)]="detailForm.interviewNotes" name="interviewNotes" rows="4"></textarea>
          </label>
          <label class="full-width">Ghi chu noi bo
            <textarea [(ngModel)]="detailForm.adminNotes" name="adminNotes" rows="4"></textarea>
          </label>

          <div *ngIf="saveError()" class="error">{{ saveError() }}</div>

          <div class="form-actions">
            <button type="submit" class="primary-btn" [disabled]="saving()">
              {{ saving() ? 'Dang luu...' : 'Luu cap nhat' }}
            </button>
          </div>
        </section>
      </form>
    </section>
  </div>

  <div class="modal-backdrop" *ngIf="showConvertModal()">
    <div class="modal">
      <div class="header compact">
        <div>
          <h3>Tao ho so giao vien</h3>
          <p class="subtext">Tai khoan giao vien se duoc tao va day sang phan ho so giao vien.</p>
        </div>
        <button type="button" class="ghost-btn" (click)="closeConvertModal()">Dong</button>
      </div>

      <form (ngSubmit)="convertRegistration()" class="convert-form">
        <div class="form-grid">
          <label>Ho ten<input [(ngModel)]="convertForm.fullName" name="convertFullName" required /></label>
          <label>Email<input [(ngModel)]="convertForm.email" name="convertEmail" type="email" required /></label>
          <label>So dien thoai<input [(ngModel)]="convertForm.phone" name="convertPhone" required /></label>
          <label>Ma tai khoan<input [(ngModel)]="convertForm.userCode" name="convertUserCode" placeholder="De trong de he thong tu sinh" /></label>
          <label>Mat khau tam thoi<input [(ngModel)]="convertForm.password" name="convertPassword" required /></label>
          <label>Hinh thuc day
            <select [(ngModel)]="convertForm.teachingMode" name="convertTeachingMode">
              <option value="BOTH">Ca hai</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </label>
          <label>Mon day<input [(ngModel)]="convertForm.subjects" name="convertSubjects" /></label>
          <label>Khoi lop<input [(ngModel)]="convertForm.grades" name="convertGrades" /></label>
          <label>Khu vuc<input [(ngModel)]="convertForm.locations" name="convertLocations" /></label>
          <label>So nam kinh nghiem<input [(ngModel)]="convertForm.yearsOfExperience" name="convertYearsOfExperience" type="number" min="0" /></label>
          <label>Gia/buoi<input [(ngModel)]="convertForm.pricePerSession" name="convertPricePerSession" type="number" min="0" /></label>
          <label>Gia/gio<input [(ngModel)]="convertForm.pricePerHour" name="convertPricePerHour" type="number" min="0" /></label>
        </div>

        <label class="full-width">Gioi thieu<textarea [(ngModel)]="convertForm.bio" name="convertBio" rows="4"></textarea></label>

        <div class="sales-editor" *ngIf="salesOptions().length">
          <div class="header compact">
            <h4>Sale quan ly</h4>
            <button type="button" class="secondary-btn" (click)="addManagedSaleSlot()">+ Them sale</button>
          </div>
          <div *ngIf="!convertForm.managedSales.length" class="muted">Khong gan sale nao luc tao ho so.</div>
          <div class="sale-row" *ngFor="let saleId of convertForm.managedSales; let idx = index">
            <label>
              Sale {{ idx + 1 }}
              <select [ngModel]="saleId" (ngModelChange)="updateManagedSaleSlot(idx, $event)" [name]="'managedSale' + idx">
                <option value="">-- Chon sale --</option>
                <option *ngFor="let sale of salesOptions()" [value]="sale._id">
                  {{ sale.fullName }}{{ sale.userCode ? ' (' + sale.userCode + ')' : '' }}
                </option>
              </select>
            </label>
            <button type="button" class="danger-btn" (click)="removeManagedSaleSlot(idx)">Xoa</button>
          </div>
        </div>

        <div *ngIf="convertError()" class="error">{{ convertError() }}</div>

        <div class="form-actions">
          <button type="button" class="ghost-btn" (click)="closeConvertModal()">Huy</button>
          <button type="submit" class="primary-btn" [disabled]="converting()">
            {{ converting() ? 'Dang tao...' : 'Tao ho so giao vien' }}
          </button>
        </div>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .registrations-page { padding: 24px; max-width: 1280px; margin: 0 auto; }
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
    .detail-title { flex: 1; min-width: 220px; }
    .detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    h2, h3, h4 { margin: 0; color: #1e293b; }
    .subtext, .muted { margin: 0; color: #64748b; font-size: 13px; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    .search-input { min-width: 260px; }
    input, select, textarea { padding: 9px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; background: #fff; }
    textarea { resize: vertical; }
    .loading, .empty { text-align: center; padding: 36px; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 12px; }
    .summary-grid, .registration-grid, .detail-grid, .form-grid, .info-grid { display: grid; gap: 16px; }
    .summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 18px; }
    .summary-card, .registration-card, .card, .modal {
      background: #fff;
      border-radius: 18px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }
    .summary-card { padding: 18px; }
    .summary-card strong { display: block; font-size: 26px; color: #0f172a; }
    .summary-card span { color: #64748b; font-size: 13px; }
    .registration-grid { grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
    .registration-card { padding: 18px; cursor: pointer; transition: transform .14s ease, box-shadow .14s ease; }
    .registration-card:hover { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(15, 23, 42, 0.1); }
    .card-header { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
    .code { font-size: 12px; font-weight: 700; color: #0f766e; text-transform: uppercase; letter-spacing: .08em; }
    .contact-line { margin-top: 14px; font-weight: 700; color: #0f172a; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .tag, .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    .tag { background: #dbeafe; color: #1d4ed8; }
    .tag.gray { background: #f1f5f9; color: #334155; }
    .badge { background: #e2e8f0; color: #475569; white-space: nowrap; }
    .badge[data-status="NEW"] { background: #fef3c7; color: #a16207; }
    .badge[data-status="INTERVIEWING"] { background: #dbeafe; color: #1d4ed8; }
    .badge[data-status="APPROVED"], .badge[data-status="CONVERTED"] { background: #dcfce7; color: #166534; }
    .badge[data-status="REJECTED"] { background: #fee2e2; color: #b91c1c; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; color: #64748b; font-size: 13px; }
    .detail-grid { grid-template-columns: 1.05fr 0.95fr; }
    .card { padding: 20px; }
    .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .info-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 14px; }
    .form-grid label, .info-grid div, .full-width, .sale-row label {
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: #334155;
    }
    .info-grid label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .full-width { width: 100%; margin-top: 16px; }
    .ghost-btn, .secondary-btn, .danger-btn, .primary-btn {
      border: none;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
    }
    .ghost-btn { background: #fff; border: 1px solid #cbd5e1; color: #334155; }
    .secondary-btn { background: #e2e8f0; color: #0f172a; }
    .danger-btn { background: #fee2e2; color: #b91c1c; }
    .primary-btn { background: #0f766e; color: #fff; }
    .primary-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 60; }
    .modal { width: min(880px, 100%); max-height: calc(100vh - 40px); overflow: auto; padding: 20px; }
    .convert-form { display: flex; flex-direction: column; gap: 16px; }
    .sales-editor { border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .sale-row { display: flex; align-items: end; gap: 10px; margin-top: 10px; }
    .sale-row label { flex: 1; }
    @media (max-width: 960px) {
      .summary-grid, .detail-grid, .form-grid, .info-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .registrations-page { padding: 16px; }
      .registration-grid { grid-template-columns: 1fr; }
      .controls { width: 100%; }
      .search-input { min-width: 0; flex: 1; }
      .section-tabs { flex-wrap: wrap; }
      .sale-row { flex-direction: column; align-items: stretch; }
    }
  `],
})
export class TeacherRegistrationsComponent implements OnInit {
  registrations: TeacherRegistration[] = [];
  filteredRegistrations: TeacherRegistration[] = [];
  loading = signal(false);
  error = signal('');
  detail = signal<TeacherRegistration | null>(null);
  detailLoading = signal(false);
  detailError = signal('');
  saveError = signal('');
  showConvertModal = signal(false);
  convertError = signal('');
  saving = signal(false);
  converting = signal(false);
  salesOptions = signal<UserItem[]>([]);
  searchText = '';
  statusFilter = 'ALL';
  selectedId: string | null = null;

  detailForm: RegistrationDetailForm = this.blankDetailForm();
  convertForm: RegistrationConvertForm = this.blankConvertForm();

  constructor(
    private readonly teacherRegistrationService: TeacherRegistrationService,
    private readonly auth: AuthService,
    private readonly userService: UserService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.selectedId = id;
      if (id) {
        void this.loadDetail(id);
      } else {
        this.detail.set(null);
      }
    });
    void this.loadRegistrations();
    if (this.isDirector()) {
      void this.loadSales();
    }
  }

  isDirector(): boolean {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  countByStatus(status: TeacherRegistration['status']): number {
    return this.registrations.filter((item) => item.status === status).length;
  }

  parseCommaList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  blankDetailForm(): RegistrationDetailForm {
    return {
      fullName: '',
      phone: '',
      email: '',
      subjects: '',
      grades: '',
      teachingMode: 'BOTH',
      locations: '',
      yearsOfExperience: 0,
      bio: '',
      interviewNotes: '',
      adminNotes: '',
      status: 'NEW',
    };
  }

  blankConvertForm(): RegistrationConvertForm {
    return {
      fullName: '',
      phone: '',
      email: '',
      userCode: '',
      password: this.generatePassword(),
      subjects: '',
      grades: '',
      teachingMode: 'BOTH',
      locations: '',
      yearsOfExperience: 0,
      bio: '',
      pricePerSession: 0,
      pricePerHour: null,
      managedSales: [],
    };
  }

  private generatePassword(): string {
    return `GV${Math.random().toString(36).slice(2, 8)}!`;
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

  private getErrorMessage(error: any, fallback: string): string {
    return this.normalizeErrorMessage(error?.error?.message)
      || this.normalizeErrorMessage(error?.message)
      || fallback;
  }

  async loadRegistrations(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.registrations = await this.teacherRegistrationService.list();
      this.filterRegistrations();
    } catch (error: any) {
      this.error.set(this.getErrorMessage(error, 'Loi tai danh sach ung vien'));
    } finally {
      this.loading.set(false);
    }
  }

  async loadSales(): Promise<void> {
    try {
      const sales = await this.userService.listSales();
      this.salesOptions.set((sales || []).filter((item) => item.role === 'SALE'));
    } catch {
      this.salesOptions.set([]);
    }
  }

  filterRegistrations(): void {
    let list = [...this.registrations];
    if (this.statusFilter !== 'ALL') {
      list = list.filter((item) => item.status === this.statusFilter);
    }
    if (this.searchText.trim()) {
      const keyword = this.searchText.trim().toLowerCase();
      list = list.filter((item) => {
        const searchable = [
          item.applicationCode,
          item.fullName,
          item.phone,
          item.email,
          ...(item.subjects || []),
          ...(item.grades || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(keyword);
      });
    }
    this.filteredRegistrations = list;
  }

  async openDetail(id: string): Promise<void> {
    await this.router.navigate(['/app/teacher-registrations', id]);
  }

  async closeDetail(): Promise<void> {
    this.showConvertModal.set(false);
    await this.router.navigate(['/app/teacher-registrations']);
  }

  async loadDetail(id: string): Promise<void> {
    this.detailLoading.set(true);
    this.detailError.set('');
    try {
      const registration = await this.teacherRegistrationService.getById(id);
      this.detail.set(registration);
      this.detailForm = {
        fullName: registration.fullName || '',
        phone: registration.phone || '',
        email: registration.email || '',
        subjects: (registration.subjects || []).join(', '),
        grades: (registration.grades || []).join(', '),
        teachingMode: registration.teachingMode || 'BOTH',
        locations: (registration.locations || []).join(', '),
        yearsOfExperience: registration.yearsOfExperience || 0,
        bio: registration.bio || '',
        interviewNotes: registration.interviewNotes || '',
        adminNotes: registration.adminNotes || '',
        status: registration.status,
      };
    } catch (error: any) {
      this.detailError.set(this.getErrorMessage(error, 'Loi tai chi tiet ung vien'));
    } finally {
      this.detailLoading.set(false);
    }
  }

  async saveDetail(): Promise<void> {
    if (!this.selectedId) return;

    this.saving.set(true);
    this.saveError.set('');
    try {
      await this.teacherRegistrationService.update(
        this.selectedId,
        this.buildUpdatePayload(),
      );
      await Promise.all([
        this.loadRegistrations(),
        this.loadDetail(this.selectedId),
      ]);
    } catch (error: any) {
      this.saveError.set(this.getErrorMessage(error, 'Khong the luu cap nhat'));
    } finally {
      this.saving.set(false);
    }
  }

  buildUpdatePayload(): TeacherRegistrationUpdatePayload {
    return {
      fullName: this.detailForm.fullName.trim(),
      phone: this.detailForm.phone.trim(),
      email: this.detailForm.email.trim() || undefined,
      subjects: this.parseCommaList(this.detailForm.subjects),
      grades: this.parseCommaList(this.detailForm.grades),
      teachingMode: this.detailForm.teachingMode,
      locations: this.parseCommaList(this.detailForm.locations),
      yearsOfExperience: Number(this.detailForm.yearsOfExperience || 0),
      bio: this.detailForm.bio.trim() || undefined,
      status: this.detailForm.status,
      interviewNotes: this.detailForm.interviewNotes.trim() || undefined,
      adminNotes: this.detailForm.adminNotes.trim() || undefined,
    };
  }

  canSetStatus(status: TeacherRegistration['status']): boolean {
    const current = this.detail()?.status;
    if (!current) return false;
    if (current === 'CONVERTED') return false;
    if (current === status) return false;
    return true;
  }

  async quickSetStatus(status: TeacherRegistration['status']): Promise<void> {
    this.detailForm.status = status;
    await this.saveDetail();
  }

  canConvert(): boolean {
    const current = this.detail()?.status;
    return this.isDirector() && current !== 'CONVERTED' && current !== 'REJECTED';
  }

  openConvertModal(): void {
    const registration = this.detail();
    if (!registration) return;

    this.convertForm = {
      fullName: registration.fullName || '',
      phone: registration.phone || '',
      email: registration.email || '',
      userCode: '',
      password: this.generatePassword(),
      subjects: (registration.subjects || []).join(', '),
      grades: (registration.grades || []).join(', '),
      teachingMode: registration.teachingMode || 'BOTH',
      locations: (registration.locations || []).join(', '),
      yearsOfExperience: registration.yearsOfExperience || 0,
      bio: registration.bio || '',
      pricePerSession: 0,
      pricePerHour: null,
      managedSales: [],
    };
    this.convertError.set('');
    this.showConvertModal.set(true);
  }

  closeConvertModal(): void {
    this.showConvertModal.set(false);
    this.convertError.set('');
  }

  addManagedSaleSlot(): void {
    this.convertForm.managedSales = [...this.convertForm.managedSales, ''];
  }

  updateManagedSaleSlot(index: number, saleId: string): void {
    this.convertForm.managedSales = this.convertForm.managedSales.map((item, idx) =>
      idx === index ? saleId : item,
    );
  }

  removeManagedSaleSlot(index: number): void {
    this.convertForm.managedSales = this.convertForm.managedSales.filter((_, idx) => idx !== index);
  }

  async convertRegistration(): Promise<void> {
    if (!this.selectedId) return;

    this.converting.set(true);
    this.convertError.set('');
    try {
      const payload: TeacherRegistrationConvertPayload = {
        fullName: this.convertForm.fullName.trim(),
        phone: this.convertForm.phone.trim(),
        email: this.convertForm.email.trim(),
        userCode: this.convertForm.userCode.trim() || undefined,
        password: this.convertForm.password.trim(),
        subjects: this.parseCommaList(this.convertForm.subjects),
        grades: this.parseCommaList(this.convertForm.grades),
        teachingMode: this.convertForm.teachingMode,
        locations: this.parseCommaList(this.convertForm.locations),
        yearsOfExperience: Number(this.convertForm.yearsOfExperience || 0),
        bio: this.convertForm.bio.trim() || undefined,
        pricePerSession: Number(this.convertForm.pricePerSession || 0),
        pricePerHour: this.convertForm.pricePerHour !== null
          ? Number(this.convertForm.pricePerHour)
          : undefined,
        managedSales: Array.from(
          new Set(
            this.convertForm.managedSales
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ),
      };

      const result = await this.teacherRegistrationService.convert(this.selectedId, payload);
      this.showConvertModal.set(false);
      await this.loadRegistrations();
      await this.router.navigate(['/app/teacher-profiles', result.teacherProfileId]);
    } catch (error: any) {
      this.convertError.set(this.getErrorMessage(error, 'Khong the tao ho so giao vien'));
    } finally {
      this.converting.set(false);
    }
  }

  statusLabel(status: TeacherRegistration['status']): string {
    return ({
      NEW: 'Moi dang ky',
      INTERVIEWING: 'Dang phong van',
      APPROVED: 'Dat phong van',
      CONVERTED: 'Da tao ho so',
      REJECTED: 'Tu choi',
    } as Record<string, string>)[status] || status;
  }

  teachingModeLabel(mode: TeacherRegistration['teachingMode']): string {
    return ({
      ONLINE: 'Online',
      OFFLINE: 'Offline',
      BOTH: 'Ca hai',
    } as Record<string, string>)[mode] || mode;
  }
}
