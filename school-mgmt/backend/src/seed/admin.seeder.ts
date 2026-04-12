import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminSeeder implements OnModuleInit {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private config: ConfigService,
  ) {}

  async onModuleInit() {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      this.logger.warn('Demo account seeding disabled in production environment');
      return;
    }

    this.logger.log('Creating demo accounts for development...');

    const demoPassword = this.config.get<string>('DEMO_PASSWORD');
    if (!demoPassword || demoPassword === '123456') {
      this.logger.error('DEMO_PASSWORD not set or using default. Skipping demo accounts.');
      return;
    }

    const syncExisting = (this.config.get<string>('DEMO_SYNC_EXISTING', 'true') || 'true')
      .toLowerCase() !== 'false';

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(demoPassword, salt);

    const demoUsers: Array<Pick<User, 'email' | 'fullName' | 'role' | 'userCode'>> = [
      { email: 'director.demo@school.local', fullName: 'Giam doc Demo', role: Role.DIRECTOR, userCode: 'GD_DEMO' },
      { email: 'accounting.demo@school.local', fullName: 'Ke toan Demo', role: Role.ACCOUNTING, userCode: 'KT_DEMO' },
      { email: 'ops.demo@school.local', fullName: 'Van hanh Demo', role: Role.OPS, userCode: 'OPS_DEMO' },
      { email: 'sale.demo@school.local', fullName: 'Sale Demo', role: Role.SALE, userCode: 'SALE_DEMO' },
      { email: 'ads.demo@school.local', fullName: 'Ads Manager Demo', role: Role.ADSMANAGER, userCode: 'ADS_DEMO' },
      { email: 'shareholder.demo@school.local', fullName: 'Shareholder Demo', role: Role.SHAREHOLDER, userCode: 'SH_DEMO' },
      { email: 'teacher.demo@school.local', fullName: 'Giao vien Demo', role: Role.TEACHER, userCode: 'GV_DEMO' },
      { email: 'parent.demo@school.local', fullName: 'Phu huynh Demo', role: Role.PARENT, userCode: 'PH_DEMO' },
    ];

    for (const demo of demoUsers) {
      const existing = await this.userModel.findOne({
        $or: [
          { email: demo.email },
          { userCode: demo.userCode },
        ],
      }).exec();
      if (existing) {
        if (!syncExisting) {
          this.logger.log(`Demo account already exists: ${demo.email}`);
          continue;
        }

        const passwordMatches = existing.password
          ? await bcrypt.compare(demoPassword, existing.password)
          : false;

        const needsProfileSync =
          existing.email !== demo.email ||
          existing.fullName !== demo.fullName ||
          existing.userCode !== demo.userCode ||
          existing.role !== demo.role ||
          existing.status !== 'ACTIVE' ||
          (existing.failedLoginAttempts || 0) !== 0 ||
          !!existing.lastFailedLoginAt;

        const needsPasswordSync = !passwordMatches;

        if (!needsProfileSync && !needsPasswordSync) {
          this.logger.log(`Demo account already up-to-date: ${demo.email}`);
          continue;
        }

        await this.userModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              email: demo.email,
              fullName: demo.fullName,
              userCode: demo.userCode,
              role: demo.role,
              status: 'ACTIVE',
              failedLoginAttempts: 0,
              ...(needsPasswordSync ? { password: hashedPassword } : {}),
            },
            $unset: { lastFailedLoginAt: 1 },
          },
        );

        this.logger.log(`Synced demo account: ${demo.email}${needsPasswordSync ? ' (password reset)' : ''}`);
        continue;
      }

      await this.userModel.create({ ...demo, password: hashedPassword });
      this.logger.log(`Seeded demo account: ${demo.email} (${demo.role})`);
    }
  }
}
