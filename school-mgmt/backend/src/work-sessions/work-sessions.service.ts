import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { QueryWorkSessionsDto } from './dto/query-work-sessions.dto';
import {
  WorkSession,
  WorkSessionDocument,
  WorkSessionStatus,
} from './schemas/work-session.schema';

type WorkSessionListSummary = {
  totalSessions: number;
  activeSessions: number;
  totalMinutes: number;
  lateSessions: number;
};

@Injectable()
export class WorkSessionsService {
  private readonly logger = new Logger(WorkSessionsService.name);

  constructor(
    @InjectModel(WorkSession.name)
    private readonly workSessionModel: Model<WorkSessionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async recordLogin(
    userId: string,
    scheduledStartTime?: string,
    scheduledEndTime?: string,
  ): Promise<WorkSessionDocument> {
    const now = new Date();

    await this.autoCloseActiveSessions(userId, now);

    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let isLate = false;
    let lateMinutes = 0;
    if (scheduledStartTime) {
      const [hh, mm] = scheduledStartTime.split(':').map(Number);
      const scheduledTime = new Date(date);
      scheduledTime.setHours(hh, mm, 0, 0);

      if (now > scheduledTime) {
        isLate = true;
        lateMinutes = Math.floor(
          (now.getTime() - scheduledTime.getTime()) / 60000,
        );
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

  async recordLogout(userId: string): Promise<WorkSessionDocument | null> {
    const activeSession = await this.workSessionModel
      .findOne({
        userId: new Types.ObjectId(userId),
        status: WorkSessionStatus.ACTIVE,
      })
      .sort({ loginTime: -1 });

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

  private async autoCloseActiveSessions(
    userId: string,
    now: Date,
  ): Promise<void> {
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

  async findAll(query: QueryWorkSessionsDto) {
    const page = this.normalizePage(query.page);
    const limit = this.normalizeLimit(query.limit);
    const skip = (page - 1) * limit;

    const { filter, noResults } = await this.buildListFilter(query);
    if (noResults) {
      return {
        data: [],
        meta: { total: 0, page, limit, totalPages: 1 },
        summary: this.emptySummary(),
      };
    }

    const [data, total, summaryRows] = await Promise.all([
      this.workSessionModel
        .find(filter)
        .select(
          'userId date loginTime logoutTime totalMinutes isLate lateMinutes ' +
            'isEarlyLeave earlyLeaveMinutes status scheduledStartTime scheduledEndTime notes',
        )
        .sort({ date: -1, loginTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email role')
        .lean(),
      this.workSessionModel.countDocuments(filter),
      this.workSessionModel.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: {
                $cond: [
                  { $eq: ['$status', WorkSessionStatus.ACTIVE] },
                  1,
                  0,
                ],
              },
            },
            totalMinutes: { $sum: { $ifNull: ['$totalMinutes', 0] } },
            lateSessions: {
              $sum: {
                $cond: ['$isLate', 1, 0],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            activeSessions: 1,
            totalMinutes: 1,
            lateSessions: 1,
          },
        },
      ]),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: summaryRows[0] ?? this.emptySummary(),
    };
  }

  async getSummary(userId: string, periodStart: Date, periodEnd: Date) {
    const sessions = await this.workSessionModel
      .find({
        userId: new Types.ObjectId(userId),
        date: { $gte: periodStart, $lte: periodEnd },
        status: {
          $in: [WorkSessionStatus.COMPLETED, WorkSessionStatus.AUTO_CLOSED],
        },
      })
      .lean();

    const totalMinutes = sessions.reduce(
      (acc, session) => acc + (session.totalMinutes || 0),
      0,
    );
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
    const lateDays = sessions.filter((session) => session.isLate).length;
    const totalLateMinutes = sessions.reduce(
      (acc, session) => acc + (session.lateMinutes || 0),
      0,
    );
    const earlyLeaveDays = sessions.filter(
      (session) => session.isEarlyLeave,
    ).length;
    const totalEarlyLeaveMinutes = sessions.reduce(
      (acc, session) => acc + (session.earlyLeaveMinutes || 0),
      0,
    );
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

  async getMonthlySummary(periodStart: Date, periodEnd: Date) {
    return this.workSessionModel.aggregate([
      {
        $match: {
          date: { $gte: periodStart, $lte: periodEnd },
          status: {
            $in: [WorkSessionStatus.COMPLETED, WorkSessionStatus.AUTO_CLOSED],
          },
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

  async update(
    id: string,
    dto: { loginTime?: string; logoutTime?: string; notes?: string },
  ): Promise<WorkSessionDocument> {
    const session = await this.workSessionModel.findById(id);
    if (!session) {
      throw new NotFoundException('Phien lam viec khong ton tai');
    }

    if (dto.loginTime) {
      session.loginTime = new Date(dto.loginTime);
    }
    if (dto.logoutTime) {
      session.logoutTime = new Date(dto.logoutTime);
      session.totalMinutes = Math.floor(
        (session.logoutTime.getTime() - session.loginTime.getTime()) / 60000,
      );
      if (session.status === WorkSessionStatus.ACTIVE) {
        session.status = WorkSessionStatus.COMPLETED;
      }
    }
    if (dto.notes !== undefined) {
      session.notes = dto.notes;
    }
    this.applyTimingFlags(session);

    return session.save();
  }

  private async buildListFilter(query: QueryWorkSessionsDto): Promise<{
    filter: FilterQuery<WorkSession>;
    noResults: boolean;
  }> {
    const filter: FilterQuery<WorkSession> = {};

    const requestedUserId = query.userId
      ? new Types.ObjectId(query.userId)
      : null;
    const matchedSearchUserIds = query.search
      ? await this.resolveSearchUserIds(query.search)
      : null;

    if (requestedUserId && matchedSearchUserIds) {
      const requestedUserIdText = requestedUserId.toHexString();
      const hasMatch = matchedSearchUserIds.some(
        (userId) => userId.toHexString() === requestedUserIdText,
      );
      if (!hasMatch) {
        return { filter, noResults: true };
      }
      filter.userId = requestedUserId;
    } else if (requestedUserId) {
      filter.userId = requestedUserId;
    } else if (matchedSearchUserIds) {
      if (matchedSearchUserIds.length === 0) {
        return { filter, noResults: true };
      }
      filter.userId = { $in: matchedSearchUserIds };
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.fromDate || query.toDate) {
      filter.date = {};
      if (query.fromDate) {
        filter.date.$gte = this.parseDate(query.fromDate, false);
      }
      if (query.toDate) {
        filter.date.$lte = this.parseDate(query.toDate, true);
      }
    }

    return { filter, noResults: false };
  }

  private async resolveSearchUserIds(search: string): Promise<Types.ObjectId[]> {
    const keyword = search.trim();
    if (!keyword) {
      return [];
    }

    const regex = new RegExp(this.escapeRegex(keyword), 'i');
    const users = await this.userModel
      .find({
        $or: [
          { fullName: regex },
          { email: regex },
          { phone: regex },
        ],
      })
      .select('_id')
      .limit(500)
      .lean();

    return users.map((user) => new Types.ObjectId(user._id));
  }

  private normalizePage(page?: number): number {
    return Number.isFinite(page) && Number(page) > 0 ? Number(page) : 1;
  }

  private normalizeLimit(limit?: number): number {
    const normalized = Number.isFinite(limit) ? Number(limit) : 25;
    if (normalized < 1) {
      return 25;
    }
    return Math.min(normalized, 200);
  }

  private parseDate(value: string, endOfDay: boolean): Date {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException('Ngay loc khong hop le');
    }

    return endOfDay
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private emptySummary(): WorkSessionListSummary {
    return {
      totalSessions: 0,
      activeSessions: 0,
      totalMinutes: 0,
      lateSessions: 0,
    };
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
    const scheduledStart = this.resolveScheduledTime(
      session.date,
      session.scheduledStartTime,
    );
    const scheduledEnd = this.resolveScheduledTime(
      session.date,
      session.scheduledEndTime,
    );

    session.isLate = false;
    session.lateMinutes = 0;
    session.isEarlyLeave = false;
    session.earlyLeaveMinutes = 0;

    if (
      scheduledStart &&
      session.loginTime &&
      session.loginTime.getTime() > scheduledStart.getTime()
    ) {
      session.isLate = true;
      session.lateMinutes = Math.floor(
        (session.loginTime.getTime() - scheduledStart.getTime()) / 60000,
      );
    }

    if (
      scheduledEnd &&
      session.logoutTime &&
      session.logoutTime.getTime() < scheduledEnd.getTime()
    ) {
      session.isEarlyLeave = true;
      session.earlyLeaveMinutes = Math.floor(
        (scheduledEnd.getTime() - session.logoutTime.getTime()) / 60000,
      );
    }
  }

  private resolveScheduledTime(date: Date, hhmm?: string): Date | null {
    if (!hhmm) {
      return null;
    }
    const [hours, minutes] = hhmm.split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }
    const scheduled = new Date(date);
    scheduled.setHours(hours, minutes, 0, 0);
    return scheduled;
  }
}
