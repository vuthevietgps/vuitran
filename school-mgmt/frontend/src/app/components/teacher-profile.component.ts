import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeacherService, TeacherProfile, TeacherFullProfile, Qualification, AvailabilitySlot, BankInfo } from '../services/teacher.service';
import { AuthService } from '../services/auth.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface ProfileForm {
  subjects: string;
  grades: string;
  teachingMode: string;
  locations: string;
  bio: string;
  yearsOfExperience: number;
  videoIntroUrl: string;
  pricePerSession: number;
  pricePerHour: number;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  bankBranch: string;
}

interface QualificationForm {
  title: string;
  institution: string;
  year: number | null;
  imageUrl: string;
}

interface AvailabilityForm {
  day: string;
  startTime: string;
  endTime: string;
}

@Component({
  selector: 'app-teacher-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <div class="profile-page">
    <header class="page-header">
      <div class="header-left">
        <h2>Hồ sơ giảng dạy</h2>
        <p class="subtitle" *ngIf="profile()">
          <span class="badge" [attr.data-status]="profile()!.status">{{ statusLabel(profile()!.status) }}</span>
          <span class="meta">Cập nhật: {{ profile()!.updatedAt | date:'dd/MM/yyyy HH:mm' }}</span>
        </p>
      </div>
      <div class="header-actions" *ngIf="profile() && !editing()">
        <button class="btn primary" (click)="startEdit()">✏️ Chỉnh sửa hồ sơ</button>
      </div>
    </header>

  <app-flow-guide featureKey="teacher-profile"></app-flow-guide>

    <div *ngIf="loading()" class="loading-state">
      <div class="spinner"></div>
      <span>Đang tải hồ sơ...</span>
    </div>

    <div *ngIf="error()" class="alert error">{{ error() }}</div>
    <div *ngIf="success()" class="alert success">{{ success() }}</div>

    <!-- ═══════════════ VIEW MODE ═══════════════ -->
    <div *ngIf="fullProfile() && !editing()" class="profile-content">

      <!-- Top Stats Cards -->
      <div class="stats-strip">
        <div class="stat-card accent-blue">
          <div class="stat-icon">📚</div>
          <div class="stat-info">
            <div class="stat-value">{{ fullProfile()!.sessions.totalCount }}</div>
            <div class="stat-label">Tổng buổi dạy</div>
          </div>
        </div>
        <div class="stat-card accent-green">
          <div class="stat-icon">💰</div>
          <div class="stat-info">
            <div class="stat-value">{{ fullProfile()!.payroll.totalPaid | number:'1.0-0' }}đ</div>
            <div class="stat-label">Tổng thu nhập</div>
          </div>
        </div>
        <div class="stat-card accent-purple">
          <div class="stat-icon">🏫</div>
          <div class="stat-info">
            <div class="stat-value">{{ fullProfile()!.classes.totalActive }}</div>
            <div class="stat-label">Lớp đang dạy</div>
          </div>
        </div>
        <div class="stat-card accent-orange">
          <div class="stat-icon">⭐</div>
          <div class="stat-info">
            <div class="stat-value">{{ profile()!.rating || 'N/A' }}</div>
            <div class="stat-label">Đánh giá ({{ profile()!.totalReviews }} lượt)</div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <!-- Left Column: Personal Info -->
        <div class="section-card">
          <div class="section-header">
            <h3>👤 Thông tin cá nhân</h3>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <label>Họ tên</label>
              <span>{{ getUserName() }}</span>
            </div>
            <div class="info-item">
              <label>Email</label>
              <span>{{ getUserEmail() }}</span>
            </div>
            <div class="info-item">
              <label>Số điện thoại</label>
              <span>{{ getUserPhone() || 'Chưa cập nhật' }}</span>
            </div>
            <div class="info-item">
              <label>Số năm kinh nghiệm</label>
              <span>{{ profile()!.yearsOfExperience }} năm</span>
            </div>
          </div>
          <div class="info-item full" *ngIf="profile()!.bio">
            <label>Giới thiệu bản thân</label>
            <p class="bio-text">{{ profile()!.bio }}</p>
          </div>
          <div class="info-item full" *ngIf="!profile()!.bio">
            <label>Giới thiệu bản thân</label>
            <p class="empty-text">Chưa có giới thiệu. Hãy chỉnh sửa hồ sơ để thêm.</p>
          </div>
        </div>

        <!-- Right Column: Teaching Info -->
        <div class="section-card">
          <div class="section-header">
            <h3>📖 Thông tin giảng dạy</h3>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <label>Môn dạy</label>
              <div class="tag-list">
                <span class="tag blue" *ngFor="let s of profile()!.subjects">{{ s }}</span>
                <span *ngIf="!profile()!.subjects?.length" class="empty-text">Chưa cập nhật</span>
              </div>
            </div>
            <div class="info-item">
              <label>Khối lớp</label>
              <div class="tag-list">
                <span class="tag green" *ngFor="let g of profile()!.grades">{{ g }}</span>
                <span *ngIf="!profile()!.grades?.length" class="empty-text">Chưa cập nhật</span>
              </div>
            </div>
            <div class="info-item">
              <label>Hình thức dạy</label>
              <span class="badge" [attr.data-mode]="profile()!.teachingMode">{{ teachingModeLabel(profile()!.teachingMode) }}</span>
            </div>
            <div class="info-item">
              <label>Khu vực</label>
              <div class="tag-list">
                <span class="tag gray" *ngFor="let l of profile()!.locations">{{ l }}</span>
                <span *ngIf="!profile()!.locations?.length" class="empty-text">Chưa cập nhật</span>
              </div>
            </div>
          </div>
          <div class="pricing-row">
            <div class="price-box">
              <label>Giá/buổi</label>
              <span class="price">{{ profile()!.pricePerSession | number:'1.0-0' }}đ</span>
            </div>
            <div class="price-box" *ngIf="profile()!.pricePerHour">
              <label>Giá/giờ</label>
              <span class="price">{{ profile()!.pricePerHour | number:'1.0-0' }}đ</span>
            </div>
          </div>
        </div>

        <!-- Qualifications -->
        <div class="section-card">
          <div class="section-header">
            <h3>🎓 Bằng cấp & Chứng chỉ</h3>
          </div>
          <div *ngIf="!profile()!.qualifications?.length" class="empty-section">
            Chưa có bằng cấp nào. Hãy chỉnh sửa hồ sơ để thêm.
          </div>
          <div class="qualification-list" *ngIf="profile()!.qualifications?.length">
            <div class="qualification-card" *ngFor="let q of profile()!.qualifications">
              <div class="qual-icon">🏅</div>
              <div class="qual-info">
                <div class="qual-title">{{ q.title }}</div>
                <div class="qual-meta" *ngIf="q.institution">{{ q.institution }}</div>
                <div class="qual-meta" *ngIf="q.year">Năm: {{ q.year }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Availability -->
        <div class="section-card">
          <div class="section-header">
            <h3>🕐 Lịch rảnh</h3>
          </div>
          <div *ngIf="!profile()!.availability?.length" class="empty-section">
            Chưa thiết lập lịch rảnh. Hãy chỉnh sửa hồ sơ để thêm.
          </div>
          <div class="schedule-grid" *ngIf="profile()!.availability?.length">
            <div class="schedule-item" *ngFor="let a of profile()!.availability">
              <span class="day-badge">{{ dayLabel(a.day) }}</span>
              <span class="time-range">{{ a.startTime }} - {{ a.endTime }}</span>
            </div>
          </div>
        </div>

        <!-- Bank Info -->
        <div class="section-card" *ngIf="profile()!.bankInfo">
          <div class="section-header">
            <h3>🏦 Thông tin ngân hàng</h3>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <label>Ngân hàng</label>
              <span>{{ profile()!.bankInfo!.bankName }}</span>
            </div>
            <div class="info-item">
              <label>Số tài khoản</label>
              <span class="mono">{{ maskAccount(profile()!.bankInfo!.accountNumber) }}</span>
            </div>
            <div class="info-item">
              <label>Chủ tài khoản</label>
              <span>{{ profile()!.bankInfo!.accountHolderName }}</span>
            </div>
            <div class="info-item" *ngIf="profile()!.bankInfo!.branch">
              <label>Chi nhánh</label>
              <span>{{ profile()!.bankInfo!.branch }}</span>
            </div>
          </div>
        </div>
        <div class="section-card" *ngIf="!profile()!.bankInfo">
          <div class="section-header">
            <h3>🏦 Thông tin ngân hàng</h3>
          </div>
          <div class="empty-section">
            Chưa có thông tin ngân hàng. Hãy chỉnh sửa hồ sơ để thêm.
          </div>
        </div>

        <!-- Active Classes -->
        <div class="section-card wide" *ngIf="fullProfile()!.classes.active.length">
          <div class="section-header">
            <h3>🏫 Lớp đang dạy ({{ fullProfile()!.classes.totalActive }})</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>Tên lớp</th><th>Mã lớp</th><th>Số HS</th><th>Giá/buổi</th><th>Lương GV/buổi</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of fullProfile()!.classes.active">
                <td><strong>{{ c.name }}</strong></td>
                <td>{{ c.code }}</td>
                <td>{{ c.students?.length || 0 }}</td>
                <td>{{ c.pricePerSession | number:'1.0-0' }}đ</td>
                <td>{{ c.teacherPayPerSession | number:'1.0-0' }}đ</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Session Stats -->
        <div class="section-card" *ngIf="fullProfile()!.sessions.totalCount">
          <div class="section-header">
            <h3>📊 Thống kê buổi học</h3>
          </div>
          <div class="session-stats">
            <div *ngFor="let item of objectEntries(fullProfile()!.sessions.byStatus)" class="session-stat-row">
              <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
              <span class="stat-count">{{ item[1].count }} buổi</span>
              <span class="stat-amount">{{ item[1].totalPayout | number:'1.0-0' }}đ</span>
            </div>
          </div>
        </div>

        <!-- Video Intro -->
        <div class="section-card" *ngIf="profile()!.videoIntroUrl">
          <div class="section-header">
            <h3>🎥 Video giới thiệu</h3>
          </div>
          <a [href]="profile()!.videoIntroUrl" target="_blank" class="video-link">
            🔗 Xem video giới thiệu
          </a>
        </div>

        <!-- Recent Sessions -->
        <div class="section-card wide" *ngIf="fullProfile()!.sessions.recent.length">
          <div class="section-header">
            <h3>📋 Buổi dạy gần đây</h3>
          </div>
          <table class="data-table">
            <thead>
              <tr><th>Ngày</th><th>Lớp</th><th>Học sinh</th><th>Trạng thái</th><th>Lương</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of fullProfile()!.sessions.recent">
                <td>{{ s.scheduledDate | date:'dd/MM/yyyy' }}</td>
                <td>{{ s.classId?.name || 'N/A' }}</td>
                <td>{{ s.studentId?.fullName || 'N/A' }}</td>
                <td><span class="badge" [attr.data-status]="s.status">{{ s.status }}</span></td>
                <td>{{ s.teacherPayout | number:'1.0-0' }}đ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ═══════════════ EDIT MODE ═══════════════ -->
    <div *ngIf="editing() && profile()" class="edit-content">
      <form (ngSubmit)="saveProfile()" #profileForm="ngForm">

        <!-- Teaching Info -->
        <div class="edit-section">
          <h3>📖 Thông tin giảng dạy</h3>
          <div class="form-grid">
            <div class="field">
              <label>Môn dạy <small>(phân cách bằng dấu phẩy)</small></label>
              <input name="subjects" [(ngModel)]="form.subjects" placeholder="Toán, Lý, Hóa" />
            </div>
            <div class="field">
              <label>Khối lớp <small>(phân cách bằng dấu phẩy)</small></label>
              <input name="grades" [(ngModel)]="form.grades" placeholder="Lớp 10, Lớp 11, Lớp 12" />
            </div>
            <div class="field">
              <label>Hình thức dạy</label>
              <select name="teachingMode" [(ngModel)]="form.teachingMode">
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="BOTH">Cả hai</option>
              </select>
            </div>
            <div class="field">
              <label>Khu vực dạy <small>(phân cách bằng dấu phẩy)</small></label>
              <input name="locations" [(ngModel)]="form.locations" placeholder="Quận 1, Quận 3, Bình Thạnh" />
            </div>
            <div class="field">
              <label>Số năm kinh nghiệm</label>
              <input type="number" name="yearsOfExperience" [(ngModel)]="form.yearsOfExperience" min="0" />
            </div>
            <div class="field">
              <label>Video giới thiệu (URL)</label>
              <input name="videoIntroUrl" [(ngModel)]="form.videoIntroUrl" placeholder="https://youtube.com/..." />
            </div>
          </div>
          <div class="field full">
            <label>Giới thiệu bản thân</label>
            <textarea name="bio" [(ngModel)]="form.bio" rows="4" placeholder="Viết vài dòng giới thiệu về bạn..."></textarea>
          </div>
        </div>

        <!-- Pricing -->
        <div class="edit-section">
          <h3>💰 Giá dịch vụ</h3>
          <div class="form-grid">
            <div class="field">
              <label>Giá/buổi (VNĐ)</label>
              <input type="number" name="pricePerSession" [(ngModel)]="form.pricePerSession" min="0" required />
            </div>
            <div class="field">
              <label>Giá/giờ (VNĐ) <small>(tùy chọn)</small></label>
              <input type="number" name="pricePerHour" [(ngModel)]="form.pricePerHour" min="0" />
            </div>
          </div>
        </div>

        <!-- Qualifications -->
        <div class="edit-section">
          <h3>🎓 Bằng cấp & Chứng chỉ</h3>
          <div class="qual-edit-list">
            <div class="qual-edit-item" *ngFor="let q of qualifications; let i = index">
              <div class="form-grid compact">
                <div class="field"><label>Tên bằng cấp *</label><input [(ngModel)]="q.title" [name]="'qtitle'+i" required /></div>
                <div class="field"><label>Trường/Tổ chức</label><input [(ngModel)]="q.institution" [name]="'qinst'+i" /></div>
                <div class="field"><label>Năm</label><input type="number" [(ngModel)]="q.year" [name]="'qyear'+i" min="1950" max="2030" /></div>
                <div class="field"><label>URL ảnh chứng chỉ</label><input [(ngModel)]="q.imageUrl" [name]="'qimg'+i" /></div>
              </div>
              <button type="button" class="btn-icon danger" (click)="removeQualification(i)" title="Xóa">✕</button>
            </div>
          </div>
          <button type="button" class="btn secondary small" (click)="addQualification()">+ Thêm bằng cấp</button>
        </div>

        <!-- Availability -->
        <div class="edit-section">
          <h3>🕐 Lịch rảnh</h3>
          <div class="avail-edit-list">
            <div class="avail-edit-item" *ngFor="let a of availabilitySlots; let i = index">
              <select [(ngModel)]="a.day" [name]="'aday'+i">
                <option value="MONDAY">Thứ 2</option>
                <option value="TUESDAY">Thứ 3</option>
                <option value="WEDNESDAY">Thứ 4</option>
                <option value="THURSDAY">Thứ 5</option>
                <option value="FRIDAY">Thứ 6</option>
                <option value="SATURDAY">Thứ 7</option>
                <option value="SUNDAY">Chủ nhật</option>
              </select>
              <input type="time" [(ngModel)]="a.startTime" [name]="'astart'+i" />
              <span class="time-sep">→</span>
              <input type="time" [(ngModel)]="a.endTime" [name]="'aend'+i" />
              <button type="button" class="btn-icon danger" (click)="removeAvailability(i)" title="Xóa">✕</button>
            </div>
          </div>
          <button type="button" class="btn secondary small" (click)="addAvailability()">+ Thêm khung giờ</button>
        </div>

        <!-- Bank Info -->
        <div class="edit-section">
          <h3>🏦 Thông tin ngân hàng</h3>
          <div class="form-grid">
            <div class="field">
              <label>Tên ngân hàng</label>
              <input name="bankName" [(ngModel)]="form.bankName" placeholder="Vietcombank" />
            </div>
            <div class="field">
              <label>Số tài khoản</label>
              <input name="accountNumber" [(ngModel)]="form.accountNumber" placeholder="0123456789" />
            </div>
            <div class="field">
              <label>Chủ tài khoản</label>
              <input name="accountHolderName" [(ngModel)]="form.accountHolderName" placeholder="NGUYEN VAN A" />
            </div>
            <div class="field">
              <label>Chi nhánh</label>
              <input name="bankBranch" [(ngModel)]="form.bankBranch" placeholder="HCM" />
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button type="submit" class="btn primary" [disabled]="saving()">
            {{ saving() ? 'Đang lưu...' : '💾 Lưu thay đổi' }}
          </button>
          <button type="button" class="btn secondary" (click)="cancelEdit()">Hủy</button>
        </div>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .profile-page { padding: 24px; max-width: 1200px; margin: 0 auto; }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .header-left h2 { margin: 0 0 6px; color: #1e293b; font-size: 22px; }
    .subtitle { display: flex; align-items: center; gap: 12px; }
    .meta { color: #94a3b8; font-size: 13px; }

    /* Loading */
    .loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 60px 20px; color: #64748b; }
    .spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Alerts */
    .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
    .alert.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .alert.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

    /* Stats Strip */
    .stats-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { display: flex; align-items: center; gap: 14px; background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid; }
    .stat-card.accent-blue { border-color: #3b82f6; }
    .stat-card.accent-green { border-color: #22c55e; }
    .stat-card.accent-purple { border-color: #8b5cf6; }
    .stat-card.accent-orange { border-color: #f97316; }
    .stat-icon { font-size: 28px; }
    .stat-value { font-size: 22px; font-weight: 700; color: #1e293b; }
    .stat-label { font-size: 12px; color: #94a3b8; margin-top: 2px; }

    /* Content Grid */
    .content-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }

    /* Section Cards */
    .section-card { background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .section-card.wide { grid-column: span 2; }
    .section-header { margin-bottom: 16px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
    .section-header h3 { margin: 0; font-size: 16px; color: #334155; }

    /* Info Grid */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .info-item { display: flex; flex-direction: column; gap: 4px; }
    .info-item.full { grid-column: span 2; margin-top: 12px; }
    .info-item label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .info-item span { font-size: 14px; color: #334155; }
    .bio-text { font-size: 14px; color: #475569; line-height: 1.6; margin: 0; white-space: pre-line; }
    .empty-text { color: #cbd5e1; font-style: italic; font-size: 13px; }
    .mono { font-family: 'Courier New', monospace; letter-spacing: 1px; }

    /* Tags */
    .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 500; }
    .tag.blue { background: #dbeafe; color: #2563eb; }
    .tag.green { background: #dcfce7; color: #16a34a; }
    .tag.gray { background: #f1f5f9; color: #475569; }

    /* Pricing */
    .pricing-row { display: flex; gap: 24px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .price-box { display: flex; flex-direction: column; gap: 4px; }
    .price-box label { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .price { font-size: 20px; font-weight: 700; color: #059669; }

    /* Qualifications */
    .qualification-list { display: flex; flex-direction: column; gap: 12px; }
    .qualification-card { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #f8fafc; border-radius: 8px; }
    .qual-icon { font-size: 24px; }
    .qual-title { font-weight: 600; color: #334155; font-size: 14px; }
    .qual-meta { font-size: 13px; color: #64748b; }

    /* Schedule */
    .schedule-grid { display: flex; flex-wrap: wrap; gap: 10px; }
    .schedule-item { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd; }
    .day-badge { font-weight: 600; color: #0369a1; font-size: 13px; min-width: 60px; }
    .time-range { color: #475569; font-size: 13px; font-family: monospace; }

    /* Badges */
    .badge { padding: 3px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; background: #e2e8f0; color: #475569; display: inline-block; }
    .badge[data-status="ACTIVE"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="PENDING"] { background: #fef9c3; color: #ca8a04; }
    .badge[data-status="APPROVED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="SUSPENDED"] { background: #fef2f2; color: #dc2626; }
    .badge[data-status="INACTIVE"] { background: #f1f5f9; color: #64748b; }
    .badge[data-status="FINALIZED"], .badge[data-status="PAID"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="SCHEDULED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="CANCELLED"] { background: #fef2f2; color: #dc2626; }
    .badge[data-status="TEACHER_COMPLETED"], .badge[data-status="PENDING_REVIEW"] { background: #fef9c3; color: #ca8a04; }
    .badge[data-mode="ONLINE"] { background: #ede9fe; color: #7c3aed; }
    .badge[data-mode="OFFLINE"] { background: #fef3c7; color: #b45309; }
    .badge[data-mode="BOTH"] { background: #dbeafe; color: #2563eb; }

    /* Data Table */
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .data-table tr:hover { background: #f8fafc; }

    /* Session Stats */
    .session-stats { display: flex; flex-direction: column; gap: 8px; }
    .session-stat-row { display: flex; align-items: center; gap: 12px; padding: 6px 0; }
    .stat-count { font-weight: 600; color: #334155; min-width: 80px; }
    .stat-amount { color: #059669; font-weight: 500; margin-left: auto; }

    /* Video Link */
    .video-link { display: inline-block; padding: 10px 16px; background: #f0f9ff; border-radius: 8px; color: #0284c7; text-decoration: none; font-weight: 500; transition: background 0.2s; }
    .video-link:hover { background: #e0f2fe; }

    /* Empty Section */
    .empty-section { color: #94a3b8; font-style: italic; font-size: 14px; padding: 20px; text-align: center; background: #f8fafc; border-radius: 8px; }

    /* Buttons */
    .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
    .btn.primary { background: #3b82f6; color: #fff; }
    .btn.primary:hover { background: #2563eb; }
    .btn.primary:disabled { background: #93c5fd; cursor: not-allowed; }
    .btn.secondary { background: #f1f5f9; color: #475569; }
    .btn.secondary:hover { background: #e2e8f0; }
    .btn.small { font-size: 13px; padding: 8px 14px; }

    /* Edit Mode */
    .edit-content { background: #fff; border-radius: 12px; padding: 0; }
    .edit-section { padding: 24px; border-bottom: 1px solid #f1f5f9; }
    .edit-section h3 { margin: 0 0 18px; font-size: 16px; color: #334155; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .form-grid.compact { grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field.full { grid-column: span 2; }
    .field label { font-size: 13px; color: #475569; font-weight: 500; }
    .field label small { color: #94a3b8; font-weight: 400; }
    .field input, .field select, .field textarea { padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; color: #334155; transition: border-color 0.2s; outline: none; font-family: inherit; }
    .field input:focus, .field select:focus, .field textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

    /* Qualification Edit */
    .qual-edit-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 12px; }
    .qual-edit-item { display: flex; gap: 12px; align-items: flex-end; padding: 14px; background: #f8fafc; border-radius: 8px; }
    .qual-edit-item .form-grid { flex: 1; }

    /* Availability Edit */
    .avail-edit-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .avail-edit-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; }
    .avail-edit-item select, .avail-edit-item input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .avail-edit-item select { min-width: 110px; }
    .time-sep { color: #94a3b8; font-size: 14px; }

    /* Icon Buttons */
    .btn-icon { width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
    .btn-icon.danger { background: #fef2f2; color: #dc2626; }
    .btn-icon.danger:hover { background: #fee2e2; }

    /* Form Actions */
    .form-actions { padding: 24px; display: flex; gap: 12px; background: #fff; border-radius: 0 0 12px 12px; position: sticky; bottom: 0; border-top: 1px solid #e2e8f0; }

    /* Responsive */
    @media (max-width: 900px) {
      .stats-strip { grid-template-columns: repeat(2, 1fr); }
      .content-grid { grid-template-columns: 1fr; }
      .section-card.wide { grid-column: span 1; }
      .form-grid { grid-template-columns: 1fr; }
      .form-grid.compact { grid-template-columns: 1fr 1fr; }
      .info-grid { grid-template-columns: 1fr; }
    }
    @media (max-width: 600px) {
      .stats-strip { grid-template-columns: 1fr; }
      .profile-page { padding: 16px; }
      .form-grid.compact { grid-template-columns: 1fr; }
    }
  `]
})
export class TeacherProfileComponent implements OnInit {
  profile = signal<TeacherProfile | null>(null);
  fullProfile = signal<TeacherFullProfile | null>(null);
  loading = signal(false);
  error = signal('');
  success = signal('');
  editing = signal(false);
  saving = signal(false);

  form: ProfileForm = this.blankForm();
  qualifications: QualificationForm[] = [];
  availabilitySlots: AvailabilityForm[] = [];

  constructor(
    private teacherService: TeacherService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  async loadProfile() {
    this.loading.set(true);
    this.error.set('');
    try {
      const myProfile = await this.teacherService.getMyProfile();
      if (!myProfile) {
        this.error.set('Chưa có hồ sơ giáo viên. Vui lòng liên hệ quản trị viên.');
        return;
      }
      this.profile.set(myProfile);

      // Load full profile with stats
      const fullProfile = await this.teacherService.getFullProfile(myProfile._id);
      this.fullProfile.set(fullProfile);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể tải hồ sơ giáo viên');
    } finally {
      this.loading.set(false);
    }
  }

  startEdit() {
    const p = this.profile();
    if (!p) return;
    this.form = {
      subjects: p.subjects?.join(', ') || '',
      grades: p.grades?.join(', ') || '',
      teachingMode: p.teachingMode || 'BOTH',
      locations: p.locations?.join(', ') || '',
      bio: p.bio || '',
      yearsOfExperience: p.yearsOfExperience || 0,
      videoIntroUrl: p.videoIntroUrl || '',
      pricePerSession: p.pricePerSession || 0,
      pricePerHour: p.pricePerHour || 0,
      bankName: p.bankInfo?.bankName || '',
      accountNumber: p.bankInfo?.accountNumber || '',
      accountHolderName: p.bankInfo?.accountHolderName || '',
      bankBranch: p.bankInfo?.branch || '',
    };
    this.qualifications = (p.qualifications || []).map(q => ({
      title: q.title,
      institution: q.institution || '',
      year: q.year || null,
      imageUrl: q.imageUrl || '',
    }));
    this.availabilitySlots = (p.availability || []).map(a => ({
      day: a.day,
      startTime: a.startTime,
      endTime: a.endTime,
    }));
    this.editing.set(true);
    this.success.set('');
  }

  cancelEdit() {
    this.editing.set(false);
  }

  addQualification() {
    this.qualifications.push({ title: '', institution: '', year: null, imageUrl: '' });
  }

  removeQualification(i: number) {
    this.qualifications.splice(i, 1);
  }

  addAvailability() {
    this.availabilitySlots.push({ day: 'MONDAY', startTime: '08:00', endTime: '12:00' });
  }

  removeAvailability(i: number) {
    this.availabilitySlots.splice(i, 1);
  }

  async saveProfile() {
    const p = this.profile();
    if (!p) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const payload: any = {
        subjects: this.form.subjects.split(',').map(s => s.trim()).filter(Boolean),
        grades: this.form.grades.split(',').map(s => s.trim()).filter(Boolean),
        teachingMode: this.form.teachingMode,
        locations: this.form.locations.split(',').map(s => s.trim()).filter(Boolean),
        bio: this.form.bio,
        yearsOfExperience: this.form.yearsOfExperience,
        videoIntroUrl: this.form.videoIntroUrl || undefined,
        pricePerSession: this.form.pricePerSession,
        pricePerHour: this.form.pricePerHour || undefined,
        qualifications: this.qualifications
          .filter(q => q.title.trim())
          .map(q => ({
            title: q.title.trim(),
            institution: q.institution?.trim() || undefined,
            year: q.year || undefined,
            imageUrl: q.imageUrl?.trim() || undefined,
          })),
        availability: this.availabilitySlots.map(a => ({
          day: a.day,
          startTime: a.startTime,
          endTime: a.endTime,
        })),
      };

      // Bank info only if any field is filled
      if (this.form.bankName || this.form.accountNumber || this.form.accountHolderName) {
        payload.bankInfo = {
          bankName: this.form.bankName,
          accountNumber: this.form.accountNumber,
          accountHolderName: this.form.accountHolderName,
          branch: this.form.bankBranch || undefined,
        };
      }

      await this.teacherService.updateProfile(p._id, payload);
      this.success.set('Cập nhật hồ sơ thành công!');
      this.editing.set(false);
      await this.loadProfile();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể cập nhật hồ sơ');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  blankForm(): ProfileForm {
    return {
      subjects: '', grades: '', teachingMode: 'BOTH', locations: '',
      bio: '', yearsOfExperience: 0, videoIntroUrl: '',
      pricePerSession: 0, pricePerHour: 0,
      bankName: '', accountNumber: '', accountHolderName: '', bankBranch: '',
    };
  }

  getUserName(): string {
    const u = this.profile()?.userId;
    return typeof u === 'object' ? u?.fullName || '' : '';
  }

  getUserEmail(): string {
    const u = this.profile()?.userId;
    return typeof u === 'object' ? u?.email || '' : '';
  }

  getUserPhone(): string {
    const u = this.profile()?.userId;
    return typeof u === 'object' ? (u as any)?.phone || '' : '';
  }

  statusLabel(s: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', ACTIVE: 'Đang hoạt động',
      SUSPENDED: 'Tạm ngưng', INACTIVE: 'Không hoạt động',
    };
    return labels[s] || s;
  }

  teachingModeLabel(m: string): string {
    const labels: Record<string, string> = { ONLINE: 'Online', OFFLINE: 'Offline', BOTH: 'Cả hai' };
    return labels[m] || m;
  }

  dayLabel(d: string): string {
    const labels: Record<string, string> = {
      MONDAY: 'T2', TUESDAY: 'T3', WEDNESDAY: 'T4', THURSDAY: 'T5',
      FRIDAY: 'T6', SATURDAY: 'T7', SUNDAY: 'CN',
    };
    return labels[d] || d;
  }

  maskAccount(acc: string): string {
    if (!acc || acc.length < 6) return acc;
    return acc.slice(0, 2) + '****' + acc.slice(-4);
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }
}
