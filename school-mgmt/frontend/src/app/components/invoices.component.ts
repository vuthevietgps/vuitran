import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  INVOICE_COURSE_STATUS_LABELS,
  InvoiceCourseStatus,
  InvoiceItem,
  InvoiceService,
  InvoiceStatus,
  InvoiceUpsertPayload,
} from '../services/invoice.service';
import { StudentItem, StudentService } from '../services/student.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface InvoiceForm {
  invoiceNumber: string;
  courseStatus: InvoiceCourseStatus;
  studentId: string;
  classType: 'ONLINE' | 'OFFLINE' | '';
  saleId: string;
  sessions: number;
  bonusSessions: number;
  paymentRound: number;
  amount: number;
  paymentDate: string;
  description: string;
  receiptImage: string;
}

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
    template: `
  <header class="page-header">
    <div>
      <h2>Qu\u1ea3n l\u00fd h\u00f3a \u0111\u01a1n</h2>
      <p>Theo d\u00f5i thanh to\u00e1n v\u00e0 doanh thu theo lo\u1ea1i l\u1edbp h\u1ecdc.</p>
    </div>
    <button class="primary" (click)="openModal()" *ngIf="activeTab === 'invoices'">+ Th\u00eam h\u00f3a \u0111\u01a1n</button>
  </header>

  <app-flow-guide featureKey="invoices"></app-flow-guide>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button [class.active]="activeTab === 'invoices'" (click)="activeTab = 'invoices'">H\u00f3a \u0111\u01a1n</button>
    <button [class.active]="activeTab === 'topups'" (click)="activeTab = 'topups'; loadPendingTopUps()" *ngIf="canApproveInvoices">
      Y\u00eau c\u1ea7u n\u1ea1p v\u00ed <span *ngIf="pendingTopUps().length" class="badge-count">{{pendingTopUps().length}}</span>
    </button>
  </div>

  <!-- INVOICES TAB -->
  <ng-container *ngIf="activeTab === 'invoices'">

    <!-- Stats cards -->
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">T\u1ed5ng h\u00f3a \u0111\u01a1n</div>
        <div class="stat-value">{{ summary().total }}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">Doanh thu Online</div>
        <div class="stat-value">{{ formatCurrency(summary().onlineAmount) }}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">Doanh thu Offline</div>
        <div class="stat-value">{{ formatCurrency(summary().offlineAmount) }}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">\u0110\u00e3 duy\u1ec7t</div>
        <div class="stat-value">{{ formatCurrency(summary().approvedAmount) }}</div>
      </div>
      <div class="stat-card yellow">
        <div class="stat-label">Ch\u1edd duy\u1ec7t</div>
        <div class="stat-value">{{ summary().pendingCount }} h\u00f3a \u0111\u01a1n</div>
      </div>
    </div>

    <!-- Filters -->
    <section class="filters-section">
      <div class="filter-row">
        <input
          class="filter-input"
          placeholder="T\u00ecm s\u1ed1 h\u00f3a \u0111\u01a1n, t\u00ean h\u1ecdc sinh..."
          [ngModel]="keyword()"
          (ngModelChange)="onKeywordChange($event)"
        />
        <input
          class="filter-input"
          placeholder="T\u00ecm t\u00ean / S\u0110T ph\u1ee5 huynh..."
          [ngModel]="parentFilter()"
          (ngModelChange)="onParentFilterChange($event)"
        />
        <input
          class="filter-input"
          placeholder="T\u00ecm t\u00ean sale..."
          [ngModel]="saleFilter()"
          (ngModelChange)="onSaleFilterChange($event)"
        />
      </div>
      <div class="filter-row">
        <select [ngModel]="classTypeFilter()" (ngModelChange)="onClassTypeFilterChange($event)">
          <option value="">T\u1ea5t c\u1ea3 lo\u1ea1i l\u1edbp</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
        </select>
        <select [ngModel]="statusFilter()" (ngModelChange)="onStatusFilterChange($event)">
          <option value="">T\u1ea5t c\u1ea3 tr\u1ea1ng th\u00e1i</option>
          <option value="PENDING_APPROVAL">Ch\u1edd duy\u1ec7t</option>
          <option value="APPROVED">\u0110\u00e3 duy\u1ec7t</option>
          <option value="REJECTED">T\u1eeb ch\u1ed1i</option>
          <option value="CANCELLED">\u0110\u00e3 h\u1ee7y</option>
        </select>
        <select [ngModel]="courseStatusFilter()" (ngModelChange)="onCourseStatusFilterChange($event)">
          <option value="">T\u1ea5t c\u1ea3 t\u00ecnh tr\u1ea1ng kh\u00f3a h\u1ecdc</option>
          <option *ngFor="let option of courseStatusOptions" [value]="option.value">{{ option.label }}</option>
        </select>
        <label class="date-wrap">
          <span>T\u1eeb ng\u00e0y</span>
          <input type="date" [ngModel]="dateFrom()" (ngModelChange)="onDateFromChange($event)" />
        </label>
        <label class="date-wrap">
          <span>\u0110\u1ebfn ng\u00e0y</span>
          <input type="date" [ngModel]="dateTo()" (ngModelChange)="onDateToChange($event)" />
        </label>
        <button (click)="reload()">L\u00e0m m\u1edbi</button>
        <button class="ghost" (click)="clearFilters()" *ngIf="hasActiveFilters()">X\u00f3a l\u1ecdc</button>
      </div>
    </section>

    <!-- Result count -->
    <div class="result-meta">
      Hi\u1ec3n th\u1ecb <strong>{{ visibleInvoices().length }}</strong> / {{ filtered().length }} h\u00f3a \u0111\u01a1n
      <span class="result-meta-total" *ngIf="items().length !== filtered().length">
        (t\u1ed5ng {{ items().length }})
      </span>
    </div>

    <!-- Table -->
    <p class="lazy-hint" *ngIf="hasMoreInvoices()">Cu\u1ed9n xu\u1ed1ng \u0111\u1ec3 t\u1ea3i th\u00eam h\u00f3a \u0111\u01a1n.</p>
    <div class="table-wrap invoice-table-wrap" (scroll)="onInvoiceTableScroll($event)">
      <table class="data" *ngIf="filtered().length; else empty">
        <thead>
          <tr>
            <th>Ng\u00e0y TT</th>
            <th>S\u1ed1 h\u00f3a \u0111\u01a1n</th>
            <th>H\u1ecdc sinh</th>
            <th>Ph\u1ee5 huynh</th>
            <th>Lo\u1ea1i l\u1edbp</th>
            <th>S\u1ed1 bu\u1ed5i</th>
            <th>L\u1ea7n TT</th>
            <th>T\u1ed5ng ti\u1ec1n</th>
            <th>Sale ph\u1ee5 tr\u00e1ch</th>
            <th>Tr\u1ea1ng th\u00e1i</th>
            <th>Ch\u1ee9ng t\u1eeb</th>
            <th>H\u00e0nh \u0111\u1ed9ng</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let invoice of visibleInvoices()">
            <td>{{ formatDate(invoice.paymentDate) }}</td>
            <td>
              <strong>{{ invoice.invoiceNumber }}</strong>
              <div class="invoice-substatus">{{ getCourseStatusText(invoice.courseStatus) }}</div>
            </td>
            <td>
              <div>{{ invoice.studentId.fullName }}</div>
              <small class="muted-text">{{ invoice.studentId.studentCode }}</small>
            </td>
            <td>
              <div>{{ invoice.studentId.parentName }}</div>
              <small class="muted-text">{{ invoice.studentId.parentPhone }}</small>
            </td>
            <td>
              <span *ngIf="invoice.classType === 'ONLINE'" class="chip chip-blue">Online</span>
              <span *ngIf="invoice.classType === 'OFFLINE'" class="chip chip-orange">Offline</span>
              <span *ngIf="!invoice.classType" class="muted-text">-</span>
            </td>
            <td class="center">{{ formatRegisteredSessions(invoice) }}</td>
            <td class="center">{{ invoice.paymentRound || '-' }}</td>
            <td class="right"><strong>{{ formatCurrency(invoice.amount) }}</strong></td>
            <td>
              <span *ngIf="invoice.saleId">{{ invoice.saleId.fullName }}</span>
              <span *ngIf="!invoice.saleId" class="muted-text">-</span>
            </td>
            <td>
              <span [ngClass]="['status', getStatusClass(invoice.status)]">
                {{ getStatusText(invoice.status) }}
              </span>
            </td>
            <td>
              <div class="proof-stack">
                <span class="proof-label">HD sale</span>
                <img
                  *ngIf="invoice.receiptImage"
                  [src]="getImageUrl(invoice.receiptImage)"
                  alt="Ch\u1ee9ng t\u1eeb g\u1ed1c"
                  class="receipt-thumb"
                  title="Ch\u1ee9ng t\u1eeb g\u1ed1c"
                  (click)="showImageModal(getImageUrl(invoice.receiptImage))"
                />
                <span class="proof-label proof-label-approval">HD \u0111\u1ed1i \u1ee9ng</span>
                <img
                  *ngIf="invoice.approvalImage"
                  [src]="getImageUrl(invoice.approvalImage)"
                  alt="\u1ea2nh x\u00e1c nh\u1eadn duy\u1ec7t"
                  class="receipt-thumb approval-thumb"
                  title="\u1ea2nh x\u00e1c nh\u1eadn duy\u1ec7t"
                  (click)="showImageModal(getImageUrl(invoice.approvalImage))"
                />
                <span *ngIf="!invoice.receiptImage && !invoice.approvalImage" class="muted-text">-</span>
              </div>
            </td>
            <td class="actions-cell">
              <ng-container *ngIf="canEditInvoice(invoice)">
              <button class="ghost" (click)="edit(invoice)">S\u1eeda</button>
              </ng-container>
              <button
                class="ghost success"
                *ngIf="canApproveInvoices && invoice.status === 'PENDING_APPROVAL'"
                (click)="openApproveModal(invoice)">
                Duy\u1ec7t
              </button>
              <button
                class="ghost danger"
                *ngIf="canApproveInvoices && invoice.status === 'PENDING_APPROVAL'"
                (click)="reject(invoice)">
                T\u1eeb ch\u1ed1i
              </button>
              <button class="ghost danger" (click)="remove(invoice)" *ngIf="canDeleteInvoices">X\u00f3a</button>
            </td>
          </tr>
        </tbody>
      </table>
      <ng-template #empty>
        <p class="empty-msg">Kh\u00f4ng c\u00f3 h\u00f3a \u0111\u01a1n n\u00e0o ph\u00f9 h\u1ee3p v\u1edbi b\u1ed9 l\u1ecdc.</p>
      </ng-template>
    </div>
  </ng-container>

  <!-- TOPUPS TAB -->
  <ng-container *ngIf="activeTab === 'topups'">
    <div class="topup-header">
      <h3>Y\u00eau c\u1ea7u n\u1ea1p ti\u1ec1n v\u00e0o v\u00ed t\u1eeb ph\u1ee5 huynh</h3>
      <button class="ghost" (click)="loadPendingTopUps()">L\u00e0m m\u1edbi</button>
    </div>
    <div *ngIf="loadingTopUps()" class="hint">\u0110ang t\u1ea3i...</div>
    <table class="data" *ngIf="!loadingTopUps() && pendingTopUps().length; else emptyTopUps">
      <thead>
        <tr>
          <th>Ph\u1ee5 huynh</th>
          <th>S\u1ed1 ti\u1ec1n</th>
          <th>Ph\u01b0\u01a1ng th\u1ee9c</th>
          <th>M\u00e3 GD</th>
          <th>Ch\u1ee9ng t\u1eeb</th>
          <th>Th\u1eddi gian</th>
          <th>H\u00e0nh \u0111\u1ed9ng</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let req of pendingTopUps()">
          <td>
            <strong>{{req.userId?.fullName || '-'}}</strong><br/>
            <small>{{req.userId?.phone || req.userId?.email || ''}}</small>
          </td>
          <td class="right"><strong>{{formatCurrency(req.amount)}}</strong></td>
          <td><span class="chip">{{methodLabel(req.paymentMethod)}}</span></td>
          <td>{{req.transactionRef || '-'}}</td>
          <td>
            <a *ngIf="req.receiptImageUrl" [href]="getImageUrl(req.receiptImageUrl)" target="_blank" rel="noopener">
              <img [src]="getImageUrl(req.receiptImageUrl)" alt="Ch\u1ee9ng t\u1eeb" class="receipt-thumb" />
            </a>
            <span *ngIf="!req.receiptImageUrl" class="muted-text">Kh\u00f4ng c\u00f3</span>
          </td>
          <td>{{req.createdAt | date:'dd/MM/yyyy HH:mm'}}</td>
          <td class="actions-cell">
            <button class="ghost success" (click)="approveTopUpRequest(req)">Duy\u1ec7t</button>
            <button class="ghost danger" (click)="rejectTopUpRequest(req)">T\u1eeb ch\u1ed1i</button>
          </td>
        </tr>
      </tbody>
    </table>
    <ng-template #emptyTopUps>
      <p *ngIf="!loadingTopUps()" class="empty-msg">Kh\u00f4ng c\u00f3 y\u00eau c\u1ea7u n\u1ea1p ti\u1ec1n n\u00e0o \u0111ang ch\u1edd duy\u1ec7t.</p>
    </ng-template>
  </ng-container>

  <!-- INVOICE FORM MODAL -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingInvoice ? 'S\u1eeda h\u00f3a \u0111\u01a1n' : 'Th\u00eam h\u00f3a \u0111\u01a1n m\u1edbi' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">

        <label>S\u1ed1 h\u00f3a \u0111\u01a1n <span class="req">*</span>
          <input name="invoiceNumber" [(ngModel)]="form.invoiceNumber" required placeholder="VD: HD20240001" />
        </label>

        <label>T\u00ecnh tr\u1ea1ng kh\u00f3a h\u1ecdc
          <select name="courseStatus" [(ngModel)]="form.courseStatus">
            <option *ngFor="let option of courseStatusOptions" [ngValue]="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label>H\u1ecdc sinh <span class="req">*</span>
          <select name="studentId" [(ngModel)]="form.studentId" required (ngModelChange)="onStudentChange()">
            <option value="">-- Ch\u1ecdn h\u1ecdc sinh --</option>
            <option *ngFor="let s of students()" [value]="s._id">
              {{ s.fullName }} ({{ s.studentCode }})
            </option>
          </select>
        </label>

        <div class="parent-info-box" *ngIf="selectedStudent">
          <span class="parent-info-label">Ph\u1ee5 huynh:</span>
          <strong>{{ selectedStudent.parentName }}</strong>
          <span class="parent-info-phone"> - {{ selectedStudent.parentPhone }}</span>
        </div>

        <div class="form-row">
          <label>Lo\u1ea1i l\u1edbp h\u1ecdc <span class="req">*</span>
            <select name="classType" [(ngModel)]="form.classType" required>
              <option value="">-- Ch\u1ecdn lo\u1ea1i l\u1edbp --</option>
              <option value="ONLINE">Online</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </label>
          <div class="field-stack">
            <label>S\u1ed1 bu\u1ed5i \u0111\u0103ng k\u00fd
              <input name="sessions" type="number" min="1" [(ngModel)]="form.sessions" placeholder="VD: 20" />
            </label>
            <label>Bu\u1ed5i t\u1eb7ng
              <input name="bonusSessions" type="number" min="0" [(ngModel)]="form.bonusSessions" placeholder="VD: 1" />
            </label>
          </div>
        </div>
        <p class="hint">Bu\u1ed5i t\u1eb7ng kh\u00f4ng c\u1ed9ng th\u00eam v\u00e0o v\u00ed. T\u1ed5ng bu\u1ed5i h\u1ecdc th\u1ef1c t\u1ebf = s\u1ed1 bu\u1ed5i \u0111\u0103ng k\u00fd + bu\u1ed5i t\u1eb7ng, v\u00e0 bu\u1ed5i t\u1eb7ng v\u1eabn t\u00ednh l\u01b0\u01a1ng gi\u00e1o vi\u00ean.</p>

        <label>L\u1ea7n thanh to\u00e1n (t\u00f9y ch\u1ecdn)
          <input
            name="paymentRound"
            type="number"
            min="1"
            [(ngModel)]="form.paymentRound"
            placeholder="VD: 1"
          />
        </label>

        <label>T\u1ed5ng ti\u1ec1n (VND) <span class="req">*</span>
          <input name="amount" type="number" min="0" [(ngModel)]="form.amount" required placeholder="VD: 3800000" />
        </label>

        <label>Sale ph\u1ee5 tr\u00e1ch
          <div *ngIf="isSale" class="readonly-field">{{ currentUserName }} (b\u1ea1n)</div>
          <select *ngIf="!isSale" name="saleId" [(ngModel)]="form.saleId">
            <option value="">-- Kh\u00f4ng c\u00f3 / Ch\u1ecdn sale --</option>
            <option *ngFor="let s of sales()" [value]="s._id">{{ s.fullName }}</option>
          </select>
        </label>

        <label>Ng\u00e0y thanh to\u00e1n <span class="req">*</span>
          <input name="paymentDate" type="date" [(ngModel)]="form.paymentDate" required />
        </label>
        <p class="hint">H\u00f3a \u0111\u01a1n m\u1edbi s\u1ebd \u1edf tr\u1ea1ng th\u00e1i ch\u1edd duy\u1ec7t. Mu\u1ed1n duy\u1ec7t v\u00e0 c\u1ed9ng v\u00ed th\u00ec ph\u1ea3i c\u00f3 h\u00f3a \u0111\u01a1n sale upload v\u00e0 h\u00f3a \u0111\u01a1n \u0111\u1ed1i \u1ee9ng c\u1ee7a ng\u01b0\u1eddi duy\u1ec7t.</p>
        <p class="hint">Sau khi duy\u1ec7t, v\u00ed ph\u1ee5 huynh s\u1ebd \u0111\u01b0\u1ee3c c\u1ed9ng ti\u1ec1n.</p>

        <label>M\u00f4 t\u1ea3
          <textarea
            name="description"
            [(ngModel)]="form.description"
            rows="2"
            placeholder="M\u00f4 t\u1ea3 h\u00f3a \u0111\u01a1n (t\u00f9y ch\u1ecdn)"></textarea>
        </label>

        <label>\u1ea2nh ch\u1ee9ng t\u1eeb (t\u00f9y ch\u1ecdn)
          <input name="receiptImage" type="file" accept="image/*" (change)="handleFileChange($event)" />
        </label>

        <div class="upload-status">
          <span *ngIf="uploading()">\u0110ang t\u1ea3i \u1ea3nh...</span>
          <span class="error" *ngIf="uploadError()">{{ uploadError() }}</span>
          <img *ngIf="form.receiptImage && !uploading()" [src]="getImageUrl(form.receiptImage)" alt="Preview" class="preview" />
        </div>

        <div class="actions">
          <button type="submit" class="primary" [disabled]="uploading()">L\u01b0u</button>
          <button type="button" (click)="closeModal()">H\u1ee7y</button>
        </div>
        <p class="error" *ngIf="error()">{{ error() }}</p>
      </form>
    </div>
  </div>

  <!-- Approve modal -->
  <div class="modal-backdrop" *ngIf="showApproveModal()">
    <div class="modal approve-modal">
      <h3>X\u00e1c nh\u1eadn duy\u1ec7t h\u00f3a \u0111\u01a1n</h3>
      <p class="hint" *ngIf="approvingInvoice()">
        H\u00f3a \u0111\u01a1n <strong>{{ approvingInvoice()!.invoiceNumber }}</strong> s\u1ebd c\u1ed9ng
        <strong>{{ formatCurrency(approvingInvoice()!.amount) }}</strong> v\u00e0o v\u00ed ph\u1ee5 huynh.
      </p>

      <label>\u1ea2nh x\u00e1c nh\u1eadn duy\u1ec7t <span class="req">*</span>
        <div class="proof-compare" *ngIf="approvingInvoice()">
          <div class="proof-panel">
            <span class="proof-label">H\u00f3a \u0111\u01a1n sale upload</span>
            <img
              *ngIf="approvingInvoice()!.receiptImage; else missingSaleInvoice"
              [src]="getImageUrl(approvingInvoice()!.receiptImage!)"
              alt="H\u00f3a \u0111\u01a1n sale upload"
              class="preview" />
            <ng-template #missingSaleInvoice>
              <p class="error">Ch\u01b0a c\u00f3 h\u00f3a \u0111\u01a1n sale upload. Kh\u00f4ng th\u1ec3 duy\u1ec7t cho \u0111\u1ebfn khi sale b\u1ed5 sung \u1ea3nh h\u00f3a \u0111\u01a1n g\u1ed1c.</p>
            </ng-template>
          </div>
        </div>
        <span class="hint">H\u00f3a \u0111\u01a1n \u0111\u1ed1i \u1ee9ng do ng\u01b0\u1eddi duy\u1ec7t upload \u0111\u1ec3 \u0111\u1ed1i chi\u1ebfu \u0111\u1ed9c l\u1eadp v\u1edbi h\u00f3a \u0111\u01a1n sale upload.</span>
        <input type="file" accept="image/*" (change)="handleApproveImageChange($event)" />
      </label>

      <div class="upload-status">
        <span *ngIf="approveUploading()">\u0110ang t\u1ea3i \u1ea3nh x\u00e1c nh\u1eadn...</span>
        <span class="error" *ngIf="approveUploadError()">{{ approveUploadError() }}</span>
        <img
          *ngIf="approveImage && !approveUploading()"
          [src]="getImageUrl(approveImage)"
          alt="\u1ea2nh x\u00e1c nh\u1eadn"
          class="preview" />
      </div>

      <div class="actions">
        <button
          type="button"
          class="primary"
          [disabled]="approveUploading() || !approveImage || !approvingInvoice()?.receiptImage"
          (click)="confirmApprove()">
          Duy\u1ec7t h\u00f3a \u0111\u01a1n
        </button>
        <button type="button" (click)="closeApproveModal()">H\u1ee7y</button>
      </div>
    </div>
  </div>

  <!-- Image lightbox -->
  <div class="modal-backdrop" *ngIf="modalImage()" (click)="closeImageModal()">
    <div class="image-modal">
      <span class="close" (click)="closeImageModal()">&times;</span>
      <img [src]="modalImage()" alt="Ch\u1ee9ng t\u1eeb" />
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .tab-bar { display:flex; gap:6px; margin-bottom:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; }
    .tab-bar button { background:#f1f5f9; border:1px solid #e2e8f0; padding:7px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; }
    .tab-bar button.active { background:#2563eb; color:#fff; border-color:#2563eb; }
    .badge-count { display:inline-block; background:#ef4444; color:#fff; border-radius:999px; font-size:11px; padding:1px 6px; margin-left:4px; }

    /* Stats */
    .stats-bar { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:16px; }
    .stat-card { background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; border-left:4px solid #94a3b8; }
    .stat-card.blue { border-left-color:#2563eb; background:#eff6ff; }
    .stat-card.orange { border-left-color:#ea580c; background:#fff7ed; }
    .stat-card.green { border-left-color:#16a34a; background:#f0fdf4; }
    .stat-card.yellow { border-left-color:#d97706; background:#fffbeb; }
    .stat-label { font-size:12px; color:#64748b; margin-bottom:4px; }
    .stat-value { font-size:16px; font-weight:700; color:#1e293b; }

    /* Filters */
    .filters-section { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; }
    .filter-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
    .filter-row:last-child { margin-bottom:0; }
    .filter-input { flex:1; min-width:180px; }
    .date-wrap { display:flex; flex-direction:column; gap:2px; font-size:12px; color:#64748b; }
    .date-wrap input { padding:5px 8px; border:1px solid #cbd5e1; border-radius:4px; }
    .result-meta { font-size:13px; color:#64748b; margin-bottom:8px; }
    .result-meta-total { margin-left:4px; }
    .invoice-substatus { margin-top:4px; font-size:12px; color:#475569; }

    /* Table */
    .lazy-hint { margin:0 0 8px; font-size:12px; color:#64748b; }
    .table-wrap { overflow:auto; max-height:72vh; border:1px solid #e2e8f0; border-radius:8px; background:#fff; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; width:100%; box-sizing:border-box; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; white-space:nowrap; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; vertical-align:middle; }
    thead { background:#f1f5f9; }
    .data thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f1f5f9;
      box-shadow: 0 1px 0 #e2e8f0;
    }
    .center { text-align:center; }
    .right { text-align:right; }

    /* Chips */
    .chip { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:500; }
    .chip-blue { background:#dbeafe; color:#1d4ed8; }
    .chip-orange { background:#ffedd5; color:#c2410c; }
    .muted-text { color:#94a3b8; font-size:12px; }

    /* Status */
    .status { padding:3px 8px; border-radius:12px; font-size:12px; font-weight:600; }
    .status.approved { background:#d1fae5; color:#065f46; }
    .status.pending-approval { background:#fef3c7; color:#92400e; }
    .status.rejected, .status.cancelled { background:#fee2e2; color:#991b1b; }

    /* Buttons */
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-size:13px; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:12px; }
    .ghost.success { border-color:#16a34a; color:#166534; }
    .ghost.danger { border-color:#dc2626; color:#b91c1c; }
    .ghost:hover { background:#f1f5f9; }

    /* Cells */
    .proof-stack { display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap; }
    .proof-item { display:flex; flex-direction:column; gap:4px; align-items:flex-start; }
    .proof-label {
      display:inline-flex;
      align-items:center;
      padding:2px 8px;
      border-radius:999px;
      background:#e0f2fe;
      color:#0369a1;
      font-size:11px;
      font-weight:700;
    }
    .proof-label-approval { background:#dcfce7; color:#166534; }
    .receipt-thumb { width:56px; height:38px; object-fit:cover; border-radius:4px; cursor:pointer; border:1px solid #cbd5e1; }
    .approval-thumb { border-color:#16a34a; box-shadow:0 0 0 1px #bbf7d0 inset; }
    .actions-cell { text-align:right; white-space:nowrap; }
    .actions-cell button { margin-left:4px; }
    .empty-msg { color:#64748b; text-align:center; padding:32px 0; }

    /* Modal */
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:1000; }
    .modal { background:#fff; padding:24px; border-radius:10px; width:540px; max-height:92vh; overflow-y:auto; box-shadow:0 8px 32px rgba(15,23,42,.2); }
    .approve-modal { width:440px; }
    .modal h3 { margin:0 0 16px; font-size:16px; color:#1e293b; }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .modal label { font-size:13px; color:#374151; display:flex; flex-direction:column; gap:4px; }
    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .field-stack { display:flex; flex-direction:column; gap:12px; }
    .req { color:#ef4444; }

    /* Parent info */
    .parent-info-box { background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px; padding:8px 12px; font-size:13px; }
    .parent-info-label { color:#0284c7; font-size:12px; margin-right:6px; }
    .parent-info-phone { color:#64748b; }

    /* Readonly sale field */
    .readonly-field { background:#f1f5f9; border:1px solid #e2e8f0; border-radius:4px; padding:7px 10px; font-size:13px; color:#374151; }

    /* Misc */
    .hint { margin:0; color:#64748b; font-size:12px; }
    .error { color:#dc2626; font-size:13px; }
    .upload-status { display:flex; flex-direction:column; gap:6px; font-size:13px; }
    .preview { width:120px; height:80px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1; }
    .proof-compare { margin-bottom:12px; }
    .proof-panel { display:flex; flex-direction:column; gap:8px; }
    .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:4px; }

    /* Image lightbox */
    .image-modal { position:relative; max-width:90%; max-height:90%; }
    .image-modal img { max-width:100%; max-height:90vh; border-radius:8px; }
    .close { position:absolute; top:-40px; right:0; color:white; font-size:30px; cursor:pointer; }

    /* Top-up tab */
    .topup-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .topup-header h3 { margin:0; font-size:15px; color:#1e293b; }
  `]
})
export class InvoicesComponent {
  items = signal<InvoiceItem[]>([]);
  students = signal<StudentItem[]>([]);
  sales = signal<UserItem[]>([]);

