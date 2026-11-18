# Victor — Unified Technical Architecture

## 1. Architectural model

Victor consists of eight cooperating systems:

1. **Victor Core — Intelligence**
2. **Memory & Knowledge**
3. **Context & Conversation**
4. **Planning & Orchestration**
5. **Capability & Tool Fabric**
6. **Trust & Execution Engine**
7. **Universal Access**
8. **Experience & Presence**

The systems share identity, contracts, event semantics, authorization rules, observability, and versioned interfaces.

## 2. Responsibility boundaries

### System 1 — Victor Core
Owns request understanding, intent classification, reasoning, model routing, response generation, and coordination. It does not own persistent memory storage, tool implementation, or permission enforcement.

### System 2 — Memory & Knowledge
Owns memory lifecycle, extraction, classification, storage, retrieval, provenance, embeddings, knowledge ingestion, retention, and user-directed correction/deletion. It does not independently decide or execute actions.

### System 3 — Context & Conversation
Owns conversation/session state, context assembly, task continuity, relevance selection, and context-window budgeting. It obtains memory through defined interfaces rather than bypassing memory policies.

### System 4 — Planning & Orchestration
Owns task decomposition, dependency graphs, workflow state, scheduling, retries, resumability, and coordination. It proposes execution steps but cannot grant itself authority.

### System 5 — Capability & Tool Fabric
Owns capability metadata, registration, discovery, versioning, schema validation, adapters, routing, and normalized results. It cannot bypass System 6.

### System 6 — Trust & Execution Engine
Owns authentication-context validation, authorization, risk classification, approval requirements, execution policy, dispatch authorization, audit records, idempotency controls, and outcome verification. It is the final authority for actions.

### System 7 — Universal Access
Owns API ingress, sessions, device registration/pairing/revocation, client identity, realtime transport, and secure device communication. A device's identity is distinct from the owner's identity.

### System 8 — Experience & Presence
Owns UI, voice interaction, character rendering, animation, expressions, accessibility, and client-specific presentation. It reflects actual backend state and does not fabricate execution status.

## 3. Logical flow

```text
Authorized client
      |
      v
Universal Access (7)
      |
      v
Context & Conversation (3) <----> Memory & Knowledge (2)
      |
      v
Victor Core (1)
      |
      v
Planning & Orchestration (4)
      |
      v
Capability & Tool Fabric (5)
      |
      v
Trust & Execution Engine (6)
      |
      v
Approved cloud worker / authorized local agent / external adapter
      |
      v
Verified result + audit event
      |
      +------> Context, memory (when appropriate), realtime clients
      |
      v
Experience & Presence (8)
```

This is a logical flow. Implementations may use internal function calls, queues, events, or network boundaries, provided the authority boundaries remain enforceable.

## 4. Recommended deployment shape

Start with a modular monolith for core backend responsibilities. Split workers or services only when isolation, scaling, platform constraints, or reliability justify it.

- Cloud: shared identity, policy, orchestration, memory, model routing, task state, event delivery.
- Local agent: device-local capabilities requiring local OS access.
- Clients: web/PWA, Android, and later desktop/TV/wearables.
- Persistence: existing supported database and storage infrastructure; Supabase/PostgreSQL is the preferred direction if it is already established in the active repository.
- Vector retrieval: PostgreSQL with pgvector where appropriate.
- Transport: documented REST APIs and realtime channel/event contracts.
- AI: provider adapters behind a model interface.

Do not introduce a new database, queue, framework, or microservice without documenting why existing infrastructure is insufficient.

## 5. Cross-system contracts

All systems must use versioned, validated contracts for:

- Identity and actor context.
- Device and session identity.
- Conversation and context snapshots.
- Memory retrieval and mutation.
- Task and workflow state.
- Capability metadata and invocation.
- Authorization decisions and approvals.
- Execution requests and results.
- Domain events and realtime notifications.
- Error codes and tracing/correlation identifiers.

Contract definitions should live in a shared package or a clearly designated canonical location. Avoid duplicate types with subtly different semantics.

## 6. Event model

Events should be versioned, traceable, and scoped. Suggested event names:

- `conversation.message.created`
- `context.updated`
- `memory.created`
- `memory.updated`
- `task.created`
- `task.progress`
- `task.completed`
- `task.failed`
- `execution.approval_required`
- `execution.authorized`
- `execution.started`
- `execution.succeeded`
- `execution.failed`
- `device.paired`
- `device.revoked`
- `device.connected`
- `device.disconnected`
- `companion.state.changed`

Use an outbox or equivalent reliable publication pattern when database state and event publication must remain consistent. Do not promise exactly-once delivery; design idempotent consumers and at-least-once-safe processing.

## 7. Data ownership

Each system must document which records it owns and which it only reads. No system should write another system's tables directly unless that write path is an explicitly documented contract.

All user data must be scoped to the owner. Device-scoped data must additionally be scoped to an authorized device/session where relevant.

## 8. Cross-cutting requirements

- Server-side authorization on every protected operation.
- Least privilege and short-lived credentials.
- Secrets only in secure server/device secret stores.
- Input validation at trust boundaries.
- Structured logs with correlation IDs and redaction.
- Metrics and traces for critical workflows.
- Schema migrations and rollback strategy.
- Versioned APIs and backward compatibility.
- Unit, integration, security, and end-to-end tests.
- Documented degraded/offline behavior.
- No success status until the result is verified to the degree required by the capability.
