import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { ADSMANAGER_VIDEO_COPY } from './adsmanager-video-copy';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_PREFIX_PATTERN = '^(?:https?://[^/]+)?(?:/api)?';
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE);
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const META_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_BASENAME = `UI_AdsManager_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const VIDEO_TEST_TITLE = 'records the full ads manager master workflow with HD demo pacing';

test.use({
  video: 'on',
  viewport: VIEWPORT,
  trace: 'off',
  launchOptions: {
    slowMo: 150,
  },
});

type NarrationCue = {
  id: string;
  atMs: number;
  section: string;
  text: string;
};

type NarrationPlayback = {
  startedAt: number;
  targetMs: number;
};

type AnalyticsSeedRow = {
  _filterDate: string;
  adGroupId: string;
  adGroupName: string;
  platform: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  leadCount: number;
  orderCount: number;
  revenue: number;
  costPerLead: number | null;
  costPerOrder: number | null;
  netProfit: number;
  roi: number;
};

type AnalyticsState = {
  groups: any[];
  analyticsRows: AnalyticsSeedRow[];
  realizedRows: any[];
  parentProfitRows: any[];
  captured: {
    analytics: URL[];
    realized: URL[];
    parents: URL[];
    suggestions: URL[];
  };
};

type DirectorWorkflowState = {
  user: any;
  loginBodies: Array<{ email: string; password: string }>;
  pending: {
    classPending: boolean;
    sessionChangePending: boolean;
  };
  calendarTeachers: any[];
  calendarClasses: any[];
  teacherKpi: any;
  employeePerformance: {
    teachers: any[];
    sales: any[];
    ops: any[];
  };
  financial: {
    bankAccounts: any[];
    bankTransactions: any[];
    funds: any[];
    fundTransactions: any[];
  };
  analytics: AnalyticsState;
};

const NARRATION_FALLBACK_WORD_MS = 440;
const NARRATION_FALLBACK_BASE_MS = 1_300;
const NARRATION_FINISH_BUFFER_MS = 350;

async function ensureEvidenceDirs(): Promise<void> {
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(META_DIR, { recursive: true });
}

async function saveRecordedVideo(page: Page, context: BrowserContext): Promise<string | null> {
  const recordedVideo = page.video();
  if (!recordedVideo) {
    await context.close();
    return null;
  }

  await ensureEvidenceDirs();
  await context.close();
  const rawVideoPath = await recordedVideo.path();
  const finalVideoPath = path.join(VIDEO_DIR, `${FINAL_VIDEO_BASENAME}.webm`);
  await rm(finalVideoPath, { force: true });
  await rename(rawVideoPath, finalVideoPath);
  return finalVideoPath;
}

function pushNarrationCue(
  cues: NarrationCue[],
  recordingStartedAt: number,
  section: string,
  text: string,
): void {
  cues.push({
    id: `cue-${String(cues.length + 1).padStart(2, '0')}`,
    atMs: Math.max(0, Date.now() - recordingStartedAt),
    section,
    text,
  });
}

function formatCueTimestamp(atMs: number): string {
  const totalSeconds = Math.floor(atMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

async function writeNarrationArtifacts(artifactDir: string, cues: NarrationCue[]): Promise<void> {
  await writeFile(
    path.join(artifactDir, 'narration-cues.json'),
    `${JSON.stringify(cues, null, 2)}\n`,
    'utf8',
  );

  const lines = [
    '# Ads Manager Full Workflow Narration',
    '',
    'Danh sach cue de render long tieng cho video director.',
    '',
    '| Cue | Time | Section | Text |',
    '| --- | --- | --- | --- |',
    ...cues.map((cue) => `| ${cue.id} | ${formatCueTimestamp(cue.atMs)} | ${cue.section} | ${cue.text} |`),
    '',
  ];

  await writeFile(path.join(artifactDir, 'narration-script.md'), lines.join('\n'), 'utf8');
}

function estimateNarrationDurationMs(text: string): number {
  const wordCount = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2_400, wordCount * NARRATION_FALLBACK_WORD_MS + NARRATION_FALLBACK_BASE_MS);
}

async function buildNarrationDurationMap(texts: string[]): Promise<Map<string, number>> {
  const uniqueTexts = [...new Set(texts.filter(Boolean))];
  return new Map(uniqueTexts.map((text) => [text, estimateNarrationDurationMs(text)]));
}

function beginNarration(
  cues: NarrationCue[],
  recordingStartedAt: number,
  section: string,
  text: string,
  durationMap: Map<string, number>,
): NarrationPlayback {
  pushNarrationCue(cues, recordingStartedAt, section, text);
  return {
    startedAt: Date.now(),
    targetMs: durationMap.get(text) ?? estimateNarrationDurationMs(text),
  };
}

async function waitForNarrationWindow(
  page: Page,
  playback: NarrationPlayback,
  minimumMs = 0,
  extraBufferMs = NARRATION_FINISH_BUFFER_MS,
): Promise<void> {
  const elapsedMs = Date.now() - playback.startedAt;
  const targetMs = Math.max(minimumMs, playback.targetMs + extraBufferMs);
  const remainingMs = targetMs - elapsedMs;
  if (remainingMs > 0) {
    await page.waitForTimeout(remainingMs);
  }
}

function appUrl(routePath: string): string {
  return new URL(routePath, APP_BASE_URL).toString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toDateOnly(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function inDateRange(value: string, startDate: string | null, endDate: string | null): boolean {
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

async function jsonResponse(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installVideoOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const CURSOR_ID = '__codex_video_cursor';
    const LABEL_ID = '__codex_video_label';
    const CALLOUT_ID = '__codex_video_callout';
    const CALLOUT_TEXT_ID = '__codex_video_callout_text';

    const ensureOverlay = () => {
      if (!document.body) return;

      let cursor = document.getElementById(CURSOR_ID) as HTMLDivElement | null;
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = CURSOR_ID;
        Object.assign(cursor.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: '24px',
          height: '24px',
          borderRadius: '999px',
          border: '3px solid rgba(14,165,233,.94)',
          background: 'rgba(255,255,255,.82)',
          boxShadow: '0 10px 28px rgba(14,165,233,.36)',
          pointerEvents: 'none',
          zIndex: '2147483647',
          transform: 'translate(-999px, -999px)',
          transition: 'transform 60ms linear',
        });
        document.body.appendChild(cursor);
      }

      let label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        Object.assign(label.style, {
          position: 'fixed',
          left: '20px',
          bottom: '20px',
          maxWidth: '860px',
          padding: '12px 16px',
          borderRadius: '14px',
          background: 'rgba(15,23,42,.84)',
          color: '#e2e8f0',
          font: '600 15px/1.55 "Segoe UI", system-ui, sans-serif',
          boxShadow: '0 20px 44px rgba(15,23,42,.28)',
          pointerEvents: 'none',
          zIndex: '2147483646',
          opacity: '0',
          transition: 'opacity 150ms ease',
        });
        document.body.appendChild(label);
      }

      let callout = document.getElementById(CALLOUT_ID) as HTMLDivElement | null;
      if (!callout) {
        callout = document.createElement('div');
        callout.id = CALLOUT_ID;
        Object.assign(callout.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: '0',
          height: '0',
          border: '4px solid rgba(239,68,68,.96)',
          borderRadius: '20px',
          boxShadow: '0 0 0 9999px rgba(15,23,42,.04), 0 0 0 10px rgba(239,68,68,.14)',
          pointerEvents: 'none',
          zIndex: '2147483645',
          opacity: '0',
          transition: 'all 180ms ease',
        });
        document.body.appendChild(callout);
      }

      let calloutText = document.getElementById(CALLOUT_TEXT_ID) as HTMLDivElement | null;
      if (!calloutText) {
        calloutText = document.createElement('div');
        calloutText.id = CALLOUT_TEXT_ID;
        Object.assign(calloutText.style, {
          position: 'fixed',
          left: '24px',
          top: '24px',
          maxWidth: '520px',
          padding: '10px 14px',
          borderRadius: '14px',
          background: 'rgba(127,29,29,.92)',
          color: '#fee2e2',
          font: '600 14px/1.5 "Segoe UI", system-ui, sans-serif',
          boxShadow: '0 18px 40px rgba(127,29,29,.32)',
          pointerEvents: 'none',
          zIndex: '2147483644',
          opacity: '0',
          transition: 'opacity 180ms ease',
        });
        document.body.appendChild(calloutText);
      }
    };

    ensureOverlay();
    document.addEventListener('mousemove', (event) => {
      const cursor = document.getElementById(CURSOR_ID) as HTMLDivElement | null;
      if (!cursor) return;
      cursor.style.transform = `translate(${event.clientX - 12}px, ${event.clientY - 12}px)`;
    }, { passive: true });
    window.setInterval(ensureOverlay, 300);

    (window as any).__codexVideoLabel = (value: string | null) => {
      ensureOverlay();
      const label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) return;
      label.textContent = value || '';
      label.style.opacity = value ? '1' : '0';
    };

    (window as any).__codexVideoCallout = (
      rect: { x: number; y: number; width: number; height: number } | null,
      text: string | null,
    ) => {
      ensureOverlay();
      const callout = document.getElementById(CALLOUT_ID) as HTMLDivElement | null;
      const calloutText = document.getElementById(CALLOUT_TEXT_ID) as HTMLDivElement | null;
      if (!callout || !calloutText) return;

      if (!rect) {
        callout.style.opacity = '0';
        callout.style.width = '0';
        callout.style.height = '0';
        calloutText.style.opacity = '0';
        calloutText.textContent = '';
        return;
      }

      const padding = 8;
      callout.style.opacity = '1';
      callout.style.left = `${Math.max(0, rect.x - padding)}px`;
      callout.style.top = `${Math.max(0, rect.y - padding)}px`;
      callout.style.width = `${Math.max(24, rect.width + (padding * 2))}px`;
      callout.style.height = `${Math.max(24, rect.height + (padding * 2))}px`;

      if (text) {
        calloutText.textContent = text;
        calloutText.style.opacity = '1';
      } else {
        calloutText.textContent = '';
        calloutText.style.opacity = '0';
      }
    };
  });
}

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((message: string | null) => void) | undefined;
    fn?.(value);
  }, message);
}

async function setVideoCallout(page: Page, locator: Locator | null, message: string | null): Promise<void> {
  let rect: { x: number; y: number; width: number; height: number } | null = null;
  if (locator) {
    const box = await locator.boundingBox();
    if (box) {
      rect = { x: box.x, y: box.y, width: box.width, height: box.height };
    }
  }

  await page.evaluate(({ nextRect, nextMessage }) => {
    const fn = (window as any).__codexVideoCallout as ((
      rect: { x: number; y: number; width: number; height: number } | null,
      text: string | null,
    ) => void) | undefined;
    fn?.(nextRect, nextMessage);
  }, { nextRect: rect, nextMessage: message });
}

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(20,184,166,.18), transparent 34%),
          radial-gradient(circle at bottom right, rgba(37,99,235,.16), transparent 40%),
          linear-gradient(135deg, #020617 0%, #0f172a 44%, #1f2937 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(1080px, calc(100vw - 80px));
        border-radius: 28px;
        padding: 42px 46px;
        background: rgba(15,23,42,.74);
        border: 1px solid rgba(148,163,184,.22);
        box-shadow: 0 24px 80px rgba(2,6,23,.46);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(45,212,191,.14);
        color: #99f6e4;
        font-size: 14px;
        letter-spacing: .08em;
        text-transform: uppercase;
        font-weight: 700;
      }
      h1 {
        margin: 20px 0 12px;
        font-size: 42px;
        line-height: 1.08;
      }
      p {
        margin: 0 0 18px;
        color: #cbd5e1;
        font-size: 20px;
        line-height: 1.55;
      }
      ul {
        margin: 0;
        padding-left: 22px;
        display: grid;
        gap: 10px;
        color: #f8fafc;
        font-size: 18px;
      }
      li::marker {
        color: #5eead4;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Director Workflow</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((bullet) => `<li>${bullet}</li>`).join('')}</ul>
    </div>
  `);
}

