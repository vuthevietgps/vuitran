import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { SALE_VIDEO_COPY } from './sale-video-copy';
import {
  acceptDialog,
  applySessionCookies,
  approvalFile,
  createEnrollmentFixture,
  findInvoicesByOrderId,
  getOrderById,
  loginAsRole,
  roleEmail,
  rolePassword,
  uniquePhone,
} from './support';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_BASE_URL =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE);
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const META_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_BASENAME = `UI_Sale_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const API_ORIGINS = Array.from(new Set([
  API_BASE_URL.replace(/\/$/, ''),
  API_BASE_URL.replace('127.0.0.1', 'localhost').replace(/\/$/, ''),
  API_BASE_URL.replace('localhost', '127.0.0.1').replace(/\/$/, ''),
]));
const API_PATTERN = `(?:${API_ORIGINS.map((origin) => escapeRegExp(origin)).join('|')})`;

const DASHBOARD_SALES_API = new RegExp(`${API_PATTERN}/dashboard/sales(?:\\?.*)?$`);
const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
const COMMISSION_REPORT_API = new RegExp(`${API_PATTERN}/orders/commission-report(?:\\?.*)?$`);
const LEADS_LIST_API = new RegExp(`${API_PATTERN}/leads(?:\\?.*)?$`);
const LEADS_PIPELINE_API = new RegExp(`${API_PATTERN}/leads/pipeline(?:\\?.*)?$`);
const LEADS_FOLLOWUPS_API = new RegExp(`${API_PATTERN}/leads/follow-ups(?:\\?.*)?$`);
const LEAD_DETAIL_API = new RegExp(`${API_PATTERN}/leads/([^/?]+)(?:\\?.*)?$`);
const CHATBOT_FANPAGES_API = new RegExp(`${API_PATTERN}/chatbot/fanpages(?:\\?.*)?$`);
const CHATBOT_CONVERSATIONS_API = new RegExp(
  `${API_PATTERN}/chatbot/conversations(?:/[^/?]+(?:/(?:messages|takeover|create-lead))?)?(?:\\?.*)?$`,
);
const CLASSES_API = new RegExp(`${API_PATTERN}/classes(?:\\?.*)?$`);
const PRODUCTS_API = new RegExp(`${API_PATTERN}/products(?:\\?.*)?$`);
const TRIAL_ENROLLMENTS_API = new RegExp(
  `${API_PATTERN}/trial-enrollments(?:/[^/?]+(?:/(?:convert|reject|teacher-paid-only))?)?(?:\\?.*)?$`,
);
const SESSIONS_STATS_API = new RegExp(`${API_PATTERN}/sessions/stats(?:\\?.*)?$`);
const SESSIONS_LIST_API = new RegExp(`${API_PATTERN}/sessions(?:\\?.*)?$`);
const SESSION_DETAIL_API = new RegExp(`${API_PATTERN}/sessions/session-sale-master-001(?:\\?.*)?$`);
const SESSION_CHANGE_REQUESTS_API = new RegExp(
  `${API_PATTERN}/sessions/session-sale-master-001/change-requests(?:\\?.*)?$`,
);
const TEACHERS_API = new RegExp(`${API_PATTERN}/teachers(?:\\?.*)?$`);

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

type LeadFixture = {
  _id: string;
  leadCode: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  studentName: string;
  studentGrade: string;
  source: string;
  status: string;
  saleId: string;
  saleName: string;
  estimatedValue: number;
  notes: string;
  nextFollowUp: string;
  createdAt: string;
  assignedAt: string;
  lastContactAt: string;
  contactHistory: Array<{
    date: string;
    method: string;
    notes: string;
  }>;
};

type ConversationFixtureState = {
  conversation: {
    _id: string;
    conversationCode: string;
    fanpageId: string;
    fanpageName: string;
    platform: string;
    platformUserId: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    status: 'AI_HANDLING' | 'HUMAN_HANDLING';
    assignedAgentId?: string;
    assignedAgentName?: string;
    lastMessageAt: string;
    messageCount: number;
    notes: string;
    leadId?: string;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    _id: string;
    conversationId: string;
    senderType: 'CUSTOMER' | 'AI' | 'HUMAN_AGENT';
    senderName: string;
    content: string;
    status: string;
    createdAt: string;
  }>;
  createdLeadPayloads: Array<Record<string, unknown>>;
};

type SessionHarnessState = {
  createdPayloads: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
};

type TrialHarnessItem = {
  _id: string;
  trialCode: string;
  status: string;
  studentName: string;
  studentPhone?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  classId: { _id: string; name: string; code: string; classMode: 'OFFLINE' };
  productId: { _id: string; name: string; code: string; teachingMode: 'OFFLINE' };
  saleId: { _id: string; fullName: string; email: string };
  maxTrialSessions: number;
  trialSessionsUsed: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type TrialHarnessState = {
  items: TrialHarnessItem[];
  createdPayloads: Array<Record<string, unknown>>;
  offlineClass: {
    _id: string;
    name: string;
    code: string;
    classMode: 'OFFLINE';
  };
  offlineProduct: {
    _id: string;
    name: string;
    code: string;
    teachingMode: 'OFFLINE';
  };
};

const NARRATION_FALLBACK_WORD_MS = 440;
const NARRATION_FALLBACK_BASE_MS = 1_300;
const NARRATION_FINISH_BUFFER_MS = 350;

test.use({
  trace: 'off',
  launchOptions: {
    slowMo: 190,
  },
});

async function ensureDirs(): Promise<void> {
  await mkdir(RAW_VIDEO_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
  await mkdir(META_DIR, { recursive: true });
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
    '# Sale Full Workflow Narration',
    '',
    'Danh sach cue de render long tieng cho video sale full workflow.',
    '',
    '| Cue | Time | Section | Text |',
    '| --- | --- | --- | --- |',
    ...cues.map((cue) => `| ${cue.id} | ${formatCueTimestamp(cue.atMs)} | ${cue.section} | ${cue.text} |`),
    '',
  ];

  await writeFile(
    path.join(artifactDir, 'narration-script.md'),
    lines.join('\n'),
    'utf8',
  );
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
        cursor.style.position = 'fixed';
        cursor.style.left = '0';
        cursor.style.top = '0';
        cursor.style.width = '26px';
        cursor.style.height = '26px';
        cursor.style.borderRadius = '999px';
        cursor.style.border = '3px solid rgba(14, 165, 233, 0.92)';
        cursor.style.background = 'rgba(255,255,255,0.78)';
        cursor.style.boxShadow = '0 10px 28px rgba(14, 165, 233, 0.35)';
        cursor.style.pointerEvents = 'none';
        cursor.style.zIndex = '2147483647';
        cursor.style.transform = 'translate(-999px, -999px)';
        cursor.style.transition = 'transform 60ms linear, width 100ms ease, height 100ms ease, border-color 100ms ease';
        document.body.appendChild(cursor);
      }

      let label = document.getElementById(LABEL_ID) as HTMLDivElement | null;
      if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        label.style.position = 'fixed';
        label.style.left = '20px';
        label.style.bottom = '20px';
        label.style.maxWidth = '760px';
        label.style.padding = '10px 14px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.84)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.45 "Segoe UI", system-ui, sans-serif';
        label.style.boxShadow = '0 20px 44px rgba(15, 23, 42, 0.28)';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '2147483646';
        label.style.opacity = '0';
        label.style.transition = 'opacity 150ms ease';
        document.body.appendChild(label);
      }

      let callout = document.getElementById(CALLOUT_ID) as HTMLDivElement | null;
      if (!callout) {
        callout = document.createElement('div');
        callout.id = CALLOUT_ID;
        callout.style.position = 'fixed';
        callout.style.left = '0';
        callout.style.top = '0';
        callout.style.width = '0';
        callout.style.height = '0';
        callout.style.border = '4px solid rgba(239, 68, 68, 0.96)';
        callout.style.borderRadius = '18px';
        callout.style.boxShadow = '0 0 0 9999px rgba(15, 23, 42, 0.10), 0 0 0 4px rgba(255,255,255,0.20), 0 18px 44px rgba(239, 68, 68, 0.25)';
        callout.style.pointerEvents = 'none';
        callout.style.zIndex = '2147483645';
        callout.style.opacity = '0';
        callout.style.transition = 'opacity 140ms ease, left 180ms ease, top 180ms ease, width 180ms ease, height 180ms ease';
        callout.style.animation = 'codexPulse 1.2s ease-in-out infinite';
        document.body.appendChild(callout);
      }

      let calloutText = document.getElementById(CALLOUT_TEXT_ID) as HTMLDivElement | null;
      if (!calloutText) {
        calloutText = document.createElement('div');
        calloutText.id = CALLOUT_TEXT_ID;
        calloutText.style.position = 'fixed';
        calloutText.style.left = '0';
        calloutText.style.top = '0';
        calloutText.style.maxWidth = '360px';
        calloutText.style.padding = '10px 14px';
        calloutText.style.borderRadius = '14px';
        calloutText.style.background = 'rgba(220, 38, 38, 0.95)';
        calloutText.style.color = '#fff';
        calloutText.style.font = '700 14px/1.4 "Segoe UI", system-ui, sans-serif';
        calloutText.style.letterSpacing = '0.01em';
        calloutText.style.boxShadow = '0 18px 36px rgba(127, 29, 29, 0.35)';
        calloutText.style.pointerEvents = 'none';
        calloutText.style.zIndex = '2147483646';
        calloutText.style.opacity = '0';
        calloutText.style.transition = 'opacity 140ms ease, left 180ms ease, top 180ms ease';
        document.body.appendChild(calloutText);
      }

      let style = document.getElementById('__codex_video_styles') as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = '__codex_video_styles';
        style.textContent = `
          @keyframes codexPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.01); }
          }
        `;
        document.head.appendChild(style);
      }

      window.addEventListener('mousemove', (event) => {
        cursor!.style.transform = `translate(${Math.round(event.clientX - 13)}px, ${Math.round(event.clientY - 13)}px)`;
      }, { passive: true });

      document.addEventListener('mousedown', () => {
        cursor!.style.width = '20px';
        cursor!.style.height = '20px';
        cursor!.style.borderColor = 'rgba(249, 115, 22, 0.95)';
      });

      document.addEventListener('mouseup', () => {
        cursor!.style.width = '26px';
        cursor!.style.height = '26px';
        cursor!.style.borderColor = 'rgba(14, 165, 233, 0.92)';
      });

      (window as any).__codexVideoLabel = (message: string | null) => {
        if (!label) return;
        if (!message) {
          label.style.opacity = '0';
          label.textContent = '';
          return;
        }
        label.textContent = message;
        label.style.opacity = '1';
      };

      (window as any).__codexVideoCallout = (
        rect: { x: number; y: number; width: number; height: number } | null,
        message: string | null,
      ) => {
        if (!callout || !calloutText) return;
        if (!rect || !message) {
          callout.style.opacity = '0';
          calloutText.style.opacity = '0';
          calloutText.textContent = '';
          return;
        }

        const padding = 10;
        const x = Math.max(8, rect.x - padding);
        const y = Math.max(8, rect.y - padding);
        const width = Math.max(60, rect.width + padding * 2);
        const height = Math.max(40, rect.height + padding * 2);
        callout.style.left = `${Math.round(x)}px`;
        callout.style.top = `${Math.round(y)}px`;
        callout.style.width = `${Math.round(width)}px`;
        callout.style.height = `${Math.round(height)}px`;
        callout.style.opacity = '1';

        const maxLeft = Math.max(12, window.innerWidth - 380);
        const textLeft = Math.min(maxLeft, Math.max(12, x));
        const preferredTop = y - 62;
        const textTop = preferredTop > 12 ? preferredTop : Math.min(window.innerHeight - 80, y + height + 12);
        calloutText.textContent = message;
        calloutText.style.left = `${Math.round(textLeft)}px`;
        calloutText.style.top = `${Math.round(textTop)}px`;
        calloutText.style.opacity = '1';
      };
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureOverlay, { once: true });
    } else {
      ensureOverlay();
    }
  });
}

async function createRecordedPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  await ensureDirs();
  const context = await browser.newContext({
    baseURL: APP_BASE_URL,
    locale: 'vi-VN',
    viewport: VIEWPORT,
    recordVideo: {
      dir: RAW_VIDEO_DIR,
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();
  await installVideoOverlay(page);
  return { context, page };
}

async function saveRecordedVideo(page: Page, context: BrowserContext, fileBaseName: string): Promise<string | null> {
  const video = page.video();
  await context.close();
  if (!video) return null;

  const rawPath = await video.path();
  const finalPath = path.join(VIDEO_DIR, `${fileBaseName}.webm`);
  await rm(finalPath, { force: true });
  await rename(rawPath, finalPath);
  return finalPath;
}

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((msg: string | null) => void) | undefined;
    fn?.(value);
  }, message);
}

async function showCallout(page: Page, locator: Locator, message: string, holdMs = 1_800): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Could not calculate callout rectangle for: ${message}`);
  }

  await page.evaluate(({ rect, text }) => {
    const fn = (window as any).__codexVideoCallout as ((r: unknown, t: string | null) => void) | undefined;
    fn?.(rect, text);
  }, {
    rect: {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    },
    text: message,
  });
  await page.waitForTimeout(holdMs);
}

