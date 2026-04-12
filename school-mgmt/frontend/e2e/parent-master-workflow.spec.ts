import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { PARENT_VIDEO_COPY } from './parent-video-copy';

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
const FINAL_VIDEO_BASENAME = `UI_PhuHuynh_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const VIDEO_TEST_TITLE = 'records the full parent master workflow with HD demo pacing';
const PARENT_TOPUP_ALERT = 'Yêu cầu nạp tiền đã được gửi. Kế toán sẽ duyệt trong thời gian sớm nhất.';
const RECEIPT_UPLOAD_URL = '/uploads/wallets/parent-topup-demo.png';
const RECEIPT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAIAAACQKrqGAAAAG0lEQVR4nGP8z/D/PwMDAwMjI8NRA0YNGDVw1AAAf8wCF1ylgKsAAAAASUVORK5CYII=',
  'base64',
);

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
    '# Parent Full Workflow Narration',
    '',
    'Danh sach cue de render long tieng cho video phu huynh.',
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

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nowIso(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

async function jsonResponse(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function captureSingleDialog(page: Page, action: () => Promise<void>): Promise<string> {
  const messages: string[] = [];
  const handler = async (dialog: { message: () => string; accept: () => Promise<void> }) => {
    messages.push(dialog.message());
    await dialog.accept();
  };

  page.on('dialog', handler);

  try {
    await action();
    await expect.poll(() => messages.length).toBe(1);
    await page.waitForTimeout(150);
    return messages[0];
  } finally {
    page.off('dialog', handler);
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
        label.style.maxWidth = '860px';
        label.style.padding = '12px 16px';
        label.style.borderRadius = '14px';
        label.style.background = 'rgba(15, 23, 42, 0.84)';
        label.style.color = '#e2e8f0';
        label.style.font = '600 15px/1.55 "Segoe UI", system-ui, sans-serif';
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
        document.body.appendChild(callout);
      }

      let calloutText = document.getElementById(CALLOUT_TEXT_ID) as HTMLDivElement | null;
      if (!calloutText) {
        calloutText = document.createElement('div');
        calloutText.id = CALLOUT_TEXT_ID;
        calloutText.style.position = 'fixed';
        calloutText.style.left = '0';
        calloutText.style.top = '0';
        calloutText.style.maxWidth = '380px';
        calloutText.style.padding = '10px 14px';
        calloutText.style.borderRadius = '14px';
        calloutText.style.background = 'rgba(220, 38, 38, 0.95)';
        calloutText.style.color = '#fff';
        calloutText.style.font = '700 14px/1.45 "Segoe UI", system-ui, sans-serif';
        calloutText.style.boxShadow = '0 18px 36px rgba(127, 29, 29, 0.35)';
        calloutText.style.pointerEvents = 'none';
        calloutText.style.zIndex = '2147483646';
        calloutText.style.opacity = '0';
        calloutText.style.transition = 'opacity 140ms ease, left 180ms ease, top 180ms ease';
        document.body.appendChild(calloutText);
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

        const maxLeft = Math.max(12, window.innerWidth - 390);
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

async function setVideoLabel(page: Page, message: string | null): Promise<void> {
  await page.evaluate((value) => {
    const fn = (window as any).__codexVideoLabel as ((msg: string | null) => void) | undefined;
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
      value: { x: number; y: number; width: number; height: number } | null,
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
          radial-gradient(circle at top left, rgba(15,118,110,.18), transparent 36%),
          radial-gradient(circle at bottom right, rgba(37,99,235,.18), transparent 42%),
          linear-gradient(135deg, #020617 0%, #0f172a 45%, #1f2937 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", system-ui, sans-serif;
      }
      .card {
        width: min(1080px, calc(100vw - 80px));
        border: 1px solid rgba(148,163,184,.24);
        border-radius: 28px;
        padding: 42px 46px;
        background: rgba(15,23,42,.72);
        box-shadow: 0 24px 80px rgba(2,6,23,.45);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(45, 212, 191, .14);
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
      <div class="eyebrow">Parent Workflow</div>
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
          radial-gradient(circle at top left, rgba(20, 184, 166, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.16), transparent 24%),
          linear-gradient(135deg, #0f172a 0%, #111827 48%, #1f2937 100%);
        color: #e2e8f0;
      }
      .shell {
        width: min(1260px, calc(100vw - 72px));
        padding: 34px 38px 40px;
        border-radius: 30px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.18);
        box-shadow: 0 34px 90px rgba(15, 23, 42, 0.36);
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
        color: rgba(226, 232, 240, 0.92);
      }
      .roadmap {
        margin-top: 30px;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
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
        background: linear-gradient(135deg, rgba(20, 184, 166, 0.26), rgba(37, 99, 235, 0.18));
        border-color: rgba(45, 212, 191, 0.62);
        box-shadow: 0 20px 44px rgba(20, 184, 166, 0.14);
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
      <p class="eyebrow">Parent Journey</p>
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="roadmap">
        ${steps
          .map(
            (step, index) => `
              <article class="step ${activeIndex === index ? 'active' : ''}">
                <span class="step-num">${String(index + 1).padStart(2, '0')}</span>
                <h2 class="step-title">${step}</h2>
                <p class="step-copy">Chặng ${index + 1} trong hành trình phụ huynh sử dụng hệ thống.</p>
              </article>
            `,
          )
          .join('')}
      </div>
      <p class="legend">
        ${activeIndex === null
          ? 'Màn hình này dùng để giới thiệu toàn bộ roadmap trước khi vào từng chặng thao tác.'
          : `Chúng ta đang đi vào chặng ${activeIndex + 1} của luồng phụ huynh.`}
      </p>
    </section>
  `);
  await page.waitForLoadState('domcontentloaded');
}

