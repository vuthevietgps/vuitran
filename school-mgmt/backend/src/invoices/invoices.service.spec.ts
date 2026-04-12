import { BadRequestException } from "@nestjs/common";
import { Types } from "mongoose";
import { InvoicesService } from "./invoices.service";
import { InvoiceStatus, InvoiceType } from "./schemas/invoice.schema";

jest.mock("../wallets/wallets.service", () => ({
  WalletsService: class WalletsService {},
}));

function buildQueryChain(result: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function buildService(
  overrides: Partial<{
    invoiceModel: any;
    studentModel: any;
    classModel: any;
    userModel: any;
    classesService: any;
    walletsService: any;
    connection: any;
  }> = {},
) {
  const invoiceModel = overrides.invoiceModel ?? {
    findById: jest.fn().mockImplementation(() => buildQueryChain(null)),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const studentModel = overrides.studentModel ?? {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    }),
    updateOne: jest.fn().mockResolvedValue(undefined),
  };
  const classModel = overrides.classModel ?? {};
  const userModel = overrides.userModel ?? {};
  const classesService = overrides.classesService ?? {
    autoPlaceApprovedInvoice: jest.fn().mockResolvedValue(undefined),
  };
  const walletsService = overrides.walletsService ?? {
    topUpFromInvoice: jest.fn().mockResolvedValue({ _id: "ledger-id" }),
    reverseInvoiceTopUp: jest.fn().mockResolvedValue(undefined),
  };
  const connection = overrides.connection ?? {
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      inTransaction: jest.fn().mockReturnValue(true),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
  };

  const service = new InvoicesService(
    invoiceModel as any,
    studentModel as any,
    classModel as any,
    userModel as any,
    classesService as any,
    walletsService as any,
    connection as any,
  ) as any;

  // Expose sub-service internals for test assertions
  service.walletsService = walletsService;

  return service;
}

