import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FlowGuideComponent } from './shared/flow-guide.component';
import { Role } from '../models/role.enum';
import { INVOICE_COURSE_STATUS_LABELS, InvoiceService } from '../services/invoice.service';
import { OrderCommunicationSummary, OrderData, OrderPipeline, OrderService } from '../services/order.service';
import { ProductItem, ProductService } from '../services/product.service';
import { LeadService } from '../services/lead.service';
import { AdGroupItem, AdsService } from '../services/ads.service';
import { AuthService } from '../services/auth.service';
import { UserItem, UserService } from '../services/user.service';
import { StudentItem, StudentService } from '../services/student.service';
import { ClassItem, ClassService } from '../services/class.service';
import { environment } from '../../environments/environment';

const STATUS_LABELS: Record<string, string> = { DRAFT: 'Nháp', SUBMITTED: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối', NEEDS_INFO: 'Cần bổ sung', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy' };
const STATUS_COLORS: Record<string, string> = { DRAFT: '#64748b', SUBMITTED: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444', NEEDS_INFO: '#8b5cf6', COMPLETED: '#059669', CANCELLED: '#9ca3af' };
const TYPE_LABELS: Record<string, string> = { NEW_ENROLLMENT: 'Đăng ký mới', RENEWAL: 'Gia hạn', ADDITIONAL: 'Mua thêm', PACKAGE_CHANGE: 'Đổi gói' };
const SOURCE_LABELS: Record<string, string> = { FACEBOOK: 'Facebook', GOOGLE: 'Google', TIKTOK: 'TikTok', ZALO: 'Zalo', WEBSITE: 'Website', REFERRAL: 'Giới thiệu', WALK_IN: 'Đến trực tiếp', OTHER: 'Khác' };
const PRODUCT_SUBJECT_LABELS: Record<string, string> = {
  ENGLISH: 'Tiếng Anh',
  MATH: 'Toán',
  LITERATURE: 'Ngữ văn',
  PHYSICS: 'Vật lý',
  CHEMISTRY: 'Hóa học',
  BIOLOGY: 'Sinh học',
  HISTORY: 'Lịch sử',
  GEOGRAPHY: 'Địa lý',
  INFORMATICS: 'Tin học',
  SCIENCE: 'Khoa học',
  MULTI_SUBJECT: 'Liên môn',
  OTHER: 'Khác',
};

const DISCOUNT_EXCEEDS_TOTAL_MESSAGE = 'Giam gia khong duoc lon hon Tong tien don hang.';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css'],
})
export class OrdersComponent implements OnInit {
  items = signal<OrderData[]>([]);
  pipeline = signal<OrderPipeline | null>(null);
  products = signal<ProductItem[]>([]);
  classes = signal<ClassItem[]>([]);
  saleOfflineClasses = signal<ClassItem[]>([]);
  sales = signal<UserItem[]>([]);
  teachers = signal<UserItem[]>([]);
  parents = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  showModal = signal(false);
  detailOrder = signal<OrderData | null>(null);
  error = signal('');
  isUploadingStudentFace = signal(false);
  isUploadingReceipt = signal(false);
  showApproveOrderModal = signal(false);
  approvingOrder = signal<OrderData | null>(null);
  orderApproveUploading = signal(false);
  orderApproveError = signal('');
  orderApproveImage = '';
  modalImage = signal<string | null>(null);
  lookupsLoaded = signal(false);
  editingId: string | null = null;
  keyword = '';
  filterStatus = '';
  filterType = '';
  canApprove = false;
  isSaleRole = false;
  currentUserId = '';
  currentUserName = '';
  parentLookup = '';
  studentLookup = '';
  form: any = {};
  pipelineStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED'];
  allStatuses = Object.keys(STATUS_LABELS);
  allTypes = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
  allSources = Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }));
  allCourseStatuses = Object.entries(INVOICE_COURSE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  orderAdGroups = signal<AdGroupItem[]>([]);

  constructor(
    private orderService: OrderService,
    private invoiceService: InvoiceService,
    private productService: ProductService,
    private studentService: StudentService,
    private leadService: LeadService,
    private adsService: AdsService,
    private auth: AuthService,
    private userService: UserService,
    private classService: ClassService,
    private route: ActivatedRoute,
  ) {
    this.form = this.emptyForm();
  }

  ngOnInit() {
    const user = this.auth.userSignal();
    this.canApprove = user?.role === Role.DIRECTOR || user?.role === Role.OPS;
    this.isSaleRole = user?.role === Role.SALE;
    this.currentUserId = user?.sub || '';
    this.currentUserName = user?.fullName || '';
    void this.loadLookups();
    void this.reload();
    this.route.queryParams.subscribe(async (params) => {
      if (params['fromLead']) {
        const lead = await this.leadService.getOne(params['fromLead']);
        if (lead) {
          this.openCreate();
          this.form.parentName = lead.parentName;
          this.form.parentPhone = lead.parentPhone;
          this.form.parentEmail = lead.parentEmail || '';
          this.form.studentName = lead.studentName || '';
          this.form.leadId = lead._id;
          this.form.leadSource = lead.source;
          this.form.saleId = lead.saleId || this.form.saleId;
          if ((lead as any).adGroupId) {
            this.form.adGroupId = (lead as any).adGroupId;
            this.form.adGroupName = (lead as any).adGroupName || '';
            this.form.adGroupFromLead = true;
            void this.loadOrderAdGroups(lead.source);
          }
        }
      }
      if (params['orderId']) {
        const order = await this.orderService.getOne(params['orderId']);
        if (order) this.detailOrder.set(order);
      }
    });
  }

  statusLabel(v: string) { return STATUS_LABELS[v] || v; }
  statusColor(v: string) { return STATUS_COLORS[v] || '#64748b'; }
  typeLabel(v: string) { return TYPE_LABELS[v] || v; }
  courseStatusLabel(v?: string) {
    return v ? ((INVOICE_COURSE_STATUS_LABELS as Record<string, string>)[v] || v) : 'Tự động';
  }
  communicationSummary(): OrderCommunicationSummary | null { return this.detailOrder()?.processedResults?.communicationSummary || null; }
  getPipeCount(s: string) { return this.pipeline()?.[s]?.count || 0; }
  getPipeValue(s: string) { return this.pipeline()?.[s]?.totalValue || 0; }
  emptyForm() { return { orderType: 'NEW_ENROLLMENT', parentName: '', parentPhone: '', parentEmail: '', parentUserId: '', parentUserCode: '', parentAddress: '', parentFacebookLink: '', studentName: '', studentCode: '', studentLevel: '', studentDob: '', studentAge: null, studentBirthMonth: null, parentBirthMonth: null, studentFaceImage: '', existingStudentId: '', leadSource: '', leadId: '', saleId: this.isSaleRole ? this.currentUserId : '', adGroupId: '', adGroupName: '', adGroupFromLead: false, paymentDate: '', receiptImage: '', saleCommission: 0, items: [this.buildFormItem()], discountAmount: 0, discountReason: '', consultationNotes: '' }; }
  emptyItem() { return { productId: '', productName: '', sessions: 24, invoiceSessions: 24, sessionDuration: 90, baseDuration: 90, pricePerSession: 0, amount: 0, bonusSessions: 0, trialSessions: 0, courseStatus: '', teachingMode: 'ONLINE', preferredSchedule: '', selectedClassId: '', requestedClassCode: '', createNewClassWhenApproved: false, preferredTeacherId: '', teacherPayPerSession: 0, teacherPayPerStudent: 0, subject: '', learningGoals: '', maxStudents: null, invoiceDescription: '', invoiceNumber: '', notes: '' }; }
  buildFormItem(source: any = {}) {
    const item = { ...this.emptyItem(), ...source };
    if (!this.normalizeOptionalText(item.requestedClassCode) && item.selectedClassId) {
      item.requestedClassCode = this.findClassById(item.selectedClassId)?.code || '';
    }
    item.requestedClassCode = this.normalizeClassCode(item.requestedClassCode);
    if (item.selectedClassId) item.createNewClassWhenApproved = false;
    else if (source?.createNewClassWhenApproved === undefined) item.createNewClassWhenApproved = true;
    if (!this.normalizeOptionalText(item.subject)) {
      const subjectFromProduct = this.productSubjectById(item.productId);
      if (subjectFromProduct) item.subject = subjectFromProduct;
    }
    const computedAmount = this.computeItemAmount(item);
    const hasExplicitAmount = source?.amount !== undefined && source?.amount !== null && source?.amount !== '';
    item.amount = hasExplicitAmount ? this.roundMoneyToThousand(item.amount || 0) : computedAmount;
    item.amountManuallyEdited = hasExplicitAmount && Number(item.amount || 0) !== computedAmount;
    return item;
  }
  normalizePhone(v?: string) { return (v || '').replace(/\D/g, ''); }
  normalizeOptionalText(v: any) { const n = String(v ?? '').trim(); return n || undefined; }
  normalizeOptionalImageReference(v: any) {
    const normalized = this.normalizeOptionalText(v);
    if (!normalized) return undefined;
    return /^(https?:\/\/|\/uploads\/|data:image\/)/.test(normalized) ? normalized : undefined;
  }
  normalizeClassCode(v: any) {
    const normalized = this.normalizeOptionalText(v);
    return normalized ? normalized.toUpperCase() : '';
  }
  normalizeOptionalId(v: any) { const n = String(v ?? '').trim(); return n || undefined; }
  normalizeOptionalEditableLinkId(v: any) {
    const normalized = this.normalizeOptionalId(v);
    if (normalized) return normalized;
    return this.editingId ? null : undefined;
  }
  normalizeOptionalNumber(v: any) { if (v === '' || v === null || v === undefined) return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined; }
  roundMoneyToThousand(v: any) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? Math.round(n / 1000) * 1000 : 0; }
  roundMoneyDownToThousand(v: any) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? Math.floor(n / 1000) * 1000 : 0; }
  floorSessionCount(v: any) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

  async loadLookups() {
    const [products, parents, students, sales, teachers, classes, saleOfflineClasses] = await Promise.all([
      this.productService.list(),
      this.userService.listParents(),
      this.studentService.list(),
      this.isSaleRole ? Promise.resolve([] as UserItem[]) : this.userService.listSales(),
      this.userService.listTeachers(),
      this.classService.list(),
      this.isSaleRole ? this.classService.listSaleOfflineOptions() : Promise.resolve([] as ClassItem[]),
    ]);
    this.products.set(products);
    this.parents.set(parents);
    this.students.set(students);
    this.sales.set(sales);
    this.teachers.set(teachers);
    this.classes.set(classes);
    this.saleOfflineClasses.set(saleOfflineClasses);
    this.lookupsLoaded.set(true);
    this.normalizeClassCreationFallback();
    this.syncMissingSubjectsFromProducts();
  }

  async reload() {
    const [items, pipeline] = await Promise.all([
      this.orderService.list(),
      this.orderService.getPipeline(),
    ]);
    this.items.set(items);
    this.pipeline.set(pipeline);
  }

  async onLeadSourceChange() {
    this.form.adGroupId = '';
    this.form.adGroupName = '';
    this.form.adGroupFromLead = false;
    await this.loadOrderAdGroups(this.form.leadSource);
  }

  async loadOrderAdGroups(platform: string) {
    if (['FACEBOOK', 'GOOGLE', 'TIKTOK'].includes(platform)) {
      try {
        this.orderAdGroups.set(await this.adsService.getGroupsByPlatform(platform));
      } catch {
        this.orderAdGroups.set([]);
      }
      return;
    }
    this.orderAdGroups.set([]);
  }

  onAdGroupChange() {
    const group = this.orderAdGroups().find((g) => g._id === this.form.adGroupId);
    this.form.adGroupName = group?.name || '';
  }

  filteredParents() {
    const q = this.parentLookup.trim().toLowerCase();
    return this.parents()
      .filter((p) =>
        !q
        || (p.fullName || '').toLowerCase().includes(q)
        || (p.phone || '').includes(q)
        || (p.email || '').toLowerCase().includes(q)
        || (p.userCode || '').toLowerCase().includes(q))
      .slice(0, 50);
  }

  filteredStudents() {
    const q = this.studentLookup.trim().toLowerCase();
    return this.students()
      .filter((s) =>
        !q
        || (s.studentCode || '').toLowerCase().includes(q)
        || (s.fullName || '').toLowerCase().includes(q)
        || (s.parentName || '').toLowerCase().includes(q)
        || (s.parentPhone || '').includes(q))
      .slice(0, 50);
  }

  findParentById(id?: string | null) { return id ? this.parents().find((p) => p._id === id) : undefined; }
  findProductById(id?: string | null) { return id ? this.products().find((p) => p._id === id) : undefined; }
  findStudentById(id?: string | null) { return id ? this.students().find((s) => s._id === id) : undefined; }
  findClassById(id?: string | null) {
    if (!id) return undefined;
    const seen = new Set<string>();
    const merged = [...this.classes(), ...this.saleOfflineClasses()].filter((classroom) => {
      if (!classroom?._id || seen.has(classroom._id)) return false;
      seen.add(classroom._id);
      return true;
    });
    return merged.find((c) => c._id === id);
  }
  availableProductsForItem(item: any) {
    const selectedProductId = this.normalizeOptionalId(item?.productId);
    return this.products().filter((product) => product.isActive !== false || product._id === selectedProductId);
  }
  productSubjectLabel(category?: string | null) {
    const normalized = String(category || '').trim();
    return normalized ? (PRODUCT_SUBJECT_LABELS[normalized] || normalized) : '';
  }
  productSubjectById(productId?: string | null) {
    return this.productSubjectLabel(this.findProductById(productId)?.category);
  }
  syncMissingSubjectsFromProducts() {
    if (!Array.isArray(this.form?.items)) return;
    this.form.items.forEach((item: any) => {
      if (this.normalizeOptionalText(item?.subject)) return;
      const subject = this.productSubjectById(item?.productId);
      if (subject) item.subject = subject;
    });
  }
  formatParentOption(p: UserItem) { return `${p.fullName} - ${p.phone || p.email || 'Không có liên hệ'}`; }
  formatStudentOption(s: StudentItem) { return `${s.studentCode} - ${s.fullName} - ${s.parentPhone || 'Không có SĐT PH'}`; }
  formatClassOption(c: ClassItem) {
    const teacherName = c.teacher && typeof c.teacher !== 'string' ? (c.teacher.fullName || '') : '';
    const studentCount = Number(c.studentCount ?? c.students?.length ?? 0);
    const capacity = Number(c.maxStudents || 0);
    const occupancyLabel = capacity > 0 ? `${studentCount}/${capacity} HS` : `${studentCount} HS`;
    return `${c.code} - ${c.name}${teacherName ? ` - ${teacherName}` : ''} - ${occupancyLabel}`;
  }
  classLabel(id?: string | null) {
    const classroom = this.findClassById(id);
    return classroom ? this.formatClassOption(classroom) : '-';
  }
  plannedClassLabel(item: any) {
    if (item?.selectedClassId) return this.classLabel(item.selectedClassId);
    const requestedClassCode = this.normalizeClassCode(item?.requestedClassCode);
    if (requestedClassCode && item?.createNewClassWhenApproved) return `Tao/ghep lop theo ma ${requestedClassCode} khi duyet`;
    if (requestedClassCode) return `Ma lop du kien: ${requestedClassCode}`;
    if (item?.createNewClassWhenApproved) return 'Tạo lớp mới khi duyệt';
    return 'Để xếp lớp sau';
  }
  classSelectionValue(item: any) {
    if (item?.selectedClassId) return item.selectedClassId;
    return item?.createNewClassWhenApproved ? '__CREATE_NEW__' : '';
  }
  classSelectionHint(item: any) {
    if (item?.selectedClassId) {
      return 'Hệ thống sẽ gắn học sinh vào lớp đã chọn ngay sau khi hóa đơn được duyệt.';
    }
    const requestedClassCode = this.normalizeClassCode(item?.requestedClassCode);
    if (requestedClassCode && item?.createNewClassWhenApproved) {
      return `Hệ thống sẽ ưu tiên tìm lớp mã ${requestedClassCode}; nếu chưa có sẽ tạo lớp mới với đúng mã này ngay sau khi duyệt.`;
    }
    if (requestedClassCode) {
      return `Hệ thống sẽ ưu tiên gắn học sinh vào lớp có mã ${requestedClassCode} khi duyệt hóa đơn.`;
    }
    if (item?.createNewClassWhenApproved) {
      return 'Vui lòng nhập mã lớp và chọn giáo viên dự kiến nếu muốn hệ thống tự tạo lớp mới khi duyệt.';
    }
    return 'Đơn vẫn được duyệt, nhưng lớp sẽ được xếp sau.';
  }
  canCreateClassWhenApproved(item: any) {
    return !!this.normalizeOptionalId(item?.preferredTeacherId) || this.teachers().length > 0;
  }
  normalizeClassCreationFallback() {
    if (this.teachers().length > 0 || !Array.isArray(this.form?.items)) return;
    for (const item of this.form.items) {
      if (!item?.selectedClassId && item?.createNewClassWhenApproved && !this.normalizeOptionalId(item?.preferredTeacherId)) {
        item.createNewClassWhenApproved = false;
      }
    }
  }
  teacherLabel(id?: string | null) { return this.teachers().find((t) => t._id === id)?.fullName || '-'; }
  teacherPayLabelForItem(item: any) {
    if (String(item?.teachingMode || '').toUpperCase() === 'OFFLINE') {
      return `${this.roundMoneyDownToThousand(item?.teacherPayPerStudent || 0).toLocaleString('vi-VN')}d / HS`;
    }
    return `${this.roundMoneyDownToThousand(item?.teacherPayPerSession || 0).toLocaleString('vi-VN')}d / buổi`;
  }
  isOfflineTrialZeroAmountItem(item: any) {
    const teachingMode = String(item?.teachingMode || '').toUpperCase();
    const trialSessions = this.floorSessionCount(item?.trialSessions || 0);
    const amount = this.roundMoneyToThousand(item?.amount || 0);
    return teachingMode === 'OFFLINE' && trialSessions > 0 && amount <= 0;
  }
  displayInvoiceSessions(item: any) {
    return this.hasExplicitValue(item?.invoiceSessions)
      ? this.floorSessionCount(item.invoiceSessions)
      : this.floorSessionCount(item?.sessions || 0);
  }
  requiresApprovalProof(order: any) {
    const items = Array.isArray(order?.items) ? order.items : [];
    return !(items.length > 0 && items.every((item: any) => this.isOfflineTrialZeroAmountItem(item)));
  }
  productSuggestedPriceById(productId?: string | null) {
    const product = this.findProductById(productId);
    return this.roundMoneyToThousand(product?.suggestedPrice || 0);
  }
  orderItemCoursePrice(item: any) {
    if (this.isOfflineTrialZeroAmountItem(item)) return 0;
    const suggestedPrice = this.productSuggestedPriceById(item?.productId);
    if (suggestedPrice > 0) return suggestedPrice;
    return this.roundMoneyToThousand(this.floorSessionCount(item?.sessions || 0) * Number(item?.pricePerSession || 0));
  }
  productSuggestedPrice(item: any) {
    return this.orderItemCoursePrice(item);
  }
  orderCoursePrice(order: any) {
    return this.roundMoneyToThousand((order?.items || []).reduce((sum: number, item: any) => sum + this.orderItemCoursePrice(item), 0));
  }
  orderInvoiceAmount(order: any) {
    const finalAmount = Number(order?.finalAmount);
    if (Number.isFinite(finalAmount) && finalAmount >= 0) {
      return this.roundMoneyToThousand(finalAmount);
    }
    const totalAmount = Number(order?.totalAmount);
    if (Number.isFinite(totalAmount) && totalAmount >= 0) {
      return this.roundMoneyToThousand(totalAmount);
    }
    return this.roundMoneyToThousand((order?.items || []).reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0));
  }
  orderRequiredPaymentAmount(order: any) {
    const totalAmount = this.roundMoneyToThousand(order?.totalAmount || 0);
    const discountAmount = this.roundMoneyToThousand(order?.discountAmount || 0);
    return Math.max(0, totalAmount - discountAmount);
  }
  partialPaymentPaidAmount(order: any) {
    return Math.min(this.orderInvoiceAmount(order), this.orderRequiredPaymentAmount(order));
  }
  partialPaymentRemainingAmount(order: any) {
    return Math.max(0, this.orderRequiredPaymentAmount(order) - this.partialPaymentPaidAmount(order));
  }
  showPartialPaymentStatus(order: any) {
    const status = String(order?.status || '').toUpperCase();
    return ['APPROVED', 'COMPLETED'].includes(status) && this.partialPaymentRemainingAmount(order) > 0;
  }
  invoiceItemLabel(item: any, index: number) {
    return this.invoiceCardSubtitle(item);
    const productName = item?.productName || this.products().find((product) => product._id === item?.productId)?.name || `Sản phẩm ${index + 1}`;
    const subject = this.normalizeOptionalText(item?.subject);
    return subject ? `${productName} - ${subject}` : productName;
  }
  invoiceCardSubtitle(item: any) {
    const productName = this.normalizeOptionalText(item?.productName)
      || this.normalizeOptionalText(this.products().find((product) => product._id === item?.productId)?.name);
    const subject = this.normalizeOptionalText(item?.subject);
    if (productName && subject) return `${productName} - ${subject}`;
    return subject || productName || '';
  }
  classOptionsForItem(item: any) {
    const desiredMode = String(item?.teachingMode || 'ONLINE').toUpperCase();
    const desiredProductId = String(item?.productId || '');
    const sourceClasses = desiredMode === 'OFFLINE' && this.isSaleRole
      ? this.saleOfflineClasses()
      : this.classes();
    const sameModeClasses = sourceClasses.filter((classroom) => {
      const classMode = String(classroom.classMode || 'ONLINE').toUpperCase();
      if (classMode !== desiredMode) return false;
      return true;
    });
    const filtered = sameModeClasses.filter((classroom) => {
      if (desiredMode === 'OFFLINE') return true;
      const classProductId = classroom.productPackage?._id || '';
      if (desiredProductId && classProductId && classProductId !== desiredProductId) return false;
      return true;
    });
    const prioritized = desiredMode === 'OFFLINE' && desiredProductId
      ? [
          ...filtered.filter((classroom) => (classroom.productPackage?._id || '') === desiredProductId),
          ...filtered.filter((classroom) => (classroom.productPackage?._id || '') !== desiredProductId),
        ]
      : filtered;
    const selectedClass = this.findClassById(item?.selectedClassId);
    if (
      selectedClass
      && !prioritized.some((classroom) => classroom._id === selectedClass._id)
      && String(selectedClass.classMode || 'ONLINE').toUpperCase() === desiredMode
    ) {
      prioritized.unshift(selectedClass);
    }
    return prioritized;
  }

  startNewParent() {
    const hadLinkedParent = !!this.form.parentUserId;
    this.form.parentUserId = '';
    this.parentLookup = '';
    this.form.existingStudentId = '';
    this.studentLookup = '';
    if (hadLinkedParent) {
      this.form.parentName = '';
      this.form.parentPhone = '';
      this.form.parentEmail = '';
      this.form.parentUserCode = '';
      this.form.parentAddress = '';
      this.form.parentFacebookLink = '';
    }
  }

  startNewStudent() {
    const hadLinkedStudent = !!this.form.existingStudentId;
    this.form.existingStudentId = '';
    this.studentLookup = '';
    if (hadLinkedStudent) {
      this.form.studentCode = '';
      this.form.studentName = '';
      this.form.studentLevel = '';
      this.form.studentDob = '';
      this.form.studentAge = null;
      this.form.studentBirthMonth = null;
      this.form.studentFaceImage = '';
    }
  }

  applyParentSelection(parent: UserItem | null) {
    if (!parent) {
      this.form.parentUserId = '';
      this.parentLookup = '';
      return;
    }
    this.form.parentUserId = parent._id;
    this.form.parentName = parent.fullName || this.form.parentName;
    this.form.parentPhone = parent.phone || this.form.parentPhone;
    this.form.parentEmail = parent.email || this.form.parentEmail;
    this.form.parentUserCode = parent.userCode || this.form.parentUserCode;
    this.form.parentAddress = parent.address || this.form.parentAddress;
    this.form.parentFacebookLink = parent.facebookLink || this.form.parentFacebookLink;
    if (!this.isSaleRole && !this.form.leadId && !this.form.existingStudentId && parent.saleOwnerId) {
      this.form.saleId = parent.saleOwnerId;
    }
    this.parentLookup = this.formatParentOption(parent);
  }

  applyStudentSelection(student: StudentItem | null) {
    if (!student) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
      return;
    }
    this.form.existingStudentId = student._id;
    this.form.studentCode = student.studentCode || this.form.studentCode;
    this.form.studentName = student.fullName || this.form.studentName;
    this.form.studentLevel = student.level || this.form.studentLevel;
    this.form.studentAge = student.age ?? this.form.studentAge;
    this.form.studentBirthMonth = student.studentBirthMonth ?? this.form.studentBirthMonth;
    this.form.parentBirthMonth = student.parentBirthMonth ?? this.form.parentBirthMonth;
    this.form.studentFaceImage = this.normalizeOptionalImageReference(student.faceImage) || '';
    this.studentLookup = this.formatStudentOption(student);
    const parent = student.parentUserId ? this.findParentById(student.parentUserId) : undefined;
    if (parent) this.applyParentSelection(parent);
    else {
      this.form.parentUserId = student.parentUserId || this.form.parentUserId || '';
      this.form.parentName = student.parentName || this.form.parentName;
      this.form.parentPhone = student.parentPhone || this.form.parentPhone;
    }
    if (!this.isSaleRole && !this.form.leadId && student.saleId) this.form.saleId = student.saleId;
  }

  onParentSelected(parentId: string) {
    const parent = this.findParentById(parentId);
    this.applyParentSelection(parent || null);
    if (!parent) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
      return;
    }
    const student = this.findStudentById(this.form.existingStudentId);
    if (student?.parentUserId && student.parentUserId !== parent._id) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
    }
  }

  onExistingStudentSelected(studentId: string) {
    this.applyStudentSelection(this.findStudentById(studentId) || null);
  }

  onParentFieldsChanged() {
    const p = this.findParentById(this.form.parentUserId);
    if (p) {
      const sameName = (this.form.parentName || '').trim() === (p.fullName || '').trim();
      const samePhone = this.normalizePhone(this.form.parentPhone) === this.normalizePhone(p.phone);
      const sameEmail = (this.form.parentEmail || '').trim().toLowerCase() === (p.email || '').trim().toLowerCase();
      const sameCode = (this.form.parentUserCode || '').trim().toUpperCase() === (p.userCode || '').trim().toUpperCase();
      if (!sameName || !samePhone || !sameEmail || !sameCode) {
        this.form.parentUserId = '';
        this.parentLookup = '';
      }
    }
    const s = this.findStudentById(this.form.existingStudentId);
    if (s) {
      const sameParentName = (this.form.parentName || '').trim() === (s.parentName || '').trim();
      const sameParentPhone = this.normalizePhone(this.form.parentPhone) === this.normalizePhone(s.parentPhone);
      if (!sameParentName || !sameParentPhone) {
        this.form.existingStudentId = '';
        this.studentLookup = '';
      }
    }
  }

  onStudentFieldsChanged() {
    const s = this.findStudentById(this.form.existingStudentId);
    if (!s) return;
    const sameName = (this.form.studentName || '').trim() === (s.fullName || '').trim();
    const sameAge = Number(this.form.studentAge || 0) === Number(s.age || 0);
    const sameCode = (this.form.studentCode || '').trim().toUpperCase() === (s.studentCode || '').trim().toUpperCase();
    const sameLevel = (this.form.studentLevel || '').trim() === (s.level || '').trim();
    if (!sameName || !sameAge || !sameCode || !sameLevel) {
      this.form.existingStudentId = '';
      this.studentLookup = '';
    }
  }

  onSelectedClassChange(item: any, classId: string) {
    item.selectedClassId = classId || '';
    item.createNewClassWhenApproved = false;
    const classroom = this.findClassById(classId);
    if (!classroom) return;
    item.requestedClassCode = this.normalizeClassCode(classroom.code);
    if (classroom.classMode) item.teachingMode = classroom.classMode;
    if (classroom.productPackage?._id && !item.productId) {
      item.productId = classroom.productPackage._id;
      item.productName = classroom.productPackage.name || item.productName;
    }
    if (classroom.teacher && typeof classroom.teacher !== 'string') {
      item.preferredTeacherId = classroom.teacher._id;
    }
    item.subject = classroom.subject || this.productSubjectById(item.productId) || item.subject;
    item.learningGoals = classroom.learningGoals || item.learningGoals;
    item.baseDuration = classroom.baseDuration || item.baseDuration;
    item.sessionDuration = classroom.sessionDuration || item.sessionDuration;
    item.pricePerSession = classroom.pricePerSession || item.pricePerSession;
    item.teacherPayPerSession = classroom.teacherPayPerSession || item.teacherPayPerSession;
    item.teacherPayPerStudent = classroom.teacherPayPerStudent || item.teacherPayPerStudent;
    item.maxStudents = classroom.maxStudents ?? item.maxStudents;
    this.calcItemAmount(item);
  }
  onClassSelectionChange(item: any, selection: string) {
    const hadSelectedClass = !!item.selectedClassId;
    if (selection === '__CREATE_NEW__') {
      if (hadSelectedClass) item.requestedClassCode = '';
      item.selectedClassId = '';
      item.createNewClassWhenApproved = true;
      return;
    }
    item.createNewClassWhenApproved = false;
    if (!selection) {
      if (hadSelectedClass) item.requestedClassCode = '';
      item.selectedClassId = '';
      item.preferredTeacherId = '';
      return;
    }
    this.onSelectedClassChange(item, selection);
  }
  onRequestedClassCodeChange(item: any, value: string) {
    item.requestedClassCode = this.normalizeClassCode(value);
  }
  onTeachingModeChange(item: any, teachingMode: string) {
    item.teachingMode = teachingMode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';
    const selectedClass = this.findClassById(item.selectedClassId);
    if (selectedClass && String(selectedClass.classMode || 'ONLINE').toUpperCase() !== item.teachingMode) {
      item.selectedClassId = '';
    }
    if (item.selectedClassId) {
      item.createNewClassWhenApproved = false;
      return;
    }
    item.createNewClassWhenApproved = true;
  }

  buildPayload() {
    return {
      orderType: this.form.orderType,
      parentName: (this.form.parentName || '').trim(),
      parentPhone: (this.form.parentPhone || '').trim(),
      ...(this.normalizeOptionalText(this.form.parentEmail) ? { parentEmail: this.normalizeOptionalText(this.form.parentEmail) } : {}),
      ...(this.normalizeOptionalText(this.form.parentUserCode) ? { parentUserCode: this.normalizeOptionalText(this.form.parentUserCode)?.toUpperCase() } : {}),
      ...(this.normalizeOptionalText(this.form.parentAddress) ? { parentAddress: this.normalizeOptionalText(this.form.parentAddress) } : {}),
      ...(this.normalizeOptionalText(this.form.parentFacebookLink) ? { parentFacebookLink: this.normalizeOptionalText(this.form.parentFacebookLink) } : {}),
      ...(this.normalizeOptionalEditableLinkId(this.form.parentUserId) !== undefined ? { parentUserId: this.normalizeOptionalEditableLinkId(this.form.parentUserId) } : {}),
      studentName: (this.form.studentName || '').trim(),
      ...(this.normalizeOptionalText(this.form.studentCode) ? { studentCode: this.normalizeOptionalText(this.form.studentCode)?.toUpperCase() } : {}),
      ...(this.normalizeOptionalText(this.form.studentLevel) ? { studentLevel: this.normalizeOptionalText(this.form.studentLevel) } : {}),
      ...(this.normalizeOptionalText(this.form.studentDob) ? { studentDob: this.normalizeOptionalText(this.form.studentDob) } : {}),
      ...(this.normalizeOptionalNumber(this.form.studentAge) !== undefined ? { studentAge: this.normalizeOptionalNumber(this.form.studentAge) } : {}),
      ...(this.normalizeOptionalNumber(this.form.studentBirthMonth) !== undefined ? { studentBirthMonth: this.normalizeOptionalNumber(this.form.studentBirthMonth) } : {}),
      ...(this.normalizeOptionalNumber(this.form.parentBirthMonth) !== undefined ? { parentBirthMonth: this.normalizeOptionalNumber(this.form.parentBirthMonth) } : {}),
      ...(this.normalizeOptionalImageReference(this.form.studentFaceImage) ? { studentFaceImage: this.normalizeOptionalImageReference(this.form.studentFaceImage) } : {}),
      ...(this.normalizeOptionalEditableLinkId(this.form.existingStudentId) !== undefined ? { existingStudentId: this.normalizeOptionalEditableLinkId(this.form.existingStudentId) } : {}),
      ...(this.normalizeOptionalText(this.form.leadSource) ? { leadSource: this.normalizeOptionalText(this.form.leadSource) } : {}),
      ...(this.normalizeOptionalId(this.form.leadId) ? { leadId: this.normalizeOptionalId(this.form.leadId) } : {}),
      ...(this.normalizeOptionalId(this.form.saleId) ? { saleId: this.normalizeOptionalId(this.form.saleId) } : {}),
      ...(this.normalizeOptionalId(this.form.adGroupId) ? { adGroupId: this.normalizeOptionalId(this.form.adGroupId) } : {}),
      ...(this.normalizeOptionalText(this.form.adGroupName) ? { adGroupName: this.normalizeOptionalText(this.form.adGroupName) } : {}),
      ...(this.normalizeOptionalText(this.form.paymentDate) ? { paymentDate: this.normalizeOptionalText(this.form.paymentDate) } : {}),
      ...(this.normalizeOptionalImageReference(this.form.receiptImage) ? { receiptImage: this.normalizeOptionalImageReference(this.form.receiptImage) } : {}),
      ...(this.normalizeOptionalNumber(this.form.saleCommission) !== undefined ? { saleCommission: this.normalizeOptionalNumber(this.form.saleCommission) } : {}),
      items: (this.form.items || []).map((item: any) => ({
        productId: item.productId,
        ...(this.normalizeOptionalText(item.productName) ? { productName: this.normalizeOptionalText(item.productName) } : {}),
        sessions: this.floorSessionCount(item.sessions || 0),
        invoiceSessions: this.resolveInvoiceSessionsForPayload(item),
        sessionDuration: Number(item.sessionDuration || 0),
        ...(this.normalizeOptionalNumber(item.baseDuration) !== undefined ? { baseDuration: this.normalizeOptionalNumber(item.baseDuration) } : {}),
        pricePerSession: this.roundMoneyToThousand(item.pricePerSession || 0),
        amount: this.roundMoneyToThousand(item.amount || 0),
        ...(this.normalizeOptionalNumber(item.bonusSessions) !== undefined ? { bonusSessions: this.floorSessionCount(item.bonusSessions) } : {}),
        ...(this.normalizeOptionalNumber(item.trialSessions) !== undefined ? { trialSessions: this.floorSessionCount(item.trialSessions) } : {}),
        ...(this.normalizeOptionalText(item.courseStatus) ? { courseStatus: this.normalizeOptionalText(item.courseStatus) } : {}),
        teachingMode: item.teachingMode || 'ONLINE',
        ...(this.normalizeOptionalText(item.preferredSchedule) ? { preferredSchedule: this.normalizeOptionalText(item.preferredSchedule) } : {}),
        ...(this.normalizeOptionalId(item.selectedClassId) ? { selectedClassId: this.normalizeOptionalId(item.selectedClassId) } : {}),
        ...(this.normalizeClassCode(item.requestedClassCode) ? { requestedClassCode: this.normalizeClassCode(item.requestedClassCode) } : {}),
        ...(item.createNewClassWhenApproved ? { createNewClassWhenApproved: true } : {}),
        ...(this.normalizeOptionalId(item.preferredTeacherId) ? { preferredTeacherId: this.normalizeOptionalId(item.preferredTeacherId) } : {}),
        ...(this.normalizeOptionalNumber(item.teacherPayPerSession) !== undefined ? { teacherPayPerSession: this.roundMoneyDownToThousand(item.teacherPayPerSession) } : {}),
        ...(this.normalizeOptionalNumber(item.teacherPayPerStudent) !== undefined ? { teacherPayPerStudent: this.roundMoneyDownToThousand(item.teacherPayPerStudent) } : {}),
        ...(this.normalizeOptionalText(item.subject) ? { subject: this.normalizeOptionalText(item.subject) } : {}),
        ...(this.normalizeOptionalText(item.learningGoals) ? { learningGoals: this.normalizeOptionalText(item.learningGoals) } : {}),
        ...(this.normalizeOptionalNumber(item.maxStudents) !== undefined ? { maxStudents: this.normalizeOptionalNumber(item.maxStudents) } : {}),
        ...(this.normalizeOptionalText(item.invoiceDescription) ? { invoiceDescription: this.normalizeOptionalText(item.invoiceDescription) } : {}),
        ...(this.normalizeOptionalText(item.invoiceNumber) ? { invoiceNumber: this.normalizeOptionalText(item.invoiceNumber) } : {}),
        ...(this.normalizeOptionalText(item.notes) ? { notes: this.normalizeOptionalText(item.notes) } : {}),
      })),
      discountAmount: this.roundMoneyToThousand(this.form.discountAmount || 0),
      ...(this.normalizeOptionalText(this.form.discountReason) ? { discountReason: this.normalizeOptionalText(this.form.discountReason) } : {}),
      ...(this.normalizeOptionalText(this.form.consultationNotes) ? { consultationNotes: this.normalizeOptionalText(this.form.consultationNotes) } : {}),
      totalAmount: this.calcTotal(),
      finalAmount: this.calcFinal(),
    };
  }

  filtered = computed(() => {
    let list = this.items();
    const kw = this.keyword.trim().toLowerCase();
    if (kw) list = list.filter((o) => o.orderCode.toLowerCase().includes(kw) || o.studentName.toLowerCase().includes(kw) || (o.studentCode || '').toLowerCase().includes(kw) || o.parentName.toLowerCase().includes(kw) || o.parentPhone.includes(kw));
    if (this.filterStatus) list = list.filter((o) => o.status === this.filterStatus);
    if (this.filterType) list = list.filter((o) => o.orderType === this.filterType);
    return list;
  });

  onProductSelect(item: any, productId: string) {
    const p = this.findProductById(productId);
    if (!p) {
      item.productName = '';
      if (!item.selectedClassId) item.subject = '';
      return;
    }
    item.productName = p.name;
    item.subject = this.productSubjectLabel(p.category) || item.subject;
    item.sessions = p.defaultSessions || 24;
    item.invoiceSessions = p.defaultSessions || 24;
    item.sessionDuration = p.defaultSessionDuration || 90;
    item.baseDuration = p.defaultSessionDuration || item.baseDuration || 90;
    item.pricePerSession = p.pricePerSession || 0;
    this.onTeachingModeChange(item, p.teachingMode === 'OFFLINE' ? 'OFFLINE' : 'ONLINE');
    item.amountManuallyEdited = false;
    this.calcItemAmount(item, true);
  }

  calcEffectivePrice(item: any) {
    const pricePerSession = Number(item.pricePerSession || 0);
    const baseDuration = Number(item.baseDuration || item.sessionDuration || 0);
    const sessionDuration = Number(item.sessionDuration || baseDuration || 0);
    if (!pricePerSession || !baseDuration || !sessionDuration) return pricePerSession;
    return this.roundMoneyToThousand((pricePerSession / baseDuration) * sessionDuration);
  }
  hasExplicitValue(value: any) {
    return value !== undefined && value !== null && value !== '';
  }
  resolveConfiguredInvoiceSessions(item: any) {
    if (this.hasExplicitValue(item?.invoiceSessions)) {
      return this.floorSessionCount(item.invoiceSessions);
    }
    return this.floorSessionCount(item?.sessions || 0);
  }
  resolveInvoiceSessionsForPayload(item: any) {
    const invoiceSessions = this.resolveConfiguredInvoiceSessions(item);
    if (invoiceSessions > 0) {
      return invoiceSessions;
    }
    return this.isOfflineTrialZeroAmountItem(item) ? 0 : this.floorSessionCount(item.sessions || 0);
  }
  computeItemAmount(item: any) {
    return this.roundMoneyToThousand(this.resolveConfiguredInvoiceSessions(item) * this.calcEffectivePrice(item));
  }
  calcItemAmount(item: any, force = false) {
    const amount = this.computeItemAmount(item);
    if (force || !item.amountManuallyEdited) item.amount = amount;
    return amount;
  }
  markInvoiceAmountEdited(item: any) { item.amountManuallyEdited = true; }
  normalizeInvoiceAmount(item: any) {
    item.amount = this.roundMoneyToThousand(item.amount || 0);
    item.amountManuallyEdited = true;
  }
  normalizeInvoiceSessions(item: any) {
    const normalizedInvoiceSessions = this.floorSessionCount(item.invoiceSessions || 0);
    const fallbackSessions = this.floorSessionCount(item.sessions || 0) || 1;
    item.invoiceSessions =
      normalizedInvoiceSessions > 0 || this.isOfflineTrialZeroAmountItem(item)
        ? normalizedInvoiceSessions
        : fallbackSessions;
    this.calcItemAmount(item);
  }
  resetInvoiceAmount(item: any) {
    item.amountManuallyEdited = false;
    this.calcItemAmount(item, true);
  }
  calcTotal() { return this.roundMoneyToThousand((this.form.items || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0)); }
  calcFinal() { return Math.max(0, this.roundMoneyToThousand(this.calcTotal() - this.roundMoneyToThousand(this.form.discountAmount || 0))); }
  hasInvalidDiscount() {
    const total = this.calcTotal();
    const discount = this.roundMoneyToThousand(this.form.discountAmount || 0);
    return discount > total;
  }
  submitDisabled() {
    return this.isUploadingStudentFace() || this.isUploadingReceipt() || this.hasInvalidDiscount();
  }
  discountExceedsTotalMessage() { return DISCOUNT_EXCEEDS_TOTAL_MESSAGE; }
  onDiscountAmountChange() {
    if (this.error() === DISCOUNT_EXCEEDS_TOTAL_MESSAGE && !this.hasInvalidDiscount()) {
      this.error.set('');
    }
  }
  addItem() { this.form.items.push(this.buildFormItem()); }
  removeItem(i: number) { this.form.items.splice(i, 1); }

  async uploadStudentFace(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploadingStudentFace.set(true);
    this.error.set('');
    try {
      const res = await this.studentService.uploadFace(file);
      this.form.studentFaceImage = res.url;
    } catch {
      this.error.set('Không thể tải ảnh học sinh lên');
    } finally {
      this.isUploadingStudentFace.set(false);
      input.value = '';
    }
  }

  async uploadReceipt(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isUploadingReceipt.set(true);
    this.error.set('');
    try {
      const res = await this.invoiceService.uploadReceipt(file);
      if (!res.ok || !res.url) {
        this.error.set(res.message || 'Không thể tải chứng từ lên');
        return;
      }
      this.form.receiptImage = res.url;
    } finally {
      this.isUploadingReceipt.set(false);
      input.value = '';
    }
  }

  openCreate() { this.editingId = null; this.form = this.emptyForm(); this.normalizeClassCreationFallback(); this.parentLookup = ''; this.studentLookup = ''; this.error.set(''); this.showModal.set(true); }
  openEdit(o: OrderData) { this.editingId = o._id; this.form = { ...this.emptyForm(), ...o, parentUserId: o.parentUserId || '', existingStudentId: o.existingStudentId || '', items: (o.items || []).map((i: any) => this.buildFormItem(i)) }; this.syncMissingSubjectsFromProducts(); this.error.set(''); this.parentLookup = ''; this.studentLookup = ''; this.showModal.set(true); this.detailOrder.set(null); }
  openDetail(o: OrderData) { this.detailOrder.set(o); }
  closeModal() { this.showModal.set(false); this.editingId = null; this.parentLookup = ''; this.studentLookup = ''; }
  canEdit(o: OrderData) { return o.status === 'DRAFT' || o.status === 'NEEDS_INFO'; }
  canSubmit(o: OrderData) { return o.status === 'DRAFT' || o.status === 'NEEDS_INFO'; }
  canApproveOrder(o: OrderData) { return o.status === 'SUBMITTED' && this.canApprove; }
  canCancel(o: OrderData) {
    if (['COMPLETED', 'CANCELLED'].includes(o.status)) return false;
    if (o.status === 'APPROVED') {
      return this.auth.userSignal()?.role === Role.DIRECTOR;
    }
    return true;
  }

  async submitForm() {
    this.error.set('');
    const missingTeacherForNewClass = (this.form.items || []).find(
      (item: any) =>
        item?.createNewClassWhenApproved
        && !this.normalizeOptionalId(item?.preferredTeacherId),
    );
    if (missingTeacherForNewClass) {
      this.error.set('Vui lòng chọn giáo viên dự kiến nếu muốn hệ thống tạo lớp mới khi duyệt.');
      return;
    }
    const missingClassCodeForNewClass = (this.form.items || []).find(
      (item: any) =>
        item?.createNewClassWhenApproved
        && !this.normalizeClassCode(item?.requestedClassCode),
    );
    if (missingClassCodeForNewClass) {
      this.error.set('Vui lòng nhập mã lớp nếu muốn hệ thống tạo lớp mới khi duyệt.');
      return;
    }
    if (this.hasInvalidDiscount()) {
      this.error.set(DISCOUNT_EXCEEDS_TOTAL_MESSAGE);
      return;
    }
    const payload = this.buildPayload();
    const res = this.editingId
      ? await this.orderService.update(this.editingId, payload)
      : await this.orderService.create(payload);
    if (!res.ok) {
      this.error.set(res.message || 'Không thể lưu đơn');
      return;
    }
    this.closeModal();
    await this.reload();
  }

  async submitOrder(o: OrderData) {
    if (!confirm(`Gửi duyệt đơn ${o.orderCode}?`)) return;
    const res = await this.orderService.submit(o._id);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }

  async approveOrder(o: OrderData) {
    if (!confirm(`Duyệt đơn ${o.orderCode} - ${o.studentName}?`)) return;
    const res = await this.orderService.approve(o._id, this.orderApproveImage || undefined);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    const updatedOrder = res.data?.order || await this.orderService.getOne(o._id);
    const e = res.data?.enrollment;
    if (e?.success) {
      alert(`Học sinh: ${e.studentCode}\nHóa đơn tạo: ${e.invoiceIds?.length || 0}\nĐơn sẽ chuyển COMPLETED sau khi gắn đủ lớp.`);
    } else if (e?.errors?.length) {
      alert(e.errors.join('\n'));
    }
    this.detailOrder.set(updatedOrder || null);
    await Promise.all([this.reload(), this.loadLookups()]);
  }

  getImageUrl(imagePath: string): string {
    if (imagePath.startsWith('http') || imagePath.startsWith('data:image/')) return imagePath;
    return `${environment.apiBase}${imagePath}`;
  }

  showImageModal(imageUrl: string): void {
    this.modalImage.set(imageUrl);
  }

  closeImageModal(): void {
    this.modalImage.set(null);
  }

  openApproveOrderModal(o: OrderData): void {
    this.approvingOrder.set(o);
    this.orderApproveImage = '';
    this.orderApproveError.set('');
    this.orderApproveUploading.set(false);
    this.showApproveOrderModal.set(true);
  }

  closeApproveOrderModal(): void {
    this.showApproveOrderModal.set(false);
    this.approvingOrder.set(null);
    this.orderApproveImage = '';
    this.orderApproveError.set('');
    this.orderApproveUploading.set(false);
  }

  async handleOrderApproveImageChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.orderApproveError.set('');
    this.orderApproveUploading.set(true);
    const result = await this.invoiceService.uploadReceipt(file);
    this.orderApproveUploading.set(false);
    if (!result.ok || !result.url) {
      this.orderApproveError.set(result.message || 'Tải hóa đơn đối ứng thất bại');
      return;
    }
    this.orderApproveImage = result.url;
  }

  async confirmApproveOrder(): Promise<void> {
    const o = this.approvingOrder();
    if (!o) return;
    this.orderApproveError.set('');
    const res = await this.orderService.approve(o._id, this.orderApproveImage || undefined);
    if (!res.ok) {
      this.orderApproveError.set(res.message || 'Không thể duyệt đơn');
      return;
    }
    const updatedOrder = res.data?.order || await this.orderService.getOne(o._id);
    const e = res.data?.enrollment;
    if (e?.success) {
      alert(`Học sinh: ${e.studentCode}\nHóa đơn tạo: ${e.invoiceIds?.length || 0}\nĐơn sẽ chuyển COMPLETED sau khi gắn đủ lớp.`);
    } else if (e?.errors?.length) {
      alert(e.errors.join('\n'));
    }
    this.closeApproveOrderModal();
    this.detailOrder.set(updatedOrder || null);
    await Promise.all([this.reload(), this.loadLookups()]);
  }

  async requestMoreInfo(o: OrderData) {
    const reason = prompt('Nội dung cần bổ sung:');
    if (!reason) return;
    const res = await this.orderService.requestInfo(o._id, reason);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }

  async rejectOrder(o: OrderData) {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    const res = await this.orderService.reject(o._id, reason);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }

  async cancelOrder(o: OrderData) {
    if (!confirm(`Hủy đơn ${o.orderCode}?`)) return;
    const res = await this.orderService.cancel(o._id);
    if (!res.ok) {
      alert(res.message);
      return;
    }
    this.detailOrder.set(null);
    await this.reload();
  }
}
