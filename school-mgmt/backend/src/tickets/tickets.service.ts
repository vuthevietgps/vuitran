import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  Ticket,
  TicketDocument,
  TicketStatus,
  TicketPriority,
  TicketType,
  TicketComment,
  TicketCommentDocument,
} from './schemas/ticket.schema';

import { WalletsService } from '../wallets/wallets.service';
import { ClassesService } from '../classes/classes.service';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { buildSlaMetrics } from './tickets-sla.helper';

type ParentSupportHandoffParams = {
  conversationId: string;
  parentId: string;
  studentId?: string;
  supportUserId?: string;
  type: TicketType;
  priority: TicketPriority;
  subject: string;
  description: string;
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    @InjectModel(Ticket.name) private ticketModel: Model<TicketDocument>,
    @InjectModel(TicketComment.name) private commentModel: Model<TicketCommentDocument>,
    private readonly walletsService: WalletsService,
    private readonly classesService: ClassesService,
  ) {}

  private toObjectId(value?: string | Types.ObjectId): Types.ObjectId | undefined {
    if (!value) return undefined;
    return typeof value === 'string' ? new Types.ObjectId(value) : value;
  }

  private async findSessionContext(sessionId: string | Types.ObjectId) {
    const sid = this.toObjectId(sessionId);
    const session = await this.ticketModel.db.collection('sessions').findOne(
      { _id: sid as Types.ObjectId },
      {
        projection: {
          _id: 1,
          classId: 1,
          studentId: 1,
          teacherId: 1,
          parentUserId: 1,
          isPaid: 1,
          amountCharged: 1,
        },
      },
    );
    if (!session) throw new NotFoundException('Buoi hoc khong ton tai');
    return session as any;
  }

  private async resolveParentUserIdFromStudent(studentId: Types.ObjectId): Promise<Types.ObjectId | null> {
    const student = await this.ticketModel.db.collection('students').findOne(
      { _id: studentId },
      { projection: { parentUserId: 1 } },
    );
    return (student?.parentUserId as Types.ObjectId) || null;
  }

  private async buildRefundPayload(ticket: TicketDocument, refundAmount: number) {
    if (!ticket.sessionId) {
      throw new BadRequestException('Ticket hoan tien bat buoc phai gan sessionId');
    }
    const session = await this.findSessionContext(ticket.sessionId as Types.ObjectId);

    if (!session.isPaid) {
      throw new BadRequestException(
        'Buoi hoc nay chua tru vi phu huynh, khong the hoan tien',
      );
    }

    if (!session.classId || !session.studentId) {
      throw new BadRequestException(
        'Session khong day du classId/studentId de hoan tien',
      );
    }

    const chargedAmount = Number(session.amountCharged || 0);
    if (chargedAmount <= 0) {
      throw new BadRequestException(
        'Buoi hoc nay khong co so tien da tru hop le de hoan',
      );
    }
    if (refundAmount > chargedAmount) {
      throw new BadRequestException(
        `So tien hoan (${refundAmount}) vuot qua so tien da tru (${chargedAmount})`,
      );
    }

    if (ticket.classId && ticket.classId.toString() !== session.classId.toString()) {
      throw new BadRequestException('Class cua ticket khong khop voi class cua session');
    }
    if (ticket.studentId && ticket.studentId.toString() !== session.studentId.toString()) {
      throw new BadRequestException('Hoc sinh cua ticket khong khop voi session');
    }

    let parentUserId = session.parentUserId?.toString() || '';
    if (!parentUserId) {
      const parentFromStudent = await this.resolveParentUserIdFromStudent(session.studentId);
      parentUserId = parentFromStudent?.toString() || '';
    }
    if (!parentUserId) {
      throw new BadRequestException(
        'Khong xac dinh duoc parentUserId cua session de hoan tien',
      );
    }

    return {
      parentUserId,
      sessionId: session._id.toString(),
      classId: session.classId.toString(),
      studentId: session.studentId.toString(),
      refundAmount,
    };
  }

  private computeDueDate(base: Date, priority: TicketPriority): Date {
    const dueDate = new Date(base);
    switch (priority) {
      case TicketPriority.URGENT:
        dueDate.setHours(dueDate.getHours() + 4);
        break;
      case TicketPriority.HIGH:
        dueDate.setHours(dueDate.getHours() + 24);
        break;
      case TicketPriority.MEDIUM:
        dueDate.setHours(dueDate.getHours() + 48);
        break;
      case TicketPriority.LOW:
        dueDate.setHours(dueDate.getHours() + 72);
        break;
      default:
        dueDate.setHours(dueDate.getHours() + 48);
        break;
    }
    return dueDate;
  }

  private shouldBeOverdue(ticket: { dueDate?: Date; status: TicketStatus }): boolean {
    if (!ticket.dueDate) return false;
    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      return false;
    }
    return new Date(ticket.dueDate).getTime() < Date.now();
  }

  private async canTakeAttendanceForTicketClass(ticket: TicketDocument, userId: string): Promise<boolean> {
    let classId = ticket.classId as Types.ObjectId | undefined;
    if (!classId && ticket.sessionId) {
      const session = await this.ticketModel.db.collection('sessions').findOne(
        { _id: ticket.sessionId as Types.ObjectId },
        { projection: { classId: 1 } },
      ) as any;
      if (session?.classId) classId = session.classId as Types.ObjectId;
    }
    if (!classId) return false;

    const classroom = await this.ticketModel.db.collection('classrooms').findOne(
      { _id: classId },
      {
        projection: {
          teacher: 1,
          substituteTeachers: 1,
        },
      },
    ) as any;
    if (!classroom) return false;

    if (classroom.teacher?.toString() === userId) return true;

    let referenceDate = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
    if (ticket.sessionId) {
      const session = await this.ticketModel.db.collection('sessions').findOne(
        { _id: ticket.sessionId as Types.ObjectId },
        { projection: { scheduledDate: 1 } },
      ) as any;
      if (session?.scheduledDate) {
        referenceDate = new Date(session.scheduledDate);
      }
    }

    const day = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
      ),
    );

    const subs = Array.isArray(classroom.substituteTeachers) ? classroom.substituteTeachers : [];
    return subs.some((s: any) => {
      if (s?.teacherId?.toString() !== userId) return false;
      const from = new Date(s.fromDate);
      const to = new Date(s.toDate);
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCHours(23, 59, 59, 999);
      return day >= from && day <= to;
    });
  }

  private async findPreferredSessionContext(parentId: string, studentId?: string) {
    if (!studentId) return null;

    const parentObjectId = new Types.ObjectId(parentId);
    const studentObjectId = new Types.ObjectId(studentId);
    const now = new Date();

    const upcoming = await this.ticketModel.db.collection('sessions').findOne(
      {
        parentUserId: parentObjectId,
        studentId: studentObjectId,
        status: 'SCHEDULED',
        scheduledDate: { $gte: now },
      },
      {
        sort: { scheduledDate: 1 },
        projection: {
          _id: 1,
          classId: 1,
          teacherId: 1,
          studentId: 1,
          parentUserId: 1,
        },
      },
    );

    if (upcoming) return upcoming as any;

    const latest = await this.ticketModel.db.collection('sessions').findOne(
      {
        parentUserId: parentObjectId,
        studentId: studentObjectId,
      },
      {
        sort: { scheduledDate: -1 },
        projection: {
          _id: 1,
          classId: 1,
          teacherId: 1,
          studentId: 1,
          parentUserId: 1,
        },
      },
    );

    return (latest as any) || null;
  }

  async createOrFindParentSupportHandoff(params: ParentSupportHandoffParams) {
    const conversationObjectId = new Types.ObjectId(params.conversationId);
    const activeStatuses = [
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.WAITING_INFO,
      TicketStatus.WAITING_REFUND,
    ];

    const existing = await this.ticketModel
      .findOne({
        sourceConversationId: conversationObjectId,
        type: params.type,
        status: { $in: activeStatuses },
      })
      .sort({ createdAt: -1 });

    if (existing) {
      return { ticket: existing, created: false };
    }

    const sessionContext = await this.findPreferredSessionContext(
      params.parentId,
      params.studentId,
    );

    const ticket = await this.create(
      {
        type: params.type,
        priority: params.priority,
        subject: params.subject,
        description: params.description,
        parentId: params.parentId,
        studentId: params.studentId,
        sourceConversationId: params.conversationId,
        sessionId: sessionContext?._id?.toString?.(),
        classId: sessionContext?.classId?.toString?.(),
        teacherId: sessionContext?.teacherId?.toString?.(),
      },
      params.parentId,
      Role.PARENT,
    );

    if (params.supportUserId && Types.ObjectId.isValid(params.supportUserId)) {
      const assignedUser = await this.ticketModel.db.collection('users').findOne(
        { _id: new Types.ObjectId(params.supportUserId) },
        { projection: { _id: 1, role: 1 } },
      ) as { _id: Types.ObjectId; role: Role } | null;

      if (assignedUser && [Role.OPS, Role.DIRECTOR].includes(assignedUser.role)) {
        ticket.assignedTo = assignedUser._id;
        ticket.assignedAt = new Date();
        ticket.status = TicketStatus.IN_PROGRESS;
        await ticket.save();
      }
    }

    return { ticket, created: true };
  }

  // ══════════════════════════════════════════════════════════════════
  //  CREATE
  // ══════════════════════════════════════════════════════════════════

  async create(dto: CreateTicketDto, userId: string, userRole: string): Promise<TicketDocument> {
    // Auto-gen ticket code with collision retry: TKT-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    let ticketCode = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `TKT-${dateStr}-${rand}`;
      const exists = await this.ticketModel.exists({ ticketCode: candidate });
      if (!exists) { ticketCode = candidate; break; }
    }
    if (!ticketCode) {
      // Fallback: use timestamp-based code
      ticketCode = `TKT-${dateStr}-${Date.now().toString(36).toUpperCase()}`;
    }

    // SLA: set due date based on priority
    const effectivePriority = dto.priority || TicketPriority.MEDIUM;
    const dueDate = this.computeDueDate(now, effectivePriority);

    const isParentActor = userRole === Role.PARENT;
    const isTeacherActor = userRole === Role.TEACHER;

    if (isParentActor && dto.parentId && dto.parentId !== userId) {
      throw new ForbiddenException('Phu huynh chi duoc tao ticket cho chinh minh');
    }
    if (isTeacherActor && dto.teacherId && dto.teacherId !== userId) {
      throw new ForbiddenException('Giao vien chi duoc tao ticket cho chinh minh');
    }

    let sessionId = this.toObjectId(dto.sessionId);
    let classId = this.toObjectId(dto.classId);
    let studentId = this.toObjectId(dto.studentId);
    let teacherId = isTeacherActor ? new Types.ObjectId(userId) : this.toObjectId(dto.teacherId);
    let parentId = isParentActor ? new Types.ObjectId(userId) : this.toObjectId(dto.parentId);

    if (sessionId) {
      const session = await this.findSessionContext(sessionId);
      if (classId && session.classId && classId.toString() !== session.classId.toString()) {
        throw new BadRequestException('classId khong khop voi sessionId');
      }
      if (studentId && session.studentId && studentId.toString() !== session.studentId.toString()) {
        throw new BadRequestException('studentId khong khop voi sessionId');
      }
      if (teacherId && session.teacherId && teacherId.toString() !== session.teacherId.toString()) {
        throw new BadRequestException('teacherId khong khop voi sessionId');
      }
      if (parentId && session.parentUserId && parentId.toString() !== session.parentUserId.toString()) {
        throw new BadRequestException('parentId khong khop voi sessionId');
      }

      classId = session.classId ? new Types.ObjectId(session.classId) : classId;
      studentId = session.studentId ? new Types.ObjectId(session.studentId) : studentId;
      teacherId = session.teacherId ? new Types.ObjectId(session.teacherId) : teacherId;
      if (session.parentUserId) {
        parentId = new Types.ObjectId(session.parentUserId);
      } else if (studentId) {
        const parentFromStudent = await this.resolveParentUserIdFromStudent(studentId);
        if (parentFromStudent) parentId = parentFromStudent;
      }

      if (isParentActor && !parentId) {
        throw new ForbiddenException(
          'Khong xac dinh duoc phu huynh cua session de tao ticket',
        );
      }
    } else if (studentId && !parentId) {
      const parentFromStudent = await this.resolveParentUserIdFromStudent(studentId);
      if (parentFromStudent) parentId = parentFromStudent;
    }

    if (isParentActor && parentId && parentId.toString() !== userId) {
      throw new ForbiddenException('Phu huynh khong duoc tao ticket cho hoc sinh khong thuoc minh');
    }
    if (isTeacherActor && teacherId && teacherId.toString() !== userId) {
      throw new ForbiddenException('Giao vien khong duoc tao ticket cho nguoi khac');
    }

    const ticket = await this.ticketModel.create({
      ticketCode,
      type: dto.type,
      subject: dto.subject,
      description: dto.description,
      priority: effectivePriority,
      createdBy: new Types.ObjectId(userId),
      createdByRole: userRole,
      sessionId,
      classId,
      studentId,
      teacherId,
      parentId,
      sourceConversationId: dto.sourceConversationId
        ? new Types.ObjectId(dto.sourceConversationId)
        : undefined,
      payrollId: dto.payrollId ? new Types.ObjectId(dto.payrollId) : undefined,
      ledgerEntryId: dto.ledgerEntryId ? new Types.ObjectId(dto.ledgerEntryId) : undefined,
      substituteTeacherId: dto.substituteTeacherId ? new Types.ObjectId(dto.substituteTeacherId) : undefined,
      substituteFromDate: dto.substituteFromDate ? new Date(dto.substituteFromDate) : undefined,
      substituteToDate: dto.substituteToDate ? new Date(dto.substituteToDate) : undefined,
      attachments: dto.attachments || [],
      dueDate,
      isOverdue: false,
    });

    this.logger.log(`Ticket created: ${ticketCode} | type: ${dto.type} | priority: ${dto.priority || 'MEDIUM'}`);
    return ticket;
  }

  // ══════════════════════════════════════════════════════════════════
  //  QUERY
  // ══════════════════════════════════════════════════════════════════

  /** Find tickets where user is creator OR a referenced party OR assignee */
  async findMyTickets(userId: string, query: QueryTicketDto) {
    const userOid = new Types.ObjectId(userId);
    const orConditions: FilterQuery<Ticket>[] = [
      { createdBy: userOid },
      { teacherId: userOid },
      { parentId: userOid },
      { assignedTo: userOid },
    ];

    const filter: FilterQuery<Ticket> = { $or: orConditions };
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.overdue === 'true') filter.isOverdue = true;

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-createdAt';

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'fullName email role')
        .populate('assignedTo', 'fullName email')
        .populate('sessionId', 'scheduledDate scheduledStartTime status')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAll(query: QueryTicketDto) {
    const filter: FilterQuery<Ticket> = {};

    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.priority) filter.priority = query.priority;
    if (query.overdue === 'true') filter.isOverdue = true;
    if (query.createdBy) filter.createdBy = new Types.ObjectId(query.createdBy);
    if (query.assignedTo) filter.assignedTo = new Types.ObjectId(query.assignedTo);
    if (query.sessionId) filter.sessionId = new Types.ObjectId(query.sessionId);

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sort = query.sort || '-createdAt';

    const [data, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'fullName email role')
        .populate('assignedTo', 'fullName email')
        .populate('sessionId', 'scheduledDate scheduledStartTime status')
        .populate('classId', 'name code')
        .lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, actor?: JwtPayload): Promise<TicketDocument> {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('createdBy', 'fullName email phone role')
      .populate('assignedTo', 'fullName email')
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status amountCharged')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .populate('teacherId', 'fullName email')
      .populate('parentId', 'fullName email')
      .populate('resolution.resolvedBy', 'fullName');

    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    // PARENT/TEACHER can only view tickets they created or are a referenced party on
    if (actor && [Role.PARENT, Role.TEACHER].includes(actor.role)) {
      const ticketObj = ticket.toObject() as any;
      const userId = actor.sub;
      const isOwner = ticketObj.createdBy?._id?.toString() === userId;
      const isParty =
        ticketObj.teacherId?._id?.toString() === userId ||
        ticketObj.parentId?._id?.toString() === userId ||
        ticketObj.assignedTo?._id?.toString() === userId;
      if (!isOwner && !isParty) {
        throw new NotFoundException('Ticket không tồn tại');
      }
    }

    return ticket;
  }

  // ══════════════════════════════════════════════════════════════════
  //  UPDATE (priority, assign)
  // ══════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateTicketDto): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException('Khong the sua ticket da dong/huy');
    }

    if (dto.priority) {
      ticket.priority = dto.priority;
      ticket.dueDate = this.computeDueDate(new Date(), dto.priority);
    }

    if (dto.assignedTo) {
      const assignedUser = await this.ticketModel.db.collection('users').findOne(
        { _id: new Types.ObjectId(dto.assignedTo) },
        { projection: { _id: 1, role: 1 } },
      ) as { _id: Types.ObjectId; role: Role } | null;
      if (!assignedUser) {
        throw new BadRequestException('Nguoi duoc phan cong khong ton tai');
      }

      const isOpsOrDirector = [Role.OPS, Role.DIRECTOR].includes(assignedUser.role);
      const hasClassAttendancePermission =
        assignedUser.role === Role.TEACHER &&
        await this.canTakeAttendanceForTicketClass(ticket, dto.assignedTo);

      if (!isOpsOrDirector && !hasClassAttendancePermission) {
        throw new BadRequestException(
          'Chi phan cong duoc cho OPS/DIRECTOR hoac nguoi co quyen diem danh cua lop lien quan',
        );
      }

      ticket.assignedTo = new Types.ObjectId(dto.assignedTo);
      ticket.assignedAt = new Date();
      if (ticket.status === TicketStatus.OPEN) {
        ticket.status = TicketStatus.IN_PROGRESS;
      }
    }

    ticket.isOverdue = this.shouldBeOverdue(ticket);
    return ticket.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  COMMENTS
  // ══════════════════════════════════════════════════════════════════

  async addComment(ticketId: string, userId: string, dto: AddCommentDto, actor?: JwtPayload): Promise<any> {
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Ticket không tồn tại');

    // PARENT/TEACHER can only comment on their own tickets
    if (actor && [Role.PARENT, Role.TEACHER].includes(actor.role)) {
      const isOwner = ticket.createdBy?.toString() === actor.sub;
      const isParty =
        (ticket as any).teacherId?.toString() === actor.sub ||
        (ticket as any).parentId?.toString() === actor.sub ||
        (ticket as any).assignedTo?.toString() === actor.sub;
      if (!isOwner && !isParty) {
        throw new NotFoundException('Ticket không tồn tại');
      }
    }

    if ([TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException('Không thể comment vào ticket đã đóng');
    }

    // PARENT/TEACHER cannot create internal notes
    const isStaff = actor && [Role.OPS, Role.DIRECTOR].includes(actor.role);
    const isInternal = isStaff ? (dto.isInternal || false) : false;

    const comment = await this.commentModel.create({
      ticketId: ticket._id,
      userId: new Types.ObjectId(userId),
      content: dto.content,
      attachments: dto.attachments || [],
      isInternal,
    });

    // Auto-transition: if ticket is WAITING_INFO and the commenter is the ticket creator (PH/GV),
    // move back to IN_PROGRESS so OPS knows info has been provided
    if (ticket.status === TicketStatus.WAITING_INFO && !isInternal) {
      const isTicketCreator = ticket.createdBy?.toString() === userId;
      if (isTicketCreator) {
        ticket.status = TicketStatus.IN_PROGRESS;
        await ticket.save();
      }
    }

    return comment;
  }

  async getComments(ticketId: string, includeInternal: boolean, actor?: JwtPayload) {
    // PARENT/TEACHER ownership check
    if (actor && [Role.PARENT, Role.TEACHER].includes(actor.role)) {
      const ticket = await this.ticketModel.findById(ticketId).lean() as any;
      if (!ticket) throw new NotFoundException('Ticket không tồn tại');
      const isOwner = ticket.createdBy?.toString() === actor.sub;
      const isParty =
        ticket.teacherId?.toString() === actor.sub ||
        ticket.parentId?.toString() === actor.sub ||
        ticket.assignedTo?.toString() === actor.sub;
      if (!isOwner && !isParty) {
        throw new NotFoundException('Ticket không tồn tại');
      }
    }

    const filter: FilterQuery<TicketComment> = { ticketId: new Types.ObjectId(ticketId) };
    if (!includeInternal) {
      filter.isInternal = false;
    }

    return this.commentModel
      .find(filter)
      .sort('createdAt')
      .populate('userId', 'fullName email role')
      .lean();
  }

  // ══════════════════════════════════════════════════════════════════
  //  WORKFLOW
  // ══════════════════════════════════════════════════════════════════

  /** OPS nhận xử lý */
  async startProcessing(id: string, opsUserId: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if (![TicketStatus.OPEN, TicketStatus.WAITING_INFO].includes(ticket.status)) {
      throw new BadRequestException('Chi nhan xu ly ticket OPEN hoac WAITING_INFO');
    }

    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.assignedTo = new Types.ObjectId(opsUserId);
    ticket.assignedAt = new Date();
    ticket.isOverdue = this.shouldBeOverdue(ticket);
    return ticket.save();
  }

  async requestInfo(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if (![TicketStatus.OPEN, TicketStatus.IN_PROGRESS].includes(ticket.status)) {
      throw new BadRequestException('Chi yeu cau them thong tin khi ticket dang OPEN hoac IN_PROGRESS');
    }

    ticket.status = TicketStatus.WAITING_INFO;
    ticket.isOverdue = this.shouldBeOverdue(ticket);
    return ticket.save();
  }

  async resolve(id: string, userId: string, dto: ResolveTicketDto): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)) {
      throw new BadRequestException('Ticket da duoc xu ly');
    }

    let refundLedgerEntryId: Types.ObjectId | undefined;
    if (dto.outcome === 'APPROVED' && dto.refundAmount && dto.refundAmount > 0) {
      const refundPayload = await this.buildRefundPayload(ticket, dto.refundAmount);
      const refundEntry = await this.walletsService.refundForSession(refundPayload, userId);
      refundLedgerEntryId = refundEntry?._id as Types.ObjectId | undefined;
      this.logger.log(`Ticket ${ticket.ticketCode} resolved with refund: ${dto.refundAmount}d`);
    }

    if (
      ticket.type === TicketType.SUBSTITUTE_TEACHER &&
      dto.outcome === 'APPROVED' &&
      ticket.classId &&
      ticket.substituteTeacherId
    ) {
      const fromDate = ticket.substituteFromDate || new Date();
      const toDate = ticket.substituteToDate || ticket.substituteFromDate || new Date();
      const payRate = dto.substitutePayRate ?? (ticket as any).substitutePayRate ?? 0;
      const canCreateLink = dto.substituteCanCreateLink ?? (ticket as any).substituteCanCreateLink ?? true;

      await this.classesService.addSubstituteTeacher(
        ticket.classId.toString(),
        {
          teacherId: ticket.substituteTeacherId.toString(),
          fromDate,
          toDate,
          payRate,
          canCreateLink,
          ticketId: ticket._id?.toString(),
          approvedBy: userId,
        },
      );

      ticket.substitutePayRate = payRate;
      ticket.substituteCanCreateLink = canCreateLink;
      this.logger.log(
        `Ticket ${ticket.ticketCode}: Added substitute teacher ${ticket.substituteTeacherId} to class ${ticket.classId} (${fromDate.toISOString().slice(0, 10)} -> ${toDate.toISOString().slice(0, 10)}, pay: ${payRate})`,
      );
    }

    ticket.status = TicketStatus.RESOLVED;
    ticket.resolution = {
      summary: dto.summary,
      outcome: dto.outcome,
      refundAmount: dto.refundAmount || 0,
      refundLedgerEntryId,
      refundPaidAt: refundLedgerEntryId ? new Date() : undefined,
      refundPaidBy: refundLedgerEntryId ? new Types.ObjectId(userId) : undefined,
      resolvedBy: new Types.ObjectId(userId),
      resolvedAt: new Date(),
    };
    ticket.isOverdue = false;

    await ticket.save();

    return this.ticketModel
      .findById(id)
      .populate('createdBy', 'fullName email phone role')
      .populate('assignedTo', 'fullName email')
      .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status amountCharged')
      .populate('classId', 'name code')
      .populate('studentId', 'fullName studentCode')
      .populate('teacherId', 'fullName email')
      .populate('parentId', 'fullName email')
      .populate('resolution.resolvedBy', 'fullName') as Promise<TicketDocument>;
  }

  async close(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if (ticket.status !== TicketStatus.RESOLVED) {
      throw new BadRequestException('Chi dong duoc ticket da RESOLVED');
    }

    const refundAmount = Number(ticket.resolution?.refundAmount || 0);
    if (
      ticket.type === TicketType.REFUND_REQUEST
      && refundAmount > 0
      && !ticket.resolution?.refundLedgerEntryId
    ) {
      throw new BadRequestException(
        'Ticket refund nay chua duoc lien ket LedgerEntry giao dich vi. Ke toan can tao giao dich hoan tien truoc khi dong ticket.',
      );
    }

    ticket.status = TicketStatus.CLOSED;
    ticket.isOverdue = false;
    return ticket.save();
  }

  async cancel(id: string, userId: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if (ticket.createdBy.toString() !== userId) {
      throw new BadRequestException('Chi nguoi tao moi huy duoc ticket');
    }

    if ([TicketStatus.RESOLVED, TicketStatus.CLOSED].includes(ticket.status)) {
      throw new BadRequestException('Khong the huy ticket da xu ly');
    }

    ticket.status = TicketStatus.CANCELLED;
    ticket.isOverdue = false;
    return ticket.save();
  }

  async reopen(id: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findById(id);
    if (!ticket) throw new NotFoundException('Ticket khong ton tai');

    if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) {
      throw new BadRequestException('Chi mo lai ticket RESOLVED hoac CLOSED');
    }

    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.resolution = undefined;
    ticket.isOverdue = this.shouldBeOverdue(ticket);
    return ticket.save();
  }

  // ══════════════════════════════════════════════════════════════════
  //  STATS
  // ══════════════════════════════════════════════════════════════════

  async getStats() {
    const [byStatus, byType, byPriority, overdue] = await Promise.all([
      this.ticketModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { status: { $nin: [TicketStatus.CLOSED, TicketStatus.CANCELLED] } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { status: { $nin: [TicketStatus.CLOSED, TicketStatus.CANCELLED] } } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      this.ticketModel.countDocuments({
        status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
        dueDate: { $lt: new Date() },
      }),
    ]);

    return { byStatus, byType, byPriority, overdueCount: overdue };
  }

  // ══════════════════════════════════════════════════════════════════
  //  SLA CHECK (có thể gọi bởi cron)
  // ══════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_HOUR)
  async markOverdueTickets(): Promise<number> {
    const now = new Date();
    const marked = await this.ticketModel.updateMany(
      {
        status: { $nin: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] },
        dueDate: { $lt: now },
        isOverdue: false,
      },
      { $set: { isOverdue: true } },
    );

    const cleared = await this.ticketModel.updateMany(
      {
        isOverdue: true,
        $or: [
          { status: { $in: [TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED] } },
          { dueDate: { $gte: now } },
          { dueDate: { $exists: false } },
          { dueDate: null },
        ],
      },
      { $set: { isOverdue: false } },
    );

    const changedCount = (marked.modifiedCount || 0) + (cleared.modifiedCount || 0);
    if (changedCount > 0) {
      this.logger.warn(`Updated overdue flag for ${changedCount} tickets`);
    }
    return changedCount;
  }

  // ════════════════════════════════════════════════════════════════════
  // SLA MONITORING (Phase 2.6)
  // ════════════════════════════════════════════════════════════════════

  async getSlaMetrics(fromDate?: string, toDate?: string) {
    return buildSlaMetrics(this.ticketModel, fromDate, toDate);
  }
}