function collectNarrationTexts(copy: typeof PARENT_VIDEO_COPY): string[] {
  return [
    copy.introNarration,
    copy.roadmapNarration,
    copy.dashboardSceneNarration,
    copy.dashboardNarration,
    copy.progressSceneNarration,
    copy.progressNarration,
    copy.attendanceSceneNarration,
    copy.attendanceNarration,
    copy.calendarSceneNarration,
    copy.calendarNarration,
    copy.confirmSceneNarration,
    copy.confirmNarration,
    copy.invoicesSceneNarration,
    copy.invoicesNarration,
    copy.walletSceneNarration,
    copy.walletNarration,
    copy.chatSceneNarration,
    copy.chatNarration,
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

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(180);
}

type ParentUserFixture = {
  _id: string;
  sub: string;
  email: string;
  role: 'PARENT';
  fullName: string;
  userCode: string;
  phone: string;
};

type TeacherFixture = {
  _id: string;
  email: string;
  fullName: string;
  role: 'TEACHER';
  userCode: string;
};

type SupportUserFixture = {
  _id: string;
  email: string;
  fullName: string;
  role: 'OPS' | 'SALE' | 'DIRECTOR';
  userCode: string;
};

type StudentFixture = {
  _id: string;
  fullName: string;
  studentCode: string;
  grade: string;
  subjects: string[];
};

type ClassFixture = {
  _id: string;
  code: string;
  name: string;
  classMode: 'ONLINE' | 'OFFLINE';
  teacherId: string;
  studentIds: string[];
};

type SessionFixture = {
  _id: string;
  classId: string;
  studentId: string;
  teacherId: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  durationMinutes: number;
  amountCharged: number;
  teacherPayout: number;
  sessionType: string;
  status: 'SCHEDULED' | 'TEACHER_COMPLETED' | 'FINALIZED';
  hasTeachingReport: boolean;
  topicsCovered?: string;
  homework?: string;
  teacherNotes?: string;
  parentNotes?: string;
  parentRating?: number;
  teachingReport?: {
    lessonContent?: string;
    studentAttitude?: string;
    teacherComment?: string;
    homework?: string;
    submittedAt?: string;
  };
  confirmation?: {
    teacherCompletedAt?: string;
    parentConfirmedAt?: string;
    finalizedAt?: string;
  };
};

type InvoiceFixture = {
  _id: string;
  invoiceNumber: string;
  studentId: string;
  classId: string;
  sessions: number;
  bonusSessions?: number;
  trialSessions?: number;
  pricePerSession: number;
  amount: number;
  sessionsRemaining: number;
  bonusSessionsRemaining?: number;
  trialSessionsRemaining?: number;
  status: 'APPROVED' | 'PENDING_APPROVAL' | 'REJECTED';
  createdAt: string;
};

type LedgerFixture = {
  _id: string;
  walletId: string;
  userId: string;
  type: string;
  status: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description?: string;
  paymentMethod?: string;
  transactionRef?: string;
  createdAt: string;
};

type AttendanceFixture = {
  _id: string;
  studentId: string;
  date: string;
  className: string;
  classCode: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note: string;
  parentConfirm: boolean;
};

type ProgressStudentFixture = {
  studentId: string;
  studentName: string;
  evaluations: {
    averagePerformance: number;
    averageEngagement: number;
    averageComprehension: number;
  };
  progress: {
    sessionsCompleted: number;
    sessionsTotal: number;
    classes: Array<{ className: string; completed: number; total: number }>;
  };
  homework: Array<{
    topic: string;
    assignedDate: string;
    dueDate: string;
    status: string;
    score?: number | null;
  }>;
  teacherComments: Array<{
    date: string;
    teacherName: string;
    className: string;
    comment: string;
  }>;
};

type ConversationParticipant = {
  _id: string;
  fullName: string;
  role: string;
};

type ConversationFixture = {
  _id: string;
  participants: ConversationParticipant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  conversationKind?: string;
  topicStudentId?: { _id: string; fullName: string; studentCode: string };
  topicStudentName?: string;
};

type MessageFixture = {
  _id: string;
  senderId: { _id: string; fullName: string; role: string };
  senderType?: string;
  content: string;
  createdAt?: string;
  readAt?: string | null;
};

type WorkflowState = {
  user: ParentUserFixture;
  teachers: TeacherFixture[];
  supportUsers: SupportUserFixture[];
  students: StudentFixture[];
  classes: ClassFixture[];
  sessions: SessionFixture[];
  invoices: InvoiceFixture[];
  wallet: {
    _id: string;
    userId: {
      _id: string;
      fullName: string;
      email: string;
      phone: string;
      role: 'PARENT';
    };
    balance: number;
    totalTopUp: number;
    totalDeducted: number;
    totalRefunded: number;
    status: string;
    lastTransactionAt: string;
  };
  myLedger: LedgerFixture[];
  attendance: AttendanceFixture[];
  progressStudents: ProgressStudentFixture[];
  conversations: ConversationFixture[];
  messagesByConversationId: Record<string, MessageFixture[]>;
  today: string;
  yesterday: string;
  twoDaysAgo: string;
  tomorrow: string;
  nextWeek: string;
  loginBodies: Array<{ email: string; password: string }>;
  confirmBodies: Array<Record<string, unknown>>;
  topUpBodies: Array<Record<string, unknown>>;
  chatSendBodies: Array<Record<string, unknown>>;
  readConversationIds: string[];
  nextConversationId: number;
  nextMessageId: number;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function buildParentWorkflowState(): WorkflowState {
  const baseDate = new Date(`${RUN_DATE}T09:00:00`);
  const today = formatLocalDateInput(baseDate);
  const yesterday = formatLocalDateInput(addDays(baseDate, -1));
  const twoDaysAgo = formatLocalDateInput(addDays(baseDate, -2));
  const tomorrow = formatLocalDateInput(addDays(baseDate, 1));
  const nextWeek = formatLocalDateInput(addDays(baseDate, 6));

  const user: ParentUserFixture = {
    _id: 'parent-workflow-001',
    sub: 'parent-workflow-001',
    email: 'parent.demo@school.local',
    role: 'PARENT',
    fullName: 'Nguyễn Mai Anh',
    userCode: 'PH001',
    phone: '0901000200',
  };

  const teachers: TeacherFixture[] = [
    { _id: 'teacher-parent-001', email: 'lananh.teacher@school.local', fullName: 'Nguyễn Lan Anh', role: 'TEACHER', userCode: 'GV001' },
    { _id: 'teacher-parent-002', email: 'hainam.teacher@school.local', fullName: 'Trần Hải Nam', role: 'TEACHER', userCode: 'GV002' },
  ];

  const supportUsers: SupportUserFixture[] = [
    { _id: 'ops-parent-001', email: 'ops.demo@school.local', fullName: 'Trần Vận Hành', role: 'OPS', userCode: 'OPS001' },
    { _id: 'sale-parent-001', email: 'sale.demo@school.local', fullName: 'Lê Tư Vấn', role: 'SALE', userCode: 'SALE001' },
    { _id: 'director-parent-001', email: 'director.demo@school.local', fullName: 'Phạm Điều Phối', role: 'DIRECTOR', userCode: 'DIR001' },
  ];

  const students: StudentFixture[] = [
    { _id: 'student-parent-001', fullName: 'Minh Anh', studentCode: 'HS001', grade: '5', subjects: ['Toán tư duy', 'Tiếng Anh giao tiếp'] },
    { _id: 'student-parent-002', fullName: 'Bảo Châu', studentCode: 'HS002', grade: '3', subjects: ['Khoa học', 'Tiếng Anh'] },
  ];

  const classes: ClassFixture[] = [
    { _id: 'class-parent-001', code: 'MATH-P05', name: 'Toán Tư Duy 5A', classMode: 'ONLINE', teacherId: teachers[0]._id, studentIds: [students[0]._id] },
    { _id: 'class-parent-002', code: 'ENG-S03', name: 'English Starters 3B', classMode: 'ONLINE', teacherId: teachers[1]._id, studentIds: [students[1]._id] },
  ];

  const sessions: SessionFixture[] = [
    {
      _id: 'session-parent-confirm-001',
      classId: classes[0]._id,
      studentId: students[0]._id,
      teacherId: teachers[0]._id,
      scheduledDate: yesterday,
      scheduledStartTime: '18:00',
      scheduledEndTime: '19:00',
      durationMinutes: 60,
      amountCharged: 180_000,
      teacherPayout: 110_000,
      sessionType: 'REGULAR',
      status: 'TEACHER_COMPLETED',
      hasTeachingReport: true,
      topicsCovered: 'Ôn quy luật dãy số và giải bài toán suy luận.',
      homework: 'Hoàn thành worksheet trang 12.',
      teacherNotes: 'Con tiếp thu tốt nhưng cần luyện thêm tốc độ.',
      teachingReport: {
        lessonContent: 'Ôn quy luật dãy số, bài toán suy luận và phần luyện tập cuối buổi.',
        studentAttitude: 'Chủ động trả lời và hợp tác tốt.',
        teacherComment: 'Tiến bộ tốt, cần luyện thêm bước trình bày lời giải.',
        homework: 'Làm worksheet trang 12 và chụp ảnh nộp trước buổi sau.',
        submittedAt: nowIso(-1_200),
      },
      confirmation: {
        teacherCompletedAt: nowIso(-1_150),
      },
    },
    {
      _id: 'session-parent-finalized-001',
      classId: classes[1]._id,
      studentId: students[1]._id,
      teacherId: teachers[1]._id,
      scheduledDate: twoDaysAgo,
      scheduledStartTime: '17:30',
      scheduledEndTime: '18:30',
      durationMinutes: 60,
      amountCharged: 160_000,
      teacherPayout: 100_000,
      sessionType: 'REGULAR',
      status: 'FINALIZED',
      hasTeachingReport: true,
      parentRating: 5,
      parentNotes: 'Con học tốt và hiểu bài rõ hơn sau buổi này.',
      teachingReport: {
        lessonContent: 'Luyện speaking theo chủ đề Family và School.',
        studentAttitude: 'Tự tin hơn ở phần giới thiệu bản thân.',
        teacherComment: 'Cần tăng thêm thời gian luyện phát âm cuối âm.',
        homework: 'Luyện đọc đoạn hội thoại và ghi âm lại.',
        submittedAt: nowIso(-2_000),
      },
      confirmation: {
        teacherCompletedAt: nowIso(-1_950),
        parentConfirmedAt: nowIso(-1_900),
        finalizedAt: nowIso(-1_850),
      },
    },
    {
      _id: 'session-parent-upcoming-001',
      classId: classes[0]._id,
      studentId: students[0]._id,
      teacherId: teachers[0]._id,
      scheduledDate: tomorrow,
      scheduledStartTime: '18:00',
      scheduledEndTime: '19:00',
      durationMinutes: 60,
      amountCharged: 180_000,
      teacherPayout: 110_000,
      sessionType: 'REGULAR',
      status: 'SCHEDULED',
      hasTeachingReport: false,
    },
    {
      _id: 'session-parent-upcoming-002',
      classId: classes[1]._id,
      studentId: students[1]._id,
      teacherId: teachers[1]._id,
      scheduledDate: nextWeek,
      scheduledStartTime: '17:30',
      scheduledEndTime: '18:30',
      durationMinutes: 60,
      amountCharged: 160_000,
      teacherPayout: 100_000,
      sessionType: 'REGULAR',
      status: 'SCHEDULED',
      hasTeachingReport: false,
    },
  ];

  const invoices: InvoiceFixture[] = [
    {
      _id: 'invoice-parent-001',
      invoiceNumber: 'INV-PH-001',
      studentId: students[0]._id,
      classId: classes[0]._id,
      sessions: 12,
      bonusSessions: 2,
      pricePerSession: 150_000,
      amount: 1_800_000,
      sessionsRemaining: 5,
      bonusSessionsRemaining: 1,
      status: 'APPROVED',
      createdAt: `${today}T08:00:00.000Z`,
    },
    {
      _id: 'invoice-parent-002',
      invoiceNumber: 'INV-PH-002',
      studentId: students[1]._id,
      classId: classes[1]._id,
      sessions: 10,
      trialSessions: 1,
      pricePerSession: 120_000,
      amount: 1_200_000,
      sessionsRemaining: 3,
      trialSessionsRemaining: 1,
      status: 'PENDING_APPROVAL',
      createdAt: `${yesterday}T08:00:00.000Z`,
    },
  ];

  const wallet = {
    _id: 'wallet-parent-001',
    userId: {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    balance: 620_000,
    totalTopUp: 3_000_000,
    totalDeducted: 2_380_000,
    totalRefunded: 0,
    status: 'ACTIVE',
    lastTransactionAt: nowIso(-120),
  };

  const myLedger: LedgerFixture[] = [
    {
      _id: 'ledger-parent-003',
      walletId: wallet._id,
      userId: user._id,
      type: 'SESSION_DEDUCT',
      status: 'APPROVED',
      amount: 180_000,
      balanceBefore: 800_000,
      balanceAfter: 620_000,
      description: 'Trừ buổi học Toán Tư Duy 5A',
      createdAt: nowIso(-180),
    },
    {
      _id: 'ledger-parent-002',
      walletId: wallet._id,
      userId: user._id,
      type: 'SESSION_DEDUCT',
      status: 'APPROVED',
      amount: 200_000,
      balanceBefore: 1_000_000,
      balanceAfter: 800_000,
      description: 'Trừ buổi học English Starters 3B',
      createdAt: nowIso(-480),
    },
    {
      _id: 'ledger-parent-001',
      walletId: wallet._id,
      userId: user._id,
      type: 'TOP_UP',
      status: 'APPROVED',
      amount: 800_000,
      balanceBefore: 200_000,
      balanceAfter: 1_000_000,
      description: 'Nạp ví học phí tháng này',
      paymentMethod: 'BANK_TRANSFER',
      transactionRef: 'FT240401001',
      createdAt: nowIso(-1_200),
    },
  ];

  const attendance: AttendanceFixture[] = [
    {
      _id: 'attendance-parent-001',
      studentId: students[0]._id,
      date: `${twoDaysAgo}T00:00:00.000Z`,
      className: classes[0].name,
      classCode: classes[0].code,
      status: 'PRESENT',
      note: 'Có mặt đầy đủ và vào lớp đúng giờ.',
      parentConfirm: true,
    },
    {
      _id: 'attendance-parent-002',
      studentId: students[0]._id,
      date: `${yesterday}T00:00:00.000Z`,
      className: classes[0].name,
      classCode: classes[0].code,
      status: 'LATE',
      note: 'Vào muộn 5 phút do phụ huynh đổi thiết bị.',
      parentConfirm: false,
    },
    {
      _id: 'attendance-parent-003',
      studentId: students[1]._id,
      date: `${twoDaysAgo}T00:00:00.000Z`,
      className: classes[1].name,
      classCode: classes[1].code,
      status: 'ABSENT',
      note: 'Xin nghỉ vì bận lịch gia đình.',
      parentConfirm: false,
    },
    {
      _id: 'attendance-parent-004',
      studentId: students[1]._id,
      date: `${today}T00:00:00.000Z`,
      className: classes[1].name,
      classCode: classes[1].code,
      status: 'PRESENT',
      note: 'Có mặt đầy đủ.',
      parentConfirm: true,
    },
  ];

  const progressStudents: ProgressStudentFixture[] = [
    {
      studentId: students[0]._id,
      studentName: students[0].fullName,
      evaluations: { averagePerformance: 88, averageEngagement: 91, averageComprehension: 85 },
      progress: {
        sessionsCompleted: 7,
        sessionsTotal: 10,
        classes: [{ className: classes[0].name, completed: 7, total: 10 }],
      },
      homework: [
        {
          topic: 'Worksheet dãy số trang 12',
          assignedDate: `${yesterday}T00:00:00.000Z`,
          dueDate: `${tomorrow}T00:00:00.000Z`,
          status: 'IN_PROGRESS',
          score: null,
        },
        {
          topic: 'Bài luyện suy luận logic',
          assignedDate: `${twoDaysAgo}T00:00:00.000Z`,
          dueDate: `${yesterday}T00:00:00.000Z`,
          status: 'GRADED',
          score: 9,
        },
      ],
      teacherComments: [
        {
          date: `${yesterday}T00:00:00.000Z`,
          teacherName: teachers[0].fullName,
          className: classes[0].name,
          comment: 'Minh Anh tiến bộ tốt ở phần suy luận, cần luyện thêm bước trình bày lời giải.',
        },
      ],
    },
    {
      studentId: students[1]._id,
      studentName: students[1].fullName,
      evaluations: { averagePerformance: 82, averageEngagement: 84, averageComprehension: 80 },
      progress: {
        sessionsCompleted: 5,
        sessionsTotal: 8,
        classes: [{ className: classes[1].name, completed: 5, total: 8 }],
      },
      homework: [
        {
          topic: 'Speaking practice chủ đề Family',
          assignedDate: `${twoDaysAgo}T00:00:00.000Z`,
          dueDate: `${today}T00:00:00.000Z`,
          status: 'SUBMITTED',
          score: 8,
        },
      ],
      teacherComments: [
        {
          date: `${twoDaysAgo}T00:00:00.000Z`,
          teacherName: teachers[1].fullName,
          className: classes[1].name,
          comment: 'Bảo Châu tự tin hơn ở phần speaking, cần tăng thêm luyện phát âm cuối âm.',
        },
      ],
    },
  ];

  const conversations: ConversationFixture[] = [
    {
      _id: 'conversation-parent-001',
      participants: [
        { _id: supportUsers[0]._id, fullName: supportUsers[0].fullName, role: supportUsers[0].role },
        { _id: user._id, fullName: user.fullName, role: user.role },
      ],
      lastMessage: 'Ops đã cập nhật giúp báo cáo tiến độ của Minh Anh sau buổi gần nhất.',
      lastMessageAt: nowIso(-15),
      unreadCount: 1,
      conversationKind: 'PARENT_SUPPORT',
      topicStudentId: { _id: students[0]._id, fullName: students[0].fullName, studentCode: students[0].studentCode },
      topicStudentName: students[0].fullName,
    },
    {
      _id: 'conversation-parent-002',
      participants: [
        { _id: supportUsers[1]._id, fullName: supportUsers[1].fullName, role: supportUsers[1].role },
        { _id: user._id, fullName: user.fullName, role: user.role },
      ],
      lastMessage: 'Sale đã ghi nhận yêu cầu đổi lịch học cho Bảo Châu tuần tới.',
      lastMessageAt: nowIso(-90),
      unreadCount: 0,
      conversationKind: 'PARENT_SUPPORT',
      topicStudentId: { _id: students[1]._id, fullName: students[1].fullName, studentCode: students[1].studentCode },
      topicStudentName: students[1].fullName,
    },
  ];

  const messagesByConversationId: Record<string, MessageFixture[]> = {
    'conversation-parent-001': [
      {
        _id: 'message-parent-001',
        senderId: { _id: user._id, fullName: user.fullName, role: user.role },
        senderType: 'CUSTOMER',
        content: 'Cho mình hỏi trung tâm đã cập nhật tiến độ học mới nhất của Minh Anh chưa?',
        createdAt: nowIso(-40),
      },
      {
        _id: 'message-parent-002',
        senderId: { _id: supportUsers[0]._id, fullName: supportUsers[0].fullName, role: supportUsers[0].role },
        senderType: 'HUMAN',
        content: 'Ops đã cập nhật giúp báo cáo tiến độ của Minh Anh sau buổi gần nhất.',
        createdAt: nowIso(-15),
        readAt: nowIso(-10),
      },
    ],
    'conversation-parent-002': [
      {
        _id: 'message-parent-003',
        senderId: { _id: user._id, fullName: user.fullName, role: user.role },
        senderType: 'CUSTOMER',
        content: 'Cho mình xin phương án đổi lịch cho Bảo Châu vào tuần tới.',
        createdAt: nowIso(-120),
      },
      {
        _id: 'message-parent-004',
        senderId: { _id: supportUsers[1]._id, fullName: supportUsers[1].fullName, role: supportUsers[1].role },
        senderType: 'HUMAN',
        content: 'Sale đã ghi nhận yêu cầu đổi lịch học cho Bảo Châu tuần tới.',
        createdAt: nowIso(-90),
        readAt: nowIso(-80),
      },
    ],
  };

  return {
    user,
    teachers,
    supportUsers,
    students,
    classes,
    sessions,
    invoices,
    wallet,
    myLedger,
    attendance,
    progressStudents,
    conversations,
    messagesByConversationId,
    today,
    yesterday,
    twoDaysAgo,
    tomorrow,
    nextWeek,
    loginBodies: [],
    confirmBodies: [],
    topUpBodies: [],
    chatSendBodies: [],
    readConversationIds: [],
    nextConversationId: 3,
    nextMessageId: 5,
  };
}

function findTeacher(state: WorkflowState, teacherId: string): TeacherFixture {
  const teacher = state.teachers.find((item) => item._id === teacherId);
  if (!teacher) throw new Error(`Missing teacher ${teacherId}`);
  return teacher;
}

function findStudent(state: WorkflowState, studentId: string): StudentFixture {
  const student = state.students.find((item) => item._id === studentId);
  if (!student) throw new Error(`Missing student ${studentId}`);
  return student;
}

function findClass(state: WorkflowState, classId: string): ClassFixture {
  const cls = state.classes.find((item) => item._id === classId);
  if (!cls) throw new Error(`Missing class ${classId}`);
  return cls;
}

function findClassByCode(state: WorkflowState, classCode: string): ClassFixture {
  const cls = state.classes.find((item) => item.code === classCode);
  if (!cls) throw new Error(`Missing class with code ${classCode}`);
  return cls;
}

function findSupportUser(state: WorkflowState, userId: string): SupportUserFixture {
  const support = state.supportUsers.find((item) => item._id === userId);
  if (!support) throw new Error(`Missing support user ${userId}`);
  return support;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function studentAge(student: StudentFixture): number {
  const gradeValue = Number(student.grade);
  if (Number.isFinite(gradeValue) && gradeValue > 0) {
    return gradeValue + 5;
  }
  return 10;
}

function studentPayload(state: WorkflowState, student: StudentFixture) {
  return {
    _id: student._id,
    studentCode: student.studentCode,
    fullName: student.fullName,
    age: studentAge(student),
    grade: student.grade,
    parentName: state.user.fullName,
    parentPhone: state.user.phone,
    faceImage: '',
  };
}

function usersDirectoryPayload(state: WorkflowState) {
  return [
    {
      _id: state.user._id,
      userCode: state.user.userCode,
      email: state.user.email,
      fullName: state.user.fullName,
      role: state.user.role,
      phone: state.user.phone,
    },
    ...state.supportUsers.map((support) => ({
      _id: support._id,
      userCode: support.userCode,
      email: support.email,
      fullName: support.fullName,
      role: support.role,
      phone: '',
    })),
  ];
}

function toSessionResponse(state: WorkflowState, session: SessionFixture) {
  const classItem = findClass(state, session.classId);
  const student = findStudent(state, session.studentId);
  const teacher = findTeacher(state, session.teacherId);

  return {
    _id: session._id,
    classId: {
      _id: classItem._id,
      code: classItem.code,
      name: classItem.name,
      classMode: classItem.classMode,
    },
    studentId: {
      _id: student._id,
      fullName: student.fullName,
      studentCode: student.studentCode,
    },
    teacherId: {
      _id: teacher._id,
      fullName: teacher.fullName,
      email: teacher.email,
    },
    parentUserId: {
      _id: state.user._id,
      fullName: state.user.fullName,
    },
    scheduledDate: `${session.scheduledDate}T00:00:00.000Z`,
    scheduledStartTime: session.scheduledStartTime,
    scheduledEndTime: session.scheduledEndTime,
    durationMinutes: session.durationMinutes,
    amountCharged: session.amountCharged,
    teacherPayout: session.teacherPayout,
    sessionType: session.sessionType,
    status: session.status,
    isPaid: session.status === 'FINALIZED',
    isTeacherPaid: session.status === 'FINALIZED',
    topicsCovered: session.topicsCovered,
    homework: session.homework,
    teacherNotes: session.teacherNotes,
    parentNotes: session.parentNotes,
    parentRating: session.parentRating,
    confirmation: clone(session.confirmation || {}),
    teachingReport: clone(session.teachingReport || {}),
    hasTeachingReport: session.hasTeachingReport,
    createdAt: `${session.scheduledDate}T${session.scheduledStartTime}:00.000Z`,
  };
}

function filterSessions(state: WorkflowState, urlText: string): SessionFixture[] {
  const url = new URL(urlText);
  const classId = (url.searchParams.get('classId') || '').trim();
  const status = (url.searchParams.get('status') || '').trim();
  const fromDate = (url.searchParams.get('fromDate') || '').trim();
  const toDate = (url.searchParams.get('toDate') || '').trim();

  return [...state.sessions]
    .filter((session) => !classId || session.classId === classId)
    .filter((session) => !status || session.status === status)
    .filter((session) => !fromDate || session.scheduledDate >= fromDate)
    .filter((session) => !toDate || session.scheduledDate <= toDate)
    .sort((left, right) =>
      `${left.scheduledDate}T${left.scheduledStartTime}`.localeCompare(
        `${right.scheduledDate}T${right.scheduledStartTime}`,
      ));
}

function buildSessionStats(state: WorkflowState, sessions: SessionFixture[]) {
  const byStatus: Record<string, { count: number; totalCharged: number; totalPayout: number }> = {};

  for (const session of sessions) {
    const bucket = byStatus[session.status] || { count: 0, totalCharged: 0, totalPayout: 0 };
    bucket.count += 1;
    bucket.totalCharged += session.amountCharged;
    bucket.totalPayout += session.teacherPayout;
    byStatus[session.status] = bucket;
  }

  return {
    totalSessions: sessions.length,
    totalRevenue: sessions.reduce((sum, session) => sum + session.amountCharged, 0),
    totalTeacherCost: sessions.reduce((sum, session) => sum + session.teacherPayout, 0),
    byStatus,
  };
}

function buildClassesPayload(state: WorkflowState) {
  return state.classes.map((classItem) => {
    const teacher = findTeacher(state, classItem.teacherId);
    const students = classItem.studentIds.map((studentId) => {
      const student = findStudent(state, studentId);
      return {
        _id: student._id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        email: '',
      };
    });

    return {
      _id: classItem._id,
      code: classItem.code,
      name: classItem.name,
      classMode: classItem.classMode,
      teacher: {
        _id: teacher._id,
        fullName: teacher.fullName,
        email: teacher.email,
        userCode: teacher.userCode,
      },
      students,
      studentCount: students.length,
      totalSessions: state.sessions.filter((session) => session.classId === classItem._id).length,
      sessionsCompleted: state.sessions.filter(
        (session) => session.classId === classItem._id && session.status === 'FINALIZED',
      ).length,
    };
  });
}

function filterAttendanceRecords(state: WorkflowState, urlText: string): AttendanceFixture[] {
  const url = new URL(urlText);
  const fromDate = (url.searchParams.get('fromDate') || '').trim();
  const toDate = (url.searchParams.get('toDate') || '').trim();

  return state.attendance
    .filter((item) => !fromDate || item.date.substring(0, 10) >= fromDate)
    .filter((item) => !toDate || item.date.substring(0, 10) <= toDate)
    .sort((left, right) => right.date.localeCompare(left.date));
}

function buildAttendanceRecordsPayload(state: WorkflowState, urlText: string) {
  const records = filterAttendanceRecords(state, urlText);
  return {
    children: state.students.map((student) => ({
      student: {
        _id: student._id,
        fullName: student.fullName,
      },
      records: records
        .filter((item) => item.studentId === student._id)
        .map((item) => ({
          _id: item._id,
          date: item.date,
          status: item.status,
          className: item.className,
          classCode: item.classCode,
          notes: item.note,
          parentConfirm: item.parentConfirm ? 'OK' : '',
        })),
    })),
  };
}

function buildAttendanceStatsPayload(state: WorkflowState, urlText: string) {
  const records = filterAttendanceRecords(state, urlText);
  return {
    children: state.students.map((student) => {
      const items = records.filter((item) => item.studentId === student._id);
      const total = items.length;
      const present = items.filter((item) => item.status === 'PRESENT').length;
      const absent = items.filter((item) => item.status === 'ABSENT').length;
      const late = items.filter((item) => item.status === 'LATE').length;

      return {
        student: {
          _id: student._id,
          fullName: student.fullName,
        },
        total,
        present,
        absent,
        late,
        presentRate: total > 0 ? Math.round((present / total) * 100) : 0,
        absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
        lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
      };
    }),
  };
}

function buildInvoicesPayload(state: WorkflowState) {
  const children = state.students.map((student) => ({
    student: {
      _id: student._id,
      fullName: student.fullName,
      studentCode: student.studentCode,
    },
    invoices: state.invoices
      .filter((invoice) => invoice.studentId === student._id)
      .map((invoice) => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        classId: {
          _id: invoice.classId,
          name: findClass(state, invoice.classId).name,
        },
        sessions: invoice.sessions,
        bonusSessions: invoice.bonusSessions || 0,
        trialSessions: invoice.trialSessions || 0,
        pricePerSession: invoice.pricePerSession,
        amount: invoice.amount,
        sessionsRemaining: invoice.sessionsRemaining,
        bonusSessionsRemaining: invoice.bonusSessionsRemaining || 0,
        trialSessionsRemaining: invoice.trialSessionsRemaining || 0,
        status: invoice.status,
        createdAt: invoice.createdAt,
      })),
  }));

  return {
    children,
    summary: {
      totalPaid: state.invoices
        .filter((invoice) => invoice.status === 'APPROVED')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      totalPending: state.invoices
        .filter((invoice) => invoice.status === 'PENDING_APPROVAL')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      totalSessionsRemaining: state.invoices.reduce(
        (sum, invoice) =>
          sum
          + Number(invoice.sessionsRemaining || 0)
          + Number(invoice.bonusSessionsRemaining || 0)
          + Number(invoice.trialSessionsRemaining || 0),
        0,
      ),
    },
  };
}

function buildDashboardPayload(state: WorkflowState) {
  const recentSessions = [...state.sessions]
    .sort((left, right) =>
      `${right.scheduledDate}T${right.scheduledStartTime}`.localeCompare(
        `${left.scheduledDate}T${left.scheduledStartTime}`,
      ))
    .map((session) => toSessionResponse(state, session))
    .slice(0, 6);

  const recentTransactions = [...state.myLedger]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8)
    .map((item) => ({
      type: item.type,
      status: item.status,
      amount: item.amount,
      description: item.description,
      createdAt: item.createdAt,
    }));

  const recentAttendance = [...state.attendance]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 6)
    .map((item) => {
      const classItem = findClassByCode(state, item.classCode);
      const teacher = findTeacher(state, classItem.teacherId);
      const student = findStudent(state, item.studentId);
      return {
        date: item.date,
        status: item.status,
        notes: item.note,
        teacherId: {
          _id: teacher._id,
          fullName: teacher.fullName,
        },
        studentId: {
          _id: student._id,
          fullName: student.fullName,
          studentCode: student.studentCode,
        },
        classId: {
          _id: classItem._id,
          name: item.className,
          code: item.classCode,
        },
      };
    });

  const invoiceList = [...state.invoices]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount,
      paymentDate: invoice.createdAt,
      studentId: {
        _id: invoice.studentId,
        fullName: findStudent(state, invoice.studentId).fullName,
        studentCode: findStudent(state, invoice.studentId).studentCode,
      },
      classId: {
        _id: invoice.classId,
        name: findClass(state, invoice.classId).name,
        code: findClass(state, invoice.classId).code,
      },
    }));

  return {
    wallet: clone(state.wallet),
    children: {
      total: state.students.length,
      list: state.students.map((student) => ({
        _id: student._id,
        fullName: student.fullName,
        grade: student.grade,
        subjects: [...student.subjects],
      })),
    },
    sessions: {
      total: state.sessions.length,
      byStatus: {
        SCHEDULED: state.sessions.filter((item) => item.status === 'SCHEDULED').length,
        TEACHER_COMPLETED: state.sessions.filter((item) => item.status === 'TEACHER_COMPLETED').length,
        FINALIZED: state.sessions.filter((item) => item.status === 'FINALIZED').length,
      },
      upcomingCount: state.sessions.filter((item) => item.status === 'SCHEDULED').length,
      needsConfirmation: state.sessions.filter((item) => item.status === 'TEACHER_COMPLETED').length,
    },
    recentSessions,
    recentTransactions,
    invoices: {
      total: state.invoices.length,
      totalPaid: state.invoices
        .filter((invoice) => invoice.status === 'APPROVED')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      list: invoiceList,
    },
    attendance: {
      total: state.attendance.length,
      byStatus: {
        PRESENT: state.attendance.filter((item) => item.status === 'PRESENT').length,
        ABSENT: state.attendance.filter((item) => item.status === 'ABSENT').length,
        LATE: state.attendance.filter((item) => item.status === 'LATE').length,
        EXCUSED: state.attendance.filter((item) => item.status === 'EXCUSED').length,
      },
      recentList: recentAttendance,
    },
    tickets: {
      myTickets: 2,
      openTickets: 1,
    },
  };
}

