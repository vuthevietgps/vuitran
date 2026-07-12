import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ClassItem, ClassService } from '../services/class.service';
import { ProductItem, ProductService } from '../services/product.service';
import { AvailableTrialTestSlot, TrialEnrollmentItem, TrialEnrollmentPayload, TrialEnrollmentService, TrialEnrollmentStatus, TrialTestSlot } from '../services/trial-enrollment.service';
import { UserItem, UserService } from '../services/user.service';
import { environment } from '../../environments/environment';

interface TrialForm {
  studentName: string;
  studentPhone: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  classId: string;
  productId: string;
  saleId: string;
  experienceTeacherId: string;
  testDate: string;
  testStartTime: string;
  testEndTime: string;
  status: TrialEnrollmentStatus;
  maxTrialSessions: number;
  trialSessionsUsed: number;
  notes: string;
  assessmentScore: number | null;
  recommendedLevel: string;
  assessmentNotes: string;
  zoomMeetingUrl: string;
  zoomRecordingUrl: string;
  resultImageUrls: string[];
  listeningScore: number | null;
  speakingScore: number | null;
  readingScore: number | null;
  writingScore: number | null;
  pronunciationScore: number | null;
  grammarScore: number | null;
  vocabularyScore: number | null;
  reflexScore: number | null;
  confidenceScore: number | null;
  focusScore: number | null;
  testDurationMinutes: number | null;
  learningGaps: string;
  strengthsObserved: string;
  improvementAreas: string;
  recommendedRoadmap: string;
  suggestedPackage: string;
  suggestedSchedule: string;
  salesAdvice: string;
  closingPotential: string;
  technicalNotes: string;
}

interface SlotSearchForm {
  fromDate: string;
  toDate: string;
  preferredStart: string;
  preferredEnd: string;
  experienceTeacherId: string;
  limit: number;
}

const STATUS_OPTIONS: TrialEnrollmentStatus[] = ['PENDING_TRIAL', 'WAITING_DECISION', 'CONVERTED', 'REJECTED'];

