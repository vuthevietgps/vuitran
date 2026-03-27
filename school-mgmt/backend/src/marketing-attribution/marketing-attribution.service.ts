import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
  ParentAttribution,
  ParentAttributionDocument,
  ParentAttributionModel,
  ParentAttributionSourceType,
} from './schemas/parent-attribution.schema';
import { TrackingAttribution } from './schemas/tracking-attribution.schema';
import {
  buildParentKey,
  hashNormalizedValue,
  mergeTrackingAttribution,
  normalizeEmail,
  normalizePhone,
  normalizeTrackingAttribution,
  toObjectId,
} from './parent-attribution.util';

export type UpsertParentAttributionInput = {
  parentUserId?: string | Types.ObjectId | null;
  referredByUserId?: string | Types.ObjectId | null;
  parentPhone?: string | null;
  parentEmail?: string | null;
  adGroupId?: string | Types.ObjectId | null;
  adGroupName?: string | null;
  platform?: string | null;
  adRefParam?: string | null;
  tracking?: Partial<TrackingAttribution> | null;
  sourceConversationId?: string | Types.ObjectId | null;
  sourceLeadId?: string | Types.ObjectId | null;
  sourceOrderId?: string | Types.ObjectId | null;
  attributionModel?: ParentAttributionModel;
  sourceType?: ParentAttributionSourceType;
  notes?: string | null;
};

@Injectable()
export class MarketingAttributionService {
  constructor(
    @InjectModel(ParentAttribution.name)
    private readonly parentAttributionModel: Model<ParentAttributionDocument>,
  ) {}

  async upsertParentAttribution(
    input: UpsertParentAttributionInput,
    session?: ClientSession,
  ): Promise<ParentAttributionDocument | null> {
    const parentUserId = toObjectId(input.parentUserId);
    const referredByUserId = toObjectId(input.referredByUserId);
    const adGroupId = toObjectId(input.adGroupId);
    const sourceConversationId = toObjectId(input.sourceConversationId);
    const sourceLeadId = toObjectId(input.sourceLeadId);
    const sourceOrderId = toObjectId(input.sourceOrderId);
    const normalizedParentPhone = normalizePhone(input.parentPhone);
    const normalizedParentEmail = normalizeEmail(input.parentEmail);
    const hashedParentPhoneSha256 = hashNormalizedValue(normalizedParentPhone);
    const hashedParentEmailSha256 = hashNormalizedValue(normalizedParentEmail);
    const tracking = normalizeTrackingAttribution(input.tracking);
    const parentKey = buildParentKey(parentUserId, normalizedParentPhone);

    if (!parentKey) return null;

    let byUser: ParentAttributionDocument | null = null;
    let byPhone: ParentAttributionDocument | null = null;

    if (parentUserId) {
      byUser = await this.parentAttributionModel.findOne({ parentUserId }, null, { session }).exec();
    }
    if (normalizedParentPhone) {
      byPhone = await this.parentAttributionModel.findOne({ normalizedParentPhone }, null, { session }).exec();
    }

    let doc = byUser || byPhone;
    if (byUser && byPhone && String(byUser._id) !== String(byPhone._id)) {
      doc = await this.mergeAttributions(byUser, byPhone, session);
    }

    const now = new Date();
    const requestedModel = input.attributionModel || ParentAttributionModel.FIRST_TOUCH_LOCKED;
    const requestedSourceType =
      input.sourceType ||
      (referredByUserId ? ParentAttributionSourceType.REFERRAL : ParentAttributionSourceType.SYSTEM);
    const canOverride =
      requestedModel === ParentAttributionModel.MANUAL_OVERRIDE ||
      requestedModel === ParentAttributionModel.LAST_TOUCH;

    if (!doc) {
      if (!adGroupId && !input.adGroupName && !referredByUserId) {
        return null;
      }

      doc = new this.parentAttributionModel({
        parentKey,
        parentUserId,
        referredByUserId,
        parentPhone: input.parentPhone || undefined,
        normalizedParentPhone: normalizedParentPhone || undefined,
        parentEmail: input.parentEmail || undefined,
        normalizedParentEmail: normalizedParentEmail || undefined,
        hashedParentPhoneSha256,
        hashedParentEmailSha256,
        adGroupId,
        adGroupName: input.adGroupName || undefined,
        platform: input.platform || undefined,
        adRefParam: input.adRefParam || undefined,
        tracking,
        sourceConversationId,
        sourceLeadId,
        sourceOrderId,
        attributionModel: requestedModel,
        sourceType: requestedSourceType,
        firstAttributedAt: now,
        lastConfirmedAt: now,
        notes: input.notes || undefined,
      });
      return doc.save({ session });
    }

    doc.parentKey = parentKey;
    if (parentUserId) doc.parentUserId = parentUserId;
  if (!doc.referredByUserId && referredByUserId) doc.referredByUserId = referredByUserId;
    if (input.parentPhone) doc.parentPhone = input.parentPhone;
    if (normalizedParentPhone) doc.normalizedParentPhone = normalizedParentPhone;
    if (input.parentEmail) doc.parentEmail = input.parentEmail;
    if (normalizedParentEmail) doc.normalizedParentEmail = normalizedParentEmail;
    if (hashedParentPhoneSha256) doc.hashedParentPhoneSha256 = hashedParentPhoneSha256;
    if (hashedParentEmailSha256) doc.hashedParentEmailSha256 = hashedParentEmailSha256;

    if ((!doc.adGroupId && adGroupId) || canOverride) {
      doc.adGroupId = adGroupId;
      doc.adGroupName = input.adGroupName || doc.adGroupName;
      doc.platform = input.platform || doc.platform;
      doc.adRefParam = input.adRefParam || doc.adRefParam;
      doc.attributionModel = requestedModel;
      doc.sourceType = requestedSourceType;
      doc.tracking = mergeTrackingAttribution(doc.tracking, tracking, true) as any;
      if (!doc.firstAttributedAt) doc.firstAttributedAt = now;
    } else {
      if (!doc.platform && input.platform) doc.platform = input.platform;
      if (!doc.adRefParam && input.adRefParam) doc.adRefParam = input.adRefParam;
      doc.tracking = mergeTrackingAttribution(doc.tracking, tracking) as any;
    }

    if (!doc.sourceConversationId && sourceConversationId) doc.sourceConversationId = sourceConversationId;
    if (!doc.sourceLeadId && sourceLeadId) doc.sourceLeadId = sourceLeadId;
    if (!doc.sourceOrderId && sourceOrderId) doc.sourceOrderId = sourceOrderId;
    if (input.notes) doc.notes = input.notes;
    doc.lastConfirmedAt = now;

    return doc.save({ session });
  }

