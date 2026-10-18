# Novel, chapter, and scene management

**Research/design review:** 2026-10-14. **Implementation checkpoint:** 2026-10-16. **Status: D2 WIP.** Independent scenes, optional parts, scoped metadata, atomic organization, lifecycle, exact mutation/creation recovery, reviewed unit/novel copies and personal annotation preservation/copy are implemented locally. Frozen annotation snapshot reads are also locally verified. Remaining organization/context/performance gates and D3–D6 remain open. Series are still a target entity. Overall availability remains WIP behind the frontend flag; [14](14_status_and_roadmap.md) is the delivery authority.

## Recommended hierarchy

**Current model:** [StoryChapter](../../src/shared/types/story.types.ts) groups independently revised canonical scene documents; Markdown `body` is a derived read projection. Parts/chapters/scenes have independent metadata and goals. The [outline](../../src/features/novel/components/NovelChapterRail.tsx) and [organization/details drawer](../../src/features/novel/components/NovelStructureDrawer.tsx) expose creation, movement, copying, splitting/merging, archive/Trash/restore, filtered history and reviewed multi-step undo/redo. Novel title editing opens the shared recoverable details form. This implemented subset does not close the broader acceptance requirements below; see the current gates in 14.

Use optional Series and Part containers around Novel → Chapter → Scene. The scene is the smallest independently organized narrative unit. Paragraphs/blocks belong to a scene document. Notes, beats, research, and snippets are linked working material with explicit inclusion rules.

~~~mermaid
flowchart TD
  Series[Optional series] --> Novel[Novel]
  Novel --> Part[Optional part or act]
  Part --> Chapter[Chapter]
  Novel --> Chapter
  Chapter --> Scene[Scene]
  Scene --> Document[Versioned manuscript document]
  Scene --> Details[POV, setting, time, summary, beats]
  Novel --> Codex[Story-local Codex and style guide]
  Series --> Shared[Versioned shared story bible]
~~~

