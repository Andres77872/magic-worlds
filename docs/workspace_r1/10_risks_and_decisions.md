# Risks, selected decisions, and release gates

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Selected implementation choices are in source with dated local tests; residual integrity and deployment risks remain WIP in 02/04.\
**Refreshed:** 2026-10-12.

Severity expresses consequences if R1 guarantees are missed, not evidence that the current single-library app has a workspace vulnerability.

## Risk register

| ID | Severity | Failure mode | Required release evidence |
|---|---|---|---|
| R01 | High | Lists are scoped but direct child writes/context reads cross workspace | Inventory completion, repository predicates, direct-ID/owner/application negative tests |
| R02 | High | Delayed save/generation reaches a newly selected workspace | Captured origin, workspace epochs, mutation/stream/switch race tests |
| R03 | High | Retry changes destination or creates a duplicate batch | Durable companion context and success-only copy receipt; changed-intent and concurrent replay tests |
| R04 | High | Global lorebook context crosses workspace | Scoped attachment/activation queries and context tests |
| R05 | High | Persona default clears another workspace or retains a foreign live pointer | Scoped flag command and publish/restore/copy reference tests |
| R06 | High | Backfill changes content/snapshots/profile or accounting records | Supported baseline, fingerprints/counts, exact resume verification |
| R07 | High | API/schema versions cannot start together | Exact image-profile-to-workspace cutover tests |
| R08 | High | Shared bytes disappear while referenced elsewhere or while a copy reads them | Account-wide reference checks; asset share locks inside the copy transaction |
| R09 | High | Assistant late final changes a new form/history | Bound/unbound/app root tests and retained CAS behavior |
| R10 | High | Copy leaves live resource links, merges different attachment states, or leaves a partial copy behind | Field policy, state-keyed maps, resource/hash tests; injected-failure tests prove full rollback |
| R11 | Medium | Library/folder/picker results vanish after the first page or search hides content ambiguously | Mixed endpoint, scoped search, aggregate folder counts, filters-before-limit, complete browsing and explicit no-match recovery |
| R12 | Medium | Strict DTOs reject metadata or transforms silently remove it | Explicit organization fixtures and content-only storage/export assertions |
| R13 | High | Back/Forward bypasses save/discard or commits obsolete navigation | Indexed/unindexed history and queued-switch tests |
| R14 | High | Archive fails paid work or allows fresh provider work | Admission/finalization separation, deleted-group warning and accounting tests |
| R15 | Medium | Folder presentation implies moves/deletion or silently changes Codex/AI activation | Explicit membership labels, collection deletion retains cards, explicit picker selection and unchanged context tests |
| R16 | High | Empty/concurrent account initialization creates no usable fallback | Protected default pointer, unique-scope initialization tests |
| R17 | High | Workspace-scoping changes global call admission/quotas | One-live-call/supersede preserved across workspaces; switch/end/archive tests |
| R18 | Medium | Notification/task action opens an unrelated active-workspace view | Durable origin and archived/deleted-target action tests |
| R19 | High | Account wipe is followed by late work recreating content | Quiescence/context cleanup and worker finalization tests; a copy racing the wipe either commits before it or fails |
| R20 | High | A frontend build and an API build that disagree meet during rollout (old tab on the new API, new build on a stopped or old API, the new header hitting old CORS) | Startup handshake, flag-gated UI state, compatibility release and deploy-order tests (A27) |

## Selected R1 decisions

| Concern | Decision | Authoritative detail |
|---|---|---|
| Ownership | Personal owner within existing AppScope; one home workspace per content root | 05, 06, 15 |
| Activity scope | Cards, lorebooks/resources, stories, all session kinds/voice history, unified assistants | 01, 16 |
| Collections | Flat mixed types, many memberships, organization only | 15 |
| Library navigation | One sidebar Library entry; folders and unchanged cards together; visible search and local type/role filters; existing creators/assistant from New | 08, 15 |
| Reuse | Independent private copies of published content; one all-or-nothing transaction, no pending state or resume | 09, 15 |
| Default workspace | Renameable protected default pointer per owner/application tuple | 06, 15 |
| Default persona | Existing published flag, scoped and serialized; no second preference pointer | 06, 15 |
| Operation storage | tb_content_operation_context for asynchronous work; success-only tb_card_copy_receipt for copies | 06, 15 |
| Source materials | Clone linked independent resources and embedded snapshots; preserve valid hashes/provenance | 09 |
| Media | Current account/application ownership plus typed-validated workspace associations | 06, 15 |
| Bounds | 20 cards / 100 book states / 100 resources / 8 MiB copied payload; no silent truncation | 15 |
| Contract metadata | Private read/result organization fields; historical/generated content unchanged | 15 |
| URLs | Existing hashes plus workspace query; guarded indexed/unindexed history; owned legacy resolution | 08, 15 |
| Archive | Read-only; admitted work finishes; removed grouping yields warnings; fresh attempts rejected | 15 |
| Calls | End before committed switch; active call blocks archive; account single-call/quota behavior retained | 08, 15 |
| Notifications/audio | Mixed account inbox and playlist; origin labels and guarded content links | 08, 15 |
| Deployment | Coordinated exact-schema cutover from 2026_10_image_profiles | 11 |
| Frontend rollout | One R1 build that always sends workspace-scoped requests; `VITE_FEATURE_WORKSPACES_ENABLED` gates UI only; startup handshake before any private request; compatibility release for stale tabs; stop API → deploy frontend → migrate → start API → enable flag | 08, 11 |

These selections resolve the previous design alternatives. They are recorded to make implementation actionable and do not claim that code, a migration, or runtime verification exists.

The user's 2026-10-12 approval of the revised library prototype fixes the earlier unspecified sidebar and creation-entry layout. The existing screenshot/first explanatory prototype is not a selected design. Preserve actual GalleryCard/GalleryPage appearance and existing creation/assistant flows when implementing the unified browser. Approval covers the browser/entry flow, not the prototype's simulated persistence or abbreviated editor fields.

## Remaining evidence, not open domain decisions

Deployed revision/MySQL version, exact DDL/DTO fixtures, representative volumes/query plans, copy transaction duration, blob backups, drain/resume behavior, and preservation checks must be gathered during implementation/release preparation. Initial batch bounds may be reduced after measurement; raising them requires the corresponding performance/transaction tests.

Permanent deletion, collaboration, shared editable cards, nested/smart collections, moves, and bundle export remain deferred. They are not hidden requirements for completing personal R1.

## Release gates

Do not activate workspace UI until R01–R20 and the selected acceptance matrix A01–A27 are covered. Include the approved library/search/creator/assistant scenarios; a frontend flag cannot compensate for account-wide API fallback or an incompatible schema.

Keep implementation status in document 12. A checkbox for a design decision means the specification is complete, not that its risk has passed testing. New findings require updates to contracts, inventory, tests, and the affected decision rather than silently choosing a second behavior.
