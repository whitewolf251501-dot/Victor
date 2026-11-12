import type {
  Memory,
  MemoryId,
  MemoryCategory,
  MemoryImportance,
} from '../types/memory';
import type { OwnerId } from '../types/identity';

export interface CreateMemoryParams {
  ownerId: OwnerId;
  category: MemoryCategory;
  content: string;
  importance: MemoryImportance;
  source: string;
}

export interface UpdateMemoryParams {
  id: MemoryId;
  content?: string;
  category?: MemoryCategory;
  importance?: MemoryImportance;
}

export interface MemorySearchParams {
  ownerId: OwnerId;
  query: string;
  category?: MemoryCategory;
  limit?: number;
  minImportance?: MemoryImportance;
}

export interface IMemoryRepository {
  create(params: CreateMemoryParams): Promise<Memory>;
  getById(id: MemoryId): Promise<Memory | null>;
  update(params: UpdateMemoryParams): Promise<Memory>;
  delete(id: MemoryId): Promise<boolean>;
  search(params: MemorySearchParams): Promise<Memory[]>;
  listByOwner(ownerId: OwnerId, category?: MemoryCategory): Promise<Memory[]>;
}
