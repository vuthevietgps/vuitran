import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/chatbot',
  cors: { origin: '*', credentials: true },
})
export class ChatbotGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatbotGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`WS client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS client disconnected: ${client.id}`);
  }

  /**
   * Client joins a room for a specific conversation to receive
   * real-time message updates for that conversation.
   */
  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`conv:${conversationId}`);
    this.logger.debug(`Client ${client.id} joined conv:${conversationId}`);
  }

  /**
   * Client leaves a conversation room (e.g., when closing chat).
   */
  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @MessageBody() conversationId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(`conv:${conversationId}`);
    this.logger.debug(`Client ${client.id} left conv:${conversationId}`);
  }

  /**
   * Push a new message to all clients watching a specific conversation.
   */
  emitNewMessage(conversationId: string, message: Record<string, any>) {
    this.server.to(`conv:${conversationId}`).emit('newMessage', { conversationId, message });
  }

  /**
   * Notify all connected staff clients that the conversation list has changed
   * (e.g., new conversation, status change, last-message update).
   */
  emitConversationUpdated(conversation: Record<string, any>) {
    this.server.emit('conversationUpdated', { conversation });
  }
}
