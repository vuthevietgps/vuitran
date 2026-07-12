import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';

import {
  Session,
  SessionDocument,
  SessionStatus,
} from './schemas/session.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  Attendance,
  AttendanceDocument,
  AttendanceStatus,
} from '../attendance/schemas/attendance.schema';

import { QuerySessionDto } from './dto/query-session.dto';
import { SessionPayrollService } from './session-payroll.service';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

import {
  objectIdToString,
  toSafeNumber,
  shouldKeepZeroTeacherPayout,
  isTimeOverlap,
  buildShareholderDisplayLabel,
} from './helpers/session.utils';
import { StorageUrlService } from '../common/storage-url.service';

@Injectable()
export class SessionQueryService {
  private readonly logger = new Logger(SessionQueryService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    private sessionPayrollService: SessionPayrollService,
    private readonly storageUrlService: StorageUrlService,
  ) {}

  // ──────────────────────────────────────────────────────────────────
  //  PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────

  private sanitizeTeachingReportSessionForShareholder(session: any) {
    const studentLabel = buildShareholderDisplayLabel(
      'HS',
      session?.studentId?.studentCode,
      session?.studentId?._id,
    );
    const teacherLabel = buildShareholderDisplayLabel(
      'GV',
      session?.teacherId?.userCode,
      session?.teacherId?._id,
    );

    return this.storageUrlService.transformSensitiveAssetUrls({
      _id: session?._id,
      classId: session?.classId
        ? {
            _id: session.classId._id,
            name: session.classId.name,
            code: session.classId.code,
          }
        : null,
      studentId: session?.studentId
        ? {
            _id: session.studentId._id,
            fullName: studentLabel,
            studentCode: session.studentId.studentCode,
          }
        : { fullName: studentLabel },
      teacherId: session?.teacherId
        ? {
            _id: session.teacherId._id,
            fullName: teacherLabel,
          }
        : { fullName: teacherLabel },
      scheduledDate: session?.scheduledDate,
      scheduledStartTime: session?.scheduledStartTime,
      scheduledEndTime: session?.scheduledEndTime,
      attendedAt: session?.attendedAt || null,
      attendanceStatus: session?.attendanceStatus || null,
      durationMinutes: session?.durationMinutes,
      teacherPayout: 0,
      status: session?.status,
      teachingReport: session?.teachingReport
        ? {
            lessonContent: session.teachingReport.lessonContent,
            studentAttitude: session.teachingReport.studentAttitude,
            recordingUrl: session.teachingReport.recordingUrl,
            teacherComment: session.teachingReport.teacherComment,
            homework: session.teachingReport.homework,
            additionalNotes: session.teachingReport.additionalNotes,
            templateId: session.teachingReport.templateId,
            templateTitle: session.teachingReport.templateTitle,
            templateVersion: session.teachingReport.templateVersion,
            dynamicFieldValues: session.teachingReport.dynamicFieldValues,
            dynamicFieldSchemaSnapshot: session.teachingReport.dynamicFieldSchemaSnapshot,
            submittedAt: session.teachingReport.submittedAt,
            deadline: session.teachingReport.deadline,
            isLateSubmission: session.teachingReport.isLateSubmission,
          }
        : undefined,
      evaluation: session?.evaluation
        ? {
            lessonProgressStatus: session.evaluation.lessonProgressStatus,
            progressPercent: session.evaluation.progressPercent,
            studentPerformance: session.evaluation.studentPerformance,
            studentEngagement: session.evaluation.studentEngagement,
            comprehensionLevel: session.evaluation.comprehensionLevel,
            deviationReason: session.evaluation.deviationReason,
            nextSessionPlan: session.evaluation.nextSessionPlan,
            overallComment: session.evaluation.overallComment,
            homeworkSubmissionMode: session.evaluation.homeworkSubmissionMode,
            homeworkDeadline: session.evaluation.homeworkDeadline,
            homeworkMaterialIds: session.evaluation.homeworkMaterialIds,
            homeworkQuizIds: session.evaluation.homeworkQuizIds,
            homeworkAssigned: session.evaluation.homeworkAssigned,
            homeworkStatus: session.evaluation.homeworkStatus,
          }
        : undefined,
      hasTeachingReport: session?.hasTeachingReport === true,
    });
  }

