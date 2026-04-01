import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NewMessageEvent {
  conversationId: string;
  message: any;
}

export interface ConversationUpdatedEvent {
  conversation: any;
}

@Injectable({ providedIn: 'root' })
export class ChatbotSocketService implements OnDestroy {
  private socket: Socket | null = null;

  readonly newMessage$ = new Subject<NewMessageEvent>();
  readonly conversationUpdated$ = new Subject<ConversationUpdatedEvent>();

  connect() {
    if (this.socket?.connected) return;

    const apiBase = environment.apiBase.replace(/\/$/, '');
    const usesAbsoluteApiBase = /^https?:\/\//i.test(apiBase);
    const socketOrigin = usesAbsoluteApiBase
      ? apiBase.replace(/^http/i, 'ws')
      : window.location.origin;
    const socketPath = usesAbsoluteApiBase ? '/socket.io' : `${apiBase}/socket.io`;

    this.socket = io(`${socketOrigin}/chatbot`, {
      path: socketPath,
      withCredentials: true,
      transports: ['websocket'],
    });

    this.socket.on('newMessage', (event: NewMessageEvent) => {
      this.newMessage$.next(event);
    });

    this.socket.on('conversationUpdated', (event: ConversationUpdatedEvent) => {
      this.conversationUpdated$.next(event);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinConversation(conversationId: string) {
    this.socket?.emit('joinConversation', conversationId);
  }

  leaveConversation(conversationId: string) {
    this.socket?.emit('leaveConversation', conversationId);
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
