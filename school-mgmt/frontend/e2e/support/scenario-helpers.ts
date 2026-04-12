import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { apiCall, apiJson } from './api';
import {
  applySessionCookies,
  loginAsCredentials,
  loginAsRole,
  roleEmail,
  rolePassword,
} from './auth';
import { ONE_BY_ONE_PNG_BASE64, pngFilePayload } from './files';
import type { DemoRole, DemoSession } from './types';

const DEFAULT_APP_BASE_URL =
  process.env['PLAYWRIGHT_BASE_URL'] ||
  process.env['E2E_BASE_URL'] ||
  'http://localhost:4200';

const RECEIPT_DATA_URL = `data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`;
const ATTENDANCE_SELFIE_DATA_URL = `data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`;
const DEFAULT_PARENT_PASSWORD = rolePassword();

export interface UiActor {
  role: DemoRole;
  session: DemoSession;
  context: BrowserContext;
  page: Page;
}

export interface ParentAccount {
  _id: string;
  email: string;
  fullName: string;
  phone: string;
  password: string;
}

export interface SaleAccount {
  _id: string;
  email: string;
  fullName: string;
  phone?: string;
  password: string;
}

export interface TeacherAccount {
  _id: string;
  email: string;
  fullName: string;
  phone?: string;
  password: string;
}

export interface EnrollmentFixture {
  parent: ParentAccount;
  student: any;
  classroom: any;
  teacher: any;
  sale: any;
  product: any;
}

export interface LearningFixture extends EnrollmentFixture {
  session: any;
  scheduledDate: string;
  startTime: string;
  endTime: string;
}

export interface CreateEnrollmentOptions {
  label: string;
  classMode?: 'ONLINE' | 'OFFLINE';
  initialWalletAmount?: number;
  initializeWallet?: boolean;
  pricePerSession?: number;
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
  baseDuration?: number;
  sessionDuration?: number;
  subject?: string;
}

export interface CreateLearningFixtureOptions extends CreateEnrollmentOptions {
  scheduledDate?: string;
  timeSlotIndex?: number;
  durationMinutes?: number;
  amountCharged?: number;
  teacherPayout?: number;
}

