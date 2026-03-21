import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private http = inject(HttpClient);
  private base = `${environment.apiBase}/messages`;

  listConversations(): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${this.base}/conversations`, { withCredentials: true }),
    );
  }

  getConversation(conversationId: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.base}/conversations/${conversationId}`, {
        withCredentials: true,
      }),
    );
  }

  listMessages(conversationId: string, page = 1, limit = 50): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(
        `${this.base}/conversations/${conversationId}/messages`,
        { params: { page: page.toString(), limit: limit.toString() }, withCredentials: true },
      ),
    );
  }

  sendMessage(receiverId: string, content: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.base}/send`,
        { receiverId, content },
        { withCredentials: true },
      ),
    );
  }

  sendSupportMessage(receiverId: string, content: string, contextStudentId?: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.base}/send`,
        { receiverId, content, contextStudentId },
        { withCredentials: true },
      ),
    );
  }

  sendToConversation(conversationId: string, content: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.base}/conversations/${conversationId}/send`,
        { content },
        { withCredentials: true },
      ),
    );
  }

  markRead(conversationId: string): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(
        `${this.base}/conversations/${conversationId}/read`,
        {},
        { withCredentials: true },
      ),
    );
  }

  getUnreadCount(): Promise<{ count: number }> {
    return firstValueFrom(
      this.http.get<{ count: number }>(`${this.base}/unread-count`, { withCredentials: true }),
    );
  }
}
