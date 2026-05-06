import { Types } from "mongoose";
import { StudentReportService } from "./student-report.service";
import { InvoiceStatus, InvoiceType } from "../invoices/schemas/invoice.schema";

type QueryChainResult = {
  select: jest.Mock;
  sort: jest.Mock;
  skip: jest.Mock;
  limit: jest.Mock;
  populate: jest.Mock;
  lean: jest.Mock;
};

function buildQueryChain(result: any): QueryChainResult {
  const chain: Partial<QueryChainResult> = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };
  const promise = Promise.resolve(result);
  (chain as any).then = promise.then.bind(promise);
  (chain as any).catch = promise.catch.bind(promise);
  return chain as QueryChainResult;
}

function buildFixtures() {
  const classId = new Types.ObjectId();
  const studentId = new Types.ObjectId();
  const secondStudentId = new Types.ObjectId();
  const teacherId = new Types.ObjectId();

  const classroom = {
    _id: classId,
    code: "CLS-01",
    name: "Math 1-1",
    subject: "Math",
    grade: "5",
    classMode: "ONLINE",
    status: "ACTIVE",
    totalSessions: 24,
    sessionsCompleted: 7,
    baseDuration: 60,
    pricePerSession: 200000,
    pricingSnapshot: {
      referenceDuration: 60,
    },
    teacher: {
      _id: teacherId,
      userCode: "GV001",
      fullName: "Teacher One",
    },
    studentConfigs: [],
    substituteTeachers: [],
  };

  const firstStudent = {
    _id: studentId,
    studentCode: "HS001",
    fullName: "Student One",
    age: 10,
    grade: "5",
    level: "L5",
    parentName: "Parent One",
    parentPhone: "0901000001",
    faceImage: "student.jpg",
  };

  const secondStudent = {
    _id: secondStudentId,
    studentCode: "HS002",
    fullName: "Student Two",
    age: 11,
    grade: "5",
    level: "L5",
    parentName: "Parent Two",
    parentPhone: "0901000002",
    faceImage: "student-2.jpg",
  };

  return {
    classId,
    studentId,
    secondStudentId,
    teacherId,
    classroom,
    firstStudent,
    secondStudent,
    attendances: [
      {
        _id: new Types.ObjectId(),
        classId,
        studentId,
        teacherId: {
          _id: teacherId,
          userCode: "GV001",
          fullName: "Teacher One",
        },
        date: new Date("2026-03-01T00:00:00.000Z"),
        status: "PRESENT",
        sessionIndex: 1,
        sessionDuration: 60,
      },
      {
        _id: new Types.ObjectId(),
        classId,
        studentId,
        teacherId: {
          _id: teacherId,
          userCode: "GV001",
          fullName: "Teacher One",
        },
        date: new Date("2026-03-08T00:00:00.000Z"),
        status: "PRESENT",
        sessionIndex: 2,
        sessionDuration: 60,
      },
    ],
  };
}

function buildService(overrides?: {
  studentDocs?: any[];
  studentCount?: number;
  classDoc?: any;
  classDocs?: any[];
  attendances?: any[];
  attendanceAggregates?: any[];
  invoices?: any[];
  aggregateResults?: any[][];
}) {
  const aggregateQueue = [...(overrides?.aggregateResults ?? [])];
  const classroomModel = {
    aggregate: jest
      .fn()
      .mockImplementation(() => Promise.resolve(aggregateQueue.shift() ?? [])),
    find: jest
      .fn()
      .mockImplementation(() => buildQueryChain(overrides?.classDocs ?? [])),
    findOne: jest
      .fn()
      .mockImplementation(() => buildQueryChain(overrides?.classDoc ?? null)),
  };
  const attendanceModel = {
    aggregate: jest
      .fn()
      .mockResolvedValue(overrides?.attendanceAggregates ?? []),
    find: jest
      .fn()
      .mockReturnValue(buildQueryChain(overrides?.attendances ?? [])),
  };
  const invoiceModel = {
    collection: { name: "invoices" },
    find: jest.fn().mockReturnValue(buildQueryChain(overrides?.invoices ?? [])),
  };
  const studentModel = {
    collection: { name: "students" },
    countDocuments: jest
      .fn()
      .mockResolvedValue(
        overrides?.studentCount ?? overrides?.studentDocs?.length ?? 0,
      ),
    find: jest
      .fn()
      .mockImplementation(() => buildQueryChain(overrides?.studentDocs ?? [])),
  };

  return {
    service: new StudentReportService(
      studentModel as any,
      attendanceModel as any,
      classroomModel as any,
      invoiceModel as any,
    ),
    classroomModel,
  };
}

