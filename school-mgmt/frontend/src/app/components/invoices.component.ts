import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  INVOICE_COURSE_STATUS_LABELS,
  InvoiceCourseStatus,
  InvoiceManagementSummary,
  InvoiceItem,
  InvoiceService,
  InvoiceUpsertPayload,
} from '../services/invoice.service';
import { StudentItem, StudentService } from '../services/student.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { ClassItem, ClassService } from '../services/class.service';
import { environment } from '../../environments/environment';
import { FlowGuideComponent } from './shared/flow-guide.component';
import {
  InvoiceForm,
  blankForm,
  formatClassCodeOption as _formatClassCodeOption,
  formatClassOption as _formatClassOption,
  formatCurrency as _formatCurrency,
  formatDate as _formatDate,
  formatRegisteredSessions as _formatRegisteredSessions,
  getCourseStatusText as _getCourseStatusText,
  getImageUrl as _getImageUrl,
  getInvoiceClassLabel as _getInvoiceClassLabel,
  getStatusClass as _getStatusClass,
  getStatusText as _getStatusText,
  methodLabel as _methodLabel,
} from './invoices.utils';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesComponent {
  private readonly defaultSummary: InvoiceManagementSummary = {
    total: 0,
    onlineAmount: 0,
    offlineAmount: 0,
    approvedAmount: 0,
    pendingCount: 0,
  };

  items = signal<InvoiceItem[]>([]);
  students = signal<StudentItem[]>([]);
  sales = signal<UserItem[]>([]);
  classes = signal<ClassItem[]>([]);
  loading = signal(false);
  lookupsLoading = signal(false);
  lookupsLoaded = signal(false);
  summary = signal<InvoiceManagementSummary>({ ...this.defaultSummary });
  totalItems = signal(0);
  totalPages = signal(1);
  currentPage = signal(1);
  readonly pageSizeOptions = [25, 50, 100];
  pageSize = signal(25);

  // Filter signals
  keyword = signal('');
  parentFilter = signal('');
  saleFilter = signal('');
  classTypeFilter = signal('');
  statusFilter = signal('');
  courseStatusFilter = signal('');
  dateFrom = signal('');
  dateTo = signal('');

  activeTab: 'invoices' | 'topups' = 'invoices';
  showModal = signal(false);
  showApproveModal = signal(false);
  modalImage = signal('');
  error = signal('');
  uploadError = signal('');
  uploading = signal(false);
  approveUploadError = signal('');
  approveUploading = signal(false);
  form: InvoiceForm = blankForm();
  approveImage = '';

  canDeleteInvoices = false;
  canApproveInvoices = false;
  isSale = false;
  currentUserId = '';
  currentUserName = '';
  editingInvoice: InvoiceItem | null = null;
  approvingInvoice = signal<InvoiceItem | null>(null);
  readonly courseStatusOptions = Object.entries(INVOICE_COURSE_STATUS_LABELS).map(([value, label]) => ({
    value: value as InvoiceCourseStatus,
    label,
  }));

  pendingTopUps = signal<any[]>([]);
  loadingTopUps = signal(false);

  // Bind utility functions for template access
  formatCurrency = _formatCurrency;
  formatDate = _formatDate;
  formatRegisteredSessions = _formatRegisteredSessions;
  getInvoiceClassLabel = _getInvoiceClassLabel;
  formatClassOption = _formatClassOption;
  formatClassCodeOption = _formatClassCodeOption;
  getStatusText = _getStatusText;
  getCourseStatusText = _getCourseStatusText;
  getStatusClass = _getStatusClass;
  getImageUrl = _getImageUrl;
  methodLabel = _methodLabel;

  constructor(
    private invoiceService: InvoiceService,
    private studentService: StudentService,
    private userService: UserService,
    private classService: ClassService,
    private auth: AuthService,
    private http: HttpClient,
  ) {
    void this.reload();

    const user = this.auth.userSignal();
    const role = user?.role;
    this.canDeleteInvoices = role === 'DIRECTOR';
    this.canApproveInvoices = role === 'DIRECTOR' || role === 'ACCOUNTING';
    this.isSale = role === 'SALE';
    this.currentUserId = user?.sub || '';
    this.currentUserName = user?.fullName || '';

    if (this.canApproveInvoices) {
      void this.loadPendingTopUps();
    }
  }

  // Computed: selected student for parent info display in form
  get selectedStudent(): StudentItem | null {
    return this.students().find(s => s._id === this.form.studentId) ?? null;
  }

  get availableClassOptions(): ClassItem[] {
    const selectedStudentId = this.form.studentId;
    if (!selectedStudentId) {
      return [];
    }

    return this.classes()
      .filter((item) => {
        return Array.isArray(item.students)
          && item.students.some((student) => student?._id === selectedStudentId);
      })
      .sort((left, right) =>
        this.formatClassOption(left).localeCompare(this.formatClassOption(right), 'vi', {
          sensitivity: 'base',
        }),
      );
  }

  hasActiveFilters = computed(() =>
    !!this.keyword() || !!this.parentFilter() || !!this.saleFilter() ||
    !!this.classTypeFilter() || !!this.statusFilter() ||
    !!this.courseStatusFilter() ||
    !!this.dateFrom() || !!this.dateTo()
  );

  onKeywordChange(value: string): void {
    this.keyword.set(value);
  }

  onParentFilterChange(value: string): void {
    this.parentFilter.set(value);
  }

  onSaleFilterChange(value: string): void {
    this.saleFilter.set(value);
  }

  onClassTypeFilterChange(value: string): void {
    this.classTypeFilter.set(value);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value);
  }

  onCourseStatusFilterChange(value: string): void {
    this.courseStatusFilter.set(value);
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
  }

  async clearFilters(): Promise<void> {
    this.keyword.set('');
    this.parentFilter.set('');
    this.saleFilter.set('');
    this.classTypeFilter.set('');
    this.statusFilter.set('');
    this.courseStatusFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(1);
    await this.reload();
  }

  invoiceSessionCount(invoice: InvoiceItem): number {
    return Math.max(0, Number(invoice.sessions || 0))
      + Math.max(0, Number(invoice.bonusSessions || 0))
      + Math.max(0, Number(invoice.trialSessions || 0));
  }

  invoiceClassTotalSessions(invoice: InvoiceItem): string {
    const total = Number(invoice.totalSessionsByStudentClass || 0);
    return total && total > 0 ? String(total) : '-';
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.invoiceService.listManagement({
        keyword: this.keyword().trim(),
        parentKeyword: this.parentFilter().trim(),
        saleKeyword: this.saleFilter().trim(),
        classType: (this.classTypeFilter() || undefined) as 'ONLINE' | 'OFFLINE' | undefined,
        status: (this.statusFilter() || undefined) as any,
        courseStatus: (this.courseStatusFilter() || undefined) as InvoiceCourseStatus | undefined,
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined,
        page: this.currentPage(),
        limit: this.pageSize(),
      });
      this.items.set(response.data || []);
      this.summary.set(response.summary || { ...this.defaultSummary });
      this.totalItems.set(Number(response.meta?.total || 0));
      this.totalPages.set(Math.max(1, Number(response.meta?.totalPages || 1)));
      this.currentPage.set(Number(response.meta?.page || 1));
    } finally {
      this.loading.set(false);
    }
  }

  async loadLookups(): Promise<void> {
    if (this.lookupsLoaded() || this.lookupsLoading()) {
      return;
    }

    this.lookupsLoading.set(true);
    try {
      const [studs, salesList, classList] = await Promise.all([
        this.studentService.list(),
        this.userService.listSales(),
        this.classService.list(),
      ]);
      this.students.set(studs);
      this.sales.set(salesList);
      this.classes.set(classList);
      this.lookupsLoaded.set(true);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  async applyFilters(): Promise<void> {
    this.currentPage.set(1);
    await this.reload();
  }

  async onPageSizeChange(value: number): Promise<void> {
    this.pageSize.set(Number(value) || 25);
    this.currentPage.set(1);
    await this.reload();
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.currentPage.set(page);
    await this.reload();
  }

  trackInvoiceById(_index: number, invoice: InvoiceItem): string {
    return invoice._id;
  }

  onStudentChange(): void {
    this.ensureSelectedClassStillValid();
    this.autoPickSingleClassOption();
  }

  onClassTypeChange(_: 'ONLINE' | 'OFFLINE' | ''): void {
    this.syncClassTypeFromSelectedClass();
  }

  onClassChange(classId: string): void {
    this.form.classId = classId || '';
    if (!this.form.classId) {
      return;
    }

    const selectedClass = this.classes().find((item) => item._id === this.form.classId);
    const classMode = selectedClass?.classMode;
    if (classMode === 'ONLINE' || classMode === 'OFFLINE') {
      this.form.classType = classMode;
    }
  }

  async openModal(): Promise<void> {
    await this.loadLookups();
    this.editingInvoice = null;
    this.form = blankForm();
    // Pre-fill sale for SALE role
    if (this.isSale) {
      this.form.saleId = this.currentUserId;
    }
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  async edit(invoice: InvoiceItem): Promise<void> {
    if (!this.canEditInvoice(invoice)) {
      return;
    }
    await this.loadLookups();
    this.editingInvoice = invoice;
    this.form = {
      invoiceNumber: invoice.invoiceNumber,
      courseStatus: invoice.courseStatus || 'NEW',
      studentId: invoice.studentId._id,
      classId: this.extractClassId(invoice.classId),
      classType: (invoice.classType as 'ONLINE' | 'OFFLINE') || '',
      saleId: invoice.saleId?._id || '',
      sessions: invoice.sessions || 0,
      bonusSessions: invoice.bonusSessions || 0,
      trialSessions: (invoice as any).trialSessions || 0,
      paymentRound: invoice.paymentRound || 0,
      amount: invoice.amount,
      paymentDate: invoice.paymentDate.split('T')[0],
      description: invoice.description || '',
      receiptImage: invoice.receiptImage || '',
    };
    this.error.set('');
    this.uploadError.set('');
    this.uploading.set(false);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  async submit(): Promise<void> {
    if (this.editingInvoice && !this.canEditInvoice(this.editingInvoice)) {
      this.error.set('Hóa đơn đã duyệt hoặc không còn thuộc quyền sửa của bạn');
      return;
    }

    if (!this.form.classType) {
      this.error.set('Vui lòng chọn loại lớp học (Online hoặc Offline)');
      return;
    }

    const payload: InvoiceUpsertPayload = {
      invoiceNumber: this.form.invoiceNumber.trim(),
      courseStatus: this.form.courseStatus,
      studentId: this.form.studentId,
      classType: this.form.classType,
      amount: Number(this.form.amount),
      paymentDate: this.form.paymentDate,
    };

    if (this.form.sessions > 0) payload.sessions = Number(this.form.sessions);
    if (this.form.bonusSessions > 0) payload.bonusSessions = Number(this.form.bonusSessions);
    if (this.form.trialSessions > 0) payload.trialSessions = Number(this.form.trialSessions);
    if (this.form.paymentRound > 0) payload.paymentRound = Number(this.form.paymentRound);
    if (this.form.classId) payload.classId = this.form.classId;
    if (this.form.saleId) payload.saleId = this.form.saleId;
    if (this.form.receiptImage) payload.receiptImage = this.form.receiptImage.trim();
    if (this.form.description) payload.description = this.form.description.trim();

    const result = this.editingInvoice
      ? await this.invoiceService.update(this.editingInvoice._id, payload)
      : await this.invoiceService.create(payload);

    if (!result.ok) {
      this.error.set(result.message || (this.editingInvoice ? 'Không thể cập nhật hóa đơn' : 'Không thể tạo hóa đơn'));
      return;
    }

    this.closeModal();
    await this.reload();
  }

  openApproveModal(invoice: InvoiceItem): void {
    this.approvingInvoice.set(invoice);
    this.approveImage = '';
    this.approveUploadError.set('');
    this.approveUploading.set(false);
    this.showApproveModal.set(true);
  }

  closeApproveModal(): void {
    this.showApproveModal.set(false);
    this.approvingInvoice.set(null);
    this.approveImage = '';
    this.approveUploadError.set('');
    this.approveUploading.set(false);
  }

  async handleApproveImageChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.approveUploadError.set('');
    this.approveUploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.approveUploading.set(false);

    if (!result.ok || !result.url) {
      this.approveUploadError.set(result.message || 'Tải hóa đơn đối ứng thất bại');
      return;
    }

    this.approveImage = result.url;
  }

  async confirmApprove(): Promise<void> {
    const invoice = this.approvingInvoice();
    if (!invoice) return;
    this.approveUploadError.set('');
    const approvalProofRequired = this.isApprovalProofRequired(invoice);

    if (approvalProofRequired && !invoice.receiptImage) {
      this.approveUploadError.set('Vui lòng bổ sung hóa đơn sale upload trước khi duyệt');
      return;
    }

    if (approvalProofRequired && !this.approveImage) {
      this.approveUploadError.set('Vui lòng tải hóa đơn đối ứng trước khi duyệt');
      return;
    }

    if (!confirm(`Duyệt hóa đơn ${invoice.invoiceNumber}? Ví phụ huynh chỉ được cộng sau khi đối chiếu đủ hóa đơn sale và hóa đơn đối ứng.`)) return;

    const result = await this.invoiceService.approve(
      invoice._id,
      'APPROVE',
      undefined,
      approvalProofRequired ? this.approveImage : undefined,
    );
    if (!result.ok) {
      this.approveUploadError.set(result.message || 'Không thể duyệt hóa đơn');
      return;
    }

    this.closeApproveModal();
    await this.reload();
  }

  async reject(invoice: InvoiceItem): Promise<void> {
    const reason = prompt(`Lý do từ chối hóa đơn ${invoice.invoiceNumber}:`, '');
    if (reason === null) return;

    const result = await this.invoiceService.approve(invoice._id, 'REJECT', reason.trim() || undefined);
    if (!result.ok) {
      alert(result.message || 'Không thể từ chối hóa đơn');
      return;
    }
    await this.reload();
  }

  async cancel(invoice: InvoiceItem): Promise<void> {
    const reason = prompt(`Ly do huy hoa don ${invoice.invoiceNumber}:`, 'Hoan tac hoa don');
    if (reason === null) return;

    const result = await this.invoiceService.cancel(invoice._id, reason.trim() || undefined);
    if (!result.ok) {
      alert(result.message || 'Khong the huy hoa don');
      return;
    }

    alert(`Da huy hoa don ${invoice.invoiceNumber}.`);
    await this.reload();
  }

  async remove(invoice: InvoiceItem): Promise<void> {
    if (!confirm(`Xóa hóa đơn ${invoice.invoiceNumber}?`)) return;

    const result = await this.invoiceService.remove(invoice._id);
    if (!result.ok) {
      alert(result.message || 'Không thể xóa hóa đơn');
      return;
    }
    await this.reload();
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set('');
    this.uploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.uploading.set(false);

    if (!result.ok || !result.url) {
      this.uploadError.set(result.message || 'Tải ảnh thất bại');
      return;
    }
    this.form.receiptImage = result.url;
  }

  canEditInvoice(invoice: InvoiceItem): boolean {
    const role = this.auth.userSignal()?.role;
    if (role === 'SALE') {
      return invoice.createdBy?._id === this.currentUserId
        && invoice.status === 'PENDING_APPROVAL';
    }
    return role === 'DIRECTOR' || role === 'ACCOUNTING';
  }

  canCancelInvoice(invoice: InvoiceItem): boolean {
    return this.canApproveInvoices && ['APPROVED', 'PAID'].includes(invoice.status);
  }

  isApprovalProofRequired(invoice: InvoiceItem | null | undefined): boolean {
    if (!invoice) return true;
    return !(
      invoice.classType === 'OFFLINE'
      && Number(invoice.amount || 0) === 0
      && Number(invoice.trialSessions || 0) > 0
    );
  }

  showImageModal(imageUrl: string): void {
    this.modalImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.modalImage.set('');
  }

  private ensureSelectedClassStillValid(): void {
    if (!this.form.studentId) {
      this.form.classId = '';
      return;
    }
    if (!this.form.classId) {
      return;
    }
    const stillValid = this.availableClassOptions.some((item) => item._id === this.form.classId);
    if (!stillValid) {
      this.form.classId = '';
    }
  }

  private autoPickSingleClassOption(): void {
    if (this.form.classId) {
      this.syncClassTypeFromSelectedClass();
      return;
    }
    if (this.availableClassOptions.length === 1) {
      this.onClassChange(this.availableClassOptions[0]._id);
    }
  }

  private syncClassTypeFromSelectedClass(): void {
    if (!this.form.classId) {
      return;
    }
    const selectedClass = this.classes().find((item) => item._id === this.form.classId);
    const classMode = selectedClass?.classMode;
    if (classMode === 'ONLINE' || classMode === 'OFFLINE') {
      this.form.classType = classMode;
    }
  }

  private extractClassId(value?: InvoiceItem['classId']): string {
    if (!value) return '';
    return typeof value === 'string' ? value : value._id || '';
  }

  // Pending top-up management

  async loadPendingTopUps(): Promise<void> {
    this.loadingTopUps.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<any[]>(`${environment.apiBase}/wallets/top-up/pending`, { withCredentials: true }),
      );
      this.pendingTopUps.set(data || []);
    } catch {
      this.pendingTopUps.set([]);
    } finally {
      this.loadingTopUps.set(false);
    }
  }

  async approveTopUpRequest(req: any): Promise<void> {
    const isBankTransfer = req.paymentMethod === 'BANK_TRANSFER';
    if (isBankTransfer && !req.receiptImageUrl) {
      alert('Yêu cầu chuyển khoản thiếu ảnh biên lai, không thể duyệt.');
      return;
    }

    let notes = '';
    if (isBankTransfer) {
      const input = prompt('Mã sao kê / ghi chú xác nhận (tùy chọn):');
      if (input === null) return;
      notes = input;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/wallets/top-up/${req._id}/approve`,
          {
            bankMatched: isBankTransfer ? true : undefined,
            bankStatementRef: notes.trim() || undefined,
            accountingNotes: notes.trim() || undefined,
          },
          { withCredentials: true },
        ),
      );
      alert(`Đã duyệt yêu cầu nạp ${this.formatCurrency(req.amount)} cho ${req.userId?.fullName || ''}. Ví phụ huynh đã được cộng tiền.`);
      await this.loadPendingTopUps();
    } catch (err: any) {
      alert(err?.error?.message || 'Duyệt thất bại');
    }
  }

  async rejectTopUpRequest(req: any): Promise<void> {
    const reason = prompt(`Lý do từ chối yêu cầu nạp tiền của ${req.userId?.fullName || ''}:`);
    if (reason === null) return;

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiBase}/wallets/top-up/${req._id}/reject`,
          { reason: reason.trim() || 'Không duyệt' },
          { withCredentials: true },
        ),
      );
      alert('Đã từ chối yêu cầu nạp tiền.');
      await this.loadPendingTopUps();
    } catch (err: any) {
      alert(err?.error?.message || 'Từ chối thất bại');
    }
  }
}
