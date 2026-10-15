# Novel / Story Studio — actual status and roadmap

**Reviewed:** 2026-10-14, America/Mexico_City. **Overall status: WIP.** The chapter-writing foundation exists behind a frontend flag; the complete novel refactor is not implemented. This register records source evidence, remaining work, and acceptance gates. Owners and delivery dates are **TBD**; phases express dependencies.

**UI/UX plan updated:** 2026-10-15. The standalone demo and UX-01–UX-12 add prototype evidence and implementation guidance. Product availability, NE closure, and phase completion remain unchanged; the UI update is documentation work.

## Availability and evidence

| Layer | Actual status | Evidence / limitation |
|---|---|---|
| Default example configuration | **WIP — disabled** | [`.env.example`](../../.env.example) sets `VITE_FEATURE_NOVELS_ENABLED=false`; missing or non-`true` values are also disabled by [featureFlags](../../src/shared/featureFlags.ts) |
| Reviewed local checkout | **WIP — enabled by local opt-in** | Local `.env` sets the novels flag to `true`; this is a development override, not release evidence |
| Disabled frontend behavior | Implemented gating | [Sidebar](../../src/ui/components/Sidebar.tsx) hides story navigation; [AppRouter](../../src/app/router/AppRouter.tsx) renders Not Found for disabled pages; [API methods](../../src/infrastructure/api/index.ts) throw `Novels are disabled.` before requests |
| WIP placeholder in product UI | Gap / product decision TBD | No WIP page is rendered by the current router. Documentation uses WIP status; changing the UI would require separate implementation |
| Backend story domain | Implemented source; deployment unverified | Sibling BFF `src/routes/__init__.py` registers `stories_router`; `src/routes/stories.py`, `src/models/story.py`, and `StoryModel` in `src/database/mysql/models.py` implement it. The frontend flag is not a backend authorization or route-disable mechanism |
| Focused frontend verification | Passed, limited scope | `pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts`: **27 files / 211 tests, 6.52s** on the reviewed checkout |
| Live product / release readiness | Unverified | No deployed flag/BFF/profile inventory, live author workflow, transaction integration, accessibility certification, or model-quality run from this sub-review |
| Expanded refactor | Planned | [04](04_novel_chapter_and_scene_management.md), [07](07_target_architecture.md), [08](08_ai_assistant_context_and_tools.md), [09](09_persistence_revisions_and_recovery.md); these are target contracts |
| Standalone UI demo | Prototype only; not integrated | [HTML reference](novel-studio-demo.html); 26 temporary jsdom assertions and limited browser inspection on 2026-10-15. AI/account/context fixtures and simplified local recovery do not establish product behavior |
| UI/UX implementation plan | Updated; product work planned | UX-01–UX-12 in [06](06_ui_ux_and_accessibility.md), delivery mapping in [11](11_refactor_and_migration_plan.md#uiux-delivery-workstream), application gates in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix) |

An implemented DTO, endpoint, toolbar command, or test pass is not a shipped feature. Here **implemented** means code exists, **partial** means a limited variant or lower layer exists, **planned** means a target gap, and **unverified** means required runtime/release evidence is missing. Disabled features retain **WIP** status even where their code exists.

## Implemented foundation and gaps

| Area | Actual coverage | Gap to fix / target | Evidence |
|---|---|---|---|
| Gallery and create | Implemented search/pagination, create/open/delete; blank or card source | Session-turn import, duplicate/branch, novel archive/trash, metadata breadth and release UX | [NovelGalleryPage](../../src/features/novel/components/NovelGalleryPage.tsx), [NovelCreateModal](../../src/features/novel/components/NovelCreateModal.tsx) |
| Source types | BFF/DTO accept blank, character, world, item, adventure template/session | Creation modal has no adventure-session/history picker; character-chat/lorebook source kinds from older research are absent | [story types](../../src/shared/types/story.types.ts), BFF `_source_refs()` |
| Chapter editor | Implemented TipTap, basic formatting, search/replace, focus/typewriter, beats and mention nodes | Link/Markdown fidelity, Unicode offsets/counts, stable persisted mention IDs, accepted-rewrite undo | [NovelEditor](../../src/features/novel/editor/NovelEditor.tsx), NE-002/006–010 |
| Structure | Chapter selection/create/rename/delete; body and metadata fields stored | Independent scenes/parts/series, atomic reorder, duplicate/split/merge, UI for POV/location/status, trash/restore | [NovelChapterRail](../../src/features/novel/components/NovelChapterRail.tsx), [story types](../../src/shared/types/story.types.ts), NE-016 |
| Autosave | Partial: debounce, manual save, retries, flush, unload and workspace guards | Serialize writes, acknowledge exact revision, reject stale saves, recover latest draft after crash/reload | [useChapterDraft](../../src/features/novel/hooks/useChapterDraft.ts), NE-001/013 |
| AI inline actions | Implemented continue/rewrite/expand/condense/describe/critique/custom, streaming review, regenerate/reject | Cursor-grounded context, reliable acceptance persistence and undo, explicit acceptance intent | [useInlineAI](../../src/features/novel/editor/hooks/useInlineAI.ts), NE-002–006/019 |
| History | Generated-output list, status, prompt summary and copy | Manuscript revisions/diff/restore, exact durable custom instructions, proposal lineage | [NovelGenerationHistoryDrawer](../../src/features/novel/components/NovelGenerationHistoryDrawer.tsx), NE-014/020 |
| Stash | BFF/client/DataProvider endpoint exists; stored `stashed` status | Dedicated stash action/browser/reinsert workflow in novel UI | [API client](../../src/infrastructure/api/index.ts), [DataProvider](../../src/app/providers/DataProvider.tsx), BFF `/generations/{id}/stash` |
| Codex | Story-local editable snapshots, toggles, library/lorebook entry selection, mentions/detection | Revision-bound aliases/IDs, impact review of source updates, temporal canon, story-to-card/lore extraction | [useCodex](../../src/features/novel/hooks/useCodex.ts), [CodexPanel](../../src/features/novel/components/codex/CodexPanel.tsx), NE-008/023 |
| Context | Settings and last-generation trace; preview endpoint exists | Prospective UI preview, trace/prompt equivalence, enforced input/output budget, source revisions/temporal rules | [CodexContextMeter](../../src/features/novel/components/codex/CodexContextMeter.tsx), BFF `_context_trace()` / `_chapters_for_prompt()`, NE-011/012 |
| Novel chat assistant | Planned / absent | New novel kind/profile contract, conversation scope, grounded citations and proposal/review/commit lifecycle | [AssistantKind](../../src/shared/types/assistant.types.ts), BFF `AssistantKind`, NE-015 |
| Portability and production | Planned / absent from novel UI | Full manuscript import/export, conversion-loss reporting, frozen revision manifests; copy of one generation is insufficient | [NovelStudioHeader](../../src/features/novel/components/NovelStudioHeader.tsx), NE-021 |
| Accessibility and performance | Partial / runtime unverified | Status announcements, active-option/focus semantics, deliberate review keyboard behavior; measured typing/render/save performance | NE-017/018/019; [validation](12_validation_and_acceptance.md) |

## Roadmap and dependencies

| Order / workstream | Status | Depends on | Concrete remaining work | Gate / evidence needed | Responsible area |
|---|---|---|---|---|---|
| R0 — establish availability | **WIP** | Existing gating | Record deployed build flag, compatible BFF/profile versions, disabled UX choice and intended release cohort | Enabled/disabled route and API checks; live gallery → create → save → reopen; unknown production values explicitly retained | Product + frontend + operations; named owner TBD |
| D1 — reliable editor and persistence | **WIP, partial baseline** | R0 source baseline; no scene migration needed to start | NE-001–007, NE-009/010/011/012/013; acceptance intent, metadata feedback, accessibility essentials and basic recoverable manuscript checkpoints | Exact saved-revision acknowledgement; stale writes rejected; replacement undo/redo; failed flush recovery; repeated/Unicode selection; outage/reload, workspace/account and archived behavior | Frontend editor/data + BFF story persistence; named owners TBD |
| D2 — document model and organization | **Planned** | D1 save/revision contract; schema/anchor decisions | NE-008/014/016; versioned documents, scenes/parts, structure revisions, full metadata UI, reorder/duplicate/split/merge/trash/restore | Preserved raw Markdown; migration/cutover/rollback corpus; stable IDs/history/refs; old-client write protection; structure transaction tests | Frontend novel + BFF domain/database; named owners TBD |
| D3 — grounded novel assistant | **Planned** | D1 reliability, D2 revision/target contracts; context compiler | NE-015/020; novel kind/profile, scope, retrieval, summaries, explicit changesets; shared inline/chat review and commit; stash | Trace equals actual packet; enforced budget; target/base checks; idempotent application; transport recovery; profile/account/workspace isolation; author usefulness evaluation | Assistant/profile + frontend novel + BFF; named owners TBD |
| D4 — planning, continuity and personal review | **Planned** | D2 structure + D3 proposals/memory | NE-023; board/timeline/matrix, knowledge/reveal state, plot threads, comments/tasks, reviewed multi-scene work | Source-linked continuity fixtures; stale-memory invalidation; dependency-safe partial acceptance; uncertain findings reviewed by authors | Novel product/UX + memory/assistant; named owners TBD |
| D5 — portability and productivity | **Planned** | D2 document/schema + D1 revision/recovery; format decisions | NE-021; Markdown/plain-text/DOCX import, manuscript/project export, selected EPUB/PDF workflows, goals/statistics, optional owned media/read-aloud | Format support/loss matrix; round-trip fixtures; frozen export manifest; cancellation/retry and accessible outputs; measured large-project limits | Novel frontend + BFF import/export/media; named owners TBD |
| D6 — author-owned series and extension | **Planned** | D2/D3/D4 versioned canon + D5 portability | Versioned series canon/style with novel overrides; bounded presets; optional explicit publication handoff | No silent changes to old novels/context/exports; inheritance/isolation/restore tests; extension capability and license decisions | Product + novel/assistant/workspace; named owners TBD |

All phases retain the single-author scope. Multi-user editing, presence, invitations, coeditor roles, shared reviewer access, and CRDT synchronization are **out of scope**, rather than TBD roadmap items. Phase details are in [11](11_refactor_and_migration_plan.md); acceptance matrices are in [12](12_validation_and_acceptance.md).

## UI/UX work status and next steps

The full work-item definitions and evidence qualifications are maintained in [06](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work). The following is an implementation queue, not a claim that the example design has been accepted or shipped.

| Work group | Current evidence / status | Next product work / gate | Responsible area |
|---|---|---|---|
| UX-01/02 · Prose-first layout and reading | Prototype responsive behavior inspected; app-shell, 320px, zoom, and reading-preference validation outstanding | Resolve container transitions, token-based presets, and keyboard-safe overlays; execute matching rows in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix) | Novel frontend + design system + UX; named owners TBD |
| UX-03/04/05/06 · Review, feedback, focus, and continuity of input | Review controls below the initial fold observed; phone footer and icon name corrected only in demo; panel input/focus behavior still needs production contracts | D1 essentials, then D2/D3 extensions: reachable decisions, persistent recovery, shared modal behavior, retained editor/composer state | Editor + shared UI + persistence/assistant frontend; named owners TBD |
| UX-07/08 · Organization and deliberate AI | Shared-view and explicit-review examples exist; discoverability and actual domain execution unvalidated | Implement accessible structure actions and the bounded scope → request → review → commit flow; test with authors and real services | Novel frontend + structure/context/changeset services + UX; named owners TBD |
| UX-09/10 · Memory and delivery | Illustrative knowledge/canon and limited downloads/imports only | D3–D6 memory/version behavior; D5 supported-format/loss/compilation contracts and UI | Memory/assistant + import/export + frontend; named owners TBD |
| UX-11/12 · States and validation | Failure examples incomplete; no moderated, real-device keyboard, or assistive-technology acceptance | Include full state variants and English/Spanish tasks in each slice; retain browser and author-study evidence | Product/UX + frontend + accessibility review; named owners TBD |

