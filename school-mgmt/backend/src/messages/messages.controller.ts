import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { SendMessageDto, SendToConversationDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly service: MessagesService) {}

  @Get('conversations')
  listConversations(@Req() req: AuthenticatedRequest) {
    return this.service.listConversations(req.user.sub);
  }

  @Get('conversations/:id')
  getConversation(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
  ) {
    return this.service.getConversation(req.user.sub, conversationId);
  }

  @Get('conversations/:id/messages')
  listMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') conversationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listMessages(
      req.user.sub,
      conversationId,
      page || 1,
      limit || 50,
    );
  }

  @Post('send')
  sendMessage(@Body() dto: SendMessageDto, @Req() req: AuthenticatedRequest) {
    return this.service.sendMessage(
      req.user.sub,
      dto.receiverId,
      dto.content,
      dto.contextStudentId,
    );
  }

  @Post('conversations/:id/send')
  sendToConversation(
    @Param('id') conversationId: string,
    @Body() body: { content: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.sendToConversation(
      req.user.sub,
      conversationId,
      body.content,
    );
  }

  @Post('conversations/:id/ai-suggest')
  previewAiSuggestion(
    @Param('id') conversationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.previewAiSuggestion(req.user.sub, conversationId);
  }

  @Post('conversations/:id/read')
  markRead(
    @Param('id') conversationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.markRead(req.user.sub, conversationId);
  }

  @Get('unread-count')
  getUnreadCount(@Req() req: AuthenticatedRequest) {
    return this.service.getUnreadCount(req.user.sub);
  }
}
