import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CommissionTier {
  minRevenue: number;
  maxRevenue?: number | null;
  percentage: number;
}

export interface KpiBonusTier {
  minScore: number;
  maxScore?: number | null;
  bonusPercentage: number;
}

export interface SalaryConfig {
  _id?: string;
  userId: string | number;
  userName?: string;
  userRole?: string;
  baseSalary: number;
  standardHours: number;
  scheduledStartTime: string;
  latePenaltyAmount: number;
  punctualityBonusAmount?: number;
  experienceCaseRate?: number;
  homeworkGradingRate?: number;
  commissionEnabled: boolean;
  commissionType?: string;
  commissionTiers?: CommissionTier[];
  kpiBonusEnabled: boolean;
  kpiBonusTiers?: KpiBonusTier[];
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryConfigUserOption {
  _id: string;
  fullName: string;
  role: string;
  status?: string;
  hasSalaryConfig?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SalaryConfigService {
  private apiUrl = `${environment.apiBase}/salary-config`;

  constructor(private http: HttpClient) {}

  async list(params?: Record<string, string>): Promise<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return firstValueFrom(this.http.get(this.apiUrl, { params: httpParams }));
  }

  async getMy(): Promise<SalaryConfig> {
    return firstValueFrom(this.http.get<SalaryConfig>(`${this.apiUrl}/my`));
  }

  async getByUserId(userId: string): Promise<SalaryConfig> {
    return firstValueFrom(this.http.get<SalaryConfig>(`${this.apiUrl}/${userId}`));
  }

  async listUserOptions(): Promise<SalaryConfigUserOption[]> {
    return firstValueFrom(this.http.get<SalaryConfigUserOption[]>(`${this.apiUrl}/users/options`));
  }

  async create(data: any): Promise<SalaryConfig> {
    return firstValueFrom(this.http.post<SalaryConfig>(this.apiUrl, data));
  }

  async update(userId: string, data: any): Promise<SalaryConfig> {
    return firstValueFrom(this.http.put<SalaryConfig>(`${this.apiUrl}/${userId}`, data));
  }

  async delete(userId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${userId}`));
  }
}
