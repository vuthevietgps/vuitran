import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, Types } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateParentAdsAttributionDto } from "./dto/update-parent-ads-attribution.dto";
import { QueryParentManagementDto } from "./dto/query-parent-management.dto";
import * as bcrypt from "bcrypt";
import { Role } from "../common/interfaces/role.enum";
import { UserStatus } from "../common/interfaces/user-status.enum";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Student, StudentDocument } from "../students/schemas/student.schema";
import {
  TeacherProfile,
  TeacherProfileDocument,
  TeacherStatus,
} from "../teachers/schemas/teacher-profile.schema";
import { UsersParentOrderService } from "./users-parent-order.service";
import { UsersAdsService } from "./users-ads.service";
import { SalaryConfigService } from "../salary-config/salary-config.service";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(TeacherProfile.name)
    private readonly teacherProfileModel: Model<TeacherProfileDocument>,
    private readonly usersParentOrderService: UsersParentOrderService,
    private readonly usersAdsService: UsersAdsService,
    private readonly salaryConfigService: SalaryConfigService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  private getActorObjectId(actor?: JwtPayload): Types.ObjectId | null {
    const actorId = actor?.sub || actor?._id;
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return null;
    }
    return new Types.ObjectId(actorId);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeUserCode(code?: string | null): string | null {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    return normalized || null;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private normalizeOptionalPhone(value?: string | null): string | null {
    return this.normalizeOptionalText(value);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private normalizeOwnershipPercentage(value?: number | null): number | null {
    if (value === undefined || value === null) return null;

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
      throw new BadRequestException("Ty le co phan phai nam trong khoang 0-100");
    }

    return Math.round(numeric * 100) / 100;
  }

  private async resolveSaleOwnerUser(
    saleOwnerId?: string | null,
  ): Promise<{ _id: Types.ObjectId; fullName: string } | null> {
    if (!saleOwnerId) return null;
    if (!Types.ObjectId.isValid(saleOwnerId)) {
      throw new BadRequestException("Sale phu trach khong hop le");
    }

    const saleUser = await this.userModel
      .findOne({
        _id: new Types.ObjectId(saleOwnerId),
        role: Role.SALE,
      })
      .select("_id fullName")
      .lean();

    if (!saleUser) {
      throw new BadRequestException("Sale phu trach khong ton tai");
    }

    return {
      _id: saleUser._id as Types.ObjectId,
      fullName: saleUser.fullName,
    };
  }

  private async listParentIdsManagedBySale(
    saleId: string,
  ): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(saleId)) {
      return [];
    }

    const parentUserIds = await this.studentModel.distinct("parentUserId", {
      saleId: new Types.ObjectId(saleId),
      parentUserId: { $exists: true, $ne: null },
    });

    return parentUserIds
      .map((item: any) => item?.toString?.() || "")
      .filter((id): id is string => !!id && Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
  }

  private async buildParentQueryForActor(actor?: JwtPayload): Promise<any> {
    if (!actor || actor.role !== Role.SALE) {
      return { role: Role.PARENT };
    }

    const actorId = actor.sub || actor._id;
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      return {
        role: Role.PARENT,
        _id: { $in: [] },
      };
    }

    const actorObjectId = new Types.ObjectId(actorId);
    const inferredParentIds = await this.listParentIdsManagedBySale(actorId);
    const ownershipBranches: any[] = [{ saleOwnerId: actorObjectId }];

    if (inferredParentIds.length) {
      ownershipBranches.push({
        _id: { $in: inferredParentIds },
        $or: [{ saleOwnerId: { $exists: false } }, { saleOwnerId: null }],
      });
    }

    return {
      role: Role.PARENT,
      $or: ownershipBranches,
    };
  }

  private async getParentOwnershipContext(id: string): Promise<{
    parentUser: any;
    ownerId: string | null;
    ownerName: string | null;
    ownershipSource: "EXPLICIT" | "INFERRED" | "UNASSIGNED" | "CONFLICT";
  }> {
    const parentUser = await this.userModel
      .findById(id)
      .select(
        "_id fullName email role phone facebookLink address saleOwnerId saleOwnerName",
      )
      .lean();

    if (!parentUser) throw new NotFoundException("Khong tim thay nguoi dung");
    if (parentUser.role !== Role.PARENT) {
      throw new BadRequestException(
        "Chi ho tro thao tac voi tai khoan PHU HUYNH",
      );
    }

    const explicitOwnerId = parentUser.saleOwnerId?.toString?.() || null;
    if (explicitOwnerId) {
      return {
        parentUser,
        ownerId: explicitOwnerId,
        ownerName: parentUser.saleOwnerName || null,
        ownershipSource: "EXPLICIT",
      };
    }

    const linkedStudents = await this.studentModel
      .find({
        parentUserId: new Types.ObjectId(id),
        saleId: { $exists: true, $ne: null },
      })
      .select("saleId saleName")
      .lean<Array<{ saleId?: Types.ObjectId; saleName?: string }>>();

    const owners = Array.from(
      new Map(
        linkedStudents
          .map((student) => {
            const saleId = student.saleId?.toString?.();
            return saleId ? [saleId, student.saleName || ""] : null;
          })
          .filter((item): item is [string, string] => !!item),
      ).entries(),
    );

    if (owners.length === 1) {
      const [ownerId, ownerName] = owners[0];
      return {
        parentUser,
        ownerId,
        ownerName: ownerName || null,
        ownershipSource: "INFERRED",
      };
    }

    if (owners.length > 1) {
      return {
        parentUser,
        ownerId: null,
        ownerName: null,
        ownershipSource: "CONFLICT",
      };
    }

    return {
      parentUser,
      ownerId: null,
      ownerName: null,
      ownershipSource: "UNASSIGNED",
    };
  }

  private async syncParentStudentsSaleOwnership(
    parentUserId: string,
    saleOwner: { _id: Types.ObjectId; fullName: string } | null,
  ): Promise<void> {
    if (!saleOwner) return;

    await this.studentModel.updateMany(
      { parentUserId: new Types.ObjectId(parentUserId) },
      {
        $set: {
          saleId: saleOwner._id,
          saleName: saleOwner.fullName,
        },
      },
    );
  }

  private async ensureEmailUnique(
    email: string,
    excludeId?: string,
    mongoSession?: ClientSession,
  ): Promise<void> {
    const query: any = { email };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await (mongoSession
      ? this.userModel.findOne(query).session(mongoSession).lean()
      : this.userModel.findOne(query).lean());
    if (existing) throw new ConflictException("Email da ton tai");
  }

  private async ensureUserCodeUnique(
    userCode: string,
    excludeId?: string,
    mongoSession?: ClientSession,
  ): Promise<void> {
    const query: any = { userCode };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await (mongoSession
      ? this.userModel.findOne(query).session(mongoSession).lean()
      : this.userModel.findOne(query).lean());
    if (existing) throw new ConflictException("Ma tai khoan da ton tai");
  }

  private async resolveManagedSales(
    saleIds?: string[],
  ): Promise<Types.ObjectId[]> {
    if (!saleIds?.length) {
      return [];
    }

    const uniqueSaleIds = Array.from(new Set(saleIds.filter(Boolean)));
    const validSaleIds = uniqueSaleIds.filter((id) =>
      Types.ObjectId.isValid(id),
    );
    if (validSaleIds.length !== uniqueSaleIds.length) {
      throw new BadRequestException("Danh sach sale quan ly khong hop le");
    }

    const saleUsers = await this.userModel
      .find({
        _id: { $in: validSaleIds.map((id) => new Types.ObjectId(id)) },
        role: Role.SALE,
      })
      .select("_id")
      .lean();

    if (saleUsers.length !== validSaleIds.length) {
      throw new BadRequestException(
        "Co sale quan ly khong ton tai hoac sai vai tro",
      );
    }

    return validSaleIds.map((id) => new Types.ObjectId(id));
  }

  // --- Delegated to UsersParentOrderService ---

  async findOrCreateParentFromOrder(
    orderData: any,
    mongoSession?: ClientSession,
  ): Promise<string> {
    return this.usersParentOrderService.findOrCreateParentFromOrder(
      orderData,
      mongoSession,
    );
  }

  // --- Delegated to UsersAdsService ---

  async getParentAdsAttribution(id: string) {
    return this.usersAdsService.getParentAdsAttribution(id);
  }

  async updateParentAdsAttribution(
    id: string,
    dto: UpdateParentAdsAttributionDto,
    actor: JwtPayload,
  ) {
    return this.usersAdsService.updateParentAdsAttribution(id, dto, actor);
  }

  async clearParentAdsAttribution(id: string, actor: JwtPayload) {
    return this.usersAdsService.clearParentAdsAttribution(id, actor);
  }

  // --- CRUD ---

  async create(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role === Role.DIRECTOR) {
      return this.createByDirector(dto, actor);
    }
    if (actor.role === Role.SALE) {
      return this.createBySale(dto, actor);
    }
    throw new ForbiddenException("Ban khong co quyen tao tai khoan");
  }

  async findParents(actor?: JwtPayload): Promise<User[]> {
    const query = await this.buildParentQueryForActor(actor);
    const users = await this.userModel
      .find(query)
      .select("-password")
      .sort({ fullName: 1 })
      .lean();
    return (await this.usersAdsService.enrichUsersWithAdsAttribution(users as any)) as any;
  }

  async findParentsManagement(
    dto: QueryParentManagementDto,
    actor?: JwtPayload,
  ): Promise<{
    data: User[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const baseQuery = await this.buildParentQueryForActor(actor);
    const search = dto.search?.trim();
    const page = Math.max(1, Number(dto.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(dto.limit) || 50));
    const searchRegex = search ? new RegExp(this.escapeRegex(search), "i") : null;
    const query = searchRegex
      ? {
          $and: [
            baseQuery,
            {
              $or: [
                { userCode: searchRegex },
                { email: searchRegex },
                { fullName: searchRegex },
                { phone: searchRegex },
                { saleOwnerName: searchRegex },
              ],
            },
          ],
        }
      : baseQuery;

    const total = await this.userModel.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const users = await this.userModel
      .find(query)
      .select(
        "_id userCode email fullName role status phone ownershipPercentage saleOwnerId saleOwnerName facebookLink address",
      )
      .sort({ fullName: 1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return {
      data: (await this.usersAdsService.enrichUsersWithAdsAttribution(
        users as any,
      )) as any,
      meta: {
        total,
        page: safePage,
        limit,
        totalPages,
      },
    };
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: JwtPayload,
  ): Promise<User> {
    if (actor.role === Role.DIRECTOR) {
      return this.updateByDirector(id, dto, actor);
    }
    if (actor.role === Role.SALE) {
      return this.updateOwnedParentBySale(id, dto, actor);
    }
    throw new ForbiddenException("Ban khong co quyen sua tai khoan");
  }

  async createByDirector(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");

    const email = this.normalizeEmail(dto.email);
    const userCode = this.normalizeUserCode(dto.userCode);
    const phone = this.normalizeOptionalPhone(dto.phone);
    const facebookLink = this.normalizeOptionalText(dto.facebookLink);
    const address = this.normalizeOptionalText(dto.address);
    const isParent = dto.role === Role.PARENT;
    const isTeacher = dto.role === Role.TEACHER;
    const isShareholder = dto.role === Role.SHAREHOLDER;
    const ownershipPercentage = this.normalizeOwnershipPercentage(
      dto.ownershipPercentage,
    );
    const saleOwner = isParent
      ? await this.resolveSaleOwnerUser(dto.saleOwnerId)
      : null;
    if (!userCode) throw new BadRequestException("Ma tai khoan la bat buoc");
    if (dto.managedSales?.length && !isTeacher) {
      throw new BadRequestException(
        "Chi tai khoan giao vien moi duoc gan sale quan ly",
      );
    }
    if (dto.salaryConfig && !isTeacher) {
      throw new BadRequestException(
        "Chi tai khoan giao vien moi duoc khai bao salary config mac dinh",
      );
    }
    if (!isShareholder && dto.ownershipPercentage !== undefined) {
      throw new BadRequestException(
        "Chi tai khoan co dong moi duoc khai bao ty le co phan",
      );
    }
    if (isShareholder && ownershipPercentage === null) {
      throw new BadRequestException(
        "Tai khoan co dong bat buoc phai co ty le co phan",
      );
    }

    const managedSales = isTeacher
      ? await this.resolveManagedSales(dto.managedSales)
      : [];

    await this.ensureEmailUnique(email);
    await this.ensureUserCodeUnique(userCode);

    const password = await this.hashPassword(dto.password);
    const user = new this.userModel({
      ...dto,
      email,
      userCode,
      password,
      phone: phone || undefined,
      facebookLink: isParent ? facebookLink || undefined : undefined,
      address: isParent ? address || undefined : undefined,
      saleOwnerId: isParent ? saleOwner?._id : undefined,
      saleOwnerName: isParent ? saleOwner?.fullName : undefined,
      ownershipPercentage: isShareholder ? ownershipPercentage || undefined : undefined,
    });
    const saved = await user.save();

    try {
      if (isTeacher) {
        const approvedBy = this.getActorObjectId(actor);
        await this.teacherProfileModel.create({
          userId: saved._id,
          managedSales,
          subjects: [],
          grades: [],
          teachingMode: "BOTH",
          locations: [],
          qualifications: [],
          yearsOfExperience: 0,
          availability: [],
          pricePerSession: 0,
          status: TeacherStatus.APPROVED,
          approvedBy: approvedBy || undefined,
          approvedAt: new Date(),
        });
        if (dto.salaryConfig) {
          await this.salaryConfigService.create({
            ...dto.salaryConfig,
            userId: saved._id.toString(),
          });
        }
      }
    } catch (error) {
      await this.salaryConfigService.remove(saved._id.toString()).catch(() => undefined);
      await this.teacherProfileModel.deleteOne({ userId: saved._id });
      await this.userModel.deleteOne({ _id: saved._id });
      throw error;
    }

    const { password: _pw, ...result } = saved.toObject();
    return result as any;
  }

  async createBySale(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.SALE)
      throw new ForbiddenException("Chi sale moi co quyen");
    if (dto.role !== Role.PARENT) {
      throw new ForbiddenException("Sale chi duoc tao tai khoan phu huynh");
    }
    if (dto.ownershipPercentage !== undefined) {
      throw new BadRequestException(
        "Chi tai khoan co dong moi duoc khai bao ty le co phan",
      );
    }

    const email = this.normalizeEmail(dto.email);
    const userCode = this.normalizeUserCode(dto.userCode);
    const phone = this.normalizeOptionalPhone(dto.phone);
    const facebookLink = this.normalizeOptionalText(dto.facebookLink);
    const address = this.normalizeOptionalText(dto.address);
    if (!userCode) throw new BadRequestException("Ma tai khoan la bat buoc");

    await this.ensureEmailUnique(email);
    await this.ensureUserCodeUnique(userCode);

    const password = await this.hashPassword(dto.password);
    const user = new this.userModel({
      email,
      userCode,
      password,
      fullName: dto.fullName,
      role: Role.PARENT,
      phone: phone || undefined,
      facebookLink: facebookLink || undefined,
      address: address || undefined,
      saleOwnerId: new Types.ObjectId(actor.sub),
      saleOwnerName: actor.fullName || "",
    });

    const saved = await user.save();
    const { password: _pw, ...result } = saved.toObject();
    return result as any;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userModel.find().select("-password").lean();
    return (await this.usersAdsService.enrichUsersWithAdsAttribution(users as any)) as any;
  }

  async findByRole(role: Role): Promise<User[]> {
    const users = await this.userModel
      .find({ role })
      .select("-password")
      .lean();
    return (await this.usersAdsService.enrichUsersWithAdsAttribution(users as any)) as any;
  }

  async findTeachers(actor: JwtPayload): Promise<User[]> {
    if (actor.role === Role.SALE) {
      const saleObjectId = new Types.ObjectId(actor.sub);
      const teacherUserIds = await this.teacherProfileModel.distinct("userId", {
        managedSales: saleObjectId,
      });
      if (!teacherUserIds.length) return [];
      const users = await this.userModel
        .find({ _id: { $in: teacherUserIds }, role: Role.TEACHER })
        .select("-password")
        .lean();
      return (await this.usersAdsService.enrichUsersWithAdsAttribution(users as any)) as any;
    }
    return this.findByRole(Role.TEACHER);
  }

  async findDirectory(excludeUserId?: string): Promise<Partial<User>[]> {
    if (excludeUserId) {
      const requester = await this.userModel
        .findById(excludeUserId)
        .select("_id role status")
        .lean();

      if (
        requester?.status === UserStatus.ACTIVE &&
        requester.role === Role.PARENT
      ) {
        return this.usersAdsService.findParentSupportDirectory(excludeUserId);
      }
    }

    const query: any = { status: UserStatus.ACTIVE };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    return this.userModel
      .find(query)
      .select("userCode email fullName role phone status")
      .sort({ fullName: 1 })
      .lean();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select("-password").lean();
    if (!user) throw new NotFoundException("Khong tim thay nguoi dung");
    return user as any;
  }

  async updateByDirector(
    id: string,
    dto: UpdateUserDto,
    actor: JwtPayload,
  ): Promise<User> {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");

    const existing = await this.userModel
      .findById(id)
      .select("_id role ownershipPercentage")
      .lean();
    if (!existing) throw new NotFoundException("Khong tim thay nguoi dung");

    const update: any = {};
    const unset: Record<string, 1> = {};
    const nextRole = dto.role ?? existing.role;
    const isParent = nextRole === Role.PARENT;
    const isShareholder = nextRole === Role.SHAREHOLDER;

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      await this.ensureEmailUnique(email, id);
      update.email = email;
    }

    if (dto.userCode !== undefined) {
      const userCode = this.normalizeUserCode(dto.userCode);
      if (!userCode)
        throw new BadRequestException("Ma tai khoan khong duoc de trong");
      await this.ensureUserCodeUnique(userCode, id);
      update.userCode = userCode;
    }

    if (dto.fullName !== undefined) update.fullName = dto.fullName;
    if (dto.role !== undefined) update.role = dto.role;
    if (dto.phone !== undefined) {
      const phone = this.normalizeOptionalPhone(dto.phone);
      if (phone) update.phone = phone;
      else unset.phone = 1;
    }

    if (dto.facebookLink !== undefined) {
      const facebookLink = this.normalizeOptionalText(dto.facebookLink);
      if (facebookLink) update.facebookLink = facebookLink;
      else unset.facebookLink = 1;
    }

    if (dto.address !== undefined) {
      const address = this.normalizeOptionalText(dto.address);
      if (address) update.address = address;
      else unset.address = 1;
    }

    if (dto.saleOwnerId !== undefined) {
      if (!isParent) {
        throw new BadRequestException(
          "Chi tai khoan phu huynh moi duoc gan sale phu trach",
        );
      }
      const saleOwner = await this.resolveSaleOwnerUser(dto.saleOwnerId);
      if (saleOwner) {
        update.saleOwnerId = saleOwner._id;
        update.saleOwnerName = saleOwner.fullName;
      } else {
        unset.saleOwnerId = 1;
        unset.saleOwnerName = 1;
      }
    }

    if (dto.ownershipPercentage !== undefined) {
      if (!isShareholder) {
        throw new BadRequestException(
          "Chi tai khoan co dong moi duoc khai bao ty le co phan",
        );
      }
      update.ownershipPercentage = this.normalizeOwnershipPercentage(
        dto.ownershipPercentage,
      );
    }

    if (nextRole !== Role.PARENT) {
      unset.facebookLink = 1;
      unset.address = 1;
      unset.saleOwnerId = 1;
      unset.saleOwnerName = 1;
      delete update.facebookLink;
      delete update.address;
      delete update.saleOwnerId;
      delete update.saleOwnerName;
    }

    const effectiveOwnershipPercentage =
      dto.ownershipPercentage !== undefined
        ? this.normalizeOwnershipPercentage(dto.ownershipPercentage)
        : this.normalizeOwnershipPercentage(
            (existing as { ownershipPercentage?: number | null })
              .ownershipPercentage,
          );
    if (isShareholder && effectiveOwnershipPercentage === null) {
      throw new BadRequestException(
        "Tai khoan co dong bat buoc phai co ty le co phan",
      );
    }

    if (!isShareholder) {
      unset.ownershipPercentage = 1;
      delete update.ownershipPercentage;
    }

    if (dto.password) {
      update.password = await this.hashPassword(dto.password);
    }

    if (Object.keys(unset).length) {
      update.$unset = unset;
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .select("-password")
      .lean();
    if (!user) throw new NotFoundException("Khong tim thay nguoi dung");

    if (isParent && dto.saleOwnerId !== undefined) {
      const saleOwner = await this.resolveSaleOwnerUser(dto.saleOwnerId);
      await this.syncParentStudentsSaleOwnership(id, saleOwner);
    }

    return user as any;
  }

  async updateOwnedParentBySale(
    id: string,
    dto: UpdateUserDto,
    actor: JwtPayload,
  ): Promise<User> {
    if (actor.role !== Role.SALE)
      throw new ForbiddenException("Chi sale moi co quyen");

    if (dto.role !== undefined && dto.role !== Role.PARENT) {
      throw new ForbiddenException("Sale chi duoc sua tai khoan phu huynh");
    }
    if (dto.saleOwnerId !== undefined) {
      throw new ForbiddenException(
        "Sale khong duoc chuyen phu huynh cho sale khac",
      );
    }
    if (dto.ownershipPercentage !== undefined) {
      throw new BadRequestException(
        "Chi tai khoan co dong moi duoc khai bao ty le co phan",
      );
    }

    const ownership = await this.getParentOwnershipContext(id);
    if (ownership.ownershipSource === "CONFLICT") {
      throw new ForbiddenException(
        "Phu huynh nay dang gan nhieu sale, vui long nho giam doc chuan hoa",
      );
    }
    if (ownership.ownerId !== actor.sub) {
      throw new ForbiddenException(
        "Ban khong phu trach tai khoan phu huynh nay",
      );
    }

    const update: any = {
      saleOwnerId: new Types.ObjectId(actor.sub),
      saleOwnerName: actor.fullName || ownership.ownerName || "",
    };
    const unset: Record<string, 1> = {};

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      await this.ensureEmailUnique(email, id);
      update.email = email;
    }

    if (dto.userCode !== undefined) {
      const userCode = this.normalizeUserCode(dto.userCode);
      if (!userCode)
        throw new BadRequestException("Ma tai khoan khong duoc de trong");
      await this.ensureUserCodeUnique(userCode, id);
      update.userCode = userCode;
    }

    if (dto.fullName !== undefined) update.fullName = dto.fullName;

    if (dto.phone !== undefined) {
      const phone = this.normalizeOptionalPhone(dto.phone);
      if (phone) update.phone = phone;
      else unset.phone = 1;
    }

    if (dto.facebookLink !== undefined) {
      const facebookLink = this.normalizeOptionalText(dto.facebookLink);
      if (facebookLink) update.facebookLink = facebookLink;
      else unset.facebookLink = 1;
    }

    if (dto.address !== undefined) {
      const address = this.normalizeOptionalText(dto.address);
      if (address) update.address = address;
      else unset.address = 1;
    }

    if (dto.password) {
      update.password = await this.hashPassword(dto.password);
    }

    if (Object.keys(unset).length) {
      update.$unset = unset;
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, update, { new: true })
      .select("-password")
      .lean();
    if (!user) throw new NotFoundException("Khong tim thay nguoi dung");
    return user as any;
  }

  async lock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");
    if (actor.sub === id)
      throw new ForbiddenException("Khong the khoa chinh minh");
    const user = await this.userModel
      .findByIdAndUpdate(id, { status: UserStatus.LOCKED }, { new: true })
      .select("-password")
      .lean();
    if (!user) throw new NotFoundException("Khong tim thay nguoi dung");
    return user as any;
  }

  async unlock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        {
          status: UserStatus.ACTIVE,
          failedLoginAttempts: 0,
          $unset: { lastFailedLoginAt: 1 },
        },
        { new: true },
      )
      .select("-password")
      .lean();
    if (!user) throw new NotFoundException("Khong tim thay nguoi dung");
    return user as any;
  }

  async removeByDirector(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");
    if (actor.sub === id)
      throw new ForbiddenException("Khong the xoa chinh minh");
    const deleted = await this.userModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException("Khong tim thay nguoi dung");
    return deleted as any;
  }
}
