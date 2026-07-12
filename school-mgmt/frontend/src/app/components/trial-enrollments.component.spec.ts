import { TestBed } from '@angular/core/testing';

import { TrialEnrollmentsComponent } from './trial-enrollments.component';
import { AuthService } from '../services/auth.service';
import { ClassService } from '../services/class.service';
import { ProductService } from '../services/product.service';
import {
  TrialEnrollmentItem,
  TrialEnrollmentService,
} from '../services/trial-enrollment.service';
import { UserService } from '../services/user.service';

describe('TrialEnrollmentsComponent', () => {
  let component: TrialEnrollmentsComponent;
  let trialService: jasmine.SpyObj<TrialEnrollmentService>;

  beforeEach(() => {
    trialService = jasmine.createSpyObj<TrialEnrollmentService>('TrialEnrollmentService', [
      'list',
      'create',
      'update',
      'markWaitingDecision',
      'convert',
      'reject',
      'teacherPaidOnly',
    ]);
    trialService.list.and.resolveTo([]);
    trialService.convert.and.resolveTo({ ok: true, data: undefined });

    TestBed.configureTestingModule({
      providers: [
        { provide: TrialEnrollmentService, useValue: trialService },
        { provide: ClassService, useValue: { list: jasmine.createSpy().and.resolveTo([]) } },
        { provide: ProductService, useValue: { list: jasmine.createSpy().and.resolveTo([]) } },
        { provide: UserService, useValue: { listSales: jasmine.createSpy().and.resolveTo([]) } },
        {
          provide: AuthService,
          useValue: {
            userSignal: () => ({ role: 'OPS', sub: 'ops-1', fullName: 'Ops 1' }),
          },
        },
      ],
    });

    component = TestBed.runInInjectionContext(
      () =>
        new TrialEnrollmentsComponent(
          TestBed.inject(TrialEnrollmentService),
          TestBed.inject(ClassService),
          TestBed.inject(ProductService),
          TestBed.inject(UserService),
          TestBed.inject(AuthService),
        ),
    );
    component.currentRole = 'OPS';
    component.currentUserId = 'ops-1';
  });

  afterEach(() => TestBed.resetTestingModule());

  it('labels converted test cases as closed enrollments', () => {
    expect(component.statusLabel('CONVERTED')).toBe('Đã chốt học');
  });

  it('shows the approved-trial success message after convert', async () => {
    await component.convert(makeTrialEnrollment({ status: 'WAITING_DECISION' }));

    expect(trialService.convert).toHaveBeenCalledWith('trial-1', undefined);
    expect(component.pageFeedback()).toEqual({
      type: 'success',
      message: 'Đã chốt học sau buổi test và chuyển thành học viên chính thức',
    });
  });

  it('disables the legacy teacher-paid-only trial action', () => {
    expect(component.canTeacherPaidOnly(makeTrialEnrollment({ status: 'WAITING_DECISION' }))).toBeFalse();
  });
});

function makeTrialEnrollment(
  overrides: Partial<TrialEnrollmentItem> = {},
): TrialEnrollmentItem {
  return {
    _id: 'trial-1',
    status: 'PENDING_TRIAL',
    studentName: 'Hoc vien thu',
    parentName: 'Phu huynh',
    ...overrides,
  };
}
