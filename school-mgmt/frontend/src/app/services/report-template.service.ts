import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type ReportTemplateDynamicFieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'date';

export interface ReportTemplateDynamicFieldOption {
  value: string;
  label: string;
}

export interface ReportTemplateDynamicFieldDefinition {
  key: string;
  label: string;
  type: ReportTemplateDynamicFieldType;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  order?: number;
  defaultValue?: string;
  options?: ReportTemplateDynamicFieldOption[];
}

export interface ReportTemplate {
  _id: string;
  teacherId: string;
  classId?: string;
  title: string;
  templateContent: string;
  version?: number;
  dynamicFields?: ReportTemplateDynamicFieldDefinition[];
  isGlobal?: boolean;
  createdAt?: string;
}

export interface CreateReportTemplateDto {
  title: string;
  templateContent: string;
  classId?: string;
  version?: number;
  dynamicFields?: ReportTemplateDynamicFieldDefinition[];
}

@Injectable({ providedIn: 'root' })
export class ReportTemplateService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/report-templates`;

  async list(): Promise<ReportTemplate[]> {
    return firstValueFrom(this.http.get<ReportTemplate[]>(this.base));
  }

  async create(dto: CreateReportTemplateDto): Promise<ReportTemplate> {
    return firstValueFrom(this.http.post<ReportTemplate>(this.base, dto));
  }

  async remove(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${this.base}/${id}`));
  }
}
