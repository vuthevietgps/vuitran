import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import {
  Session,
  SessionDocument,
  SessionStatus,
} from '../sessions/schemas/session.schema';
import {
  StudentSupportSnapshot,
  StudentSupportSnapshotDocument,
} from './schemas/student-support-snapshot.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import {
  TeachingMaterial,
  TeachingMaterialDocument,
} from '../teaching-materials/schemas/teaching-material.schema';

const SNAPSHOT_TTL_MS = 15 * 60 * 1000;
const REBUILD_BATCH_SIZE = 4;
const COMPLETED_SESSION_STATUSES = [
  SessionStatus.TEACHER_COMPLETED,
  SessionStatus.PARENT_CONFIRMED,
  SessionStatus.FINALIZED,
];

@Injectable()
export class StudentSupportSnapshotService {
  private readonly logger = new Logger(StudentSupportSnapshotService.name);
  private readonly inflightRebuilds = new Map<string, Promise<any>>();

  constructor(
    @InjectModel(StudentSupportSnapshot.name)
    private readonly snapshotModel: Model<StudentSupportSnapshotDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(TeachingMaterial.name)
    private readonly teachingMaterialModel: Model<TeachingMaterialDocument>,
  ) {}

  async getOrBuild(
    parentUserId: string,
    studentId: string,
    options: { preferFresh?: boolean } = {},
  ) {
    const parentObjectId = new Types.ObjectId(parentUserId);
    const studentObjectId = new Types.ObjectId(studentId);
    const existing = await this.snapshotModel.findOne({
      parentUserId: parentObjectId,
      studentId: studentObjectId,
    }).lean();

    if (existing?.generatedAt) {
      const age = Date.now() - new Date(existing.generatedAt).getTime();
      if (age < SNAPSHOT_TTL_MS) {
        return existing;
      }

      if (options.preferFresh) {
        try {
          return await this.rebuild(parentUserId, studentId);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(
            `[StudentSupportSnapshot] Fresh rebuild failed for student ${studentId}, returning previous snapshot: ${message}`,
          );

          return {
            ...existing,
            dataWarnings: [
              ...(Array.isArray(existing.dataWarnings) ? existing.dataWarnings : []),
              'He thong tam thoi chua lam moi du lieu moi nhat; vui long doi chieu voi nhan vien neu can xac nhan thay doi vua phat sinh.',
            ],
          };
        }
      }

      void this.rebuild(parentUserId, studentId).catch((err) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(
          `[StudentSupportSnapshot] Background refresh failed for student ${studentId}: ${message}`,
        );
      });
      return existing;
    }