@Component({
  selector: 'app-trial-enrollments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <header class="page-header">
      <div>
        <p class="eyebrow">Quy trình kiểm thử</p>
        <h2>Test học sinh đầu vào</h2>
        <p>Quản lý buổi test do giáo viên trải nghiệm thực hiện, ghi nhận điểm đầu vào và hỗ trợ Sale tư vấn chốt học.</p>
      </div>
      <div class="header-actions">
        <button class="secondary" type="button" (click)="reload()" [disabled]="loading()">Làm mới</button>
        <button class="primary" type="button" (click)="openCreate()" *ngIf="canCreate()">+ Tạo buổi test</button>
      </div>
    </header>

    <section class="info-banner">
      <div>
        <strong>Quy tắc mô tả:</strong>
        <span>Buổi test học sinh khác buổi học thử: giáo viên trải nghiệm được tính lương test theo case dù học sinh sau đó học thử hay học thật.</span>
      </div>
      <div class="banner-note">
        Học thử thật là buổi học loại TRIAL trong lịch học; chỉ khi học sinh chuyển sang học thật thì mới trừ ví và tính lương giáo viên dạy buổi đó.
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card accent">
        <span class="summary-label">Tổng</span>
        <strong>{{ summary().total }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Chờ test</span>
        <strong>{{ summary().active }}</strong>
      </article>
      <article class="summary-card">
        <span class="summary-label">Đã test, chờ tư vấn</span>
        <strong>{{ summary().waiting }}</strong>
      </article>
      <article class="summary-card success">
        <span class="summary-label">Đã chốt học</span>
        <strong>{{ summary().converted }}</strong>
      </article>
      <article class="summary-card danger">
        <span class="summary-label">Không tiếp tục</span>
        <strong>{{ summary().rejected }}</strong>
      </article>
    </section>

    <section class="filters">
      <input placeholder="Tìm theo tên HS, PH, SĐT, mã test..." [(ngModel)]="keyword" (keyup.enter)="applyFilters()" />
      <select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
        <option value="">Tất cả trạng thái</option>
        <option *ngFor="let status of statusOptions" [value]="status">{{ statusLabel(status) }}</option>
      </select>
      <select [(ngModel)]="classFilter" (ngModelChange)="applyFilters()">
        <option value="">Tất cả lớp</option>
        <option *ngFor="let cls of offlineClasses()" [value]="cls._id">{{ classLabel(cls) }}</option>
      </select>
      <select [(ngModel)]="productFilter" (ngModelChange)="applyFilters()">
        <option value="">Tất cả gói</option>
        <option *ngFor="let product of offlineProducts()" [value]="product._id">{{ productLabel(product) }}</option>
      </select>
      <button class="secondary" type="button" (click)="applyFilters()" [disabled]="loading()">Tìm</button>
    </section>

    <section class="quick-slots" *ngIf="canCreate()">
      <div class="quick-slots-head">
        <div>
          <strong>Tìm slot test trống</strong>
          <span>Quét nhiều giáo viên trong khung giờ mong muốn, trả về slot sớm nhất.</span>
        </div>
        <button class="secondary" type="button" (click)="findAvailableSlots()" [disabled]="availableSlotsLoading()">Tìm slot</button>
      </div>
      <div class="quick-slot-filters">
        <label>Từ ngày
          <input type="date" [(ngModel)]="slotSearch.fromDate" />
        </label>
        <label>Đến ngày
          <input type="date" [(ngModel)]="slotSearch.toDate" />
        </label>
        <label>Từ giờ
          <input type="time" step="1800" [(ngModel)]="slotSearch.preferredStart" />
        </label>
        <label>Đến giờ
          <input type="time" step="1800" [(ngModel)]="slotSearch.preferredEnd" />
        </label>
        <label>GV ưu tiên
          <select [(ngModel)]="slotSearch.experienceTeacherId">
            <option value="">Tất cả GV trải nghiệm</option>
            <option *ngFor="let teacher of experienceTeachers()" [value]="teacher._id">{{ teacher.fullName }}</option>
          </select>
        </label>
      </div>
      <div class="slot-loading" *ngIf="availableSlotsLoading()">Đang tìm slot...</div>
      <div class="available-slot-grid" *ngIf="!availableSlotsLoading() && availableSlots().length">
        <button
          type="button"
          class="available-slot-card"
          *ngFor="let slot of availableSlots()"
          (click)="openCreateWithSlot(slot)"
        >
          <strong>{{ slot.date }} {{ slot.startTime }}-{{ slot.endTime }}</strong>
          <span>{{ slot.teacherName || teacherLabelById(slot.experienceTeacherId) }}</span>
        </button>
      </div>
    </section>

    <section
      class="page-feedback"
      *ngIf="pageFeedback() as feedback"
      [class.page-feedback-success]="feedback.type === 'success'"
      [class.page-feedback-error]="feedback.type === 'error'"
      data-testid="trial-page-feedback"
    >
      {{ feedback.message }}
    </section>

    <div class="pagination-bar" *ngIf="totalItems()">
      <span>Hiển thị {{ items().length }} / {{ totalItems() }} buổi test</span>
      <div>
        <select [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange($event)">
          <option [ngValue]="25">25/trang</option>
          <option [ngValue]="50">50/trang</option>
          <option [ngValue]="100">100/trang</option>
        </select>
        <button class="secondary" type="button" (click)="changePage(page - 1)" [disabled]="page <= 1 || loading()">Trước</button>
        <span>Trang {{ page }} / {{ totalPages() }}</span>
        <button class="secondary" type="button" (click)="changePage(page + 1)" [disabled]="page >= totalPages() || loading()">Sau</button>
      </div>
    </div>

    <div class="table-wrap" *ngIf="filteredItems().length; else emptyState">
      <table class="data">
        <thead>
          <tr>
            <th>Mã test</th>
            <th>Học viên</th>
            <th>PH</th>
            <th>Lớp / gói</th>
            <th>Sale</th>
            <th>GV trải nghiệm</th>
            <th>Buổi</th>
            <th>Trạng thái</th>
            <th>Cập nhật</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of filteredItems()">
            <td>
              <strong>{{ trialCode(item) }}</strong>
              <div class="muted-line">{{ item.createdAt | date:'dd/MM/yyyy' }}</div>
            </td>
            <td>
              <div class="primary-text">{{ item.studentName }}</div>
              <div class="muted-line" *ngIf="item.studentPhone">{{ item.studentPhone }}</div>
            </td>
            <td>
              <div>{{ item.parentName || '-' }}</div>
              <div class="muted-line" *ngIf="item.parentPhone">{{ item.parentPhone }}</div>
              <div class="muted-line" *ngIf="item.parentEmail">{{ item.parentEmail }}</div>
            </td>
            <td>
              <div>{{ classLabelByRef(item.classId) }}</div>
              <div class="muted-line">{{ productLabelByRef(item.productId) }}</div>
            </td>
            <td>{{ saleLabelByRef(item.saleId) }}</td>
            <td>
              <div>{{ experienceTeacherLabelByRef(item.experienceTeacherId) }}</div>
              <div class="muted-line" *ngIf="testScheduleLabel(item)">{{ testScheduleLabel(item) }}</div>
              <div class="muted-line" *ngIf="item.assessmentScore !== undefined && item.assessmentScore !== null">
                Điểm test: {{ item.assessmentScore }}/100
              </div>
              <div class="muted-line" *ngIf="item.recommendedLevel">Level: {{ item.recommendedLevel }}</div>
            </td>
            <td>
              <span class="session-pill">{{ item.trialSessionsUsed || 0 }}/{{ item.maxTrialSessions || 2 }}</span>
            </td>
            <td>
              <span class="badge" [style.background]="statusColor(item.status) + '20'" [style.color]="statusColor(item.status)">
                {{ statusLabel(item.status) }}
              </span>
              <div
                class="muted-line status-note"
                *ngIf="item.teacherPaidOnlyDecision"
                [attr.data-testid]="'trial-teacher-paid-only-note-' + item._id"
              >
                Buổi học thử không tiếp tục: không trả lương GV dạy thử, không thu phí PH
              </div>
            </td>
            <td>
              <div>{{ item.updatedAt ? (item.updatedAt | date:'dd/MM/yyyy HH:mm') : (item.decisionAt ? (item.decisionAt | date:'dd/MM/yyyy HH:mm') : '-') }}</div>
              <div class="muted-line" *ngIf="item.notes">{{ item.notes }}</div>
            </td>
            <td class="actions-cell">
              <button
                class="btn-sm"
                type="button"
                (click)="edit(item)"
                *ngIf="canEdit(item)"
                [disabled]="isActionLoading(item)"
                [attr.data-testid]="'trial-edit-' + item._id"
              >
                Sửa
              </button>
              <button
                class="btn-sm"
                type="button"
                (click)="markWaiting(item)"
                *ngIf="canEdit(item) && item.status === 'PENDING_TRIAL'"
                [disabled]="isActionLoading(item)"
                [attr.data-testid]="'trial-waiting-' + item._id"
              >
                Chờ chốt
              </button>
              <button
                class="btn-sm success"
                type="button"
                (click)="convert(item)"
                *ngIf="canApprove(item)"
                [disabled]="isActionLoading(item)"
                [attr.data-testid]="'trial-convert-' + item._id"
              >
                Chuyển đổi
              </button>
              <button
                class="btn-sm warning"
                type="button"
                (click)="teacherPaidOnly(item)"
                *ngIf="canTeacherPaidOnly(item)"
                [disabled]="isActionLoading(item)"
                [attr.data-testid]="'trial-teacher-paid-only-' + item._id"
              >
                {{ isActionLoading(item) ? 'Đang xử lý...' : 'Trả lương GV' }}
              </button>
              <button
                class="btn-sm danger"
                type="button"
                (click)="reject(item)"
                *ngIf="canApprove(item)"
                [disabled]="isActionLoading(item)"
                [attr.data-testid]="'trial-reject-' + item._id"
              >
                Từ chối
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ng-template #emptyState>
      <div class="empty-state" *ngIf="!loading(); else loadingState">
        <h3>Chưa có buổi test nào</h3>
        <p>Tạo một bản ghi test để giáo viên trải nghiệm kiểm tra đầu vào và Sale có dữ liệu tư vấn.</p>
      </div>
    </ng-template>

    <ng-template #loadingState>
      <div class="empty-state">
        <h3>Đang tải dữ liệu...</h3>
        <p>Xin chờ một chút trong lúc lấy lớp offline, gói offline và danh sách sale.</p>
      </div>
    </ng-template>

    <div class="modal-backdrop" *ngIf="showModal()">
      <div class="modal wide">
        <h3>{{ editingId ? 'Cập nhật buổi test' : 'Tạo buổi test mới' }}</h3>
        <form (ngSubmit)="submit()" #f="ngForm">
          <div class="form-grid">
            <label>Học viên <span class="req">*</span>
              <input name="studentName" [(ngModel)]="form.studentName" required />
            </label>
            <label>Số điện thoại học viên
              <input name="studentPhone" [(ngModel)]="form.studentPhone" />
            </label>
            <label>Phụ huynh <span class="req">*</span>
              <input name="parentName" [(ngModel)]="form.parentName" required />
            </label>
            <label>Số điện thoại PH <span class="req">*</span>
              <input name="parentPhone" [(ngModel)]="form.parentPhone" required />
            </label>
            <label>Email PH
              <input name="parentEmail" [(ngModel)]="form.parentEmail" />
            </label>
            <label>Lớp offline <span class="req">*</span>
              <select name="classId" [(ngModel)]="form.classId" required>
                <option value="">-- Chọn lớp --</option>
                <option *ngFor="let cls of offlineClasses()" [value]="cls._id">{{ classLabel(cls) }}</option>
              </select>
            </label>
            <label>Gói sản phẩm offline <span class="req">*</span>
              <select name="productId" [(ngModel)]="form.productId" required>
                <option value="">-- Chọn gói --</option>
                <option *ngFor="let product of offlineProducts()" [value]="product._id">{{ productLabel(product) }}</option>
              </select>
            </label>
            <label *ngIf="!isSaleRole()">Sale phụ trách
              <select name="saleId" [(ngModel)]="form.saleId">
                <option value="">-- Tự suy ra --</option>
                <option *ngFor="let sale of sales()" [value]="sale._id">{{ sale.fullName }}</option>
              </select>
            </label>
            <label *ngIf="isSaleRole()">Sale phụ trách
              <input [value]="currentUserName" disabled />
            </label>
            <label *ngIf="!isExperienceTeacherRole()">GV trải nghiệm
              <select name="experienceTeacherId" [ngModel]="form.experienceTeacherId" (ngModelChange)="onExperienceTeacherChange($event)">
                <option value="">-- Chưa gán --</option>
                <option *ngFor="let teacher of experienceTeachers()" [value]="teacher._id">{{ teacher.fullName }}</option>
              </select>
            </label>
            <label>Ngày test
              <input name="testDate" type="date" [ngModel]="form.testDate" (ngModelChange)="onTestDateChange($event)" />
            </label>
            <div class="quick-slots modal-slot-finder full-grid" *ngIf="!editingId && canCreate()">
              <div class="quick-slots-head">
                <div>
                  <strong>Tìm slot test trống</strong>
                  <span>Chọn nhanh theo khoảng ngày, khung giờ và giáo viên ưu tiên.</span>
                </div>
                <button class="secondary" type="button" (click)="findAvailableSlots()" [disabled]="availableSlotsLoading()">Tìm slot</button>
              </div>
              <div class="quick-slot-filters">
                <label>Từ ngày
                  <input type="date" name="modalSlotFromDate" [(ngModel)]="slotSearch.fromDate" />
                </label>
                <label>Đến ngày
                  <input type="date" name="modalSlotToDate" [(ngModel)]="slotSearch.toDate" />
                </label>
                <label>Từ giờ
                  <input type="time" step="1800" name="modalSlotPreferredStart" [(ngModel)]="slotSearch.preferredStart" />
                </label>
                <label>Đến giờ
                  <input type="time" step="1800" name="modalSlotPreferredEnd" [(ngModel)]="slotSearch.preferredEnd" />
                </label>
                <label>GV ưu tiên
                  <select name="modalSlotTeacher" [(ngModel)]="slotSearch.experienceTeacherId">
                    <option value="">Tất cả GV trải nghiệm</option>
                    <option *ngFor="let teacher of experienceTeachers()" [value]="teacher._id">{{ teacher.fullName }}</option>
                  </select>
                </label>
              </div>
              <div class="slot-loading" *ngIf="availableSlotsLoading()">Đang tìm slot...</div>
              <div class="available-slot-grid" *ngIf="!availableSlotsLoading() && availableSlots().length">
                <button
                  type="button"
                  class="available-slot-card"
                  *ngFor="let slot of availableSlots()"
                  (click)="applySlotToForm(slot)"
                >
                  <strong>{{ slot.date }} {{ slot.startTime }}-{{ slot.endTime }}</strong>
                  <span>{{ slot.teacherName || teacherLabelById(slot.experienceTeacherId) }}</span>
                </button>
              </div>
            </div>
            <div class="slot-panel full-grid" *ngIf="!scheduleTeacherId() && form.testDate">
              <div class="slot-panel-head">
                <div>
                  <strong>Giờ test</strong>
                  <span>Chọn GV trải nghiệm để hiện các khung giờ xanh/đỏ, hoặc dùng phần tìm slot trống ở trên.</span>
                </div>
              </div>
            </div>
            <div class="slot-panel full-grid" *ngIf="scheduleTeacherId() && form.testDate">
              <div class="slot-panel-head">
                <div>
                  <strong>Giờ test</strong>
                  <span>Khung 30 phút từ 08:00 đến 21:00</span>
                </div>
                <div class="slot-legend">
                  <span><i class="dot green"></i>Còn trống</span>
                  <span><i class="dot red"></i>Đã có lịch</span>
                </div>
              </div>
              <div class="slot-loading" *ngIf="testSlotsLoading()">Đang tải khung giờ...</div>
              <div class="slot-grid" *ngIf="!testSlotsLoading()">
                <button
                  type="button"
                  class="slot-button"
                  *ngFor="let slot of testSlots()"
                  [class.slot-available]="slot.available"
                  [class.slot-busy]="!slot.available"
                  [class.slot-selected]="isSelectedSlot(slot)"
                  [disabled]="!slot.available"
                  (click)="selectTestSlot(slot)"
                >
                  <span>{{ slot.startTime }}</span>
                  <small>{{ slot.available ? 'Còn trống' : 'Đã có lịch' }}</small>
                </button>
              </div>
            </div>
            <label *ngIf="isExperienceTeacherRole()">GV trải nghiệm
              <input [value]="currentUserName" disabled />
            </label>
            <label *ngIf="editingId">Trạng thái
              <select name="status" [(ngModel)]="form.status">
                <option *ngFor="let status of editableStatuses()" [value]="status">{{ statusLabel(status) }}</option>
              </select>
            </label>
            <label>Số lượt test dự kiến
              <input name="maxTrialSessions" type="number" min="1" [(ngModel)]="form.maxTrialSessions" />
            </label>
            <label *ngIf="editingId">Số lượt test đã thực hiện
              <input name="trialSessionsUsed" type="number" min="0" [(ngModel)]="form.trialSessionsUsed" />
            </label>
            <label *ngIf="editingId">Điểm test (0-100)
              <input name="assessmentScore" type="number" min="0" max="100" [(ngModel)]="form.assessmentScore" />
            </label>
            <label *ngIf="editingId">Level đề xuất
              <input name="recommendedLevel" [(ngModel)]="form.recommendedLevel" placeholder="VD: A2, B1, Starter" />
            </label>
            <label *ngIf="editingId">Thời lượng test (phút)
              <input name="testDurationMinutes" type="number" min="0" [(ngModel)]="form.testDurationMinutes" />
            </label>
            <label *ngIf="editingId">Link Zoom
              <input name="zoomMeetingUrl" [(ngModel)]="form.zoomMeetingUrl" placeholder="https://..." />
            </label>
            <label *ngIf="editingId">Link video Zoom
              <input name="zoomRecordingUrl" [(ngModel)]="form.zoomRecordingUrl" placeholder="https://..." />
            </label>
          </div>
          <div class="score-grid" *ngIf="editingId">
            <label>Nghe<input name="listeningScore" type="number" min="0" max="100" [(ngModel)]="form.listeningScore" /></label>
            <label>Nói<input name="speakingScore" type="number" min="0" max="100" [(ngModel)]="form.speakingScore" /></label>
            <label>Đọc<input name="readingScore" type="number" min="0" max="100" [(ngModel)]="form.readingScore" /></label>
            <label>Viết<input name="writingScore" type="number" min="0" max="100" [(ngModel)]="form.writingScore" /></label>
            <label>Phát âm<input name="pronunciationScore" type="number" min="0" max="100" [(ngModel)]="form.pronunciationScore" /></label>
            <label>Ngữ pháp<input name="grammarScore" type="number" min="0" max="100" [(ngModel)]="form.grammarScore" /></label>
            <label>Từ vựng<input name="vocabularyScore" type="number" min="0" max="100" [(ngModel)]="form.vocabularyScore" /></label>
            <label>Phản xạ<input name="reflexScore" type="number" min="0" max="100" [(ngModel)]="form.reflexScore" /></label>
            <label>Tự tin<input name="confidenceScore" type="number" min="0" max="100" [(ngModel)]="form.confidenceScore" /></label>
            <label>Tập trung<input name="focusScore" type="number" min="0" max="100" [(ngModel)]="form.focusScore" /></label>
          </div>
          <div class="result-images" *ngIf="editingId">
            <label class="full">Ảnh kết quả test
              <input type="file" accept="image/*" (change)="handleResultImageUpload($event)" [disabled]="uploadingResultImage()" />
            </label>
            <div class="upload-status">
              <span *ngIf="uploadingResultImage()">Đang tải ảnh...</span>
              <span class="error" *ngIf="resultUploadError()">{{ resultUploadError() }}</span>
            </div>
            <div class="result-image-list" *ngIf="form.resultImageUrls.length">
              <div class="result-image-item" *ngFor="let url of form.resultImageUrls; let i = index">
                <a [href]="resolveAssetUrl(url)" target="_blank" rel="noopener">
                  <img [src]="resolveAssetUrl(url)" alt="Ảnh kết quả test" />
                </a>
                <button type="button" class="btn-sm danger" (click)="removeResultImage(i)">Xóa</button>
              </div>
            </div>
          </div>
          <label class="full">Ghi chú
            <textarea name="notes" [(ngModel)]="form.notes" rows="3"></textarea>
          </label>
          <label class="full" *ngIf="editingId">Nhận xét test / chấm bài
            <textarea name="assessmentNotes" [(ngModel)]="form.assessmentNotes" rows="3"></textarea>
          </label>
          <div class="form-grid" *ngIf="editingId">
            <label>Tiềm năng chốt
              <select name="closingPotential" [(ngModel)]="form.closingPotential">
                <option value="UNKNOWN">Chưa rõ</option>
                <option value="HIGH">Cao</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="LOW">Thấp</option>
              </select>
            </label>
            <label>Gói đề xuất
              <input name="suggestedPackage" [(ngModel)]="form.suggestedPackage" />
            </label>
            <label>Lịch học đề xuất
              <input name="suggestedSchedule" [(ngModel)]="form.suggestedSchedule" placeholder="VD: 2 buổi/tuần, 60 phút" />
            </label>
          </div>
          <label class="full" *ngIf="editingId">Lỗ hổng kiến thức
            <textarea name="learningGaps" [(ngModel)]="form.learningGaps" rows="2"></textarea>
          </label>
          <label class="full" *ngIf="editingId">Điểm mạnh
            <textarea name="strengthsObserved" [(ngModel)]="form.strengthsObserved" rows="2"></textarea>
          </label>
          <label class="full" *ngIf="editingId">Điểm cần cải thiện
            <textarea name="improvementAreas" [(ngModel)]="form.improvementAreas" rows="2"></textarea>
          </label>
          <label class="full" *ngIf="editingId">Lộ trình đề xuất
            <textarea name="recommendedRoadmap" [(ngModel)]="form.recommendedRoadmap" rows="3"></textarea>
          </label>
          <label class="full" *ngIf="editingId">Ghi chú hỗ trợ Sale chốt
            <textarea name="salesAdvice" [(ngModel)]="form.salesAdvice" rows="3"></textarea>
          </label>
          <label class="full" *ngIf="editingId">Ghi chú kỹ thuật Zoom
            <textarea name="technicalNotes" [(ngModel)]="form.technicalNotes" rows="2"></textarea>
          </label>
          <div class="form-actions">
            <button type="submit" class="primary">{{ editingId ? 'Cập nhật' : 'Tạo buổi test' }}</button>
            <button type="button" (click)="closeModal()">Hủy</button>
          </div>
          <p class="error" *ngIf="error()">{{ error() }}</p>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      gap:16px;
      margin-bottom:18px;
      padding:20px 22px;
      border-radius:20px;
      border:1px solid rgba(148, 163, 184, 0.18);
      background:
        radial-gradient(circle at top right, rgba(245, 158, 11, 0.15), transparent 24%),
        linear-gradient(135deg, #ecfeff 0%, #fff7ed 100%);
      box-shadow:0 16px 32px rgba(15, 23, 42, 0.06);
    }
    .page-header h2 {
      margin:0 0 6px;
      font-size:28px;
      letter-spacing:-0.03em;
      color:#0f172a;
    }
    .page-header p {
      margin:0;
      color:#475569;
      line-height:1.6;
      max-width:760px;
    }
    .eyebrow {
      margin:0 0 8px;
      color:#0f766e;
      text-transform:uppercase;
      letter-spacing:0.12em;
      font-size:11px;
      font-weight:800;
    }
    .header-actions {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }
    .primary,
    .secondary,
    .btn-sm {
      border:none;
      border-radius:999px;
      min-height:40px;
      padding:0 16px;
      cursor:pointer;
      font-weight:700;
      transition:transform .15s ease, box-shadow .15s ease, opacity .15s ease;
    }
    .primary {
      color:#fff;
      background:linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      box-shadow:0 12px 24px rgba(15, 118, 110, 0.18);
    }
    .secondary {
      color:#0f172a;
      background:#fff;
      border:1px solid rgba(148, 163, 184, 0.35);
    }
    .btn-sm {
      min-height:34px;
      padding:0 12px;
      font-size:13px;
      background:#e2e8f0;
      color:#0f172a;
    }
    .btn-sm.success {
      background:#dcfce7;
      color:#166534;
    }
    .btn-sm.warning {
      background:#fef3c7;
      color:#92400e;
    }
    .btn-sm.danger {
      background:#fee2e2;
      color:#b91c1c;
    }
    .primary:hover,
    .secondary:hover,
    .btn-sm:hover {
      transform:translateY(-1px);
    }
    .info-banner {
      display:flex;
      justify-content:space-between;
      gap:16px;
      padding:16px 18px;
      margin-bottom:18px;
      border-radius:18px;
      background:#fff;
      border:1px solid rgba(226, 232, 240, 0.9);
      box-shadow:0 12px 28px rgba(15, 23, 42, 0.05);
    }
    .info-banner strong {
      display:block;
      margin-bottom:4px;
      color:#0f172a;
    }
    .info-banner span,
    .banner-note {
      color:#475569;
      line-height:1.6;
    }
    .banner-note {
      max-width:540px;
      text-align:right;
    }
    .summary-grid {
      display:grid;
      gap:14px;
      grid-template-columns:repeat(auto-fit, minmax(160px, 1fr));
      margin-bottom:18px;
    }
    .summary-card {
      padding:16px;
      border-radius:18px;
      background:#fff;
      border:1px solid rgba(226, 232, 240, 0.9);
      box-shadow:0 12px 28px rgba(15, 23, 42, 0.05);
    }
    .summary-card.accent {
      background:linear-gradient(135deg, #ecfeff 0%, #f8fafc 100%);
    }
    .summary-card.success {
      background:linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
    }
    .summary-card.danger {
      background:linear-gradient(135deg, #fff1f2 0%, #f8fafc 100%);
    }
    .summary-label {
      display:block;
      margin-bottom:8px;
      color:#64748b;
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:0.08em;
      font-weight:700;
    }
    .summary-card strong {
      color:#0f172a;
      font-size:28px;
      letter-spacing:-0.03em;
    }
    .filters {
      display:grid;
      gap:12px;
      grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));
      margin-bottom:18px;
    }
    .quick-slots {
      margin-bottom:18px;
      padding:14px;
      border:1px solid rgba(226, 232, 240, 0.95);
      border-radius:14px;
      background:#fff;
      box-shadow:0 12px 28px rgba(15, 23, 42, 0.04);
    }
    .modal-slot-finder {
      margin:4px 0 0;
      background:#f8fafc;
      box-shadow:none;
    }
    .quick-slots-head,
    .pagination-bar {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
    }
    .quick-slots-head strong {
      display:block;
      color:#0f172a;
      margin-bottom:3px;
    }
    .quick-slots-head span {
      color:#64748b;
      font-size:13px;
    }
    .quick-slot-filters {
      display:grid;
      gap:10px;
      grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));
      margin-top:12px;
    }
    .available-slot-grid {
      display:grid;
      gap:8px;
      grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
      margin-top:10px;
    }
    .available-slot-card {
      min-height:62px;
      border:1px solid #86efac;
      border-radius:8px;
      background:#ecfdf5;
      color:#166534;
      padding:9px 10px;
      cursor:pointer;
      text-align:left;
      display:flex;
      flex-direction:column;
      justify-content:center;
      gap:3px;
    }
    .available-slot-card strong,
    .available-slot-card span {
      display:block;
    }
    .available-slot-card span {
      font-size:12px;
      font-weight:700;
      opacity:.82;
    }
    .pagination-bar {
      margin-bottom:12px;
      color:#475569;
      font-size:13px;
      font-weight:700;
    }
    .pagination-bar > div {
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }
    .pagination-bar select {
      min-height:38px;
      border:1px solid #cbd5e1;
      border-radius:10px;
      padding:0 10px;
      background:#fff;
    }
    .page-feedback {
      margin-bottom:18px;
      padding:12px 16px;
      border-radius:14px;
      font-weight:700;
      border:1px solid transparent;
    }
    .page-feedback-success {
      background:#ecfdf5;
      border-color:#bbf7d0;
      color:#166534;
    }
    .page-feedback-error {
      background:#fef2f2;
      border-color:#fecaca;
      color:#b91c1c;
    }
    .filters input,
    .filters select,
    .quick-slots input,
    .quick-slots select,
    .modal input,
    .modal select,
    .modal textarea {
      width:100%;
      padding:10px 12px;
      border:1px solid #cbd5e1;
      border-radius:12px;
      background:#fff;
      color:#0f172a;
      outline:none;
    }
    .table-wrap {
      width:100%;
      overflow:auto;
      border-radius:18px;
      border:1px solid rgba(226, 232, 240, 0.95);
      background:#fff;
      box-shadow:0 18px 32px rgba(15, 23, 42, 0.05);
    }
    .data {
      width:100%;
      min-width:1280px;
      border-collapse:collapse;
    }
    th, td {
      padding:12px 14px;
      border-bottom:1px solid #e2e8f0;
      vertical-align:top;
    }
    thead {
      background:#f8fafc;
      position:sticky;
      top:0;
      z-index:1;
    }
    th {
      text-align:left;
      font-size:12px;
      color:#64748b;
      text-transform:uppercase;
      letter-spacing:0.08em;
    }
    .primary-text {
      font-weight:700;
      color:#0f172a;
    }
    .muted-line {
      margin-top:4px;
      color:#64748b;
      font-size:12px;
    }
    .status-note {
      font-weight:600;
      color:#92400e;
    }
    .session-pill {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      background:#eef2ff;
      color:#3730a3;
      font-size:12px;
      font-weight:700;
    }
    .badge {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      padding:0 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
    }
    .actions-cell {
      white-space:nowrap;
    }
    .actions-cell .btn-sm {
      margin-right:6px;
      margin-bottom:4px;
    }
    .empty-state {
      margin-top:16px;
      padding:34px 20px;
      border-radius:18px;
      background:#fff;
      border:1px dashed #cbd5e1;
      text-align:center;
      color:#64748b;
    }
    .empty-state h3 {
      margin:0 0 8px;
      color:#0f172a;
    }
    .modal-backdrop {
      position:fixed;
      inset:0;
      z-index:1000;
      background:rgba(15, 23, 42, 0.58);
      display:flex;
      align-items:flex-start;
      justify-content:center;
      padding:16px;
      overflow:auto;
    }
    .modal {
      width:min(980px, calc(100vw - 32px));
      max-height:calc(100vh - 32px);
      background:#fff;
      border-radius:20px;
      box-shadow:0 20px 44px rgba(15, 23, 42, 0.22);
      padding:20px;
      overflow:auto;
    }
    .modal h3 {
      margin:0 0 14px;
      color:#0f172a;
    }
    .form-grid {
      display:grid;
      gap:12px;
      grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));
    }
    .full-grid {
      grid-column:1 / -1;
    }
    label {
      display:flex;
      flex-direction:column;
      gap:6px;
      color:#0f172a;
      font-weight:600;
      font-size:14px;
    }
    .full {
      margin-top:12px;
    }
    .score-grid {
      margin-top:12px;
      display:grid;
      gap:10px;
      grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));
      padding:12px;
      border:1px solid #e2e8f0;
      border-radius:10px;
      background:#f8fafc;
    }
    .slot-panel {
      padding:12px;
      border:1px solid #dbeafe;
      border-radius:10px;
      background:#f8fafc;
    }
    .slot-panel-head {
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:12px;
      margin-bottom:10px;
    }
    .slot-panel-head strong,
    .slot-panel-head span {
      display:block;
    }
    .slot-panel-head strong {
      color:#0f172a;
      font-size:14px;
    }
    .slot-panel-head span {
      color:#64748b;
      font-size:12px;
    }
    .slot-legend {
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      color:#475569;
      font-size:12px;
      font-weight:700;
    }
    .slot-legend span {
      display:inline-flex;
      align-items:center;
      gap:5px;
    }
    .dot {
      width:8px;
      height:8px;
      border-radius:999px;
      display:inline-block;
    }
    .dot.green {
      background:#16a34a;
    }
    .dot.red {
      background:#dc2626;
    }
    .slot-loading {
      color:#64748b;
      font-size:13px;
      min-height:36px;
      display:flex;
      align-items:center;
    }
    .slot-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit, minmax(96px, 1fr));
      gap:8px;
    }
    .slot-button {
      min-height:54px;
      border:1px solid transparent;
      border-radius:8px;
      padding:7px 8px;
      background:#fff;
      color:#0f172a;
      cursor:pointer;
      display:flex;
      flex-direction:column;
      align-items:flex-start;
      justify-content:center;
      gap:2px;
      font-weight:800;
    }
    .slot-button small {
      color:inherit;
      font-size:11px;
      font-weight:700;
      opacity:.8;
    }
    .slot-available {
      background:#ecfdf5;
      border-color:#86efac;
      color:#166534;
    }
    .slot-busy {
      background:#fef2f2;
      border-color:#fecaca;
      color:#b91c1c;
    }
    .slot-selected {
      box-shadow:0 0 0 2px #0f766e inset;
      background:#ccfbf1;
      border-color:#0f766e;
      color:#0f172a;
    }
    .result-images {
      margin-top:12px;
      padding:12px;
      border:1px solid #e2e8f0;
      border-radius:10px;
      background:#fff;
    }
    .upload-status {
      min-height:20px;
      color:#64748b;
      font-size:13px;
    }
    .result-image-list {
      display:flex;
      flex-wrap:wrap;
      gap:10px;
      margin-top:8px;
    }
    .result-image-item {
      width:132px;
      display:flex;
      flex-direction:column;
      gap:6px;
    }
    .result-image-item img {
      width:132px;
      height:86px;
      object-fit:cover;
      border:1px solid #cbd5e1;
      border-radius:8px;
      background:#f8fafc;
    }
    .form-actions {
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:16px;
    }
    .req {
      color:#dc2626;
    }
    .error {
      margin:12px 0 0;
      color:#dc2626;
      font-weight:600;
    }
    button:disabled {
      opacity:.55;
      cursor:not-allowed;
      transform:none;
    }
    @media (max-width: 768px) {
      .page-header,
      .info-banner {
        flex-direction:column;
      }
      .banner-note {
        text-align:left;
      }
      .page-header h2 {
        font-size:24px;
      }
      .modal {
        width:calc(100vw - 16px);
        max-height:calc(100vh - 16px);
        padding:16px;
      }
      .form-actions,
      .header-actions {
        width:100%;
      }
      .form-actions {
        justify-content:stretch;
      }
      .form-actions button,
      .header-actions button {
        flex:1;
      }
    }
  `],
})
export class TrialEnrollmentsComponent implements OnInit {
  items = signal<TrialEnrollmentItem[]>([]);
  classes = signal<ClassItem[]>([]);
  products = signal<ProductItem[]>([]);
  sales = signal<UserItem[]>([]);
  experienceTeachers = signal<UserItem[]>([]);
  loading = signal(false);
  error = signal('');
  pageFeedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  showModal = signal(false);
  actionLoadingId = signal<string | null>(null);
  uploadingResultImage = signal(false);
  resultUploadError = signal('');
  testSlots = signal<TrialTestSlot[]>([]);
  testSlotsLoading = signal(false);
  availableSlots = signal<AvailableTrialTestSlot[]>([]);
  availableSlotsLoading = signal(false);
  totalItems = signal(0);
  totalPages = signal(1);
  summaryStats = signal({
    total: 0,
    active: 0,
    waiting: 0,
    converted: 0,
    rejected: 0,
  });

  editingId: string | null = null;
  keyword = '';
  statusFilter = '';
  classFilter = '';
  productFilter = '';
  page = 1;
  pageSize = 50;
  private lookupsLoaded = false;
  currentUserId = '';
  currentUserName = '';
  currentRole = '';
  form: TrialForm = this.blankForm();
  slotSearch: SlotSearchForm = {
    fromDate: this.todayInputDate(),
    toDate: this.addDaysInputDate(6),
    preferredStart: '17:00',
    preferredEnd: '21:00',
    experienceTeacherId: '',
    limit: 20,
  };

  readonly statusOptions = STATUS_OPTIONS;

  constructor(
    private readonly trialService: TrialEnrollmentService,
    private readonly classService: ClassService,
    private readonly productService: ProductService,
    private readonly userService: UserService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    const user = this.auth.userSignal();
    this.currentUserId = user?.sub || user?._id || '';
    this.currentUserName = user?.fullName || '';
    this.currentRole = user?.role || '';
    if (this.isSaleRole()) {
      this.form.saleId = this.currentUserId;
    }
    void this.reload();
  }

  isSaleRole(): boolean {
    return this.currentRole === 'SALE';
  }

  isExperienceTeacherRole(): boolean {
    return this.currentRole === 'EXPERIENCE_TEACHER';
  }

  isDecisionRole(): boolean {
    return this.currentRole === 'DIRECTOR' || this.currentRole === 'OPS';
  }

  canCreate(): boolean {
    return this.currentRole === 'DIRECTOR' || this.currentRole === 'OPS' || this.currentRole === 'SALE';
  }

  canEdit(item: TrialEnrollmentItem): boolean {
    if (this.isDecisionRole()) return true;
    if (this.isExperienceTeacherRole()) {
      return this.resolveId(item.experienceTeacherId) === this.currentUserId;
    }
    if (!this.isSaleRole()) return false;
    return this.resolveId(item.saleId) === this.currentUserId || !this.resolveId(item.saleId);
  }

  canApprove(item: TrialEnrollmentItem): boolean {
    return this.isDecisionRole() && item.status !== 'CONVERTED' && item.status !== 'REJECTED';
  }

  canTeacherPaidOnly(item: TrialEnrollmentItem): boolean {
    return false;
  }

  isActionLoading(item: TrialEnrollmentItem): boolean {
    return this.actionLoadingId() === item._id;
  }

  editableStatuses(): TrialEnrollmentStatus[] {
    return this.isDecisionRole() ? STATUS_OPTIONS : ['PENDING_TRIAL', 'WAITING_DECISION'];
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const lookupsPromise = this.lookupsLoaded
        ? Promise.resolve(null)
        : Promise.all([
            this.classService.list(),
            this.productService.list(),
            this.userService.listSales(),
            this.userService.listExperienceTeachers(),
          ]);
      const [pageResult, summary, lookups] = await Promise.all([
        this.trialService.listPage({
          keyword: this.keyword.trim() || undefined,
          status: this.statusFilter || undefined,
          classId: this.classFilter || undefined,
          productId: this.productFilter || undefined,
          page: this.page,
          limit: this.pageSize,
        }),
        this.trialService.getSummary(),
        lookupsPromise,
      ]);
      this.items.set(pageResult.items || []);
      this.totalItems.set(pageResult.total || 0);
      this.totalPages.set(pageResult.totalPages || 1);
      this.summaryStats.set({
        total: summary.total || 0,
        active: summary.active || 0,
        waiting: summary.waitingDecision || 0,
        converted: summary.converted || 0,
        rejected: summary.rejected || 0,
      });
      if (lookups) {
        const [classes, products, sales, experienceTeachers] = lookups;
        this.classes.set((classes || []).filter((cls) => cls.classMode === 'OFFLINE'));
        this.products.set((products || []).filter((product) => product.teachingMode !== 'ONLINE'));
        this.sales.set((sales || []).sort((a, b) => a.fullName.localeCompare(b.fullName)));
        this.experienceTeachers.set((experienceTeachers || []).sort((a, b) => a.fullName.localeCompare(b.fullName)));
        this.lookupsLoaded = true;
      }
      if (this.isSaleRole() && !this.form.saleId) {
        this.form.saleId = this.currentUserId;
      }
      if (this.isExperienceTeacherRole() && !this.form.experienceTeacherId) {
        this.form.experienceTeacherId = this.currentUserId;
      }
    } catch (err: any) {
      this.error.set(this.extractMessage(err) || 'Không thể tải danh sách buổi test');
    } finally {
      this.loading.set(false);
    }
  }

  filteredItems(): TrialEnrollmentItem[] {
    return this.items();
  }

  summary() {
    return this.summaryStats();
  }

  applyFilters(): void {
    this.page = 1;
    void this.reload();
  }

  changePage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages() || nextPage === this.page) return;
    this.page = nextPage;
    void this.reload();
  }

  onPageSizeChange(value: number): void {
    this.pageSize = Number(value) || 50;
    this.page = 1;
    void this.reload();
  }

  offlineClasses(): ClassItem[] {
    return this.classes().slice().sort((a, b) => this.classLabel(a).localeCompare(this.classLabel(b)));
  }

  offlineProducts(): ProductItem[] {
    return this.products().slice().sort((a, b) => this.productLabel(a).localeCompare(this.productLabel(b)));
  }

  scheduleTeacherId(): string {
    return this.isExperienceTeacherRole() ? this.currentUserId : this.form.experienceTeacherId;
  }

  onExperienceTeacherChange(value: string): void {
    this.form.experienceTeacherId = value || '';
    this.clearSelectedTestSlot();
    void this.loadTestSlots();
  }

  onTestDateChange(value: string): void {
    this.form.testDate = value || '';
    this.clearSelectedTestSlot();
    void this.loadTestSlots();
  }

  async loadTestSlots(): Promise<void> {
    const teacherId = this.scheduleTeacherId();
    if (!teacherId || !this.form.testDate) {
      this.testSlots.set([]);
      return;
    }

    this.testSlotsLoading.set(true);
    try {
      const slots = await this.trialService.getTestSlots({
        experienceTeacherId: teacherId,
        date: this.form.testDate,
        excludeId: this.editingId || undefined,
      });
      this.testSlots.set(slots);
    } finally {
      this.testSlotsLoading.set(false);
    }
  }

  selectTestSlot(slot: TrialTestSlot): void {
    if (!slot.available) return;
    this.form.testStartTime = slot.startTime;
    this.form.testEndTime = slot.endTime;
  }

  isSelectedSlot(slot: TrialTestSlot): boolean {
    return this.form.testStartTime === slot.startTime && this.form.testEndTime === slot.endTime;
  }

  async findAvailableSlots(): Promise<void> {
    this.availableSlotsLoading.set(true);
    this.pageFeedback.set(null);
    try {
      const slots = await this.trialService.getAvailableSlots({
        fromDate: this.slotSearch.fromDate,
        toDate: this.slotSearch.toDate,
        preferredStart: this.slotSearch.preferredStart,
        preferredEnd: this.slotSearch.preferredEnd,
        experienceTeacherId: this.slotSearch.experienceTeacherId || undefined,
        limit: this.slotSearch.limit,
      });
      this.availableSlots.set(slots);
      if (!slots.length) {
        this.pageFeedback.set({ type: 'error', message: 'Không tìm thấy slot trống trong khung đã chọn' });
      }
    } finally {
      this.availableSlotsLoading.set(false);
    }
  }

  openCreateWithSlot(slot: AvailableTrialTestSlot): void {
    this.openCreate();
    this.applySlotToForm(slot);
  }

  applySlotToForm(slot: AvailableTrialTestSlot): void {
    this.form.experienceTeacherId = slot.experienceTeacherId;
    this.form.testDate = slot.date;
    this.form.testStartTime = slot.startTime;
    this.form.testEndTime = slot.endTime;
    void this.loadTestSlots();
  }

  private clearSelectedTestSlot(): void {
    this.form.testStartTime = '';
    this.form.testEndTime = '';
  }

  openCreate(): void {
    if (!this.canCreate()) return;
    this.editingId = null;
    this.form = this.blankForm();
    this.pageFeedback.set(null);
    if (this.isSaleRole()) {
      this.form.saleId = this.currentUserId;
    }
    if (this.isExperienceTeacherRole()) {
      this.form.experienceTeacherId = this.currentUserId;
    }
    this.error.set('');
    this.showModal.set(true);
    void this.loadTestSlots();
  }

  edit(item: TrialEnrollmentItem): void {
    if (!this.canEdit(item)) return;
    this.pageFeedback.set(null);
    this.editingId = item._id;
    this.form = {
      studentName: item.studentName || '',
      studentPhone: item.studentPhone || '',
      parentName: item.parentName || '',
      parentPhone: item.parentPhone || '',
      parentEmail: item.parentEmail || '',
      classId: this.resolveId(item.classId),
      productId: this.resolveId(item.productId),
      saleId: this.resolveId(item.saleId) || (this.isSaleRole() ? this.currentUserId : ''),
      experienceTeacherId: this.resolveId(item.experienceTeacherId) || (this.isExperienceTeacherRole() ? this.currentUserId : ''),
      testDate: this.dateInputValue(item.testDate),
      testStartTime: item.testStartTime || '',
      testEndTime: item.testEndTime || '',
      status: (item.status as TrialEnrollmentStatus) || 'PENDING_TRIAL',
      maxTrialSessions: item.maxTrialSessions || 2,
      trialSessionsUsed: item.trialSessionsUsed || 0,
      notes: item.notes || '',
      assessmentScore: item.assessmentScore ?? null,
      recommendedLevel: item.recommendedLevel || '',
      assessmentNotes: item.assessmentNotes || '',
      zoomMeetingUrl: item.zoomMeetingUrl || '',
      zoomRecordingUrl: item.zoomRecordingUrl || '',
      resultImageUrls: item.resultImageUrls || [],
      listeningScore: item.listeningScore ?? null,
      speakingScore: item.speakingScore ?? null,
      readingScore: item.readingScore ?? null,
      writingScore: item.writingScore ?? null,
      pronunciationScore: item.pronunciationScore ?? null,
      grammarScore: item.grammarScore ?? null,
      vocabularyScore: item.vocabularyScore ?? null,
      reflexScore: item.reflexScore ?? null,
      confidenceScore: item.confidenceScore ?? null,
      focusScore: item.focusScore ?? null,
      testDurationMinutes: item.testDurationMinutes ?? null,
      learningGaps: item.learningGaps || '',
      strengthsObserved: item.strengthsObserved || '',
      improvementAreas: item.improvementAreas || '',
      recommendedRoadmap: item.recommendedRoadmap || '',
      suggestedPackage: item.suggestedPackage || '',
      suggestedSchedule: item.suggestedSchedule || '',
      salesAdvice: item.salesAdvice || '',
      closingPotential: item.closingPotential || 'UNKNOWN',
      technicalNotes: item.technicalNotes || '',
    };
    this.error.set('');
    this.showModal.set(true);
    void this.loadTestSlots();
  }

  closeModal(): void {
    this.showModal.set(false);
    this.error.set('');
    this.testSlots.set([]);
  }

  async submit(): Promise<void> {
    const payload = this.buildPayload();
    if (!payload) return;

    const result = this.editingId
      ? await this.trialService.update(this.editingId, payload)
      : await this.trialService.create(payload);

    if (!result.ok) {
      this.error.set(result.message || 'Không thể lưu buổi test');
      return;
    }

    this.closeModal();
    this.pageFeedback.set({
      type: 'success',
      message: this.editingId ? 'Đã cập nhật buổi test' : 'Đã tạo buổi test mới',
    });
    await this.reload();
  }

  async markWaiting(item: TrialEnrollmentItem): Promise<void> {
    if (!this.canEdit(item)) return;
    this.pageFeedback.set(null);
    this.actionLoadingId.set(item._id);
    try {
      const result = await this.trialService.markWaitingDecision(item._id, item.notes);
      if (!result.ok) {
        this.pageFeedback.set({ type: 'error', message: result.message || 'Không thể đánh dấu chờ quyết định' });
        return;
      }
      this.pageFeedback.set({ type: 'success', message: 'Đã chuyển buổi test sang trạng thái chờ tư vấn' });
      await this.reload();
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async convert(item: TrialEnrollmentItem): Promise<void> {
    if (!this.canApprove(item)) return;
    this.pageFeedback.set(null);
    this.actionLoadingId.set(item._id);
    try {
      const result = await this.trialService.convert(item._id, item.decisionNotes);
      if (!result.ok) {
        this.pageFeedback.set({ type: 'error', message: result.message || 'Không thể chốt học sau buổi test' });
        return;
      }
      this.pageFeedback.set({ type: 'success', message: 'Đã chốt học sau buổi test và chuyển thành học viên chính thức' });
      await this.reload();
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async reject(item: TrialEnrollmentItem): Promise<void> {
    if (!this.canApprove(item)) return;
    this.pageFeedback.set(null);
    this.actionLoadingId.set(item._id);
    try {
      const result = await this.trialService.reject(item._id, item.decisionNotes);
      if (!result.ok) {
        this.pageFeedback.set({ type: 'error', message: result.message || 'Không thể chốt không tiếp tục sau buổi test' });
        return;
      }
      this.pageFeedback.set({ type: 'success', message: 'Đã chốt không tiếp tục sau buổi test' });
      await this.reload();
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  async teacherPaidOnly(item: TrialEnrollmentItem): Promise<void> {
    this.pageFeedback.set({
      type: 'error',
      message: 'Rule học thử thật không hỗ trợ trả lương giáo viên riêng khi phụ huynh không học tiếp; buổi test học sinh dùng lương giáo viên trải nghiệm.',
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING_TRIAL: 'Chờ test',
      WAITING_DECISION: 'Đã test, chờ tư vấn',
      CONVERTED: 'Đã chốt học',
      REJECTED: 'Không tiếp tục',
    };
    return labels[status] || status;
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      PENDING_TRIAL: '#0284c7',
      WAITING_DECISION: '#d97706',
      CONVERTED: '#16a34a',
      REJECTED: '#dc2626',
    };
    return colors[status] || '#475569';
  }

  trialCode(item: TrialEnrollmentItem): string {
    return item.trialCode || `KT-${item._id.slice(-6).toUpperCase()}`;
  }

  classLabel(item: ClassItem): string {
    return `${item.name}${item.code ? ` (${item.code})` : ''}`;
  }

  productLabel(item: ProductItem): string {
    return `${item.name}${item.code ? ` (${item.code})` : ''}`;
  }

  classLabelByRef(ref: TrialEnrollmentItem['classId']): string {
    if (ref && typeof ref !== 'string' && ref.name) {
      return `${ref.name}${ref.code ? ` (${ref.code})` : ''}`;
    }
    const id = this.resolveId(ref);
    const found = this.classes().find((item) => item._id === id);
    if (found) return this.classLabel(found);
    return id || '-';
  }

  productLabelByRef(ref: TrialEnrollmentItem['productId']): string {
    if (ref && typeof ref !== 'string' && ref.name) {
      return `${ref.name}${ref.code ? ` (${ref.code})` : ''}`;
    }
    const id = this.resolveId(ref);
    const found = this.products().find((item) => item._id === id);
    if (found) return this.productLabel(found);
    return id || '-';
  }

  saleLabelByRef(ref: TrialEnrollmentItem['saleId']): string {
    if (ref && typeof ref !== 'string') {
      return ref.fullName || ref.email || ref._id || '-';
    }
    const id = this.resolveId(ref);
    const found = this.sales().find((item) => item._id === id);
    if (found) return found.fullName || found.email || id || '-';
    return id || '-';
  }

  experienceTeacherLabelByRef(ref: TrialEnrollmentItem['experienceTeacherId']): string {
    if (ref && typeof ref !== 'string') {
      return ref.fullName || ref.email || ref._id || '-';
    }
    const id = this.resolveId(ref);
    return this.teacherLabelById(id);
  }

  teacherLabelById(id: string): string {
    const found = this.experienceTeachers().find((item) => item._id === id);
    if (found) return found.fullName || found.email || id || '-';
    return id || '-';
  }

  testScheduleLabel(item: TrialEnrollmentItem): string {
    if (!item.testDate || !item.testStartTime || !item.testEndTime) return '';
    return `${this.dateInputValue(item.testDate)} ${item.testStartTime}-${item.testEndTime}`;
  }

  async handleResultImageUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.resultUploadError.set('');
    this.uploadingResultImage.set(true);
    try {
      const result = await this.trialService.uploadResultImage(file);
      if (!result.ok || !result.url) {
        this.resultUploadError.set(result.message || 'Không thể tải ảnh kết quả test');
        return;
      }
      this.form.resultImageUrls = [...this.form.resultImageUrls, result.url];
    } finally {
      this.uploadingResultImage.set(false);
      input.value = '';
    }
  }

  removeResultImage(index: number): void {
    this.form.resultImageUrls = this.form.resultImageUrls.filter((_, i) => i !== index);
  }

  resolveAssetUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) return url;
    return `${environment.apiBase}${url}`;
  }

  private optionalScore(value: number | null): number | undefined {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return Number(value);
  }

  private optionalNonNegativeNumber(value: number | null): number | undefined {
    if (value === null || value === undefined || value === ('' as any)) return undefined;
    return Number(value);
  }

  private dateInputValue(value?: string): string {
    return value ? String(value).slice(0, 10) : '';
  }

  private todayInputDate(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private addDaysInputDate(days: number): string {
    const now = new Date();
    now.setDate(now.getDate() + days);
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private buildPayload(): TrialEnrollmentPayload | null {
    const payload: TrialEnrollmentPayload = {
      studentName: this.form.studentName.trim(),
      studentPhone: this.normalizeText(this.form.studentPhone),
      parentName: this.form.parentName.trim(),
      parentPhone: this.form.parentPhone.trim(),
      parentEmail: this.normalizeText(this.form.parentEmail),
      classId: this.form.classId,
      productId: this.form.productId,
      saleId: this.isSaleRole() ? this.currentUserId : this.form.saleId || undefined,
      experienceTeacherId: this.isExperienceTeacherRole() ? this.currentUserId : this.form.experienceTeacherId || undefined,
      maxTrialSessions: Number(this.form.maxTrialSessions || 2),
      notes: this.normalizeText(this.form.notes),
    };
    const testDate = this.normalizeText(this.form.testDate);
    const testStartTime = this.normalizeText(this.form.testStartTime);
    const testEndTime = this.normalizeText(this.form.testEndTime);
    const hasAnySchedule = !!(testStartTime || testEndTime || (payload.experienceTeacherId && testDate));
    const hasCompleteSchedule = !!(testDate && testStartTime && testEndTime);

    if (hasAnySchedule && !hasCompleteSchedule) {
      this.error.set('Vui lòng chọn đầy đủ ngày test và khung giờ test');
      return null;
    }
    if (hasCompleteSchedule && !payload.experienceTeacherId) {
      this.error.set('Vui lòng chọn giáo viên trải nghiệm trước khi đặt giờ test');
      return null;
    }
    if (hasCompleteSchedule) {
      payload.testDate = testDate;
      payload.testStartTime = testStartTime;
      payload.testEndTime = testEndTime;
    }

    if (this.editingId) {
      payload.status = this.form.status;
      payload.trialSessionsUsed = Number(this.form.trialSessionsUsed || 0);
      payload.assessmentScore = this.form.assessmentScore === null || this.form.assessmentScore === undefined
        ? undefined
        : Number(this.form.assessmentScore);
      payload.recommendedLevel = this.normalizeText(this.form.recommendedLevel);
      payload.assessmentNotes = this.normalizeText(this.form.assessmentNotes);
      payload.zoomMeetingUrl = this.normalizeText(this.form.zoomMeetingUrl);
      payload.zoomRecordingUrl = this.normalizeText(this.form.zoomRecordingUrl);
      payload.resultImageUrls = this.form.resultImageUrls;
      payload.listeningScore = this.optionalScore(this.form.listeningScore);
      payload.speakingScore = this.optionalScore(this.form.speakingScore);
      payload.readingScore = this.optionalScore(this.form.readingScore);
      payload.writingScore = this.optionalScore(this.form.writingScore);
      payload.pronunciationScore = this.optionalScore(this.form.pronunciationScore);
      payload.grammarScore = this.optionalScore(this.form.grammarScore);
      payload.vocabularyScore = this.optionalScore(this.form.vocabularyScore);
      payload.reflexScore = this.optionalScore(this.form.reflexScore);
      payload.confidenceScore = this.optionalScore(this.form.confidenceScore);
      payload.focusScore = this.optionalScore(this.form.focusScore);
      payload.testDurationMinutes = this.optionalNonNegativeNumber(this.form.testDurationMinutes);
      payload.learningGaps = this.normalizeText(this.form.learningGaps);
      payload.strengthsObserved = this.normalizeText(this.form.strengthsObserved);
      payload.improvementAreas = this.normalizeText(this.form.improvementAreas);
      payload.recommendedRoadmap = this.normalizeText(this.form.recommendedRoadmap);
      payload.suggestedPackage = this.normalizeText(this.form.suggestedPackage);
      payload.suggestedSchedule = this.normalizeText(this.form.suggestedSchedule);
      payload.salesAdvice = this.normalizeText(this.form.salesAdvice);
      payload.closingPotential = this.form.closingPotential || 'UNKNOWN';
      payload.technicalNotes = this.normalizeText(this.form.technicalNotes);
    }

    if (
      payload.assessmentScore !== undefined &&
      (!Number.isFinite(payload.assessmentScore) || payload.assessmentScore < 0 || payload.assessmentScore > 100)
    ) {
      this.error.set('Điểm test phải nằm trong khoảng 0-100');
      return null;
    }

    const scoreFields = [
      payload.listeningScore,
      payload.speakingScore,
      payload.readingScore,
      payload.writingScore,
      payload.pronunciationScore,
      payload.grammarScore,
      payload.vocabularyScore,
      payload.reflexScore,
      payload.confidenceScore,
      payload.focusScore,
    ];
    if (scoreFields.some((score) => score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100))) {
      this.error.set('Điểm thành phần phải nằm trong khoảng 0-100');
      return null;
    }
    if (payload.testDurationMinutes !== undefined && (!Number.isFinite(payload.testDurationMinutes) || payload.testDurationMinutes < 0)) {
      this.error.set('Thời lượng test không hợp lệ');
      return null;
    }

    if (!payload.studentName || !payload.parentName || !payload.parentPhone || !payload.classId || !payload.productId) {
      this.error.set('Vui lòng nhập đầy đủ thông tin bắt buộc');
      return null;
    }

    return payload;
  }

  private blankForm(): TrialForm {
    return {
      studentName: '',
      studentPhone: '',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      classId: '',
      productId: '',
      saleId: '',
      experienceTeacherId: '',
      testDate: this.todayInputDate(),
      testStartTime: '',
      testEndTime: '',
      status: 'PENDING_TRIAL',
      maxTrialSessions: 2,
      trialSessionsUsed: 0,
      notes: '',
      assessmentScore: null,
      recommendedLevel: '',
      assessmentNotes: '',
      zoomMeetingUrl: '',
      zoomRecordingUrl: '',
      resultImageUrls: [],
      listeningScore: null,
      speakingScore: null,
      readingScore: null,
      writingScore: null,
      pronunciationScore: null,
      grammarScore: null,
      vocabularyScore: null,
      reflexScore: null,
      confidenceScore: null,
      focusScore: null,
      testDurationMinutes: null,
      learningGaps: '',
      strengthsObserved: '',
      improvementAreas: '',
      recommendedRoadmap: '',
      suggestedPackage: '',
      suggestedSchedule: '',
      salesAdvice: '',
      closingPotential: 'UNKNOWN',
      technicalNotes: '',
    };
  }

  private resolveId(ref: TrialEnrollmentItem['classId'] | TrialEnrollmentItem['productId'] | TrialEnrollmentItem['saleId'] | TrialEnrollmentItem['experienceTeacherId'] | TrialEnrollmentItem['studentId'] | TrialEnrollmentItem['orderId'] | TrialEnrollmentItem['invoiceId']): string {
    if (!ref) return '';
    return typeof ref === 'string' ? ref : ref._id;
  }

  private normalizeText(value?: string): string | undefined {
    const normalized = (value || '').trim();
    return normalized || undefined;
  }

  private extractMessage(error: any): string {
    const raw = error?.error?.message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (Array.isArray(raw) && raw.length) return raw.join(', ');
    return error?.message || '';
  }
}
