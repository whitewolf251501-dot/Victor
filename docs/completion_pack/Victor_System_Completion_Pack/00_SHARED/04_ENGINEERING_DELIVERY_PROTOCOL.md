# Engineering Delivery Protocol

## Before editing
1. Confirm repository root, remote URL, branch, HEAD commit, and clean/dirty working tree.
2. Read project instructions, package manifests, architecture docs, and relevant system code.
3. Run baseline build, tests, lint, type checks, and platform checks that are available.
4. Inventory existing behavior and dependencies.
5. Map each system requirement to existing code, missing code, tests, and risks.
6. Identify shared contracts and migrations affected.
7. Present a concise implementation plan before destructive or broad changes.

## During implementation
- Work only within the selected system and explicitly approved shared contracts.
- Make small, reviewable changes.
- Preserve existing conventions unless they are demonstrably unsafe or unworkable.
- Add tests alongside behavior.
- Add or update migrations safely.
- Never place secrets in source, logs, prompts, or generated docs.
- Do not disable tests, security controls, lint rules, or type checks to create a green result.
- Do not replace real implementations with mocks outside tests.
- Do not claim external integrations work unless exercised against a safe test environment.
- Ask for user approval before irreversible production operations, external communications, purchases, or data deletion.

## Before declaring complete
1. Run all relevant checks and record exact commands and exit codes.
2. Run negative/security tests, not only happy paths.
3. Inspect Git diff and generated files.
4. Verify migrations and rollback/recovery strategy.
5. Produce `SYSTEM_COMPLETION_REPORT.md`.
6. List all unverified requirements and blockers.
7. Do not start another system until acceptance or an explicit decision to defer is recorded.

## Stop conditions
Stop and report rather than guessing if:
- The target repository or branch is ambiguous.
- Required secrets/credentials are missing.
- A migration could destroy data.
- A security design is unclear.
- A cross-system contract must change.
- The requested behavior conflicts with a locked decision.
- A required test cannot be run and no safe alternative exists.