function buildDailyTasksPayload() {
  return {
    role: 'PARENT',
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: 3,
      overdueTasks: 0,
      dueTodayTasks: 2,
      highPriorityTasks: 2,
    },
    tabs: [
      {
        key: 'today',
        label: 'Hom nay',
        description: 'Checklist phu huynh can theo doi trong ngay.',
        emptyMessage: 'Khong co dau viec can xu ly.',
        count: 3,
        tasks: [
          {
            id: 'parent-task-001',
            type: 'SESSION',
            title: 'Xac nhan buoi hoc da co bao cao',
            detail: 'Kiem tra va xac nhan buoi hoc cho Minh Anh.',
            priority: 'HIGH',
            route: '/app/sessions',
            actionLabel: 'Mo sessions',
          },
          {
            id: 'parent-task-002',
            type: 'FINANCE',
            title: 'Kiem tra vi hoc phi',
            detail: 'Doi chieu so du de dam bao du cho buoi hoc sap toi.',
            priority: 'MEDIUM',
            route: '/app/wallets',
            actionLabel: 'Mo vi',
          },
          {
            id: 'parent-task-003',
            type: 'SUPPORT',
            title: 'Gui cau hoi cho trung tam',
            detail: 'Hoi lich hoc tuan toi va yeu cau can xac nhan.',
            priority: 'MEDIUM',
            route: '/app/parent-chat',
            actionLabel: 'Mo chat',
          },
        ],
      },
    ],
  };
}

