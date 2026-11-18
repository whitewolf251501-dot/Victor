# VICTOR — System-by-System 100% Completion Pack

**Purpose:** Give an engineering agent (Antigravity or equivalent) a consistent, evidence-driven package for completing Victor one system at a time.

## Important scope statement

This package is the **architecture and engineering instruction baseline** assembled from the decisions currently available in the conversation. It is not a verified description of every file, commit, migration, API, or current implementation in the White Wolf-owned `Victor` repository.

The engineering agent MUST inspect the actual repository and treat its source code, migrations, tests, configuration, and Git history as the implementation source of truth. It must not invent implementation status or claim that a feature works without evidence.

The previously discussed ZIP audit figures are historical estimates, not live GitHub measurements. Re-audit the current checkout before changing code.

## How to use

1. Extract this pack.
2. Open the **current** White Wolf-owned `Victor` repository in Antigravity.
3. Read `00_SHARED/00_MASTER_CONTEXT.md`, `01_UNIFIED_ARCHITECTURE.md`, `02_LOCKED_DECISIONS.md`, and `03_GLOBAL_DEFINITION_OF_DONE.md`.
4. Choose exactly one system folder under `SYSTEMS/`.
5. Attach or make the selected system folder and shared documents available to the agent.
6. Paste the corresponding `MASTER_CRISP_PROMPT.md`.
7. Require a baseline audit before implementation.
8. Review evidence and run independent tests before accepting completion.
9. Update the completion ledger and handover package before starting another system.

## Recommended dependency-aware order

1. System 6 — Trust & Execution Engine
2. System 7 — Universal Access
3. System 1 — Victor Core
4. System 2 — Memory & Knowledge
5. System 3 — Context & Conversation
6. System 4 — Planning & Orchestration
7. System 5 — Capability & Tool Fabric
8. System 8 — Experience & Presence

This is a recommended sequence, not permission to ignore dependencies. Shared contracts may need to be agreed earlier, but implementation scope must remain controlled.

## Package contents

- `00_SHARED/` — vision, architecture, decisions, definition of done, delivery protocol, contracts, security baseline, and completion ledger template.
- `SYSTEMS/` — one specification and one system-specific Master CRISP prompt for each of the eight systems.

## Non-negotiable rule

**100% means verified acceptance against explicit criteria, not an agent's self-reported percentage.** If a requirement cannot be implemented or verified, mark it blocked or not verified. Never inflate completion.
