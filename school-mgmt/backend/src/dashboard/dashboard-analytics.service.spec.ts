import { Types } from 'mongoose';
import { DashboardAnalyticsService } from './dashboard-analytics.service';

describe('DashboardAnalyticsService', () => {
  function buildQueryResult<T>(value: T) {
    return {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(value),
    };
  }

  function buildFindResult<T>(value: T) {
    return {
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(value),
    };
  }

  function buildService() {
    const teachers = [
      {
        _id: 'teacher-profile-001',
        userId: {
          _id: 'teacher-user-001',
          fullName: 'Alpha Nguyen',
          email: 'alpha.teacher@example.com',
          phone: '0901000101',
          status: 'ACTIVE',
        },
        status: 'ACTIVE',
        subjects: ['Toan'],
        grades: ['Lop 6'],
        rating: 4.8,
        yearsOfExperience: 7,
      },
    ];

    const teacherModel = {
      find: jest.fn().mockReturnValue(buildQueryResult(teachers)),
    };

    const sessionModel = {
      aggregate: jest
        .fn()
        .mockResolvedValueOnce([
          {
            _id: { teacherId: 'teacher-user-001', status: 'FINALIZED' },
            count: 4,
            totalRevenue: 2_400_000,
            totalPayout: 1_200_000,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: 'teacher-user-001',
            totalReports: 4,
            lateReports: 1,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: 'teacher-user-001',
            avgStudentPerformance: 4.5,
            avgStudentEngagement: 4.4,
            avgComprehension: 4.3,
            evalCount: 4,
          },
        ])
        .mockResolvedValueOnce([
          {
            _id: 'teacher-user-001',
            avgOverallRating: 4.7,
            avgTeachingQuality: 4.8,
            avgCommunication: 4.6,
            satisfiedCount: 4,
            feedbackCount: 4,
          },
        ]),
    };

    const classModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: 'teacher-user-001',
          activeClasses: 2,
          totalStudents: 8,
        },
      ]),
    };

    const payrollModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: 'teacher-user-001',
          totalPaid: 1_080_000,
          payrollCount: 1,
        },
      ]),
    };

    const payrollTransactionModel = {
      aggregate: jest.fn().mockResolvedValue([
        {
          _id: 'teacher-user-001',
          totalPenalty: 36_000,
          penaltySessionCount: 1,
        },
      ]),
    };

    const service = new DashboardAnalyticsService(
      sessionModel as any,
      {} as any,
      payrollModel as any,
      payrollTransactionModel as any,
      {} as any,
      teacherModel as any,
      {} as any,
      classModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return {
      service,
      teacherModel,
      sessionModel,
      classModel,
      payrollModel,
      payrollTransactionModel,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps teacher payroll penalties into the teacher KPI response as a first-class metric', async () => {
    const {
      service,
      teacherModel,
      sessionModel,
      classModel,
      payrollModel,
      payrollTransactionModel,
    } = buildService();

    const result = await service.getTeacherKPI('2026-04-01', '2026-04-30');

    expect(teacherModel.find).toHaveBeenCalled();
    expect(sessionModel.aggregate).toHaveBeenCalledTimes(4);
    expect(classModel.aggregate).toHaveBeenCalledTimes(1);
    expect(payrollModel.aggregate).toHaveBeenCalledTimes(1);
    expect(payrollTransactionModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: expect.objectContaining({
            status: { $ne: 'EXCLUDED' },
          }),
        }),
        expect.objectContaining({
          $group: expect.objectContaining({
            totalPenalty: expect.any(Object),
            penaltySessionCount: expect.any(Object),
          }),
        }),
      ]),
    );

    expect(result.summary).toEqual(
      expect.objectContaining({
        totalTeachers: 1,
        activeTeachers: 1,
      }),
    );
    expect(result.teachers).toHaveLength(1);
    expect(result.teachers[0]).toEqual(
      expect.objectContaining({
        fullName: 'Alpha Nguyen',
        payroll: expect.objectContaining({
          totalPaid: 1_080_000,
          payrollCount: 1,
          totalPenalty: 36_000,
          penaltySessionCount: 1,
        }),
      }),
    );
  });

  it('filters calendar overview data by teacherId and classId across sessions, payrolls, and tickets', async () => {
    const teacherId = new Types.ObjectId().toString();
    const classId = new Types.ObjectId().toString();
    const sessionDate = new Date('2026-04-14T00:00:00.000Z');
    const createdAt = new Date('2026-04-03T08:30:00.000Z');

    const sessionModel = {
      find: jest.fn().mockReturnValue(buildFindResult([
        {
          _id: 'session-calendar-001',
          scheduledDate: sessionDate,
          scheduledStartTime: '18:00',
          status: 'SCHEDULED',
          teacherId: { _id: teacherId, fullName: 'Teacher Filter' },
          studentId: { _id: 'student-001', fullName: 'Hoc sinh Filter', studentCode: 'HS-001' },
          classId: { _id: classId, name: 'Lop Filter', code: 'CLS-FLT-001' },
        },
      ])),
      aggregate: jest.fn().mockResolvedValue([
        { _id: 'SCHEDULED', count: 1 },
      ]),
    };

    const payrollModel = {
      find: jest.fn().mockReturnValue(buildFindResult([
        {
          _id: 'payroll-calendar-001',
          createdAt,
          netAmount: 180000,
          status: 'PAID',
          teacherId: { _id: teacherId, fullName: 'Teacher Filter' },
          classId,
        },
      ])),
    };

    const ticketModel = {
      find: jest.fn().mockReturnValue(buildFindResult([
        {
          _id: 'ticket-calendar-001',
          ticketCode: 'TCK-CAL-001',
          subject: 'Can doi lich',
          status: 'OPEN',
          priority: 'HIGH',
          createdAt,
          dueDate: new Date('2026-04-15T00:00:00.000Z'),
          teacherId,
          classId,
        },
      ])),
    };

    const service = new DashboardAnalyticsService(
      sessionModel as any,
      {} as any,
      payrollModel as any,
      {} as any,
      ticketModel as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getCalendarOverview(4, 2026, teacherId, classId);

    expect(sessionModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: expect.any(Types.ObjectId),
        classId: expect.any(Types.ObjectId),
        scheduledDate: expect.any(Object),
      }),
    );
    expect(sessionModel.aggregate).toHaveBeenCalledWith([
      {
        $match: expect.objectContaining({
          teacherId: expect.any(Types.ObjectId),
          classId: expect.any(Types.ObjectId),
          scheduledDate: expect.any(Object),
        }),
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    expect(payrollModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: expect.any(Types.ObjectId),
        classId: expect.any(Types.ObjectId),
        $or: expect.any(Array),
      }),
    );
    expect(ticketModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        teacherId: expect.any(Types.ObjectId),
        classId: expect.any(Types.ObjectId),
        createdAt: expect.any(Object),
      }),
    );

    expect(result.filters).toEqual({
      teacherId,
      classId,
    });
    expect(result.totalSessions).toBe(1);
    expect(result.sessions).toHaveLength(1);
    expect(result.payrolls).toHaveLength(1);
    expect(result.tickets).toHaveLength(1);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SESSION',
          title: 'Lop Filter - Teacher Filter',
        }),
        expect.objectContaining({
          type: 'PAYROLL',
          detail: expect.stringContaining('180'),
        }),
        expect.objectContaining({
          type: 'TICKET_CREATED',
          title: expect.stringContaining('TCK-CAL-001'),
        }),
      ]),
    );
  });
});
