# ADR-AIMP-01: shared tools with target-bound execution

**Status:** proposed. **Date:** 2026-10-15. **Deciders:** product, frontend, BFF, executor/profile, and persistence owners; individuals unassigned.

## Context

The main assistant can read a frontend digest but cannot act. Card/lorebook assistants already have document schemas, field safety, pure action planning, revision checks, scoped mutations, and recovery.

Their current implementation assumes that a conversation has one kind and one bound target. This assumption exists in the handlers, store, database message validation, snapshots, and frontend verifier. Adding tools to `AppAssistantHandler` would change `bool(handler.tools)` and drive the store down a target path that the app conversation cannot satisfy.

The requirement is one maintained implementation of existing document operations, available from multiple surfaces under source and permission constraints.

## Proposed decision

Extract reusable document tool specifications, planning, and transactional mutation from surface-specific assistant lifecycle code. Add a bounded main-assistant controller that supplies an explicit server-resolved editing context and records its actions separately from the legacy bound-target turn shape.

Keep conversation `kind = app` for the main assistant. Keep existing `card` and `lorebook` kinds for editors. Do not create another kind merely to expose tools.

Keep the six existing tool names and their document arguments. The main assistant's execution context supplies the selected target and CAS; the model does not add arbitrary target IDs to `mw_patch_card` or `mw_patch_lorebook`.

## Alternatives considered

| Option | Complexity | Reuse | Operational consequences |
| --- | --- | --- | --- |
| Copy graph nodes/handlers into app | Low initially, high drift later | Definitions copied | Target/store/profile assumptions still broken; unsafe shortcut |
| Invoke editor assistant HTTP routes | Medium | Whole old workflow | Hidden threads, duplicated lifecycle, user-visible history and billing ambiguity |
| General CRUD proxy | Medium to high | Endpoint calls only | Rebuilds CAS, domain planning, and action accounting around a broad model API |
| Shared registry and domain action service | Medium, staged | Definitions, validation, planning, mutation | Requires explicit protocol/persistence changes; recommended |
| New multi-agent framework | High | Adapter-dependent | No first-release requirement; expands failure and credential boundaries |

A host-mediated editor handoff remains a useful fallback while a capability is unavailable. It is navigation, not the final implementation of main-page tooling.

## Component boundaries

~~~mermaid
flowchart TD
    UI[Main Assistant: sources, mode, selected target] --> API[Workspace-bound BFF]
    API --> Policy[Capability and target authorization]
    Policy --> Controller[Bounded app controller]
    Controller --> Reads[Scoped search and detail adapters]
    Controller --> Registry[Shared tool registry and schemas]
    Editors[Card and lorebook editor handlers] --> Registry
    Registry --> Planner[Shared document validation and planning]
    Planner --> Commit[Shared transactional document command]
    Commit --> Domain[Existing card and lorebook persistence]
    Commit --> Receipts[Versioned action receipts]
    Controller --> Profiles[Existing published-profile execution]
~~~

The frontend and API do not call a provider directly. Document planning remains BFF-owned; model output is an untrusted proposed command.

## Reuse map

| Existing owner | Reuse/refactor | Main-assistant addition |
| --- | --- | --- |
| [Runtime graph artifacts](../../../../PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/) and graph loaders | Generate tool nodes from one canonical specification per domain/type/operation; retain versioned graph outputs | Stage-specific projection of eligible tools |
| [card.py](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/card.py): field policy, media/voice preservation, `plan_card_action` | Extract shared document planning with explicit context, preserving semantics | Host-selected card type, saved snapshot, and bounded writable fields |
| [lorebook.py](../../../../PycharmProjects/magic-worlds-api/src/services/assistants/lorebook.py): normalization, validation, `plan_lorebook_action` | Extract shared document planning and maintain entry/settings behavior | Host-selected lorebook snapshot and CAS |
| [models.py](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py): `_apply_card_assistant_target`, `_apply_lorebook_assistant_target`, CAS helpers | Extract a document mutation service accepting explicit target context and caller-owned cursor | App action receipts in the same transaction |
| [AssistantTurnStore](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/assistant_turn_store.py) | Retain editor atomic completion and shared admission utilities; stop using “has tools” as a universal document-binding classifier | App run/action lifecycle with explicit effect types |
| [Execution workflows](../../../../PycharmProjects/magic-worlds-api/src/services/llm_workflow_execution.py) | Reuse profile resolution, reservation, lease, cancellation, and completion boundaries | Versioned multi-step orchestration contract; no nested hidden admissions |
| [Frontend shared hook](../../src/features/creation/common/components/assistant/useAssistant.ts) and [verifier](../../src/infrastructure/api/assistantContract.ts) | Reuse request ownership, stop/retry/reconcile, and strict result checks | Versioned app result projection and action cards |
| [Knowledge hook](../../src/features/appAssistant/hooks/useAssistantKnowledge.ts) | Retain source/focus preferences and workspace invalidation | Typed source manifest, explicit edit target, and retrieval state |
| Existing card/lorebook list/get selectors | Reuse scoped queries internally | Agent-facing result projection, references, and bounds |
| [Card context](../../../../PycharmProjects/magic-worlds-api/src/services/card_context.py), [chat workflow](../../../../PycharmProjects/magic-worlds-api/src/services/chat_workflows.py), and existing `mw_read_card` spec | Share card-read schema/projection; preserve roleplay snapshot semantics | BFF-authorized card reads with explicit saved-snapshot provenance; no overlapping generic card-detail tool |

