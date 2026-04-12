import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { Order, OrderSchema } from "./schemas/order.schema";
import { EnrollmentService } from "./enrollment.service";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { Student, StudentSchema } from "../students/schemas/student.schema";
import { Invoice, InvoiceSchema } from "../invoices/schemas/invoice.schema";
import { Lead, LeadSchema } from "../leads/schemas/lead.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { MarketingAttributionModule } from "../marketing-attribution/marketing-attribution.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { StudentsModule } from "../students/students.module";
import { UsersModule } from "../users/users.module";
import { OrderCommunicationService } from "./order-communication.service";
import { OrderWorkflowService } from "./order-workflow.service";
import { OrderReportsService } from "./order-reports.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditLogModule,
    MarketingAttributionModule,
    InvoicesModule,
    StudentsModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, EnrollmentService, OrderCommunicationService, OrderWorkflowService, OrderReportsService],
  exports: [OrdersService, EnrollmentService, OrderCommunicationService],
})
export class OrdersModule {}
