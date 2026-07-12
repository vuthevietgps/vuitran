import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';
import { AiChatService } from '../ai-core/ai-chat.service';
import { AiPolicyEngineService } from '../ai-core/policy-engine.service';
import { getAiCoreToolCatalog } from '../ai-core/catalogs/tool.catalog';
import { DirectorAiChatDto } from './dto/director-ai-chat.dto';
import { QueryDirectorAiMessagesDto } from './dto/query-director-ai-messages.dto';

@Controller('director-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DirectorAiController {
  private readonly assistantType = AiAssistantType.DIRECTOR_OPERATIONS;

  constructor(
    private readonly aiChatService: AiChatService,
    private readonly policyEngine: AiPolicyEngineService,
  ) {}

  @Get('tools')
  @Roles(Role.DIRECTOR)
  getToolCatalog(@Req() req: AuthenticatedRequest) {
    return getAiCoreToolCatalog()
      .filter((tool) => this.policyEngine.isToolAllowed(req.user, this.assistantType, tool))
      .map((tool) => this.mapTool(tool));
  }

  @Get('sessions')
  @Roles(Role.DIRECTOR)
  async getMySessions(@Req() req: AuthenticatedRequest) {
    const response = await this.aiChatService.getMySessions(
      { assistantType: this.assistantType },
      req.user,
    );
    return {
      data: response.data.map((session: any) => this.mapSession(session)),
    };
  }

  @Get('messages')
  @Roles(Role.DIRECTOR)
  async getMessages(@Query() query: QueryDirectorAiMessagesDto, @Req() req: AuthenticatedRequest) {
    const response = await this.aiChatService.getMessages(query, req.user);
    return {
      data: response.data.map((message: any) => this.mapMessage(message)),
    };
  }

  @Post('chat')
  @Roles(Role.DIRECTOR)
  async chat(@Body() dto: DirectorAiChatDto, @Req() req: AuthenticatedRequest) {
    const response = await this.aiChatService.chat(
      { ...dto, assistantType: this.assistantType },
      req.user,
    );
    return this.mapChatResponse(response);
  }

  private mapChatResponse(response: any) {
    const contextKeys = response.toolKeys || response.contextKeys || [];
    return {
      ...response,
      contextKeys,
      toolKeys: contextKeys,
    };
  }

  private mapSession(session: any) {
    const lastContextKeys = session.lastToolKeys || session.lastContextKeys || [];
    return {
      ...session,
      lastContextKeys,
      lastToolKeys: lastContextKeys,
    };
  }

  private mapMessage(message: any) {
    const contextKeys = message.toolKeys || message.contextKeys || [];
    return {
      ...message,
      contextKeys,
      toolKeys: contextKeys,
    };
  }

  private mapTool(tool: any) {
    return {
      ...tool,
      endpoint: tool.route,
      dataPolicy: tool.contextPolicy || tool.dataScope,
      defaultDateRange: tool.defaultFilters?.dateRange,
    };
  }
}
