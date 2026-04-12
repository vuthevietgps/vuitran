import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

type QueryChainResult = {
  session: jest.Mock;
  select: jest.Mock;
  sort: jest.Mock;
  lean: jest.Mock;
};

function buildQueryChain(result: any): QueryChainResult {
  const chain: Partial<QueryChainResult> = {};
  chain.session = jest.fn().mockReturnThis();
  chain.select = jest.fn().mockReturnThis();
  chain.sort = jest.fn().mockReturnThis();
  chain.lean = jest.fn().mockReturnThis();
  const promise = Promise.resolve(result);
  (chain as any).then = promise.then.bind(promise);
  (chain as any).catch = promise.catch.bind(promise);
  return chain as QueryChainResult;
}

function buildUserModel() {
  const UserModel: any = jest.fn().mockImplementation((payload: any) => {
    const savedId = payload._id ?? new Types.ObjectId();
    const doc = {
      ...payload,
      _id: savedId,
      save: jest.fn().mockImplementation(async () => ({
        _id: savedId,
        ...payload,
        toObject: () => ({
          _id: savedId,
          ...payload,
        }),
      })),
    };
    return doc;
  });

  UserModel.findById = jest.fn();
  UserModel.findOne = jest.fn();
  UserModel.find = jest.fn();
  UserModel.findByIdAndUpdate = jest.fn();
  UserModel.deleteOne = jest.fn();

  return UserModel;
}

function buildService(overrides: Partial<{
  userModel: any;
  studentModel: any;
  teacherProfileModel: any;
  parentAttributionModel: any;
  adGroupModel: any;
  marketingAttributionService: any;
  salaryConfigService: any;
}> = {}) {
  const userModel = overrides.userModel ?? buildUserModel();
  const studentModel = overrides.studentModel ?? ({} as any);
  const teacherProfileModel =
    overrides.teacherProfileModel ??
    ({
      create: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    } as any);
  const parentAttributionModel = overrides.parentAttributionModel ?? ({} as any);
  const adGroupModel = overrides.adGroupModel ?? ({} as any);
  const marketingAttributionService =
    overrides.marketingAttributionService ??
    ({
        upsertParentAttribution: jest.fn().mockResolvedValue(undefined),
      } as any);
  const salaryConfigService =
    overrides.salaryConfigService ??
    ({
      create: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    } as any);

  const { UsersParentOrderService } = require('./users-parent-order.service');
  const { UsersAdsService } = require('./users-ads.service');

  const parentOrderService = new UsersParentOrderService(userModel as any);
  const adsService = new UsersAdsService(
    userModel as any,
    studentModel as any,
    parentAttributionModel as any,
    adGroupModel as any,
    marketingAttributionService as any,
  );

  return new UsersService(
    userModel as any,
    studentModel as any,
    teacherProfileModel as any,
    parentOrderService as any,
    adsService as any,
    salaryConfigService as any,
  );
}

