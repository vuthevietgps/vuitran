// Angular Unit Tests — Batch 11 Component Specs
// Covers: StudentsComponent, TeachingMaterialsComponent
// Scenarios: 26.3 (materials helpers), 29.1–29.4 (students RBAC + filter)
//
// Run: ng test --include="**/materials-export-students-components.component.spec.ts"

import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { StudentsComponent } from './students.component';
import { StudentService } from '../services/student.service';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { TeachingMaterialsComponent } from './teaching-materials.component';
import { TeacherService } from '../services/teacher.service';
import { ClassService } from '../services/class.service';
import { Role } from '../models/role.enum';

// ─── Auth Stub Factory ────────────────────────────────────────────────────────

type AuthRole = `${Role}`;

function makeAuthStub(role: AuthRole) {
  const payload = {
    sub: 'u-test',
    _id: 'u-test',
    email: 'test@test.com',
    role,
    fullName: 'Test User',
  };
  return {
    userSignal: () => payload,
    isLoggedIn: () => true,
    getDefaultAppRoute: () => '/app/dashboard',
  };
}

// ─── StudentsComponent ────────────────────────────────────────────────────────

describe('StudentsComponent', () => {
  let component: StudentsComponent;
  let studentSvcSpy: jasmine.SpyObj<StudentService>;
  let userSvcSpy: jasmine.SpyObj<UserService>;

  function createComponent(role: AuthRole): StudentsComponent {
    const authStub = makeAuthStub(role);
    studentSvcSpy = jasmine.createSpyObj('StudentService', [
      'list',
      'create',
      'update',
      'remove',
      'uploadFace',
    ]);
    userSvcSpy = jasmine.createSpyObj('UserService', ['listParents', 'list']);
    studentSvcSpy.list.and.resolveTo([]);
    userSvcSpy.listParents.and.resolveTo([]);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StudentsComponent],
      providers: [
        { provide: StudentService, useValue: studentSvcSpy },
        { provide: UserService, useValue: userSvcSpy },
        { provide: AuthService, useValue: authStub },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    const fixture = TestBed.createComponent(StudentsComponent);
    return fixture.componentInstance;
  }

  // ── canMutateStudents — 29.1 RBAC ─────────────────────────────────────────

  describe('canMutateStudents', () => {
    it('DIRECTOR → true', () => {
      const comp = createComponent(Role.DIRECTOR);
      expect(comp.canMutateStudents).toBe(true);
    });

    it('SALE → true', () => {
      const comp = createComponent(Role.SALE);
      expect(comp.canMutateStudents).toBe(true);
    });

    it('OPS → true', () => {
      const comp = createComponent(Role.OPS);
      expect(comp.canMutateStudents).toBe(true);
    });

    it('PARENT → false', () => {
      const comp = createComponent(Role.PARENT);
      expect(comp.canMutateStudents).toBe(false);
    });

    it('ACCOUNTING → false', () => {
      const comp = createComponent(Role.ACCOUNTING);
      expect(comp.canMutateStudents).toBe(false);
    });

    it('TEACHER → false', () => {
      const comp = createComponent(Role.TEACHER);
      expect(comp.canMutateStudents).toBe(false);
    });
  });

  // ── canDeleteStudents — 29.4 delete isolation ─────────────────────────────

  describe('canDeleteStudents', () => {
    it('DIRECTOR → true (only DIRECTOR can delete)', () => {
      const comp = createComponent(Role.DIRECTOR);
      expect(comp.canDeleteStudents).toBe(true);
    });

    it('SALE → false (cannot delete)', () => {
      const comp = createComponent(Role.SALE);
      expect(comp.canDeleteStudents).toBe(false);
    });

    it('OPS → false (cannot delete)', () => {
      const comp = createComponent(Role.OPS);
      expect(comp.canDeleteStudents).toBe(false);
    });

    it('PARENT → false', () => {
      const comp = createComponent(Role.PARENT);
      expect(comp.canDeleteStudents).toBe(false);
    });

    it('ACCOUNTING → false', () => {
      const comp = createComponent(Role.ACCOUNTING);
      expect(comp.canDeleteStudents).toBe(false);
    });
  });

  // ── filtered() computed signal — 29.3 search ──────────────────────────────

  describe('filtered() computed signal', () => {
    const mockStudents: any[] = [
      {
        _id: 's1',
        studentCode: 'HS001',
        fullName: 'Nguyễn Văn An',
        age: 8,
        parentName: 'PH An',
        parentPhone: '0901234567',
        faceImage: '',
        parentUserId: 'ph1',
      },
      {
        _id: 's2',
        studentCode: 'HS002',
        fullName: 'Trần Bảo Châu',
        age: 10,
        parentName: 'PH Châu',
        parentPhone: '0907654321',
        faceImage: '',
        parentUserId: 'ph2',
      },
      {
        _id: 's3',
        studentCode: 'HS-VIP-003',
        fullName: 'Lê Đinh Duy',
        age: 12,
        parentName: 'PH Duy',
        parentPhone: '0909999999',
        faceImage: '',
        parentUserId: 'ph3',
      },
    ];

    beforeEach(() => {
      component = createComponent(Role.DIRECTOR);
      component.items.set(mockStudents);
    });

    it('Empty keyword → returns all students', () => {
      component.keyword = '';
      expect(component.filtered().length).toBe(3);
    });

    it('Whitespace-only keyword → returns all students', () => {
      component.keyword = '   ';
      expect(component.filtered().length).toBe(3);
    });

    it('Filter by fullName (partial match)', () => {
      component.keyword = 'bảo châu';
      const result = component.filtered();
      expect(result.length).toBe(1);
      expect(result[0].studentCode).toBe('HS002');
    });

    it('Filter by fullName — case-insensitive', () => {
      component.keyword = 'NGUYỄN VĂN AN';
      const result = component.filtered();
      expect(result.length).toBe(1);
      expect(result[0].studentCode).toBe('HS001');
    });

    it('Filter by studentCode (exact prefix)', () => {
      component.keyword = 'HS001';
      const result = component.filtered();
      expect(result.length).toBe(1);
      expect(result[0].fullName).toBe('Nguyễn Văn An');
    });

    it('Filter by studentCode — partial match', () => {
      component.keyword = 'HS-VIP';
      const result = component.filtered();
      expect(result.length).toBe(1);
      expect(result[0].studentCode).toBe('HS-VIP-003');
    });

    it('Filter by studentCode — case-insensitive', () => {
      component.keyword = 'hs002';
      const result = component.filtered();
      expect(result.length).toBe(1);
      expect(result[0].fullName).toBe('Trần Bảo Châu');
    });

    it('No match → returns empty array', () => {
      component.keyword = 'xyz-not-found-xyz';
      expect(component.filtered().length).toBe(0);
    });

    it('Keyword matches both fullName and code prefix → returns both', () => {
      // 'hs0' matches all three student codes
      component.keyword = 'hs0';
      const result = component.filtered();
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── onParentChange() — 29.1 parent selection ─────────────────────────────

  describe('onParentChange()', () => {
    const mockParents: any[] = [
      { _id: 'ph1', role: 'PARENT', fullName: 'Nguyễn Phụ Huynh', phone: '0901111111', userCode: 'PH001' },
      { _id: 'ph2', role: 'PARENT', fullName: 'Trần Phụ Huynh', phone: '0902222222', userCode: 'PH002' },
    ];

    beforeEach(() => {
      component = createComponent(Role.DIRECTOR);
      component.parents.set(mockParents);
    });

    it('Empty parentId → clears parentName and parentPhone', () => {
      component.onParentChange('');
      expect(component.form.parentName).toBe('');
      expect(component.form.parentPhone).toBe('');
    });

    it('Valid parentId → populates parentName and parentPhone', () => {
      component.onParentChange('ph1');
      expect(component.form.parentName).toBe('Nguyễn Phụ Huynh');
      expect(component.form.parentPhone).toBe('0901111111');
    });

    it('Unknown parentId → no change to form fields', () => {
      component.form.parentName = 'Old Name';
      component.form.parentPhone = '0900000000';
      component.onParentChange('unknown-id');
      // Unknown ID → findSelected returns undefined → no update
      expect(component.form.parentName).toBe('Old Name');
    });
  });

  // ── openModal() / closeModal() guards — 29.1 UI guard ────────────────────

  describe('openModal() / closeModal()', () => {
    it('canMutateStudents=true → openModal() shows modal', () => {
      component = createComponent(Role.DIRECTOR);
      expect(component.canMutateStudents).toBe(true);
      component.openModal();
      expect(component.showModal()).toBe(true);
    });

    it('canMutateStudents=false → openModal() does NOT show modal', () => {
      component = createComponent(Role.PARENT);
      expect(component.canMutateStudents).toBe(false);
      component.openModal();
      expect(component.showModal()).toBe(false);
    });

    it('closeModal() hides modal', () => {
      component = createComponent(Role.DIRECTOR);
      component.openModal();
      component.closeModal();
      expect(component.showModal()).toBe(false);
    });
  });
});

// ─── TeachingMaterialsComponent ───────────────────────────────────────────────

describe('TeachingMaterialsComponent', () => {
  let component: TeachingMaterialsComponent;
  let teacherSvcSpy: jasmine.SpyObj<TeacherService>;
  let classSvcSpy: jasmine.SpyObj<ClassService>;

  const emptyMaterialsResponse = {
    data: [],
    meta: { total: 0, page: 1, limit: 18, totalPages: 0, hasNextPage: false, hasPrevPage: false },
  };

  beforeEach(async () => {
    teacherSvcSpy = jasmine.createSpyObj('TeacherService', [
      'getMaterials',
      'getMaterialStats',
      'uploadMaterial',
      'updateMaterial',
      'deleteMaterial',
    ]);
    classSvcSpy = jasmine.createSpyObj('ClassService', ['list']);

    teacherSvcSpy.getMaterials.and.resolveTo(emptyMaterialsResponse);
    teacherSvcSpy.getMaterialStats.and.resolveTo(null as any);
    classSvcSpy.list.and.resolveTo([]);

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TeachingMaterialsComponent],
      providers: [
        { provide: TeacherService, useValue: teacherSvcSpy },
        { provide: ClassService, useValue: classSvcSpy },
        { provide: HttpClient, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const fixture = TestBed.createComponent(TeachingMaterialsComponent);
    component = fixture.componentInstance;
  });

  // ── hasActiveFilters() — 26.3 filter state ───────────────────────────────

  describe('hasActiveFilters()', () => {
    it('No filters set → false', () => {
      component.searchQuery = '';
      component.filterSubject = '';
      component.filterGrade = '';
      component.filterClassId = '';
      component.filterType = '';
      component.filterExtractionStatus = '';
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('searchQuery set → true', () => {
      component.searchQuery = 'Toán';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('Whitespace-only searchQuery → false', () => {
      component.searchQuery = '   ';
      expect(component.hasActiveFilters()).toBe(false);
    });

    it('filterSubject set → true', () => {
      component.filterSubject = 'MATH';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('filterGrade set → true', () => {
      component.filterGrade = '5';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('filterClassId set → true', () => {
      component.filterClassId = 'class-id-abc';
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('filterType set → true', () => {
      component.filterType = 'pdf' as any;
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('filterExtractionStatus set → true', () => {
      component.filterExtractionStatus = 'completed' as any;
      expect(component.hasActiveFilters()).toBe(true);
    });

    it('resetFilters() → all filters cleared → false', () => {
      component.searchQuery = 'Test';
      component.filterSubject = 'MATH';
      component.filterGrade = '6';
      component.resetFilters();
      expect(component.hasActiveFilters()).toBe(false);
    });
  });

  // ── resultLabel() — 26.3 pagination display ───────────────────────────────

  describe('resultLabel()', () => {
    it('No materials → "Chua co tai lieu nao"', () => {
      component.materials.set([]);
      component.meta.set({ total: 0, page: 1, limit: 18, totalPages: 0, hasNextPage: false, hasPrevPage: false });
      expect(component.resultLabel()).toBe('Chua co tai lieu nao');
    });

    it('Some materials → "Dang hien X/Y tai lieu"', () => {
      component.materials.set([
        { _id: 'm1', title: 'Doc A', subject: 'MATH', grade: '5', isShared: true, tags: [] } as any,
        { _id: 'm2', title: 'Doc B', subject: 'ENGLISH', grade: '6', isShared: false, tags: [] } as any,
      ]);
      component.meta.set({ total: 10, page: 1, limit: 18, totalPages: 1, hasNextPage: false, hasPrevPage: false });
      const label = component.resultLabel();
      expect(label).toContain('2');
      expect(label).toContain('10');
    });

    it('Shows visible count', () => {
      const items: any[] = Array.from({ length: 5 }, (_, i) => ({
        _id: `m${i}`, title: `Doc ${i}`, subject: 'MATH', grade: '4', isShared: false, tags: [],
      }));
      component.materials.set(items);
      component.meta.set({ total: 50, page: 1, limit: 18, totalPages: 3, hasNextPage: true, hasPrevPage: false });
      const label = component.resultLabel();
      expect(label).toContain('5');
      expect(label).toContain('50');
    });
  });

  // ── visibleMaterials() — 26.3 list display ────────────────────────────────

  describe('visibleMaterials()', () => {
    it('Returns current materials signal value', () => {
      const items: any[] = [
        { _id: 'm1', title: 'Tài liệu 1', subject: 'MATH', grade: '5', isShared: true, tags: [] },
      ];
      component.materials.set(items);
      expect(component.visibleMaterials()).toEqual(items);
    });

    it('Empty materials → empty array', () => {
      component.materials.set([]);
      expect(component.visibleMaterials()).toEqual([]);
    });
  });

  // ── subjectOptions() / gradeOptions() — 26.3 filter dropdowns ────────────

  describe('subjectOptions()', () => {
    it('Returns sorted subjects from materials when no stats', () => {
      component.stats.set(null);
      component.materials.set([
        { _id: 'm1', title: 'T1', subject: 'MATH', grade: '5', isShared: false, tags: [] } as any,
        { _id: 'm2', title: 'T2', subject: 'ENGLISH', grade: '6', isShared: false, tags: [] } as any,
        { _id: 'm3', title: 'T3', subject: 'MATH', grade: '7', isShared: false, tags: [] } as any,
      ]);
      const subjects = component.subjectOptions();
      // Should be unique & sorted
      expect(subjects).toContain('MATH');
      expect(subjects).toContain('ENGLISH');
      // Unique: MATH appears once
      expect(subjects.filter((s) => s === 'MATH').length).toBe(1);
      // Sorted: ENGLISH before MATH
      expect(subjects.indexOf('ENGLISH')).toBeLessThan(subjects.indexOf('MATH'));
    });

    it('Returns stats keys when stats available', () => {
      component.stats.set({
        bySubject: { ENGLISH: 5, LITERATURE: 3 },
        byGrade: {},
        byExtractionStatus: {},
        total: 8,
      } as any);
      const subjects = component.subjectOptions();
      expect(subjects).toContain('ENGLISH');
      expect(subjects).toContain('LITERATURE');
    });
  });

  describe('gradeOptions()', () => {
    it('Returns unique sorted grades from materials', () => {
      component.stats.set(null);
      component.materials.set([
        { _id: 'm1', title: 'T1', subject: 'MATH', grade: '7', isShared: false, tags: [] } as any,
        { _id: 'm2', title: 'T2', subject: 'MATH', grade: '5', isShared: false, tags: [] } as any,
        { _id: 'm3', title: 'T3', subject: 'MATH', grade: '5', isShared: false, tags: [] } as any,
      ]);
      const grades = component.gradeOptions();
      expect(grades).toContain('5');
      expect(grades).toContain('7');
      expect(grades.filter((g) => g === '5').length).toBe(1);
      // Sorted: '5' before '7'
      expect(grades.indexOf('5')).toBeLessThan(grades.indexOf('7'));
    });
  });

  // ── objectEntries() — 26.3 stats display helper ──────────────────────────

  describe('objectEntries()', () => {
    it('Returns entries for a valid object', () => {
      const result = component.objectEntries({ MATH: 5, ENGLISH: 3 });
      expect(result.length).toBe(2);
      const mathEntry = result.find(([k]) => k === 'MATH');
      expect(mathEntry).toBeDefined();
      expect(mathEntry?.[1]).toBe(5);
    });

    it('Returns empty array for null', () => {
      expect(component.objectEntries(null)).toEqual([]);
    });

    it('Returns empty array for undefined', () => {
      expect(component.objectEntries(undefined)).toEqual([]);
    });

    it('Returns empty array for empty object', () => {
      expect(component.objectEntries({})).toEqual([]);
    });
  });

  // ── loadMore() guard — 26.3 pagination ───────────────────────────────────

  describe('loadMore()', () => {
    it('Does not load if loadingMore is true', () => {
      component.loadingMore.set(true);
      component.meta.set({ ...emptyMaterialsResponse.meta, hasNextPage: true });
      component.loadMore();
      // getMaterials should not be called again (initial call in bootstrap counts, so we check no extra calls)
      const initialCalls = teacherSvcSpy.getMaterials.calls.count();
      component.loadMore();
      expect(teacherSvcSpy.getMaterials.calls.count()).toBe(initialCalls);
    });

    it('Does not load if no next page', () => {
      component.loadingMore.set(false);
      component.meta.set({ ...emptyMaterialsResponse.meta, hasNextPage: false });
      const initialCalls = teacherSvcSpy.getMaterials.calls.count();
      component.loadMore();
      expect(teacherSvcSpy.getMaterials.calls.count()).toBe(initialCalls);
    });
  });
});