function sortedConversations(state: WorkflowState): ConversationFixture[] {
  return [...state.conversations].sort((left, right) =>
    `${right.lastMessageAt || ''}:${right.unreadCount || 0}`.localeCompare(
      `${left.lastMessageAt || ''}:${left.unreadCount || 0}`,
    ));
}

function appendMessageToConversation(
  state: WorkflowState,
  conversationId: string,
  sender: { _id: string; fullName: string; role: string },
  senderType: string,
  content: string,
): MessageFixture {
  const createdAt = new Date(Date.now() + state.nextMessageId * 1_000).toISOString();
  const messageId = `message-parent-${String(state.nextMessageId).padStart(3, '0')}`;
  state.nextMessageId += 1;

  const message: MessageFixture = {
    _id: messageId,
    senderId: {
      _id: sender._id,
      fullName: sender.fullName,
      role: sender.role,
    },
    senderType,
    content,
    createdAt,
    readAt: sender._id === state.user._id ? createdAt : null,
  };

  const messages = state.messagesByConversationId[conversationId] || [];
  state.messagesByConversationId[conversationId] = [...messages, message];

  const conversation = state.conversations.find((item) => item._id === conversationId);
  if (conversation) {
    conversation.lastMessage = content;
    conversation.lastMessageAt = createdAt;
    conversation.unreadCount = sender._id === state.user._id ? 0 : Number(conversation.unreadCount || 0) + 1;
  }

  return message;
}

