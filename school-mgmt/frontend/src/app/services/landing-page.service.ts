import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TrackingPayload {
  landingPageId?: string;
  landingPageSlug?: string;
  landingPageName?: string;
  submittedUrl?: string;
  referrerUrl?: string;
  eventId?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  ttclid?: string;
  ttp?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

export interface LandingPageItem {
  _id: string;
  pageCode: string;
  name: string;
  slug: string;
  status: string;
  heroTitle?: string;
  heroSubtitle?: string;
  formTitle?: string;
  formDescription?: string;
  submitButtonText?: string;
  privacyNotice?: string;
  successTitle?: string;
  successMessage?: string;
  bodyHtml?: string;
  defaultPlatform?: string;
  defaultAdGroupId?: string;
  defaultAdGroupName?: string;
  autoCreateLead: boolean;
  metaPixelId?: string;
  googleTagId?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
  tiktokPixelId?: string;
  customHeadHtml?: string;
  customBodyHtml?: string;
  notes?: string;
  createdAt?: string;
}

export interface LandingPageSubmissionItem {
  _id: string;
  submissionCode: string;
  landingPageId: string;
  landingPageName: string;
  landingPageSlug: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName?: string;
  studentGrade?: string;
  notes?: string;
  platform?: string;
  adRefParam?: string;
  adGroupId?: string;
  adGroupName?: string;
  matchedParentUserId?: string;
  matchedWalletId?: string;
  matchSource: string;
  leadId?: string;
  leadCode?: string;
  tracking?: TrackingPayload;
  createdAt: string;
}

export interface PublicLandingPageView {
  _id: string;
  name: string;
  slug: string;
  status: string;
  heroTitle?: string;
  heroSubtitle?: string;
  formTitle?: string;
  formDescription?: string;
  submitButtonText?: string;
  privacyNotice?: string;
  successTitle?: string;
  successMessage?: string;
  bodyHtml?: string;
  defaultPlatform?: string;
  defaultAdGroupId?: string;
  defaultAdGroupName?: string;
  metaPixelId?: string;
  googleTagId?: string;
  googleAdsConversionId?: string;
  googleAdsConversionLabel?: string;
  tiktokPixelId?: string;
  customHeadHtml?: string;
  customBodyHtml?: string;
}

export interface LandingPageSubmitResult {
  ok: boolean;
  submissionId: string;
  submissionCode: string;
  leadId?: string;
  leadCode?: string;
  matchedParentUserId?: string;
  matchedWalletId?: string;
  matchSource: string;
  adGroupId?: string;
  adGroupName?: string;
}

@Injectable({ providedIn: 'root' })
export class LandingPageService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/landing-pages`;
  private readonly publicBase = `${environment.apiBase}/public/landing-pages`;

  async list(params?: Record<string, string>): Promise<LandingPageItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<LandingPageItem[]>(this.base, { withCredentials: true, params }),
      );
    } catch {
      return [];
    }
  }

  async listSubmissions(params?: Record<string, string>): Promise<LandingPageSubmissionItem[]> {
    try {
      return await firstValueFrom(
        this.http.get<LandingPageSubmissionItem[]>(`${this.base}/submissions`, { withCredentials: true, params }),
      );
    } catch {
      return [];
    }
  }

  async create(payload: Partial<LandingPageItem>): Promise<{ ok: boolean; message?: string; data?: LandingPageItem }> {
    try {
      const data = await firstValueFrom(
        this.http.post<LandingPageItem>(this.base, payload, { withCredentials: true }),
      );
      return { ok: true, data };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message || 'Khong tao duoc landing page' };
    }
  }

  async update(id: string, payload: Partial<LandingPageItem>): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.patch(`${this.base}/${id}`, payload, { withCredentials: true }),
      );
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message || 'Khong cap nhat duoc landing page' };
    }
  }

  async remove(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await firstValueFrom(
        this.http.delete(`${this.base}/${id}`, { withCredentials: true }),
      );
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message || 'Khong xoa duoc landing page' };
    }
  }

  async getPublicBySlug(slug: string): Promise<PublicLandingPageView> {
    return firstValueFrom(
      this.http.get<PublicLandingPageView>(`${this.publicBase}/${slug}`),
    );
  }

  async submitPublic(
    slug: string,
    payload: {
      parentName: string;
      parentPhone: string;
      parentEmail?: string;
      studentName?: string;
      studentGrade?: string;
      notes?: string;
      platform?: string;
      adRefParam?: string;
      tracking?: TrackingPayload;
    },
  ): Promise<LandingPageSubmitResult> {
    return firstValueFrom(
      this.http.post<LandingPageSubmitResult>(`${this.publicBase}/${slug}/submit`, payload),
    );
  }
}
