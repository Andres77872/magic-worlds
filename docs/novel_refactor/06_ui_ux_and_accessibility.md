# UI/UX and accessibility approach

**Documentation review:** 2026-10-14. **Status:** WIP / planned UI contract — current chapter editor has partial coverage; live accessibility acceptance is outstanding. Overall novel availability is **WIP**, disabled in the example configuration and enabled in the reviewed local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

**UI/UX plan update:** 2026-10-15, America/Mexico_City. The [standalone demo](novel-studio-demo.html) now supplies a concrete interaction reference. The findings below distinguish prototype observations, source limitations, and recommendations. The demo is not integrated into the SPA and does not establish product usability, backend correctness, or accessibility conformance.

## Product interaction model

Keep prose central. Provide **Write**, **Plan**, and **Review** views over one novel. The right inspector has Assistant, Codex, Context, and Changes tabs rather than several competing permanent rails. Novel/scene navigation lives on the left, with recoverable archive/trash in its menu. A separate delivery flow handles import/export and print layout.

This is a proposed information architecture, not a replacement of the app's approved Library/Workspace R1 navigation. Novel entry remains the existing Novels area. Reuse its gallery patterns and the app's established drawers/dialogs.

AI interaction should explain capabilities, invite correction, and make failures recoverable. Microsoft HAX provides research-backed general guidance for these behaviors. [Human-AI interaction guidelines](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)

## Prototype findings and prioritized UI/UX work

