import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { extractAttendanceLink } from './support';
import { TEACHER_VIDEO_COPY } from './teacher-video-copy';

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
const FINAL_VIDEO_BASENAME = `UI_GiaoVien_Full_Workflow_VI_${DATE_STAMP}`;
const VIEWPORT = { width: 1600, height: 900 };
const VIDEO_TEST_TITLE = 'records the full teacher master workflow with HD demo pacing';

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
const NARRATION_FALLBACK_BASE_MS = 1_200;
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
    '# Teacher Full Workflow Narration',
    '',
    'Danh sach cue de render long tieng cho video giao vien.',
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

function resolvePythonLauncher(): { command: string; prefix: string[] } | null {
  const candidates: Array<[string, string[]]> = [
    ['py', ['-3']],
    ['python', []],
    ['py', []],
  ];

  for (const [command, prefix] of candidates) {
    const probe = spawnSync(command, [...prefix, '--version'], { encoding: 'utf8', stdio: 'pipe' });
    if (probe.status === 0) {
      return { command, prefix };
    }
  }

  return null;
}

function ensureGtts(python: { command: string; prefix: string[] }): boolean {
  const probe = spawnSync(
    python.command,
    [...python.prefix, '-c', 'from gtts import gTTS; print("ok")'],
    { encoding: 'utf8', stdio: 'pipe' },
  );

  return probe.status === 0;
}

function synthesizeNarrationPreviewMp3(
  python: { command: string; prefix: string[] },
  text: string,
  outputPath: string,
): void {
  const script = [
    'from gtts import gTTS',
    'import sys',
    'text = sys.argv[1]',
    'output_path = sys.argv[2]',
    "gTTS(text=text, lang='vi', slow=False).save(output_path)",
  ].join('\n');

  const result = spawnSync(
    python.command,
    [...python.prefix, '-c', script, text, outputPath],
    { encoding: 'utf8', stdio: 'pipe' },
  );

  if (result.status !== 0) {
    const details = [result.stdout || '', result.stderr || ''].filter(Boolean).join('\n');
    throw new Error(details || 'gTTS preview synthesis failed');
  }
}

function ffprobeDurationSeconds(filePath: string): number {
  const probe = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ],
    { encoding: 'utf8', stdio: 'pipe' },
  );

  if (probe.status !== 0) {
    const details = [probe.stdout || '', probe.stderr || ''].filter(Boolean).join('\n');
    throw new Error(details || `ffprobe failed for ${filePath}`);
  }

  return Number((probe.stdout || '').trim());
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

function atIso(dateText: string, timeText: string): string {
  return new Date(`${dateText}T${timeText}:00`).toISOString();
}

async function jsonResponse(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installClipboardHarness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = {
      writes: [] as string[],
    };

    Object.defineProperty(window, '__teacherClipboardState', {
      configurable: true,
      value: state,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          state.writes.push(String(text));
        },
      },
    });
  });
}

async function getClipboardWrites(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...(
        window as Window & {
          __teacherClipboardState: { writes: string[] };
        }
      ).__teacherClipboardState.writes,
    ],
  );
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
        label!.textContent = message || '';
        label!.style.opacity = message ? '1' : '0';
      };

      (window as any).__codexVideoCallout = (
        box: { x: number; y: number; width: number; height: number } | null,
        message: string | null,
      ) => {
        if (!box) {
          callout!.style.opacity = '0';
          calloutText!.style.opacity = '0';
          return;
        }

        const padding = 10;
        const left = Math.max(8, Math.round(box.x - padding));
        const top = Math.max(8, Math.round(box.y - padding));
        const width = Math.round(box.width + padding * 2);
        const height = Math.round(box.height + padding * 2);

        callout!.style.left = `${left}px`;
        callout!.style.top = `${top}px`;
        callout!.style.width = `${width}px`;
        callout!.style.height = `${height}px`;
        callout!.style.opacity = '1';

        if (message) {
          calloutText!.textContent = message;
          const desiredLeft = left;
          const desiredTop = Math.max(12, top - 70);
          calloutText!.style.left = `${desiredLeft}px`;
          calloutText!.style.top = `${desiredTop}px`;
          calloutText!.style.opacity = '1';
        } else {
          calloutText!.style.opacity = '0';
        }
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
    await expect(locator).toBeVisible({ timeout: 20_000 });
    await locator.scrollIntoViewIfNeeded();
    rect = await locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    });
  }

  await page.evaluate(
    ({ box, text }) => {
      const fn = (window as any).__codexVideoCallout as ((
        nextBox: { x: number; y: number; width: number; height: number } | null,
        nextText: string | null,
      ) => void) | undefined;
      fn?.(box, text);
    },
    { box: rect, text: message },
  );
}

async function showTitleCard(page: Page, title: string, subtitle: string, bullets: string[]): Promise<void> {
  await page.setContent(`
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at top, rgba(56, 189, 248, 0.22), transparent 32%),
          linear-gradient(135deg, #0f172a 0%, #111827 46%, #1e293b 100%);
        color: #e2e8f0;
      }
      .card {
        width: min(980px, calc(100vw - 96px));
        padding: 44px 52px;
        border-radius: 28px;
        background: rgba(15, 23, 42, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.2);
        box-shadow: 0 32px 80px rgba(15, 23, 42, 0.35);
        backdrop-filter: blur(16px);
      }
      .eyebrow {
        margin: 0 0 12px;
        color: #38bdf8;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: 44px;
        line-height: 1.08;
        letter-spacing: -0.04em;
        color: #f8fafc;
      }
      p {
        margin: 18px 0 0;
        font-size: 18px;
        line-height: 1.65;
        color: rgba(226, 232, 240, 0.92);
      }
      ul {
        margin: 28px 0 0;
        padding-left: 20px;
        display: grid;
        gap: 12px;
      }
      li {
        font-size: 17px;
        line-height: 1.55;
        color: #e2e8f0;
      }
      strong {
        color: #f8fafc;
      }
    </style>
    <section class="card">
      <p class="eyebrow">Teacher Workflow</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
      <ul>
        ${bullets.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </section>
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
          radial-gradient(circle at top left, rgba(14, 165, 233, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(16, 185, 129, 0.18), transparent 24%),
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
        color: #38bdf8;
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
        min-height: 126px;
        padding: 18px;
        border-radius: 22px;
        background: rgba(30, 41, 59, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .step.active {
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.28), rgba(16, 185, 129, 0.18));
        border-color: rgba(56, 189, 248, 0.72);
        box-shadow: 0 20px 44px rgba(14, 165, 233, 0.14);
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
        letter-spacing: 0.04em;
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
      <p class="eyebrow">Teacher Workflow Map</p>
      <h1>${title}</h1>
      <p class="subtitle">${subtitle}</p>
      <div class="roadmap">
        ${steps
          .map(
            (step, index) => `
              <article class="step ${activeIndex === index ? 'active' : ''}">
                <span class="step-num">${String(index + 1).padStart(2, '0')}</span>
                <h2 class="step-title">${step}</h2>
                <p class="step-copy">Chặng ${index + 1} trong luồng nghiệp vụ giáo viên.</p>
              </article>
            `,
          )
          .join('')}
      </div>
      <p class="legend">
        ${activeIndex === null
          ? 'Màn hình này dùng để giới thiệu toàn bộ roadmap trước khi vào từng màn hình thao tác.'
          : `Chúng ta đang đi vào chặng ${activeIndex + 1} của quy trình.`}
      </p>
    </section>
  `);
  await page.waitForLoadState('domcontentloaded');
}

async function clickLocator(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Could not calculate locator position for click.');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
  await page.waitForTimeout(120);
  await locator.click();
  await page.waitForTimeout(180);
}

type TeacherUserFixture = {
  _id: string;
  sub: string;
  email: string;
  role: 'TEACHER';
  fullName: string;
  userCode: string;
};

type StudentFixture = {
  _id: string;
  fullName: string;
  studentCode: string;
  age: number;
  parentName: string;
};

type ClassFixture = {
  _id: string;
  code: string;
  name: string;
  subject: string;
  grade: string;
  students: StudentFixture[];
};

