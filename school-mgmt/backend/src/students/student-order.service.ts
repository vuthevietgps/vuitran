import {
  Injectable,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, Types } from "mongoose";
import { Student, StudentDocument } from "./schemas/student.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Role } from "../common/interfaces/role.enum";

type StudentLean = Student & { _id: Types.ObjectId };

@Injectable()
export class StudentOrderService {
  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private withSession<T>(query: T, mongoSession?: ClientSession): T {
    return (mongoSession ? (query as any).session(mongoSession) : query) as T;
  }

  private toObjectId(value?: string | Types.ObjectId | null): Types.ObjectId | null {
    if (!value) return null;
    if (value instanceof Types.ObjectId) return value;
    if (!Types.ObjectId.isValid(value)) return null;
    return new Types.ObjectId(value);
  }

  private mergeParentLinks(existing: any, parentUserId: Types.ObjectId): Types.ObjectId[] {
    const links = new Map<string, Types.ObjectId>();
    const add = (value?: string | Types.ObjectId | null) => {
      const objectId = this.toObjectId(value);
      if (objectId) {
        links.set(objectId.toString(), objectId);
      }
    };

    add(existing?.parentUserId);
    if (Array.isArray(existing?.parentUserIds)) {
      for (const value of existing.parentUserIds) {
        add(value);
      }
    }
    add(parentUserId);

    return Array.from(links.values());
  }

  private normalizeOptionalText(value?: string | null): string | undefined {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized || undefined;
  }

  private async validateParentUser(
    parentUserId?: string,
    mongoSession?: ClientSession,
  ) {
    if (!parentUserId) return;
    if (!Types.ObjectId.isValid(parentUserId)) {
      throw new BadRequestException("Ma phu huynh khong hop le");
    }

    const parent = await this.withSession(
      this.userModel.findById(parentUserId).select("_id role").lean(),
      mongoSession,
    );

    if (!parent || (parent as any).role !== Role.PARENT) {
      throw new BadRequestException("Ma phu huynh khong ton tai hoac sai role");
    }
  }

  private getPrimaryOrderItem(order: any): any | null {
    if (!Array.isArray(order?.items) || !order.items.length) {
      return null;
    }
    return order.items[0];
  }

  private deriveBirthMonth(
    explicitMonth?: number | null,
    dateLike?: Date | string | null,
  ): number | undefined {
    if (explicitMonth && explicitMonth >= 1 && explicitMonth <= 12) {
      return explicitMonth;
    }

    if (!dateLike) {
      return undefined;
    }

    const parsed = new Date(dateLike);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed.getMonth() + 1;
  }

  private derivePreferredTeachingMode(
    order: any,
  ): "ONLINE" | "OFFLINE" | "BOTH" {
    const modes = Array.from(
      new Set(
        (Array.isArray(order?.items) ? order.items : [])
          .map((item: any) => String(item?.teachingMode || "").toUpperCase())
          .filter((mode: string) => mode === "ONLINE" || mode === "OFFLINE"),
      ),
    );

    if (modes.length === 1) {
      return modes[0] as "ONLINE" | "OFFLINE";
    }
    return "BOTH";
  }

  private deriveStudentLearningNeeds(order: any): string | undefined {
    const notes = [
      this.normalizeOptionalText(order?.consultationNotes),
      ...(Array.isArray(order?.items)
        ? order.items
            .flatMap((item: any) => [
              this.normalizeOptionalText(item?.learningGoals),
              this.normalizeOptionalText(item?.notes),
            ])
            .filter((value: string | undefined): value is string => !!value)
        : []),
    ].filter((value): value is string => !!value);

    if (!notes.length) {
      return undefined;
    }

    return Array.from(new Set(notes)).join(" | ");
  }

  private deriveStudentSubjects(order: any): string[] | undefined {
    const subjects = Array.isArray(order?.items)
      ? order.items
          .map((item: any) => this.normalizeOptionalText(item?.subject))
          .filter((value: string | undefined): value is string => !!value)
      : [];

    if (!subjects.length) {
      return undefined;
    }

    return Array.from(new Set(subjects));
  }

  private deriveStudentAge(order: any): number {
    if (Number.isFinite(order?.studentAge)) {
      return Math.max(3, Math.min(25, Number(order.studentAge)));
    }

    if (order?.studentDob) {
      return this.calculateAge(order.studentDob);
    }

    return 10;
  }

