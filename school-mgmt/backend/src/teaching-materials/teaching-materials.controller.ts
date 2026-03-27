import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { TeachingMaterialsService } from './teaching-materials.service';
import { UpdateTeachingMaterialDto } from './dto/teaching-material.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { MaterialFileCategory } from './schemas/teaching-material.schema';

const MATERIAL_ACCESS_ROLES = Object.values(Role) as Role[];

// Setup upload directory
const uploadPath = join(process.cwd(), 'uploads', 'materials');
if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });

// Multer config cho tài liệu giảng dạy
const materialsStorage = diskStorage({
  destination: uploadPath,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = extname(file.originalname);
    cb(null, `material-${uniqueSuffix}${ext}`);
  },
});

// Chấp nhận nhiều loại file hơn (doc, pdf, ppt, images, video, zip)
const materialFileFilter = (req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/json',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Video
    'video/mp4',
    'video/webm',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    // Text
    'text/plain',
    'text/csv',
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(`Loại file không được hỗ trợ: ${file.mimetype}`), false);
  }
};

@Controller('teaching-materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeachingMaterialsController {
  constructor(private readonly service: TeachingMaterialsService) {}

  /**
   * Upload tài liệu mới
   * POST /teaching-materials/upload
   */
  @Post('upload')
  @Roles(...MATERIAL_ACCESS_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: materialsStorage,
      fileFilter: materialFileFilter,
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) throw new BadRequestException('Không có file được tải lên');
    if (!body.title?.trim()) throw new BadRequestException('Tiêu đề tài liệu là bắt buộc');
    return this.service.create(body, file, req.user);
  }

  /**
   * Lấy danh sách tài liệu
   * GET /teaching-materials
   */
  @Get()
  @Roles(...MATERIAL_ACCESS_ROLES)
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
    @Query('classId') classId?: string,
    @Query('search') search?: string,
    @Query('fileCategory') fileCategory?: MaterialFileCategory,
    @Query('extractionStatus') extractionStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(req.user, {
      subject,
      grade,
      classId,
      search,
      fileCategory,
      extractionStatus: extractionStatus as any,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Thống kê tài liệu
   * GET /teaching-materials/stats
   */
  @Get('stats')
  @Roles(...MATERIAL_ACCESS_ROLES)
  getStats(@Req() req: AuthenticatedRequest) {
    return this.service.getStats(req.user);
  }

  /**
   * Xem chi tiết tài liệu
   * GET /teaching-materials/:id
   */
  @Get(':id')
  @Roles(...MATERIAL_ACCESS_ROLES)
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.user);
  }

  /**
   * Cập nhật metadata tài liệu
   * PATCH /teaching-materials/:id
   */
  @Patch(':id')
  @Roles(...MATERIAL_ACCESS_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeachingMaterialDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/reprocess')
  @Roles(...MATERIAL_ACCESS_ROLES)
  reprocess(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.reprocess(id, req.user);
  }

  /**
   * Xóa tài liệu
   * DELETE /teaching-materials/:id
   */
  @Delete(':id')
  @Roles(...MATERIAL_ACCESS_ROLES)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.user);
  }

  /**
   * Ghi nhận download
   * POST /teaching-materials/:id/download
   */
  @Post(':id/download')
  @Roles(...MATERIAL_ACCESS_ROLES)
  download(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.incrementDownload(id, req.user);
  }
}
