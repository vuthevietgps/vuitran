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
import { QueryAvailableTrialTestSlotsDto } from './dto/query-available-trial-test-slots.dto';
import { QueryTrialTestSlotsDto } from './dto/query-trial-test-slots.dto';
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
  private readonly TEST_DAY_START_MINUTES = 8 * 60;
  private readonly TEST_DAY_END_MINUTES = 21 * 60;
  private readonly TEST_SLOT_MINUTES = 30;
  private readonly MAX_AVAILABLE_SLOT_DAYS = 14;

  private readonly TEST_REPORT_TEXT_FIELDS = [
    'zoomMeetingUrl',
    'zoomRecordingUrl',
    'learningGaps',
    'strengthsObserved',
    'improvementAreas',
    'recommendedRoadmap',
    'suggestedPackage',
    'suggestedSchedule',
    'salesAdvice',
    'technicalNotes',
  ] as const;

  private readonly TEST_REPORT_NUMBER_FIELDS = [
    'listeningScore',
    'speakingScore',
    'readingScore',
    'writingScore',
    'pronunciationScore',
    'grammarScore',
    'vocabularyScore',
    'reflexScore',
    'confidenceScore',
    'focusScore',
    'testDurationMinutes',
  ] as const;

  private buildTestReportUpdate(dto: Partial<CreateTrialEnrollmentDto | UpdateTrialEnrollmentDto>) {
    const update: Record<string, any> = {};

    for (const field of this.TEST_REPORT_TEXT_FIELDS) {
      if ((dto as any)[field] !== undefined) {
        const value = (dto as any)[field];
        update[field] = typeof value === 'string' ? value.trim() || undefined : value;
      }
    }

    for (const field of this.TEST_REPORT_NUMBER_FIELDS) {
      if ((dto as any)[field] !== undefined) {
        update[field] = (dto as any)[field];
      }
    }

    if ((dto as any).resultImageUrls !== undefined) {
      update.resultImageUrls = Array.isArray((dto as any).resultImageUrls)
        ? (dto as any).resultImageUrls.map((url: string) => String(url || '').trim()).filter(Boolean)
        : [];
    }

    if ((dto as any).closingPotential !== undefined) {
      update.closingPotential = (dto as any).closingPotential || 'UNKNOWN';
    }

    return update;
  }

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

  private async resolveExperienceTeacherId(
    experienceTeacherId?: string | Types.ObjectId | null,
  ): Promise<Types.ObjectId | undefined> {
    const normalizedId = this.normalizeMongoId(experienceTeacherId);
    if (!normalizedId) return undefined;

    const teacher = await this.userModel
      .findOne({
        _id: normalizedId,
        role: Role.EXPERIENCE_TEACHER,
      })
      .select('_id')
      .lean();

    if (!teacher) {
      throw new BadRequestException('Giao vien trai nghiem khong ton tai hoac sai vai tro');
    }

    return normalizedId;
  }

  private normalizeTestDate(value?: string | Date | null): Date | undefined {
    if (!value) return undefined;

    if (value instanceof Date) {
      return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }

    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException('Ngay test khong hop le');
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, monthIndex, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== monthIndex ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Ngay test khong hop le');
    }
    return date;
  }

  private formatTestDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private todayUtcDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private addUtcDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private dayDiffInclusive(fromDate: Date, toDate: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((toDate.getTime() - fromDate.getTime()) / msPerDay) + 1;
  }

  private timeToMinutes(value?: string): number {
    const match = String(value || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      throw new BadRequestException('Gio test khong hop le');
    }
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private minutesToTime(minutes: number): string {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private normalizeOptionalTime(value?: string | null): string | undefined {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private validateTestSlotRange(startTime: string, endTime: string): void {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException('Gio ket thuc test phai sau gio bat dau');
    }
    if (
      startMinutes < this.TEST_DAY_START_MINUTES ||
      endMinutes > this.TEST_DAY_END_MINUTES ||
      endMinutes - startMinutes !== this.TEST_SLOT_MINUTES
    ) {
      throw new BadRequestException('Moi buoi test phai nam trong 08:00-21:00 va dung 30 phut');
    }
    if (startMinutes % this.TEST_SLOT_MINUTES !== 0 || endMinutes % this.TEST_SLOT_MINUTES !== 0) {
      throw new BadRequestException('Gio test phai theo khung 30 phut');
    }
  }

  private validatePreferredTestWindow(startTime: string, endTime: string): { startMinutes: number; endMinutes: number } {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('Gio ket thuc phai sau gio bat dau');
    }
    if (startMinutes < this.TEST_DAY_START_MINUTES || endMinutes > this.TEST_DAY_END_MINUTES) {
      throw new BadRequestException('Khung tim kiem phai nam trong 08:00-21:00');
    }
    if (endMinutes - startMinutes < this.TEST_SLOT_MINUTES) {
      throw new BadRequestException('Khung tim kiem phai toi thieu 30 phut');
    }
    return { startMinutes, endMinutes };
  }

  private buildTestScheduleUpdate(
    dto: Partial<CreateTrialEnrollmentDto | UpdateTrialEnrollmentDto>,
    enrollment?: TrialEnrollmentDocument,
  ): {
    testDate?: Date;
    testStartTime?: string;
    testEndTime?: string;
    hasScheduleChange: boolean;
    hasCompleteSchedule: boolean;
  } {
    const hasScheduleChange =
      dto.testDate !== undefined ||
      dto.testStartTime !== undefined ||
      dto.testEndTime !== undefined;
    const testDate =
      dto.testDate !== undefined
        ? this.normalizeTestDate(dto.testDate)
        : this.normalizeTestDate(enrollment?.testDate);
    const testStartTime =
      dto.testStartTime !== undefined
        ? this.normalizeOptionalTime(dto.testStartTime)
        : this.normalizeOptionalTime(enrollment?.testStartTime);
    const testEndTime =
      dto.testEndTime !== undefined
        ? this.normalizeOptionalTime(dto.testEndTime)
        : this.normalizeOptionalTime(enrollment?.testEndTime);
    const hasAnyScheduleValue = !!(testDate || testStartTime || testEndTime);
    const hasCompleteSchedule = !!(testDate && testStartTime && testEndTime);

    if (hasAnyScheduleValue && !hasCompleteSchedule) {
      throw new BadRequestException('Vui long chon day du ngay test va gio test');
    }
    if (hasCompleteSchedule) {
      this.validateTestSlotRange(testStartTime!, testEndTime!);
    }

    return {
      testDate,
      testStartTime,
      testEndTime,
      hasScheduleChange,
      hasCompleteSchedule,
    };
  }

  private async assertTestSlotAvailable(params: {
    experienceTeacherId: Types.ObjectId;
    testDate: Date;
    testStartTime: string;
    testEndTime: string;
    excludeId?: string;
  }): Promise<void> {
    const filter: FilterQuery<TrialEnrollmentDocument> = {
      experienceTeacherId: params.experienceTeacherId,
      status: { $in: this.ACTIVE_STATUSES },
      testDate: params.testDate,
      testStartTime: { $lt: params.testEndTime },
      testEndTime: { $gt: params.testStartTime },
    };
    if (params.excludeId) {
      filter._id = { $ne: new Types.ObjectId(params.excludeId) } as any;
    }

    const existing = await this.trialEnrollmentModel
      .findOne(filter)
      .select('trialCode studentName testStartTime testEndTime')
      .lean();
    if (existing) {
      throw new BadRequestException(
        `Khung gio ${params.testStartTime}-${params.testEndTime} da co lich test ${existing.trialCode || ''}`.trim(),
      );
    }
  }

  private bookingKey(experienceTeacherId: string, date: string): string {
    return `${experienceTeacherId}:${date}`;
  }

  private slotOverlaps(
    booking: { testStartTime?: string; testEndTime?: string },
    startTime: string,
    endTime: string,
  ): boolean {
    return String(booking.testStartTime || '') < endTime && String(booking.testEndTime || '') > startTime;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getRoleScopedFilter(user: any): FilterQuery<TrialEnrollmentDocument> {
    const filter: FilterQuery<TrialEnrollmentDocument> = {};
    if (user?.role === Role.SALE) {
      const actorId = this.getActorId(user);
      if (actorId) filter.saleId = new Types.ObjectId(actorId);
    }
    if (user?.role === Role.EXPERIENCE_TEACHER) {
      const actorId = this.getActorId(user);
      if (actorId) filter.experienceTeacherId = new Types.ObjectId(actorId);
    }
    return filter;
  }

  private assertScopedAccess(trialEnrollment: any, user?: any): void {
    if (user?.role === Role.SALE) {
      const actorId = this.getActorId(user);
      const saleId = trialEnrollment?.saleId?.toString?.();
      if (!actorId || !saleId || actorId !== saleId) {
        throw new NotFoundException('Buoi test khong ton tai');
      }
      return;
    }

    if (user?.role === Role.EXPERIENCE_TEACHER) {
      const actorId = this.getActorId(user);
      const experienceTeacherId = trialEnrollment?.experienceTeacherId?.toString?.();
      if (!actorId || !experienceTeacherId || actorId !== experienceTeacherId) {
        throw new NotFoundException('Buoi test khong ton tai');
      }
      return;
    }
  }

  private async updateExperienceTeacherAssessment(
    id: string,
    enrollment: TrialEnrollmentDocument,
    dto: UpdateTrialEnrollmentDto,
    user: any,
  ) {
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Buoi test da ket thuc');
    }

    if (dto.status && dto.status !== TrialEnrollmentStatus.WAITING_DECISION) {
      throw new BadRequestException('Giao vien trai nghiem chi duoc chuyen buoi test sang Cho tu van');
    }

    if (typeof dto.trialSessionsUsed === 'number' && dto.trialSessionsUsed > (enrollment.maxTrialSessions || 2)) {
      throw new BadRequestException('So luot test vuot qua gioi han');
    }

    const reportUpdate = this.buildTestReportUpdate(dto);
    const assessmentChanged =
      dto.assessmentScore !== undefined ||
      dto.recommendedLevel !== undefined ||
      dto.assessmentNotes !== undefined ||
      Object.keys(reportUpdate).length > 0;

    if (typeof dto.trialSessionsUsed === 'number') {
      enrollment.trialSessionsUsed = dto.trialSessionsUsed;
    }
    if (dto.status === TrialEnrollmentStatus.WAITING_DECISION) {
      enrollment.status = TrialEnrollmentStatus.WAITING_DECISION;
      enrollment.decisionAt = dto.decisionAt ? new Date(dto.decisionAt) : enrollment.decisionAt;
    }
    if (dto.notes !== undefined) {
      enrollment.notes = this.appendNotes(undefined, dto.notes) ?? enrollment.notes;
    }
    if (dto.assessmentScore !== undefined) {
      enrollment.assessmentScore = dto.assessmentScore;
    }
    if (dto.recommendedLevel !== undefined) {
      enrollment.recommendedLevel = dto.recommendedLevel?.trim() || undefined;
    }
    if (dto.assessmentNotes !== undefined) {
      enrollment.assessmentNotes = dto.assessmentNotes?.trim() || undefined;
    }
    enrollment.set(reportUpdate);
    if (assessmentChanged) {
      enrollment.assessmentUpdatedAt = new Date();
    }

    if (
      (enrollment.trialSessionsUsed || 0) >= (enrollment.maxTrialSessions || 2) &&
      enrollment.status === TrialEnrollmentStatus.PENDING_TRIAL
    ) {
      enrollment.status = TrialEnrollmentStatus.WAITING_DECISION;
    }

    await enrollment.save();
    return this.findOne(id, user);
  }

  private assertExperienceTeacherCanMutateFinalDecision(user?: any): void {
    if (user?.role === Role.EXPERIENCE_TEACHER) {
      throw new BadRequestException('Giao vien trai nghiem khong co quyen chot hoc hoac tu choi sau buoi test');
    }
  }

  private assertExperienceTeacherCanCreate(user?: any): void {
    if (user?.role === Role.EXPERIENCE_TEACHER) {
      throw new BadRequestException('Giao vien trai nghiem khong co quyen tao buoi test');
    }
  }

  private assertExperienceTeacherCanRemove(user?: any): void {
    if (user?.role === Role.EXPERIENCE_TEACHER) {
      throw new BadRequestException('Giao vien trai nghiem khong co quyen xoa buoi test');
    }
  }

  private assertNotExperienceTeacherForTeacherPaidOnly(user?: any): void {
    if (user?.role === Role.EXPERIENCE_TEACHER) {
      throw new NotFoundException('Buoi test khong ton tai');
    }
  }

  private async loadClassOrFail(classId: string | Types.ObjectId) {
    const classroom = await this.classModel.findById(classId).select('name code classMode maxStudents students').lean();
    if (!classroom) {
      throw new BadRequestException('Lop hoc khong ton tai');
    }
    if ((classroom as any).classMode !== ClassMode.OFFLINE) {
      throw new BadRequestException('Buoi test chi ap dung cho lop OFFLINE');
    }
    return classroom as any;
  }

  private async loadProductOrFail(productId: string | Types.ObjectId) {
    const product = await this.productModel.findById(productId).select('name code teachingMode').lean();
    if (!product) {
      throw new BadRequestException('Goi san pham khong ton tai');
    }
    if ((product as any).teachingMode === 'ONLINE') {
      throw new BadRequestException('Goi san pham nay khong ho tro test offline');
    }
    return product as any;
  }

  private async populateById(id: string) {
    return this.trialEnrollmentModel
      .findById(id)
      .populate('classId', 'name code classMode subject grade teacher')
      .populate('productId', 'name code teachingMode')
      .populate('saleId', 'fullName email phone')
      .populate('experienceTeacherId', 'fullName email phone')
      .populate('studentId', 'fullName studentCode parentName parentPhone approvalStatus')
      .populate('invoiceId', 'invoiceNumber status amount sessionsRemaining paymentDate')
      .lean();
  }

  private async loadById(id: string) {
    const enrollment = await this.trialEnrollmentModel.findById(id);
    if (!enrollment) {
      throw new NotFoundException('Buoi test khong ton tai');
    }
    return enrollment;
  }

  private async generateTrialCode(): Promise<string> {
    const prefix = 'KT';
    const last = await this.trialEnrollmentModel
      .findOne({ trialCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ trialCode: -1 })
      .lean();

    let nextNum = 1;
    if (last?.trialCode) {
      const match = last.trialCode.match(/^KT(\d+)$/);
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
        throw new BadRequestException('Hoa don sau buoi test khong hop le');
      }
      if (![InvoiceStatus.APPROVED, InvoiceStatus.PAID].includes(invoice.status as InvoiceStatus)) {
        throw new BadRequestException('Can co hoa don da duyet truoc khi chuyen hoc sinh test thanh hoc vien chinh thuc');
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
    if (query.experienceTeacherId) filter.experienceTeacherId = query.experienceTeacherId as any;
    if (query.studentId) filter.studentId = query.studentId as any;

    if (query.needsDecision === 'true') {
      filter.status = { $in: this.ACTIVE_STATUSES } as any;
    }

    const search = query.search?.trim() || query.keyword?.trim();
    if (search) {
      const escapedSearch = this.escapeRegex(search);
      filter.$or = [
        { trialCode: { $regex: escapedSearch, $options: 'i' } },
        { parentName: { $regex: escapedSearch, $options: 'i' } },
        { parentPhone: { $regex: escapedSearch, $options: 'i' } },
        { parentEmail: { $regex: escapedSearch, $options: 'i' } },
        { studentName: { $regex: escapedSearch, $options: 'i' } },
        { studentPhone: { $regex: escapedSearch, $options: 'i' } },
        { notes: { $regex: escapedSearch, $options: 'i' } },
        { assessmentNotes: { $regex: escapedSearch, $options: 'i' } },
        { recommendedLevel: { $regex: escapedSearch, $options: 'i' } },
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
    this.assertExperienceTeacherCanCreate(user);
    const actorId = this.getActorId(user);
    const saleId = user?.role === Role.SALE ? actorId : dto.saleId;
    const experienceTeacherId = await this.resolveExperienceTeacherId(dto.experienceTeacherId);
    const schedule = this.buildTestScheduleUpdate(dto);
    if (schedule.hasCompleteSchedule && !experienceTeacherId) {
      throw new BadRequestException('Vui long chon giao vien trai nghiem truoc khi chon gio test');
    }
    if (schedule.hasCompleteSchedule && experienceTeacherId) {
      await this.assertTestSlotAvailable({
        experienceTeacherId,
        testDate: schedule.testDate!,
        testStartTime: schedule.testStartTime!,
        testEndTime: schedule.testEndTime!,
      });
    }
    await Promise.all([
      this.loadClassOrFail(dto.classId),
      this.loadProductOrFail(dto.productId),
    ]);

    const student = await this.findOrCreateStudent(dto, saleId);
    const reportUpdate = this.buildTestReportUpdate(dto);
    const trialEnrollment = new this.trialEnrollmentModel({
      ...dto,
      ...reportUpdate,
      trialCode: await this.generateTrialCode(),
      saleId: this.normalizeMongoId(saleId),
      experienceTeacherId,
      testDate: schedule.testDate,
      testStartTime: schedule.testStartTime,
      testEndTime: schedule.testEndTime,
      studentId: student._id,
      status: TrialEnrollmentStatus.PENDING_TRIAL,
      maxTrialSessions: dto.maxTrialSessions ?? 2,
      trialSessionsUsed: 0,
      assessmentScore: dto.assessmentScore,
      recommendedLevel: dto.recommendedLevel?.trim() || undefined,
      assessmentNotes: dto.assessmentNotes?.trim() || undefined,
      assessmentUpdatedAt: dto.assessmentScore !== undefined || dto.recommendedLevel || dto.assessmentNotes || Object.keys(reportUpdate).length ? new Date() : undefined,
    });

    const saved = await trialEnrollment.save();
    return this.findOne(saved._id.toString(), user);
  }

  async findAll(query: QueryTrialEnrollmentDto, user: any) {
    const filter = this.buildFilter(query, user);
    const shouldPaginate = query.page !== undefined || query.limit !== undefined;
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 50)));
    const findQuery = this.trialEnrollmentModel
      .find(filter)
      .populate('classId', 'name code classMode subject grade teacher')
      .populate('productId', 'name code teachingMode')
      .populate('saleId', 'fullName email phone')
      .populate('experienceTeacherId', 'fullName email phone')
      .populate('studentId', 'fullName studentCode parentName parentPhone approvalStatus')
      .populate('invoiceId', 'invoiceNumber status amount sessionsRemaining paymentDate')
      .sort({ createdAt: -1 });

    if (!shouldPaginate) {
      return findQuery.lean();
    }

    const [items, total] = await Promise.all([
      findQuery.skip((page - 1) * limit).limit(limit).lean(),
      this.trialEnrollmentModel.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
    };
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

  async getAvailableSlots(query: QueryAvailableTrialTestSlotsDto, user: any) {
    const fromDate = query.fromDate ? this.normalizeTestDate(query.fromDate) : this.todayUtcDate();
    if (!fromDate) {
      throw new BadRequestException('Ngay bat dau khong hop le');
    }
    const toDate = query.toDate ? this.normalizeTestDate(query.toDate) : this.addUtcDays(fromDate, 6);
    if (!toDate) {
      throw new BadRequestException('Ngay ket thuc khong hop le');
    }
    const dayCount = this.dayDiffInclusive(fromDate, toDate);
    if (dayCount < 1) {
      throw new BadRequestException('Ngay ket thuc phai sau ngay bat dau');
    }
    if (dayCount > this.MAX_AVAILABLE_SLOT_DAYS) {
      throw new BadRequestException(`Chi duoc tim slot trong toi da ${this.MAX_AVAILABLE_SLOT_DAYS} ngay`);
    }

    const { startMinutes, endMinutes } = this.validatePreferredTestWindow(
      query.preferredStart || this.minutesToTime(this.TEST_DAY_START_MINUTES),
      query.preferredEnd || this.minutesToTime(this.TEST_DAY_END_MINUTES),
    );
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    let teacherFilter: FilterQuery<UserDocument> = {
      role: Role.EXPERIENCE_TEACHER,
      status: 'ACTIVE' as any,
    };

    if (user?.role === Role.EXPERIENCE_TEACHER) {
      const actorId = this.normalizeMongoId(this.getActorId(user));
      if (!actorId) {
        throw new NotFoundException('Giao vien trai nghiem khong ton tai');
      }
      if (query.experienceTeacherId && query.experienceTeacherId !== actorId.toString()) {
        throw new NotFoundException('Giao vien trai nghiem khong ton tai');
      }
      teacherFilter = { ...teacherFilter, _id: actorId };
    } else if (query.experienceTeacherId) {
      const teacherId = await this.resolveExperienceTeacherId(query.experienceTeacherId);
      teacherFilter = { ...teacherFilter, _id: teacherId };
    }

    const teachers = await this.userModel
      .find(teacherFilter)
      .select('_id fullName email')
      .sort({ fullName: 1 })
      .lean();

    if (!teachers.length) {
      return {
        fromDate: this.formatTestDate(fromDate),
        toDate: this.formatTestDate(toDate),
        slots: [],
      };
    }

    const teacherIds = teachers.map((teacher) => teacher._id);
    const bookings = await this.trialEnrollmentModel
      .find({
        experienceTeacherId: { $in: teacherIds },
        status: { $in: this.ACTIVE_STATUSES },
        testDate: { $gte: fromDate, $lte: toDate },
        testStartTime: { $exists: true, $ne: '' },
        testEndTime: { $exists: true, $ne: '' },
      })
      .select('experienceTeacherId testDate testStartTime testEndTime')
      .lean();

    const bookingsByTeacherDate = new Map<string, Array<{ testStartTime?: string; testEndTime?: string }>>();
    for (const booking of bookings) {
      const teacherId = booking.experienceTeacherId?.toString?.();
      const date = booking.testDate instanceof Date ? this.formatTestDate(booking.testDate) : '';
      if (!teacherId || !date) continue;
      const key = this.bookingKey(teacherId, date);
      const bucket = bookingsByTeacherDate.get(key) || [];
      bucket.push({
        testStartTime: booking.testStartTime,
        testEndTime: booking.testEndTime,
      });
      bookingsByTeacherDate.set(key, bucket);
    }

    const firstSlotStart = Math.ceil(startMinutes / this.TEST_SLOT_MINUTES) * this.TEST_SLOT_MINUTES;
    const slots: Array<{
      date: string;
      startTime: string;
      endTime: string;
      experienceTeacherId: string;
      teacherName?: string;
      teacherEmail?: string;
    }> = [];

    for (let dayOffset = 0; dayOffset < dayCount && slots.length < limit; dayOffset += 1) {
      const date = this.addUtcDays(fromDate, dayOffset);
      const dateLabel = this.formatTestDate(date);
      for (
        let start = firstSlotStart;
        start + this.TEST_SLOT_MINUTES <= endMinutes && slots.length < limit;
        start += this.TEST_SLOT_MINUTES
      ) {
        const startTime = this.minutesToTime(start);
        const endTime = this.minutesToTime(start + this.TEST_SLOT_MINUTES);
        for (const teacher of teachers) {
          if (slots.length >= limit) break;
          const teacherId = teacher._id.toString();
          const busy = (bookingsByTeacherDate.get(this.bookingKey(teacherId, dateLabel)) || []).some((booking) =>
            this.slotOverlaps(booking, startTime, endTime),
          );
          if (busy) continue;
          slots.push({
            date: dateLabel,
            startTime,
            endTime,
            experienceTeacherId: teacherId,
            teacherName: teacher.fullName,
            teacherEmail: teacher.email,
          });
        }
      }
    }

    return {
      fromDate: this.formatTestDate(fromDate),
      toDate: this.formatTestDate(toDate),
      preferredStart: this.minutesToTime(startMinutes),
      preferredEnd: this.minutesToTime(endMinutes),
      limit,
      slots,
    };
  }

  async getTestSlots(query: QueryTrialTestSlotsDto, user: any) {
    const teacherId = await this.resolveExperienceTeacherId(query.experienceTeacherId);
    if (!teacherId) {
      throw new BadRequestException('Vui long chon giao vien trai nghiem');
    }

    if (user?.role === Role.EXPERIENCE_TEACHER) {
      const actorId = this.getActorId(user);
      if (!actorId || actorId !== teacherId.toString()) {
        throw new NotFoundException('Giao vien trai nghiem khong ton tai');
      }
    }

    const testDate = this.normalizeTestDate(query.date);
    if (!testDate) {
      throw new BadRequestException('Ngay test khong hop le');
    }

    const filter: FilterQuery<TrialEnrollmentDocument> = {
      experienceTeacherId: teacherId,
      status: { $in: this.ACTIVE_STATUSES },
      testDate,
      testStartTime: { $exists: true, $ne: '' },
      testEndTime: { $exists: true, $ne: '' },
    };
    if (query.excludeId) {
      filter._id = { $ne: new Types.ObjectId(query.excludeId) } as any;
    }

    const bookings = await this.trialEnrollmentModel
      .find(filter)
      .select('_id trialCode studentName status testStartTime testEndTime')
      .lean();

    const slots: Array<{
      startTime: string;
      endTime: string;
      available: boolean;
      booking?: {
        id: string;
        trialCode?: string;
        studentName?: string;
        status?: string;
      };
    }> = [];
    for (
      let start = this.TEST_DAY_START_MINUTES;
      start < this.TEST_DAY_END_MINUTES;
      start += this.TEST_SLOT_MINUTES
    ) {
      const end = start + this.TEST_SLOT_MINUTES;
      const startTime = this.minutesToTime(start);
      const endTime = this.minutesToTime(end);
      const booking = bookings.find(
        (item) => String(item.testStartTime || '') < endTime && String(item.testEndTime || '') > startTime,
      );

      slots.push({
        startTime,
        endTime,
        available: !booking,
        booking: booking
          ? {
              id: booking._id.toString(),
              trialCode: booking.trialCode,
              studentName: booking.studentName,
              status: booking.status,
            }
          : undefined,
      });
    }

    return {
      date: this.formatTestDate(testDate),
      experienceTeacherId: teacherId.toString(),
      slots,
    };
  }

  async findOne(id: string, user: any) {
    const enrollment = await this.loadById(id);
    this.assertScopedAccess(enrollment, user);
    return this.populateById(id);
  }

  async update(id: string, dto: UpdateTrialEnrollmentDto, user: any) {
    const enrollment = await this.loadById(id);
    this.assertScopedAccess(enrollment, user);

    if (user?.role === Role.EXPERIENCE_TEACHER) {
      return this.updateExperienceTeacherAssessment(id, enrollment, dto, user);
    }

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
    const experienceTeacherId = dto.experienceTeacherId !== undefined
      ? await this.resolveExperienceTeacherId(dto.experienceTeacherId)
      : undefined;
    const nextExperienceTeacherId =
      dto.experienceTeacherId !== undefined
        ? experienceTeacherId
        : (enrollment.experienceTeacherId as Types.ObjectId | undefined);
    const schedule = this.buildTestScheduleUpdate(dto, enrollment);
    if (schedule.hasCompleteSchedule && !nextExperienceTeacherId) {
      throw new BadRequestException('Vui long chon giao vien trai nghiem truoc khi dat gio test');
    }
    if (
      schedule.hasCompleteSchedule &&
      nextExperienceTeacherId &&
      (schedule.hasScheduleChange || dto.experienceTeacherId !== undefined)
    ) {
      await this.assertTestSlotAvailable({
        experienceTeacherId: nextExperienceTeacherId,
        testDate: schedule.testDate!,
        testStartTime: schedule.testStartTime!,
        testEndTime: schedule.testEndTime!,
        excludeId: id,
      });
    }

    if (typeof dto.trialSessionsUsed === 'number' && dto.trialSessionsUsed > (dto.maxTrialSessions ?? enrollment.maxTrialSessions ?? 2)) {
      throw new BadRequestException('So luot test vuot qua gioi han');
    }

    const reportUpdate = this.buildTestReportUpdate(dto);
    const assessmentChanged =
      dto.assessmentScore !== undefined ||
      dto.recommendedLevel !== undefined ||
      dto.assessmentNotes !== undefined ||
      Object.keys(reportUpdate).length > 0;

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
      experienceTeacherId: dto.experienceTeacherId !== undefined ? experienceTeacherId : enrollment.experienceTeacherId,
      testDate: schedule.testDate,
      testStartTime: schedule.testStartTime,
      testEndTime: schedule.testEndTime,
      maxTrialSessions: dto.maxTrialSessions ?? enrollment.maxTrialSessions,
      trialSessionsUsed: dto.trialSessionsUsed ?? enrollment.trialSessionsUsed,
      notes: this.appendNotes(undefined, dto.notes) ?? enrollment.notes,
      assessmentScore: dto.assessmentScore ?? enrollment.assessmentScore,
      recommendedLevel: dto.recommendedLevel !== undefined ? (dto.recommendedLevel?.trim() || undefined) : enrollment.recommendedLevel,
      assessmentNotes: dto.assessmentNotes !== undefined ? (dto.assessmentNotes?.trim() || undefined) : enrollment.assessmentNotes,
      ...reportUpdate,
      assessmentUpdatedAt: assessmentChanged ? new Date() : enrollment.assessmentUpdatedAt,
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
    this.assertScopedAccess(enrollment, user);

    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Buoi test da ket thuc');
    }

    const count = dto.count ?? 1;
    const nextUsed = (enrollment.trialSessionsUsed || 0) + count;
    if (nextUsed > (enrollment.maxTrialSessions || 2)) {
      throw new BadRequestException('So luot test vuot qua gioi han');
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
    this.assertScopedAccess(enrollment, user);
    this.assertExperienceTeacherCanMutateFinalDecision(user);
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Buoi test da ket thuc');
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
      throw new BadRequestException('Can co hoa don da duyet truoc khi chuyen hoc sinh test thanh hoc vien chinh thuc');
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
    this.assertScopedAccess(enrollment, user);
    this.assertExperienceTeacherCanMutateFinalDecision(user);
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Buoi test da ket thuc');
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
    this.assertScopedAccess(enrollment, user);
    this.assertNotExperienceTeacherForTeacherPaidOnly(user);
    if (enrollment.status === TrialEnrollmentStatus.CONVERTED || enrollment.status === TrialEnrollmentStatus.REJECTED) {
      throw new BadRequestException('Buoi test da ket thuc');
    }
    if (enrollment.status !== TrialEnrollmentStatus.WAITING_DECISION) {
      throw new BadRequestException('Rule hoc thu that khong dung cho buoi test; buoi test tinh luong theo co che giao vien trai nghiem');
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
    this.assertScopedAccess(enrollment, user);
    this.assertExperienceTeacherCanRemove(user);
    await enrollment.deleteOne();
    return { success: true };
  }
}
