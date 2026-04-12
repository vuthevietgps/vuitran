import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceStatus } from './schemas/attendance.schema';
import { ClassMode } from '../classes/schemas/class.schema';
import { Role } from '../common/interfaces/role.enum';

function buildLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
    populate: jest.fn().mockReturnThis(),
  } as any;
}

function buildService(overrides: Partial<{
  attendanceModel: any;
  classModel: any;
  connection: any;
  classesService: any;
  sessionBridgeService: any;
  queryService: any;
  linkService: any;
}> = {}) {
  const sessionBridgeService =
    overrides.sessionBridgeService ?? {
      processOneStudent: jest.fn(),
      clearAttendanceRecord: jest.fn(),
      recomputeOfflineTeacherPayoutForDay: jest.fn(),
      findFinalizedSessionForAttendance: jest.fn(),
      syncSessionForAttendance: jest.fn(),
      cancelLinkedSession: jest.fn(),
    };
  const connection =
    overrides.connection ?? {
      startSession: jest.fn().mockResolvedValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        abortTransaction: jest.fn().mockResolvedValue(undefined),
        endSession: jest.fn().mockResolvedValue(undefined),
        inTransaction: jest.fn().mockReturnValue(true),
      }),
    };

  return {
    service: new AttendanceService(
      overrides.attendanceModel ?? ({} as any),
      overrides.classModel ?? ({} as any),
      connection as any,
      overrides.classesService ?? ({} as any),
      sessionBridgeService as any,
      overrides.queryService ?? ({} as any),
      overrides.linkService ?? ({} as any),
    ),
    sessionBridgeService,
    connection,
  };
}

describe('AttendanceService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes counted attendance through the session bridge service', async () => {
    const classId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();
    const teacherId = new Types.ObjectId().toHexString();
    const directorId = new Types.ObjectId().toHexString();
    const attendanceId = new Types.ObjectId().toHexString();

    const attendanceModel = {
      findById: jest.fn().mockReturnValue(
        buildLeanQuery({
          _id: attendanceId,
          status: AttendanceStatus.PRESENT,
          studentId,
          classId,
          sessionId: new Types.ObjectId(),
        }),
      ),
    };
    const classModel = {
      findById: jest.fn().mockReturnValue(
        buildLeanQuery({
          _id: new Types.ObjectId(classId),
          teacher: new Types.ObjectId(teacherId),
          classMode: ClassMode.ONLINE,
          students: [new Types.ObjectId(studentId)],
          substituteTeachers: [],
        }),
      ),
    };
    const { service, sessionBridgeService } = buildService({
      attendanceModel,
      classModel,
    });
    sessionBridgeService.processOneStudent.mockResolvedValue({
      attendance: { _id: attendanceId },
      sessionCreated: true,
    });
    attendanceModel.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: attendanceId,
        status: AttendanceStatus.PRESENT,
        studentId: new Types.ObjectId(studentId),
        classId: new Types.ObjectId(classId),
      }),
    });

    const result = await service.markAttendance(
      {
        classId,
        studentId,
        date: '2026-04-09',
        status: AttendanceStatus.PRESENT,
        notes: 'ok',
      } as any,
      { role: Role.DIRECTOR, sub: directorId } as any,
    );

    expect(sessionBridgeService.processOneStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        classId,
        studentId,
        status: AttendanceStatus.PRESENT,
        notes: 'ok',
        checkedBy: expect.any(Types.ObjectId),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        _id: attendanceId,
        sessionCreated: true,
      }),
    );
  });

  it('aborts an update when the attendance is already linked to a finalized session', async () => {
    const classId = new Types.ObjectId();
    const studentId = new Types.ObjectId();
    const attendanceId = new Types.ObjectId().toHexString();
    const teacherId = new Types.ObjectId().toHexString();
    const mongoSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
      inTransaction: jest.fn().mockReturnValue(true),
    };
    const attendanceDoc = {
      _id: attendanceId,
      classId,
      studentId,
      date: new Date('2026-04-09T00:00:00.000Z'),
      status: AttendanceStatus.PRESENT,
      sessionId: new Types.ObjectId(),
      save: jest.fn().mockResolvedValue(undefined),
      session: jest.fn().mockResolvedValue(undefined),
    };
    const attendanceModel = {
      findById: jest.fn().mockReturnValue({
        session: jest.fn().mockResolvedValue(attendanceDoc),
      }),
    };
    const classModel = {
      findById: jest.fn().mockReturnValue(
        buildLeanQuery({
          _id: classId,
          teacher: teacherId,
          classMode: ClassMode.ONLINE,
          students: [studentId],
          substituteTeachers: [],
        }),
      ),
    };
    const { service, sessionBridgeService, connection } = buildService({
      attendanceModel,
      classModel,
      connection: {
        startSession: jest.fn().mockResolvedValue(mongoSession),
      },
    });
    sessionBridgeService.findFinalizedSessionForAttendance.mockResolvedValue({
      _id: new Types.ObjectId(),
    });

    await expect(
      service.updateAttendance(attendanceId, { status: AttendanceStatus.ABSENT } as any, {
        role: Role.DIRECTOR,
        sub: new Types.ObjectId().toHexString(),
      } as any),
    ).rejects.toThrow(
      new BadRequestException(
        'Buoi hoc da duoc xac nhan hoan thanh (FINALIZED). Khong the thay doi diem danh.',
      ),
    );

    expect(connection.startSession).toHaveBeenCalledTimes(1);
    expect(mongoSession.abortTransaction).toHaveBeenCalledTimes(1);
    expect(mongoSession.endSession).toHaveBeenCalledTimes(1);
    expect(attendanceDoc.save).not.toHaveBeenCalled();
  });
});
