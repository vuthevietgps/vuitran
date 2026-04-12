import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import {
  WorkSession,
  WorkSessionDocument,
  WorkSessionStatus,
} from './schemas/work-session.schema';

@Injectable()
export class WorkSessionsService {
  private readonly logger = new Logger(WorkSessionsService.name);

  constructor(
    @InjectModel(WorkSession.name) private workSessionModel: Model<WorkSessionDocument>,
  ) {}

  // ══════════════════════════════════════════════════════════════════
  //  LOGIN / LOGOUT
  // ══════════════════════════════════════════════════════════════════

  /**
   * Ghi nhận đăng nhập: tạo WorkSession mới.
   * Nếu có session ACTIVE cũ chưa logout → auto-close.
   * @param scheduledStartTime — giờ vào ca (VD: "08:00") để tính muộn
   * @param scheduledEndTime — giờ kết thúc ca (VD: "17:00") để tính về sớm
   */
  async recordLogin(
    userId: string,
    scheduledStartTime?: string,
    scheduledEndTime?: string,
  ): Promise<WorkSessionDocument> {
    const now = new Date();

    // Auto-close any active session for this user
    await this.autoCloseActiveSessions(userId, now);

    // Tính date (chỉ ngày, 00:00:00 UTC)
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Tính đến muộn
    let isLate = false;
    let lateMinutes = 0;
    if (scheduledStartTime) {
      const [hh, mm] = scheduledStartTime.split(':').map(Number);
      const scheduledTime = new Date(date);
      scheduledTime.setHours(hh, mm, 0, 0);

      if (now > scheduledTime) {
        isLate = true;
        lateMinutes = Math.floor((now.getTime() - scheduledTime.getTime()) / 60000);
      }
    }

    const session = await this.workSessionModel.create({
      userId: new Types.ObjectId(userId),
      date,
      loginTime: now,
      scheduledStartTime,
      scheduledEndTime,
      isLate,
      lateMinutes,
      isEarlyLeave: false,
      earlyLeaveMinutes: 0,
      status: WorkSessionStatus.ACTIVE,
    });

    this.logger.log(
      `Work session started: user=${userId} | late=${isLate} (${lateMinutes}min)`,
    );
    return session;
  }

  /**
   * Ghi nhận đăng xuất: cập nhật logoutTime + totalMinutes.
   */
  async recordLogout(userId: string): Promise<WorkSessionDocument | null> {
    const activeSession = await this.workSessionModel.findOne({
      userId: new Types.ObjectId(userId),
      status: WorkSessionStatus.ACTIVE,
    }).sort({ loginTime: -1 });

    if (!activeSession) {
      this.logger.warn(`No active work session found for user=${userId} on logout`);
      return null;
    }

    const now = new Date();
    activeSession.logoutTime = now;
    activeSession.totalMinutes = Math.floor(
      (now.getTime() - activeSession.loginTime.getTime()) / 60000,
    );
    this.applyTimingFlags(activeSession);
    activeSession.status = WorkSessionStatus.COMPLETED;
    await activeSession.save();

    this.logger.log(
      `Work session ended: user=${userId} | ${activeSession.totalMinutes}min`,
    );
    return activeSession;
  }

