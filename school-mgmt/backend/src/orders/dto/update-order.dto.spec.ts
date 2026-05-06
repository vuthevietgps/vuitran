import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateOrderDto } from './update-order.dto';

describe('UpdateOrderDto optional relation ids', () => {
  it('normalizes blank relation ids to null so edit payload can clear links', () => {
    const dto = plainToInstance(UpdateOrderDto, {
      parentUserId: '',
      existingStudentId: '',
      saleId: '',
    });
    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.parentUserId).toBeNull();
    expect(dto.existingStudentId).toBeNull();
    expect(dto.saleId).toBeNull();
  });

  it('still rejects malformed Mongo ids', () => {
    const dto = plainToInstance(UpdateOrderDto, {
      existingStudentId: 'not-a-mongo-id',
    });
    const errors = validateSync(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0]?.constraints).toEqual(
      expect.objectContaining({
        isMongoId: expect.any(String),
      }),
    );
  });

  it('normalizes requestedClassCode in nested order items', () => {
    const dto = plainToInstance(UpdateOrderDto, {
      items: [
        {
          productId: 'P1',
          sessions: 12,
          pricePerSession: 200000,
          amount: 2400000,
          requestedClassCode: ' cls-off-001 ',
        },
      ],
    });
    const errors = validateSync(dto);

    expect(errors).toHaveLength(0);
    expect(dto.items?.[0]?.requestedClassCode).toBe('CLS-OFF-001');
  });
});
