import { NotificationsListener } from './notifications.listener';
import { NotificationsService } from './notifications.service';
import { NotificationType } from './schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { OrderApprovedEvent } from '../orders/events/order-approved.event';

function buildListener(
  overrides: Partial<{
    notificationsService: Pick<NotificationsService, 'create' | 'notifyByRole'>;
  }> = {},
) {
  const notificationsService = overrides.notificationsService ?? {
    create: jest.fn().mockResolvedValue(undefined),
    notifyByRole: jest.fn().mockResolvedValue(undefined),
  };

  return {
    listener: new NotificationsListener(notificationsService as any),
    notificationsService,
  };
}

function buildPayload() {
  return new OrderApprovedEvent(
    'order-id',
    'ORD-2026-0001',
    'student-id',
    ['inv-1', 'inv-2'],
    'actor-id',
    {
      parentUserId: 'parent-id',
      parentPhone: '0901234567',
      studentName: 'Nguyen Van A',
      studentCode: 'HS001',
      saleId: 'sale-id',
      saleName: 'Sale One',
      items: [
        { preferredTeacherId: 'teacher-1' },
        { preferredTeacherId: 'teacher-2' },
        { preferredTeacherId: 'teacher-1' },
      ],
    },
    {
      parentUserId: 'parent-id',
      studentName: 'Nguyen Van A',
      studentCode: 'HS001',
      parentPhone: '0901234567',
      saleId: 'sale-id',
      saleName: 'Sale One',
    },
  );
}

describe('NotificationsListener.handleOrderApprovedNotifications', () => {
  it('creates parent, teacher, sale and ops notifications when payload contains recipients', async () => {
    const { listener, notificationsService } = buildListener();

    await listener.handleOrderApprovedNotifications(buildPayload());

    expect(notificationsService.create).toHaveBeenCalledTimes(4);
    expect(notificationsService.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipientId: 'parent-id',
        recipientRole: Role.PARENT,
        type: NotificationType.ORDER_APPROVED,
        targetId: 'order-id',
        targetModule: 'ORDERS',
      }),
    );
    expect(notificationsService.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        recipientId: 'teacher-1',
        recipientRole: Role.TEACHER,
        type: NotificationType.ORDER_APPROVED,
      }),
    );
    expect(notificationsService.create).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        recipientId: 'teacher-2',
        recipientRole: Role.TEACHER,
        type: NotificationType.ORDER_APPROVED,
      }),
    );
    expect(notificationsService.create).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        recipientId: 'sale-id',
        recipientRole: Role.SALE,
        type: NotificationType.SYSTEM,
      }),
    );
    expect(notificationsService.notifyByRole).toHaveBeenCalledWith(
      Role.OPS,
      expect.objectContaining({
        type: NotificationType.SYSTEM,
        targetId: 'order-id',
        targetModule: 'ORDERS',
      }),
    );
  });

  it('swallows notification errors and still resolves', async () => {
    const { listener, notificationsService } = buildListener({
      notificationsService: {
        create: jest.fn().mockRejectedValue(new Error('create failed')),
        notifyByRole: jest.fn().mockRejectedValue(new Error('notify failed')),
      } as any,
    });

    await expect(listener.handleOrderApprovedNotifications(buildPayload())).resolves.toBeUndefined();

    expect(notificationsService.create).toHaveBeenCalled();
    expect(notificationsService.notifyByRole).toHaveBeenCalledWith(
      Role.OPS,
      expect.any(Object),
    );
  });
});
