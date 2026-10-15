# Magic Worlds UI/UX review

**Status reconciliation — 2026-10-14: historical review.** This document retains its dated source/fixture findings and recorded fixes. It does not prove current live behavior, enabled rollout, or comprehensive accessibility. Disabled features are WIP in the [status register](FEATURE_STATUS.md); current release work and unrevalidated UX recommendations belong in the [roadmap](ROADMAP.md).

**5 September 2026 · Frontend source review and roleplay product research**

The highest-value improvements are preserving the user's writing, making new conversations easy to start, and maintaining story continuity across navigation. The established Reverie visual system already gives the product a coherent identity; the next polish pass should make everyday actions equally dependable.

## Scope and evidence

This review covers character chat, the shared conversation engine, Chatroom, discovery and persona selection, landing/dashboard, navigation, and shared controls. It combines inspected source with official Microsoft HAX, Google PAIR, SillyTavern, Character.AI and W3C material, accessed on 5 September 2026.

**Source findings** describe behavior established by frontend code. They are not claims of reproduction against a live backend. **Product precedents** show how established roleplay tools handle similar needs; their existence does not prove those designs outperform alternatives. **Recommendations and priorities** are our interpretation. Mobile clipping, keyboard interaction and user comprehension still need representative device and usability testing. This document does not claim a visual audit of every screen, live backend verification, or a model-memory evaluation. Source links identify the reviewed areas; line positions can move during implementation.

## Preserve what already works

The shared engine provides Stop, generation Retry, copying, editing, delete/reset confirmation, reconnect feedback, and reduced-motion-aware scrolling. It follows output only while the reader remains near the bottom and offers a way to return to new messages. Users can write their next turn during generation, and the composer respects IME composition. A separate polite live region announces completed replies once instead of reading every streamed fragment. See [InteractionCenterPanel](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.tsx:135) and [ChatComposer](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatComposer.tsx:32).

Reusable primitives, modal focus handling, localization infrastructure, persona selection and session context cards are also strong foundations. Reuse them for the changes below.

## Requested change: New chat in Chatroom

**Implemented and verified.** Chatroom now has a persistent primary **New chat** action, independent of the group-chat flag. It opens a searchable picker of saved AI character cards, previews the selected opening line, and then shows an explicit persona choice before **Start chat**. Character-specific and library persona defaults remain visible and changeable. Review [ChatroomPage](/home/andres/WebstormProjects/magic-worlds/src/features/characterChat/components/ChatroomPage.tsx) and [NewCharacterChatDialog](/home/andres/WebstormProjects/magic-worlds/src/features/characterChat/components/NewCharacterChatDialog.tsx).

Selections survive creation failure; the fixed footer keeps the error and recovery action visible even with a long library. Pending requests block duplicate starts and picker dismissal. Successful creation navigates only while Chatroom remains mounted. Empty and failed library loads offer browsing, cached characters remain usable after unrelated endpoint failures, and signed-out visitors can still browse before signing in. Both selection steps have English and Spanish copy. The existing shared saved-session card also gives names more room on mobile by hiding its redundant trailing icon and reducing the gap; its menu and whole-card resume action remain available.