export interface CreateSubmittedOrderOptions {
  label: string;
  totalAmount: number;
  finalAmount: number;
  discountAmount?: number;
  discountReason?: string;
  sessions?: number;
  invoiceSessions?: number;
  sessionDuration?: number;
  baseDuration?: number;
  pricePerSession?: number;
  teachingMode?: 'ONLINE' | 'OFFLINE';
  teacherPayPerSession?: number;
  teacherPayPerStudent?: number;
  trialSessions?: number;
  receiptImage?: string;
  paymentPlan?: 'FULL' | 'INSTALLMENT_2' | 'INSTALLMENT_3';
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeId(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || '';
}

function uniqueDigits(label: string, length: number): string {
  // Keep the volatile timestamp/random suffix at the end so slice(-length)
  // cannot collapse to a deterministic label-derived value when the label
  // itself already ends with digits.
  const raw = `${label}${Date.now()}${Math.floor(Math.random() * 1000)}`.replace(/\D/g, '');
  return raw.slice(-length).padStart(length, '0');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uniquePhone(label: string): string {
  return `09${uniqueDigits(label, 8)}`;
}

export function dateOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function shiftLocalDate(dateText: string, days: number): string {
  const [year, month, day] = dateText.split('-').map((value) => Number(value));
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

export function timeSlot(slotIndex: number, durationMinutes = 60): { startTime: string; endTime: string } {
  const slots = [
    { hour: 6, minute: 0 },
    { hour: 7, minute: 30 },
    { hour: 9, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 12, minute: 0 },
    { hour: 13, minute: 30 },
    { hour: 15, minute: 0 },
    { hour: 16, minute: 30 },
    { hour: 18, minute: 0 },
    { hour: 19, minute: 30 },
  ];
  const start = slots[((slotIndex % slots.length) + slots.length) % slots.length];
  const endMinutes = (start.hour * 60) + start.minute + durationMinutes;
  return {
    startTime: `${pad(start.hour)}:${pad(start.minute)}`,
    endTime: `${pad(Math.floor(endMinutes / 60) % 24)}:${pad(endMinutes % 60)}`,
  };
}

export async function openSessionPage(browser: Browser, session: DemoSession, path: string): Promise<UiActor> {
  const context = await browser.newContext({
    baseURL: DEFAULT_APP_BASE_URL,
  });
  await applySessionCookies(context, session);
  const page = await context.newPage();
  await page.goto(new URL(path, DEFAULT_APP_BASE_URL).toString());
  await page.waitForLoadState('domcontentloaded');
  return {
    role: session.role,
    session,
    context,
    page,
  };
}

async function loginViaUi(page: Page, email: string, password: string, path: string): Promise<void> {
  await page.goto(new URL('/login', DEFAULT_APP_BASE_URL).toString());
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/app\//);
  if (new URL(page.url()).pathname === path) {
    return;
  }

  const appLink = page.locator(`a[href="${path}"]`).first();
  if (await appLink.count()) {
    await appLink.click();
    await page.waitForURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    return;
  }

  await page.goto(new URL(path, DEFAULT_APP_BASE_URL).toString());
  await page.waitForLoadState('domcontentloaded');
}

export async function openRolePage(
  browser: Browser,
  request: APIRequestContext,
  role: DemoRole,
  path: string,
): Promise<UiActor> {
  const session = await loginAsRole(request, role);
  const context = await browser.newContext({
    baseURL: DEFAULT_APP_BASE_URL,
  });
  const page = await context.newPage();
  await applySessionCookies(context, session);
  await page.goto(new URL(path, DEFAULT_APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname === '/login') {
    await loginViaUi(page, roleEmail(role), rolePassword(), path);
  }
  return {
    role,
    session,
    context,
    page,
  };
}

export async function openCustomPage(
  browser: Browser,
  request: APIRequestContext,
  role: DemoRole,
  email: string,
  password: string,
  path: string,
): Promise<UiActor> {
  const session = await loginAsCredentials(request, role, email, password);
  const context = await browser.newContext({
    baseURL: DEFAULT_APP_BASE_URL,
  });
  const page = await context.newPage();
  await applySessionCookies(context, session);
  await page.goto(new URL(path, DEFAULT_APP_BASE_URL).toString());
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname === '/login') {
    await loginViaUi(page, email, password, path);
  }
  return {
    role,
    session,
    context,
    page,
  };
}

export async function acceptDialog(
  page: Page,
  action: () => Promise<unknown>,
  promptText?: string,
): Promise<string> {
  const dialogPromise = page.waitForEvent('dialog');
  const actionPromise = action();
  const dialog = await dialogPromise;
  const message = dialog.message();
  await dialog.accept(promptText);
  await actionPromise;
  return message;
}

export function extractAttendanceLink(dialogMessage: string): { attendanceUrl: string; token: string } {
  const attendanceUrl = dialogMessage.match(/https?:\/\/\S+/)?.[0] || '';
  expect(attendanceUrl, 'Attendance link dialog should contain a URL').toBeTruthy();

  const url = new URL(attendanceUrl);
  const token = url.pathname.split('/').filter(Boolean).pop() || '';
  expect(token, 'Attendance link should contain a token').toBeTruthy();

  return { attendanceUrl, token };
}

export async function generateAttendanceLinkFromUi(
  page: Page,
  studentId: string,
): Promise<{ attendanceUrl: string; token: string; dialogMessage: string }> {
  const dialogMessage = await acceptDialog(
    page,
    () => page.getByTestId(`attendance-generate-link-${studentId}`).click(),
  );
  const { attendanceUrl, token } = extractAttendanceLink(dialogMessage);
  return { attendanceUrl, token, dialogMessage };
}

export async function submitAttendanceByToken(
  request: APIRequestContext,
  token: string,
  imageBase64 = ATTENDANCE_SELFIE_DATA_URL,
): Promise<any> {
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await apiCall<any>(
      request,
      '/public/attendance/submit',
      'POST',
      { token, imageBase64 },
      [200, 201, 429],
    );

    if (response.status !== 429) {
      return response.body;
    }

    if (attempt === maxAttempts) {
      throw new Error('submitAttendanceByToken exhausted retries after repeated 429 responses.');
    }

    await sleep(Math.min(1000 * attempt, 5000));
  }

  throw new Error('submitAttendanceByToken exited unexpectedly without a response.');
}

export async function generateAttendanceLinkAndSubmit(
  request: APIRequestContext,
  teacherSession: DemoSession,
  payload: { classId: string; studentId: string; date: string; imageBase64?: string },
): Promise<{ attendanceUrl: string; token: string; attendance: any; submitted: any }> {
  const attendance = await apiJson<any>(
    request,
    teacherSession,
    'POST',
    '/attendance/generate-link',
    {
      classId: payload.classId,
      studentId: payload.studentId,
      date: payload.date,
    },
  );

  const token = attendance?.token || '';
  expect(token, 'Generate-link response should include a token').toBeTruthy();

  const submitted = await submitAttendanceByToken(
    request,
    token,
    payload.imageBase64 || ATTENDANCE_SELFIE_DATA_URL,
  );

  return {
    attendanceUrl: attendance.attendanceUrl,
    token,
    attendance,
    submitted,
  };
}

export function invoiceRow(page: Page, invoiceNumber: string) {
  return page
    .locator(`[data-testid="invoice-row"][data-invoice-number="${invoiceNumber}"], table.data tbody tr`)
    .filter({ hasText: invoiceNumber })
    .first();
}

export function orderRow(page: Page, orderCode: string) {
  return page
    .locator(`[data-testid="order-row"][data-order-code="${orderCode}"], table.data tbody tr`)
    .filter({ hasText: orderCode })
    .first();
}

export async function getProducts(request: APIRequestContext, session: DemoSession): Promise<any[]> {
  return apiJson<any[]>(request, session, 'GET', '/products');
}

export async function getTeachers(request: APIRequestContext, session: DemoSession): Promise<any[]> {
  return apiJson<any[]>(request, session, 'GET', '/users/teachers');
}

export async function getSales(request: APIRequestContext, session: DemoSession): Promise<any[]> {
  return apiJson<any[]>(request, session, 'GET', '/users/sales');
}

export async function getOrderById(request: APIRequestContext, session: DemoSession, orderId: string): Promise<any> {
  return apiJson<any>(request, session, 'GET', `/orders/${orderId}`);
}

export async function getSessionById(
  request: APIRequestContext,
  session: DemoSession,
  sessionId: string,
): Promise<any> {
  return apiJson<any>(request, session, 'GET', `/sessions/${sessionId}`);
}

export async function getInvoiceById(
  request: APIRequestContext,
  session: DemoSession,
  invoiceId: string,
): Promise<any> {
  return apiJson<any>(request, session, 'GET', `/invoices/${invoiceId}`);
}

export async function listInvoices(request: APIRequestContext, session: DemoSession): Promise<any[]> {
  return apiJson<any[]>(request, session, 'GET', '/invoices');
}

export async function findInvoicesByOrderId(
  request: APIRequestContext,
  session: DemoSession,
  orderId: string,
): Promise<any[]> {
  const invoices = await listInvoices(request, session);
  return invoices.filter((invoice) => normalizeId(invoice.orderId) === orderId);
}

export async function getWalletByUserId(
  request: APIRequestContext,
  session: DemoSession,
  userId: string,
): Promise<any | null> {
  const response = await apiCall<any>(
    request,
    session,
    'GET',
    `/wallets/user/${userId}`,
    undefined,
    [200, 404],
  );
  if (response.status === 404) {
    return null;
  }
  return response.data;
}

export async function getWalletBalanceByUserId(
  request: APIRequestContext,
  session: DemoSession,
  userId: string,
): Promise<number> {
  const wallet = await getWalletByUserId(request, session, userId);
  return Number(wallet?.balance || 0);
}

export async function initializeWalletForParent(request: APIRequestContext, parent: ParentAccount): Promise<any> {
  const parentSession = await loginAsCredentials(request, 'parent', parent.email, parent.password);
  return apiJson<any>(request, parentSession, 'GET', '/wallets/me');
}

export async function createParentAccount(
  request: APIRequestContext,
  directorSession: DemoSession,
  label: string,
): Promise<ParentAccount> {
  const phone = uniquePhone(label);
  const digits = uniqueDigits(label, 10);
  const user = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/users',
    {
      userCode: `PH${digits}`,
      email: `e2e-parent-${digits}@school.local`,
      password: DEFAULT_PARENT_PASSWORD,
      fullName: `E2E Parent ${label}`,
      role: 'PARENT',
      phone,
    },
  );
  return {
    _id: user._id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    password: DEFAULT_PARENT_PASSWORD,
  };
}

export async function ensureSaleAccount(
  request: APIRequestContext,
  directorSession: DemoSession,
  label: string,
): Promise<SaleAccount> {
  const sales = await getSales(request, directorSession);
  const existingSale = sales[0];
  if (existingSale) {
    return {
      _id: existingSale._id,
      email: existingSale.email,
      fullName: existingSale.fullName,
      phone: existingSale.phone,
      password: rolePassword(),
    };
  }

  const digits = uniqueDigits(label, 10);
  const email = `e2e-sale-${digits}@school.local`;
  const phone = uniquePhone(`${label}-sale`);
  const sale = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/users',
    {
      userCode: `SALE${digits}`,
      email,
      password: rolePassword(),
      fullName: `E2E Sale ${label}`,
      role: 'SALE',
      phone,
    },
  );

