# Play, voice, and administration UI audit — 2026-09-19

**Status reconciliation — 2026-10-14: historical review.** This document retains its dated source/fixture findings and recorded fixes. It does not prove current live behavior, enabled rollout, or comprehensive accessibility. Disabled features are WIP in the [status register](FEATURE_STATUS.md); current release work and unrevalidated UX recommendations belong in the [roadmap](ROADMAP.md).

This ledger covers the nine route families assigned to the play/admin pass. It records real browser observations separately from fixture availability and source inspection. It is not a claim that every backend outcome, input combination, or browser has been tested.

## Method and evidence

Source inventory: `src/features/interaction`, `characterChat`, `call`, `voices`, and `admin`, plus their route entries in `src/app/router/AppRouter.tsx`. The shared-component and authoring audits cover reused shell, auth, media, lorebook, and creation surfaces.

Rendered checks used Brave via `cua_repl`. Initial checks used desktop 1280–1661 px and phone 390 px. Final comparisons use two real nested viewports: 1280 × 1150 and 390 × 844. The desktop preview is visually scaled but its CSS viewport remains 1280 px. Outer browser viewport changes were stopped because they reset other audit tabs. Full-page screenshots preserve both frames; individual overlays scroll within their frame.

Reproduce a comparison at `http://localhost:6006/iframe.html?id=audit-responsive-comparison--compare&viewMode=story&subject=STORY-ID`. A stable compiled Storybook was also used at port 6007; final changes were checked on 6006. Screenshot evidence was viewed in the audit conversation, not saved as image files. “Screenshot” below means actual image inspection; “DOM” means rendered text, controls, state, and/or bounds were inspected in the browser without a dedicated screenshot of every variant.

[Play/admin fixture source](../src/features/admin/PlayAdminAudit.stories.tsx) and [offline providers](../src/features/admin/playAdminAuditFixtures.tsx) replace API methods and the chat transport. Mutating operations fail locally or are inert. Agent Studio has separate local fixtures. No live microphone, generation, server deletion, credit grant/reset, agent publish/rollback, or upload was performed.

## Route and overlay coverage

### Active adventures (`active-adventures`)

Source: [ActiveAdventuresPage](../src/features/interaction/components/ActiveAdventuresPage.tsx), shared `ResumeCard`, `ConfirmDialog`, and `Toast`.

- `audit-play-and-admin--adventures`: populated list, search, continue/delete menu rendered. Desktop screenshot; phone delete confirmation screenshot and cancelled. The responsive route uses the same shared resume card reviewed in the discovery pass.
- `--adventures-empty` and `--adventures-error`: desktop/phone rendered DOM verified. Empty has Browse adventures; error has Try again and does not say there are no adventures.
- Initial application loading is controlled by the app data/router path, covered by the root audit. This fixture does not claim a distinct adventure-page initial-loading screen.
- No server deletion was performed. Toast success/failure combinations are covered by component behavior tests and shared UI coverage, not all individually captured here.

### Adventure interaction (`interaction`)

Source: [AdventureInteraction](../src/features/interaction/components/AdventureInteraction.tsx), `InteractionLeftPanel`, `InteractionCenterPanel`, `InteractionRightPanel`, `InteractionTopBar`, `SidePanelDrawer`, `ChatTurn`, `ChatMessage`, `ForwardOptions`, `ChatActions`, `EditMode`, `ChatComposer`, `GeneratedImage`, `TurnNarration`.