  private async resolveParentUserIdForSession(session: {
    parentUserId?: any;
    studentId: any;
  }): Promise<string | null> {
    const direct = objectIdToString(session.parentUserId);
    if (direct) return direct;

    const student = await this.studentModel
      .findById(session.studentId)
      .select('parentUserId')
      .lean();
    return objectIdToString((student as any)?.parentUserId);
  }

  private hasClassCoTeacherPermission(
    classroom: any,
    teacherId: string,
    permission: 'attendance' | 'reports' | 'any' = 'any',
  ): boolean {
    const coTeachers = Array.isArray(classroom?.coTeachers) ? classroom.coTeachers : [];
    if (coTeachers.length === 0) {
      return false;
    }

    return coTeachers.some((coTeacher: any) => {
      if (objectIdToString(coTeacher?.teacherId) !== teacherId) {
        return false;
      }

      if (permission === 'attendance') {
        return coTeacher?.canManageAttendance !== false;
      }

      if (permission === 'reports') {
        return coTeacher?.canManageReports !== false;
      }

      return true;
    });
  }

  private async getAccessibleClassIdsForTeacher(
    teacherId: string,
    permission: 'attendance' | 'reports' | 'any' = 'any',
  ): Promise<Types.ObjectId[]> {
    const classrooms = await this.classModel
      .find({ 'coTeachers.teacherId': new Types.ObjectId(teacherId) })
      .select('_id coTeachers')
      .lean();

    return classrooms
      .filter((classroom: any) => this.hasClassCoTeacherPermission(classroom, teacherId, permission))
      .map((classroom: any) => new Types.ObjectId(classroom._id));
  }

  // ──────────────────────────────────────────────────────────────────
  //  QUERY / FIND
  // ──────────────────────────────────────────────────────────────────

