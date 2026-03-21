import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { TeacherProfile, TeacherProfileDocument, TeacherStatus } from './schemas/teacher-profile.schema';
import { CreateTeacherProfileDto } from './dto/create-teacher-profile.dto';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Payroll, PayrollDocument } from '../payroll/schemas/payroll.schema';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class TeachersService {
  private static readonly SALE_VISIBLE_STATUSES: readonly TeacherStatus[] = [
    TeacherStatus.APPROVED,
    TeacherStatus.ACTIVE,
  ];

  private static readonly TEACHER_SELF_EDITABLE_FIELDS = [
    'subjects',
    'grades',
    'teachingMode',
    'locations',
    'bio',
    'qualifications',
    'yearsOfExperience',
    'videoIntroUrl',
    'availability',
    'pricePerSession',
    'pricePerHour',
    'bankInfo',
  ] as const;

  private static readonly SALE_EDITABLE_FIELDS = [
    'subjects',
    'grades',
    'teachingMode',
    'locations',
    'bio',
    'qualifications',
    'yearsOfExperience',
    'videoIntroUrl',
    'availability',
    'pricePerSession',
    'pricePerHour',
    'user',
  ] as const;

  private static readonly ACCOUNTING_EDITABLE_FIELDS = [
    'subjects',
    'grades',
    'teachingMode',
    'locations',
    'bio',
    'qualifications',
    'yearsOfExperience',
    'videoIntroUrl',
    'availability',
    'pricePerSession',
    'pricePerHour',
    'bankInfo',
    'user',
  ] as const;

  constructor(
    @InjectModel(TeacherProfile.name) private readonly teacherProfileModel: Model<TeacherProfileDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Payroll.name) private readonly payrollModel: Model<PayrollDocument>,
  ) {}

  private getActorId(actor?: JwtPayload): string | null {
    return actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
  }

  private getProfileUserId(profile: any): string | null {
    return (
      profile?.userId?._id?.toString?.()
      || profile?.userId?.toString?.()
      || null
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeOptionalText(value?: string | null): string | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = value.trim();
    return normalized || undefined;
  }

  private async ensureUserEmailUnique(email: string, excludeUserId?: string): Promise<void> {
    const query: any = { email };
    if (excludeUserId) {
      query._id = { $ne: new Types.ObjectId(excludeUserId) };
    }
    const existing = await this.userModel.findOne(query).select('_id').lean();
    if (existing) {
      throw new ConflictException('Email da ton tai');
    }
  }

  private async resolveManagedSales(saleIds?: string[]): Promise<Types.ObjectId[]> {
    if (!saleIds?.length) {
      return [];
    }

    const uniqueSaleIds = Array.from(new Set(saleIds.filter(Boolean)));
    const validSaleIds = uniqueSaleIds.filter((id) => Types.ObjectId.isValid(id));
    if (validSaleIds.length !== uniqueSaleIds.length) {
      throw new BadRequestException('Danh sach sale quan ly khong hop le');
    }

    const saleUsers = await this.userModel
      .find({
        _id: { $in: validSaleIds.map((id) => new Types.ObjectId(id)) },
        role: Role.SALE,
      })
      .select('_id')
      .lean();

    if (saleUsers.length !== validSaleIds.length) {
      throw new BadRequestException('Co sale quan ly khong ton tai hoac sai vai tro');
    }

    return validSaleIds.map((id) => new Types.ObjectId(id));
  }

  private async getVisibleTeacherUserIdsForSale(saleId: string): Promise<Types.ObjectId[]> {
    const saleObjectId = new Types.ObjectId(saleId);
    const [managedTeacherIds, classTeacherIds] = await Promise.all([
      this.teacherProfileModel.distinct('userId', { managedSales: saleObjectId }),
      this.classModel.distinct('teacher', { sale: saleObjectId }),
    ]);

    const mergedIds = Array.from(
      new Set(
        [...managedTeacherIds, ...classTeacherIds]
          .map((value: any) => value?.toString?.())
          .filter((value: string | undefined): value is string => !!value),
      ),
    );

    return mergedIds.map((id) => new Types.ObjectId(id));
  }

  private async assertSaleCanAccessProfile(profile: any, actor: JwtPayload): Promise<void> {
    const actorId = this.getActorId(actor);
    const teacherUserId = this.getProfileUserId(profile);
    if (!actorId || !teacherUserId) {
      throw new NotFoundException('Ho so giao vien khong ton tai');
    }

    const visibleTeacherIds = await this.getVisibleTeacherUserIdsForSale(actorId);
    const visibleSet = new Set(visibleTeacherIds.map((id) => id.toString()));
    if (!visibleSet.has(teacherUserId)) {
      throw new NotFoundException('Ho so giao vien khong ton tai');
    }
  }

  private async updateTeacherUserInfo(
    userId: string,
    payload?: { fullName?: string; email?: string; phone?: string; password?: string },
  ): Promise<void> {
    if (!payload) {
      return;
    }

    const update: any = {};
    const unset: Record<string, 1> = {};

    if (payload.fullName !== undefined) {
      update.fullName = payload.fullName.trim();
    }

    if (payload.email !== undefined) {
      const email = this.normalizeEmail(payload.email);
      await this.ensureUserEmailUnique(email, userId);
      update.email = email;
    }

    if (payload.phone !== undefined) {
      const phone = this.normalizeOptionalText(payload.phone);
      if (phone) {
        update.phone = phone;
      } else {
        unset.phone = 1;
      }
    }

    if (payload.password !== undefined) {
      const password = payload.password.trim();
      if (!password) {
        throw new BadRequestException('Mat khau khong duoc de trong');
      }
      update.password = await bcrypt.hash(password, 10);
    }

    if (!Object.keys(update).length && !Object.keys(unset).length) {
      return;
    }

    if (Object.keys(unset).length) {
      update.$unset = unset;
    }

    await this.userModel.findByIdAndUpdate(userId, update);
  }

  private sanitizeTeacherClassForSale(classroom: any): any {
    const sanitized = {
      ...classroom,
      students: Array.isArray(classroom?.students)
        ? classroom.students.map((student: any) => ({
            _id: student?._id,
            fullName: student?.fullName,
            studentCode: student?.studentCode,
          }))
        : classroom?.students,
    };

    delete sanitized.teacherPayPerSession;
    delete sanitized.teacherPayPerStudent;
    delete sanitized.pricingSnapshot;

    return sanitized;
  }

  private sanitizeTeacherFullProfileForSale(payload: any): any {
    return {
      profile: this.sanitizeTeacherProfile(payload.profile, { role: Role.SALE } as JwtPayload),
      classes: {
        ...payload.classes,
        active: (payload.classes?.active || []).map((classroom: any) =>
          this.sanitizeTeacherClassForSale(classroom),
        ),
        completed: (payload.classes?.completed || []).map((classroom: any) =>
          this.sanitizeTeacherClassForSale(classroom),
        ),
      },
      sessions: {
        ...payload.sessions,
        byStatus: Object.fromEntries(
          Object.entries(payload.sessions?.byStatus || {}).map(([status, item]: [string, any]) => [
            status,
            {
              count: item?.count || 0,
              totalPayout: 0,
            },
          ]),
        ),
        recent: (payload.sessions?.recent || []).map((session: any) => ({
          ...session,
          teacherPayout: 0,
        })),
      },
      payroll: {
        byStatus: {},
        totalPaid: 0,
      },
    };
  }

  async create(dto: CreateTeacherProfileDto, actor: JwtPayload): Promise<TeacherProfile> {
    // Check if user exists and has TEACHER role
    const user = await this.userModel.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y tÃ i khoáº£n');
    }
    if (user.role !== Role.TEACHER) {
      throw new BadRequestException('TÃ i khoáº£n pháº£i cÃ³ vai trÃ² TEACHER');
    }

    // Check if profile already exists
    const existing = await this.teacherProfileModel.findOne({ userId: dto.userId });
    if (existing) {
      throw new ConflictException('Há»“ sÆ¡ giÃ¡o viÃªn Ä‘Ã£ tá»“n táº¡i cho tÃ i khoáº£n nÃ y');
    }

    const managedSales =
      actor.role === Role.DIRECTOR
        ? await this.resolveManagedSales(dto.managedSales)
        : [];

    if (dto.user?.password !== undefined && actor.role !== Role.DIRECTOR) {
      throw new ForbiddenException('Chi director moi duoc doi mat khau giao vien');
    }

    if (dto.user) {
      await this.updateTeacherUserInfo(dto.userId, dto.user);
    }

    const { user: _user, managedSales: _managedSales, ...profileData } = dto as any;
    const profile = new this.teacherProfileModel({
      ...profileData,
      userId: new Types.ObjectId(dto.userId),
      managedSales,
    });
    return profile.save();
  }

  async findAll(
    filters?: { status?: TeacherStatus; subjects?: string[]; grades?: string[] },
    actor?: JwtPayload,
  ): Promise<any[]> {
    const query: any = {};
    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (!actorId) {
        return [];
      }
      if (
        filters?.status &&
        !TeachersService.SALE_VISIBLE_STATUSES.includes(filters.status)
      ) {
        return [];
      }
      const visibleTeacherIds = await this.getVisibleTeacherUserIdsForSale(actorId);
      if (!visibleTeacherIds.length) {
        return [];
      }
      query.userId = { $in: visibleTeacherIds };
      query.status = filters?.status ?? { $in: TeachersService.SALE_VISIBLE_STATUSES };
    } else if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.subjects?.length) {
      query.subjects = { $in: filters.subjects };
    }
    if (filters?.grades?.length) {
      query.grades = { $in: filters.grades };
    }

    const profiles = await this.teacherProfileModel
      .find(query)
      .populate('userId', 'userCode fullName email phone')
      .populate('managedSales', 'userCode fullName email')
      .populate('approvedBy', 'fullName')
      .sort({ rating: -1, createdAt: -1 })
      .lean();

    return profiles.map((profile) => this.sanitizeTeacherProfile(profile, actor));
  }

  async findOne(id: string, actor?: JwtPayload): Promise<any> {
    const profile = await this.teacherProfileModel
      .findById(id)
      .populate('userId', 'userCode fullName email phone')
      .populate('managedSales', 'userCode fullName email')
      .populate('approvedBy', 'fullName')
      .lean();
    if (!profile) {
      throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
    }
    // TEACHER can only view their own profile; staff roles can view any
    if (actor?.role === Role.TEACHER) {
      if ((profile as any).userId?._id?.toString() !== actor.sub &&
          (profile as any).userId?.toString() !== actor.sub) {
        throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
      }
    }
    if (
      actor?.role === Role.SALE &&
      !TeachersService.SALE_VISIBLE_STATUSES.includes((profile as any).status)
    ) {
      throw new NotFoundException('HÃ¡Â»â€œ sÃ†Â¡ giÃƒÂ¡o viÃƒÂªn khÃƒÂ´ng tÃ¡Â»â€œn tÃ¡ÂºÂ¡i');
    }
    if (actor?.role === Role.SALE) {
      await this.assertSaleCanAccessProfile(profile, actor);
    }
    return this.sanitizeTeacherProfile(profile, actor);
  }

  async findByUserId(userId: string): Promise<TeacherProfile | null> {
    return this.teacherProfileModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .populate('userId', 'userCode fullName email phone')
      .populate('managedSales', 'userCode fullName email')
      .lean();
  }

  async update(id: string, dto: UpdateTeacherProfileDto, actor: JwtPayload): Promise<TeacherProfile> {
    const profile = await this.teacherProfileModel.findById(id).select('userId status').lean() as any;
    if (!profile) {
      throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
    }

    const actorId = this.getActorId(actor);
    const profileUserId = profile.userId?.toString?.();

    if ((dto as any).user?.password !== undefined && actor?.role !== Role.DIRECTOR) {
      throw new ForbiddenException('Chi director moi duoc doi mat khau giao vien');
    }

    if (actor?.role === Role.TEACHER) {
      if (profileUserId !== actorId) {
        throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
      }
      const allowedFields = TeachersService.TEACHER_SELF_EDITABLE_FIELDS as readonly string[];
      for (const key of Object.keys(dto)) {
        if (!allowedFields.includes(key)) {
          delete (dto as any)[key];
        }
      }
      delete (dto as any).user;
      delete (dto as any).managedSales;
    }

    if (actor?.role === Role.SALE) {
      if (!TeachersService.SALE_VISIBLE_STATUSES.includes(profile.status)) {
        throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
      }
      await this.assertSaleCanAccessProfile(profile, actor);
      const allowedFields = TeachersService.SALE_EDITABLE_FIELDS as readonly string[];
      for (const key of Object.keys(dto)) {
        if (!allowedFields.includes(key)) {
          delete (dto as any)[key];
        }
      }
      delete (dto as any).bankInfo;
      delete (dto as any).status;
      delete (dto as any).adminNotes;
      delete (dto as any).managedSales;
    }

    if (actor?.role === Role.ACCOUNTING) {
      const allowedFields = TeachersService.ACCOUNTING_EDITABLE_FIELDS as readonly string[];
      for (const key of Object.keys(dto)) {
        if (!allowedFields.includes(key)) {
          delete (dto as any)[key];
        }
      }
      delete (dto as any).status;
      delete (dto as any).adminNotes;
      delete (dto as any).managedSales;
    }

    if (actor?.role !== Role.DIRECTOR) {
      delete (dto as any).managedSales;
    }

    if (actor?.role !== Role.DIRECTOR && actor?.role !== Role.OPS) {
      delete (dto as any).status;
      delete (dto as any).adminNotes;
    }

    if ((dto as any).user && profileUserId) {
      await this.updateTeacherUserInfo(profileUserId, (dto as any).user);
      delete (dto as any).user;
    }

    if ((dto as any).managedSales !== undefined) {
      (dto as any).managedSales = await this.resolveManagedSales((dto as any).managedSales);
    }

    const updated = await this.teacherProfileModel
      .findByIdAndUpdate(id, dto, { new: true })
      .populate('userId', 'userCode fullName email phone')
      .populate('managedSales', 'userCode fullName email')
      .populate('approvedBy', 'fullName')
      .lean();
    if (!updated) {
      throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
    }
    return this.sanitizeTeacherProfile(updated, actor);
  }

  async approve(id: string, actor: JwtPayload): Promise<TeacherProfile> {
    const updated = await this.teacherProfileModel
      .findOneAndUpdate(
        { _id: id, status: TeacherStatus.PENDING },
        {
          status: TeacherStatus.APPROVED,
          approvedBy: actor._id,
          approvedAt: new Date(),
        },
        { new: true },
      )
      .populate('userId', 'fullName email')
      .lean();
    if (!updated) {
      const exists = await this.teacherProfileModel.findById(id).select('status').lean();
      if (!exists) throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
      throw new BadRequestException(`Chá»‰ duyá»‡t Ä‘Æ°á»£c há»“ sÆ¡ PENDING, hiá»‡n táº¡i: ${exists.status}`);
    }
    return updated;
  }

  async activate(id: string): Promise<TeacherProfile> {
    // Only APPROVED or SUSPENDED can be activated
    const updated = await this.teacherProfileModel
      .findOneAndUpdate(
        { _id: id, status: { $in: [TeacherStatus.APPROVED, TeacherStatus.SUSPENDED, TeacherStatus.INACTIVE] } },
        { status: TeacherStatus.ACTIVE },
        { new: true },
      )
      .populate('userId', 'fullName email')
      .lean();
    if (!updated) {
      const exists = await this.teacherProfileModel.findById(id).select('status').lean();
      if (!exists) throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
      throw new BadRequestException(`KhÃ´ng thá»ƒ kÃ­ch hoáº¡t há»“ sÆ¡ á»Ÿ tráº¡ng thÃ¡i ${exists.status}`);
    }
    return updated;
  }

  async suspend(id: string, reason?: string): Promise<TeacherProfile> {
    // Only ACTIVE or APPROVED can be suspended
    const updated = await this.teacherProfileModel
      .findOneAndUpdate(
        { _id: id, status: { $in: [TeacherStatus.ACTIVE, TeacherStatus.APPROVED] } },
        {
          status: TeacherStatus.SUSPENDED,
          adminNotes: reason,
        },
        { new: true },
      )
      .populate('userId', 'fullName email')
      .lean();
    if (!updated) {
      const exists = await this.teacherProfileModel.findById(id).select('status').lean();
      if (!exists) throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');
      throw new BadRequestException(`KhÃ´ng thá»ƒ táº¡m ngÆ°ng há»“ sÆ¡ á»Ÿ tráº¡ng thÃ¡i ${exists.status}`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const profile = await this.teacherProfileModel.findById(id).lean() as any;
    if (!profile) throw new NotFoundException('Há»“ sÆ¡ giÃ¡o viÃªn khÃ´ng tá»“n táº¡i');

    // Check for active classes or pending payrolls
    const [activeClasses, pendingPayrolls] = await Promise.all([
      this.classModel.countDocuments({ teacher: profile.userId, status: 'ACTIVE' }),
      this.payrollModel.countDocuments({ teacherId: profile.userId, status: { $in: ['PENDING', 'APPROVED'] } }),
    ]);
    if (activeClasses > 0) {
      throw new BadRequestException(`GiÃ¡o viÃªn Ä‘ang cÃ³ ${activeClasses} lá»›p ACTIVE, khÃ´ng thá»ƒ xoÃ¡`);
    }
    if (pendingPayrolls > 0) {
      throw new BadRequestException(`GiÃ¡o viÃªn Ä‘ang cÃ³ ${pendingPayrolls} báº£ng lÆ°Æ¡ng chÆ°a xá»­ lÃ½, khÃ´ng thá»ƒ xoÃ¡`);
    }

    await this.teacherProfileModel.findByIdAndDelete(id);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  STATS & FULL PROFILE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  /**
   * Thá»‘ng kÃª tá»•ng quan giÃ¡o viÃªn:
   * - Tá»•ng sá»‘ GV, phÃ¢n theo status
   * - Trung bÃ¬nh rating
   * - Tá»•ng buá»•i Ä‘Ã£ dáº¡y
   */
  async getStats() {
    const [byStatus, aggregates] = await Promise.all([
      // Äáº¿m theo status
      this.teacherProfileModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      // Tá»•ng há»£p metrics
      this.teacherProfileModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            avgRating: { $avg: '$rating' },
            totalSessions: { $sum: '$totalSessions' },
            totalActiveClasses: { $sum: '$activeClasses' },
            avgExperience: { $avg: '$yearsOfExperience' },
          },
        },
      ]),
    ]);

    // Flatten byStatus vÃ o object
    const statusCounts: Record<string, number> = {};
    for (const s of byStatus) {
      statusCounts[s._id] = s.count;
    }

    const agg = aggregates[0] || {
      total: 0,
      avgRating: 0,
      totalSessions: 0,
      totalActiveClasses: 0,
      avgExperience: 0,
    };

    return {
      total: agg.total,
      byStatus: statusCounts,
      avgRating: Math.round((agg.avgRating || 0) * 10) / 10,
      totalSessions: agg.totalSessions,
      totalActiveClasses: agg.totalActiveClasses,
      avgYearsOfExperience: Math.round((agg.avgExperience || 0) * 10) / 10,
    };
  }

  /**
   * Profile Ä‘áº§y Ä‘á»§ cá»§a giÃ¡o viÃªn:
   * - ThÃ´ng tin cÃ¡ nhÃ¢n + profile
   * - Danh sÃ¡ch lá»›p Ä‘ang dáº¡y & Ä‘Ã£ dáº¡y
   * - Thá»‘ng kÃª buá»•i há»c (theo status)
   * - Tá»•ng thu nháº­p tá»« payroll
   */
  async getFullProfile(profileId: string, actor?: JwtPayload) {
    const profile = await this.teacherProfileModel
      .findById(profileId)
      .populate('userId', 'userCode fullName email phone role status')
      .populate('managedSales', 'userCode fullName email')
      .populate('approvedBy', 'fullName')
      .lean();
    if (!profile) {
      throw new NotFoundException('H? so giáo viên không t?n t?i');
    }

    if (actor?.role === Role.TEACHER) {
      const profileUserId = this.getProfileUserId(profile);
      if (profileUserId !== this.getActorId(actor)) {
        throw new NotFoundException('H? so giáo viên không t?n t?i');
      }
    }

    if (actor?.role === Role.SALE) {
      if (!TeachersService.SALE_VISIBLE_STATUSES.includes((profile as any).status)) {
        throw new NotFoundException('H? so giáo viên không t?n t?i');
      }
      await this.assertSaleCanAccessProfile(profile, actor);
    }

    const teacherUserId = this.getProfileUserId(profile);
    if (!teacherUserId) {
      throw new NotFoundException('H? so giáo viên không t?n t?i');
    }

    const teacherObjectId = new Types.ObjectId(teacherUserId);
    const saleActorId = actor?.role === Role.SALE ? this.getActorId(actor) : null;
    const classFilter: any = { teacher: teacherObjectId };

    if (saleActorId) {
      classFilter.sale = new Types.ObjectId(saleActorId);
    }

    const classes = await this.classModel
      .find(classFilter)
      .select('name code status classMode sale pricePerSession teacherPayPerSession teacherPayPerStudent students schedule createdAt')
      .populate('students', 'fullName studentCode saleId')
      .populate('sale', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    const scopedClassIds = classes.map((classroom: any) => new Types.ObjectId(classroom._id.toString()));
    const sessionMatch: any = { teacherId: teacherObjectId };
    if (saleActorId) {
      sessionMatch.classId = { $in: scopedClassIds };
    }

    const [sessionStats, recentSessions, payrollSummary] = await Promise.all([
      this.sessionModel.aggregate([
        { $match: sessionMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPayout: { $sum: '$teacherPayout' },
          },
        },
      ]),
      this.sessionModel
        .find(sessionMatch)
        .select('classId studentId status scheduledDate teacherPayout sessionType')
        .populate('classId', 'name code')
        .populate('studentId', 'fullName studentCode')
        .sort({ scheduledDate: -1 })
        .limit(10)
        .lean(),
      actor?.role === Role.SALE
        ? Promise.resolve([])
        : this.payrollModel.aggregate([
            { $match: { teacherId: teacherObjectId } },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$netAmount' },
              },
            },
          ]),
    ]);

    const sessionSummary: Record<string, { count: number; totalPayout: number }> = {};
    let totalSessionCount = 0;
    let totalEarningsFromSessions = 0;
    for (const s of sessionStats) {
      sessionSummary[s._id] = { count: s.count, totalPayout: s.totalPayout || 0 };
      totalSessionCount += s.count;
      totalEarningsFromSessions += s.totalPayout || 0;
    }

    const payroll: Record<string, { count: number; totalAmount: number }> = {};
    let totalPaid = 0;
    for (const p of payrollSummary as any[]) {
      payroll[p._id] = { count: p.count, totalAmount: p.totalAmount || 0 };
      if (p._id === 'PAID') totalPaid += p.totalAmount || 0;
    }

    const activeClasses = classes.filter((c: any) => c.status === 'ACTIVE');
    const completedClasses = classes.filter((c: any) => c.status !== 'ACTIVE');

    const payload = {
      profile,
      classes: {
        active: activeClasses,
        completed: completedClasses,
        totalActive: activeClasses.length,
        totalCompleted: completedClasses.length,
      },
      sessions: {
        byStatus: sessionSummary,
        totalCount: totalSessionCount,
        totalEarnings: totalEarningsFromSessions,
        recent: recentSessions,
      },
      payroll: {
        byStatus: payroll,
        totalPaid,
      },
    };

    if (actor?.role === Role.SALE) {
      return this.sanitizeTeacherFullProfileForSale(payload);
    }

    return payload;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  HELPERS (incremental stats update)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  private sanitizeTeacherProfile(profile: any, actor?: JwtPayload): any {
    if (actor?.role !== Role.SALE) {
      return profile;
    }

    const sanitized = {
      ...profile,
      userId:
        profile?.userId && typeof profile.userId === 'object'
          ? { ...profile.userId }
          : profile?.userId,
    };

    delete sanitized.bankInfo;
    delete sanitized.adminNotes;
    delete sanitized.approvedBy;
    delete sanitized.approvedAt;

    return sanitized;
  }

  // Update stats after session
  async incrementSessionCount(userId: string): Promise<void> {
    await this.teacherProfileModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { $inc: { totalSessions: 1 } },
    );
  }

  async updateActiveClassCount(userId: string, count: number): Promise<void> {
    await this.teacherProfileModel.updateOne(
      { userId: new Types.ObjectId(userId) },
      { activeClasses: count },
    );
  }

  async updateRating(userId: string, newRating: number): Promise<void> {
    // Atomic: increment totalReviews AND compute new rating in one operation
    // Uses $inc for totalReviews and recalculates via aggregation-style update
    const profile = await this.teacherProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      [
        {
          $set: {
            totalReviews: { $add: ['$totalReviews', 1] },
            rating: {
              $round: [
                {
                  $divide: [
                    { $add: [{ $multiply: ['$rating', '$totalReviews'] }, newRating] },
                    { $add: ['$totalReviews', 1] },
                  ],
                },
                1,
              ],
            },
          },
        },
      ],
      { new: true },
    );
    // No error if profile not found â€” caller handles gracefully
  }
}