type TeachingMaterialFixture = {
  _id: string;
  teacherId: string;
  title: string;
  description: string;
  manualSummary: string;
  aiSummary: string;
  extractionStatus: 'READY' | 'PENDING' | 'UNSUPPORTED' | 'FAILED';
  chunkCount: number;
  subject: string;
  grade: string;
  classId: { _id: string; name: string; code: string };
  fileUrl: string;
  fileType: string;
  fileCategory: 'pdf' | 'doc' | 'ppt' | 'excel' | 'image' | 'video' | 'other';
  fileSize: number;
  originalName: string;
  tags: string[];
  isShared: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
};

type DynamicFieldFixture = {
  key: string;
  label: string;
  type: 'number' | 'textarea';
  required?: boolean;
  order?: number;
  maxLength?: number;
};

type ReportTemplateFixture = {
  _id: string;
  teacherId: string;
  classId?: string;
  title: string;
  templateContent: string;
  version: number;
  dynamicFields: DynamicFieldFixture[];
  isGlobal: boolean;
};

type TeachingReportPayload = {
  lessonContent: string;
  studentAttitude: string;
  recordingUrl: string;
  teacherComment: string;
  homework: string;
  additionalNotes: string;
  templateId?: string;
  templateTitle?: string;
  templateVersion?: number;
  dynamicFieldValues?: Record<string, string | number | boolean>;
  dynamicFieldSchemaSnapshot?: DynamicFieldFixture[];
};

type SessionFixture = {
  _id: string;
  classId: { _id: string; name: string; code: string; classMode?: 'ONLINE' | 'OFFLINE' };
  studentId: { _id: string; fullName: string; studentCode?: string };
  teacherId: { _id: string; fullName: string; email?: string };
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  attendedAt?: string;
  amountCharged: number;
  teacherPayout: number;
  durationMinutes: number;
  status: 'SCHEDULED' | 'TEACHER_COMPLETED' | 'PARENT_CONFIRMED' | 'FINALIZED' | 'CANCELLED' | 'NO_SHOW';
  hasTeachingReport: boolean;
  sessionType: 'REGULAR' | 'TRIAL' | 'MAKE_UP' | 'EXAM_PREP' | 'REVIEW' | 'EXTRA';
  sessionNumber: number;
  isPaid: boolean;
  isTeacherPaid: boolean;
  topicsCovered?: string;
  homework?: string;
  teacherNotes?: string;
  teachingReport?: (TeachingReportPayload & { submittedAt?: string; isLateSubmission?: boolean }) | null;
};

type TicketFixture = {
  _id: string;
  type: 'SUBSTITUTE_TEACHER';
  subject: string;
  description: string;
  priority: 'HIGH';
  classId: { _id: string; name: string; code: string };
  teacherId: string;
  substituteFromDate: string;
  substituteToDate: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
};

type WorkflowState = {
  today: string;
  monthStart: string;
  monthEnd: string;
  user: TeacherUserFixture;
  classes: ClassFixture[];
  materials: TeachingMaterialFixture[];
  templates: ReportTemplateFixture[];
  sessions: SessionFixture[];
  tickets: TicketFixture[];
  loginBodies: Array<{ email: string; password: string }>;
  completeBodies: Array<Record<string, string>>;
  reportBodies: Array<{ sessionId: string; payload: TeachingReportPayload }>;
  substituteBodies: Array<Record<string, unknown>>;
  attendanceLinks: Array<{ classId: string; studentId: string; date: string; attendanceUrl: string; expiresAt: string }>;
};

