# System 7 — Universal Access

## Mission
Provide secure, consistent, owner-controlled access to one Victor identity across authorized devices and interfaces.

## Scope
- Authentication integration and session lifecycle.
- Device registration, pairing, trust state, and revocation.
- API gateway and client ingress.
- REST/realtime transport and event subscription authorization.
- Device capability and platform metadata.
- Token refresh, expiry, logout, and compromised-device response.
- Cross-device session continuity interfaces.

## Explicit non-scope
- Reasoning and memory (Systems 1 and 2).
- Capability execution policy (System 6).
- UI design and character presentation (System 8).

## Dependencies
Identity provider/database; Systems 3, 6, and 8 contracts.

## Acceptance criteria
- [ ] Owner authentication is consistent across supported clients and backend endpoints.
- [ ] Device identity is unique, registered, and separately scoped from owner identity.
- [ ] Pairing requires a secure owner-authorized flow and produces revocable device credentials.
- [ ] Revocation takes effect promptly for API and realtime access.
- [ ] Cookie and bearer-token flows are intentionally designed and consistently validated; no accidental auth-mode mismatch remains.
- [ ] Realtime channels enforce owner/device authorization and do not leak cross-owner events.
- [ ] Tokens are short-lived/rotatable and secrets are not embedded in client bundles or repositories.
- [ ] Offline/reconnect behavior and session expiry are explicit.
- [ ] Android/web clients use documented API contracts and consistent error semantics.
- [ ] Tests cover unauthorized devices, revoked devices, expired tokens, token refresh, forged IDs, realtime isolation, and concurrent sessions.

## Key risks
Account takeover; stolen device; token leakage; auth mismatch; realtime data leakage; insecure pairing.

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
