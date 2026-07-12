import { Types } from 'mongoose';
import { AuditAction, AuditModule } from '../audit-log/schemas/audit-log.schema';
import { Role } from '../common/interfaces/role.enum';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { AiActionDraftService } from './action-draft.service';
import { AiActionDraftStatus, AiActionKey, AiEntityType } from './ai-core.types';

describe('AiActionDraftService', () => {
  const user: any = {
    sub: '64b000000000000000000001',
    _id: '64b000000000000000000001',
    userId: '64b000000000000000000001',
    email: 'director@example.com',
    fullName: 'Director',
    role: Role.DIRECTOR,
  };

  function buildDraft(overrides: Record<string, any> = {}) {
    return {
      _id: new Types.ObjectId('64b000000000000000000099'),
      userId: new Types.ObjectId(user.sub),
      assistantType: AiAssistantType.DIRECTOR_OPERATIONS,
      actionKey: AiActionKey.UPDATE_TICKET,
      entityType: AiEntityType.TICKET,
      entityId: new Types.ObjectId('64b000000000000000000022'),
      payload: { priority: 'URGENT' },
      before: {},
      diff: [],
      warnings: [],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      requiresApproval: false,
      status: AiActionDraftStatus.PENDING_CONFIRMATION,
      expiresAt: new Date(Date.now() + 60_000),
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function buildService(draft: Record<string, any>, preview: Record<string, any>) {
    const actionDraftModel = {
      findOne: jest.fn().mockResolvedValue(draft),
    };
    const executor = {
      buildPreview: jest.fn().mockResolvedValue(preview),
      execute: jest.fn().mockResolvedValue({ ok: true, status: 'updated' }),
    };
    const policy = {
      assertCanDraft: jest.fn(),
    };
    const auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const service = new AiActionDraftService(
      actionDraftModel as any,
      executor as any,
      policy as any,
      auditLogService as any,
    );

    return { service, actionDraftModel, executor, policy, auditLogService };
  }

  it('moves approval-required drafts to pending approval without executing them', async () => {
    const draft = buildDraft({
      actionKey: AiActionKey.ADJUST_AD_BUDGET,
      entityType: AiEntityType.AD_GROUP,
      entityId: new Types.ObjectId('64b000000000000000000033'),
      payload: { dailyBudget: 300000 },
      requiresApproval: true,
      riskLevel: 'HIGH',
    });
    const preview = {
      actionKey: AiActionKey.ADJUST_AD_BUDGET,
      entityType: AiEntityType.AD_GROUP,
      entityId: draft.entityId.toString(),
      payload: { dailyBudget: 300000 },
      before: { dailyBudget: 500000 },
      diff: [{ field: 'dailyBudget', before: 500000, after: 300000 }],
      warnings: ['Day la thao tac ads rui ro cao.'],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      requiresApproval: true,
    };
    const { service, executor, auditLogService } = buildService(draft, preview);

    const result = await service.confirmAction(draft._id.toString(), {}, user);

    expect(result.status).toBe(AiActionDraftStatus.PENDING_APPROVAL);
    expect(draft.status).toBe(AiActionDraftStatus.PENDING_APPROVAL);
    expect((draft as any).confirmedBy.toString()).toBe(user.sub);
    expect((draft as any).executedAt).toBeUndefined();
    expect(draft.save).toHaveBeenCalledTimes(1);
    expect(executor.execute).not.toHaveBeenCalled();
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        module: AuditModule.CHATBOT,
        description: expect.stringContaining('awaiting approval'),
      }),
    );
  });

  it('executes drafts that do not require approval after confirmation', async () => {
    const draft = buildDraft();
    const preview = {
      actionKey: AiActionKey.UPDATE_TICKET,
      entityType: AiEntityType.TICKET,
      entityId: draft.entityId.toString(),
      payload: { priority: 'URGENT' },
      before: { priority: 'MEDIUM' },
      diff: [{ field: 'priority', before: 'MEDIUM', after: 'URGENT' }],
      warnings: [],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      requiresApproval: false,
    };
    const { service, executor } = buildService(draft, preview);

    const result = await service.confirmAction(draft._id.toString(), {}, user);

    expect(result.status).toBe(AiActionDraftStatus.EXECUTED);
    expect(draft.status).toBe(AiActionDraftStatus.EXECUTED);
    expect((draft as any).executedBy.toString()).toBe(user.sub);
    expect(executor.execute).toHaveBeenCalledWith(preview, user);
  });

  it('approves and executes drafts that are pending approval', async () => {
    const draft = buildDraft({
      actionKey: AiActionKey.ADJUST_AD_BUDGET,
      entityType: AiEntityType.AD_GROUP,
      entityId: new Types.ObjectId('64b000000000000000000033'),
      payload: { dailyBudget: 300000 },
      requiresApproval: true,
      riskLevel: 'HIGH',
      status: AiActionDraftStatus.PENDING_APPROVAL,
    });
    const preview = {
      actionKey: AiActionKey.ADJUST_AD_BUDGET,
      entityType: AiEntityType.AD_GROUP,
      entityId: draft.entityId.toString(),
      payload: { dailyBudget: 300000 },
      before: { dailyBudget: 500000 },
      diff: [{ field: 'dailyBudget', before: 500000, after: 300000 }],
      warnings: ['Day la thao tac ads rui ro cao.'],
      riskLevel: 'HIGH',
      requiresConfirmation: true,
      requiresApproval: true,
    };
    const { service, executor, auditLogService } = buildService(draft, preview);

    const result = await service.approveAction(
      draft._id.toString(),
      { approvalNote: 'Director approved' },
      user,
    );

    expect(result.status).toBe(AiActionDraftStatus.EXECUTED);
    expect(draft.status).toBe(AiActionDraftStatus.EXECUTED);
    expect((draft as any).executedBy.toString()).toBe(user.sub);
    expect((draft as any).executionResult).toMatchObject({
      ok: true,
      approvalNote: 'Director approved',
    });
    expect(executor.execute).toHaveBeenCalledWith(preview, user);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        module: AuditModule.CHATBOT,
        description: expect.stringContaining('approved and executed'),
      }),
    );
  });

  it('does not allow non-director roles to approve pending approval drafts', async () => {
    const draft = buildDraft({
      status: AiActionDraftStatus.PENDING_APPROVAL,
      requiresApproval: true,
    });
    const preview = {
      actionKey: AiActionKey.UPDATE_TICKET,
      entityType: AiEntityType.TICKET,
      entityId: draft.entityId.toString(),
      payload: { priority: 'URGENT' },
      before: { priority: 'MEDIUM' },
      diff: [{ field: 'priority', before: 'MEDIUM', after: 'URGENT' }],
      warnings: [],
      riskLevel: 'MEDIUM',
      requiresConfirmation: true,
      requiresApproval: true,
    };
    const { service, executor } = buildService(draft, preview);

    await expect(service.approveAction(
      draft._id.toString(),
      {},
      { ...user, role: Role.ADSMANAGER },
    )).rejects.toThrow('Chi Giam doc');
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