function createConversationFromSupportMessage(
  state: WorkflowState,
  supportId: string,
  studentId: string | undefined,
  content: string,
): ConversationFixture {
  const support = findSupportUser(state, supportId);
  const student = studentId ? findStudent(state, studentId) : state.students[0];
  const conversationId = `conversation-parent-${String(state.nextConversationId).padStart(3, '0')}`;
  state.nextConversationId += 1;

  const conversation: ConversationFixture = {
    _id: conversationId,
    participants: [
      { _id: support._id, fullName: support.fullName, role: support.role },
      { _id: state.user._id, fullName: state.user.fullName, role: state.user.role },
    ],
    lastMessage: '',
    lastMessageAt: '',
    unreadCount: 0,
    conversationKind: 'PARENT_SUPPORT',
    topicStudentId: {
      _id: student._id,
      fullName: student.fullName,
      studentCode: student.studentCode,
    },
    topicStudentName: student.fullName,
  };

  state.conversations.unshift(conversation);
  state.messagesByConversationId[conversationId] = [];
  appendMessageToConversation(
    state,
    conversationId,
    { _id: state.user._id, fullName: state.user.fullName, role: state.user.role },
    'CUSTOMER',
    content,
  );

  return conversation;
}

class ParentWorkflowPage {
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

  async loginAsParent(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();
    await this.slowFill(this.page.getByTestId('login-email'), 'parent.demo@school.local');
    await this.pause(600);
    await this.slowFill(this.page.getByTestId('login-password'), '123456');
    await this.pause();
    await clickLocator(this.page, this.page.getByTestId('login-submit'));
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }
}

