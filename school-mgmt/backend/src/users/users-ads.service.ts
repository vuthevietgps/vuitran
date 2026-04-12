import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { UpdateParentAdsAttributionDto } from "./dto/update-parent-ads-attribution.dto";
import { Role } from "../common/interfaces/role.enum";
import { UserStatus } from "../common/interfaces/user-status.enum";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import {
  ParentAttribution,
  ParentAttributionDocument,
  ParentAttributionModel,
  ParentAttributionSourceType,
} from "../marketing-attribution/schemas/parent-attribution.schema";
import { MarketingAttributionService } from "../marketing-attribution/marketing-attribution.service";
import { normalizePhone } from "../marketing-attribution/parent-attribution.util";
import { AdGroup, AdGroupDocument } from "../ads/schemas/ad-group.schema";
import { Student, StudentDocument } from "../students/schemas/student.schema";

@Injectable()
export class UsersAdsService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(ParentAttribution.name)
    private readonly parentAttributionModel: Model<ParentAttributionDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly marketingAttributionService: MarketingAttributionService,
  ) {}

  private async findParentUserOrThrow(id: string): Promise<any> {
    const user = await this.userModel
      .findById(id)
      .select("_id fullName email role phone")
      .lean();
    if (!user) throw new NotFoundException("Khong tim thay nguoi dung");
    if (user.role !== Role.PARENT) {
      throw new BadRequestException(
        "Chi ho tro gan nhom quang cao cho tai khoan PHU HUYNH",
      );
    }
    return user;
  }

  private async findBestParentAttribution(parentUser: any): Promise<{
    doc: any | null;
    matchedBy: "PARENT_USER" | "PHONE_FALLBACK" | "UNASSIGNED";
  }> {
    const conditions: any[] = [
      { parentUserId: new Types.ObjectId(parentUser._id) },
    ];
    const normalizedParentPhone = normalizePhone(parentUser.phone);
    if (normalizedParentPhone) {
      conditions.push({ normalizedParentPhone });
    }

    const docs = await this.parentAttributionModel
      .find({ $or: conditions })
      .select(
        "parentKey parentUserId normalizedParentPhone adGroupId adGroupName platform attributionModel sourceType firstAttributedAt lastConfirmedAt notes",
      )
      .sort({ lastConfirmedAt: -1, updatedAt: -1, createdAt: -1 })
      .lean();

    if (!docs.length) {
      return { doc: null, matchedBy: "UNASSIGNED" };
    }

    const directMatch = docs.find(
      (doc: any) =>
        doc.parentUserId?.toString?.() === parentUser._id.toString(),
    );

    return {
      doc: directMatch || docs[0],
      matchedBy: directMatch ? "PARENT_USER" : "PHONE_FALLBACK",
    };
  }

  async enrichUsersWithAdsAttribution(users: any[]): Promise<any[]> {
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
    if (parentUserIds.length)
      conditions.push({ parentUserId: { $in: parentUserIds } });
    if (normalizedPhones.length)
      conditions.push({ normalizedParentPhone: { $in: normalizedPhones } });
    if (!conditions.length) return users;

    const attributions = await this.parentAttributionModel
      .find({ $or: conditions })
      .select(
        "parentUserId normalizedParentPhone adGroupId adGroupName platform sourceType lastConfirmedAt",
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
      const attribution =
        (ownerId ? byUserId.get(ownerId) : null) ||
        (normalizedPhone ? byPhone.get(normalizedPhone) : null);

      return {
        ...user,
        adGroupId: attribution?.adGroupId?.toString?.() || null,
        adGroupName: attribution?.adGroupName || "",
        adPlatform: attribution?.platform || "",
        adAttributionSource: attribution?.sourceType || null,
      };
    });
  }

  async findParentSupportDirectory(
    parentUserId: string,
  ): Promise<Partial<User>[]> {
    const parentObjectId = new Types.ObjectId(parentUserId);
    const students = await this.studentModel
      .find({ parentUserId: parentObjectId })
      .select("saleId")
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
      $or: [{ role: Role.DIRECTOR }, { role: Role.OPS }],
    };

    if (saleIds.length) {
      query.$or.push({
        role: Role.SALE,
        _id: { $in: saleIds },
      });
    }

    return this.userModel
      .find(query)
      .select("userCode email fullName role phone status")
      .sort({ role: 1, fullName: 1 })
      .lean();
  }

  async getParentAdsAttribution(id: string) {
    const parentUser = await this.findParentUserOrThrow(id);
    const { doc, matchedBy } = await this.findBestParentAttribution(parentUser);

    return {
      parentUserId: parentUser._id.toString(),
      parentName: parentUser.fullName,
      parentPhone: parentUser.phone || "",
      parentKey: doc?.parentKey || null,
      adGroupId: doc?.adGroupId?.toString?.() || null,
      adGroupName: doc?.adGroupName || "",
      platform: doc?.platform || "",
      attributionModel: doc?.attributionModel || null,
      sourceType: doc?.sourceType || null,
      firstAttributedAt: doc?.firstAttributedAt || null,
      lastConfirmedAt: doc?.lastConfirmedAt || null,
      notes: doc?.notes || "",
      matchedBy,
    };
  }

  async updateParentAdsAttribution(
    id: string,
    dto: UpdateParentAdsAttributionDto,
    actor: JwtPayload,
  ) {
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");

    const parentUser = await this.findParentUserOrThrow(id);
    const adGroup = await this.adGroupModel
      .findById(dto.adGroupId)
      .select("_id name platform")
      .lean();
    if (!adGroup) {
      throw new NotFoundException("Khong tim thay nhom quang cao");
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
    if (actor.role !== Role.DIRECTOR)
      throw new ForbiddenException("Chi giam doc moi co quyen");

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
}
