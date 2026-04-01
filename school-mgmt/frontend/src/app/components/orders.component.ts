import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { Role } from '../models/role.enum';
import { INVOICE_COURSE_STATUS_LABELS, InvoiceService } from '../services/invoice.service';
import { OrderCommunicationSummary, OrderData, OrderPipeline, OrderService } from '../services/order.service';
import { ProductItem, ProductService } from '../services/product.service';
import { LeadService } from '../services/lead.service';
import { AdGroupItem, AdsService } from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { StudentItem, StudentService } from '../services/student.service';
import { ClassItem, ClassService } from '../services/class.service';
import { environment } from '../../environments/environment';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Nháp', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', NEEDS_INFO: 'Cần bổ sung', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' };
const STATUS_COLORS: Record<string, string> = { DRAFT: '#64748b', SUBMITTED: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444', NEEDS_INFO: '#8b5cf6', COMPLETED: '#059669', CANCELLED: '#9ca3af' };
const TYPE_LABELS: Record<string, string> = { NEW_ENROLLMENT: 'Đăng ký mới', RENEWAL: 'Gia hạn', ADDITIONAL: 'Mua thêm', PACKAGE_CHANGE: 'Đổi gói' };
const SOURCE_LABELS: Record<string, string> = { FACEBOOK: 'Facebook', GOOGLE: 'Google', TIKTOK: 'TikTok', ZALO: 'Zalo', WEBSITE: 'Website', REFERRAL: 'Giới thiệu', WALK_IN: 'Đến trực tiếp', OTHER: 'Khác' };
const PAYMENT_PLAN_LABELS: Record<string, string> = { FULL: 'Thanh toán 1 lần', INSTALLMENT_2: 'Chia 2 đợt', INSTALLMENT_3: 'Chia 3 đợt' };

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="head">
    <div><h2>Đơn đăng ký học</h2><p>Nhập nhanh tài khoản phụ huynh, học sinh, lớp và hóa đơn ngay trong order.</p></div>
    <button class="primary" (click)="openCreate()">+ Tạo đơn</button>
  </header>
  <app-flow-guide featureKey="orders"></app-flow-guide>

  <section class="pipeline" *ngIf="pipeline()">
    <div class="pipe" *ngFor="let s of pipelineStatuses" [style.borderLeftColor]="statusColor(s)">
      <strong>{{ getPipeCount(s) }}</strong><span>{{ statusLabel(s) }}</span><small>{{ getPipeValue(s) | number }}d</small>
    </div>
  </section>

  <section class="filters">
    <input [(ngModel)]="keyword" placeholder="Tìm mã đơn, học sinh, phụ huynh..." />
    <select [(ngModel)]="filterStatus"><option value="">Tất cả trạng thái</option><option *ngFor="let s of allStatuses" [value]="s">{{ statusLabel(s) }}</option></select>
    <select [(ngModel)]="filterType"><option value="">Tất cả loại</option><option *ngFor="let t of allTypes" [value]="t.value">{{ t.label }}</option></select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr><th>Mã đơn</th><th>Loại</th><th>Học sinh</th><th>Phụ huynh</th><th>Giá tiền khóa học</th><th>Số tiền hóa đơn</th><th>Trạng thái</th><th>Sale</th><th></th></tr></thead>
    <tbody>
      <tr *ngFor="let o of filtered()" (click)="openDetail(o)" class="click">
        <td><code>{{ o.orderCode }}</code></td>
        <td>{{ typeLabel(o.orderType) }}</td>
        <td>{{ o.studentName }}<div class="muted" *ngIf="o.studentCode">{{ o.studentCode }}</div></td>
        <td>{{ o.parentName }}<div class="muted">{{ o.parentPhone }}</div></td>
        <td class="right">{{ orderCoursePrice(o) | number }}d</td>
        <td class="right">{{ orderInvoiceAmount(o) | number }}d</td>
        <td><span class="badge" [style.background]="statusColor(o.status)+'20'" [style.color]="statusColor(o.status)">{{ statusLabel(o.status) }}</span></td>
        <td>{{ o.saleName || '-' }}</td>
        <td (click)="$event.stopPropagation()">
          <button class="btn-sm" *ngIf="canEdit(o)" (click)="openEdit(o)">Sửa</button>
          <button class="btn-sm" *ngIf="canSubmit(o)" (click)="submitOrder(o)">Gửi</button>
          <button class="btn-sm" *ngIf="canApproveOrder(o)" (click)="openApproveOrderModal(o)">Duyệt</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty">Chưa có đơn nào.</p></ng-template>

  <div class="backdrop" *ngIf="showModal()">
    <div class="modal wide">
      <h3>{{ editingId ? 'Cập nhật đơn' : 'Tạo đơn đăng ký' }}</h3>
      <form (ngSubmit)="submitForm()">
        <div class="grid">
          <label>Loại đơn<select name="orderType" [(ngModel)]="form.orderType" required><option *ngFor="let t of allTypes" [value]="t.value">{{ t.label }}</option></select></label>
          <label>Nguồn<select name="leadSource" [(ngModel)]="form.leadSource" (ngModelChange)="onLeadSourceChange()"><option value="">--</option><option *ngFor="let s of allSources" [value]="s.value">{{ s.label }}</option></select></label>
          <label *ngIf="['FACEBOOK','GOOGLE','TIKTOK'].includes(form.leadSource)">Nhóm QC<select name="adGroupId" [(ngModel)]="form.adGroupId" (ngModelChange)="onAdGroupChange()" [disabled]="form.leadId && form.adGroupFromLead"><option value="">--</option><option *ngFor="let g of orderAdGroups()" [value]="g._id">{{ g.name }}</option></select></label>
          <label *ngIf="!isSaleRole">Sale phụ trách<select name="saleId" [(ngModel)]="form.saleId"><option value="">-- Tự suy từ dữ liệu liên kết --</option><option *ngFor="let sale of sales()" [value]="sale._id">{{ sale.fullName }}</option></select></label>
        </div>

        <h4>Liên kết hệ thống</h4>
        <div class="grid two">
          <div class="stack-field">
            <label>Phụ huynh đã có<input name="parentLookup" [(ngModel)]="parentLookup" placeholder="Tìm tên, SĐT, email..." /><select name="parentUserId" [ngModel]="form.parentUserId || ''" (ngModelChange)="onParentSelected($event)"><option value="">-- Không liên kết --</option><option *ngFor="let p of filteredParents()" [value]="p._id">{{ formatParentOption(p) }}</option></select></label>
            <div class="inline-actions"><button type="button" class="btn-sm" (click)="startNewParent()">+ Tạo mới PH</button><span class="muted">Tài khoản PH mới mặc định mật khẩu 123456</span></div>
          </div>
          <div class="stack-field">
            <label>Học sinh đã có<input name="studentLookup" [(ngModel)]="studentLookup" placeholder="Tìm mã HS, tên..." /><select name="existingStudentId" [ngModel]="form.existingStudentId || ''" (ngModelChange)="onExistingStudentSelected($event)"><option value="">-- Không liên kết --</option><option *ngFor="let s of filteredStudents()" [value]="s._id">{{ formatStudentOption(s) }}</option></select></label>
            <div class="inline-actions"><button type="button" class="btn-sm" (click)="startNewStudent()">+ Tạo mới HS</button></div>
          </div>
        </div>

        <h4>Thông tin phụ huynh</h4>
        <div class="grid">
          <label>Tên PH<input name="parentName" [(ngModel)]="form.parentName" (ngModelChange)="onParentFieldsChanged()" required /></label>
          <label>SĐT<input name="parentPhone" [(ngModel)]="form.parentPhone" (ngModelChange)="onParentFieldsChanged()" required /></label>
          <label>Email<input name="parentEmail" [(ngModel)]="form.parentEmail" (ngModelChange)="onParentFieldsChanged()" /></label>
          <label>Mã tài khoản<input name="parentUserCode" [(ngModel)]="form.parentUserCode" (ngModelChange)="onParentFieldsChanged()" /></label>
          <label>Địa chỉ<input name="parentAddress" [(ngModel)]="form.parentAddress" /></label>
          <label>Facebook<input name="parentFacebookLink" [(ngModel)]="form.parentFacebookLink" /></label>
        </div>
        <p class="muted">Nếu không liên kết phụ huynh có sẵn, order sẽ tự tạo tài khoản PH mới với mật khẩu 123456 khi duyệt.</p>

        <h4>Thông tin học sinh</h4>
        <div class="grid">
          <label>Mã HS<input name="studentCode" [(ngModel)]="form.studentCode" (ngModelChange)="onStudentFieldsChanged()" placeholder="Để trống để hệ thống tự sinh" /></label>
          <label>Tên HS<input name="studentName" [(ngModel)]="form.studentName" (ngModelChange)="onStudentFieldsChanged()" required /></label>
          <label>Tuổi<input type="number" name="studentAge" [(ngModel)]="form.studentAge" min="3" max="25" (ngModelChange)="onStudentFieldsChanged()" /></label>
          <label>Level<input name="studentLevel" [(ngModel)]="form.studentLevel" (ngModelChange)="onStudentFieldsChanged()" placeholder="VD: Starter, Movers..." /></label>
          <label>Ngày sinh<input type="date" name="studentDob" [(ngModel)]="form.studentDob" /></label>
          <label>Tháng sinh HS<input type="number" name="studentBirthMonth" [(ngModel)]="form.studentBirthMonth" min="1" max="12" /></label>
          <label>Tháng sinh PH<input type="number" name="parentBirthMonth" [(ngModel)]="form.parentBirthMonth" min="1" max="12" /></label>
        </div>
        <p class="muted">Nếu không nhập mã HS, hệ thống sẽ tự sinh khi duyệt order.</p>
        <div class="upload"><input type="file" accept="image/*" (change)="uploadStudentFace($event)" /><span *ngIf="isUploadingStudentFace()">Đang tải ảnh HS...</span><span *ngIf="!isUploadingStudentFace() && form.studentFaceImage">Đã có ảnh HS</span><button type="button" class="btn-sm" *ngIf="form.studentFaceImage" (click)="form.studentFaceImage = ''">Xóa ảnh</button></div>

        <h4>Sản phẩm</h4>
        <div class="item" *ngFor="let item of form.items; let i = index">
          <div class="grid">
            <label>Gói học<select [(ngModel)]="item.productId" [name]="'productId_'+i" (ngModelChange)="onProductSelect(item, $event)" required><option value="">-- Chọn --</option><option *ngFor="let p of products()" [value]="p._id">{{ p.name }}</option></select></label>
            <label>Môn học<input [(ngModel)]="item.subject" [name]="'subject_'+i" placeholder="VD: Toán, Tiếng Anh..." /></label>
            <label>Số buổi KH<input type="number" [(ngModel)]="item.sessions" [name]="'sessions_'+i" min="1" /></label>
            <label>Số tiền gói<input type="number" [value]="productSuggestedPrice(item)" disabled /></label>
            <label>Thời lượng cơ sở<input type="number" [(ngModel)]="item.baseDuration" [name]="'baseDuration_'+i" min="15" (ngModelChange)="calcItemAmount(item)" /></label>
            <label>Thời lượng<input type="number" [(ngModel)]="item.sessionDuration" [name]="'duration_'+i" min="15" (ngModelChange)="calcItemAmount(item)" /></label>
            <label>Giá cơ sở/buổi<input type="number" [(ngModel)]="item.pricePerSession" [name]="'price_'+i" min="0" (ngModelChange)="calcItemAmount(item)" /></label>
            <label>Hình thức<select [(ngModel)]="item.teachingMode" [name]="'mode_'+i"><option value="ONLINE">ONLINE</option><option value="OFFLINE">OFFLINE</option></select></label>
            <label>Buổi tặng<input type="number" [(ngModel)]="item.bonusSessions" [name]="'bonus_'+i" min="0" /></label>
            <label>Học thử<input type="number" [(ngModel)]="item.trialSessions" [name]="'trial_'+i" min="0" /></label>
            <label>Trạng thái<select [(ngModel)]="item.courseStatus" [name]="'course_'+i"><option value="">-- Tự động --</option><option *ngFor="let s of allCourseStatuses" [value]="s.value">{{ s.label }}</option></select></label>
            <label>Lớp dự kiến<select [(ngModel)]="item.selectedClassId" [name]="'class_'+i" (ngModelChange)="onSelectedClassChange(item, $event)"><option value="">-- Tạo lớp mới / để sau --</option><option *ngFor="let c of classOptionsForItem(item)" [value]="c._id">{{ formatClassOption(c) }}</option></select></label>
            <label>Giáo viên dự kiến<select [(ngModel)]="item.preferredTeacherId" [name]="'teacher_'+i" [disabled]="!!item.selectedClassId"><option value="">--</option><option *ngFor="let t of teachers()" [value]="t._id">{{ t.fullName }}</option></select></label>
            <label *ngIf="item.teachingMode === 'ONLINE'">Lương GV/buổi<input type="number" [(ngModel)]="item.teacherPayPerSession" [name]="'teacherPaySession_'+i" min="0" /></label>
            <label *ngIf="item.teachingMode === 'OFFLINE'">Lương GV/HS/buổi<input type="number" [(ngModel)]="item.teacherPayPerStudent" [name]="'teacherPayStudent_'+i" min="0" /></label>
            <label>Sĩ số tối đa<input type="number" [(ngModel)]="item.maxStudents" [name]="'maxStudents_'+i" min="1" placeholder="Bỏ trống = không giới hạn" /></label>
            <label>Lịch mong muốn<input [(ngModel)]="item.preferredSchedule" [name]="'schedule_'+i" /></label>
            <label>Ghi chú<input [(ngModel)]="item.notes" [name]="'notes_'+i" /></label>
            <label class="full-span">Mục tiêu học<textarea [(ngModel)]="item.learningGoals" [name]="'learningGoals_'+i" rows="2" placeholder="Mục tiêu học / yêu cầu lớp"></textarea></label>
            <label class="full-span">Mô tả hóa đơn<textarea [(ngModel)]="item.invoiceDescription" [name]="'invoiceDescription_'+i" rows="2" placeholder="Nội dung hiển thị trên hóa đơn nếu cần"></textarea></label>
          </div>
          <button type="button" class="btn-sm" *ngIf="form.items.length > 1" (click)="removeItem(i)">Xóa item</button>
        </div>
        <button type="button" class="btn-sm" (click)="addItem()">+ Thêm sản phẩm</button>

        <h4>Hóa đơn chờ duyệt</h4>
        <div class="grid">
          <label>Kế hoạch<select name="paymentPlan" [(ngModel)]="form.paymentPlan"><option *ngFor="let p of allPaymentPlans" [value]="p.value">{{ p.label }}</option></select></label>
          <label>Ngày thanh toán<input type="date" name="paymentDate" [(ngModel)]="form.paymentDate" /></label>
          <label>Hoa hồng sale<input type="number" name="saleCommission" [(ngModel)]="form.saleCommission" min="0" /></label>
        </div>
        <p class="muted section-note">Mỗi sản phẩm sẽ tạo một hóa đơn chờ duyệt. Số buổi HĐ, số hóa đơn và số tiền được nhập tại đây.</p>
        <div class="invoice-list">
          <div class="invoice-card" *ngFor="let item of form.items; let i = index">
            <div class="invoice-card-head">
              <div>
                <strong>Hóa đơn {{ i + 1 }}</strong>
                <div class="muted invoice-subtitle">{{ invoiceItemLabel(item, i) }}</div>
              </div>
              <button type="button" class="btn-sm" (click)="resetInvoiceAmount(item)">Tính lại tiền</button>
            </div>
            <div class="grid">
              <label>Tiền hóa đơn<input type="number" [(ngModel)]="item.amount" [name]="'invoiceAmount_'+i" min="0" (ngModelChange)="markInvoiceAmountEdited(item)" (blur)="normalizeInvoiceAmount(item)" /></label>
              <label>Số buổi HĐ<input type="number" [(ngModel)]="item.invoiceSessions" [name]="'invoiceSessions_'+i" min="0" (ngModelChange)="calcItemAmount(item)" (blur)="normalizeInvoiceSessions(item)" /></label>
              <label>Số hóa đơn<input [(ngModel)]="item.invoiceNumber" [name]="'invoiceNumber_'+i" placeholder="VD: HD20260001" /></label>
              <label>Lần TT<input type="number" [(ngModel)]="item.paymentRound" [name]="'paymentRound_'+i" min="1" placeholder="Để trống để tự động" /></label>
            </div>
          </div>
        </div>
        <div class="upload"><input type="file" accept="image/*" (change)="uploadReceipt($event)" /><span *ngIf="isUploadingReceipt()">Đang tải chứng từ...</span><span *ngIf="!isUploadingReceipt() && form.receiptImage">Đã có chứng từ</span><button type="button" class="btn-sm" *ngIf="form.receiptImage" (click)="form.receiptImage = ''">Xóa chứng từ</button></div>

        <h4>Tổng kết</h4>
        <div class="grid"><label>Tổng tiền<input type="number" [value]="calcTotal()" disabled /></label><label>Giảm giá<input type="number" name="discountAmount" [(ngModel)]="form.discountAmount" min="0" /></label><label>Lý do giảm<input name="discountReason" [(ngModel)]="form.discountReason" /></label><label>Thành tiền cuối<input type="number" [value]="calcFinal()" disabled /></label></div>
        <label>Ghi chú tư vấn<textarea name="consultationNotes" [(ngModel)]="form.consultationNotes" rows="3"></textarea></label>
        <div class="actions"><button type="submit" class="primary">{{ editingId ? 'Cập nhật' : 'Tạo đơn nháp' }}</button><button type="button" (click)="closeModal()">Hủy</button></div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </div>
  </div>

  <div class="backdrop" *ngIf="detailOrder() as o">
    <div class="modal wide">
      <div class="detail-head"><h3>{{ o.orderCode }}</h3><span class="badge" [style.background]="statusColor(o.status)+'20'" [style.color]="statusColor(o.status)">{{ statusLabel(o.status) }}</span></div>
      <div class="grid two">
        <div><strong>Phụ huynh:</strong> {{ o.parentName }} - {{ o.parentPhone }}</div><div><strong>Mã PH:</strong> {{ o.parentUserCode || '-' }}</div>
        <div><strong>Học sinh:</strong> {{ o.studentName }}</div><div><strong>Mã HS:</strong> {{ o.studentCode || '-' }}</div>
        <div><strong>Level:</strong> {{ o.studentLevel || '-' }}</div><div><strong>Tuổi:</strong> {{ o.studentAge || '-' }}</div>
        <div><strong>Ngày TT:</strong> {{ o.paymentDate ? (o.paymentDate | date:'yyyy-MM-dd') : '-' }}</div><div><strong>Kế hoạch TT:</strong> {{ paymentPlanLabel(o.paymentPlan) }}</div>
        <div><strong>Giá tiền khóa học:</strong> {{ orderCoursePrice(o) | number }}d</div><div><strong>Số tiền hóa đơn:</strong> {{ orderInvoiceAmount(o) | number }}d</div>
        <div><strong>Chứng từ:</strong>
          <span *ngIf="o.receiptImage"><img [src]="getImageUrl(o.receiptImage)" alt="Chứng từ" class="receipt-thumb" (click)="showImageModal(getImageUrl(o.receiptImage))" /> HD sale</span>
          <span *ngIf="!o.receiptImage">Chưa có</span>
          <span *ngIf="o.approvalImage" style="margin-left:8px"><img [src]="getImageUrl(o.approvalImage)" alt="HD đối ứng" class="receipt-thumb" (click)="showImageModal(getImageUrl(o.approvalImage))" /> HD đối ứng</span>
        </div><div><strong>PH tạo mới:</strong> mật khẩu 123456</div>
      </div>
      <div class="detail-items" *ngIf="o.items?.length">
        <div class="item" *ngFor="let item of o.items; let i = index">
          <div class="grid">
            <div><strong>Item {{ i + 1 }}:</strong> {{ item.productName || item.productId }}</div>
            <div><strong>Môn học:</strong> {{ item.subject || '-' }}</div>
            <div><strong>Lớp dự kiến:</strong> {{ classLabel(item.selectedClassId) }}</div>
            <div><strong>Giáo viên dự kiến:</strong> {{ teacherLabel(item.preferredTeacherId) }}</div>
            <div><strong>Số hóa đơn:</strong> {{ item.invoiceNumber || 'Tự động' }}</div>
            <div><strong>Lần TT:</strong> {{ item.paymentRound || 'Tự động' }}</div>
            <div><strong>Trạng thái khóa học:</strong> {{ courseStatusLabel(item.courseStatus) }}</div>
            <div><strong>Số buổi KH:</strong> {{ item.sessions || 0 }}</div>
            <div><strong>Số buổi HĐ:</strong> {{ displayInvoiceSessions(item) }} + {{ item.bonusSessions || 0 }} tặng + {{ item.trialSessions || 0 }} học thử</div>
            <div><strong>Số tiền gói:</strong> {{ productSuggestedPrice(item) | number }}d</div>
            <div><strong>Hình thức:</strong> {{ item.teachingMode || '-' }}</div>
            <div><strong>Thời lượng:</strong> {{ item.baseDuration || item.sessionDuration || '-' }} / {{ item.sessionDuration || '-' }} phút</div>
            <div><strong>Giá cơ sở:</strong> {{ (item.pricePerSession || 0) | number }}d</div>
            <div><strong>Lương GV:</strong> {{ teacherPayLabelForItem(item) }}</div>
            <div><strong>Sĩ số tối đa:</strong> {{ item.maxStudents || '-' }}</div>
            <div><strong>Lịch:</strong> {{ item.preferredSchedule || '-' }}</div>
            <div><strong>Ghi chú:</strong> {{ item.notes || '-' }}</div>
            <div class="full-span"><strong>Mục tiêu học:</strong> {{ item.learningGoals || '-' }}</div>
            <div class="full-span"><strong>Mô tả hóa đơn:</strong> {{ item.invoiceDescription || '-' }}</div>
          </div>
        </div>
      </div>
      <p class="muted" *ngIf="o.processedResults">Invoice: {{ o.processedResults.invoiceIds?.length || 0 }} | Lớp: {{ o.processedResults.classIds?.length || 0 }}</p>
      <p class="muted" *ngIf="o.consultationNotes">{{ o.consultationNotes }}</p>
      <div class="summary-box" *ngIf="communicationSummary() as summary"><pre *ngIf="summary.saleMessage">{{ summary.saleMessage }}</pre><pre *ngIf="summary.parentMessage">{{ summary.parentMessage }}</pre><pre *ngIf="summary.teacherMessage">{{ summary.teacherMessage }}</pre></div>
      <div class="actions"><button class="btn-sm" *ngIf="canEdit(o)" (click)="openEdit(o)">Sửa</button><button class="btn-sm" *ngIf="canSubmit(o)" (click)="submitOrder(o)">Gửi duyệt</button><button class="btn-sm" *ngIf="canApproveOrder(o)" (click)="openApproveOrderModal(o)">Duyệt</button><button class="btn-sm" *ngIf="canApproveOrder(o)" (click)="requestMoreInfo(o)">Cần bổ sung</button><button class="btn-sm" *ngIf="canApproveOrder(o)" (click)="rejectOrder(o)">Từ chối</button><button class="btn-sm" *ngIf="canCancel(o)" (click)="cancelOrder(o)">Hủy đơn</button><button type="button" (click)="detailOrder.set(null)">Đóng</button></div>
    </div>
  </div>

  <div class="backdrop" *ngIf="showApproveOrderModal()">
    <div class="modal">
      <h3>Xác nhận duyệt đơn</h3>
      <p *ngIf="approvingOrder() as ao">Đơn <strong>{{ ao.orderCode }}</strong> - {{ ao.studentName }} - <strong>{{ ao.finalAmount | number }}d</strong></p>
      <div *ngIf="approvingOrder() as ao">
        <div class="proof-compare">
          <div class="proof-panel">
            <span class="proof-label">Hóa đơn sale upload</span>
            <img *ngIf="ao.receiptImage" [src]="getImageUrl(ao.receiptImage)" alt="Hóa đơn sale" class="preview" (click)="showImageModal(getImageUrl(ao.receiptImage))" />
            <p *ngIf="!ao.receiptImage && requiresApprovalProof(ao)" class="muted">Chưa có hóa đơn sale upload.</p>
            <p *ngIf="!ao.receiptImage && !requiresApprovalProof(ao)" class="muted">Đơn học thử offline 0đ, không bắt buộc upload hóa đơn sale.</p>
          </div>
        </div>
        <label>Hóa đơn đối ứng
          <span class="muted" *ngIf="requiresApprovalProof(ao)">Hóa đơn đối ứng do người duyệt upload để đối chiếu.</span>
          <span class="muted" *ngIf="!requiresApprovalProof(ao)">Đơn học thử offline 0đ, ảnh đối ứng không bắt buộc.</span>
          <input type="file" accept="image/*" (change)="handleOrderApproveImageChange($event)" />
        </label>
        <div *ngIf="orderApproveUploading()">Đang tải ảnh...</div>
        <div *ngIf="orderApproveError()" class="error">{{ orderApproveError() }}</div>
        <img *ngIf="orderApproveImage && !orderApproveUploading()" [src]="getImageUrl(orderApproveImage)" alt="HD đối ứng" class="preview" />
      </div>
      <div class="actions">
        <button class="primary" [disabled]="orderApproveUploading()" (click)="confirmApproveOrder()">Duyệt đơn</button>
        <button type="button" (click)="closeApproveOrderModal()">Hủy</button>
      </div>
    </div>
  </div>

  <div class="backdrop" *ngIf="modalImage()" (click)="closeImageModal()">
    <div class="image-modal"><span class="close" (click)="closeImageModal()">&times;</span><img [src]="modalImage()" alt="Ảnh" /></div>
  </div>
  `,
  styles: [`
    .head,.actions,.detail-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.head{padding:16px}.head p,.muted,.pipe small{color:#64748b}
    .pipeline{display:flex;gap:12px;padding:0 16px 16px;flex-wrap:wrap}.pipe{background:#fff;border-left:4px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;flex-direction:column;min-width:120px}
    .filters,.grid{display:grid;gap:10px}.filters{grid-template-columns:2fr 1fr 1fr auto;padding:0 16px 16px}.grid{grid-template-columns:repeat(4,minmax(0,1fr))}.grid.two{grid-template-columns:repeat(2,minmax(0,1fr))}
    .data{width:calc(100% - 32px);margin:0 16px 16px;border-collapse:collapse;background:#fff}.data th,.data td{padding:10px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}.right{text-align:right}.click{cursor:pointer}
    .badge{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:600}.primary,.btn-sm{border-radius:8px;cursor:pointer}.primary{background:#0f766e;color:#fff;border:none;padding:10px 14px}.btn-sm{border:1px solid #cbd5e1;background:#fff;padding:6px 10px}
    .empty{padding:16px;color:#64748b}.backdrop{position:fixed;inset:0;background:rgba(15,23,42,.35);overflow:auto;padding:24px;z-index:10}.modal{background:#fff;border-radius:12px;padding:20px;margin:auto;max-width:1200px}.wide{width:min(1200px,100%)}
    label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:#334155}input,select,textarea{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}textarea{resize:vertical}
    h4{margin:16px 0 10px}.upload{display:flex;gap:10px;align-items:center;margin:10px 0;flex-wrap:wrap}.item,.invoice-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px;background:#f8fafc}.summary-box pre{white-space:pre-wrap;font-family:Consolas,'Courier New',monospace;font-size:12px}
    .stack-field{display:flex;flex-direction:column;gap:8px}.inline-actions,.invoice-card-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.invoice-card-head{justify-content:space-between;margin-bottom:10px}.invoice-subtitle{margin-top:4px}.section-note{margin:0 0 10px}.invoice-list{display:flex;flex-direction:column;gap:10px;margin-bottom:10px}.detail-items{margin:12px 0}.full-span{grid-column:1 / -1}
    .error{color:#dc2626;margin-top:10px}
    .receipt-thumb{width:48px;height:48px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0}
    .preview{max-width:300px;max-height:200px;border-radius:8px;margin-top:8px;border:1px solid #e2e8f0}
    .proof-compare{margin:12px 0}.proof-panel{margin-bottom:8px}.proof-label{font-weight:600;font-size:12px;color:#64748b;display:block;margin-bottom:4px}
    .image-modal{text-align:center;padding:20px}.image-modal img{max-width:90vw;max-height:85vh;border-radius:8px}.close{position:absolute;top:10px;right:20px;font-size:28px;color:#fff;cursor:pointer}
    @media (max-width:900px){.filters,.grid,.grid.two{grid-template-columns:1fr}}
  `],
})
export class OrdersComponent implements OnInit {
  items = signal<OrderData[]>([]);
  pipeline = signal<OrderPipeline | null>(null);
  products = signal<ProductItem[]>([]);
  classes = signal<ClassItem[]>([]);
  sales = signal<UserItem[]>([]);
  teachers = signal<UserItem[]>([]);
  parents = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  showModal = signal(false);
  detailOrder = signal<OrderData | null>(null);
  error = signal('');
  isUploadingStudentFace = signal(false);
  isUploadingReceipt = signal(false);
  showApproveOrderModal = signal(false);
  approvingOrder = signal<OrderData | null>(null);
  orderApproveUploading = signal(false);
  orderApproveError = signal('');
  orderApproveImage = '';
  modalImage = signal<string | null>(null);
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
  form: any = {};
  pipelineStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED'];
  allStatuses = Object.keys(STATUS_LABELS);
  allTypes = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
  allSources = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));
  allPaymentPlans = Object.entries(PAYMENT_PLAN_LABELS).map(([value, label]) => ({ value, label }));
  allCourseStatuses = Object.entries(INVOICE_COURSE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  orderAdGroups = signal<AdGroupItem[]>([]);

  constructor(
    private orderService: OrderService,
    private invoiceService: InvoiceService,
    private productService: ProductService,
    private studentService: StudentService,
    private leadService: LeadService,
    private adsService: AdsService,
    private auth: AuthService,
    private userService: UserService,
    private classService: ClassService,
    private route: ActivatedRoute,
  ) {
    this.form = this.emptyForm();
  }

  ngOnInit() {
    const user = this.auth.userSignal();
    this.canApprove = user?.role === Role.DIRECTOR || user?.role === Role.OPS;
    this.isSaleRole = user?.role === Role.SALE;
    this.currentUserId = user?.sub || '';
    this.currentUserName = user?.fullName || '';
    void this.loadLookups();
    void this.reload();
    this.route.queryParams.subscribe(async (params) => {
      if (params['fromLead']) {
        const lead = await this.leadService.getOne(params['fromLead']);
        if (lead) {
          this.openCreate();
          this.form.parentName = lead.parentName;
          this.form.parentPhone = lead.parentPhone;
          this.form.parentEmail = lead.parentEmail || '';
          this.form.studentName = lead.studentName || '';
          this.form.leadId = lead._id;
          this.form.leadSource = lead.source;
          this.form.saleId = lead.saleId || this.form.saleId;
          if ((lead as any).adGroupId) {
            this.form.adGroupId = (lead as any).adGroupId;
            this.form.adGroupName = (lead as any).adGroupName || '';
            this.form.adGroupFromLead = true;
            void this.loadOrderAdGroups(lead.source);
          }
        }
      }
      if (params['orderId']) {
        const order = await this.orderService.getOne(params['orderId']);
        if (order) this.detailOrder.set(order);
      }
    });
  }

  statusLabel(v: string) { return STATUS_LABELS[v] || v; }
  statusColor(v: string) { return STATUS_COLORS[v] || '#64748b'; }
  typeLabel(v: string) { return TYPE_LABELS[v] || v; }
  paymentPlanLabel(v?: string) { return PAYMENT_PLAN_LABELS[v || ''] || '-'; }
  courseStatusLabel(v?: string) {
    return v ? ((INVOICE_COURSE_STATUS_LABELS as Record<string, string>)[v] || v) : 'Tự động';
  }
  communicationSummary(): OrderCommunicationSummary | null { return this.detailOrder()?.processedResults?.communicationSummary || null; }
  getPipeCount(s: string) { return this.pipeline()?.[s]?.count || 0; }
  getPipeValue(s: string) { return this.pipeline()?.[s]?.totalValue || 0; }
  emptyForm() { return { orderType: 'NEW_ENROLLMENT', parentName: '', parentPhone: '', parentEmail: '', parentUserId: '', parentUserCode: '', parentAddress: '', parentFacebookLink: '', studentName: '', studentCode: '', studentLevel: '', studentDob: '', studentAge: null, studentBirthMonth: null, parentBirthMonth: null, studentFaceImage: '', existingStudentId: '', leadSource: '', leadId: '', saleId: this.isSaleRole ? this.currentUserId : '', adGroupId: '', adGroupName: '', adGroupFromLead: false, paymentPlan: 'FULL', paymentDate: '', receiptImage: '', saleCommission: 0, items: [this.buildFormItem()], discountAmount: 0, discountReason: '', consultationNotes: '' }; }
  emptyItem() { return { productId: '', productName: '', sessions: 24, invoiceSessions: 24, sessionDuration: 90, baseDuration: 90, pricePerSession: 0, amount: 0, bonusSessions: 0, trialSessions: 0, courseStatus: '', teachingMode: 'ONLINE', preferredSchedule: '', selectedClassId: '', preferredTeacherId: '', paymentRound: null, teacherPayPerSession: 0, teacherPayPerStudent: 0, subject: '', learningGoals: '', maxStudents: null, invoiceDescription: '', invoiceNumber: '', notes: '' }; }
  buildFormItem(source: any = {}) {
    const item = { ...this.emptyItem(), ...source };
    const computedAmount = this.computeItemAmount(item);
    const hasExplicitAmount = source?.amount !== undefined && source?.amount !== null && source?.amount !== '';
    item.amount = hasExplicitAmount ? this.roundMoneyToThousand(item.amount || 0) : computedAmount;
    item.amountManuallyEdited = hasExplicitAmount && Number(item.amount || 0) !== computedAmount;
    return item;
  }
  normalizePhone(v?: string) { return (v || '').replace(/\D/g, ''); }
  normalizeOptionalText(v: any) { const n = String(v ?? '').trim(); return n || undefined; }
  normalizeOptionalId(v: any) { const n = String(v ?? '').trim(); return n || undefined; }
  normalizeOptionalNumber(v: any) { if (v === '' || v === null || v === undefined) return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; }
  roundMoneyToThousand(v: any) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? Math.round(n / 1000) * 1000 : 0; }
  roundMoneyDownToThousand(v: any) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) * 1000 : 0; }
  floorSessionCount(v: any) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

  async loadLookups() {
    const [products, parents, students, sales, teachers, classes, saleOfflineClasses] = await Promise.all([
      this.productService.list(),
      this.userService.listParents(),
      this.studentService.list(),
      this.isSaleRole ? Promise.resolve([] as UserItem[]) : this.userService.listSales(),
      this.userService.listTeachers(),
      this.classService.list(),
      this.isSaleRole ? this.classService.listSaleOfflineOptions() : Promise.resolve([] as ClassItem[]),
    ]);
    this.products.set(products);
    this.parents.set(parents);
    this.students.set(students);
    this.sales.set(sales);
    this.teachers.set(teachers);
    this.classes.set(this.mergeClasses(classes, saleOfflineClasses));
  }

  async reload() {
    const [items, pipeline] = await Promise.all([
      this.orderService.list(),
      this.orderService.getPipeline(),
    ]);
    this.items.set(items);
    this.pipeline.set(pipeline);
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
        this.orderAdGroups.set(await this.adsService.getGroupsByPlatform(platform));
      } catch {
        this.orderAdGroups.set([]);
      }
      return;
    }
    this.orderAdGroups.set([]);
  }

  onAdGroupChange() {
    const group = this.orderAdGroups().find((g) => g._id === this.form.adGroupId);
    this.form.adGroupName = group?.name || '';
  }

  filteredParents() {
    const q = this.parentLookup.trim().toLowerCase();
    return this.parents()
      .filter((p) =>
        !q
        || (p.fullName || '').toLowerCase().includes(q)
        || (p.phone || '').includes(q)
        || (p.email || '').toLowerCase().includes(q)
        || (p.userCode || '').toLowerCase().includes(q))
      .slice(0, 50);
  }

  filteredStudents() {
    const q = this.studentLookup.trim().toLowerCase();
    return this.students()
      .filter((s) =>
        !q
        || (s.studentCode || '').toLowerCase().includes(q)
        || (s.fullName || '').toLowerCase().includes(q)
        || (s.parentName || '').toLowerCase().includes(q)
        || (s.parentPhone || '').includes(q))
      .slice(0, 50);
  }

  mergeClasses(primary: ClassItem[], secondary: ClassItem[]) {
    const merged = [...primary];
    for (const classroom of secondary) {
      if (!merged.some((item) => item._id === classroom._id)) {
        merged.push(classroom);
      }
    }
    return merged;
  }

  findParentById(id?: string | null) { return id ? this.parents().find((p) => p._id === id) : undefined; }
  findStudentById(id?: string | null) { return id ? this.students().find((s) => s._id === id) : undefined; }
  findClassById(id?: string | null) { return id ? this.classes().find((c) => c._id === id) : undefined; }
  formatParentOption(p: UserItem) { return `${p.fullName} - ${p.phone || p.email || 'Không có liên hệ'}`; }
  formatStudentOption(s: StudentItem) { return `${s.studentCode} - ${s.fullName} - ${s.parentPhone || 'Không có SĐT PH'}`; }
  formatClassOption(c: ClassItem) {
    const teacherName = c.teacher && typeof c.teacher !== 'string' ? (c.teacher.fullName || '') : '';
    return `${c.code} - ${c.name}${teacherName ? ` - ${teacherName}` : ''}`;
  }
  classLabel(id?: string | null) {
    const classroom = this.findClassById(id);
    return classroom ? this.formatClassOption(classroom) : '-';
  }
  teacherLabel(id?: string | null) { return this.teachers().find((t) => t._id === id)?.fullName || '-'; }
  teacherPayLabelForItem(item: any) {
    if (String(item?.teachingMode || '').toUpperCase() === 'OFFLINE') {
      return `${this.roundMoneyDownToThousand(item?.teacherPayPerStudent || 0).toLocaleString('vi-VN')}d / HS`;
    }
    return `${this.roundMoneyDownToThousand(item?.teacherPayPerSession || 0).toLocaleString('vi-VN')}d / buổi`;
  }
  isOfflineTrialZeroAmountItem(item: any) {
    const teachingMode = String(item?.teachingMode || '').toUpperCase();
    const trialSessions = this.floorSessionCount(item?.trialSessions || 0);
    const amount = this.roundMoneyToThousand(item?.amount || 0);
    return teachingMode === 'OFFLINE' && trialSessions > 0 && amount <= 0;
  }
  displayInvoiceSessions(item: any) {
    return this.hasExplicitValue(item?.invoiceSessions)
      ? this.floorSessionCount(item.invoiceSessions)
      : this.floorSessionCount(item?.sessions || 0);
  }
  requiresApprovalProof(order: any) {
    const items = Array.isArray(order?.items) ? order.items : [];
    return !(items.length > 0 && items.every((item: any) => this.isOfflineTrialZeroAmountItem(item)));
  }
  productSuggestedPriceById(productId?: string | null) {
    const product = productId ? this.products().find((entry) => entry._id === productId) : undefined;
    return this.roundMoneyToThousand(product?.suggestedPrice || 0);
  }
  orderItemCoursePrice(item: any) {
    const suggestedPrice = this.productSuggestedPriceById(item?.productId);
    if (suggestedPrice > 0) return suggestedPrice;
    return this.roundMoneyToThousand(this.floorSessionCount(item?.sessions || 0) * Number(item?.pricePerSession || 0));
  }
  productSuggestedPrice(item: any) {
    return this.orderItemCoursePrice(item);
  }
  orderCoursePrice(order: any) {
    return this.roundMoneyToThousand((order?.items || []).reduce((sum: number, item: any) => sum + this.orderItemCoursePrice(item), 0));
  }
  orderInvoiceAmount(order: any) {
    const finalAmount = Number(order?.finalAmount);
    if (Number.isFinite(finalAmount) && finalAmount >= 0) {
      return this.roundMoneyToThousand(finalAmount);
    }
    const totalAmount = Number(order?.totalAmount);
    if (Number.isFinite(totalAmount) && totalAmount >= 0) {
      return this.roundMoneyToThousand(totalAmount);
    }
    return this.roundMoneyToThousand((order?.items || []).reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0));
  }
  invoiceItemLabel(item: any, index: number) {
    const productName = item?.productName || this.products().find((product) => product._id === item?.productId)?.name || `Sản phẩm ${index + 1}`;
    const subject = this.normalizeOptionalText(item?.subject);
    return subject ? `${productName} - ${subject}` : productName;
  }
  classOptionsForItem(item: any) {
    const desiredMode = String(item?.teachingMode || 'ONLINE').toUpperCase();
    const desiredProductId = String(item?.productId || '');
    return this.classes().filter((classroom) => {
      const classMode = String(classroom.classMode || 'ONLINE').toUpperCase();
      if (classMode !== desiredMode) return false;
      const classProductId = classroom.productPackage?._id || '';
      if (desiredProductId && classProductId && classProductId !== desiredProductId) return false;
      return true;
    });
  }

  startNewParent() {
    const hadLinkedParent = !!this.form.parentUserId;
    this.form.parentUserId = '';
    this.parentLookup = '';
    this.form.existingStudentId = '';
    this.studentLookup = '';
    if (hadLinkedParent) {
      this.form.parentName = '';
      this.form.parentPhone = '';
      this.form.parentEmail = '';
      this.form.parentUserCode = '';
      this.form.parentAddress = '';
      this.form.parentFacebookLink = '';
    }
  }

  startNewStudent() {
    const hadLinkedStudent = !!this.form.existingStudentId;
    this.form.existingStudentId = '';
    this.studentLookup = '';
    if (hadLinkedStudent) {
      this.form.studentCode = '';
      this.form.studentName = '';
      this.form.studentLevel = '';
      this.form.studentDob = '';
      this.form.studentAge = null;
      this.form.studentBirthMonth = null;
      this.form.studentFaceImage = '';
    }
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
    this.form.parentUserCode = parent.userCode || this.form.parentUserCode;
    this.form.parentAddress = parent.address || this.form.parentAddress;
    this.form.parentFacebookLink = parent.facebookLink || this.form.parentFacebookLink;
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
    this.form.studentCode = student.studentCode || this.form.studentCode;
    this.form.studentName = student.fullName || this.form.studentName;
    this.form.studentLevel = student.level || this.form.studentLevel;
    this.form.studentAge = student.age ?? this.form.studentAge;
    this.form.studentBirthMonth = student.studentBirthMonth ?? this.form.studentBirthMonth;
    this.form.parentBirthMonth = student.parentBirthMonth ?? this.form.parentBirthMonth;
    this.form.studentFaceImage = student.faceImage || this.form.studentFaceImage;
    this.studentLookup = this.formatStudentOption(student);
    const parent = student.parentUserId ? this.findParentById(student.parentUserId) : undefined;
    if (parent) this.applyParentSelection(parent);
    else {
      this.form.parentUserId = student.parentUserId || this.form.parentUserId || '';
      this.form.parentName = student.parentName || this.form.parentName;
      this.form.parentPhone = student.parentPhone || this.form.parentPhone;
    }
    if (!this.isSaleRole && !this.form.leadId && student.saleId) this.form.saleId = student.saleId;
  }

  onParentSelected(parentId: string) {
    const parent = this.findParentById(parentId);
    this.applyParentSelection(parent || null);
    if (!parent) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
      return;
    }
    const student = this.findStudentById(this.form.existingStudentId);
    if (student?.parentUserId && student.parentUserId !== parent._id) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
    }
  }

  onExistingStudentSelected(studentId: string) {
    this.applyStudentSelection(this.findStudentById(studentId) || null);
  }

  onParentFieldsChanged() {
    const p = this.findParentById(this.form.parentUserId);
    if (p) {
      const sameName = (this.form.parentName || '').trim() === (p.fullName || '').trim();
      const samePhone = this.normalizePhone(this.form.parentPhone) === this.normalizePhone(p.phone);
      const sameEmail = (this.form.parentEmail || '').trim().toLowerCase() === (p.email || '').trim().toLowerCase();
      const sameCode = (this.form.parentUserCode || '').trim().toUpperCase() === (p.userCode || '').trim().toUpperCase();
      if (!sameName || !samePhone || !sameEmail || !sameCode) {
        this.form.parentUserId = '';
        this.parentLookup = '';
      }
    }
    const s = this.findStudentById(this.form.existingStudentId);
    if (s) {
      const sameParentName = (this.form.parentName || '').trim() === (s.parentName || '').trim();
      const sameParentPhone = this.normalizePhone(this.form.parentPhone) === this.normalizePhone(s.parentPhone);
      if (!sameParentName || !sameParentPhone) {
        this.form.existingStudentId = '';
        this.studentLookup = '';
      }
    }
  }

  onStudentFieldsChanged() {
    const s = this.findStudentById(this.form.existingStudentId);
    if (!s) return;
    const sameName = (this.form.studentName || '').trim() === (s.fullName || '').trim();
    const sameAge = Number(this.form.studentAge || 0) === Number(s.age || 0);
    const sameCode = (this.form.studentCode || '').trim().toUpperCase() === (s.studentCode || '').trim().toUpperCase();
    const sameLevel = (this.form.studentLevel || '').trim() === (s.level || '').trim();
    if (!sameName || !sameAge || !sameCode || !sameLevel) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
    }
  }

  onSelectedClassChange(item: any, classId: string) {
    item.selectedClassId = classId || '';
    const classroom = this.findClassById(classId);
    if (!classroom) return;
    if (classroom.classMode) item.teachingMode = classroom.classMode;
    if (classroom.productPackage?._id && !item.productId) {
      item.productId = classroom.productPackage._id;
      item.productName = classroom.productPackage.name || item.productName;
    }
    if (classroom.teacher && typeof classroom.teacher !== 'string') {
      item.preferredTeacherId = classroom.teacher._id;
    }
    item.subject = classroom.subject || item.subject;
    item.learningGoals = classroom.learningGoals || item.learningGoals;
    item.baseDuration = classroom.baseDuration || item.baseDuration;
    item.sessionDuration = classroom.sessionDuration || item.sessionDuration;
    item.pricePerSession = classroom.pricePerSession || item.pricePerSession;
    item.teacherPayPerSession = classroom.teacherPayPerSession || item.teacherPayPerSession;
    item.teacherPayPerStudent = classroom.teacherPayPerStudent || item.teacherPayPerStudent;
    item.maxStudents = classroom.maxStudents ?? item.maxStudents;
    this.calcItemAmount(item);
  }

  buildPayload() {
    return {
      orderType: this.form.orderType,
      parentName: (this.form.parentName || '').trim(),
      parentPhone: (this.form.parentPhone || '').trim(),
      ...(this.normalizeOptionalText(this.form.parentEmail) ? { parentEmail: this.normalizeOptionalText(this.form.parentEmail) } : {}),
      ...(this.normalizeOptionalText(this.form.parentUserCode) ? { parentUserCode: this.normalizeOptionalText(this.form.parentUserCode)?.toUpperCase() } : {}),
      ...(this.normalizeOptionalText(this.form.parentAddress) ? { parentAddress: this.normalizeOptionalText(this.form.parentAddress) } : {}),
      ...(this.normalizeOptionalText(this.form.parentFacebookLink) ? { parentFacebookLink: this.normalizeOptionalText(this.form.parentFacebookLink) } : {}),
      ...((this.editingId || this.normalizeOptionalId(this.form.parentUserId)) ? { parentUserId: this.normalizeOptionalId(this.form.parentUserId) ?? '' } : {}),
      studentName: (this.form.studentName || '').trim(),
      ...(this.normalizeOptionalText(this.form.studentCode) ? { studentCode: this.normalizeOptionalText(this.form.studentCode)?.toUpperCase() } : {}),
      ...(this.normalizeOptionalText(this.form.studentLevel) ? { studentLevel: this.normalizeOptionalText(this.form.studentLevel) } : {}),
      ...(this.normalizeOptionalText(this.form.studentDob) ? { studentDob: this.normalizeOptionalText(this.form.studentDob) } : {}),
      ...(this.normalizeOptionalNumber(this.form.studentAge) !== undefined ? { studentAge: this.normalizeOptionalNumber(this.form.studentAge) } : {}),
      ...(this.normalizeOptionalNumber(this.form.studentBirthMonth) !== undefined ? { studentBirthMonth: this.normalizeOptionalNumber(this.form.studentBirthMonth) } : {}),
      ...(this.normalizeOptionalNumber(this.form.parentBirthMonth) !== undefined ? { parentBirthMonth: this.normalizeOptionalNumber(this.form.parentBirthMonth) } : {}),
      ...(this.normalizeOptionalText(this.form.studentFaceImage) ? { studentFaceImage: this.normalizeOptionalText(this.form.studentFaceImage) } : {}),
      ...((this.editingId || this.normalizeOptionalId(this.form.existingStudentId)) ? { existingStudentId: this.normalizeOptionalId(this.form.existingStudentId) ?? '' } : {}),
      ...(this.normalizeOptionalText(this.form.leadSource) ? { leadSource: this.normalizeOptionalText(this.form.leadSource) } : {}),
      ...(this.normalizeOptionalId(this.form.leadId) ? { leadId: this.normalizeOptionalId(this.form.leadId) } : {}),
      ...(this.normalizeOptionalId(this.form.saleId) ? { saleId: this.normalizeOptionalId(this.form.saleId) } : {}),
      ...(this.normalizeOptionalId(this.form.adGroupId) ? { adGroupId: this.normalizeOptionalId(this.form.adGroupId) } : {}),
      ...(this.normalizeOptionalText(this.form.adGroupName) ? { adGroupName: this.normalizeOptionalText(this.form.adGroupName) } : {}),
      ...(this.normalizeOptionalText(this.form.paymentPlan) ? { paymentPlan: this.normalizeOptionalText(this.form.paymentPlan) } : {}),
      ...(this.normalizeOptionalText(this.form.paymentDate) ? { paymentDate: this.normalizeOptionalText(this.form.paymentDate) } : {}),
      ...(this.normalizeOptionalText(this.form.receiptImage) ? { receiptImage: this.normalizeOptionalText(this.form.receiptImage) } : {}),
      ...(this.normalizeOptionalNumber(this.form.saleCommission) !== undefined ? { saleCommission: this.normalizeOptionalNumber(this.form.saleCommission) } : {}),
      items: (this.form.items || []).map((item: any) => ({
        productId: item.productId,
        ...(this.normalizeOptionalText(item.productName) ? { productName: this.normalizeOptionalText(item.productName) } : {}),
        sessions: this.floorSessionCount(item.sessions || 0),
        invoiceSessions: this.resolveInvoiceSessionsForPayload(item),
        sessionDuration: Number(item.sessionDuration || 0),
        ...(this.normalizeOptionalNumber(item.baseDuration) !== undefined ? { baseDuration: this.normalizeOptionalNumber(item.baseDuration) } : {}),
        pricePerSession: this.roundMoneyToThousand(item.pricePerSession || 0),
        amount: this.roundMoneyToThousand(item.amount || 0),
        ...(this.normalizeOptionalNumber(item.bonusSessions) !== undefined ? { bonusSessions: this.floorSessionCount(item.bonusSessions) } : {}),
        ...(this.normalizeOptionalNumber(item.trialSessions) !== undefined ? { trialSessions: this.floorSessionCount(item.trialSessions) } : {}),
        ...(this.normalizeOptionalText(item.courseStatus) ? { courseStatus: this.normalizeOptionalText(item.courseStatus) } : {}),
        teachingMode: item.teachingMode || 'ONLINE',
        ...(this.normalizeOptionalText(item.preferredSchedule) ? { preferredSchedule: this.normalizeOptionalText(item.preferredSchedule) } : {}),
        ...(this.normalizeOptionalId(item.selectedClassId) ? { selectedClassId: this.normalizeOptionalId(item.selectedClassId) } : {}),
        ...(this.normalizeOptionalId(item.preferredTeacherId) ? { preferredTeacherId: this.normalizeOptionalId(item.preferredTeacherId) } : {}),
        ...(this.normalizeOptionalNumber(item.paymentRound) !== undefined ? { paymentRound: this.normalizeOptionalNumber(item.paymentRound) } : {}),
        ...(this.normalizeOptionalNumber(item.teacherPayPerSession) !== undefined ? { teacherPayPerSession: this.roundMoneyDownToThousand(item.teacherPayPerSession) } : {}),
        ...(this.normalizeOptionalNumber(item.teacherPayPerStudent) !== undefined ? { teacherPayPerStudent: this.roundMoneyDownToThousand(item.teacherPayPerStudent) } : {}),
        ...(this.normalizeOptionalText(item.subject) ? { subject: this.normalizeOptionalText(item.subject) } : {}),
        ...(this.normalizeOptionalText(item.learningGoals) ? { learningGoals: this.normalizeOptionalText(item.learningGoals) } : {}),
        ...(this.normalizeOptionalNumber(item.maxStudents) !== undefined ? { maxStudents: this.normalizeOptionalNumber(item.maxStudents) } : {}),
        ...(this.normalizeOptionalText(item.invoiceDescription) ? { invoiceDescription: this.normalizeOptionalText(item.invoiceDescription) } : {}),
        ...(this.normalizeOptionalText(item.invoiceNumber) ? { invoiceNumber: this.normalizeOptionalText(item.invoiceNumber) } : {}),
        ...(this.normalizeOptionalText(item.notes) ? { notes: this.normalizeOptionalText(item.notes) } : {}),
      })),
      discountAmount: this.roundMoneyToThousand(this.form.discountAmount || 0),
      ...(this.normalizeOptionalText(this.form.discountReason) ? { discountReason: this.normalizeOptionalText(this.form.discountReason) } : {}),
      ...(this.normalizeOptionalText(this.form.consultationNotes) ? { consultationNotes: this.normalizeOptionalText(this.form.consultationNotes) } : {}),
      totalAmount: this.calcTotal(),
      finalAmount: this.calcFinal(),
    };
  }

  filtered = computed(() => {
    let list = this.items();
    const kw = this.keyword.trim().toLowerCase();
    if (kw) list = list.filter((o) => o.orderCode.toLowerCase().includes(kw) || o.studentName.toLowerCase().includes(kw) || (o.studentCode || '').toLowerCase().includes(kw) || o.parentName.toLowerCase().includes(kw) || o.parentPhone.includes(kw));
    if (this.filterStatus) list = list.filter((o) => o.status === this.filterStatus);
    if (this.filterType) list = list.filter((o) => o.orderType === this.filterType);
    return list;
  });

  onProductSelect(item: any, productId: string) {
    const p = this.products().find((v) => v._id === productId);
    if (!p) return;
    item.productName = p.name;
    item.sessions = p.defaultSessions || 24;
    item.invoiceSessions = p.defaultSessions || 24;
    item.sessionDuration = p.defaultSessionDuration || 90;
    item.baseDuration = p.defaultSessionDuration || item.baseDuration || 90;
    item.pricePerSession = p.pricePerSession || 0;
    item.teachingMode = p.teachingMode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
    item.amountManuallyEdited = false;
    this.calcItemAmount(item, true);
  }

  calcEffectivePrice(item: any) {
    const pricePerSession = Number(item.pricePerSession || 0);
    const baseDuration = Number(item.baseDuration || item.sessionDuration || 0);
    const sessionDuration = Number(item.sessionDuration || baseDuration || 0);
    if (!pricePerSession || !baseDuration || !sessionDuration) return pricePerSession;
    return this.roundMoneyToThousand((pricePerSession / baseDuration) * sessionDuration);
  }
  hasExplicitValue(value: any) {
    return value !== undefined && value !== null && value !== '';
  }
  resolveConfiguredInvoiceSessions(item: any) {
    if (this.hasExplicitValue(item?.invoiceSessions)) {
      return this.floorSessionCount(item.invoiceSessions);
    }
    return this.floorSessionCount(item?.sessions || 0);
  }
  resolveInvoiceSessionsForPayload(item: any) {
    const invoiceSessions = this.resolveConfiguredInvoiceSessions(item);
    if (invoiceSessions > 0) {
      return invoiceSessions;
    }
    return this.isOfflineTrialZeroAmountItem(item) ? 0 : this.floorSessionCount(item.sessions || 0);
  }
  computeItemAmount(item: any) {
    return this.roundMoneyToThousand(this.resolveConfiguredInvoiceSessions(item) * this.calcEffectivePrice(item));
  }
  calcItemAmount(item: any, force = false) {
    const amount = this.computeItemAmount(item);
    if (force || !item.amountManuallyEdited) item.amount = amount;
    return amount;
  }
  markInvoiceAmountEdited(item: any) { item.amountManuallyEdited = true; }
  normalizeInvoiceAmount(item: any) {
    item.amount = this.roundMoneyToThousand(item.amount || 0);
    item.amountManuallyEdited = true;
  }
  normalizeInvoiceSessions(item: any) {
    const normalizedInvoiceSessions = this.floorSessionCount(item.invoiceSessions || 0);
    const fallbackSessions = this.floorSessionCount(item.sessions || 0) || 1;
    item.invoiceSessions =
      normalizedInvoiceSessions > 0 || this.isOfflineTrialZeroAmountItem(item)
        ? normalizedInvoiceSessions
        : fallbackSessions;
    this.calcItemAmount(item);
  }
  resetInvoiceAmount(item: any) {
    item.amountManuallyEdited = false;
    this.calcItemAmount(item, true);
  }
  calcTotal() { return this.roundMoneyToThousand((this.form.items || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0)); }
  calcFinal() { return Math.max(0, this.roundMoneyToThousand(this.calcTotal() - this.roundMoneyToThousand(this.form.discountAmount || 0))); }
  addItem() { this.form.items.push(this.buildFormItem()); }
  removeItem(i: number) { this.form.items.splice(i, 1); }

  async uploadStudentFace(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploadingStudentFace.set(true);
    this.error.set('');
    try {
      const res = await this.studentService.uploadFace(file);
      this.form.studentFaceImage = res.url;
    } catch {
      this.error.set('Không thể tải ảnh học sinh lên');
    } finally {
      this.isUploadingStudentFace.set(false);
      input.value = '';
    }
  }

  async uploadReceipt(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploadingReceipt.set(true);
    this.error.set('');
    try {
      const res = await this.invoiceService.uploadReceipt(file);
      if (!res.ok || !res.url) {
        this.error.set(res.message || 'Không thể tải chứng từ lên');
        return;
      }
      this.form.receiptImage = res.url;
    } finally {
      this.isUploadingReceipt.set(false);
      input.value = '';
    }
  }

  openCreate() { this.editingId = null; this.form = this.emptyForm(); this.parentLookup = ''; this.studentLookup = ''; this.error.set(''); this.showModal.set(true); }
  openEdit(o: OrderData) { this.editingId = o._id; this.form = { ...this.emptyForm(), ...o, parentUserId: o.parentUserId || '', existingStudentId: o.existingStudentId || '', items: (o.items || []).map((i: any) => this.buildFormItem(i)) }; this.error.set(''); this.parentLookup = ''; this.studentLookup = ''; this.showModal.set(true); this.detailOrder.set(null); }
  openDetail(o: OrderData) { this.detailOrder.set(o); }
  closeModal() { this.showModal.set(false); this.editingId = null; this.parentLookup = ''; this.studentLookup = ''; }
  canEdit(o: OrderData) { return o.status === 'DRAFT' || o.status === 'NEEDS_INFO'; }
  canSubmit(o: OrderData) { return o.status === 'DRAFT' || o.status === 'NEEDS_INFO'; }
  canApproveOrder(o: OrderData) { return o.status === 'SUBMITTED' && this.canApprove; }
  canCancel(o: OrderData) { return !['COMPLETED', 'CANCELLED'].includes(o.status); }

  async submitForm() {
    const payload = this.buildPayload();
    const res = this.editingId
      ? await this.orderService.update(this.editingId, payload)
      : await this.orderService.create(payload);
    if (!res.ok) {
      this.error.set(res.message || 'Không thể lưu đơn');
      return;
    }
    this.closeModal();
    await this.reload();
  }

  async submitOrder(o: OrderData) {
    if (!confirm(`Gửi duyệt đơn ${o.orderCode}?`)) return;
    const res = await this.orderService.submit(o._id);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }

  async approveOrder(o: OrderData) {
    if (!confirm(`Duyệt đơn ${o.orderCode} - ${o.studentName}?`)) return;
    const res = await this.orderService.approve(o._id, this.orderApproveImage || undefined);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    const updatedOrder = res.data?.order || await this.orderService.getOne(o._id);
    const e = res.data?.enrollment;
    if (e?.success) {
      alert(`Học sinh: ${e.studentCode}\nHóa đơn tạo: ${e.invoiceIds?.length || 0}\nĐơn sẽ chuyển COMPLETED sau khi gắn đủ lớp.`);
    } else if (e?.errors?.length) {
      alert(e.errors.join('\n'));
    }
    this.detailOrder.set(updatedOrder || null);
    await Promise.all([this.reload(), this.loadLookups()]);
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http')) return imagePath;
    return `${environment.apiBase}${imagePath}`;
  }

  showImageModal(imageUrl: string): void {
    this.modalImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.modalImage.set(null);
  }

  openApproveOrderModal(o: OrderData): void {
    this.approvingOrder.set(o);
    this.orderApproveImage = '';
    this.orderApproveError.set('');
    this.orderApproveUploading.set(false);
    this.showApproveOrderModal.set(true);
  }

  closeApproveOrderModal(): void {
    this.showApproveOrderModal.set(false);
    this.approvingOrder.set(null);
    this.orderApproveImage = '';
    this.orderApproveError.set('');
    this.orderApproveUploading.set(false);
  }

  async handleOrderApproveImageChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.orderApproveError.set('');
    this.orderApproveUploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.orderApproveUploading.set(false);
    if (!result.ok || !result.url) {
      this.orderApproveError.set(result.message || 'Tải hóa đơn đối ứng thất bại');
      return;
    }
    this.orderApproveImage = result.url;
  }

  async confirmApproveOrder(): Promise<void> {
    const o = this.approvingOrder();
    if (!o) return;
    this.orderApproveError.set('');
    const res = await this.orderService.approve(o._id, this.orderApproveImage || undefined);
    if (!res.ok) {
      this.orderApproveError.set(res.message || 'Không thể duyệt đơn');
      return;
    }
    const updatedOrder = res.data?.order || await this.orderService.getOne(o._id);
    const e = res.data?.enrollment;
    if (e?.success) {
      alert(`Học sinh: ${e.studentCode}\nHóa đơn tạo: ${e.invoiceIds?.length || 0}\nĐơn sẽ chuyển COMPLETED sau khi gắn đủ lớp.`);
    } else if (e?.errors?.length) {
      alert(e.errors.join('\n'));
    }
    this.closeApproveOrderModal();
    this.detailOrder.set(updatedOrder || null);
    await Promise.all([this.reload(), this.loadLookups()]);
  }

  async requestMoreInfo(o: OrderData) {
    const reason = prompt('Nội dung cần bổ sung:');
    if (!reason) return;
    const res = await this.orderService.requestInfo(o._id, reason);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }

  async rejectOrder(o: OrderData) {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    const res = await this.orderService.reject(o._id, reason);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }

  async cancelOrder(o: OrderData) {
    if (!confirm(`Hủy đơn ${o.orderCode}?`)) return;
    const res = await this.orderService.cancel(o._id);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }
}
