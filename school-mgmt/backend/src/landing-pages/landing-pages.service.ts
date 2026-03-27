import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { Lead, LeadDocument, LeadSource, LeadStatus } from '../leads/schemas/lead.schema';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import {
  hashNormalizedValue,
  mergeTrackingAttribution,
  normalizeEmail,
  normalizePhone,
  normalizeTrackingAttribution,
  toObjectId,
} from '../marketing-attribution/parent-attribution.util';
import { ParentAttributionSourceType } from '../marketing-attribution/schemas/parent-attribution.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { QueryLandingPageSubmissionsDto } from './dto/query-landing-page-submissions.dto';
import { QueryLandingPagesDto } from './dto/query-landing-pages.dto';
import { SubmitLandingPageDto } from './dto/submit-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import {
  LandingPage,
  LandingPageDocument,
  LandingPageStatus,
} from './schemas/landing-page.schema';
import {
  LandingPageMatchSource,
  LandingPageSubmission,
  LandingPageSubmissionDocument,
} from './schemas/landing-page-submission.schema';

type ResolvedParentIdentity = {
  parentUserId?: Types.ObjectId;
  walletId?: Types.ObjectId;
  matchSource: LandingPageMatchSource;
};

@Injectable()
export class LandingPagesService {
  constructor(
    @InjectModel(LandingPage.name)
    private readonly landingPageModel: Model<LandingPageDocument>,
    @InjectModel(LandingPageSubmission.name)
    private readonly submissionModel: Model<LandingPageSubmissionDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly marketingAttributionService: MarketingAttributionService,
  ) {}

  private normalizeSlug(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase();
  }

  private sanitizeHtml(value?: string): string | undefined {
    const html = String(value || '').trim();
    return html || undefined;
  }

  private buildPhoneCandidates(value?: string): string[] {
    const normalized = normalizePhone(value);
    const candidates = new Set<string>();
    const trimmed = String(value || '').trim();
    if (trimmed) candidates.add(trimmed);
    if (normalized) {
      candidates.add(normalized);
      if (normalized.startsWith('0') && normalized.length > 1) {
        candidates.add(`84${normalized.slice(1)}`);
        candidates.add(`+84${normalized.slice(1)}`);
      }
    }
    return Array.from(candidates);
  }