async function installParentWorkflowRoutes(page: Page, state: WorkflowState): Promise<void> {
  const knownSessionIds = state.sessions.map((session) => session._id).join('|');
  const escapedReceiptPath = escapeRegex(RECEIPT_UPLOAD_URL);

  const AUTH_LOGIN_API = new RegExp(`${API_PREFIX_PATTERN}/auth/login(?:\\?.*)?$`);
  const AUTH_LOGOUT_API = new RegExp(`${API_PREFIX_PATTERN}/auth/logout(?:\\?.*)?$`);
  const USERS_ME_API = new RegExp(`${API_PREFIX_PATTERN}/users/me(?:\\?.*)?$`);
  const USERS_DIRECTORY_API = new RegExp(`${API_PREFIX_PATTERN}/users/directory(?:\\?.*)?$`);
  const STUDENTS_API = new RegExp(`${API_PREFIX_PATTERN}/students(?:\\?.*)?$`);
  const NOTIFICATIONS_COUNT_API = new RegExp(`${API_PREFIX_PATTERN}/notifications/unread-count(?:\\?.*)?$`);
  const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
  const DASHBOARD_PARENT_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/parent(?:\\?.*)?$`);
  const PARENT_PROGRESS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/my-children/progress(?:\\?.*)?$`);
  const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);
  const SESSIONS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/stats(?:\\?.*)?$`);
  const SESSIONS_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/sessions(?:\\?.*)?$`);
  const SESSION_DETAIL_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/(${knownSessionIds})(?:\\?.*)?$`);
  const SESSION_CHANGE_REQUESTS_API = new RegExp(
    `${API_PREFIX_PATTERN}/sessions/(${knownSessionIds})/change-requests(?:\\?.*)?$`,
  );
  const SESSION_CONFIRM_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/(${knownSessionIds})/confirm(?:\\?.*)?$`);
  const ATTENDANCE_MY_CHILDREN_STATS_API = new RegExp(
    `${API_PREFIX_PATTERN}/attendance/my-children/stats(?:\\?.*)?$`,
  );
  const ATTENDANCE_MY_CHILDREN_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/my-children(?:\\?.*)?$`);
  const INVOICES_MY_CHILDREN_API = new RegExp(`${API_PREFIX_PATTERN}/invoices/my-children(?:\\?.*)?$`);
  const WALLET_MY_LEDGER_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/me/ledger(?:\\?.*)?$`);
  const WALLET_MY_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/me(?:\\?.*)?$`);
  const WALLET_UPLOAD_RECEIPT_API = new RegExp(
    `${API_PREFIX_PATTERN}/wallets/top-up/upload-receipt(?:\\?.*)?$`,
  );
  const WALLET_TOP_UP_API = new RegExp(`${API_PREFIX_PATTERN}/wallets/top-up(?:\\?.*)?$`);
  const RECEIPT_ASSET_API = new RegExp(`(?:https?://[^/]+)?${escapedReceiptPath}(?:\\?.*)?$`);
  const MESSAGES_UNREAD_COUNT_API = new RegExp(`${API_PREFIX_PATTERN}/messages/unread-count(?:\\?.*)?$`);
  const MESSAGES_CONVERSATIONS_API = new RegExp(`${API_PREFIX_PATTERN}/messages/conversations(?:\\?.*)?$`);
  const MESSAGES_DETAIL_API = new RegExp(
    `${API_PREFIX_PATTERN}/messages/conversations/([^/?]+)/messages(?:\\?.*)?$`,
  );
  const MESSAGES_READ_API = new RegExp(
    `${API_PREFIX_PATTERN}/messages/conversations/([^/?]+)/read(?:\\?.*)?$`,
  );
  const MESSAGES_SEND_TO_CONVERSATION_API = new RegExp(
    `${API_PREFIX_PATTERN}/messages/conversations/([^/?]+)/send(?:\\?.*)?$`,
  );
  const MESSAGES_SEND_API = new RegExp(`${API_PREFIX_PATTERN}/messages/send(?:\\?.*)?$`);

  await page.route(AUTH_LOGIN_API, async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    state.loginBodies.push(clone(body));
    await jsonResponse(route, { user: clone(state.user) }, 201);
  });

  await page.route(AUTH_LOGOUT_API, async (route) => {
    await jsonResponse(route, { ok: true });
  });

  await page.route(USERS_ME_API, async (route) => {
    await jsonResponse(route, {
      _id: state.user._id,
      sub: state.user.sub,
      email: state.user.email,
      role: state.user.role,
      fullName: state.user.fullName,
      userCode: state.user.userCode,
    });
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await jsonResponse(route, usersDirectoryPayload(state));
  });

  await page.route(STUDENTS_API, async (route) => {
    await jsonResponse(route, state.students.map((student) => studentPayload(state, student)));
  });

  await page.route(NOTIFICATIONS_COUNT_API, async (route) => {
    await jsonResponse(route, { count: 1 });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await jsonResponse(route, buildDailyTasksPayload());
  });

  await page.route(DASHBOARD_PARENT_API, async (route) => {
    await jsonResponse(route, buildDashboardPayload(state));
  });

  await page.route(PARENT_PROGRESS_API, async (route) => {
    await jsonResponse(route, {
      students: state.progressStudents.map((studentProgress) => ({
        ...clone(studentProgress),
        studentId: studentProgress.studentId,
        studentName: studentProgress.studentName,
      })),
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await jsonResponse(route, buildClassesPayload(state));
  });

  await page.route(SESSIONS_STATS_API, async (route) => {
    await jsonResponse(route, buildSessionStats(state, filterSessions(state, route.request().url())));
  });

  await page.route(SESSIONS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get('limit') || 20);
    const pageNumber = Number(url.searchParams.get('page') || 1);
    const filtered = filterSessions(state, route.request().url());
    await jsonResponse(route, {
      data: filtered.map((session) => toSessionResponse(state, session)),
      meta: {
        page: pageNumber,
        limit,
        total: filtered.length,
        totalPages: filtered.length === 0 ? 1 : Math.ceil(filtered.length / Math.max(limit, 1)),
      },
    });
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    const match = route.request().url().match(SESSION_DETAIL_API);
    const sessionId = match?.[1] || '';
    const session = state.sessions.find((item) => item._id === sessionId);
    if (!session) {
      await jsonResponse(route, { message: 'Session not found' }, 404);
      return;
    }
    await jsonResponse(route, toSessionResponse(state, session));
  });

  await page.route(SESSION_CONFIRM_API, async (route) => {
    const match = route.request().url().match(SESSION_CONFIRM_API);
    const sessionId = match?.[1] || '';
    const body = (route.request().postDataJSON() || {}) as Record<string, unknown>;
    state.confirmBodies.push(clone(body));

    const session = state.sessions.find((item) => item._id === sessionId);
    if (session) {
      session.status = 'FINALIZED';
      session.parentRating = Number(body['parentRating'] ?? body['overallRating'] ?? body['rating'] ?? 5);
      session.parentNotes = String(body['parentNotes'] || '');
      session.confirmation = {
        ...(session.confirmation || {}),
        parentConfirmedAt: new Date().toISOString(),
        finalizedAt: new Date(Date.now() + 5_000).toISOString(),
      };
    }

    await jsonResponse(route, { ok: true });
  });

  await page.route(ATTENDANCE_MY_CHILDREN_STATS_API, async (route) => {
    await jsonResponse(route, buildAttendanceStatsPayload(state, route.request().url()));
  });

  await page.route(ATTENDANCE_MY_CHILDREN_API, async (route) => {
    await jsonResponse(route, buildAttendanceRecordsPayload(state, route.request().url()));
  });

  await page.route(INVOICES_MY_CHILDREN_API, async (route) => {
    await jsonResponse(route, buildInvoicesPayload(state));
  });

  await page.route(WALLET_MY_LEDGER_API, async (route) => {
    const url = new URL(route.request().url());
    const limit = Number(url.searchParams.get('limit') || 50);
    const pageNumber = Number(url.searchParams.get('page') || 1);
    await jsonResponse(route, {
      data: clone(state.myLedger),
      meta: {
        page: pageNumber,
        limit,
        total: state.myLedger.length,
        totalPages: 1,
      },
    });
  });

  await page.route(WALLET_MY_API, async (route) => {
    await jsonResponse(route, clone(state.wallet));
  });

  await page.route(WALLET_UPLOAD_RECEIPT_API, async (route) => {
    await jsonResponse(route, { url: RECEIPT_UPLOAD_URL });
  });

  await page.route(RECEIPT_ASSET_API, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: RECEIPT_PNG,
    });
  });

  await page.route(WALLET_TOP_UP_API, async (route) => {
    const body = (route.request().postDataJSON() || {}) as Record<string, unknown>;
    state.topUpBodies.push(clone(body));

    const amount = Number(body['amount'] || 0);
    const now = new Date().toISOString();
    const pendingEntry = {
      _id: `ledger-topup-${String(state.topUpBodies.length).padStart(3, '0')}`,
      walletId: state.wallet._id,
      userId: state.user._id,
      type: 'TOP_UP',
      status: 'PENDING_APPROVAL',
      amount,
      balanceBefore: Number(state.wallet.balance || 0),
      balanceAfter: Number(state.wallet.balance || 0),
      description: String(body['description'] || 'Yeu cau nap tien cho vi hoc phi'),
      paymentMethod: String(body['paymentMethod'] || 'BANK_TRANSFER'),
      transactionRef: String(body['transactionRef'] || ''),
      createdAt: now,
    };

    state.wallet.lastTransactionAt = now;
    state.myLedger.unshift(pendingEntry);

    await jsonResponse(route, { ok: true, data: clone(pendingEntry) });
  });

  await page.route(MESSAGES_UNREAD_COUNT_API, async (route) => {
    const count = state.conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0);
    await jsonResponse(route, { count });
  });

  await page.route(MESSAGES_SEND_API, async (route) => {
    const body = (route.request().postDataJSON() || {}) as Record<string, unknown>;
    state.chatSendBodies.push({ kind: 'new-conversation', ...clone(body) });

    const receiverId = String(body['receiverId'] || '');
    const contextStudentId = String(body['contextStudentId'] || '');
    const content = String(body['content'] || '').trim();

    const existingConversation = state.conversations.find((conversation) => {
      const participantIds = conversation.participants.map((participant) => participant._id);
      const topicStudentId =
        typeof conversation.topicStudentId === 'string'
          ? conversation.topicStudentId
          : conversation.topicStudentId?._id || '';
      return participantIds.includes(receiverId) && topicStudentId === contextStudentId;
    });

    if (existingConversation) {
      appendMessageToConversation(
        state,
        existingConversation._id,
        { _id: state.user._id, fullName: state.user.fullName, role: state.user.role },
        'CUSTOMER',
        content,
      );
    } else {
      createConversationFromSupportMessage(
        state,
        receiverId,
        contextStudentId || undefined,
        content,
      );
    }

    await jsonResponse(route, { ok: true });
  });

  await page.route(MESSAGES_CONVERSATIONS_API, async (route) => {
    await jsonResponse(route, clone(sortedConversations(state)));
  });

  await page.route(MESSAGES_READ_API, async (route) => {
    const match = route.request().url().match(MESSAGES_READ_API);
    const conversationId = match?.[1] || '';
    state.readConversationIds.push(conversationId);

    const conversation = state.conversations.find((item) => item._id === conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
    }

    await jsonResponse(route, { ok: true });
  });

  await page.route(MESSAGES_DETAIL_API, async (route) => {
    const match = route.request().url().match(MESSAGES_DETAIL_API);
    const conversationId = match?.[1] || '';
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 50);
    const messages = [...(state.messagesByConversationId[conversationId] || [])].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

    await jsonResponse(route, {
      messages: clone(messages),
      page: pageNumber,
      limit,
      total: messages.length,
    });
  });

  await page.route(MESSAGES_SEND_TO_CONVERSATION_API, async (route) => {
    const match = route.request().url().match(MESSAGES_SEND_TO_CONVERSATION_API);
    const conversationId = match?.[1] || '';
    const body = (route.request().postDataJSON() || {}) as Record<string, unknown>;
    state.chatSendBodies.push({
      kind: 'existing-conversation',
      conversationId,
      ...clone(body),
    });

    appendMessageToConversation(
      state,
      conversationId,
      { _id: state.user._id, fullName: state.user.fullName, role: state.user.role },
      'CUSTOMER',
      String(body['content'] || ''),
    );

    await jsonResponse(route, { ok: true });
  });
}

