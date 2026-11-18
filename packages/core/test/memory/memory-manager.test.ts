import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryManager } from '../../src/memory/memory-manager';
import type { SupabaseClient } from '@supabase/supabase-js';

class MockSupabaseMemoryClient {
  public memoryStore: any[] = [];

  from(table: string) {
    assert.equal(table, 'memories');
    return {
      insert: (record: any) => {
        const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const fullRecord = {
          id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...record,
        };
        this.memoryStore.push(fullRecord);
        return {
          select: () => ({
            single: async () => ({ data: fullRecord, error: null }),
          }),
        };
      },
      select: (_fields?: string) => {
        let current = [...this.memoryStore];
        const chain = {
          eq: (col: string, val: any) => {
            current = current.filter((r) => r[col] === val);
            return chain;
          },
          order: (col: string, opts?: { ascending?: boolean }) => {
            const asc = opts?.ascending ?? true;
            current.sort((a, b) => {
              if (a[col] < b[col]) return asc ? -1 : 1;
              if (a[col] > b[col]) return asc ? 1 : -1;
              return 0;
            });
            return chain;
          },
          limit: (n: number) => {
            current = current.slice(0, n);
            return chain;
          },
          gte: (col: string, val: string) => {
            current = current.filter((r) => r[col] >= val);
            return chain;
          },
          lt: (col: string, val: string) => {
            current = current.filter((r) => r[col] < val);
            return chain;
          },
          not: (col: string, op: string, val: string) => {
            if (op === 'in') {
              const clean = val.replace(/[()]/g, '').split(',');
              current = current.filter((r) => !clean.includes(r[col]));
            }
            return chain;
          },
          maybeSingle: async () => ({
            data: current.length > 0 ? current[0] : null,
            error: null,
          }),
          then: (resolve: (val: any) => void) => resolve({ data: current, error: null }),
        };
        return chain;
      },
      update: (payload: any) => {
        let targetId: string | null = null;
        let targetOwner: string | null = null;
        const chain = {
          eq: (col: string, val: string) => {
            if (col === 'id') targetId = val;
            if (col === 'owner_id') targetOwner = val;
            return chain;
          },
          select: () => ({
            single: async () => {
              const idx = this.memoryStore.findIndex(
                (m) => m.id === targetId && m.owner_id === targetOwner
              );
              if (idx === -1) {
                return { data: null, error: { message: 'Not found' } };
              }
              this.memoryStore[idx] = {
                ...this.memoryStore[idx],
                ...payload,
                updated_at: new Date().toISOString(),
              };
              return { data: this.memoryStore[idx], error: null };
            },
          }),
        };
        return chain;
      },
      delete: (opts: any) => {
        let targetId: string | null = null;
        let targetOwner: string | null = null;
        let ltCol: string | null = null;
        let ltVal: string | null = null;
        let excludedImportances: string[] = [];
        let excludedCategories: string[] = [];

        const chain = {
          eq: (col: string, val: string) => {
            if (col === 'id') targetId = val;
            if (col === 'owner_id') targetOwner = val;
            return chain;
          },
          lt: (col: string, val: string) => {
            ltCol = col;
            ltVal = val;
            return chain;
          },
          not: (col: string, op: string, val: string) => {
            if (op === 'in') {
              const clean = val.replace(/[()]/g, '').split(',');
              if (col === 'importance') excludedImportances = clean;
              if (col === 'category') excludedCategories = clean;
            }
            return chain;
          },
          then: (resolve: (val: any) => void) => {
            const before = this.memoryStore.length;
            this.memoryStore = this.memoryStore.filter((m) => {
              if (targetId && m.id === targetId && targetOwner && m.owner_id === targetOwner) {
                return false;
              }
              if (ltCol && ltVal && targetOwner && m.owner_id === targetOwner) {
                if (m[ltCol] < ltVal) {
                  if (excludedImportances.includes(m.importance)) return true;
                  if (excludedCategories.includes(m.category)) return true;
                  return false;
                }
              }
              return true;
            });
            const count = before - this.memoryStore.length;
            resolve({ count, error: null });
          },
        };
        return chain;
      },
    };
  }
}

