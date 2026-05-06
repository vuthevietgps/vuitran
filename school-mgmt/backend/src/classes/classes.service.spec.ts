import { Types } from 'mongoose';
import { ClassesService } from './classes.service';

describe('ClassesService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function buildService() {
    const service = Object.create(ClassesService.prototype) as any;
    service.classModel = jest.fn();
    service.studentModel = {};
    service.invoiceModel = {
      findById: jest.fn(),
      updateOne: jest.fn(),
    };
    service.orderModel = {};
    service.classesCoreService = {
      ensureCodeUnique: jest.fn().mockResolvedValue(undefined),
      hydrateInvoicePricingContext: jest.fn().mockImplementation(async (invoice: any) => invoice),
      validateTeacherForSaleScope: jest.fn().mockResolvedValue(new Types.ObjectId('64b5f29f8d6b6d30f2b8d001')),
      assertStudentsBelongToSale: jest.fn().mockResolvedValue(undefined),
      buildPayload: jest.fn().mockImplementation(async (dto: any) => ({
        ...dto,
        teacher: dto.teacherId,
        students: dto.studentIds || [],
        coTeachers: dto.coTeachers || [],
        baseDuration: dto.baseDuration ?? 60,
        sessionDuration: dto.sessionDuration ?? 60,
        pricePerSession: dto.pricePerSession ?? 0,
        teacherPayPerSession: dto.teacherPayPerSession ?? 0,
        teacherPayPerStudent: dto.teacherPayPerStudent ?? 0,
      })),
      syncOrderProgressForInvoiceIds: jest.fn().mockResolvedValue(undefined),
      triggerStudentSupportSnapshotRefreshForClass: jest.fn(),
      findByIdPopulated: jest.fn(),
      generateAutoClassCode: jest.fn().mockResolvedValue('CLS-AUTO-001'),
      validateTeacherForClassSale: jest.fn().mockResolvedValue(new Types.ObjectId('64b5f29f8d6b6d30f2b8d002')),
      buildClassSourceInvoiceMap: jest.fn().mockResolvedValue(new Map()),
      assertClassAccess: jest.fn().mockResolvedValue(undefined),
      getParentStudentIds: jest.fn().mockResolvedValue([]),
      prepareClassUpdate: jest.fn(),
      applyPreparedClassUpdate: jest.fn(),
      syncTeacherSlotsOnClass: jest.fn(),
    };
    service.classesDataService = {
      syncStudentConfigsOnClass: jest.fn().mockResolvedValue(undefined),
      buildClassHistoryArtifacts: jest.fn().mockResolvedValue({}),
      buildProjectedStudentTotalSessionsMap: jest.fn(),
      withProjectedStudentTotals: jest.fn().mockImplementation(async (classroom: any) => classroom),
    };
    return service;
  }

  it('creates a class through the current core/data service split', async () => {
    const service = buildService();
    const createdClass = {
      _id: new Types.ObjectId('64b5f29f8d6b6d30f2b8d101'),
      code: 'CLS-NEW-001',
    };

    service.classModel.mockImplementation((payload: any) => ({
      save: jest.fn().mockResolvedValue({
        _id: createdClass._id,
        ...payload,
      }),
    }));
    service.classesCoreService.findByIdPopulated.mockResolvedValue(createdClass);

    const result = await service.create(
      {
        name: 'Lop moi',
        code: 'CLS-NEW-001',
        teacherId: '64b5f29f8d6b6d30f2b8d010',
        studentIds: ['64b5f29f8d6b6d30f2b8d011'],
        classMode: 'ONLINE',
        baseDuration: 70,
        sessionDuration: 70,
        pricePerSession: 200000,
        teacherPayPerSession: 80000,
        teacherPayPerStudent: 0,
      } as any,
      { role: 'DIRECTOR', sub: new Types.ObjectId().toHexString() } as any,
    );

    expect(service.classesCoreService.ensureCodeUnique).toHaveBeenCalledWith('CLS-NEW-001');
    expect(service.classesCoreService.buildPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'CLS-NEW-001',
        teacherId: '64b5f29f8d6b6d30f2b8d010',
      }),
    );
    expect(service.classesDataService.syncStudentConfigsOnClass).toHaveBeenCalledWith(
      createdClass._id.toString(),
      expect.any(String),
    );
    expect(service.classesCoreService.triggerStudentSupportSnapshotRefreshForClass).toHaveBeenCalledWith(
      createdClass._id.toString(),
      'createClass',
    );
    expect(result).toBe(createdClass);
  });

  it('keeps co-teacher payloads when creating an offline class', async () => {
    const service = buildService();
    const createdClass = {
      _id: new Types.ObjectId('64b5f29f8d6b6d30f2b8d102'),
      code: 'CLS-CO-001',
      coTeachers: [],
    };

    service.classModel.mockImplementation((payload: any) => ({
      save: jest.fn().mockResolvedValue({
        _id: createdClass._id,
        ...payload,
      }),
    }));
    service.classesCoreService.findByIdPopulated.mockResolvedValue(createdClass);

    await service.create(
      {
        name: 'Lop co teaching',
        code: 'CLS-CO-001',
        teacherId: '64b5f29f8d6b6d30f2b8d010',
        classMode: 'OFFLINE',
        coTeachers: [
          {
            teacherId: '64b5f29f8d6b6d30f2b8d020',
            role: 'SUPPORT',
            canManageAttendance: true,
            canManageReports: true,
            canCreateLink: true,
          },
        ],
      } as any,
      { role: 'DIRECTOR', sub: new Types.ObjectId().toHexString() } as any,
    );

    expect(service.classesCoreService.buildPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        classMode: 'OFFLINE',
        coTeachers: [
          expect.objectContaining({
            teacherId: '64b5f29f8d6b6d30f2b8d020',
            role: 'SUPPORT',
          }),
        ],
      }),
    );
  });

  it('skips auto-placement when only a teacher is requested on approved invoice flow', async () => {
    const service = buildService();
    service.logger = { warn: jest.fn() };

    const result = await service.autoPlaceApprovedInvoice(
      {
        invoiceId: new Types.ObjectId().toHexString(),
        studentId: new Types.ObjectId().toHexString(),
        requestedTeacherId: new Types.ObjectId().toHexString(),
      },
      { role: 'DIRECTOR', sub: new Types.ObjectId().toHexString() } as any,
    );

    expect(result).toEqual({ action: 'SKIPPED' });
    expect(service.logger.warn).toHaveBeenCalled();
    expect(service.classesCoreService.generateAutoClassCode).not.toHaveBeenCalled();
  });

  it('assigns an existing class when requestedClassCode matches a class code', async () => {
    const service = buildService();
    const invoiceId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const matchedClassId = new Types.ObjectId();

    service.invoiceModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: invoiceId,
        classId: null,
        classType: 'ONLINE',
      }),
    });
    service.classModel.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: matchedClassId,
        classMode: 'ONLINE',
      }),
    });
    service.assignStudentsBySale = jest.fn().mockResolvedValue({
      _id: matchedClassId,
    });

    const result = await service.autoPlaceApprovedInvoice(
      {
        invoiceId,
        studentId,
        requestedClassCode: 'cls-online-001',
      },
      { role: 'DIRECTOR', sub: new Types.ObjectId().toHexString() } as any,
    );

    expect(service.classModel.findOne).toHaveBeenCalledWith({ code: 'CLS-ONLINE-001' });
    expect(service.assignStudentsBySale).toHaveBeenCalledWith(
      matchedClassId.toHexString(),
      { studentIds: [studentId], invoiceId },
      expect.any(Object),
    );
    expect(result).toEqual({
      action: 'ASSIGNED_EXISTING',
      classId: matchedClassId.toHexString(),
    });
  });

  it('keeps auto-placement running when the approved invoice is already linked to the requested class', async () => {
    const service = buildService();
    const invoiceId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId().toHexString();

    service.classModel.findById = jest
      .fn()
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: classId,
          classMode: 'OFFLINE',
        }),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: classId,
          classMode: 'OFFLINE',
          students: [],
          maxStudents: 5,
        }),
      });
    service.classModel.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
    service.invoiceModel.findById = jest
      .fn()
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          _id: invoiceId,
          classId: new Types.ObjectId(classId),
          classType: 'OFFLINE',
        }),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: invoiceId,
          status: 'APPROVED',
          classId: new Types.ObjectId(classId),
          classType: 'OFFLINE',
          studentId: new Types.ObjectId(studentId),
        }),
      });
    service.invoiceModel.updateOne = jest.fn().mockResolvedValue(undefined);
    service.studentModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(studentId) }]),
    });
    service.classesCoreService.findByIdPopulated.mockResolvedValue({ _id: classId });

    const result = await service.autoPlaceApprovedInvoice(
      {
        invoiceId,
        studentId,
        requestedClassId: classId,
      },
      { role: 'DIRECTOR', sub: new Types.ObjectId().toHexString() } as any,
    );

    expect(service.classModel.findByIdAndUpdate).toHaveBeenCalledWith(
      classId,
      expect.objectContaining({
        students: [expect.any(Types.ObjectId)],
      }),
    );
    expect(service.invoiceModel.updateOne).toHaveBeenCalledWith(
      { _id: invoiceId },
      { $set: { classId: expect.any(Types.ObjectId) } },
    );
    expect(service.classesDataService.syncStudentConfigsOnClass).toHaveBeenCalledWith(
      classId,
      expect.any(String),
    );
    expect(result).toEqual({
      action: 'ASSIGNED_EXISTING',
      classId,
    });
  });

  it('allows ops to approve a pending duration change requested by sale', async () => {
    const service = buildService();
    const classId = new Types.ObjectId().toHexString();
    const actorId = new Types.ObjectId().toHexString();

    service.classModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: classId,
        pendingSaleUpdate: {
          status: 'PENDING',
          requestType: 'DURATION_CHANGE',
          requestedChanges: {
            baseDuration: 70,
            sessionDuration: 90,
          },
        },
      }),
    });
    service.classesCoreService.prepareClassUpdate.mockResolvedValue({
      update: { baseDuration: 70, sessionDuration: 90 },
      durationSnapshotData: {
        baseDuration: 70,
        sessionDuration: 90,
      },
    });
    service.classesCoreService.applyPreparedClassUpdate.mockResolvedValue(undefined);
    service.classesDataService.buildClassHistoryArtifacts.mockResolvedValue({
      historyEntry: { action: 'APPROVED' },
    });
    service.classesCoreService.findByIdPopulated.mockResolvedValue({ _id: classId });

    const result = await service.approvePendingSaleUpdate(
      classId,
      { role: 'OPS', sub: actorId } as any,
    );

    expect(service.classesCoreService.applyPreparedClassUpdate).toHaveBeenCalledWith(
      classId,
      expect.objectContaining({
        update: expect.objectContaining({
          baseDuration: 70,
          sessionDuration: 90,
        }),
      }),
      'approvePendingSaleUpdate',
      expect.objectContaining({
        clearPendingSaleUpdate: true,
        effectiveById: actorId,
        requestType: 'DURATION_CHANGE',
      }),
    );
    expect(result).toEqual({ _id: classId });
  });

  it('creates a pending offline assignment request when sale adds a student to a shared offline class', async () => {
    const service = buildService();
    const classId = new Types.ObjectId().toHexString();
    const saleId = new Types.ObjectId().toHexString();
    const ownerSaleId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const invoiceId = new Types.ObjectId().toHexString();

    service.classModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: classId,
        classMode: 'OFFLINE',
        sale: new Types.ObjectId(ownerSaleId),
        students: [],
        pendingOfflineAssignments: [],
        maxStudents: 5,
      }),
    });
    service.classModel.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
    service.invoiceModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: invoiceId,
        status: 'APPROVED',
        classId: null,
        classType: 'OFFLINE',
        studentId: new Types.ObjectId(studentId),
        saleId: new Types.ObjectId(saleId),
      }),
    });
    service.studentModel.find = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(studentId) }]),
    });

    const result = await service.assignStudentsBySale(
      classId,
      { studentIds: [studentId], invoiceId } as any,
      { role: 'SALE', sub: saleId } as any,
    );

    expect(service.classModel.findByIdAndUpdate).toHaveBeenCalledWith(
      classId,
      expect.objectContaining({
        $push: {
          pendingOfflineAssignments: expect.objectContaining({
            status: 'PENDING',
            requestedBy: expect.any(Types.ObjectId),
            invoiceId: expect.any(Types.ObjectId),
          }),
        },
      }),
    );
    expect(service.invoiceModel.updateOne).not.toHaveBeenCalled();
    expect(service.classesDataService.syncStudentConfigsOnClass).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        pendingApproval: true,
      }),
    );
  });

  it('approves a pending offline assignment and links the invoice to the class', async () => {
    const service = buildService();
    const classId = new Types.ObjectId().toHexString();
    const requestId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const invoiceId = new Types.ObjectId().toHexString();
    const actorId = new Types.ObjectId().toHexString();

    service.classModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: classId,
        classMode: 'OFFLINE',
        students: [],
        pendingOfflineAssignments: [
          {
            _id: new Types.ObjectId(requestId),
            status: 'PENDING',
            studentIds: [new Types.ObjectId(studentId)],
            invoiceId: new Types.ObjectId(invoiceId),
          },
        ],
        maxStudents: 5,
      }),
    });
    service.classModel.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
    service.invoiceModel.findById = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: invoiceId,
        status: 'APPROVED',
        classId: null,
        classType: 'OFFLINE',
      }),
    });
    service.invoiceModel.updateOne = jest.fn().mockResolvedValue(undefined);
    service.classesCoreService.findByIdPopulated.mockResolvedValue({ _id: classId });

    const result = await service.approvePendingOfflineAssignment(
      classId,
      requestId,
      { role: 'OPS', sub: actorId } as any,
    );

    expect(service.classModel.findByIdAndUpdate).toHaveBeenCalledWith(
      classId,
      expect.objectContaining({
        $set: expect.objectContaining({
          'pendingOfflineAssignments.$[request].status': 'APPROVED',
        }),
      }),
      expect.objectContaining({
        arrayFilters: [{ 'request._id': expect.any(Types.ObjectId) }],
      }),
    );
    expect(service.invoiceModel.updateOne).toHaveBeenCalledWith(
      { _id: invoiceId },
      { $set: { classId: expect.any(Types.ObjectId) } },
    );
    expect(service.classesDataService.syncStudentConfigsOnClass).toHaveBeenCalledWith(classId, actorId);
    expect(service.classesCoreService.triggerStudentSupportSnapshotRefreshForClass).toHaveBeenCalledWith(
      classId,
      'approvePendingOfflineAssignment',
    );
    expect(result).toEqual({ _id: classId });
  });

  it('returns paged class management data instead of loading the full list', async () => {
    const service = buildService();
    const actorId = new Types.ObjectId().toHexString();
    const classRow = {
      _id: new Types.ObjectId('64b5f29f8d6b6d30f2b8d301'),
      code: 'CLS-ON-001',
      name: 'Lop Online 1',
      classMode: 'ONLINE',
      teacher: null,
      sale: null,
      students: [],
      coTeachers: [],
      studentConfigs: [],
      pendingOfflineAssignments: [],
    };

    const queryChain: any = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([classRow]),
    };

    service.classModel.countDocuments = jest.fn().mockResolvedValue(42);
    service.classModel.find = jest.fn().mockReturnValue(queryChain);

    const result = await service.findManagementPage(
      { role: 'DIRECTOR', sub: actorId } as any,
      { page: 2, limit: 10, classMode: 'ONLINE' } as any,
    );

    expect(service.classModel.countDocuments).toHaveBeenCalledWith({ classMode: 'ONLINE' });
    expect(queryChain.skip).toHaveBeenCalledWith(10);
    expect(queryChain.limit).toHaveBeenCalledWith(10);
    expect(service.classesDataService.withProjectedStudentTotals).toHaveBeenCalledWith(classRow);
    expect(result.meta).toEqual({
      total: 42,
      page: 2,
      limit: 10,
      totalPages: 5,
    });
    expect(result.data).toHaveLength(1);
  });
});
