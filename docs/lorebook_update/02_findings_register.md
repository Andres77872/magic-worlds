# Findings register

All findings are open at the reviewed baseline. P1 means address before depending on the affected flow for reliable use; P2 means a material correctness, usability, compatibility, or scale problem. These are engineering priorities, not CVSS scores or production incident declarations.

Evidence classes: R = local reproduction; S = source-supported; G = product/semantics gap; I = inferred consequence. See [scope](01_scope_and_current_behavior.md).

## Summary

| ID | Priority | Finding | Evidence |
|---|---|---|---|
| F01 | P1 | History scanning and recursive depth are conflated | R/S/G |
| F02 | P1 | Resource preview and snapshot wire contracts disagree | R/S |
| F03 | P1 | Combined-book budget, recursion, and selection depend on implicit ordering | R/S/G |
| F04 | P1 | Constant secrets bypass reveal checks; reveal state is text-only | R/S/G |
| F05 | P1 | Regex is unbounded and differs across engines | R/S |
| F06 | P1 | Resource operations and save responses can overwrite local edits | S |
| F07 | P1 | Resource activation omits its permission key | R/S |
| F08 | P2 | Word-based token estimates do not bound actual model input | R/S |
| F09 | P2 | Placement options do not map to actual context locations | S |
| F10 | P2 | Book matching defaults do not meaningfully configure entries | R/S |
| F11 | P2 | Secondary-key labels describe different logic | R/S |
| F12 | P2 | Session displays and markers do not represent effective lore | S |
| F13 | P2 | Backend preview can become stale and hides skip reasons | S |
| F14 | P2 | Whole-word boundaries mis-handle accented text | R/S |
| F15 | P2 | Ordinary saves lack stale-edit conflict protection | S |
| F16 | P2 | Story Studio copying drops conditional lore semantics | S/G |
| F17 | P2 | Full aggregate loading creates query and payload growth | S/I |

## F01 — History scanning and recursive depth are conflated

**Observed:** load_lorebook_context passes only the latest user input to activation. The engine joins every supplied message without a history window. It uses scanDepth to choose recursive passes.

**Example:** after discussing the Glass Market, “Tell me more” does not trigger its keyword entry again. This means the entry stops being injected; it does not prove the model forgets facts already present in chat history. In a direct probe, depth 1 still matched a key from an older supplied message.

**Impact:** authors cannot use the visible depth control to maintain recent-scene context. Follow-ups and assistant-introduced entities need explicit support.

**Recommendation:** separate recent-message depth from maximum recursion passes. Decide roles, edited/deleted turns, branch behavior, and whether participant names are matching input. The older reference already documents latest-message behavior; expanding it is an explicit policy change, not a hidden regression fix.

**Closure:** history-window fixtures and runtime/preview equivalence pass under a named policy version.