Prototype corrections do not close NE-017/019 or establish the production behavior described by any other NE finding. Gate D1 recovery and intentional review before widening AI scope. Product, UX, and engineering must retain both interaction evidence and the underlying document/request evidence; neither substitutes for the other.

## Open backlog and closure rules

NE-001–NE-023 in [10](10_issues_gaps_and_risks.md) are open. Current source was rechecked; prior controlled reports were preserved without rerunning those individual fixtures. Before closing an issue, retain its regression test or reproducible evidence, implementation reference, affected API/migration contract, and actual result. A general suite pass or an endpoint's existence cannot close a specific gap.

The first integrity work is ordered saves/revision checks (NE-001), recoverable local drafts/checkpoints (NE-013/014), accepted-rewrite undo and acceptance durability (NE-002/003), cursor/selection correctness (NE-005/006), Unicode/fidelity protection (NE-007–010), and honest context limits/traces (NE-011/012). These are prerequisites to widening assistant mutation scope. NE-004/017/019/022 must be included in the same user-facing reliability review; performance NE-018 needs measurement before assigning a supported manuscript-size promise.

## TBD decisions

| Decision | Status | Required before | Evidence / accountable area |
|---|---|---|---|
| WIP placeholder versus hidden/Not Found disabled UI; production cohort and enablement | **TBD** | R0 release documentation | Existing actual behavior plus product release intent; product/frontend/operations |
| Canonical schema, Markdown compatibility, block/reference IDs and wire offset unit | **TBD** | D2 migration and D3 precise targeting | Repeated passage, Unicode, Markdown/mention round-trip corpus; editor/BFF |
| Rich-text application in Python: semantic operations versus approved JSON snapshots | **TBD** | D2 writes / D3 commit | Transaction and exact-fidelity prototype; BFF/editor |
| Revision/checkpoint/trash retention, storage ceilings and logout/shared-device policy | **TBD** | D1 durable recovery release | Storage/quota/eviction, auth/account and restore scenarios; product/persistence |
| Offline guarantee and conflict UX | **TBD** | D1/D2 recovery release | Cached edits, reconnect, multi-tab/device revision conflicts; frontend/product |
| Context allocations, output reservation, helper cost/latency and AI-quality thresholds | **TBD** | D3 broadened generation | Frozen profile/graph/language corpus and author review; AI/product |
| Narrative-time/POV/unreliable-narrator and derived-memory policy | **TBD** | D4 continuity | Source evidence and future-revelation/flashback fixtures; product/memory |
| Exact import/export feature coverage and optional EPUB/PDF/media scope | **TBD** | D5 implementation | Format fixtures, loss report and author delivery tasks; product/import-export |
| Series inheritance/update behavior within workspace permissions | **TBD** | D6 | Cross-novel version pins/local overrides and isolation fixtures; product/workspace |
| Add-on/conversion licenses and hosting dependency | **TBD** | Dependency adoption | Fresh primary documentation and prototype; engineering/product |
| Named owners, work-item links, phase dates and release evidence | **TBD** | Delivery scheduling and shipped status | Assign after scoped contracts/estimates; no dates are promised here |

The full decision register is [13](13_sources_and_open_decisions.md). Documentation completion does not imply implementation completion. Update this status ledger when code, configuration, validation, or deployment evidence changes; preserve the distinction between the local development opt-in and product availability.
