import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { DIRECTOR_VIDEO_COPY } from './director-video-copy';

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
const FINAL_VIDEO_BASENAME = `UI_Director_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const VIDEO_TEST_TITLE = 'records the full director master workflow with HD demo pacing';

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
    '# Director Full Workflow Narration',
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

function collectNarrationTexts(copy: typeof DIRECTOR_VIDEO_COPY): string[] {
  return [
    copy.introNarration,
    copy.roadmapNarration,
    copy.dashboardSceneNarration,
    copy.dashboardNarration,
    copy.approvalsSceneNarration,
    copy.approvalsNarration,
    copy.teacherKpiSceneNarration,
    copy.teacherKpiNarration,
    copy.calendarSceneNarration,
    copy.calendarNarration,
    copy.performanceSceneNarration,
    copy.performanceNarration,
    copy.financeSceneNarration,
    copy.financeNarration,
    copy.adsSceneNarration,
    copy.adsNarration,
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
  return {
    user: {
      _id: 'director-demo-user-001',
      sub: 'director-demo-user-001',
      email: 'director.demo@school.local',
      role: 'DIRECTOR',
      fullName: 'Director Demo',
      userCode: 'DIR001',
    },
    loginBodies: [],
    pending: {
      classPending: true,
      sessionChangePending: true,
    },
    calendarTeachers: [
      { _id: '000000000000000000000001', fullName: 'Teacher Alpha', email: 'alpha@example.com', role: 'TEACHER' },
      { _id: '000000000000000000000002', fullName: 'Teacher Beta', email: 'beta@example.com', role: 'TEACHER' },
    ],
    calendarClasses: [
      { _id: '100000000000000000000001', name: 'Lop Dai So', code: 'CLS-A' },
      { _id: '100000000000000000000002', name: 'Lop Hinh Hoc', code: 'CLS-B' },
    ],
    teacherKpi: buildTeacherKpiState(),
    employeePerformance: createEmployeePerformanceState(),
    financial: {
      bankAccounts: [
        {
          _id: 'bank-account-accounting-001',
          accountCode: 'BANK-001',
          bankName: 'VCB',
          accountNumber: '0123456789',
          accountHolder: 'Trung tam QA',
          currentBalance: 8_500_000,
          openingBalance: 7_000_000,
          status: 'ACTIVE',
          description: 'Tai khoan van hanh chinh',
          isPrimary: true,
          createdByName: 'Accounting Demo',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      bankTransactions: [
        {
          _id: 'bank-transaction-001',
          transactionCode: 'BT-001',
          bankAccountId: 'bank-account-accounting-001',
          type: 'DEPOSIT',
          category: 'TOP_UP',
          amount: 1_500_000,
          balanceBefore: 7_000_000,
          balanceAfter: 8_500_000,
          transactionDate: '2026-04-10',
          description: 'Top-up tu bien lai chuyen khoan',
          reference: 'REF-001',
          recordedByName: 'Accounting Demo',
          isReconciled: false,
          createdAt: '2026-04-10T09:00:00.000Z',
        },
      ],
      funds: [
        {
          _id: 'fund-accounting-marketing',
          fundCode: 'FUND-MKT',
          name: 'Quy Marketing QA',
          fundType: 'MARKETING',
          currentBalance: 1_400_000,
          minimumBalance: 1_500_000,
          targetBalance: 3_000_000,
          status: 'ACTIVE',
          description: 'Quy marketing de duyet ngan sach ads',
          totalDeposited: 4_500_000,
          totalWithdrawn: 3_100_000,
          createdByName: 'Accounting Demo',
          createdAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      fundTransactions: [
        {
          _id: 'fund-transaction-001',
          transactionCode: 'FT-001',
          fundId: 'fund-accounting-marketing',
          type: 'WITHDRAWAL',
          amount: 300_000,
          balanceBefore: 1_700_000,
          balanceAfter: 1_400_000,
          transactionDate: '2026-04-09',
          description: 'Chi phi ads ngay 09/04',
          reference: 'ADS-0904',
          performedByName: 'Accounting Demo',
          createdAt: '2026-04-09T08:00:00.000Z',
        },
      ],
    },
    analytics: createAnalyticsState(),
  };
}

function funnelTable(page: Page): Locator {
  return page.locator('table.data').filter({ hasText: 'CP/Lead' }).first();
}

function platformSelect(page: Page): Locator {
  return page.locator('section.filters select').filter({ has: page.locator('option[value="FACEBOOK"]') }).first();
}

function adGroupSelect(page: Page): Locator {
  return page.locator('section.filters select').filter({ hasText: /Alpha Social|Bravo Search|Charlie Retargeting/ }).first();
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

  async slowFill(locator: Locator, value: string, delay = 30): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 20_000 });
    await locator.click();
    await locator.fill('');
    await locator.pressSequentially(value, { delay });
  }

  async loginAsDirector(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();
    await this.slowFill(this.page.getByTestId('login-email'), 'director.demo@school.local');
    await this.pause(600);
    await this.slowFill(this.page.getByTestId('login-password'), '123456');
    await this.pause();
    await clickLocator(this.page, this.page.getByTestId('login-submit'));
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }
}

async function installDirectorWorkflowRoutes(page: Page, state: DirectorWorkflowState): Promise<void> {
  const AUTH_LOGIN_API = new RegExp(`${API_PREFIX_PATTERN}/auth/login(?:\\?.*)?$`);
  const AUTH_LOGOUT_API = new RegExp(`${API_PREFIX_PATTERN}/auth/logout(?:\\?.*)?$`);
  const USERS_ME_API = new RegExp(`${API_PREFIX_PATTERN}/users/me(?:\\?.*)?$`);
  const USERS_DIRECTORY_API = new RegExp(`${API_PREFIX_PATTERN}/users/directory(?:\\?.*)?$`);
  const NOTIFICATIONS_COUNT_API = new RegExp(`${API_PREFIX_PATTERN}/notifications/unread-count(?:\\?.*)?$`);
  const PENDING_APPROVALS_SUMMARY_API = new RegExp(`${API_PREFIX_PATTERN}/pending-approvals/summary(?:\\?.*)?$`);
  const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
  const DIRECTOR_DASHBOARD_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/director/comprehensive(?:\\?.*)?$`);
  const FINANCIAL_ALERTS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/alerts(?:\\?.*)?$`);
  const FINANCIAL_PNL_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/profit-and-loss(?:\\?.*)?$`);
  const TICKET_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/stats(?:\\?.*)?$`);
  const TICKETS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets(?:\\?.*)?$`);
  const PENDING_APPROVALS_API = new RegExp(`${API_PREFIX_PATTERN}/pending-approvals(?:\\?.*)?$`);
  const CLASS_APPROVE_API = new RegExp(`${API_PREFIX_PATTERN}/classes/([^/?]+)/pending-sale-update/approve(?:\\?.*)?$`);
  const SESSION_REVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/change-requests/([^/?]+)/review(?:\\?.*)?$`);
  const TEACHER_KPI_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/director/teacher-kpi(?:\\?.*)?$`);
  const CALENDAR_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/director/calendar(?:\\?.*)?$`);
  const USERS_TEACHERS_API = new RegExp(`${API_PREFIX_PATTERN}/users/teachers(?:\\?.*)?$`);
  const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);
  const EMPLOYEE_PERFORMANCE_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/director/employee-performance(?:\\?.*)?$`);
  const FINANCIAL_DASHBOARD_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/dashboard(?:\\?.*)?$`);
  const BANK_ACCOUNTS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/bank-accounts(?:\\?.*)?$`);
  const BANK_TRANSACTIONS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/bank-transactions(?:\\?.*)?$`);
  const FUNDS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/funds(?:\\?.*)?$`);
  const FUND_TRANSACTIONS_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/fund-transactions(?:\\?.*)?$`);
  const PROVISIONAL_GROSS_PROFIT_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/provisional-gross-profit(?:\\?.*)?$`);
  const CASHFLOW_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/cash-flow(?:\\?.*)?$`);
  const RECONCILIATION_API = new RegExp(`${API_PREFIX_PATTERN}/financial-control/reconciliation(?:\\?.*)?$`);

  await page.addInitScript(() => {
    const originalSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const normalizedTimeout = timeout === 60000 ? 150 : timeout;
      return originalSetInterval(handler, normalizedTimeout, ...args);
    }) as typeof window.setInterval;
  });

  await page.route(AUTH_LOGIN_API, async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    state.loginBodies.push(clone(body));
    await jsonResponse(route, { user: clone(state.user) });
  });

  await page.route(AUTH_LOGOUT_API, async (route) => {
    await jsonResponse(route, { ok: true });
  });

  await page.route(USERS_ME_API, async (route) => {
    await jsonResponse(route, clone(state.user));
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(NOTIFICATIONS_COUNT_API, async (route) => {
    await jsonResponse(route, { count: 4 });
  });

  await page.route(PENDING_APPROVALS_SUMMARY_API, async (route) => {
    await jsonResponse(route, {
      totalPending: 4 + Number(state.pending.classPending) + Number(state.pending.sessionChangePending),
    });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await jsonResponse(route, buildDailyTasksPayload());
  });

  await page.route(DIRECTOR_DASHBOARD_API, async (route) => {
    await jsonResponse(route, buildDirectorComprehensivePayload());
  });

  await page.route(FINANCIAL_ALERTS_API, async (route) => {
    await jsonResponse(route, financialAlertsReport());
  });

  await page.route(FINANCIAL_PNL_API, async (route) => {
    const url = new URL(route.request().url());
    const basis = (url.searchParams.get('basis') as 'cash' | 'accrual' | null) || 'cash';
    await jsonResponse(route, profitAndLossReport(basis));
  });

  await page.route(TICKET_STATS_API, async (route) => {
    await jsonResponse(route, buildTicketStatsPayload());
  });

  await page.route(TICKETS_API, async (route) => {
    await jsonResponse(route, buildTicketListPayload());
  });

  await page.route(PENDING_APPROVALS_API, async (route) => {
    await jsonResponse(route, buildStatefulPendingPayload(state.pending));
  });

  await page.route(CLASS_APPROVE_API, async (route) => {
    state.pending.classPending = false;
    await jsonResponse(route, { success: true });
  });

  await page.route(SESSION_REVIEW_API, async (route) => {
    state.pending.sessionChangePending = false;
    await jsonResponse(route, { success: true });
  });

  await page.route(TEACHER_KPI_API, async (route) => {
    state.teacherKpi.requestUrls.push(route.request().url());
    await jsonResponse(route, {
      summary: clone(state.teacherKpi.summary),
      teachers: clone(state.teacherKpi.teachers),
    });
  });

  await page.route(USERS_TEACHERS_API, async (route) => {
    await jsonResponse(route, clone(state.calendarTeachers));
  });

  await page.route(CLASSES_API, async (route) => {
    await jsonResponse(route, clone(state.calendarClasses));
  });

  await page.route(CALENDAR_API, async (route) => {
    const url = new URL(route.request().url());
    await jsonResponse(
      route,
      buildCalendarPayload(url.searchParams.get('teacherId') || '', url.searchParams.get('classId') || ''),
    );
  });

  await page.route(EMPLOYEE_PERFORMANCE_API, async (route) => {
    await jsonResponse(route, clone(state.employeePerformance));
  });

  await page.route(FINANCIAL_DASHBOARD_API, async (route) => {
    const bankBalance = state.financial.bankAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
    const fundBalance = state.financial.funds.reduce((sum, fund) => sum + fund.currentBalance, 0);
    const unreconciledItems = state.financial.bankTransactions.filter((tx) => !tx.isReconciled).length;
    await jsonResponse(route, minimalDashboard(bankBalance, fundBalance, unreconciledItems));
  });

  await page.route(BANK_ACCOUNTS_API, async (route) => {
    await jsonResponse(route, clone(state.financial.bankAccounts));
  });

  await page.route(BANK_TRANSACTIONS_API, async (route) => {
    await jsonResponse(route, clone(state.financial.bankTransactions));
  });

  await page.route(FUNDS_API, async (route) => {
    await jsonResponse(route, clone(state.financial.funds));
  });

  await page.route(FUND_TRANSACTIONS_API, async (route) => {
    const url = new URL(route.request().url());
    const fundId = url.searchParams.get('fundId');
    const data = fundId
      ? state.financial.fundTransactions.filter((transaction) => transaction.fundId === fundId)
      : state.financial.fundTransactions;
    await jsonResponse(route, clone(data));
  });

  await page.route(PROVISIONAL_GROSS_PROFIT_API, async (route) => {
    const url = new URL(route.request().url());
    await jsonResponse(route, provisionalGrossProfitReport(url.searchParams.get('month') || '2026-04'));
  });

  await page.route(CASHFLOW_API, async (route) => {
    const url = new URL(route.request().url());
    await jsonResponse(route, cashFlowReport(url.searchParams.get('groupBy') || 'month'));
  });

  await page.route(RECONCILIATION_API, async (route) => {
    await jsonResponse(route, reconciliationReport(state.financial));
  });

  await page.route(/\/ads\/groups\/all(?:\?.*)?$/, async (route) => {
    await jsonResponse(route, clone(state.analytics.groups));
  });

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

test.describe.serial('Director full workflow video', () => {
  test(VIDEO_TEST_TITLE, async ({ page }) => {
    test.setTimeout(900_000);

    const state = buildDirectorWorkflowState();
    const ui = new DirectorWorkflowPage(page);
    const context = page.context();
    const artifactDir = path.join(META_DIR, `director-demo-${Date.now()}`);
    const cues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap(collectNarrationTexts(DIRECTOR_VIDEO_COPY));
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
        DIRECTOR_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        DIRECTOR_VIDEO_COPY.introTitle,
        DIRECTOR_VIDEO_COPY.introDescription,
        [...DIRECTOR_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_800);

      const roadmapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'roadmap',
        DIRECTOR_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        DIRECTOR_VIDEO_COPY.roadmapTitle,
        DIRECTOR_VIDEO_COPY.roadmapDescription,
        DIRECTOR_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 5_600);

      await presentSceneCard(
        'scene-dashboard',
        DIRECTOR_VIDEO_COPY.dashboardSceneTitle,
        DIRECTOR_VIDEO_COPY.dashboardSceneDescription,
        DIRECTOR_VIDEO_COPY.dashboardSceneBullets,
        DIRECTOR_VIDEO_COPY.dashboardSceneNarration,
      );

      await ui.loginAsDirector();
      await expect(page.getByTestId('director-dashboard-page')).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.dashboardLabel);
      const dashboardPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'dashboard',
        DIRECTOR_VIDEO_COPY.dashboardNarration,
        narrationDurationMap,
      );
      const dashboardRoot = page.getByTestId('director-dashboard-page');
      await setVideoCallout(page, dashboardRoot, DIRECTOR_VIDEO_COPY.dashboardPageCallout);
      await ui.pause(1_900);
      const alertCard = page.getByTestId('director-critical-alerts');
      await setVideoCallout(page, alertCard, DIRECTOR_VIDEO_COPY.dashboardAlertCallout);
      await ui.pause(1_900);
      await clickLocator(page, page.getByTestId('director-dashboard-tabs').locator('button').nth(1));
      const expenseBreakdown = page.getByTestId('director-expense-breakdown');
      await expect(expenseBreakdown).toBeVisible();
      await setVideoCallout(page, expenseBreakdown, DIRECTOR_VIDEO_COPY.dashboardExpenseCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-approvals',
        DIRECTOR_VIDEO_COPY.approvalsSceneTitle,
        DIRECTOR_VIDEO_COPY.approvalsSceneDescription,
        DIRECTOR_VIDEO_COPY.approvalsSceneBullets,
        DIRECTOR_VIDEO_COPY.approvalsSceneNarration,
      );

      await ui.goto('/app/pending-approvals');
      await expect(page.getByTestId('pending-approvals-page')).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.approvalsLabel);
      const approvalsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'approvals',
        DIRECTOR_VIDEO_COPY.approvalsNarration,
        narrationDurationMap,
      );
      const summaryTotal = page.getByTestId('pending-summary-total');
      await setVideoCallout(page, summaryTotal, DIRECTOR_VIDEO_COPY.approvalsSummaryCallout);
      await ui.pause(1_800);
      await clickLocator(page, page.getByTestId('pending-tab-classes'));
      const classRow = page.getByTestId('pending-class-row-class-001');
      await expect(classRow).toBeVisible();
      await setVideoCallout(page, classRow, DIRECTOR_VIDEO_COPY.approvalsClassCallout);
      await ui.pause(1_700);
      await page.getByTestId('pending-class-approve-class-001').click();
      await expect.poll(() => state.pending.classPending).toBe(false);
      await expect(classRow).toHaveCount(0);
      await expect(page.getByTestId('pending-empty-classes')).toBeVisible();
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('5', { timeout: 5_000 });
      page.once('dialog', async (dialog) => {
        await dialog.accept('Khong phu hop');
      });
      await clickLocator(page, page.getByTestId('pending-tab-session-changes'));
      const sessionRow = page.getByTestId('pending-session-change-row-session-change-001');
      await expect(sessionRow).toBeVisible();
      await setVideoCallout(page, sessionRow, DIRECTOR_VIDEO_COPY.approvalsSessionCallout);
      await ui.pause(1_700);
      await page.getByTestId('pending-session-change-reject-session-change-001').click();
      await expect.poll(() => state.pending.sessionChangePending).toBe(false);
      await expect(sessionRow).toHaveCount(0);
      await expect(page.getByTestId('pending-empty-session-changes')).toBeVisible();
      await expect(page.getByTestId('nav-badge-pending')).toHaveText('4', { timeout: 5_000 });
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, approvalsPlayback);

      await presentSceneCard(
        'scene-teacher-kpi',
        DIRECTOR_VIDEO_COPY.teacherKpiSceneTitle,
        DIRECTOR_VIDEO_COPY.teacherKpiSceneDescription,
        DIRECTOR_VIDEO_COPY.teacherKpiSceneBullets,
        DIRECTOR_VIDEO_COPY.teacherKpiSceneNarration,
      );

      await ui.goto('/app/teacher-kpi');
      await expect(page.getByRole('heading', { name: /KPI/i })).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.teacherKpiLabel);
      const teacherKpiPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'teacher-kpi',
        DIRECTOR_VIDEO_COPY.teacherKpiNarration,
        narrationDurationMap,
      );
      const teacherControls = page.locator('.controls').first();
      await setVideoCallout(page, teacherControls, DIRECTOR_VIDEO_COPY.teacherKpiFilterCallout);
      await ui.pause(1_800);
      await page.locator('.controls select').nth(0).selectOption('PENDING');
      const teacherRow = page.locator('.data-table tbody tr').first();
      await expect(teacherRow).toContainText('Bravo Le');
      await setVideoCallout(page, teacherRow, DIRECTOR_VIDEO_COPY.teacherKpiTableCallout);
      await ui.pause(1_700);
      await clickLocator(page, teacherRow.locator('button[title="Xem chi tiết"]').first());
      const teacherModal = page.locator('.modal-content').first();
      await expect(teacherModal).toBeVisible();
      await setVideoCallout(page, teacherModal, DIRECTOR_VIDEO_COPY.teacherKpiDetailCallout);
      await ui.pause(2_100);
      await clickLocator(page, page.locator('.modal-close').first());
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, teacherKpiPlayback);

      await presentSceneCard(
        'scene-calendar',
        DIRECTOR_VIDEO_COPY.calendarSceneTitle,
        DIRECTOR_VIDEO_COPY.calendarSceneDescription,
        DIRECTOR_VIDEO_COPY.calendarSceneBullets,
        DIRECTOR_VIDEO_COPY.calendarSceneNarration,
      );

      await ui.goto('/app/calendar-overview?month=4&year=2026');
      await expect(page.getByTestId('calendar-teacher-filter')).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.calendarLabel);
      const calendarPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'calendar',
        DIRECTOR_VIDEO_COPY.calendarNarration,
        narrationDurationMap,
      );
      const calendarTeacherFilter = page.getByTestId('calendar-teacher-filter');
      await setVideoCallout(page, calendarTeacherFilter, DIRECTOR_VIDEO_COPY.calendarFilterCallout);
      await ui.pause(1_700);
      await calendarTeacherFilter.selectOption('000000000000000000000002');
      await page.getByTestId('calendar-class-filter').selectOption('100000000000000000000002');
      await expect(page.getByTestId('calendar-stat-total-sessions')).toContainText('1');
      const calendarEvent = page.getByTestId('calendar-event-session-calendar-002');
      await expect(calendarEvent).toBeVisible();
      await setVideoCallout(page, calendarEvent, DIRECTOR_VIDEO_COPY.calendarEventCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, calendarPlayback);

      await presentSceneCard(
        'scene-performance',
        DIRECTOR_VIDEO_COPY.performanceSceneTitle,
        DIRECTOR_VIDEO_COPY.performanceSceneDescription,
        DIRECTOR_VIDEO_COPY.performanceSceneBullets,
        DIRECTOR_VIDEO_COPY.performanceSceneNarration,
      );

      await ui.goto('/app/employee-performance');
      await expect(page.getByTestId('employee-performance-page')).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.performanceLabel);
      const performancePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'performance',
        DIRECTOR_VIDEO_COPY.performanceNarration,
        narrationDurationMap,
      );
      await clickLocator(page, page.getByTestId('employee-performance-tab-sales'));
      const salesRow = page.getByTestId('employee-performance-row-sales-0');
      await setVideoCallout(page, salesRow, DIRECTOR_VIDEO_COPY.performanceSalesTabCallout);
      await ui.pause(1_600);
      await page.getByTestId('employee-performance-filter-input').fill('bravo.sale@example.com');
      await expect(page.getByTestId('employee-performance-row-sales-0')).toContainText('Sale Bravo');
      await clickLocator(page, page.getByTestId('employee-performance-detail-button-sales-0'));
      const performanceModal = page.getByTestId('employee-performance-detail-modal');
      await expect(performanceModal).toBeVisible();
      await setVideoCallout(page, performanceModal, DIRECTOR_VIDEO_COPY.performanceSalesDetailCallout);
      await ui.pause(1_900);
      await clickLocator(page, page.getByTestId('employee-performance-detail-close'));
      await clickLocator(page, page.getByTestId('employee-performance-filter-clear'));
      await clickLocator(page, page.getByTestId('employee-performance-tab-ops'));
      await page.getByTestId('employee-performance-filter-input').fill('delta.ops@example.com');
      await expect(page.getByTestId('employee-performance-row-ops-0')).toContainText('Ops Delta');
      await clickLocator(page, page.getByTestId('employee-performance-detail-button-ops-0'));
      await expect(performanceModal).toBeVisible();
      await setVideoCallout(page, performanceModal, DIRECTOR_VIDEO_COPY.performanceOpsDetailCallout);
      await ui.pause(2_000);
      await clickLocator(page, page.getByTestId('employee-performance-detail-close'));
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, performancePlayback);

      await presentSceneCard(
        'scene-finance',
        DIRECTOR_VIDEO_COPY.financeSceneTitle,
        DIRECTOR_VIDEO_COPY.financeSceneDescription,
        DIRECTOR_VIDEO_COPY.financeSceneBullets,
        DIRECTOR_VIDEO_COPY.financeSceneNarration,
      );

      await ui.goto('/app/financial-control');
      await expect(page.getByText(/(Tinh hinh tien mat|TÌNH HÌNH TIỀN MẶT)/i).first()).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.financeLabel);
      const financePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'finance',
        DIRECTOR_VIDEO_COPY.financeNarration,
        narrationDurationMap,
      );
      const overviewBlock = page.getByText(/(Tinh hinh tien mat|TÌNH HÌNH TIỀN MẶT)/i).first();
      await setVideoCallout(page, overviewBlock, DIRECTOR_VIDEO_COPY.financeOverviewCallout);
      await ui.pause(1_800);
      const financialTabs = page.locator('.tab-bar button');
      await clickLocator(page, financialTabs.nth(2));
      const financeAlertCard = page.locator('.alert-card').first();
      await expect(financeAlertCard).toBeVisible();
      await setVideoCallout(page, financeAlertCard, DIRECTOR_VIDEO_COPY.financeAlertCallout);
      await ui.pause(1_700);
      await clickLocator(page, financialTabs.nth(3));
      const bankCard = page.locator('[data-testid="bank-account-card-bank-account-accounting-001"]').first();
      await expect(bankCard).toBeVisible();
      await setVideoCallout(page, bankCard, DIRECTOR_VIDEO_COPY.financeBankCallout);
      await ui.pause(1_700);
      await clickLocator(page, financialTabs.nth(4));
      const fundCard = page.locator('[data-testid="fund-card-fund-accounting-marketing"]').first();
      await expect(fundCard).toBeVisible();
      await setVideoCallout(page, fundCard, DIRECTOR_VIDEO_COPY.financeFundCallout);
      await ui.pause(1_700);
      await clickLocator(page, financialTabs.nth(7));
      const reconciliationCard = page.getByText(/(Chua doi soat|Chưa đối soát)/i).first();
      await expect(reconciliationCard).toBeVisible();
      await setVideoCallout(page, reconciliationCard, DIRECTOR_VIDEO_COPY.financeReconciliationCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, financePlayback);

      await presentSceneCard(
        'scene-ads',
        DIRECTOR_VIDEO_COPY.adsSceneTitle,
        DIRECTOR_VIDEO_COPY.adsSceneDescription,
        DIRECTOR_VIDEO_COPY.adsSceneBullets,
        DIRECTOR_VIDEO_COPY.adsSceneNarration,
      );

      await ui.goto('/app/ads-analytics');
      const overviewTable = funnelTable(page);
      await expect(overviewTable).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.adsLabel);
      const adsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'ads',
        DIRECTOR_VIDEO_COPY.adsNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, overviewTable, DIRECTOR_VIDEO_COPY.adsOverviewCallout);
      await ui.pause(1_700);
      await clickLocator(page, page.getByRole('columnheader', { name: /ROI %/i }));
      const filtersSection = page.locator('section.filters').first();
      await page.getByLabel(/Từ ngày|Tu ngay/i).fill('2026-03-01');
      await page.getByLabel(/Đến ngày|Den ngay/i).fill('2026-03-31');
      await page.getByLabel(/Số ngày chín cohort|So ngay chin cohort/i).fill('45');
      await page.getByLabel(/X refund còn lại|X refund con lai/i).fill('7.5');
      await platformSelect(page).selectOption('GOOGLE');
      await adGroupSelect(page).selectOption('group-bravo');
      await setVideoCallout(page, filtersSection, DIRECTOR_VIDEO_COPY.adsFilterCallout);
      await ui.pause(1_700);
      await clickLocator(page, page.getByRole('button', { name: /Phân tích|Phan tich/i }));
      await expect.poll(() => state.analytics.captured.realized.length).toBeGreaterThan(0);
      await clickLocator(page, page.getByRole('button', { name: /Profit theo PH/i }));
      const parentProfitTable = page.locator('table.parent-profit-table').first();
      await expect(parentProfitTable).toBeVisible();
      await setVideoCallout(page, parentProfitTable, DIRECTOR_VIDEO_COPY.adsParentTabCallout);
      await ui.pause(1_700);
      await clickLocator(page, page.getByRole('button', { name: /Chi phí quảng cáo tối ưu theo X|Chi phi quang cao toi uu theo X/i }));
      await page.getByLabel(/Tổng ngân sách hằng ngày|Tong ngan sach hang ngay/i).fill('2500000');
      await clickLocator(page, page.getByRole('button', { name: /Đề xuất phân bổ|De xuat phan bo/i }));
      const suggestionSummary = page.locator('.sug-summary').first();
      await expect(suggestionSummary).toBeVisible();
      await setVideoCallout(page, suggestionSummary, DIRECTOR_VIDEO_COPY.adsSuggestionCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, adsPlayback);

      await presentSceneCard(
        'scene-logout',
        DIRECTOR_VIDEO_COPY.logoutSceneTitle,
        DIRECTOR_VIDEO_COPY.logoutSceneDescription,
        DIRECTOR_VIDEO_COPY.logoutSceneBullets,
        DIRECTOR_VIDEO_COPY.logoutSceneNarration,
      );

      await ui.goto('/app/dashboard');
      await expect(page.getByTestId('director-dashboard-page')).toBeVisible();
      await setVideoLabel(page, DIRECTOR_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'logout',
        DIRECTOR_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout').first();
      await expect(logoutButton).toBeVisible();
      await setVideoCallout(page, logoutButton, DIRECTOR_VIDEO_COPY.logoutCallout);
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
        DIRECTOR_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        DIRECTOR_VIDEO_COPY.outroTitle,
        DIRECTOR_VIDEO_COPY.outroDescription,
        [...DIRECTOR_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_800);

      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});
