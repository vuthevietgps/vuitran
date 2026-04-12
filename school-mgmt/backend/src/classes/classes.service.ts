import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Classroom,
  ClassDocument,
  ClassEditHistoryAction,
  ClassUpdateRequestStatus,
  DurationSnapshotSource,
  PendingClassUpdateType,
  StudentConfigSlotType,
} from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { UpdateStudentConfigDto } from './dto/update-student-config.dto';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import {
  getCurrentTeacherIdForStudent,
  getCurrentDurationForStudent,
  getTeacherOwnedStudentIds,
} from './student-config.utils';
import { ClassesCoreService } from './classes-core.service';
import { ClassesDataService } from './classes-data.service';
import {
  applyInvoicePricingDefaults,
  assertCanReviewPendingUpdate,
  attachPricingSnapshot,
  buildAutoClassName,
  buildDurationSnapshotRecord,
  decorateClassroomForDisplay,
  filterClassStudentsByIds,
  floorSessionCount,
  getActorId,
  getClassSourceInvoice,
  isManagerRole,
  isClassTeacherMember,
  objectIdToString,
  resolveRequestedUpdateType,
  splitSaleUpdateChanges,
  stripUpdateMetaFields,
  toSafeNumber,
} from './classes.utils';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly classesCoreService: ClassesCoreService,
    private readonly classesDataService: ClassesDataService,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  CRUD
  // ══════════════════════════════════════════════════════════════════

  async create(dto: CreateClassDto, actor?: JwtPayload) {
    await this.classesCoreService.ensureCodeUnique(dto.code);

    let invoice: any = null;
    if (dto.invoiceId) {
      invoice = await this.invoiceModel.findById(dto.invoiceId).lean();
      if (!invoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }
      if (invoice.status !== InvoiceStatus.APPROVED && invoice.status !== InvoiceStatus.PAID) {
        throw new ForbiddenException('Hoa don chua duoc duyet');
      }
      if (!dto.studentIds?.length && invoice.studentId) {
        dto.studentIds = [invoice.studentId.toString()];
      }
      if (!dto.classMode && invoice.classType) {
        dto.classMode = invoice.classType;
      }
      if (!dto.productPackageId && invoice.productId) {
        dto.productPackageId = invoice.productId.toString();
      }
      invoice = await this.classesCoreService.hydrateInvoicePricingContext(invoice);
    }

    if (actor?.role === Role.SALE) {
      if (!dto.invoiceId) {
        throw new BadRequestException('SALE phai chon hoa don da duyet de tao lop');
      }
      const actorId = getActorId(actor)!;
      if (invoice?.saleId && invoice.saleId.toString() !== actorId) {
        throw new ForbiddenException('SALE chi duoc tao lop tu hoa don cua minh');
      }
      dto.saleId = actorId;
    }

    if (!dto.saleId && invoice?.saleId) {
      dto.saleId = invoice.saleId.toString();
    }

    if (actor?.role === Role.SALE) {
      await this.classesCoreService.validateTeacherForSaleScope(dto.teacherId, dto.saleId);
      await this.classesCoreService.assertStudentsBelongToSale(dto.studentIds || [], dto.saleId);
    }

    const payload = await this.classesCoreService.buildPayload(dto);
    applyInvoicePricingDefaults(payload, invoice);
    attachPricingSnapshot(payload, invoice);
    (payload as any).durationSnapshots = [
      buildDurationSnapshotRecord(
        payload,
        DurationSnapshotSource.INITIAL,
        PendingClassUpdateType.GENERAL,
        getActorId(actor),
      ),
    ];

    if (dto.invoiceId) {
      (payload as any).invoiceId = new Types.ObjectId(dto.invoiceId);
    }

    const created = await new this.classModel(payload).save();

    if (dto.invoiceId) {
      await this.invoiceModel.updateOne(
        { _id: dto.invoiceId },
        { $set: { classId: created._id } },
      );
      await this.classesCoreService.syncOrderProgressForInvoiceIds([dto.invoiceId]);
    }

    await this.classesDataService.syncStudentConfigsOnClass(created._id.toString(), getActorId(actor));

    this.classesCoreService.triggerStudentSupportSnapshotRefreshForClass(created._id.toString(), 'createClass');
    return this.classesCoreService.findByIdPopulated(created._id);
  }

  async findOne(id: string, actor?: JwtPayload) {
    const classroom = await this.classModel
      .findById(id)
      .select('teacher sale students substituteTeachers coTeachers studentConfigs')
      .lean();
    if (!classroom) throw new NotFoundException('Lop hoc khong ton tai');
    await this.classesCoreService.assertClassAccess(classroom, actor);
    const detailedClass = await this.classesCoreService.findByIdPopulated(id);
    if (actor?.role === Role.TEACHER) {
      const actorTeacherId = getActorId(actor);
      if (!actorTeacherId) {
        throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
      }
      if (isClassTeacherMember(detailedClass, actorTeacherId)) {
        return detailedClass;
      }
      const allowedStudentIds = new Set(getTeacherOwnedStudentIds(detailedClass, actorTeacherId));
      return filterClassStudentsByIds(detailedClass, allowedStudentIds);
    }

    if (actor?.role !== Role.PARENT) {
      return detailedClass;
    }

    const actorId = getActorId(actor);
    if (!actorId) {
      throw new ForbiddenException('Ban khong co quyen truy cap lop hoc nay');
    }

    const allowedStudentIds = new Set(await this.classesCoreService.getParentStudentIds(actorId));
    return filterClassStudentsByIds(detailedClass, allowedStudentIds);
  }

  async findAll(actor: JwtPayload) {
    let filter: any = {};
    const actorId = getActorId(actor);
    let parentStudentIdSet: Set<string> | null = null;

    if (actor.role === Role.SALE) {
      filter = { sale: actorId };
    } else if (actor.role === Role.TEACHER) {
      filter = {
        $or: [
          { teacher: actorId },
          { 'substituteTeachers.teacherId': actorId },
          { 'coTeachers.teacherId': actorId },
          { 'studentConfigs.teacherSlots.teacherId': actorId },
        ],
      };
    } else if (actor.role === Role.PARENT) {
      if (!actorId) {
        throw new ForbiddenException('Ban khong co quyen truy cap danh sach lop hoc');
      }
      const parentStudentIds = await this.classesCoreService.getParentStudentIds(actorId);
      if (!parentStudentIds.length) {
        return [];
      }
      parentStudentIdSet = new Set(parentStudentIds);
      filter = {
        students: {
          $in: parentStudentIds.map((id) => new Types.ObjectId(id)),
        },
      };
    }

    const classrooms = await this.classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('coTeachers.teacherId', 'fullName email role userCode')
      .populate('coTeachers.assignedBy', 'fullName email role')
      .populate('pendingSaleUpdate.requestedBy', 'fullName email role')
      .populate('pendingSaleUpdate.reviewedBy', 'fullName email role')
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .populate('studentConfigs.studentId', 'fullName studentCode')
      .populate('studentConfigs.teacherSlots.teacherId', 'fullName email role userCode')
      .populate('studentConfigs.teacherSlots.assignedBy', 'fullName email role')
      .lean();

    const sourceInvoiceMap = await this.classesCoreService.buildClassSourceInvoiceMap(classrooms);
    const mapped = await Promise.all(classrooms.map(async (classroom) => {
      const projectedClassroom = await this.classesDataService.withProjectedStudentTotals(classroom);
      return decorateClassroomForDisplay(
        projectedClassroom,
        getClassSourceInvoice(projectedClassroom, sourceInvoiceMap),
      );
    }));

    if (actor.role === Role.TEACHER && actorId) {
      return mapped
        .map((classroom) => {
          if (isClassTeacherMember(classroom, actorId)) {
            return classroom;
          }
          const allowedStudentIds = new Set(getTeacherOwnedStudentIds(classroom, actorId));
          if (!allowedStudentIds.size) {
            return null;
          }
          return filterClassStudentsByIds(classroom, allowedStudentIds);
        })
        .filter((classroom): classroom is NonNullable<typeof classroom> => !!classroom);
    }

    if (actor.role !== Role.PARENT || !parentStudentIdSet) {
      return mapped;
    }

    return mapped.map((classroom) =>
      filterClassStudentsByIds(classroom, parentStudentIdSet!),
    );
  }

  async findSaleOfflineOptions(actor: JwtPayload) {
    const actorId = getActorId(actor);
    if (actor.role !== Role.SALE || !actorId) {
      throw new ForbiddenException('Ban khong co quyen truy cap danh sach lop offline');
    }

    const classrooms = await this.classModel
      .find({
        classMode: 'OFFLINE',
        status: 'ACTIVE',
      })
      .sort({ createdAt: -1 })
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('coTeachers.teacherId', 'fullName email role userCode')
      .populate('coTeachers.assignedBy', 'fullName email role')
      .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
      .populate('students', 'fullName age parentName studentCode')
      .lean();

    const sourceInvoiceMap = await this.classesCoreService.buildClassSourceInvoiceMap(classrooms);
    return classrooms
      .filter((classroom) => {
        if (!classroom.maxStudents) {
          return true;
        }
        const currentStudentCount = Array.isArray(classroom.students) ? classroom.students.length : 0;
        return currentStudentCount < classroom.maxStudents;
      })
      .map((classroom) =>
        decorateClassroomForDisplay(
          classroom,
          getClassSourceInvoice(classroom, sourceInvoiceMap),
        ),
      );
  }

  // ══════════════════════════════════════════════════════════════════
  //  AUTO PLACEMENT
  // ══════════════════════════════════════════════════════════════════

  async autoPlaceApprovedInvoice(
    params: {
      invoiceId: string;
      studentId: string;
      requestedClassId?: string | null;
      requestedClassCode?: string | null;
      createNewClassWhenApproved?: boolean;
      requestedTeacherId?: string | null;
    },
    actor?: JwtPayload,
  ): Promise<{ action: 'SKIPPED' | 'ASSIGNED_EXISTING' | 'CREATED_NEW'; classId?: string }> {
    const invoiceId = objectIdToString(params.invoiceId);
    const studentId = objectIdToString(params.studentId);
    const requestedClassId = objectIdToString(params.requestedClassId);
    const requestedClassCode = String(params.requestedClassCode || '').trim().toUpperCase() || null;
    const createNewClassWhenApproved = !!params.createNewClassWhenApproved;
    const requestedTeacherId = objectIdToString(params.requestedTeacherId);

    if (!invoiceId || !studentId || (!requestedClassId && !requestedClassCode && !createNewClassWhenApproved)) {
      if (!requestedClassId && requestedTeacherId && !requestedClassCode && !createNewClassWhenApproved) {
        this.logger.warn(
          `Skip auto-placing invoice ${invoiceId || params.invoiceId}: class code must be entered manually`,
        );
      }
      return { action: 'SKIPPED' };
    }

    if (requestedClassId) {
      const classroom = await this.classModel
        .findById(requestedClassId)
        .select('_id classMode')
        .lean();
      if (!classroom) {
        throw new NotFoundException('Lop duoc chon tren order khong ton tai');
      }

      const invoice = await this.invoiceModel
        .findById(invoiceId)
        .select('_id classId classType')
        .lean();
      if (!invoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }
      if ((invoice as any).classId) {
        return { action: 'SKIPPED', classId: objectIdToString((invoice as any).classId) || undefined };
      }
      if ((invoice as any).classType && classroom.classMode && (invoice as any).classType !== classroom.classMode) {
        throw new BadRequestException('Loai lop duoc chon tren order khong khop voi hoa don');
      }

      const assigned = await this.assignStudentsBySale(
        requestedClassId,
        { studentIds: [studentId], invoiceId },
        actor as JwtPayload,
      );
      return {
        action: 'ASSIGNED_EXISTING',
        classId: objectIdToString((assigned as any)?._id) || requestedClassId,
      };
    }

    const invoice = await this.invoiceModel
      .findById(invoiceId)
      .select('_id classId classType orderId orderItemIndex productId productName saleId studentId')
      .lean();
    if (!invoice) {
      throw new NotFoundException('Hoa don khong ton tai');
    }
    if ((invoice as any).classId) {
      return {
        action: 'SKIPPED',
        classId: objectIdToString((invoice as any).classId) || undefined,
      };
    }

    const matchedClass = requestedClassCode
      ? await this.classModel
          .findOne({ code: requestedClassCode })
          .select('_id classMode')
          .lean()
      : null;

    if (matchedClass) {
      if ((invoice as any).classType && matchedClass.classMode && (invoice as any).classType !== matchedClass.classMode) {
        throw new BadRequestException('Loai lop theo ma lop du kien khong khop voi hoa don');
      }

      const assigned = await this.assignStudentsBySale(
        matchedClass._id.toString(),
        { studentIds: [studentId], invoiceId },
        actor as JwtPayload,
      );
      return {
        action: 'ASSIGNED_EXISTING',
        classId: objectIdToString((assigned as any)?._id) || matchedClass._id.toString(),
      };
    }

    if (!requestedTeacherId) {
      this.logger.warn(
        `Skip auto-creating class for invoice ${invoiceId}: missing requestedTeacherId for class code ${requestedClassCode}`,
      );
      return { action: 'SKIPPED' };
    }

    const [student, order] = await Promise.all([
      this.studentModel.findById(studentId).select('fullName').lean(),
      (invoice as any).orderId
        ? this.orderModel.findById((invoice as any).orderId).select('items orderCode').lean()
        : Promise.resolve(null),
    ]);

    const orderItemIndex = Number((invoice as any).orderItemIndex ?? -1);
    const orderItems = Array.isArray((order as any)?.items) ? (order as any).items : [];
    const orderItem = orderItemIndex >= 0 ? orderItems[orderItemIndex] || null : null;

    const created = await this.create(
      {
        name: buildAutoClassName({
          studentName: (student as any)?.fullName,
          productName: (invoice as any)?.productName,
          classMode: (invoice as any)?.classType,
        }),
        code: requestedClassCode || await this.classesCoreService.generateAutoClassCode((order as any)?.orderCode, invoiceId),
        teacherId: requestedTeacherId,
        saleId: objectIdToString((invoice as any)?.saleId) || undefined,
        invoiceId,
        classMode: (invoice as any)?.classType || undefined,
        productPackageId: objectIdToString((invoice as any)?.productId) || undefined,
        studentIds: [studentId],
        subject: String(orderItem?.subject || '').trim() || undefined,
        learningGoals: String(orderItem?.learningGoals || '').trim() || undefined,
        maxStudents:
          orderItem?.maxStudents !== undefined && orderItem?.maxStudents !== null
            ? Number(orderItem.maxStudents)
            : undefined,
      },
      actor,
    );

    return {
      action: 'CREATED_NEW',
      classId: objectIdToString((created as any)?._id) || undefined,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE / APPROVE / REJECT
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateClassDto, actor?: JwtPayload) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');
    const actorId = getActorId(actor);

    if (actor?.role === Role.SALE) {
      if (!actorId || existing.sale?.toString() !== actorId) {
        throw new ForbiddenException('Ban khong phu trach lop hoc nay');
      }

      const { directChanges, approvalChanges, requestType } = splitSaleUpdateChanges(dto, existing);

      const directPrepared = await this.classesCoreService.prepareClassUpdate(id, directChanges, existing);
      const hasDirectChanges = Object.keys(directPrepared.update).length > 0;

      if (approvalChanges?.teacherId) {
        await this.classesCoreService.validateTeacherForClassSale(existing, approvalChanges.teacherId);
      }
      const hasApprovalChanges = !!approvalChanges;

      if (!hasDirectChanges && !hasApprovalChanges) {
        throw new BadRequestException('Khong co thay doi nao de cap nhat');
      }

      if (hasDirectChanges) {
        const directHistoryArtifacts = await this.classesDataService.buildClassHistoryArtifacts(
          existing,
          directChanges,
          actor,
          ClassEditHistoryAction.SALE_DIRECT_UPDATED,
        );
        await this.classesCoreService.applyPreparedClassUpdate(id, directPrepared, 'saleDirectUpdateClass', {
          durationSnapshotSource: directPrepared.durationSnapshotData
            ? DurationSnapshotSource.MANAGER_DIRECT
            : undefined,
          requestType: resolveRequestedUpdateType(directChanges),
          effectiveById: actorId,
          historyEntry: directHistoryArtifacts.historyEntry,
        });
      }

      if (hasApprovalChanges) {
        const persistedRequestedChanges = stripUpdateMetaFields(approvalChanges as UpdateClassDto);
        const approvalHistoryArtifacts = await this.classesDataService.buildClassHistoryArtifacts(
          existing,
          approvalChanges,
          actor,
          ClassEditHistoryAction.SALE_REQUESTED,
        );
        await this.classModel.findByIdAndUpdate(id, {
          $set: {
            pendingSaleUpdate: {
              status: ClassUpdateRequestStatus.PENDING,
              requestType,
              requestedChanges: persistedRequestedChanges,
              requestedBy: new Types.ObjectId(actorId),
              requestedAt: new Date(),
              changeSummary: approvalHistoryArtifacts.changeSummary,
              durationPreview: approvalHistoryArtifacts.durationPreview,
              reviewedBy: null,
              reviewedAt: null,
              rejectionReason: null,
            },
          },
          $push: {
            editHistory: approvalHistoryArtifacts.historyEntry,
          },
        });

        if (hasDirectChanges) {
          return {
            ok: true,
            pendingApproval: true,
            message: requestType === PendingClassUpdateType.DURATION_CHANGE
              ? 'Da cap nhat thong tin lop. Phan doi giao vien/thoi luong dang cho Director duyet'
              : 'Da cap nhat thong tin lop. Phan doi giao vien dang cho Director/Ops duyet',
          };
        }

        return {
          ok: true,
          pendingApproval: true,
          message: requestType === PendingClassUpdateType.DURATION_CHANGE
            ? 'Da gui yeu cau doi giao vien/thoi luong lop hoc cho Director duyet'
            : 'Da gui yeu cau doi giao vien/luong GV cho Director/Ops duyet',
        };
      }

      return this.classesCoreService.findByIdPopulated(id);
    }

    if (actor?.role && !isManagerRole(actor.role)) {
      throw new ForbiddenException('Ban khong co quyen cap nhat lop hoc');
    }

    const prepared = await this.classesCoreService.prepareClassUpdate(id, dto, existing);
    const managerHistoryArtifacts = await this.classesDataService.buildClassHistoryArtifacts(
      existing,
      dto,
      actor,
      ClassEditHistoryAction.MANAGER_UPDATED,
    );
    await this.classesCoreService.applyPreparedClassUpdate(id, prepared, 'updateClass', {
      clearPendingSaleUpdate: true,
      durationSnapshotSource: prepared.durationSnapshotData
        ? DurationSnapshotSource.MANAGER_DIRECT
        : undefined,
      requestType: resolveRequestedUpdateType(dto),
      effectiveById: actorId,
      historyEntry: managerHistoryArtifacts.historyEntry,
    });

    return this.classesCoreService.findByIdPopulated(id);
  }

  async approvePendingSaleUpdate(id: string, actor?: JwtPayload) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');

    const pendingSaleUpdate = (existing as any).pendingSaleUpdate;
    if (!pendingSaleUpdate || pendingSaleUpdate.status !== ClassUpdateRequestStatus.PENDING) {
      throw new BadRequestException('Lop hoc khong co yeu cau cap nhat cho duyet');
    }
    assertCanReviewPendingUpdate(pendingSaleUpdate, actor);

    const requestedChanges = (pendingSaleUpdate.requestedChanges || {}) as UpdateClassDto;
    const requestType = (pendingSaleUpdate.requestType || PendingClassUpdateType.GENERAL) as PendingClassUpdateType;
    const prepared = await this.classesCoreService.prepareClassUpdate(id, requestedChanges, existing);
    if (requestedChanges.teacherId) {
      prepared.update.teacher = await this.classesCoreService.validateTeacherForClassSale(existing, requestedChanges.teacherId);
    }
    if (!Object.keys(prepared.update).length) {
      throw new BadRequestException('Yeu cau cap nhat khong hop le');
    }

    const actorId = getActorId(actor);
    const approvalHistoryArtifacts = await this.classesDataService.buildClassHistoryArtifacts(
      existing,
      requestedChanges,
      actor,
      ClassEditHistoryAction.APPROVED,
    );
    await this.classesCoreService.applyPreparedClassUpdate(id, prepared, 'approvePendingSaleUpdate', {
      clearPendingSaleUpdate: true,
      durationSnapshotSource: prepared.durationSnapshotData
        ? (
          requestType === PendingClassUpdateType.DURATION_CHANGE
            ? DurationSnapshotSource.APPROVED_DURATION_CHANGE
            : DurationSnapshotSource.APPROVED_SALE_UPDATE
        )
        : undefined,
      requestType,
      effectiveById: actorId,
      historyEntry: approvalHistoryArtifacts.historyEntry,
    });
    return this.classesCoreService.findByIdPopulated(id);
  }

  async rejectPendingSaleUpdate(id: string, reason?: string, actor?: JwtPayload) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');

    const pendingSaleUpdate = (existing as any).pendingSaleUpdate;
    if (!pendingSaleUpdate || pendingSaleUpdate.status !== ClassUpdateRequestStatus.PENDING) {
      throw new BadRequestException('Lop hoc khong co yeu cau cap nhat cho duyet');
    }
    assertCanReviewPendingUpdate(pendingSaleUpdate, actor);

    const actorId = getActorId(actor);
    if (!actorId) {
      throw new ForbiddenException('Khong xac dinh duoc nguoi duyet');
    }

    const rejectionHistoryEntry = {
      editedAt: new Date(),
      editedByUserId: new Types.ObjectId(actorId),
      editedByName: actor?.fullName || actor?.email,
      editedByRole: actor?.role,
      action: ClassEditHistoryAction.REJECTED,
      requestType: (pendingSaleUpdate.requestType || PendingClassUpdateType.GENERAL) as PendingClassUpdateType,
      changes: Array.isArray(pendingSaleUpdate.changeSummary) ? pendingSaleUpdate.changeSummary : [],
      durationPreview: pendingSaleUpdate.durationPreview,
      note: reason?.trim() || 'Khong dat yeu cau',
    };

    await this.classModel.findByIdAndUpdate(id, {
      $set: {
        'pendingSaleUpdate.status': ClassUpdateRequestStatus.REJECTED,
        'pendingSaleUpdate.reviewedBy': new Types.ObjectId(actorId),
        'pendingSaleUpdate.reviewedAt': new Date(),
        'pendingSaleUpdate.rejectionReason': reason?.trim() || 'Khong dat yeu cau',
      },
      $push: {
        editHistory: rejectionHistoryEntry,
      },
    });

    return this.classesCoreService.findByIdPopulated(id);
  }

  // ══════════════════════════════════════════════════════════════════
  //  DELETE
  // ══════════════════════════════════════════════════════════════════

  async remove(id: string) {
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');

    const classObjectId = new Types.ObjectId(id);
    const AttendanceModel = this.studentModel.db.model('Attendance');
    const SessionModel = this.studentModel.db.model('Session');
    await Promise.all([
      AttendanceModel.deleteMany({ classId: classObjectId }),
      SessionModel.deleteMany({ classId: classObjectId }),
    ]);

    await this.invoiceModel.updateMany(
      { classId: classObjectId },
      { $unset: { classId: 1 } },
    );

    const deleted = await this.classModel.findByIdAndDelete(id).lean();
    const studentIds = ((classroom as any).students || []).map((studentId: any) =>
      studentId?.toString?.(),
    ).filter((studentId: string | undefined): studentId is string => !!studentId);
    this.classesCoreService.triggerStudentSupportSnapshotRefreshForStudentIds(studentIds, 'removeClass');
    return deleted;
  }

  // ══════════════════════════════════════════════════════════════════
  //  STUDENT ASSIGNMENT
  // ══════════════════════════════════════════════════════════════════

  async assignStudentsBySale(id: string, dto: AssignStudentsDto, actor: JwtPayload) {
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');
    const actorId = getActorId(actor);

    if (actor.role === Role.SALE) {
      if (!actorId || classroom.sale?.toString() !== actorId) {
        throw new ForbiddenException('Bạn không phụ trách lớp này');
      }
    }
    const studentIds = dto.studentIds || [];
    let invoice: any = null;
    if (dto.invoiceId) {
      invoice = await this.invoiceModel.findById(dto.invoiceId).lean();
      if (!invoice) {
        throw new NotFoundException('Hoa don khong ton tai');
      }
      if (invoice.status !== InvoiceStatus.APPROVED && invoice.status !== InvoiceStatus.PAID) {
        throw new ForbiddenException('Hoa don chua duoc duyet');
      }
      if (invoice.classId) {
        throw new BadRequestException('Hoa don nay da duoc gan vao lop hoc khac');
      }
      if (invoice.classType && invoice.classType !== classroom.classMode) {
        throw new BadRequestException('Loai lop cua hoa don khong khop voi lop duoc chon');
      }
      const invoiceStudentId = invoice.studentId?.toString?.();
      if (!invoiceStudentId || !studentIds.includes(invoiceStudentId)) {
        throw new BadRequestException('Hoc sinh tren hoa don phai nam trong danh sach them vao lop');
      }
      if (actor.role === Role.SALE && actorId) {
        const invoiceSaleId = invoice.saleId?.toString?.();
        if (invoiceSaleId && invoiceSaleId !== actorId) {
          throw new ForbiddenException('Sale chi duoc su dung hoa don cua minh');
        }
      }
    }
    if (!studentIds.length) throw new BadRequestException('Vui lòng chọn học viên');
    const studentFilter: any = {
      _id: { $in: studentIds },
      approvalStatus: 'APPROVED',
    };
    if (actor.role === Role.SALE && actorId) {
      studentFilter.saleId = new Types.ObjectId(actorId);
    }
    const valid = await this.studentModel.find(studentFilter, '_id').lean();
    if (valid.length !== studentIds.length) {
      const invalidCount = studentIds.length - valid.length;
      throw new BadRequestException(`${invalidCount} học viên chưa được duyệt hoặc không hợp lệ`);
    }
    const existingStudentIds = classroom.students?.map((s: any) => s.toString()) || [];
    const merged = Array.from(
      new Set([...existingStudentIds, ...studentIds])
    ).map((sid) => new Types.ObjectId(sid));

    if ((classroom as any).maxStudents && merged.length > (classroom as any).maxStudents) {
      throw new BadRequestException(
        `Lớp chỉ chứa tối đa ${(classroom as any).maxStudents} học viên (hiện có ${existingStudentIds.length})`,
      );
    }

    await this.classModel.findByIdAndUpdate(id, { students: merged });
    if (dto.invoiceId) {
      await this.invoiceModel.updateOne(
        { _id: dto.invoiceId },
        { $set: { classId: new Types.ObjectId(id) } },
      );
      await this.classesCoreService.syncOrderProgressForInvoiceIds([dto.invoiceId]);
    }
    await this.classesDataService.syncStudentConfigsOnClass(id, actorId);

    this.classesCoreService.triggerStudentSupportSnapshotRefreshForClass(id, 'assignStudentsBySale');
    return this.classesCoreService.findByIdPopulated(id);
  }

  // ══════════════════════════════════════════════════════════════════
  //  STUDENT CONFIG
  // ══════════════════════════════════════════════════════════════════

  async updateStudentConfig(
    classId: string,
    studentId: string,
    dto: UpdateStudentConfigDto,
    actor?: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) {
      throw new NotFoundException('Class not found');
    }

    const actorId = getActorId(actor);
    if (actor?.role === Role.SALE) {
      if (!actorId || classroom.sale?.toString() !== actorId) {
        throw new ForbiddenException('Ban khong phu trach lop hoc nay');
      }
    } else if (!actor?.role || !isManagerRole(actor.role)) {
      throw new ForbiddenException('Ban khong co quyen cap nhat hoc sinh trong lop');
    }

    const classStudentIds = ((classroom as any).students || [])
      .map((currentStudentId: any) => currentStudentId?.toString?.())
      .filter((currentStudentId: string | undefined): currentStudentId is string => !!currentStudentId);
    if (!classStudentIds.includes(studentId)) {
      throw new BadRequestException('Hoc sinh khong thuoc lop hoc nay');
    }

    await this.classesDataService.syncStudentConfigsOnClass(classId, actorId);
    const refreshedClassroom = await this.classModel.findById(classId).lean();
    if (!refreshedClassroom) {
      throw new NotFoundException('Class not found');
    }

    const studentConfig = ((refreshedClassroom as any).studentConfigs || [])
      .find((config: any) => config?.studentId?.toString?.() === studentId);
    if (!studentConfig) {
      throw new NotFoundException('Khong tim thay cau hinh hoc sinh trong lop');
    }

    const updateQuery: Record<string, any> = {
      $set: {
        'studentConfigs.$[studentConfig].updatedAt': new Date(),
      },
    };
    const arrayFilters = [{ 'studentConfig.studentId': new Types.ObjectId(studentId) }];
    let hasChanges = false;

    if (dto.teacherId) {
      const teacherSlots = Array.isArray(studentConfig.teacherSlots) ? studentConfig.teacherSlots : [];
      const currentTeacherId = getCurrentTeacherIdForStudent(refreshedClassroom, studentId);

      if (currentTeacherId !== dto.teacherId) {
        if (teacherSlots.length >= 3) {
          throw new BadRequestException('Da dat toi da 3 moc giao vien cho hoc sinh nay');
        }

        const validatedTeacherId = await this.classesCoreService.validateTeacherForClassSale(refreshedClassroom, dto.teacherId);
        updateQuery.$push = updateQuery.$push || {};
        updateQuery.$push['studentConfigs.$[studentConfig].teacherSlots'] = {
          slotIndex: teacherSlots.length + 1,
          slotType: StudentConfigSlotType.UPDATE,
          teacherId: validatedTeacherId,
          assignedAt: new Date(),
          assignedBy: actorId ? new Types.ObjectId(actorId) : undefined,
        };
        hasChanges = true;
      }
    }

    const hasDurationPayload = dto.baseDuration !== undefined || dto.sessionDuration !== undefined;
    if (hasDurationPayload) {
      const durationSlots = Array.isArray(studentConfig.durationSlots) ? studentConfig.durationSlots : [];
      const currentDuration = getCurrentDurationForStudent(refreshedClassroom, studentId);
      const nextBaseDuration =
        toSafeNumber(dto.baseDuration, currentDuration.baseDuration) || currentDuration.baseDuration;
      const nextSessionDuration =
        toSafeNumber(dto.sessionDuration, currentDuration.sessionDuration) || currentDuration.sessionDuration;

      if (
        nextBaseDuration !== currentDuration.baseDuration
        || nextSessionDuration !== currentDuration.sessionDuration
      ) {
        if (durationSlots.length >= 3) {
          throw new BadRequestException('Da dat toi da 3 moc thoi luong cho hoc sinh nay');
        }

        const projectedTotalSessions = await this.classesDataService.buildProjectedStudentTotalSessionsMap(
          refreshedClassroom,
          [studentId],
          new Map([[studentId, nextSessionDuration]]),
        );

        updateQuery.$push = updateQuery.$push || {};
        updateQuery.$push['studentConfigs.$[studentConfig].durationSlots'] = {
          slotIndex: durationSlots.length + 1,
          slotType: StudentConfigSlotType.UPDATE,
          effectiveAt: new Date(),
          effectiveBy: actorId ? new Types.ObjectId(actorId) : undefined,
          baseDuration: nextBaseDuration,
          sessionDuration: nextSessionDuration,
          totalSessions: floorSessionCount(
            projectedTotalSessions.get(studentId) || currentDuration.totalSessions,
          ),
        };
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      throw new BadRequestException('Khong co thay doi nao de luu');
    }

    await this.classModel.updateOne(
      { _id: new Types.ObjectId(classId) },
      updateQuery,
      { arrayFilters },
    );

    this.classesCoreService.triggerStudentSupportSnapshotRefreshForClass(classId, 'updateStudentConfig');
    return this.classesCoreService.findByIdPopulated(classId);
  }

  // ══════════════════════════════════════════════════════════════════
  //  CURRICULUM MANAGEMENT
  // ══════════════════════════════════════════════════════════════════

  async updateCurriculum(classId: string, curriculum: any[], actor?: JwtPayload) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    await this.classesCoreService.assertClassAccess(classroom, actor);
    (classroom as any).curriculum = curriculum;
    await classroom.save();
    this.classesCoreService.triggerStudentSupportSnapshotRefreshForClass(classId, 'updateCurriculum');
    return this.classesCoreService.findByIdPopulated(classId);
  }

  async markCurriculumItemCompleted(
    classId: string,
    itemId: string,
    sessionId?: string,
    actor?: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    await this.classesCoreService.assertClassAccess(classroom, actor);

    const curriculum = (classroom as any).curriculum || [];
    const item = curriculum.find((ci: any) => ci._id?.toString() === itemId);
    if (!item) throw new NotFoundException('Mục chương trình không tồn tại');

    item.isCompleted = true;
    item.completedAt = new Date();
    if (sessionId) {
      item.completedInSessionId = new Types.ObjectId(sessionId);
    }

    (classroom as any).curriculum = curriculum;
    await classroom.save();
    this.classesCoreService.triggerStudentSupportSnapshotRefreshForClass(classId, 'markCurriculumItemCompleted');
    return this.classesCoreService.findByIdPopulated(classId);
  }

  async getCurriculumProgress(classId: string, actor?: JwtPayload) {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    await this.classesCoreService.assertClassAccess(classroom, actor);

    const curriculum = (classroom as any).curriculum || [];
    const totalItems = curriculum.length;
    const completedItems = curriculum.filter((item: any) => item.isCompleted).length;

    return {
      classId,
      classCode: classroom.code,
      className: classroom.name,
      subject: (classroom as any).subject,
      grade: (classroom as any).grade,
      learningGoals: (classroom as any).learningGoals,
      curriculum,
      totalItems,
      completedItems,
      progressPercent: totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  DELEGATION TO CORE SERVICE
  // ══════════════════════════════════════════════════════════════════

  async addSubstituteTeacher(classId: string, data: Parameters<ClassesCoreService['addSubstituteTeacher']>[1]) {
    return this.classesCoreService.addSubstituteTeacher(classId, data);
  }

  async removeSubstituteTeacher(classId: string, teacherId: string) {
    return this.classesCoreService.removeSubstituteTeacher(classId, teacherId);
  }

  async getActiveSubstitute(classId: string, date: Date) {
    return this.classesCoreService.getActiveSubstitute(classId, date);
  }

  async suggestTeachers(params: { subject?: string; grade?: string; teachingMode?: string }) {
    return this.classesCoreService.suggestTeachers(params);
  }
}
