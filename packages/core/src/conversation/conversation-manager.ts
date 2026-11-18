import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Conversation,
  Message,
  MessageRole,
  ConversationId,
  OwnerId,
  DeviceId,
  MessageId,
  ConversationSummary,
  ConversationSummaryId,
  PaginatedMessages,
} from '@victor/shared';
import type { Content } from '@google/generative-ai';

export interface AddMessageParams {
  conversationId: string;
  ownerId: string;
  role: MessageRole;
  content: string;
  deviceId?: string;
}

export class ConversationManagerError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'CONVERSATION_MANAGER_ERROR') {
    super(message);
    this.name = 'ConversationManagerError';
    this.code = code;
  }
}

export class ConversationManager {
  constructor(private readonly supabase: SupabaseClient) {}

  public async createConversation(
    ownerId: string,
    deviceId?: string,
    title: string = 'New Directive'
  ): Promise<Conversation> {
    if (!ownerId) {
      throw new ConversationManagerError('ownerId is required to create a conversation.', 'UNAUTHORIZED');
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        owner_id: ownerId,
        device_id: deviceId ?? null,
        title: title.trim() || 'New Directive',
      })
      .select('id, owner_id, device_id, title, created_at, updated_at')
      .single();

    if (error || !data) {
      throw new ConversationManagerError(`Failed to create conversation: ${error?.message}`, 'INSERT_FAILED');
    }

