import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InvoicesService } from './invoices.service';
import { InvoiceStatus, InvoiceType } from './schemas/invoice.schema';

function buildQueryChain(result: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

function buildService(overrides: Partial<{
  invoiceModel: any;
  studentModel: any;
  classModel: any;
  userModel: any;
  classesService: any;
  walletsService: any;
  connection: any;
}> = {}) {
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
    topUpFromInvoice: jest.fn().mockResolvedValue({ _id: 'ledger-id' }),
    reverseInvoiceTopUp: jest.fn().mockResolvedValue(undefined),
  };
  const connection = overrides.connection ?? {
    startSession: jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    }),
  };

  return new InvoicesService(
    invoiceModel as any,
    studentModel as any,
    classModel as any,
    userModel as any,
    classesService as any,
    walletsService as any,
    connection as any,
  ) as any;
}

describe('InvoicesService approveInvoice', () => {
  it('blocks approval when the sale receipt or counterpart image is missing', async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const service = buildService();
    const findById = jest
      .fn()
      .mockImplementationOnce(() =>
        buildQueryChain({
          _id: invoiceId,
          invoiceNumber: 'INV-COUNTER-001',
          status: InvoiceStatus.PENDING_APPROVAL,
          receiptImage: '',
        }),
      );
    service.invoiceModel.findById = findById;

    await expect(
      service.approveInvoice(
        invoiceId,
        { action: 'APPROVE', approvalImage: '/uploads/invoices/counter.png' } as any,
        { sub: 'director-id', role: 'DIRECTOR' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(service.walletsService.topUpFromInvoice).not.toHaveBeenCalled();
  });

  it('allows approving offline trial invoices with zero amount without proof images', async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const service = buildService();
    const existingInvoice = {
      _id: invoiceId,
      invoiceNumber: 'INV-TRIAL-001',
      status: InvoiceStatus.PENDING_APPROVAL,
      receiptImage: '',
      studentId: new Types.ObjectId(),
      invoiceType: InvoiceType.TUITION,
      sessions: 0,
      bonusSessions: 0,
      trialSessions: 1,
      amount: 0,
      classType: 'OFFLINE',
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
    service.invoiceModel.findOneAndUpdate = jest.fn().mockResolvedValue(approvedInvoice);
    service.connection.startSession = jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    });

    const result = await service.approveInvoice(
      invoiceId,
      { action: 'APPROVE' } as any,
      { sub: new Types.ObjectId().toHexString(), role: 'DIRECTOR' } as any,
    );

    expect(service.walletsService.topUpFromInvoice).not.toHaveBeenCalled();
    expect(service.invoiceModel.findOneAndUpdate).toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.APPROVED);
  });

  it('tops up the parent wallet using the real invoice amount, not a product-derived price', async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const parentId = new Types.ObjectId().toHexString();
    const approvalImage = '/uploads/invoices/counterpart-002.png';
    const invoiceAmount = 1_875_000;
    const service = buildService();
    const existingInvoice = {
      _id: invoiceId,
      invoiceNumber: 'INV-COUNTER-002',
      status: InvoiceStatus.PENDING_APPROVAL,
      receiptImage: '/uploads/invoices/sale-proof-002.png',
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
      approvedBy: new Types.ObjectId('64b5f29f8d6b6d30f2b8d001'),
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
    service.invoiceModel.findOneAndUpdate = jest.fn().mockResolvedValue(approvedInvoice);
    service.invoiceModel.updateOne = jest.fn().mockResolvedValue(undefined);
    service.studentModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ parentUserId: new Types.ObjectId(parentId) }),
    });
    service.connection.startSession = jest.fn().mockResolvedValue({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    });

    const result = await service.approveInvoice(
      invoiceId,
      { action: 'APPROVE', approvalImage } as any,
      {
        sub: '64b5f29f8d6b6d30f2b8d010',
        role: 'DIRECTOR',
        fullName: 'Director',
      } as any,
    );

    expect(service.walletsService.topUpFromInvoice).toHaveBeenCalledTimes(1);
    expect(service.walletsService.topUpFromInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        parentUserId: parentId,
        invoiceId,
        invoiceNumber: 'INV-COUNTER-002',
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

describe('InvoicesService create invoice class link', () => {
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

  it('rejects a linked class that does not contain the student', async () => {
    const invoiceModel = buildCreatableInvoiceModel();
    const classModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          classMode: 'OFFLINE',
          students: [new Types.ObjectId()],
        }),
      }),
    };
    const studentModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          saleId: null,
        }),
      }),
    };
    const service = buildService({
      invoiceModel,
      classModel,
      studentModel,
    });

    await expect(
      service.create(
        {
          invoiceNumber: 'INV-LINK-001',
          studentId: new Types.ObjectId().toHexString(),
          classId: new Types.ObjectId().toHexString(),
          classType: 'OFFLINE',
          amount: 1_500_000,
          paymentDate: '2026-04-01',
          sessions: 10,
        } as any,
        { sub: new Types.ObjectId().toHexString(), role: 'DIRECTOR' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('normalizes classType from the linked class when creating an invoice', async () => {
    const invoiceModel = buildCreatableInvoiceModel();
    const studentId = new Types.ObjectId();
    const classId = new Types.ObjectId();
    const classModel = {
      findById: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: classId,
          classMode: 'ONLINE',
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
        invoiceNumber: 'INV-LINK-002',
        studentId: studentId.toHexString(),
        classId: classId.toHexString(),
        classType: 'ONLINE',
        amount: 2_000_000,
        paymentDate: '2026-04-01',
        sessions: 10,
      } as any,
      { sub: new Types.ObjectId().toHexString(), role: 'DIRECTOR' } as any,
    );

    expect(created.classId?.toString()).toBe(classId.toHexString());
    expect(created.classType).toBe('ONLINE');
  });
});
