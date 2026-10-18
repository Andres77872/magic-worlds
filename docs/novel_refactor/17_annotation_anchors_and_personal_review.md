# ADR-17: Revision-bound personal annotations

**Status:** Accepted for implementation; delivery remains WIP.
**Date:** 2026-10-16.
**Deciders:** Implementation decisions follow the user's existing refactor
authorization. Product/release ownership remains TBD.

## Context

S05, S06, S07 and E17 need comment/anchor preservation during organization and
copying. R08 adds personal and later AI review notes with resolve/reopen and
orphan handling; R10 adds editorial issues in D4. These are single-author
manuscript resources, distinct from background execution jobs. Notes must not
enter canonical prose, word counts, prompts or public source cards by accident.

Current scene JSON has stable block/reference identities, immutable checkpoints,
independent text/metadata authorities and exact operation receipts. Repeated
sentences, rich formatting, Unicode, split/merge, restoration and the author's
own concurrent clients make first-match quote search unsuitable for anchoring.
Preserve recovered project content and current novels; no whole-database reset.

## Decision

Store each note's content/state separately from its anchor state. An immutable
origin records scene/revision/hash, stable start/end block IDs, UTF-16 offsets
and the exact selected quote. A current anchor records its own verified scene
revision/hash and points, or an explicit orphan reason. Resolve/reopen does not
alter prose. Automatic remapping does not overwrite note content or resolution.
Retain a separate last verified anchor when a passage becomes orphaned. An exact
whole-document restore may recover that last attachment; it must not move a
previously reanchored note back to its immutable origin. Both passages remain
readable for review.

The editor records exact plain-projection replacement ranges from actual
transactions. A scene write may include that bounded edit sequence, bound to
its existing source revision. The server verifies every Unicode boundary and
that applying the sequence to saved text produces exactly the submitted
canonical document's plain projection. The saved document and anchor changes
commit together. A touched passage becomes orphaned for explicit review;
an insertion exactly outside a passage shifts its points without capturing the
new text. Stable unchanged block identities also preserve anchors through moves.

When an edit trace is unavailable, preserve only anchors proven by unchanged
stable blocks; expose other anchors as orphaned. Never guess an equal quote's
identity. Server-owned split/merge/copy transforms provide explicit block/offset
lineage, including a new right-hand split block. A passage crossing a scene split
retains its original quote and note with an explicit orphan state. Copies use
new note IDs and current anchor identities while retaining source provenance;
including comments is an explicit reviewed option.

Use the existing owner/workspace/novel lock and receipt boundary. Annotation
content and anchor versions are independent. A separate annotation collection
head supports source guards, reviewed copying and frozen snapshot references
without turning each comment into a prose or organization revision. Keep
immutable annotation events for recovery and structure reversal. Body/status
edits to a note must survive unrelated automatic anchor remaps. A reanchor must
review the current scene and original note/anchor versions.

Readers remain available while archived or in Trash. Remove is recoverable;
permanent erase is not introduced. Scoped request journals retain unsent and
uncertain notes across closure/reload, use receipt-first recovery, and retire
only the original immutable intent. Confirmed writes hydrate separately.

## Options considered

| Option | Benefit | Cost / reason |
|---|---|---|
| Search for the first matching quote after every save | Small implementation | Can silently move a note to an unrelated repeated passage; rejected |
| Store comments as editor marks or manuscript text | Native editor mapping | Couples note state/counts/context to prose and cannot independently protect note content; rejected |
| Separate versioned notes with verified transaction mappings and block lineage | Preserves current editor/API; explicit orphan/recovery behavior | Maintain bounded mapping and cross-language fixtures; selected |

## Consequences and action items

1. Implement shared point/range and edit-trace validation with Unicode,
   repeated-text, block-move and split/copy fixtures.
2. Add scoped annotation storage, immutable events, content/anchor CAS and exact
   receipts. Apply additive schema changes only after isolated verification and
   a verified private backup; retain current content.
