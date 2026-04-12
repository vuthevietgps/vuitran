import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardService } from './dashboard.service';
import { DashboardDailyTasksService } from './dashboard-daily-tasks.service';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { DashboardController } from './dashboard.controller';
import { AdsModule } from '../ads/ads.module';

import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';
import { LedgerEntry, LedgerEntrySchema } from '../wallets/schemas/ledger-entry.schema';
import { Payroll, PayrollSchema } from '../payroll/schemas/payroll.schema';
import { PayrollTransaction, PayrollTransactionSchema } from '../payroll/schemas/payroll-transaction.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Expense, ExpenseSchema } from '../expenses/schemas/expense.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { TrialEnrollment, TrialEnrollmentSchema } from '../trial-enrollments/schemas/trial-enrollment.schema';

@Module({
  imports: [
    AdsModule,
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: Payroll.name, schema: PayrollSchema },
      { name: PayrollTransaction.name, schema: PayrollTransactionSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: TrialEnrollment.name, schema: TrialEnrollmentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardDailyTasksService, DashboardAnalyticsService],
  exports: [DashboardService],
})
export class DashboardModule {}
