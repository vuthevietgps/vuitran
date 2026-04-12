import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { SessionsService } from '../sessions/sessions.service';
import { CreateTrialEnrollmentDto } from './dto/create-trial-enrollment.dto';
import { UpdateTrialEnrollmentDto } from './dto/update-trial-enrollment.dto';
import { QueryTrialEnrollmentDto } from './dto/query-trial-enrollment.dto';
import { RecordTrialSessionDto } from './dto/record-trial-session.dto';
import { ConvertTrialEnrollmentDto } from './dto/convert-trial-enrollment.dto';
import { RejectTrialEnrollmentDto } from './dto/reject-trial-enrollment.dto';
import { TeacherPaidOnlyTrialEnrollmentDto } from './dto/teacher-paid-only-trial-enrollment.dto';
import {
  TrialEnrollment,
  TrialEnrollmentDocument,
  TrialEnrollmentStatus,
} from './schemas/trial-enrollment.schema';

@Injectable()
export class TrialEnrollmentsService {
  constructor(
    @InjectModel(TrialEnrollment.name)
    private readonly trialEnrollmentModel: Model<TrialEnrollmentDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly sessionsService: SessionsService,
  ) {}

  private readonly ACTIVE_STATUSES = [
    TrialEnrollmentStatus.PENDING_TRIAL,
    TrialEnrollmentStatus.WAITING_DECISION,
  ];

  private getActorId(user: any): string {
    return String(user?.sub ?? user?._id ?? user?.userId ?? '');
  }

  private appendNotes(existing?: string, ...incoming: Array<string | undefined | null>): string | undefined {
    const parts = [existing, ...incoming]
      .map((value) => value?.trim())
      .filter((value): value is string => !!value);
    return parts.length ? parts.join('\n') : undefined;
  }

  private normalizeMongoId(value?: string | Types.ObjectId | null): Types.ObjectId | undefined {
    if (!value) return undefined;
    if (value instanceof Types.ObjectId) return value;
    return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
  }

  private async syncOrderProgressForInvoiceIds(
    invoiceIds: Array<string | Types.ObjectId>,
  ): Promise<void> {
    const normalizedInvoiceIds = invoiceIds
      .map((invoiceId) => this.normalizeMongoId(invoiceId))
      .filter((invoiceId): invoiceId is Types.ObjectId => !!invoiceId);

    if (!normalizedInvoiceIds.length) {
      return;
    }

    const sourceInvoices = await this.invoiceModel
      .find({ _id: { $in: normalizedInvoiceIds } })
      .select('_id orderId')
      .lean();

    const orderIds = Array.from(
      new Set(
        sourceInvoices
          .map((invoice: any) => invoice?.orderId?.toString?.())
          .filter((orderId: string | undefined): orderId is string => !!orderId),
      ),
    );

    if (!orderIds.length) {
      return;
    }

    const orderInvoices = await this.invoiceModel
      .find({ orderId: { $in: orderIds.map((orderId) => new Types.ObjectId(orderId)) } })
      .select('_id orderId classId')
      .lean();

    const invoicesByOrder = new Map<string, any[]>();
    for (const invoice of orderInvoices) {
      const orderId = invoice?.orderId?.toString?.();
      if (!orderId) continue;
      if (!invoicesByOrder.has(orderId)) {
        invoicesByOrder.set(orderId, []);
      }
      invoicesByOrder.get(orderId)!.push(invoice);
    }

    for (const orderId of orderIds) {
      const relatedInvoices = invoicesByOrder.get(orderId) || [];
      const allInvoicesAssignedToClass =
        relatedInvoices.length > 0 && relatedInvoices.every((invoice) => !!invoice.classId);
      const uniqueClassIds = Array.from(
        new Set(
          relatedInvoices
            .map((invoice) => invoice?.classId?.toString?.())
            .filter((classId: string | undefined): classId is string => !!classId),
        ),
      );

      await this.orderModel.findByIdAndUpdate(orderId, {
        $set: {
          status: allInvoicesAssignedToClass ? OrderStatus.COMPLETED : OrderStatus.APPROVED,
          'processedResults.invoiceIds': relatedInvoices.map(
            (invoice) => new Types.ObjectId(invoice._id),
          ),
          'processedResults.classIds': uniqueClassIds.map(
            (classId) => new Types.ObjectId(classId),
          ),
        },
      });
    }
  }

  private getRoleScopedFilter(user: any): FilterQuery<TrialEnrollmentDocument> {
    const filter: FilterQuery<TrialEnrollmentDocument> = {};
    if (user?.role === Role.SALE) {
      const actorId = this.getActorId(user);
      if (actorId) filter.saleId = new Types.ObjectId(actorId);
    }
    return filter;
  }

