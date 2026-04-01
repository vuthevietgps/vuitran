import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupplierPayment, SupplierPaymentDocument, SupplierPaymentStatus } from './schemas/supplier-payment.schema';
import { CreateSupplierPaymentDto } from './dto/create-supplier-payment.dto';
import { UpdateSupplierPaymentDto } from './dto/update-supplier-payment.dto';
import { QuerySupplierPaymentDto } from './dto/query-supplier-payment.dto';
import { PaySupplierPaymentDto } from './dto/pay-supplier-payment.dto';

@Injectable()
export class SupplierPaymentsService {
  constructor(
    @InjectModel(SupplierPayment.name) private paymentModel: Model<SupplierPaymentDocument>,
  ) {}

  private async generatePaymentCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `SP-${rand}`;
      const exists = await this.paymentModel.exists({ paymentCode: code });
      if (!exists) return code;
    }
    return `SP-${Date.now()}`;
  }

  async create(dto: CreateSupplierPaymentDto, user: any) {
    const paymentCode = await this.generatePaymentCode();
    const data: any = {
      ...dto,
      paymentCode,
      createdById: new Types.ObjectId(user.sub),
      createdByName: user.fullName || user.email,
    };
    if (dto.supplierQuoteId) {
      data.supplierQuoteId = new Types.ObjectId(dto.supplierQuoteId);
    }
    return this.paymentModel.create(data);
  }

  async findAll(query: QuerySupplierPaymentDto) {
    const filter: any = {};
    if (query.keyword) {
      const re = new RegExp(query.keyword, 'i');
      filter.$or = [{ paymentCode: re }, { title: re }, { supplierName: re }];
    }
    if (query.status) filter.status = query.status;
    if (query.startDate || query.endDate) {
      filter.paymentDate = {};
      if (query.startDate) filter.paymentDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.paymentDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.paymentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.paymentModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.paymentModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Supplier payment not found');
    return doc;
  }

  async update(id: string, dto: UpdateSupplierPaymentDto) {
    const doc = await this.paymentModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier payment not found');
    if (doc.status === SupplierPaymentStatus.PAID) {
      throw new BadRequestException('Cannot edit a paid payment');
    }
    Object.assign(doc, dto);
    return doc.save();
  }

  async remove(id: string) {
    const doc = await this.paymentModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier payment not found');
    if (doc.status === SupplierPaymentStatus.PAID) {
      throw new BadRequestException('Cannot delete a paid payment');
    }
    await doc.deleteOne();
    return { deleted: true };
  }

  async approve(id: string, user: any) {
    const doc = await this.paymentModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier payment not found');
    if (doc.status !== SupplierPaymentStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Only PENDING_APPROVAL payments can be approved');
    }
    doc.status = SupplierPaymentStatus.APPROVED;
    doc.approvedById = new Types.ObjectId(user.sub);
    doc.approvedByName = user.fullName || user.email;
    doc.approvedAt = new Date();
    return doc.save();
  }

  async reject(id: string, reason: string, user: any) {
    const doc = await this.paymentModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier payment not found');
    doc.status = SupplierPaymentStatus.REJECTED;
    doc.rejectionReason = reason;
    doc.approvedById = new Types.ObjectId(user.sub);
    doc.approvedByName = user.fullName || user.email;
    doc.approvedAt = new Date();
    return doc.save();
  }

  async markPaid(id: string, dto: PaySupplierPaymentDto, user: any) {
    const doc = await this.paymentModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier payment not found');
    if (doc.status !== SupplierPaymentStatus.APPROVED) {
      throw new BadRequestException('Only APPROVED payments can be marked as paid');
    }
    doc.status = SupplierPaymentStatus.PAID;
    doc.paymentMethod = dto.paymentMethod;
    doc.paidById = new Types.ObjectId(user.sub);
    doc.paidByName = user.fullName || user.email;
    doc.paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (dto.notes) doc.notes = dto.notes;
    return doc.save();
  }

  async getStats() {
    const pipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ];
    const result = await this.paymentModel.aggregate(pipeline);
    const byStatus: Record<string, { count: number; total: number }> = {};
    let totalCount = 0;
    let totalAmount = 0;
    for (const r of result) {
      byStatus[r._id] = { count: r.count, total: r.total };
      totalCount += r.count;
      totalAmount += r.total;
    }
    return { totalCount, totalAmount, byStatus };
  }
}
