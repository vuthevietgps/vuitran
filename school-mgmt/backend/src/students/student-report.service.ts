import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Student, StudentDocument } from "./schemas/student.schema";
import {
  Attendance,
  AttendanceDocument,
} from "../attendance/schemas/attendance.schema";
import { Classroom, ClassroomDocument } from "../classes/schemas/class.schema";
import {
  Invoice,
  InvoiceDocument,
  InvoiceStatus,
  InvoiceType,
} from "../invoices/schemas/invoice.schema";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Role } from "../common/interfaces/role.enum";
import {
  getDurationForStudentAt,
  getTeacherIdForStudentAt,
  objectIdToString,
} from "../classes/student-config.utils";

@Injectable()
export class StudentReportService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name)
    private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
  ) {}

  private getActorId(actor?: JwtPayload): string | null {
    return actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
  }

  private getComprehensiveReportClassFilter(actor?: JwtPayload) {
    if (actor?.role !== Role.SALE) {
      return {};
    }

    const actorId = this.getActorId(actor);
    if (!actorId) {
      return { _id: { $exists: false } };
    }

    return {
      $or: [
        { sale: new Types.ObjectId(actorId) },
        { classMode: 'OFFLINE', status: 'ACTIVE' },
      ],
    };
  }

  private buildComprehensiveReportEmptyResult(limit?: number) {
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return {
      maxSessions: 0,
      rows: [],
      meta: { total: 0, page: 1, limit: safeLimit, totalPages: 1 },
    };
  }

  private buildStudentReportEmptyResult(limit?: number) {
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 200);
    return {
      rows: [],
      meta: { total: 0, page: 1, limit: safeLimit, totalPages: 1 },
    };
  }

  private buildComprehensiveReportPairPipeline(options: {
    classFilter: any;
    normalizedTerm: string;
    selectedSaleId: string;
    selectedDataStatus: string;
    selectedClassMode: '' | 'ONLINE' | 'OFFLINE';
  }): any[] {
    const pipeline: any[] = [
      { $match: options.classFilter },
    ];

    if (options.selectedClassMode) {
      pipeline.push({
        $match: { classMode: options.selectedClassMode },
      });
    }

    pipeline.push(
      { $unwind: "$students" },
      {
        $lookup: {
          from: this.studentModel.collection.name,
          localField: "students",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
    );

    if (options.selectedSaleId) {
      pipeline.push({
        $match: {
          $expr: {
            $eq: [
              { $ifNull: ["$student.saleId", "$sale"] },
              new Types.ObjectId(options.selectedSaleId),
            ],
          },
        },
      });
    }

    if (options.normalizedTerm) {
      const escapedTerm = options.normalizedTerm.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const regex = new RegExp(escapedTerm, "i");
      pipeline.push({
        $match: {
          $or: [
            { "student.fullName": regex },
            { "student.parentName": regex },
            { "student.parentPhone": regex },
            { "student.studentCode": regex },
            { "student.saleName": regex },
            { code: regex },
            { name: regex },
          ],
        },
      });
    }

    if (options.selectedDataStatus) {
      pipeline.push(
        {
          $lookup: {
            from: this.invoiceModel.collection.name,
            let: { classId: "$_id", studentId: "$student._id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$classId", "$$classId"] },
                      { $eq: ["$studentId", "$$studentId"] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, status: 1 } },
            ],
            as: "latestInvoice",
          },
        },
        {
          $addFields: {
            latestInvoiceStatus: {
              $let: {
                vars: {
                  invoice: { $arrayElemAt: ["$latestInvoice", 0] },
                },
                in: "$$invoice.status",
              },
            },
          },
        },
        {
          $addFields: {
            resolvedDataStatus: {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: ["$latestInvoiceStatus", InvoiceStatus.CANCELLED],
                    },
                    then: "HOAN_HOC_PHI",
                  },
                  { case: { $eq: ["$status", "INACTIVE"] }, then: "BAO_LUU" },
                  {
                    case: { $in: ["$status", ["COMPLETED", "CANCELLED"]] },
                    then: "KET_THUC",
                  },
                  {
                    case: {
                      $and: [
                        { $gt: [{ $ifNull: ["$totalSessions", 0] }, 0] },
                        {
                          $gte: [
                            { $ifNull: ["$sessionsCompleted", 0] },
                            { $ifNull: ["$totalSessions", 0] },
                          ],
                        },
                      ],
                    },
                    then: "KET_THUC",
                  },
                ],
                default: "DANG_HOC",
              },
            },
          },
        },
        { $match: { resolvedDataStatus: options.selectedDataStatus } },
      );
    }

    return pipeline;
  }

  async getStudentReport(
    classId?: string,
    searchTerm?: string,
    actor?: JwtPayload,
    page: number = 1,
    limit: number = 25,
  ) {
    const studentFilter: any = {};
    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (actorId) {
        studentFilter.saleId = new Types.ObjectId(actorId);
      }
    }
    if (searchTerm) {
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      studentFilter.$or = [
        { fullName: { $regex: escapedTerm, $options: "i" } },
        { parentName: { $regex: escapedTerm, $options: "i" } },
        { parentPhone: { $regex: escapedTerm, $options: "i" } },
        { studentCode: { $regex: escapedTerm, $options: "i" } },
      ];
    }

    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        return this.buildStudentReportEmptyResult(limit);
      }

      const classFilter: any = this.getComprehensiveReportClassFilter(actor);
      classFilter._id = new Types.ObjectId(classId);

      const matchedClass = await this.classroomModel
        .findOne(classFilter)
        .select("students")
        .lean();

      if (!matchedClass) {
        return this.buildStudentReportEmptyResult(limit);
      }

      const classStudentIds = ((matchedClass as any).students || [])
        .map((studentId: any) => studentId?.toString?.())
        .filter(Boolean)
        .map((studentId: string) => new Types.ObjectId(studentId));

      if (classStudentIds.length === 0) {
        return this.buildStudentReportEmptyResult(limit);
      }

      studentFilter._id = { $in: classStudentIds };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 200);
    const total = await this.studentModel.countDocuments(studentFilter);
    if (total === 0) {
      return this.buildStudentReportEmptyResult(safeLimit);
    }

    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);

    const students = await this.studentModel
      .find(studentFilter)
      .populate("productPackage", "name price")
      .sort({ fullName: 1, studentCode: 1, _id: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

    const studentIds = students.map((s) => new Types.ObjectId((s as any)._id));
    const attendanceMatch: any = {
      studentId: { $in: studentIds },
      status: "PRESENT",
    };
    if (classId && Types.ObjectId.isValid(classId)) {
      attendanceMatch.classId = new Types.ObjectId(classId);
    }
    const attendanceCounts = await this.attendanceModel.aggregate([
      {
        $match: attendanceMatch,
      },
      {
        $group: {
          _id: "$studentId",
          totalAttendance: { $sum: 1 },
        },
      },
    ]);

    const attendanceMap = new Map(
      attendanceCounts.map((item) => [
        item._id.toString(),
        item.totalAttendance,
      ]),
    );

    const rows = students.map((student) => {
      const studentId = (student as any)._id.toString();
      return {
        _id: student._id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        age: student.age,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        faceImage: student.faceImage,
        productPackage: student.productPackage,
        totalAttendance: attendanceMap.get(studentId) || 0,
      };
    });

    return {
      rows,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
      },
    };
  }

  async getStudentReportClasses(
    searchTerm?: string,
    actor?: JwtPayload,
    limit: number = 500,
    classMode?: 'ONLINE' | 'OFFLINE',
  ) {
    return this.getComprehensiveReportClasses(searchTerm, actor, limit, classMode);
  }

  async getComprehensiveReportClasses(
    searchTerm?: string,
    actor?: JwtPayload,
    limit: number = 500,
    classMode?: 'ONLINE' | 'OFFLINE',
  ) {
    const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 1000);
    const classFilter: any = this.getComprehensiveReportClassFilter(actor);
    const selectedClassMode =
      classMode === 'ONLINE' || classMode === 'OFFLINE' ? classMode : '';

    const pipeline: any[] = [{ $match: classFilter }];

    if (selectedClassMode) {
      pipeline.push({
        $match: { classMode: selectedClassMode },
      });
    }

    if (searchTerm?.trim()) {
      const escapedTerm = searchTerm
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedTerm, "i");
      pipeline.push({
        $match: {
          $or: [{ code: regex }, { name: regex }],
        },
      });
    }

    pipeline.push(
      { $sort: { code: 1, name: 1 } },
      { $limit: safeLimit },
      {
        $project: {
          _id: 1,
          code: { $ifNull: ["$code", ""] },
          name: { $ifNull: ["$name", { $ifNull: ["$code", "Lop hoc"] }] },
          studentCount: { $size: { $ifNull: ["$students", []] } },
        },
      },
    );

    const classes = await this.classroomModel.aggregate(pipeline);

    return classes.map((cls: any) => ({
      _id: cls._id.toString(),
      code: cls.code || "",
      name: cls.name || cls.code || "Lop hoc",
      studentCount: Number(cls.studentCount || 0),
    }));
  }

  async getComprehensiveReport(
    classId?: string,
    searchTerm?: string,
    actor?: JwtPayload,
    saleId?: string,
    dataStatus?: string,
    page: number = 1,
    limit: number = 50,
    classMode?: 'ONLINE' | 'OFFLINE',
  ) {
    const toSafeNumber = (value: unknown, fallback = 0): number => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };
    const roundMoneyToThousand = (value: number): number => {
      if (!Number.isFinite(value) || value <= 0) return 0;
      return Math.round(value / 1000) * 1000;
    };
    const roundMoneyDownToThousand = (value: number): number => {
      if (!Number.isFinite(value) || value <= 0) return 0;
      return Math.floor(value / 1000) * 1000;
    };
    const floorSessionCount = (value: number): number => {
      if (!Number.isFinite(value) || value <= 0) return 0;
      return Math.floor(value);
    };
    const getPurchasedSessionsFromInvoice = (invoice: any): number => {
      if (!invoice) return 0;

      const invoiceType = String(invoice?.invoiceType || InvoiceType.TUITION);
      if (invoiceType && invoiceType !== InvoiceType.TUITION) {
        return 0;
      }

      return floorSessionCount(
        Math.max(0, toSafeNumber(invoice?.sessions, 0)) +
          Math.max(0, toSafeNumber(invoice?.bonusSessions, 0)) +
          Math.max(0, toSafeNumber(invoice?.trialSessions, 0)),
      );
    };

    const getPairKey = (studentId: any, classId: any): string =>
      `${studentId?.toString?.() || ""}_${classId?.toString?.() || ""}`;

    const getTeacherEntityId = (value: any): string =>
      value?._id?.toString?.() || value?.toString?.() || "";

    const buildTeacherDirectory = (cls: any): Map<string, any> => {
      const teachers = new Map<string, any>();
      const registerTeacher = (teacher: any) => {
        const teacherId = getTeacherEntityId(teacher);
        if (teacherId) {
          teachers.set(teacherId, teacher);
        }
      };

      registerTeacher((cls as any)?.teacher);
      for (const config of (cls as any)?.studentConfigs || []) {
        for (const slot of config?.teacherSlots || []) {
          registerTeacher(slot?.teacherId);
        }
      }
      for (const substitute of (cls as any)?.substituteTeachers || []) {
        registerTeacher(substitute?.teacherId);
      }

      return teachers;
    };

    const getActiveSubstituteTeacherForDate = (
      cls: any,
      sessionDate?: Date | null,
    ): any | null => {
      if (!cls || !sessionDate) return null;
      const targetTime = new Date(sessionDate).getTime();
      if (!Number.isFinite(targetTime)) return null;
      return (
        ((cls as any)?.substituteTeachers || []).find((substitute: any) => {
          const fromTime = new Date(substitute?.fromDate).getTime();
          const toTime = new Date(substitute?.toDate).getTime();
          return (
            Number.isFinite(fromTime) &&
            Number.isFinite(toTime) &&
            targetTime >= fromTime &&
            targetTime <= toTime
          );
        })?.teacherId || null
      );
    };

    const resolvePairSaleId = (student: any, cls: any): string =>
      student?.saleId?.toString?.() ||
      ((cls as any)?.sale as any)?._id?.toString?.() ||
      ((cls as any)?.sale as any)?.toString?.() ||
      "";

    const resolvePairSaleName = (student: any, cls: any): string =>
      student?.saleName || ((cls as any)?.sale as any)?.fullName || "";

    const resolveDataStatus = (cls: any, pairInvoices: any[]): string => {
      const latestInvoice = pairInvoices[0];
      if (latestInvoice?.status === InvoiceStatus.CANCELLED) {
        return "HOAN_HOC_PHI";
      }

      const classStatus = cls?.status || "ACTIVE";
      const totalSessions = toSafeNumber(cls?.totalSessions, 0);
      const sessionsCompleted = toSafeNumber(cls?.sessionsCompleted, 0);

      if (classStatus === "INACTIVE") return "BAO_LUU";
      if (classStatus === "COMPLETED" || classStatus === "CANCELLED")
        return "KET_THUC";
      if (totalSessions > 0 && sessionsCompleted >= totalSessions)
        return "KET_THUC";
      return "DANG_HOC";
    };

    const classFilter: any = this.getComprehensiveReportClassFilter(actor);
    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        return this.buildComprehensiveReportEmptyResult(limit);
      }
      classFilter._id = new Types.ObjectId(classId);
    }

    type Pair = { student: any; cls: any };
    const normalizedTerm = searchTerm?.trim() || "";
    const saleActorId = actor?.role === Role.SALE ? this.getActorId(actor) : null;
    const selectedSaleId = saleActorId || (saleId?.trim() || "");
    const selectedDataStatus = dataStatus?.trim() || "";
    const selectedClassMode =
      classMode === "ONLINE" || classMode === "OFFLINE" ? classMode : "";
    if (selectedSaleId && !Types.ObjectId.isValid(selectedSaleId)) {
      return this.buildComprehensiveReportEmptyResult(limit);
    }

    const basePipeline = this.buildComprehensiveReportPairPipeline({
      classFilter,
      normalizedTerm,
      selectedSaleId,
      selectedDataStatus,
      selectedClassMode,
    });

    const countResult = await this.classroomModel.aggregate([
      ...basePipeline,
      { $count: "total" },
    ]);
    const total = Number(countResult[0]?.total || 0);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

    if (total === 0) {
      return this.buildComprehensiveReportEmptyResult(safeLimit);
    }

    const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
    const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);

    const pagePairsRaw = await this.classroomModel.aggregate([
      ...basePipeline,
      {
        $sort: {
          code: 1,
          name: 1,
          "student.studentCode": 1,
          "student.fullName": 1,
          _id: 1,
          "student._id": 1,
        },
      },
      { $skip: (safePage - 1) * safeLimit },
      { $limit: safeLimit },
      {
        $project: {
          _id: 0,
          classId: "$_id",
          student: {
            _id: "$student._id",
            studentCode: "$student.studentCode",
            fullName: "$student.fullName",
            age: "$student.age",
            grade: "$student.grade",
            level: "$student.level",
            dateOfBirth: "$student.dateOfBirth",
            studentBirthMonth: "$student.studentBirthMonth",
            parentBirthMonth: "$student.parentBirthMonth",
            parentName: "$student.parentName",
            parentPhone: "$student.parentPhone",
            faceImage: "$student.faceImage",
            saleId: "$student.saleId",
            saleName: "$student.saleName",
          },
        },
      },
    ]);

    const pageClassIds = Array.from(
      new Set(
        pagePairsRaw
          .map((pair: any) => pair?.classId?.toString?.())
          .filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id as string));

    const classes = await this.classroomModel
      .find({ _id: { $in: pageClassIds } })
      .populate("teacher", "userCode fullName email")
      .populate("sale", "fullName email")
      .populate("invoiceId", "invoiceNumber")
      .populate(
        "studentConfigs.teacherSlots.teacherId",
        "userCode fullName email",
      )
      .populate("substituteTeachers.teacherId", "userCode fullName email")
      .lean();

    const classById = new Map(classes.map((c) => [(c as any)._id.toString(), c]));
    const pagedPairs: Pair[] = pagePairsRaw
      .map((pair: any) => {
        const cls = classById.get(pair.classId?.toString?.() || "");
        if (!cls || !pair?.student) {
          return null;
        }
        return {
          student: pair.student,
          cls,
        };
      })
      .filter((pair): pair is Pair => !!pair);

    if (pagedPairs.length === 0) {
      return {
        maxSessions: 0,
        rows: [],
        meta: { total, page: safePage, limit: safeLimit, totalPages },
      };
    }

    const teacherDirectoryByClass = new Map(
      classes.map((cls) => [
        (cls as any)._id.toString(),
        buildTeacherDirectory(cls),
      ]),
    );

    const classIds = Array.from(
      new Set(
        pagedPairs.map(({ cls }) => (cls as any)._id?.toString()).filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id as string));
    const uniqueStudentIds = Array.from(
      new Set(
        pagedPairs.map(({ student }) => student?._id?.toString()).filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id as string));

    const attendances = await this.attendanceModel
      .find({
        classId: { $in: classIds },
        studentId: { $in: uniqueStudentIds },
      })
      .populate("teacherId", "userCode fullName email")
      .sort({ date: 1 })
      .lean();

    const rawAttendanceLookup = new Map<string, any[]>();
    for (const att of attendances) {
      const key = getPairKey(att.studentId, att.classId);
      if (!rawAttendanceLookup.has(key)) {
        rawAttendanceLookup.set(key, []);
      }
      rawAttendanceLookup.get(key)!.push(att);
    }

    const attendanceLookup = new Map<string, any[]>();
    for (const [key, items] of rawAttendanceLookup.entries()) {
      const sessions: any[] = [];
      const overflowSessions: any[] = [];

      for (const att of items) {
        const cls = classById.get(att.classId?.toString() || "");
        const attendanceDate = att.date ? new Date(att.date) : null;
        const attendanceTeacher = att.teacherId as any;
        const studentId = objectIdToString(att.studentId) || "";
        const substituteTeacher = getActiveSubstituteTeacherForDate(
          cls,
          attendanceDate,
        );
        const configuredTeacherId = getTeacherIdForStudentAt(
          cls,
          studentId,
          attendanceDate,
        );
        const resolvedTeacherId =
          getTeacherEntityId(substituteTeacher) || configuredTeacherId || "";
        const teacherDirectory =
          teacherDirectoryByClass.get(att.classId?.toString() || "") ||
          new Map<string, any>();
        const resolvedTeacher =
          (resolvedTeacherId
            ? teacherDirectory.get(resolvedTeacherId)
            : null) || attendanceTeacher;
        const teacherCode =
          resolvedTeacher?.userCode || attendanceTeacher?.userCode || "";
        const teacherName =
          resolvedTeacher?.fullName || attendanceTeacher?.fullName || "";
        const teacherDisplay =
          [teacherCode, teacherName].filter(Boolean).join(" - ") ||
          resolvedTeacher?.email ||
          attendanceTeacher?.email ||
          teacherName ||
          teacherCode ||
          "";
        const durationConfig = getDurationForStudentAt(
          cls,
          studentId,
          attendanceDate,
        );
        const sessionInfo = {
          date: att.date
            ? new Date(att.date).toISOString().split("T")[0]
            : null,
          status: att.status || null,
          attendedAt: att.attendedAt || null,
          duration: toSafeNumber(
            att.sessionDuration,
            durationConfig.sessionDuration,
          ),
          teacherCode:
            teacherCode || attendanceTeacher?.email || teacherName || "",
          teacherName,
          teacherDisplay,
          sessionIndex: toSafeNumber(att.sessionIndex, 0) || null,
        };
        const explicitIndex = toSafeNumber(att.sessionIndex, 0);

        if (explicitIndex > 0) {
          sessions[explicitIndex - 1] = sessionInfo;
          continue;
        }

        overflowSessions.push(sessionInfo);
      }

      let nextIndex = 0;
      for (const sessionInfo of overflowSessions) {
        while (sessions[nextIndex]) {
          nextIndex += 1;
        }
        sessions[nextIndex] = sessionInfo;
        nextIndex += 1;
      }

      attendanceLookup.set(key, sessions);
    }

    const invoices = await this.invoiceModel
      .find({
        classId: { $in: classIds },
        studentId: { $in: uniqueStudentIds },
      })
      .select(
        "invoiceNumber invoiceType classId studentId status createdAt referenceDuration sessions bonusSessions trialSessions sessionsRemaining bonusSessionsRemaining trialSessionsRemaining",
      )
      .sort({ createdAt: -1 })
      .lean();

    const invoicesByPair = new Map<string, any[]>();
    for (const inv of invoices) {
      const key = getPairKey((inv as any).studentId, (inv as any).classId);
      if (!invoicesByPair.has(key)) {
        invoicesByPair.set(key, []);
      }
      invoicesByPair.get(key)!.push(inv);
    }

    const invoiceByClass = new Map<string, string>();
    for (const cls of classes) {
      const snapshotInvoiceNumber = String(
        (cls as any).pricingSnapshot?.sourceInvoiceNumber || "",
      ).trim();
      invoiceByClass.set(
        (cls as any)._id.toString(),
        ((cls as any).invoiceId as any)?.invoiceNumber || snapshotInvoiceNumber,
      );
    }

    let maxSessions = 0;
    const rows = pagedPairs.map(({ student, cls }) => {
      const key = getPairKey(student._id, (cls as any)._id);
      const sessions = attendanceLookup.get(key) || [];
      const pairInvoices = invoicesByPair.get(key) || [];
      const activePairInvoices = pairInvoices.filter(
        (invoice) =>
          ![InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED].includes(
            invoice?.status,
          ),
      );
      const activeTuitionInvoices = activePairInvoices.filter((invoice) => {
        const invoiceType = String(
          (invoice as any)?.invoiceType || InvoiceType.TUITION,
        );
        return !invoiceType || invoiceType === InvoiceType.TUITION;
      });
      const hasInvoiceSessionSource = activeTuitionInvoices.some(
        (invoice) =>
          (invoice as any)?.sessions !== undefined ||
          (invoice as any)?.bonusSessions !== undefined ||
          (invoice as any)?.trialSessions !== undefined,
      );
      const invoiceTotalSessions = activeTuitionInvoices.reduce(
        (sum, invoice) => sum + getPurchasedSessionsFromInvoice(invoice),
        0,
      );
      const activeInvoice = activePairInvoices[0];
      const latestInvoice = pairInvoices[0];

      const attendedCount = sessions.filter(
        (s) => s.status === "PRESENT",
      ).length;
      const absentCount = sessions.filter((s) => s.status === "ABSENT").length;

      const classMode = (cls as any).classMode || "ONLINE";
      const snapshot = (cls as any).pricingSnapshot || {};
      const teacherPayPerSession = toSafeNumber(
        snapshot.teacherPayPerSession,
        toSafeNumber(
          (cls as any).teacherPayPerSession,
          toSafeNumber((cls as any).teacherSalaryCost, 0),
        ),
      );
      const teacherPayPerStudent = toSafeNumber(
        snapshot.teacherPayPerStudent,
        toSafeNumber((cls as any).teacherPayPerStudent, 0),
      );
      const teacherSalary = roundMoneyDownToThousand(
        classMode === "OFFLINE" ? teacherPayPerStudent : teacherPayPerSession,
      );
      const teacherSalaryType =
        classMode === "OFFLINE" ? "PER_STUDENT" : "PER_SESSION";

      const classTeacher = (cls as any).teacher as any;
      const currentTeacherId = getTeacherIdForStudentAt(
        cls,
        student._id?.toString?.() || "",
      );
      const configuredTeacher = ((cls as any).studentConfigs || [])
        .flatMap((config: any) => config?.teacherSlots || [])
        .map((slot: any) => slot?.teacherId)
        .find(
          (teacher: any) => teacher?._id?.toString?.() === currentTeacherId,
        ) as any;
      const displayTeacher = configuredTeacher || classTeacher;
      const classTeacherCode =
        displayTeacher?.userCode || displayTeacher?.email || "";
      const classTeacherName = displayTeacher?.fullName || "";
      const teacherCodeAndName = [classTeacherCode, classTeacherName]
        .filter(Boolean)
        .join(" - ");
      const currentDuration = getDurationForStudentAt(
        cls,
        student._id?.toString?.() || "",
      );
      const fallbackReferenceDuration =
        toSafeNumber(
          snapshot.referenceDuration,
          toSafeNumber((cls as any).baseDuration, 60),
        ) || 60;
      const remainingMinutes = activePairInvoices.reduce((sum, invoice) => {
        const referenceDuration =
          toSafeNumber(
            (invoice as any)?.referenceDuration,
            fallbackReferenceDuration,
          ) || fallbackReferenceDuration;
        return (
          sum +
          (toSafeNumber((invoice as any)?.sessionsRemaining, 0) +
            toSafeNumber((invoice as any)?.bonusSessionsRemaining, 0) +
            toSafeNumber((invoice as any)?.trialSessionsRemaining, 0)) *
            referenceDuration
        );
      }, 0);
      const storedTotalSessions = floorSessionCount(
        toSafeNumber(
          currentDuration.totalSessions,
          toSafeNumber((cls as any).totalSessions, 0),
        ),
      );
      const projectedTotalSessions =
        sessions.length +
        (currentDuration.sessionDuration > 0
          ? remainingMinutes / currentDuration.sessionDuration
          : 0);
      const totalSessions = hasInvoiceSessionSource
        ? invoiceTotalSessions
        : projectedTotalSessions > 0
          ? floorSessionCount(projectedTotalSessions)
          : storedTotalSessions;
      const sessionsCompleted = sessions.length;
      const saleId = resolvePairSaleId(student, cls);
      const saleName = resolvePairSaleName(student, cls);

      maxSessions = Math.max(maxSessions, sessions.length, totalSessions);

      return {
        studentId: student._id?.toString(),
        studentCode: student.studentCode || "",
        fullName: student.fullName || "",
        age: student.age || 0,
        parentName: student.parentName || "",
        parentPhone: student.parentPhone || "",
        faceImage: student.faceImage || "",
        classId: (cls as any)._id?.toString(),
        classCode: cls.code || "",
        className: cls.name || "",
        subject: cls.subject || "",
        grade: cls.grade || "",
        level: student.level || student.grade || cls.grade || "",
        dateOfBirth: student.dateOfBirth || null,
        studentBirthMonth: student.studentBirthMonth || null,
        parentBirthMonth: student.parentBirthMonth || null,
        teacherName: classTeacherName,
        teacherCode: classTeacherCode,
        teacherCodeAndName,
        classMode,
        teacherSalary,
        teacherSalaryType,
        invoiceNumber:
          activeInvoice?.invoiceNumber ||
          latestInvoice?.invoiceNumber ||
          invoiceByClass.get((cls as any)._id?.toString()) ||
          "",
        pricePerSession: roundMoneyToThousand(
          toSafeNumber(cls.pricePerSession, 0),
        ),
        totalSessions,
        sessionsCompleted,
        saleId,
        saleName,
        dataStatus: resolveDataStatus(cls, pairInvoices),
        attendedCount,
        absentCount,
        sessions,
      };
    });

    return {
      maxSessions,
      rows,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
      },
    };
  }
}
