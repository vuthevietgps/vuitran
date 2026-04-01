import { BadRequestException, ConflictException } from "@nestjs/common";
import { OrdersService } from "./orders.service";

function buildService(
  overrides: Partial<{ orderModel: any; invoiceModel: any; invoicesService: any }> = {},
) {
  const orderModel = overrides.orderModel ?? ({} as any);
  const invoiceModel = overrides.invoiceModel ?? {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  };
  const invoicesService = overrides.invoicesService ?? ({
    approveInvoice: jest.fn().mockResolvedValue(undefined),
  } as any);

  return new OrdersService(
    orderModel as any,
    invoiceModel as any,
    {} as any,
    {} as any,
    {} as any,
    { log: jest.fn().mockResolvedValue(undefined) } as any,
    {} as any,
    {} as any,
    invoicesService as any,
  );
}

describe("OrdersService invoice number validation", () => {
  it("rejects duplicated invoice numbers inside the same order", async () => {
    const service = buildService();

    await expect(
      (service as any).assertOrderInvoiceNumbersAvailable([
        { invoiceNumber: "HD20260001" },
        { invoiceNumber: " HD20260001 " },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invoice numbers that already exist in invoices", async () => {
    const lean = jest.fn().mockResolvedValue([{ invoiceNumber: "HD20260002" }]);
    const select = jest.fn().mockReturnValue({ lean });
    const find = jest.fn().mockReturnValue({ select });
    const service = buildService({
      invoiceModel: { find } as any,
    });

    await expect(
      (service as any).assertOrderInvoiceNumbersAvailable([
        { invoiceNumber: "HD20260002" },
      ]),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(find).toHaveBeenCalledWith({
      invoiceNumber: { $in: ["HD20260002"] },
    });
  });
});

describe("OrdersService approval guardrails", () => {
  it("requires an approval image before approving an order", async () => {
    const service = buildService({
      orderModel: {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "order-id",
            orderCode: "ORD-2026-0001",
            status: "SUBMITTED",
            items: [],
            receiptImage: "/uploads/invoices/order-sale-proof.png",
          }),
        }),
      } as any,
    });

    await expect(service.approve("order-id", { sub: "actor-id" } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("requires the sale receipt before approving an order", async () => {
    const service = buildService({
      orderModel: {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: "order-id",
            orderCode: "ORD-2026-0002",
            status: "SUBMITTED",
            items: [{ invoiceNumber: "HD20260003" }],
            receiptImage: "",
          }),
        }),
      } as any,
    });

    await expect(
      service.approve(
        "order-id",
        { sub: "actor-id" } as any,
        "/uploads/invoices/order-counterpart.png",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows approving offline trial orders with zero invoice amount without upload proofs", async () => {
    const approveInvoice = jest.fn().mockResolvedValue(undefined);
    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({
            _id: "order-id",
            orderCode: "ORD-2026-TRIAL-001",
            studentName: "Offline Trial",
            status: "SUBMITTED",
            receiptImage: "",
            items: [
              {
                teachingMode: "OFFLINE",
                trialSessions: 1,
                amount: 0,
                invoiceNumber: "HDTRIAL001",
              },
            ],
          }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({
            _id: "order-id",
            status: "APPROVED",
          }),
        }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({
      orderModel: orderModel as any,
      invoicesService: { approveInvoice } as any,
    });

    (service as any).assertOrderInvoiceNumbersAvailable = jest.fn().mockResolvedValue(undefined);
    (service as any).enrollmentService = {
      processApprovedOrder: jest.fn().mockResolvedValue({
        success: true,
        invoiceIds: ["invoice-trial-1"],
      }),
    };

    const result = await service.approve(
      "order-id",
      { sub: "actor-id" } as any,
    );

    expect(orderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "order-id",
      expect.objectContaining({
        status: "APPROVED",
        approvedBy: "actor-id",
      }),
      { new: true },
    );
    expect(approveInvoice).toHaveBeenCalledWith(
      "invoice-trial-1",
      { action: "APPROVE" },
      { sub: "actor-id" },
    );
    expect(result.enrollment.success).toBe(true);
  });

  it("auto-approves generated invoices after order approval", async () => {
    const approveInvoice = jest.fn().mockResolvedValue(undefined);
    const orderModel = {
      findById: jest
        .fn()
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({
            _id: "order-id",
            orderCode: "ORD-2026-0003",
            studentName: "Nguyen Van A",
            status: "SUBMITTED",
            items: [{ invoiceNumber: "HD20260010" }],
            receiptImage: "/uploads/invoices/order-sale-proof.png",
          }),
        })
        .mockReturnValueOnce({
          lean: jest.fn().mockResolvedValue({
            _id: "order-id",
            status: "COMPLETED",
          }),
        }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({
      orderModel: orderModel as any,
      invoicesService: { approveInvoice } as any,
    });

    (service as any).assertOrderInvoiceNumbersAvailable = jest.fn().mockResolvedValue(undefined);
    (service as any).enrollmentService = {
      processApprovedOrder: jest.fn().mockResolvedValue({
        success: true,
        invoiceIds: ["invoice-1", "invoice-2"],
      }),
    };

    const result = await service.approve(
      "order-id",
      { sub: "actor-id" } as any,
      "/uploads/invoices/order-counterpart.png",
    );

    expect(approveInvoice).toHaveBeenNthCalledWith(
      1,
      "invoice-1",
      { action: "APPROVE", approvalImage: "/uploads/invoices/order-counterpart.png" },
      { sub: "actor-id" },
    );
    expect(approveInvoice).toHaveBeenNthCalledWith(
      2,
      "invoice-2",
      { action: "APPROVE", approvalImage: "/uploads/invoices/order-counterpart.png" },
      { sub: "actor-id" },
    );
    expect(result.enrollment.success).toBe(true);
  });
});
