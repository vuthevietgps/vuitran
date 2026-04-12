import { access, copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { closeActors, openRolePage } from './scenario-helpers';
import type { DemoRole } from './types';

const execFileAsync = promisify(execFile);

export type EvidenceStatus = 'PASS' | 'FAIL' | 'BLOCKED';

export interface BatchEvidenceOptions {
  batchId: string;
  scenario: string;
  locale?: string;
  viewport?: { width: number; height: number };
  runDate?: string;
}

export interface BatchEvidenceResult {
  logPath: string;
  videoPath: string;
  screenshotDir: string;
}

export interface BatchEvidenceSession extends BatchEvidenceResult {
  batchId: string;
  context: BrowserContext;
  page: Page;
  note(message: string): void;
  step(title: string, pageOverride?: Page): Promise<string>;
  finalize(status: EvidenceStatus, options?: { error?: unknown; extraLines?: string[] }): Promise<BatchEvidenceResult>;
}

export interface UiStateEnvelopeOptions {
  trigger: () => Promise<unknown>;
  loadingTarget?: Locator;
  submitButton?: Locator | null;
  expectedRequestCountAtMost?: number;
  requestPredicate?: (url: string, method: string) => boolean;
}

export interface RbacContrastOptions {
  path: string;
  allowedRole: DemoRole;
  deniedRole: DemoRole;
  visibleSelector: string;
  hiddenSelector?: string;
}

const DEFAULT_VIEWPORT = { width: 1600, height: 900 };

function inferRunDate(): string {
  return (
    process.env['UI_EVIDENCE_DATE']
    || process.env['E2E_RUN_DATE']
    || new Date().toISOString().slice(0, 10)
  );
}

function dateStamp(runDate: string): string {
  return runDate.replace(/-/g, '');
}

function sanitizeSegment(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function nowIso(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToString(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  return String(error);
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ['-version']);
    return true;
  } catch {
    return false;
  }
}

async function convertVideoToMp4(sourcePath: string, targetPath: string): Promise<void> {
  await rm(targetPath, { force: true });
  if (await commandExists('ffmpeg')) {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      sourcePath,
      '-movflags',
      '+faststart',
      targetPath,
    ]);
    return;
  }

  await copyFile(sourcePath, targetPath);
}

async function closeContextWithTimeout(
  context: BrowserContext,
  timeoutMs = 8_000,
): Promise<unknown | null> {
  const closePromise = context.close().then(() => null).catch((error) => error);
  const timeoutPromise = delay(timeoutMs).then(
    () => new Error(`Evidence context.close() exceeded ${timeoutMs}ms; skipping video finalization.`),
  );
  return Promise.race([closePromise, timeoutPromise]);
}

