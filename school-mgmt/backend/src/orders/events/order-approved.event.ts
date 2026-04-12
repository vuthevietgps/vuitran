export interface OrderApprovedEventExtras {
  parentUserId?: string;
  studentCode?: string;
  studentName?: string;
  parentPhone?: string;
  adGroupId?: string;
  adGroupName?: string;
  saleId?: string;
  saleName?: string;
  actorEmail?: string;
  actorFullName?: string;
  actorRole?: string;
  isNew?: boolean;
}

export class OrderApprovedEvent {
  constructor(
    public readonly orderId: string,
    public readonly orderCode: string,
    public readonly studentId: string,
    public readonly invoiceIds: string[],
    public readonly actorId: string,
    public readonly rawOrderData: any,
    public readonly extras: OrderApprovedEventExtras = {},
  ) {}
}
