import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ClassItem,
  ClassCoTeacherConfig,
  ClassCoTeacherPayload,
  ClassCoTeacherRole,
  ClassMember,
  ClassPayload,
  ClassService,
  PendingOfflineAssignment,
  StudentClassConfig,
  StudentDurationSlot,
  StudentTeacherSlot,
} from '../services/class.service';
import { UserItem, UserService } from '../services/user.service';
import { StudentItem, StudentService } from '../services/student.service';
import { ProductItem, ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';
import { InvoiceItem, InvoiceService } from '../services/invoice.service';
import { TeacherProfile, TeacherService } from '../services/teacher.service';

import { FlowGuideComponent } from './shared/flow-guide.component';
import {
  calcProportional as _calcProportional,
  calcTeacherProportional as _calcTeacherProportional,
  classEditHistory,
  classHistoryActionLabel,
  formatCurrency,
  formatSessionCount,
  formatTeacherBase,
  formatTeacherActual,
  formatTeacherCurrency,
  formatHistoryTimestamp,
  getClassProfit,
  getInvoiceClassId,
  getStudentConfig,
  getStudentDurationDisplay as _getStudentDurationDisplay,
  getStudentTeacherDisplay as _getStudentTeacherDisplay,
  getTeacherSlotDisplay as _getTeacherSlotDisplay,
  getCurrentStudentDuration,
  getCurrentStudentTeacherId,
  isOfflineClass,
  getProfitClass,
  mapTeacherProfileToUserItem,
  matchesProductMode,
  pendingClassChanges,
  resolveMemberId,
  resolveMemberName,
  roundMoneyDownToThousand,
  roundMoneyToThousand,
  sortDurationSlots,
  sortTeacherSlots,
} from './classes.utils';

type CoTeacherFormRow = {
  teacherId: string;
  role: ClassCoTeacherRole;
  canManageAttendance: boolean;
  canManageReports: boolean;
  canCreateLink: boolean;
  note: string;
};

type TeacherFilterOption = {
  id: string;
  fullName: string;
};

type ClassStudentSummaryView = {
  key: string;
  student: ClassMember & { studentCode?: string };
  teacherDisplay: string;
  durationDisplay: string;
  teacherHistory: string;
  durationHistory: string;
};

type ClassCoTeacherSummaryView = {
  key: string;
  name: string;
  roleLabel: string;
  permissionSummary: string;
};

type ClassTableRowView = {
  key: string;
  item: ClassItem;
  mode: 'ONLINE' | 'OFFLINE';
  primaryTeacherName: string;
  pendingOfflineCount: number;
  coTeacherSummaries: ClassCoTeacherSummaryView[];
  studentSummaries: ClassStudentSummaryView[];
  visibleOfflineRequests: PendingOfflineAssignment[];
};

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './classes.component.html',
  styleUrls: ['./classes.component.css'],
})
export class ClassesComponent implements OnDestroy {
  readonly defaultBaseDuration = 70;
  readonly classesPageSize = 25;
  classes = signal<ClassItem[]>([]);
  saleOfflineOptions = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  teacherProfiles = signal<TeacherProfile[]>([]);
  sales = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  products = signal<ProductItem[]>([]);
  invoices = signal<InvoiceItem[]>([]);
  totalClasses = signal(0);
  totalPages = signal(1);
  currentPage = signal(1);
  loadingClasses = signal(false);
  studentSearch = '';
  private readonly classSearchState = signal('');
  private readonly teacherFilterIdState = signal('');
  private readonly classModeFilterState = signal<'' | 'ONLINE' | 'OFFLINE'>('');
  private classSearchReloadTimer: ReturnType<typeof setTimeout> | null = null;
  private latestListRequestId = 0;
  codeSearch = '';
  showCodeDropdown = false;
  showModal = signal(false);
  showStudentConfigModal = signal(false);
  editingClass = signal<ClassItem | null>(null);
  error = signal('');
  studentConfigError = signal('');
  editingId: string | null = null;
  editMode: 'config' | 'assign' | 'duration' = 'config';
  selectedStudentConfigClass: ClassItem | null = null;
  selectedStudentConfigStudent: (ClassMember & { studentCode?: string }) | null = null;
  studentConfigForm = this.blankStudentConfigForm();
  form = this.blankForm();
  submitLabel = 'Luu';
  standardDurations = [30, 40, 50, 60, 70, 80, 90, 120, 150];
  readonly coTeacherRoleOptions: Array<{ value: ClassCoTeacherRole; label: string }> = [
    { value: 'SUPPORT', label: 'GV phu ho tro' },
    { value: 'ATTENDANCE', label: 'GV phu diem danh' },
    { value: 'REPORT', label: 'GV phu bao cao' },
  ];

