import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { OPS_VIDEO_COPY } from './ops-video-copy';

const APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const API_PREFIX_PATTERN = '^(?:https?://[^/]+)?(?:/api)?';
const OPS_TICKET_COMMENT = OPS_VIDEO_COPY.ticketCommentValue;
const RUN_DATE = process.env['UI_EVIDENCE_DATE'] || new Date().toISOString().slice(0, 10);
const DATE_STAMP = RUN_DATE.replace(/-/g, '');
const ROOT_DIR = path.resolve(process.cwd(), '../..');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'frontend-ui-evidence', RUN_DATE);
const VIDEO_DIR = path.join(EVIDENCE_DIR, 'videos');
const RAW_VIDEO_DIR = path.join(VIDEO_DIR, 'raw');
const META_DIR = path.join(EVIDENCE_DIR, 'showcase-artifacts');
const FINAL_VIDEO_BASENAME = `UI_VanHanh_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const VIDEO_TEST_TITLE = 'records the full OPS master workflow with HD demo pacing';
const OPS_TICKET_COMMENT_VI = OPS_VIDEO_COPY.ticketCommentValue;

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
    '# Operations Full Workflow Narration',
    '',
    'Danh sach cue de render long tieng cho video van hanh.',
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

function appUrl(path: string): string {
  return new URL(path, APP_BASE_URL).toString();
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

async function setVideoCallout(
  page: Page,
  locator: Locator | null,
  message: string | null,
): Promise<void> {
  let rect: { x: number; y: number; width: number; height: number } | null = null;
  if (locator) {
    const box = await locator.boundingBox();
    if (box) {
      rect = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
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
          radial-gradient(circle at top left, rgba(249,115,22,.20), transparent 36%),
          radial-gradient(circle at bottom right, rgba(220,38,38,.22), transparent 42%),
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
        background: rgba(249,115,22,.16);
        color: #fdba74;
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
        color: #fb7185;
      }
    </style>
    <div class="card">
      <div class="eyebrow">OPS Workflow</div>
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
          radial-gradient(circle at top left, rgba(249, 115, 22, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(220, 38, 38, 0.16), transparent 24%),
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
        color: #fdba74;
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
        background: linear-gradient(135deg, rgba(249, 115, 22, 0.26), rgba(220, 38, 38, 0.18));
        border-color: rgba(251, 146, 60, 0.72);
        box-shadow: 0 20px 44px rgba(249, 115, 22, 0.14);
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
      <p class="eyebrow">Operations Workflow</p>
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="roadmap">
        ${steps
          .map(
            (step, index) => `
              <article class="step ${activeIndex === index ? 'active' : ''}">
                <span class="step-num">${String(index + 1).padStart(2, '0')}</span>
                <h2 class="step-title">${step}</h2>
                <p class="step-copy">Chặng ${index + 1} trong luồng vận hành OPS.</p>
              </article>
            `,
          )
          .join('')}
      </div>
      <p class="legend">
        ${activeIndex === null
          ? 'Màn hình này dùng để giới thiệu toàn bộ roadmap trước khi vào từng chặng thao tác.'
          : `Chúng ta đang đi vào chặng ${activeIndex + 1} của quy trình vận hành.`}
      </p>
    </section>
  `);
  await page.waitForLoadState('domcontentloaded');
}

