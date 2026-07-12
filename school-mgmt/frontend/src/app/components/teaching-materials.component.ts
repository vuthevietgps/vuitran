import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { ClassItem, ClassService } from '../services/class.service';
import { ProductItem, ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';
import {
  TeacherService,
  TeachingMaterial,
  TeachingMaterialMetadata,
  TeachingMaterialListQuery,
  TeachingMaterialStats,
} from '../services/teacher.service';
import { Quiz, QuizService } from '../services/quiz.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface MaterialForm {
  title: string;
  description: string;
  manualSummary: string;
  subject: string;
  grade: string;
  classId: string;
  productId: string;
  courseName: string;
  unitCode: string;
  unitTitle: string;
  lessonCode: string;
  lessonTitle: string;
  lessonOrder: string;
  materialScope: NonNullable<TeachingMaterial['materialScope']>;
  materialType: NonNullable<TeachingMaterial['materialType']>;
  usagePhase: NonNullable<TeachingMaterial['usagePhase']>;
  difficulty: NonNullable<TeachingMaterial['difficulty']>;
  status: NonNullable<TeachingMaterial['status']>;
  estimatedMinutes: string;
  skills: string;
  assignableAsHomework: boolean;
  autoGradeable: boolean;
  version: string;
  tags: string;
  isShared: boolean;
}

interface MaterialsMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

type ActiveFilterChip = {
  key:
    | 'search'
    | 'subject'
    | 'grade'
    | 'classId'
    | 'fileCategory'
    | 'extractionStatus'
    | 'productId'
    | 'unitCode'
    | 'lessonCode'
    | 'materialType';
  label: string;
  value: string;
};

type MaterialTab = 'curriculum' | 'teaching' | 'homework';

type CurriculumLessonGroup = {
  key: string;
  courseLabel: string;
  unitLabel: string;
  lessonLabel: string;
  order: number;
  teachingCount: number;
  homeworkCount: number;
  materials: TeachingMaterial[];
};

type CurriculumSlotKey = 'lessonPlan' | 'slide' | 'worksheet' | 'homework' | 'quiz' | 'answerKey' | 'video';

type CurriculumSlotStatus = {
  key: CurriculumSlotKey;
  label: string;
  ok: boolean;
};

