import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import {
  PayrollTransaction,
  PayrollTransactionSchema,
} from '../payroll/schemas/payroll-transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Session.name, schema: SessionSchema },
      { name: PayrollTransaction.name, schema: PayrollTransactionSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
