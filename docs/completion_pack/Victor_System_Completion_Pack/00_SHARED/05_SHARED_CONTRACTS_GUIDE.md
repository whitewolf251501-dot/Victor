# Shared Contracts Guide

This document defines the contract families that systems must align with. It does not prescribe final field names where the repository already has a canonical implementation. Inspect and reuse existing types before creating new ones.

## Identity context
Must identify the authenticated owner, authenticated device (if applicable), session, scopes/roles, authentication method, issue/expiry metadata, and correlation ID. Never trust client-supplied owner IDs without server-side binding to the authenticated principal.

## Context envelope
Should include conversation ID, session ID, current task references, relevant memory references, selected device context, timestamps, provenance, and a bounded context budget. Avoid copying all stored memory into every request.

## Capability descriptor
Must define stable capability ID, version, description, input/output JSON schema, risk classification, required scopes, execution target, timeout, idempotency behavior, availability, and owner/tenant scope.

## Execution envelope
Must bind actor, device/session, capability ID/version, validated input, task/step IDs, idempotency key, policy decision, approval reference where needed, deadline, and trace/correlation ID.

## Execution result
Must distinguish accepted, queued, running, succeeded, failed, cancelled, timed out, denied, and approval-required states. Include structured output, error category, verification evidence, timestamps, and execution reference. Never map "queued" or "dispatched" to "succeeded".

## Event envelope
Must include event ID, event type, schema version, timestamp, owner scope, producer, correlation/causation IDs, and payload. Events must not expose secrets.

## Error model
Use stable machine-readable error codes, safe user-facing messages, internal diagnostic detail behind authorization, retryability, and correlation ID.

## Compatibility
- Version breaking changes.
- Validate at boundaries.
- Maintain consumers during migration where feasible.
- Add contract tests for producers and consumers.
- Document deprecation windows.
