# System 2 — Memory & Knowledge

## Mission
Provide secure, useful, explainable long-term memory and knowledge retrieval with provenance, lifecycle controls, and bounded context delivery.

## Scope
- Memory extraction and candidate generation.
- Working, episodic, semantic, and procedural memory representations where justified.
- Structured persistence and vector/keyword retrieval.
- Embedding generation/versioning and re-embedding strategy.
- RAG ingestion, chunking, retrieval, ranking, and source provenance.
- Memory relevance, deduplication, confidence, correction, retention, export, and deletion.

## Explicit non-scope
- Conversation orchestration and context assembly (System 3).
- Reasoning/model selection (System 1).
- Permission to execute actions (System 6).
- UI rendering (System 8).

## Dependencies
Systems 3 and 1 contracts; database/storage; embedding provider or deterministic test adapter.

## Acceptance criteria
- [ ] Memory records are owner-scoped and protected by server-side authorization/RLS.
- [ ] Memory creation distinguishes user-stated facts, inferred candidates, and external-source facts with provenance and confidence.
- [ ] Retrieval returns relevant records with source/provenance and bounded results.
- [ ] Embeddings have model/version metadata and a documented migration/re-embedding path.
- [ ] RAG ingestion handles file/source identity, chunking, deduplication, failures, and deletion propagation.
- [ ] User correction and deletion remove or invalidate derived embeddings/index entries as required.
- [ ] Sensitive information is not automatically retained outside explicit product policy and consent.
- [ ] Retrieval is tested for relevance, stale/conflicting facts, empty results, prompt injection, and cross-owner isolation.
- [ ] Backups, retention, storage costs, and operational limits are documented.

## Key risks
Storing too much; incorrect inferred memories; cross-user leakage; stale embeddings; prompt injection from retrieved documents.

## Required implementation deliverables
- Baseline audit of current implementation, tests, migrations, and integration points.
- Architecture and data-flow diagram reflecting the actual repository.
- Requirement-to-code-to-test traceability matrix.
- Implementation plan with dependency order and risk notes.
- Production-quality implementation consistent with repository conventions.
- Unit, integration, security, contract, and end-to-end tests appropriate to this system.
- Updated documentation, environment template, and migrations if applicable.
- `SYSTEM_COMPLETION_REPORT.md` with evidence and remaining limitations.

## Completion rule
This system is 100% only when every applicable acceptance criterion is implemented and verified, all global Definition of Done requirements are satisfied, and the owner/reviewer accepts the evidence. If an external credential, device, service, or environment is unavailable, clearly distinguish code-complete from integration-verified and do not claim full acceptance.
