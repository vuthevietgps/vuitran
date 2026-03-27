import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PendingApprovalsService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/pending-approvals`;

  getAll() {
    return firstValueFrom(this.http.get<any>(this.base));
  }

  getSummary() {
    return firstValueFrom(this.http.get<any>(`${this.base}/summary`));
  }

  getPendingPayrolls() {
    return firstValueFrom(this.http.get<any>(`${this.base}/payrolls`));
  }

  getPendingInvoices() {
    return firstValueFrom(this.http.get<any>(`${this.base}/invoices`));
  }

  getPendingTopUps() {
    return firstValueFrom(this.http.get<any>(`${this.base}/topups`));
  }

  getPendingTeachers() {
    return firstValueFrom(this.http.get<any>(`${this.base}/teachers`));
  }

  getPendingClassUpdates() {
    return firstValueFrom(this.http.get<any>(`${this.base}/classes`));
  }
}
