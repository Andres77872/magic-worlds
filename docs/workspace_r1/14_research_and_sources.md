# Research, source map, and verification limits

> **Scope / status (reviewed 2026-10-14):** R1 design/coverage contract and dated implementation evidence. Source is implemented; default product UI rollout remains **WIP**, locally opted in. [02](02_current_status_and_findings.md) owns current status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining gaps/TBD. Historical test totals, branch state and migration notes below apply to their stated dates, not deployment availability.

**Status:** Source/research record supporting the selected implementation specification.\
**Original primary-source access:** 2026-10-11. **Local-source refresh:** 2026-10-12, America/Mexico_City.

## Evidence labels

- **Observed:** Supported by current local source.
- **Inference:** A consequence of that source under the proposed workspace model.
- **Selected:** Required R1 behavior fixed by the specification; current implementation and availability require separate evidence in 02.
- **Deferred:** Outside R1.
- **Unverified:** Requires live data, runtime testing, or a product decision.

Local links use absolute checkout paths for this desktop workspace. The source files are authoritative; commit IDs do not include unrelated working-tree changes.

## Local source map

| Evidence | Source |
|---|---|
| Current provider composition | [AppProvider](/home/andres/WebstormProjects/magic-worlds/src/app/providers/AppProvider.tsx) |
| Account-scoped library and stale-account guards | [DataProvider](/home/andres/WebstormProjects/magic-worlds/src/app/providers/DataProvider.tsx) |
| Navigation guards and browser hash handling | [NavigationProvider](/home/andres/WebstormProjects/magic-worlds/src/app/providers/NavigationProvider.tsx) |
| Feature/resource hashes | [galleryLinks](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/galleryLinks.ts) |
| Shared API client | [apiService](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/index.ts) |
| Strict generated-card verifier and field transforms | [cardContract](/home/andres/WebstormProjects/magic-worlds/src/infrastructure/api/cardContract.ts); [cardTransforms](/home/andres/WebstormProjects/magic-worlds/src/utils/cardTransforms.ts) |
| Duplicate/export/import and group-chat selection | [GalleryPage](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/components/GalleryPage.tsx); [import hook](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/hooks/useCardImport.ts) |
| Picker page limits and explicit Codex selection | [picker options](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/media/hooks/useCardPickerOptions.ts); [Codex picker](/home/andres/WebstormProjects/magic-worlds/src/features/codex/components/CodexCardPickerDrawer.tsx); [useCodex](/home/andres/WebstormProjects/magic-worlds/src/features/novel/hooks/useCodex.ts) |
| Draft and studio navigation behavior | [chapter draft](/home/andres/WebstormProjects/magic-worlds/src/features/novel/hooks/useChapterDraft.ts); [studio guards](/home/andres/WebstormProjects/magic-worlds/src/features/novel/hooks/useStudioGuards.ts) |
| Current unified assistant client | [useAssistant](/home/andres/WebstormProjects/magic-worlds/src/features/creation/common/components/assistant/useAssistant.ts); [assistant types](/home/andres/WebstormProjects/magic-worlds/src/shared/types/assistant.types.ts) |
| App assistant knowledge/focus | [knowledge hook](/home/andres/WebstormProjects/magic-worlds/src/features/appAssistant/hooks/useAssistantKnowledge.ts); [assistant documentation](/home/andres/WebstormProjects/magic-worlds/docs/app_assistant/README.md) |
| Current content tables and relationships | [canonical schema](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/db.sql) |
| Scope, repositories, defaults, cleanup, media references | [AppScope](/home/andres/PycharmProjects/magic-worlds-api/src/services/scope.py); [models](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/models.py) |
| Generation persistence and request fingerprint | [generation store](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/card_generation_store.py); [card execution](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_execution.py); [admission](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/llm_execution_admission.py) |
| Copying resources/dependencies | [resource clone](/home/andres/PycharmProjects/magic-worlds-api/src/services/card_resource_clone.py) |
| Stories and roleplay snapshot entry points | [stories](/home/andres/PycharmProjects/magic-worlds-api/src/routes/stories.py); [adventure sessions](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_adventure_session.py) |
| Unified assistant server | [assistant routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/assistant.py); [assistant core](/home/andres/PycharmProjects/magic-worlds-api/src/services/assistants/core.py) |
| Image profiles and current schema | [image-profile routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/image_profiles.py); [image-profile cutover](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/image_profile_cutover.py); [database guide](/home/andres/PycharmProjects/magic-worlds-api/docs/database.md) |
| Voice lifecycle and call ownership | [voice routes](/home/andres/PycharmProjects/magic-worlds-api/src/routes/user/route_voice_call.py); [callbot](/home/andres/PycharmProjects/magic-worlds-api/src/services/voice_orchestration/callbot_execution.py); [client call launch](/home/andres/WebstormProjects/magic-worlds/src/features/call/useStartCall.ts) |
| Durable notices and content actions | [notice service](/home/andres/PycharmProjects/magic-worlds-api/src/services/notifications.py); [notice UI](/home/andres/WebstormProjects/magic-worlds/src/features/notifications/components/NotificationsPage.tsx) |
| Resource representations and extraction | [resource validation](/home/andres/PycharmProjects/magic-worlds-api/src/services/lorebook_resources.py); [extraction service](/home/andres/PycharmProjects/magic-worlds-api/src/services/lorebook_extraction_execution.py) |
| Current read-only floating previews | [descriptors](/home/andres/WebstormProjects/magic-worlds/src/features/floatingWindows/floatingWindow.types.ts); [layer](/home/andres/WebstormProjects/magic-worlds/src/features/floatingWindows/components/FloatingWindowsLayer.tsx) |
| Job origin and startup reconstruction | [tasks](/home/andres/PycharmProjects/magic-worlds-api/src/routes/tasks.py); [theme-song engine](/home/andres/PycharmProjects/magic-worlds-api/src/services/theme_song_generation/engine.py) |
| Exact schema verification and current cutover | [bootstrap](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py); [assistant cutover](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/assistant_cutover.py) |
| BFF/upstream transport boundary | [LLM transport](/home/andres/PycharmProjects/magic-worlds-api/src/services/llm_execution_transport.py); [completion models](/home/andres/PycharmProjects/api.magic_llm/src/models/completion.py) |
| Authentication ownership | [auth routes](/home/andres/PycharmProjects/api.auth/src/routes/auth.py) |
| Runtime/provider boundaries | [run_agent](/home/andres/PycharmProjects/magic-agents/magic_agents/agt_flow.py); [provider facade](/home/andres/PycharmProjects/magic-llm/magic_llm/base.py) |

