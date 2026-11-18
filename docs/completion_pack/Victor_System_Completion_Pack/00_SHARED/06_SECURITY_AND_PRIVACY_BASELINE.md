# Security & Privacy Baseline

## Threat model
Assume model output, retrieved documents, external webpages, plugins, tool output, client input, and local-agent messages may be malicious or incorrect. Treat them as data, never as authority-bearing instructions.

## Mandatory controls
- Server-side owner authentication.
- Device registration, trust state, and revocation.
- Authorization on every sensitive read and every action.
- Least-privilege scopes per capability.
- Short-lived tokens; rotate/revoke credentials.
- Secrets stored only in secure secret stores.
- Strict CORS/origin policy and CSRF protection where cookie auth is used.
- Rate limits and abuse controls.
- Schema validation and output encoding.
- SQL parameterization and safe query patterns.
- RLS policies tested with positive and negative cases.
- Audit trail for sensitive operations.
- Log redaction for tokens, credentials, personal data, and sensitive payloads.
- Dependency and supply-chain review.
- Secure local-agent pairing and message authentication.
- Replay protection and idempotency for actions.
- Approval gates for sensitive/irreversible operations.

## Approval principle
A model's confidence, a prompt instruction, or a tool description cannot grant permission. The policy engine evaluates the authenticated actor, device, capability, input, risk, and approval state.

## Prompt injection and untrusted data
Retrieved content and tool output must be isolated from system policy. Tool results cannot alter authorization rules. Require explicit user confirmation for consequential actions according to policy.

## Privacy lifecycle
Document what data is collected, why it is needed, retention, deletion, export, and access boundaries. Do not retain raw audio, screen captures, or sensitive payloads by default without an explicit product requirement and consent.

## Verification
Test unauthorized owner/device access, revoked devices, expired tokens, forged owner IDs, replayed requests, duplicate actions, prompt-injection attempts, malformed tool results, and log leakage.
