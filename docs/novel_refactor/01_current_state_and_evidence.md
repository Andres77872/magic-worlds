# Current state and evidence

**Source/lifecycle reconciliation, 2026-10-15:** the earlier documentation cleanup rechecked the chapter-based boundary and open save/acceptance/search mechanisms without rerunning its historical checks. A subsequent deep migration/cleanup review revalidated frontend/BFF storage and compatibility paths and ran the focused suites recorded below. Prior controlled reproductions and prototype measurements remain dated records; the HTML demo, provider and deployed state were not exercised. [14](14_status_and_roadmap.md) owns current delivery status.

**Documentation review:** 2026-10-14. **Status:** WIP — implemented, feature-gated baseline; current source audit and focused test evidence. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

Reviewed on 2026-10-14. Frontend root: `/home/andres/WebstormProjects/magic-worlds`. Backend root: `/home/andres/PycharmProjects/magic-worlds-api`.

## D2 deliberate novel erasure evidence — 2026-10-16

**Installed and locally verified; broader D2–D6/release work remains open.**
The [delivery checkpoint](14_status_and_roadmap.md#d2-deliberate-novel-erasure--2026-10-16)
and [ADR 19](19_novel_erasure_and_retention.md) define the exact scope. The
original goal remains WIP across 136 capabilities and D1–D6.

- Full installed frontend: **5,062 passed / one conditional fixture skipped
  (543 files)**. Run `./node_modules/.bin/vitest run --exclude '.claude/**'`
  with `NOVEL_ERASE_PERSISTENCE=/tmp/novel-erase-persistence.json`,
  `NOVEL_WRITING_MARKS_PERSISTENCE=/tmp/novel-writing-marks-persistence.json`,
  `NOVEL_STUDIO_INDEX_PERSISTENCE=/tmp/novel-studio-loading-persistence.json`
  and the retained bookmark, reader, reader-window, replacement and planning
  wires from their preceding checkpoints. The new controller/dialog/gallery/
  provider tests cover receipt-first retries, storage faults, exact retirement,
  archive/owner transitions, Unicode confirmation and stale cache protection.
- Scoped installed backend: **895 passed in two non-overlapping commands**:
  833 story/manuscript/model/route/service, schema/bootstrap/migration/reset-
  isolation and execution-origin/workspace checks, then 62 existing story/
  lorebook-model and execution-workflow checks. Exact argument lists, counts and
  logs are `/tmp/novel-erase-installed-backend-result.json` and
  `/tmp/novel-erase-installed-backend-remaining-result.json`. Prepared verification
  passed 891 checks; these scopes must not be added together.
- `pnpm --config.verify-deps-before-run=false build` and
  `pnpm --config.verify-deps-before-run=false typecheck:stories` pass.
  Changed-file ESLint compares all 22 files to their baseline: 20 clean, the
  API client's 41 and DataProvider's four existing diagnostics unchanged.
  Installed logs: `/tmp/novel-erase-installed-build.log`,
  `/tmp/novel-erase-installed-stories.log` and
  `/tmp/novel-erase-installed-lint-result.json`. The lint command still exits
  nonzero for those 45 existing diagnostics; path-normalized exact comparison
  proves none was added or changed.
- `.venv/bin/python scripts/smoke_novel_erasure.py` allocates new retained
  synthetic databases only. Final content fixture:
  `magic_worlds_novel_erasure_test_3cf4cd79ef58`; upgrade fixture:
  `magic_worlds_novel_eraseupgrade_test_15218024fdcb`. The former verifies a
  forced mid-transaction rollback, concurrent identical POSTs, active-job and
  stale-title/source refusals, old creation and retained execution replay
  refusal, minimal receipt recovery, and unchanged same-title other novel and
  **70 unrelated non-novel rows**. The latter preserves **53 original rows**
  through one empty-table upgrade. Every attempted fixture is retained; no
  provider is called and no existing database is selected for test erasure.
- Controlled `Novel/Erasure and recovery` fixtures use no API or durable device
  journal. Native keyboard inspection confirms safe initial Close focus,
  exact-title gating, activation, Escape, manual-copy details and archived
  receipt reads. Images: [confirmation](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-erasure-confirmation.png),
  [recovery](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-erasure-recovery.png).
  This is desktop fixture evidence; real author/device/screen-reader and broad
  long-project acceptance remain open.

The final source manifest is `/tmp/novel-erase-installed-source.json`;
the initial reviewed bundle is `/tmp/novel-erase-ready.json`. All **55 files**
are hash-verified. `/tmp/novel-erase-docs-amendment.json` records the later factual
documentation amendment. Original sources and documentation have private guarded
backups; both existing staged patches remain identical. Full installed frontend
log/result: `/tmp/novel-erase-installed-web{.log,-result.json}`; preparation and
native wire: `/tmp/novel-erase-preparation.json`, `/tmp/novel-erase-persistence.json`.

The combined guarded operation stopped only the owned project API, created the
fresh private predecessor backup `magic-worlds-api/.dev/backups/novel-erase-pre-20261017T042326Z-2e271000.sql.gz`
(SHA-256 `b3560d53d47c7e33ee51ec3bd7960dbeade07874439d7af6fb0dec50d1350981`), and verified all **4,449 original content rows across
110 content tables unchanged** before and after the additive DDL. The backup
contains 111 tables / 4,450 rows including the marker. One empty
`story_erase_record` table was added and only the marker advanced.

Read-only runtime verification confirms **`2026_10_novel_erase`, 112 tables /
157 foreign keys**, zero erasure records, strict three-field erase writes, all
eight expected erasure/Studio/history route contracts and preserved scene
projection behavior. API PID **1585602**, owned task session **67660**, is healthy.
Evidence: `/tmp/novel-erase-{installation,installed-runtime}.json` and
[15](15_database_migration_and_legacy_cleanup.md#novel-erasure-installation--2026-10-16).
No project erasure/test CRUD, reset, reseed, database drop, media/record cleanup,
commit, PR or release was part of this installation. Broader D2 and D3–D6 remain
open; synthetic row counts above are not the project preservation count.

## D2 open-scene reconnect and reconciliation evidence — 2026-10-16

The [checkpoint](14_status_and_roadmap.md#d2-open-scene-reconnect-and-reconciliation--2026-10-16)
and [ADR 20](20_offline_and_reconciliation.md) describe the locally verified
source bundle. Full R13 cached entry and broader D2–D6 remain unfinished.

- Full installed frontend: **5,112 passed / one conditional fixture skipped
  (549 files)**. The existing retained-fixture environment adds
  `NOVEL_RECONCILIATION_PERSISTENCE=/tmp/novel-offline-persistence.json` to
  `./node_modules/.bin/vitest run --exclude '.claude/**'`. All previous prose-
  renderer tests are retained; new cases cover passive reference rendering.
  Log/result: `/tmp/novel-offline-installed-web{.log,-result.json}`.
- `pnpm --config.verify-deps-before-run=false build` and
  `pnpm --config.verify-deps-before-run=false typecheck:stories` pass. Final
  browser layout uses the existing 2xl review drawer, with English/Spanish
  singular/plural copy. The affected UI checks pass after that refinement;
  final layout build/story/lint logs are `/tmp/novel-offline-final-layout-*`.
  All 24 changed TypeScript files pass ESLint with zero diagnostics; no API
  client or DataProvider modification is part of this change.
- `NOVEL_RECONCILIATION_WIRE_OUT=/tmp/novel-offline-merge-wire.json ./node_modules/.bin/vitest run src/features/novel/persistence/sceneReconciliation.test.ts --exclude '.claude/**'`
  exports the actual canonical candidate. `.venv/bin/python
  scripts/smoke_novel_reconciliation.py` validates it through HTTP/MySQL in
  **`magic_worlds_novel_reconnect_test_5b9b8a539028`** only. Revision **5**,
  original/base/account/merge checkpoints, stale CAS refusal, exact original
  acknowledgement replay after newer prose, another unchanged novel, retained
  note body/origin and workspace archive refusal pass. The note's changed
  passage is explicitly orphaned; no attachment is invented. Workspace archive
  comes from its own API contract, not the scene inheritance flag.
- Native wire: `/tmp/novel-offline-persistence.json`; final native log:
  `/tmp/novel-offline-mysql-fourth.log`. Three earlier fixture attempts remain
  retained, with logs `/tmp/novel-offline-mysql{,-second,-third}.log`; their
  fixture contract/table/archive assumptions were corrected without selecting
  or cleaning any existing database. No provider is called.
- Controlled `Novel/Offline reconciliation` uses React fixture state only.
  Native keyboard inspection verifies safe initial focus, block choice, Escape,
  return focus, unchanged review reopening, action activation and selectable
  original device recovery. Archived controls stay disabled. Storage failure
  leaves both sources visible and refuses adoption. Images:
  [review](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reconciliation-review.png),
  [retained copy](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reconciliation-recovery.png).

Source/preparation evidence: `/tmp/novel-offline-{baseline,transfer,preparation}.json`.
The guarded source transfer completed: all **34 source/documentation files**
match their final hashes; source backups are private and both existing staged
patches remain unchanged. Evidence:
`/tmp/novel-offline-{installation,installed-source,docs-amendment}.json`.
Installed full test/build/story/lint logs and exact command/result files use
`/tmp/novel-offline-installed-*`. All 24 changed TypeScript files have zero
diagnostics; the existing mocked smoke-isolation checks add **three passes**.
Read-only runtime evidence is `/tmp/novel-offline-installed-runtime.json`. The running BFF retains
PID **1585602**, task session **67660**, and the unchanged **112-table / 157-FK**
erasure schema. No restart, database operation, project test write, media/record
cleanup, commit, PR or release is required. Existing staged patches remain
guarded. Full author/device/screen-reader and persistent cached-entry evidence
is still missing; no phase or full-goal completion is claimed.

## Availability and WIP status

The novel feature is **WIP with an implemented foundation**. The checked-in [`.env.example`](../../.env.example) sets `VITE_FEATURE_NOVELS_ENABLED=false`; this checkout's local `.env` sets it to `true`. Only exact `true` enables it. [featureFlags](../../src/shared/featureFlags.ts) gates both `gallery-stories` and `story`; [Sidebar](../../src/ui/components/Sidebar.tsx) filters their navigation entries; [AppRouter](../../src/app/router/AppRouter.tsx) renders `NotFoundPage` when disabled; the [API client](../../src/infrastructure/api/index.ts) calls `assertNovelsEnabled()` before story operations. There is no WIP route placeholder today. This frontend gate does not disable BFF `/stories` routes for other clients. Production availability and live BFF readiness are unverified.

All coverage below describes source present when the feature is enabled, rather than a shipped product or proof that every path works in production. The [status and roadmap](14_status_and_roadmap.md) records missing contracts and release gates.

## Current system

The app is a React 19 SPA with React contexts, a hand-rolled router, the Reverie design system, and TipTap 3.26.x. The frontend calls the `apiService`/workspace-scoped API clients. The FastAPI BFF owns story storage and server-owned graphs, and calls `api.magic_llm` over HTTP. The novel editor must not bypass this boundary to call a model vendor directly.

**Historical inventory (2026-10-15), superseded by the D2 integration evidence below:** the reviewed hierarchy was Story → StoryChapter. Chapter bodies are Markdown strings. Chapters include order, status, a word goal, POV/location IDs, active card references, and generation history. The type does not contain a distinct Scene or Part entity. Existing card snapshots can pin source versions; that does not give chapter bodies a revision history.

| Capability | Current coverage | Primary local evidence |
|---|---|---|
| Novel library | Search, pagination, grid/list presentation, create/open/delete | [NovelGalleryPage](../../src/features/novel/components/NovelGalleryPage.tsx), [gallery config](../../src/features/novel/novelGalleryConfig.tsx) |
| Create novel | Blank or card-based creation; first chapter initialized | [NovelCreateModal](../../src/features/novel/components/NovelCreateModal.tsx) |
| Manuscript editing | TipTap, basic marks, headings, lists, quotes, scene break, Markdown I/O | [NovelEditor](../../src/features/novel/editor/NovelEditor.tsx) |
| Chapter navigation | Select, add and confirmed delete in the chapter rail; renaming through the chapter title field in the studio; no distinct scene hierarchy | [useNovelStudio](../../src/features/novel/hooks/useNovelStudio.ts), [NovelChapterRail](../../src/features/novel/components/NovelChapterRail.tsx), [NovelStudio](../../src/features/novel/components/NovelStudio.tsx) chapter title field |
| Persistence | 1.2-second debounce, manual save, retries, flush, conditional unload warning | [useChapterDraft](../../src/features/novel/hooks/useSceneDraft.ts) |
| Navigation protection | Decline live suggestion, flush draft, hold navigation on failure | [useStudioGuards](../../src/features/novel/hooks/useStudioGuards.ts) |
| AI actions | Continue, rewrite, expand, condense, describe, critique, custom beat; streaming preview | [useInlineAI](../../src/features/novel/editor/hooks/useInlineAI.ts) |
| AI review | Accept, reject, regenerate, transient highlighting, implicit acceptance on edits | [aiSuggestion](../../src/features/novel/editor/extensions/aiSuggestion.ts) |
| Codex | Story-local card/lore snapshots, toggles, editing, mentions, trigger highlighting. Working tree (uncommitted, 2026-10-15): lorebook entries need the lorebooks flag and adventure-template refs need the adventures flag; hidden stored refs are preserved, not altered. Gap: the BFF has no frontend-flag awareness, so hidden refs that are still enabled remain in generation context, trace and token totals | [useCodex](../../src/features/novel/hooks/useCodex.ts), [CodexPanel](../../src/features/novel/components/codex/CodexPanel.tsx) |
| Search | Find and replace within the mounted chapter; case-sensitive option | [searchReplace](../../src/features/novel/editor/extensions/searchReplace.ts) |
| Productivity | Focus mode, typewriter scrolling, per-chapter word target, counts | [useEditorChrome](../../src/features/novel/editor/hooks/useEditorChrome.ts), [useWordGoal](../../src/features/novel/hooks/useWordGoal.ts) |
| History | Generated-output list, status, prompt readout, copy action | [useGenerationHistory](../../src/features/novel/hooks/useGenerationHistory.ts), [history drawer](../../src/features/novel/components/NovelGenerationHistoryDrawer.tsx) |
| Context | Stored settings; a meter based on the last chapter generation trace | [story types](../../src/shared/types/story.types.ts), [CodexContextMeter](../../src/features/novel/components/codex/CodexContextMeter.tsx) |
| Context preview and stash API | BFF/client/DataProvider operations exist; no dedicated prospective preview/stash workflow in the current novel UI | [API client](../../src/infrastructure/api/index.ts), [DataProvider](../../src/app/providers/DataProvider.tsx), backend `src/routes/stories.py` |
| Source modes | DTO/BFF accept blank, character, world, item, adventure template/session; creation modal offers blank or library card, with no session-turn picker | [story types](../../src/shared/types/story.types.ts), [NovelCreateModal](../../src/features/novel/components/NovelCreateModal.tsx), backend `_source_refs()` |
| Workspace lifecycle | Captured origin, archived read-only mode, late save isolation | [useStoryWorkspace](../../src/features/novel/hooks/useStoryWorkspace.ts) |
| Novel conversation assistant | Absent from the assistant kind contract | [assistant types](../../src/shared/types/assistant.types.ts), backend `src/models/assistant.py` |

## Boundaries and reusable infrastructure

The unified assistant contract currently supports `card`, `lorebook`, and `app`. It has conversation versions, request IDs, target compare-and-swap metadata, streaming reconciliation, and applied-action information. The app assistant is an app guide without a document mutation target. Neither is a complete novel-bound assistant.

Reuse the assistant transport, conversation shell, cancellation, reconciliation, and provenance patterns. Review mutation semantics carefully: current document-assistant tools can perform backend writes. A future novel assistant needs a deliberate proposal/review/commit contract; adding a new adapter alone does not provide it.

Relevant reuse points:

- [useAssistant](../../src/features/creation/common/components/assistant/useAssistant.ts).
- [AssistantShell](../../src/features/creation/common/components/assistant/AssistantShell.tsx) and [assistant model](../../src/features/creation/common/components/assistant/assistantModel.ts).
- [AppAssistantView](../../src/features/appAssistant/components/AppAssistantView.tsx) for established conversation composition.
- [DataProvider](../../src/app/providers/DataProvider.tsx) for existing domain integration.
- [API client](../../src/infrastructure/api/index.ts), backend `src/routes/assistant.py`, `src/services/story_execution.py`, and `src/services/story_generation.py`.

## Strengths to preserve

1. Suggestions are separated from committed manuscript text and autosave is suspended during the AI lifecycle.
2. Generation flushes the draft first and abandons a request when that flush fails.
3. Abort signals and stale-response tokens protect the mounted editor from late results.
4. Requests retain IDs for reconciliation rather than blindly generating again after a lost response.
5. Navigation waits for the draft and can hold the writer in place on save failure.
6. Codex edits affect story-local snapshots rather than silently changing library cards.
7. Workspace origin and archived read-only behavior are explicit and tested.
8. The typography, narrow manuscript measure, focus mode, and separation of critique from prose support the writing task.

## Observed test evidence

The documentation review on 2026-10-14 reran:

~~~bash
pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts
~~~

Observed result: **27 test files passed; 211 tests passed; 6.52 seconds**. This is focused frontend evidence for the reviewed checkout. It does not prove backend transactions, live provider behavior, the proposed refactor, or production readiness. The earlier dossier also reported the same 211 tests in 6.63 seconds; that earlier result is superseded by this October 14 rerun. That sub-review did not run a full application build or backend suite; the subsequent October 15 checks are recorded separately below.

## Deep migration and cleanup revalidation — 2026-10-15

The subsequent source review checked exact-schema startup verification and its existing compatible-reader pattern; chapter/novel physical deletion and cascade constraints; chapter body/context/generation recovery; assistant enums, message/result checks and profile feature seeds; timestamp-based refetch merging; browser word-goal migration; workspace root resolution; and account content wipe. The source observations remain valid. The earlier production backfill/compatibility approach was simplified to development checks. The subsequent full resets were broader than necessary; the current [15](15_database_migration_and_legacy_cleanup.md) requires preservation and scoped changes after non-novel recovery. This historical review itself migrated no database and fixed no NE finding.

Fresh focused verification from the repository roots:

~~~bash
# Frontend: exclude the nested checkout from Vitest discovery.
pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/__tests__/featureFlags.integration.test.ts --exclude '**/.claude/**' --reporter=dot

# BFF: existing local virtualenv; unit/mock-contract tests only.
.venv/bin/python -m pytest -q tests/test_schema_bootstrap.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py tests/services/test_story_execution.py tests/services/test_story_generation.py tests/test_fish_calls_migration.py
~~~

| Check | Observed result | Qualification |
|---|---|---|
| Main-checkout novel/API + feature-gating suite | **28 files / 221 tests passed, 2.84s** | Existing frontend component/unit contracts; does not recreate all NE fixtures |
| BFF schema/story + existing migration-pattern suites | **7 files / 290 tests passed, 6.11s** | Existing unit/model/route/service tests with doubles; no real MySQL DDL/transactions/provider |
| Initial frontend discovery without exclusion | **56 files: 15 failed / 41 passed; 124 tests failed / 318 passed** | The path filters also selected `.claude/worktrees/wonderful-wiles-d5ea10`; failures included cross-checkout React hook instances. The scoped rerun above is the main-checkout result, not a fix to test discovery |
| Dossier structure before development-policy revision | **14 Markdown files; 267 local links/anchors valid; 136 capabilities; 23 finding-index IDs; 7 M gates; 10 CL items; 18 DB cases** | Historical documentation snapshot. The user later superseded that seven-gate/eighteen-case proposal with three development steps and three lean DEV checks |

The historical 27-file/211-test record remains separately dated. This review added the feature-gating suite and did not run a production build, Storybook typecheck, live migration, restoration rehearsal or provider evaluation. No application source, schema or database data was changed by the documentation update. The initial discovery limitation is retained for reproducibility; do not interpret it as novel migration failure or conceal it behind the scoped pass.

## Development-only policy update — 2026-10-16

**Historical policy, now superseded:** the user originally approved a project database reset. After the resulting loss of non-novel content, the user required its recovery. [15](15_database_migration_and_legacy_cleanup.md#non-novel-content-recovery--2026-10-16) records the completed recovery. Preserve recovered non-novel content and current novels; no further whole-database resets are authorized by the earlier approval. Other databases, sibling services and unrelated browser data remain outside this work.

The policy revision replaces production backfill/compatible-reader/rollback-window work with M1–M3 and three short DEV checks. It adds no application tests and reruns no frontend/backend suite. This is a documentation update only: schema/code implementation and the DB reset have not been executed. The earlier test results above remain dated baseline evidence, not new acceptance requirements.

## Reuse and overlap revalidation — 2026-10-16

A read-only source review compared novel delivery work with shared Codex/gallery, assistant hooks/contracts/stores, LLM admission/execution, tasks, resource extraction/retrieval, media/import/export, workspace storage and the adjacent [main-assistant improvement plan](../assistant_improvement/README.md). The [reuse map in 07](07_target_architecture.md#reuse-and-overlap-decisions) records working foundations, required extensions and genuinely missing novel behavior. Shared tool/run abstractions described in the adjacent plan remain proposed, not implemented infrastructure.

Two existing duplicates were confirmed: `lorebookEntrySnapshot` and `clonedEntryIds` in the [novel Codex wrapper](../../src/features/novel/utils/codexUtils.ts) repeat the [shared Codex utilities](../../src/features/codex/utils/codexUtils.ts). CL-09 now specifies shared re-exports while retaining the novel's trigger fallback. The shared picker/gallery and server-persisted chapter goals already exist and should be extended.

NE-020's earlier durability wording was too broad. BFF [story generation](../../../../PycharmProjects/magic-worlds-api/src/services/story_generation.py) embeds custom instructions in `build_story_execution_payload`; [admission](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py) persists that payload in `tb_llm_execution_plan.frozen_payload`. [Story execution](../../../../PycharmProjects/magic-worlds-api/src/services/story_execution.py) already links the generation ID to its execution. Safe public history exposure and manuscript revision/changeset/application lineage remain work. Raw frozen payloads must not be projected into history.

This pass updates documentation only. It runs no application tests, changes no source/schema, resets no database and closes no NE finding. The focused test results above remain dated evidence. The local configured DB name and the separate mocked test default are recorded in [15](15_database_migration_and_legacy_cleanup.md#scope-of-schema-changes).

## Controlled reproduction record

The following results are **prior controlled reproduction reports preserved from the dossier**, rather than checks rerun by this documentation update. Their described mechanisms were rechecked in current source. The original report used TypeScript implementations with installed React/TipTap packages and jsdom; save/acceptance checks supplied callback doubles. No retained standalone reproduction script is included in this suite, so new implementation work must recreate the fixtures in [12](12_validation_and_acceptance.md). They are not production-incidence evidence.

| Check | Observed result | Qualification |
|---|---|---|
| Accepted rewrite → undo | `undo()` returned false; `The gate shattered like glass.` remained | Real editor extension behavior |
| Duplicate passage offsets | Second `He waited.` mapped to offset 0; actual Markdown occurrence began at 12 | Pure selection helper |
| Whitespace fallback | Returned range sliced `ine` rather than the selected `A B` | Pure selection helper |
| Beat instruction count | `One two.` counted 2; adding a beat comment counted 7 | Pure count helper |
| Chinese prose count | A multi-sentence passage without spaces counted 1 | Pure count helper; no universal cross-language word definition claimed |
| Unsupported Markdown link | `See [the gate](https://example.com).` serialized as `See the gate.` | Real configured editor; URL lost |
| Duplicate-name mention | Explicit entry `b` named Alex saved as `@Alex` and reparsed as entry `a` | Real mention serialization/parser |
| Overlapping saves | Older request completed last; simulated server held `Older edit`, visible draft held `Newer edit`, state was `saved` | Controlled hook callback ordering; not a live MySQL reproduction |
| Failed acceptance flush | Flush returned false, yet acceptance status callback ran once; phase idle, no acceptance error | Controlled hook callbacks |
| Unicode replace | Case-insensitive `cat` → `dog` in `İzmir cat` produced `İzmir cdog` | Real search extension |

Detailed causes and acceptance criteria are in [10](10_issues_gaps_and_risks.md) and [12](12_validation_and_acceptance.md). A reproduction is evidence of an implementation failure under the fixture; production frequency remains unknown.

## Standalone UI prototype evidence — 2026-10-15

The [HTML demo](novel-studio-demo.html) was created separately from the SPA to make proposed improvements reviewable. It models one sample novel and is not connected to `apiService`, the BFF, model providers, or real account synchronization. It does not update the feature-availability baseline or implement the target in the application.

During creation, **26 assertions** passed in a temporary jsdom check of sample workflows and state integrity. Covered examples included exact undo after an accepted rewrite, stale-target blocking, reviewed rebase, refinement/stash/rejection, non-drag move, duplicate/archive/restore, exact-text split and single-operation undo, simulated recovery/merge, snapshot restore, context toggles, export exclusions, import-source retention, browser-storage reopening, a canned assistant response, and separate plan/result review. Dialog/download behavior used doubles; the temporary script is not a retained regression suite or a live-service test.

Browser inspection used the default size, a **390px phone width**, and a **1440px desktop width**. Acceptance/undo and planning navigation were exercised. The initial desktop review layout required scrolling to reach decision controls. An early phone footer crowded statuses, and hiding the inspector label removed its accessible name; those two prototype issues were corrected. The final phone DOM measurement reported viewport width = page width = 390px, and the inspector control had an explicit accessible name. This does not establish 320px reflow, real-device keyboard behavior, zoom, touch operation, or screen-reader conformance.

The application `pnpm build` passed during demo creation, with a chunk-size warning. Since the demo lives under `docs/` outside the Vite application entry, the build did not execute or integrate its UI. This evidence is separate from the 2026-10-14 focused test run. The UI/UX documentation update itself did not rerun that suite or the earlier controlled defect fixtures.

Known prototype shortcuts include sample-specific localStorage, simplified chronology/knowledge, prewritten AI and recovery examples, illustrative token counts, a fixed split point, and rebuilding inspector markup. They are design references rather than production persistence, focus, context, or document contracts. The resulting work items are in [06](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work); required application validation is in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix). NE-001–NE-023 remain open.

## Verification limits

- The earlier audit reported the local API offline and no live manuscript review. This update did not repeat that browser check; current availability remains unverified.
- No complete NVDA/VoiceOver, touch-device, zoom/reflow, or IME audit was performed.
- No live typing latency, heap, large-library query plan, or model-quality benchmark was measured.
- Backend source and the focused mock-contract suites above were checked; the full backend suite, live database constraints/transactions, deployed configuration and backup restoration were not exercised.
- External comparisons use official product documentation and primary research. A described feature does not establish quality, availability in every plan, or suitability for this product.
- Source line numbers can move as other work proceeds. Function names and paths are the durable evidence anchors; refresh them before implementation.


## Execution evidence — 2026-10-16

The user requested execution and directly approved stopping this project's API and rebuilding only the disposable `magic_worlds` development database on `192.168.1.90`. `scripts/reset_development_database.py --apply` installed the current schema/seeds and exact verification passed (marker `2026_10_novel_revisions`, 103 tables, 145 foreign keys). API `/health` returned `ok` after restart. `scripts/smoke_novel_persistence.py` uses an isolated local author/workspace and fixture candidate: save/reopen, receipt replay, two concurrent writers with one CAS conflict, revision restore and atomic acceptance/replay passed through revision 5. No paid generation was performed. Initial script parser/fixture defects were corrected before the successful run.

Focused BFF verification: `.venv/bin/python -m pytest -q tests/test_schema_bootstrap.py tests/models/test_story_document_store.py tests/routes/test_story_routes.py tests/services/test_story_execution.py tests/services/test_story_generation.py tests/services/test_story_context_compiler.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py -x` — **299 passed, 4.46s**. In-process TestClient execution required sandbox escalation. Transaction-double tests cover exact receipts, altered-ID conflicts, revision/metadata checks, scope, restore and generation application; the separate MySQL smoke supplies actual DB evidence.

Frontend: `pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts src/features/appAssistant/appKnowledge.test.ts --exclude '**/.claude/**' --reporter=dot` — **31 files / 241 tests passed, 8.39s** before two additional restore-race cases; the updated save-hook file then passed all **17 tests**. `pnpm build` passed. A transient build failure in concurrently edited chat-image stories/tests was fixed by that workstream before this green build. Regression sources are linked in [14](14_status_and_roadmap.md#execution-checkpoint--2026-10-16).

Browser evidence is limited to existing Storybook authoring fixtures, including 320px Studio reflow and shared outline drawer/focus behavior; container layout tests retain the same editor node through width changes. The local live app displays the account's age/terms reconfirmation gate after reset; the agent did not accept it. Fixture APIs do not prove account saves. Hot-reload provider errors during concurrent DataProvider edits require a fresh fixture load; they are not represented as successful workflows. No full screen-reader/contrast audit, real-mobile keyboard pass, author study, paid-model-quality evaluation, large-novel benchmark or production deployment is claimed.

D1 is a working-checkout reliability milestone. Canonical scenes/stable mentions, organization/trash, the novel assistant, memory/planning, full portability and series remain D2–D6 work. Use [14](14_status_and_roadmap.md) for current disposition instead of interpreting older all-open source snapshots as current code.


Final checkpoint revalidation in this execution: **32 frontend files / 250 tests
passed (3.21s)**, `pnpm build` passed and `pnpm typecheck:stories` passed.
The focused BFF command plus `tests/services/test_manuscript.py` and
`tests/services/test_story_structure.py` passed **323 tests (5.34s)**, including
the transaction-level archived-workspace guard; 23 of these exercise prepared
D2 helpers. Targeted ESLint on the new save/history/layout/revision/selection/
journal/document modules passed. `git diff --check` passed in both repositories.
The final provider-free MySQL smoke again passed through revision 5 after the
workspace-lock change. D2's persistence module remains unconnected pending its
schema/routes/UI slice; [ADR 16](16_document_and_structure_decision.md) records
that boundary explicitly.


## D2 scene integration evidence — 2026-10-16

The active contract is now `2026_10_novel_scenes`: 106 tables / 151 foreign keys,
installed in the explicitly approved `magic_worlds` development database on
192.168.1.90. Exact verification and restarted API `/health` returned `ok`.
The earlier D1 schema/writer evidence above remains historical. The chapter-body
store and its test file were retired; current regressions live in
`tests/models/test_story_scene_store.py` and
[useSceneDraft](../../src/features/novel/hooks/useSceneDraft.test.tsx).

The provider-free `scripts/smoke_novel_persistence.py` reached scene revision 10
and structure revision 18. It verifies canonical save/reopen and receipt replay;
concurrent stale-write rejection; independent scene/chapter goals; checkpoint
restore; atomic candidate application; part/chapter/scene organization/lifecycle;
compound merge undo and rejection after later writing; new scoped reference IDs
with retained source-version pins; historical mentions after reference removal;
disabled reference restoration; and metadata summary counts. It creates its own
fixture author/workspace and makes no generation call.

Focused BFF command: `.venv/bin/python -m pytest -q tests/test_schema_bootstrap.py
tests/test_startup.py tests/services/test_story_generation.py
tests/services/test_story_execution.py tests/services/test_story_context_compiler.py
tests/services/test_manuscript.py tests/services/test_story_structure.py
tests/models/test_story_scene_store.py tests/models/test_story_workspace_models.py
tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py` —
**518 passed (5.36s)**. Route TestClient required sandbox escalation.

Frontend command: `pnpm test --run src/features/novel src/shared/storyCache.test.ts
src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/textGeneration.test.ts
src/infrastructure/api/llmIntent.test.ts src/app/providers/DataProvider.authTransitions.test.tsx
src/features/appAssistant/appKnowledge.test.ts --exclude '.claude/**' --reporter=dot`.
The checkpoint before the two gallery restoration/summary cases passed **302 tests
in 38 files**; those two additions passed in the 14-test gallery file. Final full
revalidation is recorded below when complete. `pnpm build` and
`pnpm typecheck:stories` passed before the last gallery/copy-smoke additions.
Targeted novel/shared-document/cache lint has no errors and two existing hook
warnings. `git diff --check` passed in both repos before the final documentation
update.

Desktop Storybook inspection verified nested scene navigation, chapter goal
1200 with no inherited scene goal, inherited workflow settings, metadata controls,
and a Trash review with the affected scene/prose/counts. Cancelling returned
focus to the originating Trash button. Fixture APIs do not establish account
persistence. No model call, full screen-reader/contrast audit, real-mobile pass,
large-novel benchmark, release or completion of D2–D6 is claimed. Outstanding
work is explicit in [14](14_status_and_roadmap.md#d2-scene-integration--2026-10-16).


Final D2 integration revalidation: **307 frontend tests / 38 files passed
(3.80s)**; `pnpm build` passed (Vite's existing >500 kB chunk advisory remains),
`pnpm typecheck:stories` passed, and the targeted novel/shared document/cache
ESLint command passed with **zero errors or warnings**. The updated candidate
state guard also rejects fresh stash/discard on archived scenes/ancestors;
retained admitted execution recovery remains allowed. All **325 local file
links** in the dossier resolve. The final backend result and diff check are
recorded in the delivery register. This remains a working-checkout milestone.

Final focused BFF revalidation including the scene/ancestor candidate-state
guard: **519 passed (5.18s)**. Final diff checks passed in both repos, and API
`/health` again returned `ok`.


## D2 mutation recovery evidence — 2026-10-16

The shared mutation journal, metadata draft hook, durable goal/lifecycle requests,
Codex mutation/snapshot drafts, runtime acknowledgement guards and complete
reference-head cache are connected. The header opens the shared details form;
no separate direct title writer remains. Existing UUID fallback support now
covers scene/editor/journal identity creation on LAN HTTP. The earlier scene
schema marker remains `2026_10_novel_scenes` (no storage-schema change in this
slice). The old unversioned Codex model methods and `/card-refs` routes/client
callers were removed.

Frontend command:

```sh
NOVEL_SMOKE_FIXTURE_INPUT=/tmp/novel-codex-smoke-story.json pnpm exec vitest run src/features/novel src/shared/novelMutationJournal.test.ts src/shared/storyCache.test.ts src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/storyContract.test.ts src/infrastructure/api/textGeneration.test.ts src/infrastructure/api/llmIntent.test.ts src/app/providers/DataProvider.novelLifecycle.test.tsx src/app/providers/DataProvider.authTransitions.test.tsx src/features/appAssistant/appKnowledge.test.ts --exclude '.claude/**'
```

**351 tests / 45 files passed (4.30s).** Coverage includes final-keystroke
retention, immutable request retry after reload, field-wise conflict rebase,
summary source revision pins, ownership isolation, another-writer retirement,
library recovery after interrupted Trash, exact compact acknowledgements,
complete Codex heads arriving out of order, private snapshot comparison and
LAN HTTP without `crypto.randomUUID`. The conditional MySQL-wire case was
executed against the actual synthetic smoke document; normal runs skip it
unless that fixture path is supplied.

BFF focused checks:

```sh
.venv/bin/python -m pytest tests/test_schema_bootstrap.py tests/models/test_schema_runtime_alignment.py tests/models/test_story_scene_store.py tests/models/test_story_codex_store.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py tests/services/test_story_structure.py tests/services/test_story_context_compiler.py tests/services/test_story_generation.py tests/services/test_story_execution.py tests/services/test_manuscript.py -q
.venv/bin/python -m pytest tests/test_startup.py -q
```

**356 passed (4.79s), plus 190 startup checks (1.82s): 546 total in two
non-overlapping commands.** Route TestClient/startup checks required the existing
sandbox escalation. Codex tests verify one transaction for the selection/head/
receipt, stale context rejection before source resolution, exact replay after
source removal/archive, duplicate-batch rollback, immutable source pins and
safe disabled restore. Existing scene/structure/context/execution checks pass.

Provider-free actual MySQL verification:

```sh
NOVEL_SMOKE_FIXTURE_OUTPUT=/tmp/novel-codex-smoke-story.json .venv/bin/python scripts/smoke_novel_persistence.py
```

Passed with **scene revision 10 / structure revision 18 / context revision 6**.
The expanded smoke verifies that a duplicate later in a Codex selection leaves
no earlier insertion or context revision behind, two context writers have one
winner, and the winner's original receipt replays exactly. Existing save,
acceptance, restore, organization, inherited goals, historical mentions and
source-pin checks remain green. It creates only its synthetic author/workspace
and calls no generation provider. The pre-existing MySQL `VALUES()` deprecation
warning remains. The local API health returned `ok` after route replacement.

`pnpm build` passed (521ms Vite build after typecheck); the existing >500 kB
bundle advisory remains. Final Storybook typecheck, targeted novel/shared lint
and diff/link checks are recorded in the delivery register. Full authenticated
browser/assistive-technology, author-quality and long-document acceptance remain
open; this checkpoint does not complete D2, D3–D6, offline support or release.

## D2 novel copy evidence — 2026-10-16

The library/Studio copy dialog, scoped request journal, runtime wire guards,
transactional BFF copy and frozen provenance reader are connected. This slice
uses existing scene/structure/receipt tables, adds no schema change and leaves
the project database untouched. The current preservation policy remains in
force. At this copy checkpoint, creation recovery remained open; the following
checkpoint records its implementation. Unit copy options and the remaining
D2/history/annotation/performance and D3–D6 gates remain open.

Frontend regression command:

```sh
pnpm exec vitest run src/features/novel src/infrastructure/api/storyCopy.test.ts src/infrastructure/api/storyCopyContract.test.ts src/infrastructure/api/storyContract.test.ts src/infrastructure/api/storyChapters.test.ts src/shared/novelMutationJournal.test.ts src/shared/storyCache.test.ts src/app/providers/DataProvider.novelLifecycle.test.tsx src/app/providers/DataProvider.authTransitions.test.tsx --exclude '.claude/**'
```

**47 files / 328 tests passed, one conditional fixture test skipped (4.03s).**
Copy coverage includes immutable retry/reload recovery, missing-response result
reads before POST, archived read recovery, stale-source rejection, old-writer
adoption/retirement, account/workspace response isolation, save/review barriers,
dialog options, explicit refresh, unmounted-dialog protection and frozen origin
inspection. Preview guards require eight distinct combinations with no prose;
acknowledgements bind every immutable request field. Provenance guards validate
source revisions, fresh identity maps, selected counts and target ownership.

After the final isolated MySQL run and count-label edit, these checks ran:

```sh
pnpm exec vitest run src/infrastructure/api/storyCopyContract.test.ts src/features/novel/components/NovelCopyModal.test.tsx --exclude '.claude/**'
pnpm exec vitest run src/features/novel/components/NovelGalleryPage.test.tsx --exclude '.claude/**'
```

**7/7 passed (1.12s)**, including the actual MySQL/API target and frozen
manifest through the frontend guards. **15/15 gallery checks passed (2.16s)**
after adding the full review → copy → explicit Open copy journey and archived
workspace restrictions. These commands overlap the wider regression scope and
are not additional independent totals.

BFF coverage passed **199 focused novel checks (2.01s)**, including all **16**
new cases in `tests/services/test_story_copy.py`,
`tests/models/test_story_copy_store.py` and
`tests/routes/test_story_copy_routes.py`. They cover exact rich prose and remapped
mentions, snapshot/version pins, notes/context/lifecycle selections, omitted
scope tombstones, current/stale/unpinned summaries, source version/receipt
binding, owner/read-vs-write authorization, transaction rollback and insert-only
unit creation. Copy routes use the existing workspace and story boundaries;
there is no new provider integration.

Provider-free actual MySQL verification:

```sh
.venv/bin/python scripts/smoke_novel_copy.py
```

The script always creates a new uniquely named synthetic database and retains
it for inspection; it neither selects nor mutates the configured project
database. Final result: **`magic_worlds_novel_copy_test_e7f0dec5a3e1`, success**.
Actual HTTP/MySQL checks verified preview, copy, exact concurrent receipt replay,
frozen source revision 2, new target heads/checkpoints at revision 1, complete
source preservation, stale-source and changed-intent rejection, insert collision
rejection, late-failure rollback and archived-workspace result/provenance reads.
Two distinct requests created exactly two independent copies. The emitted
`/tmp/novel-copy-smoke-story.json` and
`/tmp/novel-copy-smoke-provenance.json` contain only synthetic fixtures. Existing
MySQL integer-width/`VALUES()` deprecation warnings remain.

`pnpm build` passed after the final production string edit; the existing
>500 kB bundle advisory remains. Storybook typecheck and targeted copy lint
passed. The later gallery-test addition also passed TypeScript/lint checks.
Read-only API verification returned health `ok` and confirmed all four copy
routes in OpenAPI. No manual API restart or project database write was needed.

Desktop browser inspection of the Storybook review dialog confirmed the title,
inclusion switches, changing option counts and reachable actions. It uses
controlled fixtures and is not authenticated author persistence, full mobile,
assistive-technology, model-quality or long-document evidence. D2 remains WIP.

## D2 creation recovery evidence — 2026-10-16

Creation now requires one stable request ID and commits the novel, insert-only
chapters/scenes, initial checkpoints and exact intent receipt together. The
server derives the target identity from owner/application/workspace/request
scope. An exclusive workspace lock serializes simultaneous first requests;
source resolution reuses the same transaction cursor rather than borrowing a
connection while other writers wait. Existing receipt replay precedes source
resolution. There is no schema change, legacy unguarded creation writer or
generation-provider call.

DataProvider owns the shared creation coordinator across library, landing page
and card-gallery callers. Requests are journaled before POST. Recovery reads the
original receipt before retrying; a confirmed receipt survives a failed
manuscript read. Pending work blocks replacement creation. Late results retain
their original owner/workspace and cannot populate or navigate another session.
Library, Studio and creation-dialog notices expose explicit recovery/open;
Studio opening keeps the existing save/review barrier. Another writer's record
is adopted and retired exactly. Storage failure retains visible in-memory work.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/features/landing/components src/features/gallery/hooks/useGalleryCardActions.test.tsx src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/app/providers/DataProvider.authTransitions.test.tsx src/infrastructure/api/storyCreation.test.ts src/infrastructure/api/storyCreationContract.test.ts src/infrastructure/api/storyCopy.test.ts src/infrastructure/api/storyCopyContract.test.ts src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/storyContract.test.ts src/shared/novelMutationJournal.test.ts src/shared/storyCache.test.ts --exclude '.claude/**'
```

**392 tests / 59 files passed, one conditional fixture test skipped (5.35s).**
The actual synthetic MySQL creation receipt and copy/provenance fixtures passed
their runtime guards. New coverage includes journal-before-POST, uncertain
response/reload reads without duplicate creation, original-intent retry,
post-acknowledgement reader failure, archived result recovery, transferred
writers, late-owner isolation, rapid duplicate calls, definite validation
failure, storage denial, explicit open, save/review blocking and unmounted
recovery views. The API client verifies every original request field before
acknowledging the result. No manuscript prose is included in the receipt.

BFF command:

```sh
.venv/bin/python -m pytest tests/models/test_story_creation_store.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/models/test_story_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_codex_store.py tests/scripts/test_novel_smoke_isolation.py -q
```

**202 passed (2.15s)** after the final source-cursor and smoke-isolation changes. Scope includes
creation intent bounds, exact replay before source lookup, complete transaction
writes/rollback, insert-only units, derived owner/workspace identity, scoped
source reads on the existing cursor and read-vs-new-work authorization. Existing
scene/Codex/copy/model/route checks remain green. These use fake databases;
TestClient required the existing event-loop sandbox escalation.

The shared smoke allocator is checked to omit the configured database from its
server connection, select only its newly created database, stop on a name
collision and reject an invalid name prefix before connecting. It never drops
or reuses an existing database.

Provider-free real HTTP/MySQL smoke:

```sh
.venv/bin/python scripts/smoke_novel_copy.py
```

Passed in the new isolated synthetic database
**`magic_worlds_novel_copy_test_719c2a47c935`**. It verifies creation receipt
recovery after later title edits, simultaneous identical creation, changed-intent
rejection, initial scene checkpoints, rollback after receipt failure,
identity-collision rejection, eight missing-source creations over a
four-connection pool, and archived receipt reads. Existing independent-copy
checks pass in the same fixture. The configured project database was neither
selected nor changed; no existing test database was dropped. The smoke emits
only synthetic data to `/tmp/novel-creation-smoke-receipt.json` and the copy
fixtures. Existing MySQL integer-width/`VALUES()` advisories remain.

The older persistence smoke now uses the same isolated allocator instead of
requiring the project database. Its updated creation caller and broader
scene/structure/Codex flow passed in
**`magic_worlds_novel_persistence_test_49b361b30831`**, reaching scene revision
**10**, structure revision **18** and context revision **6**, with
`project_database_touched=false`. Both smoke scripts retain their synthetic
databases. The frontend copy/creation wire guards then passed **7/7** against
the latest creation/copy fixture files; this overlaps the wider frontend scope.

The first real concurrent test exposed the use of a shared admission lock; the
creation writer now explicitly takes the exclusive workspace lock. A subsequent
source-read review kept preparation on the same transaction to avoid pool
starvation under waiting writers. The final unit and MySQL checks above verify
both corrections. Failed intermediate synthetic databases are retained.

`pnpm build` passed (590ms Vite build after typecheck; existing chunk advisory).
`pnpm typecheck:stories` and targeted creation/novel/landing/gallery lint passed.
Read-only API health returned `ok`; OpenAPI exposes the recovery GET and requires
`requestId` on creation. No manual API restart was needed.

Desktop Storybook inspection verified that uncertain creation disables Create,
recovery exposes the confirmed target and Open novel remains explicit. It uses
controlled fixtures, not a signed-in author session. General offline/storage
policy, full author/mobile/assistive-technology, size and model-quality acceptance
remain open. This completes the local creation-recovery slice, not D2 or D3–D6.

## D2 unit copy options evidence — 2026-10-16

Chapter/scene duplication now reviews a saved source, an independent bounded
title and explicit notes/local Codex options. Chapter review also selects archived
and trashed children, with scene/word counts and prose excerpts. Text/metadata
heads for every source scene, unit metadata, structure and context revisions
bind the reviewed operation. Editor save/AI-review barriers run before reading
the source and before committing; a changed source requires refreshed review.

Copies retain exact rich prose, goals and writing settings with fresh
unit/block/local-reference identities. Included children retain their lifecycle
states. Required mention/POV/location/cast pins survive exclusion of optional
local context as disabled snapshots; inherited context remains shared.
Historical and current pins of the same card can coexist. Verified summaries
point to the copy's revision 1; stale or unpinned summaries remain unverified.
Source candidates/history/jobs stay with the source. Insert-only new units,
checkpoints, options/provenance history and the fully bound receipt commit
together, with rollback on source/identity/context/receipt failure.

Organization journals deep-clone the original intent and lock uncertain
choices. Scoped `GET /stories/{story_id}/structure-requests/{request_id}` reads
receipts before any retry, including while archived. Failed manuscript reads
retain a confirmed receipt. Missing results cannot trigger archived writes.
Retained older acknowledgements remain readable without allowing fresh
unguarded copies. Studio recovery observes the editor save/review barrier.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/features/landing/components src/features/gallery/hooks/useGalleryCardActions.test.tsx src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/app/providers/DataProvider.authTransitions.test.tsx src/infrastructure/api/storyUnitCopy.test.ts src/shared/storyUnitCopy.test.ts src/infrastructure/api/storyCreation.test.ts src/infrastructure/api/storyCreationContract.test.ts src/infrastructure/api/storyCopy.test.ts src/infrastructure/api/storyCopyContract.test.ts src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/storyContract.test.ts src/shared/novelMutationJournal.test.ts src/shared/storyCache.test.ts --exclude '.claude/**'
```

**410 tests / 63 files passed, one conditional fixture skipped (4.57s).**
The actual synthetic MySQL copy acknowledgement/manuscript fixtures passed
their frontend runtime guards. Coverage includes explicit choices, saved-source
barriers, complete source vectors, immutable retry, archive-safe recovery,
post-acknowledgement read failure, independent identity and rich text.
Regression tests reproduced three empty-container selection failures before the
fix: empty copied chapters (with no children or only Trash) and an empty part
fell back to unrelated prose. The corrected selection stays empty, survives
reopening and makes Add scene target the selected chapter; an empty part creates
its first chapter inside that part. Obsolete selections still fall back to
available prose. The focused Studio/structure command passed **28/28**; it
overlaps the broader command.

BFF command (from the sibling backend):

```sh
.venv/bin/python -m pytest tests/models/test_story_creation_store.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/models/test_story_copy_store.py tests/models/test_story_unit_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_codex_store.py tests/scripts/test_novel_smoke_isolation.py tests/services/test_story_structure.py tests/services/test_story_copy.py tests/services/test_manuscript.py -q
```

**249 passed (3.35s)** using fake databases. Scope includes reviewed copy guards,
scene selection, summary verification, required reference pins, atomic insert
and receipt rollback, exact replay and read/new-work authorization. TestClient
uses the existing sandbox escalation. No provider or project database is used.

Provider-free real HTTP/MySQL commands:

```sh
.venv/bin/python scripts/smoke_novel_unit_copy.py
.venv/bin/python scripts/smoke_novel_persistence.py
```

The unit-copy smoke passed in the newly allocated synthetic database
**`magic_worlds_novel_unitcopy_test_7839eef2d7c7`**, including reviewed choices,
exact rich prose and old/current snapshot pins, excluded optional context,
candidate separation, source preservation, replay after later edits, stale-source
rejection, concurrent identical requests, late receipt-failure rollback,
cross-novel identity collision rejection and archived receipt reads.
The existing persistence flow passed in
**`magic_worlds_novel_persistence_test_ecbfa96ea130`**, reaching scene/structure/
context heads **10/18/6**. Both report `project_database_touched=false`, retain
their synthetic databases and never reuse/drop an existing database. The
configured project database and files were untouched. MySQL's existing integer
width and `VALUES()` advisories remain.

`pnpm build`, `pnpm typecheck:stories` and targeted lint passed, including the
final empty-container correction. The existing large-chunk build advisory
remains. Desktop Storybook inspection of `Novel/Unit copy` verified the title
and notes/context/lifecycle controls, source excerpts, reachable actions and
selected counts changing from one scene to three. It uses controlled fixtures.

The earlier managed development API process was no longer listening on port
8010. Starting it with the existing launch configuration restored service;
startup verified the existing schema. Read-only `/health` returned `ok`, and
OpenAPI exposes the structure receipt recovery GET. No reset or migration was
performed. The temporary Storybook preview/server were closed after inspection.

This is local implementation evidence. Full authenticated author, mobile and
assistive-technology checks; source-vector size and long-document measurements;
remaining history/compound undo contracts; and annotation/comment copying
remain open. S05 is partial, D2 remains WIP and D3–D6 remain planned. The
136-capability scope is unchanged.


## D2 organization history evidence — 2026-10-16

Organization now exposes small cursor-paginated history, action/date filters,
one-event before/after outline comparison and reviewed multi-step undo/redo.
The current source head binds the reviewed operation. Editor save/AI-review
barriers protect both review and commit. Pending requests use the existing
immutable journal and owned result recovery; reads work while archived and new
writes do not. A newer remote outline requires refreshing manuscript and history.
Late results stay scoped; definite conflicts require refreshed review.

Every event records its actual transactional before-image. The old preceding
structure snapshot could predate independent prose saves and was not a valid
prose baseline. Reversal now applies only the selected event's deltas. Later
unrelated writing/titles/notes/context survive. Affected rich prose restores an
exact validated/hash-checked checkpoint under a new head; trusted history
lineage permits successive undo/redo while independent affected edits still
block an unsafe reversal. Newly hidden units guard later author work. Touched
metadata fields and affected reference flags/signatures/pins are checked;
unrelated Codex changes survive. Pending/stashed alternatives block changes
that rewrite or hide their scene. Units, checkpoints, references, context/history
heads and exact request-bound receipts commit atomically.

New branches clear the redo head without deleting its events. Copied roots keep
their frozen initial provenance when organization starts. Older records without
verified before-images remain readable and cannot be guessed reversible. The old
`restore_structure` fresh writer, pure helper and smoke caller are retired;
existing exact receipts remain recoverable. No schema change was introduced.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/features/landing/components src/features/gallery/hooks/useGalleryCardActions.test.tsx src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/app/providers/DataProvider.authTransitions.test.tsx src/infrastructure/api/storyHistory.test.ts src/infrastructure/api/storyUnitCopy.test.ts src/shared/storyUnitCopy.test.ts src/infrastructure/api/storyCreation.test.ts src/infrastructure/api/storyCreationContract.test.ts src/infrastructure/api/storyCopy.test.ts src/infrastructure/api/storyCopyContract.test.ts src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/storyContract.test.ts src/shared/novelMutationJournal.test.ts src/shared/storyCache.test.ts --exclude '.claude/**'
```

**424 tests / 66 files passed; one conditional fixture skipped (5.45s).**
Actual synthetic MySQL history page/detail/exact-receipt fixtures passed the
frontend runtime guards. UI regressions cover both save/review barriers, exact
single-flight intent, archived/pending restrictions, conflict refresh, later-page
read failure/retry, late-scope isolation, recorded dates, refreshing a newer
manuscript, readable older outlines and comparison of only affected units.

BFF command, from the sibling backend:

```sh
.venv/bin/python -m pytest tests/models/test_story_creation_store.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/models/test_story_copy_store.py tests/models/test_story_unit_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_codex_store.py tests/models/test_story_history_store.py tests/scripts/test_novel_smoke_isolation.py tests/services/test_story_structure.py tests/services/test_story_copy.py tests/services/test_story_history.py tests/services/test_manuscript.py -q
```

**263 passed (3.66s)** using fake databases. Coverage includes actual before-state
semantics, independent prose/metadata preservation, touched-field conflicts,
trusted restoration lineage, later-work guards on new/hidden units, constant-size
linked undo/redo heads and branch retirement, scoped small list/detail queries,
bound pagination/filters, archived/missing-workspace authorization, old-history
read safety and retirement/recovery of the old writer.

Provider-free real HTTP/MySQL commands:

```sh
.venv/bin/python scripts/smoke_novel_history.py
.venv/bin/python scripts/smoke_novel_persistence.py
```

The final history smoke passed in newly allocated database
**`magic_worlds_novel_history_test_e4f5f094f0d2`**. It verifies writing before/after
moves survives undo/redo; multiple chapter/create/move reversals; exact marked
Unicode split/merge reversal and redo; stale affected writing and stale reviewed
heads; concurrent identical replay and changed-intent rejection; stored candidate
blocking; original frozen reference identity/state on redo; unrelated Codex
preservation and relevant-pin rejection; late receipt-failure rollback of both
manuscript and history; copied-root provenance; actual 50-row pagination with
nonoverlapping cursors, date/action filters, private-field omission and archived
list/detail reads with writes blocked. Synthetic page/detail/receipt files under
`/tmp/novel-history-smoke-*.json` feed the frontend guards.

The broader persistence smoke passed in
**`magic_worlds_novel_persistence_test_03350f0afae3`**, using the reviewed undo
caller and reaching scene/structure/context heads **10/18/6**. Both report
`project_database_touched=false`; the shared allocator never selects the project
database, reuses a database or drops existing data. Failed intermediate synthetic
databases are retained. Existing MySQL integer-width/`VALUES()` advisories remain.

The first isolated run reproduced a DATETIME(0) mismatch: MySQL rounded a
fractional Trash timestamp up, while the immutable outline truncated it. SQL
writes and history now use the same second-precision value; a regression and the
final MySQL chains verify it. Browser review also exposed unchanged parent rows
being counted as changes because their child arrays moved; comparison now
considers each unit's own fields, with a failing-then-passing regression.

`pnpm build` passed (492ms Vite build after typecheck; existing large-chunk
advisory). `pnpm typecheck:stories` and targeted lint passed. API `/health`
returned `ok`; OpenAPI exposes the detail GET and cursor/action/date parameters.
No project database test writes, migration, reset or manual API restart occurred.

Desktop Storybook `Novel/Organization history` verified readable controls and
explicit undo review showing the affected scene's before/after chapter with
reachable Cancel/Apply actions. It uses controlled fixtures, not a signed-in
writer. Named manuscript snapshots, complete scene-history/filter contracts,
annotation/comment copy, further nested/compound acceptance, full author/mobile/
assistive-technology checks and long-project measurements remain open. The full
136-capability D1–D6 objective remains unchanged and incomplete.

## D2 named manuscript capture evidence — 2026-10-16

Studio now captures named saved milestones, compares their manifests with the
current saved manuscript and reads original scene prose/notes/Codex pins. The
manifest freezes all unit metadata/organization/goals/lifecycle and reference
snapshots, while scene entries point to immutable revision/hash checkpoints.
No duplicate prose store, schema change or generation-provider call was added.
Capture verifies the source vector, structure head and checkpoint pointers in
one transaction; exact receipt recovery uses the existing organization journal.
It preserves canonical content, undo/redo heads and trusted document lineage.

Evidence: [snapshot drawer](../../src/features/novel/components/NovelSnapshotDrawer.tsx),
[scoped source hook](../../src/features/novel/hooks/useSnapshotSource.ts),
[comparison helper](../../src/features/novel/utils/manuscriptSnapshots.ts),
[wire guards](../../src/infrastructure/api/storySnapshotContract.ts),
[actual-wire regressions](../../src/infrastructure/api/storySnapshots.test.ts).
BFF sources are `src/models/story_snapshots.py`,
`src/services/story_snapshots.py`, `src/database/mysql/story_snapshot_store.py`
and the five snapshot GETs in the existing story router.

The recorded organization-history frontend command above, with
`src/infrastructure/api/storySnapshots.test.ts` added, passed **442 tests /
70 files; one conditional fixture skipped (5.26s)**. Discovery under
`src/features/novel` includes the new drawer, comparison and source-hook tests.
They verify both save/review barriers, exact request/note binding, single flight,
scoped late reads/form isolation, original frozen prose/pins, current-head
revalidation, archived uncertain recovery, explicit refreshed review and retained
over-limit Unicode input. The actual isolated MySQL list/detail/comparison/scene/
receipt files passed the frontend guards; foreign/future/mismatched payloads fail.

The recorded organization-history BFF command above, with
`tests/models/test_story_snapshot_store.py` and
`tests/services/test_story_snapshots.py` added, passed **281 tests (2.53s)**.
These fake-database checks verify atomic writes, receipt-first replay, stale
source/missing-checkpoint rejection before insert, small projected pages, owned
frozen checkpoint joins, hash/format/budget validation and all five archived
read routes with missing/foreign selector rejection.

Provider-free HTTP/MySQL command:

```sh
.venv/bin/python scripts/smoke_novel_snapshots.py
```

It passed in newly allocated **`magic_worlds_novel_snapshots_test_a851f29a799b`**:
marked Unicode prose and mentions, independent goals/notes, archive/Trash,
historical/current version pins and later local edits, concurrent identical
capture, original exact receipt after later writing, changed-intent/stale-source
rejection, late acknowledgement-failure rollback, capture between successive
merge/split undo operations, nonoverlapping 50-row cursor pages, archived readers
with writes blocked, and foreign-scene exclusion. Deliberate corruption and
unknown-version checks affected only a synthetic capture and rejected reads;
the original capture/current manuscript remained intact. Synthetic fixtures
under `/tmp/novel-snapshot-smoke-*.json` feed frontend runtime guards. The script
reports **`project_database_touched=false`** and retains its database; it does
not reset/reuse/drop existing data. Existing MySQL deprecation advisories remain.

`pnpm build` passed after typecheck (492ms Vite build, existing large-chunk
advisory). `pnpm typecheck:stories` and targeted snapshot lint passed. Controlled
desktop Storybook `Novel/Manuscript snapshots` verified original/current prose
and notes with the original version-3 pin, reviewed name/note/counts, then
capture and its new list entry. Browser proof is saved as
`novel-manuscript-snapshot-comparison.png` and
`novel-manuscript-snapshot-capture.png` in this chat's visualization folder.

**At this capture checkpoint, reviewed in-place whole-manuscript restore remained pending**, including
explicit handling of later-created units and guarded text/metadata/structure/
context restoration. Capture, comparison or copying is not a substitute.
Complete scene-history/filter, annotation/comment copy, nested/compound,
authenticated author/mobile/assistive-technology and measured long-project
acceptance remain open. The full 136-capability D1–D6 goal remains WIP.

Final read-only `/health` returned `ok`; OpenAPI exposes all five snapshot GETs.
Targeted snapshot lint and staged/unstaged whitespace checks passed in both
repositories. No manual API restart or project database test write occurred.

## D2 manuscript restore evidence — 2026-10-16

Reviewed in-place restore is now connected to Studio's manuscript snapshots.
Independent text/details/organization/context choices and a keep/Trash policy
for every later unit produce one saved-source review. The author can inspect
changed metadata and exact current/original prose before applying. Options
survive closure in their owner/workspace/novel/snapshot scope. Both save/AI-review
barriers run; stale source or mismatched current prose requires explicit refresh.
An uncertain write keeps its original immutable journal request and receipt-first
recovery, including archived result reads.

The BFF uses one pure compiler for preview and commit, exact source/structure/
manifest guards, and batched owned checkpoint reads. All original and target
prose hashes are verified before writes. Later units cannot be silently hidden
under restored ancestors; earlier writing now in a later container cannot be
hidden by choosing Trash for that container. Pending/stashed alternatives block
rewrites or new hiding. Original/current Codex pins swap in the final atomic
reference set, retaining immutable provenance and readable later tombstones.

Changed canonical prose receives new checkpoints; metadata/context authorities
advance independently. Verified summaries map to restored heads. Full novel/unit
before-images, reference contents, structure history and exact request receipts
commit together. History undo/redo preserves later unrelated notes/writing/context
and guards touched details/prose/reference values. New outline records bind their
checkpoint hashes to actual documents, so even a self-consistent but altered
older checkpoint cannot substitute different prose during undo. Older events
remain readable with their recorded fields and do not gain invented hashes.

Implementation: [restore review](../../src/features/novel/components/NovelSnapshotRestoreReview.tsx),
[snapshot entry/recovery](../../src/features/novel/components/NovelSnapshotDrawer.tsx),
[source scope](../../src/features/novel/hooks/useSnapshotSource.ts),
[restore wire guards](../../src/infrastructure/api/storySnapshotContract.ts),
[exact receipt checks](../../src/infrastructure/api/storyContract.ts),
[saved novel/reference history](../../src/features/novel/components/NovelStructureHistory.tsx).
BFF: `src/models/story_snapshots.py`, `src/services/story_snapshot_restore.py`,
`src/database/mysql/story_snapshot_restore_store.py`, the extended
`story_scene_store.py` / `story_history.py` and the read-intent restore-preview route.
No schema/marker change, project reset or provider execution was required.

The preceding named-capture frontend command, additionally including
`src/infrastructure/api/storySnapshotRestore.test.ts`, checks the novel feature,
all creation entry points, recovery/cache and existing copy/history contracts.
The new restore component, source hook and history reader are included by the
existing `src/features/novel` discovery. Runtime guards verify actual isolated
MySQL review/receipt/history payloads and reject omitted author changes, missing
units, rewound heads, changed options and inconsistent blockers. UI regressions
cover both barriers, exact single flight, recorded root/reference comparisons,
archived uncertain recovery, unsent choices, stale prose refresh and late scopes.
The final run passed **456 tests / 72 files, one conditional fixture skipped
(5.62s)**. `pnpm build` passed after typecheck (540ms Vite build; existing
large-chunk advisory). Storybook typecheck and targeted restore/history lint passed.

The preceding named-capture BFF command, additionally including
`tests/services/test_story_snapshot_restore.py` and
`tests/models/test_story_snapshot_restore_store.py`, passed **301 tests (2.64s)**
using fake databases. It includes strict options, category preservation, later-unit
visibility in both directions, current/target checkpoint ownership and absence,
atomic metadata/prose/history/receipt writes, source/hash conflicts, rollback,
final-set reference swaps/immutable pins, owned archived preview routing and safe
projection of recorded reference contents without current-source fallback.

Real provider-free HTTP/MySQL commands:

```sh
.venv/bin/python scripts/smoke_novel_snapshot_restore.py
.venv/bin/python scripts/smoke_novel_history.py
.venv/bin/python scripts/smoke_novel_persistence.py
```

The final restore smoke passed in newly allocated
**`magic_worlds_novel_snapshotrestore_test_15959c938236`**. It verifies marked
Unicode prose/mentions, original notes/goals/title/parents, summary mapping,
old local pin bodies with v3/v4 provenance, all later units including automatic
chapter scenes, both later-visibility protections, concurrent exact replay,
changed intent, stale global source, late acknowledgement-failure rollback,
restore/undo/redo with unrelated later notes/audience/threads/writing retained,
independent affected pin/prose and pending-candidate rejection, actual explicit
later-unit Trash and undo, archived read-only review/result recovery and blocked
archived writes. Synthetic checkpoint faults verify corrupt capture targets and
a self-consistent changed undo checkpoint are rejected; their original synthetic
rows are restored in `finally`. No current manuscript is substituted. Actual
wire fixtures are `/tmp/novel-restore-smoke-{preview,receipt,history}.json`.

The existing organization smoke also passed in
**`magic_worlds_novel_history_test_359e49ec2acc`**; broader persistence passed in
**`magic_worlds_novel_persistence_test_f7635416f656`** at scene/structure/context
heads **10/18/6**. These runs precede the added outline hash assertion; the final
restore smoke exercises that assertion and its real undo chain. Every script
reports **`project_database_touched=false`**, uses the shared fresh-only allocator
and retains its synthetic database. Existing MySQL deprecation advisories remain.

Controlled desktop Storybook `Novel/Manuscript snapshot restore` verified
independent choices, saved/current note and prose comparison, reachable Apply/
Cancel and confirmed completion. Proof files in this chat's visualization folder:
`novel-manuscript-restore-review.png` and
`novel-manuscript-restore-confirmed.png`. The running API `/health` returned `ok`
and OpenAPI confirms the new read-only restore-preview POST. No manual API restart
was needed. Authenticated author/mobile/assistive-technology acceptance, remaining
scene-history/filter/retention, annotation/comment copy, nested/compound and
measured long-project behavior remain open. The full 136-capability D1–D6 goal
remains active and incomplete.

Final restore-checkpoint checks: Storybook typecheck and targeted lint passed;
staged/unstaged whitespace checks passed in both repos. All **377 local dossier
links/anchors** resolve. The temporary preview tab/server were closed; the API
remained healthy. No commit, PR, release or full-goal completion is claimed.

## D2 scene history evidence — 2026-10-16

The scene-history contract is implemented in this checkout. Small filtered
summary pages replace eager full checkpoint bodies. One selected canonical
checkpoint is verified by ownership/revision/hash; unsupported formats remain
listed without becoming restored text. The drawer compares original/current
saved prose, copies Markdown or selected Unicode plain text, offers download
fallback, runs both save/AI-review barriers and requires deliberate reviewed
restoration bound to both current and source hashes.

Sources: [history drawer](../../src/features/novel/components/NovelRevisionDrawer.tsx),
[durable restore coordinator](../../src/features/novel/hooks/useSceneRestores.ts),
[scoped source](../../src/features/novel/hooks/useSceneRevisionSource.ts),
[receipt journal](../../src/features/novel/persistence/sceneRestoreJournal.ts),
[runtime guards](../../src/infrastructure/api/storyRevisionContract.ts).
BFF: `src/database/mysql/story_revision_store.py`, strict
`src/models/story_revisions.py` and the scene revision/detail/restore/result
routes in `src/routes/stories.py`. The former unreviewed fresh restore branch
is retired; the internal scene writer only permits exact old receipt replay.
Schema marker and existing project content remain unchanged.

The client persists the immutable request before POST, recovers the original
receipt before retrying after reload, and retains confirmation until current
scene hydration reaches the restored head or a later save. A failed hydration
does not reapply a restore. Pending target prose stays blocked; recovery remains
reachable outside the drawer and on archived receipt readers. Separate writers,
storage faults and late account/workspace responses retain their owning records.
Scene/snapshot source identities remain stable when provider cache refreshes
replace callback functions; asynchronous reviews do not reset mid-read.

Relevant frontend command:

```sh
pnpm exec vitest run src/features/novel src/features/landing/components src/features/gallery/hooks/useGalleryCardActions.test.tsx src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/app/providers/DataProvider.authTransitions.test.tsx src/infrastructure/api/storyRevisions.test.ts src/infrastructure/api/storySnapshotRestore.test.ts src/infrastructure/api/storySnapshots.test.ts src/infrastructure/api/storyHistory.test.ts src/infrastructure/api/storyUnitCopy.test.ts src/shared/storyUnitCopy.test.ts src/infrastructure/api/storyCreation.test.ts src/infrastructure/api/storyCreationContract.test.ts src/infrastructure/api/storyCopy.test.ts src/infrastructure/api/storyCopyContract.test.ts src/infrastructure/api/storyChapters.test.ts src/infrastructure/api/storyContract.test.ts src/shared/novelMutationJournal.test.ts src/shared/storyCache.test.ts --exclude '.claude/**'
```

Result: **494 tests / 76 files passed, one conditional fixture skipped (5.72s)**.
This includes actual isolated MySQL summary/detail/receipt JSON through the
frontend guards. Added regressions cover both barriers, one exact request,
stale-head refreshed review, pagination failure without loss of prior rows,
source/actor/date filters, archived copy, surrogate-boundary excerpt copy,
clipboard/download fallback, late clipboard/selection/scope isolation, durable
reload recovery, confirmed-but-unhydrated recovery, stale hydration rejection,
separate writers, storage failure and provider callback replacement.
`pnpm build` passed after typecheck (**488ms** Vite build; existing large-chunk
advisory). Storybook typecheck and targeted new scene-history/source/journal/
contract lint passed.

Relevant BFF command:

```sh
.venv/bin/python -m pytest tests/models/test_story_creation_store.py tests/models/test_story_workspace_models.py tests/models/test_lorebook_story_models.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/models/test_story_copy_store.py tests/models/test_story_unit_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_codex_store.py tests/models/test_story_history_store.py tests/models/test_story_snapshot_store.py tests/models/test_story_snapshot_restore_store.py tests/models/test_story_revision_store.py tests/scripts/test_novel_smoke_isolation.py tests/services/test_story_structure.py tests/services/test_story_copy.py tests/services/test_story_history.py tests/services/test_story_snapshots.py tests/services/test_story_snapshot_restore.py tests/services/test_manuscript.py -q
```

Result: **326 passed (4.24s)** with mocked persistence, including strict restore
payloads, exact receipt-first replay, current/source hash conflicts, missing
current checkpoint/proposal protection, late receipt rollback, small bound
queries, foreign checkpoint/receipt isolation and archived read-intent routing.
In-process TestClient checks required local socket access through escalation.
The earlier 58 focused frontend and 125 model/route checks overlap these runs
and are not additional totals.

Provider-free actual HTTP/MySQL commands:

```sh
.venv/bin/python scripts/smoke_novel_scene_history.py
.venv/bin/python scripts/smoke_novel_persistence.py
```

The history smoke passed in **`magic_worlds_novel_scenehistory_test_585910f8286a`**:
small real pages/filters, original marked Unicode prose/stable mention IDs,
exact concurrent restore/recovery, replay after later writing, notes/goal
preservation, current/source hash guards, late-failure rollback, corrupt and
future checkpoint rejection, pending proposals, foreign scene IDs and archived
read/recovery. Synthetic faults are repaired in `finally`. Wire fixtures are
`/tmp/novel-scene-history-smoke-{page,detail,receipt}.json`.
The migrated broader persistence smoke passed in
**`magic_worlds_novel_persistence_test_a4995fb33bbb`** at scene/structure/context
heads **10/18/6**. Both use the fresh-only allocator, retain synthetic databases
and report **`project_database_touched=false`**. No project reset, schema change
or generation provider call was needed. Existing MySQL deprecation advisories
remain unrelated to these checks.

Controlled desktop Storybook `Novel/Scene history` verified the explicit saved/
historical text comparison, reachable Restore/Cancel and confirmed revision 4.
Proof files in this chat's visualization folder are
`novel-scene-history-restore-review.png` and `novel-scene-history-confirmed.png`.
The temporary tab/server were closed. The running API health returned `ok`;
OpenAPI read-only inspection confirms all four history paths and required
four-field restore/three-selector result contract. No manual API restart was
needed. Authenticated author/mobile/assistive-technology acceptance, annotations/
comment copy, remaining nested/compound/context cases, retention/offline policy
and measured large-project limits remain open. D2 and the full 136-capability
D1–D6 goal remain active and incomplete.

Final scene-history checks: Storybook typecheck and targeted scene/history/
Studio lint passed with no warnings. Staged/unstaged whitespace checks passed
in both repos, and all **387 local dossier file links/anchors** resolve.
No commit, PR, release or full-goal completion is claimed.

## D2 personal annotation preparation evidence — 2026-10-16

This is a **prepared slice**, not an installed annotation feature or completed
D2 phase. [ADR 17](17_annotation_anchors_and_personal_review.md) records the
contract and [14](14_status_and_roadmap.md#d2-personal-annotation-preparation--2026-10-16)
records the remaining integration. The project retains the scene schema and all
recovered content. No project database write, reset or provider execution was
performed for this slice.

The BFF adds strict annotation DTOs, independent content/anchor CAS, immutable
origin/last/current anchors and events, exact owned receipts, 50-summary pages,
literal search and explicit orphan reasons. Actual editor transaction traces
are bounded and checked against the whole canonical plain projection. The
prepared remapper compiles shared document layouts once per note batch and
does not search for an equal quote. Exact restoration can recover the last
verified attachment, including after explicit reanchoring.

Frontend source/contract guards, journals and hooks retain immutable pending
requests until a separate fresh note read succeeds. Device drafts retain each
keystroke and their displayed account base. The prepared
[review drawer](../../src/features/novel/components/NovelAnnotationDrawer.tsx)
supports filters, explicit account/device comparison, independent note states,
attachment review, exact saved-passage reading and copy/download fallback.
Old confirmations never replace newer input. Selection capture freezes the
original passage before flushing and validates the saved document, scope and
opaque editor instance; a React handle refresh alone does not change identity.

Frontend commands (overlapping suites, not additive totals):

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts --exclude '.claude/**'
pnpm exec vitest run src/features/novel/utils/annotationSelection.test.ts src/features/novel/editor/NovelEditor.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

The focused suite passed **469 tests / 71 files, one conditional fixture
skipped**. After hardening selection capture against ordinary React handle
replacement, its capture/editor command passed **12/12**. Production build and
Storybook typecheck passed. Targeted new annotation UI/helpers lint passed
without warnings. Existing bundle-size advisories remain.

BFF commands:

```sh
.venv/bin/python -m pytest -q tests/models/test_story_annotation_store.py tests/services/test_story_anchors.py tests/models/test_story_scene_store.py tests/services/test_manuscript.py tests/routes/test_story_routes.py
.venv/bin/python -m pytest -q tests/test_novel_annotations_migration.py
```

These passed **160** and **11** checks respectively. The latter rejects a
missing/private-permission failure, changed stream, wrong database/server/
marker, incomplete footer, wrong expanded hash and absent inventory. An apply
without a verified backup stops before DDL/data writes; a prepared migration
containing a destructive extra statement fails before connecting.

The actual isolated rehearsal used
**`magic_worlds_novel_annotations_test_c822d09ebb83`**. It created an existing
synthetic novel first, wrote/reopened a private consistent backup, applied only
the three annotation table creates plus marker update, reapplied idempotently,
and verified the novel remained intact. Actual HTTP/MySQL create/edit/resolve/
Trash/restore/reanchor, independent versions, concurrent exact receipts, late
failure rollback, 50-row pages, literal underscore search and archived owned
reads passed. The retained probe is `/tmp/novel_annotation_storage_probe.py`,
with result log `/tmp/novel-annotations-upgrade-probe.log` and wire fixtures
`/tmp/novel-annotations-probe-{page,detail,receipt}.json`. It reports
`project_database_touched=false`. This temporary probe still needs promotion
to the repository's regular isolated smoke after final integration; it does
not establish scene-operation preservation yet.

Controlled desktop Storybook `Novel/Personal notes` verified selected-note
reading, exact saved-passage highlighting and explicit attachment review. The
screenshots `novel-personal-notes-saved-passage.png` and
`novel-personal-notes-attachment-review.png` are in this chat's visualization
folder. The temporary tab/server were closed. This is fixture evidence and
does not establish authenticated account, mobile or assistive-technology
acceptance.

**Still required before exposing notes:** mount the prepared remapper at all
scene checkpoint boundaries; preserve notes through split/merge/copied
identities, explicit comment-copy choices, guarded organization reversal and
snapshot annotation lineage; then install the reviewed additive schema after
a fresh verified private project backup and connect the API/Studio entry.
Current canonical schema/bootstrap and running API still use
`2026_10_novel_scenes` (106 tables / 151 foreign keys). D2 performance/context/
retention/author gates and D3–D6 remain open.

## D2 personal annotation integration evidence — 2026-10-16

This checkpoint supersedes the preparation-only installation status above.
The [delivery register](14_status_and_roadmap.md#d2-personal-annotation-integration--2026-10-16)
and [ADR 17](17_annotation_anchors_and_personal_review.md) retain the full D2
and 136-capability D1–D6 scope. Personal annotations are now connected to Studio,
the API and document/organization transactions. Frozen annotation snapshot
reads and broader acceptance remain unfinished.

The shared checkpoint boundary commits prose and anchor changes together.
Server split/copy transforms record exact text-block point segments, including
the allocated right-hand split block. Merge moves secondary notes into the
retained scene. A range crossing scene boundaries remains an explicit orphan
with its last quote. No matching-quote search establishes identity. Copy uses
new note/block IDs, reviewed inclusion/counts and an annotation collection CAS;
source provenance and resolution persist. Earlier uncertain copy requests
retain their original field set and normalized receipt hash.

Organization events retain anchor-only before/after deltas and movement
lineage. Monotonic public anchor versions have separate internal logical
authority, allowing multiple undo/redo steps while preserving later note body
and resolution edits. A later deliberate reattachment blocks a conflicting
inverse even if the quote is unchanged. Notes created after an operation can
follow its inverse point lineage. Copied notes remain readable in their unit's
recoverable Trash instead of being deleted when the copy is undone. Scene and
snapshot text restoration preserve current note content and record reversible
attachment changes. Named snapshots do not yet freeze/read annotation heads.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx --exclude '.claude/**'
```

Result: **497 passed / 74 files, one conditional fixture skipped**. This includes
actual HTTP/MySQL annotated novel/unit copy wires through the runtime guards,
explicit copy counts/options, original receipt normalization, newer device
input protection, archived readers and hidden-scene navigation refusal.
Production build passed (583ms; existing bundle-size advisory). Storybook
typecheck and targeted novel/annotation/copy lint passed without warnings.

BFF command:

```sh
.venv/bin/python -m pytest -q tests/models/test_story_annotation_store.py tests/models/test_story_scene_store.py tests/models/test_story_history_store.py tests/models/test_story_revision_store.py tests/models/test_story_snapshot_restore_store.py tests/services/test_story_annotation_operations.py tests/services/test_story_anchors.py tests/services/test_story_structure.py tests/services/test_manuscript.py tests/test_schema_bootstrap.py tests/test_startup.py tests/routes/test_story_routes.py tests/models/test_story_copy_store.py tests/models/test_story_unit_copy_store.py tests/routes/test_story_copy_routes.py tests/test_novel_annotations_migration.py tests/scripts/test_novel_smoke_isolation.py
.venv/bin/python scripts/smoke_novel_annotations.py
.venv/bin/python scripts/smoke_novel_persistence.py
```

The mocked suites passed **549 checks**. The integrated annotation smoke passed
in **`magic_worlds_novel_annotations_test_0d98855e61a0`**, exercising repeated
passage mapping, concurrent exact note recovery, create/edit/resolve/Trash/
reanchor, literal search and small pages, split/merge, multi-step undo/redo,
later note-body/resolution preservation, deliberate reattachment conflicts,
explicit unit/novel comment copy and provenance, late prose-receipt rollback,
scene restoration and snapshot text restoration/undo with current notes.
The broader persistence smoke passed in
**`magic_worlds_novel_persistence_test_a785949e79a4`** at scene/structure/context
heads **10/18/6**, including ordinary acceptance/Codex/creation/organization
guarantees. Both allocate only fresh synthetic databases, retain them, report
`project_database_touched=false` and request no novel generation provider.

Actual frontend wire fixtures:
`/tmp/novel-annotations-probe-{page,detail,receipt}.json`,
`/tmp/novel-annotations-smoke-unit-copy.json` and
`/tmp/novel-annotations-smoke-novel-copy.json`. The durable smoke supersedes the
temporary CRUD probe; the prior additive rehearsal remains separately recorded.

The final additive rehearsal, including the internal logical-anchor column,
passed in **`magic_worlds_novel_annotations_test_393d468c2d51`** before the
project upgrade. Project preflight verified the exact 106-table predecessor.
The private mode-0600 backup/manifest are at
`.dev/backups/novel-annotations-pre-20261016T150629Z-75969b7e.sql.gz` (frontend
workspace), excluded from Git. Their verified compressed SHA-256 is
`3640fbea7c6d2a0e84676a831a604d35e37c8babe4799dbbcc2418be697947ed`.
The backup contains 4,277 rows. The scoped migration added three annotation
tables and advanced the marker; canonical DDL/bootstrap match exactly at
**`2026_10_novel_annotations`, 109 tables / 154 foreign keys**. It performs no
DROP, DELETE, table replacement or unrelated reseeding.

A post-upgrade read-only comparison rendered every pre-existing content row
with the same SQL literal encoding as the private backup and compared row
multisets. It verified **all 4,276 prior content rows across 105 tables exactly
unchanged**, with zero extra rows or mismatched tables. The separate marker row
is the intended existing-row change. Result logs are
`/tmp/novel-annotations-project-{preflight,backup,upgrade,verified,preservation}.log`.
The API reloaded through its managed process and health returned `ok`; OpenAPI
confirms all annotation path groups and optional copy comment-count expansion.
Schema mismatch diagnostics for the novel runtime now name preservation and a
reviewed scoped upgrade; they do not suggest an unrelated historical native
voice purge. The exact scene predecessor names its private-backup annotation
upgrade. The corresponding refusal tests pass.

Controlled desktop Storybook inspection verified the separate personal-review
choice and counts changing with Trash/inclusion. Proof:
`novel-annotation-copy-review.png` in this chat's visualization folder. This
does not establish signed-in author, mobile or assistive-technology acceptance.
The temporary tab/server were closed. Staged/unstaged whitespace checks passed
in both repositories, and all **401 local dossier links/anchors** resolve.
No commit, PR, release, phase completion or full-goal completion is claimed.
Next: frozen annotation snapshot lineage/reads; remaining compound/context,
measured long-project, retention/offline and author gates, then D3–D6.

## D2 frozen personal-note snapshot evidence — 2026-10-16

This checkpoint supersedes the previous next item for frozen annotation reads.
The [delivery register](14_status_and_roadmap.md#d2-frozen-personal-note-snapshots--2026-10-16)
retains D2 WIP and the complete 136-capability D1–D6 objective.

The new optional capture selector pins the saved annotation collection head.
Under the novel lock, capture checks the head and verifies each current note
against its immutable content and attachment event images. The manifest stores
only bounded previews, identity/state/version metadata, image pointers and a
SHA-256 hash of the 15 stable public note fields. Historical reads reconstruct
and verify those images without querying mutable note rows. The existing
manifest byte limit also covers this index. No schema, marker or project test
record was changed.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **509 passed / 76 files; one conditional fixture skipped**. The tests
cover metadata membership/order/filter/hash binding, exact modern and older
capture receipts, actual synthetic MySQL wire records, captured note bodies and
states, exact checkpoint passage resolution, explicit orphan/legacy/empty
states and ignored late reads after a scope change. Production build and
Storybook typecheck passed. Targeted ESLint for the new reader, drawer/source,
contracts, fixtures and tests passed with zero warnings.

Backend command (localhost TestClient transport permitted):

```sh
.venv/bin/python -m pytest tests/services/test_story_annotation_snapshots.py tests/services/test_story_anchors.py tests/services/test_story_annotation_operations.py tests/services/test_story_snapshots.py tests/services/test_story_snapshot_restore.py tests/services/test_story_structure.py tests/services/test_story_history.py tests/services/test_story_copy.py tests/services/test_manuscript.py tests/models/test_story_annotation_store.py tests/models/test_story_snapshot_store.py tests/models/test_story_snapshot_restore_store.py tests/models/test_story_history_store.py tests/models/test_story_unit_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_copy_store.py tests/models/test_story_creation_store.py tests/models/test_story_codex_store.py tests/models/test_story_revision_store.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/scripts/test_novel_smoke_isolation.py -q
.venv/bin/python -m pytest tests/models/test_story_snapshot_annotation_store.py -q
.venv/bin/python scripts/smoke_novel_annotations.py
```

The scoped suite passed **449 checks** and the new store file passed **5 checks**;
these scopes differ from the earlier 549-check command and are not additive to
it. The initial sandboxed suite stalled in the localhost TestClient transport;
its exact process was stopped, then the same suite passed with that transport
permitted. The API was left running.

Actual HTTP/MySQL verification passed in the newly allocated database
**`magic_worlds_novel_annotations_test_0dfae06c7b4d`**. It exercises original note
CRUD/copy/split/merge/undo behavior plus capture of both full and attachment-only
history, 50-entry pages and filters, frozen note equality after later body/state/
anchor changes and snapshot text restore, receipt-first capture replay, archived
owned reads, foreign/not-captured rejection and the distinction between legacy
and captured-empty collections. An annotation-only edit invalidates capture
without consuming a structure revision. A temporary synthetic live-row
corruption leaves frozen reads unchanged; a temporary immutable-image
corruption rejects the read. Both faults are repaired in the synthetic database.
All database test mutations use the fresh isolated allocator, never the project
schema.

Read-only live `/health` returned `ok`; OpenAPI exposes both snapshot annotation
readers and the opt-in preview query. Controlled desktop Storybook inspection
verified the resolved historical body and exact highlighted captured passage.
Proof: `novel-snapshot-captured-notes.png` in this chat's visualization folder.
The temporary tab/server were closed. This is fixture evidence; authenticated
author, mobile/assistive-technology, long-project measurements and full
retention/offline acceptance remain open. D3–D6 remain planned. No commit, PR,
release, phase completion or full-goal completion is claimed.

## D2 compound structure preservation evidence — 2026-10-16

The [delivery register](14_status_and_roadmap.md#d2-compound-structure-preservation--2026-10-16)
records this implementation without closing D2 or the 136-capability D1–D6 goal.

Three reproductions established concrete gaps before their fixes: chapter
reparenting changed inherited status/narrator/tense/inclusion; a revision-1 split
incorrectly verified the original whole-scene summary for its new fragment; and
restoring a scene into another chapter omitted the source-context copy effects.
The retained failing outputs are `/tmp/novel-compound-before.log` and
`/tmp/novel-compound-restore-before.log`. The new chapter/scene inheritance helper
pins changed existing choices at the narrowest grouping level, preserves explicit
child choices, retains null-means-inherit for unset optional fields, and avoids
re-archiving a scene recovered from an archived ancestor. Summary bodies are
retained with an unverified pin on a new fragment. Cross-chapter restoration
uses the existing transactional reference and attachment machinery.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
pnpm exec eslint src/features/novel/components/NovelStructureDrawer.tsx src/features/novel/components/NovelStructureDrawer.test.tsx src/features/novel/components/NovelStructureDrawer.stories.tsx src/infrastructure/api/storyCompoundStructure.test.ts --max-warnings 0
```

Result: **512 passed / 77 files, one conditional fixture skipped**. This includes
actual synthetic compound story/scene/annotation/history response guards,
explicit active restore destination selection, unavailable-parent exclusion,
immutable destination review, failed/successful save barriers and separate-unit
choice isolation. Production build, Storybook typecheck and targeted lint pass.
Logs use `/tmp/novel-compound-{client-tests,build,stories,lint}.log`.

Backend command (localhost TestClient transport permitted):

```sh
.venv/bin/python -m pytest tests/services/test_story_reparented_defaults.py tests/models/test_story_structure_defaults.py tests/services/test_story_annotation_snapshots.py tests/services/test_story_anchors.py tests/services/test_story_annotation_operations.py tests/services/test_story_snapshots.py tests/services/test_story_snapshot_restore.py tests/services/test_story_structure.py tests/services/test_story_history.py tests/services/test_story_copy.py tests/services/test_manuscript.py tests/services/test_story_context_compiler.py tests/models/test_story_annotation_store.py tests/models/test_story_snapshot_annotation_store.py tests/models/test_story_snapshot_store.py tests/models/test_story_snapshot_restore_store.py tests/models/test_story_history_store.py tests/models/test_story_unit_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_copy_store.py tests/models/test_story_creation_store.py tests/models/test_story_codex_store.py tests/models/test_story_revision_store.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/scripts/test_novel_smoke_isolation.py -q
.venv/bin/python scripts/smoke_novel_compound_structure.py
```

The scoped suite passed **466 checks**. Actual HTTP/MySQL verification passed in
**`magic_worlds_novel_compound_test_1a21af065e9f`**, with newly allocated schema
and synthetic account/workspace only. It verifies chapter reparenting without
any descendant prose/metadata head changes; preservation of later chapter notes
through undo/redo; revision-1 summaries; nested ordered/bullet lists and inserted
continuation paragraphs; Unicode and rich marks/links; stable mention labels and
frozen source-version pins; right-hand and cross-split note attachment behavior;
context-remapping moves; multi-step exact original-document restoration and
redo while retaining later note content/resolution; chapter split/merge; and
restoration to another chapter. A stored candidate blocks splitting without
changes. A synthetic late receipt failure rolls back the complete current tree,
context, annotation and history reader results. No model execution is performed.
The allocator never selects the project database for test mutations. No schema
extension, marker change or project test record was required.

Read-only live health remains a separate runtime check. Controlled desktop
Storybook inspection verified that Restore stays disabled until an active
container is selected, that review displays the captured destination and retained
writing, and that the local fixture reaches confirmation. Proof is
`novel-restore-destination-review.png` in this chat's visualization folder.
The temporary tab/server were closed. This is not signed-in author or mobile/
assistive-technology acceptance. Broader catalog features, measured performance,
retention/offline policy and D3–D6 remain open; no release or phase/full-goal
completion is claimed.

## D2 outline and insertion evidence — 2026-10-16

The [delivery register](14_status_and_roadmap.md#d2-outline-and-exact-insertion--2026-10-16)
records the compact/detailed outline, derived numbering and reviewed insertion
implementation. D2 remains WIP; D3–D6 and the full 136-capability objective remain
open.

Frontend commands:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **524 tests passed / 81 files, one conditional fixture skipped**. The
actual insertion receipt and later reordered manuscript passed the frontend
runtime guards. New regressions cover active reading-order numbers, archived
and trashed ancestors, independent goals, scoped card labels, stale/unverified
summaries, owner-scoped view preferences and unavailable storage. Drawer checks
cover an independent creation title, stable after-anchor, save barriers, missing
selection and changed anchor container. After the final archived-row drag guard
and explicit review-title display, the two affected UI files passed **12 tests**
and targeted lint again; the final production build also passed. These commands
overlap and their counts are not additive.

Production build retains the existing bundle-size advisory. Storybook typecheck
and targeted outline/drawer/hook/fixture/locale/API lint passed. Logs are
`/tmp/novel-outline-{client-tests,build,stories,lint}.log` and
`/tmp/novel-outline-final-ui-{tests,lint}.log`.

The same scoped backend command recorded in the preceding compound checkpoint
passed **472 checks** after adding before/after creation cases for all three
unit kinds, ambiguous/missing/wrong-container anchor rejection and rejection of
prose supplied to part/chapter creation. The command uses mock database fixtures;
localhost TestClient transport was permitted. Log:
`/tmp/novel-outline-backend-tests.log`.

Actual HTTP/MySQL command, run from the sibling backend:

```sh
.venv/bin/python scripts/smoke_novel_insertions.py
```

It passed in the retained, newly allocated synthetic database
**`magic_worlds_novel_insertions_test_ac18f07b747d`**. It verifies before/after
creation for parts, chapters and scenes, concurrent exact replay, original
author-title preservation, replay after a later reorder without applying the
placement again, rejection of missing/ambiguous/trashed anchors, and complete
rollback after a synthetic late receipt failure. Wire evidence is
`/tmp/novel-insertions-wire.json`; log is `/tmp/novel-insertions-smoke.log`.
The bare router fixture executes no model and writes only to its synthetic
database. No project database test write, reset, migration or marker change was
required. A separate read-only API health check returned `ok`.

Controlled desktop Storybook inspection verified the active word total, derived
numbers, independent goals, scoped POV/location/cast and current/earlier/
unverified summary labels. The insertion fixture displayed the new title,
destination chapter and exact after-position in review, then reached local
confirmation. Screenshots in this chat's visualization folder are
`novel-detailed-outline.png` and `novel-insertion-position-review.png`. This is
fixture evidence; signed-in author/mobile/assistive-technology acceptance and
measured long-project behavior remain open. The temporary browser tab and
Storybook process were closed; the project API remains running.

Next D2 work includes writing templates (N11), remaining source/creation and
catalog workflows, broader organization/context acceptance, measured performance
and retention/offline policy. No phase completion, release or model-quality
claim follows from these checks.

## D2 writing template evidence — 2026-10-16

The [template checkpoint](14_status_and_roadmap.md#d2-editable-writing-templates--2026-10-16)
records editable starter/custom outlines and writing defaults. D2 and the full
136-capability D1–D6 objective remain WIP. No persistent author-template catalog,
release or broad author/performance acceptance is claimed.

Frontend commands:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **550 tests passed / 86 files, one conditional fixture skipped**. This
includes the actual MySQL template creation/reopen wire through client guards,
exclusive creation modes, changed-template receipt rejection, metadata limits,
immutable original template recovery after reload/caller changes, independent
goals, part ownership through reorder/removal, last chapter/scene preservation,
source-card composition, explicit edited-preset replacement and unavailable/
pending creation controls. Immediate removal undo retires after later edits;
entering multiple plot threads retains the newline while typing.

Final production build passed after widening the template editor at desktop
widths. Storybook typecheck and targeted new template/create/contract/fixture/
locale/provider lint passed; the final modal lint check passed too. The existing
bundle-size advisory remains. Logs are
`/tmp/novel-template-{client-tests,build,stories,lint,final-lint}.log`.

The preceding compound checkpoint's scoped backend command, additionally
including `tests/services/test_story_templates.py`, passed **490 checks**.
After adding explicit OpenAPI exclusive-mode/non-null-template and minimum-list
constraints, this final overlapping command passed **133 checks**:

```sh
.venv/bin/python -m pytest tests/services/test_story_templates.py tests/models/test_story_creation_store.py tests/routes/test_story_creation_routes.py tests/routes/test_story_routes.py -q
```

These counts are not additive. The final contract checks cover both exact
legacy creation receipts and edited templates; unknown fields, borrowed IDs,
manuscript bodies/documents, fabricated written summaries, invalid part indexes,
Boolean versions/goals, oversized Unicode metadata and mixed creation inputs
are rejected. The route/model fixtures mock database calls; localhost TestClient
transport was permitted. Logs are `/tmp/novel-template-backend-tests.log` and
`/tmp/novel-template-backend-final-contract.log`.

Actual provider-free HTTP/MySQL command:

```sh
.venv/bin/python scripts/smoke_novel_templates.py
```

It passed in newly allocated and retained synthetic database
**`magic_worlds_novel_templates_test_f70c48a54755`**. Four concurrent first POSTs
returned one exact creation receipt. Parts/chapters/scenes, planning metadata,
independent goals, inherited/overridden narrator, inclusion flags and Codex pins
survived reopening. Every scene began with an empty revision-1 document and
checkpoint. Reusing the template allocated disjoint scene/unit/block identities.
After writing real fixture prose, creation replay and receipt recovery left the
new prose unchanged; changed intent was rejected. Missing/ambiguous/invalid
template modes returned validation errors. A late synthetic receipt failure
rolled back all new root/unit/checkpoint/reference/receipt rows. Wire is
`/tmp/novel-template-wire.json`; log is `/tmp/novel-template-smoke.log`.

The shared allocator never selects the project database for test mutation.
The smoke uses bare routers and performs no model execution. No schema upgrade,
marker change, reset or project test record was required. Separate read-only
live health returned `ok`; live OpenAPI advertises the two exclusive creation
inputs and the non-null template schema.

Controlled desktop Storybook inspection verified an edited narrator/style guide,
chapter title, independent goal, outline hierarchy and explicit fixture creation
confirmation. Screenshots in this chat's visualization folder are
`novel-writing-template-editor.png` and `novel-writing-template-outline.png`.
The temporary preview encountered OS file-watcher exhaustion; process-local
Chokidar/Watchpack polling allowed inspection without changing system settings.
This evidence does not establish signed-in author/mobile/assistive-technology
acceptance or measured large-project limits. Remaining source/creation,
metadata/library, reading/navigation/search and other catalog/acceptance work
stays open alongside D3–D6.

The temporary browser tab and Storybook process were closed after inspection.
The project API was left running. Final staged/unstaged whitespace checks passed
in both repositories; the 15 new source files also passed a trailing-whitespace
scan. All **415 local dossier links/anchors** resolved, and the catalog retains
**136 distinct capability IDs** with no duplicates.

## D2 reviewed creation source evidence — 2026-10-16

The [source checkpoint](14_status_and_roadmap.md#d2-reviewed-creation-sources--2026-10-16)
implements N02 locally: reviewed card batches and exact approved reference
passages, explicit approval, atomic source-hash guards and frozen initial
provenance. Rejected creation requests preserve authored outlines/defaults,
descriptions and material for receipt-first review/download/replacement. This
does not complete D2 or any D3–D6 phase; live session-history integration remains
excluded and approved passages never become manuscript prose automatically.

Frontend commands:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/features/codex/components/CodexCardPickerDrawer.test.tsx src/features/gallery/hooks/useGalleryCardActions.novel.test.tsx src/features/gallery/components/GalleryPage.test.tsx src/features/library/components/LibraryPage.test.tsx src/features/landing/components/LandingPage.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **652 tests passed / 96 files, one conditional fixture skipped**.
Checks cover requested reference identities/options, exact approved Unicode
and whitespace, malformed snapshots, borrowed material pins, foreign provenance,
legacy absence, explicit approval, stale-source rejection, retained oversized
input, late preview ownership and immediate review in a new scope while the old
request remains unresolved. The shared picker retains its original one-argument
selection contract unless display labels are explicitly requested. Card-to-novel
opens the shared review before any creation call; archived/stale views cannot
create. Existing gallery/library/landing tests pass.

Rejected-draft checks retain the full edited outline/defaults/material across
reload/caller changes, read receipts without reposting, require a new request
ID/review, and preserve the old draft through replacement reader failure/reload
until the confirmed manuscript opens. Unknown outcomes still block replacement.
The UI confirms explicit discard and keeps save/review barriers before opening.
Production build and Storybook typecheck pass; the existing bundle-size advisory
remains. Logs are `/tmp/novel-sources-{client-tests,build,stories}.log`.

Targeted novel, creation contract/fixture/locale/provider and gallery-action
lint passes with zero warnings (`/tmp/novel-sources-final-lint.log`). The shared
Codex picker file still has its pre-existing `react-hooks/set-state-in-effect`
error for seeding the query on open; the same effect is present in `HEAD` and
was not changed by the optional-label extension. The initial broader lint log
records that baseline separately (`/tmp/novel-sources-lint.log`). A transient
new hook cleanup warning was fixed before the final pass.

The preceding compound/template backend scope, plus
`tests/services/test_story_creation_sources.py` and
`tests/routes/test_story_creation_sources_routes.py`, passes **514 checks**
(`/tmp/novel-sources-backend-tests.log`). It covers strict material bounds,
origin distinctions and older origin-less manifests, digest verification,
primary-plus-extra composition, private history projection, owned transaction
reads, missing-manifest rejection before INSERT, and existing creation/template/
copy/annotation/history/context/reset-protection regressions. Model/route suite
database calls are mocked; permitted localhost TestClient transport is separate
from the real MySQL smoke.

Actual provider-free HTTP/MySQL command:

```sh
.venv/bin/python scripts/smoke_novel_creation_sources.py
```

It passes in newly allocated and retained
**`magic_worlds_novel_sources_test_4c86ec4db7ae`**. Primary and extra library
version pins, structured categories/attributes, exact approved context and blank
independent scenes survive reopening. Four concurrent identical creates return
one exact receipt. Publishing a changed source rejects stale creation without
partial rows; current Codex edits/removal leave the frozen source record intact.
A fresh review allocates independent references. Late receipt failure rolls
back the tree/references/initial provenance/receipt. Corrupt frozen hashes are
rejected and repaired in the synthetic fixture. Receipt/provenance reads survive
removal of the synthetic source cards and workspace archive, while new archived
creation is blocked. The synthetic wire passes frontend creation/source/tree
guards. Wire: `/tmp/novel-creation-sources-wire.json`; smoke log:
`/tmp/novel-creation-sources-smoke.log`.

The project database received **no test writes, migration, marker change or
reset**. The smoke makes no model/provider calls. Separate read-only live checks
return health `ok` and confirm the preview/origin routes and reviewed-source/
approved-material fields in OpenAPI. Existing recovered content is preserved.

Controlled desktop Storybook inspection verifies exact source snapshots, explicit
approval enabling creation, the local empty-manuscript confirmation and retained
material reopening without approval. Screenshots in this chat's visualization
folder are `novel-creation-source-review.png`,
`novel-creation-source-confirmed.png`, `novel-rejected-creation-draft.png` and
`novel-frozen-creation-origin.png`. The origin reader also displayed the saved
creation date, exact card/passage snapshots and fixed-record explanation.
These fixtures use local readers and no backend/model requests. Full signed-in
author/mobile/assistive-technology, performance and release gates remain open.
The temporary preview uses process-local Chokidar/Watchpack polling; no system
watcher setting was changed.

Next work remains metadata/library filtering, reading/navigation/manuscript
search and other D2 catalog/organization/context acceptance; measured size and
latency, retention/offline policy and author/mobile/assistive-technology checks.
D3 assistant/proposals, D4 planning/memory/review, D5 portability/productivity
and D6 series/extensions remain planned.

Final staged/unstaged whitespace checks pass in both repositories; all 221 new
source/documentation/script files also pass a trailing-whitespace scan. All
**421 local dossier links/anchors** resolve and the catalog keeps **136 distinct
capability IDs**, with no duplicates. The temporary browser tab and Storybook
process were closed; the project API remains running.

## D2 library discovery evidence — 2026-10-16

The [library checkpoint](14_status_and_roadmap.md#d2-library-discovery--2026-10-16)
implements N08 locally: title/manuscript/metadata search scopes, literal
genre/language/audience filters, whole tags, root workflow status, inclusive UTC
activity dates and stable title/creation/activity order. The filter drawer uses
shared controls, retains invalid input, applies explicitly and supports cancel/
reset. It preserves current search, resets pages, ignores late old-selection
responses, retains filters through Trash and clears them on workspace changes.
The root Trash label no longer implies that archived novels moved there.

Frontend commands:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/features/codex/components/CodexCardPickerDrawer.test.tsx src/features/gallery/hooks/useGalleryCardActions.novel.test.tsx src/features/gallery/components/GalleryPage.test.tsx src/features/library/components/LibraryPage.test.tsx src/features/landing/components/LandingPage.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **661 tests passed / 100 files, one conditional fixture skipped**.
Checks cover strict runtime filters, literal Unicode/encoding and private scoped
GETs, explicit form apply/cancel/reset, oversized input retention, invalid date
ranges, preserved search, Trash filters, workspace reset and a delayed previous
list response arriving after another filter selection. Actual filtered MySQL
summaries pass the frontend reader guard and are rejected as editable full
manuscripts. Existing creation/copy/recovery/editor/history/context and shared
gallery/library/landing regressions remain green. Logs are
`/tmp/novel-library-{client-tests,build,stories,lint}.log`.

The scoped backend command is:

```sh
.venv/bin/python -m pytest tests/services/test_story_library.py tests/routes/test_story_library_routes.py tests/models/test_story_workspace_models.py tests/services/test_story_creation_sources.py tests/routes/test_story_creation_sources_routes.py tests/services/test_story_templates.py tests/services/test_story_reparented_defaults.py tests/models/test_story_structure_defaults.py tests/services/test_story_annotation_snapshots.py tests/services/test_story_anchors.py tests/services/test_story_annotation_operations.py tests/services/test_story_snapshots.py tests/services/test_story_snapshot_restore.py tests/services/test_story_structure.py tests/services/test_story_history.py tests/services/test_story_copy.py tests/services/test_manuscript.py tests/services/test_story_context_compiler.py tests/models/test_story_annotation_store.py tests/models/test_story_snapshot_annotation_store.py tests/models/test_story_snapshot_store.py tests/models/test_story_snapshot_restore_store.py tests/models/test_story_history_store.py tests/models/test_story_unit_copy_store.py tests/models/test_story_scene_store.py tests/models/test_story_copy_store.py tests/models/test_story_creation_store.py tests/models/test_story_codex_store.py tests/models/test_story_revision_store.py tests/routes/test_story_routes.py tests/routes/test_story_copy_routes.py tests/routes/test_story_creation_routes.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/scripts/test_novel_smoke_isolation.py -q
```

Result: **561 passed** (`/tmp/novel-library-backend-tests.log`). The new model/
query checks bound fields and dates, reject arbitrary sort/field syntax and
coercion, parameterize search/filter values, retain owner/application/workspace
predicates and use stable novel ID tie-breakers. Read-only route checks include
archived workspaces. Database calls in this unit/route suite are mocked;
permitted TestClient transport is separate from the real persistence check.

Actual provider-free HTTP/MySQL command:

```sh
.venv/bin/python scripts/smoke_novel_library.py
```

It passes in newly allocated and retained
**`magic_worlds_novel_library_test_b96fccaced76`**. The fixture verifies all six
sort directions and equal-title pages; escaped `%`, `_` and backslashes;
Unicode/case/accent matches; combined metadata/whole-tag/status filters; root,
part, chapter and scene archive/Trash boundaries; metadata scalars, tags and plot
threads; missing/null metadata and context-only exclusions; inclusive through-day
bounds; later writing advancing root activity; different accounts/workspaces and
archived-workspace reads. List responses contain no scene documents, prose or
Codex hydration. Root archive remains separate from locally archived sections
and root Trash. Wire: `/tmp/novel-library-wire.json`; log:
`/tmp/novel-library-smoke.log`.

An actual filtered wire check exposed a JSON-table-only correlated `EXISTS`
returning an empty tag match after later fixture writes on the installed MySQL
8.1.0, despite the stored `Café` value matching directly. An explicit base-table
primary-key correlation produced the correct per-row result. Tag and plot-thread
lookups now retain that correlation, with final assertions after writing and
workspace archive. This is observed local evidence, not a claim about all server
versions. MySQL documents table functions as implicitly lateral in its
[JSON table function reference](https://dev.mysql.com/doc/refman/8.0/en/json-table-functions.html).

Production build and Storybook typecheck pass; targeted new library/API/locale/
fixture/gallery lint passes with zero warnings. The existing bundle-size
advisory remains. Separate read-only live checks return health `ok` and confirm
all ten new query parameters in the running OpenAPI contract. This work requires
**no project database test writes, reset, migration or schema-marker change** and
makes no model/provider calls. Recovered records and files remain intact.

Cached aggregate word statistics and draft-size filtering (N09), cover/default
POV metadata (N03), reading preferences and within-manuscript search results/
jumps remain open. The library is not a measured full-text-index/search-scale
promise. Complete author/mobile/assistive-technology, performance, retention and
offline gates remain open alongside all D3–D6 phases. The 136-capability scope
is unchanged.

Controlled desktop Storybook inspection verified manuscript scope, title sort,
workflow status, literal Unicode genre/language/tag fields, native activity-day
inputs, explicit archived-section inclusion and reachable Apply/Cancel/Reset.
Applying the reviewed form closed the drawer and updated its applied state.
Screenshots in this chat's visualization folder are
`novel-library-filter-review.png` and `novel-library-filter-applied.png`.
This controlled form fixture makes no backend requests and does not substitute
for signed-in author/mobile/assistive-technology acceptance.

A read-only check of the retained synthetic database session returned
`session_zone=SYSTEM`, `system_zone=UTC`, `utc_offset_seconds=0`, confirming the
existing UTC timestamp contract used by this activity-date evidence. Offset
pages retain the existing API contract; concurrent edits can move items between
pages, and refreshing re-evaluates the current list. No frozen-result paging or
large-library performance guarantee is claimed.

The temporary browser tab and Storybook process were closed; the project API
was left running. Final staged/unstaged whitespace checks pass in both repos;
all **235 new source/documentation/script files** pass a trailing-whitespace scan.
All **426 local dossier links/anchors** resolve, with **136 distinct capability
IDs** and no duplicates. No commit, PR, deployment or phase completion is claimed.


## D2 novel cover and default POV evidence — 2026-10-16

The [metadata checkpoint](14_status_and_roadmap.md#d2-novel-covers-and-default-pov--2026-10-16)
implements N03 locally. The [recoverable details form](../../src/features/novel/components/NovelUnitDetails.tsx)
reuses an [owned image chooser](../../src/features/gallery/media/components/OwnedImagePickerDrawer.tsx),
shared upload limits and an accessible [cover preview](../../src/features/novel/components/NovelCoverField.tsx).
The novel library reads the owned cover route. The existing `details` JSON stores
`coverAssetId`, `coverAlt` and `povCardId`; no schema extension is required.
Client/server validation uses matching code-point/UTF-8 bounds. Invalid text
remains editable and recoverable, pending older intents remain readable, and
manual multiline tag entry preserves the newline. Explicit save and account
comparison include cover/POV values; snapshot restore/history show cover previews.

The [relationship store](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/story_media_links.py)
validates changed assignments under the novel/asset locks. Current/frozen covers
pin image records across the author's workspaces. It never probes files or
invalidates unchanged unavailable relationships. The default POV enters normal
inheritance and scene context; copies retain its snapshot disabled when context
is excluded. Case aliases cannot introduce a different identity or bypass an
owned cover's media-retirement guard.

Frontend command:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/features/codex/components/CodexCardPickerDrawer.test.tsx src/features/gallery/hooks/useGalleryCardActions.novel.test.tsx src/features/gallery/components/GalleryPage.test.tsx src/features/gallery/media/components/OwnedImagePickerDrawer.test.tsx src/features/library/components/LibraryPage.test.tsx src/features/landing/components/LandingPage.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **670 passed / 104 files, one conditional fixture skipped**. New checks
cover bounded Unicode/cover relationships, explicit missing-file choice,
uncertain upload recovered by library refresh, foreign/late media responses,
manual tags, invalid-input device recovery and exact metadata rebase. The real
HTTP/MySQL novel/snapshot/copy/media wire passes the frontend readers. Build and
Storybook typecheck passed. Targeted lint has no errors; the unchanged media
studio effect retains its existing missing-`t` dependency warning. Logs are
`/tmp/novel-metadata-{client-tests,build,stories,lint,wire-tests}.log`.

Backend command:

```sh
.venv/bin/python -m pytest tests/services/test_story*.py tests/services/test_manuscript.py tests/models/test_story*.py tests/models/test_media_asset_ownership.py tests/routes/test_story*.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/scripts/test_novel_smoke_isolation.py -q
```

Result: **622 passed** (`/tmp/novel-metadata-backend-tests.log`). This scope adds
novel-only bounds, ownership/workspace/root-character predicates, unchanged
reference preservation, exact relationship identities, inherited/default POV,
context-disabled copy and current/frozen cover reference guards. These checks
use mocked persistence; actual persistence evidence is separate.

```sh
.venv/bin/python scripts/smoke_novel_metadata.py
```

The final smoke passes in newly allocated and retained
**`magic_worlds_novel_metadata_test_98e00ca351ba`**. It proves owned/missing-file
cover assignment, rejection of foreign/wrong-workspace/deleted/case-alias
assignments, atomic concurrent replay, exact Unicode text, default/local POV,
unrelated edits after a reference is removed, frozen cover/POV captures,
reviewed restoration of the original metadata/pin, independent copies without
active context, and the existing provider-free image upload/discovery flow.
Current and snapshot-only covers block asset retirement; an alternate-case
binary UUID lookup can return absent but cannot delete the original record.
The unreferenced synthetic asset alone can be retired. Exact internal receipts
retain their original head, while an HTTP replay reads current metadata without
replacing later edits. A real-MySQL column-name failure found during development
was corrected before the final passing run. The smoke retains its database and
synthetic local image storage; it never selects or writes the project database.
Wire/log outputs are `/tmp/novel-metadata-wire.json` and
`/tmp/novel-metadata-smoke.log`.

Controlled desktop Storybook review confirmed explicit owned selection, a
selectable unavailable-file record, accessible description and saved cover/
default POV. Proof images are `novel-cover-retained-record.png` and
`novel-cover-pov-saved.png` in this task's visualization directory. The fixture
uses bundled artwork and local callbacks, not authenticated account writes.
The temporary preview/tab were closed. The project API was restored on its
existing port and its read-only health returned `{"status":"ok"}`. No schema
change, project database test write, reset or generation provider call was
needed for the metadata verification. Authenticated author, phone/assistive-
technology, performance, retention/offline and release gates remain open, as do
N09/other D2 work and D3–D6 at that checkpoint; the later evidence below
supersedes the statistics item.

### Root POV cache inheritance follow-up — 2026-10-16

A later cache review found the browser's inheritance decoration did not read
`root.details.povCardId` after scene acknowledgements or root metadata merging.
The cache now preserves the novel default and independent local overrides
through those paths. A regression exercises initial inheritance, a scene save,
later default-POV metadata and a local override. The expanded original frontend
scope passed **671 tests / 104 files**, one conditional fixture skipped, and
production build passed. Logs are `/tmp/novel-metadata-pov-cache-client-tests.log`
and `/tmp/novel-metadata-pov-cache-build.log`. No schema or project data change
was needed; this regression is included in the statistics verification below.

## D2 saved statistics evidence — 2026-10-16

**N09 is implemented and installed locally; D2 and the full D1–D6 goal remain
WIP.** Scene counters bind canonical document revision/hash, while small root
aggregates bind structure revision and separate active/archive/Trash sections.
Shared client/server validators reject malformed, stale or unsafe totals.
Unknown counts remain unavailable, not zero. Library reads use cached numeric
data, with inclusive size filters, stable word sorting and explicit archive
scope. Markdown syntax in literal canonical text is not stripped as a preview.

The fixed-English native ICU policy has Unicode/CJK/contraction/number/NUL,
missing-library and concurrent-iterator regressions. Word unavailability retains
saving and character/UTF-8 counts. Ordinary text saves cache only the changed
document; aggregate refresh reads numeric counters and lifecycle metadata under
the existing root lock. Metadata writes reuse counters. Fresh copies retain
insert-only identity guards. Named captures advance the cache source head.
Late client reads/acknowledgements cannot reattach totals to newer writing.

Prepared changes were verified in isolated filesystem copies, then copied back
only after SHA-256 guards confirmed no original file had changed. The Git index
was not modified. The same installed frontend sources were verified with:

```sh
pnpm exec vitest run src/features/novel src/shared/story*.test.ts src/infrastructure/api/story*.test.ts src/shared/novelMutationJournal.test.ts src/app/providers/DataProvider.novelCreation.test.tsx src/app/providers/DataProvider.novelLifecycle.test.tsx src/features/codex/components/CodexCardPickerDrawer.test.tsx src/features/gallery/hooks/useGalleryCardActions.novel.test.tsx src/features/gallery/components/GalleryPage.test.tsx src/features/gallery/media/components/OwnedImagePickerDrawer.test.tsx src/features/library/components/LibraryPage.test.tsx src/features/landing/components/LandingPage.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Result: **680 tests / 107 files passed**, one conditional fixture skipped;
production build and Storybook typecheck passed. ESLint passed for the changed
TypeScript source/tests/stories and POV cache regression. Logs are
`/tmp/novel-statistics-real-{client-tests,build,stories,lint}.log`. The build's
existing chunk-size warning remains; no supported performance limit is inferred
from a successful build.

Installed BFF sources were verified with:

```sh
.venv/bin/python -m pytest tests/services/test_story*.py tests/services/test_manuscript.py tests/models/test_story*.py tests/models/test_media_asset_ownership.py tests/routes/test_story*.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/test_novel_statistics_migration.py tests/scripts/test_novel_smoke_isolation.py -q
```

Result: **640 passed** (`/tmp/novel-statistics-real-backend-tests.log`). This
scope includes mocked writer/aggregate/rollback boundaries, strict count/query
validators, ICU fixtures, exact schema and preservation/reset guards. It does
not use project records as test fixtures.

```sh
.venv/bin/python scripts/smoke_novel_statistics.py
```

The final actual HTTP/MySQL smoke passed in newly allocated and retained
**`magic_worlds_novel_statistics_test_2ff043a50458`**. It created a synthetic
109-table predecessor, verified a private backup/read-only preflight, applied
the two-table upgrade and backfill, repeated it as a no-op, and verified all
59 original synthetic content rows unchanged, including a missing-file image
record. Preflight rollback explicitly releases metadata locks before a later
CREATE on the same pool; a real MySQL wait found during development was fixed
and the complete sequence passed. No reset statements or cleanup were used.

The same isolated flow checked canonical multilingual counts, metadata counter
reuse, section/ancestor archive/Trash/restore, named capture, concurrent exact
replay, stale CAS, snapshot restore, split/merge and history undo/redo. A late
receipt failure rolled back prose and counts together. Copies retained archived
and trashed totals. Inclusive zero/range bounds, both word directions, archive
scope and workspace isolation passed. Missing native segmentation retained
null words, failed minimum-zero filtering and sorted last both ways; stale
summary counts stayed null until a normal saved transaction healed them.
The actual wire payload passed frontend runtime guards. Log/wire outputs are
`/tmp/novel-statistics-smoke.log` and `/tmp/novel-statistics-wire.json`.

A synthetic **1,000-scene / 30,000-word** fixture measured one save at **0.303s**,
one filtered list at **0.014s** and a **1,215-byte** summary without manuscript
or pin hydration. These observations do not establish a supported ceiling,
concurrent-load latency, long-term storage/retention limits or author acceptance.

### Installed schema and preservation

Before changing the project schema, a separate read-only preflight verified its
28 canonical scene documents/hashes/projections. The API was briefly stopped
and a new mode-0600 private backup captured **4,277 rows / 109 tables**:
`magic-worlds-api/.dev/backups/novel-statistics-pre-20261016T194150Z-559c9bf5.sql.gz`.
Compressed SHA-256:
`1dcdfd61973bed8b492765291bf251bdcfde903466138972bff697da5c1dbf98`.
Metadata verifies database/server/predecessor identity, complete compressed and
expanded hashes, per-table counts and logical row fingerprints. Binary values
use hex SQL literals and do not depend on UTF-8 decoding arbitrary blobs.

The applied upgrade added only `story_scene_statistics` and
`story_novel_statistics`, populated six novel caches and advanced the marker.
Before/after fingerprint comparison verified **all 4,276 original content rows
across 108 content tables unchanged**; the 109th predecessor table holds the
separately advanced marker. `/tmp/novel-statistics-project-upgrade.json` records
the result. Read-only post-startup verification found
**`2026_10_novel_statistics`, 111 tables / 156 FKs**, all six root caches valid
and no stale cache among 28 scenes. Its result is
`/tmp/novel-statistics-installed-verification.json`. API health returned
`{"status":"ok"}`; OpenAPI exposes both word bounds and all eight sorts.

No project reset, unrelated reseed, file/record cleanup or project database test
write occurred. All recovered non-novel content and legitimate missing-file
records were preserved. The API remains running on its existing port. Ordinary
startup performs configured voice readiness requests; the novel verification
and synthetic statistics flows do not execute a generation provider.

Controlled desktop Storybook review verified that changed bounds remain
unapplied until Apply, then update the visible selection. Proofs are
`novel-saved-statistics-filter-review.png` and
`novel-saved-statistics-filter-applied.png` in the task visualization directory;
the applied proof was also displayed in the conversation. The fixture uses
local callbacks, with no project writes. Owned previews/tabs were closed.
Reading preferences/result navigation, remaining catalog/organization/context
cases, complete performance/retention/offline decisions and author/mobile/
assistive-technology acceptance remain open, as do D3–D6 and release readiness
at this checkpoint. The following reading work supersedes its appearance item.

## D2 reading appearance evidence — 2026-10-16

**E11 is implemented and locally verified; complete N10, D2 and D3–D6 remain
open.** [Reading controls](../../src/features/novel/components/NovelReadingPreferences.tsx)
reuse the shared Drawer/Field/Select/Button primitives and English/Spanish copy.
Literary, Close reading and Spacious presets have custom font, text size,
line/paragraph spacing, width and prose contrast. All dimensions and colors
come from registered theme tokens. Ordinary author prose keeps its own surface;
AI accents retain their existing meaning. Controls remain available in archived
readers and do not flush or mutate writing.

The [preference hook](../../src/features/novel/hooks/useReadingPreferences.ts)
extends the existing API/account/workspace/novel view scope with a small versioned
enum record. It rejects corrupt/future/oversized or extra-field data without
deleting it. Storage read/write failure preserves the open room's choices and
explains that reopening could not be retained. Missing authenticated scope is
memory-only; no global preference is imported. Late old-scope/unmounted setters
cannot write a different room. Reopening the same scope restores its saved
appearance. The setting never enters manuscript JSON, metadata, checkpoints,
AI context, generation requests or the database.

Changing the inherited CSS appearance leaves the real TipTap editor instance,
rich document, selection and manual edit undo history intact. The layout hook
also remeasures the chosen width without requiring a browser resize, preserving
the editor while docking changes. Default font stacks retain fallbacks; full
font-loading/glyph/device acceptance is still outstanding.

The same complete frontend command in the
[statistics evidence](#d2-saved-statistics-evidence--2026-10-16) passed
**693 tests / 109 files**, one conditional fixture skipped. Its expanded scope
adds storage/reopen/isolation/failure/invalid-record tests, labeled preset/custom/
reset controls, archived-menu access/focus, width remeasurement and an actual
editor document/selection/undo regression. The focused six-file scope passed
**44 tests**. After clarifying the storage warning, the final preference scope
passed **10 tests / 2 files**:

```sh
pnpm exec vitest run src/features/novel/hooks/useReadingPreferences.test.tsx src/features/novel/components/NovelReadingPreferences.test.tsx --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
```

Production build and Storybook typecheck passed; targeted ESLint passed for all
changed TypeScript sources/tests/stories/locales/token inventory. The new preset
guard uses the repository's existing JavaScript target; an initial unsupported
`Object.hasOwn` call was replaced before the passing builds. Logs are
`/tmp/novel-reading-{focused-tests,client-tests,final-preferences-tests,build,stories,lint}.log`.
No backend behavior/schema changed in this slice; the installed statistics
schema and its 640 scoped backend checks remain current.

Controlled desktop Storybook review typed “The seal was still warm.” into the
local manuscript, opened Reading preferences, chose Close reading using the
keyboard, confirmed all five selected values and returned to the same draft.
Proofs `novel-reading-close-preset.png` and
`novel-reading-preserved-draft.png` are in the task visualization directory;
the latter was displayed in the conversation. This is a local fixture with no
project API, provider or database writes. The owned preview/tab were closed;
the actual project API remains running and healthy.

**Remaining D2:** finish scoped panel/view resume and manuscript result
navigation; remaining catalog/organization/context cases; complete performance,
retention/offline policy and author/mobile/font-loading/zoom/assistive-technology
acceptance. Basic saved scene/cursor/scroll already exists. The fixed reading
appearance did not establish complete N10 at that checkpoint. The following
implementation adds scoped view/position resume; phase/release gates stay open.

## D2 view and position resume evidence — 2026-10-16

**N10 is implemented and locally verified; full D2/D3–D6 and release readiness
remain open.** [Studio view state](../../src/features/novel/hooks/useStudioView.ts)
uses the existing API/account/workspace/novel view scope. Selected unit and
versioned panel preferences have independent small records; outline and reading
records are preserved. Focus mode, typewriter, preferred Codex visibility,
narrow outline/Codex and context scope reopen by their owner/novel. The old
global booleans are ignored and left untouched. Explicit empty containers stay
selected; missing/trashed units fall back to available prose. Focusing actual
prose records that scene without invoking a manuscript or structure write.

The [position hook](../../src/features/novel/hooks/useScenePosition.ts) keeps
immutable per-scene point/scroll hints, with bounded input and retired stale or
unmounted callbacks. It flushes on scene change, close, page hide and hidden
visibility. A recovery remount reads its latest capture rather than only the
initial storage snapshot. Storage failures retain current controls/points and
show localized reopening guidance; successful retry clears the warning. No
view preference owns prose, author metadata, AI input or review/request state.

The [adapter](../../src/features/novel/editor/manuscript.ts) rejects missing
blocks, partial mention offsets and split UTF-16 pairs without changing a
selection or applying an unrelated scroll offset. Initial restoration does
not overwrite the saved scroll with the editor's initial zero. Explicit user
focus may naturally scroll to the caret; the regression separates that later
interaction from initial restoration.

Source review additionally found that raw offsets could activate a replacement
range over changed text after reopening. [Document fingerprints](../../src/features/novel/editor/positionFingerprint.ts)
now bind retained ranges to canonical JSON with native SHA-256. A matching
document restores the range; changed text, old unbound records or unavailable
fingerprinting restore a cursor at its saved head. No manuscript text enters
preferences. Fingerprints are requested for non-collapsed ranges and cached
per immutable document, avoiding new whole-document hashing per ordinary
caret/typing update. A delayed fingerprint cannot promote a superseded point
or override later text, selection, focus, scrolling, pointer or keyboard input.
Unavailable native WebCrypto retains cursor/scroll recovery, including local
HTTP contexts where that API is absent.

Narrow navigation preferences survive docking; the drawer is shown only when
its panel is undocked. Closing Codex clears its old overlay, and entering focus
mode clears narrow overlays while retaining the preferred docked Codex state.
An unavailable scene/chapter context choice visibly falls back without changing
the stored preference. The editor and unsaved writing keep their existing
instance and revision/recovery authorities.

The complete frontend command recorded in the
[statistics evidence](#d2-saved-statistics-evidence--2026-10-16) passed
**723 tests / 111 files**, one conditional fixture skipped. The added scope
exercises owner/API/workspace/novel/scene isolation, panel/selected-scene reopen,
global-key exclusion, untouched neighboring records, invalid/future/oversized
input, unavailable storage/retry, rapid toggles, page lifecycle flushing,
immutable points and late callback retirement. Actual editor regressions cover
initial/latest scroll, missing nodes, exact-document ranges, changed documents,
missing WebCrypto, late user edit/pointer/key protection and superseded range
proofs. The early focused seven-file scope passed 50 tests; the final guards
were included in the full command rather than added to that older count.

```sh
pnpm build
pnpm typecheck:stories
```

Production build and Storybook typecheck passed. Targeted ESLint for all changed
TypeScript sources/tests/stories/locales passed with zero errors/warnings. Its
JSON result is `/tmp/novel-view-lint.json`; other final logs are
`/tmp/novel-view-{client-tests,build,stories}.log`. A Storybook ref-containing
layout object initially triggered the compiler lint rule; destructuring its
returned ref/booleans, as the real Studio already does, resolved it without a
suppression. A test that requested explicit focus before asserting initial
scroll was corrected to check restoration first; user focus is allowed to
scroll to its caret. No production scroll behavior was weakened for that test.

Controlled desktop Storybook review first verified retained scene, closed Codex,
context choice, typewriter mode and local draft through close/reopen. After
document binding was added, the final preview selected “already opened”,
scrolled to journal entry 5, closed/reopened to the same passage, focused the
editor using Tab and confirmed the same selected phrase. Typing “kept watch at”
replaced that exact phrase. Final proofs are
`novel-view-bound-before-close.png`, `novel-view-bound-reopened.png` and
`novel-view-verified-selection.png` in the task visualization directory. Earlier
preliminary images are retained separately. The fixture's prose stays in host
memory; its hints use an isolated synthetic device scope. This does not claim
real account or server-save acceptance. Temporary accessibility observation
timeouts did not restart the live preview; inventory/screenshot observation
confirmed it and ordinary screenshot-guided keyboard actions completed review.

The owned preview/tab were closed. The actual project API stayed running and
its read-only health returned `{"status":"ok"}`. **No project database/schema,
provider, upload or record/file cleanup was used.** The unchanged backend retains
the installed statistics schema and prior 640-check scoped evidence. Preserved
content and legitimate missing-file records remain intact.

**Next D2:** manuscript result navigation and remaining catalog/organization/
context cases; complete performance, retention/offline decisions and full
app-shell/author/mobile/font-loading/zoom/assistive-technology acceptance.
D3–D6 remain planned; no phase or release completion is claimed.

## D2 manuscript search evidence — 2026-10-16

**Implemented locally; S17 stays partial and the full D1–D6 objective remains
WIP.** The source is [the search drawer](../../src/features/novel/components/NovelManuscriptSearch.tsx),
[scoped source](../../src/features/novel/hooks/useManuscriptSearchSource.ts),
[wire guards](../../src/infrastructure/api/storySearchContract.ts),
[projection merge](../../src/shared/storySearchCache.ts) and
[editor target mapping](../../src/features/novel/editor/extensions/manuscriptSearchTarget.ts).
The sibling BFF adds `src/models/story_search.py`, `src/services/story_search.py`,
`src/database/mysql/story_search_store.py` and owned routes in `stories.py`.

Saved canonical prose is searched literally with significant whitespace,
case/unit/effective-status/archive options. MySQL ICU returns the actual source
quote: insensitive `ss` can match one saved `ß`. Locations use 1-based Unicode
codepoints for native resolution and 0-based UTF-16 for the editor. Root and
ancestor lifecycle are independent; ancestor Trash is excluded and archived
workspace/account boundaries remain enforced. Queries stay in POST bodies,
not URL parameters. Pages contain excerpts/headers rather than documents/pins/
history. Cursors bind normalized options and the whole source revision vector;
source changes require a fresh search.

Resolving a hit validates that source and loads one canonical document
projection. Pins/history are omitted explicitly and preserved by a compatible
cache merge. The existing full-tree reader is a fallback for obsolete/unknown
paths and revalidates the source; complete lazy loading is not claimed. Before
navigation, writing flushes and active recovery/review blocks the jump. Exact
canonical JSON/quote checks reject a local draft mismatch. The resulting view
decoration leaves a collapsed caret and manual undo intact; mention fragments
highlight the atom and structural newlines navigate a boundary. Edits clear
the decoration. Scoped/late callback checks keep old targets out of a new room.

Verification in isolated source preparations:

- Full novel frontend scope: **749 passed / 117 files**, one conditional fixture
  skipped, `/tmp/novel-search-novel-tests.log`. This extends the preceding 723
  checks with transport/native-wire, projection-cache/owner, drawer pagination/
  conflict/review gates, PM atom/Unicode/boundary mapping and actual editor
  creation/navigation regressions. The production build and `.storybook/tsconfig.json`
  typecheck passed (`/tmp/novel-search-build.log`, `/tmp/novel-search-stories.log`).
- Broader BFF filename scope: all `tests/**/test_*.py` whose filename contains
  `story`, `novel` or `manuscript`: **696 passed / 39 skipped**,
  `/tmp/novel-search-backend-tests.log`. This scope differs from the preceding
  640-check selection; counts are not additive. The new search-focused subset
  passed 26 tests.
- `scripts/smoke_novel_search.py` allocated and retained
  `magic_worlds_novel_search_test_d311d969ab9b`. It used real HTTP/MySQL, no
  providers. Checks include emoji/native sharp-s/literal punctuation/whitespace/
  cross-paragraph quotes, exact UTF-16 slices, page resume at text end, source
  conflicts, unit/status/lifecycle filters, root archive/Trash, archived
  workspace and account isolation, document-only resolve and unchanged
  story-table fingerprints around search/resolve reads. The actual wire is
  `/tmp/novel-search-wire.json`; output is `/tmp/novel-search-mysql-smoke.log`.
  A synthetic 1,000-scene / one long matching scene query returned 20 excerpts
  in **0.192 seconds / 15,140 bytes**. This does not prove a supported size or
  latency budget.
- Final installed-checkout verification passed `pnpm build`,
  `pnpm typecheck:stories`, the complete frontend suite (**4,771 passed / 493
  files**, one conditional fixture skipped) and the complete novel scope
  (**749 passed / 117 files**, one skipped). Logs are
  `/tmp/novel-search-installed-{build,stories,tests,novel-tests}.log`.
  The repository text gate also passed. Targeted lint introduced no findings;
  45 existing API/DataProvider findings match their pre-change baseline.
  Existing build chunk-size and jsdom media/scroll notices remain.

Actual desktop review used the controlled ASCII Storybook fixture and the real
header/drawer/editor, without project/provider requests. It found and corrected
an actual layout defect: shrinking the prose root left long text outside its
measured box and prevented tail scrolling. The prose now retains intrinsic
height; the theme owns tail spacing, and a guarded post-layout callback centers
the exact saved passage after closing the drawer. A later-scene result after
24 paragraphs was visibly highlighted. Typing `old ` inserted beside `gate`
instead of replacing it; the edit cleared the highlight. Proof images in the
task visualization directory are `novel-search-exact-result.jpg` and
`novel-search-collapsed-edit.jpg`. Earlier preliminary PNG-named captures are
retained and are not final proof.

No schema/seed or project database write/reset/cleanup is part of this slice.
All non-novel content, including legitimate records without files, remains
retained. Scoped replacement review/bookmarks, broader D2 organization/context,
performance/retention/offline/author acceptance and D3–D6 remain open.

## D2 links and typing evidence — 2026-10-16

**E04 link controls and E10 author typing choices are implemented locally.
D2 and the full 136-capability D1–D6 objective remain WIP.** Source:
[link target/paste helpers](../../src/features/novel/editor/manuscriptLinks.ts),
[link extension](../../src/features/novel/editor/extensions/manuscriptLinks.ts),
[inspector](../../src/features/novel/editor/components/ManuscriptLinkDialog.tsx),
[typography rules](../../src/features/novel/editor/extensions/authorTypography.ts),
[typing choices](../../src/features/novel/components/NovelTypingPreferences.tsx),
[shared device storage](../../src/features/novel/hooks/useNovelDevicePreferences.ts)
and [integration](../../src/features/novel/editor/NovelEditor.tsx).

The inspector is reachable from selection controls, More and Ctrl/Cmd+K.
Complete supported web/mail/phone destinations use existing canonical link
marks/titles. Edits freeze editor/document/range, preserve captions/formatting
and use ordinary undo; stale/destroyed/foreign targets, recovery/read-only,
review and invalid/over-limit output cannot commit. Mixed destinations are
disclosed. Readers expose `aria-readonly`, retain explicit open/copy and offer
no write controls. Ember/underline styling uses theme tokens. Nothing opens an
external destination merely because it was pasted or detected.

An inert clipboard transform retains captions and unsupported/relative URLs
as text with feedback, rather than allowing a later invalid save or silently
discarding their destinations. Empty safe captions retain the URL; supported
titles survive. Automatic marking requires complete supported destinations.
The current canonical schema still excludes arbitrary HTML/media. This is not
the full D5 import/support/loss matrix. The pinned 3.26.0 Link source and the
official [Link options](https://tiptap.dev/docs/editor/extensions/marks/link)
were checked; no package was added.

Typing preferences use independent versioned enum records under the existing
API/account/workspace/novel view scope. Reading and typing share storage guards,
without combining their records. Corrupt/future/oversized records remain;
storage failures retain current-room choices, and old-scope/unmounted setters
are retired. Choices gate the existing TipTap input rules at each keystroke,
without recreating the editor or rewriting earlier text/paste/history.
Curly/angle/straight and fully literal choices override automatic quotes;
recognized Spanish manuscript names/codes use angle double quotes and the
disclosed fallback is curly. Dash/ellipsis and symbol/fraction controls remain
independent. See [Typography documentation](https://tiptap.dev/docs/editor/extensions/functionality/typography)
and the local pinned rule implementation; broader locale/author acceptance
is not claimed.

Verification:

- The complete prepared novel scope passed **776 tests / 122 files**, one
  conditional fixture skipped (`/tmp/novel-editor-scoped-tests.log`). This adds
  actual paste and keyboard inspection, frozen target/review/reader guards,
  size refusal, mixed destinations, link undo, dynamic input rules, storage
  isolation/failure/retirement and unchanged reading-preference regressions.
  Production build and Storybook typecheck passed
  (`/tmp/novel-editor-build.log`, `/tmp/novel-editor-stories.log`). Targeted lint
  passes with zero new findings (`/tmp/novel-editor-lint.json`).
- All 33 prepared files were applied to the actual checkout and matched the
  verified manifest. The installed full frontend suite passed **4,798 tests /
  498 files**, one conditional fixture skipped; production build and Storybook
  typecheck passed (`/tmp/novel-editor-installed-tests.log`,
  `/tmp/novel-editor-installed-build.log`,
  `/tmp/novel-editor-installed-stories.log`). The dossier check found 477 valid
  local links and 136 distinct capabilities; both repositories passed staged
  and unstaged whitespace checks. The temporary desktop preview was closed.
- `NOVEL_EDITOR_LINK_WIRE_OUT=/tmp/novel-editor-links-wire.json` on the focused
  link test exports the actual TipTap paste result. The retained execution
  helper `/tmp/novel_editor_link_smoke.py` first checks BFF canonical/Markdown/
  plain projections, then allocates a new synthetic database and uses HTTP
  create → save → reopen. **`magic_worlds_novel_editor_test_7e29d746a1a5` passed**
  at scene revision 2 with exact JSON, safe URL/title, retained unsupported
  destination text and content-hash agreement. No provider ran. Output:
  `/tmp/novel-editor-mysql-smoke.log` and
  `/tmp/novel-editor-link-persistence.json`.
- Controlled desktop review used the real editor/dialog/drawer in a synthetic
  Storybook scope. Ctrl/Cmd+K inspected `source notes`; editing its query value
  kept the caption and native Ctrl+Z restored the old URL. Keyboard choice of
  literal typing retained `"Literal" -- ... (c)`; automatic Spanish typing
  produced `«Ahora» — … ©` while earlier literal punctuation stayed unchanged.
  Reader inspection exposed URL/title and open/copy, with no write controls.
  Observation timeouts did not restart the live preview; native screenshots
  and actions confirmed it. Development hot reload reset the controlled
  in-memory fixture during source edits, so final reader/typography proofs
  were recaptured after the source changes.

Proof images in the task visualization directory: `novel-link-inspector.jpg`,
`novel-link-reader.jpg`, `novel-typing-preferences.jpg`,
`novel-typing-literal-prose.jpg` and `novel-typing-preserved-prose.jpg`.
No project database/schema change, original-record/file cleanup, backend code
change, provider call or package addition was needed. Actual persistence used
only the new synthetic database; legitimate missing-file records remain intact.
The prior 696-check scoped BFF evidence is unchanged. Next: saved Codex
reference keyboard/disambiguation, block movement and the remaining D2
organization/context/performance/retention/offline/author gates; D3–D6 remain
planned. No phase/release/goal completion is claimed.

## D2 saved-reference inspection evidence — 2026-10-16

**E14 keyboard opening/disambiguation is implemented locally; the complete 136-capability D1–D6 goal remains WIP.** Source: [reference resolution/ranking](../../src/features/novel/editor/referenceChoices.ts), [stored-atom interaction](../../src/features/novel/editor/extensions/referenceInspection.ts), [shared inspector](../../src/features/novel/editor/components/ManuscriptReferenceDialog.tsx), [source rows](../../src/features/novel/editor/components/ReferenceEntrySummary.tsx), [scope/source projection](../../src/features/novel/hooks/useCodex.ts), [editor integration](../../src/features/novel/editor/NovelEditor.tsx) and [Studio mutation guard](../../src/features/novel/components/NovelStudio.tsx).

The saved reference ID is the sole identity lookup. Old manuscript labels, removed pins, out-of-scope and overridden pins remain readable; missing IDs are never rebound by equal names. Plain detected names/aliases retain every overlapping identity for explicit inspection while the existing decoration precedence remains. The shared matcher has an opt-in overlap result; existing chat callers retain their greedy non-overlapping result. Canonical mention JSON and BFF mutation/schema contracts are unchanged. The local pinned Mention/ProseMirror implementations and official [Mention rendering documentation](https://tiptap.dev/docs/editor/extensions/nodes/mention) were checked. Read-only ProseMirror skips editing keymaps, so the focused React reader also handles Alt+Enter.

Alt+Enter previews the selected autocomplete choice without inserting it. Autocomplete exposes source/version/scope/description and context state; aliases and those fields are searchable. Manuscript use, current-session recency and pinned versions rank authorized current novel choices. It does not query or promote unrelated library sources. Excluded pins can be mentioned without enabling context; removed pins cannot be newly selected. A changed displayed source is rejected before insertion. Weak node indexing reuses unchanged manuscript subtrees. Full large-project limits remain unmeasured.

Opening/choosing an inspector preview changes no prose/context and runs no generation. Explicit context toggles require the selected current ID/context revision and existing workspace/reader/recovery/review/CAS guards. Removed/outside/overridden pins offer reading only. UI strings are available in English/Spanish; shared components and existing theme tokens are reused. Native Alt+Enter preview retained the incomplete query and excluded state; keyboard insertion of the second equally named source reopened the chosen version 7, not the first version 3.

Validation in the prepared copy:

- `./node_modules/.bin/vitest run src/features/novel src/infrastructure/api/story*.test.ts src/shared/story*.test.ts src/features/lorebook/loreTriggers.test.ts --exclude '.claude/**'` passed **697 tests / 115 files**, one conditional fixture skipped (`/tmp/novel-reference-final-scoped-tests.log`). This command is narrower than the earlier 776-test selection and is not a regression in passing test count. New tests cover duplicate identities, alias/provenance search, ranking, saved/removed/renamed IDs, reader/keyboard/modified-click behavior, no inspection mutation, explicit and stale context choices, and stale autocomplete refusal. Existing lore matcher tests also passed in the focused command.
- Production typecheck/build and Storybook typecheck passed (`/tmp/novel-reference-build.log`, `/tmp/novel-reference-stories.log`). Targeted lint passed with zero errors/warnings (`/tmp/novel-reference-lint.json`).
- Controlled desktop Storybook review used actual editor plugins, dialogs, source choices and native keyboard input with synthetic in-memory references. It verified Alt+Enter, duplicate source/version choices, explicit context inclusion, keyboard reader access, removed-pin pointer inspection, non-mutating autocomplete preview, and selecting/reopening the second autocomplete source. Screenshots in this chat's visualization folder: `novel-reference-duplicate-choice.jpg`, `novel-reference-context-choice.jpg`, `novel-reference-retained-reader.jpg`, `novel-reference-autocomplete.jpg`, `novel-reference-selected-pin.jpg`, `novel-reference-candidate-preview.jpg`. A wrapping issue in the shared button's source summary was found during review and corrected.
- Early focused tests exposed discarded matcher overlaps and skipped read-only keymaps; both product paths were corrected. One preservation fixture compared pre-normalized input against TipTap defaults; the regression now compares the actual document before/after inspection. These are local source/component/native interaction checks, not new authenticated database persistence or full assistive-technology acceptance.

Installed verification: all **29 prepared files** matched the transfer manifest. The actual checkout passed **4,825 frontend tests / 501 files**, one conditional fixture skipped (`/tmp/novel-reference-installed-tests.log`); production build and Storybook typecheck passed (`/tmp/novel-reference-installed-build.log`, `/tmp/novel-reference-installed-stories.log`). The prepared full run could not execute the Git-dependent repository text gate outside a Git checkout; that unchanged gate passed in this actual full run. Current concurrent locale/product-documentation edits were retained when merging the new strings. No Git index operation was performed.

The dossier verifier checked **489 local links / 136 distinct capabilities / 325 new source files**, with no missing links, duplicate capability IDs or trailing whitespace. Both repositories passed staged/unstaged whitespace checks. The temporary preview tab/server were closed (port 6006 refused connections) and the existing API returned HTTP 200 / `status: ok`.

No backend/source schema/dependency change, project database test write, reset or file/record cleanup was needed. Records without files remain valid. Remaining E17 and D2–D6 work stays in the [roadmap](14_status_and_roadmap.md).

## D2 manuscript block movement evidence — 2026-10-16

**E17 keyboard/click movement and canonical preservation are implemented locally; D2 and the full 136-capability D1–D6 goal remain WIP.** Source: [frozen target/whole-node transaction](../../src/features/novel/editor/blockMovement.ts), [keyboard/history boundary](../../src/features/novel/editor/extensions/blockMovement.ts), [shared review dialog](../../src/features/novel/editor/components/ManuscriptBlockMoveDialog.tsx), [editor integration](../../src/features/novel/editor/NovelEditor.tsx), [neutral native-default adapter](../../src/shared/storyDocument.ts), [native rich/nested/history fixtures](../../src/features/novel/editor/blockMovement.test.ts) and [controlled story](../../src/features/novel/components/NovelBlockMovement.stories.tsx).

The target freezes the actual editor, PM document and selection. Source/destination identities address complete sibling nodes. The nearest enclosing list moves whole items with nested content; quotations move their paragraphs, and selected containers move whole. The preview discloses all touched endpoint blocks and attachment implications. Actual delete/insert steps reuse nodes without Markdown/DOM reparse, assigned replacement IDs or client-created annotation lineage. Rich marks/links/mentions, ordered starts and selection direction remain. History closes before/after the event so typing and another move undo independently. Readers/recovery/AI, stale editor/document/selection and invalid/boundary destinations cannot commit. Applying returns to the moved passage after shared modal cleanup; newer input cancels deferred focus.

Regression tests found two pre-existing pinned-editor defaults inconsistent with the wire contract: neutral `orderedList.type: null` made numeric lists invalid, and stock trailing-node insertion silently added a paragraph after a final container/atom on selection or undo. The frontend normalizes only the empty list default (meaningful unsupported attributes remain invalid) and disables implicit trailing paragraphs. Canonical schema/backend behavior remain unchanged. A real NovelEditor regression covers selecting and moving an ending list through dialog and undo without prose emission on selection.

Verification:

- Selected frontend command: `./node_modules/.bin/vitest run src/features/novel src/infrastructure/api/story*.test.ts src/shared/story*.test.ts src/features/lorebook/loreTriggers.test.ts --exclude '.claude/**'`. The final prepared selection passed **716 tests / 117 files**, one conditional fixture skipped; installed full-suite results are recorded below. Earlier scoped output: `/tmp/novel-block-scoped-tests.log`; final prepared output: `/tmp/novel-block-final-scoped-tests.log`. Production build/typecheck, Storybook typecheck and targeted lint output: `/tmp/novel-block-build.log`, `/tmp/novel-block-types.log`, `/tmp/novel-block-stories.log`, `/tmp/novel-block-lint.json`.
- The rich fixture exports actual native before/move/undo/redo JSON and actual plain-projection traces with `NOVEL_BLOCK_MOVE_WIRE_OUT=/tmp/novel-block-move-wire.json` on `blockMovement.test.ts`. Its nested fixture exports `/tmp/novel-block-nested-wire.json`. A 1,000-block scene moves 200 blocks while preserving all canonical nodes/IDs and selected points (`/tmp/novel-block-move-size-check.json`; measured 20.17ms in one isolated fixture run, not an application latency promise).
- BFF `scripts/smoke_novel_block_moves.py --wire /tmp/novel-block-move-wire.json --nested-wire /tmp/novel-block-nested-wire.json` validates both inputs before allocating a NEW retained synthetic database. **`magic_worlds_novel_blockmoves_test_19039652413e` passed** exact JSON/plain/Markdown/hash save/reopen, rich/nested movements through scene revision 5, repeated-text identity, attached note mapping, cross-boundary quote retention, exact undo attachment recovery, preservation of later note text/resolution, receipt replay and stale-write rejection. Output: `/tmp/novel-block-mysql-smoke-final.log`, `/tmp/novel-block-persistence.json`. No provider ran and the project database was not touched. An initial helper assertion compared different GET/PUT response representations; it was corrected to compare the same GET head before/after the checks, then rerun in another fresh database. Both synthetic databases are retained.
- Backend anchor unit checks passed **21 tests** (`/tmp/novel-block-anchor-tests.log`). The API contract guide documents normal scene writes and the reproducible synthetic smoke; no new runtime endpoint/schema/dependency is introduced.
- Controlled desktop review used actual editor plugins/dialogs and native keyboard input. It verified rich paragraph Alt+Shift movement and Ctrl+Z, arbitrary sibling destination, full nested-item movement with ordered starts, independent native undo/redo, focus return and reader refusal. Proof images: `novel-block-keyboard-move.jpg`, `novel-block-destination-review.jpg`, `novel-block-nested-review.jpg`, `novel-block-nested-moved.jpg`, `novel-block-reader-guard.jpg` in this chat's visualization folder. These are synthetic local interaction/persistence checks, not broad mobile/assistive-technology or whole-product performance/author acceptance.

Installed verification: all **24 files** matched the guarded manifest (22 frontend/dossier files and two API script/guide files). The actual checkout passed **716 novel/story tests / 117 files**, one conditional fixture skipped (`/tmp/novel-block-installed-scoped-tests.log`), with no unhandled errors. Production build, Storybook typecheck and targeted lint passed (`/tmp/novel-block-installed-build.log`, `/tmp/novel-block-installed-stories.log`, `/tmp/novel-block-installed-lint.json`). Two unit scroll stubs were corrected to use the public `handleScrollToSelection` prop; the real editor test drains its pinned selection-toolbar debounce before jsdom teardown. No production timing was changed for that test cleanup.

The latest complete frontend run is **not green**: **4,846 passed / three failed / one skipped across 503 files** (`/tmp/novel-block-installed-tests.log`). The remaining failures are two old English/Spanish `voice_unavailable` copy expectations in `src/features/interaction/voiceCallLabels.test.ts` and one matching expectation in `src/features/call/components/CallScreen.test.tsx`, following concurrent voice-copy changes. That work and its tests were left intact. An earlier concurrent missing voice-filter declaration was already fixed in the current source before the final run. Shared locale edits were retained when refreshing the prepared copies. This limitation is separate from the passing novel scope and must not be reported as a passing complete checkout.

The API health check returned HTTP 200 / `status: ok`; the owned preview tab/server were closed and port 6006 refused connections. Both repositories passed staged/unstaged whitespace checks; the dossier retains 136 distinct capability IDs and valid local links. No Git index operation was performed.

Existing project content, media and schema remain preserved; records without files remain valid. No reset, file/record cleanup, commit, deployment or phase completion is implied. Remaining catalog/acceptance and D3–D6 stay in scope.


## D2 unit planning evidence — 2026-10-16

Manual unit tags and ordered planned beats are installed. The [delivery checkpoint](14_status_and_roadmap.md#d2-unit-tags-and-planned-beats--2026-10-16) records remaining D2 gates and unchanged D3–D6 scope. No phase or release completion is claimed.

Implementation: [unit metadata guard](../../src/shared/storyUnitDetails.ts), [ordered beat controls](../../src/features/novel/components/NovelPlannedBeats.tsx), [unit details](../../src/features/novel/components/NovelUnitDetails.tsx), [template editor](../../src/features/novel/components/NovelTemplateEditor.tsx), [journal write validation](../../src/features/novel/persistence/metadataJournal.ts) and the API reader guard share the same optional fields and bounds. BFF `services/story_unit_metadata.py` supplies store/template validation; `services/story_library.py` searches full beat text. No persisted beat identities, inherited defaults or automatic prompt supplementation were added.

The regressions exercise Unicode/codepoint and encoded-size boundaries, invalid/unfinished draft recovery, exact immutable requests/acknowledgements, field-wise rebase, multiline/duplicate reordering, reader guards, focus after movement and comparison of different beat boundaries with equal joined prose. Existing summary/source revision, personal notes, prose/checkpoints and frozen snapshots remain independent. Source changes were transferred through `/tmp/prepare-novel-planning-transfer.py` with per-file baseline/current/prepared hashes; unrelated image/voice work and the Git index were retained.

The native smoke `scripts/smoke_novel_planning.py` passed in **`magic_worlds_novel_planning_test_903cbdb7142d`**. It accepts no existing-database selector and uses the existing fresh retained-database helper. Evidence: `/tmp/novel-planning-mysql-smoke.log`, `/tmp/novel-planning-persistence.json` (private), and `/tmp/novel-planning-wire-check.log`. Actual reopened DTOs and the exact template receipt passed frontend runtime guards. No generation provider ran. No project database test writes, reset, migration or media/record cleanup was needed; missing-file records remain valid.

Installed checks: production build (`/tmp/novel-planning-installed-build.log`), Storybook typecheck (`/tmp/novel-planning-installed-stories.log`), changed-source lint (`/tmp/novel-planning-installed-lint.log`) and **522 scoped BFF tests** (`/tmp/novel-planning-installed-api-tests.log`) passed. The complete installed frontend run passed **4,899 tests across 509 passing files / 510 total, with two conditional tests skipped** (`/tmp/novel-planning-installed-tests-final.log`). The two optional native-fixture tests are separately exercised only when their local output files are provided; the new planning fixture passed its guarded wire check. The earlier unrelated voice-copy failures are resolved in the current checkout and were preserved. An initial restricted run failed three existing Git-based grep checks with `spawnSync git EPERM`; the complete rerun with normal subprocess access passed. Existing jsdom media stubs report unimplemented `pause()` notices and the build retains its bundle-size advisory; no unhandled error or failing assertion remained. The prepared focused and final full commands overlap and must not be added as independent coverage counts.

Controlled Storybook inspection verified exact reordered multiline beats, focus following movement, explicit draft resume, save acknowledgement and disabled reader controls. [Browser evidence](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-planning-reordered.jpg) is a desktop fixture, not signed-in author/mobile or assistive-technology acceptance. The project API was already stopped when checked, then started normally on 8010; read-only `/health` returned HTTP 200/status ok. No other preview was stopped.

Whole-manuscript reading, replacement review/bookmarks, further context/organization/editor cases, full performance, retention/offline and author/device/accessibility gates remain. D3–D6 remain planned and the full goal stays active.


## D2 continuous reader evidence — 2026-10-16

Saved whole-manuscript/part/chapter/scene reading is installed through [the shared drawer](../../src/features/novel/components/NovelManuscriptReader.tsx), [semantic canonical renderer](../../src/features/novel/components/ManuscriptProse.tsx), [owned source](../../src/features/novel/hooks/useManuscriptReadingSource.ts), [bounded page controller](../../src/features/novel/hooks/useManuscriptReading.ts), [runtime wire guard](../../src/infrastructure/api/storyReadingContract.ts) and the existing Studio save/review/cache readers. The [delivery checkpoint](14_status_and_roadmap.md#d2-continuous-manuscript-reading--2026-10-16) keeps D2 and D3–D6 open.

BFF `models/story_reading.py`, `services/story_reading.py` and `database/mysql/story_reading_store.py` reuse owned search metadata identities and single-scene validation. The read transaction issues no writer/lock/receipt operation and omits author metadata, candidate history and reference arrays from the public prose projection. Scope ownership still verifies empty containers. Global source changes prevent mixing later batches into earlier prose; mismatched/duplicate client pages fail without clearing existing pages.

Installed verification:

- `pnpm test --run --exclude '.claude/**'`: **4,911 passed / three conditional skips across 515 files** (514 passing files), `/tmp/novel-reader-installed-tests-final.log`. Existing jsdom media `pause()` notices remain; no unhandled error or failing assertion remained.
- `pnpm build` and `pnpm typecheck:stories`: passed, `/tmp/novel-reader-installed-build-final.log` and `/tmp/novel-reader-installed-stories-final.log`; the existing bundle-size advisory remains.
- Scoped BFF service/model/router, smoke-isolation and disabled-reset tests: **539 passed**, `/tmp/novel-reader-installed-api-tests.log`. The focused source/page/renderer/Studio tests include draft/review barriers, old-owner retirement, exact selection/cache heads and a newly archived workspace handoff refusal.
- New reader/changed novel code passes targeted lint. The shared API client has 41 existing `no-explicit-any` diagnostics; its new method adds none. Baseline/prepared rule/message/column/source-line comparison and `/tmp/novel-reader-lint-final.json` record that distinction. The corrected reader files pass `/tmp/novel-reader-last-lint.log`. This is not a green full-repository lint claim.

The native `scripts/smoke_novel_reader.py` passed in **`magic_worlds_novel_reader_test_5a85e5082849`**. It tested all scope kinds and page boundaries, rich Unicode/list/link documents, private metadata exclusion, archive/Trash, stale-source refusal before further hydration, owned workspace isolation and exact before/after manuscript preservation. A separate 1,000-scene fixture hydrated only two scene documents for the requested initial batch. Evidence: `/tmp/novel-reader-mysql-smoke.log` and private `/tmp/novel-reader-persistence.json`; `NOVEL_READER_PERSISTENCE` exercised every captured response through frontend guards (`/tmp/novel-reader-wire-check.log`). No provider ran and no existing/project database was selected for test writes.

Controlled browser evidence: [continuous prose](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reader-continuous.jpg), [chapter transition](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reader-next-chapter.jpg), [explicit stale-source warning](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reader-stale-source.jpg). Native inspection also verified the exact saved version-3 reference and successful explicit refresh. This is desktop fixture evidence; no signed-in author/mobile/assistive-technology or upper resource-limit acceptance is implied.

Source transfer uses `/tmp/prepare-novel-reader-transfer.py` and its hash-guarded manifest. Only the owned API was restarted; `/health` returned HTTP 200/status ok and OpenAPI exposed the new read route with a maximum batch of five. No migration/reset, file/media/record cleanup, commit or deployment occurred. Missing-file records remain valid. The temporary owned reader preview was on 6007 and was closed without stopping other previews.

The initial full-tree Studio loader remains and loaded static reader DOM accumulates. Reader cursor/scroll restoration, bounded DOM windowing, replacement previews/bookmarks, remaining organization/context/editor cases and complete performance/retention/offline/author/device/accessibility gates remain open, alongside D3–D6. The complete goal stays active.

## D2 reviewed replacement evidence — 2026-10-16

Reviewed literal saved-text replacement is installed in [search/review UI](../../src/features/novel/components/NovelManuscriptSearch.tsx), [rich fragment review](../../src/features/novel/components/NovelReplacementReview.tsx), [durable controller](../../src/features/novel/hooks/useManuscriptReplacements.ts), [owner-bound source](../../src/features/novel/hooks/useManuscriptReplacementSource.ts), [strict runtime guards](../../src/infrastructure/api/storyReplacementContract.ts) and [immutable intent journal](../../src/features/novel/persistence/replacementJournal.ts). The Studio blocks affected editing and new structure/replacement work while results are uncertain; [recovery](../../src/features/novel/components/NovelPendingReplacements.tsx) remains outside the drawer. The BFF uses `services/story_replacements.py`, `database/mysql/story_replacement_store.py` and strict `models/story_replacements.py`; four owned routes are mounted by `routes/stories.py`. [14](14_status_and_roadmap.md#d2-reviewed-manuscript-replacements--2026-10-16) keeps S17/D2 acceptance and D3–D6 open.

The compiler resolves native actual quotes and exact UTF-16 spans, preserves block/container/reference identities, untouched formatting/links/list starts, and applies literal multiline/deletion text with common marks. Protected reference and cross-block matches, read-only/proposal/work limits and unchanged occurrences are explicit. All selected edits, checkpoints, anchor remaps, statistics and the exact receipt commit together. Reversal verifies original immutable checkpoints and current prose hashes, writes new revisions, and retains later metadata/private-note text and resolution. Unfinished forms and immutable requests/receipts remain scoped by API/account/workspace/novel/writer; old owner callbacks never revive after re-login. A confirmed receipt is retained until all acknowledged owned scene heads load. The shared static reader now preserves literal text-node newlines.

Installed verification:

- `NOVEL_REPLACE_PERSISTENCE=/tmp/novel-replace-persistence.json pnpm test --run --exclude '.claude/**'`: **4,934 passed / three conditional skips across 519 files** (518 passing files), `/tmp/novel-replace-installed-tests-final.log`. Existing jsdom media `pause()` notices remain; no failed assertion or unhandled error remained. The earlier installed 4,931-test pass was followed by explicit size-limit/missing-checkpoint guidance and three new regressions, then this final full rerun.
- `pnpm build` and `pnpm typecheck:stories`: passed, `/tmp/novel-replace-installed-build-final.log` and `/tmp/novel-replace-installed-stories-final.log`. An explicit installed `tsc -b --pretty false` followed by `vite build` also passed; `/tmp/novel-replace-installed-vite-final.log` records the production artifact and existing bundle-size advisory. No dependency change was needed.
- BFF `.venv/bin/python -m pytest tests/services/test_story* tests/services/test_manuscript.py tests/models/test_story* tests/routes/test_story* tests/scripts/test_novel_smoke_isolation.py tests/test_development_reset_disabled.py -q`: **571 passed**, `/tmp/novel-replace-installed-api-tests.log`. These mocked checks do not write test rows to the project database.
- Changed/new TypeScript excluding the shared API client: **22 files, zero lint errors/warnings**, `/tmp/novel-replace-installed-lint.json`. Exact reconstruction of the pre-change API file matched SHA-256 `e19156608bd01b1e3abb21abf19dc9d637f6c1ce550e1464165fe8f470c965dd`; source-line/rule/message/column comparison found **41 existing diagnostics before and after, zero added**. Evidence: `/tmp/novel-replace-api-client-lint-summary.json`. This is not a green full-repository lint claim.

`scripts/smoke_novel_replacements.py` passed in the newly allocated retained synthetic database **`magic_worlds_novel_replacements_test_d0aef98830c7`**. It exercised native HTTP/MySQL Unicode/case expansion (`ss` → actual `ß`), rich marks/links/reference preservation, explicit protected matches, injected second-scene checkpoint failure with total rollback, concurrent exact replay, stale-source refusal, workspace isolation, unchanged metadata/goals/pins, personal-anchor remapping and grouped undo/redo. Later private-note text/resolution and metadata survived both reversals; later prose blocked reversal. `/tmp/novel-replace-mysql-smoke-final.log` records results. Private `/tmp/novel-replace-persistence.json` (0600) captured actual previews/receipts/reversals and passed frontend guards in the complete run. No provider ran, and no existing/project database was selected for test writes. The earlier preparation database `magic_worlds_novel_replacements_test_eef35feea504` is also retained; the final run verified the reduced public review shape.

Controlled desktop Storybook used actual selection/review/journal/recovery components with synthetic in-memory matches and receipts. Native input verified literal multiline form recovery, protected-reference refusal, selection invalidation/review, two-scene explicit application, reviewed undo/redo and a lost-response receipt recovery without another revision advance. Browser images: [protected rich preview](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-replacement-protected.jpg), [applied multiline prose](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-replacement-applied.jpg), [reachable uncertain-result recovery](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-replacement-recovery.jpg). This is fixture interaction evidence; native persistence is established by the separate database smoke, not by this mocked room.

Source publication uses `/tmp/prepare-novel-replace-transfer.py` and hash-guarded manifests; verified owned follow-up baselines are preserved alongside `/tmp/novel-replace-transfer-initial.json`. Only the existing owned API was restarted; HTTP `/health` returned 200/status ok and OpenAPI exposed all four replacement routes with a maximum 100 selected targets. The dedicated preview ran on 6007. No schema migration/reset, project database test write, file/media/record cleanup, commit or deployment occurred. Records without files remain valid.

Remaining D2 work includes bookmarks, reader position restoration/bounded DOM, initial tree-loading/performance, remaining organization/context/editor cases, retention/offline decisions and full author/mobile/font/zoom/assistive-technology acceptance. D3–D6 and the full 136-capability objective remain active; this checkpoint closes no phase or release gate.


## D2 bounded reader evidence — 2026-10-16

Installed [reading controller](../../src/features/novel/hooks/useManuscriptReading.ts),
[drawer integration](../../src/features/novel/components/NovelManuscriptReader.tsx),
[position lifecycle](../../src/features/novel/hooks/useReaderPosition.ts),
[bounded record/geometry helpers](../../src/features/novel/utils/readerPosition.ts)
and [runtime guards](../../src/infrastructure/api/storyReadingContract.ts) add
direct seeking, previous/next source-bound batches, six active scenes and
identity/hash-bound device paragraph resume. The shared Drawer exposes an
optional body ref; semantic prose exposes existing canonical block IDs as view
attributes. Neither becomes manuscript JSON or a new editor instance. The BFF
extends `models/story_reading.py` / `services/story_reading.py` without changing
the existing owned store transaction or any schema. [14](14_status_and_roadmap.md#d2-bounded-reader-and-position-resume--2026-10-16)
keeps D2/D3–D6 and broader gates open.

Installed checks:

- `NOVEL_READER_WINDOW_PERSISTENCE=/tmp/novel-reader-window-persistence.json pnpm test --run --exclude '.claude/**'`: **4,945 passed / four conditional skips across 521 files** (520 passing files), `/tmp/novel-reader-window-installed-tests-final.log`. The conditional fixture selection differs from the earlier replacement run. Existing jsdom media `pause()` notices remain; no assertion or unhandled error failed. The final rerun includes the changed-scene notice/retention correction.
- `pnpm build` and `pnpm typecheck:stories`: passed, `/tmp/novel-reader-window-installed-build-final.log` and `/tmp/novel-reader-window-installed-stories-final.log`. Prepared explicit `tsc -b` plus Vite production build also passed; existing bundle-size advice remains.
- Installed BFF service/model/router, smoke-isolation and disabled-reset selection: **577 passed**, `/tmp/novel-reader-window-installed-api-tests.log`. The command is the same scoped story selection as the preceding replacement checkpoint, not a complete backend-suite claim.
- Changed/new TypeScript excluding Drawer: **16 files, zero lint errors/warnings**, `/tmp/novel-reader-window-installed-lint.json`. Drawer baseline reconstruction matched SHA-256 `ec93e790c8b1953a37584bbf10782b1160a188908772c5253cde126afd9ac8d4`; diagnostic explanation/rule/column/source-line comparison found the same one existing effect diagnostic and zero added. `/tmp/novel-reader-window-drawer-lint-summary.json` records this distinction. The API client was unchanged in this slice. No green full-repository lint claim is implied.

Fresh native HTTP/MySQL `scripts/smoke_novel_reader_window.py` passed in retained
**`magic_worlds_novel_readerwindow_test_b53a69f587f8`**. It verifies default and
windowed scopes, direct seek, backward and short first batches, archive/Trash,
out-of-scope/foreign positions, stale source refusal and unchanged rich/private
projections. A 1,000-scene source sought offset 990 and hydrated two requested
documents; subsequent before/after windows were contiguous. Exact before/after
scene rows, including documents, revisions, details and timestamps, remained
unchanged. Evidence: `/tmp/novel-reader-window-mysql.log` and private (0600)
`/tmp/novel-reader-window-persistence.json`. The captured old/new/long responses
passed frontend guards in the installed full suite. The project database was
never selected for test writes, and no provider ran.

Controlled desktop browser review used [the long reading fixture](../../src/features/novel/components/NovelManuscriptReader.stories.tsx).
Native scroll advanced to scenes 993–998 with six rendered scene sections,
loaded earlier scenes again, and closed/reopened at block `long-scene-0994-1`
with a **0.125-CSS-px** top-coordinate difference. A development-preview refresh
also retained the saved scene. DOM evidence is `/tmp/novel-reader-window-browser-proof.json`;
images are [bounded reading](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reader-bounded-window.jpg)
and [resumed paragraph](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-reader-resumed-paragraph.jpg).
These are controlled interaction/geometry checks; native persistence is proved
separately. No broad author/mobile/assistive-technology/font/zoom/resource-limit
acceptance is claimed.

Source publication uses `/tmp/prepare-novel-reader-window-transfer.py` with
per-file baseline/prepared/installed hashes; verified owned follow-ups retain
the initial manifest. Only the owned API was restarted. HTTP health returned
200/status ok and OpenAPI exposed windowed/start/before fields with the same
maximum five requested documents. The dedicated temporary preview used 6007.
No schema migration/reset, file/media/record cleanup, project database test
write, commit or deployment occurred. Records without files remain valid.

Remaining work includes bookmarks, the initial full-tree Studio loader,
remaining organization/context/editor cases and complete performance,
retention/offline, author/mobile/font/zoom/assistive-technology gates, plus D3–D6.
The reading window is bounded; the existing complete Studio cache still retains
all current scene bodies. The full 136-capability goal remains active.

## D2 bookmark foundation evidence — 2026-10-16

**Historical preparation evidence, superseded by the installation below.**
At this checkpoint the work copies were isolated-tested while project runtime
and schema still used the bounded reader and `2026_10_novel_statistics`.
UI integration and the privately backed-up project upgrade were pending.

The prepared extension adds an explicit bookmark kind to personal annotation
storage; exact point/passage anchors; separate bounded note/bookmark pages;
255-character labels; immutable kind and origin; independent content/anchor
CAS; unchanged old note receipts/hashes; explicit bookmark copy choices;
verified split/merge/undo/redo and frozen event/snapshot lineage. Writer capture
can freeze a stable cursor point across the existing save gate without changing
note capture's nonblank-passage rule. Frontend wire guards verify the native
bookmark/copy/snapshot JSON as well as old note frames.

Verification completed in `/tmp/novel-bookmarks-web-work` and
`/tmp/novel-bookmarks-api-work`:

- Full prepared frontend suite: **4,953 passed / 4 skipped**, 522 files
  (521 passing). Both bookmark and bounded-reader native fixture environment
  variables were supplied. The temporary work copy has its own Git metadata
  for the existing read-only grep gate; the project index was not modified.
  Log: `/tmp/novel-bookmarks-prepared-web-tests-final.log`.
- Prepared backend story/manuscript/model/route/schema/migration/reset-isolation
  scope: **733 passed**. This includes bootstrap checks, so it is a different
  scope from earlier smaller story-only counts. The strengthened fingerprint
  projection check also passed all six bookmark migration tests.
  Log: `/tmp/novel-bookmarks-foundation-tests-final.log`.
- Complete TypeScript/Vite production build and Storybook typecheck passed.
  Twelve changed support/contract/type/test files lint cleanly; the API client retains
  the same **41 pre-existing diagnostics, zero added**, against its verified
  exact preparation baseline.
- Fresh retained native bookmark DB:
  `magic_worlds_novel_bookmarks_test_b913d939106c`. The private backup and additive
  upgrade preserved **68 original synthetic rows**, including a legitimate
  missing-file record. Verified old note request replay and frozen hashes,
  concurrent bookmark replay, exact cursor/empty-scene anchors, Unicode edits,
  split/merge/history, independent copies, frozen bookmark reads, Trash/restore,
  late receipt rollback, exact checkpoint reattachment and workspace isolation.
  Log: `/tmp/novel-bookmarks-mysql.log`; frontend wire fixture:
  `/tmp/novel-bookmarks-persistence.json` (private file).
- The preceding statistics migration still passes in another new retained DB:
  `magic_worlds_novel_statistics_test_748624cb3c19`, preserving **59 original
  synthetic rows**. Its 1,000-scene cache/list fixture passed, including the
  retained missing-file record. These synthetic measurements do not establish
  whole-product limits. Log: `/tmp/novel-bookmarks-statistics-regression.log`.

The additive bookmark migration compares every original content column rather
than counting rows alone; only its defaulted kind column, index and check are
new. The original note JSON field omission and prior snapshot/request hashes
are retained. No test write used the project database. Preparation attempts
and their synthetic DBs remain retained. No project record/media cleanup,
reset, commit, deployment or release completion is claimed.

Remaining bookmark product acceptance is listed in
[12](12_validation_and_acceptance.md#bookmark-completion-gates); the extension
contract is in [17](17_annotation_anchors_and_personal_review.md#prepared-bookmark-extension--2026-10-16).
D2 and D3–D6 remain incomplete.

## D2 bookmark installation evidence — 2026-10-16

**Bookmarks are installed locally; D2 and the full 136-capability D1–D6 goal
remain WIP.** Writer/reader point and passage creation, separate lists, labels,
Trash/restore, reviewed reattachment, exact writer navigation, scoped device
forms/receipt recovery, independent copy choices and frozen bookmark review are
connected. Every bookmark operation carries its immutable kind. Confirmation
checks the original owned checkpoint geometry, including empty-quote points,
before retiring input. Notes retain their nonblank-passage and omitted-kind
contracts. Old request/frozen hashes remain unchanged.

Source preparation used isolated real copies and a per-file SHA-256 transfer
guard. The installed runtime manifest contains 77 files (47 frontend, 30 backend);
later documentation and Spanish review-help updates are recorded separately.
The original index, unrelated voice/image work and initial manifests were
preserved. Installed commands:

```sh
NOVEL_BOOKMARKS_PERSISTENCE=/tmp/novel-bookmarks-persistence.json NOVEL_READER_WINDOW_PERSISTENCE=/tmp/novel-reader-window-persistence.json pnpm test --run --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
.venv/bin/python -m pytest tests/services/test_story*.py tests/services/test_manuscript.py tests/models/test_story*.py tests/routes/test_story*.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/test_novel_statistics_migration.py tests/test_novel_bookmarks_migration.py tests/scripts/test_novel_smoke_isolation.py
```

- Installed frontend: **4,972 passed / 4 skipped**, 525 files (524 passing).
  `/tmp/novel-bookmarks-installed-web-tests.log`.
- Installed scoped backend: **735 passed**.
  `/tmp/novel-bookmarks-installed-api-tests.log`. This scope includes bootstrap
  and migration/reset isolation and differs from earlier filename-only scopes;
  counts are not additive.
- Complete installed production build and Storybook typecheck pass:
  `/tmp/novel-bookmarks-installed-build.log` and
  `/tmp/novel-bookmarks-installed-stories.log`. Existing chunk-size warnings do
  not establish a supported performance bound.
- Forty-six changed TypeScript files are lint-clean. The API client retains
  **41 pre-existing diagnostics, zero added**, against original SHA-256
  `c2eff59a8b671722ae0fab083fd4a1b41243285ad8b2cc2ffc8a2997167c56ca`.
  `/tmp/novel-bookmarks-installed-lint-summary.json` records the installed
  rerun against that stored comparison. No full-repository lint claim is made.

Fresh provider-free HTTP/MySQL smoke passed in retained
**`magic_worlds_novel_bookmarks_test_44e8312404db`**, preserving **68 original
synthetic rows**, including a valid missing-file record. It covers old note
receipts/frozen hashes, explicit-kind mismatch rollback, point/empty-scene
anchors, Unicode edits, split/merge/undo-redo, later labels, independent copy
choices, snapshots, Trash/restore, late receipt rollback, exact checkpoint
reattachment and workspace isolation. Log:
`/tmp/novel-bookmarks-ui-mysql.log`; private native wire fixture:
`/tmp/novel-bookmarks-persistence.json`. Frontend guards consumed that actual
wire. The earlier statistics regression remains green in its separately
retained DB, with 59 original rows preserved. Test CRUD never used the project
database.

Before installation, the project backup was verified as full SQL plus logical
original-column fingerprints. Its SHA-256 is
`21049c65fd681eabc927befa4b14147c6613a033d51a4586e57d87949490ccc1`;
the private SQL/metadata path is in [15](15_database_migration_and_legacy_cleanup.md#bookmark-installation--2026-10-16).
One additive ALTER adds only annotation kind/index/check. All **4,314 original
content rows across 110 content tables** verified unchanged afterward; the
marker advanced separately to **`2026_10_novel_bookmarks`**, with **111 tables /
156 FKs**. A later read-only migration invocation reports no pending additions.
The owned API restarted healthy (HTTP 200/status ok); live OpenAPI exposes kind
on all four annotation operations and the list query. No reset or record/media/
file cleanup occurred. Records without files remain valid.

Controlled desktop Storybook checks used the real editor with local synthetic
annotation callbacks. Opening the verified bookmark produced a focused,
collapsed cursor at exact text offset **9**, with manuscript text unchanged.
An orphan required explicit saved-context reattachment; confirmation returned
focus to “Move to cursor or selection”. Closing the drawer retained pending
recovery; recovering and reopening showed the original reviewed bookmark label.
DOM evidence: `/tmp/novel-bookmarks-browser-proof.json`. Images:
[saved point context](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-bookmark-point-context.jpg),
[cursor](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-bookmark-cursor.jpg),
[reattachment review](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-bookmark-reattachment-review.jpg),
[recovered label](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-bookmark-recovered-label.jpg).
The owned preview/tab were closed and the project API was left running.
These are controlled desktop checks; native persistence is separate evidence.

Remaining D2 includes initial full-tree Studio loading, remaining organization/
context/editor cases, measured whole-product performance, retention/offline
decisions and complete author/mobile/font/zoom/assistive-technology acceptance.
Highlighting and invisible-character controls remain catalog work. D3 assistant/proposals, D4 planning/
continuity/review, D5 portability/productivity and D6 series/extensions remain
planned. No phase, release, commit or deployment completion is claimed.

## D2 Studio read-boundary evidence — 2026-10-16

**Read storage/endpoints and typed frontend transport are installed locally;
Studio's initial full-tree opening still needs UI/cache integration.** D2 and
the full 136-capability D1–D6 goal remain WIP. [ADR 18](18_studio_index_and_scene_loading.md)
records the explicit unloaded-content and complete integration requirements.

The scene-prose-free index reads metadata and cached counters without document
JSON/plain text or generation output. It retains complete root references. A
selected scene binds independent novel, ancestor and scene heads in one owned
consistent read; source changes return `STORY_STUDIO_SOURCE_CHANGED`. Existing
scene GET returns the same full target scene and no longer reads all bodies.
Applicable reference order and complete target generation history are retained.

Prepared validation used isolated source copies and exact per-file SHA-256 guards.
Current-source installed verification uses the same scopes and records its results
separately. Commands:

```sh
NOVEL_STUDIO_INDEX_PERSISTENCE=/tmp/novel-studio-index-persistence.json NOVEL_BOOKMARKS_PERSISTENCE=/tmp/novel-bookmarks-persistence.json NOVEL_READER_WINDOW_PERSISTENCE=/tmp/novel-reader-window-persistence.json pnpm test --run --exclude '.claude/**'
pnpm build
pnpm typecheck:stories
.venv/bin/python -m pytest -q tests/services/test_story*.py tests/services/test_manuscript.py tests/models/test_story*.py tests/routes/test_story*.py tests/test_schema_bootstrap.py tests/test_development_reset_disabled.py tests/test_novel_annotations_migration.py tests/test_novel_statistics_migration.py tests/test_novel_bookmarks_migration.py tests/scripts/test_novel_smoke_isolation.py
```

Result: **4,983 frontend tests passed / 4 skipped**, 526 files (525 passing);
**762 scoped backend tests passed**. Production build and Storybook typecheck
passed. The three new TypeScript support/contract/test files lint cleanly. The
API client comparison retains **41 existing diagnostics / zero added** against
its original SHA-256 `0041036e878014a32aa9574aa92519a1fe2209423a40e2596eef4d876dea17b4`.
Prepared logs use `/tmp/novel-studio-index-prepared-{web-full,api-full,build,stories,lint}.log`;
installed logs use `/tmp/novel-studio-index-installed-{web-tests,api-tests,build,stories}.log`.
No broad full-repository lint or release claim is made.

Actual provider-free HTTP/MySQL smoke passed in newly allocated and retained
**`magic_worlds_novel_studioindex_test_36e53a272f3d`**. Its 1,001-scene fixture
measured index JSON **1,045,729 bytes**, versus full-tree **35,337,023 bytes**;
the index hydrated **zero** documents and a selected scene **one**. Scoped local
times were **85.38 ms** and **36.11 ms** respectively; these are single fixture
observations, not p95, resource limits or supported-product promises. Complete
target history/applicable references, empty scenes, inherited settings, all
independent stale-head refusals, workspace/scene isolation, unchanged legacy
shape and archived reads passed. Fingerprints verified **4,024 synthetic rows
across 12 domain tables unchanged by reads**. A later actual scene edit invalidated
the old source. Log: `/tmp/novel-studio-index-mysql.log`; frontend-consumed native
wire: `/tmp/novel-studio-index-persistence.json` (mode 0600). An earlier setup
attempt missing a required creation outline failed validation; that synthetic
database also remains retained. No project database was used for test CRUD.

There is no schema change or marker advancement: current schema remains
`2026_10_novel_bookmarks`, 111 tables / 156 FKs. No reset, database drop,
file/media/record cleanup, commit or deployment occurred. Records without files
remain valid. The owned API is restarted and checked healthy after installation.
The current Studio still opens/refetches its complete tree. Replacing those
calls and their dependent copy/history/navigation/recovery consumers is the next
implementation task; complete D2 performance/offline/retention/author/device/
accessibility acceptance and all D3–D6 remain open.


## D2 Studio loading and bounded history evidence — 2026-10-16

The current [delivery checkpoint](14_status_and_roadmap.md#d2-studio-loading-and-bounded-history--2026-10-16)
supersedes the previous full-tree loading limitation. All 136 catalog capabilities
and D1–D6 remain in scope; no complete phase or release is claimed.

- Installed full frontend: `NOVEL_STUDIO_INDEX_PERSISTENCE=/tmp/novel-studio-loading-persistence.json NOVEL_BOOKMARKS_PERSISTENCE=/tmp/novel-bookmarks-persistence.json NOVEL_READER_PERSISTENCE=/tmp/novel-reader-persistence.json NOVEL_READER_WINDOW_PERSISTENCE=/tmp/novel-reader-window-persistence.json NOVEL_REPLACE_PERSISTENCE=/tmp/novel-replace-persistence.json NOVEL_PLANNING_PERSISTENCE=/tmp/novel-planning-persistence.json ./node_modules/.bin/vitest run --exclude '.claude/**'` — **5,015 passed / one conditional fixture skipped, 533 files**. Scope/queue/recovery, exact copy/search/bookmark/restore, source DTOs and new history/excerpt/read-cancellation cases are included.
- BFF: `.venv/bin/python -m pytest tests/models/test_story*.py tests/routes/test_story*.py tests/services/test_story*.py tests/services/test_manuscript.py tests/models/test_lorebook_story_models.py tests/test_novel_* tests/test_development_reset_disabled.py tests/test_schema_bootstrap.py tests/scripts/test_novel_smoke_isolation.py -q` — **827 passed**. These checks use mocked storage; provider checks remain excluded.
- `pnpm build` and `pnpm typecheck:stories` pass. Prepared copies used `--config.verify-deps-before-run=false` with the existing shared dependencies. Changed TypeScript adds no lint diagnostics. Exact source/diagnostic comparison retains 41 existing API client and four existing DataProvider diagnostics. Whole-repository lint is not claimed green.
- `.venv/bin/python scripts/smoke_novel_studio_loading.py` — retained **`magic_worlds_novel_studioloading_test_731460947cac`**. Actual HTTP/MySQL reads verify 1,001 scenes, zero index / one selected-document hydration, 20+7 saved generation pages, long exact detail, archived/Trash/foreign ownership, guarded source changes, Unicode excerpts, compact metadata update and exact original receipt replay with a newer index. **4,049 original synthetic rows in twelve domain tables remain unchanged by reads.** JSON index/full responses measured **1,045,729 / 35,987,773 bytes** and a single index/selected read measured **115.70 / 39.99 ms**. This is not p95, supported limits or whole-product memory/typing acceptance. The private wire is `/tmp/novel-studio-loading-persistence.json`.
- Controlled Storybook proof uses `Novel/Studio loading`: the real loader/editor retained new text while a read waited, refused its late selection, reused a cached confirmed read after saving, retained the previous scene on failure, and reopened the saved text after retry. History exposed older/Trash pages and full instructions/output; excerpt pages reached scenes 21–26. Screenshots are `novel-studio-loading-kept-draft.png` and `novel-studio-loading-full-history.png` in this task's visualization folder. They are controlled fixtures, not authenticated project CRUD or author/device acceptance.
- Logs/manifests: `/tmp/novel-studio-loading-{prepared-web-full,prepared-api-full,prepared-build,prepared-stories}.log`, `/tmp/novel-studio-loading-installed-{web-tests,api-tests,build,stories}.log`, `/tmp/novel-studio-loading-lint-baseline.json`, `/tmp/novel-studio-loading-ready.json`, `/tmp/novel-studio-loading-installed-source.json`, `/tmp/novel-studio-loading-installation.json`, `/tmp/novel-studio-loading-installed-runtime.json`. Transfer hashes preserve concurrent/unrelated work and the Git index; source/service rollback is prepared before the owned API restart.

No database schema/marker change, project database test write, reset, row/file/media
cleanup, commit or release is part of this slice. The project marker remains
`2026_10_novel_bookmarks`, 111 tables / 156 foreign keys, and API health is checked
after installation. Records without files remain valid. Complete performance,
offline/retention, author/mobile/IME/font/zoom/assistive-technology acceptance and
remaining D2 catalog/editor/context/organization work remain open; D3–D6 stay planned.


## D2 highlights and invisible characters evidence — 2026-10-16

The [current checkpoint](14_status_and_roadmap.md#d2-highlights-and-invisible-characters--2026-10-16)
implements E18's remaining editor controls while retaining all 136 capabilities
and D1–D6. No complete phase or release is claimed.

- Full frontend: the prior retained-fixture environment plus `NOVEL_WRITING_MARKS_PERSISTENCE=/tmp/novel-writing-marks-persistence.json ./node_modules/.bin/vitest run --exclude '.claude/**'` — **5,030 passed / one conditional fixture skipped (537 files)**. The editor/view tests cover Unicode/escaped Markdown, commands/undo, DOM/clipboard purity, scoped preferences, same editor/caret/autosave and read-only behavior.
- BFF: the same scoped novel command recorded in the Studio-loading checkpoint — **830 passed**. `pnpm build`, `pnpm typecheck:stories` and changed-TypeScript lint pass. Prepared/shared dependencies use `--config.verify-deps-before-run=false`; no dependency installation is needed.
- `NOVEL_WRITING_MARKS_WIRE_OUT=/tmp/novel-writing-marks-editor-wire.json ./node_modules/.bin/vitest run src/features/novel/editor/extensions/manuscriptHighlight.test.ts --exclude '.claude/**'` exports actual editor JSON. `.venv/bin/python scripts/smoke_novel_writing_marks.py` validates it before allocating a new retained database, then checks save/reopen, receipt replay, attached-note origin/body, unchanged prose statistics, guarded Studio/reader, frozen snapshot/checkpoint, restore/replay and independent copy. Final scene revision is **5** in **`magic_worlds_novel_writingmarks_test_ac44366071a4`**. Earlier request-contract fixture attempts remain retained; no existing database was reused or dropped. No model/provider call is part of this native flow.
- `/tmp/novel-writing-marks-persistence.json` is the private native wire. Strict frontend canonical/scene/Studio/reader/copy/revision/restore guards accept its actual responses. Unsupported style attributes/duplicate highlights reject; an invalid native write leaves the current head intact.
- Controlled `Novel/Writing controls/Highlights and invisibles` uses the real editor. Toolbar/shortcut/undo retained text and the preexisting highlight. Display markers stay separate from DOM/accessibility-value text, and the option can be changed read-only. Proof: `novel-writing-marks-editor.png` and `novel-writing-marks-preferences.png` in this task's visualization folder. This is synthetic desktop evidence, not authenticated author, real screen-reader, phone/IME, supported limits or model-quality evidence.
- Logs: `/tmp/novel-writing-marks-{prepared-web-full,prepared-api-full,prepared-build,prepared-stories,mysql}.log`; `/tmp/novel-writing-marks-installed-{web,backend,build,stories}.log`; final changed-file lint is `/tmp/novel-writing-marks-installed-lint.json` (**22 files, zero errors/warnings**). Hash manifests, source rollback and runtime checks are `/tmp/novel-writing-marks-{ready,installed-source,installation,installed-runtime,preparation}.json`. All 36 prepared files were installed through the guarded source/service operation. The documentation amendment adds the corrected active delivery plan and removes obsolete reset/reseed directions; all 37 final files are hash-verified. Source transfer preserves unrelated work and both existing staged patches. The owned API (PID **1542494**, task session **63263**) is healthy. Read-only verification confirms `2026_10_novel_bookmarks`, **111 tables / 156 foreign keys**, unchanged. The initial and amended manifests plus `/tmp/novel-writing-marks-docs-amendment.json` retain the source evidence.

Canonical schema version and database marker remain unchanged; no new table,
column, project database test write, file/media/record cleanup, commit or release
is part of this slice. Records without files remain valid. Remaining D2 acceptance
and all D3–D6 remain open; [12](12_validation_and_acceptance.md#highlight-and-invisible-character-acceptance)
keeps broader performance/device/author/accessibility and format/loss gates.


## D2 persistent device-entry evidence — 2026-10-16

The installed frontend adds
[`studioReadStorage`](../../src/features/novel/persistence/studioReadStorage.ts),
its owned [`publication hook`](../../src/features/novel/hooks/useStudioReadStorage.ts)
and [`device library/writer`](../../src/features/novel/components/NovelDeviceLibrary.tsx).
[ADR 20](20_offline_and_reconciliation.md#persistent-confirmed-copies-and-device-entry)
records the confirmed-read/acknowledged-prose distinction, atomic native usage,
explicit local-only queue, guarded navigation and exact fresh-scene handoff.
The actual workspace provider is never marked ready from cached metadata.

Final installed verification commands use
`/home/andres/WebstormProjects/magic-worlds`:

- `python3 /tmp/novel-cached-run.py web installed-final`: **5,134 passed / one conditional
  skip (553 files)**. The suite needs normal Git subprocess access; the first
  sandbox-only attempt rejected those subprocesses, then the complete rerun
  passed. Actual retained synthetic HTTP/MySQL Studio wire is included.
- `python3 /tmp/novel-cached-run.py build installed-final`: production build passes;
  existing large-chunk advisory remains.
- `python3 /tmp/novel-cached-run.py stories installed-final`: Storybook typecheck passes.
- Changed TypeScript lint has no added diagnostics; four pre-existing
  DataProvider diagnostics are independently compared with the untouched source.
  Focused draft/cache/editor/provider tests pass.

The **Novel / Device copies / Native reload recovery** fixture opts into only a
fictional browser author namespace. Native IndexedDB checks pass for concurrent
scene retention and usage, retired-owner refusal, other-author isolation,
invalid-read refusal and allowance failure preserving earlier copies. The
controlled limit retains **13 scenes / 15,728,107 bytes**; no copies are removed.
The fixture has no account client, provider or project-data operation.

Browser interaction retains new prose, leaves the writer after a checkpoint,
reloads the page, reopens the native scene and resumes the scoped draft. The
exact added sentence reappears. Keyboard entry focuses the scene heading,
return focuses its original scene button, resume focuses the canonical editor,
and Tab reaches the checkpoint/manual-copy actions.
Screenshots are
[recovered writing](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-device-reload-recovery.png)
and [pending account review](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-device-pending-sync.png).

Source preparation/transfer/installation evidence is recorded in
`/tmp/novel-cached-preparation.json`, `/tmp/novel-cached-transfer.json` and
`/tmp/novel-cached-installation.json`; verification logs use
`/tmp/novel-cached-final-{web,build,stories}.log`; final installed
checks use `/tmp/novel-cached-installed-final-{web,build,stories}.log`.
The review fix preserves existing proposals/instructions when remote AI pauses;
its 76 focused cache/queue/editor/provider tests and prepared build pass.
The read-only runtime inspection in `/tmp/novel-cached-runtime.json` confirms
healthy existing API PID 1585602, schema `2026_10_novel_erase`, 112 tables / 157
foreign keys, the same eight route contracts and zero erasure receipts.
No BFF runtime/source/schema, project data, media, original browser journals or
existing staged patch is changed by this slice.

This proves durable copies and entry after the application assets load, not
network-independent app-shell cold loading or durable unsent merge-form choices.
Those and broader author/mobile/assistive-technology/storage/retention/performance
acceptance remain open. [14](14_status_and_roadmap.md#d2-persistent-device-entry--2026-10-16)
retains full R13, D2–D6 and all 136 capabilities.

## D2 durable reconciliation-choice evidence — 2026-10-16

The review-form implementation in [ADR 20](20_offline_and_reconciliation.md#durable-review-choices-and-independent-recovery--2026-10-16)
is installed against the persistent-entry source. Its separate native
store keeps exact-source choices, independent writer ordering and atomic usage,
without changing prose journals, server requests or any BFF/schema/project data.
Direct saved-review access works independently of the confirmed-read cache and
cannot apply writing from its saved account snapshot.

Verification uses the existing retained HTTP/MySQL fixture results; no project
CRUD, new schema operation, provider, API restart or browser-record removal runs.
Commands are full `vitest run --exclude '.claude/**'`,
`pnpm --config.verify-deps-before-run=false build` and
`pnpm --config.verify-deps-before-run=false typecheck:stories`.
Full frontend verification passes **5,146 tests / one conditional fixture skipped (556 files)**, production build and Storybook typecheck. All 15 changed TypeScript files pass lint with zero diagnostics; the eight existing-file baseline checks also pass. Final installed source checks are recorded in `/tmp/novel-shell-final-verification.json`.
The six-file focused suite passes 42 cases including storage-failed close,
choice retention/export, successful retry and safe navigation state.
Changed-TypeScript lint is compared against the unchanged installed baseline.

The `NativeReviewReload` Storybook fixture uses only a fictional API/author
namespace. Native IndexedDB verifies 13 save/reopen, independent writer,
late/equal-sequence refusal, source/owner/workspace/API isolation, direct-entry
and oversized-record preservation checks. The real page reload recovers a
selected block choice with a new review ID. Saved snapshot entry supports
another retained choice while all account adoption/refresh controls are disabled.
Evidence is `/tmp/novel-shell-native-review-proof.json` and:

- `/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-review-recovered.png`
- `/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-saved-review-device-only.png`

Preparation, guarded transfer and installation evidence use
`/tmp/novel-shell-preparation.json`, `/tmp/novel-shell-transfer.json` and
`/tmp/novel-shell-installation.json`. Verification logs use
`/tmp/novel-shell-repaired-{web,build,stories}.log` and
`/tmp/novel-shell-installed-repaired-{web,build,stories}.log`.
Rapid ArrowDown/Alt+Enter also keeps the selected autocomplete source current before a React render. The original failure is reproduced by batching those keys; the correction updates the selection synchronously without inserting prose or enabling a reference. All 50 focused editor/reference/review cases pass. Reproduction evidence is `/tmp/novel-shell-keyboard-repro.json`; the three-file correction backup is `/tmp/novel-shell-keyboard-before`. Unrelated source and both existing staged patches remain hash-identical.
App-shell cold loading, wider retention/storage/device/author/performance gates,
full R13/D2 and D3–D6 remain open; all 136 capabilities stay in scope.

## D2 cold offline app evidence — 2026-10-17

[ADR 20](20_offline_and_reconciliation.md#opt-in-cold-offline-app-loading--2026-10-17)
adds opt-in cold app loading, verified build manifests, native budget reservations
and coherent waiting updates. Preparation is `/tmp/novel-cold-web-work` against
`/tmp/novel-cold-baseline.json`; guarded transfer and installation use
`/tmp/novel-cold-transfer.json` and `/tmp/novel-cold-installation.json`.

The production build emits a standalone module worker without app imports,
skip-waiting, cache deletion or private URL handlers. Artifact inspection verifies
all manifest lengths and SHA-256 digests against actual emitted files. The first
actual-app proof retains 154 files / 11,576,399 bytes under `/app/`; the independent
fictional writer runs under `/proof/`. Build fixtures live only in
`/tmp/novel-cold-browser-proof`; their HTTP server serves public files and an
unavailable API, with no account client, provider or project data operation.

The first server (PID 1722417, exec 78314) is observed terminal and port 6032
refuses connections before the actual app cold-renders and the fictional writer
cold-reloads. The exact recovered draft is deliberately resumed and extended,
then retained while that server is absent. App legal/age gates are observed
without accepting them or inventing account readiness. The update server tests
waiting while old writing remains intact, normal activation after closing old
tabs, mismatched-file refusal, and preserved local recovery. Ten native storage/
reservation checks pass in a fresh fictional app namespace without large body
downloads or record removal.

Browser evidence is `/tmp/novel-cold-browser-proof.json` and:

- `/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-offline-actual-app-cold.png`
- `/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-offline-cold-writing.png`
- `/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-offline-update-waiting.png`

Verification uses full `vitest run --exclude '.claude/**'`,
`pnpm --config.verify-deps-before-run=false build` and
`pnpm --config.verify-deps-before-run=false typecheck:stories`.
Prepared logs use `/tmp/novel-cold-verified-{web,build,stories}.log`; installed checks
use `/tmp/novel-cold-installed-final-{web,build,stories}.log`. Native artifact and
final source/count evidence is `/tmp/novel-cold-final-verification.json`.
Full frontend verification passes **5,161 tests / one conditional fixture skipped (559 files)**, production build and Storybook typecheck. All 18 changed TypeScript files pass lint against their unchanged baseline. Both
existing staged patches, unrelated frontend/BFF source, API runtime, project
records, media, authored drafts and recovery journals are preserved.

All 136 capabilities remain in scope. Full R13, remaining D2 organization/
context/performance/retention/author/browser/assistive-technology gates and
D3–D6 remain open. No schema, project CRUD, reset, reseed, data cleanup, API restart,
provider operation, deployment or release is part of this checkpoint.

## D2 retained workspace lifecycle evidence — 2026-10-17

Monotonic workspace retention and live device-view archive restrictions are
implemented locally. [ADR 20](20_offline_and_reconciliation.md#d2-retained-workspace-lifecycle--2026-10-17)
and the [roadmap](14_status_and_roadmap.md#d2-retained-workspace-lifecycle--2026-10-17)
record the contract and remaining gates. All 136 capabilities remain in scope;
D2 and D3–D6 remain WIP/planned.

Source: [ordering rule](../../src/shared/workspaceLifecycle.ts),
[native connection/events](../../src/features/novel/persistence/deviceReadDatabase.ts),
[bounded metadata ledger](../../src/features/novel/persistence/deviceWorkspaceStorage.ts),
[confirmed copies](../../src/features/novel/persistence/studioReadStorage.ts),
[live scoped reader](../../src/features/novel/hooks/useDeviceWorkspaceStates.ts),
[checked workspace integration](../../src/app/providers/WorkspaceProvider.tsx),
[device writer](../../src/features/novel/components/NovelDeviceLibrary.tsx),
[saved reviews](../../src/features/novel/components/NovelSavedSceneReview.tsx) and
[controlled native proof](../../src/test/fixtures/novelWorkspaceNativeProof.ts).

The original regression reproduced a late active workspace version 8 replacing
known archive version 9. Real workspace versions now order checked lists and
scene-cache descriptors; equal heads cannot remove an archive. A version-10
restore can unlock versioned device writing. Legacy unversioned archived copies
stay conservative. Independent workspace retention does not rewrite saved
manuscripts, their original scope/source or their usage counter. Existing browser
schema 1 and both stores are preserved without migration or cleanup.

Validation: **5,172 passed / one skipped across 561 frontend files** using the
nine existing retained native wire fixtures. Six focused lifecycle/provider/UI
files additionally passed 42 checks. Production build, Storybook typecheck and
all 19 changed TypeScript files' targeted lint pass with zero lint errors or
warnings. The first sandboxed full command encountered three Git-subprocess
permission errors; the same full suite passed with its required read-only Git
fixture access. The existing bundle-size advisory remains.

Native proof reports **22 checks**, two retained manuscript copies, one earlier
fictional cold-app copy preserved, database version 1, an atomically refused
600-entry oversized batch, zero project writes and zero removed records. It
covers concurrent version ordering, author/API isolation, captured caller scope,
separate byte accounting and preserved corrupt evidence. A separate two-tab
writer exercise proves archive locking, refusal to unlock on the older active
observation, and versioned restore/continued writing with the same retained prose.
See [archived writer](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-device-workspace-archived.png)
and [restored writer](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-device-workspace-restored.png).

Verification/transfer records: `/tmp/novel-lifecycle-browser-proof.json`,
`/tmp/novel-lifecycle-transfer.json`, `/tmp/novel-lifecycle-installation.json`
and `/tmp/novel-lifecycle-final-verification.json`. Commands use
`vitest run --exclude '.claude/**'`,
`pnpm --config.verify-deps-before-run=false build` and
`pnpm --config.verify-deps-before-run=false typecheck:stories` in the prepared
and installed checkout; retained JSON fixtures supply native wire evidence.
No backend, schema, dependency, provider, project CRUD/reset/reseed, file/record
cleanup or API restart belongs to this slice. Records without files remain valid.

This is controlled desktop evidence. Remaining unit/root lifecycle overlays,
organization/context cases, measured long-project behavior, broad retention/
shared-device/logout policy, author/browser/mobile/font/zoom/assistive-technology
acceptance, full R13/D2 and D3–D6 remain open. No complete phase/release is claimed.

## D2 novel and unit device lifecycle evidence — 2026-10-17

Known root/unit lifecycle now updates device writers and saved review restrictions
without replacing their selected prose or original source. [ADR 20](20_offline_and_reconciliation.md#d2-novel-and-unit-device-lifecycle--2026-10-17)
and the [checkpoint](14_status_and_roadmap.md#d2-novel-and-unit-device-lifecycle--2026-10-17)
record the contract and remaining full R13/D2/D3–D6 scope.

Sources: [independent authorities](../../src/features/novel/persistence/novelDeviceLifecycle.ts),
[bounded native store](../../src/features/novel/persistence/deviceNovelStorage.ts),
[checked-source publisher](../../src/features/novel/hooks/useNovelLifecycleRetention.ts),
[owned native reader](../../src/features/novel/hooks/useDeviceNovelState.ts),
[device writer](../../src/features/novel/components/NovelDeviceLibrary.tsx),
[saved review](../../src/features/novel/components/NovelSavedSceneReview.tsx),
[root acknowledgement integration](../../src/app/providers/DataProvider.tsx),
[gallery publication](../../src/features/novel/components/NovelGalleryPage.tsx) and
[native proof](../../src/test/fixtures/novelLifecycleNativeProof.ts).

Two focused pre-fix regressions reproduced a writable device editor after a known
newer novel Trash and an account-entry callback completing after a confirmed erase
arrived during handoff. The fixes retain independent metadata/placement revisions,
keep erasure terminal, checkpoint the last draft before refusing stale handoff and
preserve manual recovery. Checked-source publication validates loaded-data ownership
separately from session readiness. A failed publication remains visible; earlier
batch completion cannot clear a newer failure. Existing native schema 1, manuscript
records/counters and previously stored fictional cold-app copies are preserved.

Thirty real native transaction checks pass, including concurrent root ordering,
independent ancestor metadata/membership, author/API/workspace/novel isolation,
caller capture, record-size refusal, a deliberately seeded fictional reserved
account ceiling, usage consistency, corruption refusal and terminal erasure. The
ceiling fixture is not an OS quota guarantee. A separate two-tab exercise verifies
root Trash and chapter archive/restore with the same open draft, continued writing,
terminal state after stale restore and full reload, deliberate read-only draft
inspection and copyable recovery. [The fictional recovery image](/home/andres/.codex/visualizations/2026/10/16/01a14360-e240-77e0-8c3e-26f0b9c28b07/novel-device-novel-recovery.jpg)
shows the retained writing, manual-recovery explanation and disabled account opening.
These are controlled fictional browser records, not project database operations.

Production build and Storybook typecheck pass. Targeted lint introduces no new
errors/warnings across 18 TypeScript files; the DataProvider's four existing errors
map to unchanged baseline lines. The full frontend suite uses nine retained native
JSON wire fixtures, with one existing conditional test skipped. The exact final
counts/logs, source hashes and transfer/preservation status are recorded in
`/tmp/novel-unit-lifecycle-final-verification.json`,
`/tmp/novel-unit-lifecycle-transfer.json` and
`/tmp/novel-unit-lifecycle-installation.json`. One full attempt hit an unchanged
legal-provider probe timing assertion; its isolated file and the device writer
passed together. Retain the final full-suite outcome rather than treating the
isolated pass as a complete-checkout result.

No backend/schema/dependency change, model/provider call, project CRUD/reset/reseed,
file/record cleanup, API restart or Git index operation belongs to this slice.
Records without files remain valid. Unobserved remote changes still require a
checked account read; broader retention/shared-device/logout, long-project and
complete author/browser/mobile/font/zoom/assistive-technology acceptance, remaining
D2 cases and all D3–D6 remain open. All 136 capabilities remain in scope.


## D3 saved-source context preparation evidence — 2026-10-17

The [delivery checkpoint](14_status_and_roadmap.md#d3-saved-source-context-preparation--2026-10-17) and [ADR 21](21_assistant_context_boundary.md) cover the source contract/drawer. Full D3 conversations/profiles/proposals/application and all remaining D2/D4–D6 gates remain open.

Prepared source checks:

- Full frontend: `vitest run --exclude '.claude/**'` with the nine earlier retained native wire fixtures: **5,208 passed / 567 files, one conditional skip**. The additional real assistant-packet guard then passed with the context/hook/drawer scope: **17 tests / 3 files**. Final installed runs supersede these counts when recorded below.
- Backend: selected `tests/{services,models,routes}/test_story*.py` plus `tests/test_startup.py` and `tests/test_schema_bootstrap.py`: **977 passed / 54 files**. The focused context/index/anchor command passed **80** overlapping checks. The first route run exposed the synchronous test-auth override stall; only that owned test process was stopped, and the fixture now uses the existing async override pattern. The API was left running during those tests.
- Production `pnpm --config.verify-deps-before-run=false build` and `typecheck:stories` passed. Seventeen changed TypeScript files have no new lint errors/warnings; **41 existing `src/infrastructure/api/index.ts` errors** map to unchanged baseline lines. No unrelated lint rewrite was made.
- `scripts/smoke_novel_assistant_context.py` passed in new retained **`magic_worlds_novel_assistant_test_7753402f7364`**: ten actual HTTP/MySQL packets, bounded scene hydration with whole-manuscript reads forbidden, lexical relevance before proximity, all five scopes, exact second repeated-passage selection, future-source policy, differing scoped pins, stale/foreign/wrong-workspace/budget failures and archived-workspace read-only packets. All **112 synthetic tables** retained identical fingerprints during read preparation. The initial helper-argument failure left **`magic_worlds_novel_assistant_test_f5051fd3b5a9`** retained; neither database was reset or cleaned up. Actual packet JSON is retained privately at `/tmp/novel-assistant-context-persistence.json`; frontend guards verify its messages, hashes, counters and source heads.
- Native Brave inspection exercised the controlled Storybook drawer with real Python-compiled fictional packets: explicit prepare, exact source/pin/conflict/exclusion display, stale state after changing the reading boundary, explicit later-scene inclusion under author analysis, retained unsent question on close/reopen and focus return. Screenshot `novel-assistant-saved-sources.jpg` is retained in this task's visualization directory. No account/browser/model-quality or mobile/assistive-technology acceptance is inferred.
- Read-only project/API preflight: schema **`2026_10_novel_erase`, 112 tables**, `/health` `ok`, no active model/operation/voice/image/theme-song/TTS work. Code-only installation needs no schema change, seed, reset, model call or project test CRUD. Private source backups and per-file/staged hashes protect current unrelated work. The full source/context feature and API installation are verified independently from phase/release completion.

Relevant frontend evidence: [runtime wire guard](../../src/infrastructure/api/storyAssistantContextContract.ts), [wire tests](../../src/infrastructure/api/storyAssistantContext.test.ts), [scope hook tests](../../src/features/novel/hooks/useAssistantContextSource.test.tsx), [drawer tests](../../src/features/novel/components/NovelAssistantContextDrawer.test.tsx), [Studio integration](../../src/features/novel/components/NovelStudio.test.tsx) and [controlled stories](../../src/features/novel/components/NovelAssistantContextDrawer.stories.tsx). The new source compiler prepares future turns; existing inline execution remains separate until the required D3 unification is implemented. No phase or release is complete.


**Installed verification:** the installed complete frontend suite passed **5,210 tests / 567 files, one skip**, using ten retained native wire fixtures. The installed backend novel/startup/isolation suite passed **980 tests / 55 files**. Installed production build and Storybook typecheck passed. The owned API was gracefully restarted after a fresh read-only no-active-work check; **PID 1850548** is healthy and serves the strict source-preparation endpoint. Unauthenticated preparation returns 401. Exact schema verification still reports `2026_10_novel_erase`; all **112 project table fingerprints** match the pre-install snapshot. No schema/seed/reset, project test CRUD or record/file/media cleanup occurred. Existing staged patches and **3,376 unrelated source files** remain byte-identical. All 136 capabilities remain in scope.

The installed production offline manifest verifies **154 public assets / 11,672,754 bytes**, with no integrity errors and the unchanged worker runtime from the earlier real cold-app proof. That comparison preserves the existing offline contract; it is not a new whole-product offline/author acceptance claim. The temporary Storybook process/tab were stopped after controlled inspection. Private manifests, source backups, test logs, runtime checks and the final verification summary use the `/tmp/novel-assistant-context-` prefix.
