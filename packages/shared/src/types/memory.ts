import type { Brand, OwnerId } from './identity';

export type MemoryId = Brand<string, 'MemoryId'>;

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

export interface Memory {
  id: MemoryId;
  ownerId: OwnerId;
  category: MemoryCategory;
  content: string;
  importance: MemoryImportance;
  createdAt: string;
  updatedAt: string;
  source: string;
}
