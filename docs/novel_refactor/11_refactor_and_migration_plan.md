# Refactor, migration, and delivery plan

**Documentation review:** 2026-10-14. **Status:** WIP D1; planned D2–D6 — dependency sequence with unaccepted gates, rather than completion evidence. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

**UI/UX delivery update:** 2026-10-15. The [prototype findings and UX-01–UX-12 work items](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work) extend each phase below. The standalone HTML is a design reference; this update authorizes no integration or release and completes no product gate.

This is a proposed implementation sequence. The current chapter editor is implemented behind a flag; **D1 is WIP with existing code and open reliability work**, while **D2–D6 are planned expansion**. No phase is marked shipped. The full product target is [05](05_feature_catalog.md); phases are dependency order rather than promised dates. Current status, dependencies, accountable areas, missing evidence, and TBD decisions are tracked in [14](14_status_and_roadmap.md).

Collaboration is out of scope for every phase. The plan covers one author with AI, including safe operation across that author's own tabs/devices and cached offline drafts.

## D1: reliable editor and persistence

Deliver NE-001 through NE-007, NE-009/NE-010 fidelity protection, local draft recovery, truthful save/acceptance states, and the accessibility basics. Add chapter/document revision checks, serialized save queues and durable checkpoints. Provide a basic manuscript checkpoint/restore contract before enlarging AI scope.

Keep existing source-card snapshots, profile admission/reconciliation, navigation guards, archived behavior, and workspace-origin protection. Correct the current editor rather than replacing the entire feature to fix isolated defects.

Gate: controlled stale-save ordering, accepted replacement undo/redo, failed accept flush, repeated/Unicode selections, outage/reload recovery and workspace switching all pass. Read-only and auth-expiry behavior remain correct.

## D2: document model and novel organization

Introduce schema-versioned scene documents, structure revisions, metadata inheritance, optional parts, independent scenes, and stable references. Migrate each legacy chapter into one preserved scene. Add insert/move/duplicate/split/merge/archive/trash/restore, outline view, position restoration, and manuscript revision UI.

Preserve chapter IDs and compatibility aliases for existing history and links. Assign new IDs only to newly introduced entities. Do not infer scene splits automatically. Add actual UI for currently latent POV/location/status fields.

Gate: exact-content migration and rollback fixtures, safe reorder/split/merge with links/annotations, restorable trash, and old-client write protection pass. Structured/raw source conversion reports are available.

## D3: grounded writing assistant

Add a novel assistant kind, published-profile feature/role support, reusable conversation shell, explicit scope, context compiler, evidence-linked retrieval and changesets. Move inline commands into the same proposal/review/commit pipeline. Support single-scene drafting/editing, planning assistance, custom presets, summaries, and proposed canon extraction.

Use request IDs and retained result recovery; every accepted proposal binds target revisions. Keep Ask useful without direct edits. Exact prompts and authorized context manifests become durable, credential-free provenance.

Gate: source/target correctness, token allocation, missing/changed targets, partial acceptance dependency rules, transport recovery, idempotent commit and profile/account/workspace isolation pass. Author evaluation shows useful edits without accidental acceptance.

## D4: developmental review and story structure

Add board/timeline/matrix views, source-linked continuity issues, narrative-time character knowledge, plot threads, comments/tasks, draft branching, and reviewed multi-scene plans. Derived memory is versioned and invalidated by relevant prose/structure changes.

Gate: temporal knowledge and future-revelation fixtures, stale-summary recovery, safe multi-resource application and author review of uncertain findings pass. Advanced views operate over one structure model.

## D5: portability, production, and productivity

Deliver validated Markdown/plain-text/DOCX import, full manuscript exports, project packages, front/back matter, EPUB/PDF compilation, goals/statistics, optional read-aloud/dictation, and owned media integration. Use existing media/background-job lifecycles instead of coupling novel writing to a new provider.

