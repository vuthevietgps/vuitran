import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Role } from '../models/role.enum';

export interface AuthPayload {
  _id?: string;
  sub: string;
  email: string;
  role: string;
  fullName: string;
  userCode?: string;
}

export interface LoginResult {
  ok: boolean;
  status?: number;
  message?: string;
}

const DEFAULT_APP_ROUTE = '/app/dashboard';
const SHAREHOLDER_APP_ROUTE = '/app/investor-dashboard';

function extractHttpErrorMessage(httpError: HttpErrorResponse): string | undefined {
  const rawMessage = httpError?.error?.message;
  if (Array.isArray(rawMessage)) {
    return rawMessage.filter((item): item is string => typeof item === 'string').join(', ');
  }
  return typeof rawMessage === 'string' ? rawMessage : undefined;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  userSignal = signal<AuthPayload | null>(null);
  private _restored = false;

  isLoggedIn(): boolean {
    return !!this.userSignal();
  }

  /** Restore session from httpOnly cookie on page load */
  async restoreSession(): Promise<boolean> {
    if (this._restored) return this.isLoggedIn();
    this._restored = true;
    try {
      const data = await firstValueFrom(
        this.http.get<AuthPayload & { _id: string }>(`${environment.apiBase}/users/me`, {
          withCredentials: true,
        }),
      );
      if (data?.email) {
        this.userSignal.set({
          sub: data._id,
          email: data.email,
          role: data.role,
          fullName: data.fullName,
          userCode: data.userCode,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const data = await firstValueFrom(
        this.http.post<{ user: AuthPayload }>(
          `${environment.apiBase}/auth/login`,
          { email, password },
          { withCredentials: true },
        ),
      );
      this.userSignal.set(data.user);
      return { ok: true };
    } catch (err) {
      const httpError = err as HttpErrorResponse;
      return {
        ok: false,
        status: httpError?.status,
        message: extractHttpErrorMessage(httpError),
      };
    }
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<LoginResult> {
    try {
      const response = await firstValueFrom(
        this.http.post<{ message?: string }>(
          `${environment.apiBase}/auth/change-password`,
          { oldPassword, newPassword },
          { withCredentials: true },
        ),
      );
      return {
        ok: true,
        message: response?.message,
      };
    } catch (err) {
      const httpError = err as HttpErrorResponse;
      return {
        ok: false,
        status: httpError?.status,
        message: extractHttpErrorMessage(httpError),
      };
    }
  }

  async logout() {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiBase}/auth/logout`, {}, { withCredentials: true }),
      );
    } catch {
      // ignore
    }
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  getDefaultAppRoute(role: string | null | undefined = this.userSignal()?.role): string {
    return role === Role.SHAREHOLDER ? SHAREHOLDER_APP_ROUTE : DEFAULT_APP_ROUTE;
  }

  hasRole(roles: string[]): boolean {
    const u = this.userSignal();
    return !!u && roles.includes(u.role);
  }
}
