# System 8 — Experience & Presence

## Mission
Provide a coherent, accessible, responsive way to interact with Victor through text, voice, dashboard, and optional living character while reflecting real system state.

## Scope
- Web/PWA and Android interaction surfaces already in repository.
- Conversation and task UI.
- Voice input/output adapters and permission UX.
- 3D character rendering, animation, expressions, and interaction states where included.
- Tap/gesture/quick-action behavior where specified.
- Realtime state synchronization and accessibility.
- Device-specific presentation adapters.

## Explicit non-scope
- Core reasoning and persistent state ownership.
- Authorization decisions and direct execution authority.
- Canonical memory and task persistence.

## Dependencies
Systems 1, 3, 6, and 7 contracts; platform capabilities and approved voice/3D assets.

## Acceptance criteria
- [ ] Interfaces use shared backend contracts and do not duplicate business logic.
- [ ] Phone-first layouts are responsive, accessible, and resilient to network loss.
- [ ] Text/voice interactions show clear listening, processing, speaking, error, and cancellation states.
- [ ] Character states are driven by actual backend/client state and never claim an action succeeded without evidence.
- [ ] Animation/rendering does not block core conversation or task operation.
- [ ] Permissions for microphone, screen/context access, notifications, and device functions are explicit and revocable.
- [ ] Tap/gesture behavior is discoverable and does not conflict with accessibility or OS gestures.
- [ ] Realtime updates handle reconnect, stale state, and duplicate events.
- [ ] Performance budgets and fallback behavior are documented for lower-spec devices.
- [ ] Tests cover critical flows, accessibility, responsive layouts, permission denial, offline states, and state synchronization.

## Key risks
UI/backend divergence; misleading companion behavior; excessive resource usage; permission overreach; inaccessible gestures.

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
