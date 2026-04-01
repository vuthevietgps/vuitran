import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SessionEditHistoryEntry,
  SessionItem,
  SessionParentConfirmPayload,
  SessionQueryParams,
  SessionService,
} from '../services/session.service';
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
        <p>Xem và quản lý các buổi học, theo dõi tiến trình dạy và thanh toán.</p>
      </div>
      <button class="primary" (click)="openCreate()" *ngIf="canCreate()">+ Tạo buổi học</button>
    </header>

    <app-flow-guide featureKey="sessions"></app-flow-guide>

    <div class="stats-bar" *ngIf="stats()">
      <div class="stat-card">
        <span class="stat-value">{{ stats()!.totalSessions }}</span>
        <span class="stat-label">Tổng buổi</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ formatCurrency(stats()!.totalRevenue) }}</span>
        <span class="stat-label">Doanh thu</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ formatTeacherCurrency(stats()!.totalTeacherCost) }}</span>
        <span class="stat-label">Chi phí GV</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ formatCurrency(stats()!.totalRevenue - stats()!.totalTeacherCost) }}</span>
        <span class="stat-label">Lợi nhuận</span>
      </div>
    </div>

    <div class="filters">
      <select [(ngModel)]="filter.classId" (change)="load()">
        <option value="">Tất cả lớp</option>
        <option *ngFor="let c of classes()" [value]="c._id">{{ c.code }} - {{ c.name }}</option>
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

    <table class="data" *ngIf="sessions().length; else empty">
      <thead>
        <tr>
          <th>Lớp</th>
          <th>Học sinh</th>
          <th>Giáo viên</th>
          <th>Ngày</th>
          <th>{{ timeColumnLabel() }}</th>
          <th *ngIf="showTuitionColumn()">Học phí</th>
          <th>{{ payoutOrDurationColumnLabel() }}</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let s of sessions()" [class]="'row-' + s.status.toLowerCase()">
          <td>{{ s.classId.code || '—' }}</td>
          <td>
            {{ s.studentId.fullName }}
            <small *ngIf="s.studentId.studentCode">({{ s.studentId.studentCode }})</small>
          </td>
          <td>{{ s.teacherId.fullName }}</td>
          <td>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</td>
          <td>{{ timeDisplay(s) }}</td>
          <td *ngIf="showTuitionColumn()" [class.zero-finance]="s.status === 'NO_SHOW' || s.status === 'CANCELLED'">
            {{ formatCurrency(s.amountCharged) }}
            <span *ngIf="s.status === 'NO_SHOW'" class="zero-note" title="Vắng mặt — không thu phí">⊘</span>
            <span *ngIf="s.status === 'CANCELLED'" class="zero-note" title="Đã hủy — không thu phí">⊘</span>
          </td>
          <td *ngIf="showTeacherPayoutColumn(); else durationColumn" [class.zero-finance]="s.status === 'NO_SHOW' || s.status === 'CANCELLED'">
            {{ formatTeacherCurrency(s.teacherPayout) }}
            <span *ngIf="s.status === 'NO_SHOW'" class="zero-note" title="Vắng mặt — không tính lương GV">⊘</span>
            <span *ngIf="s.status === 'CANCELLED'" class="zero-note" title="Đã hủy — không tính lương GV">⊘</span>
          </td>
          <ng-template #durationColumn>
            <td>{{ formatDuration(s) }}</td>
          </ng-template>
          <td>
            <span class="badge" [class]="'badge-' + s.status.toLowerCase()">
              {{ sessionStatusLabel(s) }}
            </span>
          </td>
          <td class="actions-cell">
            <button class="ghost sm" (click)="viewDetail(s)" title="Chi tiết">Xem</button>

            <ng-container *ngIf="s.status === 'SCHEDULED'">
              <button class="ghost sm" (click)="completeSession(s)" *ngIf="isTeacher()">Hoàn thành</button>
              <button class="ghost sm" (click)="cancelSession(s)" *ngIf="canCreate()">Hủy</button>
            </ng-container>

            <button
              class="ghost sm"
              (click)="confirmSession(s)"
              *ngIf="canParentConfirmSession(s)">
              Xác nhận
            </button>


            <button class="danger sm" (click)="remove(s)" *ngIf="s.status === 'SCHEDULED' && isDirector()">Xóa</button>
          </td>
        </tr>
      </tbody>
    </table>

    <ng-template #empty>
      <p class="empty-msg">Không có buổi học nào.</p>
    </ng-template>

    <div class="pagination" *ngIf="totalPages() > 1">
      <button (click)="goPage(currentPage() - 1)" [disabled]="currentPage() <= 1">&laquo;</button>
      <span>Trang {{ currentPage() }} / {{ totalPages() }}</span>
      <button (click)="goPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()">&raquo;</button>
    </div>

    <div class="modal-backdrop" *ngIf="showCreateModal()">
      <div class="modal">
        <h3>Tạo buổi học</h3>

        <div class="tab-bar">
          <button [class.active]="createMode === 'single'" (click)="createMode = 'single'">Tạo 1 buổi</button>
          <button [class.active]="createMode === 'bulk'" (click)="createMode = 'bulk'">Tạo hàng loạt</button>
        </div>

        <form (ngSubmit)="submitCreate()">
          <label>
            Lớp học
            <select [(ngModel)]="createForm.classId" name="classId" required (change)="onCreateClassChange()">
              <option value="" disabled>-- Chọn lớp --</option>
              <option *ngFor="let c of classes()" [value]="c._id">{{ c.code }} - {{ c.name }}</option>
            </select>
          </label>

          <div *ngIf="createMode === 'single'">
            <label>
              Học sinh
              <select [(ngModel)]="createForm.studentId" name="studentId" required>
                <option value="" disabled>-- Chọn HS --</option>
                <option *ngFor="let st of selectedClassStudents()" [value]="st._id">{{ st.fullName }}</option>
              </select>
            </label>

            <label>
              Ngày học
              <input type="date" [(ngModel)]="createForm.scheduledDate" name="scheduledDate" required />
            </label>

            <div class="row-2">
              <label>
                Giờ bắt đầu
                <input type="time" [(ngModel)]="createForm.scheduledStartTime" name="startTime" required />
              </label>

              <label>
                Giờ kết thúc
                <input type="time" [(ngModel)]="createForm.scheduledEndTime" name="endTime" required />
              </label>
            </div>
          </div>

          <div *ngIf="createMode === 'bulk'">
            <label>
              Ngày học
              <input type="date" [(ngModel)]="createForm.scheduledDate" name="bulkDate" required />
            </label>

            <div class="row-2">
              <label>
                Giờ bắt đầu
                <input type="time" [(ngModel)]="createForm.scheduledStartTime" name="bulkStart" required />
              </label>

              <label>
                Giờ kết thúc
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

    <div class="modal-backdrop" *ngIf="showDetailModal()">
      <div class="modal modal-lg">
        <h3>Chi tiết buổi học</h3>

        <p class="detail-loading" *ngIf="detailLoading()">Dang tai chi tiet moi nhat...</p>

        <div class="detail-grid" *ngIf="selectedSession()">
          <div class="detail-row">
            <span>Lớp:</span>
            <span>{{ selectedSession()?.classId?.name }} ({{ selectedSession()?.classId?.code }})</span>
          </div>
          <div class="detail-row">
            <span>Học sinh:</span>
            <span>{{ selectedSession()?.studentId?.fullName }}</span>
          </div>
          <div class="detail-row">
            <span>Giáo viên:</span>
            <span>{{ selectedSession()?.teacherId?.fullName }}</span>
          </div>
          <div class="detail-row">
            <span>Ngày:</span>
            <span>{{ selectedSession()?.scheduledDate | date:'dd/MM/yyyy' }}</span>
          </div>
          <div class="detail-row">
            <span>{{ timeColumnLabel() }}:</span>
            <span>{{ timeDisplay(selectedSession()) }}</span>
          </div>
          <div class="detail-row" *ngIf="showTuitionColumn()">
            <span>Học phí:</span>
            <span>{{ formatCurrency(selectedSession()?.amountCharged || 0) }}</span>
          </div>
          <div class="detail-row" *ngIf="isParent(); else teacherPayoutDetail">
            <span>Thời lượng:</span>
            <span>{{ formatDuration(selectedSession()) }}</span>
          </div>
          <ng-template #teacherPayoutDetail>
            <div class="detail-row">
              <span>Lương GV:</span>
              <span>{{ formatTeacherCurrency(selectedSession()?.teacherPayout || 0) }}</span>
            </div>
          </ng-template>
          <div class="detail-row">
            <span>Trạng thái:</span>
            <span class="badge" [class]="'badge-' + (selectedSession()?.status || '').toLowerCase()">
              {{ sessionStatusLabel(selectedSession()) }}
            </span>
          </div>
          <div class="detail-row" *ngIf="selectedSession()?.topicsCovered">
            <span>Nội dung:</span>
            <span>{{ selectedSession()?.topicsCovered }}</span>
          </div>
          <div class="detail-row" *ngIf="selectedSession()?.homework">
            <span>BTVN:</span>
            <span>{{ selectedSession()?.homework }}</span>
          </div>
          <div class="detail-row" *ngIf="selectedSession()?.teacherNotes">
            <span>Ghi chú GV:</span>
            <span>{{ selectedSession()?.teacherNotes }}</span>
          </div>
          <div class="detail-row" *ngIf="selectedSession()?.parentNotes">
            <span>Ghi chú PH:</span>
            <span>{{ selectedSession()?.parentNotes }}</span>
          </div>
          <div class="detail-row" *ngIf="selectedSession()?.parentRating">
            <span>Đánh giá PH:</span>
            <span>{{ '⭐'.repeat(selectedSession()?.parentRating || 0) }}</span>
          </div>
        </div>

        <section class="report-card" *ngIf="selectedSession() as session">
          <div class="report-head">
            <h4>BÃ¡o cÃ¡o giáº£ng dáº¡y</h4>
            <span
              class="report-status"
              [class.report-status-ok]="session.hasTeachingReport"
              [class.report-status-missing]="!session.hasTeachingReport">
              {{ session.hasTeachingReport ? 'ÄÃ£ cÃ³ bÃ¡o cÃ¡o' : 'ChÆ°a cÃ³ bÃ¡o cÃ¡o' }}
            </span>
          </div>

          <div class="report-grid">
            <div class="detail-row">
              <span>NgÃ y ná»™p bÃ¡o cÃ¡o:</span>
              <span>{{ formatDateTime(session.teachingReport?.submittedAt, 'ChÆ°a ná»™p') }}</span>
            </div>
            <div class="detail-row">
              <span>Deadline bÃ¡o cÃ¡o:</span>
              <span>{{ formatDateTime(session.teachingReport?.deadline, 'ChÆ°a cÃ³ deadline') }}</span>
            </div>
            <div class="detail-row">
              <span>Tráº¡ng thÃ¡i ná»™p:</span>
              <span [class.report-late]="session.teachingReport?.isLateSubmission">
                {{ session.teachingReport?.isLateSubmission ? 'Ná»™p trá»…' : (session.hasTeachingReport ? 'ÄÃºng háº¡n / há»£p lá»‡' : 'ChÆ°a ná»™p') }}
              </span>
            </div>
            <div class="detail-row">
              <span>Link ghi hÃ¬nh:</span>
              <span>
                <a *ngIf="getRecordingUrl(session) as recordingUrl; else missingRecordingUrl"
                  [href]="recordingUrl"
                  class="report-link"
                  target="_blank"
                  rel="noopener noreferrer">
                  Má»Ÿ link video
                </a>
                <ng-template #missingRecordingUrl>ChÆ°a gáº¯n link ghi hÃ¬nh</ng-template>
              </span>
            </div>
            <div class="detail-row detail-row-block">
              <span>Ná»™i dung há»c:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.lessonContent, 'ChÆ°a cÃ³ ná»™i dung bÃ¡o cÃ¡o') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>ThÃ¡i Ä‘á»™ há»c sinh:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.studentAttitude, 'ChÆ°a cÃ³ nháº­n xÃ©t thÃ¡i Ä‘á»™ há»c sinh') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>Nháº­n xÃ©t chung:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.teacherComment, 'ChÆ°a cÃ³ nháº­n xÃ©t chung') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>BÃ i táº­p vá» nhÃ :</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.homework, 'ChÆ°a giao bÃ i táº­p vá» nhÃ ') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>Ghi chÃº thÃªm:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.additionalNotes, 'KhÃ´ng cÃ³ ghi chÃº thÃªm') }}</span>
            </div>
          </div>
        </section>

        <section class="report-card report-card-clean" *ngIf="selectedSession() as session">
          <div class="report-head">
            <h4>B&#225;o c&#225;o gi&#7843;ng d&#7841;y</h4>
            <span
              class="report-status"
              [class.report-status-ok]="session.hasTeachingReport"
              [class.report-status-missing]="!session.hasTeachingReport">
              {{ session.hasTeachingReport ? 'Da co bao cao' : 'Chua co bao cao' }}
            </span>
          </div>

          <div class="report-grid">
            <div class="detail-row">
              <span>Ng&#224;y n&#7897;p b&#225;o c&#225;o:</span>
              <span>{{ formatDateTime(session.teachingReport?.submittedAt, 'Chua nop') }}</span>
            </div>
            <div class="detail-row">
              <span>Deadline b&#225;o c&#225;o:</span>
              <span>{{ formatDateTime(session.teachingReport?.deadline, 'Chua co deadline') }}</span>
            </div>
            <div class="detail-row">
              <span>Tr&#7841;ng th&#225;i n&#7897;p:</span>
              <span [class.report-late]="session.teachingReport?.isLateSubmission">
                {{ session.teachingReport?.isLateSubmission ? 'Nop tre' : (session.hasTeachingReport ? 'Dung han / hop le' : 'Chua nop') }}
              </span>
            </div>
            <div class="detail-row">
              <span>Link ghi h&#236;nh:</span>
              <span>
                <a *ngIf="getRecordingUrl(session) as recordingUrl; else missingRecordingUrlClean"
                  [href]="recordingUrl"
                  class="report-link"
                  target="_blank"
                  rel="noopener noreferrer">
                  M&#7903; link video
                </a>
                <ng-template #missingRecordingUrlClean>Chua gan link ghi hinh</ng-template>
              </span>
            </div>
            <div class="detail-row detail-row-block">
              <span>N&#7897;i dung h&#7885;c:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.lessonContent, 'Chua co noi dung bao cao') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>Th&#225;i do h&#7885;c sinh:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.studentAttitude, 'Chua co nhan xet thai do hoc sinh') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>Nh&#7853;n x&#233;t chung:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.teacherComment, 'Chua co nhan xet chung') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>B&#224;i t&#7853;p v&#7873; nh&#224;:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.homework, 'Chua giao bai tap ve nha') }}</span>
            </div>
            <div class="detail-row detail-row-block">
              <span>Ghi ch&#250; th&#234;m:</span>
              <span class="report-text">{{ formatOptionalText(session.teachingReport?.additionalNotes, 'Khong co ghi chu them') }}</span>
            </div>
          </div>
        </section>

        <section class="history-card" *ngIf="selectedSession()">
          <div class="history-head">
            <h4>Lich su chinh sua</h4>
            <span *ngIf="selectedSession()?.editHistory?.length">{{ selectedSession()?.editHistory?.length }} lan</span>
          </div>

          <p class="history-empty" *ngIf="!selectedSession()?.editHistory?.length">
            Chua co lan chinh sua nao.
          </p>

          <div class="history-list" *ngIf="selectedSession()?.editHistory?.length">
            <article class="history-item" *ngFor="let entry of sessionEditHistory(selectedSession())">
              <div class="history-item-head">
                <strong>{{ entry.editedByName || 'He thong' }}</strong>
                <span>{{ formatHistoryTimestamp(entry.editedAt) }}</span>
              </div>
              <div class="history-role" *ngIf="entry.editedByRole">
                {{ roleLabel(entry.editedByRole) }}
              </div>

              <div class="history-change" *ngFor="let change of entry.changes">
                <span class="history-label">{{ change.label }}:</span>
                <span>{{ change.beforeValue || 'Khong co' }} -> {{ change.afterValue || 'Khong co' }}</span>
              </div>

              <div class="history-snapshot" *ngIf="entry.durationSnapshot">
                Sau khi doi sang {{ entry.durationSnapshot.newDurationMinutes }} phut, con
                {{ formatSessionCount(entry.durationSnapshot.totalSessionsRemaining) }} buoi theo thoi luong moi
                <span class="history-snapshot-breakdown">
                  (hoc phi: {{ formatSessionCount(entry.durationSnapshot.paidSessionsRemaining) }},
                  tang: {{ formatSessionCount(entry.durationSnapshot.bonusSessionsRemaining) }})
                </span>
              </div>
            </article>
          </div>
        </section>

        <div class="modal-actions detail-modal-actions-clean">
          <button
            class="primary"
            type="button"
            (click)="confirmSalaryFromDetailClean()"
            [disabled]="detailLoading()"
            *ngIf="selectedSession() && canConfirmSalarySession(selectedSession()!)">
            X&#225;c nh&#7853;n l&#432;&#417;ng
          </button>
          <button class="ghost" (click)="showDetailModal.set(false)">&#272;&#243;ng</button>
        </div>

        <div class="modal-actions">
          <button
            class="primary"
            type="button"
            (click)="confirmSalaryFromDetail()"
            [disabled]="detailLoading()"
            *ngIf="selectedSession() && canConfirmSalarySession(selectedSession()!)">
            Xác nhận lương
          </button>
          <button class="ghost" (click)="showDetailModal.set(false)">Đóng</button>
        </div>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="showCompleteModal()">
      <div class="modal">
        <h3>Hoàn thành buổi dạy</h3>

        <form (ngSubmit)="submitComplete()">
          <label>
            Nội dung đã dạy
            <textarea [(ngModel)]="completeForm.topicsCovered" name="topicsCovered" rows="3"></textarea>
          </label>

          <label>
            Bài tập về nhà
            <textarea [(ngModel)]="completeForm.homework" name="homework" rows="2"></textarea>
          </label>

          <label>
            Ghi chú
            <textarea [(ngModel)]="completeForm.teacherNotes" name="teacherNotes" rows="2"></textarea>
          </label>

          <div class="modal-actions">
            <button type="button" class="ghost" (click)="showCompleteModal.set(false)">Hủy</button>
            <button type="submit" class="primary">Hoàn thành</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modal-backdrop" *ngIf="showConfirmModal()">
      <div class="modal">
        <h3>Xác nhận buổi học</h3>

        <form (ngSubmit)="submitConfirm()">
          <label>
            Đánh giá (1-5 sao)
            <input type="number" [(ngModel)]="confirmForm.rating" name="rating" min="1" max="5" />
          </label>

          <label>
            Ghi chú
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
    :host { display: block; padding: 24px; font-family: 'Segoe UI', sans-serif; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
    .page-header h2 { margin: 0; color: #1e293b; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }

    .primary {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .primary:hover { background: #1d4ed8; }

    .ghost {
      background: none;
      border: 1px solid #cbd5e1;
      color: #334155;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .ghost:hover { background: #f1f5f9; }
    .ghost.sm, .danger.sm { padding: 4px 8px; font-size: 12px; }

    .danger {
      background: #dc2626;
      color: #fff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .danger:hover { background: #b91c1c; }

    .stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    .stat-card {
      background: #fff;
      border-radius: 8px;
      padding: 14px 18px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      text-align: center;
    }
    .stat-value { display: block; font-size: 20px; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: 12px; color: #64748b; }

    .filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .filters select, .filters input {
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      background: #fff;
    }

    .data {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    .data th {
      text-align: left;
      background: #f1f5f9;
      padding: 10px 12px;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .data td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .data tr:last-child td { border-bottom: none; }
    .data tr:hover td { background: #f8fafc; }

    .actions-cell { white-space: nowrap; }
    .actions-cell button { margin-right: 4px; }

    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-scheduled { background: #dbeafe; color: #1d4ed8; }
    .badge-teacher_completed { background: #fef3c7; color: #92400e; }
    .badge-parent_confirmed { background: #d1fae5; color: #065f46; }
    .badge-finalized { background: #dcfce7; color: #166534; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-no_show { background: #fce7f3; color: #9d174d; }

    .row-cancelled td { opacity: 0.5; }
    .row-no_show td { opacity: 0.65; }
    .zero-finance { color: #94a3b8; }
    .zero-note { font-size: 10px; color: #94a3b8; margin-left: 3px; cursor: help; }

    .pagination { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 16px; }
    .pagination button {
      background: #fff;
      border: 1px solid #cbd5e1;
      padding: 6px 14px;
      border-radius: 6px;
      cursor: pointer;
    }
    .pagination button:disabled { opacity: 0.4; cursor: default; }

    .empty-msg { color: #64748b; padding: 32px 0; text-align: center; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: #fff;
      border-radius: 12px;
      padding: 28px;
      width: 500px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    }
    .modal-lg { width: 760px; }
    .modal h3 { margin: 0 0 16px; color: #1e293b; }
    .modal label {
      display: block;
      margin-bottom: 10px;
      font-size: 13px;
      font-weight: 500;
      color: #334155;
    }
    .modal input, .modal select, .modal textarea {
      width: 100%;
      margin-top: 4px;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .modal textarea { resize: vertical; }
    .modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    .tab-bar { display: flex; gap: 6px; margin-bottom: 14px; }
    .tab-bar button {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 6px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .tab-bar button.active { background: #2563eb; color: #fff; border-color: #2563eb; }

    .hint { color: #64748b; font-size: 12px; font-style: italic; margin: 6px 0; }

    .detail-grid { display: grid; gap: 8px; }
    .detail-row {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
      font-size: 13px;
      padding: 4px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .detail-row span:first-child { color: #64748b; font-weight: 500; }

    .detail-loading {
      margin: 0 0 12px;
      color: #2563eb;
      font-size: 13px;
    }

    .report-card {
      margin-top: 18px;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
    }
    .report-card:not(.report-card-clean) {
      display: none;
    }
    .report-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .report-head h4 {
      margin: 0;
      color: #1e293b;
      font-size: 15px;
    }
    .report-status {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .report-status-ok {
      background: #dcfce7;
      color: #15803d;
    }
    .report-status-missing {
      background: #fee2e2;
      color: #dc2626;
    }
    .report-grid {
      display: grid;
      gap: 8px;
    }
    .detail-row-block {
      align-items: start;
    }
    .report-text {
      white-space: pre-wrap;
      line-height: 1.5;
    }
    .report-link {
      color: #2563eb;
      font-weight: 600;
      text-decoration: none;
    }
    .report-link:hover {
      text-decoration: underline;
    }
    .report-late {
      color: #dc2626;
      font-weight: 600;
    }
    .modal-lg > .modal-actions:not(.detail-modal-actions-clean) {
      display: none;
    }

    .history-card {
      margin-top: 18px;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
    }
    .history-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .history-head h4 {
      margin: 0;
      color: #1e293b;
      font-size: 15px;
    }
    .history-head span {
      color: #64748b;
      font-size: 12px;
    }
    .history-empty {
      margin: 0;
      color: #64748b;
      font-size: 13px;
    }
    .history-list {
      display: grid;
      gap: 12px;
    }
    .history-item {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      background: #f8fafc;
    }
    .history-item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
      font-size: 13px;
    }
    .history-item-head strong { color: #0f172a; }
    .history-item-head span {
      color: #64748b;
      font-size: 12px;
    }
    .history-role {
      color: #475569;
      font-size: 12px;
      margin-bottom: 10px;
    }
    .history-change {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 8px;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .history-label {
      color: #475569;
      font-weight: 600;
    }
    .history-snapshot {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      color: #0f172a;
      font-size: 13px;
      line-height: 1.5;
    }
    .history-snapshot-breakdown {
      color: #64748b;
    }
  `],
})
export class SessionsComponent implements OnInit {
  private sessionSvc = inject(SessionService);
  private classSvc = inject(ClassService);
  private auth: AuthService;

  sessions = signal<SessionItem[]>([]);
  classes = signal<ClassItem[]>([]);
  stats = signal<{
    totalSessions: number;
    totalRevenue: number;
    totalTeacherCost: number;
    byStatus: any;
  } | null>(null);
  showCreateModal = signal(false);
  showDetailModal = signal(false);
  showCompleteModal = signal(false);
  showConfirmModal = signal(false);
  detailLoading = signal(false);
  selectedSession = signal<SessionItem | null>(null);
  selectedClassStudents = signal<any[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);

  createMode: 'single' | 'bulk' = 'single';

  filter: SessionQueryParams = { classId: '', status: '', fromDate: '', toDate: '' };

  createForm: any = {
    classId: '',
    studentId: '',
    scheduledDate: '',
    scheduledStartTime: '',
    scheduledEndTime: '',
  };
  completeForm: any = { topicsCovered: '', homework: '', teacherNotes: '' };
  confirmForm: SessionParentConfirmPayload = { rating: 5, parentNotes: '' };
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

  goPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.load();
  }

  openCreate(): void {
    this.createForm = {
      classId: '',
      studentId: '',
      scheduledDate: '',
      scheduledStartTime: '',
      scheduledEndTime: '',
    };
    this.createMode = 'single';
    this.selectedClassStudents.set([]);
    this.showCreateModal.set(true);
  }

  onCreateClassChange(): void {
    const cls = this.classes().find((item) => item._id === this.createForm.classId);
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
      return;
    }

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

  async viewDetail(session: SessionItem): Promise<void> {
    this.selectedSession.set(session);
    this.showDetailModal.set(true);
    this.detailLoading.set(true);

    try {
      const detail = await this.sessionSvc.getById(session._id);
      if (detail) {
        this.selectedSession.set({ ...session, ...detail });
      }
    } finally {
      this.detailLoading.set(false);
    }
  }

  completeSession(session: SessionItem): void {
    this.actionSessionId = session._id;
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

  confirmSession(session: SessionItem): void {
    if (!this.canParentConfirmSession(session)) {
      alert('Bu\u1ed5i h\u1ecdc ch\u01b0a c\u00f3 b\u00e1o c\u00e1o gi\u1ea3ng d\u1ea1y, ch\u01b0a th\u1ec3 x\u00e1c nh\u1eadn.');
      return;
    }
    this.actionSessionId = session._id;
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

  async finalizeSession(session: SessionItem): Promise<void> {
    const message = session.status === 'FINALIZED'
      ? 'Xác nhận payroll cho buổi học này? Hệ thống sẽ đánh dấu OPS/Giám đốc đã chốt để buổi học đủ điều kiện tính lương.'
      : 'Chốt buổi học này? Sẽ trừ ví học sinh và ghi nhận lương GV.';
    if (!confirm(message)) return;
    const ok = await this.sessionSvc.finalize(session._id);
    if (ok) {
      await this.load();
      if (this.selectedSession()?._id === session._id) {
        this.showDetailModal.set(false);
        this.selectedSession.set(null);
      }
    } else {
      alert('Lỗi khi chốt buổi học');
    }
  }

  async confirmSalaryFromDetail(): Promise<void> {
    const session = this.selectedSession();
    if (!session) return;
    const message = session.status === 'FINALIZED'
      ? 'Xác nhận lương cho buổi học này? Hệ thống sẽ đánh dấu buổi học đã được OPS/Kế toán/Giám đốc duyệt để vào điều kiện tính lương.'
      : 'Xác nhận lương cho buổi học này? Hệ thống sẽ hoàn tất buổi học và ghi nhận lương giáo viên.';
    if (!confirm(message)) return;

    const ok = await this.sessionSvc.finalize(session._id);
    if (ok) {
      await this.load();
      this.showDetailModal.set(false);
      this.selectedSession.set(null);
    } else {
      alert('Lỗi khi xác nhận lương buổi học');
    }
  }

  async confirmSalaryFromDetailClean(): Promise<void> {
    const session = this.selectedSession();
    if (!session) return;

    const message = session.status === 'FINALIZED'
      ? 'X\u00e1c nh\u1eadn l\u01b0\u01a1ng cho bu\u1ed5i h\u1ecdc n\u00e0y? H\u1ec7 th\u1ed1ng s\u1ebd \u0111\u00e1nh d\u1ea5u bu\u1ed5i h\u1ecdc \u0111\u00e3 \u0111\u01b0\u1ee3c OPS/K\u1ebf to\u00e1n/Gi\u00e1m \u0111\u1ed1c duy\u1ec7t \u0111\u1ec3 v\u00e0o \u0111i\u1ec1u ki\u1ec7n t\u00ednh l\u01b0\u01a1ng.'
      : 'X\u00e1c nh\u1eadn l\u01b0\u01a1ng cho bu\u1ed5i h\u1ecdc n\u00e0y? H\u1ec7 th\u1ed1ng s\u1ebd ho\u00e0n t\u1ea5t bu\u1ed5i h\u1ecdc v\u00e0 ghi nh\u1eadn l\u01b0\u01a1ng gi\u00e1o vi\u00ean.';
    if (!confirm(message)) return;

    const ok = await this.sessionSvc.finalize(session._id);
    if (ok) {
      await this.load();
      this.showDetailModal.set(false);
      this.selectedSession.set(null);
    } else {
      alert('L\u1ed7i khi x\u00e1c nh\u1eadn l\u01b0\u01a1ng bu\u1ed5i h\u1ecdc');
    }
  }

  async cancelSession(session: SessionItem): Promise<void> {
    const reason = prompt('Lý do hủy buổi học:');
    if (!reason) return;
    const ok = await this.sessionSvc.cancel(session._id, reason);
    if (ok) {
      this.load();
    } else {
      alert('Lỗi khi hủy buổi học');
    }
  }

  async remove(session: SessionItem): Promise<void> {
    if (!confirm('Xóa buổi học này?')) return;
    const ok = await this.sessionSvc.remove(session._id);
    if (ok) {
      this.load();
    }
  }

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized === 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private roundMoneyDownToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized === 0) return 0;
    return normalized > 0
      ? Math.floor(normalized / 1000) * 1000
      : Math.ceil(normalized / 1000) * 1000;
  }

  formatCurrency(value: number): string {
    return this.roundMoneyToThousand(value).toLocaleString('vi-VN') + ' ₫';
  }

  formatTeacherCurrency(value: number): string {
    return this.roundMoneyDownToThousand(value).toLocaleString('vi-VN') + ' ₫';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Đã lên lịch',
      TEACHER_COMPLETED: 'GV hoàn thành',
      PARENT_CONFIRMED: 'PH xác nhận',
      FINALIZED: 'Đã chốt',
      CANCELLED: 'Đã hủy',
      NO_SHOW: 'Vắng',
    };
    return map[status] || status;
  }

  sessionStatusLabel(session: SessionItem | null | undefined): string {
    if (!session) return '';
    if (session.status !== 'FINALIZED') {
      return this.statusLabel(session.status);
    }

    const hasReport = !!session.hasTeachingReport && !!session.teachingReport?.lessonContent?.trim();
    if (!hasReport) {
      return '\u0110\u00e3 ho\u00e0n t\u1ea5t, ch\u1edd b\u00e1o c\u00e1o';
    }

    if (!this.hasManualPayrollConfirmation(session)) {
      return '\u0110\u00e3 ho\u00e0n t\u1ea5t, ch\u1edd x\u00e1c nh\u1eadn l\u01b0\u01a1ng';
    }

    return '\u0110\u00e3 x\u00e1c nh\u1eadn l\u01b0\u01a1ng';
  }

  timeColumnLabel(): string {
    return this.isTeacher() ? 'Giờ điểm danh' : 'Giờ';
  }

  showTuitionColumn(): boolean {
    return !this.isTeacher();
  }

  showTeacherPayoutColumn(): boolean {
    return !this.isParent();
  }

  payoutOrDurationColumnLabel(): string {
    return this.showTeacherPayoutColumn() ? 'Lương GV' : 'Thời lượng';
  }

  timeDisplay(session: SessionItem | null | undefined): string {
    if (!session) return '—';
    return this.isTeacher()
      ? this.formatAttendanceTime(session.attendedAt)
      : this.formatScheduledWindow(session);
  }

  private formatAttendanceTime(attendedAt?: string | null): string {
    if (!attendedAt) return '—';
    const date = new Date(attendedAt);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatScheduledWindow(session: SessionItem): string {
    const start = session.scheduledStartTime?.trim();
    const end = session.scheduledEndTime?.trim();
    if (start && end) return `${start} – ${end}`;
    return start || end || '—';
  }

  formatDuration(session: SessionItem | null | undefined): string {
    if (!session) return '—';
    const explicitDuration = Number(session.durationMinutes ?? 0);
    if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
      return `${Math.round(explicitDuration)} phút`;
    }

    const startMinutes = this.parseTimeToMinutes(session.scheduledStartTime);
    const endMinutes = this.parseTimeToMinutes(session.scheduledEndTime);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return '—';
    }
    return `${endMinutes - startMinutes} phút`;
  }

  private parseTimeToMinutes(value?: string | null): number | null {
    const safeValue = value?.trim();
    if (!safeValue) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(safeValue);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return (hours * 60) + minutes;
  }

  sessionEditHistory(session: SessionItem | null | undefined): SessionEditHistoryEntry[] {
    return [...(session?.editHistory || [])].sort((left, right) => {
      const leftTime = new Date(left.editedAt).getTime();
      const rightTime = new Date(right.editedAt).getTime();
      return rightTime - leftTime;
    });
  }

  formatHistoryTimestamp(value?: string): string {
    if (!value) return 'Khong ro thoi gian';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Khong ro thoi gian';
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDateTime(value?: string, emptyLabel = 'Chua co'): string {
    if (!value) return emptyLabel;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return emptyLabel;
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatOptionalText(value?: string | null, emptyLabel = 'Chua cap nhat'): string {
    const safeValue = value?.trim();
    return safeValue && safeValue.length > 0 ? safeValue : emptyLabel;
  }

  getRecordingUrl(session: SessionItem | null | undefined): string | null {
    const safeValue = session?.teachingReport?.recordingUrl?.trim();
    return safeValue || null;
  }

  roleLabel(role?: string): string {
    const map: Record<string, string> = {
      DIRECTOR: 'Giam doc',
      OPS: 'Van hanh',
      ACCOUNTING: 'Ke toan',
      TEACHER: 'Giao vien',
      PARENT: 'Phu huynh',
      SALE: 'Sale',
      ADSMANAGER: 'Ads',
    };
    if (!role) return '';
    return map[role] || role;
  }

  formatSessionCount(value?: number): string {
    const safeValue = Number(value || 0);
    return Math.max(Math.floor(safeValue), 0).toLocaleString('vi-VN');
  }

  canCreate(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }

  canParentConfirmSession(session: SessionItem | null | undefined): boolean {
    return !!session
      && this.isParent()
      && session.status === 'TEACHER_COMPLETED'
      && !!session.hasTeachingReport
      && !!session.teachingReport?.lessonContent?.trim();
  }

  canConfirmSalarySession(session: SessionItem): boolean {
    if (!this.canConfirmSalaryRole()) {
      return false;
    }

    if (!session.hasTeachingReport || !session.teachingReport?.lessonContent?.trim()) {
      return false;
    }

    if (session.status === 'TEACHER_COMPLETED' || session.status === 'PARENT_CONFIRMED') {
      return true;
    }

    return session.status === 'FINALIZED' && !this.hasManualPayrollConfirmation(session);
  }

  private canConfirmSalaryRole(): boolean {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS' || role === 'ACCOUNTING';
  }

  private hasManualPayrollConfirmation(session: SessionItem): boolean {
    const finalizedBy: any = session.confirmation?.finalizedBy;
    if (!finalizedBy) return false;
    if (typeof finalizedBy === 'string') return finalizedBy.trim().length > 0;
    if (finalizedBy._id) return true;
    if (typeof finalizedBy.toString === 'function') {
      const serialized = finalizedBy.toString();
      return !!serialized && serialized !== '[object Object]';
    }
    return false;
  }

  isTeacher(): boolean {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  isParent(): boolean {
    return this.auth.userSignal()?.role === 'PARENT';
  }

  isDirector(): boolean {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }
}
