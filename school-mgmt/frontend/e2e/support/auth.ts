import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { DemoRole, DemoSession, SessionCookiePair } from './types';

const DEFAULT_APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const DEFAULT_API_BASE_URL =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

const DEFAULT_PASSWORD =
  process.env['E2E_DEMO_PASSWORD'] ||
  process.env['DEMO_PASSWORD'] ||
  'Demo123456!';

const ROLE_EMAILS: Record<DemoRole, string> = {
  director: process.env['E2E_DIRECTOR_EMAIL'] || 'director.demo@school.local',
  accounting: process.env['E2E_ACCOUNTING_EMAIL'] || 'accounting.demo@school.local',
  adsmanager: process.env['E2E_ADSMANAGER_EMAIL'] || 'ads.demo@school.local',
  ops: process.env['E2E_OPS_EMAIL'] || 'ops.demo@school.local',
  teacher: process.env['E2E_TEACHER_EMAIL'] || 'teacher.demo@school.local',
  sale: process.env['E2E_SALE_EMAIL'] || 'sale.huong@school.local',
  parent: process.env['E2E_PARENT_EMAIL'] || 'parent.demo@school.local',
  shareholder: process.env['E2E_SHAREHOLDER_EMAIL'] || 'shareholder.demo@school.local',
};

const SESSION_CACHE = new Map<string, DemoSession>();
const SESSION_PROMISES = new Map<string, Promise<DemoSession>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMillis(value?: string): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const dateMillis = Date.parse(value);
  if (Number.isNaN(dateMillis)) return null;
  const delay = dateMillis - Date.now();
  return delay > 0 ? delay : 0;
}

function isTransientLoginError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('ECONNRESET')
    || message.includes('ECONNREFUSED')
    || message.includes('ETIMEDOUT')
    || message.includes('socket hang up')
  );
}

function getSetCookieValues(response: { headers?: () => Record<string, string>; headersArray?: () => Array<{ name: string; value: string }> }): string[] {
  if (typeof response.headersArray === 'function') {
    return response
      .headersArray()
      .filter((header) => header.name.toLowerCase() === 'set-cookie')
      .map((header) => header.value);
  }

  const headers = typeof response.headers === 'function' ? response.headers() : {};
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === 'set-cookie')?.[1];
  if (!value) return [];
  return [value];
}

function parseCookiePair(setCookieValue: string): SessionCookiePair | null {
  const firstPart = String(setCookieValue || '').split(';')[0];
  const eqIndex = firstPart.indexOf('=');
  if (eqIndex <= 0) return null;
  return {
    name: firstPart.slice(0, eqIndex).trim(),
    value: firstPart.slice(eqIndex + 1).trim(),
  };
}

function buildCookieHeader(cookies: SessionCookiePair[]): string {
  return cookies
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function extractXsrf(cookieHeader: string): string | null {
  const match = String(cookieHeader || '').match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match?.[1] || null;
}

function cookieUrls(): string[] {
  const appOrigin = new URL(
    DEFAULT_APP_BASE_URL,
  ).origin;
  const apiOrigin = new URL(DEFAULT_API_BASE_URL).origin;
  return Array.from(new Set([appOrigin, apiOrigin]));
}

export function roleEmail(role: DemoRole): string {
  return ROLE_EMAILS[role];
}

export function rolePassword(): string {
  return DEFAULT_PASSWORD;
}

async function postLoginWithRetry(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Awaited<ReturnType<APIRequestContext['post']>>> {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let loginResponse: Awaited<ReturnType<APIRequestContext['post']>>;
    try {
      loginResponse = await request.post(`${DEFAULT_API_BASE_URL}/auth/login`, {
        data: {
          email,
          password,
        },
      });
    } catch (error) {
      if (!isTransientLoginError(error) || attempt === maxAttempts) {
        throw error;
      }
      const backoffMillis = Math.min(1000 * (2 ** (attempt - 1)), 8000);
      await sleep(backoffMillis + Math.floor(Math.random() * 250));
      continue;
    }

    if (loginResponse.status() !== 429) {
      return loginResponse;
    }

    if (attempt === maxAttempts) {
      return loginResponse;
    }

    const retryAfterHeader = loginResponse.headers()['retry-after'];
    const retryAfterMillis = parseRetryAfterMillis(retryAfterHeader);
    const backoffMillis = retryAfterMillis ?? Math.min(1000 * (2 ** (attempt - 1)), 8000);
    await sleep(backoffMillis + Math.floor(Math.random() * 250));
  }

  return request.post(`${DEFAULT_API_BASE_URL}/auth/login`, {
    data: {
      email,
      password,
    },
  });
}

async function getWithRetry(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string>,
): Promise<Awaited<ReturnType<APIRequestContext['get']>>> {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await request.get(`${DEFAULT_API_BASE_URL}${path}`, { headers });

    if (response.status() !== 429) {
      return response;
    }

    if (attempt === maxAttempts) {
      return response;
    }

    const retryAfterHeader = response.headers()['retry-after'];
    const retryAfterMillis = parseRetryAfterMillis(retryAfterHeader);
    const backoffMillis = retryAfterMillis ?? Math.min(1000 * (2 ** (attempt - 1)), 8000);
    await sleep(backoffMillis + Math.floor(Math.random() * 250));
  }

  return request.get(`${DEFAULT_API_BASE_URL}${path}`, { headers });
}

