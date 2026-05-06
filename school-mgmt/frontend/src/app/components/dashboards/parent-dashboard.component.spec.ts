import { ParentDashboardComponent } from './parent-dashboard.component';

describe('ParentDashboardComponent', () => {
  let component: ParentDashboardComponent;

  beforeEach(() => {
    component = new ParentDashboardComponent({
      getParentDashboard: jasmine.createSpy('getParentDashboard'),
    } as any);
  });

  it('maps APPROVED invoices to paid on the parent dashboard', () => {
    expect(component.invoiceStatusLabel('APPROVED')).toBe('Đã thanh toán');
  });

  it('maps PAID legacy invoices to paid on the parent dashboard', () => {
    expect(component.invoiceStatusLabel('PAID')).toBe('Đã thanh toán');
  });
});
