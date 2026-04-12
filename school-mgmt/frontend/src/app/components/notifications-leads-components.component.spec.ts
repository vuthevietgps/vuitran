// Angular Unit Tests — Batch 9 Component Specs
// Covers: NotificationsComponent, LeadsComponent
// Scenarios: 21.1–21.4 (notification logic), 22.1–22.5 (leads label/role helpers), 23.1 (landing display)
//
// Run: ng test --include="**/notifications-leads-components.component.spec.ts"

import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from '../services/notifications.service';
import { LeadsComponent } from './leads.component';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

// ─── Helper: mutable auth stub ───────────────────────────────────────────────

function makeMutableAuthStub(role: Role) {
  return {
    currentRole: role,
    currentUser: { role, fullName: 'Test User', _id: 'u1' },
    userSignal: () => ({ role, fullName: 'Test User', _id: 'u1' }),
    hasRole(roles: Role[]): boolean {
      return roles.includes(this.currentRole);
    },
  };
}

// ─── NotificationsComponent ───────────────────────────────────────────────────

describe('NotificationsComponent', () => {
  let component: any;
  let svcSpy: jasmine.SpyObj<NotificationsService>;

  beforeEach(async () => {
    svcSpy = jasmine.createSpyObj('NotificationsService', [
      'getMyNotifications',
      'getUnreadCount',
      'markAsRead',
      'markAllAsRead',
    ]);
    svcSpy.getMyNotifications.and.resolveTo({ data: [], totalPages: 1, unreadCount: 0 });
    svcSpy.getUnreadCount.and.resolveTo({ count: 0 });
    svcSpy.markAsRead.and.resolveTo({});
    svcSpy.markAllAsRead.and.resolveTo({});

    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        { provide: NotificationsService, useValue: svcSpy },
        { provide: AuthService, useValue: makeMutableAuthStub(Role.OPS) },
        { provide: Router, useValue: { navigateByUrl: jasmine.createSpy() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
  });

  // ── getIcon ─────────────────────────────────────────────────────────────────

  describe('getIcon()', () => {
    it('TICKET_OVERDUE → ⚠️', () => {
      expect(component.getIcon('TICKET_OVERDUE')).toBe('⚠️');
    });

    it('INVOICE_APPROVED → ✅', () => {
      expect(component.getIcon('INVOICE_APPROVED')).toBe('✅');
    });

    it('PAYROLL_PENDING → 💰', () => {
      expect(component.getIcon('PAYROLL_PENDING')).toBe('💰');
    });

    it('WALLET_LOW_BALANCE → 💸', () => {
      expect(component.getIcon('WALLET_LOW_BALANCE')).toBe('💸');
    });

    it('Unknown type → 🔔 (default)', () => {
      expect(component.getIcon('UNKNOWN_TYPE')).toBe('🔔');
    });

    it('Empty string → 🔔 (default)', () => {
      expect(component.getIcon('')).toBe('🔔');
    });

    it('SESSION_CONFLICT → ⚡', () => {
      expect(component.getIcon('SESSION_CONFLICT')).toBe('⚡');
    });

    it('SYSTEM → 🔔', () => {
      expect(component.getIcon('SYSTEM')).toBe('🔔');
    });
  });

  // ── timeAgo ─────────────────────────────────────────────────────────────────

  describe('timeAgo()', () => {
    it('Empty string → empty string', () => {
      expect(component.timeAgo('')).toBe('');
    });

    it('< 1 minute → Vừa xong', () => {
      const now = new Date(Date.now() - 30 * 1000).toISOString();
      expect(component.timeAgo(now)).toBe('Vừa xong');
    });

    it('30 minutes → 30 phút trước', () => {
      const ts = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(component.timeAgo(ts)).toBe('30 phút trước');
    });

    it('2 hours → 2 giờ trước', () => {
      const ts = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(component.timeAgo(ts)).toBe('2 giờ trước');
    });

    it('5 days → 5 ngày trước', () => {
      const ts = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      expect(component.timeAgo(ts)).toBe('5 ngày trước');
    });

    it('1 minute → 1 phút trước', () => {
      const ts = new Date(Date.now() - 65 * 1000).toISOString();
      expect(component.timeAgo(ts)).toBe('1 phút trước');
    });

    it('1 hour → 1 giờ trước', () => {
      const ts = new Date(Date.now() - 61 * 60 * 1000).toISOString();
      expect(component.timeAgo(ts)).toBe('1 giờ trước');
    });
  });

  // ── handleClick ──────────────────────────────────────────────────────────────

  describe('handleClick()', () => {
    it('Marks as read when notification is unread', async () => {
      const notif = { _id: 'n1', isRead: false, link: '' };
      component.unreadCount = 3;
      await component.handleClick(notif);
      expect(svcSpy.markAsRead).toHaveBeenCalledWith('n1');
      expect(notif.isRead).toBe(true);
      expect(component.unreadCount).toBe(2);
    });

    it('Does not mark as read when already read', async () => {
      const notif = { _id: 'n2', isRead: true, link: '' };
      component.unreadCount = 1;
      await component.handleClick(notif);
      expect(svcSpy.markAsRead).not.toHaveBeenCalled();
      expect(component.unreadCount).toBe(1);
    });

    it('Navigates to link on click', async () => {
      const router = TestBed.inject(Router);
      const notif = { _id: 'n3', isRead: false, link: '/app/invoices' };
      await component.handleClick(notif);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/app/invoices');
    });

    it('No navigation when link is empty / falsy', async () => {
      const router = TestBed.inject(Router);
      (router.navigateByUrl as jasmine.Spy).calls.reset();
      const notif = { _id: 'n4', isRead: true, link: '' };
      await component.handleClick(notif);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });
  });

  // ── markAllRead ──────────────────────────────────────────────────────────────

  describe('markAllRead()', () => {
    it('Resets unreadCount to 0', async () => {
      component.notifications = [
        { _id: 'a', isRead: false },
        { _id: 'b', isRead: true },
      ];
      component.unreadCount = 5;
      await component.markAllRead();
      expect(svcSpy.markAllAsRead).toHaveBeenCalled();
      expect(component.unreadCount).toBe(0);
    });

    it('All notifications flagged as read', async () => {
      component.notifications = [
        { _id: 'a', isRead: false },
        { _id: 'b', isRead: false },
      ];
      await component.markAllRead();
      component.notifications.forEach((n: any) => expect(n.isRead).toBe(true));
    });
  });

  // ── 21.4 isolation guard (unreadCount cannot go negative) ────────────────────

  describe('21.4 Isolation guard', () => {
    it('unreadCount not negative after marking read when count=0', async () => {
      const notif = { _id: 'n5', isRead: false, link: '' };
      component.unreadCount = 0;
      await component.handleClick(notif);
      expect(component.unreadCount).toBeGreaterThanOrEqual(0);
    });
  });
});

// ─── LeadsComponent ───────────────────────────────────────────────────────────

describe('LeadsComponent', () => {
  let component: any;
  let authStub: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(async () => {
    authStub = makeMutableAuthStub(Role.SALE);

    await TestBed.configureTestingModule({
      imports: [LeadsComponent, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: authStub },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(LeadsComponent);
    component = fixture.componentInstance;
  });

  // ── statusLabel() — 22.1 lead creation display ────────────────────────────

  describe('statusLabel()', () => {
    it('NEW → Mới', () => expect(component.statusLabel('NEW')).toBe('Mới'));
    it('CONTACTED → Đã liên hệ', () => expect(component.statusLabel('CONTACTED')).toBe('Đã liên hệ'));
    it('CONSULTING → Đang tư vấn', () => expect(component.statusLabel('CONSULTING')).toBe('Đang tư vấn'));
    it('INTERESTED → Quan tâm', () => expect(component.statusLabel('INTERESTED')).toBe('Quan tâm'));
    it('CONVERTED → Đã chuyển đổi', () => expect(component.statusLabel('CONVERTED')).toBe('Đã chuyển đổi'));
    it('NOT_INTERESTED → Không quan tâm', () => expect(component.statusLabel('NOT_INTERESTED')).toBe('Không quan tâm'));
    it('NO_RESPONSE → Không phản hồi', () => expect(component.statusLabel('NO_RESPONSE')).toBe('Không phản hồi'));
    it('Unknown → passthrough', () => expect(component.statusLabel('WEIRD')).toBe('WEIRD'));
  });

  // ── sourceLabel() — 22.1 multi-source ────────────────────────────────────

  describe('sourceLabel()', () => {
    it('FACEBOOK → Facebook', () => expect(component.sourceLabel('FACEBOOK')).toBe('Facebook'));
    it('GOOGLE → Google', () => expect(component.sourceLabel('GOOGLE')).toBe('Google'));
    it('TIKTOK → TikTok', () => expect(component.sourceLabel('TIKTOK')).toBe('TikTok'));
    it('ZALO → Zalo', () => expect(component.sourceLabel('ZALO')).toBe('Zalo'));
    it('WEBSITE → Website', () => expect(component.sourceLabel('WEBSITE')).toBe('Website'));
    it('REFERRAL → Giới thiệu', () => expect(component.sourceLabel('REFERRAL')).toBe('Giới thiệu'));
    it('WALK_IN → Đến trực tiếp', () => expect(component.sourceLabel('WALK_IN')).toBe('Đến trực tiếp'));
    it('OTHER → Khác', () => expect(component.sourceLabel('OTHER')).toBe('Khác'));
    it('Unknown → passthrough', () => expect(component.sourceLabel('SMS_BLAST')).toBe('SMS_BLAST'));
  });

  // ── contactLabel() — 22.4 contact history ────────────────────────────────

  describe('contactLabel()', () => {
    it('CALL → Gọi điện', () => expect(component.contactLabel('CALL')).toBe('Gọi điện'));
    it('ZALO → Zalo', () => expect(component.contactLabel('ZALO')).toBe('Zalo'));
    it('EMAIL → Email', () => expect(component.contactLabel('EMAIL')).toBe('Email'));
    it('MEET → Gặp mặt', () => expect(component.contactLabel('MEET')).toBe('Gặp mặt'));
    it('SMS → SMS', () => expect(component.contactLabel('SMS')).toBe('SMS'));
    it('OTHER → Khác', () => expect(component.contactLabel('OTHER')).toBe('Khác'));
  });

  // ── isStaff() — 22.3 role-based assign access ─────────────────────────────

  describe('isStaff()', () => {
    it('DIRECTOR → true (staff)', () => {
      authStub.currentRole = Role.DIRECTOR;
      expect(component.isStaff()).toBe(true);
    });

    it('OPS → true (staff)', () => {
      authStub.currentRole = Role.OPS;
      expect(component.isStaff()).toBe(true);
    });

    it('SALE → false (not staff)', () => {
      authStub.currentRole = Role.SALE;
      expect(component.isStaff()).toBe(false);
    });

    it('PARENT → false (not staff)', () => {
      authStub.currentRole = Role.PARENT;
      expect(component.isStaff()).toBe(false);
    });
  });

  // ── isActiveLead() — 22.5 follow-up filter (exclude CONVERTED/NOT_INTERESTED)

  describe('isActiveLead()', () => {
    it('NEW → active', () => expect(component.isActiveLead({ status: 'NEW' } as any)).toBe(true));
    it('CONTACTED → active', () => expect(component.isActiveLead({ status: 'CONTACTED' } as any)).toBe(true));
    it('CONSULTING → active', () => expect(component.isActiveLead({ status: 'CONSULTING' } as any)).toBe(true));
    it('INTERESTED → active', () => expect(component.isActiveLead({ status: 'INTERESTED' } as any)).toBe(true));
    it('CONVERTED → NOT active', () => expect(component.isActiveLead({ status: 'CONVERTED' } as any)).toBe(false));
    it('NOT_INTERESTED → NOT active', () => expect(component.isActiveLead({ status: 'NOT_INTERESTED' } as any)).toBe(false));
    it('LOST → active', () => expect(component.isActiveLead({ status: 'LOST' } as any)).toBe(true));
  });

  // ── isOverdue() — 22.5 follow-up overdue indicator ────────────────────────

  describe('isOverdue()', () => {
    it('Past date → overdue', () => {
      const past = new Date(Date.now() - 60000).toISOString();
      expect(component.isOverdue(past)).toBe(true);
    });

    it('Future date → not overdue', () => {
      const future = new Date(Date.now() + 60000).toISOString();
      expect(component.isOverdue(future)).toBe(false);
    });
  });

  // ── lostLabel() — 22.2 reasons ────────────────────────────────────────────

  describe('lostLabel() / LOST_LABELS', () => {
    it('PRICE_TOO_HIGH maps to Giá cao', () => {
      const label = component.lostReasons.find((item: any) => item.value === 'PRICE_TOO_HIGH')?.label;
      expect(label).toBe('Giá cao');
    });

    it('CHOSE_COMPETITOR maps to Chọn nơi khác', () => {
      const label = component.lostReasons.find((item: any) => item.value === 'CHOSE_COMPETITOR')?.label;
      expect(label).toBe('Chọn nơi khác');
    });

    it('NO_LONGER_NEEDED maps to Không cần nữa', () => {
      const label = component.lostReasons.find((item: any) => item.value === 'NO_LONGER_NEEDED')?.label;
      expect(label).toBe('Không cần nữa');
    });

    it('UNREACHABLE maps to Không liên lạc được', () => {
      const label = component.lostReasons.find((item: any) => item.value === 'UNREACHABLE')?.label;
      expect(label).toBe('Không liên lạc được');
    });

    it('SCHEDULE_CONFLICT maps to Lịch không phù hợp', () => {
      const label = component.lostReasons.find((item: any) => item.value === 'SCHEDULE_CONFLICT')?.label;
      expect(label).toBe('Lịch không phù hợp');
    });
  });
});
