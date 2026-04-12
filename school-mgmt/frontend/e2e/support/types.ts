import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

export type DemoRole =
  | 'director'
  | 'accounting'
  | 'adsmanager'
  | 'ops'
  | 'teacher'
  | 'sale'
  | 'parent'
  | 'shareholder';

export interface DemoSession {
  role: DemoRole;
  user: any;
  accessToken: string;
  xsrfToken: string;
  cookieHeader: string;
}

export interface ApiRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

export interface SupportedContext {
  addCookies: BrowserContext['addCookies'];
}

export interface SupportedPage {
  context: Page['context'];
}

export interface SessionCookiePair {
  name: string;
  value: string;
}

export interface ResponsePayload<T = any> {
  status: number;
  text: string;
  data: T | null;
}

export type RequestLike = Pick<APIRequestContext, 'fetch' | 'get' | 'post' | 'patch' | 'put' | 'delete'>;
