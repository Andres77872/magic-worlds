# R1 execution contracts

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Selected contracts implemented in source; current residuals and release gates remain WIP in 02/04.\
**Refreshed:** 2026-10-12, America/Mexico_City.\
**Authority:** This document resolves the alternatives in documents 05–10. Change it together with affected acceptance scenarios if implementation evidence requires a revision.

## Boundary and transport

Keep the exact existing `AppScope` type. Introduce a separate immutable `WorkspaceContext` containing user ID, AppScope, workspace ID, archive state, and operation intent. Validate it in the BFF; frontend values are selectors only. Do not put personal workspace IDs into upstream `workspace_id`, generated content, profile configuration, credentials, or graph payloads.

| Request family | Workspace selector | Rule |
|---|---|---|
| New `/workspaces/{workspace_id}/…` routes | Path ID | A supplied header must match the path |
| Existing private REST and SSE content routes | `X-Workspace-Id` header | Required; no fallback to the current/default workspace |
| Text and voice WebSockets | `workspace_id` URL query | Required; retain existing Bearer subprotocol and frames |
| Public discovery, share preview, auth, billing, profiles, voice presets, account notifications, binary assets | None | Retain current explicit access rules |
| Cross-workspace copying | Destination path plus source body ID | Validate both owned application scopes; source may be archived |
| Account-wide multi-operation monitor | Deferred | R1 keeps scoped job/receipt lists and the existing mixed notification inbox |

For card creation, AI card generation, an unbound card-assistant turn that creates its first target, duplicate, and public/share/file import, optional `X-Initial-Collection-Ids` supplies up to 20 distinct comma-separated destination collection UUIDs. Omitted/empty means no initial memberships; reject malformed/duplicate/excess values with COLLECTION_INPUT_INVALID. It is not a content-body field. Validate/capture it with the destination; retries preserve the exact canonical set. Bound assistant edits and normal edits do not use it, and they cannot transfer a root to another workspace. The same captured creation origin applies across creator templates, direct generation and the existing card-assistant/editor handoff.

Add `X-Workspace-Id` and `X-Initial-Collection-Ids` to credentialed CORS allowed headers alongside existing request/profile headers. Expose `ETag` where needed. API methods accept captured context as an argument; the singleton never stores a mutable active workspace. Refresh/retry preserves that argument. WebSocket session ID, workspace ID, and owner must agree on handshake, resume, and every admitted turn.

`GET /workspaces/capabilities` and `GET /workspaces` carry no workspace selector. They are the frontend's startup handshake: the R1 frontend sends no private content request, and no `X-Workspace-Id` header to any route, until the capability call returns a supported `contract_version` and the workspace list has resolved. A predecessor API therefore never receives the new header (its CORS rules would reject it). `WORKSPACE_REQUIRED` is never produced by a correct R1 client; a pre-R1 client receiving it treats it as "update required" (see document 08, Release compatibility and rollout UI).

Server-owned intents are read, new_work, finalize_admitted, control_admitted, and manage_workspace. End/cancel controls for an owned admitted operation and workspace management remain available when content is archived; the client cannot request an admission-bypass intent.

Private resource lookup combines user/application/workspace predicates. Return 404 for foreign or mismatched roots; do not reveal another owner's workspace. Archived content can be read, exported, or used as a copy source. Ordinary edits, creates, fresh AI attempts, and new session turns require an active workspace.

## Workspace and collection DTOs

Use strict models with unknown fields rejected. New IDs are lowercase UUID strings; existing card/resource IDs retain their current validators. Trim labels; name is 1–160 characters and description 0–2000. Duplicate names are allowed. Preferred use is `library | writing | roleplay | sandbox`, default `library`, and controls the landing page only.

`Workspace` has exactly `id, name, description, preferred_use, is_default, archived_at, row_version, created_at, updated_at`. `description` and `archived_at` are nullable. `row_version` starts at 1. `Collection` has exactly `id, workspace_id, name, description, position, card_count, row_version, created_at, updated_at`; position and card_count are nonnegative safe integers. card_count is a read-only aggregate of supported accessible same-workspace memberships, obtained in the scoped collection query rather than stored or supplied in writes. It does not change row_version. The folder browser displays that total independently of a current card-type filter.

