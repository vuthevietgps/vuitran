import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';

import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { Lead, LeadDocument, LeadStatus } from '../leads/schemas/lead.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { FanpageDocument } from './schemas/fanpage.schema';

import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { QueryFanpageDto } from './dto/query-fanpage.dto';
import { CreateOpenAITokenDto } from './dto/create-openai-token.dto';
import { UpdateOpenAITokenDto } from './dto/update-openai-token.dto';
import { CreateAiAssistantProfileDto } from './dto/create-ai-assistant-profile.dto';
import { UpdateAiAssistantProfileDto } from './dto/update-ai-assistant-profile.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { CreateLeadFromConvDto } from './dto/create-lead-from-conv.dto';
import { CreateOrderFromConvDto } from './dto/create-order-from-conv.dto';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/schemas/audit-log.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';
import { MarketingAttributionService } from '../marketing-attribution/marketing-attribution.service';
import {
  ParentAttributionSourceType,
} from '../marketing-attribution/schemas/parent-attribution.schema';

import { ChatbotConfigService } from './chatbot-config.service';
import { ChatbotMessagingService } from './chatbot-messaging.service';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private auditLogService: AuditLogService,
    private marketingAttributionService: MarketingAttributionService,
    private chatbotConfigService: ChatbotConfigService,
    private chatbotMessagingService: ChatbotMessagingService,
  ) {}

  // ─── Delegated: Fanpage CRUD ────────────────────────────────

  createFanpage(dto: CreateFanpageDto, user: JwtPayload) {
    return this.chatbotConfigService.createFanpage(dto, user);
  }

  findAllFanpages(query: QueryFanpageDto) {
    return this.chatbotConfigService.findAllFanpages(query);
  }

  findOneFanpage(id: string) {
    return this.chatbotConfigService.findOneFanpage(id);
  }

  updateFanpage(id: string, dto: UpdateFanpageDto) {
    return this.chatbotConfigService.updateFanpage(id, dto);
  }

  deleteFanpage(id: string) {
    return this.chatbotConfigService.deleteFanpage(id);
  }

  // ─── Delegated: OpenAI Token CRUD ───────────────────────────

  createOpenAIToken(dto: CreateOpenAITokenDto, user: JwtPayload) {
    return this.chatbotConfigService.createOpenAIToken(dto, user);
  }

  findAllOpenAITokens() {
    return this.chatbotConfigService.findAllOpenAITokens();
  }

  updateOpenAIToken(id: string, dto: UpdateOpenAITokenDto) {
    return this.chatbotConfigService.updateOpenAIToken(id, dto);
  }

  deleteOpenAIToken(id: string) {
    return this.chatbotConfigService.deleteOpenAIToken(id);
  }

  // ─── Delegated: AI Assistant Profile CRUD ───────────────────

  createAiAssistantProfile(dto: CreateAiAssistantProfileDto, user: JwtPayload) {
    return this.chatbotConfigService.createAiAssistantProfile(dto, user);
  }

  findAllAiAssistantProfiles() {
    return this.chatbotConfigService.findAllAiAssistantProfiles();
  }

  updateAiAssistantProfile(id: string, dto: UpdateAiAssistantProfileDto) {
    return this.chatbotConfigService.updateAiAssistantProfile(id, dto);
  }

  deleteAiAssistantProfile(id: string) {
    return this.chatbotConfigService.deleteAiAssistantProfile(id);
  }

  // ─── Delegated: OpenAI Key Management ───────────────────────

  getDecryptedOpenAIKey(tokenId: string | Types.ObjectId) {
    return this.chatbotConfigService.getDecryptedOpenAIKey(tokenId);
  }

  // ─── Delegated: Conversation Management ─────────────────────

  findOrCreateConversation(fanpageId: string, platformUserId: string, customerName?: string, adRefParam?: string) {
    return this.chatbotMessagingService.findOrCreateConversation(fanpageId, platformUserId, customerName, adRefParam);
  }

  findAllConversations(query: QueryConversationDto) {
    return this.chatbotMessagingService.findAllConversations(query);
  }

  findOneConversation(id: string) {
    return this.chatbotMessagingService.findOneConversation(id);
  }

  updateConversation(id: string, dto: UpdateConversationDto) {
    return this.chatbotMessagingService.updateConversation(id, dto);
  }

  takeoverConversation(id: string, user: JwtPayload) {
    return this.chatbotMessagingService.takeoverConversation(id, user);
  }

  releaseConversation(id: string) {
    return this.chatbotMessagingService.releaseConversation(id);
  }

  // ─── Delegated: Message Handling ────────────────────────────

  saveMessage(conversationId: string | Types.ObjectId, content: string, senderType: string, senderName?: string, senderUserId?: string, platformMessageId?: string) {
    return this.chatbotMessagingService.saveMessage(conversationId, content, senderType, senderName, senderUserId, platformMessageId);
  }

  getMessages(conversationId: string, query: QueryMessageDto) {
    return this.chatbotMessagingService.getMessages(conversationId, query);
  }

  sendHumanReply(conversationId: string, dto: SendMessageDto, user: JwtPayload) {
    return this.chatbotMessagingService.sendHumanReply(conversationId, dto, user);
  }

  handleIncomingCustomerMessage(fanpageId: string, platformUserId: string, content: string, customerName?: string, adRefParam?: string, platformMessageId?: string) {
    return this.chatbotMessagingService.handleIncomingCustomerMessage(fanpageId, platformUserId, content, customerName, adRefParam, platformMessageId);
  }

  // ─── Delegated: Fanpage lookup ──────────────────────────────

  findFanpageByPageId(pageId: string) {
    return this.chatbotConfigService.findFanpageByPageId(pageId);
  }

  getDecryptedAppSecret(fanpage: FanpageDocument) {
    return this.chatbotConfigService.getDecryptedAppSecret(fanpage);
  }

  // ─── Lead/Order Creation from Conversation ──────────────────

  private getActorId(user: JwtPayload): string {
    return user?.sub ?? user?._id ?? (user as any)?.userId;
  }

  private async findSaleUser(saleId: string | Types.ObjectId): Promise<any> {
    const sale = await this.userModel
      .findOne({ _id: saleId, role: Role.SALE })
      .select('_id fullName email')
      .lean();
    if (!sale) {
      throw new BadRequestException('Sale phu trach khong hop le');
    }
    return sale;
  }

  private async resolveConversationSaleOwner(
    conv: ConversationDocument,
    dto: { saleId?: string },
    user: JwtPayload,
    targetLabel: 'lead' | 'don hang',
  ): Promise<{ saleId: Types.ObjectId; saleName: string }> {
    const actorId = this.getActorId(user);
    if (user.role === Role.SALE) {
      return {
        saleId: new Types.ObjectId(actorId),
        saleName: user.fullName || user.email,
      };
    }

    let lockedOwnerId: string | null = null;
    let lockedOwnerName: string | null = null;

    if (conv.leadId) {
      const lead = await this.leadModel.findById(conv.leadId).select('saleId saleName').lean();
      if (!lead) {
        throw new BadRequestException('Lead lien ket khong ton tai');
      }
      if (lead.saleId) {
        lockedOwnerId = lead.saleId.toString();
        lockedOwnerName = (lead as any).saleName || null;
      }
    }

    if (!lockedOwnerId && conv.assignedAgentId) {
      const assignedSale = await this.userModel
        .findOne({ _id: conv.assignedAgentId, role: Role.SALE })
        .select('_id fullName email')
        .lean();
      if (assignedSale) {
        lockedOwnerId = assignedSale._id.toString();
        lockedOwnerName = assignedSale.fullName || assignedSale.email;
      }
    }

    if (dto.saleId) {
      const requestedSale = await this.findSaleUser(dto.saleId);
      if (lockedOwnerId && requestedSale._id.toString() !== lockedOwnerId) {
        throw new BadRequestException(
          targetLabel === 'lead'
            ? 'Hoi thoai da gan cho sale khac. Hay chuyen owner truoc khi tao lead'
            : 'Hoi thoai/lead da gan cho sale khac. Hay chuyen owner truoc khi tao don',
        );
      }
      return {
        saleId: requestedSale._id as Types.ObjectId,
        saleName: requestedSale.fullName || requestedSale.email,
      };
    }

    if (lockedOwnerId) {
      if (lockedOwnerName) {
        return {
          saleId: new Types.ObjectId(lockedOwnerId),
          saleName: lockedOwnerName,
        };
      }
      const inferredSale = await this.findSaleUser(lockedOwnerId);
      return {
        saleId: inferredSale._id as Types.ObjectId,
        saleName: inferredSale.fullName || inferredSale.email,
      };
    }

    throw new BadRequestException(
      targetLabel === 'lead'
        ? 'Phai chon sale phu trach cho lead'
        : 'Phai chon sale phu trach cho don hang',
    );
  }

  async createLeadFromConversation(conversationId: string, dto: CreateLeadFromConvDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    if (conv.leadId) {
      throw new BadRequestException('Hội thoại này đã có lead');
    }

    const saleOwner = await this.resolveConversationSaleOwner(conv, dto, user, 'lead');

    // Generate lead code outside transaction (read-only, race-safe via the unique index)
    const year = new Date().getFullYear();
    const prefix = `LEAD-${year}-`;
    const last = await this.leadModel
      .findOne({ leadCode: { $regex: `^${prefix}` } })
      .sort({ leadCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = last.leadCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const leadCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const sourceMap: Record<string, string> = { FACEBOOK: 'FACEBOOK', TIKTOK: 'TIKTOK' };

    const mongoSession = await this.connection.startSession();
    let saved: LeadDocument;
    try {
      await mongoSession.withTransaction(async () => {
        const lead = new this.leadModel({
          leadCode,
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          parentEmail: dto.parentEmail,
          studentName: dto.studentName,
          interestedSubjects: dto.interestedSubjects,
          source: sourceMap[conv.platform] || 'OTHER',
          adGroupId: conv.adGroupId,
          adGroupName: conv.adGroupName,
          saleId: saleOwner.saleId,
          saleName: saleOwner.saleName,
          assignedAt: new Date(),
          status: LeadStatus.NEW,
          notes: dto.notes,
          assignmentHistory: [{
            saleId: saleOwner.saleId,
            saleName: saleOwner.saleName,
            assignedAt: new Date(),
          }],
        });

        saved = await lead.save({ session: mongoSession });

        // Link lead to conversation atomically
        conv.leadId = saved._id as Types.ObjectId;
        conv.customerName = dto.parentName;
        conv.customerPhone = dto.parentPhone;
        await conv.save({ session: mongoSession });

        await this.marketingAttributionService.upsertParentAttribution({
          parentPhone: dto.parentPhone,
          adGroupId: conv.adGroupId,
          adGroupName: conv.adGroupName,
          platform: conv.platform,
          adRefParam: conv.adRefParam,
          sourceConversationId: conv._id,
          sourceLeadId: saved._id,
          sourceType: ParentAttributionSourceType.LEAD,
        }, mongoSession);
      });
    } finally {
      await mongoSession.endSession();
    }

    // Audit log is intentionally outside the transaction — it must never
    // roll back a successful Lead creation.
    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'LEADS' as any,
      targetId: saved!._id?.toString(),
      targetName: saved!.leadCode,
      description: `Tạo lead từ hội thoại ${conv.conversationCode}: ${saved!.parentName} - ${saved!.parentPhone}`,
    });

    return saved!;
  }

  async createOrderFromConversation(conversationId: string, dto: CreateOrderFromConvDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    if (conv.orderId) {
      throw new BadRequestException('Hội thoại này đã có đơn hàng');
    }

    const saleOwner = await this.resolveConversationSaleOwner(conv, dto, user, 'don hang');

    // Generate order code outside transaction (read-only)
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    const last = await this.orderModel
      .findOne({ orderCode: { $regex: `^${prefix}` } })
      .sort({ orderCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = (last as any).orderCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const orderCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const sourceMap: Record<string, string> = { FACEBOOK: 'FACEBOOK', TIKTOK: 'TIKTOK' };

    const items = dto.items.map(item => ({
      productId: new Types.ObjectId(item.productId),
      productName: item.productName,
      sessions: item.quantity,
      sessionDuration: 90,
      pricePerSession: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = dto.discountAmount || 0;
    const finalAmount = totalAmount - discountAmount;

    const mongoSession = await this.connection.startSession();
    let saved: any;
    try {
      await mongoSession.withTransaction(async () => {
        const order = new this.orderModel({
          orderCode,
          orderType: dto.orderType || 'NEW_ENROLLMENT',
          parentName: dto.parentName,
          parentPhone: dto.parentPhone,
          studentName: dto.studentName,
          leadSource: sourceMap[conv.platform] || 'OTHER',
          leadId: conv.leadId,
          adGroupId: conv.adGroupId,
          adGroupName: conv.adGroupName,
          items,
          totalAmount,
          discountAmount,
          discountReason: dto.discountReason,
          finalAmount,
          paymentPlan: dto.paymentPlan || 'FULL',
          status: 'DRAFT',
          saleId: saleOwner.saleId,
          saleName: saleOwner.saleName,
          consultationNotes: dto.notes,
        });

        saved = await order.save({ session: mongoSession });

        // Link order to conversation atomically
        conv.orderId = saved._id as Types.ObjectId;
        conv.customerName = dto.parentName;
        conv.customerPhone = dto.parentPhone;
        await conv.save({ session: mongoSession });

        await this.marketingAttributionService.upsertParentAttribution({
          parentPhone: dto.parentPhone,
          adGroupId: saved.adGroupId,
          adGroupName: saved.adGroupName,
          platform: conv.platform,
          adRefParam: conv.adRefParam,
          sourceConversationId: conv._id,
          sourceLeadId: conv.leadId,
          sourceOrderId: saved._id,
          sourceType: ParentAttributionSourceType.ORDER,
        }, mongoSession);
      });
    } finally {
      await mongoSession.endSession();
    }

    // Audit log outside transaction — must not roll back a successful Order creation.
    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'ORDERS' as any,
      targetId: saved._id?.toString(),
      targetName: saved.orderCode,
      description: `Tạo đơn hàng từ hội thoại ${conv.conversationCode}: ${dto.parentName} - ${dto.parentPhone}`,
    });

    return saved;
  }
}
