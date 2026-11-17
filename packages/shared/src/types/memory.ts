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
