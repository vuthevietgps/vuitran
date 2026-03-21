import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { WalletItem, LedgerItem, WalletService } from '../services/wallet.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

import { FlowGuideComponent } from './shared/flow-guide.component';

interface BankAccountOption {
  _id: string;
  bankName: string;
  accountNumber: string;
  currentBalance: number;
}

@Component({
  selector: 'app-wallets',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Ví</h2>
      <p>Quản lý ví học sinh, nạp tiền, chuyển tiền, lịch sử giao dịch.</p>
    </div>
    <div class="header-actions">
      <button class="primary" (click)="openTopUp()" *ngIf="canManage()">+ Nạp tiền</button>
      <button class="secondary" (click)="openTransfer()" *ngIf="canTransfer()">↔ Chuyển tiền</button>
      <button class="ghost" (click)="openPending()" *ngIf="canApprove()">⏳ Chờ duyệt ({{pendingCount()}})</button>
    </div>
  </header>

  <app-flow-guide featureKey="wallets"></app-flow-guide>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button [class.active]="activeTab === 'wallets'" (click)="activeTab = 'wallets'" *ngIf="canManage()">💰 Danh sách ví</button>
    <button [class.active]="activeTab === 'ledger'" (click)="activeTab = 'ledger'; loadLedger()">📋 Lịch sử giao dịch</button>
    <button [class.active]="activeTab === 'myWallet'" (click)="activeTab = 'myWallet'; loadMyWallet()" *ngIf="isParent()">🏦 Ví của tôi</button>
  </div>

  <!-- Wallets list -->
  <div *ngIf="activeTab === 'wallets' && canManage()">
    <table class="data" *ngIf="wallets().length; else emptyWallets">
      <thead>
        <tr>
          <th>Người dùng</th>
          <th>Email</th>
          <th>Vai trò</th>
          <th>Nhom ads</th>
          <th>Số dư</th>
          <th>Tổng nạp</th>
          <th>Tổng trừ</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let w of wallets()">
          <td>{{w.userId.fullName || '—'}}</td>
          <td>{{w.userId.email || '—'}}</td>
          <td><span class="chip">{{w.userId.role || '—'}}</span></td>
          <td class="ads-cell">
            <strong>{{walletAdsTitle(w)}}</strong>
            <div class="muted-inline" *ngIf="walletAdsHint(w)">{{walletAdsHint(w)}}</div>
          </td>
          <td class="number" [class.negative]="w.balance < 0">{{formatCurrency(w.balance)}}</td>
          <td class="number positive">{{formatCurrency(w.totalTopUp)}}</td>
          <td class="number negative">{{formatCurrency(w.totalDeducted)}}</td>
          <td>
            <span class="badge" [class.badge-active]="w.status === 'ACTIVE'" [class.badge-frozen]="w.status === 'FROZEN'">
              {{w.status === 'ACTIVE' ? 'Hoạt động' : 'Đóng băng'}}
            </span>
          </td>
          <td class="actions-cell">
            <button class="ghost sm" (click)="viewWalletLedger(w)">📋</button>
            <button class="ghost sm" (click)="topUpForUser(w)" *ngIf="canManage()">💵 Nạp</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyWallets><p class="empty-msg">Chưa có ví nào.</p></ng-template>
  </div>

  <!-- Ledger / transaction history -->
  <div *ngIf="activeTab === 'ledger'">
    <div class="filters">
      <select [(ngModel)]="ledgerFilter.type" (change)="loadLedger()">
        <option value="">Tất cả loại</option>
        <option value="TOP_UP">Nạp tiền</option>
        <option value="SESSION_DEDUCT">Trừ buổi học</option>
        <option value="TEACHER_PAYOUT">Trả lương GV</option>
        <option value="REFUND">Hoàn tiền</option>
        <option value="ADJUSTMENT">Điều chỉnh</option>
        <option value="TRANSFER_OUT">Chuyển đi</option>
        <option value="TRANSFER_IN">Nhận chuyển</option>
      </select>
      <input type="date" [(ngModel)]="ledgerFilter.fromDate" (change)="loadLedger()" />
      <input type="date" [(ngModel)]="ledgerFilter.toDate" (change)="loadLedger()" />
    </div>
    <table class="data" *ngIf="ledgerEntries().length; else emptyLedger">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Loại GD</th>
          <th>Số tiền</th>
          <th>Trước GD</th>
          <th>Sau GD</th>
          <th>Mô tả</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let e of ledgerEntries()">
          <td>{{e.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
          <td><span class="chip" [class]="'chip-' + e.type.toLowerCase()">{{typeLabel(e.type)}}</span></td>
          <td class="number" [class.positive]="isCredit(e.type)" [class.negative]="!isCredit(e.type)">
            {{isCredit(e.type) ? '+' : '-'}}{{formatCurrency(e.amount)}}
          </td>
          <td class="number">{{formatCurrency(e.balanceBefore)}}</td>
          <td class="number">{{formatCurrency(e.balanceAfter)}}</td>
          <td>{{e.description || '—'}}</td>
          <td><span class="badge badge-active">{{e.status}}</span></td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyLedger><p class="empty-msg">Không có giao dịch nào.</p></ng-template>
  </div>

  <!-- My wallet (for PARENT role) -->
  <div *ngIf="activeTab === 'myWallet' && isParent()">
    <div class="my-wallet-card" *ngIf="myWallet()">
      <div class="wallet-balance">
        <span class="balance-label">Số dư hiện tại</span>
        <span class="balance-value">{{formatCurrency(myWallet()!.balance)}}</span>
      </div>
      <div class="wallet-stats">
        <div><span>Tổng nạp:</span><span class="positive">{{formatCurrency(myWallet()!.totalTopUp)}}</span></div>
        <div><span>Tổng trừ:</span><span class="negative">{{formatCurrency(myWallet()!.totalDeducted)}}</span></div>
        <div><span>Hoàn tiền:</span><span>{{formatCurrency(myWallet()!.totalRefunded)}}</span></div>
      </div>
      <div style="text-align:center;margin-top:18px">
        <button class="primary" (click)="openParentTopUp()">💳 Nạp tiền vào ví</button>
      </div>
    </div>
    <h4 style="margin-top:20px">Lịch sử giao dịch</h4>
    <table class="data" *ngIf="myLedger().length; else emptyMyLedger">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Loại GD</th>
          <th>Số tiền</th>
          <th>Số dư sau</th>
          <th>Mô tả</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let e of myLedger()">
          <td>{{e.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
          <td><span class="chip" [class]="'chip-' + e.type.toLowerCase()">{{typeLabel(e.type)}}</span></td>
          <td class="number" [class.positive]="isCredit(e.type)" [class.negative]="!isCredit(e.type)">
            {{isCredit(e.type) ? '+' : '-'}}{{formatCurrency(e.amount)}}
          </td>
          <td class="number">{{formatCurrency(e.balanceAfter)}}</td>
          <td>{{e.description || '—'}}</td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyMyLedger><p class="empty-msg">Chưa có giao dịch.</p></ng-template>
  </div>

  <!-- Top-Up modal -->
  <div class="modal-backdrop" *ngIf="showTopUpModal()">
    <div class="modal">
      <h3>Nạp tiền vào ví</h3>
      <form (ngSubmit)="submitTopUp()">
        <label>User ID
          <input [(ngModel)]="topUpForm.userId" name="userId" required [readonly]="!!topUpForm.userId" />
        </label>
        <label>Số tiền (VNĐ)
          <input type="number" [(ngModel)]="topUpForm.amount" name="amount" required min="1000" step="10000" />
        </label>
        <label>Phương thức thanh toán
          <select [(ngModel)]="topUpForm.paymentMethod" name="paymentMethod" required>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
            <option value="CASH">Tiền mặt</option>
            <option value="MOMO">MoMo</option>
          </select>
        </label>
        <ng-container *ngIf="topUpForm.paymentMethod === 'BANK_TRANSFER'">
          <label>Ma giao dich / noi dung chuyen khoan
            <input [(ngModel)]="topUpForm.transactionRef" name="transactionRef" placeholder="VD: FT123456789" />
          </label>
          <label>Anh bien lai (URL hoac /uploads/...)
            <input [(ngModel)]="topUpForm.receiptImageUrl" name="receiptImageUrl" required />
          </label>
        </ng-container>
        <label>Ghi chú
          <textarea [(ngModel)]="topUpForm.description" name="description" rows="2"></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="ghost" (click)="showTopUpModal.set(false)">Hủy</button>
          <button type="submit" class="primary">Nạp tiền</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Transfer modal -->
  <div class="modal-backdrop" *ngIf="showTransferModal()">
    <div class="modal">
      <h3>Chuyển tiền giữa ví</h3>
      <p class="hint">Không phí. Chuyển trực tiếp từ ví này sang ví khác.</p>
      <form (ngSubmit)="submitTransfer()">
        <label>Ví nguồn (User ID)
          <input [(ngModel)]="transferForm.fromUserId" name="fromUserId" required />
        </label>
        <label>Ví đích (User ID)
          <input [(ngModel)]="transferForm.toUserId" name="toUserId" required />
        </label>
        <label>Số tiền (VNĐ)
          <input type="number" [(ngModel)]="transferForm.amount" name="amount" required min="1000" step="10000" />
        </label>
        <label>Mô tả
          <textarea [(ngModel)]="transferForm.description" name="description" rows="2"></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="ghost" (click)="showTransferModal.set(false)">Hủy</button>
          <button type="submit" class="primary">Chuyển tiền</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Pending top-ups modal -->
  <div class="modal-backdrop" *ngIf="showPendingModal()">
    <div class="modal modal-lg">
      <h3>Yêu cầu nạp tiền chờ duyệt</h3>
      <div *ngIf="pendingTopUps().length; else noPending">
        <div class="pending-item" *ngFor="let p of pendingTopUps()">
          <div class="pending-info">
            <strong>{{p.userId?.fullName || p.userId}}</strong>
            <span class="amount">{{formatCurrency(p.amount)}}</span>
            <small>{{p.paymentMethod}} · {{p.createdAt | date:'dd/MM HH:mm'}}</small>
            <small *ngIf="p.transactionRef">Ref: {{p.transactionRef}}</small>
            <a *ngIf="p.receiptImageUrl" [href]="resolveAssetUrl(p.receiptImageUrl)" target="_blank" rel="noopener">
              Xem anh bien lai
            </a>
          </div>
          <div class="pending-actions">
            <button class="primary sm" (click)="openApproveModal(p)">✅ Duyệt</button>
            <button class="danger sm" (click)="reject(p._id)">❌ Từ chối</button>
          </div>
        </div>
      </div>
      <ng-template #noPending><p class="empty-msg">Không có yêu cầu nào.</p></ng-template>
      <div class="modal-actions">
        <button class="ghost" (click)="showPendingModal.set(false)">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Parent Top-Up Request modal -->
  <div class="modal-backdrop" *ngIf="showParentTopUpModal()">
    <div class="modal">
      <h3>💳 Nạp tiền vào ví</h3>
      <p class="hint">Điền thông tin và đính kèm ảnh chứng từ. Yêu cầu sẽ được kế toán duyệt trong thời gian sớm nhất.</p>
      <form (ngSubmit)="submitParentTopUp()">
        <label>Số tiền nạp (VNĐ)
          <input type="number" [(ngModel)]="parentTopUpForm.amount" name="amount" required min="10000" step="10000" placeholder="VD: 500000" />
        </label>
        <label>Phương thức thanh toán
          <select [(ngModel)]="parentTopUpForm.paymentMethod" name="paymentMethod" required>
            <option value="BANK_TRANSFER">Chuyển khoản ngân hàng</option>
            <option value="CASH">Tiền mặt</option>
            <option value="MOMO">MoMo</option>
          </select>
        </label>
        <label>Ảnh chứng từ / biên lai {{parentTopUpForm.paymentMethod === 'BANK_TRANSFER' ? '(bắt buộc)' : '(tuỳ chọn)'}}
          <input type="file" accept="image/*" (change)="handleParentReceiptUpload($event)" name="receiptFile" />
        </label>
        <div *ngIf="parentUploadingReceipt()" class="hint">Đang tải ảnh lên...</div>
        <div *ngIf="parentTopUpForm.receiptImageUrl && !parentUploadingReceipt()" style="margin:6px 0">
          <img [src]="resolveAssetUrl(parentTopUpForm.receiptImageUrl)" style="max-width:100%;max-height:160px;border-radius:6px;border:1px solid #e2e8f0" />
        </div>
        <label>Mã giao dịch / nội dung chuyển khoản (tuỳ chọn)
          <input [(ngModel)]="parentTopUpForm.transactionRef" name="transactionRef" placeholder="VD: FT123456789" />
        </label>
        <label>Ghi chú
          <textarea [(ngModel)]="parentTopUpForm.description" name="description" rows="2" placeholder="Ghi chú (tuỳ chọn)"></textarea>
        </label>
        <div class="modal-actions">
          <button type="button" class="ghost" (click)="showParentTopUpModal.set(false)">Hủy</button>
          <button type="submit" class="primary" [disabled]="parentUploadingReceipt()">Gửi yêu cầu</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Approve top-up modal -->
  <div class="modal-backdrop" *ngIf="showApproveModal()">
    <div class="modal">
      <h3>Duyệt yêu cầu nạp tiền</h3>
      <ng-container *ngIf="selectedPendingTopUp() as selected">
        <p class="hint">
          {{selected.userId?.fullName || selected.userId}} · {{formatCurrency(selected.amount)}} · {{selected.paymentMethod}}
        </p>

        <label *ngIf="selected.paymentMethod === 'BANK_TRANSFER'">Mã sao kê / mã biến động
          <input [(ngModel)]="approveForm.bankStatementRef" name="bankStatementRef" placeholder="VD: MBVCB123456" />
        </label>

        <label *ngIf="selected.paymentMethod === 'BANK_TRANSFER'">Tài khoản ngân hàng đối soát
          <select [(ngModel)]="approveForm.bankAccountId" name="bankAccountId">
            <option value="">-- Chọn tài khoản --</option>
            <option *ngFor="let ba of bankAccounts()" [value]="ba._id">
              {{ba.bankName}} - {{ba.accountNumber}} ({{formatCurrency(ba.currentBalance)}})
            </option>
          </select>
        </label>
        <p class="hint" *ngIf="selected.paymentMethod === 'BANK_TRANSFER' && !bankAccounts().length">
          Chưa có tài khoản ngân hàng nào để đối soát.
        </p>

        <label>Ghi chú kế toán
          <textarea [(ngModel)]="approveForm.accountingNotes" name="accountingNotes" rows="3"></textarea>
        </label>

        <div class="modal-actions">
          <button type="button" class="ghost" (click)="closeApproveModal()">Hủy</button>
          <button type="button" class="primary" (click)="submitApprove()">Xác nhận duyệt</button>
        </div>
      </ng-container>
    </div>
  </div>
  `,
  styles: [`
    :host { display:block; padding:24px; font-family:'Segoe UI',sans-serif; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; flex-wrap:wrap; gap:10px; }
    .page-header h2 { margin:0; color:#1e293b; }
    .page-header p { margin:4px 0 0; color:#64748b; font-size:13px; }
    .header-actions { display:flex; gap:8px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600; }
    .primary:hover { background:#1d4ed8; }
    .primary.sm { padding:6px 12px; font-size:12px; }
    .secondary { background:#7c3aed; color:#fff; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600; }
    .secondary:hover { background:#6d28d9; }
    .ghost { background:none; border:1px solid #cbd5e1; color:#334155; padding:10px 16px; border-radius:6px; cursor:pointer; }
    .ghost:hover { background:#f1f5f9; }
    .ghost.sm { padding:4px 8px; font-size:12px; }
    .danger { background:#dc2626; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; }
    .danger:hover { background:#b91c1c; }
    .danger.sm { padding:6px 12px; font-size:12px; }

    .tab-bar { display:flex; gap:6px; margin-bottom:18px; }
    .tab-bar button { background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 18px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; }
    .tab-bar button.active { background:#2563eb; color:#fff; border-color:#2563eb; }

    .filters { display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
    .filters select, .filters input { padding:7px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; background:#fff; }

    .data { width:100%; border-collapse:separate; border-spacing:0; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .data th { text-align:left; background:#f1f5f9; padding:10px 12px; font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:.5px; }
    .data td { padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:13px; }
    .data tr:last-child td { border-bottom:none; }
    .data tr:hover td { background:#f8fafc; }

    .number { font-family:'Cascadia Code','Consolas',monospace; text-align:right; }
    .positive { color:#16a34a; }
    .negative { color:#dc2626; }

    .actions-cell { white-space:nowrap; }
    .actions-cell button { margin-right:4px; }
    .ads-cell strong { display:block; color:#1e293b; }
    .muted-inline { color:#64748b; font-size:12px; margin-top:2px; }

    .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600; }
    .badge-active { background:#dcfce7; color:#166534; }
    .badge-frozen { background:#fee2e2; color:#991b1b; }

    .chip { display:inline-block; padding:2px 8px; background:#f1f5f9; border-radius:4px; font-size:11px; color:#475569; }
    .chip-top_up { background:#dbeafe; color:#1d4ed8; }
    .chip-session_deduct { background:#fef3c7; color:#92400e; }
    .chip-teacher_payout { background:#fce7f3; color:#9d174d; }
    .chip-refund { background:#dcfce7; color:#166534; }
    .chip-adjustment { background:#e2e8f0; color:#334155; }
    .chip-transfer_out { background:#fed7aa; color:#9a3412; }
    .chip-transfer_in { background:#bbf7d0; color:#166534; }

    .my-wallet-card { background:#fff; border-radius:12px; padding:28px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
    .wallet-balance { text-align:center; margin-bottom:20px; }
    .balance-label { display:block; font-size:13px; color:#64748b; margin-bottom:4px; }
    .balance-value { font-size:32px; font-weight:700; color:#1e293b; }
    .wallet-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
    .wallet-stats > div { text-align:center; }
    .wallet-stats span:first-child { display:block; font-size:12px; color:#64748b; margin-bottom:2px; }

    .pending-item { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #f1f5f9; }
    .pending-info { display:flex; flex-direction:column; gap:2px; }
    .pending-info .amount { font-size:16px; font-weight:600; color:#1e293b; }
    .pending-actions { display:flex; gap:6px; }

    .empty-msg { color:#64748b; padding:32px 0; text-align:center; }
    .hint { color:#64748b; font-size:12px; font-style:italic; margin-bottom:12px; }

    .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.45); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; border-radius:12px; padding:28px; width:500px; max-height:85vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .modal-lg { width:600px; }
    .modal h3 { margin:0 0 16px; color:#1e293b; }
    .modal label { display:block; margin-bottom:10px; font-size:13px; font-weight:500; color:#334155; }
    .modal input, .modal select, .modal textarea { width:100%; margin-top:4px; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; box-sizing:border-box; }
    .modal textarea { resize:vertical; }
    .modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:18px; }
  `]
})
export class WalletsComponent implements OnInit {
  private walletSvc = new WalletService();
  private http = inject(HttpClient);
  private auth: AuthService;
  private readonly apiBase = environment.apiBase;

  wallets = signal<WalletItem[]>([]);
  ledgerEntries = signal<LedgerItem[]>([]);
  myWallet = signal<WalletItem | null>(null);
  myLedger = signal<LedgerItem[]>([]);
  bankAccounts = signal<BankAccountOption[]>([]);
  pendingTopUps = signal<any[]>([]);
  selectedPendingTopUp = signal<any | null>(null);
  pendingCount = signal(0);

  showTopUpModal = signal(false);
  showTransferModal = signal(false);
  showPendingModal = signal(false);
  showApproveModal = signal(false);
  showParentTopUpModal = signal(false);
  parentUploadingReceipt = signal(false);

  activeTab: 'wallets' | 'ledger' | 'myWallet' = 'wallets';

  ledgerFilter: any = { type: '', fromDate: '', toDate: '' };

  topUpForm = {
    userId: '',
    amount: 0,
    paymentMethod: 'BANK_TRANSFER',
    transactionRef: '',
    receiptImageUrl: '',
    description: '',
  };
  parentTopUpForm = {
    amount: 0,
    paymentMethod: 'BANK_TRANSFER',
    transactionRef: '',
    receiptImageUrl: '',
    description: '',
  };
  transferForm = { fromUserId: '', toUserId: '', amount: 0, description: '' };
  approveForm = { bankStatementRef: '', accountingNotes: '', bankAccountId: '' };

  constructor(auth: AuthService) {
    this.auth = auth;
  }

  ngOnInit(): void {
    if (this.isParent()) {
      this.activeTab = 'myWallet';
      this.loadMyWallet();
    } else {
      this.loadWallets();
      this.loadPendingCount();
    }
  }

  async loadWallets(): Promise<void> {
    const res = await this.walletSvc.getAllWallets(1, 100);
    this.wallets.set(res.data || []);
  }

  async loadLedger(): Promise<void> {
    const params: any = {};
    if (this.ledgerFilter.type) params.type = this.ledgerFilter.type;
    if (this.ledgerFilter.fromDate) params.fromDate = this.ledgerFilter.fromDate;
    if (this.ledgerFilter.toDate) params.toDate = this.ledgerFilter.toDate;

    if (this.isParent()) {
      const res = await this.walletSvc.getMyLedger(params);
      this.myLedger.set(res.data || []);
    } else {
      const res = await this.walletSvc.queryLedger(params);
      this.ledgerEntries.set(res.data || []);
    }
  }

  async loadMyWallet(): Promise<void> {
    const w = await this.walletSvc.getMyWallet();
    this.myWallet.set(w);
    const res = await this.walletSvc.getMyLedger();
    this.myLedger.set(res.data || []);
  }

  async loadPendingCount(): Promise<void> {
    const items = await this.walletSvc.getPendingTopUps();
    this.pendingCount.set(items.length);
  }

  async loadBankAccounts(): Promise<void> {
    if (!this.canApprove()) return;
    try {
      const accounts = await firstValueFrom(
        this.http.get<BankAccountOption[]>(`${this.apiBase}/financial-control/bank-accounts`, {
          withCredentials: true,
        }),
      );
      this.bankAccounts.set(accounts || []);
    } catch (err) {
      console.error('Error loading bank accounts for approval:', err);
      this.bankAccounts.set([]);
    }
  }

  // Top-up
  openTopUp(): void {
    this.topUpForm = {
      userId: '',
      amount: 0,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: '',
      receiptImageUrl: '',
      description: '',
    };
    this.showTopUpModal.set(true);
  }

  topUpForUser(w: WalletItem): void {
    this.topUpForm = {
      userId: w.userId?._id || '',
      amount: 0,
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: '',
      receiptImageUrl: '',
      description: '',
    };
    this.showTopUpModal.set(true);
  }

  async submitTopUp(): Promise<void> {
    if (
      this.topUpForm.paymentMethod === 'BANK_TRANSFER' &&
      !this.topUpForm.receiptImageUrl.trim()
    ) {
      alert('Chuyen khoan bat buoc nhap anh bien lai.');
      return;
    }

    const ok = await this.walletSvc.requestTopUp({
      userId: this.topUpForm.userId,
      amount: this.topUpForm.amount,
      paymentMethod: this.topUpForm.paymentMethod,
      transactionRef: this.topUpForm.transactionRef || undefined,
      receiptImageUrl: this.topUpForm.receiptImageUrl || undefined,
      description: this.topUpForm.description,
    });
    if (ok) {
      this.showTopUpModal.set(false);
      this.loadWallets();
      alert('Yeu cau nap tien da duoc tao.');
    } else {
      alert('Loi khi tao yeu cau nap tien.');
    }
  }

  // Transfer
  openTransfer(): void {
    if (!this.canTransfer()) return;
    this.transferForm = { fromUserId: '', toUserId: '', amount: 0, description: '' };
    this.showTransferModal.set(true);
  }

  async submitTransfer(): Promise<void> {
    if (!this.canTransfer()) return;
    const ok = await this.walletSvc.transfer(
      this.transferForm.fromUserId,
      this.transferForm.toUserId,
      this.transferForm.amount,
      this.transferForm.description,
    );
    if (ok) {
      this.showTransferModal.set(false);
      this.loadWallets();
      alert('Chuyển tiền thành công!');
    } else {
      alert('Lỗi khi chuyển tiền.');
    }
  }

  // Pending
  async openPending(): Promise<void> {
    const items = await this.walletSvc.getPendingTopUps();
    this.pendingTopUps.set(items);
    this.pendingCount.set(items.length);
    await this.loadBankAccounts();
    this.showPendingModal.set(true);
  }

  async openApproveModal(item: any): Promise<void> {
    const isBankTransfer = item?.paymentMethod === 'BANK_TRANSFER';
    if (isBankTransfer && !item?.receiptImageUrl) {
      alert('Yeu cau chuyen khoan thieu anh bien lai, khong the duyet.');
      return;
    }

    this.selectedPendingTopUp.set(item);
    this.approveForm = {
      bankStatementRef: item?.transactionRef || '',
      accountingNotes: '',
      bankAccountId: '',
    };
    if (isBankTransfer && !this.bankAccounts().length) {
      await this.loadBankAccounts();
    }
    this.showApproveModal.set(true);
  }

  closeApproveModal(): void {
    this.showApproveModal.set(false);
    this.selectedPendingTopUp.set(null);
    this.approveForm = { bankStatementRef: '', accountingNotes: '', bankAccountId: '' };
  }

  async submitApprove(): Promise<void> {
    const item = this.selectedPendingTopUp();
    if (!item) return;

    const isBankTransfer = item?.paymentMethod === 'BANK_TRANSFER';
    if (isBankTransfer && !item?.receiptImageUrl) {
      alert('Yeu cau chuyen khoan thieu anh bien lai, khong the duyet.');
      return;
    }
    if (isBankTransfer && !this.approveForm.bankAccountId) {
      alert('Vui long chon tai khoan ngan hang doi soat.');
      return;
    }

    const ok = await this.walletSvc.approveTopUp(item._id, {
      accountingNotes: this.approveForm.accountingNotes.trim() || undefined,
      bankMatched: isBankTransfer ? true : undefined,
      bankStatementRef: this.approveForm.bankStatementRef.trim() || undefined,
      bankAccountId: this.approveForm.bankAccountId || undefined,
    });

    if (ok) {
      this.closeApproveModal();
      await this.openPending();
      await this.loadWallets();
    } else {
      alert('Loi duyet');
    }
  }

  async reject(id: string): Promise<void> {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    const ok = await this.walletSvc.rejectTopUp(id, reason);
    if (ok) {
      await this.openPending();
    } else {
      alert('Lỗi từ chối');
    }
  }

  viewWalletLedger(w: WalletItem): void {
    this.activeTab = 'ledger';
    this.loadLedger();
  }

  // Parent Top-Up
  openParentTopUp(): void {
    this.parentTopUpForm = { amount: 0, paymentMethod: 'BANK_TRANSFER', transactionRef: '', receiptImageUrl: '', description: '' };
    this.showParentTopUpModal.set(true);
  }

  async handleParentReceiptUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.parentUploadingReceipt.set(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${this.apiBase}/wallets/top-up/upload-receipt`, formData, { withCredentials: true }),
      );
      this.parentTopUpForm.receiptImageUrl = res.url;
    } catch (err) {
      alert('Tải ảnh thất bại. Vui lòng thử lại.');
    } finally {
      this.parentUploadingReceipt.set(false);
    }
  }

  async submitParentTopUp(): Promise<void> {
    if (this.parentTopUpForm.amount < 10000) {
      alert('Số tiền nạp tối thiểu 10,000đ');
      return;
    }
    if (this.parentTopUpForm.paymentMethod === 'BANK_TRANSFER' && !this.parentTopUpForm.receiptImageUrl.trim()) {
      alert('Chuyển khoản bắt buộc phải đính kèm ảnh biên lai.');
      return;
    }

    const userId = this.auth.userSignal()?.sub;
    if (!userId) { alert('Không xác định được tài khoản.'); return; }

    try {
      await this.walletSvc.requestTopUp({
        userId,
        amount: this.parentTopUpForm.amount,
        paymentMethod: this.parentTopUpForm.paymentMethod,
        transactionRef: this.parentTopUpForm.transactionRef || undefined,
        receiptImageUrl: this.parentTopUpForm.receiptImageUrl || undefined,
        description: this.parentTopUpForm.description || undefined,
      });
      this.showParentTopUpModal.set(false);
      alert('Yêu cầu nạp tiền đã được gửi. Kế toán sẽ duyệt trong thời gian sớm nhất.');
      await this.loadMyWallet();
    } catch (err: any) {
      alert(err?.error?.message || 'Gửi yêu cầu thất bại. Vui lòng thử lại.');
    }
  }

  // Helpers
  formatCurrency(n: number): string {
    return (n || 0).toLocaleString('vi-VN') + ' ₫';
  }

  resolveAssetUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/')) {
      return url;
    }
    if (url.startsWith('/')) return `${this.apiBase}${url}`;
    return url;
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      'TOP_UP': 'Nạp tiền',
      'SESSION_DEDUCT': 'Trừ buổi học',
      'TEACHER_PAYOUT': 'Trả lương GV',
      'REFUND': 'Hoàn tiền',
      'ADJUSTMENT': 'Điều chỉnh',
      'TRANSFER_OUT': 'Chuyển đi',
      'TRANSFER_IN': 'Nhận chuyển',
    };
    return map[type] || type;
  }

  isCredit(type: string): boolean {
    return ['TOP_UP', 'REFUND', 'TRANSFER_IN', 'ADJUSTMENT_CREDIT'].includes(type);
  }

  walletAdsTitle(wallet: WalletItem): string {
    if (wallet.adGroupName?.trim()) return wallet.adGroupName;
    if (wallet.adGroupId?.trim()) return wallet.adGroupId;
    return this.isParentWallet(wallet) ? 'Chua gan adGroup' : 'Khong ap dung';
  }

  walletAdsHint(wallet: WalletItem): string {
    const parts: string[] = [];
    if (wallet.adPlatform?.trim()) parts.push(wallet.adPlatform);

    const source = this.walletAdsSourceLabel(wallet.adAttributionSource);
    if (source) parts.push(source);

    if (!parts.length && wallet.adGroupId?.trim()) {
      parts.push(wallet.adGroupId);
    }

    return parts.join(' | ');
  }

  walletAdsSourceLabel(source?: WalletItem['adAttributionSource']): string {
    switch (source) {
      case 'PARENT_ATTRIBUTION':
        return 'Attribution';
      case 'STUDENT_FALLBACK':
        return 'Fallback tu hoc sinh';
      case 'UNATTRIBUTED':
        return 'Chua co attribution';
      default:
        return '';
    }
  }

  isParentWallet(wallet: WalletItem): boolean {
    return wallet.userId?.role === 'PARENT';
  }

  canManage(): boolean {
    const r = this.auth.userSignal()?.role;
    return r === 'DIRECTOR' || r === 'ACCOUNTING' || r === 'OPS';
  }

  canApprove(): boolean {
    const r = this.auth.userSignal()?.role;
    return r === 'DIRECTOR' || r === 'ACCOUNTING';
  }

  canTransfer(): boolean {
    const r = this.auth.userSignal()?.role;
    return r === 'DIRECTOR' || r === 'ACCOUNTING';
  }

  isParent(): boolean { return this.auth.userSignal()?.role === 'PARENT'; }
}
