import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { NotificationsService } from "./notifications.service";
import { NotificationType } from "./schemas/notification.schema";
import { Role } from "../common/interfaces/role.enum";
import { OrderApprovedEvent } from "../orders/events/order-approved.event";

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  private normalizeObjectId(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    return (
      (value as any)?._id?.toString?.() ||
      (value as any)?.toString?.() ||
      undefined
    );
  }

  private getOrderItems(payload: OrderApprovedEvent): any[] {
    return Array.isArray(payload.rawOrderData?.items)
      ? payload.rawOrderData.items
      : [];
  }

  private getTeacherRecipientIds(payload: OrderApprovedEvent): string[] {
    return Array.from(
      new Set(
        this.getOrderItems(payload)
          .map((item: any) => this.normalizeObjectId(item?.preferredTeacherId))
          .filter((id): id is string => !!id),
      ),
    );
  }

  private getParentRecipientId(payload: OrderApprovedEvent): string | undefined {
    return (
      payload.extras.parentUserId ||
      this.normalizeObjectId(payload.rawOrderData?.parentUserId) ||
      undefined
    );
  }

  private async safeCreateNotification(params: Parameters<NotificationsService["create"]>[0], context: string): Promise<void> {
    try {
      await this.notificationsService.create(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `${context} failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async safeNotifyByRole(
    role: Role,
    params: Parameters<NotificationsService["notifyByRole"]>[1],
    context: string,
  ): Promise<void> {
    try {
      await this.notificationsService.notifyByRole(role, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `${context} failed: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  @OnEvent("order.approved.success", { async: true })
  async handleOrderApprovedNotifications(
    payload: OrderApprovedEvent,
  ): Promise<void> {
    const studentName =
      payload.extras.studentName || payload.rawOrderData?.studentName || "";
    const studentCode =
      payload.extras.studentCode ||
      payload.rawOrderData?.studentCode ||
      payload.studentId;
    const parentPhone =
      payload.extras.parentPhone || payload.rawOrderData?.parentPhone || "";
    const saleId =
      payload.extras.saleId ||
      payload.rawOrderData?.saleId?.toString?.() ||
      payload.rawOrderData?.saleId ||
      "";
    const saleName =
      payload.extras.saleName || payload.rawOrderData?.saleName || "";
    const orderCode = payload.orderCode;
    const invoiceCount = payload.invoiceIds.length;
    const parentUserId = this.getParentRecipientId(payload);
    const teacherRecipientIds = this.getTeacherRecipientIds(payload);

    if (parentUserId) {
      await this.safeCreateNotification(
        {
          recipientId: parentUserId,
          recipientRole: Role.PARENT,
          type: NotificationType.ORDER_APPROVED,
          title: `Ho so hoc tap da san sang cho ${studentName || orderCode}`,
          message:
            `Hoc vien ${studentName || studentCode} (${studentCode}) da duoc tao trong he thong. ` +
            `Don ${orderCode} da tao ${invoiceCount} hoa don.`,
          link: "/app/parent-invoices",
          targetId: payload.orderId,
          targetModule: "ORDERS",
        },
        `Parent notification for order ${orderCode}`,
      );
    }

    for (const teacherRecipientId of teacherRecipientIds) {
      await this.safeCreateNotification(
        {
          recipientId: teacherRecipientId,
          recipientRole: Role.TEACHER,
          type: NotificationType.ORDER_APPROVED,
          title: `Co thong tin hoc vien moi tu don ${orderCode}`,
          message:
            `Hoc vien ${studentName || studentCode} (${studentCode}) da duoc tao trong he thong. ` +
            `Don ${orderCode} da tao ${invoiceCount} hoa don.`,
          link: "/app/notifications",
          targetId: payload.orderId,
          targetModule: "ORDERS",
        },
        `Teacher notification for order ${orderCode} and recipient ${teacherRecipientId}`,
      );
    }

    if (saleId) {
      await this.safeCreateNotification(
        {
          recipientId: saleId,
          recipientRole: Role.SALE,
          type: NotificationType.SYSTEM,
          title: `Don ${orderCode} da khoi tao du lieu`,
          message:
            `Don ${orderCode} (${studentName}) da duoc duyet va khoi tao tu dong. ` +
            `Hoc vien: ${studentCode}, ${invoiceCount} hoa don da tao. ` +
            `Tiep tuc duyet hoa don va tao/ghep lop de hoan tat.`,
          link: "/orders",
          targetId: payload.orderId,
          targetModule: "ORDERS",
        },
        `Sale notification for order ${orderCode}`,
      );
    }

    await this.safeNotifyByRole(
      Role.OPS,
      {
        type: NotificationType.SYSTEM,
        title: `Khoi tao enrollment tu dong: ${orderCode}`,
        message:
          `Don ${orderCode} (${studentName}) da khoi tao xong: ` +
          `Student ${studentCode}, ${invoiceCount} hoa don.` +
          (parentPhone ? ` Parent: ${parentPhone}.` : "") +
          (saleName ? ` Sale: ${saleName}.` : ""),
        link: "/orders",
        targetId: payload.orderId,
        targetModule: "ORDERS",
      },
      `OPS notification for order ${orderCode}`,
    );
  }
}