function buildTeacherWorkflowState(): WorkflowState {
  const now = new Date();
  const today = formatLocalDateInput(now);
  const tomorrow = formatLocalDateInput(addDays(now, 1));
  const twoDaysLater = formatLocalDateInput(addDays(now, 2));
  const twoDaysAgo = formatLocalDateInput(addDays(now, -2));
  const fourDaysAgo = formatLocalDateInput(addDays(now, -4));
  const monthStart = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = formatLocalDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const user: TeacherUserFixture = {
    _id: 'teacher-demo-001',
    sub: 'teacher-demo-001',
    email: 'teacher.demo@school.local',
    role: 'TEACHER',
    fullName: 'Co Nguyen Demo',
    userCode: 'GV-DEMO-001',
  };

  const classAlphaStudents: StudentFixture[] = [
    {
      _id: 'student-teacher-master-001',
      fullName: 'Nguyen Minh Anh',
      studentCode: 'HS-TM-001',
      age: 10,
      parentName: 'Chi Lan',
    },
    {
      _id: 'student-teacher-master-002',
      fullName: 'Tran Bao Nam',
      studentCode: 'HS-TM-002',
      age: 11,
      parentName: 'Anh Tuan',
    },
  ];

  const classBetaStudents: StudentFixture[] = [
    {
      _id: 'student-teacher-master-003',
      fullName: 'Le Thao Vy',
      studentCode: 'HS-TM-003',
      age: 9,
      parentName: 'Chi Hanh',
    },
  ];

  const classes: ClassFixture[] = [
    {
      _id: 'class-teacher-master-001',
      code: 'CLS-TEA-001',
      name: 'Lop Toan Tu Duy 4A',
      subject: 'Toan Tu Duy',
      grade: 'Khoi 4',
      students: classAlphaStudents,
    },
    {
      _id: 'class-teacher-master-002',
      code: 'CLS-TEA-002',
      name: 'Lop English Movers 5B',
      subject: 'Tieng Anh',
      grade: 'Khoi 5',
      students: classBetaStudents,
    },
  ];

  const materials: TeachingMaterialFixture[] = [
    {
      _id: 'material-teacher-master-001',
      teacherId: user._id,
      title: 'Giao an Toan tu duy - Bai 12',
      description: 'Bo giao an de day phep so sanh va quy luat so hoc cho khoi 4.',
      manualSummary: 'Tap trung vao bai tap quy luat, tu duy logic va thao tac nhanh tren bang.',
      aiSummary: 'AI summary for Toan tu duy bai 12.',
      extractionStatus: 'READY',
      chunkCount: 8,
      subject: 'Toan Tu Duy',
      grade: 'Khoi 4',
      classId: {
        _id: classes[0]._id,
        name: classes[0].name,
        code: classes[0].code,
      },
      fileUrl: '/uploads/materials/toan-tu-duy-bai-12.pdf',
      fileType: 'application/pdf',
      fileCategory: 'pdf',
      fileSize: 5_120,
      originalName: 'toan-tu-duy-bai-12.pdf',
      tags: ['toan-tu-duy', 'quy-luat'],
      isShared: true,
      downloadCount: 4,
      createdAt: `${fourDaysAgo}T08:00:00.000Z`,
      updatedAt: `${twoDaysAgo}T08:00:00.000Z`,
    },
    {
      _id: 'material-teacher-master-002',
      teacherId: user._id,
      title: 'Slide English Movers - Unit 03',
      description: 'Slide cau truc cau don gian va tu vung chu de school life.',
      manualSummary: 'Bo slide gan voi lop Movers de giang trong 60 phut.',
      aiSummary: 'AI summary for English Movers unit 03.',
      extractionStatus: 'READY',
      chunkCount: 5,
      subject: 'Tieng Anh',
      grade: 'Khoi 5',
      classId: {
        _id: classes[1]._id,
        name: classes[1].name,
        code: classes[1].code,
      },
      fileUrl: '/uploads/materials/english-movers-unit-03.pptx',
      fileType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      fileCategory: 'ppt',
      fileSize: 8_192,
      originalName: 'english-movers-unit-03.pptx',
      tags: ['movers', 'slide'],
      isShared: true,
      downloadCount: 2,
      createdAt: `${fourDaysAgo}T08:00:00.000Z`,
      updatedAt: `${twoDaysAgo}T08:00:00.000Z`,
    },
    {
      _id: 'material-teacher-master-003',
      teacherId: user._id,
      title: 'Worksheet cuoi buoi',
      description: 'Bo bai tap ve nha theo muc do co ban.',
      manualSummary: 'Worksheet dung de giao bai tap sau buoi hoc.',
      aiSummary: 'AI summary for worksheet.',
      extractionStatus: 'READY',
      chunkCount: 3,
      subject: 'Toan Tu Duy',
      grade: 'Khoi 4',
      classId: {
        _id: classes[0]._id,
        name: classes[0].name,
        code: classes[0].code,
      },
      fileUrl: '/uploads/materials/worksheet-cuoi-buoi.docx',
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileCategory: 'doc',
      fileSize: 3_072,
      originalName: 'worksheet-cuoi-buoi.docx',
      tags: ['worksheet'],
      isShared: false,
      downloadCount: 1,
      createdAt: `${twoDaysAgo}T08:00:00.000Z`,
      updatedAt: `${twoDaysAgo}T08:00:00.000Z`,
    },
  ];

  const templates: ReportTemplateFixture[] = [
    {
      _id: 'report-template-teacher-master-001',
      teacherId: user._id,
      classId: classes[0]._id,
      title: 'Template danh gia buoi hoc',
      templateContent: 'Template dong danh gia buoi hoc cho giao vien.',
      version: 2,
      dynamicFields: [
        { key: 'rating', label: 'Rating', type: 'number', required: true, order: 1 },
        { key: 'nhan-xet', label: 'Nhan xet', type: 'textarea', required: true, order: 2, maxLength: 500 },
      ],
      isGlobal: false,
    },
  ];

  const sessions: SessionFixture[] = [
    {
      _id: 'session-teacher-master-001',
      classId: { _id: classes[0]._id, name: classes[0].name, code: classes[0].code, classMode: 'ONLINE' },
      studentId: { _id: classAlphaStudents[0]._id, fullName: classAlphaStudents[0].fullName, studentCode: classAlphaStudents[0].studentCode },
      teacherId: { _id: user._id, fullName: user.fullName, email: user.email },
      scheduledDate: today,
      scheduledStartTime: '19:00',
      scheduledEndTime: '20:30',
      attendedAt: atIso(today, '20:35'),
      amountCharged: 450_000,
      teacherPayout: 270_000,
      durationMinutes: 90,
      status: 'SCHEDULED',
      hasTeachingReport: false,
      sessionType: 'REGULAR',
      sessionNumber: 12,
      isPaid: false,
      isTeacherPaid: false,
      teachingReport: null,
    },
    {
      _id: 'session-calendar-preview-001',
      classId: { _id: classes[1]._id, name: classes[1].name, code: classes[1].code, classMode: 'ONLINE' },
      studentId: { _id: classBetaStudents[0]._id, fullName: classBetaStudents[0].fullName, studentCode: classBetaStudents[0].studentCode },
      teacherId: { _id: user._id, fullName: user.fullName, email: user.email },
      scheduledDate: tomorrow,
      scheduledStartTime: '17:30',
      scheduledEndTime: '18:30',
      attendedAt: atIso(tomorrow, '18:35'),
      amountCharged: 320_000,
      teacherPayout: 190_000,
      durationMinutes: 60,
      status: 'SCHEDULED',
      hasTeachingReport: false,
      sessionType: 'REGULAR',
      sessionNumber: 5,
      isPaid: false,
      isTeacherPaid: false,
      teachingReport: null,
    },
    {
      _id: 'session-teacher-master-002',
      classId: { _id: classes[1]._id, name: classes[1].name, code: classes[1].code, classMode: 'ONLINE' },
      studentId: { _id: classBetaStudents[0]._id, fullName: classBetaStudents[0].fullName, studentCode: classBetaStudents[0].studentCode },
      teacherId: { _id: user._id, fullName: user.fullName, email: user.email },
      scheduledDate: fourDaysAgo,
      scheduledStartTime: '18:00',
      scheduledEndTime: '19:00',
      attendedAt: atIso(fourDaysAgo, '19:05'),
      amountCharged: 330_000,
      teacherPayout: 200_000,
      durationMinutes: 60,
      status: 'FINALIZED',
      hasTeachingReport: true,
      sessionType: 'REGULAR',
      sessionNumber: 4,
      isPaid: true,
      isTeacherPaid: true,
      teachingReport: {
        lessonContent: 'On tap tu vung va luyen doc hieu.',
        studentAttitude: 'Tap trung tot.',
        recordingUrl: 'https://drive.example.com/recording-paid-session',
        teacherComment: 'Can tiep tuc ren phan phat am.',
        homework: 'Lam them bai tap trang 22.',
        additionalNotes: 'Da xac nhan voi phu huynh.',
        submittedAt: atIso(fourDaysAgo, '19:10'),
        isLateSubmission: false,
      },
    },
    {
      _id: 'session-teacher-master-003',
      classId: { _id: classes[0]._id, name: classes[0].name, code: classes[0].code, classMode: 'ONLINE' },
      studentId: { _id: classAlphaStudents[1]._id, fullName: classAlphaStudents[1].fullName, studentCode: classAlphaStudents[1].studentCode },
      teacherId: { _id: user._id, fullName: user.fullName, email: user.email },
      scheduledDate: twoDaysAgo,
      scheduledStartTime: '18:30',
      scheduledEndTime: '19:30',
      attendedAt: atIso(twoDaysAgo, '19:35'),
      amountCharged: 390_000,
      teacherPayout: 240_000,
      durationMinutes: 60,
      status: 'FINALIZED',
      hasTeachingReport: false,
      sessionType: 'REGULAR',
      sessionNumber: 10,
      isPaid: false,
      isTeacherPaid: false,
      teachingReport: null,
    },
  ];

  const tickets: TicketFixture[] = [
    {
      _id: 'ticket-teacher-master-001',
      type: 'SUBSTITUTE_TEACHER',
      subject: `Yeu cau GV day thay - ${classes[1].name}`,
      description: 'Can doi lich day do trung lich gia dinh.',
      priority: 'HIGH',
      classId: { _id: classes[1]._id, name: classes[1].name, code: classes[1].code },
      teacherId: user._id,
      substituteFromDate: tomorrow,
      substituteToDate: twoDaysLater,
      status: 'OPEN',
      createdAt: `${today}T07:30:00.000Z`,
    },
  ];

  return {
    today,
    monthStart,
    monthEnd,
    user,
    classes,
    materials,
    templates,
    sessions,
    tickets,
    loginBodies: [],
    completeBodies: [],
    reportBodies: [],
    substituteBodies: [],
    attendanceLinks: [],
  };
}

function reportPendingSessions(state: WorkflowState): SessionFixture[] {
  return state.sessions
    .filter((session) => ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(session.status) && !session.hasTeachingReport)
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) * -1);
}

function reportCompletedSessions(state: WorkflowState): SessionFixture[] {
  return state.sessions
    .filter((session) => session.hasTeachingReport)
    .sort((left, right) => {
      const leftSubmitted = left.teachingReport?.submittedAt || left.scheduledDate;
      const rightSubmitted = right.teachingReport?.submittedAt || right.scheduledDate;
      return rightSubmitted.localeCompare(leftSubmitted);
    });
}

function calendarSessions(state: WorkflowState): SessionFixture[] {
  return state.sessions.filter((session) => ['session-teacher-master-001', 'session-calendar-preview-001'].includes(session._id));
}

type PayrollPreviewSession = {
  _id: string;
  classId: { _id: string; name: string; code: string };
  studentId: { _id: string; fullName: string; studentCode?: string };
  scheduledDate: string;
  durationMinutes: number;
  teacherPayout: number;
  status: string;
  hasTeachingReport: boolean;
  isTeacherPaid: boolean;
  isPaid: boolean;
  payrollStatus: 'PAID' | 'ELIGIBLE' | 'BLOCKED_NO_REPORT' | 'WAITING_PARENT' | 'WAITING_FINALIZE' | 'CANCELLED' | 'NO_SHOW';
  teachingReport?: SessionFixture['teachingReport'];
};

