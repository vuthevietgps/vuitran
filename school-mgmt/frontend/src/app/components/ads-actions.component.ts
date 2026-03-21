import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActionableSuggestion, ActionsRequiredResponse, AdsService } from '../services/ads.service';

@Component({
  selector: 'app-ads-actions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="actions-container">
      <div class="actions-header">
        <h3>Việc cần làm</h3>
        <div class="header-controls">
          <select [(ngModel)]="lookbackDays" (ngModelChange)="load()">
            <option [ngValue]="7">7 ngày</option>
            <option [ngValue]="14">14 ngày</option>
            <option [ngValue]="30">30 ngày</option>
          </select>
          <button class="link-btn" (click)="load()" [disabled]="loading()">
            {{ loading() ? 'Đang tải...' : 'Tải lại' }}
          </button>
        </div>
      </div>

      <!-- Summary dashboard -->
      <div class="summary-dashboard" *ngIf="!loading() && !error() && summary()">
        <div class="summary-card">
          <span class="summary-label">Nhóm hoạt động</span>
          <span class="summary-value">{{ summary()!.totalActiveGroups }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Có lãi</span>
          <span class="summary-value profit">{{ summary()!.profitableGroups }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Thua lỗ</span>
          <span class="summary-value loss">{{ summary()!.unprofitableGroups }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Chi phí/ngày</span>
          <span class="summary-value">{{ formatCurrency(summary()!.totalDailySpend) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">Tối ưu/ngày</span>
          <span class="summary-value">{{ formatCurrency(summary()!.totalOptimalDailySpend) }}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">LN ròng ({{ lookbackDays }}d)</span>
          <span class="summary-value"
            [class.profit]="summary()!.overallNetProfit7d >= 0"
            [class.loss]="summary()!.overallNetProfit7d < 0"
          >{{ formatCurrency(summary()!.overallNetProfit7d) }}</span>
        </div>
      </div>

      <div class="actions-loading" *ngIf="loading()">
        <span>Đang phân tích dữ liệu...</span>
      </div>

      <div class="actions-error" *ngIf="!loading() && error()">
        <span>{{ error() }}</span>
      </div>

      <div class="actions-empty" *ngIf="!loading() && !error() && actions().length === 0">
        <span>Không có việc cần làm. Tất cả các nhóm quảng cáo đang hoạt động hiệu quả!</span>
      </div>

      <div class="action-list" *ngIf="!loading() && !error() && actions().length > 0">
        <article
          class="action-card"
          *ngFor="let item of actions()"
          [class.priority-critical]="item.priority === 'CRITICAL'"
          [class.priority-high]="item.priority === 'HIGH'"
          [class.priority-medium]="item.priority === 'MEDIUM'"
          [class.priority-low]="item.priority === 'LOW'"
        >
          <div class="action-card-head">
            <span class="priority-badge" [class]="'priority-' + item.priority.toLowerCase()">
              {{ priorityLabel(item.priority) }}
            </span>
            <span class="action-type-badge">{{ typeLabel(item.type) }}</span>
          </div>

          <h4 class="action-title">{{ item.title }}</h4>
          <p class="action-desc">{{ item.description }}</p>

          <!-- Reasons list -->
          <ul class="action-reasons" *ngIf="item.reasons && item.reasons.length > 0">
            <li *ngFor="let reason of item.reasons">{{ reason }}</li>
          </ul>

          <div class="action-details" *ngIf="item.type === 'PAUSE_GROUP'">
            <div class="detail-row">
              <span class="detail-label">LN ròng ({{ lookbackDays }} ngày):</span>
              <span class="detail-value loss">{{ formatCurrency(item.details['netProfit7Days']) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">LN cohort (90 ngày):</span>
              <span class="detail-value"
                [class.loss]="item.details['effectiveNetProfit'] < 0"
                [class.profit]="item.details['effectiveNetProfit'] >= 0"
              >{{ formatCurrency(item.details['effectiveNetProfit']) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Chi phí QC/ngày:</span>
              <span class="detail-value">{{ formatCurrency(item.details['actualDailySpend']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['optimalDailySpend'] > 0">
              <span class="detail-label">Tối ưu/ngày:</span>
              <span class="detail-value">{{ formatCurrency(item.details['optimalDailySpend']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['platform']">
              <span class="detail-label">Nền tảng:</span>
              <span class="detail-value">{{ item.details['platform'] }}</span>
            </div>
          </div>

          <div class="action-details" *ngIf="item.type === 'ADJUST_BUDGET'">
            <div class="detail-row">
              <span class="detail-label">Ngân sách hiện tại/ngày:</span>
              <span class="detail-value">{{ formatCurrency(item.details['currentDailySpend']) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Ngân sách đề xuất/ngày:</span>
              <span class="detail-value">{{ formatCurrency(item.details['optimalDailySpendReal']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['safeDailyTarget'] != null">
              <span class="detail-label">Điều chỉnh an toàn hôm nay:</span>
              <span class="detail-value profit">{{ formatCurrency(item.details['safeDailyTarget']) }}</span>
            </div>
            <div class="learning-phase-alert" *ngIf="item.details['learningPhaseProtected']">
              ⚠️ Điều chỉnh >20% — thực hiện từng bước để không reset Learning Phase của thuật toán
            </div>
            <div class="detail-row" *ngIf="item.details['expectedDailyNetProfit'] != null">
              <span class="detail-label">LN ròng dự kiến/ngày:</span>
              <span
                class="detail-value"
                [class.profit]="item.details['expectedDailyNetProfit'] >= 0"
                [class.loss]="item.details['expectedDailyNetProfit'] < 0"
              >{{ formatCurrency(item.details['expectedDailyNetProfit']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['platform']">
              <span class="detail-label">Nền tảng:</span>
              <span class="detail-value">{{ item.details['platform'] }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Độ tin cậy:</span>
              <span class="detail-value confidence" [class]="'conf-' + item.details['confidence']?.toLowerCase()">
                {{ confidenceLabel(item.details['confidence']) }}
              </span>
            </div>
          </div>

          <div class="action-details" *ngIf="item.type === 'CREATE_GROUP'">
            <div class="detail-row">
              <span class="detail-label">Ngân sách chưa phân bổ:</span>
              <span class="detail-value">{{ formatCurrency(item.details['unallocatedBudget']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['suggestedBudgetPerNewGroup']">
              <span class="detail-label">Budget đề xuất/nhóm mới:</span>
              <span class="detail-value">{{ formatCurrency(item.details['suggestedBudgetPerNewGroup']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['suggestedPlatform']">
              <span class="detail-label">Nền tảng đề xuất:</span>
              <span class="detail-value">{{ item.details['suggestedPlatform'] }}</span>
            </div>
          </div>

          <!-- OPTIMIZE_FUNNEL_FIRST details -->
          <div class="action-details" *ngIf="item.type === 'OPTIMIZE_FUNNEL_FIRST'">
            <div class="detail-row" *ngIf="item.details['totalActiveGroups'] != null">
              <span class="detail-label">Tổng nhóm hoạt động:</span>
              <span class="detail-value">{{ item.details['totalActiveGroups'] }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['unprofitableGroupCount'] != null">
              <span class="detail-label">Nhóm đang lỗ:</span>
              <span class="detail-value loss">{{ item.details['unprofitableGroupCount'] }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['accountOverallProfit'] != null">
              <span class="detail-label">LN cohort 90 ngày:</span>
              <span class="detail-value loss">{{ formatCurrency(item.details['accountOverallProfit']) }}</span>
            </div>
            <div class="detail-row" *ngIf="item.details['unallocatedBudget']">
              <span class="detail-label">Ngân sách chưa phân bổ:</span>
              <span class="detail-value">{{ formatCurrency(item.details['unallocatedBudget']) }}</span>
            </div>
          </div>

          <!-- Estimated Impact -->
          <div class="estimated-impact" *ngIf="item.estimatedImpact && item.estimatedImpact.dailyProfitChange !== 0">
            <span class="impact-label">Tác động ước tính:</span>
            <span class="impact-value"
              [class.profit]="item.estimatedImpact.dailyProfitChange > 0"
              [class.loss]="item.estimatedImpact.dailyProfitChange < 0"
            >{{ formatCurrency(item.estimatedImpact.dailyProfitChange) }}/ngày</span>
            <span class="impact-sep">&middot;</span>
            <span class="impact-value"
              [class.profit]="item.estimatedImpact.monthlyProfitChange > 0"
              [class.loss]="item.estimatedImpact.monthlyProfitChange < 0"
            >{{ formatCurrency(item.estimatedImpact.monthlyProfitChange) }}/tháng</span>
          </div>

          <div class="action-footer">
            <ng-container *ngIf="item.type === 'PAUSE_GROUP' || item.type === 'ADJUST_BUDGET'">
              <a
                *ngIf="item.relatedEntity"
                [routerLink]="['/app/ads-management']"
                [queryParams]="{ tab: 'groups' }"
                class="action-btn secondary"
              >Xem nhóm QC</a>
            </ng-container>
            <ng-container *ngIf="item.type === 'CREATE_GROUP'">
              <a
                [routerLink]="['/app/ads-management']"
                [queryParams]="{ tab: 'groups' }"
                class="action-btn secondary"
              >Tạo nhóm QC mới</a>
            </ng-container>
          </div>
        </article>
      </div>
    </div>
  `,
  styles: [`
    .actions-container {
      padding: 0;
    }
    .actions-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .actions-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary, #1e293b);
    }
    .header-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
    .header-controls select {
      padding: 4px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 0.82rem;
      background: #fff;
      color: #334155;
      cursor: pointer;
    }

    /* Summary dashboard */
    .summary-dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .summary-label {
      font-size: 0.72rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }
    .summary-value {
      font-size: 1rem;
      font-weight: 700;
      color: #1e293b;
    }
    .summary-value.profit { color: #15803d; }
    .summary-value.loss { color: #b91c1c; }

    .actions-loading, .actions-error, .actions-empty {
      padding: 32px;
      text-align: center;
      color: #64748b;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
    }
    .actions-error { color: #b91c1c; background: #fff1f2; border-color: #fca5a5; }
    .action-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .action-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: #fff;
      border-left: 4px solid #94a3b8;
    }
    .action-card.priority-critical { border-left-color: #7f1d1d; background: #fef2f2; }
    .action-card.priority-high { border-left-color: #dc2626; }
    .action-card.priority-medium { border-left-color: #d97706; }
    .action-card.priority-low { border-left-color: #16a34a; }

    .action-card-head {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }
    .priority-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .priority-badge.priority-critical { background: #7f1d1d; color: #fff; }
    .priority-badge.priority-high { background: #fee2e2; color: #991b1b; }
    .priority-badge.priority-medium { background: #fef3c7; color: #92400e; }
    .priority-badge.priority-low { background: #dcfce7; color: #166534; }

    .action-type-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 9999px;
      background: #f1f5f9;
      color: #475569;
    }
    .action-title {
      margin: 0 0 6px;
      font-size: 0.95rem;
      font-weight: 600;
      color: #1e293b;
    }
    .action-desc {
      margin: 0 0 12px;
      font-size: 0.85rem;
      color: #475569;
      line-height: 1.5;
    }
    .action-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: #f8fafc;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 12px;
    }
    .detail-row {
      display: flex;
      gap: 8px;
      font-size: 0.82rem;
    }
    .detail-label { color: #64748b; min-width: 180px; flex-shrink: 0; }
    .detail-value { color: #1e293b; font-weight: 500; }
    .detail-value.loss { color: #b91c1c; }
    .detail-value.profit { color: #15803d; }
    .conf-high { color: #15803d; }
    .conf-medium { color: #d97706; }
    .conf-low { color: #b91c1c; }

    /* Estimated Impact */
    .estimated-impact {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      padding: 8px 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .impact-label {
      color: #64748b;
      font-weight: 500;
    }
    .impact-value { font-weight: 600; }
    .impact-value.profit { color: #15803d; }
    .impact-value.loss { color: #b91c1c; }
    .impact-sep { color: #94a3b8; }

    .action-footer {
      display: flex;
      gap: 8px;
    }
    .action-btn {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
    }
    .action-btn.secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .action-btn.secondary:hover { background: #e2e8f0; }

    /* Reasons list */
    .action-reasons {
      margin: 0 0 12px;
      padding: 0 0 0 18px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .action-reasons li {
      font-size: 0.82rem;
      color: #475569;
      line-height: 1.5;
    }

    /* Learning Phase warning */
    .learning-phase-alert {
      font-size: 0.8rem;
      color: #92400e;
      background: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 7px 10px;
      margin-bottom: 8px;
      font-weight: 500;
    }
  `],
})
export class AdsActionsComponent implements OnInit {
  actions = signal<ActionableSuggestion[]>([]);
  summary = signal<ActionsRequiredResponse['summary'] | null>(null);
  loading = signal(true);
  error = signal('');
  lookbackDays = 7;

  constructor(private readonly adsService: AdsService) {}

  ngOnInit() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.adsService.getActionsRequired({ lookbackDays: this.lookbackDays });
      this.actions.set(result.actions ?? []);
      this.summary.set(result.summary ?? null);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Không thể tải danh sách việc cần làm.');
    } finally {
      this.loading.set(false);
    }
  }

  priorityLabel(priority: string): string {
    const map: Record<string, string> = { CRITICAL: 'Rủi ro cao', HIGH: 'Ưu tiên cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
    return map[priority] ?? priority;
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      PAUSE_GROUP: 'Tạm dừng nhóm QC',
      ADJUST_BUDGET: 'Điều chỉnh ngân sách',
      CREATE_GROUP: 'Tạo nhóm mới',
      OPTIMIZE_FUNNEL_FIRST: 'Tối ưu funnel trước',
    };
    return map[type] ?? type;
  }

  confidenceLabel(confidence: string): string {
    const map: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
    return map[confidence] ?? confidence ?? '-';
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return '-';
    return value.toLocaleString('vi-VN') + 'đ';
  }
}
