import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConversationManager, ConversationManagerError } from '../../src/conversation/conversation-manager';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationSummary, ConversationSummaryId, ConversationId, OwnerId } from '@victor/shared';

class MockSupabaseConversationClient {
  public conversations: any[] = [];
  public messages: any[] = [];
  public summaries: any[] = [];

  from(table: string) {
    if (table === 'conversations') {
      return {
        insert: (record: any) => {
          const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const fullConv = {
            id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...record,
          };
          this.conversations.push(fullConv);
          return {
            select: () => ({
              single: async () => ({ data: fullConv, error: null }),
            }),
          };
        },
        select: (_fields?: string) => {
          let current = [...this.conversations];
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
            then: (resolve: (val: any) => void) => {
              const conv = this.conversations.find(
                (c) => c.id === targetId && c.owner_id === targetOwner
              );
              if (conv) Object.assign(conv, payload);
              resolve({ data: conv, error: null });
            },
          };
          return chain;
        },
        delete: (opts: any) => {
          let targetId: string | null = null;
          let targetOwner: string | null = null;
          const chain = {
            eq: (col: string, val: string) => {
              if (col === 'id') targetId = val;
              if (col === 'owner_id') targetOwner = val;
              return chain;
            },
            then: (resolve: (val: any) => void) => {
              const before = this.conversations.length;
              this.conversations = this.conversations.filter(
                (c) => !(c.id === targetId && c.owner_id === targetOwner)
              );
              // Cascade delete messages and summaries
              this.messages = this.messages.filter((m) => m.conversation_id !== targetId);
              this.summaries = this.summaries.filter((s) => s.conversation_id !== targetId);
              const count = before - this.conversations.length;
              resolve({ count, error: null });
            },
          };
          return chain;
        },
      };
    }

    if (table === 'messages') {
      return {
        insert: (record: any) => {
          const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const fullMsg = {
            id,
            created_at: new Date().toISOString(),
            ...record,
          };
          this.messages.push(fullMsg);
          return {
            select: () => ({
              single: async () => ({ data: fullMsg, error: null }),
            }),
          };
        },
        select: (_fields?: string) => {
          const eqFilters: Array<{ col: string; val: any }> = [];
          let ltFilter: { col: string; val: any } | null = null;
          let sortCol: string | null = null;
          let sortAsc = true;
          let limitN: number | null = null;

          const execute = () => {
            let res = [...this.messages];
            for (const f of eqFilters) {
              res = res.filter((r) => r[f.col] === f.val);
            }
            if (ltFilter) {
              res = res.filter((r) => r[ltFilter!.col] < ltFilter!.val);
            }
            if (sortCol) {
              res.sort((a, b) => {
                if (a[sortCol!] < b[sortCol!]) return sortAsc ? -1 : 1;
                if (a[sortCol!] > b[sortCol!]) return sortAsc ? 1 : -1;
                return 0;
              });
            }
            if (limitN !== null) {
              res = res.slice(0, limitN);
            }
            return res;
          };

          const chain = {
            eq: (col: string, val: any) => {
              eqFilters.push({ col, val });
              return chain;
            },
            lt: (col: string, val: any) => {
              ltFilter = { col, val };
              return chain;
            },
            order: (col: string, opts?: { ascending?: boolean }) => {
              sortCol = col;
              sortAsc = opts?.ascending ?? true;
              return chain;
            },
            limit: (n: number) => {
              limitN = n;
              return chain;
            },
            maybeSingle: async () => {
              const res = execute();
              return { data: res.length > 0 ? res[0] : null, error: null };
            },
            then: (resolve: (val: any) => void) => resolve({ data: execute(), error: null }),
          };
          return chain;
        },
      };
    }

