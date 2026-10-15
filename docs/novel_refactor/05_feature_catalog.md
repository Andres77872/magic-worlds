# Complete target feature catalog

**Documentation review:** 2026-10-14. **Status:** WIP target catalog — baseline coverage is source presence, not release completion. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

This is the proposed full capability inventory for a novel-writing editor powered by AI. It is a product target, not an implementation checklist already completed. **Present** means a current basic implementation exists behind the novels flag, rather than shipped or fully validated; **Partial** means some infrastructure or a limited variant exists; **Gap** means the reviewed novel feature lacks the capability; **Unverified** needs live checking. Every row remains within the overall **WIP** feature status until its applicable acceptance gate is met. Exact availability and phase status are in [14](14_status_and_roadmap.md).

The target is one author working with AI. Multi-user editing, presence, invitations, team permissions, shared review access, and collaborative synchronization are out of scope. Personal annotations, reviewed AI changes, offline recovery, and conflict handling across the author's own tabs/devices remain in scope. Capability IDs are stable; gaps in numbering mark removed scope rather than missing requirements.

Delivery sequence: **D1** reliable editor/persistence; **D2** novel and scene organization; **D3** grounded assistant; **D4** planning, continuity and personal editorial review; **D5** portability, production and productivity; **D6** author-owned series and advanced extension. Each phase includes accessibility, internationalization, failure recovery, and appropriate validation. Phase placement is a recommendation and later phases remain part of the target.

The market evidence is in [02](02_competitive_landscape.md), research in [03](03_ai_writing_state_of_the_art.md), implementation baseline in [01](01_current_state_and_evidence.md), and detailed contracts in [04](04_novel_chapter_and_scene_management.md), [06](06_ui_ux_and_accessibility.md), [08](08_ai_assistant_context_and_tools.md), and [09](09_persistence_revisions_and_recovery.md).

## Novel and library management

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| N01 | Create blank novel and start typing without mandatory planning | Present | D1 |
| N02 | Create from selected cards, setting, or approved adventure material with provenance | Partial | D2 |
| N03 | Edit title, synopsis, genre, language, audience, description, cover, and default POV/tense | Partial | D2 |
| N04 | Duplicate/fork a novel into an independent draft with remapped references | Gap | D2 |
| N05 | Named draft/edition branches and comparisons | Gap | D4 |
| N06 | Archive and restore a novel independently from workspace lifecycle | Gap | D2 |
| N07 | Recoverable novel trash and explicit permanent erase | Gap | D1–D2 |
| N08 | Search/filter/sort by title, content, status, metadata, and recent activity | Partial | D2 |
| N09 | Lightweight gallery summaries and cached aggregate statistics | Partial | D2 |
| N10 | Resume last scene, position, and panel state | Partial | D2 |
| N11 | Writing templates with editable structure and style defaults | Gap | D2 |
| N12 | Whole-novel goal, deadline and progress dashboard | Partial | D5 |
| N13 | Author-owned series membership, versioned series canon, and novel overrides | Gap | D6 |
| N14 | Export/import complete project backup, including history/notes options | Gap | D5 |
| N15 | Novel-specific style guide and preferred examples | Gap | D3 |
| N16 | Workspace-scoped permissions, origin retention, and archived behavior | Present | D1 |

## Parts, chapters, scenes, and planning

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| S01 | Select/add/rename chapters with visible save results | Partial | D1–D2 |
| S02 | Optional parts/acts and independently identified scenes | Gap | D2 |
| S03 | Insert before/after the selected unit | Gap | D2 |
| S04 | Reorder/move with drag, menu, and keyboard alternatives | Gap | D2 |
| S05 | Duplicate scene/chapter with explicit copy options | Gap | D2 |
| S06 | Split scene at cursor and chapter at scene boundary | Gap | D2 |
| S07 | Merge scenes/chapters with exact-text preview and recovery | Gap | D2 |
| S08 | Archive/trash/restore structure units without deleting source cards | Partial | D1–D2 |
| S09 | Metadata: POV, setting, cast, narrative time, tags, status | Partial | D2 |
| S10 | Scene synopsis, planned beats, written summary and separate notes | Partial | D2–D3 |
| S11 | Derived numbering, inheritance, and export/AI inclusion flags | Gap | D2 |
| S12 | Outline view with summaries, goals, status and cast | Gap | D2 |
| S13 | Board view over the same scene model | Gap | D4 |
| S14 | Timeline with story time distinct from reading order | Gap | D4 |
| S15 | Plot-thread/character matrix and appearance navigation | Gap | D4 |
| S16 | Scene/chapter/whole-manuscript reading and selected-unit editing | Partial | D2–D4 |
| S17 | Whole-manuscript search, scoped replacement preview, filters and bookmarks | Partial | D2–D4 |
| S18 | Outline import/generation produces reviewable structure operations | Gap | D3 |
| S19 | Scene/chapter word goals and status transitions | Partial | D2 |
| S20 | Reversible bulk structure actions with conflict checks | Gap | D4 |

