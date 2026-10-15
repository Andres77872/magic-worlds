# Authoring UI audit — 2026-09-19

**Status reconciliation — 2026-10-14: historical review.** This document retains its dated source/fixture findings and recorded fixes. It does not prove current live behavior, enabled rollout, or comprehensive accessibility. Disabled features are WIP in the [status register](FEATURE_STATUS.md); current release work and unrevalidated UX recommendations belong in the [roadmap](ROADMAP.md).

## Scope and evidence

This audit covers the creation, lorebook/resources, and novel routes and their important dialogs, drawers, inline menus, previews, and failure states. The original 95-component inventory is preserved below, but coverage is recorded by the user-facing view in which each component actually appears. A route screenshot does not prove every possible state of every child component.

Browser evidence used Brave tab 1052705913. Initial route inspection used 1440 × 1000 and 390 × 844. The stable final pass used actual 1280 × 1150 and 390 × 844 iframes in the responsive comparison wrapper. For any story ID below, the reproducible paired URL is:

`http://localhost:6007/iframe.html?id=audit-responsive-comparison--compare&viewMode=story&subject=STORY_ID`

The corresponding direct story is `http://localhost:6007/iframe.html?id=STORY_ID&viewMode=story`. Latest fixes not yet included in the static build are inspected on port 6006, as called out below. Screenshots were visually reviewed through the browser tool; they are conversation evidence, not checked-in snapshot files. Blank captures, interrupted captures, and drawer animation frames were not counted.

All new authoring fixtures use in-memory data and stub API methods. Unconfigured API calls reject locally. No paid generation was requested and no real user data was changed. The NovelEditor live-preview and AiGeneratePanel fixtures use local delayed streams, which were exercised safely.

## Rendered view ledger

### Card creators

- **Character / persona edit** — `authoring-routes--character-edit`, `--persona-edit`: desktop and mobile inspected. Identity, media inputs, guided sections, eight-section persona navigation, live preview, and field hierarchy checked. Removed layered section cards; retained form controls and media cards. Explicit textarea rows now stay compact. Persona default switch uses a plain row.
- **Navigation in the actual mobile shell** — root-owned `authoring-routes--persona-in-app-shell`: root verified desktop navigation top 16 / bottom 116, target heading 157.94; mobile navigation top 56 / bottom 108 below MobileTopBar, target heading 149.77. All eight desktop section labels remain visible. Background appears only when pinned. This complements this agent's earlier section-anchor and active-state verification.
- **World / item edit** — `authoring-routes--world-edit`, `--item-edit`: desktop and mobile form/preview layouts inspected; responsive controls fit without horizontal document overflow.
- **Adventure edit** — `authoring-routes--adventure-edit`: desktop and mobile inspected, including cast/persona selection and world selection structure. Selection cards remain distinct interactive objects.
- **New creator template galleries** — `authoring-routes--character-new`, `--world-new`, `--item-new`, `--adventure-new`: all four template galleries inspected at desktop and mobile. Character Loyal Companion template and Empty card transitions also inspected. The actual intro, template cards, AI starter, and resulting form reuse are covered here.
- **Private draft and historical state** — `authoring-routes--character-draft`, `--character-historical`: desktop/mobile headers and fields inspected. Draft Publish dialog inspected on mobile without publishing. Historical banner, restore entry point, and readonly fields checked. Publish label now has an accessible name.
- **Attribute editing** — `creation-attributemanager--default` on 6006: desktop/mobile populated list and mobile Add Category form inspected. SectionHeader/AttributeManager column interaction no longer creates a 160px title gap. Category inputs, cancel/create actions, and row removal control remain visible.
- **AI starter/live field preview** — `creation-aigeneratepanel--live-field-preview`: default desktop/mobile composition inspected by DOM; local generation exercised on mobile and saving/live Name + Description preview visually captured. Description remains readable, Cancel and disabled Generating actions fit. Desktop streaming capture was not completed.

### History, media, and assistants