    return this.rebuild(parentUserId, studentId);
  }

  async rebuild(parentUserId: string, studentId: string) {
    const cacheKey = `${parentUserId}:${studentId}`;
    const inflight = this.inflightRebuilds.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const task = this.doRebuild(parentUserId, studentId).finally(() => {
      this.inflightRebuilds.delete(cacheKey);
    });
    this.inflightRebuilds.set(cacheKey, task);
    return task;
  }

  private async doRebuild(parentUserId: string, studentId: string) {
    const student = await this.findParentStudentOrThrow(parentUserId, studentId);
    const parentObjectId = new Types.ObjectId(parentUserId);
    const studentObjectId = new Types.ObjectId(studentId);

    const [completedSessions, upcomingSessions, activeClasses] = await Promise.all([
      this.sessionModel
        .find({
          parentUserId: parentObjectId,
          studentId: studentObjectId,
          status: { $in: COMPLETED_SESSION_STATUSES },
        })
        .select(
          'scheduledDate scheduledStartTime scheduledEndTime status evaluation teachingReport classId updatedAt',
        )
        .populate('classId', 'name code')
        .sort({ scheduledDate: -1 })
        .limit(8)
        .lean<Array<any>>(),
      this.sessionModel
        .find({
          parentUserId: parentObjectId,
          studentId: studentObjectId,
          status: SessionStatus.SCHEDULED,
          scheduledDate: { $gte: new Date() },
        })
        .select('scheduledDate scheduledStartTime scheduledEndTime status classId updatedAt')
        .populate('classId', 'name code')
        .sort({ scheduledDate: 1 })
        .limit(3)
        .lean<Array<any>>(),
      this.classModel
        .find({ students: studentObjectId })
        .select('name code curriculum.isCompleted updatedAt')
        .lean<Array<any>>(),
    ]);

    const withEval = completedSessions.filter(
      (session) =>
        typeof session.evaluation?.studentPerformance === 'number'
        || typeof session.evaluation?.studentEngagement === 'number'
        || typeof session.evaluation?.comprehensionLevel === 'number',
    );

    const averageOf = (field: string) => {
      const values = withEval
        .map((session) => session.evaluation?.[field])
        .filter((value: unknown): value is number => typeof value === 'number');

      if (!values.length) return undefined;
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      return Math.round(average * 10) / 10;
    };

    const pendingHomework = completedSessions
      .filter(
        (session) =>
          session.evaluation?.homeworkAssigned
          && session.evaluation?.homeworkStatus !== 'REVIEWED',
      )
      .slice(0, 3)
      .map((session) => ({
        className: session.classId?.name || '',
        homework: this.clipText(session.evaluation?.homeworkAssigned, 120),
        deadline: this.formatDate(session.evaluation?.homeworkDeadline),
        status: this.homeworkStatusLabel(session.evaluation?.homeworkStatus),
      }));

    const recentComments = completedSessions
      .filter(
        (session) => session.teachingReport?.teacherComment || session.evaluation?.overallComment,
      )
      .slice(0, 3)
      .map((session) => ({
        date: this.formatDate(session.scheduledDate),
        className: session.classId?.name || '',
        teacherComment: this.clipText(session.teachingReport?.teacherComment, 120),
        overallComment: this.clipText(session.evaluation?.overallComment, 120),
      }));

    const classMap = new Map<string, any>();
    for (const classroom of activeClasses) {
      const classId = classroom?._id?.toString?.();
      if (!classId) continue;
      classMap.set(classId, classroom);
    }

    const curriculumProgress = activeClasses.map((classroom) => {
      const curriculum = Array.isArray(classroom?.curriculum)
        ? classroom.curriculum
        : [];
      const completedCount = curriculum.filter((item: any) => item?.isCompleted).length;
      const progressPercent = curriculum.length
        ? Math.round((completedCount / curriculum.length) * 100)
        : 0;

      return {
        classId: classroom?._id?.toString?.() || '',
        className: classroom?.name || '',
        progressPercent,
      };
    });

    const classIds = activeClasses
      .map((classroom) => classroom?._id)
      .filter((classId): classId is Types.ObjectId => !!classId);

    const recentMaterials = classIds.length
      ? await this.teachingMaterialModel
        .find({ classId: { $in: classIds } })
        .select('title description manualSummary aiSummary extractedTextPreview classId updatedAt')
        .sort({ updatedAt: -1 })
        .limit(4)
        .lean<Array<any>>()
      : [];

    const teachingMaterials = recentMaterials.map((material) => ({
      title: material.title || '',
      className: classMap.get(material.classId?.toString?.())?.name || '',
      description: this.clipText(
        material.manualSummary || material.aiSummary || material.extractedTextPreview || material.description,
        140,
      ),
      updatedAt: this.formatDate(material.updatedAt),
    }));

    const upcoming = upcomingSessions.map((session) => ({
      scheduledAt: this.formatDateTime(
        session.scheduledDate,
        session.scheduledStartTime,
        session.scheduledEndTime,
      ),
      className: session.classId?.name || '',
    }));

    const sourceUpdatedAt = this.pickLatestDate([
      student.updatedAt,
      ...completedSessions.map((session) => session.updatedAt),
      ...upcomingSessions.map((session) => session.updatedAt),
      ...activeClasses.map((classroom) => classroom.updatedAt),
      ...recentMaterials.map((material) => material.updatedAt),
    ]);

    const dataWarnings = this.buildDataWarnings({
      completedSessionsCount: completedSessions.length,
      recentCommentsCount: recentComments.length,
      curriculumProgressCount: curriculumProgress.length,
      upcomingSessionsCount: upcoming.length,
      teachingMaterialsCount: teachingMaterials.length,
    });
    const dataCompletenessScore = this.computeDataCompletenessScore({
      completedSessionsCount: completedSessions.length,
      recentCommentsCount: recentComments.length,
      curriculumProgressCount: curriculumProgress.length,
      upcomingSessionsCount: upcoming.length,
      teachingMaterialsCount: teachingMaterials.length,
    });

    const contextText = this.buildContextText({
      student,
      generatedAt: new Date(),
      sourceUpdatedAt,
      dataCompletenessScore,
      dataWarnings,
      completedSessionsCount: completedSessions.length,
      averagePerformance: averageOf('studentPerformance'),
      averageEngagement: averageOf('studentEngagement'),
      averageComprehension: averageOf('comprehensionLevel'),
      pendingHomework,
      recentComments,
      curriculumProgress,
      upcomingSessions: upcoming,
      teachingMaterials,
    });

    const doc = await this.snapshotModel.findOneAndUpdate(
      {
        parentUserId: parentObjectId,
        studentId: studentObjectId,
      },
      {
        $set: {
          snapshotVersion: 3,
          generatedAt: new Date(),
          sourceUpdatedAt,
          contextText,
          dataCompletenessScore,
          dataWarnings,
          sessionCount: completedSessions.length,
          averagePerformance: averageOf('studentPerformance'),
          averageEngagement: averageOf('studentEngagement'),
          averageComprehension: averageOf('comprehensionLevel'),
          pendingHomework,
          recentComments,
          curriculumProgress,
          upcomingSessions: upcoming,
          teachingMaterials,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (!doc) {
      throw new BadRequestException('Khong the tao student support snapshot');
    }

    return doc;
  }

  private async findParentStudentOrThrow(parentUserId: string, studentId: string) {
    const student = await this.studentModel.findOne({
      _id: new Types.ObjectId(studentId),
      parentUserId: new Types.ObjectId(parentUserId),
    }).lean<any>();

    if (!student) {
      throw new NotFoundException('Hoc sinh khong ton tai hoac khong thuoc phu huynh nay');
    }

    return student;
  }

  private buildContextText(input: {
    student: any;
    generatedAt: Date;
    sourceUpdatedAt?: Date | null;
    dataCompletenessScore: number;
    dataWarnings: string[];
    completedSessionsCount: number;
    averagePerformance?: number;
    averageEngagement?: number;
    averageComprehension?: number;
    pendingHomework: Array<{ className?: string; homework?: string; deadline?: string; status?: string }>;
    recentComments: Array<{ date?: string; className?: string; teacherComment?: string; overallComment?: string }>;
    curriculumProgress: Array<{ className?: string; progressPercent: number }>;
    upcomingSessions: Array<{ scheduledAt?: string; className?: string }>;
    teachingMaterials: Array<{ title?: string; className?: string; description?: string; updatedAt?: string }>;
  }) {
    const lines: string[] = [
      'Trang thai do tin cay du lieu:',
      `- Snapshot cap nhat luc: ${this.formatDateTimeWithClock(input.generatedAt) || 'Chua ro'}`,
      `- Nguon du lieu gan nhat thay doi luc: ${this.formatDateTimeWithClock(input.sourceUpdatedAt) || 'Chua ro'}`,
      `- Muc do day du du lieu: ${input.dataCompletenessScore}/100`,
      `- Luu y du lieu: ${input.dataWarnings.length ? input.dataWarnings.join(' | ') : 'Khong co canh bao lon'}`,
      '',
      'Thong tin hoc sinh:',
      `- Ho ten: ${input.student.fullName || 'Chua cap nhat'}`,
      `- Ma hoc sinh: ${input.student.studentCode || 'Chua cap nhat'}`,
      `- Khoi/lop: ${input.student.grade || 'Chua cap nhat'}`,
      `- Mon hoc: ${input.student.subjects?.join(', ') || 'Chua cap nhat'}`,
      `- Nhu cau hoc tap: ${input.student.learningNeeds || 'Chua cap nhat'}`,
      `- Hinh thuc hoc uu tien: ${input.student.preferredTeachingMode || 'Chua cap nhat'}`,
      `- Dia diem uu tien: ${input.student.preferredLocation || 'Chua cap nhat'}`,
      '',
      'Tom tat tien do hoc tap:',
      `- So buoi da ghi nhan: ${input.completedSessionsCount}`,
      `- Diem trung binh nang luc: ${input.averagePerformance ?? 'Chua du du lieu'}`,
      `- Diem trung binh tap trung: ${input.averageEngagement ?? 'Chua du du lieu'}`,
      `- Diem trung binh hieu bai: ${input.averageComprehension ?? 'Chua du du lieu'}`,
    ];

    if (input.pendingHomework.length) {
      lines.push('', 'Bai tap ve nha can theo doi:');
      for (const item of input.pendingHomework) {
        lines.push(
          `- ${item.className || 'Khong ro lop'} | ${item.homework || 'Khong ro bai tap'} | han ${item.deadline || 'chua ro'} | ${item.status || 'chua ro'}`,
        );
      }
    }

    if (input.recentComments.length) {
      lines.push('', 'Nhan xet gan day cua giao vien:');
      for (const item of input.recentComments) {
        const comment = item.teacherComment || item.overallComment || 'Khong co nhan xet';
        lines.push(`- ${item.date || 'Chua ro ngay'} | ${item.className || 'Khong ro lop'} | ${comment}`);
      }
    }

    if (input.curriculumProgress.length) {
      lines.push('', 'Tien do giao trinh theo lop:');
      for (const item of input.curriculumProgress) {
        lines.push(`- ${item.className || 'Khong ro lop'}: ${item.progressPercent}%`);
      }
    }

    if (input.upcomingSessions.length) {
      lines.push('', 'Lich hoc sap toi:');
      for (const item of input.upcomingSessions) {
        lines.push(`- ${item.scheduledAt || 'Chua ro lich'} | ${item.className || 'Khong ro lop'}`);
      }
    }

    if (input.teachingMaterials.length) {
      lines.push('', 'Tai lieu va hoc lieu gan day cua lop:');
      for (const item of input.teachingMaterials) {
        const description = item.description || 'Chua co mo ta';
        lines.push(
          `- ${item.className || 'Khong ro lop'} | ${item.title || 'Khong ro tai lieu'} | cap nhat ${item.updatedAt || 'chua ro'} | ${description}`,
        );
      }
    }

    return lines.join('\n');
  }

  async rebuildForClass(classId: string) {
    const classroom = await this.classModel
      .findById(classId)
      .select('students')
      .lean<any>();

    const studentIds = Array.isArray(classroom?.students)
      ? classroom.students
        .map((studentId: any) => studentId?.toString?.())
        .filter((studentId: string | undefined): studentId is string => !!studentId)
      : [];

    if (!studentIds.length) {
      return { refreshedCount: 0 };
    }

    return this.rebuildForStudentIds(studentIds);
  }

  async rebuildForStudentIds(studentIds: string[]) {
    const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
    if (!uniqueStudentIds.length) {
      return { refreshedCount: 0 };
    }

    const students = await this.studentModel
      .find({
        _id: { $in: uniqueStudentIds.map((studentId) => new Types.ObjectId(studentId)) },
        parentUserId: { $exists: true, $ne: null },
      })
      .select('_id parentUserId')
      .lean<Array<any>>();

    let refreshedCount = 0;
    for (let index = 0; index < students.length; index += REBUILD_BATCH_SIZE) {
      const batch = students.slice(index, index + REBUILD_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((student) => {
          const studentId = student?._id?.toString?.();
          const parentUserId = student?.parentUserId?.toString?.();
          if (!studentId || !parentUserId) {
            return Promise.resolve(null);
          }

          return this.rebuild(parentUserId, studentId);
        }),
      );

      refreshedCount += results.filter(
        (result) => result.status === 'fulfilled' && result.value !== null,
      ).length;
    }

    return { refreshedCount };
  }

  private clipText(value?: string | null, limit = 180) {
    const normalized = value?.trim();
    if (!normalized) return '';
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 3)}...`;
  }

  private formatDate(value?: string | Date | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private formatDateTime(
    value?: string | Date | null,
    startTime?: string | null,
    endTime?: string | null,
  ) {
    if (!value) return '';
    const parts = [this.formatDate(value)];
    if (startTime && endTime) parts.push(`${startTime}-${endTime}`);
    else if (startTime) parts.push(startTime);
    return parts.filter(Boolean).join(' ');
  }

  private formatDateTimeWithClock(value?: string | Date | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private pickLatestDate(values: Array<string | Date | null | undefined>): Date | undefined {
    const timestamps = values
      .map((value) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.getTime();
      })
      .filter((value): value is number => value !== null);

    if (!timestamps.length) {
      return undefined;
    }

    return new Date(Math.max(...timestamps));
  }

  private buildDataWarnings(input: {
    completedSessionsCount: number;
    recentCommentsCount: number;
    curriculumProgressCount: number;
    upcomingSessionsCount: number;
    teachingMaterialsCount: number;
  }): string[] {
    const warnings: string[] = [];

    if (!input.completedSessionsCount) {
      warnings.push('Chua co buoi hoc hoan thanh duoc ghi nhan trong he thong.');
    }
    if (!input.recentCommentsCount) {
      warnings.push('Chua co nhan xet giao vien gan day de xac nhan tien do chi tiet.');
    }
    if (!input.curriculumProgressCount) {
      warnings.push('Chua co du lieu giao trinh theo lop de doi chieu tien do.');
    }
    if (!input.upcomingSessionsCount) {
      warnings.push('Chua co lich hoc sap toi duoc xep trong he thong.');
    }
    if (!input.teachingMaterialsCount) {
      warnings.push('Chua co hoc lieu lop gan day duoc dong bo vao snapshot.');
    }

    return warnings;
  }

  private computeDataCompletenessScore(input: {
    completedSessionsCount: number;
    recentCommentsCount: number;
    curriculumProgressCount: number;
    upcomingSessionsCount: number;
    teachingMaterialsCount: number;
  }): number {
    let score = 0;

    if (input.completedSessionsCount > 0) score += 30;
    if (input.recentCommentsCount > 0) score += 25;
    if (input.curriculumProgressCount > 0) score += 20;
    if (input.upcomingSessionsCount > 0) score += 15;
    if (input.teachingMaterialsCount > 0) score += 10;

    return Math.min(score, 100);
  }

  private homeworkStatusLabel(status?: string) {
    const labels: Record<string, string> = {
      NOT_ASSIGNED: 'khong giao',
      ASSIGNED: 'da giao',
      SUBMITTED: 'da nop',
      REVIEWED: 'da nhan xet',
    };
    return labels[status || ''] || 'chua ro';
  }
}