  private buildStudentUpdatePatch(
    order: any,
    parentUserId: Types.ObjectId,
    existingStudent?: any,
  ): Record<string, any> {
    const primaryItem = this.getPrimaryOrderItem(order);
    const preferredTeachingMode = this.derivePreferredTeachingMode(order);
    const learningNeeds = this.deriveStudentLearningNeeds(order);
    const subjects = this.deriveStudentSubjects(order);
    const faceImage = this.normalizeOptionalText(order?.studentFaceImage);
    const studentBirthMonth = this.deriveBirthMonth(
      order?.studentBirthMonth,
      order?.studentDob,
    );
    const parentBirthMonth = this.deriveBirthMonth(
      order?.parentBirthMonth,
      null,
    );
    const productPackageId =
      primaryItem?.productId && Types.ObjectId.isValid(primaryItem.productId)
        ? new Types.ObjectId(primaryItem.productId)
        : undefined;

    const patch: Record<string, any> = {
      orderId: order._id,
      parentUserId,
    };

    const normalizedStudentName = this.normalizeOptionalText(order?.studentName);
    if (normalizedStudentName && !existingStudent?.fullName) {
      patch.fullName = normalizedStudentName;
    }

    const normalizedParentName = this.normalizeOptionalText(order?.parentName);
    if (normalizedParentName && existingStudent?.parentName !== normalizedParentName) {
      patch.parentName = normalizedParentName;
    }
    const normalizedParentPhone = this.normalizeOptionalText(order?.parentPhone);
    if (normalizedParentPhone && existingStudent?.parentPhone !== normalizedParentPhone) {
      patch.parentPhone = normalizedParentPhone;
    }
    const normalizedGrade = this.normalizeOptionalText(order?.studentGrade);
    if (normalizedGrade && existingStudent?.grade !== normalizedGrade) {
      patch.grade = normalizedGrade;
    }
    const normalizedLevel = this.normalizeOptionalText(order?.studentLevel);
    if (normalizedLevel && existingStudent?.level !== normalizedLevel) {
      patch.level = normalizedLevel;
    }
    const derivedAge = this.deriveStudentAge(order);
    if (derivedAge && existingStudent?.age !== derivedAge) {
      patch.age = derivedAge;
    }
    if (studentBirthMonth && existingStudent?.studentBirthMonth !== studentBirthMonth) {
      patch.studentBirthMonth = studentBirthMonth;
    }
    if (parentBirthMonth && existingStudent?.parentBirthMonth !== parentBirthMonth) {
      patch.parentBirthMonth = parentBirthMonth;
    }
    if (
      faceImage &&
      existingStudent?.faceImage !== faceImage
    ) {
      patch.faceImage = faceImage;
    }
    if (!existingStudent?.productPackage && productPackageId) {
      patch.productPackage = productPackageId;
    }
    if (!existingStudent?.preferredTeachingMode) {
      patch.preferredTeachingMode = preferredTeachingMode;
    }
    if (preferredTeachingMode !== "BOTH" && !existingStudent?.studentType) {
      patch.studentType = preferredTeachingMode;
    }
    if (!existingStudent?.learningNeeds && learningNeeds) {
      patch.learningNeeds = learningNeeds;
    }
    if (
      (!Array.isArray(existingStudent?.subjects) ||
        !existingStudent.subjects.length) &&
      subjects?.length
    ) {
      patch.subjects = subjects;
    }
    if (
      order?.saleId &&
      !existingStudent?.saleId &&
      Types.ObjectId.isValid(order.saleId.toString())
    ) {
      patch.saleId = new Types.ObjectId(order.saleId.toString());
      patch.saleName = order.saleName || existingStudent?.saleName;
    }
    if (order?.adGroupId && !existingStudent?.adGroupId) {
      patch.adGroupId = order.adGroupId;
      patch.adGroupName = order.adGroupName || undefined;
    }

    return patch;
  }

  private async resolveStudentCode(
    order: any,
    mongoSession?: ClientSession,
  ): Promise<string> {
    const preferredStudentCode = this.normalizeOptionalText(
      order?.studentCode,
    )?.toUpperCase();
    if (!preferredStudentCode) {
      return this.generateStudentCode(mongoSession);
    }

    const existingQuery = this.studentModel
      .findOne({ studentCode: preferredStudentCode })
      .select("_id");

    if (mongoSession) {
      existingQuery.session(mongoSession);
    }

    const existing = await existingQuery.lean();
    if (existing) {
      throw new ConflictException("Ma hoc sinh da ton tai");
    }

    return preferredStudentCode;
  }