    if (table === 'conversation_summaries') {
      return {
        insert: (record: any) => {
          this.summaries.push({
            created_at: new Date().toISOString(),
            ...record,
          });
          return Promise.resolve({ error: null });
        },
        select: (_fields?: string) => {
          let current = [...this.summaries];
          const chain = {
            eq: (col: string, val: any) => {
              current = current.filter((r) => r[col] === val);
              return chain;
            },
            order: (_col: string, _opts: any) => chain,
            limit: (n: number) => {
              current = current.slice(0, n);
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
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

describe('System 3: ConversationManager Specification Suite', () => {
  it('creates and lists conversations strictly scoped to owner', async () => {
    const mock = new MockSupabaseConversationClient();
    const manager = new ConversationManager(mock as unknown as SupabaseClient);

    const conv1 = await manager.createConversation('owner_alpha', 'dev_phone', 'Morning Directive');
    const conv2 = await manager.createConversation('owner_alpha', 'dev_laptop', 'Evening Planning');

    assert.equal(conv1.ownerId, 'owner_alpha');
    assert.equal(conv1.title, 'Morning Directive');

    const alphaList = await manager.listConversations('owner_alpha');
    assert.equal(alphaList.length, 2);

    const bravoList = await manager.listConversations('owner_bravo');
    assert.equal(bravoList.length, 0);
  });

  it('assigns monotonic sequence numbers to messages in conversation', async () => {
    const mock = new MockSupabaseConversationClient();
    const manager = new ConversationManager(mock as unknown as SupabaseClient);

    const conv = await manager.createConversation('owner_alpha', 'dev_1', 'Sequence Test');

    const msg1 = await manager.addMessage({
      conversationId: conv.id,
      ownerId: 'owner_alpha',
      role: 'user',
      content: 'First turn',
    });
    const msg2 = await manager.addMessage({
      conversationId: conv.id,
      ownerId: 'owner_alpha',
      role: 'assistant',
      content: 'First reply',
    });
    const msg3 = await manager.addMessage({
      conversationId: conv.id,
      ownerId: 'owner_alpha',
      role: 'user',
      content: 'Second turn',
    });

    assert.equal(msg1.sequenceNumber, 1);
    assert.equal(msg2.sequenceNumber, 2);
    assert.equal(msg3.sequenceNumber, 3);
  });

  it('paginates messages using cursor beforeSequence', async () => {
    const mock = new MockSupabaseConversationClient();
    const manager = new ConversationManager(mock as unknown as SupabaseClient);

    const conv = await manager.createConversation('owner_alpha', 'dev_1');

    for (let i = 1; i <= 5; i++) {
      await manager.addMessage({
        conversationId: conv.id,
        ownerId: 'owner_alpha',
        role: 'user',
        content: `Message ${i}`,
      });
    }

    // Fetch page of 2 messages
    const page1 = await manager.getPaginatedMessages(conv.id, 'owner_alpha', 2);
    assert.equal(page1.messages.length, 2);
    assert.equal(page1.hasMore, true);
    assert.ok(page1.nextCursor);

    // Fetch next page before sequence cursor
    const beforeSeq = Number(page1.nextCursor);
    const page2 = await manager.getPaginatedMessages(conv.id, 'owner_alpha', 2, beforeSeq);
    assert.equal(page2.messages.length, 2);
  });

  it('validates cross-device continuity handover', async () => {
    const mock = new MockSupabaseConversationClient();
    const manager = new ConversationManager(mock as unknown as SupabaseClient);

    const conv = await manager.createConversation('owner_alpha', 'dev_web', 'Cross Device Conv');

    // Handover to Android phone
    const handover1 = await manager.validateDeviceContinuity(conv.id, 'dev_android', 'owner_alpha');
    assert.equal(handover1.valid, true);

    // Handover rejected for different owner
    const handover2 = await manager.validateDeviceContinuity(conv.id, 'dev_android', 'owner_bravo');
    assert.equal(handover2.valid, false);
  });

  it('saves and retrieves latest conversation summary', async () => {
    const mock = new MockSupabaseConversationClient();
    const manager = new ConversationManager(mock as unknown as SupabaseClient);

    const conv = await manager.createConversation('owner_alpha', 'dev_1');
    const summary: ConversationSummary = {
      id: 'sum_101' as ConversationSummaryId,
      conversationId: conv.id as ConversationId,
      ownerId: 'owner_alpha' as OwnerId,
      summary: 'Architecture decisions finalized.',
      keyDecisions: ['Lock Turbo pipeline'],
      openTasks: ['Execute System 3 test'],
      createdAt: new Date().toISOString(),
    };

    await manager.saveSummary(summary);
    const retrieved = await manager.getLatestSummary(conv.id, 'owner_alpha');

    assert.ok(retrieved);
    assert.equal(retrieved?.id, 'sum_101');
    assert.equal(retrieved?.summary, 'Architecture decisions finalized.');
  });

  it('cascades deletion across conversation, messages, and summaries', async () => {
    const mock = new MockSupabaseConversationClient();
    const manager = new ConversationManager(mock as unknown as SupabaseClient);

    const conv = await manager.createConversation('owner_alpha', 'dev_1');
    await manager.addMessage({
      conversationId: conv.id,
      ownerId: 'owner_alpha',
      role: 'user',
      content: 'Message to be purged',
    });
    await manager.saveSummary({
      id: 'sum_purge' as ConversationSummaryId,
      conversationId: conv.id as ConversationId,
      ownerId: 'owner_alpha' as OwnerId,
      summary: 'Summary to be purged',
      keyDecisions: [],
      openTasks: [],
      createdAt: new Date().toISOString(),
    });

    assert.equal(mock.conversations.length, 1);
    assert.equal(mock.messages.length, 1);
    assert.equal(mock.summaries.length, 1);

    const deleted = await manager.deleteConversation(conv.id, 'owner_alpha');
    assert.equal(deleted, true);

    assert.equal(mock.conversations.length, 0);
    assert.equal(mock.messages.length, 0);
    assert.equal(mock.summaries.length, 0);
  });
});
