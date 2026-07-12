import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/messages',
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  /** Map userId → Set<socketId> for broadcasting */
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = this.extractAccessToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{ sub?: string }>(token);
      if (!payload.sub) {
        client.disconnect();
        return;
      }

      const user = await this.messagesService.getSocketUser(payload.sub);
      const userId = user._id.toString();
      client.data.userId = userId;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Join personal room
      client.join(`user:${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.userSockets.delete(userId);
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return;

    const message = await this.messagesService.sendMessage(
      senderId,
      data.receiverId,
      data.content,
    );

    // Emit to receiver
    this.server.to(`user:${data.receiverId}`).emit('newMessage', {
      message,
      senderId,
    });

    // Emit confirmation to sender
    client.emit('messageSent', { message });
  }

  @SubscribeMessage('sendToConversation')
  async handleSendToConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId) return;

    const message = await this.messagesService.sendToConversation(
      senderId,
      data.conversationId,
      data.content,
    );

    // Broadcast to all participants in the conversation room
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('newMessage', { message, senderId });
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    await this.messagesService.assertCanJoinConversation(userId, data.conversationId);
    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) return;
    await this.messagesService.markRead(userId, data.conversationId);
  }

  private extractAccessToken(client: Socket): string | null {
    const authToken = this.pickSingleValue(client.handshake.auth?.token);
    if (authToken) return this.stripBearer(authToken);

    const authorization = this.pickSingleValue(client.handshake.headers.authorization);
    if (authorization) return this.stripBearer(authorization);

    const cookieHeader = this.pickSingleValue(client.handshake.headers.cookie);
    return this.extractCookie(cookieHeader, 'access_token');
  }

  private pickSingleValue(value: unknown): string | null {
    if (Array.isArray(value)) return this.pickSingleValue(value[0]);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private stripBearer(value: string): string {
    return value.replace(/^Bearer\s+/i, '').trim();
  }

  private extractCookie(cookieHeader: string | null, name: string): string | null {
    if (!cookieHeader) return null;
    const prefix = `${name}=`;
    for (const rawCookie of cookieHeader.split(';')) {
      const cookie = rawCookie.trim();
      if (cookie.startsWith(prefix)) {
        return decodeURIComponent(cookie.slice(prefix.length));
      }
    }
    return null;
  }
}