  private async generateStudentCode(
    mongoSession?: ClientSession,
  ): Promise<string> {
    const prefix = "HS";
    const query = this.studentModel
      .findOne({ studentCode: { $regex: `^${prefix}\\d+$` } })
      .sort({ studentCode: -1 });

    if (mongoSession) {
      query.session(mongoSession);
    }

    const last = await query.lean();
    let nextNum = 1;
    const match = (last as any)?.studentCode?.match?.(/^HS(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }

    return `${prefix}${String(nextNum).padStart(3, "0")}`;
  }

  private calculateAge(dob: Date | string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return Math.max(3, Math.min(25, age));
  }

  async findOrCreateStudentFromOrder(
    orderData: any,
    parentUserId: string,
    approver: JwtPayload,
    mongoSession?: ClientSession,
  ): Promise<{
    studentId: string;
    studentCode: string;
    isNew: boolean;
  }> {
    await this.validateParentUser(parentUserId, mongoSession);

    const parentObjectId = new Types.ObjectId(parentUserId);
    const primaryItem = this.getPrimaryOrderItem(orderData);
    const requestedStudentCode = this.normalizeOptionalText(
      orderData?.studentCode,
    )?.toUpperCase();

    if (orderData.existingStudentId) {
      const existing = await this.withSession(
        this.studentModel.findById(orderData.existingStudentId).lean(),
        mongoSession,
      );

      if (existing) {
        if (
          requestedStudentCode &&
          requestedStudentCode !==
            String((existing as any).studentCode || "")
              .trim()
              .toUpperCase()
        ) {
          throw new ConflictException(
            "Ma hoc sinh khong khop voi hoc sinh da lien ket",
          );
        }
        const existingParentUserId = (existing as any).parentUserId?.toString();
        if (
          existingParentUserId &&
          existingParentUserId !== parentUserId.toString()
        ) {
          throw new Error("Hoc vien da duoc gan cho phu huynh khac");
        }

        const patch = this.buildStudentUpdatePatch(
          orderData,
          parentObjectId,
          existing,
        );
        if (!existingParentUserId) {
          patch.parentUserId = parentObjectId;
        }
        patch.parentUserIds = this.mergeParentLinks(existing, parentObjectId);

        await this.studentModel.findByIdAndUpdate(
          (existing as any)._id,
          patch,
          { session: mongoSession || undefined },
        );

        return {
          studentId: (existing as any)._id.toString(),
          studentCode: (existing as any).studentCode,
          isNew: false,
        };
      }
    }

    const existingByPhone = await this.withSession(
      this.studentModel
        .findOne({
          parentPhone: orderData.parentPhone,
          fullName: orderData.studentName,
        })
        .lean(),
      mongoSession,
    );

    if (existingByPhone) {
      if (
        requestedStudentCode &&
        requestedStudentCode !==
          String((existingByPhone as any).studentCode || "")
            .trim()
            .toUpperCase()
      ) {
        throw new ConflictException(
          "Ma hoc sinh khong khop voi hoc sinh trung thong tin phu huynh",
        );
      }
      const existingParentUserId = (
        existingByPhone as any
      ).parentUserId?.toString();
      if (
        existingParentUserId &&
        existingParentUserId !== parentUserId.toString()
      ) {
        throw new Error("Hoc vien da duoc gan cho phu huynh khac");
      }

      const patch = this.buildStudentUpdatePatch(
        orderData,
        parentObjectId,
        existingByPhone,
      );
      if (!existingParentUserId) {
        patch.parentUserId = parentObjectId;
      }
      patch.parentUserIds = this.mergeParentLinks(existingByPhone, parentObjectId);

      await this.studentModel.findByIdAndUpdate(
        (existingByPhone as any)._id,
        patch,
        { session: mongoSession || undefined },
      );

      return {
        studentId: (existingByPhone as any)._id.toString(),
        studentCode: (existingByPhone as any).studentCode,
        isNew: false,
      };
    }

    const studentCode = await this.resolveStudentCode(orderData, mongoSession);
    const preferredTeachingMode = this.derivePreferredTeachingMode(orderData);
    const learningNeeds = this.deriveStudentLearningNeeds(orderData);
    const subjects = this.deriveStudentSubjects(orderData);
    const productPackageId =
      primaryItem?.productId && Types.ObjectId.isValid(primaryItem.productId)
        ? new Types.ObjectId(primaryItem.productId)
        : undefined;
    const saleId =
      orderData?.saleId && Types.ObjectId.isValid(orderData.saleId.toString())
        ? new Types.ObjectId(orderData.saleId.toString())
        : undefined;

    const student = new this.studentModel({
      studentCode,
      fullName: orderData.studentName,
      age: this.deriveStudentAge(orderData),
      studentBirthMonth: this.deriveBirthMonth(
        orderData.studentBirthMonth,
        orderData.studentDob,
      ),
      parentBirthMonth: this.deriveBirthMonth(orderData.parentBirthMonth, null),
      parentName: orderData.parentName,
      parentPhone: orderData.parentPhone,
      parentUserId: parentObjectId,
      parentUserIds: [parentObjectId],
      faceImage:
        this.normalizeOptionalText(orderData.studentFaceImage) ||
        "default-avatar.png",
      productPackage: productPackageId,
      learningNeeds,
      subjects,
      grade: orderData.studentGrade || undefined,
      level: this.normalizeOptionalText(orderData.studentLevel),
      preferredTeachingMode,
      studentType:
        preferredTeachingMode !== "BOTH" ? preferredTeachingMode : undefined,
      saleId,
      saleName: orderData.saleName || undefined,
      orderId: orderData._id,
      adGroupId: orderData.adGroupId || undefined,
      adGroupName: orderData.adGroupName || undefined,
      approvalStatus: "APPROVED",
      approvedBy: new Types.ObjectId(approver._id),
      approvedAt: new Date(),
    });

    const saved = await student.save(
      mongoSession ? { session: mongoSession } : {},
    );

    return {
      studentId: (saved as any)._id.toString(),
      studentCode,
      isNew: true,
    };
  }
}
