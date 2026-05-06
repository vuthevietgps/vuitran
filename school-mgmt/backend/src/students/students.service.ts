import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { ClientSession, Model, Types, Connection } from "mongoose";
import { Student, StudentDocument } from "./schemas/student.schema";
import {
  Attendance,
  AttendanceDocument,
} from "../attendance/schemas/attendance.schema";
import { Classroom, ClassroomDocument } from "../classes/schemas/class.schema";
import { Session, SessionDocument } from "../sessions/schemas/session.schema";
import { User, UserDocument } from "../users/schemas/user.schema";
import { JwtPayload } from "../common/interfaces/jwt-payload.interface";
import { Role } from "../common/interfaces/role.enum";
import { StudentOrderService } from "./student-order.service";
import { StudentReportService } from "./student-report.service";

type StudentLean = Student & { _id: Types.ObjectId };

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name)
    private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly studentOrderService: StudentOrderService,
    private readonly studentReportService: StudentReportService,
  ) {}

  private getActorId(actor?: JwtPayload): string | null {
    return actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
  }

  private toObjectId(value?: string | Types.ObjectId | null): Types.ObjectId | null {
    if (!value) return null;
    if (value instanceof Types.ObjectId) return value;
    if (!Types.ObjectId.isValid(value)) return null;
    return new Types.ObjectId(value);
  }

  private normalizeParentLinks(input: {
    parentUserId?: string | Types.ObjectId | null;
    parentUserIds?: Array<string | Types.ObjectId | null | undefined>;
    existing?: any;
  }): { parentUserId?: Types.ObjectId; parentUserIds?: Types.ObjectId[] } {
    const primaryFromExisting = this.toObjectId(input.existing?.parentUserId);
    const existingParentUserIds = Array.isArray(input.existing?.parentUserIds)
      ? input.existing.parentUserIds
          .map((value: any) => this.toObjectId(value))
          .filter((value): value is Types.ObjectId => !!value)
      : [];
    const primaryFromInput = this.toObjectId(input.parentUserId);
    const inputParentUserIds = Array.isArray(input.parentUserIds)
      ? input.parentUserIds
          .map((value) => this.toObjectId(value))
          .filter((value): value is Types.ObjectId => !!value)
      : [];

    const parentUserId = primaryFromInput || primaryFromExisting || undefined;
    const merged = new Map<string, Types.ObjectId>();
    const add = (value?: Types.ObjectId | null) => {
      if (!value) return;
      merged.set(value.toString(), value);
    };

    add(primaryFromExisting);
    existingParentUserIds.forEach(add);
    add(primaryFromInput);
    inputParentUserIds.forEach(add);
    if (parentUserId) add(parentUserId);

    return {
      parentUserId,
      parentUserIds: Array.from(merged.values()),
    };
  }

  findAll(actor?: JwtPayload) {
    return this.getStudentList(actor);
  }

  private async getStudentList(actor?: JwtPayload) {
    const actorId = this.getActorId(actor);
    const isSale = actor?.role === Role.SALE;
    const saleOid = isSale && actorId ? new Types.ObjectId(actorId) : undefined;

    const isParent = actor?.role === Role.PARENT;
    const parentOid =
      isParent && actorId ? new Types.ObjectId(actorId) : undefined;

    const studentFilter: any = {};
    if (saleOid) studentFilter.saleId = saleOid;
    if (parentOid) {
      studentFilter.$or = [
        { parentUserId: parentOid },
        { parentUserIds: parentOid },
      ];
    }

    const studentsFromDb = await this.studentModel
      .find(studentFilter)
      .populate("productPackage", "name price")
      .sort({ createdAt: -1 })
      .lean<StudentLean[]>();

    return studentsFromDb
      .map((student) => this.mapStudentDocument(student))
      .sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "vi", { sensitivity: "base" }),
      );
  }

  private mapStudentDocument(student: StudentLean) {
    const productPackage = student.productPackage as any;
    return {
      _id: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
      age: student.age,
      grade: student.grade,
      level: (student as any).level,
      studentBirthMonth: student.studentBirthMonth,
      parentBirthMonth: student.parentBirthMonth,
      parentUserId: student.parentUserId?.toString?.() || "",
      parentUserIds: Array.isArray((student as any).parentUserIds)
        ? (student as any).parentUserIds
            .map((value: any) => value?.toString?.() || "")
            .filter(Boolean)
        : student.parentUserId?.toString?.()
          ? [student.parentUserId.toString()]
          : [],
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      saleId: student.saleId?.toString?.() || "",
      saleName: student.saleName || "",
      faceImage: student.faceImage,
      approvalStatus: (student as any).approvalStatus || "PENDING",
      productPackage:
        productPackage && typeof productPackage === "object"
          ? {
              _id:
                productPackage._id?.toString?.() ?? productPackage.toString(),
              name: productPackage.name,
              price: productPackage.price,
            }
          : undefined,
    };
  }

  private async validateParentUser(parentUserId?: string) {
    if (!parentUserId) return;
    if (!Types.ObjectId.isValid(parentUserId)) {
      throw new BadRequestException("Ma phu huynh khong hop le");
    }

    const parent = await this.userModel
      .findById(parentUserId)
      .select("_id role")
      .lean();

    if (!parent || (parent as any).role !== Role.PARENT) {
      throw new BadRequestException("Ma phu huynh khong ton tai hoac sai role");
    }
  }

  async findOrCreateStudentFromOrder(
    orderData: any,
    parentUserId: string,
    approver: JwtPayload,
    mongoSession?: ClientSession,
  ) {
    return this.studentOrderService.findOrCreateStudentFromOrder(
      orderData,
      parentUserId,
      approver,
      mongoSession,
    );
  }

  async getStudentReport(
    classId?: string,
    searchTerm?: string,
    actor?: JwtPayload,
    page?: number,
    limit?: number,
  ) {
    return this.studentReportService.getStudentReport(
      classId,
      searchTerm,
      actor,
      page,
      limit,
    );
  }

  async getStudentReportClasses(
    searchTerm?: string,
    actor?: JwtPayload,
    limit?: number,
    classMode?: 'ONLINE' | 'OFFLINE',
  ) {
    return this.studentReportService.getStudentReportClasses(
      searchTerm,
      actor,
      limit,
      classMode,
    );
  }

  async getComprehensiveReport(
    classId?: string,
    searchTerm?: string,
    actor?: JwtPayload,
    saleId?: string,
    dataStatus?: string,
    page?: number,
    limit?: number,
    classMode?: 'ONLINE' | 'OFFLINE',
  ) {
    return this.studentReportService.getComprehensiveReport(
      classId,
      searchTerm,
      actor,
      saleId,
      dataStatus,
      page,
      limit,
      classMode,
    );
  }

  async getComprehensiveReportClasses(
    searchTerm?: string,
    actor?: JwtPayload,
    limit?: number,
    classMode?: 'ONLINE' | 'OFFLINE',
  ) {
    return this.studentReportService.getComprehensiveReportClasses(
      searchTerm,
      actor,
      limit,
      classMode,
    );
  }

  async create(createStudentDto: any, actor?: JwtPayload) {
    delete createStudentDto.payments;
    await this.validateParentUser(createStudentDto.parentUserId);
    const parentLinks = this.normalizeParentLinks(createStudentDto);
    if (parentLinks.parentUserId) {
      createStudentDto.parentUserId = parentLinks.parentUserId;
    }
    if (parentLinks.parentUserIds) {
      createStudentDto.parentUserIds = parentLinks.parentUserIds;
    }

    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (!actorId) {
        throw new ForbiddenException("Khong xac dinh duoc sale");
      }
      createStudentDto.saleId = actorId;
      createStudentDto.saleName = actor.fullName || "";
    }
    const student = new this.studentModel(createStudentDto);
    return student.save();
  }

  async update(id: string, updateStudentDto: any, actor?: JwtPayload) {
    const existing = await this.studentModel
      .findById(id)
      .select("saleId parentUserId parentUserIds");
    if (!existing) {
      throw new NotFoundException("Hoc sinh khong ton tai");
    }

    if (updateStudentDto.parentUserId !== undefined) {
      await this.validateParentUser(updateStudentDto.parentUserId);
    }
    if (updateStudentDto.parentUserIds !== undefined) {
      for (const parentUserId of updateStudentDto.parentUserIds || []) {
        await this.validateParentUser(parentUserId);
      }
    }

    delete updateStudentDto.payments;
    const parentLinks = this.normalizeParentLinks({
      parentUserId: updateStudentDto.parentUserId,
      parentUserIds: updateStudentDto.parentUserIds,
      existing,
    });
    if (parentLinks.parentUserId) {
      updateStudentDto.parentUserId = parentLinks.parentUserId;
    }
    if (parentLinks.parentUserIds) {
      updateStudentDto.parentUserIds = parentLinks.parentUserIds;
    }

    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (!actorId) {
        throw new ForbiddenException("Khong xac dinh duoc sale");
      }
      if (existing.saleId?.toString() !== actorId) {
        throw new ForbiddenException("Ban khong phu trach hoc sinh nay");
      }
      if (updateStudentDto.saleId && updateStudentDto.saleId !== actorId) {
        throw new ForbiddenException(
          "SALE khong duoc chuyen ownership hoc sinh",
        );
      }
      updateStudentDto.saleId = actorId;
      if (!updateStudentDto.saleName) {
        updateStudentDto.saleName = actor.fullName || "";
      }
    }

    return this.studentModel.findByIdAndUpdate(id, updateStudentDto, {
      new: true,
    });
  }

  async remove(id: string) {
    const existingStudent = await this.studentModel.findById(id);
    if (!existingStudent) return { deletedCount: 0 };

    const activeSessions = await this.sessionModel.countDocuments({
      studentId: new Types.ObjectId(id),
      status: { $in: ["SCHEDULED", "TEACHER_COMPLETED", "PARENT_CONFIRMED"] },
    });
    if (activeSessions > 0) {
      throw new BadRequestException(
        `Không thể xóa học sinh đang có ${activeSessions} buổi học chưa hoàn tất`,
      );
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const studentObjectId = new Types.ObjectId(id);

        const activeSessionsInTx = await this.sessionModel
          .countDocuments({
            studentId: studentObjectId,
            status: {
              $in: ["SCHEDULED", "TEACHER_COMPLETED", "PARENT_CONFIRMED"],
            },
          })
          .session(session);
        if (activeSessionsInTx > 0) {
          throw new BadRequestException(
            `Không thể xóa học sinh đang có ${activeSessionsInTx} buổi học chưa hoàn tất`,
          );
        }

        await this.classroomModel.updateMany(
          { students: studentObjectId },
          { $pull: { students: studentObjectId } },
          { session },
        );

        await this.attendanceModel.deleteMany(
          { studentId: studentObjectId },
          { session },
        );

        await this.studentModel.findByIdAndDelete(id, { session });
      });

      this.logger.log(
        `Student ${id} deleted successfully (atomic transaction)`,
      );
      return { deletedCount: 1 };
    } finally {
      await session.endSession();
    }
  }

  async findOne(id: string, actor?: JwtPayload) {
    const student = await this.studentModel
      .findById(id)
      .populate("productPackage", "name price");
    if (!student) {
      throw new NotFoundException("Hoc sinh khong ton tai");
    }

    const actorId = this.getActorId(actor);

    if (actor?.role === Role.PARENT) {
      const linkedParentIds = [
        student.parentUserId?.toString(),
        ...(Array.isArray((student as any).parentUserIds)
          ? (student as any).parentUserIds.map((value: any) => value?.toString?.())
          : []),
      ].filter((value): value is string => !!value);
      if (!actorId || !linkedParentIds.includes(actorId)) {
        throw new NotFoundException("Hoc sinh khong ton tai");
      }
    }

    if (actor?.role === Role.SALE) {
      if (!actorId || student.saleId?.toString() !== actorId) {
        throw new NotFoundException("Hoc sinh khong ton tai");
      }
    }

    return student;
  }

  async approve(id: string, action: "APPROVE" | "REJECT", userId: string) {
    const student = await this.studentModel.findById(id);
    if (!student) throw new NotFoundException("Học sinh không tồn tại");
    if (student.approvalStatus !== "PENDING") {
      throw new BadRequestException("Học sinh đã được xử lý trước đó");
    }
    const updateData: any = {
      approvalStatus: action === "APPROVE" ? "APPROVED" : "REJECTED",
      approvedBy: userId,
      approvedAt: new Date(),
    };
    return this.studentModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async findPendingApproval() {
    return this.studentModel
      .find({ approvalStatus: "PENDING" })
      .populate("productPackage", "name price")
      .sort({ createdAt: -1 });
  }

  /** @deprecated Dangerous — disabled. Use individual delete instead. */
  async clearAllStudentData() {
    throw new ForbiddenException(
      "Bulk deletion is disabled. Please delete students individually to ensure data integrity.",
    );
  }
}
