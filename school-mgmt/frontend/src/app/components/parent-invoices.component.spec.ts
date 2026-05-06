import { ParentInvoicesComponent } from './parent-invoices.component';

describe('ParentInvoicesComponent', () => {
  let component: ParentInvoicesComponent;

  beforeEach(() => {
    component = new ParentInvoicesComponent({} as any);
  });

  it('labels APPROVED invoices as paid for parent accounts', () => {
    expect(component.statusLabel('APPROVED')).toBe('Đã thanh toán');
  });

  it('labels PAID legacy invoices as paid for parent accounts', () => {
    expect(component.statusLabel('PAID')).toBe('Đã thanh toán');
  });

  it('keeps pending invoices separate from paid labels', () => {
    expect(component.statusLabel('PENDING_APPROVAL')).toBe('Chờ duyệt');
  });
});