Do not synthesize a fake `card` conversation object to call private persistence helpers. Extract their explicit inputs and preserve their lock order, cursor ownership, scope validation, draft semantics, and side effects.

## Shared specification

A proposed tool spec contains name, semantic version, input schema, effect category, source family, allowed target types, profile requirements, argument limits, planner, and executor. Canonical schema construction can derive from existing DTOs plus explicit patch-field policy. Generated runtime JSON is an artifact, not another hand-maintained definition.

Effect categories are explicit: read, prepare, document mutation, and no-change. Neither the presence of tools nor `no_change` implies a target mutation.

The registry is server-owned. The model may see a projection; it cannot modify registry entries or execution policy. Provider-specific schema translation must be deterministic and parity-tested against the canonical contract.

Registry toolset memberships support the [general-assistant switches](14_toolset_controls.md). Intersect app-scoped server policy and user preferences before graph/schema projection and dispatch. Do not implement toolset toggles by changing shared tool definitions or disabling the card/lorebook editor families.

## Document command

A proposed validated command binds:

- Actor/project/group and workspace, provided by authentication and the route.
- Exact target family/type/ID, or explicit creation destination/type.
- Revision and content hash from the server's editable snapshot.
- Tool name/version, validated arguments, writable field scope, and planned resulting document.
- Run/action/idempotency identity and the caller-owned transaction cursor.

The six existing model tool schemas need no new ownership, workspace, or target-ID arguments. Their identity is bound outside the model's argument object.

The shared commit returns the actual saved document and revision, not the model's planned object. Existing editor completion and the new app action lifecycle wrap the same commit service with their respective terminal records.

## Orchestration stages

1. Resolve the server/client capability intersection and user-selected scope.
2. Answer directly when existing context suffices, or use bounded search/detail tools.
3. Resolve one selected target or creation destination. If ambiguous or not authorized, return a target-selection state.
4. Prepare a fresh editable snapshot and expose only its document tool family.
5. Generate exactly one replace/patch/no-change action for that document step.
6. Validate and commit once, or record no change/conflict.
7. Render the receipt. An optional narrative model step cannot change the outcome.

The first release may start at step 3 using an explicit target picker. Search-based discovery is additive. A multi-step app controller is application code using the existing runtime, not a requirement to spawn multiple independent agents.

## Profile and graph contract

Use a versioned `app_assistant` feature contract for tool-enabled execution. Its primary model must support the required tools and streaming contract. Keep a clearly identified text-only path for compatible existing profiles.

Requirements must resolve by supported workflow version. Simply adding tools to the universal app primary requirements would invalidate streaming-only profiles on the legacy path. Define a versioned compatibility/migration rule in the feature/catalog resolver before publishing this change.

Do not silently reuse the user's `card_assistant` profile when the main-page selector shows `app_assistant`. Sharing tools does not imply sharing model preferences, billing identities, or system prompts.

Domain graph fragments should preserve card/lorebook portrayal and field rules without copying tool schemas. App conversation history remains app history; an editor role prompt receives only the task and authorized target context needed for that step.

## Consequences

The extraction costs more than adding graph nodes, but makes field-policy and mutation fixes apply everywhere. It also exposes existing domain defects rather than hiding them behind another implementation.

Versioned app run/action storage, frontend readback, execution feature compatibility, guide retrieval, and billing decisions are real work. [07](07_execution_persistence_and_recovery.md) specifies the proposed lifecycle. [11](11_implementation_plan.md) separates parity-preserving extraction from new behavior.

Revisit this decision only if measured tasks require cross-document transactions or long-lived background execution. Those are separate contracts, not flags to turn on in the one-target path.