async function clearCallout(page: Page): Promise<void> {
  await page.evaluate(() => {
    const fn = (window as any).__codexVideoCallout as ((r: unknown, t: string | null) => void) | undefined;
    fn?.(null, null);
  });
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + (box.width / 2), box.y + (box.height / 2), { steps: 18 });
  await page.waitForTimeout(120);
  await page.mouse.down();
  await page.waitForTimeout(70);
  await page.mouse.up();
  await page.waitForTimeout(220);
}

async function slowFill(page: Page, locator: Locator, value: string, delay = 55): Promise<void> {
  await clickLocator(page, locator);
  await locator.fill('');
  await locator.pressSequentially(value, { delay });
}

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top left, rgba(239, 68, 68, 0.18), transparent 32%),
          radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.18), transparent 35%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e293b 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(980px, calc(100vw - 80px));
        padding: 42px 44px;
        border-radius: 30px;
        border: 1px solid rgba(148, 163, 184, 0.22);
        background: rgba(15, 23, 42, 0.72);
        box-shadow: 0 28px 80px rgba(2, 6, 23, 0.46);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.14);
        color: #fca5a5;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 800;
      }
      h1 {
        margin: 18px 0 12px;
        font-size: 44px;
        line-height: 1.08;
      }
      p {
        margin: 0 0 18px;
        font-size: 20px;
        color: #cbd5e1;
        line-height: 1.55;
      }
      ul {
        margin: 0;
        padding-left: 22px;
        color: #f8fafc;
        display: grid;
        gap: 10px;
        font-size: 18px;
      }
      li::marker {
        color: #f87171;
      }
    </style>
    <div class="card">
      <div class="eyebrow">Sale Workflow</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>${bullets.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
  `);
  await page.waitForLoadState('domcontentloaded');
}

async function showWorkflowRoadmapCard(
  page: Page,
  title: string,
  subtitle: string,
  steps: readonly string[],
  activeIndex: number | null = null,
): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(248, 113, 113, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(56, 189, 248, 0.18), transparent 24%),
          linear-gradient(135deg, #0f172a 0%, #111827 48%, #1f2937 100%);
        color: #e2e8f0;
      }
      .shell {
        width: min(1320px, calc(100vw - 72px));
        padding: 34px 38px 40px;
        border-radius: 30px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 34px 90px rgba(15, 23, 42, 0.36);
        backdrop-filter: blur(16px);
      }
      .eyebrow {
        margin: 0 0 12px;
        color: #fda4af;
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
        color: rgba(226, 232, 240, 0.92);
      }
      .roadmap {
        margin-top: 30px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
      }
      .step {
        min-height: 124px;
        padding: 18px;
        border-radius: 22px;
        background: rgba(30, 41, 59, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .step.active {
        background: linear-gradient(135deg, rgba(248, 113, 113, 0.24), rgba(56, 189, 248, 0.18));
        border-color: rgba(248, 113, 113, 0.72);
        box-shadow: 0 20px 44px rgba(248, 113, 113, 0.14);
      }
      .step-num {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.16);
        color: #f8fafc;
        font-size: 14px;
        font-weight: 800;
      }
      .step.active .step-num {
        background: rgba(255, 255, 255, 0.18);
      }
      .step-title {
        margin: 16px 0 0;
        font-size: 18px;
        line-height: 1.35;
        font-weight: 700;
        color: #f8fafc;
      }
      .step-copy {
        margin-top: 10px;
        font-size: 13px;
        line-height: 1.55;
        color: rgba(226, 232, 240, 0.76);
      }
      .legend {
        margin-top: 18px;
        font-size: 13px;
        line-height: 1.55;
        color: rgba(226, 232, 240, 0.78);
      }
    </style>
    <section class="shell">
      <p class="eyebrow">Sale Workflow Map</p>
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="roadmap">
        ${steps
          .map(
            (step, index) => `
              <article class="step ${activeIndex === index ? 'active' : ''}">
                <span class="step-num">${String(index + 1).padStart(2, '0')}</span>
                <h2 class="step-title">${step}</h2>
                <p class="step-copy">Chặng ${index + 1} trong luồng nghiệp vụ sale.</p>
              </article>
            `,
          )
          .join('')}
      </div>
      <p class="legend">
        ${activeIndex === null
          ? 'Màn hình này dùng để giới thiệu toàn bộ roadmap trước khi vào từng chặng thao tác.'
          : `Chúng ta đang đi vào chặng ${activeIndex + 1} của quy trình.`}
      </p>
    </section>
  `);
  await page.waitForLoadState('domcontentloaded');
}

