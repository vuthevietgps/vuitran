import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrdersService } from './orders.service';
import { OrderStatus } from './schemas/order.schema';

jest.mock('../invoices/invoices.service', () => ({
  InvoicesService: class InvoicesService {},
}));
jest.mock('../marketing-attribution/marketing-attribution.service', () => ({
  MarketingAttributionService: class MarketingAttributionService {},
}));
jest.mock('./order-workflow.service', () => ({
  OrderWorkflowService: class OrderWorkflowService {},
}));

function buildService(overrides: Partial<{
  orderModel: any;
  invoiceModel: any;
  leadModel: any;
  studentModel: any;
  userModel: any;
  auditLogService: any;
  enrollmentService: any;
  invoicesService: any;
  marketingAttributionService: any;
  orderWorkflowService: any;
}> = {}) {
  const orderModel =
    overrides.orderModel ??
    ({
      findById: jest.fn(),
      findOneAndUpdate: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId().toHexString(),
        status: OrderStatus.APPROVED,
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    } as any);
  const invoiceModel =
    overrides.invoiceModel ??
    ({
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
  const leadModel = overrides.leadModel ?? ({} as any);
  const studentModel = overrides.studentModel ?? ({} as any);
  const userModel = overrides.userModel ?? ({} as any);
  const auditLogService =
    overrides.auditLogService ??
    ({
      log: jest.fn().mockResolvedValue(undefined),
    } as any);
  const enrollmentService =
    overrides.enrollmentService ??
    ({
      processApprovedOrder: jest.fn().mockResolvedValue({
        success: true,
        invoiceIds: [],
        errors: undefined,
      }),
    } as any);
  const invoicesService =
    overrides.invoicesService ??
    ({
      approveInvoice: jest.fn().mockResolvedValue(undefined),
    } as any);
  const marketingAttributionService =
    overrides.marketingAttributionService ?? ({} as any);
  const orderWorkflowService =
    overrides.orderWorkflowService ?? ({} as any);

  return new OrdersService(
    orderModel as any,
    invoiceModel as any,
    leadModel as any,
    studentModel as any,
    userModel as any,
    auditLogService as any,
    enrollmentService as any,
    invoicesService as any,
    marketingAttributionService as any,
    orderWorkflowService as any,
  );
}

function buildSubmittedOrder(status: OrderStatus, overrides: Partial<any> = {}) {
  return {
    _id: new Types.ObjectId().toHexString(),
    orderCode: 'ORD-2026-0001',
    studentName: 'Nguyen Van A',
    status,
    receiptImage: '/uploads/invoices/sale-proof.png',
    approvalImage: '/uploads/invoices/counter-proof.png',
    items: [],
    ...overrides,
  };
}

describe('OrdersService approve state machine', () => {
  it('allows approving a submitted order', async () => {
    const order = buildSubmittedOrder(OrderStatus.SUBMITTED);
    const orderModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(order),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({
        ...order,
        status: OrderStatus.APPROVED,
        approvedBy: 'actor-id',
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({ orderModel });
    (service as any).assertOrderInvoiceNumbersAvailable = jest
      .fn()
      .mockResolvedValue(undefined);

    const result = await service.approve(
      order._id,
      { sub: 'actor-id', role: 'DIRECTOR', email: 'director@school.com', fullName: 'Director' } as any,
      order.approvalImage,
    );

    expect(orderModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: order._id,
        status: OrderStatus.SUBMITTED,
      }),
      expect.objectContaining({
        status: OrderStatus.APPROVED,
        approvedBy: 'actor-id',
      }),
      { new: true },
    );
    expect(result.enrollment.success).toBe(true);
  });

  it.each([OrderStatus.DRAFT, OrderStatus.APPROVED, OrderStatus.CANCELLED])(
    'rejects approving an order in %s state',
    async (status) => {
      const order = buildSubmittedOrder(status);
      const orderModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(order),
        }),
        findOneAndUpdate: jest.fn().mockResolvedValue({
          ...order,
          status: OrderStatus.APPROVED,
        }),
        findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      };
      const service = buildService({ orderModel });
      (service as any).assertOrderInvoiceNumbersAvailable = jest
        .fn()
        .mockResolvedValue(undefined);

      await expect(
        service.approve(
          order._id,
          { sub: 'actor-id', role: 'OPS', email: 'ops@school.com', fullName: 'OPS' } as any,
          order.approvalImage,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );
});

describe('OrdersService payment frames', () => {
  it('builds three pending installment frames from paymentPlan + finalAmount + paymentDate', () => {
    const service = buildService();
    const frames = (service as any).buildPaymentFrames(
      'INSTALLMENT_3',
      3_000_000,
      '2026-04-11',
    );

    expect(frames).toHaveLength(3);
    expect(frames.map((frame: any) => frame.amount)).toEqual([
      1_000_000,
      1_000_000,
      1_000_000,
    ]);
    expect(frames.map((frame: any) => frame.status)).toEqual([
      'PENDING',
      'PENDING',
      'PENDING',
    ]);
    expect(frames.map((frame: any) => new Date(frame.dueDate).toISOString().slice(0, 10))).toEqual([
      '2026-04-11',
      '2026-05-11',
      '2026-06-11',
    ]);
  });

  it('keeps date-only paymentDate stable at UTC midnight regardless of local timezone', () => {
    const service = buildService();
    const frames = (service as any).buildPaymentFrames(
      'INSTALLMENT_2',
      2_000_000,
      '2026-04-11',
    );

    expect(frames).toHaveLength(2);
    expect(frames.map((frame: any) => frame.dueDate.toISOString())).toEqual([
      '2026-04-11T00:00:00.000Z',
      '2026-05-11T00:00:00.000Z',
    ]);
  });

  it('returns no payment frames for FULL plan', () => {
    const service = buildService();
    expect((service as any).buildPaymentFrames('FULL', 3_000_000, '2026-04-11')).toEqual([]);
  });
});

describe('OrdersService update owner resolution', () => {
  it('keeps current sale owner and clears linked parent/student when edit payload sends null', async () => {
    const currentSaleId = new Types.ObjectId();
    const existingParentId = new Types.ObjectId();
    const existingStudentId = new Types.ObjectId();
    const order = {
      _id: new Types.ObjectId().toHexString(),
      orderCode: 'ORD-2026-0002',
      status: OrderStatus.DRAFT,
      saleId: currentSaleId,
      saleName: 'Sale A',
      parentUserId: existingParentId,
      existingStudentId,
    };
    const orderModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(order),
      }),
      findByIdAndUpdate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          ...order,
          parentUserId: null,
          existingStudentId: null,
        }),
      }),
    };
    const userModel = {
      findOne: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: currentSaleId,
            fullName: 'Sale A',
            email: 'sale.a@school.local',
          }),
        }),
      }),
    };
    const marketingAttributionService = {
      upsertParentAttribution: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({
      orderModel,
      userModel,
      marketingAttributionService,
    });

    await service.update(
      order._id,
      {
        parentUserId: null,
        existingStudentId: null,
      } as any,
      {
        sub: new Types.ObjectId().toHexString(),
        role: 'OPS',
        email: 'ops@school.local',
        fullName: 'Ops',
      } as any,
    );

    expect(userModel.findOne).toHaveBeenCalledWith({
      _id: currentSaleId.toHexString(),
      role: 'SALE',
    });
    const updatePayload = orderModel.findByIdAndUpdate.mock.calls[0][1];
    expect(updatePayload.parentUserId).toBeNull();
    expect(updatePayload.existingStudentId).toBeNull();
    expect(updatePayload.saleName).toBe('Sale A');
  });
});
