import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupplierQuote, SupplierQuoteDocument, QuoteStatus } from './schemas/supplier-quote.schema';
import { CreateSupplierQuoteDto } from './dto/create-supplier-quote.dto';
import { UpdateSupplierQuoteDto } from './dto/update-supplier-quote.dto';
import { QuerySupplierQuoteDto } from './dto/query-supplier-quote.dto';

@Injectable()
export class SupplierQuotesService {
  constructor(
    @InjectModel(SupplierQuote.name) private quoteModel: Model<SupplierQuoteDocument>,
  ) {}

  private async generateQuoteCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `SQ-${rand}`;
      const exists = await this.quoteModel.exists({ quoteCode: code });
      if (!exists) return code;
    }
    return `SQ-${Date.now()}`;
  }

  async create(dto: CreateSupplierQuoteDto, user: any) {
    const items = dto.items.map((item) => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice,
    }));
    const totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);
    const quoteCode = await this.generateQuoteCode();

    return this.quoteModel.create({
      ...dto,
      items,
      totalAmount,
      quoteCode,
      createdById: new Types.ObjectId(user.sub),
      createdByName: user.fullName || user.email,
    });
  }

  async findAll(query: QuerySupplierQuoteDto) {
    const filter: any = {};
    if (query.keyword) {
      const re = new RegExp(query.keyword, 'i');
      filter.$or = [
        { quoteCode: re },
        { title: re },
        { supplierName: re },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.startDate || query.endDate) {
      filter.quoteDate = {};
      if (query.startDate) filter.quoteDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.quoteDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.quoteModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.quoteModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.quoteModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Supplier quote not found');
    return doc;
  }

  async update(id: string, dto: UpdateSupplierQuoteDto) {
    const doc = await this.quoteModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier quote not found');
    if (doc.status === QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Cannot edit an accepted quote');
    }

    if (dto.items) {
      const items = dto.items.map((item) => ({
        ...item,
        totalPrice: item.quantity * item.unitPrice,
      }));
      (dto as any).items = items;
      (dto as any).totalAmount = items.reduce((sum, i) => sum + i.totalPrice, 0);
    }

    Object.assign(doc, dto);
    return doc.save();
  }

  async remove(id: string) {
    const doc = await this.quoteModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier quote not found');
    if (doc.status === QuoteStatus.ACCEPTED) {
      throw new BadRequestException('Cannot delete an accepted quote');
    }
    await doc.deleteOne();
    return { deleted: true };
  }

  async accept(id: string, user: any) {
    const doc = await this.quoteModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier quote not found');
    if (doc.status !== QuoteStatus.SENT && doc.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT or SENT quotes can be accepted');
    }
    doc.status = QuoteStatus.ACCEPTED;
    doc.approvedById = new Types.ObjectId(user.sub);
    doc.approvedByName = user.fullName || user.email;
    doc.approvedAt = new Date();
    return doc.save();
  }

  async reject(id: string, reason: string, user: any) {
    const doc = await this.quoteModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier quote not found');
    doc.status = QuoteStatus.REJECTED;
    doc.rejectionReason = reason;
    doc.approvedById = new Types.ObjectId(user.sub);
    doc.approvedByName = user.fullName || user.email;
    doc.approvedAt = new Date();
    return doc.save();
  }

  async markSent(id: string) {
    const doc = await this.quoteModel.findById(id);
    if (!doc) throw new NotFoundException('Supplier quote not found');
    if (doc.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT quotes can be sent');
    }
    doc.status = QuoteStatus.SENT;
    return doc.save();
  }
}