| Method and path | Request | Result |
|---|---|---|
| `GET /workspaces/capabilities` | None; authenticated; no workspace selector | `{workspace_r1:true,contract_version:1,schema_revision:"2026_10_workspace_r1"}`; the frontend's handling of each result is in document 08 |
| `GET /workspaces` | `include_archived=false` | `{items: Workspace[], default_workspace_id}`; default first, then created_at/id |
| `POST /workspaces` | `{name, description?, preferred_use?}` | 201 Workspace |
| `GET /workspaces/{id}` | None | Workspace plus ETag |
| `PATCH /workspaces/{id}` | At least one mutable label/preference field | Updated Workspace |
| `POST /workspaces/{id}/archive` or `/restore` | Empty object | Updated Workspace |
| `GET /workspaces/{id}/collections` | None | `{items: Collection[]}` ordered position/created_at/id |
| `POST /workspaces/{id}/collections` | `{name, description?, position?}` | 201 Collection |
| `PATCH /workspaces/{id}/collections/{collection_id}` | Mutable collection fields | Updated Collection |
| `DELETE /workspaces/{id}/collections/{collection_id}` | None | 204; cards retained |
| `PUT /workspaces/{id}/collections/{collection_id}/members` | `{add: CardIdentity[], remove: CardIdentity[]}` | `{collection_id, added, removed, unchanged}` counts |
| `GET /workspaces/resolve-content` | `kind, id`; optional card_type | `{workspace_id, archived, kind, id}` after existing private ownership validation |

Workspace/collection PATCH, archive, restore, and collection DELETE require quoted integer `If-Match` and return ETag, matching the project's profile concurrency convention. A replayed lifecycle command with current ETag is a no-op if already in that state. Collection membership commands serialize with deletion and are set operations, so they do not need If-Match or an operation receipt.

A `CardIdentity` is exactly `{card_type, card_id}`, with the four persisted card types. Membership commands allow 1–200 total distinct identities, forbid overlap between add/remove, validate the entire input, then apply one transaction. Duplicate input identities are 422; an already existing membership or already absent membership is unchanged. A missing card/collection is 404 with no partial mutations. Membership does not increment a label's row_version.

Capability contract version 1 covers the current-root metadata and selector changes; activate it only with matching frontend/backend DTO fixtures. All new UUID, row-version/count/offset values exposed to TypeScript must satisfy its safe-integer/string contracts.

The resolve endpoint is a narrow owned lookup for legacy links and origin navigation, not an account-wide card list. Register resolve-content and capabilities before `/workspaces/{id}`.

## Lists and organization metadata

Add `GET /workspaces/{id}/cards` for mixed-type collection browsing. Parameters: optional `card_type`, `character_role`, `q`, `collection_id`, `uncollected=false`; `limit` defaults to 24 (1–100), `offset` defaults to 0 (0–100000). Collection and uncollected are mutually exclusive. Character role requires character type. Disabled feature types are excluded; an explicitly disabled type follows existing feature-disabled behavior.

The approved frontend is one Library entry, with compact collection folders and these cards composed in one grid/list. It retains the search control, existing card rendering and view preference. The root reads the owned collection list once, filters collection labels/descriptions locally for root search, and composes it with server-paged matching cards; it does not replace card search with folder navigation or add folder items to this cards-only response. Folders appear once, before card pages, and the first card starts a new grid row. All types includes character/persona, world, item and adventure; the Persona UI filter maps to character type plus the existing persona role. Existing type routes remain adapters/legacy compatibility, not separate required sidebar destinations. Document 08 specifies creation/return/search UX; the prototype's compact initial view and simulated results do not change these data contracts.

