import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ClassItem,
  ClassCoTeacherConfig,
  ClassCoTeacherPayload,
  ClassCoTeacherRole,
  ClassMember,
  ClassPayload,
  ClassService,
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

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './classes.component.html',
  styleUrls: ['./classes.component.css'],
})
export class ClassesComponent {
  readonly defaultBaseDuration = 70;
  classes = signal<ClassItem[]>([]);
  saleOfflineOptions = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  teacherProfiles = signal<TeacherProfile[]>([]);
  sales = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  products = signal<ProductItem[]>([]);
  invoices = signal<InvoiceItem[]>([]);
  studentSearch = '';
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

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private studentService: StudentService,
    private productService: ProductService,
    private invoiceService: InvoiceService,
    private teacherService: TeacherService,
    private auth: AuthService,
  ) {
    this.loadLookups();
    this.reload();
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

  async reload() {
    const [data, invoicesList, saleOfflineOpts] = await Promise.all([
      this.classService.list(),
      this.isSale() ? this.invoiceService.list() : Promise.resolve([] as InvoiceItem[]),
      this.isSale() ? this.classService.listSaleOfflineOptions() : Promise.resolve([] as ClassItem[]),
    ]);
    this.classes.set(data);
    this.saleOfflineOptions.set(saleOfflineOpts);
    if (this.editingId) {
      this.editingClass.set(data.find((item) => item._id === this.editingId) || null);
    }
    if (this.isSale()) {
      this.invoices.set(invoicesList);
    }
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
    this.submitLabel = this.isSaleOfflineExistingMode() ? 'Them vao lop' : 'Luu';
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
      this.reload();
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
      this.reload();
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
      this.reload();
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

      this.closeModal();
      this.reload();
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
    this.reload();
  }

  edit(classItem: ClassItem, mode: 'config' | 'assign' | 'duration' = 'config') {
    if (this.isSale() && !this.canSaleAssign(classItem)) return;
    this.editingId = classItem._id;
    this.editingClass.set(classItem);
    this.editMode = this.isSale() ? mode : 'config';
    const classStudentIds = classItem.students?.map((s) => s._id) || [];
    const myStudents = new Set(this.students().map((s) => s._id));
    const pendingConfigChanges = this.isSale() && mode === 'config' && classItem.pendingSaleUpdate?.requestType !== 'DURATION_CHANGE'
      ? classItem.pendingSaleUpdate?.requestedChanges || {}
      : {};
    const pendingDurationChanges = this.isSale() && mode === 'duration'
      ? classItem.pendingSaleUpdate?.requestedChanges || {}
      : {};
    const pendingTeacherId = String(pendingConfigChanges['teacherId'] || '');
    const pendingTeacherPayPerSession = Number(pendingConfigChanges['teacherPayPerSession']);
    const pendingTeacherPayPerStudent = Number(pendingConfigChanges['teacherPayPerStudent']);
    const pendingBaseDuration = Number(pendingDurationChanges['baseDuration']);
    const pendingSessionDuration = Number(pendingDurationChanges['sessionDuration']);

    this.form = {
      name: classItem.name,
      code: classItem.code,
      teacherId: pendingTeacherId || classItem.teacher?._id || '',
      coTeachers: this.normalizeCoTeachers(classItem.coTeachers),
      saleId: classItem.sale?._id || '',
      invoiceId: '',
      existingOfflineClassId: '',
      productPackageId: classItem.productPackage?._id || '',
      classMode: classItem.classMode || 'ONLINE',
      studentIds: this.isSale() ? classStudentIds.filter((id) => myStudents.has(id)) : classStudentIds,
      pricePerSession: classItem.pricePerSession || 0,
      teacherPayPerSession: Number.isFinite(pendingTeacherPayPerSession) && pendingTeacherPayPerSession >= 0
        ? pendingTeacherPayPerSession
        : (classItem.teacherPayPerSession || 0),
      teacherPayPerStudent: Number.isFinite(pendingTeacherPayPerStudent) && pendingTeacherPayPerStudent >= 0
        ? pendingTeacherPayPerStudent
        : (classItem.teacherPayPerStudent || 0),
      baseDuration: Number.isFinite(pendingBaseDuration) && pendingBaseDuration > 0
        ? pendingBaseDuration
        : (classItem.baseDuration || this.defaultBaseDuration),
      sessionDuration: Number.isFinite(pendingSessionDuration) && pendingSessionDuration > 0
        ? pendingSessionDuration
        : (classItem.sessionDuration || this.defaultBaseDuration),
      revenuePerStudent: classItem.revenuePerStudent || 0,
      teacherSalaryCost: classItem.teacherSalaryCost || 0,
    };

    this.error.set('');
    this.studentSearch = '';
    this.codeSearch = classItem.code;
    this.showCodeDropdown = false;
    this.submitLabel = this.isSaleAssignMode()
      ? 'Them hoc vien'
      : this.isSaleDurationEditMode()
        ? 'Gui Director duyet'
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
    this.reload();
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

  canSaleAssign(classItem: ClassItem) {
    const current = this.auth.userSignal();
    return current?.role === 'SALE' && classItem.sale?._id === current.sub;
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
    return this.canManage() || this.canSaleAssign(classItem);
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
    const slots = sortTeacherSlots(getStudentConfig(classItem, studentId)?.teacherSlots);
    if (slots.length < 2) return '';
    return slots
      .map((slot) => `GV${slot.slotIndex}: ${this.getTeacherSlotDisplay(slot)}`)
      .join(' -> ');
  }

  getStudentDurationHistoryDisplay(classItem: ClassItem, studentId: string): string {
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
    if (this.isSaleOfflineExistingMode()) return 'Them hoc sinh vao lop offline co san';
    return this.editingId ? 'Chinh sua lop hoc' : 'Them lop hoc';
  }

  availableSaleInvoices(): InvoiceItem[] {
    return this.invoices().filter((invoice) => {
      const isApproved = invoice.status === 'APPROVED' || invoice.status === 'PAID';
      return isApproved && !getInvoiceClassId(invoice);
    });
  }

  selectedInvoice(): InvoiceItem | undefined {
    if (!this.form.invoiceId) return undefined;
    return this.invoices().find((invoice) => invoice._id === this.form.invoiceId);
  }

  availableProductPackages(): ProductItem[] {
    return this.products().filter((product) => matchesProductMode(product, this.form.classMode));
  }

  onInvoiceChange(invoiceId: string) {
    this.form.invoiceId = invoiceId || '';
    this.submitLabel = this.isSaleOfflineExistingMode() ? 'Them vao lop' : 'Luu';
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
    this.submitLabel = this.form.classMode === 'OFFLINE' ? 'Them vao lop' : 'Luu';
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
      return;
    }

    const invoiceProduct = this.products().find((product) => product._id === this.selectedInvoice()?.productId);
    if (matchesProductMode(invoiceProduct, this.form.classMode)) {
      this.form.productPackageId = invoiceProduct._id;
      return;
    }

    const studentProduct = this.form.studentIds
      .map((studentId) => this.resolveStudentProductPackage(studentId))
      .find((product): product is ProductItem => matchesProductMode(product, this.form.classMode));

    this.form.productPackageId = studentProduct?._id || '';
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
