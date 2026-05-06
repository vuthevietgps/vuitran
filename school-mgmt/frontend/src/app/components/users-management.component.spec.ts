import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { UsersManagementComponent } from './users-management.component';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { AdsService } from '../services/ads.service';

function makeUserServiceStub() {
  return {
    list: jasmine.createSpy('list').and.resolveTo([]),
    listParents: jasmine.createSpy('listParents').and.resolveTo([]),
    listParentsManagement: jasmine
      .createSpy('listParentsManagement')
      .and.resolveTo({
        data: [
          {
            _id: 'parent-1',
            userCode: 'PH001',
            email: 'parent.one@example.com',
            fullName: 'Parent One',
            role: 'PARENT',
            status: 'ACTIVE',
            phone: '0901000001',
            address: 'HCM',
          },
        ],
        meta: {
          total: 60,
          page: 1,
          limit: 25,
          totalPages: 3,
        },
      }),
    listSales: jasmine.createSpy('listSales').and.resolveTo([]),
    create: jasmine.createSpy('create'),
    update: jasmine.createSpy('update'),
    remove: jasmine.createSpy('remove'),
    getParentAdsAttribution: jasmine.createSpy('getParentAdsAttribution'),
    updateParentAdsAttribution: jasmine.createSpy('updateParentAdsAttribution'),
    clearParentAdsAttribution: jasmine.createSpy('clearParentAdsAttribution'),
  };
}

describe('UsersManagementComponent', () => {
  let fixture: ComponentFixture<UsersManagementComponent>;
  let component: UsersManagementComponent;
  let routeParams$: BehaviorSubject<any>;

  beforeEach(async () => {
    routeParams$ = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [UsersManagementComponent],
      providers: [
        { provide: UserService, useValue: makeUserServiceStub() },
        {
          provide: AuthService,
          useValue: {
            userSignal: () => ({
              sub: 'sale-001',
              email: 'sale.demo@school.local',
              role: 'SALE',
              fullName: 'Sale Demo',
            }),
          },
        },
        {
          provide: AdsService,
          useValue: {
            listAllGroups: jasmine.createSpy('listAllGroups').and.resolveTo([]),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: routeParams$.asObservable(),
          },
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate').and.resolveTo(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the first parent page through the management endpoint on init', () => {
    const userService = TestBed.inject(UserService) as any;

    expect(userService.listParentsManagement).toHaveBeenCalledWith({
      search: '',
      page: 1,
      limit: 25,
    });
    expect(userService.listParents).not.toHaveBeenCalled();
    expect(component.parentMode()).toBeTrue();
    expect(component.totalUserCount).toBe(60);
    expect(component.totalPages).toBe(3);
  });

  it('applies parent search and next-page navigation through server-side pagination', async () => {
    const userService = TestBed.inject(UserService) as any;
    userService.listParentsManagement.calls.reset();

    component.search = 'Parent One';
    component.applyFilters();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(userService.listParentsManagement).toHaveBeenCalledWith({
      search: 'Parent One',
      page: 1,
      limit: 25,
    });

    userService.listParentsManagement.calls.reset();
    userService.listParentsManagement.and.resolveTo({
      data: [
        {
          _id: 'parent-26',
          userCode: 'PH026',
          email: 'parent.26@example.com',
          fullName: 'Parent 26',
          role: 'PARENT',
          status: 'ACTIVE',
        },
      ],
      meta: {
        total: 60,
        page: 2,
        limit: 25,
        totalPages: 3,
      },
    });

    component.goNextPage();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(userService.listParentsManagement).toHaveBeenCalledWith({
      search: 'Parent One',
      page: 2,
      limit: 25,
    });
    expect(component.currentPage).toBe(2);
  });

  it('keeps the parent management table header sticky while scrolling', () => {
    const tableShell: HTMLDivElement | null = fixture.nativeElement.querySelector('.table-scroll');
    const headerCell: HTMLTableCellElement | null = fixture.nativeElement.querySelector('.data thead th');

    expect(tableShell).toBeTruthy();
    expect(headerCell).toBeTruthy();
    expect(window.getComputedStyle(headerCell!).position).toBe('sticky');
    expect(window.getComputedStyle(headerCell!).top).toBe('0px');
  });
});