  return {
    _id: sale._id,
    email: sale.email,
    fullName: sale.fullName,
    phone: sale.phone,
    password: rolePassword(),
  };
}

export async function ensureTeacherAccount(
  request: APIRequestContext,
  directorSession: DemoSession,
  label: string,
): Promise<TeacherAccount> {
  const digits = uniqueDigits(label, 10);
  const email = `e2e-teacher-${digits}@school.local`;
  const phone = uniquePhone(`${label}-teacher`);
  const teacher = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/users',
    {
      userCode: `TEACH${digits}`,
      email,
      password: rolePassword(),
      fullName: `E2E Teacher ${label}`,
      role: 'TEACHER',
      phone,
    },
  );

  return {
    _id: teacher._id,
    email: teacher.email,
    fullName: teacher.fullName,
    phone: teacher.phone,
    password: rolePassword(),
  };
}

export async function ensureProductFixture(
  request: APIRequestContext,
  directorSession: DemoSession,
  label: string,
  classMode: 'ONLINE' | 'OFFLINE' = 'ONLINE',
): Promise<any> {
  const products = await getProducts(request, directorSession);
  const existingProduct = products[0];
  if (existingProduct) {
    return existingProduct;
  }

  const digits = uniqueDigits(label, 8);
  return apiJson<any>(
    request,
    directorSession,
    'POST',
    '/products',
    {
      name: `E2E Product ${label}`,
      code: `E2E${digits}`,
      description: `E2E product ${label}`,
      category: 'ENGLISH',
      teachingMode: classMode,
      defaultSessions: 10,
      defaultSessionDuration: 60,
      pricePerSession: classMode === 'OFFLINE' ? 150_000 : 200_000,
      suggestedPrice: classMode === 'OFFLINE' ? 1_500_000 : 2_000_000,
      commissionRate: 0,
      isActive: true,
    },
  );
}