Return exactly `{items, total, limit, offset}`. Each item is `{card_type, card}`, where card is the existing per-kind read DTO plus organization metadata. Order by `creation_at DESC, card_id DESC`; counts and results share the same predicates. Use EXISTS for membership before paging. Offset paging is not a snapshot under concurrent inserts; refresh from offset zero after list-changing commands.

Existing per-kind list routes retain their current array/envelope shape and skip/limit conventions; add the same filters and workspace header. Pickers use the mixed endpoint when browsing multiple types and per-kind endpoints when their existing contract requires a single type.

Add a server-owned `organization` field to private current-root read DTOs:
- Card: `{workspace_id, collection_ids}`, with sorted current membership IDs.
- Story, session, lorebook, independent resource, assistant conversation, and media job: `{workspace_id}`.
- Account/global DTOs and portable/public card content: no organization field.

Keep generated-card HTTP results in their existing flat layout (`id`, card fields, `request_id`, `llm_execution`); add the card organization field and `organization_warnings`. Warnings are arrays of `{code, collection_id}` and are empty normally. Intentional updates to `cardContract`, backend response validators, assistant/media contracts, transforms, and shared types must recognize only these specified fields. Strip metadata before validating/storing generated bodies, versions, drafts, snapshots, exports, and model prompts.

Historical generated output snapshots keep their exact shape. A response decorator obtains origin and final organization from operation context. Operation replay returns the original applied memberships/warnings; ordinary card reads return current memberships. Reconciliation must not re-add a membership the user subsequently removed.

## Durable operation context

Add `tb_content_operation_context`, separate from upstream effective configuration. Key it by `(operation_kind, operation_id)`: `llm_execution` uses execution UUID; `image_job`, `theme_song_job`, and `tts_job` use job UUID. Include owner/application/workspace tuple, immutable requested collection IDs, terminal organization metadata, and timestamps. Do not store provider keys. Exact ownership FK and root definitions are in document 06. Copy to workspace is synchronous and does not use this table; its receipt carries its own destination (see Copy command).

Insert context in the same admission transaction as the local execution/job record, before provider or finalization work. Workspace admission and archive take the same workspace-row lock. New retained request fingerprints include workspace and sorted distinct destination collection IDs. Migration-derived historical context uses document 11's legacy branch: validate its default origin and empty initial-membership set, then retain the old fingerprint/payload; it cannot admit a fresh contextless execution. Existing account-wide execution request uniqueness stays unchanged; changing organization under the same identity returns a conflict, never a new destination.

Explicit user retries creating a new execution attempt inherit the original context and must pass the current active-workspace check. Resolve a retained identical operation before applying fresh-admission rules: completed replay remains available after archive. Already admitted execution finalization, provider callbacks, and read-only reconciliation may complete/read after archive using a verified admission capability tied to that exact record. A worker is not granted a general archived-workspace write bypass.

| State change after admission | Required outcome |
|---|---|
| Browser switches workspace | Persist into origin; suppress updates to the new active UI |
| Destination archived | Already admitted work and planned child stages complete; fresh user work/retries are rejected |
| Requested collection deleted | Complete card plus surviving memberships atomically; report `COLLECTION_REMOVED` for missing IDs |
| Target deleted before assistant/extraction finalization | Preserve existing CAS/deleted-target failure behavior and compensation; never recreate or attach to a replacement |
| Media target deleted | Finish retained job/assets into origin; do not recreate/attach to the deleted target |
| Generated result later deleted | Replay retained result with its deleted identity; never regenerate or recreate it |
| Retry changes workspace or collection set | 409 organization/idempotency conflict |
| Account-content wipe | Remove context/results through existing cleanup workflow; subsequent recovery is not found |

A requested collection is validated at admission, then stored as historical JSON rather than a live FK. Finalization locks surviving owned destination collections, inserts card plus valid memberships, and stores the final warnings in the same transaction. This exception concerns grouping only; source validation and content CAS remain strict. Membership loss does not change provider charging. Deleted-target failure retains the existing execution/media compensation policy.

