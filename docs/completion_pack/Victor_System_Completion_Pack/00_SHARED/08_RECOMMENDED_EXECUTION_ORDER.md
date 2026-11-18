# Recommended System Execution Order

This order is dependency-aware and can be adjusted only with a documented reason.

| Sequence | System | Reason |
|---:|---|---|
| 1 | 6 — Trust & Execution Engine | Establishes the mandatory authority and safe execution boundary. |
| 2 | 7 — Universal Access | Establishes trusted owner/device identity and secure ingress. |
| 3 | 1 — Victor Core | Builds intelligence on top of stable access and execution contracts. |
| 4 | 2 — Memory & Knowledge | Establishes persistent recall and retrieval. |
| 5 | 3 — Context & Conversation | Integrates memory, sessions, and continuity. |
| 6 | 4 — Planning & Orchestration | Coordinates durable multistep work. |
| 7 | 5 — Capability & Tool Fabric | Scales discoverable tools on top of authorization and orchestration. |
| 8 | 8 — Experience & Presence | Completes the user-facing experience against stable backend contracts. |

## Important nuance

Some foundational contract work must happen before the first system can be fully completed. Define shared identity, execution, event, and error contracts early. Do not use this sequence to postpone security requirements or create circular dependencies.

A system may be accepted only when its own criteria and integration contracts are satisfied. Later systems must not silently break an accepted system. Any contract change requires compatibility analysis and regression tests.
