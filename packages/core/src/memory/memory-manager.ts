import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type Memory,
  type MemoryId,
  type MemoryCategory,
  type MemoryImportance,
  type OwnerId,
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCES,
} from '@victor/shared';
import { retrieveRelevantMemories } from './memory-retriever';

export interface RetrieveOptions {
  limit?: number;
  category?: MemoryCategory;
  minImportance?: MemoryImportance;
}

export interface MemoryChanges {
  content?: string;
  category?: MemoryCategory;
  importance?: MemoryImportance;
}

export class MemoryManager {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly ownerId: string
  ) {
    if (!ownerId) {
      throw new Error('MemoryManager requires a valid ownerId.');
    }
  }

  /**
   * Helper to map database row to strongly-typed Memory object.
   */
  private mapRowToMemory(row: any): Memory {
    return {
      id: row.id as MemoryId,
      ownerId: row.owner_id as OwnerId,
      category: row.category as MemoryCategory,
      content: row.content,
      importance: row.importance as MemoryImportance,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      source: row.source ?? 'interaction',
    };
  }

  /**
   * Saves a new memory for the owner.
   */
  async save(
    content: string,
    category: MemoryCategory,
    importance: MemoryImportance = 'medium',
    source: string = 'system'
  ): Promise<Memory> {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new Error('Memory content cannot be empty.');
    }

    if (!MEMORY_CATEGORIES.includes(category)) {
      throw new Error(
        `Invalid category '${category}'. Allowed values: ${MEMORY_CATEGORIES.join(', ')}`
      );
    }

    if (!MEMORY_IMPORTANCES.includes(importance)) {
      throw new Error(
        `Invalid importance '${importance}'. Allowed values: ${MEMORY_IMPORTANCES.join(', ')}`
      );
    }

    const { data, error } = await this.supabase
      .from('memories')
      .insert({
        owner_id: this.ownerId,
        content: trimmed,
        category,
        importance,
        source: source || 'system',
      })
      .select('id, owner_id, category, content, importance, created_at, updated_at, source')
      .single();

    if (error || !data) {
      throw new Error(`Failed to save memory: ${error?.message ?? 'Database error'}`);
    }

    return this.mapRowToMemory(data);
  }

  /**
   * Retrieves relevant memories scored by keyword match, importance, and recency.
   */
  async retrieve(query: string, options?: RetrieveOptions): Promise<Memory[]> {
    try {
      const limit = options?.limit ?? 10;
      let memories = await retrieveRelevantMemories(
        this.supabase,
        this.ownerId,
        query,
        limit * 2
      );

      if (options?.category) {
        memories = memories.filter((m) => m.category === options.category);
      }

      if (options?.minImportance) {
        const order: Record<MemoryImportance, number> = {
          low: 1,
          medium: 2,
          high: 3,
          critical: 4,
        };
        const minVal = order[options.minImportance] ?? 1;
        memories = memories.filter((m) => (order[m.importance] ?? 2) >= minVal);
      }

      return memories.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Fetches a single memory by ID, strictly verifying ownership.
   */
  async getById(id: string): Promise<Memory | null> {
    try {
      const { data, error } = await this.supabase
        .from('memories')
        .select('id, owner_id, category, content, importance, created_at, updated_at, source')
        .eq('id', id)
        .eq('owner_id', this.ownerId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return this.mapRowToMemory(data);
    } catch {
      return null;
    }
  }

  /**
   * Updates an existing memory, strictly verifying ownership.
   */
  async update(id: string, changes: MemoryChanges): Promise<Memory> {
    if (!id) {
      throw new Error('Memory ID is required for update.');
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (changes.content !== undefined) {
      const trimmed = changes.content.trim();
      if (!trimmed) {
        throw new Error('Memory content cannot be empty.');
      }
      updatePayload.content = trimmed;
    }

    if (changes.category !== undefined) {
      if (!MEMORY_CATEGORIES.includes(changes.category)) {
        throw new Error(`Invalid category '${changes.category}'.`);
      }
      updatePayload.category = changes.category;
    }

    if (changes.importance !== undefined) {
      if (!MEMORY_IMPORTANCES.includes(changes.importance)) {
        throw new Error(`Invalid importance '${changes.importance}'.`);
      }
      updatePayload.importance = changes.importance;
    }

    const { data, error } = await this.supabase
      .from('memories')
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_id', this.ownerId)
      .select('id, owner_id, category, content, importance, created_at, updated_at, source')
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to update memory ${id}: ${error?.message ?? 'Not found or unauthorized'}`
      );
    }

    return this.mapRowToMemory(data);
  }

  /**
   * Hard deletes a memory, strictly verifying ownership.
   */
  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error('Memory ID is required for deletion.');
    }

    const { error, count } = await this.supabase
      .from('memories')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('owner_id', this.ownerId);

    if (error) {
      throw new Error(`Failed to delete memory: ${error.message}`);
    }

    if (count === 0) {
      throw new Error(`Memory ${id} not found or unauthorized for deletion.`);
    }
  }

  /**
   * Full-text / keyword search across owner memories.
   */
  async search(query: string): Promise<Memory[]> {
    try {
      const trimmed = query?.trim() ?? '';
      if (!trimmed) {
        return this.getRecent(20);
      }
      return await this.retrieve(trimmed, { limit: 20 });
    } catch {
      return [];
    }
  }

  /**
   * Retrieves memories belonging to a specific category.
   */
  async getByCategory(category: MemoryCategory): Promise<Memory[]> {
    try {
      const { data, error } = await this.supabase
        .from('memories')
        .select('id, owner_id, category, content, importance, created_at, updated_at, source')
        .eq('owner_id', this.ownerId)
        .eq('category', category)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return [];
      }

      return data.map((row) => this.mapRowToMemory(row));
    } catch {
      return [];
    }
  }

  /**
   * Retrieves most recent memories for the owner.
   */
  async getRecent(limit: number = 50): Promise<Memory[]> {
    try {
      const { data, error } = await this.supabase
        .from('memories')
        .select('id, owner_id, category, content, importance, created_at, updated_at, source')
        .eq('owner_id', this.ownerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data.map((row) => this.mapRowToMemory(row));
    } catch {
      return [];
    }
  }

  /**
   * Checks if duplicate or near-identical content already exists in the last N days.
   */
  async checkDuplicate(content: string, days: number = 30): Promise<boolean> {
    try {
      const trimmed = content?.trim().toLowerCase();
      if (!trimmed) return false;

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await this.supabase
        .from('memories')
        .select('content')
        .eq('owner_id', this.ownerId)
        .gte('created_at', cutoffDate);

      if (error || !data) {
        return false;
      }

      // Check for exact lowercase match or high containment
      for (const row of data) {
        const existing = (row.content as string).toLowerCase().trim();
        if (existing === trimmed) {
          return true;
        }
        if (existing.length > 10 && trimmed.length > 10) {
          if (existing.includes(trimmed) || trimmed.includes(existing)) {
            return true;
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }
}