## Core text editing

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| E01 | Fast caret, selection, paragraph, line-break, cut/copy/paste behavior | Present | D1 |
| E02 | Predictable undo/redo for manual edits, AI commits, and replacement | Partial | D1 |
| E03 | Bold, italic, strike, headings, lists, quotes, scene breaks | Present | D1 |
| E04 | Links and safe pasted references without silent URL loss | Gap | D1–D2 |
| E05 | Formatting clear/reset and accessible active-state toolbar | Partial | D1 |
| E06 | Plain-text paste and validated rich paste/import | Partial | D1–D5 |
| E07 | Find next/previous, case options, replacement and atomic replace-all | Partial | D1 |
| E08 | Unicode-safe offsets, searching, segmentation and selection | Partial | D1 |
| E09 | Configurable browser spelling plus reviewed grammar/style assistance | Unverified/Gap | D1–D3 |
| E10 | Smart typography that respects language and author preference | Partial | D2 |
| E11 | Reading presets for font, size, spacing, width and contrast | Partial | D2 |
| E12 | Focus and typewriter modes without disruptive forced scrolling | Present | D1 |
| E13 | Persistent word/character/read-time counts based on prose | Partial | D1–D5 |
| E14 | Stable references/mentions with disambiguation and keyboard opening | Partial | D1–D2 |
| E15 | Footnotes/endnotes, images/captions, tables for applicable manuscripts | Gap | D5 |
| E16 | Section/page-break intent separated from live pagination | Partial | D5 |
| E17 | Paragraph/block movement with preserved anchors and identity | Gap | D2 |
| E18 | Highlighting, bookmarks, inline notes, and invisible-character option | Gap | D4–D5 |
| E19 | IME, dictation input, RTL/bidirectional and language-aware editing | Unverified | D1–D5 |
| E20 | Optional source view with synchronized revision and conversion report | Gap | D5 |

## Saving, revision, and editorial review

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| R01 | Ordered autosave with truthful local/server acknowledgement | Partial | D1 |
| R02 | Durable local draft and interrupted-session recovery | Gap | D1 |
| R03 | Multi-tab conflict detection and recovery comparison | Gap | D1 |
| R04 | Automatic checkpoints and named manuscript snapshots | Gap | D1–D2 |
| R05 | Browse, compare, copy from, and restore earlier revisions | Gap | D2 |
| R06 | Original/proposed diff for every AI replacement | Partial | D1–D3 |
| R07 | Accept/reject selected changes, whole request, and reviewed batches | Partial | D3 |
| R08 | Personal and AI review notes with revision-bound anchors, resolve/reopen and orphan handling | Gap | D4 |
| R10 | Revision tasks/issues linked to passages and their resolutions | Gap | D4 |
| R11 | Alternative takes and cut-text stash remain searchable/reusable | Partial | D3–D4 |
| R12 | Durable AI/manual provenance with accepted revision lineage | Partial | D3 |
| R13 | Offline editing of cached documents with a visible pending-sync state | Gap | D1–D5 |
| R14 | Restore/undo changesets without overwriting later unrelated edits | Gap | D3–D4 |
| R15 | Reconcile the author's offline edits against newer server revisions with a reviewed merge or retained copy | Gap | D1–D5 |

## AI drafting and editing

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| A01 | Continue here and continue ending as explicit, correctly grounded actions | Partial | D1–D3 |
| A02 | Rewrite selection with requested purpose and preserved constraints | Partial | D1–D3 |
| A03 | Expand/condense passage with visible length target | Present | D3 |
| A04 | Describe sensory detail from selected context | Present | D3 |
| A05 | Draft a beat/scene from plan and authorized story state | Partial | D3 |
| A06 | Bridge two passages while respecting both boundaries | Gap | D3 |
| A07 | Dialogue assistance using speaker voice and current knowledge | Gap | D3 |
| A08 | POV, tense, narrative distance and voice transformation with diff | Gap | D3 |
| A09 | Grammar, clarity, repetition, rhythm and word-choice suggestions | Gap | D3 |
| A10 | Translation/localization with preserved references and reviewed prose | Gap | D5 |
| A11 | Multiple takes with comparison, stash, and explicit insertion | Partial | D3 |
| A12 | Premise, conflict, stakes, names, and what-if brainstorming | Gap | D3 |
| A13 | Outline, synopsis, beats and chapter-planning assistance | Gap | D3 |
| A14 | Scene/chapter/book summaries tied to source revision | Gap | D3 |
| A15 | Developmental critique: pacing, causality, scene purpose and exposition | Partial | D4 |
| A16 | Continuity checks with cited evidence and uncertainty | Gap | D4 |
| A17 | Propose and review cross-scene edits or structural changes | Gap | D4 |
| A18 | Extract proposed character/world/canon facts without silent promotion | Gap | D3–D4 |
| A19 | Custom prompt presets with validated inputs and versioned profile selection | Partial | D3 |
| A20 | Explicit context preview, token/output limits and request provenance | Partial | D1–D3 |
| A21 | Stop, recover/retry same request, resume jobs, and avoid duplicate charging | Partial | D1–D3 |
| A22 | Story-aware chat with citations, selection handoff and conversation history | Gap | D3 |
| A23 | Ask / suggest edits modes; authorized application through one commit flow | Gap | D3 |
| A24 | Bounded multi-step plans with progress and per-scene change review | Gap | D4 |
| A25 | Assistant personalization distinct from manuscript style | Gap | D3 |
| A26 | Blurb, synopsis, title and editorial handoff assistance | Gap | D5 |
| A27 | Optional completion suggestions with explicit request/enablement | Gap | D5 |
| A28 | Approved external research with source provenance and scope controls | Gap | D4–D5 |

