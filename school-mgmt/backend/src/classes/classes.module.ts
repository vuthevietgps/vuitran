import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';
import { Classroom, ClassroomSchema } from './schemas/class.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { UsersModule } from '../users/users.module';
import { StudentsModule } from '../students/students.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
    ]),
    UsersModule,
    StudentsModule,
    forwardRef(() => MessagesModule),
  ],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService, MongooseModule],
})
export class ClassesModule {}
