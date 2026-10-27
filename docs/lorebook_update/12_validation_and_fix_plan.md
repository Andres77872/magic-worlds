# 12 — Validation and fix plan

**Validated:** 2026-10-26 against frontend `77174215` and magic-worlds-api `2fb958d`.
**Status:** every finding re-checked against current source; no application code changed. This file supersedes the priorities in [02](02_findings_register.md)/[03](03_impact_and_priorities.md) and replaces the work-package order in [07](07_implementation_plan.md) with a PR-sized plan.

No lorebook code changed in either repo between the audit (2026-10-19) and this validation, so all 17 findings were still live. Each one was re-derived from source and, where possible, reproduced by running the real backend functions/routes (DB faked) or delayed-promise component tests against the real React components. Probe scripts were kept out of the repos; the fixtures and outputs needed to turn them into regression tests are quoted below.

## Verdicts

| ID | Finding | Verdict | Audit → now | Fix size | Blocking decision |
|---|---|---|---|---|---|
| F05 | Unbounded / incompatible regex | **Confirmed, worse** | P1 → **P0** | S | none |
| F06 | Responses overwrite local edits | **Confirmed, broader** | P1 → P1 | M | minor (assistant: stage vs apply) |
| F11 | Selective-logic labels are wrong | **Confirmed** | P2 → **P1** | S | none |
| F01 | History depth vs recursion conflated | **Confirmed, worse** | P1 → P1 | M | D01 |
| F03 | Multi-book budget/recursion depends on order | **Confirmed** | P1 → P1 | M | D02 |
| F04 | Secret/reveal not dependable | **Removed 2026-10-26** (constant, secret and reveal deleted) | — | done | — |
| F02 | Resource preview/snapshot contracts disagree | **Confirmed, broader** | P1 → P2 | S (min) / M | D03 (small) |
| F16 | Story Studio copies drop lore semantics | **Confirmed, worse** | P2 → P2 | S (min) / M | D09 |
| F15 | No stale-write protection | **Confirmed** | P2 → P2 | M | D04 (conflict UX) |
| F12 | Session views ≠ effective lore | **Confirmed** (all 4 parts) | P2 → P2 | S (min) / M | small |
| F13 | Backend preview stale, hides reasons | **Confirmed** | P2 → P2 | S | none |
| F10 | Book matching defaults do nothing | **Confirmed** | P2 → P2 | S | none |
| F14 | Whole-word fails on accented text | **Confirmed** | P2 → P2 | S | none |
| F09 | Placement is not a real slot | **Confirmed** | P2 → P2 copy / P3 slots | S copy / M–L slots | D07 |
| F17 | Aggregate loading grows with library | **Confirmed** | P2 → P2 | M | none |
| F08 | Word-count token estimate | **Confirmed, narrower** | P2 → P3 | S | none |
| F07 | Resource grant key never requested | **Confirmed, narrower** | P1 → P3 | S | D08 |

No finding was a false positive. Re-ratings reflect who actually hits the bug and what they lose, not whether the code is wrong.