test.describe.serial('Parent full workflow video', () => {
  test(VIDEO_TEST_TITLE, async ({ page }) => {
    test.setTimeout(900_000);

    const state = buildParentWorkflowState();
    const ui = new ParentWorkflowPage(page);
    const context = page.context();
    const artifactDir = path.join(META_DIR, `parent-demo-${Date.now()}`);
    const cues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap(collectNarrationTexts(PARENT_VIDEO_COPY));
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
    await installParentWorkflowRoutes(page, state);
    await installVideoOverlay(page);

    try {
      const introPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'intro',
        PARENT_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        PARENT_VIDEO_COPY.introTitle,
        PARENT_VIDEO_COPY.introDescription,
        [...PARENT_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_600);

      const roadmapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'roadmap',
        PARENT_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        PARENT_VIDEO_COPY.roadmapTitle,
        PARENT_VIDEO_COPY.roadmapDescription,
        PARENT_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 5_400);

      await presentSceneCard(
        'scene-dashboard',
        PARENT_VIDEO_COPY.dashboardSceneTitle,
        PARENT_VIDEO_COPY.dashboardSceneDescription,
        PARENT_VIDEO_COPY.dashboardSceneBullets,
        PARENT_VIDEO_COPY.dashboardSceneNarration,
      );

      await ui.loginAsParent();
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await expect(page.locator('.dashboard-shell .hero-metrics .metric-card').first()).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.dashboardLabel);
      const dashboardPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'dashboard',
        PARENT_VIDEO_COPY.dashboardNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, page.locator('.hero-metrics .metric-card').first(), PARENT_VIDEO_COPY.dashboardHeroCallout);
      await ui.pause(2_300);
      await setVideoCallout(page, page.locator('.dashboard-section[data-tone="finance"]').first(), PARENT_VIDEO_COPY.dashboardFinanceCallout);
      await ui.pause(2_600);
      await setVideoCallout(page, page.locator('.dashboard-section[data-tone="learning"]').first(), PARENT_VIDEO_COPY.dashboardLearningCallout);
      await ui.pause(2_600);
      await setVideoCallout(page, page.locator('.dashboard-section[data-tone="support"]').first(), PARENT_VIDEO_COPY.dashboardSupportCallout);
      await ui.pause(2_600);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-progress',
        PARENT_VIDEO_COPY.progressSceneTitle,
        PARENT_VIDEO_COPY.progressSceneDescription,
        PARENT_VIDEO_COPY.progressSceneBullets,
        PARENT_VIDEO_COPY.progressSceneNarration,
      );

      await ui.goto('/app/student-progress');
      await expect(page.locator('.score-card').first()).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.progressLabel);
      const progressPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'progress',
        PARENT_VIDEO_COPY.progressNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, page.locator('.score-card').first(), PARENT_VIDEO_COPY.progressScoreCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, page.locator('.progress-card').first(), PARENT_VIDEO_COPY.progressBarCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, page.locator('.homework-section .data tbody tr').first(), PARENT_VIDEO_COPY.progressHomeworkCallout);
      await ui.pause(2_300);
      await setVideoCallout(page, page.locator('.comments-section .tl-item').first(), PARENT_VIDEO_COPY.progressCommentCallout);
      await ui.pause(2_500);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, progressPlayback);

      await presentSceneCard(
        'scene-attendance',
        PARENT_VIDEO_COPY.attendanceSceneTitle,
        PARENT_VIDEO_COPY.attendanceSceneDescription,
        PARENT_VIDEO_COPY.attendanceSceneBullets,
        PARENT_VIDEO_COPY.attendanceSceneNarration,
      );

      await ui.goto('/app/parent-attendance');
      const attendanceFilters = page.locator('.filters');
      await expect(attendanceFilters).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.attendanceLabel);
      const attendancePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'attendance',
        PARENT_VIDEO_COPY.attendanceNarration,
        narrationDurationMap,
      );
      const attendanceDateInputs = page.locator('.filters input[type="date"]');
      await expect(attendanceDateInputs).toHaveCount(2);
      await attendanceDateInputs.nth(0).fill(state.twoDaysAgo);
      await attendanceDateInputs.nth(1).fill(state.today);
      await ui.pause(1_700);
      await setVideoCallout(page, attendanceFilters, PARENT_VIDEO_COPY.attendanceFilterCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, page.locator('.stats-grid .stat-card').first(), PARENT_VIDEO_COPY.attendanceStatsCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, page.locator('.student-section .data tbody tr').first(), PARENT_VIDEO_COPY.attendanceTableCallout);
      await ui.pause(2_500);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, attendancePlayback);

      await presentSceneCard(
        'scene-calendar',
        PARENT_VIDEO_COPY.calendarSceneTitle,
        PARENT_VIDEO_COPY.calendarSceneDescription,
        PARENT_VIDEO_COPY.calendarSceneBullets,
        PARENT_VIDEO_COPY.calendarSceneNarration,
      );

      await ui.goto('/app/parent-calendar');
      const dayCell = page.locator('.day-cell').filter({ has: page.locator('.session-count') }).first();
      await expect(dayCell).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.calendarLabel);
      const calendarPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'calendar',
        PARENT_VIDEO_COPY.calendarNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, dayCell, PARENT_VIDEO_COPY.calendarDayCallout);
      await ui.pause(2_000);
      await clickLocator(page, dayCell);
      const dayDetailCard = page.locator('.day-details .session-card').first();
      await expect(dayDetailCard).toBeVisible();
      await setVideoCallout(page, dayDetailCard, PARENT_VIDEO_COPY.calendarDetailCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, calendarPlayback);

      await presentSceneCard(
        'scene-confirm',
        PARENT_VIDEO_COPY.confirmSceneTitle,
        PARENT_VIDEO_COPY.confirmSceneDescription,
        PARENT_VIDEO_COPY.confirmSceneBullets,
        PARENT_VIDEO_COPY.confirmSceneNarration,
      );

      await ui.goto('/app/sessions');
      const confirmRow = page.getByTestId('session-row-session-parent-confirm-001').first();
      await expect(confirmRow).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.confirmLabel);
      const confirmPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'confirm',
        PARENT_VIDEO_COPY.confirmNarration,
        narrationDurationMap,
      );
      const confirmButton = confirmRow.getByTestId('sessions-parent-confirm-button');
      await setVideoCallout(page, confirmButton, PARENT_VIDEO_COPY.confirmButtonCallout);
      await ui.pause(1_800);
      await clickLocator(page, confirmButton);
      const confirmModal = page.locator('.modal').filter({ has: page.getByTestId('sessions-confirm-submit') }).first();
      await expect(confirmModal).toBeVisible();
      await setVideoCallout(page, confirmModal, PARENT_VIDEO_COPY.confirmModalCallout);
      await page.getByTestId('sessions-confirm-rating').fill('5');
      await ui.slowFill(
        page.getByTestId('sessions-confirm-notes'),
        'Phu huynh da doc bao cao va dong y xac nhan buoi hoc nay.',
      );
      await ui.pause(2_200);
      await clickLocator(page, page.getByTestId('sessions-confirm-submit'));
      await expect.poll(() => state.confirmBodies.length).toBe(1);
      const confirmAlert = page.getByTestId('sessions-success-alert');
      await expect(confirmAlert).toBeVisible();
      await page.locator('.filters select').nth(1).selectOption('FINALIZED');
      const finalizedRow = page.getByTestId('session-row-session-parent-confirm-001').first();
      await expect(finalizedRow).toBeVisible();
      expect(normalizeText((await finalizedRow.textContent()) || '')).toMatch(/da hoan tat|da chot|xac nhan luong/);
      await setVideoCallout(page, finalizedRow, PARENT_VIDEO_COPY.confirmFinalizedCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, confirmPlayback);

      await presentSceneCard(
        'scene-invoices',
        PARENT_VIDEO_COPY.invoicesSceneTitle,
        PARENT_VIDEO_COPY.invoicesSceneDescription,
        PARENT_VIDEO_COPY.invoicesSceneBullets,
        PARENT_VIDEO_COPY.invoicesSceneNarration,
      );

      await ui.goto('/app/parent-invoices');
      await expect(page.locator('.stats .stat-card').first()).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.invoicesLabel);
      const invoicesPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'invoices',
        PARENT_VIDEO_COPY.invoicesNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, page.locator('.stats .stat-card').first(), PARENT_VIDEO_COPY.invoicesSummaryCallout);
      await ui.pause(2_300);
      await setVideoCallout(page, page.locator('.student-section .data tbody tr').first(), PARENT_VIDEO_COPY.invoicesTableCallout);
      await ui.pause(2_700);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, invoicesPlayback);

      await presentSceneCard(
        'scene-wallet',
        PARENT_VIDEO_COPY.walletSceneTitle,
        PARENT_VIDEO_COPY.walletSceneDescription,
        PARENT_VIDEO_COPY.walletSceneBullets,
        PARENT_VIDEO_COPY.walletSceneNarration,
      );

      await ui.goto('/app/wallets');
      const myWalletCard = page.locator('.my-wallet-card');
      await expect(myWalletCard).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.walletLabel);
      const walletPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'wallet',
        PARENT_VIDEO_COPY.walletNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, myWalletCard, PARENT_VIDEO_COPY.walletBalanceCallout);
      await ui.pause(2_200);
      await clickLocator(page, myWalletCard.locator('button.primary'));
      const parentTopUpModal = page.locator('.modal').filter({ has: page.locator('input[name="receiptFile"]') }).first();
      await expect(parentTopUpModal).toBeVisible();
      await setVideoCallout(page, parentTopUpModal, PARENT_VIDEO_COPY.walletModalCallout);
      await parentTopUpModal.locator('input[name="amount"]').fill('500000');
      await parentTopUpModal.locator('select[name="paymentMethod"]').selectOption('BANK_TRANSFER');
      await parentTopUpModal.locator('input[name="transactionRef"]').fill('FT-VIDEO-PARENT-001');
      await ui.slowFill(
        parentTopUpModal.locator('textarea[name="description"]'),
        'Phu huynh nap them de giu du so du cho tuan toi.',
      );
      await parentTopUpModal.locator('input[name="receiptFile"]').setInputFiles({
        name: 'parent-topup-receipt.png',
        mimeType: 'image/png',
        buffer: RECEIPT_PNG,
      });
      await expect(parentTopUpModal.locator('img')).toBeVisible();
      await ui.pause(1_800);
      const dialogMessage = await captureSingleDialog(page, async () => {
        await clickLocator(page, parentTopUpModal.locator('.modal-actions .primary'));
      });
      expect(normalizeText(dialogMessage)).toContain('yeu cau nap tien da duoc gui');
      await expect.poll(() => state.topUpBodies.length).toBe(1);
      const ledgerRow = page.locator('.data tbody tr').filter({ hasText: 'Phu huynh nap them' }).first();
      await expect(ledgerRow).toBeVisible();
      await setVideoCallout(page, ledgerRow, PARENT_VIDEO_COPY.walletLedgerCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, walletPlayback);

      await presentSceneCard(
        'scene-chat',
        PARENT_VIDEO_COPY.chatSceneTitle,
        PARENT_VIDEO_COPY.chatSceneDescription,
        PARENT_VIDEO_COPY.chatSceneBullets,
        PARENT_VIDEO_COPY.chatSceneNarration,
      );

      await ui.goto('/app/parent-chat');
      const setupCard = page.locator('.setup-card');
      await expect(setupCard).toBeVisible();
      await setVideoLabel(page, PARENT_VIDEO_COPY.chatLabel);
      const chatPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'chat',
        PARENT_VIDEO_COPY.chatNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, setupCard, PARENT_VIDEO_COPY.chatSetupCallout);
      await ui.pause(2_200);
      const firstConversation = page.locator('.conversation-item').first();
      await expect(firstConversation).toBeVisible();
      await setVideoCallout(page, firstConversation, PARENT_VIDEO_COPY.chatConversationCallout);
      await ui.pause(1_900);
      await clickLocator(page, firstConversation);
      await expect(page.locator('.message .bubble').first()).toBeVisible();
      const firstQuickChip = page.locator('.quick-chip').first();
      await setVideoCallout(page, firstQuickChip, PARENT_VIDEO_COPY.chatQuickActionCallout);
      await ui.pause(1_800);
      await clickLocator(page, firstQuickChip);
      const composer = page.locator('.composer textarea');
      await expect(composer).toBeVisible();
      await setVideoCallout(page, composer, PARENT_VIDEO_COPY.chatComposerCallout);
      await ui.slowFill(
        composer,
        'Cho minh xin lich hoc cua tuan toi va nhac giup buoi nao can phu huynh xac nhan.',
      );
      await ui.pause(1_800);
      await clickLocator(page, page.locator('.composer button.primary'));
      await expect.poll(() => state.chatSendBodies.length).toBeGreaterThan(0);
      const lastBubble = page.locator('.message .bubble').last();
      await expect(lastBubble).toContainText('Cho minh xin lich hoc cua tuan toi');
      await ui.pause(2_600);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, chatPlayback);

      await presentSceneCard(
        'scene-logout',
        PARENT_VIDEO_COPY.logoutSceneTitle,
        PARENT_VIDEO_COPY.logoutSceneDescription,
        PARENT_VIDEO_COPY.logoutSceneBullets,
        PARENT_VIDEO_COPY.logoutSceneNarration,
      );

      await ui.goto('/app/dashboard');
      await setVideoLabel(page, PARENT_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'logout',
        PARENT_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout');
      await expect(logoutButton).toBeVisible();
      await setVideoCallout(page, logoutButton, PARENT_VIDEO_COPY.logoutCallout);
      await ui.pause(1_700);
      await clickLocator(page, logoutButton);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await ui.pause(2_100);
      await waitForNarrationWindow(page, logoutPlayback);

      await setVideoLabel(page, null);
      await setVideoCallout(page, null, null);
      const outroPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'outro',
        PARENT_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        PARENT_VIDEO_COPY.outroTitle,
        PARENT_VIDEO_COPY.outroDescription,
        [...PARENT_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_600);

      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});
