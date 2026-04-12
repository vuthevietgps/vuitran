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
});
