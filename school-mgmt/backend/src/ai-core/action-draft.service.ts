import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  ApproveAiActionDto,
  ConfirmAiActionDto,
  PreviewAiActionDto,
  QueryAiActionsDto,
  RejectAiActionDto,
} from './dto/ai-action.dto';
import {
  AiActionDraftStatus,
  AiActionKey,
  AiActionPreview,
  AiEntityType,
} from './ai-core.types';
import { AiActionDraft, AiActionDraftDocument } from './schemas/ai-action-draft.schema';
import { AiActionExecutorService } from './action-executor.service';
import { AiActionPolicyService } from './action-policy.service';

const DEFAULT_ACTION_LIMIT = 20;
const MAX_ACTION_LIMIT = 50;
const DRAFT_TTL_HOURS = 24;

@Injectable()
export class AiActionDraftService {
  constructor(
    @InjectModel(AiActionDraft.name)
    private readonly actionDraftModel: Model<AiActionDraftDocument>,
    private readonly executor: AiActionExecutorService,
    private readonly policy: AiActionPolicyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createPreview(dto: PreviewAiActionDto, user: JwtPayload, assistantType: AiAssistantType) {
    this.policy.assertCanDraft(dto.actionKey, user);
    const preview = await this.executor.buildPreview({
      actionKey: dto.actionKey,
      entityId: dto.entityId,
      payload: dto.payload,
      user,
    });

    const draft = await this.actionDraftModel.create({
      userId: new Types.ObjectId(user.sub),
      sessionId: dto.sessionId ? new Types.ObjectId(dto.sessionId) : undefined,
      assistantType,
      actionKey: dto.actionKey,
      entityType: preview.entityType,
      entityId: dto.entityId ? new Types.ObjectId(dto.entityId) : undefined,
      payload: preview.payload,
      before: preview.before,
      diff: preview.diff,
      warnings: preview.warnings,
      riskLevel: preview.riskLevel,
      requiresConfirmation: preview.requiresConfirmation,
      requiresApproval: preview.requiresApproval,
      status: AiActionDraftStatus.PENDING_CONFIRMATION,
      sourceMessage: dto.sourceMessage,
      requestedBySnapshot: this.userSnapshot(user),
      expiresAt: this.buildExpiryDate(),
    });

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: AuditModule.CHATBOT,
      targetId: draft._id?.toString(),
      targetName: dto.actionKey,
      description: `AI action draft created: ${dto.actionKey}`,
      newValue: {
        actionKey: dto.actionKey,
        entityType: preview.entityType,
        entityId: dto.entityId,
        diff: preview.diff,
        warnings: preview.warnings,
      },
    });

