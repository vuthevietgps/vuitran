import { TestBed } from '@angular/core/testing';

import { SessionsComponent } from './sessions.component';
import { AuthService } from '../services/auth.service';
import { SessionItem, SessionService } from '../services/session.service';
import { ClassService } from '../services/class.service';
import { TeacherService } from '../services/teacher.service';

describe('SessionsComponent', () => {
  let component: SessionsComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            userSignal: () => ({ role: 'OPS' }),
          },
        },
        { provide: SessionService, useValue: {} },
        { provide: ClassService, useValue: {} },
        { provide: TeacherService, useValue: {} },
      ],
    });

    component = TestBed.runInInjectionContext(
      () => new SessionsComponent(TestBed.inject(AuthService)),
    );
  });

  afterEach(() => TestBed.resetTestingModule());

  it('labels converted trial sessions as approved trial sessions', () => {
    const label = component.sessionStatusLabel(
      makeSession({
        sessionType: 'TRIAL',
        trialConverted: true,
        isPaid: true,
      }),
    );

    expect(label).toBe('\u0110\u00e3 \u0111\u01b0\u1ee3c duy\u1ec7t h\u1ecdc th\u1eed');
    expect(label).not.toContain('thanh to\u00e1n');
  });

  it('labels teacher-paid-only trial sessions separately from invoice payment', () => {
    const label = component.sessionStatusLabel(
      makeSession({
        sessionType: 'TRIAL',
        trialTeacherPaidOnly: true,
        isTeacherPaid: true,
      }),
    );

    expect(label).toBe('\u0110\u00e3 ch\u1ed1t h\u1ecdc th\u1eed, tr\u1ea3 l\u01b0\u01a1ng GV');
  });

  it('labels rejected trial sessions as not continuing', () => {
    const label = component.sessionStatusLabel(
      makeSession({
        sessionType: 'TRIAL',
        trialRejectedNoPay: true,
      }),
    );

    expect(label).toBe('H\u1ecdc th\u1eed kh\u00f4ng ti\u1ebfp t\u1ee5c');
  });

  it('keeps the wallet warning label for non-trial finalized sessions', () => {
    const label = component.sessionStatusLabel(
      makeSession({
        sessionType: 'REGULAR',
        isPaid: false,
        walletDeductError: 'Need wallet top-up',
      }),
    );

    expect(label).toBe('\u0110\u00e3 ch\u1ed1t, ch\u1edd n\u1ea1p v\u00ed');
  });
});

function makeSession(overrides: Partial<SessionItem> = {}): SessionItem {
  return {
    _id: 'session-1',
    classId: { _id: 'class-1', name: 'Offline 01', code: 'OFF01' },
    studentId: { _id: 'student-1', fullName: 'Hoc vien 1' },
    teacherId: { _id: 'teacher-1', fullName: 'Giao vien 1' },
    scheduledDate: '2026-04-13T00:00:00.000Z',
    scheduledStartTime: '09:00',
    scheduledEndTime: '10:00',
    amountCharged: 0,
    teacherPayout: 0,
    status: 'FINALIZED',
    isPaid: false,
    isTeacherPaid: false,
    hasTeachingReport: true,
    teachingReport: {
      lessonContent: 'Noi dung hoc',
    },
    confirmation: {
      finalizedBy: 'ops-1',
    },
    ...overrides,
  };
}
