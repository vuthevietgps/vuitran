import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { TeacherProfile, TeacherProfileDocument } from '../teachers/schemas/teacher-profile.schema';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ConvertTeacherRegistrationDto } from './dto/convert-teacher-registration.dto';
import { CreateTeacherRegistrationDto } from './dto/create-teacher-registration.dto';
import { QueryTeacherRegistrationDto } from './dto/query-teacher-registration.dto';
import { UpdateTeacherRegistrationDto } from './dto/update-teacher-registration.dto';
import {
  TeacherRegistration,
  TeacherRegistrationDocument,
  TeacherRegistrationStatus,
  TeacherRegistrationTeachingMode,
} from './schemas/teacher-registration.schema';

@Injectable()
export class TeacherRegistrationsService {
  constructor(
    @InjectModel(TeacherRegistration.name)
    private readonly teacherRegistrationModel: Model<TeacherRegistrationDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(TeacherProfile.name)
    private readonly teacherProfileModel: Model<TeacherProfileDocument>,
    private readonly usersService: UsersService,
  ) {}

  private normalizeOptionalText(value?: string | null): string | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private normalizeEmail(value?: string | null): string | undefined {
    const normalized = this.normalizeOptionalText(value);
    return normalized?.toLowerCase();
  }

  private normalizeStringArray(values?: string[] | null): string[] {
    if (!Array.isArray(values)) {
      return [];
    }

    return Array.from(
      new Set(
        values
          .map((value) => this.normalizeOptionalText(value))
          .filter((value): value is string => !!value),
      ),
    );
  }

