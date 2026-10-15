# User experience and workflows

**Status:** proposed product behavior, 2026-10-15. No UI implementation or styling changes are included.

## Main-page controls

Keep the current conversation rail, knowledge panel, focus shelf, model selector, composer, and record previews. Add a compact capability/target area near the composer:

- Ask or Edit selected mode.
- One visible editing target, or a New character/world/item/adventure/lorebook destination.
- A short availability reason when a tool family is disabled.
- Clear wording that ordinary authorized edits save to the selected document.
- A Toolsets section with a tools master and separate guide/card-read/card-edit/lorebook-read/lorebook-edit/resource-read/novel-read switches, applying only to this assistant.

The target selector reuses existing library/focus selection patterns; it is not another independent record-browser implementation. Focus can still contain up to six reading references, but the editing target is singular and visibly distinct.

Keep toolsets separate from source switches. Disabling an editing toolset retains eligible reading; disabling all tools still permits answers from supplied context. Show dependency/unavailable reasons and persist the user's app/workspace choices. The full behavior and defaults are in [14](14_toolset_controls.md).

Do not expose runtime terms such as CAS, graph nodes, request fingerprints, provider schemas, or admission leases in the ordinary flow. Show “This record changed elsewhere” and the available comparison/reload action.

## Capability states

| State | UI behavior |
| --- | --- |
| Signed out | Existing sign-in state; no private retrieval or tools |
| Main assistant disabled | Existing unavailable/recheck state; do not mount a misleading model request |
| Ask available, tools unsupported by selected profile | Allow text answers; explain why editing is unavailable |
| Source disabled | Exclude its tool family and outgoing focus detail; show how the user can enable it |
| Tools master off | Tool-free answers remain; no preparation, lookup, or mutation tool executes |
| Editing toolset off | Selected-family editing unavailable; eligible reading and editor assistants remain independent |
| Readable target, no edit authority | Permit eligible answer/preview; no write action |
| Edit target selected and eligible | Expose its allowed document operations and writable scope |
| Archived workspace | History/result viewing; no fresh editing request |
| Active run | Freeze source/toolset/target controls; Stop remains available |
| Stale target | Preserve the user's task, show conflict, and require a fresh comparison/request |

Source switches should describe future data access accurately. Suggested copy must be checked against the final retention policy; do not preserve the existing promise that all context is discarded.

## Action presentation

Show an action card based on a committed server receipt:

- Record name/type and destination.
- Outcome: saved, no change, conflicted, unavailable, or stopped before save.
- Changed fields, with readable labels.
- A record preview/editor link.
- An explicit warning if the action saved but later narrative generation failed.

Before commit, status can say “Preparing changes” or “Saving.” A streamed phrase saying “I updated it” is not rendered as a completed save.

Reuse shared action/change formatting where possible. Open previews over the thread, and preserve editor handoff. An action log belongs to the conversation; users should not find unexpected hidden editor conversations for each operation.

## Workflow 1: answer about a feature

User asks where resources are attached. Ask mode uses the selected guide or guide search, answers with permitted internal routes, and performs no mutation. If guide access is unavailable, state the limit instead of inventing steps.

Success: useful navigation, valid enabled links, no document write or unnecessary confirmation.

## Workflow 2: improve one saved character

The user selects Mira as the editing target and asks for a more distinctive greeting. Library is enabled and the profile supports tools.

The host prepares Mira's current editable server snapshot, narrows the field grant to greeting, and exposes the existing card patch/no-change tools. After shared validation/CAS/commit, the action card identifies Mira and the changed greeting.

No extra approval is needed for this already authorized bounded edit. If another tab changed Mira meanwhile, show the conflict rather than overwriting it.

## Workflow 3: create a new world

The user chooses New world, an authorized workspace/destination, and supplies a creative brief. The host exposes the existing world-specialized replace/no-change tools. Creation uses the shared command and returns one saved identity plus organization warnings if applicable.

Retry or a lost final event reuses the receipt. It must not create a second world. An empty library is valid; a disabled library source is not.

## Workflow 4: improve lorebook activation

The user selects one lorebook and asks to tighten activation keys while preserving content. The host reads its complete editable snapshot and allowed scope, then uses the shared lorebook patch tool.

The current entries-list replacement semantics and entry-ID behavior must be accounted for by the shared domain plan. If the proposed operation cannot preserve required identity/content constraints, present a reviewable result or keep the operation unavailable until the shared identity-preserving extension exists.

Do not silently delete entries, rewrite unrelated lore, or attach resources. A read-only audit is an answer, not a mandatory new “audit” mutation tool.

## Workflow 5: compare content across sources

The user asks whether a character's backstory conflicts with a selected lorebook. In Ask, search/read permitted sources, cite supporting passages, and distinguish contradictions from creative alternatives.

Suggest a target edit if helpful. Switching to an authorized selected target can apply that edit with the existing document tools. The comparison itself grants no write permission to either record.

## Workflow 6: ambiguous reference

The user says “change Alex” and two records match, or several focus pins are present. Show a short candidate chooser with type/workspace context. Do not choose the first search result and save it.

Once selected, continue with the original task and a new request-bound target grant. Do not require the user to repeat their brief.

## Workflow 7: source disabled

The user asks for a lorebook change while lorebooks are disabled for the run. Explain that the source needs enabling. The model cannot enable it or use an old focus pin to circumvent the switch.

If the product/server capability itself is off, offer only genuinely available navigation. Do not imply that changing a source checkbox can enable a server-disabled assistant.

## Workflow 8: broad or multi-document request

“Rewrite all my worlds and synchronize every lorebook” exceeds the first release. The assistant can analyze eligible content and propose a plan. It should identify the one-target limit and let the user choose a bounded next task.

A later multi-document feature requires an explicit changeset/dependency/review/recovery contract. Do not approximate it with an unbounded sequence of current direct-save tools.

## Workflow 9: unsaved editor in another tab

The main page reads saved server content, not the other tab's unsaved form. Explain this when it affects the task. A main-page save invalidates shared lists; the dirty editor is warned and keeps its local text until the user resolves it.

## Review policy

Ask no confirmation for ordinary reads. Do not repeat approval for an ordinary bounded edit already covered by the visible mode, target, and request. Ask for missing target/scope or show a concrete review for broad destructive replacement and unsupported side effects.

The proposal does not add deletion, publishing, billing, account, or workspace-management actions. Their eventual authorization policy belongs to their own features.

Keyboard and screen-reader behavior, narrow-screen drawers, loading/error focus, and preserved composer input need acceptance alongside the existing design-system components. EN and ES must express the same authority and retention boundaries.