New issues found during validation (N1–N8) are listed [below](#new-issues); N1 and N2 change how F05 and F07 must be fixed.

## Evidence per finding

### F05 — Regex: P0 (availability)

- `_matches_key` runs user patterns with stdlib `re.search`, no limit (`magic-worlds-api/src/services/lorebook_activation.py:324`).
- It runs **synchronously on the asyncio event loop**: `load_lorebook_context` is `async` and calls `build_activation_response` directly (`lorebook_loader.py:242`); `preview_lore_activation` is an `async def` route doing the same (`routes/lorebooks.py:710` → `:415`). The preview route accepts a client-supplied draft book, so a pattern does not even have to be saved.
- Probe: `(a+)+$` on 32×`a` + `!` was still running after 2 s and had to be killed. Stdlib `re` holds the GIL while matching, so moving the call to a thread does **not** contain it — the whole worker process stalls for every user.
- Anyone with the `lorebooks` grant (the seeded Free plan has it) can freeze an API worker with one request.
- Dialect: a JS-only pattern such as `(?<name>dragon)` is accepted by the frontend and raises `ValueError` in the backend. See N2 for why that breaks chat.
- Fix lever already in the dependency tree: `regex==2026.9.29` is in `requirements.txt`. Probe: `regex.search("(a|aa)+$", "a"*40+"!", timeout=0.1)` raised `TimeoutError` after 0.100 s. The `regex` module also accepts `(?<name>…)` and `\p{L}`, which removes most of the JS/Python syntax gap.
- Frontend (`src/features/lorebook/loreTriggers.ts:62`) compiles the same patterns for inline chat highlights, the textarea highlighter and local preview. A bad pattern can only stall the author's own tab: P3.

### F06 — Lost edits: P1

Every server or assistant response replaces the whole draft (`LorebookStudio.tsx`). Fields stay editable during requests; only the Save button is disabled (`:352`); the fieldsets only disable on `readOnly`.

| Path | Code | Reproduced |
|---|---|---|
| Save | `setDraft(savedLorebook)` unconditionally (`:275`) | typed "v2" + rename during save → reverted to "v1" |
| Resource extraction after save | `setDraft(savedLorebook)` per LLM step (`:289`) | text typed during extraction reverted — longest window, no warning |
| Shared resource attach / detach | `applyResourceLorebook` (`:312`, `:327`) | unsaved entry edits and unsaved embedded resources lost |
| Assistant final event | `applyAssistantLorebook` (`:303`) | edits typed while the reply streamed wiped |

There is no dirty state and no leave-page guard. New entries carry `draft-entry-*` ids that the serializer drops, so a response cannot be merged back by id today. No product decision is required, except whether an assistant result that arrives after user edits is staged for review (recommended) or applied.

### F11 — Selective logic: P1

Runtime (`lorebook_activation.py:364–375`): `any` = any **primary** key; `all` = every **primary** key; secondaries are ignored in both. Labels (`en.ts:578–585`, `es.ts` equivalent): "Any secondary key — any matching secondary key is enough when some are set" and "All secondary keys — … only when every secondary key also matches".

Probe, entry with keys `["sword"]`, secondaries `["cursed"]`, text "a sword": `all` → activated, `any` → activated, `and_all` → skipped.

`any` is the default for new entries (`lorebookTransforms.ts:118`). Any author who fills in Secondary keys without changing the mode gets a gate that silently does nothing. The lorebook assistant's graph has the enum but no explanation of it.

### F01 — History window: P1

The loader passes only `[{"role": "user", "content": user_input}]` (`lorebook_loader.py:246`). `scanDepth` is used only as the recursion pass count, and only when recursion is on (`lorebook_activation.py:511–517`).

Default books are `scanDepth: 8, recursiveScanning: false` (`lorebookTransforms.ts:92`), so for a default book the Scan depth control **has no effect at all**. Probe: "Take me to the Glass Market" activates the entry; the follow-up "Tell me more" skips it. Entities introduced by the narrator never trigger lore, because assistant turns are never scanned.

Implementation constraint: `prepare_context()` (which builds the lore) runs before the session lock that loads history (`conversation_execution.py:135` vs `:168`), so the fix needs its own read of recent messages.

### F03 — Multi-book policy: P1

| Behavior | Code | Probe |
|---|---|---|
| First eligible book's `tokenBudget` is the budget for all books | `:508` | `[small(100), big(1000)]` → budget 100, every entry skipped; reversed → 1000 |
| Budget admitted in candidate order, not priority | `:527–549` | priority −100 entry activated, priority +100 entry skipped "budget exhausted" |
| Any recursive book turns recursion on for all books | `:516` | entry in a `recursiveScanning: false` book activated from another book's lore |

Global + character + world books attached together is the normal case, so a small global book can silently starve every other book.

### F04 — Secrets: removed 2026-10-26

**Resolved by removal, not by fixing.** Constant mode, the Secret flag and the reveal condition were deleted from both activation engines, the API models, the DB layer, the lorebook assistant's tool schema and the editor. Entries now activate only by their keys, and nothing is matched against chat text to unlock lore. Old snapshots and drafts that still carry `constant`, `isSecret` or `revealCondition` are read with those fields dropped. The `lorebook_entry` columns `constant_entry`, `is_secret` and `reveal_condition` are unused and stay until the live databases drop them. The evidence below is why the features were removed.

| Behavior | Code | Probe |
|---|---|---|
| `constant` returns before the reveal check | `:347` | constant secret active on "hello" |
| Reveal = literal substring of the *current user message* | `:380` | secret only active on the one turn that contains the phrase |
| Reveal can be satisfied by another entry's lore during recursion | `:572` | lore text containing `quest_complete` unlocked the secret |
| Secret with empty reveal behaves like a normal entry | `:379` | active |
| Asking about the secret unlocks it | `:380` | reveal `pact`, player says "is there some pact?" → active |
| Reveal is not whole-word | `:380` (`whole_words=False`) | reveal `pact` matched "impact" → active |
| No reveal memory: unlocks for one turn, re-locks the next | stateless engine, nothing persisted | "tell me more about that" → skipped |
| A plain (non-secret) constant can be dropped by the budget, despite "Always include" | `:548`, candidate order | keyword entry first used ~945 of 1200 → constant skipped, "budget exhausted" |

Re-probed 2026-10-26 (`scratchpad/secrets/probe.py`). The frontend engine (`lorebookTransforms.ts:272–318`) has the same order and the same substring check, so the editor preview agrees with chat and doesn't surface the problem. The lorebook assistant's tool schema (`lorebook_assistant.v2.json`) gives `revealCondition` no description, so AI-written entries also get sentence-style reveals. Validation warns about a secret with no reveal, but not about `constant` + `isSecret`.

The UI placeholder for Reveal condition is "Reveal after the pact is discovered" (`en.ts:398`). Because the check is a literal substring, a natural-language condition like that **never** matches, so keyword secrets written the way the UI suggests are dead lore. The Secret switch describes itself as "Mark sensitive lore for editor-only review" (`en.ts:444`) and says nothing about the model. Resource-generated entries are always `isSecret: false` (`:265`).

### F02 — Resource preview/snapshot: P2 (P1 if snapshot mode is a launch feature)

The backend contradicts itself: preview overrides and snapshot bodies use `LorebookMetadataPayload` (7 source fields, `extra=forbid`, `routes/lorebooks.py:143`), but activation and `_validate_snapshot` require the 14-field stored shape (`lorebook_activation.py:201`, `models.py:15610`). **No non-empty embedded resource list can pass**, whatever the client sends.

Real routes, real serializer output:

```text
embedded resource   preview  → 422 "Lorebook resource violates the valid fields" (UI flips to Local and shows resource lore the server never confirmed)
embedded resource   snapshot → uncaught ValueError → HTTP 500
shared-only book    preview  → 200, resource lore silently missing
shared-only book    snapshot → passes with resources=[]; linked lore silently dropped although the UI says "Frozen at attach time"
unsaved entry/book  preview  → 422 "Field required" entries.0.id
```

Save works because it runs `prepare_lorebook_resources_for_save`; preview and snapshot skip it. Snapshot attach is built from the client's unsaved `draft` (`LorebookAttachPanel.tsx:103`). Normal linked-attachment chat is unaffected.

### F16 — Story Studio: P2, worse than "semantics only"

The copy keeps only `id`, `name`, `content`, `source_lorebook_id` (`routes/stories.py:425`). Keys, logic, `isSecret`, `revealCondition`, `constant`, budget and placement are dropped.

The picker **pre-selects every enabled entry, secrets included** (`CodexLorebookPickerDrawer.tsx:106`) and shows no secret badge. Probe: a secret gated on `and_all` + reveal condition is `included: true` in the scene trace, and the writer prompt contains its text although the scene mentions none of its keys. A novel-scope copy reaches every scene.

The Story assistant meanwhile excludes all lore copies as `reveal_unverified` (`story_assistant_context.py:212`), so writer and assistant follow opposite policies. Edits to title/content are detected for review; edits to keys or the secret flag are not.

Since 2026-10-26 there are no secret entries, so the secret part of F16 and N4 no longer applies. The dropped-semantics part still does.

### F15 — Stale saves: P2

The update DTO has no revision field (`expectedRevision`/`updatedAt` → 422 `extra_forbidden`). `LorebookModel.update` locks the row, compares nothing, and runs `DELETE FROM lorebook_entry` then re-inserts every entry (SQL trace confirmed). Entry delete hits the server immediately, outside Save, also without CAS.

The assistant and Story Studio write-back do use CAS, so they cannot clobber the Studio — but a stale Studio save silently erases their work. `updated_at` cannot serve as the revision: it has second precision and entry CRUD/resource-link changes don't bump it.

### F12 — Session views: P2

- Inheritance: generation resolves session + template + world + character + global links. The panel and matcher list only exact-target links, so a global book (the attach panel's default) shows "no lorebooks attached" while active. Per-reply `lorebook_activation` metadata is never read by the frontend.
- Stale matcher: after attach/detach the inline matcher kept the old list (reproduced; adventure only).
- Snapshot shown as "Linked" with live name/description; a snapshot whose live book is gone renders "Unavailable lorebook · Linked" yet still triggers.
- Clicking a snapshot opens the live book.

### F13 — Preview: P2

- After a backend run, edits to the sample or book leave the result badged "Backend" with the old status.
- Edits made while a request is loading are overwritten by the old response. Reproduced: "Activated" shown next to the sample "no match at all".
- A skipped result with matched keys shows only key chips; the reason ("Lorebook token budget exhausted.") is hidden (`ActivationPreviewPanel.tsx:147`).
- Reasons are hard-coded English from both engines, so they are not localized; `and_any`/`not_*` say "No key matched" even when keys matched.
- The Studio claims "Activation previews use the same retrieval rules as live chat, so what activates here activates in play" (`en.ts:458`, es). That is false today because of F01, F02 and F03 (N3).

### F10 — Book defaults: P2

The book-level "Whole-word matching" and "Case sensitivity" toggles never reach runtime. `blankEntryDraft` hard-codes `caseSensitive: false, matchWholeWords: true` (`lorebookTransforms.ts:121`), and the engine reads only entry flags. Probe: a case-sensitive book matched "vel" for key "Vel".

### F14 — Unicode boundaries: P2

Both engines use `[A-Za-z0-9_]` as the word class (`lorebook_activation.py:326`, `loreTriggers.ts:68`). Probe: `sol` matches "Ella solía", `Ana` matches "Anaís". Spanish is a supported locale. Probe: `(?<!\w)sol(?!\w)` correctly rejects "solía".

### F09 — Placement: P2 copy / P3 real slots

All four positions only sort entries inside one block that is appended after the card context in system message [0]. History follows; none of the history messages carry lore (probe: adventure, character, voice call).

The copy is wrong in three places (`en.ts:603–620`, `es.ts:613–629`):

- "Before context" actually lands after the card context.
- "After context — closer to the latest messages" is still above the whole history.
- "Author's note slot" does not exist, and `POSITION_ORDER` sorts `author_note` *before* `after_context`.

### F17 — Scale: P2 (chat path P3 except voice)

| Path | Cost |
|---|---|
| `list_all` | 2 + 3N queries. 100 books × (40 entries + one 80k-char PDF) → **302 queries, ~13.9 MB**, 57% raw source text that no list consumer reads |
| Frontend | fetches every page sequentially at sign-in, on workspace switch, and on 23 silent `loadData` calls |
| Chat turn | 1 + 5K queries over K+1 connections; loads attachments and raw resource text it discards; no consistent snapshot across books |

All lookups are indexed: the cost is round trips and payload size. The Studio edits straight from the cached list item, which also feeds F15.

### F08 — Token estimate: P3

`words × 1.35` on both sides. English overestimates (~134 estimated for ~110 real tokens); Spanish underestimates slightly. Unspaced text escapes the budget entirely: 5,000 CJK chars → 2; a 4,000-char URL/base64 blob → 2. That matters only for pasted unspaced content or non-supported-language lore.

### F07 — Resource grant: P3

`book.get("resources")` is always falsy because resources live under `metadata`, so `lorebookResources` is never requested (probe with real row hydration: requested `["lorebooks"]`, resource snippets activated). Exposure is limited to the user's own content after an admin withholds or revokes `lorebookResources`; creation, extraction, PDF import and link routes are properly gated.

**The naive fix is harmful.** Requesting the key makes `authorize_user_flags` raise `FEATURE_FLAG_OFF` 403 and fails the whole chat turn (see N1). Related gaps:

- A downgraded user cannot detach linked resources: the detach route needs the grant.
- The preview route never checks the resource grant.
- Workspace copy checks the grant only for linked resources, not embedded ones.

## New issues

| ID | Issue | Priority | Folded into |
|---|---|---|---|
| N1 | A user without the `lorebooks` grant who still has any global/attached book gets **403 on every chat turn** (`lorebook_loader.py:241`, `require_grants` raises). Revoking or downgrading breaks chat instead of disabling lore. | P2 | F07 PR |
| N2 | Regex keys are never validated on save (only the `/validate` endpoint compiles them). A pattern Python rejects is stored, then `_matches_key` raises `ValueError` out of `prepare_context()` and **every turn in that session fails**. | P1 | F05 PR |
| N3 | The "previews use the same rules as live chat" claim is false (F01/F02/F03). | P2 | copy PR |
| N4 | Story writer includes all lore copies (secrets too); the Story assistant excludes all of them. | P2 | F16 |
| N5 | Snapshot attach freezes the unsaved editor draft, not the saved book. | P2 | F02 |
| N6 | Workspace copy skips the resource-grant check for embedded resources (`workspace_copy.py:254`). | P3 | F07 |
| N7 | `deleteEntry` deletes server-side immediately, outside Save, without CAS. | P3 | F15 |
| N8 | Skip reasons are English-only strings; misleading for `and_*`/`not_*`. | P3 | F13 |

## Decisions with recommended defaults

Each recommendation is a default that unblocks implementation; change it before the PR that depends on it if product disagrees.

| ID | Recommended default | Needed by |
|---|---|---|
| D05 regex | Technical, not product: `regex` module syntax, 200-char pattern cap, 25 ms per key and 250 ms per activation; invalid or timed-out keys skip their entry with a reason, never fail the turn | PR1 |
| D08 grants | Never 403 a chat turn for lore. Missing `lorebooks` → no lore; missing `lorebookResources` → entries only. Record the skip in activation metadata and show it in the session panel. Detach always allowed. | PR5 |
| D01 history | Scan depth = last N completed, active messages of both roles (assistant text cleaned as for the model), plus the new user input. Recursion becomes a fixed internal max of 3 steps, applied only when `recursiveScanning` is on. | PR7 |
| D02 multi-book | Conversation budget = the largest eligible book budget. Each book is also capped by its own budget. Admission order: priority desc → attachment precedence (session > template > world > character > global) → insertion order. Recursion activates only entries in books with recursion on. Linked vs snapshot duplicates resolve by precedence. | PR8 |
| D06 secrets | **Closed 2026-10-26:** no secret, reveal or constant feature. | — |
| D03 snapshots | A snapshot freezes the **saved** book and its resolved resources, built server-side; snapshot attach is disabled while the draft is dirty | PR10 |
| D04 conflicts | Stale save → 409 with the current document. Keep the user's draft and offer Reload (discard mine) / Overwrite / Copy my draft. No field merge. | PR11 |
| D09 Story Studio | Copies stay explicit pinned references. No conditional mode for now. | PR13 |
| D07 placement | Ship honest copy now; build real slots only if authors ask | PR2 / PR15 |
| D10 scale | No numeric target needed: the summary DTO and batching are safe to ship whatever targets are chosen later | PR14 |

## Fix plan

Each PR lands with regression tests built from the probe fixtures above. "BE" = magic-worlds-api, "FE" = this repo. Sizes: S ≤ ½ day, M = 1–3 days, L > 3 days.

### Phase 1 — Stop the bleeding (no product decisions)

**PR1 · BE · Bounded, fail-soft matching — F05, N2 · S**
- `_matches_key`: switch to `regex` with `timeout=`; add a per-activation deadline; on invalid pattern or timeout, skip the entry with reason `pattern_invalid`/`pattern_timeout` and an issue, instead of raising.
- Validate regex keys (`regex.compile` + length cap) in create, update, entry CRUD, assistant apply and import. Return 422 with the entry/key path.
- Preview route uses the same guard.
- Tests: `(a|aa)+$` returns within the deadline; `(?<name>x)` works; an invalid key does not fail the turn.

**PR2 · FE (+BE warning) · Truthful copy — F11, F09 copy, F10, N3 · S**
- F11: relabel `any` → "Any primary key (secondary ignored)" and `all` → "All primary keys". Keep the enums. Add a validation warning `secondary_keys_ignored` (both engines) when secondaries are set under `any`/`all`.
- F09: describe positions as ordering within the lore block appended to the system prompt.
- F10: rename the book toggles to "Defaults for new entries" and have `blankEntryDraft(order, settings)` copy them.
- N3: remove the "same rules as live chat" claim.
- Update en, es, `lorebookCopy.ts`, and the lorebook assistant prompt (explain the logic modes).

**PR3 · FE · Editor data-loss guards — F06 · M**
- Client UUIDs for new entries (the backend already accepts `entry.id`).
- An edit-generation ref bumped by every user edit. Save and extraction responses apply only server-owned fields when the generation changed.
- Attach/detach merge only `metadata.sharedResources` via functional `setDraft`.
- The assistant result is staged when edits happened during the turn.
- Dirty indicator and leave-page guard.
- Tests: delayed-promise cases in `LorebookStudio.test.tsx` for save, extraction, attach, detach and assistant.

**PR4 · BE+FE · Unicode boundaries and estimator — F14, F08 · S**
- Boundaries: `(?<!\w)…(?!\w)` in Python, `(?<![\p{L}\p{M}\p{N}_])…(?![\p{L}\p{M}\p{N}_])` with the `u` flag in JS, NFC-normalize sample and keys.
- Estimator on both sides: `max(ceil(words × 1.35), ceil(non-CJK chars / 4) + CJK chars)`.
- One shared JSON fixture file consumed by pytest and vitest.

**PR5 · BE · Grant degradation — F07, N1, N6 · S** (assumes D08 default)
- Resolve grants without raising, following the `assistant_history_permissions` pattern.
- Strip `metadata.resources`/`sharedResources` when `lorebookResources` is missing; return empty lore when `lorebooks` is missing. Record why in activation metadata.
- Gate the preview route, allow detach without the grant, check embedded resources in workspace copy.

**PR6 · FE · Preview correctness — F13, N8 · S**
- Fingerprint `(sample, previewLorebook)`; mark backend results stale on change; drop responses whose fingerprint no longer matches.
- Always render the reason.
- The backend returns reason codes, mapped to i18n keys on the frontend.

### Phase 2 — Activation semantics (needs D01, D02)

**PR7 · BE · History window — F01 · M**
- Read the last `scanDepth` completed, active messages before `prepare_context()`, using the same filtering as `build_conversation_messages`. Pass them plus the user input to activation.
- Cap recursion at a fixed internal maximum.
- The preview accepts a message list; the local preview labels its sample as one message.
- Retry and recovery replay the stored graph, so lore stays deterministic.
- Expect more activations on existing books (default depth 8); the budget still bounds them.

**PR8 · BE (+FE preview) · Multi-book policy — F03 · M**
- Implement the D02 rules in `build_activation_response`: sort candidates before admission, per-book caps, recursion scope, dedupe by precedence.
- Reorder-invariance tests: same set, any order → same result.

**PR9 · Secrets — F04 · dropped.** Constant, secret and reveal were removed on 2026-10-26 instead of fixed (see F04).

### Phase 3 — Contracts and concurrency

**PR10 · BE+FE · Resource snapshots and preview — F02, N5 · S → M**
- Minimal: preview and snapshot routes load the saved book and run `prepare_lorebook_resources_for_save`. The preview adds `sharedResources`; snapshot `ValueError` → 422.
- Fuller: the server builds snapshots from the saved book and ignores the client snapshot body; snapshots may carry frozen shared resources; the frontend stops sending `snapshot: draft` and disables snapshot attach while the draft is dirty.

**PR11 · BE+FE · Stale-write protection — F15, N7 · M**
- Add an integer `revision` column via the scoped schema-upgrade framework, bumped by every mutation path (book, entry CRUD, resource link, assistant, Story write-back).
- Accept an optional `expectedRevision` → 409 `LOREBOOK_STALE`.
- Upsert entries by id instead of delete-all.
- Frontend: keep the base revision, send it, handle 409 per D04; the Studio loads the book by id on open (shared with PR14).
- Ship the backend first: `extra=forbid` rejects the new field on old backends.

**PR12 · FE (then BE) · Session effective lore — F12 · S → M**
- Minimal: one shared attachment state for the panel and matcher; render snapshots from `attachment.snapshot` with a Snapshot badge and open the frozen copy.
- Fuller: an effective-attachments endpoint built on `list_for_activation_targets`, returning scope, mode and "inherited from".

### Phase 4 — Consumers and scale

**PR13 · BE+FE · Story Studio copies — F16, N4 · S → M**
- Picker: a note on what a copy drops.
- Fuller: include keys/flags in the staleness review; fix the title-only highlight keys and the raw-id tooltip.

**PR14 · BE+FE · Summary list and batched reads — F17 · M**
- A summary list DTO with SQL counts and no raw source text, plus batched `IN (…)` hydration.
- Activation reads all target books in one transaction, skips attachments and raw text.
- The gallery, rail and pickers use summaries; the Studio and codex picker fetch by id.
- Tests: query-count assertions with a fake cursor, and a payload-size budget.

**PR15 · BE · Real placement slots — F09 · M–L, optional**
- Split the lore block by position; inject `author_note` at depth N in `build_conversation_messages` as a user-role note stored in graph metadata for replay parity.

## Order and dependencies

```text
PR1 ─┐
PR2 ─┤ independent, ship first (PR1 is the only urgent one)
PR4 ─┤
PR5 ─┤
PR6 ─┘
PR3 ────────────── independent; highest user value after PR1
PR7 → PR8          same function; land in sequence to avoid conflicts
PR10, PR12         independent of Phase 2
PR14 (Studio loads by id) → PR11
PR13, PR15         any time after PR2
```

Phase 1 is roughly 3–4 days of work and needs no product sign-off except the D08 default in PR5. Phases 2–4 are roughly 2–3 weeks, gated on D01, D02, D03, D04 and D09.