## Codex, memory, and continuity

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| K01 | Story-local snapshots of characters, worlds, items and lore | Present | D1 |
| K02 | Stable labels/aliases and duplicate-name disambiguation | Partial | D1–D2 |
| K03 | Per-scene/story context scope, enable/exclude and priority | Partial | D2–D3 |
| K04 | Evidence-linked fact extraction and explicit approve-to-canon | Gap | D3 |
| K05 | Scene/time-scoped progressions and character knowledge | Gap | D4 |
| K06 | Relationship/possession/location state across events | Gap | D4 |
| K07 | Whole-novel appearance lists, matrix, and navigation to passages | Partial | D4 |
| K08 | Style/voice sheets and character dialogue traits | Gap | D3 |
| K09 | Summaries and retrieval indexes with dependency invalidation | Gap | D3 |
| K10 | Context inspection with inclusion, exclusion, token and revision evidence | Partial | D1–D3 |
| K11 | Import/link library updates through an impact review | Partial | D4 |
| K12 | Approved story discoveries staged back to cards/lorebooks | Gap | D4 |
| K13 | Canon inheritance across the author's own series with selected versions and local overrides | Gap | D6 |
| K14 | Conflict resolution between prose, plan, canon and external research | Gap | D4 |

## UI, productivity, and accessibility

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| U01 | Quiet Write mode and separate Plan/Review surfaces | Partial | D2–D4 |
| U02 | Shared contextual inspector for Assistant/Codex/Context/Review | Partial | D3 |
| U03 | Progressive disclosure, command palette and shortcut help | Partial | D2–D3 |
| U04 | Responsive layout with accessible drawers and visible prose | Partial | D1–D3 |
| U05 | Full keyboard operation, focus return, labels and announcements | Partial | D1 |
| U06 | Contrast, zoom/reflow, touch, reduced-motion and screen-reader validation | Partial | D1 |
| U07 | Novel/scene/session goals, optional streaks and deadline tracking | Partial | D5 |
| U08 | Lightweight writing-session statistics and task list | Gap | D5 |
| U09 | Optional read-aloud proofreading using existing voice/media infrastructure | Gap | D5 |
| U10 | Optional speech-to-text entry without auto-accepting AI proposals | Gap | D5 |
| U11 | Onboarding examples and discoverable empty states with immediate writing | Partial | D2 |
| U12 | Observable loading, outage, quota, save/conflict and cancellation states | Partial | D1–D3 |
| U13 | Extensible prompt/tool presets and integrations with capability allowlists | Gap | D6 |

## Portability, publishing, and media

| ID | Capability and expected outcome | Baseline | Phase |
|---|---|---|---|
| X01 | Plain-text/Markdown import with structure and conversion preview | Gap | D5 |
| X02 | DOCX import with support/loss report and safe parsing | Gap | D5 |
| X03 | Whole manuscript DOCX/plain-text/Markdown export | Gap | D5 |
| X04 | EPUB export with navigation, language and semantic validation | Gap | D5 |
| X05 | Print/PDF compilation with separately chosen page/layout rules | Gap | D5 |
| X06 | Front/back matter, TOC, glossary and section inclusion | Gap | D5 |
| X07 | Export personal review notes, reviewed AI change annotations, and style sheet as explicit file options | Gap | D5 |
| X08 | Versioned project package with media/reference manifest | Gap | D5 |
| X09 | Cover/illustration generation or selection through existing media jobs | Gap | D5 |
| X10 | Export logs, progress, retry, owned downloads and content-hash verification | Gap | D5 |
| X12 | Optional publication handoff; explicit destination and publish action | Gap | D6 |

## Completeness rules

Each row must eventually have an owner, an acceptance scenario, and a deliberate implementation or product decision. Dependencies can change phase placement. Coverage must never be inferred from a toolbar label, backend DTO field, generic app capability, or an AI model's theoretical ability.

The catalog is broad enough to define a full authoring product. Domain variants such as screenplay conversion or academic citations can be optional extensions; they should not displace novel workflows. Story-specific constraints, author voice, accessible ordinary editing, and recoverable work are mandatory across the complete target.