  private async generatePageCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LP-${year}-`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.landingPageModel.countDocuments({ pageCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.landingPageModel.exists({ pageCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  private async generateSubmissionCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LPS-${year}-`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.submissionModel.countDocuments({ submissionCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(5, '0')}`;
      const exists = await this.submissionModel.exists({ submissionCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  private async generateLeadCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LEAD-${year}-`;
    const last = await this.leadModel
      .findOne({ leadCode: { $regex: `^${prefix}` } })
      .sort({ leadCode: -1 })
      .lean();
    let nextNum = 1;
    if (last?.leadCode) {
      const parts = last.leadCode.split('-');
      nextNum = Number(parts[2] || 0) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  private mapLeadSource(platform?: string, utmSource?: string): LeadSource {
    const normalizedPlatform = String(platform || '').trim().toUpperCase();
    const normalizedUtm = String(utmSource || '').trim().toLowerCase();

    if (normalizedPlatform === 'FACEBOOK' || ['facebook', 'fb', 'instagram', 'ig'].includes(normalizedUtm)) {
      return LeadSource.FACEBOOK;
    }
    if (normalizedPlatform === 'GOOGLE' || ['google', 'gads', 'googleads'].includes(normalizedUtm)) {
      return LeadSource.GOOGLE;
    }
    if (normalizedPlatform === 'TIKTOK' || ['tiktok', 'tt'].includes(normalizedUtm)) {
      return LeadSource.TIKTOK;
    }
    return LeadSource.WEBSITE;
  }

  private async resolveAdGroup(
    page: LandingPageDocument,
    dto: SubmitLandingPageDto,
  ): Promise<AdGroupDocument | null> {
    if (dto.adGroupId) {
      const adGroup = await this.adGroupModel.findById(dto.adGroupId);
      if (!adGroup) {
        throw new BadRequestException('adGroupId khong hop le');
      }
      return adGroup;
    }

    const adRefParam = String(dto.adRefParam || '').trim();
    if (adRefParam) {
      const filter: FilterQuery<AdGroupDocument> = {
        $or: [
          { platformCampaignId: adRefParam },
          { trackingKeys: adRefParam },
          { groupCode: adRefParam },
          { name: adRefParam },
        ],
      };
      if (dto.platform) {
        filter.platform = dto.platform;
      }
      const adGroup = await this.adGroupModel.findOne(filter);
      if (adGroup) return adGroup;
    }

    if (page.defaultAdGroupId) {
      return this.adGroupModel.findById(page.defaultAdGroupId);
    }

    return null;
  }

  private async resolveParentIdentity(parentPhone?: string, parentEmail?: string): Promise<ResolvedParentIdentity> {
    const email = normalizeEmail(parentEmail);
    if (email) {
      const byEmail = await this.userModel.findOne({ email, role: Role.PARENT }).select('_id').lean();
      if (byEmail?._id) {
        const wallet = await this.walletModel.findOne({ userId: byEmail._id }).select('_id').lean();
        return {
          parentUserId: new Types.ObjectId(byEmail._id),
          walletId: wallet?._id ? new Types.ObjectId(wallet._id) : undefined,
          matchSource: LandingPageMatchSource.USER_EMAIL,
        };
      }
    }

    const phoneCandidates = this.buildPhoneCandidates(parentPhone);
    if (phoneCandidates.length > 0) {
      const parentUsers = await this.userModel
        .find({ phone: { $in: phoneCandidates }, role: Role.PARENT })
        .select('_id')
        .lean();
      if (parentUsers.length === 1) {
        const wallet = await this.walletModel.findOne({ userId: parentUsers[0]._id }).select('_id').lean();
        return {
          parentUserId: new Types.ObjectId(parentUsers[0]._id),
          walletId: wallet?._id ? new Types.ObjectId(wallet._id) : undefined,
          matchSource: LandingPageMatchSource.USER_PHONE,
        };
      }

      const students = await this.studentModel
        .find({ parentPhone: { $in: phoneCandidates }, parentUserId: { $ne: null } })
        .select('parentUserId')
        .lean();
      const uniqueParentIds = Array.from(
        new Set(
          students
            .map((student) => student.parentUserId?.toString?.())
            .filter((value): value is string => Boolean(value)),
        ),
      );

      if (uniqueParentIds.length === 1) {
        const parentUserId = new Types.ObjectId(uniqueParentIds[0]);
        const wallet = await this.walletModel.findOne({ userId: parentUserId }).select('_id').lean();
        return {
          parentUserId,
          walletId: wallet?._id ? new Types.ObjectId(wallet._id) : undefined,
          matchSource: LandingPageMatchSource.STUDENT_PARENT,
        };
      }
    }

    return { matchSource: LandingPageMatchSource.NONE };
  }

  private buildPublicPageResponse(page: LandingPageDocument) {
    return {
      _id: page._id,
      name: page.name,
      slug: page.slug,
      status: page.status,
      heroTitle: page.heroTitle,
      heroSubtitle: page.heroSubtitle,
      formTitle: page.formTitle,
      formDescription: page.formDescription,
      submitButtonText: page.submitButtonText,
      privacyNotice: page.privacyNotice,
      successTitle: page.successTitle,
      successMessage: page.successMessage,
      bodyHtml: page.bodyHtml,
      defaultPlatform: page.defaultPlatform,
      defaultAdGroupId: page.defaultAdGroupId,
      defaultAdGroupName: page.defaultAdGroupName,
      metaPixelId: page.metaPixelId,
      googleTagId: page.googleTagId,
      googleAdsConversionId: page.googleAdsConversionId,
      googleAdsConversionLabel: page.googleAdsConversionLabel,
      tiktokPixelId: page.tiktokPixelId,
      customHeadHtml: page.customHeadHtml,
      customBodyHtml: page.customBodyHtml,
    };
  }

  async create(dto: CreateLandingPageDto, user: JwtPayload): Promise<LandingPage> {
    const slug = this.normalizeSlug(dto.slug);
    const pageCode = await this.generatePageCode();

    if (await this.landingPageModel.exists({ slug })) {
      throw new BadRequestException('Slug landing page da ton tai');
    }

    let defaultAdGroupName: string | undefined;
    if (dto.defaultAdGroupId) {
      const adGroup = await this.adGroupModel.findById(dto.defaultAdGroupId).lean();
      if (!adGroup) {
        throw new BadRequestException('defaultAdGroupId khong hop le');
      }
      defaultAdGroupName = adGroup.name;
    }

    const page = new this.landingPageModel({
      ...dto,
      pageCode,
      slug,
      bodyHtml: this.sanitizeHtml(dto.bodyHtml),
      customHeadHtml: this.sanitizeHtml(dto.customHeadHtml),
      customBodyHtml: this.sanitizeHtml(dto.customBodyHtml),
      defaultAdGroupName,
      createdById: new Types.ObjectId(user._id || user.sub),
      createdByName: user.fullName || user.email,
    });

    return page.save();
  }

  async findAll(query: QueryLandingPagesDto) {
    const filter: FilterQuery<LandingPageDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { slug: { $regex: query.search, $options: 'i' } },
        { pageCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.landingPageModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    const page = await this.landingPageModel.findById(id).lean();
    if (!page) throw new NotFoundException('Landing page khong ton tai');
    return page;
  }

  async update(id: string, dto: UpdateLandingPageDto): Promise<LandingPage> {
    const page = await this.landingPageModel.findById(id);
    if (!page) throw new NotFoundException('Landing page khong ton tai');

    if (dto.slug) {
      const slug = this.normalizeSlug(dto.slug);
      const duplicate = await this.landingPageModel.exists({ slug, _id: { $ne: page._id } });
      if (duplicate) {
        throw new BadRequestException('Slug landing page da ton tai');
      }
      page.slug = slug;
    }

    if (dto.defaultAdGroupId !== undefined) {
      if (dto.defaultAdGroupId) {
        const adGroup = await this.adGroupModel.findById(dto.defaultAdGroupId).lean();
        if (!adGroup) {
          throw new BadRequestException('defaultAdGroupId khong hop le');
        }
        page.defaultAdGroupId = new Types.ObjectId(dto.defaultAdGroupId);
        page.defaultAdGroupName = adGroup.name;
      } else {
        page.defaultAdGroupId = undefined;
        page.defaultAdGroupName = undefined;
      }
    }

    if (dto.bodyHtml !== undefined) page.bodyHtml = this.sanitizeHtml(dto.bodyHtml);
    if (dto.customHeadHtml !== undefined) page.customHeadHtml = this.sanitizeHtml(dto.customHeadHtml);
    if (dto.customBodyHtml !== undefined) page.customBodyHtml = this.sanitizeHtml(dto.customBodyHtml);

    Object.assign(page, {
      ...dto,
      defaultAdGroupId: page.defaultAdGroupId,
      defaultAdGroupName: page.defaultAdGroupName,
      slug: page.slug,
      bodyHtml: page.bodyHtml,
      customHeadHtml: page.customHeadHtml,
      customBodyHtml: page.customBodyHtml,
    });

    return page.save();
  }

  async delete(id: string): Promise<void> {
    const page = await this.landingPageModel.findById(id).lean();
    if (!page) throw new NotFoundException('Landing page khong ton tai');

    const submissionCount = await this.submissionModel.countDocuments({ landingPageId: page._id });
    if (submissionCount > 0) {
      throw new BadRequestException('Khong the xoa landing page da co submission');
    }

    await this.landingPageModel.findByIdAndDelete(id);
  }

  async findSubmissions(query: QueryLandingPageSubmissionsDto) {
    const filter: FilterQuery<LandingPageSubmissionDocument> = {};
    if (query.landingPageId) filter.landingPageId = new Types.ObjectId(query.landingPageId);
    if (query.search) {
      filter.$or = [
        { parentName: { $regex: query.search, $options: 'i' } },
        { parentPhone: { $regex: query.search, $options: 'i' } },
        { studentName: { $regex: query.search, $options: 'i' } },
        { leadCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    return this.submissionModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async getPublicBySlug(slug: string) {
    const normalizedSlug = this.normalizeSlug(slug);
    const page = await this.landingPageModel.findOne({
      slug: normalizedSlug,
      status: LandingPageStatus.ACTIVE,
    });
    if (!page) {
      throw new NotFoundException('Landing page khong ton tai hoac chua kich hoat');
    }
    return this.buildPublicPageResponse(page);
  }

  async submitPublicBySlug(slug: string, dto: SubmitLandingPageDto) {
    const normalizedSlug = this.normalizeSlug(slug);
    const page = await this.landingPageModel.findOne({
      slug: normalizedSlug,
      status: LandingPageStatus.ACTIVE,
    });
    if (!page) {
      throw new NotFoundException('Landing page khong ton tai hoac chua kich hoat');
    }

    const adGroup = await this.resolveAdGroup(page, dto);
    const normalizedTracking = mergeTrackingAttribution(
      dto.tracking,
      {
        landingPageId: page._id,
        landingPageSlug: page.slug,
        landingPageName: page.name,
      },
      true,
    );
    const identity = await this.resolveParentIdentity(dto.parentPhone, dto.parentEmail);
    const submissionCode = await this.generateSubmissionCode();
    const normalizedParentPhone = normalizePhone(dto.parentPhone);
    const normalizedParentEmail = normalizeEmail(dto.parentEmail);
    const platform = adGroup?.platform || dto.platform || page.defaultPlatform;
    const adGroupId = adGroup?._id || toObjectId(page.defaultAdGroupId);
    const adGroupName = adGroup?.name || dto.adGroupName || page.defaultAdGroupName;
    const referredByUserId = toObjectId(dto.referredByUserId);

    const submission = new this.submissionModel({
      submissionCode,
      landingPageId: page._id,
      landingPageName: page.name,
      landingPageSlug: page.slug,
      parentName: dto.parentName,
      parentPhone: dto.parentPhone,
      normalizedParentPhone,
      hashedParentPhoneSha256: hashNormalizedValue(normalizedParentPhone),
      parentEmail: dto.parentEmail || undefined,
      normalizedParentEmail: normalizedParentEmail || undefined,
      hashedParentEmailSha256: hashNormalizedValue(normalizedParentEmail),
      studentName: dto.studentName || undefined,
      studentGrade: dto.studentGrade || undefined,
      notes: dto.notes || undefined,
      platform,
      adRefParam: dto.adRefParam || undefined,
      adGroupId,
      referredByUserId,
      adGroupName,
      tracking: normalizeTrackingAttribution(normalizedTracking),
      matchedParentUserId: identity.parentUserId,
      matchedWalletId: identity.walletId,
      matchSource: identity.matchSource,
    });

    let leadDoc: LeadDocument | null = null;
    if (page.autoCreateLead) {
      const leadCode = await this.generateLeadCode();
      leadDoc = await this.leadModel.create({
        leadCode,
        parentName: dto.parentName,
        parentPhone: dto.parentPhone,
        parentEmail: dto.parentEmail || undefined,
        studentName: dto.studentName || undefined,
        studentGrade: dto.studentGrade || undefined,
        source: this.mapLeadSource(platform, normalizedTracking?.utmSource),
        adGroupId,
        adGroupName,
        notes: dto.notes || `Landing page: ${page.slug}`,
        status: LeadStatus.NEW,
        tracking: normalizeTrackingAttribution(normalizedTracking),
      });
      submission.leadId = leadDoc._id;
      submission.leadCode = leadDoc.leadCode;
    }

    await submission.save();

    await this.marketingAttributionService.upsertParentAttribution({
      parentUserId: identity.parentUserId,
      parentPhone: dto.parentPhone,
      parentEmail: dto.parentEmail,
      referredByUserId,
      adGroupId,
      adGroupName,
      platform,
      adRefParam: dto.adRefParam,
      tracking: normalizedTracking,
      sourceLeadId: leadDoc?._id,
      sourceType: ParentAttributionSourceType.LANDING_PAGE,
      notes: `Landing page ${page.slug}`,
    });

    return {
      ok: true,
      submissionId: submission._id,
      submissionCode: submission.submissionCode,
      leadId: leadDoc?._id,
      leadCode: leadDoc?.leadCode,
      matchedParentUserId: identity.parentUserId,
      matchedWalletId: identity.walletId,
      matchSource: identity.matchSource,
      adGroupId,
      adGroupName,
    };
  }
}
