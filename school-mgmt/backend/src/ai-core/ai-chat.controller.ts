import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AiChatService } from './ai-chat.service';
import { AiChatDto } from './dto/ai-chat.dto';
import {
  QueryAiConversationCorpusDto,
  QueryAiMessagesDto,
  QueryAiSessionsDto,
} from './dto/query-ai-messages.dto';
import { ResolveAiEntityDto } from './dto/resolve-entity.dto';
import {
  ApproveAiActionDto,
  ConfirmAiActionDto,
  PreviewAiActionDto,
  QueryAiActionsDto,
  RejectAiActionDto,
} from './dto/ai-action.dto';
import { AiPolicyEngineService } from './policy-engine.service';
import { AiAssistantResolverService } from './assistant-resolver.service';
import { AiEntityResolverService } from './entity-resolver.service';
import { AiActionDraftService } from './action-draft.service';
import { getAiCoreToolCatalog } from './catalogs/tool.catalog';
import { getAiCoreSituationCatalog } from './catalogs/situation.catalog';

const AI_CORE_ALLOWED_ROLES = [
  Role.DIRECTOR,
  Role.ACCOUNTING,
  Role.OPS,
  Role.TEACHER,
  Role.EXPERIENCE_TEACHER,
  Role.PARENT,
  Role.STUDENT,
  Role.SALE,
  Role.ADSMANAGER,
  Role.SHAREHOLDER,
];

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...AI_CORE_ALLOWED_ROLES)
export class AiChatController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly assistantResolver: AiAssistantResolverService,
    private readonly policyEngine: AiPolicyEngineService,
    private readonly entityResolver: AiEntityResolverService,
    private readonly actionDraftService: AiActionDraftService,
  ) {}

  @Post('chat')
  chat(@Body() dto: AiChatDto, @Req() req: AuthenticatedRequest) {
    return this.aiChatService.chat(dto, req.user);
  }

  @Get('sessions')
  getMySessions(@Query() query: QueryAiSessionsDto, @Req() req: AuthenticatedRequest) {
    return this.aiChatService.getMySessions(query, req.user);
  }

  @Get('messages')
  getMessages(@Query() query: QueryAiMessagesDto, @Req() req: AuthenticatedRequest) {
    return this.aiChatService.getMessages(query, req.user);
  }

  @Get('conversation-corpus')
  @Roles(Role.DIRECTOR, Role.OPS)
  getConversationCorpus(@Query() query: QueryAiConversationCorpusDto) {
    return this.aiChatService.getConversationCorpus(query);
  }

  @Get('entities/resolve')
  resolveEntity(@Query() query: ResolveAiEntityDto, @Req() req: AuthenticatedRequest) {
    if (query.assistantType) {
      this.assistantResolver.resolveAssistantType(req.user, query.assistantType);
    }
    return this.entityResolver.resolve(query, req.user);
  }

  @Post('actions/preview')
  previewAction(@Body() dto: PreviewAiActionDto, @Req() req: AuthenticatedRequest) {
    const assistantType = this.assistantResolver.resolveAssistantType(req.user, dto.assistantType);
    return this.actionDraftService.createPreview(dto, req.user, assistantType);
  }

  @Get('actions')
  getActions(@Query() query: QueryAiActionsDto, @Req() req: AuthenticatedRequest) {
    const assistantType = this.assistantResolver.resolveAssistantType(req.user, query.assistantType);
    return this.actionDraftService.listMyActions(query, req.user, assistantType);
  }

  @Get('actions/approvals')
  @Roles(Role.DIRECTOR)
  getApprovalActions(@Query() query: QueryAiActionsDto, @Req() req: AuthenticatedRequest) {
    const assistantType = this.assistantResolver.resolveAssistantType(req.user, query.assistantType);
    return this.actionDraftService.listApprovalActions(query, req.user, assistantType);
  }

  @Post('actions/:id/confirm')
  confirmAction(
    @Param('id') id: string,
    @Body() dto: ConfirmAiActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.actionDraftService.confirmAction(id, dto, req.user);
  }

  @Post('actions/:id/reject')
  rejectAction(
    @Param('id') id: string,
    @Body() dto: RejectAiActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.actionDraftService.rejectAction(id, dto, req.user);
  }

  @Post('actions/:id/approve')
  @Roles(Role.DIRECTOR)
  approveAction(
    @Param('id') id: string,
    @Body() dto: ApproveAiActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.actionDraftService.approveAction(id, dto, req.user);
  }

  @Get('tools')
  getTools(@Query() query: QueryAiSessionsDto, @Req() req: AuthenticatedRequest) {
    const assistantType = this.assistantResolver.resolveAssistantType(req.user, query.assistantType);
    return getAiCoreToolCatalog().filter((tool) =>
      this.policyEngine.isToolAllowed(req.user, assistantType, tool),
    );
  }

  @Get('situations')
  getSituations(@Query() query: QueryAiSessionsDto, @Req() req: AuthenticatedRequest) {
    const assistantType = this.assistantResolver.resolveAssistantType(req.user, query.assistantType);
    return getAiCoreSituationCatalog().filter((situation) =>
      situation.allowedAssistantTypes.includes(assistantType)
      && situation.allowedRoles.includes(req.user.role),
    );
  }
}
