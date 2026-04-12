import { Module, Global } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Notification,
  NotificationSchema,
} from "./schemas/notification.schema";
import { NotificationsService } from "./notifications.service";
import { ExternalNotificationService } from "./external-notification.service";
import { NotificationsListener } from "./notifications.listener";
import { NotificationsController } from "./notifications.controller";
import { User, UserSchema } from "../users/schemas/user.schema";

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    ExternalNotificationService,
    NotificationsListener,
  ],
  exports: [NotificationsService, ExternalNotificationService],
})
export class NotificationsModule {}