function buildPagePair(classId: Types.ObjectId, student: any) {
  return [
    {
      classId,
      student,
    },
  ];
}

describe("StudentReportService.getComprehensiveReport", () => {
  it("uses purchased sessions from active tuition invoices for totalSessions", async () => {
    const fixtures = buildFixtures();
    const { service } = buildService({
      aggregateResults: [[{ total: 1 }], buildPagePair(fixtures.classId, fixtures.firstStudent)],
      classDocs: [fixtures.classroom],
      attendances: fixtures.attendances,
      invoices: [
        {
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-001",
          invoiceType: InvoiceType.TUITION,
          classId: fixtures.classId,
          studentId: fixtures.studentId,
          status: InvoiceStatus.APPROVED,
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          sessions: 10,
          bonusSessions: 2,
          trialSessions: 1,
          sessionsRemaining: 3,
          bonusSessionsRemaining: 0,
          trialSessionsRemaining: 0,
          referenceDuration: 60,
        },
      ],
    });

    const result = await service.getComprehensiveReport();

    expect(result.meta).toEqual({
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    });
    expect(result.maxSessions).toBe(13);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].invoiceNumber).toBe("INV-001");
    expect(result.rows[0].sessionsCompleted).toBe(2);
    expect(result.rows[0].totalSessions).toBe(13);
  });

  it("ignores cancelled invoices when deriving invoice-based totalSessions", async () => {
    const fixtures = buildFixtures();
    const { service } = buildService({
      aggregateResults: [[{ total: 1 }], buildPagePair(fixtures.classId, fixtures.firstStudent)],
      classDocs: [fixtures.classroom],
      attendances: fixtures.attendances,
      invoices: [
        {
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-CANCELLED",
          invoiceType: InvoiceType.TUITION,
          classId: fixtures.classId,
          studentId: fixtures.studentId,
          status: InvoiceStatus.CANCELLED,
          createdAt: new Date("2026-03-12T00:00:00.000Z"),
          sessions: 50,
          bonusSessions: 0,
          trialSessions: 0,
          sessionsRemaining: 50,
          bonusSessionsRemaining: 0,
          trialSessionsRemaining: 0,
          referenceDuration: 60,
        },
        {
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-ACTIVE",
          invoiceType: InvoiceType.TUITION,
          classId: fixtures.classId,
          studentId: fixtures.studentId,
          status: InvoiceStatus.APPROVED,
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          sessions: 6,
          bonusSessions: 1,
          trialSessions: 1,
          sessionsRemaining: 6,
          bonusSessionsRemaining: 1,
          trialSessionsRemaining: 1,
          referenceDuration: 60,
        },
      ],
    });

    const result = await service.getComprehensiveReport();

    expect(result.rows[0].invoiceNumber).toBe("INV-ACTIVE");
    expect(result.rows[0].totalSessions).toBe(8);
  });

  it("falls back to attendance plus remaining sessions when legacy invoices lack purchased-session fields", async () => {
    const fixtures = buildFixtures();
    const { service } = buildService({
      aggregateResults: [[{ total: 1 }], buildPagePair(fixtures.classId, fixtures.firstStudent)],
      classDocs: [fixtures.classroom],
      attendances: fixtures.attendances,
      invoices: [
        {
          _id: new Types.ObjectId(),
          invoiceNumber: "INV-LEGACY",
          invoiceType: InvoiceType.TUITION,
          classId: fixtures.classId,
          studentId: fixtures.studentId,
          status: InvoiceStatus.APPROVED,
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          sessionsRemaining: 4,
          bonusSessionsRemaining: 1,
          trialSessionsRemaining: 0,
          referenceDuration: 60,
        },
      ],
    });

    const result = await service.getComprehensiveReport();

    expect(result.rows[0].sessionsCompleted).toBe(2);
    expect(result.rows[0].totalSessions).toBe(7);
  });

  it("returns paginated meta and only loads the requested page of pairs", async () => {
    const fixtures = buildFixtures();
    const { service, classroomModel } = buildService({
      aggregateResults: [
        [{ total: 2 }],
        buildPagePair(fixtures.classId, fixtures.secondStudent),
      ],
      classDocs: [fixtures.classroom],
      attendances: [],
      invoices: [],
    });

    const result = await service.getComprehensiveReport(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      2,
      1,
    );

    expect(classroomModel.aggregate).toHaveBeenCalledTimes(2);
    expect(result.meta).toEqual({
      total: 2,
      page: 2,
      limit: 1,
      totalPages: 2,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentId).toBe(fixtures.secondStudentId.toString());
    expect(result.rows[0].studentCode).toBe("HS002");
  });

  it("applies class mode filtering before paginating the report pairs", async () => {
    const fixtures = buildFixtures();
    const offlineClassroom = {
      ...fixtures.classroom,
      classMode: "OFFLINE",
    };
    const { service, classroomModel } = buildService({
      aggregateResults: [[{ total: 1 }], buildPagePair(fixtures.classId, fixtures.firstStudent)],
      classDocs: [offlineClassroom],
      attendances: [],
      invoices: [],
    });

    await service.getComprehensiveReport(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      50,
      "OFFLINE",
    );

    expect(classroomModel.aggregate).toHaveBeenCalledTimes(2);
    for (const [pipeline] of classroomModel.aggregate.mock.calls) {
      expect(pipeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            $match: { classMode: "OFFLINE" },
          }),
        ]),
      );
    }
  });
});

