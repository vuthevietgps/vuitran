import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassItem, ClassService } from '../services/class.service';
import { UserItem, UserService } from '../services/user.service';
import { StudentItem, StudentService } from '../services/student.service';
import { ProductItem, ProductService } from '../services/product.service';
import { AuthService } from '../services/auth.service';

import { FlowGuideComponent } from './shared/flow-guide.component';

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, FlowGuideComponent],
  template: `
  <header class="page-header">
    <div>
      <h2>Quan ly lop hoc</h2>
      <p>Tao lop, gan giao vien, hoc vien va cau hinh gia tien theo loai lop.</p>
    </div>
    <button class="primary" (click)="openModal()" *ngIf="canManage()">+ Them lop hoc</button>
  </header>

  <app-flow-guide featureKey="classes"></app-flow-guide>

  <table class="data" *ngIf="classes().length; else empty">
    <thead>
      <tr>
        <th>Ma lop</th>
        <th>Ten lop</th>
        <th>Loai</th>
        <th>Giao vien</th>
        <th>Hoc vien</th>
        <th *ngIf="!isTeacher()">Gia co so (HS)</th>
        <th>Luong co so (GV)</th>
        <th>TL co so</th>
        <th>TL buoi hoc</th>
        <th *ngIf="!isTeacher()">Gia thuc/buoi</th>
        <th>Luong thuc/buoi</th>
        <th *ngIf="!isTeacher()">Loi nhuan/buoi</th>
        <th>Hanh dong</th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let c of classes()">
        <td>{{c.code}}</td>
        <td>{{c.name}}</td>
        <td>
          <span class="mode-badge" [class.offline]="isOfflineClass(c)">
            {{isOfflineClass(c) ? 'OFFLINE' : 'ONLINE'}}
          </span>
        </td>
        <td>{{c.teacher?.fullName || '-'}}</td>
        <td>
          <span class="chip" *ngFor="let s of c.students">{{s.fullName}}</span>
          <span *ngIf="!c.students?.length">Chua co</span>
        </td>
        <td *ngIf="!isTeacher()">{{formatCurrency(c.pricePerSession)}}</td>
        <td>{{formatTeacherBase(c)}}</td>
        <td>{{c.baseDuration || 60}}p</td>
        <td>{{c.sessionDuration || 60}}p</td>
        <td *ngIf="!isTeacher()"><strong>{{formatCurrency(c.actualPricePerSession ?? c.pricePerSession)}}</strong></td>
        <td>{{formatTeacherActual(c)}}</td>
        <td *ngIf="!isTeacher()" [class]="getProfitClass(getProfit(c))">{{formatCurrency(getProfit(c))}}</td>
        <td class="actions-cell">
          <ng-container *ngIf="canManage()">
            <button class="ghost" (click)="edit(c)">Sua</button>
            <button class="danger" (click)="remove(c)" *ngIf="isDirector()">Xoa</button>
          </ng-container>
          <ng-container *ngIf="isSale() && canSaleAssign(c)">
            <button class="ghost" (click)="edit(c)">Chon hoc vien</button>
          </ng-container>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chua co lop hoc.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ editingId ? 'Chinh sua lop hoc' : 'Them lop hoc' }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label>Ten lop
          <input name="name" [(ngModel)]="form.name" required [readonly]="isSale()" />
        </label>

        <label *ngIf="canManage()">Loai lop
          <select name="classMode" [(ngModel)]="form.classMode" (ngModelChange)="onClassModeChange()">
            <option value="ONLINE">ONLINE</option>
            <option value="OFFLINE">OFFLINE</option>
          </select>
        </label>

        <label>Ma lop
          <ng-container *ngIf="!isSale(); else readonlyCode">
            <div class="searchable-dropdown">
              <input
                name="codeSearch"
                [(ngModel)]="codeSearch"
                (focus)="showCodeDropdown = true"
                (input)="showCodeDropdown = true"
                (blur)="hideCodeDropdown()"
                [placeholder]="form.classMode === 'OFFLINE' ? 'Tim san pham offline...' : 'Tim ma hoc sinh...'"
                autocomplete="off"
              />
              <div class="dropdown-list" *ngIf="showCodeDropdown">
                <div
                  class="dropdown-item"
                  *ngFor="let opt of filteredCodeOptions()"
                  (mousedown)="selectCodeOption(opt.value, opt.label)"
                >{{opt.label}}</div>
                <div class="dropdown-empty" *ngIf="!filteredCodeOptions().length">Khong tim thay ket qua</div>
              </div>
            </div>
            <small class="field-hint" *ngIf="form.code">Ma lop da chon: <strong>{{form.code}}</strong></small>
          </ng-container>
          <ng-template #readonlyCode>
            <input name="code" [(ngModel)]="form.code" readonly />
          </ng-template>
        </label>

        <label>Giao vien phu trach
          <select name="teacherId" [(ngModel)]="form.teacherId" required [disabled]="isSale()">
            <option value="" disabled [selected]="!form.teacherId">-- Chon giao vien --</option>
            <option *ngFor="let t of teachers()" [value]="t._id">{{t.fullName}} ({{t.email}})</option>
          </select>
        </label>
        <label *ngIf="!isOps()">Nhan vien Sale (tuy chon)
          <select name="saleId" [(ngModel)]="form.saleId" [disabled]="isSale()">
            <option value="">-- Khong chon --</option>
            <option *ngFor="let s of sales()" [value]="s._id">{{s.fullName}} ({{s.email}})</option>
          </select>
        </label>

        <div class="financial-info" *ngIf="canManage()">
          <h4>Thiet lap gia theo buoi</h4>
          <div class="pricing-grid">
            <label>{{ form.classMode === 'OFFLINE' ? 'Don gia thu / HS / buoi (VND)' : 'Gia thu HS / buoi (VND)' }}
              <input name="pricePerSession" [(ngModel)]="form.pricePerSession" type="number" min="0" step="10000" />
            </label>
            <label *ngIf="form.classMode === 'ONLINE'">Luong GV / buoi (VND)
              <input name="teacherPayPerSession" [(ngModel)]="form.teacherPayPerSession" type="number" min="0" step="10000" />
            </label>
            <label *ngIf="form.classMode === 'OFFLINE'">Luong GV / HS / buoi (VND)
              <input name="teacherPayPerStudent" [(ngModel)]="form.teacherPayPerStudent" type="number" min="0" step="10000" />
            </label>
            <label>Thoi luong co so (phut)
              <select name="baseDuration" [(ngModel)]="form.baseDuration">
                <option *ngFor="let d of standardDurations" [ngValue]="d">{{d}} phut</option>
              </select>
            </label>
            <label>Thoi luong buoi hoc (phut)
              <input name="sessionDuration" [(ngModel)]="form.sessionDuration" type="number" min="15" step="5" />
            </label>
          </div>

          <p class="mode-hint" *ngIf="form.classMode === 'OFFLINE'">
            OFFLINE: Luong GV = max(200,000, so HS diem danh x don gia GV/HS). Don gia thu HS va don gia tra GV la 2 gia tri tach rieng.
          </p>

          <div class="price-reference" *ngIf="form.pricePerSession">
            <h5>Bang gia tham chieu theo thoi luong</h5>
            <table class="ref-table">
              <thead>
                <tr>
                  <th>Thoi luong</th>
                  <th>Hoc phi HS</th>
                  <th>{{form.classMode === 'OFFLINE' ? 'Luong GV/HS' : 'Luong GV'}}</th>
                  <th>Loi nhuan</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let d of standardDurations" [class.active-row]="d === form.sessionDuration">
                  <td>{{d}} phut <span class="badge" *ngIf="d === form.baseDuration">co so</span></td>
                  <td>{{formatCurrency(calcProportional(form.pricePerSession, d))}}</td>
                  <td>{{formatCurrency(calcProportional(teacherBaseForForm(), d))}}</td>
                  <td [class]="getProfitClass(calcProportional(form.pricePerSession, d) - calcProportional(teacherBaseForForm(), d))">
                    {{formatCurrency(calcProportional(form.pricePerSession, d) - calcProportional(teacherBaseForForm(), d))}}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="financial-summary" *ngIf="form.pricePerSession || teacherBaseForForm()">
            <ng-container *ngIf="form.classMode === 'ONLINE'; else offlineSummary">
              <p><strong>So hoc vien:</strong> {{selectedStudents().length}}</p>
              <p><strong>Gia co so ({{form.baseDuration}}p):</strong> {{formatCurrency(form.pricePerSession)}}</p>
              <p><strong>Gia thuc te ({{form.sessionDuration}}p):</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration))}}</p>
              <p><strong>Luong GV thuc te ({{form.sessionDuration}}p):</strong> {{formatCurrency(calcProportional(form.teacherPayPerSession, form.sessionDuration))}}</p>
              <p [class]="getProfitClass(calcProportional(form.pricePerSession, form.sessionDuration) - calcProportional(form.teacherPayPerSession, form.sessionDuration))">
                <strong>Loi nhuan/buoi:</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration) - calcProportional(form.teacherPayPerSession, form.sessionDuration))}}
              </p>
            </ng-container>
            <ng-template #offlineSummary>
              <p><strong>Si so hien tai:</strong> {{selectedStudents().length}}</p>
              <p><strong>Don gia thu / HS ({{form.sessionDuration}}p):</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration))}}</p>
              <p><strong>Don gia tra GV / HS:</strong> {{formatCurrency(teacherBaseForForm())}}</p>
              <p><strong>Tong thu uoc tinh (neu di hoc du):</strong> {{formatCurrency(getOfflineEstimatedRevenue())}}</p>
              <p><strong>Luong GV uoc tinh:</strong> {{formatCurrency(getOfflineTeacherPayoutEstimate())}}</p>
              <p [class]="getProfitClass(getOfflineEstimatedRevenue() - getOfflineTeacherPayoutEstimate())">
                <strong>Loi nhuan uoc tinh:</strong> {{formatCurrency(getOfflineEstimatedRevenue() - getOfflineTeacherPayoutEstimate())}}
              </p>
            </ng-template>
          </div>
        </div>

        <section class="student-picker">
          <div class="student-column">
            <div class="column-header">
              <strong>Danh sach hoc vien</strong>
              <input [(ngModel)]="studentSearch" placeholder="Tim kiem hoc vien" name="studentSearch" />
            </div>
            <div class="student-list">
              <div class="student-row" *ngFor="let st of availableStudents()">
                <span>{{st.fullName}}</span>
                <button type="button" (click)="addStudent(st)">Them</button>
              </div>
              <p *ngIf="!availableStudents().length" class="muted">Khong tim thay hoc vien phu hop</p>
            </div>
          </div>
          <div class="student-column">
            <div class="column-header">
              <strong>Hoc vien trong lop</strong>
            </div>
            <div class="student-list">
              <div class="student-row" *ngFor="let st of selectedStudents()">
                <span>{{st.fullName}}</span>
                <button type="button" class="remove" (click)="removeStudent(st._id)">x</button>
              </div>
              <p *ngIf="!selectedStudents().length" class="muted">Chua chon hoc vien nao</p>
            </div>
          </div>
        </section>

        <div class="actions">
          <button type="submit" class="primary">{{ submitLabel }}</button>
          <button type="button" (click)="closeModal()">Huy</button>
        </div>
        <p class="error" *ngIf="error()">{{error()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; vertical-align:top; }
    thead { background:#f1f5f9; }
    .chip { display:inline-block; background:#e0f2fe; color:#0f172a; padding:2px 8px; border-radius:999px; margin:0 4px 4px 0; font-size:12px; }
    .primary { background:#2563eb; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
    .ghost { border:1px solid #94a3b8; background:transparent; padding:4px 10px; border-radius:4px; cursor:pointer; margin-right:6px; }
    .danger { border:1px solid #dc2626; background:#dc2626; color:#fff; padding:4px 10px; border-radius:4px; cursor:pointer; }
    .ghost:hover, .danger:hover { opacity:.85; }
    select, input { padding:6px 8px; border:1px solid #cbd5f5; border-radius:4px; width:100%; }
    .actions { display:flex; gap:8px; justify-content:flex-end; }
    .actions-cell { white-space:nowrap; width:140px; }
    .modal-backdrop { position:fixed; inset:0; background:rgba(15,23,42,.55); display:flex; align-items:center; justify-content:center; z-index:100; }
    .modal { background:#fff; padding:20px; border-radius:8px; width:640px; max-height:90vh; overflow:auto; box-shadow:0 12px 32px rgba(15,23,42,.2); }
    .modal form { display:flex; flex-direction:column; gap:12px; }
    .error { color:#dc2626; }
    .student-picker { display:flex; gap:16px; }
    .student-column { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:10px; background:#f8fafc; }
    .column-header { display:flex; flex-direction:column; gap:6px; margin-bottom:8px; }
    .student-list { max-height:200px; overflow:auto; background:#fff; border:1px solid #e2e8f0; border-radius:6px; }
    .student-row { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:14px; }
    .student-row:last-child { border-bottom:none; }
    .student-row button { border:1px solid #2563eb; background:#2563eb; color:#fff; border-radius:4px; padding:4px 10px; cursor:pointer; }
    .student-row button.remove { background:#dc2626; border-color:#dc2626; }
    .muted { text-align:center; padding:12px; color:#94a3b8; font-size:13px; margin:0; }
    .financial-info { border-top:1px solid #e2e8f0; padding-top:16px; margin-top:8px; }
    .financial-info h4 { margin:0 0 12px 0; color:#334155; }
    .pricing-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; }
    .ref-table { width:100%; margin-top:8px; border-collapse:collapse; font-size:13px; }
    .ref-table th, .ref-table td { padding:6px 10px; border:1px solid #e2e8f0; text-align:right; }
    .ref-table th { background:#f1f5f9; text-align:center; font-weight:600; }
    .ref-table td:first-child { text-align:left; }
    .ref-table .active-row { background:#eff6ff; font-weight:600; }
    .price-reference { margin-top:12px; }
    .price-reference h5 { margin:0 0 8px 0; color:#334155; font-size:14px; }
    .badge { display:inline-block; background:#2563eb; color:#fff; font-size:10px; padding:1px 6px; border-radius:99px; margin-left:4px; font-weight:500; }
    .financial-summary { background:#f1f5f9; padding:12px; border-radius:6px; margin-top:12px; }
    .financial-summary p { margin:4px 0; font-size:14px; }
    .mode-hint { margin:10px 0 0 0; font-size:12px; color:#475569; }
    .mode-badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:#dbeafe; color:#1d4ed8; letter-spacing:.3px; }
    .mode-badge.offline { background:#fee2e2; color:#b91c1c; }
    .profit-positive { color:#059669; font-weight:600; }
    .profit-negative { color:#dc2626; font-weight:600; }
    .profit-zero { color:#6b7280; }
    .searchable-dropdown { position:relative; }
    .dropdown-list { position:absolute; top:100%; left:0; right:0; z-index:50; background:#fff; border:1px solid #cbd5e1; border-top:none; border-radius:0 0 4px 4px; max-height:200px; overflow-y:auto; box-shadow:0 4px 12px rgba(15,23,42,.1); }
    .dropdown-item { padding:8px 10px; cursor:pointer; font-size:14px; border-bottom:1px solid #f1f5f9; }
    .dropdown-item:hover { background:#eff6ff; color:#1d4ed8; }
    .dropdown-item:last-child { border-bottom:none; }
    .dropdown-empty { padding:10px; text-align:center; color:#94a3b8; font-size:13px; }
    .field-hint { font-size:12px; color:#475569; margin-top:4px; display:block; }

    @media (max-width: 1024px) {
      .pricing-grid { grid-template-columns:1fr 1fr; }
    }

    @media (max-width: 768px) {
      .student-picker { flex-direction:column; }
      .modal { width:94vw; }
    }
  `]
})
export class ClassesComponent {
  classes = signal<ClassItem[]>([]);
  teachers = signal<UserItem[]>([]);
  sales = signal<UserItem[]>([]);
  students = signal<StudentItem[]>([]);
  products = signal<ProductItem[]>([]);
  studentSearch = '';
  codeSearch = '';
  showCodeDropdown = false;
  showModal = signal(false);
  error = signal('');
  editingId: string | null = null;
  form = this.blankForm();
  submitLabel = 'Luu';
  standardDurations = [30, 40, 50, 60, 70, 80, 90, 120];

