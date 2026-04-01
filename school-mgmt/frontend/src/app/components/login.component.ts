import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <section class="login-wrapper">
    <form (ngSubmit)="submit()" class="login-card" autocomplete="off">
      <h2>Dang nhap</h2>
      <label>Email
        <input
          type="email"
          [(ngModel)]="email"
          name="email"
          required
          [disabled]="loading()"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>
      <label>Mat khau
        <input
          [type]="showPassword() ? 'text' : 'password'"
          [(ngModel)]="password"
          name="password"
          required
          [disabled]="loading()"
          autocomplete="current-password"
          autocapitalize="off"
          spellcheck="false"
        />
      </label>
      <label class="inline-option">
        <input type="checkbox" [ngModel]="showPassword()" (ngModelChange)="showPassword.set(!!$event)" name="showPassword" [disabled]="loading()" />
        <span>Hien mat khau</span>
      </label>
      <button type="submit" [disabled]="loading()">
        {{ loading() ? 'Dang xu ly...' : 'Dang nhap' }}
      </button>
      <button
        *ngIf="isDemoSchoolHost"
        type="button"
        class="secondary"
        [disabled]="loading()"
        (click)="loginDemoAdmin()"
      >
        Dang nhap demo admin
      </button>
      <p class="error" *ngIf="error()">{{error()}}</p>
    </form>
  </section>
  `,
  styles: [`
    .login-wrapper { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f1f5f9; }
    .login-card { background:#fff; padding:24px; border-radius:8px; box-shadow:0 8px 24px rgba(15,23,42,.15); width:320px; display:flex; flex-direction:column; gap:12px; }
    label { display:flex; flex-direction:column; font-size:14px; color:#475569; }
    input { padding:8px; border:1px solid #cbd5f5; border-radius:6px; }
    .inline-option { flex-direction:row; align-items:center; gap:8px; color:#334155; }
    .inline-option input { width:auto; padding:0; }
    button { padding:10px; border:none; border-radius:6px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; }
    button:hover { background:#1d4ed8; }
    button:disabled { opacity:.7; cursor:not-allowed; }
    .secondary { background:#0f172a; }
    .secondary:hover { background:#020617; }
    .error { color:#dc2626; font-size:13px; margin:0; }
  `],
})
export class LoginComponent {
  private readonly demoAdminEmail = 'admin@demoschool.smarterp.vn';
  private readonly demoAdminPassword = '123456';
  readonly isDemoSchoolHost =
    typeof window !== 'undefined' && window.location.hostname === 'demoschool.smarterp.vn';

  email = '';
  password = '';
  error = signal('');
  loading = signal(false);
  showPassword = signal(false);

  constructor(private auth: AuthService, private router: Router) {}

  async submit() {
    if (this.loading()) return;

    this.email = this.email.trim().toLowerCase();
    this.error.set('');
    this.loading.set(true);
    const result = await this.auth.login(this.email, this.password);
    this.loading.set(false);

    if (!result.ok) {
      if (result.status === 429) {
        this.error.set('Ban da thu qua nhieu lan. Vui long doi 1 phut.');
      } else if (result.status === 401) {
        this.error.set('Sai email hoac mat khau');
      } else {
        this.error.set(result.message || 'Dang nhap that bai');
      }
      return;
    }

    this.router.navigate(['/app/dashboard']);
  }

  async loginDemoAdmin() {
    this.email = this.demoAdminEmail;
    this.password = this.demoAdminPassword;
    await this.submit();
  }
}