  // Template-bound utility functions
  formatCurrency = formatCurrency;
  formatTeacherCurrency = formatTeacherCurrency;
  isOfflineClass = isOfflineClass;
  getProfitClass = getProfitClass;
  formatSessionCount = formatSessionCount;
  formatHistoryTimestamp = formatHistoryTimestamp;
  classHistoryActionLabel = classHistoryActionLabel;
  formatTeacherBase = formatTeacherBase;
  formatTeacherActual = formatTeacherActual;
  getProfit = getClassProfit;
  pendingClassChanges = pendingClassChanges;
  classEditHistory = classEditHistory;
  readonly teacherFilterOptionsState = computed<TeacherFilterOption[]>(() => {
    return this.teachers()
      .filter((teacher) => !!teacher?._id && !!teacher.fullName?.trim())
      .map((teacher) => ({ id: teacher._id, fullName: teacher.fullName.trim() }))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'vi'));
  });
  readonly filteredClassRows = computed<ClassTableRowView[]>(() => {
    const teachers = this.teachers();
    const canManage = this.canManage();
    const saleMode = this.isSale();
    const currentUserId = this.currentUserId();

    return this.classes()
      .map((classItem) => this.buildClassTableRow(classItem, teachers, canManage, saleMode, currentUserId));
  });
  readonly filteredClassCount = computed(() => this.filteredClassRows().length);
  readonly hasActiveClassFiltersState = computed(() =>
    Boolean(this.classSearchState().trim() || this.teacherFilterIdState() || this.classModeFilterState()),
  );

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private studentService: StudentService,
    private productService: ProductService,
    private invoiceService: InvoiceService,
    private teacherService: TeacherService,
    private auth: AuthService,
  ) {
    void this.loadLookups();
    void this.reload();
  }

  ngOnDestroy() {
    if (this.classSearchReloadTimer) {
      clearTimeout(this.classSearchReloadTimer);
      this.classSearchReloadTimer = null;
    }
  }

  get classSearch(): string {
    return this.classSearchState();
  }

  set classSearch(value: string) {
    this.classSearchState.set(String(value || ''));
  }

  get teacherFilterId(): string {
    return this.teacherFilterIdState();
  }

  set teacherFilterId(value: string) {
    this.teacherFilterIdState.set(String(value || '').trim());
  }

  get classModeFilter(): '' | 'ONLINE' | 'OFFLINE' {
    return this.classModeFilterState();
  }

  set classModeFilter(value: '' | 'ONLINE' | 'OFFLINE') {
    this.classModeFilterState.set(value || '');
  }

  blankForm() {
    return {
      name: '',
      code: '',
      teacherId: '',
      coTeachers: this.blankCoTeachers(),
      saleId: '',
      invoiceId: '',
      existingOfflineClassId: '',
      productPackageId: '',
      classMode: 'ONLINE' as 'ONLINE' | 'OFFLINE',
      studentIds: [] as string[],
      pricePerSession: 0,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 0,
      baseDuration: this.defaultBaseDuration,
      sessionDuration: this.defaultBaseDuration,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    };
  }

  blankStudentConfigForm() {
    return {
      teacherId: '',
      sessionDuration: null as number | null,
    };
  }

  blankCoTeachers(): CoTeacherFormRow[] {
    return [];
  }

  async loadLookups() {
    const saleMode = this.isSale();
    const [users, teacherProfilesList, studs, prods, invoicesList] = await Promise.all([
      saleMode ? Promise.resolve([] as UserItem[]) : this.userService.listDirectory(),
      this.teacherService.getAllTeachers(),
      this.studentService.list(),
      this.productService.list(),
      saleMode ? this.invoiceService.list() : Promise.resolve([] as InvoiceItem[]),
    ]);
    this.teacherProfiles.set(teacherProfilesList);
    const teachersFromProfiles = teacherProfilesList
      .map((profile) => mapTeacherProfileToUserItem(profile))
      .filter((teacher): teacher is UserItem => !!teacher);
    const teacherMap = new Map<string, UserItem>();
    [...users.filter((u) => u.role === 'TEACHER'), ...teachersFromProfiles].forEach((teacher) => {
      teacherMap.set(teacher._id, teacher);
    });
    this.teachers.set(Array.from(teacherMap.values()));
    this.sales.set(users.filter((u) => u.role === 'SALE'));
    this.students.set(studs);
    this.products.set(prods);
    this.invoices.set(invoicesList);
  }

  async reload(page: number = this.currentPage()) {
    const requestId = ++this.latestListRequestId;
    const safePage = Math.max(Number(page) || 1, 1);

    this.loadingClasses.set(true);
    const result = await this.classService.listManagement({
      search: this.classSearchState().trim() || undefined,
      teacherId: this.teacherFilterIdState().trim() || undefined,
      classMode: this.classModeFilterState() || undefined,
      page: safePage,
      limit: this.classesPageSize,
    });

    if (requestId !== this.latestListRequestId) {
      return;
    }

    this.classes.set(result.data || []);
    this.totalClasses.set(result.meta?.total || 0);
    this.totalPages.set(Math.max(result.meta?.totalPages || 1, 1));
    this.currentPage.set(result.meta?.page || safePage);
    if (this.editingId) {
      const currentEditingClass = (result.data || []).find((item) => item._id === this.editingId);
      if (currentEditingClass) {
        this.editingClass.set(currentEditingClass);
      }
    }
    this.loadingClasses.set(false);
  }

  filteredClasses(): ClassItem[] {
    return this.filteredClassRows().map((row) => row.item);
  }

  teacherFilterOptions(): TeacherFilterOption[] {
    return this.teacherFilterOptionsState();
  }

  hasActiveClassFilters(): boolean {
    return this.hasActiveClassFiltersState();
  }

  resetClassFilters() {
    this.classSearch = '';
    this.teacherFilterId = '';
    this.classModeFilter = '';
    if (this.classSearchReloadTimer) {
      clearTimeout(this.classSearchReloadTimer);
      this.classSearchReloadTimer = null;
    }
    void this.reload(1);
  }

  onClassSearchChange(value: string) {
    this.classSearch = String(value || '');
    if (this.classSearchReloadTimer) {
      clearTimeout(this.classSearchReloadTimer);
    }
    this.classSearchReloadTimer = setTimeout(() => {
      this.classSearchReloadTimer = null;
      void this.reload(1);
    }, 250);
  }

  onTeacherFilterChange(value: string) {
    if (this.classSearchReloadTimer) {
      clearTimeout(this.classSearchReloadTimer);
      this.classSearchReloadTimer = null;
    }
    this.teacherFilterId = String(value || '').trim();
    void this.reload(1);
  }

  onClassModeFilterChange(value: '' | 'ONLINE' | 'OFFLINE') {
    if (this.classSearchReloadTimer) {
      clearTimeout(this.classSearchReloadTimer);
      this.classSearchReloadTimer = null;
    }
    this.classModeFilter = value || '';
    void this.reload(1);
  }

  goToClassesPage(page: number) {
    if (this.classSearchReloadTimer) {
      clearTimeout(this.classSearchReloadTimer);
      this.classSearchReloadTimer = null;
    }
    const safePage = Math.min(Math.max(Number(page) || 1, 1), this.totalPages());
    if (safePage === this.currentPage() || this.loadingClasses()) {
      return;
    }
    void this.reload(safePage);
  }

  filteredCodeOptions(): { label: string; value: string }[] {
    const q = this.codeSearch.trim().toLowerCase();
    if (this.form.classMode === 'OFFLINE') {
      return this.products()
        .filter((p) => p.isActive !== false && (p.teachingMode === 'OFFLINE' || p.teachingMode === 'BOTH'))
        .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q))
        .map((p) => ({ label: `${p.name}${p.code ? ' (' + p.code + ')' : ''}`, value: p.name }));
    }
    return this.students()
      .filter((st) => !q || st.studentCode.toLowerCase().includes(q) || st.fullName.toLowerCase().includes(q))
      .map((st) => ({ label: `${st.studentCode} - ${st.fullName}`, value: st.studentCode }));
  }

  selectCodeOption(value: string, label: string) {
    this.form.code = value;
    this.codeSearch = label;
    this.showCodeDropdown = false;
  }

  private resetSaleOfflineSelection() {
    this.form.existingOfflineClassId = '';
    this.form.name = '';
    this.form.code = '';
    this.form.teacherId = '';
    this.form.productPackageId = '';
    this.form.pricePerSession = 0;
    this.form.teacherPayPerSession = 0;
    this.form.teacherPayPerStudent = 0;
    this.form.baseDuration = this.defaultBaseDuration;
    this.form.sessionDuration = this.defaultBaseDuration;
    this.form.revenuePerStudent = 0;
    this.form.teacherSalaryCost = 0;
    this.form.coTeachers = this.blankCoTeachers();
    this.codeSearch = '';
    this.showCodeDropdown = false;
  }

  selectedSaleOfflineClass(): ClassItem | undefined {
    if (!this.form.existingOfflineClassId) {
      return undefined;
    }
    return this.saleOfflineOptions().find((item) => item._id === this.form.existingOfflineClassId);
  }

  isSaleOfflineExistingMode() {
    return this.isSaleCreateMode() && this.form.classMode === 'OFFLINE';
  }

  onSaleOfflineClassChange(classId: string) {
    this.form.existingOfflineClassId = classId || '';
    this.submitLabel = this.isSaleOfflineExistingMode() ? 'Gui yeu cau' : 'Luu';
    const selectedClass = this.saleOfflineOptions().find((item) => item._id === classId);
    if (!selectedClass) {
      this.resetSaleOfflineSelection();
      return;
    }

    this.form.name = selectedClass.name || '';
    this.form.code = selectedClass.code || '';
    this.form.teacherId = selectedClass.teacher?._id || '';
    this.form.productPackageId = selectedClass.productPackage?._id || '';
    this.form.pricePerSession = selectedClass.pricePerSession || 0;
    this.form.teacherPayPerSession = selectedClass.teacherPayPerSession || 0;
    this.form.teacherPayPerStudent = selectedClass.teacherPayPerStudent || 0;
    this.form.baseDuration = selectedClass.baseDuration || this.defaultBaseDuration;
    this.form.sessionDuration = selectedClass.sessionDuration || selectedClass.baseDuration || this.defaultBaseDuration;
    this.form.revenuePerStudent = selectedClass.revenuePerStudent || 0;
    this.form.teacherSalaryCost = selectedClass.teacherSalaryCost || 0;
    this.codeSearch = selectedClass.code || '';
    this.showCodeDropdown = false;
  }

  onClassModeChange() {
    if (this.isSaleCreateMode() && this.form.invoiceId) {
      this.onInvoiceChange(this.form.invoiceId);
      return;
    }
    if (this.isSaleOfflineExistingMode()) {
      this.resetSaleOfflineSelection();
      return;
    }
    this.syncProductPackageSelection();
    if (this.form.classMode !== 'OFFLINE') {
      this.form.coTeachers = this.blankCoTeachers();
    }
    this.form.code = '';
    this.codeSearch = '';
    this.showCodeDropdown = false;
  }

  hideCodeDropdown() {
    setTimeout(() => { this.showCodeDropdown = false; }, 150);
  }

  async openModal() {
    if (!this.canCreateClass()) return;
    if (this.isSale()) {
      const [invoicesList, saleOfflineOpts] = await Promise.all([
        this.invoiceService.list(),
        this.classService.listSaleOfflineOptions(),
      ]);
      this.invoices.set(invoicesList);
      this.saleOfflineOptions.set(saleOfflineOpts);
    }
    this.form = this.blankForm();
    if (this.isSale()) {
      this.form.saleId = this.currentUserId();
    }
    this.editingId = null;
    this.editingClass.set(null);
    this.editMode = 'config';
    this.error.set('');
    this.studentSearch = '';
    this.codeSearch = '';
    this.showCodeDropdown = false;
    this.submitLabel = 'Luu';
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.editingClass.set(null);
    this.editMode = 'config';
    this.codeSearch = '';
    this.showCodeDropdown = false;
    this.submitLabel = 'Luu';
  }

  openStudentConfigModal(classItem: ClassItem, student: ClassMember & { studentCode?: string }) {
    if (!this.canEditStudentConfig(classItem)) return;
    this.selectedStudentConfigClass = classItem;
    this.selectedStudentConfigStudent = student;
    this.studentConfigForm = this.blankStudentConfigForm();
    this.studentConfigError.set('');
    this.showStudentConfigModal.set(true);
  }

  closeStudentConfigModal() {
    this.showStudentConfigModal.set(false);
    this.selectedStudentConfigClass = null;
    this.selectedStudentConfigStudent = null;
    this.studentConfigForm = this.blankStudentConfigForm();
    this.studentConfigError.set('');
  }

  async submitStudentConfig() {
    this.studentConfigError.set('');

    const classItem = this.selectedStudentConfigClass;
    const student = this.selectedStudentConfigStudent;
    if (!classItem || !student) {
      this.studentConfigError.set('Khong xac dinh duoc hoc sinh can cap nhat');
      return;
    }

    const payload: { teacherId?: string; sessionDuration?: number } = {};
    const currentTeacherId = getCurrentStudentTeacherId(classItem, student._id);
    const currentDuration = getCurrentStudentDuration(classItem, student._id, this.defaultBaseDuration);

    if (this.canAppendTeacherSlot() && this.studentConfigForm.teacherId) {
      if (this.studentConfigForm.teacherId !== currentTeacherId) {
        payload.teacherId = this.studentConfigForm.teacherId;
      }
    }

    if (
      this.canAppendDurationSlot()
      && this.studentConfigForm.sessionDuration
      && this.studentConfigForm.sessionDuration !== currentDuration.sessionDuration
    ) {
      payload.sessionDuration = this.studentConfigForm.sessionDuration;
    }

    if (!payload.teacherId && !payload.sessionDuration) {
      this.studentConfigError.set('Chon giao vien moi hoac thoi luong moi de bo sung');
      return;
    }

    const result = await this.classService.updateStudentConfig(classItem._id, student._id, payload);
    if (!result.ok) {
      this.studentConfigError.set(result.message || 'Khong the cap nhat hoc sinh trong lop');
      return;
    }

    this.closeStudentConfigModal();
    await this.reload();
  }

  async submit() {
    this.error.set('');

    if (this.isSaleAssignMode()) {
      if (this.editingClass() && isOfflineClass(this.editingClass()!)) {
        this.error.set('Voi lop offline, sale them hoc sinh bang yeu cau tu hoa don da duyet');
        return;
      }
      if (!this.form.studentIds.length) {
        this.error.set('Vui long chon it nhat mot hoc vien');
        return;
      }
      const saleResult = await this.classService.assignStudents(this.editingId!, this.form.studentIds);
      if (!saleResult.ok) {
        this.error.set(saleResult.message || 'Khong the them hoc vien');
        return;
      }
      this.closeModal();
      await this.reload();
      return;
    }

    if (this.isSaleDurationEditMode()) {
      const result = await this.classService.update(this.editingId!, {
        baseDuration: this.form.baseDuration || this.defaultBaseDuration,
        sessionDuration: this.form.sessionDuration || this.defaultBaseDuration,
        requestType: 'DURATION_CHANGE',
      });

      if (!result.ok) {
        this.error.set(result.message || 'Khong the gui yeu cau doi thoi luong');
        return;
      }

      if (result.message) {
        alert(result.message);
      }

      this.closeModal();
      await this.reload();
      return;
    }

    if (this.isSaleConfigEditMode()) {
      if (!this.form.teacherId) {
        this.error.set('Vui long chon giao vien');
        return;
      }

      const result = await this.classService.update(this.editingId!, {
        teacherId: this.form.teacherId,
        ...(this.form.classMode === 'OFFLINE'
          ? { teacherPayPerStudent: this.form.teacherPayPerStudent || 0 }
          : { teacherPayPerSession: this.form.teacherPayPerSession || 0 }),
      });

      if (!result.ok) {
        this.error.set(result.message || 'Khong the gui yeu cau doi giao vien/luong GV');
        return;
      }

      if (result.message) {
        alert(result.message);
      }

      this.closeModal();
      await this.reload();
      return;
    }

    if (this.isSaleOfflineExistingMode()) {
      if (!this.form.invoiceId) {
        this.error.set('Vui long chon hoa don da duyet');
        return;
      }
      if (!this.form.existingOfflineClassId) {
        this.error.set('Vui long chon lop offline co san');
        return;
      }
      if (!this.form.studentIds.length) {
        this.error.set('Khong tim thay hoc sinh tren hoa don de them vao lop');
        return;
      }

      const saleResult = await this.classService.assignStudents(
        this.form.existingOfflineClassId,
        [...this.form.studentIds],
        this.form.invoiceId,
      );
      if (!saleResult.ok) {
        this.error.set(saleResult.message || 'Khong the them hoc sinh vao lop offline');
        return;
      }

      if (saleResult.message) {
        alert(saleResult.message);
      }

      this.closeModal();
      await this.reload();
      return;
    }

    if (!this.form.name.trim()) {
      this.error.set('Vui long nhap ten lop');
      return;
    }

    if (this.isSaleCreateMode() && !this.form.invoiceId) {
      this.error.set('Vui long chon hoa don da duyet');
      return;
    }

    if (!this.form.code.trim()) {
      this.error.set('Vui long chon ma lop');
      return;
    }

    if (!this.form.teacherId) {
      this.error.set('Vui long chon giao vien');
      return;
    }

    const coTeacherValidation =
      this.form.classMode === 'OFFLINE'
        ? this.buildCoTeacherPayload(this.coTeacherRows())
        : { ok: true as const, payload: [] as ClassCoTeacherPayload[] };
    if (!coTeacherValidation.ok) {
      this.error.set(coTeacherValidation.message);
      return;
    }

    const pricePerSession = roundMoneyToThousand(this.form.pricePerSession || 0);
    const teacherPayPerSession = this.form.classMode === 'ONLINE'
      ? roundMoneyDownToThousand(this.form.teacherPayPerSession || 0)
      : 0;
    const teacherPayPerStudent = this.form.classMode === 'OFFLINE'
      ? roundMoneyDownToThousand(this.form.teacherPayPerStudent || 0)
      : 0;

    const payload: Partial<ClassPayload> = {
      name: this.form.name.trim(),
      code: this.form.code.trim(),
      teacherId: this.form.teacherId,
      saleId: this.form.saleId || undefined,
      invoiceId: !this.editingId ? (this.form.invoiceId || undefined) : undefined,
      productPackageId: this.form.productPackageId || undefined,
      classMode: this.form.classMode || 'ONLINE',
      pricePerSession,
      baseDuration: this.form.baseDuration || this.defaultBaseDuration,
      sessionDuration: this.form.sessionDuration || this.defaultBaseDuration,
      revenuePerStudent: roundMoneyToThousand(this.form.revenuePerStudent || 0),
      teacherSalaryCost: roundMoneyDownToThousand(this.form.teacherSalaryCost || 0),
      ...(this.canSubmitStudentSelection() ? { studentIds: [...this.form.studentIds] } : {}),
    };
    if (this.form.classMode === 'OFFLINE') {
      payload.coTeachers = coTeacherValidation.payload;
    } else if (this.editingClass()?.coTeachers?.length) {
      payload.coTeachers = [];
    }

    const isCreatingFromInvoice = !this.editingId && !!this.form.invoiceId;
    if (this.form.classMode === 'ONLINE' && (teacherPayPerSession > 0 || !isCreatingFromInvoice)) {
      payload.teacherPayPerSession = teacherPayPerSession;
    }
    if (this.form.classMode === 'OFFLINE' && (teacherPayPerStudent > 0 || !isCreatingFromInvoice)) {
      payload.teacherPayPerStudent = teacherPayPerStudent;
    }

    const result = this.editingId
      ? await this.classService.update(this.editingId, payload)
      : await this.classService.create(payload as ClassPayload);

    if (!result.ok) {
      this.error.set(result.message || 'Khong the luu lop hoc');
      return;
    }

    if (result.message) {
      alert(result.message);
    }

    this.closeModal();
    await this.reload();
  }

  async edit(classItem: ClassItem, mode: 'config' | 'assign' | 'duration' = 'config') {
    if (this.isSale() && !this.canSaleOpenMode(classItem, mode)) return;
    const classDetail = await this.classService.findOne(classItem._id) || classItem;
    this.editingId = classDetail._id;
    this.editingClass.set(classDetail);
    this.editMode = this.isSale() ? mode : 'config';
    const classStudentIds = classDetail.students?.map((s) => s._id) || [];
    const myStudents = new Set(this.students().map((s) => s._id));
    const pendingConfigChanges =
      this.isSale() && mode === 'config' && classDetail.pendingSaleUpdate?.requestType !== 'DURATION_CHANGE'
        ? classDetail.pendingSaleUpdate?.requestedChanges || {}
      : {};
    const pendingDurationChanges = this.isSale() && mode === 'duration'
      ? classDetail.pendingSaleUpdate?.requestedChanges || {}
      : {};
    const pendingTeacherId = String(pendingConfigChanges['teacherId'] || '');
    const pendingTeacherPayPerSession = Number(pendingConfigChanges['teacherPayPerSession']);
    const pendingTeacherPayPerStudent = Number(pendingConfigChanges['teacherPayPerStudent']);
    const pendingBaseDuration = Number(pendingDurationChanges['baseDuration']);
    const pendingSessionDuration = Number(pendingDurationChanges['sessionDuration']);

    this.form = {
      name: classDetail.name,
      code: classDetail.code,
      teacherId: pendingTeacherId || classDetail.teacher?._id || '',
      coTeachers: this.normalizeCoTeachers(classDetail.coTeachers),
      saleId: classDetail.sale?._id || '',
      invoiceId: '',
      existingOfflineClassId: '',
      productPackageId: classDetail.productPackage?._id || '',
      classMode: classDetail.classMode || 'ONLINE',
      studentIds: this.isSale() ? classStudentIds.filter((id) => myStudents.has(id)) : classStudentIds,
      pricePerSession: classDetail.pricePerSession || 0,
      teacherPayPerSession: Number.isFinite(pendingTeacherPayPerSession) && pendingTeacherPayPerSession >= 0
        ? pendingTeacherPayPerSession
        : (classDetail.teacherPayPerSession || 0),
      teacherPayPerStudent: Number.isFinite(pendingTeacherPayPerStudent) && pendingTeacherPayPerStudent >= 0
        ? pendingTeacherPayPerStudent
        : (classDetail.teacherPayPerStudent || 0),
      baseDuration: Number.isFinite(pendingBaseDuration) && pendingBaseDuration > 0
        ? pendingBaseDuration
        : (classDetail.baseDuration || this.defaultBaseDuration),
      sessionDuration: Number.isFinite(pendingSessionDuration) && pendingSessionDuration > 0
        ? pendingSessionDuration
        : (classDetail.sessionDuration || this.defaultBaseDuration),
      revenuePerStudent: classDetail.revenuePerStudent || 0,
      teacherSalaryCost: classDetail.teacherSalaryCost || 0,
    };

    this.error.set('');
    this.studentSearch = '';
    this.codeSearch = classDetail.code;
    this.syncProductPackageSelection();
    this.showCodeDropdown = false;
    this.submitLabel = this.isSaleAssignMode()
      ? 'Them hoc vien'
      : this.isSaleDurationEditMode()
        ? 'Gui Ops/Director duyet'
        : this.isSaleConfigEditMode()
          ? 'Gui duyet'
        : 'Cap nhat';
    this.showModal.set(true);
  }

  async remove(classItem: ClassItem) {
    if (!confirm(`Xoa lop ${classItem.name}?`)) return;
    const result = await this.classService.remove(classItem._id);
    if (!result.ok) {
      alert(result.message || 'Khong the xoa lop');
      return;
    }
    await this.reload();
  }

  availableStudents(): StudentItem[] {
    const query = this.studentSearch.trim().toLowerCase();
    const selectedSet = new Set(this.form.studentIds);
    return this.students().filter((st) => {
      const matches = !query || st.fullName.toLowerCase().includes(query);
      return matches && !selectedSet.has(st._id);
    });
  }

  selectedStudents(): StudentItem[] {
    const selectedSet = new Set(this.form.studentIds);
    return this.students().filter((st) => selectedSet.has(st._id));
  }

  addStudent(student: StudentItem) {
    if (this.form.studentIds.includes(student._id)) return;
    this.form.studentIds = [...this.form.studentIds, student._id];
  }

  removeStudent(id: string) {
    this.form.studentIds = this.form.studentIds.filter((sid) => sid !== id);
  }

  isDirector() { return this.auth.userSignal()?.role === 'DIRECTOR'; }
  isOps() { return this.auth.userSignal()?.role === 'OPS'; }
  isSale() { return this.auth.userSignal()?.role === 'SALE'; }
  isAccounting() { return this.auth.userSignal()?.role === 'ACCOUNTING'; }
  isTeacher() { return this.auth.userSignal()?.role === 'TEACHER'; }
  currentUserId() { return this.auth.userSignal()?.sub || ''; }
  canManage() {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }
  canCreateClass() { return this.canManage() || this.isSale(); }

  canSaleManageClass(classItem: ClassItem) {
    const current = this.auth.userSignal();
    return current?.role === 'SALE' && classItem.sale?._id === current.sub;
  }

  canSaleAssign(classItem: ClassItem) {
    return this.canSaleManageClass(classItem) && !isOfflineClass(classItem);
  }

  canSaleOpenMode(classItem: ClassItem, mode: 'config' | 'assign' | 'duration') {
    if (mode === 'assign') {
      return this.canSaleAssign(classItem);
    }
    return this.canSaleManageClass(classItem);
  }

  isSaleCreateMode() { return this.isSale() && !this.editingId; }
  isSaleDurationEditMode() { return this.isSale() && !!this.editingId && this.editMode === 'duration'; }
  isSaleConfigEditMode() { return this.isSale() && !!this.editingId && this.editMode === 'config'; }
  isSaleConfigMode() { return this.isSaleCreateMode() || this.isSaleConfigEditMode(); }
  isSaleAssignMode() { return this.isSale() && !!this.editingId && this.editMode === 'assign'; }

  canConfigureClassForm() {
    return this.canManage() || this.isSaleConfigMode() || this.isSaleDurationEditMode();
  }

  canSelectStudents() {
    return this.canManage()
      || this.isSaleAssignMode()
      || (this.isSaleCreateMode() && !this.isSaleOfflineExistingMode());
  }

  canSubmitStudentSelection() {
    return this.canManage() || (this.isSaleCreateMode() && !this.isSaleOfflineExistingMode());
  }

  coTeacherRoleLabel(role: ClassCoTeacherRole): string {
    switch (role) {
      case 'SUPPORT':
        return 'GV phu ho tro';
      case 'ATTENDANCE':
        return 'GV phu diem danh';
      case 'REPORT':
        return 'GV phu bao cao';
      default:
        return 'GV';
    }
  }

  coTeacherRows(): CoTeacherFormRow[] {
    if (!this.form.coTeachers?.length) {
      this.form.coTeachers = this.blankCoTeachers();
    }
    return this.form.coTeachers;
  }

  addCoTeacherRow() {
    if (this.coTeacherRows().length >= 2) return;
    const nextRole: ClassCoTeacherRole = this.coTeacherRows().length === 0 ? 'ATTENDANCE' : 'REPORT';
    this.form.coTeachers = [
      ...this.coTeacherRows(),
      this.buildCoTeacherRow(nextRole),
    ];
  }

  removeCoTeacherRow(index: number) {
    const rows = [...this.coTeacherRows()];
    rows.splice(index, 1);
    this.form.coTeachers = rows;
  }

  toggleCoTeacherPermission(
    index: number,
    permission: 'canManageAttendance' | 'canManageReports' | 'canCreateLink',
  ) {
    const rows = [...this.coTeacherRows()];
    if (!rows[index]) return;
    rows[index] = { ...rows[index], [permission]: !rows[index][permission] };
    this.form.coTeachers = rows;
  }

  onCoTeacherSelect(index: number, teacherId: string) {
    const rows = [...this.coTeacherRows()];
    if (!rows[index]) return;
    rows[index] = {
      ...rows[index],
      teacherId,
    };
    this.form.coTeachers = rows;
  }

  onCoTeacherRoleChange(index: number, role: ClassCoTeacherRole) {
    const rows = [...this.coTeacherRows()];
    if (!rows[index]) return;
    rows[index] = this.buildCoTeacherRow(role, {
      teacherId: rows[index].teacherId,
      note: rows[index].note,
    });
    this.form.coTeachers = rows;
  }

  availableCoTeachers(index: number): UserItem[] {
    const currentTeacherId = this.coTeacherRows()[index]?.teacherId || '';
    const reservedTeacherIds = new Set(
      this.coTeacherRows()
        .map((row, rowIndex) => (rowIndex === index ? '' : row.teacherId))
        .filter((teacherId): teacherId is string => !!teacherId),
    );
    if (this.form.teacherId) {
      reservedTeacherIds.add(this.form.teacherId);
    }
    return this.teachers().filter((teacher) =>
      teacher._id === currentTeacherId || !reservedTeacherIds.has(teacher._id),
    );
  }

  coTeacherTeacherName(coTeacher: Pick<ClassCoTeacherConfig, 'teacherId'>): string {
    return resolveMemberName(coTeacher.teacherId, this.teachers()) || 'Chua gan giao vien';
  }

  private classModeLabel(classItem: ClassItem): 'ONLINE' | 'OFFLINE' {
    return isOfflineClass(classItem) ? 'OFFLINE' : 'ONLINE';
  }

  private buildClassTableRow(
    classItem: ClassItem,
    teachers: UserItem[],
    canManage: boolean,
    saleMode: boolean,
    currentUserId: string,
  ): ClassTableRowView {
    return {
      key: classItem._id,
      item: classItem,
      mode: this.classModeLabel(classItem),
      primaryTeacherName: resolveMemberName(classItem.teacher, teachers) || classItem.teacher?.fullName || '-',
      pendingOfflineCount: this.buildPendingOfflineAssignmentCount(classItem),
      coTeacherSummaries: (classItem.coTeachers || []).map((coTeacher, index) => ({
        key: `${resolveMemberId(coTeacher.teacherId) || 'co-teacher'}-${index}`,
        name: resolveMemberName(coTeacher.teacherId, teachers) || 'Chua gan giao vien',
        roleLabel: this.coTeacherRoleLabel(coTeacher.role),
        permissionSummary: this.coTeacherPermissionSummary(coTeacher),
      })),
      studentSummaries: (classItem.students || []).map((student) => ({
        key: student._id,
        student,
        teacherDisplay: _getStudentTeacherDisplay(classItem, student._id, teachers),
        durationDisplay: _getStudentDurationDisplay(classItem, student._id, this.defaultBaseDuration),
        teacherHistory: this.buildStudentTeacherHistoryDisplay(classItem, student._id, teachers),
        durationHistory: this.buildStudentDurationHistoryDisplay(classItem, student._id),
      })),
      visibleOfflineRequests: this.buildVisibleOfflineAssignmentRequests(classItem, canManage, saleMode, currentUserId),
    };
  }

  private buildVisibleOfflineAssignmentRequests(
    classItem: ClassItem,
    canManage: boolean,
    saleMode: boolean,
    currentUserId: string,
  ): PendingOfflineAssignment[] {
    const requests = [...(classItem.pendingOfflineAssignments || [])]
      .filter((request) => request.status !== 'APPROVED')
      .sort((left, right) =>
        new Date(right.requestedAt || '').getTime() - new Date(left.requestedAt || '').getTime(),
      );
    if (canManage) {
      return requests;
    }
    if (saleMode) {
      return requests.filter((request) => this.pendingOfflineAssignmentRequestedById(request) === currentUserId);
    }
    return [];
  }

  private buildPendingOfflineAssignmentCount(classItem: ClassItem): number {
    return (classItem.pendingOfflineAssignments || [])
      .filter((request) => request.status === 'PENDING')
      .length;
  }

  coTeacherPermissionLabels(
    coTeacher: Pick<ClassCoTeacherConfig, 'canManageAttendance' | 'canManageReports' | 'canCreateLink'>,
  ): string[] {
    const labels: string[] = [];
    if (coTeacher.canManageAttendance !== false) {
      labels.push('Diem danh');
    }
    if (coTeacher.canManageReports !== false) {
      labels.push('Bao cao');
    }
    if (coTeacher.canCreateLink !== false) {
      labels.push('Tao link');
    }
    return labels;
  }

  coTeacherPermissionSummary(
    coTeacher: Pick<ClassCoTeacherConfig, 'canManageAttendance' | 'canManageReports' | 'canCreateLink'>,
  ): string {
    const labels = this.coTeacherPermissionLabels(coTeacher);
    return labels.length ? labels.join(' · ') : 'Khong cap quyen';
  }

  selectedPrimaryTeacherName(): string {
    if (!this.form.teacherId) {
      return 'Chua chon giao vien chinh';
    }
    return this.teachers().find((teacher) => teacher._id === this.form.teacherId)?.fullName || 'Da chon';
  }

  private buildCoTeacherRow(
    role: ClassCoTeacherRole = 'SUPPORT',
    overrides: Partial<CoTeacherFormRow> = {},
  ): CoTeacherFormRow {
    return {
      teacherId: '',
      role,
      note: '',
      ...this.coTeacherPermissionPreset(role),
      ...overrides,
    };
  }

  private coTeacherPermissionPreset(
    role: ClassCoTeacherRole,
  ): Pick<CoTeacherFormRow, 'canManageAttendance' | 'canManageReports' | 'canCreateLink'> {
    switch (role) {
      case 'ATTENDANCE':
        return {
          canManageAttendance: true,
          canManageReports: false,
          canCreateLink: true,
        };
      case 'REPORT':
        return {
          canManageAttendance: false,
          canManageReports: true,
          canCreateLink: false,
        };
      case 'SUPPORT':
      default:
        return {
          canManageAttendance: true,
          canManageReports: true,
          canCreateLink: true,
        };
    }
  }

  private buildCoTeacherPayload(rows: CoTeacherFormRow[]):
    | { ok: true; payload: ClassCoTeacherPayload[] }
    | { ok: false; message: string } {
    const normalizedRows = rows.map((row, index) => ({
      ...row,
      teacherId: String(row.teacherId || '').trim(),
      note: String(row.note || '').trim(),
      index,
    }));

    for (const row of normalizedRows) {
      if (!row.teacherId) {
        return { ok: false, message: 'Vui long chon giao vien phu hoac xoa dong co-teaching dang mo' };
      }
      if (row.teacherId === this.form.teacherId) {
        return { ok: false, message: 'Giao vien phu khong duoc trung voi giao vien chinh' };
      }
      if (!row.canManageAttendance && !row.canManageReports && !row.canCreateLink) {
        return { ok: false, message: 'Moi giao vien phu phai duoc cap it nhat mot quyen thao tac' };
      }
    }

    const uniqueTeacherIds = new Set<string>();
    for (const row of normalizedRows) {
      if (uniqueTeacherIds.has(row.teacherId)) {
        return { ok: false, message: 'Danh sach giao vien phu khong duoc trung lap' };
      }
      uniqueTeacherIds.add(row.teacherId);
    }

    return {
      ok: true,
      payload: normalizedRows.map((row) => ({
        teacherId: row.teacherId,
        role: row.role,
        canManageAttendance: row.canManageAttendance,
        canManageReports: row.canManageReports,
        canCreateLink: row.canCreateLink,
        note: row.note || undefined,
      })),
    };
  }

  private normalizeCoTeachers(coTeachers: ClassCoTeacherConfig[] | undefined): CoTeacherFormRow[] {
    return (coTeachers || []).slice(0, 2).map((row) =>
      this.buildCoTeacherRow(row.role || 'SUPPORT', {
        teacherId: resolveMemberId(row.teacherId),
        note: row.note || '',
        canManageAttendance: row.canManageAttendance !== false,
        canManageReports: row.canManageReports !== false,
        canCreateLink: row.canCreateLink !== false,
      }),
    );
  }

  canEditStudentConfig(classItem: ClassItem) {
    return this.canManage() || this.canSaleManageClass(classItem);
  }

  getSelectedStudentCurrentDuration(): StudentDurationSlot {
    if (!this.selectedStudentConfigClass || !this.selectedStudentConfigStudent) {
      return {
        slotIndex: 1,
        slotType: 'INITIAL',
        baseDuration: this.defaultBaseDuration,
        sessionDuration: this.defaultBaseDuration,
        totalSessions: 0,
      };
    }
    return getCurrentStudentDuration(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id, this.defaultBaseDuration);
  }

  selectedStudentTeacherSlots(): StudentTeacherSlot[] {
    if (!this.selectedStudentConfigClass || !this.selectedStudentConfigStudent) {
      return [];
    }
    const slots = sortTeacherSlots(
      getStudentConfig(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id)?.teacherSlots,
    );
    if (slots.length) {
      return slots;
    }
    return [
      {
        slotIndex: 1,
        slotType: 'INITIAL',
        teacherId: this.selectedStudentConfigClass.teacher || null,
      },
    ];
  }

  selectedStudentDurationSlots(): StudentDurationSlot[] {
    if (!this.selectedStudentConfigClass || !this.selectedStudentConfigStudent) {
      return [];
    }
    const slots = sortDurationSlots(
      getStudentConfig(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id)?.durationSlots,
    );
    if (slots.length) {
      return slots;
    }
    return [getCurrentStudentDuration(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id, this.defaultBaseDuration)];
  }

  getTeacherSlotDisplay(slot: StudentTeacherSlot): string {
    return _getTeacherSlotDisplay(slot, this.teachers());
  }

  getStudentTeacherDisplay(classItem: ClassItem, studentId: string): string {
    return _getStudentTeacherDisplay(classItem, studentId, this.teachers());
  }

  getStudentDurationDisplay(classItem: ClassItem, studentId: string): string {
    return _getStudentDurationDisplay(classItem, studentId, this.defaultBaseDuration);
  }

  getStudentTeacherHistoryDisplay(classItem: ClassItem, studentId: string): string {
    return this.buildStudentTeacherHistoryDisplay(classItem, studentId, this.teachers());
  }

  private buildStudentTeacherHistoryDisplay(classItem: ClassItem, studentId: string, teachers: UserItem[]): string {
    const slots = sortTeacherSlots(getStudentConfig(classItem, studentId)?.teacherSlots);
    if (slots.length < 2) return '';
    return slots
      .map((slot) => `GV${slot.slotIndex}: ${_getTeacherSlotDisplay(slot, teachers)}`)
      .join(' -> ');
  }

  getStudentDurationHistoryDisplay(classItem: ClassItem, studentId: string): string {
    return this.buildStudentDurationHistoryDisplay(classItem, studentId);
  }

  private buildStudentDurationHistoryDisplay(classItem: ClassItem, studentId: string): string {
    const slots = sortDurationSlots(getStudentConfig(classItem, studentId)?.durationSlots);
    if (slots.length < 2) return '';
    return slots
      .map((slot) => `Lan ${slot.slotIndex}: ${slot.sessionDuration} phut`)
      .join(' -> ');
  }

  canAppendTeacherSlot(): boolean { return this.selectedStudentTeacherSlots().length < 3; }
  canAppendDurationSlot(): boolean { return this.selectedStudentDurationSlots().length < 3; }
  nextTeacherSlotIndex(): number { return this.selectedStudentTeacherSlots().length + 1; }
  nextDurationSlotIndex(): number { return this.selectedStudentDurationSlots().length + 1; }

  availableStudentConfigTeachers(): UserItem[] {
    const classItem = this.selectedStudentConfigClass;
    if (!classItem) {
      return [];
    }
    const saleId = classItem.sale?._id || (this.isSale() ? this.currentUserId() : '');
    if (!saleId) {
      return this.teachers();
    }

    const allowedTeacherIds = new Set(
      this.teacherProfiles()
        .filter((profile) => {
          const managedSales = (profile.managedSales || []).map((sale) =>
            typeof sale === 'string' ? sale : sale._id,
          );
          const teacherId = typeof profile.userId === 'string' ? profile.userId : profile.userId?._id;
          return managedSales.includes(saleId) || teacherId === classItem.teacher?._id;
        })
        .map((profile) => (typeof profile.userId === 'string' ? profile.userId : profile.userId?._id || ''))
        .filter((teacherId): teacherId is string => !!teacherId),
    );

    const filtered = this.teachers().filter((teacher) => allowedTeacherIds.has(teacher._id));
    if (filtered.length) {
      return filtered;
    }

    return classItem.teacher
      ? this.teachers().filter((teacher) => teacher._id === classItem.teacher?._id)
      : this.teachers();
  }

  getModalTitle(): string {
    if (this.isSaleDurationEditMode()) return 'Gui yeu cau doi thoi luong lop hoc';
    if (this.isSaleConfigEditMode()) return 'Gui yeu cau doi giao vien va luong GV';
    if (this.isSaleAssignMode()) return 'Chon hoc vien vao lop';
    if (this.isSaleOfflineExistingMode()) return 'Gui yeu cau them hoc sinh vao lop offline';
    return this.editingId ? 'Chinh sua lop hoc' : 'Them lop hoc';
  }

  availableSaleInvoices(): InvoiceItem[] {
    const pendingOfflineInvoiceIds = new Set(
      this.saleOfflineOptions()
        .flatMap((classItem) => classItem.pendingOfflineAssignments || [])
        .filter((request) =>
          request.status === 'PENDING' && this.pendingOfflineAssignmentRequestedById(request) === this.currentUserId(),
        )
        .map((request) => this.pendingOfflineAssignmentInvoiceId(request))
        .filter((invoiceId): invoiceId is string => !!invoiceId),
    );
    return this.invoices().filter((invoice) => {
      const isApproved = invoice.status === 'APPROVED' || invoice.status === 'PAID';
      return isApproved && !getInvoiceClassId(invoice) && !pendingOfflineInvoiceIds.has(invoice._id);
    });
  }

  visibleOfflineAssignmentRequests(classItem: ClassItem): PendingOfflineAssignment[] {
    return this.buildVisibleOfflineAssignmentRequests(
      classItem,
      this.canManage(),
      this.isSale(),
      this.currentUserId(),
    );
  }

  pendingOfflineAssignmentCount(classItem: ClassItem): number {
    return this.buildPendingOfflineAssignmentCount(classItem);
  }

  trackTeacherFilterOption(_index: number, teacher: TeacherFilterOption): string {
    return teacher.id;
  }

  trackClassRow(_index: number, row: ClassTableRowView): string {
    return row.key;
  }

  trackCoTeacherSummary(_index: number, coTeacher: ClassCoTeacherSummaryView): string {
    return coTeacher.key;
  }

  trackStudentSummary(_index: number, studentSummary: ClassStudentSummaryView): string {
    return studentSummary.key;
  }

  trackOfflineRequest(_index: number, request: PendingOfflineAssignment): string {
    return request._id;
  }

  pendingOfflineAssignmentRequestedById(request: PendingOfflineAssignment): string {
    return resolveMemberId(request.requestedBy);
  }

  pendingOfflineAssignmentRequestedByName(request: PendingOfflineAssignment): string {
    return resolveMemberName(request.requestedBy, this.sales()) || 'Sale';
  }

  pendingOfflineAssignmentReviewerName(request: PendingOfflineAssignment): string {
    return resolveMemberName(request.reviewedBy, [...this.sales(), ...this.teachers()]) || 'Quan ly';
  }

  pendingOfflineAssignmentInvoiceId(request: PendingOfflineAssignment): string {
    const invoice = request.invoiceId;
    if (!invoice) return '';
    return typeof invoice === 'string' ? invoice : invoice._id || '';
  }

  pendingOfflineAssignmentInvoiceNumber(request: PendingOfflineAssignment): string {
    const invoice = request.invoiceId;
    if (!invoice) return '';
    return typeof invoice === 'string' ? invoice : invoice.invoiceNumber || '';
  }

  pendingOfflineAssignmentStudentSummary(request: PendingOfflineAssignment): string {
    const students = request.studentIds || [];
    if (!students.length) {
      return 'Khong ro hoc sinh';
    }
    return students
      .map((student: any) => {
        if (typeof student === 'string') {
          return student;
        }
        return `${student.fullName}${student.studentCode ? ` (${student.studentCode})` : ''}`;
      })
      .join(', ');
  }

  pendingOfflineAssignmentStatusLabel(request: PendingOfflineAssignment): string {
    switch (request.status) {
      case 'REJECTED':
        return 'Da tu choi';
      case 'APPROVED':
        return 'Da duyet';
      case 'PENDING':
      default:
        return 'Cho duyet';
    }
  }

  pendingOfflineAssignmentStatusClass(request: PendingOfflineAssignment): string {
    switch (request.status) {
      case 'REJECTED':
        return 'rejected';
      case 'APPROVED':
        return 'approved';
      case 'PENDING':
      default:
        return 'pending';
    }
  }

  async approveOfflineAssignmentRequest(classItem: ClassItem, request: PendingOfflineAssignment) {
    if (!confirm(`Duyet yeu cau them hoc sinh vao lop ${classItem.name}?`)) {
      return;
    }
    const result = await this.classService.approvePendingOfflineAssignment(classItem._id, request._id);
    if (!result.ok) {
      alert(result.message || 'Khong the duyet yeu cau them hoc sinh');
      return;
    }
    await this.reload();
  }

  async rejectOfflineAssignmentRequest(classItem: ClassItem, request: PendingOfflineAssignment) {
    const reason = prompt('Ly do tu choi yeu cau (co the bo trong):', request.rejectionReason || '');
    if (reason === null) {
      return;
    }
    const result = await this.classService.rejectPendingOfflineAssignment(classItem._id, request._id, reason || undefined);
    if (!result.ok) {
      alert(result.message || 'Khong the tu choi yeu cau them hoc sinh');
      return;
    }
    await this.reload();
  }

  selectedInvoice(): InvoiceItem | undefined {
    if (!this.form.invoiceId) return undefined;
    return this.invoices().find((invoice) => invoice._id === this.form.invoiceId);
  }

  availableProductPackages(): ProductItem[] {
    return this.products().filter((product) => matchesProductMode(product, this.form.classMode));
  }

  availableOfflineNameProducts(): ProductItem[] {
    return this.products().filter((product) => matchesProductMode(product, 'OFFLINE'));
  }

  canSelectOfflineClassName(): boolean {
    return this.form.classMode === 'OFFLINE'
      && !this.isSaleAssignMode()
      && !this.isSaleDurationEditMode()
      && !this.isSaleConfigEditMode()
      && !this.isSaleOfflineExistingMode();
  }

  selectedOfflineNameProductId(): string {
    if (this.form.classMode !== 'OFFLINE') {
      return '';
    }
    if (this.findOfflineNameProductById(this.form.productPackageId)) {
      return this.form.productPackageId;
    }
    return this.findOfflineNameProductByName(this.form.name)?._id || '';
  }

  onOfflineNameProductChange(productId: string) {
    const selectedProduct = this.findOfflineNameProductById(productId);
    this.form.productPackageId = selectedProduct?._id || '';
    this.form.name = selectedProduct?.name || '';
  }

  onInvoiceChange(invoiceId: string) {
    this.form.invoiceId = invoiceId || '';
    this.submitLabel = this.isSaleOfflineExistingMode() ? 'Gui yeu cau' : 'Luu';
    const invoice = this.invoices().find((item) => item._id === invoiceId);
    if (!invoice) {
      this.form.studentIds = [];
      this.resetSaleOfflineSelection();
      return;
    }

    const studentName = invoice.studentId?.fullName?.trim() || '';
    const studentCode = invoice.studentId?.studentCode?.trim() || '';
    this.form.saleId = this.currentUserId();
    this.form.classMode = invoice.classType || 'ONLINE';
    this.submitLabel = this.form.classMode === 'OFFLINE' ? 'Gui yeu cau' : 'Luu';
    this.form.studentIds = invoice.studentId?._id ? [invoice.studentId._id] : [];

    if (this.form.classMode === 'OFFLINE') {
      this.resetSaleOfflineSelection();
      return;
    }

    this.form.existingOfflineClassId = '';
    this.form.code = (invoice.invoiceNumber || '').trim().toUpperCase();
    this.form.name = studentName ? `Lop ${studentName}` : this.form.name;
    this.codeSearch = studentCode && studentName ? `${studentCode} - ${studentName}` : this.form.code;

    if (typeof invoice.pricePerSession === 'number' && invoice.pricePerSession > 0) {
      this.form.pricePerSession = invoice.pricePerSession;
    }
    if (typeof invoice.referenceDuration === 'number' && invoice.referenceDuration > 0) {
      this.form.baseDuration = invoice.referenceDuration;
      this.form.sessionDuration = this.form.sessionDuration || this.defaultBaseDuration;
    }
    if (typeof invoice.teacherPayPerSession === 'number' && invoice.teacherPayPerSession > 0) {
      this.form.teacherPayPerSession = invoice.teacherPayPerSession;
    }

    if (invoice.productId) {
      this.form.productPackageId = invoice.productId;
    }
    this.syncProductPackageSelection();
  }

  private resolveStudentProductPackage(studentId: string): ProductItem | undefined {
    const productPackageId = this.students().find((student) => student._id === studentId)?.productPackage?._id;
    if (!productPackageId) {
      return undefined;
    }
    return this.products().find((product) => product._id === productPackageId);
  }

  private syncProductPackageSelection() {
    const selectedProduct = this.products().find((product) => product._id === this.form.productPackageId);
    if (matchesProductMode(selectedProduct, this.form.classMode)) {
      if (this.form.classMode === 'OFFLINE') {
        this.form.name = selectedProduct.name || this.form.name;
      }
      return;
    }

    const namedOfflineProduct = this.form.classMode === 'OFFLINE'
      ? this.findOfflineNameProductByName(this.form.name)
      : undefined;
    if (namedOfflineProduct) {
      this.form.productPackageId = namedOfflineProduct._id;
      this.form.name = namedOfflineProduct.name || this.form.name;
      return;
    }

    const invoiceProduct = this.products().find((product) => product._id === this.selectedInvoice()?.productId);
    if (matchesProductMode(invoiceProduct, this.form.classMode)) {
      this.form.productPackageId = invoiceProduct._id;
      if (this.form.classMode === 'OFFLINE') {
        this.form.name = invoiceProduct.name || this.form.name;
      }
      return;
    }

    const studentProduct = this.form.studentIds
      .map((studentId) => this.resolveStudentProductPackage(studentId))
      .find((product): product is ProductItem => matchesProductMode(product, this.form.classMode));

    this.form.productPackageId = studentProduct?._id || '';
    if (this.form.classMode === 'OFFLINE' && studentProduct?.name) {
      this.form.name = studentProduct.name;
    }
  }

  private findOfflineNameProductById(productId?: string | null): ProductItem | undefined {
    return this.availableOfflineNameProducts().find((product) => product._id === String(productId || ''));
  }

  private findOfflineNameProductByName(name?: string | null): ProductItem | undefined {
    const normalizedName = String(name || '').trim().toLowerCase();
    if (!normalizedName) {
      return undefined;
    }
    return this.availableOfflineNameProducts().find(
      (product) => String(product.name || '').trim().toLowerCase() === normalizedName,
    );
  }

  teacherBaseForForm(): number {
    return this.form.classMode === 'OFFLINE'
      ? (this.form.teacherPayPerStudent || 0)
      : (this.form.teacherPayPerSession || 0);
  }

  calcProportional(basePrice: number | undefined, targetDuration: number): number {
    return _calcProportional(basePrice, targetDuration, this.form.baseDuration, this.defaultBaseDuration);
  }

  calcTeacherProportional(basePay: number | undefined, targetDuration: number): number {
    return _calcTeacherProportional(basePay, targetDuration, this.form.baseDuration, this.defaultBaseDuration);
  }

  getOfflineStudentCount(): number {
    if (!this.isSaleOfflineExistingMode()) {
      return this.selectedStudents().length;
    }

    const selectedClass = this.selectedSaleOfflineClass();
    if (!selectedClass) {
      return this.selectedStudents().length;
    }

    const existingStudentIds = new Set((selectedClass.students || []).map((student) => student._id));
    const existingCount = selectedClass.studentCount ?? existingStudentIds.size;
    const additionalCount = this.form.studentIds.filter((studentId) => !existingStudentIds.has(studentId)).length;
    return existingCount + additionalCount;
  }

  getOfflineEstimatedRevenue(): number {
    const perStudentCharge = this.calcProportional(
      this.form.pricePerSession,
      this.form.sessionDuration || this.defaultBaseDuration,
    );
    return perStudentCharge * this.getOfflineStudentCount();
  }

  getOfflineTeacherPayoutEstimate(): number {
    const attendedCount = this.getOfflineStudentCount();
    if (attendedCount <= 0) return 0;
    return Math.max(
      200_000,
      roundMoneyDownToThousand(attendedCount * (this.form.teacherPayPerStudent || 0)),
    );
  }
}