  private getActorObjectId(actor?: JwtPayload): Types.ObjectId | undefined {
    const actorId = actor?.sub || actor?._id;
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return undefined;
    }
    return new Types.ObjectId(actorId);
  }

  private buildFilter(
    query: QueryTeacherRegistrationDto,
  ): FilterQuery<TeacherRegistrationDocument> {
    const filter: FilterQuery<TeacherRegistrationDocument> = {};

    if (query.status) {
      filter.status = query.status;
    }

    const search = this.normalizeOptionalText(query.search);
    if (search) {
      filter.$or = [
        { applicationCode: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subjects: { $regex: search, $options: 'i' } },
        { grades: { $regex: search, $options: 'i' } },
      ];
    }

    return filter;
  }

  private async populateById(id: string) {
    return this.teacherRegistrationModel
      .findById(id)
      .populate('convertedBy', 'fullName email')
      .populate('convertedUserId', 'userCode fullName email phone')
      .populate('convertedTeacherProfileId', 'status')
      .lean();
  }

  private async loadById(id: string): Promise<TeacherRegistrationDocument> {
    const registration = await this.teacherRegistrationModel.findById(id);
    if (!registration) {
      throw new NotFoundException('Don dang ky giao vien khong ton tai');
    }
    return registration;
  }

  private async generateApplicationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GVDK-${year}-`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.teacherRegistrationModel.countDocuments({
        applicationCode: { $regex: `^${prefix}` },
      });
      const nextCode = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.teacherRegistrationModel.exists({
        applicationCode: nextCode,
      });
      if (!exists) {
        return nextCode;
      }
    }

    return `${prefix}${Date.now()}`;
  }

  private async generateTeacherUserCode(): Promise<string> {
    const prefix = 'GV';

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const count = await this.userModel.countDocuments({
        role: Role.TEACHER,
        userCode: { $regex: `^${prefix}\\d+$` },
      });
      const nextCode = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.userModel.exists({ userCode: nextCode });
      if (!exists) {
        return nextCode;
      }
    }

    return `${prefix}${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private buildTeacherProfileUpdatePayload(
    registration: TeacherRegistrationDocument,
    dto: ConvertTeacherRegistrationDto,
  ) {
    const adminNotes = [
      this.normalizeOptionalText(dto.adminNotes),
      this.normalizeOptionalText(registration.adminNotes),
      `Nguon ung vien: ${registration.applicationCode}`,
    ]
      .filter((value): value is string => !!value)
      .join('\n');

    return {
      subjects:
        dto.subjects !== undefined
          ? this.normalizeStringArray(dto.subjects)
          : registration.subjects,
      grades:
        dto.grades !== undefined
          ? this.normalizeStringArray(dto.grades)
          : registration.grades,
      teachingMode:
        dto.teachingMode
        || registration.teachingMode
        || TeacherRegistrationTeachingMode.BOTH,
      locations:
        dto.locations !== undefined
          ? this.normalizeStringArray(dto.locations)
          : registration.locations,
      bio: this.normalizeOptionalText(dto.bio) ?? registration.bio,
      yearsOfExperience:
        dto.yearsOfExperience ?? registration.yearsOfExperience ?? 0,
      pricePerSession: dto.pricePerSession ?? 0,
      pricePerHour: dto.pricePerHour,
      bankInfo: dto.bankInfo,
      adminNotes: adminNotes || undefined,
    };
  }

  async createPublic(dto: CreateTeacherRegistrationDto) {
    const registration = new this.teacherRegistrationModel({
      applicationCode: await this.generateApplicationCode(),
      fullName: this.normalizeOptionalText(dto.fullName),
      phone: this.normalizeOptionalText(dto.phone),
      email: this.normalizeEmail(dto.email),
      subjects: this.normalizeStringArray(dto.subjects),
      grades: this.normalizeStringArray(dto.grades),
      teachingMode: dto.teachingMode || TeacherRegistrationTeachingMode.BOTH,
      locations: this.normalizeStringArray(dto.locations),
      yearsOfExperience: dto.yearsOfExperience ?? 0,
      bio: this.normalizeOptionalText(dto.bio),
      sourcePage:
        this.normalizeOptionalText(dto.sourcePage) || 'teacher-recruitment',
      status: TeacherRegistrationStatus.NEW,
    });

    const saved = await registration.save();
    return {
      ok: true,
      registrationId: saved._id,
      applicationCode: saved.applicationCode,
    };
  }

  async findAll(query: QueryTeacherRegistrationDto) {
    return this.teacherRegistrationModel
      .find(this.buildFilter(query))
      .populate('convertedBy', 'fullName email')
      .populate('convertedUserId', 'userCode fullName email phone')
      .populate('convertedTeacherProfileId', 'status')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOne(id: string) {
    const registration = await this.populateById(id);
    if (!registration) {
      throw new NotFoundException('Don dang ky giao vien khong ton tai');
    }
    return registration;
  }

  async update(id: string, dto: UpdateTeacherRegistrationDto) {
    const registration = await this.loadById(id);

    const nextStatus = dto.status ?? registration.status;
    registration.fullName =
      this.normalizeOptionalText(dto.fullName) || registration.fullName;
    registration.phone =
      this.normalizeOptionalText(dto.phone) || registration.phone;
    registration.email = this.normalizeEmail(dto.email) ?? registration.email;

    if (dto.subjects !== undefined) {
      registration.subjects = this.normalizeStringArray(dto.subjects);
    }
    if (dto.grades !== undefined) {
      registration.grades = this.normalizeStringArray(dto.grades);
    }
    if (dto.locations !== undefined) {
      registration.locations = this.normalizeStringArray(dto.locations);
    }
    if (dto.teachingMode !== undefined) {
      registration.teachingMode = dto.teachingMode;
    }
    if (dto.yearsOfExperience !== undefined) {
      registration.yearsOfExperience = dto.yearsOfExperience;
    }
    if (dto.bio !== undefined) {
      registration.bio = this.normalizeOptionalText(dto.bio);
    }
    if (dto.interviewNotes !== undefined) {
      registration.interviewNotes = this.normalizeOptionalText(dto.interviewNotes);
    }
    if (dto.adminNotes !== undefined) {
      registration.adminNotes = this.normalizeOptionalText(dto.adminNotes);
    }
    if (dto.sourcePage !== undefined) {
      registration.sourcePage = this.normalizeOptionalText(dto.sourcePage);
    }

    registration.status = nextStatus;

    if (dto.interviewedAt) {
      registration.interviewedAt = new Date(dto.interviewedAt);
    } else if (
      nextStatus === TeacherRegistrationStatus.INTERVIEWING
      && !registration.interviewedAt
    ) {
      registration.interviewedAt = new Date();
    }

    if (dto.decidedAt) {
      registration.decidedAt = new Date(dto.decidedAt);
    } else if (
      [
        TeacherRegistrationStatus.APPROVED,
        TeacherRegistrationStatus.REJECTED,
        TeacherRegistrationStatus.CONVERTED,
      ].includes(nextStatus)
      && !registration.decidedAt
    ) {
      registration.decidedAt = new Date();
    }

    await registration.save();
    return this.findOne(id);
  }

  async convert(id: string, dto: ConvertTeacherRegistrationDto, actor: JwtPayload) {
    if (actor.role !== Role.DIRECTOR) {
      throw new BadRequestException('Chi giam doc moi duoc tao ho so giao vien');
    }

    const registration = await this.loadById(id);
    if (registration.status === TeacherRegistrationStatus.CONVERTED) {
      throw new BadRequestException('Ung vien nay da duoc chuyen thanh giao vien');
    }

    const fullName =
      this.normalizeOptionalText(dto.fullName) || registration.fullName;
    const phone = this.normalizeOptionalText(dto.phone) || registration.phone;
    const email = this.normalizeEmail(dto.email) || registration.email;
    const password = this.normalizeOptionalText(dto.password);

    if (!fullName) {
      throw new BadRequestException('Ho ten giao vien la bat buoc');
    }
    if (!phone) {
      throw new BadRequestException('So dien thoai giao vien la bat buoc');
    }
    if (!email) {
      throw new BadRequestException('Can co email de tao tai khoan giao vien');
    }
    if (!password || password.length < 6) {
      throw new BadRequestException('Mat khau giao vien phai tu 6 ky tu tro len');
    }

    let createdUserId: string | null = null;
    try {
      const createdUser = await this.usersService.createByDirector(
        {
          fullName,
          phone,
          email,
          password,
          role: Role.TEACHER,
          userCode:
            this.normalizeOptionalText(dto.userCode)?.toUpperCase()
            || await this.generateTeacherUserCode(),
          managedSales: dto.managedSales,
        } as CreateUserDto,
        actor,
      );

      createdUserId = String((createdUser as any)._id);

      const teacherProfile = await this.teacherProfileModel
        .findOne({ userId: new Types.ObjectId(createdUserId) })
        .select('_id')
        .lean();

      if (!teacherProfile?._id) {
        throw new NotFoundException('Khong tim thay ho so giao vien vua duoc tao');
      }

      await this.teacherProfileModel.findByIdAndUpdate(
        teacherProfile._id,
        this.buildTeacherProfileUpdatePayload(registration, dto),
      );

      registration.status = TeacherRegistrationStatus.CONVERTED;
      registration.convertedUserId = new Types.ObjectId(createdUserId);
      registration.convertedTeacherProfileId = new Types.ObjectId(
        teacherProfile._id,
      );
      registration.convertedUserCode = (createdUser as any).userCode;
      registration.convertedBy = this.getActorObjectId(actor);
      registration.convertedAt = new Date();
      registration.decidedAt = registration.decidedAt || new Date();
      if (!registration.interviewedAt) {
        registration.interviewedAt = new Date();
      }
      await registration.save();

      return {
        registration: await this.findOne(id),
        teacherProfileId: teacherProfile._id,
        userId: createdUserId,
        userCode: (createdUser as any).userCode,
      };
    } catch (error) {
      if (createdUserId && Types.ObjectId.isValid(createdUserId)) {
        await this.teacherProfileModel
          .deleteOne({ userId: new Types.ObjectId(createdUserId) })
          .catch(() => undefined);
        await this.userModel
          .deleteOne({ _id: new Types.ObjectId(createdUserId) })
          .catch(() => undefined);
      }
      throw error;
    }
  }
}