    return {
      id: data.id as ConversationId,
      ownerId: data.owner_id as OwnerId,
      deviceId: (data.device_id ?? '') as DeviceId,
      title: data.title,
      messages: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async getConversation(conversationId: string, ownerId: string): Promise<Conversation | null> {
    if (!conversationId || !ownerId) return null;

    const { data, error } = await this.supabase
      .from('conversations')
      .select('id, owner_id, device_id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id as ConversationId,
      ownerId: data.owner_id as OwnerId,
      deviceId: (data.device_id ?? '') as DeviceId,
      title: data.title,
      messages: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async listConversations(ownerId: string, limit: number = 20): Promise<Conversation[]> {
    if (!ownerId) return [];

    const { data, error } = await this.supabase
      .from('conversations')
      .select('id, owner_id, device_id, title, created_at, updated_at')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((d) => ({
      id: d.id as ConversationId,
      ownerId: d.owner_id as OwnerId,
      deviceId: (d.device_id ?? '') as DeviceId,
      title: d.title,
      messages: [],
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  public async deleteConversation(conversationId: string, ownerId: string): Promise<boolean> {
    if (!conversationId || !ownerId) return false;

    // Supabase cascade deletes messages and summaries
    const { count, error } = await this.supabase
      .from('conversations')
      .delete({ count: 'exact' })
      .eq('id', conversationId)
      .eq('owner_id', ownerId);

    if (error) {
      throw new ConversationManagerError(`Failed to delete conversation: ${error.message}`, 'DELETE_FAILED');
    }

    return (count ?? 0) > 0;
  }

  public async addMessage(params: AddMessageParams): Promise<Message> {
    const { conversationId, ownerId, role, content, deviceId } = params;
    if (!conversationId || !ownerId) {
      throw new ConversationManagerError('conversationId and ownerId are required.', 'UNAUTHORIZED');
    }

    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new ConversationManagerError('Message content cannot be empty.', 'EMPTY_CONTENT');
    }

    // Determine monotonic next sequence number
    const { data: latestMsg } = await this.supabase
      .from('messages')
      .select('sequence_number')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSeq = (latestMsg?.sequence_number ? Number(latestMsg.sequence_number) : 0) + 1;

    const { data: inserted, error } = await this.supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        owner_id: ownerId,
        role,
        content: trimmedContent,
        device_id: deviceId ?? null,
        sequence_number: nextSeq,
      })
      .select('id, conversation_id, role, content, device_id, sequence_number, created_at')
      .single();

    if (error || !inserted) {
      throw new ConversationManagerError(`Failed to add message: ${error?.message}`, 'INSERT_FAILED');
    }

    // Update conversation updated_at
    await this.supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('owner_id', ownerId);

    return {
      id: inserted.id as MessageId,
      conversationId: inserted.conversation_id as ConversationId,
      role: inserted.role as MessageRole,
      content: inserted.content,
      deviceId: (inserted.device_id ?? '') as DeviceId,
      sequenceNumber: inserted.sequence_number ? Number(inserted.sequence_number) : nextSeq,
      createdAt: inserted.created_at,
    };
  }

  public async getPaginatedMessages(
    conversationId: string,
    ownerId: string,
    limit: number = 20,
    beforeSequence?: number
  ): Promise<PaginatedMessages> {
    if (!conversationId || !ownerId) {
      return { messages: [], hasMore: false };
    }

    let query = this.supabase
      .from('messages')
      .select('id, conversation_id, role, content, device_id, sequence_number, created_at')
      .eq('conversation_id', conversationId)
      .eq('owner_id', ownerId)
      .order('sequence_number', { ascending: false })
      .limit(limit + 1);

    if (beforeSequence !== undefined) {
      query = query.lt('sequence_number', beforeSequence);
    }

    const { data, error } = await query;
    if (error || !data) {
      return { messages: [], hasMore: false };
    }

    const hasMore = data.length > limit;
    const slice = hasMore ? data.slice(0, limit) : data;

    // Chronological order (ascending)
    const chronological = [...slice].reverse().map((r) => ({
      id: r.id as MessageId,
      conversationId: r.conversation_id as ConversationId,
      role: r.role as MessageRole,
      content: r.content,
      deviceId: (r.device_id ?? '') as DeviceId,
      sequenceNumber: r.sequence_number ? Number(r.sequence_number) : undefined,
      createdAt: r.created_at,
    }));

    const nextCursor =
      hasMore && slice.length > 0 ? String(slice[slice.length - 1].sequence_number) : undefined;

    return {
      messages: chronological,
      nextCursor,
      hasMore,
    };
  }

  public async saveSummary(summary: ConversationSummary): Promise<void> {
    const { error } = await this.supabase
      .from('conversation_summaries')
      .insert({
        id: summary.id,
        conversation_id: summary.conversationId,
        owner_id: summary.ownerId,
        summary: summary.summary,
        key_decisions: summary.keyDecisions,
        open_tasks: summary.openTasks,
        from_message_id: summary.fromMessageId ?? null,
        to_message_id: summary.toMessageId ?? null,
      });

    if (error) {
      throw new ConversationManagerError(`Failed to save summary: ${error.message}`, 'SUMMARY_SAVE_FAILED');
    }
  }

  public async getLatestSummary(
    conversationId: string,
    ownerId: string
  ): Promise<ConversationSummary | null> {
    const { data, error } = await this.supabase
      .from('conversation_summaries')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id as ConversationSummaryId,
      conversationId: data.conversation_id as ConversationId,
      ownerId: data.owner_id as OwnerId,
      summary: data.summary,
      keyDecisions: data.key_decisions ?? [],
      openTasks: data.open_tasks ?? [],
      fromMessageId: data.from_message_id ?? undefined,
      toMessageId: data.to_message_id ?? undefined,
      createdAt: data.created_at,
    };
  }

  public async validateDeviceContinuity(
    conversationId: string,
    newDeviceId: string,
    ownerId: string
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!newDeviceId) {
      return { valid: false, reason: 'Target device ID is required.' };
    }

    const conv = await this.getConversation(conversationId, ownerId);
    if (!conv) {
      return { valid: false, reason: 'Conversation not found or unauthorized for this owner.' };
    }

    return { valid: true };
  }
}

/**
 * Retrieves an existing conversation belonging to the owner, or creates a new one (backward-compatible function).
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  ownerId: string,
  deviceId?: string | null,
  conversationId?: string | null
): Promise<Conversation> {
  const manager = new ConversationManager(supabase);
  if (conversationId) {
    const existing = await manager.getConversation(conversationId, ownerId);
    if (existing) {
      return existing;
    }
  }
  return manager.createConversation(ownerId, deviceId ?? undefined);
}

/**
 * Retrieves the last N messages of a conversation ordered chronologically (backward-compatible function).
 */
export async function getRecentMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 20
): Promise<Message[]> {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, owner_id, role, content, device_id, sequence_number, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return [...data].reverse().map((row) => ({
      id: row.id as MessageId,
      conversationId: row.conversation_id as ConversationId,
      role: row.role as MessageRole,
      content: row.content,
      deviceId: (row.device_id ?? '') as DeviceId,
      sequenceNumber: row.sequence_number ? Number(row.sequence_number) : undefined,
      createdAt: row.created_at,
    }));
  } catch {
    return [];
  }
}

/**
 * Converts internal Message entities to Gemini-compatible Content objects.
 */
export function formatHistoryForGemini(messages: Message[]): Content[] {
  return messages
    .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
}