  // Filter signals
  keyword = signal('');
  parentFilter = signal('');
  saleFilter = signal('');
  classTypeFilter = signal('');
  statusFilter = signal('');
  courseStatusFilter = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  activeTab: 'invoices' | 'topups' = 'invoices';
  showModal = signal(false);
  showApproveModal = signal(false);
  modalImage = signal('');
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  approveUploadError = signal('');
  approveUploading = signal(false);
  form: InvoiceForm = this.blankForm();
  approveImage = '';

  canDeleteInvoices = false;
  canApproveInvoices = false;
  isSale = false;
  currentUserId = '';
  currentUserName = '';
  editingInvoice: InvoiceItem | null = null;
  approvingInvoice = signal<InvoiceItem | null>(null);
  readonly invoicePageSize = 40;
  readonly invoicePageStep = 40;
  readonly invoiceScrollThreshold = 140;
  readonly courseStatusOptions = Object.entries(INVOICE_COURSE_STATUS_LABELS).map(([value, label]) => ({
    value: value as InvoiceCourseStatus,
    label,
  }));
  invoiceVisibleCount = signal(this.invoicePageSize);
  visibleInvoices = computed(() => this.filtered().slice(0, this.invoiceVisibleCount()));
  hasMoreInvoices = computed(() => this.filtered().length > this.visibleInvoices().length);

