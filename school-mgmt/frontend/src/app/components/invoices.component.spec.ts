import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { InvoicesComponent } from './invoices.component';
import {
  InvoiceItem,
  InvoiceManagementResponse,
  InvoiceService,
} from '../services/invoice.service';
import { StudentService } from '../services/student.service';
import { UserService } from '../services/user.service';
import { ClassService } from '../services/class.service';
import { AuthService } from '../services/auth.service';
import { Role } from '../models/role.enum';

function makeInvoice(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    _id: 'invoice-1',
    invoiceNumber: 'INV-2026-0001',
    studentId: {
      _id: 'student-1',
      fullName: 'Student Demo',
      parentName: 'Parent Demo',
      parentPhone: '0901000001',
      studentCode: 'HS001',
    },
    classType: 'OFFLINE',
    sessions: 10,
    bonusSessions: 0,
    trialSessions: 0,
    paymentRound: 1,
    courseStatus: 'NEW',
    amount: 2_000_000,
    paymentDate: '2026-04-13T00:00:00.000Z',
    classId: {
      _id: 'class-1',
      name: 'Lop A',
      code: 'CLS-A',
    },
    status: 'APPROVED',
    createdBy: {
      _id: 'sale-1',
      fullName: 'Sale Demo',
      email: 'sale@example.com',
    },
    createdAt: '2026-04-13T00:00:00.000Z',
    updatedAt: '2026-04-13T00:00:00.000Z',
    totalSessionsByStudentClass: 10,
    ...overrides,
  };
}

function makeManagementResponse(rows: InvoiceItem[], page = 1, total = rows.length): InvoiceManagementResponse {
  return {
    data: rows,
    meta: {
      total,
      page,
      limit: 25,
      totalPages: Math.max(1, Math.ceil(total / 25)),
    },
    summary: {
      total,
      onlineAmount: rows
        .filter((item) => item.classType === 'ONLINE')
        .reduce((sum, item) => sum + item.amount, 0),
      offlineAmount: rows
        .filter((item) => item.classType === 'OFFLINE')
        .reduce((sum, item) => sum + item.amount, 0),
      approvedAmount: rows
        .filter((item) => item.status === 'APPROVED' || item.status === 'PAID')
        .reduce((sum, item) => sum + item.amount, 0),
      pendingCount: rows.filter((item) => item.status === 'PENDING_APPROVAL').length,
    },
  };
}

function makeAuthServiceStub(role: Role = Role.SALE) {
  return {
    userSignal: () => ({
      sub: 'sale-1',
      role,
      fullName: `Test ${role}`,
    }),
  };
}

function makeInvoiceServiceStub(response: InvoiceManagementResponse) {
  return {
    list: jasmine.createSpy('list').and.resolveTo([]),
    listManagement: jasmine.createSpy('listManagement').and.resolveTo(response),
    create: jasmine.createSpy('create').and.resolveTo({ ok: true }),
    update: jasmine.createSpy('update').and.resolveTo({ ok: true }),
    approve: jasmine.createSpy('approve').and.resolveTo({ ok: true }),
    cancel: jasmine.createSpy('cancel').and.resolveTo({ ok: true }),
    remove: jasmine.createSpy('remove').and.resolveTo({ ok: true }),
    uploadReceipt: jasmine.createSpy('uploadReceipt').and.resolveTo({ ok: true, url: '/uploads/invoices/demo.png' }),
  };
}

