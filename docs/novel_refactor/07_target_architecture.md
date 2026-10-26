# Target architecture and editor-stack approach

**Documentation review:** 2026-10-14. **Status:** WIP / planned architecture — proposed entities, adapters, and contracts are not implemented APIs. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

## Recommended decisions

These decisions describe the target architecture; [14](14_status_and_roadmap.md) distinguishes implemented foundations from planned extensions. Remaining schema work must preserve recovered non-novel content and current novels under [15](15_database_migration_and_legacy_cleanup.md). Whole-database resets are disabled.

1. Keep React contexts, routing, Reverie primitives, workspace ownership, and the BFF/API boundary.
2. Keep TipTap and isolate it behind a manuscript adapter.
3. Use a versioned structured scene document as the authority for single-writer editing; derive Markdown/plain text/statistics from its revision.
4. Add independent metadata, structure, and document revisions rather than invalidating every edit through one whole-novel version.
5. Route inline AI and conversational edits through one proposal/review/commit pipeline.
6. Reuse unified assistant conversations with a new, explicitly scoped novel contract.
7. Use serialized saves, revision checks, and explicit recovery when the author's own tabs/devices disagree. Multi-user collaboration and CRDT synchronization are out of scope.

## Reuse and overlap decisions

**Source review: 2026-10-16.** The frontend, BFF and adjacent assistant plan already cover substantial infrastructure. The decisions below distinguish working foundations from extensions and new domain behavior. Source presence does not establish that the expanded novel flow is implemented. BFF links point to the sibling `magic-worlds-api` checkout.

| Area / existing source | Reuse decision and remaining work |
|---|---|
| Workspace and gallery: [NovelGalleryPage](../../src/features/novel/components/NovelGalleryPage.tsx), [useStoryWorkspace](../../src/features/novel/hooks/useStoryWorkspace.ts) | Keep shared gallery hooks/components, workspace origin, ownership and archived read-only behavior. Extend summaries, scene routes and lifecycle operations through those boundaries; no second gallery framework or workspace provider |
| Codex: [shared picker](../../src/features/codex/index.ts), [shared utilities](../../src/features/codex/utils/codexUtils.ts), [novel wrapper](../../src/features/novel/utils/codexUtils.ts) | The studio already uses the shared picker. Extend existing story-local refs/pins for novel/chapter/scene scope. Consolidate the two duplicated helpers described below; keep novel-specific trigger fallback and reference behavior |
| Goals: [useWordGoal](../../src/features/novel/hooks/useWordGoal.ts) | Per-chapter goals already save/clear on the server. Retain that behavior and remove obsolete browser-key migration under CL-07. Novel/session statistics and inherited scene allocation are additional work, not a replacement goal service |
| Assistant UI/transport: [useAssistant](../../src/features/creation/common/components/assistant/useAssistant.ts), [assistant model](../../src/features/creation/common/components/assistant/assistantModel.ts), [strict verifier](../../src/infrastructure/api/assistantContract.ts) | Extend kinds, bindings and result shapes; reuse conversation/message/composer, request ownership, stop/retry and reconciliation. The current [AssistantShell](../../src/features/creation/common/components/assistant/AssistantShell.tsx) is a floating draggable panel: compose shared contents in the docked inspector rather than cloning chat or assuming that container fits. Current applied-target callbacks need explicit Ask/proposal semantics |
| LLM execution: BFF [story execution](../../../../PycharmProjects/magic-worlds-api/src/services/story_execution.py), [admission](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py), [workflow execution](../../../../PycharmProjects/magic-worlds-api/src/services/llm_workflow_execution.py) | Reuse published profiles, frozen plans, request IDs, reservations, leases, billing, streaming and result recovery. Exact custom instructions already enter the persisted frozen payload. Extend safe history projection and revision/application lineage; do not introduce another provider client, paid-request ledger or full-prompt archive |
| Background jobs: [BackgroundTasksProvider](../../src/app/providers/BackgroundTasksProvider.tsx), [task DTOs](../../src/shared/types/task.types.ts), BFF [resource tasks](../../../../PycharmProjects/magic-worlds-api/src/services/resource_tasks.py) | Extend operation/target/result unions, SQL checks, listing and result navigation for novel jobs. Current resource operations and result URLs are narrow. Reuse the shared task drawer/history; durable multi-step manuscript execution/checkpoints still require new domain behavior. Editorial notes/tasks are manuscript annotations, not background jobs |
| Research/context: BFF [resources](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_resources.py), [extraction execution](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_extraction_execution.py), [activation](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py) | Reuse authorized resource access, source pins, extraction execution and content-hash invalidation patterns. Keyword activation and resource summaries do not supply revision-dependent manuscript memory, temporal canon, spoiler scope or enforced model budgets; those remain novel context work. Keep resource/lorebook availability independent from ordinary novel writing |
| Import/export/media: BFF [PDF import](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_pdf.py), [card export](../../../../PycharmProjects/magic-worlds-api/src/routes/card_exports.py), existing image/TTS services | Reuse bounded PDF-to-Markdown ingestion where applicable, owned assets, authenticated downloads and provider integrations. Card export renders PNG; the manuscript PDF reuses its configured Chromium to print a print-styled HTML document. Novel structure import (Markdown, text, Word), DOCX/EPUB/PDF production and frozen export manifests run locally (D5 slices 1–8); EPUB/ODT/RTF import, manuscript audio segmentation and novel asset ownership/bindings still need implementation |
| Versions and receipts: BFF [current schema](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/db.sql) | Card versions/source pins provide patterns; card-only operation/copy receipts do not store scene revisions or arbitrary manuscript saves. Add document/structure history and atomic manual-write/changeset receipts once. Link paid generations to existing execution identities; a manual save does not need LLM admission |
| Browser persistence: [workspaceStorage](../../src/shared/workspaceStorage.ts), [useChapterDraft](../../src/features/novel/hooks/useSceneDraft.ts) | Reuse API-origin/account/workspace key scoping. Durable document checkpoints, revision reconciliation and quota/recovery handling are missing and remain D1 work; preferences and legacy goal keys are not a draft journal |

