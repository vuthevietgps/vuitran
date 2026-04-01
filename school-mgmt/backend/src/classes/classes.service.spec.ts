import { Types } from 'mongoose';
import { ClassesService } from './classes.service';
import { getClassPricingConfigAt } from './student-config.utils';

describe('ClassesService duration rounding', () => {
  it('floors previewed remaining sessions to whole numbers when changing class duration', async () => {
    const studentId = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;

    service.buildStudentCompletedSessionMap = jest
      .fn()
      .mockResolvedValue(new Map([[studentId, 2]]));
    service.buildStudentRemainingAllowanceMap = jest.fn().mockResolvedValue(
      new Map([
        [
          studentId,
          {
            paidRemainingMinutes: 190,
            bonusRemainingMinutes: 95,
            totalRemainingMinutes: 285,
          },
        ],
      ]),
    );
    service.studentModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new Types.ObjectId(studentId),
              fullName: 'Hoc sinh A',
              studentCode: 'HS001',
            },
          ]),
        }),
      }),
    };

    const preview = await service.buildClassDurationPreview(
      {
        students: [studentId],
        baseDuration: 70,
        sessionDuration: 70,
        studentConfigs: [
          {
            studentId,
            durationSlots: [
              {
                slotIndex: 1,
                baseDuration: 70,
                sessionDuration: 70,
                totalSessions: 10,
              },
            ],
          },
        ],
      },
      70,
      90,
    );

    expect(preview.students[0]).toMatchObject({
      paidSessionsRemainingBefore: 2,
      bonusSessionsRemainingBefore: 1,
      totalSessionsRemainingBefore: 4,
      paidSessionsRemainingAfter: 2,
      bonusSessionsRemainingAfter: 1,
      totalSessionsRemainingAfter: 3,
      projectedTotalSessionsBefore: 6,
      projectedTotalSessionsAfter: 5,
    });
  });

  it('floors projected total sessions when persisting duration changes', async () => {
    const studentA = new Types.ObjectId().toHexString();
    const studentB = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;

    service.buildStudentCompletedSessionMap = jest.fn().mockResolvedValue(
      new Map([
        [studentA, 4],
        [studentB, 0],
      ]),
    );
    service.buildStudentRemainingMinutesMap = jest.fn().mockResolvedValue(
      new Map([
        [studentA, 255],
        [studentB, 0],
      ]),
    );

    const totalSessionsMap = await service.buildProjectedStudentTotalSessionsMap(
      {
        totalSessions: 9.8,
        studentConfigs: [
          {
            studentId: studentA,
            durationSlots: [
              {
                slotIndex: 1,
                baseDuration: 70,
                sessionDuration: 70,
                totalSessions: 10,
              },
            ],
          },
          {
            studentId: studentB,
            durationSlots: [
              {
                slotIndex: 1,
                baseDuration: 70,
                sessionDuration: 70,
                totalSessions: 7.8,
              },
            ],
          },
        ],
      },
      [studentA, studentB],
      new Map([[studentA, 90]]),
    );

    expect(totalSessionsMap.get(studentA)).toBe(6);
    expect(totalSessionsMap.get(studentB)).toBe(7);
  });
});