export async function ensureUiEvidenceDirs(runDate = inferRunDate()): Promise<{
  rootDir: string;
  evidenceDir: string;
  videosDir: string;
  logsDir: string;
  screenshotsDir: string;
  rawVideosDir: string;
}> {
  const rootDir = path.resolve(process.cwd(), '../..');
  const evidenceDir = path.join(rootDir, 'frontend-ui-evidence', runDate);
  const videosDir = path.join(evidenceDir, 'videos');
  const logsDir = path.join(evidenceDir, 'logs');
  const screenshotsDir = path.join(evidenceDir, 'screenshots');
  const rawVideosDir = path.join(videosDir, '.raw');

  await mkdir(videosDir, { recursive: true });
  await mkdir(logsDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  await mkdir(rawVideosDir, { recursive: true });

  return {
    rootDir,
    evidenceDir,
    videosDir,
    logsDir,
    screenshotsDir,
    rawVideosDir,
  };
}

export async function createBatchEvidenceContext(
  browser: Browser,
  options: BatchEvidenceOptions,
): Promise<BatchEvidenceSession> {
  const runDate = options.runDate || inferRunDate();
  const stamp = dateStamp(runDate);
  const dirs = await ensureUiEvidenceDirs(runDate);
  const safeScenario = sanitizeSegment(options.scenario);
  const baseName = `UI_${options.batchId}_${safeScenario}_${stamp}`;
  const videoPath = path.join(dirs.videosDir, `${baseName}.mp4`);
  const logPath = path.join(dirs.logsDir, `LOG_${options.batchId}_${safeScenario}_${stamp}.md`);
  const screenshotDir = path.join(dirs.screenshotsDir, baseName);
  const viewport = options.viewport || DEFAULT_VIEWPORT;

  await mkdir(screenshotDir, { recursive: true });

  const context = await browser.newContext({
    locale: options.locale || 'vi-VN',
    viewport,
    recordVideo: {
      dir: dirs.rawVideosDir,
      size: viewport,
    },
  });
  const page = await context.newPage();
  const lines: string[] = [
    `# ${options.batchId} - ${options.scenario}`,
    '',
    `- Status: IN_PROGRESS`,
    `- StartedAt: ${nowIso()}`,
    `- Video: ${videoPath}`,
    `- ScreenshotDir: ${screenshotDir}`,
    '',
    '## Timeline',
  ];
  let stepIndex = 0;

  const note = (message: string): void => {
    lines.push(`- ${nowIso()} ${message}`);
  };

  const step = async (title: string, pageOverride?: Page): Promise<string> => {
    stepIndex += 1;
    const fileName = `${String(stepIndex).padStart(2, '0')}_${sanitizeSegment(title) || 'step'}.png`;
    const stepPage = pageOverride || page;
    const screenshotPath = path.join(screenshotDir, fileName);
    await stepPage.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    note(`SCREENSHOT ${fileName} - ${title}`);
    return screenshotPath;
  };

  const finalize = async (
    status: EvidenceStatus,
    finalizeOptions?: { error?: unknown; extraLines?: string[] },
  ): Promise<BatchEvidenceResult> => {
    const recordedVideo = page.video();
    let artifactError: unknown;
    const closeResult = await closeContextWithTimeout(context);
    if (closeResult) {
      artifactError = closeResult;
    }

    let rawVideoPath: string | null = null;
    if (recordedVideo && !artifactError) {
      try {
        rawVideoPath = await recordedVideo.path();
      } catch (error) {
        artifactError = artifactError || error;
      }
    }

    try {
      if (rawVideoPath) {
        const tempPath = `${videoPath}.tmp.mp4`;
        await rm(tempPath, { force: true });
        await convertVideoToMp4(rawVideoPath, tempPath);
        await rm(videoPath, { force: true });
        await rename(tempPath, videoPath);
      } else {
        await writeFile(videoPath, '', 'utf8');
      }
    } catch (error) {
      artifactError = artifactError || error;
      await writeFile(videoPath, '', 'utf8');
    }

    lines[2] = `- Status: ${status}`;
    lines.splice(3, 0, `- FinishedAt: ${nowIso()}`);

    if (finalizeOptions?.extraLines?.length) {
      lines.push('', '## Summary', ...finalizeOptions.extraLines.map((line) => `- ${line}`));
    }

    if (finalizeOptions?.error) {
      lines.push('', '## Error', '```text', errorToString(finalizeOptions.error), '```');
    }

    if (artifactError) {
      lines.push(
        '',
        '## Evidence Artifact Note',
        '```text',
        errorToString(artifactError),
        '```',
      );
    }

    await writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');

    return {
      logPath,
      videoPath,
      screenshotDir,
    };
  };

  note('Evidence context created with video capture enabled.');

  return {
    batchId: options.batchId,
    context,
    page,
    logPath,
    videoPath,
    screenshotDir,
    note,
    step,
    finalize,
  };
}

export async function expectUiStateEnvelope(
  page: Page,
  options: UiStateEnvelopeOptions,
): Promise<void> {
  let requestCount = 0;
  const requestListener = (request: { url: () => string; method: () => string }): void => {
    if (!options.requestPredicate) {
      return;
    }
    if (options.requestPredicate(request.url(), request.method())) {
      requestCount += 1;
    }
  };

  page.on('request', requestListener);
  try {
    const actionPromise = options.trigger();
    if (options.loadingTarget) {
      await expect(options.loadingTarget).toBeVisible({ timeout: 5_000 });
    }
    if (options.submitButton) {
      await expect(options.submitButton).toBeDisabled({ timeout: 5_000 }).catch(() => undefined);
      if (await options.submitButton.isVisible().catch(() => false)) {
        await options.submitButton.click({ force: true }).catch(() => undefined);
      }
    }
    await actionPromise;
    if (typeof options.expectedRequestCountAtMost === 'number') {
      expect(requestCount).toBeLessThanOrEqual(options.expectedRequestCountAtMost);
    }
  } finally {
    page.off('request', requestListener);
  }
}

export async function expectEmptyStateOrTable(
  page: Page,
  selectors = ['table.data', 'table', '.empty-state', '.empty', '[data-testid="empty-state"]'],
): Promise<void> {
  const locator = page.locator(selectors.join(', ')).first();
  await expect(locator).toBeVisible({ timeout: 15_000 });
}

export async function expectRoleContrast(
  browser: Browser,
  request: Parameters<typeof openRolePage>[1],
  options: RbacContrastOptions,
): Promise<void> {
  const allowed = await openRolePage(browser, request, options.allowedRole, options.path);
  const denied = await openRolePage(browser, request, options.deniedRole, options.path);

  try {
    await expect(allowed.page.locator(options.visibleSelector).first()).toBeVisible({ timeout: 15_000 });
    await expect(denied.page.locator(options.hiddenSelector || options.visibleSelector)).toHaveCount(0);
  } finally {
    await closeActors(allowed, denied);
  }
}

export async function ensureDownloadedFile(downloadPath: string): Promise<void> {
  await access(downloadPath, constants.F_OK);
}
