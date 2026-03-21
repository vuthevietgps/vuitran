import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayrollTransactionService } from './payroll-transaction.service';
import {
  PayrollTransaction,
  PayrollTransactionSchema,
} from './schemas/payroll-transaction.schema';

/**
 * PayrollTransactionModule: Module riêng cho PayrollTransaction.
 *
 * Tách riêng để tránh circular dependency với SessionsModule.
 * Cả PayrollModule và SessionsModule đều có thể import module này.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PayrollTransaction.name, schema: PayrollTransactionSchema },
    ]),
  ],
  providers: [PayrollTransactionService],
  exports: [PayrollTransactionService, MongooseModule],
})
export class PayrollTransactionModule {}
