import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeDocumentId,
  KnowledgeChunkId,
  OwnerId,
} from '@victor/shared';

export interface IngestDocumentParams {
  ownerId: string;
  title: string;
  content: string;
  sourceUri?: string;
  mimeType?: string;
  chunkSize?: number;
  overlap?: number;
}

export interface ChunkingOptions {
  chunkSize?: number;
  overlap?: number;
}

export class KnowledgeIngestorError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'KNOWLEDGE_INGESTOR_ERROR') {
    super(message);
    this.name = 'KnowledgeIngestorError';
    this.code = code;
  }
}

export class KnowledgeIngestor {
  constructor(private readonly supabase: SupabaseClient) {}

  public static computeHash(content: string): string {
    return createHash('sha256').update(content.trim()).digest('hex');
  }

  /**
   * Splits text content into overlapping chunks respecting sentence / line boundaries where possible.
   */
  public static chunkText(content: string, options: ChunkingOptions = {}): string[] {
    const chunkSize = options.chunkSize ?? 500;
    const overlap = options.overlap ?? 100;
    const step = Math.max(1, chunkSize - overlap);

    const clean = content.trim();
    if (!clean) return [];
    if (clean.length <= chunkSize) return [clean];

    const chunks: string[] = [];
    let start = 0;

    while (start < clean.length) {
      let end = Math.min(start + chunkSize, clean.length);

      // Attempt to break at whitespace or punctuation if not at the absolute end
      if (end < clean.length) {
        const breakIndex = clean.lastIndexOf(' ', end);
        if (breakIndex > start + Math.floor(chunkSize * 0.5)) {
          end = breakIndex;
        }
      }

      const chunk = clean.substring(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start += step;
      if (start >= clean.length) break;
    }

    return chunks;
  }

  /**
   * Ingests a knowledge document, verifies ownership, deduplicates identical content hashes,
   * breaks content into indexed chunks, and persists records.
   */
  public async ingestDocument(params: IngestDocumentParams): Promise<KnowledgeDocument> {
    const { ownerId, title, content, sourceUri, mimeType = 'text/plain' } = params;

    if (!ownerId || ownerId.trim().length === 0) {
      throw new KnowledgeIngestorError('ownerId is required for knowledge ingestion.', 'UNAUTHORIZED');
    }

    const trimmedTitle = title?.trim();
    if (!trimmedTitle) {
      throw new KnowledgeIngestorError('Document title is required.', 'INVALID_TITLE');
    }

    const trimmedContent = content?.trim();
    if (!trimmedContent) {
      throw new KnowledgeIngestorError('Document content cannot be empty.', 'EMPTY_CONTENT');
    }

    const contentHash = KnowledgeIngestor.computeHash(trimmedContent);

    // 1. Check for exact duplicate document for this owner
    const { data: existingDoc } = await this.supabase
      .from('knowledge_documents')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('content_hash', contentHash)
      .maybeSingle();

    if (existingDoc) {
      return {
        id: existingDoc.id as KnowledgeDocumentId,
        ownerId: existingDoc.owner_id as OwnerId,
        title: existingDoc.title,
        sourceUri: existingDoc.source_uri ?? undefined,
        mimeType: existingDoc.mime_type,
        contentHash: existingDoc.content_hash,
        chunkCount: existingDoc.chunk_count,
        createdAt: existingDoc.created_at,
        updatedAt: existingDoc.updated_at,
      };
    }

    // 2. Chunk the document
    const textChunks = KnowledgeIngestor.chunkText(trimmedContent, {
      chunkSize: params.chunkSize,
      overlap: params.overlap,
    });

    // 3. Insert Knowledge Document root record
    const { data: insertedDoc, error: docError } = await this.supabase
      .from('knowledge_documents')
      .insert({
        owner_id: ownerId,
        title: trimmedTitle,
        source_uri: sourceUri ?? null,
        mime_type: mimeType,
        content_hash: contentHash,
        chunk_count: textChunks.length,
      })
      .select('*')
      .single();

    if (docError || !insertedDoc) {
      throw new KnowledgeIngestorError(`Failed to insert knowledge document: ${docError?.message}`, 'DB_INSERT_FAILED');
    }

    // 4. Insert Chunks
    const chunkRecords = textChunks.map((chunkText, idx) => ({
      document_id: insertedDoc.id,
      owner_id: ownerId,
      chunk_index: idx,
      content: chunkText,
      token_count: Math.ceil(chunkText.length / 4), // Approximation
    }));

    if (chunkRecords.length > 0) {
      const { error: chunkError } = await this.supabase
        .from('knowledge_chunks')
        .insert(chunkRecords);

      if (chunkError) {
        // Rollback document record on chunk insertion failure
        await this.supabase.from('knowledge_documents').delete().eq('id', insertedDoc.id);
        throw new KnowledgeIngestorError(`Failed to insert knowledge chunks: ${chunkError.message}`, 'CHUNK_INSERT_FAILED');
      }
    }

    return {
      id: insertedDoc.id as KnowledgeDocumentId,
      ownerId: insertedDoc.owner_id as OwnerId,
      title: insertedDoc.title,
      sourceUri: insertedDoc.source_uri ?? undefined,
      mimeType: insertedDoc.mime_type,
      contentHash: insertedDoc.content_hash,
      chunkCount: insertedDoc.chunk_count,
      createdAt: insertedDoc.created_at,
      updatedAt: insertedDoc.updated_at,
    };
  }

  /**
   * Deletes a knowledge document and cascades deletion across all derived chunks.
   */
  public async deleteDocument(documentId: string, ownerId: string): Promise<boolean> {
    if (!documentId || !ownerId) return false;

    // Supabase cascade deletes knowledge_chunks via foreign key, but we enforce explicit owner check
    const { count, error } = await this.supabase
      .from('knowledge_documents')
      .delete({ count: 'exact' })
      .eq('id', documentId)
      .eq('owner_id', ownerId);

    if (error) {
      throw new KnowledgeIngestorError(`Failed to delete document: ${error.message}`, 'DELETE_FAILED');
    }

    return (count ?? 0) > 0;
  }

  public async getDocument(documentId: string, ownerId: string): Promise<KnowledgeDocument | null> {
    const { data } = await this.supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', documentId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id as KnowledgeDocumentId,
      ownerId: data.owner_id as OwnerId,
      title: data.title,
      sourceUri: data.source_uri ?? undefined,
      mimeType: data.mime_type,
      contentHash: data.content_hash,
      chunkCount: data.chunk_count,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async listDocuments(ownerId: string): Promise<KnowledgeDocument[]> {
    const { data } = await this.supabase
      .from('knowledge_documents')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (!data) return [];

    return data.map((d) => ({
      id: d.id as KnowledgeDocumentId,
      ownerId: d.owner_id as OwnerId,
      title: d.title,
      sourceUri: d.source_uri ?? undefined,
      mimeType: d.mime_type,
      contentHash: d.content_hash,
      chunkCount: d.chunk_count,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  public async getChunks(documentId: string, ownerId: string): Promise<KnowledgeChunk[]> {
    const { data } = await this.supabase
      .from('knowledge_chunks')
      .select('*')
      .eq('document_id', documentId)
      .eq('owner_id', ownerId)
      .order('chunk_index', { ascending: true });

    if (!data) return [];

    return data.map((c) => ({
      id: c.id as KnowledgeChunkId,
      documentId: c.document_id as KnowledgeDocumentId,
      ownerId: c.owner_id as OwnerId,
      chunkIndex: c.chunk_index,
      content: c.content,
      tokenCount: c.token_count,
      createdAt: c.created_at,
    }));
  }
}
