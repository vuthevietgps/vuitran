import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ClassDurationPreview,
  ClassEditHistoryEntry,
  ClassItem,
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
    <button class="primary" (click)="openModal()" *ngIf="canCreateClass()">+ Them lop hoc</button>
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
        <td>
          <div>{{c.name}}</div>
          <small
            class="request-status pending"
            *ngIf="c.pendingSaleUpdate?.status === 'PENDING'">
            {{ c.pendingSaleUpdate?.requestType === 'DURATION_CHANGE'
              ? 'Sale dang cho Director duyet doi thoi luong'
              : 'Sale dang cho duyet sua lop' }}
          </small>
          <small
            class="request-status rejected"
            *ngIf="c.pendingSaleUpdate?.status === 'REJECTED'">
            {{ c.pendingSaleUpdate?.requestType === 'DURATION_CHANGE'
              ? 'Yeu cau doi thoi luong da bi tu choi'
              : 'Yeu cau sua lop da bi tu choi' }}
          </small>
        </td>
        <td>
          <span class="mode-badge" [class.offline]="isOfflineClass(c)">
            {{isOfflineClass(c) ? 'OFFLINE' : 'ONLINE'}}
          </span>
        </td>
        <td>{{c.teacher?.fullName || '-'}}</td>
        <td>
          <div class="student-chip-list" *ngIf="c.students?.length; else emptyStudents">
            <span class="student-chip" *ngFor="let s of c.students">
              <strong>{{s.fullName}}</strong>
              <small *ngIf="s.studentCode">{{s.studentCode}}</small>
            </span>
          </div>
          <ng-template #emptyStudents>
            <span>Chua co</span>
          </ng-template>
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
            <button class="ghost" (click)="edit(c, 'config')">Sua GV/luong</button>
            <button class="ghost" (click)="edit(c, 'duration')">Sua thoi luong</button>
            <button class="ghost" (click)="edit(c, 'assign')">Chon hoc vien</button>
          </ng-container>
        </td>
      </tr>
    </tbody>
  </table>
  <ng-template #empty><p>Chua co lop hoc.</p></ng-template>

  <div class="modal-backdrop" *ngIf="showModal()">
    <div class="modal">
      <h3>{{ getModalTitle() }}</h3>
      <form (ngSubmit)="submit()" #f="ngForm">
        <label *ngIf="isSaleCreateMode()">Hoa don da duyet
          <select name="invoiceId" [(ngModel)]="form.invoiceId" (ngModelChange)="onInvoiceChange($event)" required>
            <option value="">-- Chon hoa don de tao lop --</option>
            <option *ngFor="let invoice of availableSaleInvoices()" [value]="invoice._id">
              {{invoice.invoiceNumber}} - {{invoice.studentId.fullName}} - {{formatCurrency(invoice.amount)}}
            </option>
          </select>
        </label>
        <small class="field-hint" *ngIf="isSaleCreateMode()">
          Sale chi duoc tao lop tu hoa don da duyet va chua gan vao lop nao.
        </small>
        <p class="muted sale-empty" *ngIf="isSaleCreateMode() && !availableSaleInvoices().length">
          Chua co hoa don nao du dieu kien de tao lop.
        </p>
        <ng-container *ngIf="isSaleCreateMode()">
          <div class="invoice-summary" *ngIf="selectedInvoice() as invoice">
            <p><strong>Hoc vien:</strong> {{invoice.studentId.fullName}} ({{invoice.studentId.studentCode || 'Khong co ma'}})</p>
            <p><strong>Loai lop:</strong> {{invoice.classType || 'ONLINE'}}</p>
            <p><strong>Hoc phi:</strong> {{formatCurrency(invoice.amount)}}</p>
          </div>
        </ng-container>

        <label *ngIf="isSaleOfflineExistingMode()">Lop offline san co
          <select
            name="existingOfflineClassId"
            [(ngModel)]="form.existingOfflineClassId"
            (ngModelChange)="onSaleOfflineClassChange($event)"
            required>
            <option value="">-- Chon lop offline --</option>
            <option *ngFor="let classItem of saleOfflineOptions()" [value]="classItem._id">
              {{classItem.name}} ({{classItem.code}}) - GV: {{classItem.teacher?.fullName || 'Chua gan'}} - Si so: {{classItem.studentCount ?? classItem.students?.length ?? 0}}
            </option>
          </select>
        </label>
        <small class="field-hint" *ngIf="isSaleOfflineExistingMode()">
          Sale chi chon lop offline da co san va them hoc sinh theo hoa don vao lop nay.
        </small>
        <p class="muted sale-empty" *ngIf="isSaleOfflineExistingMode() && !saleOfflineOptions().length">
          Chua co lop offline nao san sang de them hoc sinh.
        </p>
        <div class="invoice-summary" *ngIf="isSaleOfflineExistingMode() && selectedSaleOfflineClass() as offlineClass">
          <p><strong>Lop da chon:</strong> {{offlineClass.name}} ({{offlineClass.code}})</p>
          <p><strong>Giao vien:</strong> {{offlineClass.teacher?.fullName || 'Chua gan'}}</p>
          <p><strong>Si so hien tai:</strong> {{offlineClass.studentCount ?? offlineClass.students?.length ?? 0}}</p>
        </div>

        <label>Ten lop
          <input
            name="name"
            [(ngModel)]="form.name"
            required
            [readonly]="isSaleAssignMode() || isSaleDurationEditMode() || isSaleConfigEditMode() || isSaleOfflineExistingMode()" />
        </label>

        <label *ngIf="canConfigureClassForm()">Loai lop
          <select
            name="classMode"
            [(ngModel)]="form.classMode"
            (ngModelChange)="onClassModeChange()"
            [disabled]="isSaleDurationEditMode() || isSaleConfigEditMode()">
            <option value="ONLINE">ONLINE</option>
            <option value="OFFLINE">OFFLINE</option>
          </select>
        </label>

        <label *ngIf="canConfigureClassForm() && isSale()">Quan ly goi san pham
          <select
            name="productPackageId"
            [(ngModel)]="form.productPackageId"
            [disabled]="isSaleDurationEditMode() || isSaleConfigEditMode() || isSaleOfflineExistingMode()">
            <option value="">-- Chon goi san pham --</option>
            <option *ngFor="let product of availableProductPackages()" [value]="product._id">
              {{product.name}}{{product.code ? ' (' + product.code + ')' : ''}}
            </option>
          </select>
        </label>
        <small class="field-hint" *ngIf="isSaleConfigMode()">
          Danh sach lay tu chuc nang Quan ly goi san pham va duoc loc theo loai lop dang chon.
        </small>
        <p class="muted sale-empty" *ngIf="isSaleConfigMode() && !availableProductPackages().length">
          Chua co goi san pham nao phu hop voi loai lop hien tai.
        </p>

        <label>Ma lop
          <ng-container *ngIf="canManage(); else readonlyCode">
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
            <input
              name="code"
              [(ngModel)]="form.code"
              [readonly]="isSaleCreateMode() || isSaleAssignMode() || isSaleDurationEditMode() || isSaleConfigEditMode()"
            />
          </ng-template>
        </label>

        <label>Giao vien phu trach
          <select name="teacherId" [(ngModel)]="form.teacherId" required [disabled]="isSaleAssignMode() || isSaleDurationEditMode() || isSaleOfflineExistingMode()">
            <option value="" disabled [selected]="!form.teacherId">-- Chon giao vien --</option>
            <option *ngFor="let t of teachers()" [value]="t._id">{{t.fullName}} ({{t.email}})</option>
          </select>
        </label>
        <small class="field-hint" *ngIf="isSaleCreateMode()">
          Chi hien thi giao vien da duoc gan voi sale cua ban.
        </small>
        <p class="muted sale-empty" *ngIf="isSaleCreateMode() && !teachers().length">
          Chua co giao vien nao duoc gan cho sale nay.
        </p>
        <label *ngIf="!isOps() && !isSale()">Nhan vien Sale (tuy chon)
          <select name="saleId" [(ngModel)]="form.saleId" [disabled]="isSale()">
            <option value="">-- Khong chon --</option>
            <option *ngFor="let s of sales()" [value]="s._id">{{s.fullName}} ({{s.email}})</option>
          </select>
        </label>

        <div class="financial-info" *ngIf="canConfigureClassForm()">
          <h4>Thiet lap gia theo buoi</h4>
          <p class="mode-hint" *ngIf="isSaleDurationEditMode()">
            Sale chi duoc gui yeu cau doi thoi luong. Director duyet xong, cac buoi tao sau do se tinh theo snapshot moi cua lop nay.
          </p>
          <p class="mode-hint" *ngIf="isSaleConfigEditMode()">
            Sale chi gui yeu cau doi giao vien phu trach va luong co so giao vien. Ma lop va du lieu diem danh cu duoc giu nguyen.
          </p>
          <p class="mode-hint" *ngIf="isSaleOfflineExistingMode()">
            OFFLINE san co: Sale khong tao lop moi va khong sua cau hinh lop, chi them hoc sinh vao lop da chon.
          </p>
          <div class="pricing-grid">
            <label>{{ form.classMode === 'OFFLINE' ? 'Don gia thu / HS / buoi (VND)' : 'Gia thu HS / buoi (VND)' }}
              <input
                name="pricePerSession"
                [(ngModel)]="form.pricePerSession"
                type="number"
                min="0"
                step="10000"
                [readonly]="isSaleDurationEditMode() || isSaleConfigEditMode() || isSaleOfflineExistingMode()" />
            </label>
            <label *ngIf="form.classMode === 'ONLINE'">Luong GV / buoi (VND)
              <input
                name="teacherPayPerSession"
                [(ngModel)]="form.teacherPayPerSession"
                type="number"
                min="0"
                step="10000"
                [readonly]="isSaleDurationEditMode() || isSaleOfflineExistingMode()" />
            </label>
            <label *ngIf="form.classMode === 'OFFLINE'">Luong GV / HS / buoi (VND)
              <input
                name="teacherPayPerStudent"
                [(ngModel)]="form.teacherPayPerStudent"
                type="number"
                min="0"
                step="10000"
                [readonly]="isSaleDurationEditMode() || isSaleOfflineExistingMode()" />
            </label>
            <label>Thoi luong co so (phut)
              <select
                name="baseDuration"
                [(ngModel)]="form.baseDuration"
                [disabled]="isSaleConfigEditMode() || isSaleDurationEditMode() || isSaleOfflineExistingMode()">
                <option *ngFor="let d of standardDurations" [ngValue]="d">{{d}} phut</option>
              </select>
            </label>
            <label>Thoi luong buoi hoc (phut)
              <input
                name="sessionDuration"
                [(ngModel)]="form.sessionDuration"
                type="number"
                min="15"
                step="5"
                [readonly]="isSaleConfigEditMode() || isSaleOfflineExistingMode()" />
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
                  <td>{{formatTeacherCurrency(calcTeacherProportional(teacherBaseForForm(), d))}}</td>
                  <td [class]="getProfitClass(calcProportional(form.pricePerSession, d) - calcTeacherProportional(teacherBaseForForm(), d))">
                    {{formatCurrency(calcProportional(form.pricePerSession, d) - calcTeacherProportional(teacherBaseForForm(), d))}}
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
              <p><strong>Luong GV thuc te ({{form.sessionDuration}}p):</strong> {{formatTeacherCurrency(calcTeacherProportional(form.teacherPayPerSession, form.sessionDuration))}}</p>
              <p [class]="getProfitClass(calcProportional(form.pricePerSession, form.sessionDuration) - calcTeacherProportional(form.teacherPayPerSession, form.sessionDuration))">
                <strong>Loi nhuan/buoi:</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration) - calcTeacherProportional(form.teacherPayPerSession, form.sessionDuration))}}
              </p>
            </ng-container>
            <ng-template #offlineSummary>
              <p><strong>{{isSaleOfflineExistingMode() ? 'Si so du kien sau khi them:' : 'Si so hien tai:'}}</strong> {{getOfflineStudentCount()}}</p>
              <p><strong>Don gia thu / HS ({{form.sessionDuration}}p):</strong> {{formatCurrency(calcProportional(form.pricePerSession, form.sessionDuration))}}</p>
              <p><strong>Don gia tra GV / HS:</strong> {{formatTeacherCurrency(teacherBaseForForm())}}</p>
              <p><strong>Tong thu uoc tinh (neu di hoc du):</strong> {{formatCurrency(getOfflineEstimatedRevenue())}}</p>
              <p><strong>Luong GV uoc tinh:</strong> {{formatTeacherCurrency(getOfflineTeacherPayoutEstimate())}}</p>
              <p [class]="getProfitClass(getOfflineEstimatedRevenue() - getOfflineTeacherPayoutEstimate())">
                <strong>Loi nhuan uoc tinh:</strong> {{formatCurrency(getOfflineEstimatedRevenue() - getOfflineTeacherPayoutEstimate())}}
              </p>
            </ng-template>
          </div>
        </div>

        <section class="student-picker" *ngIf="canSelectStudents()">
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

        <section class="class-history" *ngIf="editingClass() as activeClass">
          <div class="class-history-head">
            <h4>Lich su lop hoc</h4>
            <span *ngIf="activeClass.editHistory?.length">{{ activeClass.editHistory?.length }} lan</span>
          </div>

          <div class="pending-preview" *ngIf="activeClass.pendingSaleUpdate?.status === 'PENDING'">
            <strong>Dang cho duyet</strong>
            <div class="history-change" *ngFor="let change of pendingClassChanges(activeClass)">
              <span class="history-label">{{ change.label }}:</span>
              <span>{{ change.beforeValue || '(trong)' }} -> {{ change.afterValue || '(trong)' }}</span>
            </div>
            <div class="duration-preview-card" *ngIf="activeClass.pendingSaleUpdate?.durationPreview as preview">
              <div><strong>Thoi luong:</strong> {{ preview.oldBaseDuration }}/{{ preview.oldSessionDuration }} -> {{ preview.newBaseDuration }}/{{ preview.newSessionDuration }} phut</div>
              <div class="duration-preview-student" *ngFor="let student of preview.students">
                <strong>{{ student.studentName || 'Hoc sinh' }} <span *ngIf="student.studentCode">({{ student.studentCode }})</span></strong>
                <span>Con lai: {{ formatSessionCount(student.totalSessionsRemainingBefore) }} -> {{ formatSessionCount(student.totalSessionsRemainingAfter) }} buoi</span>
                <span>Tong quy doi du kien: {{ formatSessionCount(student.projectedTotalSessionsBefore) }} -> {{ formatSessionCount(student.projectedTotalSessionsAfter) }} buoi</span>
              </div>
            </div>
          </div>

          <p class="history-empty" *ngIf="!activeClass.editHistory?.length && activeClass.pendingSaleUpdate?.status !== 'PENDING'">
            Chua co lich su chinh sua lop hoc.
          </p>

          <div class="history-list" *ngIf="activeClass.editHistory?.length">
            <article class="history-item" *ngFor="let entry of classEditHistory(activeClass)">
              <div class="history-item-head">
                <strong>{{ classHistoryActionLabel(entry.action) }}</strong>
                <span>{{ formatHistoryTimestamp(entry.editedAt) }}</span>
              </div>
              <div class="history-role" *ngIf="entry.editedByName || entry.editedByRole">
                {{ entry.editedByName || 'He thong' }} <span *ngIf="entry.editedByRole">({{ entry.editedByRole }})</span>
              </div>
              <div class="history-change" *ngFor="let change of entry.changes">
                <span class="history-label">{{ change.label }}:</span>
                <span>{{ change.beforeValue || '(trong)' }} -> {{ change.afterValue || '(trong)' }}</span>
              </div>
              <div class="duration-preview-card" *ngIf="entry.durationPreview as preview">
                <div><strong>Thoi luong:</strong> {{ preview.oldBaseDuration }}/{{ preview.oldSessionDuration }} -> {{ preview.newBaseDuration }}/{{ preview.newSessionDuration }} phut</div>
                <div class="duration-preview-student" *ngFor="let student of preview.students">
                  <strong>{{ student.studentName || 'Hoc sinh' }} <span *ngIf="student.studentCode">({{ student.studentCode }})</span></strong>
                  <span>Con lai: {{ formatSessionCount(student.totalSessionsRemainingBefore) }} -> {{ formatSessionCount(student.totalSessionsRemainingAfter) }} buoi</span>
                  <span>Hoc phi: {{ formatSessionCount(student.paidSessionsRemainingBefore) }} -> {{ formatSessionCount(student.paidSessionsRemainingAfter) }}, tang: {{ formatSessionCount(student.bonusSessionsRemainingBefore) }} -> {{ formatSessionCount(student.bonusSessionsRemainingAfter) }}</span>
                </div>
              </div>
              <div class="history-note" *ngIf="entry.note">{{ entry.note }}</div>
            </article>
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

  <div class="modal-backdrop" *ngIf="showStudentConfigModal()">
    <div class="modal student-config-modal">
      <h3>Sua hoc sinh trong lop</h3>

      <div class="student-modal-summary" *ngIf="selectedStudentConfigStudent && selectedStudentConfigClass">
        <p><strong>Hoc sinh:</strong> {{selectedStudentConfigStudent.fullName}} <span *ngIf="selectedStudentConfigStudent.studentCode">({{selectedStudentConfigStudent.studentCode}})</span></p>
        <p><strong>Lop hoc:</strong> {{selectedStudentConfigClass.name}} ({{selectedStudentConfigClass.code}})</p>
        <p><strong>Tong so buoi hien tai:</strong> {{formatSessionCount(getSelectedStudentCurrentDuration().totalSessions)}}</p>
      </div>

      <form (ngSubmit)="submitStudentConfig()" *ngIf="selectedStudentConfigClass && selectedStudentConfigStudent">
        <section class="student-edit-section">
          <div class="student-edit-head">
            <h4>Giao vien phu trach</h4>
            <p>GV1 giu nguyen, chi bo sung them GV2 va GV3.</p>
          </div>

          <div class="slot-grid">
            <div class="slot-card" *ngFor="let slot of selectedStudentTeacherSlots()">
              <div class="slot-title">GV{{slot.slotIndex}}</div>
              <strong>{{getTeacherSlotDisplay(slot)}}</strong>
              <small>{{slot.slotType === 'INITIAL' ? 'Mac dinh ban dau' : 'Bo sung sau'}}</small>
            </div>

            <div class="slot-card editable" *ngIf="canAppendTeacherSlot(); else teacherLocked">
              <div class="slot-title">GV{{nextTeacherSlotIndex()}}</div>
              <label>Chon giao vien
                <select name="studentConfigTeacherId" [(ngModel)]="studentConfigForm.teacherId">
                  <option value="">-- Giu nguyen giao vien hien tai --</option>
                  <option *ngFor="let teacher of availableStudentConfigTeachers()" [value]="teacher._id">
                    {{teacher.fullName}}{{teacher.userCode ? ' (' + teacher.userCode + ')' : ''}}
                  </option>
                </select>
              </label>
            </div>
            <ng-template #teacherLocked>
              <div class="slot-card locked">
                <div class="slot-title">GV da day</div>
                <strong>Da dat toi da 3 moc</strong>
                <small>Muon doi tiep can tao lop hoac quy trinh moi.</small>
              </div>
            </ng-template>
          </div>
        </section>

        <section class="student-edit-section">
          <div class="student-edit-head">
            <h4>Thoi luong buoi hoc</h4>
            <p>Lan 1 la cau hinh goc. Chi bo sung them Lan 2 va Lan 3.</p>
          </div>

          <p class="field-hint">
            Thoi luong co so hien tai: <strong>{{getSelectedStudentCurrentDuration().baseDuration}} phut</strong>
          </p>

          <div class="slot-grid">
            <div class="slot-card" *ngFor="let slot of selectedStudentDurationSlots()">
              <div class="slot-title">Lan {{slot.slotIndex}}</div>
              <strong>{{slot.sessionDuration}} phut</strong>
              <small>Tong so buoi: {{formatSessionCount(slot.totalSessions)}}</small>
            </div>

            <div class="slot-card editable" *ngIf="canAppendDurationSlot(); else durationLocked">
              <div class="slot-title">Lan {{nextDurationSlotIndex()}}</div>
              <label>Thoi luong buoi hoc moi
                <select name="studentConfigSessionDuration" [(ngModel)]="studentConfigForm.sessionDuration">
                  <option [ngValue]="null">-- Giu nguyen thoi luong hien tai --</option>
                  <option *ngFor="let duration of standardDurations" [ngValue]="duration">{{duration}} phut</option>
                </select>
              </label>
            </div>
            <ng-template #durationLocked>
              <div class="slot-card locked">
                <div class="slot-title">Thoi luong</div>
                <strong>Da dat toi da 3 moc</strong>
                <small>He thong giu nguyen lich su Lan 1-Lan 3.</small>
              </div>
            </ng-template>
          </div>
        </section>

        <div class="actions">
          <button type="submit" class="primary">Luu thay doi hoc sinh</button>
          <button type="button" (click)="closeStudentConfigModal()">Huy</button>
        </div>
        <p class="error" *ngIf="studentConfigError()">{{studentConfigError()}}</p>
      </form>
    </div>
  </div>
  `,
  styles: [`
    .page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .data { width:100%; border-collapse:collapse; background:#fff; }
    th, td { padding:8px; border:1px solid #e2e8f0; vertical-align:top; }
    thead { background:#f1f5f9; }
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
    .student-chip-list { display:flex; flex-wrap:wrap; gap:8px; min-width:240px; }
    .student-chip { display:inline-flex; align-items:center; gap:8px; border:1px solid #dbeafe; background:#f8fbff; border-radius:999px; padding:6px 10px; }
    .student-chip small { color:#475569; }
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
    .invoice-summary { border:1px solid #dbeafe; background:#eff6ff; padding:10px 12px; border-radius:6px; }
    .invoice-summary p { margin:4px 0; font-size:13px; }
    .sale-empty { padding:8px 0; }
    .request-status { display:block; margin-top:4px; font-size:12px; }
    .request-status.pending { color:#b45309; }
    .request-status.rejected { color:#b91c1c; }
    .student-config-modal { width:760px; }
    .student-modal-summary { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; }
    .student-modal-summary p { margin:4px 0; font-size:14px; }
    .student-edit-section { border-top:1px solid #e2e8f0; padding-top:12px; }
    .student-edit-head h4 { margin:0 0 4px 0; }
    .student-edit-head p { margin:0; color:#475569; font-size:13px; }
    .slot-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:12px; }
    .slot-card { border:1px solid #dbeafe; background:#f8fbff; border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:6px; }
    .slot-card.editable { background:#fff; border-style:dashed; }
    .slot-card.locked { background:#f8fafc; border-color:#cbd5e1; }
    .slot-title { font-size:12px; text-transform:uppercase; letter-spacing:.4px; color:#475569; font-weight:700; }
    .slot-card small { color:#64748b; }

    @media (max-width: 1024px) {
      .pricing-grid { grid-template-columns:1fr 1fr; }
    }

    @media (max-width: 768px) {
      .student-picker { flex-direction:column; }
      .modal { width:94vw; }
      .student-config-modal { width:94vw; }
    }
  `]
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

  async loadLookups() {
    const saleMode = this.isSale();
    const [users, teacherProfiles, studs, prods, invoices] = await Promise.all([
      saleMode ? Promise.resolve([] as UserItem[]) : this.userService.listDirectory(),
      this.teacherService.getAllTeachers(),
      this.studentService.list(),
      this.productService.list(),
      saleMode ? this.invoiceService.list() : Promise.resolve([] as InvoiceItem[]),
    ]);
    this.teacherProfiles.set(teacherProfiles);
    const teachersFromProfiles = teacherProfiles
      .map((profile) => this.mapTeacherProfileToUserItem(profile))
      .filter((teacher): teacher is UserItem => !!teacher);
    const teacherMap = new Map<string, UserItem>();
    [...users.filter((u) => u.role === 'TEACHER'), ...teachersFromProfiles].forEach((teacher) => {
      teacherMap.set(teacher._id, teacher);
    });
    this.teachers.set(Array.from(teacherMap.values()));
    this.sales.set(users.filter((u) => u.role === 'SALE'));
    this.students.set(studs);
    this.products.set(prods);
    this.invoices.set(invoices);
  }

  async reload() {
    const [data, invoices, saleOfflineOptions] = await Promise.all([
      this.classService.list(),
      this.isSale() ? this.invoiceService.list() : Promise.resolve([] as InvoiceItem[]),
      this.isSale() ? this.classService.listSaleOfflineOptions() : Promise.resolve([] as ClassItem[]),
    ]);
    this.classes.set(data);
    this.saleOfflineOptions.set(saleOfflineOptions);
    if (this.editingId) {
      this.editingClass.set(data.find((item) => item._id === this.editingId) || null);
    }
    if (this.isSale()) {
      this.invoices.set(invoices);
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
      const [invoices, saleOfflineOptions] = await Promise.all([
        this.invoiceService.list(),
        this.classService.listSaleOfflineOptions(),
      ]);
      this.invoices.set(invoices);
      this.saleOfflineOptions.set(saleOfflineOptions);
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
    const currentTeacherId = this.getCurrentStudentTeacherId(classItem, student._id);
    const currentDuration = this.getCurrentStudentDuration(classItem, student._id);

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

    const pricePerSession = this.roundMoneyToThousand(this.form.pricePerSession || 0);
    const teacherPayPerSession = this.form.classMode === 'ONLINE'
      ? this.roundMoneyDownToThousand(this.form.teacherPayPerSession || 0)
      : 0;
    const teacherPayPerStudent = this.form.classMode === 'OFFLINE'
      ? this.roundMoneyDownToThousand(this.form.teacherPayPerStudent || 0)
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
      revenuePerStudent: this.roundMoneyToThousand(this.form.revenuePerStudent || 0),
      teacherSalaryCost: this.roundMoneyDownToThousand(this.form.teacherSalaryCost || 0),
      ...(this.canSubmitStudentSelection() ? { studentIds: [...this.form.studentIds] } : {}),
    };

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

  currentUserId() {
    return this.auth.userSignal()?.sub || '';
  }

  canManage() {
    const role = this.auth.userSignal()?.role;
    return role === 'DIRECTOR' || role === 'OPS';
  }

  canCreateClass() {
    return this.canManage() || this.isSale();
  }

  canSaleAssign(classItem: ClassItem) {
    const current = this.auth.userSignal();
    return current?.role === 'SALE' && classItem.sale?._id === current.sub;
  }

  isSaleCreateMode() {
    return this.isSale() && !this.editingId;
  }

  isSaleDurationEditMode() {
    return this.isSale() && !!this.editingId && this.editMode === 'duration';
  }

  isSaleConfigEditMode() {
    return this.isSale() && !!this.editingId && this.editMode === 'config';
  }

  isSaleConfigMode() {
    return this.isSaleCreateMode() || this.isSaleConfigEditMode();
  }

  isSaleAssignMode() {
    return this.isSale() && !!this.editingId && this.editMode === 'assign';
  }

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

  canEditStudentConfig(classItem: ClassItem) {
    return this.canManage() || this.canSaleAssign(classItem);
  }

  private getStudentConfig(classItem: ClassItem | null, studentId: string): StudentClassConfig | null {
    if (!classItem?.studentConfigs?.length) {
      return null;
    }
    return classItem.studentConfigs.find((config) => {
      const configuredStudentId =
        typeof config.studentId === 'string'
          ? config.studentId
          : config.studentId?._id;
      return configuredStudentId === studentId;
    }) || null;
  }

  private sortTeacherSlots(slots?: StudentTeacherSlot[] | null): StudentTeacherSlot[] {
    return [...(slots || [])].sort((left, right) => left.slotIndex - right.slotIndex);
  }

  private sortDurationSlots(slots?: StudentDurationSlot[] | null): StudentDurationSlot[] {
    return [...(slots || [])].sort((left, right) => left.slotIndex - right.slotIndex);
  }

  private resolveMemberId(member?: ClassMember | string | null): string {
    if (!member) return '';
    return typeof member === 'string' ? member : member._id;
  }

  private resolveMemberName(member?: ClassMember | string | null): string {
    if (!member) return '';
    if (typeof member !== 'string') {
      return member.fullName || '';
    }
    return this.teachers().find((teacher) => teacher._id === member)?.fullName || '';
  }

  private getCurrentTeacherSlot(classItem: ClassItem, studentId: string): StudentTeacherSlot | null {
    const slots = this.sortTeacherSlots(this.getStudentConfig(classItem, studentId)?.teacherSlots);
    return slots.length ? slots[slots.length - 1] : null;
  }

  private getCurrentDurationSlot(classItem: ClassItem, studentId: string): StudentDurationSlot | null {
    const slots = this.sortDurationSlots(this.getStudentConfig(classItem, studentId)?.durationSlots);
    return slots.length ? slots[slots.length - 1] : null;
  }

  getCurrentStudentTeacherId(classItem: ClassItem, studentId: string): string {
    return this.resolveMemberId(this.getCurrentTeacherSlot(classItem, studentId)?.teacherId) || classItem.teacher?._id || '';
  }

  getCurrentStudentDuration(classItem: ClassItem, studentId: string): StudentDurationSlot {
    const current = this.getCurrentDurationSlot(classItem, studentId);
    if (current) {
      return current;
    }
    return {
      slotIndex: 1,
      slotType: 'INITIAL',
      baseDuration: classItem.baseDuration || this.defaultBaseDuration,
      sessionDuration: classItem.sessionDuration || classItem.baseDuration || this.defaultBaseDuration,
      totalSessions: classItem.totalSessions || 0,
    };
  }

  getStudentTeacherDisplay(classItem: ClassItem, studentId: string): string {
    const currentSlot = this.getCurrentTeacherSlot(classItem, studentId);
    const currentTeacherName = this.resolveMemberName(currentSlot?.teacherId) || classItem.teacher?.fullName || 'Chua co';
    const slotLabel = currentSlot?.slotIndex || 1;
    return `GV${slotLabel}: ${currentTeacherName}`;
  }

  getStudentDurationDisplay(classItem: ClassItem, studentId: string): string {
    const currentDuration = this.getCurrentStudentDuration(classItem, studentId);
    return `Lan ${currentDuration.slotIndex}: ${currentDuration.sessionDuration} phut`;
  }

  getStudentTotalSessions(classItem: ClassItem, studentId: string): number {
    return this.getCurrentStudentDuration(classItem, studentId).totalSessions;
  }

  formatSessionCount(value?: number): string {
    if (!value && value !== 0) return '-';
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return '-';
    return Math.max(Math.floor(normalized), 0).toLocaleString('vi-VN');
  }

  pendingClassChanges(classItem: ClassItem | null | undefined) {
    return classItem?.pendingSaleUpdate?.changeSummary || [];
  }

  classEditHistory(classItem: ClassItem | null | undefined): ClassEditHistoryEntry[] {
    return [...(classItem?.editHistory || [])].sort((left, right) => {
      const leftTime = new Date(left.editedAt || '').getTime();
      const rightTime = new Date(right.editedAt || '').getTime();
      return rightTime - leftTime;
    });
  }

  classHistoryActionLabel(action?: ClassEditHistoryEntry['action']): string {
    switch (action) {
      case 'SALE_DIRECT_UPDATED':
        return 'Sale cap nhat truc tiep';
      case 'SALE_REQUESTED':
        return 'Sale gui yeu cau';
      case 'APPROVED':
        return 'Da phe duyet';
      case 'REJECTED':
        return 'Da tu choi';
      case 'MANAGER_UPDATED':
        return 'Director/Ops cap nhat';
      default:
        return 'Cap nhat lop hoc';
    }
  }

  formatHistoryTimestamp(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN');
  }

  selectedStudentTeacherSlots(): StudentTeacherSlot[] {
    if (!this.selectedStudentConfigClass || !this.selectedStudentConfigStudent) {
      return [];
    }
    const slots = this.sortTeacherSlots(
      this.getStudentConfig(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id)?.teacherSlots,
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
    const slots = this.sortDurationSlots(
      this.getStudentConfig(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id)?.durationSlots,
    );
    if (slots.length) {
      return slots;
    }
    return [this.getCurrentStudentDuration(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id)];
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
    return this.getCurrentStudentDuration(this.selectedStudentConfigClass, this.selectedStudentConfigStudent._id);
  }

  getTeacherSlotDisplay(slot: StudentTeacherSlot): string {
    return this.resolveMemberName(slot.teacherId) || 'Chua gan giao vien';
  }

  canAppendTeacherSlot(): boolean {
    return this.selectedStudentTeacherSlots().length < 3;
  }

  canAppendDurationSlot(): boolean {
    return this.selectedStudentDurationSlots().length < 3;
  }

  nextTeacherSlotIndex(): number {
    return this.selectedStudentTeacherSlots().length + 1;
  }

  nextDurationSlotIndex(): number {
    return this.selectedStudentDurationSlots().length + 1;
  }

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
    if (this.isSaleDurationEditMode()) {
      return 'Gui yeu cau doi thoi luong lop hoc';
    }
    if (this.isSaleConfigEditMode()) {
      return 'Gui yeu cau doi giao vien va luong GV';
    }
    if (this.isSaleAssignMode()) {
      return 'Chon hoc vien vao lop';
    }
    if (this.isSaleOfflineExistingMode()) {
      return 'Them hoc sinh vao lop offline co san';
    }
    return this.editingId ? 'Chinh sua lop hoc' : 'Them lop hoc';
  }

  availableSaleInvoices(): InvoiceItem[] {
    return this.invoices().filter((invoice) => {
      const isApproved = invoice.status === 'APPROVED' || invoice.status === 'PAID';
      return isApproved && !this.getInvoiceClassId(invoice);
    });
  }

  selectedInvoice(): InvoiceItem | undefined {
    if (!this.form.invoiceId) return undefined;
    return this.invoices().find((invoice) => invoice._id === this.form.invoiceId);
  }

  availableProductPackages(): ProductItem[] {
    return this.products().filter((product) => this.matchesProductMode(product, this.form.classMode));
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

  isOfflineClass(c: ClassItem): boolean {
    return (c.classMode || 'ONLINE') === 'OFFLINE';
  }

  private getInvoiceClassId(invoice: InvoiceItem): string | null {
    const classId = invoice.classId;
    if (!classId) return null;
    return typeof classId === 'string' ? classId : classId._id || null;
  }

  private matchesProductMode(
    product: ProductItem | undefined | null,
    classMode: 'ONLINE' | 'OFFLINE',
  ): product is ProductItem {
    if (!product || product.isActive === false) {
      return false;
    }
    const teachingMode = (product.teachingMode || 'BOTH').toUpperCase();
    return teachingMode === 'BOTH' || teachingMode === classMode;
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
    if (this.matchesProductMode(selectedProduct, this.form.classMode)) {
      return;
    }

    const invoiceProduct = this.products().find((product) => product._id === this.selectedInvoice()?.productId);
    if (this.matchesProductMode(invoiceProduct, this.form.classMode)) {
      this.form.productPackageId = invoiceProduct._id;
      return;
    }

    const studentProduct = this.form.studentIds
      .map((studentId) => this.resolveStudentProductPackage(studentId))
      .find((product): product is ProductItem => this.matchesProductMode(product, this.form.classMode));

    this.form.productPackageId = studentProduct?._id || '';
  }

  private mapTeacherProfileToUserItem(profile: TeacherProfile): UserItem | null {
    const user = typeof profile.userId === 'string' ? null : profile.userId;
    const teacherId = user?._id || (typeof profile.userId === 'string' ? profile.userId : '');
    const fullName = user?.fullName?.trim() || '';
    const email = user?.email?.trim() || '';

    if (!teacherId || !fullName || !email) {
      return null;
    }

    return {
      _id: teacherId,
      userCode: user?.userCode,
      fullName,
      email,
      phone: user?.phone,
      role: 'TEACHER',
      status: profile.status,
    };
  }

  teacherBaseForForm(): number {
    return this.form.classMode === 'OFFLINE'
      ? (this.form.teacherPayPerStudent || 0)
      : (this.form.teacherPayPerSession || 0);
  }

  formatTeacherBase(c: ClassItem): string {
    if (this.isOfflineClass(c)) {
      return `${this.formatTeacherCurrency(c.teacherPayPerStudent)} / HS`;
    }
    return this.formatTeacherCurrency(c.teacherPayPerSession);
  }

  formatTeacherActual(c: ClassItem): string {
    if (this.isOfflineClass(c)) return 'Theo diem danh (min 200k)';
    return this.formatTeacherCurrency(c.actualTeacherPayPerSession ?? c.teacherPayPerSession);
  }

  formatCurrency(amount?: number): string {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(this.roundMoneyToThousand(amount));
  }

  formatTeacherCurrency(amount?: number): string {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(this.roundMoneyDownToThousand(amount));
  }

  private roundMoneyToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized === 0) return 0;
    return Math.round(normalized / 1000) * 1000;
  }

  private roundMoneyDownToThousand(value?: number): number {
    const normalized = Number(value || 0);
    if (!Number.isFinite(normalized) || normalized === 0) return 0;
    return normalized > 0
      ? Math.floor(normalized / 1000) * 1000
      : Math.ceil(normalized / 1000) * 1000;
  }

  getProfitClass(profit?: number): string {
    if (!profit && profit !== 0) return '';
    if (profit > 0) return 'profit-positive';
    if (profit < 0) return 'profit-negative';
    return 'profit-zero';
  }

  calcProportional(basePrice: number | undefined, targetDuration: number): number {
    if (!basePrice) return 0;
    const base = this.form.baseDuration || this.defaultBaseDuration;
    return this.roundMoneyToThousand(basePrice * (targetDuration / base));
  }

  calcTeacherProportional(basePay: number | undefined, targetDuration: number): number {
    if (!basePay) return 0;
    const base = this.form.baseDuration || this.defaultBaseDuration;
    return Math.floor((basePay * (targetDuration / base)) / 1000) * 1000;
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
      this.roundMoneyDownToThousand(attendedCount * (this.form.teacherPayPerStudent || 0)),
    );
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
