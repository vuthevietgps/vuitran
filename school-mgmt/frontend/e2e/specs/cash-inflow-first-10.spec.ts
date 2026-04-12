import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  acceptDialog,
  apiJson,
  approvalFile,
  closeActors,
  createEnrollmentFixture,
  createPendingInvoice,
  createSubmittedOrder,
  findInvoicesByOrderId,
  getInvoiceById,
  getOrderById,
  getWalletBalanceByUserId,
  invoiceRow,
  loginAsRole,
  openRolePage,
  orderRow,
} from '../support';

const RECEIPT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7+VXwAAAAASUVORK5CYII=';

function orderApproveModal(page: Page): Locator {
  return page
    .locator('[data-testid="order-approve-modal"], .backdrop')
    .filter({ hasText: /Xac nhan duyet don|Xác nhận duyệt đơn/i })
    .first();
}

function invoiceApproveModal(page: Page): Locator {
  return page
    .locator('[data-testid="invoice-approve-modal"], .modal-backdrop')
    .filter({ hasText: /Xac nhan duyet hoa don|Xác nhận duyệt hóa đơn/i })
    .first();
}

function orderDetailModal(page: Page, orderCode: string): Locator {
  return page
    .locator('[data-testid="order-detail-modal"], .backdrop')
    .filter({ hasText: orderCode })
    .first();
}