function collectNarrationTexts(copy: typeof OPS_VIDEO_COPY): string[] {
  return [
    copy.introNarration,
    copy.roadmapNarration,
    copy.dashboardSceneNarration,
    copy.dashboardNarration,
    copy.classesSceneNarration,
    copy.classesNarration,
    copy.sessionsCreateSceneNarration,
    copy.sessionsCreateNarration,
    copy.sessionsFinalizeSceneNarration,
    copy.sessionsFinalizeNarration,
    copy.attendanceSceneNarration,
    copy.attendanceNarration,
    copy.ticketIntakeSceneNarration,
    copy.ticketIntakeNarration,
    copy.teacherSwapSceneNarration,
    copy.teacherSwapNarration,
    copy.ticketResolveSceneNarration,
    copy.ticketResolveNarration,
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
  await page.waitForTimeout(160);
}

type OpsUserFixture = {
  _id: string;
  sub: string;
  email: string;
  role: 'OPS';
  fullName: string;
  userCode: string;
};

type TeacherFixture = {
  _id: string;
  email: string;
  fullName: string;
  role: 'TEACHER';
  userCode: string;
};

type StudentFixture = {
  _id: string;
  fullName: string;
  studentCode: string;
  age: number;
  parentName: string;
  parentPhone: string;
};

type ClassFixture = {
  _id: string;
  code: string;
  name: string;
  classMode: 'ONLINE' | 'OFFLINE';
  teacherId: string;
  studentIds: string[];
  pricePerSession: number;
  teacherPayPerSession: number;
  baseDuration: number;
  sessionDuration: number;
  status: 'ACTIVE';
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
  status: 'SCHEDULED' | 'TEACHER_COMPLETED' | 'FINALIZED';
  hasTeachingReport: boolean;
  topicsCovered?: string;
  homework?: string;
  teacherNotes?: string;
  teachingReport?: {
    lessonContent?: string;
    homework?: string;
    teacherComment?: string;
    submittedAt?: string;
  };
  confirmation?: {
    teacherCompletedAt?: string;
    finalizedAt?: string;
  };
};

type TicketCommentFixture = {
  _id: string;
  ticketId: string;
  userId: { _id: string; fullName: string; email: string; role: string };
  content: string;
  attachments: string[];
  isInternal: boolean;
  createdAt: string;
};

type TicketFixture = {
  _id: string;
  ticketCode: string;
  type: 'SUBSTITUTE_TEACHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  priority: 'HIGH';
  subject: string;
  description: string;
  createdBy: { _id: string; fullName: string; email: string; role: string };
  createdByRole: 'TEACHER';
  assignedTo: { _id: string; fullName: string; email: string };
  classId: { _id: string; name: string; code: string };
  teacherId: { _id: string; fullName: string; email: string };
  attachments: string[];
  dueDate: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  resolution?: {
    summary: string;
    outcome: string;
    refundAmount: number;
    resolvedBy: { _id: string; fullName: string };
    resolvedAt: string;
  };
};

type WorkflowState = {
  today: string;
  tomorrow: string;
  nextWeek: string;
  user: OpsUserFixture;
  teachers: TeacherFixture[];
  students: StudentFixture[];
  classes: ClassFixture[];
  sessions: SessionFixture[];
  tickets: TicketFixture[];
  commentsByTicketId: Record<string, TicketCommentFixture[]>;
  loginBodies: Array<{ email: string; password: string }>;
  classUpdateBodies: Array<{ classId: string; payload: Record<string, unknown> }>;
  bulkCreateBodies: Array<Record<string, unknown>>;
  attendanceBodies: Array<Record<string, unknown>>;
  ticketCommentBodies: Array<{ ticketId: string; content: string; isInternal: boolean }>;
  ticketResolveBodies: Array<{ ticketId: string; summary: string; outcome: string; refundAmount: number }>;
  nextSessionId: number;
  nextCommentId: number;
};

function buildOpsWorkflowState(): WorkflowState {
  const now = new Date();
  const today = formatLocalDateInput(now);
  const tomorrow = formatLocalDateInput(addDays(now, 1));
  const nextWeek = formatLocalDateInput(addDays(now, 7));

  const user: OpsUserFixture = {
    _id: 'ops-demo-001',
    sub: 'ops-demo-001',
    email: 'ops.demo@school.local',
    role: 'OPS',
    fullName: 'Ops Demo',
    userCode: 'OPS-001',
  };

  const teachers: TeacherFixture[] = [
    {
      _id: 'teacher-ops-main-001',
      email: 'teacher.main@school.local',
      fullName: 'Thay Le Chinh',
      role: 'TEACHER',
      userCode: 'GV-001',
    },
    {
      _id: 'teacher-ops-swap-002',
      email: 'teacher.swap@school.local',
      fullName: 'Co Tran Day Thay',
      role: 'TEACHER',
      userCode: 'GV-002',
    },
  ];

  const students: StudentFixture[] = [
    {
      _id: 'student-ops-001',
      fullName: 'Nguyen Minh Khoa',
      studentCode: 'HS-OPS-001',
      age: 10,
      parentName: 'Chi Hoa',
      parentPhone: '0901000001',
    },
    {
      _id: 'student-ops-002',
      fullName: 'Tran Bao Anh',
      studentCode: 'HS-OPS-002',
      age: 11,
      parentName: 'Anh Long',
      parentPhone: '0901000002',
    },
    {
      _id: 'student-ops-003',
      fullName: 'Le Gia Huy',
      studentCode: 'HS-OPS-003',
      age: 9,
      parentName: 'Chi Nga',
      parentPhone: '0901000003',
    },
  ];

  const classes: ClassFixture[] = [
    {
      _id: 'class-ops-001',
      code: 'CLS-OPS-001',
      name: 'Lop Toan van hanh 4A',
      classMode: 'ONLINE',
      teacherId: teachers[0]._id,
      studentIds: [students[0]._id],
      pricePerSession: 420_000,
      teacherPayPerSession: 250_000,
      baseDuration: 90,
      sessionDuration: 90,
      status: 'ACTIVE',
    },
    {
      _id: 'class-ops-002',
      code: 'CLS-OPS-002',
      name: 'Lop English can doi giao vien',
      classMode: 'ONLINE',
      teacherId: teachers[0]._id,
      studentIds: [students[1]._id, students[2]._id],
      pricePerSession: 390_000,
      teacherPayPerSession: 230_000,
      baseDuration: 60,
      sessionDuration: 60,
      status: 'ACTIVE',
    },
  ];

  const sessions: SessionFixture[] = [
    {
      _id: 'session-ops-finalize-001',
      classId: classes[1]._id,
      studentId: students[1]._id,
      teacherId: teachers[0]._id,
      scheduledDate: today,
      scheduledStartTime: '18:00',
      scheduledEndTime: '19:00',
      durationMinutes: 60,
      amountCharged: 390_000,
      teacherPayout: 230_000,
      status: 'TEACHER_COMPLETED',
      hasTeachingReport: true,
      topicsCovered: 'On grammar va speaking.',
      homework: 'Lam worksheet unit 6.',
      teacherNotes: 'Hoc sinh hoc dung tien do.',
      teachingReport: {
        lessonContent: 'On grammar va speaking.',
        homework: 'Lam worksheet unit 6.',
        teacherComment: 'Hoc sinh hoc dung tien do.',
        submittedAt: `${today}T19:08:00.000Z`,
      },
      confirmation: {
        teacherCompletedAt: `${today}T19:05:00.000Z`,
      },
    },
    {
      _id: 'session-ops-scheduled-001',
      classId: classes[0]._id,
      studentId: students[0]._id,
      teacherId: teachers[0]._id,
      scheduledDate: tomorrow,
      scheduledStartTime: '19:00',
      scheduledEndTime: '20:30',
      durationMinutes: 90,
      amountCharged: 420_000,
      teacherPayout: 250_000,
      status: 'SCHEDULED',
      hasTeachingReport: false,
    },
  ];

  const tickets: TicketFixture[] = [
    {
      _id: 'ticket-ops-001',
      ticketCode: 'TKT-OPS-001',
      type: 'SUBSTITUTE_TEACHER',
      status: 'OPEN',
      priority: 'HIGH',
      subject: 'Giao vien xin nghi om can dieu phoi day thay',
      description: 'GV chinh lop English xin nghi dot xuat, OPS can dieu phoi thay giao khac.',
      createdBy: {
        _id: teachers[0]._id,
        fullName: teachers[0].fullName,
        email: teachers[0].email,
        role: 'TEACHER',
      },
      createdByRole: 'TEACHER',
      assignedTo: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      classId: {
        _id: classes[1]._id,
        name: classes[1].name,
        code: classes[1].code,
      },
      teacherId: {
        _id: teachers[0]._id,
        fullName: teachers[0].fullName,
        email: teachers[0].email,
      },
      attachments: [],
      dueDate: `${today}T10:00:00.000Z`,
      isOverdue: true,
      createdAt: `${today}T08:00:00.000Z`,
      updatedAt: `${today}T08:00:00.000Z`,
    },
  ];

  const commentsByTicketId: Record<string, TicketCommentFixture[]> = {
    'ticket-ops-001': [
      {
        _id: 'ticket-comment-001',
        ticketId: 'ticket-ops-001',
        userId: {
          _id: teachers[0]._id,
          fullName: teachers[0].fullName,
          email: teachers[0].email,
          role: 'TEACHER',
        },
        content: 'Em xin nghi om hom nay, nho OPS ho tro sap xep giao vien day thay.',
        attachments: [],
        isInternal: false,
        createdAt: `${today}T08:05:00.000Z`,
      },
    ],
  };

  return {
    today,
    tomorrow,
    nextWeek,
    user,
    teachers,
    students,
    classes,
    sessions,
    tickets,
    commentsByTicketId,
    loginBodies: [],
    classUpdateBodies: [],
    bulkCreateBodies: [],
    attendanceBodies: [],
    ticketCommentBodies: [],
    ticketResolveBodies: [],
    nextSessionId: 2,
    nextCommentId: 2,
  };
}

function getTeacher(state: WorkflowState, teacherId: string): TeacherFixture {
  return state.teachers.find((item) => item._id === teacherId) || state.teachers[0];
}

function getStudent(state: WorkflowState, studentId: string): StudentFixture {
  return state.students.find((item) => item._id === studentId) || state.students[0];
}

function getClass(state: WorkflowState, classId: string): ClassFixture {
  return state.classes.find((item) => item._id === classId) || state.classes[0];
}

function classToClassItem(state: WorkflowState, classItem: ClassFixture) {
  const teacher = getTeacher(state, classItem.teacherId);
  return {
    _id: classItem._id,
    code: classItem.code,
    name: classItem.name,
    classMode: classItem.classMode,
    teacher: {
      _id: teacher._id,
      fullName: teacher.fullName,
      email: teacher.email,
    },
    students: classItem.studentIds.map((studentId) => {
      const student = getStudent(state, studentId);
      return {
        _id: student._id,
        fullName: student.fullName,
        studentCode: student.studentCode,
      };
    }),
    pricePerSession: classItem.pricePerSession,
    teacherPayPerSession: classItem.teacherPayPerSession,
    baseDuration: classItem.baseDuration,
    sessionDuration: classItem.sessionDuration,
    actualPricePerSession: classItem.pricePerSession,
    actualTeacherPayPerSession: classItem.teacherPayPerSession,
    studentCount: classItem.studentIds.length,
    status: classItem.status,
  };
}

function classesPayload(state: WorkflowState) {
  return state.classes.map((item) => classToClassItem(state, item));
}

function usersDirectoryPayload(state: WorkflowState) {
  return [
    {
      _id: state.user._id,
      userCode: state.user.userCode,
      email: state.user.email,
      fullName: state.user.fullName,
      role: state.user.role,
    },
    ...state.teachers.map((teacher) => ({
      _id: teacher._id,
      userCode: teacher.userCode,
      email: teacher.email,
      fullName: teacher.fullName,
      role: teacher.role,
    })),
  ];
}

function studentsPayload(state: WorkflowState) {
  return state.students.map((student) => ({
    _id: student._id,
    studentCode: student.studentCode,
    fullName: student.fullName,
    age: student.age,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    faceImage: '',
  }));
}

function sessionToItem(state: WorkflowState, session: SessionFixture) {
  const classItem = getClass(state, session.classId);
  const student = getStudent(state, session.studentId);
  const teacher = getTeacher(state, session.teacherId);
  return {
    _id: session._id,
    classId: {
      _id: classItem._id,
      name: classItem.name,
      code: classItem.code,
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
    scheduledDate: session.scheduledDate,
    scheduledStartTime: session.scheduledStartTime,
    scheduledEndTime: session.scheduledEndTime,
    durationMinutes: session.durationMinutes,
    amountCharged: session.amountCharged,
    teacherPayout: session.teacherPayout,
    status: session.status,
    isPaid: session.status === 'FINALIZED',
    isTeacherPaid: session.status === 'FINALIZED',
    hasTeachingReport: session.hasTeachingReport,
    topicsCovered: session.topicsCovered,
    homework: session.homework,
    teacherNotes: session.teacherNotes,
    teachingReport: session.teachingReport,
    confirmation: session.confirmation,
  };
}

function buildSessionListResult(state: WorkflowState, requestUrl: string) {
  const url = new URL(requestUrl);
  const classId = url.searchParams.get('classId') || '';
  const status = url.searchParams.get('status') || '';
  const fromDate = url.searchParams.get('fromDate') || '';
  const toDate = url.searchParams.get('toDate') || '';
  const page = Number(url.searchParams.get('page') || '1');
  const limit = Number(url.searchParams.get('limit') || '20');

  const filtered = state.sessions.filter((session) => {
    if (classId && session.classId !== classId) {
      return false;
    }
    if (status && session.status !== status) {
      return false;
    }
    if (fromDate && session.scheduledDate < fromDate) {
      return false;
    }
    if (toDate && session.scheduledDate > toDate) {
      return false;
    }
    return true;
  });

  const data = filtered.map((session) => sessionToItem(state, session));
  return {
    data,
    meta: {
      total: data.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(data.length / limit)),
    },
  };
}

function buildSessionStats(state: WorkflowState) {
  const totalRevenue = state.sessions.reduce((sum, session) => sum + session.amountCharged, 0);
  const totalTeacherCost = state.sessions.reduce((sum, session) => sum + session.teacherPayout, 0);
  const byStatus = state.sessions.reduce<Record<string, { count: number; totalCharged: number; totalPayout: number }>>(
    (acc, session) => {
      const current = acc[session.status] || { count: 0, totalCharged: 0, totalPayout: 0 };
      current.count += 1;
      current.totalCharged += session.amountCharged;
      current.totalPayout += session.teacherPayout;
      acc[session.status] = current;
      return acc;
    },
    {},
  );

  return {
    totalSessions: state.sessions.length,
    totalRevenue,
    totalTeacherCost,
    byStatus,
  };
}

function buildAttendanceClasses(state: WorkflowState) {
  return state.classes.map((classItem) => ({
    classId: classItem._id,
    classCode: classItem.code,
    className: classItem.name,
    studentCount: classItem.studentIds.length,
    students: classItem.studentIds.map((studentId) => {
      const student = getStudent(state, studentId);
      return {
        studentId: student._id,
        fullName: student.fullName,
        studentCode: student.studentCode,
        age: student.age,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
      };
    }),
  }));
}

function buildAttendanceByClass(state: WorkflowState, classId: string, date: string) {
  const classItem = getClass(state, classId);
  const savedPayload = [...state.attendanceBodies]
    .reverse()
    .find((payload) => payload['classId'] === classId && payload['date'] === date);
  const savedStatuses = new Map<string, unknown>();

  if (savedPayload && Array.isArray(savedPayload['attendances'])) {
    for (const item of savedPayload['attendances']) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const studentId = typeof item['studentId'] === 'string' ? item['studentId'] : null;
      if (!studentId) {
        continue;
      }

      savedStatuses.set(studentId, item['status'] ?? null);
    }
  }

  return {
    class: {
      _id: classItem._id,
      name: classItem.name,
      code: classItem.code,
    },
    date,
    permissions: {
      canBulkEdit: true,
      canGenerateLink: false,
      blockedReason: null,
      substituteActive: false,
      substituteTeacherId: null,
      activeTeacherId: classItem.teacherId,
    },
    attendanceList: classItem.studentIds.map((studentId) => {
      const student = getStudent(state, studentId);
      return {
        student: {
          _id: student._id,
          fullName: student.fullName,
          age: student.age,
          parentName: student.parentName,
          studentCode: student.studentCode,
        },
        attendance: {
          classId: classItem._id,
          studentId: student._id,
          date,
          status: (savedStatuses.get(student._id) as string | null | undefined) ?? null,
          notes: '',
        },
      };
    }),
  };
}

