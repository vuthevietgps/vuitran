import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { DashboardService } from '../services/dashboard.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-teacher-kpi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FlowGuideComponent],
  template: `
  <app-flow-guide featureKey="teacher-kpi"></app-flow-guide>
  <div class="kpi-page">
    <div class="header">
      <h2>KPI & Đánh giá hiệu suất giáo viên</h2>
      <div class="controls">
        <input type="date" [(ngModel)]="fromDate" (change)="load()" placeholder="Từ ngày">
        <input type="date" [(ngModel)]="toDate" (change)="load()" placeholder="Đến ngày">
        <select [(ngModel)]="statusFilter" (change)="applyFilter()">
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="SUSPENDED">Tạm ngưng</option>
        </select>
        <select [(ngModel)]="sortBy" (change)="applySort()">
          <option value="kpiScore">Sắp xếp: KPI</option>
          <option value="sessions">Sắp xếp: Số buổi</option>
          <option value="rating">Sắp xếp: Đánh giá PH</option>
          <option value="revenue">Sắp xếp: Doanh thu</option>
          <option value="name">Sắp xếp: Tên</option>
        </select>
      </div>
    </div>

    <div *ngIf="loading()" class="loading">Đang tải dữ liệu KPI...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <!-- Summary Cards -->
    <div *ngIf="data()" class="summary-strip">
      <div class="summary-card blue">
        <div class="s-value">{{ data()!.summary.totalTeachers }}</div>
        <div class="s-label">Tổng GV</div>
      </div>
      <div class="summary-card green">
        <div class="s-value">{{ data()!.summary.activeTeachers }}</div>
        <div class="s-label">GV hoạt động</div>
      </div>
      <div class="summary-card purple">
        <div class="s-value">{{ data()!.summary.avgKPI }}/100</div>
        <div class="s-label">KPI trung bình</div>
      </div>
      <div class="summary-card orange">
        <div class="s-value">{{ data()!.summary.avgRating }}/5</div>
        <div class="s-label">Đánh giá TB</div>
      </div>
    </div>

    <!-- KPI Distribution -->
    <div *ngIf="data()" class="distribution-bar">
      <div class="dist-item excellent" [style.flex]="data()!.summary.kpiDistribution.excellent">
        <span *ngIf="data()!.summary.kpiDistribution.excellent > 0">Xuất sắc: {{ data()!.summary.kpiDistribution.excellent }}</span>
      </div>
      <div class="dist-item good" [style.flex]="data()!.summary.kpiDistribution.good">
        <span *ngIf="data()!.summary.kpiDistribution.good > 0">Tốt: {{ data()!.summary.kpiDistribution.good }}</span>
      </div>
      <div class="dist-item average" [style.flex]="data()!.summary.kpiDistribution.average">
        <span *ngIf="data()!.summary.kpiDistribution.average > 0">TB: {{ data()!.summary.kpiDistribution.average }}</span>
      </div>
      <div class="dist-item below" [style.flex]="data()!.summary.kpiDistribution.belowAverage">
        <span *ngIf="data()!.summary.kpiDistribution.belowAverage > 0">Yếu: {{ data()!.summary.kpiDistribution.belowAverage }}</span>
      </div>
    </div>

    <!-- Detail/Card view toggle -->
    <div *ngIf="filteredTeachers.length > 0" class="view-toggle">
      <button [class.active]="viewMode === 'table'" (click)="viewMode = 'table'">Bảng</button>
      <button [class.active]="viewMode === 'cards'" (click)="viewMode = 'cards'">Thẻ</button>
      <span class="result-count">{{ filteredTeachers.length }} giáo viên</span>
    </div>

    <!-- TABLE VIEW -->
    <div *ngIf="filteredTeachers.length > 0 && viewMode === 'table'" class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Giáo viên</th>
            <th>Trạng thái</th>
            <th>KPI</th>
            <th>Buổi dạy</th>
            <th>Hoàn thành</th>
            <th>Báo cáo</th>
            <th>Đánh giá PH</th>
            <th>HS đánh giá</th>
            <th>Lớp đang dạy</th>
            <th>Doanh thu</th>
            <th>Phạt</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of filteredTeachers; let i = index" [class.highlight-row]="t.kpiScore >= 80">
            <td>{{ i + 1 }}</td>
            <td>
              <div class="teacher-cell">
                <strong>{{ t.fullName }}</strong>
                <small>{{ t.subjects?.join(', ') }}</small>
              </div>
            </td>
            <td><span class="badge" [attr.data-status]="t.teacherStatus">{{ statusLabel(t.teacherStatus) }}</span></td>
            <td>
              <div class="kpi-bar-cell">
                <div class="kpi-bar" [style.width.%]="t.kpiScore" [class]="kpiClass(t.kpiScore)"></div>
                <span class="kpi-text">{{ t.kpiScore }}</span>
              </div>
            </td>
            <td>{{ t.sessions.total }}</td>
            <td>{{ t.sessions.completionRate }}%</td>
            <td>
              <span [class.text-success]="t.reports.submissionRate >= 90" [class.text-warning]="t.reports.submissionRate >= 50 && t.reports.submissionRate < 90" [class.text-danger]="t.reports.submissionRate < 50">
                {{ t.reports.submissionRate }}%
              </span>
              <small *ngIf="t.reports.late > 0" class="text-danger"> ({{ t.reports.late }} trễ)</small>
            </td>
            <td>
              <span class="stars">{{ starDisplay(t.parentFeedback.avgOverallRating) }}</span>
              <small>({{ t.parentFeedback.feedbackCount }})</small>
            </td>
            <td>
              <span *ngIf="t.evaluation.evalCount > 0">{{ t.evaluation.avgStudentPerformance }}/5</span>
              <span *ngIf="t.evaluation.evalCount === 0" class="text-muted">—</span>
            </td>
            <td>{{ t.classes.activeClasses }}</td>
            <td>{{ t.sessions.totalRevenue | number:'1.0-0' }}đ</td>
            <td>
              <div class="penalty-cell" [class.has-penalty]="t.payroll.totalPenalty > 0">
                <strong class="penalty-amount">{{ penaltyDisplay(t.payroll.totalPenalty) }}</strong>
                <small *ngIf="t.payroll.penaltySessionCount > 0">{{ t.payroll.penaltySessionCount }} buổi</small>
              </div>
            </td>
            <td>
              <button class="btn-sm" (click)="viewDetail(t)" title="Xem chi tiết">📊</button>
              <button class="btn-sm" (click)="viewProfile(t)" title="Xem hồ sơ">👤</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CARD VIEW -->
    <div *ngIf="filteredTeachers.length > 0 && viewMode === 'cards'" class="cards-grid">
      <div *ngFor="let t of filteredTeachers" class="kpi-card" [class]="'border-' + kpiClass(t.kpiScore)">
        <div class="kpi-card-header">
          <div>
            <h4>{{ t.fullName }}</h4>
            <span class="badge" [attr.data-status]="t.teacherStatus">{{ statusLabel(t.teacherStatus) }}</span>
          </div>
          <div class="kpi-score-circle" [class]="kpiClass(t.kpiScore)">
            {{ t.kpiScore }}
          </div>
        </div>
        <div class="kpi-card-tags" *ngIf="t.subjects?.length">
          <span class="tag" *ngFor="let s of t.subjects">{{ s }}</span>
        </div>
        <div class="kpi-card-stats">
          <div class="kpi-stat">
            <span class="kpi-stat-val">{{ t.sessions.total }}</span>
            <span class="kpi-stat-lbl">Buổi dạy</span>
          </div>
          <div class="kpi-stat">
            <span class="kpi-stat-val">{{ t.sessions.completionRate }}%</span>
            <span class="kpi-stat-lbl">Hoàn thành</span>
          </div>
          <div class="kpi-stat">
            <span class="kpi-stat-val">{{ starDisplay(t.parentFeedback.avgOverallRating) }}</span>
            <span class="kpi-stat-lbl">PH đánh giá</span>
          </div>
          <div class="kpi-stat">
            <span class="kpi-stat-val">{{ t.classes.activeClasses }}</span>
            <span class="kpi-stat-lbl">Lớp</span>
          </div>
        </div>
        <div class="kpi-card-metrics">
          <div class="metric-row">
            <span>Nộp báo cáo</span>
            <div class="metric-bar-wrap">
              <div class="metric-bar" [style.width.%]="t.reports.submissionRate" [class]="t.reports.submissionRate >= 80 ? 'bg-green' : t.reports.submissionRate >= 50 ? 'bg-yellow' : 'bg-red'"></div>
            </div>
            <span>{{ t.reports.submissionRate }}%</span>
          </div>
          <div class="metric-row">
            <span>Đúng hạn</span>
            <div class="metric-bar-wrap">
              <div class="metric-bar" [style.width.%]="t.reports.onTimeRate" [class]="t.reports.onTimeRate >= 80 ? 'bg-green' : t.reports.onTimeRate >= 50 ? 'bg-yellow' : 'bg-red'"></div>
            </div>
            <span>{{ t.reports.onTimeRate }}%</span>
          </div>
          <div class="metric-row" *ngIf="t.parentFeedback.feedbackCount > 0">
            <span>Hài lòng</span>
            <div class="metric-bar-wrap">
              <div class="metric-bar" [style.width.%]="t.parentFeedback.satisfactionRate" [class]="t.parentFeedback.satisfactionRate >= 80 ? 'bg-green' : 'bg-yellow'"></div>
            </div>
            <span>{{ t.parentFeedback.satisfactionRate }}%</span>
          </div>
        </div>
        <div class="kpi-card-footer">
          <span>Doanh thu: {{ t.sessions.totalRevenue | number:'1.0-0' }}đ</span>
          <span>Lương: {{ t.payroll.totalPaid | number:'1.0-0' }}đ</span>
          <span class="teacher-penalty-inline" [class.has-penalty]="t.payroll.totalPenalty > 0">
            Phạt: {{ penaltyDisplay(t.payroll.totalPenalty) }}
          </span>
        </div>
        <div class="kpi-card-actions">
          <button class="btn-sm" (click)="viewDetail(t)">📊 Chi tiết</button>
          <button class="btn-sm" (click)="viewProfile(t)">👤 Hồ sơ</button>
        </div>
      </div>
    </div>

    <!-- DETAIL MODAL -->
    <div *ngIf="selectedTeacher" class="modal-overlay" (click)="selectedTeacher = null">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <button class="modal-close" (click)="selectedTeacher = null">✕</button>
        <h3>Chi tiết KPI: {{ selectedTeacher.fullName }}</h3>

        <div class="detail-grid">
          <!-- KPI Score -->
          <div class="detail-card">
            <h4>Điểm KPI tổng hợp</h4>
            <div class="kpi-big-score" [class]="kpiClass(selectedTeacher.kpiScore)">
              {{ selectedTeacher.kpiScore }}<small>/100</small>
            </div>
            <div class="kpi-level">{{ kpiLevel(selectedTeacher.kpiScore) }}</div>
          </div>

          <!-- Session Stats -->
          <div class="detail-card">
            <h4>Buổi dạy</h4>
            <div class="detail-row"><span>Tổng:</span><strong>{{ selectedTeacher.sessions.total }}</strong></div>
            <div class="detail-row"><span>Hoàn thành:</span><strong class="text-success">{{ selectedTeacher.sessions.completed }}</strong></div>
            <div class="detail-row"><span>Đã hủy:</span><strong class="text-danger">{{ selectedTeacher.sessions.cancelled }}</strong></div>
            <div class="detail-row"><span>Vắng:</span><strong class="text-danger">{{ selectedTeacher.sessions.noShow }}</strong></div>
            <div class="detail-row"><span>Tỷ lệ HT:</span><strong>{{ selectedTeacher.sessions.completionRate }}%</strong></div>
          </div>

          <!-- Reports -->
          <div class="detail-card">
            <h4>Báo cáo giảng dạy</h4>
            <div class="detail-row"><span>Đã nộp:</span><strong>{{ selectedTeacher.reports.submitted }}</strong></div>
            <div class="detail-row"><span>Nộp trễ:</span><strong class="text-danger">{{ selectedTeacher.reports.late }}</strong></div>
            <div class="detail-row"><span>Tỷ lệ nộp:</span><strong>{{ selectedTeacher.reports.submissionRate }}%</strong></div>
            <div class="detail-row"><span>Đúng hạn:</span><strong>{{ selectedTeacher.reports.onTimeRate }}%</strong></div>
          </div>

          <!-- Parent Feedback -->
          <div class="detail-card">
            <h4>Phản hồi phụ huynh</h4>
            <div class="detail-row"><span>Tổng quan:</span><strong>{{ starDisplay(selectedTeacher.parentFeedback.avgOverallRating) }} ({{ selectedTeacher.parentFeedback.avgOverallRating }}/5)</strong></div>
            <div class="detail-row"><span>Chất lượng GD:</span><strong>{{ selectedTeacher.parentFeedback.avgTeachingQuality }}/5</strong></div>
            <div class="detail-row"><span>Giao tiếp:</span><strong>{{ selectedTeacher.parentFeedback.avgCommunication }}/5</strong></div>
            <div class="detail-row"><span>Hài lòng:</span><strong>{{ selectedTeacher.parentFeedback.satisfactionRate }}%</strong></div>
            <div class="detail-row"><span>Số lượt:</span><strong>{{ selectedTeacher.parentFeedback.feedbackCount }}</strong></div>
          </div>

          <!-- Evaluation -->
          <div class="detail-card">
            <h4>Đánh giá học sinh (GV ghi nhận)</h4>
            <div class="detail-row"><span>Năng lực HS:</span><strong>{{ selectedTeacher.evaluation.avgStudentPerformance }}/5</strong></div>
            <div class="detail-row"><span>Tập trung:</span><strong>{{ selectedTeacher.evaluation.avgStudentEngagement }}/5</strong></div>
            <div class="detail-row"><span>Hiểu bài:</span><strong>{{ selectedTeacher.evaluation.avgComprehension }}/5</strong></div>
            <div class="detail-row"><span>Số lượt:</span><strong>{{ selectedTeacher.evaluation.evalCount }}</strong></div>
          </div>

          <!-- Financial -->
          <div class="detail-card">
            <h4>Tài chính</h4>
            <div class="detail-row"><span>Doanh thu:</span><strong>{{ selectedTeacher.sessions.totalRevenue | number:'1.0-0' }}đ</strong></div>
            <div class="detail-row"><span>Chi phí GV:</span><strong>{{ selectedTeacher.sessions.totalPayout | number:'1.0-0' }}đ</strong></div>
            <div class="detail-row"><span>Đã trả lương:</span><strong>{{ selectedTeacher.payroll.totalPaid | number:'1.0-0' }}đ</strong></div>
            <div class="detail-row penalty-detail-row" [class.has-penalty]="selectedTeacher.payroll.totalPenalty > 0">
              <span>Tổng phạt:</span>
              <strong>{{ penaltyDisplay(selectedTeacher.payroll.totalPenalty) }}</strong>
            </div>
            <div class="detail-row" *ngIf="selectedTeacher.payroll.penaltySessionCount > 0">
              <span>Buổi bị phạt:</span>
              <strong>{{ selectedTeacher.payroll.penaltySessionCount }}</strong>
            </div>
            <div class="detail-row"><span>Lớp đang dạy:</span><strong>{{ selectedTeacher.classes.activeClasses }}</strong></div>
            <div class="detail-row"><span>Tổng HS:</span><strong>{{ selectedTeacher.classes.totalStudents }}</strong></div>
          </div>

          <!-- KPI Breakdown -->
          <div class="detail-card wide">
            <h4>Công thức KPI</h4>
            <div class="kpi-formula">
              <div class="formula-item">
                <span class="fw">25%</span>
                <span>Tỷ lệ hoàn thành buổi</span>
                <strong>{{ selectedTeacher.sessions.completionRate }}%</strong>
              </div>
              <div class="formula-item">
                <span class="fw">15%</span>
                <span>Tỷ lệ nộp báo cáo</span>
                <strong>{{ selectedTeacher.reports.submissionRate }}%</strong>
              </div>
              <div class="formula-item">
                <span class="fw">10%</span>
                <span>Nộp báo cáo đúng hạn</span>
                <strong>{{ selectedTeacher.reports.onTimeRate }}%</strong>
              </div>
              <div class="formula-item">
                <span class="fw">25%</span>
                <span>Đánh giá PH (x20)</span>
                <strong>{{ selectedTeacher.parentFeedback.avgOverallRating }}/5</strong>
              </div>
              <div class="formula-item">
                <span class="fw">15%</span>
                <span>Năng lực HS (x20)</span>
                <strong>{{ selectedTeacher.evaluation.avgStudentPerformance }}/5</strong>
              </div>
              <div class="formula-item">
                <span class="fw">10%</span>
                <span>Tỷ lệ PH hài lòng</span>
                <strong>{{ selectedTeacher.parentFeedback.satisfactionRate }}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div *ngIf="filteredTeachers.length === 0 && !loading()" class="empty">
      Không có dữ liệu giáo viên
    </div>
  </div>
  `,
  styles: [`
    .kpi-page { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .header h2 { margin: 0; color: #1e293b; font-size: 20px; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    .controls input, .controls select { padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
    .loading { text-align: center; padding: 40px; color: #64748b; }
    .error { background: #fef2f2; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }

    /* Summary */
    .summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: #fff; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-top: 4px solid; }
    .summary-card.blue { border-color: #3b82f6; }
    .summary-card.green { border-color: #22c55e; }
    .summary-card.purple { border-color: #8b5cf6; }
    .summary-card.orange { border-color: #f97316; }
    .s-value { font-size: 28px; font-weight: 700; color: #1e293b; }
    .s-label { font-size: 13px; color: #94a3b8; margin-top: 4px; }

    /* Distribution */
    .distribution-bar { display: flex; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 20px; background: #e2e8f0; }
    .dist-item { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; font-weight: 600; min-width: 0; transition: flex 0.3s; }
    .dist-item.excellent { background: #22c55e; }
    .dist-item.good { background: #3b82f6; }
    .dist-item.average { background: #f59e0b; }
    .dist-item.below { background: #ef4444; }

    /* View toggle */
    .view-toggle { display: flex; gap: 4px; margin-bottom: 16px; align-items: center; }
    .view-toggle button { padding: 6px 16px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px; border-radius: 6px; }
    .view-toggle button.active { background: #2563eb; color: #fff; border-color: #2563eb; }
    .result-count { margin-left: auto; color: #64748b; font-size: 13px; }

    /* Table */
    .table-wrapper { overflow-x: auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; padding: 12px 10px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; }
    .data-table td { padding: 10px; border-bottom: 1px solid #f1f5f9; }
    .data-table tr:hover { background: #f8fafc; }
    .highlight-row { background: #f0fdf4 !important; }
    .penalty-cell { display: flex; flex-direction: column; gap: 2px; min-width: 82px; }
    .penalty-amount { color: #475569; font-weight: 700; }
    .penalty-cell.has-penalty .penalty-amount { color: #b91c1c; }
    .penalty-cell small { color: #94a3b8; font-size: 11px; }
    .teacher-cell { display: flex; flex-direction: column; }
    .teacher-cell small { color: #94a3b8; font-size: 11px; }

    /* KPI bar */
    .kpi-bar-cell { display: flex; align-items: center; gap: 8px; min-width: 120px; }
    .kpi-bar { height: 8px; border-radius: 4px; transition: width 0.3s; }
    .kpi-bar.excellent { background: #22c55e; }
    .kpi-bar.good { background: #3b82f6; }
    .kpi-bar.average { background: #f59e0b; }
    .kpi-bar.below { background: #ef4444; }
    .kpi-text { font-weight: 700; font-size: 14px; min-width: 28px; }

    /* Badges */
    .badge { padding: 2px 8px; border-radius: 99px; font-size: 11px; background: #e2e8f0; color: #475569; font-weight: 600; white-space: nowrap; }
    .badge[data-status="ACTIVE"] { background: #dcfce7; color: #16a34a; }
    .badge[data-status="PENDING"] { background: #fef9c3; color: #ca8a04; }
    .badge[data-status="APPROVED"] { background: #dbeafe; color: #2563eb; }
    .badge[data-status="SUSPENDED"] { background: #fef2f2; color: #dc2626; }
    .badge[data-status="INACTIVE"] { background: #f1f5f9; color: #64748b; }

    /* Text colors */
    .text-success { color: #16a34a; }
    .text-warning { color: #ca8a04; }
    .text-danger { color: #dc2626; }
    .text-muted { color: #94a3b8; }

    .stars { letter-spacing: 1px; }

    .btn-sm { padding: 4px 8px; border: 1px solid #e2e8f0; background: #fff; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .btn-sm:hover { background: #f1f5f9; }

    /* Card View */
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .kpi-card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); border-left: 4px solid #e2e8f0; }
    .kpi-card.border-excellent { border-color: #22c55e; }
    .kpi-card.border-good { border-color: #3b82f6; }
    .kpi-card.border-average { border-color: #f59e0b; }
    .kpi-card.border-below { border-color: #ef4444; }
    .kpi-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .kpi-card-header h4 { margin: 0 0 6px; color: #1e293b; font-size: 15px; }
    .kpi-score-circle { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #fff; flex-shrink: 0; }
    .kpi-score-circle.excellent { background: #22c55e; }
    .kpi-score-circle.good { background: #3b82f6; }
    .kpi-score-circle.average { background: #f59e0b; }
    .kpi-score-circle.below { background: #ef4444; }
    .kpi-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
    .tag { padding: 2px 8px; border-radius: 99px; font-size: 11px; background: #dbeafe; color: #2563eb; }
    .kpi-card-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
    .kpi-stat { text-align: center; }
    .kpi-stat-val { display: block; font-weight: 700; font-size: 16px; color: #1e293b; }
    .kpi-stat-lbl { font-size: 11px; color: #94a3b8; }
    .kpi-card-metrics { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
    .metric-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; }
    .metric-row span:first-child { min-width: 80px; }
    .metric-row span:last-child { min-width: 40px; text-align: right; font-weight: 600; }
    .metric-bar-wrap { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
    .metric-bar { height: 100%; border-radius: 3px; transition: width 0.3s; }
    .bg-green { background: #22c55e; }
    .bg-yellow { background: #f59e0b; }
    .bg-red { background: #ef4444; }
    .kpi-card-footer { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; padding-top: 10px; border-top: 1px solid #f1f5f9; margin-bottom: 10px; gap: 10px; flex-wrap: wrap; }
    .teacher-penalty-inline { color: #64748b; font-weight: 600; }
    .teacher-penalty-inline.has-penalty { color: #b91c1c; }
    .kpi-card-actions { display: flex; gap: 8px; }

    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .modal-content { background: #fff; border-radius: 16px; padding: 32px; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative; }
    .modal-close { position: absolute; top: 16px; right: 16px; border: none; background: #f1f5f9; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 16px; }
    .modal-content h3 { margin: 0 0 20px; color: #1e293b; font-size: 18px; }
    .detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .detail-card { background: #f8fafc; border-radius: 10px; padding: 18px; }
    .detail-card.wide { grid-column: span 2; }
    .detail-card h4 { margin: 0 0 12px; color: #475569; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; }
    .detail-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .detail-row span { color: #64748b; }
    .penalty-detail-row strong { color: #475569; }
    .penalty-detail-row.has-penalty strong { color: #b91c1c; }
    .kpi-big-score { font-size: 56px; font-weight: 800; text-align: center; }
    .kpi-big-score small { font-size: 20px; font-weight: 400; color: #94a3b8; }
    .kpi-big-score.excellent { color: #22c55e; }
    .kpi-big-score.good { color: #3b82f6; }
    .kpi-big-score.average { color: #f59e0b; }
    .kpi-big-score.below { color: #ef4444; }
    .kpi-level { text-align: center; font-size: 14px; font-weight: 600; margin-top: 4px; }
    .kpi-formula { display: flex; flex-direction: column; gap: 8px; }
    .formula-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #fff; border-radius: 8px; font-size: 13px; }
    .formula-item .fw { background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: 700; color: #475569; min-width: 40px; text-align: center; }
    .formula-item span:nth-child(2) { flex: 1; color: #64748b; }

    .empty { text-align: center; padding: 60px; color: #94a3b8; font-size: 16px; }

    @media (max-width: 900px) {
      .summary-strip { grid-template-columns: repeat(2, 1fr); }
      .cards-grid { grid-template-columns: 1fr; }
      .detail-grid { grid-template-columns: 1fr; }
      .detail-card.wide { grid-column: span 1; }
    }
    @media (max-width: 600px) {
      .summary-strip { grid-template-columns: 1fr; }
      .kpi-page { padding: 16px; }
    }
  `]
})
export class TeacherKpiComponent implements OnInit {
  data = signal<any>(null);
  loading = signal(false);
  error = signal('');
  fromDate = '';
  toDate = '';
  statusFilter = 'ALL';
  sortBy = 'kpiScore';
  viewMode = 'table';
  filteredTeachers: any[] = [];
  selectedTeacher: any = null;