function payrollStatusForSession(session: SessionFixture): PayrollPreviewSession['payrollStatus'] | null {
  if (session.status === 'CANCELLED') {
    return 'CANCELLED';
  }
  if (session.status === 'NO_SHOW') {
    return 'NO_SHOW';
  }
  if (session.isTeacherPaid || session.isPaid) {
    return 'PAID';
  }
  if (!session.hasTeachingReport && ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'].includes(session.status)) {
    return 'BLOCKED_NO_REPORT';
  }
  if (session.hasTeachingReport && ['TEACHER_COMPLETED', 'PARENT_CONFIRMED'].includes(session.status)) {
    return 'WAITING_FINALIZE';
  }
  if (session.hasTeachingReport && session.status === 'FINALIZED') {
    return 'ELIGIBLE';
  }
  return null;
}

function buildPayrollPreview(state: WorkflowState): Record<string, unknown> {
  const previewSessions: PayrollPreviewSession[] = state.sessions
    .map((session) => {
      const payrollStatus = payrollStatusForSession(session);
      if (!payrollStatus) {
        return null;
      }

      return {
        _id: session._id,
        classId: clone(session.classId),
        studentId: clone(session.studentId),
        scheduledDate: session.scheduledDate,
        durationMinutes: session.durationMinutes,
        teacherPayout: session.teacherPayout,
        status: session.status,
        hasTeachingReport: session.hasTeachingReport,
        isTeacherPaid: session.isTeacherPaid,
        isPaid: session.isPaid,
        payrollStatus,
        teachingReport: clone(session.teachingReport || null),
      };
    })
    .filter((item): item is PayrollPreviewSession => item !== null);

  const sumByStatus = (status: PayrollPreviewSession['payrollStatus']) =>
    previewSessions.filter((session) => session.payrollStatus === status).reduce((sum, session) => sum + session.teacherPayout, 0);

  return {
    teacherId: state.user._id,
    periodStart: state.monthStart,
    periodEnd: state.monthEnd,
    summary: {
      totalSessions: previewSessions.length,
      totalAttended: previewSessions.length,
      eligibleForPayroll: previewSessions.filter((session) => session.payrollStatus === 'ELIGIBLE').length,
      missingReport: previewSessions.filter((session) => session.payrollStatus === 'BLOCKED_NO_REPORT').length,
      pendingParentConfirm: previewSessions.filter((session) => session.payrollStatus === 'WAITING_PARENT').length,
      pendingFinalize: previewSessions.filter((session) => session.payrollStatus === 'WAITING_FINALIZE').length,
      finalizedNoReport: previewSessions.filter((session) => session.payrollStatus === 'BLOCKED_NO_REPORT').length,
      alreadyPaid: previewSessions.filter((session) => session.payrollStatus === 'PAID').length,
      cancelled: previewSessions.filter((session) => session.payrollStatus === 'CANCELLED').length,
      noShow: previewSessions.filter((session) => session.payrollStatus === 'NO_SHOW').length,
    },
    amounts: {
      totalEligiblePayout: sumByStatus('ELIGIBLE'),
      totalAlreadyPaid: sumByStatus('PAID'),
      totalBlockedByReport: sumByStatus('BLOCKED_NO_REPORT'),
      totalPendingConfirm: sumByStatus('WAITING_PARENT'),
      totalPendingFinalize: sumByStatus('WAITING_FINALIZE'),
      totalAttendedPayout: previewSessions.reduce((sum, session) => sum + session.teacherPayout, 0),
    },
    sessions: previewSessions,
    existingPayrolls: [
      {
        payrollCode: 'PAY-TEA-APR-001',
        status: 'PAID',
        totalSessions: 1,
        grossAmount: 200_000,
        netAmount: 200_000,
        periodStart: state.monthStart,
        periodEnd: state.monthEnd,
        notes: 'Da doi soat xong.',
      },
    ],
  };
}

function buildTeacherDashboard(state: WorkflowState): Record<string, unknown> {
  const upcoming = calendarSessions(state).map((session) => ({
    _id: session._id,
    scheduledDate: `${session.scheduledDate}T${session.scheduledStartTime}:00`,
    studentId: clone(session.studentId),
    classId: clone(session.classId),
    status: session.status,
  }));

  return {
    sessions: {
      upcomingCount: upcoming.filter((session) => session.status === 'SCHEDULED').length,
      total: state.sessions.length,
      completedCount: state.sessions.filter((session) => ['TEACHER_COMPLETED', 'FINALIZED', 'PARENT_CONFIRMED'].includes(session.status)).length,
      cancelledCount: state.sessions.filter((session) => session.status === 'CANCELLED').length,
      noShowCount: state.sessions.filter((session) => session.status === 'NO_SHOW').length,
      byStatus: {
        SCHEDULED: state.sessions.filter((session) => session.status === 'SCHEDULED').length,
        TEACHER_COMPLETED: state.sessions.filter((session) => session.status === 'TEACHER_COMPLETED').length,
        FINALIZED: state.sessions.filter((session) => session.status === 'FINALIZED').length,
      },
    },
    earnings: {
      totalEarned: 12_400_000,
      pendingPayout: 510_000,
      lastPayroll: {
        payrollCode: 'PAY-TEA-MAR-001',
        periodStart: state.monthStart,
        periodEnd: state.monthEnd,
        netAmount: 6_200_000,
        status: 'PAID',
      },
    },
    classes: {
      activeCount: state.classes.length,
      list: state.classes.map((item) => ({
        _id: item._id,
        name: item.name,
        code: item.code,
        subject: item.subject,
        grade: item.grade,
        students: clone(item.students),
      })),
    },
    tickets: {
      openTickets: state.tickets.filter((ticket) => ticket.status !== 'RESOLVED').length,
      myTickets: state.tickets.length,
    },
    profile: {
      subjects: ['Toan Tu Duy', 'Tieng Anh'],
      grades: ['Khoi 4', 'Khoi 5'],
      averageRating: 4.9,
      totalSessionsCompleted: 128,
      hourlyRate: 280_000,
      status: 'ACTIVE',
    },
    upcoming,
  };
}

function buildDailyTasksBoard(state: WorkflowState): Record<string, unknown> {
  return {
    role: state.user.role,
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
        description: 'Checklist giao vien can xu ly trong ngay.',
        emptyMessage: 'Khong co dau viec nao.',
        count: 3,
        tasks: [
          {
            id: 'daily-task-001',
            type: 'SESSION',
            title: 'Hoan thanh buoi day toi nay',
            detail: `Buoi ${state.sessions[0].classId.name} luc ${state.sessions[0].scheduledStartTime}`,
            priority: 'HIGH',
            route: '/app/sessions',
            actionLabel: 'Mo buoi hoc',
          },
          {
            id: 'daily-task-002',
            type: 'REPORT',
            title: 'Nop bao cao giang day',
            detail: 'Bao cao can nop truoc khi tinh luong.',
            priority: 'CRITICAL',
            route: '/app/teaching-report',
            actionLabel: 'Mo bao cao',
          },
          {
            id: 'daily-task-003',
            type: 'ATTENDANCE',
            title: 'Lay link diem danh',
            detail: 'Gui link check-in cho hoc sinh truoc gio hoc.',
            priority: 'MEDIUM',
            route: '/app/attendance',
            actionLabel: 'Mo diem danh',
          },
        ],
      },
    ],
  };
}

class TeacherWorkflowPage {
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

  async loginAsTeacher(): Promise<void> {
    await this.goto('/login');
    await expect(this.page.getByTestId('login-form')).toBeVisible();
    await this.slowFill(this.page.getByTestId('login-email'), 'teacher.demo@school.local');
    await this.pause(600);
    await this.slowFill(this.page.getByTestId('login-password'), '123456');
    await this.pause();
    await this.page.getByTestId('login-submit').click();
    await this.page.waitForURL(/\/app\/dashboard/, { timeout: 30_000 });
  }
}

