import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Lead, LeadDocument, LeadStatus } from './schemas/lead.schema';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { AddContactDto } from './dto/add-contact.dto';
import { MarkLostDto } from './dto/mark-lost.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/schemas/audit-log.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import {
  ParentAttributionModel,
  ParentAttributionSourceType,
} from '../marketing-attribution/schemas/parent-attribution.schema';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private auditLogService: AuditLogService,
    private notificationsService: NotificationsService,
    private marketingAttributionService: MarketingAttributionService,
  ) {}

  private getActorId(user: any): string {
    return String(user?.sub ?? user?._id ?? user?.userId ?? '');
  }

  private assertSaleLeadAccess(lead: any, user?: any): void {
    if (user?.role !== Role.SALE) return;
    const actorId = this.getActorId(user);
    const leadSaleId = lead?.saleId?.toString?.();
    if (!actorId || !leadSaleId || actorId !== leadSaleId) {
      throw new NotFoundException('Lead khong ton tai');
    }
  }

  private async generateLeadCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `LEAD-${year}-`;
    const last = await this.leadModel
      .findOne({ leadCode: { $regex: `^${prefix}` } })
      .sort({ leadCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = last.leadCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  async create(dto: CreateLeadDto, user: any): Promise<Lead> {
    const leadCode = await this.generateLeadCode();
    const now = new Date();
    const actorId = this.getActorId(user);
    const lead = new this.leadModel({
      ...dto,
      leadCode,
      saleId: user.role === Role.SALE ? actorId : undefined,
      saleName: user.role === Role.SALE ? (user.fullName || user.email) : undefined,
      assignedAt: user.role === Role.SALE ? now : undefined,
      status: LeadStatus.NEW,
    });

    // If created by SALE, record assignment history
    if (user.role === Role.SALE) {
      lead.assignmentHistory = [{
        saleId: new Types.ObjectId(actorId),
        saleName: user.fullName || user.email,
        assignedAt: now,
      }];
    }

    const saved = await lead.save();

    await this.marketingAttributionService.upsertParentAttribution({
      referredByUserId: dto.referredByUserId,
      parentPhone: saved.parentPhone,
      parentEmail: saved.parentEmail,
      adGroupId: saved.adGroupId,
      adGroupName: saved.adGroupName,
      platform: saved.source,
      tracking: saved.tracking,
      sourceLeadId: saved._id,
      sourceType: ParentAttributionSourceType.LEAD,
    });

    await this.auditLogService.log({
      userId: actorId,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'LEADS' as any,
      targetId: saved._id?.toString(),
      targetName: saved.leadCode,
      description: `T?o lead m?i: ${saved.parentName} - ${saved.parentPhone}`,
    });

    return saved;
  }

  async findAll(query: QueryLeadDto, user: any) {
    const filter: FilterQuery<LeadDocument> = {};

    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.saleId) filter.saleId = query.saleId;
    if (query.tag) filter.tags = query.tag;

    // Pool filter: leads without a sale assigned
    if (query.pool === 'true') {
      filter.saleId = { $in: [null, undefined] } as any;
      filter.status = { $nin: [LeadStatus.CONVERTED, LeadStatus.NOT_INTERESTED] } as any;
    }

    // Stale filter: leads assigned but not contacted in 7 days
    if (query.stale === 'true') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filter.saleId = { $ne: null } as any;
      filter.status = { $in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED] } as any;
      filter.$or = [
        { lastContactAt: null, assignedAt: { $lte: sevenDaysAgo } },
        { lastContactAt: { $lte: sevenDaysAgo } },
      ];
    }

    if (query.search) {
      filter.$or = [
        { parentName: { $regex: query.search, $options: 'i' } },
        { parentPhone: { $regex: query.search, $options: 'i' } },
        { studentName: { $regex: query.search, $options: 'i' } },
        { leadCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate + 'T23:59:59.999Z');
    }

    // SALE can only see their own leads
    if (user.role === Role.SALE) {
      filter.saleId = this.getActorId(user);
    }

    const leads = await this.leadModel.find(filter).sort({ createdAt: -1 }).lean();
    return leads;
  }

  async findOne(id: string, user?: any): Promise<Lead> {
    const lead = await this.leadModel.findById(id).lean();
    if (!lead) throw new NotFoundException('Lead khong ton tai');
    this.assertSaleLeadAccess(lead, user);
    const attribution = await this.marketingAttributionService.findByLeadId(id);
    return {
      ...(lead as any),
      attributionSummary: attribution
        ? {
            parentKey: attribution.parentKey,
            attributionModel: attribution.attributionModel,
            sourceType: attribution.sourceType,
            firstAttributedAt: attribution.firstAttributedAt,
            lastConfirmedAt: attribution.lastConfirmedAt,
            adGroupId: attribution.adGroupId,
            adGroupName: attribution.adGroupName,
            platform: attribution.platform,
          }
        : null,
      attributionTouchpoints: attribution?.touchpoints || [],
    } as Lead;
  }

  async update(id: string, dto: UpdateLeadDto, user: any): Promise<Lead> {
    const lead = await this.leadModel.findById(id);
    if (!lead) throw new NotFoundException('Lead khong ton tai');
    this.assertSaleLeadAccess(lead, user);
    lead.set(dto as any);
    await lead.save();

    await this.marketingAttributionService.upsertParentAttribution({
      referredByUserId: dto.referredByUserId,
      parentPhone: lead.parentPhone,
      parentEmail: lead.parentEmail,
      adGroupId: lead.adGroupId,
      adGroupName: lead.adGroupName,
      platform: lead.source,
      tracking: lead.tracking,
      sourceLeadId: lead._id,
      attributionModel: dto.adGroupId !== undefined ? ParentAttributionModel.MANUAL_OVERRIDE : undefined,
      sourceType: dto.adGroupId !== undefined
        ? ParentAttributionSourceType.MANUAL
        : ParentAttributionSourceType.LEAD,
    });

    await this.auditLogService.log({
      userId: this.getActorId(user),
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.UPDATE,
      module: 'LEADS' as any,
      targetId: id,
      targetName: lead.leadCode,
      description: `C?p nh?t lead ${lead.leadCode}`,
      newValue: dto as any,
    });

    return lead.toObject() as Lead;
  }

  async addContact(id: string, dto: AddContactDto, user: any): Promise<Lead> {
    const entry: any = {
      date: new Date(),
      method: dto.method,
      notes: dto.notes,
      contactedBy: user.fullName || user.email,
    };

    const updateData: any = {
      $push: { contactHistory: entry },
      $set: { lastContactAt: new Date() },
    };

    // If status is NEW, auto-advance to CONTACTED
    const lead = await this.leadModel.findById(id).lean();
    if (!lead) throw new NotFoundException('Lead khong ton tai');
    this.assertSaleLeadAccess(lead, user);

    if ((lead as any).status === LeadStatus.NEW) {
      updateData.$set = { ...updateData.$set, status: LeadStatus.CONTACTED };
    }

    if (dto.nextFollowUp) {
      updateData.$set = { ...updateData.$set, nextFollowUp: new Date(dto.nextFollowUp) };
    }

    const updated = await this.leadModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!updated) throw new NotFoundException('Lead khong ton tai');
    return updated as Lead;
  }

  async markLost(id: string, dto: MarkLostDto, user: any): Promise<Lead> {
    const lead = await this.leadModel.findById(id).lean();
    if (!lead) throw new NotFoundException('Lead khong ton tai');
    this.assertSaleLeadAccess(lead, user);

    if ((lead as any).status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Lead dã chuy?n d?i, không th? dánh d?u m?t');
    }

    const updated = await this.leadModel.findByIdAndUpdate(
      id,
      {
        status: LeadStatus.NOT_INTERESTED,
        lostReason: dto.reason,
        lostNotes: dto.notes,
      },
      { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: this.getActorId(user),
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: 'LEADS' as any,
      targetId: id,
      targetName: (lead as any).leadCode,
      description: `Ðánh d?u lead m?t: ${dto.reason}`,
    });

    return updated as Lead;
  }

  async convert(id: string, user: any): Promise<{ lead: Lead; message: string }> {
    const lead = await this.leadModel.findById(id).lean();
    if (!lead) throw new NotFoundException('Lead khong ton tai');
    this.assertSaleLeadAccess(lead, user);

    const ls = lead as any;
    if (ls.convertedOrderId) {
      throw new BadRequestException('Lead da co don dang ky lien ket');
    }
    if (ls.status === LeadStatus.NOT_INTERESTED || ls.status === LeadStatus.NO_RESPONSE) {
      throw new BadRequestException('Khong the chuyen doi lead da mat hoac khong phan hoi');
    }

    await this.auditLogService.log({
      userId: this.getActorId(user),
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: 'LEADS' as any,
      targetId: id,
      targetName: ls.leadCode,
      description: `Lead ${ls.leadCode} san sang tao don dang ky`,
    });

    return {
      lead: lead as Lead,
      message: 'Lead hop le. Hay tao don dang ky hoc.',
    };
  }

  async assign(id: string, saleId: string, saleName: string, user: any): Promise<Lead> {
    const now = new Date();
    const lead = await this.leadModel.findByIdAndUpdate(
      id,
      {
        saleId,
        saleName,
        assignedAt: now,
        lastContactAt: null,
        returnedToPoolAt: null,
        $push: {
          assignmentHistory: {
            saleId,
            saleName,
            assignedAt: now,
          },
        },
      },
      { new: true },
    ).lean();
    if (!lead) throw new NotFoundException('Lead không t?n t?i');

    await this.auditLogService.log({
      userId: this.getActorId(user),
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.UPDATE,
      module: 'LEADS' as any,
      targetId: id,
      targetName: (lead as any).leadCode,
      description: `Phân b? lead cho ${saleName}`,
    });

    return lead as Lead;
  }

  /** Thu h?i lead v? kho (unassign) */
  async returnToPool(id: string, reason: string, user: any): Promise<Lead> {
    const existing = await this.leadModel.findById(id).lean() as any;
    if (!existing) throw new NotFoundException('Lead không t?n t?i');

    if (!existing.saleId) {
      throw new BadRequestException('Lead hi?n chua du?c phân b? cho sale nào');
    }

    const now = new Date();

    // Close last assignment in history
    const history = existing.assignmentHistory || [];
    if (history.length > 0 && !history[history.length - 1].returnedAt) {
      history[history.length - 1].returnedAt = now;
      history[history.length - 1].returnReason = reason;
    }

    const updated = await this.leadModel.findByIdAndUpdate(
      id,
      {
        $set: {
          saleId: null,
          saleName: null,
          assignedAt: null,
          lastContactAt: null,
          returnedToPoolAt: now,
          assignmentHistory: history,
        },
        $inc: { returnCount: 1 },
      },
      { new: true },
    ).lean();

    await this.auditLogService.log({
      userId: this.getActorId(user),
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.STATUS_CHANGE,
      module: 'LEADS' as any,
      targetId: id,
      targetName: existing.leadCode,
      description: `Thu h?i lead v? kho: ${reason} (tru?c dó: ${existing.saleName})`,
    });

    return updated as Lead;
  }

  /** L?y danh sách lead chua phân b? (trong kho) */
  async getPool() {
    return this.leadModel.find({
      saleId: { $in: [null, undefined] },
      status: { $nin: [LeadStatus.CONVERTED, LeadStatus.NOT_INTERESTED] },
    }).sort({ returnedToPoolAt: -1, createdAt: -1 }).lean();
  }

  /** CRON: T? d?ng thu h?i lead không cham sóc sau 7 ngày */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async autoReturnStaleLeads() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeStatuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED];

    // Find leads assigned > 7 days ago with no contact in the last 7 days
    const staleLeads = await this.leadModel.find({
      saleId: { $ne: null },
      status: { $in: activeStatuses },
      $or: [
        // Assigned but never contacted and assigned > 7 days ago
        { lastContactAt: null, assignedAt: { $lte: sevenDaysAgo } },
        // Last contact > 7 days ago
        { lastContactAt: { $lte: sevenDaysAgo } },
      ],
    }).lean();

    if (staleLeads.length === 0) return;

    this.logger.log(`Auto-return: Found ${staleLeads.length} stale leads (no contact > 7 days)`);

    const now = new Date();
    for (const lead of staleLeads) {
      const ls = lead as any;
      const history = ls.assignmentHistory || [];
      if (history.length > 0 && !history[history.length - 1].returnedAt) {
        history[history.length - 1].returnedAt = now;
        history[history.length - 1].returnReason = 'T? d?ng thu h?i — không cham sóc sau 7 ngày';
      }

      await this.leadModel.findByIdAndUpdate(ls._id, {
        $set: {
          saleId: null,
          saleName: null,
          assignedAt: null,
          lastContactAt: null,
          returnedToPoolAt: now,
          assignmentHistory: history,
        },
        $inc: { returnCount: 1 },
      });
    }

    this.logger.log(`Auto-return: Returned ${staleLeads.length} leads to pool`);
  }

  async getFollowUps(user: any) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const filter: FilterQuery<LeadDocument> = {
      nextFollowUp: { $lte: today },
      status: { $nin: [LeadStatus.CONVERTED, LeadStatus.NOT_INTERESTED] },
    };

    if (user.role === Role.SALE) {
      filter.saleId = this.getActorId(user);
    }

    return this.leadModel.find(filter).sort({ nextFollowUp: 1 }).lean();
  }

  async getPipeline(user: any) {
    const match: any = {};
    if (user.role === Role.SALE) match.saleId = this.getActorId(user);

    const pipeline = await this.leadModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, estimatedValue: { $sum: '$estimatedValue' } } },
    ]);

    const result: Record<string, { count: number; estimatedValue: number }> = {};
    for (const status of Object.values(LeadStatus)) {
      result[status] = { count: 0, estimatedValue: 0 };
    }
    for (const item of pipeline) {
      result[item._id] = { count: item.count, estimatedValue: item.estimatedValue || 0 };
    }

    const total = Object.values(result).reduce((s, r) => s + r.count, 0);
    const converted = result[LeadStatus.CONVERTED]?.count || 0;

    return {
      pipeline: result,
      total,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      assignedCount: await this.leadModel.countDocuments({
        ...match,
        saleId: { $ne: null },
        status: { $in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED] },
      }),
      unassignedCount: await this.leadModel.countDocuments({
        ...match,
        $or: [{ saleId: null }, { saleId: { $exists: false } }],
        status: { $in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED] },
      }),
    };
  }

  async getStats(user: any) {
    const pipeline = await this.leadModel.aggregate([
      {
        $facet: {
          bySource: [{ $group: { _id: '$source', count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          bySale: [
            { $group: { _id: { saleId: '$saleId', saleName: '$saleName' }, total: { $sum: 1 }, converted: { $sum: { $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0] } } } },
          ],
          thisMonth: [
            { $match: { createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
            { $count: 'count' },
          ],
          totalEstimatedValue: [
            { $match: { status: { $in: ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED'] } } },
            { $group: { _id: null, total: { $sum: '$estimatedValue' } } },
          ],
          // Ðã phân b? (có saleId, chua hoàn t?t/m?t)
          assigned: [
            { $match: { saleId: { $ne: null }, status: { $in: ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED'] } } },
            { $count: 'count' },
          ],
          // Chua phân b? (không có saleId, chua hoàn t?t/m?t)
          unassigned: [
            { $match: { $or: [{ saleId: null }, { saleId: { $exists: false } }], status: { $in: ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED'] } } },
            { $count: 'count' },
          ],
          // Ðã thu h?i (returnCount > 0)
          returned: [
            { $match: { returnCount: { $gt: 0 } } },
            { $count: 'count' },
          ],
          // Quá 7 ngày không cham
          stale: [
            {
              $match: {
                saleId: { $ne: null },
                status: { $in: ['NEW', 'CONTACTED', 'CONSULTING', 'INTERESTED'] },
                $or: [
                  { lastContactAt: null, assignedAt: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                  { lastContactAt: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                ],
              },
            },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const data = pipeline[0];
    return {
      bySource: data.bySource,
      byStatus: data.byStatus,
      bySale: data.bySale.map((s: any) => ({
        saleId: s._id.saleId,
        saleName: s._id.saleName,
        total: s.total,
        converted: s.converted,
        conversionRate: s.total > 0 ? Math.round((s.converted / s.total) * 100) : 0,
      })),
      thisMonthCount: data.thisMonth[0]?.count || 0,
      pipelineValue: data.totalEstimatedValue[0]?.total || 0,
      assignedCount: data.assigned[0]?.count || 0,
      unassignedCount: data.unassigned[0]?.count || 0,
      returnedCount: data.returned[0]?.count || 0,
      staleCount: data.stale[0]?.count || 0,
    };
  }

  async remove(id: string, user: any): Promise<Lead> {
    const lead = await this.leadModel.findByIdAndDelete(id).lean();
    if (!lead) throw new NotFoundException('Lead không t?n t?i');

    await this.auditLogService.log({
      userId: this.getActorId(user),
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.DELETE,
      module: 'LEADS' as any,
      targetId: id,
      targetName: (lead as any).leadCode,
      description: `Xóa lead ${(lead as any).leadCode}`,
    });

    return lead as Lead;
  }

  // --------------------------------------------------------------------
  // FOLLOW-UP AUTO-REMINDER (Phase 2.4) - Runs at 8am Mon-Sat
  // --------------------------------------------------------------------

  @Cron('0 8 * * 1-6')
  async checkFollowUpsDue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const leads = await this.leadModel.find({
      nextFollowUp: { $lte: tomorrow },
      status: { $in: [LeadStatus.CONTACTED, LeadStatus.CONSULTING, LeadStatus.INTERESTED, LeadStatus.NEW] },
      saleId: { $exists: true, $ne: null },
    }).lean();

    let notifCount = 0;
    for (const lead of leads) {
      if (!lead.saleId) continue;
      const isOverdue = new Date(lead.nextFollowUp!) < today;
      try {
        await this.notificationsService.create({
          recipientId: lead.saleId.toString(),
          recipientRole: 'SALE',
          type: NotificationType.LEAD_FOLLOW_UP,
          priority: isOverdue ? 'HIGH' as any : 'MEDIUM' as any,
          title: isOverdue ? 'Follow-up quá h?n' : 'Follow-up hôm nay',
          message: `Lead ${lead.leadCode} - ${lead.parentName} (${lead.parentPhone}) c?n follow-up${isOverdue ? ' (QUÁ H?N)' : ''}`,
          link: '/app/leads',
          targetId: (lead as any)._id.toString(),
          targetModule: 'LEADS',
        });
        notifCount++;
      } catch (err) {
        this.logger.error(`Failed to create follow-up notification for lead ${lead.leadCode}`, err);
      }
    }

    if (notifCount > 0) {
      this.logger.log(`Follow-up reminders: sent ${notifCount} notifications for ${leads.length} leads`);
    }
  }
}

