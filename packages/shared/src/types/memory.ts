import type { Brand, OwnerId } from './identity';

export type MemoryId = Brand<string, 'MemoryId'>;
export type KnowledgeDocumentId = Brand<string, 'KnowledgeDocumentId'>;
export type KnowledgeChunkId = Brand<string, 'KnowledgeChunkId'>;

export type MemoryCategory =
  | 'fact'
  | 'goal'
  | 'dream'
  | 'project'
  | 'venture'
  | 'decision'
  | 'preference'
  | 'problem'
  | 'open_loop'
  | 'pattern'
  | 'lesson'
  | 'relationship'
  | 'discovery'
  | 'commitment'
  | 'instruction';

export type MemoryImportance = 'low' | 'medium' | 'high' | 'critical';

export type MemoryProvenance = 'user_stated' | 'inferred' | 'external_source' | 'system';

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  'fact',
  'goal',
  'dream',
  'project',
  'venture',
  'decision',
  'preference',
  'problem',
  'open_loop',
  'pattern',
  'lesson',
  'relationship',
  'discovery',
  'commitment',
  'instruction',
] as const;

export const MEMORY_IMPORTANCES: readonly MemoryImportance[] = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const MEMORY_PROVENANCES: readonly MemoryProvenance[] = [
  'user_stated',
  'inferred',
  'external_source',
  'system',
] as const;

export interface Memory {
  id: MemoryId;
  ownerId: OwnerId;
  category: MemoryCategory;
  content: string;
  importance: MemoryImportance;
  provenance: MemoryProvenance;
  confidence: number;
  source: string;
  sourceRef?: string;
  embeddingModel?: string;
  embeddingVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: KnowledgeDocumentId;
  ownerId: OwnerId;
  title: string;
  sourceUri?: string;
  mimeType: string;
  contentHash: string;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: KnowledgeChunkId;
  documentId: KnowledgeDocumentId;
  ownerId: OwnerId;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embeddingModel?: string;
  embeddingVersion?: string;
  embedding?: number[];
  createdAt: string;
}

export interface KnowledgeSearchResult {
  chunk: KnowledgeChunk;
  document?: KnowledgeDocument;
  score: number;
  matchType: 'keyword' | 'vector' | 'hybrid';
}

export interface RetentionPolicy {
  maxAgeDays?: number;
  excludeImportances?: MemoryImportance[];
  excludeCategories?: MemoryCategory[];
}
