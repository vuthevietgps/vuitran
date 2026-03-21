import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateParentAdsAttributionDto } from './dto/update-parent-ads-attribution.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import {
  ParentAttribution,
  ParentAttributionDocument,
  ParentAttributionModel,
  ParentAttributionSourceType,
} from '../marketing-attribution/schemas/parent-attribution.schema';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import { normalizePhone } from '../marketing-attribution/parent-attribution.util';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { TeacherProfile, TeacherProfileDocument } from '../teachers/schemas/teacher-profile.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(TeacherProfile.name)
    private readonly teacherProfileModel: Model<TeacherProfileDocument>,
    @InjectModel(ParentAttribution.name)
    private readonly parentAttributionModel: Model<ParentAttributionDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly marketingAttributionService: MarketingAttributionService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
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

  private async resolveSaleOwnerUser(saleOwnerId?: string | null): Promise<{ _id: Types.ObjectId; fullName: string } | null> {
    if (!saleOwnerId) return null;
    if (!Types.ObjectId.isValid(saleOwnerId)) {
      throw new BadRequestException('Sale phu trach khong hop le');
    }

    const saleUser = await this.userModel
      .findOne({
        _id: new Types.ObjectId(saleOwnerId),
        role: Role.SALE,
      })
      .select('_id fullName')
      .lean();

    if (!saleUser) {
      throw new BadRequestException('Sale phu trach khong ton tai');
    }

    return {
      _id: saleUser._id as Types.ObjectId,
      fullName: saleUser.fullName,
    };
  }

  private async listParentIdsManagedBySale(saleId: string): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(saleId)) {
      return [];
    }

    const parentUserIds = await this.studentModel.distinct('parentUserId', {
      saleId: new Types.ObjectId(saleId),
      parentUserId: { $exists: true, $ne: null },
    });

    return parentUserIds
      .map((item: any) => item?.toString?.() || '')
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
        $or: [
          { saleOwnerId: { $exists: false } },
          { saleOwnerId: null },
        ],
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
    ownershipSource: 'EXPLICIT' | 'INFERRED' | 'UNASSIGNED' | 'CONFLICT';
  }> {
    const parentUser = await this.userModel
      .findById(id)
      .select('_id fullName email role phone facebookLink address saleOwnerId saleOwnerName')
      .lean();

    if (!parentUser) throw new NotFoundException('Khong tim thay nguoi dung');
    if (parentUser.role !== Role.PARENT) {
      throw new BadRequestException('Chi ho tro thao tac voi tai khoan PHU HUYNH');
    }

    const explicitOwnerId = parentUser.saleOwnerId?.toString?.() || null;
    if (explicitOwnerId) {
      return {
        parentUser,
        ownerId: explicitOwnerId,
        ownerName: parentUser.saleOwnerName || null,
        ownershipSource: 'EXPLICIT',
      };
    }

    const linkedStudents = await this.studentModel
      .find({
        parentUserId: new Types.ObjectId(id),
        saleId: { $exists: true, $ne: null },
      })
      .select('saleId saleName')
      .lean<Array<{ saleId?: Types.ObjectId; saleName?: string }>>();

    const owners = Array.from(
      new Map(
        linkedStudents
          .map((student) => {
            const saleId = student.saleId?.toString?.();
            return saleId ? [saleId, student.saleName || ''] : null;
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
        ownershipSource: 'INFERRED',
      };
    }

    if (owners.length > 1) {
      return {
        parentUser,
        ownerId: null,
        ownerName: null,
        ownershipSource: 'CONFLICT',
      };
    }

    return {
      parentUser,
      ownerId: null,
      ownerName: null,
      ownershipSource: 'UNASSIGNED',
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

  private async findParentUserOrThrow(id: string): Promise<any> {
    const user = await this.userModel
      .findById(id)
      .select('_id fullName email role phone')
      .lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    if (user.role !== Role.PARENT) {
      throw new BadRequestException('Chi ho tro gan nhom quang cao cho tai khoan PHU HUYNH');
    }
    return user;
  }

  private async findBestParentAttribution(parentUser: any): Promise<{
    doc: any | null;
    matchedBy: 'PARENT_USER' | 'PHONE_FALLBACK' | 'UNASSIGNED';
  }> {
    const conditions: any[] = [{ parentUserId: new Types.ObjectId(parentUser._id) }];
    const normalizedParentPhone = normalizePhone(parentUser.phone);
    if (normalizedParentPhone) {
      conditions.push({ normalizedParentPhone });
    }

    const docs = await this.parentAttributionModel
      .find({ $or: conditions })
      .select(
        'parentKey parentUserId normalizedParentPhone adGroupId adGroupName platform attributionModel sourceType firstAttributedAt lastConfirmedAt notes',
      )
      .sort({ lastConfirmedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    if (!docs.length) {
      return { doc: null, matchedBy: 'UNASSIGNED' };
    }

    const directMatch = docs.find(
      (doc: any) => doc.parentUserId?.toString?.() === parentUser._id.toString(),
    );

    return {
      doc: directMatch || docs[0],
      matchedBy: directMatch ? 'PARENT_USER' : 'PHONE_FALLBACK',
    };
  }

  private async enrichUsersWithAdsAttribution(users: any[]): Promise<any[]> {
    if (!users.length) return users;

    const parentUsers = users.filter((user) => user.role === Role.PARENT);
    if (!parentUsers.length) return users;

    const parentUserIds = parentUsers
      .map((user) => user._id?.toString?.())
      .filter((id): id is string => !!id && Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const normalizedPhones = Array.from(
      new Set(
        parentUsers
          .map((user) => normalizePhone(user.phone))
          .filter((phone): phone is string => !!phone),
      ),
    );

    const conditions: any[] = [];
    if (parentUserIds.length) conditions.push({ parentUserId: { $in: parentUserIds } });
    if (normalizedPhones.length) conditions.push({ normalizedParentPhone: { $in: normalizedPhones } });
    if (!conditions.length) return users;

    const attributions = await this.parentAttributionModel
      .find({ $or: conditions })
      .select(
        'parentUserId normalizedParentPhone adGroupId adGroupName platform sourceType lastConfirmedAt',
      )
      .sort({ lastConfirmedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    const byUserId = new Map<string, any>();
    const byPhone = new Map<string, any>();

    for (const attribution of attributions as any[]) {
      const ownerId = attribution.parentUserId?.toString?.();
      if (ownerId && !byUserId.has(ownerId)) {
        byUserId.set(ownerId, attribution);
      }

      const phone = normalizePhone(attribution.normalizedParentPhone);
      if (phone && !byPhone.has(phone)) {
        byPhone.set(phone, attribution);
      }
    }

    return users.map((user) => {
      if (user.role !== Role.PARENT) return user;

      const ownerId = user._id?.toString?.();
      const normalizedPhone = normalizePhone(user.phone);
      const attribution = (ownerId ? byUserId.get(ownerId) : null)
        || (normalizedPhone ? byPhone.get(normalizedPhone) : null);

      return {
        ...user,
        adGroupId: attribution?.adGroupId?.toString?.() || null,
        adGroupName: attribution?.adGroupName || '',
        adPlatform: attribution?.platform || '',
        adAttributionSource: attribution?.sourceType || null,
      };
    });
  }

  private async findParentSupportDirectory(parentUserId: string): Promise<Partial<User>[]> {
    const parentObjectId = new Types.ObjectId(parentUserId);
    const students = await this.studentModel
      .find({ parentUserId: parentObjectId })
      .select('saleId')
      .lean<Array<{ saleId?: Types.ObjectId }>>();

    const saleIds = Array.from(
      new Set(
        students
          .map((student) => student.saleId?.toString())
          .filter((id): id is string => !!id),
      ),
    ).map((id) => new Types.ObjectId(id));

    const query: any = {
      status: UserStatus.ACTIVE,
      $or: [
        { role: Role.DIRECTOR },
        { role: Role.OPS },
      ],
    };

    if (saleIds.length) {
      query.$or.push({
        role: Role.SALE,
        _id: { $in: saleIds },
      });
    }

    return this.userModel
      .find(query)
      .select('userCode email fullName role phone status')
      .sort({ role: 1, fullName: 1 })
      .lean();
  }

  async getParentAdsAttribution(id: string) {
    const parentUser = await this.findParentUserOrThrow(id);
    const { doc, matchedBy } = await this.findBestParentAttribution(parentUser);

    return {
      parentUserId: parentUser._id.toString(),
      parentName: parentUser.fullName,
      parentPhone: parentUser.phone || '',
      parentKey: doc?.parentKey || null,
      adGroupId: doc?.adGroupId?.toString?.() || null,
      adGroupName: doc?.adGroupName || '',
      platform: doc?.platform || '',
      attributionModel: doc?.attributionModel || null,
      sourceType: doc?.sourceType || null,
      firstAttributedAt: doc?.firstAttributedAt || null,
      lastConfirmedAt: doc?.lastConfirmedAt || null,
      notes: doc?.notes || '',
      matchedBy,
    };
  }

  async updateParentAdsAttribution(
    id: string,
    dto: UpdateParentAdsAttributionDto,
    actor: JwtPayload,
  ) {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');

    const parentUser = await this.findParentUserOrThrow(id);
    const adGroup = await this.adGroupModel
      .findById(dto.adGroupId)
      .select('_id name platform')
      .lean();
    if (!adGroup) {
      throw new NotFoundException('Khong tim thay nhom quang cao');
    }

    await this.marketingAttributionService.upsertParentAttribution({
      parentUserId: parentUser._id,
      parentPhone: parentUser.phone,
      parentEmail: parentUser.email,
      adGroupId: adGroup._id,
      adGroupName: adGroup.name,
      platform: adGroup.platform,
      attributionModel: ParentAttributionModel.MANUAL_OVERRIDE,
      sourceType: ParentAttributionSourceType.MANUAL,
      notes: `Manual ad group assignment by ${actor.email || actor.sub}`,
    });

    return this.getParentAdsAttribution(id);
  }

  async clearParentAdsAttribution(id: string, actor: JwtPayload) {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');

    const parentUser = await this.findParentUserOrThrow(id);
    const normalizedParentPhone = normalizePhone(parentUser.phone);
    const docs = await this.parentAttributionModel.find({
      $or: [
        { parentUserId: new Types.ObjectId(parentUser._id) },
        ...(normalizedParentPhone ? [{ normalizedParentPhone }] : []),
      ],
    });

    const now = new Date();
    for (const doc of docs) {
      const ownerId = doc.parentUserId?.toString?.();
      if (ownerId && ownerId !== parentUser._id.toString()) continue;
      doc.adGroupId = undefined;
      doc.adGroupName = undefined;
      doc.platform = undefined;
      doc.adRefParam = undefined;
      doc.attributionModel = ParentAttributionModel.MANUAL_OVERRIDE;
      doc.sourceType = ParentAttributionSourceType.MANUAL;
      doc.lastConfirmedAt = now;
      doc.notes = `Manual ad group clear by ${actor.email || actor.sub}`;
      await doc.save();
    }

    return this.getParentAdsAttribution(id);
  }

  private async ensureEmailUnique(email: string, excludeId?: string): Promise<void> {
    const query: any = { email };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await this.userModel.findOne(query).lean();
    if (existing) throw new ConflictException('Email da ton tai');
  }

  private async ensureUserCodeUnique(userCode: string, excludeId?: string): Promise<void> {
    const query: any = { userCode };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await this.userModel.findOne(query).lean();
    if (existing) throw new ConflictException('Ma tai khoan da ton tai');
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

  async create(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role === Role.DIRECTOR) {
      return this.createByDirector(dto, actor);
    }
    if (actor.role === Role.SALE) {
      return this.createBySale(dto, actor);
    }
    throw new ForbiddenException('Ban khong co quyen tao tai khoan');
  }

  async findParents(actor?: JwtPayload): Promise<User[]> {
    const query = await this.buildParentQueryForActor(actor);
    const users = await this.userModel.find(query).select('-password').sort({ fullName: 1 }).lean();
    return (await this.enrichUsersWithAdsAttribution(users as any)) as any;
  }

  async update(id: string, dto: UpdateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role === Role.DIRECTOR) {
      return this.updateByDirector(id, dto, actor);
    }
    if (actor.role === Role.SALE) {
      return this.updateOwnedParentBySale(id, dto, actor);
    }
    throw new ForbiddenException('Ban khong co quyen sua tai khoan');
  }

  async createByDirector(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');

    const email = this.normalizeEmail(dto.email);
    const userCode = this.normalizeUserCode(dto.userCode);
    const phone = this.normalizeOptionalPhone(dto.phone);
    const facebookLink = this.normalizeOptionalText(dto.facebookLink);
    const address = this.normalizeOptionalText(dto.address);
    const isParent = dto.role === Role.PARENT;
    const isTeacher = dto.role === Role.TEACHER;
    const saleOwner = isParent ? await this.resolveSaleOwnerUser(dto.saleOwnerId) : null;
    if (!userCode) throw new BadRequestException('Ma tai khoan la bat buoc');
    if (dto.managedSales?.length && !isTeacher) {
      throw new BadRequestException('Chi tai khoan giao vien moi duoc gan sale quan ly');
    }

    const managedSales = isTeacher ? await this.resolveManagedSales(dto.managedSales) : [];

    await this.ensureEmailUnique(email);
    await this.ensureUserCodeUnique(userCode);

    const password = await this.hashPassword(dto.password);
    const user = new this.userModel({
      ...dto,
      email,
      userCode,
      password,
      phone: phone || undefined,
      facebookLink: isParent ? (facebookLink || undefined) : undefined,
      address: isParent ? (address || undefined) : undefined,
      saleOwnerId: isParent ? saleOwner?._id : undefined,
      saleOwnerName: isParent ? saleOwner?.fullName : undefined,
    });
    const saved = await user.save();

    try {
      if (isTeacher && managedSales.length) {
        await this.teacherProfileModel.create({
          userId: saved._id,
          managedSales,
          subjects: [],
          grades: [],
          teachingMode: 'BOTH',
          locations: [],
          qualifications: [],
          yearsOfExperience: 0,
          availability: [],
          pricePerSession: 0,
        });
      }
    } catch (error) {
      await this.userModel.deleteOne({ _id: saved._id });
      throw error;
    }

    const { password: _pw, ...result } = saved.toObject();
    return result as any;
  }

  async createBySale(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.SALE) throw new ForbiddenException('Chi sale moi co quyen');
    if (dto.role !== Role.PARENT) {
      throw new ForbiddenException('Sale chi duoc tao tai khoan phu huynh');
    }

    const email = this.normalizeEmail(dto.email);
    const userCode = this.normalizeUserCode(dto.userCode);
    const phone = this.normalizeOptionalPhone(dto.phone);
    const facebookLink = this.normalizeOptionalText(dto.facebookLink);
    const address = this.normalizeOptionalText(dto.address);
    if (!userCode) throw new BadRequestException('Ma tai khoan la bat buoc');

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
      saleOwnerName: actor.fullName || '',
    });

    const saved = await user.save();
    const { password: _pw, ...result } = saved.toObject();
    return result as any;
  }

  async findAll(): Promise<User[]> {
    const users = await this.userModel.find().select('-password').lean();
    return (await this.enrichUsersWithAdsAttribution(users as any)) as any;
  }

  async findByRole(role: Role): Promise<User[]> {
    const users = await this.userModel.find({ role }).select('-password').lean();
    return (await this.enrichUsersWithAdsAttribution(users as any)) as any;
  }

  async findDirectory(excludeUserId?: string): Promise<Partial<User>[]> {
    if (excludeUserId) {
      const requester = await this.userModel
        .findById(excludeUserId)
        .select('_id role status')
        .lean();

      if (requester?.status === UserStatus.ACTIVE && requester.role === Role.PARENT) {
        return this.findParentSupportDirectory(excludeUserId);
      }
    }

    const query: any = { status: UserStatus.ACTIVE };
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    return this.userModel
      .find(query)
      .select('userCode email fullName role phone status')
      .sort({ fullName: 1 })
      .lean();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async updateByDirector(id: string, dto: UpdateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');

    const existing = await this.userModel
      .findById(id)
      .select('_id role')
      .lean();
    if (!existing) throw new NotFoundException('Khong tim thay nguoi dung');

    const update: any = {};
    const unset: Record<string, 1> = {};
    const nextRole = dto.role ?? existing.role;
    const isParent = nextRole === Role.PARENT;

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      await this.ensureEmailUnique(email, id);
      update.email = email;
    }

    if (dto.userCode !== undefined) {
      const userCode = this.normalizeUserCode(dto.userCode);
      if (!userCode) throw new BadRequestException('Ma tai khoan khong duoc de trong');
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
        throw new BadRequestException('Chi tai khoan phu huynh moi duoc gan sale phu trach');
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

    if (dto.password) {
      update.password = await this.hashPassword(dto.password);
    }

    if (Object.keys(unset).length) {
      update.$unset = unset;
    }

    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');

    if (isParent && dto.saleOwnerId !== undefined) {
      const saleOwner = await this.resolveSaleOwnerUser(dto.saleOwnerId);
      await this.syncParentStudentsSaleOwnership(id, saleOwner);
    }

    return user as any;
  }

  async updateOwnedParentBySale(id: string, dto: UpdateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.SALE) throw new ForbiddenException('Chi sale moi co quyen');

    if (dto.role !== undefined && dto.role !== Role.PARENT) {
      throw new ForbiddenException('Sale chi duoc sua tai khoan phu huynh');
    }
    if (dto.saleOwnerId !== undefined) {
      throw new ForbiddenException('Sale khong duoc chuyen phu huynh cho sale khac');
    }

    const ownership = await this.getParentOwnershipContext(id);
    if (ownership.ownershipSource === 'CONFLICT') {
      throw new ForbiddenException('Phu huynh nay dang gan nhieu sale, vui long nho giam doc chuan hoa');
    }
    if (ownership.ownerId !== actor.sub) {
      throw new ForbiddenException('Ban khong phu trach tai khoan phu huynh nay');
    }

    const update: any = {
      saleOwnerId: new Types.ObjectId(actor.sub),
      saleOwnerName: actor.fullName || ownership.ownerName || '',
    };
    const unset: Record<string, 1> = {};

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      await this.ensureEmailUnique(email, id);
      update.email = email;
    }

    if (dto.userCode !== undefined) {
      const userCode = this.normalizeUserCode(dto.userCode);
      if (!userCode) throw new BadRequestException('Ma tai khoan khong duoc de trong');
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

    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async lock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');
    if (actor.sub === id) throw new ForbiddenException('Khong the khoa chinh minh');
    const user = await this.userModel
      .findByIdAndUpdate(id, { status: UserStatus.LOCKED }, { new: true })
      .select('-password')
      .lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async unlock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { status: UserStatus.ACTIVE, failedLoginAttempts: 0, $unset: { lastFailedLoginAt: 1 } },
        { new: true },
      )
      .select('-password')
      .lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async removeByDirector(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');
    if (actor.sub === id) throw new ForbiddenException('Khong the xoa chinh minh');
    const deleted = await this.userModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Khong tim thay nguoi dung');
    return deleted as any;
  }
}
