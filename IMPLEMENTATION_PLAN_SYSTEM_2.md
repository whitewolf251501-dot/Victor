# System 2: Memory & Knowledge — Implementation Plan

**System Under Execution:** System 2: Memory & Knowledge  
**Target Completion:** 100% Production-Ready & Verified  
**Date:** 2026-11-18  

---

## 1. Objectives & Architectural Invariants

1. **Owner-Only Isolation:** All memory and knowledge data structures strictly enforce `owner_id`. No cross-user or unauthorized leakage is permitted.
2. **Provenance & Confidence Tracking:** Every memory record must clearly distinguish user-stated facts, autonomously inferred candidates, external source facts, and system state, accompanied by a numeric confidence score (0.0 to 1.0).
3. **Secret Containment:** Sensitive data (passwords, auth tokens, private keys) must be sanitized and rejected prior to persistent storage.
4. **RAG Knowledge Ingestion:** Document chunking, content hash deduplication, and cascading deletion across derived chunks and index entries.
5. **Hybrid Bounded Retrieval:** Hybrid scoring combining keyword overlap, vector similarity, recency decay, and importance weighting with strict context window bounds.
6. **Retention & Lifecycle:** Export capabilities (JSON/JSONL) and retention policy enforcement.

---

## 2. Sequenced Implementation Phases

### Phase 1: Shared Contracts & Database Migration
1. **Shared Memory Types (`packages/shared/src/types/memory.ts`)**:
   - Add `MemoryProvenance`: `'user_stated' | 'inferred' | 'external_source' | 'system'`.
   - Extend `Memory` interface: `provenance`, `confidence`, `sourceRef?`, `embeddingModel?`, `embeddingVersion?`.
   - Add knowledge types: `KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeSearchResult`.
   - Export new contracts in `packages/shared/src/index.ts` and compile `@victor/shared`.
2. **Database Migration (`supabase/migrations/20261101000005_memory_knowledge_hardening.sql`)**:
   - Add `provenance`, `confidence`, `source_ref`, `embedding_model`, `embedding_version` to `memories` table.
   - Create `knowledge_documents` and `knowledge_chunks` tables with RLS and cascade deletion.

### Phase 2: Memory Extraction & Secret Sanitization
1. **Memory Extractor (`packages/core/src/memory/memory-extractor.ts`)**:
   - Integrate `SecretSanitizer` to scrub sensitive key values, bearer tokens, and private credentials before extracting memory candidates.
   - Tag extracted candidates with explicit `provenance` ('inferred' or 'user_stated') and confidence.

### Phase 3: Knowledge Ingestor & Chunking
1. **Knowledge Ingestor (`packages/core/src/memory/knowledge-ingestor.ts`)**:
   - Text chunking with sliding window (token/character size and overlap).
   - SHA-256 deduplication to prevent duplicate chunking/storage.
   - Document ingestion and deletion with cascading chunk removal.

### Phase 4: Hybrid Retriever & Memory Lifecycle
1. **Hybrid Retriever (`packages/core/src/memory/hybrid-retriever.ts`)**:
   - Cosine similarity calculation for vector embeddings.
   - Hybrid scoring combining keyword BM25/overlap, vector cosine distance, and recency.
   - Prompt injection defense: sanitize and wrap retrieved knowledge/memories as non-executable data.
   - Enforce bounded context (max characters/tokens).
2. **Memory Manager (`packages/core/src/memory/memory-manager.ts`)**:
   - Update CRUD to handle `provenance`, `confidence`, and secret scrubbing.
   - Add `exportMemories(format: 'json' | 'jsonl')`.
   - Add `pruneExpiredMemories(policy: RetentionPolicy)`.
3. **Web API (`apps/web/src/app/api/victor/memories/route.ts`)**:
   - Support `export=jsonl` and `export=json` query parameters.

### Phase 5: Verification & Handover
1. Build test suites in `packages/core/test/memory/`:
   - `memory-manager.test.ts` (CRUD, owner isolation, duplicate detection, retention pruning, export).
   - `memory-extractor.test.ts` (Extraction accuracy, confidence gating, secret sanitization).
   - `knowledge-ingestor.test.ts` (Chunking, SHA-256 deduplication, deletion propagation, owner isolation).
   - `hybrid-retriever.test.ts` (Keyword + vector cosine ranking, prompt injection defense, bounded limits).
2. Run full test suite (`npm test`), static analysis (`npm run type-check`), linting (`npm run lint`), and Next.js production build (`npm run build`).
3. Generate `SYSTEM_COMPLETION_REPORT_SYSTEM_2.md` and update `COMPLETION_LEDGER.md`.