The demo was visually inspected at a 390 CSS-pixel phone width, the default browser size, and a 1440 CSS-pixel desktop width. Its final phone check reported equal page and viewport widths of 390px. Review acceptance/undo and planning navigation were exercised in the browser. Separately, 26 assertions passed in a temporary jsdom workflow check with dialog/download doubles. That script was not retained as a regression suite. These observations do not establish behavior inside the full app shell, at 320px, with a mobile keyboard, or with assistive technology; see [12 — Validation](12_validation_and_acceptance.md#uiux-acceptance-matrix).

**Priority:** P1 protects writing, deliberate actions, or access to essential controls; P2 improves organization, clarity, and task completion. UX IDs track design work, not additional confirmed application defects. All remain planned for the product, including findings corrected in the standalone demo. Dates and named owners remain TBD.

| ID / priority / phase | Finding and evidence | Required outcome |
|---|---|---|
| UX-01 · P1 · D1–D2 | **Prototype observation:** rails can collapse while keeping prose readable; the final 390px page had no horizontal overflow. The app sidebar was not included. | Base layout on available studio width. Collapse inspector before outline; retain access to both through labeled controls. Verify 320px reflow inside the real shell. |
| UX-02 · P2 · D1–D2 | **Design recommendation:** narrative typography and a measured column make prose the main visual task; author preference has not been studied. | Use existing narrative/reading-width tokens. Keep essential counts, status, and help readable; avoid micro text for information needed to decide or recover. Add token-based reading presets without shrinking prose to fit rails. |
| UX-03 · P1 · D1–D3 | **Prototype observation:** at 1440 × 1000, the initial review layout put acceptance actions below the visible area; scrolling reached them. | Keep target, original/proposed text, and decision controls easy to reach. Use a compact review header and a reachable action region; if sticky, reserve space so it covers neither text nor focus. |
| UX-04 · P1 · D1 | **Prototype observation, corrected there:** the phone footer crowded and wrapped competing statuses. Save and recovery were prioritized and secondary chrome reduced. | Give device/account save state and recovery priority. Make failures persistent and actionable. A timed toast cannot be the only route to undo, retry, or recover. |
| UX-05 · P1 · D1 | **Prototype observation, corrected there:** hiding the inspector button's visible label also removed its accessible name until an explicit label was added. **Source limitation:** the custom overlay rails are not a complete modal implementation. | Preserve names at every breakpoint. Reuse shared Drawer/Modal focus and modality behavior; verify opening, closing, background access, and focus return. |
| UX-06 · P1 · D1–D3 | **Prototype source limitation:** `renderInspector()` rebuilds the composer and the resize handler closes overlays. Unsent input, focus, and selection continuity are not a proven contract. | Preserve composer drafts, caret/selection, scroll, active scene, and pending proposals across panel/view changes. A resize or response update must not erase input or leave focus in hidden content. |
| UX-07 · P2 · D2–D4 | **Prototype source/interaction reference:** scene menus offer move, duplicate, split, and archive; board, outline, and timeline read one scene model. Discoverability has not been tested with authors. | Expose a labeled Scene details/actions entry, destination-aware moves, and pointer/keyboard alternatives to drag. Retain stable identity and show an undo result across all views. |
| UX-08 · P1 · D1–D3 | **Prototype interaction reference:** explicit accept, refine, stash, stale-target comparison, and undo are demonstrated. Answers and context totals are fixtures. | Show Ask/Suggest edits mode and bound scope before a request. Bind results to their request target, review changes explicitly, and never accept on Tab, focus changes, or unrelated edits. Real context must match execution. |
| UX-09 · P2 · D3–D6 | **Prototype source limitation:** example knowledge uses simplified scene dates and canned facts; the memory UI illustrates a distinction, not a continuity engine. | Distinguish outline, written summary, approved canon, and speculation. Show stale derivations and source passages. Reading order, story time, and POV knowledge must remain independent. |
| UX-10 · P2 · D5 | **Prototype source limitation:** Markdown/text/sample JSON download; DOCX/EPUB/PDF are disabled examples and pasted text is a limited import path. | Show only supported formats as available. Preview structure/losses and retained source before import; freeze selected revisions for export. Publication is a separate action. |
| UX-11 · P1 · D1–D3 | **Design gap:** a happy-path demo and an offline toggle do not establish loading, storage failure, auth expiry, quota, read-only, or request-recovery behavior. | Specify each state with retained writing, a useful explanation, and a reachable next action. Keep ordinary editing useful during AI outages; avoid automatically retrying paid generation. |
| UX-12 · P2 · Every phase | **Evidence gap:** no moderated author study, English/Spanish layout study, real-device keyboard session, or screen-reader audit was completed. | Validate task completion and author understanding before adding command density. Retain regression evidence, accessibility results, and unresolved limitations separately from screenshot/build checks. |

The intended hierarchy, shared inspector, and explicit proposal boundary are useful design directions. Their usefulness with real manuscripts and authors remains a hypothesis. The demo's simplified storage, temporal rules, fixed split point, full-panel replacement, and plain HTML controls must not be copied as production architecture. Implement with the services and adapters in [07](07_target_architecture.md), [08](08_ai_assistant_context_and_tools.md), and [09](09_persistence_revisions_and_recovery.md).

## Desktop and responsive behavior

| Situation | Recommended presentation |
|---|---|
| Wide writing workspace | Collapsible outline, measured prose column, one optional inspector |
| Narrow workspace or browser zoom | Collapse inspector first, then outline; preserve a readable manuscript column |
| Tablet | Navigation and inspector as independently accessible drawers; no requirement for drag |
| Phone with keyboard | Prose first; compact scene switcher; contextual actions in a sheet that clears the keyboard |
| Focus mode | Hide nonessential rails; retain reachable save/recovery state and exit control |
| Whole-novel reading | Continuous reading without mounting every scene as a full editable instance |
| Review mode | Changes/issues list with passage navigation and original/proposed comparison |

Respond to available editor-container width, not only viewport breakpoints: the app sidebar and inspector reduce the actual writing area. Do not stack a long chapter rail above the manuscript on small screens. Preserve selection/scroll position when panels change. Handle visual viewport changes from mobile keyboards.

Apply the following layout rules for UX-01/02/03/05/06:

- Treat the demo's 1220px/820px/540px cutoffs as prototype choices. Derive production transitions from the measured writing area, app navigation, reading settings, and localized labels. A breakpoint must not reduce text size just to keep three columns visible.
- Use one clear vertical scroll region for the main writing/review task. If outline and inspector scroll independently, keep their controls and current selection reachable; avoid nested scroll regions inside each short card or paragraph.
- At narrow widths, use one overlay panel at a time. Opening a modal drawer moves focus into it and makes the covered application unavailable; a docked inspector remains non-modal. Closing or collapsing it restores a valid focus target without losing the editor selection.
- Stack labeled original/proposed passages when two readable columns cannot fit. Keep the source and proposal identities visible during navigation through long changes. A matrix may have a local horizontal scroller; ordinary prose, controls, and surrounding explanations still reflow.
- Keep save/recovery and exit-focus controls available in focus mode. Collapse decorative or secondary chrome first. Account for the on-screen keyboard and safe areas before pinning a composer or review footer.

The product target is reflow at an equivalent 320 CSS-pixel width for ordinary horizontal text, with appropriate exceptions for content that requires two-dimensional layout. This is a release requirement beyond the demonstrated 390px sample. Fixed controls must not fully hide keyboard-focused content; the stronger product goal is to leave the focused control and writing target unobscured. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html)