  /**
   * Auto-close active sessions (khi user login lại mà chưa logout cũ).
   */
  private async autoCloseActiveSessions(userId: string, now: Date): Promise<void> {
    const activeSessions = await this.workSessionModel.find({
      userId: new Types.ObjectId(userId),
      status: WorkSessionStatus.ACTIVE,
    });

    for (const session of activeSessions) {
      session.logoutTime = now;
      session.totalMinutes = Math.floor(
        (now.getTime() - session.loginTime.getTime()) / 60000,
      );
      this.applyTimingFlags(session);
      session.status = WorkSessionStatus.AUTO_CLOSED;
      await session.save();
    }

    if (activeSessions.length > 0) {
      this.logger.warn(
        `Auto-closed ${activeSessions.length} active session(s) for user=${userId}`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  async findAll(query: {
    userId?: string;
    fromDate?: string;
    toDate?: string;
    status?: WorkSessionStatus;
    page?: number;
    limit?: number;
  }) {
    const filter: FilterQuery<WorkSession> = {};

    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.status) filter.status = query.status;
    if (query.fromDate || query.toDate) {
      filter.date = {};
      if (query.fromDate) filter.date.$gte = new Date(query.fromDate);
      if (query.toDate) filter.date.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.workSessionModel
        .find(filter)
        .sort({ date: -1, loginTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email role')
        .lean(),
      this.workSessionModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Tổng hợp giờ làm + số lần muộn cho 1 user trong 1 kỳ.
   */
  async getSummary(userId: string, periodStart: Date, periodEnd: Date) {
    const sessions = await this.workSessionModel.find({
      userId: new Types.ObjectId(userId),
      date: { $gte: periodStart, $lte: periodEnd },
      status: { $in: [WorkSessionStatus.COMPLETED, WorkSessionStatus.AUTO_CLOSED] },
    }).lean();

    const totalMinutes = sessions.reduce((acc, s) => acc + (s.totalMinutes || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
    const lateDays = sessions.filter((s) => s.isLate).length;
    const totalLateMinutes = sessions.reduce((acc, s) => acc + (s.lateMinutes || 0), 0);
    const earlyLeaveDays = sessions.filter((s) => s.isEarlyLeave).length;
    const totalEarlyLeaveMinutes = sessions.reduce((acc, s) => acc + (s.earlyLeaveMinutes || 0), 0);
    const totalSessions = sessions.length;

    return {
      userId,
      periodStart,
      periodEnd,
      totalSessions,
      totalMinutes,
      totalHours,
      lateDays,
      totalLateMinutes,
      earlyLeaveDays,
      totalEarlyLeaveMinutes,
    };
  }

  /**
   * Tổng hợp giờ làm tháng cho tất cả nhân viên.
   */
  async getMonthlySummary(periodStart: Date, periodEnd: Date) {
    return this.workSessionModel.aggregate([
      {
        $match: {
          date: { $gte: periodStart, $lte: periodEnd },
          status: { $in: [WorkSessionStatus.COMPLETED, WorkSessionStatus.AUTO_CLOSED] },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalMinutes: { $sum: '$totalMinutes' },
          totalSessions: { $sum: 1 },
          lateDays: { $sum: { $cond: ['$isLate', 1, 0] } },
          totalLateMinutes: { $sum: '$lateMinutes' },
          earlyLeaveDays: { $sum: { $cond: ['$isEarlyLeave', 1, 0] } },
          totalEarlyLeaveMinutes: { $sum: '$earlyLeaveMinutes' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          fullName: '$user.fullName',
          email: '$user.email',
          role: '$user.role',
          totalMinutes: 1,
          totalHours: { $round: [{ $divide: ['$totalMinutes', 60] }, 2] },
          totalSessions: 1,
          lateDays: 1,
          totalLateMinutes: 1,
          earlyLeaveDays: 1,
          totalEarlyLeaveMinutes: 1,
        },
      },
      { $sort: { fullName: 1 } },
    ]);
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE (OPS/DIRECTOR chỉnh sửa thủ công)
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: {
    loginTime?: string;
    logoutTime?: string;
    notes?: string;
  }): Promise<WorkSessionDocument> {
    const session = await this.workSessionModel.findById(id);
    if (!session) throw new NotFoundException('Phiên làm việc không tồn tại');

    if (dto.loginTime) session.loginTime = new Date(dto.loginTime);
    if (dto.logoutTime) {
      session.logoutTime = new Date(dto.logoutTime);
      session.totalMinutes = Math.floor(
        (session.logoutTime.getTime() - session.loginTime.getTime()) / 60000,
      );
      if (session.status === WorkSessionStatus.ACTIVE) {
        session.status = WorkSessionStatus.COMPLETED;
      }
    }
    if (dto.notes !== undefined) session.notes = dto.notes;
    this.applyTimingFlags(session);

    return session.save();
  }

  private applyTimingFlags(
    session: Pick<
      WorkSession,
      | 'date'
      | 'loginTime'
      | 'logoutTime'
      | 'scheduledStartTime'
      | 'scheduledEndTime'
      | 'isLate'
      | 'lateMinutes'
      | 'isEarlyLeave'
      | 'earlyLeaveMinutes'
    >,
  ): void {
    const scheduledStart = this.resolveScheduledTime(session.date, session.scheduledStartTime);
    const scheduledEnd = this.resolveScheduledTime(session.date, session.scheduledEndTime);

    session.isLate = false;
    session.lateMinutes = 0;
    session.isEarlyLeave = false;
    session.earlyLeaveMinutes = 0;

    if (scheduledStart && session.loginTime && session.loginTime.getTime() > scheduledStart.getTime()) {
      session.isLate = true;
      session.lateMinutes = Math.floor(
        (session.loginTime.getTime() - scheduledStart.getTime()) / 60000,
      );
    }

    if (scheduledEnd && session.logoutTime && session.logoutTime.getTime() < scheduledEnd.getTime()) {
      session.isEarlyLeave = true;
      session.earlyLeaveMinutes = Math.floor(
        (scheduledEnd.getTime() - session.logoutTime.getTime()) / 60000,
      );
    }
  }

  private resolveScheduledTime(date: Date, hhmm?: string): Date | null {
    if (!hhmm) return null;
    const [hours, minutes] = hhmm.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const scheduled = new Date(date);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled;
  }
}
