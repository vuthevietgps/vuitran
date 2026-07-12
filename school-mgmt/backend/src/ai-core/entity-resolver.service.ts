import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { Role } from '../common/interfaces/role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassroomDocument } from '../classes/schemas/class.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Ticket, TicketDocument } from '../tickets/schemas/ticket.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { ResolveAiEntityDto } from './dto/resolve-entity.dto';
import {
  AiEntityCandidate,
  AiEntityConfidence,
  AiEntityResolution,
  AiEntityType,
} from './ai-core.types';

type SearchableEntityType = Exclude<AiEntityType, AiEntityType.AUTO>;

interface SearchFieldSpec {
  path: string;
  label: string;
  weight?: number;
}

export interface AiEntityScoreField {
  field: string;
  value: unknown;
  weight?: number;
}

interface SearchConfig {
  type: SearchableEntityType;
  model: Model<any>;
  fields: SearchFieldSpec[];
  select: string;
  scopeFilter: FilterQuery<any>;
  map: (doc: any) => {
    label: string;
    code?: string;
    summary: Record<string, unknown>;
  };
}

const DEFAULT_ENTITY_LIMIT = 5;
const MAX_ENTITY_LIMIT = 10;
const MIN_CANDIDATE_SCORE = 0.45;

const SEARCH_STOPWORDS = new Set([
  'xem',
  'tim',
  'kiem',
  'tra',
  'cho',
  'toi',
  'minh',
  've',
  'cua',
  'can',
  'giup',
  'thong',
  'tin',
  'bao',
  'cao',
  'tinh',
  'hinh',
  'hom',
  'nay',
  'ngay',
  'thang',
  'hoc',
  'vien',
  'hocvien',
  'hoc',
  'sinh',
  'hocsinh',
  'phu',
  'huynh',
  'phuhuynh',
  'giao',
  'vien',
  'giaovien',
  'hoa',
  'don',
  'hoadon',
  'lop',
  'ma',
]);

const VIETNAMESE_CHAR_CLASSES: Record<string, string> = {
  a: '[aàáạảãâầấậẩẫăằắặẳẵ]',
  e: '[eèéẹẻẽêềếệểễ]',
  i: '[iìíịỉĩ]',
  o: '[oòóọỏõôồốộổỗơờớợởỡ]',
  u: '[uùúụủũưừứựửữ]',
  y: '[yỳýỵỷỹ]',
  d: '[dđ]',
};

