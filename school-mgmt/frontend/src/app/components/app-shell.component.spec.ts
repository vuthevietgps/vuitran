import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';
import { Role } from '../models/role.enum';
import { AuthService } from '../services/auth.service';
import { NotificationsService } from '../services/notifications.service';
import { PendingApprovalsService } from '../services/pending-approvals.service';
import { RoutePrefetchService } from '../services/route-prefetch.service';

function buildAuthStub(role: Role) {
  return {
    userSignal: () => ({
      sub: 'user-001',
      email: `${String(role).toLowerCase()}@school.local`,
      role,
      fullName: `Test ${role}`,
    }),
    logout: jasmine.createSpy('logout'),
    getDefaultAppRoute: jasmine
      .createSpy('getDefaultAppRoute')
      .and.returnValue('/app/dashboard'),
  };
}

describe('AppShellComponent', () => {
  let fixture: ComponentFixture<AppShellComponent>;

  async function createComponent(role: Role) {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: buildAuthStub(role) },
        {
          provide: NotificationsService,
          useValue: {
            getUnreadCount: jasmine
              .createSpy('getUnreadCount')
              .and.resolveTo({ count: 0 }),
          },
        },
        {
          provide: PendingApprovalsService,
          useValue: {
            getSummary: jasmine
              .createSpy('getSummary')
              .and.resolveTo({ totalPending: 0 }),
          },
        },
        {
          provide: RoutePrefetchService,
          useValue: {
            warmForRole: jasmine.createSpy('warmForRole'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('shows classes navigation for sale users', async () => {
    await createComponent(Role.SALE);

    const element = fixture.nativeElement as HTMLElement;
    expect(
      element.querySelector('[data-testid="nav-classes"]'),
    ).toBeTruthy();
  });

  it('hides classes navigation for parent users', async () => {
    await createComponent(Role.PARENT);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid="nav-classes"]')).toBeNull();
  });
});
