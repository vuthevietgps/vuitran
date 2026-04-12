import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Classroom, ClassDocument, ClassEditHistoryAction, PendingClassUpdateType, StudentConfigSlotType } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { getCurrentDurationForStudent } from './student-config.utils';
import {
  buildDurationSnapshotData,
  buildInitialStudentConfigRecord,
  floorSessionCount,
  formatClassHistoryValue,
  getActorId,
  getClassHistoryFieldLabel,
  objectIdToString,
  resolveRequestedUpdateType,
  stripUpdateMetaFields,
  toSafeNumber,
} from './classes.utils';

@Injectable()
export class ClassesDataService {
  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  SESSION / REMAINING ALLOWANCE MAPS
  // ══════════════════════════════════════════════════════════════════

  async buildStudentCompletedSessionMap(
    classroom: any,
    studentIds: string[],
  ): Promise<Map<string, number>> {
    const completedSessionMap = new Map<string, number>();
    if (!studentIds.length || !classroom?._id) {
      return completedSessionMap;
    }

    const rows = await this.sessionModel.aggregate([
      {
        $match: {
          classId: new Types.ObjectId(classroom._id),
          studentId: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) },
          status: { $nin: [SessionStatus.CANCELLED, SessionStatus.RESCHEDULED] },
        },
      },
      {
        $group: {
          _id: '$studentId',
          count: { $sum: 1 },
        },
      },
    ]);

    for (const row of rows) {
      completedSessionMap.set(row._id?.toString?.() || '', toSafeNumber(row.count, 0));
    }

    return completedSessionMap;
  }

  async buildStudentRemainingMinutesMap(
    classroom: any,
    studentIds: string[],
  ): Promise<Map<string, number>> {
    const remainingMinutesMap = new Map<string, number>();
    const remainingAllowanceMap = await this.buildStudentRemainingAllowanceMap(classroom, studentIds);
    for (const [studentId, allowance] of remainingAllowanceMap.entries()) {
      remainingMinutesMap.set(studentId, toSafeNumber(allowance.totalRemainingMinutes, 0));
    }
    return remainingMinutesMap;
  }

  async buildStudentRemainingAllowanceMap(
    classroom: any,
    studentIds: string[],
  ): Promise<Map<string, {
    paidRemainingMinutes: number;
    bonusRemainingMinutes: number;
    trialRemainingMinutes: number;
    totalRemainingMinutes: number;
  }>> {
    const remainingAllowanceMap = new Map<string, {
      paidRemainingMinutes: number;
      bonusRemainingMinutes: number;
      trialRemainingMinutes: number;
      totalRemainingMinutes: number;
    }>();
    if (!studentIds.length || !classroom?._id) {
      return remainingAllowanceMap;
    }

    const fallbackReferenceDuration =
      toSafeNumber((classroom as any)?.pricingSnapshot?.referenceDuration, 0)
      || toSafeNumber((classroom as any)?.baseDuration, 60)
      || 60;

    const invoices = await this.invoiceModel
      .find({
        classId: new Types.ObjectId(classroom._id),
        studentId: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) },
        status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
      })
      .select('studentId referenceDuration sessionsRemaining bonusSessionsRemaining trialSessionsRemaining')
      .lean();

    for (const invoice of invoices) {
      const studentId = (invoice as any)?.studentId?.toString?.();
      if (!studentId) {
        continue;
      }

      const referenceDuration =
        toSafeNumber((invoice as any)?.referenceDuration, fallbackReferenceDuration) || fallbackReferenceDuration;
      const current = remainingAllowanceMap.get(studentId) || {
        paidRemainingMinutes: 0,
        bonusRemainingMinutes: 0,
        trialRemainingMinutes: 0,
        totalRemainingMinutes: 0,
      };
      const paidRemainingMinutes =
        current.paidRemainingMinutes
        + (toSafeNumber((invoice as any)?.sessionsRemaining, 0) * referenceDuration);
      const bonusRemainingMinutes =
        current.bonusRemainingMinutes
        + (toSafeNumber((invoice as any)?.bonusSessionsRemaining, 0) * referenceDuration);
      const trialRemainingMinutes =
        current.trialRemainingMinutes
        + (toSafeNumber((invoice as any)?.trialSessionsRemaining, 0) * referenceDuration);
      remainingAllowanceMap.set(studentId, {
        paidRemainingMinutes,
        bonusRemainingMinutes,
        trialRemainingMinutes,
        totalRemainingMinutes: paidRemainingMinutes + bonusRemainingMinutes + trialRemainingMinutes,
      });
    }

    return remainingAllowanceMap;
  }

  async buildProjectedStudentTotalSessionsMap(
    classroom: any,
    studentIds: string[],
    sessionDurationOverrides?: Map<string, number>,
  ): Promise<Map<string, number>> {
    const [completedSessionMap, remainingMinutesMap] = await Promise.all([
      this.buildStudentCompletedSessionMap(classroom, studentIds),
      this.buildStudentRemainingMinutesMap(classroom, studentIds),
    ]);

    const totalSessionsMap = new Map<string, number>();
    for (const studentId of studentIds) {
      const currentDuration = getCurrentDurationForStudent(classroom, studentId);
      const sessionDuration =
        toSafeNumber(sessionDurationOverrides?.get(studentId), 0)
        || toSafeNumber(currentDuration.sessionDuration, 0)
        || 60;
      const completedSessions = toSafeNumber(completedSessionMap.get(studentId), 0);
      const remainingMinutes = toSafeNumber(remainingMinutesMap.get(studentId), 0);
      const remainingSessionsAtDuration = sessionDuration > 0
        ? floorSessionCount(remainingMinutes / sessionDuration)
        : 0;
      const projectedTotal = completedSessions + remainingSessionsAtDuration;
      const fallbackTotal =
        toSafeNumber(currentDuration.totalSessions, toSafeNumber((classroom as any)?.totalSessions, 0));

      totalSessionsMap.set(
        studentId,
        projectedTotal > 0 ? projectedTotal : floorSessionCount(fallbackTotal),
      );
    }

    return totalSessionsMap;
  }

  async withProjectedStudentTotals(classroom: any) {
    if (!classroom || !Array.isArray(classroom.studentConfigs) || !classroom.studentConfigs.length) {
      return classroom;
    }

    const studentIds = classroom.studentConfigs
      .map((config: any) => config?.studentId?._id?.toString?.() || config?.studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);
    if (!studentIds.length) {
      return classroom;
    }

    const projectedTotalSessions = await this.buildProjectedStudentTotalSessionsMap(classroom, studentIds);
    const nextStudentConfigs = classroom.studentConfigs.map((config: any) => {
      const studentId = config?.studentId?._id?.toString?.() || config?.studentId?.toString?.();
      const nextTotal = studentId ? projectedTotalSessions.get(studentId) : undefined;
      if (nextTotal === undefined || !Array.isArray(config?.durationSlots) || !config.durationSlots.length) {
        return config;
      }

      let latestSlotIndex = 0;
      let latestSlotOrder = Number(config.durationSlots[0]?.slotIndex || 0);
      config.durationSlots.forEach((slot: any, index: number) => {
        const slotOrder = Number(slot?.slotIndex || 0);
        if (slotOrder >= latestSlotOrder) {
          latestSlotOrder = slotOrder;
          latestSlotIndex = index;
        }
      });

      const nextDurationSlots = config.durationSlots.map((slot: any, index: number) =>
        index === latestSlotIndex
          ? { ...slot, totalSessions: floorSessionCount(nextTotal) }
          : slot,
      );

      return {
        ...config,
        durationSlots: nextDurationSlots,
      };
    });

    return {
      ...classroom,
      studentConfigs: nextStudentConfigs,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  STUDENT CONFIG SYNC
  // ══════════════════════════════════════════════════════════════════

  async syncStudentConfigsOnClass(classId: string, actorId?: string | null): Promise<void> {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      return;
    }

    const studentIds = ((classroom as any).students || [])
      .map((studentId: any) => studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);

    const existingConfigs = Array.isArray((classroom as any).studentConfigs)
      ? (classroom as any).studentConfigs
      : [];
    const existingConfigMap = new Map(
      existingConfigs
        .map((config: any) => [config?.studentId?.toString?.(), config] as const)
        .filter(([studentId]) => !!studentId),
    );

    const totalSessionsMap = await this.buildProjectedStudentTotalSessionsMap(classroom, studentIds);
    const normalizedConfigs = studentIds.map((studentId) => {
      const existingConfig = existingConfigMap.get(studentId);
      return existingConfig || buildInitialStudentConfigRecord(
        classroom,
        studentId,
        totalSessionsMap.get(studentId) || 0,
        actorId,
      );
    });

    const hasMissingConfig = studentIds.some((studentId) => !existingConfigMap.has(studentId));
    const hasRemovedConfig = existingConfigs.length !== normalizedConfigs.length;
    if (!hasMissingConfig && !hasRemovedConfig) {
      return;
    }

    await this.classModel.findByIdAndUpdate(classId, {
      $set: {
        studentConfigs: normalizedConfigs,
      },
    });
  }

  async syncTeacherSlotsOnClass(
    classId: string,
    teacherId: string,
    actorId?: string | null,
  ): Promise<void> {
    await this.syncStudentConfigsOnClass(classId, actorId);

    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      return;
    }

    const normalizedTeacherId = teacherId.toString();
    const studentConfigs = Array.isArray((classroom as any).studentConfigs)
      ? (classroom as any).studentConfigs
      : [];
    if (!studentConfigs.length) {
      return;
    }

    const assignedAt = new Date();
    const assignedBy = actorId ? new Types.ObjectId(actorId) : undefined;
    let hasChanges = false;

    const nextStudentConfigs = studentConfigs.map((config: any) => {
      const teacherSlots = Array.isArray(config?.teacherSlots)
        ? [...config.teacherSlots]
        : [];
      teacherSlots.sort((left: any, right: any) => Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0));

      const currentTeacherId = teacherSlots.at(-1)?.teacherId?.toString?.() || null;
      if (currentTeacherId === normalizedTeacherId && teacherSlots.length > 0) {
        return config;
      }

      hasChanges = true;
      const nextTeacherSlot = {
        teacherId: new Types.ObjectId(normalizedTeacherId),
        assignedAt,
        assignedBy,
      };

      const nextTeacherSlots = teacherSlots.length === 0
        ? [
            {
              slotIndex: 1,
              slotType: StudentConfigSlotType.INITIAL,
              ...nextTeacherSlot,
            },
          ]
        : teacherSlots.length >= 3
          ? [
              {
                slotIndex: 1,
                slotType: StudentConfigSlotType.INITIAL,
                ...nextTeacherSlot,
              },
            ]
          : [
              ...teacherSlots,
              {
                slotIndex: teacherSlots.length + 1,
                slotType: StudentConfigSlotType.UPDATE,
                ...nextTeacherSlot,
              },
            ];

      return {
        ...config,
        teacherSlots: nextTeacherSlots,
        updatedAt: assignedAt,
      };
    });

    if (!hasChanges) {
      return;
    }

    await this.classModel.findByIdAndUpdate(classId, {
      $set: {
        studentConfigs: nextStudentConfigs,
      },
    });
  }

  async syncDurationSlotsOnClass(
    classId: string,
    actorId?: string | null,
  ): Promise<void> {
    await this.syncStudentConfigsOnClass(classId, actorId);

    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      return;
    }

    const studentConfigs = Array.isArray((classroom as any).studentConfigs)
      ? (classroom as any).studentConfigs
      : [];
    if (!studentConfigs.length) {
      return;
    }

    const targetDuration = buildDurationSnapshotData(classroom);
    const studentIds = studentConfigs
      .map((config: any) => config?.studentId?.toString?.())
      .filter((studentId: string | undefined): studentId is string => !!studentId);
    const totalSessionsMap = await this.buildProjectedStudentTotalSessionsMap(
      classroom,
      studentIds,
      new Map(studentIds.map((studentId) => [studentId, targetDuration.sessionDuration])),
    );

    const effectiveAt = new Date();
    const effectiveBy = actorId ? new Types.ObjectId(actorId) : undefined;
    let hasChanges = false;

    const nextStudentConfigs = studentConfigs.map((config: any) => {
      const studentId = config?.studentId?.toString?.();
      if (!studentId) {
        return config;
      }

      const durationSlots = Array.isArray(config?.durationSlots)
        ? [...config.durationSlots]
        : [];
      durationSlots.sort((left: any, right: any) => Number(left?.slotIndex || 0) - Number(right?.slotIndex || 0));

      const currentDurationSlot = durationSlots.at(-1);
      const nextTotalSessions = floorSessionCount(
        totalSessionsMap.get(studentId)
        || toSafeNumber(
          currentDurationSlot?.totalSessions,
          toSafeNumber((classroom as any)?.totalSessions, 0),
        ),
      );

      const currentBaseDuration = toSafeNumber(currentDurationSlot?.baseDuration, 0);
      const currentSessionDuration = toSafeNumber(currentDurationSlot?.sessionDuration, 0);
      const currentTotalSessions = floorSessionCount(
        toSafeNumber(
          currentDurationSlot?.totalSessions,
          toSafeNumber((classroom as any)?.totalSessions, 0),
        ),
      );

      if (
        currentBaseDuration === targetDuration.baseDuration
        && currentSessionDuration === targetDuration.sessionDuration
        && currentTotalSessions === nextTotalSessions
        && durationSlots.length > 0
      ) {
        return config;
      }

      hasChanges = true;
      const nextDurationSlot = {
        effectiveAt,
        effectiveBy,
        baseDuration: targetDuration.baseDuration,
        sessionDuration: targetDuration.sessionDuration,
        totalSessions: nextTotalSessions,
      };

      const nextDurationSlots = durationSlots.length === 0
        ? [
            {
              slotIndex: 1,
              slotType: StudentConfigSlotType.INITIAL,
              ...nextDurationSlot,
            },
          ]
        : durationSlots.length >= 3
          ? [
              {
                slotIndex: 1,
                slotType: StudentConfigSlotType.INITIAL,
                ...nextDurationSlot,
              },
            ]
          : [
              ...durationSlots,
              {
                slotIndex: durationSlots.length + 1,
                slotType: StudentConfigSlotType.UPDATE,
                ...nextDurationSlot,
              },
            ];

      return {
        ...config,
        durationSlots: nextDurationSlots,
        updatedAt: effectiveAt,
      };
    });

    if (!hasChanges) {
      return;
    }

    await this.classModel.findByIdAndUpdate(classId, {
      $set: {
        studentConfigs: nextStudentConfigs,
      },
    });
  }

  // ══════════════════════════════════════════════════════════════════
  //  CLASS HISTORY / AUDIT TRAIL
  // ══════════════════════════════════════════════════════════════════

  private async buildClassHistoryLookupMaps(
    classroom: any,
    dto: Partial<CreateClassDto>,
  ): Promise<{
    teacherNames: Map<string, string>;
    productNames: Map<string, string>;
  }> {
    const teacherIds = new Set<string>();
    const productIds = new Set<string>();

    const currentTeacherId = objectIdToString(classroom?.teacher);
    const requestedTeacherId = objectIdToString(dto.teacherId);
    if (currentTeacherId) teacherIds.add(currentTeacherId);
    if (requestedTeacherId) teacherIds.add(requestedTeacherId);
    const currentCoTeachers = Array.isArray(classroom?.coTeachers) ? classroom.coTeachers : [];
    for (const coTeacher of currentCoTeachers) {
      const teacherId = objectIdToString(coTeacher?.teacherId);
      if (teacherId) teacherIds.add(teacherId);
    }
    const requestedCoTeachers = Array.isArray((dto as any)?.coTeachers) ? (dto as any).coTeachers : [];
    for (const coTeacher of requestedCoTeachers) {
      const teacherId = objectIdToString(coTeacher?.teacherId);
      if (teacherId) teacherIds.add(teacherId);
    }

    const currentProductId = objectIdToString(classroom?.productPackage);
    const requestedProductId = objectIdToString(dto.productPackageId);
    if (currentProductId) productIds.add(currentProductId);
    if (requestedProductId) productIds.add(requestedProductId);

    const [teachers, products] = await Promise.all([
      teacherIds.size
        ? this.userModel.find({ _id: { $in: Array.from(teacherIds).map((id) => new Types.ObjectId(id)) } })
            .select('fullName userCode')
            .lean()
        : Promise.resolve([]),
      productIds.size
        ? this.productModel.find({ _id: { $in: Array.from(productIds).map((id) => new Types.ObjectId(id)) } })
            .select('name code')
            .lean()
        : Promise.resolve([]),
    ]);

    return {
      teacherNames: new Map(
        (teachers as any[]).map((teacher) => [
          teacher._id.toString(),
          teacher.userCode
            ? `${teacher.userCode} - ${teacher.fullName || teacher._id.toString()}`
            : (teacher.fullName || teacher._id.toString()),
        ]),
      ),
      productNames: new Map(
        (products as any[]).map((product) => [
          product._id.toString(),
          product.code
            ? `${product.name || product._id.toString()} (${product.code})`
            : (product.name || product._id.toString()),
        ]),
      ),
    };
  }

  private async buildClassChangeSummary(
    classroom: any,
    dto: Partial<CreateClassDto>,
  ): Promise<Array<{
    field: string;
    label: string;
    beforeValue: string;
    afterValue: string;
  }>> {
    const lookupMaps = await this.buildClassHistoryLookupMaps(classroom, dto);
    const fields = Object.keys(dto).filter((field) => field !== 'requestType');
    const changes: Array<{
      field: string;
      label: string;
      beforeValue: string;
      afterValue: string;
    }> = [];

    const beforeValueMap: Record<string, unknown> = {
      name: classroom?.name,
      code: classroom?.code,
      teacherId: classroom?.teacher,
      coTeachers: classroom?.coTeachers,
      productPackageId: classroom?.productPackage,
      classMode: classroom?.classMode,
      pricePerSession: classroom?.pricePerSession,
      teacherPayPerSession: classroom?.teacherPayPerSession,
      teacherPayPerStudent: classroom?.teacherPayPerStudent,
      baseDuration: classroom?.baseDuration,
      sessionDuration: classroom?.sessionDuration,
      subject: classroom?.subject,
      grade: classroom?.grade,
      learningGoals: classroom?.learningGoals,
      maxStudents: classroom?.maxStudents,
    };

    for (const field of fields) {
      const beforeValue = formatClassHistoryValue(field, beforeValueMap[field], lookupMaps);
      const afterValue = formatClassHistoryValue(field, (dto as any)[field], lookupMaps);
      if (beforeValue === afterValue) {
        continue;
      }

      changes.push({
        field,
        label: getClassHistoryFieldLabel(field),
        beforeValue,
        afterValue,
      });
    }

    return changes;
  }

  private async buildClassDurationPreview(
    classroom: any,
    nextBaseDuration: number,
    nextSessionDuration: number,
  ): Promise<{
    oldBaseDuration: number;
    oldSessionDuration: number;
    newBaseDuration: number;
    newSessionDuration: number;
    students: Array<{
      studentId?: Types.ObjectId;
      studentName?: string;
      studentCode?: string;
      oldDurationMinutes: number;
      newDurationMinutes: number;
      paidSessionsRemainingBefore?: number;
      bonusSessionsRemainingBefore?: number;
      totalSessionsRemainingBefore?: number;
      paidSessionsRemainingAfter?: number;
      bonusSessionsRemainingAfter?: number;
      totalSessionsRemainingAfter?: number;
      projectedTotalSessionsBefore?: number;
      projectedTotalSessionsAfter?: number;
    }>;
  }> {
    const studentIds = ((classroom?.students || []) as any[])
      .map((studentId) => objectIdToString(studentId))
      .filter((studentId: string | null): studentId is string => !!studentId);

    const currentDurationState = buildDurationSnapshotData(classroom);
    if (!studentIds.length) {
      return {
        oldBaseDuration: currentDurationState.baseDuration,
        oldSessionDuration: currentDurationState.sessionDuration,
        newBaseDuration: nextBaseDuration,
        newSessionDuration: nextSessionDuration,
        students: [],
      };
    }

    const [completedSessionMap, remainingAllowanceMap, students] = await Promise.all([
      this.buildStudentCompletedSessionMap(classroom, studentIds),
      this.buildStudentRemainingAllowanceMap(classroom, studentIds),
      this.studentModel
        .find({ _id: { $in: studentIds.map((studentId) => new Types.ObjectId(studentId)) } })
        .select('fullName studentCode')
        .lean(),
    ]);

    const studentMetaMap = new Map(
      (students as any[]).map((student) => [student._id.toString(), student]),
    );

    return {
      oldBaseDuration: currentDurationState.baseDuration,
      oldSessionDuration: currentDurationState.sessionDuration,
      newBaseDuration: nextBaseDuration,
      newSessionDuration: nextSessionDuration,
      students: studentIds.map((studentId) => {
        const currentDuration = getCurrentDurationForStudent(classroom, studentId);
        const completedSessions = toSafeNumber(completedSessionMap.get(studentId), 0);
        const remainingAllowance = remainingAllowanceMap.get(studentId) || {
          paidRemainingMinutes: 0,
          bonusRemainingMinutes: 0,
          totalRemainingMinutes: 0,
        };
        const oldDurationMinutes =
          toSafeNumber(currentDuration.sessionDuration, currentDurationState.sessionDuration)
          || currentDurationState.sessionDuration;
        const studentMeta = studentMetaMap.get(studentId) as any;

        const paidSessionsRemainingBefore = oldDurationMinutes > 0
          ? floorSessionCount(remainingAllowance.paidRemainingMinutes / oldDurationMinutes)
          : 0;
        const bonusSessionsRemainingBefore = oldDurationMinutes > 0
          ? floorSessionCount(remainingAllowance.bonusRemainingMinutes / oldDurationMinutes)
          : 0;
        const totalSessionsRemainingBefore = oldDurationMinutes > 0
          ? floorSessionCount(remainingAllowance.totalRemainingMinutes / oldDurationMinutes)
          : 0;
        const paidSessionsRemainingAfter = nextSessionDuration > 0
          ? floorSessionCount(remainingAllowance.paidRemainingMinutes / nextSessionDuration)
          : 0;
        const bonusSessionsRemainingAfter = nextSessionDuration > 0
          ? floorSessionCount(remainingAllowance.bonusRemainingMinutes / nextSessionDuration)
          : 0;
        const totalSessionsRemainingAfter = nextSessionDuration > 0
          ? floorSessionCount(remainingAllowance.totalRemainingMinutes / nextSessionDuration)
          : 0;

        return {
          studentId: new Types.ObjectId(studentId),
          studentName: studentMeta?.fullName,
          studentCode: studentMeta?.studentCode,
          oldDurationMinutes,
          newDurationMinutes: nextSessionDuration,
          paidSessionsRemainingBefore,
          bonusSessionsRemainingBefore,
          totalSessionsRemainingBefore,
          paidSessionsRemainingAfter,
          bonusSessionsRemainingAfter,
          totalSessionsRemainingAfter,
          projectedTotalSessionsBefore: completedSessions + totalSessionsRemainingBefore,
          projectedTotalSessionsAfter: completedSessions + totalSessionsRemainingAfter,
        };
      }),
    };
  }

  async buildClassHistoryArtifacts(
    classroom: any,
    dto: Partial<CreateClassDto> & Partial<Pick<UpdateClassDto, 'requestType'>>,
    actor: JwtPayload | undefined,
    action: ClassEditHistoryAction,
    note?: string,
  ): Promise<{
    changeSummary: Array<{
      field: string;
      label: string;
      beforeValue: string;
      afterValue: string;
    }>;
    durationPreview?: {
      oldBaseDuration: number;
      oldSessionDuration: number;
      newBaseDuration: number;
      newSessionDuration: number;
      students: Array<{
        studentId?: Types.ObjectId;
        studentName?: string;
        studentCode?: string;
        oldDurationMinutes: number;
        newDurationMinutes: number;
        paidSessionsRemainingBefore?: number;
        bonusSessionsRemainingBefore?: number;
        totalSessionsRemainingBefore?: number;
        paidSessionsRemainingAfter?: number;
        bonusSessionsRemainingAfter?: number;
        totalSessionsRemainingAfter?: number;
        projectedTotalSessionsBefore?: number;
        projectedTotalSessionsAfter?: number;
      }>;
    } | undefined;
    historyEntry: {
      editedAt: Date;
      editedByUserId?: Types.ObjectId;
      editedByName?: string;
      editedByRole?: string;
      action: ClassEditHistoryAction;
      requestType: PendingClassUpdateType;
      changes: Array<{
        field: string;
        label: string;
        beforeValue: string;
        afterValue: string;
      }>;
      durationPreview?: {
        oldBaseDuration: number;
        oldSessionDuration: number;
        newBaseDuration: number;
        newSessionDuration: number;
        students: Array<{
          studentId?: Types.ObjectId;
          studentName?: string;
          studentCode?: string;
          oldDurationMinutes: number;
          newDurationMinutes: number;
          paidSessionsRemainingBefore?: number;
          bonusSessionsRemainingBefore?: number;
          totalSessionsRemainingBefore?: number;
          paidSessionsRemainingAfter?: number;
          bonusSessionsRemainingAfter?: number;
          totalSessionsRemainingAfter?: number;
          projectedTotalSessionsBefore?: number;
          projectedTotalSessionsAfter?: number;
        }>;
      };
      note?: string;
    };
  }> {
    const requestType = resolveRequestedUpdateType(dto);
    const dtoWithoutMeta = stripUpdateMetaFields(dto);
    const changeSummary = await this.buildClassChangeSummary(classroom, dtoWithoutMeta);

    let durationPreview:
      | {
        oldBaseDuration: number;
        oldSessionDuration: number;
        newBaseDuration: number;
        newSessionDuration: number;
        students: Array<{
          studentId?: Types.ObjectId;
          studentName?: string;
          studentCode?: string;
          oldDurationMinutes: number;
          newDurationMinutes: number;
          paidSessionsRemainingBefore?: number;
          bonusSessionsRemainingBefore?: number;
          totalSessionsRemainingBefore?: number;
          paidSessionsRemainingAfter?: number;
          bonusSessionsRemainingAfter?: number;
          totalSessionsRemainingAfter?: number;
          projectedTotalSessionsBefore?: number;
          projectedTotalSessionsAfter?: number;
        }>;
      }
      | undefined;

    const nextBaseDuration =
      toSafeNumber(dtoWithoutMeta.baseDuration, toSafeNumber(classroom?.baseDuration, 60))
      || toSafeNumber(classroom?.baseDuration, 60)
      || 60;
    const nextSessionDuration =
      toSafeNumber(dtoWithoutMeta.sessionDuration, toSafeNumber(classroom?.sessionDuration, nextBaseDuration))
      || toSafeNumber(classroom?.sessionDuration, nextBaseDuration)
      || nextBaseDuration;

    if (
      dtoWithoutMeta.baseDuration !== undefined
      || dtoWithoutMeta.sessionDuration !== undefined
      || requestType === PendingClassUpdateType.DURATION_CHANGE
    ) {
      durationPreview = await this.buildClassDurationPreview(
        classroom,
        nextBaseDuration,
        nextSessionDuration,
      );
    }

    const actorId = getActorId(actor);
    const historyEntry = {
      editedAt: new Date(),
      editedByUserId: actorId ? new Types.ObjectId(actorId) : undefined,
      editedByName: actor?.fullName || actor?.email,
      editedByRole: actor?.role,
      action,
      requestType,
      changes: changeSummary,
      durationPreview,
      note: note?.trim() || undefined,
    };

    return {
      changeSummary,
      durationPreview,
      historyEntry,
    };
  }
}
