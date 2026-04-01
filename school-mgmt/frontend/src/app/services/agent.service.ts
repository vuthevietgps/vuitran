import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface AgentItem {
  _id: string;
  agentCode: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountHolder?: string;
  tier: string;
  commissionRate: number;
  status: string;
  totalReferred: number;
  totalCommissionPaid: number;
  createdById: string;
  createdByName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentPaginatedResponse {
  data: AgentItem[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private apiUrl = `${environment.apiBase}/agents`;

  constructor(private http: HttpClient) {}

  async list(params?: Record<string, string>): Promise<AgentPaginatedResponse> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) httpParams = httpParams.set(key, value);
      });
    }
    return this.http.get<AgentPaginatedResponse>(this.apiUrl, { params: httpParams }).toPromise() as any;
  }

  async getOne(id: string): Promise<AgentItem> {
    return this.http.get<AgentItem>(`${this.apiUrl}/${id}`).toPromise() as any;
  }

  async create(data: any): Promise<AgentItem> {
    return this.http.post<AgentItem>(this.apiUrl, data).toPromise() as any;
  }

  async update(id: string, data: any): Promise<AgentItem> {
    return this.http.patch<AgentItem>(`${this.apiUrl}/${id}`, data).toPromise() as any;
  }

  async delete(id: string): Promise<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).toPromise() as any;
  }

  async suspend(id: string): Promise<AgentItem> {
    return this.http.post<AgentItem>(`${this.apiUrl}/${id}/suspend`, {}).toPromise() as any;
  }

  async activate(id: string): Promise<AgentItem> {
    return this.http.post<AgentItem>(`${this.apiUrl}/${id}/activate`, {}).toPromise() as any;
  }
}