describe('UsersService.findOrCreateParentFromOrder', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  it('PAR-01 syncs an existing parent by parentUserId', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const service = buildService();
    const userModel = (service as any).userModel;
    const session = { id: 'session-1' };
    const parentLookup = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      role: Role.PARENT,
    });
    const parentDoc = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      fullName: 'Phu huynh cu',
      email: 'parent@school.local',
      phone: '',
      userCode: 'PH0001',
      saleOwnerId: null,
      address: null,
      facebookLink: null,
    });
    userModel.findById
      .mockReturnValueOnce(parentLookup)
      .mockReturnValueOnce(parentDoc);
    userModel.findOne.mockImplementation((filter: any) => {
      if (filter?.email === 'parent.new@example.com') {
        return buildQueryChain(null);
      }
      return buildQueryChain(null);
    });

    const result = await service.findOrCreateParentFromOrder(
      {
        parentUserId,
        parentName: 'Nguyen Van A',
        parentEmail: 'parent.new@example.com',
        parentPhone: '0901234567',
        parentAddress: 'HCMC',
        parentFacebookLink: 'fb.com/parent',
        saleId: new Types.ObjectId().toHexString(),
        saleName: 'Sale A',
      },
      session as any,
    );

    expect(result).toBe(parentUserId);
    expect(parentLookup.session).toHaveBeenCalledWith(session);
    expect(parentDoc.session).toHaveBeenCalledWith(session);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      new Types.ObjectId(parentUserId),
      expect.objectContaining({
        email: 'parent.new@example.com',
        fullName: 'Nguyen Van A',
        phone: '0901234567',
        address: 'HCMC',
        facebookLink: 'fb.com/parent',
      }),
      { session },
    );
  });

  it('PAR-02 resolves by parentUserCode and syncs the record', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const service = buildService();
    const userModel = (service as any).userModel;
    const session = { id: 'session-2' };
    const codeLookup = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      role: Role.PARENT,
    });
    const parentDoc = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      fullName: 'Phu huynh cu',
      email: 'parent@school.local',
      phone: '',
      userCode: 'PH0002',
      saleOwnerId: null,
      address: null,
      facebookLink: null,
    });
    userModel.findOne.mockImplementation((filter: any) => {
      if (filter?.userCode === 'PH1234') {
        return codeLookup;
      }
      if (filter?.email === 'parent.updated@example.com') {
        return buildQueryChain(null);
      }
      return buildQueryChain(null);
    });
    userModel.find.mockReturnValue(buildQueryChain([]));
    userModel.findById.mockReturnValueOnce(parentDoc);

    const result = await service.findOrCreateParentFromOrder(
      {
        parentUserCode: 'ph1234',
        parentName: 'Nguyen Van B',
        parentEmail: 'parent.updated@example.com',
        parentPhone: '0902000001',
      },
      session as any,
    );

    expect(result).toBe(parentUserId);
    expect(codeLookup.session).toHaveBeenCalledWith(session);
    expect(parentDoc.session).toHaveBeenCalledWith(session);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      new Types.ObjectId(parentUserId),
      expect.objectContaining({
        email: 'parent.updated@example.com',
        fullName: 'Nguyen Van B',
        phone: '0902000001',
      }),
      { session },
    );
  });

  it('PAR-03 resolves by parentEmail and syncs the record', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const service = buildService();
    const userModel = (service as any).userModel;
    const session = { id: 'session-3' };
    const emailLookup = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      role: Role.PARENT,
    });
    const parentDoc = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      fullName: 'Phu huynh cu',
      email: 'old@school.local',
      phone: '',
      userCode: 'PH0003',
      saleOwnerId: null,
      address: null,
      facebookLink: null,
    });
    userModel.findOne.mockImplementation((filter: any) => {
      if (filter?.email === 'parent.email@example.com') {
        return emailLookup;
      }
      return buildQueryChain(null);
    });
    userModel.findById.mockReturnValueOnce(parentDoc);

    const result = await service.findOrCreateParentFromOrder(
      {
        parentEmail: 'Parent.Email@Example.com',
        parentName: 'Nguyen Van C',
        parentPhone: '0903000001',
      },
      session as any,
    );

    expect(result).toBe(parentUserId);
    expect(emailLookup.session).toHaveBeenCalledWith(session);
    expect(parentDoc.session).toHaveBeenCalledWith(session);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      new Types.ObjectId(parentUserId),
      expect.objectContaining({
        email: 'parent.email@example.com',
        fullName: 'Nguyen Van C',
        phone: '0903000001',
      }),
      { session },
    );
  });

  it('PAR-04 resolves a unique parent by phone', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const service = buildService();
    const userModel = (service as any).userModel;
    const session = { id: 'session-4' };
    const phoneLookup = buildQueryChain([
      {
        _id: new Types.ObjectId(parentUserId),
        email: 'parent.phone@example.com',
        userCode: 'PH0004',
      },
    ]);
    const parentDoc = buildQueryChain({
      _id: new Types.ObjectId(parentUserId),
      fullName: 'Phu huynh cu',
      email: 'old@school.local',
      phone: '',
      userCode: 'PH0004',
      saleOwnerId: null,
      address: null,
      facebookLink: null,
    });
    userModel.find.mockReturnValue(phoneLookup);
    userModel.findOne.mockImplementation((filter: any) => {
      if (filter?.email === 'parent.phone@example.com') {
        return buildQueryChain(null);
      }
      return buildQueryChain(null);
    });
    userModel.findById.mockReturnValueOnce(parentDoc);

    const result = await service.findOrCreateParentFromOrder(
      {
        parentPhone: '0904000001',
        parentName: 'Nguyen Van D',
        parentEmail: 'parent.phone@example.com',
      },
      session as any,
    );

    expect(result).toBe(parentUserId);
    expect(phoneLookup.session).toHaveBeenCalledWith(session);
    expect(parentDoc.session).toHaveBeenCalledWith(session);
    expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
      new Types.ObjectId(parentUserId),
      expect.objectContaining({
        email: 'parent.phone@example.com',
        fullName: 'Nguyen Van D',
        phone: '0904000001',
      }),
      { session },
    );
  });

  it('PAR-05 creates a new parent when no match exists', async () => {
    const service = buildService();
    const userModel = (service as any).userModel;
    const session = { id: 'session-5' };
    const savedId = new Types.ObjectId().toHexString();
    userModel.find.mockReturnValue(buildQueryChain([]));
    userModel.findOne.mockImplementation((filter: any) => {
      if (filter?.email === 'parent.0905000001@school.local') {
        return buildQueryChain(null);
      }
      if (filter?.userCode?.$regex === '^PH\\d+$') {
        return buildQueryChain({ userCode: 'PH0009' });
      }
      return buildQueryChain(null);
    });

    let savedOptions: any;
    userModel.mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockImplementation(async (options?: any) => {
        savedOptions = options;
        return { _id: new Types.ObjectId(savedId) };
      }),
    }));

    const result = await service.findOrCreateParentFromOrder(
      {
        parentPhone: '0905000001',
        parentName: 'Parent Moi',
      },
      session as any,
    );

    expect(result).toBe(savedId);
    expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
    expect(bcrypt.hash).toHaveBeenCalledWith('123456', 'salt');
    expect(userModel).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'parent.0905000001@school.local',
        userCode: 'PH0010',
        password: 'hashed-password',
        fullName: 'Parent Moi',
        role: Role.PARENT,
        phone: '0905000001',
      }),
    );
    expect(savedOptions).toEqual({ session });
  });

  it('PAR-EX1 rejects a parentUserId that is not a parent account', async () => {
    const service = buildService();
    const userModel = (service as any).userModel;
    userModel.findById.mockReturnValueOnce(
      buildQueryChain({
        _id: new Types.ObjectId(),
        role: Role.SALE,
      }),
    );

    await expect(
      service.findOrCreateParentFromOrder({
        parentUserId: new Types.ObjectId().toHexString(),
      }),
    ).rejects.toThrow('parentUserId khong phai tai khoan PHU HUYNH');
  });

  it('PAR-EX2 rejects ambiguous phone matches', async () => {
    const service = buildService();
    const userModel = (service as any).userModel;
    userModel.find.mockReturnValue(
      buildQueryChain([
        { _id: new Types.ObjectId() },
        { _id: new Types.ObjectId() },
      ]),
    );

    await expect(
      service.findOrCreateParentFromOrder({
        parentPhone: '0906000001',
      }),
    ).rejects.toThrow('Tim thay nhieu tai khoan phu huynh trung so dien thoai');
  });
});

