# Persistence, revisions, recovery, and offline writing

**Research/design review:** 2026-10-14. **Implementation checkpoint:** 2026-10-16. **Status: D1 locally verified, D2 WIP.** Scene prose, metadata, structure, lifecycle, goals, Codex mutations, whole-novel copies and creation now use revision/intent checks, exact receipts and scoped device recovery. This does not establish a general offline guarantee, release storage policy or full D2–D6 completion. See [14](14_status_and_roadmap.md) for current evidence and remaining gates.

## Required invariants

These remain acceptance invariants across all phases. The current [scene draft hook](../../src/features/novel/hooks/useSceneDraft.ts) serializes canonical-document saves, uses independent text/metadata counters, retains immutable pending requests and scoped recovery, and compares conflicting account versions. BFF scene revisions, operation receipts and guarded restore are implemented; generation status alone is never a manuscript acknowledgement. Shared [mutation journals](../../src/shared/novelMutationJournal.ts) also retain metadata forms, independent goal requests, root lifecycle recovery and atomic Codex requests. Snapshot forms and details compare/rebase only changed fields after an explicit author choice. All retain the storage/ownership and runtime limits recorded in 14.

1. A saved indicator refers to the exact displayed document revision.
2. Late requests cannot replace newer work or cross workspace/account boundaries.
3. A locally checkpointed draft survives an ordinary reload/process loss within the supported storage contract.
4. Unaccepted AI output is separate from committed manuscript prose.
5. Accepted AI changes are undoable and recoverable after reopening.
6. Revisions, trash, local recovery, and operational backups are distinct facilities.
7. A failed remote save does not discard the local document.
8. Restore creates a new revision and preserves the history being restored from.

## Save state and queue

Track local revision, locally checkpointed revision, sent revision, acknowledged server revision, content hash, and pending request IDs. Prefer state names that explain the writer's situation: editing, saved on device, syncing, saved to account, offline changes, conflicted, and failed.

Per document, coalesce unsent edits into the latest snapshot and allow one active remote save. On completion, only acknowledge the snapshot carried by that request. If newer local edits exist, keep a pending state and send the newest snapshot next. A manual Save flushes this queue; it does not create a parallel request.

Server writes compare an expected revision and return a new revision/hash. A repeat request ID with the same intent returns its original acknowledgement; different content under the same ID is rejected. A conflicting write preserves the local snapshot and fetches only authorized current content for comparison. Conditional updates are a standard way to avoid lost updates. [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)

A chapter title/goal update has its own validated metadata patch. Do not mark an omitted invalid title as saved while leaving a mismatching visible value. Reconcile successful server values and report field errors separately from prose saving.

