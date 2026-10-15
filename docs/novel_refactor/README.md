# Novel refactor — WIP status, research, and roadmap

**Source/lifecycle review:** 2026-10-15, America/Mexico_City. **Research cutoff:** 2026-10-14.\
**UI/UX plan update:** 2026-10-15, informed by the standalone demo and selected official accessibility/human–AI guidance.\
**Status:** WIP. A chapter-based Story Studio is implemented behind a frontend flag; the expanded refactor remains proposed. The checked-in example disables novels, while this checkout's local environment enables them. See [14 — Actual status and roadmap](14_status_and_roadmap.md) for the exact gates and remaining work. No application implementation, database migration, deployment, or provider call was performed by this documentation pass.\
**Target:** A complete novel-writing editor with an integrated, story-aware AI assistant.

The dossier contains 13 Markdown documents, a standalone HTML prototype, 136 target capabilities, 23 NE findings, 12 prioritized UI/UX work items, and 62 primary references. The references cover eight writing/planning products and four editor or open-source foundations. Findings distinguish prior controlled reproductions, source-confirmed concerns, prototype observations, target gaps, and unmeasured risks. Vendor/model research retains its 2026-10-14 cutoff. The earlier review recorded local source and focused tests; the UI/UX addendum adds prototype findings and guidance. The October 15 cleanup rechecked save ordering, AI acceptance, search offsets, current DTOs and flags without rerunning those application/prototype tests or refreshing vendor claims.

[14 — Status and roadmap](14_status_and_roadmap.md) is the sole delivery authority. Documents 01/10 maintain current evidence and findings; 04–09/11–12 are target design and acceptance; 13 records the dated product/research references, their limits, and unresolved decisions. The June 2026 storytelling brief was consolidated into this dossier on 2026-10-15; its retained writing requirements are folded into the catalog and design documents, with the clarified contracts in 06–08 and their acceptance checks in 12. All 136 novel capabilities and D1–D6 remain; no NE finding or future phase is closed by this documentation merge.

## Actual availability

`VITE_FEATURE_NOVELS_ENABLED` enables the feature only when its value is the exact string `true`. [`.env.example`](../../.env.example) sets it to `false`; the local `.env` reviewed on 2026-10-14 sets it to `true`. Neither establishes the production flag value or deployed backend readiness. Disabled pages are hidden from navigation, direct navigation renders Not Found, and frontend story API methods reject calls. **WIP is the documentation status; a WIP placeholder is not the current application behavior.** Source: [flags](../../src/shared/featureFlags.ts), [router](../../src/app/router/AppRouter.tsx), [Sidebar](../../src/ui/components/Sidebar.tsx), and [API client](../../src/infrastructure/api/index.ts).

The implemented foundation includes the gallery, TipTap chapter editor, Codex snapshots, inline generation, and generated-output history. It does not yet provide independent scenes, manuscript revisions, durable local drafts, a novel-bound conversation assistant, or a manuscript import/export flow. Passing focused tests does not close the documented correctness findings or prove release readiness.

**Product scope:** One author writing and revising with AI. Collaboration is out of scope, including multi-user editing, presence, invitations, team roles, shared review access, and collaborative synchronization. Personal comments, AI change review, offline recovery, conflict protection across the author's own tabs/devices, and versioned canon across that author's series remain in scope. This exclusion applies to every feature, architecture recommendation, phase, and validation gate in the dossier.

## Main recommendation

Retain the current React and TipTap foundation. Rework the document, persistence, revision, and AI-change contracts before expanding the assistant. Build novel and scene organization, story memory, personal editorial review, and publishing workflows on those contracts.

The product should let an author plan, write, revise, research, organize, and deliver a novel in one workspace. Ordinary editing must remain useful without AI. AI should understand the selected passage and the relevant story state, explain proposed changes, and support precise acceptance and recovery.

The full target includes all feature families in [05 — Feature catalog](05_feature_catalog.md). Delivery phases sequence that target; later phases do not silently remove capabilities from scope. Specific implementation choices remain recommendations until implementation planning resolves the open decisions.

