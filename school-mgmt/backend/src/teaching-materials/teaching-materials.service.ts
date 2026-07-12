import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  MaterialDifficulty,
  MaterialFileCategory,
  MaterialExtractionStatus,
  MaterialScope,
  MaterialStatus,
  MaterialType,
  MaterialUsagePhase,
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
  productId?: string;
  courseName?: string;
  unitCode?: string;
  lessonCode?: string;
  materialScope?: MaterialScope;
  materialType?: MaterialType;
  usagePhase?: MaterialUsagePhase;
  difficulty?: MaterialDifficulty;
  status?: MaterialStatus;
  assignableAsHomework?: boolean;
  page?: number;
  limit?: number;
};

type MaterialKnowledgeChunkFilters = MaterialListFilters & {
  materialId?: string;
};

type ScopedMaterialStats = {
  total: number;
  readyForAI: number;
  totalChunks: number;
  bySubject: Record<string, number>;
  byGrade: Record<string, number>;
  byScope: Record<string, number>;
  byMaterialType: Record<string, number>;
  byCourse: Record<string, number>;
  totalSizeBytes: number;
  totalSizeMB: number;
};

@Injectable()
export class TeachingMaterialsService {
  private readonly logger = new Logger(TeachingMaterialsService.name);
  private static readonly MATERIAL_ADMIN_ROLES = new Set<Role>([
    Role.DIRECTOR,
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

  private parseStringArray(input?: string[] | string): string[] {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input.map((item) => String(item).trim()).filter(Boolean);
    }

    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // Fallback below handles comma-separated form input.
    }

    return input.split(',').map((item) => item.trim()).filter(Boolean);
  }

  private trimToUndefined(value?: string | null): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private uppercaseToUndefined(value?: string | null): string | undefined {
    return this.trimToUndefined(value)?.toUpperCase();
  }

  private objectIdOrUndefined(value?: string | null): Types.ObjectId | undefined {
    const trimmed = this.trimToUndefined(value);
    if (!trimmed || !Types.ObjectId.isValid(trimmed)) return undefined;
    return new Types.ObjectId(trimmed);
  }