export async function createEnrollmentFixture(
  request: APIRequestContext,
  options: CreateEnrollmentOptions,
): Promise<EnrollmentFixture> {
  const directorSession = await loginAsRole(request, 'director');
  const [product, teacher] = await Promise.all([
    ensureProductFixture(request, directorSession, options.label, options.classMode || 'ONLINE'),
    ensureTeacherAccount(request, directorSession, options.label),
  ]);
  const sale = await ensureSaleAccount(request, directorSession, options.label);
  expect(product, 'Missing product fixture').toBeTruthy();
  expect(teacher, 'Missing teacher fixture').toBeTruthy();
  expect(sale, 'Missing sale fixture').toBeTruthy();

  const parent = await createParentAccount(request, directorSession, options.label);
  if (options.initializeWallet) {
    await initializeWalletForParent(request, parent);
  }

  const student = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/students',
    {
      studentCode: `HS${uniqueDigits(options.label, 10)}`,
      fullName: `E2E Student ${options.label}`,
      age: 10,
      parentName: parent.fullName,
      parentPhone: parent.phone,
      parentUserId: parent._id,
      faceImage: 'default-avatar.png',
      productPackage: product._id,
      level: 'Starter',
      studentType: options.classMode || 'ONLINE',
      saleId: sale._id,
      saleName: sale.fullName,
    },
  );

  const classMode = options.classMode || 'ONLINE';
  const baseDuration = options.baseDuration ?? 60;
  const sessionDuration = options.sessionDuration ?? baseDuration;
  const pricePerSession = options.pricePerSession ?? (classMode === 'OFFLINE' ? 150_000 : 200_000);
  const teacherPayPerSession = options.teacherPayPerSession ?? (classMode === 'ONLINE' ? 120_000 : 0);
  const teacherPayPerStudent = options.teacherPayPerStudent ?? (classMode === 'OFFLINE' ? 60_000 : 0);

  const classroom = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/classes',
    {
      name: `E2E Class ${options.label}`,
      code: `CLS${uniqueDigits(options.label, 10)}`,
      teacherId: teacher._id,
      saleId: sale._id,
      classMode,
      productPackageId: product._id,
      studentIds: [student._id],
      subject: options.subject || 'Tieng Anh',
      learningGoals: 'E2E automated scenario',
      pricePerSession,
      teacherPayPerSession,
      teacherPayPerStudent,
      baseDuration,
      sessionDuration,
      maxStudents: classMode === 'OFFLINE' ? 5 : 1,
    },
  );

  if ((options.initialWalletAmount || 0) > 0) {
    const topUp = await apiJson<any>(
      request,
      directorSession,
      'POST',
      '/wallets/top-up',
      {
        userId: parent._id,
        amount: options.initialWalletAmount,
        paymentMethod: 'BANK_TRANSFER',
        transactionRef: `E2E-${uniqueDigits(options.label, 8)}`,
        receiptImageUrl: '/uploads/wallets/e2e-top-up.png',
        description: `Top up for ${options.label}`,
      },
    );

    await apiJson<any>(
      request,
      directorSession,
      'POST',
      `/wallets/top-up/${topUp._id}/approve`,
      {
        bankMatched: true,
        bankStatementRef: `BANK-${uniqueDigits(options.label, 6)}`,
        accountingNotes: `Approved ${options.label}`,
      },
    );
  }

  return {
    parent,
    student,
    classroom,
    teacher,
    sale,
    product,
  };
}

