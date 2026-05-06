import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';

import { AttendanceReportComponent } from './attendance-report.component';
import { AttendanceService } from '../services/attendance.service';

function makeAttendanceServiceStub() {
  return {
    getAttendanceReportClasses: jasmine.createSpy('getAttendanceReportClasses').and.resolveTo([
      {
        _id: 'class-1',
        code: 'CLS-001',
        name: 'Lop Toan',
        studentCount: 2,
      },
    ]),
    getAttendanceReport: jasmine.createSpy('getAttendanceReport').and.resolveTo({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    }),
    getClassesWithStudents: jasmine.createSpy('getClassesWithStudents').and.resolveTo([]),
  };
}

describe('AttendanceReportComponent', () => {
  let fixture: ComponentFixture<AttendanceReportComponent>;
  let component: AttendanceReportComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceReportComponent],
      providers: [
        { provide: AttendanceService, useValue: makeAttendanceServiceStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads lightweight class options on init instead of classes-with-students', async () => {
    const attendanceService = TestBed.inject(AttendanceService) as any;

    expect(attendanceService.getAttendanceReportClasses).toHaveBeenCalledWith(undefined, 50);
    expect(attendanceService.getClassesWithStudents).not.toHaveBeenCalled();
    expect(component.classOptionsForSelect()).toEqual([
      {
        _id: 'class-1',
        code: 'CLS-001',
        name: 'Lop Toan',
        studentCount: 2,
      },
    ]);
  });

  it('debounces class search before requesting new options', fakeAsync(() => {
    const attendanceService = TestBed.inject(AttendanceService) as any;
    attendanceService.getAttendanceReportClasses.calls.reset();

    component.onClassSearchChange('CLS');
    tick(200);
    expect(attendanceService.getAttendanceReportClasses).not.toHaveBeenCalled();

    tick(50);
    tick();

    expect(attendanceService.getAttendanceReportClasses).toHaveBeenCalledWith('CLS', 50);
  }));

  it('precomputes report rows for dates, image urls, and purchased sessions', async () => {
    component.reportData.set([
      {
        _id: 'attendance-1',
        date: '2026-04-13T00:00:00.000Z',
        attendedAt: '2026-04-13T08:30:00.000Z',
        status: 'PRESENT',
        imageUrl: '/uploads/attendance.jpg',
        studentId: {
          _id: 'student-1',
          studentCode: 'HS01',
          fullName: 'Hoc sinh 1',
          age: 10,
          parentName: 'PH 1',
          faceImage: '/uploads/student.jpg',
          totalPurchasedSessions: 24,
        },
        classId: {
          _id: 'class-1',
          name: 'Lop Toan',
          code: 'CLS-001',
        },
        teacherId: {
          _id: 'teacher-1',
          fullName: 'Giao vien 1',
          email: 'gv1@example.com',
        },
        notes: 'On time',
      },
    ] as any);

    const row = component.reportRows()[0];

    expect(row.totalPurchasedSessions).toBe(24);
    expect(row.studentFaceImageUrl).toContain('/uploads/student.jpg');
    expect(row.attendanceImageUrl).toContain('/uploads/attendance.jpg');
    expect(row.dateDisplay).not.toBe('');
    expect(row.attendanceTimeDisplay).not.toBe('');
  });
});
