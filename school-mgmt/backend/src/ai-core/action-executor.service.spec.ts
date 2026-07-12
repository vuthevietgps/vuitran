import { Types } from 'mongoose';
import { AiActionExecutorService } from './action-executor.service';
import { AiActionPolicyService } from './action-policy.service';
import { AiActionKey } from './ai-core.types';
import { Role } from '../common/interfaces/role.enum';
import { AdGroupStatus } from '../ads/schemas/ad-group.schema';

describe('AiActionExecutorService', () => {
  const user: any = {
    sub: new Types.ObjectId().toString(),
    _id: new Types.ObjectId().toString(),
    userId: new Types.ObjectId().toString(),
    email: 'director@example.com',
    fullName: 'Director',
    role: Role.DIRECTOR,
  };

  function buildService() {
    const studentsService = {};
    const classesService = {};
    const leadsService = {};
    const ticketsService = {
      findById: jest.fn(),
      update: jest.fn(),
      addComment: jest.fn(),
    };
    const adsService = {
      findOneGroup: jest.fn(),
      updateGroup: jest.fn(),
      createGroup: jest.fn(),
      syncAccountCosts: jest.fn(),
    };
    const sessionsService = {
      getHomeworkForGradingDetail: jest.fn(),
      gradeHomework: jest.fn(),
    };
    const quizzesService = {
      findAttemptForGrading: jest.fn(),
      gradeAttempt: jest.fn(),
    };
    const policyService = new AiActionPolicyService();
    const service = new AiActionExecutorService(
      studentsService as any,
      classesService as any,
      leadsService as any,
      ticketsService as any,
      adsService as any,
      policyService,
      sessionsService as any,
      undefined as any,
      undefined as any,
      quizzesService as any,
    );
    return { service, adsService, ticketsService, sessionsService, quizzesService };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('previews and executes ad budget adjustments through AdsService', async () => {
    const { service, adsService } = buildService();
    const adGroupId = new Types.ObjectId().toString();
    adsService.findOneGroup.mockResolvedValue({
      _id: adGroupId,
      name: 'Google Search',
      dailyBudget: 500000,
      status: AdGroupStatus.ACTIVE,
    });
    adsService.updateGroup.mockResolvedValue({
      _id: adGroupId,
      dailyBudget: 300000,
      status: AdGroupStatus.ACTIVE,
    });

    const preview = await service.buildPreview({
      actionKey: AiActionKey.ADJUST_AD_BUDGET,
      entityId: adGroupId,
      payload: { dailyBudget: 300000, reason: 'Loss last 7 days' },
      user,
    });

    expect(preview.diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'dailyBudget',
          before: 500000,
          after: 300000,
        }),
      ]),
    );
    expect(preview.requiresApproval).toBe(true);
    expect(preview.warnings.join(' ')).toContain('thao tac ads rui ro cao');

    await service.execute(preview, user);

    expect(adsService.updateGroup).toHaveBeenCalledWith(adGroupId, {
      dailyBudget: 300000,
    });
  });

  it('executes pause and resume ad group actions with fixed safe statuses', async () => {
    const { service, adsService } = buildService();
    const adGroupId = new Types.ObjectId().toString();
    adsService.updateGroup.mockResolvedValue({});

    await service.execute({
      actionKey: AiActionKey.PAUSE_AD_GROUP,
      entityId: adGroupId,
      payload: { status: AdGroupStatus.PAUSED },
    }, user);
    await service.execute({
      actionKey: AiActionKey.RESUME_AD_GROUP,
      entityId: adGroupId,
      payload: { status: AdGroupStatus.ACTIVE },
    }, user);

    expect(adsService.updateGroup).toHaveBeenNthCalledWith(1, adGroupId, {
      status: AdGroupStatus.PAUSED,
    });
    expect(adsService.updateGroup).toHaveBeenNthCalledWith(2, adGroupId, {
      status: AdGroupStatus.ACTIVE,
    });
  });

  it('syncs ad costs over a bounded lookback window', async () => {
    const { service, adsService } = buildService();
    const adAccountId = new Types.ObjectId().toString();
    adsService.syncAccountCosts.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const result = await service.execute({
      actionKey: AiActionKey.SYNC_AD_COSTS,
      payload: {
        adAccountId,
        date: '2026-06-09',
        lookbackDays: 2,
      },
    }, user);

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      adAccountId,
      synced: 5,
    }));
    expect(adsService.syncAccountCosts).toHaveBeenNthCalledWith(1, adAccountId, '2026-06-09');
    expect(adsService.syncAccountCosts).toHaveBeenNthCalledWith(2, adAccountId, '2026-06-08');
  });

  it('creates ad group drafts as paused ERP-only groups with generated draft identifiers', async () => {
    const { service, adsService } = buildService();
    const adAccountId = new Types.ObjectId().toString();
    adsService.createGroup.mockResolvedValue({});

    const preview = await service.buildPreview({
      actionKey: AiActionKey.CREATE_AD_GROUP_DRAFT,
      payload: {
        name: 'Facebook Grade 6 June',
        adAccountId,
        platform: 'FACEBOOK',
        dailyBudget: 500000,
      },
      user,
    });

    expect(preview.payload).toMatchObject({
      name: 'Facebook Grade 6 June',
      adAccountId,
      platform: 'FACEBOOK',
      dailyBudget: 500000,
    });
    expect(String(preview.payload.platformCampaignId)).toMatch(/^DRAFT-FACEBOOK-/);
    expect(preview.payload.trackingKeys).toEqual([
      expect.stringMatching(/^draft-facebook-/),
    ]);
    expect(preview.warnings.join(' ')).toContain('ERP/sync');

    await service.execute(preview, user);

    expect(adsService.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Facebook Grade 6 June',
        adAccountId,
        platform: 'FACEBOOK',
        dailyBudget: 500000,
        status: AdGroupStatus.PAUSED,
        platformCampaignId: expect.stringMatching(/^DRAFT-FACEBOOK-/),
        trackingKeys: [expect.stringMatching(/^draft-facebook-/)],
      }),
      user,
    );
  });

  it('previews and executes ticket priority updates through TicketsService', async () => {
    const { service, ticketsService } = buildService();
    const ticketId = new Types.ObjectId().toString();
    ticketsService.findById.mockResolvedValue({
      _id: ticketId,
      ticketCode: 'TKT-1001',
      priority: 'MEDIUM',
      assignedTo: new Types.ObjectId().toString(),
    });
    ticketsService.update.mockResolvedValue({
      _id: ticketId,
      priority: 'URGENT',
    });

    const preview = await service.buildPreview({
      actionKey: AiActionKey.UPDATE_TICKET,
      entityId: ticketId,
      payload: { priority: 'URGENT' },
      user,
    });

    expect(preview.diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'priority',
          before: 'MEDIUM',
          after: 'URGENT',
        }),
      ]),
    );
    expect(preview.requiresApproval).toBe(false);

    await service.execute(preview, user);

    expect(ticketsService.findById).toHaveBeenCalledWith(ticketId, user);
    expect(ticketsService.update).toHaveBeenCalledWith(ticketId, { priority: 'URGENT' });
  });

  it('previews and executes internal ticket comments through TicketsService', async () => {
    const { service, ticketsService } = buildService();
    const ticketId = new Types.ObjectId().toString();
    ticketsService.findById.mockResolvedValue({
      _id: ticketId,
      ticketCode: 'TKT-1002',
      priority: 'HIGH',
      comments: [],
    });
    ticketsService.addComment.mockResolvedValue({
      _id: ticketId,
      commentCount: 1,
    });

    const preview = await service.buildPreview({
      actionKey: AiActionKey.ADD_TICKET_COMMENT,
      entityId: ticketId,
      payload: {
        content: 'Da goi phu huynh va hen xu ly lai',
        isInternal: true,
      },
      user,
    });

    expect(preview.diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'content',
          before: undefined,
          after: 'Da goi phu huynh va hen xu ly lai',
        }),
        expect.objectContaining({
          field: 'isInternal',
          before: undefined,
          after: true,
        }),
      ]),
    );
    expect(preview.warnings.join(' ')).toContain('Comment noi bo');

    await service.execute(preview, user);

    expect(ticketsService.findById).toHaveBeenCalledWith(ticketId, user);
    expect(ticketsService.addComment).toHaveBeenCalledWith(
      ticketId,
      user.sub,
      {
        content: 'Da goi phu huynh va hen xu ly lai',
        isInternal: true,
      },
      user,
    );
  });

  it('previews and executes homework grading through SessionsService', async () => {
    const { service, sessionsService } = buildService();
    const sessionId = new Types.ObjectId().toString();
    const reviewer = { ...user, role: Role.EXPERIENCE_TEACHER };
    sessionsService.getHomeworkForGradingDetail.mockResolvedValue({
      _id: sessionId,
      evaluation: {
        homeworkScore: 6,
        homeworkFeedback: 'Can bo sung dan chung.',
      },
    });
    sessionsService.gradeHomework.mockResolvedValue({
      _id: sessionId,
      evaluation: {
        homeworkScore: 8,
      },
    });

    const preview = await service.buildPreview({
      actionKey: AiActionKey.GRADE_HOMEWORK,
      entityId: sessionId,
      payload: {
        score: 8,
        feedback: 'Lam dung trong tam, can trinh bay ro hon.',
      },
      user: reviewer,
    });

    expect(preview.diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'score', before: 6, after: 8 }),
      expect.objectContaining({
        field: 'feedback',
        before: 'Can bo sung dan chung.',
        after: 'Lam dung trong tam, can trinh bay ro hon.',
      }),
    ]));
    expect(preview.warnings.join(' ')).toContain('rubric');

    await service.execute(preview, reviewer);

    expect(sessionsService.gradeHomework).toHaveBeenCalledWith(sessionId, reviewer, {
      score: 8,
      feedback: 'Lam dung trong tam, can trinh bay ro hon.',
    });
  });

  it('previews and executes quiz attempt grading through QuizzesService', async () => {
    const { service, quizzesService } = buildService();
    const attemptId = new Types.ObjectId().toString();
    const reviewer = { ...user, role: Role.EXPERIENCE_TEACHER };
    quizzesService.findAttemptForGrading.mockResolvedValue({
      _id: attemptId,
      manualScore: 2,
      manualFeedback: 'Thieu y chinh.',
    });
    quizzesService.gradeAttempt.mockResolvedValue({
      _id: attemptId,
      manualScore: 4,
    });

    const preview = await service.buildPreview({
      actionKey: AiActionKey.GRADE_QUIZ_ATTEMPT,
      entityId: attemptId,
      payload: {
        manualScore: 4,
        manualFeedback: 'Tra loi dung y chinh, can them vi du.',
      },
      user: reviewer,
    });

    expect(preview.diff).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'manualScore', before: 2, after: 4 }),
      expect.objectContaining({
        field: 'manualFeedback',
        before: 'Thieu y chinh.',
        after: 'Tra loi dung y chinh, can them vi du.',
      }),
    ]));

    await service.execute(preview, reviewer);

    expect(quizzesService.gradeAttempt).toHaveBeenCalledWith(attemptId, {
      manualScore: 4,
      manualFeedback: 'Tra loi dung y chinh, can them vi du.',
    }, reviewer);
  });
});