  constructor(
    private dashboardService: DashboardService,
    private router: Router,
  ) {}

  ngOnInit() { this.load(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.dashboardService.getTeacherKPI(
        this.fromDate || undefined,
        this.toDate || undefined,
      );
      this.data.set(result);
      this.filteredTeachers = [...result.teachers];
      this.applyFilter();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Lỗi tải dữ liệu KPI');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilter() {
    if (!this.data()) return;
    let teachers = [...this.data().teachers];
    if (this.statusFilter !== 'ALL') {
      teachers = teachers.filter(t => t.teacherStatus === this.statusFilter);
    }
    this.filteredTeachers = teachers;
    this.applySort();
  }

  applySort() {
    this.filteredTeachers.sort((a, b) => {
      switch (this.sortBy) {
        case 'kpiScore': return b.kpiScore - a.kpiScore;
        case 'sessions': return b.sessions.total - a.sessions.total;
        case 'rating': return (b.parentFeedback.avgOverallRating || 0) - (a.parentFeedback.avgOverallRating || 0);
        case 'revenue': return b.sessions.totalRevenue - a.sessions.totalRevenue;
        case 'name': return a.fullName.localeCompare(b.fullName);
        default: return 0;
      }
    });
  }

  viewDetail(t: any) {
    this.selectedTeacher = t;
  }

  viewProfile(t: any) {
    this.router.navigate(['/app/teacher-profiles', t.profileId]);
  }

  kpiClass(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'average';
    return 'below';
  }

  kpiLevel(score: number): string {
    if (score >= 80) return 'Xuất sắc';
    if (score >= 60) return 'Tốt';
    if (score >= 40) return 'Trung bình';
    return 'Cần cải thiện';
  }

  statusLabel(s: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', ACTIVE: 'Đang hoạt động',
      SUSPENDED: 'Tạm ngưng', INACTIVE: 'Không hoạt động',
    };
    return labels[s] || s;
  }

  starDisplay(rating: number): string {
    if (!rating) return '—';
    const full = Math.floor(rating);
    const half = rating - full >= 0.5 ? 1 : 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
  }

  penaltyDisplay(amount: number): string {
    const safeAmount = Number(amount || 0);
    const formatted = new Intl.NumberFormat('en-US').format(Math.abs(safeAmount));
    return `${safeAmount > 0 ? '-' : ''}${formatted}đ`;
  }
}
