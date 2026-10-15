# Novel, chapter, and scene management

**Documentation review:** 2026-10-14. **Status:** WIP / planned D2–D6 — target hierarchy and operations; independent scenes, parts, and series are not current entities. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

## Recommended hierarchy

**Current baseline:** [StoryChapter](../../src/shared/types/story.types.ts) owns one Markdown `body`, `order`, `status`, `wordGoal`, and POV/location IDs. [NovelChapterRail](../../src/features/novel/components/NovelChapterRail.tsx) supports selecting, creating, and confirmed deletion; the chapter title field in [NovelStudio](../../src/features/novel/components/NovelStudio.tsx) renames the chapter. Chapter order/status/POV/location fields in the DTO and BFF do not imply an atomic structure API or complete metadata UI. The current editor's horizontal rule is a scene-break mark inside the chapter, rather than an independently stored scene. Reorder, split/merge, duplicate, restore, parts, scene documents, and series below remain target work.

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

The present model has Chapter.body and no distinct scenes. Migrate each legacy chapter into a chapter containing one preserved scene. Do not guess scene boundaries from blank lines or horizontal rules during an automatic migration. Offer a later split preview for author review.

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
| Metadata | Title, description, language, genre, audience, synopsis, style guide, goal; metadata errors do not block prose recovery |
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

## Author-owned series and Codex inheritance

Use visible, versioned inheritance: series defaults → novel defaults/overrides → scene-specific facts. Keep the novel's selected source-card versions and story-local edits. A changed series entry should offer an update review and impact list; it must not automatically change previous manuscripts, accepted AI context records, or exports.

A series bible reuses canon across the same author's novels. Every retrieval still checks workspace/resource authorization. Cross-author sharing and team ownership are out of scope. Whether the author's own series can span workspaces is an open product/ownership decision, not implied by this model.

## Migration and acceptance

Retain legacy chapter IDs for compatibility. Assign one initial scene/document per chapter, keep raw Markdown, and preserve generation history bindings. Introduce structure revisions and new read DTOs before the UI relies on them. Only add more scenes through deterministic or reviewed operations.

Acceptance: reorder a 30-chapter manuscript, split/merge a formatted scene, restore a deleted scene, move a flashback, fork a draft, and compile an export without losing text, references, comments, or history. Verify narrative-time context and character knowledge after each operation. Detailed gates are in [11](11_refactor_and_migration_plan.md) and [12](12_validation_and_acceptance.md).
