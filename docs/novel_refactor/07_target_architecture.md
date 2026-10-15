# Target architecture and editor-stack approach

**Documentation review:** 2026-10-14. **Status:** WIP / planned architecture — proposed entities, adapters, and contracts are not implemented APIs. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

## Recommended decisions

These are proposed decisions, not implemented APIs or an approved migration.

1. Keep React contexts, routing, Reverie primitives, workspace ownership, and the BFF/API boundary.
2. Keep TipTap and isolate it behind a manuscript adapter.
3. Use a versioned structured scene document as the authority for single-writer editing; derive Markdown/plain text/statistics from its revision.
4. Add independent metadata, structure, and document revisions rather than invalidating every edit through one whole-novel version.
5. Route inline AI and conversational edits through one proposal/review/commit pipeline.
6. Reuse unified assistant conversations with a new, explicitly scoped novel contract.
7. Use serialized saves, revision checks, and explicit recovery when the author's own tabs/devices disagree. Multi-user collaboration and CRDT synchronization are out of scope.

## Components and responsibilities

The diagram describes the target. Today's flow is `NovelStudio` → `useChapterDraft` / `DataProvider` → workspace-scoped `apiService` → BFF `StoryModel` and `story_execution` / `story_generation`. There is no manuscript-document revision service, structure revision contract, local checkpoint store, novel changeset service, or novel import/export compiler in that flow. Existing generation execution/reconciliation and card-version snapshots are useful foundations; neither provides manuscript revision history. See [01](01_current_state_and_evidence.md) for actual source paths.

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

The assistant receives server-validated tools and context. The frontend never receives provider credentials for direct vendor calls as a consequence of this refactor. Existing BYOK transport remains transient and uses the established profile execution boundary.

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
| ExportJob | Frozen revision manifest, format/options, progress, artifact and warnings |

Names illustrate domain boundaries. Adapt actual tables and DTO conventions during implementation. Keep raw legacy Markdown and source lineage during conversion.

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

An interim Markdown-plus-sidecar design can reduce initial migration scope. It must still preserve stable mention IDs and anchor metadata and document how edits update those sidecars. It does not remove the mapping problem; prove the round-trip corpus before selecting it.

## Editor adapter

The adapter owns document load/serialization, current revision, selection and cursor anchors, commands, proposal decorations, undo/redo, local checkpoints, and events. Feature components consume domain events instead of reaching into arbitrary TipTap storage.

Recommended events include documentChanged, selectionChanged, localCheckpointed, saveAcknowledged, proposalUpdated, and conflictDetected. A save acknowledgement identifies the exact local snapshot it saved. UI subscriptions select small state slices; heavy serialization/statistics do not drive the whole studio render.

Keep one active scene editor for ordinary writing. Continuous reading can use inexpensive rendered scenes; expanded editing is bounded and measured. Cache statistics and search/index work by revision. TipTap's React performance guidance supports component isolation and selective state subscription. [Performance](https://tiptap.dev/docs/guides/performance)

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

For rich text, avoid persisting opaque ProseMirror steps as the only portable domain contract. Python BFF validation and exact document transformation require a spike: test semantic operations versus author-approved final JSON snapshots with expected revisions. If a shared conversion runtime is necessary, make it a measured dependency decision; this research does not add a Node microservice by assumption.

## Assistant integration

Extend the existing assistant kind/target contracts and profile feature catalog intentionally. Conversation target metadata should bind novel ID and workspace, while an operation carries explicit scene/document targets and a revision vector. Existing single-target CAS is reusable as a pattern, not sufficient for an arbitrary multi-scene commit.

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

The versioned structured document remains authoritative for each migrated scene; Markdown and rendered output are derived representations. The author can have multiple tabs or devices, so the BFF still rejects stale writes and the UI retains conflicting drafts for comparison, a reviewed merge, or copying into a new revision. This does not require a shared editing protocol. [TipTap output formats](https://tiptap.dev/docs/guides/output-json-html)

Keep metadata/structure transactions, workspace ownership checks, accepted changesets and durable checkpoints in BFF-owned domain storage. Preserve local undo and revision-bound AI proposals. No presence service, coeditor roles, shared sessions, or CRDT persistence is proposed.
