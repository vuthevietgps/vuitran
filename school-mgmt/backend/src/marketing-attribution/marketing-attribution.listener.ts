import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { MarketingAttributionService } from "./marketing-attribution.service";
import { OrderApprovedEvent } from "../orders/events/order-approved.event";
import { ParentAttributionSourceType } from "./schemas/parent-attribution.schema";

@Injectable()
export class MarketingAttributionListener {
  private readonly logger = new Logger(MarketingAttributionListener.name);

  constructor(
    private readonly attributionService: MarketingAttributionService,
  ) {}

  @OnEvent("order.approved.success", { async: true })
  async handleOrderApprovedAttribution(
    payload: OrderApprovedEvent,
  ): Promise<void> {
    try {
      const parentUserId =
        payload.extras.parentUserId ||
        payload.rawOrderData?.parentUserId?.toString?.() ||
        payload.rawOrderData?.parentUserId ||
        undefined;

      await this.attributionService.upsertParentAttribution({
        parentUserId,
        parentPhone:
          payload.extras.parentPhone || payload.rawOrderData?.parentPhone,
        adGroupId: payload.extras.adGroupId || payload.rawOrderData?.adGroupId,
        adGroupName:
          payload.extras.adGroupName || payload.rawOrderData?.adGroupName,
        platform: payload.rawOrderData?.leadSource,
        sourceOrderId: payload.orderId,
        sourceType: ParentAttributionSourceType.STUDENT,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Attribution failed for order ${payload.orderCode}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
