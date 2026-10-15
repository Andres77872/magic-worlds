# Database model and changes

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Schema and executable migration/resume tooling implemented; dated local migration evidence exists. Release environment acceptance is WIP.\
**Refreshed:** 2026-10-12.\
**Starting schema:** Exact `2026_10_image_profiles`, including unified assistants and current image-profile/job fields.\
**Planned target marker:** `2026_10_workspace_r1`; it is not present in the current application.

Use the canonical [schema](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql), [bootstrap](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py), and [image cutover](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/image_profile_cutover.py). Preserve the current InnoDB, utf8mb4/column-collation, timestamp, strict row-validation, and transaction-cleanup conventions.

## New structures

Workspace/collection/operation IDs are UUID strings stored as `char(36)` with the existing binary identity collation. References to existing cards/books/resources use their existing `varchar(64)` type/collation. Owner is existing `tb_user.user_id` plus AppScope project/group hashes.

| Table | Required persisted fields | Identity / constraints |
|---|---|---|
| `tb_workspace` | workspace_id, user_id, project_hash, user_group_hash, name, nullable description, preferred_use, nullable archived_at, row_version, created_at, updated_at | PK workspace_id; UNIQUE (workspace_id,user_id,project_hash,user_group_hash); owner FK; row_version >= 1 |
| `tb_workspace_scope` | user_id, project_hash, user_group_hash, default_workspace_id, created_at | PK owner/application tuple; owned-workspace composite FK; authoritative protected default pointer |
| `tb_collection` | collection_id, workspace_id, owner/application tuple, name, nullable description, position, row_version, created_at, updated_at | PK collection_id; UNIQUE collection/workspace/owner tuple; owned-workspace FK; position >= 0 |
| `tb_collection_card` | collection_id, card_id, card_type, workspace_id, owner/application tuple, created_at | PK (collection_id,card_id); composite FK to both collection and card including workspace/owner/type; cascade membership when either parent is deleted |
| `tb_content_operation_context` | operation_kind, operation_id, workspace_id, owner/application tuple, requested_collection_ids JSON, nullable terminal_organization JSON, created_at, updated_at | PK (operation_kind,operation_id); owned-workspace FK; kind-specific admission service verifies local execution/job identity |
| `tb_card_copy_receipt` | request_id, source_workspace_id, destination_workspace_id, owner/application tuple, intent_hash, result JSON, created_at | PK (user_id,project_hash,user_group_hash,request_id); owned source/destination workspace FKs; written only inside a committed copy transaction |
| `tb_workspace_media` | workspace_id, owner/application tuple, media_kind, asset_id, created_at | PK (workspace_id,media_kind,asset_id); owned-workspace FK; asset service validates typed owner scope, including TTS through job |

DTO `is_default` is derived from tb_workspace_scope; do not store a competing default flag. Create the default workspace and scope pointer atomically under a user-row initialization lock, with unique-tuple retry handling. A name is never the default identity. Accounts without an application scope in stored content initialize on their first authenticated workspace access; do not invent project/group hashes from tb_user.

Names need not be unique. Membership is relational organization, never a rewrite of category/triggers. Collection deletion cascades membership only. Workspace hard deletion is absent from R1; archival updates metadata and never cascades content.

The folder browser's Collection.card_count is a read-only aggregate in the scoped list/detail query, with supported-type visibility predicates and zero for empty collections. It is not a persisted counter column, a client write field, or a reason to advance the collection's label row_version. Obtain list counts with a grouped query/join rather than an N+1 list fetch per folder.

Operation kinds are `llm_execution, image_job, theme_song_job, tts_job`. Context validates owner/workspace and record identity at admission; polymorphic operation/media references do not gain a fictitious SQL FK. Prefer explicit typed repository methods over a generic client-driven table selector.

A copy receipt exists only for a committed copy; there is no pending, running, or failed copy row. It holds the stable SHA-256 intent hash and the result ID mapping in a strict versioned JSON schema. Retained source/destination IDs are historical references, not live-card FKs, so later deletion of a copy does not touch its receipt.

## Existing root and relationship changes

| Table | Change |
|---|---|
| `tb_card` | Required workspace_id and owned-workspace FK; add UNIQUE (card_id,card_type,user_id,project_hash,user_group_hash,workspace_id) for membership/target constraints |
| `lorebook`, `lorebook_resource` | Required workspace_id, owned-workspace FK, composite identity extended with workspace |
| `story_novel` | Required workspace_id and owned-workspace FK; retain source/snapshot schemas |
| `adventure_session` | Required workspace_id and owned-workspace FK for adventure, character, and character-group; voice sessions inherit this root |
| `assistant_conversation` | Required workspace_id and owned-workspace FK for card/lorebook/app, bound or unbound; strengthen bound target FKs with workspace |
| `image_job`, `theme_song_job`, `tts_job` | Required origin workspace_id with owned-workspace FK; admission/finalization must agree with companion context |
| `lorebook_resource_link` | Required workspace_id and matching book/resource composite FKs |
| `lorebook_attachment` | Required workspace_id and matching lorebook composite FK; validate each polymorphic live target at service boundary |

