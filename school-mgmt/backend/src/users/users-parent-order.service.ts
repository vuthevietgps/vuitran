import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, Types } from "mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import * as bcrypt from "bcrypt";
import { Role } from "../common/interfaces/role.enum";
import { UserStatus } from "../common/interfaces/user-status.enum";

@Injectable()
export class UsersParentOrderService {
  private readonly logger = new Logger(UsersParentOrderService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private withSession<T>(query: T, mongoSession?: ClientSession): T {
    return (mongoSession ? (query as any).session(mongoSession) : query) as T;
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

  private async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  private async generateParentUserCode(
    mongoSession?: ClientSession,
  ): Promise<string> {
    const prefix = "PH";
    const last = await this.withSession(
      this.userModel
        .findOne({ userCode: { $regex: `^${prefix}\\d+$` } })
        .select("userCode")
        .sort({ userCode: -1 })
        .lean(),
      mongoSession,
    );

    let nextNum = 1;
    const match = (last as any)?.userCode?.match?.(/^PH(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(4, "0")}`;
  }

  private async syncParentUserFromOrder(
    parentUserId: Types.ObjectId,
    order: any,
    mongoSession?: ClientSession,
  ): Promise<void> {
    const parent = await this.withSession(
      this.userModel
        .findById(parentUserId)
        .select(
          "fullName email phone userCode saleOwnerId address facebookLink",
        )
        .lean(),
      mongoSession,
    );

    if (!parent) {
      return;
    }

    const update: Record<string, any> = {};
    const normalizedEmail = this.normalizeOptionalText(
      order.parentEmail,
    )?.toLowerCase();
    const normalizedCode = this.normalizeUserCode(order.parentUserCode);
    const normalizedPhone = this.normalizeOptionalText(order.parentPhone);
    const normalizedName = this.normalizeOptionalText(order.parentName);
    const normalizedAddress = this.normalizeOptionalText(order.parentAddress);
    const normalizedFacebookLink = this.normalizeOptionalText(
      order.parentFacebookLink,
    );

    if (
      normalizedEmail &&
      (!parent.email || parent.email.endsWith("@school.local")) &&
      parent.email !== normalizedEmail
    ) {
      const existingEmailUser = await this.withSession(
        this.userModel.findOne({ email: normalizedEmail }).select("_id").lean(),
        mongoSession,
      );
      if (
        !existingEmailUser ||
        existingEmailUser._id.toString() === parentUserId.toString()
      ) {
        update.email = normalizedEmail;
      }
    }

    if (normalizedPhone && parent.phone !== normalizedPhone) {
      const existingPhoneUser = await this.withSession(
        this.userModel
          .findOne({ phone: normalizedPhone, role: "PARENT" })
          .select("_id")
          .lean(),
        mongoSession,
      );
      if (
        !existingPhoneUser ||
        existingPhoneUser._id.toString() === parentUserId.toString()
      ) {
        update.phone = normalizedPhone;
      }
    }

    if (normalizedName && parent.fullName !== normalizedName) {
      update.fullName = normalizedName;
    }

    if (!parent.userCode) {
      if (normalizedCode) {
        const existingCodeUser = await this.withSession(
          this.userModel
            .findOne({ userCode: normalizedCode })
            .select("_id")
            .lean(),
          mongoSession,
        );
        if (
          !existingCodeUser ||
          existingCodeUser._id.toString() === parentUserId.toString()
        ) {
          update.userCode = normalizedCode;
        }
      } else {
        update.userCode = await this.generateParentUserCode(mongoSession);
      }
    }

    if (normalizedAddress && parent.address !== normalizedAddress) {
      update.address = normalizedAddress;
    }

    if (normalizedFacebookLink && parent.facebookLink !== normalizedFacebookLink) {
      update.facebookLink = normalizedFacebookLink;
    }

    if (
      order?.saleId &&
      !parent.saleOwnerId &&
      Types.ObjectId.isValid(order.saleId.toString())
    ) {
      update.saleOwnerId = new Types.ObjectId(order.saleId.toString());
      update.saleOwnerName = order.saleName || "";
    }

    if (Object.keys(update).length) {
      await this.userModel.findByIdAndUpdate(parentUserId, update, {
        session: mongoSession || undefined,
      });
    }
  }

  async findOrCreateParentFromOrder(
    orderData: any,
    mongoSession?: ClientSession,
  ): Promise<string> {
    if (orderData.parentUserId) {
      const parentById = await this.withSession(
        this.userModel
          .findById(orderData.parentUserId)
          .select("_id role")
          .lean(),
        mongoSession,
      );

      if (!parentById) {
        throw new Error("Khong tim thay tai khoan phu huynh tu parentUserId");
      }
      if ((parentById as any).role !== Role.PARENT) {
        throw new Error("parentUserId khong phai tai khoan PHU HUYNH");
      }

      const parentId = new Types.ObjectId((parentById as any)._id);
      await this.syncParentUserFromOrder(parentId, orderData, mongoSession);
      return parentId.toString();
    }

    const parentUserCode = this.normalizeUserCode(orderData.parentUserCode);
    if (parentUserCode) {
      const parentByCode = await this.withSession(
        this.userModel
          .findOne({ userCode: parentUserCode })
          .select("_id role")
          .lean(),
        mongoSession,
      );

      if (parentByCode) {
        if ((parentByCode as any).role !== Role.PARENT) {
          throw new Error(
            `Ma tai khoan ${parentUserCode} da ton tai nhung khong phai tai khoan PHU HUYNH`,
          );
        }
        const parentId = new Types.ObjectId((parentByCode as any)._id);
        await this.syncParentUserFromOrder(parentId, orderData, mongoSession);
        return parentId.toString();
      }
    }

    const email = this.normalizeEmail(orderData.parentEmail || "");
    if (email) {
      const userByEmail = await this.withSession(
        this.userModel.findOne({ email }).select("_id role").lean(),
        mongoSession,
      );

      if (userByEmail?._id) {
        if ((userByEmail as any).role !== Role.PARENT) {
          throw new Error(
            `Email ${email} da ton tai nhung khong phai tai khoan PHU HUYNH`,
          );
        }
        const parentId = new Types.ObjectId(userByEmail._id);
        await this.syncParentUserFromOrder(parentId, orderData, mongoSession);
        return parentId.toString();
      }
    }

    const phone = this.normalizeOptionalText(orderData.parentPhone);
    if (!phone) {
      throw new Error(
        "Khong xac dinh duoc tai khoan PHU HUYNH. Vui long bo sung parentUserId hoac tao user PARENT truoc khi duyet don",
      );
    }

    const parentByPhone = await this.withSession(
      this.userModel
        .find({ phone, role: Role.PARENT })
        .select("_id email userCode")
        .lean(),
      mongoSession,
    );

    let narrowedParents = parentByPhone;
    if (email && narrowedParents.length > 1) {
      const exactEmailMatches = narrowedParents.filter(
        (parent: any) => parent.email === email,
      );
      if (exactEmailMatches.length === 1) {
        narrowedParents = exactEmailMatches;
      }
    }
    if (parentUserCode && narrowedParents.length > 1) {
      const exactCodeMatches = narrowedParents.filter(
        (parent: any) => parent.userCode === parentUserCode,
      );
      if (exactCodeMatches.length === 1) {
        narrowedParents = exactCodeMatches;
      }
    }

    if (narrowedParents.length === 1) {
      const parentId = new Types.ObjectId(narrowedParents[0]._id);
      await this.syncParentUserFromOrder(parentId, orderData, mongoSession);
      return parentId.toString();
    }

    if (narrowedParents.length > 1) {
      throw new Error("Tim thay nhieu tai khoan phu huynh trung so dien thoai");
    }

    const normalizedPhoneDigits = phone.replace(/\D/g, "");
    const preferredEmail =
      email || `parent.${normalizedPhoneDigits}@school.local`;
    const existingPreferredEmail = await this.withSession(
      this.userModel
        .findOne({ email: preferredEmail })
        .select("_id role")
        .lean(),
      mongoSession,
    );

    if (existingPreferredEmail) {
      if ((existingPreferredEmail as any).role !== Role.PARENT) {
        throw new Error(
          `Email ${preferredEmail} da ton tai nhung khong phai tai khoan PHU HUYNH`,
        );
      }
      const parentId = new Types.ObjectId((existingPreferredEmail as any)._id);
      await this.syncParentUserFromOrder(parentId, orderData, mongoSession);
      return parentId.toString();
    }

    const hashedPassword = await this.hashPassword("123456");
    const generatedUserCode =
      parentUserCode || (await this.generateParentUserCode(mongoSession));
    const parentUser = new this.userModel({
      email: preferredEmail,
      userCode: generatedUserCode,
      password: hashedPassword,
      fullName:
        this.normalizeOptionalText(orderData.parentName) ||
        `Phu huynh ${normalizedPhoneDigits}`,
      role: Role.PARENT,
      phone,
      status: UserStatus.ACTIVE,
      saleOwnerId:
        orderData?.saleId && Types.ObjectId.isValid(orderData.saleId.toString())
          ? new Types.ObjectId(orderData.saleId.toString())
          : undefined,
      saleOwnerName: orderData?.saleName || undefined,
      address: this.normalizeOptionalText(orderData.parentAddress),
      facebookLink: this.normalizeOptionalText(orderData.parentFacebookLink),
    });

    const savedParent = mongoSession
      ? await parentUser.save({ session: mongoSession })
      : await parentUser.save();

    this.logger.log(
      `Auto-created PARENT user ${preferredEmail} from order ${orderData.orderCode || orderData._id}`,
    );

    return new Types.ObjectId((savedParent as any)._id).toString();
  }
}
