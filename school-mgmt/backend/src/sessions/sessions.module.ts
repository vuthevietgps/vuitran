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
import { ReportTemplate, ReportTemplateSchema } from '../report-templates/schemas/report-template.schema';
import { TeachingMaterial, TeachingMaterialSchema } from '../teaching-materials/schemas/teaching-material.schema';
import { Quiz, QuizSchema } from '../quizzes/schemas/quiz.schema';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SessionSettlementService } from './session-settlement.service';
import { SessionTrialService } from './session-trial.service';
import { SessionWorkflowService } from './session-workflow.service';
import { SessionCronService } from './session-cron.service';
import { SessionPayrollService } from './session-payroll.service';
import { SessionQueryService } from './session-query.service';
import { StorageUrlService } from '../common/storage-url.service';

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
      { name: ReportTemplate.name, schema: ReportTemplateSchema },
      { name: TeachingMaterial.name, schema: TeachingMaterialSchema },
      { name: Quiz.name, schema: QuizSchema },
    ]),
    forwardRef(() => WalletsModule),
    PayrollTransactionModule,
    TicketsModule,
    MessagesModule,
    AuditLogModule,
  ],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    SessionSettlementService,
    SessionTrialService,
    SessionWorkflowService,
    SessionCronService,
    SessionPayrollService,
    SessionQueryService,
    StorageUrlService,
  ],
  exports: [SessionsService, SessionCronService], // Export for Wallet/Payroll/dev modules to use
})
export class SessionsModule {}
