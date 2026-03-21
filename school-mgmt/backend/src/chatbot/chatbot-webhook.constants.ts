export const CHATBOT_WEBHOOK_QUEUE = 'chatbot-webhook';

export interface WebhookMessageJobData {
  fanpageId: string;
  platformUserId: string;
  messageText: string;
  senderName?: string;
  adRefParam?: string;
  messageId?: string;
}
