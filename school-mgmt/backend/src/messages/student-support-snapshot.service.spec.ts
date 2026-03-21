import { StudentSupportSnapshotService } from './student-support-snapshot.service';

describe('StudentSupportSnapshotService', () => {
  const parentUserId = '65f0c8bc5e2f4e54a8f2d111';
  const studentId = '65f0c8bc5e2f4e54a8f2d222';

  function createService() {
    const snapshotModel = {
      findOne: jest.fn(),
    };

    const service = new StudentSupportSnapshotService(
      snapshotModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return { service, snapshotModel };
  }

  function mockLeanResult(model: { findOne: jest.Mock }, value: unknown) {
    model.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    });
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('forces a rebuild for stale snapshots when preferFresh is enabled', async () => {
    const { service, snapshotModel } = createService();
    const staleSnapshot = {
      generatedAt: new Date(Date.now() - 16 * 60 * 1000),
      contextText: 'old snapshot',
      dataWarnings: [],
    };
    const rebuiltSnapshot = {
      generatedAt: new Date(),
      contextText: 'fresh snapshot',
      dataWarnings: [],
    };

    mockLeanResult(snapshotModel, staleSnapshot);
    const rebuildSpy = jest
      .spyOn(service, 'rebuild')
      .mockResolvedValue(rebuiltSnapshot as any);

    await expect(
      service.getOrBuild(parentUserId, studentId, { preferFresh: true }),
    ).resolves.toEqual(rebuiltSnapshot);
    expect(rebuildSpy).toHaveBeenCalledWith(parentUserId, studentId);
  });

  it('returns the previous snapshot with a warning if a fresh rebuild fails', async () => {
    const { service, snapshotModel } = createService();
    const staleSnapshot = {
      generatedAt: new Date(Date.now() - 16 * 60 * 1000),
      contextText: 'old snapshot',
      dataWarnings: ['Canh bao cu'],
    };

    mockLeanResult(snapshotModel, staleSnapshot);
    jest.spyOn(service, 'rebuild').mockRejectedValue(new Error('refresh failed'));

    await expect(
      service.getOrBuild(parentUserId, studentId, { preferFresh: true }),
    ).resolves.toMatchObject({
      contextText: 'old snapshot',
      dataWarnings: expect.arrayContaining([
        'Canh bao cu',
        expect.stringContaining('He thong tam thoi chua lam moi du lieu moi nhat'),
      ]),
    });
  });
});