Keep existing exact owner/type FKs while extending their tuples where a live relationship requires same-workspace enforcement. Add compatible referenced UNIQUE tuples before replacing child FKs. Do not use a nonunique index as a new FK parent.

## Inherited children

Card bodies/drafts/versions inherit through tb_card. Story chapters/card refs/generations inherit through story_novel. Adventure messages, voice sessions/transcript segments, and persisted conversation turns inherit through adventure_session. Lorebook entries/embedded resources inherit through the book; assistant messages/turns inherit through their conversation.

Every child-ID repository query must join/validate the owning root. Inherited scope is not permission to use an unscoped child fetch. Preserve read-only reconciliation and exact selected-row contracts.

Snapshot source IDs, version provenance, story source descriptions, and card lineage may cross workspace boundaries historically. Keep them as historical content; live editable target resolution requires current workspace ownership. Move is deferred, so a root's workspace is immutable.

## Operations and admission locks

Companion context is created in the same transaction as the local operation record and is retained after target deletion. Do not put it into effective execution configuration or modify historical graph hashes.

Lock workspace rows before new content admission, default-persona commands, and archive. Cross-workspace copy is one transaction: it locks the owned source/destination workspace rows in ID order, share-locks the source rows and referenced asset rows it reads, inserts every destination row, and commits — or rolls back entirely (document 15). Finalization and planned child writer stages use a verified existing admission/parent continuation; they must not re-run the fresh user-work active-workspace check. User retry attempts still require an active workspace. End/cancel cleanup controls remain available on owned admitted operations.

Requested collection IDs are immutable historical JSON without collection FKs. Finalization locks surviving destination collections and atomically stores root, valid memberships, and terminal warnings. Collection deletion after admission produces a grouping warning rather than a paid-generation failure.

Copying stores no snapshot and pins no media. Within its transaction the share locks on asset rows make a concurrent deletion either finish first (the copy fails and creates nothing) or wait until the copy commits (the new cards then reference the asset and the existing reference check refuses deletion). Same-owner copying needs no new blob duplication. Existing cross-owner import staging remains outside the persistence transaction and retains cleanup handling.

## Defaults and media

Keep published `is_default_persona` as the single persona-default authority. Scope get/clear/set to workspace and serialize every default-affecting path with its workspace row. Validate character `default_persona_id` against a same-workspace persona. Draft/version JSON is unchanged by migration; future publish/restore commands reconcile defaults through the same repository policy.

Media bytes remain at current account/application scope. tb_workspace_media is a discovery association, not a second asset owner. Its image/theme-song owner is on the asset; TTS owner comes through tts_job because tts_asset has no user/scope columns. Existing asset downloads preserve current authorization.

Populate associations on generation/upload, imports/copies, and retained activity references. Origin association survives target deletion; copying adds destination association. Soft-deleted assets are excluded from gallery lists. Preserve all-workspace reference checks before asset deletion and clear association rows as part of physical/account cleanup.

Notification inbox stays account/application scoped. New job notices retain workspace_id in their existing metadata JSON; no workspace-only notification root is introduced. Profile, billing, credit, quota, voice-preset/consent, and user-language schemas retain their current roles.

## Required indexes

- Workspace list: owner/application + archived_at + created_at/workspace_id.
- Collection list: owner/application/workspace + position/created_at/collection_id.
- Card browse: owner/application/workspace + card_type + creation_at/card_id; use a second workload-appropriate index if mixed paging requires it.
- Membership reverse lookup: owner/application/workspace + card_id/card_type + collection_id; collection-to-card uses its key plus the same scope.
- Content root lists: actual owner/application/workspace predicates followed by current ordering and stable ID tie-breaker.
- Job history: owner/application/workspace + status/updated_at/job_id.
- Context lookup: owner/application/workspace + operation_kind/created_at/operation_id.
- Copy receipt: its primary key (owner/application + request_id) is the only lookup; request uniqueness is account/application-wide, so changing destination cannot evade it.
- Media browse: owner/application/workspace + media_kind/created_at/asset_id.

Final DDL must be verified against the deployed MySQL version and representative EXPLAIN plans. The new composite FK requirements follow [MySQL's compatible-column and key rules](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html). Index choices are requirements for implementation review, not measured performance results.

## Preservation and cleanup

Backfill roots/relationships/context without changing existing IDs, card JSON, versions/drafts, story/session snapshots, profile/job payer fields, execution payloads/hashes, or credit balances. Existing cross-workspace-independent media bytes and lineage remain intact.

Account wipe removes copy-receipt/context/media-association/membership records before affected roots, then workspace_scope before workspaces, following the current complete content-cleanup order. Quiesce/terminalize in-flight content work so late callbacks cannot recreate wiped content. Account/billing behavior stays as currently documented.

[Document 11](11_migration_and_rollout.md) fixes supported starting states and recovery. [Document 15](15_execution_contracts.md) defines exact operation/lifecycle behavior.
