import { expect, type APIRequestContext } from '@playwright/test';
import { DemoSession, ResponsePayload } from './types';
import { extractXsrfToken } from './auth';

const DEFAULT_APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const DEFAULT_API_BASE_URL =
  process.env['PLAYWRIGHT_API_BASE_URL'] ||
  process.env['E2E_API_BASE_URL'] ||
  'http://127.0.0.1:3000';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type LegacyApiOptions = {
  method?: HttpMethod;
  session?: DemoSession;
  body?: unknown;
  expectedStatus?: number | number[];
};

type LegacyApiResponse<T = any> = ResponsePayload<T> & {
  body: T;
};

function buildHeaders(session: DemoSession | null | undefined, method: HttpMethod): Record<string, string> {
  if (!session) {
    return {};
  }

  const headers: Record<string, string> = {
    Cookie: session.cookieHeader,
  };
  const xsrfToken = extractXsrfToken(session.cookieHeader) || session.xsrfToken;
  if (xsrfToken && method !== 'GET') {
    headers['X-XSRF-TOKEN'] = xsrfToken;
  }
  return headers;
}

function assertExpectedStatus(
  status: number,
  expectedStatus?: number | number[] | null,
): void {
  if (typeof expectedStatus === 'undefined' || expectedStatus === null) {
    return;
  }

  const accepted = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus];
  expect(accepted).toContain(status);
}

async function rawApiRequest<T = any>(
  request: APIRequestContext,
  session: DemoSession | null | undefined,
  method: HttpMethod,
  path: string,
  body?: unknown,
  expectedStatus?: number | number[] | null,
): Promise<ResponsePayload<T>> {
  const response = await request.fetch(`${DEFAULT_API_BASE_URL}${path}`, {
    method,
    headers: buildHeaders(session, method),
    data: body,
  });

  const text = await response.text();
  const contentType = response.headers()['content-type'] || '';
  const data = contentType.includes('application/json')
    ? (text ? (JSON.parse(text) as T) : null)
    : null;

  assertExpectedStatus(response.status(), expectedStatus);

  return {
    status: response.status(),
    text,
    data,
  };
}

function isLegacyOptions(value: unknown): value is LegacyApiOptions {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    'session' in candidate
    || 'method' in candidate
    || 'body' in candidate
    || 'expectedStatus' in candidate
  );
}

export async function apiCall<T = any>(request: APIRequestContext, ...args: any[]): Promise<any> {
  const [sessionOrPath, methodOrOptions, path, body, expectedStatus] = args;

  if (typeof sessionOrPath === 'string') {
    if (typeof methodOrOptions === 'string') {
      const legacyPublicBody = Array.isArray(path) || typeof path === 'number'
        ? undefined
        : path;
      const legacyPublicExpectedStatus = Array.isArray(path) || typeof path === 'number'
        ? (path as number | number[])
        : body;

      const response = await rawApiRequest(
        request,
        null,
        methodOrOptions as HttpMethod,
        sessionOrPath,
        legacyPublicBody,
        legacyPublicExpectedStatus as number | number[] | undefined,
      );

      return {
        ...response,
        body: response.data,
      };
    }

    const options = isLegacyOptions(methodOrOptions) ? methodOrOptions : null;
    if (!options) {
      throw new Error('Legacy apiCall signature requires an options object.');
    }

    const response = await rawApiRequest(
      request,
      options.session,
      (options.method || 'GET') as HttpMethod,
      sessionOrPath,
      options.body,
      options.expectedStatus,
    );

    return {
      ...response,
      body: response.data,
    };
  }

  return rawApiRequest(
    request,
    sessionOrPath,
    methodOrOptions as HttpMethod,
    path,
    body,
    typeof expectedStatus === 'undefined' ? [200, 201] : expectedStatus,
  );
}

export async function apiJson<T = any>(request: APIRequestContext, ...args: any[]): Promise<any> {
  const [sessionOrPath, methodOrOptions, path, body, expectedStatus] = args;

  if (typeof sessionOrPath === 'string') {
    return apiCall(request, sessionOrPath, methodOrOptions);
  }

  const response = await rawApiRequest(
    request,
    sessionOrPath,
    methodOrOptions,
    path,
    body,
    typeof expectedStatus === 'undefined' ? [200, 201] : expectedStatus,
  );
  return response.data;
}
