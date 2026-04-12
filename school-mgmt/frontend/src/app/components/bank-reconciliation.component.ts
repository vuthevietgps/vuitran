import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { FinancialControlService, BankAccount } from '../services/financial-control.service';
import { WalletService } from '../services/wallet.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

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

type ImportedRowType = 'MATCHED' | 'UNMATCHED_BANK' | 'UNMATCHED_SYSTEM';

interface ImportedRow {
  id: string;
  rowType: ImportedRowType;
  reference: string;
  amount: number;
  transactionDate: string;
  description: string;
  pendingTopUpId?: string;
}

@Component({
  selector: 'app-bank-reconciliation',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Doi soat Ngan hang</h2>
      <p>So khop giao dich ngan hang voi so sach he thong.</p>
    </div>
  </header>

  <app-flow-guide featureKey="bank-reconciliation"></app-flow-guide>

  <div class="filter-bar">
    <label class="filter-label">
      Tai khoan ngan hang
      <select [(ngModel)]="selectedBankAccountId" aria-label="Tai khoan ngan hang">
        <option value="">-- Chon tai khoan --</option>
        <option *ngFor="let ba of bankAccounts()" [value]="ba._id">
          {{ ba.bankName }} - {{ ba.accountNumber }}
        </option>
      </select>
    </label>

    <label class="filter-label">
      Tu ngay
      <input type="date" [(ngModel)]="fromDate" aria-label="Tu ngay doi soat" />
    </label>

    <label class="filter-label">
      Den ngay
      <input type="date" [(ngModel)]="toDate" aria-label="Den ngay doi soat" />
    </label>

    <button class="primary" type="button" (click)="runReconciliation()" [disabled]="!selectedBankAccountId || loading()">
      {{ loading() ? 'Dang xu ly...' : 'Doi soat' }}
    </button>

    <div class="import-actions">
      <button
        type="button"
        class="secondary"
        aria-label="Import giao dich gia lap"
        (click)="triggerCsvInput(csvInput)">
        Import giao dich gia lap
      </button>
      <input
        #csvInput
        class="file-input"
        type="file"
        accept=".csv,text/csv"
        aria-label="Import giao dich gia lap"
        (change)="onCsvSelected($event)" />
    </div>
  </div>

  <p class="error" *ngIf="errorMsg()">{{ errorMsg() }}</p>
  <div *ngIf="notification()" class="notification" [class.error]="notificationType() === 'error'">
    {{ notification() }}
  </div>

  <ng-container *ngIf="hasVisibleData()">
    <div class="summary-grid">
      <div class="summary-card matched">
        <div class="card-label">Khop</div>
        <div class="card-count">{{ matchedCount() }} giao dich</div>
        <div class="card-amount">{{ matchedAmount() | number }}d</div>
      </div>
      <div class="summary-card unmatched-bank">
        <div class="card-label">Ngan hang chua khop</div>
        <div class="card-count">{{ unmatchedBankCount() }} giao dich</div>
        <div class="card-amount">{{ unmatchedBankAmount() | number }}d</div>
      </div>
      <div class="summary-card unmatched-system">
        <div class="card-label">He thong chua khop</div>
        <div class="card-count">{{ unmatchedSystemCount() }} giao dich</div>
        <div class="card-amount">{{ unmatchedSystemAmount() | number }}d</div>
      </div>
      <div class="summary-card variance">
        <div class="card-label">Chenh lech</div>
        <div class="card-amount" [class.amount-green]="varianceAmount() === 0" [class.amount-red]="varianceAmount() !== 0">
          {{ varianceAmount() | number }}d
        </div>
      </div>
    </div>

    <div class="section">
      <h3 class="section-title matched-title">Giao dich da khop ({{ matchedCount() }})</h3>
      <table class="data" *ngIf="matchedCount() > 0">
        <thead>
          <tr>
            <th>STT</th>
            <th>Tham chieu</th>
            <th>So tien (NH)</th>
            <th>Ngay GD (NH)</th>
            <th>So tien (He thong)</th>
            <th>Ngay tao (He thong)</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let m of result()?.matched || []; let i = index" class="row-matched">
            <td>{{ i + 1 }}</td>
            <td><code>{{ m.ledgerEntry.reference || m.bankTxn.transactionCode }}</code></td>
            <td class="right">{{ m.bankTxn.amount | number }}d</td>
            <td>{{ m.bankTxn.transactionDate | date:'dd/MM/yyyy' }}</td>
            <td class="right">{{ m.ledgerEntry.amount | number }}d</td>
            <td>{{ m.ledgerEntry.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
          </tr>
          <tr
            *ngFor="let item of importedMatchedRows(); let i = index"
            class="row-matched matched-item"
            [attr.data-reference]="item.reference">
            <td>{{ (result()?.matched?.length || 0) + i + 1 }}</td>
            <td><code>{{ item.reference }}</code></td>
            <td class="right">{{ item.amount | number }}d</td>
            <td>{{ item.transactionDate | date:'dd/MM/yyyy' }}</td>
            <td class="right">{{ item.amount | number }}d</td>
            <td>{{ item.transactionDate | date:'dd/MM/yyyy' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="empty-text" *ngIf="matchedCount() === 0">Khong co giao dich khop nao.</p>
    </div>

    <div class="section">
      <h3 class="section-title unmatched-bank-title">Giao dich ngan hang chua khop ({{ unmatchedBankCount() }})</h3>
      <table class="data" *ngIf="unmatchedBankCount() > 0">
        <thead>
          <tr>
            <th>STT</th>
            <th>Ma GD</th>
            <th>So tien</th>
            <th>Ngay GD</th>
            <th>Loai</th>
            <th>Mo ta</th>
            <th>Hanh dong</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of result()?.unmatchedBank || []; let i = index" class="row-unmatched-bank">
            <td>{{ i + 1 }}</td>
            <td><code>{{ u.transactionCode }}</code></td>
            <td class="right">{{ u.amount | number }}d</td>
            <td>{{ u.transactionDate | date:'dd/MM/yyyy' }}</td>
            <td>{{ u.type }}</td>
            <td>{{ u.description || '-' }}</td>
            <td><span class="muted">Theo doi</span></td>
          </tr>
          <tr
            *ngFor="let item of importedUnmatchedBankRows(); let i = index"
            class="row-unmatched-bank unmatched-item"
            [attr.data-reference]="item.reference">
            <td>{{ (result()?.unmatchedBank?.length || 0) + i + 1 }}</td>
            <td><code>{{ item.reference }}</code></td>
            <td class="right">{{ item.amount | number }}d</td>
            <td>{{ item.transactionDate | date:'dd/MM/yyyy' }}</td>
            <td>CSV</td>
            <td>{{ item.description || '-' }}</td>
            <td>
              <button
                type="button"
                class="danger-link"
                aria-label="Reject Reconciliation"
                (click)="openRejectModal(item)">
                Tu choi doi soat
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="empty-text" *ngIf="unmatchedBankCount() === 0">Tat ca giao dich ngan hang da duoc khop.</p>
    </div>

    <div class="section">
      <h3 class="section-title unmatched-system-title">But toan he thong chua khop ({{ unmatchedSystemCount() }})</h3>
      <table class="data" *ngIf="unmatchedSystemCount() > 0">
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
          <tr *ngFor="let u of result()?.unmatchedSystem || []; let i = index" class="row-unmatched-system">
            <td>{{ i + 1 }}</td>
            <td class="right">{{ u.amount | number }}d</td>
            <td>{{ u.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            <td>{{ u.category || '-' }}</td>
            <td>{{ u.reference || '-' }}</td>
            <td>{{ u.description || '-' }}</td>
          </tr>
          <tr *ngFor="let item of importedUnmatchedSystemRows(); let i = index" class="row-unmatched-system">
            <td>{{ (result()?.unmatchedSystem?.length || 0) + i + 1 }}</td>
            <td class="right">{{ item.amount | number }}d</td>
            <td>{{ item.transactionDate | date:'dd/MM/yyyy' }}</td>
            <td>CSV</td>
            <td>{{ item.reference }}</td>
            <td>{{ item.description || '-' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="empty-text" *ngIf="unmatchedSystemCount() === 0">Tat ca but toan he thong da duoc khop.</p>
    </div>
  </ng-container>

  <p class="empty-text" *ngIf="!hasVisibleData() && !loading() && !errorMsg()">
    Chon tai khoan va khoang thoi gian, sau do nhan "Doi soat" de bat dau.
  </p>

  <div *ngIf="rejectingRow()" class="modal-reject-reconciliation" (click)="closeRejectModal()">
    <div class="modal-card" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Tu choi doi soat</h3>
        <button type="button" class="close-btn" (click)="closeRejectModal()">&times;</button>
      </div>

      <form class="modal-form" [formGroup]="rejectForm" (ngSubmit)="submitReject()">
        <p class="modal-copy">
          Nhap ly do tu choi cho giao dich <code>{{ rejectingRow()?.reference }}</code>.
        </p>

        <label for="rejectReason">Ly do</label>
        <textarea
          id="rejectReason"
          name="reason"
          formControlName="reason"
          required
          rows="4"
          placeholder="Nhap ly do tu choi doi soat"></textarea>

        <p class="form-error" *ngIf="rejectForm.controls.reason.invalid && rejectForm.controls.reason.touched">
          Ly do la bat buoc.
        </p>

        <div class="modal-actions">
          <button type="button" class="secondary" (click)="closeRejectModal()" [disabled]="rejecting">
            Huy
          </button>
          <button type="submit" class="danger" [disabled]="rejecting">
            {{ rejecting ? 'Dang luu...' : 'Luu' }}
          </button>
        </div>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { padding: 24px 32px 16px; }
    .page-header h2 { margin: 0; font-size: 22px; color: #1e293b; }
    .page-header p { margin: 4px 0 0; color: #64748b; font-size: 13px; }

    .filter-bar {
      display: flex;
      gap: 16px;
      align-items: flex-end;
      padding: 0 32px 16px;
      flex-wrap: wrap;
    }
    .filter-label {
      display: flex;
      flex-direction: column;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      gap: 4px;
    }
    .filter-label select,
    .filter-label input,
    .modal-form textarea {
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      min-width: 180px;
      font: inherit;
    }
    .primary,
    .secondary,
    .danger {
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      padding: 10px 18px;
    }
    .primary { background: #2563eb; color: #fff; }
    .primary:hover { background: #1d4ed8; }
    .primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .secondary { background: #e2e8f0; color: #1e293b; }
    .secondary:hover { background: #cbd5e1; }
    .secondary:disabled,
    .danger:disabled { opacity: 0.7; cursor: not-allowed; }
    .danger { background: #dc2626; color: #fff; }
    .danger:hover { background: #b91c1c; }
    .import-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }
    .file-input {
      width: 1px;
      height: 1px;
      opacity: 0;
      overflow: hidden;
      position: absolute;
      pointer-events: none;
    }

    .error {
      color: #ef4444;
      font-size: 13px;
      padding: 0 32px;
      margin: 0 0 12px;
    }
    .notification {
      margin: 0 32px 16px;
      padding: 12px 16px;
      border-radius: 10px;
      background: #166534;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
    }
    .notification.error { background: #dc2626; }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 0 32px 24px;
    }
    .summary-card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    .summary-card.matched { border-left: 4px solid #10b981; }
    .summary-card.unmatched-bank { border-left: 4px solid #f59e0b; }
    .summary-card.unmatched-system { border-left: 4px solid #ef4444; }
    .summary-card.variance { border-left: 4px solid #6366f1; }
    .card-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .card-count { font-size: 13px; color: #475569; margin-bottom: 4px; }
    .card-amount { font-size: 20px; font-weight: 700; color: #1e293b; }

    .section { padding: 0 32px 24px; }
    .section-title { margin: 0 0 12px; font-size: 16px; padding: 10px 16px; border-radius: 8px; }
    .matched-title { background: #f0fdf4; color: #166534; border-left: 4px solid #10b981; }
    .unmatched-bank-title { background: #fffbeb; color: #92400e; border-left: 4px solid #f59e0b; }
    .unmatched-system-title { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; }

    .data {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    .data th {
      background: #f8fafc;
      text-align: left;
      padding: 10px 12px;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .data td {
      padding: 10px 12px;
      border-top: 1px solid #f1f5f9;
      font-size: 13px;
      vertical-align: top;
    }
    .data code { font-size: 12px; color: #2563eb; }
    .right { text-align: right; }
    .muted { color: #94a3b8; font-size: 12px; }

    .row-matched { background: #f0fdf4; }
    .row-matched:hover { background: #dcfce7; }
    .row-unmatched-bank { background: #fffbeb; }
    .row-unmatched-bank:hover { background: #fef3c7; }
    .row-unmatched-system { background: #fef2f2; }
    .row-unmatched-system:hover { background: #fee2e2; }
    .matched-item { box-shadow: inset 4px 0 0 #10b981; }
    .unmatched-item { box-shadow: inset 4px 0 0 #f59e0b; }

    .danger-link {
      border: none;
      background: transparent;
      color: #b91c1c;
      cursor: pointer;
      font-weight: 700;
      padding: 0;
    }
    .danger-link:hover { text-decoration: underline; }

    .amount-green { color: #10b981; }
    .amount-red { color: #ef4444; }
    .empty-text { text-align: center; color: #94a3b8; padding: 32px; font-size: 14px; }

    .modal-reject-reconciliation {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.48);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 1100;
    }
    .modal-card {
      width: 460px;
      max-width: 100%;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
      overflow: hidden;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
    .close-btn {
      border: none;
      background: transparent;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      color: #64748b;
    }
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px;
    }
    .modal-copy {
      margin: 0;
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
    }
    .modal-form label {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    .modal-form textarea {
      width: 100%;
      resize: vertical;
      min-height: 120px;
    }
    .modal-form textarea:focus {
      outline: 2px solid rgba(37, 99, 235, 0.16);
      border-color: #2563eb;
    }
    .form-error {
      margin: 0;
      font-size: 12px;
      color: #dc2626;
      font-weight: 700;
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `],
})
export class BankReconciliationComponent implements OnInit {
  private readonly apiUrl = `${environment.apiBase}/financial-control`;
  private readonly http = inject(HttpClient);
  private readonly financialService = inject(FinancialControlService);
  private readonly walletService = inject(WalletService);
  private readonly formBuilder = inject(FormBuilder);

  bankAccounts = signal<BankAccount[]>([]);
  result = signal<ReconciliationResult | null>(null);
  loading = signal(false);
  errorMsg = signal('');
  notification = signal('');
  notificationType = signal<'success' | 'error'>('success');
  importedRows = signal<ImportedRow[]>([]);
  rejectingRow = signal<ImportedRow | null>(null);

  selectedBankAccountId = '';
  fromDate = '';
  toDate = '';
  rejecting = false;

  rejectForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required]],
  });

  ngOnInit(): void {
    void this.loadBankAccounts();
  }

  async loadBankAccounts(): Promise<void> {
    try {
      const accounts = await this.financialService.getBankAccounts();
      this.bankAccounts.set(accounts);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
      this.showNotification('Khong the tai danh sach tai khoan ngan hang.', 'error');
    }
  }

  async runReconciliation(): Promise<void> {
    if (!this.selectedBankAccountId) {
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    try {
      let params = new HttpParams().set('bankAccountId', this.selectedBankAccountId);
      if (this.fromDate) {
        params = params.set('fromDate', this.fromDate);
      }
      if (this.toDate) {
        params = params.set('toDate', this.toDate);
      }

      const data = await firstValueFrom(
        this.http.get<ReconciliationResult>(`${this.apiUrl}/bank-reconciliation`, { params }),
      );
      this.result.set(data);
      this.showNotification('Da tai du lieu doi soat ngan hang.');
    } catch (error: any) {
      this.errorMsg.set(error?.error?.message || 'Loi khi thuc hien doi soat. Vui long thu lai.');
      console.error('Reconciliation error:', error);
    } finally {
      this.loading.set(false);
    }
  }

  triggerCsvInput(input: HTMLInputElement): void {
    input.click();
  }

  async onCsvSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const csvText = await file.text();
      const parsedRows = this.parseCsv(csvText);
      const pendingTopUps = await this.walletService.getPendingTopUps().catch(() => []);

      const normalizedRows = parsedRows.map((row, index) => {
        const matchedPending = pendingTopUps.find(
          (item: any) => String(item?.transactionRef || '') === row.reference,
        );

        return {
          ...row,
          id: `${row.reference}-${index}-${Date.now()}`,
          pendingTopUpId: matchedPending?._id ? String(matchedPending._id) : undefined,
        };
      });

      this.importedRows.set(normalizedRows);
      this.showNotification(`Da import ${normalizedRows.length} giao dich gia lap.`);
    } catch (error) {
      console.error('CSV import error:', error);
      this.showNotification('Khong the xu ly file CSV vua import.', 'error');
    } finally {
      if (input) {
        input.value = '';
      }
    }
  }

  importedMatchedRows(): ImportedRow[] {
    return this.importedRows().filter((row) => row.rowType === 'MATCHED');
  }

  importedUnmatchedBankRows(): ImportedRow[] {
    return this.importedRows().filter((row) => row.rowType === 'UNMATCHED_BANK');
  }

  importedUnmatchedSystemRows(): ImportedRow[] {
    return this.importedRows().filter((row) => row.rowType === 'UNMATCHED_SYSTEM');
  }

  matchedCount(): number {
    return (this.result()?.matched.length || 0) + this.importedMatchedRows().length;
  }

  matchedAmount(): number {
    const baseAmount = this.result()?.summary.matchedAmount || 0;
    const importedAmount = this.importedMatchedRows().reduce((sum, row) => sum + row.amount, 0);
    return baseAmount + importedAmount;
  }

  unmatchedBankCount(): number {
    return (this.result()?.unmatchedBank.length || 0) + this.importedUnmatchedBankRows().length;
  }

  unmatchedBankAmount(): number {
    const baseAmount = this.result()?.summary.unmatchedBankAmount || 0;
    const importedAmount = this.importedUnmatchedBankRows().reduce((sum, row) => sum + row.amount, 0);
    return baseAmount + importedAmount;
  }

  unmatchedSystemCount(): number {
    return (this.result()?.unmatchedSystem.length || 0) + this.importedUnmatchedSystemRows().length;
  }

  unmatchedSystemAmount(): number {
    const baseAmount = this.result()?.summary.unmatchedSystemAmount || 0;
    const importedAmount = this.importedUnmatchedSystemRows().reduce((sum, row) => sum + row.amount, 0);
    return baseAmount + importedAmount;
  }

  varianceAmount(): number {
    return this.unmatchedBankAmount() - this.unmatchedSystemAmount();
  }

  hasVisibleData(): boolean {
    return !!this.result() || this.importedRows().length > 0;
  }

  openRejectModal(item: ImportedRow): void {
    this.rejectingRow.set(item);
    this.rejectForm.reset({ reason: '' });
    this.rejectForm.markAsPristine();
    this.rejectForm.markAsUntouched();
  }

  closeRejectModal(): void {
    this.rejectingRow.set(null);
    this.rejectForm.reset({ reason: '' });
    this.rejecting = false;
  }

  async submitReject(): Promise<void> {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      this.showNotification('Ly do la bat buoc.', 'error');
      return;
    }

    const currentRow = this.rejectingRow();
    if (!currentRow) {
      return;
    }

    this.rejecting = true;
    const reason = this.rejectForm.getRawValue().reason.trim();

    try {
      if (currentRow.pendingTopUpId) {
        await this.walletService.rejectTopUp(currentRow.pendingTopUpId, reason);
      }

      this.importedRows.set(
        this.importedRows().filter((row) => row.id !== currentRow.id),
      );
      this.showNotification('Da tu choi doi soat thanh cong.');
      this.closeRejectModal();
    } catch (error) {
      console.error('Reject reconciliation error:', error);
      this.showNotification('Khong the tu choi doi soat giao dich nay.', 'error');
      this.rejecting = false;
    }
  }

  private parseCsv(csvText: string): ImportedRow[] {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new Error('CSV file has no data rows.');
    }

    const headers = this.splitCsvLine(lines[0]).map((value) => value.trim());
    const rows = lines.slice(1).map((line) => {
      const values = this.splitCsvLine(line);
      const record = headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = (values[index] || '').trim();
        return acc;
      }, {});

      const rowType = (record['rowType'] || '').trim().toUpperCase() as ImportedRowType;
      if (!['MATCHED', 'UNMATCHED_BANK', 'UNMATCHED_SYSTEM'].includes(rowType)) {
        throw new Error(`Unsupported rowType: ${record['rowType']}`);
      }

      const amount = Number(record['amount'] || 0);
      if (!Number.isFinite(amount)) {
        throw new Error(`Invalid amount: ${record['amount']}`);
      }

      return {
        id: '',
        rowType,
        reference: record['reference'] || `CSV-${Date.now()}`,
        amount,
        transactionDate: record['transactionDate'] || new Date().toISOString(),
        description: record['description'] || '',
      };
    });

    return rows;
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
        continue;
      }

      if (char === ',' && !insideQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  }

  private showNotification(message: string, type: 'success' | 'error' = 'success'): void {
    this.notification.set(message);
    this.notificationType.set(type);
    setTimeout(() => this.notification.set(''), 3500);
  }
}