describe("InvoicesService approveInvoice", () => {
  it("blocks approval when the sale receipt or counterpart image is missing", async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const service = buildService();
    const findById = jest.fn().mockImplementationOnce(() =>
      buildQueryChain({
        _id: invoiceId,
        invoiceNumber: "INV-COUNTER-001",
        status: InvoiceStatus.PENDING_APPROVAL,
        receiptImage: "",
      }),
    );
    service.invoiceModel.findById = findById;

    await expect(
      service.approveInvoice(
        invoiceId,
        {
          action: "APPROVE",
          approvalImage: "/uploads/invoices/counter.png",
        } as any,
        { sub: "director-id", role: "DIRECTOR" } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(service.walletsService.topUpFromInvoice).not.toHaveBeenCalled();
  });

  it("allows approving offline trial invoices with zero amount when proof images exist", async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const service = buildService();
    const existingInvoice = {
      _id: invoiceId,
      invoiceNumber: "INV-TRIAL-001",
      status: InvoiceStatus.PENDING_APPROVAL,
      receiptImage: "/uploads/invoices/sale-proof-trial.png",
      studentId: new Types.ObjectId(),
      invoiceType: InvoiceType.TUITION,
      sessions: 0,
      bonusSessions: 0,
      trialSessions: 1,
      amount: 0,
      classType: "OFFLINE",
      classId: null,
      requestedClassId: null,
      requestedTeacherId: null,
    };
    const approvedInvoice = {
      ...existingInvoice,
      status: InvoiceStatus.APPROVED,
      approvedBy: new Types.ObjectId(),
      approvedAt: new Date(),
      toObject() {
        return this;
      },
    };
    service.invoiceModel.findById = jest
      .fn()
      .mockImplementationOnce(() => buildQueryChain(existingInvoice))
      .mockImplementationOnce(() => buildQueryChain(approvedInvoice));
    service.invoiceModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue(approvedInvoice);
    service.connection.startSession = jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    });

    const result = await service.approveInvoice(
      invoiceId,
      { action: "APPROVE", approvalImage: "/uploads/invoices/counter.png" } as any,
      { sub: new Types.ObjectId().toHexString(), role: "DIRECTOR" } as any,
    );

    expect(service.walletsService.topUpFromInvoice).not.toHaveBeenCalled();
    expect(service.invoiceModel.findOneAndUpdate).toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.APPROVED);
  });

  it("allows approving offline trial invoices with zero amount without any proof images", async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const service = buildService();
    const existingInvoice = {
      _id: invoiceId,
      invoiceNumber: "INV-TRIAL-002",
      status: InvoiceStatus.PENDING_APPROVAL,
      receiptImage: "",
      studentId: new Types.ObjectId(),
      invoiceType: InvoiceType.TUITION,
      sessions: 0,
      bonusSessions: 0,
      trialSessions: 1,
      amount: 0,
      classType: "OFFLINE",
      classId: null,
      requestedClassId: null,
      requestedTeacherId: null,
    };
    const approvedInvoice = {
      ...existingInvoice,
      status: InvoiceStatus.APPROVED,
      approvedBy: new Types.ObjectId(),
      approvedAt: new Date(),
      toObject() {
        return this;
      },
    };
    service.invoiceModel.findById = jest
      .fn()
      .mockImplementationOnce(() => buildQueryChain(existingInvoice))
      .mockImplementationOnce(() => buildQueryChain(approvedInvoice));
    service.invoiceModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue(approvedInvoice);
    service.connection.startSession = jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    });

    const result = await service.approveInvoice(
      invoiceId,
      { action: "APPROVE" } as any,
      { sub: new Types.ObjectId().toHexString(), role: "DIRECTOR" } as any,
    );

    expect(service.walletsService.topUpFromInvoice).not.toHaveBeenCalled();
    expect(service.invoiceModel.findOneAndUpdate).toHaveBeenCalled();
    expect(service.invoiceModel.findOneAndUpdate.mock.calls[0][1][0].$set).not.toHaveProperty(
      "approvalImage",
    );
    expect(result.status).toBe(InvoiceStatus.APPROVED);
  });

  it("tops up the parent wallet using the real invoice amount, not a product-derived price", async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const parentId = new Types.ObjectId().toHexString();
    const approvalImage = "/uploads/invoices/counterpart-002.png";
    const invoiceAmount = 1_875_000;
    const service = buildService();
    const existingInvoice = {
      _id: invoiceId,
      invoiceNumber: "INV-COUNTER-002",
      status: InvoiceStatus.PENDING_APPROVAL,
      receiptImage: "/uploads/invoices/sale-proof-002.png",
      studentId: new Types.ObjectId(studentId),
      invoiceType: InvoiceType.TUITION,
      sessions: 12,
      bonusSessions: 0,
      trialSessions: 0,
      classId: null,
      requestedClassId: null,
      requestedTeacherId: null,
    };
    const approvedInvoice = {
      ...existingInvoice,
      status: InvoiceStatus.APPROVED,
      approvedBy: new Types.ObjectId("64b5f29f8d6b6d30f2b8d001"),
      approvedAt: new Date(),
      approvalImage,
      amount: invoiceAmount,
      toObject() {
        return this;
      },
    };
    const finalInvoice = {
      ...approvedInvoice,
      walletTopUpDone: true,
    };
    service.invoiceModel.findById = jest
      .fn()
      .mockImplementationOnce(() => buildQueryChain(existingInvoice))
      .mockImplementationOnce(() => buildQueryChain(finalInvoice));
    service.invoiceModel.findOneAndUpdate = jest
      .fn()
      .mockResolvedValue(approvedInvoice);
    service.invoiceModel.updateOne = jest.fn().mockResolvedValue(undefined);
    service.studentModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockReturnThis(),
      lean: jest
        .fn()
        .mockResolvedValue({ parentUserId: new Types.ObjectId(parentId) }),
    });
    service.connection.startSession = jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    });

    const result = await service.approveInvoice(
      invoiceId,
      { action: "APPROVE", approvalImage } as any,
      {
        sub: "64b5f29f8d6b6d30f2b8d010",
        role: "DIRECTOR",
        fullName: "Director",
      } as any,
    );

    expect(service.walletsService.topUpFromInvoice).toHaveBeenCalledTimes(1);
    expect(service.walletsService.topUpFromInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        parentUserId: parentId,
        invoiceId,
        invoiceNumber: "INV-COUNTER-002",
        amount: invoiceAmount,
        studentId,
      }),
      expect.objectContaining({ session: expect.any(Object) }),
    );
    expect(service.invoiceModel.updateOne).toHaveBeenCalledWith(
      { _id: approvedInvoice._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          walletTopUpDone: true,
        }),
      }),
      expect.any(Object),
    );
    expect(result.status).toBe(InvoiceStatus.APPROVED);
    expect(result.approvalImage).toBe(approvalImage);
  });
});

