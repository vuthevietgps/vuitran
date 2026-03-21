import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';

import {
  FinancialControlService,
  BankAccount,
} from '../services/financial-control.service';

interface ReconciliationResult {
  summary: {
    matchedCount: number;
    matchedAmount: number;
    unmatchedBankCount: number;
    unmatchedBankAmount: number;
    unmatchedSystemCount: number;
    unmatchedSystemAmount: number;
    variance: number;
  };
  matched: Array<{
    bankTxn: { _id: string; transactionCode: string; amount: number; transactionDate: string; description?: string };
    ledgerEntry: { _id: string; amount: number; createdAt: string; description?: string; reference?: string };
  }>;
  unmatchedBank: Array<{
    _id: string;
    transactionCode: string;
    amount: number;
    transactionDate: string;
    type: string;
    description?: string;
  }>;
  unmatchedSystem: Array<{
    _id: string;
    amount: number;
    createdAt: string;
    description?: string;
    reference?: string;
    category?: string;
  }>;
}

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Doi soat Ngan hang</h2>
      <p>So khop giao dich ngan hang voi so sach he thong.</p>
    </div>
  </header>

  <app-flow-guide featureKey="bank-reconciliation"></app-flow-guide>

  <!-- Filters -->
  <div class="filter-bar">
    <label class="filter-label">
      Tai khoan ngan hang
      <select [(ngModel)]="selectedBankAccountId">
        <option value="">-- Chon tai khoan --</option>
        <option *ngFor="let ba of bankAccounts()" [value]="ba._id">
          {{ba.bankName}} - {{ba.accountNumber}}
        </option>
      </select>
    </label>
    <label class="filter-label">
      Tu ngay
      <input type="date" [(ngModel)]="fromDate" />
    </label>
    <label class="filter-label">
      Den ngay
      <input type="date" [(ngModel)]="toDate" />
    </label>
    <button class="primary" (click)="runReconciliation()" [disabled]="!selectedBankAccountId || loading()">
      {{loading() ? 'Dang xu ly...' : 'Doi soat'}}
    </button>
  </div>

  <p class="error" *ngIf="errorMsg()">{{errorMsg()}}</p>

  <!-- Summary Cards -->
  <ng-container *ngIf="result()">
    <div class="summary-grid">
      <div class="summary-card matched">
        <div class="card-label">Khop</div>
        <div class="card-count">{{result()!.summary.matchedCount}} giao dich</div>
        <div class="card-amount">{{result()!.summary.matchedAmount | number}}d</div>
      </div>
      <div class="summary-card unmatched-bank">
        <div class="card-label">Ngan hang chua khop</div>
        <div class="card-count">{{result()!.summary.unmatchedBankCount}} giao dich</div>
        <div class="card-amount">{{result()!.summary.unmatchedBankAmount | number}}d</div>
      </div>
      <div class="summary-card unmatched-system">
        <div class="card-label">He thong chua khop</div>
        <div class="card-count">{{result()!.summary.unmatchedSystemCount}} giao dich</div>
        <div class="card-amount">{{result()!.summary.unmatchedSystemAmount | number}}d</div>
      </div>
      <div class="summary-card variance">
        <div class="card-label">Chenh lech</div>
        <div class="card-amount" [class.amount-green]="result()!.summary.variance === 0"
             [class.amount-red]="result()!.summary.variance !== 0">
          {{result()!.summary.variance | number}}d
        </div>
      </div>
    </div>

    <!-- Section: Matched -->
    <div class="section">
      <h3 class="section-title matched-title">Giao dich da khop ({{result()!.matched.length}})</h3>
      <table class="data" *ngIf="result()!.matched.length">
        <thead>
          <tr>
            <th>STT</th>
            <th>So tien (NH)</th>
            <th>Ngay GD (NH)</th>
            <th>So tien (He thong)</th>
            <th>Ngay tao (He thong)</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let m of result()!.matched; let i = index" class="row-matched">
            <td>{{i + 1}}</td>
            <td class="right">{{m.bankTxn.amount | number}}d</td>
            <td>{{m.bankTxn.transactionDate | date:'dd/MM/yyyy'}}</td>
            <td class="right">{{m.ledgerEntry.amount | number}}d</td>
            <td>{{m.ledgerEntry.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
          </tr>
        </tbody>
      </table>
      <p class="empty-text" *ngIf="!result()!.matched.length">Khong co giao dich khop nao.</p>
    </div>

    <!-- Section: Unmatched Bank -->
    <div class="section">
      <h3 class="section-title unmatched-bank-title">Giao dich ngan hang chua khop ({{result()!.unmatchedBank.length}})</h3>
      <table class="data" *ngIf="result()!.unmatchedBank.length">
        <thead>
          <tr>
            <th>STT</th>
            <th>Ma GD</th>
            <th>So tien</th>
            <th>Ngay GD</th>
            <th>Loai</th>
            <th>Mo ta</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of result()!.unmatchedBank; let i = index" class="row-unmatched-bank">
            <td>{{i + 1}}</td>
            <td><code>{{u.transactionCode}}</code></td>
            <td class="right">{{u.amount | number}}d</td>
            <td>{{u.transactionDate | date:'dd/MM/yyyy'}}</td>
            <td>{{u.type}}</td>
            <td>{{u.description || '-'}}</td>
          </tr>
        </tbody>
      </table>
      <p class="empty-text" *ngIf="!result()!.unmatchedBank.length">Tat ca giao dich ngan hang da duoc khop.</p>
    </div>

    <!-- Section: Unmatched System -->
    <div class="section">
      <h3 class="section-title unmatched-system-title">But toan he thong chua khop ({{result()!.unmatchedSystem.length}})</h3>
      <table class="data" *ngIf="result()!.unmatchedSystem.length">
        <thead>
          <tr>
            <th>STT</th>
            <th>So tien</th>
            <th>Ngay tao</th>
            <th>Danh muc</th>
            <th>Tham chieu</th>
            <th>Mo ta</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of result()!.unmatchedSystem; let i = index" class="row-unmatched-system">
            <td>{{i + 1}}</td>
            <td class="right">{{u.amount | number}}d</td>
            <td>{{u.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
            <td>{{u.category || '-'}}</td>
            <td>{{u.reference || '-'}}</td>
            <td>{{u.description || '-'}}</td>
          </tr>
        </tbody>
      </table>
      <p class="empty-text" *ngIf="!result()!.unmatchedSystem.length">Tat ca but toan he thong da duoc khop.</p>
    </div>
  </ng-container>

  <p class="empty-text" *ngIf="!result() && !loading() && !errorMsg()">Chon tai khoan va khoang thoi gian, sau do nhan "Doi soat" de bat dau.</p>
  `,
  styles: [`
    .page-header { padding:24px 32px 16px; }
    .page-header h2 { margin:0; font-size:22px; color:#1e293b; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }

    .filter-bar { display:flex; gap:16px; align-items:flex-end; padding:0 32px 16px; flex-wrap:wrap; }
    .filter-label { display:flex; flex-direction:column; font-size:13px; font-weight:600; color:#374151; gap:4px; }
    .filter-label select,
    .filter-label input { padding:8px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; min-width:180px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:600; font-size:14px; align-self:flex-end; }
    .primary:hover { background:#1d4ed8; }
    .primary:disabled { background:#94a3b8; cursor:not-allowed; }

    .error { color:#ef4444; font-size:13px; padding:0 32px; }

    /* Summary cards */
    .summary-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; padding:0 32px 24px; }
    .summary-card { background:#fff; border-radius:12px; padding:20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .summary-card.matched { border-left:4px solid #10b981; }
    .summary-card.unmatched-bank { border-left:4px solid #f59e0b; }
    .summary-card.unmatched-system { border-left:4px solid #ef4444; }
    .summary-card.variance { border-left:4px solid #6366f1; }
    .card-label { font-size:12px; color:#64748b; text-transform:uppercase; font-weight:700; letter-spacing:0.5px; margin-bottom:8px; }
    .card-count { font-size:13px; color:#475569; margin-bottom:4px; }
    .card-amount { font-size:20px; font-weight:700; color:#1e293b; }

    /* Sections */
    .section { padding:0 32px 24px; }
    .section-title { margin:0 0 12px; font-size:16px; padding:10px 16px; border-radius:8px; }
    .matched-title { background:#f0fdf4; color:#166534; border-left:4px solid #10b981; }
    .unmatched-bank-title { background:#fffbeb; color:#92400e; border-left:4px solid #f59e0b; }
    .unmatched-system-title { background:#fef2f2; color:#991b1b; border-left:4px solid #ef4444; }

    /* Table */
    .data { width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .data th { background:#f8fafc; text-align:left; padding:10px 12px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .data td { padding:10px 12px; border-top:1px solid #f1f5f9; font-size:13px; }
    .data code { font-size:12px; color:#2563eb; }
    .right { text-align:right; }

    .row-matched { background:#f0fdf4; }
    .row-matched:hover { background:#dcfce7; }
    .row-unmatched-bank { background:#fffbeb; }
    .row-unmatched-bank:hover { background:#fef3c7; }
    .row-unmatched-system { background:#fef2f2; }
    .row-unmatched-system:hover { background:#fee2e2; }

    .amount-green { color:#10b981; }
    .amount-red { color:#ef4444; }
    .empty-text { text-align:center; color:#94a3b8; padding:32px; font-size:14px; }
  `]
})
export class BankReconciliationComponent implements OnInit {
  private apiUrl = `${environment.apiBase}/financial-control`;

  bankAccounts = signal<BankAccount[]>([]);
  result = signal<ReconciliationResult | null>(null);
  loading = signal(false);
  errorMsg = signal('');

  selectedBankAccountId = '';
  fromDate = '';
  toDate = '';

  constructor(
    private http: HttpClient,
    private financialService: FinancialControlService,
  ) {}

  ngOnInit() {
    this.loadBankAccounts();
  }

  async loadBankAccounts() {
    try {
      const accounts = await this.financialService.getBankAccounts();
      this.bankAccounts.set(accounts);
    } catch (err) {
      console.error('Error loading bank accounts:', err);
    }
  }

  async runReconciliation() {
    if (!this.selectedBankAccountId) return;

    this.loading.set(true);
    this.errorMsg.set('');
    this.result.set(null);

    try {
      let params = new HttpParams().set('bankAccountId', this.selectedBankAccountId);
      if (this.fromDate) params = params.set('fromDate', this.fromDate);
      if (this.toDate) params = params.set('toDate', this.toDate);

      const data = await this.http
        .get<ReconciliationResult>(`${this.apiUrl}/bank-reconciliation`, { params })
        .toPromise() as ReconciliationResult;

      this.result.set(data);
    } catch (err: any) {
      this.errorMsg.set(err.error?.message || 'Loi khi thuc hien doi soat. Vui long thu lai.');
      console.error('Reconciliation error:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