function buildTicketStats(state: WorkflowState) {
  const countByKey = <T extends string>(values: T[]) =>
    Object.entries(
      values.reduce<Record<string, number>>((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {}),
    ).map(([key, count]) => ({ _id: key, count }));

  return {
    byStatus: countByKey(state.tickets.map((ticket) => ticket.status)),
    byType: countByKey(state.tickets.map((ticket) => ticket.type)),
    byPriority: countByKey(state.tickets.map((ticket) => ticket.priority)),
    overdueCount: state.tickets.filter((ticket) => ticket.isOverdue).length,
  };
}

function buildTicketListResult(items: TicketFixture[]) {
  return {
    data: clone(items),
    meta: {
      total: items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };
}

function buildDailyTasksBoard(state: WorkflowState) {
  return {
    role: 'OPS',
    generatedAt: new Date().toISOString(),
    summary: {
      totalTasks: 3,
      overdueTasks: 1,
      dueTodayTasks: 2,
      highPriorityTasks: 2,
    },
    tabs: [
      {
        key: 'today',
        label: 'Hom nay',
        description: 'Cong viec OPS can xu ly trong ngay.',
        emptyMessage: 'Khong co viec can xu ly.',
        count: 3,
        tasks: [
          {
            id: 'task-ops-001',
            type: 'TICKET',
            title: 'Xu ly ticket giao vien xin nghi om',
            detail: state.tickets[0].subject,
            meta: [state.classes[1].name],
            status: 'OPEN',
            priority: 'HIGH',
            dueAt: `${state.today}T10:00:00.000Z`,
            route: '/app/tickets',
            actionLabel: 'Mo ticket',
            overdue: true,
          },
          {
            id: 'task-ops-002',
            type: 'SESSION',
            title: 'Chot buoi hoc da co bao cao',
            detail: 'Session TEACHER_COMPLETED dang cho finalize.',
            meta: [state.classes[1].name],
            status: 'TEACHER_COMPLETED',
            priority: 'HIGH',
            route: '/app/sessions',
            actionLabel: 'Mo sessions',
            overdue: false,
          },
        ],
      },
    ],
  };
}

function buildOpsDashboard(state: WorkflowState) {
  return {
    sessions: {
      total: state.sessions.length,
      upcomingToday: state.sessions.filter((item) => item.scheduledDate === state.today).length,
      needsFinalization: state.sessions.filter((item) => item.status === 'TEACHER_COMPLETED').length,
      byStatus: {
        SCHEDULED: state.sessions.filter((item) => item.status === 'SCHEDULED').length,
        TEACHER_COMPLETED: state.sessions.filter((item) => item.status === 'TEACHER_COMPLETED').length,
        FINALIZED: state.sessions.filter((item) => item.status === 'FINALIZED').length,
      },
    },
    classes: {
      total: state.classes.length,
      active: state.classes.length,
      byStatus: {
        ACTIVE: state.classes.length,
      },
    },
    teachers: {
      active: state.teachers.length,
      pendingApproval: 0,
      suspended: 0,
    },
    students: {
      total: state.students.length,
      pendingApproval: 1,
    },
    tickets: {
      total: state.tickets.length,
      assignedToMe: state.tickets.filter((ticket) => ticket.assignedTo._id === state.user._id).length,
      overdueCount: state.tickets.filter((ticket) => ticket.isOverdue).length,
      byStatus: {
        OPEN: state.tickets.filter((ticket) => ticket.status === 'OPEN').length,
        RESOLVED: state.tickets.filter((ticket) => ticket.status === 'RESOLVED').length,
      },
      byPriority: {
        HIGH: state.tickets.filter((ticket) => ticket.priority === 'HIGH').length,
      },
    },
    recentTickets: state.tickets.map((ticket) => ({
      ticketCode: ticket.ticketCode,
      subject: ticket.subject,
      createdBy: ticket.createdBy,
      assignedTo: ticket.assignedTo,
      status: ticket.status,
      createdAt: ticket.createdAt,
    })),
  };
}

class OpsWorkflowPage {
  constructor(private readonly page: Page) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(appUrl(path));
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

  async loginAsOps(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();
    await this.slowFill(this.page.getByTestId('login-email'), 'ops.demo@school.local');
    await this.pause(600);
    await this.slowFill(this.page.getByTestId('login-password'), '123456');
    await this.pause();
    await this.page.getByTestId('login-submit').click();
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }
}

async function installOpsWorkflowRoutes(page: Page, state: WorkflowState): Promise<void> {
  const AUTH_LOGIN_API = new RegExp(`${API_PREFIX_PATTERN}/auth/login(?:\\?.*)?$`);
  const AUTH_LOGOUT_API = new RegExp(`${API_PREFIX_PATTERN}/auth/logout(?:\\?.*)?$`);
  const USERS_ME_API = new RegExp(`${API_PREFIX_PATTERN}/users/me(?:\\?.*)?$`);
  const USERS_DIRECTORY_API = new RegExp(`${API_PREFIX_PATTERN}/users/directory(?:\\?.*)?$`);
  const TEACHERS_API = new RegExp(`${API_PREFIX_PATTERN}/teachers(?:\\?.*)?$`);
  const STUDENTS_API = new RegExp(`${API_PREFIX_PATTERN}/students(?:\\?.*)?$`);
  const PRODUCTS_API = new RegExp(`${API_PREFIX_PATTERN}/products(?:\\?.*)?$`);
  const NOTIFICATIONS_COUNT_API = new RegExp(`${API_PREFIX_PATTERN}/notifications/unread-count(?:\\?.*)?$`);
  const PENDING_APPROVALS_SUMMARY_API = new RegExp(`${API_PREFIX_PATTERN}/pending-approvals/summary(?:\\?.*)?$`);
  const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
  const DASHBOARD_OPS_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/ops(?:\\?.*)?$`);
  const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);
  const CLASS_UPDATE_API = new RegExp(`${API_PREFIX_PATTERN}/classes/([^/?]+)(?:\\?.*)?$`);
  const SESSIONS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/stats(?:\\?.*)?$`);
  const SESSIONS_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/sessions(?:\\?.*)?$`);
  const SESSIONS_BULK_CREATE_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/bulk(?:\\?.*)?$`);
  const SESSION_DETAIL_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/(?!stats(?:\\?|$)|bulk(?:\\?|$))([^/?]+)(?:\\?.*)?$`);
  const SESSION_CHANGE_REQUESTS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/([^/?]+)/change-requests(?:\\?.*)?$`);
  const SESSION_FINALIZE_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/([^/?]+)/finalize(?:\\?.*)?$`);
  const ATTENDANCE_CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/classes-with-students(?:\\?.*)?$`);
  const ATTENDANCE_CLASS_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/class/([^/?]+)(?:\\?.*)?$`);
  const ATTENDANCE_BULK_MARK_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/bulk-mark(?:\\?.*)?$`);
  const TICKETS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/stats(?:\\?.*)?$`);
  const TICKETS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets(?:\\?.*)?$`);
  const TICKETS_ASSIGNED_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/assigned-to-me(?:\\?.*)?$`);
  const TICKETS_MY_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/my-tickets(?:\\?.*)?$`);
  const TICKET_DETAIL_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/(?!stats(?:\\?|$)|assigned-to-me(?:\\?|$)|my-tickets(?:\\?|$))([^/?]+)(?:\\?.*)?$`);
  const TICKET_COMMENTS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/([^/?]+)/comments(?:\\?.*)?$`);
  const TICKET_RESOLVE_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/([^/?]+)/resolve(?:\\?.*)?$`);

  await page.route(AUTH_LOGIN_API, async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    state.loginBodies.push(clone(body));
    await jsonResponse(route, { user: clone(state.user) });
  });

  await page.route(AUTH_LOGOUT_API, async (route) => {
    await jsonResponse(route, { ok: true });
  });

  await page.route(USERS_ME_API, async (route) => {
    await jsonResponse(route, {
      _id: state.user._id,
      email: state.user.email,
      role: state.user.role,
      fullName: state.user.fullName,
      userCode: state.user.userCode,
    });
  });

  await page.route(USERS_DIRECTORY_API, async (route) => {
    await jsonResponse(route, usersDirectoryPayload(state));
  });

  await page.route(TEACHERS_API, async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(STUDENTS_API, async (route) => {
    await jsonResponse(route, studentsPayload(state));
  });

  await page.route(PRODUCTS_API, async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(NOTIFICATIONS_COUNT_API, async (route) => {
    await jsonResponse(route, { count: 2 });
  });

  await page.route(PENDING_APPROVALS_SUMMARY_API, async (route) => {
    await jsonResponse(route, { totalPending: 1, invoices: 0, payrolls: 0, topups: 0, teachers: 0, classes: 1 });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await jsonResponse(route, buildDailyTasksBoard(state));
  });

  await page.route(DASHBOARD_OPS_API, async (route) => {
    await jsonResponse(route, buildOpsDashboard(state));
  });

  await page.route(CLASSES_API, async (route) => {
    await jsonResponse(route, classesPayload(state));
  });

  await page.route(CLASS_UPDATE_API, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(CLASS_UPDATE_API);
    const classId = match?.[1] || '';
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.classUpdateBodies.push({ classId, payload: clone(payload) });

    const targetClass = state.classes.find((item) => item._id === classId);
    if (targetClass) {
      if (typeof payload['teacherId'] === 'string' && payload['teacherId']) {
        targetClass.teacherId = String(payload['teacherId']);
      }
      if (Array.isArray(payload['studentIds'])) {
        targetClass.studentIds = (payload['studentIds'] as string[]).map((studentId) => String(studentId));
      }
    }

    const message = state.classUpdateBodies.length >= 2
      ? 'Da cap nhat giao vien phu trach thanh cong.'
      : undefined;

    await jsonResponse(route, {
      ok: true,
      message,
      data: targetClass ? classToClassItem(state, targetClass) : null,
    });
  });

  await page.route(SESSIONS_STATS_API, async (route) => {
    await jsonResponse(route, buildSessionStats(state));
  });

  await page.route(SESSIONS_LIST_API, async (route) => {
    await jsonResponse(route, buildSessionListResult(state, route.request().url()));
  });

  await page.route(SESSIONS_BULK_CREATE_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, string>;
    state.bulkCreateBodies.push(clone(payload));

    const classItem = getClass(state, String(payload['classId'] || state.classes[0]._id));
    classItem.studentIds.forEach((studentId) => {
      state.nextSessionId += 1;
      state.sessions.unshift({
        _id: `session-ops-bulk-${pad(state.nextSessionId)}`,
        classId: classItem._id,
        studentId,
        teacherId: classItem.teacherId,
        scheduledDate: String(payload['scheduledDate'] || state.tomorrow),
        scheduledStartTime: String(payload['scheduledStartTime'] || '18:00'),
        scheduledEndTime: String(payload['scheduledEndTime'] || '19:00'),
        durationMinutes: classItem.sessionDuration,
        amountCharged: classItem.pricePerSession,
        teacherPayout: classItem.teacherPayPerSession,
        status: 'SCHEDULED',
        hasTeachingReport: false,
      });
    });

    await jsonResponse(route, { ok: true }, 201);
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(SESSION_FINALIZE_API, async (route) => {
    const match = route.request().url().match(SESSION_FINALIZE_API);
    const sessionId = match?.[1] || '';
    const session = state.sessions.find((item) => item._id === sessionId);
    if (session) {
      session.status = 'FINALIZED';
      session.confirmation = {
        ...(session.confirmation || {}),
        finalizedAt: new Date().toISOString(),
      };
    }
    await jsonResponse(route, session ? sessionToItem(state, session) : {});
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    const match = route.request().url().match(SESSION_DETAIL_API);
    const sessionId = match?.[1] || '';
    const session = state.sessions.find((item) => item._id === sessionId);
    await jsonResponse(route, session ? sessionToItem(state, session) : {}, session ? 200 : 404);
  });

  await page.route(ATTENDANCE_CLASSES_API, async (route) => {
    await jsonResponse(route, buildAttendanceClasses(state));
  });

  await page.route(ATTENDANCE_CLASS_API, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const match = route.request().url().match(ATTENDANCE_CLASS_API);
    const classId = match?.[1] || state.classes[0]._id;
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') || state.today;
    await jsonResponse(route, buildAttendanceByClass(state, classId, date));
  });

  await page.route(ATTENDANCE_BULK_MARK_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.attendanceBodies.push(clone(payload));
    const attendances = Array.isArray(payload['attendances']) ? payload['attendances'] : [];
    await jsonResponse(route, {
      success: attendances,
      errors: [],
      sessionsCreated: 0,
      totalProcessed: attendances.length,
      totalErrors: 0,
      attendedCount: attendances.length,
      classMode: 'ONLINE',
    });
  });

  await page.route(TICKETS_STATS_API, async (route) => {
    await jsonResponse(route, buildTicketStats(state));
  });

  await page.route(TICKETS_ASSIGNED_API, async (route) => {
    const assigned = state.tickets.filter((ticket) => ticket.assignedTo._id === state.user._id);
    await jsonResponse(route, buildTicketListResult(assigned));
  });

  await page.route(TICKETS_MY_API, async (route) => {
    await jsonResponse(route, buildTicketListResult([]));
  });

  await page.route(TICKETS_API, async (route) => {
    await jsonResponse(route, buildTicketListResult(state.tickets));
  });

  await page.route(TICKET_COMMENTS_API, async (route) => {
    const match = route.request().url().match(TICKET_COMMENTS_API);
    const ticketId = match?.[1] || '';

    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as { content: string; isInternal?: boolean };
      state.ticketCommentBodies.push({
        ticketId,
        content: payload.content,
        isInternal: !!payload.isInternal,
      });

      state.nextCommentId += 1;
      const createdComment: TicketCommentFixture = {
        _id: `ticket-comment-${pad(state.nextCommentId)}`,
        ticketId,
        userId: {
          _id: state.user._id,
          fullName: state.user.fullName,
          email: state.user.email,
          role: state.user.role,
        },
        content: payload.content,
        attachments: [],
        isInternal: !!payload.isInternal,
        createdAt: new Date().toISOString(),
      };

      state.commentsByTicketId[ticketId] = [...(state.commentsByTicketId[ticketId] || []), createdComment];
      await jsonResponse(route, createdComment, 201);
      return;
    }

    await jsonResponse(route, clone(state.commentsByTicketId[ticketId] || []));
  });

  await page.route(TICKET_RESOLVE_API, async (route) => {
    const match = route.request().url().match(TICKET_RESOLVE_API);
    const ticketId = match?.[1] || '';
    const payload = route.request().postDataJSON() as { summary: string; outcome: string; refundAmount?: number };

    state.ticketResolveBodies.push({
      ticketId,
      summary: payload.summary,
      outcome: payload.outcome,
      refundAmount: Number(payload.refundAmount || 0),
    });

    const ticket = state.tickets.find((item) => item._id === ticketId);
    if (ticket) {
      ticket.status = 'RESOLVED';
      ticket.updatedAt = new Date().toISOString();
      ticket.resolution = {
        summary: payload.summary,
        outcome: payload.outcome,
        refundAmount: Number(payload.refundAmount || 0),
        resolvedBy: {
          _id: state.user._id,
          fullName: state.user.fullName,
        },
        resolvedAt: new Date().toISOString(),
      };
    }

    await jsonResponse(route, clone(ticket || {}));
  });

  await page.route(TICKET_DETAIL_API, async (route) => {
    const match = route.request().url().match(TICKET_DETAIL_API);
    const ticketId = match?.[1] || '';
    const ticket = state.tickets.find((item) => item._id === ticketId);
    await jsonResponse(route, clone(ticket || {}), ticket ? 200 : 404);
  });
}

test.describe.serial('OPS full workflow video', () => {
  test(VIDEO_TEST_TITLE, async ({ page }) => {
    test.setTimeout(900_000);

    const state = buildOpsWorkflowState();
    const ui = new OpsWorkflowPage(page);
    const context = page.context();
    const artifactDir = path.join(META_DIR, `ops-demo-${Date.now()}`);
    const recordingStartedAt = Date.now();
    const cues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap(collectNarrationTexts(OPS_VIDEO_COPY));
    let savedVideoPath: string | null = null;
    const normalizeText = (value: string) =>
      value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/đ/gi, 'd')
        .toLowerCase();

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
    await installOpsWorkflowRoutes(page, state);
    await installVideoOverlay(page);

    try {
      const introPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'intro',
        OPS_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        OPS_VIDEO_COPY.introTitle,
        OPS_VIDEO_COPY.introDescription,
        [...OPS_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_600);

      const roadmapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'roadmap',
        OPS_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        OPS_VIDEO_COPY.roadmapTitle,
        OPS_VIDEO_COPY.roadmapDescription,
        OPS_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 5_400);

      await presentSceneCard(
        'scene-dashboard',
        OPS_VIDEO_COPY.dashboardSceneTitle,
        OPS_VIDEO_COPY.dashboardSceneDescription,
        OPS_VIDEO_COPY.dashboardSceneBullets,
        OPS_VIDEO_COPY.dashboardSceneNarration,
      );

      await ui.loginAsOps();
      await setVideoLabel(page, OPS_VIDEO_COPY.dashboardLabel);
      await expect(page).toHaveURL(/\/app\/dashboard/);
      const dashboardPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'dashboard',
        OPS_VIDEO_COPY.dashboardNarration,
        narrationDurationMap,
      );
      const overdueCard = page.locator('.card.highlight.orange').first();
      const activeClassCard = page.locator('.card.highlight.green').first();
      await expect(overdueCard).toBeVisible();
      await setVideoCallout(page, overdueCard, OPS_VIDEO_COPY.dashboardOverdueCallout);
      await ui.pause(2_100);
      await expect(activeClassCard).toBeVisible();
      await setVideoCallout(page, activeClassCard, OPS_VIDEO_COPY.dashboardActiveClassCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, page.getByTestId('nav-pending-approvals'), OPS_VIDEO_COPY.dashboardPendingApprovalCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-classes',
        OPS_VIDEO_COPY.classesSceneTitle,
        OPS_VIDEO_COPY.classesSceneDescription,
        OPS_VIDEO_COPY.classesSceneBullets,
        OPS_VIDEO_COPY.classesSceneNarration,
      );

      await ui.goto('/app/classes');
      await setVideoLabel(page, OPS_VIDEO_COPY.classesLabel);
      const classesPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'classes',
        OPS_VIDEO_COPY.classesNarration,
        narrationDurationMap,
      );
      const classRow = page.locator('tr[data-testid^="class-row-"]').filter({ hasText: state.classes[0].name }).first();
      await expect(classRow).toBeVisible();
      await setVideoCallout(page, classRow, OPS_VIDEO_COPY.classesRowCallout);
      await clickLocator(page, classRow.getByRole('button', { name: /Sua/i }));
      const classModal = page.locator('.modal').last();
      await expect(classModal.locator('h3').filter({ hasText: /Chinh sua lop hoc/i })).toBeVisible();
      const availableStudentColumn = classModal.locator('.student-picker .student-column').filter({ hasText: /Danh sach hoc vien/i }).first();
      await setVideoCallout(page, availableStudentColumn, OPS_VIDEO_COPY.classesAvailableStudentCallout);
      await clickLocator(page, availableStudentColumn.getByRole('button', { name: /Them/i }).first());
      await ui.pause(1_400);
      await clickLocator(page, classModal.getByRole('button', { name: /(Luu|Cap nhat)/i }));
      await expect.poll(() => state.classUpdateBodies.length).toBe(1);
      const updatedRow = page.locator('tr[data-testid^="class-row-"]').filter({ hasText: state.students[1].fullName }).first();
      await expect(updatedRow).toBeVisible();
      await setVideoCallout(page, updatedRow, OPS_VIDEO_COPY.classesUpdatedRowCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, classesPlayback);

      await presentSceneCard(
        'scene-sessions-create',
        OPS_VIDEO_COPY.sessionsCreateSceneTitle,
        OPS_VIDEO_COPY.sessionsCreateSceneDescription,
        OPS_VIDEO_COPY.sessionsCreateSceneBullets,
        OPS_VIDEO_COPY.sessionsCreateSceneNarration,
      );

      await ui.goto('/app/sessions');
      await setVideoLabel(page, OPS_VIDEO_COPY.sessionsCreateLabel);
      const sessionsCreatePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'sessions-bulk-create',
        OPS_VIDEO_COPY.sessionsCreateNarration,
        narrationDurationMap,
      );
      const rowsBefore = await page.locator('tr[data-testid^="session-row-"]').count();
      await clickLocator(page, page.getByTestId('sessions-create-button'));
      await expect(page.getByTestId('sessions-create-submit')).toBeVisible();
      await clickLocator(page, page.getByTestId('sessions-create-bulk'));
      const sessionCreateModal = page.locator('.modal').filter({ has: page.getByTestId('sessions-create-submit') }).last();
      await expect(sessionCreateModal).toBeVisible();
      await setVideoCallout(page, sessionCreateModal, OPS_VIDEO_COPY.sessionsCreateModalCallout);
      await sessionCreateModal.locator('select[name="classId"]').selectOption(state.classes[0]._id);
      await sessionCreateModal.locator('input[name="bulkDate"]').fill(state.nextWeek);
      await sessionCreateModal.locator('input[name="bulkStart"]').fill('18:30');
      await sessionCreateModal.locator('input[name="bulkEnd"]').fill('20:00');
      await ui.pause(1_600);
      await clickLocator(page, page.getByTestId('sessions-create-submit'));
      await expect.poll(() => state.bulkCreateBodies.length).toBe(1);
      await expect.poll(async () => page.locator('tr[data-testid^="session-row-"]').count()).toBeGreaterThan(rowsBefore);
      await setVideoCallout(page, page.locator('tr[data-testid^="session-row-"]').first(), OPS_VIDEO_COPY.sessionsCreateRowCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, sessionsCreatePlayback);

      await presentSceneCard(
        'scene-sessions-finalize',
        OPS_VIDEO_COPY.sessionsFinalizeSceneTitle,
        OPS_VIDEO_COPY.sessionsFinalizeSceneDescription,
        OPS_VIDEO_COPY.sessionsFinalizeSceneBullets,
        OPS_VIDEO_COPY.sessionsFinalizeSceneNarration,
      );

      await ui.goto('/app/sessions');
      await setVideoLabel(page, OPS_VIDEO_COPY.sessionsFinalizeLabel);
      const sessionsFinalizePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'sessions-finalize',
        OPS_VIDEO_COPY.sessionsFinalizeNarration,
        narrationDurationMap,
      );
      const filterStatus = page.locator('.filters select').nth(1);
      await filterStatus.selectOption('TEACHER_COMPLETED');
      await setVideoCallout(page, filterStatus, OPS_VIDEO_COPY.sessionsFinalizeFilterCallout);
      await ui.pause(1_500);
      const completedRow = page.locator('tr[data-testid^="session-row-"]').filter({ hasText: state.classes[1].code }).first();
      await expect(completedRow).toBeVisible();
      await clickLocator(page, completedRow.getByTestId('sessions-view-detail'));
      const finalizeButton = page.getByTestId('sessions-finalize-from-detail');
      await expect(finalizeButton).toBeVisible();
      await setVideoCallout(page, finalizeButton, OPS_VIDEO_COPY.sessionsFinalizeButtonCallout);
      const confirmMessage = await captureSingleDialog(page, async () => {
        await clickLocator(page, finalizeButton);
      });
      expect(normalizeText(confirmMessage)).toMatch(/luong cho buoi hoc|hoan tat buoi hoc|xac nhan luong/);
      await filterStatus.selectOption('FINALIZED');
      const finalizedRow = page.locator('tr[data-testid^="session-row-"]').filter({ hasText: state.classes[1].code }).first();
      await expect(finalizedRow).toBeVisible();
      await setVideoCallout(page, finalizedRow, OPS_VIDEO_COPY.sessionsFinalizeRowCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, sessionsFinalizePlayback);

      await presentSceneCard(
        'scene-attendance',
        OPS_VIDEO_COPY.attendanceSceneTitle,
        OPS_VIDEO_COPY.attendanceSceneDescription,
        OPS_VIDEO_COPY.attendanceSceneBullets,
        OPS_VIDEO_COPY.attendanceSceneNarration,
      );

      await ui.goto('/app/attendance');
      await setVideoLabel(page, OPS_VIDEO_COPY.attendanceLabel);
      const attendancePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'attendance',
        OPS_VIDEO_COPY.attendanceNarration,
        narrationDurationMap,
      );
      await page.getByTestId('attendance-class-select').selectOption(state.classes[0]._id);
      await page.getByTestId('attendance-date-input').fill(state.today);
      await setVideoCallout(page, page.getByTestId('attendance-load-button'), OPS_VIDEO_COPY.attendanceLoadCallout);
      await clickLocator(page, page.getByTestId('attendance-load-button'));
      const attendanceCards = page.locator('.attendance-list .student-card');
      await expect(attendanceCards).toHaveCount(2);
      await setVideoCallout(page, attendanceCards.first(), OPS_VIDEO_COPY.attendanceCardsCallout);
      await clickLocator(page, page.getByTestId('attendance-mark-all-present'));
      await ui.pause(1_200);
      await clickLocator(page, page.getByTestId('attendance-save-button'));
      await expect.poll(() => state.attendanceBodies.length).toBe(1);
      const attendanceSummary = page.locator('.attendance-summary');
      await expect
        .poll(async () => normalizeText(await attendanceSummary.innerText()))
        .toMatch(/co mat:\s*2|2\/2/);
      await setVideoCallout(page, attendanceSummary, OPS_VIDEO_COPY.attendanceSummaryCallout);
      await ui.pause(2_100);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, attendancePlayback);

      await presentSceneCard(
        'scene-ticket-intake',
        OPS_VIDEO_COPY.ticketIntakeSceneTitle,
        OPS_VIDEO_COPY.ticketIntakeSceneDescription,
        OPS_VIDEO_COPY.ticketIntakeSceneBullets,
        OPS_VIDEO_COPY.ticketIntakeSceneNarration,
      );

      await ui.goto('/app/tickets');
      await setVideoLabel(page, OPS_VIDEO_COPY.ticketIntakeLabel);
      const ticketIntakePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'ticket-intake',
        OPS_VIDEO_COPY.ticketIntakeNarration,
        narrationDurationMap,
      );
      await clickLocator(page, page.getByTestId('tickets-tab-all'));
      const ticketCard = page.getByTestId('ticket-card').filter({ hasText: state.tickets[0].ticketCode }).first();
      await expect(ticketCard).toBeVisible();
      await setVideoCallout(page, ticketCard, OPS_VIDEO_COPY.ticketIntakeCardCallout);
      await clickLocator(page, ticketCard);
      const ticketDetail = page.locator('.ticket-detail-page');
      await expect(ticketDetail).toBeVisible();
      await setVideoCallout(page, ticketDetail.locator('.reply-box').first(), OPS_VIDEO_COPY.ticketIntakeReplyCallout);
      await ui.slowFill(page.locator('.reply-box textarea'), OPS_TICKET_COMMENT_VI);
      await clickLocator(page, page.getByRole('button', { name: /G.i tr. l.i/i }));
      await expect.poll(() => state.ticketCommentBodies.length).toBe(1);
      await expect(page.locator('.comments-list')).toContainText(OPS_TICKET_COMMENT_VI);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, ticketIntakePlayback);

      await presentSceneCard(
        'scene-teacher-swap',
        OPS_VIDEO_COPY.teacherSwapSceneTitle,
        OPS_VIDEO_COPY.teacherSwapSceneDescription,
        OPS_VIDEO_COPY.teacherSwapSceneBullets,
        OPS_VIDEO_COPY.teacherSwapSceneNarration,
      );

      await ui.goto('/app/classes');
      await setVideoLabel(page, OPS_VIDEO_COPY.teacherSwapLabel);
      const teacherSwapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'teacher-swap',
        OPS_VIDEO_COPY.teacherSwapNarration,
        narrationDurationMap,
      );
      const swapClassRow = page.locator('tr[data-testid^="class-row-"]').filter({ hasText: state.classes[1].name }).first();
      await expect(swapClassRow).toBeVisible();
      await clickLocator(page, swapClassRow.getByRole('button', { name: /Sua/i }));
      const swapModal = page.locator('.modal').last();
      await expect(swapModal).toBeVisible();
      const teacherSelect = swapModal.locator('select[name="teacherId"]');
      await setVideoCallout(page, teacherSelect, OPS_VIDEO_COPY.teacherSwapSelectCallout);
      await teacherSelect.selectOption(state.teachers[1]._id);
      const successDialog = await captureSingleDialog(page, async () => {
        await clickLocator(page, swapModal.getByRole('button', { name: /(Luu|Cap nhat)/i }));
      });
      expect(normalizeText(successDialog)).toMatch(/cap nhat|thanh cong/);
      const swappedRow = page.locator('tr[data-testid^="class-row-"]').filter({ hasText: state.teachers[1].fullName }).first();
      await expect(swappedRow).toBeVisible();
      await setVideoCallout(page, swappedRow, OPS_VIDEO_COPY.teacherSwapRowCallout);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, teacherSwapPlayback);

      await presentSceneCard(
        'scene-ticket-resolve',
        OPS_VIDEO_COPY.ticketResolveSceneTitle,
        OPS_VIDEO_COPY.ticketResolveSceneDescription,
        OPS_VIDEO_COPY.ticketResolveSceneBullets,
        OPS_VIDEO_COPY.ticketResolveSceneNarration,
      );

      await ui.goto('/app/tickets');
      await setVideoLabel(page, OPS_VIDEO_COPY.ticketResolveLabel);
      const ticketResolvePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'ticket-resolve',
        OPS_VIDEO_COPY.ticketResolveNarration,
        narrationDurationMap,
      );
      await clickLocator(page, page.getByTestId('tickets-tab-all'));
      const resolvedTicketCard = page.getByTestId('ticket-card').filter({ hasText: state.tickets[0].ticketCode }).first();
      await clickLocator(page, resolvedTicketCard);
      await expect(page.locator('.ticket-detail-page')).toBeVisible();
      await clickLocator(page, page.getByRole('button', { name: /Gi.i quy.t/i }));
      const resolveModal = page.locator('.modal').filter({ hasText: /Gi.i quy.t Ticket/i }).last();
      await expect(resolveModal).toBeVisible();
      await setVideoCallout(page, resolveModal, OPS_VIDEO_COPY.ticketResolveModalCallout);
      await ui.slowFill(resolveModal.locator('textarea'), OPS_VIDEO_COPY.ticketResolveSummary);
      await clickLocator(page, resolveModal.getByRole('button', { name: /X.c nh.n/i }));
      await expect.poll(() => state.ticketResolveBodies.length).toBe(1);
      const detailHeader = page.locator('.detail-header');
      await expect
        .poll(async () => normalizeText(await detailHeader.innerText()))
        .toMatch(/da giai quyet|resolved/);
      await setVideoCallout(page, detailHeader, OPS_VIDEO_COPY.ticketResolveHeaderCallout);
      await ui.pause(2_000);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, ticketResolvePlayback);

      await presentSceneCard(
        'scene-logout',
        OPS_VIDEO_COPY.logoutSceneTitle,
        OPS_VIDEO_COPY.logoutSceneDescription,
        OPS_VIDEO_COPY.logoutSceneBullets,
        OPS_VIDEO_COPY.logoutSceneNarration,
      );

      await ui.goto('/app/dashboard');
      await setVideoLabel(page, OPS_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'logout',
        OPS_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout');
      await setVideoCallout(page, logoutButton, OPS_VIDEO_COPY.logoutCallout);
      await clickLocator(page, logoutButton);
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByTestId('login-form')).toBeVisible();
      await ui.pause(1_800);
      await setVideoCallout(page, null, null);
      await setVideoLabel(page, null);
      await waitForNarrationWindow(page, logoutPlayback);

      const outroPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'outro',
        OPS_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        OPS_VIDEO_COPY.outroTitle,
        OPS_VIDEO_COPY.outroDescription,
        [...OPS_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_600);
      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});
