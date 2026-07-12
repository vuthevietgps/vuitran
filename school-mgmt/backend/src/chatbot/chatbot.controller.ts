import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import {
  AI_ASSISTANT_PERMISSION_CATALOG,
  AI_ERP_SITUATION_CATALOG,
} from './ai-assistant-permission-catalog';

@Controller('chatbot')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  // ─── Fanpages ───────────────────────────────────────────────

  @Get('fanpages')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async findAllFanpages(@Query() query: QueryFanpageDto) {
    return this.chatbotService.findAllFanpages(query);
  }

  @Get('fanpages/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async findOneFanpage(@Param('id') id: string) {
    return this.chatbotService.findOneFanpage(id);
  }

  @Post('fanpages')
  @Roles(Role.DIRECTOR)
  async createFanpage(@Body() dto: CreateFanpageDto, @Req() req: AuthenticatedRequest) {
    return this.chatbotService.createFanpage(dto, req.user);
  }

  @Patch('fanpages/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async updateFanpage(@Param('id') id: string, @Body() dto: UpdateFanpageDto) {
    return this.chatbotService.updateFanpage(id, dto);
  }

  @Delete('fanpages/:id')
  @Roles(Role.DIRECTOR)
  async deleteFanpage(@Param('id') id: string) {
    await this.chatbotService.deleteFanpage(id);
    return { message: 'Đã xóa fanpage' };
  }

  // ─── OpenAI Tokens ──────────────────────────────────────────

  @Get('openai-tokens')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async findAllOpenAITokens() {
    return this.chatbotService.findAllOpenAITokens();
  }

  @Post('openai-tokens')
  @Roles(Role.DIRECTOR)
  async createOpenAIToken(@Body() dto: CreateOpenAITokenDto, @Req() req: AuthenticatedRequest) {
    return this.chatbotService.createOpenAIToken(dto, req.user);
  }

  @Patch('openai-tokens/:id')
  @Roles(Role.DIRECTOR)
  async updateOpenAIToken(@Param('id') id: string, @Body() dto: UpdateOpenAITokenDto) {
    return this.chatbotService.updateOpenAIToken(id, dto);
  }

  @Delete('openai-tokens/:id')
  @Roles(Role.DIRECTOR)
  async deleteOpenAIToken(@Param('id') id: string) {
    await this.chatbotService.deleteOpenAIToken(id);
    return { message: 'Đã xóa OpenAI token' };
  }

  // ─── Conversations ──────────────────────────────────────────

  @Get('ai-assistant-profiles')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ADSMANAGER)
  async findAllAiAssistantProfiles() {
    return this.chatbotService.findAllAiAssistantProfiles();
  }

  @Get('ai-permission-catalog')
  @Roles(Role.DIRECTOR)
  getAiPermissionCatalog() {
    return {
      assistants: Object.values(AI_ASSISTANT_PERMISSION_CATALOG),
      situations: AI_ERP_SITUATION_CATALOG,
    };
  }

  @Post('ai-assistant-profiles')
  @Roles(Role.DIRECTOR)
  async createAiAssistantProfile(
    @Body() dto: CreateAiAssistantProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.createAiAssistantProfile(dto, req.user);
  }

  @Patch('ai-assistant-profiles/:id')
  @Roles(Role.DIRECTOR)
  async updateAiAssistantProfile(
    @Param('id') id: string,
    @Body() dto: UpdateAiAssistantProfileDto,
  ) {
    return this.chatbotService.updateAiAssistantProfile(id, dto);
  }

  @Delete('ai-assistant-profiles/:id')
  @Roles(Role.DIRECTOR)
  async deleteAiAssistantProfile(@Param('id') id: string) {
    await this.chatbotService.deleteAiAssistantProfile(id);
    return { message: 'Da xoa AI assistant profile' };
  }

  @Get('conversations')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findAllConversations(@Query() query: QueryConversationDto) {
    return this.chatbotService.findAllConversations(query);
  }

  @Get('conversations/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findOneConversation(@Param('id') id: string) {
    return this.chatbotService.findOneConversation(id);
  }

  @Patch('conversations/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async updateConversation(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    return this.chatbotService.updateConversation(id, dto);
  }

  @Post('conversations/:id/takeover')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async takeoverConversation(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.chatbotService.takeoverConversation(id, req.user);
  }

  @Post('conversations/:id/release')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async releaseConversation(@Param('id') id: string) {
    return this.chatbotService.releaseConversation(id);
  }

  // ─── Messages ───────────────────────────────────────────────

  @Get('conversations/:id/messages')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async getMessages(@Param('id') id: string, @Query() query: QueryMessageDto) {
    return this.chatbotService.getMessages(id, query);
  }

  @Post('conversations/:id/messages')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @Req() req: AuthenticatedRequest) {
    return this.chatbotService.sendHumanReply(id, dto, req.user);
  }

  // ─── Lead/Order from Conversation ───────────────────────────

  @Post('conversations/:id/create-lead')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async createLeadFromConversation(
    @Param('id') id: string,
    @Body() dto: CreateLeadFromConvDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.createLeadFromConversation(id, dto, req.user);
  }

  @Post('conversations/:id/create-order')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async createOrderFromConversation(
    @Param('id') id: string,
    @Body() dto: CreateOrderFromConvDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.chatbotService.createOrderFromConversation(id, dto, req.user);
  }
}
