# Victor — Locked Architectural Decisions

These are the current baseline decisions. If repository evidence makes a decision infeasible or unsafe, the agent must explain the conflict and propose an explicit decision change; it must not silently override it.

1. Victor is one persistent personal AI identity, not separate assistants per device.
2. Intelligence and shared memory are backend concerns, independent of the UI.
3. The architecture has eight systems as defined in `01_UNIFIED_ARCHITECTURE.md`.
4. Capability discovery and tool execution are separate from reasoning.
5. The Trust & Execution Engine is the mandatory authority gate for actions.
6. The model must never be the final authority for permissions.
7. Local agents are optional execution endpoints, not independent brains.
8. The owner identity and device identity are distinct.
9. Access is owner-controlled and devices can be paired and revoked.
10. The experience layer, dashboard, and living character do not own business logic or authorization.
11. Prefer a modular monolith; split services only for a documented reason.
12. Reuse existing working infrastructure before adding dependencies.
13. Phone-first UX is a priority; backend design remains device-independent.
14. Never report an action as successful without an execution result and appropriate verification.
15. Never claim tests passed unless they were actually run and results recorded.
16. Preserve unrelated functionality and avoid broad rewrites.
17. All system interfaces must be documented and versioned.
18. Completion is evidence-based and uses the global Definition of Done.
