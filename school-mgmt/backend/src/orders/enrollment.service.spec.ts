import { Types } from "mongoose";
import { InvoicesService } from "../invoices/invoices.service";
import { StudentsService } from "../students/students.service";
import { UsersService } from "../users/users.service";
import { OrderApprovedEvent } from "./events/order-approved.event";
import { EnrollmentService } from "./enrollment.service";

function buildService(
  overrides: Partial<{
    orderModel: any;
    usersService: Partial<UsersService>;
    studentsService: Partial<StudentsService>;
    invoicesService: Partial<InvoicesService>;
    eventEmitter: any;
    connection: any;
  }> = {},
) {
  const orderModel = overrides.orderModel ?? ({} as any);
  const usersService =
    overrides.usersService ??
    ({
      findOrCreateParentFromOrder: jest.fn(),
    } as any);
  const studentsService =
    overrides.studentsService ??
    ({
      findOrCreateStudentFromOrder: jest.fn(),
    } as any);
  const invoicesService =
    overrides.invoicesService ??
    ({
      createInvoiceForOrder: jest.fn(),
    } as any);
  const eventEmitter = overrides.eventEmitter ?? {
    emit: jest.fn(),
  };
  const connection = overrides.connection ?? ({} as any);

  return new EnrollmentService(
    orderModel,
    usersService as UsersService,
    studentsService as StudentsService,
    invoicesService as InvoicesService,
    eventEmitter,
    connection,
  );
}

const approverId = new Types.ObjectId().toHexString();

const approver = {
  _id: approverId,
  email: "director@school.com",
  fullName: "Director",
  role: "DIRECTOR",
  sub: approverId,
} as any;