@Injectable()
export class AiEntityResolverService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name)
    private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
  ) {}

  async resolve(dto: ResolveAiEntityDto, user: JwtPayload): Promise<AiEntityResolution> {
    const query = dto.q?.trim();
    if (!query) {
      throw new BadRequestException('q khong duoc de trong');
    }

    const requestedType = dto.type || AiEntityType.AUTO;
    const limit = this.parseLimit(dto.limit);
    const types = this.resolveRequestedTypes(requestedType, query);
    const candidateGroups = await Promise.all(
      types.map((type) => this.searchType(type, query, user, limit)),
    );

    return this.buildResolution(query, requestedType, candidateGroups.flat(), limit);
  }

  async resolveForChat(
    message: string,
    user: JwtPayload,
    _assistantType: AiAssistantType,
    _situationKey?: string,
  ): Promise<AiEntityResolution | undefined> {
    if (!this.shouldAttemptChatResolution(message)) {
      return undefined;
    }

    const resolution = await this.resolve({
      q: message,
      type: AiEntityType.AUTO,
      limit: String(DEFAULT_ENTITY_LIMIT),
    }, user);

    return resolution.status === 'NOT_FOUND' && resolution.candidates.length === 0
      ? undefined
      : resolution;
  }

  normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  scoreValues(query: string, fields: AiEntityScoreField[]): { score: number; matchedFields: string[] } {
    let bestScore = 0;
    const matchedFields = new Set<string>();

    for (const field of fields) {
      const values = this.flattenValues(field.value);
      for (const value of values) {
        const rawScore = this.scoreSingleValue(query, value);
        const weightedScore = Math.min(1, rawScore * (field.weight || 1));
        if (weightedScore > bestScore) {
          bestScore = weightedScore;
        }
        if (weightedScore >= MIN_CANDIDATE_SCORE) {
          matchedFields.add(field.field);
        }
      }
    }

    return {
      score: Number(bestScore.toFixed(3)),
      matchedFields: Array.from(matchedFields),
    };
  }

  buildResolution(
    query: string,
    requestedType: AiEntityType,
    candidates: AiEntityCandidate[],
    limit = DEFAULT_ENTITY_LIMIT,
  ): AiEntityResolution {
    const normalizedQuery = this.normalizeText(query);
    const deduped = this.dedupeCandidates(candidates)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    const top = deduped[0];
    const second = deduped[1];

    if (!top || top.score < 0.52) {
      return {
        query,
        normalizedQuery,
        requestedType,
        status: 'NOT_FOUND',
        candidates: deduped,
        needsConfirmation: true,
        message: 'Khong tim thay doi tuong phu hop trong pham vi du lieu duoc phep.',
      };
    }

    const hasCloseSecond = Boolean(second && top.score - second.score < 0.12);
    const resolved = !hasCloseSecond && (top.score >= 0.9 || (top.score >= 0.84 && !second));

    if (resolved) {
      return {
        query,
        normalizedQuery,
        requestedType,
        status: 'RESOLVED',
        candidates: deduped,
        selected: top,
        needsConfirmation: false,
        message: 'Da xac dinh duoc doi tuong kha chac chan.',
      };
    }

    return {
      query,
      normalizedQuery,
      requestedType,
      status: 'AMBIGUOUS',
      candidates: deduped,
      needsConfirmation: true,
      message: 'Co mot hoac nhieu doi tuong gan dung; can nguoi dung xac nhan truoc khi tra loi chi tiet.',
    };
  }

  async getScopedEntityDetail(type: AiEntityType | string, id: string, user: JwtPayload) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('entity id khong hop le');
    }

    const entityType = type as SearchableEntityType;
    const scopeFilter = await this.getScopeFilter(entityType, user);
    if (!scopeFilter) return null;
    const filter = this.combineFilters(scopeFilter, { _id: new Types.ObjectId(id) });

    switch (entityType) {
      case AiEntityType.USER:
      case AiEntityType.PARENT:
      case AiEntityType.TEACHER:
        return this.userModel.findOne(filter)
          .select('_id userCode email fullName role status phone saleOwnerName address ownershipPercentage createdAt updatedAt')
          .lean();
      case AiEntityType.STUDENT:
        return this.studentModel.findOne(filter)
          .select('-payments.invoiceImage -faceImage')
          .populate('productPackage', 'name code teachingMode pricePerSession suggestedPrice')
          .lean();
      case AiEntityType.CLASS:
        return this.classroomModel.findOne(filter)
          .select('-editHistory -curriculum.description')
          .populate('teacher', 'fullName email role userCode')
          .populate('sale', 'fullName email role userCode')
          .populate('students', 'fullName studentCode age parentName')
          .populate('coTeachers.teacherId', 'fullName email role userCode')
          .lean();
      case AiEntityType.INVOICE:
        return this.invoiceModel.findOne(filter)
          .select('-receiptImage -approvalImage')
          .populate('studentId', 'fullName studentCode parentName parentPhone')
          .populate('classId', 'name code')
          .populate('requestedClassId', 'name code')
          .lean();
      case AiEntityType.ORDER:
        return this.orderModel.findOne(filter)
          .select('-receiptImage -approvalImage -studentFaceImage')
          .lean();
      case AiEntityType.LEAD:
        return this.leadModel.findOne(filter).lean();
      case AiEntityType.TICKET:
        return this.ticketModel.findOne(filter)
          .populate('createdBy', 'fullName email phone role')
          .populate('assignedTo', 'fullName email role')
          .populate('sessionId', 'scheduledDate scheduledStartTime scheduledEndTime status amountCharged')
          .populate('classId', 'name code')
          .populate('studentId', 'fullName studentCode')
          .populate('teacherId', 'fullName email role')
          .populate('parentId', 'fullName email role')
          .lean();
      case AiEntityType.SESSION:
        return this.sessionModel.findOne(filter)
          .select('-teachingReport -evaluation.homeworkSubmissionFiles -evaluation.homeworkReviewFiles')
          .populate('classId', 'name code subject grade classMode')
          .populate('studentId', 'fullName studentCode parentName')
          .populate('teacherId', 'fullName email role userCode')
          .populate('parentUserId', 'fullName email role')
          .lean();
      case AiEntityType.AD_GROUP:
        return this.adGroupModel.findOne(filter).lean();
      default:
        return null;
    }
  }

  private async searchType(
    type: SearchableEntityType,
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    switch (type) {
      case AiEntityType.USER:
      case AiEntityType.PARENT:
      case AiEntityType.TEACHER:
        return this.searchUsers(type, query, user, limit);
      case AiEntityType.STUDENT:
        return this.searchStudents(query, user, limit);
      case AiEntityType.CLASS:
        return this.searchClasses(query, user, limit);
      case AiEntityType.INVOICE:
        return this.searchInvoices(query, user, limit);
      case AiEntityType.ORDER:
        return this.searchOrders(query, user, limit);
      case AiEntityType.LEAD:
        return this.searchLeads(query, user, limit);
      case AiEntityType.TICKET:
        return this.searchTickets(query, user, limit);
      case AiEntityType.SESSION:
        return this.searchSessions(query, user, limit);
      case AiEntityType.AD_GROUP:
        return this.searchAdGroups(query, user, limit);
      default:
        return [];
    }
  }

  private async searchUsers(
    type: SearchableEntityType,
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(type, user);
    if (!scopeFilter) return [];

    const roleFilter = type === AiEntityType.PARENT
      ? { role: Role.PARENT }
      : type === AiEntityType.TEACHER
        ? { role: { $in: [Role.TEACHER, Role.EXPERIENCE_TEACHER] } }
        : {};

    return this.searchModel({
      type,
      model: this.userModel,
      fields: [
        { path: 'userCode', label: 'userCode', weight: 1.08 },
        { path: 'email', label: 'email', weight: 1.04 },
        { path: 'phone', label: 'phone', weight: 1.06 },
        { path: 'fullName', label: 'fullName' },
      ],
      select: '_id userCode email fullName role status phone saleOwnerName createdAt updatedAt',
      scopeFilter: this.combineFilters(scopeFilter, roleFilter),
      map: (doc) => ({
        label: doc.fullName || doc.email || doc.userCode || doc._id?.toString(),
        code: doc.userCode,
        summary: {
          fullName: doc.fullName,
          userCode: doc.userCode,
          role: doc.role,
          status: doc.status,
          email: doc.email,
          phone: doc.phone,
          saleOwnerName: doc.saleOwnerName,
        },
      }),
    }, query, limit);
  }

  private async searchStudents(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.STUDENT, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.STUDENT,
      model: this.studentModel,
      fields: [
        { path: 'studentCode', label: 'studentCode', weight: 1.08 },
        { path: 'fullName', label: 'fullName' },
        { path: 'parentName', label: 'parentName' },
        { path: 'parentPhone', label: 'parentPhone', weight: 1.06 },
        { path: 'saleName', label: 'saleName' },
        { path: 'grade', label: 'grade' },
      ],
      select: '_id studentCode fullName age grade parentName parentPhone saleName approvalStatus totalPurchasedSessions createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.fullName || doc.studentCode || doc._id?.toString(),
        code: doc.studentCode,
        summary: {
          studentCode: doc.studentCode,
          fullName: doc.fullName,
          age: doc.age,
          grade: doc.grade,
          parentName: doc.parentName,
          parentPhone: doc.parentPhone,
          saleName: doc.saleName,
          approvalStatus: doc.approvalStatus,
          totalPurchasedSessions: doc.totalPurchasedSessions,
        },
      }),
    }, query, limit);
  }

  private async searchClasses(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.CLASS, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.CLASS,
      model: this.classroomModel,
      fields: [
        { path: 'code', label: 'code', weight: 1.08 },
        { path: 'name', label: 'name' },
        { path: 'subject', label: 'subject' },
        { path: 'grade', label: 'grade' },
        { path: 'learningGoals', label: 'learningGoals' },
      ],
      select: '_id code name subject grade classMode status sessionsCompleted totalSessions startDate endDate createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.name || doc.code || doc._id?.toString(),
        code: doc.code,
        summary: {
          code: doc.code,
          name: doc.name,
          subject: doc.subject,
          grade: doc.grade,
          classMode: doc.classMode,
          status: doc.status,
          sessionsCompleted: doc.sessionsCompleted,
          totalSessions: doc.totalSessions,
          startDate: doc.startDate,
          endDate: doc.endDate,
        },
      }),
    }, query, limit);
  }

  private async searchInvoices(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.INVOICE, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.INVOICE,
      model: this.invoiceModel,
      fields: [
        { path: 'invoiceNumber', label: 'invoiceNumber', weight: 1.1 },
        { path: 'requestedClassCode', label: 'requestedClassCode', weight: 1.04 },
        { path: 'productName', label: 'productName' },
        { path: 'description', label: 'description' },
        { path: 'status', label: 'status' },
      ],
      select: '_id invoiceNumber invoiceType productName requestedClassCode amount paymentDate status sessions bonusSessions saleCommission createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.invoiceNumber || doc._id?.toString(),
        code: doc.invoiceNumber,
        summary: {
          invoiceNumber: doc.invoiceNumber,
          invoiceType: doc.invoiceType,
          productName: doc.productName,
          requestedClassCode: doc.requestedClassCode,
          amount: doc.amount,
          paymentDate: doc.paymentDate,
          status: doc.status,
          sessions: doc.sessions,
          bonusSessions: doc.bonusSessions,
          saleCommission: doc.saleCommission,
        },
      }),
    }, query, limit);
  }

  private async searchOrders(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.ORDER, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.ORDER,
      model: this.orderModel,
      fields: [
        { path: 'orderCode', label: 'orderCode', weight: 1.1 },
        { path: 'parentName', label: 'parentName' },
        { path: 'parentPhone', label: 'parentPhone', weight: 1.06 },
        { path: 'parentEmail', label: 'parentEmail' },
        { path: 'studentName', label: 'studentName' },
        { path: 'studentCode', label: 'studentCode', weight: 1.06 },
        { path: 'saleName', label: 'saleName' },
      ],
      select: '_id orderCode orderType status parentName parentPhone parentEmail studentName studentCode saleName totalAmount finalAmount leadSource adGroupName createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.orderCode || doc.studentName || doc.parentName || doc._id?.toString(),
        code: doc.orderCode,
        summary: {
          orderCode: doc.orderCode,
          orderType: doc.orderType,
          status: doc.status,
          parentName: doc.parentName,
          parentPhone: doc.parentPhone,
          studentName: doc.studentName,
          studentCode: doc.studentCode,
          saleName: doc.saleName,
          totalAmount: doc.totalAmount,
          finalAmount: doc.finalAmount,
          leadSource: doc.leadSource,
          adGroupName: doc.adGroupName,
        },
      }),
    }, query, limit);
  }

  private async searchLeads(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.LEAD, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.LEAD,
      model: this.leadModel,
      fields: [
        { path: 'leadCode', label: 'leadCode', weight: 1.1 },
        { path: 'parentName', label: 'parentName' },
        { path: 'parentPhone', label: 'parentPhone', weight: 1.06 },
        { path: 'parentEmail', label: 'parentEmail' },
        { path: 'studentName', label: 'studentName' },
        { path: 'saleName', label: 'saleName' },
        { path: 'adGroupName', label: 'adGroupName' },
      ],
      select: '_id leadCode parentName parentPhone parentEmail studentName studentGrade source status saleName adGroupName estimatedValue nextFollowUp createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.leadCode || doc.parentName || doc.studentName || doc._id?.toString(),
        code: doc.leadCode,
        summary: {
          leadCode: doc.leadCode,
          parentName: doc.parentName,
          parentPhone: doc.parentPhone,
          studentName: doc.studentName,
          studentGrade: doc.studentGrade,
          source: doc.source,
          status: doc.status,
          saleName: doc.saleName,
          adGroupName: doc.adGroupName,
          estimatedValue: doc.estimatedValue,
          nextFollowUp: doc.nextFollowUp,
        },
      }),
    }, query, limit);
  }

  private async searchTickets(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.TICKET, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.TICKET,
      model: this.ticketModel,
      fields: [
        { path: 'ticketCode', label: 'ticketCode', weight: 1.1 },
        { path: 'subject', label: 'subject' },
        { path: 'description', label: 'description' },
        { path: 'type', label: 'type' },
        { path: 'status', label: 'status' },
      ],
      select: '_id ticketCode type status priority subject createdByRole dueDate isOverdue createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.subject || doc.ticketCode || doc._id?.toString(),
        code: doc.ticketCode,
        summary: {
          ticketCode: doc.ticketCode,
          type: doc.type,
          status: doc.status,
          priority: doc.priority,
          subject: doc.subject,
          createdByRole: doc.createdByRole,
          dueDate: doc.dueDate,
          isOverdue: doc.isOverdue,
        },
      }),
    }, query, limit);
  }

  private async searchAdGroups(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.AD_GROUP, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.AD_GROUP,
      model: this.adGroupModel,
      fields: [
        { path: 'groupCode', label: 'groupCode', weight: 1.1 },
        { path: 'name', label: 'name' },
        { path: 'adAccountName', label: 'adAccountName' },
        { path: 'platformCampaignId', label: 'platformCampaignId', weight: 1.06 },
        { path: 'trackingKeys', label: 'trackingKeys' },
      ],
      select: '_id groupCode name adAccountName platform platformCampaignId trackingKeys status dailyBudget totalLeads totalSpend totalRevenue createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: doc.name || doc.groupCode || doc._id?.toString(),
        code: doc.groupCode,
        summary: {
          groupCode: doc.groupCode,
          name: doc.name,
          adAccountName: doc.adAccountName,
          platform: doc.platform,
          platformCampaignId: doc.platformCampaignId,
          trackingKeys: doc.trackingKeys,
          status: doc.status,
          dailyBudget: doc.dailyBudget,
          totalLeads: doc.totalLeads,
          totalSpend: doc.totalSpend,
          totalRevenue: doc.totalRevenue,
        },
      }),
    }, query, limit);
  }

  private async searchSessions(
    query: string,
    user: JwtPayload,
    limit: number,
  ): Promise<AiEntityCandidate[]> {
    const scopeFilter = await this.getScopeFilter(AiEntityType.SESSION, user);
    if (!scopeFilter) return [];

    return this.searchModel({
      type: AiEntityType.SESSION,
      model: this.sessionModel,
      fields: [
        { path: 'sessionType', label: 'sessionType' },
        { path: 'status', label: 'status' },
        { path: 'scheduledStartTime', label: 'scheduledStartTime' },
        { path: 'scheduledEndTime', label: 'scheduledEndTime' },
        { path: 'topicsCovered', label: 'topicsCovered' },
        { path: 'teacherNotes', label: 'teacherNotes' },
      ],
      select: '_id sessionType status scheduledDate scheduledStartTime scheduledEndTime durationMinutes sessionNumber topicsCovered teacherNotes parentNotes createdAt updatedAt',
      scopeFilter,
      map: (doc) => ({
        label: `${doc.sessionType || 'SESSION'} ${doc.scheduledDate ? new Date(doc.scheduledDate).toISOString().slice(0, 10) : doc._id?.toString()}`,
        code: doc._id?.toString(),
        summary: {
          sessionType: doc.sessionType,
          status: doc.status,
          scheduledDate: doc.scheduledDate,
          scheduledStartTime: doc.scheduledStartTime,
          scheduledEndTime: doc.scheduledEndTime,
          durationMinutes: doc.durationMinutes,
          sessionNumber: doc.sessionNumber,
          topicsCovered: doc.topicsCovered,
        },
      }),
    }, query, limit);
  }

  private async searchModel(config: SearchConfig, query: string, limit: number): Promise<AiEntityCandidate[]> {
    const textFilter = this.buildTextSearchFilter(config.fields, query);
    const primaryFilter = this.combineFilters(config.scopeFilter, textFilter);
    const searchLimit = Math.max(40, limit * 12);
    let docs = await config.model
      .find(primaryFilter)
      .select(config.select)
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(searchLimit)
      .lean();

    if (docs.length === 0 && this.shouldFallbackScan(query)) {
      docs = await config.model
        .find(config.scopeFilter)
        .select(config.select)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(searchLimit)
        .lean();
    }

    return docs
      .map((doc: any) => this.toCandidate(config, doc, query))
      .filter((candidate: AiEntityCandidate | null): candidate is AiEntityCandidate =>
        Boolean(candidate && candidate.score >= MIN_CANDIDATE_SCORE),
      );
  }

  private toCandidate(config: SearchConfig, doc: any, query: string): AiEntityCandidate | null {
    if (!doc?._id) return null;

    const fields = config.fields.flatMap((field) =>
      this.getPathValues(doc, field.path).map((value) => ({
        field: field.label,
        value,
        weight: field.weight,
      })),
    );
    const score = this.scoreValues(query, fields);
    const mapped = config.map(doc);

    return {
      type: config.type,
      id: doc._id.toString(),
      label: mapped.label,
      code: mapped.code,
      score: score.score,
      confidence: this.toConfidence(score.score),
      matchedFields: score.matchedFields,
      summary: mapped.summary,
    };
  }

  private async getScopeFilter(type: SearchableEntityType, user: JwtPayload): Promise<FilterQuery<any> | null> {
    const actorId = this.toObjectId(user.sub || user._id || user.userId);
    if (!actorId) return null;

    if (this.hasGlobalEntityRead(user.role, type)) {
      return {};
    }

    switch (type) {
      case AiEntityType.USER:
        return { _id: actorId };
      case AiEntityType.PARENT:
        return user.role === Role.PARENT ? { _id: actorId } : null;
      case AiEntityType.TEACHER:
        return [Role.TEACHER, Role.EXPERIENCE_TEACHER].includes(user.role)
          ? { _id: actorId }
          : null;
      case AiEntityType.STUDENT:
        return this.getStudentScopeFilter(user, actorId);
      case AiEntityType.CLASS:
        return this.getClassScopeFilter(user, actorId);
      case AiEntityType.INVOICE:
        return this.getInvoiceScopeFilter(user, actorId);
      case AiEntityType.ORDER:
        return this.getOrderScopeFilter(user, actorId);
      case AiEntityType.LEAD:
        return user.role === Role.SALE ? { saleId: actorId } : null;
      case AiEntityType.TICKET:
        return this.getTicketScopeFilter(user, actorId);
      case AiEntityType.SESSION:
        return this.getSessionScopeFilter(user, actorId);
      case AiEntityType.AD_GROUP:
        return [Role.ADSMANAGER, Role.SHAREHOLDER].includes(user.role) ? {} : null;
      default:
        return null;
    }
  }

  private hasGlobalEntityRead(role: Role, type: SearchableEntityType): boolean {
    if ([Role.DIRECTOR, Role.OPS].includes(role)) return true;
    if (role === Role.ACCOUNTING) {
      return [
        AiEntityType.USER,
        AiEntityType.PARENT,
        AiEntityType.TEACHER,
        AiEntityType.STUDENT,
        AiEntityType.CLASS,
        AiEntityType.INVOICE,
        AiEntityType.ORDER,
        AiEntityType.TICKET,
        AiEntityType.SESSION,
        AiEntityType.AD_GROUP,
      ].includes(type);
    }
    if (role === Role.ADSMANAGER) {
      return [AiEntityType.AD_GROUP, AiEntityType.LEAD, AiEntityType.ORDER].includes(type);
    }
    return false;
  }

  private async getStudentScopeFilter(user: JwtPayload, actorId: Types.ObjectId): Promise<FilterQuery<any> | null> {
    if (user.role === Role.PARENT) {
      return { $or: [{ parentUserId: actorId }, { parentUserIds: actorId }] };
    }
    if (user.role === Role.STUDENT) {
      return { studentUserId: actorId };
    }
    if (user.role === Role.SALE) {
      return { saleId: actorId };
    }
    if ([Role.TEACHER, Role.EXPERIENCE_TEACHER].includes(user.role)) {
      const studentIds = await this.getVisibleStudentIdsForTeacher(actorId);
      return studentIds.length ? { _id: { $in: studentIds } } : this.noResultFilter();
    }
    return null;
  }

  private async getClassScopeFilter(user: JwtPayload, actorId: Types.ObjectId): Promise<FilterQuery<any> | null> {
    if (user.role === Role.SALE) {
      return { sale: actorId };
    }
    if ([Role.TEACHER, Role.EXPERIENCE_TEACHER].includes(user.role)) {
      return {
        $or: [
          { teacher: actorId },
          { 'coTeachers.teacherId': actorId },
          { 'studentConfigs.teacherSlots.teacherId': actorId },
        ],
      };
    }
    if ([Role.PARENT, Role.STUDENT].includes(user.role)) {
      const studentIds = await this.getVisibleStudentIdsForUser(user, actorId);
      return studentIds.length ? { students: { $in: studentIds } } : this.noResultFilter();
    }
    return null;
  }

  private async getInvoiceScopeFilter(user: JwtPayload, actorId: Types.ObjectId): Promise<FilterQuery<any> | null> {
    if (user.role === Role.SALE) {
      return { saleId: actorId };
    }
    if ([Role.PARENT, Role.STUDENT].includes(user.role)) {
      const studentIds = await this.getVisibleStudentIdsForUser(user, actorId);
      return studentIds.length ? { studentId: { $in: studentIds } } : this.noResultFilter();
    }
    return null;
  }

  private getOrderScopeFilter(user: JwtPayload, actorId: Types.ObjectId): FilterQuery<any> | null {
    if (user.role === Role.SALE) {
      return { saleId: actorId };
    }
    if (user.role === Role.PARENT) {
      return { parentUserId: actorId };
    }
    return null;
  }

  private getTicketScopeFilter(user: JwtPayload, actorId: Types.ObjectId): FilterQuery<any> | null {
    if (user.role === Role.PARENT) {
      return { $or: [{ createdBy: actorId }, { parentId: actorId }] };
    }
    if ([Role.TEACHER, Role.EXPERIENCE_TEACHER].includes(user.role)) {
      return { $or: [{ createdBy: actorId }, { teacherId: actorId }] };
    }
    if (user.role === Role.STUDENT) {
      return { createdBy: actorId };
    }
    return null;
  }

  private async getSessionScopeFilter(user: JwtPayload, actorId: Types.ObjectId): Promise<FilterQuery<any> | null> {
    if (user.role === Role.SALE) {
      const studentIds = await this.getVisibleStudentIdsForUser(user, actorId);
      return studentIds.length ? { studentId: { $in: studentIds } } : this.noResultFilter();
    }
    if ([Role.TEACHER, Role.EXPERIENCE_TEACHER].includes(user.role)) {
      return { teacherId: actorId };
    }
    if (user.role === Role.PARENT) {
      return { parentUserId: actorId };
    }
    if (user.role === Role.STUDENT) {
      const studentIds = await this.getVisibleStudentIdsForUser(user, actorId);
      return studentIds.length ? { studentId: { $in: studentIds } } : this.noResultFilter();
    }
    return null;
  }

  private async getVisibleStudentIdsForUser(user: JwtPayload, actorId: Types.ObjectId): Promise<Types.ObjectId[]> {
    if (user.role === Role.PARENT) {
      const students = await this.studentModel
        .find({ $or: [{ parentUserId: actorId }, { parentUserIds: actorId }] })
        .select('_id')
        .limit(300)
        .lean();
      return students.map((student: any) => student._id).filter(Boolean);
    }

    if (user.role === Role.STUDENT) {
      const students = await this.studentModel
        .find({ studentUserId: actorId })
        .select('_id')
        .limit(20)
        .lean();
      return students.map((student: any) => student._id).filter(Boolean);
    }

    if (user.role === Role.SALE) {
      const students = await this.studentModel
        .find({ saleId: actorId })
        .select('_id')
        .limit(500)
        .lean();
      return students.map((student: any) => student._id).filter(Boolean);
    }

    if ([Role.TEACHER, Role.EXPERIENCE_TEACHER].includes(user.role)) {
      return this.getVisibleStudentIdsForTeacher(actorId);
    }

    return [];
  }

  private async getVisibleStudentIdsForTeacher(actorId: Types.ObjectId): Promise<Types.ObjectId[]> {
    const classes = await this.classroomModel
      .find({
        $or: [
          { teacher: actorId },
          { 'coTeachers.teacherId': actorId },
          { 'studentConfigs.teacherSlots.teacherId': actorId },
        ],
      })
      .select('students studentConfigs.studentId')
      .limit(300)
      .lean();
    const ids = new Map<string, Types.ObjectId>();

    for (const classroom of classes as any[]) {
      for (const studentId of classroom.students || []) {
        if (studentId) ids.set(studentId.toString(), studentId);
      }
      for (const config of classroom.studentConfigs || []) {
        if (config?.studentId) ids.set(config.studentId.toString(), config.studentId);
      }
    }

    return Array.from(ids.values());
  }

  private resolveRequestedTypes(requestedType: AiEntityType, query: string): SearchableEntityType[] {
    if (requestedType !== AiEntityType.AUTO) {
      return [requestedType as SearchableEntityType];
    }

    const inferred = this.inferEntityTypesFromText(query);
    if (inferred.length) return inferred;

    return [
      AiEntityType.USER,
      AiEntityType.STUDENT,
      AiEntityType.CLASS,
      AiEntityType.INVOICE,
      AiEntityType.ORDER,
      AiEntityType.LEAD,
      AiEntityType.TICKET,
      AiEntityType.SESSION,
      AiEntityType.AD_GROUP,
    ];
  }

  private inferEntityTypesFromText(text: string): SearchableEntityType[] {
    const normalized = this.normalizeText(text);
    const found: SearchableEntityType[] = [];
    const add = (type: SearchableEntityType) => {
      if (!found.includes(type)) found.push(type);
    };

    if (/\b(tkt|ticket|khieu nai|yeu cau ho tro)\b/.test(normalized)) add(AiEntityType.TICKET);
    if (/\b(session|buoi hoc|buoihoc|lich hoc|lich day)\b/.test(normalized)) add(AiEntityType.SESSION);
    if (/\b(inv|invoice|hoa don|hoadon)\b/.test(normalized)) add(AiEntityType.INVOICE);
    if (/\b(ord|order|don hang|donhang)\b/.test(normalized)) add(AiEntityType.ORDER);
    if (/\b(lead|khach tiem nang|tiem nang)\b/.test(normalized)) add(AiEntityType.LEAD);
    if (/\b(cls|class|lop|ma lop)\b/.test(normalized)) add(AiEntityType.CLASS);
    if (/\b(stu|student|hoc vien|hocvien|hoc sinh|hocsinh|hs)\b/.test(normalized)) add(AiEntityType.STUDENT);
    if (/\b(parent|phu huynh|phuhuynh)\b/.test(normalized)) {
      add(AiEntityType.PARENT);
      add(AiEntityType.STUDENT);
      add(AiEntityType.ORDER);
      add(AiEntityType.LEAD);
    }
    if (/\b(teacher|giao vien|giaovien|gv|thay|co)\b/.test(normalized)) {
      add(AiEntityType.TEACHER);
      add(AiEntityType.CLASS);
    }
    if (/\b(adg|ad group|campaign|chien dich|nhom quang cao|quang cao)\b/.test(normalized)) {
      add(AiEntityType.AD_GROUP);
    }

    const compact = normalized.replace(/\s+/g, '');
    if (/inv[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.INVOICE);
    if (/ord[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.ORDER);
    if (/lead[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.LEAD);
    if (/tkt[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.TICKET);
    if (/ses[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.SESSION);
    if (/adg[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.AD_GROUP);
    if (/stu[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.STUDENT);
    if (/cls[-_a-z0-9]*\d/.test(compact)) add(AiEntityType.CLASS);

    return found;
  }

  private shouldAttemptChatResolution(message: string): boolean {
    const normalized = this.normalizeText(message);
    return this.inferEntityTypesFromText(message).length > 0
      || /\b[A-Za-z]{2,}[-_]*\d[A-Za-z0-9-_]*\b/.test(message)
      || /\b(ho so|doi tuong|nguoi dung|tai khoan)\b/.test(normalized);
  }

  private buildTextSearchFilter(fields: SearchFieldSpec[], query: string): FilterQuery<any> {
    const parts = this.buildSearchParts(query);
    if (!parts.length) return {};

    return {
      $or: fields.flatMap((field) =>
        parts.map((part) => ({
          [field.path]: {
            $regex: this.toVietnameseLooseRegex(part),
            $options: 'i',
          },
        })),
      ),
    };
  }

  private buildSearchParts(query: string): string[] {
    const normalized = this.normalizeText(query);
    const rawCodeParts = query.match(/\b[A-Za-z]{2,}[-_]*[A-Za-z0-9-_]*\d[A-Za-z0-9-_]*\b/g) || [];
    const tokens = normalized
      .split(' ')
      .filter((token) => token.length >= 2 && !SEARCH_STOPWORDS.has(token))
      .slice(0, 8);
    const parts = [...rawCodeParts, ...tokens];

    if (normalized.length <= 40 && normalized.length >= 2) {
      parts.unshift(query.trim());
    }

    return Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean))).slice(0, 10);
  }

  private toVietnameseLooseRegex(value: string): string {
    return Array.from(value.toLowerCase()).map((char) => {
      const normalized = this.normalizeText(char);
      const base = normalized.length === 1 ? normalized : char;
      if (VIETNAMESE_CHAR_CLASSES[base]) {
        return VIETNAMESE_CHAR_CLASSES[base];
      }
      if (/\s/.test(char) || /[-_./]/.test(char)) {
        return '[\\s\\-_./]*';
      }
      return this.escapeRegex(char);
    }).join('');
  }

  private scoreSingleValue(query: string, value: unknown): number {
    const q = this.normalizeText(query);
    const v = this.normalizeText(value);
    if (!q || !v) return 0;

    const qCompact = q.replace(/\s+/g, '');
    const vCompact = v.replace(/\s+/g, '');
    if (qCompact === vCompact) return 1;

    const qDigits = q.replace(/\D/g, '');
    const vDigits = v.replace(/\D/g, '');
    if (qDigits.length >= 6 && vDigits.includes(qDigits)) return 0.98;

    if (q === v) return 0.95;
    if (qCompact.length >= 3 && vCompact.includes(qCompact)) {
      return qCompact.length / vCompact.length >= 0.7 ? 0.9 : 0.82;
    }
    if (vCompact.length >= 3 && qCompact.includes(vCompact)) {
      return vCompact.length / qCompact.length >= 0.45 ? 0.88 : 0.76;
    }

    const qTokens = q.split(' ').filter(Boolean);
    const vTokens = v.split(' ').filter(Boolean);
    const windowSimilarity = this.bestTokenWindowSimilarity(qTokens, vTokens);
    if (windowSimilarity >= 0.74) {
      return Math.min(0.9, 0.46 + windowSimilarity * 0.47);
    }

    const overlapScore = this.tokenOverlapScore(qTokens, vTokens);
    const editSimilarity = this.levenshteinSimilarity(q, v);
    const editScore = editSimilarity >= 0.72 ? 0.42 + editSimilarity * 0.48 : 0;

    return Math.max(overlapScore, editScore);
  }

  private tokenOverlapScore(queryTokens: string[], valueTokens: string[]): number {
    if (!queryTokens.length || !valueTokens.length) return 0;

    let overlap = 0;
    for (const valueToken of valueTokens) {
      if (queryTokens.some((queryToken) =>
        queryToken === valueToken
        || (valueToken.length >= 3 && queryToken.includes(valueToken))
        || (queryToken.length >= 3 && valueToken.includes(queryToken)),
      )) {
        overlap += 1;
      }
    }

    const ratio = overlap / valueTokens.length;
    if (ratio === 0) return 0;
    return Math.min(0.78, 0.44 + ratio * 0.34);
  }

  private bestTokenWindowSimilarity(queryTokens: string[], valueTokens: string[]): number {
    if (!queryTokens.length || !valueTokens.length) return 0;
    if (queryTokens.length < valueTokens.length) {
      return this.levenshteinSimilarity(queryTokens.join(' '), valueTokens.join(' '));
    }

    let best = 0;
    const windowSize = valueTokens.length;
    for (let index = 0; index <= queryTokens.length - windowSize; index += 1) {
      const windowValue = queryTokens.slice(index, index + windowSize).join(' ');
      best = Math.max(best, this.levenshteinSimilarity(windowValue, valueTokens.join(' ')));
    }
    return best;
  }

  private levenshteinSimilarity(left: string, right: string): number {
    if (left === right) return 1;
    if (!left || !right) return 0;

    const distance = this.levenshteinDistance(left, right);
    return 1 - distance / Math.max(left.length, right.length);
  }

  private levenshteinDistance(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = Array.from({ length: right.length + 1 }, () => 0);

    for (let i = 1; i <= left.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        current[j] = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + cost,
        );
      }
      for (let j = 0; j <= right.length; j += 1) {
        previous[j] = current[j];
      }
    }

    return previous[right.length];
  }

  private shouldFallbackScan(query: string): boolean {
    return this.normalizeText(query).split(' ').filter(Boolean).length <= 2;
  }

  private getPathValues(doc: any, path: string): unknown[] {
    const segments = path.split('.');
    const values = this.resolvePathValues(doc, segments);
    return values.filter((value) => value !== undefined && value !== null && value !== '');
  }

  private resolvePathValues(value: unknown, segments: string[]): unknown[] {
    if (value === undefined || value === null) return [];
    if (!segments.length) return Array.isArray(value) ? value : [value];
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.resolvePathValues(item, segments));
    }
    if (typeof value !== 'object') return [];
    const [head, ...tail] = segments;
    return this.resolvePathValues((value as Record<string, unknown>)[head], tail);
  }

  private flattenValues(value: unknown): unknown[] {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value.flatMap((item) => this.flattenValues(item));
    return [value];
  }

  private dedupeCandidates(candidates: AiEntityCandidate[]): AiEntityCandidate[] {
    const byKey = new Map<string, AiEntityCandidate>();
    for (const candidate of candidates) {
      const key = `${candidate.type}:${candidate.id}`;
      const existing = byKey.get(key);
      if (!existing || candidate.score > existing.score) {
        byKey.set(key, candidate);
      }
    }
    return Array.from(byKey.values());
  }

  private toConfidence(score: number): AiEntityConfidence {
    if (score >= 0.9) return 'HIGH';
    if (score >= 0.7) return 'MEDIUM';
    return 'LOW';
  }

  private combineFilters(...filters: Array<FilterQuery<any> | null | undefined>): FilterQuery<any> {
    const active = filters.filter((filter): filter is FilterQuery<any> =>
      Boolean(filter && Object.keys(filter).length),
    );
    if (!active.length) return {};
    if (active.length === 1) return active[0];
    return { $and: active };
  }

  private noResultFilter(): FilterQuery<any> {
    return { _id: { $exists: false } };
  }

  private toObjectId(value?: string): Types.ObjectId | null {
    if (!value || !Types.ObjectId.isValid(value)) return null;
    return new Types.ObjectId(value);
  }

  private parseLimit(value?: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ENTITY_LIMIT;
    return Math.min(Math.floor(parsed), MAX_ENTITY_LIMIT);
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
