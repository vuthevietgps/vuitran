import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument, InvoiceStatus } from './schemas/invoice.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { getActorId, getRemainingStudySessions } from './invoices.utils';

@Injectable()
export class InvoicesQueryService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  private assertSaleInvoiceAccess(invoice: any, actor?: JwtPayload): void {
    if (actor?.role !== Role.SALE) return;
    const actorId = getActorId(actor);
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

  private isPurchasedSessionsSourceStatus(status?: string | null): boolean {
    return status === InvoiceStatus.APPROVED || status === InvoiceStatus.PAID;
  }

  async findAll(actor: JwtPayload) {
    let filter: any = {};
    if (actor.role === Role.SALE) {
      const actorId = getActorId(actor);
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
    if (!invoice) throw new NotFoundException('Hóa đơn không tồn tại');
    this.assertSaleInvoiceAccess(invoice, actor);

    if (actor?.role === Role.PARENT) {
      const student = invoice.studentId as any;
      const parentUserId = student?.parentUserId?.toString();
      if (parentUserId !== getActorId(actor)) {
        throw new ForbiddenException('Bạn không có quyền xem hóa đơn này');
      }
    }

    return invoice;
  }

  /** Lấy danh sách hóa đơn chờ duyệt */
  async findPendingApproval() {
    return this.invoiceModel.find({ status: InvoiceStatus.PENDING_APPROVAL })
      .populate('studentId', 'fullName parentName parentPhone studentCode')
      .populate('classId', 'name code pricePerSession')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();
  }

  /** PH xem hóa đơn của tất cả con */
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

    const totalPaid = invoices
      .filter((i) => this.isPurchasedSessionsSourceStatus(i.status))
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalPending = invoices
      .filter((i) => i.status === 'PENDING_APPROVAL')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalSessionsRemaining = invoices
      .filter((i) => this.isPurchasedSessionsSourceStatus(i.status))
      .reduce((sum, i) => sum + getRemainingStudySessions(i), 0);

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
      if (!ownerSaleId || ownerSaleId !== getActorId(actor)) {
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
    if (!Number.isFinite(frameIndex) || frameIndex < 0) {
      throw new BadRequestException('frameIndex khong hop le');
    }
    const student = await this.studentModel.findById(studentId);
    if (!student) {
      throw new NotFoundException('Học sinh không tồn tại');
    }

    const payment = student.payments?.find(p => p.frameIndex === frameIndex);
    if (!payment) {
      throw new NotFoundException('Không tìm thấy thông tin thanh toán');
    }

    payment.confirmStatus = action === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
    await student.save();

    return { 
      success: true, 
      message: action === 'CONFIRM' ? 'Đã duyệt hóa đơn' : 'Đã từ chối hóa đơn' 
    };
  }
}
