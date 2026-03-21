/**
 * Unit Tests: EnrollmentService.processApprovedOrder()
 *
 * Strategy: mock all Mongoose models + connection (withTransaction),
 * spy on private methods (findOrCreateStudent, createInvoiceForItem)
 * to unit test the coordinator logic without a live DB.
 */
import { Types } from 'mongoose';
import { EnrollmentService } from './enrollment.service';

// ─── Build service with fully mocked dependencies ─────────────────────────────

function buildService(overrides: Partial<{
  orderModel: any;
  connection: any;
  auditLogService: any;
  notificationsService: any;
  marketingAttributionService: any;
}> = {}) {
  const orderModel = overrides.orderModel ?? ({} as any);
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
    {} as any, // studentModel
    {} as any, // invoiceModel
    {} as any, // classModel
    {} as any, // userModel
    connection,
    auditLogService,
    notificationsService,
    marketingAttributionService,
  );
}

// ─── Shared approver payload ──────────────────────────────────────────────────

const approver = {
  _id: 'director-id',
  email: 'director@school.com',
  fullName: 'Director',
  role: 'DIRECTOR',
  sub: 'director-id',
} as any;

// ══════════════════════════════════════════════════════════════════════════════
//  Error paths
// ══════════════════════════════════════════════════════════════════════════════

describe('EnrollmentService.processApprovedOrder() — error paths', () => {
  it('returns failure when order is not found', async () => {
    const orderModel = { findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) };
    const service = buildService({ orderModel });

    const result = await service.processApprovedOrder('invalid-id', approver);

    expect(result.success).toBe(false);
    expect(result.errors).toContain('Order không tồn tại');
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

    // Order reverted to APPROVED so OPS can retry manually
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'order-id',
      expect.objectContaining({ status: 'APPROVED' }),
    );
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain('Enrollment thất bại');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
//  Success path
// ══════════════════════════════════════════════════════════════════════════════

describe('EnrollmentService.processApprovedOrder() — success path', () => {
  // Use valid ObjectId hex strings so new Types.ObjectId(str) doesn't throw
  const validStudentId = new Types.ObjectId().toHexString();
  const validInvoiceId1 = new Types.ObjectId().toHexString();
  const validInvoiceId2 = new Types.ObjectId().toHexString();
  const validParentId = new Types.ObjectId().toHexString();

  it('creates student + invoices and marks order COMPLETED', async () => {
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
      findById: jest.fn()
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(mockOrder) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ ...mockOrder, status: 'COMPLETED' }) }),
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
  });

  it('returns errors array undefined when all invoices succeed', async () => {
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
      findById: jest.fn()
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(mockOrder) })
        .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue({ ...mockOrder, status: 'COMPLETED' }) }),
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