## Reverie integration

Follow [ui-design-system](../../.agents/skills/ui-design-system/SKILL.md) and [ui-components](../../.agents/skills/ui-components/SKILL.md). Fonts, color, radius, shadow, and motion come from `src/ui/styles/theme.css`; any new reading preset belongs in the token system. Reuse Button, IconButton, Field/Input, Select, Drawer, Modal, Callout, Badge, ConfirmDialog, and the shared assistant shell.

Use ember for author actions and committed/active states; arcane for AI proposals or generation. Prose retains narrative typography, UI remains sans-serif. Color does not carry accepted/rejected/error meaning alone. Add labels and state text. Editor controls inside ProseMirror can use its node/decorations mechanism, but should follow the same tokens and interaction rules as app primitives.

Use the component source as the prop/API authority; skill examples and the standalone HTML can drift. Match the app's focus ring, spacing density, motion, and z-index conventions. Register any new reading-size/spacing token in the theme and token inventory. Preserve reading preferences when changing views, test font-loading fallbacks, and avoid adding an AI-colored surface around ordinary author prose.

## Essential author journeys

### Start or import a novel

Create with minimal metadata and begin typing immediately. An optional planning step is available later. For imports, preview detected chapters, unsupported elements, reference handling, and formatting losses before committing. Preserve the original file/content and provide a result summary with navigation to any conversion issues.

### Work with a chapter or scene

Show its title, ordinal, status, and optional compact synopsis. Use an overflow menu for duplicate/move/split/archive. Drag handles supplement those operations. Moving a scene explains changes to reading order and offers a route to undo. Do not silently change its story time or POV.

### Ask the assistant

The composer shows the current novel and scope: selection, scene, chapter, or chosen sources. The Ask mode gives answers and brainstorming without altering the manuscript. Responses to factual story questions cite clickable passages. The author can switch to Suggest edits without starting another conversation.

### Request an edit

Selecting prose reveals compact formatting and AI actions. A custom instruction accepts the target, desired change, and optional constraints. Pending generation shows Stop and useful progress without stealing the caret. If the target changes while generating, the result becomes stale and asks for a reviewed rebase rather than landing automatically.

Review displays original and proposed text, highlights substantive changes, and offers Accept, Reject, Refine, and Stash. A whole-request action and per-change actions share consistent wording. Acceptance results in a visible local commit and server-save state. Navigation out of a proposal must not silently discard it; offer keep as draft/stash or decline through the established guard flow.

For UX-03/06/08, identify the affected scene and passage before the decision controls. Label inserted/deleted text and preserve semantic reading order rather than relying on green/red or violet alone. Refine changes the candidate, not the manuscript. Stash preserves an alternative. A changed/deleted/archived target blocks acceptance with a visible explanation and a review/recovery route. Revising a comparison does not itself authorize application. Batch acceptance must state its scene/change count and honor dependencies.

Keep the same target, instruction, and draft composer when moving between Ask, Context, and Changes. Cite exact source passages for factual claims, label inference and alternatives, and separate manuscript style preferences from the assistant's conversational style. Stop/retry/recover controls must describe the actual job outcome, including partial results, rather than implying a cancelled transport guarantees no execution or charge. This applies the human-control direction of [Microsoft's human–AI guidelines](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) to the contracts in [08](08_ai_assistant_context_and_tools.md).

### Reuse alternatives and writing snippets

For R11/A11, provide a searchable novel-owned stash for alternate prose, cut text, manual clippings, ideas, and critique notes. Allow optional scene filters and show source labels; retain source passage/revision and generation lineage where available. Preview before inserting and offer a labeled insert/copy action usable without dragging. Inserting copies the material into the explicitly chosen passage; it does not consume the stash original. Removing a stash entry is a separate deliberate action. Generated material remains a proposal until accepted through the common review flow.

### Inspect mentions and writing context

For E14/K02/K03/K10, rank active or pinned novel sources and recently used references ahead of the remaining authorized library. Disambiguate equal names and aliases with type, source, and version; never silently relink a manuscript reference by its label. Hover or keyboard focus can preview a reference, with an explicit action to include/exclude it and an explanation of the result.