describe('UsersService.createByDirector teacher onboarding salary config', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
  });

  it('creates teacher profile and salary config from one director payload', async () => {
    const saleId = new Types.ObjectId().toHexString();
    const savedUserId = new Types.ObjectId();
    const userModel = buildUserModel();
    const teacherProfileModel = {
      create: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    };
    const salaryConfigService = {
      create: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findOne.mockReturnValue(buildQueryChain(null));
    userModel.find.mockReturnValue(buildQueryChain([{ _id: new Types.ObjectId(saleId) }]));
    userModel.mockImplementation((payload: any) => ({
      ...payload,
      _id: savedUserId,
      save: jest.fn().mockResolvedValue({
        _id: savedUserId,
        ...payload,
        toObject: () => ({
          _id: savedUserId,
          ...payload,
        }),
      }),
    }));

    const service = buildService({
      userModel,
      teacherProfileModel,
      salaryConfigService,
    });

    const result = await service.createByDirector(
      {
        userCode: 'gv010',
        email: 'teacher.onboard@example.com',
        password: '123456',
        fullName: 'Teacher Onboarding',
        role: Role.TEACHER,
        managedSales: [saleId],
        salaryConfig: {
          baseSalary: 12500000,
          standardHours: 176,
          scheduledStartTime: '08:00',
          latePenaltyAmount: 150000,
          commissionEnabled: false,
          commissionType: 'PROGRESSIVE' as any,
          commissionTiers: [],
          kpiBonusEnabled: false,
          kpiBonusTiers: [],
          notes: 'Created from users modal',
        },
      },
      {
        sub: new Types.ObjectId().toHexString(),
        role: Role.DIRECTOR,
        fullName: 'Director One',
      } as any,
    );

    expect(userModel).toHaveBeenCalledWith(
      expect.objectContaining({
        userCode: 'GV010',
        email: 'teacher.onboard@example.com',
        password: 'hashed-password',
        role: Role.TEACHER,
      }),
    );
    const teacherProfilePayload = teacherProfileModel.create.mock.calls[0][0];
    expect(teacherProfilePayload.userId).toEqual(savedUserId);
    expect(teacherProfilePayload.managedSales.map(String)).toEqual([saleId]);
    expect(teacherProfilePayload.status).toBe('APPROVED');
    expect(salaryConfigService.create).toHaveBeenCalledWith({
      baseSalary: 12500000,
      standardHours: 176,
      scheduledStartTime: '08:00',
      latePenaltyAmount: 150000,
      commissionEnabled: false,
      commissionType: 'PROGRESSIVE',
      commissionTiers: [],
      kpiBonusEnabled: false,
      kpiBonusTiers: [],
      notes: 'Created from users modal',
      userId: savedUserId.toString(),
    });
    expect(result).toMatchObject({
      _id: savedUserId,
      userCode: 'GV010',
      email: 'teacher.onboard@example.com',
      fullName: 'Teacher Onboarding',
      role: Role.TEACHER,
    });
  });

  it('rejects salary config for non-teacher accounts', async () => {
    const service = buildService();
    const salaryConfigService = (service as any).salaryConfigService;

    await expect(
      service.createByDirector(
        {
          userCode: 'SALE900',
          email: 'sale.with.salary@example.com',
          password: '123456',
          fullName: 'Sale Salary',
          role: Role.SALE,
          salaryConfig: {
            baseSalary: 9000000,
            standardHours: 176,
            scheduledStartTime: '08:00',
            latePenaltyAmount: 0,
          },
        },
        {
          sub: new Types.ObjectId().toHexString(),
          role: Role.DIRECTOR,
        } as any,
      ),
    ).rejects.toThrow('Chi tai khoan giao vien moi duoc khai bao salary config mac dinh');

    expect(salaryConfigService.create).not.toHaveBeenCalled();
  });

  it('rolls back teacher onboarding when salary config creation fails', async () => {
    const savedUserId = new Types.ObjectId();
    const userModel = buildUserModel();
    const teacherProfileModel = {
      create: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    const salaryConfigService = {
      create: jest.fn().mockRejectedValue(new Error('salary-config-failed')),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    userModel.findOne.mockReturnValue(buildQueryChain(null));
    userModel.find.mockReturnValue(buildQueryChain([]));
    userModel.mockImplementation((payload: any) => ({
      ...payload,
      _id: savedUserId,
      save: jest.fn().mockResolvedValue({
        _id: savedUserId,
        ...payload,
        toObject: () => ({
          _id: savedUserId,
          ...payload,
        }),
      }),
    }));
    userModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

    const service = buildService({
      userModel,
      teacherProfileModel,
      salaryConfigService,
    });

    await expect(
      service.createByDirector(
        {
          userCode: 'GVFAIL',
          email: 'teacher.rollback@example.com',
          password: '123456',
          fullName: 'Teacher Rollback',
          role: Role.TEACHER,
          salaryConfig: {
            baseSalary: 11000000,
            standardHours: 176,
            scheduledStartTime: '08:00',
            latePenaltyAmount: 50000,
          },
        },
        {
          sub: new Types.ObjectId().toHexString(),
          role: Role.DIRECTOR,
        } as any,
      ),
    ).rejects.toThrow('salary-config-failed');

    expect(salaryConfigService.remove).toHaveBeenCalledWith(savedUserId.toString());
    expect(teacherProfileModel.deleteOne).toHaveBeenCalledWith({ userId: savedUserId });
    expect(userModel.deleteOne).toHaveBeenCalledWith({ _id: savedUserId });
  });
});
