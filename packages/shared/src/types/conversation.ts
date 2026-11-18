import type { Brand, OwnerId, DeviceId } from './identity';

export type ConversationId = Brand<string, 'ConversationId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type ConversationSummaryId = Brand<string, 'ConversationSummaryId'>;

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  role: MessageRole;
  content: string;
  deviceId: DeviceId;
  sequenceNumber?: number;
  createdAt: string;
}

export interface Conversation {
  id: ConversationId;
  ownerId: OwnerId;
  deviceId: DeviceId;
  title?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationSummary {
  id: ConversationSummaryId;
  conversationId: ConversationId;
  ownerId: OwnerId;
  summary: string;
  keyDecisions: string[];
  openTasks: string[];
  fromMessageId?: MessageId;
  toMessageId?: MessageId;
  createdAt: string;
}

export interface ContextBudget {
  maxTotalChars?: number;
  maxSystemPromptChars?: number;
  maxMemoriesChars?: number;
  maxSummaryChars?: number;
  maxMessagesChars?: number;
}

export interface AssembledContext {
  systemPrompt: string;
  memoriesBlock?: string;
  summaryBlock?: string;
  messages: Message[];
  totalChars: number;
  budgetExhausted: boolean;
  assembledAt: string;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor?: string;
  hasMore: boolean;
}