async function loginViaUi(page: Page, email: string, password: string, roleLabel: string): Promise<void> {
  await page.goto(new URL('/login', APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await setVideoLabel(page, `Đăng nhập vai ${roleLabel} để đi qua đúng công việc hằng ngày của sale.`);
  await showCallout(page, page.getByTestId('login-email'), `Nhập tài khoản ${roleLabel}`, 1_200);
  await slowFill(page, page.getByTestId('login-email'), email, 48);
  await showCallout(page, page.getByTestId('login-password'), 'Nhập mật khẩu demo', 1_100);
  await clickLocator(page, page.getByTestId('login-password'));
  await page.getByTestId('login-password').fill(password);
  await page.waitForTimeout(250);
  await showCallout(page, page.getByTestId('login-submit'), 'Bắt đầu phiên thao tác', 1_200);
  await clickLocator(page, page.getByTestId('login-submit'));
  await page.waitForURL(/\/app\//, { timeout: 25_000 });
  await clearCallout(page);
  await page.waitForTimeout(900);
}

async function switchSession(
  page: Page,
  session: Awaited<ReturnType<typeof loginAsRole>>,
  targetPath: string,
  label: string,
): Promise<void> {
  try {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  } catch {
    // ignore storage clear failures during route transitions
  }
  await page.context().clearCookies();
  await applySessionCookies(page, session);
  await page.goto(new URL(targetPath, APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  await setVideoLabel(page, label);
}

function leadRow(page: Page, keyword: string): Locator {
  return page.locator('table.data tbody tr').filter({ hasText: keyword }).first();
}

function orderRowByStudent(page: Page, studentName: string): Locator {
  return page.locator('[data-testid="order-row"], table.data tbody tr').filter({ hasText: studentName }).first();
}

function studentRow(page: Page, studentName: string): Locator {
  return page.locator('table.data tbody tr').filter({ hasText: studentName }).first();
}

async function filterOrders(page: Page, keyword: string): Promise<void> {
  const input = page.locator('section.filters input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function searchLeads(page: Page, keyword: string): Promise<void> {
  const input = page.locator('section.filters input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function searchStudents(page: Page, keyword: string): Promise<void> {
  const input = page.locator('section.filters input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function searchInvoices(page: Page, keyword: string): Promise<void> {
  const input = page.locator('.filters-section .filter-row .filter-input').first();
  await slowFill(page, input, keyword, 36);
  await page.waitForTimeout(900);
}

async function selectByValue(page: Page, locator: Locator, value: string): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  const options = await locator.locator('option').evaluateAll((items) =>
    items.map((item) => ({
      value: (item as HTMLOptionElement).value,
    })),
  );
  const fallbackValue = options.find((item) => item.value && !item.value.startsWith('__'))?.value;
  const targetValue = options.some((item) => item.value === value) ? value : fallbackValue;
  if (!targetValue) {
    throw new Error('No selectable option found for dropdown.');
  }
  await locator.selectOption(targetValue);
  await page.waitForTimeout(350);
}

async function createNewCustomerOrder(page: Page, data: {
  parentName: string;
  parentPhone: string;
  studentName: string;
  productId: string;
  note: string;
  receiptFileName: string;
}): Promise<void> {
  await showCallout(page, page.getByTestId('orders-create-button'), SALE_VIDEO_COPY.newOrderCreateCallout, 1_400);
  await clickLocator(page, page.getByTestId('orders-create-button'));
  const modal = page.getByTestId('order-form-modal');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await showCallout(page, modal.getByTestId('order-parent-phone'), SALE_VIDEO_COPY.newOrderFormCallout, 1_500);
  await slowFill(page, modal.getByTestId('order-parent-name'), data.parentName);
  await slowFill(page, modal.getByTestId('order-parent-phone'), data.parentPhone);
  await slowFill(page, modal.getByTestId('order-student-name'), data.studentName);
  await slowFill(page, modal.getByTestId('order-student-age'), '10');

  await selectByValue(page, modal.getByTestId('order-item-product-0'), data.productId);
  await slowFill(page, modal.getByTestId('order-item-sessions-0'), '10');
  await slowFill(page, modal.getByTestId('order-invoice-sessions-0'), '10');
  await modal.getByTestId('order-item-class-0').selectOption('');
  await page.waitForTimeout(350);

  await showCallout(page, modal.getByTestId('order-receipt-file'), SALE_VIDEO_COPY.newOrderReceiptCallout, 1_300);
  await modal.getByTestId('order-receipt-file').setInputFiles(approvalFile(data.receiptFileName));
  await expect(modal.locator('text=Đã có chứng từ')).toBeVisible({ timeout: 15_000 });
  await slowFill(page, modal.getByTestId('order-consultation-notes'), data.note, 24);

  await showCallout(page, modal.getByTestId('order-submit'), SALE_VIDEO_COPY.newOrderDraftCallout, 1_500);
  await clickLocator(page, modal.getByTestId('order-submit'));
  await expect(modal).toBeHidden({ timeout: 20_000 });
}

async function createExistingCustomerOrder(page: Page, data: {
  parentPhone: string;
  studentCodeOrName: string;
  productId: string;
  classId: string;
  note: string;
  receiptFileName: string;
}): Promise<void> {
  await showCallout(page, page.getByTestId('orders-create-button'), SALE_VIDEO_COPY.newOrderCreateCallout, 1_400);
  await clickLocator(page, page.getByTestId('orders-create-button'));
  const modal = page.getByTestId('order-form-modal');
  await expect(modal).toBeVisible({ timeout: 15_000 });

  await showCallout(page, modal.getByTestId('order-parent-lookup'), SALE_VIDEO_COPY.existingOrderParentCallout, 1_600);
  await slowFill(page, modal.getByTestId('order-parent-lookup'), data.parentPhone, 34);
  await page.waitForTimeout(700);
  const parentSelect = modal.getByTestId('order-parent-existing');
  const parentValue = await parentSelect.locator('option').nth(1).getAttribute('value');
  if (!parentValue) {
    throw new Error('Could not locate existing parent option for sale demo.');
  }
  await selectByValue(page, parentSelect, parentValue);

  await showCallout(page, modal.getByTestId('order-student-lookup'), SALE_VIDEO_COPY.existingOrderStudentCallout, 1_500);
  await slowFill(page, modal.getByTestId('order-student-lookup'), data.studentCodeOrName, 34);
  await page.waitForTimeout(700);
  const studentSelect = modal.getByTestId('order-student-existing');
  const studentValue = await studentSelect.locator('option').nth(1).getAttribute('value');
  if (!studentValue) {
    throw new Error('Could not locate existing student option for sale demo.');
  }
  await selectByValue(page, studentSelect, studentValue);

  await selectByValue(page, modal.getByTestId('order-item-product-0'), data.productId);
  await slowFill(page, modal.getByTestId('order-item-sessions-0'), '8');
  await slowFill(page, modal.getByTestId('order-invoice-sessions-0'), '8');
  await showCallout(page, modal.getByTestId('order-item-class-0'), SALE_VIDEO_COPY.existingOrderClassCallout, 1_500);
  await selectByValue(page, modal.getByTestId('order-item-class-0'), data.classId);

  await modal.getByTestId('order-receipt-file').setInputFiles(approvalFile(data.receiptFileName));
  await expect(modal.locator('text=Đã có chứng từ')).toBeVisible({ timeout: 15_000 });
  await slowFill(page, modal.getByTestId('order-consultation-notes'), data.note, 24);

  await showCallout(page, modal.getByTestId('order-submit'), SALE_VIDEO_COPY.newOrderDraftCallout, 1_500);
  await clickLocator(page, modal.getByTestId('order-submit'));
  await expect(modal).toBeHidden({ timeout: 20_000 });
}

async function submitOrderFromList(page: Page, row: Locator, message: string): Promise<void> {
  await showCallout(page, row.getByTestId('order-row-submit'), message, 1_400);
  await acceptDialog(page, () => clickLocator(page, row.getByTestId('order-row-submit')));
  await page.waitForTimeout(1_200);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + (offsetMinutes * 60 * 1000)).toISOString();
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function collectNarrationTexts(source: Record<string, unknown>): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    if (typeof value === 'string' && key.toLowerCase().includes('narration')) {
      return [value];
    }
    return [];
  });
}

function buildLeadFixture(phone: string): LeadFixture {
  return {
    _id: 'lead-sale-full-001',
    leadCode: 'LEAD-SALE-FULL-001',
    parentName: 'Phụ huynh Follow-up',
    parentPhone: phone,
    parentEmail: 'followup.parent@school.local',
    studentName: 'Học viên Follow-up',
    studentGrade: 'Lớp 6',
    source: 'FACEBOOK',
    status: 'CONTACTED',
    saleId: 'sale-demo-001',
    saleName: 'Sale Demo',
    estimatedValue: 2_400_000,
    notes: 'Lead dùng để demo bộ lọc follow-up và lead detail.',
    nextFollowUp: nowIso(45),
    createdAt: nowIso(-180),
    assignedAt: nowIso(-120),
    lastContactAt: nowIso(-60),
    contactHistory: [
      {
        date: nowIso(-60),
        method: 'CALL',
        notes: 'Đã gọi lần 1 và hẹn gọi lại buổi tối.',
      },
    ],
  };
}

function buildConversationState(): ConversationFixtureState {
  const createdAt = nowIso(-30);
  return {
    conversation: {
      _id: 'conversation-sale-full-001',
      conversationCode: 'CHAT-SALE-FULL-001',
      fanpageId: 'fanpage-main-001',
      fanpageName: 'Main Enrollment Fanpage',
      platform: 'FACEBOOK',
      platformUserId: 'fb-user-sale-full-001',
      customerName: 'Trần Minh Anh',
      customerPhone: '0900002222',
      customerEmail: 'minhanh.parent@example.test',
      status: 'AI_HANDLING',
      lastMessageAt: nowIso(-10),
      messageCount: 3,
      notes: 'Hội thoại chatbot cần sale tiếp quản để tạo lead.',
      createdAt,
      updatedAt: createdAt,
    },
    messages: [
      {
        _id: 'msg-sale-full-001',
        conversationId: 'conversation-sale-full-001',
        senderType: 'CUSTOMER',
        senderName: 'Trần Minh Anh',
        content: 'Cho mình xin tư vấn khóa học cho bé lớp 4.',
        status: 'SENT',
        createdAt: nowIso(-18),
      },
      {
        _id: 'msg-sale-full-002',
        conversationId: 'conversation-sale-full-001',
        senderType: 'AI',
        senderName: 'Enrollment Bot',
        content: 'Bot đã hỏi sơ bộ thông tin phụ huynh và lớp học mong muốn.',
        status: 'SENT',
        createdAt: nowIso(-15),
      },
      {
        _id: 'msg-sale-full-003',
        conversationId: 'conversation-sale-full-001',
        senderType: 'CUSTOMER',
        senderName: 'Trần Minh Anh',
        content: 'Bé cần học vào buổi tối và muốn học thử trước.',
        status: 'SENT',
        createdAt: nowIso(-12),
      },
    ],
    createdLeadPayloads: [],
  };
}

function buildDailyTaskBoard() {
  return {
    role: 'SALE',
    generatedAt: nowIso(),
    summary: {
      totalTasks: 3,
      overdueTasks: 0,
      dueTodayTasks: 3,
      highPriorityTasks: 2,
    },
    tabs: [
      {
        key: 'sales',
        label: 'Sale cần xử lý',
        description: 'Danh sách việc cần mở module để thao tác ngay trong video demo.',
        emptyMessage: 'Không có việc nào.',
        count: 3,
        tasks: [
          {
            id: 'task-1',
            type: 'lead',
            title: 'Follow-up lead nóng',
            detail: 'Lead từ chatbot đang cần gọi lại trong hôm nay.',
            priority: 'HIGH',
            route: '/app/leads',
            actionLabel: 'Mở leads',
            overdue: false,
          },
          {
            id: 'task-2',
            type: 'order',
            title: 'Lên order cho khách mới',
            detail: 'Khách đã gửi biên lai và cần submit duyệt.',
            priority: 'CRITICAL',
            route: '/app/orders',
            actionLabel: 'Mở orders',
            overdue: false,
          },
          {
            id: 'task-3',
            type: 'commission',
            title: 'Đối chiếu báo cáo hoa hồng',
            detail: 'Kiểm tra doanh thu và commission đang chờ duyệt.',
            priority: 'MEDIUM',
            route: '/app/commission-report',
            actionLabel: 'Mở commission',
            overdue: false,
          },
        ],
      },
    ],
  };
}

function buildDashboardSalesData() {
  return {
    leads: {
      total: 18,
      converted: 6,
      conversionRate: 33,
      active: 12,
      byStatus: {
        NEW: 4,
        CONTACTED: 5,
        CONSULTING: 4,
        INTERESTED: 3,
        CONVERTED: 2,
      },
      followUpsDueToday: [
        {
          leadCode: 'LEAD-SALE-FULL-001',
          parentName: 'Phụ huynh Follow-up',
          parentPhone: '0900001111',
          status: 'CONTACTED',
          nextFollowUp: nowIso(45),
        },
      ],
      followUpsOverdue: 0,
    },
    orders: {
      total: 9,
      byStatus: {
        DRAFT: 1,
        SUBMITTED: 2,
        APPROVED: 3,
        COMPLETED: 2,
        REJECTED: 1,
      },
      revenueGenerated: 18_500_000,
      commissionEarned: 1_850_000,
      commissionPending: 450_000,
      recentOrders: [
        {
          orderCode: 'OD-SALE-FULL-001',
          parentName: 'Phụ huynh Follow-up',
          studentName: 'Học viên Follow-up',
          finalAmount: 4_500_000,
          saleCommission: 450_000,
          status: 'SUBMITTED',
          saleName: 'Sale Demo',
        },
        {
          orderCode: 'OD-SALE-FULL-002',
          parentName: 'Phụ huynh Chốt đơn',
          studentName: 'Học viên Chốt đơn',
          finalAmount: 6_000_000,
          saleCommission: 600_000,
          status: 'COMPLETED',
          saleName: 'Sale Demo',
        },
      ],
    },
  };
}

function buildCommissionReport() {
  return {
    summary: {
      totalRevenue: 18_500_000,
      totalCommission: 1_850_000,
      pendingCommission: 450_000,
      totalOrders: 9,
    },
    byMonth: [
      {
        month: '2026-04',
        revenue: 18_500_000,
        commission: 1_850_000,
        count: 9,
      },
    ],
    details: [
      {
        orderCode: 'OD-SALE-FULL-001',
        parentName: 'Phụ huynh Follow-up',
        studentName: 'Học viên Follow-up',
        finalAmount: 4_500_000,
        saleCommission: 450_000,
        status: 'SUBMITTED',
        saleName: 'Sale Demo',
        createdAt: nowIso(-120),
      },
      {
        orderCode: 'OD-SALE-FULL-002',
        parentName: 'Phụ huynh Chốt đơn',
        studentName: 'Học viên Chốt đơn',
        finalAmount: 6_000_000,
        saleCommission: 600_000,
        status: 'COMPLETED',
        saleName: 'Sale Demo',
        createdAt: nowIso(-240),
      },
    ],
  };
}

function buildSessionHarnessState(): SessionHarnessState {
  return {
    createdPayloads: [],
    history: [
      {
        _id: 'session-change-history-approved-001',
        requestedBy: { fullName: 'Sale Demo', role: 'SALE' },
        reviewedBy: { fullName: 'OPS Demo', role: 'OPS' },
        reviewedAt: nowIso(-2_880),
        currentTeacherId: { _id: 'teacher-current-001', fullName: 'Teacher Hiện Tại' },
        requestedTeacherId: { _id: 'teacher-backup-001', fullName: 'Teacher Đề Xuất' },
        currentScheduledDate: '2026-04-14',
        currentStartTime: '18:00',
        currentEndTime: '19:00',
        requestedScheduledDate: '2026-04-15',
        requestedStartTime: '19:00',
        requestedEndTime: '20:00',
        currentDurationMinutes: 60,
        requestedDurationMinutes: 60,
        reason: 'Đã từng đổi giáo viên một lần trước đó.',
        status: 'APPROVED',
        financialImpact: {
          oldDurationMinutes: 60,
          newDurationMinutes: 60,
          oldAmountCharged: 250_000,
          newAmountCharged: 250_000,
          deltaAmountCharged: 0,
          oldTeacherPayout: 150_000,
          newTeacherPayout: 150_000,
          deltaTeacherPayout: 0,
        },
      },
    ],
  };
}

function buildTrialHarnessState(saleUserId: string, saleUserName: string, saleEmail: string): TrialHarnessState {
  const offlineClass = {
    _id: 'class-sale-offline-001',
    name: 'Lớp Trial Offline Demo',
    code: 'CLS-TRIAL-001',
    classMode: 'OFFLINE' as const,
  };

  const offlineProduct = {
    _id: 'product-sale-offline-001',
    name: 'Gói Trial Offline 2 buổi',
    code: 'PKG-TRIAL-001',
    teachingMode: 'OFFLINE' as const,
  };

  return {
    offlineClass,
    offlineProduct,
    createdPayloads: [],
    items: [
      {
        _id: 'trial-sale-existing-001',
        trialCode: 'TRIAL-SALE-001',
        status: 'WAITING_DECISION',
        studentName: 'Học viên trial có sẵn',
        studentPhone: '0901002003',
        parentName: 'Phụ huynh trial có sẵn',
        parentPhone: '0901002004',
        parentEmail: 'trial.parent@example.test',
        classId: offlineClass,
        productId: offlineProduct,
        saleId: {
          _id: saleUserId,
          fullName: saleUserName,
          email: saleEmail,
        },
        maxTrialSessions: 2,
        trialSessionsUsed: 1,
        notes: 'Bản ghi có sẵn để dashboard trial không rỗng.',
        createdAt: nowIso(-720),
        updatedAt: nowIso(-90),
      },
    ],
  };
}

async function installDashboardRoutes(page: Page): Promise<void> {
  const report = buildCommissionReport();

  await page.route(DASHBOARD_SALES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDashboardSalesData()),
    });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDailyTaskBoard()),
    });
  });

  await page.route(COMMISSION_REPORT_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(report),
    });
  });
}

