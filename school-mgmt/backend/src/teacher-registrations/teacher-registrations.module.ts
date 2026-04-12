import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { TeacherRegistration, TeacherRegistrationSchema } from './schemas/teacher-registration.schema';
import {
  PublicTeacherRegistrationsController,
  TeacherRegistrationsController,
} from './teacher-registrations.controller';
import { TeacherRegistrationsService } from './teacher-registrations.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TeacherRegistration.name, schema: TeacherRegistrationSchema },
      { name: User.name, schema: UserSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
    ]),
    UsersModule,
  ],
  controllers: [
    TeacherRegistrationsController,
    PublicTeacherRegistrationsController,
  ],
  providers: [TeacherRegistrationsService],
  exports: [TeacherRegistrationsService],
})
export class TeacherRegistrationsModule {}
