# Victor — Master Context

## Product identity

Victor (Victor Noctis) is intended to be a persistent, owner-controlled personal AI system. It is not merely a chatbot, a single Android app, a dashboard, or a 3D character.

The product goal is one coherent intelligence that can be accessed through multiple authorized interfaces and can use capabilities across cloud and local execution environments.

## Product promise

- One persistent Victor identity.
- One shared intelligence and reasoning layer.
- Shared, permission-controlled memory and task context.
- Multiple authorized devices and interfaces.
- Extensible capabilities through standardized contracts.
- Controlled execution with explicit authorization and verifiable outcomes.
- Natural interaction through text, voice, and an optional living character.

## Product principles

1. **One brain, many interfaces:** devices do not host independent Victor identities or independent memory silos.
2. **Owner control:** access and actions are limited to the owner and explicitly authorized devices.
3. **Separation of concerns:** intelligence, memory, tools, execution authority, access, and presentation have distinct responsibilities.
4. **Provider independence:** model providers and external services are adapters, not the product's identity.
5. **Capability extensibility:** new tools should be added through contracts and registration, not by hardcoding them into reasoning logic.
6. **Evidence over claims:** no feature is complete until its real behavior is tested.
7. **Minimal complexity:** prefer a well-structured modular monolith and independently deployed workers only where justified.
8. **Phone-first, device-independent:** prioritize a useful phone experience while keeping the backend independent of any one client.
9. **Security by design:** no model output, prompt, plugin, tool, or local agent can bypass server-side authorization.
10. **Preserve working code:** inspect before modifying; avoid unnecessary rewrites.

## Product boundaries

- The 3D companion is a presentation/presence subsystem, not the brain.
- The dashboard is an interface, not the source of truth for tasks or permissions.
- Local device agents execute only explicitly authorized device-local operations.
- Cloud services own shared identity, policy, orchestration, and persistent state.
- AI models provide reasoning and language capabilities but do not possess independent authority.

## Current repository context

The active target is the newer GitHub repository named `Victor`, associated in the conversation with the White Wolf owner account. The engineering agent must verify the exact repository URL, branch, commit, remotes, and working tree before acting.

Do not assume that older repositories such as `VIC-Cloud` or `Velmora-Intelligence-Commander` are the current source of truth. Reuse historical work only when it is explicitly present in the active repository or supplied as a verified dependency.

## Audit baseline caution

A prior ZIP-based review discussed Android/Kotlin/Jetpack Compose, Next.js, shared/core packages, Supabase, capability registry, and a Victor Trust & Execution foundation, and raised concerns around authentication alignment, RLS/logging, real dispatch, memory/RAG, device pairing, and background execution. These are **leads to re-check**, not confirmed facts about the current checkout. Revalidate each item against current code and tests.
