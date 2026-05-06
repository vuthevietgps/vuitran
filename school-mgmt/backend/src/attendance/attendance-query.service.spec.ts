import { Types } from 'mongoose';
import { AttendanceQueryService } from './attendance-query.service';
import { Role } from '../common/interfaces/role.enum';

describe('AttendanceQueryService', () => {
  function buildService() {
    const attendanceModel = {};
    const classModel = {
      find: jest.fn(),
    };
    const studentModel = {};
    const storageUrlService = {
      transformSensitiveAssetUrls: jest.fn().mockImplementation((value) => value),
    };

    return {
      service: new AttendanceQueryService(
        attendanceModel as any,
        classModel as any,
        studentModel as any,
        storageUrlService as any,
      ),
      classModel,
    };
  }

  function buildFindChain(result: any[]) {
    return {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    };
  }

  it('returns lightweight class options for attendance report filters', async () => {
    const { service, classModel } = buildService();
    const chain = buildFindChain([
      {
        _id: new Types.ObjectId('64b5f29f8d6b6d30f2b8d401'),
        code: 'CLS-001',
        name: 'Lop Toan',
        students: [new Types.ObjectId(), new Types.ObjectId()],
      },
    ]);
    classModel.find.mockReturnValue(chain);

    const result = await service.getAttendanceReportClasses(
      { role: Role.DIRECTOR, sub: new Types.ObjectId().toHexString() } as any,
      'CLS',
      25,
    );

    expect(classModel.find).toHaveBeenCalledWith(expect.objectContaining({
      $or: expect.arrayContaining([
        expect.objectContaining({ code: expect.any(RegExp) }),
        expect.objectContaining({ name: expect.any(RegExp) }),
      ]),
    }));
    expect(chain.select).toHaveBeenCalledWith('code name students');
    expect(chain.limit).toHaveBeenCalledWith(25);
    expect(result).toEqual([
      {
        _id: '64b5f29f8d6b6d30f2b8d401',
        code: 'CLS-001',
        name: 'Lop Toan',
        studentCount: 2,
      },
    ]);
  });

  it('restricts attendance report class options to the current teacher scope', async () => {
    const { service, classModel } = buildService();
    const teacherId = new Types.ObjectId().toHexString();
    const chain = buildFindChain([]);
    classModel.find.mockReturnValue(chain);

    await service.getAttendanceReportClasses(
      { role: Role.TEACHER, sub: teacherId } as any,
      undefined,
      50,
    );

    expect(classModel.find).toHaveBeenCalledWith({
      $or: [
        { teacher: new Types.ObjectId(teacherId) },
        { 'substituteTeachers.teacherId': new Types.ObjectId(teacherId) },
        { 'coTeachers.teacherId': new Types.ObjectId(teacherId) },
      ],
    });
  });
});
