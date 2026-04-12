import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TeacherRegistrationLinkedUser {
  _id: string;
  userCode?: string;
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface TeacherRegistration {
  _id: string;
  applicationCode: string;
  fullName: string;
  phone: string;
  email?: string;
  subjects: string[];
  grades: string[];
  teachingMode: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations: string[];
  yearsOfExperience: number;
  bio?: string;
  sourcePage?: string;
  status: 'NEW' | 'INTERVIEWING' | 'APPROVED' | 'CONVERTED' | 'REJECTED';
  interviewNotes?: string;
  adminNotes?: string;
  interviewedAt?: string;
  decidedAt?: string;
  convertedUserCode?: string;
  convertedAt?: string;
  convertedBy?: TeacherRegistrationLinkedUser;
  convertedUserId?: TeacherRegistrationLinkedUser | string;
  convertedTeacherProfileId?: { _id: string; status?: string } | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherRegistrationUpdatePayload {
  fullName?: string;
  phone?: string;
  email?: string;
  subjects?: string[];
  grades?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations?: string[];
  yearsOfExperience?: number;
  bio?: string;
  status?: 'NEW' | 'INTERVIEWING' | 'APPROVED' | 'CONVERTED' | 'REJECTED';
  interviewNotes?: string;
  adminNotes?: string;
}

export interface TeacherRegistrationConvertPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  userCode?: string;
  password: string;
  managedSales?: string[];
  subjects?: string[];
  grades?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations?: string[];
  yearsOfExperience?: number;
  bio?: string;
  pricePerSession?: number;
  pricePerHour?: number;
}

export interface PublicTeacherRegistrationPayload {
  fullName: string;
  phone: string;
  email?: string;
  subjects?: string[];
  grades?: string[];
  teachingMode?: 'ONLINE' | 'OFFLINE' | 'BOTH';
  locations?: string[];
  yearsOfExperience?: number;
  bio?: string;
  sourcePage?: string;
}

@Injectable({ providedIn: 'root' })
export class TeacherRegistrationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/teacher-registrations`;
  private readonly publicBase = `${environment.apiBase}/public/teacher-registrations`;

  async list(params?: { status?: string; search?: string }): Promise<TeacherRegistration[]> {
    let httpParams = new HttpParams();
    if (params?.status && params.status !== 'ALL') {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return firstValueFrom(
      this.http.get<TeacherRegistration[]>(this.base, {
        withCredentials: true,
        params: httpParams,
      }),
    );
  }

  async getById(id: string): Promise<TeacherRegistration> {
    return firstValueFrom(
      this.http.get<TeacherRegistration>(`${this.base}/${id}`, {
        withCredentials: true,
      }),
    );
  }

  async update(id: string, payload: TeacherRegistrationUpdatePayload): Promise<TeacherRegistration> {
    return firstValueFrom(
      this.http.patch<TeacherRegistration>(`${this.base}/${id}`, payload, {
        withCredentials: true,
      }),
    );
  }

  async convert(
    id: string,
    payload: TeacherRegistrationConvertPayload,
  ): Promise<{
    registration: TeacherRegistration;
    teacherProfileId: string;
    userId: string;
    userCode: string;
  }> {
    return firstValueFrom(
      this.http.post<{
        registration: TeacherRegistration;
        teacherProfileId: string;
        userId: string;
        userCode: string;
      }>(`${this.base}/${id}/convert`, payload, {
        withCredentials: true,
      }),
    );
  }

  async submitPublic(payload: PublicTeacherRegistrationPayload): Promise<{
    ok: boolean;
    registrationId: string;
    applicationCode: string;
  }> {
    return firstValueFrom(
      this.http.post<{
        ok: boolean;
        registrationId: string;
        applicationCode: string;
      }>(this.publicBase, payload),
    );
  }
}
