import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AiActionKey, AiEntityType } from './ai-core.types';
import { AiActionPolicyService } from './action-policy.service';

function user(role: Role): JwtPayload {
  return {
    sub: '64b000000000000000000001',
    _id: '64b000000000000000000001',
    userId: '64b000000000000000000001',
    email: `${role.toLowerCase()}@example.com`,
    role,
    fullName: role,
  };
}

describe('AiActionPolicyService', () => {
  let service: AiActionPolicyService;

  beforeEach(() => {
    service = new AiActionPolicyService();
  });

  it('denies roles that cannot update students', () => {
    expect(() =>
      service.assertCanDraft(AiActionKey.UPDATE_STUDENT, user(Role.PARENT)),
    ).toThrow(ForbiddenException);
  });

  it('rejects fields outside the action allowlist', () => {
    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.UPDATE_STUDENT,
        { payments: [{ amountCollected: 1 }] },
        user(Role.DIRECTOR),
      ),
    ).toThrow(BadRequestException);
  });

  it('requires mandatory fields when creating a student', () => {
    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.CREATE_STUDENT,
        { studentCode: 'STU-1', fullName: 'Nguyen Van A' },
        user(Role.OPS),
      ),
    ).toThrow(BadRequestException);
  });

  it('accepts and trims a safe student phone update', () => {
    const payload = service.sanitizeAndValidatePayload(
      AiActionKey.UPDATE_STUDENT,
      { parentPhone: ' 0901234567 ' },
      user(Role.SALE),
    );

    expect(payload).toEqual({ parentPhone: '0901234567' });
  });

  it('accepts a safe lead draft and rejects invalid lead source', () => {
    expect(service.sanitizeAndValidatePayload(
      AiActionKey.CREATE_LEAD,
      { parentName: 'Nguyen Van A', parentPhone: '0901234567', source: 'FACEBOOK' },
      user(Role.SALE),
    )).toMatchObject({
      parentName: 'Nguyen Van A',
      parentPhone: '0901234567',
      source: 'FACEBOOK',
    });

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.CREATE_LEAD,
        { parentName: 'Nguyen Van A', parentPhone: '0901234567', source: 'BAD_SOURCE' },
        user(Role.SALE),
      ),
    ).toThrow(BadRequestException);
  });

  it('requires entityId for ticket comment drafts', () => {
    expect(() =>
      service.assertEntityTarget(AiActionKey.ADD_TICKET_COMMENT),
    ).toThrow(BadRequestException);
  });

  it('denies ticket assignment draft to non-ops roles', () => {
    expect(() =>
      service.assertCanDraft(AiActionKey.UPDATE_TICKET, user(Role.SALE)),
    ).toThrow(ForbiddenException);
  });

  it('allows experience teachers to draft homework and quiz grading with feedback only', () => {
    expect(service.buildActionMeta(AiActionKey.GRADE_HOMEWORK)).toMatchObject({
      entityType: AiEntityType.SESSION,
      riskLevel: 'MEDIUM',
      requiresApproval: false,
      requiresConfirmation: true,
    });

    expect(service.sanitizeAndValidatePayload(
      AiActionKey.GRADE_HOMEWORK,
      { score: 8, feedback: 'Lam bai dung trong tam, can trinh bay ro hon.' },
      user(Role.EXPERIENCE_TEACHER),
    )).toEqual({
      score: 8,
      feedback: 'Lam bai dung trong tam, can trinh bay ro hon.',
    });

    expect(service.sanitizeAndValidatePayload(
      AiActionKey.GRADE_QUIZ_ATTEMPT,
      { manualScore: 4.5, manualFeedback: 'Tra loi y chinh dung, thieu vi du minh hoa.' },
      user(Role.EXPERIENCE_TEACHER),
    )).toEqual({
      manualScore: 4.5,
      manualFeedback: 'Tra loi y chinh dung, thieu vi du minh hoa.',
    });

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.GRADE_HOMEWORK,
        { score: 11, feedback: 'Qua diem' },
        user(Role.EXPERIENCE_TEACHER),
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.GRADE_HOMEWORK,
        { score: 8 },
        user(Role.EXPERIENCE_TEACHER),
      ),
    ).toThrow(BadRequestException);
  });

  it('marks ads actions as high-risk and approval-required', () => {
    const requiredFields: Partial<Record<AiActionKey, readonly string[]>> = {
      [AiActionKey.ADJUST_AD_BUDGET]: ['dailyBudget'],
      [AiActionKey.PAUSE_AD_GROUP]: ['status'],
      [AiActionKey.RESUME_AD_GROUP]: ['status'],
      [AiActionKey.CREATE_AD_GROUP_DRAFT]: ['name', 'adAccountId', 'platform'],
      [AiActionKey.SYNC_AD_COSTS]: ['adAccountId', 'date'],
    };

    for (const [rawActionKey, expectedRequiredFields] of Object.entries(requiredFields)) {
      const actionKey = rawActionKey as AiActionKey;
      const meta = service.buildActionMeta(actionKey);
      const schema = service.getFieldSchema(actionKey);

      expect(meta).toMatchObject({
        entityType: AiEntityType.AD_GROUP,
        riskLevel: 'HIGH',
        requiresApproval: true,
        requiresConfirmation: true,
      });
      expect(schema.requiredFields).toEqual(expectedRequiredFields);
    }
  });

  it('validates ad group create draft fields', () => {
    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.CREATE_AD_GROUP_DRAFT,
        { name: 'Facebook Summer' },
        user(Role.ADSMANAGER),
      ),
    ).toThrow(BadRequestException);

    const payload = service.sanitizeAndValidatePayload(
      AiActionKey.CREATE_AD_GROUP_DRAFT,
      {
        name: ' Facebook Summer ',
        adAccountId: '64b000000000000000000021',
        platform: 'FACEBOOK',
        platformCampaignId: 'cmp-001',
        dailyBudget: 500000,
        trackingKeys: ['fb-summer'],
      },
      user(Role.OPS),
    );

    expect(payload).toMatchObject({
      name: 'Facebook Summer',
      adAccountId: '64b000000000000000000021',
      platform: 'FACEBOOK',
      platformCampaignId: 'cmp-001',
      dailyBudget: 500000,
      trackingKeys: ['fb-summer'],
    });

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.CREATE_AD_GROUP_DRAFT,
        {
          name: 'Bad platform',
          adAccountId: '64b000000000000000000021',
          platform: 'LINKEDIN',
          platformCampaignId: 'cmp-002',
        },
        user(Role.DIRECTOR),
      ),
    ).toThrow(BadRequestException);
  });

  it('validates ad budget and status actions', () => {
    expect(() =>
      service.assertEntityTarget(AiActionKey.ADJUST_AD_BUDGET),
    ).toThrow(BadRequestException);

    expect(service.sanitizeAndValidatePayload(
      AiActionKey.ADJUST_AD_BUDGET,
      { dailyBudget: 300000, reason: ' scale profitable cohort ' },
      user(Role.ADSMANAGER),
    )).toEqual({
      dailyBudget: 300000,
      reason: 'scale profitable cohort',
    });

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.ADJUST_AD_BUDGET,
        { dailyBudget: -1 },
        user(Role.ADSMANAGER),
      ),
    ).toThrow(BadRequestException);

    expect(service.sanitizeAndValidatePayload(
      AiActionKey.PAUSE_AD_GROUP,
      { status: 'PAUSED' },
      user(Role.DIRECTOR),
    )).toEqual({ status: 'PAUSED' });

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.RESUME_AD_GROUP,
        { status: 'PAUSED' },
        user(Role.DIRECTOR),
      ),
    ).toThrow(BadRequestException);
  });

  it('requires director role and scoped fields for ad cost sync', () => {
    expect(() =>
      service.assertCanDraft(AiActionKey.SYNC_AD_COSTS, user(Role.ADSMANAGER)),
    ).toThrow(ForbiddenException);

    expect(() =>
      service.sanitizeAndValidatePayload(
        AiActionKey.SYNC_AD_COSTS,
        { adAccountId: '64b000000000000000000021', date: 'not-a-date' },
        user(Role.DIRECTOR),
      ),
    ).toThrow(BadRequestException);

    expect(service.sanitizeAndValidatePayload(
      AiActionKey.SYNC_AD_COSTS,
      {
        adAccountId: '64b000000000000000000021',
        date: '2026-06-01',
        lookbackDays: 3,
      },
      user(Role.DIRECTOR),
    )).toEqual({
      adAccountId: '64b000000000000000000021',
      date: '2026-06-01',
      lookbackDays: 3,
    });
  });
});