describe("EnrollmentService.processApprovedOrder", () => {
  it("returns failure when order is not found", async () => {
    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    };
    const service = buildService({ orderModel });

    const result = await service.processApprovedOrder("invalid-id", approver);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Order khong ton tai");
  });

  it("returns failure and does not emit when parent resolution fails", async () => {
    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-0001",
      parentPhone: "0901234567",
      studentName: "Nguyen Van A",
      items: [{ sessions: 10, total: 2_000_000 }],
      saleId: null,
    };

    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const usersService = {
      findOrCreateParentFromOrder: jest
        .fn()
        .mockRejectedValue(new Error("DB timeout")),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn(),
    };
    const invoicesService = {
      createInvoiceForOrder: jest.fn(),
    };
    const eventEmitter = { emit: jest.fn() };

    const mockSession = {
      withTransaction: jest
        .fn()
        .mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    const service = buildService({
      orderModel: orderModel as any,
      usersService: usersService as any,
      studentsService: studentsService as any,
      invoicesService: invoicesService as any,
      eventEmitter: eventEmitter as any,
      connection: connection as any,
    });

    const result = await service.processApprovedOrder("order-id", approver);

    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(studentsService.findOrCreateStudentFromOrder).not.toHaveBeenCalled();
    expect(invoicesService.createInvoiceForOrder).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("Enrollment that bai");
  });

  it("returns failure when the second invoice creation fails and does not update the order", async () => {
    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-0002",
      parentPhone: "0901234567",
      studentName: "Nguyen Van A",
      items: [
        { productId: new Types.ObjectId().toHexString(), sessions: 10, total: 2_000_000 },
        { productId: new Types.ObjectId().toHexString(), sessions: 5, total: 1_000_000 },
      ],
      saleId: null,
    };

    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findOrCreateParentFromOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn().mockResolvedValue({
        studentId: new Types.ObjectId().toHexString(),
        studentCode: "HS002",
        isNew: true,
      }),
    };
    const invoicesService = {
      createInvoiceForOrder: jest
        .fn()
        .mockResolvedValueOnce(new Types.ObjectId().toHexString())
        .mockRejectedValueOnce(new Error("DB Insert Failed")),
    };
    const eventEmitter = { emit: jest.fn() };
    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({
      orderModel: orderModel as any,
      usersService: usersService as any,
      studentsService: studentsService as any,
      invoicesService: invoicesService as any,
      eventEmitter: eventEmitter as any,
      connection: connection as any,
    });

    const result = await service.processApprovedOrder("order-id", approver);

    expect(usersService.findOrCreateParentFromOrder).toHaveBeenCalledTimes(1);
    expect(studentsService.findOrCreateStudentFromOrder).toHaveBeenCalledTimes(1);
    expect(invoicesService.createInvoiceForOrder).toHaveBeenCalledTimes(2);
    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("DB Insert Failed");
  });

  it("returns failure when the transaction itself fails before commit", async () => {
    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-0003",
      parentPhone: "0901234567",
      studentName: "Nguyen Van A",
      items: [{ sessions: 10, total: 2_000_000 }],
      saleId: null,
    };

    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findOrCreateParentFromOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn(),
    };
    const invoicesService = {
      createInvoiceForOrder: jest.fn(),
    };
    const eventEmitter = { emit: jest.fn() };
    const mockSession = {
      withTransaction: jest.fn().mockRejectedValue(new Error("commit timeout")),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({
      orderModel: orderModel as any,
      usersService: usersService as any,
      studentsService: studentsService as any,
      invoicesService: invoicesService as any,
      eventEmitter: eventEmitter as any,
      connection: connection as any,
    });

    const result = await service.processApprovedOrder("order-id", approver);

    expect(orderModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("commit timeout");
  });

  it("orchestrates services, updates the order, and emits an async event", async () => {
    const validStudentId = new Types.ObjectId().toHexString();
    const validInvoiceId1 = new Types.ObjectId().toHexString();
    const validInvoiceId2 = new Types.ObjectId().toHexString();
    const validParentId = new Types.ObjectId().toHexString();

    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-0001",
      parentPhone: "0901234567",
      studentName: "Nguyen Van A",
      items: [
        {
          productId: new Types.ObjectId().toHexString(),
          sessions: 10,
          total: 2_000_000,
        },
        {
          productId: new Types.ObjectId().toHexString(),
          sessions: 5,
          total: 1_000_000,
        },
      ],
      saleId: new Types.ObjectId().toHexString(),
      saleName: "Sale A",
    };

    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findOrCreateParentFromOrder: jest.fn().mockResolvedValue(validParentId),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn().mockResolvedValue({
        studentId: validStudentId,
        studentCode: "HS001",
        isNew: true,
      }),
    };
    const invoicesService = {
      createInvoiceForOrder: jest
        .fn()
        .mockResolvedValueOnce(validInvoiceId1)
        .mockResolvedValueOnce(validInvoiceId2),
    };
    const eventEmitter = { emit: jest.fn() };
    const mockSession = {
      withTransaction: jest
        .fn()
        .mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    const service = buildService({
      orderModel: orderModel as any,
      usersService: usersService as any,
      studentsService: studentsService as any,
      invoicesService: invoicesService as any,
      eventEmitter,
      connection: connection as any,
    });

    const result = await service.processApprovedOrder("order-id", approver);

    expect(usersService.findOrCreateParentFromOrder).toHaveBeenCalledWith(
      mockOrder,
      mockSession,
    );
    expect(studentsService.findOrCreateStudentFromOrder).toHaveBeenCalledWith(
      mockOrder,
      validParentId,
      approver,
      mockSession,
    );
    expect(invoicesService.createInvoiceForOrder).toHaveBeenCalledTimes(2);
    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "order-id",
      expect.objectContaining({
        status: "APPROVED",
        parentUserId: expect.any(Types.ObjectId),
      }),
      { session: mockSession },
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "order.approved.success",
      expect.any(OrderApprovedEvent),
    );
    const payload = eventEmitter.emit.mock.calls[0][1] as OrderApprovedEvent;
    expect(payload).toMatchObject({
      orderId: "order-id",
      orderCode: mockOrder.orderCode,
      studentId: validStudentId,
      invoiceIds: [validInvoiceId1, validInvoiceId2],
      actorId: approverId,
      extras: expect.objectContaining({
        parentUserId: validParentId,
        studentCode: "HS001",
        saleId: mockOrder.saleId,
        actorEmail: approver.email,
        isNew: true,
      }),
    });
    expect(result).toEqual({
      success: true,
      studentId: validStudentId,
      studentCode: "HS001",
      invoiceIds: [validInvoiceId1, validInvoiceId2],
      classIds: [],
    });
  });

  it("does not block the response waiting for async side effects from emit", async () => {
    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-0004",
      parentPhone: "0901234567",
      studentName: "Nguyen Van A",
      items: [{ sessions: 10, total: 2_000_000 }],
      saleId: null,
    };

    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findOrCreateParentFromOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn().mockResolvedValue({
        studentId: new Types.ObjectId().toHexString(),
        studentCode: "HS003",
        isNew: true,
      }),
    };
    const invoicesService = {
      createInvoiceForOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    let sideEffectRan = false;
    const eventEmitter = {
      emit: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          sideEffectRan = true;
        }, 50);
      }),
    };
    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    jest.useFakeTimers();
    try {
      const service = buildService({
        orderModel: orderModel as any,
        usersService: usersService as any,
        studentsService: studentsService as any,
        invoicesService: invoicesService as any,
        eventEmitter: eventEmitter as any,
        connection: connection as any,
      });

      const resultPromise = service.processApprovedOrder("order-id", approver);
      await expect(resultPromise).resolves.toMatchObject({ success: true });
      expect(sideEffectRan).toBe(false);

      jest.advanceTimersByTime(50);
      expect(sideEffectRan).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps success when emit throws, so side-effect failure does not break the core flow", async () => {
    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-0005",
      parentPhone: "0901234567",
      studentName: "Nguyen Van A",
      items: [{ sessions: 10, total: 2_000_000 }],
      saleId: null,
    };

    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findOrCreateParentFromOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn().mockResolvedValue({
        studentId: new Types.ObjectId().toHexString(),
        studentCode: "HS004",
        isNew: true,
      }),
    };
    const invoicesService = {
      createInvoiceForOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    const eventEmitter = {
      emit: jest.fn().mockImplementation(() => {
        throw new Error("listener failed");
      }),
    };
    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({
      orderModel: orderModel as any,
      usersService: usersService as any,
      studentsService: studentsService as any,
      invoicesService: invoicesService as any,
      eventEmitter: eventEmitter as any,
      connection: connection as any,
    });

    const result = await service.processApprovedOrder("order-id", approver);

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it("splits an INSTALLMENT_3 order into three invoice-create calls for a single item", async () => {
    const mockOrder = {
      _id: "order-id",
      orderCode: "ORD-2026-INSTALL-001",
      parentPhone: "0901234567",
      studentName: "Nguyen Van Installment",
      paymentPlan: "INSTALLMENT_3",
      paymentFrames: [
        { dueDate: new Date("2026-04-11T00:00:00.000Z"), amount: 1_000_000, status: "PENDING" },
        { dueDate: new Date("2026-05-11T00:00:00.000Z"), amount: 1_000_000, status: "PENDING" },
        { dueDate: new Date("2026-06-11T00:00:00.000Z"), amount: 1_000_000, status: "PENDING" },
      ],
      items: [
        {
          productId: new Types.ObjectId().toHexString(),
          invoiceNumber: "INV-INSTALL-001",
          sessions: 12,
          invoiceSessions: 12,
          pricePerSession: 250_000,
          amount: 3_000_000,
        },
      ],
      saleId: null,
    };

    const orderModel = {
      findById: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockOrder) }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findOrCreateParentFromOrder: jest.fn().mockResolvedValue(new Types.ObjectId().toHexString()),
    };
    const studentsService = {
      findOrCreateStudentFromOrder: jest.fn().mockResolvedValue({
        studentId: new Types.ObjectId().toHexString(),
        studentCode: "HS-INSTALL",
        isNew: true,
      }),
    };
    const invoiceIds = [
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
    ];
    const invoicesService = {
      createInvoiceForOrder: jest
        .fn()
        .mockResolvedValueOnce(invoiceIds[0])
        .mockResolvedValueOnce(invoiceIds[1])
        .mockResolvedValueOnce(invoiceIds[2]),
    };
    const eventEmitter = { emit: jest.fn() };
    const mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: Function) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const connection = { startSession: jest.fn().mockResolvedValue(mockSession) };

    const service = buildService({
      orderModel: orderModel as any,
      usersService: usersService as any,
      studentsService: studentsService as any,
      invoicesService: invoicesService as any,
      eventEmitter: eventEmitter as any,
      connection: connection as any,
    });

    const result = await service.processApprovedOrder("order-id", approver);

    expect(result.success).toBe(true);
    expect(invoicesService.createInvoiceForOrder).toHaveBeenCalledTimes(3);
    expect(
      invoicesService.createInvoiceForOrder.mock.calls.map((call: any[]) => call[1].paymentRound),
    ).toEqual([1, 2, 3]);
    expect(
      invoicesService.createInvoiceForOrder.mock.calls.map((call: any[]) => call[1].invoiceNumber),
    ).toEqual([
      "INV-INSTALL-001-1",
      "INV-INSTALL-001-2",
      "INV-INSTALL-001-3",
    ]);
    expect(
      invoicesService.createInvoiceForOrder.mock.calls.map((call: any[]) => call[1].amount),
    ).toEqual([1_000_000, 1_000_000, 1_000_000]);
    expect(
      invoicesService.createInvoiceForOrder.mock.calls.map((call: any[]) => call[0].paymentDate.toISOString().slice(0, 10)),
    ).toEqual(["2026-04-11", "2026-05-11", "2026-06-11"]);
  });
});