describe('System 2: MemoryManager Specification Suite', () => {
  it('saves memory with explicit provenance, confidence, and owner scoping', async () => {
    const mock = new MockSupabaseMemoryClient();
    const manager = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');

    const memory = await manager.save(
      'Owner prefers dark mode and tactical HUD layout',
      'preference',
      'high',
      {
        provenance: 'user_stated',
        confidence: 0.95,
        source: 'user_directive',
      }
    );

    assert.equal(memory.ownerId, 'owner_alpha');
    assert.equal(memory.category, 'preference');
    assert.equal(memory.importance, 'high');
    assert.equal(memory.provenance, 'user_stated');
    assert.equal(memory.confidence, 0.95);
    assert.ok(memory.id.startsWith('mem_'));
  });

  it('redacts sensitive API keys and bearer tokens on save', async () => {
    const mock = new MockSupabaseMemoryClient();
    const manager = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');

    const memory = await manager.save(
      'The backup API key is sk-1234567890abcdef1234567890 and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
      'fact',
      'critical',
      { provenance: 'user_stated' }
    );

    assert.ok(!memory.content.includes('sk-1234567890abcdef1234567890'));
    assert.ok(memory.content.includes('[REDACTED_API_KEY]'));
  });

  it('rejects invalid inputs on save (empty content, invalid category, invalid provenance)', async () => {
    const mock = new MockSupabaseMemoryClient();
    const manager = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');

    await assert.rejects(
      async () => manager.save('', 'fact'),
      (err: Error) => err.message.includes('cannot be empty')
    );

    await assert.rejects(
      async () => manager.save('Some fact', 'invalid_cat' as any),
      (err: Error) => err.message.includes('Invalid category')
    );

    await assert.rejects(
      async () =>
        manager.save('Some fact', 'fact', 'medium', {
          provenance: 'invalid_prov' as any,
        }),
      (err: Error) => err.message.includes('Invalid provenance')
    );
  });

  it('enforces strict cross-owner isolation on getById, update, and delete', async () => {
    const mock = new MockSupabaseMemoryClient();
    const managerA = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');
    const managerB = new MemoryManager(mock as unknown as SupabaseClient, 'owner_bravo');

    const memoryA = await managerA.save('Secret notes for Alpha', 'fact', 'high');

    // Owner B cannot view Owner A's memory
    const retrievedByB = await managerB.getById(memoryA.id);
    assert.equal(retrievedByB, null);

    // Owner B cannot update Owner A's memory
    await assert.rejects(
      async () => managerB.update(memoryA.id, { content: 'Tampered content' }),
      (err: Error) => err.message.toLowerCase().includes('not found')
    );

    // Owner B cannot delete Owner A's memory
    await assert.rejects(
      async () => managerB.delete(memoryA.id),
      (err: Error) => err.message.toLowerCase().includes('not found')
    );

    // Owner A can successfully update and delete their own memory
    const updated = await managerA.update(memoryA.id, { content: 'Legitimate update by Alpha' });
    assert.equal(updated.content, 'Legitimate update by Alpha');

    await managerA.delete(memoryA.id);
    const afterDelete = await managerA.getById(memoryA.id);
    assert.equal(afterDelete, null);
  });

  it('detects duplicate or near-identical memories', async () => {
    const mock = new MockSupabaseMemoryClient();
    const manager = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');

    await manager.save('Owner lives in Ahmedabad, Gujarat', 'fact', 'high');

    const isExactDup = await manager.checkDuplicate('Owner lives in Ahmedabad, Gujarat', 30);
    assert.equal(isExactDup, true);

    const isSubstrDup = await manager.checkDuplicate('lives in Ahmedabad, Gujarat', 30);
    assert.equal(isSubstrDup, true);

    const isNonDup = await manager.checkDuplicate('Owner loves cycling in the evening', 30);
    assert.equal(isNonDup, false);
  });

  it('exports memories cleanly in json and jsonl formats', async () => {
    const mock = new MockSupabaseMemoryClient();
    const manager = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');

    await manager.save('Memory item 1', 'fact', 'medium');
    await manager.save('Memory item 2', 'goal', 'high');

    const jsonExport = await manager.exportMemories('json');
    const parsedJson = JSON.parse(jsonExport);
    assert.equal(Array.isArray(parsedJson), true);
    assert.equal(parsedJson.length, 2);

    const jsonlExport = await manager.exportMemories('jsonl');
    const lines = jsonlExport.trim().split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines.some((l) => JSON.parse(l).content === 'Memory item 1'));
    assert.ok(lines.some((l) => JSON.parse(l).content === 'Memory item 2'));
  });

  it('prunes expired memories according to retention policy excluding critical memories', async () => {
    const mock = new MockSupabaseMemoryClient();
    const manager = new MemoryManager(mock as unknown as SupabaseClient, 'owner_alpha');

    // Create an old memory (400 days old)
    const oldTimestamp = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    mock.memoryStore.push({
      id: 'mem_old_low',
      owner_id: 'owner_alpha',
      category: 'fact',
      content: 'Old low importance fact',
      importance: 'low',
      created_at: oldTimestamp,
      updated_at: oldTimestamp,
    });
    mock.memoryStore.push({
      id: 'mem_old_critical',
      owner_id: 'owner_alpha',
      category: 'fact',
      content: 'Old critical core instruction',
      importance: 'critical',
      created_at: oldTimestamp,
      updated_at: oldTimestamp,
    });

    const prunedCount = await manager.pruneExpiredMemories({
      maxAgeDays: 365,
      excludeImportances: ['critical'],
    });

    assert.equal(prunedCount, 1);
    assert.equal(mock.memoryStore.length, 1);
    assert.equal(mock.memoryStore[0].id, 'mem_old_critical');
  });
});
