import { AuditLogListener } from './audit-log.listener';
import { AuditLogService } from './audit-log.service';
import { AuditAction, AuditModule } from './schemas/audit-log.schema';
import { OrderApprovedEvent } from '../orders/events/order-approved.event';

function buildListener(
  overrides: Partial<{
    auditLogService: Pick<AuditLogService, 'log'>;
  }> = {},
) {
  const auditLogService = overrides.auditLogService ?? {
    log: jest.fn().mockResolvedValue(undefined),
  };

  return {
    listener: new AuditLogListener(auditLogService as any),
    auditLogService,
  };
}

function buildPayload(isNew = true) {
  return new OrderApprovedEvent(
    'order-id',
    'ORD-2026-0001',
    'student-id',
    ['inv-1', 'inv-2'],
    'actor-id',
    {
      parentUserId: 'parent-id',
      studentName: 'Nguyen Van A',
      studentCode: 'HS001',
      saleId: 'sale-id',
    },
    {
      parentUserId: 'parent-id',
      studentName: 'Nguyen Van A',
      studentCode: 'HS001',
      saleId: 'sale-id',
      actorEmail: 'director@school.com',
      actorFullName: 'Director',
      actorRole: 'DIRECTOR',
      isNew,
    },
  );
}

describe('AuditLogListener.handleOrderApprovedAudit', () => {
  it('writes student creation and order status audit logs for new enrollments', async () => {
    const { listener, auditLogService } = buildListener();

    await listener.handleOrderApprovedAudit(buildPayload(true));

    expect(auditLogService.log).toHaveBeenCalledTimes(2);
    expect(auditLogService.log).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: AuditAction.CREATE,
        module: AuditModule.STUDENTS,
        targetId: 'student-id',
        targetName: 'HS001',
      }),
    );
    expect(auditLogService.log).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: AuditAction.STATUS_CHANGE,
        module: AuditModule.ORDERS,
        targetId: 'order-id',
        targetName: 'ORD-2026-0001',
      }),
    );
  });

  it('writes only order status log when enrollment is not new', async () => {
    const { listener, auditLogService } = buildListener();

    await listener.handleOrderApprovedAudit(buildPayload(false));

    expect(auditLogService.log).toHaveBeenCalledTimes(1);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.STATUS_CHANGE,
        module: AuditModule.ORDERS,
        newValue: expect.objectContaining({
          isNew: false,
          parentUserId: 'parent-id',
          saleId: 'sale-id',
        }),
      }),
    );
  });

  it('swallows audit log failures', async () => {
    const { listener, auditLogService } = buildListener({
      auditLogService: {
        log: jest.fn().mockRejectedValue(new Error('audit failed')),
      } as any,
    });

    await expect(listener.handleOrderApprovedAudit(buildPayload(true))).resolves.toBeUndefined();
    expect(auditLogService.log).toHaveBeenCalled();
  });
});
