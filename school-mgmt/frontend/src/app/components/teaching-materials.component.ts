import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';
import { ClassItem, ClassService } from '../services/class.service';
import {
  TeacherService,
  TeachingMaterial,
  TeachingMaterialListQuery,
  TeachingMaterialStats,
} from '../services/teacher.service';
import { FlowGuideComponent } from './shared/flow-guide.component';

interface MaterialForm {
  title: string;
  description: string;
  manualSummary: string;
  subject: string;
  grade: string;
  classId: string;
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
  key: 'search' | 'subject' | 'grade' | 'classId' | 'fileCategory' | 'extractionStatus';
  label: string;
  value: string;
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
  stats = signal<TeachingMaterialStats | null>(null);
  classes = signal<ClassItem[]>([]);
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
  filterType: TeachingMaterialListQuery['fileCategory'] | '' = '';
  filterExtractionStatus: TeachingMaterialListQuery['extractionStatus'] | '' = '';

  selectedFile: File | null = null;
  editingMaterial: TeachingMaterial | null = null;
  deletingMaterial: TeachingMaterial | null = null;
  materialFormData: MaterialForm = this.blankForm();

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;
  private requestSequence = 0;

  constructor(
    private readonly teacherService: TeacherService,
    private readonly classService: ClassService,
  ) {}

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
    const [stats, classes] = await Promise.all([
      this.teacherService.getMaterialStats().catch(() => null),
      this.classService.list().catch(() => []),
    ]);
    this.stats.set(stats);
    this.classes.set(classes);
  }

  private buildQuery(page: number): TeachingMaterialListQuery {
    return {
      subject: this.filterSubject || undefined,
      grade: this.filterGrade || undefined,
      classId: this.filterClassId || undefined,
      search: this.searchQuery.trim() || undefined,
      fileCategory: this.filterType || undefined,
      extractionStatus: this.filterExtractionStatus || undefined,
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
      this.error.set(e?.error?.message || 'Khong the tai danh sach tai lieu');
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
      return 'Chua co tai lieu nao';
    }

    return `Dang hien ${visibleCount}/${total} tai lieu`;
  }

  hasActiveFilters() {
    return !!(
      this.searchQuery.trim() ||
      this.filterSubject ||
      this.filterGrade ||
      this.filterClassId ||
      this.filterType ||
      this.filterExtractionStatus
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

  onExtractionStatusChange(value: TeachingMaterialListQuery['extractionStatus'] | '') {
    this.filterExtractionStatus = value;
    void this.loadMaterials({ reset: true });
  }

  onTypeChange(value: string) {
    this.filterType = (value || '') as TeachingMaterialListQuery['fileCategory'] | '';
    void this.loadMaterials({ reset: true });
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterSubject = '';
    this.filterGrade = '';
    this.filterClassId = '';
    this.filterType = '';
    this.filterExtractionStatus = '';
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
    this.editingMaterial = null;
    this.selectedFile = null;
    this.materialFormData = this.blankForm();
    this.error.set('');
    this.successMsg.set('');
    this.showModal.set(true);
  }

  openEditModal(material: TeachingMaterial) {
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

  async submitMaterial() {
    this.uploading.set(true);
    this.error.set('');
    this.successMsg.set('');

    try {
      const metadata = {
        title: this.materialFormData.title,
        description: this.materialFormData.description || undefined,
        manualSummary: this.materialFormData.manualSummary || undefined,
        subject: this.materialFormData.subject || undefined,
        grade: this.materialFormData.grade || undefined,
        classId: this.materialFormData.classId || undefined,
        tags: this.materialFormData.tags
          ? this.materialFormData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : undefined,
        isShared: this.materialFormData.isShared,
      };

      if (this.editingMaterial) {
        await this.teacherService.updateMaterial(this.editingMaterial._id, metadata);
        this.successMsg.set('Da cap nhat tai lieu');
      } else {
        if (!this.selectedFile) {
          this.error.set('Hay chon file truoc khi tai len');
          return;
        }
        await this.teacherService.uploadMaterial(this.selectedFile, metadata);
        this.successMsg.set('Da tai len tai lieu moi');
      }

      this.closeModal();
      await Promise.all([this.loadMaterials({ reset: true }), this.loadLookups()]);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Khong the luu tai lieu');
    } finally {
      this.uploading.set(false);
    }
  }

  confirmDelete(material: TeachingMaterial) {
    this.deletingMaterial = material;
    this.showDeleteConfirm.set(true);
  }

  async executeDelete() {
    if (!this.deletingMaterial) {
      return;
    }

    this.uploading.set(true);
    this.error.set('');

    try {
      await this.teacherService.deleteMaterial(this.deletingMaterial._id);
      this.deletingMaterial = null;
      this.showDeleteConfirm.set(false);
      this.successMsg.set('Da xoa tai lieu');
      await Promise.all([this.loadMaterials({ reset: true }), this.loadLookups()]);
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Khong the xoa tai lieu');
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
    this.uploading.set(true);
    this.error.set('');
    this.successMsg.set('');

    try {
      const updated = await this.teacherService.reprocessMaterial(material._id);
      this.updateMaterialInList(material._id, () => updated);
      this.successMsg.set('Da cap nhat tri thuc AI cho tai lieu');
      await this.loadLookups();
    } catch (e: any) {
      this.error.set(e?.error?.message || 'Khong the reprocess tai lieu');
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
      other: 'FILE',
    };
    return icons[this.getFileCategory(mimeType)] || 'FILE';
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

  extractionStatusLabel(status?: TeachingMaterial['extractionStatus']) {
    const labels: Record<string, string> = {
      READY: 'AI ready',
      PENDING: 'Dang xu ly',
      UNSUPPORTED: 'Can tom tat tay',
      FAILED: 'Xu ly loi',
    };
    return labels[status || ''] || 'Chua ro';
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
      return `Cap nhat AI: ${new Date(material.lastProcessedAt).toLocaleString('vi-VN')}`;
    }
    return '';
  }

  trackByMaterialId(_: number, material: TeachingMaterial) {
    return material._id;
  }

  activeFilterChips(): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = [];

    if (this.searchQuery.trim()) {
      chips.push({ key: 'search', label: 'Tim kiem', value: this.searchQuery.trim() });
    }
    if (this.filterSubject) {
      chips.push({ key: 'subject', label: 'Mon', value: this.filterSubject });
    }
    if (this.filterGrade) {
      chips.push({ key: 'grade', label: 'Khoi', value: this.filterGrade });
    }
    if (this.filterClassId) {
      const matchedClass = this.classes().find((classroom) => classroom._id === this.filterClassId);
      chips.push({
        key: 'classId',
        label: 'Lop',
        value: matchedClass ? `${matchedClass.name} (${matchedClass.code})` : this.filterClassId,
      });
    }
    if (this.filterType) {
      chips.push({ key: 'fileCategory', label: 'Loai file', value: this.filterType.toUpperCase() });
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
      case 'fileCategory':
        this.filterType = '';
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
