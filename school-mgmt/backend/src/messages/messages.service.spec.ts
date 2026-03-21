import { ConfigService } from '@nestjs/config';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  function createService() {
    const studentSupportSnapshotService = {
      getOrBuild: jest.fn(),
    };

    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    const service = new MessagesService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      configService,
      {} as any,
      studentSupportSnapshotService as any,
    );

    return { service, studentSupportSnapshotService };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests a fresh student support snapshot for AI parent support context', async () => {
    const { service, studentSupportSnapshotService } = createService();
    studentSupportSnapshotService.getOrBuild.mockResolvedValue({
      contextText: 'verified context',
    });

    await expect(
      (service as any).buildStudentSupportContext('parent-1', 'student-1'),
    ).resolves.toBe('verified context');

    expect(studentSupportSnapshotService.getOrBuild).toHaveBeenCalledWith(
      'parent-1',
      'student-1',
      { preferFresh: true },
    );
  });
});
