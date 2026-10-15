# API and backend impact

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Implemented integration contract and coverage requirements; release environment acceptance is WIP.\
**Refreshed:** 2026-10-12.

## Workspace context

Preserve `AppScope` from authentication. Resolve a personal workspace against user ID, project/group scope, and archive state. A client selector identifies a requested destination; it is not evidence of ownership.

Thread validated content context through reads and commands. Public browsing, public previews, and share-link access use their existing explicit access paths. Cross-workspace copy is a command that deliberately validates both sides.

Prefer explicit workspace arguments in the client and server API. A mutable process-wide or singleton current-workspace value would misroute retries and concurrent tabs.

## Selected API surfaces

[Document 15](15_execution_contracts.md) is the exact contract. New workspace routes carry a path ID; existing private REST/SSE routes require captured X-Workspace-Id, and sockets use workspace_id query parameters. No default-workspace fallback is allowed on private content requests. The table below summarizes integration surfaces.

| Surface | Example | Behavior |
|---|---|---|
| Workspace list/create | `GET/POST /workspaces` | Owned workspaces; active by default; include-archived option |
| Rename/settings | `PATCH /workspaces/{id}` | Validate label and supported preferences |
| Archive/restore | Explicit workspace lifecycle commands | Reject new content writes when archived |
| Collections | `GET/POST /workspaces/{id}/collections` | Flat groups displayed as library folders; strict DTO with read-only aggregate card_count |
| Collection update/delete | `PATCH/DELETE /workspaces/{id}/collections/{collection_id}` | Preserve cards |
| Bulk membership | `PUT /workspaces/{id}/collections/{collection_id}/members` | Idempotent add/remove for owned same-workspace cards |
| Private library list | Existing scoped lists plus `GET /workspaces/{id}/cards` | Mixed-type envelope, exact counts, collection/uncollected filter before pagination |
| Cross-workspace copy | `POST /workspaces/{destination_id}/copy-cards` | One all-or-nothing transaction: source set, destination, memberships, and request identity |

Preserve per-kind feature gating and supported character/persona filters. Counts, search results, pagination, and import-conflict checks must agree with the selected scope.

The approved frontend composes the scoped collection list with paginated mixed cards in one library browser. These remain separate typed responses; do not inject folder objects into card DTOs or issue one card-list request per folder for counts. The root search filters collection names/descriptions locally and sends card search/type/role predicates to the server before pagination. Folder counts are read-only aggregates of accessible supported memberships and do not advance collection row_version.

## Copy command sketch

This example describes organization context, not generated card content:

```json
{
  "request_id": "copy-cast-001",
  "source_workspace_id": "11111111-1111-4111-8111-111111111111",
  "cards": [
    { "card_type": "character", "card_id": "source-card" }
  ],
  "destination_collection_ids": ["22222222-2222-4222-8222-222222222222"]
}
```

Use the fixed R1 bounds and copy receipt in document 15. Validate the whole command and persist everything in one transaction; any failure rolls back and creates nothing, with no resume or retry state on the server. A lost response or concurrent identical request must not create another batch (the success-only receipt replays it); explicit Copy again uses a new request ID.

The existing `tb_operation_receipt` is constrained around card generation. Do not assume it can record generic copying unchanged; use the separate copy receipt and leave existing card receipts' purpose intact.

## Required repository coverage

| Operation | Validation/behavior |
|---|---|
| Card detail, edits, drafts, versions, delete | Owned workspace and immutable command origin |
| Manual/AI creation and imports | Destination plus initial collection membership |
| Story/session creation | Same-workspace live sources or explicit prior copy |
| Story/Codex edits and context reads | Story workspace; existing snapshot semantics |
| Lorebook attachment, extraction, resource linking | Same-workspace live references and scoped global activation |
| Assistant create/list/get/stream/recovery/delete | Unified conversation workspace, including unbound/app kinds |
| Media generate/list/delete and task actions | Validated target/origin; reference-safe account media lifecycle |
| Public/share imports | Explicit destination and destination-aware deduplication |
| Account-content deletion | New roots and relationships in the established cleanup order |