Evidence: [loader](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_loader.py#L242), [message joining and pass selection](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L481).

## F02 — Resource preview and snapshot wire contracts disagree

**Observed:** metadataWire serializes embedded sources without server-owned extraction fields and omits sharedResources. Backend activation and stored snapshot validation require the full validated resource shape. The override route does not hydrate it.

**Reproduced:** embedded-resource preview returns 422 with “Lorebook resource violates the valid fields”; snapshot model validation rejects that resource shape. A shared-only book serializes zero resources, so its preview/snapshot omits the linked lore.

**Impact:** local and backend previews disagree; frozen books cannot reliably carry resource-derived lore. The local-preview fallback can make the feature appear usable while server validation fails.

**Recommendation:** separate source-write, draft-preview, and immutable-snapshot DTOs. Hydrate owned extraction results server-side. Explicitly freeze linked resource versions in snapshots; do not accept client claims of authoritative extraction.

**Closure:** embedded/shared resource fixtures round-trip through the actual serializers, route models, snapshot validation, and activation with no loss. New/unsaved entry identities also need a valid preview contract.

Evidence: [metadata/snapshot serialization](../../src/infrastructure/api/lorebookWire.ts#L53), [override route](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebooks.py#L709), [snapshot validator](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L15250).

## F03 — Combined-book policy depends on implicit ordering

**Observed:** the first eligible book supplies the total budget; the largest depth supplies pass count; any recursive book enables recursion across all candidates. Budget admission iterates candidates before final prompt sorting.

**Reproduced:** reversing a 100-budget book and a 1,000-budget book changes the combined limit from 100 to 1,000. An entry in a non-recursive book activates from another book's inserted text. A high-priority candidate can lose budget when a lower-priority candidate is supplied first.

**Qualification:** persisted entries are already sorted by insertion order, then priority for ties. Priority is not completely unused. It does not establish global selection priority across books, and a draft preview array can differ from persisted ordering.

**Additional collision:** activation identity uses book ID plus entry ID. Linked and snapshot variants of the same original identities can suppress one another without an explicit revision/attachment precedence policy.

**Impact:** unrelated attachment updates can change included lore; authors cannot reason about independent book limits.

**Recommendation:** decide a conversation ceiling, per-book cap semantics, selection ranking, source precedence, and recursion scope before implementation.

**Closure:** reorder-invariance tests pass except where an explicit user-controlled precedence intentionally changes the outcome.

Evidence: [budget and recursion](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L507), [candidate admission](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L524), [attachment ordering/hydration](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L17680).

## F04 — Secret/reveal behavior is not dependable

**Observed:** constant mode returns active before reveal evaluation. Non-constant reveal conditions are substring matches, not persistent session state. Missing reveal text is a warning and does not prohibit activation.

**Reproduced:** a constant secret activates on “hello” without its quest_complete reveal text.

**Related gap:** resource-generated entries set isSecret=false although extraction is asked to preserve secrets. No per-character knowledge or player/narrator audience model is carried into those candidates.

**Impact:** unwanted spoilers and misleading author expectations. This is not proof of cross-owner disclosure or a security boundary between owners.

**Recommendation:** evaluate disclosure eligibility independently of activation mode. Decide the behavior of incomplete secret configuration, explicit reveal state, narrator-only reference, and imported material.

**Closure:** constant, keyword, recursive, resource, preview, and copied-reference paths obey the chosen audience/reveal policy.

Evidence: [matching and reveal](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L344), [generated defaults](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L243), [extraction instructions](../../../../PycharmProjects/magic-worlds-api/src/agent_graphs/runtime/lorebook_resource_extraction.v2.json).

## F05 — Regex execution is unbounded and incompatible

**Observed:** frontend RegExp and Python re execute user patterns synchronously with no per-match deadline. Syntax acceptance differs between those engines.

**Reproduced:** the pattern (a+)+$ against 32 “a” characters and a trailing exclamation mark exceeded 0.5 seconds in each isolated subprocess; both children were terminated. A JavaScript named group matched in the frontend and was rejected by backend activation.

**Impact:** browser stalls and backend worker blocking are credible consequences. No live service was stressed, and the probe does not measure production duration or capacity.

**Recommendation:** define a supported common dialect with bounded execution, server-side validation, limits on pattern/input/candidate size, and explainable rejection. A browser worker improves responsiveness but does not solve server exhaustion.

**Closure:** hostile-pattern tests run in killable children, valid shared-dialect fixtures agree, and one invalid entry cannot cause an unexplained session-wide failure.

Evidence: [Python matching](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L317), [JavaScript matching](../../src/features/lorebook/loreTriggers.ts#L54).

## F06 — Local edits can be overwritten by responses

**Observed:** shared-resource attach/detach returns a server book which replaces the whole local draft. A save response also replaces the draft while most fields remain editable during the request.

**Example:** edit an entry without saving, attach a library resource, and receive an older server entry list. The replacement can discard the local text. During a slow save, later keystrokes can similarly be replaced by the captured save response.

**Impact:** author content loss in routine editing. This is source-supported; a full browser reproduction was not performed.

**Recommendation:** merge resource-only changes into the current draft; track an edit generation/base revision; preserve changes after request dispatch. Add recoverable dirty state and navigation protection with explicit save status.

**Closure:** component tests with delayed promises preserve intervening edits across save, extraction, attach/detach, navigation, and recoverable failures.

Evidence: [save response](../../src/features/lorebook/components/LorebookStudio.tsx#L270), [resource application](../../src/features/lorebook/components/LorebookStudio.tsx#L312), [picker callback](../../src/features/lorebook/components/LorebookResourcePickerDrawer.tsx#L62).

## F07 — Resource permission key is omitted at activation

**Observed:** the runtime loader checks book.get("resources"), but embedded/shared resources are nested under metadata.

**Reproduced:** a resource snippet activated while the authorization function received only the lorebooks key, omitting lorebookResources.

**Impact:** runtime use and frontend availability can disagree with membership-grant enforcement. The probe establishes the missing authorization request, not unauthorized access to another owner's data.

**Recommendation:** derive permissions from actual hydrated candidates and enforce them consistently for generation, previews, snapshots, extraction, and imports. Decide how an already attached optional feature behaves after its grant is revoked.

**Closure:** non-root permission combinations and grant revocation pass the full use matrix; root exemptions remain intentional.

Evidence: [loader permission check](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_loader.py#L237), [permission service](../../../../PycharmProjects/magic-worlds-api/src/services/feature_flags/scope.py#L77).

## F08 — Token estimates are not effective model bounds

**Observed:** estimate_tokens counts whitespace-separated words times 1.35. It does not use model tokenization or account for the complete serialized prompt.

**Reproduced:** 5,000 unspaced Chinese characters estimate to 2 tokens.

**Impact:** multilingual, punctuation-heavy, or compact source text can substantially exceed an intended allowance. Larger-than-intended provider input is an inferred consequence, not a measured bill.

**Recommendation:** use a tokenizer compatible with the selected model where possible; label and conservatively bound fallback estimates. Reserve history, static instructions, formatting, tools, and output space.

**Closure:** multilingual token fixtures, final-packet accounting, and minimum-output reserves pass.

Evidence: [backend estimate](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L168), [frontend estimate](../../src/features/lorebook/lorebookTransforms.ts#L222).

## F09 — Placement choices are not real insertion slots

**Observed:** placement sorts selected entry text inside one concatenated fragment; append_prompt_fragment appends it to the system prompt. It does not create an author's-note slot or place lore after recent messages.

**Impact:** authors cannot obtain the influence/location described by the placement labels.

**Recommendation:** either implement true placement in the prompt assembler or restrict and rename the current controls. Preserve a disclosed compatibility mapping for stored values.

**Closure:** final message/fragment capture proves the selected placement, not merely sorted preview text.

Evidence: [prompt rendering](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L574), [append behavior](../../../../PycharmProjects/magic-worlds-api/src/services/system_prompts.py#L543), [labels](../../src/app/i18n/locales/en.ts#L603).

## F10 — Book matching defaults do not configure entries

**Observed:** persisted and newly created entries have explicit case/whole-word flags. New entry defaults do not copy the book's selected defaults; runtime evaluates entry flags.

**Reproduced:** a case-sensitive book still matched lowercase input through the entry's default case-insensitive flag.

**Impact:** book controls appear ineffective even for new entries.

**Recommendation:** choose nullable/inherit overrides or copy defaults at creation and explain existing-entry overrides. Do not silently rewrite existing explicit author choices.

**Closure:** new entry, inherited override, explicit override, import, resource, and saved reload fixtures agree.

Evidence: [draft defaults](../../src/features/lorebook/lorebookTransforms.ts#L111), [runtime entry flags](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L350).

## F11 — Selective-logic labels are incorrect

**Observed:** “Any secondary key” maps to primary-any; “All secondary keys” maps to primary-all. The explicit and_any/and_all modes do evaluate secondaries.

**Reproduced:** an all-mode entry with one primary key activated without its secondary key.

**Impact:** conditional lore can appear when authors believe a secondary requirement protects it.

**Recommendation:** align both languages, descriptions, assistant instructions, and the enum truth table. Rename primary-only modes rather than silently reinterpreting saved enums.

**Closure:** all six modes have a shared truth-table fixture used by backend, frontend, and copy review.

Evidence: [English labels](../../src/app/i18n/locales/en.ts#L577), [evaluation](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L364), [copy catalog](../../src/features/lorebook/lorebookCopy.ts).

## F12 — Session views do not represent effective lore

**Observed:** generation resolves inherited/global books; session panels and inline matchers list direct session links. Attachment changes do not directly invalidate the matcher's independently loaded list. The panel renders snapshots as linked and opens a live cached book.

**Impact:** “no lorebooks attached,” a highlight, or a linked badge cannot reliably explain what informed a reply. Frozen content may be shown as current library content.

**Recommendation:** share a server-resolved effective attachment projection with scope, mode, revision, and inheritance. Keep lexical mentions distinct from actual activation.

**Closure:** global/character/world/template/session inheritance, immediate attach/detach, snapshot identity, non-selected workspace reads, and error/retry states pass.

Evidence: [runtime targets](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L572), [matcher loading](../../src/features/lorebook/hooks/useSessionLorebookEntries.ts#L63), [panel rendering](../../src/features/lorebook/components/SessionLorebookPanel.tsx#L244).

## F13 — Backend preview becomes stale and hides reasons

**Observed:** after source becomes backend, editing sample/book inputs does not refresh or invalidate the preview. A skipped result with matched keys renders the keys instead of its budget/reveal reason.

**Impact:** the displayed backend trace can refer to old input; users cannot diagnose a matching entry that was excluded.

**Recommendation:** bind results to an input fingerprint; visibly invalidate them; reject late responses for old fingerprints; always show structured skip reasons.

**Closure:** delayed responses, changed drafts/samples, errors, and reasons with matched keys are covered.

Evidence: [preview effect](../../src/features/lorebook/components/ActivationPreviewPanel.tsx#L41), [reason branch](../../src/features/lorebook/components/ActivationPreviewPanel.tsx#L147).

## F14 — Whole-word matching fails on accented words

**Observed/reproduced:** the key sol matches within Spanish solía with whole-word mode enabled because boundaries use only ASCII letters/digits/underscore.

**Impact:** false activations in a supported language, with avoidable context noise.

**Recommendation:** decide Unicode normalization/case handling and language-appropriate boundary semantics; keep identical fixtures across engines. Regex dialect changes must not silently change literal keys.

**Closure:** accented Latin, combining marks, apostrophes, punctuation, emoji boundaries, and unspaced-language policies are covered.

Evidence: [backend boundary](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L326), [frontend boundary](../../src/features/lorebook/loreTriggers.ts#L67).

## F15 — Ordinary saves do not detect stale editing intent

**Observed:** standard book updates carry no expected revision/hash and can replace all entries. Locks serialize writes but do not establish that the client edited the current version.

**Impact:** a stale tab can replace newer manual or assistant work.

**Recommendation:** add compare-and-swap to book, entry, and resource-mutating operations; preserve the rejected draft and offer comparison/recovery. Reuse existing assistant/Story Studio concurrency patterns.

**Closure:** two-client save, save-versus-assistant, and save-versus-resource race tests reject stale writes without content loss.

Evidence: [update DTO](../../../../PycharmProjects/magic-worlds-api/src/routes/lorebooks.py#L231), [update persistence](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L16153), [existing content-stamp pattern](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/story_lorebook_entry_store.py#L54).

## F16 — Story Studio copies change lore semantics

**Observed:** copies retain identity/title/content/source, not keys, selective logic, secret/reveal flags, or entry budgets. Reconstruction uses generic defaults including isSecret=false and can fall back to the entry name as a key.

**Impact:** an author may expect conditional lore but gets an explicitly selected scene reference.

**Qualification:** copied references can be a valid product design. The gap is unclear conversion semantics and loss of disclosure metadata, not proof that Story Studio must use live chat activation.

**Recommendation:** name the copy mode and explain what survives; decide audience preservation and whether a second conditional mode is needed.

**Closure:** copy/reload/source-change tests and user-facing explanations match the accepted mode.

Evidence: [copy format](../../src/features/codex/utils/codexUtils.ts#L70), [generic reconstruction](../../src/features/codex/utils/snapshotPreview.ts#L34), [scene inclusion](../../../../PycharmProjects/magic-worlds-api/src/routes/stories.py#L645).

## F17 — Aggregate loading grows with library size

**Observed:** list_all hydrates entries, attachments, and resources for every book. DataProvider loads every page into its cache. Runtime target loading hydrates linked books individually.

**Impact:** many sequential queries and large source-text payloads are plausible bottlenecks. No production latency or memory benchmark was performed.

**Recommendation:** summary DTOs for gallery/pickers, batched activation reads, lazy source loading, and revision-aware caching. Preserve snapshot isolation and permission context.

**Closure:** measured query counts, bytes, memory, and latency at agreed library sizes meet an approved budget without scope/freshness regressions.

Evidence: [aggregate hydration](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L15837), [list loop](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py#L16029), [all-page preload](../../src/app/providers/DataProvider.tsx#L1433).
