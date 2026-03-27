import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PendingApprovalsService } from '../services/pending-approvals.service';
import { ClassItem, ClassService } from '../services/class.service';
import { AuthService } from '../services/auth.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-pending-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="pending-approvals"></app-flow-guide>
  <div class="container">
    <h2>Cho duyet</h2>
    <p class="subtitle">Tat ca hang muc dang cho duyet. Giam doc va van hanh deu co the xu ly yeu cau sua lop hoc cua Sale tai day.</p>

    <div class="summary-cards" *ngIf="data?.summary">
      <div class="card total">
        <div class="card-number">{{ data.summary.totalPending }}</div>
        <div class="card-label">Tong cho duyet</div>
      </div>
      <div class="card payroll" (click)="activeTab = 'payroll'">
        <div class="card-number">{{ data.summary.pendingPayrolls }}</div>
        <div class="card-label">Bang luong</div>
      </div>
      <div class="card invoice" (click)="activeTab = 'invoices'">
        <div class="card-number">{{ data.summary.pendingInvoices }}</div>
        <div class="card-label">Hoa don</div>
      </div>
      <div class="card topup" (click)="activeTab = 'topups'">
        <div class="card-number">{{ data.summary.pendingTopUps }}</div>
        <div class="card-label">Nap vi</div>
      </div>
      <div class="card teacher" (click)="activeTab = 'teachers'">
        <div class="card-number">{{ data.summary.pendingTeachers }}</div>
        <div class="card-label">Giao vien moi</div>
      </div>
      <div class="card class-update" (click)="activeTab = 'classes'">
        <div class="card-number">{{ data.summary.pendingClassUpdates }}</div>
        <div class="card-label">Sua lop hoc</div>
      </div>
      <div class="card ticket" (click)="activeTab = 'tickets'">
        <div class="card-number">{{ data.summary.openTickets }}</div>
        <div class="card-label">Ticket mo</div>
      </div>
    </div>

    <div class="tabs">
      <button [class.active]="activeTab === 'payroll'" (click)="activeTab = 'payroll'">
        Bang luong <span class="badge" *ngIf="data?.summary?.pendingPayrolls">{{ data.summary.pendingPayrolls }}</span>
      </button>
      <button [class.active]="activeTab === 'invoices'" (click)="activeTab = 'invoices'">
        Hoa don <span class="badge" *ngIf="data?.summary?.pendingInvoices">{{ data.summary.pendingInvoices }}</span>
      </button>
      <button [class.active]="activeTab === 'topups'" (click)="activeTab = 'topups'">
        Nap vi <span class="badge" *ngIf="data?.summary?.pendingTopUps">{{ data.summary.pendingTopUps }}</span>
      </button>
      <button [class.active]="activeTab === 'teachers'" (click)="activeTab = 'teachers'">
        Giao vien <span class="badge" *ngIf="data?.summary?.pendingTeachers">{{ data.summary.pendingTeachers }}</span>
      </button>
      <button [class.active]="activeTab === 'classes'" (click)="activeTab = 'classes'">
        Sua lop <span class="badge" *ngIf="data?.summary?.pendingClassUpdates">{{ data.summary.pendingClassUpdates }}</span>
      </button>
    </div>

    <div *ngIf="activeTab === 'payroll'" class="tab-content">
      <div *ngIf="!data?.payrolls?.length" class="empty">Khong co bang luong cho duyet</div>
      <table *ngIf="data?.payrolls?.length" class="data-table">
        <thead>
          <tr>
            <th>Ma luong</th>
            <th>Giao vien</th>
            <th>Ky thanh toan</th>
            <th>So buoi</th>
            <th>Thuc linh</th>
            <th>Ngay tao</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of data.payrolls">
            <td><strong>{{ p.payrollCode }}</strong></td>
            <td>{{ p.teacherId?.fullName || 'N/A' }}</td>
            <td>{{ formatDate(p.periodStart) }} - {{ formatDate(p.periodEnd) }}</td>
            <td>{{ p.totalSessions }}</td>
            <td class="amount">{{ formatMoney(p.netAmount) }}</td>
            <td>{{ formatDate(p.createdAt) }}</td>
            <td><a routerLink="/app/payroll" class="btn-link">Xem</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="activeTab === 'invoices'" class="tab-content">
      <div *ngIf="!data?.invoices?.length" class="empty">Khong co hoa don cho duyet</div>
      <table *ngIf="data?.invoices?.length" class="data-table">
        <thead>
          <tr>
            <th>So hoa don</th>
            <th>Hoc sinh</th>
            <th>So tien</th>
            <th>Nguoi tao</th>
            <th>Ngay tao</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let inv of data.invoices">
            <td><strong>{{ inv.invoiceNumber }}</strong></td>
            <td>{{ inv.studentId?.fullName || 'N/A' }}</td>
            <td class="amount">{{ formatMoney(inv.totalAmount || inv.amount) }}</td>
            <td>{{ inv.createdBy?.fullName || 'N/A' }}</td>
            <td>{{ formatDate(inv.createdAt) }}</td>
            <td><a routerLink="/app/invoices" class="btn-link">Xem</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="activeTab === 'topups'" class="tab-content">
      <div *ngIf="!data?.topUps?.length" class="empty">Khong co yeu cau nap vi cho duyet</div>
      <table *ngIf="data?.topUps?.length" class="data-table">
        <thead>
          <tr>
            <th>Nguoi dung</th>
            <th>Email</th>
            <th>So tien</th>
            <th>PT thanh toan</th>
            <th>Ngay yeu cau</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of data.topUps">
            <td>{{ t.userId?.fullName || 'N/A' }}</td>
            <td>{{ t.userId?.email || '' }}</td>
            <td class="amount">{{ formatMoney(t.amount) }}</td>
            <td>{{ t.paymentMethod || '' }}</td>
            <td>{{ formatDate(t.createdAt) }}</td>
            <td><a routerLink="/app/wallets" class="btn-link">Xem</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="activeTab === 'teachers'" class="tab-content">
      <div *ngIf="!data?.teachers?.length" class="empty">Khong co giao vien cho duyet</div>
      <table *ngIf="data?.teachers?.length" class="data-table">
        <thead>
          <tr>
            <th>Ho ten</th>
            <th>Email</th>
            <th>SDT</th>
            <th>Ngay dang ky</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of data.teachers">
            <td>{{ t.userId?.fullName || t.fullName || 'N/A' }}</td>
            <td>{{ t.userId?.email || '' }}</td>
            <td>{{ t.userId?.phone || t.phone || '' }}</td>
            <td>{{ formatDate(t.createdAt) }}</td>
            <td><a [routerLink]="['/app/teacher-profiles', t._id]" class="btn-link">Xem</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="activeTab === 'classes'" class="tab-content">
      <div *ngIf="!data?.classes?.length" class="empty">Khong co yeu cau sua lop cho duyet</div>
      <table *ngIf="data?.classes?.length" class="data-table">
        <thead>
          <tr>
            <th>Lop</th>
            <th>Sale</th>
            <th>Nguoi gui</th>
            <th>Thoi diem</th>
            <th>Noi dung de nghi</th>
            <th>Thao tac</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let classItem of data.classes">
            <td>
              <strong>{{ classItem.code }}</strong>
              <div>{{ classItem.name }}</div>
            </td>
            <td>{{ classItem.sale?.fullName || 'N/A' }}</td>
            <td>{{ classItem.pendingSaleUpdate?.requestedBy?.fullName || classItem.sale?.fullName || 'N/A' }}</td>
            <td>{{ formatDate(classItem.pendingSaleUpdate?.requestedAt) }}</td>
            <td>
              <span class="change-chip" *ngFor="let change of getRequestedChanges(classItem)">
                {{ change }}
              </span>
            </td>
            <td class="action-buttons">
              <ng-container *ngIf="canReviewClassUpdate(classItem); else directorOnlyReview">
                <button type="button" class="btn-approve" (click)="approveClassUpdate(classItem)">Phe duyet</button>
                <button type="button" class="btn-reject" (click)="rejectClassUpdate(classItem)">Tu choi</button>
              </ng-container>
              <ng-template #directorOnlyReview>
                <span class="review-note">{{ getReviewNotice(classItem) }}</span>
              </ng-template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="loading" class="loading">Dang tai...</div>
    <div *ngIf="error" class="error">{{ error }}</div>
  </div>
  `,
  styles: [`
    .container { padding: 24px; max-width: 1200px; margin: 0 auto; }
    h2 { margin:0 0 4px; color:#1e293b; font-size:22px; }
    .subtitle { color:#64748b; margin:0 0 20px; font-size:14px; }
    .summary-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:24px; }
    .card {
      background:#fff; border-radius:10px; padding:16px; text-align:center;
      box-shadow:0 1px 3px rgba(0,0,0,.08); cursor:pointer; transition:transform .15s, box-shadow .15s;
      border-left:4px solid #94a3b8;
    }
    .card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.12); }
    .card.total { border-left-color:#dc2626; }
    .card.payroll { border-left-color:#2563eb; }
    .card.invoice { border-left-color:#16a34a; }
    .card.topup { border-left-color:#eab308; }
    .card.teacher { border-left-color:#7c3aed; }
    .card.class-update { border-left-color:#0f766e; }
    .card.ticket { border-left-color:#f97316; }
    .card-number { font-size:28px; font-weight:700; color:#1e293b; }
    .card-label { font-size:12px; color:#64748b; margin-top:4px; }
    .tabs { display:flex; gap:4px; border-bottom:2px solid #e2e8f0; margin-bottom:16px; flex-wrap:wrap; }
    .tabs button {
      padding:10px 18px; border:none; background:none; cursor:pointer; font-size:13px;
      font-weight:500; color:#64748b; border-bottom:2px solid transparent; margin-bottom:-2px;
      transition:color .15s, border-color .15s;
    }
    .tabs button.active { color:#2563eb; border-bottom-color:#2563eb; }
    .tabs button:hover { color:#1e293b; }
    .badge {
      display:inline-block; background:#dc2626; color:#fff; border-radius:999px;
      font-size:11px; padding:1px 7px; margin-left:6px; font-weight:600;
    }
    .tab-content { background:#fff; border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,.06); }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:10px 12px; background:#f8fafc; color:#64748b; font-weight:600; border-bottom:1px solid #e2e8f0; }
    .data-table td { padding:10px 12px; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .data-table tbody tr:hover { background:#f8fafc; }
    .amount { font-weight:600; color:#1e293b; }
    .btn-link { color:#2563eb; text-decoration:none; font-weight:500; font-size:13px; }
    .btn-link:hover { text-decoration:underline; }
    .action-buttons { white-space:nowrap; }
    .btn-approve, .btn-reject {
      border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;
      padding:6px 10px; margin-right:8px;
    }
    .btn-approve { background:#16a34a; color:#fff; }
    .btn-reject { background:#dc2626; color:#fff; }
    .change-chip {
      display:inline-block; margin:0 6px 6px 0; padding:4px 8px; border-radius:999px;
      background:#e2e8f0; color:#334155; font-size:12px;
    }
    .review-note { color:#64748b; font-size:12px; }
    .empty { text-align:center; padding:32px; color:#94a3b8; font-size:14px; }
    .loading { text-align:center; padding:24px; color:#64748b; }
    .error { text-align:center; padding:16px; color:#dc2626; background:#fef2f2; border-radius:8px; margin-top:12px; }
  `]
})
export class PendingApprovalsComponent implements OnInit {
  private svc = inject(PendingApprovalsService);
  private classService = inject(ClassService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  data: any = null;
  loading = false;
  error = '';
  activeTab = 'payroll';

  async ngOnInit() {
    const requestedTab = this.route.snapshot.queryParamMap.get('tab') || '';
    if (this.isKnownTab(requestedTab)) {
      this.activeTab = requestedTab;
    }
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    this.error = '';
    try {
      this.data = await this.svc.getAll();
    } catch (err: any) {
      this.error = err?.error?.message || 'Khong the tai du lieu';
    } finally {
      this.loading = false;
    }
  }

  formatDate(d?: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('vi-VN');
  }

  formatMoney(n: number): string {
    if (n == null) return '0';
    return n.toLocaleString('vi-VN') + 'd';
  }

  getRequestedChanges(classItem: ClassItem): string[] {
    const requestedChanges = classItem.pendingSaleUpdate?.requestedChanges || {};
    const labels: Record<string, string> = {
      name: 'Ten lop',
      code: 'Ma lop',
      teacherId: 'Giao vien',
      productPackageId: 'Goi san pham',
      classMode: 'Loai lop',
      pricePerSession: 'Gia theo buoi',
      teacherPayPerSession: 'Luong GV/buoi',
      teacherPayPerStudent: 'Luong GV/HS',
      baseDuration: 'Thoi luong co so',
      sessionDuration: 'Thoi luong buoi hoc',
      subject: 'Mon hoc',
      grade: 'Khoi lop',
      learningGoals: 'Muc tieu hoc',
    };

    const resolved = Object.keys(requestedChanges).map((key) => labels[key] || key);
    if (classItem.pendingSaleUpdate?.requestType === 'DURATION_CHANGE') {
      return ['Thay doi thoi luong', ...resolved];
    }
    return resolved.length ? resolved : ['Cap nhat lop hoc'];
  }

  isDirector(): boolean {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  isOps(): boolean {
    return this.auth.userSignal()?.role === 'OPS';
  }

  canReviewClassUpdate(classItem: ClassItem): boolean {
    return !!classItem.pendingSaleUpdate && (this.isDirector() || this.isOps());
  }

  getReviewNotice(classItem: ClassItem): string {
    if (classItem.pendingSaleUpdate?.status !== 'PENDING') {
      return 'Khong con yeu cau cho duyet';
    }
    return 'Khong the thao tac';
  }

  private isKnownTab(tab: string): boolean {
    return ['payroll', 'invoices', 'topups', 'teachers', 'classes'].includes(tab);
  }

  async approveClassUpdate(classItem: ClassItem) {
    this.error = '';
    const result = await this.classService.approvePendingUpdate(classItem._id);
    if (!result.ok) {
      this.error = result.message || 'Khong the phe duyet yeu cau sua lop';
      return;
    }

    await this.loadData();
  }

  async rejectClassUpdate(classItem: ClassItem) {
    this.error = '';
    const reason = prompt('Ly do tu choi (co the bo trong):') || '';
    const result = await this.classService.rejectPendingUpdate(classItem._id, reason);
    if (!result.ok) {
      this.error = result.message || 'Khong the tu choi yeu cau sua lop';
      return;
    }

    await this.loadData();
  }
}
