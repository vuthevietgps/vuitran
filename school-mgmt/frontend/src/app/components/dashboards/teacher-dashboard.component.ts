import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <div class="dashboard">
    <h2>Dashboard Giáo viên</h2>

    <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <div *ngIf="data()" class="grid">
      <div class="card full handbook-card">
        <div class="handbook-copy">
          <p class="eyebrow">Internal Teacher Hub</p>
          <h3>Cẩm nang giáo viên nội bộ</h3>
          <p>
            Mở landing page tổng hợp toàn bộ hướng dẫn sử dụng, checklist theo ngày, scenario kiểm tra, ảnh minh họa và video thao tác dành cho giáo viên.
          </p>
        </div>
        <div class="handbook-actions">
          <a class="handbook-link" routerLink="/app/internal-handbook">Mở cẩm nang GV</a>
        </div>
      </div>

      <!-- Quick stats -->
      <div class="card highlight blue">
        <h4>Buổi học sắp tới</h4>
        <div class="value">{{ data()!.sessions.upcomingCount }}</div>
        <small>Tổng: {{ data()!.sessions.total }} buổi</small>
      </div>
      <div class="card highlight green">
        <h4>Tổng thu nhập</h4>
        <div class="value">{{ data()!.earnings.totalEarned | number:'1.0-0' }}đ</div>
        <small>Chờ thanh toán: {{ data()!.earnings.pendingPayout | number:'1.0-0' }}đ</small>
      </div>
      <div class="card highlight purple">
        <h4>Lớp đang dạy</h4>
        <div class="value">{{ data()!.classes.activeCount }}</div>
      </div>
      <div class="card highlight orange">
        <h4>Ticket đang mở</h4>
        <div class="value">{{ data()!.tickets.openTickets }}</div>
        <small>Tổng ticket: {{ data()!.tickets.myTickets }}</small>
      </div>

      <!-- Profile info -->
      <div class="card wide" *ngIf="data()!.profile">
        <h4>Hồ sơ giảng dạy</h4>
        <div class="profile-grid">
          <div><strong>Môn học:</strong> {{ data()!.profile.subjects?.join(', ') || 'Chưa cập nhật' }}</div>
          <div><strong>Khối lớp:</strong> {{ data()!.profile.grades?.join(', ') || 'Chưa cập nhật' }}</div>
          <div><strong>Đánh giá:</strong> {{ data()!.profile.averageRating || 'N/A' }} ⭐</div>
          <div><strong>Tổng buổi dạy:</strong> {{ data()!.profile.totalSessionsCompleted || 0 }}</div>
          <div><strong>Giá/buổi:</strong> {{ data()!.profile.hourlyRate | number:'1.0-0' }}đ</div>
          <div><strong>Trạng thái:</strong> <span class="badge" [attr.data-status]="data()!.profile.status">{{ data()!.profile.status }}</span></div>
        </div>
      </div>

      <!-- Session stats -->
      <div class="card">
        <h4>Thống kê buổi học</h4>
        <div class="stat-row">
          <div class="stat"><span class="num">{{ data()!.sessions.completedCount }}</span><span class="lbl">Hoàn thành</span></div>
          <div class="stat"><span class="num">{{ data()!.sessions.cancelledCount }}</span><span class="lbl">Hủy</span></div>
          <div class="stat"><span class="num">{{ data()!.sessions.noShowCount }}</span><span class="lbl">Vắng</span></div>
        </div>
        <div class="status-list" style="margin-top:12px">
          <div *ngFor="let item of objectEntries(data()!.sessions.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Last payroll -->
      <div class="card">
        <h4>Bảng lương gần nhất</h4>
        <div *ngIf="!data()!.earnings.lastPayroll" class="empty">Chưa có bảng lương</div>
        <div *ngIf="data()!.earnings.lastPayroll as payroll">
          <p>Mã: <strong>{{ payroll.payrollCode }}</strong></p>
          <p>Kỳ: {{ payroll.periodStart | date:'dd/MM/yyyy' }} → {{ payroll.periodEnd | date:'dd/MM/yyyy' }}</p>
          <p>Số tiền: <strong>{{ payroll.netAmount | number:'1.0-0' }}đ</strong></p>
          <p>Trạng thái: <span class="badge" [attr.data-status]="payroll.status">{{ payroll.status }}</span></p>
        </div>
      </div>

      <!-- Active classes -->
      <div class="card wide" *ngIf="data()!.classes.list.length > 0">
        <h4>Lớp đang dạy</h4>
        <table class="data-table">
          <thead><tr><th>Tên lớp</th><th>Môn</th><th>Khối</th><th>Số HS</th></tr></thead>
          <tbody>
            <tr *ngFor="let c of data()!.classes.list">
              <td><strong>{{ c.name }}</strong></td>
              <td>{{ c.subject }}</td>
              <td>{{ c.grade }}</td>
              <td>{{ c.students?.length || c.studentIds?.length || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Upcoming sessions -->
      <div class="card full">
        <h4>Lịch dạy sắp tới</h4>
        <div *ngIf="data()!.upcoming.length === 0" class="empty">Không có buổi dạy sắp tới</div>
        <table *ngIf="data()!.upcoming.length > 0" class="data-table">
          <thead><tr><th>Ngày giờ</th><th>Học sinh</th><th>Lớp</th><th>Trạng thái</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of data()!.upcoming">
              <td>{{ (s.scheduledDate || s.sessionDate) | date:'dd/MM/yyyy HH:mm' }}</td>
              <td>{{ s.studentId?.fullName || s.studentId?.name || 'N/A' }}</td>
              <td>{{ s.classId?.name || 'N/A' }}</td>
              <td><span class="badge" [attr.data-status]="s.status">{{ s.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .dashboard { padding: 24px; }
    h2 { margin:0 0 24px; color:#1e293b; }
    .loading { text-align:center; padding:40px; color:#64748b; }
    .error { background:#fef2f2; color:#dc2626; padding:12px 16px; border-radius:8px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:16px; }
    .card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .card h4 { margin:0 0 12px; color:#475569; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; }
    .card.wide { grid-column: span 2; }
    .card.full { grid-column: 1 / -1; }
    .handbook-card {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:16px;
      border:1px solid rgba(15,118,110,0.14);
      background:
        radial-gradient(circle at top right, rgba(251,191,36,0.18), transparent 24%),
        linear-gradient(135deg, #f0fdfa 0%, #fffaf0 100%);
    }
    .handbook-copy { max-width:860px; }
    .eyebrow {
      margin:0 0 8px;
      color:#0f766e;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.14em;
      text-transform:uppercase;
    }
    .handbook-card h3 {
      margin:0 0 10px;
      color:#0f172a;
      font-size:26px;
      letter-spacing:-0.03em;
    }
    .handbook-card p {
      margin:0;
      color:#475569;
      line-height:1.6;
      font-size:14px;
    }
    .handbook-actions { display:flex; align-items:center; }
    .handbook-link {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      padding:0 18px;
      border-radius:999px;
      text-decoration:none;
      background:linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      color:#fff;
      font-weight:700;
      box-shadow:0 12px 26px rgba(15,118,110,0.2);
    }
    .card.highlight { border-top:4px solid; }
    .card.highlight.blue { border-color:#3b82f6; }
    .card.highlight.green { border-color:#22c55e; }
    .card.highlight.purple { border-color:#8b5cf6; }
    .card.highlight.orange { border-color:#f97316; }
    .value { font-size:28px; font-weight:700; color:#1e293b; margin-bottom:4px; }
    .card small { color:#94a3b8; }
    .stat-row { display:flex; gap:24px; flex-wrap:wrap; }
    .stat { display:flex; flex-direction:column; align-items:center; }
    .stat .num { font-size:24px; font-weight:700; color:#1e293b; }
    .stat .lbl { font-size:12px; color:#94a3b8; margin-top:2px; }
    .status-list { display:flex; flex-direction:column; gap:6px; }
    .status-item { display:flex; justify-content:space-between; align-items:center; }
    .badge { padding:2px 8px; border-radius:99px; font-size:11px; background:#e2e8f0; color:#475569; font-weight:600; }
    .badge[data-status="ACTIVE"], .badge[data-status="FINALIZED"], .badge[data-status="PAID"] { background:#dcfce7; color:#16a34a; }
    .badge[data-status="SCHEDULED"] { background:#dbeafe; color:#2563eb; }
    .badge[data-status="CANCELLED"] { background:#fef2f2; color:#dc2626; }
    .badge[data-status="IN_PROGRESS"], .badge[data-status="PENDING_REVIEW"], .badge[data-status="TEACHER_COMPLETED"] { background:#fef9c3; color:#ca8a04; }
    .count { font-weight:600; color:#1e293b; }
    .profile-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:14px; color:#475569; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:12px; text-transform:uppercase; }
    .data-table td { padding:8px; border-bottom:1px solid #f1f5f9; }
    .empty { color:#94a3b8; font-style:italic; padding:12px 0; }
    p { margin:4px 0; color:#475569; font-size:14px; }
    @media (max-width:768px) {
      .card.wide { grid-column: span 1; }
      .profile-grid { grid-template-columns:1fr; }
      .handbook-card { flex-direction:column; align-items:flex-start; }
      .handbook-card h3 { font-size:22px; }
    }
  `]
})
export class TeacherDashboardComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.dashboardService.getTeacherDashboard();
      this.data.set(result);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }
}
