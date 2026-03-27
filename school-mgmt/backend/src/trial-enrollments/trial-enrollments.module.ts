import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TrialEnrollment,
  TrialEnrollmentSchema,
} from './schemas/trial-enrollment.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { TrialEnrollmentsController } from './trial-enrollments.controller';
import { TrialEnrollmentsService } from './trial-enrollments.service';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TrialEnrollment.name, schema: TrialEnrollmentSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SessionsModule,
  ],
  controllers: [TrialEnrollmentsController],
  providers: [TrialEnrollmentsService],
  exports: [TrialEnrollmentsService, MongooseModule],
})
export class TrialEnrollmentsModule {}