const EMPTY_META: MaterialsMeta = {
  total: 0,
  page: 1,
  limit: 18,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

@Component({
  selector: 'app-teaching-materials',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './teaching-materials.component.html',
  styleUrls: ['./teaching-materials.component.css'],
})
export class TeachingMaterialsComponent implements OnInit, OnDestroy {
  readonly pageSize = 18;

  materials = signal<TeachingMaterial[]>([]);
  quizzes = signal<Quiz[]>([]);
  stats = signal<TeachingMaterialStats | null>(null);
  classes = signal<ClassItem[]>([]);
  products = signal<ProductItem[]>([]);
  meta = signal<MaterialsMeta>({ ...EMPTY_META, limit: this.pageSize });
  loading = signal(false);
  loadingMore = signal(false);
  uploading = signal(false);
  showModal = signal(false);
  showDeleteConfirm = signal(false);
  error = signal('');
  successMsg = signal('');

  searchQuery = '';
  filterSubject = '';
  filterGrade = '';
  filterClassId = '';
  filterProductId = '';
  filterUnitCode = '';
  filterLessonCode = '';
  filterType: TeachingMaterialListQuery['fileCategory'] | '' = '';
  filterExtractionStatus: TeachingMaterialListQuery['extractionStatus'] | '' = '';
  filterMaterialType: TeachingMaterialListQuery['materialType'] | '' = '';
  activeTab: MaterialTab = 'curriculum';

  selectedFile: File | null = null;
  editingMaterial: TeachingMaterial | null = null;
  deletingMaterial: TeachingMaterial | null = null;
  materialFormData: MaterialForm = this.blankForm();

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private requestSequence = 0;

  constructor(
    private readonly teacherService: TeacherService,
    private readonly classService: ClassService,
    private readonly productService: ProductService,
    private readonly quizService: QuizService,
    private readonly authService: AuthService,
  ) {}

  canManageMaterials(): boolean {
    return this.authService.userSignal()?.role === Role.DIRECTOR;
  }

  ngOnInit() {
    void this.bootstrap();
  }

  ngOnDestroy() {
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
  }

  async bootstrap() {
    await Promise.all([this.loadMaterials({ reset: true }), this.loadLookups()]);
  }

  async loadLookups() {
    const [stats, classes, products, quizzes] = await Promise.all([
      this.teacherService.getMaterialStats().catch(() => null),
      this.classService.list().catch(() => []),
      this.productService.list().catch(() => []),
      this.quizService.listQuizzes().catch(() => []),
    ]);
    this.stats.set(stats);
    this.classes.set(classes);
    this.products.set(products);
    this.quizzes.set(quizzes);
  }

  private buildQuery(page: number): TeachingMaterialListQuery {
    const tabScope =
      this.activeTab === 'teaching'
        ? 'TEACHING'
        : this.activeTab === 'homework'
          ? 'HOMEWORK'
          : undefined;

    return {
      subject: this.filterSubject || undefined,
      grade: this.filterGrade || undefined,
      classId: this.filterClassId || undefined,
      productId: this.filterProductId || undefined,
      unitCode: this.filterUnitCode.trim() || undefined,
      lessonCode: this.filterLessonCode.trim() || undefined,
      search: this.searchQuery.trim() || undefined,
      fileCategory: this.filterType || undefined,
      extractionStatus: this.filterExtractionStatus || undefined,
      materialScope: tabScope,
      materialType: this.filterMaterialType || undefined,
      page,
      limit: this.pageSize,
    };
  }

  async loadMaterials(options: { reset: boolean; page?: number }) {
    const requestId = ++this.requestSequence;
    const page = options.page ?? (options.reset ? 1 : this.meta().page + 1);

    if (options.reset) {
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.error.set('');

    try {
      const response = await this.teacherService.getMaterials(this.buildQuery(page));
      if (requestId !== this.requestSequence) {
        return;
      }

      const nextMeta: MaterialsMeta = {
        total: response.meta?.total || 0,
        page: response.meta?.page || page,
        limit: response.meta?.limit || this.pageSize,
        totalPages: response.meta?.totalPages || 1,
        hasNextPage: !!response.meta?.hasNextPage,
        hasPrevPage: !!response.meta?.hasPrevPage,
      };

      this.meta.set(nextMeta);
      this.materials.set(
        options.reset
          ? response.data || []
          : this.mergeMaterials(this.materials(), response.data || []),
      );
    } catch (e: any) {
      if (requestId !== this.requestSequence) {
        return;
      }
      this.error.set(e?.error?.message || 'Không thể tải danh sách tài liệu');
      if (options.reset) {
        this.materials.set([]);
        this.meta.set({ ...EMPTY_META, limit: this.pageSize });
      }
    } finally {
      if (requestId === this.requestSequence) {
        if (options.reset) {
          this.loading.set(false);
        } else {
          this.loadingMore.set(false);
        }
      }
    }
  }

  private mergeMaterials(existing: TeachingMaterial[], incoming: TeachingMaterial[]) {
    const map = new Map(existing.map((item) => [item._id, item]));
    for (const item of incoming) {
      map.set(item._id, item);
    }
    return Array.from(map.values());
  }

  private updateMaterialInList(id: string, updater: (material: TeachingMaterial) => TeachingMaterial) {
    this.materials.update((items) =>
      items.map((item) => (item._id === id ? updater(item) : item)),
    );
  }

  visibleMaterials() {
    return this.materials();
  }

  tabCount(scope: 'TEACHING' | 'HOMEWORK') {
    return this.stats()?.byScope?.[scope] || this.materials().filter((item) => item.materialScope === scope).length;
  }

  productLabelById(productId: string) {
    const product = this.products().find((item) => item._id === productId);
    return product ? `${product.name}${product.code ? ` (${product.code})` : ''}` : productId;
  }

  materialProductLabel(material: TeachingMaterial) {
    if (material.productId && typeof material.productId === 'object') {
      return `${material.productId.name}${material.productId.code ? ` (${material.productId.code})` : ''}`;
    }
    if (typeof material.productId === 'string') {
      return this.productLabelById(material.productId);
    }
    return material.courseName || '';
  }

  materialUnitLabel(material: TeachingMaterial) {
    return [material.unitCode, material.unitTitle].filter(Boolean).join(' - ');
  }

  materialLessonLabel(material: TeachingMaterial) {
    return [material.lessonCode, material.lessonTitle].filter(Boolean).join(' - ');
  }

  curriculumGroups(): CurriculumLessonGroup[] {
    const groups = new Map<string, CurriculumLessonGroup>();

    for (const material of this.materials()) {
      const productKey =
        typeof material.productId === 'object'
          ? material.productId._id
          : material.productId || material.courseName || 'general';
      const unitCode = material.unitCode || 'UNIT';
      const lessonCode = material.lessonCode || material.lessonTitle || material.title;
      const key = `${productKey}-${unitCode}-${lessonCode}`;
      const existing = groups.get(key);
      if (existing) {
        existing.materials.push(material);
        if (material.materialScope === 'HOMEWORK') existing.homeworkCount++;
        else existing.teachingCount++;
        continue;
      }

      groups.set(key, {
        key,
        courseLabel: this.materialProductLabel(material) || 'Chưa gắn khóa học',
        unitLabel: [material.unitCode, material.unitTitle].filter(Boolean).join(' - ') || 'Chưa gắn unit',
        lessonLabel: [material.lessonCode, material.lessonTitle].filter(Boolean).join(' - ') || material.title,
        order: material.lessonOrder || 9999,
        teachingCount: material.materialScope === 'HOMEWORK' ? 0 : 1,
        homeworkCount: material.materialScope === 'HOMEWORK' ? 1 : 0,
        materials: [material],
      });
    }

    return Array.from(groups.values()).sort(
      (left, right) =>
        left.courseLabel.localeCompare(right.courseLabel)
        || left.order - right.order
        || left.lessonLabel.localeCompare(right.lessonLabel),
    );
  }

  curriculumSlots(group: CurriculumLessonGroup): CurriculumSlotStatus[] {
    const materials = group.materials;
    const groupQuizzes = this.quizzesForGroup(group);
    const hasType = (...types: NonNullable<TeachingMaterial['materialType']>[]) =>
      materials.some((material) => types.includes(material.materialType || 'OTHER'));
    const hasVideo = materials.some((material) => material.materialType === 'VIDEO' || material.fileCategory === 'video');
    const hasHomework = materials.some((material) =>
      material.materialScope === 'HOMEWORK'
      || material.assignableAsHomework
      || material.materialType === 'HOMEWORK_SET',
    );
    const hasQuiz = groupQuizzes.length > 0 || hasType('QUIZ', 'TEST');

    return [
      { key: 'lessonPlan', label: 'Giao an', ok: hasType('LESSON_PLAN') },
      { key: 'slide', label: 'Slide', ok: hasType('SLIDE') },
      { key: 'worksheet', label: 'Worksheet', ok: hasType('WORKSHEET') },
      { key: 'homework', label: 'BTVN', ok: hasHomework },
      { key: 'quiz', label: 'Quiz', ok: hasQuiz },
      { key: 'answerKey', label: 'Dap an/rubric', ok: hasType('ANSWER_KEY', 'RUBRIC') },
      { key: 'video', label: 'Video', ok: hasVideo || groupQuizzes.some((quiz) => !!quiz.introVideoUrl) },
    ];
  }

  curriculumCompletion(group: CurriculumLessonGroup): number {
    const slots = this.curriculumSlots(group);
    return Math.round((slots.filter((slot) => slot.ok).length / slots.length) * 100);
  }

  quizzesForGroup(group: CurriculumLessonGroup): Quiz[] {
    const sample = group.materials[0];
    if (!sample) return [];
    const productId = typeof sample.productId === 'object' ? sample.productId._id : sample.productId;
    const unitCode = (sample.unitCode || '').toUpperCase();
    const lessonCode = (sample.lessonCode || '').toUpperCase();
    return this.quizzes().filter((quiz) => {
      const quizProductId = this.quizProductId(quiz);
      if (productId && quizProductId && productId !== quizProductId) return false;
      if (unitCode && (quiz.unitCode || '').toUpperCase() !== unitCode) return false;
      if (lessonCode && (quiz.lessonCode || '').toUpperCase() !== lessonCode) return false;
      return !!(unitCode || lessonCode || productId);
    });
  }

  private quizProductId(quiz: Quiz): string | undefined {
    const raw = (quiz as any).productId;
    return typeof raw === 'object' ? raw?._id : raw;
  }

  openUploadForLesson(group: CurriculumLessonGroup, slot?: CurriculumSlotKey) {
    if (!this.canManageMaterials()) return;
    const sample = group.materials[0];
    this.openUploadModal();
    if (!sample) return;
    this.materialFormData.productId =
      typeof sample.productId === 'object' ? sample.productId._id || '' : sample.productId || '';
    this.materialFormData.courseName = sample.courseName || '';
    this.materialFormData.unitCode = sample.unitCode || '';
    this.materialFormData.unitTitle = sample.unitTitle || '';
    this.materialFormData.lessonCode = sample.lessonCode || '';
    this.materialFormData.lessonTitle = sample.lessonTitle || '';
    this.materialFormData.lessonOrder = sample.lessonOrder ? String(sample.lessonOrder) : '';

    if (slot === 'homework') {
      this.materialFormData.materialScope = 'HOMEWORK';
      this.materialFormData.materialType = 'HOMEWORK_SET';
      this.materialFormData.usagePhase = 'AFTER_CLASS';
      this.materialFormData.assignableAsHomework = true;
    } else if (slot === 'lessonPlan') {
      this.materialFormData.materialType = 'LESSON_PLAN';
    } else if (slot === 'slide') {
      this.materialFormData.materialType = 'SLIDE';
    } else if (slot === 'worksheet') {
      this.materialFormData.materialType = 'WORKSHEET';
    } else if (slot === 'answerKey') {
      this.materialFormData.materialType = 'ANSWER_KEY';
    } else if (slot === 'video') {
      this.materialFormData.materialType = 'VIDEO';
    }
  }

  subjectOptions() {
    const statKeys = Object.keys(this.stats()?.bySubject || {});
    if (statKeys.length) {
      return statKeys.sort((a, b) => a.localeCompare(b));
    }

    return [...new Set(this.materials().map((item) => item.subject).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  gradeOptions() {
    const statKeys = Object.keys(this.stats()?.byGrade || {});
    if (statKeys.length) {
      return statKeys.sort((a, b) => a.localeCompare(b));
    }

    return [...new Set(this.materials().map((item) => item.grade).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  objectEntries(obj: Record<string, number> | null | undefined): Array<[string, number]> {
    return Object.entries(obj || {});
  }

  resultLabel() {
    const visibleCount = this.visibleMaterials().length;
    const total = this.meta().total;

    if (!total && !visibleCount) {
      return 'Chưa có tài liệu nào';
    }

    return `Đang hiển thị ${visibleCount}/${total} tài liệu`;
  }

  hasActiveFilters() {
    return !!(
      this.searchQuery.trim() ||
      this.filterSubject ||
      this.filterGrade ||
      this.filterClassId ||
      this.filterProductId ||
      this.filterUnitCode.trim() ||
      this.filterLessonCode.trim() ||
      this.filterType ||
      this.filterExtractionStatus ||
      this.filterMaterialType
    );
  }

  onSearchQueryChange(value: string) {
    this.searchQuery = value;
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => {
      void this.loadMaterials({ reset: true });
    }, 350);
  }

  onSubjectChange(value: string) {
    this.filterSubject = value;
    void this.loadMaterials({ reset: true });
  }

  onGradeChange(value: string) {
    this.filterGrade = value;
    void this.loadMaterials({ reset: true });
  }

  onClassChange(value: string) {
    this.filterClassId = value;
    void this.loadMaterials({ reset: true });
  }

  onProductChange(value: string) {
    this.filterProductId = value;
    void this.loadMaterials({ reset: true });
  }

  onUnitCodeChange(value: string) {
    this.filterUnitCode = value;
    void this.loadMaterials({ reset: true });
  }

  onLessonCodeChange(value: string) {
    this.filterLessonCode = value;
    void this.loadMaterials({ reset: true });
  }

  onExtractionStatusChange(value: TeachingMaterialListQuery['extractionStatus'] | '') {
    this.filterExtractionStatus = value;
    void this.loadMaterials({ reset: true });
  }

  onTypeChange(value: string) {
    this.filterType = (value || '') as TeachingMaterialListQuery['fileCategory'] | '';
    void this.loadMaterials({ reset: true });
  }

  onMaterialTypeChange(value: string) {
    this.filterMaterialType = (value || '') as TeachingMaterialListQuery['materialType'] | '';
    void this.loadMaterials({ reset: true });
  }

  setActiveTab(tab: MaterialTab) {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    void this.loadMaterials({ reset: true });
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterSubject = '';
    this.filterGrade = '';
    this.filterClassId = '';
    this.filterProductId = '';
    this.filterUnitCode = '';
    this.filterLessonCode = '';
    this.filterType = '';
    this.filterExtractionStatus = '';
    this.filterMaterialType = '';
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = null;
    }
    void this.loadMaterials({ reset: true });
  }

  loadMore() {
    if (this.loadingMore() || !this.meta().hasNextPage) {
      return;
    }
    void this.loadMaterials({ reset: false });
  }

  openUploadModal() {
    if (!this.canManageMaterials()) {
      this.error.set('Chi giam doc moi duoc tai len tai lieu hoc tap va bai tap.');
      return;
    }
    this.editingMaterial = null;
    this.selectedFile = null;
    this.materialFormData = this.blankForm();
    if (this.activeTab === 'homework') {
      this.materialFormData.materialScope = 'HOMEWORK';
      this.materialFormData.materialType = 'HOMEWORK_SET';
      this.materialFormData.usagePhase = 'AFTER_CLASS';
      this.materialFormData.assignableAsHomework = true;
    }
    this.error.set('');
    this.successMsg.set('');
    this.showModal.set(true);
  }

  openEditModal(material: TeachingMaterial) {
    if (!this.canManageMaterials()) {
      this.downloadFile(material);
      return;
    }
    this.editingMaterial = material;
    this.selectedFile = null;
    this.materialFormData = {
      title: material.title,
      description: material.description || '',
      manualSummary: material.manualSummary || '',
      subject: material.subject || '',
      grade: material.grade || '',
      classId:
        typeof material.classId === 'object'
          ? ((material.classId as { _id?: string })._id || '')
          : material.classId || '',
      productId:
        typeof material.productId === 'object'
          ? ((material.productId as { _id?: string })._id || '')
          : material.productId || '',
      courseName: material.courseName || '',
      unitCode: material.unitCode || '',
      unitTitle: material.unitTitle || '',
      lessonCode: material.lessonCode || '',
      lessonTitle: material.lessonTitle || '',
      lessonOrder: material.lessonOrder ? String(material.lessonOrder) : '',
      materialScope: material.materialScope || 'TEACHING',
      materialType: material.materialType || 'OTHER',
      usagePhase: material.usagePhase || 'IN_CLASS',
      difficulty: material.difficulty || 'STANDARD',
      status: material.status || 'APPROVED',
      estimatedMinutes: material.estimatedMinutes ? String(material.estimatedMinutes) : '',
      skills: (material.skills || []).join(', '),
      assignableAsHomework: !!material.assignableAsHomework,
      autoGradeable: !!material.autoGradeable,
      version: material.version || '',
      tags: (material.tags || []).join(', '),
      isShared: material.isShared,
    };
    this.error.set('');
    this.successMsg.set('');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingMaterial = null;
    this.selectedFile = null;
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    this.selectedFile = input.files[0];
    if (!this.materialFormData.title) {
      this.materialFormData.title = this.selectedFile.name.replace(/\.[^/.]+$/, '');
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.add('dragover');
  }

  onDragLeave(event: DragEvent) {
    (event.currentTarget as HTMLElement).classList.remove('dragover');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).classList.remove('dragover');
    if (!event.dataTransfer?.files?.length) {
      return;
    }

    this.selectedFile = event.dataTransfer.files[0];
    if (!this.materialFormData.title) {
      this.materialFormData.title = this.selectedFile.name.replace(/\.[^/.]+$/, '');
    }
  }

  removeFile() {
    this.selectedFile = null;
  }

  onMaterialScopeFormChange(scope: NonNullable<TeachingMaterial['materialScope']>) {
    this.materialFormData.materialScope = scope;
    if (scope === 'HOMEWORK') {
      this.materialFormData.assignableAsHomework = true;
      if (this.materialFormData.materialType === 'OTHER') {
        this.materialFormData.materialType = 'HOMEWORK_SET';
      }
      this.materialFormData.usagePhase = 'AFTER_CLASS';
    } else if (this.materialFormData.materialType === 'HOMEWORK_SET') {
      this.materialFormData.materialType = 'WORKSHEET';
      this.materialFormData.usagePhase = 'IN_CLASS';
    }
  }

  async submitMaterial() {
    if (!this.canManageMaterials()) {
      this.error.set('Chi giam doc moi duoc cap nhat kho hoc lieu.');
      return;
    }
    this.uploading.set(true);
    this.error.set('');
    this.successMsg.set('');

    try {
      const metadata: TeachingMaterialMetadata = {
        title: this.materialFormData.title,
        description: this.materialFormData.description || undefined,
        manualSummary: this.materialFormData.manualSummary || undefined,
        subject: this.materialFormData.subject || undefined,
        grade: this.materialFormData.grade || undefined,
        classId: this.materialFormData.classId || undefined,
        productId: this.materialFormData.productId || undefined,
        courseName: this.materialFormData.courseName || undefined,
        unitCode: this.materialFormData.unitCode || undefined,
        unitTitle: this.materialFormData.unitTitle || undefined,
        lessonCode: this.materialFormData.lessonCode || undefined,
        lessonTitle: this.materialFormData.lessonTitle || undefined,
        lessonOrder: this.materialFormData.lessonOrder ? Number(this.materialFormData.lessonOrder) : undefined,
        materialScope: this.materialFormData.materialScope,
        materialType: this.materialFormData.materialType,
        usagePhase: this.materialFormData.usagePhase,
        difficulty: this.materialFormData.difficulty,
        status: this.materialFormData.status,
        estimatedMinutes: this.materialFormData.estimatedMinutes ? Number(this.materialFormData.estimatedMinutes) : undefined,
        skills: this.materialFormData.skills
          ? this.materialFormData.skills.split(',').map((skill) => skill.trim()).filter(Boolean)
          : undefined,
        assignableAsHomework: this.materialFormData.assignableAsHomework,
        autoGradeable: this.materialFormData.autoGradeable,
        version: this.materialFormData.version || undefined,
        tags: this.materialFormData.tags
          ? this.materialFormData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : undefined,
        isShared: this.materialFormData.isShared,
      };

      if (this.editingMaterial) {
        await this.teacherService.updateMaterial(this.editingMaterial._id, metadata);
        this.successMsg.set('Đã cập nhật tài liệu');
      } else {
        if (!this.selectedFile) {
          this.error.set('Hãy chọn file trước khi tải lên');
          return;
        }
        await this.teacherService.uploadMaterial(this.selectedFile, metadata);
        this.successMsg.set('Đã tải lên tài liệu mới');
      }

      this.closeModal();
      await Promise.all([this.loadMaterials({ reset: true }), this.loadLookups()]);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể lưu tài liệu');
    } finally {
      this.uploading.set(false);
    }
  }

  confirmDelete(material: TeachingMaterial) {
    if (!this.canManageMaterials()) {
      this.error.set('Chi giam doc moi duoc xoa tai lieu.');
      return;
    }
    this.deletingMaterial = material;
    this.showDeleteConfirm.set(true);
  }

  async executeDelete() {
    if (!this.canManageMaterials()) {
      this.error.set('Chi giam doc moi duoc xoa tai lieu.');
      return;
    }
    if (!this.deletingMaterial) {
      return;
    }

    this.uploading.set(true);
    this.error.set('');

    try {
      await this.teacherService.deleteMaterial(this.deletingMaterial._id);
      this.deletingMaterial = null;
      this.showDeleteConfirm.set(false);
      this.successMsg.set('Đã xóa tài liệu');
      await Promise.all([this.loadMaterials({ reset: true }), this.loadLookups()]);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể xóa tài liệu');
    } finally {
      this.uploading.set(false);
    }
  }

  downloadFile(material: TeachingMaterial) {
    const anchor = document.createElement('a');
    anchor.href = `${environment.apiBase}${material.fileUrl}`;
    anchor.download = material.originalName;
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    void this.teacherService.recordMaterialDownload(material._id).then((result) => {
      this.updateMaterialInList(material._id, (item) => ({
        ...item,
        downloadCount: result.downloadCount,
      }));
    }).catch(() => undefined);
  }

  async reprocessMaterial(material: TeachingMaterial) {
    if (!this.canManageMaterials()) {
      this.error.set('Chi giam doc moi duoc xu ly lai tri thuc AI cho tai lieu.');
      return;
    }
    this.uploading.set(true);
    this.error.set('');
    this.successMsg.set('');

    try {
      const updated = await this.teacherService.reprocessMaterial(material._id);
      this.updateMaterialInList(material._id, () => updated);
      this.successMsg.set('Đã cập nhật tri thức AI cho tài liệu');
      await this.loadLookups();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Không thể xử lý lại tài liệu');
    } finally {
      this.uploading.set(false);
    }
  }

  blankForm(): MaterialForm {
    return {
      title: '',
      description: '',
      manualSummary: '',
      subject: '',
      grade: '',
      classId: '',
      productId: '',
      courseName: '',
      unitCode: '',
      unitTitle: '',
      lessonCode: '',
      lessonTitle: '',
      lessonOrder: '',
      materialScope: 'TEACHING',
      materialType: 'OTHER',
      usagePhase: 'IN_CLASS',
      difficulty: 'STANDARD',
      status: 'APPROVED',
      estimatedMinutes: '',
      skills: '',
      assignableAsHomework: false,
      autoGradeable: false,
      version: '',
      tags: '',
      isShared: false,
    };
  }

  formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  getFileCategory(mimeType: string) {
    if (!mimeType) return 'other';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('msword')) return 'doc';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'excel';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'other';
  }

  fileIcon(mimeType: string) {
    const icons: Record<string, string> = {
      pdf: 'PDF',
      doc: 'DOC',
      ppt: 'PPT',
      excel: 'XLS',
      image: 'IMG',
      video: 'VID',
      other: 'TỆP',
    };
    return icons[this.getFileCategory(mimeType)] || 'TỆP';
  }

  materialKnowledge(material: TeachingMaterial) {
    return material.manualSummary || material.aiSummary || material.extractedTextPreview || '';
  }

  classLabel(material: TeachingMaterial) {
    if (!material.classId) {
      return '';
    }
    if (typeof material.classId === 'object') {
      return material.classId.name || '';
    }
    return '';
  }

  materialScopeLabel(scope?: TeachingMaterial['materialScope']) {
    const labels: Record<string, string> = {
      TEACHING: 'Nội dung giảng dạy',
      HOMEWORK: 'Kho bài tập',
    };
    return labels[scope || ''] || 'Nội dung giảng dạy';
  }

  materialTypeLabel(type?: TeachingMaterial['materialType']) {
    const labels: Record<string, string> = {
      SLIDE: 'Slide',
      LESSON_PLAN: 'Giáo án',
      WORKSHEET: 'Phiếu bài tập',
      ANSWER_KEY: 'Đáp án',
      RUBRIC: 'Rubric',
      AUDIO: 'Audio',
      VIDEO: 'Video',
      HOMEWORK_SET: 'Bộ BTVN',
      QUIZ: 'Quiz',
      TEST: 'Đề kiểm tra',
      OTHER: 'Khác',
    };
    return labels[type || ''] || 'Khác';
  }

  usagePhaseLabel(phase?: TeachingMaterial['usagePhase']) {
    const labels: Record<string, string> = {
      BEFORE_CLASS: 'Trước buổi',
      IN_CLASS: 'Trong buổi',
      AFTER_CLASS: 'Sau buổi',
    };
    return labels[phase || ''] || '';
  }

  difficultyLabel(difficulty?: TeachingMaterial['difficulty']) {
    const labels: Record<string, string> = {
      FOUNDATION: 'Nền tảng',
      STANDARD: 'Chuẩn',
      ADVANCED: 'Nâng cao',
    };
    return labels[difficulty || ''] || '';
  }

  extractionStatusLabel(status?: TeachingMaterial['extractionStatus']) {
    const labels: Record<string, string> = {
      READY: 'Sẵn sàng cho AI',
      PENDING: 'Đang xử lý',
      UNSUPPORTED: 'Cần tóm tắt thủ công',
      FAILED: 'Xử lý lỗi',
    };
    return labels[status || ''] || 'Chưa rõ';
  }

  materialStatusTone(status?: TeachingMaterial['extractionStatus']) {
    const tones: Record<string, string> = {
      READY: 'success',
      PENDING: 'warning',
      UNSUPPORTED: 'neutral',
      FAILED: 'danger',
    };
    return tones[status || ''] || 'neutral';
  }

  materialNote(material: TeachingMaterial) {
    if (material.processingError) {
      return material.processingError;
    }
    if (material.lastProcessedAt) {
      return `Cập nhật AI: ${new Date(material.lastProcessedAt).toLocaleString('vi-VN')}`;
    }
    return '';
  }

  trackByMaterialId(_: number, material: TeachingMaterial) {
    return material._id;
  }

  activeFilterChips(): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = [];

    if (this.searchQuery.trim()) {
      chips.push({ key: 'search', label: 'Tìm kiếm', value: this.searchQuery.trim() });
    }
    if (this.filterSubject) {
      chips.push({ key: 'subject', label: 'Môn', value: this.filterSubject });
    }
    if (this.filterGrade) {
      chips.push({ key: 'grade', label: 'Khối', value: this.filterGrade });
    }
    if (this.filterClassId) {
      const matchedClass = this.classes().find((classroom) => classroom._id === this.filterClassId);
      chips.push({
        key: 'classId',
        label: 'Lớp',
        value: matchedClass ? `${matchedClass.name} (${matchedClass.code})` : this.filterClassId,
      });
    }
    if (this.filterProductId) {
      chips.push({
        key: 'productId',
        label: 'Khóa học',
        value: this.productLabelById(this.filterProductId),
      });
    }
    if (this.filterUnitCode.trim()) {
      chips.push({ key: 'unitCode', label: 'Unit', value: this.filterUnitCode.trim() });
    }
    if (this.filterLessonCode.trim()) {
      chips.push({ key: 'lessonCode', label: 'Bài', value: this.filterLessonCode.trim() });
    }
    if (this.filterType) {
      chips.push({ key: 'fileCategory', label: 'Loại file', value: this.filterType.toUpperCase() });
    }
    if (this.filterMaterialType) {
      chips.push({
        key: 'materialType',
        label: 'Loại học liệu',
        value: this.materialTypeLabel(this.filterMaterialType),
      });
    }
    if (this.filterExtractionStatus) {
      chips.push({
        key: 'extractionStatus',
        label: 'AI',
        value: this.extractionStatusLabel(this.filterExtractionStatus),
      });
    }

    return chips;
  }

  removeFilterChip(key: ActiveFilterChip['key']) {
    switch (key) {
      case 'search':
        this.searchQuery = '';
        break;
      case 'subject':
        this.filterSubject = '';
        break;
      case 'grade':
        this.filterGrade = '';
        break;
      case 'classId':
        this.filterClassId = '';
        break;
      case 'productId':
        this.filterProductId = '';
        break;
      case 'unitCode':
        this.filterUnitCode = '';
        break;
      case 'lessonCode':
        this.filterLessonCode = '';
        break;
      case 'fileCategory':
        this.filterType = '';
        break;
      case 'materialType':
        this.filterMaterialType = '';
        break;
      case 'extractionStatus':
        this.filterExtractionStatus = '';
        break;
    }

    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
      this.searchDebounceHandle = null;
    }
    void this.loadMaterials({ reset: true });
  }
}
