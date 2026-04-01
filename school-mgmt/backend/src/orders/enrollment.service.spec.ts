import { Types } from 'mongoose';
import { EnrollmentService } from './enrollment.service';

function buildService(overrides: Partial<{
  orderModel: any;
  invoiceModel: any;
  connection: any;
  auditLogService: any;
  notificationsService: any;
  marketingAttributionService: any;
}> = {}) {
  const orderModel = overrides.orderModel ?? ({} as any);
  const invoiceModel = overrides.invoiceModel ?? ({} as any);
  const connection = overrides.connection ?? ({} as any);
  const auditLogService = overrides.auditLogService ?? ({
    log: jest.fn().mockResolvedValue(undefined),
  } as any);
  const notificationsService = overrides.notificationsService ?? ({
    create: jest.fn().mockResolvedValue(undefined),
    notifyByRole: jest.fn().mockResolvedValue(undefined),
  } as any);
  const marketingAttributionService = overrides.marketingAttributionService ?? ({
    upsertParentAttribution: jest.fn().mockResolvedValue(undefined),
  } as any);

  return new EnrollmentService(
    orderModel,
    {} as any,
    invoiceModel,
    {} as any,
    {} as any,
    connection,
    auditLogService,
    notificationsService,
    marketingAttributionService,
  );
}

const approverId = new Types.ObjectId().toHexString();

const approver = {
  _id: approverId,
  email: 'director@school.com',
  fullName: 'Director',
  role: 'DIRECTOR',
  sub: approverId,
} as any;

describe('EnrollmentService.processApprovedOrder error paths', () => {
  it('returns failure when order is not found', async () => {
    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    };
    const service = buildService({ orderModel });

    const result = await service.processApprovedOrder('invalid-id', approver);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Order khong ton tai');
  });

  it('reverts order to APPROVED status and returns failure when transaction throws', async () => {
    const mockOrder = {
      _id: 'order-id',
      orderCode: 'ORD-2026-0001',
      parentPhone: '0901234567',
      studentName: 'Nguyen Van A',
      items: [{ classId: 'class-id', sessions: 10, total: 2_000_000 }],
      saleId: null,
    };

    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const mockSession = {
      withTransaction: jest.fn().mockRejectedValue(new Error('DB timeout')),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({ orderModel: orderModel as any, connection: connection as any });

    const result = await service.processApprovedOrder('order-id', approver);

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-id',
      expect.objectContaining({ status: 'APPROVED' }),
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Enrollment that bai');
  });
});

describe('EnrollmentService.processApprovedOrder success path', () => {
  const validStudentId = new Types.ObjectId().toHexString();
  const validInvoiceId1 = new Types.ObjectId().toHexString();
  const validInvoiceId2 = new Types.ObjectId().toHexString();
  const validParentId = new Types.ObjectId().toHexString();

  it('creates student + invoices and keeps order APPROVED until class is linked', async () => {
    const mockOrder = {
      _id: 'order-id',
      orderCode: 'ORD-2026-0001',
      parentPhone: '0901234567',
      studentName: 'Nguyen Van A',
      items: [
        { classId: new Types.ObjectId().toHexString(), sessions: 10, total: 2_000_000 },
        { classId: new Types.ObjectId().toHexString(), sessions: 5, total: 1_000_000 },
      ],
      saleId: new Types.ObjectId().toHexString(),
    };

    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(mockOrder) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ ...mockOrder, status: 'APPROVED' }) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({ orderModel: orderModel as any, connection: connection as any });

    jest.spyOn(service as any, 'findOrCreateStudent').mockResolvedValue({
      studentId: validStudentId,
      studentCode: 'HV-2026-001',
      isNew: true,
      parentUserId: validParentId,
    });
    jest.spyOn(service as any, 'createInvoiceForItem')
      .mockResolvedValueOnce(validInvoiceId1)
      .mockResolvedValueOnce(validInvoiceId2);

    const result = await service.processApprovedOrder('order-id', approver);

    expect((service as any).findOrCreateStudent).toHaveBeenCalledTimes(1);
    expect((service as any).createInvoiceForItem).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.studentId).toBe(validStudentId);
    expect(result.studentCode).toBe('HV-2026-001');
    expect(result.invoiceIds).toEqual([validInvoiceId1, validInvoiceId2]);
    expect(result.classIds).toEqual([]);
  });

  it('returns undefined errors when all invoices succeed', async () => {
    const validStudentId2 = new Types.ObjectId().toHexString();
    const validInvoiceIdA = new Types.ObjectId().toHexString();
    const validParentId2 = new Types.ObjectId().toHexString();

    const mockOrder = {
      _id: 'order-id',
      orderCode: 'ORD-2026-0002',
      parentPhone: '0902000001',
      studentName: 'Le Thi B',
      items: [{ classId: new Types.ObjectId().toHexString(), sessions: 8, total: 1_600_000 }],
      saleId: null,
    };

    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(mockOrder) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ ...mockOrder, status: 'APPROVED' }) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({ orderModel: orderModel as any, connection: connection as any });
    jest.spyOn(service as any, 'findOrCreateStudent').mockResolvedValue({
      studentId: validStudentId2,
      studentCode: 'HV-2026-002',
      isNew: false,
      parentUserId: validParentId2,
    });
    jest.spyOn(service as any, 'createInvoiceForItem').mockResolvedValue(validInvoiceIdA);

    const result = await service.processApprovedOrder('order-id', approver);

    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });
});