  async findAll(query: QuerySessionDto, actor?: JwtPayload) {
    const filter: FilterQuery<Session> = {};

    if (query.classId) filter.classId = new Types.ObjectId(query.classId);
    if (query.studentId) filter.studentId = new Types.ObjectId(query.studentId);
    if (query.parentUserId) filter.parentUserId = new Types.ObjectId(query.parentUserId);
    if (query.status) filter.status = query.status;

    if ((query as any).hasReport === 'true') filter.hasTeachingReport = true;
    if ((query as any).hasReport === 'false') {
      filter.hasTeachingReport = { $ne: true } as any;
      if (!query.status) {
        filter.status = { $in: [
          SessionStatus.TEACHER_COMPLETED,
          SessionStatus.PARENT_CONFIRMED,
          SessionStatus.FINALIZED,
        ] } as any;
      }
    }

    if (actor?.role === Role.TEACHER) {
      const teacherId = actor.sub;
      const accessibleClassIds = await this.getAccessibleClassIdsForTeacher(teacherId);
      const teacherClauses: any[] = [{ teacherId: new Types.ObjectId(teacherId) }];
      if (accessibleClassIds.length > 0) {
        teacherClauses.push({ classId: { $in: accessibleClassIds } });
      }
      filter.$and = Array.isArray((filter as any).$and) ? (filter as any).$and : [];
      (filter as any).$and.push({ $or: teacherClauses });
    } else if (query.teacherId) {
      filter.teacherId = new Types.ObjectId(query.teacherId);
    }

    if (query.fromDate || query.toDate) {
      filter.scheduledDate = {};
      if (query.fromDate) filter.scheduledDate.$gte = new Date(query.fromDate);
      if (query.toDate) filter.scheduledDate.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-scheduledDate';

    const [data, total] = await Promise.all([
      this.sessionModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('classId', 'name code classMode')
        .populate('studentId', 'fullName studentCode')
        .populate('teacherId', 'fullName email userCode')
        .lean(),
      this.sessionModel.countDocuments(filter),
    ]);

    const attendanceBySessionId = new Map<
      string,
      { attendedAt?: Date | null; status?: AttendanceStatus | null }
    >();

    if (data.length > 0) {
      const sessionIds = data.map((session) => session._id as Types.ObjectId);
      const attendanceRows = await this.attendanceModel
        .find({ sessionId: { $in: sessionIds } })
        .sort({ attendedAt: -1, updatedAt: -1, createdAt: -1 })
        .select('sessionId attendedAt status')
        .lean();

      for (const row of attendanceRows as any[]) {
        const sessionId = row?.sessionId?.toString();
        if (!sessionId || attendanceBySessionId.has(sessionId)) continue;
        attendanceBySessionId.set(sessionId, {
          attendedAt: row?.attendedAt || null,
          status: row?.status || null,
        });
      }
    }

    const teacherPayoutOverrides = await this.sessionPayrollService.buildTeacherPayoutOverrideMap(data as any[]);

    const normalizedData = data.map((session: any) => {
      const sessionId = objectIdToString(session._id);
      const attendance = attendanceBySessionId.get(sessionId || '');
      const normalizedSession = {
        ...session,
        teacherPayout:
          (sessionId ? teacherPayoutOverrides.get(sessionId) : undefined)
          ?? session.teacherPayout,
        attendedAt: attendance?.attendedAt || null,
        attendanceStatus: attendance?.status || null,
      };

      const exposedSession =
        actor?.role === Role.SHAREHOLDER
          ? this.sanitizeTeachingReportSessionForShareholder(normalizedSession)
          : normalizedSession;
      return this.storageUrlService.transformSensitiveAssetUrls(exposedSession);
    });

    return this.storageUrlService.transformSensitiveAssetUrls({
      data: normalizedData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  }

  async findById(id: string, actor?: JwtPayload): Promise<SessionDocument> {
    const session = await this.sessionModel
      .findById(id)
      .populate('classId', 'name code classMode pricePerSession teacherPayPerSession cancelPolicy')
      .populate('studentId', 'fullName studentCode parentUserId parentName parentPhone')
      .populate('teacherId', 'fullName email phone')
      .populate('parentUserId', 'fullName email phone')
      .populate('createdBy', 'fullName')
      .populate('editHistory.editedByUserId', 'fullName role');

    if (!session) throw new NotFoundException('Buổi học không tồn tại');

    if (actor?.role === Role.PARENT) {
      const parentOwnerId = await this.resolveParentUserIdForSession({
        parentUserId: session.parentUserId as any,
        studentId: session.studentId as any,
      });
      if (!parentOwnerId || parentOwnerId !== actor.sub) {
        throw new NotFoundException('Buoi hoc khong ton tai');
      }
    } else if (actor?.role === Role.TEACHER) {
      const teacherOwnerId = objectIdToString(session.teacherId as any);
      if (teacherOwnerId && teacherOwnerId === actor.sub) {
        // ok
      } else {
        const classroomId = objectIdToString(session.classId);
        const classroom = classroomId
          ? await this.classModel
              .findById(classroomId)
              .select('_id coTeachers')
              .lean()
          : null;
        if (!classroom || !this.hasClassCoTeacherPermission(classroom, actor.sub, 'any')) {
          throw new NotFoundException('Buoi hoc khong ton tai');
        }
      }
    }

    if (toSafeNumber(session.teacherPayout, 0) <= 0 && !shouldKeepZeroTeacherPayout(session)) {
      const classroomId = objectIdToString(session.classId);
      const classroom = await this.classModel
        .findById(classroomId)
        .select(
          'classMode pricingSnapshot durationSnapshots pricePerSession teacherPayPerSession teacherPayPerStudent baseDuration sessionDuration',
        )
        .lean();
      const fallbackTeacherPayout = this.sessionPayrollService.computeTeacherPayoutFallback(session, classroom);
      if (fallbackTeacherPayout > 0) {
        session.teacherPayout = fallbackTeacherPayout;
      }
    }

    return this.storageUrlService.transformSensitiveAssetUrls(session.toObject({ depopulate: false })) as any;
  }

  // ──────────────────────────────────────────────────────────────────
  //  STATS
  // ──────────────────────────────────────────────────────────────────

  async getStats(filter: { teacherId?: string; classId?: string; fromDate?: string; toDate?: string }) {
    const match: FilterQuery<Session> = {};
    if (filter.teacherId) match.teacherId = new Types.ObjectId(filter.teacherId);
    if (filter.classId) match.classId = new Types.ObjectId(filter.classId);
    if (filter.fromDate || filter.toDate) {
      match.scheduledDate = {};
      if (filter.fromDate) match.scheduledDate.$gte = new Date(filter.fromDate);
      if (filter.toDate) match.scheduledDate.$lte = new Date(filter.toDate);
    }

    const result = await this.sessionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCharged: { $sum: '$amountCharged' },
          totalPayout: { $sum: '$teacherPayout' },
        },
      },
    ]);