- **Card history** — `authoring-panels--card-history`, `--card-history-error`: initial populated desktop/mobile history and final error state inspected; no false “no versions” message appears after failure. Version labels/actions now wrap within divided rows. Final settled populated drawer also reverified at 1280/390: complete labels and View/Restore actions fit; mobile actions wrap below each version label.
- **Readonly version history** — `authoring-panels--version-history`: desktop/mobile inspected, including `--version-history-unsaved`. Draft banner, latest version accent, three divided version rows, usage summary, Done and Edit actions fit; unsaved guidance stays open and readable.
- **Media history** — `authoring-panels--media-populated`, `--media-empty`, `--media-error`, `--media-loading`: desktop/mobile image, empty, loading and failure layouts inspected. Mobile image lightbox and populated theme/audio row inspected. Final local empty-state decorative border removal is a minor follow-up on 6006. Desktop theme-tab activation was not captured reliably; mobile theme layout is verified. Coarse-pointer behavior was source-reviewed, not tested on physical touch hardware.
- **Assistant full/error/streaming** — `creation-assistant-panel--full-panel`, `--with-error-banner`, `--streaming-reply` on 6006: desktop/mobile inspected using the actual AssistantShell. Replaced the story's fixed 420px wrapper, which previously produced false mobile clipping. Header, scrollable conversation, Markdown, applied-field badges, composer, Stop control and retry banner fit. Mobile Conversations menu inspected and stays within viewport.
- **Assistant route integration** — launcher and closed assistant states observed in creator and lorebook routes. Shared shell and presentational states covered above. Actual assistant server conversations, reload recovery, and paid generation remain intentionally unexecuted.

### Lorebook workbench and resources

- **Lorebook edit** — `authoring-routes--lorebook-edit`: desktop/mobile profile/defaults, resources, entries, selected entry editor, secret entry variant, attachments and activation test inspected. Resource/entry section wrappers are open and divided; list height no longer reserves a large empty rectangle. At 1280px the editor follows the central column; selecting an entry scrolls to it. At 390px all fields remain usable in one column.
- **Embedded resource editing** — same edit route, New Markdown: desktop/mobile resource title, triggers, description and content editor inspected. Pending extraction metrics and warning are visible without enclosing the entire resources section in a card.
- **Activation feedback** — same edit route with “I meet the keeper at the moonwell in Silverwood.”: desktop/mobile activated/skipped/token metrics, trace and generated prompt preview inspected. Local preview responds with one activated entry; no API generation is needed.
- **New lorebook/validation** — `authoring-routes--lorebook-new`: desktop/mobile blank form, empty entries and validation summary inspected. Mobile Save with missing name shows validation failure. Follow-up adds the translated error directly to Name and marks its Input required, avoiding dependence on a distant summary.
- **Resources read/edit/create** — `authoring-panels--resource-detail`, `--resource-create`: desktop/mobile inspected. Completed extraction metadata is an open section. Edit opens Markdown directly in Write mode; title/file/trigger/description/import/content controls fit. Mobile lower content editor, mode switch and metadata toggle were separately scrolled into view. New resource uses the same writing-first layout.
- **Shared resource picker** — `authoring-panels--resource-picker`, `--resource-picker-error`: desktop/mobile populated and failure views inspected. Found the failure also claimed “No shared resources yet”; fixed by suppressing the empty message on fetch failure. Selection rows and footer fit. Empty picker mobile was also visually captured; its explanatory text now uses the readable muted token.
- **Lore in play** — `authoring-embedded--session-lore`: desktop/mobile linked lorebook row, highlighted composer and underlined prose trigger inspected. Ctrl-click moonwell opens a desktop entry floating preview. Mobile lorebook preview opens a full-width floating window showing two readable entries. This covers LoreTriggerMark, HighlightedTextarea, SessionLorebookPanel, LoreEntryPreviewBody and LorebookPreviewBody as actual compositions.

### Libraries

- **Lorebooks library** — `authoring-routes--lorebook-gallery`: desktop/mobile grid and list, action menu inspected. Final mobile row title now shows a useful prefix instead of only “Th”; desktop-only badges no longer consume mobile title width.
- **Resources library** — `authoring-routes--resource-gallery`: desktop/mobile populated resource card inspected. Metrics use text rather than four miniature boxes. New text/Markdown/URL/upload actions wrap visibly on mobile.
- **Novels library** — `authoring-routes--novel-gallery`: desktop/mobile populated list inspected. Mobile action menu and Delete confirmation inspected without deleting. Title, chapter/word counts, and destructive action hierarchy are clear.
- **All three library empty/loading/failure states** — `authoring-routes--lorebook-gallery-empty|loading|error`, `--resource-gallery-empty|loading|error`, `--novel-gallery-empty|loading|error`: all nine paired desktop/mobile states visually inspected. Failed loading no longer simultaneously claims the library is empty. Retry remains visible. Resources empty state is open rather than another card.

### Novel authoring

