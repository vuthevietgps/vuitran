import { Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { ConversationKind } from './schemas/conversation.schema';
import { TicketPriority, TicketType } from '../tickets/schemas/ticket.schema';
import { AiAssistantStatus, AiAssistantType } from '../chatbot/schemas/ai-assistant-profile.schema';

export type ActiveUserLean = {
  _id: Types.ObjectId;
  fullName?: string;
  role: Role;
  status: UserStatus;
};

export type ParentStudentLean = {
  _id: Types.ObjectId;
  fullName?: string;
  studentCode?: string;
  grade?: string;
  subjects?: string[];
  learningNeeds?: string;
  preferredTeachingMode?: string;
  preferredLocation?: string;
  saleId?: Types.ObjectId;
};

export type ConversationAccess = {
  conversationKind: ConversationKind;
  topicStudentId?: Types.ObjectId;
  topicStudentName?: string;
};

export type ConversationPermission = {
  convo: import('./schemas/conversation.schema').ConversationDocument;
  isParticipant: boolean;
};

export type TokenData = {
  tokenId: Types.ObjectId;
  key: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPromptPrefix?: string;
};

export type AssistantProfileLean = {
  _id: Types.ObjectId;
  assistantType: AiAssistantType;
  label: string;
  description?: string;
  rulesPrompt?: string;
  defaultOpenAITokenId?: Types.ObjectId;
  status: AiAssistantStatus;
};

export type HandoffIntent = {
  type: TicketType;
  priority: TicketPriority;
  subjectLabel: string;
  reasonLabel: string;
};

export type HandoffResult = {
  reply: string;
  ticketId: string;
  ticketCode: string;
  created: boolean;
};

export type UnreadCountRow = {
  _id: Types.ObjectId;
  count: number;
};
