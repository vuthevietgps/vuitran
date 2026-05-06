import { ClassEditHistoryAction, PendingClassUpdateType } from './schemas/class.schema';
import { ClassesDataService } from './classes-data.service';

describe('ClassesDataService duration history preview', () => {
  function buildService() {
    return new ClassesDataService(
      {} as any,
      { find: jest.fn() } as any,
      { find: jest.fn(), aggregate: jest.fn() } as any,
      { find: jest.fn() } as any,
      { find: jest.fn() } as any,
      { aggregate: jest.fn() } as any,
    );
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the latest approved online snapshot as the current state for duration previews', async () => {
    const service = buildService();
    const classroom = {
      name: 'Lop online 1-1',
      code: 'CLS-ONLINE-001',
      classMode: 'ONLINE',
      students: [],
      baseDuration: 60,
      sessionDuration: 60,
      pricePerSession: 120_000,
      teacherPayPerSession: 50_000,
      teacherPayPerStudent: 0,
      pricingSnapshot: {
        referenceDuration: 70,
        sessionDuration: 70,
        pricePerSession: 145_000,
        teacherPayPerSession: 75_000,
        teacherPayPerStudent: 0,
      },
      durationSnapshots: [
        {
          effectiveAt: new Date('2026-03-01T00:00:00.000Z'),
          baseDuration: 70,
          sessionDuration: 90,
          pricePerSession: 145_000,
          teacherPayPerSession: 75_000,
          teacherPayPerStudent: 0,
        },
      ],
    };

    const result = await service.buildClassHistoryArtifacts(
      classroom,
      {
        sessionDuration: 100,
        requestType: PendingClassUpdateType.DURATION_CHANGE,
      },
      { role: 'SALE', sub: '64b5f29f8d6b6d30f2b8d001', fullName: 'Sale 1' } as any,
      ClassEditHistoryAction.SALE_REQUESTED,
    );

    expect(result.durationPreview).toMatchObject({
      oldBaseDuration: 70,
      oldSessionDuration: 90,
      newBaseDuration: 70,
      newSessionDuration: 100,
      students: [],
    });
    expect(result.changeSummary).toContainEqual({
      field: 'sessionDuration',
      label: 'Thoi luong buoi hoc',
      beforeValue: '90 phut',
      afterValue: '100 phut',
    });
  });
});
