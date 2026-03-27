import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  OrderCommunicationSummary,
  OrderData,
  OrderPipeline,
  OrderService,
} from '../services/order.service';
import { ProductService, ProductItem } from '../services/product.service';
import { LeadService, LeadItem } from '../services/lead.service';
import { AdsService, AdGroupItem } from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { UserService, UserItem } from '../services/user.service';
import { StudentService, StudentItem } from '../services/student.service';
import { Role } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối',
  NEEDS_INFO: 'Cần bổ sung', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
};
const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#64748b', SUBMITTED: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444',
  NEEDS_INFO: '#8b5cf6', COMPLETED: '#059669', CANCELLED: '#9ca3af',
};
const TYPE_LABELS: Record<string, string> = {
  NEW_ENROLLMENT: 'Đăng ký mới', RENEWAL: 'Gia hạn', ADDITIONAL: 'Mua thêm', PACKAGE_CHANGE: 'Đổi gói',
};
const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook', GOOGLE: 'Google', TIKTOK: 'TikTok', ZALO: 'Zalo',
  WEBSITE: 'Website', REFERRAL: 'Giới thiệu', WALK_IN: 'Đến trực tiếp', OTHER: 'Khác',
};

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Đơn đăng ký học</h2>
      <p>Quản lý đơn đăng ký, gia hạn, mua thêm buổi.</p>
    </div>
    <button class="primary" (click)="openCreate()">+ Tạo đơn</button>
  </header>

  <app-flow-guide featureKey="orders"></app-flow-guide>

  <!-- Pipeline -->
  <section class="pipeline" *ngIf="pipeline()">
    <div class="pipe-card" *ngFor="let s of pipelineStatuses" [style.border-left-color]="statusColor(s)">
      <div class="pipe-count">{{getPipeCount(s)}}</div>
      <div class="pipe-label">{{statusLabel(s)}}</div>
      <div class="pipe-value" *ngIf="getPipeValue(s)">{{getPipeValue(s) | number}}đ</div>
    </div>
  </section>

  <!-- Filters -->
  <section class="filters">
    <input placeholder="Tìm mã, tên, SĐT..." [(ngModel)]="keyword" />
    <select [(ngModel)]="filterStatus">
      <option value="">Tất cả</option>
      <option *ngFor="let s of allStatuses" [value]="s">{{statusLabel(s)}}</option>
    </select>
    <select [(ngModel)]="filterType">
      <option value="">Tất cả loại</option>
      <option *ngFor="let t of allTypes" [value]="t.value">{{t.label}}</option>
    </select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <!-- Table -->
  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr>
      <th>Mã đơn</th><th>Loại</th><th>Học viên</th><th>PH</th>
      <th>Tổng tiền</th><th>Trạng thái</th><th>Sale</th><th>Ngày tạo</th><th></th>
    </tr></thead>
    <tbody>
      <tr *ngFor="let o of filtered()" class="clickable" (click)="openDetail(o)">
        <td><code>{{o.orderCode}}</code></td>
        <td>{{typeLabel(o.orderType)}}</td>
        <td>{{o.studentName}}</td>
        <td>{{o.parentName}}<br/><small>{{o.parentPhone}}</small></td>
        <td class="right"><strong>{{o.finalAmount | number}}đ</strong></td>
        <td>
          <span class="badge" [style.background]="statusColor(o.status) + '20'" [style.color]="statusColor(o.status)">
            {{statusLabel(o.status)}}
          </span>
        </td>
        <td>{{o.saleName || '-'}}</td>
        <td>{{o.createdAt | date:'dd/MM/yyyy'}}</td>
        <td class="actions-cell" (click)="$event.stopPropagation()">
          <button class="btn-sm" *ngIf="o.status === 'DRAFT' || o.status === 'NEEDS_INFO'" (click)="submitOrder(o)">Gửi duyệt</button>
          <button class="btn-sm success" *ngIf="o.status === 'SUBMITTED' && canApprove" (click)="approveOrder(o)">Duyệt</button>
          <button class="btn-sm" *ngIf="o.status === 'SUBMITTED' && canApprove" (click)="requestMoreInfo(o)">Can bo sung</button>
          <button class="btn-sm danger" *ngIf="o.status === 'SUBMITTED' && canApprove" (click)="rejectOrder(o)">Từ chối</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty-text">Không có đơn nào.</p></ng-template>

  <!-- Modal Create -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal wide">
      <h3>{{editingId ? 'Sửa đơn' : 'Tạo đơn đăng ký'}}</h3>
      <form (ngSubmit)="submitForm()" #f="ngForm">
        <div class="form-grid">
          <label>Loại đơn <span class="req">*</span>
            <select name="orderType" [(ngModel)]="form.orderType" required>
              <option *ngFor="let t of allTypes" [value]="t.value">{{t.label}}</option>
            </select>
          </label>
          <label>Nguồn
            <select name="leadSource" [(ngModel)]="form.leadSource" (ngModelChange)="onLeadSourceChange()">
              <option value="">--</option>
              <option *ngFor="let s of allSources" [value]="s.value">{{s.label}}</option>
            </select>
          </label>
          <label *ngIf="['FACEBOOK','GOOGLE','TIKTOK'].includes(form.leadSource)">Nhóm QC
            <select name="adGroupId" [(ngModel)]="form.adGroupId" (ngModelChange)="onAdGroupChange()"
                    [disabled]="form.leadId && form.adGroupFromLead">
              <option value="">-- Không chọn --</option>
              <option *ngFor="let g of orderAdGroups()" [value]="g._id">{{g.name}}</option>
            </select>
            <small *ngIf="form.adGroupFromLead" style="color:#64748b;">Từ Lead</small>
          </label>
          <label *ngIf="!isSaleRole">Sale phụ trách
            <select name="saleId" [(ngModel)]="form.saleId">
              <option value="">-- Tự suy từ lead/học viên --</option>
              <option *ngFor="let sale of sales()" [value]="sale._id">{{sale.fullName}}</option>
            </select>
            <small style="color:#64748b;">Nếu lead/học viên đã có owner, hệ thống sẽ tự khóa theo owner đó.</small>
          </label>
          <label *ngIf="isSaleRole">Sale phụ trách
            <input [value]="currentUserName" disabled />
          </label>
        </div>

        <h4>Lien ket he thong</h4>
        <div class="lookup-grid">
          <label>Phu huynh da co
            <input
              name="parentLookup"
              [(ngModel)]="parentLookup"
              placeholder="Tim ten, SDT, email..." />
            <select
              name="parentUserId"
              [ngModel]="form.parentUserId || ''"
              (ngModelChange)="onParentSelected($event)">
              <option value="">-- Khong lien ket --</option>
              <option *ngFor="let parent of filteredParents()" [value]="parent._id">
                {{ formatParentOption(parent) }}
              </option>
            </select>
            <small class="field-hint">Chon de dung lai tai khoan phu huynh hien co va tranh tao trung.</small>
          </label>
          <label>Hoc sinh da co
            <input
              name="studentLookup"
              [(ngModel)]="studentLookup"
              placeholder="Tim ma HS, ten, SDT PH..." />
            <select
              name="existingStudentId"
              [ngModel]="form.existingStudentId || ''"
              (ngModelChange)="onExistingStudentSelected($event)">
              <option value="">-- Khong lien ket --</option>
              <option *ngFor="let student of filteredStudents()" [value]="student._id">
                {{ formatStudentOption(student) }}
              </option>
            </select>
            <small class="field-hint">Neu chon hoc sinh cu, he thong se uu tien dung lai ho so hien co.</small>
          </label>
        </div>
        <p class="link-warning" *ngIf="suggestedStudents().length && !form.existingStudentId">
          Tim thay {{suggestedStudents().length}} ho so hoc sinh co thong tin gan trung. Nen lien ket hoc sinh cu neu day la cung mot ban.
        </p>

        <h4>Thông tin phụ huynh</h4>
        <div class="form-grid">
          <label>Tên PH <span class="req">*</span>
            <input name="parentName" [(ngModel)]="form.parentName" (ngModelChange)="onParentFieldsChanged()" required />
          </label>
          <label>SĐT <span class="req">*</span>
            <input name="parentPhone" [(ngModel)]="form.parentPhone" (ngModelChange)="onParentFieldsChanged()" required />
          </label>
          <label>Email
            <input name="parentEmail" [(ngModel)]="form.parentEmail" (ngModelChange)="onParentFieldsChanged()" />
          </label>
        </div>

        <h4>Thông tin học viên</h4>
        <div class="form-grid">
          <label>Tên HS <span class="req">*</span>
            <input name="studentName" [(ngModel)]="form.studentName" (ngModelChange)="onStudentFieldsChanged()" required />
          </label>
          <label>Lớp
            <input name="studentGrade" [(ngModel)]="form.studentGrade" (ngModelChange)="onStudentFieldsChanged()" />
          </label>
        </div>

        <h4>Sản phẩm</h4>
        <div *ngFor="let item of form.items; let i = index" class="item-row">
          <div class="form-grid">
            <label>Gói học <span class="req">*</span>
              <select [(ngModel)]="item.productId" [name]="'productId_'+i" (ngModelChange)="onProductSelect(item, $event)">
                <option value="">-- Chọn gói --</option>
                <option *ngFor="let p of products()" [value]="p._id">{{p.name}} ({{p.code}})</option>
              </select>
            </label>
            <label>Số buổi <span class="req">*</span>
              <input type="number" [(ngModel)]="item.sessions" [name]="'sessions_'+i" min="1" (ngModelChange)="calcItemAmount(item)" />
            </label>
            <label>Giá/buổi (đ) <span class="req">*</span>
              <input type="number" [(ngModel)]="item.pricePerSession" [name]="'price_'+i" min="0" (ngModelChange)="calcItemAmount(item)" />
            </label>
            <label>Thành tiền
              <input type="number" [value]="item.amount" disabled />
            </label>
            <label>Hình thức
              <select [(ngModel)]="item.teachingMode" [name]="'mode_'+i">
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
              </select>
            </label>
            <label>
              <button type="button" class="btn-sm danger" (click)="removeItem(i)" *ngIf="form.items.length > 1" style="margin-top:20px">Xóa</button>
            </label>
          </div>
        </div>
        <button type="button" class="btn-sm" (click)="addItem()" style="margin:8px 0">+ Thêm sản phẩm</button>

        <h4>Tổng kết</h4>
        <div class="form-grid">
          <label>Tổng tiền
            <input type="number" [value]="calcTotal()" disabled />
          </label>
          <label>Giảm giá (đ)
            <input type="number" name="discountAmount" [(ngModel)]="form.discountAmount" min="0" />
          </label>
          <label>Lý do giảm
            <input name="discountReason" [(ngModel)]="form.discountReason" />
          </label>
          <label>Thành tiền cuối
            <input type="number" [value]="calcFinal()" disabled class="final-amount" />
          </label>
        </div>

        <label class="full">Ghi chú tư vấn
          <textarea name="consultationNotes" [(ngModel)]="form.consultationNotes" rows="2"></textarea>
        </label>

        <div class="form-actions">
          <button type="submit" class="primary">{{editingId ? 'Cập nhật' : 'Tạo đơn (Nháp)'}}</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal Detail -->
  <div class="modal-backdrop" *ngIf="detailOrder()">
    <div class="modal wide">
      <div class="detail-header">
        <h3>{{detailOrder()!.orderCode}}</h3>
        <span class="badge lg" [style.background]="statusColor(detailOrder()!.status) + '20'" [style.color]="statusColor(detailOrder()!.status)">
          {{statusLabel(detailOrder()!.status)}}
        </span>
      </div>
      <div class="detail-grid">
        <div><strong>Loại:</strong> {{typeLabel(detailOrder()!.orderType)}}</div>
        <div><strong>Sale:</strong> {{detailOrder()!.saleName || '-'}}</div>
        <div><strong>PH:</strong> {{detailOrder()!.parentName}} — {{detailOrder()!.parentPhone}}</div>
        <div><strong>HS:</strong> {{detailOrder()!.studentName}} {{detailOrder()!.studentGrade ? '(Lớp ' + detailOrder()!.studentGrade + ')' : ''}}</div>
        <div><strong>Tổng tiền:</strong> {{detailOrder()!.finalAmount | number}}đ</div>
        <div><strong>Hoa hồng:</strong> {{detailOrder()!.saleCommission ? (detailOrder()!.saleCommission! | number) + 'đ' : '-'}}</div>
        <div><strong>Ngày tạo:</strong> {{detailOrder()!.createdAt | date:'dd/MM/yyyy HH:mm'}}</div>
        <div *ngIf="detailOrder()!.approvedAt"><strong>Ngày duyệt:</strong> {{detailOrder()!.approvedAt | date:'dd/MM/yyyy HH:mm'}}</div>
      </div>
      <div *ngIf="detailOrder()!.rejectionReason" class="reject-msg">Lý do từ chối: {{detailOrder()!.rejectionReason}}</div>
      <div *ngIf="detailOrder()!.needsInfoReason" class="info-msg">Cần bổ sung: {{detailOrder()!.needsInfoReason}}</div>
      <div *ngIf="detailOrder()!.consultationNotes"><strong>Ghi chú:</strong> {{detailOrder()!.consultationNotes}}</div>

      <h4>Sản phẩm ({{detailOrder()!.items.length}})</h4>
      <table class="data compact">
        <thead><tr><th>Gói</th><th>Số buổi</th><th>Giá/buổi</th><th>Thành tiền</th><th>HT</th></tr></thead>
        <tbody>
          <tr *ngFor="let item of detailOrder()!.items">
            <td>{{item.productName || item.productId}}</td>
            <td class="center">{{item.sessions}}</td>
            <td class="right">{{item.pricePerSession | number}}đ</td>
            <td class="right">{{item.amount | number}}đ</td>
            <td>{{item.teachingMode || '-'}}</td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="detailOrder()!.discountAmount" class="discount-row">
        Giảm giá: -{{detailOrder()!.discountAmount | number}}đ
        <span *ngIf="detailOrder()!.discountReason"> ({{detailOrder()!.discountReason}})</span>
      </div>

      <!-- Enrollment Results -->
      <div *ngIf="detailOrder()!.processedResults" class="enrollment-results">
        <h4>Kết quả xử lý tự động</h4>
        <div class="enrollment-grid">
          <div *ngIf="detailOrder()!.processedResults?.studentId" class="enrollment-item success-item">
            <span class="enrollment-icon">👤</span>
            <span>Học viên: <strong>{{detailOrder()!.processedResults.studentId}}</strong></span>
          </div>
          <div *ngIf="detailOrder()!.processedResults.invoiceIds?.length" class="enrollment-item success-item">
            <span class="enrollment-icon">🧾</span>
            <span>Hóa đơn tạo: <strong>{{detailOrder()!.processedResults.invoiceIds.length}}</strong></span>
          </div>
        </div>
      </div>

      <div *ngIf="communicationSummary()" class="handoff-box">
        <div class="handoff-header">
          <div>
            <h4>Thong tin ban giao</h4>
            <p>Copy nhanh noi dung de gui cho PH, GV hoac dung noi bo.</p>
          </div>
          <small *ngIf="communicationSummary()!.generatedAt">
            {{communicationSummary()!.generatedAt | date:'dd/MM/yyyy HH:mm'}}
          </small>
        </div>

        <div class="handoff-card" *ngIf="communicationSummary()!.saleMessage">
          <div class="handoff-card-head">
            <strong>Noi bo / Sale</strong>
            <button type="button" class="btn-sm" (click)="copyText(communicationSummary()!.saleMessage, 'Noi dung noi bo')">Copy</button>
          </div>
          <pre class="handoff-text">{{communicationSummary()!.saleMessage}}</pre>
        </div>

        <div class="handoff-card" *ngIf="communicationSummary()!.parentMessage">
          <div class="handoff-card-head">
            <strong>Gui phu huynh</strong>
            <button type="button" class="btn-sm" (click)="copyText(communicationSummary()!.parentMessage, 'Noi dung gui phu huynh')">Copy</button>
          </div>
          <pre class="handoff-text">{{communicationSummary()!.parentMessage}}</pre>
        </div>

        <div class="handoff-card" *ngIf="communicationSummary()!.teacherMessage">
          <div class="handoff-card-head">
            <strong>Gui giao vien</strong>
            <button type="button" class="btn-sm" (click)="copyText(communicationSummary()!.teacherMessage, 'Noi dung gui giao vien')">Copy</button>
          </div>
          <pre class="handoff-text">{{communicationSummary()!.teacherMessage}}</pre>
        </div>
      </div>

      <div class="form-actions">
        <button class="primary" *ngIf="detailOrder()!.status === 'DRAFT' || detailOrder()!.status === 'NEEDS_INFO'" (click)="openEdit(detailOrder()!)">Sửa</button>
        <button class="btn-sm" *ngIf="detailOrder()!.status === 'DRAFT' || detailOrder()!.status === 'NEEDS_INFO'" (click)="submitOrder(detailOrder()!)">Gửi duyệt</button>
        <button class="btn-sm success" *ngIf="detailOrder()!.status === 'SUBMITTED' && canApprove" (click)="approveOrder(detailOrder()!)">Duyệt</button>
        <button class="btn-sm" *ngIf="detailOrder()!.status === 'SUBMITTED' && canApprove" (click)="requestMoreInfo(detailOrder()!)">Can bo sung</button>
        <button class="btn-sm danger" *ngIf="detailOrder()!.status === 'SUBMITTED' && canApprove" (click)="rejectOrder(detailOrder()!)">Từ chối</button>
        <button class="btn-sm" *ngIf="!['COMPLETED','CANCELLED'].includes(detailOrder()!.status)" (click)="cancelOrder(detailOrder()!)">Hủy đơn</button>
        <button type="button" (click)="detailOrder.set(null)">Đóng</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .pipeline { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .pipe-card { background:#fff; padding:12px 16px; border-radius:8px; border-left:4px solid #e2e8f0; min-width:100px; }
    .pipe-count { font-size:24px; font-weight:700; }
    .pipe-label { font-size:12px; color:#64748b; }
    .pipe-value { font-size:11px; color:#059669; margin-top:2px; }
    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    .data.compact { font-size:12px; margin:8px 0; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .center { text-align:center; }
    .right { text-align:right; }
    .clickable { cursor:pointer; }
    .clickable:hover { background:#f8fafc; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .badge.lg { font-size:13px; padding:4px 12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .btn-sm { padding:4px 10px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:4px; }
    .btn-sm.success { color:#059669; border-color:#6ee7b7; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; }
    .actions-cell { white-space:nowrap; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:720px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal.wide { max-width:720px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .lookup-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-grid label, .full { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    .lookup-grid label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    .field-hint { color:#64748b; font-size:12px; }
    .link-warning { margin:8px 0 0; color:#b45309; font-size:12px; }
    .full { margin-top:8px; }
    .req { color:#dc2626; }
    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
    .error { color:#dc2626; font-size:13px; }
    .empty-text { padding:16px; color:#64748b; }
    .detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; margin-bottom:12px; }
    h4 { margin:16px 0 8px; color:#334155; font-size:14px; }
    .item-row { background:#f8fafc; padding:12px; border-radius:6px; margin-bottom:8px; }
    .final-amount { font-weight:700; color:#059669; }
    .reject-msg { background:#fef2f2; padding:8px 12px; border-radius:6px; color:#991b1b; margin:8px 0; font-size:13px; }
    .info-msg { background:#fef3c7; padding:8px 12px; border-radius:6px; color:#92400e; margin:8px 0; font-size:13px; }
    .discount-row { text-align:right; font-size:13px; color:#dc2626; margin:4px 0; }
    .enrollment-results { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px 16px; margin:12px 0; }
    .enrollment-grid { display:flex; gap:16px; flex-wrap:wrap; }
    .enrollment-item { display:flex; align-items:center; gap:6px; font-size:13px; padding:4px 8px; background:#fff; border-radius:4px; }
    .enrollment-item.success-item { border:1px solid #86efac; }
    .enrollment-icon { font-size:16px; }
    .handoff-box { background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 16px; margin-top:12px; }
    .handoff-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:10px; }
    .handoff-header h4 { margin:0 0 4px; }
    .handoff-header p { margin:0; font-size:12px; color:#475569; }
    .handoff-card { background:#fff; border:1px solid #dbeafe; border-radius:6px; padding:10px 12px; margin-top:10px; }
    .handoff-card-head { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; }
    .handoff-text { margin:0; white-space:pre-wrap; font-family:Consolas, 'Courier New', monospace; font-size:12px; line-height:1.5; color:#0f172a; }
    @media (max-width: 768px) {
      .form-grid, .lookup-grid, .detail-grid { grid-template-columns:1fr; }
      .form-actions { flex-wrap:wrap; }
      .handoff-header, .handoff-card-head { flex-direction:column; align-items:flex-start; }
    }
  `]
})
export class OrdersComponent implements OnInit {
  items = signal<OrderData[]>([]);
  pipeline = signal<OrderPipeline | null>(null);
  products = signal<ProductItem[]>([]);
  sales = signal<UserItem[]>([]);
  parents = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  showModal = signal(false);
  detailOrder = signal<OrderData | null>(null);
  error = signal('');
  editingId: string | null = null;

  keyword = '';
  filterStatus = '';
  filterType = '';

  canApprove = false;
  isSaleRole = false;
  currentUserId = '';
  currentUserName = '';
  parentLookup = '';
  studentLookup = '';

  form: any = this.emptyForm();

  pipelineStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED'];
  allStatuses = Object.keys(STATUS_LABELS);
  allTypes = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
  allSources = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));

  orderAdGroups = signal<AdGroupItem[]>([]);

  constructor(
    private orderService: OrderService,
    private productService: ProductService,
    private studentService: StudentService,
    private leadService: LeadService,
    private adsService: AdsService,
    private auth: AuthService,
    private userService: UserService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    const currentUser = this.auth.userSignal();
    const role = currentUser?.role;
    this.canApprove = role === Role.DIRECTOR || role === Role.OPS;
    this.isSaleRole = role === Role.SALE;
    this.currentUserId = currentUser?.sub || '';
    this.currentUserName = currentUser?.fullName || '';
    void this.loadLookups();
    void this.reload();

    // Check if navigated from lead conversion
    this.route.queryParams.subscribe(async params => {
      if (params['fromLead']) {
        const lead = await this.leadService.getOne(params['fromLead']);
        if (lead) {
          this.openCreate();
          this.form.parentName = lead.parentName;
          this.form.parentPhone = lead.parentPhone;
          this.form.parentEmail = lead.parentEmail || '';
          this.form.studentName = lead.studentName || '';
          this.form.studentGrade = lead.studentGrade || '';
          this.form.leadId = lead._id;
          this.form.leadSource = lead.source;
          this.form.saleId = lead.saleId || this.form.saleId;
          if ((lead as any).adGroupId) {
            this.form.adGroupId = (lead as any).adGroupId;
            this.form.adGroupName = (lead as any).adGroupName || '';
            this.form.adGroupFromLead = true;
            this.loadOrderAdGroups(lead.source);
          }
        }
      }

      if (params['orderId']) {
        const order = await this.orderService.getOne(params['orderId']);
        if (order) {
          this.detailOrder.set(order);
        }
      }
    });
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }
  typeLabel(s: string) { return TYPE_LABELS[s] || s; }
  communicationSummary(): OrderCommunicationSummary | null {
    return this.detailOrder()?.processedResults?.communicationSummary || null;
  }

  async copyText(value?: string, label = 'Noi dung') {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      alert(`${label} da duoc copy.`);
    } catch {
      prompt(`Copy ${label}:`, value);
    }
  }

  getPipeCount(s: string): number {
    const p = this.pipeline();
    return p && p[s] ? p[s].count : 0;
  }
  getPipeValue(s: string): number {
    const p = this.pipeline();
    return p && p[s] ? p[s].totalValue : 0;
  }

  emptyForm(): any {
    return {
      orderType: 'NEW_ENROLLMENT', parentName: '', parentPhone: '', parentEmail: '',
      parentUserId: '',
      studentName: '', studentGrade: '', existingStudentId: '',
      leadSource: '', leadId: '', saleId: this.isSaleRole ? this.currentUserId : '',
      adGroupId: '', adGroupName: '', adGroupFromLead: false,
      items: [this.emptyItem()],
      discountAmount: 0, discountReason: '', consultationNotes: '',
    };
  }

  async loadLookups() {
    const [products, parents, students, sales] = await Promise.all([
      this.productService.list(),
      this.userService.listParents(),
      this.studentService.list(),
      this.isSaleRole ? Promise.resolve([] as UserItem[]) : this.userService.listSales(),
    ]);
    this.products.set(products);
    this.parents.set(parents);
    this.students.set(students);
    this.sales.set(sales);
  }

  async onLeadSourceChange() {
    this.form.adGroupId = '';
    this.form.adGroupName = '';
    this.form.adGroupFromLead = false;
    await this.loadOrderAdGroups(this.form.leadSource);
  }

  async loadOrderAdGroups(platform: string) {
    if (['FACEBOOK', 'GOOGLE', 'TIKTOK'].includes(platform)) {
      try {
        const groups = await this.adsService.getGroupsByPlatform(platform);
        this.orderAdGroups.set(groups);
      } catch { this.orderAdGroups.set([]); }
    } else {
      this.orderAdGroups.set([]);
    }
  }

  onAdGroupChange() {
    const grp = this.orderAdGroups().find(g => g._id === this.form.adGroupId);
    this.form.adGroupName = grp?.name || '';
  }

  emptyItem() {
    return { productId: '', productName: '', sessions: 24, sessionDuration: 90, pricePerSession: 0, amount: 0, teachingMode: 'ONLINE', notes: '' };
  }

  normalizePhone(value?: string) {
    return (value || '').replace(/\D/g, '');
  }

  normalizeOptionalText(value: any): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  }

  normalizeOptionalId(value: any): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized || undefined;
  }

  filteredParents(): UserItem[] {
    const q = this.parentLookup.trim().toLowerCase();
    return this.parents()
      .filter((parent) => {
        if (!q) return true;
        return (parent.fullName || '').toLowerCase().includes(q)
          || (parent.phone || '').includes(q)
          || (parent.email || '').toLowerCase().includes(q);
      })
      .slice(0, 50);
  }

  filteredStudents(): StudentItem[] {
    const q = this.studentLookup.trim().toLowerCase();
    return this.students()
      .filter((student) => {
        if (!q) return true;
        return (student.studentCode || '').toLowerCase().includes(q)
          || (student.fullName || '').toLowerCase().includes(q)
          || (student.parentName || '').toLowerCase().includes(q)
          || (student.parentPhone || '').includes(q);
      })
      .slice(0, 50);
  }

  suggestedStudents(): StudentItem[] {
    const normalizedName = (this.form.studentName || '').trim().toLowerCase();
    const normalizedParentPhone = this.normalizePhone(this.form.parentPhone);
    if (!normalizedName && !normalizedParentPhone) {
      return [];
    }

    return this.students()
      .filter((student) => {
        const sameName = normalizedName && (student.fullName || '').trim().toLowerCase() === normalizedName;
        const sameParentPhone = normalizedParentPhone
          && this.normalizePhone(student.parentPhone) === normalizedParentPhone;
        return !!(sameName || sameParentPhone);
      })
      .slice(0, 5);
  }

  findParentById(id?: string | null): UserItem | undefined {
    if (!id) return undefined;
    return this.parents().find((parent) => parent._id === id);
  }

  findStudentById(id?: string | null): StudentItem | undefined {
    if (!id) return undefined;
    return this.students().find((student) => student._id === id);
  }

  formatParentOption(parent: UserItem): string {
    return `${parent.fullName} - ${parent.phone || parent.email || 'Khong co lien he'}`;
  }

  formatStudentOption(student: StudentItem): string {
    return `${student.studentCode} - ${student.fullName} - ${student.parentPhone || 'Khong co SDT PH'}`;
  }

  applyParentSelection(parent: UserItem | null) {
    if (!parent) {
      this.form.parentUserId = '';
      this.parentLookup = '';
      return;
    }

    this.form.parentUserId = parent._id;
    this.form.parentName = parent.fullName || this.form.parentName;
    this.form.parentPhone = parent.phone || this.form.parentPhone;
    this.form.parentEmail = parent.email || this.form.parentEmail;
    if (!this.isSaleRole && !this.form.leadId && !this.form.existingStudentId && parent.saleOwnerId) {
      this.form.saleId = parent.saleOwnerId;
    }
    this.parentLookup = this.formatParentOption(parent);
  }

  applyStudentSelection(student: StudentItem | null) {
    if (!student) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
      return;
    }

    this.form.existingStudentId = student._id;
    this.form.studentName = student.fullName || this.form.studentName;
    this.form.studentGrade = student.grade || this.form.studentGrade;
    this.studentLookup = this.formatStudentOption(student);

    const parent = student.parentUserId ? this.findParentById(student.parentUserId) : undefined;
    if (parent) {
      this.applyParentSelection(parent);
    } else {
      this.form.parentUserId = student.parentUserId || this.form.parentUserId || '';
      this.form.parentName = student.parentName || this.form.parentName;
      this.form.parentPhone = student.parentPhone || this.form.parentPhone;
    }

    if (!this.isSaleRole && !this.form.leadId && student.saleId) {
      this.form.saleId = student.saleId;
    }
  }

  onParentSelected(parentId: string) {
    const parent = this.findParentById(parentId);
    this.applyParentSelection(parent || null);

    if (!parent) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
      return;
    }

    const currentStudent = this.findStudentById(this.form.existingStudentId);
    if (parent && currentStudent?.parentUserId && currentStudent.parentUserId !== parent._id) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
    }
  }

  onExistingStudentSelected(studentId: string) {
    const student = this.findStudentById(studentId);
    this.applyStudentSelection(student || null);
  }

  onParentFieldsChanged() {
    const selectedParent = this.findParentById(this.form.parentUserId);
    if (selectedParent) {
      const sameName = (this.form.parentName || '').trim() === (selectedParent.fullName || '').trim();
      const samePhone = this.normalizePhone(this.form.parentPhone) === this.normalizePhone(selectedParent.phone);
      const sameEmail = (this.form.parentEmail || '').trim().toLowerCase() === (selectedParent.email || '').trim().toLowerCase();
      if (!sameName || !samePhone || !sameEmail) {
        this.form.parentUserId = '';
        this.parentLookup = '';
      }
    }

    const selectedStudent = this.findStudentById(this.form.existingStudentId);
    if (selectedStudent) {
      const sameParentName = (this.form.parentName || '').trim() === (selectedStudent.parentName || '').trim();
      const sameParentPhone = this.normalizePhone(this.form.parentPhone) === this.normalizePhone(selectedStudent.parentPhone);
      if (!sameParentName || !sameParentPhone) {
        this.form.existingStudentId = '';
        this.studentLookup = '';
      }
    }
  }

  onStudentFieldsChanged() {
    const selectedStudent = this.findStudentById(this.form.existingStudentId);
    if (!selectedStudent) return;

    const sameName = (this.form.studentName || '').trim() === (selectedStudent.fullName || '').trim();
    const sameGrade = (this.form.studentGrade || '').trim() === (selectedStudent.grade || '').trim();
    if (!sameName || !sameGrade) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
    }
  }

  syncLookupLabels() {
    const parent = this.findParentById(this.form.parentUserId);
    const student = this.findStudentById(this.form.existingStudentId);
    this.parentLookup = parent ? this.formatParentOption(parent) : '';
    this.studentLookup = student ? this.formatStudentOption(student) : '';
  }

  buildPayload() {
    return {
      orderType: this.form.orderType,
      parentName: (this.form.parentName || '').trim(),
      parentPhone: (this.form.parentPhone || '').trim(),
      ...(this.normalizeOptionalText(this.form.parentEmail) ? { parentEmail: this.normalizeOptionalText(this.form.parentEmail) } : {}),
      ...((this.editingId || this.normalizeOptionalId(this.form.parentUserId))
        ? { parentUserId: this.normalizeOptionalId(this.form.parentUserId) ?? '' }
        : {}),
      studentName: (this.form.studentName || '').trim(),
      ...(this.normalizeOptionalText(this.form.studentGrade) ? { studentGrade: this.normalizeOptionalText(this.form.studentGrade) } : {}),
      ...((this.editingId || this.normalizeOptionalId(this.form.existingStudentId))
        ? { existingStudentId: this.normalizeOptionalId(this.form.existingStudentId) ?? '' }
        : {}),
      ...(this.normalizeOptionalText(this.form.leadSource) ? { leadSource: this.normalizeOptionalText(this.form.leadSource) } : {}),
      ...(this.normalizeOptionalId(this.form.leadId) ? { leadId: this.normalizeOptionalId(this.form.leadId) } : {}),
      ...(this.normalizeOptionalId(this.form.saleId) ? { saleId: this.normalizeOptionalId(this.form.saleId) } : {}),
      ...(this.normalizeOptionalId(this.form.adGroupId) ? { adGroupId: this.normalizeOptionalId(this.form.adGroupId) } : {}),
      ...(this.normalizeOptionalText(this.form.adGroupName) ? { adGroupName: this.normalizeOptionalText(this.form.adGroupName) } : {}),
      items: (this.form.items || []).map((item: any) => ({
        productId: item.productId,
        ...(this.normalizeOptionalText(item.productName) ? { productName: this.normalizeOptionalText(item.productName) } : {}),
        sessions: Number(item.sessions || 0),
        sessionDuration: Number(item.sessionDuration || 0),
        pricePerSession: Number(item.pricePerSession || 0),
        amount: Number(item.amount || 0),
        teachingMode: item.teachingMode || 'ONLINE',
        ...(this.normalizeOptionalText(item.preferredSchedule) ? { preferredSchedule: this.normalizeOptionalText(item.preferredSchedule) } : {}),
        ...(this.normalizeOptionalId(item.preferredTeacherId) ? { preferredTeacherId: this.normalizeOptionalId(item.preferredTeacherId) } : {}),
        ...(this.normalizeOptionalText(item.notes) ? { notes: this.normalizeOptionalText(item.notes) } : {}),
      })),
      discountAmount: Number(this.form.discountAmount || 0),
      ...(this.normalizeOptionalText(this.form.discountReason) ? { discountReason: this.normalizeOptionalText(this.form.discountReason) } : {}),
      ...(this.normalizeOptionalText(this.form.consultationNotes) ? { consultationNotes: this.normalizeOptionalText(this.form.consultationNotes) } : {}),
      totalAmount: this.calcTotal(),
      finalAmount: this.calcFinal(),
    };
  }

  filtered = computed(() => {
    let list = this.items();
    const kw = this.keyword.trim().toLowerCase();
    if (kw) list = list.filter(o =>
      o.orderCode.toLowerCase().includes(kw) || o.studentName.toLowerCase().includes(kw) ||
      o.parentName.toLowerCase().includes(kw) || o.parentPhone.includes(kw));
    if (this.filterStatus) list = list.filter(o => o.status === this.filterStatus);
    if (this.filterType) list = list.filter(o => o.orderType === this.filterType);
    return list;
  });

  async reload() {
    const [items, pipeline] = await Promise.all([
      this.orderService.list(),
      this.orderService.getPipeline(),
    ]);
    this.items.set(items);
    this.pipeline.set(pipeline);
  }

  onProductSelect(item: any, productId: string) {
    const product = this.products().find(p => p._id === productId);
    if (product) {
      item.productName = product.name;
      item.sessions = product.defaultSessions || 24;
      item.sessionDuration = product.defaultSessionDuration || 90;
      item.pricePerSession = product.pricePerSession || 0;
      this.calcItemAmount(item);
    }
  }

  calcItemAmount(item: any) {
    item.amount = (item.sessions || 0) * (item.pricePerSession || 0);
  }

  calcTotal() {
    return (this.form.items || []).reduce((s: number, i: any) => s + (i.amount || 0), 0);
  }

  calcFinal() {
    return this.calcTotal() - (this.form.discountAmount || 0);
  }

  addItem() { this.form.items.push(this.emptyItem()); }
  removeItem(i: number) { this.form.items.splice(i, 1); }

  openCreate() {
    this.editingId = null;
    this.form = this.emptyForm();
    this.parentLookup = '';
    this.studentLookup = '';
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(o: OrderData) {
    this.editingId = o._id;
    this.form = {
      ...this.emptyForm(),
      ...o,
      parentUserId: o.parentUserId || '',
      existingStudentId: o.existingStudentId || '',
      items: o.items.map((i: any) => ({ ...i })),
    };
    this.syncLookupLabels();
    this.error.set('');
    this.detailOrder.set(null);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.parentLookup = '';
    this.studentLookup = '';
  }

  openDetail(o: OrderData) { this.detailOrder.set(o); }

  async submitForm() {
    const payload = this.buildPayload();

    if (this.editingId) {
      const res = await this.orderService.update(this.editingId, payload);
      if (!res.ok) { this.error.set(res.message || 'Lỗi'); return; }
    } else {
      const res = await this.orderService.create(payload);
      if (!res.ok) { this.error.set(res.message || 'Lỗi'); return; }
    }
    this.closeModal();
    await this.reload();
  }

  async submitOrder(o: OrderData) {
    if (!confirm(`Gửi duyệt đơn ${o.orderCode}?`)) return;
    const res = await this.orderService.submit(o._id);
    if (!res.ok) { alert(res.message); return; }
    this.detailOrder.set(null);
    await this.reload();
  }

  async approveOrder(o: OrderData) {
    if (!confirm(`Duyệt đơn ${o.orderCode} — ${o.studentName}?\n\nHệ thống sẽ tự động:\n• Tạo hồ sơ học viên\n• Tạo hóa đơn học phí\n\nXác nhận duyệt?`)) return;
    const res = await this.orderService.approve(o._id);
    if (!res.ok) { alert(res.message); return; }
    const updatedOrder = res.data?.order || await this.orderService.getOne(o._id);

    // Hiển thị kết quả enrollment
    if (res.data?.enrollment) {
      const e = res.data.enrollment;
      if (e.success) {
        alert(
          `✅ Đơn ${o.orderCode} đã duyệt & xử lý thành công!\n\n` +
          `📋 Mã học viên: ${e.studentCode}\n` +
          `🧾 Số hóa đơn tạo: ${e.invoiceIds?.length || 0}\n\n` +
          `Hóa đơn đang chờ duyệt thanh toán trong mục Hóa đơn.`
        );
      } else {
        alert(
          `⚠️ Đơn ${o.orderCode} đã duyệt nhưng có lỗi khi xử lý tự động:\n\n` +
          (e.errors || []).join('\n') +
          `\n\nVui lòng kiểm tra và xử lý thủ công.`
        );
      }
    }

    this.detailOrder.set(updatedOrder || null);
    await Promise.all([this.reload(), this.loadLookups()]);
  }

  async rejectOrder(o: OrderData) {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    const res = await this.orderService.reject(o._id, reason);
    if (!res.ok) { alert(res.message); return; }
    this.detailOrder.set(null);
    await this.reload();
  }

  async requestMoreInfo(o: OrderData) {
    const reason = prompt('Noi dung can bo sung:');
    if (!reason) return;
    const res = await this.orderService.requestInfo(o._id, reason);
    if (!res.ok) { alert(res.message); return; }
    this.detailOrder.set(null);
    await this.reload();
  }

  async cancelOrder(o: OrderData) {
    if (!confirm(`Hủy đơn ${o.orderCode}?`)) return;
    const res = await this.orderService.cancel(o._id);
    if (!res.ok) { alert(res.message); return; }
    this.detailOrder.set(null);
    await this.reload();
  }
}
