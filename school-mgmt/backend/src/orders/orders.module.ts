import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { EnrollmentService } from './enrollment.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Lead, LeadSchema } from '../leads/schemas/lead.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MarketingAttributionModule } from '../marketing-attribution/marketing-attribution.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { OrderCommunicationService } from './order-communication.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditLogModule,
    MarketingAttributionModule,
    InvoicesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, EnrollmentService, OrderCommunicationService],
  exports: [OrdersService, EnrollmentService, OrderCommunicationService],
})
export class OrdersModule {}
