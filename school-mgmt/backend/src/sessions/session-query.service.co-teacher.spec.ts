import { Types } from 'mongoose';
import { SessionQueryService } from './session-query.service';
import { Role } from '../common/interfaces/role.enum';
import { SessionStatus } from './schemas/session.schema';

jest.mock('./session-payroll.service', () => ({
  SessionPayrollService: class SessionPayrollService {},
}));

function buildService(overrides: Partial<Record<string, any>> = {}) {
  return new SessionQueryService(
    overrides.sessionModel ?? ({} as any),
    overrides.classModel ?? ({} as any),
    overrides.studentModel ?? ({} as any),
    overrides.attendanceModel ?? ({} as any),
    overrides.sessionPayrollService ?? {
      buildTeacherPayoutOverrideMap: jest.fn().mockResolvedValue(new Map()),
      computeTeacherPayoutFallback: jest.fn(),
    },
    overrides.storageUrlService ?? {
      transformSensitiveAssetUrls: jest.fn((value) => value),
    },
  );
}

describe('SessionQueryService co-teacher access', () => {
  it('includes co-teacher classes in teacher listing queries', async () => {
    const teacherId = new Types.ObjectId().toHexString();
    const classId = new Types.ObjectId().toHexString();
    const sessions = [
      {
        _id: new Types.ObjectId(),
        classId: { _id: classId, name: 'Offline A', code: 'OFF-1' },
        teacherId: { _id: new Types.ObjectId(), fullName: 'Primary' },
        scheduledDate: new Date('2026-04-11T00:00:00.000Z'),
        status: SessionStatus.SCHEDULED,
        teacherPayout: 0,
      },
    ];
    const sessionModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(sessions),
      }),
      countDocuments: jest.fn().mockResolvedValue(1),
    };
    const attendanceModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      }),
    };
    const classModel = {
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([
          {
            _id: classId,
            coTeachers: [
              {
                teacherId,
                canManageReports: true,
                canManageAttendance: true,
              },
            ],
          },
        ]),
      }),
      findById: jest.fn(),
    };

    const service = buildService({ sessionModel, classModel, attendanceModel });
    const result = await service.findAll({}, { role: Role.TEACHER, sub: teacherId } as any);

    expect(classModel.find).toHaveBeenCalledWith({
      'coTeachers.teacherId': new Types.ObjectId(teacherId),
    });
    expect(sessionModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: [
          expect.objectContaining({
            $or: [
              { teacherId: new Types.ObjectId(teacherId) },
              { classId: { $in: [expect.any(Types.ObjectId)] } },
            ],
          }),
        ],
      }),
    );
    expect(result.data).toHaveLength(1);
  });
});
