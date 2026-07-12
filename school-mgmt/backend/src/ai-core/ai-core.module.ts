import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardModule } from '../dashboard/dashboard.module';
import { FinancialControlModule } from '../financial-control/financial-control.module';
import { PendingApprovalsModule } from '../pending-approvals/pending-approvals.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AdsModule } from '../ads/ads.module';
import { StudentsModule } from '../students/students.module';
import { ClassesModule } from '../classes/classes.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { LeadsModule } from '../leads/leads.module';
import { MessagesModule } from '../messages/messages.module';
import { OrdersModule } from '../orders/orders.module';
import { TicketsModule } from '../tickets/tickets.module';
import { SessionsModule } from '../sessions/sessions.module';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { TeachingMaterialsModule } from '../teaching-materials/teaching-materials.module';
import { TrialEnrollmentsModule } from '../trial-enrollments/trial-enrollments.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { WorkSessionsModule } from '../work-sessions/work-sessions.module';
import { TeachersModule } from '../teachers/teachers.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PayrollModule } from '../payroll/payroll.module';
import { StaffPayrollModule } from '../staff-payroll/staff-payroll.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { LoansModule } from '../loans/loans.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { Ticket, TicketSchema } from '../tickets/schemas/ticket.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { AiAssistantResolverService } from './assistant-resolver.service';
import { AiSituationRouterService } from './situation-router.service';
import { AiPolicyEngineService } from './policy-engine.service';
import { AiToolRegistryService } from './tool-registry.service';
import { AiContextBuilderService } from './context-builder.service';
import { AiProviderService } from './ai-provider.service';
import { AiResponseGuardService } from './response-guard.service';
import { AiEntityResolverService } from './entity-resolver.service';
import { AiActionPolicyService } from './action-policy.service';
import { AiActionExecutorService } from './action-executor.service';
import { AiActionDraftService } from './action-draft.service';
import { AiActionPlannerService } from './action-planner.service';
import { AiSession, AiSessionSchema } from './schemas/ai-session.schema';
import { AiMessage, AiMessageSchema } from './schemas/ai-message.schema';
import { AiActionDraft, AiActionDraftSchema } from './schemas/ai-action-draft.schema';

@Module({
  imports: [
    DashboardModule,
    FinancialControlModule,
    PendingApprovalsModule,
    ChatbotModule,
    AuditLogModule,
    AdsModule,
    StudentsModule,
    ClassesModule,
    InvoicesModule,
    LeadsModule,
    MessagesModule,
    OrdersModule,
    TicketsModule,
    SessionsModule,
    QuizzesModule,
    TeachingMaterialsModule,
    TrialEnrollmentsModule,
    AttendanceModule,
    WorkSessionsModule,
    TeachersModule,
    WalletsModule,
    PayrollModule,
    StaffPayrollModule,
    ExpensesModule,
    LoansModule,
    MongooseModule.forFeature([
      { name: AiSession.name, schema: AiSessionSchema },
      { name: AiMessage.name, schema: AiMessageSchema },
      { name: AiActionDraft.name, schema: AiActionDraftSchema },
      { name: User.name, schema: UserSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: Session.name, schema: SessionSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
    ]),
  ],
  controllers: [AiChatController],
  providers: [
    AiChatService,
    AiAssistantResolverService,
    AiSituationRouterService,
    AiPolicyEngineService,
    AiToolRegistryService,
    AiContextBuilderService,
    AiProviderService,
    AiResponseGuardService,
    AiEntityResolverService,
    AiActionPolicyService,
    AiActionExecutorService,
    AiActionDraftService,
    AiActionPlannerService,
  ],
  exports: [
    AiChatService,
    AiAssistantResolverService,
    AiSituationRouterService,
    AiPolicyEngineService,
    AiToolRegistryService,
    AiEntityResolverService,
    AiActionDraftService,
    AiActionPlannerService,
  ],
})
export class AiCoreModule {}