3. Connect transaction traces to ordered saves, acceptance and local recovery.
4. Add personal note review, explicit reanchor, resolve/reopen and recoverable
   removal using the existing inspector/primitives and scoped journals.
5. Integrate explicit comment-copy choices, compound organization undo/redo,
   checkpoint/snapshot restoration and frozen annotation lineage. Expand the
   actual MySQL smoke in new synthetic databases.
6. Keep D4 AI notes/issues and D5 export in scope; this decision does not claim
   those features or full retention/offline/performance acceptance are complete.

Current delivery authority: [14](14_status_and_roadmap.md).

## Implementation checkpoint — 2026-10-16

Anchor/trace validation, separate note and anchor CAS, owned small-page/detail
reads, immutable requests/events, receipt-first client recovery, scoped device
drafts and a controlled review drawer are implemented and locally checked.
The drawer includes exact saved-passage reading, resolve/Trash actions, explicit
attachment review, account/device comparison and copy/download fallback.
The router, shared checkpoint remapper and Studio entry are connected. An
additive, privately backed-up upgrade installed the three tables; all 4,276
pre-existing content rows were verified unchanged. Server split/merge/copy
transforms retain exact point lineage. Guarded multi-step undo stores an
internal logical anchor authority alongside the monotonic public version;
ordinary note body/resolution changes survive, while a later explicit
attachment blocks a conflicting inverse. Copies are independently identified
and remain readable if their new unit is undone into recoverable Trash.
Snapshot text restoration remaps current attachments and records reversible
anchor deltas while preserving note content. Named snapshots now freeze the reviewed annotation collection head and per-note content hashes plus immutable content/attachment event pointers. Read-only historical pages and note details verify those references; exact passage reads use the captured scene checkpoint. Later note edits, resolution and attachment changes do not alter the captured state. Legacy snapshots explicitly report that notes were not captured. Both referenced event frames and scene checkpoints must survive retention. D4 AI notes/issues, D5 export and broader acceptance remain open.

## Prepared bookmark extension — 2026-10-16

This extension was prepared and isolated-tested, then installed locally in
the [bookmark checkpoint](14_status_and_roadmap.md#d2-bookmark-installation--2026-10-16).
It extends the existing personal annotation authority with an explicit bookmark
kind. The historical heading is retained for existing links.
A defaulted DB kind leaves all original note columns unchanged. Existing note
JSON, pending request normalization and frozen note hashes omit the new field;
only bookmarks carry `kind: "bookmark"` in event/read/index frames.

Bookmarks support a bounded nonblank label (255 Unicode characters), an exact
selected passage or one stable UTF-16 point with an empty quote, including an
empty paragraph. Notes retain their nonblank-passage requirement. Point mapping
uses the validated whole-document edit trace and server-owned lineage: insertion
at the cursor has right affinity, and a split boundary follows the right-hand
source interval. Replaced/deleted or unverifiable points become explicit orphans.
No equal-text search supplies identity. Exact checkpoint restoration can revive
the last verified attachment while keeping later labels and Trash state.

The same content/anchor versions, immutable origin, collection head, owned scope,
receipts, snapshot events and structure inverses apply to both kinds. Kind is
immutable and must be explicit on every bookmark mutation; a mismatch rejects
before writing. Bookmarks cannot be resolved like review notes. Default pages/counts
remain note-only, with explicit bookmark queries and independent reviewed copy
choices. Snapshot collections can freeze both kinds without changing old
manifests. Export remains D5.

Writer/reader creation, exact navigation, attachment review, scoped device
forms and pending recovery are connected and locally checked. They use the
existing writer flush/review gate, preserve the captured source and retire
callbacks after ownership changes. Confirmed requests verify immutable origin
and owned checkpoint geometry before retiring input; an empty quote alone is
not proof of the original point. Navigation changes no prose or counts. Changed
or detached targets require deliberate review. Separate copy choices and frozen
views remain explicit. The backed-up [15](15_database_migration_and_legacy_cleanup.md)
upgrade preserved all original content. Broader author/device/accessibility and
retention/offline acceptance remain open; reset/cleanup remains forbidden.