- [Populated comparison](http://localhost:6006/iframe.html?id=audit-responsive-comparison--compare&viewMode=story&subject=audit-play-and-admin--adventure): desktop and phone screenshot. Narrative, utility actions, suggestions, composer, and desktop rails retain a coherent hierarchy. The phone composer remains visible within the finite viewport; long history scrolls independently.
- `--adventure-empty`, `--adventure-loading`, `--adventure-error`: both sizes rendered DOM verified. Welcome guidance, Loading adventure turns, and load error with retry are distinct.
- Desktop scenario edit: field, Save, Cancel inspected. Desktop message edit screenshot includes keyboard guidance and focused textarea; cancel restored the message.
- Phone Adventure details screenshot includes scenario, persona, world, cast, lorebooks and narration. Phone Adventure log screenshot includes divided history and automatic-save note.
- Clear messages modal screenshot on desktop and Delete message popover screenshot on phone. Cancel/Keep messages used; destructive actions not submitted. Utility controls stay adjacent to the relevant message.
- Suggestion selection fills and focuses the composer, checked in browser by root and in `InteractionCenterPanel.test.tsx`.
- Image loaded/failed/streaming lifecycles are covered by existing `GeneratedImage` and turn stories/tests; this route fixture has no protected generated image. Real narration/audio generation was not started.

Session overlays: [AdventureCardDrawer](../src/features/interaction/components/AdventureCardDrawer.tsx), [AddCardModal](../src/features/interaction/components/AddCardModal.tsx).

- `--adventure-card`: view and edit screenshots at both sizes. Session-only edit note, remove, edit, required fields, attributes, triggers, media sections and persistent footer are present. Final read view has open empty hints and divided attribute rows. Final phone editor screenshot confirms the shared AttributeManager heading/button spacing correction.
- `--adventure-world` and `--adventure-persona`: both sizes rendered DOM inspected for correct role, title, metadata, details, and remove action. They reuse the same drawer shell; world-specific edit-field interactions were source-inspected rather than separately submitted.
- `--add-cast`: both sizes screenshot; phone selected state screenshot shows an ember selection rule, check, and Add 1 character CTA. `--add-cast-empty`: both sizes DOM verified.
- Media Gallery/History and attribute-edit subdialogs are shared authoring components, covered by the authoring audit; no generation/upload was invoked from this session form.

### Character conversation (`character-chat`)

Source: [CharacterChat](../src/features/characterChat/components/CharacterChat.tsx), `CharacterChatSidebar`, `CharacterChatCodexPanel`, plus the shared interaction components above.

- [Populated comparison](http://localhost:6006/iframe.html?id=audit-responsive-comparison--compare&viewMode=story&subject=audit-play-and-admin--character): final desktop/phone screenshot verifies sidebar information, narrative, utility actions, and visible composer. Phone history scrolls while the title/composer remain usable.
- `--character-empty`: both sizes DOM verified after correcting the fixture to seed no cached turns. Shows character-specific conversation guidance.
- `--character-loading` and `--character-error`: rendered at both sizes, but these simulate background hydration while cached turns remain visible. They are **not** evidence for generation-loading or stream-error banners. The component deliberately preserves cached conversation content through hydration failure.
- Sidebar actions, empty codex/lorebook, persona and call entry were rendered. Populated session lore, trigger highlighting and floating entry preview were checked separately by the authoring agent using `authoring-embedded--session-lore` at 1280/390. Desktop Ctrl-click and mobile Preview lorebook opened readable floating previews without observed overflow.
- Live voice route and shared PersonaPicker/voice consent are covered below. Group-chat entry is routed through the gallery; group creation coverage belongs to the discovery audit.

### Chatroom (`chatroom`)

Source: [ChatroomPage](../src/features/characterChat/components/ChatroomPage.tsx), [NewCharacterChatDialog](../src/features/characterChat/components/NewCharacterChatDialog.tsx), shared resume cards/confirmations.

- `audit-play-and-admin--chatroom`: desktop DOM and phone screenshot: New chat, New group chat, search, saved conversation rows and actions.
- `--chatroom-empty`, `--chatroom-loading`, `--chatroom-error`: desktop/phone DOM verified. Loading fixture now keeps `loadData` pending, so it shows Loading conversations rather than an artificial empty state.
- `features-characterchat-new-chat--character-selection`, `--opening-line-preview`, `--persona-selection`, `--empty-library`, `--loading-library`, `--load-failure`, `--start-failure`: every state rendered at both sizes. Persona step has a final desktop/phone screenshot; earlier phone screenshots cover character selection and continuation. Selection remains evident without boxing every candidate. Long lists scroll above the persistent actions.
- The start-failure story is entirely local and verifies choices remain displayed with retry guidance. Real conversation creation was not performed.
- New group chat changes navigation to the gallery group flow; it is not an omitted local dialog. List delete uses the same shared confirmation pattern as Active adventures; not every session variation was separately captured.

### Calls (`calls`, including transcript and live call surfaces)

Source: [CallsPage](../src/features/call/components/CallsPage.tsx), `CallHistoryRow`, `CallTranscriptView`, `CallScreen`, `CallWaveform`, `VoiceConsentModal`.

- `audit-play-and-admin--calls`: populated phone screenshot and desktop inspection. Character call shelf, recent calls, PersonaPicker and transcript navigation inspected. Redundant parent card click target removed; named Call {character} CTA is the single action.
- `--calls-empty`, `--calls-error`, `--calls-loading`: both sizes DOM verified, including final error/loading checks. Both library and recent-call failures have explicit retry controls; neither falsely reports an empty collection.
- `--transcript`, `--transcript-empty`, `--transcript-error`, `--transcript-loading`: both sizes DOM; populated phone screenshot. Speaker labels use separate lines and transcripts use subtle left rules. Error preserves back navigation.
- `features-call-callscreen--consent-gate`: desktop and phone screenshots; privacy explanation and accept/decline controls visible. Consent was not accepted.
- `--listening`, `--user-speaking`, `--thinking`, `--character-speaking`, `--degraded-vad`, `--provider-error`, `--reconnecting`, `--muted`, `--long-captions`: phone rendered DOM. Character-speaking phone screenshot caught overlapping captions/actions; final screenshot verifies scrollable content and persistent controls. Long-captions fixture is also available for repeated checks.
- Actual microphone, provider audio, permission denial, network reconnect, interrupt timing, audio seek/playback, and latency were not tested live. These pure view stories render the states without initiating a call.

### Voice studio (`voice-studio`)

Source: [VoiceStudioPage](../src/features/voices/components/VoiceStudioPage.tsx), `PresetEditor`, `PresetRecipeControls`, `SystemVoicePicker`, `VoicePickerDialog`.

- `audit-play-and-admin--voices`: desktop screenshot of preset library; create/edit/duplicate preset states inspected. New preset drawer screenshot desktop and phone. Name, base voice, recipe controls, preview and persistent save/cancel remain available.
- `--voices-empty`, `--voices-error`, `--voices-loading`, `--voices-signed-out`: both sizes rendered DOM. Load failure no longer coexists with false empty messaging.
- `--voice-picker`, `--voice-picker-empty`, `--voice-picker-error`, `--voice-picker-loading`: phone screenshots of presets/system voices; loading screenshot at both sizes; remaining states DOM at both sizes. Failure is visible with retry. Partial libraries remain usable. System choices use flat divided rows with selected-state emphasis.
- Preset edit/duplicate values were inspected; deletion uses shared confirmation. Real preview synthesis, save, duplication and deletion were not submitted.

### Voice administration (`admin-voices`)

Source: [AdminVoicesPage](../src/features/admin/voices/components/AdminVoicesPage.tsx), `VoiceCreatePanel`, `VoiceDesignForm`, `VoiceCloneForm`, `SynthLabPanel`, `SynthControls`, `ControlSlider`, `VoiceLibraryPanel`, `VoiceRow`, `SystemVoiceBrowser`, `CopyableVoiceId`, `TextArtifactToolbar`, `AudioDropzone`, `VoiceResultCard`, `MiniMaxReferenceDrawer`.

- `audit-play-and-admin--admin-voices`: desktop screenshots of Design and Clone (including optional prompt audio), phone full-page screenshot of clone/lab/library. Tabs, fields, switches, synth controls, voice filter and library actions are present. Delete confirmation inspected and cancelled.
- `--admin-voices-empty`, `--admin-voices-error`, `--admin-voices-loading`, `--admin-voices-restricted`: both sizes rendered DOM; loading screenshot at both sizes. Final error condition suppresses a misleading empty library.
- Reference drawer final desktop/phone screenshot: tab navigation, divided descriptions and external documentation links; nested mini-cards removed. Every reference tab is source-inventoried; only Voice sources was independently captured in the final screenshot.
- `admin-voices-audiodropzone--idle`, `--uploading`, `--selected`, `--with-error`: both sizes rendered DOM; validation screenshot at both sizes. No file chosen. `admin-voices-voiceresultcard--designed`, `--test-result`, `--cloned-awaiting-activation`: both sizes rendered; designed and clone-guidance screenshots. Fixed-width story wrappers were corrected to fit phones. Silent data-URL audio fixture does not invoke synthesis.
- Design/clone/test live requests, provider errors and resulting real audio were not executed. Text artifact insert controls and all synth options were source-inspected; not every selector combination was independently screenshot.

### Agent Studio (`admin-agents`)

Source: [AdminAgentsPage](../src/features/admin/agents/components/AdminAgentsPage.tsx) and its safe [stories](../src/features/admin/agents/components/AdminAgentsPage.stories.tsx).

- `features-admin-agentstudio--overview`: desktop and phone screenshots, selected bundled workflow details, prompt/schema/model fields and test panel.
- `--custom-agent`: both sizes rendered and editable workflow selected. Version-history drawer screenshot at both sizes; rollback confirmation screenshot at both sizes and cancelled. Delete confirmation DOM at both sizes and cancelled. Save/Publish/Delete remain available for the correct mutable case.
- `--create-custom-copy`: both sizes DOM; source fixture uses the required `{{handle_parser_input_0}}` token rather than presenting a misleading validation error.
- `--loading`, `--empty`, `--load-error`, `--restricted`: both sizes rendered DOM. Failed initial load suppresses false empty/select-agent panels.
- No live test, publish, save, rollback or deletion performed. Dynamic provider model failures and every generated validation failure were not captured.

### Credit administration (`admin-credit-codes`)

Source: [AdminCreditCodesPage](../src/features/admin/creditCodes/components/AdminCreditCodesPage.tsx), `QuotaResetPanel`, `CreditGrantSummaryTiles`, `CreditTokensToolbar`, `CreditCodeGrantsList`, `EmailCreditGrantsList`, `CreateCreditCodeGrantForm`, `CreateEmailCreditGrantsForm`, `EditCreditGrantDialog`.

- `audit-play-and-admin--credit-codes`: phone full-page screenshot and desktop inspection. Target and identifier controls now show readable labels (All users / One user; user hash / ID), retaining keyboard operation through shared `SegmentedControl`.
- Quota-reset confirmation phone screenshot and cancelled; One user reveals identifier controls. Create-code fields inspected on phone; edit-token phone screenshot; create-email desktop screenshot and DOM. No grant or reset submitted.
- `--credit-codes-empty`, `--credit-codes-error`, `--credit-codes-loading`, `--credit-codes-restricted`: both sizes rendered DOM. Empty summary fixture correctly shows zero counts; failed initial load hides false empty list.
- `admin-creditcodes-creditcodegrantslist--with-load-more` and `admin-creditcodes-emailcreditgrantslist--with-load-more`: final screenshots at both sizes include active/claimed/expired/disabled rows, wrapped metadata, actions, and Load more. No export was downloaded.
- Disable-token confirmation was opened from the code list, screenshot at desktop/phone sizes, and cancelled. The email-grant variant was opened and its email-specific copy verified on phone, then cancelled. Backend pagination/export contents, claim results and quota audit responses are unverified.

## Corrections made in this pass

- Consolidated conversation narrative, metadata, suggested actions, utility controls, sidebar references and history; removed per-turn and repeated nested framing while retaining useful composer, overlay and selection boundaries.
- Unified session drawers with readable empty hints and divided attributes; preserved session-only edit warning and all actions.
- Kept adventure rails docked only when enough room exists; phone side drawers and composers remain usable. Corrected caption/control overlap on the call screen.
- Flattened voice preset/library/picker/reference layouts; exposed load and preview errors, retry controls and loading states; removed misleading empty states after failure.
- Removed nested interactive call-card action; made named CTA the single call action.
- Added optional visible text labels to shared SegmentedControl and used them for quota target/identifier controls.
- Corrected full-route audit fixtures (valid adventure snapshot, bounded conversation height, safe API blocking, mutable agent, genuine pending list load, genuine empty character conversation) and phone story wrappers.
- Reported and verified the shared AttributeManager heading gap, fixed by the authoring agent. Shared token, icon-target, search-clear and common picker fixes belong to the root audit.

## Verification and remaining limits

Story typecheck passed after the route fixtures and error-state changes. Focused runs passed: 31 admin/calls tests (including all eight CallsPage tests); earlier 43 call/voice/credit/consent tests; 50 chat/new-chat/agent tests; and the serialized adventure-story smoke tests. These runs overlap and are not a unique-test total. Root owns the final full suite and production build. No tests were added merely to snapshot cosmetic class names.

Distinct route layouts and the listed major overlay families have browser evidence. Fixture availability alone is not called rendering coverage. Explicit limits remain: real network/microphone/media operations; stream-error and generation-progress banners not represented by the cached-hydration stories; all provider/model/input combinations; protected media; every reference tab and destructive-confirmation permutation; hover-only/touch behavior on physical hardware; browser matrix beyond Brave; screen-reader announcement quality. These require targeted follow-up if a stronger claim than this visual consolidation pass is needed.

The offline provider does not mount the application's full floating-window layer, so session reference-window behavior is cross-referenced to the authoring/shared audit rather than inferred from clicking an inert harness target. All real user data and paid operations were left untouched.