  constructor(
    private classService: ClassService,
    private userService: UserService,
    private studentService: StudentService,
    private productService: ProductService,
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
      saleId: '',
      classMode: 'ONLINE' as 'ONLINE' | 'OFFLINE',
      studentIds: [] as string[],
      pricePerSession: 0,
      teacherPayPerSession: 0,
      teacherPayPerStudent: 0,
      baseDuration: 60,
      sessionDuration: 60,
      revenuePerStudent: 0,
      teacherSalaryCost: 0,
    };
  }

  async loadLookups() {
    const [users, studs, prods] = await Promise.all([
      this.userService.listDirectory(),
      this.studentService.list(),
      this.productService.list(),
    ]);
    this.teachers.set(users.filter((u) => u.role === 'TEACHER'));
    this.sales.set(users.filter((u) => u.role === 'SALE'));
    this.students.set(studs);
    this.products.set(prods);
  }

  async reload() {
    const data = await this.classService.list();
    this.classes.set(data);
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

  onClassModeChange() {
    this.form.code = '';
    this.codeSearch = '';
    this.showCodeDropdown = false;
  }

  hideCodeDropdown() {
    setTimeout(() => { this.showCodeDropdown = false; }, 150);
  }

  openModal() {
    if (!this.canManage()) return;
    this.form = this.blankForm();
    this.editingId = null;
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
    this.codeSearch = '';
    this.showCodeDropdown = false;
    this.submitLabel = 'Luu';
  }

  async submit() {
    if (this.isSale()) {
      if (!this.editingId) return;
      if (!this.form.studentIds.length) {
        this.error.set('Vui long chon it nhat mot hoc vien');
        return;
      }
      const okSale = await this.classService.assignStudents(this.editingId, this.form.studentIds);
      if (!okSale) {
        this.error.set('Khong the them hoc vien');
        return;
      }
      this.closeModal();
      this.reload();
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

    const teacherPayPerSession = this.form.classMode === 'ONLINE'
      ? (this.form.teacherPayPerSession || 0)
      : 0;
    const teacherPayPerStudent = this.form.classMode === 'OFFLINE'
      ? (this.form.teacherPayPerStudent || 0)
      : 0;

    const payload = {
      name: this.form.name.trim(),
      code: this.form.code.trim(),
      teacherId: this.form.teacherId,
      saleId: this.form.saleId || undefined,
      classMode: this.form.classMode || 'ONLINE',
      studentIds: [...this.form.studentIds],
      pricePerSession: this.form.pricePerSession || 0,
      teacherPayPerSession,
      teacherPayPerStudent,
      baseDuration: this.form.baseDuration || 60,
      sessionDuration: this.form.sessionDuration || 60,
      revenuePerStudent: this.form.revenuePerStudent || 0,
      teacherSalaryCost: this.form.teacherSalaryCost || 0,
    };

    const ok = this.editingId
      ? await this.classService.update(this.editingId, payload)
      : await this.classService.create(payload);

    if (!ok) {
      this.error.set('Khong the luu lop hoc');
      return;
    }

    this.closeModal();
    this.reload();
  }

  edit(classItem: ClassItem) {
    if (this.isSale() && !this.canSaleAssign(classItem)) return;
    this.editingId = classItem._id;
    const classStudentIds = classItem.students?.map((s) => s._id) || [];
    const myStudents = new Set(this.students().map((s) => s._id));

    this.form = {
      name: classItem.name,
      code: classItem.code,
      teacherId: classItem.teacher?._id || '',
      saleId: classItem.sale?._id || '',
      classMode: classItem.classMode || 'ONLINE',
      studentIds: this.isSale() ? classStudentIds.filter((id) => myStudents.has(id)) : classStudentIds,
      pricePerSession: classItem.pricePerSession || 0,
      teacherPayPerSession: classItem.teacherPayPerSession || 0,
      teacherPayPerStudent: classItem.teacherPayPerStudent || 0,
      baseDuration: classItem.baseDuration || 60,
      sessionDuration: classItem.sessionDuration || 60,
      revenuePerStudent: classItem.revenuePerStudent || 0,
      teacherSalaryCost: classItem.teacherSalaryCost || 0,
    };

    this.error.set('');
    this.studentSearch = '';
    this.codeSearch = classItem.code;
    this.showCodeDropdown = false;
    this.submitLabel = this.isSale() ? 'Them hoc vien' : 'Cap nhat';
    this.showModal.set(true);
  }

  async remove(classItem: ClassItem) {
    if (!confirm(`Xoa lop ${classItem.name}?`)) return;
    const ok = await this.classService.remove(classItem._id);
    if (!ok) {
      alert('Khong the xoa lop');
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

  isDirector() {
    return this.auth.userSignal()?.role === 'DIRECTOR';
  }

  isOps() {
    return this.auth.userSignal()?.role === 'OPS';
  }

  isSale() {
    return this.auth.userSignal()?.role === 'SALE';
  }

  isTeacher() {
    return this.auth.userSignal()?.role === 'TEACHER';
  }

  canManage() {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }

  canSaleAssign(classItem: ClassItem) {
    const current = this.auth.userSignal();
    return current?.role === 'SALE' && classItem.sale?._id === current.sub;
  }

  isOfflineClass(c: ClassItem): boolean {
    return (c.classMode || 'ONLINE') === 'OFFLINE';
  }

  teacherBaseForForm(): number {
    return this.form.classMode === 'OFFLINE'
      ? (this.form.teacherPayPerStudent || 0)
      : (this.form.teacherPayPerSession || 0);
  }

  formatTeacherBase(c: ClassItem): string {
    if (this.isOfflineClass(c)) {
      return `${this.formatCurrency(c.teacherPayPerStudent)} / HS`;
    }
    return this.formatCurrency(c.teacherPayPerSession);
  }

  formatTeacherActual(c: ClassItem): string {
    if (this.isOfflineClass(c)) return 'Theo diem danh (min 200k)';
    return this.formatCurrency(c.actualTeacherPayPerSession ?? c.teacherPayPerSession);
  }

  formatCurrency(amount?: number): string {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }

  getProfitClass(profit?: number): string {
    if (!profit && profit !== 0) return '';
    if (profit > 0) return 'profit-positive';
    if (profit < 0) return 'profit-negative';
    return 'profit-zero';
  }

  calcProportional(basePrice: number | undefined, targetDuration: number): number {
    if (!basePrice) return 0;
    const base = this.form.baseDuration || 60;
    return Math.round(basePrice * (targetDuration / base));
  }

  getOfflineEstimatedRevenue(): number {
    const perStudentCharge = this.calcProportional(this.form.pricePerSession, this.form.sessionDuration || 60);
    return perStudentCharge * this.selectedStudents().length;
  }

  getOfflineTeacherPayoutEstimate(): number {
    const attendedCount = this.selectedStudents().length;
    if (attendedCount <= 0) return 0;
    return Math.max(200_000, Math.round(attendedCount * (this.form.teacherPayPerStudent || 0)));
  }

  getProfit(c: ClassItem): number {
    if (typeof c.profit === 'number') return c.profit;

    if (this.isOfflineClass(c)) {
      const studentCount = c.studentCount ?? c.students?.length ?? 0;
      const pricePerStudent = c.actualPricePerSession ?? c.pricePerSession ?? 0;
      const teacherPerStudent = c.teacherPayPerStudent ?? 0;
      return (pricePerStudent * studentCount) - (teacherPerStudent * studentCount);
    }

    const price = c.actualPricePerSession ?? c.pricePerSession ?? 0;
    const pay = c.actualTeacherPayPerSession ?? c.teacherPayPerSession ?? 0;
    return price - pay;
  }
}