export async function createLearningFixture(
  request: APIRequestContext,
  options: CreateLearningFixtureOptions,
): Promise<LearningFixture> {
  const directorSession = await loginAsRole(request, 'director');
  const enrollment = await createEnrollmentFixture(request, options);
  const durationMinutes = options.durationMinutes ?? options.sessionDuration ?? options.baseDuration ?? 60;
  const requestedDate = options.scheduledDate || dateOffset(-1);
  const requestedSlotIndex = options.timeSlotIndex ?? 0;
  const amountCharged = options.amountCharged ?? enrollment.classroom.pricePerSession ?? 200_000;
  const teacherPayout =
    options.teacherPayout
    ?? enrollment.classroom.teacherPayPerSession
    ?? enrollment.classroom.teacherPayPerStudent
    ?? 120_000;
  const slotCount = 10;
  // Prefer the requested date, but keep the fixture resilient in a shared/dirty test DB.
  const maxDateAttempts = 14;
  let chosenSchedule = timeSlot(requestedSlotIndex, durationMinutes);
  let chosenDate = requestedDate;
  let session: any = null;
  let lastConflict = '';

  for (let dateAttempt = 0; dateAttempt < maxDateAttempts && !session; dateAttempt += 1) {
    const candidateDate = shiftLocalDate(requestedDate, dateAttempt);

    for (let slotAttempt = 0; slotAttempt < slotCount; slotAttempt += 1) {
      const candidateSchedule = timeSlot(requestedSlotIndex + slotAttempt, durationMinutes);
      const response = await apiCall<any>(
        request,
        directorSession,
        'POST',
        '/sessions',
        {
          classId: enrollment.classroom._id,
          studentId: enrollment.student._id,
          teacherId: enrollment.teacher._id,
          parentUserId: enrollment.parent._id,
          scheduledDate: candidateDate,
          scheduledStartTime: candidateSchedule.startTime,
          scheduledEndTime: candidateSchedule.endTime,
          durationMinutes,
          amountCharged,
          teacherPayout,
        },
        [200, 201, 409],
      );

      if (response.status === 200 || response.status === 201) {
        session = response.data;
        chosenDate = candidateDate;
        chosenSchedule = candidateSchedule;
        break;
      }

      lastConflict = response.text;
    }
  }

  expect(
    session,
    `Unable to seed session fixture without conflict for ${options.label}. Last response: ${lastConflict}`,
  ).toBeTruthy();

  return {
    ...enrollment,
    session,
    scheduledDate: chosenDate,
    startTime: chosenSchedule.startTime,
    endTime: chosenSchedule.endTime,
  };
}

