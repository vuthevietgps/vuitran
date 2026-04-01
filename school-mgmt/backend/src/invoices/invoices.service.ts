import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus, InvoiceType } from './schemas/invoice.schema';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { ApproveInvoiceDto } from './dto/approve-invoice.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { ClassesService } from '../classes/classes.service';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly classesService: ClassesService,
    private readonly walletsService: WalletsService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private getActorId(actor?: JwtPayload): string {
    return String(actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? '');
  }

  private normalizeObjectId(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }
    if (typeof value === 'string') {
      return value;
    }
    return (value as any)?._id?.toString?.() || (value as any)?.toString?.() || undefined;
  }

  private async resolveValidatedInvoiceClassLink(params: {
    classId?: string;
    classType?: string;
    studentId: string;
  }): Promise<{ classroom: any | null; classId?: Types.ObjectId; classType?: string }> {
    const { classId, classType, studentId } = params;
    if (!classId) {
      return { classroom: null, classType };
    }

    const classroom = await this.classModel
      .findById(classId)
      .select('classMode students name code pricePerSession baseDuration sessionDuration')
      .lean();

    if (!classroom) {
      throw new BadRequestException('Lop hoc khong ton tai');
    }

    const normalizedClassType = String((classroom as any).classMode || '').trim().toUpperCase() || undefined;
    if (classType && normalizedClassType && classType !== normalizedClassType) {
      throw new BadRequestException('Loai lop hoc khong khop voi lop da chon');
    }

    const classStudentIds = Array.isArray((classroom as any).students)
      ? (classroom as any).students
          .map((item: any) => item?._id?.toString?.() || item?.toString?.())
          .filter((item: string | undefined): item is string => !!item)
      : [];

    if (!classStudentIds.includes(studentId)) {
      throw new BadRequestException(
        'Hoc sinh chua duoc gan vao lop da chon. Vui long chon dung lop cua hoc sinh.',
      );
    }

    return {
      classroom,
      classId: new Types.ObjectId(classId),
      classType: normalizedClassType,
    };
  }

  private getRemainingStudySessions(invoice: Partial<InvoiceDocument> | any): number {
    return Number(invoice?.sessionsRemaining || 0) + Number(invoice?.bonusSessionsRemaining || 0) + Number(invoice?.trialSessionsRemaining || 0);
  }

  private roundMoneyToThousand(value: unknown): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      return 0;
    }
    return Math.round(amount / 1000) * 1000;
  }

  private isOfflineTrialApprovalExempt(invoice: any): boolean {
    const classType = String(invoice?.classType || '').trim().toUpperCase();
    const trialSessions = Math.max(0, Number(invoice?.trialSessions || 0));
    const amount = this.roundMoneyToThousand(invoice?.amount);
    return classType === 'OFFLINE' && trialSessions > 0 && amount <= 0;
  }

  private isPurchasedSessionsSourceStatus(status?: string | null): boolean {
    return status === InvoiceStatus.APPROVED || status === InvoiceStatus.PAID;
  }

  private getPurchasedSessionsForInvoice(invoice?: Partial<InvoiceDocument> | null): number {
    if (!invoice || invoice.invoiceType !== InvoiceType.TUITION) {
      return 0;
    }

    return Math.max(0, Number(invoice.sessions || 0)) + Math.max(0, Number(invoice.bonusSessions || 0)) + Math.max(0, Number((invoice as any).trialSessions || 0));
  }

  private getInvoiceStudentId(invoice?: Partial<InvoiceDocument> | null): string | null {
    const studentId = invoice?.studentId as Types.ObjectId | string | undefined;
    if (!studentId) {
      return null;
    }
    return studentId.toString();
  }

  private async applyPurchasedSessionsDelta(
    studentId: string | null,
    delta: number,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<void> {
    if (!studentId || delta === 0) {
      return;
    }

    await this.studentModel.updateOne(
      { _id: new Types.ObjectId(studentId) },
      {
        $inc: { totalPurchasedSessions: delta },
      },
      mongoSession ? { session: mongoSession } : {},
    );
  }

  private async syncPurchasedSessionsSnapshot(
    before: Partial<InvoiceDocument> | null,
    after: Partial<InvoiceDocument> | null,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<void> {
    const beforeStudentId = this.getInvoiceStudentId(before);
    const afterStudentId = this.getInvoiceStudentId(after);
    const beforeTotal = before && this.isPurchasedSessionsSourceStatus(before.status)
      ? this.getPurchasedSessionsForInvoice(before)
      : 0;
    const afterTotal = after && this.isPurchasedSessionsSourceStatus(after.status)
      ? this.getPurchasedSessionsForInvoice(after)
      : 0;

    if (beforeStudentId && afterStudentId && beforeStudentId === afterStudentId) {
      await this.applyPurchasedSessionsDelta(afterStudentId, afterTotal - beforeTotal, mongoSession);
      return;
    }

    await this.applyPurchasedSessionsDelta(beforeStudentId, -beforeTotal, mongoSession);
    await this.applyPurchasedSessionsDelta(afterStudentId, afterTotal, mongoSession);
  }

  private assertSaleInvoiceAccess(invoice: any, actor?: JwtPayload): void {
    if (actor?.role !== Role.SALE) return;
    const actorId = this.getActorId(actor);
    const saleId =
      invoice?.saleId?._id?.toString?.() ??
      invoice?.saleId?.toString?.() ??
      null;
    const createdById =
      invoice?.createdBy?._id?.toString?.() ??
      invoice?.createdBy?.toString?.() ??
      null;
    if (saleId === actorId || createdById === actorId) return;
    throw new NotFoundException('Hoa don khong ton tai');
  }

  private async findSaleUser(saleId: string | Types.ObjectId): Promise<any> {
    const sale = await this.userModel
      .findOne({ _id: saleId, role: Role.SALE })
      .select('_id fullName email')
      .lean();
    if (!sale) {
      throw new BadRequestException('Sale phu trach khong hop le');
    }
    return sale;
  }

  private async resolveInvoiceSaleOwner(
    dto: Pick<CreateInvoiceDto, 'studentId' | 'saleId'>,
    actor: JwtPayload,
  ): Promise<{ student: any; saleId?: Types.ObjectId }> {
    const student = await this.studentModel
      .findById(dto.studentId)
      .select('saleId saleName')
      .lean();
    if (!student) {
      throw new NotFoundException('Hoc sinh khong ton tai');
    }

    const studentSaleId = student.saleId?.toString?.() || null;
    if (actor.role === Role.SALE) {
      if (!studentSaleId || studentSaleId !== this.getActorId(actor)) {
        throw new NotFoundException('Hoc sinh khong ton tai');
      }
      return {
        student,
        saleId: new Types.ObjectId(this.getActorId(actor)),
      };
    }

    if (studentSaleId) {
      if (dto.saleId && dto.saleId !== studentSaleId) {
        throw new BadRequestException(
          'Hoc sinh da co sale phu trach. Hay cap nhat owner hoc vien truoc khi lap hoa don',
        );
      }
      return {
        student,
        saleId: new Types.ObjectId(studentSaleId),
      };
    }

    if (!dto.saleId) {
      return { student, saleId: undefined };
    }

    const requestedSale = await this.findSaleUser(dto.saleId);
    return {
      student,
      saleId: requestedSale._id as Types.ObjectId,
    };
  }

  async create(dto: CreateInvoiceDto, actor: JwtPayload) {
    const actorId = this.getActorId(actor);
    const existingInvoice = await this.invoiceModel.findOne({ invoiceNumber: dto.invoiceNumber });
    if (existingInvoice) {
      throw new ConflictException('Sá»‘ hÃ³a Ä‘Æ¡n Ä‘Ã£ tá»“n táº¡i');
    }

    let paymentRound = dto.paymentRound;
    if (!paymentRound) {
      const previousCount = await this.invoiceModel.countDocuments({
        studentId: new Types.ObjectId(dto.studentId),
        status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
      });
      paymentRound = previousCount + 1;
    }

    // â”€â”€ Resolve class info for pricing â”€â”€
    const classLink = await this.resolveValidatedInvoiceClassLink({
      classId: dto.classId,
      classType: dto.classType,
      studentId: dto.studentId,
    });
    const classroom = classLink.classroom;

    // Auto-calculate amount if sessions + pricePerSession provided
    let amount = dto.amount;

    // If classId provided but no pricePerSession, get from class
    let pricePerSession = dto.pricePerSession;
    if (classroom && (pricePerSession === undefined || pricePerSession === null)) {
      pricePerSession = classroom.pricePerSession || 0;
    }

    // â”€â”€ Reference duration: from DTO â†’ class.baseDuration â†’ default 60 â”€â”€
    const referenceDuration =
      dto.referenceDuration ??
      (classroom?.baseDuration || classroom?.sessionDuration || 60);

    // â”€â”€ Auto-compute pricePerSession from amount + sessions if needed â”€â”€
    if ((pricePerSession === undefined || pricePerSession === null) && amount != null && dto.sessions) {
      pricePerSession = amount / dto.sessions;
    }

    if (pricePerSession !== undefined && pricePerSession !== null) {
      pricePerSession = this.roundMoneyToThousand(pricePerSession);
    }

    if (amount === undefined || amount === null) {
      if (dto.sessions && pricePerSession) {
        amount = dto.sessions * pricePerSession;
      }
    } else {
      amount = this.roundMoneyToThousand(amount);
    }

    // â”€â”€ Compute per-minute rate â”€â”€
    // VD: 3,800,000 / 20 buá»•i / 70 phÃºt = 2,714.29 Ä‘/phÃºt
    let perMinuteRate = 0;
    if (pricePerSession && referenceDuration) {
      perMinuteRate = pricePerSession / referenceDuration;
    }

    // â”€â”€ Resolve saleId: dÃ¹ ai táº¡o váº«n ghi nháº­n sale phá»¥ trÃ¡ch â”€â”€
    const { saleId } = await this.resolveInvoiceSaleOwner(dto, actor);

    // Má»i hÃ³a Ä‘Æ¡n Ä‘á»u pháº£i chá» duyá»‡t
    const status = InvoiceStatus.PENDING_APPROVAL;

    const bonusSessions = Math.max(0, Number(dto.bonusSessions || 0));
    const trialSessions = Math.max(0, Number(dto.trialSessions || 0));

    const entity = new this.invoiceModel({
      ...dto,
      paymentRound,
      amount,
      pricePerSession,
      referenceDuration,
      perMinuteRate,
      sessionsRemaining: dto.sessions, // Ban đầu = sessions mua
      bonusSessions,
      bonusSessionsRemaining: bonusSessions,
      trialSessions,
      trialSessionsRemaining: trialSessions,
      invoiceType: dto.invoiceType || InvoiceType.TUITION,
      status,
      saleId,
      studentId: new Types.ObjectId(dto.studentId),
      classType: classLink.classType ?? dto.classType,
      classId: classLink.classId,
      createdBy: actorId,
    });
    return entity.save();
  }

  async findAll(actor: JwtPayload) {
    let filter: any = {};
    if (actor.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      // Sale: xem hÃ³a Ä‘Æ¡n do mÃ¬nh táº¡o HOáº¶C cá»§a HS mÃ¬nh phá»¥ trÃ¡ch
      const ownStudents = await this.studentModel
        .find({ saleId: actorId }, '_id')
        .lean();
      const ownStudentIds = ownStudents.map((s) => s._id);
      filter = {
        $or: [
          { createdBy: actorId },
          { studentId: { $in: ownStudentIds } },
        ],
      };
    }
    // DIRECTOR, ACCOUNTING, OPS xem táº¥t cáº£
    return this.invoiceModel.find(filter)
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string, actor?: JwtPayload) {
    const invoice = await this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone studentCode parentUserId')
      .populate('classId', 'name code pricePerSession teacherPayPerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .lean();
    if (!invoice) throw new NotFoundException('HÃ³a Ä‘Æ¡n khÃ´ng tá»“n táº¡i');
    this.assertSaleInvoiceAccess(invoice, actor);

    // PARENT chá»‰ Ä‘Æ°á»£c xem hÃ³a Ä‘Æ¡n cá»§a con mÃ¬nh
    if (actor?.role === Role.PARENT) {
      const student = invoice.studentId as any;
      const parentUserId = student?.parentUserId?.toString();
      if (parentUserId !== this.getActorId(actor)) {
        throw new ForbiddenException('Báº¡n khÃ´ng cÃ³ quyá»n xem hÃ³a Ä‘Æ¡n nÃ y');
      }
    }

    return invoice;
  }

  async update(id: string, dto: UpdateInvoiceDto, actor?: JwtPayload) {
    const mongoSession = await this.connection.startSession();

    try {
      mongoSession.startTransaction();

      const invoice = await this.invoiceModel.findById(id).session(mongoSession);
      if (!invoice) throw new NotFoundException('HÃ³a Ä‘Æ¡n khÃ´ng tá»“n táº¡i');

      // SALE chá»‰ Ä‘Æ°á»£c sá»­a hÃ³a Ä‘Æ¡n PENDING_APPROVAL do mÃ¬nh táº¡o
      if (actor?.role === Role.SALE) {
        if (invoice.createdBy.toString() !== this.getActorId(actor)) {
          throw new ForbiddenException('Báº¡n khÃ´ng cÃ³ quyá»n sá»­a hÃ³a Ä‘Æ¡n nÃ y');
        }
        if (invoice.status !== InvoiceStatus.PENDING_APPROVAL) {
          throw new ForbiddenException('KhÃ´ng thá»ƒ sá»­a hÃ³a Ä‘Æ¡n Ä‘Ã£ Ä‘Æ°á»£c xá»­ lÃ½');
        }
        // SALE khÃ´ng Ä‘Æ°á»£c tá»± Ä‘á»•i status
        delete (dto as any).status;
        delete (dto as any).saleId;
        delete (dto as any).studentId;
        delete (dto as any).classId;
      }

      if (dto.invoiceNumber) {
        const existingInvoice = await this.invoiceModel.findOne({ 
          invoiceNumber: dto.invoiceNumber,
          _id: { $ne: id }
        }).session(mongoSession);
        if (existingInvoice) {
          throw new ConflictException('Sá»‘ hÃ³a Ä‘Æ¡n Ä‘Ã£ tá»“n táº¡i');
        }
      }

      const safeNum = (v: any) => v == null ? 0 : Number(v);
      const classLinkChanged =
        dto.classId !== undefined
        || dto.classType !== undefined
        || dto.studentId !== undefined;
      const isFinancialChanged = 
        (dto.amount !== undefined && safeNum(dto.amount) !== safeNum(invoice.amount)) ||
        (dto.sessions !== undefined && safeNum(dto.sessions) !== safeNum(invoice.sessions)) ||
        (dto.bonusSessions !== undefined && safeNum(dto.bonusSessions) !== safeNum(invoice.bonusSessions)) ||
        ((dto as any).trialSessions !== undefined
          && safeNum((dto as any).trialSessions) !== safeNum((invoice as any).trialSessions)) ||
        classLinkChanged;
      if (
        (invoice.status === InvoiceStatus.APPROVED || (invoice.status as any) === 'PAID') &&
        isFinancialChanged
      ) {
        throw new BadRequestException('Không thể sửa thông tin tài chính hay học sinh của hóa đơn đã duyệt. Vui lòng hủy hóa đơn và tạo lại.');
      }

      // Recalculate derived financial fields when relevant fields change
      const updateData: any = { ...dto };
      if (updateData.amount !== undefined) {
        updateData.amount = this.roundMoneyToThousand(updateData.amount);
      }
      if (updateData.pricePerSession !== undefined) {
        updateData.pricePerSession = this.roundMoneyToThousand(updateData.pricePerSession);
      }
      if (updateData.studentId !== undefined || updateData.saleId !== undefined) {
        const resolved = await this.resolveInvoiceSaleOwner(
          {
            studentId: updateData.studentId ?? invoice.studentId.toString(),
            saleId: updateData.saleId,
          },
          actor as JwtPayload,
        );
        updateData.studentId = new Types.ObjectId(updateData.studentId ?? invoice.studentId.toString());
        if (resolved.saleId) {
          updateData.saleId = resolved.saleId;
        } else {
          delete updateData.saleId;
        }
      }
      if (updateData.classId !== undefined || updateData.classType !== undefined || updateData.studentId !== undefined) {
        const resolvedClassLink = await this.resolveValidatedInvoiceClassLink({
          classId: updateData.classId ?? invoice.classId?.toString(),
          classType: updateData.classType ?? invoice.classType,
          studentId: (updateData.studentId ?? invoice.studentId.toString()).toString(),
        });
        if (resolvedClassLink.classId) {
          updateData.classId = resolvedClassLink.classId;
        }
        updateData.classType = resolvedClassLink.classType ?? updateData.classType ?? invoice.classType;
      }
      const sessions = dto.sessions ?? invoice.sessions;
      const bonusSessions = dto.bonusSessions ?? invoice.bonusSessions;
      const trialSessions = (dto as any).trialSessions ?? (invoice as any).trialSessions;
      const referenceDuration = dto.referenceDuration ?? invoice.referenceDuration;
      const pricePerSession = dto.pricePerSession ?? invoice.pricePerSession;

      if (sessions !== undefined && sessions >= 0) {
        const usedSessions = safeNum(invoice.sessions) - safeNum(invoice.sessionsRemaining);
        updateData.sessionsRemaining = Math.max(0, safeNum(sessions) - usedSessions);
      }
      if (bonusSessions !== undefined && bonusSessions >= 0) {
        const usedBonusSessions = safeNum(invoice.bonusSessions) - safeNum(invoice.bonusSessionsRemaining);
        updateData.bonusSessionsRemaining = Math.max(0, safeNum(bonusSessions) - usedBonusSessions);
      }
      if (trialSessions !== undefined && trialSessions >= 0) {
        const usedTrialSessions = safeNum((invoice as any).trialSessions) - safeNum((invoice as any).trialSessionsRemaining);
        updateData.trialSessionsRemaining = Math.max(0, safeNum(trialSessions) - usedTrialSessions);
      }
      if (sessions && referenceDuration && referenceDuration > 0 && pricePerSession != null) {
        updateData.perMinuteRate = pricePerSession / referenceDuration;
      }

      const updated = await this.invoiceModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, session: mongoSession },
      );
      if (!updated) throw new NotFoundException('HÃ³a Ä‘Æ¡n khÃ´ng tá»“n táº¡i');

      await this.syncPurchasedSessionsSnapshot(invoice, updated, mongoSession);

      await mongoSession.commitTransaction();
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }

    return this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone totalPurchasedSessions')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .lean();
  }

  /** Duyá»‡t hoáº·c tá»« chá»‘i hÃ³a Ä‘Æ¡n (DIRECTOR / ACCOUNTING) */
  async approveInvoice(id: string, dto: ApproveInvoiceDto, actor: JwtPayload) {
    const actorId = this.getActorId(actor);
    const approvalImage = dto.approvalImage?.trim();
    let approvedInvoiceAfterCommit: any = null;

    const existingInvoice = await this.invoiceModel
      .findById(id)
      .select(
        '_id invoiceNumber status receiptImage studentId invoiceType sessions bonusSessions trialSessions amount classType classId requestedClassId requestedTeacherId',
      )
      .lean();
    if (!existingInvoice) {
      throw new NotFoundException('HÃƒÂ³a Ã„â€˜Ã†Â¡n khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i');
    }

    const approvalProofRequired =
      dto.action === 'APPROVE' && !this.isOfflineTrialApprovalExempt(existingInvoice);

    if (approvalProofRequired && !approvalImage) {
      throw new BadRequestException('Phai tai hoa don doi ung truoc khi duyet hoa don');
    }

    if (approvalProofRequired && !existingInvoice.receiptImage) {
      throw new BadRequestException(
        'Khong the duyet hoa don khi chua co hoa don sale upload. Vui long bo sung hoa don goc truoc.',
      );
    }

    if (dto.action === 'APPROVE') {
      // Wrap approve + wallet top-up trong transaction Ä‘á»ƒ Ä‘áº£m báº£o atomic
      const mongoSession = await this.connection.startSession();
      mongoSession.startTransaction();

      try {
        const now = new Date();
        const approvedByOid = new Types.ObjectId(actorId);
        const approveSet: Record<string, unknown> = {
          status: InvoiceStatus.APPROVED,
          approvedBy: approvedByOid,
          approvedAt: now,
          paymentDate: { $ifNull: ['$paymentDate', now] },
          updatedAt: now,
        };
        if (approvalImage) {
          approveSet.approvalImage = approvalImage;
        }
        // BUG #1 fix: use aggregation pipeline update to set paymentDate = $ifNull($paymentDate, now)
        // This ensures invoices always have a paymentDate for financial control period filtering
        const invoice = await this.invoiceModel.findOneAndUpdate(
          { _id: id, status: InvoiceStatus.PENDING_APPROVAL },
          [{
            $set: approveSet,
          }],
          { new: true, session: mongoSession },
        );
        if (!invoice) {
          await mongoSession.abortTransaction();
          const exists = await this.invoiceModel.findById(id).lean();
          if (!exists) throw new NotFoundException('HÃ³a Ä‘Æ¡n khÃ´ng tá»“n táº¡i');
          throw new BadRequestException(
            `HÃ³a Ä‘Æ¡n Ä‘ang á»Ÿ tráº¡ng thÃ¡i "${exists.status}", chá»‰ cÃ³ thá»ƒ duyá»‡t khi á»Ÿ tráº¡ng thÃ¡i "PENDING_APPROVAL"`,
          );
        }

        // Wallet top-up for TUITION invoices â€” trong cÃ¹ng transaction
        if (
          invoice.invoiceType === InvoiceType.TUITION &&
          !invoice.walletTopUpDone &&
          invoice.amount > 0
        ) {
          await this.topUpWalletForInvoice(invoice, actor, mongoSession);
        }

        await this.syncPurchasedSessionsSnapshot(existingInvoice as any, invoice, mongoSession);
        approvedInvoiceAfterCommit = invoice.toObject();

        await mongoSession.commitTransaction();
      } catch (err) {
        await mongoSession.abortTransaction();
        throw err;
      } finally {
        mongoSession.endSession();
      }
    } else {
      // REJECT - atomic, khÃ´ng cáº§n transaction
      const invoice = await this.invoiceModel.findOneAndUpdate(
        { _id: id, status: InvoiceStatus.PENDING_APPROVAL },
        {
          $set: {
            status: InvoiceStatus.REJECTED,
            approvedBy: new Types.ObjectId(actorId),
            approvedAt: new Date(),
            rejectedReason: dto.rejectedReason || '',
          },
        },
        { new: true },
      );
      if (!invoice) {
        const exists = await this.invoiceModel.findById(id).lean();
        if (!exists) throw new NotFoundException('HÃ³a Ä‘Æ¡n khÃ´ng tá»“n táº¡i');
        throw new BadRequestException(
          `HÃ³a Ä‘Æ¡n Ä‘ang á»Ÿ tráº¡ng thÃ¡i "${exists.status}", chá»‰ cÃ³ thá»ƒ duyá»‡t khi á»Ÿ tráº¡ng thÃ¡i "PENDING_APPROVAL"`,
        );
      }
    }

    if (dto.action === 'APPROVE' && approvedInvoiceAfterCommit) {
      await this.autoPlaceApprovedInvoice(approvedInvoiceAfterCommit, actor);
    }

    return this.invoiceModel.findById(id)
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .populate('approvedBy', 'fullName email')
      .populate('saleId', 'fullName email')
      .lean();
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  INVOICE â†’ WALLET TOP-UP BRIDGE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /**
   * Khi Invoice TUITION Ä‘Æ°á»£c APPROVED:
   * 1. TÃ¬m parentUserId cá»§a student
   * 2. Náº¡p tiá»n vÃ o vÃ­ PH (auto-approved, khÃ´ng cáº§n duyá»‡t láº¡i)
   * 3. Ghi nháº­n ledgerEntryId vÃ o invoice Ä‘á»ƒ trace
   */
  private async topUpWalletForInvoice(
    invoice: InvoiceDocument,
    approver: JwtPayload,
    mongoSession?: import('mongoose').ClientSession,
  ): Promise<void> {
    // TÃ¬m parentUserId cá»§a student
    const student = await this.studentModel
      .findById(invoice.studentId)
      .select('parentUserId fullName')
      .session(mongoSession || null)
      .lean();

    if (!student?.parentUserId) {
      throw new BadRequestException(
        `Invoice ${invoice.invoiceNumber}: Student chÆ°a cÃ³ parentUserId, khÃ´ng thá»ƒ náº¡p vÃ­. ` +
        `Vui lÃ²ng cáº­p nháº­t parentUserId cho há»c sinh trÆ°á»›c khi duyá»‡t hÃ³a Ä‘Æ¡n.`,
      );
    }

    const parentUserId = student.parentUserId.toString();

    // Náº¡p tiá»n trá»±c tiáº¿p qua walletsService (auto-approved)
    const ledgerEntry = await this.walletsService.topUpFromInvoice({
      parentUserId,
      invoiceId: (invoice._id as Types.ObjectId).toString(),
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      studentId: invoice.studentId.toString(),
      classId: invoice.classId?.toString(),
      approvedBy: this.getActorId(approver),
    }, { session: mongoSession });

    // Ghi nháº­n Ä‘Ã£ náº¡p vÃ­ â€” trong cÃ¹ng transaction
    await this.invoiceModel.updateOne(
      { _id: invoice._id },
      {
        $set: {
          walletTopUpDone: true,
          ledgerEntryId: ledgerEntry._id as Types.ObjectId,
        },
      },
      mongoSession ? { session: mongoSession } : {},
    );

    this.logger.log(
      `Invoice ${invoice.invoiceNumber} APPROVED â†’ Wallet topped up ${invoice.amount.toLocaleString('vi-VN')}Ä‘ for parent ${parentUserId}`,
    );
  }

  private async autoPlaceApprovedInvoice(invoice: Partial<InvoiceDocument> | any, actor: JwtPayload): Promise<void> {
    const invoiceId = this.normalizeObjectId(invoice?._id);
    const studentId = this.normalizeObjectId(invoice?.studentId);
    const classId = this.normalizeObjectId(invoice?.classId);
    const requestedClassId = this.normalizeObjectId(invoice?.requestedClassId);
    const requestedClassCode = String(invoice?.requestedClassCode || '').trim().toUpperCase() || null;
    const requestedTeacherId = this.normalizeObjectId(invoice?.requestedTeacherId);

    if (!invoiceId || !studentId || classId || (!requestedClassId && !requestedClassCode && !requestedTeacherId)) {
      return;
    }

    try {
      await this.classesService.autoPlaceApprovedInvoice(
        {
          invoiceId,
          studentId,
          requestedClassId,
          requestedClassCode,
          requestedTeacherId,
        },
        actor,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `Auto placement failed for invoice ${invoice?.invoiceNumber || invoiceId}: ${message}`,
      );
    }
  }

  /** Láº¥y danh sÃ¡ch hÃ³a Ä‘Æ¡n chá» duyá»‡t */
  async findPendingApproval() {
    return this.invoiceModel.find({ status: InvoiceStatus.PENDING_APPROVAL })
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async remove(id: string) {
    const invoice = await this.invoiceModel.findById(id);
    if (!invoice) throw new NotFoundException('HÃ³a Ä‘Æ¡n khÃ´ng tá»“n táº¡i');

    // Prevent deleting invoices that have already been processed
    if (
      invoice.status === InvoiceStatus.APPROVED ||
      (invoice as any).status === 'PAID' ||
      invoice.walletTopUpDone
    ) {
      throw new BadRequestException(
        'KhÃ´ng thá»ƒ xÃ³a hÃ³a Ä‘Æ¡n Ä‘Ã£ duyá»‡t/Ä‘Ã£ thanh toÃ¡n. Vui lÃ²ng liÃªn há»‡ admin.',
      );
    }

    await this.invoiceModel.findByIdAndDelete(id);
    return invoice.toObject();
  }

  /** PH xem hÃ³a Ä‘Æ¡n cá»§a táº¥t cáº£ con */
  async getParentInvoices(parentUserId: string) {
    const parentObjId = new Types.ObjectId(parentUserId);
    const children = await this.studentModel
      .find({ parentUserId: parentObjId })
      .select('_id fullName studentCode')
      .lean();

    if (!children.length) return { children: [] };

    const childIds = children.map((c) => c._id);
    const invoices = await this.invoiceModel
      .find({ studentId: { $in: childIds } })
      .populate('classId', 'name code')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    const grouped = children.map((child) => ({
      student: child,
      invoices: invoices.filter(
        (inv) => inv.studentId.toString() === child._id.toString(),
      ),
    }));

    // Summary
    const totalPaid = invoices
      .filter((i) => i.status === 'APPROVED')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalPending = invoices
      .filter((i) => i.status === 'PENDING_APPROVAL')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalSessionsRemaining = invoices
      .filter((i) => i.status === 'APPROVED')
      .reduce((sum, i) => sum + this.getRemainingStudySessions(i), 0);

    return {
      children: grouped,
      summary: { totalPaid, totalPending, totalSessionsRemaining },
    };
  }

  async getInvoicesByStudent(studentId: string, actor?: JwtPayload) {
    if (actor?.role === Role.SALE) {
      const student = await this.studentModel
        .findById(studentId)
        .select('saleId')
        .lean();
      const ownerSaleId = student?.saleId?.toString?.();
      if (!ownerSaleId || ownerSaleId !== this.getActorId(actor)) {
        throw new NotFoundException('Hoc sinh khong ton tai');
      }
    }

    return this.invoiceModel.find({ studentId: new Types.ObjectId(studentId) })
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getAllPaymentInvoices() {
    const students = await this.studentModel.find()
      .populate('productPackage', 'name price')
      .lean();

    const invoices: any[] = [];

    for (const student of students) {
      if (student.payments && student.payments.length > 0) {
        for (const payment of student.payments) {
          invoices.push({
            _id: `${student._id}_${payment.frameIndex}`,
            studentId: student._id,
            studentCode: student.studentCode,
            studentName: student.fullName,
            frameIndex: payment.frameIndex,
            invoiceCode: payment.invoiceCode || '',
            sessionsRegistered: payment.sessionsRegistered || 0,
            pricePerSession: payment.pricePerSession || 0,
            amountCollected: payment.amountCollected || 0,
            sessionsCollected: payment.sessionsCollected || 0,
            invoiceImage: payment.invoiceImage || '',
            confirmStatus: payment.confirmStatus || 'PENDING',
            createdAt: (student as any).createdAt,
          });
        }
      }
    }

    return invoices.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async confirmPayment(studentId: string, frameIndex: number, action: 'CONFIRM' | 'REJECT') {
    const student = await this.studentModel.findById(studentId);
    if (!student) {
      throw new NotFoundException('Há»c sinh khÃ´ng tá»“n táº¡i');
    }

    const payment = student.payments?.find(p => p.frameIndex === frameIndex);
    if (!payment) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin thanh toÃ¡n');
    }

    payment.confirmStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
    await student.save();

    return { 
      success: true, 
      message: action === 'CONFIRM' ? 'ÄÃ£ duyá»‡t hÃ³a Ä‘Æ¡n' : 'ÄÃ£ tá»« chá»‘i hÃ³a Ä‘Æ¡n' 
    };
  }

  /**
   * BUG NGHIEM TRONG fix: Huy hoa don APPROVED va rollback wallet neu da nap tien.
   * Chi DIRECTOR/ACCOUNTING moi duoc huy hoa don da duyet.
   * Neu walletTopUpDone = true, se tru lai so tien tuong ung khoi vi phu huynh.
   */
  async cancelInvoice(id: string, actor: JwtPayload, reason?: string) {
    const actorId = this.getActorId(actor);

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    try {
      const now = new Date();
      const invoice = await this.invoiceModel.findOneAndUpdate(
        { _id: id, status: InvoiceStatus.APPROVED },
        {
          $set: {
            status: InvoiceStatus.CANCELLED,
            cancelledBy: new Types.ObjectId(actorId),
            cancelledAt: now,
            ...(reason ? { cancellationReason: reason } : {}),
          },
        },
        { new: true, session: mongoSession },
      );

      if (!invoice) {
        await mongoSession.abortTransaction();
        const exists = await this.invoiceModel.findById(id).lean();
        if (!exists) throw new NotFoundException('Hoa don khong ton tai');
        throw new BadRequestException(
          `Hoa don dang o trang thai "${exists.status}", chi co the huy hoa don o trang thai "APPROVED"`,
        );
      }

      // Rollback wallet top-up neu da nap tien vao vi
      if (invoice.walletTopUpDone && invoice.amount > 0) {
        await this.walletsService.reverseInvoiceTopUp({
          invoiceId: (invoice._id as Types.ObjectId).toString(),
          amount: invoice.amount,
          reason: reason || `Huy hoa don ${invoice.invoiceNumber}`,
          cancelledBy: actorId,
        }, { session: mongoSession });
      }

      const beforeSnapshot = { ...invoice.toObject(), status: InvoiceStatus.APPROVED } as Partial<InvoiceDocument>;
      await this.syncPurchasedSessionsSnapshot(beforeSnapshot, invoice, mongoSession);

      await mongoSession.commitTransaction();

      this.logger.log(
        `Invoice ${invoice.invoiceNumber} CANCELLED by ${actorId}` +
        (invoice.walletTopUpDone ? ` -- wallet rollback ${invoice.amount.toLocaleString('vi-VN')}d` : ''),
      );

      return this.invoiceModel.findById(id)
        .populate('studentId', 'fullName parentName parentPhone studentCode')
        .populate('classId', 'name code pricePerSession')
        .populate('createdBy', 'fullName email')
        .populate('approvedBy', 'fullName email')
        .lean();
    } catch (err) {
      await mongoSession.abortTransaction();
      throw err;
    } finally {
      mongoSession.endSession();
    }
  }

}