describe("StudentReportService.getStudentReport", () => {
  it("returns paginated rows and meta for the requested page", async () => {
    const fixtures = buildFixtures();
    const { service } = buildService({
      studentDocs: [fixtures.secondStudent],
      studentCount: 2,
      attendanceAggregates: [],
    });

    const result = await service.getStudentReport(
      undefined,
      "Student",
      undefined,
      2,
      1,
    );

    expect(result.meta).toEqual({
      total: 2,
      page: 2,
      limit: 1,
      totalPages: 2,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentCode).toBe("HS002");
  });

  it("filters by class membership without loading all classes", async () => {
    const fixtures = buildFixtures();
    const { service, classroomModel } = buildService({
      classDoc: {
        _id: fixtures.classId,
        students: [fixtures.studentId],
      },
      studentDocs: [fixtures.firstStudent],
      studentCount: 1,
      attendanceAggregates: [
        { _id: fixtures.studentId, totalAttendance: 2 },
      ],
    });

    const result = await service.getStudentReport(
      fixtures.classId.toString(),
      undefined,
      undefined,
      1,
      25,
    );

    expect(classroomModel.findOne).toHaveBeenCalled();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].studentCode).toBe("HS001");
    expect(result.rows[0].totalAttendance).toBe(2);
  });
});

describe("StudentReportService.getComprehensiveReportClasses", () => {
  it("returns lightweight class options with student counts for the selected class mode", async () => {
    const fixtures = buildFixtures();
    const { service, classroomModel } = buildService({
      aggregateResults: [
        [
          {
            _id: fixtures.classId,
            code: "CLS-01",
            name: "Math 1-1",
            studentCount: 2,
          },
        ],
      ],
    });

    const result = await service.getComprehensiveReportClasses(
      undefined,
      undefined,
      500,
      "OFFLINE",
    );

    expect(classroomModel.aggregate).toHaveBeenCalledTimes(1);
    expect(classroomModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          $match: { classMode: "OFFLINE" },
        }),
      ]),
    );
    expect(result).toEqual([
      {
        _id: fixtures.classId.toString(),
        code: "CLS-01",
        name: "Math 1-1",
        studentCount: 2,
      },
    ]);
  });
});

describe("StudentReportService.getStudentReportClasses", () => {
  it("reuses the lightweight class option query for student report filters", async () => {
    const fixtures = buildFixtures();
    const { service } = buildService({
      aggregateResults: [
        [
          {
            _id: fixtures.classId,
            code: "CLS-01",
            name: "Math 1-1",
            studentCount: 2,
          },
        ],
      ],
    });

    const result = await service.getStudentReportClasses();

    expect(result).toEqual([
      {
        _id: fixtures.classId.toString(),
        code: "CLS-01",
        name: "Math 1-1",
        studentCount: 2,
      },
    ]);
  });
});
