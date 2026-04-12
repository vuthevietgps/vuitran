import { NotificationPriority } from '../schemas/notification.schema';

export enum NotificationRecipientGroup {
  PARENTS = 'PARENTS',
  TEACHERS = 'TEACHERS',
  SALES = 'SALES',
  OPS = 'OPS',
  ACCOUNTING = 'ACCOUNTING',
  ALL_STAFF = 'ALL_STAFF',
}

export class BulkNotificationDto {
  recipientGroup!: NotificationRecipientGroup;
  title!: string;
  message!: string;
  priority?: NotificationPriority;
  link?: string;
}
