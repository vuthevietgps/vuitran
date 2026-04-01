import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AttendanceService } from './attendance.service';
import { AttendanceController, PublicAttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from './schemas/attendance.schema';
import { ClassesModule } from '../classes/classes.module';
import { StudentsModule } from '../students/students.module';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { TrialEnrollment, TrialEnrollmentSchema } from '../trial-enrollments/schemas/trial-enrollment.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: TrialEnrollment.name, schema: TrialEnrollmentSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
    ClassesModule,
    StudentsModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
  ],
  controllers: [AttendanceController, PublicAttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService, MongooseModule],
})
export class AttendanceModule {}
