import { expect, test as base, type APIRequestContext } from '@playwright/test';
import { apiJson } from './api';
import { loginAsCredentials, loginAsRole, rolePassword } from './auth';
import { createBatchEvidenceContext, type BatchEvidenceOptions, type BatchEvidenceSession } from './orchestrator';
import {
  createEnrollmentFixture,
  createLearningFixture,
  createParentAccount,
  createSubmittedOrder,
  ensureTeacherAccount,
  initializeWalletForParent,
} from './scenario-helpers';

export { expect };

export interface OrchestratorRuntimeFixtures {
  runDate: string;
  createEvidence: (
    options: Omit<BatchEvidenceOptions, 'runDate'>,
  ) => Promise<BatchEvidenceSession>;
}

function inferRunDate(): string {
  return (
    process.env['UI_EVIDENCE_DATE']
    || process.env['E2E_RUN_DATE']
    || new Date().toISOString().slice(0, 10)
  );
}

export const test = base.extend<OrchestratorRuntimeFixtures>({
  runDate: async ({}, use) => {
    await use(inferRunDate());
  },
  createEvidence: async ({ browser, runDate }, use) => {
    await use((options) => createBatchEvidenceContext(browser, {
      ...options,
      runDate,
    }));
  },
});

export interface UiOrchestratorFixtures {
  freshParent: {
    _id: string;
    email: string;
    fullName: string;
    phone: string;
    password: string;
  };
  depletedWalletFixture: Awaited<ReturnType<typeof createEnrollmentFixture>>;
  installmentOrder: any;
  partialPaymentOrder: any;
  payrollBlockedFixture: Awaited<ReturnType<typeof createLearningFixture>>;
  teacherSwapFixture: Awaited<ReturnType<typeof createEnrollmentFixture>> & {
    substituteTeacher: Awaited<ReturnType<typeof ensureTeacherAccount>>;
  };
}

function getEntityId(value: any): string {
  return String(value?._id || value?.id || '');
}

async function assignTeacherToSale(
  request: APIRequestContext,
  directorSession: Awaited<ReturnType<typeof loginAsRole>>,
  teacherUserId: string,
  saleUserId: string,
): Promise<void> {
  const teacherProfiles = await apiJson<any[]>(
    request,
    directorSession,
    'GET',
    '/teachers',
  );
  const teacherProfile = teacherProfiles.find((profile) => {
    const profileUserId =
      typeof profile?.userId === 'string'
        ? profile.userId
        : profile?.userId?._id;
    return String(profileUserId || '') === teacherUserId;
  });

  expect(teacherProfile, `Missing teacher profile for ${teacherUserId}`).toBeTruthy();

  const managedSales = Array.from(new Set([
    ...((teacherProfile?.managedSales || []).map((sale: any) => (
      typeof sale === 'string' ? sale : sale?._id
    )).filter((id: string | undefined): id is string => !!id)),
    saleUserId,
  ]));

  await apiJson(
    request,
    directorSession,
    'PATCH',
    `/teachers/${getEntityId(teacherProfile)}`,
    {
      managedSales,
    },
  );
}

export async function seedUiOrchestratorFixtures(
  request: APIRequestContext,
  label: string,
): Promise<UiOrchestratorFixtures> {
  const directorSession = await loginAsRole(request, 'director');
  const freshParent = await createParentAccount(request, directorSession, `${label}-fresh-parent`);
  await initializeWalletForParent(request, freshParent);

  const depletedWalletFixture = await createEnrollmentFixture(request, {
    label: `${label}-wallet-empty`,
    initializeWallet: true,
  });

  const installmentOrder = await createSubmittedOrder(request, {
    label: `${label}-installment-order`,
    totalAmount: 2_400_000,
    finalAmount: 2_400_000,
    paymentPlan: 'INSTALLMENT_3',
    sessions: 12,
    invoiceSessions: 4,
    pricePerSession: 200_000,
  });

  const partialPaymentOrder = await createSubmittedOrder(request, {
    label: `${label}-partial-payment-order`,
    totalAmount: 1_800_000,
    finalAmount: 1_200_000,
    paymentPlan: 'INSTALLMENT_2',
    sessions: 9,
    invoiceSessions: 6,
    discountAmount: 0,
    pricePerSession: 200_000,
  });

  const payrollBlockedFixture = await createLearningFixture(request, {
    label: `${label}-payroll-blocked`,
    initializeWallet: true,
    initialWalletAmount: 500_000,
    scheduledDate: new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
  });

  await apiJson(
    request,
    directorSession,
    'POST',
    '/attendance/mark',
    {
      classId: payrollBlockedFixture.classroom._id,
      studentId: payrollBlockedFixture.student._id,
      date: payrollBlockedFixture.scheduledDate,
      status: 'PRESENT',
      notes: `${label} payroll blocked seed`,
    },
  );

  const teacherSession = await loginAsCredentials(
    request,
    'teacher',
    payrollBlockedFixture.teacher.email,
    rolePassword(),
  );

  await apiJson(
    request,
    teacherSession,
    'POST',
    `/sessions/${payrollBlockedFixture.session._id}/complete`,
    {
      lessonContent: 'Seeded completion for payroll blocked fixture.',
      homework: 'Pending report submission.',
      teacherNotes: 'Used to keep payroll flow blocked until full report is submitted.',
      actualStartTime: new Date(Date.now() - (90 * 60 * 1000)).toISOString(),
      actualEndTime: new Date(Date.now() - (30 * 60 * 1000)).toISOString(),
      studentPerformance: 4,
      studentEngagement: 4,
      comprehensionLevel: 4,
    },
    [200, 201, 400, 409],
  );

  const teacherSwapFixture = await createEnrollmentFixture(request, {
    label: `${label}-teacher-swap`,
    initializeWallet: true,
    initialWalletAmount: 600_000,
  });
  const substituteTeacher = await ensureTeacherAccount(
    request,
    directorSession,
    `${label}-substitute-teacher`,
  );
  await assignTeacherToSale(
    request,
    directorSession,
    substituteTeacher._id,
    teacherSwapFixture.sale._id,
  );

  return {
    freshParent,
    depletedWalletFixture,
    installmentOrder,
    partialPaymentOrder,
    payrollBlockedFixture,
    teacherSwapFixture: {
      ...teacherSwapFixture,
      substituteTeacher,
    },
  };
}