test.describe('Group 1 - Cash Inflow', () => {
  test('1.1 approve a standard order from the orders UI', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const order = await createSubmittedOrder(request, {
      label: 'cash-standard',
      totalAmount: 2_000_000,
      finalAmount: 2_000_000,
      sessions: 10,
      invoiceSessions: 10,
      pricePerSession: 200_000,
      teacherPayPerSession: 120_000,
      paymentPlan: 'FULL',
      teachingMode: 'ONLINE',
      receiptImage: RECEIPT_PNG,
    });

    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');
    try {
      const row = orderRow(directorUi.page, order.orderCode);
      await expect(row).toBeVisible();
      await row.getByTestId('order-row-approve').click();

      const approveModal = orderApproveModal(directorUi.page);
      await expect(approveModal).toBeVisible();
      await approveModal
        .locator('[data-testid="order-approve-image"], input[type="file"]')
        .first()
        .setInputFiles(approvalFile(`order-approval-${order.orderCode}.png`));

      await acceptDialog(directorUi.page, () => approveModal.getByTestId('order-approve-confirm').click());
      await expect(approveModal).toBeHidden();

      const approvedOrder = await getOrderById(request, directorSession, order._id);
      const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
      expect(['APPROVED', 'COMPLETED']).toContain(approvedOrder.status);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe('APPROVED');
      expect(invoices[0].amount).toBe(2_000_000);
      expect(approvedOrder.parentUserId).toBeTruthy();
      await expect
        .poll(() => getWalletBalanceByUserId(request, directorSession, approvedOrder.parentUserId))
        .toBe(2_000_000);
    } finally {
      await closeActors(directorUi);
    }
  });

  test('1.2 approve only the first installment invoice', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const enrollment = await createEnrollmentFixture(request, {
      label: 'cash-installment',
      classMode: 'ONLINE',
      initializeWallet: true,
    });
    const seed = Date.now();
    const [invoiceOne, invoiceTwo, invoiceThree] = await Promise.all([
      createPendingInvoice(request, enrollment, {
        invoiceNumber: `E2E-INSTALL-1-${seed}`,
        amount: 1_000_000,
        paymentRound: 1,
      }),
      createPendingInvoice(request, enrollment, {
        invoiceNumber: `E2E-INSTALL-2-${seed}`,
        amount: 1_000_000,
        paymentRound: 2,
      }),
      createPendingInvoice(request, enrollment, {
        invoiceNumber: `E2E-INSTALL-3-${seed}`,
        amount: 1_000_000,
        paymentRound: 3,
      }),
    ]);

    const accountingUi = await openRolePage(browser, request, 'accounting', '/app/invoices');
    try {
      const row = invoiceRow(accountingUi.page, invoiceOne.invoiceNumber);
      await expect(row).toBeVisible();
      await row.getByTestId('invoice-row-approve').click();

      const approveModal = invoiceApproveModal(accountingUi.page);
      await expect(approveModal).toBeVisible();
      await approveModal
        .locator('[data-testid="invoice-approve-file"], input[type="file"]')
        .first()
        .setInputFiles(approvalFile(`invoice-approval-${invoiceOne.invoiceNumber}.png`));
      await expect.poll(() => approveModal.locator('img.preview').count()).toBeGreaterThan(1);
      accountingUi.page.once('dialog', (dialog) => dialog.accept());

      await approveModal.getByTestId('invoice-approve-confirm').click();
      await expect(approveModal).toBeHidden();
      await expect(row).toContainText(/Da duyet|Đã duyệt/);

      await expect
        .poll(() => getWalletBalanceByUserId(request, directorSession, enrollment.parent._id))
        .toBe(1_000_000);

      const pendingInvoiceTwo = await getInvoiceById(request, directorSession, invoiceTwo._id);
      const pendingInvoiceThree = await getInvoiceById(request, directorSession, invoiceThree._id);
      expect(pendingInvoiceTwo.status).toBe('PENDING_APPROVAL');
      expect(pendingInvoiceThree.status).toBe('PENDING_APPROVAL');
    } finally {
      await closeActors(accountingUi);
    }
  });

  test('1.3 approve a discounted order and top up only the final amount', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const order = await createSubmittedOrder(request, {
      label: 'cash-discount',
      totalAmount: 2_000_000,
      finalAmount: 1_800_000,
      discountAmount: 200_000,
      discountReason: 'Khuyen mai E2E',
      sessions: 10,
      invoiceSessions: 9,
      pricePerSession: 200_000,
      teacherPayPerSession: 120_000,
      paymentPlan: 'FULL',
      teachingMode: 'ONLINE',
      receiptImage: RECEIPT_PNG,
    });

    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');
    try {
      const row = orderRow(directorUi.page, order.orderCode);
      await expect(row).toBeVisible();
      await row.getByTestId('order-row-approve').click();

      const approveModal = orderApproveModal(directorUi.page);
      await expect(approveModal).toBeVisible();
      await approveModal
        .locator('[data-testid="order-approve-image"], input[type="file"]')
        .first()
        .setInputFiles(approvalFile(`order-discount-${order.orderCode}.png`));

      await acceptDialog(directorUi.page, () => approveModal.getByTestId('order-approve-confirm').click());
      await expect(approveModal).toBeHidden();

      const approvedOrder = await getOrderById(request, directorSession, order._id);
      const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
      expect(approvedOrder.discountAmount).toBe(200_000);
      expect(approvedOrder.finalAmount).toBe(1_800_000);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe('APPROVED');
      expect(invoices[0].amount).toBe(1_800_000);
      await expect
        .poll(() => getWalletBalanceByUserId(request, directorSession, approvedOrder.parentUserId))
        .toBe(1_800_000);
    } finally {
      await closeActors(directorUi);
    }
  });

  test('1.4 approve a zero-amount trial order without a matching approval document', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const enrollment = await createEnrollmentFixture(request, {
      label: 'cash-trial-order',
      classMode: 'OFFLINE',
      teacherPayPerStudent: 200_000,
      pricePerSession: 0,
      sessionDuration: 60,
      baseDuration: 60,
    });
    const uniqueSeed = Date.now();
    const paymentDate = new Date().toISOString().slice(0, 10);
    const draftOrder = await apiJson<any>(request, directorSession, 'POST', '/orders', {
      orderType: 'NEW_ENROLLMENT',
      saleId: enrollment.sale._id,
      parentName: `E2E Order Parent cash-trial-${uniqueSeed}`,
      parentPhone: `09${String(uniqueSeed).slice(-8)}`,
      studentName: `E2E Order Student cash-trial-${uniqueSeed}`,
      studentAge: 10,
      items: [
        {
          productId: enrollment.product._id,
          productName: enrollment.product.name,
          sessions: 1,
          invoiceSessions: 0,
          sessionDuration: 60,
          baseDuration: 60,
          pricePerSession: 0,
          amount: 0,
          bonusSessions: 0,
          trialSessions: 1,
          teachingMode: 'OFFLINE',
          selectedClassId: enrollment.classroom._id,
          preferredTeacherId: enrollment.teacher._id,
          paymentRound: 1,
          teacherPayPerSession: 0,
          teacherPayPerStudent: 200_000,
          subject: 'Tieng Anh',
          learningGoals: 'E2E zero-amount trial with direct class placement',
          invoiceNumber: `INV-TRIAL-${uniqueSeed}`,
          invoiceDescription: 'Order cash-trial',
        },
      ],
      totalAmount: 0,
      discountAmount: 0,
      discountReason: '',
      finalAmount: 0,
      paymentPlan: 'FULL',
      paymentDate,
    });
    await apiJson(request, directorSession, 'POST', `/orders/${draftOrder._id}/submit`, {});
    const order = await getOrderById(request, directorSession, draftOrder._id);

    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');
    try {
      const row = orderRow(directorUi.page, order.orderCode);
      await expect(row).toBeVisible();
      await row.getByTestId('order-row-approve').click();

      const approveModal = orderApproveModal(directorUi.page);
      await expect(approveModal).toBeVisible();
      await expect(approveModal).toContainText(/Đơn học thử offline 0đ|Don hoc thu offline 0d|offline trial 0d/i);
      await expect(approveModal).toContainText(/không bắt buộc|khong bat buoc/i);

      await acceptDialog(directorUi.page, () => approveModal.getByTestId('order-approve-confirm').click());
      await expect(approveModal).toBeHidden();

      const approvedOrder = await getOrderById(request, directorSession, order._id);
      expect(['APPROVED', 'COMPLETED']).toContain(approvedOrder.status);

      await expect
        .poll(async () => {
          const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
          return invoices[0]?.status || '';
        })
        .toBe('APPROVED');
      await expect
        .poll(async () => {
          const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
          return Boolean(invoices[0]?.classId);
        })
        .toBe(true);

      const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
      expect(invoices).toHaveLength(1);
      expect(invoices[0].amount).toBe(0);
      expect(await getWalletBalanceByUserId(request, directorSession, approvedOrder.parentUserId)).toBe(0);
    } finally {
      await closeActors(directorUi);
    }
  });

  test('1.5 reject an order and confirm that no invoice or wallet top-up is created', async ({
    browser,
    request,
  }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const order = await createSubmittedOrder(request, {
      label: 'cash-reject',
      totalAmount: 2_000_000,
      finalAmount: 2_000_000,
      sessions: 10,
      invoiceSessions: 10,
      pricePerSession: 200_000,
      teacherPayPerSession: 120_000,
      paymentPlan: 'FULL',
      teachingMode: 'ONLINE',
      receiptImage: RECEIPT_PNG,
    });

    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');
    try {
      const row = orderRow(directorUi.page, order.orderCode);
      await expect(row).toBeVisible();
      await row.locator('td').first().click();

      const detailModal = orderDetailModal(directorUi.page, order.orderCode);
      await expect(detailModal).toBeVisible();
      await acceptDialog(directorUi.page, () => detailModal.getByTestId('order-detail-reject').click(), 'Bien lai gia');
      await expect(detailModal).toBeHidden();

      const rejectedOrder = await getOrderById(request, directorSession, order._id);
      const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
      expect(rejectedOrder.status).toBe('REJECTED');
      expect(String(rejectedOrder.rejectionReason || '')).toContain('Bien lai gia');
      expect(invoices).toHaveLength(0);
      if (rejectedOrder.parentUserId) {
        expect(await getWalletBalanceByUserId(request, directorSession, rejectedOrder.parentUserId)).toBe(0);
      }
    } finally {
      await closeActors(directorUi);
    }
  });

  test('1.6 partial payment order', async ({ browser, request }) => {
    test.slow();

    const directorSession = await loginAsRole(request, 'director');
    const order = await createSubmittedOrder(request, {
      label: 'cash-partial',
      totalAmount: 1_800_000,
      finalAmount: 1_200_000,
      discountAmount: 0,
      sessions: 9,
      invoiceSessions: 6,
      pricePerSession: 200_000,
      teacherPayPerSession: 120_000,
      paymentPlan: 'INSTALLMENT_2',
      teachingMode: 'ONLINE',
      receiptImage: RECEIPT_PNG,
    });

    const directorUi = await openRolePage(browser, request, 'director', '/app/orders');
    try {
      const row = orderRow(directorUi.page, order.orderCode);
      await expect(row).toBeVisible();
      await expect(row.getByTestId('order-row-partial-badge')).toHaveCount(0);
      await row.locator('td').first().click();

      const detailModal = orderDetailModal(directorUi.page, order.orderCode);
      await expect(detailModal).toBeVisible();
      await expect(detailModal.getByTestId('order-detail-partial-badge')).toHaveCount(0);

      await detailModal.getByTestId('order-detail-approve').click();
      const approveModal = orderApproveModal(directorUi.page);
      await expect(approveModal).toBeVisible();
      await approveModal
        .locator('[data-testid="order-approve-image"], input[type="file"]')
        .first()
        .setInputFiles(approvalFile(`order-partial-${order.orderCode}.png`));
      await approveModal.getByTestId('order-approve-confirm').click();
      await expect(approveModal).toBeHidden();

      await expect(row.getByTestId('order-row-partial-badge')).toContainText(/Chưa thanh toán đủ|Chua thanh toan du/i);
      await expect(row.getByTestId('order-row-paid-amount')).toContainText(/1[.,]200[.,]000.*đ|1[.,]200[.,]000.*d|1[.,]200[.,]000/i);
      await expect(row.getByTestId('order-row-remaining-amount')).toContainText(/600[.,]000.*đ|600[.,]000.*d|600[.,]000/i);
      await expect(detailModal.getByTestId('order-detail-partial-badge')).toContainText(/Chưa thanh toán đủ|Chua thanh toan du/i);
      await expect(detailModal.getByTestId('order-detail-paid-amount')).toContainText(/1[.,]200[.,]000.*đ|1[.,]200[.,]000.*d|1[.,]200[.,]000/i);
      await expect(detailModal.getByTestId('order-detail-remaining-amount')).toContainText(/600[.,]000.*đ|600[.,]000.*d|600[.,]000/i);

      const approvedOrder = await getOrderById(request, directorSession, order._id);
      const invoices = await findInvoicesByOrderId(request, directorSession, order._id);
      const sortedInvoices = [...invoices].sort(
        (left, right) => Number(left.paymentRound || 0) - Number(right.paymentRound || 0),
      );
      expect(approvedOrder.status).toBe('APPROVED');
      expect(sortedInvoices).toHaveLength(2);
      expect(sortedInvoices.map((invoice) => invoice.paymentRound)).toEqual([1, 2]);
      expect(sortedInvoices.map((invoice) => invoice.amount)).toEqual([600_000, 600_000]);
      expect(sortedInvoices.map((invoice) => invoice.status)).toEqual([
        'PENDING_APPROVAL',
        'PENDING_APPROVAL',
      ]);
      await expect
        .poll(() => getWalletBalanceByUserId(request, directorSession, approvedOrder.parentUserId))
        .toBe(0);
    } finally {
      await closeActors(directorUi);
    }
  });
});
