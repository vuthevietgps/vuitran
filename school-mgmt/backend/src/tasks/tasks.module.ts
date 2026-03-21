import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { PayrollTransactionModule } from '../payroll/payroll-transaction.module';

/**
 * TasksModule:
 * Chứa các Cronjob và background tasks của hệ thống.
 * Hiện tại bao gồm:
 *   - ReconciliationService: Đối soát nightly Session ↔ PayrollTransaction
 *
 * Cần import ScheduleModule.forRoot() ở AppModule (đã có).
 */
@Module({
  imports: [
    // Register Session model trực tiếp (SessionsModule chỉ export SessionsService)
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    // PayrollTransactionModule export MongooseModule (với PayrollTransaction model)
    // và PayrollTransactionService — dùng để tạo PayrollTransaction khi cần
    PayrollTransactionModule,
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class TasksModule {}
