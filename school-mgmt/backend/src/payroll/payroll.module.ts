import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import {
  Payroll,
  PayrollSchema,
  PayrollItem,
  PayrollItemSchema,
} from './schemas/payroll.schema';
import { PayrollTransactionModule } from './payroll-transaction.module';
import { SessionsModule } from '../sessions/sessions.module';
import { FinancialControlModule } from '../financial-control/financial-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payroll.name, schema: PayrollSchema },
      { name: PayrollItem.name, schema: PayrollItemSchema },
    ]),
    PayrollTransactionModule,
    SessionsModule,
    FinancialControlModule, // BUG #3 fix: cần FinancialControlBankFundService để ghi BankTransaction khi trả lương
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService, PayrollTransactionModule],
})
export class PayrollModule {}
