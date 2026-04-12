import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DashboardService } from '../../services/dashboard.service';
import { FinancialControlService } from '../../services/financial-control.service';

@Component({
  selector: 'app-director-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="dashboard" data-testid="director-dashboard-page">
    <div class="header">
      <h2>Dashboard Giám đốc — Tổng quan hệ thống</h2>
      <div class="date-range">
        <input type="date" [(ngModel)]="fromDate" (change)="load()" placeholder="Từ ngày">
        <input type="date" [(ngModel)]="toDate" (change)="load()" placeholder="Đến ngày">
      </div>
    </div>

    <!-- Tab navigation -->
    <div class="tabs" data-testid="director-dashboard-tabs">
      <button [class.active]="activeTab === 'overview'" (click)="activeTab = 'overview'">Tổng quan</button>
      <button [class.active]="activeTab === 'accounting'" (click)="activeTab = 'accounting'">Kế toán</button>
      <button [class.active]="activeTab === 'ops'" (click)="activeTab = 'ops'">Vận hành</button>
      <button [class.active]="activeTab === 'staff'" (click)="activeTab = 'staff'">Nhân sự</button>
      <button [class.active]="activeTab === 'birthdays'" (click)="activeTab = 'birthdays'">Sinh nhật</button>
    </div>

    <div *ngIf="loading()" class="loading">Đang tải dữ liệu...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <!-- ======================== TAB: TỔNG QUAN ======================== -->
    <div *ngIf="data() && activeTab === 'overview'" class="grid" data-testid="director-overview-grid">
      <!-- Overview cards -->
      <div class="card highlight blue">
        <h4>Doanh thu</h4>
        <div class="value">{{ data()!.director.overview.totalRevenue | number:'1.0-0' }}đ</div>
        <small>Lợi nhuận: {{ data()!.director.overview.grossProfit | number:'1.0-0' }}đ ({{ data()!.director.overview.profitMargin }}%)</small>
      </div>
      <div class="card highlight green">
        <h4>Chi phí GV</h4>
        <div class="value">{{ data()!.director.overview.totalTeacherCost | number:'1.0-0' }}đ</div>
      </div>
      <div class="card highlight purple">
        <h4>Buổi học</h4>
        <div class="value">{{ data()!.director.sessions.total }}</div>
        <small>Hoàn thành: {{ data()!.director.sessions.completionRate }}%</small>
      </div>
      <div class="card highlight orange">
        <h4>Ticket mở</h4>
        <div class="value">{{ data()!.director.tickets.openCount }}</div>
        <small>Quá hạn: {{ data()!.director.tickets.overdueCount }}</small>
      </div>

      <a
        *ngIf="data()!.director.tickets.overdueCount > 0"
        class="card full alert-card danger clickable-card"
        [routerLink]="['/app/tickets']"
        [queryParams]="{ tab: 'all', overdue: 'true' }"
        data-testid="director-overdue-alert">
        <div class="alert-card-header">
          <div>
            <h4>Overdue Tickets</h4>
            <p>{{ data()!.director.tickets.overdueCount }} ticket qua han SLA con mo.</p>
          </div>
          <span class="alert-pill danger" data-testid="director-overdue-count">{{ data()!.director.tickets.overdueCount }}</span>
        </div>
        <div class="alert-card-body">
          <span class="alert-copy">Mo danh sach ticket da loc qua han</span>
          <span class="alert-link">Xem ticket qua han</span>
        </div>
      </a>

      <div
        *ngIf="criticalAlerts().length > 0"
        class="card full alert-card danger"
        data-testid="director-critical-alerts">
        <div class="alert-card-header">
          <div>
            <h4>Critical Anomalies</h4>
            <p>Canh bao nghiem trong tu kiem soat tai chinh.</p>
          </div>
          <a class="alert-link standalone-link" [routerLink]="['/app/financial-control']">Mo kiem soat tai chinh</a>
        </div>
        <div class="alert-list">
          <div *ngFor="let alert of criticalAlerts()" class="alert-item" data-testid="director-critical-alert-item">
            <span class="alert-pill" [attr.data-severity]="alert.severity">{{ alert.severity }}</span>
            <div class="alert-item-copy">
              <strong>{{ alert.title }}</strong>
              <p>{{ alert.message }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Users -->
      <div class="card wide">
        <h4>Người dùng</h4>
        <div class="stat-row">
          <div class="stat"><span class="num">{{ data()!.director.users.totalTeachers }}</span><span class="lbl">Giáo viên</span></div>
          <div class="stat"><span class="num">{{ data()!.director.users.activeTeachers }}</span><span class="lbl">GV hoạt động</span></div>
          <div class="stat"><span class="num">{{ data()!.director.users.totalParents }}</span><span class="lbl">Phụ huynh</span></div>
          <div class="stat"><span class="num">{{ data()!.director.users.totalStudents }}</span><span class="lbl">Học sinh</span></div>
        </div>
      </div>

      <!-- Sessions by status -->
      <div class="card">
        <h4>Buổi học theo trạng thái</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.director.sessions.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ sessionLabel(item[0]) }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Payroll -->
      <div class="card">
        <h4>Bảng lương</h4>
        <p>Đã trả: <strong>{{ data()!.director.payroll.totalPaid | number:'1.0-0' }}đ</strong></p>
        <p>Chờ duyệt: <strong>{{ data()!.director.payroll.pendingApproval }}</strong> bảng lương</p>
        <div class="status-list" style="margin-top:8px">
          <div *ngFor="let item of objectEntries(data()!.director.payroll.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1].count }} ({{ item[1].totalNet | number:'1.0-0' }}đ)</span>
          </div>
        </div>
      </div>

      <!-- Wallets -->
      <div class="card">
        <h4>Ví điện tử</h4>
        <p>Tổng số dư: <strong>{{ data()!.director.wallets.totalBalance | number:'1.0-0' }}đ</strong></p>
        <p>Tổng nạp: <strong>{{ data()!.director.wallets.totalTopUp | number:'1.0-0' }}đ</strong></p>
        <p>Tổng trừ: <strong>{{ data()!.director.wallets.totalDeducted | number:'1.0-0' }}đ</strong></p>
        <p>Tổng hoàn: <strong>{{ data()!.director.wallets.totalRefunded | number:'1.0-0' }}đ</strong></p>
      </div>

      <!-- Tickets -->
      <div class="card">
        <h4>Khiếu nại / Ticket</h4>
        <p>Tổng: <strong>{{ data()!.director.tickets.total }}</strong></p>
        <p>Đang mở: <strong>{{ data()!.director.tickets.openCount }}</strong></p>
        <p>Quá hạn SLA: <strong>{{ data()!.director.tickets.overdueCount }}</strong></p>
        <p *ngIf="data()!.director.tickets.avgResolutionHours !== null">
          TB xử lý: <strong>{{ data()!.director.tickets.avgResolutionHours }}h</strong>
        </p>
      </div>

      <!-- Recent activity -->
      <div class="card full">
        <h4>Hoạt động gần đây</h4>
        <div class="recent-grid">
          <div>
            <h5>Buổi học mới</h5>
            <div *ngFor="let s of data()!.director.recentActivity.recentSessions.slice(0,5)" class="recent-item">
              <span>{{ s.teacherId?.fullName || 'N/A' }} - {{ s.studentId?.name || 'N/A' }}</span>
              <span class="badge" [attr.data-status]="s.status">{{ sessionLabel(s.status) }}</span>
            </div>
          </div>
          <div>
            <h5>Ticket mới</h5>
            <div *ngFor="let t of data()!.director.recentActivity.recentTickets.slice(0,5)" class="recent-item">
              <span>{{ t.ticketCode }} - {{ t.subject }}</span>
              <span class="badge" [attr.data-status]="t.status">{{ t.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================== TAB: KẾ TOÁN ======================== -->
    <div *ngIf="data() && activeTab === 'accounting'" class="grid">
      <div class="card highlight blue">
        <h4>Doanh thu buổi học</h4>
        <div class="value">{{ data()!.accounting.revenue.totalSessionRevenue | number:'1.0-0' }}đ</div>
        <small>Chi phí GV: {{ data()!.accounting.revenue.totalTeacherCost | number:'1.0-0' }}đ</small>
      </div>
      <div class="card highlight green">
        <h4>Lợi nhuận gộp</h4>
        <div class="value">{{ data()!.accounting.revenue.grossProfit | number:'1.0-0' }}đ</div>
      </div>
      <div class="card highlight purple">
        <h4>Tổng số dư ví</h4>
        <div class="value">{{ data()!.accounting.wallets.totalBalance | number:'1.0-0' }}đ</div>
        <small>{{ data()!.accounting.wallets.walletCount }} ví | {{ data()!.accounting.wallets.frozenCount }} đóng băng</small>
      </div>
      <div class="card highlight orange">
        <h4>Payroll đã trả</h4>
        <div class="value">{{ data()!.accounting.payroll.totalPaidThisPeriod | number:'1.0-0' }}đ</div>
      </div>

      <div
        *ngIf="expenseBreakdownEntries().length > 0"
        class="card full"
        data-testid="director-expense-breakdown">
        <div class="section-header">
          <div>
            <h4>Expense Breakdown</h4>
            <p class="section-copy">Chi phi da thanh toan theo tung danh muc.</p>
          </div>
          <a class="alert-link standalone-link" [routerLink]="['/app/expenses']">Mo danh sach chi phi</a>
        </div>
        <div class="expense-breakdown-list">
          <div *ngFor="let item of expenseBreakdownEntries()" class="expense-row" data-testid="director-expense-row">
            <div class="expense-row-head">
              <span class="expense-label" data-testid="director-expense-label">{{ expenseCategoryLabel(item[0]) }}</span>
              <span class="expense-value" data-testid="director-expense-value">{{ item[1].total | number:'1.0-0' }} VND</span>
            </div>
            <div class="expense-bar-track">
              <div class="expense-bar-fill" [style.width.%]="expensePercent(item[1].total)"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Financial summary -->
      <div class="card wide">
        <h4>Tổng hợp giao dịch</h4>
        <table class="data-table">
          <thead><tr><th>Loại</th><th>Số lượng</th><th>Tổng tiền</th></tr></thead>
          <tbody>
            <tr *ngFor="let item of objectEntries(data()!.accounting.financialSummary)">
              <td><span class="badge" [attr.data-type]="item[0]">{{ txTypeLabel(item[0]) }}</span></td>
              <td>{{ item[1].count }}</td>
              <td>{{ item[1].totalAmount | number:'1.0-0' }}đ</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Wallet stats -->
      <div class="card">
        <h4>Thống kê ví</h4>
        <div class="stat-row">
          <div class="stat"><span class="num">{{ data()!.accounting.wallets.totalTopUp | number:'1.0-0' }}đ</span><span class="lbl">Tổng nạp</span></div>
          <div class="stat"><span class="num">{{ data()!.accounting.wallets.totalDeducted | number:'1.0-0' }}đ</span><span class="lbl">Tổng trừ</span></div>
          <div class="stat"><span class="num">{{ data()!.accounting.wallets.totalRefunded | number:'1.0-0' }}đ</span><span class="lbl">Tổng hoàn</span></div>
        </div>
      </div>

      <!-- Payroll by status -->
      <div class="card">
        <h4>Payroll theo trạng thái</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.accounting.payroll.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <div>
              <span class="count">{{ item[1].count }} bảng</span>
              <small> | {{ item[1].totalNet | number:'1.0-0' }}đ</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending top-ups -->
      <div class="card wide">
        <h4>Top-up chờ duyệt ({{ data()!.accounting.pendingTopUps.length }})</h4>
        <div *ngIf="data()!.accounting.pendingTopUps.length === 0" class="empty">Không có yêu cầu nào chờ duyệt</div>
        <table *ngIf="data()!.accounting.pendingTopUps.length > 0" class="data-table">
          <thead><tr><th>Người dùng</th><th>Số tiền</th><th>Ngày tạo</th></tr></thead>
          <tbody>
            <tr *ngFor="let t of data()!.accounting.pendingTopUps">
              <td>{{ t.userId?.fullName || t.userId?.email || 'N/A' }}</td>
              <td>{{ t.amount | number:'1.0-0' }}đ</td>
              <td>{{ t.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent ledger -->
      <div class="card full">
        <h4>Giao dịch gần đây</h4>
        <table class="data-table">
          <thead><tr><th>Loại</th><th>Người dùng</th><th>Số tiền</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
          <tbody>
            <tr *ngFor="let l of data()!.accounting.ledgerRecent">
              <td><span class="badge" [attr.data-type]="l.type">{{ txTypeLabel(l.type) }}</span></td>
              <td>{{ l.userId?.fullName || 'N/A' }}</td>
              <td>{{ l.amount | number:'1.0-0' }}đ</td>
              <td><span class="badge" [attr.data-status]="l.status">{{ l.status }}</span></td>
              <td>{{ l.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ======================== TAB: VẬN HÀNH ======================== -->
    <div *ngIf="data() && activeTab === 'ops'" class="grid">
      <div class="card highlight blue">
        <h4>Buổi học hôm nay</h4>
        <div class="value">{{ data()!.ops.sessions.upcomingToday }}</div>
        <small>Cần finalize: {{ data()!.ops.sessions.needsFinalization }}</small>
      </div>
      <div class="card highlight green">
        <h4>Lớp đang hoạt động</h4>
        <div class="value">{{ data()!.ops.classes.active }} / {{ data()!.ops.classes.total }}</div>
      </div>
      <div class="card highlight purple">
        <h4>Giáo viên</h4>
        <div class="value">{{ data()!.ops.teachers.active }}</div>
        <small>Chờ duyệt: {{ data()!.ops.teachers.pendingApproval }} | Tạm ngưng: {{ data()!.ops.teachers.suspended }}</small>
      </div>
      <div class="card highlight orange">
        <h4>Ticket quá hạn</h4>
        <div class="value">{{ data()!.ops.tickets.overdueCount }}</div>
        <small>Tổng ticket: {{ data()!.ops.tickets.total }}</small>
      </div>

      <!-- Sessions by status -->
      <div class="card">
        <h4>Buổi học ({{ data()!.ops.sessions.total }})</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.ops.sessions.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ sessionLabel(item[0]) }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Classes by status -->
      <div class="card">
        <h4>Lớp học ({{ data()!.ops.classes.total }})</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.ops.classes.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Students -->
      <div class="card">
        <h4>Học sinh</h4>
        <p>Tổng: <strong>{{ data()!.ops.students.total }}</strong></p>
        <p>Chờ duyệt: <strong>{{ data()!.ops.students.pendingApproval }}</strong></p>
      </div>

      <!-- Tickets by status + priority -->
      <div class="card">
        <h4>Ticket theo trạng thái ({{ data()!.ops.tickets.total }})</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.ops.tickets.byStatus)" class="status-item">
            <span class="badge" [attr.data-status]="item[0]">{{ item[0] }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <h4>Ticket theo độ ưu tiên</h4>
        <div class="status-list">
          <div *ngFor="let item of objectEntries(data()!.ops.tickets.byPriority)" class="status-item">
            <span class="badge" [attr.data-priority]="item[0]">{{ priorityLabel(item[0]) }}</span>
            <span class="count">{{ item[1] }}</span>
          </div>
        </div>
      </div>

      <!-- Recent tickets -->
      <div class="card full">
        <h4>Ticket gần đây</h4>
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Tiêu đề</th><th>Người tạo</th><th>Phân công</th><th>Trạng thái</th><th>Ngày</th></tr></thead>
          <tbody>
            <tr *ngFor="let t of data()!.ops.recentTickets">
              <td><strong>{{ t.ticketCode }}</strong></td>
              <td>{{ t.subject }}</td>
              <td>{{ t.createdBy?.fullName || 'N/A' }}</td>
              <td>{{ t.assignedTo?.fullName || '—' }}</td>
              <td><span class="badge" [attr.data-status]="t.status">{{ t.status }}</span></td>
              <td>{{ t.createdAt | date:'dd/MM HH:mm' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ======================== TAB: NHÂN SỰ ======================== -->
    <div *ngIf="data()?.staffLists && activeTab === 'staff'" class="grid">
      <!-- Summary cards -->
      <div class="card highlight blue">
        <h4>Tổng nhân sự</h4>
        <div class="value">{{ data()!.staffLists.totalStaff }}</div>
      </div>
      <div class="card highlight green">
        <h4>Giáo viên</h4>
        <div class="value">{{ data()!.staffLists.teachers.length }}</div>
      </div>
      <div class="card highlight purple">
        <h4>Nhân viên văn phòng</h4>
        <div class="value">{{ (data()!.staffLists.summary['OPS'] || 0) + (data()!.staffLists.summary['ACCOUNTING'] || 0) + (data()!.staffLists.summary['SALE'] || 0) }}</div>
      </div>
      <div class="card highlight orange">
        <h4>HC-NS</h4>
        <div class="value">{{ data()!.staffLists.summary['HCNS'] || 0 }}</div>
      </div>

      <!-- Role filter -->
      <div class="card full" style="padding:12px 20px">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <strong style="margin-right:8px">Lọc vai trò:</strong>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'ALL'" (click)="staffRoleFilter = 'ALL'">Tất cả</button>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'TEACHER'" (click)="staffRoleFilter = 'TEACHER'">Giáo viên</button>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'OPS'" (click)="staffRoleFilter = 'OPS'">Vận hành</button>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'ACCOUNTING'" (click)="staffRoleFilter = 'ACCOUNTING'">Kế toán</button>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'SALE'" (click)="staffRoleFilter = 'SALE'">Sale</button>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'HCNS'" (click)="staffRoleFilter = 'HCNS'">HC-NS</button>
          <button class="filter-btn" [class.active]="staffRoleFilter === 'OTHER'" (click)="staffRoleFilter = 'OTHER'">Khác</button>
        </div>
      </div>

      <!-- Teacher list (detailed) -->
      <div class="card full" *ngIf="staffRoleFilter === 'ALL' || staffRoleFilter === 'TEACHER'">
        <h4>Danh sách giáo viên ({{ data()!.staffLists.teachers.length }})</h4>
        <div *ngIf="data()!.staffLists.teachers.length === 0" class="empty">Chưa có giáo viên nào.</div>
        <div class="table-scroll">
          <table *ngIf="data()!.staffLists.teachers.length > 0" class="data-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th>Môn dạy</th>
                <th>Lớp dạy</th>
                <th>Hình thức</th>
                <th>Rating</th>
                <th>Buổi đã dạy</th>
                <th>Lớp đang dạy</th>
                <th>Kinh nghiệm</th>
                <th>Lương/buổi</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of data()!.staffLists.teachers">
                <td><a class="profile-link" [routerLink]="['/app/users']" [queryParams]="{search: t.fullName}">{{ t.fullName }}</a></td>
                <td>{{ t.email }}</td>
                <td><span class="badge" [attr.data-status]="t.teacherStatus">{{ t.teacherStatus }}</span></td>
                <td>{{ t.subjects?.join(', ') || '—' }}</td>
                <td>{{ t.grades?.join(', ') || '—' }}</td>
                <td>{{ teachingModeLabel(t.teachingMode) }}</td>
                <td>{{ t.rating > 0 ? ('⭐ ' + t.rating) : '—' }}</td>
                <td>{{ t.totalSessions }}</td>
                <td>{{ t.activeClasses }}</td>
                <td>{{ t.yearsOfExperience }} năm</td>
                <td>{{ t.pricePerSession | number:'1.0-0' }}đ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Staff list by role (non-teacher) -->
      <ng-container *ngFor="let entry of objectEntries(data()!.staffLists.byRole)">
        <div class="card full" *ngIf="entry[0] !== 'TEACHER' && entry[0] !== 'DIRECTOR' && entry[0] !== 'PARENT' && (staffRoleFilter === 'ALL' || staffRoleFilter === entry[0] || (staffRoleFilter === 'OTHER' && !isMainRole(entry[0])))">
          <h4>{{ roleLabel(entry[0]) }} ({{ entry[1].length }})</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of entry[1]">
                <td><a class="profile-link" [routerLink]="['/app/users']" [queryParams]="{search: u.fullName}">{{ u.fullName }}</a></td>
                <td>{{ u.email }}</td>
                <td><span class="badge" [attr.data-status]="u.status">{{ u.status }}</span></td>
                <td>{{ u.createdAt | date:'dd/MM/yyyy' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
    </div>

    <!-- ======================== TAB: SINH NHẬT ======================== -->
    <div *ngIf="data() && activeTab === 'birthdays'" class="grid">
      <div class="card highlight blue">
        <h4>HS sinh nhật tháng {{ data()!.birthdays.month }}</h4>
        <div class="value">{{ data()!.birthdays.totalStudentBirthdays }}</div>
        <small>học sinh</small>
      </div>
      <div class="card highlight green">
        <h4>PH sinh nhật tháng {{ data()!.birthdays.month }}</h4>
        <div class="value">{{ data()!.birthdays.totalParentBirthdays }}</div>
        <small>phụ huynh</small>
      </div>

      <!-- Birthday month selector -->
      <div class="card wide">
        <h4>Chọn tháng</h4>
        <select [(ngModel)]="birthdayMonth" (change)="loadBirthdays()">
          <option *ngFor="let m of months" [value]="m.value">{{ m.label }}</option>
        </select>
      </div>

      <!-- Student birthdays -->
      <div class="card full">
        <h4>Học sinh sinh nhật tháng {{ data()!.birthdays.month }}</h4>
        <div *ngIf="data()!.birthdays.studentBirthdays.length === 0" class="empty">Không có học sinh nào sinh nhật tháng này</div>
        <table *ngIf="data()!.birthdays.studentBirthdays.length > 0" class="data-table">
          <thead><tr><th>Mã HS</th><th>Họ tên HS</th><th>Tuổi</th><th>Tháng sinh</th><th>Phụ huynh</th><th>Điện thoại</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of data()!.birthdays.studentBirthdays">
              <td><strong>{{ s.studentCode }}</strong></td>
              <td>{{ s.fullName }}</td>
              <td>{{ s.age }}</td>
              <td>Tháng {{ s.studentBirthMonth }}</td>
              <td>{{ s.parentName }}</td>
              <td>{{ s.parentPhone }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Parent birthdays -->
      <div class="card full">
        <h4>Phụ huynh sinh nhật tháng {{ data()!.birthdays.month }}</h4>
        <div *ngIf="data()!.birthdays.parentBirthdays.length === 0" class="empty">Không có phụ huynh nào sinh nhật tháng này</div>
        <table *ngIf="data()!.birthdays.parentBirthdays.length > 0" class="data-table">
          <thead><tr><th>Mã HS</th><th>Họ tên HS</th><th>Phụ huynh</th><th>Tháng sinh PH</th><th>Điện thoại</th></tr></thead>
          <tbody>
            <tr *ngFor="let s of data()!.birthdays.parentBirthdays">
              <td><strong>{{ s.studentCode }}</strong></td>
              <td>{{ s.fullName }}</td>
              <td>{{ s.parentName }}</td>
              <td>Tháng {{ s.parentBirthMonth }}</td>
              <td>{{ s.parentPhone }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .dashboard { padding: 24px; min-width: 0; box-sizing: border-box; }
    .header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; }
    .header h2 { margin:0; color:#1e293b; font-size:20px; }
    .date-range { display:flex; gap:8px; }
    .date-range input { padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; }
    .tabs {
      display:flex; gap:4px; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:0;
      overflow-x:auto; overscroll-behavior-x:contain; scrollbar-width:thin;
    }
    .tabs button {
      padding:10px 20px; border:none; background:transparent; cursor:pointer;
      font-size:14px; font-weight:600; color:#64748b; border-bottom:3px solid transparent;
      transition: all 0.2s; flex:0 0 auto; white-space:nowrap;
    }
    .tabs button:hover { color:#1e293b; background:#f8fafc; }
    .tabs button.active { color:#2563eb; border-bottom-color:#2563eb; }
    .loading { text-align:center; padding:40px; color:#64748b; }
    .error { background:#fef2f2; color:#dc2626; padding:12px 16px; border-radius:8px; margin-bottom:16px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap:16px; min-width:0; }
    .card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); min-width:0; overflow-wrap:anywhere; }
    .card h4 { margin:0 0 12px; color:#475569; font-size:14px; text-transform:uppercase; letter-spacing:0.5px; }
    .card.wide { grid-column: span 2; }
    .card.full { grid-column: 1 / -1; }
    .card.highlight { border-top:4px solid; }
    .card.highlight.blue { border-color:#3b82f6; }
    .card.highlight.green { border-color:#22c55e; }
    .card.highlight.purple { border-color:#8b5cf6; }
    .card.highlight.orange { border-color:#f97316; }
    .value { font-size:28px; font-weight:700; color:#1e293b; margin-bottom:4px; }
    .card small { color:#94a3b8; }
    .stat-row { display:flex; gap:24px; flex-wrap:wrap; }
    .stat { display:flex; flex-direction:column; align-items:center; }
    .stat .num { font-size:20px; font-weight:700; color:#1e293b; }
    .stat .lbl { font-size:12px; color:#94a3b8; margin-top:2px; }
    .status-list { display:flex; flex-direction:column; gap:6px; }
    .status-item { display:flex; justify-content:space-between; align-items:center; }
    .badge { padding:2px 8px; border-radius:99px; font-size:11px; background:#e2e8f0; color:#475569; font-weight:600; }
    .badge[data-status="FINALIZED"], .badge[data-status="RESOLVED"], .badge[data-status="CLOSED"], .badge[data-status="PAID"], .badge[data-status="ACTIVE"], .badge[data-status="APPROVED"], .badge[data-status="COMPLETED"] { background:#dcfce7; color:#16a34a; }
    .badge[data-status="SCHEDULED"], .badge[data-status="OPEN"] { background:#dbeafe; color:#2563eb; }
    .badge[data-status="CANCELLED"], .badge[data-status="SUSPENDED"], .badge[data-status="REJECTED"] { background:#fef2f2; color:#dc2626; }
    .badge[data-status="IN_PROGRESS"], .badge[data-status="PENDING"], .badge[data-status="PENDING_REVIEW"], .badge[data-status="TEACHER_COMPLETED"], .badge[data-status="DRAFT"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-type="TOP_UP"] { background:#dbeafe; color:#2563eb; }
    .badge[data-type="SESSION_DEDUCT"] { background:#fef2f2; color:#dc2626; }
    .badge[data-type="REFUND"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-type="ADJUSTMENT"] { background:#f3e8ff; color:#7c3aed; }
    .badge[data-type="BONUS"] { background:#dcfce7; color:#16a34a; }
    .badge[data-priority="URGENT"] { background:#fef2f2; color:#dc2626; font-weight:700; }
    .badge[data-priority="HIGH"] { background:#fed7aa; color:#c2410c; }
    .badge[data-priority="MEDIUM"] { background:#fef9c3; color:#ca8a04; }
    .badge[data-priority="LOW"] { background:#e2e8f0; color:#64748b; }
    .count { font-weight:600; color:#1e293b; }
    .recent-grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
    .recent-item { display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th { text-align:left; padding:8px; border-bottom:2px solid #e2e8f0; color:#64748b; font-size:12px; text-transform:uppercase; }
    .data-table td { padding:8px; border-bottom:1px solid #f1f5f9; }
    .empty { color:#94a3b8; font-style:italic; padding:12px 0; }
    .profile-link { color:#2563eb; text-decoration:none; font-weight:600; cursor:pointer; }
    .profile-link:hover { text-decoration:underline; color:#1d4ed8; }
    .filter-btn { padding:6px 14px; border:1px solid #cbd5e1; border-radius:99px; background:#fff; cursor:pointer; font-size:13px; color:#475569; font-weight:500; transition:all 0.15s; }
    .filter-btn:hover { background:#f1f5f9; border-color:#94a3b8; }
    .filter-btn.active { background:#2563eb; color:#fff; border-color:#2563eb; }
    .table-scroll { overflow-x:auto; }
    select { padding:8px 12px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; width:200px; background:#fff; }
    h5 { margin:0 0 8px; color:#64748b; font-size:13px; }
    p { margin:4px 0; color:#475569; font-size:14px; }
    .section-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
    .section-copy { margin:4px 0 0; color:#64748b; }
    .alert-card { border:1px solid #fecaca; background:linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); }
    .alert-card.danger { border-left:4px solid #dc2626; }
    .alert-card-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:12px; }
    .alert-card-body { display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .alert-copy { color:#7f1d1d; font-size:14px; }
    .alert-link {
      color:#b91c1c; font-size:13px; font-weight:700; text-decoration:none;
    }
    .standalone-link { white-space:nowrap; }
    .clickable-card { color:inherit; text-decoration:none; }
    .clickable-card:hover { box-shadow:0 10px 24px rgba(220,38,38,0.12); }
    .alert-pill {
      display:inline-flex; align-items:center; justify-content:center;
      min-width:44px; padding:6px 12px; border-radius:999px; font-size:12px; font-weight:700;
      background:#fee2e2; color:#b91c1c;
    }
    .alert-pill[data-severity="CRITICAL"] { background:#fecaca; color:#991b1b; }
    .alert-pill[data-severity="WARNING"] { background:#fed7aa; color:#c2410c; }
    .alert-list { display:flex; flex-direction:column; gap:12px; }
    .alert-item { display:flex; gap:12px; align-items:flex-start; padding:12px 0; border-top:1px solid #fee2e2; }
    .alert-item:first-child { border-top:none; padding-top:0; }
    .alert-item-copy p { margin:4px 0 0; color:#7f1d1d; }
    .expense-breakdown-list { display:flex; flex-direction:column; gap:14px; }
    .expense-row { display:flex; flex-direction:column; gap:8px; }
    .expense-row-head { display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .expense-label { color:#334155; font-weight:600; }
    .expense-value { color:#0f172a; font-weight:700; }
    .expense-bar-track { height:10px; border-radius:999px; background:#e2e8f0; overflow:hidden; }
    .expense-bar-fill { height:100%; border-radius:999px; background:linear-gradient(90deg, #ef4444 0%, #f97316 100%); min-width:8px; }
    @media (max-width:768px) {
      .dashboard { padding:16px; }
      .card.wide { grid-column: span 1; }
      .recent-grid { grid-template-columns:1fr; }
      .date-range { width:100%; flex-wrap:wrap; }
      .date-range input { flex:1 1 180px; min-width:0; }
      .alert-card-header,
      .alert-card-body,
      .section-header,
      .expense-row-head {
        flex-direction:column;
        align-items:flex-start;
      }
    }
    @media (max-width:480px) {
      .dashboard { padding:12px; }
      .tabs button { padding:10px 14px; }
      .card { padding:16px; }
      .value { font-size:24px; }
      .recent-item,
      .status-item { gap:8px; align-items:flex-start; flex-direction:column; }
    }
  `]
})
export class DirectorDashboardComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');
  financialAlerts = signal<any>(null);
  expenseBreakdown = signal<Record<string, { total: number; count: number }>>({});
  fromDate = '';
  toDate = '';
  activeTab = 'overview';
  birthdayMonth = new Date().getMonth() + 1;
  staffRoleFilter = 'ALL';

  months = [
    { value: 1, label: 'Tháng 1' }, { value: 2, label: 'Tháng 2' }, { value: 3, label: 'Tháng 3' },
    { value: 4, label: 'Tháng 4' }, { value: 5, label: 'Tháng 5' }, { value: 6, label: 'Tháng 6' },
    { value: 7, label: 'Tháng 7' }, { value: 8, label: 'Tháng 8' }, { value: 9, label: 'Tháng 9' },
    { value: 10, label: 'Tháng 10' }, { value: 11, label: 'Tháng 11' }, { value: 12, label: 'Tháng 12' },
  ];

  constructor(
    private dashboardService: DashboardService,
    private financialControlService: FinancialControlService,
  ) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    this.financialAlerts.set(null);
    this.expenseBreakdown.set({});
    try {
      const result = await this.dashboardService.getDirectorComprehensive(this.fromDate || undefined, this.toDate || undefined);
      this.data.set(result);
      await this.loadFinancialPanels();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadFinancialPanels() {
    const [alertsResult, profitAndLossResult] = await Promise.allSettled([
      this.financialControlService.getAlerts(),
      this.financialControlService.getProfitAndLoss(this.fromDate || undefined, this.toDate || undefined),
    ]);

    if (alertsResult.status === 'fulfilled') {
      this.financialAlerts.set(alertsResult.value);
    }

    if (profitAndLossResult.status === 'fulfilled') {
      this.expenseBreakdown.set(profitAndLossResult.value.costs?.expenseByCategory || {});
    }
  }

  async loadBirthdays() {
    try {
      const birthdays = await this.dashboardService.getBirthdays(this.birthdayMonth);
      const current = this.data();
      if (current) {
        this.data.set({ ...current, birthdays });
      }
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải dữ liệu sinh nhật');
    }
  }

  objectEntries(obj: any): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }

  criticalAlerts(): any[] {
    const alerts = this.financialAlerts()?.alerts || [];
    return alerts
      .filter((item: any) => item?.severity === 'CRITICAL' || item?.severity === 'WARNING')
      .slice(0, 4);
  }

  expenseBreakdownEntries(): [string, { total: number; count: number }][] {
    return this.objectEntries(this.expenseBreakdown()).sort((left, right) => {
      const leftTotal = Number(left[1]?.total || 0);
      const rightTotal = Number(right[1]?.total || 0);
      return rightTotal - leftTotal;
    });
  }

  expensePercent(total: number): number {
    const overall = this.expenseBreakdownEntries().reduce((sum, item) => sum + Number(item[1]?.total || 0), 0);
    if (overall <= 0) return 0;
    return Math.max(6, Math.round((total / overall) * 100));
  }

  expenseCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      RENT: 'RENT',
      EQUIPMENT: 'EQUIPMENT',
      SALARY: 'SALARY',
      UTILITIES: 'UTILITIES',
      MARKETING: 'MARKETING',
      SOFTWARE: 'SOFTWARE',
      OTHER: 'OTHER',
    };
    return map[category] || category;
  }

  sessionLabel(s: string): string {
    const map: Record<string, string> = {
      SCHEDULED: 'Đã lên lịch', TEACHER_COMPLETED: 'GV hoàn thành',
      PARENT_CONFIRMED: 'PH xác nhận', FINALIZED: 'Hoàn tất',
      CANCELLED: 'Đã hủy', NO_SHOW: 'Vắng', RESCHEDULED: 'Dời lịch',
    };
    return map[s] || s;
  }

  txTypeLabel(type: string): string {
    const map: Record<string, string> = {
      TOP_UP: 'Nạp tiền', SESSION_DEDUCT: 'Trừ buổi học',
      REFUND: 'Hoàn tiền', ADJUSTMENT: 'Điều chỉnh', BONUS: 'Thưởng',
    };
    return map[type] || type;
  }

  priorityLabel(p: string): string {
    const map: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', URGENT: 'Khẩn cấp' };
    return map[p] || p;
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      DIRECTOR: 'Giám đốc', ACCOUNTING: 'Kế toán', OPS: 'Vận hành', ADSMANAGER: 'Ads manager',
      TEACHER: 'Giáo viên', SALE: 'Sale', HCNS: 'HC-NS',
      MANAGER: 'Quản lý', STAFF: 'Nhân viên', PARTIME: 'Part-time',
      PARENT: 'Phụ huynh',
    };
    return map[role] || role;
  }

  teachingModeLabel(m: string): string {
    const map: Record<string, string> = { ONLINE: 'Online', OFFLINE: 'Offline', BOTH: 'Cả hai' };
    return map[m] || m;
  }

  isMainRole(role: string): boolean {
    return ['DIRECTOR', 'ACCOUNTING', 'OPS', 'TEACHER', 'SALE', 'HCNS', 'PARENT'].includes(role);
  }
}
