import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface UserItem {
  _id: string;
  userCode?: string;
  email: string;
  fullName: string;
  role: string;
  status?: string;
  phone?: string;
  ownershipPercentage?: number | null;
  saleOwnerId?: string | null;
  saleOwnerName?: string;
  facebookLink?: string;
  address?: string;
  adGroupId?: string | null;
  adGroupName?: string;
  adPlatform?: string;
  adAttributionSource?: string | null;
}

export interface ParentAdsAttributionItem {
  parentUserId: string;
  parentName?: string;
  parentPhone?: string;
  parentKey?: string | null;
  adGroupId?: string | null;
  adGroupName?: string;
  platform?: string;
  attributionModel?: string | null;
  sourceType?: string | null;
  firstAttributedAt?: string | null;
  lastConfirmedAt?: string | null;
  notes?: string;
  matchedBy?: 'PARENT_USER' | 'PHONE_FALLBACK' | 'UNASSIGNED';
}

export interface ParentManagementListResponse {
  data: UserItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateUserPayload {
  userCode: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
  phone?: string;
  ownershipPercentage?: number;
  facebookLink?: string;
  address?: string;
  saleOwnerId?: string;
  managedSales?: string[];
  salaryConfig?: CreateUserSalaryConfigPayload;
}

export type UpdateUserPayload = Partial<CreateUserPayload>;

export interface CreateUserCommissionTierPayload {
  minRevenue: number;
  maxRevenue?: number | null;
  percentage: number;
}

export interface CreateUserKpiBonusTierPayload {
  minScore: number;
  maxScore?: number | null;
  bonusPercentage: number;
}

export interface CreateUserSalaryConfigPayload {
  baseSalary: number;
  standardHours: number;
  scheduledStartTime: string;
  latePenaltyAmount: number;
  commissionEnabled?: boolean;
  commissionType?: string;
  commissionTiers?: CreateUserCommissionTierPayload[];
  kpiBonusEnabled?: boolean;
  kpiBonusTiers?: CreateUserKpiBonusTierPayload[];
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  private buildParams(params: Record<string, string | number | null | undefined>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });
    return httpParams;
  }

  async list(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listDirectory(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/directory`, {
          withCredentials: true,
        }),
      );
    } catch {
      return [];
    }
  }

  async listTeachers(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/teachers`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listSales(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/sales`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listParents(): Promise<UserItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<UserItem[]>(`${environment.apiBase}/users/parents`, { withCredentials: true }),
      );
    } catch {
      return [];
    }
  }

  async listParentsManagement(params: {
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<ParentManagementListResponse> {
    try {
      return await firstValueFrom(
        this.http.get<ParentManagementListResponse>(`${environment.apiBase}/users/parents/management`, {
          params: this.buildParams(params),
          withCredentials: true,
        }),
      );
    } catch {
      return {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: Number(params.limit) || 50,
          totalPages: 1,
        },
      };
    }
  }

  async create(payload: CreateUserPayload): Promise<UserItem> {
    return firstValueFrom(
      this.http.post<UserItem>(`${environment.apiBase}/users`, payload, { withCredentials: true }),
    );
  }

  async update(id: string, payload: UpdateUserPayload): Promise<UserItem> {
    return firstValueFrom(
      this.http.patch<UserItem>(`${environment.apiBase}/users/${id}`, payload, { withCredentials: true }),
    );
  }

  async remove(id: string): Promise<boolean> {
    await firstValueFrom(
      this.http.delete(`${environment.apiBase}/users/${id}`, { withCredentials: true }),
    );
    return true;
  }

  async getParentAdsAttribution(id: string): Promise<ParentAdsAttributionItem> {
    return firstValueFrom(
      this.http.get<ParentAdsAttributionItem>(`${environment.apiBase}/users/${id}/ads-attribution`, {
        withCredentials: true,
      }),
    );
  }

  async updateParentAdsAttribution(id: string, payload: { adGroupId: string }): Promise<ParentAdsAttributionItem> {
    return firstValueFrom(
      this.http.patch<ParentAdsAttributionItem>(
        `${environment.apiBase}/users/${id}/ads-attribution`,
        payload,
        { withCredentials: true },
      ),
    );
  }

  async clearParentAdsAttribution(id: string): Promise<ParentAdsAttributionItem> {
    return firstValueFrom(
      this.http.delete<ParentAdsAttributionItem>(`${environment.apiBase}/users/${id}/ads-attribution`, {
        withCredentials: true,
      }),
    );
  }
}
