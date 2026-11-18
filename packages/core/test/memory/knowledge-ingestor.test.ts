import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeIngestor, KnowledgeIngestorError } from '../../src/memory/knowledge-ingestor';
import type { SupabaseClient } from '@supabase/supabase-js';

class MockSupabaseKnowledgeClient {
  public docs: any[] = [];
  public chunks: any[] = [];

  from(table: string) {
    if (table === 'knowledge_documents') {
      return {
        select: (_fields?: string) => {
          let current = [...this.docs];
          const chain = {
            eq: (col: string, val: any) => {
              current = current.filter((r) => r[col] === val);
              return chain;
            },
            order: (_col: string, _opts: any) => chain,
            maybeSingle: async () => ({
              data: current.length > 0 ? current[0] : null,
              error: null,
            }),
            then: (resolve: (val: any) => void) => resolve({ data: current, error: null }),
          };
          return chain;
        },
        insert: (record: any) => {
          const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const fullDoc = {
            id: docId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...record,
          };
          this.docs.push(fullDoc);
          return {
            select: () => ({
              single: async () => ({ data: fullDoc, error: null }),
            }),
          };
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
              const before = this.docs.length;
              this.docs = this.docs.filter(
                (d) => !(d.id === targetId && d.owner_id === targetOwner)
              );
              // Cascade delete chunks
              this.chunks = this.chunks.filter(
                (c) => !(c.document_id === targetId && c.owner_id === targetOwner)
              );
              const count = before - this.docs.length;
              resolve({ count, error: null });
            },
          };
          return chain;
        },
      };
    }

    if (table === 'knowledge_chunks') {
      return {
        insert: (records: any[]) => {
          const inserted = records.map((r, i) => ({
            id: `chunk_${Date.now()}_${i}`,
            created_at: new Date().toISOString(),
            ...r,
          }));
          this.chunks.push(...inserted);
          return Promise.resolve({ error: null });
        },
        select: (_fields?: string) => {
          let current = [...this.chunks];
          const chain = {
            eq: (col: string, val: any) => {
              current = current.filter((r) => r[col] === val);
              return chain;
            },
            order: (_col: string, _opts: any) => chain,
            then: (resolve: (val: any) => void) => resolve({ data: current, error: null }),
          };
          return chain;
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }
}

describe('System 2: KnowledgeIngestor Specification Suite', () => {
  it('correctly chunks text using sliding window respecting token approximation', () => {
    const text = 'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey Xray Yankee Zulu.';
    const chunks = KnowledgeIngestor.chunkText(text, { chunkSize: 50, overlap: 15 });

    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= 60);
    }
  });

  it('ingests document, generates SHA-256 hash, and cascades chunk records', async () => {
    const mock = new MockSupabaseKnowledgeClient();
    const ingestor = new KnowledgeIngestor(mock as unknown as SupabaseClient);

    const doc = await ingestor.ingestDocument({
      ownerId: 'owner_alpha',
      title: 'Victor Architecture Blueprint',
      content: 'System 01 is Input Processing. System 02 is Intelligence Core. System 03 is Memory System. System 06 is Victor Trust Engine. System 07 is Shared Infrastructure. System 08 is Output Companion.',
      chunkSize: 70,
      overlap: 20,
    });

    assert.equal(doc.ownerId, 'owner_alpha');
    assert.equal(doc.title, 'Victor Architecture Blueprint');
    assert.ok(doc.contentHash.length === 64); // SHA-256 hex length
    assert.ok(doc.chunkCount >= 2);

    const chunks = await ingestor.getChunks(doc.id, 'owner_alpha');
    assert.equal(chunks.length, doc.chunkCount);
    assert.equal(chunks[0].documentId, doc.id);
  });

  it('deduplicates ingestion of identical content for the same owner', async () => {
    const mock = new MockSupabaseKnowledgeClient();
    const ingestor = new KnowledgeIngestor(mock as unknown as SupabaseClient);

    const content = 'Duplicate document content test string for SHA-256 deduplication.';
    const doc1 = await ingestor.ingestDocument({
      ownerId: 'owner_alpha',
      title: 'Doc Version 1',
      content,
    });

    const doc2 = await ingestor.ingestDocument({
      ownerId: 'owner_alpha',
      title: 'Doc Version 2 (Same content)',
      content,
    });

    assert.equal(doc1.id, doc2.id);
    assert.equal(mock.docs.length, 1);
  });

  it('deletes document and cascades removal of all associated chunks', async () => {
    const mock = new MockSupabaseKnowledgeClient();
    const ingestor = new KnowledgeIngestor(mock as unknown as SupabaseClient);

    const doc = await ingestor.ingestDocument({
      ownerId: 'owner_alpha',
      title: 'Document to be deleted',
      content: 'Some temporary knowledge that will be deleted after verification.',
      chunkSize: 30,
      overlap: 5,
    });

    assert.ok(mock.chunks.length > 0);

    const deleted = await ingestor.deleteDocument(doc.id, 'owner_alpha');
    assert.equal(deleted, true);

    assert.equal(mock.docs.length, 0);
    assert.equal(mock.chunks.length, 0);
  });

  it('enforces cross-owner isolation when deleting and listing documents', async () => {
    const mock = new MockSupabaseKnowledgeClient();
    const ingestor = new KnowledgeIngestor(mock as unknown as SupabaseClient);

    const doc = await ingestor.ingestDocument({
      ownerId: 'owner_alpha',
      title: 'Alpha Private Doc',
      content: 'Owner Alpha proprietary architecture notes.',
    });

    // Owner Bravo cannot delete Owner Alpha's document
    const deletedByBravo = await ingestor.deleteDocument(doc.id, 'owner_bravo');
    assert.equal(deletedByBravo, false);
    assert.equal(mock.docs.length, 1);

    // Owner Bravo cannot see Owner Alpha's document
    const bravoDocs = await ingestor.listDocuments('owner_bravo');
    assert.equal(bravoDocs.length, 0);

    const bravoChunks = await ingestor.getChunks(doc.id, 'owner_bravo');
    assert.equal(bravoChunks.length, 0);
  });
});