async function installTeacherWorkflowRoutes(page: Page, state: WorkflowState): Promise<void> {
  const knownSessionIds = state.sessions.map((session) => session._id).join('|');
  const AUTH_LOGIN_API = new RegExp(`${API_PREFIX_PATTERN}/auth/login(?:\\?.*)?$`);
  const AUTH_LOGOUT_API = new RegExp(`${API_PREFIX_PATTERN}/auth/logout(?:\\?.*)?$`);
  const USERS_ME_API = new RegExp(`${API_PREFIX_PATTERN}/users/me(?:\\?.*)?$`);
  const NOTIFICATIONS_COUNT_API = new RegExp(`${API_PREFIX_PATTERN}/notifications/unread-count(?:\\?.*)?$`);
  const DASHBOARD_DAILY_TASKS_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/daily-tasks(?:\\?.*)?$`);
  const DASHBOARD_TEACHER_API = new RegExp(`${API_PREFIX_PATTERN}/dashboard/teacher(?:\\?.*)?$`);
  const TEACHER_CALENDAR_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/my-sessions(?:\\?.*)?$`);
  const TEACHING_MATERIALS_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials(?:\\?.*)?$`);
  const TEACHING_MATERIALS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/teaching-materials/stats(?:\\?.*)?$`);
  const CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/classes(?:\\?.*)?$`);
  const ATTENDANCE_CLASSES_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/classes-with-students(?:\\?.*)?$`);
  const ATTENDANCE_CLASS_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/class/class-teacher-master-001(?:\\?.*)?$`);
  const ATTENDANCE_GENERATE_LINK_API = new RegExp(`${API_PREFIX_PATTERN}/attendance/generate-link(?:\\?.*)?$`);
  const SESSIONS_STATS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/stats(?:\\?.*)?$`);
  const SESSIONS_LIST_API = new RegExp(`${API_PREFIX_PATTERN}/sessions(?:\\?.*)?$`);
  const SESSION_DETAIL_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/(${knownSessionIds})(?:\\?.*)?$`);
  const SESSION_CHANGE_REQUESTS_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/(${knownSessionIds})/change-requests(?:\\?.*)?$`);
  const SESSION_COMPLETE_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/session-teacher-master-001/complete(?:\\?.*)?$`);
  const SESSION_REPORT_API = new RegExp(`${API_PREFIX_PATTERN}/sessions/(${knownSessionIds})/teaching-report(?:\\?.*)?$`);
  const REPORT_TEMPLATES_API = new RegExp(`${API_PREFIX_PATTERN}/report-templates(?:\\?.*)?$`);
  const PAYROLL_PREVIEW_API = new RegExp(`${API_PREFIX_PATTERN}/payroll/teacher-preview(?:\\?.*)?$`);
  const MY_TICKETS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets/my-tickets(?:\\?.*)?$`);
  const TICKETS_API = new RegExp(`${API_PREFIX_PATTERN}/tickets(?:\\?.*)?$`);

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

  await page.route(NOTIFICATIONS_COUNT_API, async (route) => {
    await jsonResponse(route, { count: 3 });
  });

  await page.route(DASHBOARD_DAILY_TASKS_API, async (route) => {
    await jsonResponse(route, buildDailyTasksBoard(state));
  });

  await page.route(DASHBOARD_TEACHER_API, async (route) => {
    await jsonResponse(route, buildTeacherDashboard(state));
  });

  await page.route(TEACHER_CALENDAR_API, async (route) => {
    const url = new URL(route.request().url());
    const fromDate = url.searchParams.get('fromDate') || state.monthStart;
    const toDate = url.searchParams.get('toDate') || state.monthEnd;
    const data = calendarSessions(state).filter(
      (session) => session.scheduledDate >= fromDate && session.scheduledDate <= toDate,
    );
    await jsonResponse(route, { data: clone(data) });
  });

  await page.route(TEACHING_MATERIALS_STATS_API, async (route) => {
    const bySubject = state.materials.reduce<Record<string, number>>((acc, item) => {
      acc[item.subject] = (acc[item.subject] || 0) + 1;
      return acc;
    }, {});
    const byGrade = state.materials.reduce<Record<string, number>>((acc, item) => {
      acc[item.grade] = (acc[item.grade] || 0) + 1;
      return acc;
    }, {});

    await jsonResponse(route, {
      total: state.materials.length,
      readyForAI: state.materials.filter((item) => item.extractionStatus === 'READY').length,
      totalChunks: state.materials.reduce((sum, item) => sum + item.chunkCount, 0),
      bySubject,
      byGrade,
      totalSizeBytes: state.materials.reduce((sum, item) => sum + item.fileSize, 0),
      totalSizeMB: 1,
    });
  });

  await page.route(TEACHING_MATERIALS_API, async (route) => {
    const url = new URL(route.request().url());
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const filtered = state.materials.filter((item) => {
      if (!search) {
        return true;
      }

      return [
        item.title,
        item.description,
        item.manualSummary,
        item.aiSummary,
        item.subject,
        item.grade,
        ...item.tags,
      ].some((value) => value.toLowerCase().includes(search));
    });

    await jsonResponse(route, {
      data: clone(filtered),
      meta: {
        total: filtered.length,
        page: 1,
        limit: 18,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });

  await page.route(CLASSES_API, async (route) => {
    await jsonResponse(
      route,
      state.classes.map((item) => ({
        _id: item._id,
        code: item.code,
        name: item.name,
        subject: item.subject,
        grade: item.grade,
        studentCount: item.students.length,
        students: clone(item.students),
      })),
    );
  });

  await page.route(ATTENDANCE_CLASSES_API, async (route) => {
    await jsonResponse(
      route,
      state.classes.map((item) => ({
        classId: item._id,
        classCode: item.code,
        className: item.name,
        studentCount: item.students.length,
        students: item.students.map((student) => ({
          studentId: student._id,
          fullName: student.fullName,
          studentCode: student.studentCode,
          age: student.age,
          parentName: student.parentName,
        })),
      })),
    );
  });

  await page.route(ATTENDANCE_CLASS_API, async (route) => {
    const classItem = state.classes[0];
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date') || state.today;

    await jsonResponse(route, {
      class: {
        _id: classItem._id,
        name: classItem.name,
        code: classItem.code,
      },
      date,
      permissions: {
        canBulkEdit: false,
        canGenerateLink: true,
        blockedReason: '',
        substituteActive: false,
        substituteTeacherId: null,
        activeTeacherId: state.user._id,
      },
      attendanceList: classItem.students.map((student) => ({
        student: {
          _id: student._id,
          fullName: student.fullName,
          age: student.age,
          parentName: student.parentName,
        },
        attendance: {
          classId: classItem._id,
          studentId: student._id,
          date,
          status: null,
          notes: '',
        },
      })),
    });
  });

  await page.route(ATTENDANCE_GENERATE_LINK_API, async (route) => {
    const body = route.request().postDataJSON() as {
      classId: string;
      studentId: string;
      date: string;
    };
    const attendanceUrl = `${APP_BASE_URL}/attendance/check-in/token-${body.studentId}-${body.date}`;
    const link = {
      classId: body.classId,
      studentId: body.studentId,
      date: body.date,
      attendanceUrl,
      expiresAt: `${body.date}T23:59:59.000Z`,
    };
    state.attendanceLinks.push(clone(link));
    await jsonResponse(route, link);
  });

  await page.route(SESSIONS_STATS_API, async (route) => {
    const visibleSessions = state.sessions.filter((session) => session.status !== 'CANCELLED');
    await jsonResponse(route, {
      totalSessions: visibleSessions.length,
      totalRevenue: visibleSessions.reduce((sum, session) => sum + session.amountCharged, 0),
      totalTeacherCost: visibleSessions.reduce((sum, session) => sum + session.teacherPayout, 0),
    });
  });

  await page.route(SESSIONS_LIST_API, async (route) => {
    const url = new URL(route.request().url());
    const hasReport = url.searchParams.get('hasReport');

    if (hasReport === 'true') {
      const completed = reportCompletedSessions(state);
      await jsonResponse(route, {
        data: clone(completed),
        meta: { total: completed.length, page: 1, limit: 20, totalPages: 1 },
      });
      return;
    }

    if (hasReport === 'false') {
      const pending = reportPendingSessions(state);
      await jsonResponse(route, {
        data: clone(pending),
        meta: { total: pending.length, page: 1, limit: 20, totalPages: 1 },
      });
      return;
    }

    const status = url.searchParams.get('status') || '';
    const fromDate = url.searchParams.get('fromDate') || '';
    const toDate = url.searchParams.get('toDate') || '';

    let sessions = [...state.sessions];
    if (status) {
      sessions = sessions.filter((session) => session.status === status);
    }
    if (fromDate) {
      sessions = sessions.filter((session) => session.scheduledDate >= fromDate);
    }
    if (toDate) {
      sessions = sessions.filter((session) => session.scheduledDate <= toDate);
    }

    await jsonResponse(route, {
      data: clone(sessions),
      meta: { total: sessions.length, page: 1, limit: 20, totalPages: 1 },
    });
  });

  await page.route(SESSION_DETAIL_API, async (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.pathname.split('/').filter(Boolean).pop() || '';
    const session = state.sessions.find((item) => item._id === sessionId);
    await jsonResponse(route, clone(session), session ? 200 : 404);
  });

  await page.route(SESSION_CHANGE_REQUESTS_API, async (route) => {
    await jsonResponse(route, []);
  });

  await page.route(SESSION_COMPLETE_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, string>;
    state.completeBodies.push(clone(payload));

    const session = state.sessions.find((item) => item._id === 'session-teacher-master-001');
    if (session) {
      session.status = 'TEACHER_COMPLETED';
      session.topicsCovered = payload['topicsCovered'] || '';
      session.homework = payload['homework'] || '';
      session.teacherNotes = payload['teacherNotes'] || '';
    }

    await jsonResponse(route, { ok: true });
  });

  await page.route(SESSION_REPORT_API, async (route) => {
    const payload = route.request().postDataJSON() as TeachingReportPayload;
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/').filter(Boolean);
    const sessionId = parts[parts.length - 2] || '';
    state.reportBodies.push({ sessionId, payload: clone(payload) });

    const session = state.sessions.find((item) => item._id === sessionId);
    if (!session) {
      await jsonResponse(route, { message: 'Session not found' }, 404);
      return;
    }

    session.hasTeachingReport = true;
    session.teachingReport = {
      ...clone(payload),
      submittedAt: new Date().toISOString(),
      isLateSubmission: false,
    };

    await jsonResponse(route, clone(session));
  });

  await page.route(REPORT_TEMPLATES_API, async (route) => {
    await jsonResponse(route, clone(state.templates));
  });

  await page.route(PAYROLL_PREVIEW_API, async (route) => {
    const preview = buildPayrollPreview(state);
    const url = new URL(route.request().url());
    await jsonResponse(route, {
      ...preview,
      periodStart: url.searchParams.get('periodStart') || state.monthStart,
      periodEnd: url.searchParams.get('periodEnd') || state.monthEnd,
    });
  });

  await page.route(MY_TICKETS_API, async (route) => {
    await jsonResponse(route, clone(state.tickets));
  });

  await page.route(TICKETS_API, async (route) => {
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    state.substituteBodies.push(clone(payload));

    const classId = String(payload['classId'] || '');
    const selectedClass = state.classes.find((item) => item._id === classId) || state.classes[0];
    const createdTicket: TicketFixture = {
      _id: `ticket-created-${pad(state.tickets.length + 1)}`,
      type: 'SUBSTITUTE_TEACHER',
      subject: `Yeu cau GV day thay - ${selectedClass.name}`,
      description: String(payload['description'] || ''),
      priority: 'HIGH',
      classId: {
        _id: selectedClass._id,
        name: selectedClass.name,
        code: selectedClass.code,
      },
      teacherId: String(payload['teacherId'] || state.user._id),
      substituteFromDate: String(payload['substituteFromDate'] || state.today),
      substituteToDate: String(payload['substituteToDate'] || state.today),
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    state.tickets.unshift(createdTicket);
    await jsonResponse(route, clone(createdTicket), 201);
  });
}

test.describe.serial('Teacher full workflow video', () => {
  test(VIDEO_TEST_TITLE, async ({ page }) => {
    test.setTimeout(900_000);

    const state = buildTeacherWorkflowState();
    const ui = new TeacherWorkflowPage(page);
    const context = page.context();
    const artifactDir = path.join(META_DIR, `teacher-demo-${Date.now()}`);
    const recordingStartedAt = Date.now();
    const cues: NarrationCue[] = [];
    const narrationDurationMap = await buildNarrationDurationMap([
      TEACHER_VIDEO_COPY.introNarration,
      TEACHER_VIDEO_COPY.roadmapNarration,
      TEACHER_VIDEO_COPY.dashboardSceneNarration,
      TEACHER_VIDEO_COPY.dashboardNarration,
      TEACHER_VIDEO_COPY.calendarSceneNarration,
      TEACHER_VIDEO_COPY.calendarNarration,
      TEACHER_VIDEO_COPY.materialsSceneNarration,
      TEACHER_VIDEO_COPY.materialsNarration,
      TEACHER_VIDEO_COPY.attendanceSceneNarration,
      TEACHER_VIDEO_COPY.attendanceNarration,
      TEACHER_VIDEO_COPY.sessionSceneNarration,
      TEACHER_VIDEO_COPY.sessionCompleteNarration,
      TEACHER_VIDEO_COPY.teachingReportSceneNarration,
      TEACHER_VIDEO_COPY.teachingReportNarration,
      TEACHER_VIDEO_COPY.payrollSceneNarration,
      TEACHER_VIDEO_COPY.payrollNarration,
      TEACHER_VIDEO_COPY.substituteSceneNarration,
      TEACHER_VIDEO_COPY.substituteNarration,
      TEACHER_VIDEO_COPY.logoutSceneNarration,
      TEACHER_VIDEO_COPY.logoutNarration,
      TEACHER_VIDEO_COPY.outroNarration,
    ]);
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
    await installClipboardHarness(page);
    await installTeacherWorkflowRoutes(page, state);
    await installVideoOverlay(page);

    try {
      const introPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'intro',
        TEACHER_VIDEO_COPY.introNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        TEACHER_VIDEO_COPY.introTitle,
        TEACHER_VIDEO_COPY.introDescription,
        [...TEACHER_VIDEO_COPY.introBullets],
      );
      await waitForNarrationWindow(page, introPlayback, 4_600);

      const roadmapPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'roadmap',
        TEACHER_VIDEO_COPY.roadmapNarration,
        narrationDurationMap,
      );
      await showWorkflowRoadmapCard(
        page,
        TEACHER_VIDEO_COPY.roadmapTitle,
        TEACHER_VIDEO_COPY.roadmapDescription,
        TEACHER_VIDEO_COPY.workflowSteps,
      );
      await waitForNarrationWindow(page, roadmapPlayback, 5_400);

      await presentSceneCard(
        'scene-dashboard',
        TEACHER_VIDEO_COPY.dashboardSceneTitle,
        TEACHER_VIDEO_COPY.dashboardSceneDescription,
        TEACHER_VIDEO_COPY.dashboardSceneBullets,
        TEACHER_VIDEO_COPY.dashboardSceneNarration,
      );

      await ui.loginAsTeacher();
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await expect(page.getByRole('heading', { name: /(Dashboard Giáo viên|Dashboard Giao vien)/i })).toBeVisible();
      await setVideoLabel(page, TEACHER_VIDEO_COPY.dashboardLabel);
      const dashboardPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'dashboard',
        TEACHER_VIDEO_COPY.dashboardNarration,
        narrationDurationMap,
      );
      await setVideoCallout(page, page.locator('.handbook-card'), TEACHER_VIDEO_COPY.dashboardHandbookCallout);
      await ui.pause(2_600);
      await setVideoCallout(page, page.locator('.card.highlight.green'), TEACHER_VIDEO_COPY.dashboardIncomeCallout);
      await ui.pause(2_200);
      await setVideoCallout(
        page,
        page.locator('.card.full').filter({ has: page.getByRole('heading', { name: /Lịch dạy sắp tới/i }) }).first(),
        TEACHER_VIDEO_COPY.dashboardUpcomingCallout,
      );
      await ui.pause(2_400);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, dashboardPlayback);

      await presentSceneCard(
        'scene-calendar',
        TEACHER_VIDEO_COPY.calendarSceneTitle,
        TEACHER_VIDEO_COPY.calendarSceneDescription,
        TEACHER_VIDEO_COPY.calendarSceneBullets,
        TEACHER_VIDEO_COPY.calendarSceneNarration,
      );

      await ui.goto('/app/teacher-calendar');
      await expect(page.locator('.week-view')).toBeVisible();
      await setVideoLabel(page, TEACHER_VIDEO_COPY.calendarLabel);
      const calendarPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'calendar',
        TEACHER_VIDEO_COPY.calendarNarration,
        narrationDurationMap,
      );
      const firstEvent = page.locator('.week-view .session-card').first();
      await setVideoCallout(page, firstEvent, TEACHER_VIDEO_COPY.calendarEventCallout);
      await ui.pause(2_000);
      await clickLocator(page, firstEvent);
      const expandedDetail = page.locator('.week-view .session-card.expanded .session-details').first();
      await expect(expandedDetail).toBeVisible();
      await setVideoCallout(page, expandedDetail, TEACHER_VIDEO_COPY.calendarDetailCallout);
      await ui.pause(2_600);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, calendarPlayback);

      await presentSceneCard(
        'scene-materials',
        TEACHER_VIDEO_COPY.materialsSceneTitle,
        TEACHER_VIDEO_COPY.materialsSceneDescription,
        TEACHER_VIDEO_COPY.materialsSceneBullets,
        TEACHER_VIDEO_COPY.materialsSceneNarration,
      );

      await ui.goto('/app/teaching-materials');
      await setVideoLabel(page, TEACHER_VIDEO_COPY.materialsLabel);
      const materialsPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'materials',
        TEACHER_VIDEO_COPY.materialsNarration,
        narrationDurationMap,
      );
      const searchInput = page.locator('.search-field input');
      await setVideoCallout(page, searchInput, TEACHER_VIDEO_COPY.materialsSearchCallout);
      await ui.pause(1_500);
      await ui.slowFill(searchInput, 'Bai 12');
      const filteredCard = page.locator('.material-card').filter({ hasText: 'Giao an Toan tu duy - Bai 12' }).first();
      await expect(filteredCard).toBeVisible();
      await expect(page.locator('.material-card')).toHaveCount(1);
      await setVideoCallout(page, filteredCard, TEACHER_VIDEO_COPY.materialsCardCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, materialsPlayback);

      await presentSceneCard(
        'scene-attendance',
        TEACHER_VIDEO_COPY.attendanceSceneTitle,
        TEACHER_VIDEO_COPY.attendanceSceneDescription,
        TEACHER_VIDEO_COPY.attendanceSceneBullets,
        TEACHER_VIDEO_COPY.attendanceSceneNarration,
      );

      await ui.goto('/app/attendance');
      await setVideoLabel(page, TEACHER_VIDEO_COPY.attendanceLabel);
      const attendancePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'attendance',
        TEACHER_VIDEO_COPY.attendanceNarration,
        narrationDurationMap,
      );
      await page.getByTestId('attendance-class-select').selectOption(state.classes[0]._id);
      await page.getByTestId('attendance-date-input').fill(state.today);
      await setVideoCallout(page, page.getByTestId('attendance-load-button'), TEACHER_VIDEO_COPY.attendanceLoadCallout);
      await ui.pause(1_700);
      await clickLocator(page, page.getByTestId('attendance-load-button'));
      const studentCard = page.getByTestId(`attendance-student-card-${state.classes[0].students[0]._id}`);
      await expect(studentCard).toBeVisible();
      await setVideoCallout(page, studentCard, TEACHER_VIDEO_COPY.attendanceStudentCallout);
      await ui.pause(2_200);
      const generateLinkButton = page.getByTestId(`attendance-generate-link-${state.classes[0].students[0]._id}`);
      await setVideoCallout(page, generateLinkButton, TEACHER_VIDEO_COPY.attendanceLinkCallout);
      await ui.pause(1_800);
      const dialogMessage = await captureSingleDialog(page, async () => {
        await clickLocator(page, generateLinkButton);
      });
      expect(dialogMessage).toContain('Link da duoc copy vao clipboard');
      const { attendanceUrl } = extractAttendanceLink(dialogMessage);
      const clipboardWrites = await getClipboardWrites(page);
      expect(clipboardWrites).toContain(attendanceUrl);
      await ui.pause(2_200);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, attendancePlayback);

      await presentSceneCard(
        'scene-session',
        TEACHER_VIDEO_COPY.sessionSceneTitle,
        TEACHER_VIDEO_COPY.sessionSceneDescription,
        TEACHER_VIDEO_COPY.sessionSceneBullets,
        TEACHER_VIDEO_COPY.sessionSceneNarration,
      );

      await ui.goto('/app/sessions');
      await setVideoLabel(page, TEACHER_VIDEO_COPY.sessionCompleteLabel);
      const sessionCompletePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'session-complete',
        TEACHER_VIDEO_COPY.sessionCompleteNarration,
        narrationDurationMap,
      );
      const sessionRow = page.getByTestId('session-row-session-teacher-master-001');
      await expect(sessionRow).toBeVisible();
      expect(normalizeText((await sessionRow.textContent()) || '')).toMatch(/da len lich|scheduled/);
      await setVideoCallout(page, sessionRow, TEACHER_VIDEO_COPY.sessionRowCallout);
      await ui.pause(2_000);

      const detailButton = sessionRow.getByTestId('sessions-view-detail');
      await clickLocator(page, detailButton);
      const detailModal = page.locator('.modal.modal-lg');
      await expect(detailModal).toContainText(state.classes[0].name);
      await setVideoCallout(page, detailModal, TEACHER_VIDEO_COPY.sessionDetailCallout);
      await ui.pause(2_400);
      await clickLocator(page, page.getByTestId('sessions-detail-close'));
      await expect(page.getByTestId('sessions-detail-close')).toHaveCount(0);

      await clickLocator(page, sessionRow.getByTestId('sessions-complete-button'));
      const completeModal = page.locator('.modal').filter({ has: page.getByTestId('sessions-complete-submit') }).first();
      await expect(page.getByTestId('sessions-complete-submit')).toBeVisible();
      await setVideoCallout(page, completeModal, TEACHER_VIDEO_COPY.sessionCompleteFormCallout);
      await ui.slowFill(
        page.getByTestId('sessions-complete-topics'),
        'On phep so sanh, quy luat day so va bai tap thuc hanh cuoi buoi.',
      );
      await ui.slowFill(
        page.getByTestId('sessions-complete-homework'),
        'Hoan thanh worksheet trang 12 va chup anh nop lai truoc toi mai.',
      );
      await ui.slowFill(
        page.getByTestId('sessions-complete-notes'),
        'Hoc sinh tiep thu tot, can ren them toc do tinh nham.',
      );
      await ui.pause(2_200);
      await clickLocator(page, page.getByTestId('sessions-complete-submit'));
      await expect.poll(() => state.completeBodies.length).toBe(1);
      await expect(page.getByTestId('sessions-complete-submit')).toHaveCount(0);
      expect(normalizeText((await sessionRow.textContent()) || '')).toMatch(/gv hoan thanh|teacher completed/);
      await setVideoCallout(page, sessionRow, TEACHER_VIDEO_COPY.sessionCompletedCallout);
      await ui.pause(2_600);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, sessionCompletePlayback);

      await presentSceneCard(
        'scene-report',
        TEACHER_VIDEO_COPY.teachingReportSceneTitle,
        TEACHER_VIDEO_COPY.teachingReportSceneDescription,
        TEACHER_VIDEO_COPY.teachingReportSceneBullets,
        TEACHER_VIDEO_COPY.teachingReportSceneNarration,
      );

      await ui.goto('/app/teaching-report');
      await expect(page.getByTestId('report-tab-pending')).toBeVisible();
      await setVideoLabel(page, TEACHER_VIDEO_COPY.teachingReportLabel);
      const teachingReportPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'teaching-report',
        TEACHER_VIDEO_COPY.teachingReportNarration,
        narrationDurationMap,
      );
      await clickLocator(page, page.getByTestId('report-tab-pending'));
      const pendingCard = page.getByTestId('report-pending-card-session-teacher-master-001');
      await expect(pendingCard).toBeVisible();
      await setVideoCallout(page, pendingCard, TEACHER_VIDEO_COPY.teachingReportPendingCallout);
      await ui.pause(2_100);
      await clickLocator(page, page.getByTestId('report-pending-expand-session-teacher-master-001'));
      await expect(page.getByTestId('report-pending-form-session-teacher-master-001')).toBeVisible();
      await page.getByTestId('report-template-select').selectOption('report-template-teacher-master-001');
      await expect(page.getByTestId('report-active-template')).toContainText('Template danh gia buoi hoc');
      await setVideoCallout(page, page.getByTestId('report-template-select'), TEACHER_VIDEO_COPY.teachingReportTemplateCallout);
      await ui.pause(1_800);
      await ui.slowFill(page.getByTestId('report-dynamic-field-rating'), '5');
      await ui.slowFill(
        page.getByTestId('report-dynamic-field-nhan-xet'),
        'Hoc sinh nam bai nhanh, tuong tac tot, can tiep tuc luyen tap de giu nhip hoc deu.',
      );
      await setVideoCallout(
        page,
        page.getByTestId('report-pending-form-session-teacher-master-001'),
        TEACHER_VIDEO_COPY.teachingReportFormCallout,
      );
      await ui.pause(2_400);
      await clickLocator(page, page.getByTestId('report-submit'));
      await expect.poll(() => state.reportBodies.length).toBe(1);
      const successAlert = page.locator('.alert-success');
      await expect(successAlert).toBeVisible();
      expect(normalizeText((await successAlert.textContent()) || '')).toMatch(/nop bao cao thanh cong|thanh cong/);
      await clickLocator(page, page.getByTestId('report-tab-completed'));
      const completedCard = page.locator('.session-card.completed').filter({ hasText: state.classes[0].name }).first();
      await expect(completedCard).toBeVisible();
      await clickLocator(page, completedCard.locator('.session-header'));
      const reportView = completedCard.locator('.report-view');
      await expect(reportView).toContainText('Rating');
      await expect(reportView).toContainText('5');
      await expect(reportView).toContainText('Nhan xet');
      await expect(reportView).toContainText('Hoc sinh nam bai nhanh');
      await setVideoCallout(page, reportView, TEACHER_VIDEO_COPY.teachingReportCompletedCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, teachingReportPlayback);

      await presentSceneCard(
        'scene-payroll',
        TEACHER_VIDEO_COPY.payrollSceneTitle,
        TEACHER_VIDEO_COPY.payrollSceneDescription,
        TEACHER_VIDEO_COPY.payrollSceneBullets,
        TEACHER_VIDEO_COPY.payrollSceneNarration,
      );

      await ui.goto('/app/payroll');
      await setVideoLabel(page, TEACHER_VIDEO_COPY.payrollLabel);
      const payrollPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'payroll',
        TEACHER_VIDEO_COPY.payrollNarration,
        narrationDurationMap,
      );
      const filterBar = page.locator('.filter-bar');
      const periodInputs = page.locator('.filter-bar input[type="date"]');
      await expect(periodInputs).toHaveCount(2);
      await setVideoCallout(page, filterBar, TEACHER_VIDEO_COPY.payrollFilterCallout);
      await periodInputs.nth(0).fill(state.monthStart);
      await periodInputs.nth(1).fill(state.monthEnd);
      await ui.pause(1_600);
      await clickLocator(page, page.locator('.filter-bar .btn-primary'));
      const summaryGrid = page.locator('.summary-grid');
      await expect(summaryGrid).toBeVisible();
      const summaryText = normalizeText((await summaryGrid.textContent()) || '');
      expect(summaryText).toContain('da thanh toan');
      expect(summaryText).toContain('cho ops xac nhan');
      expect(summaryText).toContain('thieu bao cao');
      await expect(page.locator('.session-table thead')).toContainText(/(Báo cáo|Bao cao)/i);
      await setVideoCallout(page, summaryGrid, TEACHER_VIDEO_COPY.payrollSummaryCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, payrollPlayback);

      await presentSceneCard(
        'scene-substitute',
        TEACHER_VIDEO_COPY.substituteSceneTitle,
        TEACHER_VIDEO_COPY.substituteSceneDescription,
        TEACHER_VIDEO_COPY.substituteSceneBullets,
        TEACHER_VIDEO_COPY.substituteSceneNarration,
      );

      await ui.goto('/app/teacher-substitute-request');
      await setVideoLabel(page, TEACHER_VIDEO_COPY.substituteLabel);
      const substitutePlayback = beginNarration(
        cues,
        recordingStartedAt,
        'substitute-request',
        TEACHER_VIDEO_COPY.substituteNarration,
        narrationDurationMap,
      );
      const createButton = page.locator('.page-header button.primary');
      await expect(createButton).toBeVisible();
      await setVideoCallout(page, createButton, TEACHER_VIDEO_COPY.substituteCreateCallout);
      await ui.pause(1_800);
      await clickLocator(page, createButton);
      const modal = page.locator('.modal');
      await expect(modal).toBeVisible();
      await setVideoCallout(page, modal, TEACHER_VIDEO_COPY.substituteModalCallout);
      await modal.locator('select[name="classId"]').selectOption(state.classes[0]._id);
      await modal.locator('input[name="fromDate"]').fill(state.today);
      await modal.locator('input[name="toDate"]').fill(
        formatLocalDateInput(addDays(new Date(`${state.today}T00:00:00`), 1)),
      );
      await ui.slowFill(modal.locator('textarea[name="reason"]'), 'Ban viec dot xuat xin nghi');
      await ui.pause(2_400);
      await clickLocator(page, modal.locator('.form-actions button.primary'));
      await expect.poll(() => state.substituteBodies.length).toBe(1);
      await expect(modal.locator('.success-msg')).toContainText(/(thành công|thanh cong)/i);
      await expect(page.locator('.modal-backdrop')).toHaveCount(0);
      const newestRequestRow = page.locator('table.data tbody tr').first();
      await expect(newestRequestRow).toContainText('Ban viec dot xuat xin nghi');
      await setVideoCallout(page, newestRequestRow, TEACHER_VIDEO_COPY.substituteSuccessCallout);
      await ui.pause(2_800);
      await setVideoCallout(page, null, null);
      await waitForNarrationWindow(page, substitutePlayback);

      await presentSceneCard(
        'scene-logout',
        TEACHER_VIDEO_COPY.logoutSceneTitle,
        TEACHER_VIDEO_COPY.logoutSceneDescription,
        TEACHER_VIDEO_COPY.logoutSceneBullets,
        TEACHER_VIDEO_COPY.logoutSceneNarration,
      );

      await ui.goto('/app/teacher-substitute-request');
      await setVideoLabel(page, TEACHER_VIDEO_COPY.logoutLabel);
      const logoutPlayback = beginNarration(
        cues,
        recordingStartedAt,
        'logout',
        TEACHER_VIDEO_COPY.logoutNarration,
        narrationDurationMap,
      );
      const logoutButton = page.locator('aside .logout');
      await setVideoCallout(page, logoutButton, TEACHER_VIDEO_COPY.logoutCallout);
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
        TEACHER_VIDEO_COPY.outroNarration,
        narrationDurationMap,
      );
      await showTitleCard(
        page,
        TEACHER_VIDEO_COPY.outroTitle,
        TEACHER_VIDEO_COPY.outroDescription,
        [...TEACHER_VIDEO_COPY.outroBullets],
      );
      await waitForNarrationWindow(page, outroPlayback, 4_600);

      await writeNarrationArtifacts(artifactDir, cues);
    } finally {
      savedVideoPath = await saveRecordedVideo(page, context);
    }

    expect(savedVideoPath).toBeTruthy();
  });
});
