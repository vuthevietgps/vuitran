import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeadService, LeadItem, LeadPipeline } from '../services/lead.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { AdsService, AdGroupItem } from '../services/ads.service';
import { Role } from '../models/role.enum';
import { FlowGuideComponent } from './shared/flow-guide.component';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Mới', CONTACTED: 'Đã liên hệ', CONSULTING: 'Đang tư vấn',
  INTERESTED: 'Quan tâm', CONVERTED: 'Đã chuyển đổi',
  NOT_INTERESTED: 'Không quan tâm', NO_RESPONSE: 'Không phản hồi',
};
const STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', CONTACTED: '#8b5cf6', CONSULTING: '#f59e0b',
  INTERESTED: '#10b981', CONVERTED: '#059669', NOT_INTERESTED: '#6b7280', NO_RESPONSE: '#ef4444',
};
const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook', GOOGLE: 'Google', TIKTOK: 'TikTok', ZALO: 'Zalo',
  WEBSITE: 'Website', REFERRAL: 'Giới thiệu', WALK_IN: 'Đến trực tiếp', OTHER: 'Khác',
};
const CONTACT_LABELS: Record<string, string> = {
  CALL: 'Gọi điện', ZALO: 'Zalo', EMAIL: 'Email', MEET: 'Gặp mặt', SMS: 'SMS', OTHER: 'Khác',
};
const LOST_LABELS: Record<string, string> = {
  PRICE_TOO_HIGH: 'Giá cao', CHOSE_COMPETITOR: 'Chọn nơi khác',
  NO_LONGER_NEEDED: 'Không cần nữa', UNREACHABLE: 'Không liên lạc được',
  SCHEDULE_CONFLICT: 'Lịch không phù hợp', OTHER: 'Khác',
};

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quản lý Leads</h2>
      <p>KH tiềm năng &amp; theo dõi tư vấn.</p>
    </div>
    <button class="primary" (click)="openCreate()">+ Thêm Lead</button>
  </header>

  <app-flow-guide featureKey="leads"></app-flow-guide>

  <!-- Pipeline summary -->
  <section class="pipeline" *ngIf="pipeline()">
    <div class="pipe-card" *ngFor="let s of pipelineStatuses" [style.border-left-color]="statusColor(s)">
      <div class="pipe-count">{{pipeline()!.pipeline[s] ? pipeline()!.pipeline[s].count : 0}}</div>
      <div class="pipe-label">{{statusLabel(s)}}</div>
    </div>
    <div class="pipe-card highlight">
      <div class="pipe-count">{{pipeline()!.conversionRate}}%</div>
      <div class="pipe-label">Tỷ lệ chốt</div>
    </div>
    <div class="pipe-card assigned" *ngIf="isStaff()">
      <div class="pipe-count">{{pipeline()!.assignedCount || 0}}</div>
      <div class="pipe-label">Đã phân bổ</div>
    </div>
    <div class="pipe-card pool" *ngIf="isStaff()">
      <div class="pipe-count">{{pipeline()!.unassignedCount || 0}}</div>
      <div class="pipe-label">Chưa phân bổ</div>
    </div>
  </section>

  <!-- Follow-up alert -->
  <section class="alert-bar" *ngIf="followUps().length > 0" (click)="switchTab('follow-ups')">
    ⏰ {{followUps().length}} lead cần follow-up hôm nay
  </section>

  <!-- Tabs -->
  <section class="tabs" *ngIf="isStaff()">
    <button [class.active]="activeTab === 'all'" (click)="switchTab('all')">
      Tất cả
    </button>
    <button [class.active]="activeTab === 'pool'" (click)="switchTab('pool')">
      📦 Kho chưa phân bổ
      <span class="tab-badge" *ngIf="poolCount() > 0">{{poolCount()}}</span>
    </button>
    <button [class.active]="activeTab === 'stale'" (click)="switchTab('stale')">
      ⚠️ Quá hạn 7 ngày
      <span class="tab-badge warn" *ngIf="staleItems().length > 0">{{staleItems().length}}</span>
    </button>
    <button [class.active]="activeTab === 'follow-ups'" (click)="switchTab('follow-ups')">
      ⏰ Follow-up
      <span class="tab-badge" *ngIf="followUps().length > 0">{{followUps().length}}</span>
    </button>
  </section>

  <!-- Filters -->
  <section class="filters">
    <input placeholder="Tìm tên, SĐT, mã lead..." [(ngModel)]="keyword" (ngModelChange)="applyFilter()" />
    <select [(ngModel)]="filterStatus" (ngModelChange)="applyFilter()" *ngIf="activeTab === 'all'">
      <option value="">Tất cả trạng thái</option>
      <option *ngFor="let s of allStatuses" [value]="s">{{statusLabel(s)}}</option>
    </select>
    <select [(ngModel)]="filterSource" (ngModelChange)="applyFilter()">
      <option value="">Tất cả nguồn</option>
      <option *ngFor="let src of allSources" [value]="src">{{sourceLabel(src)}}</option>
    </select>
    <button (click)="reload()">Làm mới</button>
  </section>

  <!-- Table -->
  <table class="data" *ngIf="filtered().length; else empty">
    <thead><tr>
      <th>Mã</th><th>KH</th><th>SĐT</th><th>Học viên</th><th>Nguồn</th>
      <th>Trạng thái</th><th>Sale</th>
      <th *ngIf="activeTab === 'stale'">Ngày giao</th>
      <th *ngIf="activeTab === 'stale'">Liên hệ cuối</th>
      <th *ngIf="activeTab !== 'stale'">Follow-up</th>
      <th>Giá trị</th><th></th>
    </tr></thead>
    <tbody>
      <tr *ngFor="let l of filtered()" (click)="openDetail(l)" class="clickable" [class.stale-row]="isStale(l)">
        <td><code>{{l.leadCode}}</code></td>
        <td>{{l.parentName}}</td>
        <td>{{l.parentPhone}}</td>
        <td>{{l.studentName || '-'}}</td>
        <td>{{sourceLabel(l.source)}}</td>
        <td>
          <span class="badge" [style.background]="statusColor(l.status) + '20'" [style.color]="statusColor(l.status)">
            {{statusLabel(l.status)}}
          </span>
        </td>
        <td>
          <span *ngIf="l.saleName">{{l.saleName}}</span>
          <span *ngIf="!l.saleName" class="unassigned-text">Chưa phân bổ</span>
        </td>
        <td *ngIf="activeTab === 'stale'">{{l.assignedAt | date:'dd/MM'}}</td>
        <td *ngIf="activeTab === 'stale'">
          <span *ngIf="l.lastContactAt">{{l.lastContactAt | date:'dd/MM'}}</span>
          <span *ngIf="!l.lastContactAt" class="overdue">Chưa liên hệ</span>
        </td>
        <td *ngIf="activeTab !== 'stale'">
          <span *ngIf="l.nextFollowUp" [class.overdue]="isOverdue(l.nextFollowUp)">
            {{l.nextFollowUp | date:'dd/MM'}}
          </span>
          <span *ngIf="!l.nextFollowUp">-</span>
        </td>
        <td class="right">{{l.estimatedValue ? (l.estimatedValue | number) + 'đ' : '-'}}</td>
        <td class="actions-cell" (click)="$event.stopPropagation()">
          <button class="btn-sm assign-btn" (click)="openAssign(l)" *ngIf="isStaff() && !l.saleId && isActiveLead(l)" title="Phân bổ">👤+</button>
          <button class="btn-sm assign-btn" (click)="openAssign(l)" *ngIf="isStaff() && l.saleId && isActiveLead(l)" title="Đổi sale">🔄</button>
          <button class="btn-sm return-btn" (click)="returnToPool(l)" *ngIf="isStaff() && l.saleId && isActiveLead(l)" title="Thu hồi về kho">📦</button>
          <button class="btn-sm" (click)="openContact(l)" *ngIf="isActiveLead(l)">📞</button>
          <button class="btn-sm success" (click)="convertLead(l)" *ngIf="l.status === 'INTERESTED'">✓</button>
          <button class="btn-sm danger" (click)="openLost(l)" *ngIf="isActiveLead(l)">✗</button>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p class="empty-text">Không có lead nào.</p></ng-template>

  <!-- Modal Create/Edit -->
  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal wide">
      <h3>{{editingId ? 'Sửa Lead' : 'Thêm Lead mới'}}</h3>
      <form (ngSubmit)="submitForm()" #f="ngForm">
        <div class="form-grid">
          <label>Tên phụ huynh <span class="req">*</span>
            <input name="parentName" [(ngModel)]="form.parentName" required />
          </label>
          <label>SĐT <span class="req">*</span>
            <input name="parentPhone" [(ngModel)]="form.parentPhone" required />
          </label>
          <label>Email
            <input name="parentEmail" [(ngModel)]="form.parentEmail" />
          </label>
          <label>Tên học viên
            <input name="studentName" [(ngModel)]="form.studentName" />
          </label>
          <label>Lớp
            <input name="studentGrade" [(ngModel)]="form.studentGrade" />
          </label>
          <label>Nguồn
            <select name="source" [(ngModel)]="form.source" (ngModelChange)="loadAdGroups(form.source)">
              <option *ngFor="let s of allSources" [value]="s">{{sourceLabel(s)}}</option>
            </select>
          </label>
          <label *ngIf="form.source === 'REFERRAL'">Người giới thiệu
            <input name="referredBy" [(ngModel)]="form.referredBy" />
          </label>
          <label *ngIf="['FACEBOOK','GOOGLE','TIKTOK'].includes(form.source)">Nhóm quảng cáo
            <select name="adGroupId" [(ngModel)]="form.adGroupId" (ngModelChange)="onAdGroupChange()">
              <option value="">-- Không chọn --</option>
              <option *ngFor="let g of adGroupsByPlatform()" [value]="g._id">{{g.name}}</option>
            </select>
          </label>
          <label>Giá trị ước tính (đ)
            <input name="estimatedValue" type="number" [(ngModel)]="form.estimatedValue" min="0" />
          </label>
        </div>
        <label class="full">Môn quan tâm (cách nhau bằng dấu phẩy)
          <input name="subjects" [(ngModel)]="subjectsText" />
        </label>
        <label class="full">Ghi chú
          <textarea name="notes" [(ngModel)]="form.notes" rows="2"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">{{editingId ? 'Cập nhật' : 'Tạo'}}</button>
          <button type="button" (click)="closeModal()">Hủy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>

  <!-- Modal Detail -->
  <div class="modal-backdrop" *ngIf="detailLead()">
    <div class="modal wide">
      <div class="detail-header">
        <h3>{{detailLead()!.leadCode}} — {{detailLead()!.parentName}}</h3>
        <span class="badge lg" [style.background]="statusColor(detailLead()!.status) + '20'" [style.color]="statusColor(detailLead()!.status)">
          {{statusLabel(detailLead()!.status)}}
        </span>
      </div>
      <div class="detail-grid">
        <div><strong>SĐT:</strong> {{detailLead()!.parentPhone}}</div>
        <div><strong>Email:</strong> {{detailLead()!.parentEmail || '-'}}</div>
        <div><strong>Học viên:</strong> {{detailLead()!.studentName || '-'}}</div>
        <div><strong>Lớp:</strong> {{detailLead()!.studentGrade || '-'}}</div>
        <div><strong>Nguồn:</strong> {{sourceLabel(detailLead()!.source)}}</div>
        <div><strong>Sale:</strong> {{detailLead()!.saleName || 'Chưa phân bổ'}}</div>
        <div><strong>Giá trị:</strong> {{detailLead()!.estimatedValue ? (detailLead()!.estimatedValue! | number) + 'đ' : '-'}}</div>
        <div><strong>Ngày tạo:</strong> {{detailLead()!.createdAt | date:'dd/MM/yyyy HH:mm'}}</div>
        <div *ngIf="detailLead()!.assignedAt"><strong>Ngày phân bổ:</strong> {{detailLead()!.assignedAt | date:'dd/MM/yyyy HH:mm'}}</div>
        <div *ngIf="detailLead()!.lastContactAt"><strong>Liên hệ cuối:</strong> {{detailLead()!.lastContactAt | date:'dd/MM/yyyy HH:mm'}}</div>
        <div *ngIf="detailLead()!.returnCount"><strong>Số lần thu hồi:</strong> {{detailLead()!.returnCount}}</div>
      </div>
      <div *ngIf="detailLead()!.notes"><strong>Ghi chú:</strong> {{detailLead()!.notes}}</div>

      <!-- Assignment History -->
      <div *ngIf="isStaff() && detailLead()!.assignmentHistory?.length">
        <h4>Lịch sử phân bổ ({{detailLead()!.assignmentHistory!.length}})</h4>
        <div class="assignment-history">
          <div class="ah-item" *ngFor="let a of detailLead()!.assignmentHistory">
            <div class="ah-info">
              <strong>{{a.saleName}}</strong>
              <span class="ah-date">Giao: {{a.assignedAt | date:'dd/MM/yyyy HH:mm'}}</span>
              <span *ngIf="a.returnedAt" class="ah-returned">
                Thu hồi: {{a.returnedAt | date:'dd/MM/yyyy HH:mm'}}
                <span *ngIf="a.returnReason" class="ah-reason">— {{a.returnReason}}</span>
              </span>
              <span *ngIf="!a.returnedAt" class="ah-current">Đang phụ trách</span>
            </div>
          </div>
        </div>
      </div>

      <h4>Lịch sử liên hệ ({{detailLead()!.contactHistory?.length || 0}})</h4>
      <div class="timeline" *ngIf="detailLead()!.contactHistory?.length; else noHistory">
        <div class="tl-item" *ngFor="let c of detailLead()!.contactHistory">
          <div class="tl-date">{{c.date | date:'dd/MM/yyyy HH:mm'}}</div>
          <div class="tl-method">{{contactLabel(c.method)}}</div>
          <div class="tl-notes" *ngIf="c.notes">{{c.notes}}</div>
          <div class="tl-by" *ngIf="c.contactedBy">— {{c.contactedBy}}</div>
        </div>
      </div>
      <ng-template #noHistory><p class="muted">Chưa có lịch sử liên hệ.</p></ng-template>

      <div class="form-actions">
        <button class="primary" (click)="openEdit(detailLead()!)">Sửa</button>
        <button class="btn-sm assign-btn" (click)="openAssign(detailLead()!); detailLead.set(null)" *ngIf="isStaff() && isActiveLead(detailLead()!)">
          {{detailLead()!.saleId ? '🔄 Đổi Sale' : '👤+ Phân bổ'}}
        </button>
        <button class="btn-sm return-btn" (click)="returnToPool(detailLead()!)" *ngIf="isStaff() && detailLead()!.saleId && isActiveLead(detailLead()!)">📦 Thu hồi</button>
        <button class="btn-sm success" (click)="convertLead(detailLead()!)" *ngIf="detailLead()!.status === 'INTERESTED'">Chuyển đổi → Đơn ĐK</button>
        <button type="button" (click)="detailLead.set(null)">Đóng</button>
      </div>
    </div>
  </div>

  <!-- Modal Add Contact -->
  <div class="modal-backdrop" *ngIf="showContactModal()">
    <div class="modal">
      <h3>Ghi nhận liên hệ</h3>
      <form (ngSubmit)="submitContact()">
        <label>Phương thức <span class="req">*</span>
          <select name="contactMethod" [(ngModel)]="contactForm.method">
            <option *ngFor="let m of contactMethods" [value]="m">{{contactLabel(m)}}</option>
          </select>
        </label>
        <label>Ghi chú
          <textarea name="contactNotes" [(ngModel)]="contactForm.notes" rows="3"></textarea>
        </label>
        <label>Hẹn follow-up
          <input type="date" name="nextFollowUp" [(ngModel)]="contactForm.nextFollowUp" />
        </label>
        <div class="form-actions">
          <button type="submit" class="primary">Lưu</button>
          <button type="button" (click)="showContactModal.set(false)">Hủy</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal Mark Lost -->
  <div class="modal-backdrop" *ngIf="showLostModal()">
    <div class="modal">
      <h3>Đánh dấu lead mất</h3>
      <form (ngSubmit)="submitLost()">
        <label>Lý do <span class="req">*</span>
          <select name="lostReason" [(ngModel)]="lostForm.reason">
            <option *ngFor="let r of lostReasons" [value]="r.value">{{r.label}}</option>
          </select>
        </label>
        <label>Ghi chú thêm
          <textarea name="lostNotes" [(ngModel)]="lostForm.notes" rows="2"></textarea>
        </label>
        <div class="form-actions">
          <button type="submit" class="primary danger-btn">Xác nhận mất</button>
          <button type="button" (click)="showLostModal.set(false)">Hủy</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal Assign Sale -->
  <div class="modal-backdrop" *ngIf="showAssignModal()">
    <div class="modal">
      <h3>Phân bổ Lead cho Sale</h3>
      <div *ngIf="assigningLead()" class="assign-lead-info">
        <strong>{{assigningLead()!.leadCode}}</strong> — {{assigningLead()!.parentName}} ({{assigningLead()!.parentPhone}})
        <div *ngIf="assigningLead()!.saleName" class="current-sale">Hiện tại: {{assigningLead()!.saleName}}</div>
      </div>
      <label>Chọn Sale <span class="req">*</span>
        <select [(ngModel)]="assignSaleId" (ngModelChange)="onSaleSelect($event)">
          <option value="">-- Chọn nhân viên Sale --</option>
          <option *ngFor="let s of salesList()" [value]="s._id">{{s.fullName}} ({{s.email}})</option>
        </select>
      </label>
      <div class="form-actions">
        <button class="primary" (click)="submitAssign()" [disabled]="!assignSaleId">Phân bổ</button>
        <button type="button" (click)="showAssignModal.set(false)">Hủy</button>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; padding:16px; }
    .pipeline { display:flex; gap:12px; padding:0 16px 16px; flex-wrap:wrap; }
    .pipe-card { background:#fff; padding:12px 16px; border-radius:8px; border-left:4px solid #e2e8f0; min-width:100px; }
    .pipe-card.highlight { background:#eff6ff; border-left-color:#2563eb; }
    .pipe-card.assigned { background:#f0fdf4; border-left-color:#22c55e; }
    .pipe-card.pool { background:#fef9c3; border-left-color:#f59e0b; }
    .pipe-count { font-size:24px; font-weight:700; color:#0f172a; }
    .pipe-label { font-size:12px; color:#64748b; margin-top:2px; }
    .alert-bar { margin:0 16px 12px; padding:10px 16px; background:#fef3c7; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; color:#92400e; }
    .tabs { display:flex; gap:4px; padding:0 16px 12px; flex-wrap:wrap; }
    .tabs button { background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 16px; border-radius:6px; cursor:pointer; font-size:13px; font-weight:500; position:relative; }
    .tabs button.active { background:#2563eb; color:#fff; border-color:#2563eb; }
    .tabs button:hover:not(.active) { background:#e2e8f0; }
    .tab-badge { display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; border-radius:99px; background:#ef4444; color:#fff; font-size:10px; font-weight:700; margin-left:6px; }
    .tab-badge.warn { background:#f59e0b; }
    .filters { display:flex; gap:10px; padding:0 16px 12px; flex-wrap:wrap; }
    input, select, textarea { padding:6px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:13px; }
    textarea { width:100%; resize:vertical; }
    .data { width:100%; border-collapse:collapse; background:#fff; font-size:13px; }
    th, td { padding:8px 10px; border:1px solid #e2e8f0; }
    thead { background:#f1f5f9; font-size:12px; text-transform:uppercase; color:#64748b; }
    .right { text-align:right; }
    .clickable { cursor:pointer; }
    .clickable:hover { background:#f8fafc; }
    .stale-row { background:#fef2f2; }
    .stale-row:hover { background:#fee2e2; }
    .badge { font-size:11px; padding:2px 8px; border-radius:9px; font-weight:600; white-space:nowrap; }
    .badge.lg { font-size:13px; padding:4px 12px; }
    .overdue { color:#dc2626; font-weight:600; }
    .unassigned-text { color:#f59e0b; font-weight:600; font-size:12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-weight:600; }
    .primary:disabled { background:#94a3b8; cursor:not-allowed; }
    .btn-sm { padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; background:#fff; cursor:pointer; font-size:12px; margin-right:2px; }
    .btn-sm.success { color:#059669; border-color:#6ee7b7; }
    .btn-sm.danger { color:#dc2626; border-color:#fca5a5; }
    .btn-sm.assign-btn { color:#2563eb; border-color:#93c5fd; }
    .btn-sm.return-btn { color:#f59e0b; border-color:#fcd34d; }
    .danger-btn { background:#dc2626; }
    .actions-cell { white-space:nowrap; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:24px; border-radius:8px; max-width:600px; width:95%; box-shadow:0 8px 24px rgba(15,23,42,.2); max-height:90vh; overflow-y:auto; }
    .modal.wide { max-width:680px; }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .form-grid label, .full { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#334155; }
    .full { margin-top:8px; }
    .req { color:#dc2626; }
    .form-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
    .error { color:#dc2626; font-size:13px; }
    .empty-text { padding:16px; color:#64748b; }
    .detail-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; margin-bottom:12px; }
    .timeline { margin:8px 0; }
    .tl-item { padding:8px 12px; border-left:2px solid #2563eb; margin-bottom:8px; font-size:13px; }
    .tl-date { font-size:11px; color:#64748b; }
    .tl-method { font-weight:600; }
    .tl-notes { margin-top:2px; }
    .tl-by { font-size:11px; color:#94a3b8; }
    .muted { color:#94a3b8; font-size:13px; }
    h4 { margin:16px 0 8px; color:#334155; }
    .follow-up-list { margin:0 16px 12px; background:#fff; border-radius:8px; padding:12px; }
    .fu-item { padding:6px 0; border-bottom:1px solid #e2e8f0; cursor:pointer; font-size:13px; display:flex; justify-content:space-between; }
    .fu-item:hover { color:#2563eb; }
    .fu-date { font-size:11px; color:#64748b; }
    .assign-lead-info { background:#f8fafc; padding:10px 12px; border-radius:6px; margin-bottom:12px; font-size:13px; }
    .current-sale { color:#64748b; font-size:12px; margin-top:4px; }
    .assignment-history { margin:4px 0 8px; }
    .ah-item { padding:8px 12px; border-left:2px solid #8b5cf6; margin-bottom:6px; font-size:12px; }
    .ah-date { display:block; color:#64748b; font-size:11px; }
    .ah-returned { display:block; color:#f59e0b; font-size:11px; }
    .ah-reason { color:#94a3b8; }
    .ah-current { display:inline-block; padding:1px 6px; border-radius:3px; background:#d1fae5; color:#059669; font-size:10px; font-weight:600; margin-left:6px; }
  `]
})
export class LeadsComponent implements OnInit {
  items = signal<LeadItem[]>([]);
  poolItems = signal<LeadItem[]>([]);
  staleItems = signal<LeadItem[]>([]);
  pipeline = signal<LeadPipeline | null>(null);
  followUpList = signal<LeadItem[]>([]);
  salesList = signal<any[]>([]);
  showModal = signal(false);
  showContactModal = signal(false);
  showLostModal = signal(false);
  showAssignModal = signal(false);
  assigningLead = signal<LeadItem | null>(null);
  detailLead = signal<LeadItem | null>(null);
  error = signal('');
  editingId: string | null = null;
  activeLeadId: string | null = null;

  keyword = '';
  filterStatus = '';
  filterSource = '';
  activeTab: 'all' | 'pool' | 'stale' | 'follow-ups' = 'all';
  subjectsText = '';
  assignSaleId = '';
  assignSaleName = '';

  form: any = this.emptyForm();
  contactForm = { method: 'CALL', notes: '', nextFollowUp: '' };
  lostForm = { reason: 'PRICE_TOO_HIGH', notes: '' };

  pipelineStatuses = ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED', 'CONVERTED'];
  allStatuses = Object.keys(STATUS_LABELS);
  allSources = Object.keys(SOURCE_LABELS);
  contactMethods = Object.keys(CONTACT_LABELS);
  lostReasons = Object.entries(LOST_LABELS).map(([value, label]) => ({ value, label }));

  adGroupsByPlatform = signal<AdGroupItem[]>([]);

  constructor(
    private leadService: LeadService,
    private auth: AuthService,
    private userService: UserService,
    private adsService: AdsService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.reload();
    if (this.isStaff()) {
      this.loadSales();
    }
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  statusColor(s: string) { return STATUS_COLORS[s] || '#64748b'; }
  sourceLabel(s: string) { return SOURCE_LABELS[s] || s; }
  contactLabel(s: string) { return CONTACT_LABELS[s] || s; }
  isActiveLead(l: LeadItem) { return !['CONVERTED', 'NOT_INTERESTED'].includes(l.status); }
  isOverdue(d: string) { return new Date(d) < new Date(); }

  isStaff(): boolean {
    return this.auth.hasRole([Role.DIRECTOR, Role.OPS]);
  }

  isStale(l: LeadItem): boolean {
    if (!l.saleId || !this.isActiveLead(l)) return false;
    const ref = l.lastContactAt || l.assignedAt;
    if (!ref) return false;
    const diff = Date.now() - new Date(ref).getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
  }

  poolCount = computed(() => this.pipeline()?.unassignedCount || 0);

  emptyForm() {
    return { parentName: '', parentPhone: '', parentEmail: '', studentName: '', studentGrade: '',
      source: 'OTHER', referredBy: '', estimatedValue: 0, notes: '', adGroupId: '', adGroupName: '' };
  }

  async onAdGroupChange() {
    const grp = this.adGroupsByPlatform().find(g => g._id === this.form.adGroupId);
    this.form.adGroupName = grp?.name || '';
  }

  async loadAdGroups(platform: string) {
    if (['FACEBOOK', 'GOOGLE', 'TIKTOK'].includes(platform)) {
      try {
        const groups = await this.adsService.getGroupsByPlatform(platform);
        this.adGroupsByPlatform.set(groups);
      } catch { this.adGroupsByPlatform.set([]); }
    } else {
      this.adGroupsByPlatform.set([]);
    }
  }

  filtered = computed(() => {
    let list: LeadItem[] = [];
    switch (this.activeTab) {
      case 'pool': list = this.poolItems(); break;
      case 'stale': list = this.staleItems(); break;
      case 'follow-ups': list = this.followUpList(); break;
      default: list = this.items(); break;
    }
    const kw = this.keyword.trim().toLowerCase();
    if (kw) list = list.filter(l =>
      l.parentName.toLowerCase().includes(kw) || l.parentPhone.includes(kw) ||
      l.leadCode.toLowerCase().includes(kw) || (l.studentName || '').toLowerCase().includes(kw));
    if (this.filterStatus && this.activeTab === 'all') list = list.filter(l => l.status === this.filterStatus);
    if (this.filterSource) list = list.filter(l => l.source === this.filterSource);
    return list;
  });

  followUps = computed(() => this.followUpList());

  applyFilter() { /* triggers computed */ }

  switchTab(tab: 'all' | 'pool' | 'stale' | 'follow-ups') {
    this.activeTab = tab;
    this.keyword = '';
    this.filterStatus = '';
    this.filterSource = '';
    if (tab === 'pool') this.loadPool();
    if (tab === 'stale') this.loadStale();
    this.applyFilter();
  }

  async reload() {
    const [items, pipeline, followUps] = await Promise.all([
      this.leadService.list(),
      this.leadService.getPipeline(),
      this.leadService.getFollowUps(),
    ]);
    this.items.set(items);
    this.pipeline.set(pipeline);
    this.followUpList.set(followUps);
    // Refresh sub-tabs if active
    if (this.activeTab === 'pool') this.loadPool();
    if (this.activeTab === 'stale') this.loadStale();
  }

  async loadPool() {
    const pool = await this.leadService.getPool();
    this.poolItems.set(pool);
  }

  async loadStale() {
    const stale = await this.leadService.list({ stale: 'true' });
    this.staleItems.set(stale);
  }

  async loadSales() {
    const sales = await this.userService.listSales();
    this.salesList.set(sales);
  }

  onSaleSelect(saleId: string) {
    const sale = this.salesList().find(s => s._id === saleId);
    this.assignSaleName = sale?.fullName || '';
  }

  openCreate() {
    this.editingId = null;
    this.form = this.emptyForm();
    this.subjectsText = '';
    this.error.set('');
    this.showModal.set(true);
  }

  openEdit(l: LeadItem) {
    this.editingId = l._id;
    this.form = { ...l };
    this.subjectsText = (l.interestedSubjects || []).join(', ');
    this.error.set('');
    this.detailLead.set(null);
    this.showModal.set(true);
  }

  closeModal() { this.showModal.set(false); this.editingId = null; }

  openDetail(l: LeadItem) { this.detailLead.set(l); }

  openContact(l: LeadItem) {
    this.activeLeadId = l._id;
    this.contactForm = { method: 'CALL', notes: '', nextFollowUp: '' };
    this.showContactModal.set(true);
  }

  openLost(l: LeadItem) {
    this.activeLeadId = l._id;
    this.lostForm = { reason: 'PRICE_TOO_HIGH', notes: '' };
    this.showLostModal.set(true);
  }

  openAssign(l: LeadItem) {
    this.assigningLead.set(l);
    this.assignSaleId = l.saleId || '';
    this.assignSaleName = l.saleName || '';
    this.showAssignModal.set(true);
  }

  async submitAssign() {
    const lead = this.assigningLead();
    if (!lead || !this.assignSaleId) return;
    const res = await this.leadService.assign(lead._id, this.assignSaleId, this.assignSaleName);
    if (!res.ok) { alert(res.message); return; }
    this.showAssignModal.set(false);
    this.assigningLead.set(null);
    this.reload();
  }

  async returnToPool(l: LeadItem) {
    const reason = prompt('Lý do thu hồi về kho (để trống nếu không cần):');
    if (reason === null) return; // cancelled
    const res = await this.leadService.returnToPool(l._id, reason || 'Thu hồi thủ công');
    if (!res.ok) { alert(res.message); return; }
    this.detailLead.set(null);
    this.reload();
  }

  async submitForm() {
    const payload: any = { ...this.form };
    payload.interestedSubjects = this.subjectsText.split(',').map((s: string) => s.trim()).filter(Boolean);

    if (this.editingId) {
      const res = await this.leadService.update(this.editingId, payload);
      if (!res.ok) { this.error.set(res.message || 'Lỗi'); return; }
    } else {
      const res = await this.leadService.create(payload);
      if (!res.ok) { this.error.set(res.message || 'Lỗi'); return; }
    }
    this.closeModal();
    this.reload();
  }

  async submitContact() {
    if (!this.activeLeadId) return;
    const res = await this.leadService.addContact(this.activeLeadId, this.contactForm);
    if (!res.ok) { alert(res.message); return; }
    this.showContactModal.set(false);
    this.reload();
  }

  async submitLost() {
    if (!this.activeLeadId) return;
    const res = await this.leadService.markLost(this.activeLeadId, this.lostForm.reason, this.lostForm.notes);
    if (!res.ok) { alert(res.message); return; }
    this.showLostModal.set(false);
    this.reload();
  }

  async convertLead(l: LeadItem) {
    if (!confirm(`Chuyển đổi lead "${l.parentName}" → tạo đơn đăng ký?`)) return;
    const res = await this.leadService.convert(l._id);
    if (!res.ok) { alert(res.message); return; }
    alert(res.message || 'Đã chuyển đổi! Hãy tạo đơn đăng ký.');
    this.detailLead.set(null);
    this.router.navigate(['/app/orders'], { queryParams: { fromLead: l._id } });
  }
}
