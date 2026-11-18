# Global Definition of Done — Victor Systems

A system may be marked **100% accepted** only when every applicable requirement below is satisfied with evidence.

## A. Scope and architecture
- [ ] System responsibilities and non-responsibilities are implemented.
- [ ] All required acceptance criteria are mapped to code and tests.
- [ ] Shared contracts are versioned and documented.
- [ ] No unauthorized cross-system coupling has been introduced.
- [ ] Existing behavior outside scope remains intact.

## B. Functional behavior
- [ ] Every required user and system flow works end-to-end.
- [ ] Inputs are validated and outputs follow documented schemas.
- [ ] Empty, malformed, duplicate, stale, and unavailable states are handled.
- [ ] Errors are actionable and do not expose secrets or sensitive internals.
- [ ] State transitions are explicit and consistent.

## C. Security and privacy
- [ ] Authentication and authorization are enforced server-side.
- [ ] Least privilege is applied.
- [ ] Owner and device scoping is correct.
- [ ] Secrets are not committed or exposed to clients.
- [ ] Sensitive data is redacted from logs.
- [ ] Relevant abuse cases and negative authorization tests pass.
- [ ] Data retention, export, correction, and deletion requirements are documented where applicable.

## D. Reliability
- [ ] Timeouts and cancellation are handled.
- [ ] Retry behavior is bounded and safe.
- [ ] Duplicate delivery/action behavior is tested.
- [ ] Recovery after process/device/network interruption is tested where applicable.
- [ ] No false-success path exists.
- [ ] Observability exists for critical flows.

## E. Quality
- [ ] Formatting, lint, type checks, and builds pass where configured.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] Security tests pass.
- [ ] End-to-end tests pass for critical user journeys.
- [ ] No unresolved critical/high severity defects remain.
- [ ] Known lower-severity limitations are documented and accepted.

## F. Delivery
- [ ] Documentation and diagrams match implementation.
- [ ] Database migrations are reviewed and tested.
- [ ] Environment template is updated without real secrets.
- [ ] Changed files and rationale are listed.
- [ ] Test commands and exact results are recorded.
- [ ] Git diff is reviewed for accidental changes.
- [ ] Commit reference or clean handover state is recorded.
- [ ] Next-system integration requirements are documented.

## Status vocabulary

- **Not started:** no implementation evidence.
- **In progress:** work exists but acceptance is incomplete.
- **Blocked:** cannot proceed without a dependency or decision.
- **Implemented, unverified:** code exists; required proof is missing.
- **Verified:** tests/evidence support the requirement.
- **Accepted 100%:** every applicable DoD item and acceptance criterion is verified and reviewed.

A percentage must be calculated from explicit weighted criteria, not intuition. Report implementation, verification, and integration readiness separately.
