import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  MaterialFileCategory,
  MaterialExtractionStatus,
  TeachingMaterial,
  TeachingMaterialDocument,
} from './schemas/teaching-material.schema';
import {
  TeachingMaterialChunk,
  TeachingMaterialChunkDocument,
} from './schemas/teaching-material-chunk.schema';
import {
  CreateTeachingMaterialDto,
  UpdateTeachingMaterialDto,
} from './dto/teaching-material.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { StudentSupportSnapshotService } from '../messages/student-support-snapshot.service';

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;
const MAX_KNOWLEDGE_TEXT_LENGTH = 16000;
const DEFAULT_PAGE_SIZE = 18;
const MAX_PAGE_SIZE = 60;

type MaterialListFilters = {
  subject?: string;
  grade?: string;
  classId?: string;
  search?: string;
  fileCategory?: MaterialFileCategory;
  extractionStatus?: MaterialExtractionStatus;
  page?: number;
  limit?: number;
};

type ScopedMaterialStats = {
  total: number;
  readyForAI: number;
  totalChunks: number;
  bySubject: Record<string, number>;
  byGrade: Record<string, number>;
  totalSizeBytes: number;
  totalSizeMB: number;
};

@Injectable()
export class TeachingMaterialsService {
  private readonly logger = new Logger(TeachingMaterialsService.name);
  private static readonly MATERIAL_ADMIN_ROLES = new Set<Role>([
    Role.DIRECTOR,
    Role.OPS,
  ]);

  constructor(
    @InjectModel(TeachingMaterial.name)
    private readonly materialModel: Model<TeachingMaterialDocument>,
    @InjectModel(TeachingMaterialChunk.name)
    private readonly chunkModel: Model<TeachingMaterialChunkDocument>,
    private readonly studentSupportSnapshotService: StudentSupportSnapshotService,
  ) {}

  private triggerStudentSupportSnapshotRefreshForClassIds(
    classIds: Array<string | null | undefined>,
    reason: string,
  ) {
    void this.refreshStudentSupportSnapshotForClassIds(classIds, reason);
  }

  private async refreshStudentSupportSnapshotForClassIds(
    classIds: Array<string | null | undefined>,
    reason: string,
  ) {
    const uniqueClassIds = [...new Set(classIds.filter((classId): classId is string => !!classId))];

    for (const classId of uniqueClassIds) {
      try {
        await this.studentSupportSnapshotService.rebuildForClass(classId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(
          `[StudentSupportSnapshot] Failed to refresh for class ${classId} (${reason}): ${message}`,
        );
      }
    }
  }

  private parseTags(input?: string[] | string): string[] {
    if (!input) return [];
    if (typeof input !== 'string') return input;

    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return input.split(',').map((tag) => tag.trim()).filter(Boolean);
    }
  }