async function showWorkflowRoadmapCard(
  page: Page,
  title: string,
  subtitle: string,
  steps: readonly string[],
): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(20,184,166,.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(37,99,235,.16), transparent 24%),
          linear-gradient(135deg, #0f172a 0%, #111827 48%, #1f2937 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .shell {
        width: min(1260px, calc(100vw - 72px));
        padding: 34px 38px 40px;
        border-radius: 30px;
        background: rgba(15,23,42,.72);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 34px 90px rgba(15,23,42,.36);
        backdrop-filter: blur(16px);
      }
      .eyebrow {
        margin: 0 0 12px;
        color: #99f6e4;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: 42px;
        line-height: 1.08;
        letter-spacing: -0.04em;
        color: #f8fafc;
      }
      .subtitle {
        margin: 16px 0 0;
        max-width: 980px;
        font-size: 17px;
        line-height: 1.6;
        color: rgba(226,232,240,.92);
      }
      .roadmap {
        margin-top: 30px;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 16px;
      }
      .step {
        min-height: 118px;
        padding: 18px 16px;
        border-radius: 22px;
        background: rgba(30,41,59,.72);
        border: 1px solid rgba(148,163,184,.16);
      }
      .index {
        display: inline-grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: rgba(45,212,191,.18);
        color: #99f6e4;
        font-size: 14px;
        font-weight: 800;
      }
      .label {
        margin-top: 16px;
        color: #f8fafc;
        font-size: 17px;
        line-height: 1.45;
        font-weight: 700;
      }
    </style>
    <div class="shell">
      <div class="eyebrow">Director Roadmap</div>
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="roadmap">
        ${steps
          .map(
            (step, index) => `
              <div class="step">
                <div class="index">${index + 1}</div>
                <div class="label">${step}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </div>
  `);
}

function collectNarrationTexts(copy: typeof ADSMANAGER_VIDEO_COPY): string[] {
  return [
    copy.introNarration,
    copy.roadmapNarration,
    copy.dashboardSceneNarration,
    copy.dashboardNarration,
    copy.managementSceneNarration,
    copy.managementNarration,
    copy.actionsSceneNarration,
    copy.actionsNarration,
    copy.analyticsSceneNarration,
    copy.analyticsNarration,
    copy.chatbotSceneNarration,
    copy.chatbotNarration,
    copy.logoutSceneNarration,
    copy.logoutNarration,
    copy.outroNarration,
  ];
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 18 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(180);
}