    const summary: Record<string, { count: number; totalCharged: number; totalPayout: number }> = {};
    for (const r of result) {
      summary[r._id] = {
        count: r.count,
        totalCharged: r.totalCharged,
        totalPayout: r.totalPayout,
      };
    }

    const totalSessions = result.reduce((acc, r) => acc + r.count, 0);
    const totalRevenue = result.reduce((acc, r) => acc + r.totalCharged, 0);
    let totalTeacherCost = result.reduce((acc, r) => acc + r.totalPayout, 0);

    const zeroPayoutSessions = await this.sessionModel
      .find({ ...match, teacherPayout: { $lte: 0 } })
      .select('_id classId scheduledDate durationMinutes teacherPayout status')
      .lean();
    const teacherPayoutOverrides = await this.sessionPayrollService.buildTeacherPayoutOverrideMap(zeroPayoutSessions as any[]);
    for (const session of zeroPayoutSessions as any[]) {
      const sessionId = objectIdToString(session._id);
      const overrideTeacherPayout = sessionId ? teacherPayoutOverrides.get(sessionId) : undefined;
      if (!overrideTeacherPayout || overrideTeacherPayout <= 0) continue;

      const statusKey = String(session.status || '');
      if (!summary[statusKey]) {
        summary[statusKey] = {
          count: 0,
          totalCharged: 0,
          totalPayout: 0,
        };
      }

      summary[statusKey].totalPayout += overrideTeacherPayout;
      totalTeacherCost += overrideTeacherPayout;
    }

