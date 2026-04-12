import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { resolve, sep } from 'path';

type SensitiveAssetField = 'imageUrl' | 'recordingUrl' | 'recordLink';

const SENSITIVE_FIELDS: readonly SensitiveAssetField[] = ['imageUrl', 'recordingUrl', 'recordLink'];
const SECURE_ASSET_ROUTE = '/secure-assets';
const DEFAULT_EXPIRES_IN_MINUTES = 15;

@Injectable()
export class StorageUrlService {
  private readonly signingSecret =
    process.env.ASSET_URL_SIGNING_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'school-mgmt-asset-signing-secret';

  private readonly uploadRoot = resolve(process.cwd(), 'uploads');

  private normalizePathFragment(value: string): string | null {
    const cleaned = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleaned || cleaned.includes('..')) {
      return null;
    }
    return cleaned;
  }

  extractAssetKey(reference?: string | null): string | null {
    if (!reference) {
      return null;
    }

    const trimmed = reference.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith(SECURE_ASSET_ROUTE)) {
      try {
        const parsed = new URL(trimmed, 'http://localhost');
        return this.normalizePathFragment(parsed.searchParams.get('key') || '');
      } catch {
        return null;
      }
    }

    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        const pathName = parsed.pathname.replace(/^\/+/, '');
        if (pathName.startsWith('uploads/')) {
          return this.normalizePathFragment(pathName.slice('uploads/'.length));
        }
        const directPrefixes = [
          'attendance/',
          'recordings/',
          'session-recordings/',
          'teaching-recordings/',
        ];
        for (const prefix of directPrefixes) {
          if (pathName.startsWith(prefix)) {
            return this.normalizePathFragment(pathName);
          }
        }
        return null;
      } catch {
        return null;
      }
    }

    const withoutUploadsPrefix = trimmed.replace(/^\/+/, '').replace(/^uploads\//, '');
    return this.normalizePathFragment(withoutUploadsPrefix);
  }

  isProtectedAssetReference(reference?: string | null): boolean {
    return !!this.extractAssetKey(reference);
  }

  private signPayload(assetKey: string, expiresAt: number): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${assetKey}:${expiresAt}`)
      .digest('base64url');
  }

  generatePresignedUrl(
    reference?: string | null,
    expiresInMinutes: number = DEFAULT_EXPIRES_IN_MINUTES,
  ): string | null {
    const assetKey = this.extractAssetKey(reference);
    if (!assetKey) {
      return reference?.trim() || null;
    }

    const ttlMinutes = Number.isFinite(expiresInMinutes) && expiresInMinutes > 0
      ? Math.floor(expiresInMinutes)
      : DEFAULT_EXPIRES_IN_MINUTES;
    const expiresAt = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
    const signature = this.signPayload(assetKey, expiresAt);

    return `${SECURE_ASSET_ROUTE}?key=${encodeURIComponent(assetKey)}&exp=${expiresAt}&sig=${signature}`;
  }

  verifySignedAssetRequest(params: { key?: string; exp?: string; sig?: string }): { assetKey: string; expiresAt: number } {
    const assetKey = this.normalizePathFragment(params.key || '');
    if (!assetKey) {
      throw new BadRequestException('Tham so file khong hop le');
    }

    const expiresAt = Number(params.exp);
    if (!Number.isFinite(expiresAt)) {
      throw new BadRequestException('Tham so het han khong hop le');
    }

    const signature = params.sig || '';
    if (!signature) {
      throw new ForbiddenException('Thieu chu ky truy cap');
    }

    if (Math.floor(Date.now() / 1000) > expiresAt) {
      throw new ForbiddenException('URL da het han');
    }

    const expected = this.signPayload(assetKey, expiresAt);
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== signatureBuffer.length) {
      throw new ForbiddenException('Chu ky truy cap khong hop le');
    }

    if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
      throw new ForbiddenException('Chu ky truy cap khong hop le');
    }

    return { assetKey, expiresAt };
  }

  resolveLocalAssetPath(assetKey: string): string {
    const normalized = this.normalizePathFragment(assetKey);
    if (!normalized) {
      throw new BadRequestException('File key khong hop le');
    }

    const absolutePath = resolve(this.uploadRoot, normalized);
    const uploadRootWithSep = this.uploadRoot.endsWith(sep) ? this.uploadRoot : `${this.uploadRoot}${sep}`;
    if (!absolutePath.startsWith(uploadRootWithSep)) {
      throw new ForbiddenException('Duong dan file khong hop le');
    }

    return absolutePath;
  }

  getContentType(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
  }

  transformSensitiveAssetUrls<T>(payload: T): T {
    return this.walk(payload) as T;
  }

  private walk(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.walk(item));
    }

    if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) {
      return value;
    }

    for (const field of SENSITIVE_FIELDS) {
      const fileKeyField = this.getFileKeyField(field);
      const preferredReference =
        typeof value[fileKeyField] === 'string' && value[fileKeyField].trim()
          ? value[fileKeyField]
          : value[field];

      if (typeof preferredReference === 'string' && preferredReference.trim()) {
        const signed = this.generatePresignedUrl(preferredReference, DEFAULT_EXPIRES_IN_MINUTES);
        if (signed) {
          value[field] = signed;
        }
      }
    }

    for (const key of Object.keys(value)) {
      value[key] = this.walk(value[key]);
    }

    return value;
  }

  private getFileKeyField(field: SensitiveAssetField): string {
    switch (field) {
      case 'imageUrl':
        return 'imageFileKey';
      case 'recordingUrl':
      case 'recordLink':
        return 'recordingFileKey';
      default:
        return `${field}FileKey`;
    }
  }
}
