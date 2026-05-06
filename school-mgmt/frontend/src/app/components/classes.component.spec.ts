import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClassesComponent } from './classes.component';
import { ClassService } from '../services/class.service';
import { UserService } from '../services/user.service';
import { StudentService } from '../services/student.service';
import { ProductItem, ProductService } from '../services/product.service';
import { InvoiceService } from '../services/invoice.service';
import { TeacherService } from '../services/teacher.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

function makeAuthServiceStub(role: Role = Role.DIRECTOR) {
  return {
    userSignal: () => ({
      sub: 'director-1',
      role,
      fullName: `Test ${role}`,
    }),
  };
}

function makeClassServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo([]),
    listManagement: jasmine.createSpy('listManagement').and.resolveTo({
      data: [],
      meta: { total: 0, page: 1, limit: 25, totalPages: 1 },
    }),
    findOne: jasmine.createSpy('findOne').and.resolveTo(null),
    listSaleOfflineOptions: jasmine.createSpy('listSaleOfflineOptions').and.resolveTo([]),
    create: jasmine.createSpy('create').and.resolveTo({ ok: true }),
    update: jasmine.createSpy('update').and.resolveTo({ ok: true }),
    remove: jasmine.createSpy('remove').and.resolveTo({ ok: true }),
    assignStudents: jasmine.createSpy('assignStudents').and.resolveTo({ ok: true }),
    updateStudentConfig: jasmine.createSpy('updateStudentConfig').and.resolveTo({ ok: true }),
    approvePendingOfflineAssignment: jasmine.createSpy('approvePendingOfflineAssignment').and.resolveTo({ ok: true }),
    rejectPendingOfflineAssignment: jasmine.createSpy('rejectPendingOfflineAssignment').and.resolveTo({ ok: true }),
  };
}