    return { totalSessions, totalRevenue, totalTeacherCost, byStatus: summary };
  }

  // ──────────────────────────────────────────────────────────────────
  //  PARENT: Children Progress
  // ──────────────────────────────────────────────────────────────────

  async getChildrenProgress(parentUserId: string) {
    const parentObjId = new Types.ObjectId(parentUserId);

    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('fullName studentCode grade subjects')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);

    const sessions = await this.sessionModel
      .find({
        studentId: { $in: childIds },
        status: { $in: ['TEACHER_COMPLETED', 'PARENT_CONFIRMED', 'FINALIZED'] },
      })
      .select(
        'studentId classId evaluation teachingReport hasTeachingReport homework scheduledDate scheduledStartTime scheduledEndTime status',
      )
      .populate('classId', 'name code curriculum')
      .populate('evaluation.homeworkMaterialIds', 'title courseName unitTitle lessonTitle fileUrl materialType')
      .populate('evaluation.homeworkQuizIds', 'title subject grade courseName unitCode lessonCode passingScore')
      .sort({ scheduledDate: -1 })
      .lean();

    const sessionsByStudent = new Map<string, any[]>();
    for (const s of sessions) {
      const sid = s.studentId.toString();
      if (!sessionsByStudent.has(sid)) sessionsByStudent.set(sid, []);
      sessionsByStudent.get(sid)!.push(s);
    }

    const result = children.map((child) => {
      const studentSessions = sessionsByStudent.get(child._id.toString()) || [];

      const withEval = studentSessions.filter(
        (s) => s.evaluation?.studentPerformance,
      );
      const avgPerformance =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.studentPerformance || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;
      const avgEngagement =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.studentEngagement || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;
      const avgComprehension =
        withEval.length > 0
          ? Math.round(
              (withEval.reduce(
                (sum, s) => sum + (s.evaluation.comprehensionLevel || 0),
                0,
              ) /
                withEval.length) *
                10,
            ) / 10
          : null;

      const homeworkList = studentSessions
        .filter((s) => {
          const materialIds = Array.isArray(s.evaluation?.homeworkMaterialIds)
            ? s.evaluation.homeworkMaterialIds
            : [];
          const quizIds = Array.isArray(s.evaluation?.homeworkQuizIds)
            ? s.evaluation.homeworkQuizIds
            : [];
          return !!(s.evaluation?.homeworkAssigned || s.teachingReport?.homework || s.homework || materialIds.length || quizIds.length);
        })
        .map((s) => {
          const topic = s.evaluation?.homeworkAssigned || s.teachingReport?.homework || s.homework || '';
          return {
            sessionId: objectIdToString((s as any)._id),
            sessionDate: s.scheduledDate,
            assignedDate: s.scheduledDate,
            className: (s.classId as any)?.name || '',
            homework: topic,
            topic,
            deadline: s.evaluation?.homeworkDeadline,
            dueDate: s.evaluation?.homeworkDeadline,
            status: s.evaluation?.homeworkStatus || 'ASSIGNED',
            score: s.evaluation?.homeworkScore,
            feedback: s.evaluation?.homeworkFeedback,
            submissionMode: s.evaluation?.homeworkSubmissionMode || 'HYBRID',
            submissionText: s.evaluation?.homeworkSubmissionText || '',
            submissionVideoUrl: s.evaluation?.homeworkSubmissionVideoUrl || '',
            submissionFiles: s.evaluation?.homeworkSubmissionFiles || [],
            submittedAt: s.evaluation?.homeworkSubmittedAt,
            reviewFiles: s.evaluation?.homeworkReviewFiles || [],
            materialIds: s.evaluation?.homeworkMaterialIds || [],
            quizIds: s.evaluation?.homeworkQuizIds || [],
          };
        });

      const recentComments = studentSessions
        .filter((s) => s.teachingReport?.teacherComment || s.evaluation?.overallComment)
        .slice(0, 10)
        .map((s) => ({
          sessionDate: s.scheduledDate,
          className: (s.classId as any)?.name || '',
          teacherComment: s.teachingReport?.teacherComment || '',
          overallComment: s.evaluation?.overallComment || '',
          progressPercent: s.evaluation?.progressPercent,
        }));

      const classMap = new Map<string, any>();
      for (const s of studentSessions) {
        const cid = (s.classId as any)?._id?.toString();
        if (!cid) continue;
        if (!classMap.has(cid)) {
          const curriculum = (s.classId as any)?.curriculum || [];
          const completed = curriculum.filter((c: any) => c.isCompleted).length;
          classMap.set(cid, {
            classId: cid,
            className: (s.classId as any)?.name || '',
            classCode: (s.classId as any)?.code || '',
            totalItems: curriculum.length,
            completedItems: completed,
            progressPercent:
              curriculum.length > 0
                ? Math.round((completed / curriculum.length) * 100)
                : 0,
          });
        }
      }

      return {
        student: {
          _id: child._id,
          fullName: child.fullName,
          studentCode: child.studentCode,
          grade: child.grade,
          subjects: child.subjects,
        },
        totalSessions: studentSessions.length,
        evaluation: {
          avgPerformance,
          avgEngagement,
          avgComprehension,
          totalEvaluated: withEval.length,
        },
        homework: {
          pending: homeworkList.filter((h) => h.status !== 'GRADED').length,
          list: homeworkList,
        },
        recentComments,
        curriculumProgress: Array.from(classMap.values()),
      };
    });

    return { children: result };
  }

  // ──────────────────────────────────────────────────────────────────
  //  SCHEDULE CONFLICT DETECTION
  // ──────────────────────────────────────────────────────────────────

  async checkConflicts(params: {
    teacherId?: string;
    studentId?: string;
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    excludeSessionId?: string;
  }): Promise<{ hasConflict: boolean; conflicts: any[] }> {
    const date = new Date(params.scheduledDate);
    const dayStart = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const conflicts: any[] = [];

    const baseFilter: any = {
      scheduledDate: { $gte: dayStart, $lt: dayEnd },
      status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
      scheduledStartTime: { $exists: true },
      scheduledEndTime: { $exists: true },
    };
    if (params.excludeSessionId) {
      baseFilter._id = { $ne: new Types.ObjectId(params.excludeSessionId) };
    }

    if (params.teacherId) {
      const teacherSessions = await this.sessionModel
        .find({ ...baseFilter, teacherId: new Types.ObjectId(params.teacherId) })
        .populate('studentId', 'fullName studentCode')
        .populate('classId', 'name code')
        .lean();

      for (const s of teacherSessions) {
        if (
          isTimeOverlap(
            params.scheduledStartTime,
            params.scheduledEndTime,
            s.scheduledStartTime!,
            s.scheduledEndTime!,
          )
        ) {
          conflicts.push({
            type: 'TEACHER',
            session: s,
            message: `Giáo viên đã có buổi học ${s.scheduledStartTime}-${s.scheduledEndTime} với ${(s.studentId as any)?.fullName || 'HS'} lớp ${(s.classId as any)?.name || ''}`,
          });
        }
      }
    }

    if (params.studentId) {
      const studentSessions = await this.sessionModel
        .find({ ...baseFilter, studentId: new Types.ObjectId(params.studentId) })
        .populate('teacherId', 'fullName')
        .populate('classId', 'name code')
        .lean();

      for (const s of studentSessions) {
        if (
          isTimeOverlap(
            params.scheduledStartTime,
            params.scheduledEndTime,
            s.scheduledStartTime!,
            s.scheduledEndTime!,
          )
        ) {
          conflicts.push({
            type: 'STUDENT',
            session: s,
            message: `Học sinh đã có buổi học ${s.scheduledStartTime}-${s.scheduledEndTime} với GV ${(s.teacherId as any)?.fullName || ''} lớp ${(s.classId as any)?.name || ''}`,
          });
        }
      }
    }

    return { hasConflict: conflicts.length > 0, conflicts };
  }

  // ════════════════════════════════════════════════════════════════════
  //  PARENT FEEDBACK
  // ════════════════════════════════════════════════════════════════════

  async submitParentFeedback(parentUserId: string, feedback: {
    overallRating: number;
    teachingQuality?: number;
    communication?: number;
    facility?: number;
    comment?: string;
    studentId?: string;
    sessionId?: string;
  }) {
    const parentObjId = new Types.ObjectId(parentUserId);

    const filter: any = {
      parentUserId: parentObjId,
      status: SessionStatus.FINALIZED,
    };
    if (feedback.studentId) {
      filter.studentId = new Types.ObjectId(feedback.studentId);
    }

    let session: SessionDocument | null = null;

    if (feedback.sessionId) {
      session = await this.sessionModel.findOne({
        ...filter,
        _id: new Types.ObjectId(feedback.sessionId),
      });
      if (!session) {
        throw new NotFoundException('Buổi học cần đánh giá không tồn tại');
      }
    } else {
      session = await this.sessionModel
        .findOne(filter)
        .sort({ scheduledDate: -1 });
    }

    if (!session) {
      return { success: true, message: 'Feedback đã được ghi nhận (không có session liên quan)' };
    }

    await this.sessionModel.updateOne(
      { _id: session._id },
      {
        $set: {
          parentFeedback: {
            overallRating: feedback.overallRating,
            teachingQualityRating: feedback.teachingQuality,
            communicationRating: feedback.communication,
            facilityRating: feedback.facility,
            parentNotes: feedback.comment,
          },
        },
      },
    );

    return { success: true, message: 'Cảm ơn bạn đã gửi đánh giá!' };
  }
}