function buildDirectorComprehensivePayload(): any {
  return {
    director: {
      overview: {
        totalRevenue: 32_000_000,
        totalTeacherCost: 12_000_000,
        totalExpenses: 4_500_000,
        grossProfit: 20_000_000,
        netProfit: 15_500_000,
        profitMargin: 48.4,
      },
      sessions: {
        total: 42,
        byStatus: {
          SCHEDULED: 12,
          FINALIZED: 24,
          CANCELLED: 6,
        },
        completionRate: 57.1,
      },
      users: {
        totalTeachers: 11,
        activeTeachers: 9,
        totalParents: 34,
        totalStudents: 36,
      },
      payroll: {
        totalPaid: 8_200_000,
        pendingApproval: 2,
        byStatus: {
          PAID: { count: 4, totalNet: 8_200_000 },
          PENDING_REVIEW: { count: 2, totalNet: 2_600_000 },
        },
      },
      tickets: {
        total: 12,
        openCount: 5,
        overdueCount: 3,
        avgResolutionHours: 18.5,
      },
      wallets: {
        totalBalance: 6_100_000,
        totalTopUp: 21_000_000,
        totalDeducted: 15_500_000,
        totalRefunded: 450_000,
      },
      recentActivity: {
        recentSessions: [
          {
            teacherId: { fullName: 'Teacher One' },
            studentId: { name: 'Student One' },
            status: 'FINALIZED',
          },
        ],
        recentTickets: [
          {
            ticketCode: 'TKT-OVERDUE-001',
            subject: 'Ticket qua han can xu ly',
            status: 'OPEN',
          },
        ],
        recentTopUps: [],
      },
    },
    accounting: {
      financialSummary: {
        TOP_UP: { totalAmount: 12_000_000, count: 4 },
        SESSION_DEDUCT: { totalAmount: 8_500_000, count: 21 },
      },
      wallets: {
        totalBalance: 6_100_000,
        totalTopUp: 21_000_000,
        totalDeducted: 15_500_000,
        totalRefunded: 450_000,
        walletCount: 16,
        frozenCount: 1,
      },
      pendingTopUps: [],
      payroll: {
        byStatus: {
          PAID: { count: 4, totalNet: 8_200_000, totalGross: 9_100_000 },
          PENDING_REVIEW: { count: 2, totalNet: 2_600_000, totalGross: 2_900_000 },
        },
        totalPaidThisPeriod: 8_200_000,
      },
      ledgerRecent: [],
      revenue: {
        totalSessionRevenue: 32_000_000,
        totalTeacherCost: 12_000_000,
        grossProfit: 20_000_000,
      },
    },
    ops: {
      classes: {
        total: 14,
        active: 11,
        byStatus: {
          ACTIVE: 11,
          INACTIVE: 3,
        },
      },
      sessions: {
        total: 42,
        byStatus: {
          SCHEDULED: 12,
          FINALIZED: 24,
          CANCELLED: 6,
        },
        upcomingToday: 4,
        needsFinalization: 2,
      },
      teachers: {
        total: 11,
        active: 9,
        pendingApproval: 1,
        suspended: 1,
      },
      students: {
        total: 36,
        pendingApproval: 2,
      },
      tickets: {
        total: 12,
        byStatus: {
          OPEN: 5,
          IN_PROGRESS: 4,
          WAITING_INFO: 1,
          RESOLVED: 2,
        },
        byPriority: {
          HIGH: 3,
          MEDIUM: 6,
          LOW: 3,
        },
        overdueCount: 3,
        assignedToMe: 2,
      },
      recentTickets: [
        {
          ticketCode: 'TKT-OVERDUE-001',
          subject: 'Ticket qua han can xu ly',
          createdBy: { fullName: 'Parent One' },
          assignedTo: { fullName: 'Ops One' },
          status: 'OPEN',
          createdAt: '2026-04-08T02:00:00.000Z',
        },
      ],
    },
    birthdays: {
      month: 4,
      totalStudentBirthdays: 0,
      totalParentBirthdays: 0,
      studentBirthdays: [],
      parentBirthdays: [],
    },
    staffLists: {
      totalStaff: 3,
      teachers: [],
      summary: {
        OPS: 1,
        ACCOUNTING: 1,
        SALE: 1,
      },
      byRole: {
        OPS: [
          {
            fullName: 'Ops One',
            email: 'ops.one@school.local',
            status: 'ACTIVE',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ],
      },
    },
  };
}

function buildDailyTasksPayload(): any {
  return {
    role: 'DIRECTOR',
    generatedAt: '2026-04-08T00:00:00.000Z',
    title: 'Daily tasks',
    subtitle: 'Director board',
    summary: {
      totalTasks: 0,
      overdueTasks: 0,
      dueTodayTasks: 0,
      highPriorityTasks: 0,
    },
    tabs: [],
  };
}

function buildTicketStatsPayload(): any {
  return {
    byStatus: [
      { _id: 'OPEN', count: 1 },
      { _id: 'IN_PROGRESS', count: 0 },
      { _id: 'WAITING_INFO', count: 0 },
      { _id: 'RESOLVED', count: 0 },
      { _id: 'CLOSED', count: 0 },
    ],
    byType: [],
    byPriority: [{ _id: 'HIGH', count: 1 }],
    overdueCount: 1,
  };
}

function buildTicketListPayload(): any {
  return {
    data: [
      {
        _id: 'ticket-overdue-001',
        ticketCode: 'TKT-OVERDUE-001',
        type: 'REFUND_REQUEST',
        status: 'OPEN',
        priority: 'HIGH',
        subject: 'Refund request qua han',
        description: 'Ticket da qua SLA can xu ly ngay.',
        createdBy: {
          _id: 'user-parent-001',
          fullName: 'Parent One',
          email: 'parent.one@school.local',
          role: 'PARENT',
        },
        createdByRole: 'PARENT',
        assignedTo: {
          _id: 'user-ops-001',
          fullName: 'Ops One',
          email: 'ops.one@school.local',
        },
        attachments: [],
        dueDate: '2026-04-07T00:00:00.000Z',
        isOverdue: true,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };
}

function buildStatefulPendingPayload(state: DirectorWorkflowState['pending']): any {
  return {
    summary: {
      totalPending: 4 + Number(state.classPending) + Number(state.sessionChangePending),
      pendingPayrolls: 1,
      pendingInvoices: 1,
      pendingTopUps: 1,
      pendingTeachers: 1,
      pendingClassUpdates: Number(state.classPending),
      pendingSessionChangeRequests: Number(state.sessionChangePending),
      openTickets: 2,
    },
    payrolls: [
      {
        payrollCode: 'PR-001',
        teacherId: { fullName: 'Teacher One' },
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        totalSessions: 8,
        netAmount: 1_200_000,
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    invoices: [
      {
        invoiceNumber: 'INV-001',
        studentId: { fullName: 'Student One' },
        totalAmount: 500_000,
        createdBy: { fullName: 'Sale One' },
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    topUps: [
      {
        userId: { fullName: 'Parent One', email: 'parent.one@school.local' },
        amount: 300_000,
        paymentMethod: 'BANK_TRANSFER',
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    teachers: [
      {
        _id: 'teacher-profile-001',
        userId: { fullName: 'Teacher New', email: 'teacher.new@school.local', phone: '0900000001' },
        createdAt: '2026-04-08T00:00:00.000Z',
      },
    ],
    classes: state.classPending
      ? [
          {
            _id: 'class-001',
            code: 'CLS001',
            name: 'Class One',
            sale: { fullName: 'Sale One' },
            pendingSaleUpdate: {
              status: 'PENDING',
              requestedBy: { fullName: 'Sale One' },
              requestedAt: '2026-04-08T00:00:00.000Z',
              requestedChanges: { sessionDuration: 90 },
              changeSummary: [
                {
                  label: 'Thoi luong buoi hoc',
                  beforeValue: '60 phut',
                  afterValue: '90 phut',
                },
              ],
            },
          },
        ]
      : [],
    sessionChanges: state.sessionChangePending
      ? [
          {
            _id: 'session-change-001',
            classId: { code: 'CLS001' },
            studentId: { fullName: 'Student One', studentCode: 'HS001' },
            requestedBy: { fullName: 'Sale One' },
            requestedAt: '2026-04-08T00:00:00.000Z',
            requestedTeacherId: { fullName: 'Teacher Two' },
            requestedDurationMinutes: 90,
            currentDurationMinutes: 60,
            reason: 'Need more practice time',
            sessionId: { scheduledDate: '2026-04-09', scheduledStartTime: '18:00' },
            financialImpact: {
              newAmountCharged: 250_000,
              newTeacherPayout: 150_000,
              note: 'Updated payout',
            },
          },
        ]
      : [],
  };
}

function buildTeacherKpiState(): any {
  return {
    summary: {
      totalTeachers: 4,
      activeTeachers: 1,
      avgKPI: 66,
      avgRating: 3.1,
      kpiDistribution: {
        excellent: 1,
        good: 2,
        average: 0,
        belowAverage: 1,
      },
    },
    teachers: [
      {
        profileId: 'teacher-kpi-profile-alpha',
        userId: 'teacher-kpi-user-alpha',
        fullName: 'Alpha Nguyen',
        email: 'alpha.teacher@example.com',
        phone: '0901000101',
        teacherStatus: 'ACTIVE',
        subjects: ['Toan', 'Tieng Anh'],
        grades: ['Lop 6', 'Lop 7'],
        profileRating: 4.8,
        yearsOfExperience: 7,
        kpiScore: 92,
        sessions: {
          total: 18,
          completed: 17,
          cancelled: 1,
          noShow: 0,
          completionRate: 94,
          totalRevenue: 5_600_000,
          totalPayout: 3_200_000,
        },
        reports: {
          submitted: 16,
          late: 2,
          submissionRate: 94,
          onTimeRate: 88,
        },
        evaluation: {
          avgStudentPerformance: 4.8,
          avgStudentEngagement: 4.6,
          avgComprehension: 4.5,
          evalCount: 14,
        },
        parentFeedback: {
          avgOverallRating: 4.7,
          avgTeachingQuality: 4.8,
          avgCommunication: 4.6,
          satisfactionRate: 93,
          feedbackCount: 15,
        },
        classes: {
          activeClasses: 3,
          totalStudents: 11,
        },
        payroll: {
          totalPaid: 3_100_000,
          payrollCount: 2,
        },
      },
      {
        profileId: 'teacher-kpi-profile-bravo',
        userId: 'teacher-kpi-user-bravo',
        fullName: 'Bravo Le',
        email: 'bravo.teacher@example.com',
        phone: '0901000102',
        teacherStatus: 'PENDING',
        subjects: ['Vat ly'],
        grades: ['Lop 8'],
        profileRating: 4.3,
        yearsOfExperience: 4,
        kpiScore: 61,
        sessions: {
          total: 30,
          completed: 21,
          cancelled: 6,
          noShow: 3,
          completionRate: 70,
          totalRevenue: 7_200_000,
          totalPayout: 4_100_000,
        },
        reports: {
          submitted: 17,
          late: 5,
          submissionRate: 81,
          onTimeRate: 71,
        },
        evaluation: {
          avgStudentPerformance: 3.9,
          avgStudentEngagement: 4.0,
          avgComprehension: 3.8,
          evalCount: 9,
        },
        parentFeedback: {
          avgOverallRating: 4.2,
          avgTeachingQuality: 4.3,
          avgCommunication: 4.1,
          satisfactionRate: 84,
          feedbackCount: 10,
        },
        classes: {
          activeClasses: 4,
          totalStudents: 14,
        },
        payroll: {
          totalPaid: 2_800_000,
          payrollCount: 1,
        },
      },
      {
        profileId: 'teacher-kpi-profile-charlie',
        userId: 'teacher-kpi-user-charlie',
        fullName: 'Charlie Pham',
        email: 'charlie.teacher@example.com',
        phone: '0901000103',
        teacherStatus: 'SUSPENDED',
        subjects: ['Hoa hoc'],
        grades: ['Lop 9'],
        profileRating: 0,
        yearsOfExperience: 2,
        kpiScore: 37,
        sessions: {
          total: 12,
          completed: 4,
          cancelled: 5,
          noShow: 3,
          completionRate: 33,
          totalRevenue: 2_100_000,
          totalPayout: 900_000,
        },
        reports: {
          submitted: 2,
          late: 2,
          submissionRate: 50,
          onTimeRate: 0,
        },
        evaluation: {
          avgStudentPerformance: 2.5,
          avgStudentEngagement: 2.7,
          avgComprehension: 2.4,
          evalCount: 2,
        },
        parentFeedback: {
          avgOverallRating: 0,
          avgTeachingQuality: 0,
          avgCommunication: 0,
          satisfactionRate: 0,
          feedbackCount: 0,
        },
        classes: {
          activeClasses: 1,
          totalStudents: 3,
        },
        payroll: {
          totalPaid: 500_000,
          payrollCount: 1,
        },
      },
      {
        profileId: 'teacher-kpi-profile-delta',
        userId: 'teacher-kpi-user-delta',
        fullName: 'Delta Ho',
        email: 'delta.teacher@example.com',
        phone: '0901000104',
        teacherStatus: 'APPROVED',
        subjects: ['Tieng Anh'],
        grades: ['Lop 5'],
        profileRating: 4.6,
        yearsOfExperience: 5,
        kpiScore: 74,
        sessions: {
          total: 22,
          completed: 19,
          cancelled: 2,
          noShow: 1,
          completionRate: 86,
          totalRevenue: 4_900_000,
          totalPayout: 2_800_000,
        },
        reports: {
          submitted: 18,
          late: 2,
          submissionRate: 90,
          onTimeRate: 83,
        },
        evaluation: {
          avgStudentPerformance: 4.4,
          avgStudentEngagement: 4.3,
          avgComprehension: 4.2,
          evalCount: 11,
        },
        parentFeedback: {
          avgOverallRating: 4.5,
          avgTeachingQuality: 4.5,
          avgCommunication: 4.4,
          satisfactionRate: 88,
          feedbackCount: 12,
        },
        classes: {
          activeClasses: 2,
          totalStudents: 8,
        },
        payroll: {
          totalPaid: 2_100_000,
          payrollCount: 1,
        },
      },
    ],
    requestUrls: [],
  };
}

function buildCalendarPayload(teacherId = '', classId = ''): any {
  const sessionA = {
    _id: 'session-calendar-001',
    date: '2026-04-10',
    type: 'SESSION',
    title: 'Lop Dai So - Teacher Alpha',
    detail: 'HS: Hoc sinh An',
    status: 'SCHEDULED',
    time: '18:00',
  };
  const sessionB = {
    _id: 'session-calendar-002',
    date: '2026-04-18',
    type: 'SESSION',
    title: 'Lop Hinh Hoc - Teacher Beta',
    detail: 'HS: Hoc sinh Binh',
    status: 'SCHEDULED',
    time: '19:30',
  };
  const payrollA = {
    _id: 'payroll-calendar-001',
    date: '2026-04-03',
    type: 'PAYROLL',
    title: 'Luong: Teacher Alpha',
    detail: '180000d - PAID',
    status: 'PAID',
  };
  const payrollB = {
    _id: 'payroll-calendar-002',
    date: '2026-04-04',
    type: 'PAYROLL',
    title: 'Luong: Teacher Beta',
    detail: '220000d - PAID',
    status: 'PAID',
  };
  const ticketA = {
    _id: 'ticket-calendar-001',
    date: '2026-04-05',
    type: 'TICKET_CREATED',
    title: 'Ticket moi: TCK-CAL-001',
    detail: 'Can doi lich lop Dai So',
    status: 'OPEN',
  };
  const ticketB = {
    _id: 'ticket-calendar-002',
    date: '2026-04-06',
    type: 'TICKET_CREATED',
    title: 'Ticket moi: TCK-CAL-002',
    detail: 'Can doi lich lop Hinh Hoc',
    status: 'OPEN',
  };

  const teacherFiltered = teacherId === '000000000000000000000002';
  const classFiltered = classId === '100000000000000000000002';
  const useDatasetB = teacherFiltered || classFiltered;
  const events = useDatasetB ? [payrollB, ticketB, sessionB] : [payrollA, ticketA, sessionA, payrollB, ticketB, sessionB];
  const totalSessions = useDatasetB ? 1 : 2;

  return {
    month: 4,
    year: 2026,
    totalSessions,
    byStatus: { SCHEDULED: totalSessions },
    dailySummary: useDatasetB
      ? { '2026-04-18': { sessions: 1, completed: 0, cancelled: 0 } }
      : {
          '2026-04-10': { sessions: 1, completed: 0, cancelled: 0 },
          '2026-04-18': { sessions: 1, completed: 0, cancelled: 0 },
        },
    events,
    sessions: useDatasetB ? [sessionB] : [sessionA, sessionB],
    payrolls: useDatasetB ? [payrollB] : [payrollA, payrollB],
    tickets: useDatasetB ? [ticketB] : [ticketA, ticketB],
  };
}

function createEmployeePerformanceState(): DirectorWorkflowState['employeePerformance'] {
  return {
    teachers: [
      {
        _id: 'teacher-alpha',
        name: 'Teacher Alpha',
        email: 'alpha.teacher@example.com',
        totalSessions: 32,
        reportRate: 96.5,
        avgRating: 4.8,
      },
      {
        _id: 'teacher-bravo',
        name: 'Teacher Bravo',
        email: 'bravo.teacher@example.com',
        totalSessions: 18,
        reportRate: 81.2,
        avgRating: 4.1,
      },
    ],
    sales: [
      {
        _id: 'sale-alpha',
        name: 'Sale Alpha',
        email: 'alpha.sale@example.com',
        totalLeads: 42,
        convertedLeads: 16,
        conversionRate: 38.1,
        revenue: 54_000_000,
        commission: 5_400_000,
      },
      {
        _id: 'sale-bravo',
        name: 'Sale Bravo',
        email: 'bravo.sale@example.com',
        totalLeads: 27,
        convertedLeads: 11,
        conversionRate: 40.7,
        revenue: 38_500_000,
        commission: 3_850_000,
      },
    ],
    ops: [
      {
        _id: 'ops-alpha',
        name: 'Ops Alpha',
        email: 'alpha.ops@example.com',
        totalTickets: 64,
        resolvedTickets: 58,
        resolutionRate: 90.6,
      },
      {
        _id: 'ops-delta',
        name: 'Ops Delta',
        email: 'delta.ops@example.com',
        totalTickets: 23,
        resolvedTickets: 19,
        resolutionRate: 82.6,
      },
    ],
  };
}

function minimalDashboard(bankBalance = 0, fundBalance = 0, unreconciledItems = 0): any {
  return {
    cashPosition: {
      bankBalance,
      bankAccountCount: bankBalance > 0 ? 1 : 0,
      fundBalance,
      fundCount: fundBalance > 0 ? 1 : 0,
      marketingFund: fundBalance,
      marketingFundCount: fundBalance > 0 ? 1 : 0,
      availableCash: bankBalance + fundBalance,
    },
    obligations: {
      payrollPayable: 0,
      payrollPayableCount: 0,
      expensePayable: 0,
      expensePayableCount: 0,
      orderPayable: 0,
      orderPayableCount: 0,
      totalPayable14Days: 0,
      operatingReserve3Months: 0,
      burnRate: 0,
      runway: 0,
      reserveHealthy: true,
      cashAfterObligations: bankBalance + fundBalance,
    },
    deferredRevenue: {
      walletBalance: 0,
      walletCount: 0,
      pendingInvoiceAmount: 0,
      pendingInvoiceCount: 0,
    },
    metrics: {
      burnRate: 0,
      runway: 0,
      currentRatio: 0,
      grossMargin: 0,
      netMargin: 0,
      grossProfit: 0,
      netProfit: 0,
      revenueGrowth: 0,
      thisMonthRevenue: 0,
      lastMonthRevenue: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
      deferredRevenue: 0,
    },
    debtPosition: {
      totalDebt: 0,
      activeLoanCount: 0,
      loanPayable: 0,
      loanPayableCount: 0,
    },
    fundWarnings: unreconciledItems > 0 ? [] : [],
  };
}

function reconciliationReport(financial: DirectorWorkflowState['financial']): any {
  const bankBalance = financial.bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
  const fundBalance = financial.funds.reduce((sum, fund) => sum + fund.currentBalance, 0);
  const unreconciledItems = financial.bankTransactions.filter((tx) => !tx.isReconciled).length;
  return {
    healthIndicators: {
      bankBalance,
      fundBalance,
      walletLiability: 0,
      loanDebt: 0,
      netPosition: bankBalance + fundBalance,
      unreconciledItems,
      fundWarnings: financial.funds.filter((fund) => fund.currentBalance < fund.minimumBalance).length,
    },
    bankAccounts: {
      accountCount: financial.bankAccounts.length,
    },
    funds: {
      fundCount: financial.funds.length,
    },
    loanSummary: {
      activeLoanCount: 0,
    },
    profitAndLoss: {
      grossProfit: 0,
      grossMargin: 0,
      netProfit: 0,
      netMargin: 0,
    },
  };
}

function provisionalGrossProfitReport(month: string): any {
  if (month === '2026-03') {
    return {
      period: { month: 3, year: 2026, startDate: '2026-03-01', endDate: '2026-03-31' },
      cashInflow: { approvedInvoiceAmount: 7_200_000, approvedInvoiceCount: 4 },
      provisional: { revenueAmount: 6_100_000, teacherPayoutAmount: 2_200_000, attendanceCount: 18 },
      grossProfitAmount: 3_900_000,
    };
  }

  return {
    period: { month: 4, year: 2026, startDate: '2026-04-01', endDate: '2026-04-30' },
    cashInflow: { approvedInvoiceAmount: 6_800_000, approvedInvoiceCount: 5 },
    provisional: { revenueAmount: 5_600_000, teacherPayoutAmount: 2_100_000, attendanceCount: 16 },
    grossProfitAmount: 3_500_000,
  };
}

function cashFlowReport(groupBy: string): any {
  if (groupBy === 'day') {
    return {
      totalInflow: 4_500_000,
      totalOutflow: 1_700_000,
      netCashFlow: 2_800_000,
      timeline: [
        {
          date: '2026-04-10',
          inflow: {
            invoices: 2_500_000,
            invoiceCount: 2,
            sessionRevenue: 800_000,
            sessionCount: 4,
            walletTopUps: 900_000,
            walletTopUpCount: 2,
            loanDisbursements: 300_000,
            loanDisbursementCount: 1,
          },
          outflow: {
            payroll: 700_000,
            payrollCount: 1,
            expenses: 500_000,
            expenseCount: 1,
            adCost: 300_000,
            adCostCount: 1,
            loanRepayments: 200_000,
            loanRepaymentCount: 1,
          },
          totalInflow: 4_500_000,
          totalOutflow: 1_700_000,
          netCashFlow: 2_800_000,
        },
      ],
      basis: {
        requested: 'cash',
        applied: 'cash',
        totalInflow: 'cash',
        totalOutflow: 'cash',
      },
      accrualReference: {
        sessionRevenue: 800_000,
        teacherCost: 350_000,
        serviceMargin: 450_000,
      },
      period: {
        startDate: '2026-04-10',
        endDate: '2026-04-10',
        groupBy: 'day',
      },
    };
  }

  return {
    totalInflow: 9_000_000,
    totalOutflow: 2_800_000,
    netCashFlow: 6_200_000,
    timeline: [
      {
        date: '2026-04',
        totalInflow: 9_000_000,
        totalOutflow: 2_800_000,
        netCashFlow: 6_200_000,
      },
    ],
    basis: {
      requested: 'cash',
      applied: 'cash',
      totalInflow: 'cash',
      totalOutflow: 'cash',
    },
    accrualReference: {
      sessionRevenue: 2_100_000,
      teacherCost: 950_000,
      serviceMargin: 1_150_000,
    },
    period: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      groupBy: 'month',
    },
  };
}

function profitAndLossReport(basis: 'cash' | 'accrual'): any {
  if (basis === 'accrual') {
    return {
      period: {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
      basis: {
        selected: 'accrual',
        default: 'cash',
        supported: ['cash', 'accrual'],
      },
      revenue: {
        total: 5_800_000,
        sessionRevenue: 2_600_000,
        sessionCount: 11,
        byInvoiceType: {
          COURSE: { count: 3, amount: 4_200_000 },
          TRIAL: { count: 2, amount: 1_600_000 },
        },
      },
      costs: {
        teacherCost: 1_200_000,
        payrollCost: 1_500_000,
        operatingExpenses: 0,
        expenseByCategory: {
          MARKETING: { count: 1, amount: 350_000 },
          OPERATIONS: { count: 1, amount: 450_000 },
        },
        adCost: 300_000,
        adCostByPlatform: {
          FACEBOOK: { count: 1, amount: 300_000 },
        },
        totalCosts: 2_600_000,
      },
      summary: {
        basis: 'accrual',
        grossProfit: 4_600_000,
        grossMargin: 79.31,
        netProfit: 3_200_000,
        netMargin: 55.17,
      },
    };
  }

  return {
    period: {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    },
    basis: {
      selected: 'cash',
      default: 'cash',
      supported: ['cash', 'accrual'],
    },
    revenue: {
      total: 5_400_000,
      sessionRevenue: 2_100_000,
      sessionCount: 9,
      byInvoiceType: {
        COURSE: { count: 3, amount: 4_800_000 },
        TRIAL: { count: 2, amount: 600_000 },
      },
    },
    costs: {
      teacherCost: 950_000,
      payrollCost: 1_500_000,
      operatingExpenses: 0,
      expenseByCategory: {
        MARKETING: { count: 1, amount: 250_000 },
        OPERATIONS: { count: 1, amount: 450_000 },
      },
      adCost: 300_000,
      adCostByPlatform: {
        FACEBOOK: { count: 1, amount: 300_000 },
      },
      totalCosts: 2_500_000,
    },
    summary: {
      basis: 'cash',
      grossProfit: 4_450_000,
      grossMargin: 82.41,
      netProfit: 2_900_000,
      netMargin: 53.7,
    },
  };
}

function financialAlertsReport(): any {
  return {
    totalAlerts: 3,
    criticalCount: 1,
    warningCount: 1,
    infoCount: 1,
    marketingBudget: {
      fundBalance: 1_400_000,
      optimalDailyBudget: 250_000,
      optimalMonthlyBudget: 1_800_000,
      groupBreakdown: [
        {
          adGroupId: 'adg-001',
          adGroupName: 'Prospecting QA',
          platform: 'FACEBOOK',
          currentDailySpend: 120_000,
          optimalDailySpend: 180_000,
          changePercent: 50,
          confidence: 'HIGH',
          reason: 'Cost per order below target and volume still scalable.',
        },
      ],
    },
    alerts: [
      {
        id: 'alert-critical-1',
        severity: 'CRITICAL',
        category: 'FUND',
        title: 'Quy Marketing duoi nguong toi thieu',
        message: 'Can nap quy ngay de khong gian doan ngan sach QC.',
        data: { fundType: 'MARKETING' },
        actions: [
          {
            label: 'Nap quy Marketing',
            type: 'FUND_DEPOSIT',
            target: 'MARKETING',
            amount: 500_000,
          },
        ],
      },
      {
        id: 'alert-warning-1',
        severity: 'WARNING',
        category: 'RECONCILIATION',
        title: 'Con giao dich chua doi soat',
        message: 'Can xem chi tiet doi soat de dong so lieu cuoi ngay.',
        data: { unreconciledItems: 1 },
        actions: [
          {
            label: 'Xem chi tiet doi soat',
            type: 'NAVIGATE',
            target: '/financial-control?tab=reconciliation',
          },
        ],
      },
      {
        id: 'alert-info-1',
        severity: 'INFO',
        category: 'CASHFLOW',
        title: 'Dong tien duong trong ky',
        message: 'Dong tien rong dang duong va khong can can thiep them.',
        data: { netCashFlow: 6_200_000 },
        actions: [{ label: 'Thong tin dong tien', type: 'INFO' }],
      },
    ],
  };
}

function createAnalyticsState(): AnalyticsState {
  return {
    groups: [
      {
        _id: 'group-alpha',
        groupCode: 'AG-ALPHA',
        name: 'Alpha Social',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        platformCampaignId: 'cmp-alpha',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        _id: 'group-bravo',
        groupCode: 'AG-BRAVO',
        name: 'Bravo Search',
        adAccountId: 'acc-2',
        platform: 'GOOGLE',
        platformCampaignId: 'cmp-bravo',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      {
        _id: 'group-charlie',
        groupCode: 'AG-CHARLIE',
        name: 'Charlie Retargeting',
        adAccountId: 'acc-3',
        platform: 'TIKTOK',
        platformCampaignId: 'cmp-charlie',
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    analyticsRows: [
      {
        _filterDate: '2026-04-02',
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        totalSpend: 1_200_000,
        totalImpressions: 52_000,
        totalClicks: 1_300,
        totalConversions: 42,
        leadCount: 30,
        orderCount: 10,
        revenue: 7_200_000,
        costPerLead: 40_000,
        costPerOrder: 120_000,
        netProfit: 3_800_000,
        roi: 180,
      },
      {
        _filterDate: '2026-03-18',
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        totalSpend: 3_100_000,
        totalImpressions: 76_000,
        totalClicks: 2_400,
        totalConversions: 95,
        leadCount: 55,
        orderCount: 18,
        revenue: 8_900_000,
        costPerLead: 56_364,
        costPerOrder: 172_222,
        netProfit: 1_400_000,
        roi: 45,
      },
      {
        _filterDate: '2026-03-25',
        adGroupId: 'group-charlie',
        adGroupName: 'Charlie Retargeting',
        platform: 'TIKTOK',
        totalSpend: 2_400_000,
        totalImpressions: 48_000,
        totalClicks: 900,
        totalConversions: 27,
        leadCount: 20,
        orderCount: 4,
        revenue: 2_100_000,
        costPerLead: 120_000,
        costPerOrder: 600_000,
        netProfit: -300_000,
        roi: -12,
      },
    ],
    realizedRows: [
      {
        date: '2026-04-02',
        realizedThrough: '2026-04-10',
        maturityDays: 60,
        cohortAgeDays: 62,
        isMatured: true,
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        impressions: 52_000,
        clicks: 1_300,
        conversions: 42,
        ctr: 2.5,
        cpc: 923,
        cpm: 23_077,
        costPerConversion: 28_571,
        leadCount: 30,
        orderCount: 10,
        newParentCount: 8,
        realizedParentCount: 7,
        realizedSessionCount: 30,
        adSpend: 1_200_000,
        collectedRevenue: 7_200_000,
        remainingSessionUnits: 28,
        scheduledRemainingSessionCount: 7,
        scheduledRemainingTeacherCost: 950_000,
        realizedRevenue: 6_000_000,
        refundAmount: 80_000,
        netRealizedRevenue: 5_920_000,
        estimatedRemainingRefund: 50_000,
        estimatedRemainingTeacherCost: 180_000,
        estimatedRemainingOtherCost: 90_000,
        projectedRevenue: 6_600_000,
        projectedNetProfit: 4_000_000,
        effectiveNetProfit: 3_800_000,
        projectionBasis: 'REALIZED_PLUS_PROJECTED',
        teacherCost: 950_000,
        directParentExpense: 120_000,
        allocatedGroupExpense: 200_000,
        allocatedGlobalOverhead: 100_000,
        netProfit: 3_800_000,
        roi: 180,
        costPerLead: 40_000,
        costPerNewParent: 150_000,
        profitPerLead: 126_667,
        profitPerNewParent: 475_000,
      },
      {
        date: '2026-03-18',
        realizedThrough: '2026-04-10',
        maturityDays: 45,
        cohortAgeDays: 23,
        isMatured: false,
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        impressions: 76_000,
        clicks: 2_400,
        conversions: 95,
        ctr: 3.1,
        cpc: 1_292,
        cpm: 40_789,
        costPerConversion: 32_632,
        leadCount: 55,
        orderCount: 18,
        newParentCount: 14,
        realizedParentCount: 11,
        realizedSessionCount: 44,
        adSpend: 3_100_000,
        collectedRevenue: 8_900_000,
        remainingSessionUnits: 36,
        scheduledRemainingSessionCount: 9,
        scheduledRemainingTeacherCost: 1_400_000,
        realizedRevenue: 7_200_000,
        refundAmount: 220_000,
        netRealizedRevenue: 6_980_000,
        estimatedRemainingRefund: 175_000,
        estimatedRemainingTeacherCost: 260_000,
        estimatedRemainingOtherCost: 150_000,
        projectedRevenue: 8_050_000,
        projectedNetProfit: 1_650_000,
        effectiveNetProfit: 1_400_000,
        projectionBasis: 'REALIZED_PLUS_PROJECTED',
        teacherCost: 1_400_000,
        directParentExpense: 180_000,
        allocatedGroupExpense: 260_000,
        allocatedGlobalOverhead: 120_000,
        netProfit: 1_400_000,
        roi: 45,
        costPerLead: 56_364,
        costPerNewParent: 221_429,
        profitPerLead: 25_455,
        profitPerNewParent: 100_000,
      },
      {
        date: '2026-03-25',
        realizedThrough: '2026-04-10',
        maturityDays: 60,
        cohortAgeDays: 16,
        isMatured: false,
        adGroupId: 'group-charlie',
        adGroupName: 'Charlie Retargeting',
        platform: 'TIKTOK',
        impressions: 48_000,
        clicks: 900,
        conversions: 27,
        ctr: 1.9,
        cpc: 2_667,
        cpm: 50_000,
        costPerConversion: 88_889,
        leadCount: 20,
        orderCount: 4,
        newParentCount: 3,
        realizedParentCount: 2,
        realizedSessionCount: 9,
        adSpend: 2_400_000,
        collectedRevenue: 2_100_000,
        remainingSessionUnits: 11,
        scheduledRemainingSessionCount: 3,
        scheduledRemainingTeacherCost: 420_000,
        realizedRevenue: 1_850_000,
        refundAmount: 120_000,
        netRealizedRevenue: 1_730_000,
        estimatedRemainingRefund: 110_000,
        estimatedRemainingTeacherCost: 220_000,
        estimatedRemainingOtherCost: 90_000,
        projectedRevenue: 2_000_000,
        projectedNetProfit: 40_000,
        effectiveNetProfit: 40_000,
        projectionBasis: 'REALIZED_PLUS_PROJECTED',
        teacherCost: 420_000,
        directParentExpense: 80_000,
        allocatedGroupExpense: 140_000,
        allocatedGlobalOverhead: 80_000,
        netProfit: 40_000,
        roi: 2.1,
        costPerLead: 120_000,
        costPerNewParent: 800_000,
        profitPerLead: 2_000,
        profitPerNewParent: 13_333,
      },
    ],
    parentProfitRows: [
      {
        parentId: 'parent-001',
        parentName: 'Nguyen Mai',
        attributedAt: '2026-03-20T00:00:00.000Z',
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        studentCount: 1,
        sessionCount: 12,
        revenue: 4_500_000,
        teacherCost: 1_200_000,
        directParentExpense: 80_000,
        allocatedGroupExpense: 120_000,
        allocatedGlobalOverhead: 60_000,
        allocatedAdSpend: 450_000,
        netProfit: 2_590_000,
        netMargin: 57.6,
      },
      {
        parentId: 'parent-002',
        parentName: 'Tran Huy',
        attributedAt: '2026-04-03T00:00:00.000Z',
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        platform: 'FACEBOOK',
        studentCount: 2,
        sessionCount: 16,
        revenue: 6_800_000,
        teacherCost: 1_850_000,
        directParentExpense: 120_000,
        allocatedGroupExpense: 180_000,
        allocatedGlobalOverhead: 100_000,
        allocatedAdSpend: 600_000,
        netProfit: 3_950_000,
        netMargin: 58.1,
      },
    ],
    captured: {
      analytics: [],
      realized: [],
      parents: [],
      suggestions: [],
    },
  };
}

function summarizeAnalytics(rows: AnalyticsSeedRow[]): any {
  const totalSpend = rows.reduce((sum, row) => sum + row.totalSpend, 0);
  const totalLeads = rows.reduce((sum, row) => sum + row.leadCount, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orderCount, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalNetProfit = rows.reduce((sum, row) => sum + row.netProfit, 0);
  return {
    totalSpend,
    totalLeads,
    totalOrders,
    totalRevenue,
    totalNetProfit,
    avgCostPerLead: totalLeads ? Math.round(totalSpend / totalLeads) : 0,
    avgCostPerOrder: totalOrders ? Math.round(totalSpend / totalOrders) : 0,
    avgRoi: totalSpend ? Math.round((totalNetProfit / totalSpend) * 100) : 0,
  };
}

function buildAnalyticsResponse(url: URL, state: AnalyticsState): any {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const platform = url.searchParams.get('platform');
  const adGroupId = url.searchParams.get('adGroupId');

  const rows = state.analyticsRows
    .filter((row) => inDateRange(row._filterDate, startDate, endDate))
    .filter((row) => !platform || row.platform === platform)
    .filter((row) => !adGroupId || row.adGroupId === adGroupId)
    .map(({ _filterDate, ...row }) => row);

  return {
    rows,
    summary: summarizeAnalytics(rows as AnalyticsSeedRow[]),
  };
}

function summarizeRealized(rows: any[]): any {
  return {
    totalSpend: rows.reduce((sum, row) => sum + row.adSpend, 0),
    totalImpressions: rows.reduce((sum, row) => sum + row.impressions, 0),
    totalClicks: rows.reduce((sum, row) => sum + row.clicks, 0),
    totalConversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    totalLeads: rows.reduce((sum, row) => sum + row.leadCount, 0),
    totalOrders: rows.reduce((sum, row) => sum + row.orderCount, 0),
    totalNewParents: rows.reduce((sum, row) => sum + row.newParentCount, 0),
    totalCollectedRevenue: rows.reduce((sum, row) => sum + row.collectedRevenue, 0),
    totalRemainingSessionUnits: rows.reduce((sum, row) => sum + row.remainingSessionUnits, 0),
    totalRealizedParents: rows.reduce((sum, row) => sum + row.realizedParentCount, 0),
    totalRealizedSessions: rows.reduce((sum, row) => sum + row.realizedSessionCount, 0),
    totalRealizedRevenue: rows.reduce((sum, row) => sum + row.realizedRevenue, 0),
    totalRefundAmount: rows.reduce((sum, row) => sum + row.refundAmount, 0),
    totalNetRealizedRevenue: rows.reduce((sum, row) => sum + row.netRealizedRevenue, 0),
    totalProjectedRevenue: rows.reduce((sum, row) => sum + row.projectedRevenue, 0),
    totalTeacherCost: rows.reduce((sum, row) => sum + row.teacherCost, 0),
    totalDirectParentExpense: rows.reduce((sum, row) => sum + row.directParentExpense, 0),
    totalAllocatedGroupExpense: rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0),
    totalAllocatedGlobalOverhead: rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0),
    totalNetProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
    totalProjectedNetProfit: rows.reduce((sum, row) => sum + row.projectedNetProfit, 0),
    totalRoi: rows.length ? Number((rows.reduce((sum, row) => sum + row.roi, 0) / rows.length).toFixed(1)) : 0,
    matureRowCount: rows.filter((row) => row.isMatured).length,
    immatureRowCount: rows.filter((row) => !row.isMatured).length,
  };
}

function buildRealizedResponse(url: URL, state: AnalyticsState): any {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const platform = url.searchParams.get('platform');
  const adGroupId = url.searchParams.get('adGroupId');
  const maturityDays = Number(url.searchParams.get('maturityDays') || '60');
  const refundRatePercentXValue = url.searchParams.get('refundRatePercentX');
  const refundRatePercentX = refundRatePercentXValue === null ? null : Number(refundRatePercentXValue);

  const rows = state.realizedRows
    .filter((row) => inDateRange(row.date, startDate, endDate))
    .filter((row) => !platform || row.platform === platform)
    .filter((row) => !adGroupId || row.adGroupId === adGroupId)
    .map((row) => ({ ...row, maturityDays }));

  return {
    basis: 'REALIZED_PLUS_PROJECTED',
    maturityDays,
    realizedThrough: endDate || RUN_DATE,
    refundRatePercentX,
    rows,
    matureRows: rows.filter((row) => row.isMatured),
    summary: summarizeRealized(rows),
  };
}

function buildParentProfitResponse(url: URL, state: AnalyticsState): any {
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const platform = url.searchParams.get('platform');
  const adGroupId = url.searchParams.get('adGroupId');

  const rows = state.parentProfitRows
    .filter((row) => inDateRange(toDateOnly(row.attributedAt), startDate, endDate))
    .filter((row) => !platform || row.platform === platform)
    .filter((row) => !adGroupId || row.adGroupId === adGroupId);

  const grouped = new Map<string, any>();
  for (const row of rows) {
    const existing = grouped.get(row.adGroupId);
    if (!existing) {
      grouped.set(row.adGroupId, {
        adGroupId: row.adGroupId,
        adGroupName: row.adGroupName,
        platform: row.platform,
        parentCount: 1,
        totalSessions: row.sessionCount,
        totalStudents: row.studentCount,
        totalRevenue: row.revenue,
        totalTeacherCost: row.teacherCost,
        totalDirectParentExpense: row.directParentExpense,
        totalAllocatedGroupExpense: row.allocatedGroupExpense,
        totalAllocatedGlobalOverhead: row.allocatedGlobalOverhead,
        totalAdSpend: row.allocatedAdSpend,
        totalNetProfit: row.netProfit,
        netMargin: row.netMargin,
      });
      continue;
    }

    existing.parentCount += 1;
    existing.totalSessions += row.sessionCount;
    existing.totalStudents += row.studentCount;
    existing.totalRevenue += row.revenue;
    existing.totalTeacherCost += row.teacherCost;
    existing.totalDirectParentExpense += row.directParentExpense;
    existing.totalAllocatedGroupExpense += row.allocatedGroupExpense;
    existing.totalAllocatedGlobalOverhead += row.allocatedGlobalOverhead;
    existing.totalAdSpend += row.allocatedAdSpend;
    existing.totalNetProfit += row.netProfit;
    existing.netMargin = Number(((existing.totalNetProfit / Math.max(existing.totalRevenue, 1)) * 100).toFixed(1));
  }

  const summaryByGroup = Array.from(grouped.values());
  const overall = {
    parentCount: rows.length,
    totalSessions: rows.reduce((sum, row) => sum + row.sessionCount, 0),
    totalStudents: rows.reduce((sum, row) => sum + row.studentCount, 0),
    totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    totalTeacherCost: rows.reduce((sum, row) => sum + row.teacherCost, 0),
    totalDirectParentExpense: rows.reduce((sum, row) => sum + row.directParentExpense, 0),
    totalAllocatedGroupExpense: rows.reduce((sum, row) => sum + row.allocatedGroupExpense, 0),
    totalAllocatedGlobalOverhead: rows.reduce((sum, row) => sum + row.allocatedGlobalOverhead, 0),
    totalAdSpend: rows.reduce((sum, row) => sum + row.allocatedAdSpend, 0),
    totalNetProfit: rows.reduce((sum, row) => sum + row.netProfit, 0),
    netMargin: rows.length
      ? Number(((rows.reduce((sum, row) => sum + row.netProfit, 0) / Math.max(rows.reduce((sum, row) => sum + row.revenue, 0), 1)) * 100).toFixed(1))
      : 0,
  };

  return { rows, summaryByGroup, overall };
}

function buildSuggestionResponse(url: URL, state: AnalyticsState): any {
  const maturityDays = Number(url.searchParams.get('maturityDays') || '60');
  const refundRatePercentX = Number(url.searchParams.get('refundRatePercentX') || '0');
  const totalBudget = Number(url.searchParams.get('totalBudget') || '0');
  const bravo = state.realizedRows.find((row) => row.adGroupId === 'group-bravo') || state.realizedRows[0];
  return {
    basis: 'REALIZED_PLUS_PROJECTED',
    maturityDays,
    realizedThrough: url.searchParams.get('endDate') || RUN_DATE,
    refundRatePercentX,
    totalBudget,
    allocated: 1_800_000,
    unallocated: Math.max(totalBudget - 1_800_000, 0),
    totalSuggestedDailySpend: 1_800_000,
    expectedDailyNetProfit: 540_000,
    projectedMonthlySpend: 54_000_000,
    projectedMonthlyNetProfit: 16_200_000,
    dailySuggestedTotals: [
      {
        date: url.searchParams.get('startDate') || '2026-03-01',
        totalNetProfit: 540_000,
        totalSuggestedAdSpend: 1_800_000,
      },
    ],
    monthlyProjection: [
      {
        month: '2026-03',
        daysInMonth: 31,
        projectedSpend: 54_000_000,
        projectedNetProfit: 16_200_000,
      },
    ],
    summaryTable: [
      {
        ...bravo,
        date: bravo.date,
        actualAdSpend: bravo.adSpend,
        suggestedAdSpend: 1_800_000,
      },
    ],
    suggestions: [
      {
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        platform: 'GOOGLE',
        currentDailySpend: 1_200_000,
        suggestedDailySpend: 1_800_000,
        changePercent: 50,
        averageCtr: 3.1,
        averageLeadRate: 6.4,
        averageProfitPerLead: 25_455,
        observedAverageNetProfit: 1_400_000,
        confidence: 'HIGH',
        action: 'ADJUST_BUDGET',
        reason: 'Bravo Search dang co cohort co loi nhuan duong va co the tang ngan sach.',
      },
    ],
  };
}

function buildDirectorWorkflowState(): DirectorWorkflowState {
  throw new Error('Legacy director workflow state should not be used in Ads Manager video.');
}

type AdsState = {
  accounts: any[];
  groups: any[];
  costs: any[];
  actionsResponse: {
    summary: Record<string, unknown>;
    actions: any[];
  };
  actionRequestUrls: string[];
};

type Fanpage = {
  _id: string;
  fanpageCode: string;
  name: string;
  platform: string;
  pageId: string;
  description?: string;
  syncSource?: string;
  businessId?: string;
  businessName?: string;
  syncTokenLabel?: string;
  lastSyncedAt?: string;
  adAccountId?: string;
  openaiTokenId?: string;
  webhookVerifyToken?: string;
  status: string;
  aiAutoReplyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type FanpagePayload = {
  name: string;
  platform: string;
  pageId: string;
  pageAccessToken?: string;
  description?: string;
  adAccountId?: string;
  openaiTokenId?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
  aiAutoReplyEnabled: boolean;
  status: string;
};

type ChatbotSettingsState = {
  fanpages: Fanpage[];
  tokens: any[];
  aiProfiles: any[];
  adAccounts: any[];
  fanpageListRequests: string[];
  updateFanpageCalls: Array<{ fanpageId: string; payload: FanpagePayload }>;
};

type AdsManagerWorkflowState = {
  user: any;
  loginBodies: Array<{ email: string; password: string }>;
  ads: AdsState;
  analytics: AnalyticsState;
  chatbot: ChatbotSettingsState;
};

function funnelTable(page: Page): Locator {
  return page.locator('table.data').filter({ hasText: 'CP/Lead' }).first();
}

function platformSelect(page: Page): Locator {
  return page.locator('section.filters select').filter({ has: page.locator('option[value="FACEBOOK"]') }).first();
}

function adGroupSelect(page: Page): Locator {
  return page.locator('section.filters select').filter({ hasText: /Alpha Social|Bravo Search|Charlie Retargeting/ }).first();
}

function paginated<T>(rows: T[]) {
  return {
    data: rows,
    total: rows.length,
    page: 1,
    limit: Math.max(rows.length, 1),
  };
}

function field(modal: Locator, labelText: RegExp, selector = 'input,textarea,select'): Locator {
  return modal.locator('label').filter({ hasText: labelText }).locator(selector).first();
}

function rowByText(scope: Page | Locator, text: string): Locator {
  return scope.locator('tr').filter({ hasText: text }).first();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAdsManagerDailyTasksPayload(): any {
  return {
    role: 'ADSMANAGER',
    generatedAt: '2026-04-12T08:00:00.000Z',
    summary: {
      totalTasks: 4,
      overdueTasks: 1,
      dueTodayTasks: 3,
      highPriorityTasks: 2,
    },
    tabs: [
      {
        key: 'focus',
        label: 'Focus dau ngay',
        description: 'Bat dau bang viec doc action card va chot nhom can xu ly truoc.',
        emptyMessage: 'Khong co viec focus dau ngay.',
        count: 2,
        tasks: [
          {
            id: 'ads-task-001',
            type: 'CHECK_ACTIONS',
            title: 'Mo tab Viec can lam va doc nhom dang lo',
            detail: 'Uu tien xem action card critical truoc khi sua budget.',
            meta: ['Ads management', 'ROI am'],
            priority: 'HIGH',
            dueAt: '2026-04-12T09:00:00.000Z',
            route: '/app/ads-management',
            queryParams: { tab: 'actions' },
            actionLabel: 'Mo viec can lam',
            overdue: false,
          },
          {
            id: 'ads-task-002',
            type: 'CHECK_GROUPS',
            title: 'Rao soat group Alpha Social va Bravo Search',
            detail: 'Cap nhat tracking key va ghi chu neu can doi target.',
            meta: ['Nhom QC', 'Budget'],
            priority: 'MEDIUM',
            dueAt: '2026-04-12T10:00:00.000Z',
            route: '/app/ads-management',
            queryParams: { tab: 'groups' },
            actionLabel: 'Mo nhom QC',
            overdue: false,
          },
        ],
      },
      {
        key: 'profit',
        label: 'Phan tich loi nhuan',
        description: 'Doi chieu ads spend voi cohort va parent profit truoc khi de xuat thay doi.',
        emptyMessage: 'Khong co viec phan tich dang mo.',
        count: 1,
        tasks: [
          {
            id: 'ads-task-003',
            type: 'ANALYZE_PROFIT',
            title: 'Doc parent profit cua nhom Bravo Search',
            detail: 'Xac nhan nhom van co lai truoc khi tang ngan sach.',
            meta: ['Ads analytics', 'Parent profit'],
            priority: 'CRITICAL',
            dueAt: '2026-04-12T11:00:00.000Z',
            route: '/app/ads-analytics',
            actionLabel: 'Mo ads analytics',
            overdue: true,
          },
        ],
      },
      {
        key: 'chatbot',
        label: 'Fanpage va chatbot',
        description: 'Kiem tra token dang gan va AI auto reply tren fanpage lead care.',
        emptyMessage: 'Khong co fanpage can theo doi.',
        count: 1,
        tasks: [
          {
            id: 'ads-task-004',
            type: 'CHECK_CHATBOT',
            title: 'Doi chieu fanpage Ads Lead Intake',
            detail: 'Xem mo ta, webhook va AI auto reply co khop campaign hien tai hay khong.',
            meta: ['Chatbot settings', 'Lead care'],
            priority: 'HIGH',
            dueAt: '2026-04-12T15:00:00.000Z',
            route: '/app/chatbot-settings',
            actionLabel: 'Mo chatbot settings',
            overdue: false,
          },
        ],
      },
    ],
  };
}
function createAdsManagerAdsState(): AdsState {
  return {
    accounts: [
      {
        _id: 'acc-1',
        accountCode: 'ACC-001',
        name: 'Facebook Cohort Alpha',
        platform: 'FACEBOOK',
        platformAccountId: 'act_001',
        businessId: 'bm-001',
        businessName: 'Alpha BM',
        monthlyBudget: 25_000_000,
        syncSource: 'FACEBOOK_BM',
        status: 'ACTIVE',
        lastSyncedAt: nowIso(-30),
        createdAt: nowIso(-720),
        updatedAt: nowIso(-30),
      },
      {
        _id: 'acc-2',
        accountCode: 'ACC-002',
        name: 'Google Search Bravo',
        platform: 'GOOGLE',
        platformAccountId: 'gg_002',
        businessId: 'mcc-001',
        businessName: 'Bravo MCC',
        monthlyBudget: 32_000_000,
        syncSource: 'GOOGLE_MCC',
        status: 'ACTIVE',
        lastSyncedAt: nowIso(-45),
        createdAt: nowIso(-720),
        updatedAt: nowIso(-45),
      },
      {
        _id: 'acc-3',
        accountCode: 'ACC-003',
        name: 'TikTok Retargeting Charlie',
        platform: 'TIKTOK',
        platformAccountId: 'tt_003',
        businessId: 'bc-001',
        businessName: 'Charlie BC',
        monthlyBudget: 18_000_000,
        syncSource: 'TIKTOK_BC',
        status: 'ACTIVE',
        lastSyncedAt: nowIso(-55),
        createdAt: nowIso(-720),
        updatedAt: nowIso(-55),
      },
    ],
    groups: [
      {
        _id: 'group-alpha',
        groupCode: 'AG-ALPHA',
        name: 'Alpha Social',
        adAccountId: 'acc-1',
        adAccountName: 'Facebook Cohort Alpha',
        platform: 'FACEBOOK',
        platformCampaignId: 'cmp-alpha',
        trackingKeys: ['utm_campaign=alpha', 'ref=lead-form-alpha'],
        status: 'ACTIVE',
        dailyBudget: 850_000,
        startDate: '2026-04-01',
        endDate: '',
        targetAudience: 'Parents with grade 6-9 children',
        notes: 'Keep monitoring blended lead quality.',
        createdAt: nowIso(-720),
        updatedAt: nowIso(-30),
      },
      {
        _id: 'group-bravo',
        groupCode: 'AG-BRAVO',
        name: 'Bravo Search',
        adAccountId: 'acc-2',
        adAccountName: 'Google Search Bravo',
        platform: 'GOOGLE',
        platformCampaignId: 'cmp-bravo',
        trackingKeys: ['utm_campaign=bravo-search'],
        status: 'ACTIVE',
        dailyBudget: 1_200_000,
        startDate: '2026-03-20',
        endDate: '',
        targetAudience: 'Trial registration intent',
        notes: 'Search term quality is stable.',
        createdAt: nowIso(-720),
        updatedAt: nowIso(-45),
      },
      {
        _id: 'group-charlie',
        groupCode: 'AG-CHARLIE',
        name: 'Charlie Retargeting',
        adAccountId: 'acc-3',
        adAccountName: 'TikTok Retargeting Charlie',
        platform: 'TIKTOK',
        platformCampaignId: 'cmp-charlie',
        trackingKeys: ['utm_campaign=charlie-retarget'],
        status: 'PAUSED',
        dailyBudget: 480_000,
        startDate: '2026-03-25',
        endDate: '',
        targetAudience: 'Warm audience 30 days',
        notes: 'Paused after low margin streak.',
        createdAt: nowIso(-720),
        updatedAt: nowIso(-60),
      },
    ],
    costs: [
      {
        _id: 'cost-001',
        adGroupId: 'group-alpha',
        adGroupName: 'Alpha Social',
        adAccountId: 'acc-1',
        platform: 'FACEBOOK',
        date: '2026-04-12',
        spend: 1_150_000,
        impressions: 52_400,
        clicks: 1_320,
        conversions: 43,
        source: 'FACEBOOK_BM',
        syncedAt: nowIso(-30),
        createdAt: nowIso(-30),
      },
      {
        _id: 'cost-002',
        adGroupId: 'group-bravo',
        adGroupName: 'Bravo Search',
        adAccountId: 'acc-2',
        platform: 'GOOGLE',
        date: '2026-04-12',
        spend: 2_980_000,
        impressions: 75_200,
        clicks: 2_380,
        conversions: 91,
        source: 'GOOGLE_MCC',
        syncedAt: nowIso(-45),
        createdAt: nowIso(-45),
      },
    ],
    actionsResponse: {
      summary: {
        totalActiveGroups: 2,
        profitableGroups: 1,
        unprofitableGroups: 1,
        totalDailySpend: 2_050_000,
        totalOptimalDailySpend: 1_720_000,
        overallNetProfit7d: -320_000,
        overallEffectiveNetProfit: 280_000,
        generatedAt: nowIso(-5),
      },
      actions: [
        {
          type: 'PAUSE_GROUP',
          priority: 'CRITICAL',
          title: 'Tam dung hoac thu hep Charlie Retargeting',
          description: 'Nhieu ngay lien tiep nhom retargeting khong tao loi nhuan duong.',
          reasons: [
            'ROI 7 ngay am 18%',
            'Chi phi/PH moi tang nhanh hon toc do chuyen doi',
          ],
          details: {
            netProfit7Days: -320_000,
            effectiveNetProfit: -110_000,
            actualDailySpend: 480_000,
            optimalDailySpend: 220_000,
            platform: 'TIKTOK',
          },
          relatedEntity: {
            type: 'AdGroup',
            id: 'group-charlie',
            name: 'Charlie Retargeting',
          },
          estimatedImpact: {
            dailyProfitChange: 120_000,
            monthlyProfitChange: 3_600_000,
          },
        },
        {
          type: 'ADJUST_BUDGET',
          priority: 'HIGH',
          title: 'Tang budget co kiem soat cho Bravo Search',
          description: 'Nhom Search dang co cohort duong va margin on dinh.',
          reasons: [
            'Parent profit van duong sau khi phan bo chi phi ads',
            'Lead quality on dinh trong 14 ngay gan nhat',
          ],
          details: {
            currentDailySpend: 1_200_000,
            optimalDailySpendReal: 1_650_000,
            safeDailyTarget: 1_350_000,
            learningPhaseProtected: true,
            expectedDailyNetProfit: 210_000,
            platform: 'GOOGLE',
            confidence: 'HIGH',
          },
          relatedEntity: {
            type: 'AdGroup',
            id: 'group-bravo',
            name: 'Bravo Search',
          },
          estimatedImpact: {
            dailyProfitChange: 180_000,
            monthlyProfitChange: 5_400_000,
          },
        },
      ],
    },
    actionRequestUrls: [],
  };
}

function buildChatbotSettingsState(adAccounts: any[]): ChatbotSettingsState {
  const createdAt = nowIso(-240);
  return {
    fanpages: [
      {
        _id: 'fp-ads-001',
        fanpageCode: 'FP-ADS-001',
        name: 'Ads Lead Intake',
        platform: 'FACEBOOK',
        pageId: 'page-ads-lead-intake',
        description: 'Fanpage tiep nhan lead tu campaign alpha va bravo.',
        syncSource: 'MANUAL',
        businessName: '',
        syncTokenLabel: '',
        lastSyncedAt: '',
        adAccountId: 'acc-1',
        openaiTokenId: 'token-lead-1',
        webhookVerifyToken: 'verify-ads-intake',
        status: 'ACTIVE',
        aiAutoReplyEnabled: true,
        createdAt,
        updatedAt: createdAt,
      },
      {
        _id: 'fp-ads-002',
        fanpageCode: 'FP-BM-002',
        name: 'Alpha BM Synced Page',
        platform: 'FACEBOOK',
        pageId: 'page-alpha-bm',
        description: 'Fanpage dong bo BM, giu ten/page id theo lan sync gan nhat.',
        syncSource: 'FACEBOOK_BM',
        businessId: 'bm-001',
        businessName: 'Alpha BM',
        syncTokenLabel: 'Alpha BM Token',
        lastSyncedAt: nowIso(-80),
        adAccountId: 'acc-1',
        openaiTokenId: 'token-nurture-1',
        webhookVerifyToken: 'verify-alpha-bm',
        status: 'ACTIVE',
        aiAutoReplyEnabled: false,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    tokens: [
      {
        _id: 'token-lead-1',
        label: 'Lead Care Token',
        apiKey: 'sk-lead-****',
        model: 'gpt-4o',
        temperature: 0.4,
        maxTokens: 3000,
        status: 'ACTIVE',
        lastUsedAt: nowIso(-20),
        createdAt,
      },
      {
        _id: 'token-nurture-1',
        label: 'Nurture Support Token',
        apiKey: 'sk-nurture-****',
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 2000,
        status: 'ACTIVE',
        lastUsedAt: nowIso(-90),
        createdAt,
      },
    ],
    aiProfiles: [
      {
        _id: 'ai-profile-001',
        assistantType: 'LEAD_CARE',
        label: 'Lead qualification default',
        description: 'Loc thong tin lead va handoff cho sale neu can.',
        rulesPrompt: 'Tra loi ngan gon, hoi ro nhu cau hoc va luu attribution key khi phu huynh de lai thong tin.',
        defaultOpenAITokenId: 'token-lead-1',
        status: 'ACTIVE',
      },
      {
        _id: 'ai-profile-002',
        assistantType: 'PARENT_SUPPORT',
        label: 'Parent support shared',
        description: 'Dung chung cho fanpage ho tro phu huynh.',
        rulesPrompt: 'Chi tra loi cac thong tin co trong he thong, gap thay doi hoc phi hay khiu nai thi handoff.',
        defaultOpenAITokenId: 'token-nurture-1',
        status: 'ACTIVE',
      },
    ],
    adAccounts: clone(adAccounts),
    fanpageListRequests: [],
    updateFanpageCalls: [],
  };
}

function filterFanpages(state: ChatbotSettingsState, searchParams: URLSearchParams): Fanpage[] {
  const keyword = (searchParams.get('search') || '').trim().toLowerCase();
  const platform = searchParams.get('platform') || '';
  const status = searchParams.get('status') || '';

  let items = [...state.fanpages].sort((left, right) => left.fanpageCode.localeCompare(right.fanpageCode));

  if (keyword) {
    items = items.filter((fanpage) =>
      [fanpage.name, fanpage.fanpageCode, fanpage.pageId]
        .some((value) => String(value || '').toLowerCase().includes(keyword)),
    );
  }

  if (platform) {
    items = items.filter((fanpage) => fanpage.platform === platform);
  }

  if (status) {
    items = items.filter((fanpage) => fanpage.status === status);
  }

  return items;
}

function updateFanpage(state: ChatbotSettingsState, fanpageId: string, patch: Partial<Fanpage>): void {
  state.fanpages = state.fanpages
    .map((item) => (item._id === fanpageId ? { ...item, ...patch, updatedAt: nowIso() } : item))
    .sort((left, right) => left.fanpageCode.localeCompare(right.fanpageCode));
}

function buildAdsManagerWorkflowState(): AdsManagerWorkflowState {
  const ads = createAdsManagerAdsState();
  return {
    user: {
      _id: 'adsmanager-demo-user-001',
      sub: 'adsmanager-demo-user-001',
      email: 'ads.demo@school.local',
      role: 'ADSMANAGER',
      fullName: 'Ads Manager Demo',
      userCode: 'ADS001',
    },
    loginBodies: [],
    ads,
    analytics: createAnalyticsState(),
    chatbot: buildChatbotSettingsState(ads.accounts),
  };
}
class DirectorWorkflowPage {
  constructor(private readonly page: Page) {}

  async goto(routePath: string): Promise<void> {
    await this.page.goto(appUrl(routePath));
    await this.page.waitForLoadState('domcontentloaded');
  }

  async pause(ms = 2_000): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async slowFill(locator: Locator, value: string, delay = 28): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 20_000 });
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay });
  }

  async loginAsDirector(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();
    await this.slowFill(this.page.getByTestId('login-email'), 'ads.demo@school.local');
    await this.pause(500);
    await this.slowFill(this.page.getByTestId('login-password'), '123456');
    await this.pause(800);
    await clickLocator(this.page, this.page.getByTestId('login-submit'));
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }
}

async function routeAdsManagerAuthApis(page: Page, state: AdsManagerWorkflowState): Promise<void> {
  await page.route(new RegExp(`${API_PREFIX_PATTERN}/auth/login(?:\\?.*)?$`), async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    state.loginBodies.push(clone(body));
    await jsonResponse(route, { user: clone(state.user) });
  });

  await page.route(new RegExp(`${API_PREFIX_PATTERN}/auth/logout(?:\\?.*)?$`), async (route) => {
    await jsonResponse(route, { ok: true });
  });

  await page.route(new RegExp(`${API_PREFIX_PATTERN}/users/me(?:\\?.*)?$`), async (route) => {
    await jsonResponse(route, clone(state.user));
  });

  await page.route(new RegExp(`${API_PREFIX_PATTERN}/users/directory(?:\\?.*)?$`), async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(new RegExp(`${API_PREFIX_PATTERN}/notifications/unread-count(?:\\?.*)?$`), async (route) => {
    await jsonResponse(route, { count: 3 });
  });

  await page.route(new RegExp(`${API_PREFIX_PATTERN}/pending-approvals/summary(?:\\?.*)?$`), async (route) => {
    await jsonResponse(route, { totalPending: 0 });
  });

  await page.route(new RegExp(`${API_PREFIX_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`), async (route) => {
    await jsonResponse(route, createAdsManagerDailyTasksPayload());
  });
}

async function routeAdsManagerManagementApis(page: Page, state: AdsManagerWorkflowState): Promise<void> {
  await page.route(/\/ads\/accounts(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method !== 'GET') {
      await route.fulfill({ status: 405, body: 'Unsupported method' });
      return;
    }

    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const platform = url.searchParams.get('platform') || '';
    const status = url.searchParams.get('status') || '';

    let rows = [...state.ads.accounts];
    if (search) {
      rows = rows.filter((item) =>
        [item.accountCode, item.name, item.platformAccountId]
          .some((value) => String(value || '').toLowerCase().includes(search)),
      );
    }
    if (platform) {
      rows = rows.filter((item) => item.platform === platform);
    }
    if (status) {
      rows = rows.filter((item) => item.status === status);
    }

    await jsonResponse(route, paginated(rows));
  });

  await page.route(/\/ads\/groups\/all(?:\?.*)?$/, async (route) => {
    await jsonResponse(route, clone(state.ads.groups));
  });

  await page.route(/\/ads\/groups(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const groupId = url.pathname.split('/').pop() || '';

    if (method === 'GET' && /\/ads\/groups\/all$/.test(url.pathname)) {
      await jsonResponse(route, clone(state.ads.groups));
      return;
    }

    if (method === 'GET') {
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const platform = url.searchParams.get('platform') || '';
      const status = url.searchParams.get('status') || '';
      const adAccountId = url.searchParams.get('adAccountId') || '';

      let rows = [...state.ads.groups];
      if (search) {
        rows = rows.filter((item) =>
          [item.groupCode, item.name, item.platformCampaignId]
            .some((value) => String(value || '').toLowerCase().includes(search)),
        );
      }
      if (platform) {
        rows = rows.filter((item) => item.platform === platform);
      }
      if (status) {
        rows = rows.filter((item) => item.status === status);
      }
      if (adAccountId) {
        rows = rows.filter((item) => item.adAccountId === adAccountId);
      }
      await jsonResponse(route, paginated(rows));
      return;
    }

    if (method === 'PATCH') {
      const payload = request.postDataJSON() as any;
      await delay(350);
      state.ads.groups = state.ads.groups.map((item) => (
        item._id === groupId
          ? {
              ...item,
              ...payload,
              dailyBudget: Number(payload.dailyBudget ?? item.dailyBudget ?? 0),
              trackingKeys: payload.trackingKeys || item.trackingKeys || [],
              updatedAt: nowIso(),
            }
          : item
      ));
      await jsonResponse(route, { ok: true });
      return;
    }

    await route.fulfill({ status: 405, body: 'Unsupported method' });
  });

  await page.route(/\/ads\/costs(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());

    if (method !== 'GET') {
      await route.fulfill({ status: 405, body: 'Unsupported method' });
      return;
    }

    const platform = url.searchParams.get('platform') || '';
    const adGroupId = url.searchParams.get('adGroupId') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';

    let rows = [...state.ads.costs];
    if (platform) {
      rows = rows.filter((item) => item.platform === platform);
    }
    if (adGroupId) {
      rows = rows.filter((item) => item.adGroupId === adGroupId);
    }
    if (startDate) {
      rows = rows.filter((item) => String(item.date) >= startDate);
    }
    if (endDate) {
      rows = rows.filter((item) => String(item.date) <= endDate);
    }

    await jsonResponse(route, paginated(rows));
  });

  await page.route(/\/ads\/actions-required(?:\?.*)?$/, async (route) => {
    state.ads.actionRequestUrls.push(route.request().url());
    await delay(900);
    await jsonResponse(route, clone(state.ads.actionsResponse));
  });
}
async function routeAdsManagerAnalyticsApis(page: Page, state: AdsManagerWorkflowState): Promise<void> {
  await page.route(/\/ads\/analytics\/realized-cohort(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.analytics.captured.realized.push(url);
    await jsonResponse(route, buildRealizedResponse(url, state.analytics));
  });

  await page.route(/\/ads\/analytics\/parents-profit(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.analytics.captured.parents.push(url);
    await jsonResponse(route, buildParentProfitResponse(url, state.analytics));
  });

  await page.route(/\/ads\/analytics(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.analytics.captured.analytics.push(url);
    await jsonResponse(route, buildAnalyticsResponse(url, state.analytics));
  });

  await page.route(/\/ads\/suggestions(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    state.analytics.captured.suggestions.push(url);
    await jsonResponse(route, buildSuggestionResponse(url, state.analytics));
  });
}

async function routeAdsManagerChatbotApis(page: Page, state: AdsManagerWorkflowState): Promise<void> {
  await page.route(/\/chatbot\/fanpages(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const fanpageMatch = url.pathname.match(/\/chatbot\/fanpages\/([^/]+)$/);

    if (method === 'GET' && !fanpageMatch) {
      state.chatbot.fanpageListRequests.push(url.search);
      await jsonResponse(route, paginated(filterFanpages(state.chatbot, url.searchParams)));
      return;
    }

    if (method === 'PATCH' && fanpageMatch) {
      const payload = request.postDataJSON() as FanpagePayload;
      state.chatbot.updateFanpageCalls.push({ fanpageId: fanpageMatch[1], payload: clone(payload) });
      await delay(350);
      updateFanpage(state.chatbot, fanpageMatch[1], {
        name: payload.name,
        platform: payload.platform,
        pageId: payload.pageId,
        description: payload.description || '',
        adAccountId: payload.adAccountId || '',
        openaiTokenId: payload.openaiTokenId || '',
        webhookVerifyToken: payload.webhookVerifyToken || '',
        status: payload.status,
        aiAutoReplyEnabled: payload.aiAutoReplyEnabled,
      });
      await jsonResponse(route, { ok: true });
      return;
    }

    await route.fulfill({ status: 404, body: 'Unhandled fanpage route' });
  });

  await page.route(/\/chatbot\/openai-tokens(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, body: 'Unsupported method' });
      return;
    }
    await jsonResponse(route, clone(state.chatbot.tokens));
  });

  await page.route(/\/chatbot\/ai-assistant-profiles(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fulfill({ status: 405, body: 'Unsupported method' });
      return;
    }
    await jsonResponse(route, clone(state.chatbot.aiProfiles));
  });
}

async function installDirectorWorkflowRoutes(page: Page, state: DirectorWorkflowState): Promise<void> {
  const adsState = state as unknown as AdsManagerWorkflowState;

  await page.addInitScript(() => {
    const originalSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const normalizedTimeout = timeout === 60000 ? 150 : timeout;
      return originalSetInterval(handler, normalizedTimeout, ...args);
    }) as typeof window.setInterval;
  });

  await routeAdsManagerAuthApis(page, adsState);
  await routeAdsManagerManagementApis(page, adsState);
  await routeAdsManagerAnalyticsApis(page, adsState);
  await routeAdsManagerChatbotApis(page, adsState);
}

test.describe.serial('Ads manager full workflow video', () => {
  test(VIDEO_TEST_TITLE, async ({ page }) => {
    test.setTimeout(900_000);

    const state = buildAdsManagerWorkflowState() as unknown as DirectorWorkflowState;
    const ui = new DirectorWorkflowPage(page);
    const context = page.context();
    const artifactDir = path.join(META_DIR, `adsmanager-demo-${Date.now()}`);
    const cues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap(collectNarrationTexts(ADSMANAGER_VIDEO_COPY));
    const recordingStartedAt = Date.now();
    let savedVideoPath: string | null = null;

    const presentSceneCard = async (
      section: string,
      title: string,
      description: string,
      bullets: readonly string[],
      narration: string,
    ) => {
      await setVideoLabel(page, null);
      await setVideoCallout(page, null, null);
      const playback = beginNarration(cues, recordingStartedAt, section, narration, narrationDurationMap);
      await showTitleCard(page, title, description, [...bullets]);
      await waitForNarrationWindow(page, playback, 3_600);
    };

    await ensureEvidenceDirs();
    await mkdir(artifactDir, { recursive: true });
    await installDirectorWorkflowRoutes(page, state);
    await installVideoOverlay(page);

    try {
      const introPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'intro',
        ADSMANAGER_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        ADSMANAGER_VIDEO_COPY.introTitle,
        ADSMANAGER_VIDEO_COPY.introDescription,
        [...ADSMANAGER_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_800);

      const roadmapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'roadmap',
        ADSMANAGER_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        ADSMANAGER_VIDEO_COPY.roadmapTitle,
        ADSMANAGER_VIDEO_COPY.roadmapDescription,
        ADSMANAGER_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 5_600);

      await presentSceneCard(
        'scene-dashboard',
        ADSMANAGER_VIDEO_COPY.dashboardSceneTitle,
        ADSMANAGER_VIDEO_COPY.dashboardSceneDescription,
        ADSMANAGER_VIDEO_COPY.dashboardSceneBullets,
        ADSMANAGER_VIDEO_COPY.dashboardSceneNarration,
      );

      await ui.loginAsDirector();
      await expect(page.getByRole('heading', { name: /Bat dau ngay lam viec tu 3 man hinh chinh/i })).toBeVisible();
      await setVideoLabel(page, ADSMANAGER_VIDEO_COPY.dashboardLabel);
      const dashboardPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'dashboard',
        ADSMANAGER_VIDEO_COPY.dashboardNarration,
        narrationDurationMap,
      );
      const dashboardHero = page.locator('section.hero').first();
      await setVideoCallout(page, dashboardHero, ADSMANAGER_VIDEO_COPY.dashboardHeroCallout);
      await ui.pause(2_100);
      const dashboardChecklist = page.locator('.content-grid .panel').first();
      await setVideoCallout(page, dashboardChecklist, ADSMANAGER_VIDEO_COPY.dashboardChecklistCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-management',
        ADSMANAGER_VIDEO_COPY.managementSceneTitle,
        ADSMANAGER_VIDEO_COPY.managementSceneDescription,
        ADSMANAGER_VIDEO_COPY.managementSceneBullets,
        ADSMANAGER_VIDEO_COPY.managementSceneNarration,
      );

      await ui.goto('/app/dashboard');
      const openManagementLink = page.locator('section.hero a[href="/app/ads-management"]').first();
      await clickLocator(page, openManagementLink);
      await expect(page.getByRole('heading', { name: /Quan ly quang cao/i })).toBeVisible();
      await setVideoLabel(page, ADSMANAGER_VIDEO_COPY.managementLabel);
      const managementPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'management',
        ADSMANAGER_VIDEO_COPY.managementNarration,
        narrationDurationMap,
      );
      const managementTabs = page.locator('nav.tabs').first();
      await setVideoCallout(page, managementTabs, ADSMANAGER_VIDEO_COPY.managementTabsCallout);
      await expect(page.getByRole('button', { name: 'API Token' })).toHaveCount(0);
      await ui.pause(1_900);
      const accountRow = rowByText(page, 'Facebook Cohort Alpha');
      await expect(accountRow).toBeVisible();
      await expect(accountRow.getByRole('button', { name: 'Sua' })).toHaveCount(0);
      await setVideoCallout(page, accountRow, ADSMANAGER_VIDEO_COPY.managementAccountReadOnlyCallout);
      await ui.pause(1_900);
      await clickLocator(page, page.getByRole('button', { name: 'Nhom QC' }));
      const groupRow = rowByText(page, 'Alpha Social');
      await expect(groupRow).toBeVisible();
      await expect(groupRow.getByRole('button', { name: 'Xoa' })).toHaveCount(0);
      await setVideoCallout(page, groupRow, ADSMANAGER_VIDEO_COPY.managementGroupRowCallout);
      await ui.pause(1_800);
      await clickLocator(page, groupRow.getByRole('button', { name: 'Sua' }));
      const groupModal = page.locator('.modal-backdrop .modal').last();
      await expect(groupModal).toBeVisible();
      await setVideoCallout(page, groupModal, ADSMANAGER_VIDEO_COPY.managementGroupModalCallout);
      await field(groupModal, /Ngan sach\/ngay/i).fill('950000');
      await field(groupModal, /Tracking keys/i).fill('utm_campaign=alpha-refresh\nref=ads-manager-demo');
      await field(groupModal, /Trang thai/i, 'select').selectOption('PAUSED');
      await field(groupModal, /Ghi chu/i).fill('Ads manager updated budget and tracking after action review.');
      await ui.pause(1_300);
      await clickLocator(page, groupModal.getByRole('button', { name: /^Luu$/i }));
      await expect(groupModal).toHaveCount(0);
      await expect(rowByText(page, 'Alpha Social')).toContainText('Tam dung');
      await ui.pause(1_500);
      await clickLocator(page, page.getByRole('button', { name: 'Chi phi Ads' }));
      await expect(page.getByRole('button', { name: /\+ Nhap chi phi/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Dong bo toan bo/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Backfill parent attribution/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Backfill adGroup/i })).toHaveCount(0);
      const costsTable = page.locator('table.data-table').first();
      await expect(costsTable).toBeVisible();
      await setVideoCallout(page, costsTable, ADSMANAGER_VIDEO_COPY.managementCostsReadOnlyCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, managementPlayback);

      await presentSceneCard(
        'scene-actions',
        ADSMANAGER_VIDEO_COPY.actionsSceneTitle,
        ADSMANAGER_VIDEO_COPY.actionsSceneDescription,
        ADSMANAGER_VIDEO_COPY.actionsSceneBullets,
        ADSMANAGER_VIDEO_COPY.actionsSceneNarration,
      );

      await ui.goto('/app/ads-management');
      await clickLocator(page, page.getByRole('button', { name: 'Viec can lam' }));
      await expect(page.locator('.summary-dashboard')).toBeVisible({ timeout: 20_000 });
      await setVideoLabel(page, ADSMANAGER_VIDEO_COPY.actionsLabel);
      const actionsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'actions',
        ADSMANAGER_VIDEO_COPY.actionsNarration,
        narrationDurationMap,
      );
      const summaryDashboard = page.locator('.summary-dashboard').first();
      await setVideoCallout(page, summaryDashboard, ADSMANAGER_VIDEO_COPY.actionsSummaryCallout);
      await ui.pause(2_000);
      const actionCard = page.locator('.action-card').first();
      await expect(actionCard).toBeVisible();
      await setVideoCallout(page, actionCard, ADSMANAGER_VIDEO_COPY.actionsCardCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, actionsPlayback);
      await presentSceneCard(
        'scene-analytics',
        ADSMANAGER_VIDEO_COPY.analyticsSceneTitle,
        ADSMANAGER_VIDEO_COPY.analyticsSceneDescription,
        ADSMANAGER_VIDEO_COPY.analyticsSceneBullets,
        ADSMANAGER_VIDEO_COPY.analyticsSceneNarration,
      );

      await ui.goto('/app/ads-analytics');
      await expect(page.locator('.page-header h2').first()).toBeVisible();
      const analyticsReloadButton = page.locator('section.filters button.primary').first();
      await clickLocator(page, analyticsReloadButton);
      await expect.poll(() => state.analytics.captured.analytics.length, { timeout: 20_000 }).toBeGreaterThan(0);
      await expect.poll(() => state.analytics.captured.realized.length, { timeout: 20_000 }).toBeGreaterThan(0);
      await expect.poll(() => state.analytics.captured.parents.length, { timeout: 20_000 }).toBeGreaterThan(0);
      await setVideoLabel(page, ADSMANAGER_VIDEO_COPY.analyticsLabel);
      const analyticsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'analytics',
        ADSMANAGER_VIDEO_COPY.analyticsNarration,
        narrationDurationMap,
      );
      const analyticsStats = page.locator('section.stats').first();
      await expect(analyticsStats).toBeVisible({ timeout: 20_000 });
      const overviewTable = funnelTable(page);
      await expect(overviewTable).toBeVisible({ timeout: 20_000 });
      await setVideoCallout(page, overviewTable, ADSMANAGER_VIDEO_COPY.analyticsOverviewCallout);
      await ui.pause(1_800);
      const analyticsFilters = page.locator('section.filters').first();
      await platformSelect(page).selectOption('GOOGLE');
      await adGroupSelect(page).selectOption('group-bravo');
      await setVideoCallout(page, analyticsFilters, ADSMANAGER_VIDEO_COPY.analyticsFilterCallout);
      await clickLocator(page, page.locator('section.filters button.primary').first());
      await ui.pause(2_000);
      await clickLocator(page, page.locator('.tab-bar .tab-button').nth(1));
      const parentProfitTable = page.locator('.parent-profit-table').first();
      await expect(parentProfitTable).toBeVisible({ timeout: 20_000 });
      await setVideoCallout(page, parentProfitTable, ADSMANAGER_VIDEO_COPY.analyticsParentTabCallout);
      await ui.pause(1_900);
      await clickLocator(page, page.locator('.tab-bar .tab-button').nth(2));
      const permissionGuard = page.locator('.suggestion-section').first();
      await expect(permissionGuard).toBeVisible();
      await expect(permissionGuard).toContainText(/Director/i);
      await setVideoCallout(page, permissionGuard, ADSMANAGER_VIDEO_COPY.analyticsGuardCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, analyticsPlayback);

      await presentSceneCard(
        'scene-chatbot',
        ADSMANAGER_VIDEO_COPY.chatbotSceneTitle,
        ADSMANAGER_VIDEO_COPY.chatbotSceneDescription,
        ADSMANAGER_VIDEO_COPY.chatbotSceneBullets,
        ADSMANAGER_VIDEO_COPY.chatbotSceneNarration,
      );

      await ui.goto('/app/chatbot-settings');
      await expect(page.getByRole('heading', { name: /Cai dat Chatbot/i })).toBeVisible();
      await setVideoLabel(page, ADSMANAGER_VIDEO_COPY.chatbotLabel);
      const chatbotPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'chatbot',
        ADSMANAGER_VIDEO_COPY.chatbotNarration,
        narrationDurationMap,
      );
      await expect(page.getByRole('button', { name: /Them fanpage/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'OpenAI Tokens' })).toHaveCount(0);
      const chatbotHelper = page.locator('.helper-inline').first();
      await expect(chatbotHelper).toBeVisible();
      await setVideoCallout(page, chatbotHelper, ADSMANAGER_VIDEO_COPY.chatbotHelperCallout);
      await ui.pause(1_900);
      const fanpageRow = rowByText(page, 'Ads Lead Intake');
      await expect(fanpageRow).toBeVisible();
      await setVideoCallout(page, fanpageRow, ADSMANAGER_VIDEO_COPY.chatbotFanpageRowCallout);
      await ui.pause(1_800);
      await clickLocator(page, fanpageRow.getByRole('button', { name: 'Sua' }));
      const fanpageModal = page.locator('.modal-backdrop .modal').last();
      await expect(fanpageModal).toBeVisible();
      await setVideoCallout(page, fanpageModal, ADSMANAGER_VIDEO_COPY.chatbotModalCallout);
      await field(fanpageModal, /Mo ta fanpage/i).fill('Ads Manager updated lead intake page for the new landing flow.');
      await field(fanpageModal, /Tai khoan quang cao lien ket/i, 'select').selectOption('acc-2');
      await field(fanpageModal, /OpenAI token/i, 'select').selectOption('token-nurture-1');
      await field(fanpageModal, /Webhook verify token/i).fill('verify-ads-manager-2026');
      const aiToggle = fanpageModal.getByLabel('Bat AI tu dong tra loi');
      await expect(aiToggle).toBeChecked();
      await aiToggle.uncheck();
      await field(fanpageModal, /Trang thai/i, 'select').selectOption('INACTIVE');
      await ui.pause(1_300);
      await clickLocator(page, fanpageModal.getByRole('button', { name: /^Luu$/i }));
      await expect(fanpageModal).toHaveCount(0);
      await expect(rowByText(page, 'Ads Lead Intake')).toContainText('Tat');
      await expect(rowByText(page, 'Ads Lead Intake')).toContainText('Ngung');
      await clickLocator(page, page.getByRole('button', { name: 'AI Profiles' }));
      await expect(page.getByRole('button', { name: /\+ Them AI profile/i })).toHaveCount(0);
      const profilesTable = page.locator('table.data-table').first();
      await expect(profilesTable).toBeVisible();
      await setVideoCallout(page, profilesTable, ADSMANAGER_VIDEO_COPY.chatbotProfilesCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, chatbotPlayback);

      await presentSceneCard(
        'scene-logout',
        ADSMANAGER_VIDEO_COPY.logoutSceneTitle,
        ADSMANAGER_VIDEO_COPY.logoutSceneDescription,
        ADSMANAGER_VIDEO_COPY.logoutSceneBullets,
        ADSMANAGER_VIDEO_COPY.logoutSceneNarration,
      );

      await ui.goto('/app/dashboard');
      await expect(page.getByRole('heading', { name: /Bat dau ngay lam viec tu 3 man hinh chinh/i })).toBeVisible();
      await setVideoLabel(page, ADSMANAGER_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'logout',
        ADSMANAGER_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout').first();
      await expect(logoutButton).toBeVisible();
      await setVideoCallout(page, logoutButton, ADSMANAGER_VIDEO_COPY.logoutCallout);
      await ui.pause(1_700);
      await clickLocator(page, logoutButton);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, logoutPlayback);

      await setVideoLabel(page, null);
      await setVideoCallout(page, null, null);
      const outroPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'outro',
        ADSMANAGER_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        ADSMANAGER_VIDEO_COPY.outroTitle,
        ADSMANAGER_VIDEO_COPY.outroDescription,
        [...ADSMANAGER_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_800);

      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});