Use **Continue** for an existing session, **New chat** for another session, and **Clear messages** for deleting the current history. Canceling selection or encountering a creation failure should preserve existing chats. Searchable character rows should show portrait, name and a short description; the chosen persona must be identifiable before starting. SillyTavern separately documents fresh-chat creation, history management and character discovery with search/filter controls. These are useful precedents for this distinction. [Chatting](https://docs.sillytavern.app/usage/chatting/), [Characters](https://docs.sillytavern.app/usage/characters/).

Acceptance: reach New chat with zero or many saved conversations; select a different character and persona; cancel safely; recover from creation failure without losing selection; prevent duplicate submissions; create a new session rather than resume/reset an old one. Complete the picker using keyboard alone. Adding the same entry point inside an active conversation remains a follow-up unless separately implemented.

## Prioritized backlog

### P1 — Make historical regeneration preserve the user's story

[ChatActions](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatActions.tsx:208) exposes immediate regeneration for earlier AI replies. [InteractionCenterPanel](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.tsx:779) truncates subsequent turns and deletes their stored messages before generating. The failure snapshot preserves the selected reply, not every later deleted message. Partial deletion failure can also leave the restored local transcript inconsistent with persisted history.

Keep latest-reply regeneration quick. For older replies, explain how many later messages will change and request confirmation. Prefer a durable **Branch from here** operation when backend support exists. Replacement/deletion should be transactional so a failed operation does not destroy the only copy. Microsoft HAX emphasizes recoverable correction and communicating action consequences; SillyTavern exposes branching and checkpoints as distinct story operations. [HAX guidelines 9 and 16](https://www.microsoft.com/en-us/haxtoolkit/library/), [SillyTavern story operations](https://docs.sillytavern.app/usage/chatting/).

Acceptance: regenerate an older reply, fail generation, and independently fail a later deletion. After reload, the original story must remain recoverable and the visible result must match durable history.

### P1 — Restore unsent drafts and failed edits

Composer input is local state in [InteractionCenterPanel](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionCenterPanel.tsx:128). Navigation, reload and the text-to-call transition unmount the surface. [ChatTurn](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatTurn.tsx:64) also closes edit mode before an asynchronous save finishes. Losing a multi-paragraph roleplay turn is substantially more costly than losing a short chat message.

Persist drafts under account, session kind and session ID; restore them on return and clear them on accepted send or deliberate discard. Retain edited text through save failure. Define whether drafts survive sign-out and provide a visible discard action; these are private writing artifacts, not reusable account-independent preferences. Google PAIR notes that creative users value control and the ability to adjust output. [Feedback + Control](https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/).

Acceptance: navigate away/back, switch text/call/text, reload, fail a send/edit and change accounts. Restore only the correct draft and never expose one account's text to another.

### P2 — Give each private conversation a stable location

[CharacterChat](/home/andres/WebstormProjects/magic-worlds/src/features/characterChat/components/CharacterChat.tsx:45) redirects to Chatroom when no active in-memory chat exists. Opening a conversation uses a generic page route, so refresh/bookmark entry cannot restore that session directly.

Include the session ID in the private route and resolve it through loaded data/API. Provide distinct loading, missing and inaccessible states. Retain normal Back/Forward behavior. A routable private session must still require its existing authorization; this recommendation does not imply public sharing.

Acceptance: reload, open the same private URL in another tab, visit a nonexistent or inaccessible ID, and navigate backward/forward between two sessions without losing orientation.

### P2 — Finish persona onboarding without losing the chosen character

The empty [PersonaPickerDialog](/home/andres/WebstormProjects/magic-worlds/src/ui/components/PersonaPickerDialog.tsx:82) routes to a generic character creator; [GalleryPage](/home/andres/WebstormProjects/magic-worlds/src/features/gallery/components/GalleryPage.tsx:1253) and [LandingPage](/home/andres/WebstormProjects/magic-worlds/src/features/landing/components/LandingPage.tsx:714) clear the pending selection. The creator defaults to an AI character role.

This affects an **empty full candidate list**, not every account without a dedicated persona: [personaCandidates](/home/andres/WebstormProjects/magic-worlds/src/utils/characterRoles.ts:30) includes ordinary AI character cards. An account encountering a public card before importing any candidates is a scenario to verify.

Offer **Create your persona**, seed the appropriate role, preserve the selected chat target, and return to confirmation after saving. Carry initiating intent through login where practical. SillyTavern distinguishes persona identity and chat-bound/default associations, supporting this continuity model. [Personas](https://docs.sillytavern.app/usage/core-concepts/personas/).

Acceptance: an empty-candidate account completes persona creation and returns to the originally selected character; an account with ordinary character candidates can still use those supported choices.

### P2 — Make navigation, editing and failures accessible and understandable

[AppRouter](/home/andres/WebstormProjects/magic-worlds/src/app/router/AppRouter.tsx:79) scrolls on route changes without a consistent main-content focus target. [EditMode](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/EditMode.tsx:40) has placeholder text but no explicit accessible textarea name. The chat error banner lacks alert/status semantics. Some dashboard actions, including chat deletion and story opening, only log failures; the dedicated Chatroom already uses visible feedback.

Add a skip-to-main route target, deliberate route focus/document titles, an edit-field label and focus restoration. Announce actionable chat errors once; retain completion-only reply announcements. Reuse localized Toast/Callout feedback for failed story operations, deletion and narration, distinguishing failed transcript loading from an optional media refresh. W3C describes programmatically identifiable status messages without moving focus and warns against excessive announcements. [Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

Acceptance: keyboard/screen-reader users can identify the new page, edit/cancel/save, understand failed sends, and retry the same failed operation from dashboard or dedicated page with equivalent feedback.

### P2 — Reduce mobile chat chrome after measuring it

The app's [MobileTopBar](/home/andres/WebstormProjects/magic-worlds/src/ui/components/MobileTopBar.tsx:27) and conversation [InteractionTopBar](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/InteractionTopBar.tsx:33) stack on narrow screens. [ChatTurn](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatTurn.tsx:83) combines name, timestamp and a non-shrinking action cluster. Expanded touch targets on tightly adjacent buttons warrant measurement. These structures are confirmed; clipping and keyboard obstruction remain validation hypotheses.

Consider one conversation header, with Back, character details and session actions. Move secondary message tools into a labeled More menu on narrow screens. Keep targets non-overlapping and verify dynamic viewport/safe-area behavior. WCAG 2.2 AA specifies 24×24 CSS-pixel targets with exceptions; 44px is a stronger touch design target, not that AA threshold. [Target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). New dialogs should contain keyboard focus, support Escape, and return focus logically. [APG modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Acceptance: measure 320/390px layouts, long localized names, 200% zoom, landscape, software keyboard and narration states on representative iOS/Android browsers.

### P2 — Make story memory visible and controllable

The [character sidebar](/home/andres/WebstormProjects/magic-worlds/src/features/characterChat/components/CharacterChatSidebar.tsx:106) exposes Codex cards and optional lorebooks. The inspected UI lacks a unified overview of session facts, pinned moments and story summary; that does not establish what the backend remembers.

Evolve the context panel into **Story memory**, distinguishing character definition, persona information and session events. Let users inspect, correct, disable and remove facts. Make scope explicit and memory transfer to another chat optional. Any usage indicator must reflect actual backend accounting. Character.AI's 21 May 2026 announcement offers precedents for editable facts, pinned moments, memory usage and explicit new-chat transfer; its earlier guidance acknowledges imperfect recall. These are vendor descriptions, not independent accuracy evidence. [Memory update](https://blog.character.ai/memory/), [Memory limitations](https://blog.character.ai/helping-characters-remember-what-matters-most/).

Acceptance: users can identify what is remembered, where it applies and how to correct it. Verify isolation across accounts/sessions, deletion behavior and clean-slate creation against the backend before promising them in UI copy.

### P3 — Improve session recognition, role identity and localization

[ResumeCard](/home/andres/WebstormProjects/magic-worlds/src/features/landing/components/ResumeCard.tsx) offers Continue, optional Call and Delete, while [resumeModel](/home/andres/WebstormProjects/magic-worlds/src/features/landing/components/resumeModel.ts:145) often titles chats by character. Several sessions with one character become difficult to distinguish. Show **Playing as…**, add editable scene titles and archive support when APIs permit, and clarify that current search covers metadata/latest snippets rather than the full transcript.

[ChatAvatar](/home/andres/WebstormProjects/magic-worlds/src/features/interaction/components/ChatAvatar.tsx:12) still renders generic Player/GM identities in outer turn chrome. Carry the selected persona and single character name/portrait through the reading surface; preserve narrator/group attribution. Translate hardcoded English count/fallback strings in [resumeModel](/home/andres/WebstormProjects/magic-worlds/src/features/landing/components/resumeModel.ts:105) using locale-aware pluralization.

Acceptance: distinguish three same-character sessions without opening them, identify the active persona with the sidebar closed, and switch English/Spanish with zero/one/many counts and missing-name fallbacks.

## Delivery sequence and measures

1. New chat QA is complete; next protect historical regeneration and drafts.
2. Repair persona continuity, private session restoration, failure feedback and accessibility.
3. Validate mobile behavior, then improve session organization, identity and localization.
4. Design memory controls jointly with backend persistence/context behavior.

Measure New chat-to-first-message completion, time to first reply, persona-step abandonment, draft restoration, return-to-session success and failure-recovery completion. Track accidental reset/regeneration reports. These are proposed measures, not current results. Avoid using longer engagement alone as the success criterion. Prefer aggregate events without transcript/persona content in routine analytics.

Run short moderated tasks with first-time and returning roleplayers, including keyboard/screen-reader participants. Ask users to start a new story, recover an interrupted draft, find an earlier session, explain regeneration consequences and identify their persona/memory scope. Record baseline results before setting numerical improvement targets.

## Implementation verification

All checks passed on the final source changes:

- `pnpm build` — TypeScript and production build pass. Vite reports the existing large TipTap chunk warning.
- `pnpm typecheck:stories` — pass, including the Chatroom previews and seven picker states.
- `pnpm exec vitest run src/features/characterChat/components src/app/providers/DataProvider.test.tsx src/features/landing/components/ResumeCard.test.tsx` — **48 tests passed across five files**. Coverage includes actual picker integration, persona defaults/change/search, create-before-navigation, retry, double-submit prevention, route departure, auth/group flags, loading, Spanish copy and existing resume/provider behavior.
- Focused ESLint across changed source, tests, stories and locale files; `git diff --check` — pass.
- Local Storybook browser checks at desktop width, **390 × 844** and **320 × 640**: character/persona selection, saved-session preservation after cancel, preview-only session creation, footer error visibility, Tab/Shift+Tab containment, Escape and focus return. Text-clamp conflicts and crowded narrow saved-chat rows found during this pass were corrected.

Browser checks used local fixtures and mocked creation, so no live account data or paid generation was changed. Authenticated end-to-end backend creation, real software keyboards, screen-reader audio and the entire site's responsive layouts were not exercised. The picker uses the existing saved-card library and creation API; community discovery remains available through Browse characters. The prioritized backlog above remains follow-up work rather than a claim that those issues were repaired in this change.