This recommendation draws on the organization of fiction tools and portable drafting workflows. Novelcrafter documents distinct acts/chapters/scenes and structure operations; novelWriter separates chapter/scene organization from manuscript building. [Novelcrafter organization](https://www.novelcrafter.com/help/docs/plan/organizing-scenes-chapters-acts), [novelWriter chapters/scenes](https://novelwriter.io/docs/usage/chapters_and_scenes.html)

The approved project-only development reset installed the scene hierarchy directly; the obsolete chapter-body writer and tables were retired without a legacy conversion bridge. Future author imports and scene splits use an explicit preview rather than guessing boundaries silently.

## Identity and ordering rules

1. Novel, part, chapter, scene, document, and Codex IDs are stable; titles and display numbers are not identities.
2. Store sibling order separately from names. Derive chapter/scene ordinals for the chosen view and export.
3. Prefer a server-validated ordered ID list with a structure revision for initial implementation. Fractional ranks are an optimization to evaluate if large or concurrent lists need them.
4. A reorder is a single structural operation, not independent PUTs that can leave duplicate orders halfway through.
5. Validate same novel/workspace ownership, parent type, cycles, missing IDs, duplicate IDs, and expected structure revision.
6. Manuscript order, story-world chronology, and when information is revealed are separate concepts.
7. A scene keeps its ID when moved. Copying creates new IDs with lineage; moving preserves identity.
8. Library cards and collection memberships do not automatically become active novel context. Retain the explicit Codex boundary.

## Novel lifecycle

| Job | Recommended behavior |
|---|---|
| Create | Blank, from selected cards, template, approved play material, or validated import |
| Metadata | Title, description, language, genre, audience, synopsis, style guide, goal, owned cover/description and default POV/tense; metadata errors do not block prose recovery |
| Resume | Open last scene and restore position; distinguish local recovered content from server revision |
| Duplicate | Independent novel with remapped internal IDs and preserved provenance; do not copy active jobs or change workspace ownership |
| Branch draft | Named alternative draft/edition; make its inherited canon and intended comparison clear |
| Archive | Retain read access, history and export; explicitly explain write/AI restrictions |
| Trash | Recoverable removal separate from archive; restoration preserves descendants and references |
| Erase | A separate permanent operation with explicit scope and retention consequences |
| Series | Author-owned versioned canon/style reused across novels with visible local overrides; no silent retroactive changes |
| Search/filter | Title, status, genre/tags, recency, draft size and full manuscript search without loading every body into the gallery |
| Export | Compile an identified revision set with options for chapters, notes, metadata, and annotations |

Treat workspace archive independently from novel archive. Workspace R1 already governs the origin and permission behavior. A novel-local status must not bypass those rules.

Creation now journals an immutable request before POST across the library,
landing page and card galleries. A lost response/reload recovers its original
receipt before retrying; a failed manuscript read retains the confirmed result.
An uncertain request blocks a replacement creation. Recovery and explicit Open
novel remain reachable from the library, Studio and creation dialog. The BFF
commits the new root/tree/checkpoints/receipt atomically and serializes identical
first requests without changing the schema. See the
[creation checkpoint](14_status_and_roadmap.md#d2-creation-recovery-checkpoint--2026-10-16).

### Implemented source review and creation origin

The shared creation form reviews a primary card plus selected workspace cards
and explicitly approved, author-pasted adventure passages. The read-only review
shows exact snapshots, context inclusion, resolved library version pins and
whether a snapshot came from the library, a saved adventure or author input.
The author approves that review; source changes reject creation and require a
fresh review while preserving the form. No live session-history browser is
introduced, and every new manuscript still starts empty. Approved passages are
existing `snapshot_card` context references with their exact text; they do not
claim library/version identities or become canonical scene prose.

An owned creation-origin reader exposes the frozen initial snapshots independently
of later Codex edits/removal or deleted library cards. The private manifest and
hash live in the initial structure revision and commit atomically with the
novel, references, checkpoints and exact receipt. Default history pages omit
that private source payload. Older originals with no recorded review say so;
copied novels retain their separate copy-origin reader.

Definitively rejected creation requests remain scoped device drafts, including
the exact authored outline/defaults, description, reference options and approved
text. Recovery reads the original receipt first and never reposts a rejected
write. The author can download it, explicitly discard it, or reopen it for fresh
source approval and a new request ID. When replacing a retained draft, the old
input retires only after the confirmed new manuscript opens successfully.
Unknown outcomes still block replacement. See the
[source checkpoint](14_status_and_roadmap.md#d2-reviewed-creation-sources--2026-10-16).

### Implemented library discovery

The library now applies server-side search scope, workflow status, literal
genre/language/audience text, whole tag, UTC activity days and stable title/
creation/activity sorting. Search can target novel titles, current saved
manuscript text, or metadata/section titles. Metadata includes author notes,
synopses, written summaries and plot-thread values; it excludes revision history,
AI candidates and current Codex content. Trashed sections/ancestors stay excluded;
locally archived sections require an explicit option. Archived novels remain in
the library, selectable by status, independently of novel Trash and workspace
archive. The gallery's root Trash selector now says Novel Trash rather than
claiming to include archived roots.

The shared filter drawer applies explicitly, preserves invalid typed values and
supports cancel/reset. Applying filters retains the search text, resets pages
and rejects late old-page results through the shared gallery coordinator. Trash
retains applied filters; committing another workspace clears them and closes the
drawer. Searches return metadata summaries without hydrating manuscripts. Saved
statistics and size filters are implemented below; within-manuscript results/
jumps and complete measured large-library limits remain open. See the
[library checkpoint](14_status_and_roadmap.md#d2-library-discovery--2026-10-16).

### Implemented novel covers and default POV

The shared recoverable root details form selects an owned workspace image or
uploads through the existing storage-only media route. Its accessible cover
description and novel-level Codex POV character are saved in the existing
`details` object. POV/tense inherit through parts, chapters and scenes; local
overrides stay independent. Selecting a missing-file image record remains valid:
the preview explains unavailability and retains the selection. New assignments
check account/workspace ownership; unrelated edits preserve retained unavailable
references. Current and frozen covers keep their asset records available for
restore. Snapshots, history and independent copies preserve the values, and an
excluded-context copy retains the assigned POV snapshot disabled. See the
[metadata checkpoint](14_status_and_roadmap.md#d2-novel-covers-and-default-pov--2026-10-16).

### Implemented saved statistics and size filters

Each saved scene caches counts against its canonical document revision/hash.
The novel cache aggregates numeric scene counters and lifecycle metadata under
the existing novel transaction lock. Ordinary saves do not reload or recount
unrelated prose. Library responses read these small caches without hydrating a
manuscript. Client cache merges invalidate totals when their source revisions
no longer match.

Counts separate active, archived and trashed sections; a trashed ancestor wins
over archive. Root archive/Trash does not erase its retained manuscript totals.
Word counts use the fixed-English ICU word-like segmentation policy over literal
canonical plain text, including mention labels; characters are Unicode code
points and bytes are UTF-8. Native segmentation failure yields an unavailable
word count while preserving saving and character/byte counts. Missing/stale
aggregates are unavailable rather than zero. This is a defined counting policy,
not a universal linguistic definition or writing-session analytics.

The library applies inclusive minimum/maximum saved-word filters and ascending/
descending word sorting, with unknown totals last. Zero is a valid bound. Its
section-archive option includes archived words; trashed writing stays excluded
from size filtering. Apply/Cancel/Reset retain explicit review and invalid typed
values. The scoped two-table schema upgrade preserved all original content.
The [statistics checkpoint](14_status_and_roadmap.md#d2-saved-statistics-and-size-filters--2026-10-16)
records verification and the measured synthetic fixture's limits.

### Implemented reading appearance

The More menu opens device-local reading controls for Literary, Close reading
and Spacious presets, with independent font, size, line/paragraph spacing,
width and prose contrast choices. They remain available in archived readers.
Appearance persists in the existing API/account/workspace/novel view scope;
invalid/future records are ignored and never applied as CSS. Storage failure
retains the current room's controls and displays an honest reopening warning.
Changes never enter canonical prose, revisions or AI context. The editor,
selection and manual undo history stay intact, while rail docking remeasures
the chosen width. The following checkpoint implements scoped view/position
resume; font/device/author acceptance and manuscript result navigation remain
separate work. See the
[reading checkpoint](14_status_and_roadmap.md#d2-reading-appearance--2026-10-16).

### Implemented links and author typing choices

The editor provides a link inspector through selected-text controls, More and
Ctrl/Cmd+K. It captures an exact local document/range, preserves captions and
formatting, commits a normal undoable edit and refuses stale/read-only/review
targets or unsupported/over-limit output. Reader inspection/open/copy remains
available. Unsupported pasted destinations retain their visible captions and
URLs as text rather than entering an invalid save. The existing schema keeps
supported URL/title metadata; no document-format expansion is introduced.

Typing preferences are separate from reading appearance. Device-local quote,
dash/ellipsis and symbol/fraction choices affect new keystrokes only. Automatic
double quotes recognize Spanish manuscript settings; explicit curly/angle/
straight and fully literal choices remain available. Existing text, paste,
selection and history stay intact. Reading and typing use independent bounded
records under the same API/account/workspace/novel scope; retired callbacks and
storage failures retain the existing view-preference guarantees. See the
[checkpoint](14_status_and_roadmap.md#d2-links-and-typing-preferences--2026-10-16).

### Implemented view and position resume

The existing API/account/workspace/novel view scope now retains selected unit,
focus mode, typewriter, preferred Codex visibility, narrow navigation panel and
Codex scope. Outline/reading choices keep their independent records. Unowned
global booleans are ignored and left untouched. Missing/trashed selections fall
back to available prose, while explicitly selected empty containers stay empty.
Focusing actual prose remembers its scene without saving or changing writing.

Per-scene cursor/scroll hints flush on scene changes, close, page hide and hidden
visibility. Late old-scope callbacks are retired; a recovery remount reads the
latest captured point. A missing block or invalid mention/UTF-16 boundary cannot
cause an unrelated selection or scroll jump. Non-collapsed ranges restore only
after an exact document fingerprint match; changed/unverifiable text resumes a
cursor at the saved head. SHA-256 is requested only for non-collapsed ranges,
cached per immutable document, and stores no prose. Without native WebCrypto,
cursor/scroll recovery continues. Late verification yields to newer interaction.
Storage failures keep the current room usable and explain that view/position
could not be remembered. See the
[resume checkpoint](14_status_and_roadmap.md#d2-view-and-position-resume--2026-10-16).

### Implemented saved manuscript search

Studio's More menu opens a saved-text search drawer with novel/part/chapter/scene
scope, effective status, case and archived-section filters. Literal spaces and
punctuation retain their meaning. Visible mention labels are part of prose;
working notes, unsaved drafts and AI previews are not. Ancestor Trash is always
excluded, while intact archived/root-Trash/workspace-reader content stays
readable under its existing ownership.

Small pages carry actual Unicode source excerpts, stable paths and revision/hash
identities. A source change invalidates pagination and opening; the author runs
the search again. Before leaving, the current draft must flush and active
recovery/AI review stays unresolved. Opening validates the exact saved document,
reveals a view-only highlight and collapsed cursor, and preserves prose and
manual undo. Mention fragments highlight the whole atom; structural separators
navigate their boundary. Typing clears the old highlight instead of mapping it
onto unrelated text. Scope changes retire late responses and scroll callbacks.

[The search checkpoint](14_status_and_roadmap.md#d2-manuscript-search-and-result-navigation--2026-10-16)
records local checks. [Reviewed replacements](#reviewed-saved-text-replacement--2026-10-16)
are installed below. Bookmarks, complete lazy tree hydration and broader
author/performance acceptance remain open.

### Implemented independent novel copy

The library and Studio review a new draft title and explicit inclusion of author
notes, Codex context, archived units and Trash. Excluding a parent excludes its
descendants. The saved-source preview supplies counts and a revision-vector
hash; any later source change requires a refreshed review. The editor must save
and resolve an active AI preview before starting the copy.

The copy keeps exact canonical prose/formatting, goals, writing settings and
immutable snapshot/version pins, while allocating fresh root, unit, reference
and block IDs. Required manuscript/POV/location/cast snapshots remain readable
and disabled when optional context is excluded. The root starts as a draft;
included archived/trashed children keep their recoverable state. A current
summary maps to the copied scene's revision 1; a stale/unpinned summary remains
unverified. Source histories, candidates and active jobs stay with the source.

The initial structure revision stores frozen source revisions, chosen options,
counts and identity maps. The details drawer reads this provenance independently
of the current source. Tree, initial checkpoints, provenance and exact receipt
commit together. Scoped request recovery and explicit Open copy survive a lost
response/reload; archived workspaces allow result recovery without a new write.
This uses existing tables and changes no project schema. Evidence and remaining
gates are in [14](14_status_and_roadmap.md#d2-novel-copy-checkpoint--2026-10-16).
Named editions/comparisons remain open. Chapter/scene copy choices are described below.

### Implemented chapter/scene copy choices

Organization saves and loads a source for explicit review, then offers a new
title, author notes/local Codex choices and, for chapter copies, archived/Trash
child selection. The reviewed unit metadata, every source scene text/metadata
head, source structure and Codex context must remain current. A changed source
requires a refreshed review; pending requests retain their original choices.

Copies keep exact rich prose, independent goals and writing settings with new
unit/block/local-reference identities. Included lifecycle states are retained.
Optional local context can be omitted while required link/POV/location/cast
snapshots remain readable and disabled; shared inherited context still applies.
Historical and current version pins of a card coexist. Source checkpoints,
candidates and jobs remain with the source. A verified scene summary maps to
revision 1; an older/unpinned summary remains unverified.

The atomic commit records reviewed choices/heads, new checkpoints and a bound
receipt. Insert-only identities reject collisions, including with another novel.
Recovery reads the original result before retrying; archived workspaces allow
reads and cannot start missing work. Current Studio writing must pass the
save/review barrier before selection changes. Personal review-note inclusion
is separately reviewed with counts and an annotation collection head. Copies
allocate fresh note/block identities and preserve resolution/source provenance;
orphaned quotes remain available without a guessed attachment.
[14](14_status_and_roadmap.md#d2-personal-annotation-integration--2026-10-16)
records evidence and remaining gates.

## Chapter and scene metadata

Recommended scene fields: title/subtitle, synopsis, author-approved summary, derived summary with source revision, status, POV, narrator/tense override, setting, cast, narrative time, revelation constraints, plot-thread tags, planned events, word goal, notes, and export/AI inclusion flags.

Chapter fields group scenes and summarize their purpose. Novel fields define defaults. Scene overrides should display whether they inherit or override those defaults. Do not require authors to fill every field before typing.

Distinguish:

- **Outline:** what the author plans to happen.
- **Summary:** what the current written scene contains.
- **Beat:** an intended moment or drafting instruction.
- **Canon fact:** an author-approved statement about the story world, with scope.
- **Research note:** outside material or inspiration, not automatically a fictional fact.

An AI-generated summary is a draft derived artifact until approved. When prose changes, mark derived summaries stale rather than quietly presenting them as current.

## Structural operations and preservation

| Operation | Required preservation/validation |
|---|---|
| Insert before/after | Exact destination, new stable identity, no accidental title renumbering |
| Move scene | Document, comments, history, Codex links and relative anchors stay with it |
| Reorder siblings | Structure CAS; atomic list update; conflict UI if the order changed remotely |
| Split scene at cursor | Preserve prose exactly, map comments/anchors, assign new identity to the new document, record lineage |
| Split chapter before scene | Reparent selected/later scenes; do not rewrite scene documents |
| Merge scenes | Preview join separator; preserve original revisions and map anchors; reject ambiguous active proposals |
| Merge chapters | Reparent scenes into destination; record structural history and restore path |
| Duplicate scene/chapter | New internal IDs; explicit choices for notes/comments/context; no live proposal reuse |
| Archive unit | Retain material outside active manuscript; explicit AI/export inclusion |
| Restore unit | Choose destination; preserve identity/history; resolve deleted-parent cases |
| Delete unit | Use trash; make affected descendants visible; no source-card deletion |
| Undo structure | Restore prior structure without erasing later unrelated prose edits |
| Bulk actions | Preview selected units and apply one operation with all-or-nothing semantics where dependencies require it |

Provide drag-and-drop and menu/keyboard alternatives. Dragging is a convenience, not the only way to organize a manuscript. A chapter rail needs create/select/reorder/duplicate/archive controls, plus a clear current scene and recoverable trash.

## Views over one model

- **Outline:** hierarchy, synopsis, status, POV, target and actual count.
- **Board:** cards organized by chapter/part, using the same structure and actions.
- **Timeline:** story time and narrative order displayed separately; supports flashbacks and unknown/relative times.
- **Matrix:** characters or plot threads against scenes; helps find absent threads and crowded sequences.
- **Write:** scene, chapter, selected range, or continuous-manuscript reading view.
- **Review:** comments, issues, revision comparisons and proposed changesets.

A board, matrix, and timeline must not create separate copies of content. Position/layout preferences belong to the view; structure and narrative metadata belong to the novel. Plottr's linked timeline/cards provide a planning reference. [Timeline documentation](https://docs.plottr.com/article/54-timeline-overview)

## Chronology and knowledge example

Suppose Chapter 1 contains a present-day scene, Chapter 2 a flashback, and Chapter 3 a revelation that Mira's mentor is alive. Reordering chapters changes reading order but may not change the dates of the events. A continuation from the flashback should use Mira's knowledge at that time. A critique of the whole novel may intentionally inspect future revelations.

The request should state its temporal policy: knowledge available at this scene, full-author knowledge for analysis, or a deliberately chosen alternate branch. Derived character knowledge and summaries depend on both content revisions and relevant structure/timeline revisions. Novelcrafter's progressions provide a useful location-scoped precedent. [Progressions](https://www.novelcrafter.com/help/docs/codex/progressions-additions)

### Editable writing templates — 2026-10-16

The creation dialog offers short-story, three-act and custom starter outlines.
Authors can edit the template name, parts, chapters and scenes; add/remove/move
items; change a chapter's part; and set independent goals, workflow status,
planned synopsis, notes, narrator/tense overrides and inclusion flags. Removing
a part retains its chapters as ungrouped; a chapter and scene are always kept.
An immediate removal can be undone. Replacing an edited template requires a
review, retaining the novel title, description and selected source.

Language, genre, audience, narrator, tense and style guide initialize the new
novel's existing metadata. Every scene begins with an independent empty canonical
document and checkpoint. Planning text does not become manuscript prose.
Templates contain no stored manuscript/reference identities, written summaries,
history or tombstones. Their exact edited contents and key/version/name remain
frozen in the original creation receipt; recovery uses that intent even after
later preset edits. Source-card context remains compatible with the same create
transaction. This adds no separate template catalog or schema and does not
close D2's remaining catalog/author/performance gates.

### Outline and insertion checkpoint — 2026-10-16

The docked and narrow-drawer outline now supports compact/detailed views,
active reading-order numbering, independent goals, scoped POV/location/cast,
workflow/inclusion flags, and separately labelled planned synopsis and written
summary. Current/earlier/unverified source pins stay explicit. Archived rows
remain readable without active ordinals; Trash ancestry stays hidden. View
preferences are scoped separately from selection and never rename manuscript
items. Full large-project and assistive-technology acceptance remains open.

Creation reviews the new title and exact active container plus before/after
anchor. The server resolves `afterId` from the selected stable identity under
the structure CAS. A stale/missing anchor rejects instead of appending or using
its former neighbour. Stored receipts replay their original placement result.
See [current evidence](14_status_and_roadmap.md#d2-outline-and-exact-insertion--2026-10-16).

### Compound preservation checkpoint — 2026-10-16

Chapter reparenting preserves existing inherited author choices with visible
chapter overrides, without rewriting every scene. Unset optional fields retain
normal inheritance from the new parent. Scene restoration into a different
active chapter carries source Codex pins and remaps mentions/anchors atomically.
The drawer reviews the selected restore destination, including when the old
parent remains in Trash. A split fragment retains its source summary text as
unverified. Nested-list/Unicode/mark/link/mention, note, context and multi-step
history behavior now has actual isolated MySQL evidence in
[14](14_status_and_roadmap.md#d2-compound-structure-preservation--2026-10-16).
This does not close remaining catalog features or broader acceptance gates.

## Author-owned series and Codex inheritance

Use visible, versioned inheritance: series defaults → novel defaults/overrides → scene-specific facts. Keep the novel's selected source-card versions and story-local edits. A changed series entry should offer an update review and impact list; it must not automatically change previous manuscripts, accepted AI context records, or exports.

A series bible reuses canon across the same author's novels. Every retrieval still checks workspace/resource authorization. Cross-author sharing and team ownership are out of scope. Whether the author's own series can span workspaces is an open product/ownership decision, not implied by this model.

## Migration and acceptance

Follow the [development data policy in 15](15_database_migration_and_legacy_cleanup.md#development-data-policy): preserve recovered non-novel records and current novels. Whole-database resets are disabled. The historical transition already removed the chapter-body writer; future schema changes require a verified backup and scoped preservation checks. Use new isolated synthetic databases for destructive test fixtures.

Chapter POV/location/status remain grouping defaults and the first scene can inherit them. A chapter goal is not copied to every scene. Chapter-scoped refs are inherited; novel refs stay novel-scoped. IDs remain stable during ordinary product moves/restores, and copied units receive new identities. Application trash/restore retains current content/history.

Use current schema verification and an isolated novel save/reopen/action smoke for relevant changes. Add focused tests for split/merge/reorder/trash when implementing those features, plus preservation/rehearsal checks when changing existing storage.

The broader structure, chronology, branching and export acceptance belongs to the feature slice that implements it. See [11](11_refactor_and_migration_plan.md) and [12](12_validation_and_acceptance.md).

## Implemented saved-reference inspection — 2026-10-16

Alt+Enter or More → Inspect references reads the exact saved IDs at the cursor or in a passage. Detected names/aliases offer all matching sources instead of choosing the first; source rows disclose type, scope, description, provenance, version and enabled/excluded/removed/overridden status. Autocomplete searches those details and preserves context exclusion when a mention is inserted. Readers can focus the manuscript and inspect retained pins; missing identities remain unavailable rather than relinking by label. Explicit context changes retain revision/workspace/review guards and never edit manuscript text. See [14](14_status_and_roadmap.md#d2-saved-reference-inspection--2026-10-16) for evidence and remaining work.

## Implemented manuscript block movement — 2026-10-16

Alt+Shift+Up/Down moves whole sibling blocks touched by the selection, including endpoint blocks. More → Move blocks reviews the exact range and provides click up/down or before/after a selected sibling. Within lists, whole items carry their nested content; NodeSelection can move a complete container. Moves stay within the current container and preserve canonical IDs, rich nodes, list starts, selection direction and independent undo/redo. Applying returns focus to the moved passage unless newer input intervenes.

Readers, recovery, active AI, changed documents/selections and foreign destinations cannot commit. Notes inside unchanged blocks follow their identities; cross-boundary notes retain text/quote for review, and exact document undo can recover their last attachment without overwriting later note content or resolution. The review explains this behavior. Native tests exposed and corrected a neutral ordered-list attribute and automatic trailing paragraphs at the canonical editor boundary. See [14](14_status_and_roadmap.md#d2-manuscript-block-movement--2026-10-16).


## Implemented unit tags and planned beats — 2026-10-16

Parts, chapters and scenes now store optional `tags` and ordered `plannedBeats` in their existing independent metadata revision. Plans retain exact multiline author text, repeated entries and order; they do not add prose, written-summary source revisions, word counts or inheritance defaults. The details form and identity-free templates provide tags and beat add/edit/reorder/removal with immediate removal undo. Reader forms disable writes; movement returns focus to the moved beat.

Each list permits 100 entries; tags permit 255 Unicode codepoints per entry and beats 2,000. Empty/whitespace-only entries cannot save; all unit details share the existing 100,000-byte UTF-8 JSON limit. Invalid unfinished drafts remain recoverable. Field comparison/rebase, exact receipts, copies, immutable snapshots and reviewed restoration use the existing metadata contract. Library metadata queries search unit tags and full beats; the root tag filter keeps its existing novel-only meaning. Current inline generation does not automatically add these author plans to its prompt; grounded assisted planning remains D3.

No schema migration, project database test write or file/record cleanup is required. See [14](14_status_and_roadmap.md#d2-unit-tags-and-planned-beats--2026-10-16) for validation and remaining gates.


## Saved continuous manuscript reader — 2026-10-16

Studio’s More menu opens **Read manuscript** in the shared drawer while the writing editor stays mounted. Novel, part, chapter and scene scopes follow the same ungrouped/part/chapter/scene order as the organization model. Archived sections are optional; any section under Trash stays excluded. An archived root/workspace remains a reader. Empty owned containers are valid empty scopes. Reading does not apply AI/export inclusion flags.

The endpoint reads the owned metadata index and at most five requested scene documents in one consistent transaction; the UI requests two at a time and retains three bidirectional batches. Forward/backward scrolling or explicit load controls rehydrate nearby saved text while distant batches leave the DOM. Automatic loading protects the currently visible passage, and DOM changes restore its canonical paragraph position. Canonical JSON preserves formatting, list starts, links, scene breaks and exact mention IDs. Planning beat instructions are omitted from displayed prose. Reference inspection uses the exact retained snapshot ID and matching context version, with no context-write controls or equal-name substitution.

The source snapshot binds ownership, workspace lifecycle, all organization/metadata heads and scene revisions/hashes. A changed source refuses continuation with 409; old loaded pages remain visible until explicit refresh. Scope and archive choices use a separate bounded device record under the existing account/API/workspace/novel view key. Reading appearance reuses the existing preferences and tokens. Writing positions, drafts, review and undo remain in their original editor instance.

Opening a scene from the reader requires the existing authentication/save/review barrier, another source-bound target read and a full owned cache refresh. Exact selected-scene and parent/root heads must match; closed/switched readers and newer editor documents retire the handoff. Read projections never clear cached pins, history or author metadata.

Reader position uses a separate bounded device record: scope, stable scene/block identity, document hash and paragraph/layout metrics. Reopening seeks the saved scene directly and restores only a verified matching document. Layout changes scale within that paragraph. Changed scenes retain the previous record until the author continues; missing/out-of-scope/Trash targets remain explicit and offer another scope or a fresh beginning. No prose is stored in the position record, and it cannot change writing selections or undo history.

The existing initial Studio full-tree loader and broader large-project/device/accessibility acceptance remain open. The reader's active window is bounded; the full Studio cache still loads all current scene bodies. This implementation is not a frozen named edition or an export. See the [latest delivery evidence](14_status_and_roadmap.md#d2-bounded-reader-and-position-resume--2026-10-16).

## Reviewed saved-text replacement — 2026-10-16

Search manuscript can select up to 100 loaded matches within its current filters. Literal replacement accepts exact whitespace/newlines or an empty deletion. Review displays each saved original and proposed rich fragment before explicit application. Changed selection, text or filters require a new review. Match quotes and offsets come from native saved search; case-insensitive expansions use their actual quote, never a new client-side text search.

Block/container IDs, untouched formatting, links, reference atoms and list starts remain. The new text inherits the formatting common to its removed characters. A match through a reference atom or spanning a block separator is explicitly protected rather than restructuring or relinking a manuscript. Read-only targets, unresolved AI proposals and size/work bounds are visible blockers; a selected blocked occurrence prevents the entire application. Authors remove blocked matches and review again.

One transaction applies all reviewed scene edits as new checkpoints. Existing note bodies/resolution, metadata, goals and Codex pins are retained; removed note passages keep their last verified attachment for personal review. Recent replacements expose explicit undo/redo reviews bound to the original receipt and exact current document hashes. Later prose can block reversal; later metadata/note edits remain independent. Uncertain results stay recoverable outside the drawer until the confirmed owned scenes load. No schema change is required. See [the delivery checkpoint](14_status_and_roadmap.md#d2-reviewed-manuscript-replacements--2026-10-16).

## Installed personal bookmarks

The saved writer selection/cursor or visible saved-reader paragraph can seed a
labelled bookmark. The existing flush/review gate binds the exact canonical
checkpoint, including an empty paragraph. Separate note/bookmark lists offer
label editing, Trash/restore and reviewed reattachment. Opening verifies the
owned stable anchor before moving the writer cursor; detached or changed
locations retain evidence. Device draft/receipt recovery, independent copy
choices and frozen snapshot review are connected. [17](17_annotation_anchors_and_personal_review.md#prepared-bookmark-extension--2026-10-16)
records point/lineage rules. Broader D2 acceptance remains open.
