import type { SupabaseClient } from '@supabase/supabase-js';
import type { Memory, MemoryImportance } from '@victor/shared';

const IMPORTANCE_WEIGHTS: Record<MemoryImportance, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Tokenizes a string into distinct, lowercase alphanumeric words (ignoring short stopwords/fillers).
 */
function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    )
  );
}

/**
 * Calculates keyword overlap score between query keywords and content.
 */
function calculateKeywordScore(queryTokens: string[], content: string): number {
  if (queryTokens.length === 0) return 0;
  const contentLower = content.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (contentLower.includes(token)) {
      matches += 1;
    }
  }
  return matches / queryTokens.length;
}

/**
 * Calculates a recency score from 0 to 1 based on memory age.
 * Memories created today get ~1.0; 30-day-old memories decay smoothly.
 */
function calculateRecencyScore(createdAt: string): number {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return 0.5;
  const now = Date.now();
  const ageDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
  return Math.exp(-ageDays / 30);
}

/**
 * Retrieves top N relevant memories for an owner based on keyword overlap,
 * importance weighting, and recency decay.
 * Returns an empty array on failure — never throws to caller.
 */
export async function retrieveRelevantMemories(
  supabase: SupabaseClient,
  ownerId: string,
  query: string,
  limit: number = 10
): Promise<Memory[]> {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('id, owner_id, category, content, importance, provenance, confidence, source, source_ref, embedding_model, embedding_version, created_at, updated_at')
      .eq('owner_id', ownerId);

    if (error || !data) {
      return [];
    }

    const queryTokens = extractKeywords(query);

    const scored = data.map((item) => {
      const memory: Memory = {
        id: item.id,
        ownerId: item.owner_id,
        category: item.category,
        content: item.content,
        importance: item.importance,
        provenance: item.provenance ?? 'user_stated',
        confidence: typeof item.confidence === 'number' ? item.confidence : 1.0,
        source: item.source ?? 'interaction',
        sourceRef: item.source_ref ?? undefined,
        embeddingModel: item.embedding_model ?? undefined,
        embeddingVersion: item.embedding_version ?? undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };

      const keywordScore = calculateKeywordScore(queryTokens, memory.content);
      const importanceWeight = IMPORTANCE_WEIGHTS[memory.importance] ?? 2;
      const normalizedImportance = importanceWeight / 4;
      const recencyScore = calculateRecencyScore(memory.createdAt);

      // Weighted score: 50% keyword match, 30% importance, 20% recency
      // If there are no query keywords, rank primarily by importance and recency
      const combinedScore =
        queryTokens.length > 0
          ? keywordScore * 0.5 + normalizedImportance * 0.3 + recencyScore * 0.2
          : normalizedImportance * 0.6 + recencyScore * 0.4;

      return { memory, combinedScore, keywordScore };
    });

    // If query had tokens, prioritize memories with at least some keyword overlap
    const filtered =
      queryTokens.length > 0
        ? scored.filter((item) => item.keywordScore > 0)
        : scored;

    // Fall back to all scored memories if no direct keyword match exists
    const candidates = filtered.length > 0 ? filtered : scored;

    candidates.sort((a, b) => b.combinedScore - a.combinedScore);

    return candidates.slice(0, limit).map((c) => c.memory);
  } catch {
    return [];
  }
}

/**
 * Formats an array of memories into a concise text block for system prompt injection.
 * Truncates to a maximum of 2000 characters.
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (!memories || memories.length === 0) {
    return '';
  }

  const lines: string[] = ['OWNER CONTEXT:'];
  let currentLength = lines[0].length + 1;
  const MAX_CHARS = 2000;

  for (const memory of memories) {
    const line = `- [${memory.category}] ${memory.content}`;
    if (currentLength + line.length + 1 > MAX_CHARS) {
      break;
    }
    lines.push(line);
    currentLength += line.length + 1;
  }

  return lines.length > 1 ? lines.join('\n') : '';
}