  private assertSaleAccess(trialEnrollment: any, user?: any): void {
    if (user?.role !== Role.SALE) return;
    const actorId = this.getActorId(user);
    const saleId = trialEnrollment?.saleId?.toString?.();
    if (!actorId || !saleId || actorId !== saleId) {
      throw new NotFoundException('Hoc thu khong ton tai');
    }
  }

  private async loadClassOrFail(classId: string | Types.ObjectId) {
    const classroom = await this.classModel.findById(classId).select('name code classMode maxStudents students').lean();
    if (!classroom) {
      throw new BadRequestException('Lop hoc khong ton tai');
    }
    if ((classroom as any).classMode !== ClassMode.OFFLINE) {
      throw new BadRequestException('Hoc thu chi ap dung cho lop OFFLINE');
    }
    return classroom as any;
  }

  private async loadProductOrFail(productId: string | Types.ObjectId) {
    const product = await this.productModel.findById(productId).select('name code teachingMode').lean();
    if (!product) {
      throw new BadRequestException('Goi san pham khong ton tai');
    }
    if ((product as any).teachingMode === 'ONLINE') {
      throw new BadRequestException('Goi san pham nay khong ho tro hoc thu offline');
    }
    return product as any;
  }

  private async populateById(id: string) {
    return this.trialEnrollmentModel
      .findById(id)
      .populate('classId', 'name code classMode subject grade teacher')
      .populate('productId', 'name code teachingMode')
      .populate('saleId', 'fullName email phone')
      .populate('studentId', 'fullName studentCode parentName parentPhone approvalStatus')
      .populate('invoiceId', 'invoiceNumber status amount sessionsRemaining paymentDate')
      .lean();
  }

  private async loadById(id: string) {
    const enrollment = await this.trialEnrollmentModel.findById(id);
    if (!enrollment) {
      throw new NotFoundException('Hoc thu khong ton tai');
    }
    return enrollment;
  }

