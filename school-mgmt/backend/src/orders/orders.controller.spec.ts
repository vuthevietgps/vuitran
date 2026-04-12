import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderWorkflowService } from './order-workflow.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { RolesGuard } from '../common/guards/roles.guard';

function createExecutionContext(userRole: Role) {
  const request = { user: { role: userRole } };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => OrdersController.prototype.approve,
    getClass: () => OrdersController,
  } as any;
}

describe('OrdersController approve auth', () => {
  let controller: OrdersController;
  let service: { approve: jest.Mock };
  let workflowService: { approve: jest.Mock };
  let guard: RolesGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            approve: jest.fn(),
          },
        },
        {
          provide: OrderWorkflowService,
          useValue: {
            approve: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(OrdersController);
    service = moduleRef.get(OrdersService);
    workflowService = moduleRef.get(OrderWorkflowService);
    guard = new RolesGuard(new Reflector());
  });

  it('decorates approve route for OPS and DIRECTOR only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, OrdersController.prototype.approve)).toEqual([
      Role.OPS,
      Role.DIRECTOR,
    ]);
  });

  it('allows DIRECTOR and OPS, rejects SALE and TEACHER', () => {
    expect(guard.canActivate(createExecutionContext(Role.DIRECTOR))).toBe(true);
    expect(guard.canActivate(createExecutionContext(Role.OPS))).toBe(true);
    expect(guard.canActivate(createExecutionContext(Role.SALE))).toBe(false);
    expect(guard.canActivate(createExecutionContext(Role.TEACHER))).toBe(false);
  });

  it('delegates approve calls to OrderWorkflowService', async () => {
    workflowService.approve.mockResolvedValue({
      order: { _id: 'order-id' },
      enrollment: { success: true },
    });

    await expect(
      controller.approve(
        'order-id',
        { approvalImage: '/uploads/invoices/counter-proof.png' },
        { user: { role: Role.DIRECTOR } } as any,
      ),
    ).resolves.toEqual({
      order: { _id: 'order-id' },
      enrollment: { success: true },
    });

    expect(workflowService.approve).toHaveBeenCalledWith(
      'order-id',
      { role: Role.DIRECTOR },
      '/uploads/invoices/counter-proof.png',
    );
    expect(service.approve).not.toHaveBeenCalled();
  });
});