Context covers card generation, story generation, extraction, all assistant kinds, text/voice conversation execution, image/theme-song/TTS work, and internal writer executions. Internal writers inherit their parent job's origin. Planned child stages of an already admitted job may be admitted using that parent's record-specific continuation capability after archive; this is not permission for a fresh user request or unrelated retry. Profile tests and root/system administrative executions remain account/application scoped and must be explicitly classified as such.

## Copy command

Copy to workspace is one synchronous, all-or-nothing database transaction. It either commits every destination row or creates nothing and returns an error. There is no pending, running, or failed copy state, no lease, no stored snapshot, no media pin, no status endpoint, no background worker, and no resume. After a failure the user simply runs Copy again.

`POST /workspaces/{destination_id}/copy-cards` accepts exactly `{request_id, source_workspace_id, cards, destination_collection_ids}`. Request ID uses the existing `[A-Za-z0-9._:-]{1,64}` convention. Every copy creates new cards; the UI can separately offer Open existing copies, and import deduplication stays destination-local.

R1 constants: 1–20 distinct cards, at most 20 distinct destination collections, 100 distinct attached lorebook states, 100 independent linked resources, and 8 MiB of copied card/lorebook/resource payload. Copy requests are limited to 64 KiB. These bounds keep the transaction short; they are not measured performance claims. Exceeding one returns 413 `COPY_LIMIT_EXCEEDED` and creates nothing; the client never truncates silently.

The transaction:

1. Validate the request shape and card/collection bounds before opening the transaction.
2. Lock the source and destination workspace rows in ID order. The destination must be active (else 409 `WORKSPACE_ARCHIVED`); the source may be archived.
3. Lock the requested destination collections (missing → 404 `COLLECTION_NOT_FOUND`) and read the source cards' published bodies, attached lorebooks/entries/attachments, independent resources/links, and referenced media asset rows with share locks in deterministic order. Any missing or foreign source → 404 `CONTENT_NOT_FOUND`. Check the dependency bounds → 413.
4. Insert destination cards, lorebooks, resources, links, attachments, memberships, media associations, and the copy receipt. Commit.

Any error at any step — validation, a lock wait timeout or deadlock, a constraint violation, a lost database connection — rolls the whole transaction back and returns that error. Nothing partial exists, so nothing needs cleanup or recovery. Same-owner copies reuse immutable media bytes and do no network or blob work. Cross-owner public/share import keeps its existing separate blob preparation/cleanup and is not this command.

The media share locks replace any pinning: a concurrent asset deletion either finishes first (the copy then fails at step 3 and creates nothing) or waits until the copy commits (the new cards then reference the asset, so the existing reference check refuses the deletion).

`tb_card_copy_receipt` exists only so a double submit or a lost response does not create a second copy. It is written inside the same transaction, keyed by `(user_id, project_hash, user_group_hash, request_id)`, and stores the intent hash and the result mapping. A failed copy writes no receipt, so retrying the same request ID after a failure simply runs the copy again.

| Situation | Response |
|---|---|
| First successful copy | 201 with the result |
| Same request ID and same intent after success | 200 with the stored result and `X-Idempotent-Replay`; nothing new is created, even if the copies were since deleted |
| Two identical requests at the same time | The second waits on the receipt key, then returns the first one's result (or runs normally if the first failed) |
| Same request ID with different cards, source, destination, or collections | 409 `COPY_REQUEST_CONFLICT` |
| Explicit Copy again | The client sends a new request ID |

Result: `{request_id, source_workspace_id, destination_workspace_id, cards:[{source:CardIdentity,destination:CardIdentity}], lorebooks:[{source_id,source_state_hash,destination_id}], resources:[{source_id,destination_id}]}`. Destination collections are validated inside the transaction, so a copy never returns organization warnings.

## Lifecycle, personas, media, and notifications

Create one protected default workspace per owner/application tuple through `tb_workspace_scope`. It is renameable but cannot be archived. This guarantees an active fallback and avoids races from name-based lazy creation. Nondefault workspace archive with an active voice call returns `WORKSPACE_ACTIVE_CALL`; user ends the call first. Restore does not move content or resume completed work.