The word workspace sometimes describes feature areas or agent drafts in existing material. This proposal uses personal content workspace as a separate domain concept.

## Primary product research

| Source | Verified pattern | Application to this proposal |
|---|---|---|
| [Novelcrafter Codex categories](https://www.novelcrafter.com/help/docs/codex/codex-categories) | Related mixed entries can appear in several categories; deleting a category retains entries | Supports lightweight grouping; adopt explicit memberships rather than overloading this app's card attributes/triggers |
| [Novelcrafter Series Codex](https://www.novelcrafter.com/help/docs/codex/series-codex) | Codex entries can be shared across books, with book/series/all views | Shows a reuse alternative; independent copies better fit the user's sandbox requirement |

These sources are design references, not a recommendation to make novels the only container or to reproduce another product's schema. Product comparison was limited to published documentation; no live account UX was tested.

## Library organization and creation UX research (2026-10-12)

The user explicitly selected a single library entry, collection folders and cards together, preserved search/card design, and compatibility with existing creators and the card assistant. These primary references informed the interaction details; they do not dictate Reverie styling or prove that a design has passed usability testing.

| Source | Observed guidance/pattern | Selected application |
|---|---|---|
| [Google Drive: organize files](https://support.google.com/drive/answer/2375091?hl=en) | Meaningful folder names and explicit creation/organization actions make related content discoverable | Collection folder entries and a clear New menu; retain this project's many-to-many membership semantics rather than import Drive's move/ownership rules |
| [NN/g: breadcrumb guidelines](https://www.nngroup.com/articles/breadcrumbs/) | Show location, distinguish current location from ancestors, and keep mobile navigation compact; flat structures often need only simple location cues | Library/collection location plus parent action, not a deep fictional folder tree or a replacement global menu |
| [Carbon: search](https://www.carbondesignsystem.com/building-blocks/core/components/search/guidelines) | Search can operate at page/component scope and complements discovery | Keep the existing visible search; name its collection scope and require explicit widening |
| [Carbon: filtering](https://preview.carbondesignsystem.com/building-blocks/core/patterns/filtering) | Applied filters need visible feedback | Local type/persona and uncollected filters; recoverable no-match states |
| [Carbon: empty states](https://www.carbondesignsystem.com/building-blocks/core/patterns/empty-states) | Distinguish absent data from no results caused by user input and provide the relevant recovery action | Empty collection offers creation/organization; no matches offers clearing/changing search/filters |

Additional local source inspection confirmed GalleryPage's masthead search, GalleryViewToggle's large/compact/list options, GalleryCard's portrait and row rendering, CreatorIntro/TemplateGallery, SavedCardGenerator, stable creator-side AssistantChatbot, and assistant-history handoff. Document 08 is the selected UX specification. A separate local prototype can reuse these components without modifying application source; its fixture persistence and abbreviated manual-editor walkthrough are not production behavior.

The user approved the revised [local library prototype](/home/andres/.codex/visualizations/2026/10/12/01a12edd-8ae3-7fb1-be3a-d0c89aefbe9e/library-r1.html) and requested the Markdown update on 2026-10-12. This is an approved visual/interaction reference for the unified library, folders, search and creation entry. It is not a usability-study result, application implementation, live provider test, or instruction to copy the abbreviated manual editor into the app. The old sidebar screenshot and first explanatory prototype are superseded as proposed UI; they remain historical context only.

## Primary engineering research

| Source | Verified guidance | Application |
|---|---|---|
| [OWASP authorization cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Validate authorization on every request | Server-side workspace ownership across direct reads, writes, and operations |
| [MySQL foreign-key constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html) | Compatible columns/collations and indexed keys are required | Composite same-owner/workspace membership relationships |
| [MySQL implicit commits](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html) | DDL can commit implicitly | Resumable migration with tested recovery rather than an assumed all-DDL rollback |

The MySQL sources describe 8.4. Verify deployed server version and ALTER behavior before final migration DDL or performance claims.

## Project-specific UI references

Use [UI components](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-components/SKILL.md), [Reverie tokens and semantics](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-design-system/SKILL.md), and [Storybook conventions](/home/andres/WebstormProjects/magic-worlds/.agents/skills/ui-storybook/SKILL.md) when implementing the proposed UX.

Research supports the domain pattern. The component reuse and interaction details are project-specific recommendations.

## What remains unverified

No live database schema/data, production revision, row counts, query plans, infrastructure topology, runtime workspace screens, provider calls, usability tests, or measured automated-test coverage were inspected.

No timing estimate, storage-savings claim, or deployment-completion claim is supported by this review. Existing test locations were inspected as extension points; suites were not run.

The refresh accounts for the current image-profile schema, unified assistants, call lifecycle, resource representations, account ownership coordinator, read-only floating windows, and notification actions. Selected specification decisions live in document 15; the complete integration inventory lives in document 16. Future source changes update document 02 and the affected inventory/contracts before implementing that path.

The initial R1 batch bounds are explicit conservative design limits, not measurements or external-source requirements. Workspace-specific headers/metadata, companion context, protected default, and copy records are new planned contracts; they are not observed existing behavior. Domain decisions are resolved, while deployed data/versions, performance, backups, and runtime implementation remain unverified.
