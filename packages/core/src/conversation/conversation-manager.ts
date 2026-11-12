import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Conversation,
  Message,
  MessageRole,
  ConversationId,
  OwnerId,
  DeviceId,
  MessageId,
} from '@victor/shared';
import type { Content } from '@google/generative-ai';

/**
 * Retrieves an existing conversation belonging to the owner, or creates a new one.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  ownerId: string,
  deviceId?: string | null,
  conversationId?: string | null
): Promise<Conversation> {
  // If conversationId was provided, verify and fetch it
  if (conversationId) {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, owner_id, device_id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id as ConversationId,
        ownerId: data.owner_id as OwnerId,
        deviceId: (data.device_id ?? '') as DeviceId,
        messages: [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }
  }

  // Create a new conversation row
  const insertPayload: {
    owner_id: string;
    device_id?: string | null;
    title: string;
  } = {
    owner_id: ownerId,
    title: 'New Directive',
  };

  if (deviceId) {
    insertPayload.device_id = deviceId;
  }

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert(insertPayload)
    .select('id, owner_id, device_id, title, created_at, updated_at')
    .single();

  if (insertError || !created) {
    throw new Error(
      `Failed to initialize conversation: ${insertError?.message ?? 'Unknown database error'}`
    );
  }

  return {
    id: created.id as ConversationId,
    ownerId: created.owner_id as OwnerId,
    deviceId: (created.device_id ?? '') as DeviceId,
    messages: [],
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

/**
 * Retrieves the last N messages of a conversation ordered chronologically (ascending).
 */
export async function getRecentMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 20
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, owner_id, role, content, device_id, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    // Reverse to chronological order (ascending)
    const chronological = [...data].reverse();

    return chronological.map((row) => ({
      id: row.id as MessageId,
      conversationId: row.conversation_id as ConversationId,
      role: row.role as MessageRole,
      content: row.content,
      deviceId: (row.device_id ?? '') as DeviceId,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Converts internal Message entities to Gemini-compatible Content objects.
 * Maps 'assistant' role to Gemini 'model', and 'user' to 'user'.
 * Excludes 'system' role messages from the conversation history array.
 */
export function formatHistoryForGemini(messages: Message[]): Content[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
}