  pendingTopUps = signal<any[]>([]);
  loadingTopUps = signal(false);

  constructor(
    private invoiceService: InvoiceService,
    private studentService: StudentService,
    private userService: UserService,
    private auth: AuthService,
    private http: HttpClient,
  ) {
    void this.reload();
    void this.loadLookups();

    const user = this.auth.userSignal();
    const role = user?.role;
    this.canDeleteInvoices = role === 'DIRECTOR';
    this.canApproveInvoices = role === 'DIRECTOR' || role === 'ACCOUNTING';
    this.isSale = role === 'SALE';
    this.currentUserId = user?.sub || '';
    this.currentUserName = user?.fullName || '';

    if (this.canApproveInvoices) {
      void this.loadPendingTopUps();
    }
  }

  // Computed: selected student for parent info display in form
  get selectedStudent(): StudentItem | null {
    return this.students().find(s => s._id === this.form.studentId) ?? null;
  }

  // Computed: filtered invoice list
  filtered = computed(() => {
    let result = this.items();

    const kw = this.keyword().trim().toLowerCase();
    if (kw) {
      result = result.filter(i =>
        i.invoiceNumber.toLowerCase().includes(kw) ||
        i.studentId?.fullName?.toLowerCase().includes(kw)
      );
    }

    const parentKw = this.parentFilter().trim().toLowerCase();
    if (parentKw) {
      result = result.filter(i =>
        i.studentId?.parentName?.toLowerCase().includes(parentKw) ||
        i.studentId?.parentPhone?.toLowerCase().includes(parentKw)
      );
    }

    const saleKw = this.saleFilter().trim().toLowerCase();
    if (saleKw) {
      result = result.filter(i =>
        i.saleId?.fullName?.toLowerCase().includes(saleKw)
      );
    }

    const ct = this.classTypeFilter();
    if (ct) {
      result = result.filter(i => i.classType === ct);
    }

    const st = this.statusFilter();
    if (st) {
      result = result.filter(i => i.status === st);
    }

    const courseStatus = this.courseStatusFilter();
    if (courseStatus) {
      result = result.filter(i => (i.courseStatus || 'NEW') === courseStatus);
    }

    const from = this.dateFrom();
    if (from) {
      const fromDate = new Date(from);
      result = result.filter(i => i.paymentDate && new Date(i.paymentDate) >= fromDate);
    }

    const to = this.dateTo();
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(i => i.paymentDate && new Date(i.paymentDate) <= toDate);
    }

    return result;
  });

  // Computed: summary stats based on filtered list
  summary = computed(() => {
    const data = this.filtered();
    return {
      total: data.length,
      onlineAmount: data
        .filter(i => i.classType === 'ONLINE')
        .reduce((s, i) => s + i.amount, 0),
      offlineAmount: data
        .filter(i => i.classType === 'OFFLINE')
        .reduce((s, i) => s + i.amount, 0),
      approvedAmount: data
        .filter(i => i.status === 'APPROVED' || i.status === 'PAID')
        .reduce((s, i) => s + i.amount, 0),
      pendingCount: data.filter(i => i.status === 'PENDING_APPROVAL').length,
    };
  });

  hasActiveFilters = computed(() =>
    !!this.keyword() || !!this.parentFilter() || !!this.saleFilter() ||
    !!this.classTypeFilter() || !!this.statusFilter() ||
    !!this.courseStatusFilter() ||
    !!this.dateFrom() || !!this.dateTo()
  );

  onKeywordChange(value: string): void {
    this.keyword.set(value);
    this.resetInvoicePaging();
  }

  onParentFilterChange(value: string): void {
    this.parentFilter.set(value);
    this.resetInvoicePaging();
  }

  onSaleFilterChange(value: string): void {
    this.saleFilter.set(value);
    this.resetInvoicePaging();
  }

  onClassTypeFilterChange(value: string): void {
    this.classTypeFilter.set(value);
    this.resetInvoicePaging();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
    this.resetInvoicePaging();
  }

  onCourseStatusFilterChange(value: string): void {
    this.courseStatusFilter.set(value);
    this.resetInvoicePaging();
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.resetInvoicePaging();
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.resetInvoicePaging();
  }

  clearFilters(): void {
    this.keyword.set('');
    this.parentFilter.set('');
    this.saleFilter.set('');
    this.classTypeFilter.set('');
    this.statusFilter.set('');
    this.courseStatusFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.resetInvoicePaging();
  }

  async reload(): Promise<void> {
    const data = await this.invoiceService.list();
    this.items.set(data);
    this.resetInvoicePaging();
  }

  async loadLookups(): Promise<void> {
    const [studs, salesList] = await Promise.all([
      this.studentService.list(),
      this.userService.listSales(),
    ]);
    this.students.set(studs);
    this.sales.set(salesList);
  }

  onStudentChange(): void {
    // parent info auto-shows via selectedStudent getter
  }

  openModal(): void {
    this.editingInvoice = null;
    this.form = this.blankForm();
    // Pre-fill sale for SALE role
    if (this.isSale) {
      this.form.saleId = this.currentUserId;
    }
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  edit(invoice: InvoiceItem): void {
    if (!this.canEditInvoice(invoice)) {
      return;
    }
    this.editingInvoice = invoice;
    this.form = {
      invoiceNumber: invoice.invoiceNumber,
      courseStatus: invoice.courseStatus || 'NEW',
      studentId: invoice.studentId._id,
      classType: (invoice.classType as 'ONLINE' | 'OFFLINE') || '',
      saleId: invoice.saleId?._id || '',
      sessions: invoice.sessions || 0,
      bonusSessions: invoice.bonusSessions || 0,
      paymentRound: invoice.paymentRound || 0,
      amount: invoice.amount,
      paymentDate: invoice.paymentDate.split('T')[0],
      description: invoice.description || '',
      receiptImage: invoice.receiptImage || '',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  onInvoiceTableScroll(event: Event): void {
    const container = event.currentTarget as HTMLElement | null;
    if (!container || !this.hasMoreInvoices()) return;

    const nearBottom =
      container.scrollTop + container.clientHeight >= container.scrollHeight - this.invoiceScrollThreshold;
    if (nearBottom) {
      this.loadNextInvoiceBatch();
    }
  }

  async submit(): Promise<void> {
    if (this.editingInvoice && !this.canEditInvoice(this.editingInvoice)) {
      this.error.set('H\u00f3a \u0111\u01a1n \u0111\u00e3 duy\u1ec7t ho\u1eb7c kh\u00f4ng c\u00f2n thu\u1ed9c quy\u1ec1n s\u1eeda c\u1ee7a b\u1ea1n');
      return;
    }

    if (!this.form.classType) {
      this.error.set('Vui l\u00f2ng ch\u1ecdn lo\u1ea1i l\u1edbp h\u1ecdc (Online ho\u1eb7c Offline)');
      return;
    }

    const payload: InvoiceUpsertPayload = {
      invoiceNumber: this.form.invoiceNumber.trim(),
      courseStatus: this.form.courseStatus,
      studentId: this.form.studentId,
      classType: this.form.classType,
      amount: Number(this.form.amount),
      paymentDate: this.form.paymentDate,
    };

    if (this.form.sessions > 0) payload.sessions = Number(this.form.sessions);
    if (this.form.bonusSessions > 0) payload.bonusSessions = Number(this.form.bonusSessions);
    if (this.form.paymentRound > 0) payload.paymentRound = Number(this.form.paymentRound);
    if (this.form.saleId) payload.saleId = this.form.saleId;
    if (this.form.receiptImage) payload.receiptImage = this.form.receiptImage.trim();
    if (this.form.description) payload.description = this.form.description.trim();

    const result = this.editingInvoice
      ? await this.invoiceService.update(this.editingInvoice._id, payload)
      : await this.invoiceService.create(payload);

    if (!result.ok) {
      this.error.set(result.message || (this.editingInvoice ? 'Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt h\u00f3a \u0111\u01a1n' : 'Kh\u00f4ng th\u1ec3 t\u1ea1o h\u00f3a \u0111\u01a1n'));
      return;
    }

    this.closeModal();
    await this.reload();
  }

  openApproveModal(invoice: InvoiceItem): void {
    this.approvingInvoice.set(invoice);
    this.approveImage = '';
    this.approveUploadError.set('');
    this.approveUploading.set(false);
    this.showApproveModal.set(true);
  }

  closeApproveModal(): void {
    this.showApproveModal.set(false);
    this.approvingInvoice.set(null);
    this.approveImage = '';
    this.approveUploadError.set('');
    this.approveUploading.set(false);
  }

  async handleApproveImageChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.approveUploadError.set('');
    this.approveUploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.approveUploading.set(false);

    if (!result.ok || !result.url) {
      this.approveUploadError.set(result.message || 'T\u1ea3i h\u00f3a \u0111\u01a1n \u0111\u1ed1i \u1ee9ng th\u1ea5t b\u1ea1i');
      return;
    }

    this.approveImage = result.url;
  }

  async confirmApprove(): Promise<void> {
    const invoice = this.approvingInvoice();
    if (!invoice) return;
    this.approveUploadError.set('');

    if (!invoice.receiptImage) {
      this.approveUploadError.set('Vui l\u00f2ng b\u1ed5 sung h\u00f3a \u0111\u01a1n sale upload tr\u01b0\u1edbc khi duy\u1ec7t');
      return;
    }

    if (!this.approveImage) {
      this.approveUploadError.set('Vui l\u00f2ng t\u1ea3i h\u00f3a \u0111\u01a1n \u0111\u1ed1i \u1ee9ng tr\u01b0\u1edbc khi duy\u1ec7t');
      return;
    }

    if (!confirm(`Duy\u1ec7t h\u00f3a \u0111\u01a1n ${invoice.invoiceNumber}? V\u00ed ph\u1ee5 huynh ch\u1ec9 \u0111\u01b0\u1ee3c c\u1ed9ng sau khi \u0111\u1ed1i chi\u1ebfu \u0111\u1ee7 h\u00f3a \u0111\u01a1n sale v\u00e0 h\u00f3a \u0111\u01a1n \u0111\u1ed1i \u1ee9ng.`)) return;

    const result = await this.invoiceService.approve(invoice._id, 'APPROVE', undefined, this.approveImage);
    if (!result.ok) {
      this.approveUploadError.set(result.message || 'Kh\u00f4ng th\u1ec3 duy\u1ec7t h\u00f3a \u0111\u01a1n');
      return;
    }

    this.closeApproveModal();
    await this.reload();
  }

  async reject(invoice: InvoiceItem): Promise<void> {
    const reason = prompt(`L\u00fd do t\u1eeb ch\u1ed1i h\u00f3a \u0111\u01a1n ${invoice.invoiceNumber}:`, '');
    if (reason === null) return;

    const result = await this.invoiceService.approve(invoice._id, 'REJECT', reason.trim() || undefined);
    if (!result.ok) {
      alert(result.message || 'Kh\u00f4ng th\u1ec3 t\u1eeb ch\u1ed1i h\u00f3a \u0111\u01a1n');
      return;
    }
    await this.reload();
  }

  async remove(invoice: InvoiceItem): Promise<void> {
    if (!confirm(`X\u00f3a h\u00f3a \u0111\u01a1n ${invoice.invoiceNumber}?`)) return;

    const result = await this.invoiceService.remove(invoice._id);
    if (!result.ok) {
      alert(result.message || 'Kh\u00f4ng th\u1ec3 x\u00f3a h\u00f3a \u0111\u01a1n');
      return;
    }
    await this.reload();
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.uploading.set(false);

    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'T\u1ea3i \u1ea3nh th\u1ea5t b\u1ea1i');
      return;
    }
    this.form.receiptImage = result.url;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  formatRegisteredSessions(invoice: InvoiceItem): string {
    const sessions = Number(invoice.sessions || 0);
    const bonusSessions = Number(invoice.bonusSessions || 0);
    if (sessions <= 0 && bonusSessions <= 0) {
      return '-';
    }
    if (bonusSessions <= 0) {
      return String(sessions);
    }
    return `${sessions} + ${bonusSessions}`;
  }

  loadNextInvoiceBatch(): void {
    if (!this.hasMoreInvoices()) return;
    this.invoiceVisibleCount.update((count) => count + this.invoicePageStep);
  }

  private resetInvoicePaging(): void {
    this.invoiceVisibleCount.set(this.invoicePageSize);
  }

  getStatusText(status: InvoiceStatus | string): string {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'Ch\u1edd duy\u1ec7t',
      APPROVED: '\u0110\u00e3 duy\u1ec7t',
      REJECTED: 'T\u1eeb ch\u1ed1i',
      CANCELLED: '\u0110\u00e3 h\u1ee7y',
      PAID: '\u0110\u00e3 thanh to\u00e1n',
      PENDING: 'Ch\u1edd thanh to\u00e1n',
    };
    return map[status] || status;
  }

  getCourseStatusText(status?: InvoiceCourseStatus | string): string {
    if (!status) return INVOICE_COURSE_STATUS_LABELS.NEW;
    return INVOICE_COURSE_STATUS_LABELS[status as InvoiceCourseStatus] || String(status);
  }

  getStatusClass(status: InvoiceStatus | string): string {
    const map: Record<string, string> = {
      PENDING_APPROVAL: 'pending-approval',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      PAID: 'approved',
      PENDING: 'pending-approval',
    };
    return map[status] || 'pending-approval';
  }

  canEditInvoice(invoice: InvoiceItem): boolean {
    const role = this.auth.userSignal()?.role;
    if (role === 'SALE') {
      return invoice.createdBy?._id === this.currentUserId
        && invoice.status === 'PENDING_APPROVAL';
    }
    return role === 'DIRECTOR' || role === 'ACCOUNTING';
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http')) return imagePath;
    return `${environment.apiBase}${imagePath}`;
  }

  showImageModal(imageUrl: string): void {
    this.modalImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.modalImage.set('');
  }

  private blankForm(): InvoiceForm {
    return {
      invoiceNumber: '',
      courseStatus: 'NEW',
      studentId: '',
      classType: '',
      saleId: '',
      sessions: 0,
      bonusSessions: 0,
      paymentRound: 0,
      amount: 0,
      paymentDate: new Date().toISOString().split('T')[0],
      description: '',
      receiptImage: '',
    };
  }

  // Pending top-up management

  async loadPendingTopUps(): Promise<void> {
    this.loadingTopUps.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiBase}/wallets/top-up/pending`, { withCredentials: true }),
      );
      this.pendingTopUps.set(data || []);
    } catch {
      this.pendingTopUps.set([]);
    } finally {
      this.loadingTopUps.set(false);
    }
  }

  async approveTopUpRequest(req: any): Promise<void> {
    const isBankTransfer = req.paymentMethod === 'BANK_TRANSFER';
    if (isBankTransfer && !req.receiptImageUrl) {
      alert('Y\u00eau c\u1ea7u chuy\u1ec3n kho\u1ea3n thi\u1ebfu \u1ea3nh bi\u00ean lai, kh\u00f4ng th\u1ec3 duy\u1ec7t.');
      return;
    }

    let notes = '';
    if (isBankTransfer) {
      const input = prompt('M\u00e3 sao k\u00ea / ghi ch\u00fa x\u00e1c nh\u1eadn (t\u00f9y ch\u1ecdn):');
      if (input === null) return;
      notes = input;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/wallets/top-up/${req._id}/approve`,
          {
            bankMatched: isBankTransfer ? true : undefined,
            bankStatementRef: notes.trim() || undefined,
            accountingNotes: notes.trim() || undefined,
          },
          { withCredentials: true },
        ),
      );
      alert(`\u0110\u00e3 duy\u1ec7t y\u00eau c\u1ea7u n\u1ea1p ${this.formatCurrency(req.amount)} cho ${req.userId?.fullName || ''}. V\u00ed ph\u1ee5 huynh \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1ed9ng ti\u1ec1n.`);
      await this.loadPendingTopUps();
    } catch (err: any) {
      alert(err?.error?.message || 'Duy\u1ec7t th\u1ea5t b\u1ea1i');
    }
  }

  async rejectTopUpRequest(req: any): Promise<void> {
    const reason = prompt(`L\u00fd do t\u1eeb ch\u1ed1i y\u00eau c\u1ea7u n\u1ea1p ti\u1ec1n c\u1ee7a ${req.userId?.fullName || ''}:`);
    if (reason === null) return;

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/wallets/top-up/${req._id}/reject`,
          { reason: reason.trim() || 'Kh\u00f4ng duy\u1ec7t' },
          { withCredentials: true },
        ),
      );
      alert('\u0110\u00e3 t\u1eeb ch\u1ed1i y\u00eau c\u1ea7u n\u1ea1p ti\u1ec1n.');
      await this.loadPendingTopUps();
    } catch (err: any) {
      alert(err?.error?.message || 'T\u1eeb ch\u1ed1i th\u1ea5t b\u1ea1i');
    }
  }

  methodLabel(method: string): string {
    const map: Record<string, string> = {
      BANK_TRANSFER: 'Chuy\u1ec3n kho\u1ea3n',
      CASH: 'Ti\u1ec1n m\u1eb7t',
      MOMO: 'MoMo',
      SYSTEM: 'H\u1ec7 th\u1ed1ng',
    };
    return map[method] || method;
  }
}