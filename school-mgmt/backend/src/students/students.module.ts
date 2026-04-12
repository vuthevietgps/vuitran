import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudentsService } from './students.service';
import { StudentOrderService } from './student-order.service';
import { StudentReportService } from './student-report.service';
import { StudentsController } from './students.controller';
import { Student, StudentSchema } from './schemas/student.schema';
import { Attendance, AttendanceSchema } from '../attendance/schemas/attendance.schema';
import { Classroom, ClassroomSchema } from '../classes/schemas/class.schema';
import { Session, SessionSchema } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Student.name, schema: StudentSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Classroom.name, schema: ClassroomSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [StudentsController],
  providers: [StudentsService, StudentOrderService, StudentReportService],
  exports: [StudentsService, MongooseModule],
})
export class StudentsModule {}
