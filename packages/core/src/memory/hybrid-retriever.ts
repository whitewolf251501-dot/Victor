import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Memory,
  KnowledgeChunk,
  KnowledgeSearchResult,
  KnowledgeDocument,
  KnowledgeDocumentId,
  KnowledgeChunkId,
  OwnerId,
} from '@victor/shared';

export interface RetrievalWeights {
  keywordWeight?: number;
  vectorWeight?: number;
  importanceWeight?: number;
  recencyWeight?: number;
}

export interface HybridSearchOptions {
  limit?: number;
  minScore?: number;
  queryEmbedding?: number[];
  weights?: RetrievalWeights;
}

export class HybridRetriever {
  constructor(private readonly supabase: SupabaseClient) {}

  public static cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  public static extractKeywords(query: string): string[] {
    return Array.from(
      new Set(
        query
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3)
      )
    );
  }

  public static calculateKeywordScore(queryTokens: string[], content: string): number {
    if (queryTokens.length === 0) return 0;
    const lowerContent = content.toLowerCase();
    let matches = 0;
    for (const token of queryTokens) {
      if (lowerContent.includes(token)) {
        matches++;
      }
    }
    return matches / queryTokens.length;
  }

  /**
   * Searches both structured memories and RAG knowledge chunks for the owner.
   */
  public async searchKnowledge(
    ownerId: string,
    query: string,
    options: HybridSearchOptions = {}
  ): Promise<KnowledgeSearchResult[]> {
    if (!ownerId) return [];

    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? 0.1;
    const queryTokens = HybridRetriever.extractKeywords(query);

    // Retrieve knowledge chunks for this owner
    const { data: chunks, error } = await this.supabase
      .from('knowledge_chunks')
      .select('id, document_id, owner_id, chunk_index, content, token_count, created_at')
      .eq('owner_id', ownerId)
      .limit(100);

    if (error || !chunks || chunks.length === 0) {
      return [];
    }

    const scoredResults: KnowledgeSearchResult[] = [];

    for (const row of chunks) {
      const chunk: KnowledgeChunk = {
        id: row.id as KnowledgeChunkId,
        documentId: row.document_id as KnowledgeDocumentId,
        ownerId: row.owner_id as OwnerId,
        chunkIndex: row.chunk_index,
        content: row.content,
        tokenCount: row.token_count,
        createdAt: row.created_at,
      };

      const kwScore = HybridRetriever.calculateKeywordScore(queryTokens, chunk.content);
      let vecScore = 0;

      if (options.queryEmbedding && chunk.embedding) {
        vecScore = HybridRetriever.cosineSimilarity(options.queryEmbedding, chunk.embedding);
      }

      // Hybrid combination
      const combinedScore = options.queryEmbedding && chunk.embedding
        ? kwScore * 0.5 + vecScore * 0.5
        : kwScore;

      if (combinedScore >= minScore || queryTokens.length === 0) {
        scoredResults.push({
          chunk,
          score: combinedScore,
          matchType: options.queryEmbedding && chunk.embedding ? 'hybrid' : 'keyword',
        });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, limit);
  }

  /**
   * Formats combined memory and knowledge results into an untrusted, injection-contained context block.
   */
  public static formatBoundedContext(
    memories: Memory[],
    knowledgeResults: KnowledgeSearchResult[],
    maxChars: number = 3000
  ): string {
    const sections: string[] = [];

    if (memories.length > 0) {
      sections.push('### Verified Long-Term Memories (Read-Only Data)');
      for (const m of memories) {
        sections.push(`- [${m.category}] ${m.content} (source: ${m.source}, confidence: ${m.confidence})`);
      }
    }

    if (knowledgeResults.length > 0) {
      sections.push('\n### Retrieved Knowledge Chunks (Read-Only Data)');
      for (const res of knowledgeResults) {
        sections.push(`[Chunk ${res.chunk.chunkIndex}]: ${res.chunk.content}`);
      }
    }

    const combined = sections.join('\n');
    if (combined.length <= maxChars) {
      return combined;
    }

    return combined.substring(0, maxChars) + '\n...[TRUNCATED FOR CONTEXT LIMIT]';
  }
}
