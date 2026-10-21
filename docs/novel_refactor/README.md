# Novel refactor — WIP status, research, and roadmap

**Source/lifecycle review:** 2026-10-15, America/Mexico_City. **Research cutoff:** 2026-10-14.\
**UI/UX plan update:** 2026-10-15, informed by the standalone demo and selected official accessibility/human–AI guidance.\
**Database preservation correction:** 2026-10-16. The user required recovery of all non-novel content after the project-wide resets. That recovery is complete. Preserve the recovered data and current novels during all remaining work; whole-database resets are disabled. [15](15_database_migration_and_legacy_cleanup.md) records the recovery and scoped schema-change procedure.\
**Reuse/overlap review:** 2026-10-16. [07](07_target_architecture.md#reuse-and-overlap-decisions) maps existing code to extensions/new work, records two duplicated Codex helpers and coordinates ownership with the main-assistant plan. NE-020 now distinguishes already-persisted execution instructions from missing safe history exposure and edit lineage.\
**Status (audited 2026-10-18):** WIP. Of 136 capabilities, 53 are built and checked live, 38 are built but not checked live, 35 are partial and 10 are gaps. D1–D2 are installed, the D3 assistant runs, D4 slices 1–19 and D5 slices 1–16 run, and D6 has not started. No row has passed release acceptance. Novels are available only when the user's plan grants `novels`. See [14 — Actual status and roadmap](14_status_and_roadmap.md#current-progress-remaining-work-and-scope) for the per-phase picture, release gates, the prioritized next work and the decisions that wait on the owner.\
**Target:** A complete novel-writing editor with an integrated, story-aware AI assistant.

**Current progress and pending work:** [Read the audited status at the top of document 14](14_status_and_roadmap.md#current-progress-remaining-work-and-scope); the verdict for every capability is in [05 — Audit 2026-10-18](05_feature_catalog.md#audit-2026-10-18). **The full D1–D6 goal is unfinished.** The top priorities on 2026-10-18 are:

1. **P0 fixes:** done on 2026-10-20 — the novel BFF tests are green again, Ctrl/⌘+Enter opens the beat composer (live check pending), the status hints are readable. Still open: personal-key accounting after dispatch, an intermittent invalid assistant result, and export jobs that a BFF restart interrupts.
2. **Finish D1–D3:** live checks of the 38 built rows, one context and review path for inline AI and the assistant (CL-04), drafting a scene from its plan, real diffs and per-change review, takes, accessibility and production-build performance.
3. **Then** the rest of D4, D5 and D6. Branches (N05) and research (A28) wait on the owner's decisions.

The dossier contains 21 Markdown documents, a standalone HTML prototype, 136 target capabilities, 23 NE findings, 12 prioritized UI/UX work items, and 62 primary references. The references cover eight writing/planning products and four editor or open-source foundations. Findings distinguish prior controlled reproductions, source-confirmed concerns, prototype observations, target gaps, and unmeasured risks. Vendor/model research retains its 2026-10-14 cutoff. The earlier lifecycle/UI review and its test/prototype records remain dated evidence. The deep review recorded focused frontend/backend tests. Use M1–M3 scoped implementation steps, three short DEV checks and the CL-01–CL-10 removal inventory. Historical reset approval is superseded by the preservation correction above; it does not authorize another rebuild.

[14 — Status and roadmap](14_status_and_roadmap.md) is the sole delivery authority. Documents 01/10 maintain current evidence and findings; 04–09/11–12/15 are target design, migration/cleanup and acceptance; 13 records the dated product/research references, their limits, and unresolved decisions. The June 2026 storytelling brief was consolidated into this dossier on 2026-10-15; its retained writing requirements are folded into the catalog and design documents, with the clarified contracts in 06–08 and their acceptance checks in 12. All 136 novel capabilities and D1–D6 remain; no NE finding, migration/cleanup gate or future phase is closed by this documentation update.

## Actual availability

Since 2026-10-18 04:45 novels follow the membership feature flags: they are available only when the user's plan grants `novels` (a missing or null grant is off; root bypasses), and the frontend `VITE_FEATURE_*` variables are gone. Disabled pages are hidden from navigation, direct navigation renders Not Found, and frontend story API methods reject calls. **WIP is the documentation status; a WIP placeholder is not the current application behavior.** Source: [flags](../../src/shared/featureFlags.ts), [router](../../src/app/router/AppRouter.tsx), [Sidebar](../../src/ui/components/Sidebar.tsx), and [API client](../../src/infrastructure/api/index.ts).

The installed work includes structured scenes, parts and chapters, organization history, scoped Codex snapshots, inline review, draft recovery, checkpoints, recoverable Trash and copies (D1–D2); the story-aware assistant with cited sources, reviewed proposals, Stop and recovery (D3); planning views, tasks, stash, facts, continuity checks and grouped changesets (D4); and import, export, packages, export jobs, goals, book copy, translation and completions (D5). Passing focused tests does not close the documented correctness findings or prove release readiness.

**Product scope:** One author writing and revising with AI. Collaboration is out of scope, including multi-user editing, presence, invitations, team roles, shared review access, and collaborative synchronization. Personal comments, AI change review, offline recovery, conflict protection across the author's own tabs/devices, and versioned canon across that author's series remain in scope. This exclusion applies to every feature, architecture recommendation, phase, and validation gate in the dossier.

## Historical execution log (2026-10-16 to 2026-10-17)

> Historical. The checkpoints below record the order of work. Their "remaining" statements are superseded by the audited status in [14](14_status_and_roadmap.md#current-progress-remaining-work-and-scope).

### Execution status — 2026-10-16

Current D2 functional gaps include remaining editor/catalog and organization/context cases and complete performance/retention/offline/author/device/accessibility acceptance. Narrative-time editing already exists. Saved-reference inspection, within-container block movement, unit planning, continuous saved reading with direct seek/bounded bidirectional windows/device paragraph resume, and reviewed literal replacements with atomic apply/recovery/guarded undo-redo are installed locally. D3 source preparation is WIP; its conversations/proposals and all D4–D6 work remain pending. Installed verification and limits are recorded in 01/14; no phase or release completion is claimed.

The [bookmark installation checkpoint](14_status_and_roadmap.md#d2-bookmark-installation--2026-10-16) connects writer/reader point and passage bookmarks, exact navigation, scoped request/draft recovery, independent copy choices and frozen review. The additive `2026_10_novel_bookmarks` upgrade preserved all 4,314 original content rows against a verified private backup. Installed tests, build and Storybook typecheck pass; broader D2 acceptance and D3–D6 remain open.

The [deliberate erasure checkpoint](14_status_and_roadmap.md#d2-deliberate-novel-erasure--2026-10-16)
and [ADR 19](19_novel_erasure_and_retention.md) prepare explicit permanent erase
for one trashed novel, with exact title/source review, a minimal replay barrier
and durable lost-response recovery. The feature is installed and locally verified. The additive empty-table
upgrade preserved all **4,449 original content rows** against a fresh private
backup; the running API is healthy on `2026_10_novel_erase`. No project content
was erased. D2 and D3–D6 remain open.

The requested review and implementation have begun. D1 reliability changes are implemented in this checkout: ordered revision-checked saves and exact receipts, local draft recovery/conflicts, immutable checkpoints and restore, deliberate undoable AI review with atomic acceptance, exact selection/cursor context, enforced packet budgets and Unicode fidelity fixes. The approved development DB reset and real MySQL persistence smoke passed; the API restarted healthy. The D2 scene schema/API/editor and organization slice is also installed and locally verified, including a fresh project-only reset and provider-free MySQL smoke. D2 has remaining gates; D3–D6 remain in scope and are not complete. Current evidence and remaining gates live in [14 — Delivery register](14_status_and_roadmap.md#execution-checkpoint--2026-10-16) and [01 — Execution evidence](01_current_state_and_evidence.md#execution-evidence--2026-10-16). Earlier dated source findings below are retained as history.

The [D2 mutation recovery checkpoint](14_status_and_roadmap.md#d2-mutation-recovery-checkpoint--2026-10-16) additionally implements durable metadata/goal/lifecycle/Codex requests and forms, explicit field comparison, runtime acknowledgement guards, and atomic versioned reference mutations. Actual MySQL batch rollback/CAS/replay and frontend wire validation passed. The [whole-novel copy checkpoint](14_status_and_roadmap.md#d2-novel-copy-checkpoint--2026-10-16) adds reviewed independent copies, frozen provenance and exact request recovery. The [creation recovery checkpoint](14_status_and_roadmap.md#d2-creation-recovery-checkpoint--2026-10-16) adds atomic idempotent creation and scoped recovery across all creation entry points. The [unit copy checkpoint](14_status_and_roadmap.md#d2-unit-copy-options-checkpoint--2026-10-16) adds reviewed notes/local Codex/lifecycle choices, source guards and archived result recovery. Isolated synthetic databases verified these paths without touching the project database. Personal-annotation copying is implemented in the later checkpoint below; broader D2 gates and D3–D6 remain open.

The [organization history checkpoint](14_status_and_roadmap.md#d2-organization-history-checkpoint--2026-10-16) adds filtered event comparison and reviewed multi-step undo/redo with actual before-images, scoped reference guards, exact receipts and preservation of later unrelated writing. The [named manuscript capture checkpoint](14_status_and_roadmap.md#d2-named-manuscript-capture-checkpoint--2026-10-16) adds capture, frozen scene/pin reads and saved-state comparison. The [manuscript restore checkpoint](14_status_and_roadmap.md#d2-manuscript-restore-checkpoint--2026-10-16) adds reviewed in-place restoration with explicit later-unit choices, new recoverable revisions and full metadata/reference undo/redo. The [scene history checkpoint](14_status_and_roadmap.md#d2-scene-history-checkpoint--2026-10-16) adds filtered small pages, verified individual checkpoints/excerpt copy and reviewed hash-bound text restore with durable receipt-first recovery. Isolated HTTP/MySQL tests and frontend runtime guards passed. Remaining organization/performance/retention/author gates and D3–D6 remain open; the full 136-capability scope is unchanged.

The [personal annotation integration](14_status_and_roadmap.md#d2-personal-annotation-integration--2026-10-16) connects Studio notes, separate content/anchor versions, passage mapping, reviewed comment copying and guarded organization reversal. The additive schema is installed with every pre-existing content row verified unchanged against its private backup. Snapshot text restoration preserves current personal notes and remaps their attachments. The [frozen personal-note checkpoint](14_status_and_roadmap.md#d2-frozen-personal-note-snapshots--2026-10-16) adds hash-bound historical note text/state and exact saved-passage reads without another schema change. Remaining D2 gates and D3–D6 remain open.

The [novel metadata checkpoint](14_status_and_roadmap.md#d2-novel-covers-and-default-pov--2026-10-16) adds reviewed owned covers/upload and default POV inheritance, bounded recoverable forms, and preservation through snapshots/restore/copies. Missing-file records remain valid; no schema change or project database test write was needed. Saved statistics/size filters, reading preferences and result navigation are implemented in the later checkpoints in 14. Broader D2 acceptance and D3–D6 remain open.

The [offline/reconciliation checkpoint](14_status_and_roadmap.md#d2-open-scene-reconnect-and-reconciliation--2026-10-16)
adds browser-offline pause, checked reconnect, reviewed rich manuscript merges,
separate retained device copies and independent live-writer journals. Strict
recovery keeps an unsupported request manual. [ADR 20](20_offline_and_reconciliation.md)
records the boundary: persistent device entry, draft/review recovery and opt-in production app copies support cold offline loading locally; broader offline/device/retention acceptance remains open.
R13, broader D2 acceptance and D3–D6 remain open.

## Main recommendation

Retain the current React and TipTap foundation. Rework the document, persistence, revision, and AI-change contracts before expanding the assistant. Build novel and scene organization, story memory, personal editorial review, and publishing workflows on those contracts.

The product should let an author plan, write, revise, research, organize, and deliver a novel in one workspace. Ordinary editing must remain useful without AI. AI should understand the selected passage and the relevant story state, explain proposed changes, and support precise acceptance and recovery.

The full target includes all feature families in [05 — Feature catalog](05_feature_catalog.md). Delivery phases sequence that target; later phases do not silently remove capabilities from scope. Specific implementation choices remain recommendations until implementation planning resolves the open decisions.

## UI/UX plan and example

The [standalone HTML demo](novel-studio-demo.html) illustrates Write/Plan/Review, shared scene organization, an Assistant/Codex/Context/Changes inspector, explicit AI comparisons, history, recovery, and delivery. It is a sample view, not an integrated application feature. AI, account synchronization, context totals, and recovery fixtures are simulated; enabled Markdown/text/sample JSON downloads are local examples.

[06 — UI/UX](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work) now records UX-01–UX-12 with evidence, priority, phase, and expected behavior. The main implementation lessons are to preserve prose and unsent input when panels change, keep review decisions reachable, retain accessible names in compact layouts, make save/recovery state persistent and truthful, offer non-drag structure actions, and distinguish approved facts from derived or proposed material. Corrected prototype issues remain open product work.

Use [11 — UI/UX delivery workstream](11_refactor_and_migration_plan.md#uiux-delivery-workstream) to sequence the work and [12 — Acceptance matrix](12_validation_and_acceptance.md#uiux-acceptance-matrix) to validate it in the app. The 26 temporary prototype assertions and limited desktop/390px browser checks are separate from the 211-test application baseline, author studies, and accessibility release gates. Evidence limits and rechecked sources are in [01](01_current_state_and_evidence.md#standalone-ui-prototype-evidence--2026-10-15) and [13](13_sources_and_open_decisions.md#uiux-guidance-addendum--2026-10-15).

## Original priorities (2026-10-14)

Items 1–6 are installed; 7 and 8 continue in every phase. The current priority list is in [14](14_status_and_roadmap.md#priority--what-to-do-next).

1. Prevent stale saves and provide durable draft recovery.
2. Make accepted AI replacements undoable and acceptance persistence reliable.
3. Correct cursor context, selection offsets, Unicode replacement, and context traces.
4. Add manuscript revision history and original-versus-proposed review.
5. Introduce stable document/reference identities and chapter/scene organization.
6. Add a novel-bound assistant with explicit context and reviewable multi-step changes.
7. Carry the UI/UX work and acceptance criteria into each phase, including responsive reading, retained interaction state, keyboard/focus behavior, and first-use/failure states.
8. Update schema/code together through scoped changes with a verified backup, preserve recovered non-novel content and current novels, run the three lean checks, and remove superseded code paths. Whole-database resets are disabled.

The 2026-10-14 documentation review reran the focused suite: **211 tests across 27 files passed (6.52 seconds)**. The earlier dossier records additional controlled failures; those reproductions were not rerun in this update. Passing the existing suite does not demonstrate coverage of those failures. See [01](01_current_state_and_evidence.md) and [12](12_validation_and_acceptance.md).

The subsequent 2026-10-15 deep review passed **221 frontend tests / 28 files** (novel/API baseline plus feature gating, excluding the nested checkout) and **290 backend tests / 7 files** (schema/story contracts and existing migration pattern). These are current unit/component/mock-contract checks, not live database, migration, backup/restore or release evidence. Reproducible commands and the initial nested-checkout discovery failure are recorded in [01](01_current_state_and_evidence.md#deep-migration-and-cleanup-revalidation--2026-10-15).

## Reading map

| Document | Purpose |
|---|---|
| [01 — Current state and evidence](01_current_state_and_evidence.md) | Source inventory, preserved strengths, test/reproduction evidence, boundaries |
| [04 — Novel, chapter, and scene management](04_novel_chapter_and_scene_management.md) | Hierarchy, ordering, lifecycle, split/merge, series, summaries, and timelines |
| [05 — Feature catalog](05_feature_catalog.md) | Complete target capability inventory, current coverage, delivery sequence |
| [06 — UI/UX and accessibility](06_ui_ux_and_accessibility.md) | Prototype findings, UX-01–UX-12 priorities, writing/review flows, responsive behavior, keyboard and accessibility |
| [07 — Target architecture](07_target_architecture.md) | Component/service responsibilities, document model, editor-stack options, proposed API shape |
| [08 — AI assistant, context, and tools](08_ai_assistant_context_and_tools.md) | Novel assistant behavior, grounded context, tools, changesets, provenance, and role profiles |
| [09 — Persistence, revisions, and recovery](09_persistence_revisions_and_recovery.md) | Save ordering, concurrency, local drafts, history, undo, deletion, and offline behavior |
| [10 — Issues, gaps, and risks](10_issues_gaps_and_risks.md) | Prioritized findings, evidence confidence, consequences, and mitigations |
| [11 — Refactor and migration plan](11_refactor_and_migration_plan.md) | Phased work, repository impact, scoped schema changes, code cleanup and recovery |
| [12 — Validation and acceptance](12_validation_and_acceptance.md) | Defect and UX acceptance matrices, contract checks, AI evaluation, author research, performance and release gates |
| [13 — Sources and open decisions](13_sources_and_open_decisions.md) | Primary references, verification limits, recommendation ledger, unresolved choices |
| [14 — Actual status and roadmap](14_status_and_roadmap.md) | WIP availability, implemented/partial/planned coverage, dependency order, release gates, TBD ownership and decisions |
| [15 — Database migration and legacy cleanup](15_database_migration_and_legacy_cleanup.md) | Data preservation and recovery, scoped schema changes, API/code replacement, lean checks and cleanup inventory |
| [16 — Document and structure decision](16_document_and_structure_decision.md) | Accepted D2 document/identity decisions, options, costs and integration steps |
| [17 — Personal annotation decision](17_annotation_anchors_and_personal_review.md) | Independent note/anchor versions, exact transaction mappings, orphan handling, personal review and additive storage |
| [18 — Studio loading decision](18_studio_index_and_scene_loading.md) | Separate outline/selected-scene projections, explicit unloaded content, source preconditions and UI/cache integration (installed) |
| [19 — Novel erasure and retention](19_novel_erasure_and_retention.md) | Explicit owned erasure, redaction, recovery and retention boundaries |
| [20 — Offline and reconciliation](20_offline_and_reconciliation.md) | Device drafts, guarded reconciliation, offline app loading and remaining acceptance |
| [21 — Assistant source boundary](21_assistant_context_boundary.md) | Installed saved-source preparation, exact evidence and remaining full assistant scope |
| [22 — Bound novel turns and commits](22_novel_assistant_turns_and_commit.md) | Conversation/profile/prompt/candidate boundary, now running in the app (D3), historical compatibility and remaining gates |


## Evidence and precedence

- **Reproduced:** A controlled check exercised the implementation at its recorded date and observed the failure. A historical reproduction is not a fresh test or evidence of production incidence.
- **Source-confirmed:** The reviewed code demonstrates the mechanism or missing contract. Runtime consequences may still need integration testing.
- **Gap:** A capability absent from the reviewed implementation but required by the proposed target.
- **Risk:** A plausible failure or scaling concern that has not been measured or reproduced.
- **Recommendation:** A proposed product or engineering choice derived from the evidence.
- **Prototype observation:** Behavior seen in the standalone sample, or a source-confirmed limitation of that sample; not a confirmed production finding or author-study result.
- **Vendor-documented:** An official product describes a capability. This is not an independent usability or quality benchmark.
- **Research:** A paper or research project supports a design direction within its studied setting. Older-model or short-story results do not certify current models or complete novels.

Current source is the implementation baseline; this dossier is the current novel target. The earlier brief's textarea advice, raw-offset DTO sketches and MVP exclusions do not override the current editor or full feature catalog.

Workspace and profile boundaries remain governed by [Workspace R1](../workspace_r1/README.md), [LLM profiles](../llm_profiles/README.md), and the actual implementation. This dossier proposes additions, not changes to approved workspace ownership or credential rules.

The [manuscript search checkpoint](14_status_and_roadmap.md#d2-manuscript-search-and-result-navigation--2026-10-16)
adds saved-text unit/status/archive filters, bounded Unicode excerpts and
source-checked navigation to an exact scene passage. It preserves current
draft/review gates and opens a highlight with a collapsed cursor. Local checks
include 749 frontend tests, 696 scoped BFF tests and a fresh synthetic MySQL
search/resolve smoke. The later replacement checkpoint extends S17; bookmarks remain;
D2 and D3–D6 are still incomplete. No project database/schema change is needed
for this slice, and legitimate missing-file records remain retained.

The [links and typing checkpoint](14_status_and_roadmap.md#d2-links-and-typing-preferences--2026-10-16)
adds guarded link inspection/editing and loss-aware destination handling during
paste, plus scoped typography controls that affect new typing without changing
existing prose or editor history. Actual frontend output passed synthetic
MySQL save/reopen. Reference keyboard/disambiguation, block movement and the
remaining D2/D3–D6 work remain open; this is not phase/release completion.

## Scope of this work

This dossier documents the current foundation and proposed expansion. Proposed DTOs, tables, tools, state machines, and component names are illustrative design contracts, not existing APIs. No licensed package, new service, or model is selected for purchase. Live browser, screen-reader, performance, migration, and production evidence remain explicitly separate from source review. Storytelling requirements are maintained here only where they serve the novel/writing system. Approved card and adventure material remains a manuscript source with pins and provenance (N02/K01); covers/illustrations, read-aloud, dictation, research and reviewed publication handoff already belong to the catalog. Excluded from this plan: game launchers, live session-history integration, campaign runtime, combat/economy/inventory mechanics and prose-to-game writeback (K06 tracks facts in the manuscript, not live game state); marketplace, billing/admin consoles, social publishing or public story hosting, standalone worldbuilding/map/family-tree platforms, a generalized moderation redesign, and new card families. The explicit publication handoff (X12, D6) does not authorize building a publishing platform. Collaboration stays excluded as stated under **Product scope** above.

The [compound preservation checkpoint](14_status_and_roadmap.md#d2-compound-structure-preservation--2026-10-16) fixes chapter inheritance, split-summary verification and reviewed restoration into another container, with nested rich-text/context/annotation history evidence. Remaining D2 catalog capabilities and D3–D6 stay in scope.

The [outline/insertion checkpoint](14_status_and_roadmap.md#d2-outline-and-exact-insertion--2026-10-16) adds derived numbering, detailed goals/status/cast/synopsis/summary views and reviewed insertion around stable unit identities. The [writing-template checkpoint](14_status_and_roadmap.md#d2-editable-writing-templates--2026-10-16) adds editable starter/custom outlines and writing defaults through atomic independent creation and recovery. Remaining catalog work and all broader D2/D3–D6 gates remain in scope.

The [reviewed creation-source checkpoint](14_status_and_roadmap.md#d2-reviewed-creation-sources--2026-10-16) adds exact card/material review, explicit approval, stale-source guards, immutable creation origins and retained rejected creation drafts. Approved passages become reference context; the manuscript starts empty. Remaining D2 metadata/library, reading/navigation/search, organization/context, performance, retention/offline and author/mobile/assistive-technology gates stay open. D3–D6 remain planned.

The [library discovery checkpoint](14_status_and_roadmap.md#d2-library-discovery--2026-10-16) adds search scopes, metadata/status/tag/activity filters and stable sorting, with explicit archive/Trash behavior and scoped pagination. The [metadata checkpoint](14_status_and_roadmap.md#d2-novel-covers-and-default-pov--2026-10-16) adds owned covers and default POV, including cache inheritance after later saves.

The [saved-statistics checkpoint](14_status_and_roadmap.md#d2-saved-statistics-and-size-filters--2026-10-16) adds revision-bound aggregate caches, size filters and word sorting. Its two-table upgrade installed `2026_10_novel_statistics` (111 tables / 156 foreign keys), verified all 4,276 original content rows unchanged, and left the API healthy. That scope passes 680 frontend tests, 640 scoped backend checks, build and Storybook typecheck.

The [reading checkpoint](14_status_and_roadmap.md#d2-reading-appearance--2026-10-16) adds device-local font, size, spacing, width and contrast presets while preserving the editor, draft, selection and undo history. That scope passes 693 tests / 109 files, build, Storybook typecheck and targeted lint.

The [view/position checkpoint](14_status_and_roadmap.md#d2-view-and-position-resume--2026-10-16) adds scoped panel/scene choices, close/page-hide position flush, exact document-bound range restoration and cursor fallback for changed/unverifiable text. Its expanded scope passes 723 frontend tests / 111 files, build, Storybook typecheck and targeted lint. Remaining D2 includes manuscript result navigation, broader organization/context and complete performance/retention/offline/author/device acceptance. D3–D6 remain planned.

The [saved-reference checkpoint](14_status_and_roadmap.md#d2-saved-reference-inspection--2026-10-16) adds keyboard inspection, explicit duplicate-name choices, alias/source/version autocomplete and guarded context actions. Removed/renamed pins remain readable by their saved IDs; inspection and mention insertion do not enable context implicitly. Block movement, remaining D2 capabilities and acceptance, and D3–D6 remain in scope.

The [block-movement checkpoint](14_status_and_roadmap.md#d2-manuscript-block-movement--2026-10-16) adds reviewed sibling destinations and keyboard/click movement of rich paragraphs, containers and nested list items, preserving stable IDs/selection and isolated undo. Native canonical list defaults and implicit trailing paragraphs were corrected. Fresh synthetic HTTP/MySQL verification covers note movement, cross-boundary quote retention and exact undo without overwriting later review edits. Remaining D2 capabilities/acceptance and D3–D6 stay in scope.

The [Studio loading checkpoint](14_status_and_roadmap.md#d2-studio-loading-and-bounded-history--2026-10-16)
connects the prose-free index and guarded document reads to opening, switching,
metadata and recovery. Confirmed scene caching is bounded separately from drafts
and journals. Full generation history and source previews remain reachable through
bounded summaries/excerpts and explicit detail reads. Initial full-tree Studio
loading is replaced; whole-product resource limits, remaining D2 capabilities and
author/device/accessibility acceptance remain open. D3–D6 remain planned.
[ADR 18](18_studio_index_and_scene_loading.md) records the current contracts.

The [highlight/display checkpoint](14_status_and_roadmap.md#d2-highlights-and-invisible-characters--2026-10-16)
adds E18's canonical text highlights and a separate scoped option for invisible
characters. Saved formats/history/copies retain highlights; view markers leave
actual text, counts, context and undo intact. Wider author/device/format and
performance acceptance, remaining D2 work and all D3–D6 stay in scope.


The [persistent device-entry checkpoint](14_status_and_roadmap.md#d2-persistent-device-entry--2026-10-16)
adds an owned IndexedDB confirmed-read cache and an explicit local writer that
reuses the canonical editor/queue, preserves drafts before navigation and
requires fresh exact-scene account reads for handoff. Native browser reload,
quota/isolation checks and actual retained wire validation pass. App-shell
cold loading and full R13/D2/D3–D6 remain open. Durable review choices are added by the following checkpoint.

The [durable reconciliation checkpoint](14_status_and_roadmap.md#d2-durable-reconciliation-choices--2026-10-16)
retains exact-source review choices across reloads in a separate bounded store.
Saved reviews open directly from the device library without a confirmed-read
cache; saved account snapshots allow local review but cannot apply writing.
Native reload/isolation/refusal checks pass. App-shell cold loading, broader D2
acceptance and all D3–D6 remain pending; all 136 capabilities stay in scope.

The [cold offline app checkpoint](14_status_and_roadmap.md#d2-cold-offline-app-loading--2026-10-17)
adds explicit verified app download, bounded immutable build copies, private-URL
exclusion and updates that wait for open writing tabs. Native checks prove cold
app rendering and local draft recovery/continued writing after stopping the
fixture server. Broader retention/browser/author/performance acceptance, remaining
D2 capabilities and all D3–D6 remain open; all 136 capabilities stay in scope.

The [retained workspace lifecycle checkpoint](14_status_and_roadmap.md#d2-retained-workspace-lifecycle--2026-10-17)
adds monotonic checked workspace observations and live device-writer/review archive
restrictions without replacing unsent prose or upgrading existing browser storage.
Native transaction and two-tab checks pass with earlier fictional copies retained.
Remaining D2 acceptance and D3–D6 stay open; the full 136-capability goal remains WIP.

The [novel/unit device lifecycle checkpoint](14_status_and_roadmap.md#d2-novel-and-unit-device-lifecycle--2026-10-17)
extends known archive/Trash/removal/erasure restrictions to open device writers and
saved reviews while preserving original prose and manual recovery. Independent
metadata/placement revisions, native refusal checks and a two-tab reload exercise
are verified locally. Broader D2 acceptance/policy and D3–D6 remain open.


The [D3 saved-source checkpoint](14_status_and_roadmap.md#d3-saved-source-context-preparation--2026-10-17)
and [ADR 21](21_assistant_context_boundary.md) add explicit saved selection/scene/chapter/novel/selected-scene preparation,
exact passage citations, inherited writing defaults, pinned conflicts, reading-order exclusions,
and an inspectable actual-message packet with a conservative input estimate and reserved output.
This preparation performs no model execution or manuscript write. Novel-bound conversations,
published profiles, reviewed changesets and unified inline/chat application remain D3 work;
D2 acceptance and all D4–D6 requirements stay open. All 136 capabilities remain in scope.


The [prepared private-runtime checkpoint](14_status_and_roadmap.md#d3-private-runtime-and-provider-transport-preparation--2026-10-17)
adds scoped client capabilities, literal-source authorization, four-engine private
HTTP support and native in-memory recording checks, including OpenAI Responses.
It is not installed or enabled. Protected HTTP admission, BFF dispatch, catalog
upgrade/provisioning, recovery and the rest of D3 remain required; the full
136-capability D1–D6 objective remains open.


The [prepared protected-HTTP checkpoint](14_status_and_roadmap.md#d3-protected-http-preparation--2026-10-17)
adds strict separate credential handling, delegated admission and keyless completed
replays through the real inline runtime. Controlled HTTP/native checks pass; broader
executor regressions remain unresolved. Feature source and schema are still
uninstalled. BFF dispatch, catalog upgrades, retained recovery and the remaining
D1–D6 work stay open.


The [protected dispatch/reconciliation checkpoint](14_status_and_roadmap.md#d3-protected-dispatch-and-completed-reconciliation--2026-10-17)
connects the prepared BFF transport to protected execution and keyless completed
recovery. It preserves uncertain work and fixes recovered output/tool-stream
projection. Local two-process checks pass with controlled provider/storage ports.
Feature code and schema remain uninstalled; native SQL, catalog compatibility,
terminal settlement/stop and the rest of D1–D6 remain open.


The [native MySQL/catalog checkpoint](14_status_and_roadmap.md#d3-native-mysql-and-catalog-upgrade-preparation--2026-10-17)
verifies the prepared request path against real isolated SQL storage and adds a
backed-up four-engine CHECK upgrade. Existing fixture content and streaming-only
writer references are preserved. Feature execution/schema remain uninstalled;
actual profile provisioning, SQL recovery/races, stop/settlement, erasure and the
remaining D1–D6 work stay open.


The [catalog contract preparation](14_status_and_roadmap.md#d3-catalog-contract-preparation--2026-10-17)
adds a fixture-qualified protected catalog reader and exact BFF/executor feature
parity while preserving streaming-only writers. Runtime callers have not switched,
and deployed targets/published profiles have not been migrated. The full assistant
remains uninstalled; D1/D2 acceptance, full D3 integration and all D4–D6 remain open.


The [shared catalog cutover preparation](14_status_and_roadmap.md#d3-shared-catalog-cutover-preparation--2026-10-17)
connects every prepared BFF catalog consumer to the protected project catalog and
adds frozen-route guards and immutable provisioning replay. Read-only inventory
preserves all 9 profiles / 45 role references and all usable configured-provider
models. Source/schema/config activation, provider formatting, native settlement
and Studio integration remain pending; the full assistant remains uninstalled.


The [provider-format preparation](14_status_and_roadmap.md#d3-provider-format-preparation--2026-10-17)
aligns private request formatting with existing profile rules, verifies all 45
saved roles and adds 28 protected HTTP/native MySQL checks. Stored profiles and
source stay exact. Shared inline/chat execution, Studio review, settlement/recovery
and coordinated activation remain pending; the complete assistant stays uninstalled.


The [shared inline execution preparation](14_status_and_roadmap.md#d3-shared-inline-execution-preparation--2026-10-17)
connects fresh inline writing and assistant turns to the same protected execution
lifecycle, preserving streaming-only profiles and retained requests. Twenty native
HTTP/MySQL cases pass with fake providers and preserved fixture records. The code
is still prepared separately; both-service settlement, Studio review and
coordinated activation remain pending. The full D1–D6 objective remains active.


The [inline candidate/credit recovery preparation](14_status_and_roadmap.md#d3-inline-candidate-and-credit-recovery-preparation--2026-10-17)
qualifies 32 two-service SQL cases and fixes validation failures that could close
an already-completed execution incorrectly. Sixteen migrated SQL tests retain
their isolated schemas. The feature is still uninstalled; assistant proposal SQL,
Studio review, partial continuation/terminal settlement and activation remain open.


The [assistant turn and source-bound acceptance preparation](14_status_and_roadmap.md#d3-assistant-turn-and-source-bound-acceptance-preparation--2026-10-17)
qualifies 32 two-service assistant SQL cases plus eight candidate-acceptance cases.
It corrects a tool-envelope mismatch and blocks acceptance after reviewed source/
context changes. Feature source/schema remain uninstalled; Studio handoff/refine/
apply/undo, output-size consistency, lifecycle/terminal acceptance and activation
remain open within the full D1–D6 objective.


The [Studio saved-suggestion handoff preparation](14_status_and_roadmap.md#d3-studio-saved-suggestion-handoff-preparation--2026-10-17)
connects checked saved candidates to in-place review, explicit acceptance/decline
and exact one-step undo. Cancellation also fences pending scene navigation.
5,279 frontend tests pass; build, story typecheck and targeted lint pass. Controlled
desktop/320px examples remain distinct from author/device acceptance. Feature
activation, real refine, output-size and conflict/lifecycle work remain pending.


The [reply-size and commit-boundary checkpoint](14_status_and_roadmap.md#d3-novel-reply-size-and-commit-boundary-preparation--2026-10-17)
aligns prepared novel answer/proposal limits across BFF transport, native live/
retained output and domain validation, and fixes cancellation after a confirmed
native commit. Maximum-size Unicode replies, both payer modes and keyless lost-
response recovery pass through real isolated SQL; the captured fictional public
response also passes frontend SSE validation. Feature code/schema/config remain
uninstalled. Real refine, broader native lifecycle/acceptance and all remaining
D1–D6 gates stay open; no project data or running service was changed.


The [retained-parent refinement checkpoint](14_status_and_roadmap.md#d3-retained-parent-refinement-preparation--2026-10-17)
protects exact saved proposed writing as input independent of chat history and
binds each new suggestion to current saved sources. Ten two-service SQL cases
cover both payers, newer text/selections, inline append, rejected parents and
keyless lost-reply recovery. The browser preserves the unsent instruction and
returns focus to it. Feature code/schema/config remain uninstalled; conflict
recovery, complete inline/chat UI integration, native lifecycle/settlement,
activation and remaining D1–D6 work stay open.


The [application-conflict recovery checkpoint](14_status_and_roadmap.md#d3-application-conflict-recovery-preparation--2026-10-17)
keeps rejected suggestion applications separate from ordinary autosave and
uncertain receipts. Exact submitted text, candidate identity and later device
writing survive reload and reviewed account-version recovery. Source changes
before editor handoff retain evidence and the Refine action. The prepared feature
remains uninstalled; remaining inline/chat, lifecycle and D1–D6 work stays open.


The [inline-history refinement checkpoint](14_status_and_roadmap.md#d3-inline-history-refinement-preparation--2026-10-17)
connects complete saved writing to the same retained assistant draft. It preserves
the unsent instruction/profile, rereads the owned parent, and binds an old passage
to its immutable checkpoint or an explicitly captured current passage. Failed
handoffs retain the original writing. Feature source/schema/config remain
uninstalled; author-edited variants, broader D3 acceptance/activation and the full
136-capability D1–D6 objective remain open.


The [author-variant backend/application checkpoint](14_status_and_roadmap.md#d3-author-variant-backend-and-application-preparation--2026-10-17)
adds separate immutable authored suggestion versions, provider-free review and
storage, exact atomic application, and retained version references through
offline/reload/conflict recovery. The editor stages reviewed canonical JSON and
preserves its block identities through acceptance and undo/redo. Backend SQL,
frontend guards and the application bridge are prepared and verified, **not
installed**. The private author-editing/creation/decision UI remains pending,
alongside broader D3 source policy, activation, D1/D2 acceptance and all D4–D6.


The [private authoring UI checkpoint](14_status_and_roadmap.md#d3-private-authoring-and-saved-version-ui-preparation--2026-10-17)
adds a separate rich editor for authored suggestion versions, retained local
creation/decision requests, saved-version discovery and explicit source-checked
Studio review. Its frontend checks and controlled browser exercises pass;
feature source/schema/config remain **prepared, not installed**. Broader D3
source/lifecycle/settlement qualification, installation, D1/D2 acceptance and all
D4–D6 remain open.


The [native assistant-version checkpoint](14_status_and_roadmap.md#d3-native-assistant-authored-version-qualification--2026-10-17)
qualifies authored versions from completed retained BFF assistant plans using
real MySQL and fictional replies: source refusal, concurrent atomic acceptance,
rollback, preserved accounting and archived receipt recovery. Native wire also
passes frontend guards. Upstream executor/provider acceptance and coordinated
installation remain open; this closes no D1–D6 phase.


The [private-version device recovery checkpoint](14_status_and_roadmap.md#d3-private-author-version-device-recovery--2026-10-17)
makes authored drafts and uncertain version requests discoverable without a
cached manuscript. Inspection, lossless diagnostic downloads and independent
device editing preserve original writers; Studio receives the exact selected
record. Existing workspace/novel lifecycle observations pause editing while
keeping writing readable. Source remains **prepared, not installed**; full
storage/shared-device acceptance, D3 completion/activation and D1/D2/D4–D6 gates
remain open.
