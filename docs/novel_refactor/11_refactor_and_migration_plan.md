# Refactor, migration, and delivery plan

**Delivery review:** 2026-10-16. **Status (audited 2026-10-18):** D1–D2 installed; the D3 assistant runs (inline AI is not yet moved into its pipeline, CL-04); D4 slices 1–19 and D5 slices 1–16 run; D6 not started. Author, device, accessibility and release gates remain open. Novels need the plan grant `novels`. **Deviations from this plan:** inline commands still use their own context compiler and accept path (D3 below); export jobs use their own store and an in-process runner instead of extending the shared tasks (D5 below). See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

**UI/UX delivery update:** 2026-10-15. The [prototype findings and UX-01–UX-12 work items](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work) extend each phase below. The standalone HTML is a design reference; this update authorizes no integration or release and completes no product gate.

**Database preservation correction:** 2026-10-16. Preserve recovered non-novel content and current novels. [15](15_database_migration_and_legacy_cleanup.md) requires scoped changes with a verified backup; whole-database resets are disabled. The earlier production backfill/compatibility rollout remains superseded. Keep the 136-capability target and normal product integrity.

This implementation sequence retains the complete target. The current Studio uses canonical scene documents behind a flag; **D1–D2 are installed**, **the D3 assistant runs**, **D4 and D5 are in progress**, and **D6 has not started** (audited 2026-10-18). No phase is marked shipped. The full product target is [05](05_feature_catalog.md); phases are dependency order rather than promised dates. Current status, dependencies, accountable areas, missing evidence, and TBD decisions are tracked in [14](14_status_and_roadmap.md).

Collaboration is out of scope for every phase. The plan covers one author with AI, including safe operation across that author's own tabs/devices and cached offline drafts.