  private numberOrUndefined(value?: number | string | null): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }

  private booleanValue(value: unknown, fallback = false): boolean {
    if (value === undefined || value === null || value === '') return fallback;
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private enumOrDefault<T extends string>(
    value: unknown,
    allowedValues: readonly T[],
    fallback: T,
  ): T {
    return allowedValues.includes(value as T) ? value as T : fallback;
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

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    if (filters?.productId && Types.ObjectId.isValid(filters.productId)) {
      clauses.push({ productId: new Types.ObjectId(filters.productId) });
    }
    if (filters?.courseName) {
      clauses.push({ courseName: filters.courseName });
    }
    if (filters?.unitCode) {
      clauses.push({ unitCode: filters.unitCode.trim().toUpperCase() });
    }
    if (filters?.lessonCode) {
      clauses.push({ lessonCode: filters.lessonCode.trim().toUpperCase() });
    }
    if (filters?.materialScope) {
      clauses.push({ materialScope: filters.materialScope });
    }
    if (filters?.materialType) {
      clauses.push({ materialType: filters.materialType });
    }
    if (filters?.usagePhase) {
      clauses.push({ usagePhase: filters.usagePhase });
    }
    if (filters?.difficulty) {
      clauses.push({ difficulty: filters.difficulty });
    }
    if (filters?.status) {
      clauses.push({ status: filters.status });
    }
    if (filters?.assignableAsHomework !== undefined) {
      clauses.push({ assignableAsHomework: filters.assignableAsHomework });
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
        material.courseName ? `Khoa hoc: ${material.courseName}` : '',
        material.unitCode || material.unitTitle
          ? `Unit: ${[material.unitCode, material.unitTitle].filter(Boolean).join(' - ')}`
          : '',
        material.lessonCode || material.lessonTitle
          ? `Bai hoc: ${[material.lessonCode, material.lessonTitle].filter(Boolean).join(' - ')}`
          : '',
        material.materialScope ? `Nhom tai lieu: ${material.materialScope}` : '',
        material.materialType ? `Loai hoc lieu: ${material.materialType}` : '',
        Array.isArray(material.skills) && material.skills.length
          ? `Ky nang: ${material.skills.join(', ')}`
          : '',
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
      .populate('productId', 'name code category teachingMode gradeLevel')
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
      title: this.trimToUndefined(dto.title) || file.originalname,
      description: this.trimToUndefined(dto.description),
      subject: this.trimToUndefined(dto.subject),
      grade: this.trimToUndefined(dto.grade),
      classId: this.objectIdOrUndefined(dto.classId),
      productId: this.objectIdOrUndefined(dto.productId),
      courseName: this.trimToUndefined(dto.courseName),
      unitCode: this.uppercaseToUndefined(dto.unitCode),
      unitTitle: this.trimToUndefined(dto.unitTitle),
      lessonCode: this.uppercaseToUndefined(dto.lessonCode),
      lessonTitle: this.trimToUndefined(dto.lessonTitle),
      lessonOrder: this.numberOrUndefined(dto.lessonOrder as any),
      materialScope: this.enumOrDefault(
        dto.materialScope,
        Object.values(MaterialScope),
        MaterialScope.TEACHING,
      ),
      materialType: this.enumOrDefault(
        dto.materialType,
        Object.values(MaterialType),
        MaterialType.OTHER,
      ),
      usagePhase: this.enumOrDefault(
        dto.usagePhase,
        Object.values(MaterialUsagePhase),
        MaterialUsagePhase.IN_CLASS,
      ),
      difficulty: this.enumOrDefault(
        dto.difficulty,
        Object.values(MaterialDifficulty),
        MaterialDifficulty.STANDARD,
      ),
      status: this.enumOrDefault(
        dto.status,
        Object.values(MaterialStatus),
        MaterialStatus.APPROVED,
      ),
      estimatedMinutes: this.numberOrUndefined(dto.estimatedMinutes as any),
      skills: this.parseStringArray(dto.skills as any),
      assignableAsHomework: this.booleanValue(
        dto.assignableAsHomework,
        dto.materialScope === MaterialScope.HOMEWORK,
      ),
      autoGradeable: this.booleanValue(dto.autoGradeable),
      version: this.trimToUndefined(dto.version),
      fileUrl: `/uploads/materials/${file.filename}`,
      fileType: file.mimetype,
      fileCategory: this.resolveFileCategory(file.mimetype),
      fileSize: file.size,
      originalName: file.originalname,
      tags: this.parseTags(dto.tags),
      isShared: this.booleanValue(dto.isShared),
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
        .populate('productId', 'name code category teachingMode gradeLevel')
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

  async searchKnowledgeChunks(actor: JwtPayload, filters?: MaterialKnowledgeChunkFilters) {
    const limit = Math.min(20, Math.max(1, Number(filters?.limit) || 8));
    const materialFilters: MaterialListFilters = {
      subject: filters?.subject,
      grade: filters?.grade,
      classId: filters?.classId,
      fileCategory: filters?.fileCategory,
      extractionStatus: filters?.extractionStatus || MaterialExtractionStatus.READY,
      productId: filters?.productId,
      courseName: filters?.courseName,
      unitCode: filters?.unitCode,
      lessonCode: filters?.lessonCode,
      materialScope: filters?.materialScope,
      materialType: filters?.materialType,
      usagePhase: filters?.usagePhase,
      difficulty: filters?.difficulty,
      status: filters?.status || MaterialStatus.APPROVED,
      assignableAsHomework: filters?.assignableAsHomework,
      search: filters?.search,
      limit: 50,
      page: 1,
    };
    const materialQuery = this.buildScopedFilter(actor, materialFilters);
    const materialClauses: FilterQuery<TeachingMaterialDocument>[] = [materialQuery];
    if (filters?.materialId && Types.ObjectId.isValid(filters.materialId)) {
      materialClauses.push({ _id: new Types.ObjectId(filters.materialId) });
    }
    const scopedMaterialQuery = materialClauses.length === 1
      ? materialQuery
      : { $and: materialClauses };

    const materials = await this.materialModel
      .find(scopedMaterialQuery)
      .select('_id title subject grade courseName unitCode unitTitle lessonCode lessonTitle materialType materialScope aiSummary manualSummary chunkCount updatedAt')
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean<any[]>();

    if (!materials.length) {
      return {
        data: [],
        meta: {
          totalMaterials: 0,
          limit,
          warning: 'Khong co hoc lieu scoped phu hop de tim chunk.',
        },
      };
    }

    const materialIds = materials.map((material) => material._id);
    const materialById = new Map(materials.map((material) => [material._id.toString(), material]));
    const searchTerm = filters?.search?.trim();
    const baseChunkQuery: FilterQuery<TeachingMaterialChunkDocument> = {
      materialId: { $in: materialIds },
    };
    const chunkQuery = searchTerm
      ? {
          ...baseChunkQuery,
          content: { $regex: this.escapeRegex(searchTerm), $options: 'i' },
        }
      : baseChunkQuery;

    let chunks = await this.chunkModel
      .find(chunkQuery)
      .sort({ updatedAt: -1, chunkIndex: 1 })
      .limit(limit)
      .lean<any[]>();

    if (!chunks.length && searchTerm) {
      chunks = await this.chunkModel
        .find(baseChunkQuery)
        .sort({ updatedAt: -1, chunkIndex: 1 })
        .limit(limit)
        .lean<any[]>();
    }

    return {
      data: chunks.map((chunk) => {
        const material = materialById.get(chunk.materialId?.toString?.() || '');
        return {
          materialId: chunk.materialId?.toString?.(),
          title: material?.title,
          subject: material?.subject,
          grade: material?.grade,
          courseName: material?.courseName,
          unitCode: material?.unitCode,
          unitTitle: material?.unitTitle,
          lessonCode: material?.lessonCode,
          lessonTitle: material?.lessonTitle,
          materialType: material?.materialType,
          materialScope: material?.materialScope,
          chunkIndex: chunk.chunkIndex,
          preview: chunk.preview || this.clipText(chunk.content, 240),
          content: this.clipText(chunk.content, 900),
          charCount: chunk.charCount,
        };
      }),
      meta: {
        totalMaterials: materials.length,
        totalChunksReturned: chunks.length,
        limit,
        search: searchTerm,
      },
    };
  }

  async update(
    id: string,
    dto: UpdateTeachingMaterialDto,
    actor: JwtPayload,
  ): Promise<TeachingMaterial> {
    const material = await this.assertMaterialAccess(id, actor);
    const updatePayload: Record<string, unknown> = { ...dto };

    for (const key of [
      'title',
      'description',
      'subject',
      'grade',
      'courseName',
      'unitTitle',
      'lessonTitle',
      'version',
    ] as const) {
      if ((dto as any)[key] !== undefined) {
        updatePayload[key] = this.trimToUndefined((dto as any)[key]);
      }
    }

    if (dto.unitCode !== undefined) {
      updatePayload.unitCode = this.uppercaseToUndefined(dto.unitCode);
    }
    if (dto.lessonCode !== undefined) {
      updatePayload.lessonCode = this.uppercaseToUndefined(dto.lessonCode);
    }
    if (dto.classId !== undefined) {
      updatePayload.classId = this.objectIdOrUndefined(dto.classId);
    }
    if (dto.productId !== undefined) {
      updatePayload.productId = this.objectIdOrUndefined(dto.productId);
    }
    if (dto.lessonOrder !== undefined) {
      updatePayload.lessonOrder = this.numberOrUndefined(dto.lessonOrder as any);
    }
    if (dto.estimatedMinutes !== undefined) {
      updatePayload.estimatedMinutes = this.numberOrUndefined(dto.estimatedMinutes as any);
    }
    if (dto.materialScope !== undefined) {
      updatePayload.materialScope = this.enumOrDefault(
        dto.materialScope,
        Object.values(MaterialScope),
        (material as any).materialScope || MaterialScope.TEACHING,
      );
      if (dto.assignableAsHomework === undefined && updatePayload.materialScope === MaterialScope.HOMEWORK) {
        updatePayload.assignableAsHomework = true;
      }
    }
    if (dto.materialType !== undefined) {
      updatePayload.materialType = this.enumOrDefault(
        dto.materialType,
        Object.values(MaterialType),
        (material as any).materialType || MaterialType.OTHER,
      );
    }
    if (dto.usagePhase !== undefined) {
      updatePayload.usagePhase = this.enumOrDefault(
        dto.usagePhase,
        Object.values(MaterialUsagePhase),
        (material as any).usagePhase || MaterialUsagePhase.IN_CLASS,
      );
    }
    if (dto.difficulty !== undefined) {
      updatePayload.difficulty = this.enumOrDefault(
        dto.difficulty,
        Object.values(MaterialDifficulty),
        (material as any).difficulty || MaterialDifficulty.STANDARD,
      );
    }
    if (dto.status !== undefined) {
      updatePayload.status = this.enumOrDefault(
        dto.status,
        Object.values(MaterialStatus),
        (material as any).status || MaterialStatus.APPROVED,
      );
    }

    if (dto.tags !== undefined) {
      updatePayload.tags = this.parseTags(dto.tags as any);
    }
    if (dto.skills !== undefined) {
      updatePayload.skills = this.parseStringArray(dto.skills as any);
    }

    if (dto.isShared !== undefined) {
      updatePayload.isShared = this.booleanValue(dto.isShared);
    }
    if (dto.assignableAsHomework !== undefined) {
      updatePayload.assignableAsHomework = this.booleanValue(dto.assignableAsHomework);
    }
    if (dto.autoGradeable !== undefined) {
      updatePayload.autoGradeable = this.booleanValue(dto.autoGradeable);
    }

    if (dto.manualSummary !== undefined) {
      updatePayload.manualSummary = dto.manualSummary?.trim() || undefined;
    }

    const previousClassId = material.classId?.toString?.() || null;
    const updated = await this.materialModel.findByIdAndUpdate(id, updatePayload, { new: true }).lean<any>();
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
          byScope: [
            { $group: { _id: '$materialScope', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byMaterialType: [
            { $group: { _id: '$materialType', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          byCourse: [
            {
              $group: {
                _id: {
                  $ifNull: ['$courseName', '$productId'],
                },
                count: { $sum: 1 },
              },
            },
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
      byScope: (summary.byScope || []).reduce(
        (acc: Record<string, number>, entry: { _id?: string; count: number }) => {
          acc[entry._id || MaterialScope.TEACHING] = entry.count;
          return acc;
        },
        {},
      ),
      byMaterialType: (summary.byMaterialType || []).reduce(
        (acc: Record<string, number>, entry: { _id?: string; count: number }) => {
          acc[entry._id || MaterialType.OTHER] = entry.count;
          return acc;
        },
        {},
      ),
      byCourse: (summary.byCourse || []).reduce(
        (acc: Record<string, number>, entry: { _id?: unknown; count: number }) => {
          const key = entry._id ? String(entry._id) : 'Chua gan khoa';
          acc[key] = entry.count;
          return acc;
        },
        {},
      ),
      totalSizeBytes,
      totalSizeMB: Math.round((totalSizeBytes / 1024 / 1024) * 10) / 10,
    };
  }
}
