import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ReportTemplate,
  ReportTemplateDocument,
} from './schemas/report-template.schema';
import { CreateReportTemplateDto } from './dto/create-report-template.dto';

@Injectable()
export class ReportTemplatesService {
  constructor(
    @InjectModel(ReportTemplate.name)
    private templateModel: Model<ReportTemplateDocument>,
  ) {}

  async findByTeacher(teacherId: string): Promise<ReportTemplateDocument[]> {
    return this.templateModel
      .find({
        $or: [
          { teacherId: new Types.ObjectId(teacherId) },
          { isGlobal: true },
        ],
      })
      .sort({ isGlobal: -1, createdAt: -1 })
      .lean() as any;
  }

  async create(
    teacherId: string,
    dto: CreateReportTemplateDto,
  ): Promise<ReportTemplateDocument> {
    const template = new this.templateModel({
      teacherId: new Types.ObjectId(teacherId),
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      title: dto.title,
      templateContent: dto.templateContent,
      version: dto.version ?? 1,
      dynamicFields: dto.dynamicFields,
      isGlobal: false,
    });
    return template.save();
  }

  async remove(templateId: string, teacherId: string): Promise<void> {
    const template = await this.templateModel.findById(templateId);
    if (!template) {
      throw new NotFoundException('Template khong ton tai');
    }
    if (template.teacherId.toString() !== teacherId) {
      throw new ForbiddenException('Ban khong co quyen xoa template nay');
    }
    await template.deleteOne();
  }
}