D1 implements backend revision/checkpoint/receipt storage and a serialized frontend queue. The timestamp-based `DataProvider.mergeFreshChapters` writer has been removed; [revision-aware merging](../../src/shared/storyCache.ts) keeps document, metadata, structure and context authorities independent so stale responses cannot replace later writing. Preserve workspace/account ownership guards. [15](15_database_migration_and_legacy_cleanup.md#required-storage-changes-by-phase) defines current storage and scoped schema changes that retain existing content.

## Local draft journal

Use IndexedDB or an equivalent bounded durable store for scene draft checkpoints. Namespace by account, workspace, novel, scene/document and schema version. Each checkpoint includes body, local revision, base server revision/hash, local timestamp, and pending-sync state. Keep transient credentials and unrelated conversation context out of it.

Write a checkpoint after document transactions through a short, measured schedule and on reliable lifecycle transitions. Browser hidden state is an important checkpoint opportunity; unload/termination callbacks are not reliable, especially on mobile. [Chrome Page Lifecycle](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

The application should distinguish saved-on-device from synced-to-account. IndexedDB availability, quota and browser eviction are real limitations: detect failure, retain in-memory work, show recovery/export options, and document the supported offline guarantee. Do not promise permanent backup from local browser storage.

Authentication expiry keeps the draft accessible and allows reauthentication, copying/exporting recoverable text, or explicitly discarding it. Account/workspace switches must not reveal another account's checkpoint or send it to a newly selected workspace. Logout/shared-device checkpoint retention is an open product/privacy decision with a visible policy.

Preserve current project drafts and pending intents. The historical D1 → D2
transition cleared the old format; that is not permission for another reset or
blanket local-storage cleanup. Retire only the exact acknowledged or explicitly
discarded record, preserving newer input and other writers.

Word goals now use independent metadata revisions and durable mutation requests.
Preserve chapter goal semantics and unrelated browser data. CL-07 in
[15](15_database_migration_and_legacy_cleanup.md#database-code-and-feature-cleanup-register)
scopes remaining obsolete-key cleanup; it must not clear current recovery data.

## Recovery flow

On opening a document:

1. Load server revision and matching local checkpoint metadata.
2. If local content is newer/unsynced, show a preview instead of overwriting it.
3. Offer resume local draft, compare/merge, keep as separate copy, or use server text.
4. Preserve both snapshots until the decision is durable.
5. Revalidate permission/lifecycle before remote sync.
6. Retain recoverable content when the server version is archived/deleted or authorization changed; explain the allowed recovery route.

Do not silently choose the larger or later-timestamp string. Wall clocks and character counts are not revision authority.

### Reviewed unit copy and organization recovery

Chapter/scene copy requests freeze source unit metadata, the complete source
scene text/metadata vector (including excluded archive/Trash children), source
structure, Codex context, title and all inclusion choices. The transaction
checks those heads before inserting anything. Copies start their own immutable
checkpoints with source revision lineage; verified summaries are repinned to
revision 1 and stale summaries remain unverified. Earlier history/candidates
stay with the source. Personal review-note copying additionally freezes its
explicit inclusion choice and source annotation collection head; earlier
uncertain requests retain their original field set and receipt normalization.
Automatic anchor mapping has separate authority from note body/resolution.
Split/merge record server-owned point lineage, and guarded organization undo
reverses attachment deltas while retaining later note edits. Explicit later
reattachment blocks a conflicting inverse. Text restoration keeps current note
content and either verifies the restored attachment or retains an orphan quote.
Named snapshots now pin the annotation collection head and a hash-bound metadata index. Each note references its last full content event and last attachment event; owned readers reconstruct and verify that historical state without consulting mutable note rows. Small filtered pages contain previews only. Exact attached-passage reading uses the captured scene checkpoint; orphan quotes remain explicit. Older snapshots report notes not captured, distinct from an empty captured collection. Retention must preserve both referenced event frames and scene checkpoints while any snapshot references them. The full retention policy remains open.

Organization journals deep-clone the immutable intent. Uncertain choices stay
locked. Recovery reads the owner-scoped structure receipt before retrying a
POST; it can recover a confirmed result while the workspace is archived. A
missing result requires a writable workspace before any POST. A failed
post-acknowledgement manuscript read retains the original intent for another
read. Older receipts remain readable without admitting a new unguarded copy.
The Studio recovery action respects its current save/review barrier before
selecting another unit. Exact retirement and account/workspace isolation remain
the same as ordinary structural requests.

### Whole-novel copy request recovery

The [copy journal](../../src/features/novel/persistence/copyJournal.ts) retains
source identity/title, the exact request ID, reviewed source version, new title
and inclusion options. Its acknowledged stage adds the request-bound target
identity. API origin, stable author, workspace, source novel and writer scope
prevent another account/workspace from adopting the result. Late responses stay
in their original scope and do not open a different author's manuscript.

After a lost response or reload, the coordinator reads the source's copy receipt
before retrying the same immutable POST. Read recovery remains available in an
archived workspace. A missing receipt requires a writable workspace and the
source/editor barriers before retry; a changed source retires that rejected
intent and requires a refreshed review. Another writer can explicitly recover
the old request, and exact retirement never erases its newer replacement.

Library and Studio notices expose uncertain and confirmed results even when the
source card is hidden by Trash. Opening the target is explicit and observes the
current editor save/review barrier. Device-storage failure retains in-memory
intent and explains that the tab must stay open. This is not a general offline
guarantee. Creation has its own contract below. The target's frozen provenance lives in
its initial immutable structure revision independently of this local journal
and the source receipt.

### Novel creation request recovery

The [creation coordinator](../../src/features/novel/hooks/useNovelCreations.ts)
is owned by DataProvider and covers library, landing-page and card-gallery
creation. A scoped journal stores the original metadata-only request ID and
payload before POST. Pending work blocks replacement creation; the acknowledged
stage retains the exact request-bound result before loading the manuscript.
Device failure retains the in-memory intent and reports that the tab must stay
open. Another writer can explicitly adopt the old intent without deleting a
newer record.

The BFF derives a root identity from owner/application/workspace/request scope
and uses the existing operation-receipt table. A short exclusive workspace lock
serializes concurrent first requests; source reads reuse the same transaction
cursor so waiting writers cannot exhaust the pool. Novel, insert-only units,
initial checkpoints and exact receipt commit together. Replays return before
source resolution and reject changed intent under the same request ID.

After a lost response/reload, recovery reads the result before retrying the
original POST. A result read works in an archived workspace; new work requires
an active one. Confirmed results open explicitly after recovery. In Studio,
the existing save/review barrier protects the current manuscript. Late responses
retain their original owner/workspace and cannot populate another session.
This adds no general offline, retention or release guarantee.

## Revision history

Use immutable scene/document checkpoints with actor, parent revision, operation source, schema version and hashes. Store author-named snapshots around milestones, substantial AI commits, restore, and destructive structure operations. Coalesce routine autosave history under a documented retention strategy so each keystroke does not become an expensive full snapshot.

The history UI provides date/actor/source filters, before/after comparison, copy of selected old prose, and restore. A restore creates a new current revision and an event linking back to the selected historical revision. Comments and derived memory are remapped or marked stale/orphaned; they must not be silently attached to a different equal sentence.

Structure history is separate from text history. Undoing a chapter move should restore order without replacing edits made to its scenes since the move. Named whole-novel snapshots can record a manifest of structure and document revision IDs rather than duplicate every body.

### Reviewed scene history and durable text restore

The local implementation lists 50 small checkpoint summaries per page, with
exclusive pagination and source/actor/recorded-date filters. The list includes a
lightweight current scene head and never loads checkpoint bodies. Selecting one
checkpoint reads its owned canonical document, verifies its stored hash, and
compares its derived Markdown with current saved account text. Unsupported
checkpoint formats remain visible in metadata and cannot be restored. Copy and
download remain available in read-only history, including selected plain-text
excerpts without splitting a Unicode surrogate pair.

Both editor save/AI-review barriers run before restoration. The reviewed intent
binds the original request ID, current revision/hash and selected checkpoint
hash. A fresh metadata-only head read detects later prose before POST; the server
checks the same identities under the novel lock, verifies the replaced current
checkpoint, and blocks pending/stashed alternatives. Only scene text changes.
The new checkpoint and exact metadata-only receipt commit atomically; notes,
goals, current parent and scoped context retain their independent authorities.

API/account/workspace/novel/scene/request/writer-scoped journals persist the
immutable intent before POST. Recovery reads the exact original receipt first;
null permits retrying that intent only while writable. A confirmed receipt is
retained until a separate current scene read reaches its revision/hash or a
later saved head. Hydration failures never reapply the restore. Pending target
text stays blocked, recovery remains reachable outside the history drawer, and
archived receipt/detail readers remain available. Late account/workspace
responses retain their original scoped record without hydrating another owner.
Storage faults retain visible in-memory recovery; unrelated/newer writer records
are retired only by an exact intent match. The same source factory remains
stable through DataProvider refreshes, including manuscript snapshot reviews.

This implements the current scene contract, not a retention/offline promise.
Annotation remapping, complete nested/compound and author/device acceptance,
history storage limits and measured large-project behavior remain open.
Evidence is in [14](14_status_and_roadmap.md#d2-scene-history-checkpoint--2026-10-16).

### Organization history

The local organization history implementation now lists 50 small event summaries
per page, filters by action/recorded date and fetches one before/after outline for
comparison. Studio exposes this from organization/details with explicit undo and
redo review, editor save/AI-review barriers, source-head binding and the existing
durable operation journal/result recovery. Archived history stays readable.
Another client's newer outline requires refreshing both manuscript and history.

Each new event captures a transactional before-image and linked undo/redo heads.
Reversal applies the event's deltas; it never substitutes the preceding structure
snapshot for the actual prose baseline. Exact checkpoint restores create new
physical scene heads with trusted history lineage, allowing split/merge undo,
undo again and redo without admitting an independent stale edit. Later unrelated
prose/notes/titles remain intact. Touched details and affected local reference
states/signatures are guarded; unrelated Codex changes remain intact. Candidates
block reversal that changes/hides their scenes. All writes and the bound receipt
commit atomically. Branching clears only the redo head and retains old events.

Older events without verified before-images retain their saved outlines and
cannot be guessed reversible. The preceding-only `restore_structure` writer is
retired; retained exact receipts can still be read. No schema change or project
database reset is required. Reviewed whole-manuscript restore is implemented in
the later checkpoint; the full revision acceptance matrix and long-project
measurements remain open. Organization evidence is
in [14](14_status_and_roadmap.md#d2-organization-history-checkpoint--2026-10-16).

### Named manuscript capture and frozen reads

The current implementation captures a named milestone in the existing immutable
structure log. Its versioned, hash-verified manifest freezes novel/unit metadata,
organization, independent goals, notes, lifecycle states and full Codex pins.
Scene prose is addressed by exact checkpoint revision/hash; it is not duplicated
into the manifest. Captures include archived/trashed units and reference tombstones.
Candidates and active generation jobs remain outside the manuscript snapshot.

A saved-source preview binds review to the complete source revision vector and
structure head. Capture checks both under the root lock, verifies every scene's
checkpoint, then commits the manifest, next structure head and exact request
receipt together. Capture preserves the undo/redo heads and document lineage;
it does not change canonical prose, metadata or context. An uncertain capture
uses the existing immutable organization journal and owned receipt GET before retry.

Small pages contain summaries only. Detail, comparison and individual frozen
scene reads remain owned and available while archived. Frozen text is loaded from
its captured checkpoint with strict validation/hash checks and its original pins;
missing/corrupt checkpoints or unknown formats fail explicitly. Current text is
shown only if its head still matches the compared saved state. Unsaved editor
text is excluded until saved. Name/note drafts survive closure within their scope.

### Reviewed in-place manuscript restore

The local implementation now reviews and applies a snapshot to the existing
manuscript. Text, writing details/notes, organization/lifecycle and Codex/context
are independent explicit choices. All later parts/chapters/scenes are listed.
Keeping them cannot silently hide later writing under a restored ancestor;
choosing recoverable Trash cannot hide earlier writing now inside a later
container. Move that writing or restore its original parent before applying.

One compiler prepares both the read-only preview and the committed result.
The author can inspect exact changed fields and current/original scene prose.
Both save/AI-review barriers run; the immutable request binds options, snapshot
ID/hash, complete current source vector and structure head. Stale sources require
explicit refreshed review. Scoped choices survive closure; uncertain requests
retain the original intent and recover their receipt before retrying. Archived
workspaces permit preview/result reads and block new writes.

The locked transaction verifies original and target checkpoints, then commits
new prose/metadata/context revisions, reference changes, a linked history event
with actual before-images and its exact receipt together. Historical/current
Codex pins swap under final-batch validation; source provenance stays immutable.
Later references leave context as readable tombstones. Verified summaries map
to restored prose heads; unmatched summaries stay stale. Pending/stashed
alternatives block rewrites or newly hidden scenes. Corrupt checkpoints cannot
fall back to current content or leave a partial restore.

History undo/redo now reverses touched full metadata and novel details as well
as prose/structure/reference values. Later unrelated notes/titles/context remain;
independent affected edits block reversal. The history reader exposes the saved
novel/reference before/after values, including original pin bodies. Older events
retain their recorded data without guessing missing detail. [Restore evidence](01_current_state_and_evidence.md#d2-manuscript-restore-evidence--2026-10-16)
records actual MySQL restore/undo/redo, rollback and recovery checks. This local
slice does not close the broader author/accessibility/performance/history gates.

Retention must preserve checkpoints referenced by retained named snapshots; no
new pruning policy is introduced. [Current evidence](01_current_state_and_evidence.md#d2-named-manuscript-capture-evidence--2026-10-16)
records the isolated tests and remaining gates.

Use stable document identities/checkpoints for writing. The historical D1 → D2 reset did not retain the pre-refactor format; that does not authorize discarding current scenes or revisions. Preserve current documents and unrelated content during later schema changes. Implement revision restore with schema validation for retained data.

## Session undo versus durable recovery

TipTap/ProseMirror session history provides immediate undo. An accepted AI replacement must be one event that restores the exact original slice, including marks and references; redo restores the accepted variant. Rejection and regeneration must not resurrect candidates or duplicate original text.

Durable revisions provide recovery after reload and across devices. Generated-output history provides alternatives and provenance. Operational database/artifact backups provide disaster recovery; verify a private backup and rehearse scoped storage changes before applying them to existing project data. These facilities serve different product jobs.

## Proposal acceptance durability

Commit the author-approved result, document revision, accepted operations and changeset lineage together. Remove the old body-save/status-update split with its callers; no interim compatibility flow is needed solely for existing development data.

A lost response is recovered through request/changeset IDs. Do not regenerate or apply again just because the UI missed the acknowledgement. Network errors, permanent validation errors, conflicts, archived workspace state, and authentication expiry need different recovery actions.

## Archive, trash, and erase

Archive removes a unit from the active manuscript but preserves it for restoration. Trash is recoverable removal with an explicit retention policy. Permanent erase is separate and explains descendants, comments, history and export artifacts affected. Existing card/library sources are not deleted by erasing a story copy.

Keep tombstones or equivalent reference metadata so links and jobs resolve safely. Restoring a scene with a deleted parent chooses a valid destination. Pending AI jobs/proposals cannot resurrect an erased scene. Workspace archive restrictions continue to apply to all domain commits.

The BFF uses recoverable novel/unit lifecycle operations; unguarded novel/chapter
DELETE routes have been removed. [ADR 19](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#explicit-permanent-novel-erasure)
defines the installed root-novel erase flow; its installation status belongs to
[14](14_status_and_roadmap.md#d2-deliberate-novel-erasure--2026-10-16).

Root Trash is retained until the author explicitly erases that one novel. A
current metadata-only preview supplies descendant/history counts, exact title,
active executions and a source digest. The transaction rechecks that digest and
title under workspace/root locks, refuses active executions, redacts terminal
execution prompts and deletes only the selected root and its cascading content.
Cost/reservation headers, source cards, shared media and independent copies remain.
One content-free `story_erase_record` survives the root, recovers identical lost
requests and blocks deterministic creation replay. A changed request cannot
reuse its receipt. Redacted executions return `LLM_EXECUTION_ERASED` rather than
recovering a former prompt or provider request.

The client journals the immutable confirmation before POST. A lost response is
checked by receipt read; only an explicit retry after a missing result can repeat
that same request. Archived workspaces allow result reads and refuse erasure.
Late owner callbacks cannot clear another account/workspace's cache or retire a
newer intent. Confirmed erasure retires only that novel's loaded/search state and
blocks stale responses from restoring it; device drafts remain available for
manual copy. Downloads, backups and provider-side copies are outside this action.

No timed Trash purge, unit erase, orphan/media cleanup or general revision/device
eviction policy follows from root erasure. Broader storage, shared-device/logout,
backup/provider and non-erased revision-retention gates remain open.

## Offline editing and the author's own clients

Initial offline support can edit cached documents, checkpoint locally, and sync through revision checks. Online model calls remain unavailable unless a configured backend/provider is reachable; the UI states that clearly. Offline edits should not queue an unlimited set of paid generations automatically.

Persist cached documents and pending local checkpoints with their acknowledged base revision. On reconnect, submit through the same revision-checked save contract. If another tab/device advanced the server revision, retain both versions and offer comparison, a reviewed merge, or keeping the local draft as a copy.

The proposed authority stays in the versioned document/save service. Collaborative synchronization, shared editing sessions, and per-user collaborative undo are out of scope. Test reconnect conflicts and stale AI anchors for the author's own clients. See [07](07_target_architecture.md).

### Installed open-scene reconnect and reviewed merge

[ADR 20](20_offline_and_reconciliation.md) and the
[delivery checkpoint](14_status_and_roadmap.md#d2-open-scene-reconnect-and-reconciliation--2026-10-16)
implement this part of R13/R15 through the existing writer. Browser offline
pauses scene writes while the open canonical scene remains editable locally.
An unsent tail checks its current owned workspace and scene independently;
workspace archive is not inferred from scene inheritance. An already-sent
uncertain request replays exactly before checking the head for newer prose.
No reconnect event starts a new paid generation.

The author reviews both full canonical versions, block conflicts, title and
reading order before choosing a version or a combined document. The original
device text must first be retained in a separate scoped copy; storage failure
prevents adoption. A current sequence/owner guard rejects stale controls, and
server CAS still rejects later account writing. Historical account revisions
remain readable. Notes retain their body/origin; an unproved passage mapping
becomes explicitly orphaned rather than attaching to another equal sentence.

Each live editor queue has its own journal key, including a reopened editor in
the same tab. An old acknowledgement cannot remove that newer queue's record.
Exact recovery retirement also checks the acknowledged base revisions. A
readable draft with an unsupported original request remains manual-copy recovery
and is never replayed. Older-format and malformed neighboring records are
preserved. Clipboard failure exposes selectable device text.

The later persistent-entry and durable-review checkpoints below add cached scene access and exact-source choice recovery across full reloads. Cold-start offline app loading, shared-device/logout/storage policy and broad author/device/assistive-technology acceptance remain open. Those remain
required work; ordinary revisions, source cards and media are not purged.

## Retention and performance

Retention periods and storage ceilings remain open. Publish them and allow portable export. Keep source revision manifests for AI/external artifacts while avoiding unnecessary full prompt duplication. Index recent revisions and paginate older history. Test schema-version restore and garbage collection against the oldest supported checkpoint.

Check interruption, storage failure, stale requests, auth/workspace behavior and revision/trash restore when the relevant product behavior is implemented or changed. For storage changes, use the three lean DEV checks in [12](12_validation_and_acceptance.md), including a verified backup, isolated rehearsal and preservation of existing project content. A production rollout program is not required for this development project.


## Reviewed manuscript replacements

The installed literal replacement operation accepts a saved search snapshot,
exact native occurrence identities, literal replacement text and an explicit
review hash. The client cannot send arbitrary manuscript JSON. The BFF resolves
the actual saved ICU quote and UTF-16 range, compiles within canonical inline
text, and preserves block/container IDs and untouched content. Replacement
inherits only common marks. Reference atoms and structural separators are
protected; pending/stashed AI proposals, readers and size/work limits are
explicit blockers. A selected blocker prevents the entire transaction.

One novel lock covers source validation, all changed scene writes, new immutable
checkpoints, personal-anchor mappings, statistics and the exact request receipt.
Scene metadata, goals, planned beats, Codex pins and private-note content/state
are independent. An actual mid-batch checkpoint failure rolls back earlier
scene/checkpoint/anchor/statistics work. Existing request IDs replay their exact
result before recompiling a now-changed source.

The `manuscript-replace` device journal retains the original write, reviewed
scene heads and minimal actual match identities, then its verified acknowledgement.
It is scoped by API origin, author, workspace, novel and writer. Receipt recovery
is attempted before an identical retry; a known acknowledgement only triggers
an owned manuscript read. Every affected scene must meet the acknowledged
revision/hash before exact journal retirement. A later revision is allowed;
an older head or a different hash at the acknowledged revision retains recovery.
Late original-owner receipts remain in that scope and cannot hydrate a new
account/workspace. Pending affected scenes block editing; receipt recovery stays
reachable outside the drawer and does not call the blocked writer's flush.

The separate form journal preserves unfinished query/replacement/filter input,
including invalid input and literal newlines, for explicit resume. The recent
replacement list retains at most 20 confirmed original request IDs per writer.
Storage failure is visible, with in-memory recovery while Studio remains open;
this is not a full offline or retention guarantee. Cross-writer retirement
compares exact immutable intent and never erases a newer unrelated request.

Undo/redo previews address the original successful replacement receipt. They
load its verified immutable before/after checkpoints and require the current
prose hash to equal the expected side. Applying creates new scene revisions and
preserves current metadata and private-note body/resolution. Exact restored
prose can recover a prior attachment; a removed passage retains its last verified
quote for explicit personal review. Later prose can block the whole reversal.
Reversal has its own immutable request/receipt and uses the same recovery path.
No history deletion, schema change or project database reset is required.

See [the delivery checkpoint](14_status_and_roadmap.md#d2-reviewed-manuscript-replacements--2026-10-16)
and [actual validation](01_current_state_and_evidence.md#d2-reviewed-replacement-evidence--2026-10-16).


## Bounded reader position and page recovery

The reader's active window retains three two-scene batches. It loads previous
or next batches from the same owned source snapshot and drops distant batches.
Before a DOM change it captures the currently visible scene/block and offset;
afterward it restores that verified paragraph. Automatic paging refuses to evict
the visible passage, including if the author scrolls back while a read is pending.
Explicit load controls remain available for short windows and keyboard access.
This bounds the reader window; the initial full-tree Studio loader remains.

Reader resume is a separate at-most-2-KiB account/API/workspace/novel device
record containing its reading scope, scene ID, canonical content hash, block ID,
paragraph offset/height and layout metrics. It contains no prose or author notes.
Reopening uses direct scene seeking instead of fetching preceding pages. A
matching document and identity restore the offset; changed layout uses the
clamped fraction of that same paragraph. Changed scenes leave the previous
position intact until the author continues. Unavailable, archived-excluded,
out-of-scope or Trash scenes require explicit scope/beginning choices. Equal
names/text never substitute for an unavailable identity.

Scroll capture is frame-limited, storage writes are debounced and close,
page-hide and visibility events flush the last position. Late font adjustment
retires after a reading gesture. Old owner callbacks cannot update another
account/workspace; pending original-scope position writes flush only their
original keys. Storage failures show a visible limitation. Scope and writer
cursor/undo/recovery records remain independent. Reader refresh and navigation
do not mutate prose, create checkpoints, run a provider or change schema.

Source changes stop both paging directions and preserve loaded prose until an
explicit fresh read. Direct seeking can obtain a new snapshot, but a saved
paragraph still requires the exact canonical hash before restoration. This is
device reading convenience, not authored cross-device bookmarks or a full
offline/retention guarantee. See [the delivery checkpoint](14_status_and_roadmap.md#d2-bounded-reader-and-position-resume--2026-10-16).

## Bookmark drafts and exact confirmation

Personal bookmarks reuse annotation drafts, immutable operation journals,
independent content/anchor CAS and receipts. The optional `kind: "bookmark"`
discriminator is required on each bookmark operation and absent on notes;
mismatched kind rejects before writes. Forms retain the 255-character label and
exact point/passage source. Closing the drawer keeps pending recovery visible.

A confirmed create/reanchor verifies the owned canonical checkpoint and its
stable anchor geometry before retiring input. An empty quote cannot identify a
point by itself. Failed reads retain the acknowledged request for read-only
recovery, without another POST. Owner changes retire callbacks. Opening a
bookmark uses a view cursor target and preserves writing/history. Reviewed copy
choices and frozen event frames distinguish both kinds; older note normalization
and hashes stay unchanged. [Installed evidence](01_current_state_and_evidence.md#d2-bookmark-installation-evidence--2026-10-16)
does not close full offline or retention policy.

## Studio index loading and draft ownership

[ADR 18](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#studio-index-document-seeds-and-bounded-history) preserves the existing independent
metadata/document/revision/receipt authorities. Unloaded scene heads cannot seed
an editor. Schema-2 guarded scenes bind root/ancestor/scene heads, expose complete
canonical prose/applicable references and only the latest context trace. Complete
generations use separate owned pages/details; the default full scene GET remains
an explicit full-history reader.

Studio keeps one active seed and at most three / 16 MiB serialized confirmed-read
cache entries. Revalidation checks all bound heads/references before reuse;
changed/oversized entries are discarded or bypassed. This cache never owns drafts,
checkpoints, application review or immutable intents. Acknowledgements merge
independent metadata/body heads without putting prose in the index or library.
The former server sourceVersion is invalidated after local head changes.

Selection keeps the prior writer until a verified seed passes the current
save/recovery/AI-review guard. Old owner callbacks and superseded reads cannot
activate it. Explicit retry refreshes the outline; a previously confirmed matching
read can be reused. Creation/copy receipts remain recoverable until their selected
scene opens. Metadata receipt replay retains the original acknowledgement while
reading the latest outline. Review of native organization changes is invalidated
when saving changes its source; split/merge revisions are never silently replaced.
Whole-product performance, offline/retention and author/device gates remain open.


## Highlight and invisible-character ownership

A saved highlight is a canonical scene-body change with ordinary queue/CAS,
receipt, checkpoint, annotation-anchor and restore guarantees. It does not become
an independent metadata mutation. Native verification preserves attached note
content/origin, prose statistics, frozen text and independent copied block IDs.
Unsupported style attributes fail before changing the current head.

The invisible-character preference is optional device state scoped by the
existing API/account/workspace/novel view key. It does not rewrite typing/reading
preferences or recovery journals. Storage failure keeps the current choice in
memory and shows guidance; retired setters cannot change another scope.
Presentation glyphs are generated by CSS in noneditable, aria-hidden widgets,
not canonical or DOM text. Metadata transactions are excluded from undo and
produce no content-save callback. Actual stored whitespace remains author text.


### Installed persistent device entry — 2026-10-16

[ADR 20](20_offline_and_reconciliation.md#persistent-confirmed-copies-and-device-entry)
defines the installed confirmed-read cache and explicit local writing boundary.
Strict Studio reads and separately labelled acknowledged prose are retained in
IndexedDB without drafts/requests/generation collections or automatic eviction.
A native transaction commits both candidate and usage; current allowances are
16 MiB per novel and 64 MiB per author/API. These do not alter journal retention.
The device entry survives a page reload once the app assets load, reuses the
canonical editor/save hook, checkpoints before navigation and requires fresh
ownership/index/exact-scene reads before account handoff. Unavailable, erased
or moved targets retain device recovery without recreating account content.
The following checkpoint adds durable review-form choices. Network-independent app-shell loading and broader shared-device/browser-eviction/retention acceptance remain open.

### Durable reconciliation choices — 2026-10-16

[ADR 20](20_offline_and_reconciliation.md#durable-review-choices-and-independent-recovery--2026-10-16)
defines a separate native review-form store: 16 MiB per record, 64 MiB per
API/author, atomic usage, independent writers and no deletion/eviction. Exact
canonical source equality is required for recovery; changed documents, titles,
heads, scope or read-only state retain earlier progress without reusing it.
Closing/navigation/unload protect unsaved choices, with explicit failure and full
form export. Direct saved-review access does not depend on confirmed-read cache
availability. It is a saved snapshot with account mutation controls disabled;
applying writing requires a fresh owned comparison and normal CAS/retention.
This changes neither server persistence nor prose-journal retention. Cold offline
app loading and broader storage/device/author acceptance remain open.

### Cold app copies and waiting updates — 2026-10-17

[ADR 20](20_offline_and_reconciliation.md#opt-in-cold-offline-app-loading--2026-10-17)
adds opt-in production app-file caching, separate from authored journals and
confirmed reads. Immutable build files verify their exact lengths/digests, and
an atomic native reservation limits each app base to 64 MiB including partial
candidates. A ready marker follows complete verification. No private response,
version/auth route, browser journal or account mutation is cached/replayed.

A pinned verified app stays coherent until normal worker activation. Downloads
and failures preserve older copies; updates never force an editor reload. Full
cold-page loading, explicit draft resume and continued local editing pass after
the fixture server stops. Author scope, known archive state, fresh account
handoff, current revision CAS and separate device-copy retention remain mandatory.
Broader browser eviction, long-term app-copy management, revision/draft retention,
shared-device/logout and full author/device acceptance remain open.

## D2 retained workspace lifecycle — 2026-10-17

The [current contract](20_offline_and_reconciliation.md#d2-retained-workspace-lifecycle--2026-10-17)
retains actual checked workspace versions in separate typed rows inside the
existing native schema-1 metadata store. Its 8 KiB record / 4 MiB author/API
allowance is independent of confirmed manuscript storage. Atomic batches do not
partially change restrictions on refusal; corruption is reported and preserved.
Original manuscript records and counters stay unchanged by workspace-only writes.
Legacy cached copies remain readable without fabricated versions.

Newer/equal archive observations survive late reads, tab notifications and failed
refreshes. Open device editors and saved reviews retain their original source and
unsent work while applying known read-only restrictions. A newer real restore may
unlock versioned device work; unversioned archived copies require fresh account
writing. Corrupt/unavailable metadata leaves manual recovery available. Retired
owners cannot publish late results. None of this grants account authority or
replaces fresh exact-scene reads/revision CAS. General logout/shared-device,
retention/eviction and remaining R13/D2/D3–D6 acceptance remain open.

## D2 novel and unit device lifecycle — 2026-10-17

[ADR 20](20_offline_and_reconciliation.md#d2-novel-and-unit-device-lifecycle--2026-10-17)
adds separately bounded lifecycle metadata in existing native schema 1: 2 MiB per
novel state, 16 MiB per author/API, with additional workspace/novel identity.
Independent root/unit metadata and placement revisions protect known restrictions
from older responses. Confirmed erasure is terminal. Existing manuscript records,
local drafts, earlier metadata and corrupt evidence remain intact. Current-session
and loaded-data ownership are both required before publication. Newer observations
change an open writer's restriction without replacing its prose or base revision.
Retention failure is visible and manual inspection/copy/download stay available.
This adds no account authority, automatic cleanup or broad retention/logout policy;
full R13/D2 and D3–D6 remain open.
