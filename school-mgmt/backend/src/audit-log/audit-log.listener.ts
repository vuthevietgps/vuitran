import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { AuditLogService } from "./audit-log.service";
import { AuditAction, AuditModule } from "./schemas/audit-log.schema";
import { OrderApprovedEvent } from "../orders/events/order-approved.event";

@Injectable()
export class AuditLogListener {
  private readonly logger = new Logger(AuditLogListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnEvent("order.approved.success", { async: true })
  async handleOrderApprovedAudit(payload: OrderApprovedEvent): Promise<void> {
    try {
      const studentCode =
        payload.extras.studentCode ||
        payload.rawOrderData?.studentCode ||
        payload.studentId;
      const studentName =
        payload.extras.studentName || payload.rawOrderData?.studentName || "";
      const isNew = Boolean(payload.extras.isNew);

      if (isNew) {
        await this.auditLogService.log({
          userId: payload.actorId,
          userEmail: payload.extras.actorEmail,
          userFullName: payload.extras.actorFullName,
          userRole: payload.extras.actorRole,
          action: AuditAction.CREATE,
          module: AuditModule.STUDENTS,
          targetId: payload.studentId,
          targetName: studentCode,
          description: `Tu dong tao hoc vien ${studentCode} - ${studentName} tu don ${payload.orderCode}`,
        });
      }

      await this.auditLogService.log({
        userId: payload.actorId,
        userEmail: payload.extras.actorEmail,
        userFullName: payload.extras.actorFullName,
        userRole: payload.extras.actorRole,
        action: AuditAction.STATUS_CHANGE,
        module: AuditModule.ORDERS,
        targetId: payload.orderId,
        targetName: payload.orderCode,
        description:
          `Don ${payload.orderCode} da khoi tao du lieu tu dong: Student ${studentCode}` +
          (isNew ? " (moi)" : "") +
          `, ${payload.invoiceIds.length} hoa don.` +
          (studentName ? ` Hoc vien: ${studentName}.` : ""),
        newValue: {
          orderId: payload.orderId,
          studentId: payload.studentId,
          studentCode,
          parentUserId:
            payload.extras.parentUserId ||
            payload.rawOrderData?.parentUserId?.toString?.(),
          invoiceIds: payload.invoiceIds,
          saleId:
            payload.extras.saleId || payload.rawOrderData?.saleId?.toString?.(),
          isNew,
        } as any,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Audit log failed for order ${payload.orderCode}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
