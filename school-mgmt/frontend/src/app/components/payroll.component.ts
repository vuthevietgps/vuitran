import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserService, UserItem } from '../services/user.service';
import {
  PayrollService,
  PayrollPreview,
  PayrollPreviewSession,
  PayrollItem,
  PayrollItemDetail,
  PayrollQueryParams,
} from '../services/payroll.service';
import { Role } from '../models/role.enum';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="payroll"></app-flow-guide>
  <div class="payroll-page">
    <h2>Thanh toán lương giáo viên</h2>

    <!-- ═══════ TAB BAR ═══════ -->
    <div class="tab-bar">
      <button [class.active]="activeTab === 'preview'" (click)="activeTab = 'preview'">
        Xem trước lương
      </button>
      <button [class.active]="activeTab === 'payrolls'" (click)="activeTab = 'payrolls'; loadPayrolls()">
        Bảng lương
      </button>
    </div>

    <!-- ═══════ TAB 1: PREVIEW ═══════ -->
    <div *ngIf="activeTab === 'preview'">
      <!-- Filters -->
      <div class="filter-bar">
        <div class="filter-group" *ngIf="!isTeacher">
          <label>Giáo viên</label>
          <select [(ngModel)]="selectedTeacherId" (change)="loadPreview()">
            <option value="">-- Chọn giáo viên --</option>
            <option *ngFor="let t of teachers" [value]="t._id">{{ t.fullName }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Từ ngày</label>
          <input type="date" [(ngModel)]="periodStart" (change)="loadPreview()" />
        </div>
        <div class="filter-group">
          <label>Đến ngày</label>
          <input type="date" [(ngModel)]="periodEnd" (change)="loadPreview()" />
        </div>
        <button class="btn-primary" (click)="loadPreview()" [disabled]="loadingPreview">
          {{ loadingPreview ? 'Đang tải...' : 'Xem' }}
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loadingPreview" class="loading">Đang tải dữ liệu...</div>

      <!-- Preview Result -->
      <div *ngIf="preview && !loadingPreview">
        <!-- ── Summary Cards ── -->
        <div class="summary-grid">

          <div class="card card-blue">
            <div class="card-number">{{ preview.summary.totalAttended }}</div>
            <div class="card-label">Tổng buổi đã dạy</div>
            <div class="card-amount">{{ formatMoney(preview.amounts.totalAttendedPayout) }}</div>
          </div>

          <div class="card card-green">
            <div class="card-number">{{ preview.summary.eligibleForPayroll }}</div>
            <div class="card-label">Đủ điều kiện tính lương</div>
            <div class="card-amount">{{ formatMoney(preview.amounts.totalEligiblePayout) }}</div>
          </div>

          <div class="card card-teal">
            <div class="card-number">{{ preview.summary.alreadyPaid }}</div>
            <div class="card-label">Đã thanh toán</div>
            <div class="card-amount">{{ formatMoney(preview.amounts.totalAlreadyPaid) }}</div>
          </div>

          <div class="card card-red">
            <div class="card-number">{{ preview.summary.finalizedNoReport }}</div>
            <div class="card-label">Chờ - Thiếu báo cáo</div>
            <div class="card-amount">{{ formatMoney(preview.amounts.totalBlockedByReport) }}</div>
          </div>

          <div class="card card-yellow">
            <div class="card-number">{{ preview.summary.pendingParentConfirm }}</div>
            <div class="card-label">Chờ PH xác nhận</div>
            <div class="card-amount">{{ formatMoney(preview.amounts.totalPendingConfirm) }}</div>
          </div>

          <div class="card card-orange">
            <div class="card-number">{{ preview.summary.pendingFinalize }}</div>
            <div class="card-label">Chờ OPS xác nhận</div>
            <div class="card-amount">{{ formatMoney(preview.amounts.totalPendingFinalize) }}</div>
          </div>

          <div class="card card-gray">
            <div class="card-number">{{ preview.summary.cancelled }}</div>
            <div class="card-label">Đã hủy</div>
          </div>

          <div class="card card-gray">
            <div class="card-number">{{ preview.summary.noShow }}</div>
            <div class="card-label">Vắng mặt</div>
          </div>
        </div>

        <!-- ── Payment Status Breakdown ── -->
        <div class="breakdown-section">
          <h3>Phân tích trạng thái thanh toán</h3>
          <div class="stacked-bar">
            <div class="bar-segment paid"
                 [style.flex]="preview.summary.alreadyPaid"
                 *ngIf="preview.summary.alreadyPaid > 0"
                 title="Đã thanh toán: {{ preview.summary.alreadyPaid }} buổi">
              {{ preview.summary.alreadyPaid }}
            </div>
            <div class="bar-segment eligible"
                 [style.flex]="preview.summary.eligibleForPayroll"
                 *ngIf="preview.summary.eligibleForPayroll > 0"
                 title="Sẵn sàng thanh toán: {{ preview.summary.eligibleForPayroll }} buổi">
              {{ preview.summary.eligibleForPayroll }}
            </div>
            <div class="bar-segment blocked"
                 [style.flex]="preview.summary.finalizedNoReport"
                 *ngIf="preview.summary.finalizedNoReport > 0"
                 title="Chặn bởi thiếu báo cáo: {{ preview.summary.finalizedNoReport }} buổi">
              {{ preview.summary.finalizedNoReport }}
            </div>
            <div class="bar-segment waiting"
                 [style.flex]="preview.summary.pendingParentConfirm"
                 *ngIf="preview.summary.pendingParentConfirm > 0"
                 title="Chờ PH xác nhận: {{ preview.summary.pendingParentConfirm }} buổi">
              {{ preview.summary.pendingParentConfirm }}
            </div>
            <div class="bar-segment finalize"
                 [style.flex]="preview.summary.pendingFinalize"
                 *ngIf="preview.summary.pendingFinalize > 0"
                 title="Chờ OPS xác nhận: {{ preview.summary.pendingFinalize }} buổi">
              {{ preview.summary.pendingFinalize }}
            </div>
          </div>
          <div class="bar-legend">
            <span class="legend-item"><span class="dot paid"></span> Đã thanh toán</span>
            <span class="legend-item"><span class="dot eligible"></span> Sẵn sàng TT</span>
            <span class="legend-item"><span class="dot blocked"></span> Thiếu báo cáo</span>
            <span class="legend-item"><span class="dot waiting"></span> Chờ PH</span>
            <span class="legend-item"><span class="dot finalize"></span> Chờ OPS xác nhận</span>
          </div>
        </div>

        <!-- ── Generate Payroll Button ── -->
        <div class="action-row" *ngIf="!isTeacher && preview.summary.eligibleForPayroll > 0">
          <button class="btn-success" (click)="generatePayroll()" [disabled]="generating">
            {{ generating ? 'Đang tạo...' : 'Tạo bảng lương (' + preview.summary.eligibleForPayroll + ' buổi — ' + formatMoney(preview.amounts.totalEligiblePayout) + ')' }}
          </button>
        </div>

        <!-- ── Existing Payrolls for Period ── -->
        <div *ngIf="preview.existingPayrolls && preview.existingPayrolls.length > 0" class="existing-payrolls">
          <h3>Bảng lương đã tạo trong kỳ</h3>
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Trạng thái</th>
                <th>Số buổi</th>
                <th>Tổng lương</th>
                <th>Thực nhận</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of preview.existingPayrolls">
                <td>{{ getPayrollField(p, 'payrollCode') }}</td>
                <td><span class="badge" [class]="'badge-' + getPayrollField(p, 'status').toLowerCase()">{{ getPayrollStatusLabel(getPayrollField(p, 'status')) }}</span></td>
                <td>{{ getPayrollField(p, 'totalSessions') }}</td>
                <td>{{ formatMoney(getPayrollNumber(p, 'grossAmount')) }}</td>
                <td class="amount">{{ formatMoney(getPayrollNumber(p, 'netAmount')) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ── Session Filter Tabs ── -->
        <div class="session-filter-tabs">
          <button [class.active]="sessionFilter === 'all'" (click)="sessionFilter = 'all'">
            Tất cả ({{ preview.sessions.length }})
          </button>
          <button [class.active]="sessionFilter === 'ELIGIBLE'" (click)="sessionFilter = 'ELIGIBLE'">
            Đủ ĐK lương ({{ preview.summary.eligibleForPayroll }})
          </button>
          <button [class.active]="sessionFilter === 'PAID'" (click)="sessionFilter = 'PAID'">
            Đã TT ({{ preview.summary.alreadyPaid }})
          </button>
          <button [class.active]="sessionFilter === 'BLOCKED_NO_REPORT'" (click)="sessionFilter = 'BLOCKED_NO_REPORT'">
            Thiếu BC ({{ preview.summary.finalizedNoReport }})
          </button>
          <button [class.active]="sessionFilter === 'WAITING_PARENT'" (click)="sessionFilter = 'WAITING_PARENT'">
            Chờ PH ({{ preview.summary.pendingParentConfirm }})
          </button>
          <button [class.active]="sessionFilter === 'WAITING_FINALIZE'" (click)="sessionFilter = 'WAITING_FINALIZE'">
            Chờ OPS xác nhận ({{ preview.summary.pendingFinalize }})
          </button>
        </div>

        <!-- ── Sessions Table ── -->
        <table class="data-table session-table" *ngIf="filteredSessions.length > 0">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Học sinh</th>
              <th>Thời lượng</th>
              <th>Lương GV</th>
              <th>Trạng thái</th>
              <th>Báo cáo</th>
              <th>Lý do chờ</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filteredSessions" [class]="'row-' + s.payrollStatus.toLowerCase()">
              <td>{{ formatDate(s.scheduledDate) }}</td>
              <td>{{ s.classId?.name || s.classId?.code || '---' }}</td>
              <td>{{ s.studentId?.fullName || '---' }}</td>
              <td>{{ s.durationMinutes }}p</td>
              <td class="amount">{{ formatMoney(s.teacherPayout) }}</td>
              <td>
                <span class="badge" [class]="'badge-' + s.payrollStatus.toLowerCase()">
                  {{ getPayrollStatusLabel(s.payrollStatus) }}
                </span>
              </td>
              <td>
                <span *ngIf="s.hasTeachingReport" class="report-yes" title="Đã nộp báo cáo">&#10003;</span>
                <span *ngIf="!s.hasTeachingReport" class="report-no" title="Chưa nộp báo cáo">&#10007;</span>
                <small *ngIf="s.teachingReport?.isLateSubmission" class="late-badge">Trễ</small>
              </td>
              <td class="reason-col">
                <span *ngIf="s.payrollStatus === 'BLOCKED_NO_REPORT'" class="reason-text reason-blocked">
                  ✗ Buổi {{ formatDate(s.scheduledDate) }} thiếu Báo cáo giảng dạy
                </span>
                <span *ngIf="s.payrollStatus === 'WAITING_PARENT'" class="reason-text">Chờ phụ huynh xác nhận</span>
                <span *ngIf="s.payrollStatus === 'WAITING_FINALIZE'" class="reason-text reason-blocked">
                  ✗ Buổi {{ formatDate(s.scheduledDate) }} chưa được OPS Duyệt chốt
                </span>
                <span *ngIf="s.payrollStatus === 'PAID'" class="reason-text paid-text">&#10003; Đã thanh toán</span>
                <span *ngIf="s.payrollStatus === 'ELIGIBLE'" class="reason-text eligible-text">Sẵn sàng thanh toán</span>
                <span *ngIf="s.payrollStatus === 'CANCELLED'" class="reason-text">Đã hủy — 0đ</span>
                <span *ngIf="s.payrollStatus === 'NO_SHOW'" class="reason-text">HS vắng mặt — 0đ</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="filteredSessions.length === 0 && preview" class="empty-state">
          Không có buổi học nào trong danh mục này.
        </div>
      </div>

      <!-- No data -->
      <div *ngIf="!preview && !loadingPreview && hasSearched" class="empty-state">
        Không có dữ liệu. Vui lòng chọn giáo viên và kỳ thanh toán.
      </div>
    </div>

    <!-- ═══════ TAB 2: PAYROLL LIST ═══════ -->
    <div *ngIf="activeTab === 'payrolls'">

      <!-- Filters -->
      <div class="filter-bar">
        <div class="filter-group" *ngIf="!isTeacher">
          <label>Giáo viên</label>
          <select [(ngModel)]="payrollFilterTeacher" (change)="loadPayrolls()">
            <option value="">-- Tất cả --</option>
            <option *ngFor="let t of teachers" [value]="t._id">{{ t.fullName }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Trạng thái</label>
          <select [(ngModel)]="payrollFilterStatus" (change)="loadPayrolls()">
            <option value="">-- Tất cả --</option>
            <option value="DRAFT">Nháp</option>
            <option value="PENDING_REVIEW">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="PAID">Đã chi</option>
            <option value="REJECTED">Từ chối</option>
          </select>
        </div>
        <button class="btn-primary" (click)="loadPayrolls()">Tìm</button>

        <!-- Bulk generate -->
        <div class="filter-group" *ngIf="!isTeacher" style="margin-left:auto;">
          <button class="btn-success" (click)="showBulkGenerate = !showBulkGenerate">
            Tạo lương hàng loạt
          </button>
        </div>
      </div>

      <!-- Bulk generate modal -->
      <div *ngIf="showBulkGenerate" class="inline-form">
        <div class="filter-group">
          <label>Kỳ từ</label>
          <input type="date" [(ngModel)]="bulkStart" />
        </div>
        <div class="filter-group">
          <label>Kỳ đến</label>
          <input type="date" [(ngModel)]="bulkEnd" />
        </div>
        <button class="btn-success" (click)="doBulkGenerate()" [disabled]="generating">
          {{ generating ? 'Đang tạo...' : 'Tạo cho tất cả GV' }}
        </button>
        <button class="btn-secondary" (click)="showBulkGenerate = false">Đóng</button>
      </div>

      <!-- Payroll Table -->
      <table class="data-table" *ngIf="payrolls.length > 0">
        <thead>
          <tr>
            <th>Mã</th>
            <th *ngIf="!isTeacher">Giáo viên</th>
            <th>Kỳ</th>
            <th>Số buổi</th>
            <th>Tổng lương</th>
            <th>Thưởng</th>
            <th>Khấu trừ</th>
            <th>Thực nhận</th>
            <th>Trạng thái</th>
            <th *ngIf="!isTeacher">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of payrolls" (click)="selectPayroll(p)" class="clickable-row">
            <td>{{ p.payrollCode }}</td>
            <td *ngIf="!isTeacher">{{ p.teacherId?.fullName || '---' }}</td>
            <td>{{ formatDate(p.periodStart) }} — {{ formatDate(p.periodEnd) }}</td>
            <td>{{ p.totalSessions }}</td>
            <td class="amount">{{ formatMoney(p.grossAmount) }}</td>
            <td class="amount positive">{{ p.bonusAmount ? '+' + formatMoney(p.bonusAmount) : '—' }}</td>
            <td class="amount negative">{{ p.deductionAmount ? '-' + formatMoney(p.deductionAmount) : '—' }}</td>
            <td class="amount bold">{{ formatMoney(p.netAmount) }}</td>
            <td>
              <span class="badge" [class]="'badge-' + p.status.toLowerCase()">
                {{ getPayrollStatusLabel(p.status) }}
              </span>
            </td>
            <td *ngIf="!isTeacher" (click)="$event.stopPropagation()">
              <div class="action-buttons">
                <button *ngIf="p.status === 'DRAFT'" class="btn-sm btn-primary" (click)="submitPayroll(p._id)">Gửi duyệt</button>
                <button *ngIf="p.status === 'PENDING_REVIEW' && isDirector" class="btn-sm btn-success" (click)="approvePayroll(p._id)">Duyệt</button>
                <button *ngIf="p.status === 'PENDING_REVIEW' && isDirector" class="btn-sm btn-danger" (click)="rejectPayroll(p._id)">Từ chối</button>
                <button *ngIf="p.status === 'APPROVED'" class="btn-sm btn-success" (click)="markPaidPayroll(p._id)">Xác nhận chi</button>
                <button *ngIf="p.status === 'REJECTED'" class="btn-sm btn-secondary" (click)="reopenPayroll(p._id)">Mở lại</button>
                <button *ngIf="p.status === 'DRAFT'" class="btn-sm btn-danger" (click)="deletePayroll(p._id)">Xóa</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="payrolls.length === 0 && !loadingPayrolls" class="empty-state">
        Chưa có bảng lương nào.
      </div>
      <div *ngIf="loadingPayrolls" class="loading">Đang tải...</div>

      <!-- Pagination -->
      <div *ngIf="payrollMeta.totalPages > 1" class="pagination">
        <button (click)="payrollPage = payrollPage - 1; loadPayrolls()" [disabled]="payrollPage <= 1">&laquo;</button>
        <span>Trang {{ payrollPage }} / {{ payrollMeta.totalPages }}</span>
        <button (click)="payrollPage = payrollPage + 1; loadPayrolls()" [disabled]="payrollPage >= payrollMeta.totalPages">&raquo;</button>
      </div>

      <!-- ── Payroll Detail Modal ── -->
      <div *ngIf="selectedPayroll" class="modal-overlay" (click)="selectedPayroll = null">
        <div class="modal-content large-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Chi tiết bảng lương: {{ selectedPayroll.payrollCode }}</h3>
            <button class="close-btn" (click)="selectedPayroll = null">&times;</button>
          </div>

          <div class="modal-body">
            <div class="detail-grid">
              <div><strong>Giáo viên:</strong> {{ selectedPayroll.teacherId?.fullName }}</div>
              <div><strong>Kỳ:</strong> {{ formatDate(selectedPayroll.periodStart) }} — {{ formatDate(selectedPayroll.periodEnd) }}</div>
              <div><strong>Trạng thái:</strong> <span class="badge" [class]="'badge-' + selectedPayroll.status.toLowerCase()">{{ getPayrollStatusLabel(selectedPayroll.status) }}</span></div>
              <div><strong>Tổng buổi:</strong> {{ selectedPayroll.totalSessions }}</div>
              <div><strong>Lương gốc:</strong> {{ formatMoney(selectedPayroll.grossAmount) }}</div>
              <div><strong>Điều chỉnh:</strong> {{ formatMoney(selectedPayroll.adjustmentAmount) }}</div>
              <div><strong>Thưởng:</strong> {{ formatMoney(selectedPayroll.bonusAmount) }}</div>
              <div><strong>Khấu trừ:</strong> {{ formatMoney(selectedPayroll.deductionAmount) }}</div>
              <div class="full-width"><strong>Thực nhận:</strong> <span class="big-amount">{{ formatMoney(selectedPayroll.netAmount) }}</span></div>
              <div *ngIf="selectedPayroll.notes"><strong>Ghi chú:</strong> {{ selectedPayroll.notes }}</div>
              <div *ngIf="selectedPayroll.paymentRef"><strong>Ref TT:</strong> {{ selectedPayroll.paymentRef }}</div>
              <div *ngIf="selectedPayroll.rejectionReason"><strong>Lý do từ chối:</strong> {{ selectedPayroll.rejectionReason }}</div>
            </div>

            <!-- Items -->
            <h4 style="margin-top:16px;">Danh sách buổi dạy</h4>
            <table class="data-table" *ngIf="payrollItems.length > 0">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Lớp</th>
                  <th>Học sinh</th>
                  <th>Lương gốc</th>
                  <th>Lương TT</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of payrollItems">
                  <td>{{ formatDate(item.sessionDate) }}</td>
                  <td>{{ item.classId?.name || item.classId?.code || '---' }}</td>
                  <td>{{ item.studentId?.fullName || '---' }}</td>
                  <td class="amount">{{ formatMoney(item.teacherPayout) }}</td>
                  <td class="amount">{{ formatMoney(item.adjustedPayout) }}</td>
                  <td><span class="badge" [class]="'badge-item-' + item.status.toLowerCase()">{{ item.status }}</span></td>
                  <td>{{ item.adjustmentReason || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ NOTIFICATION ═══════ -->
    <div *ngIf="notification" class="notification" [class.error]="notificationType === 'error'">
      {{ notification }}
    </div>
  </div>
  `,
  styles: [`
    .payroll-page { padding: 24px; font-family: 'Segoe UI', sans-serif; max-width: 1400px; margin: 0 auto; }
    h2 { margin: 0 0 20px; color: #1e293b; font-size: 22px; }
    h3 { margin: 20px 0 12px; color: #334155; font-size: 16px; }
    h4 { margin: 16px 0 8px; color: #334155; font-size: 14px; }

    /* Tab bar */
    .tab-bar { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .tab-bar button {
      padding: 10px 24px; border: none; background: none; cursor: pointer;
      font-size: 14px; font-weight: 600; color: #64748b;
      border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s;
    }
    .tab-bar button.active { color: #2563eb; border-bottom-color: #2563eb; }
    .tab-bar button:hover { color: #1e40af; }

    /* Filters */
    .filter-bar {
      display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
      margin-bottom: 20px; padding: 16px; background: #f8fafc;
      border-radius: 8px; border: 1px solid #e2e8f0;
    }
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    .filter-group label { font-size: 12px; font-weight: 600; color: #64748b; }
    .filter-group select, .filter-group input {
      padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px;
      font-size: 13px; min-width: 160px; background: #fff;
    }

    /* Inline form */
    .inline-form {
      display: flex; gap: 12px; align-items: flex-end; padding: 16px;
      background: #eff6ff; border-radius: 8px; margin-bottom: 16px; border: 1px solid #bfdbfe;
    }

    /* Summary cards */
    .summary-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .card {
      padding: 16px; border-radius: 10px; background: #fff;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .card-number { font-size: 28px; font-weight: 700; line-height: 1; }
    .card-label { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 600; }
    .card-amount { font-size: 14px; margin-top: 6px; font-weight: 600; }
    .card-blue { border-left: 4px solid #2563eb; }
    .card-blue .card-number { color: #2563eb; }
    .card-blue .card-amount { color: #1e40af; }
    .card-green { border-left: 4px solid #16a34a; }
    .card-green .card-number { color: #16a34a; }
    .card-green .card-amount { color: #15803d; }
    .card-teal { border-left: 4px solid #0d9488; }
    .card-teal .card-number { color: #0d9488; }
    .card-teal .card-amount { color: #0f766e; }
    .card-red { border-left: 4px solid #dc2626; }
    .card-red .card-number { color: #dc2626; }
    .card-red .card-amount { color: #b91c1c; }
    .card-yellow { border-left: 4px solid #d97706; }
    .card-yellow .card-number { color: #d97706; }
    .card-yellow .card-amount { color: #b45309; }
    .card-orange { border-left: 4px solid #ea580c; }
    .card-orange .card-number { color: #ea580c; }
    .card-orange .card-amount { color: #c2410c; }
    .card-gray { border-left: 4px solid #94a3b8; }
    .card-gray .card-number { color: #94a3b8; }

    /* Stacked bar */
    .breakdown-section { margin-bottom: 24px; }
    .stacked-bar {
      display: flex; height: 36px; border-radius: 6px; overflow: hidden;
      background: #f1f5f9; border: 1px solid #e2e8f0;
    }
    .bar-segment {
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 12px; font-weight: 700; min-width: 24px;
      transition: flex 0.3s;
    }
    .bar-segment.paid { background: #0d9488; }
    .bar-segment.eligible { background: #16a34a; }
    .bar-segment.blocked { background: #dc2626; }
    .bar-segment.waiting { background: #d97706; }
    .bar-segment.finalize { background: #ea580c; }

    .bar-legend { display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #475569; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.paid { background: #0d9488; }
    .dot.eligible { background: #16a34a; }
    .dot.blocked { background: #dc2626; }
    .dot.waiting { background: #d97706; }
    .dot.finalize { background: #ea580c; }

    /* Action row */
    .action-row { margin-bottom: 20px; }

    /* Session filter tabs */
    .session-filter-tabs { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
    .session-filter-tabs button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 20px;
      background: #fff; font-size: 12px; font-weight: 500; cursor: pointer;
      color: #475569; transition: all 0.15s;
    }
    .session-filter-tabs button.active {
      background: #2563eb; color: #fff; border-color: #2563eb;
    }

    /* Tables */
    .data-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      overflow: hidden; margin-bottom: 16px;
    }
    .data-table th {
      background: #f1f5f9; padding: 10px 12px; text-align: left;
      font-weight: 600; color: #475569; white-space: nowrap; font-size: 12px;
      border-bottom: 2px solid #e2e8f0;
    }
    .data-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    .data-table tbody tr:hover { background: #f8fafc; }
    .clickable-row { cursor: pointer; }
    .amount { font-family: 'SF Mono', 'Consolas', monospace; text-align: right; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .bold { font-weight: 700; }

    /* Row colors by status */
    .row-blocked_no_report { background: #fef2f2; }
    .row-waiting_parent { background: #fffbeb; }
    .row-paid { background: #f0fdfa; }
    .row-eligible { background: #f0fdf4; }

    /* Report icons */
    .report-yes { color: #16a34a; font-weight: 700; font-size: 15px; }
    .report-no { color: #dc2626; font-weight: 700; font-size: 15px; }
    .late-badge {
      display: inline-block; background: #fbbf24; color: #78350f;
      font-size: 10px; padding: 1px 6px; border-radius: 4px; margin-left: 4px;
      font-weight: 700;
    }
    .reason-col { font-size: 12px; }
    .reason-text { color: #64748b; }
    .reason-blocked { color: #dc2626; font-weight: 500; }
    .paid-text { color: #0d9488; font-weight: 600; }
    .eligible-text { color: #16a34a; font-weight: 600; }

    /* Badges */
    .badge {
      display: inline-block; padding: 3px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600; white-space: nowrap;
    }
    .badge-paid, .badge-teal { background: #ccfbf1; color: #0d9488; }
    .badge-eligible { background: #dcfce7; color: #16a34a; }
    .badge-blocked_no_report { background: #fee2e2; color: #dc2626; }
    .badge-waiting_parent { background: #fef3c7; color: #d97706; }
    .badge-waiting_finalize { background: #ffedd5; color: #ea580c; }
    .badge-cancelled { background: #f1f5f9; color: #64748b; }
    .badge-no_show { background: #f1f5f9; color: #64748b; }
    .badge-other { background: #f1f5f9; color: #64748b; }
    .badge-draft { background: #e0e7ff; color: #4338ca; }
    .badge-pending_review { background: #fef3c7; color: #d97706; }
    .badge-approved { background: #dcfce7; color: #16a34a; }
    .badge-rejected { background: #fee2e2; color: #dc2626; }
    .badge-item-included { background: #dcfce7; color: #16a34a; }
    .badge-item-excluded { background: #fee2e2; color: #dc2626; }
    .badge-item-adjusted { background: #e0e7ff; color: #4338ca; }

    /* Buttons */
    .btn-primary {
      padding: 8px 20px; background: #2563eb; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn-success {
      padding: 8px 20px; background: #16a34a; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-success:hover { background: #15803d; }
    .btn-success:disabled { background: #86efac; cursor: not-allowed; }
    .btn-secondary {
      padding: 8px 20px; background: #64748b; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-danger {
      padding: 8px 20px; background: #dc2626; color: #fff; border: none;
      border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .btn-danger:hover { background: #b91c1c; }
    .btn-sm { padding: 4px 10px; font-size: 11px; border-radius: 4px; }
    .action-buttons { display: flex; gap: 4px; flex-wrap: wrap; }

    /* Modal */
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); display: flex; align-items: center;
      justify-content: center; z-index: 1000;
    }
    .modal-content {
      background: #fff; border-radius: 12px; max-height: 90vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .large-modal { width: 900px; max-width: 95vw; }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; border-bottom: 1px solid #e2e8f0;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #1e293b; }
    .close-btn {
      border: none; background: none; font-size: 24px; cursor: pointer;
      color: #94a3b8; padding: 0 4px;
    }
    .modal-body { padding: 20px 24px; }
    .detail-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px; font-size: 13px;
    }
    .full-width { grid-column: 1 / -1; }
    .big-amount { font-size: 20px; font-weight: 700; color: #16a34a; }

    /* Pagination */
    .pagination {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      margin-top: 16px;
    }
    .pagination button {
      padding: 6px 14px; border: 1px solid #cbd5e1; border-radius: 6px;
      background: #fff; cursor: pointer; font-weight: 600;
    }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .pagination span { font-size: 13px; color: #64748b; }

    /* Notification */
    .notification {
      position: fixed; bottom: 24px; right: 24px; padding: 12px 24px;
      background: #16a34a; color: #fff; border-radius: 8px; font-size: 14px;
      font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,0.2); z-index: 2000;
      animation: fadeIn 0.3s ease;
    }
    .notification.error { background: #dc2626; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* Empty / Loading */
    .empty-state { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; }
    .loading { text-align: center; padding: 40px; color: #64748b; font-size: 14px; }

    .existing-payrolls { margin-bottom: 20px; }

    .session-table { font-size: 12px; }
    .session-table th { font-size: 11px; }
  `]
})
export class PayrollComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private userService: UserService,
    private payrollService: PayrollService,
  ) {}

  // ── State ─────────────────────────────────────────────────────

  activeTab: 'preview' | 'payrolls' = 'preview';
  teachers: UserItem[] = [];

  // Preview tab
  selectedTeacherId = '';
  periodStart = '';
  periodEnd = '';
  preview: PayrollPreview | null = null;
  loadingPreview = false;
  hasSearched = false;
  sessionFilter = 'all';
  generating = false;

  // Payrolls tab
  payrolls: PayrollItem[] = [];
  payrollMeta: any = {};
  payrollPage = 1;
  loadingPayrolls = false;
  payrollFilterTeacher = '';
  payrollFilterStatus = '';
  showBulkGenerate = false;
  bulkStart = '';
  bulkEnd = '';

  // Detail modal
  selectedPayroll: PayrollItem | null = null;
  payrollItems: PayrollItemDetail[] = [];

  // Notification
  notification = '';
  notificationType: 'success' | 'error' = 'success';

  get isTeacher(): boolean {
    return this.auth.userSignal()?.role === Role.TEACHER;
  }

  get isDirector(): boolean {
    return this.auth.userSignal()?.role === Role.DIRECTOR;
  }

  get filteredSessions(): PayrollPreviewSession[] {
    if (!this.preview) return [];
    if (this.sessionFilter === 'all') return this.preview.sessions;
    return this.preview.sessions.filter(s => s.payrollStatus === this.sessionFilter);
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  async ngOnInit() {
    // Set default period: current month
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    this.periodStart = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    this.periodEnd = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    this.bulkStart = this.periodStart;
    this.bulkEnd = this.periodEnd;

    if (this.isTeacher) {
      this.selectedTeacherId = this.auth.userSignal()!.sub;
      this.loadPreview();
    } else {
      this.teachers = await this.userService.listTeachers();
    }
  }

  // ── Preview ───────────────────────────────────────────────────

  async loadPreview() {
    const teacherId = this.isTeacher ? this.auth.userSignal()!.sub : this.selectedTeacherId;
    if (!teacherId || !this.periodStart || !this.periodEnd) return;

    this.loadingPreview = true;
    this.hasSearched = true;
    this.sessionFilter = 'all';
    try {
      this.preview = await this.payrollService.getTeacherPreview(teacherId, this.periodStart, this.periodEnd);
    } catch {
      this.showNotification('Lỗi tải dữ liệu', 'error');
    } finally {
      this.loadingPreview = false;
    }
  }

  async generatePayroll() {
    if (!this.preview || this.preview.summary.eligibleForPayroll === 0) return;
    const teacherId = this.isTeacher ? this.auth.userSignal()!.sub : this.selectedTeacherId;
    if (!teacherId) return;

    this.generating = true;
    try {
      const result = await this.payrollService.generate({
        teacherId,
        periodStart: this.periodStart,
        periodEnd: this.periodEnd,
      });
      if (result.ok) {
        this.showNotification('Đã tạo bảng lương thành công!');
        await this.loadPreview();
      } else {
        this.showNotification(result.error || 'Lỗi tạo bảng lương', 'error');
      }
    } finally {
      this.generating = false;
    }
  }

  // ── Payrolls Tab ──────────────────────────────────────────────

  async loadPayrolls() {
    this.loadingPayrolls = true;
    try {
      const params: PayrollQueryParams = {
        page: this.payrollPage,
        limit: 20,
      };
      if (this.payrollFilterTeacher) params.teacherId = this.payrollFilterTeacher;
      if (this.payrollFilterStatus) params.status = this.payrollFilterStatus;

      let result;
      if (this.isTeacher) {
        result = await this.payrollService.getMyPayrolls(params);
      } else {
        result = await this.payrollService.list(params);
      }
      this.payrolls = result.data;
      this.payrollMeta = result.meta;
    } catch {
      this.showNotification('Lỗi tải bảng lương', 'error');
    } finally {
      this.loadingPayrolls = false;
    }
  }

  async selectPayroll(p: PayrollItem) {
    this.selectedPayroll = p;
    this.payrollItems = await this.payrollService.getItems(p._id);
  }

  async submitPayroll(id: string) {
    if (await this.payrollService.submitForReview(id)) {
      this.showNotification('Đã gửi duyệt!');
      await this.loadPayrolls();
    }
  }

  async approvePayroll(id: string) {
    if (await this.payrollService.approve(id)) {
      this.showNotification('Đã phê duyệt!');
      await this.loadPayrolls();
    }
  }

  async rejectPayroll(id: string) {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    if (await this.payrollService.reject(id, reason)) {
      this.showNotification('Đã từ chối!');
      await this.loadPayrolls();
    }
  }

  async markPaidPayroll(id: string) {
    const ref = prompt('Mã giao dịch ngân hàng (tùy chọn):') || undefined;
    if (await this.payrollService.markPaid(id, ref)) {
      this.showNotification('Đã xác nhận chi lương!');
      await this.loadPayrolls();
    }
  }

  async reopenPayroll(id: string) {
    if (await this.payrollService.reopen(id)) {
      this.showNotification('Đã mở lại!');
      await this.loadPayrolls();
    }
  }

  async deletePayroll(id: string) {
    if (!confirm('Xóa bảng lương DRAFT này?')) return;
    if (await this.payrollService.remove(id)) {
      this.showNotification('Đã xóa!');
      this.selectedPayroll = null;
      await this.loadPayrolls();
    }
  }

  async doBulkGenerate() {
    if (!this.bulkStart || !this.bulkEnd) return;
    this.generating = true;
    try {
      const result = await this.payrollService.bulkGenerate(this.bulkStart, this.bulkEnd);
      if (result.ok) {
        const d = result.data;
        this.showNotification(`Đã tạo: ${d.created}, bỏ qua: ${d.skipped}, lỗi: ${d.errors?.length || 0}`);
        this.showBulkGenerate = false;
        await this.loadPayrolls();
      } else {
        this.showNotification(result.error || 'Lỗi tạo hàng loạt', 'error');
      }
    } finally {
      this.generating = false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  formatMoney(n: number): string {
    if (!n && n !== 0) return '0đ';
    return n.toLocaleString('vi-VN') + 'đ';
  }

  formatDate(d: string): string {
    if (!d) return '---';
    const date = new Date(d);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getPayrollStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PAID: 'Đã thanh toán',
      ELIGIBLE: 'Sẵn sàng TT',
      BLOCKED_NO_REPORT: 'Thiếu báo cáo',
      WAITING_PARENT: 'Chờ PH xác nhận',
      WAITING_FINALIZE: 'Chờ OPS xác nhận',
      CANCELLED: 'Đã hủy',
      NO_SHOW: 'Vắng mặt',
      OTHER: 'Khác',
      DRAFT: 'Nháp',
      PENDING_REVIEW: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Từ chối',
    };
    return map[status] || status;
  }

  getPayrollField(p: any, field: string): string {
    return p?.[field] || '---';
  }

  getPayrollNumber(p: any, field: string): number {
    return p?.[field] || 0;
  }

  private showNotification(msg: string, type: 'success' | 'error' = 'success') {
    this.notification = msg;
    this.notificationType = type;
    setTimeout(() => { this.notification = ''; }, 3500);
  }
}
