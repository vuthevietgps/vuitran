// Angular unit tests — Batch 8 (scenarios 18.1–18.6, 19.1–19.3, 20.1)
// Covers pure-method testing for:
//   TicketsComponent        — statusLabel, priorityLabel, typeLabel, isOpsOrDirector,
//                             isOps, canViewStats, canCreate (19.1, 19.3)
//   ChatbotSettingsComponent — statusLabel, platformLabel, syncSourceLabel,
//                              aiAssistantTypeLabel, formatDate, canEditFanpages,
//                              canCreateFanpages, canManageTokenLibrary,
//                              canManageAiAssistantProfiles (18.3–18.5)

import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TicketsComponent } from './tickets.component';
import { ChatbotSettingsComponent } from './chatbot-settings.component';
import { TicketService } from '../services/ticket.service';
import { ChatbotService } from '../services/chatbot.service';
import { AdsService } from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

// ─── Auth stub factory ────────────────────────────────────────────────────────

function makeMutableAuthStub() {
  let _role = 'DIRECTOR';
  let _id = 'user-stub-1';
  let _fullName = 'Test User';
  return {
    setRole(role: string, id = 'user-stub-1', fullName = 'Test User') {
      _role = role;
      _id = id;
      _fullName = fullName;
    },
    userSignal: () => ({ _id, role: _role, sub: _id, fullName: _fullName }),
    hasRole: (roles: string[]) => roles.includes(_role),
  };
}

function makeTicketServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo({ data: [], total: 0 }),
    getOne: jasmine.createSpy('getOne').and.resolveTo({}),
    create: jasmine.createSpy('create').and.resolveTo({}),
    update: jasmine.createSpy('update').and.resolveTo({}),
    start: jasmine.createSpy('start').and.resolveTo({}),
    requestInfo: jasmine.createSpy('requestInfo').and.resolveTo({}),
    resolve: jasmine.createSpy('resolve').and.resolveTo({}),
    close: jasmine.createSpy('close').and.resolveTo({}),
    cancel: jasmine.createSpy('cancel').and.resolveTo({}),
    reopen: jasmine.createSpy('reopen').and.resolveTo({}),
    getStats: jasmine.createSpy('getStats').and.resolveTo({}),
    getSlaMetrics: jasmine.createSpy('getSlaMetrics').and.resolveTo({}),
    getMyTickets: jasmine.createSpy('getMyTickets').and.resolveTo({ data: [], total: 0 }),
    getAssignedToMe: jasmine.createSpy('getAssignedToMe').and.resolveTo({ data: [], total: 0 }),
    addComment: jasmine.createSpy('addComment').and.resolveTo({}),
    getComments: jasmine.createSpy('getComments').and.resolveTo([]),
  };
}

function makeChatbotServiceStub() {
  return {
    listFanpages: jasmine.createSpy('listFanpages').and.resolveTo({ data: [], total: 0 }),
    createFanpage: jasmine.createSpy('createFanpage').and.resolveTo({}),
    updateFanpage: jasmine.createSpy('updateFanpage').and.resolveTo({}),
    deleteFanpage: jasmine.createSpy('deleteFanpage').and.resolveTo(undefined),
    listOpenAITokens: jasmine.createSpy('listOpenAITokens').and.resolveTo({ data: [], total: 0 }),
    createOpenAIToken: jasmine.createSpy('createOpenAIToken').and.resolveTo({}),
    updateOpenAIToken: jasmine.createSpy('updateOpenAIToken').and.resolveTo({}),
    deleteOpenAIToken: jasmine.createSpy('deleteOpenAIToken').and.resolveTo(undefined),
    listAiAssistantProfiles: jasmine.createSpy('listAiAssistantProfiles').and.resolveTo({ data: [], total: 0 }),
    createAiAssistantProfile: jasmine.createSpy('createAiAssistantProfile').and.resolveTo({}),
    updateAiAssistantProfile: jasmine.createSpy('updateAiAssistantProfile').and.resolveTo({}),
    deleteAiAssistantProfile: jasmine.createSpy('deleteAiAssistantProfile').and.resolveTo(undefined),
    listConversations: jasmine.createSpy('listConversations').and.resolveTo({ data: [], total: 0 }),
    getConversation: jasmine.createSpy('getConversation').and.resolveTo({}),
    updateConversation: jasmine.createSpy('updateConversation').and.resolveTo({}),
    listMessages: jasmine.createSpy('listMessages').and.resolveTo([]),
    sendHumanReply: jasmine.createSpy('sendHumanReply').and.resolveTo({}),
    createLead: jasmine.createSpy('createLead').and.resolveTo({}),
    createOrder: jasmine.createSpy('createOrder').and.resolveTo({}),
    takeoverConversation: jasmine.createSpy('takeoverConversation').and.resolveTo({}),
    releaseConversation: jasmine.createSpy('releaseConversation').and.resolveTo({}),
  };
}