describe('InvoicesComponent', () => {
  let fixture: ComponentFixture<InvoicesComponent>;
  let component: InvoicesComponent;

  async function createComponent(response: InvoiceManagementResponse, role: Role = Role.SALE) {
    await TestBed.configureTestingModule({
      imports: [InvoicesComponent, HttpClientTestingModule],
      providers: [
        { provide: InvoiceService, useValue: makeInvoiceServiceStub(response) },
        { provide: StudentService, useValue: { list: () => Promise.resolve([]) } },
        { provide: UserService, useValue: { listSales: () => Promise.resolve([]) } },
        { provide: ClassService, useValue: { list: () => Promise.resolve([]) } },
        { provide: AuthService, useValue: makeAuthServiceStub(role) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads the first invoice page through the management endpoint', async () => {
    await createComponent(
      makeManagementResponse([
        makeInvoice({ _id: 'inv-1', totalSessionsByStudentClass: 21 }),
      ], 1, 60),
    );

    const invoiceService = TestBed.inject(InvoiceService) as any;

    expect(invoiceService.listManagement).toHaveBeenCalledWith({
      keyword: '',
      parentKeyword: '',
      saleKeyword: '',
      classType: undefined,
      status: undefined,
      courseStatus: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      page: 1,
      limit: 25,
    });
    expect(invoiceService.list).not.toHaveBeenCalled();
    expect(component.totalItems()).toBe(60);
    expect(component.totalPages()).toBe(3);
  });

  it('renders invoice sessions and server-computed grouped total sessions columns', async () => {
    await createComponent(
      makeManagementResponse([
        makeInvoice({
          _id: 'inv-a',
          sessions: 10,
          bonusSessions: 2,
          trialSessions: 1,
          totalSessionsByStudentClass: 21,
        }),
      ]),
    );

    expect(
      fixture.nativeElement.querySelector('[data-testid="invoice-col-invoice-sessions"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="invoice-col-total-sessions"]'),
    ).toBeTruthy();
    expect(component.invoiceSessionCount(component.items()[0])).toBe(13);
    expect(component.invoiceClassTotalSessions(component.items()[0])).toBe('21');
    expect(
      fixture.nativeElement.querySelector('[data-testid="invoice-row-total-sessions-inv-a"]').textContent.trim(),
    ).toBe('21');
  });

  it('applies filters and page navigation through the paged management endpoint', async () => {
    await createComponent(
      makeManagementResponse([
        makeInvoice({ _id: 'inv-a' }),
      ], 1, 60),
    );

    const invoiceService = TestBed.inject(InvoiceService) as any;
    invoiceService.listManagement.calls.reset();

    component.keyword.set('INV-0002');
    component.parentFilter.set('Parent Demo');
    await component.applyFilters();
    await fixture.whenStable();

    expect(invoiceService.listManagement).toHaveBeenCalledWith(
      jasmine.objectContaining({
        keyword: 'INV-0002',
        parentKeyword: 'Parent Demo',
        page: 1,
        limit: 25,
      }),
    );

    invoiceService.listManagement.calls.reset();
    invoiceService.listManagement.and.resolveTo(
      makeManagementResponse([
        makeInvoice({ _id: 'inv-b', invoiceNumber: 'INV-2026-0026' }),
      ], 2, 60),
    );

    await component.goToPage(2);
    await fixture.whenStable();

    expect(invoiceService.listManagement).toHaveBeenCalledWith(
      jasmine.objectContaining({
        keyword: 'INV-0002',
        parentKeyword: 'Parent Demo',
        page: 2,
        limit: 25,
      }),
    );
    expect(component.currentPage()).toBe(2);
  });

  it('keeps the invoice table header sticky while scrolling', async () => {
    await createComponent(
      makeManagementResponse([
        makeInvoice({ _id: 'inv-a' }),
      ]),
    );

    const tableShell: HTMLDivElement | null = fixture.nativeElement.querySelector('.invoice-table-wrap');
    const headerCell: HTMLTableCellElement | null = fixture.nativeElement.querySelector('.data thead th');

    expect(tableShell).toBeTruthy();
    expect(headerCell).toBeTruthy();
    expect(window.getComputedStyle(headerCell!).position).toBe('sticky');
    expect(window.getComputedStyle(headerCell!).top).toBe('0px');
  });

  it('allows approving offline trial 0d invoices without proof images', async () => {
    await createComponent(
      makeManagementResponse([
        makeInvoice({
          _id: 'trial-0d',
          classType: 'OFFLINE',
          amount: 0,
          trialSessions: 1,
          receiptImage: '',
          status: 'PENDING_APPROVAL',
        }),
      ]),
      Role.DIRECTOR,
    );

    const invoice = component.items()[0];
    const invoiceService = TestBed.inject(InvoiceService) as any;
    spyOn(window, 'confirm').and.returnValue(true);

    component.openApproveModal(invoice);
    fixture.detectChanges();
    await fixture.whenStable();

    const approveButton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[data-testid="invoice-approve-confirm"]',
    );

    expect(component.isApprovalProofRequired(invoice)).toBeFalse();
    expect(approveButton).toBeTruthy();
    expect(approveButton?.disabled).toBeFalse();

    await component.confirmApprove();

    expect(invoiceService.approve).toHaveBeenCalledWith(
      'trial-0d',
      'APPROVE',
      undefined,
      undefined,
    );
  });
});