describe("InvoicesService cancelInvoice", () => {
  it("blocks rollback when the invoice is financially locked", async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const service = buildService();
    const findById = jest.fn().mockImplementationOnce(() =>
      buildQueryChain({
        _id: invoiceId,
        invoiceNumber: "INV-PAID-001",
        status: InvoiceStatus.PAID,
        walletTopUpDone: true,
      }),
    );
    service.invoiceModel.findById = findById;

    await expect(
      service.cancelInvoice(
        invoiceId,
        { sub: "director-id", role: "DIRECTOR" } as any,
        "Need clawback",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(service.walletsService.reverseInvoiceTopUp).not.toHaveBeenCalled();
  });
});

describe("InvoicesService create invoice class link", () => {
  function buildCreatableInvoiceModel() {
    const InvoiceModel: any = function InvoiceModel(this: any, payload: any) {
      Object.assign(this, payload);
      this.save = jest.fn().mockResolvedValue(this);
    };
    InvoiceModel.findById = jest.fn();
    InvoiceModel.findOne = jest.fn().mockResolvedValue(null);
    InvoiceModel.countDocuments = jest.fn().mockResolvedValue(0);
    return InvoiceModel;
  }

  it("normalizes classType from the linked class when creating an invoice", async () => {
    const invoiceModel = buildCreatableInvoiceModel();
    const studentId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const classModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: classId,
          classMode: "ONLINE",
          students: [studentId],
          pricePerSession: 200000,
          baseDuration: 70,
          sessionDuration: 70,
        }),
      }),
    };
    const studentModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: studentId,
          saleId: null,
        }),
      }),
    };
    const service = buildService({
      invoiceModel,
      classModel,
      studentModel,
    });

    const created = await service.create(
      {
        invoiceNumber: "INV-LINK-002",
        studentId: studentId.toHexString(),
        classId: classId.toHexString(),
        classType: "ONLINE",
        amount: 2_000_000,
        paymentDate: "2026-04-01",
        sessions: 10,
      } as any,
      { sub: new Types.ObjectId().toHexString(), role: "DIRECTOR" } as any,
    );

    expect(created.classId?.toString()).toBe(classId.toHexString());
    expect(created.classType).toBe("ONLINE");
  });
});

