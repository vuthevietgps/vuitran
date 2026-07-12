import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateAiFeedbackDto } from './dto/create-ai-feedback.dto';
import { QueryAiFeedbackDto } from './dto/query-ai-feedback.dto';
import { UpdateAiFeedbackStatusDto } from './dto/update-ai-feedback-status.dto';
import {
  AiFeedback,
  AiFeedbackDocument,
  AiFeedbackCategory,
  AiFeedbackSeverity,
  AiFeedbackStatus,
} from './schemas/ai-feedback.schema';

const MAX_ARRAY_ITEMS = 20;

@Injectable()
export class AiFeedbackService {
  constructor(
    @InjectModel(AiFeedback.name)
    private readonly aiFeedbackModel: Model<AiFeedbackDocument>,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateAiFeedbackDto, user: JwtPayload) {
    this.assertHasUsefulFeedback(dto);

    const payload = {
      userId: this.toObjectId(user.sub),
      userEmail: this.trim(user.email, 180),
      userFullName: this.trim(user.fullName, 180),
      userRole: user.role,
      source: dto.source,
      assistantType: this.trim(dto.assistantType, 80),
      sessionId: this.toOptionalObjectId(dto.sessionId),
      messageId: this.toOptionalObjectId(dto.messageId),
      activeRoute: this.trim(dto.activeRoute, 160),
      contextKeys: this.sanitizeList(dto.contextKeys),
      toolKeys: this.sanitizeList(dto.toolKeys),
      userMessage: this.trim(dto.userMessage, 6000),
      assistantAnswer: this.trim(dto.assistantAnswer, 12000),
      category: dto.category || AiFeedbackCategory.OTHER,
      severity: dto.severity || AiFeedbackSeverity.MEDIUM,
      reason: this.trim(dto.reason, 3000),
      status: AiFeedbackStatus.NEW,
      metadata: dto.metadata,
    };

    const duplicate = payload.messageId
      ? await this.aiFeedbackModel.findOne({
          userId: payload.userId,
          source: payload.source,
          messageId: payload.messageId,
        })
      : null;

    const feedback = duplicate
      ? await this.updateDuplicate(duplicate, payload)
      : await this.aiFeedbackModel.create(payload);

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: duplicate ? AuditAction.UPDATE : AuditAction.CREATE,
      module: AuditModule.CHATBOT,
      targetId: feedback._id?.toString(),
      targetName: `${payload.source}:${payload.assistantType || 'UNKNOWN'}`,
      description: duplicate
        ? `AI feedback merged: ${payload.category}/${payload.severity}`
        : `AI feedback captured: ${payload.category}/${payload.severity}`,
      newValue: {
        source: payload.source,
        assistantType: payload.assistantType,
        sessionId: dto.sessionId,
        messageId: dto.messageId,
        category: payload.category,
        severity: payload.severity,
        status: feedback.status,
      },
    });

    return {
      id: feedback._id?.toString(),
      status: feedback.status,
      duplicateMerged: Boolean(duplicate),
    };
  }

  async findAll(query: QueryAiFeedbackDto) {
    const filter: FilterQuery<AiFeedbackDocument> = {};

    if (query.status) filter.status = query.status;
    if (query.source) filter.source = query.source;
    if (query.assistantType) filter.assistantType = query.assistantType;
    if (query.category) filter.category = query.category;
    if (query.severity) filter.severity = query.severity;
    if (query.userRole) filter.userRole = query.userRole;

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    if (query.search?.trim()) {
      const regex = new RegExp(this.escapeRegex(query.search.trim()), 'i');
      filter.$or = [
        { userMessage: regex },
        { assistantAnswer: regex },
        { reason: regex },
        { userFullName: regex },
        { userEmail: regex },
      ];
    }

    const page = Math.max(1, Math.floor(query.page || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(query.limit || 30)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.aiFeedbackModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.aiFeedbackModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(id: string, dto: UpdateAiFeedbackStatusDto, user: JwtPayload) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('aiFeedbackId khong hop le');
    }

    const feedback = await this.aiFeedbackModel.findById(id);
    if (!feedback) {
      throw new NotFoundException('Khong tim thay AI feedback');
    }

    const oldStatus = feedback.status;
    feedback.status = dto.status;
    feedback.resolutionNotes = this.trim(dto.resolutionNotes, 2000);
    await feedback.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.CHATBOT,
      targetId: feedback._id?.toString(),
      targetName: `${feedback.source}:${feedback.assistantType || 'UNKNOWN'}`,
      description: `AI feedback status changed: ${oldStatus} -> ${feedback.status}`,
      oldValue: { status: oldStatus },
      newValue: {
        status: feedback.status,
        resolutionNotes: feedback.resolutionNotes,
      },
    });

    return {
      id: feedback._id?.toString(),
      status: feedback.status,
      resolutionNotes: feedback.resolutionNotes,
    };
  }

  private async updateDuplicate(
    feedback: AiFeedbackDocument,
    payload: Partial<AiFeedback>,
  ) {
    feedback.category = payload.category || feedback.category;
    feedback.severity = payload.severity || feedback.severity;
    feedback.reason = payload.reason || feedback.reason;
    feedback.activeRoute = payload.activeRoute || feedback.activeRoute;
    feedback.contextKeys = payload.contextKeys || feedback.contextKeys;
    feedback.toolKeys = payload.toolKeys || feedback.toolKeys;
    feedback.userMessage = payload.userMessage || feedback.userMessage;
    feedback.assistantAnswer = payload.assistantAnswer || feedback.assistantAnswer;
    feedback.metadata = {
      ...(feedback.metadata || {}),
      ...(payload.metadata || {}),
    };
    feedback.status = AiFeedbackStatus.NEW;
    return feedback.save();
  }

  private assertHasUsefulFeedback(dto: CreateAiFeedbackDto) {
    const hasContent = [
      dto.reason,
      dto.userMessage,
      dto.assistantAnswer,
      dto.messageId,
    ].some((value) => String(value || '').trim().length > 0);

    if (!hasContent) {
      throw new BadRequestException('Can co messageId, cau hoi, cau tra loi hoac ly do feedback');
    }
  }

  private toObjectId(value: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('userId khong hop le');
    }
    return new Types.ObjectId(value);
  }

  private toOptionalObjectId(value?: string) {
    if (!value) return undefined;
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('ObjectId khong hop le');
    }
    return new Types.ObjectId(value);
  }

  private sanitizeList(values?: string[]) {
    return (values || [])
      .map((value) => this.trim(value, 120))
      .filter((value): value is string => Boolean(value))
      .slice(0, MAX_ARRAY_ITEMS);
  }

  private trim(value: unknown, maxLength: number) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
