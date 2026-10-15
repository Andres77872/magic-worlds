# Competitive landscape and similar projects

**Documentation review:** 2026-10-14. **Status:** Dated research reference — preserved vendor descriptions; external capabilities were not refreshed by this documentation update. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

Original research snapshot: 2026-10-14. Comparisons below preserve the dossier's official product descriptions and architectural patterns; this documentation update did not recheck external pages. They are not hands-on rankings, plan availability guarantees, or evidence that a product writes better prose. Adoption guidance is this dossier's recommendation. Reverify current compatibility, availability, license and cost before selecting an external tool.

The target is a single-author editor with AI. Any collaborative vendor capabilities mentioned below are market context only and are excluded from the proposed product scope.

## Fiction-focused products

| Product | Verified capabilities relevant to this task | Pattern to adapt |
|---|---|---|
| Novelcrafter | Separate Plan, Write, Chat, and Review surfaces; Codex integration, scene metadata, full-manuscript view, prompt preview | One manuscript and story model shared across specialized work modes. [Features](https://www.novelcrafter.com/features), [Write interface](https://www.novelcrafter.com/help/docs/write/the-write-interface) |
| Sudowrite | Story-aware chat can discuss or edit; larger changes receive a reviewable plan; Story Bible supplies structured context | Separate asking from proposing edits; connect conversational assistance to the manuscript and planning model. [Chat](https://feedback.sudowrite.com/en/help/articles/1016913-chat), [Story Bible](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC) |
| NovelAI | Explicit inline generation location, editor actions, configurable context and a context viewer | Cursor-aware generation and inspectable context composition. [Editor](https://docs.novelai.net/en/text/editor/), [Advanced settings](https://docs.novelai.net/en/text/editor/advancedsettings/) |
| LivingWriter | Manuscript chat, outlines, rewrite, summarization, analysis, planning/research boards, goals, comments and stash | A connected writing workspace, with research and planning adjacent to prose. Vendor quality and language claims are not independently validated here. [Official product](https://livingwriter.com/) |
| Campfire | Manuscript index-card organization, connected notes, chapter version history and manuscript/chapter goals | Keep notes out of prose statistics and support both text and structural views. [Manuscript tutorial](https://campfirewriting.com/learn/manuscript-tutorial), [Manuscript update](https://campfirewriting.com/learn/update37) |
| Scrivener | Piecewise drafting, Scrivenings, customizable composition mode, snapshots/comparison, autosave and backups | Structured writing units that compile into a book, with a dependable revision safety net. [Overview](https://www.literatureandlatte.com/scrivener/overview) |
| Reedsy Studio | Comments and tracked changes, reader previews, EPUB/PDF output; its multi-user editing is outside this target | Adapt author review, manuscript preview, and file-based production workflows. [Studio](https://reedsy.com/studio/), [Formatting/export](https://reedsy.com/studio/format-a-book/) |
| Plottr | Visual chapter/plotline timeline, linked scene cards, characters/places/tags, series bible | Alternate planning views over shared story data. It is a planning reference, not evidence that an embedded prose editor is needed for every board. [Timeline](https://docs.plottr.com/article/54-timeline-overview), [Scene cards](https://docs.plottr.com/article/57-timeline-scene-cards) |

## Deep comparisons by job

### Organize a novel without losing the draft

Novelcrafter documents insert-before/after, moving acts/chapters/scenes, scene duplication, splitting, and merging. It also supplies menu operations alongside dragging, including for mobile. The relevant lesson is reversible structure editing with a non-drag alternative. [Organization](https://www.novelcrafter.com/help/docs/plan/organizing-scenes-chapters-acts)

Recommendation for Reverie: one structure tree powers the outline, board, writing order, and export. Structural operations preserve scene identity and references. Reordering must not rewrite chapter titles or delete content. See [04](04_novel_chapter_and_scene_management.md).

### Revise prose while understanding the change

Sudowrite Quick Edit shows the original passage alongside the proposed replacement and offers acceptance, rejection, and refinement. [Quick Edit](https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/quick-tools/2asL35fds36oHAFJN7bYzz)

Recommendation: provide inline and side-by-side review, single-change and whole-request acceptance, persistent rejected alternatives, and one undoable commit. Changes to multiple scenes should appear as a changeset with per-scene navigation, not a long chat reply requiring manual copying.

### Recover earlier work

Novelcrafter documents restorable scene-content, summary, and Codex history, plus an archive/restore workflow for scenes. [Revision history](https://www.novelcrafter.com/help/docs/organization/revision-history), [Scene archive](https://www.novelcrafter.com/help/docs/organization/archiving-restoring-scenes)

Recommendation: distinguish session undo, durable revisions, deleted-content recovery, local draft recovery, and operational backups. Each solves a different failure. The current generated-output drawer covers only one part of this space.

### Maintain changing story facts

Novelcrafter's progressions change Codex information at defined manuscript locations; its tracking material demonstrates character-arc use. [Progressions](https://www.novelcrafter.com/help/docs/codex/progressions-additions), [Character arcs](https://www.novelcrafter.com/courses/codex-cookbook/tracking-character-arcs)

Recommendation: story facts need source passages, temporal scope, and knowledge/revelation rules. A character's current relationship or injuries should not automatically overwrite facts for earlier scenes. Reusing canon across the same author's series needs explicit inheritance and novel-local overrides.

### Understand an AI request

Novelcrafter provides prompt preview. [Prompt preview](https://www.novelcrafter.com/help/docs/prompts/prompt-preview)

Recommendation: show a concise context summary before running and an optional detailed view of included sources, exclusions, revisions, and limits. A trace from a previous request cannot certify what a changed draft will send next.

## Similar open-source/editor projects

| Project | Verified role | Fit for Reverie and research action |
|---|---|---|
| steven-tey/novel | A TipTap-based Notion-style WYSIWYG editor with AI autocompletion | Reference for interaction patterns. It is not a novel-management, canon, recovery, or publishing backend. Its component stack should not replace Reverie primitives. [Repository](https://github.com/steven-tey/novel) |
| novelWriter | Plain-text novel tool with chapter/scene organization, project/outline views, notes and manuscript building | Useful reference for portable source and separating working structure from output compilation. [Features](https://novelwriter.io/features.html), [Chapters/scenes](https://novelwriter.io/docs/usage/chapters_and_scenes.html) |
| BlockNote | Block editing with AI commands and review controls | Reference or prototype candidate if block manipulation is central. A switch entails schema, UI, and extension migration; verify current licenses and backend integration. [AI editing](https://www.blocknotejs.org/docs/features/ai), [API reference](https://www.blocknotejs.org/docs/features/ai/reference) |
| TipTap AI Toolkit | Document reading/editing tools, streaming integrations, suggestions and feedback APIs | Evaluate the client toolkit behind an adapter. Keep application authority, BFF ownership, profiles, and domain validation. Verify license, maturity, and custom-node support before adoption. [Client toolkit](https://tiptap.dev/docs/ai/ai-toolkit/client/overview), [Suggestions](https://tiptap.dev/docs/ai/ai-toolkit/client/api-reference/suggestions) |

## What to improve, rework, and retain

| Action | Area | Rationale |
|---|---|---|
| Retain | React contexts, hand-rolled routing, API boundary, workspace scope, profile system | Existing app architecture and policy remain applicable |
| Retain and harden | TipTap, selection actions, focus/typewriter modes, Codex snapshots | Working domain-specific foundation with useful coverage |
| Rework | Save acknowledgement and revision contracts | Needed for author trust, multiple tabs, and AI application |
| Rework | Suggestion insertion/history ownership | Fix undo and permit granular changesets |
| Rework | Markdown as the sole identity-bearing document | Stable references and annotation fidelity need structured persistence |
| Extend | Novel/chapter/scene model and operations | Long-form work requires safe structure manipulation |
| Extend | Unified assistant infrastructure | Add novel scope, context, tools, and reviewable proposals |
| Add | Manuscript revisions, local recovery, archive/trash | Current generated-output history is insufficient |
| Add | Review mode and continuity evidence | Feedback must remain attached and actionable |
| Add | Import/export and compiler | Writers need portable manuscripts and editorial delivery |
| Prototype then decide | Advanced planning boards and paid editor add-ons | Integration, single-author review UX and licensing evidence needed |

The adoption criterion is whether a capability helps an author complete a real writing task with preserved work and control. A longer command list or a general-purpose block workspace is not a success metric. The full target remains in [05](05_feature_catalog.md); [11](11_refactor_and_migration_plan.md) sequences it.