describe('ClassesService manual class code handling', () => {
  it('keeps the provided code unchanged when creating a class from an approved invoice', async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const teacherId = new Types.ObjectId().toHexString();
    const saleId = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;

    service.ensureCodeUnique = jest.fn().mockResolvedValue(undefined);
    service.buildPayload = jest.fn().mockImplementation(async (dto: any) => ({
      ...dto,
      code: dto.code,
    }));
    service.applyInvoicePricingDefaults = jest.fn();
    service.attachPricingSnapshot = jest.fn();
    service.buildDurationSnapshotRecord = jest.fn().mockReturnValue({ source: 'INITIAL' });
    service.syncOrderProgressForInvoiceIds = jest.fn().mockResolvedValue(undefined);
    service.syncStudentConfigsOnClass = jest.fn().mockResolvedValue(undefined);
    service.triggerStudentSupportSnapshotRefreshForClass = jest.fn();
    service.findByIdPopulated = jest.fn().mockResolvedValue({
      _id: invoiceId,
      code: 'CLS-MANUAL-001',
    });
    service.invoiceModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: invoiceId,
          status: 'APPROVED',
          studentId: new Types.ObjectId(studentId),
          classType: 'OFFLINE',
          productId: new Types.ObjectId(),
          saleId: new Types.ObjectId(saleId),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    service.studentModel = {
      find: jest.fn(),
    };
    service.classModel = jest.fn().mockImplementation((payload: any) => ({
      save: jest.fn().mockResolvedValue({
        _id: invoiceId,
        ...payload,
      }),
    }));

    const result = await service.create(
      {
        name: 'Lop nhap tay',
        code: 'CLS-MANUAL-001',
        teacherId,
        invoiceId,
        classMode: 'OFFLINE',
        studentIds: [studentId],
      },
      { role: 'DIRECTOR', sub: 'director-id' } as any,
    );

    expect(service.ensureCodeUnique).toHaveBeenCalledWith('CLS-MANUAL-001');
    expect(service.buildPayload).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'CLS-MANUAL-001', invoiceId }),
    );
    expect(service.classModel).toHaveBeenCalledTimes(1);
    expect(result.code).toBe('CLS-MANUAL-001');
  });

  it('does not auto-create a class when only a teacher is requested on invoice approval', async () => {
    const service = Object.create(ClassesService.prototype) as any;
    service.logger = { warn: jest.fn() };

    const result = await service.autoPlaceApprovedInvoice(
      {
        invoiceId: new Types.ObjectId().toHexString(),
        studentId: new Types.ObjectId().toHexString(),
        requestedTeacherId: new Types.ObjectId().toHexString(),
      },
      { role: 'DIRECTOR', sub: 'director-id' } as any,
    );

    expect(result).toEqual({ action: 'SKIPPED' });
    expect(service.logger.warn).toHaveBeenCalled();
  });
});

describe('ClassesService pricing display fallback', () => {
  it('prefers current class durations and linked invoice teacher pay over stale snapshot values', () => {
    const service = Object.create(ClassesService.prototype) as any;

    const summary = service.buildClassFinancialSummary(
      {
        classMode: 'ONLINE',
        students: [{ _id: new Types.ObjectId() }],
        pricePerSession: 163000,
        teacherPayPerSession: 0,
        baseDuration: 70,
        sessionDuration: 60,
        pricingSnapshot: {
          referenceDuration: 60,
          sessionDuration: 60,
          pricePerSession: 163000,
          teacherPayPerSession: 0,
        },
      },
      {
        teacherPayPerSession: 92000,
        referenceDuration: 70,
      },
    );

    expect(summary.actualPricePerSession).toBe(140000);
    expect(summary.actualTeacherPayPerSession).toBe(78000);
  });

  it('prefers current class fields over stale pricing snapshot when resolving class pricing config', () => {
    const config = getClassPricingConfigAt({
      pricePerSession: 163000,
      teacherPayPerSession: 92000,
      baseDuration: 70,
      sessionDuration: 60,
      pricingSnapshot: {
        referenceDuration: 60,
        sessionDuration: 60,
        pricePerSession: 163000,
        teacherPayPerSession: 0,
      },
    });

    expect(config).toMatchObject({
      pricePerSession: 163000,
      teacherPayPerSession: 92000,
      baseDuration: 70,
      sessionDuration: 60,
    });
  });

  it('hydrates linked invoice teacher pay from order item when invoice data is missing it', async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const orderId = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;

    service.invoiceModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new Types.ObjectId(invoiceId),
              invoiceNumber: 'PT303',
              orderId: new Types.ObjectId(orderId),
              orderItemIndex: 0,
              pricePerSession: 162500,
              referenceDuration: 70,
              teacherPayPerSession: 0,
            },
          ]),
        }),
      }),
    };
    service.orderModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: new Types.ObjectId(orderId),
              items: [
                {
                  invoiceNumber: 'PT303',
                  pricePerSession: 162500,
                  baseDuration: 70,
                  sessionDuration: 70,
                  teacherPayPerSession: 80000,
                },
              ],
            },
          ]),
        }),
      }),
    };

    const sourceMap = await service.buildClassSourceInvoiceMap([
      { invoiceId: new Types.ObjectId(invoiceId) },
    ]);
    const sourceInvoice = sourceMap.get(invoiceId);

    expect(sourceInvoice).toMatchObject({
      pricePerSession: 163000,
      referenceDuration: 70,
      teacherPayPerSession: 80000,
    });
  });
});