  private async mergeAttributions(
    primary: ParentAttributionDocument,
    secondary: ParentAttributionDocument,
    session?: ClientSession,
  ): Promise<ParentAttributionDocument> {
    if (!primary.parentUserId && secondary.parentUserId) primary.parentUserId = secondary.parentUserId;
    if (!primary.parentPhone && secondary.parentPhone) primary.parentPhone = secondary.parentPhone;
    if (!primary.normalizedParentPhone && secondary.normalizedParentPhone) {
      primary.normalizedParentPhone = secondary.normalizedParentPhone;
    }
    if (!primary.parentEmail && secondary.parentEmail) primary.parentEmail = secondary.parentEmail;
    if (!primary.normalizedParentEmail && secondary.normalizedParentEmail) {
      primary.normalizedParentEmail = secondary.normalizedParentEmail;
    }
    if (!primary.hashedParentPhoneSha256 && secondary.hashedParentPhoneSha256) {
      primary.hashedParentPhoneSha256 = secondary.hashedParentPhoneSha256;
    }
    if (!primary.hashedParentEmailSha256 && secondary.hashedParentEmailSha256) {
      primary.hashedParentEmailSha256 = secondary.hashedParentEmailSha256;
    }
    if (!primary.adGroupId && secondary.adGroupId) primary.adGroupId = secondary.adGroupId;
    if (!primary.adGroupName && secondary.adGroupName) primary.adGroupName = secondary.adGroupName;
    if (!primary.platform && secondary.platform) primary.platform = secondary.platform;
    if (!primary.adRefParam && secondary.adRefParam) primary.adRefParam = secondary.adRefParam;
    primary.tracking = mergeTrackingAttribution(primary.tracking, secondary.tracking) as any;
    if (!primary.sourceConversationId && secondary.sourceConversationId) {
      primary.sourceConversationId = secondary.sourceConversationId;
    }
    if (!primary.sourceLeadId && secondary.sourceLeadId) primary.sourceLeadId = secondary.sourceLeadId;
    if (!primary.sourceOrderId && secondary.sourceOrderId) primary.sourceOrderId = secondary.sourceOrderId;
    if (!primary.referredByUserId && secondary.referredByUserId) {
      primary.referredByUserId = secondary.referredByUserId;
    }
    if (!primary.notes && secondary.notes) primary.notes = secondary.notes;

    primary.firstAttributedAt = primary.firstAttributedAt || secondary.firstAttributedAt || new Date();
    if (secondary.firstAttributedAt && secondary.firstAttributedAt < primary.firstAttributedAt) {
      primary.firstAttributedAt = secondary.firstAttributedAt;
    }
    if (secondary.lastConfirmedAt && secondary.lastConfirmedAt > primary.lastConfirmedAt) {
      primary.lastConfirmedAt = secondary.lastConfirmedAt;
    }

    primary.parentKey = buildParentKey(primary.parentUserId, primary.normalizedParentPhone) || primary.parentKey;

    await secondary.deleteOne({ session });
    return primary.save({ session });
  }
}
