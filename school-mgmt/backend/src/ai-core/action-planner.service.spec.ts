import { AiActionKey, AiEntityResolution, AiEntityType } from './ai-core.types';
import { AiActionPlannerService } from './action-planner.service';
import { AiActionPolicyService } from './action-policy.service';

function resolvedStudent(): AiEntityResolution {
  return {
    query: 'sua sdt hoc vien Nam',
    normalizedQuery: 'sua sdt hoc vien nam',
    requestedType: AiEntityType.AUTO,
    status: 'RESOLVED',
    needsConfirmation: false,
    candidates: [],
    selected: {
      type: AiEntityType.STUDENT,
      id: '64b000000000000000000011',
      label: 'Nguyen Van Nam',
      score: 0.96,
      confidence: 'HIGH',
      matchedFields: ['fullName'],
      summary: {},
    },
  };
}

function resolvedTicket(): AiEntityResolution {
  return {
    query: 'ticket TKT-1001',
    normalizedQuery: 'ticket tkt 1001',
    requestedType: AiEntityType.TICKET,
    status: 'RESOLVED',
    needsConfirmation: false,
    candidates: [],
    selected: {
      type: AiEntityType.TICKET,
      id: '64b000000000000000000022',
      label: 'TKT-1001 - Phu huynh phan anh lich hoc',
      score: 0.94,
      confidence: 'HIGH',
      matchedFields: ['code'],
      summary: {},
    },
  };
}

function resolvedHomeworkSession(): AiEntityResolution {
  return {
    query: 'session bai tap',
    normalizedQuery: 'session bai tap',
    requestedType: AiEntityType.SESSION,
    status: 'RESOLVED',
    needsConfirmation: false,
    candidates: [],
    selected: {
      type: AiEntityType.SESSION,
      id: '64b000000000000000000033',
      label: 'Session homework',
      score: 0.95,
      confidence: 'HIGH',
      matchedFields: ['entityContext'],
      summary: {},
    },
  };
}

function resolvedSession(): AiEntityResolution {
  return {
    ...resolvedHomeworkSession(),
    query: 'session SES-1001',
    normalizedQuery: 'session ses 1001',
    selected: {
      ...resolvedHomeworkSession().selected!,
      label: 'SES-1001 - Buoi hoc Math',
      matchedFields: ['code'],
    },
  };
}

function resolvedQuizAttempt(): AiEntityResolution {
  return {
    query: 'quiz attempt',
    normalizedQuery: 'quiz attempt',
    requestedType: AiEntityType.QUIZ_ATTEMPT,
    status: 'RESOLVED',
    needsConfirmation: false,
    candidates: [],
    selected: {
      type: AiEntityType.QUIZ_ATTEMPT,
      id: '64b000000000000000000044',
      label: 'Quiz attempt',
      score: 0.95,
      confidence: 'HIGH',
      matchedFields: ['entityContext'],
      summary: {},
    },
  };
}

function resolvedTrialEnrollment(): AiEntityResolution {
  return {
    query: 'trial TRIAL-1001',
    normalizedQuery: 'trial trial 1001',
    requestedType: AiEntityType.TRIAL_ENROLLMENT,
    status: 'RESOLVED',
    needsConfirmation: false,
    candidates: [],
    selected: {
      type: AiEntityType.TRIAL_ENROLLMENT,
      id: '64b000000000000000000044',
      label: 'TRIAL-1001 - Hoc thu',
      score: 1,
      confidence: 'HIGH',
      matchedFields: ['entityContext'],
      summary: {},
    },
  };
}