Do not limit enforcement to list endpoints. Central boundary checks plus repository predicates should cover direct IDs and child operations. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## AI finalization and replay

[Card execution](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_execution.py) admits a graph and [generation finalization](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_generation_store.py) inserts the card during completion. Capture destination and collection IDs before admission, include them in the request fingerprint, and retain them independently of browser state.

Persist card plus memberships atomically. Freeze the original destination for replay and recovery. Reject reuse of an operation ID with a changed destination. Ordinary account-wide request-ID uniqueness can remain if the fingerprint catches destination changes.

The model still generates the existing card body. Workspace labels and collection IDs are assigned by application logic.

## Unified assistants

Use [current assistant routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/assistant.py), [shared core](/home/andres/PycharmProjects/magic-worlds-api/src/services/assistants/core.py), and the kind handlers. Conversation workspace becomes part of scope for all kinds. The card/lorebook target must match it when bound.

The app assistant uses client-built context. Scope the supplied library/resources on the client and keep the backend conversation/operation origin. If resource IDs are accepted for server resolution, validate them again; do not trust an ID because it arrived in a digest.

Library New preserves the existing creator and assistant routes. An unbound card-assistant turn creating its first target admits the creator's captured workspace and initial collection IDs under document 15. Bound assistant edits keep existing memberships. A target already saved by direct generation or an assistant remains that same identity when the editor saves; reconciliation must not insert another card or replay removed membership. History handoff resolves the conversation/target origin rather than using the browser's current workspace.

Workspace switching must not apply an old final target to the new form. Existing target/CAS and retry behavior should be extended rather than bypassed.

## Jobs, sockets, and lifecycle

Workers must reconstruct workspace origin from durable state, including startup recovery. Job/receipt lists are workspace-local; the mixed notification inbox retains origin labels. An account-wide multi-operation monitor is deferred.

The current generic `/tasks` route supports theme songs only. Add origin handling to the existing image and TTS job paths too; broadening `/tasks` to every operation is an optional separate change.

Archive blocks new work while allowing admitted jobs to finish into their retained origin through a record-specific finalization capability. Deleted initial collections are omitted with stable completion warnings; do not fail a paid generation for lost grouping. The default workspace cannot be archived; another workspace with an active call is blocked until that call ends.

Socket authorization should resolve the owned session and its workspace. Existing message frames need not change merely to add organization. Client event ownership must prevent a previous session from updating the active workspace.

No workspace permission, card CRUD, or collection membership should be delegated to `api.magic_llm`, `magic-agents`, or `magic-llm`.

## Current-project integration requirements

Use [document 16](16_scope_inventory.md) as the route/service inventory, including extraction source hashes/CAS, generic content execution/profile recovery, internal writer executions, card receipts, voice transcripts and lifecycle, durable notifications, imports/exports, media downloads, and account wipe.

Image profiles and their system/user defaults remain account/application scoped. Preserve current fal/OpenRouter and BYOK behavior. Streaming call TTS and persisted narration jobs have different lifecycles; do not assume one job route covers both.

Private responses gain explicit organization metadata at the transport boundary. Update strict frontend/backend validators intentionally while keeping historical output snapshots and generated model content unchanged. Membership changes do not require a graph/profile/prompt update.

CORS must permit the new workspace selector and initial-collection headers; transport tests cover auth refresh and retries retaining the original destination. Public previews/binary assets/account controls retain their existing authorization paths. No module-wide mutable current workspace is introduced.

Because the header is required with no fallback, a frontend build and an API build that disagree cannot work together. The frontend's startup handshake, hidden-UI rollout state, stale-tab handling and deploy order are specified in document 08 (Release compatibility and rollout UI) and document 11; the API side only needs the capability endpoint, the required header, and `WORKSPACE_REQUIRED` for requests without it.