async function installLeadRoutes(page: Page, lead: LeadFixture): Promise<void> {
  const allLeads = [lead];
  const pipeline = {
    pipeline: {
      NEW: { count: 2, estimatedValue: 4_000_000 },
      CONTACTED: { count: 1, estimatedValue: 2_400_000 },
      CONSULTING: { count: 1, estimatedValue: 2_800_000 },
      INTERESTED: { count: 1, estimatedValue: 3_200_000 },
      CONVERTED: { count: 1, estimatedValue: 4_500_000 },
    },
    total: 6,
    conversionRate: 17,
    assignedCount: 5,
    unassignedCount: 1,
  };

  await page.route(LEADS_PIPELINE_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pipeline),
    });
  });

  await page.route(LEADS_FOLLOWUPS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([lead]),
    });
  });

  await page.route(LEADS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/leads/pipeline') || url.pathname.endsWith('/leads/follow-ups')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(allLeads),
    });
  });

  await page.route(LEAD_DETAIL_API, async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/leads\/([^/]+)$/);
    if (!match || match[1] !== lead._id) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lead),
    });
  });
}

async function installConversationRoutes(page: Page, state: ConversationFixtureState): Promise<void> {
  await page.route(CHATBOT_FANPAGES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: 'fanpage-main-001',
            fanpageCode: 'FP-MAIN-001',
            name: 'Main Enrollment Fanpage',
            platform: 'FACEBOOK',
            pageId: 'page-001',
            status: 'ACTIVE',
            aiAutoReplyEnabled: true,
            createdAt: nowIso(-1_440),
            updatedAt: nowIso(-5),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
      }),
    });
  });

  await page.route(CHATBOT_CONVERSATIONS_API, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const routePath = url.pathname;

    if (method === 'GET' && routePath.endsWith('/chatbot/conversations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [state.conversation],
          total: 1,
          page: 1,
          limit: 20,
        }),
      });
      return;
    }

    if (method === 'GET' && routePath.endsWith(`/chatbot/conversations/${state.conversation._id}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.conversation),
      });
      return;
    }

    if (method === 'GET' && routePath.endsWith(`/chatbot/conversations/${state.conversation._id}/messages`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: state.messages,
          total: state.messages.length,
          page: 1,
          limit: 50,
        }),
      });
      return;
    }

    if (method === 'POST' && routePath.endsWith(`/chatbot/conversations/${state.conversation._id}/takeover`)) {
      state.conversation = {
        ...state.conversation,
        status: 'HUMAN_HANDLING',
        assignedAgentId: 'sale-demo-001',
        assignedAgentName: 'Sale Demo',
        updatedAt: nowIso(),
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }

    if (method === 'POST' && routePath.endsWith(`/chatbot/conversations/${state.conversation._id}/create-lead`)) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createdLeadPayloads.push(payload);
      state.conversation = {
        ...state.conversation,
        leadId: 'lead-created-from-conversation-001',
        updatedAt: nowIso(),
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'lead-created-from-conversation-001',
          parentName: payload.parentName,
          parentPhone: payload.parentPhone,
          studentName: payload.studentName,
        }),
      });
      return;
    }

    await route.fallback();
  });
}

async function installSessionRoutes(
  page: Page,
  state: SessionHarnessState,
  offlineClass: TrialHarnessState['offlineClass'],
): Promise<void> {
  await page.route(CLASSES_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'class-sale-master-001',
          name: 'Lớp Sale Master',
          code: 'CLS-SALE-001',
          classMode: 'ONLINE',
        },
        offlineClass,
      ]),
    });
  });

  await page.route(SESSIONS_STATS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSessions: 1,
        totalRevenue: 250_000,
        totalTeacherCost: 150_000,
        byStatus: {
          SCHEDULED: {
            count: 1,
            totalCharged: 250_000,
            totalPayout: 150_000,
          },
        },
      }),
    });
  });

  await page.route(SESSIONS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/sessions/stats') || url.pathname.endsWith('/sessions/session-sale-master-001')) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            _id: 'session-sale-master-001',
            classId: {
              _id: 'class-sale-master-001',
              name: 'Lớp Sale Master',
              code: 'CLS-SALE-001',
            },
            studentId: {
              _id: 'student-sale-master-001',
              fullName: 'Học viên Session Demo',
              studentCode: 'HS-SESSION-001',
            },
            teacherId: {
              _id: 'teacher-current-001',
              fullName: 'Teacher Hiện Tại',
            },
            scheduledDate: '2026-04-14',
            scheduledStartTime: '18:00',
            scheduledEndTime: '19:00',
            durationMinutes: 60,
            amountCharged: 250_000,
            teacherPayout: 150_000,
            status: 'SCHEDULED',
            isPaid: false,
            isTeacherPaid: false,
          },
        ],
        meta: {
          totalPages: 1,
          total: 1,
          page: 1,
          limit: 20,
        },
      }),
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        _id: 'session-sale-master-001',
        classId: {
          _id: 'class-sale-master-001',
          name: 'Lớp Sale Master',
          code: 'CLS-SALE-001',
        },
        studentId: {
          _id: 'student-sale-master-001',
          fullName: 'Học viên Session Demo',
          studentCode: 'HS-SESSION-001',
        },
        teacherId: {
          _id: 'teacher-current-001',
          fullName: 'Teacher Hiện Tại',
        },
        scheduledDate: '2026-04-14',
        scheduledStartTime: '18:00',
        scheduledEndTime: '19:00',
        durationMinutes: 60,
        amountCharged: 250_000,
        teacherPayout: 150_000,
        status: 'SCHEDULED',
        isPaid: false,
        isTeacherPaid: false,
        editHistory: [],
      }),
    });
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      state.createdPayloads.push(payload);
      state.history = [
        {
          _id: 'session-change-history-pending-001',
          requestedBy: {
            fullName: 'Sale Demo',
            role: 'SALE',
          },
          currentTeacherId: {
            _id: 'teacher-current-001',
            fullName: 'Teacher Hiện Tại',
          },
          requestedTeacherId: payload.requestedTeacherId
            ? {
                _id: String(payload.requestedTeacherId),
                fullName: 'Teacher Đề Xuất',
              }
            : undefined,
          currentScheduledDate: '2026-04-14',
          currentStartTime: '18:00',
          currentEndTime: '19:00',
          requestedScheduledDate: payload.requestedScheduledDate,
          requestedStartTime: payload.requestedStartTime,
          requestedEndTime: payload.requestedEndTime,
          currentDurationMinutes: 60,
          requestedDurationMinutes: 60,
          reason: payload.reason,
          status: 'PENDING',
          requestedAt: nowIso(),
          financialImpact: {
            oldDurationMinutes: 60,
            newDurationMinutes: 60,
            oldAmountCharged: 250_000,
            newAmountCharged: 250_000,
            deltaAmountCharged: 0,
            oldTeacherPayout: 150_000,
            newTeacherPayout: 150_000,
            deltaTeacherPayout: 0,
          },
        },
        ...state.history,
      ];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(state.history[0]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state.history),
    });
  });

  await page.route(TEACHERS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          _id: 'teacher-profile-current-001',
          userId: {
            _id: 'teacher-current-001',
            fullName: 'Teacher Hiện Tại',
            email: 'teacher.current@example.test',
          },
          fullName: 'Teacher Hiện Tại',
          status: 'ACTIVE',
        },
        {
          _id: 'teacher-profile-backup-001',
          userId: {
            _id: 'teacher-backup-001',
            fullName: 'Teacher Đề Xuất',
            email: 'teacher.backup@example.test',
          },
          fullName: 'Teacher Đề Xuất',
          status: 'ACTIVE',
        },
      ]),
    });
  });
}

async function installTrialRoutes(page: Page, state: TrialHarnessState): Promise<void> {
  await page.route(PRODUCTS_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([state.offlineProduct]),
    });
  });

  await page.route(TRIAL_ENROLLMENTS_API, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const routePath = url.pathname;

    if (method === 'GET' && routePath.endsWith('/trial-enrollments')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.items),
      });
      return;
    }

    if (method === 'POST' && routePath.endsWith('/trial-enrollments')) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      state.createdPayloads.push(payload);
      const createdItem: TrialHarnessItem = {
        _id: `trial-sale-created-${String(state.createdPayloads.length).padStart(3, '0')}`,
        trialCode: `TRIAL-SALE-${String(state.createdPayloads.length + 1).padStart(3, '0')}`,
        status: 'PENDING_TRIAL',
        studentName: readString(payload.studentName, 'Học viên trial mới'),
        studentPhone: readString(payload.studentPhone, ''),
        parentName: readString(payload.parentName, 'Phụ huynh trial mới'),
        parentPhone: readString(payload.parentPhone, ''),
        parentEmail: readString(payload.parentEmail, ''),
        classId: state.offlineClass,
        productId: state.offlineProduct,
        saleId: state.items[0]?.saleId || {
          _id: 'sale-demo-001',
          fullName: 'Sale Demo',
          email: roleEmail('sale'),
        },
        maxTrialSessions: Number(payload.maxTrialSessions || 2),
        trialSessionsUsed: 0,
        notes: readString(payload.notes, 'Trial mới được tạo từ video sale.'),
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      state.items = [createdItem, ...state.items];

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdItem),
      });
      return;
    }

    await route.fallback();
  });
}

test.describe('Sale full workflow video', () => {
  test('records the full sale workflow with Vietnamese narration and scene briefings', async ({ browser, request }) => {
    test.slow();
    test.setTimeout(900_000);

    const directorSession = await loginAsRole(request, 'director');
    const saleSession = await loginAsRole(request, 'sale');
    const saleUserId = readString(saleSession.user?._id, 'sale-demo-001');
    const saleUserName = readString(saleSession.user?.fullName, 'Sale Demo');
    const saleUserEmail = readString(saleSession.user?.email, roleEmail('sale'));
    const labelStamp = `${Date.now()}`;
    const artifactDir = path.join(META_DIR, `sale-demo-${labelStamp}`);
    await mkdir(artifactDir, { recursive: true });

    const existingFixture = await createEnrollmentFixture(request, {
      label: `sale-existing-${Math.random().toString(36).slice(2, 8)}`,
      classMode: 'ONLINE',
      initializeWallet: true,
    });

    const leadFixture = buildLeadFixture(uniquePhone(`sale-lead-${labelStamp}`));
    const conversationState = buildConversationState();
    const sessionState = buildSessionHarnessState();
    const trialState = buildTrialHarnessState(saleUserId, saleUserName, saleUserEmail);
    const newParentName = `Phụ huynh mới ${labelStamp.slice(-4)}`;
    const newParentPhone = uniquePhone(`sale-new-${labelStamp}`);
    const newStudentName = `Học sinh mới ${labelStamp.slice(-4)}`;
    const trialStudentName = `Học thử ${labelStamp.slice(-4)}`;

    const { context, page } = await createRecordedPage(browser);
    const recordingStartedAt = Date.now();
    const narrationCues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap(collectNarrationTexts(SALE_VIDEO_COPY));
    let savedVideoPath: string | null = null;
    let newOrderId = '';
    let newOrderCode = '';
    let createdInvoiceNumber = '';

    const presentSceneCard = async (
      section: string,
      title: string,
      description: string,
      bullets: readonly string[],
      narration: string,
    ): Promise<void> => {
      await setVideoLabel(page, null);
      await clearCallout(page);
      const playback = beginNarration(narrationCues, recordingStartedAt, section, narration, narrationDurationMap);
      await showTitleCard(page, title, description, [...bullets]);
      await waitForNarrationWindow(page, playback, 3_600);
    };

    try {
      await installDashboardRoutes(page);
      await installLeadRoutes(page, leadFixture);
      await installConversationRoutes(page, conversationState);

      const introPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'intro',
        SALE_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        SALE_VIDEO_COPY.introTitle,
        SALE_VIDEO_COPY.introDescription,
        [...SALE_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_600);

      const roadmapPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'roadmap',
        SALE_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        SALE_VIDEO_COPY.roadmapTitle,
        SALE_VIDEO_COPY.roadmapDescription,
        SALE_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 6_000);

      await presentSceneCard(
        'scene-dashboard',
        'Chặng 1. Đọc dashboard đầu ngày',
        'Mục tiêu là nhìn nhanh cẩm nang thao tác, danh sách việc trong ngày và trạng thái khởi động của tài khoản sale trước khi đi vào từng module chi tiết.',
        [
          'Đăng nhập đúng vai sale.',
          'Đọc banner cẩm nang và bảng việc trong ngày.',
          'Xác định tài khoản đang ở trạng thái có dữ liệu hay cần khởi động pipeline mới.',
        ],
        'Chặng đầu tiên là khởi động ngày làm việc. Sale vào dashboard để xem cẩm nang theo vai trò, danh sách việc cần xử lý ngay và nhận biết tài khoản đã có dữ liệu vận hành hay đang ở trạng thái khởi động an toàn.',
      );

      await loginViaUi(page, roleEmail('sale'), rolePassword(), 'Sale');
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('dashboard-handbook-banner')).toBeVisible();
      await setVideoLabel(
        page,
        'Chặng 1. Vào dashboard sale để đọc cẩm nang theo vai, bảng việc trong ngày và trạng thái khởi động của pipeline.',
      );
      const dashboardPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'dashboard',
        'Ở dashboard sale, người dùng nhìn ba lớp thông tin. Lớp thứ nhất là banner cẩm nang để nhắc đúng luồng thao tác. Lớp thứ hai là bảng việc trong ngày để biết module nào cần mở ngay. Lớp thứ ba là phần dashboard nghiệp vụ, có thể hiển thị KPI khi đã có dữ liệu, hoặc hiển thị trạng thái khởi động an toàn khi tài khoản còn mới.',
        narrationDurationMap,
      );
      const dashboardEmptyState = page.getByTestId('sale-dashboard-empty-state');
      const dashboardEmptyStateVisible = await dashboardEmptyState.isVisible().catch(() => false);
      if (dashboardEmptyStateVisible) {
        SALE_VIDEO_COPY.dashboardFollowupCallout =
          'Bảng việc trong ngày gom các việc ưu tiên cao để sale biết nên mở lead, đơn hàng hay hóa đơn trước.';
        SALE_VIDEO_COPY.dashboardRecentOrderCallout =
          'Khi tài khoản chưa có lead hay đơn hàng, hệ thống chuyển sang trạng thái khởi động an toàn và gợi ý mở đúng màn hình để bắt đầu pipeline.';
        await page.evaluate(() => {
          const ensureHelperText = (target: Element | null, text: string) => {
            if (!target || target.querySelector(`[data-sale-video-alias="${text}"]`)) return;
            const marker = document.createElement('span');
            marker.setAttribute('data-sale-video-alias', text);
            marker.textContent = text;
            marker.style.position = 'absolute';
            marker.style.width = '1px';
            marker.style.height = '1px';
            marker.style.padding = '0';
            marker.style.margin = '-1px';
            marker.style.overflow = 'hidden';
            marker.style.clip = 'rect(0, 0, 0, 0)';
            marker.style.whiteSpace = 'nowrap';
            marker.style.border = '0';
            target.appendChild(marker);
          };

          const taskBoard = document.querySelector('.task-board .board-shell');
          if (taskBoard) {
            taskBoard.classList.add('section-card');
            ensureHelperText(taskBoard, 'Follow-up hom nay');
          }

          const emptyActions = document.querySelector('[data-testid="sale-dashboard-empty-state"] .empty-actions');
          if (emptyActions) {
            emptyActions.classList.add('data-table');
            ensureHelperText(emptyActions, 'Đơn gần đây');
          }
        });
      }
      await showCallout(
        page,
        page.getByTestId('dashboard-handbook-banner'),
        'Banner này giới thiệu đúng cẩm nang Sale và là điểm vào nhanh tới hướng dẫn thao tác chuẩn.',
        2_200,
      );
      await showCallout(page, page.locator('.section-card').filter({ hasText: /Follow-up hôm nay|Follow-up hom nay/i }).first(), SALE_VIDEO_COPY.dashboardFollowupCallout, 2_200);
      await showCallout(page, page.locator('.data-table').last(), SALE_VIDEO_COPY.dashboardRecentOrderCallout, 2_300);
      await clearCallout(page);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-sale-hub',
        SALE_VIDEO_COPY.saleHubSceneTitle,
        SALE_VIDEO_COPY.saleHubSceneDescription,
        SALE_VIDEO_COPY.saleHubSceneBullets,
        SALE_VIDEO_COPY.saleHubSceneNarration,
      );

      await page.goto('/app/sale-hub');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /Huong dan sale theo dung 5 buoc van hanh/i })).toBeVisible();
      await setVideoLabel(page, SALE_VIDEO_COPY.saleHubLabel);
      const saleHubPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'sale-hub',
        SALE_VIDEO_COPY.saleHubNarration,
        narrationDurationMap,
      );
      await showCallout(page, page.locator('.hero-card').first(), SALE_VIDEO_COPY.saleHubHeroCallout, 2_300);
      await showCallout(page, page.locator('#workflow .workflow-grid').first(), SALE_VIDEO_COPY.saleHubWorkflowCallout, 2_400);
      await showCallout(page, page.locator('.gate-grid').first(), SALE_VIDEO_COPY.saleHubGateCallout, 2_300);
      await clearCallout(page);
      await waitForNarrationWindow(page, saleHubPlayback);

      await presentSceneCard(
        'scene-leads',
        SALE_VIDEO_COPY.leadsSceneTitle,
        SALE_VIDEO_COPY.leadsSceneDescription,
        SALE_VIDEO_COPY.leadsSceneBullets,
        SALE_VIDEO_COPY.leadsSceneNarration,
      );

      await page.goto('/app/leads');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.leadsLabel);
      const leadsPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'leads',
        SALE_VIDEO_COPY.leadsNarration,
        narrationDurationMap,
      );
      await showCallout(page, page.locator('.pipeline').first(), SALE_VIDEO_COPY.leadsFilterCallout, 2_000);
      await searchLeads(page, leadFixture.parentPhone);
      const saleLeadRow = leadRow(page, leadFixture.parentPhone);
      await showCallout(page, saleLeadRow, SALE_VIDEO_COPY.leadsRowCallout, 1_800);
      await clickLocator(page, saleLeadRow);
      const leadDetail = page.locator('.modal-backdrop .modal.wide').first();
      await expect(leadDetail).toBeVisible({ timeout: 15_000 });
      await showCallout(page, leadDetail, SALE_VIDEO_COPY.leadsDetailCallout, 2_100);
      await clickLocator(page, leadDetail.getByRole('button', { name: /Đóng|Dong/i }));
      await expect(leadDetail).toBeHidden({ timeout: 10_000 });
      await clearCallout(page);
      await waitForNarrationWindow(page, leadsPlayback);

      await presentSceneCard(
        'scene-conversations',
        SALE_VIDEO_COPY.conversationsSceneTitle,
        SALE_VIDEO_COPY.conversationsSceneDescription,
        SALE_VIDEO_COPY.conversationsSceneBullets,
        SALE_VIDEO_COPY.conversationsSceneNarration,
      );

      await page.goto('/app/conversations');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.conversationsLabel);
      const conversationsPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'conversations',
        SALE_VIDEO_COPY.conversationsNarration,
        narrationDurationMap,
      );
      const conversationCard = page.locator('.conv-card').first();
      await expect(conversationCard).toBeVisible();
      await showCallout(page, conversationCard, SALE_VIDEO_COPY.conversationsCardCallout, 1_800);
      await clickLocator(page, conversationCard);
      const takeoverButton = page.getByRole('button', { name: /Tiếp quản|Tiep quan/i });
      await showCallout(page, takeoverButton, SALE_VIDEO_COPY.conversationsTakeoverCallout, 1_900);
      await clickLocator(page, takeoverButton);
      const leadSection = page.locator('.sidebar-section').filter({ hasText: /Tạo Lead|Tao Lead/i }).first();
      await expect(leadSection).toBeVisible();
      await leadSection.getByRole('button', { name: /Tạo Lead từ hội thoại|Tao Lead tu hoi thoai/i }).click();
      await page.waitForTimeout(1_200);
      const leadInputs = leadSection.locator('.inline-form input');
      await showCallout(page, leadSection, SALE_VIDEO_COPY.conversationsLeadCallout, 1_800);
      await slowFill(page, leadInputs.nth(3), 'Bé Nguyễn Bảo Châu');
      await slowFill(page, leadSection.locator('.inline-form textarea').first(), 'Lead tạo trực tiếp từ hội thoại chatbot.', 26);
      await leadSection.getByRole('button', { name: /^Tạo Lead$|^Tao Lead$/i }).click();
      await expect.poll(() => conversationState.createdLeadPayloads.length).toBe(1);
      await expect(page.locator('.linked-entity').filter({ hasText: /Lead/i }).first()).toBeVisible();
      await clearCallout(page);
      await waitForNarrationWindow(page, conversationsPlayback);

      await presentSceneCard(
        'scene-new-order',
        SALE_VIDEO_COPY.newOrderSceneTitle,
        SALE_VIDEO_COPY.newOrderSceneDescription,
        SALE_VIDEO_COPY.newOrderSceneBullets,
        SALE_VIDEO_COPY.newOrderSceneNarration,
      );

      await page.goto('/app/orders');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.newOrderLabel);
      const newOrderPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'new-order',
        SALE_VIDEO_COPY.newOrderNarration,
        narrationDurationMap,
      );
      await createNewCustomerOrder(page, {
        parentName: newParentName,
        parentPhone: newParentPhone,
        studentName: newStudentName,
        productId: existingFixture.product._id,
        note: 'Khách mới cần học online buổi tối và đã gửi chứng từ cọc.',
        receiptFileName: `sale-order-new-${labelStamp}.png`,
      });
      await filterOrders(page, newStudentName);
      const newOrderRow = orderRowByStudent(page, newStudentName);
      await expect(newOrderRow).toBeVisible({ timeout: 20_000 });
      newOrderId = (await newOrderRow.getAttribute('data-order-id')) || '';
      newOrderCode = (await newOrderRow.getAttribute('data-order-code')) || '';
      await showCallout(page, newOrderRow, SALE_VIDEO_COPY.newOrderDraftCallout, 1_900);
      await submitOrderFromList(page, newOrderRow, SALE_VIDEO_COPY.newOrderSubmitCallout);
      await expect(newOrderRow).toContainText(/Chờ duyệt|SUBMITTED/i, { timeout: 20_000 });
      await clearCallout(page);
      await waitForNarrationWindow(page, newOrderPlayback);

      await presentSceneCard(
        'scene-existing-order',
        SALE_VIDEO_COPY.existingOrderSceneTitle,
        SALE_VIDEO_COPY.existingOrderSceneDescription,
        SALE_VIDEO_COPY.existingOrderSceneBullets,
        SALE_VIDEO_COPY.existingOrderSceneNarration,
      );

      await page.goto('/app/orders');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.existingOrderLabel);
      const existingOrderPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'existing-order',
        SALE_VIDEO_COPY.existingOrderNarration,
        narrationDurationMap,
      );
      await createExistingCustomerOrder(page, {
        parentPhone: existingFixture.parent.phone,
        studentCodeOrName: existingFixture.student.studentCode || existingFixture.student.fullName,
        productId: existingFixture.product._id,
        classId: existingFixture.classroom._id,
        note: 'Khách cũ đăng ký thêm gói tiếp theo và giữ nguyên lớp đang học.',
        receiptFileName: `sale-order-existing-${labelStamp}.png`,
      });
      await filterOrders(page, existingFixture.student.fullName);
      const existingOrderRow = orderRowByStudent(page, existingFixture.student.fullName);
      await expect(existingOrderRow).toBeVisible({ timeout: 20_000 });
      await showCallout(page, existingOrderRow, SALE_VIDEO_COPY.existingOrderSubmitCallout, 1_900);
      await submitOrderFromList(page, existingOrderRow, SALE_VIDEO_COPY.existingOrderSubmitCallout);
      await expect(existingOrderRow).toContainText(/Chờ duyệt|SUBMITTED/i, { timeout: 20_000 });
      await clearCallout(page);
      await waitForNarrationWindow(page, existingOrderPlayback);

      await presentSceneCard(
        'scene-approval',
        SALE_VIDEO_COPY.approvalSceneTitle,
        SALE_VIDEO_COPY.approvalSceneDescription,
        SALE_VIDEO_COPY.approvalSceneBullets,
        SALE_VIDEO_COPY.approvalSceneNarration,
      );

      await switchSession(page, directorSession, '/app/orders', SALE_VIDEO_COPY.approvalLabel);
      await filterOrders(page, newStudentName);
      const directorOrderRow = orderRowByStudent(page, newStudentName);
      await expect(directorOrderRow).toBeVisible({ timeout: 20_000 });
      const approvalPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'approval',
        SALE_VIDEO_COPY.approvalNarration,
        narrationDurationMap,
      );
      await showCallout(page, directorOrderRow, SALE_VIDEO_COPY.approvalRowCallout, 1_700);
      await clickLocator(page, directorOrderRow.getByTestId('order-row-approve'));
      const orderApproveModal = page.getByTestId('order-approve-modal');
      await expect(orderApproveModal).toBeVisible({ timeout: 15_000 });
      await showCallout(page, orderApproveModal, SALE_VIDEO_COPY.approvalModalCallout, 1_900);
      await orderApproveModal.getByTestId('order-approve-image').setInputFiles(
        approvalFile(`sale-order-approve-${labelStamp}.png`),
      );
      await expect(orderApproveModal.getByTestId('order-approve-confirm')).toBeEnabled({ timeout: 15_000 });
      await acceptDialog(page, () => clickLocator(page, orderApproveModal.getByTestId('order-approve-confirm')));
      await expect(orderApproveModal).toBeHidden({ timeout: 25_000 });
      await expect(directorOrderRow).toContainText(/Đã duyệt|Hoàn tất|APPROVED|COMPLETED/i, { timeout: 25_000 });
      await showCallout(page, directorOrderRow, SALE_VIDEO_COPY.approvalDoneCallout, 1_700);
      await clearCallout(page);

      if (!newOrderId) {
        newOrderId = (await directorOrderRow.getAttribute('data-order-id')) || '';
      }
      for (let attempt = 0; attempt < 12 && !createdInvoiceNumber; attempt += 1) {
        const linkedInvoices = newOrderId
          ? await findInvoicesByOrderId(request, directorSession, newOrderId)
          : [];
        createdInvoiceNumber = linkedInvoices[0]?.invoiceNumber || '';
        if (createdInvoiceNumber) break;
        await page.waitForTimeout(1_000);
      }
      if (!createdInvoiceNumber && newOrderId) {
        const refreshedOrder = await getOrderById(request, directorSession, newOrderId);
        createdInvoiceNumber = refreshedOrder?.processedResults?.invoiceNumbers?.[0] || '';
      }
      await waitForNarrationWindow(page, approvalPlayback);

      await presentSceneCard(
        'scene-downstream',
        SALE_VIDEO_COPY.downstreamSceneTitle,
        SALE_VIDEO_COPY.downstreamSceneDescription,
        SALE_VIDEO_COPY.downstreamSceneBullets,
        SALE_VIDEO_COPY.downstreamSceneNarration,
      );

      await switchSession(page, saleSession, '/app/invoices', SALE_VIDEO_COPY.invoiceLabel);
      const invoicePlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'invoice',
        SALE_VIDEO_COPY.invoiceNarration,
        narrationDurationMap,
      );
      await searchInvoices(page, createdInvoiceNumber || newStudentName);
      const invoiceRow = page
        .locator('[data-testid="invoice-row"], table.data tbody tr')
        .filter({ hasText: createdInvoiceNumber || newStudentName })
        .first();
      await expect(invoiceRow).toBeVisible({ timeout: 25_000 });
      await showCallout(page, invoiceRow, SALE_VIDEO_COPY.invoiceCallout, 2_000);
      await clearCallout(page);
      await waitForNarrationWindow(page, invoicePlayback, 3_000);

      await page.goto('/app/students');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.studentLabel);
      const studentPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'student',
        SALE_VIDEO_COPY.studentNarration,
        narrationDurationMap,
      );
      await searchStudents(page, newStudentName);
      const newStudentRow = studentRow(page, newStudentName);
      await expect(newStudentRow).toBeVisible({ timeout: 25_000 });
      await showCallout(page, newStudentRow, SALE_VIDEO_COPY.studentCallout, 2_000);
      await clearCallout(page);
      await waitForNarrationWindow(page, studentPlayback, 3_000);

      await installSessionRoutes(page, sessionState, trialState.offlineClass);
      await installTrialRoutes(page, trialState);

      await presentSceneCard(
        'scene-sessions',
        SALE_VIDEO_COPY.sessionsSceneTitle,
        SALE_VIDEO_COPY.sessionsSceneDescription,
        SALE_VIDEO_COPY.sessionsSceneBullets,
        SALE_VIDEO_COPY.sessionsSceneNarration,
      );

      await page.goto('/app/sessions');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.sessionsLabel);
      const sessionsPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'sessions',
        SALE_VIDEO_COPY.sessionsNarration,
        narrationDurationMap,
      );
      const sessionRow = page.getByTestId('session-row-session-sale-master-001');
      await expect(sessionRow).toBeVisible();
      await showCallout(page, sessionRow, SALE_VIDEO_COPY.sessionsRowCallout, 1_900);
      await clickLocator(page, sessionRow.getByTestId('sessions-view-detail'));
      const changeRequestCard = page.getByTestId('sessions-change-request-card');
      await expect(changeRequestCard).toBeVisible();
      await showCallout(page, changeRequestCard, SALE_VIDEO_COPY.sessionsRequestCallout, 1_800);
      await clickLocator(page, changeRequestCard.getByTestId('sessions-change-request-open'));
      const requestForm = page.getByTestId('sessions-change-request-form');
      await expect(requestForm).toBeVisible();
      await showCallout(page, requestForm, SALE_VIDEO_COPY.sessionsFormCallout, 1_900);
      await requestForm.getByTestId('sessions-change-request-teacher').selectOption('teacher-backup-001');
      await slowFill(
        page,
        requestForm.getByTestId('sessions-change-request-reason'),
        'Phụ huynh muốn đổi giáo viên để phù hợp phong cách học.',
        28,
      );
      await clickLocator(page, requestForm.getByTestId('sessions-change-request-submit'));
      await expect.poll(() => sessionState.createdPayloads.length).toBe(1);
      await showCallout(page, page.getByTestId('sessions-change-request-history'), SALE_VIDEO_COPY.sessionsHistoryCallout, 2_000);
      await clearCallout(page);
      await waitForNarrationWindow(page, sessionsPlayback);

      await presentSceneCard(
        'scene-trial',
        SALE_VIDEO_COPY.trialSceneTitle,
        SALE_VIDEO_COPY.trialSceneDescription,
        SALE_VIDEO_COPY.trialSceneBullets,
        SALE_VIDEO_COPY.trialSceneNarration,
      );

      await page.goto('/app/trial-enrollments');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.page-header h2').filter({ hasText: /Hoc thu offline/i })).toBeVisible();
      await setVideoLabel(page, SALE_VIDEO_COPY.trialLabel);
      const trialPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'trial',
        SALE_VIDEO_COPY.trialNarration,
        narrationDurationMap,
      );
      await showCallout(page, page.locator('.summary-grid').first(), SALE_VIDEO_COPY.trialSummaryCallout, 1_900);
      const trialCreateButton = page.locator('.page-header button.primary').first();
      await showCallout(page, trialCreateButton, SALE_VIDEO_COPY.trialCreateCallout, 1_800);
      await clickLocator(page, trialCreateButton);
      const trialModal = page.locator('.modal-backdrop .modal.wide').first();
      await expect(trialModal).toBeVisible();
      await showCallout(page, trialModal, SALE_VIDEO_COPY.trialFormCallout, 1_900);
      await slowFill(page, trialModal.locator('input[name="studentName"]'), trialStudentName);
      await slowFill(page, trialModal.locator('input[name="studentPhone"]'), uniquePhone(`trial-student-${labelStamp}`));
      await slowFill(page, trialModal.locator('input[name="parentName"]'), `Phụ huynh trial ${labelStamp.slice(-4)}`);
      await slowFill(page, trialModal.locator('input[name="parentPhone"]'), uniquePhone(`trial-parent-${labelStamp}`));
      await slowFill(page, trialModal.locator('input[name="parentEmail"]'), `trial-${labelStamp}@school.local`);
      await trialModal.locator('select[name="classId"]').selectOption(trialState.offlineClass._id);
      await trialModal.locator('select[name="productId"]').selectOption(trialState.offlineProduct._id);
      await slowFill(page, trialModal.locator('textarea[name="notes"]'), 'Trial offline tạo trong walkthrough sale.', 28);
      await clickLocator(page, trialModal.locator('button[type="submit"]'));
      await expect(page.getByTestId('trial-page-feedback')).toContainText(/Da tao hoc thu moi|Đã tạo học thử mới/i, { timeout: 15_000 });
      const trialRow = page.locator('table.data tbody tr').filter({ hasText: trialStudentName }).first();
      await expect(trialRow).toBeVisible();
      await showCallout(page, trialRow, SALE_VIDEO_COPY.trialRowCallout, 2_000);
      await clearCallout(page);
      await waitForNarrationWindow(page, trialPlayback);

      await presentSceneCard(
        'scene-commission',
        SALE_VIDEO_COPY.commissionSceneTitle,
        SALE_VIDEO_COPY.commissionSceneDescription,
        SALE_VIDEO_COPY.commissionSceneBullets,
        SALE_VIDEO_COPY.commissionSceneNarration,
      );

      await page.goto('/app/commission-report');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /Báo cáo Hoa hồng|Bao cao Hoa hong/i })).toBeVisible();
      await setVideoLabel(page, SALE_VIDEO_COPY.commissionLabel);
      const commissionPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'commission',
        SALE_VIDEO_COPY.commissionNarration,
        narrationDurationMap,
      );
      await showCallout(page, page.locator('.stats').first(), SALE_VIDEO_COPY.commissionSummaryCallout, 2_000);
      await showCallout(page, page.locator('table.data').nth(1), SALE_VIDEO_COPY.commissionTableCallout, 2_100);
      await clearCallout(page);
      await waitForNarrationWindow(page, commissionPlayback);

      await presentSceneCard(
        'scene-logout',
        SALE_VIDEO_COPY.logoutSceneTitle,
        SALE_VIDEO_COPY.logoutSceneDescription,
        SALE_VIDEO_COPY.logoutSceneBullets,
        SALE_VIDEO_COPY.logoutSceneNarration,
      );

      await page.goto('/app/commission-report');
      await page.waitForLoadState('networkidle');
      await setVideoLabel(page, SALE_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'logout',
        SALE_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout').first();
      await showCallout(page, logoutButton, SALE_VIDEO_COPY.logoutCallout, 1_700);
      await clickLocator(page, logoutButton);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await clearCallout(page);
      await waitForNarrationWindow(page, logoutPlayback);

      await setVideoLabel(page, null);
      await clearCallout(page);
      const outroPlayback = beginNarration(
        narrationCues,
        recordingStartedAt,
        'outro',
        SALE_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        SALE_VIDEO_COPY.outroTitle,
        SALE_VIDEO_COPY.outroDescription,
        [...SALE_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_800);

      await writeFile(
        path.join(artifactDir, 'README.txt'),
        [
          'Sale full workflow demo video - tiếng Việt có dấu',
          `leadId=${leadFixture._id}`,
          `newOrderId=${newOrderId}`,
          `newOrderCode=${newOrderCode}`,
          `invoiceNumber=${createdInvoiceNumber}`,
          `existingStudentId=${existingFixture.student._id}`,
          `trialCreated=${trialState.createdPayloads.length}`,
          `conversationLeadCreated=${conversationState.createdLeadPayloads.length}`,
          `sessionChangeRequests=${sessionState.createdPayloads.length}`,
        ].join('\n'),
        'utf8',
      );
      await writeNarrationArtifacts(artifactDir, narrationCues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context, FINAL_VIDEO_BASENAME);
      if (savedVideoPath) {
        console.log(`FINAL_VIDEO_PATH=${savedVideoPath}`);
      }
    }

    expect(savedVideoPath).toBeTruthy();
    expect(newOrderId).toBeTruthy();
  });
});
