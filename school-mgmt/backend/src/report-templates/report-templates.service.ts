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

  /**
   * Lấy danh sách template: template của GV + global templates
   */
  async findByTeacher(teacherId: string): Promise<ReportTemplateDocument[]> {
    return this.templateModel
      .find({
        $or: [
          { teacherId: new Types.ObjectId(teacherId) },
          { isGlobal: true },
        ],
      })
      .sort({ isGlobal: -1, createdAt: -1 }) // Global trước, mới nhất trước
      .lean() as any;
  }

  /**
   * Tạo template mới cho GV
   */
  async create(
    teacherId: string,
    dto: CreateReportTemplateDto,
  ): Promise<ReportTemplateDocument> {
    const template = new this.templateModel({
      teacherId: new Types.ObjectId(teacherId),
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      title: dto.title,
      templateContent: dto.templateContent,
      isGlobal: false, // GV chỉ tạo được template cá nhân
    });
    return template.save();
  }

  /**
   * Xóa template (chỉ được xóa template của chính mình)
   */
  async remove(templateId: string, teacherId: string): Promise<void> {
    const template = await this.templateModel.findById(templateId);
    if (!template) {
      throw new NotFoundException('Template không tồn tại');
    }
    if (template.teacherId.toString() !== teacherId) {
      throw new ForbiddenException('Bạn không có quyền xóa template này');
    }
    await template.deleteOne();
  }
}