describe('AiActionPlannerService', () => {
  let service: AiActionPlannerService;

  beforeEach(() => {
    service = new AiActionPlannerService(new AiActionPolicyService());
  });

  it('creates an update-student draft only after entity resolution is certain', () => {
    const decision = service.planFromChat(
      'Sua so dien thoai phu huynh cua hoc vien Nam thanh 0901234567',
      resolvedStudent(),
    );

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.UPDATE_STUDENT);
      expect(decision.draft.entityId).toBe('64b000000000000000000011');
      expect(decision.draft.payload).toEqual({ parentPhone: '0901234567' });
    }
  });

  it('does not create a draft when entity resolution is ambiguous', () => {
    const resolution = {
      ...resolvedStudent(),
      status: 'AMBIGUOUS' as const,
      selected: undefined,
      needsConfirmation: true,
    };

    expect(service.planFromChat('Sua sdt Nam thanh 0901234567', resolution).type).toBe('NONE');
  });

  it('creates a ticket comment draft only after ticket resolution is certain', () => {
    const decision = service.planFromChat([
      'Them comment cho ticket',
      'content=Da goi phu huynh va hen xu ly lai',
    ].join('\n'), resolvedTicket());

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.ADD_TICKET_COMMENT);
      expect(decision.draft.entityType).toBe(AiEntityType.TICKET);
      expect(decision.draft.entityId).toBe('64b000000000000000000022');
      expect(decision.draft.payload).toEqual({
        content: 'Da goi phu huynh va hen xu ly lai',
      });
    }
  });

  it('creates a ticket update draft for priority changes after ticket resolution is certain', () => {
    const decision = service.planFromChat('Doi ticket nay thanh khan', resolvedTicket());

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.UPDATE_TICKET);
      expect(decision.draft.entityType).toBe(AiEntityType.TICKET);
      expect(decision.draft.entityId).toBe('64b000000000000000000022');
      expect(decision.draft.payload).toEqual({ priority: 'URGENT' });
    }
  });

  it('creates homework grading drafts from score and feedback when a session is resolved', () => {
    const decision = service.planFromChat(
      'Cham bai nay 8.5 diem, nhan xet lam dung trong tam nhung can trinh bay ro hon',
      resolvedHomeworkSession(),
    );

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.GRADE_HOMEWORK);
      expect(decision.draft.entityType).toBe(AiEntityType.SESSION);
      expect(decision.draft.entityId).toBe('64b000000000000000000033');
      expect(decision.draft.payload).toEqual({
        score: 8.5,
        feedback: 'lam dung trong tam nhung can trinh bay ro hon',
      });
    }
  });

  it('asks for feedback before drafting a homework grade when only score is provided', () => {
    const decision = service.planFromChat('Cho 8 diem', resolvedHomeworkSession());

    expect(decision.type).toBe('MISSING_FIELDS');
    if (decision.type === 'MISSING_FIELDS') {
      expect(decision.actionKey).toBe(AiActionKey.GRADE_HOMEWORK);
      expect(decision.missingRequiredFields).toEqual(['feedback']);
      expect(decision.providedPayload).toEqual({ score: 8 });
    }
  });

  it('creates quiz grading drafts from attempt context', () => {
    const decision = service.planFromChat(
      'score=4,5\nmanualFeedback=Tra loi dung y chinh, can them vi du',
      resolvedQuizAttempt(),
    );

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.GRADE_QUIZ_ATTEMPT);
      expect(decision.draft.entityType).toBe(AiEntityType.QUIZ_ATTEMPT);
      expect(decision.draft.entityId).toBe('64b000000000000000000044');
      expect(decision.draft.payload).toEqual({
        manualScore: 4.5,
        manualFeedback: 'Tra loi dung y chinh, can them vi du',
      });
    }
  });

  it('does not create a ticket action draft when ticket resolution is ambiguous', () => {
    const resolution = {
      ...resolvedTicket(),
      status: 'AMBIGUOUS' as const,
      selected: undefined,
      needsConfirmation: true,
    };

    expect(service.planFromChat([
      'Them comment cho ticket',
      'content=Da goi phu huynh',
    ].join('\n'), resolution).type).toBe('NONE');
  });

  it('creates session operation drafts after session resolution is certain', () => {
    const finalizeDecision = service.planFromChat('Chot buoi nay ly do da doi chieu report', resolvedHomeworkSession());
    const rescheduleDecision = service.planFromChat([
      'Doi lich buoi nay',
      'newScheduledDate=2026-06-15',
      'newStartTime=19:30',
      'reason=Phu huynh xin doi lich',
    ].join('\n'), resolvedHomeworkSession());

    expect(finalizeDecision.type).toBe('PREVIEW');
    if (finalizeDecision.type === 'PREVIEW') {
      expect(finalizeDecision.draft.actionKey).toBe(AiActionKey.FINALIZE_SESSION);
      expect(finalizeDecision.draft.entityId).toBe('64b000000000000000000033');
      expect(finalizeDecision.draft.payload).toMatchObject({
        reason: 'da doi chieu report',
      });
    }

    expect(rescheduleDecision.type).toBe('PREVIEW');
    if (rescheduleDecision.type === 'PREVIEW') {
      expect(rescheduleDecision.draft.actionKey).toBe(AiActionKey.RESCHEDULE_SESSION);
      expect(rescheduleDecision.draft.payload).toMatchObject({
        newScheduledDate: '2026-06-15',
        newStartTime: '19:30',
        reason: 'Phu huynh xin doi lich',
      });
    }
  });

  it('asks for cancel reason before creating a session cancel draft', () => {
    const decision = service.planFromChat('Huy buoi nay', resolvedHomeworkSession());

    expect(decision.type).toBe('MISSING_FIELDS');
    if (decision.type === 'MISSING_FIELDS') {
      expect(decision.actionKey).toBe(AiActionKey.CANCEL_SESSION);
      expect(decision.missingRequiredFields).toEqual(['cancelReason']);
    }
  });

  it('creates attendance and trial update drafts from explicit operational fields', () => {
    const attendanceDecision = service.planFromChat([
      'Diem danh hoc sinh vang',
      'classId=64b000000000000000000055',
      'studentId=64b000000000000000000066',
      'date=2026-06-10',
      'status=ABSENT',
    ].join('\n'));
    const trialDecision = service.planFromChat([
      'Chot hoc thu nay converted',
      'status=CONVERTED',
      'invoiceId=64b000000000000000000077',
    ].join('\n'), resolvedTrialEnrollment());

    expect(attendanceDecision.type).toBe('PREVIEW');
    if (attendanceDecision.type === 'PREVIEW') {
      expect(attendanceDecision.draft.actionKey).toBe(AiActionKey.MARK_ATTENDANCE);
      expect(attendanceDecision.draft.payload).toMatchObject({
        classId: '64b000000000000000000055',
        studentId: '64b000000000000000000066',
        date: '2026-06-10',
        status: 'ABSENT',
      });
    }

    expect(trialDecision.type).toBe('PREVIEW');
    if (trialDecision.type === 'PREVIEW') {
      expect(trialDecision.draft.actionKey).toBe(AiActionKey.UPDATE_TRIAL_ENROLLMENT);
      expect(trialDecision.draft.entityId).toBe('64b000000000000000000044');
      expect(trialDecision.draft.payload).toMatchObject({
        status: 'CONVERTED',
        invoiceId: '64b000000000000000000077',
      });
    }
  });

  it('detects confirmation and rejection commands for the latest draft', () => {
    expect(service.planFromChat('xac nhan nhap nay').type).toBe('CONFIRM');
    expect(service.planFromChat('huy nhap nay').type).toBe('REJECT');
  });

  it('asks for required fields before creating a student draft', () => {
    const decision = service.planFromChat(
      'Tao hoc sinh ten Nguyen Van A, tuoi 10, sdt phu huynh 0901234567',
    );

    expect(decision.type).toBe('MISSING_FIELDS');
    if (decision.type === 'MISSING_FIELDS') {
      expect(decision.actionKey).toBe(AiActionKey.CREATE_STUDENT);
      expect(decision.missingRequiredFields).toEqual(
        expect.arrayContaining(['studentCode', 'parentName', 'faceImage']),
      );
      expect(service.formatMissingFieldsAnswer(decision)).toContain('field=value');
    }
  });

  it('creates a lead draft when all required fields are provided', () => {
    const decision = service.planFromChat([
      'Tao lead',
      'parentName=Nguyen Van B',
      'parentPhone=0901112222',
      'source=FACEBOOK',
    ].join('\n'));

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.CREATE_LEAD);
      expect(decision.draft.payload).toMatchObject({
        parentName: 'Nguyen Van B',
        parentPhone: '0901112222',
        source: 'FACEBOOK',
      });
    }
  });

  it('creates an ad group draft from campaign wording', () => {
    const decision = service.planFromChat([
      'Tao campaign',
      'name=Facebook Grade 6 June',
      'adAccountId=64b000000000000000000021',
      'platform=FACEBOOK',
      'dailyBudget=500000',
      'targetAudience=Phu huynh lop 6 o Ha Noi',
      'trackingKeys=fb-g6-june, g6-landing',
    ].join('\n'));

    expect(decision.type).toBe('PREVIEW');
    if (decision.type === 'PREVIEW') {
      expect(decision.draft.actionKey).toBe(AiActionKey.CREATE_AD_GROUP_DRAFT);
      expect(decision.draft.entityType).toBe(AiEntityType.AD_GROUP);
      expect(decision.draft.payload).toMatchObject({
        name: 'Facebook Grade 6 June',
        adAccountId: '64b000000000000000000021',
        platform: 'FACEBOOK',
        dailyBudget: 500000,
        targetAudience: 'Phu huynh lop 6 o Ha Noi',
        trackingKeys: ['fb-g6-june', 'g6-landing'],
      });
    }
  });

  it('asks for ad group draft essentials when campaign request is incomplete', () => {
    const decision = service.planFromChat('Tao nhom quang cao Facebook budget 300k');

    expect(decision.type).toBe('MISSING_FIELDS');
    if (decision.type === 'MISSING_FIELDS') {
      expect(decision.actionKey).toBe(AiActionKey.CREATE_AD_GROUP_DRAFT);
      expect(decision.missingRequiredFields).toEqual(
        expect.arrayContaining(['name', 'adAccountId']),
      );
      expect(decision.providedPayload).toMatchObject({
        platform: 'FACEBOOK',
        dailyBudget: 300000,
      });
    }
  });
});
