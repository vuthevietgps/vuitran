import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdAnalyticsRow,
  AdGroupItem,
  AdsService,
  AdSuggestionResponse,
  ParentProfitabilityGroupSummary,
  ParentProfitabilityResponse,
  RealizedCohortResponse,
  RealizedCohortRow,
} from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  GOOGLE: 'Google',
  TIKTOK: 'TikTok',
};

type AnalyticsTab = 'overview' | 'parents' | 'optimize-x';

@Component({
  selector: 'app-ads-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Phân tích Ads Theo Lợi Nhuận Thực Và Dự Kiến</h2>
      <p>
        Lợi nhuận thực chỉ được ghi nhận khi buổi học đã hoàn thành và ví phụ huynh đã bị trừ.
        Cohort bên dưới bổ sung thêm phần dự kiến theo học phí đã thu, lương giáo viên, chi phí phát sinh theo buổi
        và X% refund giả định cho phần doanh thu còn lại để đánh giá ads sớm hơn.
      </p>
    </div>
  </header>

  <app-flow-guide featureKey="ads-analytics"></app-flow-guide>

  <section class="filters">
    <label>Từ ngày <input type="date" [(ngModel)]="startDate" /></label>
    <label>Đến ngày <input type="date" [(ngModel)]="endDate" /></label>
    <label>Số ngày chín cohort
      <input type="number" [(ngModel)]="maturityDays" min="1" max="180" step="1" />
    </label>
    <label>X refund còn lại (%)
      <input type="number" [(ngModel)]="refundRatePercentXInput" min="0" max="100" step="0.1" placeholder="Lịch sử" />
    </label>
    <select [(ngModel)]="filterPlatform">
      <option value="">Tất cả nền tảng</option>
      <option value="FACEBOOK">Facebook</option>
      <option value="GOOGLE">Google</option>
      <option value="TIKTOK">TikTok</option>
    </select>
    <select [(ngModel)]="filterAdGroup">
      <option value="">Tất cả nhóm QC</option>
      <option *ngFor="let g of adGroups()" [value]="g._id">{{g.name}}</option>
    </select>
    <button class="primary" (click)="loadAnalytics()">Phân tích</button>
  </section>

  <nav class="tab-bar">
    <button type="button" class="tab-button" [class.active]="activeTab === 'overview'" (click)="setActiveTab('overview')">
      Tổng quan cohort
    </button>
    <button type="button" class="tab-button" [class.active]="activeTab === 'parents'" (click)="setActiveTab('parents')">
      Profit theo PH
    </button>
    <button type="button" class="tab-button" [class.active]="activeTab === 'optimize-x'" (click)="setActiveTab('optimize-x')">
      Chi phí quảng cáo tối ưu theo X
    </button>
  </nav>

  <ng-container *ngIf="activeTab === 'overview'">
    <section class="stats" *ngIf="realizedData() as realized">
      <div class="stat-card blue">
        <div class="stat-value">{{realized.summary.totalSpend | number}}đ</div>
        <div class="stat-label">Tổng chi phí Ads</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-value">{{realized.summary.totalLeads | number}}</div>
        <div class="stat-label">Tổng Leads</div>
      </div>
      <div class="stat-card indigo">
        <div class="stat-value">{{realized.summary.totalNewParents | number}}</div>
        <div class="stat-label">Phụ huynh mới</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">{{realized.summary.totalOrders | number}}</div>
        <div class="stat-label">Đơn hàng</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-value">{{realized.summary.totalCollectedRevenue | number}}đ</div>
        <div class="stat-label">Học phí đã thu</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">{{realized.summary.totalRemainingSessionUnits | number:'1.0-2'}}</div>
        <div class="stat-label">Buổi còn lại</div>
      </div>
      <div class="stat-card green">
        <div class="stat-value">{{realized.summary.totalNetRealizedRevenue | number}}đ</div>
        <div class="stat-label">Doanh thu thực</div>
      </div>
      <div class="stat-card indigo">
        <div class="stat-value">{{realized.summary.totalProjectedRevenue | number}}đ</div>
        <div class="stat-label">Doanh thu dự kiến</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-value">{{realized.summary.totalRefundAmount | number}}đ</div>
        <div class="stat-label">Hoàn tiền</div>
      </div>
      <div class="stat-card" [class.green]="realized.summary.totalNetProfit >= 0" [class.red]="realized.summary.totalNetProfit < 0">
        <div class="stat-value">{{realized.summary.totalNetProfit | number}}đ</div>
        <div class="stat-label">Lợi nhuận thuần thực</div>
      </div>
      <div class="stat-card" [class.green]="realized.summary.totalProjectedNetProfit >= 0" [class.red]="realized.summary.totalProjectedNetProfit < 0">
        <div class="stat-value">{{realized.summary.totalProjectedNetProfit | number}}đ</div>
        <div class="stat-label">Lợi nhuận thuần dự kiến</div>
      </div>
      <div class="stat-card" [class.green]="realized.summary.totalRoi >= 0" [class.red]="realized.summary.totalRoi < 0">
        <div class="stat-value">{{realized.summary.totalRoi}}%</div>
        <div class="stat-label">ROI thực</div>
      </div>
    </section>

    <section class="section" *ngIf="realizedData() as realized">
      <div class="section-head">
        <div>
          <h3>Cohort lợi nhuận thực và dự kiến theo ngày acquire</h3>
          <p class="desc">
            Dùng basis <strong>{{realized.basis}}</strong>, cohort chín sau <strong>{{realized.maturityDays}}</strong> ngày,
            dữ liệu thực hiện tới <strong>{{realized.realizedThrough}}</strong>,
            refund phần còn lại <strong>{{refundAssumptionLabel(realized.refundRatePercentX)}}</strong>
            và chi phí phần còn lại ưu tiên bám theo số buổi chưa chạy cùng lương thực của các buổi đã xếp lịch.
          </p>
        </div>
        <div class="cohort-meta">
          <span class="meta-pill good">Đã chín: {{realized.summary.matureRowCount}}</span>
          <span class="meta-pill warn">Chưa chín: {{realized.summary.immatureRowCount}}</span>
        </div>
      </div>

      <div class="table-wrap" *ngIf="realized.rows.length; else noRealizedRows">
        <table class="data compact wide-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Nhóm QC</th>
              <th>Cohort</th>
              <th>Impr</th>
              <th>Clicks</th>
              <th>Conv</th>
              <th>Leads</th>
              <th>PH mới</th>
              <th>Ads cost</th>
              <th>Đã thu</th>
              <th>Buổi còn lại</th>
              <th>DT thực</th>
              <th>DT dự kiến</th>
              <th>Refund</th>
              <th>GV cost</th>
              <th>Chi phí khác</th>
              <th>LN thực</th>
              <th>LN dự kiến</th>
              <th>ROI</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of realized.rows">
              <td>{{row.date}}</td>
              <td>
                <strong>{{row.adGroupName || row.adGroupId}}</strong>
                <div class="muted">{{platformLabel(row.platform)}}</div>
              </td>
              <td>
                <span class="status-badge" [attr.data-mature]="row.isMatured">
                  {{cohortLabel(row)}}
                </span>
              </td>
              <td>{{row.impressions | number}}</td>
              <td>{{row.clicks | number}}</td>
              <td>{{row.conversions | number}}</td>
              <td>{{row.leadCount | number}}</td>
              <td>{{row.newParentCount | number}}</td>
              <td class="amount">{{row.adSpend | number}}đ</td>
              <td class="amount">{{row.collectedRevenue | number}}đ</td>
              <td>{{row.remainingSessionUnits | number:'1.0-2'}}</td>
              <td class="amount">{{row.netRealizedRevenue | number}}đ</td>
              <td class="amount">{{row.projectedRevenue | number}}đ</td>
              <td class="amount-red">{{row.refundAmount | number}}đ</td>
              <td class="amount">{{row.teacherCost | number}}đ</td>
              <td class="amount">{{otherCost(row) | number}}đ</td>
              <td [class.amount-green]="row.netProfit >= 0" [class.amount-red]="row.netProfit < 0">
                {{row.netProfit | number}}đ
              </td>
              <td [class.amount-green]="row.projectedNetProfit >= 0" [class.amount-red]="row.projectedNetProfit < 0">
                {{row.projectedNetProfit | number}}đ
              </td>
              <td>
                <span class="roi-badge" [class.roi-high]="row.roi >= 100" [class.roi-mid]="row.roi >= 0 && row.roi < 100" [class.roi-low]="row.roi < 0">
                  {{row.roi}}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ng-template #noRealizedRows>
      <p class="empty">Không có cohort ads trong khoảng ngày và bộ lọc hiện tại.</p>
    </ng-template>

    <section class="section" *ngIf="rows().length">
      <h3>Tổng hợp nhóm QC theo funnel</h3>
      <p class="desc">Bảng này giữ lại view tổng hợp theo group để đối chiếu nhanh lead, đơn và doanh thu ghi nhận.</p>
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th (click)="sortBy('adGroupName')" class="sortable">Nhóm QC</th>
              <th>Nền tảng</th>
              <th (click)="sortBy('totalSpend')" class="sortable">Chi phí</th>
              <th (click)="sortBy('leadCount')" class="sortable">Leads</th>
              <th (click)="sortBy('orderCount')" class="sortable">Đơn hàng</th>
              <th (click)="sortBy('revenue')" class="sortable">Doanh thu</th>
              <th (click)="sortBy('costPerLead')" class="sortable">CP/Lead</th>
              <th (click)="sortBy('costPerOrder')" class="sortable">CP/Đơn</th>
              <th (click)="sortBy('netProfit')" class="sortable">Lợi nhuận</th>
              <th (click)="sortBy('roi')" class="sortable">ROI %</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of sortedRows()">
              <td><strong>{{r.adGroupName || r.adGroupId}}</strong></td>
              <td><span class="badge platform" [attr.data-platform]="r.platform">{{platformLabel(r.platform)}}</span></td>
              <td class="amount">{{r.totalSpend | number}}đ</td>
              <td>{{r.leadCount}}</td>
              <td>{{r.orderCount}}</td>
              <td class="amount">{{r.revenue | number}}đ</td>
              <td>{{r.costPerLead !== null ? (r.costPerLead | number) + 'đ' : '-'}}</td>
              <td>{{r.costPerOrder !== null ? (r.costPerOrder | number) + 'đ' : '-'}}</td>
              <td [class.amount-green]="r.netProfit >= 0" [class.amount-red]="r.netProfit < 0">{{r.netProfit | number}}đ</td>
              <td>
                <span class="roi-badge" [class.roi-high]="r.roi >= 100" [class.roi-mid]="r.roi >= 0 && r.roi < 100" [class.roi-low]="r.roi < 0">
                  {{r.roi}}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="empty" *ngIf="loaded() && !rows().length && !realizedData()">Không có dữ liệu trong khoảng thời gian này.</p>
  </ng-container>

  <ng-container *ngIf="activeTab === 'parents'">
    <section class="stats" *ngIf="parentProfitData() as parentProfit">
      <div class="stat-card indigo">
        <div class="stat-value">{{parentProfit.overall.parentCount | number}}</div>
        <div class="stat-label">Phu huynh attributed</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-value">{{parentProfit.overall.totalStudents | number}}</div>
        <div class="stat-label">Hoc sinh linked</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-value">{{parentProfit.overall.totalSessions | number}}</div>
        <div class="stat-label">Buoi hoc da ghi nhan</div>
      </div>
      <div class="stat-card teal">
        <div class="stat-value">{{parentProfit.overall.totalRevenue | number}} VND</div>
        <div class="stat-label">Doanh thu thuc</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-value">{{parentProfit.overall.totalAdSpend | number}} VND</div>
        <div class="stat-label">Ads spend phan bo</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-value">{{parentSummaryOtherCost(parentProfit.overall) | number}} VND</div>
        <div class="stat-label">Chi phi khac phan bo</div>
      </div>
      <div class="stat-card" [class.green]="parentProfit.overall.totalNetProfit >= 0" [class.red]="parentProfit.overall.totalNetProfit < 0">
        <div class="stat-value">{{parentProfit.overall.totalNetProfit | number}} VND</div>
        <div class="stat-label">Loi nhuan thuan</div>
      </div>
      <div class="stat-card" [class.green]="parentProfit.overall.netMargin >= 0" [class.red]="parentProfit.overall.netMargin < 0">
        <div class="stat-value">{{parentProfit.overall.netMargin}}%</div>
        <div class="stat-label">Net margin</div>
      </div>
    </section>

    <section class="section" *ngIf="parentProfitData() as parentProfit">
      <div class="section-head">
        <div>
          <h3>Trace loi nhuan tu phu huynh ve nhom quang cao</h3>
          <p class="desc">
            Bang nay khoa attribution theo parent key va phan bo chi phi ads, chi phi nhom va overhead tren doanh thu thuc
            cua tung phu huynh trong khoang thoi gian dang loc.
          </p>
        </div>
      </div>

      <div class="table-wrap" *ngIf="parentProfit.rows.length; else noParentProfitRows">
        <table class="data compact wide-table parent-profit-table">
          <thead>
            <tr>
              <th>Phu huynh</th>
              <th>Nhom QC</th>
              <th>Attributed at</th>
              <th>Buoi hoc</th>
              <th>Hoc sinh</th>
              <th>Doanh thu</th>
              <th>GV cost</th>
              <th>Chi phi PH</th>
              <th>Chi phi nhom</th>
              <th>Global OH</th>
              <th>Ads spend</th>
              <th>Loi nhuan</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of parentProfit.rows">
              <td class="identity-cell">
                <strong>{{row.parentName || row.parentPhone || row.parentKey}}</strong>
                <div class="muted" *ngIf="row.parentPhone">{{row.parentPhone}}</div>
                <div class="muted">{{row.parentKey}}</div>
              </td>
              <td>
                <strong>{{row.adGroupName || row.adGroupId || 'UNATTRIBUTED'}}</strong>
                <div class="muted">{{platformLabel(row.platform)}}</div>
              </td>
              <td>{{row.attributedAt ? (row.attributedAt | date:'dd/MM/yyyy HH:mm') : '-'}}</td>
              <td>{{row.sessionCount | number}}</td>
              <td>{{row.studentCount | number}}</td>
              <td class="amount">{{row.revenue | number}} VND</td>
              <td class="amount">{{row.teacherCost | number}} VND</td>
              <td class="amount">{{row.directParentExpense | number}} VND</td>
              <td class="amount">{{row.allocatedGroupExpense | number}} VND</td>
              <td class="amount">{{row.allocatedGlobalOverhead | number}} VND</td>
              <td class="amount">{{row.allocatedAdSpend | number}} VND</td>
              <td [class.amount-green]="row.netProfit >= 0" [class.amount-red]="row.netProfit < 0">{{row.netProfit | number}} VND</td>
              <td>
                <span class="roi-badge" [class.roi-high]="row.netMargin >= 40" [class.roi-mid]="row.netMargin >= 0 && row.netMargin < 40" [class.roi-low]="row.netMargin < 0">
                  {{row.netMargin}}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="section" *ngIf="parentProfitData()?.summaryByGroup?.length">
      <h3>Tong hop theo nhom quang cao</h3>
      <p class="desc">Tong hop so phu huynh, doanh thu thuc va loi nhuan sau khi da phan bo chi phi ve tung nhom.</p>
      <div class="table-wrap">
        <table class="data compact">
          <thead>
            <tr>
              <th>Nhom QC</th>
              <th>PH</th>
              <th>Hoc sinh</th>
              <th>Buoi hoc</th>
              <th>Doanh thu</th>
              <th>GV cost</th>
              <th>Chi phi khac</th>
              <th>Ads spend</th>
              <th>Loi nhuan</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of (parentProfitData()?.summaryByGroup || [])">
              <td>
                <strong>{{row.adGroupName || row.adGroupId || 'UNATTRIBUTED'}}</strong>
                <div class="muted">{{platformLabel(row.platform)}}</div>
              </td>
              <td>{{row.parentCount | number}}</td>
              <td>{{row.totalStudents | number}}</td>
              <td>{{row.totalSessions | number}}</td>
              <td class="amount">{{row.totalRevenue | number}} VND</td>
              <td class="amount">{{row.totalTeacherCost | number}} VND</td>
              <td class="amount">{{parentSummaryOtherCost(row) | number}} VND</td>
              <td class="amount">{{row.totalAdSpend | number}} VND</td>
              <td [class.amount-green]="row.totalNetProfit >= 0" [class.amount-red]="row.totalNetProfit < 0">{{row.totalNetProfit | number}} VND</td>
              <td>
                <span class="roi-badge" [class.roi-high]="row.netMargin >= 40" [class.roi-mid]="row.netMargin >= 0 && row.netMargin < 40" [class.roi-low]="row.netMargin < 0">
                  {{row.netMargin}}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <ng-template #noParentProfitRows>
      <p class="empty">KhÃ´ng cÃ³ parent-profit row trong khoáº£ng ngÃ y vÃ  bá»™ lá»c hiá»‡n táº¡i.</p>
    </ng-template>

    <p class="empty" *ngIf="loaded() && !parentProfitData()">KhÃ´ng cÃ³ dá»¯ liá»‡u parent-profit trong khoáº£ng thá»i gian nÃ y.</p>
  </ng-container>

  <ng-container *ngIf="activeTab === 'optimize-x'">
    <section class="section suggestion-section" *ngIf="canViewSuggestions(); else suggestionsNoPermission">
      <h3>Đề xuất ngân sách cho nhân viên ads</h3>
      <p class="desc">
        Thuật toán fit trên lợi nhuận hiệu lực: cohort đã có học phí thu vào sẽ dùng lợi nhuận dự kiến,
        trong đó phần dự kiến vẫn trừ lương giáo viên, chi phí phục vụ ước tính của các buổi chưa diễn ra
        và X refund phần còn lại hiện tại là <strong>{{refundAssumptionLabel(displayedRefundRatePercentX())}}</strong>.
      </p>

      <div class="suggestion-input">
        <label>Tổng ngân sách hằng ngày (VNĐ)
          <input type="number" [(ngModel)]="totalBudget" min="0" step="100000" />
        </label>
        <button class="primary" (click)="loadSuggestions()" [disabled]="!totalBudget || sugLoading()">
          {{sugLoading() ? 'Đang tính...' : 'Đề xuất phân bổ'}}
        </button>
      </div>

      <div *ngIf="sugData() as sug">
        <div class="sug-summary">
          <span><strong>Budget/ngày:</strong> {{sug.totalBudget | number}}đ</span>
          <span><strong>Đã phân bổ:</strong> {{sug.allocated | number}}đ</span>
          <span><strong>LN thuần dự kiến/ngày:</strong> {{sug.expectedDailyNetProfit | number}}đ</span>
          <span><strong>Basis:</strong> {{sug.basis}}</span>
          <span><strong>Cohort chín:</strong> {{sug.maturityDays}} ngày</span>
          <span><strong>X refund còn lại:</strong> {{refundAssumptionLabel(sug.refundRatePercentX)}}</span>
        </div>

        <div class="table-wrap" *ngIf="sug.suggestions.length">
          <table class="data compact wide-table">
            <thead>
              <tr>
                <th>Nhóm QC</th>
                <th>CP hiện tại/ngày</th>
                <th>CP đề xuất/ngày</th>
                <th>Tăng/Giảm</th>
                <th>CTR TB</th>
                <th>Lead rate</th>
                <th>Profit/Lead</th>
                <th>LN cohort TB</th>
                <th>Độ tin cậy</th>
                <th>Khuyến nghị</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of sug.suggestions">
                <td>
                  <strong>{{s.adGroupName || s.adGroupId}}</strong>
                  <div class="muted">{{platformLabel(s.platform)}}</div>
                </td>
                <td class="amount">{{s.currentDailySpend | number}}đ</td>
                <td class="amount">{{s.suggestedDailySpend | number}}đ</td>
                <td>
                  <span *ngIf="s.changePercent !== null"
                    [class.amount-green]="s.changePercent! > 0"
                    [class.amount-red]="s.changePercent! < 0">
                    {{s.changePercent! > 0 ? '+' : ''}}{{s.changePercent}}%
                  </span>
                  <span *ngIf="s.changePercent === null">-</span>
                </td>
                <td>{{s.averageCtr | number:'1.0-2'}}%</td>
                <td>{{s.averageLeadRate | number:'1.0-2'}}%</td>
                <td>{{s.averageProfitPerLead !== null ? (s.averageProfitPerLead | number) + 'đ' : '-'}}</td>
                <td [class.amount-green]="s.observedAverageNetProfit >= 0" [class.amount-red]="s.observedAverageNetProfit < 0">
                  {{s.observedAverageNetProfit | number}}đ
                </td>
                <td>
                  <span class="confidence-badge" [attr.data-level]="s.confidence">{{confidenceLabel(s.confidence)}}</span>
                </td>
                <td class="reason-cell">{{suggestionReason(s)}}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="table-wrap" *ngIf="sug.summaryTable.length">
          <h4>Bảng cohort dùng để tối ưu ngân sách</h4>
          <table class="data compact wide-table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Nhóm QC</th>
                <th>Cohort</th>
                <th>Impr</th>
                <th>Clicks</th>
                <th>Leads</th>
                <th>PH mới</th>
                <th>Spend thực</th>
                <th>Đã thu</th>
                <th>Buổi còn lại</th>
                <th>LN thực</th>
                <th>LN dùng fit</th>
                <th>Spend đề xuất</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of sug.summaryTable">
                <td>{{row.date}}</td>
                <td>{{row.adGroupName || row.adGroupId}}</td>
                <td>
                  <span class="status-badge" [attr.data-mature]="row.isMatured">
                    {{row.isMatured ? 'Đã chín' : 'Chưa chín'}} ({{row.cohortAgeDays}}/{{row.maturityDays}})
                  </span>
                </td>
                <td>{{row.impressions | number}}</td>
                <td>{{row.clicks | number}}</td>
                <td>{{row.leadCount | number}}</td>
                <td>{{row.newParentCount | number}}</td>
                <td class="amount">{{row.actualAdSpend | number}}đ</td>
                <td class="amount">{{row.collectedRevenue | number}}đ</td>
                <td>{{row.remainingSessionUnits | number:'1.0-2'}}</td>
                <td [class.amount-green]="row.netProfit >= 0" [class.amount-red]="row.netProfit < 0">{{row.netProfit | number}}đ</td>
                <td [class.amount-green]="row.effectiveNetProfit >= 0" [class.amount-red]="row.effectiveNetProfit < 0">{{row.effectiveNetProfit | number}}đ</td>
                <td class="amount">{{row.suggestedAdSpend | number}}đ</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="table-wrap" *ngIf="sug.dailySuggestedTotals.length">
          <h4>Tổng đề xuất theo ngày</h4>
          <table class="data compact">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Lợi nhuận dùng để fit</th>
                <th>Tổng chi phí ads đề xuất</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of sug.dailySuggestedTotals">
                <td>{{row.date}}</td>
                <td [class.amount-green]="row.totalNetProfit >= 0" [class.amount-red]="row.totalNetProfit < 0">{{row.totalNetProfit | number}}đ</td>
                <td class="amount">{{row.totalSuggestedAdSpend | number}}đ</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="table-wrap" *ngIf="sug.monthlyProjection.length">
          <h4>Dự báo theo tháng</h4>
          <table class="data compact">
            <thead>
              <tr>
                <th>Tháng</th>
                <th>Số ngày</th>
                <th>Chi phí ads dự báo</th>
                <th>LN thuần dự báo</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of sug.monthlyProjection">
                <td>{{row.month}}</td>
                <td>{{row.daysInMonth}}</td>
                <td class="amount">{{row.projectedSpend | number}}đ</td>
                <td [class.amount-green]="row.projectedNetProfit >= 0" [class.amount-red]="row.projectedNetProfit < 0">{{row.projectedNetProfit | number}}đ</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bar-chart" *ngIf="sug.suggestions.length">
          <h4>So sánh phân bổ hiện tại vs đề xuất</h4>
          <div class="bar-row" *ngFor="let s of sug.suggestions">
            <div class="bar-label">{{s.adGroupName || s.adGroupId}}</div>
            <div class="bar-container">
              <div class="bar current" [style.width.%]="barWidth(s.currentDailySpend)" title="Hiện tại: {{s.currentDailySpend | number}}đ"></div>
              <div class="bar suggested" [style.width.%]="barWidth(s.suggestedDailySpend)" title="Đề xuất: {{s.suggestedDailySpend | number}}đ"></div>
            </div>
          </div>
          <div class="bar-legend">
            <span class="legend-item"><span class="legend-color current"></span> Hiện tại</span>
            <span class="legend-item"><span class="legend-color suggested"></span> Đề xuất</span>
          </div>
        </div>
      </div>
    </section>

    <ng-template #suggestionsNoPermission>
      <section class="section suggestion-section">
        <h3>Đề xuất ngân sách</h3>
        <p class="desc">Chỉ Director có quyền xem và tính đề xuất ngân sách.</p>
      </section>
    </ng-template>
  </ng-container>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 20px; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; max-width: 860px; }

    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; }
    .filters input, .filters select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
    .filters label { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #475569; }
    .filters input[type="number"] { width: 120px; }

    .tab-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .tab-button { padding: 10px 14px; border-radius: 999px; border: 1px solid #cbd5e1; background: #fff; color: #334155; cursor: pointer; font-size: 13px; font-weight: 600; }
    .tab-button.active { border-color: #2563eb; background: #dbeafe; color: #1d4ed8; }

    .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { padding: 16px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
    .stat-value { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    .stat-label { font-size: 12px; color: #64748b; }
    .stat-card.blue { border-left: 4px solid #3b82f6; }
    .stat-card.teal { border-left: 4px solid #14b8a6; }
    .stat-card.indigo { border-left: 4px solid #6366f1; }
    .stat-card.green { border-left: 4px solid #10b981; }
    .stat-card.orange { border-left: 4px solid #f59e0b; }
    .stat-card.purple { border-left: 4px solid #8b5cf6; }
    .stat-card.red { border-left: 4px solid #ef4444; }

    .section { margin-bottom: 32px; }
    .section h3 { font-size: 16px; margin: 0 0 12px; }
    .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .desc { font-size: 13px; color: #64748b; margin: 0 0 16px; }
    .cohort-meta { display: flex; gap: 8px; flex-wrap: wrap; }
    .meta-pill { display: inline-flex; align-items: center; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .meta-pill.good { background: #dcfce7; color: #166534; }
    .meta-pill.warn { background: #fef3c7; color: #92400e; }

    .table-wrap { overflow-x: auto; }
    table.data { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.data th { text-align: left; padding: 8px 10px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 12px; }
    table.data th.sortable { cursor: pointer; }
    table.data th.sortable:hover { color: #1e40af; }
    table.data td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    table.data tr:hover { background: #f8fafc; }
    table.data.compact th, table.data.compact td { padding: 6px 8px; }
    .wide-table { min-width: 1260px; }
    .parent-profit-table { min-width: 1520px; }
    .identity-cell { min-width: 220px; }
    td.amount { font-weight: 600; }
    .amount-green { color: #10b981; }
    .amount-red { color: #ef4444; }
    .muted { color: #64748b; font-size: 12px; margin-top: 2px; }
    .reason-cell { min-width: 260px; color: #334155; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; color: #fff; }
    .badge.platform { background: #3b82f6; }
    .badge.platform[data-platform="FACEBOOK"] { background: #1877f2; }
    .badge.platform[data-platform="GOOGLE"] { background: #ea4335; }
    .badge.platform[data-platform="TIKTOK"] { background: #000; }

    .status-badge { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    .status-badge[data-mature="true"] { background: #dcfce7; color: #166534; }
    .status-badge[data-mature="false"] { background: #fef3c7; color: #92400e; }

    .roi-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; }
    .roi-high { background: #d1fae5; color: #065f46; }
    .roi-mid { background: #fef3c7; color: #92400e; }
    .roi-low { background: #fee2e2; color: #991b1b; }

    button.primary { padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    button.primary:hover { background: #2563eb; }
    button.primary:disabled { background: #93c5fd; cursor: not-allowed; }

    .empty { text-align: center; color: #94a3b8; padding: 40px; }

    .suggestion-section { background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }
    .suggestion-input { display: flex; gap: 12px; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; }
    .suggestion-input label { font-size: 13px; color: #475569; font-weight: 500; }
    .suggestion-input input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; width: 220px; margin-top: 4px; display: block; }

    .sug-summary { display: flex; gap: 16px; margin-bottom: 16px; font-size: 13px; flex-wrap: wrap; }
    .table-wrap h4 { font-size: 14px; margin: 16px 0 8px; }

    .confidence-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .confidence-badge[data-level="HIGH"] { background: #d1fae5; color: #065f46; }
    .confidence-badge[data-level="MEDIUM"] { background: #fef3c7; color: #92400e; }
    .confidence-badge[data-level="LOW"] { background: #fee2e2; color: #991b1b; }

    .bar-chart { margin-top: 24px; }
    .bar-chart h4 { font-size: 14px; margin: 0 0 12px; }
    .bar-row { display: flex; align-items: center; margin-bottom: 8px; gap: 8px; }
    .bar-label { width: 160px; font-size: 12px; text-align: right; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-container { flex: 1; position: relative; height: 24px; }
    .bar { height: 10px; border-radius: 4px; position: absolute; }
    .bar.current { background: #93c5fd; top: 0; }
    .bar.suggested { background: #3b82f6; top: 12px; }
    .bar-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-color { width: 12px; height: 12px; border-radius: 3px; }
    .legend-color.current { background: #93c5fd; }
    .legend-color.suggested { background: #3b82f6; }
  `],
})
export class AdsAnalyticsComponent implements OnInit {
  startDate = '';
  endDate = '';
  maturityDays = 60;
  filterPlatform = '';
  filterAdGroup = '';
  refundRatePercentXInput: number | null = null;
  totalBudget = 0;
  activeTab: AnalyticsTab = 'overview';

  adGroups = signal<AdGroupItem[]>([]);
  rows = signal<AdAnalyticsRow[]>([]);
  realizedData = signal<RealizedCohortResponse | null>(null);
  parentProfitData = signal<ParentProfitabilityResponse | null>(null);
  loaded = signal(false);
  sugData = signal<AdSuggestionResponse | null>(null);
  sugLoading = signal(false);

  sortField = 'totalSpend';
  sortDir: 'asc' | 'desc' = 'desc';
  private maxSpend = 0;

  constructor(
    private adsService: AdsService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    const now = new Date();
    this.endDate = now.toISOString().split('T')[0];
    const past = new Date(now.getTime() - 30 * 86400000);
    this.startDate = past.toISOString().split('T')[0];

    this.loadAdGroups();
    this.loadAnalytics();
  }

  platformLabel(p: string) { return PLATFORM_LABELS[p] || p; }
  canViewSuggestions() { return this.authService.hasRole([Role.DIRECTOR]); }
  setActiveTab(tab: AnalyticsTab) { this.activeTab = tab; }

  confidenceLabel(c: string) {
    if (c === 'HIGH') return 'Cao';
    if (c === 'MEDIUM') return 'Trung bình';
    return 'Thấp';
  }

  cohortLabel(row: RealizedCohortRow) {
    return `${row.isMatured ? 'Đã chín' : 'Chưa chín'} (${row.cohortAgeDays}/${row.maturityDays})`;
  }

  otherCost(row: RealizedCohortRow) {
    return row.directParentExpense + row.allocatedGroupExpense + row.allocatedGlobalOverhead;
  }

  parentSummaryOtherCost(
    row: ParentProfitabilityGroupSummary | ParentProfitabilityResponse['overall'],
  ) {
    return row.totalDirectParentExpense + row.totalAllocatedGroupExpense + row.totalAllocatedGlobalOverhead;
  }

  refundAssumptionLabel(value?: number | null) {
    if (value === null || value === undefined) return 'theo lịch sử';
    return `${value}%`;
  }

  suggestionReason(row: { recommendation?: string; recommendationReasons?: string[] }) {
    if (row.recommendation) return row.recommendation;
    if (Array.isArray(row.recommendationReasons) && row.recommendationReasons.length) {
      return row.recommendationReasons[0];
    }
    return '-';
  }

  currentRefundRatePercentX(): number | undefined {
    if (this.refundRatePercentXInput === null || this.refundRatePercentXInput === undefined) return undefined;
    const value = Number(this.refundRatePercentXInput);
    return Number.isFinite(value) ? value : undefined;
  }

  displayedRefundRatePercentX(): number | undefined {
    return this.sugData()?.refundRatePercentX ?? this.currentRefundRatePercentX();
  }

  async loadAdGroups() {
    try {
      const groups = await this.adsService.getAllGroups();
      this.adGroups.set(groups);
    } catch {
      this.adGroups.set([]);
    }
  }

  async loadAnalytics() {
    if (!this.startDate || !this.endDate) return;

    const refundRatePercentX = this.currentRefundRatePercentX();
    this.sugData.set(null);
    this.maxSpend = 0;

    try {
      const [analytics, realized, parentProfit] = await Promise.all([
        this.adsService.getAnalytics(
          this.startDate,
          this.endDate,
          this.filterAdGroup || undefined,
          this.filterPlatform || undefined,
        ),
        this.adsService.getRealizedCohortAnalytics(
          this.startDate,
          this.endDate,
          this.maturityDays,
          this.filterAdGroup || undefined,
          this.filterPlatform || undefined,
          refundRatePercentX,
        ),
        this.adsService.getParentProfitability(
          this.startDate,
          this.endDate,
          this.filterAdGroup || undefined,
          this.filterPlatform || undefined,
        ),
      ]);
      this.rows.set(analytics.rows);
      this.realizedData.set(realized);
      this.parentProfitData.set(parentProfit);
      this.loaded.set(true);
    } catch {
      this.rows.set([]);
      this.realizedData.set(null);
      this.parentProfitData.set(null);
      this.loaded.set(true);
    }
  }

  sortBy(field: string) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'desc';
    }
  }

  sortedRows(): AdAnalyticsRow[] {
    const list = [...this.rows()];
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const field = this.sortField as keyof AdAnalyticsRow;
    list.sort((a, b) => {
      const va = a[field] ?? 0;
      const vb = b[field] ?? 0;
      if (typeof va === 'string') return va.localeCompare(vb as string) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return list;
  }

  async loadSuggestions() {
    if (!this.canViewSuggestions()) return;
    if (!this.startDate || !this.endDate || !this.totalBudget) return;

    const refundRatePercentX = this.currentRefundRatePercentX();
    this.sugLoading.set(true);
    try {
      const res = await this.adsService.getSuggestions(
        this.startDate,
        this.endDate,
        this.totalBudget,
        this.maturityDays,
        refundRatePercentX,
      );
      this.sugData.set(res);

      this.maxSpend = 0;
      for (const s of res.suggestions) {
        this.maxSpend = Math.max(this.maxSpend, s.currentDailySpend, s.suggestedDailySpend);
      }
    } catch {
      this.sugData.set(null);
    }
    this.sugLoading.set(false);
  }

  barWidth(value: number): number {
    if (this.maxSpend <= 0) return 0;
    return Math.min(100, (value / this.maxSpend) * 100);
  }
}