Keep `is_default_persona` in the current published character body as the sole authority. Scope reads/clears to workspace and serialize all default-affecting creation/publish/restore/update paths with its workspace lock. At most one published persona is default per workspace. Existing drafts/versions retain their bytes; publishing/restoring a default flag reconciles through the same command. Copies always clear the default flag. A character's `default_persona_id` must refer to an owned persona in the same workspace; clear it if copying without that persona. Preserve historical snapshot flags as historical content.

Keep immutable media owned at its current account/application boundary. Add `tb_workspace_media` associations validated by asset type; TTS ownership comes through `tts_job`, since `tts_asset` has no user/scope columns. Generate/upload/copy/import and snapshot references register associations; detached generated/uploaded assets remain visible in their origin workspace even when their target is deleted.

`GET /workspaces/{id}/media` uses `media_kind=image|theme_song|tts` (default image), limit/offset bounds as above, and returns `{items,total,limit,offset}`. An item is exactly `{media_kind,asset_id,job_id,organization:{workspace_id},asset}`; job_id may be null and asset is the existing type-specific asset projection. Include distinct nondeleted associations, ordered association created_at/asset_id descending. Existing job history lists filter by durable job origin, which is separate from asset visibility after copying. Private bytes remain authorized by existing account/application ownership; media isolation is discovery/context isolation, not a second account security boundary.

Asset deletion remains account-wide and must refuse while any body, draft, version, activity snapshot, or receipt references it. A copy in progress holds share locks on the assets it reads (see Copy command); there are no copy pins. Archive removes no associations/bytes. Account-wide playlist playback may continue with an origin label. Removing a card changes its references without deleting another workspace's asset.

Notifications remain a mixed account/application inbox, including global billing notices. New generation notices persist `metadata.workspace_id` from context; display an origin label and resolve actions through the guarded switch coordinator. Legacy notices without origin resolve through an owned job or show an unavailable target; never default their action to the active workspace. Archived targets open read-only with Restore; missing targets show a retained status/unavailable message.

## Error contract

New workspace commands use existing FastAPI-style `{detail:{code,request_id?}}` JSON and no-store caching. Preserve existing domain error envelopes on existing routes; add named workspace codes without replacing unrelated errors.

| Status | Code / condition |
|---|---|
| 422 | `WORKSPACE_REQUIRED`, `WORKSPACE_SELECTOR_MISMATCH`, `WORKSPACE_INPUT_INVALID`, `COLLECTION_INPUT_INVALID` |
| 404 | `WORKSPACE_NOT_FOUND`, `COLLECTION_NOT_FOUND`, `CONTENT_NOT_FOUND` |
| 409 | `WORKSPACE_ARCHIVED`, `WORKSPACE_DEFAULT_PROTECTED`, `WORKSPACE_ACTIVE_CALL`, `WORKSPACE_VERSION_CONFLICT`, `COLLECTION_VERSION_CONFLICT`, `COPY_REQUEST_CONFLICT` |
| 428 | `WORKSPACE_VERSION_REQUIRED` / `COLLECTION_VERSION_REQUIRED` |
| 413 | `COPY_LIMIT_EXCEEDED` / `WORKSPACE_REQUEST_LIMIT_EXCEEDED` |
| 503 | `WORKSPACE_CAPABILITY_UNAVAILABLE` / recoverable persistence unavailability |

Preserve existing AI idempotency conflict codes when their fingerprint gains organization. Missing or malformed If-Match is 428 or 422 respectively. A copy that fails for a database reason (lock timeout, deadlock, lost connection) returns the existing 503 persistence-unavailable response and has created nothing. A foreign card or collection fails without returning its name or ownership.

## Implementation gate

These contracts close design choices; code, DTO fixtures, migrations and executable tests are present in the current source. Revalidate changed integration points and the residuals in document 04 before claiming release completion. Document 16 enumerates enforcement paths; document 13 defines verification. Production revision, row counts, copy transaction duration at the maximum bounds, query plans, backups, and quiescence are deployment preconditions, not missing domain choices.
