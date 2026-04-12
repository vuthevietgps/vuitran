import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';
import { SalaryConfigService } from '../salary-config/salary-config.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 phút tự mở khóa

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly workSessionsService: WorkSessionsService,
    private readonly salaryConfigService: SalaryConfigService,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    if (!user.password) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');

    // Auto-unlock sau LOCKOUT_DURATION_MS
    if (user.status === 'LOCKED') {
      const lockedAt = user.lastFailedLoginAt;
      const now = Date.now();
      if (lockedAt && (now - new Date(lockedAt).getTime()) >= LOCKOUT_DURATION_MS) {
        await this.userModel.updateOne(
          { _id: user._id },
          { $set: { status: 'ACTIVE', failedLoginAttempts: 0 }, $unset: { lastFailedLoginAt: 1 } },
        );
      } else {
        const remainingMs = lockedAt
          ? LOCKOUT_DURATION_MS - (now - new Date(lockedAt).getTime())
          : LOCKOUT_DURATION_MS;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        throw new UnauthorizedException(
          `Tài khoản đã bị khóa. Vui lòng thử lại sau ${remainingMinutes} phút.`,
        );
      }
    }

    const match = await bcrypt.compare(pass, user.password);
    if (!match) {
      // Track failed attempts atomically
      const updateOps: any = {
        $inc: { failedLoginAttempts: 1 },
        $set: { lastFailedLoginAt: new Date() },
      };
      const updated = await this.userModel.findOneAndUpdate(
        { _id: user._id },
        updateOps,
        { new: true },
      );
      // Auto-lock after MAX_FAILED_ATTEMPTS
      if (updated && updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.userModel.updateOne({ _id: user._id }, { $set: { status: 'LOCKED' } });
      }
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0 }, $unset: { lastFailedLoginAt: 1 } },
      );
    }

    const { password, failedLoginAttempts, lastFailedLoginAt, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      userCode: user.userCode,
    };

    // Ghi nhận chấm công đăng nhập (không block login nếu lỗi)
    try {
      const config = await this.salaryConfigService.findByUserId(user._id.toString()).catch(() => null);
      const scheduledStartTime = config ? (config.scheduledStartTime || '08:00') : undefined;
      const scheduledEndTime = config ? (config.scheduledEndTime || '17:00') : undefined;
      await this.workSessionsService.recordLogin(
        user._id.toString(),
        scheduledStartTime,
        scheduledEndTime,
      );
    } catch (err) {
      // Log but don't block login
    }

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const userDoc = await this.userModel.findById(userId);
    if (!userDoc) throw new UnauthorizedException('Người dùng không tồn tại');

    const match = await bcrypt.compare(oldPassword, userDoc.password);
    if (!match) throw new UnauthorizedException('Mật khẩu cũ không đúng');

    const salt = await bcrypt.genSalt(10);
    userDoc.password = await bcrypt.hash(newPassword, salt);
    await userDoc.save();

    return { message: 'Đổi mật khẩu thành công' };
  }
}