## UI/UX plan and example

The [standalone HTML demo](novel-studio-demo.html) illustrates Write/Plan/Review, shared scene organization, an Assistant/Codex/Context/Changes inspector, explicit AI comparisons, history, recovery, and delivery. It is a sample view, not an integrated application feature. AI, account synchronization, context totals, and recovery fixtures are simulated; enabled Markdown/text/sample JSON downloads are local examples.

[06 — UI/UX](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work) now records UX-01–UX-12 with evidence, priority, phase, and expected behavior. The main implementation lessons are to preserve prose and unsent input when panels change, keep review decisions reachable, retain accessible names in compact layouts, make save/recovery state persistent and truthful, offer non-drag structure actions, and distinguish approved facts from derived or proposed material. Corrected prototype issues remain open product work.

Use [11 — UI/UX delivery workstream](11_refactor_and_migration_plan.md#uiux-delivery-workstream) to sequence the work and [12 — Acceptance matrix](12_validation_and_acceptance.md#uiux-acceptance-matrix) to validate it in the app. The 26 temporary prototype assertions and limited desktop/390px browser checks are separate from the 211-test application baseline, author studies, and accessibility release gates. Evidence limits and rechecked sources are in [01](01_current_state_and_evidence.md#standalone-ui-prototype-evidence--2026-10-15) and [13](13_sources_and_open_decisions.md#uiux-guidance-addendum--2026-10-15).

## Immediate priorities

1. Prevent stale saves and provide durable draft recovery.
2. Make accepted AI replacements undoable and acceptance persistence reliable.
3. Correct cursor context, selection offsets, Unicode replacement, and context traces.
4. Add manuscript revision history and original-versus-proposed review.
5. Introduce stable document/reference identities and chapter/scene organization.
6. Add a novel-bound assistant with explicit context and reviewable multi-step changes.
7. Carry the UI/UX work and acceptance criteria into each phase, including responsive reading, retained interaction state, keyboard/focus behavior, and first-use/failure states.

The 2026-10-14 documentation review reran the focused suite: **211 tests across 27 files passed (6.52 seconds)**. The earlier dossier records additional controlled failures; those reproductions were not rerun in this update. Passing the existing suite does not demonstrate coverage of those failures. See [01](01_current_state_and_evidence.md) and [12](12_validation_and_acceptance.md).

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
| [11 — Refactor and migration plan](11_refactor_and_migration_plan.md) | Phased work, UI/UX delivery responsibilities, repository impact, compatibility migration, rollout and rollback |
| [12 — Validation and acceptance](12_validation_and_acceptance.md) | Defect and UX acceptance matrices, contract checks, AI evaluation, author research, performance and release gates |
| [13 — Sources and open decisions](13_sources_and_open_decisions.md) | Primary references, verification limits, recommendation ledger, unresolved choices |
| [14 — Actual status and roadmap](14_status_and_roadmap.md) | WIP availability, implemented/partial/planned coverage, dependency order, release gates, TBD ownership and decisions |

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

## Scope of this work

This dossier documents the current foundation and proposed expansion. Proposed DTOs, tables, tools, state machines, and component names are illustrative design contracts, not existing APIs. No licensed package, new service, or model is selected for purchase. Live browser, screen-reader, performance, migration, and production evidence remain explicitly separate from source review. Storytelling requirements are maintained here only where they serve the novel/writing system. Approved card and adventure material remains a manuscript source with pins and provenance (N02/K01); covers/illustrations, read-aloud, dictation, research and reviewed publication handoff already belong to the catalog. Excluded from this plan: game launchers, live session-history integration, campaign runtime, combat/economy/inventory mechanics and prose-to-game writeback (K06 tracks facts in the manuscript, not live game state); marketplace, billing/admin consoles, social publishing or public story hosting, standalone worldbuilding/map/family-tree platforms, a generalized moderation redesign, and new card families. The explicit publication handoff (X12, D6) does not authorize building a publishing platform. Collaboration stays excluded as stated under **Product scope** above.
