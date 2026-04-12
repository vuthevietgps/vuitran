import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { Payroll, PayrollSchema } from '../payroll/schemas/payroll.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { LedgerEntry, LedgerEntrySchema } from '../wallets/schemas/ledger-entry.schema';
import { AdsModule } from '../ads/ads.module';
import { FinancialControlModule } from '../financial-control/financial-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payroll.name, schema: PayrollSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Session.name, schema: SessionSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
    ]),
    AdsModule,
    FinancialControlModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
