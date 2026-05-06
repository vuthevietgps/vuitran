import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComprehensiveReportComponent } from './comprehensive-report.component';
import { AuthService } from '../services/auth.service';
import { StudentService } from '../services/student.service';
import { UserService } from '../services/user.service';

function makeStudentServiceStub() {
  return {
    getComprehensiveReportClasses: jasmine
      .createSpy('getComprehensiveReportClasses')
      .and.callFake(
        async (
          _searchTerm?: string,
          _limit: number = 500,
          classMode?: 'ONLINE' | 'OFFLINE',
        ) => {
          if (classMode === 'OFFLINE') {
            return [
              {
                _id: 'class-2',
                code: 'CLS-002',
                name: 'Lop Van Offline',
                studentCount: 1,
              },
            ];
          }
          return [
            {
              _id: 'class-1',
              code: 'CLS-001',
              name: 'Lop Toan',
              studentCount: 2,
            },
          ];
        },
      ),
    getComprehensiveReport: jasmine
      .createSpy('getComprehensiveReport')
      .and.resolveTo({
        maxSessions: 8,
        rows: [
          {
            studentId: 'student-1',
            studentCode: 'HS001',
            fullName: 'Hoc sinh 1',
            age: 10,
            parentName: 'PH 1',
            parentPhone: '0901000001',
            faceImage: '',
            classMode: 'ONLINE',
            classId: 'class-1',
            classCode: 'CLS-001',
            className: 'Lop Toan',
            subject: 'Toan',
            grade: '5',
            level: '5',
            teacherName: 'Giao vien 1',
            teacherCode: 'GV001',
            teacherCodeAndName: 'GV001 - Giao vien 1',
            pricePerSession: 200000,
            totalSessions: 8,
            sessionsCompleted: 2,
            attendedCount: 2,
            absentCount: 0,
            invoiceNumber: 'INV-001',
            saleId: 'sale-1',
            saleName: 'Sale 1',
            dataStatus: 'DANG_HOC',
            sessions: [],
          },
        ],
        meta: {
          total: 60,
          page: 1,
          limit: 25,
          totalPages: 3,
        },
      }),
  };
}

function makeUserServiceStub() {
  return {
    listSales: jasmine.createSpy('listSales').and.resolveTo([
      {
        _id: 'sale-1',
        fullName: 'Sale 1',
        email: 'sale1@example.com',
      },
    ]),
  };
}

function makeAuthServiceStub(role: string = 'DIRECTOR') {
  return {
    userSignal: () => ({
      sub: 'user-1',
      role,
      fullName: `Test ${role}`,
    }),
  };
}

describe('ComprehensiveReportComponent', () => {
  let fixture: ComponentFixture<ComprehensiveReportComponent>;
  let component: ComprehensiveReportComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComprehensiveReportComponent],
      providers: [
        { provide: StudentService, useValue: makeStudentServiceStub() },
        { provide: UserService, useValue: makeUserServiceStub() },
        { provide: AuthService, useValue: makeAuthServiceStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComprehensiveReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads lightweight filter data and the first paged report on init', () => {
    const studentService = TestBed.inject(StudentService) as any;
    const userService = TestBed.inject(UserService) as any;

    expect(studentService.getComprehensiveReportClasses).toHaveBeenCalledWith(
      undefined,
      500,
      'ONLINE',
    );
    expect(userService.listSales).toHaveBeenCalled();
    expect(studentService.getComprehensiveReport).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      25,
      'ONLINE',
    );
    expect(component.classOptions()).toEqual([
      {
        _id: 'class-1',
        code: 'CLS-001',
        name: 'Lop Toan',
        studentCount: 2,
      },
    ]);
    expect(component.totalItems()).toBe(60);
    expect(component.totalPages()).toBe(3);
  });

  it('applies active filters through the paged backend request', async () => {
    const studentService = TestBed.inject(StudentService) as any;
    studentService.getComprehensiveReport.calls.reset();

    component.currentPage.set(3);
    component.selectedClassId = 'class-1';
    component.searchTerm = 'Hoc sinh 1';
    component.selectedSaleId.set('sale-1');
    component.selectedDataStatus.set('DANG_HOC');

    component.applyFilters();
    await fixture.whenStable();

    expect(studentService.getComprehensiveReport).toHaveBeenCalledWith(
      'class-1',
      'Hoc sinh 1',
      'sale-1',
      'DANG_HOC',
      1,
      25,
      'ONLINE',
    );
    expect(component.currentPage()).toBe(1);
  });

  it('requests the next page instead of keeping all rows in memory', async () => {
    const studentService = TestBed.inject(StudentService) as any;
    studentService.getComprehensiveReport.calls.reset();
    studentService.getComprehensiveReport.and.resolveTo({
      maxSessions: 8,
      rows: [],
      meta: {
        total: 60,
        page: 2,
        limit: 25,
        totalPages: 3,
      },
    });

    component.goToPage(2);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(studentService.getComprehensiveReport).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      2,
      25,
      'ONLINE',
    );
    expect(component.currentPage()).toBe(2);
    expect(component.totalPages()).toBe(3);
  });

  it('switches tabs, reloads data, and resets the selected class', async () => {
    const studentService = TestBed.inject(StudentService) as any;
    studentService.getComprehensiveReportClasses.calls.reset();
    studentService.getComprehensiveReport.calls.reset();

    component.selectedClassId = 'class-1';
    component.currentPage.set(3);
    await component.onTabChange('OFFLINE');
    fixture.detectChanges();

    expect(studentService.getComprehensiveReportClasses).toHaveBeenCalledWith(
      undefined,
      500,
      'OFFLINE',
    );

    expect(studentService.getComprehensiveReport).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      25,
      'OFFLINE',
    );
    expect(component.selectedClassId).toBe('');
    expect(component.currentPage()).toBe(1);
    expect(component.classOptions()).toEqual([
      {
        _id: 'class-2',
        code: 'CLS-002',
        name: 'Lop Van Offline',
        studentCount: 1,
      },
    ]);
  });
});
