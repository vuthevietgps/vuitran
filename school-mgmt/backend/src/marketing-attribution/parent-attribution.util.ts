import { Types } from 'mongoose';
import { TrackingAttribution } from './schemas/tracking-attribution.schema';

type TrackingLike = Partial<Record<keyof TrackingAttribution, string | Types.ObjectId | null | undefined>>;

const TRACKING_FIELDS: Array<keyof TrackingAttribution> = [
  'landingPageId',
  'landingPageSlug',
  'landingPageName',
  'submittedUrl',
  'referrerUrl',
  'eventId',
  'fbclid',
  'fbc',
  'fbp',
  'gclid',
  'gbraid',
  'wbraid',
  'ttclid',
  'ttp',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
];

function objectIdToString(value?: string | Types.ObjectId | null): string {
  if (!value) return '';
  return value instanceof Types.ObjectId ? value.toString() : String(value);
}

export function normalizePhone(value?: string | null): string {
  const digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';

  if (digits.startsWith('84') && digits.length >= 10 && digits.length <= 11) {
    return `0${digits.slice(2)}`;
  }

  if (digits.startsWith('840') && digits.length >= 11) {
    return `0${digits.slice(3)}`;
  }

  return digits;
}

export function normalizeEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

export function hashNormalizedValue(value?: string | null): string | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) return undefined;
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function buildParentKey(
  parentUserId?: string | Types.ObjectId | null,
  parentPhone?: string | null,
): string | null {
  const userId = objectIdToString(parentUserId);
  if (userId) return `user:${userId}`;

  const normalizedPhone = normalizePhone(parentPhone);
  if (normalizedPhone) return `phone:${normalizedPhone}`;

  return null;
}

export function toObjectId(value?: string | Types.ObjectId | null): Types.ObjectId | undefined {
  if (!value) return undefined;
  if (value instanceof Types.ObjectId) return value;
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
}

export function normalizeTrackingAttribution(
  input?: TrackingLike | null,
): Partial<TrackingAttribution> | undefined {
  if (!input) return undefined;

  const result: Partial<TrackingAttribution> = {};
  for (const field of TRACKING_FIELDS) {
    const value = input[field];
    if (value === undefined || value === null) continue;

    if (field === 'landingPageId') {
      const objectId = toObjectId(value as string | Types.ObjectId | null);
      if (objectId) result[field] = objectId as any;
      continue;
    }

    const text = String(value).trim();
    if (text) {
      result[field] = text as any;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function mergeTrackingAttribution(
  existing?: TrackingLike | null,
  incoming?: TrackingLike | null,
  preferIncoming = false,
): Partial<TrackingAttribution> | undefined {
  const normalizedExisting = normalizeTrackingAttribution(existing);
  const normalizedIncoming = normalizeTrackingAttribution(incoming);

  if (!normalizedExisting && !normalizedIncoming) return undefined;
  if (!normalizedExisting) return normalizedIncoming;
  if (!normalizedIncoming) return normalizedExisting;

  const result: Partial<TrackingAttribution> = { ...normalizedExisting };

  for (const field of TRACKING_FIELDS) {
    const incomingValue = normalizedIncoming[field];
    if (incomingValue === undefined || incomingValue === null || incomingValue === '') continue;

    const existingValue = result[field];
    if (preferIncoming || existingValue === undefined || existingValue === null || existingValue === '') {
      result[field] = incomingValue as any;
    }
  }

  return result;
}
