import { Types } from 'mongoose';
import { ClassMode } from '../classes/schemas/class.schema';
import { Role } from '../common/interfaces/role.enum';
import { getAttendancePermissions } from './attendance.utils';

describe('attendance permission snapshot', () => {
  const primaryTeacherId = new Types.ObjectId().toHexString();
  const substituteTeacherId = new Types.ObjectId().toHexString();
  const coTeacherId = new Types.ObjectId().toHexString();

  function buildClassroom() {
    return {
      _id: new Types.ObjectId(),
      teacher: new Types.ObjectId(primaryTeacherId),
      classMode: ClassMode.ONLINE,
      students: [],
      substituteTeachers: [
        {
          teacherId: new Types.ObjectId(substituteTeacherId),
          fromDate: new Date('2026-04-11T00:00:00.000Z'),
          toDate: new Date('2026-04-11T23:59:59.999Z'),
          payRate: 150000,
          canCreateLink: true,
        },
      ],
      coTeachers: [
        {
          teacherId: new Types.ObjectId(coTeacherId),
          role: 'SUPPORT',
          canManageAttendance: true,
          canManageReports: true,
          canCreateLink: true,
        },
      ],
    } as any;
  }

  it('blocks the primary teacher from generating attendance links on an active substitute day', () => {
    const permissions = getAttendancePermissions(
      buildClassroom(),
      { role: Role.TEACHER, sub: primaryTeacherId } as any,
      new Date('2026-04-11T08:00:00.000Z'),
    );

    expect(permissions).toEqual({
      canBulkEdit: false,
      canGenerateLink: false,
      blockedReason:
        'Ngay nay da co giao vien day thay phu trach diem danh. Giao vien chinh khong duoc tao link diem danh.',
      substituteActive: true,
      substituteTeacherId,
      activeTeacherId: substituteTeacherId,
    });
  });

  it('allows the substitute teacher only when the active assignment grants create-link permission', () => {
    const classroom = buildClassroom();

    expect(
      getAttendancePermissions(
        classroom,
        { role: Role.TEACHER, sub: substituteTeacherId } as any,
        new Date('2026-04-11T08:00:00.000Z'),
      ),
    ).toEqual({
      canBulkEdit: false,
      canGenerateLink: true,
      blockedReason: null,
      substituteActive: true,
      substituteTeacherId,
      activeTeacherId: substituteTeacherId,
    });

    classroom.substituteTeachers[0].canCreateLink = false;

    expect(
      getAttendancePermissions(
        classroom,
        { role: Role.TEACHER, sub: substituteTeacherId } as any,
        new Date('2026-04-11T08:00:00.000Z'),
      ),
    ).toEqual({
      canBulkEdit: false,
      canGenerateLink: false,
      blockedReason: 'Giao vien day thay khong duoc OPS cap quyen tao link diem danh.',
      substituteActive: true,
      substituteTeacherId,
      activeTeacherId: substituteTeacherId,
    });
  });

  it('allows the configured co-teacher to manage attendance and create links', () => {
    expect(
      getAttendancePermissions(
        buildClassroom(),
        { role: Role.TEACHER, sub: coTeacherId } as any,
        new Date('2026-04-11T08:00:00.000Z'),
      ),
    ).toEqual({
      canBulkEdit: true,
      canGenerateLink: true,
      blockedReason: null,
      substituteActive: true,
      substituteTeacherId,
      activeTeacherId: coTeacherId,
    });
  });
});