A detected name, alias, or trigger suggests a reference; it does not force the full card into a paid request. Distinguish active, detected, suggested, and excluded sources. Show relevant warnings for ambiguous matches, empty descriptions, conflicting source versions, and unrevealed lore. Context inspection exposes included excerpts, source ordering, exclusions/truncation reasons, and estimated budget before execution, using the same compiler as the request. Compact/focus mode retains a route to that inspection. These are writing-context controls, not a new card-management or game interface.

### Review discoveries from prose

For A18/K04/K12, a proposed character, setting, or lore fact shows its supporting passage and manuscript revision, the explicitly selected destination, and field-level before/after values. The author can edit proposed values, reject them, or select independent fields to apply. Preserve novel-local facts and snapshots unless the author deliberately chooses an authorized library target. Apply the revision, dependency, and idempotency rules in [08](08_ai_assistant_context_and_tools.md#editorial-feedback-to-codex-and-library); drafting or accepting prose alone does not approve a canon/library change.

### Run a structural or book-wide task

An instruction such as “move the reveal later and update the affected scenes” creates a plan with affected units, constraints, and anticipated change groups. A plan approval authorizes that bounded work; it is distinct from approval of the final changes. Show reviewable results per scene and an operation summary. Keep unrelated scenes available for ordinary editing.

### Recover or resolve a conflict

Show which text is local, which revision is on the server, and when each was last acknowledged. Provide comparison, keep-local-as-copy, adopt-server, and reviewed merge. Retain both versions until resolution. Copy/export of recoverable text remains available during authentication or connectivity failure.

For UX-04/11, use the save-state contract in [09](09_persistence_revisions_and_recovery.md). Distinguish Editing, Saved on device, Syncing, Saved to account, Offline changes, Conflict, and Failed using the actual owning revision. Metadata errors stay attached to the affected field rather than being hidden by a successful prose save. A failure banner explains what is retained and offers the relevant Retry, Sign in, Compare, Copy, or Export action. Keep both conflict versions until a recovery decision is durable. Routine success may use a quiet status message; unresolved failures and recovery choices remain available after a toast closes. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

### Prepare for editorial delivery

The export view separates manuscript selection from format/layout settings. Show included scenes and excluded notes/annotations, then build from a frozen revision manifest. Provide progress, warnings and owned download. Personal review notes and reviewed AI change annotations are explicit file-output options. Shared editor or reviewer access is out of scope.

## Keyboard and focus contract

| Context | Required behavior |
|---|---|
| Manuscript | Standard text navigation, composition, selection, copy/paste and undo remain predictable |
| Save | Ctrl/Cmd+S saves the owning draft and reports result; respects active dialog/composer scope |
| Find | Ctrl/Cmd+F opens scoped Find; Escape returns focus to the prior writing position |
| Slash/mention | Arrow navigation, selected-option announcement, Enter insertion, Escape cancellation |
| Formatting toolbar | Documented shortcut to reach it; arrow navigation where toolbar semantics are used |
| AI review | Tab moves focus; acceptance requires an explicit control or distinct documented binding; Escape closes the transient surface without silently discarding a proposal |
| Pending generation | Stop and cancellation work from keyboard; Ctrl/Cmd+Z has documented semantics |
| Structure tree | Keyboard select/move/menu operations and selected/current state |
| Dialog/drawer | Correct initial focus, focus containment where modal, Escape policy, focus return |
| Inspector tabs | Active tab is the Tab entry point; arrow keys move between tabs; panel association and selected state remain correct |
| Responsive panel transition | Return focus to a visible control if its panel closes; preserve the scene, passage selection, and composer draft |

Do not introduce a shortcut that conflicts with an existing browser, IME, or editor action without an alternative and help entry. Localize names and display platform-correct modifier hints. A shared command registry can drive slash, palette, menus and help while respecting current editor phase and permissions.

Reuse a tested modal pattern: focus enters on open, stays inside while modal, and returns to its invoker or a logical surviving target on close. Choose initial focus to support reading a long recovery comparison rather than jumping straight to a destructive choice. Native dialog semantics alone do not prove correct focus return when a view replaces the invoking element. For inspector tabs, automatic activation is appropriate only when the associated content is available without noticeable delay; otherwise support deliberate activation. [W3C modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)

## Accessibility requirements and current findings

1. Announce meaningful save, conflict, generation-completion and error transitions through appropriate live semantics. Avoid token-by-token speech or announcing every dirty keystroke. [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
2. Autocomplete options need stable IDs and an active-option relationship when DOM focus stays in the editor. Keep visible selection and assistive-technology focus aligned. [W3C combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
3. Use the expected focus behavior for an ARIA toolbar or choose simpler grouped controls. Menus need menu keyboard behavior, not just roles on ordinary buttons. [W3C toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
4. Normal informational text clears 4.5:1 contrast. Current `parchment-500` on `ink-800` calculates about 2.11:1; chapter counts, placeholders and hints must not be dismissed as decoration. Main prose has strong contrast. [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
5. Preserve a visible focus indicator, including blank/read-only manuscript states. Verify the effect of the current focus-style suppression before declaring a failure. [W3C focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
6. Test 200% text zoom and 400% browser zoom/reflow, custom text spacing, narrow widths, long translated labels, and mobile keyboards. Review popovers must not cover the selected passage or disappear below the viewport.
7. Meet WCAG 2.2 AA target-size rules, including exceptions; use larger touch targets as a usability goal. The minimum criterion is 24 × 24 CSS pixels subject to its spacing and other exceptions. A 44 × 44 CSS-pixel target is the preferred touch goal and enhanced criterion, not the AA minimum. [W3C minimum target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
8. Supply click/tap alternatives to dragging as well as keyboard operation; keyboard shortcuts alone do not provide a single-pointer alternative. Honor reduced motion for typewriter scrolling and visual feedback. Provide keyboard opening for inline references and text equivalents for diagrams/media. [W3C dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
9. Recheck accessible names when visible labels collapse, selected/current states in scene navigation, and expanded state on panel toggles. A tooltip alone must not carry the name or explain an otherwise unreachable disabled action. Use a labeled list of buttons unless the complete keyboard/semantic contract of a tree, toolbar, or menu is implemented.
10. Do not let fixed footers, notifications, or floating AI controls obscure the focused control or passage. Support custom text spacing without losing content or actions; this tests override tolerance rather than prescribing new default prose styling. [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html), [Text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)

The current source concerns are tracked in NE-017/NE-019. This research does not certify conformance. Use NVDA/Firefox or Chrome, VoiceOver/Safari, keyboard-only navigation, touch, and automated checks as complementary evidence.

## Discoverability and copy

Prefer author-language actions: Continue here, Tighten, Expand, Compare changes, Save a snapshot, Move scene, and Ask about this passage. Keep technical details such as hashes, graph IDs and raw offsets in an advanced diagnostics view. Explain context with source names and scope; explain conflicts by the affected writing, not status codes.

Empty states should allow immediate writing, demonstrate optional planning, and explain the Codex with an example. Reveal advanced controls on demand. Keep prompt presets editable and preserve recently used actions without pushing suggestions into the author's work unrequested.

Use direct task labels in implementation, such as Review changes and Plan manuscript; the demo's literary headings are exploratory copy. Keep one clear primary action for the current task. Make rename, move, and recovery available without requiring a command palette. Explain unavailable AI/format actions in nearby text and preserve a useful ordinary-writing path. Avoid mandatory setup of POV, a story bible, or goals before the first paragraph.

Cover first-use, empty, loading, read-only, failed save, missing profile/quota, interrupted generation, stale target, stale summary, storage unavailable, and unsupported import/export states. Show meaningful job progress without inventing percentages. Provide real completion results and next steps. Goals/statistics are optional author aids; no word-count, acceptance-rate, or critique score is a measure of literary quality.

## UX acceptance study

Run moderated tasks with a discovery writer, an outline-first writer, an editor, and a writer using assistive technology. Tasks: start/import, move/split a scene, ask a story question, revise one paragraph, review a batch, recover an outage draft, and export. Measure completion, mistaken acceptance, lost position, confusion about save/context states, correction effort, and perceived control. Findings should influence the layout before expanding command density.

Include English and Spanish labels/manuscripts, longer translations, and a phone session with its actual on-screen keyboard. Ask participants to explain where a change will land, what the assistant can see, and whether the displayed text is saved on device or to the account. Retain observed assistance, accidental commits, recovery mistakes, and lost drafts/caret/composer input; any observed lost writing or unintended commit blocks that workflow's release. Set usefulness and efficiency thresholds after the pilot rather than inventing success rates from the demo.

Implementation sequence and accountable areas are in [11](11_refactor_and_migration_plan.md#uiux-delivery-workstream); UX-01–UX-12 have explicit acceptance tasks in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix). A production change needs both its relevant UI evidence and the underlying document/AI contract evidence. Screenshot approval, a static HTML example, and an application build do not complete these gates.