    return this.toActionResponse(draft, preview);
  }

  async listMyActions(query: QueryAiActionsDto, user: JwtPayload, assistantType: AiAssistantType) {
    const limit = this.parseLimit(query.limit);
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(user.sub),
      assistantType,
    };
    if (query.status) filter.status = query.status;

    const actions = await this.actionDraftModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return { data: actions.map((action) => this.toActionResponse(action as any)) };
  }

  async listApprovalActions(query: QueryAiActionsDto, user: JwtPayload, assistantType: AiAssistantType) {
    this.assertCanApprove(user);
    const limit = this.parseLimit(query.limit);
    const filter: Record<string, unknown> = {
      assistantType,
      status: query.status || AiActionDraftStatus.PENDING_APPROVAL,
    };

    const actions = await this.actionDraftModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return { data: actions.map((action) => this.toActionResponse(action as any)) };
  }

  async confirmAction(id: string, _dto: ConfirmAiActionDto, user: JwtPayload) {
    const draft = await this.findOwnedDraft(id, user);
    this.assertPending(draft);
    this.policy.assertCanDraft(draft.actionKey, user);

    let freshPreview: AiActionPreview;
    try {
      freshPreview = await this.executor.buildPreview({
        actionKey: draft.actionKey,
        entityId: draft.entityId?.toString(),
        payload: draft.payload,
        user,
      });
    } catch (err) {
      await this.markFailed(draft, this.getErrorMessage(err), user);
      throw err;
    }

    if (freshPreview.requiresApproval) {
      draft.status = AiActionDraftStatus.PENDING_APPROVAL;
      draft.confirmedBy = new Types.ObjectId(user.sub);
      draft.confirmedAt = new Date();
      draft.before = freshPreview.before;
      draft.diff = freshPreview.diff as unknown as Array<Record<string, unknown>>;
      draft.warnings = freshPreview.warnings;
      await draft.save();

      await this.auditLogService.log({
        userId: user.sub,
        userEmail: user.email,
        userFullName: user.fullName,
        userRole: user.role,
        action: AuditAction.UPDATE,
        module: AuditModule.CHATBOT,
        targetId: draft._id?.toString(),
        targetName: draft.actionKey,
        description: `AI action draft awaiting approval: ${draft.actionKey}`,
        newValue: {
          actionKey: draft.actionKey,
          entityType: draft.entityType,
          entityId: draft.entityId?.toString(),
          payload: draft.payload,
          diff: freshPreview.diff,
          requiresApproval: true,
          status: draft.status,
        },
      });

      return this.toActionResponse(draft as any, freshPreview);
    }

    try {
      const executionResult = await this.executor.execute(freshPreview, user);
      draft.status = AiActionDraftStatus.EXECUTED;
      draft.confirmedBy = new Types.ObjectId(user.sub);
      draft.confirmedAt = new Date();
      draft.executedBy = new Types.ObjectId(user.sub);
      draft.executedAt = new Date();
      draft.before = freshPreview.before;
      draft.diff = freshPreview.diff as unknown as Array<Record<string, unknown>>;
      draft.executionResult = this.toSerializableResult(executionResult);
      await draft.save();

      await this.auditLogService.log({
        userId: user.sub,
        userEmail: user.email,
        userFullName: user.fullName,
        userRole: user.role,
        action: AuditAction.UPDATE,
        module: AuditModule.CHATBOT,
        targetId: draft._id?.toString(),
        targetName: draft.actionKey,
        description: `AI action draft executed: ${draft.actionKey}`,
        oldValue: freshPreview.before,
        newValue: {
          actionKey: draft.actionKey,
          entityType: draft.entityType,
          entityId: draft.entityId?.toString(),
          payload: draft.payload,
          diff: freshPreview.diff,
          executionResult: draft.executionResult,
        },
      });

      return this.toActionResponse(draft as any, freshPreview);
    } catch (err) {
      await this.markFailed(draft, this.getErrorMessage(err), user);
      throw err;
    }
  }

  async rejectAction(id: string, dto: RejectAiActionDto, user: JwtPayload) {
    const draft = await this.findOwnedDraft(id, user);
    this.assertPending(draft);

    draft.status = AiActionDraftStatus.REJECTED;
    draft.rejectedBy = new Types.ObjectId(user.sub);
    draft.rejectedAt = new Date();
    draft.rejectReason = dto.reason;
    await draft.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.CHATBOT,
      targetId: draft._id?.toString(),
      targetName: draft.actionKey,
      description: `AI action draft rejected: ${draft.actionKey}`,
      newValue: {
        status: draft.status,
        reason: dto.reason,
      },
    });

    return this.toActionResponse(draft as any);
  }

  async approveAction(id: string, dto: ApproveAiActionDto, user: JwtPayload) {
    this.assertCanApprove(user);
    const draft = await this.findDraftForApproval(id);
    this.assertPendingApproval(draft);
    this.policy.assertCanDraft(draft.actionKey, user);

    let freshPreview: AiActionPreview;
    try {
      freshPreview = await this.executor.buildPreview({
        actionKey: draft.actionKey,
        entityId: draft.entityId?.toString(),
        payload: draft.payload,
        user,
      });
    } catch (err) {
      await this.markFailed(draft, this.getErrorMessage(err), user);
      throw err;
    }

    try {
      const executionResult = await this.executor.execute(freshPreview, user);
      draft.status = AiActionDraftStatus.EXECUTED;
      draft.executedBy = new Types.ObjectId(user.sub);
      draft.executedAt = new Date();
      draft.before = freshPreview.before;
      draft.diff = freshPreview.diff as unknown as Array<Record<string, unknown>>;
      draft.warnings = freshPreview.warnings;
      draft.executionResult = {
        ...this.toSerializableResult(executionResult),
        approvalNote: dto.approvalNote,
      };
      await draft.save();

      await this.auditLogService.log({
        userId: user.sub,
        userEmail: user.email,
        userFullName: user.fullName,
        userRole: user.role,
        action: AuditAction.UPDATE,
        module: AuditModule.CHATBOT,
        targetId: draft._id?.toString(),
        targetName: draft.actionKey,
        description: `AI action draft approved and executed: ${draft.actionKey}`,
        oldValue: freshPreview.before,
        newValue: {
          actionKey: draft.actionKey,
          entityType: draft.entityType,
          entityId: draft.entityId?.toString(),
          payload: draft.payload,
          diff: freshPreview.diff,
          approvalNote: dto.approvalNote,
          executionResult: draft.executionResult,
        },
      });

      return this.toActionResponse(draft as any, freshPreview);
    } catch (err) {
      await this.markFailed(draft, this.getErrorMessage(err), user);
      throw err;
    }
  }

  async confirmLatestPendingForSession(sessionId: string, user: JwtPayload) {
    const draft = await this.findLatestPendingForSession(sessionId, user);
    return this.confirmAction(draft._id.toString(), {}, user);
  }

  async rejectLatestPendingForSession(sessionId: string, user: JwtPayload, reason?: string) {
    const draft = await this.findLatestPendingForSession(sessionId, user);
    return this.rejectAction(draft._id.toString(), { reason }, user);
  }

  formatDraftAnswer(result: any) {
    const diffLines = (result.diff || [])
      .slice(0, 8)
      .map((item: any) => `- ${item.label || item.field}: ${this.formatValue(item.before)} -> ${this.formatValue(item.after)}`);
    const warnings = (result.warnings || []).map((warning: string) => `Canh bao: ${warning}`);

    return [
      `Toi da tao nhap hanh dong ${result.actionKey}.`,
      `Ma nhap: ${result.id}.`,
      diffLines.length ? 'Thay doi du kien:' : undefined,
      ...diffLines,
      ...warnings,
      'Hay tra loi "xac nhan nhap nay" de thuc thi, hoac "huy nhap nay" de tu choi.',
    ].filter(Boolean).join('\n');
  }

  formatExecutedAnswer(result: any) {
    if (result.status === AiActionDraftStatus.PENDING_APPROVAL) {
      return [
        `Da xac nhan nhap ${result.id} va chuyen sang hang cho phe duyet.`,
        `Action: ${result.actionKey}.`,
        result.entityId ? `Doi tuong: ${result.entityType}/${result.entityId}.` : undefined,
        'Chua thuc thi thay doi vi action nay can approval rieng.',
      ].filter(Boolean).join('\n');
    }

    return [
      `Da thuc thi nhap ${result.id}.`,
      `Action: ${result.actionKey}.`,
      result.entityId ? `Doi tuong: ${result.entityType}/${result.entityId}.` : undefined,
      'Thao tac da duoc ghi audit log.',
    ].filter(Boolean).join('\n');
  }

  formatApprovedAnswer(result: any) {
    return [
      `Da phe duyet va thuc thi nhap ${result.id}.`,
      `Action: ${result.actionKey}.`,
      result.entityId ? `Doi tuong: ${result.entityType}/${result.entityId}.` : undefined,
      'Thao tac da duoc ghi audit log.',
    ].filter(Boolean).join('\n');
  }

  formatRejectedAnswer(result: any) {
    return [
      `Da huy nhap ${result.id}.`,
      `Action: ${result.actionKey}.`,
    ].join('\n');
  }

  private async findOwnedDraft(id: string, user: JwtPayload) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('action draft id khong hop le');
    }

    const draft = await this.actionDraftModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(user.sub),
    });

    if (!draft) {
      throw new NotFoundException('Khong tim thay nhap action');
    }
    return draft;
  }

  private async findDraftForApproval(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('action draft id khong hop le');
    }

    const draft = await this.actionDraftModel.findOne({
      _id: new Types.ObjectId(id),
    });

    if (!draft) {
      throw new NotFoundException('Khong tim thay nhap action');
    }
    return draft;
  }

  private async findLatestPendingForSession(sessionId: string, user: JwtPayload) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new BadRequestException('sessionId khong hop le');
    }

    const draft = await this.actionDraftModel
      .findOne({
        sessionId: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(user.sub),
        status: AiActionDraftStatus.PENDING_CONFIRMATION,
      })
      .sort({ updatedAt: -1 });

    if (!draft) {
      throw new NotFoundException('Khong co nhap action nao dang cho xac nhan trong phien nay');
    }
    return draft;
  }

  private assertPending(draft: AiActionDraftDocument) {
    if (draft.status !== AiActionDraftStatus.PENDING_CONFIRMATION) {
      throw new ForbiddenException('Nhap action khong con o trang thai cho xac nhan');
    }
    if (draft.expiresAt && draft.expiresAt.getTime() < Date.now()) {
      draft.status = AiActionDraftStatus.EXPIRED;
      void draft.save();
      throw new ForbiddenException('Nhap action da het han');
    }
  }

  private assertPendingApproval(draft: AiActionDraftDocument) {
    if (draft.status !== AiActionDraftStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Nhap action khong o trang thai cho phe duyet');
    }
    if (draft.expiresAt && draft.expiresAt.getTime() < Date.now()) {
      draft.status = AiActionDraftStatus.EXPIRED;
      void draft.save();
      throw new ForbiddenException('Nhap action da het han');
    }
  }

  private assertCanApprove(user: JwtPayload) {
    if (user.role !== Role.DIRECTOR) {
      throw new ForbiddenException('Chi Giam doc duoc phe duyet action AI rui ro cao');
    }
  }

  private async markFailed(draft: AiActionDraftDocument, errorMessage: string, user: JwtPayload) {
    draft.status = AiActionDraftStatus.FAILED;
    draft.errorMessage = errorMessage;
    await draft.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.UPDATE,
      module: AuditModule.CHATBOT,
      targetId: draft._id?.toString(),
      targetName: draft.actionKey,
      description: `AI action draft failed: ${draft.actionKey}`,
      newValue: {
        status: draft.status,
        errorMessage,
      },
    });
  }

  private toActionResponse(draft: AiActionDraftDocument | any, preview?: AiActionPreview) {
    return {
      id: draft._id?.toString(),
      status: draft.status,
      assistantType: draft.assistantType,
      actionKey: draft.actionKey,
      entityType: draft.entityType,
      entityId: draft.entityId?.toString?.(),
      payload: draft.payload,
      before: preview?.before || draft.before,
      diff: preview?.diff || draft.diff || [],
      warnings: preview?.warnings || draft.warnings || [],
      riskLevel: draft.riskLevel,
      requiresConfirmation: draft.requiresConfirmation,
      requiresApproval: draft.requiresApproval,
      expiresAt: draft.expiresAt,
      sourceMessage: draft.sourceMessage,
      errorMessage: draft.errorMessage,
      executionResult: draft.executionResult,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private userSnapshot(user: JwtPayload) {
    return {
      sub: user.sub,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      userCode: user.userCode,
    };
  }

  private buildExpiryDate() {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + DRAFT_TTL_HOURS);
    return expiresAt;
  }

  private parseLimit(value?: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ACTION_LIMIT;
    return Math.min(Math.floor(parsed), MAX_ACTION_LIMIT);
  }

  private toSerializableResult(value: unknown): Record<string, unknown> {
    if (!value) return {};
    const plain = typeof (value as any).toObject === 'function'
      ? (value as any).toObject()
      : JSON.parse(JSON.stringify(value));
    return {
      id: plain?._id?.toString?.() || plain?.id,
      ok: plain?.ok,
      pendingApproval: plain?.pendingApproval,
      message: plain?.message,
      status: plain?.status,
      code: plain?.code || plain?.studentCode,
      name: plain?.name || plain?.fullName,
    };
  }

  private formatValue(value: unknown) {
    if (value === undefined || value === null || value === '') return '(trong)';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) return error.message;
    return 'Khong the thuc thi nhap action';
  }
}
