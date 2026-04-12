import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AdAccount,
  AdAccountDocument,
} from './schemas/ad-account.schema';
import {
  AdGroup,
  AdGroupDocument,
} from './schemas/ad-group.schema';
import { AdCost, AdCostDocument } from './schemas/ad-cost.schema';
import {
  Fanpage,
  FanpageDocument,
} from '../chatbot/schemas/fanpage.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';

import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';
import { QueryAdAccountDto } from './dto/query-ad-account.dto';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { QueryAdGroupDto } from './dto/query-ad-group.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

import { isDuplicateKeyError } from './ads.utils';

@Injectable()
export class AdsCrudService {
  private readonly logger = new Logger(AdsCrudService.name);

  constructor(
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
  ) {}

  // ─── Ad Account CRUD ───────────────────────────────────

  async generateAccountCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ACC-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adAccountModel.countDocuments({ accountCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adAccountModel.findOne({ accountCode: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createAccount(dto: CreateAdAccountDto, user: JwtPayload): Promise<AdAccount> {
    const accountCode = await this.generateAccountCode();
    const account = new this.adAccountModel({
      ...dto,
      accountCode,
      createdById: user._id,
      createdByName: user.fullName,
    });
    return account.save();
  }

  async findAllAccounts(query: QueryAdAccountDto): Promise<{ data: AdAccount[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { accountCode: new RegExp(query.search, 'i') },
        { name: new RegExp(query.search, 'i') },
        { platformAccountId: new RegExp(query.search, 'i') },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adAccountModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.adAccountModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneAccount(id: string): Promise<AdAccountDocument> {
    const account = await this.adAccountModel.findById(id).exec();
    if (!account) throw new NotFoundException('Tài khoản quảng cáo không tồn tại');
    return account;
  }

  async updateAccount(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    const account = await this.findOneAccount(id);
    Object.assign(account, dto);
    return account.save();
  }

  async deleteAccount(id: string): Promise<void> {
    await this.findOneAccount(id);
    const groupCount = await this.adGroupModel.countDocuments({ adAccountId: id });
    if (groupCount > 0) {
      throw new BadRequestException(`Tài khoản đang có ${groupCount} nhóm quảng cáo. Hãy xóa nhóm QC trước.`);
    }
    await this.adAccountModel.findByIdAndDelete(id).exec();
  }

  async findActiveAccounts(): Promise<AdAccountDocument[]> {
    return this.adAccountModel.find({ status: 'ACTIVE' }).exec();
  }

  // ─── Ad Group CRUD ─────────────────────────────────────

  async generateGroupCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADG-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adGroupModel.countDocuments({ groupCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adGroupModel.findOne({ groupCode: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async generateFanpageCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FP-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.fanpageModel.countDocuments({ fanpageCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.fanpageModel.exists({ fanpageCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createGroup(dto: CreateAdGroupDto, user: JwtPayload): Promise<AdGroup> {
    const account = await this.findOneAccount(dto.adAccountId);
    if (String(account.platform) !== String(dto.platform)) {
      throw new BadRequestException('Ad group platform must match ad account platform.');
    }
    await this.ensureUniqueCampaignId(dto.adAccountId, dto.platformCampaignId);

    const groupCode = await this.generateGroupCode();
    const group = new this.adGroupModel({
      ...dto,
      groupCode,
      adAccountName: account.name,
      createdById: user._id,
      createdByName: user.fullName,
    });
    try {
      return await group.save();
    } catch (err: any) {
      if (isDuplicateKeyError(err)) {
        await this.ensureUniqueCampaignId(dto.adAccountId, dto.platformCampaignId);
      }
      throw err;
    }
  }

  async findAllGroups(query: QueryAdGroupDto): Promise<{ data: AdGroup[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.adAccountId) filter.adAccountId = query.adAccountId;
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { groupCode: new RegExp(query.search, 'i') },
        { name: new RegExp(query.search, 'i') },
        { platformCampaignId: new RegExp(query.search, 'i') },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adGroupModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.adGroupModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneGroup(id: string): Promise<AdGroupDocument> {
    const group = await this.adGroupModel.findById(id).exec();
    if (!group) throw new NotFoundException('Nhóm quảng cáo không tồn tại');
    return group;
  }

  async updateGroup(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    const group = await this.findOneGroup(id);
    if (dto.platformCampaignId && dto.platformCampaignId !== group.platformCampaignId) {
      await this.ensureUniqueCampaignId(String(group.adAccountId), dto.platformCampaignId, id);
    }
    Object.assign(group, dto);
    try {
      return await group.save();
    } catch (err: any) {
      if (isDuplicateKeyError(err)) {
        await this.ensureUniqueCampaignId(
          String(group.adAccountId),
          dto.platformCampaignId || group.platformCampaignId,
          id,
        );
      }
      throw err;
    }
  }

  async deleteGroup(id: string): Promise<void> {
    await this.findOneGroup(id);
    const [costCount, leadCount, orderCount, studentCount, sessionCount] = await Promise.all([
      this.adCostModel.countDocuments({ adGroupId: id }),
      this.leadModel.countDocuments({ adGroupId: id }),
      this.orderModel.countDocuments({ adGroupId: id }),
      this.studentModel.countDocuments({ adGroupId: id }),
      this.sessionModel.countDocuments({ adGroupId: id }),
    ]);

    const blockers = [
      { label: 'ad costs', count: costCount },
      { label: 'leads', count: leadCount },
      { label: 'orders', count: orderCount },
      { label: 'students', count: studentCount },
      { label: 'sessions', count: sessionCount },
    ].filter((item) => item.count > 0);

    if (blockers.length > 0) {
      const detail = blockers.map((item) => `${item.label}: ${item.count}`).join(', ');
      throw new BadRequestException(
        `Cannot delete ad group because related data still exists (${detail}).`,
      );
    }

    await this.adGroupModel.findByIdAndDelete(id).exec();
  }

  async findGroupsByPlatform(platform: string): Promise<AdGroup[]> {
    return this.adGroupModel.find({ platform, status: 'ACTIVE' }).sort({ name: 1 }).lean();
  }

  async findAllGroupsSimple(): Promise<AdGroup[]> {
    return this.adGroupModel.find({ status: 'ACTIVE' }).sort({ name: 1 }).lean();
  }

  // ─── Helpers ────────────────────────────────────────────

  private async ensureUniqueCampaignId(
    adAccountId: string | Types.ObjectId,
    platformCampaignId: string,
    excludeGroupId?: string,
  ): Promise<void> {
    const campaignId = String(platformCampaignId || '').trim();
    if (!campaignId) return;

    const filter: any = {
      adAccountId,
      platformCampaignId: campaignId,
    };
    if (excludeGroupId) {
      filter._id = { $ne: excludeGroupId };
    }

    const duplicated = await this.adGroupModel.findOne(filter).select('_id name').lean();
    if (duplicated) {
      throw new BadRequestException(
        `Platform campaign ID "${campaignId}" already exists in this ad account.`,
      );
    }
  }
}
