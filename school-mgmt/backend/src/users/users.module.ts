import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { MarketingAttributionModule } from '../marketing-attribution/marketing-attribution.module';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Student.name, schema: StudentSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
    ]),
    MarketingAttributionModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
