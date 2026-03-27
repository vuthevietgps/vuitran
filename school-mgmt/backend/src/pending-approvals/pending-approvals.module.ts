import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PendingApprovalsController } from './pending-approvals.controller';
import { PendingApprovalsService } from './pending-approvals.service';
import { Payroll, PayrollSchema } from '../payroll/schemas/payroll.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { LedgerEntry, LedgerEntrySchema } from '../wallets/schemas/ledger-entry.schema';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payroll.name, schema: PayrollSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: Classroom.name, schema: ClassroomSchema },
    ]),
  ],
  controllers: [PendingApprovalsController],
  providers: [PendingApprovalsService],
})
export class PendingApprovalsModule {}
