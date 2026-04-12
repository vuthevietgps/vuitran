import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification, NotificationDocument, NotificationType, NotificationPriority,
} from './schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { User, UserDocument } from '../users/schemas/user.schema';
import { BulkNotificationDto, NotificationRecipientGroup } from './dto/bulk-notification.dto';

export interface CreateNotificationParams {
  recipientId: string;
  recipientRole?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  targetId?: string;
  targetModule?: string;
}

type BulkNotificationRecipient = {
  _id: Types.ObjectId;
  fullName: string;
  role: Role;
  email?: string;
};

export interface BulkNotificationPreview {
  recipientGroup: NotificationRecipientGroup;
  recipientLabel: string;
  title: string;
  message: string;
  priority: NotificationPriority;
  link?: string;
  channels: string[];
  totalRecipients: number;
  sampleRecipients: Array<{
    recipientId: string;
    fullName: string;
    role: Role;
    email?: string;
  }>;
}

export interface BulkNotificationSendError {
  recipientId: string;
  recipientName: string;
  recipientRole: Role;
  error: string;
}

export interface BulkNotificationSendResult extends BulkNotificationPreview {
  successCount: number;
  failedCount: number;
  errors: BulkNotificationSendError[];
}

const BULK_NOTIFICATION_ALLOWED_ROLES = [Role.DIRECTOR, Role.OPS];

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Create a single notification */
  async create(params: CreateNotificationParams): Promise<Notification> {
    try {
      const entry = new this.notificationModel({
        recipientId: new Types.ObjectId(params.recipientId),
        recipientRole: params.recipientRole,
        type: params.type,
        priority: params.priority || NotificationPriority.MEDIUM,
        title: params.title,
        message: params.message,
        link: params.link,
        targetId: params.targetId,
        targetModule: params.targetModule,
      });
      return await entry.save();
    } catch (err) {
      console.error('Notification create error:', err);
      return params as any;
    }
  }

  /** Notify all users with a specific role */
  async notifyByRole(
    role: Role,
    params: Omit<CreateNotificationParams, 'recipientId' | 'recipientRole'>,
  ): Promise<void> {
    try {
      const users = await this.userModel.find({ role, isLocked: { $ne: true } }).select('_id').lean();
      const docs = users.map((u) => ({
        recipientId: u._id,
        recipientRole: role,
        ...params,
      }));
      if (docs.length > 0) {
        await this.notificationModel.insertMany(docs);
      }
    } catch (err) {
      console.error('Notify by role error:', err);
    }
  }

  async previewBulkNotification(
    actorRole: string,
    dto: BulkNotificationDto,
  ): Promise<BulkNotificationPreview> {
    this.assertBulkNotificationPermission(actorRole);
    const payload = this.normalizeBulkNotificationPayload(dto);
    const recipients = await this.resolveBulkRecipients(payload.recipientGroup);

    return {
      ...payload,
      recipientLabel: this.getBulkRecipientLabel(payload.recipientGroup),
      channels: ['IN_APP'],
      totalRecipients: recipients.length,
      sampleRecipients: recipients.slice(0, 5).map((recipient) => ({
        recipientId: recipient._id.toString(),
        fullName: recipient.fullName,
        role: recipient.role,
        email: recipient.email,
      })),
    };
  }

  async sendBulkNotification(
    actorRole: string,
    dto: BulkNotificationDto,
  ): Promise<BulkNotificationSendResult> {
    const preview = await this.previewBulkNotification(actorRole, dto);
    const recipients = await this.resolveBulkRecipients(preview.recipientGroup);

    if (recipients.length === 0) {
      throw new BadRequestException('Khong co nguoi nhan cho nhom duoc chon');
    }

    let successCount = 0;
    const errors: BulkNotificationSendError[] = [];

    for (const recipient of recipients) {
      try {
        await this.notificationModel.create({
          recipientId: recipient._id,
          recipientRole: recipient.role,
          type: NotificationType.SYSTEM,
          priority: preview.priority,
          title: preview.title,
          message: preview.message,
          link: preview.link,
          targetModule: 'notifications',
        });
        successCount += 1;
      } catch (error) {
        errors.push({
          recipientId: recipient._id.toString(),
          recipientName: recipient.fullName,
          recipientRole: recipient.role,
          error: this.getNotificationErrorMessage(error),
        });
      }
    }

    return {
      ...preview,
      successCount,
      failedCount: errors.length,
      errors,
    };
  }

  /** Get notifications for a user */
  async getMyNotifications(userId: string, query: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const filter: any = { recipientId: new Types.ObjectId(userId) };
    if (query.unreadOnly) filter.isRead = false;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        recipientId: new Types.ObjectId(userId),
        isRead: false,
      }),
    ]);

    return { data, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Get unread count */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  /** Mark one notification as read */
  async markAsRead(notificationId: string, userId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), recipientId: new Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
  }

  /** Mark all as read */
  async markAllAsRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { modifiedCount: result.modifiedCount };
  }

  /** Delete old notifications (>30 days, read) */
  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.notificationModel.deleteMany({
      isRead: true,
      createdAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }

  private assertBulkNotificationPermission(role: string): void {
    if (!BULK_NOTIFICATION_ALLOWED_ROLES.includes(role as Role)) {
      throw new ForbiddenException('Ban khong co quyen gui thong bao hang loat');
    }
  }

  private normalizeBulkNotificationPayload(dto: BulkNotificationDto): Omit<BulkNotificationPreview, 'recipientLabel' | 'channels' | 'totalRecipients' | 'sampleRecipients'> {
    const recipientGroup = dto?.recipientGroup;
    const title = dto?.title?.trim?.() || '';
    const message = dto?.message?.trim?.() || '';
    const priority = dto?.priority || NotificationPriority.MEDIUM;
    const link = dto?.link?.trim?.() || undefined;

    if (!Object.values(NotificationRecipientGroup).includes(recipientGroup)) {
      throw new BadRequestException('Nhom nhan khong hop le');
    }
    if (!title) {
      throw new BadRequestException('Tieu de thong bao la bat buoc');
    }
    if (!message) {
      throw new BadRequestException('Noi dung thong bao la bat buoc');
    }
    if (!Object.values(NotificationPriority).includes(priority)) {
      throw new BadRequestException('Muc uu tien khong hop le');
    }

    return {
      recipientGroup,
      title,
      message,
      priority,
      link,
    };
  }

  private async resolveBulkRecipients(
    recipientGroup: NotificationRecipientGroup,
  ): Promise<BulkNotificationRecipient[]> {
    const query = this.userModel
      .find(this.buildBulkRecipientFilter(recipientGroup))
      .select('_id fullName role email')
      .sort({ fullName: 1 });
    return query.lean<BulkNotificationRecipient[]>();
  }

  private buildBulkRecipientFilter(recipientGroup: NotificationRecipientGroup) {
    switch (recipientGroup) {
      case NotificationRecipientGroup.PARENTS:
        return { role: Role.PARENT, status: UserStatus.ACTIVE };
      case NotificationRecipientGroup.TEACHERS:
        return { role: Role.TEACHER, status: UserStatus.ACTIVE };
      case NotificationRecipientGroup.SALES:
        return { role: Role.SALE, status: UserStatus.ACTIVE };
      case NotificationRecipientGroup.OPS:
        return { role: Role.OPS, status: UserStatus.ACTIVE };
      case NotificationRecipientGroup.ACCOUNTING:
        return { role: Role.ACCOUNTING, status: UserStatus.ACTIVE };
      case NotificationRecipientGroup.ALL_STAFF:
        return {
          role: { $in: [Role.DIRECTOR, Role.OPS, Role.ACCOUNTING, Role.SALE, Role.ADSMANAGER] },
          status: UserStatus.ACTIVE,
        };
      default:
        throw new BadRequestException('Nhom nhan khong duoc ho tro');
    }
  }

  private getBulkRecipientLabel(recipientGroup: NotificationRecipientGroup): string {
    switch (recipientGroup) {
      case NotificationRecipientGroup.PARENTS:
        return 'Phu huynh';
      case NotificationRecipientGroup.TEACHERS:
        return 'Giao vien';
      case NotificationRecipientGroup.SALES:
        return 'Sale';
      case NotificationRecipientGroup.OPS:
        return 'Van hanh';
      case NotificationRecipientGroup.ACCOUNTING:
        return 'Ke toan';
      case NotificationRecipientGroup.ALL_STAFF:
        return 'Toan bo nhan su noi bo';
      default:
        return 'Khac';
    }
  }

  private getNotificationErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return 'Khong the tao thong bao';
  }
}