- **New novel** — `authoring-panels--new-novel`: desktop/mobile blank form inspected; mobile A card mode and source picker inspected. CardPicker body-portal fix (gallery agent) verified on 6007: all options/search stay inside 390px viewport and open above the trigger without footer clipping.
- **Populated studio** — `authoring-routes--novel-studio-populated`: desktop three-column and mobile stacked layout inspected. Chapter rail, title/header, manuscript, status strip, codex meter and reference rows covered. More menu and mobile Find/Replace inspected. Mobile chapter rail remains bounded.
- **Empty studio / focus mode** — `authoring-routes--novel-studio-empty`: desktop/mobile empty manuscript and codex inspected. Mobile word-goal popover and focus mode inspected; popover fits and focused manuscript releases space used by chapter/codex navigation.
- **Codex edit and import** — `authoring-panels--codex-entry`, `--codex-lorebooks`, `--codex-lorebooks-error`: desktop/mobile edit drawer, lorebook search/list, second-step entry selection, empty search and failed loading inspected. Empty messages now use the readable muted token. Search has a name; clone actions wrap; errors are preserved visibly. Save/clone error recovery is additionally covered by tests.
- **Generation history** — `authoring-panels--generation-history`: desktop/mobile accepted generation record, prompt, output and copy control inspected; `--generation-history-empty` inspected at both widths.
- **Editor slash/beat/candidate** — `novel-noveleditor--live-preview`: mobile slash menu, beat composer, length options, safe local generation and Accept/Regenerate/Decline candidate row inspected. Desktop selection formatting toolbar inspected. Mobile beat length hint was clipped to a few letters; changed to wrap onto its own line.
- **Editor mention/selection AI menu** — `authoring-routes--novel-studio-populated`: mobile codex mention suggestion and selection toolbar inspected. Found the AI dropdown clipped by the manuscript scroll container, hiding Condense/Describe. Replaced its absolute descendant placement with the existing anchored-popup body portal, retaining selection and outside-click behavior. Final 6006 mobile check confirmed all five actions visible in a body portal, top 443 / bottom 622 inside the 844px viewport. Independent review then caught lifecycle/reposition edge cases: the submenu now closes when TipTap hides its toolbar and when scroll/resize changes geometry. Browser select → AI → ArrowRight left zero menus; reopen → native scroll also left zero menus and aria-expanded=false while preserving the text selection. Resize closure is test-verified without changing the shared browser viewport.

## Fixes and verification

The principal visual rule is spacing and headings for composition; boxes remain for actual controls, interactive choices, dialog boundaries, and selected/generated content. Changes reuse theme tokens and existing primitives.

Focused checks completed during this audit: initial creator/history/route tests; three gallery test files (13 tests); BeatComposer/media/Codex focused run (3 files, 20 tests). Resource writing mode and Codex error recovery tests cover behavior that the visual fixes changed. The AI menu tests now assert body portal placement and retain inside/outside-click and selection-preservation coverage. Final story typecheck passed after the menu portal change. BubbleAiMenu/EditorBubbleMenu focused tests passed (2 files, 13 tests), including portal containment, inside/outside dismissal, TipTap onHide lifecycle, resize, and non-bubbling descendant scroll. Parent owns final full production build and suite results.

All production edits are frozen after the final lifecycle/scroll checks. Parent owns the final whole-repository build and test run.

## Explicit remaining limits

- No live API write, publish, restore, delete, upload, URL import, paid generation, or playback was executed. Those server-dependent completion states are not browser-verified by this visual audit.
- No physical touch keyboard, screen reader session, 320px pass, or all-language copy expansion was performed. The checked narrow viewport is 390px.
- Rare variants not independently rendered: assistant pending-snapshot/empty/error-per-turn variants, media unsaved target, resource loading/save error, creator save error/dirty-leave/discard confirmations. Empty resource picker was captured at mobile only; the other listed empty variants were verified at both widths. Their shared layouts are covered where stated, but these variants are not claimed as individually verified.
- CreatorLayout is superseded by CreatorStudio and has no production route callsite; it is retained in the source inventory but is not an additional current screen.
- Some deeper optional guided field combinations, long resource collections, library pagination, and 1536px three-column lorebook breakpoint remain source-reviewed only. Existing route captures cover the common guided fields and narrow/1280/1440 layouts.

## Source composition inventory

The following 95 files formed the initial inventory. View-level coverage above is authoritative. These are implementation children, not 95 separate screenshots. Creation previews/fields/template/engine children map to the four creator routes; assistant children map to the actual-shell composition; lorebook resource/entry/preview children map to the workbench and lore-in-play fixtures; novel rail/codex/editor children map to the studio and focused menus.

