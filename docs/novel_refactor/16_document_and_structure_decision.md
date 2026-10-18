# ADR: Canonical scene documents and structure revisions

**Status:** Accepted for development implementation; integration/acceptance work is in progress.
**Date:** 2026-10-16. **Implementation owner:** Codex in this working checkout. Release ownership remains TBD.

## Context

D1 now provides ordered chapter saves, independent text/metadata CAS, receipts,
recovery and checkpoint restore. Markdown cannot retain a Codex mention's stable
identity or all rich document semantics. D2 requires independent scenes and
structure operations that preserve writing and history. This is a single-author
development project. Current novels and recovered non-novel content must be
preserved; earlier reset approval is superseded.

## Decision

Scenes own a versioned envelope containing validated TipTap JSON. Every block has
a stable `nodeId`; mentions retain the Codex reference ID and display label.
Unsupported nodes/marks/schema versions are rejected explicitly. Markdown and
plain prompt text are deterministic projections from that document revision.
Prompt selections/cursors use UTF-16 offsets in the plain projection, validated
against the saved scene revision. Split uses a block ID and UTF-16 cursor;
surrogate halves and inline-reference interiors are rejected.

Chapters and optional parts group scene IDs. The novel's independent structure
revision governs atomic insert/move/reorder/copy/split/merge/trash/restore.
Document, metadata and structure revisions are separate. Moves retain IDs; copies
remap block/document identities while retaining pinned Codex relationships and
copy lineage. Restore creates new revisions rather than deleting history.

Use the existing story routes/domain facade, shared primitives and DataProvider.
Extract domain persistence from the model monolith. No new provider client,
second assistant ledger, CRDT, collaboration service or migration bridge is needed.
Validate changes in fresh synthetic databases. Any installed-schema extension
uses a verified backup and a scoped upgrade; whole-database resets are disabled.

## Options considered

| Option | Benefit | Cost |
|---|---|---|
| Keep Markdown canonical | Smaller current DTO | Loses stable mention identities; requires fragile reconstruction |
| TipTap JSON with versioned projections | Preserves existing rich editor and identities; explicit validation | Maintain the supported schema and cross-language projection fixtures |
| Replace the editor / collaborative document stack | Potential future synchronization features | Unnecessary migration and service complexity for the single-author scope |

The second option follows the dossier's recommendation. Projection and operation
tests are required before connecting the new schema and UI. The scene integration has now replaced the D1 chapter writer and is installed in the approved development DB. [14](14_status_and_roadmap.md#d2-scene-integration--2026-10-16) records actual evidence and remaining phase gates.

## Consequences and implementation steps

1. Implement/test canonical validation, projections and block identities.
2. Connect scene storage, exact write receipts/history and context compilation.
3. Add structure CAS, lineage and recoverable lifecycle operations with matching UI.
4. Preserve existing project data and validate changes in newly allocated
   synthetic databases. The historical scene installation already retired the
   chapter-body writers; its reset approval is superseded by the preservation
   correction in [15](15_database_migration_and_legacy_cleanup.md). Record actual
   gates in [14](14_status_and_roadmap.md).

Retain unsupported import originals/loss reports in the later portability slice;
do not silently normalize unknown content into a smaller document schema.

Guarded structure undo/redo follows persisted linked event heads and pins the
reviewed current structure revision. Every new event captures its actual
transactional before-state; a prior structure checkpoint can predate independent
scene writes and must not substitute for that before-state. Reversal applies
only the event's deltas and preserves later unrelated writing/metadata/context.
Compound split/merge prose restores as a new scene revision, with trusted
restoration lineage permitting successive reversals while independent edits
still block unsafe ones. A new branch retires the redo head, retaining its
events. Older records without verified before-images remain readable and are
not guessed reversible. Historical scenes, reference pins and checkpoints stay
retained. No new table or project reset is needed for this history contract.

## Named manuscript restore — 2026-10-16

Named snapshots reuse the immutable structure log and reference exact scene
revision/hash checkpoints. Reviewed in-place restore uses the same root lock,
source vector and operation receipt boundary as organization. The pure compiler
serves read-only review and commit with explicit text, details, organization,
context and later-unit choices. Every unit/history record is retained; later
visibility cannot change silently in either direction. New heads replace current
content without rewinding or deleting the history being restored from.

Restore records full author metadata and novel state in its before/after images
and full affected reference values under their immutable provenance. Inverse
operations reverse only touched fields, retain later unrelated work and guard
affected prose/details/pins. New outline hashes bind undo checkpoint contents;
older recorded formats remain readable. No schema change is introduced. Current
evidence and remaining acceptance gates are in the
[restore checkpoint](14_status_and_roadmap.md#d2-manuscript-restore-checkpoint--2026-10-16).

## Native editor boundary clarification — 2026-10-16

Canonical ordered lists carry `start`, not the native editor's neutral `type: null` default. The frontend adapter removes only that empty default; meaningful unsupported attributes still fail the existing schema. Disable automatic trailing paragraphs: selection and view commands must not add manuscript structure. Whole-node movement reuses existing node IDs and ordinary scene saves; comments follow verified unchanged blocks, with explicit orphan review for altered boundaries and exact-document attachment recovery. The [E17 checkpoint](14_status_and_roadmap.md#d2-manuscript-block-movement--2026-10-16) records implementation evidence.

## Additive author highlights and display markers

Schema-1 canonical inline marks now include attribute-free `highlight`, alongside
bold, italic, strike and links. A fixed theme style replaces pasted styling;
arbitrary highlight attributes and duplicate marks are rejected. JSON remains
authoritative across save/copy/checkpoint/snapshot/restore. Highlighted Markdown
uses `<mark>…</mark>` with a dedicated inline tokenizer so escaped punctuation,
entities and nested formatting survive. Existing unhighlighted projections retain
their previous representation. Plain text/counts/UTF-16 anchors stay unchanged by
formatting alone; the document hash/revision still advances for a saved mark.

Invisible-character display is a device preference plus bounded ProseMirror
presentation widgets. It has no canonical node/mark/metadata field, does not
enter copied/serialized text, and cannot dirty writing or consume manual undo.
[14](14_status_and_roadmap.md#d2-highlights-and-invisible-characters--2026-10-16)
records verification and the remaining author/device/accessibility gates.
