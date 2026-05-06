import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkSessionsComponent } from './work-sessions.component';
import { WorkSessionService } from '../services/work-session.service';
import { AuthService } from '../services/auth.service';

function makeWorkSessionServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({
      data: [
        {
          _id: 'session-1',
          userId: {
            _id: 'user-1',
            fullName: 'Nhan vien A',
            email: 'a@school.local',
            role: 'OPS',
          },
          date: '2026-04-14T00:00:00.000Z',
          loginTime: '2026-04-14T01:00:00.000Z',
          logoutTime: '2026-04-14T09:00:00.000Z',
          totalMinutes: 480,
          isLate: true,
          lateMinutes: 10,
          isEarlyLeave: false,
          earlyLeaveMinutes: 0,
          status: 'COMPLETED',
          scheduledStartTime: '08:00',
          scheduledEndTime: '17:00',
        },
      ],
      meta: {
        total: 61,
        page: 1,
        limit: 25,
        totalPages: 3,
      },
      summary: {
        totalSessions: 61,
        activeSessions: 2,
        totalMinutes: 3660,
        lateSessions: 9,
      },
    }),
    getMy: jasmine.createSpy('getMy').and.resolveTo({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
      },
      summary: {
        totalSessions: 0,
        activeSessions: 0,
        totalMinutes: 0,
        lateSessions: 0,
      },
    }),
    getSummary: jasmine.createSpy('getSummary').and.resolveTo([]),
    update: jasmine.createSpy('update').and.resolveTo({ ok: true }),
  };
}

function makeAuthStub(role = 'DIRECTOR') {
  return {
    hasRole: jasmine
      .createSpy('hasRole')
      .and.callFake((roles: string[]) => roles.includes(role)),
  };
}

describe('WorkSessionsComponent', () => {
  let fixture: ComponentFixture<WorkSessionsComponent>;
  let component: WorkSessionsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkSessionsComponent],
      providers: [
        { provide: WorkSessionService, useValue: makeWorkSessionServiceStub() },
        { provide: AuthService, useValue: makeAuthStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkSessionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the first paged result set on init', () => {
    const workSessionService = TestBed.inject(WorkSessionService) as any;

    expect(workSessionService.list).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 1,
        limit: 25,
      }),
    );
    expect(component.totalItems()).toBe(61);
    expect(component.totalPages()).toBe(3);
    expect(component.listSummary().totalMinutes).toBe(3660);
  });

  it('applies filters and page navigation through the paged endpoint', async () => {
    const workSessionService = TestBed.inject(WorkSessionService) as any;
    workSessionService.list.calls.reset();

    component.userKeyword = 'Nhan vien A';
    component.selectedStatus = 'COMPLETED';

    await component.applyFilters();
    await fixture.whenStable();

    expect(workSessionService.list).toHaveBeenCalledWith(
      jasmine.objectContaining({
        search: 'Nhan vien A',
        status: 'COMPLETED',
        page: 1,
        limit: 25,
      }),
    );

    workSessionService.list.calls.reset();
    await component.goToPage(2);
    await fixture.whenStable();

    expect(workSessionService.list).toHaveBeenCalledWith(
      jasmine.objectContaining({
        page: 2,
        limit: 25,
      }),
    );
  });

  it('keeps the work session table header sticky while scrolling', () => {
    const tableShell: HTMLDivElement | null = fixture.nativeElement.querySelector(
      '.table-shell',
    );
    const headerCell: HTMLTableCellElement | null = fixture.nativeElement.querySelector(
      '.data thead th',
    );

    expect(tableShell).toBeTruthy();
    expect(headerCell).toBeTruthy();
    expect(window.getComputedStyle(headerCell!).position).toBe('sticky');
    expect(window.getComputedStyle(headerCell!).top).toBe('0px');
  });
});