  private normalizeMaterialText(value?: string | null) {
    if (!value) return '';
    return value
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private clipText(value?: string | null, limit = 300) {
    const normalized = this.normalizeMaterialText(value);
    if (!normalized) return '';
    if (normalized.length <= limit) return normalized;
    return `${normalized.slice(0, limit - 3)}...`;
  }

  private isTextExtractableMime(fileType?: string) {
    return ['text/plain', 'text/csv', 'application/json'].includes(fileType || '');
  }

  private resolveFilePath(fileUrl?: string) {
    const relativePath = (fileUrl || '').replace(/^[/\\]+/, '');
    return join(process.cwd(), relativePath);
  }

  private resolveFileCategory(fileType?: string): MaterialFileCategory {
    if (!fileType) return MaterialFileCategory.OTHER;
    if (fileType.includes('pdf')) return MaterialFileCategory.PDF;
    if (fileType.includes('word') || fileType.includes('msword')) return MaterialFileCategory.DOC;
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return MaterialFileCategory.PPT;
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return MaterialFileCategory.EXCEL;
    if (fileType.startsWith('image/')) return MaterialFileCategory.IMAGE;
    if (fileType.startsWith('video/')) return MaterialFileCategory.VIDEO;
    return MaterialFileCategory.OTHER;
  }

  private buildFileCategoryFilter(
    category?: MaterialFileCategory,
  ): FilterQuery<TeachingMaterialDocument> | null {
    if (!category) return null;

    const knownPatterns = [
      /pdf/i,
      /(word|msword|officedocument\.wordprocessingml)/i,
      /(powerpoint|presentation)/i,
      /(excel|spreadsheet)/i,
      /^image\//i,
      /^video\//i,
    ];

    const fallbackByCategory: Record<MaterialFileCategory, FilterQuery<TeachingMaterialDocument>> = {
      [MaterialFileCategory.PDF]: { fileType: { $regex: /pdf/i } },
      [MaterialFileCategory.DOC]: {
        fileType: { $regex: /(word|msword|officedocument\.wordprocessingml)/i },
      },
      [MaterialFileCategory.PPT]: {
        fileType: { $regex: /(powerpoint|presentation)/i },
      },
      [MaterialFileCategory.EXCEL]: {
        fileType: { $regex: /(excel|spreadsheet)/i },
      },
      [MaterialFileCategory.IMAGE]: {
        fileType: { $regex: /^image\//i },
      },
      [MaterialFileCategory.VIDEO]: {
        fileType: { $regex: /^video\//i },
      },
      [MaterialFileCategory.OTHER]: {
        $and: [
          { fileCategory: { $exists: false } },
          { $nor: knownPatterns.map((pattern) => ({ fileType: { $regex: pattern } })) },
        ],
      },
    };

    return {
      $or: [
        { fileCategory: category },
        fallbackByCategory[category],
      ],
    };
  }

  private getActorId(actor: JwtPayload): string | null {
    return actor?.sub ?? actor?._id ?? null;
  }

  private getActorObjectId(actor: JwtPayload): Types.ObjectId | null {
    const actorId = this.getActorId(actor);
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return null;
    }
    return new Types.ObjectId(actorId);
  }

  private isMaterialAdmin(actor: JwtPayload): boolean {
    return TeachingMaterialsService.MATERIAL_ADMIN_ROLES.has(actor.role);
  }

  private isMaterialOwner(material: { teacherId?: Types.ObjectId | string | null }, actor: JwtPayload): boolean {
    const actorId = this.getActorId(actor);
    const ownerId = material.teacherId?.toString?.() || null;
    return !!actorId && !!ownerId && ownerId === actorId;
  }

  private buildVisibilityFilter(actor: JwtPayload): FilterQuery<TeachingMaterialDocument> {
    if (this.isMaterialAdmin(actor)) {
      return {};
    }

    const actorObjectId = this.getActorObjectId(actor);
    if (!actorObjectId) {
      return { _id: { $in: [] } };
    }

    return {
      $or: [
        { teacherId: actorObjectId },
        { isShared: true },
      ],
    };
  }

  private buildScopedFilter(
    actor: JwtPayload,
    filters?: MaterialListFilters,
  ): FilterQuery<TeachingMaterialDocument> {
    const clauses: FilterQuery<TeachingMaterialDocument>[] = [];
    const visibilityFilter = this.buildVisibilityFilter(actor);

    if (Object.keys(visibilityFilter).length) {
      clauses.push(visibilityFilter);
    }
    if (filters?.subject) {
      clauses.push({ subject: filters.subject });
    }
    if (filters?.grade) {
      clauses.push({ grade: filters.grade });
    }
    if (filters?.classId) {
      clauses.push({ classId: new Types.ObjectId(filters.classId) });
    }
    const fileCategoryFilter = this.buildFileCategoryFilter(filters?.fileCategory);
    if (fileCategoryFilter) {
      clauses.push(fileCategoryFilter);
    }
    if (filters?.extractionStatus) {
      clauses.push({ extractionStatus: filters.extractionStatus });
    }

    const searchTerm = filters?.search?.trim();
    if (searchTerm) {
      clauses.push({ $text: { $search: searchTerm } });
    }

    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return { $and: clauses };
  }

  private buildChunkDocuments(material: any, knowledgeText: string) {
    const boundedText = this.normalizeMaterialText(knowledgeText).slice(0, MAX_KNOWLEDGE_TEXT_LENGTH);
    if (!boundedText) return [];

    const chunks: Array<{
      materialId: Types.ObjectId;
      classId?: Types.ObjectId;
      chunkIndex: number;
      content: string;
      preview: string;
      charCount: number;
    }> = [];

    const step = Math.max(CHUNK_SIZE - CHUNK_OVERLAP, 200);
    for (let start = 0, index = 0; start < boundedText.length; start += step, index++) {
      const content = boundedText.slice(start, start + CHUNK_SIZE).trim();
      if (!content) continue;

      chunks.push({
        materialId: material._id,
        classId: material.classId,
        chunkIndex: index,
        content,
        preview: this.clipText(content, 180),
        charCount: content.length,
      });

      if (start + CHUNK_SIZE >= boundedText.length) break;
    }

    return chunks;
  }

  private buildSummary(material: any, extractedText: string) {
    const manualSummary = this.clipText(material.manualSummary, 320);
    if (manualSummary) return manualSummary;

    const summarySource = this.normalizeMaterialText(
      [
        material.description,
        extractedText.split('\n').find((line: string) => line.trim()),
        extractedText.split('\n').find((line: string) => line.trim()?.length > 30),
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (summarySource) return this.clipText(summarySource, 320);
    return this.clipText(material.title, 200);
  }

  private async processMaterialKnowledge(materialId: string) {
    const material = await this.materialModel.findById(materialId).lean<any>();
    if (!material) {
      throw new NotFoundException('Tai lieu khong ton tai');
    }

    let extractedText = '';
    let extractionStatus = MaterialExtractionStatus.UNSUPPORTED;
    let processingError = '';

    try {
      if (this.isTextExtractableMime(material.fileType)) {
        const filePath = this.resolveFilePath(material.fileUrl);
        if (!existsSync(filePath)) {
          throw new Error('Source file not found');
        }

        extractedText = this.normalizeMaterialText(await readFile(filePath, 'utf8'));
      }
    } catch (err) {
      extractionStatus = MaterialExtractionStatus.FAILED;
      processingError = err instanceof Error ? err.message : 'Unknown extraction error';
      this.logger.warn(
        `[TeachingMaterials] Failed to extract text for ${materialId}: ${processingError}`,
      );
    }

    const knowledgeText = this.normalizeMaterialText(
      [
        material.title ? `Tieu de: ${material.title}` : '',
        material.description ? `Mo ta: ${material.description}` : '',
        material.manualSummary ? `Tom tat: ${material.manualSummary}` : '',
        extractedText ? `Noi dung: ${extractedText}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );

    if (extractionStatus !== MaterialExtractionStatus.FAILED) {
      extractionStatus = knowledgeText
        ? MaterialExtractionStatus.READY
        : MaterialExtractionStatus.UNSUPPORTED;
    }

    const aiSummary = this.buildSummary(material, extractedText);
    const extractedTextPreview = this.clipText(
      extractedText || material.manualSummary || material.description || material.title,
      500,
    );
    const chunkDocuments = this.buildChunkDocuments(material, knowledgeText);

    await this.chunkModel.deleteMany({ materialId: material._id });
    if (chunkDocuments.length) {
      await this.chunkModel.insertMany(chunkDocuments, { ordered: true });
    }

    await this.materialModel.findByIdAndUpdate(materialId, {
      $set: {
        fileCategory: this.resolveFileCategory(material.fileType),
        extractionStatus,
        aiSummary,
        extractedTextPreview,
        chunkCount: chunkDocuments.length,
        lastProcessedAt: new Date(),
        processingError,
      },
    });
  }

  private async findMaterialForView(id: string) {
    return this.materialModel
      .findById(id)
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName')
      .lean();
  }

  private async assertMaterialAccess(id: string, actor: JwtPayload) {
    const material = await this.materialModel.findById(id).lean<any>();
    if (!material) {
      throw new NotFoundException('Tai lieu khong ton tai');
    }

    if (!this.isMaterialAdmin(actor) && !this.isMaterialOwner(material, actor)) {
      throw new ForbiddenException('Ban khong co quyen thao tac tai lieu nay');
    }

    return material;
  }

  async create(
    dto: CreateTeachingMaterialDto,
    file: Express.Multer.File,
    actor: JwtPayload,
  ): Promise<TeachingMaterial> {
    const actorObjectId = this.getActorObjectId(actor);
    if (!actorObjectId) {
      throw new ForbiddenException('Khong xac dinh duoc tai khoan upload');
    }

    const material = new this.materialModel({
      teacherId: actorObjectId,
      title: dto.title,
      description: dto.description,
      subject: dto.subject,
      grade: dto.grade,
      classId: dto.classId ? new Types.ObjectId(dto.classId) : undefined,
      fileUrl: `/uploads/materials/${file.filename}`,
      fileType: file.mimetype,
      fileCategory: this.resolveFileCategory(file.mimetype),
      fileSize: file.size,
      originalName: file.originalname,
      tags: this.parseTags(dto.tags),
      isShared: dto.isShared === true || (dto.isShared as any) === 'true',
      manualSummary: dto.manualSummary?.trim() || undefined,
    });

    const savedMaterial = await material.save();
    await this.processMaterialKnowledge(savedMaterial._id.toString());
    this.triggerStudentSupportSnapshotRefreshForClassIds(
      [savedMaterial.classId?.toString()],
      'createTeachingMaterial',
    );

    const hydrated = await this.findMaterialForView(savedMaterial._id.toString());
    if (!hydrated) {
      throw new NotFoundException('Tai lieu khong ton tai');
    }
    return hydrated as TeachingMaterial;
  }

  async findAll(
    actor: JwtPayload,
    filters?: MaterialListFilters,
  ): Promise<{
    data: TeachingMaterial[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(filters?.limit) || DEFAULT_PAGE_SIZE));
    const query = this.buildScopedFilter(actor, filters);
    const hasSearch = !!filters?.search?.trim();
    const projection = hasSearch ? { score: { $meta: 'textScore' } } : undefined;

    const [total, data] = await Promise.all([
      this.materialModel.countDocuments(query),
      this.materialModel
        .find(query, projection)
        .populate('classId', 'name code')
        .sort(hasSearch ? { score: { $meta: 'textScore' }, updatedAt: -1 } : { updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: data as TeachingMaterial[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(id: string, actor: JwtPayload): Promise<TeachingMaterial> {
    const material = await this.findMaterialForView(id);
    if (!material) throw new NotFoundException('Tai lieu khong ton tai');

    const ownerId =
      (material as any).teacherId?._id?.toString?.()
      || (material as any).teacherId?.toString?.()
      || null;
    const isOwner = !!ownerId && ownerId === this.getActorId(actor);
    if (!this.isMaterialAdmin(actor) && !isOwner && !(material as any).isShared) {
      throw new NotFoundException('Tai lieu khong ton tai');
    }

    return material as TeachingMaterial;
  }

  async update(
    id: string,
    dto: UpdateTeachingMaterialDto,
    actor: JwtPayload,
  ): Promise<TeachingMaterial> {
    const material = await this.assertMaterialAccess(id, actor);

    if (dto.tags && typeof dto.tags === 'string') {
      (dto as any).tags = this.parseTags(dto.tags);
    }

    if (dto.isShared !== undefined) {
      (dto as any).isShared = dto.isShared === true || (dto.isShared as any) === 'true';
    }

    if (dto.manualSummary !== undefined) {
      (dto as any).manualSummary = dto.manualSummary?.trim() || undefined;
    }

    const previousClassId = material.classId?.toString?.() || null;
    const updated = await this.materialModel.findByIdAndUpdate(id, dto, { new: true }).lean<any>();
    if (!updated) throw new NotFoundException('Tai lieu khong ton tai');

    await this.processMaterialKnowledge(id);
    this.triggerStudentSupportSnapshotRefreshForClassIds(
      [previousClassId, updated.classId?.toString?.()],
      'updateTeachingMaterial',
    );

    const hydrated = await this.findMaterialForView(id);
    if (!hydrated) {
      throw new NotFoundException('Tai lieu khong ton tai');
    }
    return hydrated as TeachingMaterial;
  }

  async reprocess(id: string, actor: JwtPayload): Promise<TeachingMaterial> {
    const material = await this.assertMaterialAccess(id, actor);
    await this.processMaterialKnowledge(id);
    this.triggerStudentSupportSnapshotRefreshForClassIds(
      [material.classId?.toString?.()],
      'reprocessTeachingMaterial',
    );

    const hydrated = await this.findMaterialForView(id);
    if (!hydrated) {
      throw new NotFoundException('Tai lieu khong ton tai');
    }
    return hydrated as TeachingMaterial;
  }

  async remove(id: string, actor: JwtPayload): Promise<void> {
    const material = await this.assertMaterialAccess(id, actor);

    if (material.fileUrl) {
      const filePath = this.resolveFilePath(material.fileUrl);
      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => undefined);
      }
    }

    const classId = material.classId?.toString?.() || null;
    await this.chunkModel.deleteMany({ materialId: material._id });
    await this.materialModel.findByIdAndDelete(id);
    this.triggerStudentSupportSnapshotRefreshForClassIds(
      [classId],
      'removeTeachingMaterial',
    );
  }

  async incrementDownload(id: string, actor: JwtPayload): Promise<{ downloadCount: number }> {
    await this.findOne(id, actor);
    const updated = await this.materialModel.findByIdAndUpdate(
      id,
      { $inc: { downloadCount: 1 } },
      { new: true, projection: { downloadCount: 1 } },
    );
    return { downloadCount: updated?.downloadCount || 0 };
  }

  async getStats(actor: JwtPayload): Promise<ScopedMaterialStats> {
    const scopeQuery = this.buildScopedFilter(actor);
    const aggregation = await this.materialModel.aggregate([
      { $match: scopeQuery },
      {
        $facet: {
          total: [{ $count: 'count' }],
          readyForAI: [
            { $match: { extractionStatus: MaterialExtractionStatus.READY } },
            { $count: 'count' },
          ],
          totalChunks: [
            { $group: { _id: null, total: { $sum: '$chunkCount' } } },
          ],
          totalSize: [
            { $group: { _id: null, total: { $sum: '$fileSize' } } },
          ],
          bySubject: [
            { $group: { _id: '$subject', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byGrade: [
            { $group: { _id: '$grade', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);
    const summary = aggregation[0] || {};
    const totalSizeBytes = summary.totalSize?.[0]?.total || 0;

    return {
      total: summary.total?.[0]?.count || 0,
      readyForAI: summary.readyForAI?.[0]?.count || 0,
      totalChunks: summary.totalChunks?.[0]?.total || 0,
      bySubject: (summary.bySubject || []).reduce(
        (acc: Record<string, number>, entry: { _id?: string; count: number }) => {
          acc[entry._id || 'Khac'] = entry.count;
          return acc;
        },
        {},
      ),
      byGrade: (summary.byGrade || []).reduce(
        (acc: Record<string, number>, entry: { _id?: string; count: number }) => {
          acc[entry._id || 'Khac'] = entry.count;
          return acc;
        },
        {},
      ),
      totalSizeBytes,
      totalSizeMB: Math.round((totalSizeBytes / 1024 / 1024) * 10) / 10,
    };
  }
}