Gate: support/loss matrix, round-trip corpus, deterministic revision manifests, export cancellation/retry, accessible output, and large-project performance pass. Publishing is a separate explicit handoff, never an implicit export side effect.

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
| Shared assistant components/hooks | Reuse shell, conversations, streaming/reconciliation; adapt mutation semantics deliberately |
| UI primitives, theme and i18n | Reuse components; register any tokens; English/Spanish coverage and accessible states |
| BFF `src/models/story.py`, `src/routes/stories.py` | Versioned contracts, structure/document/revision operations and context preview |
| BFF `src/services/story_generation.py`, `story_execution.py` | One context bundle, cursor/selection contract, retained execution provenance |
| BFF `src/services/assistants/{core,registry,execution}.py` and `src/models/assistant.py` | Novel handler/kind, authorized tools, proposals and changeset target vectors |
| BFF `src/services/llm_profile_{resolution,execution}.py` and catalog/models | Explicit novel-assistant/helper contracts; no hidden model or credential fallback |
| BFF database models/migrations | Additive document/revision/structure storage and transactional application |
| Server-owned graph inventory | Separate task roles/contracts; keep runtime/model selection in published profiles |

Do not enlarge the existing database-model monolith unnecessarily. Extract a story-domain persistence module behind a compatibility facade when introducing the new contracts, with transaction tests protecting behavior. Avoid moving unrelated voice/workspace code as a prerequisite.

## Compatibility migration

1. **Inventory and backup:** enumerate legacy content, versions, card refs, history, active executions and deployed client versions. Test restoring representative backups. No real migration was run during this research.
2. **Additive schema:** add revision/structured-document/scene/structure tables or columns without dropping raw bodies. Define supported schema/protocol capability responses.
3. **Protocol hardening:** new clients send expected revisions. Once a document requires versioned writes, old unguarded writes are rejected with an upgrade/read-only recovery path rather than silently overwriting content.
4. **Shadow conversion:** produce structured candidates and conversion reports without changing canonical content. Preserve links, annotations, whitespace, mention IDs and unsupported source material.
5. **Per-document cutover:** migrate with expected source hash/revision; compare again under the transaction lock. If edited during conversion, retry or report conflict. Record migration lineage and idempotent progress.
6. **Dual read, single authority:** legacy documents remain Markdown-authoritative until cutover; migrated documents are structured-authoritative. Any compatibility Markdown is derived and never a second independent writer.
7. **Client rollout:** advertise supported document schemas. A client that cannot preserve a document opens it read-only with upgrade/export guidance. Gate new scene/assistant operations until required protocol support exists.
8. **Preserve history:** retained generations keep their original chapter, selection and context semantics; bridge them to the initial scene without pretending old offsets describe a later revision.
9. **Observe and expand:** compare migration fidelity, conflict rates, local recovery and request latency before broadening cohorts.

Conversion must be resumable and idempotent. Maintain exact raw source for legacy recovery. A revision or schema flag alone is not a verified migration.

## Rollback and stop conditions

Stop rollout on any lost body, incorrect target application, cross-scope data exposure, unguarded old-client write, unexplained acceptance/billing duplication, or unrecoverable draft. Restore a compatible frontend/backend pair and disable new writes while retaining read/export/recovery when necessary.

Do not roll back by converting rich documents to lossy Markdown and discarding the structured source. Keep additive storage and new revisions; use the supported compatibility reader/editor. If post-cutover edits cannot be represented by the old client, that client must remain read-only.

Rehearse reconnect and stale-write recovery for the author's own offline clients under the versioned document protocol. Retention and license choices remain implementation decisions; no collaborative provider, CRDT migration, or shared editing rollout is part of this plan.

## Delivery tracking

Use [14 — Actual status and roadmap](14_status_and_roadmap.md) as the current delivery register. Turn catalog rows and UX-01–UX-12 into work items with owner, source finding, acceptance scenario, dependencies, migration impact, current status and evidence link. Named owners and target dates are TBD, not implied by a proposed phase. Use separate states for researched, designed, implemented, validated and shipped. The dossier's existence does not mark any application feature implemented.
