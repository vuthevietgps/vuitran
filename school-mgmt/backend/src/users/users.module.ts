import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersParentOrderService } from './users-parent-order.service';
import { UsersAdsService } from './users-ads.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { MarketingAttributionModule } from '../marketing-attribution/marketing-attribution.module';
import { AdGroup, AdGroupSchema } from '../ads/schemas/ad-group.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { TeacherProfile, TeacherProfileSchema } from '../teachers/schemas/teacher-profile.schema';
import { SalaryConfigModule } from '../salary-config/salary-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Student.name, schema: StudentSchema },
      { name: TeacherProfile.name, schema: TeacherProfileSchema },
    ]),
    MarketingAttributionModule,
    SalaryConfigModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersParentOrderService, UsersAdsService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
