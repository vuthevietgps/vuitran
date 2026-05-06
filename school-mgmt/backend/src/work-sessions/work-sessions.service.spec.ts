import { Types } from 'mongoose';
import { WorkSessionsService } from './work-sessions.service';
import { WorkSessionStatus } from './schemas/work-session.schema';

type QueryChainResult = {
  select: jest.Mock;
  sort: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  populate: jest.Mock;
  lean: jest.Mock;
};

function buildQueryChain(result: any): QueryChainResult {
  const chain: Partial<QueryChainResult> = {};
  chain.select = jest.fn().mockReturnThis();
  chain.sort = jest.fn().mockReturnThis();
  chain.skip = jest.fn().mockReturnThis();
  chain.limit = jest.fn().mockReturnThis();
  chain.populate = jest.fn().mockReturnThis();
  chain.lean = jest.fn().mockReturnThis();
  const promise = Promise.resolve(result);
  (chain as any).then = promise.then.bind(promise);
  (chain as any).catch = promise.catch.bind(promise);
  return chain as QueryChainResult;
}

function buildService(overrides: Partial<{ workSessionModel: any; userModel: any }> = {}) {
  const workSessionModel =
    overrides.workSessionModel ??
    ({
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    } as any);
  const userModel =
    overrides.userModel ??
    ({
      find: jest.fn(),
    } as any);

  return new WorkSessionsService(workSessionModel as any, userModel as any);
}

describe('WorkSessionsService.findAll', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns one page with meta and aggregate summary', async () => {
    const sessionRows = [
      {
        _id: new Types.ObjectId().toHexString(),
        status: WorkSessionStatus.ACTIVE,
        totalMinutes: 0,
      },
    ];
    const workSessionModel: any = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn().mockReturnValue(buildQueryChain(sessionRows)),
      countDocuments: jest.fn().mockResolvedValue(61),
      aggregate: jest.fn().mockResolvedValue([
        {
          totalSessions: 61,
          activeSessions: 4,
          totalMinutes: 1540,
          lateSessions: 6,
        },
      ]),
    };
    const service = buildService({ workSessionModel });

    const result = await service.findAll({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      status: WorkSessionStatus.ACTIVE,
      page: 2,
      limit: 25,
    });

    expect(workSessionModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: WorkSessionStatus.ACTIVE,
        date: expect.objectContaining({
          $gte: expect.any(Date),
          $lte: expect.any(Date),
        }),
      }),
    );
    const findChain = workSessionModel.find.mock.results[0].value as QueryChainResult;
    expect(findChain.sort).toHaveBeenCalledWith({ date: -1, loginTime: -1 });
    expect(findChain.skip).toHaveBeenCalledWith(25);
    expect(findChain.limit).toHaveBeenCalledWith(25);
    expect(result.meta).toEqual({
      total: 61,
      page: 2,
      limit: 25,
      totalPages: 3,
    });
    expect(result.summary).toEqual({
      totalSessions: 61,
      activeSessions: 4,
      totalMinutes: 1540,
      lateSessions: 6,
    });
  });

  it('resolves admin search on user collection before querying sessions', async () => {
    const matchingUserId = new Types.ObjectId();
    const userModel: any = {
      find: jest.fn().mockReturnValue(
        buildQueryChain([{ _id: matchingUserId }]),
      ),
    };
    const workSessionModel: any = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn().mockReturnValue(buildQueryChain([])),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    const service = buildService({ workSessionModel, userModel });

    await service.findAll({
      search: 'Lan',
      page: 1,
      limit: 25,
    });

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.any(Array),
      }),
    );
    expect(workSessionModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: { $in: [matchingUserId] },
      }),
    );
  });

  it('returns an empty page when search matches no employee', async () => {
    const userModel: any = {
      find: jest.fn().mockReturnValue(buildQueryChain([])),
    };
    const workSessionModel: any = {
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };
    const service = buildService({ workSessionModel, userModel });

    const result = await service.findAll({
      search: 'Khong ton tai',
      page: 1,
      limit: 25,
    });

    expect(workSessionModel.find).not.toHaveBeenCalled();
    expect(result.meta).toEqual({
      total: 0,
      page: 1,
      limit: 25,
      totalPages: 1,
    });
    expect(result.summary.totalSessions).toBe(0);
  });
});
