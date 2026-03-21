import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReportTemplate {
  _id: string;
  teacherId: string;
  classId?: string;
  title: string;
  templateContent: string;
  isGlobal?: boolean;
  createdAt?: string;
}

export interface CreateReportTemplateDto {
  title: string;
  templateContent: string;
  classId?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportTemplateService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/report-templates`;

  /** Lấy danh sách template của GV + global templates */
  async list(): Promise<ReportTemplate[]> {
    return firstValueFrom(this.http.get<ReportTemplate[]>(this.base));
  }

  /** Tạo template mới */
  async create(dto: CreateReportTemplateDto): Promise<ReportTemplate> {
    return firstValueFrom(this.http.post<ReportTemplate>(this.base, dto));
  }

  /** Xóa template */
  async remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
