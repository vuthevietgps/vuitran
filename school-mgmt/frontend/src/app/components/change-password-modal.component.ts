import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, OnDestroy, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

interface ChangePasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ChangePasswordTouchedState {
  currentPassword: boolean;
  newPassword: boolean;
  confirmPassword: boolean;
}

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="modal-backdrop"
      data-testid="change-password-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      (click)="close()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h3 id="change-password-title">Doi mat khau</h3>
            <p>Doi mat khau cho tai khoan dang dang nhap.</p>
          </div>
          <button
            type="button"
            class="close-button"
            data-testid="change-password-close"
            aria-label="Dong form doi mat khau"
            (click)="close()"
            [disabled]="submitting || redirecting">
            &times;
          </button>
        </div>

        <div
          *ngIf="successMessage"
          class="toast success"
          data-testid="change-password-success-toast"
          role="status">
          {{ successMessage }}
        </div>

        <div
          *ngIf="errorMessage"
          class="alert error"
          data-testid="change-password-error"
          role="alert">
          {{ errorMessage }}
        </div>

        <form class="form" (ngSubmit)="submit()" novalidate>
          <label class="field">
            <span>Mat khau hien tai</span>
            <input
              type="password"
              name="currentPassword"
              autocomplete="current-password"
              [(ngModel)]="form.currentPassword"
              (blur)="markTouched('currentPassword')"
              data-testid="change-password-current" />
            <small
              *ngIf="shouldShowCurrentPasswordRequired()"
              class="field-error"
              data-testid="change-password-current-error">
              Vui long nhap mat khau hien tai.
            </small>
          </label>

          <label class="field">
            <span>Mat khau moi</span>
            <input
              type="password"
              name="newPassword"
              autocomplete="new-password"
              [(ngModel)]="form.newPassword"
              (blur)="markTouched('newPassword')"
              data-testid="change-password-new" />
            <small class="field-hint">
              It nhat 8 ky tu, co chu cai va chu so.
            </small>
            <small
              *ngIf="shouldShowNewPasswordWeak()"
              class="field-error"
              data-testid="change-password-new-error">
              Mat khau moi phai co it nhat 8 ky tu, gom chu cai va chu so.
            </small>
          </label>

          <label class="field">
            <span>Xac nhan mat khau moi</span>
            <input
              type="password"
              name="confirmPassword"
              autocomplete="new-password"
              [(ngModel)]="form.confirmPassword"
              (blur)="markTouched('confirmPassword')"
              data-testid="change-password-confirm" />
            <small
              *ngIf="shouldShowConfirmPasswordRequired()"
              class="field-error"
              data-testid="change-password-confirm-required">
              Vui long xac nhan mat khau moi.
            </small>
            <small
              *ngIf="shouldShowConfirmPasswordMismatch()"
              class="field-error"
              data-testid="change-password-confirm-error">
              Xac nhan mat khau moi khong khop.
            </small>
          </label>

          <div class="actions">
            <button
              type="button"
              class="secondary"
              (click)="close()"
              [disabled]="submitting || redirecting">
              Huy
            </button>
            <button
              type="submit"
              class="primary"
              data-testid="change-password-submit"
              [disabled]="submitting || redirecting">
              {{ submitting ? 'Dang doi...' : (redirecting ? 'Dang dang xuat...' : 'Cap nhat mat khau') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host {
      inset: 0;
      position: fixed;
      z-index: 80;
    }
    .modal-backdrop {
      align-items: center;
      background: rgba(15, 23, 42, 0.66);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: 24px;
      position: fixed;
    }
    .modal-card {
      background: #ffffff;
      border-radius: 18px;
      box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
      max-width: 460px;
      padding: 24px;
      position: relative;
      width: min(100%, 460px);
    }
    .modal-header {
      align-items: flex-start;
      display: flex;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .modal-header h3 {
      color: #0f172a;
      font-size: 22px;
      margin: 0;
    }
    .modal-header p {
      color: #64748b;
      font-size: 13px;
      margin: 6px 0 0;
    }
    .close-button {
      background: transparent;
      border: none;
      border-radius: 999px;
      color: #475569;
      cursor: pointer;
      font-size: 28px;
      height: 36px;
      line-height: 1;
      width: 36px;
    }
    .close-button:hover:enabled {
      background: #e2e8f0;
    }
    .alert,
    .toast {
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 16px;
      padding: 12px 14px;
    }
    .alert.error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
    }
    .toast.success {
      background: #ecfdf5;
      border: 1px solid #86efac;
      color: #166534;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field span {
      color: #0f172a;
      font-size: 14px;
      font-weight: 600;
    }
    .field input {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      font: inherit;
      font-size: 14px;
      padding: 11px 12px;
    }
    .field input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
      outline: none;
    }
    .field-hint {
      color: #64748b;
      font-size: 12px;
    }
    .field-error {
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
    }
    .actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 6px;
    }
    .primary,
    .secondary {
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      min-width: 140px;
      padding: 11px 18px;
    }
    .primary {
      background: #1d4ed8;
      color: #ffffff;
    }
    .primary:hover:enabled {
      background: #1e40af;
    }
    .secondary {
      background: #e2e8f0;
      color: #0f172a;
    }
    .secondary:hover:enabled {
      background: #cbd5e1;
    }
    .primary:disabled,
    .secondary:disabled,
    .close-button:disabled {
      cursor: not-allowed;
      opacity: 0.72;
    }
    @media (max-width: 640px) {
      .modal-backdrop {
        align-items: flex-end;
        padding: 12px;
      }
      .modal-card {
        border-radius: 18px 18px 0 0;
        max-width: none;
        width: 100%;
      }
      .actions {
        flex-direction: column-reverse;
      }
      .primary,
      .secondary {
        width: 100%;
      }
    }
  `],
})
export class ChangePasswordModalComponent implements OnDestroy {
  @Output() readonly closed = new EventEmitter<void>();

  private readonly auth = inject(AuthService);
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;

  form: ChangePasswordFormState = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  touched: ChangePasswordTouchedState = {
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  };

  submitting = false;
  redirecting = false;
  errorMessage = '';
  successMessage = '';

  ngOnDestroy(): void {
    this.clearLogoutTimer();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  markTouched(field: keyof ChangePasswordTouchedState): void {
    this.touched[field] = true;
  }

  shouldShowCurrentPasswordRequired(): boolean {
    return this.touched.currentPassword && !this.form.currentPassword;
  }

  shouldShowNewPasswordWeak(): boolean {
    return this.touched.newPassword && !!this.form.newPassword && !this.isStrongPassword(this.form.newPassword);
  }

  shouldShowConfirmPasswordRequired(): boolean {
    return this.touched.confirmPassword && !this.form.confirmPassword;
  }

  shouldShowConfirmPasswordMismatch(): boolean {
    return this.touched.confirmPassword
      && !!this.form.confirmPassword
      && this.form.confirmPassword !== this.form.newPassword;
  }

  async submit(): Promise<void> {
    this.markAllTouched();
    this.errorMessage = '';

    if (!this.isFormValid()) {
      return;
    }

    this.submitting = true;
    const result = await this.auth.changePassword(this.form.currentPassword, this.form.newPassword);
    this.submitting = false;

    if (!result.ok) {
      this.errorMessage = result.message || 'Khong the doi mat khau. Vui long kiem tra lai va thu lai.';
      return;
    }

    this.resetForm();
    this.successMessage = 'Doi mat khau thanh cong. He thong se dang xuat de dang nhap lai.';
    this.redirecting = true;
    this.clearLogoutTimer();
    this.logoutTimer = setTimeout(() => {
      void this.auth.logout();
    }, this.getLogoutDelayMs());
  }

  close(): void {
    if (this.submitting || this.redirecting) {
      return;
    }
    this.errorMessage = '';
    this.successMessage = '';
    this.resetForm();
    this.closed.emit();
  }

  private markAllTouched(): void {
    this.touched.currentPassword = true;
    this.touched.newPassword = true;
    this.touched.confirmPassword = true;
  }

  private isFormValid(): boolean {
    if (!this.form.currentPassword) {
      return false;
    }
    if (!this.isStrongPassword(this.form.newPassword)) {
      return false;
    }
    if (!this.form.confirmPassword) {
      return false;
    }
    return this.form.confirmPassword === this.form.newPassword;
  }

  private isStrongPassword(value: string): boolean {
    return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(value);
  }

  private resetForm(): void {
    this.form = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
    this.touched = {
      currentPassword: false,
      newPassword: false,
      confirmPassword: false,
    };
  }

  private clearLogoutTimer(): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
  }

  private getLogoutDelayMs(): number {
    const testWindow = globalThis as typeof globalThis & {
      __changePasswordLogoutDelayMs?: number;
    };
    const configuredDelay = Number(testWindow.__changePasswordLogoutDelayMs ?? 1200);
    return Number.isFinite(configuredDelay) && configuredDelay >= 0 ? configuredDelay : 1200;
  }
}