describe('ClassesComponent', () => {
  let fixture: ComponentFixture<ClassesComponent>;
  let component: ClassesComponent;

  async function createComponent(products: ProductItem[], role: Role = Role.DIRECTOR) {
    await TestBed.configureTestingModule({
      imports: [ClassesComponent],
      providers: [
        { provide: ClassService, useValue: makeClassServiceStub() },
        { provide: UserService, useValue: { listDirectory: () => Promise.resolve([]) } },
        { provide: StudentService, useValue: { list: () => Promise.resolve([]) } },
        { provide: ProductService, useValue: { list: () => Promise.resolve(products) } },
        { provide: InvoiceService, useValue: { list: () => Promise.resolve([]) } },
        { provide: TeacherService, useValue: { getAllTeachers: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: makeAuthServiceStub(role) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClassesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('keeps the main class table header sticky while scrolling', async () => {
    await createComponent([]);

    component.classes.set([
      {
        _id: 'class-1',
        code: 'CLS-001',
        name: 'Lop Online 1',
        classMode: 'ONLINE',
        teacher: null,
        students: [],
        coTeachers: [],
        pricePerSession: 100000,
        baseDuration: 70,
        sessionDuration: 90,
      } as any,
    ]);
    fixture.detectChanges();

    const tableShell: HTMLDivElement | null = fixture.nativeElement.querySelector('.data-table-shell');
    const headerCell: HTMLTableCellElement | null = fixture.nativeElement.querySelector('table.data thead th');

    expect(tableShell).toBeTruthy();
    expect(headerCell).toBeTruthy();
    expect(window.getComputedStyle(headerCell!).position).toBe('sticky');
    expect(window.getComputedStyle(headerCell!).top).toBe('0px');
  });

  it('requests paged classes from the server with the active filters', async () => {
    await createComponent([]);
    const classService = TestBed.inject(ClassService) as any;

    classService.listManagement.calls.reset();
    component.onTeacherFilterChange('teacher-3');
    await fixture.whenStable();

    expect(classService.listManagement).toHaveBeenCalledWith({
      teacherId: 'teacher-3',
      page: 1,
      limit: 25,
      search: undefined,
      classMode: undefined,
    });

    classService.listManagement.calls.reset();
    component.onClassModeFilterChange('ONLINE');
    await fixture.whenStable();

    expect(classService.listManagement).toHaveBeenCalledWith({
      teacherId: 'teacher-3',
      classMode: 'ONLINE',
      page: 1,
      limit: 25,
      search: undefined,
    });

    classService.listManagement.calls.reset();
    component.onClassSearchChange('CLS-ON');
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(classService.listManagement).toHaveBeenCalledWith({
      teacherId: 'teacher-3',
      classMode: 'ONLINE',
      search: 'CLS-ON',
      page: 1,
      limit: 25,
    });
  });

  it('resets class filters from the toolbar', async () => {
    await createComponent([]);
    const classService = TestBed.inject(ClassService) as any;

    component.classSearch = 'toan';
    component.teacherFilterId = 'teacher-1';
    component.classModeFilter = 'OFFLINE';

    classService.listManagement.calls.reset();
    component.resetClassFilters();
    await fixture.whenStable();

    expect(component.classSearch).toBe('');
    expect(component.teacherFilterId).toBe('');
    expect(component.classModeFilter).toBe('');
    expect(classService.listManagement).toHaveBeenCalledWith({
      search: undefined,
      teacherId: undefined,
      classMode: undefined,
      page: 1,
      limit: 25,
    });
  });

  it('builds teacher filter options from the teacher directory', async () => {
    await createComponent([]);

    component.teachers.set([
      {
        _id: 'teacher-2',
        fullName: 'Giao vien Binh',
      },
      {
        _id: 'teacher-1',
        fullName: 'Giao vien An',
      },
    ] as any);
    fixture.detectChanges();

    expect(component.teacherFilterOptions()).toEqual([
      { id: 'teacher-1', fullName: 'Giao vien An' },
      { id: 'teacher-2', fullName: 'Giao vien Binh' },
    ]);
  });

  it('shows ops/director approval wording for sale duration change requests', async () => {
    await createComponent([], Role.SALE);

    component.classes.set([
      {
        _id: 'class-1',
        code: 'CLS-ON-01',
        name: 'Lop Toan Online',
        classMode: 'ONLINE',
        teacher: { _id: 'teacher-1', fullName: 'Giao vien An' },
        sale: { _id: 'director-1', fullName: 'Sale Test' },
        students: [],
        coTeachers: [],
        pendingSaleUpdate: {
          status: 'PENDING',
          requestType: 'DURATION_CHANGE',
        },
      },
    ] as any);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sale dang cho Ops/Director duyet doi thoi luong');

    await component.edit(component.classes()[0] as any, 'duration');

    expect(component.submitLabel).toBe('Gui Ops/Director duyet');
  });

  it('renders offline class name dropdown from offline products only', async () => {
    await createComponent([
      {
        _id: 'prod-off-1',
        name: 'Toan Offline',
        code: 'TOAN-OFF',
        teachingMode: 'OFFLINE',
        isActive: true,
      },
      {
        _id: 'prod-off-2',
        name: 'Van Offline',
        code: 'VAN-OFF',
        teachingMode: 'OFFLINE',
        isActive: true,
      },
      {
        _id: 'prod-on-1',
        name: 'English Online',
        code: 'ENG-ON',
        teachingMode: 'ONLINE',
        isActive: true,
      },
    ] as ProductItem[]);

    component.showModal.set(true);
    component.form.classMode = 'OFFLINE';
    fixture.detectChanges();

    const select: HTMLSelectElement | null = fixture.nativeElement.querySelector(
      '[data-testid="class-offline-name-select"]',
    );
    expect(select).toBeTruthy();

    const optionTexts = Array.from(select?.options || []).map((option) => option.textContent?.trim() || '');
    expect(optionTexts).toContain('Toan Offline');
    expect(optionTexts).toContain('Van Offline');
    expect(optionTexts).not.toContain('English Online');
  });

  it('syncs offline class name and product package when selecting an offline product', async () => {
    await createComponent([
      {
        _id: 'prod-off-1',
        name: 'Toan Offline',
        code: 'TOAN-OFF',
        teachingMode: 'OFFLINE',
        isActive: true,
      },
    ] as ProductItem[]);

    component.form.classMode = 'OFFLINE';
    component.onOfflineNameProductChange('prod-off-1');

    expect(component.form.productPackageId).toBe('prod-off-1');
    expect(component.form.name).toBe('Toan Offline');
  });

  it('resolves dropdown selection from existing offline class name when productPackageId is blank', async () => {
    await createComponent([
      {
        _id: 'prod-off-1',
        name: 'Toan Offline',
        code: 'TOAN-OFF',
        teachingMode: 'OFFLINE',
        isActive: true,
      },
    ] as ProductItem[]);

    component.form.classMode = 'OFFLINE';
    component.form.name = 'Toan Offline';
    component.form.productPackageId = '';

    expect(component.selectedOfflineNameProductId()).toBe('prod-off-1');
  });

  it('submits offline existing mode as a pending approval request for sale', async () => {
    await createComponent([], Role.SALE);
    const classService = TestBed.inject(ClassService) as any;
    classService.assignStudents.and.resolveTo({
      ok: true,
      message: 'Da gui yeu cau',
    });
    spyOn(window, 'alert');

    component.form.classMode = 'OFFLINE';
    component.form.invoiceId = 'invoice-1';
    component.form.existingOfflineClassId = 'class-1';
    component.form.studentIds = ['student-1'];

    await component.submit();

    expect(classService.assignStudents).toHaveBeenCalledWith('class-1', ['student-1'], 'invoice-1');
    expect(window.alert).toHaveBeenCalledWith('Da gui yeu cau');
  });

  it('renders approve button for pending offline assignment requests of managers', async () => {
    await createComponent([], Role.DIRECTOR);

    component.classes.set([
      {
        _id: 'class-1',
        name: 'Lop Offline',
        code: 'OFF-001',
        classMode: 'OFFLINE',
        teacher: { _id: 'teacher-1', fullName: 'GV 1' },
        students: [],
        pendingOfflineAssignments: [
          {
            _id: 'request-1',
            status: 'PENDING',
            studentIds: [{ _id: 'student-1', fullName: 'Hoc sinh 1', studentCode: 'HS01' }],
            invoiceId: { _id: 'invoice-1', invoiceNumber: 'INV-001' },
            requestedBy: { _id: 'sale-1', fullName: 'Sale 1' },
            requestedAt: new Date().toISOString(),
          },
        ],
      } as any,
    ]);
    fixture.detectChanges();

    const approveButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[data-testid="class-offline-request-approve-class-1-request-1"]',
    );

    expect(approveButton).toBeTruthy();
  });
});
