import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffPayrollService } from '../services/staff-payroll.service';
import { AuthService } from '../services/auth.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  PAID: 'Đã thanh toán',
  REJECTED: 'Từ chối',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  PENDING_REVIEW: '#f59e0b',
  APPROVED: '#3b82f6',
  PAID: '#10b981',
  REJECTED: '#ef4444',
};

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Giám đốc',
  ACCOUNTING: 'Kế toán',
  OPS: 'Vận hành',
  ADSMANAGER: 'Ads manager',
  TEACHER: 'Giáo viên',
  SALES: 'Kinh doanh',
  STAFF: 'Nhân viên',
};

@Component({
  selector: 'app-staff-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Bảng lương nhân viên</h2>
      <p>Quản lý và theo dõi bảng lương nhân viên.</p>
    </div>
    <div class="header-actions" *ngIf="isAdmin()">
      <button class="primary" (click)="openGenerateModal()">+ Tạo bảng lương</button>
      <button class="secondary" (click)="openBulkModal()">Tạo hàng loạt</button>
    </div>
  </header>

  <app-flow-guide featureKey="staff-payroll"></app-flow-guide>

  <!-- Admin view -->
  <ng-container *ngIf="isAdmin(); else myView">

    <!-- Filters -->
    <section class="filters">
      <select [(ngModel)]="filterStatus" (ngModelChange)="reload()">
        <option value="">Tất cả trạng thái</option>
        <option *ngFor="let s of allStatuses" [value]="s.value">{{s.label}}</option>
      </select>
      <input type="date" [(ngModel)]="startDate" (ngModelChange)="reload()" placeholder="Từ ngày" />
      <input type="date" [(ngModel)]="endDate" (ngModelChange)="reload()" placeholder="Đến ngày" />
      <span class="page-info">Trang {{page}} / {{totalPages()}} ({{total()}} bản ghi)</span>
      <button [disabled]="page <= 1" (click)="prevPage()">◀</button>
      <button [disabled]="page >= totalPages()" (click)="nextPage()">▶</button>
      <button class="ghost" (click)="resetFilters()">Làm mới</button>
    </section>

    <!-- Table -->
    <table class="data" *ngIf="items().length; else empty">
      <thead><tr>
        <th>Mã</th>
        <th>Nhân viên</th>
        <th>Vai trò</th>
        <th>Kỳ lương</th>
        <th class="right">Lương cứng</th>
        <th class="right">Hoa hồng</th>
        <th class="right">KPI</th>
        <th class="right">Phạt muộn</th>
        <th class="right">Thực nhận</th>
        <th>Trạng thái</th>
        <th>Thao tác</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let p of items()" (click)="openDetail(p)" class="clickable">
          <td><code>{{p.payrollCode}}</code></td>
          <td>{{p.userName}}</td>
          <td>{{roleLabel(p.role)}}</td>
          <td class="period-cell">
            {{p.periodStart | date:'dd/MM/yyyy'}} – {{p.periodEnd | date:'dd/MM/yyyy'}}
          </td>
          <td class="right" [title]="'Tỉ lệ chuyên cần: ' + ((p.attendanceRatio || 0) * 100 | number:'1.0-1') + '%'">
            {{p.baseSalaryAmount | number}}đ
          </td>
          <td class="right">{{p.commissionAmount | number}}đ</td>
          <td class="right">{{p.kpiBonusAmount | number}}đ</td>
          <td class="right red">{{p.latePenaltyAmount | number}}đ</td>
          <td class="right bold">{{p.netAmount | number}}đ</td>
          <td>
            <span class="badge"
              [style.background]="statusColor(p.status) + '20'"
              [style.color]="statusColor(p.status)">
              {{statusLabel(p.status)}}
            </span>
          </td>
          <td class="actions-cell" (click)="$event.stopPropagation()">
            <ng-container [ngSwitch]="p.status">
              <ng-container *ngSwitchCase="'DRAFT'">
                <button class="btn-sm" (click)="openEdit(p)">Sửa</button>
                <button class="btn-sm primary" (click)="submitPayroll(p)">Nộp</button>
                <button class="btn-sm danger" (click)="deletePayroll(p)">Xóa</button>
              </ng-container>
              <ng-container *ngSwitchCase="'PENDING_REVIEW'">
                <ng-container *ngIf="isDirector()">
                  <button class="btn-sm success" (click)="approvePayroll(p)">Duyệt</button>
                  <button class="btn-sm danger" (click)="rejectPayroll(p)">Từ chối</button>
                </ng-container>
              </ng-container>
              <ng-container *ngSwitchCase="'APPROVED'">
                <button class="btn-sm primary" (click)="openMarkPaid(p)">Đã trả</button>
              </ng-container>
              <ng-container *ngSwitchCase="'REJECTED'">
                <button class="btn-sm ghost" (click)="reopenPayroll(p)">Mở lại</button>
              </ng-container>
            </ng-container>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #empty><p class="empty-text">Không có bảng lương nào.</p></ng-template>
  </ng-container>

  <!-- My payroll view (non-admin) -->
  <ng-template #myView>
    <section class="filters">
      <input type="date" [(ngModel)]="startDate" (ngModelChange)="reloadMy()" />
      <input type="date" [(ngModel)]="endDate" (ngModelChange)="reloadMy()" />
      <span class="page-info">Trang {{page}} / {{totalPages()}} ({{total()}} bản ghi)</span>
      <button [disabled]="page <= 1" (click)="prevPage()">◀</button>
      <button [disabled]="page >= totalPages()" (click)="nextPage()">▶</button>
    </section>
    <table class="data" *ngIf="items().length; else emptyMy">
      <thead><tr>
        <th>Mã</th>
        <th>Kỳ lương</th>
        <th class="right">Lương cứng</th>
        <th class="right">Hoa hồng</th>
        <th class="right">KPI</th>
        <th class="right">Phạt muộn</th>
        <th class="right">Thực nhận</th>
        <th>Trạng thái</th>
      </tr></thead>
      <tbody>
        <tr *ngFor="let p of items()" (click)="openDetail(p)" class="clickable">
          <td><code>{{p.payrollCode}}</code></td>
          <td class="period-cell">{{p.periodStart | date:'dd/MM/yyyy'}} – {{p.periodEnd | date:'dd/MM/yyyy'}}</td>
          <td class="right">{{p.baseSalaryAmount | number}}đ</td>
          <td class="right">{{p.commissionAmount | number}}đ</td>
          <td class="right">{{p.kpiBonusAmount | number}}đ</td>
          <td class="right red">{{p.latePenaltyAmount | number}}đ</td>
          <td class="right bold">{{p.netAmount | number}}đ</td>
          <td>
            <span class="badge"
              [style.background]="statusColor(p.status) + '20'"
              [style.color]="statusColor(p.status)">
              {{statusLabel(p.status)}}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyMy><p class="empty-text">Bạn chưa có bảng lương nào.</p></ng-template>
  </ng-template>

  <!-- ===== DETAIL MODAL ===== -->
  <div class="modal-backdrop" *ngIf="detail()">
    <div class="modal wide" (click)="$event.stopPropagation()">
      <div class="detail-header">
        <div>
          <h3>{{detail()!.payrollCode}}</h3>
          <div class="meta-line">{{detail()!.userName}} · {{roleLabel(detail()!.role)}} · {{detail()!.periodStart | date:'dd/MM/yyyy'}} – {{detail()!.periodEnd | date:'dd/MM/yyyy'}}</div>
        </div>
        <span class="badge lg"
          [style.background]="statusColor(detail()!.status) + '20'"
          [style.color]="statusColor(detail()!.status)">
          {{statusLabel(detail()!.status)}}
        </span>
      </div>

      <!-- Breakdown sections -->
      <div class="breakdown">

        <!-- Base salary -->
        <div class="breakdown-section">
          <div class="section-title">Lương cứng</div>
          <div class="breakdown-row">
            <span>Lương cơ bản</span>
            <span>{{detail()!.baseSalary | number}}đ</span>
          </div>
          <div class="breakdown-row sub">
            <span>× Tỉ lệ chuyên cần</span>
            <span>{{(detail()!.attendanceRatio || 0) * 100 | number:'1.0-1'}}%
              ({{detail()!.actualHours || 0}}h / {{detail()!.standardHours || 0}}h)
            </span>
          </div>
          <div class="breakdown-row total-row">
            <span>= Lương cứng thực tế</span>
            <span>{{detail()!.baseSalaryAmount | number}}đ</span>
          </div>
        </div>

        <!-- Commission -->
        <div class="breakdown-section">
          <div class="section-title">Hoa hồng</div>
          <div class="breakdown-row">
            <span>Doanh thu đạt được</span>
            <span>{{detail()!.totalRevenue | number}}đ</span>
          </div>
          <div class="breakdown-row sub" *ngIf="detail()!.commissionType">
            <span>Loại hoa hồng</span>
            <span>{{detail()!.commissionType}}</span>
          </div>
          <ng-container *ngIf="detail()!.commissionTiers?.length">
            <div class="breakdown-row sub" *ngFor="let tier of detail()!.commissionTiers">
              <span>Bậc: {{tier.from | number}}đ – {{tier.to ? (tier.to | number) + 'đ' : '∞'}}</span>
              <span>{{tier.rate}}%</span>
            </div>
          </ng-container>
          <div class="breakdown-row total-row">
            <span>= Hoa hồng</span>
            <span>{{detail()!.commissionAmount | number}}đ</span>
          </div>
        </div>

        <!-- KPI -->
        <div class="breakdown-section">
          <div class="section-title">Thưởng KPI</div>
          <div class="breakdown-row">
            <span>Điểm KPI</span>
            <span>{{detail()!.kpiScore | number:'1.0-1'}}</span>
          </div>
          <ng-container *ngIf="detail()!.kpiBonusTiers?.length">
            <div class="breakdown-row sub" *ngFor="let tier of detail()!.kpiBonusTiers">
              <span>Bậc: {{tier.minScore}} – {{tier.maxScore ?? '∞'}}</span>
              <span>{{tier.bonusPercentage}}%</span>
            </div>
          </ng-container>
          <div class="breakdown-row sub" *ngIf="detail()!.kpiBonusPercentage">
            <span>Tỉ lệ thưởng áp dụng</span>
            <span>{{detail()!.kpiBonusPercentage}}%</span>
          </div>
          <div class="breakdown-row total-row">
            <span>= Thưởng KPI</span>
            <span>{{detail()!.kpiBonusAmount | number}}đ</span>
          </div>
        </div>

        <!-- Late penalty -->
        <div class="breakdown-section">
          <div class="section-title red">Phạt muộn</div>
          <div class="breakdown-row">
            <span>Số ngày đi muộn</span>
            <span>{{detail()!.lateDays || 0}} ngày</span>
          </div>
          <div class="breakdown-row sub">
            <span>× Tiền phạt mỗi lần</span>
            <span>{{detail()!.latePenaltyPerTime | number}}đ</span>
          </div>
          <div class="breakdown-row total-row red">
            <span>= Tổng phạt muộn</span>
            <span>{{detail()!.latePenaltyAmount | number}}đ</span>
          </div>
        </div>

        <!-- Adjustments -->
        <div class="breakdown-section">
          <div class="section-title">Điều chỉnh</div>
          <div class="breakdown-row green">
            <span>Thưởng thêm</span>
            <span>+{{detail()!.bonusAmount | number}}đ</span>
          </div>
          <div class="breakdown-row red">
            <span>Trừ thêm</span>
            <span>-{{detail()!.deductionAmount | number}}đ</span>
          </div>
          <div *ngIf="detail()!.notes" class="breakdown-row sub">
            <span>Ghi chú</span>
            <span class="note-text">{{detail()!.notes}}</span>
          </div>
        </div>

        <!-- Net total -->
        <div class="net-total">
          <span>TỔNG THỰC NHẬN</span>
          <span class="net-amount">{{detail()!.netAmount | number}}đ</span>
        </div>
      </div>

      <!-- Rejection reason -->
      <div class="rejection-block" *ngIf="detail()!.status === 'REJECTED' && detail()!.rejectionReason">
        <strong>Lý do từ chối:</strong> {{detail()!.rejectionReason}}
      </div>

      <!-- Payment info -->
      <div class="info-block" *ngIf="detail()!.status === 'PAID' && detail()!.paymentRef">
        <strong>Mã tham chiếu thanh toán:</strong> {{detail()!.paymentRef}}
      </div>

      <div class="form-actions" style="margin-top:16px">
        <ng-container *ngIf="isAdmin()" [ngSwitch]="detail()!.status">
          <ng-container *ngSwitchCase="'DRAFT'">
            <button class="primary" (click)="openEditFromDetail()">Sửa</button>
            <button class="secondary" (click)="submitPayroll(detail()!)">Nộp duyệt</button>
            <button class="danger" (click)="deletePayroll(detail()!)">Xóa</button>
          </ng-container>
          <ng-container *ngSwitchCase="'PENDING_REVIEW'">
            <ng-container *ngIf="isDirector()">
              <button class="success" (click)="approvePayroll(detail()!)">Duyệt</button>
              <button class="danger" (click)="rejectPayroll(detail()!)">Từ chối</button>
            </ng-container>
          </ng-container>
          <ng-container *ngSwitchCase="'APPROVED'">
            <button class="primary" (click)="openMarkPaid(detail()!)">Đánh dấu đã trả</button>
          </ng-container>
          <ng-container *ngSwitchCase="'REJECTED'">
            <button class="ghost" (click)="reopenPayroll(detail()!)">Mở lại (Nháp)</button>
          </ng-container>
        </ng-container>
        <button (click)="detail.set(null)">Đóng</button>
      </div>
    </div>
  </div>

  <!-- ===== EDIT MODAL (bonus/deduction/notes for DRAFT) ===== -->
  <div class="modal-backdrop" *ngIf="showEditModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>Điều chỉnh bảng lương</h3>
      <label>Thưởng thêm (đ)
        <input type="number" [(ngModel)]="editForm.bonusAmount" min="0" />
      </label>
      <label>Trừ thêm (đ)
        <input type="number" [(ngModel)]="editForm.deductionAmount" min="0" />
      </label>
      <label>Ghi chú
        <textarea [(ngModel)]="editForm.notes" rows="3"></textarea>
      </label>
      <p class="error" *ngIf="error()">{{error()}}</p>
      <div class="form-actions">
        <button class="primary" (click)="submitEdit()">Lưu</button>
        <button (click)="showEditModal.set(false)">Hủy</button>
      </div>
    </div>
  </div>

  <!-- ===== GENERATE MODAL (single) ===== -->
  <div class="modal-backdrop" *ngIf="showGenerateModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>Tạo bảng lương</h3>
      <label>Mã nhân viên (userId) <span class="req">*</span>
        <input [(ngModel)]="genForm.userId" placeholder="ID nhân viên" />
      </label>
      <div class="form-grid">
        <label>Từ ngày <span class="req">*</span>
          <input type="date" [(ngModel)]="genForm.periodStart" />
        </label>
        <label>Đến ngày <span class="req">*</span>
          <input type="date" [(ngModel)]="genForm.periodEnd" />
        </label>
        <label>Thưởng thêm (đ)
          <input type="number" [(ngModel)]="genForm.bonusAmount" min="0" />
        </label>
        <label>Trừ thêm (đ)
          <input type="number" [(ngModel)]="genForm.deductionAmount" min="0" />
        </label>
      </div>
      <label>Ghi chú
        <textarea [(ngModel)]="genForm.notes" rows="2"></textarea>
      </label>
      <p class="error" *ngIf="error()">{{error()}}</p>
      <div class="form-actions">
        <button class="primary" (click)="submitGenerate()">Tạo</button>
        <button (click)="showGenerateModal.set(false)">Hủy</button>
      </div>
    </div>
  </div>

  <!-- ===== BULK MODAL ===== -->
  <div class="modal-backdrop" *ngIf="showBulkModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>Tạo bảng lương hàng loạt</h3>
      <div class="form-grid">
        <label>Từ ngày <span class="req">*</span>
          <input type="date" [(ngModel)]="bulkForm.periodStart" />
        </label>
        <label>Đến ngày <span class="req">*</span>
          <input type="date" [(ngModel)]="bulkForm.periodEnd" />
        </label>
      </div>
      <p class="hint">Hệ thống sẽ tự động tạo bảng lương cho tất cả nhân viên trong kỳ đã chọn.</p>
      <p class="error" *ngIf="error()">{{error()}}</p>

      <!-- Bulk result -->
      <div class="bulk-result" *ngIf="bulkResult()">
        <div class="result-row green"><span>Đã tạo:</span> <strong>{{bulkResult()!.created}}</strong></div>
        <div class="result-row amber"><span>Bỏ qua:</span> <strong>{{bulkResult()!.skipped}}</strong></div>
        <div class="result-row red" *ngIf="bulkResult()!.errors?.length">
          <span>Lỗi:</span>
          <ul>
            <li *ngFor="let e of bulkResult()!.errors">{{e}}</li>
          </ul>
        </div>
      </div>

      <div class="form-actions">
        <button class="primary" (click)="submitBulk()" *ngIf="!bulkResult()">Tạo hàng loạt</button>
        <button (click)="closeBulkModal()">{{bulkResult() ? 'Đóng' : 'Hủy'}}</button>
      </div>
    </div>
  </div>

  <!-- ===== MARK PAID MODAL ===== -->
  <div class="modal-backdrop" *ngIf="showMarkPaidModal()">
    <div class="modal" (click)="$event.stopPropagation()">
      <h3>Đánh dấu đã thanh toán</h3>
      <div class="pay-info" *ngIf="payingItem()">
        <strong>{{payingItem()!.userName}}</strong> — {{payingItem()!.payrollCode}}
        <div class="amount-large">{{payingItem()!.netAmount | number}}đ</div>
      </div>
      <label>Mã tham chiếu thanh toán
        <input [(ngModel)]="paymentRef" placeholder="Số chứng từ, mã giao dịch..." />
      </label>
      <p class="error" *ngIf="error()">{{error()}}</p>
      <div class="form-actions">
        <button class="primary" (click)="submitMarkPaid()">Xác nhận</button>
        <button (click)="showMarkPaidModal.set(false)">Hủy</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; padding:16px; }
    .header-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; align-items:center; }
    .page-info { font-size:13px; color:#64748b; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .right { text-align:right; }
    .clickable { cursor:pointer; }
    .clickable:hover { background:#f8fafc; }
    .period-cell { white-space:nowrap; font-size:12px; }
    .bold { font-weight:700; }
    .red { color:#ef4444; }
    .green { color:#10b981; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .badge.lg { font-size:13px; padding:4px 12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .secondary { background:#64748b; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .success { background:#10b981; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .danger { background:#ef4444; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .ghost { background:#fff; border:1px solid #cbd5e1; color:#334155; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .btn-sm { padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:2px; }
    .btn-sm.primary { color:#2563eb; border-color:#93c5fd; background:#eff6ff; }
    .btn-sm.success { color:#059669; border-color:#6ee7b7; background:#ecfdf5; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; background:#fef2f2; }
    .btn-sm.ghost { color:#334155; border-color:#cbd5e1; }
    .actions-cell { white-space:nowrap; }
    .empty-text { padding:16px; color:#64748b; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:560px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal.wide { max-width:720px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:8px 0; }
    label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; margin-bottom:8px; }
    .req { color:#dc2626; }
    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
    .error { color:#dc2626; font-size:13px; margin:6px 0 0; }
    .hint { font-size:13px; color:#64748b; margin:4px 0 12px; }
    /* Detail modal */
    .detail-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; gap:12px; }
    .detail-header h3 { margin:0 0 4px; }
    .meta-line { font-size:13px; color:#64748b; }
    .breakdown { display:flex; flex-direction:column; gap:12px; }
    .breakdown-section { background:#f8fafc; border-radius:6px; padding:12px 14px; }
    .section-title { font-weight:700; font-size:13px; color:#334155; margin-bottom:8px; text-transform:uppercase; letter-spacing:.5px; }
    .section-title.red { color:#ef4444; }
    .breakdown-row { display:flex; justify-content:space-between; font-size:13px; padding:3px 0; }
    .breakdown-row.sub { color:#64748b; font-size:12px; padding-left:12px; }
    .breakdown-row.total-row { font-weight:600; border-top:1px solid #e2e8f0; margin-top:4px; padding-top:6px; }
    .breakdown-row.total-row.red { color:#ef4444; }
    .breakdown-row.green { color:#10b981; }
    .breakdown-row.red { color:#ef4444; }
    .note-text { font-style:italic; color:#64748b; }
    .net-total { display:flex; justify-content:space-between; align-items:center; background:#ecfdf5; border:2px solid #10b981; border-radius:8px; padding:14px 18px; margin-top:4px; }
    .net-total > span:first-child { font-weight:700; font-size:14px; color:#065f46; letter-spacing:.5px; }
    .net-amount { font-size:26px; font-weight:900; color:#10b981; }
    .rejection-block { background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; padding:10px 12px; margin-top:10px; color:#dc2626; font-size:13px; }
    .info-block { background:#eff6ff; border:1px solid #93c5fd; border-radius:6px; padding:10px 12px; margin-top:10px; color:#1d4ed8; font-size:13px; }
    /* Bulk result */
    .bulk-result { background:#f8fafc; border-radius:6px; padding:12px 14px; margin:12px 0; }
    .result-row { display:flex; gap:8px; align-items:flex-start; font-size:13px; margin-bottom:4px; }
    .result-row.green { color:#10b981; }
    .result-row.amber { color:#f59e0b; }
    .result-row.red { color:#ef4444; }
    .result-row ul { margin:0; padding-left:18px; }
    /* Mark paid */
    .pay-info { background:#ecfdf5; padding:12px; border-radius:6px; margin-bottom:12px; text-align:center; }
    .amount-large { font-size:28px; font-weight:700; color:#10b981; margin-top:4px; }
  `]
})
export class StaffPayrollComponent implements OnInit {
  items = signal<any[]>([]);
  detail = signal<any | null>(null);
  error = signal('');
  total = signal(0);
  page = 1;
  limit = 20;

  filterStatus = '';
  startDate = '';
  endDate = '';

  showEditModal = signal(false);
  showGenerateModal = signal(false);
  showBulkModal = signal(false);
  showMarkPaidModal = signal(false);
  bulkResult = signal<any | null>(null);
  payingItem = signal<any | null>(null);

  editingId: string | null = null;
  editForm = { bonusAmount: 0, deductionAmount: 0, notes: '' };
  genForm = { userId: '', periodStart: '', periodEnd: '', bonusAmount: 0, deductionAmount: 0, notes: '' };
  bulkForm = { periodStart: '', periodEnd: '' };
  paymentRef = '';

  allStatuses = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.limit)));

  constructor(
    private payrollService: StaffPayrollService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    if (this.isAdmin()) {
      this.reload();
    } else {
      this.reloadMy();
    }
  }

  isAdmin(): boolean {
    return this.auth.hasRole(['DIRECTOR', 'ACCOUNTING', 'OPS']);
  }

  isDirector(): boolean {
    return this.auth.hasRole(['DIRECTOR']);
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#6b7280'; }
  roleLabel(r: string) { return ROLE_LABELS[r] || r; }

  async reload() {
    const params: any = { page: this.page, limit: this.limit };
    if (this.filterStatus) params.status = this.filterStatus;
    if (this.startDate) params.periodStart = this.startDate;
    if (this.endDate) params.periodEnd = this.endDate;
    const res = await this.payrollService.list(params);
    this.items.set(res.data || []);
    this.total.set(res.total || 0);
  }

  async reloadMy() {
    const params: any = { page: this.page, limit: this.limit };
    if (this.startDate) params.periodStart = this.startDate;
    if (this.endDate) params.periodEnd = this.endDate;
    const res = await this.payrollService.getMy(params);
    this.items.set(res.data || []);
    this.total.set(res.total || 0);
  }

  resetFilters() {
    this.filterStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.page = 1;
    this.reload();
  }

  prevPage() {
    if (this.page > 1) { this.page--; this.isAdmin() ? this.reload() : this.reloadMy(); }
  }

  nextPage() {
    if (this.page < this.totalPages()) { this.page++; this.isAdmin() ? this.reload() : this.reloadMy(); }
  }

  async openDetail(p: any) {
    try {
      const full = await this.payrollService.getOne(p._id);
      this.detail.set(full);
    } catch {
      this.detail.set(p);
    }
  }

  // Edit (bonus/deduction/notes) for DRAFT
  openEdit(p: any) {
    this.editingId = p._id;
    this.editForm = {
      bonusAmount: p.bonusAmount || 0,
      deductionAmount: p.deductionAmount || 0,
      notes: p.notes || '',
    };
    this.error.set('');
    this.showEditModal.set(true);
  }

  openEditFromDetail() {
    const d = this.detail();
    if (!d) return;
    this.detail.set(null);
    this.openEdit(d);
  }

  async submitEdit() {
    if (!this.editingId) return;
    try {
      await this.payrollService.update(this.editingId, this.editForm);
      this.showEditModal.set(false);
      this.editingId = null;
      await this.reload();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi cập nhật');
    }
  }

  // Submit for review
  async submitPayroll(p: any) {
    if (!confirm(`Nộp bảng lương ${p.payrollCode} để duyệt?`)) return;
    try {
      await this.payrollService.submit(p._id);
      this.detail.set(null);
      await this.reload();
    } catch (e: any) {
      alert(e?.error?.message || 'Lỗi nộp bảng lương');
    }
  }

  // Approve
  async approvePayroll(p: any) {
    if (!confirm(`Duyệt bảng lương ${p.payrollCode}?`)) return;
    try {
      await this.payrollService.approve(p._id);
      this.detail.set(null);
      await this.reload();
    } catch (e: any) {
      alert(e?.error?.message || 'Lỗi duyệt');
    }
  }

  // Reject
  async rejectPayroll(p: any) {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    try {
      await this.payrollService.reject(p._id, reason);
      this.detail.set(null);
      await this.reload();
    } catch (e: any) {
      alert(e?.error?.message || 'Lỗi từ chối');
    }
  }

  // Reopen
  async reopenPayroll(p: any) {
    if (!confirm(`Mở lại bảng lương ${p.payrollCode} về trạng thái Nháp?`)) return;
    try {
      await this.payrollService.reopen(p._id);
      this.detail.set(null);
      await this.reload();
    } catch (e: any) {
      alert(e?.error?.message || 'Lỗi mở lại');
    }
  }

  // Delete
  async deletePayroll(p: any) {
    if (!confirm(`Xóa bảng lương ${p.payrollCode}? Thao tác này không thể hoàn tác.`)) return;
    try {
      await this.payrollService.delete(p._id);
      this.detail.set(null);
      await this.reload();
    } catch (e: any) {
      alert(e?.error?.message || 'Lỗi xóa');
    }
  }

  // Mark paid
  openMarkPaid(p: any) {
    this.payingItem.set(p);
    this.paymentRef = '';
    this.error.set('');
    this.showMarkPaidModal.set(true);
  }

  async submitMarkPaid() {
    const item = this.payingItem();
    if (!item) return;
    try {
      await this.payrollService.markPaid(item._id, this.paymentRef);
      this.showMarkPaidModal.set(false);
      this.payingItem.set(null);
      this.detail.set(null);
      await this.reload();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi đánh dấu');
    }
  }

  // Generate single
  openGenerateModal() {
    this.genForm = { userId: '', periodStart: '', periodEnd: '', bonusAmount: 0, deductionAmount: 0, notes: '' };
    this.error.set('');
    this.showGenerateModal.set(true);
  }

  async submitGenerate() {
    if (!this.genForm.userId || !this.genForm.periodStart || !this.genForm.periodEnd) {
      this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }
    try {
      await this.payrollService.generate(this.genForm);
      this.showGenerateModal.set(false);
      await this.reload();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tạo bảng lương');
    }
  }

  // Bulk generate
  openBulkModal() {
    this.bulkForm = { periodStart: '', periodEnd: '' };
    this.bulkResult.set(null);
    this.error.set('');
    this.showBulkModal.set(true);
  }

  async submitBulk() {
    if (!this.bulkForm.periodStart || !this.bulkForm.periodEnd) {
      this.error.set('Vui lòng chọn kỳ lương.');
      return;
    }
    try {
      const res = await this.payrollService.bulkGenerate(this.bulkForm);
      this.bulkResult.set(res);
      await this.reload();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tạo hàng loạt');
    }
  }

  closeBulkModal() {
    this.showBulkModal.set(false);
    this.bulkResult.set(null);
  }
}