**Reuse review, 2026-10-16:** apply the [source-backed reuse and overlap decisions](07_target_architecture.md#reuse-and-overlap-decisions) in each slice. Extend existing gallery/Codex, assistant, LLM execution, tasks, media and workspace boundaries. Target entity names do not imply replacement infrastructure. The main-assistant improvement plan shares foundations but does not own manuscript writes; D1/D2 do not depend on its expanded controller.

## D1: reliable editor and persistence

Deliver NE-001 through NE-007, NE-009/NE-010 fidelity protection, local draft recovery, truthful save/acceptance states, and the accessibility basics. Add chapter/document revision checks, serialized save queues and durable checkpoints. Provide a basic manuscript checkpoint/restore contract before enlarging AI scope.

Retain source-card snapshot behavior, profile admission/reconciliation, navigation guards, archived behavior and workspace-origin protection. Preserve existing content and identities during scoped schema changes. Correct the current editor rather than replacing the entire feature to fix isolated defects.

Implement revision-aware saves/checkpoints/receipts and replace timestamp-based refetch merging as well as the save hook. The current D1 guarantees apply to the D2 canonical scene contract. Preserve author content, history and recoverable drafts; use newly allocated, retained synthetic databases for persistence tests. CL-02/03/04/07 begin here; create the current local draft format directly.

Gate: controlled stale-save ordering, accepted replacement undo/redo, failed accept flush, repeated/Unicode selections, outage/reload recovery and workspace switching all pass. Read-only and auth-expiry behavior remain correct.

## D2: document model and novel organization

Introduce schema-versioned scene documents, structure revisions, metadata inheritance, optional parts, independent scenes and stable references. Extend the installed schema through scoped upgrades; seed synthetic chapters/scenes only in newly allocated isolated databases. Add insert/move/duplicate/split/merge/archive/trash/restore, outline view, position restoration and manuscript revision UI.

Use stable IDs for new product data during moves/restores, and new IDs for copies. Preserve existing project IDs, links and history. No bridge to the discarded pre-refactor document format is required. Add actual UI for currently latent POV/location/status fields. Any author import/split is reviewed and preserves its source; a schema upgrade does not authorize prose conversion.

Follow [15](15_database_migration_and_legacy_cleanup.md): update schema/code together through scoped changes, preserve existing rows, and run the short smoke flow. Implement chapter defaults/ref inheritance and goals correctly. Replace application hard-delete-as-trash with lifecycle operations and remove old writers/callers in the same slice. CL-01/03/05/06/07/08/09 do not wait for a production observation window.

Gate: verify the installed target schema read-only, then exercise seeded save/reopen and the changed structure operation in a newly allocated isolated test database. Add focused product regressions for reorder/split/merge/trash when implementing those behaviors. No legacy data-conversion or rollback corpus is required.

## D3: grounded writing assistant

The [saved-source preparation boundary](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#saved-source-assistant-preparation) and the bound conversation/profile/proposal/application contract run in the app since 2026-10-17. **Not done (audit 2026-10-18):** inline commands were not moved into the same proposal/review/commit pipeline; they still call `/stories/{id}/context-preview` (unused by the UI) and `/generate/stream`, compiled by `story_generation.py` apart from `story_assistant_context.py`.

Extend unified assistant kinds/storage, published-profile feature/role support and shared conversation/message/composer hooks for the novel inspector. Add explicit scope, context compiler, evidence-linked retrieval and changesets. Move inline commands into the same proposal/review/commit pipeline. Support single-scene drafting/editing, planning assistance, custom presets, summaries, and proposed canon extraction. Coordinate common tool/effect contracts with the adjacent assistant plan; novel proposal and commit policy remains here.

Reuse existing request IDs, admission and retained result recovery; every accepted proposal binds target revisions. Keep Ask useful without direct edits. Exact instructions already exist inside the frozen execution payload. Add an allowlisted history/API projection and source-revision/application lineage, rather than another raw-prompt store.

Update assistant enums, novel binding, message/result checks, profile feature seeds and changeset storage in the current schema/code. An enum addition cannot satisfy the current one-tool/applied-action constraints. Create sample conversations/generations only in newly allocated isolated databases; preserve current project conversations and generations. No adapter to the discarded pre-refactor format is required. CL-02/04/06/08/09 replace divergent pipelines and status-only acceptance. A new manuscript application retry must not create another paid model execution.

Gate: source/target correctness, token allocation, missing/changed targets, partial acceptance dependency rules, transport recovery, idempotent commit and profile/account/workspace isolation pass. Author evaluation shows useful edits without accidental acceptance.

## D4: developmental review and story structure

Add board/timeline/matrix views, source-linked continuity issues, narrative-time character knowledge, plot threads, comments/tasks, draft branching, and reviewed multi-scene plans. Derived memory is versioned and invalidated by relevant prose/structure changes.

Gate: temporal knowledge and future-revelation fixtures, stale-summary recovery, safe multi-resource application and author review of uncertain findings pass. Advanced views operate over one structure model.

## D5: portability, production, and productivity

Deliver validated Markdown/plain-text/DOCX import, full manuscript exports, project packages, front/back matter, EPUB/PDF compilation, goals/statistics, optional read-aloud/dictation, and owned media integration. Keep existing server-persisted chapter goals. Extend shared task operation/target/result contracts and result navigation for novel jobs, and reuse media providers/owned assets. Existing card PNG export and resource PDF ingestion do not implement manuscript compilation; durable multi-step novel jobs need explicit checkpoints.

Gate: support/loss matrix, round-trip corpus, deterministic revision manifests, export cancellation/retry, accessible output, and large-project performance pass. Publishing is a separate explicit handoff, never an implicit export side effect.

**Status (audit 2026-10-18):** import of six formats with loss reports, export to Word/EPUB/PDF/Markdown/text with matter and companion files, packages, goals and the writing log, book copy, translation and completions run (slices 1–16). **Deviation:** export jobs (slice 13) use their own `story_export_job` store and an in-process runner instead of the shared task contracts, so they are not in the *Tasks* drawer and a BFF restart interrupts them. **Not started:** read-aloud, dictation, cover generation. **Gate evidence missing:** EPUBCheck, Microsoft Word and e-reader checks, accessible-output checks, large-project export limits.

## D6: author-owned series and extension

Add versioned canon/style reuse across the author's own series, visible inheritance and novel overrides, safe extension presets, and optional explicit publication handoff. Preserve existing workspace ownership and validate any licensed add-on for single-author review needs.

Gate: author-owned series isolation, source-version updates, local overrides, history/restore, preset capability limits and supported export pass. Reusing series canon must not alter prior novels or frozen context/export records silently.

## UI/UX delivery workstream

Build the UI and its persistence/AI contract together. Fix access to saving, ordinary editing, deliberate review, and recovery before expanding the assistant's mutation scope. Accessibility and responsive behavior belong in each delivery slice. UX IDs, evidence qualifications, and priorities live in [06](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work); executable acceptance tasks are in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix).

| Phase / UX items | Concrete UI deliverables | Evidence required alongside the phase's domain gate | Accountable areas |
|---|---|---|---|
| D1 · UX-01–06, UX-08/11/12 essentials | Quiet writing surface; named controls at narrow widths; persistent save/conflict/error feedback; reachable explicit review actions; focus-safe dialogs; preserved draft/caret/composer state | Keyboard-only write → revise → undo → recover; storage/auth/AI failure states; no lost input when panels update; reflow and focus checks inside the app shell | Frontend editor + shared UI + persistence; UX review; named owners TBD |
| D2 · UX-01/02/06/07/12 | Chapter/scene hierarchy and metadata; labeled scene actions; move destination and split/merge preview; restore/archive; reading presets and position restoration | Same operation works by click/tap, keyboard, and drag where offered; exact prose/identity retained; active scene remains recognizable across Write/Plan | Novel frontend + structure service + UX; named owners TBD |
| D3 · UX-03/05/06/08/09/11/12 | Ask/Suggest edits modes; visible scope and inspectable sources; original/proposed comparison; refine/stash/target-changed states; meaningful stop/recovery feedback | Actual context matches preview; request remains bound to its original scene; no implicit acceptance; acceptance/undo and server acknowledgement remain truthful; unsent chat survives navigation | Novel/assistant frontend + context/changeset services + shared UI; named owners TBD |
| D4 · UX-06/07/08/09/12 | Board/timeline/matrix over one model; evidence-linked continuity issues; personal notes/tasks; per-scene batch review with dependency-safe selection | Authors can distinguish reading order from story time and inferred findings from approved facts; jump-to-source and return preserve the working position | Novel UX/frontend + memory/assistant; named owners TBD |
| D5 · UX-01/02/04/05/10/11/12 | Import conversion preview and loss report; manuscript selection; supported-format list; progress/download/retry; optional goals/media | Original import retained; included/excluded content understood; export uses frozen versions; format support verified; mobile keyboard/zoom and output accessibility checks | Import/export frontend + BFF + UX/accessibility review; named owners TBD |
| D6 · UX-08/09/10/12 | Version-pinned series canon, local override and impact review; bounded extension controls; separately labeled publication handoff | Authors can predict which novel/version changes; previous writing and exports remain stable; no implicit publication or cross-scope context | Novel/workspace/assistant + product/UX; named owners TBD |

For each slice, record the target flow, empty/loading/error/read-only variants, keyboard/focus behavior, responsive layout, copy, token/component reuse, and linked acceptance evidence before calling its design ready. Test representative English and Spanish copy, actual mobile keyboards, and author workflows; do not defer all usability work to D6. Approval of a plan to generate changes remains separate from approval of its final passages.

The HTML's fixed breakpoints, raw controls, demo-specific localStorage, date-based knowledge examples, and simulated service states are not implementation requirements. Reuse React primitives, the manuscript adapter, scoped draft/revision services, and the shared assistant transport. The demo does not replace the schema, retention, format, or profile decisions in [13](13_sources_and_open_decisions.md).

## Repository impact and reuse

| Area | Expected work |
|---|---|
| `src/features/novel/editor/` | Manuscript adapter, selection anchors, commands, proposal/history ownership, incremental decorations |
| `src/features/novel/hooks/` | Save controller, recovery state, structure operations, memory/context integration |
| `src/features/novel/components/` | Outline, scene details, inspector, review, history/trash, delivery flows |
| `src/shared/types/story.types.ts` | Versioned novel/scene/document/changeset DTOs |
| `src/shared/types/assistant.types.ts` | Novel kind, bound targets, scope and proposal results |
| `src/shared/types/llm.types.ts` | Deliberate feature/role additions, retaining transient credentials |
| `src/infrastructure/api/` | Strict endpoints/contracts, revision/error/reconciliation handling |
| `src/app/providers/DataProvider.tsx` and router | Smaller novel summaries, scoped document state, stable resume routes and navigation guards |
| Shared assistant components/hooks | Reuse conversations/messages/composer and streaming/reconciliation; adapt the floating shell layout and mutation semantics for the inspector |
| Shared Codex/gallery and novel utility wrapper | Keep existing picker/gallery composition; re-export duplicated `lorebookEntrySnapshot`/`clonedEntryIds`, retaining novel trigger fallback |
| Shared tasks DTOs/provider, task result navigation and BFF tasks | Extend operation/target/result shapes, SQL constraints and novel result links; add novel manifests/checkpoints without another task provider |
| UI primitives, theme and i18n | Reuse components; register any tokens; English/Spanish coverage and accessible states |
| BFF `src/models/story.py`, `src/routes/stories.py` | Versioned contracts, structure/document/revision operations and context preview |
| BFF `src/services/story_generation.py`, `story_execution.py` | One context bundle, cursor/selection contract, retained execution provenance |
| BFF `src/services/assistants/{core,registry,execution}.py` and `src/models/assistant.py` | Novel handler/kind, authorized tools, proposals and changeset target vectors |
| BFF `src/services/llm_profile_{resolution,execution}.py` and catalog/models | Explicit novel-assistant/helper contracts; no hidden model or credential fallback |
| BFF database models/schema | Target document/revision/structure storage, scoped schema changes and transactional application |
| BFF `src/database/mysql/{db.sql,bootstrap.py}` and schema tooling | Current target schema, marker/seeds and reviewed scoped upgrades with a verified backup; preserve unrelated rows |
| BFF content wipe, workspace origin, jobs and owned artifacts | New data participates in ownership, archive/trash/erase, wipe and artifact cleanup; schema installation preserves existing content |
| Browser storage and `useWordGoal` | Clear known obsolete project keys, remove legacy migration code, and install the current scoped format; keep unrelated browser data untouched |
| Server-owned graph inventory | Separate task roles/contracts; keep runtime/model selection in published profiles |

Do not enlarge the existing database-model monolith unnecessarily. Extract a story-domain persistence module behind a compatibility facade when introducing the new contracts, with transaction tests protecting behavior. Avoid moving unrelated voice/workspace code as a prerequisite.

## Development database migration

The user required recovery of non-novel content after the earlier full resets. Preserve that recovered content and current novels. Use the [scope and operating sequence in 15](15_database_migration_and_legacy_cleanup.md#migration-gates-and-operating-sequence):

1. **M1 — implement the current schema and code:** update `db.sql`, marker/seeds/bootstrap, BFF services/contracts and frontend callers. Use the current D1/D2 target model, preserve installed content/history, and avoid obsolete format adapters. Remove obsolete body writers and acceptance paths.
2. **M2 — apply scoped schema changes:** verify a private backup and rehearse changes in an isolated copy. Apply only the reviewed schema/seed changes needed for the slice, preserve existing rows, and verify the current schema. Whole-database resets are disabled. Stop matching workers only when the actual change requires it; do not touch sibling services.
3. **M3 — smoke and clean up:** perform the three lean DEV checks in [12](12_validation_and_acceptance.md#database-migration-and-cleanup-acceptance), close the applicable CL removal items and record the result.

No shadow conversion, old-client read compatibility, migration journal, raw legacy archive, multi-version rollout or observation window is required. A verified backup and preservation of non-novel rows are required. Known obsolete novel browser fixtures may be handled separately from current recovery journals; unrelated browser data remains untouched.

## Legacy retirement across delivery phases

Cleanup belongs in the replacement slice. The [CL-01–CL-10 inventory](15_database_migration_and_legacy_cleanup.md#database-code-and-feature-cleanup-register) names obsolete database columns, API writers, frontend save/AI paths, editor serializers, Codex assumptions, browser keys and dead exports/fixtures. Delete replaced adapters and rollout-only tests when they have no current purpose; do not keep compatibility code solely for the discarded pre-refactor format.

Keep the 136 target capabilities, workspace rules, ordinary writing and seven inline commands through their current implementations. Runtime revisions, undo, trash and AI replay remain product features for new data. Test the behavior changed by each slice; use current schema startup, preservation checks and a short isolated-fixture smoke flow for schema changes. D4–D6 remain feature work, not migration prerequisites.

## Development recovery and scope

If schema installation or startup fails, repair the scoped change using the verified backup and isolated rehearsal. Do not rebuild the project database or discard existing rows and histories. Returning to an earlier commit does not authorize a reset; preserve the installed data independently of code checkout changes.

The earlier reset approval is not ongoing authorization. Preserve the project database, current novels, recovered non-novel content and recovery journals. Records without files are valid. Use only reviewed scoped upgrades when required; do not infer permission to reset or clean records from development status. Ordinary application writes retain ownership, revisions and explicit AI acceptance. Unrelated databases, sibling-service storage and browser data remain outside this work.

## Delivery tracking

Use [14 — Actual status and roadmap](14_status_and_roadmap.md) as the current delivery register. Track catalog rows, UX-01–UX-12, the three M1–M3 development steps and applicable CL-01–CL-10 items with owner, source finding, acceptance scenario, dependencies, migration impact, current status and evidence link. Named owners and target dates are TBD, not implied by a proposed phase. Use separate states for researched, designed, implemented, validated and shipped. The dossier's existence does not mark any application feature implemented.
