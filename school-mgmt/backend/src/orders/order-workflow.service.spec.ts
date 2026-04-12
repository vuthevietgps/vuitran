import { BadRequestException } from '@nestjs/common';
import { OrderWorkflowService } from './order-workflow.service';
import { OrderStatus } from './schemas/order.schema';

function buildFindQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('OrderWorkflowService approve proof guard', () => {
  it('rejects approval when counter receipt is missing for non-exempt orders', async () => {
    const order = {
      _id: 'order-id',
      orderCode: 'ORD-2026-0999',
      studentName: 'Hoc sinh A',
      status: OrderStatus.SUBMITTED,
      receiptImage: '/uploads/invoices/sale-proof.png',
      items: [
        {
          productId: 'product-1',
          sessions: 10,
          invoiceNumber: 'INV-2026-0999',
          amount: 2_000_000,
          teachingMode: 'ONLINE',
          trialSessions: 0,
        },
      ],
    };

    const orderModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(buildFindQuery(order)),
      findById: jest.fn().mockReturnValue(buildFindQuery(order)),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const invoiceModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    };

    const service = new OrderWorkflowService(
      orderModel as any,
      invoiceModel as any,
      {} as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      { processApprovedOrder: jest.fn() } as any,
      { approveInvoice: jest.fn() } as any,
    );

    await expect(
      service.approve(
        'order-id',
        { sub: 'director-id', role: 'DIRECTOR', email: 'director@school.local', fullName: 'Director' } as any,
      ),
    ).rejects.toThrow(new BadRequestException('Phai tai hoa don doi ung truoc khi duyet don'));

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-id',
      { status: OrderStatus.SUBMITTED, $unset: { approvedBy: 1, approvedAt: 1 } },
    );
  });
});

describe('OrderWorkflowService installment auto-approval guard', () => {
  it('does not auto-approve generated invoices for installment orders', async () => {
    const order = {
      _id: 'order-id',
      orderCode: 'ORD-2026-INSTALL-001',
      studentName: 'Hoc sinh Installment',
      status: OrderStatus.SUBMITTED,
      paymentPlan: 'INSTALLMENT_3',
      receiptImage: '/uploads/invoices/sale-proof.png',
      items: [
        {
          productId: 'product-1',
          sessions: 12,
          invoiceNumber: 'INV-2026-INSTALL-001',
          amount: 3_000_000,
          teachingMode: 'ONLINE',
          trialSessions: 0,
        },
      ],
    };

    const orderModel = {
      findOneAndUpdate: jest.fn().mockReturnValue(buildFindQuery(order)),
      findById: jest.fn().mockReturnValue(buildFindQuery(order)),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const invoiceModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    };
    const processApprovedOrder = jest.fn().mockResolvedValue({
      success: true,
      invoiceIds: ['invoice-1', 'invoice-2', 'invoice-3'],
      classIds: [],
    });
    const approveInvoice = jest.fn().mockResolvedValue(undefined);

    const service = new OrderWorkflowService(
      orderModel as any,
      invoiceModel as any,
      {} as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
      { processApprovedOrder } as any,
      { approveInvoice } as any,
    );

    const result = await service.approve(
      'order-id',
      { sub: 'director-id', role: 'DIRECTOR', email: 'director@school.local', fullName: 'Director' } as any,
      '/uploads/invoices/counter-proof.png',
    );

    expect(result.enrollment.success).toBe(true);
    expect(processApprovedOrder).toHaveBeenCalledTimes(1);
    expect(approveInvoice).not.toHaveBeenCalled();
  });
});