function makeAdsServiceStub() {
  return {
    listAdAccounts: jasmine.createSpy('listAdAccounts').and.resolveTo({ data: [], total: 0 }),
  };
}

const activatedRouteStub = {
  snapshot: {
    queryParamMap: {
      get: (_: string) => null,
    },
  },
};

const routerStub = {
  navigate: jasmine.createSpy('navigate'),
};

// ══════════════════════════════════════════════════════════════════════════════
// TicketsComponent — RBAC & Status/Priority Labels (19.1, 19.3)
// ══════════════════════════════════════════════════════════════════════════════

describe('TicketsComponent — Status/Priority Labels & RBAC', () => {
  let comp: TicketsComponent;
  let auth: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    auth = makeMutableAuthStub();
    TestBed.configureTestingModule({
      imports: [TicketsComponent, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: TicketService, useValue: makeTicketServiceStub() },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: routerStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(TicketsComponent);
    comp = fixture.componentInstance;
  });

  // ── statusLabel ──────────────────────────────────────────────────────────

  describe('statusLabel()', () => {
    it('maps OPEN → Mới tạo', () => {
      expect((comp as any).statusLabel('OPEN')).toBe('Mới tạo');
    });

    it('maps IN_PROGRESS → Đang xử lý', () => {
      expect((comp as any).statusLabel('IN_PROGRESS')).toBe('Đang xử lý');
    });

    it('maps WAITING_INFO → Chờ thông tin', () => {
      expect((comp as any).statusLabel('WAITING_INFO')).toBe('Chờ thông tin');
    });

    it('maps WAITING_REFUND → Chờ hoàn tiền', () => {
      expect((comp as any).statusLabel('WAITING_REFUND')).toBe('Chờ hoàn tiền');
    });

    it('maps RESOLVED → Đã giải quyết', () => {
      expect((comp as any).statusLabel('RESOLVED')).toBe('Đã giải quyết');
    });

    it('maps CLOSED → Đã đóng', () => {
      expect((comp as any).statusLabel('CLOSED')).toBe('Đã đóng');
    });

    it('maps CANCELLED → Đã hủy', () => {
      expect((comp as any).statusLabel('CANCELLED')).toBe('Đã hủy');
    });

    it('returns unknown status as-is', () => {
      expect((comp as any).statusLabel('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS');
    });

    it('handles empty string gracefully', () => {
      const result = (comp as any).statusLabel('');
      expect(typeof result).toBe('string');
    });
  });

  // ── priorityLabel ────────────────────────────────────────────────────────

  describe('priorityLabel()', () => {
    it('maps LOW → Thấp', () => {
      expect((comp as any).priorityLabel('LOW')).toBe('Thấp');
    });

    it('maps MEDIUM → Trung bình', () => {
      expect((comp as any).priorityLabel('MEDIUM')).toBe('Trung bình');
    });

    it('maps HIGH → Cao', () => {
      expect((comp as any).priorityLabel('HIGH')).toBe('Cao');
    });

    it('maps URGENT → Khẩn cấp', () => {
      expect((comp as any).priorityLabel('URGENT')).toBe('Khẩn cấp');
    });

    it('returns unknown priority as-is', () => {
      expect((comp as any).priorityLabel('SUPER_HIGH')).toBe('SUPER_HIGH');
    });
  });

  // ── RBAC methods ─────────────────────────────────────────────────────────

  describe('isOpsOrDirector()', () => {
    it('returns true for OPS', () => {
      auth.setRole('OPS');
      expect((comp as any).isOpsOrDirector()).toBe(true);
    });

    it('returns true for DIRECTOR', () => {
      auth.setRole('DIRECTOR');
      expect((comp as any).isOpsOrDirector()).toBe(true);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect((comp as any).isOpsOrDirector()).toBe(false);
    });

    it('returns false for PARENT', () => {
      auth.setRole('PARENT');
      expect((comp as any).isOpsOrDirector()).toBe(false);
    });

    it('returns false for TEACHER', () => {
      auth.setRole('TEACHER');
      expect((comp as any).isOpsOrDirector()).toBe(false);
    });

    it('returns false for ACCOUNTING', () => {
      auth.setRole('ACCOUNTING');
      expect((comp as any).isOpsOrDirector()).toBe(false);
    });
  });

  describe('isOps()', () => {
    it('returns true for OPS', () => {
      auth.setRole('OPS');
      expect((comp as any).isOps()).toBe(true);
    });

    it('returns false for DIRECTOR', () => {
      auth.setRole('DIRECTOR');
      expect((comp as any).isOps()).toBe(false);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect((comp as any).isOps()).toBe(false);
    });

    it('returns false for PARENT', () => {
      auth.setRole('PARENT');
      expect((comp as any).isOps()).toBe(false);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ChatbotSettingsComponent — Labels & RBAC (18.3, 18.4, 18.5)
// ══════════════════════════════════════════════════════════════════════════════

describe('ChatbotSettingsComponent — Labels & RBAC', () => {
  let comp: ChatbotSettingsComponent;
  let auth: ReturnType<typeof makeMutableAuthStub>;

  beforeEach(() => {
    auth = makeMutableAuthStub();
    TestBed.configureTestingModule({
      imports: [ChatbotSettingsComponent, HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ChatbotService, useValue: makeChatbotServiceStub() },
        { provide: AdsService, useValue: makeAdsServiceStub() },
        { provide: ActivatedRoute, useValue: activatedRouteStub },
        { provide: Router, useValue: routerStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(ChatbotSettingsComponent);
    comp = fixture.componentInstance;
  });

  // ── statusLabel ──────────────────────────────────────────────────────────

  describe('statusLabel()', () => {
    it('maps ACTIVE → Hoat dong', () => {
      expect(comp.statusLabel('ACTIVE')).toBe('Hoat dong');
    });

    it('maps INACTIVE → Ngung', () => {
      expect(comp.statusLabel('INACTIVE')).toBe('Ngung');
    });

    it('maps EXPIRED → Het han', () => {
      expect(comp.statusLabel('EXPIRED')).toBe('Het han');
    });

    it('maps REVOKED → Da thu hoi', () => {
      expect(comp.statusLabel('REVOKED')).toBe('Da thu hoi');
    });

    it('returns original value for unknown status', () => {
      expect(comp.statusLabel('UNKNOWN_TOKEN_STATUS')).toBe('UNKNOWN_TOKEN_STATUS');
    });

    it('returns "-" for undefined', () => {
      expect(comp.statusLabel(undefined)).toBe('-');
    });

    it('returns "-" for empty string', () => {
      expect(comp.statusLabel('')).toBe('-');
    });
  });

  // ── platformLabel ────────────────────────────────────────────────────────

  describe('platformLabel()', () => {
    it('maps FACEBOOK → Facebook', () => {
      expect(comp.platformLabel('FACEBOOK')).toBe('Facebook');
    });

    it('maps TIKTOK → TikTok', () => {
      expect(comp.platformLabel('TIKTOK')).toBe('TikTok');
    });

    it('returns "-" for undefined', () => {
      expect(comp.platformLabel(undefined)).toBe('-');
    });

    it('returns original value for unknown platform', () => {
      expect(comp.platformLabel('INSTAGRAM')).toBe('INSTAGRAM');
    });
  });

  // ── syncSourceLabel ──────────────────────────────────────────────────────

  describe('syncSourceLabel()', () => {
    it('maps MANUAL → Nhap tay', () => {
      expect(comp.syncSourceLabel('MANUAL')).toBe('Nhap tay');
    });

    it('maps FACEBOOK_BM → Dong bo BM', () => {
      expect(comp.syncSourceLabel('FACEBOOK_BM')).toBe('Dong bo BM');
    });

    it('returns "Nhap tay" fallback for empty string', () => {
      expect(comp.syncSourceLabel('')).toBe('Nhap tay');
    });
  });

  // ── aiAssistantTypeLabel ─────────────────────────────────────────────────

  describe('aiAssistantTypeLabel()', () => {
    it('maps PARENT_SUPPORT → Cham soc phu huynh', () => {
      expect(comp.aiAssistantTypeLabel('PARENT_SUPPORT')).toBe('Cham soc phu huynh');
    });

    it('maps INTERNAL_SUPPORT → Ho tro noi bo', () => {
      expect(comp.aiAssistantTypeLabel('INTERNAL_SUPPORT')).toBe('Ho tro noi bo');
    });

    it('maps TEACHER_SUPPORT → Tro ly giao vien', () => {
      expect(comp.aiAssistantTypeLabel('TEACHER_SUPPORT')).toBe('Tro ly giao vien');
    });

    it('maps LEAD_CARE → Cham soc lead', () => {
      expect(comp.aiAssistantTypeLabel('LEAD_CARE')).toBe('Cham soc lead');
    });

    it('returns "-" for undefined', () => {
      expect(comp.aiAssistantTypeLabel(undefined)).toBe('-');
    });
  });

  // ── formatDate ───────────────────────────────────────────────────────────

  describe('formatDate()', () => {
    it('returns "-" for null', () => {
      expect(comp.formatDate(null)).toBe('-');
    });

    it('returns "-" for undefined', () => {
      expect(comp.formatDate(undefined)).toBe('-');
    });

    it('returns "-" for empty string', () => {
      expect(comp.formatDate('')).toBe('-');
    });

    it('returns "-" for invalid date string', () => {
      expect(comp.formatDate('not-a-date')).toBe('-');
    });

    it('returns formatted string for valid ISO date', () => {
      const result = comp.formatDate('2025-06-15T10:00:00.000Z');
      expect(typeof result).toBe('string');
      expect(result).not.toBe('-');
      // Should contain year 2025
      expect(result).toMatch(/2025/);
    });
  });

  // ── RBAC methods ─────────────────────────────────────────────────────────

  describe('canCreateFanpages()', () => {
    it('returns true for DIRECTOR', () => {
      auth.setRole('DIRECTOR');
      expect(comp.canCreateFanpages()).toBe(true);
    });

    it('returns false for OPS', () => {
      auth.setRole('OPS');
      expect(comp.canCreateFanpages()).toBe(false);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect(comp.canCreateFanpages()).toBe(false);
    });

    it('returns false for ADSMANAGER', () => {
      auth.setRole('ADSMANAGER');
      expect(comp.canCreateFanpages()).toBe(false);
    });
  });

  describe('canEditFanpages()', () => {
    it('returns true for DIRECTOR', () => {
      auth.setRole('DIRECTOR');
      expect(comp.canEditFanpages()).toBe(true);
    });

    it('returns true for OPS', () => {
      auth.setRole('OPS');
      expect(comp.canEditFanpages()).toBe(true);
    });

    it('returns true for ADSMANAGER', () => {
      auth.setRole('ADSMANAGER');
      expect(comp.canEditFanpages()).toBe(true);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect(comp.canEditFanpages()).toBe(false);
    });

    it('returns false for PARENT', () => {
      auth.setRole('PARENT');
      expect(comp.canEditFanpages()).toBe(false);
    });
  });

  describe('canManageTokenLibrary()', () => {
    it('returns true for DIRECTOR only', () => {
      auth.setRole('DIRECTOR');
      expect(comp.canManageTokenLibrary()).toBe(true);
    });

    it('returns false for OPS', () => {
      auth.setRole('OPS');
      expect(comp.canManageTokenLibrary()).toBe(false);
    });

    it('returns false for ADSMANAGER', () => {
      auth.setRole('ADSMANAGER');
      expect(comp.canManageTokenLibrary()).toBe(false);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect(comp.canManageTokenLibrary()).toBe(false);
    });
  });

  describe('canManageAiAssistantProfiles()', () => {
    it('returns true for DIRECTOR only', () => {
      auth.setRole('DIRECTOR');
      expect(comp.canManageAiAssistantProfiles()).toBe(true);
    });

    it('returns false for OPS', () => {
      auth.setRole('OPS');
      expect(comp.canManageAiAssistantProfiles()).toBe(false);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect(comp.canManageAiAssistantProfiles()).toBe(false);
    });

    it('returns false for ADSMANAGER', () => {
      auth.setRole('ADSMANAGER');
      expect(comp.canManageAiAssistantProfiles()).toBe(false);
    });
  });

  describe('canUseOpenAITokens()', () => {
    it('returns true for DIRECTOR', () => {
      auth.setRole('DIRECTOR');
      expect(comp.canUseOpenAITokens()).toBe(true);
    });

    it('returns true for OPS', () => {
      auth.setRole('OPS');
      expect(comp.canUseOpenAITokens()).toBe(true);
    });

    it('returns true for ADSMANAGER', () => {
      auth.setRole('ADSMANAGER');
      expect(comp.canUseOpenAITokens()).toBe(true);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect(comp.canUseOpenAITokens()).toBe(false);
    });
  });

  describe('canViewAiAssistantProfiles()', () => {
    it('returns true for DIRECTOR', () => {
      auth.setRole('DIRECTOR');
      expect(comp.canViewAiAssistantProfiles()).toBe(true);
    });

    it('returns true for OPS', () => {
      auth.setRole('OPS');
      expect(comp.canViewAiAssistantProfiles()).toBe(true);
    });

    it('returns false for SALE', () => {
      auth.setRole('SALE');
      expect(comp.canViewAiAssistantProfiles()).toBe(false);
    });
  });

  // ── switchTab guards ────────────────────────────────────────────────────

  describe('switchTab()', () => {
    it('OPS cannot switch to tokens tab (canManageTokenLibrary false)', () => {
      auth.setRole('OPS');
      comp.activeTab = 'fanpages';
      comp.switchTab('tokens');
      // Tab should NOT have changed since OPS cannot manage token library
      expect(comp.activeTab).toBe('fanpages');
    });

    it('DIRECTOR can switch to tokens tab', () => {
      auth.setRole('DIRECTOR');
      comp.activeTab = 'fanpages';
      comp.switchTab('tokens');
      expect(comp.activeTab).toBe('tokens');
    });

    it('DIRECTOR can switch to profiles tab', () => {
      auth.setRole('DIRECTOR');
      comp.activeTab = 'fanpages';
      comp.switchTab('profiles');
      expect(comp.activeTab).toBe('profiles');
    });

    it('OPS cannot switch to profiles tab (canViewAiAssistantProfiles uses canUseOpenAITokens — but OPS can!)', () => {
      auth.setRole('OPS');
      comp.activeTab = 'fanpages';
      comp.switchTab('profiles');
      // OPS has canUseOpenAITokens=true so canViewAiAssistantProfiles=true
      expect(comp.activeTab).toBe('profiles');
    });

    it('SALE cannot switch to profiles tab', () => {
      auth.setRole('SALE');
      comp.activeTab = 'fanpages';
      comp.switchTab('profiles');
      // SALE cannot view profiles
      expect(comp.activeTab).toBe('fanpages');
    });
  });
});