- `src/features/creation/adventure/components/AdventureCreator.tsx` — AdventureCreator
- `src/features/creation/adventure/components/preview/AdventurePreviewCard.tsx` — AdventurePreviewCard
- `src/features/creation/adventure/components/scene/CastMemberCard.tsx` — CastMemberCard
- `src/features/creation/adventure/components/scene/CastSelector.tsx` — CastSelector
- `src/features/creation/adventure/components/scene/PersonaSelector.tsx` — PersonaSelector
- `src/features/creation/adventure/components/scene/WorldSelector.tsx` — WorldSelector
- `src/features/creation/character/components/CharacterCreator.tsx` — CharacterCreator
- `src/features/creation/character/components/CharacterPreviewCard.tsx` — CharacterPreviewCard
- `src/features/creation/common/components/AiGeneratePanel.tsx` — AiGeneratePanel
- `src/features/creation/common/components/AttributeManager.tsx` — AttributeManager
- `src/features/creation/common/components/CardDraftControls.tsx` — CardDraftControls
- `src/features/creation/common/components/CardHistoryDrawer.tsx` — CardHistoryDrawer
- `src/features/creation/common/components/CategoryForm.tsx` — CategoryForm
- `src/features/creation/common/components/CreatorField.tsx` — CreatorField
- `src/features/creation/common/components/CreatorLayout.tsx` — CreatorLayout
- `src/features/creation/common/components/CreatorStudio.tsx` — CreatorStudio
- `src/features/creation/common/components/EntityPreviewCard.tsx` — EntityPreviewCard
- `src/features/creation/common/components/FormActions.tsx` — FormActions
- `src/features/creation/common/components/GeneratedDraftNotice.tsx` — GeneratedDraftNotice
- `src/features/creation/common/components/HistoricalVersionBanner.tsx` — HistoricalVersionBanner
- `src/features/creation/common/components/MediaHistoryDrawer.tsx` — MediaHistoryDrawer
- `src/features/creation/common/components/MediaStudioSection.tsx` — MediaStudioSection
- `src/features/creation/common/components/QualityHint.tsx` — QualityHint
- `src/features/creation/common/components/SavedCardGenerator.tsx` — SavedCardGenerator
- `src/features/creation/common/components/StringListField.tsx` — StringListField
- `src/features/creation/common/components/StudioPreviewDock.tsx` — StudioPreviewDock
- `src/features/creation/common/components/StudioSection.tsx` — StudioSection
- `src/features/creation/common/components/StudioSectionNav.tsx` — StudioSectionNav
- `src/features/creation/common/components/SuggestedAttributes.tsx` — SuggestedAttributes
- `src/features/creation/common/components/TriggersField.tsx` — TriggersField
- `src/features/creation/common/components/VersionHistoryDrawer.tsx` — VersionHistoryDrawer
- `src/features/creation/common/components/assistant/AssistantBanner.tsx` — AssistantBanner
- `src/features/creation/common/components/assistant/AssistantComposer.tsx` — AssistantComposer
- `src/features/creation/common/components/assistant/AssistantHeader.tsx` — AssistantHeader
- `src/features/creation/common/components/assistant/AssistantMarkdown.tsx` — AssistantMarkdown
- `src/features/creation/common/components/assistant/AssistantMessage.tsx` — AssistantMessage
- `src/features/creation/common/components/assistant/AssistantMessageList.tsx` — AssistantMessageList
- `src/features/creation/common/components/assistant/AssistantShell.tsx` — AssistantShell
- `src/features/creation/common/components/assistant/CardAssistantChatbot.tsx` — CardAssistantChatbot
- `src/features/creation/common/components/assistant/ConversationMenu.tsx` — ConversationMenu
- `src/features/creation/common/engine/FieldPalette.tsx` — FieldPalette
- `src/features/creation/common/engine/GuidedFieldRow.tsx` — GuidedFieldRow
- `src/features/creation/common/engine/GuidedSection.tsx` — GuidedSection
- `src/features/creation/common/engine/UseExampleLink.tsx` — UseExampleLink
- `src/features/creation/common/templates/CreatorIntro.tsx` — CreatorIntro
- `src/features/creation/common/templates/TemplateCard.tsx` — TemplateCard
- `src/features/creation/common/templates/TemplateGallery.tsx` — TemplateGallery
- `src/features/creation/item/components/ItemCreator.tsx` — ItemCreator
- `src/features/creation/item/components/ItemPreviewCard.tsx` — ItemPreviewCard
- `src/features/creation/world/components/WorldCreator.tsx` — WorldCreator
- `src/features/creation/world/components/WorldPreviewCard.tsx` — WorldPreviewCard
- `src/features/novel/components/NovelChapterRail.tsx` — NovelChapterRail
- `src/features/novel/components/NovelCreateModal.tsx` — NovelCreateModal
- `src/features/novel/components/NovelGalleryPage.tsx` — NovelGalleryPage
- `src/features/novel/components/NovelGenerationHistoryDrawer.tsx` — NovelGenerationHistoryDrawer
- `src/features/novel/components/NovelStudio.tsx` — NovelStudio
- `src/features/novel/components/NovelStudioHeader.tsx` — NovelStudioHeader
- `src/features/novel/components/StudioStatusStrip.tsx` — StudioStatusStrip
- `src/features/novel/components/WordGoalControl.tsx` — WordGoalControl
- `src/features/novel/components/codex/CodexContextMeter.tsx` — CodexContextMeter
- `src/features/novel/components/codex/CodexEntryDrawer.tsx` — CodexEntryDrawer
- `src/features/novel/components/codex/CodexEntryRow.tsx` — CodexEntryRow
- `src/features/novel/components/codex/CodexLorebookPickerDrawer.tsx` — CodexLorebookPickerDrawer
- `src/features/novel/components/codex/CodexPanel.tsx` — CodexPanel
- `src/features/novel/editor/NovelEditor.tsx` — NovelEditor
- `src/features/novel/editor/components/BeatComposer.tsx` — BeatComposer
- `src/features/novel/editor/components/BubbleAiMenu.tsx` — BubbleAiMenu
- `src/features/novel/editor/components/EditorBubbleMenu.tsx` — EditorBubbleMenu
- `src/features/novel/editor/components/FindReplacePanel.tsx` — FindReplacePanel
- `src/features/novel/editor/components/MentionMenu.tsx` — MentionMenu
- `src/features/novel/editor/components/SlashCommandMenu.tsx` — SlashCommandMenu
- `src/features/novel/novelGalleryConfig.tsx` — novelGalleryConfig
- `src/features/lorebook/components/ActivationPreviewPanel.tsx` — ActivationPreviewPanel
- `src/features/lorebook/components/HighlightedTextarea.tsx` — HighlightedTextarea
- `src/features/lorebook/components/LoreEntryEditor.tsx` — LoreEntryEditor
- `src/features/lorebook/components/LoreEntryPreviewBody.tsx` — LoreEntryPreviewBody
- `src/features/lorebook/components/LoreEntryTable.tsx` — LoreEntryTable
- `src/features/lorebook/components/LoreTriggerMark.tsx` — LoreTriggerMark
- `src/features/lorebook/components/LorebookAssistantChatbot.tsx` — LorebookAssistantChatbot
- `src/features/lorebook/components/LorebookAttachPanel.tsx` — LorebookAttachPanel
- `src/features/lorebook/components/LorebookCard.tsx` — LorebookCard
- `src/features/lorebook/components/LorebookGalleryPage.tsx` — LorebookGalleryPage
- `src/features/lorebook/components/LorebookIssueList.tsx` — LorebookIssueList
- `src/features/lorebook/components/LorebookPreviewBody.tsx` — LorebookPreviewBody
- `src/features/lorebook/components/LorebookResourcePanel.tsx` — LorebookResourcePanel
- `src/features/lorebook/components/LorebookResourcePickerDrawer.tsx` — LorebookResourcePickerDrawer
- `src/features/lorebook/components/LorebookResourcesGalleryPage.tsx` — LorebookResourcesGalleryPage
- `src/features/lorebook/components/LorebookStudio.tsx` — LorebookStudio
- `src/features/lorebook/components/SessionLorebookPanel.tsx` — SessionLorebookPanel
- `src/features/lorebook/components/resources/ResourceCard.tsx` — ResourceCard
- `src/features/lorebook/components/resources/ResourceContentView.tsx` — ResourceContentView
- `src/features/lorebook/components/resources/ResourceDetailView.tsx` — ResourceDetailView
- `src/features/lorebook/components/resources/ResourceExtractionMetadata.tsx` — ResourceExtractionMetadata
- `src/features/lorebook/components/resources/ResourceGrid.tsx` — ResourceGrid
- `src/features/lorebook/components/resources/Stat.tsx` — Stat