export async function loginAsCredentials(
  request: APIRequestContext,
  role: DemoRole,
  email: string,
  password: string,
): Promise<DemoSession> {
  const cacheKey = `${role}:${email}:${password}`;
  const cachedSession = SESSION_CACHE.get(cacheKey);
  if (cachedSession) {
    return cachedSession;
  }

  const inFlightSession = SESSION_PROMISES.get(cacheKey);
  if (inFlightSession) {
    return inFlightSession;
  }

  const sessionPromise = (async () => {
    const loginResponse = await postLoginWithRetry(request, email, password);
    expect([200, 201]).toContain(loginResponse.status());

    const loginCookies = getSetCookieValues(loginResponse)
      .map(parseCookiePair)
      .filter((item): item is SessionCookiePair => !!item);
    const accessToken = loginCookies.find((cookie) => cookie.name === 'access_token')?.value;
    expect(accessToken, `Missing access_token cookie for ${role}`).toBeTruthy();

    let xsrfToken = loginCookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value || null;
    if (!xsrfToken) {
      const meResponse = await getWithRetry(request, '/users/me', {
        Cookie: `access_token=${accessToken}`,
      });
      expect([200, 201]).toContain(meResponse.status());
      const meCookies = getSetCookieValues(meResponse)
        .map(parseCookiePair)
        .filter((item): item is SessionCookiePair => !!item);
      xsrfToken = meCookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value || null;
    }

    expect(xsrfToken, `Missing XSRF-TOKEN cookie for ${role}`).toBeTruthy();

    const cookieHeader = buildCookieHeader([
      { name: 'access_token', value: accessToken as string },
      { name: 'XSRF-TOKEN', value: xsrfToken as string },
    ]);

    const meResponse = await getWithRetry(request, '/users/me', {
      Cookie: cookieHeader,
      'X-XSRF-TOKEN': xsrfToken as string,
    });
    expect([200, 201]).toContain(meResponse.status());
    const user = await meResponse.json().catch(() => null);

    const session = {
      role,
      user: user?.user ?? user ?? null,
      accessToken: accessToken as string,
      xsrfToken: xsrfToken as string,
      cookieHeader,
    };
    SESSION_CACHE.set(cacheKey, session);
    return session;
  })();

  SESSION_PROMISES.set(cacheKey, sessionPromise);

  try {
    return await sessionPromise;
  } finally {
    SESSION_PROMISES.delete(cacheKey);
  }
}

export async function loginAsRole(request: APIRequestContext, role: DemoRole): Promise<DemoSession> {
  return loginAsCredentials(request, role, roleEmail(role), rolePassword());
}

function resolveContext(target: BrowserContext | Page): BrowserContext {
  const maybeContext = target as BrowserContext & { context?: () => BrowserContext };
  if (typeof maybeContext.addCookies === 'function') {
    return maybeContext;
  }
  if (typeof maybeContext.context === 'function') {
    return maybeContext.context();
  }
  throw new Error('applySessionCookies expected a BrowserContext or Page.');
}

function isClosedContextError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Target page, context or browser has been closed')
    || message.includes('Browser has been closed')
  );
}

export async function applySessionCookies(target: BrowserContext | Page, session: DemoSession): Promise<void> {
  const context = resolveContext(target);
  const urls = cookieUrls();
  try {
    await context.addCookies(
      urls.flatMap((url) => ([
        {
          name: 'access_token',
          value: session.accessToken,
          url,
        },
        {
          name: 'XSRF-TOKEN',
          value: session.xsrfToken,
          url,
        },
      ])),
    );
  } catch (error) {
    if (isClosedContextError(error)) {
      throw new Error(`applySessionCookies called after context closed for role ${session.role}`);
    }
    throw error;
  }
}

export function extractXsrfToken(cookieHeader: string): string | null {
  return extractXsrf(cookieHeader);
}