describe('EnrollmentService invoice metadata helpers', () => {
  it('derives course status from order type and payment round', () => {
    const service = buildService();

    expect((service as any).deriveInvoiceCourseStatus('NEW_ENROLLMENT', 1)).toBe('NEW');
    expect((service as any).deriveInvoiceCourseStatus('RENEWAL', 1)).toBe('CONTINUE_1');
    expect((service as any).deriveInvoiceCourseStatus('RENEWAL', 3)).toBe('CONTINUE_2');
    expect((service as any).deriveInvoiceCourseStatus('PACKAGE_CHANGE', 9)).toBe('CONTINUE_5');
  });

  it('computes next payment round from existing active invoices', async () => {
    const countDocuments = jest.fn().mockResolvedValue(2);
    const service = buildService({
      invoiceModel: {
        countDocuments,
      } as any,
    });
    const studentId = new Types.ObjectId().toHexString();

    const paymentRound = await (service as any).getNextInvoicePaymentRound(studentId);

    expect(countDocuments).toHaveBeenCalledWith({
      studentId: new Types.ObjectId(studentId),
      status: { $nin: ['CANCELLED', 'REJECTED'] },
    });
    expect(paymentRound).toBe(3);
  });

  it('applies order-level discount to the generated invoice amount for a single item', async () => {
    const invoiceModel = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
      }),
    }));
    const service = buildService({
      invoiceModel: invoiceModel as any,
    }) as any;

    service.generateInvoiceNumber = jest.fn().mockResolvedValue('HD-2026-0001');

    await service.createInvoiceForItem(
      {
        _id: new Types.ObjectId(),
        orderCode: 'ORD-2026-0003',
        finalAmount: 1_500_000,
        totalAmount: 1_600_000,
        discountAmount: 100_000,
        saleCommission: 150_000,
        saleId: new Types.ObjectId(),
      },
      {
        productName: 'Goi hoc',
        sessions: 8,
        sessionDuration: 90,
        baseDuration: 70,
        pricePerSession: 200_000,
        amount: 1_600_000,
        paymentRound: 1,
      },
      0,
      new Types.ObjectId().toHexString(),
      approver,
    );

    expect(invoiceModel).toHaveBeenCalledTimes(1);
    expect(invoiceModel.mock.calls[0][0].amount).toBe(1_500_000);
    expect(invoiceModel.mock.calls[0][0].saleCommission).toBe(150_000);
  });

  it('derives invoice amount from invoice sessions and adjusted duration when amount is missing', async () => {
    const invoiceModel = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
      }),
    }));
    const service = buildService({
      invoiceModel: invoiceModel as any,
    }) as any;

    service.generateInvoiceNumber = jest.fn().mockResolvedValue('HD-2026-0002');
    service.getNextInvoicePaymentRound = jest.fn().mockResolvedValue(1);

    await service.createInvoiceForItem(
      {
        _id: new Types.ObjectId(),
        orderCode: 'ORD-2026-0004',
        orderType: 'NEW_ENROLLMENT',
        finalAmount: 0,
        totalAmount: 0,
      },
      {
        productName: 'Goi hoc 90p',
        sessions: 8,
        invoiceSessions: 6,
        sessionDuration: 90,
        baseDuration: 60,
        pricePerSession: 100_000,
      },
      0,
      new Types.ObjectId().toHexString(),
      approver,
    );

    expect(invoiceModel).toHaveBeenCalledTimes(1);
    expect(invoiceModel.mock.calls[0][0].amount).toBe(900_000);
  });

  it('preserves explicit zero invoice amount for offline trial invoices', async () => {
    const invoiceModel: any = jest.fn().mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
      }),
    }));
    invoiceModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });
    const service = buildService({
      invoiceModel: invoiceModel as any,
    }) as any;

    service.generateInvoiceNumber = jest.fn().mockResolvedValue('HD-2026-TRIAL-001');
    service.getNextInvoicePaymentRound = jest.fn().mockResolvedValue(1);

    await service.createInvoiceForItem(
      {
        _id: new Types.ObjectId(),
        orderCode: 'ORD-2026-TRIAL-001',
        orderType: 'NEW_ENROLLMENT',
        finalAmount: 0,
        totalAmount: 0,
      },
      {
        productName: 'Hoc thu offline',
        sessions: 8,
        invoiceSessions: 0,
        sessionDuration: 90,
        baseDuration: 90,
        pricePerSession: 200_000,
        amount: 0,
        trialSessions: 1,
        teachingMode: 'OFFLINE',
      },
      0,
      new Types.ObjectId().toHexString(),
      approver,
    );

    expect(invoiceModel).toHaveBeenCalledTimes(1);
    expect(invoiceModel.mock.calls[0][0].amount).toBe(0);
    expect(invoiceModel.mock.calls[0][0].sessions).toBe(0);
    expect(invoiceModel.mock.calls[0][0].sessionsRemaining).toBe(0);
    expect(invoiceModel.mock.calls[0][0].trialSessions).toBe(1);
    expect(invoiceModel.mock.calls[0][0].classType).toBe('OFFLINE');
  });
});