describe("InvoicesService createInvoiceForOrder", () => {
  function buildOrderInvoiceModel() {
    const InvoiceModel: any = jest
      .fn()
      .mockImplementation(function InvoiceModel(this: any, payload: any) {
        Object.assign(this, payload);
        this.save = jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          ...payload,
        });
      });

    const buildFindOneChain = (result: any) => ({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    });

    InvoiceModel.findOne = jest
      .fn()
      .mockImplementation(() => buildFindOneChain(null));
    InvoiceModel.countDocuments = jest.fn().mockResolvedValue(0);
    return InvoiceModel;
  }

  it("applies order-level final amount and sale commission distribution for a single item", async () => {
    const invoiceModel = buildOrderInvoiceModel();
    const service = buildService({ invoiceModel }) as any;

    await service.createInvoiceForOrder(
      {
        _id: new Types.ObjectId(),
        orderCode: "ORD-2026-0003",
        finalAmount: 1_500_000,
        totalAmount: 1_600_000,
        discountAmount: 100_000,
        saleCommission: 150_000,
        saleId: new Types.ObjectId(),
        items: [
          {
            productName: "Goi hoc",
            sessions: 8,
            sessionDuration: 90,
            baseDuration: 70,
            pricePerSession: 200_000,
            amount: 1_600_000,
            paymentRound: 1,
          },
        ],
      },
      {
        productName: "Goi hoc",
        sessions: 8,
        sessionDuration: 90,
        baseDuration: 70,
        pricePerSession: 200_000,
        amount: 1_600_000,
        paymentRound: 1,
      },
      new Types.ObjectId().toHexString(),
      { _id: new Types.ObjectId().toHexString() } as any,
    );

    expect(invoiceModel).toHaveBeenCalledTimes(1);
    expect(invoiceModel.mock.calls[0][0].amount).toBe(1_500_000);
    expect(invoiceModel.mock.calls[0][0].saleCommission).toBe(150_000);
  });

  it("preserves explicit zero amount and zero sessions for offline trial invoices", async () => {
    const invoiceModel = buildOrderInvoiceModel();
    const service = buildService({ invoiceModel }) as any;

    await service.createInvoiceForOrder(
      {
        _id: new Types.ObjectId(),
        orderCode: "ORD-2026-TRIAL-001",
        orderType: "NEW_ENROLLMENT",
        finalAmount: 0,
        totalAmount: 0,
        items: [
          {
            productName: "Hoc thu offline",
            sessions: 8,
            invoiceSessions: 0,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 200_000,
            amount: 0,
            trialSessions: 1,
            teachingMode: "OFFLINE",
          },
        ],
      },
      {
        productName: "Hoc thu offline",
        sessions: 8,
        invoiceSessions: 0,
        sessionDuration: 90,
        baseDuration: 90,
        pricePerSession: 200_000,
        amount: 0,
        trialSessions: 1,
        teachingMode: "OFFLINE",
      },
      new Types.ObjectId().toHexString(),
      { _id: new Types.ObjectId().toHexString() } as any,
    );

    expect(invoiceModel).toHaveBeenCalledTimes(1);
    expect(invoiceModel.mock.calls[0][0].amount).toBe(0);
    expect(invoiceModel.mock.calls[0][0].sessions).toBe(0);
    expect(invoiceModel.mock.calls[0][0].sessionsRemaining).toBe(0);
    expect(invoiceModel.mock.calls[0][0].trialSessions).toBe(1);
    expect(invoiceModel.mock.calls[0][0].classType).toBe("OFFLINE");
  });

  it("persists the create-new-class request from the order item onto the invoice", async () => {
    const invoiceModel = buildOrderInvoiceModel();
    const service = buildService({ invoiceModel }) as any;

    await service.createInvoiceForOrder(
      {
        _id: new Types.ObjectId(),
        orderCode: "ORD-2026-NEWCLASS-001",
        orderType: "NEW_ENROLLMENT",
        finalAmount: 1_600_000,
        totalAmount: 1_600_000,
        items: [
          {
            productName: "Offline moi",
            sessions: 8,
            invoiceSessions: 8,
            sessionDuration: 90,
            baseDuration: 90,
            pricePerSession: 200_000,
            amount: 1_600_000,
            teachingMode: "OFFLINE",
            createNewClassWhenApproved: true,
            preferredTeacherId: new Types.ObjectId().toHexString(),
          },
        ],
      },
      {
        productName: "Offline moi",
        sessions: 8,
        invoiceSessions: 8,
        sessionDuration: 90,
        baseDuration: 90,
        pricePerSession: 200_000,
        amount: 1_600_000,
        teachingMode: "OFFLINE",
        createNewClassWhenApproved: true,
        preferredTeacherId: new Types.ObjectId().toHexString(),
      },
      new Types.ObjectId().toHexString(),
      { _id: new Types.ObjectId().toHexString() } as any,
    );

    expect(invoiceModel.mock.calls[0][0].createNewClassWhenApproved).toBe(true);
  });

  it("creates one invoice with the expected metadata for a single-item order", async () => {
    const invoiceModel = buildOrderInvoiceModel();
    const service = buildService({ invoiceModel }) as any;
    const orderId = new Types.ObjectId();
    const studentId = new Types.ObjectId().toHexString();
    const saleId = new Types.ObjectId();
    const item = {
      productId: new Types.ObjectId(),
      productName: "Goi hoc 1",
      sessions: 8,
      sessionDuration: 90,
      baseDuration: 70,
      pricePerSession: 200_000,
      amount: 1_600_000,
      teachingMode: "ONLINE",
    };
    const order = {
      _id: orderId,
      orderCode: "ORD-2026-0101",
      orderType: "NEW_ENROLLMENT",
      finalAmount: 1_600_000,
      totalAmount: 1_600_000,
      saleCommission: 150_000,
      saleId,
      items: [item],
    };

    await service.createInvoiceForOrder(order, item, studentId, {
      _id: new Types.ObjectId().toHexString(),
      role: "DIRECTOR",
    } as any);

    expect(invoiceModel).toHaveBeenCalledTimes(1);
    const payload = invoiceModel.mock.calls[0][0];
    expect(payload.orderId.toString()).toBe(orderId.toString());
    expect(payload.studentId.toString()).toBe(studentId);
    expect(payload.orderItemIndex).toBe(0);
    expect(payload.amount).toBe(1_600_000);
    expect(payload.sessions).toBe(8);
    expect(payload.sessionsRemaining).toBe(8);
    expect(payload.classType).toBe("ONLINE");
    expect(payload.courseStatus).toBe("NEW");
    expect(payload.saleCommission).toBe(150_000);
  });

  it("creates invoices for a combo order with orderItemIndex 0..2", async () => {
    const invoiceModel = buildOrderInvoiceModel();
    const service = buildService({ invoiceModel }) as any;
    const orderId = new Types.ObjectId();
    const studentId = new Types.ObjectId().toHexString();
    const items = [
      {
        productId: new Types.ObjectId(),
        productName: "Combo A",
        sessions: 4,
        sessionDuration: 90,
        baseDuration: 90,
        pricePerSession: 150_000,
        amount: 600_000,
      },
      {
        productId: new Types.ObjectId(),
        productName: "Combo B",
        sessions: 6,
        sessionDuration: 90,
        baseDuration: 90,
        pricePerSession: 120_000,
        amount: 720_000,
      },
      {
        productId: new Types.ObjectId(),
        productName: "Combo C",
        sessions: 10,
        sessionDuration: 90,
        baseDuration: 90,
        pricePerSession: 100_000,
        amount: 1_000_000,
      },
    ];
    const order = {
      _id: orderId,
      orderCode: "ORD-2026-COMBO-001",
      orderType: "NEW_ENROLLMENT",
      finalAmount: 2_320_000,
      totalAmount: 2_320_000,
      saleCommission: 230_000,
      saleId: new Types.ObjectId(),
      items,
    };

    for (const item of items) {
      await service.createInvoiceForOrder(order, item, studentId, {
        _id: new Types.ObjectId().toHexString(),
        role: "DIRECTOR",
      } as any);
    }

    expect(invoiceModel).toHaveBeenCalledTimes(3);
    expect(invoiceModel.mock.calls.map((call: any[]) => call[0].orderItemIndex)).toEqual([
      0,
      1,
      2,
    ]);
    expect(invoiceModel.mock.calls.map((call: any[]) => call[0].productName)).toEqual([
      "Combo A",
      "Combo B",
      "Combo C",
    ]);
  });

  it("uses paymentRound 3 when the student already has two active invoices", async () => {
    const invoiceModel = buildOrderInvoiceModel();
    invoiceModel.countDocuments = jest.fn().mockResolvedValue(2);
    const service = buildService({ invoiceModel }) as any;
    const studentId = new Types.ObjectId().toHexString();
    const item = {
      productId: new Types.ObjectId(),
      productName: "Goi hoc",
      sessions: 8,
      sessionDuration: 90,
      baseDuration: 90,
      pricePerSession: 200_000,
      amount: 1_600_000,
    };
    const order = {
      _id: new Types.ObjectId(),
      orderCode: "ORD-2026-0103",
      orderType: "RENEWAL",
      finalAmount: 1_600_000,
      totalAmount: 1_600_000,
      saleCommission: 0,
      saleId: new Types.ObjectId(),
      items: [item],
    };

    await service.createInvoiceForOrder(order, item, studentId, {
      _id: new Types.ObjectId().toHexString(),
      role: "DIRECTOR",
    } as any);

    expect(invoiceModel.countDocuments).toHaveBeenCalledWith({
      studentId: new Types.ObjectId(studentId),
      status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
    });
    expect(invoiceModel.mock.calls[0][0].paymentRound).toBe(3);
    expect(invoiceModel.mock.calls[0][0].courseStatus).toBe(
      "CONTINUE_2",
    );
  });
});