**Confirmed duplicate code:** `lorebookEntrySnapshot` has the same implementation in the shared and novel `codexUtils.ts`; `clonedEntryIds` repeats the same behavior with a different loop. CL-09 should re-export these from the shared module, following the wrapper's existing re-export pattern. Keep `lorebookEntryFromSnapshot`, which adds the novel's fallback trigger keys. This review records the cleanup; it does not change source files.

**Overlap with the main assistant plan:** [assistant improvement](../assistant_improvement/README.md#scope-and-authority) owns general-assistant discovery and card/lorebook tool reuse; this dossier owns manuscript writes and multi-document writing changesets. Its [canonical tool/effect contracts](../assistant_improvement/04_architecture_and_reuse.md) and [run/step/action receipts](../assistant_improvement/07_execution_persistence_and_recovery.md) are proposed work, not an implemented shared registry or durable planner. Coordinate shared tool specifications, effect categories, request/step identities and caller-owned transaction patterns when first needed, so both plans extend one foundation. Keep novel proposal review and atomic manuscript application in the story domain. General-assistant novel reads do not deliver the novel assistant, and app-only toolset switches do not control it.

D1/D2 remain independent of the expanded general-assistant controller. Reuse working primitives now; extract shared pieces in the slice that first needs them. Do not duplicate another dossier's backlog or make its complete delivery a prerequisite for saving prose. Workspace, profile and credential findings retain their existing owners in [13](13_sources_and_open_decisions.md#local-evidence-inventory).

## Components and responsibilities

The diagram describes the target. In the 2026-10-14 baseline, `NovelStudio` → `useChapterDraft` / `DataProvider` → scoped `apiService` → BFF `StoryModel` lacked manuscript checkpoints, structure revisions and draft recovery. The current D1/D2 scene, organization/history and journal foundation supersedes that baseline; [14](14_status_and_roadmap.md) and [01](01_current_state_and_evidence.md) record its evidence. As of 2026-10-18 the bound assistant (D3), outline changesets with one undo (D4) and the import/export compilers (D5) run; grouped multi-scene prose changesets and one shared context compiler for inline AI and the assistant remain.

~~~mermaid
flowchart LR
  UI[Write / Plan / Review] --> Domain[Novel workspace state]
  UI --> Adapter[Manuscript adapter]
  Adapter --> Editor[TipTap scene editor]
  Adapter --> Local[Local draft checkpoints]
  Domain --> API[Workspace-scoped apiService]
  API --> BFF[magic-worlds-api]
  BFF --> Docs[Document / revision / structure services]
  BFF --> Context[Context and derived-memory service]
  BFF --> Assistant[Novel assistant and changeset service]
  Docs --> DB[MySQL and owned artifacts]
  Assistant --> Profiles[Published profile / admission / execution]
  Profiles --> Agents[api.magic_llm]
  Context --> Retrieval[Authorized retrieval index]
  Docs --> Compiler[Import / export compiler]
~~~

The proposed assistant receives server-validated tools and context. The frontend continues through the BFF and receives no platform provider key. Personal BYOK input uses the browser/BFF's transient input handling, but the current BFF materializes that key in the outbound agent graph; end-to-end custody remains open under the [LLM status](../llm_profiles/16_current_status_and_roadmap.md) and [security findings](../security/README.md). Expanded novel execution must close and verify that path rather than assume the current profile boundary prevents persistence.

## Proposed domain model

| Entity | Key responsibilities |
|---|---|
| Novel | Workspace/owner, metadata revision, defaults, selected draft, series binding |
| Part / Chapter | Stable ID, hierarchy, order, title/synopsis, grouping metadata |
| Scene | Stable ID, document binding, POV/setting/time, status, inclusion, goals |
| StructureRevision | Ordered parent/child relationships, actor, operation and restore lineage |
| ManuscriptDocument | Scene ID, schema version, current document revision/hash, structured body |
| DocumentRevision | Immutable checkpoint/body, parent revision, actor/source, changeset link |
| Annotation | Comment/beat/highlight, revision-bound anchor, author, state and remap/orphan information |
| CodexEntry / Fact | Story-local source pins, aliases, author-approved content and temporal scope |
| DerivedMemory | Summary/index/fact suggestion with dependency revisions, status and verification |
| AssistantConversation | Novel binding, scope, version and request lifecycle |
| ChangeSet | Proposed operations, base revision vector, dependencies, approval/application status |
| GenerationRecord | Exact instruction, authorized context manifest, profile/graph revisions, output and lineage |
| StashEntry | Novel ownership, optional scene association, reusable text/note, source label and available passage/revision or generation lineage |
| ExportJob | Frozen revision manifest, format/options, progress, artifact and warnings |

Names illustrate domain boundaries, not a requirement for one new table or service per row. Extend `story_novel`, `story_chapter` and `story_card_ref` where their responsibilities remain. `AssistantConversation` extends the unified assistant tables; `GenerationRecord` extends `story_generation` and references the existing LLM execution plan. `ExportJob` adds a novel manifest/artifact linked to shared task tracking. Document/structure revisions, changesets, reusable stash and manuscript receipts are distinct responsibilities. Preserve all installed content during extensions and use isolated synthetic databases for tests. The earlier project reset/discard policy is superseded by [15](15_database_migration_and_legacy_cleanup.md).

Named manuscript captures reuse the immutable `story_structure_revision` log.
Their manifests freeze novel/unit metadata, lifecycle/order, settings and Codex
snapshots while referencing existing scene checkpoint revisions/hashes. Capture
advances the event head and preserves undo/redo heads and restoration lineage;
it does not duplicate prose or consume an organization undo step. Owned result
receipts share the existing manuscript journal. No additional table/schema is
needed for capture/read/compare. Whole-manuscript restore and portable delivery
remain separate reviewed operations, not implied by capture.

The [storage blueprint in 15](15_database_migration_and_legacy_cleanup.md#required-storage-changes-by-phase) defines the target schema and current preservation rules. Future extensions must use scoped changes that retain installed data. Heads/checkpoints must agree atomically, with independent metadata/structure preconditions and scoped write/application receipts. A bridge to the discarded pre-refactor chapter-body format is unnecessary; current scene identities/checkpoints and unrelated content must be retained.

R11/A11 require reusable stash entries rather than treating the current generation `stashed` status as a complete snippet store. Manual clippings/ideas and generated alternatives share a browser but retain their source and review state. Insertion creates a separate manuscript operation without deleting the entry. This is a proposed domain responsibility, not an existing table or endpoint; define retention/export behavior with the novel's revision and portability contracts.

## Canonical document format

TipTap recommends JSON for persisted editor state, and its Markdown documentation identifies representational limits. [Persistence](https://tiptap.dev/docs/editor/core-concepts/persistence), [Markdown](https://tiptap.dev/docs/editor/markdown)

Recommended envelope:

~~~json
{
  "document_id": "doc-id",
  "scene_id": "scene-id",
  "schema_version": 2,
  "revision": 42,
  "content_hash": "sha256-of-canonical-document",
  "content": { "type": "doc", "content": [] }
}
~~~

The server allowlists node/mark types and attributes, enforces limits, validates references, and normalizes canonical hashing. Stable IDs are assigned to meaningful blocks and reference nodes, with explicit split/merge/paste rules. TipTap's UniqueID extension supplies a relevant mechanism but does not define this app's lineage policy. [UniqueID](https://tiptap.dev/docs/editor/extensions/functionality/uniqueid)

Derived representations include prose-only text for counts/search, Markdown for interchange/model context, sanitized renderable output, and export artifacts. Store their source revision. None is independently editable beside the canonical document without an explicit synchronized source-view operation.

Prefer the target structured schema directly for this development refactor. Do not add a Markdown sidecar or dual-authority bridge solely to preserve disposable test data. Markdown interchange remains useful; any future author import must state supported content and conversion losses.

## Editor adapter

The adapter owns document load/serialization, current revision, selection and cursor anchors, commands, proposal decorations, undo/redo, local checkpoints, and events. Feature components consume domain events instead of reaching into arbitrary TipTap storage.

Recommended events include documentChanged, selectionChanged, localCheckpointed, saveAcknowledged, proposalUpdated, and conflictDetected. A save acknowledgement identifies the exact local snapshot it saved. UI subscriptions select small state slices; heavy serialization/statistics do not drive the whole studio render.

Keep one active scene editor for ordinary writing. Continuous reading can use inexpensive rendered scenes; expanded editing is bounded and measured. Cache statistics and search/index work by revision. TipTap's React performance guidance supports component isolation and selective state subscription. [Performance](https://tiptap.dev/docs/guides/performance)

## Implemented saved statistics

`story_scene_statistics` is a derived cache of canonical plain-text counts keyed
by saved scene revision/hash. `story_novel_statistics` is a small, validated
aggregate bound to the root structure revision. The existing root lock owns
both cache updates and source mutations. Aggregate refresh reads numeric scene
counters and lifecycle metadata with ordinary consistent SELECTs, then writes
only its owned cache; it neither takes source range locks through
INSERT/SELECT nor reloads unrelated prose. Copies retain fresh identity checks.
Named captures can advance the aggregate head without recounting documents.

The `icu-word-en-v1` policy counts word-like segments of literal canonical plain
text with a fixed `en` locale. The backend uses the native ICU
[word iterator](https://raw.githubusercontent.com/unicode-org/icu/main/icu4c/source/common/unicode/ubrk.h);
the browser uses fixed-English `Intl.Segmenter`. Matching Unicode fixtures are
verified, without promising identical dictionaries across future ICU releases.
Local backend runtime needs the ICU shared library for word totals; Docker
installs `libicu-dev`. Missing/failing native segmentation yields null words,
not a failed save or a whitespace approximation. Code-point and UTF-8 counts
remain available. Markdown preview counting stays a separate projection.

Root statistics separate active/archive/Trash sections, with ancestor Trash
precedence; root lifecycle does not hide retained totals. A stale/incomplete/
invalid cache is null, including nullable legacy summary count fields. It is
excluded by size predicates and sorts last for either word direction. Cache
merges require matching source vectors; a late read or exact replay cannot
attach stale totals to later prose. Derived counts never enter author writes
or immutable manuscript manifests. Whole-novel goals and the writing log are
described in the [D5 slice 7 checkpoint](14_status_and_roadmap.md#d5-slice-7--goals-deadline-and-writing-log-n12-u07-u08-2026-10-17):
each saved scene edit adds its word change to 15-minute UTC buckets in the
same transaction, and reads group them into local days.

## Implemented saved manuscript search

The BFF owns literal saved-prose matching and exact native locations. A short
read transaction builds a metadata-only ordered source vector and queries
canonical `plain_text` without hydrating every document, pin or generation.
Native MySQL ICU supplies actual source quotes, codepoint positions and UTF-16
offsets. Bounded keyset pages bind both normalized options and the whole-source
snapshot. No search persistence, schema extension, model or provider is added.

The resolve endpoint validates the same owned source and one exact native match,
then returns an explicitly labelled **document projection**. Missing pins/history
are never represented as empty collections. Studio keeps search document projections separate from canonical writer seeds.
A compatible index verifies the location; an obsolete index is refreshed and the
same search source is revalidated. Navigation uses the guarded scene loader.
Whole-product resource and author/device acceptance remain later gates.

The editor maps canonical source offsets to view decorations and a collapsed
caret after exact-document verification. Partial mentions expand only the
visual decoration. Doc changes clear it; new input/selection/document/target
cancels pending post-layout scrolling. Intrinsic prose height and a theme-owned
scroll tail make the final scene passage visible. Browser hints, search
highlights and drawer state never enter the canonical document or AI packet.
See [current evidence](01_current_state_and_evidence.md#d2-manuscript-search-evidence--2026-10-16).

## Proposed API shape

All routes below are illustrative future endpoints under the existing story domain.

| Operation | Contract requirement |
|---|---|
| List novels | Small summaries/cached statistics; paginated; no entire generation histories |
| Get structure | Ordered parts/chapters/scenes and structure revision; no full bodies required |
| Read scene document | Schema version, canonical body, revision/hash and access/lifecycle state |
| Save scene document | Expected revision, request ID, validated body; exact acknowledged revision |
| Structure operation | Expected structure revision, ordered semantic operation, atomic validation |
| List/restore revisions | Pagination, diff/copy/restore; restore creates a new revision |
| Archive/trash/restore | Resource scope, retention/lifecycle state, dependency handling |
| Preview AI context | Scope/anchors and source revision manifest; same compiler as execution |
| Generate/propose | Request ID, base document/vector, limits/profile; durable proposal/result |
| Commit changeset | Approved operation/variant digest, selected dependency-safe operations, expected revisions |
| Read job/request result | Reconciliation without duplicate generation or application |
| Import/export | Preview/commit separation, version manifest, warnings and owned artifact |

Prefer a per-document monotonically increasing revision or a strong ETag, not timestamps alone. A response must state whether it created a new revision or replayed an earlier idempotent request. Conflicts expose permitted current revision information and preserve the local draft.

Replace obsolete entry points and frontend callers together using [15's API/code plan](15_database_migration_and_legacy_cleanup.md#api-and-code-replacement). Remove the old body and status-only-accept writers; no legacy Markdown reader or old-client rollout is required. Current endpoints still validate expected revisions and lifecycle independently of frontend flags.

For rich text, avoid persisting opaque ProseMirror steps as the only portable domain contract. Python BFF validation and exact document transformation require a spike: test semantic operations versus author-approved final JSON snapshots with expected revisions. If a shared conversion runtime is necessary, make it a measured dependency decision; this research does not add a Node microservice by assumption.

## Assistant integration

Extend the existing assistant kind/target contracts and profile feature catalog intentionally. Conversation target metadata should bind novel ID and workspace, while an operation carries explicit scene/document targets and a revision vector. Existing single-target CAS is reusable as a pattern, not sufficient for an arbitrary multi-scene commit.

This includes all three stored assistant kind enums and their message/terminal/result checks, not only frontend/Python unions. Existing non-app snapshots describe a single applied tool action; novel Ask and unapplied proposals require separately validated shapes without weakening old kinds. Reuse existing LLM execution admission/recovery and define manuscript commit receipts separately from the card-only `tb_operation_receipt`.

The read/query tools run against authorized novel data. Mutation tools produce proposals. The user-facing application service commits validated selected results through the same document/structure services used for manual editing. Detailed tools and context are in [08](08_ai_assistant_context_and_tools.md).

## Editor-stack alternatives

| Option | Benefit | Cost/decision |
|---|---|---|
| Retain TipTap core and refactor custom AI lifecycle | Preserves installed stack, domain extensions and tests | Own proposal/history/anchor implementation; recommended baseline |
| TipTap client AI Toolkit / Tracked Changes | Existing document tools and review abstractions | Validate licensing, maturity, custom nodes, BFF fit, and single-author AI review/undo behavior in a spike. Collaboration is not an adoption requirement. [Toolkit](https://tiptap.dev/docs/ai/ai-toolkit/client/overview), [Tracked Changes](https://tiptap.dev/docs/tracked-changes/getting-started/overview) |
| Switch to BlockNote | Integrated block interactions and AI UX reference | Migrate schema, extensions, selection, design-system composition and tests; prototype only if block work becomes a demonstrated priority. [BlockNote AI](https://www.blocknotejs.org/docs/features/ai) |
| Build around steven-tey/novel | Useful editor demo/composition reference | Does not solve domain storage or novel management; no wholesale component-stack replacement. [Repository](https://github.com/steven-tey/novel) |

No paid add-on is selected by this dossier. Compatibility with current TipTap 3.26.x, required React version, service boundaries, and licenses must be established on real fixtures.

## Single-author document authority

The versioned structured document remains authoritative for each scene; Markdown and rendered output are derived representations. The author can have multiple tabs or devices, so the BFF still rejects stale writes and the UI retains conflicting drafts for comparison, a reviewed merge, or copying into a new revision. This does not require a shared editing protocol. [TipTap output formats](https://tiptap.dev/docs/guides/output-json-html)

Keep metadata/structure transactions, workspace ownership checks, accepted changesets and durable checkpoints in BFF-owned domain storage. Preserve local undo and revision-bound AI proposals. No presence service, coeditor roles, shared sessions, or CRDT persistence is proposed.

## Studio index and selected-scene read boundary

[ADR 18](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#studio-index-document-seeds-and-bounded-history) separates organization metadata
from complete loaded scenes. The installed BFF index never reads scene document
JSON/plain text or generation output. Per-scene statistics bind exact revision,
hash and policy; absent/stale counters remain null. Complete root Codex snapshots
remain explicit, so the index still grows with unit metadata and references.

The selected-scene reader validates all independent root/ancestor/scene heads
within one owned read snapshot and returns one complete scene. Existing scene
GET uses this reader without guarded index preconditions and keeps its established
shape. Frontend types distinguish the index from editable `Story`; a transport
response cannot silently supply empty unloaded prose/history. Studio
opening/switching now uses schema-2 scene-document seeds and a three-scene /
16 MiB confirmed-read cache. Library state contains summaries; the active outline
contains no prose. Generation history and copy/organization previews use bounded
summary/excerpt pages with explicit full detail. Copy, search/bookmark and receipt/
snapshot recovery retain their separate sources and draft/review barriers.
See the current loading checkpoint in [14](14_status_and_roadmap.md#d2-studio-loading-and-bounded-history--2026-10-16).


## Author formatting and view-only invisibles

Highlighting uses the same canonical mark validation/projection path in the SPA
and BFF. Reader rendering uses semantic `<mark>`; the fixed ember treatment comes
from existing Reverie tokens. Markdown parsing handles the allowlisted wrapper
without losing escaped characters or nested marks. No parallel rich-body store,
new column, raw CSS attribute or profile is introduced.

Invisible-character controls reuse the scoped device-preference hook under a
separate `:invisibles` key. The real editor keeps its instance and selection while
metadata-only transactions paint a bounded visible window. Coalesced scroll,
resize/reflow and composition-end handling retire with the editor. Decorations
skip atom interiors and emoji joiners; DOM text, clipboard/model serialization,
word counts and AI context retain the original characters. See [16](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#author-highlights-and-invisible-character-display).
