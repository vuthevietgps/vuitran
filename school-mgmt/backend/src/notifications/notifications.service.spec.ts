import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { NotificationPriority, NotificationType } from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { NotificationRecipientGroup } from './dto/bulk-notification.dto';

function createFindChain<T>(value: T) {
  return {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('NotificationsService bulk notifications', () => {
  it('previews a parent bulk notification with exact resolved group, count, and trimmed content', async () => {
    const parentA = {
      _id: new Types.ObjectId(),
      fullName: 'Parent A',
      role: Role.PARENT,
      email: 'parent-a@example.com',
    };
    const parentB = {
      _id: new Types.ObjectId(),
      fullName: 'Parent B',
      role: Role.PARENT,
      email: 'parent-b@example.com',
    };
    const userModel = {
      find: jest.fn().mockReturnValue(createFindChain([parentA, parentB])),
    };
    const service = new NotificationsService({ create: jest.fn() } as any, userModel as any);

    const preview = await service.previewBulkNotification(Role.DIRECTOR, {
      recipientGroup: NotificationRecipientGroup.PARENTS,
      title: '  Bao tri he thong  ',
      message: '  Lop se nghi 1 ngay de bao tri.  ',
      priority: NotificationPriority.HIGH,
    });

    expect(userModel.find).toHaveBeenCalledWith({
      role: Role.PARENT,
      status: 'ACTIVE',
    });
    expect(preview).toEqual({
      recipientGroup: NotificationRecipientGroup.PARENTS,
      recipientLabel: 'Phu huynh',
      title: 'Bao tri he thong',
      message: 'Lop se nghi 1 ngay de bao tri.',
      priority: NotificationPriority.HIGH,
      link: undefined,
      channels: ['IN_APP'],
      totalRecipients: 2,
      sampleRecipients: [
        {
          recipientId: parentA._id.toString(),
          fullName: 'Parent A',
          role: Role.PARENT,
          email: 'parent-a@example.com',
        },
        {
          recipientId: parentB._id.toString(),
          fullName: 'Parent B',
          role: Role.PARENT,
          email: 'parent-b@example.com',
        },
      ],
    });
  });

  it('sends a bulk notification and reports ordered per-recipient failures without hiding partial success', async () => {
    const teacherA = {
      _id: new Types.ObjectId(),
      fullName: 'Teacher A',
      role: Role.TEACHER,
      email: 'teacher-a@example.com',
    };
    const teacherB = {
      _id: new Types.ObjectId(),
      fullName: 'Teacher B',
      role: Role.TEACHER,
      email: 'teacher-b@example.com',
    };
    const notificationModel = {
      create: jest.fn()
        .mockResolvedValueOnce({ _id: new Types.ObjectId() })
        .mockRejectedValueOnce(new Error('SMTP timeout')),
    };
    const userModel = {
      find: jest.fn().mockReturnValue(createFindChain([teacherA, teacherB])),
    };
    const service = new NotificationsService(notificationModel as any, userModel as any);

    const result = await service.sendBulkNotification(Role.OPS, {
      recipientGroup: NotificationRecipientGroup.TEACHERS,
      title: 'Thong bao giao vien',
      message: 'Vui long kiem tra lich day moi.',
      priority: NotificationPriority.URGENT,
    });

    expect(notificationModel.create).toHaveBeenNthCalledWith(1, {
      recipientId: teacherA._id,
      recipientRole: Role.TEACHER,
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.URGENT,
      title: 'Thong bao giao vien',
      message: 'Vui long kiem tra lich day moi.',
      link: undefined,
      targetModule: 'notifications',
    });
    expect(notificationModel.create).toHaveBeenNthCalledWith(2, {
      recipientId: teacherB._id,
      recipientRole: Role.TEACHER,
      type: NotificationType.SYSTEM,
      priority: NotificationPriority.URGENT,
      title: 'Thong bao giao vien',
      message: 'Vui long kiem tra lich day moi.',
      link: undefined,
      targetModule: 'notifications',
    });
    expect(result.successCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toEqual([
      {
        recipientId: teacherB._id.toString(),
        recipientName: 'Teacher B',
        recipientRole: Role.TEACHER,
        error: 'SMTP timeout',
      },
    ]);
  });

  it('rejects bulk notifications for non admin-ops roles', async () => {
    const service = new NotificationsService({} as any, {} as any);

    await expect(
      service.previewBulkNotification(Role.PARENT, {
        recipientGroup: NotificationRecipientGroup.PARENTS,
        title: 'Blocked',
        message: 'Blocked',
        priority: NotificationPriority.MEDIUM,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
