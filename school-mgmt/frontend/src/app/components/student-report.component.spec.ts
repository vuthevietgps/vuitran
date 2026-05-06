import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StudentReportComponent } from './student-report.component';
import { StudentService } from '../services/student.service';

function makeStudentServiceStub() {
  return {
    getStudentReportClasses: jasmine
      .createSpy('getStudentReportClasses')
      .and.resolveTo([
        {
          _id: 'class-1',
          code: 'CLS-001',
          name: 'Lop Toan',
          studentCount: 2,
        },
      ]),
    getStudentReport: jasmine
      .createSpy('getStudentReport')
      .and.resolveTo({
        rows: [
          {
            _id: 'student-1',
            studentCode: 'HS001',
            fullName: 'Hoc sinh 1',
            age: 10,
            parentName: 'PH 1',
            parentPhone: '0901000001',
            faceImage: '',
            productPackage: {
              _id: 'product-1',
              name: 'Goi 1',
              price: 200000,
            },
            totalAttendance: 3,
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

describe('StudentReportComponent', () => {
  let fixture: ComponentFixture<StudentReportComponent>;
  let component: StudentReportComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StudentReportComponent],
      providers: [
        { provide: StudentService, useValue: makeStudentServiceStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StudentReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads lightweight class options and the first paged report on init', () => {
    const studentService = TestBed.inject(StudentService) as any;

    expect(studentService.getStudentReportClasses).toHaveBeenCalledWith();
    expect(studentService.getStudentReport).toHaveBeenCalledWith(
      undefined,
      undefined,
      1,
      25,
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

  it('applies filters through the paged report endpoint', async () => {
    const studentService = TestBed.inject(StudentService) as any;
    studentService.getStudentReport.calls.reset();

    component.currentPage.set(3);
    component.selectedClassId = 'class-1';
    component.searchTerm = 'Hoc sinh 1';

    component.applyFilters();
    await fixture.whenStable();

    expect(studentService.getStudentReport).toHaveBeenCalledWith(
      'class-1',
      'Hoc sinh 1',
      1,
      25,
    );
    expect(component.currentPage()).toBe(1);
  });

  it('keeps the student report table header sticky while scrolling', () => {
    const tableShell: HTMLDivElement | null = fixture.nativeElement.querySelector(
      '.report-table-container',
    );
    const headerCell: HTMLTableCellElement | null = fixture.nativeElement.querySelector(
      '.report-table thead th',
    );

    expect(tableShell).toBeTruthy();
    expect(headerCell).toBeTruthy();
    expect(window.getComputedStyle(headerCell!).position).toBe('sticky');
    expect(window.getComputedStyle(headerCell!).top).toBe('0px');
  });
});