export async function createPendingInvoice(
  request: APIRequestContext,
  fixture: EnrollmentFixture,
  options: {
    invoiceNumber: string;
    amount: number;
    paymentRound: number;
    sessions?: number;
    classType?: 'ONLINE' | 'OFFLINE';
    receiptImage?: string;
  },
): Promise<any> {
  const directorSession = await loginAsRole(request, 'director');
  return apiJson<any>(
    request,
    directorSession,
    'POST',
    '/invoices',
    {
      invoiceNumber: options.invoiceNumber,
      studentId: fixture.student._id,
      classId: fixture.classroom._id,
      classType: options.classType || fixture.classroom.classMode || 'ONLINE',
      saleId: fixture.sale._id,
      sessions: options.sessions ?? 5,
      paymentRound: options.paymentRound,
      amount: options.amount,
      paymentDate: dateOffset(0),
      receiptImage: options.receiptImage || RECEIPT_DATA_URL,
      description: `E2E invoice ${options.invoiceNumber}`,
    },
  );
}

export async function createSubmittedOrder(
  request: APIRequestContext,
  options: CreateSubmittedOrderOptions,
): Promise<any> {
  const directorSession = await loginAsRole(request, 'director');
  const teachingMode = options.teachingMode || (options.finalAmount === 0 ? 'OFFLINE' : 'ONLINE');
  const [product, teacher] = await Promise.all([
    ensureProductFixture(request, directorSession, options.label, teachingMode),
    ensureTeacherAccount(request, directorSession, options.label),
  ]);
  const sale = await ensureSaleAccount(request, directorSession, options.label);
  expect(product, 'Missing product fixture').toBeTruthy();
  expect(teacher, 'Missing teacher fixture').toBeTruthy();
  expect(sale, 'Missing sale fixture').toBeTruthy();

  const labelDigits = uniqueDigits(options.label, 10);
  const paymentPlan = options.paymentPlan || 'FULL';
  const sessions = options.sessions ?? (options.finalAmount === 0 ? 1 : 10);
  const invoiceSessions = options.invoiceSessions ?? (options.finalAmount === 0 ? 0 : sessions);
  const sessionDuration = options.sessionDuration ?? 60;
  const baseDuration = options.baseDuration ?? sessionDuration;

  const order = await apiJson<any>(
    request,
    directorSession,
    'POST',
    '/orders',
    {
      orderType: 'NEW_ENROLLMENT',
      saleId: sale._id,
      parentName: `E2E Order Parent ${options.label}`,
      parentPhone: uniquePhone(options.label),
      studentName: `E2E Order Student ${options.label}`,
      studentAge: 10,
      items: [
        {
          productId: product._id,
          productName: product.name,
          sessions,
          invoiceSessions,
          sessionDuration,
          baseDuration,
          pricePerSession: options.pricePerSession ?? (options.finalAmount === 0 ? 0 : 200_000),
          amount: options.finalAmount,
          bonusSessions: 0,
          trialSessions: options.trialSessions ?? 0,
          teachingMode,
          preferredTeacherId: teacher._id,
          paymentRound: 1,
          teacherPayPerSession: options.teacherPayPerSession ?? (teachingMode === 'ONLINE' ? 120_000 : 0),
          teacherPayPerStudent: options.teacherPayPerStudent ?? (teachingMode === 'OFFLINE' ? 60_000 : 0),
          subject: 'Tieng Anh',
          learningGoals: 'E2E order scenario',
          invoiceNumber: `INV-${labelDigits}`,
          invoiceDescription: `Order ${options.label}`,
        },
      ],
      totalAmount: options.totalAmount,
      discountAmount: options.discountAmount || 0,
      discountReason: options.discountReason || '',
      finalAmount: options.finalAmount,
      paymentPlan,
      paymentDate: dateOffset(0),
      receiptImage: options.receiptImage,
    },
  );

  await apiJson(request, directorSession, 'POST', `/orders/${order._id}/submit`, {});
  return getOrderById(request, directorSession, order._id);
}

export async function closeActors(...actors: Array<UiActor | null | undefined>): Promise<void> {
  for (const actor of actors.filter((item): item is UiActor => !!item)) {
    try {
      await actor.context.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('ENOENT')
        || message.includes('Target page, context or browser has been closed')
        || message.includes('Browser has been closed')
      ) {
        continue;
      }
      throw error;
    }
  }
}

export function approvalFile(name: string) {
  return pngFilePayload(name);
}

export { RECEIPT_DATA_URL };
