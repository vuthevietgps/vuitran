import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { Session, SessionSchema } from './schemas/session.schema';
import {
  SessionChangeRequest,
  SessionChangeRequestSchema,
} from './schemas/session-change-request.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { WalletsModule } from '../wallets/wallets.module';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { PayrollTransactionModule } from '../payroll/payroll-transaction.module';
import { TicketsModule } from '../tickets/tickets.module';
import { MessagesModule } from '../messages/messages.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: SessionChangeRequest.name, schema: SessionChangeRequestSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => WalletsModule),
    PayrollTransactionModule,
    TicketsModule,
    MessagesModule,
    AuditLogModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService], // Export for Wallet/Payroll modules to use
})
export class SessionsModule {}