describe('ClassesService sale ownership rules', () => {
  it('validates the sale-owned teacher and students before a sale creates a class', async () => {
    const invoiceId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const teacherId = new Types.ObjectId().toHexString();
    const saleId = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;

    service.ensureCodeUnique = jest.fn().mockResolvedValue(undefined);
    service.validateTeacherForSaleScope = jest.fn().mockResolvedValue(new Types.ObjectId(teacherId));
    service.assertStudentsBelongToSale = jest.fn().mockResolvedValue(undefined);
    service.buildPayload = jest.fn().mockResolvedValue({
      name: 'Lop sale',
      code: 'CLS-SALE-OWNED',
      teacher: new Types.ObjectId(teacherId),
      sale: new Types.ObjectId(saleId),
      students: [new Types.ObjectId(studentId)],
    });
    service.applyInvoicePricingDefaults = jest.fn();
    service.attachPricingSnapshot = jest.fn();
    service.buildDurationSnapshotRecord = jest.fn().mockReturnValue({ source: 'INITIAL' });
    service.syncOrderProgressForInvoiceIds = jest.fn().mockResolvedValue(undefined);
    service.syncStudentConfigsOnClass = jest.fn().mockResolvedValue(undefined);
    service.triggerStudentSupportSnapshotRefreshForClass = jest.fn();
    service.findByIdPopulated = jest.fn().mockResolvedValue({ _id: invoiceId });
    service.invoiceModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: invoiceId,
          status: 'APPROVED',
          studentId: new Types.ObjectId(studentId),
          classType: 'ONLINE',
          productId: new Types.ObjectId(),
          saleId: new Types.ObjectId(saleId),
        }),
      }),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    service.classModel = jest.fn().mockImplementation((payload: any) => ({
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        ...payload,
      }),
    }));

    await service.create(
      {
        name: 'Lop sale',
        code: 'CLS-SALE-OWNED',
        teacherId,
        invoiceId,
        studentIds: [studentId],
      },
      { role: 'SALE', sub: saleId } as any,
    );

    expect(service.validateTeacherForSaleScope).toHaveBeenCalledWith(teacherId, saleId);
    expect(service.assertStudentsBelongToSale).toHaveBeenCalledWith([studentId], saleId);
  });

  it('only returns offline classes that already belong to the sale', async () => {
    const saleId = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;
    const query = {
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    service.classModel = {
      find: jest.fn().mockReturnValue(query),
    };

    await service.findSaleOfflineOptions({ role: 'SALE', sub: saleId } as any);

    const filter = service.classModel.find.mock.calls[0][0];
    expect(String(filter.sale)).toBe(saleId);
    expect(filter.$and).toBeUndefined();
    expect(filter.$or).toEqual([
      { invoiceId: { $exists: false } },
      { invoiceId: null },
    ]);
  });

  it('forbids a sale from assigning students into an unowned offline class', async () => {
    const saleId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId().toHexString();
    const service = Object.create(ClassesService.prototype) as any;

    service.classModel = {
      findById: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(classId),
          classMode: 'OFFLINE',
          sale: null,
        }),
      }),
    };

    await expect(
      service.assignStudentsBySale(
        classId,
        { studentIds: [new Types.ObjectId().toHexString()] },
        { role: 'SALE', sub: saleId } as any,
      ),
    ).rejects.toThrow();
  });
});
