# Current state and evidence

**Source/lifecycle reconciliation, 2026-10-15:** the implemented chapter-based boundary and open save/acceptance/search mechanisms were rechecked. Test counts, prior reproductions and prototype measurements below are dated records. This cleanup did not rerun those checks, modify the HTML demo, call a provider or establish a deployed state. [14](14_status_and_roadmap.md) owns current delivery status.

**Documentation review:** 2026-10-14. **Status:** WIP — implemented, feature-gated baseline; current source audit and focused test evidence. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

Reviewed on 2026-10-14. Frontend root: `/home/andres/WebstormProjects/magic-worlds`. Backend root: `/home/andres/PycharmProjects/magic-worlds-api`.

## Availability and WIP status

The novel feature is **WIP with an implemented foundation**. The checked-in [`.env.example`](../../.env.example) sets `VITE_FEATURE_NOVELS_ENABLED=false`; this checkout's local `.env` sets it to `true`. Only exact `true` enables it. [featureFlags](../../src/shared/featureFlags.ts) gates both `gallery-stories` and `story`; [Sidebar](../../src/ui/components/Sidebar.tsx) filters their navigation entries; [AppRouter](../../src/app/router/AppRouter.tsx) renders `NotFoundPage` when disabled; the [API client](../../src/infrastructure/api/index.ts) calls `assertNovelsEnabled()` before story operations. There is no WIP route placeholder today. This frontend gate does not disable BFF `/stories` routes for other clients. Production availability and live BFF readiness are unverified.

All coverage below describes source present when the feature is enabled, rather than a shipped product or proof that every path works in production. The [status and roadmap](14_status_and_roadmap.md) records missing contracts and release gates.

## Current system

The app is a React 19 SPA with React contexts, a hand-rolled router, the Reverie design system, and TipTap 3.26.x. The frontend calls the `apiService`/workspace-scoped API clients. The FastAPI BFF owns story storage and server-owned graphs, and calls `api.magic_llm` over HTTP. The novel editor must not bypass this boundary to call a model vendor directly.

The current hierarchy is Story → StoryChapter. Chapter bodies are Markdown strings. Chapters include order, status, a word goal, POV/location IDs, active card references, and generation history. The type does not contain a distinct Scene or Part entity. Existing card snapshots can pin source versions; that does not give chapter bodies a revision history.

| Capability | Current coverage | Primary local evidence |
|---|---|---|
| Novel library | Search, pagination, grid/list presentation, create/open/delete | [NovelGalleryPage](../../src/features/novel/components/NovelGalleryPage.tsx), [gallery config](../../src/features/novel/novelGalleryConfig.tsx) |
| Create novel | Blank or card-based creation; first chapter initialized | [NovelCreateModal](../../src/features/novel/components/NovelCreateModal.tsx) |
| Manuscript editing | TipTap, basic marks, headings, lists, quotes, scene break, Markdown I/O | [NovelEditor](../../src/features/novel/editor/NovelEditor.tsx) |
| Chapter navigation | Select, add and confirmed delete in the chapter rail; renaming through the chapter title field in the studio; no distinct scene hierarchy | [useNovelStudio](../../src/features/novel/hooks/useNovelStudio.ts), [NovelChapterRail](../../src/features/novel/components/NovelChapterRail.tsx), [NovelStudio](../../src/features/novel/components/NovelStudio.tsx) chapter title field |
| Persistence | 1.2-second debounce, manual save, retries, flush, conditional unload warning | [useChapterDraft](../../src/features/novel/hooks/useChapterDraft.ts) |
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

Observed result: **27 test files passed; 211 tests passed; 6.52 seconds**. This is focused frontend evidence for the reviewed checkout. It does not prove backend transactions, live provider behavior, the proposed refactor, or production readiness. The earlier dossier also reported the same 211 tests in 6.63 seconds; that earlier result is superseded by this rerun. This sub-review did not run a full application build or backend suite.

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
- Backend code was inspected; full backend tests, database constraints, deployed configuration, and backup restoration were not exercised.
- External comparisons use official product documentation and primary research. A described feature does not establish quality, availability in every plan, or suitability for this product.
- Source line numbers can move as other work proceeds. Function names and paths are the durable evidence anchors; refresh them before implementation.