  private async generateTrialCode(): Promise<string> {
    const prefix = 'HT';
    const last = await this.trialEnrollmentModel
      .findOne({ trialCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ trialCode: -1 })
      .lean();

    let nextNum = 1;
    if (last?.trialCode) {
      const match = last.trialCode.match(/^HT(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  }

  private async generateStudentCode(): Promise<string> {
    const prefix = 'HS';
    const last = await this.studentModel
      .findOne({ studentCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ studentCode: -1 })
      .lean();

    let nextNum = 1;
    if (last?.studentCode) {
      const match = last.studentCode.match(/^HS(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  private async findOrCreateStudent(
    dto: Pick<CreateTrialEnrollmentDto, 'studentName' | 'parentName' | 'parentPhone' | 'studentGrade' | 'productId' | 'studentPhone'>,
    saleId?: string,
    existingStudentId?: string | Types.ObjectId,
  ): Promise<StudentDocument> {
    let student = existingStudentId
      ? await this.studentModel.findById(existingStudentId)
      : await this.studentModel.findOne({
          fullName: dto.studentName.trim(),
          parentPhone: dto.parentPhone.trim(),
        });

    const saleObjectId = this.normalizeMongoId(saleId);
    const saleUser = saleObjectId
      ? await this.userModel.findById(saleObjectId).select('fullName').lean()
      : null;

    if (!student) {
      student = new this.studentModel({
        studentCode: await this.generateStudentCode(),
        fullName: dto.studentName.trim(),
        age: 10,
        parentName: dto.parentName.trim(),
        parentPhone: dto.parentPhone.trim(),
        faceImage: 'default-avatar.png',
        grade: dto.studentGrade?.trim() || undefined,
        productPackage: new Types.ObjectId(dto.productId),
        preferredTeachingMode: 'OFFLINE',
        studentType: 'OFFLINE',
        saleId: saleObjectId,
        saleName: (saleUser as any)?.fullName || undefined,
        approvalStatus: 'PENDING',
      });
      await student.save();
      return student;
    }

    student.fullName = dto.studentName.trim();
    student.parentName = dto.parentName.trim();
    student.parentPhone = dto.parentPhone.trim();
    student.grade = dto.studentGrade?.trim() || student.grade;
    student.productPackage = new Types.ObjectId(dto.productId);
    student.preferredTeachingMode = 'OFFLINE';
    student.studentType = 'OFFLINE';
    if (saleObjectId) {
      student.saleId = saleObjectId;
      if ((saleUser as any)?.fullName) {
        student.saleName = (saleUser as any).fullName;
      }
    }
    if (!student.faceImage) {
      student.faceImage = 'default-avatar.png';
    }
    await student.save();
    return student;
  }

  private async maybePromoteStudentToOfficial(studentId: Types.ObjectId, approverId?: string) {
    const payload: Record<string, unknown> = {
      approvalStatus: 'APPROVED',
      approvedAt: new Date(),
    };
    const approverObjectId = this.normalizeMongoId(approverId);
    if (approverObjectId) {
      payload.approvedBy = approverObjectId;
    }
    await this.studentModel.updateOne({ _id: studentId }, { $set: payload });
  }

  private async findLinkedInvoice(
    studentId: Types.ObjectId,
    invoiceId?: string,
  ): Promise<InvoiceDocument | null> {
    if (invoiceId) {
      const invoice = await this.invoiceModel.findById(invoiceId);
      if (!invoice || invoice.studentId?.toString() !== studentId.toString()) {
        throw new BadRequestException('Hoa don hoc thu khong hop le');
      }
      if (![InvoiceStatus.APPROVED, InvoiceStatus.PAID].includes(invoice.status as InvoiceStatus)) {
        throw new BadRequestException('Can co hoa don da duyet truoc khi chuyen hoc thu thanh hoc vien chinh thuc');
      }
      return invoice;
    }

    return this.invoiceModel
      .findOne({
        studentId,
        status: { $in: [InvoiceStatus.APPROVED, InvoiceStatus.PAID] },
      })
      .sort({ paymentDate: -1, createdAt: -1 });
  }

  private async ensureStudentCanJoinClass(classId: Types.ObjectId, studentId: Types.ObjectId): Promise<void> {
    const classroom = await this.classModel.findById(classId).select('students maxStudents').lean();
    if (!classroom) {
      throw new BadRequestException('Lop hoc khong ton tai');
    }

    const existingIds = ((classroom as any).students || []).map((item: any) => item.toString());
    if (!existingIds.includes(studentId.toString()) && (classroom as any).maxStudents && existingIds.length >= (classroom as any).maxStudents) {
      throw new BadRequestException('Lop hoc da dat gioi han so hoc vien');
    }
  }

  private buildFilter(query: QueryTrialEnrollmentDto, user: any): FilterQuery<TrialEnrollmentDocument> {
    const filter: FilterQuery<TrialEnrollmentDocument> = {
      ...this.getRoleScopedFilter(user),
    };

    if (query.status) filter.status = query.status;
    if (query.classId) filter.classId = query.classId as any;
    if (query.productId) filter.productId = query.productId as any;
    if (query.saleId) filter.saleId = query.saleId as any;
    if (query.studentId) filter.studentId = query.studentId as any;

    if (query.needsDecision === 'true') {
      filter.status = { $in: this.ACTIVE_STATUSES } as any;
    }

    const search = query.search?.trim() || query.keyword?.trim();
    if (search) {
      filter.$or = [
        { trialCode: { $regex: search, $options: 'i' } },
        { parentName: { $regex: search, $options: 'i' } },
        { parentPhone: { $regex: search, $options: 'i' } },
        { parentEmail: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } },
        { studentPhone: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(`${query.toDate}T23:59:59.999Z`);
    }

    return filter;
  }

  async create(dto: CreateTrialEnrollmentDto, user: any) {
    const actorId = this.getActorId(user);
    const saleId = user?.role === Role.SALE ? actorId : dto.saleId;
    await Promise.all([
      this.loadClassOrFail(dto.classId),
      this.loadProductOrFail(dto.productId),
    ]);

    const student = await this.findOrCreateStudent(dto, saleId);
    const trialEnrollment = new this.trialEnrollmentModel({
      ...dto,
      trialCode: await this.generateTrialCode(),
      saleId: this.normalizeMongoId(saleId),
      studentId: student._id,
      status: TrialEnrollmentStatus.PENDING_TRIAL,
      maxTrialSessions: dto.maxTrialSessions ?? 2,
      trialSessionsUsed: 0,
    });

    const saved = await trialEnrollment.save();
    return this.findOne(saved._id.toString(), user);
  }

  async findAll(query: QueryTrialEnrollmentDto, user: any) {
    const filter = this.buildFilter(query, user);
    return this.trialEnrollmentModel
      .find(filter)
      .populate('classId', 'name code classMode subject grade teacher')
      .populate('productId', 'name code teachingMode')
      .populate('saleId', 'fullName email phone')
      .populate('studentId', 'fullName studentCode parentName parentPhone approvalStatus')
      .populate('invoiceId', 'invoiceNumber status amount sessionsRemaining paymentDate')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getSummary(user: any) {
    const baseFilter = this.getRoleScopedFilter(user);
    const [total, pendingTrial, waitingDecision, converted, rejected] = await Promise.all([
      this.trialEnrollmentModel.countDocuments(baseFilter),
      this.trialEnrollmentModel.countDocuments({ ...baseFilter, status: TrialEnrollmentStatus.PENDING_TRIAL }),
      this.trialEnrollmentModel.countDocuments({ ...baseFilter, status: TrialEnrollmentStatus.WAITING_DECISION }),
      this.trialEnrollmentModel.countDocuments({ ...baseFilter, status: TrialEnrollmentStatus.CONVERTED }),
      this.trialEnrollmentModel.countDocuments({ ...baseFilter, status: TrialEnrollmentStatus.REJECTED }),
    ]);

    return {
      total,
      pendingTrial,
      waitingDecision,
      converted,
      rejected,
      active: pendingTrial + waitingDecision,
    };
  }

  async findOne(id: string, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);
    return this.populateById(id);
  }

  async update(id: string, dto: UpdateTrialEnrollmentDto, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);

    if (dto.status === TrialEnrollmentStatus.CONVERTED) {
      return this.convert(
        id,
        {
          studentId: dto.studentId,
          orderId: dto.orderId,
          invoiceId: dto.invoiceId,
          decisionAt: dto.decisionAt,
          notes: dto.notes,
          decisionNotes: dto.decisionNotes,
        },
        user,
      );
    }

    if (dto.status === TrialEnrollmentStatus.REJECTED) {
      return this.reject(
        id,
        {
          decisionAt: dto.decisionAt,
          notes: dto.notes,
          decisionNotes: dto.decisionNotes,
        },
        user,
      );
    }

    if (dto.classId) {
      await this.loadClassOrFail(dto.classId);
    }
    if (dto.productId) {
      await this.loadProductOrFail(dto.productId);
    }

    if (typeof dto.trialSessionsUsed === 'number' && dto.trialSessionsUsed > (dto.maxTrialSessions ?? enrollment.maxTrialSessions ?? 2)) {
      throw new BadRequestException('So buoi hoc thu vuot qua gioi han');
    }

    enrollment.set({
      parentName: dto.parentName ?? enrollment.parentName,
      parentPhone: dto.parentPhone ?? enrollment.parentPhone,
      parentEmail: dto.parentEmail ?? enrollment.parentEmail,
      studentName: dto.studentName ?? enrollment.studentName,
      studentPhone: dto.studentPhone ?? (enrollment as any).studentPhone,
      studentGrade: dto.studentGrade ?? enrollment.studentGrade,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : enrollment.classId,
      productId: dto.productId ? new Types.ObjectId(dto.productId) : enrollment.productId,
      saleId: dto.saleId ? new Types.ObjectId(dto.saleId) : enrollment.saleId,
      maxTrialSessions: dto.maxTrialSessions ?? enrollment.maxTrialSessions,
      trialSessionsUsed: dto.trialSessionsUsed ?? enrollment.trialSessionsUsed,
      notes: this.appendNotes(undefined, dto.notes) ?? enrollment.notes,
    } as any);

    if (dto.status === TrialEnrollmentStatus.WAITING_DECISION && enrollment.status !== TrialEnrollmentStatus.CONVERTED && enrollment.status !== TrialEnrollmentStatus.REJECTED) {
      enrollment.status = TrialEnrollmentStatus.WAITING_DECISION;
      enrollment.decisionAt = dto.decisionAt ? new Date(dto.decisionAt) : enrollment.decisionAt;
    }

    const saleId = enrollment.saleId?.toString();
    const linkedStudent = await this.findOrCreateStudent(
      {
        studentName: enrollment.studentName || '',
        studentPhone: (enrollment as any).studentPhone,
        parentName: enrollment.parentName,
        parentPhone: enrollment.parentPhone,
        studentGrade: enrollment.studentGrade,
        productId: enrollment.productId.toString(),
      },
      saleId,
      dto.studentId || enrollment.studentId,
    );
    enrollment.studentId = linkedStudent._id;

    await enrollment.save();
    return this.findOne(id, user);
  }

  async recordTrialSession(id: string, dto: RecordTrialSessionDto, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);

    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Hoc thu da ket thuc');
    }

    const count = dto.count ?? 1;
    const nextUsed = (enrollment.trialSessionsUsed || 0) + count;
    if (nextUsed > (enrollment.maxTrialSessions || 2)) {
      throw new BadRequestException('So buoi hoc thu vuot qua gioi han');
    }

    enrollment.trialSessionsUsed = nextUsed;
    if (nextUsed >= (enrollment.maxTrialSessions || 2)) {
      enrollment.status = TrialEnrollmentStatus.WAITING_DECISION;
    }
    enrollment.notes = this.appendNotes(enrollment.notes, dto.notes);

    await enrollment.save();
    return this.findOne(id, user);
  }

  async convert(id: string, dto: ConvertTrialEnrollmentDto, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Hoc thu da ket thuc');
    }

    const saleId = enrollment.saleId?.toString();
    const student = await this.findOrCreateStudent(
      {
        studentName: enrollment.studentName || '',
        studentPhone: (enrollment as any).studentPhone,
        parentName: enrollment.parentName,
        parentPhone: enrollment.parentPhone,
        studentGrade: enrollment.studentGrade,
        productId: enrollment.productId.toString(),
      },
      saleId,
      dto.studentId || enrollment.studentId,
    );
    const invoice = await this.findLinkedInvoice(student._id as Types.ObjectId, dto.invoiceId);
    if (!invoice) {
      throw new BadRequestException('Can co hoa don da duyet truoc khi chuyen hoc thu thanh hoc vien chinh thuc');
    }

    await Promise.all([
      this.loadClassOrFail(enrollment.classId),
      this.ensureStudentCanJoinClass(enrollment.classId as Types.ObjectId, student._id as Types.ObjectId),
    ]);

    await this.classModel.updateOne(
      { _id: enrollment.classId },
      { $addToSet: { students: student._id } },
    );
    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      { $set: { classId: enrollment.classId } },
    );
    await this.syncOrderProgressForInvoiceIds([invoice._id]);
    await this.maybePromoteStudentToOfficial(student._id as Types.ObjectId, this.getActorId(user));

    enrollment.status = TrialEnrollmentStatus.CONVERTED;
    enrollment.teacherPaidOnlyDecision = false;
    enrollment.studentId = student._id as Types.ObjectId;
    enrollment.invoiceId = invoice._id as Types.ObjectId;
    enrollment.orderId = dto.orderId ? new Types.ObjectId(dto.orderId) : enrollment.orderId;
    enrollment.decisionAt = dto.decisionAt ? new Date(dto.decisionAt) : new Date();
    enrollment.notes = this.appendNotes(enrollment.notes, dto.notes, dto.decisionNotes);
    await enrollment.save();

    await this.sessionsService.convertTrialSessions(
      student._id.toString(),
      enrollment.classId.toString(),
    );

    return this.findOne(id, user);
  }

  async reject(id: string, dto: RejectTrialEnrollmentDto, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Hoc thu da ket thuc');
    }

    enrollment.status = TrialEnrollmentStatus.REJECTED;
    enrollment.teacherPaidOnlyDecision = false;
    enrollment.decisionAt = dto.decisionAt ? new Date(dto.decisionAt) : new Date();
    enrollment.notes = this.appendNotes(enrollment.notes, dto.notes, dto.decisionNotes);
    await enrollment.save();

    if (enrollment.studentId) {
      await this.classModel.updateOne(
        { _id: enrollment.classId },
        { $pull: { students: enrollment.studentId } },
      );
      await this.sessionsService.markTrialRejectedNoPay(
        enrollment.studentId.toString(),
        enrollment.classId.toString(),
        this.getActorId(user),
      );
    }

    return this.findOne(id, user);
  }

  async teacherPaidOnly(id: string, dto: TeacherPaidOnlyTrialEnrollmentDto, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Hoc thu da ket thuc');
    }
    if (enrollment.status !== TrialEnrollmentStatus.WAITING_DECISION) {
      throw new BadRequestException('Chi co the chot tra luong GV khi hoc thu dang cho quyet dinh');
    }

    enrollment.status = TrialEnrollmentStatus.REJECTED;
    enrollment.teacherPaidOnlyDecision = true;
    enrollment.decisionAt = dto.decisionAt ? new Date(dto.decisionAt) : new Date();
    enrollment.notes = this.appendNotes(enrollment.notes, dto.notes, dto.decisionNotes);
    await enrollment.save();

    if (enrollment.studentId) {
      await this.sessionsService.markTrialTeacherPaidOnly(
        enrollment.studentId.toString(),
        enrollment.classId.toString(),
        this.getActorId(user),
      );
    }

    return this.findOne(id, user);
  }

  async remove(id: string, user: any) {
    const enrollment = await this.loadById(id);
    this.assertSaleAccess(enrollment, user);
    await enrollment.deleteOne();
    return { success: true };
  }
}
