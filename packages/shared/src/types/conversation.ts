import type { Brand, OwnerId, DeviceId } from './identity';

export type ConversationId = Brand<string, 'ConversationId'>;
export type MessageId = Brand<string, 'MessageId'>;

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  role: MessageRole;
  content: string;
  deviceId: DeviceId;
  createdAt: string;
}

export interface Conversation {
  id: ConversationId;
  ownerId: OwnerId;
  deviceId: DeviceId;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
