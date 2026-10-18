# Novel / Story Studio — actual status and roadmap

<!-- CURRENT_DELIVERY_STATUS_START -->
## Current progress, remaining work, and scope

**Updated: 2026-10-18 09:30 CST. Full goal: unfinished.** Review and execute the entire 136-capability D1–D6 plan. No phase has been reduced to the features already built. Test counts are evidence for particular changes, not a completion percentage.

### What you can use versus what is only prepared

| Area | Actual status | What remains |
|---|---|---|
| Non-novel recovery | **Completed:** 3,885 recovered records across 96 tables. Files were preserved; records without files remain valid. | Preserve those records and all current novels during subsequent work. |
| D1 — editor reliability | **Installed:** ordered revision-checked saves, recovery/conflict handling, checkpoints, explicit AI review and atomic acceptance. | Real-device, assistive-technology and author acceptance; release checks. |
| D2 — structure and organization | **Substantial work installed:** scenes/chapters/parts, organization/history, templates/copies, notes/bookmarks, search/reading, snapshots, device recovery and saved-source preparation. | Remaining catalog/context/organization cases, offline/storage/retention and accessibility acceptance. Large-manuscript performance was measured and fixed on a 1,500-scene, 1.1-million-word novel on 2026-10-18 (see *D2 slice — large-manuscript performance*); production-build and low-end-device measurement remain. |
| D3 — story-aware assistant | **Running in the app (frontend, BFF, schema `2026_10_novel_import_formats`) on the shared `/v1/chat/completions` contract.** Ask, Suggest → review → accept → undo, Stop (including from another tab), lost-turn recovery and draft resume were verified live with a real provider on 2026-10-17. | The two open items under *Known D3 gaps*; account/workspace/profile lifecycle and source/context policy. The novel style sheet and character voices (N15, K08), the account's reply style (A25), saved scene summaries as revision-bound memory (K09) and outline import with assistant chapter plans (S18) run since 2026-10-17. Chapter and book summaries tied to their scenes' revisions (rest of K09/A14), and a novel-wide summary status view with *Still accurate*, a primed assistant refresh and *Save all ready* (rest of K09), run since 2026-10-18. The author's own prompt presets, versioned and frozen with each reply (A19), run since 2026-10-18 01:30. Part summaries, and a book summary built from current part, chapter and scene summaries for novels over 20 scenes (rest of K09), run since 2026-10-18 02:10. Source scenes are ranked by an evaluated BM25 policy with a revision-bound stored index (rest of K09, which is now complete) since 2026-10-18 02:45. Named actions (A06–A09, A12–A14) run since 2026-10-17 19:25. |
| D4 — planning, continuity, personal review | **In progress. Slices 1–17 run in the app (schema `2026_10_novel_planning`):** board, timeline and matrix views plus scene story-time order (S13–S15); passage-linked tasks (R10), a stash of cuts and alternative takes (R11), story facts with as-of-scene state and contradiction flags (K05, K06, K14 for facts), assistant fact extraction into proposed facts the author approves (A18), and assistant continuity checks against prose and approved facts whose cited issues become continuity tasks (A16, K14 prose↔plan), whole-novel appearance lists with passage navigation (K07), assistant critique notes and one-scene step plans with progress (A15, A24, A17 for prose), reviewed application of approved facts to the novel's own Codex entries (K12, novel-local), reviewed bulk scene actions that undo in one step (S20; R14 for organization changes), assistant-proposed outline changes (move, split, merge) applied one at a time with undo (A17), a field-by-field review of newer library card versions that takes chosen details into the novel's Codex copy (K11), staging an approved fact in the library card's private draft for the owner to publish (K12 library target), and library updates for lorebook entries and adventure templates, compared against the library details the copy pinned, with linked approved facts in the review (rest of K11), and writing an approved fact into the library lorebook entry a Codex entry copies, after a review that says it applies at once (K12 lorebook target), and chapter proposals (split, merge, move, new chapter) applied one at a time or all ready ones together as one outline changeset with one undo (rest of A17; R14 for structure; slice 15, since 07:16), and the latest assistant suggestion of several scenes accepted together as one manuscript changeset with one undo that keeps scenes written since (prose half of R14; slice 16, checked live 08:59), and part proposals (a new part starting at a chapter, applied alone or with the others, reading order kept; rest of A17; slice 17, checked live 09:25). | Research (A28), other fields and new cards or entries as discovery targets (rest of K12), branches (N05), separate surfaces (U01). |
| D5 — portability and productivity | **Started. Slices 1–13 and the style-sheet file run in the app:** whole-manuscript export to Word (.docx), EPUB 3, PDF (with chosen page size, margins, type and spacing), Markdown and plain text from saved scenes at one reviewed source version, with section inclusion, title/part/chapter/scene title choices, real Word lists and hyperlinks, an optional linked contents page in Word and EPUB, front and back matter from a chapter's *Export section*, a glossary from chosen Codex entries, review-notes and AI-changes files of the same scenes, a style-sheet file, and a download verified against the summary's SHA-256 (X03, X04, X05, X06, X07, X10). Export jobs build the reviewed file in the background with a stage, a log, cancel, retry at the same source version and a SHA-256-checked download (rest of X10; slice 13, since 06:42). Markdown, plain-text, Word, EPUB, OpenDocument text and RTF import into a new novel, with a reviewed conversion preview, a loss report and the original file kept (X01, X02; EPUB, ODT and RTF since 2026-10-18 03:35); front and back matter comes back as chapters with their export role, from EPUB semantics, Word/ODT/RTF styles, the Markdown export's section comments or usual matter titles (since 04:05). A deadline and daily target, a writing log of saved edits, and a progress view with pace, today, an optional streak and recent days (N12, U07, U08). A project package (`.mwnovel`) backs up the whole novel, with optional notes, planning and scene history, and restores it as a new novel (N14, X08; since 04:50). | EPUB validation with the W3C checker, export jobs in the shared *Tasks* drawer, read-aloud and dictation (U09, U10), translation, blurbs and completions (A10, A26, A27). |
| D6 — series and extensions | **Pending.** | Versioned author-owned series canon/style, local overrides, presets and optional explicit publication handoff. |

### How D3 runs now

- **No novel code in the shared services.** The 2026-10-17 14:30 install into `api.magic_llm` (52 files),
  `magic-agents` (8) and `magic-llm` (23) was **reverted at the user's instruction** from verified backups; the
  executor serves unchanged and has no `/v1/llm-execution/*` route. The BFF's client for that route was then
  removed (`llm_execution_protected.py` and its four test files); novel turns use the same transport, profile
  resolution and refund-on-failure policy as the card, lorebook and app assistants.
- **Stop is owned by the BFF.** The shared route has no stop API. Stop replaces the turn's reservation lease, so the
  worker holding the upstream request fails its next renewal and is cancelled; the turn is recorded as cancelled
  and its platform charge is refunded exactly as a cancelled shared-route turn is. A turn already closed by the
  normal failure path now reports a settled receipt instead of staying "uncertain" in the drawer.
- **Profile sampling applies.** The novel graph keeps the published profile's temperature, top_p and
  reasoning_effort, as the other assistants do (an earlier strip existed only for the removed protected route).
- **Configuration.** `ASSISTANTS_ENABLED` must include `novel`; `.env.example` documents it.

### Live verification — 2026-10-17

Signed-in account, test novel *Assistant check (test novel)*, system default profile (`claude-sonnet-5.5` via
OpenRouter, platform payer):

| Flow | Result |
|---|---|
| Ask | Cited replies in conversations 14–16, 19 and 20, each a single `POST /v1/chat/completions` → 200. |
| Suggest → review → accept → undo | Accept `POST …/generations/{id}/accept` → 200 (52 → 71 words); Ctrl+Z restored 52 words, autosaved (`studio-scenes` POST) and was confirmed after a full reload. |
| Stop during a long turn | "The request stopped…" with the platform charge refunded. |
| Recovery of turns whose worker died | From a retained draft: Check reports no result; Stop closes one as cancelled/refunded; Resume closes the other as failed/refunded, and Check then settles the draft. |
| Stop from another tab | Tab A streamed a long reply in conversation 23; tab B opened the conversation without its draft, saw the active request and pressed Stop (`POST …/turns/{id}/stop` → 200). Tab B showed the stopped, uncharged outcome; tab A's stream ended and its Check settled to the same outcome. |
| Reload | Reopening the assistant after a reload resumed the newest unsent draft ("Your unsent draft from this device is open again.") and the retained list shrank instead of growing. |

**Checks:** frontend 5,582 tests / 14 skipped (595 files), production build, Storybook typecheck and lint of the
edited files. BFF: the assistant/control/novel selection passes (1,871 tests); the last full suite had 15,068
passed and 22 failed — the **17 baseline failures** plus **5 caused by an outside edit** of
`src/database/mysql/models.py` at 15:10 (voice/conversation-message hunks that are not part of this work:
`test_conversation_message_delete` ×3, `test_conversation_reply_variants` ×1,
`test_conversation_workspace_scope` ×1). **Release validation is not all green.**

### Known D3 gaps

Closed on 2026-10-17 16:00: Check/Stop of a conversation's active request without its device draft; draft
accumulation on reload (the newest unsent draft is resumed, and copies holding a request proven settled are
retired); the dead executor-observation inputs of the Stop fence. Still open:

1. **BYOK accounting after dispatch.** A personal-key turn that fails or is stopped after dispatch still counts
   toward the daily request quota, and the provider may bill the user's key; the shared route returns no token
   totals for it. The receipt copy therefore states only that no platform credits were charged.
2. **Executor database.** The five `cat_*` tables created in the `magic_llm` database during the reverted install
   remain, unused. They are outside this project and are left untouched until the user decides.

Known limits, not defects: a second open tab does not refresh its conversation list or an open conversation's
active state until it reselects or reloads; opening the assistant in a second tab may take over the newest
unsent draft (the first tab keeps its in-memory copy and rewrites it on its next edit).

### D4 slice 1 — planning views (2026-10-17)

- **One model, three views.** *More → Planning views* opens Board (scene cards by part and chapter with status,
  story time, saved word count, POV and synopsis), Timeline (story chronology separate from reading order; a scene
  read after one that happens later is flagged *Flashback*, and scenes without a time are listed apart) and Matrix
  (characters from cast/POV and plot threads against scenes in reading order). The views derive from the loaded
  outline and copy no content; the chosen view is kept while the studio stays open.
- **Navigation.** Choosing a scene opens it in Write through the same save barrier as search and bookmarks (a
  hidden or trashed scene is refused, a blocked change keeps the drawer open with an explanation), and the scene's
  saved writing position is restored. *Details* opens that scene in *Organize & details*.
- **Story-time order.** Scenes gain an optional numeric `storyTimeOrder` detail (finite, |value| ≤ 1,000,000,000,
  null for unknown), validated in the BFF (`story_unit_metadata.py`) and the frontend, edited in scene details and
  shown in the details comparison. No schema change: it lives in the existing details JSON.
- **Live check, real API.** In the test novel, Scene 1 = 20 and Scene 2 = 5 with narrative time "Forty years
  earlier" were saved (`PUT …/scenes/{id}` → 200, `details.storyTimeOrder` returned). The timeline listed Scene 2
  (read #2, *Flashback*) before Scene 1 and Scene 3 under *Unknown story time*; choosing Scene 1 from Scene 3 opened
  it in Write and closed the drawer; a plot thread saved on Scene 1 appeared in the matrix; at 375 px no view
  overflows horizontally.
- **Checks.** Novel frontend tests 1,113 passed (new: planning derivations, drawer, studio save-barrier wiring);
  BFF unit-metadata tests 28 passed; lint, app typecheck and Storybook typecheck of the edited files are clean.
  `pnpm build` is **red** on six type errors in the chat-image interaction files (`GeneratedImage.test.tsx`,
  `InteractionCenterPanel.tsx`) from concurrent outside edits, not this work.

### D4 slice 2 — tasks, stash and story facts (2026-10-17)

- **One store for three kinds.** New table `story_plan_item` (kind `task` | `fact` | `stash`, kind-specific states,
  optional scene, CAS revision, JSON data, cascade-deleted with the novel) under schema `2026_10_novel_planning`
  (predecessor `2026_10_novel_variants`; migration `story_planning_migration.py`, script
  `scripts/migrations/20261017_novel_planning.py`; the variant and assistant migrations chain through it).
  Routes: `GET/POST /stories/{id}/plan-items` and `GET /stories/{id}/plan-item-requests/{requestId}`; writes are
  idempotent by request id, refused on archived/trashed novels, and every scene reference must belong to the novel.
  Models: `src/models/story_planning.py`; store: `story_plan_store.py`.
- **Tasks (R10).** *More → Tasks & stash*: a task can link the selected passage (scene, quote, revision). Filters
  Open/Done/All; *Mark done* with an optional resolution, Dismiss, Reopen, Trash; *Go to passage* finds the quote in
  its scene and highlights it, or opens the scene when the text has changed. The board shows open tasks per scene.
- **Stash (R11).** *Cut selection to stash* saves the text first and removes it from the manuscript only after the
  save succeeds and only if the selection is unchanged (normal undo still restores it); *Save as take* keeps a copy
  without cutting. Search, *Insert at cursor*, Copy and Trash.
- **Story facts (K05, K06, K14 for author facts).** *Planning views → Facts*: facts hold from a scene up to (not
  including) an end scene in reading order; an *As of scene* picker shows what holds there, a subject filter, and
  contradictions (two approved facts for one subject that are both single-valued — location, state — or that name
  the same other party/object). Facts can cite the selected passage as evidence. Author-entered facts are saved as
  approved; facts in the `proposed` state show Approve/Reject (ready for assistant extraction, A18).
- **Live database upgrade.** Read-only check matched (113 tables, 1 step); private backup
  `magic-worlds-api/.dev/backups/novel-planning-pre-20261017T223207Z-3b30be59.sql.gz` (113 tables, row
  fingerprints in the metadata file); apply succeeded, marker `2026_10_novel_planning`, 4,601 rows preserved.
  Pre-edit copies of the touched BFF files: `.dev/backups/novel-planning-20261017/`. The BFF on `:8010` was
  restarted from a terminal (log `.dev/logs/bff-d4planning-20261017T163229.log`).
- **Live check, real API (test novel).** A task linked to "eleven winters" (`POST …/plan-items` → 200, scene and
  source revision stored) showed on the board as "1 open task(s)"; *Go to passage* from Scene 3 opened Scene 1 with
  the passage highlighted; *Mark done* with a resolution moved it to Done. *Cut selection to stash* removed a
  sentence only after the save, *Insert at cursor* restored it exactly and autosave ran. In Facts, a location fact
  for Mara citing "Gull Point" (Scene 1 → end) saved as approved; a second location fact from Scene 2 produced
  "1 conflict(s) at this scene" with each fact naming the other; moving it to Trash (`state: trashed`, revision 2)
  cleared the conflict.
- **Checks.** Novel frontend tests 1,121 passed / 1 skipped (154 files) plus the planning contract tests; BFF
  planning, migration-chain and bootstrap tests 134 passed. `pnpm build` is **red** on 19 type errors, all in
  call/chat-image interaction files edited outside this work at 16:14–16:15 (`callChatIntegration.test.tsx`,
  `InteractionCenterPanel.tsx`, `GeneratedImage.test.tsx`); no novel file has a type error. Baseline BFF failures
  unrelated to novels persist (`test_fish_calls_migration`, `test_user_data_wipe`, `test_query_contract_limits`,
  `test_text_stream_routes`, the `test_voice_call_chat_integration` import error).
- **Known limits.** Facts cannot be edited after saving (trash and re-add); a fact's subject is free text with
  suggestions from the cast, not yet linked to a codex card; lists load the newest 500 items per kind.

### D4 slice 3 — assistant fact extraction (A18, 2026-10-17)

- **Same assistant, same route.** No new feature, profile or service: the BFF-owned `novel_reply` tool
  (`src/agent_graphs/runtime/novel_assistant.v2.json`, catalog hash updated in `builtin_agents.v1.json`) gains a
  `facts` list (≤ 40). When the author asks to extract or track facts, each fact names a subject, kind, statement,
  optional other party/object, the exact passage ID that supports it and a verbatim excerpt. Nothing changed in the
  shared services.
- **Checked against the saved sources.** `prepare_novel_result` refuses a fact citing a passage outside the frozen
  packet, resolves its scene and revision, keeps the excerpt only if it occurs in that passage (spacing may differ;
  the stored excerpt is the passage's own text) and collapses exact repeats. `facts` is stored only when nonempty,
  so earlier saved replies still validate; `validate_novel_record` rebuilds and compares facts like citations. The
  frontend contract checks the same rules.
- **Author review, never silent promotion.** The reply's evidence shows *Proposed facts*; *Send N to Facts for
  review* creates planning facts in the `proposed` state with `origin: assistant` and `originRef
  novel-reply:{messageId}#{index}` (holding from the evidence scene, citing the excerpt), so a reply cannot be sent
  twice. They appear in *Planning views → Facts* as "Suggested by the assistant" with Approve/Reject.
- **Conflict rule refined.** Two single-valued facts (location, state) agree when both objects match, or when one
  names an object the other's statement mentions; otherwise they conflict.
- **Live check, real provider turn** (test novel, `claude-sonnet-5.5`, scope *This novel*, *Author analysis*):
  "Extract the story facts about Mara…" returned 7 facts, all with verbatim excerpts from Scene 1. *Send 7* →
  seven `POST …/plan-items` → 200 (`state: proposed`, `origin: assistant`, `originRef: novel-reply:49#3`, quote and
  source revision 6). In Facts the seven showed as proposed; approving "Has · the letter" and "Is at · Gull Point"
  raised no conflict with the author's "Keeps the lamp at Gull Point lighthouse"; rejecting "Is at · the lamp" hid
  it. After a full reload the reply showed *All in Facts* with seven *In Facts* badges.
- **Checks.** BFF: novel reply/transport/limit suites 63 passed; assistant/graph/catalog/novel selection 3,277
  passed with only the baseline `test_query_contract_limits` and `test_text_stream_routes` failures. Frontend:
  novel + API tests 2,017 passed / 14 skipped; lint and typecheck of the edited files clean. BFF restarted from a
  terminal (log `.dev/logs/bff-d4facts-20261017T164828.log`); pre-edit copies in
  `.dev/backups/novel-fact-extraction-20261017/`.

### D4 slice 4 — assistant continuity checks (A16, 2026-10-17)

- **Same reply tool.** `novel_reply` gains an `issues` list (≤ 20): title, detail, certainty (`certain` = the
  passages directly contradict, `likely`, `possible`) and 1–4 evidence items, each an exact passage ID plus a
  verbatim excerpt. The prompt asks for issues only on a continuity request and forbids inventing them. Catalog hash
  updated again. `prepare_novel_result` refuses evidence outside the frozen packet, keeps only verbatim excerpts,
  collapses repeated evidence and exact repeats; `issues` is stored only when nonempty and rebuilt on validation.
- **Issues become tasks, not edits.** The reply's evidence lists *Continuity issues* with their certainty and every
  cited passage; *Send N to Tasks* creates open tasks with `origin: continuity`, anchored on the first evidence
  passage (*Go to passage* works), with the detail, the assistant's assessment and the other passages in the body
  (`originRef novel-reply:{messageId}#issue-{index}` prevents sending twice). The manuscript never changes.
- **Live check, real provider turn.** Two test sentences were written into the empty Scene 3 of the test novel
  ("Twelve winters at Gull Point…", letter taken "from the tin box under her bed"). "Run a continuity check across
  all the scenes…" (scope *This novel*, *Author analysis*) returned 2 issues: *Eleven vs. twelve winters* (likely;
  notes it is consistent if a year passed) and *Letter kept in coat vs. tin box* (possible), each citing verbatim
  excerpts from Scenes 1 and 3. *Send 2 to Tasks* created both; in *Tasks & stash* they show *Continuity check*,
  the assessment and the Scene 3 evidence, and *Go to passage* opened Scene 1 with the passage highlighted.
- **Superseded by slice 5:** approved facts now join the source packet.
- **Checks.** BFF novel reply suites 64 passed; selection 3,278 passed with only the 8 baseline failures. Frontend
  novel + API tests 2,019 passed / 14 skipped; typecheck and lint of the edited files clean. BFF log
  `.dev/logs/bff-d4continuity-20261017T165705.log`.

### D4 slice 5 — approved facts in the assistant's sources (A16/K14, 2026-10-17)

- **Compiled with the prose.** The context store reads the owner's facts in state `approved` in the same read
  transaction (proposed, rejected and trashed facts are never sent) and the compiler adds those that hold at an
  included scene — from a scene up to, not including, an end scene, in reading order — never one that begins after
  the anchor under *Through the anchor scene*. Sources and cards are placed first; facts follow in reading order
  (≤ 120), and any that do not fit are listed in the trace (`factExclusions`, reason `limit` | `budget`). The packet
  key `facts` and the trace key appear only when nonempty, so every saved context still validates (checked live on
  the earlier *Fact extraction check* and *Continuity check* replies). The system message tells the model to treat
  facts as the author's plan and point out prose that contradicts them.
- **Verified on both sides.** `checked_context` accepts only the optional keys with exact shapes; the frontend live
  verifier recomputes the inclusion rule (holding scene, reveal boundary, ordering) against the current outline and
  the frozen verifier checks shape. The source inspector shows *Approved facts* with their scene ranges and how
  many were left out.
- **Issues name the facts they contradict.** A continuity issue may list up to 4 fact IDs from its own packet
  (refused otherwise); the evidence modal shows "Contradicts approved fact — …" and the continuity task body
  includes it.
- **Live check, real provider turn** (anchor Scene 3, *Through the anchor scene*, scope *This novel*): after
  approving "lamp-keeper … for eleven winters", the prepared sources listed exactly the 4 approved facts. "Run a
  continuity check of this scene against the earlier scenes and my approved facts" returned 3 issues; *Twelve vs.
  eleven winters* (contradiction) and *Letter location: coat vs. tin box* (likely) each named the approved fact they
  contradict, a third (possible) cited prose only. *Send 3 to Tasks* created them with the contradicted fact in the
  body.
- **Checks.** BFF context/result/store and novel reply suites 92 passed; selection 3,282 passed with only the 8
  baseline failures. Frontend novel + API tests 2,030 passed / 14 skipped; typecheck and lint of the edited files
  clean. Pre-edit copies: `.dev/backups/novel-facts-context-20261017/`; BFF log
  `.dev/logs/bff-d4factcontext-20261017T170745.log`.

### D4 slice 6 — character appearances (K07, 2026-10-17)

- **Matrix → passages.** *Planning views → Matrix* gains *Appearances*: a character's name in the matrix is a button
  that searches the saved manuscript for it (literal, case-insensitive, archived sections excluded, first 50), and a
  *Name or phrase* field lets the author search a short name or any phrase. Results list scene, chapter and the
  matched text in context; choosing one resolves the match against the same saved snapshot and opens it highlighted
  in Write through the search save barrier (a blocked change keeps the drawer open with an explanation). No new
  endpoint: it uses the existing manuscript search and resolve routes.
- **Live check, real API.** In the test novel, "mara" found 3 passages in 2 scenes; choosing the Scene 1 passage
  from Scene 3 opened Scene 1 with "Saved passage opened and highlighted", and the previous results were still there
  when the drawer was reopened.
- **Checks.** Planning views tests 4 passed (new appearances test); novel + API tests pass; lint and typecheck of
  the edited files clean.

### D4 slice 7 — critique notes and step plans (A15, A24, A17, 2026-10-17)

- **Two more optional reply parts.** `novel_reply` may return `notes` (≤ 12) and `plan` (or null). A note has an
  aspect (pacing, causality, purpose, exposition, character, dialogue, clarity), a title, an observation, 1–4
  evidence passages with verbatim excerpts and 1–3 revision options; the prompt forbids grading or ranking the prose
  and asks it to respect deliberate genre and style choices. A plan has a title and 1–8 ordered steps, each naming
  one writable scene of the packet and a self-contained instruction for that scene alone. The BFF resolves evidence
  like issues, refuses unknown or read-only plan scenes, keeps each step's saved scene revision, collapses repeats,
  and stores `notes`/`plan` only when present, so older records validate unchanged. Graph catalog hash recomputed;
  version string unchanged.
- **Nothing runs by itself.** *Developmental notes* → *Send N to Tasks* creates open `critique` tasks (options and
  aspect in the body). *Plan* → *Track N steps in Tasks* creates `plan` tasks; progress ("1 of 2 steps done") and
  each step's state come from those tasks, and *Mark done* closes one. *Draft this step* puts the instruction in the
  composer as a Suggest request scoped to that scene (refused while the composer holds other unsent text or a
  refinement), focuses it and closes the modal; the author still prepares, reviews, sends and then reviews the
  suggestion. A step shows *Suggestion ready* when a later reply in the conversation holds a suggestion for its
  scene from exactly its instruction.
- **Live check, real provider turns** (scope *This novel*, *Author analysis*): the critique-and-plan request
  returned 3 cited notes (exposition, scene purpose, clarity) and a 2-step plan for Scenes 1 and 3; the model left
  Scene 2 out because it was empty and not in the packet. *Send 3 to Tasks* and *Track 2 steps* created the tasks.
  *Draft this step* set Scene 1 · Suggest · This scene with the instruction; the sent turn returned a Scene 1
  candidate (not accepted; manuscript unchanged); step 1 then showed *Suggestion ready*, and *Mark done* gave
  "1 of 2 steps done". After a full reload both records verified and all task states were intact.
- **Checks.** BFF result tests 27 passed (2 new); every suite touching graphs or the novel assistant 1,414 passed /
  29 skipped. Frontend novel + API tests 2,035 passed / 14 skipped (new notes, plan and contract tests); typecheck
  and lint of the edited files clean. Pre-edit copies: `.dev/backups/novel-critique-plan-20261017/`; BFF log
  `.dev/logs/bff-d4critiqueplan-20261017T172557.log`.
- **Still open here:** structural change proposals (move/split/merge) for A17 (done in slices 10 and 15), and executing several steps in the
  background with checkpoints (doc 08 *Plans and background work*); steps run one reviewed turn at a time.

### D4 slice 8 — approved facts into the novel's Codex (K12, novel-local, 2026-10-17)

- **Reviewed, field-level, novel-local.** In *Planning views → Facts*, an approved fact offers *Add to Codex…*. The
  review shows the fact, its cited passage with scene and revision (or that the author wrote it without one), an
  explicitly chosen entry of this novel's Codex (pre-selected only when exactly one entry names the subject or its
  linked card), the entry's current description and an editable description after applying (the statement as a new
  paragraph). Applying uses the existing Codex update: it edits only the novel's snapshot (source pins stay
  immutable; the library card and other novels keep their versions), it is refused with 409 if the Codex changed
  after the review, and the request ID makes a retry return the original receipt. While another Codex write is
  unconfirmed, applying waits for it.
- **Provenance.** The fact records `codexRefId` and `codexRevision` (the context revision the write produced; the
  BFF requires both or neither, the frontend verifier the same). An applied fact shows *In Codex · {entry}* and no
  second apply. If the Codex write succeeded but the fact could not record it, the dialog offers *Try linking
  again*, which retries only the link, never a second append. No schema change: `story_plan_item.data` only
  requires a JSON object and optional keys are stored only when set.
- **Live check, real API.** The test workspace had no library cards, so a test character card *Mara* ("Test card
  for the Assistant check novel…") was created with the manual creator and added to the test novel's Codex. Applying
  "lamp-keeper … eleven winters" appended it to the novel's Mara entry and the fact showed *In Codex · Mara*. With a
  second review open, the entry was disabled and re-enabled from another tab; *Apply* was then refused with the
  conflict message and the refreshed description, and applying again succeeded. After a reload both facts kept
  their badge, the novel's entry held both statements, and the library card still had its original description.
- **Checks.** BFF planning tests 26 passed (1 new). Frontend novel + API tests 2,040 passed / 14 skipped (new
  review and contract tests); typecheck and lint of the edited files clean. Pre-edit copies:
  `.dev/backups/novel-fact-codex-20261017/`; BFF log `.dev/logs/bff-d4factcodex-20261017T173610.log`.
- **Still open for K12/K11:** library targets (a separate explicit decision that updates the library card, never
  other novels' pins), other fields, lorebook entries as new destinations, and reviewing newer library versions
  against a novel's pinned snapshot (K11).

### D4 slice 9 — bulk scene actions with one undo (S20, R14 for organization, 2026-10-17)

- **One reviewed write.** On *Planning views → Board*, *Select scenes* adds a checkbox to each card (archived and
  read-only scenes cannot be selected). With scenes selected, the author picks one action — set status, move to a
  chapter, archive or move to Trash — and *Review change* lists exactly the scenes that would change; scenes
  already in that state are counted as unchanged and left out of the write. *Apply* sends one `bulk_scenes`
  structure operation (1–100 distinct active scenes) behind the studio's save barrier, checked against the
  structure revision, so it is refused if the outline changed after the review. A selection with nothing to change
  is refused (`STORY_BULK_NO_CHANGE`).
- **One undo.** The whole action is a single organization revision: *Undo* on the result (offered only while no
  later organization change exists) or *Organization history* reverses it in one step. Undo reverts only the fields
  the action touched (status, archive state, Trash, chapter and order) and is refused for a scene whose same field
  was changed later; unrelated later edits are kept. History shows it as *Change several scenes*.
- **No schema change.** The operation reuses `story_structure_revision` and the existing undo/redo lineage.
- **Live check, real API.** On the test novel, Scenes 2 and 3 were set to *Revising* in one write (revision 4,
  one history row naming both scene IDs), then *Undo* restored both to their earlier status (revision 5). Scene 2
  was moved to Trash (revision 6) and *Undo* brought it back with its story time intact (revision 7). After a
  reload, *Organization history* listed both actions and both undos as *Change several scenes*. The only 401 in the
  BFF log was the automatic token refresh before the first write.
- **Checks.** BFF structure, history and route tests 198 passed (4 new). Frontend novel + API tests 2,042 passed /
  14 skipped (2 new view tests); typecheck clean apart from the 19 known errors in `src/features/interaction/…`
  (not part of this work); lint of the edited files clean. Pre-edit copies:
  `.dev/backups/novel-bulk-scenes-20261017/`; BFF log `.dev/logs/bff-d4bulkscenes-20261017T175040.log`.
- **Still open for R14:** grouped multi-scene manuscript changesets (an assistant changeset applied across several
  scenes and undone together without overwriting later unrelated prose edits). Outline changesets with one undo
  are done in slice 15 (2026-10-18); the prose half is done in slice 16 (2026-10-18).

### D4 slice 10 — assistant-proposed outline changes (A17, 2026-10-17)

- **Proposals, never writes.** When the author asks how to reorganize, the novel reply may carry up to six
  `structure` changes: move a scene into a chapter (before a named scene or at the end), split a scene so a new,
  titled scene starts at a later paragraph, or merge a scene with the one that follows it in the same chapter.
  Each change names only writable scenes and chapters from the reply's own source packet and keeps their saved
  revisions. A split's opening words must begin a later paragraph of a saved passage; the BFF stores the exact
  plain-text offset and the verbatim words, and the frontend verifier repeats every check against the frozen packet.
  The same tool call still applies nothing.
- **Reviewed one at a time.** The reply's evidence lists *Outline changes*: what each change would do, the reason,
  and its state against the current outline — *Ready*, *Already in the outline*, *Changed since this reply* (the
  scene's prose changed) or *Not possible now*. *Apply change* sends exactly one existing structure operation
  through the studio's save barrier; the result offers *Undo* while no later organization change exists, and
  *Organization history* undoes it later. A split names its point as `textOffset`, a new optional form of
  `split_scene` that the BFF resolves to the paragraph starting exactly there at the expected revision. If an undo
  restored the exact prose the reply read (same content hash), the change can be applied again at the new revision.
- **Refusals stay specific.** A split or merge is refused while one of its scenes has a suggestion waiting for review
  (candidates and stashed suggestions both count); the card says so instead of a generic failure, and so do
  changed-prose and changed-outline refusals. Bulk scene actions use the same message for a waiting suggestion.
- **Diagnostics.** A reply that fails validation now logs `novel_reply_invalid` with a content-free reason (schema
  field locations or the fixed name of the failed source check) so a rejected provider turn can be explained.
- **Live check, real API.** Test-novel setup through the UI: a second paragraph in Chapter 1 · Scene 1, a new Chapter 2
  with a two-paragraph scene. Reply 1 proposed splitting Scene 1 at “At dawn Mara climbed the tower stairs”;
  applying it was refused because that scene still had the slice 7 plan-step suggestion waiting, and the card showed
  the waiting-suggestion message (the suggestion was left as it is). A later turn failed validation before the new
  log existed (no credits charged; the result check resolved it as failed); the same question succeeded on the
  next turn. Reply 2 proposed splitting Chapter 2 · Scene 1 at “Weeks later…” and moving Scene 3 to open Chapter 2.
  Split → revision 9 (new scene with the second paragraph) → *Undo* → revision 10 (prose restored, split-off scene in
  Trash) → the card returned to *Ready*. Move → revision 11 → *Undo* → revision 12 (Scene 3 back in Chapter 1).
- **Checks.** BFF tests 8,048 passed (new: paragraph-start split, structure-proposal normalization and record
  validation). Frontend novel + API tests 2,048 passed / 14 skipped (new contract, component and failure tests);
  typecheck clean apart from the 19 known `src/features/interaction/…` errors; lint of the edited files clean.
  Graph catalog hash updated. Pre-edit copies: `.dev/backups/novel-structure-proposals-20261017/`; BFF log
  `.dev/logs/bff-d4structure2-20261017T181845.log`.
- **Still open for A17:** chapter and part structure proposals (split/merge chapters, new chapters), and applying
  several changes as one reviewed changeset — chapters and grouped apply done in slice 15 (2026-10-18); parts remain.

### D4 slice 11 — reviewed library updates into the novel's Codex (K11, 2026-10-17)

- **Notice.** When a character, world or item card in the library has a saved version newer than the one a Codex copy
  names, the Codex row shows *Library vN* (`GET /stories/{id}/codex/library-versions`, read from the story's own
  workspace when the Codex opens and after each Codex change; archived novels can still read it). Copies whose library
  card left, or that are not linked to one, show nothing.
- **Field-by-field review.** *Review library vN* opens a review of name, alias, description, race, type and attributes
  (`GET /stories/{id}/codex/{refId}/library` returns the library's current version in snapshot form and the details of
  the version the copy was taken from, when that version is stored). Each differing detail shows both wordings and who
  changed it: *Changed in the library* (selected by default, because this novel never changed it), *Changed in this
  novel*, *Changed in both*, or *Different* when the copied version is not stored (nothing is selected by default).
  Matching details are counted, not listed. An impact summary says where the entry applies (novel, chapter or scene),
  whether AI turns read it, that saved prose stays as written, and that the library card and other novels do not
  change. The copy must keep a name or an alias.
- **One Codex write.** Applying sends the new Codex operation
  `{op:'refresh', id, sourceVersionId, take:[fields]}`. The BFF reads the library card's current version for that
  request only, refuses with `STORY_CODEX_SOURCE_CHANGED` (409) when it is no longer the reviewed version and with
  `STORY_CODEX_SOURCE_MISSING` when the card is gone, takes only the chosen fields, keeps the novel's values for the
  rest, records that version's pins, and advances the Codex revision once with a receipt. Taking nothing records the
  version as reviewed (*Keep this novel's details* / *Mark as reviewed*), which removes the notice. Source pins stay
  immutable for ordinary edits. A refused review reloads the newer version in place and the Codex panel does not
  report it as a Codex conflict.
- **Live check, real API.** The test novel's Mara copy pinned version 0 (its description holds two approved facts).
  Library Mara published as v1 (race Half-elf): the row showed *Library v1*; the review listed description and race
  as *Different* with nothing selected; taking the race → race Half-elf, description unchanged, pins v1, notice gone.
  Library v2 (race Human, a new sentence in the description): description *Changed in both* (kept), race *Changed in
  the library* (selected). Library v3 (race Elf) was published in a second tab while the v2 review was open; applying
  was refused (409), the review reloaded at v3 with the explanation, and the copy stayed at v1. Applying v3 → race
  Elf, pins v3, the description still the novel's own (with both facts, without the library's new sentence).
- **Checks.** BFF Codex store + story route tests 119 passed (5 new store tests, 1 new route test, the two library
  reads added to the workspace-selector and archived-workspace checks). Frontend novel + API tests 2,055 passed / 14
  skipped (new contract, review-logic and Codex panel tests); 2 `sessionVoiceApi` failures come from a concurrent,
  unrelated voice-contract header change in `src/infrastructure/api/index.ts`. Typecheck clean apart from the 19 known
  `src/features/interaction/…` errors; lint of the edited files clean. Pre-edit copies:
  `.dev/backups/novel-codex-refresh-20261017/`; BFF log `.dev/logs/bff-d4codexlib-20261017T183916.log`.
- **Still open for K11:** lorebook entries and adventure templates (they have no saved versions to compare), and
  showing linked approved facts in the impact summary. Both done in slice 13 (2026-10-18).

### D4 slice 12 — approved facts staged in the library card's draft (K12 library target, 2026-10-17)

- **Where it starts.** An approved fact that is already in a Codex entry (slice 8) shows *Stage in library card…* when
  that entry copies a character, world or item card from the library. The chain is explicit: fact → the novel's Codex
  entry → that entry's own library card.
- **Review.** The review shows the fact and its passage, says whether it starts from the card's unpublished draft or
  from the published card (a draft will be created), the library description now, and the description for the draft
  (the current one plus the statement as its own paragraph, editable). If the library text already holds the statement,
  nothing is proposed. The copy states that only a private draft is saved: chats, adventures and other novels see
  nothing until the owner publishes the card from its editor, and novels that use it then get the slice 11 notice.
- **Guarded draft write.** `GET`/`POST /stories/{id}/codex/{refId}/library-draft`. The read returns the basis (draft or
  published), the description, the version and a content stamp of the whole card body the editor would open. The
  stage locks the card, refuses `STORY_LIBRARY_DRAFT_CHANGED` (409) when that body changed since the review (for
  example, a draft saved in the card editor), refuses an archived or trashed novel, and writes only the draft's
  description; with no draft it creates one copied from the published body (owned-media check and draft voice
  references included). The published body, its versions and every novel's pins are never written.
- **Live check, real API.** Test novel → *Planning views → Facts*: the two facts in Mara's Codex entry offered staging.
  The review started from the published card (v3). A draft was then saved in the card editor in a second tab (race
  “Sea elf”); saving the stale review was refused (409) and the review reloaded from the unpublished draft. Saving
  again → the draft holds the staged fact and keeps the editor's race change; the published body is unchanged, the
  card is still at v3, and the novel's pin stays at v3. A reopened card editor shows the staged draft.
- **Checks.** BFF library-draft store tests 6 passed; story route + Codex store tests 131 passed (new staging route
  test; the new routes added to the workspace-selector, archived-workspace and request-workspace checks). Frontend novel
  + API tests 2,059 passed / 14 skipped (new review, Facts panel and contract tests); the same 2 unrelated
  `sessionVoiceApi` failures as above. Typecheck clean apart from the 19 known interaction errors; lint of the edited
  files clean. BFF log `.dev/logs/bff-d4librarydraft-20261017T185439.log`.
- **Test data left in place:** the library Mara test card has versions 1–3 (race Half-elf → Human → Elf, plus one
  description sentence) and an unpublished draft (race “Sea elf” and the staged fact). Publish or discard it in the card
  editor.
- **Still open for K12:** lorebook entries as targets (done in slice 14, 2026-10-18), other card fields than
  description, and a guard in the card editor itself (its own draft save replaces the whole draft, so an editor left
  open on older text can overwrite a staged description; reopen the card before editing).

### D4 slice 13 — library updates for lorebook entries and adventure templates (rest of K11, 2026-10-18)

- **What they compare against.** Lorebook entries and adventure templates keep no saved versions, so a Codex copy now
  pins the library's own details as it copied or last reviewed them (`snapshot.source_base`: name, alias, description,
  race, type, attributes, plus a `state_id` that is the SHA-256 of those details in canonical JSON). A lorebook entry
  is copied from the library as it is now (its lorebook read in the story's workspace), never from the request's
  snapshot; an incoming `source_base` is dropped and re-pinned by the BFF. Copies made before this slice have no base:
  they show a notice only when their details differ from the library's.
- **Notice.** `GET /stories/{id}/codex/library-versions` now returns `{versions, changed}`: `changed` lists copies whose
  library entry or template has a different state id from the pinned one, with the new state id. The Codex row shows
  *Library changed*.
- **Review and apply.** The slice 11 review, worded for a lorebook entry or adventure template; the base is the pinned
  details, so *Changed in the library / in this novel / in both* work as for cards. The review now also lists approved
  story facts applied to this entry (up to five statements) and warns when taking the library's description would
  leave them out. Applying sends `{op:'refresh', id, sourceVersionId: <state id>, take}`; the BFF re-reads the library
  for that request, refuses `STORY_CODEX_SOURCE_CHANGED` (409) when the state moved on, takes only the chosen fields
  and re-pins the base to the library's current details. The base is immutable for ordinary edits. Matching details
  count only details that exist (a lorebook entry has no race), which also fixes the count for cards.
- **Not here:** staging a fact into a lorebook entry (K12 library target) stays limited to versioned cards;
  `…/library-draft` answers `STORY_CODEX_NOT_LINKED` (404) for entries and templates.
- **Live check, real API (test novel *Assistant check (package restore, no history)*).** A test lorebook *Gull Point
  Lore (test)* with one entry, *The Tide Bell*, was added through *Codex → Add → Add lorebook*; the stored copy pinned
  its base. An approved author fact (“The Tide Bell rings once for a boat coming home.”) was applied to the entry from
  *Planning views → Facts*. The entry's text was then changed in the Lorebook Studio: the row showed *Library changed*;
  the review said *Changed in both*, listed the fact as left out by the library's text, and *1 detail already matches*.
  *Use library → Take 1 detail* → the copy holds the library's text, its base moved to the new state, the notice
  cleared, the library entry was not written. A refresh sent with the old state id was refused (409) and an `update`
  that forged `source_base` was refused (422); the context revision did not move. A test adventure template (empty
  card, premise only) was added through *Add cards → Adventures*, its premise changed in the creator: *Changed in the
  library*, selected by default; taking it updated the copy and cleared the notice.
- **Checks.** BFF Codex store, unversioned-source, package and copy tests 53 passed; story route tests 108 passed.
  Frontend Codex panel, novel utils/hooks and Codex contract tests 471 passed (new lorebook-entry review and contract
  tests); app typecheck clean. BFF log `.dev/logs/bff-novelk11lore-20261018T053217.log`.
- **Test data left in place:** lorebook *Gull Point Lore (test)*, adventure template *Gull Point test: a storm…*, both
  copies in the test novel's Codex, and the Tide Bell fact (its statement is no longer in the entry's text after the
  library's text was taken).
- **Seen during the check (outside this work):** a concurrent sweep that adds `useFeatureFlags()` to about 100
  components triggers Vite full reloads, which return an open studio to the novel library. It also logged
  `useData must be used within a DataProvider` from `BackgroundTasksProvider` during one reload.

### D4 slice 14 — approved facts written to the library lorebook entry (K12 lorebook target, 2026-10-18)

- **Where it starts.** An approved fact already applied to a Codex entry that copies a library lorebook entry (slice 13
  link) shows *Write to library lorebook entry…* in *Planning views → Facts*. The chain stays explicit: fact → the
  novel's Codex entry → that entry's own library lorebook entry. Offered only while the lorebooks feature is on.
- **Review.** Lorebook entries have no private draft, so the review opens with a warning: the library entry changes
  now; chats, adventures and novels that use the lorebook read the new text from their next turn; novels with a copy
  get the slice 13 notice; title, keys and activation settings stay as they are. It shows the fact and passage, the
  entry's text now, and the proposed text (the current text plus the statement as its own paragraph, editable). If the
  entry already holds the statement, nothing is proposed.
- **Guarded write.** `GET`/`POST /stories/{id}/codex/{refId}/library-entry` (also gated by the `lorebooks` feature). The
  read returns the entry's lorebook, title, text and a stamp of every stored detail (text, keys, activation settings).
  The write locks the entry with its lorebook in the story's workspace, refuses `STORY_LIBRARY_ENTRY_CHANGED` (409) when
  the stamp changed since the review (any Lorebook Studio save), refuses an archived or trashed novel, and updates only
  the entry's text. Adventure templates and cards are not targets here (`STORY_CODEX_NOT_LINKED`). The novel's own
  copy is not changed by the write.
- **Live check, real API.** Test novel → *Facts* → the Tide Bell fact (slice 13) offered *Write to library lorebook
  entry…*; the review showed the warning and proposed the entry's text plus the statement. While it was open, the
  entry's keys were saved through the lorebook API (as the Lorebook Studio does); writing was refused, the review said
  so and reloaded, and the library entry was unchanged. Writing again → the entry holds the fact, keeps the new key and
  its title; this novel's copy then showed *Library changed*, the review marked the description *Changed in the
  library*, and taking it put the fact back in the copy and cleared the notice. The template copy's
  `…/library-entry` read answered `STORY_CODEX_NOT_LINKED`.
- **Checks.** BFF lorebook-target store and route tests 8 passed; story route + Codex store tests 138 passed with them.
  Frontend novel tests 1,224 passed / 1 skipped, API tests 976 passed (the same 2 unrelated `sessionVoiceApi`
  failures); typecheck clean; lint of the edited files clean. The `:8010` BFF that loaded the new routes was started
  by another session at 05:54:58 (pid 4025947); this work's earlier BFF process (3988749) stopped listening and is
  still closing its connections.
- **Test data left in place:** the Tide Bell library entry now has the key `tide bell` and the fact as its own
  paragraph.

### D4 slice 15 — chapter-level outline proposals and grouped changesets (rest of A17, structure half of R14, 2026-10-18)

- **One write for several steps.** A new structure operation, `changeset`, applies 1–12 steps in order — create a
  part or chapter, move, move several scenes, split or merge scenes, split or merge chapters — as **one** structure
  revision. A later step names a unit an earlier step created as `{"created": n}`. Each scene's prose may change at
  most once per changeset; a new chapter that receives moved scenes drops its empty default scene; any step that
  cannot follow the ones before it refuses the whole changeset (422) and nothing changes. Because it is one revision,
  the existing undo reverses all of it: outline fields go back only where nothing changed them later, and the merged
  or split scenes get their prose back from checkpoints. Scene suggestions waiting for review still block the split
  and merge steps. *Organization history* names it *Apply outline changes* (Spanish: *Aplicar cambios de estructura*),
  and its Action filter offers it.
- **Chapter proposals.** The novel reply's `structure` changes may now also split a chapter at one of its scenes (a
  new titled chapter takes that scene and the ones after it), merge a chapter with the next one in the same part, move
  a chapter before another (or to the end of its part), or add a titled chapter after a named one and move 1–20 named
  scenes into it. Every chapter and scene must come from writable scenes of the reply's own source packet; the BFF
  normalizes the parts from that packet and the frontend verifier repeats every check. A new chapter is a two-step
  changeset (create, then move its scenes). Graph catalog hash updated (`novel_assistant`).
- **Reviewed together.** *Outline changes* describes each chapter change, with the same states as scene changes
  (*Ready*, *Already in the outline*, *Not possible now*). When more than one change is ready, *Apply all N ready
  changes together* sends them in the shown order as one changeset; the result offers one *Undo*. If they cannot all
  apply one after another, the card says so and asks to apply them one at a time.
- **Live check, real API (BFF restarted at 07:16 with the same command, pid 4124657).** New test novel *Changeset
  check (Tide Bell)*: Harbor (Scene 1, Counting boats, Storm gathers, Lamp lit) and Lighthouse; fictional text typed
  into Scene 1 and Counting boats in the Studio. A changeset whose second step named step 5 → 422, revision stayed 4.
  The four-step changeset (new chapter *The Storm* after Harbor, move Storm gathers and Lamp lit into it, merge
  Counting boats into Scene 1, move Lighthouse before Harbor) → one revision (4 → 5): Lighthouse, Harbor (Scene 1 with
  both paragraphs), The Storm holding exactly the two moved scenes. The Studio outline showed the same after reload.
  Text was then written in Storm gathers (scene revision 2). *Organization history* listed *Revision 5 · Apply outline
  changes*; *Review undo* listed all seven units; applying it → revision 6 (*Undo · Apply outline changes*): Harbor
  back to its four scenes, Scene 1 and Counting boats with their own text again, The Storm in Trash, Lighthouse
  second — and Storm gathers kept the text written after the changeset. Filtering history by *Apply outline changes*
  listed revision 5. No errors in the BFF log.
- **Real assistant turn, live (07:46).** Credits were available after all: the `free` plan's daily credit limit was
  raised from 20 to 50 at 06:39 CST outside this work (the account had used 21). The fictional text was extended to all
  five scenes, then *Writing assistant* → new conversation *Chapter proposals*, scope *This novel*, *Author analysis*,
  asked how to reorganize the chapters. The model replied with two chapter changes, stored and verified: *New chapter*
  “Storm” after Harbor with Storm gathers and Lamp lit (*Ready*), and *Move chapter* Lighthouse to the end of its part
  (*Already in the outline* — correct, Lighthouse was already last). *Apply change* → revision 7 (`changeset`): Harbor
  with Scene 1 and Counting boats, Storm with exactly the two moved scenes, Lighthouse last. *Undo* on the card →
  revision 8: Harbor back to its four scenes, Storm in Trash, the card back to *Ready*. One credit was used (plus one for
  a short question sent at 07:44 while checking the 402 message below).
- **Still not checked live:** *Apply all N ready changes together* on a real reply (this reply had only one ready
  change).
- **Seen during the live turns, and what was done (updated 08:15):**
  1. A normal streaming turn showed *This request has an uncertain result* for a few seconds before the reply
     arrived. **Fixed and checked live (08:05):** while the reply streams into the open tab the drawer says *The reply
     is arriving. You can stop it here; nothing changes in your novel until you review it.* with only *Stop request*
     (seen 170 times in a 100 ms poll; the uncertain copy 0 times while streaming). The uncertain-result copy and its
     Check/Resume buttons stay for a turn whose stream ended without a saved result.
  2. *Saved reply evidence* showed the answer's Markdown unrendered (`**New chapter**`). **Fixed and checked live:**
     the evidence modal renders the answer with the assistant's Markdown renderer (bold, lists, no `**`).
  3. The model said it could not tell the chapter order, because a free question's packet listed scenes by relevance
     only (`readingOrder` was sent only with an action). **Fixed and checked live (BFF restarted 08:01, pid 4171763):**
     every packet now carries `readingOrder`, rebuilt inside the budget check so it counts against the context budget
     as sources join. Validation on both sides still requires it with an action and keeps older replies saved without
     it valid when they had no action. Live: the prepared free-question packet held `readingOrder` (Harbor's four
     scenes, then Lighthouse) and the reply listed the chapters in that order.
  4. After reloading the gallery, the first click on *Open <novel>* did not navigate (seen three times). **Cause found,
     outside the novel work:** when the window is visible but not focused at load, `DataProvider` waits for focus
     before its first library load (`if (!pageFocused || !isPageFocused()) return`, since 2026-09-25). The first click
     focuses the window, that load starts as a blocking load, and `AppRouter` swaps the page for the library spinner
     between mouse-down and click, so the click is lost; the second click works. Not changed here (app shell).
  5. **New, seen in the 08:05 turn:** the model answered well but one proposed chapter change carried a field its kind
     does not use, and the strict check refused the whole reply (502 `ASSISTANT_ACTION_INVALID`): the answer was lost.
     No credit was charged (the server's *Check saved result* said so). **Fixed in code, not yet seen live:** each
     outline change is now checked on its own; one that does not fit (fields of another kind, a scene or chapter
     outside the packet, an excerpt that does not open a paragraph) is left out and counted in `structureOmitted`, and
     the reply is kept. The card says *The reply proposed N more outline change(s) that could not be used… Ask again
     to get it.* Record validation (BFF) and the frontend verifier accept the count only within what one reply holds
     (1 to 6 minus the kept changes). The log now names the mismatched field without provider text (for example
     `Field scenes does not match its kind`). More than six changes still refuse the reply. BFF restarted 08:14
     (pid 4184389, log `.dev/logs/bff-structureomitted-20261018T081406.log`). The same question, asked again at 08:15,
     completed: this time the model's one change was valid (*Split chapter* Harbor at Storm gathers, title *Storm*), so
     the left-out path itself was not hit live; it is covered by BFF and frontend tests. *Apply change* → revision 9
     (Harbor: Scene 1, Counting boats; Storm: Storm gathers, Lamp lit; Lighthouse), card *Already in the outline*;
     *Undo* → revision 10, Harbor back to four scenes, card *Ready* and *Undone. The outline is back as it was; later
     edits are kept.* First live check of a chapter split from a real reply. No errors in the BFF log. One credit used
     (account at 23 today; the failed 08:05 turn was refunded).
  6. **Also seen:** while a reply streams, the drawer also shows *The question, sources, profile or conversation
     changed. Prepare again before sending.* and *These sources belong to earlier choices…*, because the sent prompt
     no longer counts as the current review. Confusing during a stream; not changed yet.
- **Checks.** BFF changeset, proposal-normalization and record tests plus every novel, story, structure, history and
  agent-graph suite: 1,550 passed. Frontend novel, i18n and API tests 2,208 passed / 14 skipped (new: chapter-proposal
  contract, review-card and changeset-step tests); the only failures are the 2 known, unrelated `sessionVoiceApi`
  tests. Typecheck clean; lint of the edited files clean. Pre-edit copies:
  `.dev/backups/novel-structure-changesets-20261018/`; BFF log `.dev/logs/bff-novelchangesets-20261018T071652.log`.
- **Checks for the 08:00–08:20 fixes.** BFF assistant, novel and story service suites plus `tests/models`: 3,308 passed;
  the 11 failures are outside this work (`test_conversation_message_delete` 3, `test_conversation_reply_variants` 1,
  `test_membership_billing_sync` 4, `test_voice_preset_model` 1, `test_voice_preset_v2_model` 2 — adventure sessions,
  billing and voices). New BFF tests: reading order on free questions and older replies without it; left-out outline
  changes counted and kept in the record, with tampered counts refused. Frontend novel, API and i18n: 2,212 passed /
  14 skipped; failures: the 2 known `sessionVoiceApi` tests and one `NovelEditor` autocomplete test that passes when
  run alone (load timing). New frontend tests: reading order without an action, the `structureOmitted` bounds, and the
  card's left-out note. App typecheck: one error outside this work, `src/infrastructure/api/index.ts(212)`:
  `AvatarVariantId` declared but never used — that file was changed at 08:11 by other work in progress. Pre-edit
  copies of the BFF files: `.dev/backups/novel-structure-omitted-20261018/`.
- **Test data left in place:** the *Changeset check (Tide Bell)* novel at structure revision 10, with The Storm and two
  *Storm* chapters in Trash, and its assistant conversations *Credits check*, *Chapter proposals* and *Reading order check*.
- **Still open:** nothing for A17's outline half: part proposals are done in slice 17, and the prose half of R14 in
  slice 16. Item 6 above (the *Prepare again* copy during a stream) is fixed in slice 17.

### D4 slice 16 — several scenes' suggestions accepted as one manuscript changeset (prose half of R14, 2026-10-18)

- **What the author does.** In *Writing assistant* → *Saved reply evidence*, when the conversation holds suggestions
  for two or more scenes, a card *Suggestions in several scenes* lists the scenes (the latest suggestion of each, only
  while it was made for that scene's current saved text) and offers *Accept N suggestions together*. The result says
  *Accepted N suggestions as one change* with the scenes and one *Undo*. Undo puts each scene back where it still
  holds the accepted text, and names every scene it left alone and why: written in after the change, a suggestion
  waiting there, or removed / archived / read-only. The result stays on the card, whichever conversation is open,
  until *Dismiss*. 2–12 scenes per changeset. English and Spanish copy.
- **How it works.** A pure function (`applySavedGeneration`) applies a suggestion to a scene's *saved* document with
  the editor's own schema and commands (target, preview, accept), without mounting an editor, and returns the
  document and annotation-anchor edits; a test compares it with reviewing and accepting the same suggestion in the
  real editor (continue, selection rewrite, whole-scene rewrite and the assistant fixture). The studio first saves the
  open scene and requires no live suggestion or pending write (the same barrier as a single review), then checks each
  suggestion like a single review, loads each scene's saved document, applies the suggestion, and sends one request.
  While it runs the open scene is read-only and its writer paused; afterwards the outline reloads, so the open scene
  shows the accepted text, and the suggestions' history rows turn *accepted*. A response lost in transit is recovered
  by request ID; *Try again* resends the same request, never a newly prepared one.
- **BFF.** `POST /stories/{id}/generations/accept-together` (2–12 items: generation, scene, expected revision,
  document, optional anchor edits) runs each scene through the same checks and writing as a single accepted
  suggestion, all in one transaction with one receipt; any refusal writes nothing. `GET
  /stories/{id}/generation-changesets/{requestId}` returns the saved acknowledgement (or null).
  `POST …/generation-changesets/{requestId}/undo` writes each scene that still holds the accepted revision back to
  the revision before it, as a restore revision; other scenes are kept and reported (`edited`, `pendingSuggestion`,
  `unavailable`); nothing restorable → 409 `STORY_CHANGESET_NOT_UNDOABLE`. Idempotent by its own request ID. No
  schema change: the changeset is the operation receipt (`story_operation_receipt`).
- **Found and fixed during the live check.** The first live *Accept together* was refused (409
  `STORY_ASSISTANT_SOURCE_CHANGED`) and wrote nothing: under the commit lock each assistant suggestion is checked
  against the novel's current source version, and writing the first scene changed that version before the second
  scene's check. The changeset now reads the source version once, under the lock and before its first write, and
  checks every suggestion against it (`check_source_at_cursor(..., source_version=…)`; a single accept still reads
  the current version). BFF restarted 08:57 with the same command (pid 51011, log
  `.dev/logs/bff-togethersource-20261018T085733.log`).
- **Live check, real API and real assistant turns (08:40–09:05).** Test novel *Changeset check (Tide Bell)*, new
  conversation *Accept together check*, intent *Suggest edits for review*: one turn on Harbor · Scene 1 and one on
  Harbor · Counting boats, each a whole-scene rewrite (2 credits; the account is at 25 of 50 today). The card listed
  both scenes. *Accept 2 suggestions together* (Harbor · Scene 1 open in the editor) → 200: Scene 1 revision 4 → 5 and
  Counting boats 2 → 3 in one transaction, both revisions `ai` with their suggestion, both suggestions `accepted`, one
  receipt; the open editor showed the accepted text and stayed editable. Then *The tide turned at noon.* was typed into
  Scene 1 (saved as revision 6). *Undo* → 200, *Undone in 1 scene. Harbor · Scene 1 kept its text: it was written in
  after the change.*: Counting boats revision 4, a restore from revision 2 with revision 2's exact content hash; Scene 1
  still revision 6 with the typed sentence. Scene history: *Revision 5 · Accepted suggestion*, *Revision 6 · Saved
  draft*; the undo's revision reads *Restored draft · Restored from revision 2*. The result stayed visible after
  switching to a new conversation draft and cleared on *Dismiss*.
- **Checks.** BFF: changeset store (11, including the source-version check against the pre-write version), story
  routes, scene store and variant store — 162 passed. The wider BFF story/novel/assistant selection has 128 failures,
  all outside this work (feature-flag service unavailable in `test_assistant_routes`, schema-marker checks in the
  novel migration tests, an uninitialized MySQL pool, voice routes); `tests/test_voice_call_chat_integration.py` does
  not import (`VoiceOrchestrationEngine`, other work). Frontend novel tests 1,244 passed (new: the editor-equivalence
  test, the changeset hook test, and changeset contract tests); novel + API run 2,225 passed, with the only failures
  the 2 `sessionVoiceApi` tests, whose voice contract header moved from 4 to 5 in other work. App and story
  typechecks clean; lint of the new files clean. Pre-edit copies of the BFF files: `.dev/backups/novel-r14-together-20261018/`.
- **Test data left in place:** in *Changeset check (Tide Bell)*, the conversation *Accept together check*; Harbor ·
  Scene 1 at revision 6 (accepted text plus the typed sentence) and Counting boats at revision 4 (its earlier text).
- **Not covered yet.** A changeset with a selection rewrite or a continuation from a real reply (the live turns were
  whole-scene rewrites; the other operations are covered by the equivalence test), and accepting a suggestion
  together with an authored version (variant) of it — a variant is still applied on its own.

### D4 slice 17 — part proposals, and a quiet drawer while a reply streams (rest of A17, 2026-10-18)

- **What the author does.** Asked to group chapters into parts, the assistant can now propose *New part* changes on
  the same outline card: a part with a title that starts at a chapter and takes that chapter and the ones after it in
  its part (for chapters outside any part: the later chapters outside parts). The card lists the chapters it takes and,
  when the novel already has parts, where the new part goes (*It follows “X”, which keeps its earlier chapters…* or
  *It goes before the existing parts…*), so the reading order never changes. Apply one, or every ready one together;
  one Undo either way. A part cannot start at the first chapter of a part (the card says *Not possible now*).
  Proposals for several parts end in the same outline whichever order they are applied in. English and Spanish copy.
- **How it works.** New reply kind `new_part` `{chapter, title}` in the novel assistant graph
  (`src/agent_graphs/runtime/novel_assistant.v2.json`; catalog hash updated). The server normalizes it to
  `{kind, chapterId, partId, title, reason}`, where `partId` is the part the chapter was in when the reply read it;
  the frontend verifier requires it to match the packet. It is applied with a new changeset-only structure step,
  `start_part` `{id, title}`: it creates the part, places it right after the chapter's part (or first among the parts,
  for chapters outside parts) and moves the chapter and the ones after it into it; on its own, outside a changeset, it
  is refused. The card reads *Already in the outline* once the chapter opens a part with that title other than the one
  the reply saw.
- **Streaming copy fixed.** While a reply streamed (and after it), the drawer kept the prepared review with *The
  question, sources, profile or conversation changed. Prepare again before sending.* and *These sources belong to
  earlier choices…*. The assistant hook now remembers which prepared review was sent (`reviewSent`) and the drawer
  hides that review from then on; the request state (*The reply is arriving…*) and the reply's saved evidence say what
  the turn read. Preparing again shows the new review as before.
- **Live check, real API and a real assistant turn (09:21–09:27).** BFF restarted 09:20 with the same command (pid
  74695, log `.dev/logs/bff-newpart-20261018T092026.log`). *Changeset check (Tide Bell)*, new conversation *Part
  proposals*, scope *This novel*, *Author analysis*, asked to make Harbor the first part and Lighthouse the second
  (1 credit). A 100 ms poll during the turn: *The reply is arriving* 125 times, the *Prepare again* copy 0 of 317 ticks
  (stream and after). The reply proposed two *New part* changes, “Harbor” at Harbor and “The Keeper” at Lighthouse, and
  explained that applied together each chapter gets its own part. **Seen and fixed:** the placement note said *It comes
  before the other parts* in a novel with no parts yet, which for “The Keeper” was wrong when applied together (it ends
  after Harbor); the note now shows only where parts already exist. *Apply all 2 ready changes together* → revision 11
  (`changeset`): part Harbor (order 0) with Harbor, part The Keeper (1) with Lighthouse; both cards *Already in the
  outline*; history *Revision 11 · Apply outline changes*. *Undo* → revision 12: chapters outside parts again, both
  parts in Trash, cards *Ready*. The reverse order, one at a time: The Keeper → revision 13 (Harbor, outside parts,
  still reads first), after which the Harbor card said *It goes before the existing parts, so the reading order stays
  the same.*; Harbor → revision 14, the same outline as applying together. *Undo* on the card → 15; Organization
  history *Review undo* showed *Part · The Keeper* going away and *Chapter · Lighthouse* from *The Keeper · Position 1*
  to *Novel · Position 2*; applied → revision 16, the original outline. All six structure writes 200; no errors in the
  BFF log on these routes.
- **Checks.** BFF: assistant-result and changeset tests 66 passed (new: a new part round-trips with a writable packet
  chapter and a title; parts started in either order keep the reading order and undo in one step; `start_part` only
  inside a changeset); catalog and agent-graph tests 563; novel and story service and model tests 1,270. Frontend
  novel, API and i18n: 2,232 passed / 14 skipped, the only failures the 2 known `sessionVoiceApi` tests (new: the
  `new_part` contract, state and steps, card text and placement, `reviewSent`). App and story typechecks clean; lint of
  the edited files clean. Pre-edit copies of the BFF files: `.dev/backups/novel-part-proposals-20261018/`.
- **Test data left in place:** the conversation *Part proposals*; the novel at structure revision 16, with two
  *Harbor* and two *The Keeper* parts in Trash.
- **Not covered live:** a new part that splits an existing part (the novel had none; covered by BFF and frontend
  tests).

### D3 named assistant actions (A06–A09, A12–A14, 2026-10-17)

- **What the author picks.** The writing assistant shows an *Action* picker above the composer. Free question (the
  default) or one of: *Point of view or tense* (first/second/third person and past/present; at least one changes),
  *Line edit* (grammar, clarity, repetition, rhythm, word choice), *Dialogue* (a named speaker), *Bridge passages*,
  *Brainstorm* (premise, conflict, stakes, names, what if), *Outline or synopsis* (synopsis, beats, chapter plan) and
  *Summary*. The first four set the task to Suggest and return a reviewable proposal through the existing review →
  accept → undo flow. The last three set it to Ask and answer in cited prose. Picking an action fills the composer
  with its instruction ("Rewrite this in first person, present tense."). The instruction follows later parameter
  changes until the author writes their own words. The prepared-turn review shows *Prepared action*.
- **Contract.** `StoryAssistantContextRequest.action` is optional, never null and absent unless chosen, so earlier
  requests and frozen records keep their exact shape. Each kind has exact parameters, and a kind needs its own task
  (`transform`, `line_edit`, `dialogue`, `bridge` → `suggest`; `brainstorm`, `outline`, `summary` → `ask`); a mismatch is
  a 422. The packet carries the same `action` plus `readingOrder`, the source scene IDs in reading order. Sources list
  the anchor scene first, and the first live summary followed that order instead of the story's. The frozen-record
  checks on both sides require packet and request to hold the same action, and require `readingOrder` to be present
  exactly when an action is, as a permutation of the sources. The graph prompt (`novel_assistant.v2.json`, catalog
  hash `28fbca04…f466f2`) and the context `SYSTEM` text describe each action. Plan steps and refinements, which set
  their own task, drop any chosen action.
- **Device drafts.** A half-chosen action (no change picked, no focus, a speaker still being typed) stays recoverable
  in the device draft but cannot be prepared. The speaker is trimmed when the request is built.
- **Live check, real API (claude-sonnet-5.5).**
  - *Transform* on Chapter 1 · Scene 3 → a `replace_scene` proposal in first person, present tense, with the same
    events. The answer noted that the scene's "Twelve winters" disagrees with the approved fact (eleven).
  - *Summary* over This chapter → a cited scene-by-scene answer. The first run followed packet order (Scene 3 before
    Scene 1). After `readingOrder` was added, the rerun summarized Scene 1, then Scene 3.
  - Request and packet in the saved records hold the action. Both device drafts reloaded valid after an app remount.
  - Line edit, dialogue, bridge, brainstorm and outline are covered by contract and component tests and the prompt
    text, not yet by a live turn.
- **Checks.** BFF assistant context, result, novel handler, route, store, graph and readiness tests: 303 passed
  (new: action packet/reading order, task and parameter refusals, frozen action and order corruption). Frontend novel
  + API: 2,064 passed / 14 skipped (new contract and picker tests); the same 2 unrelated `sessionVoiceApi` failures.
  Typecheck clean with 0 errors: the 19 interaction errors were fixed by their owner. `pnpm build` passes. Lint of the
  edited files clean. One unrelated BFF failure from in-progress speech-catalog edits
  (`test_the_root_synth_lab_renders_through_the_real_app_gate`: model alias `el_flash_v2_5` no longer accepted).
  BFF log `.dev/logs/bff-assistantactions-20261017T191439.log`; backups in
  `magic-worlds-api/.dev/backups/novel-assistant-actions-20261017/`.
- **Test data:** conversations "Action check: transform", "Action check: summary" and "Action check: summary order"
  on the Assistant check novel; no manuscript change was accepted.
- **Still open:** a bridge without a selection needs the next scene in its sources, which the author has to include
  (author analysis). Summaries are answers tied to the revisions they read, not stored summaries with dependency
  invalidation (K09). There is no style/voice sheet input yet (N15, K08).

### D5 slice 1 — whole-manuscript export (X03, parts of X06 and X10, 2026-10-17)

- **Where.** *More → Export manuscript* in the novel. Formats: Word (.docx, the default), Markdown and plain text.
  Choices: title page, part titles, chapter titles, scene titles, include archived scenes, and (Word only) start parts
  and chapters on a new page.
- **Summary before download.** Every change of choice reads the saved outline's current source version and then
  `POST /stories/{id}/export-preview`. The summary shows the scenes and chapters included, the word count, the size,
  the file name and the SHA-256. It also lists each scene left out and why: in the trash, merged, archived, or
  *Include in export* off. Format notes report planning beats left out, highlights dropped, Codex mentions written as
  names, links and lists written as text in Word, scene headings moved below the structure headings, and included
  scenes with no saved text. Only saved account text is exported. Personal notes, highlights and planning beats are
  never in the file.
- **Download.** `GET /stories/{id}/export?sourceVersion=…&format=…&…` compiles the same file in one read
  transaction. The outline must still be at the reviewed source version, and each scene document must match its
  saved revision and content hash; otherwise the request gets a 409 `STORY_EXPORT_SOURCE_CHANGED`. Output is
  deterministic: the Word package uses fixed zip timestamps. The frontend accepts the file only when its size and
  SHA-256 equal the summary's. Otherwise it reads the summary again and asks the author to review it, instead of
  saving a different file.
- **Formats.**
  - *Markdown:* YAML front matter with title and language, headings, bold, italics, strikethrough, links, quotes and
    lists. A paragraph that starts like Markdown syntax is escaped.
  - *Plain text:* UTF-8, uppercase title, `* * *` scene breaks, text bullets.
  - *Word:* a minimal WordprocessingML package written without new dependencies. It has Title and Heading styles
    (outline levels), a flush first paragraph, indented body paragraphs, centered scene breaks, quote and list-text
    styles, the document language and the core title.
  - A scene break goes only between two scenes that both hold text.
- **Live check, real API and data.**
  - On the Assistant check novel, the dialog summarized 4 scenes in 2 chapters (161 words, 2.9 KB) and left out
    Chapter 2 · Scene 2 (in the trash).
  - Each format was fetched in the page through the app's scoped API client. Size and SHA-256 matched the summary,
    and the Markdown, text and Word hashes equal those of a server-side compile of the same version.
  - A tampered hash and a stale source version were both refused (409).
  - The first run showed two scene breaks around an empty scene; that was fixed (empty scenes are now a note).
  - LibreOffice opened the Word file and converted it to text and to a 3-page PDF (title page, Chapter 1, Chapter 2).
    The rendered page shows the heading, paragraph and scene-break styles.
  - The browser *Download* button itself was not clicked, because it saves a file on this machine.
- **Checks.** BFF export service, store and route tests are new (15 + the route workspace and archived-workspace
  checks); BFF story, novel and route suites: 918 passed. Frontend novel + API: 2,069 passed / 14 skipped (new
  contract and dialog tests); the same 2 unrelated `sessionVoiceApi` failures. Typecheck 0 errors; `pnpm build`
  passes; lint of the edited files clean. BFF log `.dev/logs/bff-novelexport-20261017T193050.log`; backups in
  `magic-worlds-api/.dev/backups/novel-export-20261017/`.
- **Still open in D5:** see slice 2 below.

### D5 slice 2 — EPUB export (X04, 2026-10-17)

- **Where.** *EPUB* is a fourth format in *More → Export manuscript*. It uses the same choices, summary, source-version
  check and SHA-256 verification as slice 1. The Word-only page-break switch is hidden, because every chapter is its
  own EPUB page anyway.
- **Package.** An EPUB 3 package written with the standard library only:
  - `mimetype` comes first and is stored uncompressed; `META-INF/container.xml` points to `EPUB/package.opf`.
  - The OPF holds a stable `urn:uuid` identifier per novel, so a newer export replaces the same book in a reader. It
    also holds the title, the language (`und` when the novel has none), the synopsis as `dc:description` when one is
    saved, and `dcterms:modified`, set from the newest saved change among the exported units (DB times are UTC).
  - `nav.xhtml` holds the table of contents, with chapters nested under a shown part title, plus hidden landmarks.
  - There is one XHTML file for the title page, one per shown part title, and one per chapter, with
    `epub:type`/`role` chapter and part sections. A small stylesheet sets the indents and the centered `* * *` break.
  - Fixed zip timestamps keep the output deterministic.
- **Text.** Unlike Word, EPUB keeps real lists (`ul`/`ol` with start number), links, quotes, bold, italics and
  strikethrough. Highlights, planning beats and empty paragraphs are left out, and Codex mentions become their names.
  A chapter file never opens with a scene break. The word count is the same as in the other formats.
- **Live check, real API and data.**
  - On the Assistant check novel, the dialog summarized 4 scenes in 2 chapters, 161 words, 3.4 KB.
  - The file was fetched in the page through the app's scoped API client. Size and SHA-256 matched the summary
    (`2da3c215…`), and they equal a server-side compile of the same version from the database.
  - In the page, the zip entries were inflated and every XHTML/OPF/XML file parsed with the browser's strict XML
    parser. `mimetype` was first and stored.
  - The title page, contents and both chapters were rendered as `application/xhtml+xml` in the browser: headings,
    first-paragraph and indent styles, and the scene break show as intended. The contents links point to both chapters.
  - The W3C EPUBCheck validator is not installed here and was not downloaded, so formal validation remains open.
- **Checks.** Two new BFF EPUB tests check the package structure, manifest/spine references, the nav item, well-formed
  XHTML, determinism, real lists and links, nested part contents, the `und` fallback and a chapter never opening with
  a break. Export service and store tests: 17 passed; BFF story, novel and export suites: 808 passed. Frontend novel +
  API: 2,068 passed / 14 skipped. The same 2 unrelated `sessionVoiceApi` failures remain. One `NovelEditor`
  autocomplete test timed out under full-suite load and passes on its own (twice). Typecheck 0 errors; `pnpm build`
  passes; lint of the edited files clean. BFF log `.dev/logs/bff-novelepub-20261017T194428.log`; backups in
  `magic-worlds-api/.dev/backups/novel-epub-20261017/`.
- **Still open in D5:** see slice 3 below.

### D5 slice 3 — real Word lists and links, and a contents page (X03, part of X06, 2026-10-17)

- **Word lists.** Lists are Word numbering now, not text bullets. The file has a `numbering.xml` part with bullet
  and decimal definitions for nine levels. Each list is its own numbering instance, so an ordered list restarts at its
  saved start number. A later paragraph in a list item lines up with the item's text. Markdown and plain text keep
  their written markers.
- **Word links.** Links are real hyperlinks: each destination is one external relationship, shown in a *Hyperlink*
  character style. The editor only allows http, https, mailto and tel links, so every link is kept. The *links/lists
  written as text* notes are gone from the summary.
- **Contents page.** There is a new *Contents page* choice for Word and EPUB, off by default.
  - *Word:* a contents heading, named in the novel's language, and a TOC field after the title page. Its cached
    entries link to bookmarks on each part and chapter heading. `settings.xml` asks Word to update fields on opening,
    which fills in the page numbers; in LibreOffice, *Update index* does the same.
  - *Word without part or chapter titles shown:* the contents page is left out, and the summary says so
    (`contents_omitted`).
  - *EPUB:* the navigation page joins the reading order after the title page.
  - The download URL and the frontend contract carry the new choice; Markdown and plain text ignore it.
- **Word schema order.** Paragraph and run properties are now written in the order the WordprocessingML schema sets.
  This fixes several slice-1 styles (title, headings, scene break, quote, list), which LibreOffice accepted but
  strict Word readers can reject. A test checks the order of every property list in each part.
- **Live check, real API and data.**
  - I created a new test novel, *Export check (test novel)*, in the same workspace through the app's API. It has two
    chapters: one with nested bullet lists, an ordered list starting at 3 with a continuation paragraph, and an https
    link and a mailto link; one with plain prose. No existing novel was changed.
  - In the dialog with *Contents page* on, the summary showed 2 scenes in 2 chapters, 77 words, 4.2 KB, and no
    format notes.
  - The Word, EPUB and Markdown files were fetched in the page through the scoped client. Each matched its summary,
    and the Word (`411d3382…`) and EPUB (`12ffe443…`) hashes equal a server-side compile from the database.
  - LibreOffice converted the Word file to text and to a 4-page PDF (title page, contents, two chapters).
    - It shows real bullets with a nested level, the ordered list numbered 3 and 4, and blue underlined links.
    - The PDF carries both link targets as URI annotations.
    - The contents page lists both chapters as internal links; page numbers appear after an index update.
  - Microsoft Word itself is not available here.
- **Checks.**
  - BFF: export service and store tests 19 passed (new: numbering and nesting, contents in Word/EPUB/Spanish,
    contents omitted, schema order); BFF story, novel and export suites 810 passed.
  - Frontend novel + API: 2,069 passed / 14 skipped. The same 2 unrelated `sessionVoiceApi` failures remain.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files clean.
  - BFF log `.dev/logs/bff-noveldocx-20261017T200236.log`. Backups in `magic-worlds-api/.dev/backups/novel-docx-20261017/`
    and `magic-worlds/.dev/backups/novel-docx-20261017/`.
- **Still open in D5:** see slice 4 below.

### D5 slice 4 — front and back matter (most of X06, 2026-10-17)

- **Where.** A chapter's *Organize & details* panel has a new *Export section* field. The choices are *Main text* (the
  default), six front-matter roles (copyright page, dedication, epigraph, foreword, preface, introduction) and five
  back-matter roles (afterword, acknowledgments, appendix, glossary, about the author). The role is stored as
  `details.exportRole`. The outline shows it as a badge, and conflict comparison and snapshot field labels name it.
- **Rules.**
  - Only chapters take a role. The BFF refuses it on parts and scenes (`Only chapters take an export role`), and
    unknown roles are refused on both sides.
  - Roles are not inherited, and writing them never changes the manuscript.
- **Placement.** Every format puts front matter before the main text and back matter after it, keeping reading
  order within each group.
  - Copyright, dedication and epigraph pages come first, with no heading (the chapter title stays an outline name);
    the contents page follows them.
  - The other roles open with their title at the top level, outside any part, even when chapter titles are off.
  - Each manifest scene row carries its `role`, and the dialog lists the front and back matter the file holds.
- **Formats.**
  - *Word:* untitled pages start on a new page, with Copyright, Dedication (centered italic) or Epigraph (indented
    italic) styles. Their first paragraph opens lower on the page, and the text after them starts a new page. A scene
    break is not written where a page break already separates the text.
  - *EPUB:* each matter chapter is its own file (for example `dedication-001.xhtml`). It carries `epub:type`
    (`dedication`, `foreword`, `copyright-page`…) and the matching DPUB-ARIA role, inside a `frontmatter` or
    `backmatter` body. Untitled pages have no contents entry, and the *bodymatter* landmark points at the first main
    chapter.
  - *Markdown and plain text:* an untitled page is set apart from the text before it with a scene break; titled
    matter gets its heading.
- **Live check, real API and data.** On *Export check (test novel)*:
  - Through the app, I created a chapter *For Mara* at the end (organization review, then *Apply change*) and set it
    to *Front matter · Dedication*; I set *After the storm* to *Back matter · Afterword*. Both saved through the chapter
    route and read back from the studio index.
  - I wrote the dedication text through the scene API. Setting a role on a scene was refused by the live BFF (422)
    and left it unchanged.
  - With *Contents page* on, the dialog showed 3 scenes in 3 chapters, 91 words, *Front matter: Dedication* and *Back
    matter: Afterword*.
  - The Word, EPUB and Markdown files matched their summaries, and the Word (`1e28cc0f…`) and EPUB (`441627bc…`)
    hashes equal a server-side compile. The dedication moved from last in reading order to first in every file.
  - EPUB spine: title, dedication, contents, chapter, afterword. The contents page lists the chapter and the
    afterword only.
  - LibreOffice rendered the Word file as 5 pages: title, a centered italic dedication with no heading, contents,
    chapter, afterword.
- **Checks.**
  - BFF: export, store and unit-metadata tests 49 passed (new: placement and roles in every format; role validation
    per unit); story/novel/export/unit-metadata suites 1,237 passed.
  - One failure is outside this slice: `test_query_contract_limits::test_story_repository_validates_bypass_inputs_at_db_boundaries`
    (`_validate_chapter_input` refuses `body, order` in `models.py`, which has other uncommitted edits).
  - Frontend novel + API + shared: 2,297 passed / 14 skipped. The 2 `sessionVoiceApi` failures and a
    `fishAudioSupport` failure are voice-contract work outside this slice.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files clean.
  - BFF log `.dev/logs/bff-novelmatter-20261017T201416.log`. Backups in `.dev/backups/novel-matter-20261017/` in both
    repositories.
- **Still open in D5:** see slice 5 below.

### D5 slice 5 — manuscript import (X01, X02, 2026-10-17)

- **Where.** The novel library has an *Import manuscript* button next to *New novel*. It opens a dialog that takes one
  Markdown (`.md`, `.markdown`), plain-text (`.txt`, `.text`) or Word (`.docx`) file of up to 10 MB. PDF, EPUB, older
  Word (`.doc`), RTF and OpenDocument are named as unsupported, with what to do instead. (EPUB, RTF and OpenDocument text are read since
  [slice 10](#d5-slice-10--epub-opendocument-and-rtf-import-rest-of-x01x02-2026-10-18).)
- **Preview first.** Nothing is saved until the author creates the novel.
  - The BFF converts the file and returns the proposed title, language, word count, parts, chapters, scenes (with
    word counts and a short excerpt) and a list of what the conversion changes.
  - The author can rename the novel, choose which heading level starts chapters (*Detect from headings* or heading
    1–6), and choose whether scene breaks start a new scene. Each change previews again.
  - The app checks that the preview describes this very file (its size and SHA-256) and the chosen options.
- **Commit.** *Create novel* sends the same file with the reviewed `sourceHash`, `importVersion` (a hash of the
  converted novel) and options.
  - The BFF converts the file again and refuses with `STORY_IMPORT_SOURCE_CHANGED` or `STORY_IMPORT_VERSION_CHANGED`
    if either differs. The dialog then previews again.
  - The request id makes the import idempotent, with the same rules as creating a novel (workspace lock, exact replay,
    `STORY_REQUEST_ID_REUSED`, `STORY_ERASED`). A lost response is recovered from its receipt.
  - The novel, its parts, chapters, scenes, first checkpoints and statistics, a first structure revision recording
    the import, the original file and the receipt are written in one transaction. The app then opens the novel.
- **The original file is kept.** A new table, `story_import_source`, holds the uploaded bytes, their SHA-256 and the
  import record. It belongs to the novel and is deleted with it (`ON DELETE CASCADE`). The novel's origin panel shows
  the file name, format, date, counts and losses, and *Download original file*; the download must match the recorded
  size and hash.
- **Structure.** Chapter-like headings (*Chapter 3*, *Capítulo 3*, *Prologue*…) decide the chapter level. Otherwise,
  top headings that open directly onto lower headings are the book's title or its parts. A single top heading that
  matches the file's title becomes the novel title. Lower headings stay inside their scenes. Text before the first
  chapter goes to an *Opening* chapter; a file without headings becomes *Chapter 1*.
- **What each format keeps.**
  - *Markdown:* front-matter title and language; ATX and underlined headings; bold, italics, strikethrough; links
    (http, https, mailto and tel); quotes; nested ordered and bullet lists with their start number; scene breaks
    (`***`, `---`, `#`, `§`, `* * *`).
  - *Plain text:* paragraphs at blank lines; chapter and part lines; scene-break lines. Hard-wrapped prose is joined.
  - *Word:* the document title and language; heading styles and outline levels; bold, italics and strikethrough
    (including from styles); hyperlinks; list numbering with its start number and continuation; quote styles; line
    breaks. Field codes such as page numbers are dropped; their visible text is kept.
- **Reported losses.** Images and drawings, footnotes, comments, embedded documents, unsupported links and HTML are
  left out; tables and code become plain text; tracked insertions and deletions are accepted; a table of contents is
  skipped; titles over 255 characters are shortened. Each is counted in the preview and kept in the import record.
- **Safety.** The BFF caps the upload (10 MB), unpacked size (64 MB), package members, chapters (2,000) and scenes
  (20,000). It refuses XML with a DTD or entities (`STORY_IMPORT_UNSAFE`), password-protected Word files
  (`STORY_IMPORT_ENCRYPTED`), old `.doc` files (`STORY_IMPORT_LEGACY_WORD`), non-UTF-8 text and damaged packages. It
  never follows external references, and parsing runs off the event loop. Only the file's own name is kept.
- **Database.** The table was added with the reviewed scoped-upgrade pattern: revision `2026_10_novel_imports`, script
  `scripts/migrations/20261017_novel_imports.py`. I took a private predecessor backup with row fingerprints
  (`.dev/backups/novel-imports-pre-20261018T024318Z-6042a9c9.sql.gz`, 114 tables, 5,334 rows), ran the read-only
  check, then applied it. All 5,333 pre-existing rows were verified unchanged.
- **Live check, real API and data.**
  - I made a Word file in LibreOffice from HTML (two parts, three chapters, bold, italics, a link, a bullet list, a
    quote, a scene break, an image, a numbered list and a table) and picked it in the dialog.
  - The preview showed 2 parts, 3 chapters and 4 scenes, 109 words, language en-US, *1 image or drawing left out* and
    *1 table kept as plain paragraphs*. *Heading 1* previewed again as 2 chapters with the chapter headings kept inside
    the scenes; *Detect from headings* restored the first outline.
  - I renamed it *The Lighthouse Keeper (import check)* and created it. The app opened Chapter 1, Scene 1, with bold,
    italics, the link and the list intact.
  - The saved novel has the two parts, the three chapters in their parts with 2, 1 and 1 scenes, and language en-US.
    The origin panel showed the file, date, counts and losses. The original downloaded through the API has the same
    size (8,186 bytes) and SHA-256 (`ba2db13c…`) as the local file.
  - *Add scene* then saved structure revision 2 after the import's revision 1; history reads both.
  - Exporting *Export check (test novel)* to Word and Markdown and previewing each back gave the same chapter titles
    in the same order. One gap: an untitled dedication has no heading in the exported file, so it comes back as an
    *Opening* chapter. Front and back-matter roles are not restored on import. EPUB is refused as unsupported.
- **Checks.**
  - BFF: import, store, route and migration tests plus export, creation and story-route suites 289 passed (new:
    Markdown, text and Word features, refusals, chapter-level choice, reviewed-version determinism, Word and Markdown
    round trips of an exported novel; one-transaction commit, replay, reuse, erasure and original-file reads; the
    upload routes).
  - The full BFF test collection stops at `tests/test_voice_call_chat_integration.py`, which imports a name the
    in-progress voice work removed; I left it as found.
  - Frontend novel + API + shared: 2,305 passed / 14 skipped. The 2 `sessionVoiceApi` failures and a
    `fishAudioSupport` failure are voice-contract work outside this slice.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files clean.
  - BFF log `.dev/logs/bff-novelimport-20261017T204341.log`. Backups in `.dev/backups/novel-import-20261017/` in both
    repositories.
- **Still open in D5:** see slice 6 (the generated glossary is done there).

### D5 slice 6 — glossary from the Codex (rest of X06, 2026-10-17)

- **Where.** The *Export manuscript* dialog has a *Glossary* group with *Add a glossary from the Codex*. Turning it on
  reads the novel's Codex entries (only then) and lists the enabled, not-removed ones by name, each with the first
  paragraph of its description. The author ticks the terms to include (up to 200), or uses *Choose all* / *Clear*. A
  note says descriptions can hold private notes or spoilers, so each definition should be checked before sharing.
- **Request and summary.** The chosen Codex reference ids travel as `glossary` on the export preview and download. The
  BFF refuses an id that is not an enabled Codex entry of this novel (422). The summary lists each term
  (`glossary: [{refId, term}]`), the app checks that it names exactly the chosen entries, and the dialog shows
  *Glossary: N terms*. The word count includes the glossary.
- **What is written.** Terms are sorted alphabetically (ignoring case). Each definition is the first paragraph of the
  card's description on one line, cut near 1,000 characters.
  - The glossary goes after the author's own chapter marked *Glossary* if there is one, otherwise just before *About
    the author*, otherwise at the end. Its heading is localized for the novel's language (English, Spanish, French,
    German, Italian, Portuguese).
  - *Word:* a *Glossary* heading on a new page, then one paragraph per term with the term in bold.
  - *EPUB:* its own back-matter file with `<dl epub:type="glossary">`, `glossterm`/`<dfn>` and `glossdef`, and
    `role="doc-glossary"`, listed in the contents.
  - *Markdown:* `# Glossary` then `**Term**: definition`. *Plain text:* the same without the markup.
- **Live check, real API and data.** On *Assistant check (test novel)* I turned the glossary on in the dialog. It listed
  the novel's one enabled Codex entry, *Mara*, with its description. Ticking it changed the summary from 161 to 173
  words and showed *Glossary: 1 term*. Reading the files through the API in the page:
  - Markdown ended with `# Glossary` and `**Mara**: Test card for the Assistant check novel. A quiet lighthouse
    keeper.`
  - EPUB had `EPUB/glossary-001.xhtml` with the `<dl epub:type="glossary">` entry, listed in the navigation.
  - Word had the *Glossary* heading with a page break before it and *Mara* in bold before the definition.
- **Checks.**
  - BFF: novel, story, export, import, migration and schema tests 1,598 passed. While running them I updated three
    stale novel tests left from the scene refactor: the user-data wipe now lists `story_erase_record`, the streaming
    test uses `sceneId` and `baseRevision`, and the chapter-input limit test drops the removed `body`/`order` fields.
    The one remaining failure, `test_speech_import_boundary`, is about ElevenLabs model ids in the in-progress voice
    work; I left it as found.
  - Frontend novel + API + shared: 2,306 passed / 14 skipped; the same three voice-contract failures as before.
  - `pnpm build` passes; lint of the edited files clean.
  - BFF log `.dev/logs/bff-novelglossary-20261017T205453.log`. Backups in `.dev/backups/novel-glossary-20261017/` in
    both repositories.
- **Still open in D5:** see slice 7 (goals and the writing log are done there).

### D5 slice 7 — goals, deadline and writing log (N12, U07, U08, 2026-10-17)

- **Goals.** The novel's details now have *Deadline* (a calendar date in the author's own time zone) and *Daily target*
  (words a day, 1–1,000,000) next to the existing novel word goal. Both are kept in the novel's revision-checked details
  object, so they save, conflict, compare and recover like the other details. The BFF refuses a date that does not exist
  or is before 2000, and a daily target that is not a whole number in range.
- **Writing log.** Every saved scene edit now records its word change in the same transaction as the save.
  - A new table, `story_writing_log`, keeps 15-minute UTC buckets per novel, with typing (`author`) and accepted AI
    proposals (`ai`) apart: words added, words removed and saves. Every real time-zone offset is a multiple of 15
    minutes, so any time zone can group the buckets into exact local days.
  - The change is the scene's saved word count after the save minus before it, using the revision-bound statistics
    cache (or a fresh count when the cache is stale). A save with no word change still counts as a save. When native
    word counting is unavailable, nothing is logged rather than guessed.
  - Imports, copies, restores, moves, splits and find-and-replace are not writing and are not logged. Replays of the same
    request return their receipt and are not logged twice. The log belongs to the novel and is deleted with it
    (`ON DELETE CASCADE`); copies start without it.
- **Progress view.** *More → Writing progress* reads `GET /stories/{id}/writing-progress?timeZone=…&days=…` (up to
  366 days; the BFF groups days with the IANA zone and refuses an unknown one with `STORY_TIME_ZONE_INVALID`, after which
  the app reads in UTC and says so). The app checks that the reply is this novel's, in the asked zone and window, with
  ordered in-window days. It shows:
  - the novel goal with saved active words and a bar (an unavailable saved total is shown as unavailable, never zero);
  - the deadline with days left, today included, and the words a day that reach the goal, or how long ago it passed;
  - today's net words against the daily target, words added and removed, and accepted AI words apart (*not counted as
    your writing*);
  - an optional streak (days in a row with words added), switched on per account on this device;
  - the last 14 days as a table (net words by you and by AI) and a 30-day total with the average per writing day;
  - what is and is not counted, and which time zone the days follow.
- **Task list.** U08's task list is the existing *Tasks & stash* (R10).
- **Docker.** The runtime image now installs `tzdata`, so the BFF can resolve IANA time zones.
- **Database.** One additive table with the reviewed scoped-upgrade pattern: revision `2026_10_novel_writing_log`, script
  `scripts/migrations/20261017_novel_writing_log.py`. The first apply refused because `voice_preset` rows changed between
  my backup and the apply (outside voice work writing at the time); nothing was changed. I took a new private backup
  with row fingerprints (`.dev/backups/novel-writing-log-pre-20261018T031029Z.sql.gz`, 115 tables, 5,389 rows) and applied right after it; all 5,388 pre-existing rows were
  verified unchanged.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*, browser time zone America/Mexico_City):
  - Before any goals, the view said *No novel goal yet*, *No deadline*, *No daily target*, and *today* was Oct 17 while
    UTC was already Oct 18.
  - In *Organize & details* I set the word goal to 1,000, the deadline to 2026-11-30 and the daily target to 200 and
    saved; the database has `word_goal` 1000, `deadline` "2026-11-30" and `dailyWordGoal` 200.
  - I typed a 25-word sentence in Scene 3 (log: author +25, 1 save), deleted a word and saved, then typed 10 more
    words. The view showed *143 of 1,000 words*, *Deadline November 30, 2026: 45 days left, today included*, *About 20
    words a day*, *34 words written today*, *35 added · 1 removed* and *34 of 200 for today*. The streak switch showed
    *1-day streak*.
  - *Continue* generated a 486-word proposal, which I accepted. The log has a separate `ai` row (+486, 1 save), and the
    view showed *629 of 1,000 words*, *About 9 words a day* and *486 words from accepted AI proposals, not counted as
    your writing*, with today's own words still 34.
  - One wording bug found live (*1 writing days*) was fixed with plural forms.
- **Checks.**
  - BFF: novel, story, export, import, writing-log, migration, schema and wipe tests 1,691 passed (new: bucket
    arithmetic, the save's net change and source, no guess without a count, local-day grouping at a half-hour offset,
    owner scope, bounded window and zone refusals, the route, the details validator, the migration chain). The one
    failure, `test_speech_import_boundary`, is the outside voice work.
  - Frontend novel + API + shared: 2,321 passed / 14 skipped; the same three voice-contract failures as before.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files clean.
  - BFF log `.dev/logs/bff-novelgoals-20261017T211041.log`. Backups in `.dev/backups/novel-goals-20261017/` in both
    repositories. An earlier backup from the refused first apply, `.dev/backups/novel-writing-log-pre-20261018T031007Z.sql.gz`,
    is also kept.

### D5 slice 8 — PDF export with chosen page rules (X05, 2026-10-17)

- **What it does.** *Export manuscript* now has a **PDF** format. The PDF is built from the same reviewed export as
  the other formats: the same saved scenes at one source version, inclusion rules, title choices, front and back matter,
  glossary and contents page. It is laid out with page rules chosen for the PDF alone, under *Page layout*:
  - page size: trade paperback 6 × 9 in (default), digest 5.5 × 8.5 in, A5, A4 or US Letter;
  - margins (0.5, 0.75 or 1 in), serif or sans-serif type, text size 9–16 pt, and single, 1.5 or double line spacing;
  - page numbers at the foot of each page, except the title page and part openers;
  - justified text with hyphenation in the novel's language, or left-aligned text.
  The app keeps the layout while another format is chosen and sends it only with a PDF. The BFF refuses a layout on any
  other format, and a PDF request without one.
- **The file.**
  - Parts and chapters each start a new page when *Start parts and chapters on a new page* is on; front and back matter
    always do.
  - The optional contents page lists parts and chapters, nested, each entry a link to its page.
  - The PDF is tagged, so text is selectable and screen readers can follow headings, lists, sections and roles. It has
    bookmarks from the headings, with chapters nested under their parts, and working links.
  - Matter keeps its role (for example `doc-dedication`), and the glossary is a definition list.
- **How it is printed.** The BFF renders one self-contained HTML document with print CSS (`@page` size, margins and a
  page-number footer; a named page without numbers for openers) and prints it with the Chromium the card export already
  uses (`CARD_EXPORT_CHROMIUM_EXECUTABLE`). JavaScript is off and every network request is refused while the page is
  laid out.
  - Chromium's creation and modification stamps are the only bytes that differ between two prints. Both are set, without
    moving any byte, to the newest saved change, so the same source version and choices always give the same file.
    The download is accepted only when its size and SHA-256 match the summary, as for the other formats.
  - With no renderer, the summary and download fail with `STORY_EXPORT_PDF_UNAVAILABLE` (503), never a partial file.
    The dialog then says PDF printing is unavailable and that the other formats still work.
- **Found and fixed live.** Chromium names each bookmark from a heading's painted lines and drops the space wherever a
  heading wraps. The title page's bookmark read *The Lighthouse Keeper(import check)*. Headings now keep their spaces
  (`white-space: pre-wrap`; the trailing spaces hang, so centred headings stay centred). The real-print test now uses a
  wrapping title and checks the bookmark name.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*: two parts, three chapters, five scenes):
  - In the dialog, PDF showed the *Page layout* fields and a summary of *5 scenes in 3 chapters · 629 words · 65.1 KB*,
    file name `The-Lighthouse-Keeper-import-check.pdf`. Choosing A5 and the contents page summarized again.
  - Downloads fetched in the page (no browser download) matched their summaries' size and SHA-256. A second summary of
    the same choices gave the same SHA-256.
  - A5 with contents was 9 pages with a 420 × 595 pt page box. Letter, 14 pt sans-serif, double-spaced, wide margins,
    no page numbers and left-aligned text was 9 pages at 612 × 792 pt. Both files are tagged (`StructTreeRoot`, `Lang`)
    and have outlines and link annotations. Bookmarks: title, Contents, Part One: Fog (Chapter 1: The Letter, Chapter 2:
    The Bell), Part Two: Clear (Chapter 3: The Key).
  - In the browser's PDF viewer: a centred title page without a number; a contents page with nested entries and page
    number 2; part openers without numbers; chapter pages with bold, italic, an underlined link, a bulleted list, `* * *`
    scene breaks and first-line indents; the Letter file in sans-serif, left-aligned and double-spaced, without page
    numbers.
  - The app refuses a Word request that carries a PDF layout before sending it.
  - The plural wording in the summary (*1 scenes in 1 chapters*) was fixed with plural forms in English and Spanish.
- **Checks.**
  - BFF: novel, story, export, import, writing-log, migration, schema and wipe tests 1,701 passed. New tests cover the
    manifest and layout CSS, the title page, chapters and prose, layout choices, contents links, matter roles with the
    *contents omitted* note, stamp fixing and refusal of odd files, the required renderer, the routes' layout
    parameters, and two real Chromium prints that are identical, tagged and outlined. The one failure,
    `test_speech_import_boundary`, is the outside voice work.
  - Frontend: the request contract (layout only with a PDF, ranges, exact keys, query parameters) and the dialog (layout
    fields, remembered layout, PDF-only sending, the unavailable message). The full app suite's remaining failures are
    all in voice, call, interaction and the docs roadmap's voice-calls entry, which are outside work in progress.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - No database change. BFF log `.dev/logs/bff-novelpdf-20261017T214004.log`; backups in
    `.dev/backups/novel-pdf-20261017/` in both repositories.
  - My first restart for this slice picked the wrong process: it stopped another session's BFF on port 18010 (its owner
    restarted it a minute later), and the :8010 BFF kept the old code. The restart helper now accepts only the `--port
    8010` process.

### D5 slice 9 — review notes and AI changes as export files (most of X07, 2026-10-17)

- **What it does.** *Export manuscript* now starts with a **File** choice: *Manuscript*, *Review notes* or *AI
  changes*. The two companion files cover the same scenes as the manuscript: the same inclusion rules, the *Include
  archived scenes* switch and reading order. They come in every format (Word, EPUB, Markdown, plain text and PDF with
  its page layout) and use the same summary, SHA-256 check and refusal of changed sources.
  - **Review notes**: the author's open personal notes, and resolved ones with *Include resolved notes*. Each has a
    number, its state, the passage it marks as a quote, and its text. Notes are in reading order: chapter, scene, then
    where the passage starts, with a note whose passage has since changed last. That note quotes the passage as it
    was and says so. AI-made notes are labelled *AI review note*. Bookmarks and notes in the Trash are never exported.
  - **AI changes**: every saved scene revision made by accepting an AI proposal, oldest first in each scene. Each lists
    the command (Continue, Rewrite, …), when it was accepted (UTC), the scene revision, the scene's word count before
    and after, the author's request, and the text as accepted. The proposal was Markdown when it was accepted, so its
    emphasis is kept. A count whose earlier revision is no longer in the history is left out, not guessed. This is the
    record a publisher's AI-use question needs.
  - With nothing to list, the summary says so and *Download* is off.
- **The request.** Two new fields: `document` (`manuscript` | `review_notes` | `ai_changes`) and `resolvedNotes`
  (review notes only).
  - A companion request must keep the manuscript-only choices (title, part, chapter and scene titles, page breaks,
    contents page and glossary) at their defaults. The app keeps the author's manuscript choices while a companion file
    is chosen and restores them afterwards.
  - The manifest gains `entries` (the number of notes or changes; null for the manuscript). A companion file has its
    own title (*Novel — Review notes*), file name, EPUB identifier and no synopsis. Its entries run on without page
    breaks, and the newest note or change dates the EPUB and PDF.
- **How it is built.** The BFF reads the notes (`story_annotation`, kind `note`, state open/resolved) or the accepted
  AI revisions (`story_scene_revision` source `ai`, joined to `story_generation` and the parent revision) in the same
  transaction as the outline and scenes. It turns each entry into a small generated document, so the manuscript's own
  writers produce every format. Labels follow the novel's language (English and Spanish; other languages fall back to
  English).
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*):
  - In the editor I selected *She did not see the second ship.* in Scene 3, used *Personal notes → Note selected
    passage* and saved a note. I added a second note on *One, two, three.* and resolved it. The database has one open
    and one resolved note, both attached.
  - In the export dialog, *Review notes* hid the manuscript-only choices and showed *Include resolved notes*. The
    summary read *1 note … 42 words · 3.1 KB*, then *2 notes …* with resolved notes on. The file name was
    `The-Lighthouse-Keeper-import-check-Review-notes.docx`.
  - Files fetched in the page (no browser download) matched their summaries in Markdown, plain text, Word, EPUB and PDF.
    - The Markdown has both notes in passage order, with quotes, *Open* and *Resolved*.
    - The Word file has the quotes in the Quote style.
    - The EPUB has its own title and identifier (different from the manuscript's) and the quotes as `blockquote`.
    - The A5 PDF is 2 pages; in the viewer: chapter and scene headings, numbered notes with their state, the quoted
      passage in italics and the note text.
  - *AI changes* listed the real accepted *Continue* in Scene 3: *accepted 2026-10-18 03:19 UTC · scene revision 6*,
    *Scene words: 34 → 520 (+486)* (matching the writing log's AI row) and the full accepted text. The first check
    showed the proposal's Markdown emphasis as escaped asterisks. Proposals are now read as Markdown, and the next
    check had *Return what the sea took.* in italics.
  - Wording found live: *1 note from 5 scenes* read as if the note came from five scenes. It now reads *1 note on 5
    scenes*.
- **Checks.**
  - BFF: novel, story, export, import, writing-log, migration, schema and wipe tests 1,712 passed. New tests cover
    reading order with an orphan last, quotes, states and AI labels, resolved only when asked, Spanish labels and file
    names, AI changes with word counts, unknown parents, kept emphasis and history-only variants, every format, the
    newest-entry date, the request rules, the store's same-transaction reads, and the download's query parameters.
  - `test_archived_workspace_stories_stay_readable` now expects the two new request fields. The one failure,
    `test_speech_import_boundary`, is the outside voice work.
  - Frontend novel + API + shared: 2,329 passed / 14 skipped. New tests cover the companion request rules, `entries`,
    the query, and the dialog's choices, restore and empty state. The same three outside voice-contract failures remain.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - No database change. BFF log `.dev/logs/bff-novelcompanion-20261017T215816.log`; backups in
    `.dev/backups/novel-companion-20261017/` (BFF repository, frontend copies under `frontend/`).
- **Still open in X07:** the style sheet, which needs the novel style guide and voice sheets (N15, K08) first.
- **Still open in D5:** formal EPUBCheck validation and reader acceptance, acceptance in Microsoft Word and of the PDF
  in print and in screen readers, importing EPUB/ODT/RTF and restoring matter roles on import, the style-sheet file,
  project packages, export jobs with progress, logs and retry for very large novels, read-aloud and dictation,
  translation, blurbs and completions.

### D3/D5 slice — style sheet and character voices (N15, K08, rest of X07, 2026-10-17)

- **What it does.** *Organize & details* for the novel has a **Style sheet** section under the style guide, with three
  lists:
  - **Conventions** (up to 150): a term, its kind (spelling, name, capitalization, hyphenation, numbers, punctuation,
    usage, other) and an optional rule, as on a copy editor's style sheet. A term is trimmed when you leave the field.
    The same term twice in one kind, in any letter case, is refused on the row.
  - **Preferred examples** (up to 5): short passages in the voice the author wants, with an optional label. They guide
    style only; the assistant is told never to treat them as story facts.
  - **Character voices** (up to 30): pick a Codex character of the novel, describe how they speak, and add up to three
    sample lines. A voice whose Codex entry is removed or turned off is kept and marked, and nothing reads it.
  - The sheet saves, conflicts, compares, recovers, snapshots and copies with the other novel details, because it is
    one of them (`details.styleSheet`, checked the same way by the BFF and the app). An emptied sheet clears the field.
    The compare view shows it as readable lines.
- **Who reads it.**
  - **The assistant.** The packet gains a `style` part: the conventions, the examples, and the voices of the character
    cards among its sources. If the packet would not fit, the examples go first, then the whole style part; the trace
    says which (`styleOmitted`), and the source preview shows the style part and any omission. The app checks the
    style part against the saved sheet and the packet's own cards, and the stored packet is checked again when a reply
    is kept.
  - **Inline writing** (Continue, Rewrite, …) gets the conventions, the examples and the voices of the enabled
    characters of the scene, after the synopsis and style guide.
  - **Export.** *Export manuscript → File → Style sheet* writes the novel's writing settings and style guide, the
    conventions grouped by kind, the examples and the character voices, in every format. It reads only saved details,
    so the scene choices and the left-out list are hidden, and it works for a novel with no scenes.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*):
  - In *Organize & details* I added the conventions *grey* (spelling, *Not gray.*) and *Tolliver* (name) and the
    example *Quiet* with a short passage. I typed *grey* with a trailing space: it was trimmed on leaving the field.
    Saving raised the metadata revision to 3, and the database has exactly that sheet.
  - The voice list said the novel had no Codex characters, so I added *Mara* to the Codex. I gave her the traits
    *Clipped. Short sentences, no endearments.* and the sample line *Light's lit. Go home.* and saved.
  - The writing assistant's prepared prompt showed a *Style sheet* section with both conventions, the example and
    *Voice of Mara*. The exact model messages carry the style part and the new instruction. I sent the prompt to the
    real model and the reply was accepted and stored. It quoted Mara's voice notes and the example and suggested
    answers in that voice.
  - The export dialog's *Style sheet* file showed *4 style entries · 45 words*. Markdown, plain text, Word, EPUB and PDF
    fetched in the page matched their summaries (size and SHA-256). They list General (language), Conventions
    (Spelling, Names), the example and Mara's voice. The EPUB has its own title and identifier, and the 3-page trade
    PDF was checked in the viewer.
  - Found live: the page reloaded several times during the check. Another session is editing `theme.css` and Vite
    reloads on it. This is outside the novel work, and nothing was lost.
- **Checks.**
  - BFF: novel, story, export, import, writing-log, migration, schema, style, assistant and wipe tests 2,938 passed.
    New tests cover the sheet rules, the packet style and its fallbacks, the stored-packet check, the writer's
    supplement and the style-sheet export file. The one failure, `test_speech_import_boundary`, is the outside voice
    work.
  - Frontend novel + API + shared: 2,335 passed / 14 skipped. New tests cover:
    - the sheet rules (matching the BFF, including case-folded repeats);
    - the packet style;
    - a style packet compiled by the BFF (`src/test/fixtures/storyAssistantContextStyle.json`) and refusal of edited
      style even with matching messages and hash;
    - the editor (trim, repeat, example, voice, exact save, clearing, a removed character's voice);
    - the style-sheet export choice.
  - `storyNovelDetails.test.ts` now uses four full fields for its oversize case, because the details cap rose to
    250 KB for the sheet. The same three outside voice-contract failures remain.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - No database schema change. BFF log `.dev/logs/bff-novelstyle-20261017T221359.log`. Backups in
    `magic-worlds-api/.dev/backups/novel-style-20261017/`: BFF files, frontend copies under `frontend/`, git-index
    copies of later-edited files under `frontend-from-git-index/`, and the two docs.
- **X07 is complete.** Still open in D5: EPUBCheck validation and reader acceptance, Word and PDF acceptance, EPUB/ODT/
  RTF import, packages, export jobs, read-aloud and dictation, translation, blurbs and completions.

### D3 slice — assistant reply preferences (A25, 2026-10-17)

- **What it does.** The writing assistant drawer has a **Reply style** panel under *Source choices*. It sets how the
  assistant answers *you*, for every novel of the account in this workspace. It never changes how the manuscript
  reads; that stays in each novel's style guide and style sheet.
  - **Choices:** Length (brief, balanced, detailed), Format (whatever fits, prose, lists), Tone (neutral, direct,
    encouraging), Reply language (the language of my question, or the novel's language). There is also an optional
    note of up to 500 characters, for example *Call me Sam* or *Skip praise*.
  - The panel reads the saved choices only when you open it. **Save** writes them at the version it read; **Use
    defaults** deletes them. If another tab or device saved first, the panel says so and shows what is saved now
    instead of overwriting it.
  - Changes apply from the next prompt you prepare. The prepared packet gains a `preferences` part only when
    something is saved. The system prompt tells the model to follow it for the reply's length, format, tone and
    language, and never to treat it as a story fact or a style rule. The source preview shows a *Reply style* line.
    The app checks the part's exact shape, and the stored packet is checked again when a reply is kept.
- **Where it lives.** New table `story_assistant_preference`: one row per user and workspace scope, holding the
  choices as JSON and a row version. It cascades from `tb_workspace_scope`, so deleting the account or workspace
  removes it with no change to the wipe code. Routes: `GET/PUT/DELETE /stories/assistant-preferences`. `PUT` takes
  `expectedVersion` (0 creates the row); `DELETE` takes `?expectedVersion≥1`. A stale version answers 409
  `STORY_ASSISTANT_PREFERENCES_CHANGED`. Nothing goes to `api.magic_llm` except the prompt, as before.
- **Schema upgrade** `2026_10_novel_writing_log` → `2026_10_novel_preferences`. It is additive (one new table) and
  scoped, using the same migration pattern as before. Each earlier migration recognises the new marker.
  - Backup first: `magic-worlds-api/.dev/backups/novel-preferences-pre-20261018T044257Z.sql.gz`, SHA-256
    `e86e5be59e179ff1a477f4a8a40e818578c4b7626f8a158d744cd5e68ee5538b`, 116 tables and 5,268 rows with row
    fingerprints in the `.metadata.json` beside it.
  - After applying: every one of those rows is preserved, 117 tables, and the revision is `2026_10_novel_preferences`.
- **Live check, real API and data** (BFF restarted with log `.dev/logs/bff-novelprefs-20261017T224326.log`):
  - In the drawer I opened *Reply style*. It read "No reply style is saved". I chose Brief, Lists and Direct, and
    entered the fictional note *Call me Sam. Skip praise.* Saving created the row at version 1, and the database has
    exactly those choices.
  - The prepared prompt showed *Reply style · Length: Brief · Format: Lists · Tone: Direct…*. The exact model messages
    carry the `preferences` part. I sent it to the real model in the conversation *Reply style check*. The reply was
    short, in a list, addressed "Sam" and had no praise. It was accepted and stored.
  - In the page, through the API: a save at an old version got 409 `STORY_ASSISTANT_PREFERENCES_CHANGED`, and an
    unknown choice was refused before any request was sent.
  - Conflict in the UI: another tab saved *Detailed*, then this tab saved a change. The panel said the style had
    changed in another tab or device and showed *Detailed* without overwriting it.
  - *Use defaults* showed "Reply style cleared", and the database has no row for the account.
- **Checks.**
  - BFF: novel, story, export, import, migration, schema, style, assistant, preference and wipe tests 3,006 passed.
    The 10 failures are outside voice work: `test_speech_import_boundary`, and 9 `test_user_preferences_contract`
    cases answering `voice_tier_unavailable` (expressive narration tiers; they run now because the filter includes
    "preference"). The existing context-store test's fake cursor now answers the preference read, and a new case checks
    that saved preferences reach the packet from the same read and that a corrupt row is refused. New tests cover the choice rules, the store (create, versioned replace, conflict, unknown scope,
    clear), the routes, the packet part and the stored-packet check, and the migration (backup contract, upgrade,
    preserved rows, refusal on an unknown predecessor). The schema test now counts 117 tables and 163 foreign keys.
  - Frontend novel + API + shared: 2,341 passed / 14 skipped. New tests cover the preference rules, the API methods
    (exact requests, answer checks, refusal before sending), the panel (lazy read, save at version, clear, conflict
    reload, over-long note), and the packet check. The same three outside voice-contract failures remain.
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - Backups in `magic-worlds-api/.dev/backups/novel-preferences-20261017/`: BFF files, frontend copies under
    `frontend/`, and the two docs.

### D3 slice — saved scene summaries as revision-bound memory (K09, rest of A14, 2026-10-17)

- **Summaries from a reply, saved after review.** When the author asks for scene summaries, or picks the *Summary*
  action, the reply carries `summaries`: up to 20, one per writable source scene, each at most 2,000 characters. Each
  keeps the revision, content hash and completeness of the scene text it read. The reply's evidence lists them under
  **Scene summaries**, headed *Chapter · Scene*, with a state:
  - *Ready*: the scene is still at that revision.
  - *Saved as the scene summary*: the scene already holds exactly this summary for this revision.
  - *Scene changed since this reply*: the staleness marker against today's revision.
  - *From part of the scene*: the reply read only some passages, so it cannot be saved.
  - *Not possible now*: the scene was removed, archived or became read-only.
  - **Save as scene summary** goes through the studio's save barrier. It re-reads the outline and writes the scene's
    details at their metadata revision, with `summary` and `summaryRevision` set to the revision the reply read. A
    details conflict from another tab says "try again"; changed prose says the summary was not saved. If the scene
    already has a different summary, the card says saving replaces it.
- **Summaries and outlines read whole scenes.** With the *Summary* or *Outline* action, each scene other than the
  anchor is read as one whole passage when it fits; otherwise it falls back to its best-matching paragraphs, as other
  tasks do. Before this, a summary of any multi-paragraph scene was always built from separate paragraphs.
- **Saved summaries as context.** The packet gains a `summaries` part: the saved summaries of in-scope scenes that are
  *not* among the sources, in reading order. That covers scenes left out by the scene limit, the passage limit or the
  budget. They are added last, after the style sheet.
  - A summary is sent only while its `summaryRevision` equals the scene's current revision. Editing, restoring or
    replacing the prose makes it stale; copies, history and restore already keep or clear that link.
  - Left-out summaries are listed in the trace as `summaryExclusions` with a reason: `stale`, `unverified` (no
    revision recorded), `too_long` (over 4,000 characters), `limit` (over 40) or `budget`.
  - The system prompt tells the model to use summaries for what happens around the sources, cite only passages, and
    say when a claim rests on a summary.
  - The source preview shows a *Scene summaries* section with each summary's revision and every left-out reason.
  - The app's verifier recomputes the rule from the saved outline (text, title, revision, order, each reason). Stored
    packets are checked again by the BFF and the frozen verifier.
- **Retrieval index decision.** Lexical ranking still reads the current saved text inside the same read transaction,
  so it has no separate index that could go stale. A stored or embedding index stays deferred until a relevance
  evaluation shows its value, as [08](08_ai_assistant_context_and_tools.md) requires.
- **Graph change.** The server-owned `novel_assistant` graph gains the `summaries` tool field and its instruction. The
  catalog hash was updated (`e57cf8e6…`). `api.magic_llm`, `magic-agents` and `magic-llm` were not touched.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*; BFF logs
  `.dev/logs/bff-novelsummaries-20261017T230223.log` and `bff-novelsummaries2-20261017T230602.log`):
  - Conversation *Summary save check*, anchor Chapter 3 · Scene 1, whole novel, *Summary* action, real model.
  - First reply, before the whole-scene change: five summaries, and four were *From part of the scene*. The database
    showed the other scenes had gone in as paragraph passages. That is why Summary and Outline now read whole scenes.
  - After restarting the BFF, the same request read every scene whole (*Complete saved scene*). All five summaries were
    *Ready* and covered only what the scenes show.
  - I saved Chapter 1 · Scene 1 and Chapter 1 · Scene 3. The database has their summaries with `summaryRevision` 1
    and 6, equal to their prose revisions, and metadata revision 2.
  - With *Maximum source scenes* 2 and a free question about the brass key, the sources were the anchor and Chapter
    1 · Scene 3. Chapter 1 · Scene 1, left out by the scene limit, came in as its saved summary. Scene 3 was not
    repeated as a summary. The real reply used that summary and said so ("The saved summary of Chapter 1's first
    scene says…"), marking it as inference.
  - I added a sentence (*The wax was still warm.*) to Chapter 1 · Scene 1. It stays in the test novel. That reply's
    card then showed *Scene changed since this reply* with no save button. A newly prepared prompt left the summary
    out as "written for an older version of the scene", and the app's verifier accepted the packet.
- **Checks.**
  - BFF: novel, story, export, import, migration, schema, style, assistant, preference, agent-graph and wipe tests
    3,444 passed. The 10 failures are the same outside voice ones as in the A25 slice. New tests
    (`tests/services/test_story_assistant_summaries.py`) cover:
    - the packet part: current, stale, unverified, too long, over the limit, no room, later scenes and sources
      excluded;
    - the stored-packet check;
    - whole-scene reading for Summary and Outline, with the paragraph fallback;
    - reply summaries: writable scenes only, repeats, bounds, and the stored record.
  - Frontend novel + API + shared: 2,345 passed / 14 skipped, with the same three outside voice-contract failures.
    New tests cover:
    - a summaries packet compiled by the BFF (`src/test/fixtures/storyAssistantContextSummaries.json`), checked by
      the live and frozen verifiers;
    - refusal of edited text, revision, order, a stale summary sent, a wrong reason, a missing exclusion, or a later
      scene;
    - the reply's summaries in a stored record (revision, hash, completeness, trimmed text, repeats);
    - the *Scene summaries* card (states, save at the read revision, replacing, refused saves, no save where details
      cannot change).
  - Typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - No database schema change: `summary` and `summaryRevision` already existed in scene details. Backups in
    `magic-worlds-api/.dev/backups/novel-summaries-20261017/`: BFF files, frontend copies under `frontend/`, and the
    two docs.
- **Still open for K09/A14:** chapter and book summaries tied to their scenes' revisions (done on 2026-10-18, see
  [the chapter and book summaries slice](#d3-slice--chapter-and-book-summaries-tied-to-their-scenes-revisions-rest-of-k09a14-2026-10-18)); refreshing a stale summary in
  one step; a list of stale summaries across the novel.

### D3 slice — outline import and assistant chapter plans as reviewable structure (S18, 2026-10-17)

- **Import outline.** A new button next to *Add chapter* in the Chapters panel (and its narrow-screen drawer) opens
  *Import an outline*. The author pastes Markdown or plain text, or opens a `.md`/`.txt` file that is read on the
  device. The BFF reads it at `POST /stories/outline-preview` and saves nothing. The dialog shows:
  - what will be added: parts, chapters, scenes and planned beats;
  - notes on what the reading changed: shortened titles, an *Opening* chapter for scenes before the first chapter,
    chapters that get one empty scene, left-out paragraphs or code, headings deeper than scene level;
  - a checkbox per chapter, with its new part, synopsis and scenes;
  - *Chapters are* (detect, or heading 1–6) and *Chapters without a part go to* (the top level or an active part).
- **How an outline is read** (`src/services/story_outline.py`).
  - A chapter-like heading sets the chapter level, otherwise the heading shape does. Shallower headings are parts and
    the next level is scenes. Deeper headings become planned beats.
  - Plain "Part 2" / "Chapter 3" / "Capítulo 3" / "Prologue" lines open parts and chapters after a blank line, a
    heading or a list, even in bold, never mid-paragraph.
  - Top-level list items are scenes and nested items are their planned beats. "Title: synopsis" and
    "Title — synopsis" split. A bold lead (`**Scene 2: The Tollivers.** …`) is the title without its label.
  - Paragraphs describe the part, chapter or heading scene they follow, never a list-item scene.
  - The result is checked against fixed bounds: 50 parts, 500 chapters, 5,000 scenes, 100 beats per scene, titles of
    255 characters (a longer one is shortened and kept whole as the synopsis), 500,000 characters of text.
- **One organization change.** **Add N chapters** sends the reviewed plan, only the chosen chapters and the parts they
  use, as the structure operation `add_outline`.
  - The BFF checks the plan again with the same rules.
  - Outline parts go at the end of the novel. Other chapters go at the end of the chosen part, or at the top level.
  - Units get `synopsis` and `plannedBeats` details only. Scenes start empty: no prose is written and no summary is
    set.
  - It is one structure revision. The first new chapter opens. *Undo* in the dialog, or Organization history (listed
    as *Add outline*), moves every new unit to Trash in one step.
- **Generation: assistant chapter plans.** The *Outline or synopsis* action's chapter plan now asks for an importable
  shape: a `Chapter N: Title` heading, a paragraph on the chapter's purpose, then one list item per scene
  (`Scene title: what happens`) with key moments nested under it. The evidence of such a reply has **Add to
  outline…**. It opens the same dialog with the answer, where the author can edit the text and choose chapters
  before anything is added.
- **Graph change.** Only the chapter-plan sentence of the `novel_assistant` instruction changed; the catalog hash was
  updated (`15bfba98…`). `api.magic_llm`, `magic-agents` and `magic-llm` were not touched.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*; BFF logs
  `.dev/logs/bff-noveloutline-20261017T232107.log`, `bff-noveloutline2-20261017T233145.log` and
  `bff-noveloutline3-20261017T233452.log`):
  - I pasted a Markdown outline with *Part Three: Storm*, two chapters, scenes and beats, then unticked Chapter 5. The
    database got revision 3 `add_outline` with one chapter: the part with its synopsis, Chapter 4, and two empty
    scenes with synopses and planned beats.
  - *Undo* in the dialog wrote revision 4 and moved the part, chapter and both scenes to Trash. Organization history
    showed "Revision 3 · Add outline" and "Revision 4 · Undo · Add outline".
  - I opened a Spanish plain-text file (`Capítulo 6`, `Capítulo 7`) with *Part One: Fog* as the destination. Both
    chapters went to the end of that part with their synopsis and planned beat. Then I undid it.
  - Conversation *Chapter plan import check*, whole novel, *Outline or synopsis → Chapter plan*, real model: "Plan two
    new chapters that continue the story after Chapter 3". The reply used the new shape.
    - *Add to outline…* opened the dialog: 3 chapters, 10 scenes, 12 planned beats. The intro bullets were in
      *Opening*, which I unticked.
    - With *Part Two: Clear* as the destination, revision 7 added *Chapter 4: The Tideline* and *Chapter 5: What the
      Sea Took* after Chapter 3, with six scenes ("Low Water", "The Tollivers", …), each with a synopsis and two
      planned beats.
    - Undo (revision 8) left the novel at 2 parts, 3 chapters and 5 active scenes. The undone units stay in its Trash.
  - While the turn was finishing, the drawer showed "uncertain result" briefly and then settled by itself. The reply
    was saved.
- **Checks.**
  - BFF: novel, story, structure, history, outline, export, import, migration, schema, style, assistant, preference,
    agent-graph and wipe tests 3,460 passed. The 10 failures are the same outside voice ones. New tests:
    - `tests/services/test_story_outline.py` (14): headings, plain lines, chosen levels, notes, bold leads,
      paragraphs, refusals, the exact plan check, `add_outline` placement and details, refused destinations, and
      one-step undo;
    - `tests/routes/test_story_outline_routes.py`: the preview saves nothing, needs authentication and refuses bad
      requests.
  - Frontend novel + API + shared: 2,354 passed / 14 skipped, with the same three outside voice-contract failures.
    New tests:
    - the preview contract against a fixture written by the BFF parser (`src/test/fixtures/storyOutlinePreview.json`),
      including character counts;
    - chapter selection and part renumbering, and the API request;
    - the dialog: preview, notes, unticking, destination, apply, undo, level change, refusals, retry, file reading;
    - *Add to outline…* only on writable chapter-plan replies.
  - Typecheck 0 errors; `pnpm build` passes; lint of the new and edited files is clean.
  - No database schema change. Backups in `.dev/backups/novel-outline-20261017/` in both repositories.
- **Still open for S18:** importing an outline as a new novel (today it adds to an open one), matching outline
  chapters to existing ones instead of appending, and OPML/Scrivener outline files.

### D3 slice — chapter and book summaries tied to their scenes' revisions (rest of K09/A14, 2026-10-18)

- **What a summary covers (its basis).** A chapter's or the book's basis is the list `sceneId@revision` of every scene
  it covers, in reading order. Scenes that are trashed, merged, archived (read-only) or excluded from AI are not
  covered. A chapter basis holds at most 1,000 scenes and a book basis at most 3,000. The BFF
  (`src/services/story_summary_basis.py`) and the app (`src/shared/storySummaryBasis.ts`) compute the same list.
  - Chapter details and novel details gain `summaryBasis`; novel details gain `summary`. Both are checked like the
    other details fields. There is no database schema change.
  - A saved chapter or book summary is current only while its stored basis equals today's basis. Editing, adding,
    moving, archiving or trashing a covered scene makes it stale.
- **Summaries from a reply, saved after review.** With the *Summary* action, the reply also carries
  `chapterSummaries` (up to 20, one per chapter it read) and `bookSummary` (empty for none).
  - The prepared packet lists `chapters` (each read chapter with its covered scene IDs) and `bookScenes`, so each
    reply summary is stored with the basis it read and whether it read every covered scene whole (`complete`).
  - The reply's evidence has **Chapter summaries** and **Book summary** cards. Each shows *Covers N scenes* and a
    state: *Ready*, *Saved as the chapter summary*, *Chapter changed since this reply* (or *Novel changed…*), *From
    part of the chapter*, or *Not possible now*.
  - **Save as chapter summary** and **Save as book summary** go through the studio's save barrier. They re-read the
    outline, compare the basis again, and write `summary` and `summaryBasis` at the details' metadata revision. A
    details conflict re-checks once; a changed basis says the summary was not saved.
- **Hand-written summaries.** Editing a chapter or novel summary in *Organize & details* ties it to today's basis.
  Clearing it clears the basis. The field says when a summary is not tied to its scenes yet, or is stale.
- **Summaries as context.**
  - `chapterSummaries`: saved, current summaries of chapters that are wholly in scope and have no source scene. That
    chapter's scene summaries are then left out with the reason `chapter`. At most 20; left-out ones are listed in
    `chapterSummaryExclusions` (`unverified`, `stale`, `too_long`, `limit`, `budget`).
  - `bookSummary`: sent only with scope *This novel*, author analysis, a current non-empty summary and some scene
    that was not read. Otherwise `bookSummaryOmitted` gives the reason.
  - The source preview shows what the reply's summaries cover, plus *Book summary* and *Chapter summaries* sections
    with every left-out reason. The app's verifier recomputes all of it from the saved outline. Stored packets are
    checked again by the BFF and the frozen verifier.
  - Summary replies saved before this slice have no `chapters` rows and stay valid. A live preview must carry them.
    Opening such an older conversation had returned a 500 until this was allowed.
- **Graph change.** The `novel_assistant` graph gains `bookSummary` (a string) and `chapterSummaries` and says what
  to return with the *Summary* action. The catalog hash was updated (`437ca896…`). `api.magic_llm`, `magic-agents` and
  `magic-llm` were not touched.
- **Stray closing brace in replies (BFF fix).**
  - About 4 of 6 *Summary* replies failed with `LLM_EXECUTION_RESULT_INVALID`, with no credits charged.
  - A temporary diagnostic in `llm_execution_tools.py`, later removed, showed why. The reply's tool arguments were a
    complete JSON object followed by one extra `}` (4,635 and 5,105 characters). The executor only joins the
    provider's argument chunks, so the brace comes from the model or provider (Claude Sonnet 5.5 via
    `chat_completions`).
  - The BFF now drops exactly one trailing `}` when what remains is itself a strict, complete object. It logs
    `tool_arguments_stray_brace_dropped`.
  - Any other malformed arguments, including two extra braces, are still refused. The reply is then checked against
    the reply schema as before.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*; conversation *Chapter and book summary
  check*; BFF logs `.dev/logs/bff-novelsummaries5-20261018T001442.log` and `bff-novelsummaries6-20261018T002111.log`):
  - A whole-novel *Summary* reply had three chapter cards and the book card *Ready* and complete.
  - I saved Chapter 1's and the book's summaries.
    - Chapter 1: details at metadata revision 2, with a 3-scene basis.
    - Novel: details at metadata revision 5, with a 5-scene basis.
  - A preview anchored in Chapter 3 with *Maximum source scenes* 1 sent the book summary and Chapter 1's summary.
    Chapter 1's scene summaries were left out as "its chapter's summary is sent". The real reply used the book summary.
  - After the brace fix, two more *Summary* runs succeeded:
    - One reply was clean.
    - One ended with the stray brace (5,145 characters). The BFF dropped it and saved the reply.
    - Both carry 3 chapter summaries, 5 scene summaries and a complete book summary. The app's own check accepted
      them: every card was *Ready* with its save button.
  - Not checked live: a saved chapter or book summary turning stale after a scene edit. Tests cover it on both sides.
- **Checks.**
  - BFF: novel, story, export, import, migration, schema, style, assistant, preference, agent-graph, outline,
    history, execution-transport and wipe tests: 3,730 passed. The 10 failures are the same outside voice and
    preference ones.
  - New BFF tests:
    - `tests/services/test_story_assistant_chapter_summaries.py` (18): bases, each context rule and reason, packet
      rows, stored-packet corruptions, reply rows with basis and completeness, tampering, and older records.
    - `tests/services/test_llm_execution_tools.py`: 15 cases for the stray brace, on the completion and stream paths.
  - Frontend novel + API + shared: 2,361 passed / 14 skipped, with the same three outside voice-contract failures.
  - New frontend tests:
    - `storyAssistantChapterSummaries.test.ts` (5), against a BFF-compiled fixture
      (`src/test/fixtures/storyAssistantContextChapterSummaries.json`).
    - `NovelAssistantWideSummaries.test.tsx` (2).
  - Typecheck 0 errors; `pnpm build` passes; lint of the 17 edited files is clean.
  - Backups: `magic-worlds-api/.dev/backups/novel-chapter-summaries-20261017/`, with BFF files, both docs and
    `SHA256SUMS`.
- **Still open for K09/A14:**
  - refreshing a stale summary in one step (done the same day; see the next section);
  - a list of stale summaries across the novel (done the same day; see the next section);
  - part summaries;
  - an evaluated stored retrieval index (done: see *D3 slice — an evaluated stored retrieval index*).

### D3 slice — summary status across the novel and one-step refresh (rest of K09, 2026-10-18)

- **Summaries view.** *More → Planning views → Summaries* lists the book, then each chapter followed by its scenes,
  in reading order. Only units the assistant reads are listed: scenes in Trash, merged, archived or left out of AI
  are not.
  - Each row has a state:
    - *Current*;
    - *Scene changed since* / *Scenes changed since* (stale);
    - *Not tied to a revision* / *Not tied to its scenes* (saved before summaries were tied to scenes);
    - *No summary*.
  - Each row also has the saved text, what it covers, and why the assistant leaves a non-current summary out.
  - Counts per state sit at the top. *Only summaries that need attention* hides current ones.
  - Rules are computed from the loaded outline (`src/features/novel/utils/summaryStatus.ts`). They reuse the basis
    helper that matches the BFF compiler. Nothing is copied or stored.
- **Still accurate.** On a stale or untied summary, the author can confirm that an edit did not change what the
  summary says.
  - A second click confirms, after an explanation.
  - It saves the unchanged text tied to today's revision (scene) or today's basis (chapter, book).
  - It uses the same guarded writers as saving from a reply, so a scene that changed again in the meantime is
    refused with a message.
  - Nothing is ever rewritten automatically ([08](08_ai_assistant_context_and_tools.md): preserve approved author
    summaries).
- **Refresh with the assistant (bounded recomputation).**
  - The author ticks scenes and chapters. A chapter brings all its covered scenes. Then *Refresh N scenes…* is
    pressed.
  - The writing assistant opens with one *Summary* request already set up:
    - scope *Selected scenes*, the chosen scenes in reading order, the first one as anchor;
    - *Author analysis*, so later scenes are not cut at the anchor;
    - *Maximum source scenes* equal to the count;
    - a fixed instruction.
  - The author still prepares, reviews and sends it.
  - One request reads at most 20 scenes. More is refused with an explanation.
  - *Refresh the whole book…* uses the novel scope when the book covers at most 20 scenes.
  - If the composer holds the author's own words, they are kept and the drawer says to send or clear them first.
  - An active request also blocks the refresh, with a message.
- **Save all ready.** A reply with two or more summaries that are *Ready* today has **Save all N ready summaries**
  above its summary cards.
  - It saves scenes, then chapters, then the book, one after another through the same guarded writers.
  - It reports how many were saved. Any that changed meanwhile are skipped, and their cards say why.
- **Accessibility and layout.** Scene controls name their chapter ("Chapter 1: The Letter · Scene 1"). The
  planning-view tab strip scrolls sideways at 375 px instead of clipping the fifth tab; the page itself does not
  overflow.
- **No BFF or graph change.** The existing *Summary* instruction already limits chapter and book summaries to
  chapters read whole, so a partial refresh adds no partial chapter or book cards.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*; BFF log
  `.dev/logs/bff-novelsummaries6-20261018T002111.log`):
  - The view showed 3 current summaries, 5 missing and 1 *Scene changed since*. That was Chapter 1 · Scene 1, after
    the earlier test sentence.
  - *Still accurate* on that scene saved `summaryRevision` 2, equal to its prose revision (metadata revision 3). The
    row turned *Current*.
  - I ticked Chapter 1 · Scenes 1 and 2 and Chapters 2 and 3, then *Refresh 4 scenes…*. The assistant opened primed:
    anchor Chapter 1 · Scene 1, *Selected scenes*, author analysis, 4 sources. The prepared prompt held 4 complete
    saved scenes. Conversation *Summary refresh check*.
  - The real reply had 4 scene summaries and the summaries of Chapters 2 and 3, all *Ready*. There were none for the
    partly read Chapter 1 or the book.
    - The new Chapter 1 · Scene 1 summary includes the test sentence ("The wax is still warm").
    - **Save all 6 ready summaries** reported "Saved 6 summaries."
    - The database has all five scenes' summaries tied to their current revisions. Chapters 2 and 3 have summaries
      with one-scene bases.
  - The Summaries view then showed 9 current, 0 needing attention.
- **Checks.**
  - Frontend novel + API + shared: 2,371 passed / 14 skipped, with the same three outside voice-contract failures.
  - New frontend tests:
    - `summaryStatus.test.ts` (4): states, reading order, staleness by revision and trash, untied and blank
      summaries, read-only and archived novels, refresh scene sets, and the primed request passing the request
      contract.
    - `NovelSummaryStatus.test.tsx` (6): counts and filter, the confirm-then-save path with today's basis, a refused
      re-tie, refresh choices and the 20-scene bound, read-only, *Save all* with a skipped summary, and when *Save all*
      is not offered.
  - Typecheck and Storybook typecheck 0 errors; `pnpm build` passes; lint of the 18 edited files is clean. No BFF
    change.
  - Backups: `magic-worlds/.dev/backups/novel-summary-status-20261018/`, with `SHA256SUMS`.
- **Still open for K09:**
  - a book summary built from current chapter summaries, so a novel of more than 20 covered scenes can refresh its
    book summary through the assistant (done on 2026-10-18, see
    [part summaries and a book summary built from summaries](#d3-slice--part-summaries-and-a-book-summary-built-from-summaries-rest-of-k09-2026-10-18));
  - part summaries (done in the same slice);
  - an evaluated stored retrieval index (done: see *D3 slice — an evaluated stored retrieval index*).

### D3 slice — the author's own prompt presets (A19, 2026-10-18)

- **What the author gets.** The writing assistant has a *Prompt presets* section below *Reply style*. Presets
  belong to the account, in every novel and workspace, like the reply style.
  - A preset is a name, an instruction with inputs written as `{{key}}`, and the intent it is written for: Ask or
    Suggest, optionally with a named action chosen through the drawer's own action picker. It can also set the
    source scope, the reading-order boundary and the model profile when used (*Keep the drawer's choice*, the
    application's profile, or the profile chosen in the drawer).
  - There are up to 8 inputs. Each is free text with a longest answer (1–500), or a choice of 2–12 options, and is
    required or optional. *Insert {{key}}* adds an input to the instruction. Every input must appear in the
    instruction, and every `{{key}}` must be an input. A loose brace pair is refused, never guessed.
  - *Use…* opens a small form for the inputs and shows the exact message it fills. *Fill the message* sets the
    message, intent, action and the saved defaults. The author still prepares, reviews and sends the request. If
    the composer holds the author's own words, the form asks first (*Replace my message*). An earlier, unchanged
    preset message is replaced directly.
  - Every saved change is a new version (*Version N*). *Move to Trash* and *Restore* keep the version. Only a preset
    in Trash can be deleted, after a confirmation. Up to 50 presets are in use at once.
- **Provenance.** While the message is exactly what the preset filled in, the drawer shows *From the preset “…” ·
  version N* with the filled values. The prepared prompt and the saved reply's evidence show the same. Once the
  author edits the message or changes the intent or action, the drawer says the message is now sent as the author's
  own, and the turn carries no preset.
- **BFF.**
  - Table `story_assistant_preset`: user scope, client-chosen preset id, revision, name, definition JSON and
    `trashed_at`. It cascades from `tb_workspace_scope`, so the account wipe removes it with no change to the wipe
    code.
  - Routes `GET/POST /stories/assistant-presets`, `PUT /stories/assistant-presets/{id}` (`expectedRevision`),
    `POST …/{id}/trash` and `…/{id}/restore` (`expectedRevision`), and `DELETE …/{id}?expectedRevision`. A stale
    revision answers 409 `STORY_ASSISTANT_PRESET_CHANGED`. Over the limit answers 409
    `STORY_ASSISTANT_PRESET_LIMIT`. An invalid definition answers 422 with the reason. A retried create with the
    same id returns the same preset.
  - A novel turn or preview may name `preset: {id, revision, inputs}`. Preparation reads that preset in the same
    database snapshot and requires that it is in use at that exact revision, its values are valid, it renders exactly
    the turn's message, and it matches the turn's intent and action. Otherwise it answers 409
    `STORY_ASSISTANT_PRESET_CHANGED` or 422 `STORY_ASSISTANT_PRESET_MISMATCH`.
  - The frozen copy (id, version, name, definition and values) goes into the execution's frozen payload metadata
    (`novel_preset`), so it is part of the reviewed prompt hash. It is kept in the reply record (`novel.preset`) and
    checked again whenever a stored reply is read. The model reads only the filled message. Nothing about presets
    goes to `api.magic_llm`.
  - The model profile is not pinned to a profile revision inside the preset. As for every turn, the profile's
    published revision is resolved when the prompt is prepared, the send must match it, and it is recorded with the
    reply's execution.
- **Schema upgrade** `2026_10_novel_preferences` → `2026_10_novel_presets`. It is additive (one new table) and scoped,
  using the same migration pattern (`story_preset_migration.py`, `scripts/migrations/20261018_novel_presets.py`). The
  preference migration now chains through it, and each earlier migration recognises the new marker.
  - Backup first: `magic-worlds-api/.dev/backups/novel-presets-pre-20261018T070024Z.sql.gz`, SHA-256
    `bfdc4ce1bc98e0d107d4404598be58fa1e6e9c3b0a1d3ff084856b684a09d477`, 117 tables and 5,444 rows with row
    fingerprints beside it.
  - After applying: all 5,443 content rows are preserved (the marker row changes), 118 tables, and the revision is
    `2026_10_novel_presets`.
- **Live check, real API and data** (on *The Lighthouse Keeper (import check)*; BFF log
  `.dev/logs/bff-novelpresets2-20261018T011459.log`):
  - The first save failed with a 500, because `stored` is a reserved word in MySQL 8 and the count alias used it. The
    mocked store tests could not show this. The alias was renamed, the BFF restarted, and the same form saved with the
    same id. The database row matches the definition exactly: *Character knowledge check*, inputs `who` (text, 80),
    `thing` (text, 200) and `length` (choice short/detailed), *Author analysis*.
  - *Use…* with Mara / the brass key / short asked before replacing the message already in the composer. *Replace my
    message* set the message, the author-analysis boundary and the provenance line. The prepared prompt passed the
    preview contract with the preset. I sent it to the real model in conversation 33.
    - The reply (message 103) and its execution plan (`9fe4afaf-…`) both hold the preset at version 1 with the
      values.
    - The saved evidence shows *From the preset “Character knowledge check” · version 1*.
  - Editing the instruction in the panel saved version 2.
  - In the page, through the API: a save at version 2 made version 3 (as another tab would). A second save at version
    2 got 409 `STORY_ASSISTANT_PRESET_CHANGED`, and a definition with an unused input got 422 with its reason.
  - A message filled from version 2 was then refused at preparation with the drawer's notice *The prompt preset
    changed or moved to Trash…*, and Send stayed disabled.
  - After one more sentence was typed into that message, the drawer said it is sent as the author's own, and it
    prepared without a preset.
  - *Move to Trash* from the stale view said the preset had changed in another tab and showed version 3. Trash and
    Restore then worked.
  - At 375 px the editor fits with no horizontal overflow.
- **Checks.**
  - BFF:
    - novel/story/schema/assistant/preset selection: 3,658 passed, with the 10 known outside failures
      (`test_user_preferences_contract` 9, `test_speech_import_boundary` 1);
    - voice-preset tests, picked up by the word *preset*, fail on the separate voice-tier work in progress;
    - new tests: `test_story_assistant_presets.py` (6: definitions, rendering, frozen versions, turn preparation,
      prompt and record), `test_story_assistant_preset_store.py` (5), `test_story_assistant_preset_routes.py` (1),
      `test_novel_presets_migration.py` (4);
    - schema inventory counts updated (118 tables, 164 foreign keys).
  - Frontend:
    - novel + API + shared: 2,379 passed / 14 skipped, with the same three outside voice-contract failures;
    - new tests: `storyAssistantPresetContract.test.ts` (3: parity with the BFF rules, rendering, draft provenance)
      and `NovelAssistantPresets.test.tsx` (5: fill and confirm, create with every input used, versioned edit and
      conflict, Trash/restore/delete, read-only);
    - typecheck and Storybook typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - Backups: `magic-worlds-api/.dev/backups/novel-presets-20261018/` (BFF files before the slice) and
    `magic-worlds/.dev/backups/novel-presets-20261018/` (these docs), each with `SHA256SUMS`.
- **Not covered.** Presets are per account, not per novel or series (series presets are D6). A retried turn carries
  its preset through the frozen payload, which tests cover; it was not exercised live.

### D3 slice — part summaries and a book summary built from summaries (rest of K09, 2026-10-18)

- **Part summaries.** A part has the same summary details as a chapter: `summary` plus `summaryBasis`, the ordered
  `sceneId@revision` list of its covered scenes (not in Trash, merged, archived or left out of AI). A part basis
  holds at most 1,000 entries, like a chapter's.
  - The basis helper `part_bases` (BFF) and `partBases` (frontend) list each part's chapters' covered scenes in
    reading order. A chapter outside any part belongs to none. Tests pin both to the same fixture.
  - A summary written by hand in the part's details is tied to today's basis when it is saved, as for chapters.
  - The Summaries view lists each part before its chapters, with the same states, *Still accurate*, and a *Choose
    Part … for a refresh* box that brings all of the part's scenes.
- **Part summaries as context.** A part summary is sent (`packet.partSummaries`) when the part lies wholly in scope, none
  of its scenes is read, and the summary is current. At most 20 are sent, each at most 4,000 characters.
  - A sent part summary stands in for its chapters' and scenes' summaries. They are left out with the reason
    *its part's summary is sent* (`part`).
  - A part summary left out says why (`partSummaryExclusions`): changed scenes, too long, over the limit or out of
    room. A part summary left out for room lets its chapters' summaries in.
- **What each reply summary covers.** A *Summary* request now records, in its trace, what a reply's summaries can
  cover (`summaryCoverage`): for the book, each chapter and each part, how many scenes it has and which of them are
  covered.
  - A scene is covered when it is read in full, has a current summary sent, or sits inside a chapter or part whose
    summary is sent.
  - A reply's chapter, part or book summary takes that covered list as its basis. It is *complete*, and so can be
    saved, only when every scene is covered. Before this, a chapter or the book had to be read in full.
  - For novels with parts, the packet lists each part with its chapters (`packet.parts`), so the model can name the
    parts it may summarize. A reply's summary of a part whose summary was sent is dropped.
  - The prepared prompt shows *What summaries from this reply cover*, one line per unit, for example "Part One: Fog: 4
    scenes · all covered".
  - Replies saved before this slice carry no coverage and keep the earlier rule.
- **A book summary built from summaries.** A novel of more than 20 covered scenes cannot be read in one request.
  The Summaries view now offers *Refresh the book from its summaries…*.
  - It plans the request exactly as the compiler would. Per chapter, it tries reading one scene and covering the
    rest from current part, chapter and scene summaries, within the compiler's limits (20 parts, 20 chapters, 40
    scenes, 4,000 characters each).
  - When a plan covers every scene, the button opens the writing assistant with a *Summary* request set up: novel
    scope, author analysis, one source scene and a fixed instruction. The author prepares, reviews and sends it.
  - Otherwise it says how many scenes are not yet covered: "21 scenes are not covered by a current part, chapter or
    scene summary yet."
- **Saving.** Reply cards gain *Part summaries*. *Save all ready* saves scenes, then chapters, then parts, then the
  book.
- **Bug fixed on the way.** A pending chapter or novel details write that carried a summary basis was dropped when its
  device journal was read back, because the check rebuilt the write without the basis
  (`src/features/novel/persistence/metadataJournal.ts`). The check now uses the pending basis. A regression test
  fails without the fix.
- **BFF.**
  - `story_summary_basis.py`: `part_bases`.
  - `story_assistant_context.py`: part summaries, the `part` reasons, part rows and coverage.
  - `assistants/novel_result.py`: verifies part rows, part summaries and coverage in stored packets. It accepts a
    reply part summary only for a listed part whose summary was not sent, with coverage as its basis.
  - `models/novel_assistant.py`: `partSummaries` in the reply, at most 20, each at most 4,000 characters.
  - Graph `runtime/novel_assistant.v2.json`: the *Summary* instruction states the coverage rules, and the reply
    schema gains `partSummaries`. The catalog hash is now
    `beb4e0e3d26a93ba40c9c6126c396092d0b9fc3ba4aff0e32e3f202d21ff8fe9`.
  - No schema change; part details already hold JSON. Nothing goes to `api.magic_llm` beyond the graph the BFF
    already sends inline.
- **Live check, real API and data** (BFF log `.dev/logs/bff-novelparts1-20261018T015217.log`):
  - On *The Lighthouse Keeper (import check)* (Part One: Fog = Chapters 1–2, four scenes; Part Two: Clear = Chapter
    3, one scene), a *Summary* request was anchored at Chapter 1 · Scene 1 with one source scene. It sent the
    current summaries of Scenes 2–3, Chapters 2–3 and the book. The prepared prompt showed Chapter 1 3/3, Part One
    4/4, Part Two 1/1 and the whole novel 5/5, all covered.
    - The first send failed with `LLM_EXECUTION_STREAM_INCOMPLETE`. The executor's own records show its run
      completed (889 completion tokens), so the stream ended without a clean finish on the way to the BFF. A new
      request with the same choices succeeded. The cause was not found; it is not reproducible from here.
    - The real reply's summaries of Scene 1, Chapter 1, Part One, Part Two and the book were all *Ready*. **Save all
      5 ready summaries** reported "Saved 5 summaries." The database has Part One's summary with a 4-entry basis and
      Part Two's with 1 (metadata revision 2 each). The novel's summary has a 5-entry basis.
  - A follow-up anchored at Chapter 3 · Scene 1 sent Part One's new summary. Chapters 1–2 and their scenes were left
    out as *its part's summary is sent*. Coverage again showed every unit complete.
    - Sending it was refused with 402 `PLATFORM_CREDITS_EXHAUSTED`: the free test account had used its 20 credits for
      2026-10-18 (UTC). The drawer showed only "The assistant could not complete that request." (see below).
  - A fictional Markdown manuscript, *The Ledger Keeper (summary check)*, was imported: Part One: Ashfall, three
    chapters of seven scenes; Part Two: Embers, one chapter of one scene; 22 scenes in all.
    - The Summaries view showed 29 without a summary, and the book button explained that 21 scenes are not covered.
    - Part One's summary was written by hand in its details. The database row holds it with a 21-entry basis. The
      view then showed Part One *Current* and the button enabled.
    - The button opened the assistant set up as described. The prepared prompt read Chapter 4 · Scene 1 only, sent
      Part One's summary, and showed the whole novel 22/22 covered. It was not sent: no credits were left.
- **Checks.**
  - BFF novel/story/assistant/schema/summary selection: 3,695 passed. The outside failures are the 11 known ones:
    - `test_user_preferences_contract` (9);
    - `test_speech_import_boundary` (1);
    - `test_fish_calls_migration` (1), whose expected schema differs in `tb_llm_assistant_turn` and
      `story_generation`, not in tables this slice touches.
    - One more file does not collect: `tests/test_voice_call_chat_integration.py` cannot import
      `VoiceOrchestrationEngine` (voice work in progress).
  - New BFF tests: `test_story_assistant_part_summaries.py` (21: bases; context with stale and read parts; coverage;
    reply completeness and tampering; 17 stored-packet corruptions).
  - Frontend novel + API + shared: 2,389 passed / 14 skipped, with the three outside voice failures
    (`sessionVoiceApi.test.ts` 2, `fishAudioSupport.test.ts` 1).
  - New frontend tests: `storyAssistantPartSummaries.test.ts` (5, against BFF-compiled fixtures, including the
    journal regression) and `NovelPartSummaries.test.tsx` (4). `NovelSummaryStatus.test.tsx` gains the long-book
    case.
  - Typecheck and Storybook typecheck 0 errors; `pnpm build` passes; lint of the edited files is clean.
  - Backups: `magic-worlds-api/.dev/backups/novel-part-summaries-20261018/` and
    `magic-worlds/.dev/backups/novel-part-summaries-20261018/`, each with `SHA256SUMS`.
- **Limits and what was not covered.**
  - A part of more than 1,000 covered scenes cannot have a tied summary.
  - The book plan cannot know the prompt's budget. If preparation leaves a summary out for room, the prepared prompt
    shows the gap in its coverage lines, and an incomplete summary cannot be saved.
  - Dropping a reply summary of a part whose summary was sent, and the reply side of a book-from-summaries request,
    are covered by tests but were not sent live (credits).
- **Outside finding.** No LLM surface maps 402 `PLATFORM_CREDITS_EXHAUSTED` to a message. The shared assistant hook
  and the novel drawer fall back to "The assistant could not complete that request." **Fixed 2026-10-18 07:42:**
  `llmRecoveryMessage` now maps it (en/es: nothing was sent or charged; daily credits renew at 00:00 UTC, or add
  credits in *Plans & credits*), which covers the assistants (novel included), inline AI, card generation and
  adventures. Unit test added; not seen live, because the account had credits left (see D4 slice 15).
- **Still open for K09:** an evaluated stored retrieval index — done in the next section.

### D3 slice — an evaluated stored retrieval index (rest of K09, 2026-10-18)

- **What changed.** The assistant chooses which scenes to read, for *This novel*, *This chapter* and the other wide
  scopes. Before this slice, it ranked them by how many question words appeared anywhere in a scene's text (MySQL
  `LOCATE` on `LOWER(plain_text)`). A word that was in every scene counted the same as a rare name.
- **Policy `lexical-bm25-v1`** (`magic-worlds-api/src/services/story_retrieval.py`):
  - Text is NFKC-normalized and case-folded. Latin, Greek and Cyrillic letters lose their accents, so "corazón" and
    "corazon" are one term.
  - A term is a word of at least three letters, or a number of at least two digits. Han, kana and Hangul have no
    spaces between words, so they are indexed as overlapping character pairs.
  - A plural `s` is folded on words of five or more letters ("lanterns" → "lantern"), in the prose and the question
    alike. Shorter words keep it ("keys" stays "keys"; see the evaluation).
  - English and Spanish function words are dropped from the question. At most 12 question terms are used.
  - Scenes are ranked by BM25 (k1 1.2, b 0.75). Term rarity and average length come from **the request's own
    candidate scenes only**, never from other novels or accounts.
  - Inside a read scene, paragraphs are ordered by the summed rarity of the question terms they hold.
- **The stored index is only a cache of that ranking** (`src/database/mysql/story_retrieval_store.py`):
  - `story_scene_retrieval` holds one row per indexed scene: its prose revision, content hash, policy and term count.
    `story_scene_term` holds its postings (term, frequency).
  - A row counts only while the scene's revision, content hash and the policy all match. Every other candidate is
    scored from its current `plain_text` in the same read. So the ranking is the same whether the index is warm, cold
    or partly stale; the cache only makes it faster.
  - A preview that found unindexed or stale scenes starts indexing that novel in the background after its read
    transaction: batches of 50, one transaction each, at most 100 batches, one indexer per novel at a time. Each row
    is written from the prose at the revision it read. The send path never writes.
  - Both tables cascade from `story_scene`, so trashing a novel for good, account erasure and wipes remove them with
    the scenes.
- **Evaluation** (`scripts/evaluate_story_retrieval.py`, deterministic, no model calls). Three fictional corpora:
  English (90 scenes), Spanish (60) and Japanese (40), with repeated filler, distractors that share words with the
  answer, and 14 questions with one known answer scene each. The anchor is the last scene.

  | Method | Answer ranked 1st | In top 3 | Mean reciprocal rank |
  |---|---|---|---|
  | Before (word presence, `LOCATE`) | 5 / 14 | 8 / 14 | 0.473 |
  | BM25, no plural folding | 12 / 14 | 12 / 14 | 0.861 |
  | BM25, folding four-letter plurals too | 12 / 14 | 13 / 14 | 0.882 |
  | **BM25 as shipped (`lexical-bm25-v1`)** | **13 / 14** | **13 / 14** | **0.930** |

  - Folding four-letter plurals was tried and rejected: "keys" then matched the distractor "The keys to the boathouse"
    and pushed the brass-key answer from 1st to 3rd.
  - **Limit kept on purpose:** "Who drowned?" against a scene that says "went under and did not come up" ranks 56th
    with every method. Lexical retrieval cannot match a paraphrase. Embeddings were not added: they would need a
    declared helper model and a second retention policy.
- **Live check, real API and data** (BFF log `.dev/logs/bff-novelretrieval1-20261018T023044.log`). Novel: *The Harbor
  Log (retrieval check)*, a fictional import of 60 chapters and 1,500 scenes (5.6 MB). Every preview was anchored at
  Chapter 60 · Scene 25, scope *This novel*, through the anchor scene. Times are the browser's request durations.

  | Question (source scenes) | Before (old code) | Cold, empty index | Warm, indexed |
  |---|---|---|---|
  | "Where did Ivo bury the copper compass?" (4) | Ch 1 · S13 picked; 1,222 ms / 1,243 ms | — | Ch 1 · S13 picked; 266 ms / 450 ms |
  | "Who rang the chapel bell twice?" (4) | Ch 31 · S1 picked; 981 / 1,219 | — | Ch 31 · S1 picked; 270 / 447 |
  | "What did the ferryman say about the tide tables?" (4) | Ch 60 · S16 picked; 1,058 / 1,354 | — | Ch 60 · S16 picked; 267 / 446 |
  | "Did the ferryman say the tide was going out?" (2) | **Ch 60 · S24 picked, S16 dropped** | **Ch 60 · S16 picked**; 654 / 837 | Ch 60 · S16 picked; 247 / 600 |

  - The first time is `assistant-context`, the second `novel-preview`.
  - The last question is the one where the old count failed. Scene 24 holds the common filler "The tide was going
    out" and sits nearest the anchor; the old count tied it with the real answer and broke the tie by distance. BM25
    weighs the rare "ferryman" and picks Scene 16.
  - After the first cold preview the log shows `story_retrieval_indexed … scenes=1500` about 10 s later. The database
    then held 1,500 index rows (950,005 terms) and 138,144 postings.
  - **Freshness:** a sentence naming the ferryman was added to Chapter 60 · Scene 24 in the editor (revision 1 → 2).
    Its index row stayed at revision 1, without the term. The next preview picked Scene 24 from its new prose, and the
    log then showed `scenes=1`: the row was at revision 2 with a `ferryman` posting. The sentence was then removed
    (revision 3, original content hash restored).
- **Schema upgrade.** `2026_10_novel_presets` → `2026_10_novel_retrieval`, two new tables and nothing else, applied with
  `scripts/migrations/20261018_novel_retrieval.py`:
  - Read-only check first: 2 steps remaining, 118 tables preserved.
  - Verified private backup with row fingerprints:
    `magic-worlds-api/.dev/backups/novel-retrieval-pre-20261018T083019Z.sql.gz` (118 tables, 10,121 rows, sha256
    `e06d2de18edb1ccf36d900200d376ee39654ac9724134f636401f43aa75553eb`).
  - Apply: 10,120 existing rows matched their fingerprints before and after (the marker row is not counted). A second
    read-only run reports the new revision with nothing left.
  - Every earlier novel migration recognizes the new marker. The preset migration now targets the retrieval
    predecessor. Bootstrap: 120 tables, 166 foreign keys.
- **Checks.**
  - BFF novel/story/assistant/schema/retrieval selection: 3,706 passed. Only the 11 known outside failures remain
    (`test_user_preferences_contract` 9, `test_speech_import_boundary` 1, `test_fish_calls_migration` 1), and
    `tests/test_voice_call_chat_integration.py` still does not collect (voice work in progress).
  - New BFF tests: `tests/services/test_story_retrieval.py` (6: terms and folding in four scripts, question terms,
    rarity from the candidates only, the evaluation gate, current postings giving the same statistics as the prose,
    indexing writes) and `tests/test_novel_retrieval_migration.py` (4). `test_story_assistant_context_store.py`
    gains a test that a current index ranks without reading prose or indexing again.
  - Frontend novel + API + shared: 2,389 passed / 14 skipped, with the three outside voice failures
    (`sessionVoiceApi.test.ts` 2, `fishAudioSupport.test.ts` 1). Typecheck and Storybook typecheck 0 errors;
    `pnpm build` passes. No frontend change was needed.
  - Backups of every edited file: `magic-worlds-api/.dev/backups/novel-retrieval-20261018/` and
    `magic-worlds/.dev/backups/novel-retrieval-20261018/`, each with `SHA256SUMS`.
- **Limits.**
  - Paraphrase is not matched (see above).
  - Spanish `-es` plurals ("mareas" → "marea" works, "canciones" does not become "canción") and four-letter English
    plurals are not folded.
  - Rarity is computed per request from its candidates, so the same scene can score differently in a chapter scope
    and a novel scope. This is intended.
  - Indexing runs inside the BFF process. A restart while it runs leaves the rest unindexed until the next preview,
    which still ranks correctly from prose.
- **K09 is now complete.**

### D2 slice — large-manuscript performance (2026-10-18)

- **Fixture.** *The Harbor Log (retrieval check)*: 60 chapters, 1,500 scenes, about 1.1 million words (5.6 MB of
  prose). Its studio index (the outline the editor loads) is 1.3 MB. That is about five times the largest novel
  proposed in [12](12_validation_and_acceptance.md#performance-and-storage-benchmarks). *The Lighthouse Keeper
  (import check)*, 5 scenes, was the small comparison.
- **How it was measured.** Live in the browser against the real BFF and data: the Event Timing API for key and click
  latency (p50/p95 over 40+ keystrokes), the long-task observer, `performance.memory`, DOM node counts, React's
  development render times per component, and direct reads of the device cache in IndexedDB. **All numbers are from
  the Vite development build** on a desktop machine. The production build, CPU throttling and low-end devices were
  not measured.
- **What was found and fixed.**
  1. **The planning drawer rendered on every keystroke while closed.** It built the board for all 1,500 scenes
     (98 ms per key). Its contents now render only while it is open; its state (tab, selections) lives outside, so
     it survives closing. (`NovelPlanningViews.tsx`)
  2. **The docked outline listed every scene and re-rendered on every keystroke.** It held 22,137 DOM nodes and took
     142 ms per render. Above 200 scenes the outline now lists only the open chapter's scenes; every chapter has a
     show/hide button with `aria-expanded`/`aria-controls` and a scene count, and the author's choice wins over the
     default. Shorter novels stay fully listed and are collapsible too. The tree is memoized and receives its
     handlers through a ref, so typing does not re-render it. (`NovelChapterRail.tsx`)
  3. **The device read cache kept a copy of the whole studio index with every scene it remembered.** The record
     held 11 copies of the 1.3 MB index: 15.79 MB of the 16 MB per-novel limit, so no further scene reads fit. Each
     scene switch serialized about 82 MB and caused long tasks of 99–243 ms. The stored form (schema 2) now keeps
     each distinct outline once and lets scenes refer to it by a key (outline version, hash and length). Size is
     measured as UTF-8 bytes of the stored form without building a second copy. Older schema 1 records are still
     read and are rewritten as schema 2 on the next save; malformed records are refused. An older build of the app
     opened in another tab treats schema 2 records as unreadable and reads from the server instead.
     (`studioReadStorage.ts`)
  4. **The planning drawer rendered the board and the hidden timeline in full when opened** (3,000 list items). The
     timeline now renders only when chosen, as the matrix already did, and above 200 scenes the board opens with the
     current chapter only, with the same show/hide buttons.

  | Measurement (1,500-scene novel) | Before | After |
  |---|---|---|
  | Typing, narrow window (1,030 px), key latency p50 / p95 | 120 / 216 ms, a ~95 ms long task per key | 32 / 40 ms, no long tasks (same as the 5-scene novel) |
  | Typing, wide window (1,600 px, outline docked), p50 / p95 | 376 / 464 ms | 24 / 40 ms |
  | DOM nodes on the page while writing | 22,137 | 1,609 |
  | Opening the novel | 9 long tasks, 1,097 ms in total, longest 363 ms | 1 long task, 61 ms |
  | Opening the chapters panel (narrow) | 456 ms | the open chapter only; showing another chapter takes 88 ms |
  | Scene switch, p50 / p95 | 106 / 338 ms | 90 / 134 ms |
  | Device cache record for this novel | 15.79 MB (full), 11 outline copies | 2.74 MB with 2 outlines; 2.86 MB after 21 scenes |
  | Opening planning views | 624 ms click, long tasks of 586 and 169 ms, 19,834 DOM nodes | 136 ms click, one 92 ms long task, 556 nodes in the drawer |
  | Showing another chapter on the board | — | 64 ms, no long task |

  - **Stable over time:** across 60 scene switches the JS heap stayed between 388 and 477 MB (development build) and
    the DOM at 1,609 nodes.
  - **Already fine, unchanged:** manuscript search answers in about 200 ms from the BFF for "ferryman" and "tide",
    20 results per page, with no long task; a scene save request takes about 76 ms.
  - Every typing test was undone afterwards; Chapter 60 · Scene 24 and the small novel hold their original text.
- **Checks.**
  - New tests: `NovelChapterRail.test.tsx` (long novel lists the open chapter only, show/hide with `aria-controls`,
    selection; a short novel stays listed and collapsible), `NovelPlanningViews.test.tsx` (the long board opens on
    the current chapter, the timeline is not mounted until chosen, choices survive closing; a short board has no
    show/hide controls), `studioReadStorage.test.ts` (5: one outline kept and read back equal, differing outlines
    kept apart, schema 1 still readable, malformed records refused, byte count equal to `TextEncoder`).
  - Full app suite: 5,721 passed, 14 skipped. **No novel test fails.** 59 failures in 19 files are all outside this
    work, in other in-progress areas: voices and admin voice presets, interaction/voice calls, billing, call
    transcripts, the docs roadmap entry for voice calls, `sessionVoiceApi.test.ts` and `fishAudioSupport.test.ts`.
  - Typecheck, Storybook typecheck, `pnpm build` and ESLint on the edited files: 0 errors.
  - Backups of every edited file before the change: `magic-worlds/.dev/backups/novel-large-manuscript-20261018/`
    with `SHA256SUMS`. No backend or schema change.
- **Limits.**
  - Not measured: the production build, CPU throttling, phones and low-end hardware, and a screen reader on the new
    show/hide buttons.
  - The timeline and matrix still list every scene when chosen. In this novel, whose scenes have no story time, the
    timeline lists all 1,500 as undated: 280 ms to show, one 224 ms long task.
  - A scene switch still reaches 134 ms at p95; it was not profiled further.
  - The 200-scene threshold is a fixed constant (`LARGE_OUTLINE_SCENES`), not a preference.

### D5 slice 10 — EPUB, OpenDocument and RTF import (rest of X01/X02, 2026-10-18)

- **What changed.** *Import manuscript* now also reads EPUB (`.epub`, EPUB 2 and 3), OpenDocument text (`.odt`) and
  RTF (`.rtf`), up to 10 MB, through the same reviewed preview, loss report, chapter-level choice, scene-break choice,
  reviewed commit and kept original as Markdown, text and Word (see slice 5). PDF and old Word (`.doc`) are still
  refused with what to do instead.
- **Readers** (`magic-worlds-api/src/services/story_import_formats.py`; dispatch in `story_import.py`):
  - *EPUB:* the package's `container.xml` → OPF → spine order; title and language from the OPF metadata (else the
    page's `lang`). XHTML pages are read with Python's HTML tokenizer, which resolves nothing external. Headings,
    paragraphs, `<br>`, bold/italic/strikethrough (tags, simple CSS class rules from the book's style sheets, and
    inline `style`), links, quotes, nested lists with their start number, and `<hr>` or `* * *` scene breaks are kept.
    Title pages, covers, navigation, footnotes and endnotes (`epub:type`/`role`), ruby readings, images, SVG/MathML
    and scripts are left out and counted; tables and `<pre>` become plain paragraphs and are counted.
  - *A book without headings* (LibreOffice's EPUB export is one) is divided where its own table of contents (EPUB 3
    `nav` or EPUB 2 NCX) starts each entry, including entries that point into a page by `id`. Entries named as parts
    ("Part One") rank above the others. A paragraph repeating its entry's title is not kept twice.
  - *ODT:* `content.xml`, `styles.xml` and `meta.xml`. `text:h` outline levels and heading styles, the *Title*
    style, quotation styles, bold/italic/strikethrough from automatic and named styles (with inheritance), links,
    line breaks, `text:s` spaces, nested lists with numbering, start values and continued numbering, sections, and
    the default language. Tracked changes (deletions applied, insertions kept), notes, comments, frames/images,
    ruby readings and the table of contents are counted; tables become paragraphs.
  - *RTF:* a bounded tokenizer (nesting ≤ 512): the code page (`\ansicpg`, including double-byte pages such as 932),
    `\u` with its fallback skipped, surrogate pairs, the `\upr`/`\ud` Unicode pair, the style sheet (heading and
    quote styles, `\outlinelevel`), `\info` title, `\deflang` (or the Normal style's language), bold/italic/
    strikethrough, `HYPERLINK` fields, list paragraphs (`\ls`/`\ilvl` with the `\listtext` number), `\line`, and
    `\trowd` tables as paragraphs. Pictures, shapes, objects, footnotes, comments, deleted revisions and a `TOC`
    field's result are left out and counted.
  - *Every format:* a file with no headings at all takes chapters from standalone lines such as "Chapter 3: The
    tide", "Capítulo 1" or "Part Two", as plain text already did. This also applies to Markdown and Word files
    without headings; files with headings are unchanged.
- **Safety.** One budget of 64 MB unpacked for all members of a package, at most 4,000 members; encrypted zip
  members, ODT `encryption-data`, EPUB `rights.xml`, and EPUB `encryption.xml` entries other than font obfuscation
  are refused as `STORY_IMPORT_ENCRYPTED` ("password-protected or uses DRM"). Package XML with an internal DTD or
  entities is refused (`STORY_IMPORT_UNSAFE`); a plain EPUB 2 `DOCTYPE` without a subset is set aside. Paths that
  leave the package are refused. A spreadsheet or other OpenDocument named `.odt` is refused as unreadable.
- **Frontend.** The dialog accepts `.epub`, `.odt` and `.rtf`, names the formats (*EPUB*, *OpenDocument*, *RTF*), and its
  help, refusal and loss texts no longer say "Word" where they apply to every format (en and es). The contract
  accepts the three formats and the new `ruby_dropped` loss; the original-file download knows their media types.
- **Database.** `story_import_source.format` gains `epub`, `odt` and `rtf` (appended enum values only; an in-place
  metadata change). Revision `2026_10_novel_retrieval` → `2026_10_novel_import_formats`, script
  `scripts/migrations/20261018_novel_import_formats.py`; every earlier novel migration and the bootstrap guidance
  recognize the new marker.
  - Read-only check first: 1 step remaining, 120 tables.
  - Verified private backup with row fingerprints:
    `magic-worlds-api/.dev/backups/novel-import-formats-pre-20261018T092423Z.sql.gz` (120 tables, 149,798 rows,
    sha256 `2e904295c9a89833ef2fb1741168084041461afb93a4500a1049ce698403a132`).
  - Apply: all 149,797 existing rows matched their fingerprints (the marker row is not counted). A second read-only
    run reports the new revision with nothing left.
- **Live check, real API and data** (BFF log `.dev/logs/bff-novelformats1-20261018T032636.log`).
  - LibreOffice 26.2 made an ODT, an RTF and an EPUB from one fictional Spanish manuscript: two parts, three
    chapters, bold/italic/strikethrough, a link, a nested bullet list, a numbered list starting at 3, a quote, a
    `* * *` break, a table, an image, accents and a Japanese line.
  - In the library's *Import manuscript* dialog each previewed as **2 parts, 3 chapters and 4 scenes, 83 words**,
    with *1 image or drawing left out* and *1 table kept as plain paragraphs*. The ODT previewed again as 2
    chapters and 3 scenes at *Heading 1*, and back at *Detect from headings*.
  - LibreOffice's EPUB has no heading tags; its chapters came from its table of contents and chapter lines.
  - Each was created (*La casa del faro (EPUB / RTF / ODT import check)*) and opened at Chapter 1 · Scene 1 with the
    marks and link; the ODT and RTF scenes also kept the nested list and the quote. (LibreOffice's EPUB writes lists and
    quotes as styled paragraphs, so they arrive as paragraphs.)
  - The database holds each with format `epub`, `odt` or `rtf`, its byte count and SHA-256 equal to the local file,
    2 parts, 3 chapters and 4 scenes. The EPUB's original read back through the API is 3,935 bytes of
    `application/epub+zip` with the same SHA-256.
- **Checks.**
  - New BFF tests: `tests/services/test_story_import_formats.py` (9: EPUB structure, marks from CSS, losses and the
    title page; an EPUB divided by its NCX; our own EPUB export reading back like the Word export; DRM, entity,
    escaping and damaged EPUBs refused; ODT styles, lists, continued numbering, tracked changes, notes, comments and
    contents; protected and foreign ODTs refused; RTF styles, fields, lists, Unicode fallbacks, footnotes, comments,
    deletions and tables; a code-page-932 RTF and its `\upr` title; bad and too-deep RTF refused; chapter lines in
    files without headings) and `tests/test_novel_import_formats_migration.py` (3).
  - BFF novel/story/assistant/schema/import selection: 3,718 passed; only the 11 known outside failures and the
    `tests/test_voice_call_chat_integration.py` collection error remain (voice work in progress).
  - Frontend novel + API + shared: all pass except the three known voice failures (`sessionVoiceApi.test.ts` 2,
    `fishAudioSupport.test.ts` 1); `NovelCreationOrigin.test.tsx` was updated for the format-neutral "comments" text.
    Typecheck, Storybook typecheck, `pnpm build` and ESLint on the edited files: 0 errors.
  - Backups of every edited file: `.dev/backups/novel-import-formats-20261018/` in both repositories, each with
    `SHA256SUMS`.
- **Limits.**
  - ~~Front and back-matter roles are not restored on import.~~ Done in
    [slice 11](#d5-slice-11--front-and-back-matter-roles-on-import-rest-of-x01x02x06-2026-10-18).
  - EPUB: fixed-layout books, images used as scene-break ornaments, and headings drawn only by CSS font size are not
    recognized; ruby readings are dropped (counted). Only the first table of contents is used.
  - RTF: list numbering formats beyond the `\listtext` marker (letters vs. numbers) are approximated; only common
    Windows language IDs are mapped.
  - Flat OpenDocument (`.fodt`), old StarOffice and `.pages` files are not read.

### D5 slice 11 — front and back-matter roles on import (rest of X01/X02/X06, 2026-10-18)

- **What changed.** An imported file's front and back matter becomes chapters with that *Export section* role,
  outside any part, so a book exported from the studio and imported again keeps its dedication, foreword,
  afterword and the rest in place. The preview lists *Front matter: …* and *Back matter: …*, shows the role next to
  each chapter in the outline, and says the role can be changed later in the chapter's details. The commit writes
  it as the chapter's `details.exportRole`.
- **Where the role comes from** (`story_import.py`, `story_import_formats.py`):
  - *EPUB:* a top-level `section`, `div`, `article` or the `body` with a front/back-matter `epub:type`
    (`dedication`, `copyright-page`, `foreword`, …) or DPUB-ARIA role (`doc-dedication`, …), the export's
    `about-author` class, or an EPUB 2 package `<guide>` entry for the whole file. The section's first heading names
    the chapter; an untitled section takes the role's name in the book's language (English or Spanish labels, as in
    the studio). The class styling of a marked section (the export's italic dedication page) is not imported as
    the author's emphasis.
  - *Word, ODT and RTF:* the *Copyright*, *Dedication* and *Epigraph* paragraph styles the Word export writes
    (including their *First* variants) mark untitled matter. A paragraph in the *Dedication* or *Epigraph* style that
    is italic throughout shows the style, so its italic is dropped; partial italics stay. Titled matter is marked by
    a heading style named after the role (below). LibreOffice keeps these style names when it converts the Word file
    to ODT or RTF.
  - *Markdown:* the export's section comments (below). HTML comments are no longer imported as text anywhere in a
    Markdown file (they were kept literally before).
  - *Usual titles, every format:* a chapter or part heading named like matter ("Preface", "Prefacio",
    "Acknowledgements", "Agradecimientos", "About the author", "Appendix B: Maps", … in English, Spanish, French,
    German, Italian and Portuguese, without regard to case or accents) takes that role only where such matter goes:
    front matter before the first main-text chapter and back matter after the last one. A matter title in the
    middle of the book stays a chapter. Prologue and epilogue are never matter: in fiction they are story.
  - Matter headings no longer make the chapter level look one step higher: in a book with parts, a top-level
    *Preface* or *Acknowledgments* used to make the parts' chapters fall inside scenes.
  - Language codes `und`, `zxx`, `mul` and `mis` (the EPUB export writes `und` for a novel without a language) now
    give the new novel no language instead of a fake one.
- **Export markers** (`story_export.py`), so formats without semantics can carry the role:
  - *Word:* titled matter opens with a heading style named after its role (*Foreword Heading*, *Afterword
    Heading*, … *About the Author Heading*): Heading 1 by another name (based on it, same outline level and look),
    so the contents field and navigation are unchanged.
  - *Markdown:* an HTML comment before each section — `<!-- front matter: dedication -->`,
    `<!-- back matter: afterword -->`, and `<!-- main text -->` where the main text resumes. Comments are hidden
    wherever Markdown is shown. Plain text carries no marker.
- **Readers fixed along the way.** RTF paragraph styles now inherit their heading level through `\sbasedon` (an
  *Afterword Heading* based on *heading 1* was read as body text), and ODT/RTF skip a *Contents Heading*/*TOC
  Heading* paragraph, as the Word reader already did (LibreOffice writes the contents title outside the index).
- **Live check, real API and data** (BFF restarted with the change, test user's workspace):
  - I exported *Export check (test novel)* (dedication *For Mara*, main chapter *Lists and links*, afterword *After
    the storm*) to EPUB, Word and Markdown through the export API in the page, and converted the Word file to ODT
    and RTF with LibreOffice. All five previewed back through the import API as *Dedication* [dedication], *Lists
    and links*, *After the storm* [afterword], each with one scene and no parts; before the export markers, Word
    lost the afterword and Markdown both roles.
  - A hand-written Spanish Markdown file with *Prefacio*, *Parte uno* (*Capítulo 1*, *Introducción*), *Parte dos*
    (*Capítulo 2*), *Agradecimientos* and *Apéndice A: Mapas* previewed as preface, two parts with the mid-book
    *Introducción* kept as a chapter of *Parte uno*, acknowledgments and appendix.
  - In *Import manuscript* I picked the EPUB: the preview showed *Front matter: Dedication*, *Back matter:
    Afterword*, the note, and the badges in the outline. I created *Export check (matter import check)*; the saved
    chapters have `exportRole` `dedication` and `afterword` and the novel has no language. Exporting that novel to
    Markdown again put the dedication first and the afterword last with their comments.
  - That first import showed the dedication in italics (the EPUB page style). After the fix I imported the Word
    file through the dialog as *Export check (Word matter import check)*: the roles are saved, the dedication text
    has no marks, as in the original scene, and the chapter's *Organize & details* shows *Export section: Front
    matter · Dedication*. The same formatting check on the EPUB, Markdown, ODT and RTF files (exact export bytes,
    SHA-256 matching the API's) gave plain dedication text in all of them.
- **Checks.**
  - BFF: import, import-format, export (Word/EPUB/Markdown/PDF/companion), import store, export store and import
    route tests 78 passed, 1 skipped (new: EPUB semantics/guide/class, ODT/RTF styles with `\sbasedon` and the
    contents heading, the export → import round trip in Markdown, Word and EPUB, the title position rule,
    Markdown comments and `und`, the saved `exportRole`; export assertions updated for the role heading styles and
    comments).
  - BFF novel/story/assistant/schema/import selection: 3,677 passed, 60 failed, 1 collection error. The 11 known
    outside failures and the `tests/test_voice_call_chat_integration.py` error remain. The other 49 are schema and
    migration tests broken by another session's uncommitted work in `src/database/mysql/db.sql` and `bootstrap.py`
    (03:58–04:00): it moves `CONTENT_SCHEMA_REVISION` to `2026_10_membership_feature_flags` and adds two membership
    tables, while the novel migration chain and bootstrap tests still expect `2026_10_novel_import_formats` and 120
    tables. (For two minutes its `default 'default'` column also stopped `src.database` from importing; it then
    changed to `default 'initial'`.) This slice changed no schema, migration or bootstrap file; I left those as
    found. No import or export test fails. The running BFF started before that change.
  - Frontend novel + API + shared: 2,399 passed; only the three known voice failures (`sessionVoiceApi.test.ts` 2,
    `fishAudioSupport.test.ts` 1). Typecheck, Storybook typecheck, `pnpm build` and ESLint on the edited files: 0
    errors.
  - Backups of every edited file: `.dev/backups/novel-import-matter-20261018-matter/` in both repositories, each with
    `SHA256SUMS`.
- **Limits.**
  - Plain text carries no roles; an untitled dedication in a text file stays in the opening chapter.
  - Word, ODT and RTF files from other tools are recognized by the same style names or by usual titles only; a
    custom-titled afterword written with plain *Heading 1* stays a chapter.
  - A *Dedication*/*Epigraph* paragraph the author italicized throughout on purpose loses that italic (the style
    shows it again on export).
  - The two italic-check novels created during the live check remain in the test user's library.

### D5 slice 12 — project packages (N14, X08, 2026-10-18)

**Status: running in the app since 04:50**, when the other session restarted the BFF on `:8010` with its membership
feature-flag rollout applied (schema `2026_10_membership_feature_flags` at 04:45; the test user's `free` plan has
`novels` on). Until then this slice waited for that rollout, at the user's instruction (04:30): no bypass, no second
server, no test overrides of the new gate. Backup and restore were checked live, through the dialogs, the API and the
database (below). The summary fix found by that check went live at 05:09, when the BFF was restarted with the same
command at the user's instruction (log `.dev/logs/bff-novelpackage2-20261018T050933.log`).

- **What a package is.** *Back up novel…* in the Studio menu makes one `.mwnovel` file: a zip whose `mimetype` comes
  first (stored), a `manifest.json` with the format version, the choices, the counts, the Codex cards the novel refers
  to (by snapshot name), the images it refers to, and the size and SHA-256 of every other member; `novel.json` with the
  novel, its parts, chapters and scene settings (archived and trashed ones too) and every Codex reference; and one
  `scenes/<id>.json` per scene. Optional: comments and bookmarks (`notes.json`), planning items (`plan.json`) and every
  saved scene revision (`history/<id>.json`). Members, times and JSON are fixed, so the same novel and choices always
  make the same bytes; the download is accepted only when it matches the summary's size and SHA-256, and a novel saved
  in between is refused (`409 STORY_PACKAGE_SOURCE_CHANGED`) and summarized again. Images are referred to, not
  embedded.
- **Restore.** Choosing a `.mwnovel` in *Import manuscript* opens *Restore a backup*. The server checks the whole
  package before showing anything: archive safety (member names, count, inflated size, encryption), the manifest's
  hashes and counts, and every member against the rules the editor saves by (document schema and hashes, unit
  metadata and details, Codex snapshots, note anchors, planning-item schemas, revision lineage). The preview shows the
  outline, words, Codex names, whether the cover image is in this workspace, and switches for notes, planning and
  history (only what the package holds). The restore makes a **new** novel with new identities in one transaction,
  with the same identity, lock, receipt and erased-novel rules as creating one: units, scenes and checkpoints (with
  history, each scene keeps its revision numbers, lineage and times; without it each scene starts at revision 1 and a
  planning item keeps its quote, not its revision), Codex references, notes re-anchored by the copy transform
  (provenance `copy` naming the source novel), planning items with remapped scenes and Codex entries, and a first
  structure revision recording the package (`op: initial`, `_package`: hash, choices, counts, identity map). A cover
  is kept only when the same image is in the workspace; otherwise it is left out and recorded.
- **Routes.** `POST /stories/{id}/package-preview`, `GET /stories/{id}/package`, `POST /stories/package-preview`
  (multipart), `POST /stories/package-import`, `GET /stories/package-imports/{requestId}`. No schema change.
- **Files.** BFF: new `src/models/story_package.py`, `src/services/story_package.py`,
  `src/database/mysql/story_package_store.py`; routes added to `src/routes/stories.py`; tests
  `tests/services/test_story_package.py`, `tests/models/test_story_package_store.py`,
  `tests/routes/test_story_package_routes.py`. Frontend: `storyPackage.types.ts`, `storyPackageContract.ts` (+ test),
  five API methods in `index.ts`, `useNovelPackageSource.ts`, `NovelPackageExportDialog.tsx` and
  `NovelPackageRestoreDialog.tsx` (+ tests), `packageOutline.ts`, the Studio menu item, the `.mwnovel` route in
  `NovelImportDialog.tsx`, locales `novelPackage.ts` (en, es) and a line in `novelImport.ts`.
- **Live checks (2026-10-18, test user, workspace *My library*).**
  - *The Lighthouse Keeper (import check)* — 3 parts, 8 chapters (5 of them in Trash), 16 scenes, 24 saved revisions,
    2 comments, 1 Codex reference. *Back up novel…* with everything: the summary and the downloaded bytes named the
    same size and SHA-256 (the download stayed in page memory; no file was saved). Restored with history through
    *Import manuscript* → *Restore a backup* as *The Lighthouse Keeper (package restore check)* at 04:52. Against the
    original in the database: parts, scenes (text, order, status, Trash, revision), all 24 revisions (numbers, parent,
    source, restored-from, times), the Codex reference, and both comments (attached at the same quotes, state kept,
    provenance `copy`) match; every identity is new; structure revision 1 records the package counts; the receipt is
    `novel_package_import`. Chapters differ in two ways. Part Two's stored positions were 1, 2, 2 and are now 0, 1, 2,
    in the same reading order (the copy renumbers sibling positions). And the book, part and chapter summaries kept
    bases naming the *original* scene ids, so the restored summaries looked stale.
  - **Summary fix (live since 05:09).** A restored or copied book, part or chapter summary now stays current
    when it was current in the source and its unit covers the same scenes in the same order; it is then tied to the
    new scenes at their restored revisions (`carry_bases` in `src/services/story_summary_basis.py`, used by
    `copy_novel` and the restore). Any other basis keeps the source's entries, which name no scene of the new novel,
    so it stays stale. The same fault was in novel copies (D2) and is fixed there too. Unit tests for both. Live
    re-check: *The Lighthouse Keeper* backed up again (27,332 bytes, SHA-256 matching) and restored with history as
    *The Lighthouse Keeper (package restore, summaries)*. With the API's own basis rules, the three summaries current
    in the original (Chapter 2, Chapter 3, Part Two) are current in the restore and name its new scenes; the three
    stale ones (the book, Part One, Chapter 1) stay stale. In the first restore all six were stale. The Studio's
    *Planning views → Summaries* shows the same for the original and the new restore: 7 current, 4 changed since
    written, 0 not tied to their scenes, 0 without a summary.
  - *Assistant check (test novel)* — 2 chapters, 5 scenes (one in Trash), 16 revisions, 11 tasks, 9 story facts,
    1 stash item, 1 Codex reference. Backup with everything: 12,474 bytes, SHA-256 matching the summary. The restore
    dialog showed 2 chapters with 5 scenes · 183 words, *Codex: Mara*, 11 tasks · 9 story facts · 1 stash item and
    16 saved revisions. Restored **without** history as *Assistant check (package restore, no history)* at 05:00: every
    scene at revision 1 with the same text, order, status and Trash state; all 21 planning items back, with their scene
    links on the new scenes, both Codex links on the new reference, `sourceRevision` dropped from the 20 that had one
    and every quote kept; *Tasks & stash* lists them with *Go to passage*; the library card reads 2 chapters, 4 scenes,
    161 words, like the original's. A plan step's own text ("Planned from scene revision 2") is the task's wording,
    written when the assistant created it, and is kept as written.
  - The three restored novels open in the Studio. They remain in the test user's library.
- **Code checks.**
  - BFF package service, store, copy and summary-basis tests: 60 passed, including the new summary tests. The three
    package route tests fail inside the other session's `require_features('novels')` gate (it now looks up the user's
    plan in the database, which route tests do not have), like 175 of the story route tests; that is the rollout's test
    support, left to it.
  - Frontend: typecheck and ESLint clean for these files; contract, backup-dialog, restore-dialog and import-dialog
    tests 12 passed. At 05:06 `pnpm build` passes, and the novel + API + shared selection has 2,411 passed and
    4 failed: two `sessionVoiceApi` tests, `fishAudioSupport` and the other session's
    `featureFlags.integration` test, none in novel code. (Earlier, 171 tests threw `Novels are disabled.` from the
    rollout's `src/shared/featureFlags.ts` and the build failed on its `FeatureAccessGate.tsx`; both are fixed by it.)
  - Backups: `.dev/backups/novel-package-20261018/` in both repositories, with `SHA256SUMS`.
- **Limits (by design in version 1).** Images, generation runs, assistant conversations, snapshots and the
  structure history are not in the package; restoring the same package twice makes two novels; a saved revision that
  mentions a Codex reference no longer in the novel makes the package unrestorable.

### D5 slice 13 — export jobs with progress, a log and retry (rest of X10, 2026-10-18)

**Status: running in the app since 06:42.** At the user's instruction (06:38) the BFF on `:8010` was restarted
with the same command (`uvicorn src.main:app --host 0.0.0.0 --port 8010 --timeout-graceful-shutdown 10`, log
`.dev/logs/bff-novelexportjobs-20261018T063850.log`). The first live check found a deadlock (below). The fix went live
at 06:42 with the same command (pid 4082145, log `.dev/logs/bff-novelexportjobs2-20261018T064255.log`).

- **What the author sees.** The *Export manuscript* dialog keeps its summary and direct *Download*. Below the summary,
  *Built in the background* has a *Build in background* button that queues exactly the reviewed summary (same choices,
  same source version) as a job. Each job shows its file name (or *File · format* until built), a status (*Waiting*,
  *Reading scenes*, *Building the file*, *Printing the PDF*, *Saving the file*, *Ready*, *Failed*, *Canceled*), the
  attempt number after a retry, scene count, size and SHA-256, and a *Log* with the time of every step (requested,
  started, scenes read, printing, built with size, saved with file name, size and SHA-256, failed with the reason,
  canceled, interrupted, file removed). *Cancel* stops a waiting or running job; *Try again* repeats a failed or
  canceled job's request as a new attempt; *Download* saves the file only when its size and SHA-256 match the job.
  The list is read again every 1.5 s while a job is waiting or running, and not at all once every job has finished.
  A job keeps building after the dialog closes.
- **Rules.** A job is created only while the novel's saved source version is the one the summary saw
  (`409 STORY_EXPORT_SOURCE_CHANGED` otherwise, and the dialog reads the summary again); a retry checks the same, so
  a novel changed since the first attempt is refused instead of exported with other text. A replayed request id
  returns the same job; reusing it for another request is `409 STORY_EXPORT_REQUEST_REUSED`. At most 3 waiting or
  running jobs per user and workspace (`429 STORY_EXPORT_BUSY`), and at most 2 building at once in the process. The
  worker writes progress only while the job is still running, so a cancel is never overwritten, and a canceled job
  keeps no file. A job that stops sending its 15 s heartbeat for 120 s (the server restarted) is reported as failed
  with `STORY_EXPORT_INTERRUPTED` the next time the list is read, and can be retried. Only the newest 5 files per
  novel are kept; older jobs keep their log and manifest, and their log records the removal.
- **Storage.** The file is stored in 4 MiB chunks (`story_export_file_chunk`), each written in its own transaction:
  the dev MySQL's redo log (100 MB) allows about 10 MB of blob per transaction. The job becomes *completed* only after
  every chunk is stored and their total size matches the manifest.
- **Schema (additive, applied 2026-10-18 06:22 CST with the user's approval).** Revision
  `2026_10_membership_feature_flags` → `2026_10_novel_export_jobs`: two new tables, `story_export_job` (owner scope,
  request id, retry lineage, frozen request, status, stage, log, error code, manifest, file size and SHA-256, times;
  checks tie a file to *completed*, a reason to *failed* and a retry to attempt > 1) and `story_export_file_chunk`.
  No existing table changed. Verified private backup first:
  `magic-worlds-api/.dev/backups/novel-export-jobs-pre-20261018T122216Z.sql.gz` (+ `.metadata.json`, mode 0600,
  SHA-256 `7fd7893a15a113bf416557d4eda5e22d2958012ab99fb0d06e6f943f07fd8a1a`). The upgrade re-checked all
  122 existing tables and 150,152 rows against the backup's row fingerprints before and after creating the tables.
  The schema test suite has the same 38 failures before and after (all from the membership revision, not this one).
- **Routes.** `POST /stories/{id}/export-jobs` (`{requestId, request}`, 202), `GET /stories/{id}/export-jobs`
  (newest 20), `GET /stories/{id}/export-jobs/{jobId}` (with the manifest), `POST …/{jobId}/cancel`,
  `POST …/{jobId}/retry` (`{requestId}`, 202), `GET …/{jobId}/file` (streamed; `409 STORY_EXPORT_JOB_NOT_READY`,
  `410 STORY_EXPORT_FILE_REMOVED`). All under the `novels` feature gate, read intent (an archived novel can be
  exported).
- **Files.** BFF: `src/database/mysql/db.sql` (two tables, marker), `bootstrap.py` (revision),
  new `story_export_job_migration.py`, `scripts/migrations/20261018_novel_export_jobs.py`,
  new `src/database/mysql/story_export_job_store.py`, new `src/services/story_export_jobs.py`, a progress hook in
  `story_export_store.read_export`, `StoryExportJobCreate`/`StoryExportJobRetry` in `src/models/story_export.py`, six
  routes in `src/routes/stories.py`; tests `tests/test_novel_export_jobs_migration.py`,
  `tests/test_story_export_jobs_runner.py`, `tests/routes/test_story_export_job_routes.py`. Frontend:
  `StoryExportJob*` types in `storyExport.types.ts`, `verifyStoryExportJob` in `storyExportContract.ts` (+ test
  `storyExportJobContract.test.ts`), five API methods in `index.ts`, `jobs` in `useManuscriptExportSource.ts`, new
  `NovelExportJobs.tsx` (+ test) in `NovelExportDialog.tsx`, `jobs` strings (en, es) in `novelExport.ts`, job
  fixtures in `src/test/fixtures/storyExport.ts`.
- **Code checks.** BFF: story route, export-job route, runner, migration and lorebook-target tests 121 passed; all
  export tests 108 passed; export-job route, runner and migration tests 10 passed after the locking fix. Frontend: typecheck and ESLint clean for these files; the novel + API selection has
  2,198 passed and 2 failed, both the known `sessionVoiceApi` tests outside novel code.
- **Deadlock found live and fixed.** Five parallel creates first failed with MySQL 1213 (deadlock) on 3 of 4
  requests; the browser saw *Failed to fetch* because the 500 carried no CORS headers. Each create held `FOR UPDATE`
  next-key locks over the owner's jobs (the stale sweep and the active count) and then inserted into that range.
  Completion and retention, which updated several job rows in one transaction, could form a cycle with those scans.
  Now creates are serialized per owner by a named lock (`GET_LOCK`), taken before the transaction's first read, so
  the count sees every earlier job without locking reads. The stale sweep reads without locks and updates one row per
  transaction, and retention removes each old file in its own transaction. No job write holds more than one job row
  besides creation's own. No row was left half-written by the failed attempt.
- **Live checks (2026-10-18, test user, workspace *My library*, novel *Assistant check (package restore, no
  history)*).** Through the API from the app's page:
  - A PDF job went queued → running/printing → completed in about 1 s, with 4 scenes and the log *queued, started,
    read (4 scenes), printing, built (32,889 bytes), completed*. A replayed `requestId` returned the same job.
  - The streamed file was 32,889 bytes, began `%PDF-`, and its SHA-256 (`3912adfa…`) equals the job's and the
    direct export summary's for the same request.
  - Refusals: a stale source version (`409 STORY_EXPORT_SOURCE_CHANGED`), a reused request id for another request
    (`409 STORY_EXPORT_REQUEST_REUSED`), an unknown job (`404`), and the file of a canceled job
    (`409 STORY_EXPORT_JOB_NOT_READY`).
  - After the fix, 5 parallel creates gave exactly 3 accepted and 2 refused (`429 STORY_EXPORT_BUSY`), with no
    deadlock in the log. The newest accepted job was canceled while waiting (*queued → canceled*, no file). Its retry
    ran as attempt 2 (*retry (2), started, read, printing, built, completed*) with the same SHA-256. Retrying a
    completed job was refused (`409 STORY_EXPORT_JOB_NOT_RETRYABLE`).
  - The 6th completed file removed the oldest one: its log gained *file_removed (5)*, its chunks are gone in the
    database, and its download is `410 STORY_EXPORT_FILE_REMOVED`.

  In the Studio (*More → Export manuscript*):
  - The new section listed every job with its name, *Ready* / *Canceled* badge, *Attempt 2*, local request time, scene
    count, size, SHA-256, the removed-file note and an open log with step times.
  - *Build in background* queued the reviewed Word summary. It was *Ready* (3.4 KB) within a second, with the summary's
    SHA-256 (`220757ce…`). *Try again* on the canceled PDF added a new *Attempt 2* row that went *Ready*.
  - After one word was added to a scene and saved (06:45), *Try again* on the old canceled job was refused: "The novel
    changed since this file was requested…". *Build in background* from the re-read summary made a new Word file
    whose SHA-256 (`fb5a4c78…`) matches the new summary. The word was then removed and saved; the export is back to
    161 words.
  - Per-job *Download* became a secondary button after this check, so the dialog's own *Download* stays the one
    primary action.

  Not checked live:
  - The *Download* buttons themselves. Saving a file in the browser needs the user's OK; the bytes were checked through the
    API instead.
  - An interrupted job, which needs a server restart in the middle of a build.
  - The intermediate stages in the UI: these test builds finish faster than one 1.5 s poll.
- **Not in this slice.** The shared *Tasks* drawer does not list export jobs yet (it would need a `novel_export`
  adapter in the BFF's `/tasks` and the frontend task union, both edited by other sessions). Jobs run in the BFF
  process, not a separate worker; a restart interrupts them and they are retried by the author.

### Which work belongs to the goal

| Work | Relationship to the requested plan |
|---|---|
| Editor, persistence, organization and recovery | Explicit D1/D2 work. |
| Story-aware chat, cited sources, reviewed proposals and variants | Explicit D3 work: A11, A20, A22 and A23 in the feature catalog. |
| Stop, same-request recovery and avoiding duplicate charges | Explicit A21 requirement. |
| Shared `api.magic_llm`, `magic-agents` and `magic-llm` changes | Not part of the plan. Installed on 2026-10-17 and **reverted the same day** at the user's instruction; the checkouts match their pre-install state (pre-existing local differences in `api.magic_llm` were left as found). |
| Whole-project database reset | Broader than necessary for novel schema work. The resulting non-novel recovery is complete. No repeat reset is authorized. |

### Explicit service boundary

**User instruction, 2026-10-17:** `api.magic_llm`, `magic-agents` and `magic-llm` are shared by other applications. Do not modify, install, restart or reconfigure them unless a change is a critical fix needed for the app to work, and ask first. No novel logic belongs in them. Implement the novel functionality in `magic-worlds` and `magic-worlds-api` against the existing `/v1/chat/completions`, `/models` and `/providers` contract.

### Next work, in execution order

1. **Finish remaining D1–D3 requirements.** Context/source policy, account/workspace/profile
   lifecycle, offline/retention and accessibility acceptance; production-build and low-end-device performance
   checks (the development-build measurement and fixes are done); resolve the release-relevant failures.
2. **Continue D4** after slice 17: the left-out outline changes path seen live when a model next errs, branches
   (N05), separate surfaces (U01), research (A28), and the rest of K12 (fields other than the description; new cards
   or lorebook entries as destinations). Grouped multi-scene manuscript changesets (prose half of R14, slice 16) and
   part proposals plus the quiet streaming drawer (rest of A17, slice 17) are done and checked live.
3. **Continue D5 after slices 1–13 and the style sheet (Word/Markdown/text, EPUB and PDF export, review-notes, AI-changes and style-sheet files, real Word lists and links, contents page, front/back matter, Markdown/text/Word/EPUB/ODT/RTF import with front/back-matter roles, Codex glossary, goals and writing log, project packages, export jobs), then D6**, as specified in the linked catalog and design documents: read-aloud and dictation; then series canon, overrides, presets and publication handoff. They remain part of the original goal.

### Where the work is

- Frontend: `/home/andres/WebstormProjects/magic-worlds`. BFF: `/home/andres/PycharmProjects/magic-worlds-api`.
  Neither is committed; both carry other in-progress work, so review changes per file.
- The BFF on `:8010` currently runs from a terminal process started during this work (the current one, pid 74695, was started by this work at 09:20 with the same command; log
  `magic-worlds-api/.dev/logs/bff-newpart-20261018T092026.log`), not from PyCharm. Restart it from PyCharm when convenient.
- Backups: `.dev/backups/novel-assistant-install-20261017/` — the shared-service snapshots before and after the
  revert, the project database backups, and `bff-protected-removal-*` with every BFF file touched by the
  protected-client removal (including the staged copy of the removed module).

The [feature catalog](05_feature_catalog.md), [implementation plan](11_refactor_and_migration_plan.md), [acceptance requirements](12_validation_and_acceptance.md) and [phase/dependency register](#roadmap-and-dependencies) define the full scope. The entries below retain dated evidence; an old “remaining work” statement does not supersede this current summary.
<!-- CURRENT_DELIVERY_STATUS_END -->

## Dated implementation evidence

**Source/lifecycle review:** 2026-10-15, America/Mexico_City. **Overall status: WIP.** The scene-writing foundation exists behind a frontend flag; the complete novel refactor is not implemented. This register is the delivery authority and records source evidence, remaining work, and acceptance gates. Owners and delivery dates are **TBD**; phases express dependencies.

The earlier cleanup rechecked current chapter DTOs, unordered save dispatch, ignored acceptance flush result and lowercase search offsets. Those historical mechanisms motivated the D1 changes below. The deep database/code/feature review added [15](15_database_migration_and_legacy_cleanup.md) and focused baseline tests. The earlier disposable-data reset policy was superseded after the user required recovery of non-novel content; the current preservation rule is below. M1–M3 and three lean DEV checks supersede the earlier production backfill/rollout matrix; CL-01–CL-10 remain a code-removal inventory. Historical controlled reproductions retain their original dates; that documentation review performed no implementation or deployment. The later execution checkpoint below records the current changes. Writing requirements from the superseded storytelling brief were consolidated into this dossier on 2026-10-15 (see 06, 07, 08 and 12). The 136-capability catalog and D1–D6 scope/status are unchanged.

**UI/UX plan updated:** 2026-10-15. The standalone demo and UX-01–UX-12 add prototype evidence and implementation guidance. Product availability, NE closure, and phase completion remain unchanged; the UI update is documentation work.

**Current data preservation rule:** 2026-10-16. Preserve all recovered non-novel content and current novels. Whole-database resets are disabled; earlier reset approval is not ongoing authorization. Use a verified private backup, reviewed scoped schema changes and the three short DEV checks. The full reset was broader than necessary for novel schema work.

**Non-novel recovery completed:** 2026-10-16 09:54:13 UTC. A verified October 15 backup plus retained binary logs reconstructed the project immediately before the first reset at 06:45:47 UTC. The rehearsed live merge verified **3,885 recovered rows across 96 non-novel tables**, retained current extra rows, mapped ownership by account hash, checked all **151 foreign keys**, and left every current `story_*` row and the `2026_10_novel_scenes` marker unchanged. API health and exact schema verification passed. Files were left untouched; the user confirmed that some records normally have no file. [15](15_database_migration_and_legacy_cleanup.md#non-novel-content-recovery--2026-10-16) contains the recovery record. D2 feature work remains WIP.

**Reuse/overlap review:** 2026-10-16. [07](07_target_architecture.md#reuse-and-overlap-decisions) records existing shared foundations, required extensions, two duplicated Codex helpers for CL-09 and ownership shared with the proposed main-assistant work. Exact instructions already persist in frozen execution payloads; NE-020 remains open for safe history exposure and revision/application lineage. This source review adds no test program and changes no implementation or phase status.

## Execution checkpoint — 2026-10-16

**Historical D1 checkpoint.** The D2 scene integration below supersedes its active schema/writer and selection format; the verified guarantees are retained.

The user requested review and execution. The reviewed implementation keeps React/TipTap, shared workspace/profile/task infrastructure, and the existing API boundary. **D1 reliability work is implemented and validated in this working checkout; overall delivery remains WIP.** No commit, release, real model-quality evaluation, or D2–D6 completion is implied.

- Ordered immutable save snapshots, independent text/metadata CAS, exact write receipts and small acknowledgements replace overlapping saves and timestamp authority. Local checkpoints retain account/API-origin/workspace/chapter scope and separate writers; recovery/conflict choices are explicit. Invalid titles do not prevent prose recovery.
- AI previews remain outside canonical prose. Explicit acceptance is one isolated undo/redo event, including rich replacements; ordinary edits/Tab do not accept. Body, checkpoint, generation status and application receipt commit atomically. Retries recover the same application without another paid execution.
- Exact Markdown serialization mapping resolves repeated selections and UTF-16 offsets. The server validates saved quotes, cursor boundaries and base revisions. Preview/execution use one context compiler with ordered/de-duplicated sources and enforced conservative input budgets. Links retain destinations; counts exclude beat comments and segment unspaced prose.
- Manuscript checkpoint history, comparison, copy and restore-as-new-revision are available. Narrow Studio containers collapse Codex before the outline, use shared drawers, and retain the editor instance. Save/error states announce changes; autocomplete controls reference active options. Broader assistive-technology, contrast, real-device and author validation remains open.
- The explicitly approved project-only reset rebuilt `magic_worlds` on `192.168.1.90:3306` with schema marker `2026_10_novel_revisions` (103 tables / 145 foreign keys). Exact schema verification and `/health` passed. The real MySQL smoke exercised save/reopen, idempotent replay, concurrent stale-write rejection, restore, and atomic generation-acceptance replay through revision 5. It used a stored candidate fixture and made no text-generation call. Startup's provider catalog/subscription reads are not model-quality evidence.

Evidence: [save queue regressions](../../src/features/novel/hooks/useSceneDraft.test.tsx), [preview/history regressions](../../src/features/novel/editor/extensions/aiSuggestion.test.ts), [selection mapping](../../src/features/novel/editor/documentSelection.test.ts), [local journal](../../src/features/novel/persistence/draftJournal.test.ts), [container layout](../../src/features/novel/hooks/useStudioLayout.test.tsx); BFF `tests/models/test_story_document_store.py`, `tests/services/test_story_context_compiler.py`, `scripts/smoke_novel_persistence.py` and `docs/api_usage/stories.md`. Verification details and limitations are in [01](01_current_state_and_evidence.md#execution-evidence--2026-10-16).

**Current remaining work is listed in the D2 checkpoint below.** A 320px fixture check does not close all UX-01–12 or NE-017/018 gates.

## D2 scene integration — 2026-10-16

**Core schema/API/editor integration is implemented and locally verified. D2 remains WIP; the 136-capability D1–D6 scope is unchanged.** [ADR 16](16_document_and_structure_decision.md) is implemented with versioned TipTap scene JSON, unique stable block IDs and Codex reference IDs. Markdown/plain text are derived projections; exact UTF-16 selection/cursor/split positions address the saved scene revision. The old chapter-body writer, tables, DTOs and callers have been retired without a development-data compatibility bridge.

- Parts/chapters/scenes have independent metadata, lifecycle and text authorities. The root has structure/metadata/context revisions. Scene autosave keeps the D1 queue/receipt/recovery guarantees; revision-aware cache merging preserves later text and moves independently. API/account/workspace/novel/scene scoped view preferences restore scene, cursor and scroll position.
- Atomic organization supports create, move/reorder, chapter/scene copy, scene/chapter split/merge, archive, recoverable trash and restoration. Copy allocates IDs, remaps local Codex mentions, and retains source/version lineage. At this initial checkpoint, guarded undo targeted only the previous operation and had no redo. The organization history checkpoint below supersedes that restriction with reviewed multi-step undo/redo and actual before-images.
- The nested outline exposes scenes and parts. Shared details/review drawers provide independent goals, visible inherited writing settings, POV/location/cast selection, summaries/notes, keyboard movement alternatives and explicit organization previews. A failed draft flush or active AI review blocks structure commits. Workspace and ancestor archive states retain readers and block mutations. Novel gallery Trash can restore the original root; list counts come from metadata summaries.
- Scoped Codex context uses scene → chapter → novel precedence. Removed snapshots remain readable by stable manuscript links, excluded from context, and restorable while disabled. Equal-name Markdown imports remain plain text; canonical reopen retains the exact reference ID. Conflicting copied pins fail explicitly.
- The approved development reset installed `2026_10_novel_scenes` (**106 tables / 151 foreign keys**); exact verification and API `/health` passed. Fresh provider-free MySQL smoke reached scene revision **10** / structure revision **18**, covering receipt replay, concurrent CAS, independent goals, acceptance, restore, copy/split/merge/lifecycle, compound undo/later-text protection, scoped mention-copy/removal/restore, source version pins and summary counts.

Verification commands and qualification are in [01](01_current_state_and_evidence.md#d2-scene-integration-evidence--2026-10-16). Focused frontend checks passed **307 tests / 38 files**, build and story typecheck passed, and targeted novel/shared lint passed without warnings. Focused BFF results and final cleanup checks are recorded below. Browser evidence covers the desktop fixture outline, inherited details, independent goals, review preview and return focus on cancellation. It does not establish authenticated account persistence, full mobile/assistive-technology acceptance, model quality or production readiness.

**Next D2 work:** remaining nested/compound structure and scoped-context edge acceptance; measured long-document behavior and history/retention/author gates. Personal notes/anchors/comment copy, reviewed unit/novel copy, creation recovery, organization history with multi-step undo/redo, named snapshot capture/read/compare/restore and the scene-history contract are implemented in the checkpoints below. Review the complete catalog/acceptance matrix before accepting D2. Then implement D3 assistant/proposals, D4 memory/planning/personal review, D5 portability/productivity and D6 version-pinned series/extensions. The full 136-capability scope is unchanged.

## D2 mutation recovery checkpoint — 2026-10-16

**Implemented and verified in this checkout; D2 and the full D1–D6 goal remain WIP.**

- Shared journals scope every device record by API origin, stable author, workspace, novel, target and writer. Metadata forms retain final keystrokes when an inspector closes or changes target. Recovery is explicit; conflicts compare account/device values and rebase only changed fields. Summary edits keep their original source scene revision and show when it is stale. The header now opens this shared details form instead of dispatching a separate direct title save.
- Independent word-goal requests and novel archive/Trash/restore requests survive reloads with the original request ID and payload. Library recovery stays reachable after an interrupted Trash hides the original card. Exact retirement protects newer input and other writers, including recovery transferred across tabs. Storage failures remain visible, and recovered details can be downloaded when the clipboard is unavailable. Novel journals/editor block identities use the existing UUID fallback on LAN HTTP.
- Codex mutations use one atomic `/stories/{id}/codex` request with `expectedContextRevision`: selected-card batches, snapshot/settings edits, removal and disabled restoration commit one revision and receipt. Stale heads and same-scope active duplicates fail without partial changes. Receipt replay precedes source resolution, so later source changes/removal cannot change the result. Source/version pins remain immutable. Complete reference acknowledgements contain no prose and tolerate reversed response order. Old unguarded `/card-refs` model/routes/client writers were removed.
- Private snapshot forms retain unsent edits across closure and scope changes. They preserve the displayed base context revision, offer explicit field comparison/rebase and keep an uncertain write immutable until recovery. API guards reject truncated, foreign, stale or mismatched acknowledgements rather than showing a false save. Metadata summaries are rejected as editable full manuscripts.

Validation: **351 frontend tests / 45 files passed**, including the actual MySQL smoke document through the frontend runtime guard. **356 focused BFF checks and 190 startup checks passed** (two commands, 546 total). Production build passed; the existing bundle-size advisory remains. The provider-free MySQL smoke reached scene revision **10**, structure revision **18**, context revision **6**, including actual duplicate-batch rollback, concurrent context CAS and exact replay. API health remained `ok`. Final story/lint/diff checks and commands are in [01](01_current_state_and_evidence.md#d2-mutation-recovery-evidence--2026-10-16).

This adds no full offline/release guarantee, author study, model-quality evidence or phase-completion claim. The copy and creation checkpoints below extend this recovery foundation; the remaining D2 gates above are still open.

## D2 novel copy checkpoint — 2026-10-16

**Whole-novel copy/provenance is implemented and locally verified. D2 remains WIP.**

- Library and Studio actions open a shared review dialog with an independent title and explicit notes, Codex context, archived-item and Trash choices. Counts come from a lightweight saved-source preview. Source save/AI-review barriers run before preview and commit; changed source revisions require a refreshed review.
- A copy receives new novel/unit/reference/block identities and preserves canonical prose, formatting, goals, writing settings and source snapshot/version pins. Its root starts as a draft; selected child lifecycle states remain recoverable. Required historical links remain readable when optional Codex context is excluded. Stale or unpinned summaries show as unverified. The source's earlier checkpoints, candidates and active jobs remain with the source.
- One transaction inserts the new tree, revision-1 checkpoints, a frozen provenance manifest and the exact source request receipt. Copy inserts cannot update an existing identity. The manifest retains source revision vectors, options, counts and complete identity maps in the target's initial immutable structure revision. The details drawer can inspect it without loading the current source.
- Scoped copy journals retain the original immutable request and acknowledgement across reloads. Recovery reads its receipt before retrying; archived workspaces allow result/provenance reads. Uncertain results remain reachable in the library and Studio. Opening a confirmed copy is explicit and respects account/workspace and unsaved-editor barriers. A blocked device write reports the storage limitation.

Validation: **328 frontend tests / 47 files passed, one conditional fixture test skipped**; the latest actual MySQL copy wire and dialog checks then passed **7/7**. The library integration file passed **15/15**, including explicit open and archived-workspace restrictions. **199 focused BFF checks passed**. Production build, Storybook typecheck and targeted copy lint passed. These are separate commands with overlapping coverage, not additive totals. [01](01_current_state_and_evidence.md#d2-novel-copy-evidence--2026-10-16) records commands and limitations.

The provider-free smoke created only the isolated synthetic database `magic_worlds_novel_copy_test_e7f0dec5a3e1`. It verified actual HTTP/MySQL copy and provenance, exact concurrent replay, source-change rejection, collision rejection, rollback and archived read recovery. **The project database was untouched; no schema change or reset was required.** Browser inspection covers the desktop Storybook dialog and option counts; authenticated author, mobile and assistive-technology acceptance remain open. Named edition branches/comparisons (D4) remain separate. The later unit-copy checkpoint supersedes this checkpoint's explicit-options gap.

## D2 creation recovery checkpoint — 2026-10-16

**Novel creation request recovery is implemented and locally verified. D2 and the full D1–D6 goal remain WIP.**

- Creation requires a stable request ID and bounded metadata-only intent. The root identity derives from owner/application/workspace/request scope. A short exclusive workspace transaction creates the novel, insert-only chapters/scenes, initial checkpoints and exact receipt together. Concurrent identical first requests return the same result; changed intent under that ID is rejected. Replays check the receipt before resolving changed/deleted source cards or adventure sessions.
- `GET /stories/creation-requests/{request_id}` reads the owned result without a write, including in archived workspaces. POST now returns the original request-bound receipt; manuscript hydration is a separate read. A failed follow-up read retains the confirmed receipt instead of retrying creation.
- The shared DataProvider journals requests before POST across library, landing-page and card-gallery entry points. Reload recovery reads the receipt before retrying the exact immutable intent. Pending requests block replacement creation. Explicit recovery/open notices are available in the library, Studio and creation dialog; Studio opening observes the existing save/review barrier. Late responses stay in the original account/workspace, and another writer's request is adopted/retired exactly. Storage failure remains visible with in-memory recovery.

Validation: **392 frontend tests / 59 files passed, one conditional fixture test skipped**; this includes the actual isolated MySQL creation receipt through the frontend guard. **202 focused BFF checks passed**, including the shared smoke-isolation guard. Production build, Storybook typecheck and targeted lint passed. The provider-free HTTP/MySQL smoke used only the new synthetic database `magic_worlds_novel_copy_test_719c2a47c935`, verifying concurrent creation replay, changed-intent rejection, late receipt-failure rollback, identity-collision rejection, initial checkpoints, source resolution with eight requests sharing a four-connection pool, and archived receipt reads alongside existing copy checks. The persistence smoke also passed in `magic_worlds_novel_persistence_test_49b361b30831` at scene/structure/context heads **10/18/6** after both smoke scripts adopted the shared isolated allocator. **No project database mutation, schema change or reset was required.** API health and the required-request-ID/recovery OpenAPI contract passed read-only inspection.

Browser inspection covers the controlled desktop creation dialog: Create is disabled while a request is uncertain, recovery exposes the confirmed result, and opening remains a separate explicit action. Authenticated author, mobile/assistive-technology, general offline/storage-policy and long-document gates remain open. Commands, scope and limitations are in [01](01_current_state_and_evidence.md#d2-creation-recovery-evidence--2026-10-16). The later unit-copy checkpoint implements the next reviewed choices; current remaining work is listed above.

## D2 unit copy options checkpoint — 2026-10-16

**Reviewed chapter/scene copy choices are implemented and locally verified. D2 remains WIP; S05 still awaits annotation/comment copy.**

- Organization opens a dedicated saved-source review with an independent title and explicit author notes/local Codex choices. Chapter copies also select archived/Trash children and show selected scene/word counts and prose excerpts. The editor save/review barrier runs before loading the source and before commit. Source unit metadata, all scene text/metadata heads, source structure and Codex context are pinned; changed sources require an explicit refreshed review.
- Copies preserve exact rich prose, independent goals, writing settings and source revision/snapshot pins, with new unit/block/local-reference IDs. Included child lifecycle states remain recoverable. Excluding local context retains required links/POV/location/cast snapshots disabled; inherited context stays shared. Historical and current pins of the same card coexist. Verified summaries map to the copy's revision 1; stale/unpinned summaries remain unverified. Earlier candidates/history/jobs stay with the source.
- Atomic structure commits now insert new identities without upsert, preserve original units, checkpoint copied prose with lineage, record the reviewed options/heads in history and return a fully bound copy acknowledgement. Exact receipts replay before source checks. Source/identity/context/receipt failures leave no partial copy. Older retained receipts remain recoverable without admitting a new unguarded copy.
- Organization journals deep-clone nested intent. Uncertain copy choices stay locked; recovery reads the owned receipt before POST, including in archived workspaces. A confirmed result followed by a failed manuscript read remains recoverable. A missing result cannot write while archived. Studio recovery now observes the editor save/review barrier before selecting the result.
- Selecting an empty copied chapter keeps that chapter selected without exposing another chapter's prose, including after reopening. Add scene targets the selected chapter. Selecting an empty part likewise stays empty and creates its first chapter inside that part.

Validation: **410 frontend tests / 63 files passed, one conditional fixture test skipped; 249 focused BFF checks passed.** Build, story typecheck and targeted lint passed. Exact commands are in [01](01_current_state_and_evidence.md#d2-unit-copy-options-evidence--2026-10-16). The isolated HTTP/MySQL unit-copy smoke passed in `magic_worlds_novel_unitcopy_test_7839eef2d7c7`, including selection options, exact rich text/pins, stored-candidate separation, replay, stale-source rejection, concurrent identical copies, late rollback, cross-novel identity collision rejection and archived reads. The existing persistence smoke also passed in `magic_worlds_novel_persistence_test_ecbfa96ea130` at scene/structure/context heads **10/18/6**. **No project database mutation, schema change or reset was needed.**

Desktop Storybook inspection verified the option/title controls and counts changing from one selected scene to three. Full authenticated author/mobile/assistive-technology, source-vector size/performance, annotation/comment copying and the remaining D2 history/undo gates remain open. D3–D6 remain planned.

## D2 organization history checkpoint — 2026-10-16

**Organization history and reviewed multi-step undo/redo are implemented and locally verified. D2 and the full D1–D6 goal remain WIP.**

- Organization/details opens a scoped browser with small 50-event pages, action/date filters, one-event before/after comparison and explicit undo/redo review. Archived history stays readable. Save/AI-review barriers protect review and commit; the operation pins the reviewed structure head. Newer outlines require refreshing both manuscript and history. Pending requests lock new changes and use the existing durable journal/result recovery. Late reads stay in their original scope; definite conflicts require refreshed review.
- Each event captures its actual transactional before-state and linked undo/redo heads. A preceding structure checkpoint can predate independent prose edits and is no longer used as a prose before-image. Reversal applies the event's deltas, preserving unrelated later writing/titles/notes/context. Exact, hash-checked checkpoint restores create new scene heads with trusted lineage for successive split/merge undo/redo; independent affected edits still block reversal. Newly hidden units guard later author work. Touched metadata fields and affected reference states/signatures are checked; unrelated Codex changes survive. Pending/stashed candidates block reversal that changes/hides their scenes.
- Units, checkpoints, reference states, context/history heads and exact bound receipts commit together. Concurrent identical requests replay one commit; changed intent and stale reviewed heads fail. New work clears the redo head while retaining its events. Copied novels keep their initial provenance row when organization starts. DATETIME(0) writes and snapshots agree at second precision, preventing MySQL rounding from rejecting unchanged Trash state. The old `restore_structure` fresh writer/helper/caller are retired; retained receipts and older outlines remain readable. Older records without verified before-images are not guessed reversible.

Validation: **424 frontend tests / 66 files passed, one conditional fixture skipped; 263 focused BFF checks passed.** Production build, story typecheck and targeted lint passed. Actual synthetic history page/detail/receipt fixtures passed frontend runtime guards. Isolated HTTP/MySQL verification passed in `magic_worlds_novel_history_test_e4f5f094f0d2`, covering writing before/after moves, multi-step undo/redo, split/merge fidelity, concurrent replay, stale/candidate/reference rejection, scoped context preservation, late rollback, cursor/date/action filters, archived reads and copied-root provenance. The broader persistence smoke passed in `magic_worlds_novel_persistence_test_03350f0afae3` at scene/structure/context heads **10/18/6**. **No project database test writes, schema changes or resets were needed.** API health and published history contracts passed read-only checks. [01](01_current_state_and_evidence.md#d2-organization-history-evidence--2026-10-16) records commands and limitations.

Desktop Storybook inspection verified review controls and the before/after parent of the affected scene. This is a controlled fixture, not signed-in author evidence. At this checkpoint, named manuscript snapshots remained open; the following checkpoint implements capture/read/compare. Whole-manuscript restore was open at this point and is implemented in the later restore checkpoint. Complete scene-history/filter contracts, annotation/comment copy, further nested/compound acceptance, full author/mobile/assistive-technology and measured long-project behavior remain open. D3–D6 remain planned.

## D2 named manuscript capture checkpoint — 2026-10-16

**Named snapshot capture, frozen reads and comparison are implemented and locally verified. At this checkpoint, reviewed whole-manuscript restore was pending; the following restore checkpoint implements it. D2 and the full D1–D6 goal remain WIP.**

- Studio reviews a name, optional milestone note and saved-source counts after the editor save/AI-review barrier. The manifest freezes metadata, organization, independent goals, notes, lifecycle and exact Codex pins, including archived/trashed units. Each scene points to its immutable prose checkpoint/hash; candidates/jobs and duplicate prose bodies are excluded.
- One root-locked transaction checks the reviewed source vector/structure head and every checkpoint, then writes the existing revision log and bound receipt. Capture preserves canonical content, undo/redo heads and trusted document lineage. Concurrent identical requests replay one result; changed intent/stale review and late failures cannot leave partial captures. No schema change is needed.
- Summary-only cursor pages, detail/comparison and individual frozen scene reads use exact owner/workspace scope, including archived reads. Checkpoint hashes and schema versions are verified without substituting current text. The drawer compares saved changes and reads original prose/notes/pins; later current text is displayed only if its compared head still matches. Scoped form drafts, explicit refresh and uncertain-request recovery are connected.

Validation: **442 frontend tests / 70 files passed, one conditional fixture skipped; 281 focused BFF tests passed.** Production build, Storybook typecheck and targeted lint passed. The provider-free HTTP/MySQL smoke passed in **`magic_worlds_novel_snapshots_test_a851f29a799b`**, including rich Unicode prose, original/current pins, rollback, concurrent replay, source conflicts, capture between successive undo operations, 50-row pagination, archived/foreign reads and explicit corrupt/future-format rejection. **The project database was untouched; no schema change or reset was required.** [01](01_current_state_and_evidence.md#d2-named-manuscript-capture-evidence--2026-10-16) records commands and limits.

Controlled desktop browser inspection verified review/capture, the new list entry and comparison of original/current prose and notes with the original version-3 Codex pin. This does not establish authenticated author, mobile/assistive-technology or measured large-project acceptance. The following checkpoint implements the required in-place restore; capture and copying remain separate operations. Remaining D2 gates and D3–D6 stay in scope.

## D2 manuscript restore checkpoint — 2026-10-16

**Reviewed in-place whole-manuscript restore is implemented and locally verified. D2 and the full 136-capability D1–D6 goal remain WIP.**

- Studio independently selects original scene text, writing details/notes, organization/lifecycle and Codex/context. The read-only preview lists exact changed fields and every later unit, with saved/current rich-text comparison. Unselected categories remain intact. Saved summaries map to a restored prose head only when verified; other summaries remain stale.
- Later units can be kept or moved to recoverable Trash. Keeping them cannot silently hide later writing under a restored ancestor. Trashing a later container cannot silently hide earlier writing moved into it. Restore the earlier parent or move that writing before applying. Pending/stashed alternatives block rewritten or newly hidden scenes.
- The shared compiler binds preview and commit to the immutable snapshot/hash, reviewed source vector, structure head and exact options. All checkpoint/hash checks precede writes. New prose/metadata/context revisions, full reference changes, actual history before-images and the original request receipt commit together. Historical/current pins swap under final-batch uniqueness checks; immutable provenance and later reference tombstones are retained. No schema change is needed.
- Both save/AI-review barriers run. Scoped unsent choices survive closure, stale sources require explicit refreshed review, and uncertain operations retain the original journal intent for receipt-first recovery. Archived preview/result reads stay available. Organization history exposes recorded novel details and reference bodies and can undo/redo the restore while preserving later unrelated work; affected independent text/details/pins block reversal. New outline records also bind exact checkpoint hashes; older records retain their recorded format.

Validation: **456 frontend tests / 72 files passed, one conditional fixture skipped; 301 focused BFF tests passed.** Build, Storybook typecheck and targeted lint passed. Actual HTTP/MySQL restore/undo/redo passed in **`magic_worlds_novel_snapshotrestore_test_15959c938236`**, including explicit later-unit Trash/undo, metadata and v3/v4 pin restoration, stale source/pin/prose protection, concurrent exact replay, late rollback, corrupt checkpoints (including a self-consistent altered undo checkpoint), and archived review/recovery. Existing organization and persistence smokes also passed in isolated databases. No project reset, migration or provider execution was needed. Commands and limits are in [01](01_current_state_and_evidence.md#d2-manuscript-restore-evidence--2026-10-16).

Controlled desktop Storybook review verified the exact notes/prose comparison, reachable Apply/Cancel and confirmed completion. This is fixture evidence; authenticated author, mobile/assistive-technology, full history/annotation/nested acceptance and long-project measurements remain open. The later scene-history checkpoint implements the next contract; outstanding annotation/organization/performance gates follow. D3–D6 remain planned.

## D2 scene history checkpoint — 2026-10-16

**The reviewed scene-history contract is implemented and locally verified. D2 and the full 136-capability D1–D6 goal remain WIP.**

- History reads 50 small summaries per page with source/actor/recorded-date filters, a lightweight current head and explicit pagination. One selected checkpoint is loaded by ownership/revision, validated against its stored hash and compared with current saved text. Unsupported formats remain visible in metadata and cannot become restored writing. Full Markdown and selected Unicode plain-text excerpts can be copied or downloaded from read-only history.
- Both editor save/AI-review barriers run. Restore binds the immutable request, reviewed current revision/hash and source checkpoint hash; a metadata-only head check detects later writing. Under the novel lock, the server verifies both checkpoints, ancestor/workspace lifecycle and pending/stashed proposals. New prose/checkpoint and a small exact receipt commit atomically. Current notes/goals, parent and scoped context retain their independent state.
- Scoped journals persist the request before POST and retain confirmed receipts until current text loads separately. Reload recovery reads the original result before retrying. Hydration failure retains confirmation and never reapplies restoration. Pending target text remains blocked; recovery stays reachable outside the drawer. Archived readers work, late account/workspace responses stay isolated, storage failure stays visible, and exact retirement preserves other writers. Scene and manuscript history sources now stay stable through DataProvider callback replacement.

Validation: **494 frontend tests / 76 files passed, one conditional fixture skipped; 326 focused BFF tests passed.** Production build, Storybook typecheck and targeted lint passed. The actual provider-free HTTP/MySQL history smoke passed in **`magic_worlds_novel_scenehistory_test_585910f8286a`**, including small pages/filters, original rich Unicode/mention text, concurrent exact recovery, current/source hash guards, rollback, unsupported/corrupt checkpoints, pending proposals, ownership and archived reads. The migrated persistence smoke passed in **`magic_worlds_novel_persistence_test_a4995fb33bbb`** at scene/structure/context heads **10/18/6**. Both preserve the project DB; no reset, schema change or generation provider call was needed. Commands and limits are in [01](01_current_state_and_evidence.md#d2-scene-history-evidence--2026-10-16).

Controlled desktop Storybook inspection verified the explicit before/after text review and confirmed new checkpoint. This is fixture evidence. **Next D2: annotation/anchor and comment-copy contracts**, remaining nested/compound/context cases, measured long-project behavior, retention/offline decisions and broader author/mobile/assistive-technology acceptance. D3–D6 remain planned.

## D2 personal annotation preparation — 2026-10-16

**Historical preparation checkpoint. The integration checkpoint below supersedes its installation and availability status.**

**Prepared storage/client/UI slice; feature integration and D2 remain WIP.** [ADR 17](17_annotation_anchors_and_personal_review.md) records independent content/state and anchor versions, immutable origin, last verified attachment, exact saved-point identities and explicit orphan behavior. Automatic mapping must never overwrite note text/resolution or guess an equal quote's identity.

- The editor derives bounded plain-projection traces from actual transactions. Ordered saves retain the original sent prefix through later keystrokes, uncertain requests, acceptance and reload. Server validators require an exact final projection with valid Unicode/mention boundaries. The annotation store provides scoped CAS, immutable events, exact receipts, small pages, literal search and archive/Trash readers. A shared checkpoint remapper is prepared but **not called by the active checkpoint writer**.
- Scoped note drafts persist each keystroke; uncertain writes recover their receipt before retrying and retain confirmation until a separate current-note read succeeds. The prepared drawer supports saved-passage reading by exact points, explicit reattachment review, independent resolution/Trash, device/account comparison and copy/download. Newer unsent text survives older confirmation. Editor selection is frozen before flushing and must match the fresh saved document; changes of prose/editor/scene/account invalidate capture. Controlled Storybook inspection covers the desktop note reader and attachment review.
- The three-table additive upgrade was rehearsed against a new synthetic database with a verified private backup and an existing saved novel. It preserved existing tables/content and passed reapplication plus actual HTTP/MySQL note CRUD/reanchor/replay/rollback checks. **The project database remains `2026_10_novel_scenes` / 106 tables / 151 FKs; it was not changed.** The new annotation router is not mounted and the drawer has no Studio entry point yet.

Validation: **469 focused frontend tests / 71 files passed, one conditional fixture skipped; 160 focused BFF tests passed.** Production build, Storybook typecheck and targeted annotation UI lint passed. Separate migration/backup refusal tests and the isolated rehearsal are recorded in [01](01_current_state_and_evidence.md#d2-personal-annotation-preparation-evidence--2026-10-16). These commands overlap earlier evidence and do not constitute a larger aggregate pass count or full feature acceptance.

**Next:** integrate notes with scene checkpoints and server-owned split/merge/copy lineage, explicit comment-copy choices, guarded organization undo/redo and frozen snapshot references. Then create a fresh verified private project backup, apply the reviewed additive upgrade, synchronize canonical schema/bootstrap and mount the API/Studio entry together. Preserve all current content. Nested/context, measured performance, retention/offline/author gates and D3–D6 remain open.

## D2 personal annotation integration — 2026-10-16

**Personal notes and comment preservation/copy are implemented and locally verified; D2 and the full 136-capability D1–D6 goal remain WIP.**

- Studio opens personal review with owned small pages, literal search, state/passage/scene filters, exact saved-passage reading, resolve/reopen/Trash, explicit attachment comparison and copy/download. Notes remain separate from prose and AI context. Scoped device drafts and receipt-first request recovery retain newer input and other writers; confirmed requests hydrate separately. Editor capture freezes the intended selection before flushing and validates the saved document and actual editor identity. A note targeting a hidden scene cannot select an unrelated fallback scene.
- Shared checkpoint writes remap attachments atomically with prose/checkpoints/receipts, including acceptance and scene restoration. Split/merge use server-owned point lineage, including right-hand split block identities. Cross-scene passages retain visible orphan quotes. Organization undo/redo reverses anchor deltas with an internal logical authority, preserving later note text/resolution while rejecting a conflicting later reattachment. Newly added notes can follow the inverse passage lineage. Snapshot text restore preserves current personal-note content and records reversible attachment changes.
- Unit/novel copy review shows a separate personal-note inclusion choice and counts. Included comments require the reviewed annotation collection head, receive new note/block identities and preserve source provenance/resolution. Trash inclusion stays explicit; copied orphan quotes remain readable. Whole-copy provenance freezes the included note identity map. Older pending requests/receipts keep their original normalization and field set.
- The privately backed-up additive upgrade installed `2026_10_novel_annotations` (**109 tables / 154 foreign keys**). It added only `story_annotation_head`, `story_annotation` and `story_annotation_event` plus the schema-marker update. A subsequent read-only row comparison verified **all 4,276 pre-existing content rows across 105 tables unchanged**; the separate marker row changed as intended. The backup/manifest are private and excluded from Git. All test mutations used newly allocated synthetic databases.

Validation: **497 frontend tests / 74 files passed, one conditional fixture skipped; 549 focused BFF checks passed.** Commands and private-upgrade evidence are in [01](01_current_state_and_evidence.md#d2-personal-annotation-integration-evidence--2026-10-16). The integrated annotation HTTP/MySQL smoke passed in **`magic_worlds_novel_annotations_test_0d98855e61a0`**, including duplicate-passage mapping, split/merge, multi-step undo/redo, later note preservation, conflicting reattachment, explicit unit/novel comment copy, rollback and scene/snapshot text restoration. The existing full persistence smoke passed in **`magic_worlds_novel_persistence_test_a785949e79a4`** at scene/structure/context heads **10/18/6**. API health is `ok`, annotation routes are installed, production build, story typecheck and targeted lint passed. Controlled desktop copy review verified the note inclusion/count choice; this is fixture evidence, not authenticated-author acceptance.

**At this checkpoint, frozen annotation snapshot reads were next; the following checkpoint implements them. Remaining D2:** finish compound/context edge acceptance, measured long-project behavior, retention/offline decisions and author/mobile/assistive-technology gates. AI review notes/issues remain D4, annotation export remains D5, and D3–D6 remain open. Current snapshot text restoration intentionally preserves current personal-note content; it does not rewind note bodies.

## D2 frozen personal-note snapshots — 2026-10-16

**Named snapshots now capture and read personal-note history; D2 and the full D1–D6 goal remain WIP.**

- Capture review includes the saved personal-note count and exact collection revision. Annotation-only changes invalidate that review even when prose/organization did not change. The new optional request field preserves older immutable intents/receipts; replay still precedes current-source validation.
- A bounded metadata index freezes note identity, content/anchor versions, state, previews, hashes and references to the last full content event and last attachment event. Capture verifies those images against the current rows under the novel lock. Historical detail reconstructs and hash-checks the immutable images without reading mutable note rows. No schema change or project database test write was required.
- The snapshot drawer lazily reads filtered 50-note pages and historical bodies/status/quotes, with copy/download and exact captured-passage highlighting. Orphans retain their captured quotes. Older snapshots explicitly say notes were not captured; a captured empty collection has a separate state. Scope changes and closed readers ignore late results. Current personal-note bodies/status still survive manuscript text restoration.

Validation: **509 frontend tests / 76 files passed, one conditional fixture skipped; 449 scoped backend checks and 5 new snapshot-note store checks passed.** Production build, story typecheck and targeted lint passed. Actual HTTP/MySQL verification in **`magic_worlds_novel_annotations_test_0dfae06c7b4d`** covered note history after later edits/restoration, metadata pages/filters, exact capture replay, annotation-only conflicts, owned archived reads, legacy/empty states and rejected historical corruption. A temporary mutable-row corruption did not alter frozen reads; synthetic faults were repaired. Read-only live health/OpenAPI confirmed both installed annotation readers. Controlled Storybook inspection verified the saved status/body and highlighted captured passage; authenticated author/mobile/assistive-technology acceptance remains open. Commands and limitations are in [01](01_current_state_and_evidence.md#d2-frozen-personal-note-snapshot-evidence--2026-10-16).

**Next D2:** remaining compound/context edge acceptance, measured long-project behavior, retention/offline decisions, complete catalog review and author/mobile/assistive-technology gates. D3–D6 remain planned.

## D2 compound structure preservation — 2026-10-16

**Compound inheritance/context recovery is implemented and locally checked; D2 and the complete D1–D6 goal remain WIP.**

- A chapter moving between parts now materializes changed existing inherited writing choices on the chapter itself. Descendant documents/IDs/checkpoints and explicit scene overrides stay intact; scenes do not acquire redundant metadata revisions. False inclusion flags, POV/location, narrator/tense and workflow values follow the same rule. Optional unset fields retain the visible null-means-inherit contract. Explicit restoration out of an archived ancestor does not re-archive the recovered item.
- A split fragment retains the source summary text with an unverified summary pin, including when the source was revision 1. Restoring a scene into another chapter now carries the source chapter's Codex context, remaps its exact mention identities and updates attachments in the same transaction as units/history/receipt.
- The organization drawer exposes an active restore destination even when the old parent is in Trash. Unavailable parents cannot be selected, a missing destination blocks review, the reviewed destination stays in the immutable operation, and the save/AI-review barrier still applies. Destination choices do not transfer to a different unit. Applicable create/move/restore reviews now display their destination/position. English/Spanish help explains both parent restoration and choosing a different active container.

Three focused reproductions failed before their fixes. Current validation: **512 frontend tests / 77 files passed, one conditional fixture skipped; 466 scoped backend checks passed.** Production build, Storybook typecheck and targeted lint passed. The new isolated HTTP/MySQL smoke passed in **`magic_worlds_novel_compound_test_1a21af065e9f`**, covering nested ordered/bullet lists, inserted continuation paragraphs, Unicode, marks/links/mentions, exact rich checkpoint restoration, source pins, cross-split orphan notes, later note edits, chapter moves/split/merge, restoration into another chapter, multi-step undo/redo, pending-candidate rejection and late rollback of units/context/notes/history. Actual synthetic responses passed frontend runtime guards. No project database test write or schema change was needed. Controlled desktop inspection verified destination selection, review and local confirmation; it does not close author/mobile/assistive-technology gates. Commands and qualifications are in [01](01_current_state_and_evidence.md#d2-compound-structure-preservation-evidence--2026-10-16).

**Next D2:** implement remaining catalog capabilities, including writing templates (N11), derived numbering (S11), richer outline summaries/goals/cast (S12) and remaining insertion/source workflows; measure long-project behavior; finish retention/offline policy and author/mobile/assistive-technology acceptance. Further context/organization cases remain subject to the full catalog review. D3–D6 remain planned.

## D2 outline and exact insertion — 2026-10-16

**Derived numbering, the detailed outline and reviewed before/after insertion are implemented locally. D2 and the complete D1–D6 goal remain WIP.**

- The same scene hierarchy now has compact/detailed views in both docked and narrow-drawer outlines. Details show independent part/chapter/scene goals and word counts, effective workflow status, scoped POV/location/cast, planned synopsis, written summary and AI/export exclusion flags. Current, earlier and unverified summaries are labelled separately; chapter/part summaries do not invent a scene-source verification.
- Numbers follow active reading order across ungrouped chapters and ordered parts. Trashed units/ancestors stay out; archived rows remain readable and unnumbered. Active totals exclude archived material. Reorder/restore derives new ordinals without changing author titles or IDs. Account/API/workspace/novel-scoped optional view preferences preserve scene-selection storage and keep in-memory controls when storage fails. Grouping is indexed and unchanged scene word counts are cached; full measured size/latency acceptance remains open.
- The creation form reviews an independent new title and exact container/position. Parts, chapters and scenes can be inserted before/after the selected unit of that type (or applicable ancestor). `afterId` retains its stable anchor identity instead of translating to a former neighbour. The root-locked writer rejects ambiguous, missing, trashed or wrong-container anchors. A moved anchor blocks the stale form; a disappeared selected item cannot silently become a novel action. Part/chapter creation rejects supplied prose instead of ignoring it. Existing request receipts keep their original shapes and replay without repeating placement.

Validation: **524 frontend tests / 81 files passed, one conditional fixture skipped; 472 scoped backend checks passed.** Final outline/drawer checks, production build, Storybook typecheck and targeted lint passed. Actual insertion HTTP/MySQL verification passed in **`magic_worlds_novel_insertions_test_ac18f07b747d`**, including all unit kinds, concurrent exact replay, replay after later reordering, rejected anchors and late rollback. Synthetic response fixtures passed frontend runtime guards. API health is `ok`. No project database test write, reset, migration or marker change was needed. Controlled desktop inspection verified outline metadata and insertion review; author/mobile/assistive-technology and long-project gates remain open. Commands and qualifications are in [01](01_current_state_and_evidence.md#d2-outline-and-insertion-evidence--2026-10-16).

**At this checkpoint, writing templates (N11) were next; the following checkpoint implements editable starter templates. Remaining D2:** source/creation and catalog capabilities, measured long-project behavior, retention/offline decisions and complete author/mobile/assistive-technology acceptance. D3–D6 remain planned; this checkpoint does not redefine the 136-capability objective.

## D2 editable writing templates — 2026-10-16

**Editable starter templates and custom outlines are implemented and locally verified. D2 and the full 136-capability D1–D6 goal remain WIP.**

- Short-story, three-act and custom outlines expose editable parts/chapters/scenes, parent choices, independent goals, initial status, planning text and writing overrides. Part movement preserves chapter ownership; removing a part keeps its chapters ungrouped. Last chapter/scene removal is blocked. Immediate removal undo retires on later edits, preserving later input. Replacing an edited preset requires review and retains novel title/description/source. English/Spanish copy and the shared form/control primitives are used.
- Language, genre, audience, narrator, tense and style guide initialize the existing novel metadata. Every scene receives independent stable unit/block identities, an empty canonical document and a revision-1 checkpoint. Planned synopsis/notes remain metadata; no written summary, borrowed identity, manuscript body or lifecycle tombstone is accepted as template input. Parent goals never become child goals.
- Creation accepts exactly one initial chapter list or complete edited template. Strict bounds and matching frontend guards/OpenAPI reject ambiguous, null, foreign-parent, invalid or oversized input. The current workspace lock, source-card resolution, insert-only tree writes and exact receipt remain one transaction. The original edited outline/key/version/name is frozen in that receipt; retries do not consult a mutable preset, reset later prose or repeat creation. Existing creation receipts keep their original supplied fields. No separate persistent template catalog or new schema is introduced.

Validation: **550 frontend tests / 86 files passed, one conditional fixture skipped; 490 scoped backend checks passed.** After the final OpenAPI/minimum-list constraints, **133 overlapping creation/model/route checks passed**; these counts are not additive. Final production build, Storybook typecheck and targeted lint passed. The provider-free actual HTTP/MySQL smoke passed in retained **`magic_worlds_novel_templates_test_f70c48a54755`**, verifying concurrent exact replay, empty independent scene identities, planning/defaults, independent goals/inheritance, retained Codex context, replay after later prose, changed-intent rejection and late rollback. Its wire responses passed the frontend guards. Read-only health is `ok`; live OpenAPI exposes both exclusive modes. No project database test write, reset, migration or marker change was required. Controlled desktop fixture inspection verified the edited form and explicit creation result; wider author/mobile/assistive-technology and measured performance acceptance remains open. Commands and evidence are in [01](01_current_state_and_evidence.md#d2-writing-template-evidence--2026-10-16).

**Next D2:** finish remaining source/creation, metadata/library, reading/navigation/search and catalog workflows; broader context/organization acceptance; measured long-project behavior; retention/offline policy; author/mobile/assistive-technology validation. D3–D6 remain planned.

## D2 reviewed creation sources — 2026-10-16

**Reviewed source creation (N02) and rejected-draft preservation are implemented locally. D2 and the full 136-capability D1–D6 objective remain WIP.**

- Library/landing/card entry points share one creation form. A primary character/setting/item/adventure card composes with additional selected cards and exact author-approved adventure passages. The read-only review shows complete snapshots, context inclusion and version pins, distinguishes resolved library/saved-adventure/provided origins, and requires explicit approval. Changed selections or source content invalidate approval; the server rejects a stale source hash atomically. Each manuscript starts empty. Approved passages become existing snapshot-card references, with preserved Unicode/whitespace and no borrowed library provenance. Live session-history integration remains excluded.
- The initial structure revision holds a private frozen manifest/hash, separate from mutable current Codex state. Owned creation-origin reads verify that record without resolving live cards, including after Codex edits/removal, source deletion or workspace archive. Default history pages omit the private payload. Older originals without a source review show that absence; independent copies keep their copy-origin UI. No schema change is required.
- Definitive validation/source-change rejections retain the exact title, description, authored outline/defaults, source options and approved passages as scoped device drafts. Receipt-first recovery never reposts a rejected write. The author can download, explicitly discard or reopen the input; replacement requires fresh review and a new request ID. Linked old drafts retire only after the confirmed new manuscript opens, including after reload/read failure. Unknown outcomes continue to block replacement, and late replies cannot change another account/workspace.

Validation: **652 frontend tests / 96 files passed, one conditional fixture skipped; 514 scoped backend checks passed.** The actual provider-free HTTP/MySQL smoke passed in retained **`magic_worlds_novel_sources_test_4c86ec4db7ae`**, including source pins, context-only approved passages, concurrent exact replay, stale-source rejection, immutable provenance, ownership, late rollback, source removal and archived reads. Its wire passed frontend runtime guards. Production build, Storybook typecheck, read-only live health/OpenAPI and visual inspection are recorded with final results in [01](01_current_state_and_evidence.md#d2-reviewed-creation-source-evidence--2026-10-16). **No project database test writes, migration, marker change or reset was needed.** This is local development evidence; author/mobile/assistive-technology, performance and release gates remain open.

**Next D2:** metadata/library filtering, reading preferences/navigation/manuscript search and remaining catalog workflows; broader context/organization acceptance; measured long-project behavior; retention/offline policy; author/mobile/assistive-technology validation. Then D3 assistant/proposals, D4 planning/memory/review, D5 portability/productivity and D6 series/extensions. No phase completion or release is claimed.

## D2 library discovery — 2026-10-16

**Library search/filter/sort (N08) is implemented and locally verified. D2 and the full 136-capability D1–D6 objective remain WIP.**

- Search targets the novel title, current saved manuscript, or metadata/section titles. Literal genre/language/audience filters, whole tags, root workflow status and inclusive UTC activity days combine with stable title/creation/activity ordering. `%`, `_`, backslashes and Unicode remain literal input. Missing/null metadata, generated candidates, history and current Codex contents do not become searchable manuscript. Tag/plot-thread table functions use explicit primary-key correlation; a reproduced installed-MySQL query issue is covered by the final synthetic wire checks.
- Root archive, section archive, root Trash and workspace archive remain independent. Locally archived sections are an explicit search option; trashed sections/ancestors stay excluded. Archived novels remain in the ordinary library under their workflow status. The root Trash selector now labels that selection accurately. Owned readers remain available in archived workspaces.
- Shared form primitives provide explicit Apply/Cancel/Reset, invalid-input retention and localized English/Spanish guidance. Applying filters retains search, resets pagination and ignores late old responses. Trash keeps applied filters; a workspace switch clears them. List responses retain their metadata-only shape and writing updates root activity. No new schema, migration or project database test writes are needed.

Validation and exact commands are recorded in [01](01_current_state_and_evidence.md#d2-library-discovery-evidence--2026-10-16). **661 frontend tests / 100 files passed, one conditional fixture skipped; 561 scoped backend checks passed.** The final real HTTP/MySQL smoke passed in retained **`magic_worlds_novel_library_test_b96fccaced76`**, including literal Unicode, root/section archive and Trash, all sorting directions, equal-title pages, inclusive activity bounds, later writing, tag correlation after edits and archive, and account/workspace isolation. Production build/Storybook typecheck/targeted lint passed. The actual filtered wire passes frontend runtime guards. These checks do not close measured performance, signed-in author/mobile/assistive-technology or release gates.

The following checkpoints add cover/default-POV metadata (N03) and saved statistics/size filters (N09). **Remaining D2:** reading preferences and manuscript result navigation; remaining catalog/organization/context acceptance; complete measured size/latency, retention/offline policy and author/mobile/assistive-technology validation. D3–D6 remain planned. No phase completion is claimed.

## D2 novel covers and default POV — 2026-10-16

**Novel metadata (N03) is implemented and locally verified. D2 and the full 136-capability D1–D6 objective remain WIP.**

- The recoverable details form edits the existing root metadata, an owned cover and its accessible description, and a novel-level Codex character as default POV. The cover chooser reuses workspace media discovery, upload and shared controls. Choosing/removing a cover changes the form; Save applies it deliberately. Root POV/tense participate in visible inheritance and scene context; local overrides remain independent. The library displays the owned cover.
- New cover assignments require the same account/application/workspace and an undeleted image record. New default POV assignments require a retained novel-level character snapshot. Missing image files never invalidate or delete a record. Unchanged unavailable relationships survive unrelated edits. New assignments and image retirement serialize on the asset; current and frozen cover references prevent retirement across the author's workspaces. Captures, reviewed restoration, history and independent copies preserve these metadata values; excluding active copy context retains the assigned POV snapshot disabled.
- Client/server bounds agree on code points and UTF-8 bytes. Oversized input stays editable/recoverable; older uncertain journal intents remain readable. Manually entering multiline tags no longer consumes the newline. Definite assignment errors retain the form, account conflicts compare cover previews/POV values, and uploads with uncertain responses can be recovered through explicit library refresh without automatic re-upload. English/Spanish labels and cover previews extend snapshot/history review.

[01](01_current_state_and_evidence.md#d2-novel-cover-and-default-pov-evidence--2026-10-16) records commands and limits. **670 frontend tests / 104 files passed, one conditional fixture skipped; 622 scoped backend checks passed**, including exact relationship identities and media ownership. Build, Storybook typecheck and targeted lint passed (one existing media-studio hook warning). Real provider-free HTTP/MySQL verification passed in retained **`magic_worlds_novel_metadata_test_98e00ca351ba`**: missing-file records, owner/workspace/deleted assignment guards, concurrent exact replay, unrelated edits, inheritance/local overrides, captures, restored pins, independent copy, uploaded-image discovery and current/frozen deletion protection. Actual wire data passes frontend runtime guards. No schema change, project database test write or reset was needed.

Controlled desktop Storybook review verified explicit image choice, a selectable unavailable-file record and a saved cover/default POV. A subsequent cache regression fixes root default-POV inheritance after scene acknowledgements and later metadata merges, retaining local overrides; the expanded frontend scope passed **671 tests / 104 files** before the statistics work. It does not establish authenticated author, phone/assistive-technology, performance or release acceptance. The statistics checkpoint below supersedes that pending item. Reading preferences/result navigation and the remaining acceptance gates stay open. D3–D6 remain planned.

## D2 saved statistics and size filters — 2026-10-16

**Saved aggregate statistics (N09) and library size filters are implemented, installed and locally verified. D2 and the full 136-capability D1–D6 objective remain WIP.**

- Scene counts bind the canonical document revision/hash; root caches aggregate numeric counts and section lifecycle under the existing novel lock. Text saves, organization, copy, restore and undo/redo update the derived state atomically. Metadata-only writes reuse scene counts. Named captures advance the cache's source head without recounting prose. Ordinary aggregates do not load unrelated documents.
- Active/archive/Trash totals remain separate; ancestor Trash takes precedence. The fixed-English ICU word-like policy counts literal canonical plain text, Unicode code points and UTF-8 bytes. Missing native segmentation gives an unavailable word count while saving and other counts continue. Missing/stale/invalid aggregate data is unavailable rather than zero, including list count fields. Revision-aware client merging cannot attach an old total to newer writing.
- The library supports inclusive minimum/maximum saved words (including zero), most/fewest-word ordering and explicit archived-section inclusion. Unknown word totals sort last in both directions. Shared controls retain invalid typed input and explicit Apply/Cancel/Reset with English/Spanish copy. Summaries read small root caches and do not hydrate manuscripts or Codex snapshots.
- The scoped upgrade added only `story_scene_statistics` and `story_novel_statistics` and advanced the marker to **`2026_10_novel_statistics` (111 tables / 156 foreign keys)**. A verified private backup and before/after fingerprints proved **all 4,276 original content rows unchanged across the 109 predecessor tables** (the marker row advances separately). Read-only verification found all **6 novel / 28 scene caches** current. The API restarted healthy. No reset, unrelated reseed, file cleanup or project test writes occurred.

[01](01_current_state_and_evidence.md#d2-saved-statistics-evidence--2026-10-16) records exact commands, backup hash, source guards and limits. The installed sources pass **680 frontend tests / 107 files**, one conditional fixture skipped; **640 scoped backend checks**, production build, Storybook typecheck and targeted lint. The final real HTTP/MySQL smoke passed in retained **`magic_worlds_novel_statistics_test_2ff043a50458`**, including the two-table upgrade with original-content fingerprints, metadata/count reuse, Unicode, lifecycle, CAS/replay, copy/split/merge/history/restore, late rollback, unavailable segmentation, stale cache recovery and filter/sort/workspace isolation. A 1,000-scene / 30,000-word fixture measured one save at **0.303s**, one filtered list at **0.014s**, and a **1,215-byte** summary. These are fixture observations, not supported-size or latency promises.

Controlled desktop Storybook inspection verified changed bounds remain unapplied until Apply and then update the visible selection. The fixture made no project writes. **Next D2:** reading preferences and manuscript result navigation; remaining catalog/organization/context cases, complete performance/retention/offline decisions and author/mobile/assistive-technology acceptance. D3–D6 remain planned; no release or phase completion is claimed.

## D2 reading appearance — 2026-10-16

**Reading presets (E11) are implemented and locally verified. D2 and the full 136-capability D1–D6 objective remain WIP.**

- Studio's More menu opens a shared drawer in editable and archived readers. Literary, Close reading and Spacious presets support custom prose font, size, line/paragraph spacing, width and contrast. Reset affects display only. Theme values and the token inventory own every size, spacing and color choice; existing font stacks retain fallbacks.
- Device storage uses the existing API/account/workspace/novel view scope and a bounded versioned enum record. Corrupt/future/oversized records never become CSS and are not deleted. Storage failure preserves the open room's choices and explains that they could not be retained for reopening. A late old-scope/unmounted callback cannot save another room's settings. No prose, metadata, AI packet or database changes occur.
- Appearance changes preserve the editor instance, rich document, selection and manual undo history. Width changes recompute inspector/outline docking without requiring a browser resize. Shared controls provide keyboard presets and explicit Done/Reset. English/Spanish copy distinguishes device-local display from writing.

[01](01_current_state_and_evidence.md#d2-reading-appearance-evidence--2026-10-16) records verification and limits. **693 frontend tests / 109 files passed**, one conditional fixture skipped; production build, Storybook typecheck and targeted lint passed. Focused storage tests additionally verify reopen, account/API/workspace/novel isolation, invalid input and unavailable storage. Controlled desktop Storybook inspection typed a local sentence, chose Close reading with the keyboard and confirmed the draft remained with the selected appearance. The temporary preview makes no project or provider writes.

**Next D2:** finish scoped panel/view restoration and manuscript result navigation; remaining catalog/organization/context cases, complete performance/retention/offline decisions and author/mobile/font-loading/zoom/assistive-technology acceptance. D3–D6 remain planned. Basic saved scene/cursor/scroll preferences already exist; E11 does not claim complete N10 or release readiness.

## D2 view and position resume — 2026-10-16

**Scoped view/position restoration (N10) is implemented and locally verified. D2 and the full 136-capability D1–D6 objective remain WIP.**

- The existing API/account/workspace/novel view scope now retains selected unit, focus/typewriter, preferred Codex visibility, narrow navigation panel and context scope. Outline and reading records remain independent. Unattributable global booleans are ignored and left untouched. Empty selected containers keep their identity; missing/trashed units fall back to available prose. Focusing a scene records the actual reading/writing target without modifying manuscript state.
- Per-scene point/scroll hints debounce immutable captures and flush on close, scene changes, page hide and hidden visibility. Bounded record guards and retired old-scope/unmounted callbacks prevent cross-room writes. Recovery remounts read the latest captured point. Missing blocks, partial mentions and split UTF-16 pairs cannot produce unrelated selection/scroll restoration. Storage failures preserve current controls and report unavailable reopening hints.
- A non-collapsed selection restores only after a SHA-256 match to the canonical document. Changed/unverifiable text restores a cursor at its saved head. No prose enters preferences. Native fingerprinting is cached per immutable document and requested only for ranges; unavailable WebCrypto retains cursor/scroll recovery. Delayed verification cannot override newer edits, focus, pointer/keyboard actions, selections or scrolling.
- Docking temporarily hides a narrow drawer without losing its preference; closing Codex clears an obsolete Codex overlay, and entering focus mode clears narrow overlays. An unavailable scene/chapter context scope visibly falls back without overwriting the stored preference. Review forms and requests are not stored as panel preferences.

[01](01_current_state_and_evidence.md#d2-view-and-position-resume-evidence--2026-10-16) records commands and limits. **723 frontend tests / 111 files passed**, one conditional fixture skipped; production build, Storybook typecheck and targeted lint passed. A controlled desktop preview verified close/reopen at the same later passage, retained scene/Codex/typewriter choices and a matching-document selection by keyboard focus followed by exact phrase replacement. No project database, backend schema or provider writes were used. The API remains healthy.

**Next D2:** manuscript result navigation and remaining catalog/organization/context cases; complete performance, retention/offline policy and author/mobile/font-loading/zoom/assistive-technology acceptance. D3–D6 remain planned. This checkpoint does not close full app-shell/device acceptance, release readiness or any later phase.

## D2 manuscript search and result navigation — 2026-10-16

**Saved manuscript search and exact result navigation are implemented and locally verified. S17 remains partial; D2 and the full 136-capability D1–D6 objective remain WIP.**

- A shared drawer searches saved canonical scene prose with literal whitespace/punctuation, case choice, novel/part/chapter/scene scope, effective workflow status and optional archived sections. Ancestor Trash is excluded. Root archive/Trash and archived workspaces retain readable saved content. Visible Codex labels participate; drafts, notes and generated proposals do not.
- Owned read-only POST endpoints return bounded excerpts in manuscript order. Native MySQL ICU supplies the actual source quote and codepoint/UTF-16 locations. Query-bound keyset cursors and a whole-source metadata/revision snapshot refuse changed pages and targets. Resolving a result loads one canonical document projection and its metadata; omitted Codex pins/history are preserved from a compatible cache. An obsolete/unknown cached tree uses the existing full reader and revalidates the same source; this does not claim complete lazy manuscript loading.
- Navigation flushes current writing and leaves an active AI review/recovery intact. The editor checks the exact canonical document and source quote, then reveals a decoration and collapsed cursor. Partial mention labels highlight the complete atom; cross-block separators navigate their boundary. Document edits clear the highlight. New input/document/selection/target cancels delayed layout scrolling. Long prose retains its intrinsic height inside the scrollport; token-owned tail space lets the last result remain readable.

[01](01_current_state_and_evidence.md#d2-manuscript-search-evidence--2026-10-16) records the checks and limits. **749 frontend tests / 117 files passed**, one conditional fixture skipped; production build and Storybook typecheck passed. The installed full frontend suite also passed **4,771 tests / 493 files**, one conditional fixture skipped. **696 scoped BFF tests passed / 39 skipped** with a broader filename scope than earlier checkpoints. A fresh retained MySQL database verified native Unicode spans (including `ss` → `ß`), cursor/source guards, lifecycle and owner isolation and unchanged story-table fingerprints around reads. Its 1,000-scene fixture returned 20 excerpts in 0.192 seconds / 15,140 bytes; this is a synthetic observation, not a supported latency limit. Controlled desktop review verified the later-scene highlight and typed insertion beside the collapsed cursor. No project database/schema or provider write was needed.

**Next D2:** remaining catalog/context/organization cases; complete performance, retention/offline decisions and author/mobile/font/zoom/assistive-technology acceptance. Scoped replacement review and bookmarks remain later S17 work. D3–D6 remain planned.

## D2 links and typing preferences — 2026-10-16

**Link controls (E04) and author typing choices (E10) are implemented and locally verified. D2 and the full 136-capability D1–D6 objective remain WIP.**

- The selection toolbar, More menu and Ctrl/Cmd+K open a shared link inspector. Create/edit/remove are ordinary undoable edits against the exact editor/document/range; formatting and captions remain. Stale/destroyed/foreign targets, read-only/recovery mode, active AI review, invalid destinations and over-limit documents cannot commit. Mixed destinations are disclosed. Readers can inspect/open/copy without write controls, and their editor exposes `aria-readonly`. Link styling uses ember tokens and a registered underline token.
- Existing safe URLs/titles survive paste/save/reopen. Supported complete web/email/phone destinations use the existing canonical link schema. Unsupported schemes/relative destinations or unsupported title metadata retain their captions and original destinations as plain text, with visible feedback; empty safe captions retain the URL. Relative references are not guessed against the SPA origin. Automatic marking is limited to complete supported destinations. Pasted source is not permission to open anything externally.
- Device-scoped typing preferences offer manuscript/curly/angle/straight quotes, separate dash/ellipsis and symbol/fraction switches and a literal-typing action. Recognized Spanish manuscript names/codes use angle double quotes; other/unknown settings use curly quotes unless overridden. Existing prose/paste, selection and undo are not rewritten. Reading and typing use one bounded scoped storage hook with independent records; malformed/future records remain untouched, failed storage stays usable in the open room and retired callbacks cannot write another scope.

[01](01_current_state_and_evidence.md#d2-links-and-typing-evidence--2026-10-16) records commands and limits. The complete novel scope passed **776 tests / 122 files**; after applying the verified files, the actual checkout's full frontend suite passed **4,798 tests / 498 files**, one conditional fixture skipped. Production build, Storybook typecheck and targeted lint passed. Actual frontend paste output was saved/reopened through HTTP/MySQL in a new retained synthetic database with exact canonical JSON, URL/title, plain text, Markdown and content-hash agreement. Controlled desktop review verified keyboard inspection, link edit/undo, reader-only actions, literal typing and later Spanish smart punctuation without rewriting earlier prose. No project database/schema change, provider call or package addition was needed.

**Next D2:** remaining organization/context/editor cases; saved-reference inspection and block movement are implemented in the checkpoints below; full performance, retention/offline and author/mobile/font/zoom/assistive-technology acceptance. D3–D6 remain planned. Complete HTML/format import and loss reporting remain D5; the paste changes do not claim that broader contract.

## D2 saved-reference inspection — 2026-10-16

**E14 keyboard opening and source disambiguation are implemented and verified locally. D2 and the complete 136-capability D1–D6 objective remain WIP.**

- Alt+Enter and the Studio More menu inspect references at the cursor or in a selected passage. Stored mention atoms resolve by their original ID, including removed/renamed/out-of-scope pins; an unavailable ID stays unavailable. Detected names and aliases retain every overlapping identity for an explicit choice. Painting retains the existing lore/name precedence and ordinary editable clicks retain caret behavior.
- Shared source rows disclose kind, scope/title, original source, pinned version, description and context state. Autocomplete searches those details and aliases, prioritizes manuscript/recent/pinned choices and retains excluded references without enabling their content. Retired pins are excluded from insertion choices. A stale displayed source is refused before insertion. Structural sharing caches manuscript-use indexing rather than scanning every unchanged text block on each query.
- Inspection itself changes neither prose nor context. Explicit include/exclude uses the selected current ID/context revision and the existing guarded Codex mutation. Removed, outside and overridden pins stay readable without an action that would falsely imply they enter the current scene's context. Reader/recovery/review/workspace/stale guards are rechecked when acting. Readers remain keyboard focusable, expose `aria-readonly`, and have no context write controls.

Selected novel/story checks passed **697 tests / 115 files**. After applying the verified files, the actual checkout passed **4,825 frontend tests / 501 files**, one conditional fixture skipped; production build, Storybook typecheck and targeted lint passed. [01](01_current_state_and_evidence.md#d2-saved-reference-inspection-evidence--2026-10-16) records commands, exact coverage and controlled native browser evidence. No backend/schema/dependency change or project database test write is required; canonical mention IDs/labels and existing CAS requests remain the wire contract.

**Next D2:** remaining metadata/beats/reading/replacement/bookmark and organization/context cases; block movement is implemented in the next checkpoint; complete performance, retention/offline and author/mobile/font/zoom/assistive-technology gates. D3–D6 remain planned. This checkpoint does not close broader context retrieval or author acceptance.

## D2 manuscript block movement — 2026-10-16

**E17 movement controls and canonical preservation are implemented and locally verified. D2 and the full 136-capability D1–D6 goal remain WIP.**

- Alt+Shift+Up/Down moves complete selected sibling blocks. More → Move blocks provides a shared review dialog, click up/down and before/after any sibling destination. Lists move entire items with nested content; selected containers move as complete nodes. Destinations stay in the current container. The preview explains endpoint expansion and note implications. Canonical IDs, rich marks/links/mentions, list starts and selection direction remain. One move is one isolated ordinary undo/redo event, separate from nearby typing and other moves.
- Exact editor/document/selection and destination IDs guard commits; readers, recovery, AI activity, stale sources and invalid/boundary moves cannot change text. Applying a dialog returns focus to the moved passage after modal cleanup; later input cancels that deferred focus. Native read-only keyboard attempts are refused. No drag is required.
- The native ordered-list `type: null` default is removed at the canonical frontend boundary; meaningful unsupported marker attributes still fail validation. Automatic trailing paragraphs are disabled so selecting/moving/undoing a final list/quotation/scene break does not invent manuscript blocks. The wire schema is unchanged.
- Existing checkpoint mapping carries notes by unchanged block IDs. Cross-boundary passages retain body/quote for explicit review; exact canonical undo recovers the last attachment. Actual save/reopen/undo/redo verifies later note text/resolution is preserved. The new retained synthetic database `magic_worlds_novel_blockmoves_test_19039652413e` passed rich and nested cases through scene revision 5; project content and schema were untouched.

[01](01_current_state_and_evidence.md#d2-manuscript-block-movement-evidence--2026-10-16) records final commands, scope and limitations. The installed frontend selection passed **716 tests / 117 files**, one conditional fixture skipped; production build, Storybook typecheck, targeted lint, 21 backend anchor unit checks and native desktop review passed. The latest complete frontend suite has **three remaining voice-copy assertion failures** following concurrent voice edits (4,846 passed / one skipped across 503 files); those unrelated edits/tests are preserved and the full checkout is not claimed green. The 1,000-block / 200-block-move fixture preserves every node and selected point; its isolated timing is not a complete long-project latency claim.

**Next D2:** unit tags, planned beats and remaining organization/context/editor cases; narrative-time editing already exists in unit details; whole-manuscript reading, replacement previews/bookmarks, retention/offline decisions and full author/mobile/font/zoom/assistive-technology/performance acceptance. D3–D6 remain planned. Movement across scene boundaries continues to use explicit higher-level organization/copy contracts, not an implicit reparenting action.

## D2 unit tags and planned beats — 2026-10-16

**Manual S09/S10 metadata is implemented and installed locally; D2 remains WIP and D3–D6 remain planned.** Optional unit `tags` and ordered `plannedBeats` use the existing metadata CAS, exact receipts, scoped draft/conflict journals and independent writing state. Details and identity-free templates provide tag entry and beat add/edit/move/removal with immediate removal undo. Movement focuses the moved beat; archive/readers block changes. Multiline text, whitespace, duplicates and order are preserved. Comparison displays serialized list boundaries, so equal joined text cannot hide changed beat membership.

- Shared frontend/store validators enforce at most 100 entries, 255 Unicode codepoints per tag, 2,000 per beat and the existing 100,000-byte total details limit. Empty or whitespace-only new entries cannot save. Invalid unfinished drafts remain available for explicit recovery/copy/download. Old omitted/null fields remain unchanged; no defaults or migration rewrite old snapshots.
- Plans remain separate from canonical prose, word counts, synopsis, written summary/source revision and personal notes. They have no inherited defaults. Existing copy/history/snapshot/restore preserves them, including copies that exclude personal notes. The current inline generation packet does not automatically include author plans; grounded assisted planning remains D3.
- Library metadata queries search visible unit tags and full planned beats, with existing owner/workspace/ancestor archive/Trash rules. The `tag` filter continues to address root novel tags. Explicit base-table identity correlation and a 2,000-character beat column retain search matches beyond character 255.

Validation: the installed complete frontend suite passed **4,899 tests / 509 files, with two conditional tests skipped in 510 files**, and the installed scoped BFF suite passed **522 tests**. The real HTTP/MySQL response passed frontend story/scene/template/exact-receipt guards separately. Production build, Storybook typecheck and changed-source lint passed. The earlier voice-copy assertion failures are resolved in current source; this change retained that concurrent work. The restricted run initially hit three `spawnSync git EPERM` errors in the existing voice grep gate; the complete rerun with subprocess access passed. Commands and limits are recorded in [01](01_current_state_and_evidence.md#d2-unit-planning-evidence--2026-10-16).

The provider-free native smoke passed in **`magic_worlds_novel_planning_test_903cbdb7142d`**, a newly allocated retained synthetic database. It verified all three unit kinds, exact replay/stale CAS/invalid input, Unicode/multiline/duplicate order, metadata-only prose preservation, full-beat search, template receipt/reopen, note-excluding independent copy, reviewed planning-only restore, old and new immutable snapshots, and archive write refusal. Controlled desktop browser review verified movement/focus, recovery, save acknowledgement and disabled reader controls. This is fixture evidence; broader author/mobile/assistive-technology/performance acceptance remains open.

**No project database test write, reset, schema migration, provider execution or file/record cleanup occurred.** The project API was found stopped and was brought back up with the verified code; `/health` returned HTTP 200/status ok. Other preview processes were retained; only this turn's preview/tab were closed.

**Next D2:** whole-manuscript reading, scoped replacement previews/bookmarks and remaining organization/context/editor cases; retention/offline decisions; full author/mobile/font/zoom/assistive-technology/performance acceptance. S09's manual fields and S10's manual planning are present; assisted proposals remain future. D3–D6 and the complete 136-capability objective remain open.

## D2 continuous manuscript reading — 2026-10-16

**Saved continuous reading and guarded selected-scene opening are implemented locally. D2 and the 136-capability D1–D6 goal remain WIP.** Studio’s More menu opens the shared reader without replacing its current editor. Novel/part/chapter/scene scopes follow canonical organization order; archive inclusion is explicit, ancestor Trash stays excluded, and archived roots/workspaces remain readers. Scope/archive choices persist separately under the existing bounded account/API/workspace/novel device key; reading appearance reuses the existing tokens/preferences.

- The owned read endpoint indexes small metadata and hydrates only the requested scene bodies in one consistent read transaction. The UI requests two scenes per batch, appends canonical semantic HTML as the sentinel enters view, and offers a manual fallback. It creates no additional TipTap editor, execution, save or receipt. Empty owned containers are valid scopes. Rich marks, list starts, links, breaks and exact mention IDs remain; planning instructions are excluded from displayed prose.
- Continuations bind the original owner/workspace/lifecycle and every organization/metadata/document head. Changed sources return 409; old loaded pages remain visible and require explicit refresh. Duplicate/out-of-order responses and late old-owner requests refuse. The prose projection omits author metadata, references and history rather than clearing those caches.
- Read-only reference inspection uses the exact retained snapshot ID/context version or reports unavailable; equal names never substitute. Returning to Studio passes authentication/save/review barriers, revalidates the source, refreshes the owned full cache and checks exact selected-unit/root/parent heads and newer editor documents. A workspace newly reported as read-only cannot open an apparently editable Studio scene while its workspace state is stale.

Validation: the installed complete frontend suite passed **4,911 tests / 514 files, with three conditional fixture tests skipped in 515 total files**. The scoped installed BFF suite passed **539 tests**; build and Storybook typecheck passed. New reader/changed novel files pass lint. The shared API client retains **41 pre-existing `no-explicit-any` diagnostics**; comparing rule/message/column/source-line multisets against the unchanged baseline verified **zero new diagnostics**. Full-repository lint is not claimed green. Actual HTTP/MySQL response batches passed frontend runtime guards separately. Detailed commands/limits are in [01](01_current_state_and_evidence.md#d2-continuous-reader-evidence--2026-10-16).

The provider-free native smoke passed in **`magic_worlds_novel_reader_test_5a85e5082849`**, a new retained synthetic database. It verified rich read/reopen, ordered scope/page boundaries, archive/Trash, stale-source refusal, workspace isolation, exact current-manuscript preservation and an initial 1,000-scene request that hydrated **two scene documents**. Controlled desktop inspection verified automatic next-chapter loading, a saved version-3 reference, retained stale pages/disabled continuation and explicit refreshed reading. These are fixture checks, not authenticated author/mobile/assistive-technology acceptance.

**No project database test writes, migration, reset, generation provider call or file/record cleanup occurred.** Only this chat’s owned API process was refreshed; health and the published route/schema passed read-only checks. This turn’s temporary reader preview/tab were closed; other previews were retained.

**Next D2:** scoped replacement previews/bookmarks; reader position resume and bounded DOM windowing; remaining organization/context/editor cases; full performance/retention/offline and author/mobile/font/zoom/assistive-technology acceptance. The existing initial full-tree Studio loader and accumulating loaded reader DOM are explicit limits. D3–D6 remain planned. No phase/release/full-goal completion is claimed.

## D2 reviewed manuscript replacements — 2026-10-16

**Saved literal replacement review, atomic multi-scene application, durable recovery and grouped undo/redo are installed locally. D2 and the full 136-capability goal remain WIP.** Search selects up to 100 loaded native matches under the existing novel/part/chapter/scene/status/archive filters. Replacement is literal, including empty deletion and multiline text, with a 2,000-codepoint bound. The review shows each original/proposed rich inline fragment and every blocked or unchanged occurrence. Editing selection, replacement or filters invalidates application until the exact intent is reviewed again. Opening/reviewing itself changes no prose.

- The BFF re-resolves actual MySQL ICU quotes and codepoint positions against the saved whole-source snapshot. The client supplies no arbitrary target documents. A deterministic compiler preserves block/container identities, untouched rich marks/links/reference atoms and list starts; inserted text inherits only marks shared by its matched characters. UTF-16 edit traces drive personal-anchor remapping. A match through a reference atom or across a structural block separator is explicitly protected; read-only sections, pending/stashed AI proposals and work/document limits are also visible blockers. Nothing is silently skipped from an applied selection.
- One parent lock and transaction validates all selected heads, writes changed scene documents/checkpoints, remaps note attachments, refreshes statistics and stores one exact receipt. Metadata/goals/plans/pins and private-note text/resolution remain independent. Transport uncertainty retains the original immutable request; recovery reads its receipt first and keeps confirmed acknowledgements until every affected owned cache head is loaded. Pending affected scenes block writing, and new organization/replacement work observes the pending-operation barrier. Recovery remains outside the search drawer and bypasses that writing barrier.
- Recent confirmed origin request IDs remain available for explicit undo/redo previews. Reversal restores the original canonical prose only when each current document hash equals the expected original side. It creates new revisions, preserves later metadata and private-note edits, and refuses later conflicting prose. No destructive history rewrite or schema migration is involved. Account/API/workspace/novel/writer journals preserve unfinished form input, exact requests and acknowledgements; owner tokens retire old callbacks even after same-account re-login. Storage failures remain visible.

The public preview is bounded to 1.5 MB, each canonical document to 2 MB, and compiler/anchor work to the shared 32-million-unit budget. Explicit blocked-limit results or a bounded review error require a smaller selection. These limits are not a measured whole-product manuscript-size promise. [01](01_current_state_and_evidence.md#d2-reviewed-replacement-evidence--2026-10-16) records installed checks, native persistence and controlled browser proof; [09](09_persistence_revisions_and_recovery.md#reviewed-manuscript-replacements) records recovery/reversal semantics. Literal newlines now remain visible in the shared static prose renderer as well as the writer.

**Next D2:** bookmarks, reader position restoration and bounded DOM windowing; remaining organization/context/editor cases; complete performance/retention/offline and author/mobile/font/zoom/assistive-technology gates. The initial full-tree Studio loader remains. D3–D6 remain planned; no phase or release completion is claimed.

## D2 bounded reader and position resume — 2026-10-16

**Direct saved-scene seeking, bidirectional bounded windows and device paragraph resume are installed locally. D2 and the complete D1–D6 objective remain WIP.** The reader retains three two-scene batches in its active window. Forward/backward loading preserves a visible canonical paragraph while distant batches leave the DOM. Automatic paging refuses to evict the passage currently visible, including after the author scrolls back during an outstanding read. Short windows stop automatic filling at the bound and keep explicit previous/next controls. The writing editor remains mounted.

- `windowed: true` enables bounded navigation metadata on the existing owned read endpoint. Initial `startSceneId` seeks directly into the filtered metadata order; `beforeSceneId` and `afterSceneId` continue against the exact original source snapshot. Only selected documents hydrate. Old non-windowed scene reads retain their existing projection; no schema change or cache-clearing adapter is involved. Previous-path metadata keeps chapter/part headings consistent when a window begins mid-container.
- One separate, at-most-2-KiB device record binds the last reading scope, stable scene/block IDs and canonical content hash to a paragraph offset and layout metrics. It stores no prose. Reopening seeks that scene before hydration, then restores only a matching document/identity. Width, appearance or font metric changes use a clamped fraction of that same verified paragraph. Changed scenes retain the previous record with explicit guidance until the author continues; unavailable/out-of-scope/Trash targets require another scope or an explicit beginning. No equal-text substitution runs.
- Scroll capture is frame-limited; writes are debounced and flush on close/page-hide/visibility changes. Owner tokens retire stale callbacks. Scope changes retain independent writer positions. Storage failures remain visible, and late font adjustment retires after a reading gesture. A small optional body ref on the shared Drawer exposes its existing scroller; no nested scroll surface or new editor is created.

[01](01_current_state_and_evidence.md#d2-bounded-reader-evidence--2026-10-16) records installed tests, isolated native seeking and browser geometry. A 1,000-scene native fixture sought scene 991 by identity and hydrated two requested documents; current browser checks retained at most six rendered scenes and reopened the same paragraph within 0.125 CSS px. This is scoped evidence, not a whole-product latency/resource or author acceptance promise.

**Next D2:** bookmarks; initial full-tree Studio loading and remaining organization/context/editor cases; measured whole-product performance, retention/offline decisions and complete author/mobile/font/zoom/assistive-technology acceptance. D3–D6 remain planned. The reader's window is bounded; the existing Studio's full hydrated tree remains an explicit global memory limit. No phase or release completion is claimed.

## D2 bookmark foundation preparation — 2026-10-16

**Historical preparation checkpoint, superseded by the installation below.** At this checkpoint, separate note/bookmark storage and reads, exact point/passage anchors, bounded labels, receipts, copy choices, history and frozen snapshot contracts were isolated-tested. UI integration and project installation were still pending.

- Bookmark creation explicitly uses `kind: "bookmark"`; existing notes retain the omitted field and original request/hash shape. A bookmark label is nonblank and at most 255 Unicode characters. Cursor points, including empty scenes, retain stable block identity. Notes continue to require a selected nonblank passage. Bookmark labels/Trash and attachment authority use separate CAS; kind never changes through an edit.
- Verified insertion traces and server-owned split/merge lineage preserve locations. A cursor on a split belongs to the right-hand source interval. Removed or unverifiable locations remain detached for review rather than selecting equal text elsewhere. Undo/redo preserves later labels and Trash choices. Comment/bookmark copy options are independent and bind the reviewed annotation head. Frozen snapshots retain the kind without rewriting old note hashes.
- The prepared additive migration introduces one defaulted annotation column, one index and one check. It requires a verified private predecessor backup and compares every original content column before/after DDL. New synthetic MySQL verification preserved **68 original rows**, including a legitimate record without a file. Existing notes/receipts/frozen hashes, concurrent replay, point and empty-scene bookmarks, Unicode edits, split/merge/history, copies, snapshot reads, Trash/restore, late failure rollback, exact checkpoint reattachment and workspace isolation passed. The preceding statistics migration also passed in another new retained synthetic DB and preserved **59 original rows**.

Prepared BFF scope: **733 passed**. Frontend contract/capture checks and a complete prepared build and Storybook typecheck pass; final full-suite evidence is recorded in [01](01_current_state_and_evidence.md). No project DB migration or runtime code publication was performed for this preparation checkpoint. Project records and media files remain unchanged.

**Subsequent work:** the following checkpoint completes local UI integration and installation. Broader D2 gates and D3–D6 stay open. [17](17_annotation_anchors_and_personal_review.md#prepared-bookmark-extension--2026-10-16) records the extension contract.

## D2 bookmark installation — 2026-10-16

**Personal bookmarks are installed and locally verified. D2 and the full 136-capability D1–D6 goal remain WIP.**

- Writer selections/cursors and the visible saved-reader paragraph create labelled point or passage bookmarks through the existing flush/review gate. Empty scenes work. Separate lists, label editing, Trash/restore, detached evidence and deliberate attachment review use the existing annotation authority. Exact navigation verifies the saved canonical anchor and opens a collapsed cursor without changing prose; the reading and writing sessions remain independently scoped.
- Device forms and immutable requests survive drawer closure and uncertain responses. Receipt-first recovery confirms bookmark kind, exact owned origin/checkpoint geometry and the original operation before retiring input; it does not repost a confirmed write. Kind is immutable and explicit on every bookmark operation. Note requests retain their omitted field and old hashes. Copy choices/counts and historical snapshot pages distinguish notes and bookmarks.
- A verified private SQL backup preceded the single additive annotation ALTER. The installed marker is **`2026_10_novel_bookmarks`, 111 tables / 156 FKs**. Full original-column fingerprints verified **4,314 original content rows across 110 content tables unchanged**; the marker row advanced separately. No project database test writes, reset or record/file cleanup occurred. Missing-file records remain valid.

Installed verification: **4,972 frontend tests passed / 4 skipped (525 files); 735 scoped backend tests passed; production build and Storybook typecheck passed.** Forty-six changed TypeScript files lint cleanly; the API client retains its 41 existing diagnostics with zero added. The backend scope includes bootstrap and the annotation/statistics/bookmark migration and reset-isolation checks; it differs from older filename scopes and counts are not additive. The retained synthetic bookmark upgrade preserved 68 original rows; the preceding statistics rehearsal preserved 59. Controlled desktop checks verified exact cursor offset 9 with unchanged text, explicit orphan reattachment with focus returned to its trigger, and recovery of the original label after closing the drawer. [01](01_current_state_and_evidence.md#d2-bookmark-installation-evidence--2026-10-16) records commands, logs and proof.

**Next D2:** initial full-tree Studio loading; remaining organization/context/editor cases; measured whole-product performance; retention/offline decisions and complete author/mobile/font/zoom/assistive-technology acceptance. Highlighting and invisible-character controls remain catalog work. Then D3 assistant/proposals, D4 planning/continuity/review, D5 portability/productivity and D6 series/extensions. No phase or release completion is claimed.

## D2 Studio read boundary — 2026-10-16

**The backend read split and strict frontend transport contracts are installed.
Studio's initial full-tree opening is still pending UI/cache integration; D2 and
the full 136-capability D1–D6 goal remain WIP.**

- The new owned `studio-index` returns organization metadata, scene revision/hash
  heads, inheritance, revision-bound counters and complete root Codex references.
  Scene documents/plain/Markdown prose, chapter body aggregates and generation
  histories are absent. It is a separate type that cannot pass the editable
  `Story` guard. Unknown content is never represented by an empty document.
- Guarded selected-scene reads bind novel metadata/structure/context heads,
  chapter/part metadata heads and scene document/metadata/hash. Stale sources
  reject before mixed content can enter a writer. The complete target scene has
  only its applicable references and its full generation history. The existing
  scene GET retains that response shape and now avoids loading all other bodies.
- A new retained native fixture with **1,001 scenes** hydrated **zero documents**
  for the index and **one** for a selected read. Index JSON measured **1,045,729
  bytes**, compared with **35,337,023 bytes** for the full-tree response. Read
  fingerprints verified **4,024 original synthetic rows in 12 domain tables
  unchanged**. Owned empty/archived reads, ancestor/source changes, unrelated
  history omission and foreign-workspace/scene refusal passed. These are scoped
  fixture measurements, not complete performance acceptance.

Verification: **4,983 frontend tests passed / 4 skipped (526 files), 762 scoped
backend tests passed; production build and Storybook typecheck passed.** Three
new TypeScript files lint cleanly; the API client keeps its same 41 existing
diagnostics with zero added. [01](01_current_state_and_evidence.md#d2-studio-read-boundary-evidence--2026-10-16)
records commands, native wire, logs and installation checks. No schema change,
project database test write, reset or record/file cleanup was needed. The marker
remains `2026_10_novel_bookmarks`.

**Next:** connect the index and bounded confirmed-scene cache to Studio/provider
opening, navigation and dependent refreshes. Preserve draft/review barriers,
selection, complete copy/history access, search/bookmark navigation and receipt/
snapshot recovery. Then measure repeated switching, editor latency and memory,
and finish the wider D2 acceptance gates. [ADR 18](18_studio_index_and_scene_loading.md)
retains these requirements; D3–D6 remain planned.

## D2 Studio loading and bounded history — 2026-10-16

**Studio/provider integration is installed and locally verified. D2 and the full
136-capability D1–D6 goal remain WIP.** This supersedes the read-boundary
checkpoint's pending initial-loader integration and its schema-1 guarded scene.

- Opening reads the metadata index and only the selected canonical scene before
  replacing the current novel. Scene switches preserve the current writer while
  the next guarded read waits. Superseded/retired-owner reads are ignored; new
  typing, recovery or AI review blocks a delayed switch. Explicit refresh/retry
  preserves the current scene. A confirmed opening read is reused once.
- Library entries remain summaries, and the outline remains prose-free. One
  active seed and a disposable LRU cache of **at most three confirmed scenes /
  16 MiB serialized UTF-8** replace the accumulated full tree. Oversized reads
  bypass the cache. Drafts, journals and immutable requests have separate
  ownership and are never cache-eviction targets. Local acknowledged index heads
  invalidate the former server source hash; missing counts remain unavailable.
- Guarded scenes now use **schema 2**, with the `scene_document` projection and
  only the latest context trace. Complete saved generations remain available
  through **20-row summary pages** and a separate full-generation reader/copy.
  Archive/Trash locations are labelled. The session output cache is bounded by
  **ten results / 16 MiB**, independently of pending AI review. The established
  full scene GET keeps its existing history contract for explicit callers.
- Copy/organization previews read **at most 20 excerpts / 240 codepoints each**,
  with later pages reachable. Review failure retains the form. If saving changes
  a native source after its organization review opened, applying requires a new
  explicit review; split/merge requests no longer silently substitute revisions.
  Creation/copy receipts retire only after the selected scene opens. Search,
  notes/bookmarks, metadata, scene and snapshot recovery use the distinct sources.
- Compact novel metadata writes return the exact original acknowledgement and
  request echo with a fresh index. Replaying a receipt preserves later metadata.
  Selected-document saves return exact revision-bound counters where available;
  old immutable receipts keep their original shapes.

Verification: **5,015 frontend tests passed / one conditional fixture skipped
(533 files), 827 scoped backend tests passed; build and Storybook typecheck
passed.** Changed TypeScript adds no lint diagnostics: the API client retains
41 existing diagnostics and DataProvider retains four. Native HTTP/MySQL reads
in `magic_worlds_novel_studioloading_test_731460947cac` verified 1,001 scenes,
zero/one hydrated documents, 20+7 generation pages, complete detail/replay,
source/owner guards and **4,049 original synthetic rows / 12 tables unchanged**.
Index/full JSON measured **1,045,729 / 35,987,773 bytes**; single fixture read
measurements are not p95 or whole-product performance acceptance.

Controlled browser inspection around the real loader/editor verified retained
new typing, cache-backed retry, failed-read retention and reopening saved prose;
separate history/detail and later excerpt pages were reachable. This does not
claim authenticated author, phone/IME, screen-reader or supported project limits.
[01](01_current_state_and_evidence.md#d2-studio-loading-and-bounded-history-evidence--2026-10-16)
records commands and proof. No schema change, project database test write, reset,
cleanup, commit or release occurred. Records without files remain valid.

**Next D2:** highlighting/invisible-character controls and remaining catalog,
organization/context/editor cases; repeated-switch heap/typing measurements,
retention/offline policy, author/mobile/font/zoom/assistive-technology acceptance.
D3–D6 remain planned. [ADR 18](18_studio_index_and_scene_loading.md) describes
current read/cache ownership; all broader acceptance gates remain in scope.

## D2 highlights and invisible characters — 2026-10-16

**E18's remaining editor controls are installed and locally verified. D2 and the
full 136-capability D1–D6 goal remain WIP.** Existing personal notes/bookmarks
remain part of the same capability; broader format/author/device acceptance is
still open.

- The selection toolbar and Ctrl/Cmd+Shift+H toggle a fixed-theme highlight.
  Checked state, manual undo/redo, read-only/AI-review guards and stable text/block
  identity use the existing editor/persistence path. Canonical JSON, saved reader,
  clipboard/Markdown, scene history, named snapshots, restore and copies preserve
  the mark. Unsupported styling and duplicate marks reject explicitly.
- The typing drawer now separates replacements from a Display choice. Show
  invisible characters has its own existing novel-device scope, defaults off,
  works read-only and retains the in-memory choice when storage fails. Existing
  preferences/journals are preserved. Presentation markers do not change JSON,
  DOM/clipboard/plain text, caret, editor instance, counts, context, autosave or
  manual undo. Painting is coalesced and bounded to a visible 20,000-position
  window, with cleanup and composition deferral.
- Actual editor JSON passed HTTP/MySQL save/reopen, source-bound Studio/reader,
  frozen snapshot/checkpoint reads, restore-as-revision **5**, exact receipt
  replay and independent copied identities. The author's attached note retained
  its body/origin; prose counts stayed unchanged and invalid styling changed no
  current head. Tests ran only in the new retained synthetic database
  `magic_worlds_novel_writingmarks_test_ac44366071a4`.

Verification: **5,030 frontend tests passed / one conditional fixture skipped
(537 files), 830 scoped backend tests passed; build, Storybook typecheck and
changed TypeScript lint passed.** Browser fixtures verified toolbar selection,
shortcut, undo, marker visibility and read-only display. Markers were refined to
CSS presentation after the initial browser check exposed glyphs in the editable
accessibility value. The final DOM/clipboard checks retain actual text. This is
not complete screen-reader, phone/IME or long-project performance acceptance.
[01](01_current_state_and_evidence.md#d2-highlights-and-invisible-characters-evidence--2026-10-16)
records commands, native wire and installation evidence. No schema change,
project database test write, media/record cleanup, commit or release was needed.
The project marker remains `2026_10_novel_bookmarks`.

**Next D2:** remaining catalog/editor/context/organization cases, measured typing/
scrolling/memory and retention/offline decisions; complete author/mobile/font/
zoom/assistive-technology gates. D3 assistant/proposals, D4 planning/continuity/
review, D5 portability/productivity and D6 series/extensions remain planned.

## D2 deliberate novel erasure — 2026-10-16

**Installed and locally verified. D2 and the full
136-capability D1–D6 goal remain WIP.** [ADR 19](19_novel_erasure_and_retention.md)
resolves explicit root-novel erasure. Trash stays retained until an author erases
one selected trashed novel; installation does not erase project content.

- Shared review shows current title, descendant/history counts and active jobs.
  Exact title and source version must match again under server locks. Active AI
  executions block the action. A changed review requires fresh confirmation.
- One atomic transaction removes only the selected root's cascading manuscript,
  revisions, snapshots, notes/bookmarks, references and generations. Terminal
  execution prompts are redacted; accounting/reservation headers, source cards,
  shared media and independent copies remain. One content-free erasure record
  recovers identical requests and blocks old deterministic creation retries.
- The scoped immutable journal is written before POST. Recovery stays reachable
  after closing the dialog and reads the receipt before any explicit retry.
  Archived workspaces allow checks, storage failures retain manual-copy recovery,
  and late owner callbacks cannot clear another workspace or retire newer input.
  Confirmed erasure retires only its loaded/search cache; late pages cannot
  reintroduce the erased novel. Browser drafts remain available for manual copy.
- Full installed frontend: **5,062 passed / one conditional fixture skipped
  (543 files)**. Scoped installed backend: **895 passed** across two non-overlapping commands. Build and Storybook typecheck
  pass; 22 changed TypeScript files add no lint diagnostics (45 pre-existing).
  New retained HTTP/MySQL fixtures prove rollback, concurrent replay, one-novel
  isolation, creation/execution replay refusal and preservation of unrelated
  content including a valid missing-file record. Controlled keyboard inspection
  covers title gating, Escape and archived/lost-response receipt recovery.

The coordinated installation created a fresh private predecessor backup and
verified all **4,449 original content rows unchanged** before and after adding
one empty `story_erase_record` table and advancing the marker. The installed
schema is **`2026_10_novel_erase`, 112 tables / 157 foreign keys**. All 55 source/
documentation files and existing staged patches are hash-verified. The owned API
is healthy; read-only runtime evidence confirms zero erasure records and all
expected route contracts. No project erasure, test CRUD, reset, reseed, database
drop or media/record cleanup was part of this installation. [15](15_database_migration_and_legacy_cleanup.md#novel-erasure-installation--2026-10-16)
records the private backup and actual preservation count.

[01](01_current_state_and_evidence.md#d2-deliberate-novel-erasure-evidence--2026-10-16)
records verification and browser proof. **Next D2:** finish remaining catalog/
organization/context/editor cases, measured long-project behavior, broader
revision/storage and offline/reconciliation policy, and full author/mobile/font/
zoom/assistive-technology acceptance. D3 assistant/proposals, D4 planning/memory/
review, D5 portability/productivity and D6 series/extensions remain planned.

## D2 open-scene reconnect and reconciliation — 2026-10-16

**Installed and locally verified. D2 and the full
136-capability D1–D6 goal remain WIP.** [ADR 20](20_offline_and_reconciliation.md)
records R02/R03/R13/R15's current boundary. Persistent cached-scene/index entry
and complete cold-reload offline access remain pending.

- Browser offline pauses the scene writer and shows device/pending-sync state.
  Reconnect reads current workspace ownership/archive and the scene head before
  an unsent write. A lost-response request replays its immutable identity first;
  its newer tail cannot overwrite a later account head. Reconnect never starts
  a new paid generation.
- A wide shared review drawer shows both canonical manuscripts and a complete
  candidate. Independent stable-block changes combine; conflicting blocks,
  title and reading order require choices. Rich marks/links/mentions remain
  intact. Invalid mixed identities, new typing, stale callbacks, archive and
  later server changes cannot silently commit.
- A separate scoped device copy must be retained before adopting a reviewed
  version. Copy/download remains available, including clipboard failure. Notes
  retain body/origin; uncertain attachments remain explicit orphans. Closing
  and reopening an unchanged review keeps this session's choices.
- Every live queue gets its own journal key. A late acknowledgement cannot
  clear a reopened editor's newer prose. Exact retirement includes the base
  revisions, and unreadable original requests stay manual with their raw record
  retained. Opening a scene no longer deletes older browser-draft records.

Installed full frontend: **5,112 passed / one conditional fixture skipped
(549 files)**; production build, Storybook typecheck and all 24 changed
TypeScript files pass lint without diagnostics. Native HTTP/MySQL proof in a
new retained synthetic database reaches revision **5** and covers rich merge,
immutable base/account/merge history, exact replay after later prose, stale
write refusal, preserved note content/origin, another unchanged novel and actual
workspace archive refusal. Controlled browser keyboard checks cover block
choice, retained choices, focus return, apply, manual-copy recovery, archive and
retention failure. This is not authenticated author, mobile or screen-reader
acceptance. [01](01_current_state_and_evidence.md#d2-open-scene-reconnect-and-reconciliation-evidence--2026-10-16)
records exact evidence and installation state.

The BFF runtime/domain/schema are unchanged at `2026_10_novel_erase`, 112 tables /
157 foreign keys; the added backend file is only the synthetic smoke script.
This frontend/source installation requires no API restart or project database
test CRUD, erasure, schema operation, reset, reseed or file/media/record cleanup.
All **34 installed source/documentation files** are hash-verified. Both existing
staged patches remain unchanged. Read-only runtime checks confirm the same API
PID **1585602**, healthy schema and existing route contracts. Installed full
tests/build/stories and all 24 changed TypeScript lint checks pass; no source or
data cleanup was performed.

**Next D2:** integrate persistent cached reads and their owned entry/reload path;
finish durable review-form recovery, broader storage/shared-device/logout and
offline policy, remaining catalog/organization/context/editor cases, measured
long-project behavior and full author/mobile/font/zoom/assistive-technology
acceptance. D3 assistant/proposals, D4 planning/continuity/review, D5 portability/
productivity and D6 series/extensions remain planned.

## D2 persistent device entry — 2026-10-16

Persistent confirmed reads and explicit device writing are installed and locally
verified. [ADR 20](20_offline_and_reconciliation.md#persistent-confirmed-copies-and-device-entry)
records the storage and ownership boundary. **Full R13 and D2 remain open.**

- Owned IndexedDB copies retain strict Studio reads and separately labelled
  acknowledged prose. Drafts/requests stay in their existing journals; no
  generation collection or unsent draft becomes a confirmed read. Older results
  cannot lower a head; scenes absent from a later outline remain earlier copies.
- A native transaction commits the candidate and usage together. Confirmed-read
  allowances are 16 MiB per novel / 64 MiB per author/API; a refused candidate
  preserves earlier copies. There is no eviction/deletion path. These allowances
  do not redefine authored-journal, revision or backup retention.
- **Device novel copies** remains reachable while the workspace handshake is
  unavailable. Its canonical editor/queue has an explicit device-only boundary:
  no workspace commit, API save, pending-generation replay or provider call.
  Current drafts must checkpoint before navigation; failures keep recovery open.
- Reloading the page preserves the native scene/index and scoped journal. Once
  the app assets load, the author can deliberately resume the draft. Current
  account handoff refreshes ownership, index and the exact scene, refuses
  missing/moved/erased targets and checkpoints any input typed during the read.
  Checked reconnect additionally publishes current heads to DataProvider.
- Native fictional-browser checks pass for concurrent retention/usage, owner
  retirement, other-author isolation, malformed reads and controlled allowance
  refusal: **13 scenes / 15,728,107 bytes** remain intact. Keyboard checks cover
  scene entry/return, checkpoint, full page reload, explicit resume/editor focus
  and reachable manual-copy controls. No account client is present in the fixture.

Full frontend verification passes **5,134 tests / one conditional fixture skipped
(553 files)**, production build and Storybook typecheck. Changed TypeScript has
no new lint diagnostics; DataProvider's four baseline diagnostics are unchanged.
Existing actual HTTP/MySQL Studio projections pass the durable-copy validator.
No new database smoke or project CRUD is needed. The BFF/schema and its running
API are unchanged; no restart, reset, reseed or file/media/record cleanup occurs.
The [execution evidence](01_current_state_and_evidence.md#d2-persistent-device-entry-evidence--2026-10-16)
records source hashes, validation logs and browser screenshots.

**Next:** implement and verify network-independent app-shell loading and durable
unsent reconciliation-choice recovery. Complete broader storage/shared-device/
logout, offline, author/mobile/assistive-technology and performance gates, then
remaining D2 catalog/structure/context/editor cases and D3–D6. None of the 136
capabilities or later phases is removed by this checkpoint.

## Availability and evidence

| Layer | Actual status | Evidence / limitation |
|---|---|---|
| Default example configuration | **Per-plan grant (updated 2026-10-18)** | The membership feature-flag rollout (schema `2026_10_membership_feature_flags`, 04:45) removed the frontend `VITE_FEATURE_*` variables from [`.env.example`](../../.env.example) (uncommitted change). Novels are available only when the user's plan grants `novels` ([featureFlags](../../src/shared/featureFlags.ts): a missing or null grant is off; root bypasses). The test user's `free` plan has it on |
| Reviewed local checkout | **WIP — enabled by local opt-in** | Local `.env` sets the novels flag to `true`; this is a development override, not release evidence |
| Disabled frontend behavior | Implemented gating | [Sidebar](../../src/ui/components/Sidebar.tsx) hides story navigation; [AppRouter](../../src/app/router/AppRouter.tsx) renders Not Found for disabled pages; [API methods](../../src/infrastructure/api/index.ts) throw `Novels are disabled.` before requests |
| WIP placeholder in product UI | Gap / product decision TBD | No WIP page is rendered by the current router. Documentation uses WIP status; changing the UI would require separate implementation |
| Backend story domain | Current scene source and local API verified; release unverified | Current schema bootstrap, healthy API and provider-free MySQL smoke passed on 2026-10-16. The frontend flag remains independent of backend authorization |
| Focused frontend verification | Current D1 + D2 scene checks, 2026-10-16 | Latest installed full suite: **5,112 passed / one conditional fixture skipped (549 files)**; production build and Storybook typecheck passed. Exact commands/results are in [01](01_current_state_and_evidence.md#d2-open-scene-reconnect-and-reconciliation-evidence--2026-10-16). Historical 2026-10-15 baseline retained below |
| Focused BFF verification | Current creation/scene/Codex/copy/history/snapshot/statistics/search model/route/document checks pass, 2026-10-16 | Latest scoped installed story/manuscript/model/route plus bootstrap/migration/reset-isolation and execution/workspace verification: **895 passed across two non-overlapping commands**, plus retained synthetic actual MySQL verification. Earlier filename scopes remain dated evidence in 01; command scopes differ and are not additive |
| Live product / release readiness | Partial local evidence; release unverified | Schema, health and actual persistence smoke verified. Account age/terms reconfirmation was left to the owner; full author workflow, assistive technology, performance and model-quality evaluation remain open |
| Expanded refactor | D1–D2 installed; D3 running; D4 and D5 in progress; D6 pending (updated 2026-10-18) | See the current summary at the top of this document; release and acceptance gates above remain open |
| Standalone UI demo | Prototype only; not integrated | [HTML reference](novel-studio-demo.html); 26 temporary jsdom assertions and limited browser inspection on 2026-10-15. AI/account/context fixtures and simplified local recovery do not establish product behavior |
| UI/UX implementation plan | Updated; product work planned | UX-01–UX-12 in [06](06_ui_ux_and_accessibility.md), delivery mapping in [11](11_refactor_and_migration_plan.md#uiux-delivery-workstream), application gates in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix) |
| Database/code/feature cleanup plan | Scene, annotation, statistics, bookmark and erasure contracts installed; later cleanup remains | `2026_10_novel_erase`, 112 tables / 157 FKs; all 4,449 original content rows fingerprinted unchanged after the additive erasure-record upgrade; obsolete chapter-body writer/tables/callers retired |

An implemented DTO, endpoint, toolbar command, or test pass is not a shipped feature. Here **implemented** means code exists, **partial** means a limited variant or lower layer exists, **planned** means a target gap, and **unverified** means required runtime/release evidence is missing. Disabled features retain **WIP** status even where their code exists.

## Implemented foundation and gaps

| Area | Actual coverage | Gap to fix / target | Evidence |
|---|---|---|---|
| Gallery and create | Scoped title/manuscript/metadata search, metadata/status/tag/activity/size filters and stable sorting/pagination; saved statistics; reviewed creation/copy and recovery | Named edition branches/comparisons and release UX; live session-turn integration excluded | [NovelGalleryPage](../../src/features/novel/components/NovelGalleryPage.tsx), [library filters](../../src/features/novel/components/NovelLibraryFilters.tsx), [creation coordinator](../../src/features/novel/hooks/useNovelCreations.ts), [copy coordinator](../../src/features/novel/hooks/useNovelCopies.ts) |
| Source types | Reviewed blank/card batches and author-approved reference passages, source-version guards, exact original snapshots and immutable creation provenance; existing BFF saved-adventure snapshots | Complete author/UX acceptance; no live session-history browser in scope | [shared creation form](../../src/features/novel/components/NovelCreateDialog.tsx), [source review](../../src/features/novel/components/NovelCreationSources.tsx), [creation origin](../../src/features/novel/components/NovelCreationOrigin.tsx) |
| Scene editor | Canonical versioned TipTap JSON, stable block/mention IDs, Unicode selection/replacement, counts, guarded link inspector/paste, author typing choices and accepted-rewrite undo | Complete supported-format/loss, long-document and broader author/device acceptance | [NovelEditor](../../src/features/novel/editor/NovelEditor.tsx), document/selection/identity regressions |
| Structure | Parts, chapters, independent scenes, scoped metadata/defaults, atomic organization/lifecycle, reviewed copies including personal comments, guarded undo and independent novel copy | Remaining nested/compound/context and full position acceptance | [outline](../../src/features/novel/components/NovelChapterRail.tsx), [copy review](../../src/features/novel/components/NovelUnitCopyModal.tsx), BFF annotation/unit-copy smokes |
| Personal review | Personal notes and point/passage bookmarks, independent content/anchor versions, exact navigation/orphan review, applicable state/Trash actions, scoped draft/receipt recovery, independent copies and frozen reads | D4 AI review/issues and D5 export; broader acceptance | [personal notes](../../src/features/novel/components/NovelAnnotationDrawer.tsx), [ADR 17](17_annotation_anchors_and_personal_review.md), BFF annotation smoke |
| Autosave | Ordered scene queue, independent text/metadata CAS, exact receipts; scoped prose/details/goal/lifecycle/Codex/scene-restore recovery and conflict comparison | Full offline/storage/retention policy and large-project performance remain unverified | [save hook](../../src/features/novel/hooks/useSceneDraft.ts), cache regressions and actual MySQL smoke |
| AI inline actions | Implemented seven commands, cursor-grounded saved context, decoration-only review, explicit atomic acceptance and undo/redo | Unified conversational/multi-scene proposal pipeline remains D3 | [useInlineAI](../../src/features/novel/editor/hooks/useInlineAI.ts), [AiSuggestion](../../src/features/novel/editor/extensions/aiSuggestion.ts) |
| History | Filtered small scene pages, verified individual checkpoints/excerpt copy, hash-bound text restore with durable recovery; generation lineage; reviewed organization undo/redo and manuscript snapshots/restore; recoverable Trash and frozen personal-note reads | Retention/author/performance acceptance and conversational changeset history | [revision drawer](../../src/features/novel/components/NovelRevisionDrawer.tsx), [scene recovery](../../src/features/novel/hooks/useSceneRestores.ts), [organization history](../../src/features/novel/components/NovelStructureHistory.tsx), [snapshot drawer](../../src/features/novel/components/NovelSnapshotDrawer.tsx), BFF scene/history/snapshot stores |
| Stash | Running: cuts and alternative takes in *Tasks & stash* with reinsertion (D4 slice 2, R11) | Lineage and review/undo acceptance | [API client](../../src/infrastructure/api/index.ts), [DataProvider](../../src/app/providers/DataProvider.tsx), BFF `/generations/{id}/stash` |
| Codex | Novel/chapter/scene snapshots, local precedence, frozen version pins, stable mentions, removal tombstones and disabled restoration; frontend feature filters preserve hidden refs | Source-update impact review, temporal canon and extraction; hidden enabled refs still participate in BFF context | [useCodex](../../src/features/novel/hooks/useCodex.ts), [CodexPanel](../../src/features/novel/components/codex/CodexPanel.tsx), identity smoke |
| Context | Existing inline preview/execution compiler plus separate saved-source assistant preparation: exact messages/quotes, inherited defaults, scoped pins, visible omissions/conflicts and reserved-output budget | Connect bound assistant turns/profiles to the same prepared compiler; unified application lineage and temporal memory | [ADR 21](21_assistant_context_boundary.md), BFF compiler and native HTTP/MySQL packet checks |
| Novel chat assistant | Running since 2026-10-17 (D3): bound conversations, cited sources, Ask/Suggest → review → accept → undo, Stop and recovery | AI quality evaluation, BYOK accounting after dispatch, account/profile lifecycle | [AssistantKind](../../src/shared/types/assistant.types.ts), BFF `AssistantKind`, NE-015 |
| Portability and production | Running (D5 slices 1–13): Word/EPUB/PDF/Markdown/text export, six import formats with loss reports, `.mwnovel` packages, export jobs | EPUBCheck validation, export jobs in the *Tasks* drawer, translation/blurbs/read-aloud/dictation | [NovelStudioHeader](../../src/features/novel/components/NovelStudioHeader.tsx), NE-021 |
| Accessibility and performance | Partial / runtime unverified | Status announcements, active-option/focus semantics, deliberate review keyboard behavior; measured typing/render/save performance | NE-017/018/019; [validation](12_validation_and_acceptance.md) |

## Roadmap and dependencies

| Order / workstream | Status | Depends on | Concrete remaining work | Gate / evidence needed | Responsible area |
|---|---|---|---|---|---|
| R0 — establish availability | **WIP** | Existing gating | Record deployed build flag, compatible BFF/profile versions, disabled UX choice and intended release cohort | Enabled/disabled route and API checks; live gallery → create → save → reopen; unknown production values explicitly retained | Product + frontend + operations; named owner TBD |
| D1 — reliable editor and persistence | **Implemented/validated in checkout, WIP release** (2026-10-16); broader UI/author gates outstanding | R0 source baseline | Complete real-device/assistive-technology and author gates; carry the verified persistence/review guarantees into the D2 scene contract | Ordered save/conflict/recovery, undo/redo, target mapping and restore regressions pass; actual MySQL CAS/restore/acceptance replay passed; 250 frontend / 323 scoped BFF tests, build and story typecheck passed | Frontend editor/data + BFF story persistence; implementation owner Codex, release owner TBD |
| D2 — document model and organization | **WIP integration** (scene schema/API/editor/outline/lifecycle, templates, reviewed sources/copies, personal notes, creation recovery, organization undo/redo, snapshots/restore, history, library discovery, cover/default POV, saved statistics/size, reading appearance, view/position resume, manuscript result navigation, unit planning, bounded saved reading/resume, reviewed replacements, personal bookmarks, metadata/selected-scene loading, bounded generation history, highlights/invisible-character display and deliberate root erasure, open-scene reconnect, reviewed rich-block reconciliation, persistent device entry, durable exact-source review choices and opt-in cold app loading locally checked) | D1 save/revision contract; [accepted document decision](16_document_and_structure_decision.md) | Remaining catalog features; broader context/organization cases; complete performance and retention/offline/author acceptance | Current schema verification + isolated save/reopen/annotation/structure/copy/creation/source/template/snapshot/restore/history/library/statistics/search smoke, targeted product regressions | Frontend novel + BFF domain/database; implementation owner Codex, release owner TBD |
| D3 — grounded novel assistant | **Running since 2026-10-17 (see summary); inline AI still uses its own context compiler** | D1 reliability, D2 revision/target contracts; context compiler | NE-015/020; novel kind/profile, scope, retrieval, summaries, explicit changesets; shared inline/chat review and commit; stash | Trace equals actual packet; enforced budget; target/base checks; idempotent application; transport recovery; profile/account/workspace isolation; author usefulness evaluation | Assistant/profile + frontend novel + BFF; named owners TBD |
| D4 — planning, continuity and personal review | **In progress — slices 1–16 run (see summary)** | D2 structure + D3 proposals/memory | NE-023; board/timeline/matrix, knowledge/reveal state, plot threads, comments/tasks, reviewed multi-scene work | Source-linked continuity fixtures; stale-memory invalidation; dependency-safe partial acceptance; uncertain findings reviewed by authors | Novel product/UX + memory/assistant; named owners TBD |
| D5 — portability and productivity | **In progress — slices 1–13 run (see summary)** | D2 document/schema + D1 revision/recovery; format decisions | NE-021; Markdown/plain-text/DOCX import, manuscript/project export, selected EPUB/PDF workflows, whole-novel goals and writing-session analytics (saved totals and per-chapter word goals already exist), optional owned media/read-aloud | Format support/loss matrix; round-trip fixtures; frozen export manifest; cancellation/retry and accessible outputs; measured large-project limits | Novel frontend + BFF import/export/media; named owners TBD |
| D6 — author-owned series and extension | **Planned** | D2/D3/D4 versioned canon + D5 portability | Versioned series canon/style with novel overrides; bounded presets; optional explicit publication handoff | No silent changes to old novels/context/exports; inheritance/isolation/restore tests; extension capability and license decisions | Product + novel/assistant/workspace; named owners TBD |

All phases retain the single-author scope. Multi-user editing, presence, invitations, coeditor roles, shared reviewer access, and CRDT synchronization are **out of scope**, rather than TBD roadmap items. Phase details are in [11](11_refactor_and_migration_plan.md); acceptance matrices are in [12](12_validation_and_acceptance.md).

## Migration and cleanup tracking

The current policy is **preserve non-novel data and current novels; no whole-database resets**. [15](15_database_migration_and_legacy_cleanup.md) specifies the backup and scoped schema-change procedure; [12](12_validation_and_acceptance.md#database-migration-and-cleanup-acceptance) has three lean DEV checks. A production rollout program is not required. D1 implementation is complete in the checkout; D2–D6 remain in progress or planned.

| Workstream | Status / next action |
|---|---|
| M1 · Current schema and code | **Scene contract installed; further phase extensions remain:** update `db.sql`, marker/seeds/bootstrap, services/contracts and frontend callers together. Prefer a clean target schema; remove obsolete writers/adapters |
| M2 · Scoped database changes | **Non-novel content recovered and retained:** the subsequent verified private backup/additive upgrade installed `2026_10_novel_annotations`; all 4,276 pre-existing content rows were verified unchanged. Future extensions require the same preservation procedure |
| M3 · Short smoke and cleanup | **D1 verified:** DEV-01 startup/schema, DEV-02 actual MySQL fresh-data flow; DEV-03 status-only acceptance, timestamp merge, duplicate Codex helpers and obsolete goal migration removed. Scene writer replacement verified; later phase cleanup remains. Use relevant existing tests; no 18-case migration suite |
| CL-01/02 · Storage/API | **Current replacements implemented; later phases remain:** retire superseded writers/contracts when their replacement works. Preserve existing rows; any further schema change requires its own scoped preservation review |
| CL-03/04/05 · Save/editor/AI | **D1/D2 current writers implemented:** ordered saves/CAS, separate AI previews, atomic acceptance, one context compiler and canonical scene JSON/stable references replace raw chapter Markdown/name-only persistence. Later assistant/annotation paths must retain those guarantees |
| CL-06/07/08 · Codex/browser/exposure | **Partial:** scoped snapshots/tombstones and current draft format connected; known obsolete draft/goal keys discarded. Reference mutation recovery is implemented; complete stash workflow and future feature exposure |
| CL-09/10 · Code/contracts/docs | **D1 implemented:** duplicated Codex helpers re-export shared implementations; strict write/accept DTOs, focused regressions, i18n and API docs updated. **Remaining:** later phase contracts and complete mutation recovery |

Named implementation owners/dates remain TBD. Cleanup completes when the replacement works and its obsolete path is gone; no observation window or preserved legacy-data manifest is required. Keep normal product revisions, undo, ownership, trash and new-request recovery. No feature phase is closed by resetting fixtures.

## UI/UX work status and next steps

The full work-item definitions and evidence qualifications are maintained in [06](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work). The following is an implementation queue, not a claim that the example design has been accepted or shipped.

| Work group | Current evidence / status | Next product work / gate | Responsible area |
|---|---|---|---|
| UX-01/02 · Prose-first layout and reading | Local token presets, width docking, keyboard selection and draft preservation checked; full app-shell, 320px, zoom, font-loading and author validation outstanding | Complete container/fallback/device and keyboard-safe overlay acceptance; execute matching rows in [12](12_validation_and_acceptance.md#uiux-acceptance-matrix) | Novel frontend + design system + UX; named owners TBD |
| UX-03/04/05/06 · Review, feedback, focus, and continuity of input | Review controls below the initial fold observed; phone footer and icon name corrected only in demo; panel input/focus behavior still needs production contracts | D1 essentials, then D2/D3 extensions: reachable decisions, persistent recovery, shared modal behavior, retained editor/composer state | Editor + shared UI + persistence/assistant frontend; named owners TBD |
| UX-07/08 · Organization and deliberate AI | Shared-view and explicit-review examples exist; discoverability and actual domain execution unvalidated | Implement accessible structure actions and the bounded scope → request → review → commit flow; test with authors and real services | Novel frontend + structure/context/changeset services + UX; named owners TBD |
| UX-09/10 · Memory and delivery | Illustrative knowledge/canon and limited downloads/imports only | D3–D6 memory/version behavior; D5 supported-format/loss/compilation contracts and UI | Memory/assistant + import/export + frontend; named owners TBD |
| UX-11/12 · States and validation | Failure examples incomplete; no moderated, real-device keyboard, or assistive-technology acceptance | Include full state variants and English/Spanish tasks in each slice; retain browser and author-study evidence | Product/UX + frontend + accessibility review; named owners TBD |

Prototype corrections do not close NE-017/019 or establish the production behavior described by any other NE finding. Gate D1 recovery and intentional review before widening AI scope. Product, UX, and engineering must retain both interaction evidence and the underlying document/request evidence; neither substitutes for the other.

## Execution disposition of findings

| Findings | Current disposition / evidence |
|---|---|
| NE-001/002/003/004/005/006/007/009/011/012/013/019/022 | Addressed in current checkout by the linked D1 regressions and scoped BFF tests; real DB smoke additionally verifies NE-001/003 persistence semantics. No release claim |
| NE-010 | Link round-trip fixed; complete supported-document/loss contract remains D2/D5 work |
| NE-008/014 | Stable mention JSON and checkpoint/scene/chapter/part/root trash recovery implemented in this checkout, with identity and actual MySQL smoke evidence; release/complete UX gates remain |
| NE-017 | Live announcements/active options/explicit review/group semantics improved; complete keyboard/contrast/assistive-technology acceptance remains open |
| NE-020 | Safe instruction projection and base/applied revision lineage implemented for inline generations; unified assistant/changeset lineage remains D3 |
| NE-016/018/023 | Open: remaining organization edge cases/copy; production-build and low-end performance; narrative-time memory rules. NE-015 (novel assistant) and NE-021 (portability) are built (D3, D5); their acceptance remains (updated 2026-10-18) |

## Open backlog and closure rules

Historical NE-001–NE-023 findings in [10](10_issues_gaps_and_risks.md) remain the audit record. The execution disposition below supersedes the earlier all-open snapshot. Current source was rechecked; prior controlled reports were preserved without rerunning those individual fixtures. Before closing an issue, retain its regression test or reproducible evidence, implementation reference, affected API/migration contract, and actual result. A general suite pass or an endpoint's existence cannot close a specific gap.

The first integrity work is ordered saves/revision checks (NE-001), recoverable local drafts/checkpoints (NE-013/014), accepted-rewrite undo and acceptance durability (NE-002/003), cursor/selection correctness (NE-005/006), Unicode/fidelity protection (NE-007–010), and honest context limits/traces (NE-011/012). These are prerequisites to widening assistant mutation scope. NE-004/017/019/022 must be included in the same user-facing reliability review; performance NE-018 needs measurement before assigning a supported manuscript-size promise.

## TBD decisions

| Decision | Status | Required before | Evidence / accountable area |
|---|---|---|---|
| WIP placeholder versus hidden/Not Found disabled UI | **TBD product choice** | UI implementation when selected | Existing behavior remains sufficient for development reset; production cohort planning is not a prerequisite |
| Canonical schema, block/reference IDs and wire offsets | **Resolved for current schema: ADR 16; future import/export support remains D5** | D2 schema and D3 precise targeting | Current document/selection fixtures; no legacy Markdown database bridge required |
| Rich-text application in Python: semantic operations versus approved JSON snapshots | **D2 implemented:** validated canonical JSON/checkpoint restores and server-side structure transforms; D3 changeset semantics remain TBD | D3 commit | Current transaction/fidelity regressions and actual MySQL restore chains; BFF/editor |
| Revision/checkpoint/trash retention, storage ceilings and logout/shared-device policy | **Root Trash/erase resolved in ADR 19; broader revision/unit/device/storage policy TBD** | D1 durable recovery release | Storage/quota/eviction, auth/account and restore scenarios; product/persistence |
| Offline guarantee and conflict UX | **Open-scene pause/checked reconnect, reviewed merges, persistent device entry, review-choice recovery and opt-in verified cold app loading implemented; broader storage/shared-device/retention and author acceptance remain** | D1/D2 recovery release | Cached edits, reconnect, multi-tab/device revision conflicts; frontend/product |
| Context allocations, output reservation, helper cost/latency and AI-quality thresholds | **TBD** | D3 broadened generation | Frozen profile/graph/language corpus and author review; AI/product |
| Narrative-time/POV/unreliable-narrator and derived-memory policy | **TBD** | D4 continuity | Source evidence and future-revelation/flashback fixtures; product/memory |
| Exact import/export feature coverage and optional EPUB/PDF/media scope | **TBD** | D5 implementation | Format fixtures, loss report and author delivery tasks; product/import-export |
| Series inheritance/update behavior within workspace permissions | **TBD** | D6 | Cross-novel version pins/local overrides and isolation fixtures; product/workspace |
| Add-on/conversion licenses and hosting dependency | **TBD** | Dependency adoption | Fresh primary documentation and prototype; engineering/product |
| Named owners, work-item links, phase dates and release evidence | **TBD** | Delivery scheduling and shipped status | Assign after scoped contracts/estimates; no dates are promised here |
| Current scene/annotation/revision/receipt/statistics schema and minimal seed | **Installed/verified: `2026_10_novel_erase`, 112 tables / 157 FKs** | M1/M2 | [15 storage blueprint](15_database_migration_and_legacy_cleanup.md#required-storage-changes-by-phase), exact verifier, preservation fingerprints and fresh synthetic smoke |
| Legacy-data/backfill/client compatibility policy | **Resolved: preserve recovered content; no further whole-database resets** | Current plan | User required non-novel recovery. Preserve installed novels and unrelated content through scoped changes; no bridge to the discarded pre-refactor format is required |
| Migration test/rollout scope | **Resolved: three lean DEV checks** | M3 | No support/observation window or backup/rollback rehearsal for this test DB; use CL inventory for code cleanup |

The full decision register is [13](13_sources_and_open_decisions.md). Documentation completion does not imply implementation completion. Update this status ledger when code, configuration, validation, or deployment evidence changes; preserve the distinction between the local development opt-in and product availability.


Earlier scene-integration checkpoint (superseded by the mutation recovery evidence above): **519 focused BFF tests passed (5.18s)**,
**307 frontend tests / 38 files passed (3.80s)**, production build and Storybook
typecheck passed, targeted novel/shared lint passed with zero warnings, and
`git diff --check` passed in both repos. The API remained healthy after cleanup.
The last provider-free MySQL smoke retained scene revision 10 / structure
revision 18. No goal/phase completion, commit, production deployment, or model
quality claim is implied; continue the remaining work listed above.


Final mutation-recovery checks: production build and Storybook typecheck passed;
**targeted novel/shared/runtime-contract ESLint passed with zero errors or
warnings**, and `git diff --check` passed in both repositories. All **329 local
file links** in this dossier resolve. The broader DataProvider file still has
its pre-existing four lint errors (three `no-explicit-any` and one render-time
ref assignment); the new recovery block adds no lint warning. No commit, PR,
production deployment, model execution or phase/goal completion is claimed.

The running local API OpenAPI document also confirms the new `/stories/{id}/codex` route is installed and all retired `/card-refs` mutation routes are absent.

## D2 durable reconciliation choices — 2026-10-16

Durable exact-source review choices and independent saved-review entry are
implemented and locally verified. [ADR 20](20_offline_and_reconciliation.md#durable-review-choices-and-independent-recovery--2026-10-16)
records the boundary. **Full R13, D2 and D3–D6 remain open.**

- A separate IndexedDB form journal retains block/title/order choices across page
  reload and new review IDs, only for exact owned source documents and heads.
  Independent writers cannot replace one another; lower/equal-sequence changed
  writes are refused. Atomic 16 MiB-record/64 MiB-author/API allowances preserve
  earlier records when storage or size checks fail. No cleanup/eviction runs.
- Saved reviews open directly from the device library even without the optional
  confirmed-read cache. The saved account snapshot supports local choices/export
  with account adoption and refresh disabled. Fresh owned comparison, original
  device-copy retention and normal revision CAS remain required for application.
- Failed checkpointing keeps the review open and navigation/unload guarded.
  A retained retry permits closing. Owner retirement, archive/default-workspace
  boundaries, readable status and English/Spanish copy have regression coverage.
- Native browser verification proves full reload recovery, saved snapshot entry
  and persistent local choices while account controls remain disabled. All 13
  IndexedDB isolation/order/refusal checks pass without project writes or record
  removal. [01](01_current_state_and_evidence.md#d2-durable-reconciliation-choice-evidence--2026-10-16)
  records full verification and installation artifacts.

**Next:** network-independent app-shell cold loading; remaining D2 catalog cases,
large-project performance, broader retention/storage/shared-device policy and
full author/mobile/font/zoom/assistive-technology acceptance. D3 assistant,
D4 planning/continuity, D5 portability/productivity and D6 series/extensions
remain planned. All 136 capabilities remain in scope.

## D2 cold offline app loading — 2026-10-17

Opt-in production app copies and safe update lifecycle are implemented and locally
verified. [ADR 20](20_offline_and_reconciliation.md#opt-in-cold-offline-app-loading--2026-10-17)
records the contract. **Full R13, D2 and D3–D6 remain open.**

- Device novel copies offers an explicit app download on HTTPS/localhost. The
  build manifest binds exact public app files by length and SHA-256; credentials,
  private responses, auth links, version checks and unknown URLs are excluded.
- Each app base has a native atomic 64 MiB reservation allowance. Independent
  immutable build caches retain earlier complete copies after failed downloads,
  corruption or limit refusal. No automatic deletion or eviction runs.
- Navigation keeps a coherent verified build. Updates wait for old app tabs to
  close; no skip-waiting or forced editor reload occurs. Download controls retain
  keyboard focus, prevent duplicate actions and report actual waiting/failure
  states. Existing unrelated workers remain untouched.
- Native browser checks prove actual app cold rendering with the fixture server
  stopped, recovered fictional local prose and continued offline editing. A newer
  build waits without changing the earlier writer, then activates normally.
  Mismatched deployment files preserve the previous build. Ten native storage/
  reservation checks and targeted UI/protocol regressions pass. Full commands,
  counts and transfer evidence are in [01](01_current_state_and_evidence.md#d2-cold-offline-app-evidence--2026-10-17).

**Next D2:** remaining catalog/organization/context cases, measured long-project
behavior, explicit long-term app/draft/revision retention and shared-device/logout
policy, and full author/browser/mobile/font/zoom/assistive-technology acceptance.
The controlled writer is not a real author/permission acceptance study. D3
assistant, D4 planning/continuity, D5 portability/productivity and D6 series/
extensions remain planned; no phase is closed by this checkpoint.

## D2 retained workspace lifecycle — 2026-10-17

Workspace metadata retention and live device-view restrictions are implemented
and locally verified. [ADR 20](20_offline_and_reconciliation.md#d2-retained-workspace-lifecycle--2026-10-17)
records ordering, storage and legacy-copy behavior. **Full R13, D2 and D3–D6
remain open; all 136 capabilities remain in scope.**

- Checked workspace lists retain real versions without requiring another scene
  read. Late list/scene responses cannot remove a newer/equal archive; a newer
  checked restore can reopen a versioned device writer. Legacy unversioned
  archives remain conservative and current account writing uses fresh reads.
- A separate bounded metadata namespace reuses the existing native schema-1
  store. Workspace-only changes leave saved manuscript bytes intact. Refused
  batches and unreadable records remain available without automatic replacement,
  eviction or deletion.
- Open device writers and saved reviews observe newer archive restrictions across
  tabs while retaining their selected source, unsent prose and recovery actions.
  Owner retirement and overlapping refreshes cannot publish another account's
  state. Cache state supplies no account authorization.
- Twenty-two native transaction checks and a controlled two-tab writer exercise
  pass. Full commands and installation evidence are in
  [01](01_current_state_and_evidence.md#d2-retained-workspace-lifecycle-evidence--2026-10-17).

**Next D2:** remaining unit/root lifecycle and organization/context edge cases,
measured long-project behavior, explicit long-term app/draft/revision retention
and shared-device/logout policy, then full author/browser/mobile/font/zoom/
assistive-technology acceptance. D3 grounded assistant, D4 planning/continuity/
personal review, D5 portability/productivity and D6 series/extensions remain
planned. Non-novel recovery is complete; preserve records even when no file exists.

## D2 novel and unit device lifecycle — 2026-10-17

Known novel/unit lifecycle restrictions now update open device writers and saved
reviews without replacing their original prose/source. [ADR 20](20_offline_and_reconciliation.md#d2-novel-and-unit-device-lifecycle--2026-10-17)
records the independent metadata/placement ordering, bounded native storage and
terminal erasure boundary. **D2, full R13 and all D3–D6 remain open.**

Checked root lists, Studio indexes and compact lifecycle acknowledgements retain
actual authorities separately from manuscript copies. Root/ancestor archives,
Trash, removed scenes and confirmed erasure remain read-only. Older observations
cannot unlock them; a newer applicable restore can, while erasure stays terminal.
Original device writing and manual recovery remain available after tab updates
and full reload. No new native database version, project database operation,
record/file cleanup or API restart is required. Records without files remain valid.

Thirty native checks and a two-tab writer/reload exercise pass. Publication and
reader ownership guards, refusal/corruption recovery and saved-review behavior
have focused regressions; exact commands/results and preservation evidence are in
[01](01_current_state_and_evidence.md#d2-novel-and-unit-device-lifecycle-evidence--2026-10-17).

**Next:** complete the remaining D2 catalog/organization/context edge audit,
measure long-project limits, resolve broader revision/device retention and
shared-device/logout behavior, and perform full author/browser/mobile/font/zoom/
assistive-technology acceptance. D3 grounded assistant/proposals, D4 planning/
continuity/personal review, D5 portability/productivity and D6 series/extensions
remain planned. All 136 capabilities remain in scope; no phase/release closes here.


## D3 saved-source context preparation — 2026-10-17

**Implemented and locally verified; D3 remains WIP.** D2 acceptance and the full 136-capability D1–D6 objective remain open.

- Studio's shared header menu opens **Prepare assistant sources**. It captures a selection without flushing/replacing the editor. Selection, scene, chapter, novel and an explicit scene set are available. Preparation uses saved account text; device-only writing has no account-source action. Questions/options remain in the mounted drawer across closure. Account/workspace/novel retirement, abort/closure and changed form/source heads cannot present a late result as current.
- A strict, provider-free read endpoint uses the owned metadata index and at most 20 selected canonical scene documents in one transaction. Literal lexical ranking stays inside the eligible novel scope. Trash, merged units, writing exclusions and archive choices are applied before document loading; through-anchor excludes later reading-order scenes. Explicit author analysis can include later scenes, but establishes no character-knowledge/story-time claim.
- The actual packet contains exact UTF-16 quotes with saved revisions/hashes, available stable block anchors, inherited writing defaults, root style settings and effective pinned Codex snapshots. Disabled local pins override inherited context. Unverified lore reveal boundaries are reported/excluded under through-anchor. Conflicting snapshots stay distinct in the actual messages and inspector.
- Actual serialized messages, packet hash, source manifest, omissions and a conservative UTF-8 byte input estimate are inspectable. Output is reserved first. Required instructions, target and enabled target context fail explicitly if over budget; optional source passages/pins may be omitted with reasons. There is no silent protected-source truncation, provider request, generation/conversation insert, manuscript application, schema change or project test write.

Validation: the prepared complete frontend suite passed **5,208 tests / 567 files, one skip** before the additional native-packet guard; the native packet/hook/drawer scope then passed **17 tests / 3 files**. **977 backend novel/startup checks / 54 files** passed; the focused 80-check command overlaps that coverage. Production build and Storybook typecheck passed. Targeted lint has no new errors/warnings; 41 existing API-client errors map to unchanged baseline lines. Final installed verification is recorded in [01](01_current_state_and_evidence.md#d3-saved-source-context-preparation-evidence--2026-10-17).

The provider-free HTTP/MySQL smoke used retained **`magic_worlds_novel_assistant_test_7753402f7364`**. Ten actual wire packets cover native lexical ranking, all five scopes, exact second repeated-passage anchoring, future-source policy, pin conflicts, source-version rejection, wrong workspace/foreign scene rejection, budget failure and archived-workspace reads. Fingerprints across all **112 synthetic tables** stayed identical during preparation reads. The earlier synthetic attempt stopped on a fingerprint-helper argument error and was retained as **`magic_worlds_novel_assistant_test_f5051fd3b5a9`**; no reset/cleanup was used. Frontend guards accept the actual native packets and hashes. The project schema remains `2026_10_novel_erase`; the installation preflight is read-only and checks for active work before any owned API restart.

Native desktop inspection used controlled fictional packets exported by the Python compiler. It verified exact source quotes/pins/exclusions, stale labeling when the reading boundary changed, later-scene inclusion only after explicit author-analysis preparation, and an unsent question retained across close/reopen. This is not authenticated author, mobile/assistive-technology, model-quality or whole-phase acceptance.

**Remaining D3:** novel kind/storage/binding and published profiles; retained conversations and unsent drafts across navigation/reload; execution admission/recovery and credential custody; evidence-linked answers; proposal validation/storage/comparison/refine/stash; revision-bound idempotent acceptance/undo; shared inline/chat pipeline; assisted planning/summaries/canon proposals; full source/profile/account/workspace and author-usefulness acceptance. [ADR 21](21_assistant_context_boundary.md) preserves those boundaries. No D3–D6 completion or release is claimed.


**Final installed check:** **5,210 frontend tests / 567 files, one skip; 980 backend novel/startup/isolation checks / 55 files** passed, alongside production build and Storybook typecheck. API **1850548** is healthy; the installed endpoint rejects unauthenticated reads. All **112 project table fingerprints**, both staged patches and 3,376 unrelated source files remain unchanged. The schema marker stays `2026_10_novel_erase`; no project test CRUD, reset, reseed or cleanup was performed. Source/runtime installation does not close D3 conversations/proposals or remaining D2/D4–D6 gates.


## D3 bound conversation preparation — 2026-10-17

**Prepared; not installed or enabled.** [ADR 22](22_novel_assistant_turns_and_commit.md)
records the shared novel binding/profile contract, full profile/history-bound
preview, cited Ask results and unapplied generation candidates. The existing
reviewed manuscript commit remains the only writer. This changes no phase
completion claim or the full 136-capability D1–D6 objective.

A separate retained synthetic upgrade verified all 61 original rows across 112
tables, preserving a guide message and a valid missing-file media record. Native
HTTP/MySQL fixtures also verified read-only full previews, real conversation and
candidate storage, late rollback, reconciliation, stash and explicit idempotent
author acceptance. They used controlled replies and made no provider request or
project test write. The target schema is prepared, not applied to the project.

The complete Studio conversation/composer/profile/proposal interface, durable
unsent drafts, execution custody/recovery, unified inline/chat behavior,
planning/summaries/canon proposals, native chat erasure/retention and full author
acceptance remain required. Remaining D2 and all D4–D6 work stay open.

## D3 Studio conversation and draft preparation — 2026-10-17

**Prepared; feature runtime and schema are not installed or enabled.** This
extends the preceding core checkpoint and its interface gap; it does not close
D3 or any of the 136 capabilities' remaining acceptance gates. [22](22_novel_assistant_turns_and_commit.md#prepared-studio-conversations-and-retained-drafts--2026-10-17)
records the prepared behavior and exact limits.

The Studio drawer reuses shared conversations, message rendering, streaming and
the composer. Named creation has atomic request receipts and concurrent replay.
Scoped writer drafts retain questions/source/profile choices; uncertain turns
retain their original request and guards before dispatch. Full prompt review
binds the source, published profile and exact conversation/history head. Changed
choices disable sending. Historical evidence, live candidate status,
original/proposed comparison and stash are available in the prepared interface.
Refine and complete editor application/undo remain required.

The new retained synthetic native check passed concurrent create/replay,
archive/deletion guards, Ask/Suggest storage, read-only previews, rollback and
explicit acceptance/replay without a provider or project test write. Prepared
frontend checks passed **5,226 tests / 573 files, one skip**, build and story
typecheck. The broader backend run passed **14,859 tests** with the same **17
verified baseline failures**, three skips and four deselections. Controlled
desktop inspection is visual evidence, not authenticated author/mobile or model
quality acceptance.

An independent Storybook/offline-plugin build conflict was fixed in the actual
checkout; its static build passed. This configuration change does not enable the
assistant feature. The API and project schema remain at the installed
saved-source checkpoint; recovered non-novel content, current novels and staged
patches are preserved. Source-confirmed execution custody, linked retries,
conversation lifecycle/retention, source-bound application/refine, inline/chat
unification, planning/summaries/canon and full acceptance remain D3 work.
Remaining D2 and all D4–D6 work are unchanged.


## D3 private runtime and provider transport preparation — 2026-10-17

**Prepared and verified through controlled ports; feature execution and schema
remain uninstalled.** [ADR 22](22_novel_assistant_turns_and_commit.md#prepared-private-runtime-and-provider-transport--2026-10-17)
records the source boundaries and remaining integration. This advances D3 without
closing D2, D3–D6 or any remaining full-goal acceptance requirement.

The novel workflow now has an executor-side fixed-topology guard. Fictional
template-looking source/history stays literal in Chat and metadata; it cannot
introduce a parser, Python, fetch, inner graph, hook or callable tool. Credentials
are carried by a host capability outside the graph. Binding and native resource
recovery do not construct an SDK. Native recording retains a graph reference to
the passive client, and actual model operations use frozen provider/profile
routing, limits and deadlines. Protected JSON output uses the existing strict
decoder rather than repairing fenced or duplicate-key responses.

Private async transport is connected to OpenAI Chat Completions/Responses,
Anthropic, Google and Cohere. Controlled tests cover final request bounds, literal
prose/history, redirect/error behavior, split credential echoes, late output after
retirement and stream cleanup. Cohere checks qualify its existing plain-response
path; they do not add tool support or replace existing published writing profiles
with tool-only assistant profiles.

Validation: **229 scoped executor/workflow checks, 173 private provider-library
checks and 35 runtime checks passed**. A further **56 compiled-novel runs** use
the actual BFF packets, real inline runner/scheduler/recorder and native model
adapters with both payer modes. They preserve the exact system packet and keep
test keys out of request bodies, returned events and 2,072 recorded transitions.
The provider and native store are controlled ports: this proves no paid-provider,
MySQL persistence, protected HTTP admission or authenticated author acceptance.
Four existing native tool-span tests remain unresolved in the broader upstream
suite; their identities also fail/error in the unchanged upstream checkout. The
previous BFF run's 17 baseline failures remain open. No whole-backend green signal
is claimed.

**Next:** wire protected HTTP admission and BFF dispatch without falling back to
credential-bearing graph clients; preserve current published profile identities
while preparing a non-destructive four-engine catalog upgrade/provisioning; then
qualify native SQL, retained recovery, retries and stop behavior. Source/context-
bound refine/apply/undo, inline/chat unification, planning/summaries/canon, broader
D2 acceptance and all D4–D6 work remain in scope. The project database, running API,
recovered records, missing-file records and unrelated staged work remain preserved.


## D3 protected HTTP preparation — 2026-10-17

**Prepared; feature source and schema remain uninstalled.** The protected
completion endpoint separates transient credentials before ordinary request
validation/serialization. Delegated service authority, execution identity and
fresh-plan authorization precede admission. Confirmed completed replays use their
original execution and do not require the old key or current catalog availability;
an in-progress replay cannot start another model call. An explicit capabilities
endpoint and version acknowledgement are prepared. BFF dispatch is not connected.
[ADR 22](22_novel_assistant_turns_and_commit.md#prepared-protected-http-boundary--2026-10-17)
records the boundary and its limits.

Sixteen focused HTTP boundary checks passed. A further **112 actual compiled-packet
runs** cover both stream modes, both payer modes, OpenAI Chat Completions/Responses,
Anthropic and Google, plus keyless completed replays. They exercise real FastAPI
parsing/admission, the inline scheduler/adapters and native in-memory recording.
Authentication, catalog, admission storage, native storage and provider replies use
controlled ports; this is not SQL, BFF-dispatch, live-provider or author acceptance.

The expanded executor/workflow run passed **347 checks**, with **10 failures,
four fixture errors and one deselection**. It exposes unresolved catalog/recovery
route wiring, public admission coverage and older eager-client/validation test
expectations. These additional results have not been established as unchanged
baseline failures; they remain open. No whole-backend green signal is claimed.

**Next:** finish BFF version negotiation/dispatch without legacy fallback, retain
uncertain executions rather than failing/refunding them, connect inspect/resume/stop,
and qualify native SQL persistence. Preserve existing published model/profile
identities and parameter compatibility while preparing the additive catalog upgrade.
Studio source/context-bound refine/apply/undo, inline/chat unification,
planning/summaries/canon, remaining D2 acceptance and all D4–D6 work are still required.
The running API, project schema, current novels, recovered non-novel and missing-file
records and staged patches remain preserved. No reset, reseed, project test write,
provider call, dependency reinstall or service restart was performed.


## D3 protected dispatch and completed reconciliation — 2026-10-17

**Prepared; feature source and schema remain uninstalled.** Novel-assistant BFF
requests negotiate the explicit version before sending a key, preserve the
symbolic graph and send credentials separately. They cannot fall back to the
legacy credential-bearing graph renderer. Confirmed cached replies, including
large Unicode argument streams, pass through the existing domain readers.

Unknown transport outcomes, disconnects and lost domain-commit acknowledgements
retain the original plan, turn and ledger while releasing only execution capacity.
A completed upstream result can reconcile into the original domain operation
without a key, fresh catalog lookup, new model call or new admission charge.
Explicit resumable work uses its retained version and a fresh key; source/graph
and execution identity are not resubmitted. Local failed/cancelled status alone
cannot trigger a refund while provider usage is uncertain. Terminal settlement
and explicit stop remain required before enabling the feature.

The prepared executor registers inspection/resume routes and reads completed
public output plus confirmed usage under the native store lock. It does not
rebuild a client for a historical read. Completed-node continuation now returns
its full canonical answer. Stream projection handles restated and split tool
names without duplicating names or combining pending fragments into one action
frame. Credential ownership also closes if response headers fail before iteration.
[ADR 22](22_novel_assistant_turns_and_commit.md#prepared-protected-dispatch-and-reconciliation--2026-10-17)
records the current boundaries.

Verification: **932 BFF regression checks passed**, with **94 current focused
transport/workflow checks**, **64 executor recovery/boundary checks** and **229
other executor/workflow checks** passing. Sixteen two-process BFF-to-executor runs
cover OpenAI Chat Completions/Responses, Anthropic and Google, both payer modes
and both stream modes. Each simulates a lost first domain commit, then performs
keyless replay and completed reconciliation with one model operation and one
final domain result commit. Authentication, catalog, admission/native storage,
SQL-query ports and provider replies are controlled; this is not native MySQL,
real billing settlement, paid-provider or authenticated author acceptance.

The broader public executor checks still have 24 unresolved identities also
failing/erroring in unchanged source: four direct debug failures and 20 ingress
cases blocked by baseline fixture wiring. The earlier public admission/catalog,
native-tool and BFF release findings remain separate open work; no full-backend
pass or F01/F04/F11 closure is claimed.

**Next:** native SQL persistence/recovery races and terminal usage/stop settlement;
non-destructive four-engine catalog provisioning preserving existing published
model/profile identities and parameter behavior; then complete Studio lifecycle,
source-bound refine/apply/undo and shared inline/chat execution. Remaining D2
acceptance, assisted planning/summaries/canon and all D4–D6 stay in scope. The
project database, running API, recovered content, valid missing-file records and
staged changes remain preserved. No reset, reseed, project fixture write, provider
call, dependency reinstall or API restart was performed.


## D3 native MySQL and catalog upgrade preparation — 2026-10-17

**Prepared; feature code and schema remain uninstalled.** The catalog DDL now
accepts OpenAI, Anthropic, Google and Cohere. Its explicit upgrade accepts only
the exact prior OpenAI-only CHECK, requires a private verified backup of the
five catalog tables before changing that CHECK, and verifies all prior rows
remain. It does not rename models/profiles, alter endpoints or grant capabilities
to unsupported models. Streaming-only writing profiles remain valid. The protected
catalog HTTP route now exposes the database-backed public projection with version
acknowledgement, delegation checks and no routing/custody secrets.

A retained isolated MySQL **8.1** schema verified missing/tampered backup rejection,
atomic CHECK widening, idempotency and resumption after interruption following
the ALTER. All **109 pre-existing rows across 37 fixture tables** stayed identical,
including a completed native execution, model/profile references, a streaming-only
writer, a guide and a valid missing-file marker. Native writer descriptors were
then provisioned for all four engines. This is fixture evidence; deployed catalogs
and the project's published profiles have not been migrated or provisioned.

Sixteen actual compiled-novel requests cover OpenAI Chat Completions/Responses,
Anthropic and Google, both payer modes and both stream modes. They use real
FastAPI admission, SQL-backed catalog resolution, production runtime/native SQL
storage, confirmed usage reads, exact-version rejection and foreign-project/user
rejection. Only authentication/verified identity and provider HTTP are controlled.
Each model operation happens once; completed replay and historical reads invoke
no model. A further real-SQL check confirms history remains readable with inference
disabled, a revoked fixture grant and no current key/catalog lookup. Decoded JSON
and binary scanning of every row across 37 fixture tables found no test credential
or evaluated template value. Guide/missing-file and writer references remain exact.

**108 focused catalog, backup, custody and recovery checks passed.** The key-rotation
regression now exercises real facade operations: no SDK at binding, one cached key
through a context, a rotated key for the next context and cleanup/late-call refusal.
The two previously missing catalog-route checks now pass. Wider public admission,
other upstream release checks and the earlier BFF baseline failures remain open;
no full-backend pass is claimed.

**Next:** actual published-profile/target provisioning and model parameter/format
compatibility; BFF catalog integration and both-service SQL/ledger acceptance;
interrupted continuation/concurrent claims, stop/terminal usage settlement and
retention/erasure races. Studio lifecycle, source-bound refine/apply/undo, shared
inline execution, assisted planning/summaries/canon, remaining D2 acceptance and
all D4–D6 remain required. The single owned test schema and backups are retained.
No project test CRUD, reset, reseed, cleanup, paid provider call, dependency reinstall
or API restart was performed. Recovered project content and valid missing-file
records remain preserved. Global F01/F04/F11 closure is not established.


## D3 catalog contract preparation — 2026-10-17

**Prepared only; runtime catalog consumers and the full assistant remain
uninstalled.** A strict BFF reader now accepts the protected project catalog with
delegated identity, an exact version acknowledgement, bounded strict JSON and
the public profile DTO. It rejects duplicate model/connection identities,
inconsistent target revisions, foreign connection targets and routing/credential
fields. It does not merge an old root snapshot or fall back to public discovery.
The existing application catalog callers have not yet switched to this reader.

The prepared executor now represents `json_schema` and requires it for the same
internal writers as the BFF. Its voice-call token/message/time limits match the
BFF. Exact feature-contract parity is checked without removing capabilities from
the comparison. Streaming-only novel writers still require neither tools nor
structured output. These corrections do not rename or modify saved profiles.

**94 focused BFF checks passed.** The expanded executor run records **343 passing
checks and 24 failures**; all 24 failures also occur in the unchanged source and
come from missing image-guidance fixture keys in the same manuscript-independent
image artifact. The wider executor suite is not green. The test harness now honors
the explicit sibling-BFF test root for image/theme artifacts. No user image/voice
source or staged work was changed.

A cross-interpreter proof passes the actual BFF mapper, executor registration and
public-catalog models, protected BFF reader and profile resolver. Six fictional
models over four engines retain their IDs, revisions, public metadata, endpoints,
payer modes and effective settings/null prices. All 29 compatible resolutions and
50 expected incompatibility refusals remain identical, including a streaming-only
writer. This is synthetic compatibility evidence, not an inventory or migration
of deployed targets or actual published profiles.

**Next:** verify/provision the actual public target/model/profile identities, then
switch catalog consumers together; preserve frozen legacy routing and model
parameter/format behavior. Both-service SQL/domain/ledger acceptance, interrupted
continuation/concurrency, stop/terminal settlement, retention, Studio lifecycle and
source-bound refine/apply/undo remain open. Remaining D1/D2 acceptance and all
D4–D6 stay in scope. This checkpoint made no database connection/write, provider
request, reset, reseed, cleanup, feature installation or service restart. Recovered
records, including valid records without files, remain protected.


## D3 shared catalog cutover preparation — 2026-10-17

**Prepared source only; the running feature, schema and executor configuration
remain uninstalled.** All prepared BFF catalog consumers now use the protected
project catalog for profile selection, preview and fresh execution. Legacy public
discovery is available only through the explicit provisioning/export helper and
is never fallback. The older execution renderer still used by other workflows
checks the frozen route revision and mapped platform connection before accessing
credentials. A changed route fails instead of silently rerouting an old request.

A read-only live inventory found **9 profiles, 15 revisions and 45 role
references**. The three models of the configured provider match the app snapshot
and every live public descriptor for that provider; no additional usable model is
hidden by the prepared catalog. An explicit private provisioning bundle preserves
their target/model keys, revisions, evidence, endpoints and payer modes. The
executor validates the bundle before DDL. **206 profile resolutions** across all
saved revisions remain identical. This role-compatibility proof omits
provider_options and assumes available connections; it does not close provider
formatting, authenticated runtime access or actual credit/usage settlement.

Registration recognizes an exact committed replay without updating rows. Changed
routes, model snapshots, evidence, aliases, blocked targets and revoked grants
are refused. Real MySQL checks in the retained isolated schema preserved all
**1,617 prior rows across 37 tables**, verified lost commit acknowledgement and
concurrent single creation, and left newly-created fixture revocations/blocks in
place. Only three new synthetic fixture targets and their owned records were
added; no project content or deployed catalog records were written or removed.

The complete BFF unit scope has **14,970 passes and the same 17 baseline failures**,
with no new failure IDs, three skips and four deselections. Database integration
fixtures and live-provider tests were excluded. The focused assistant/profile
scope passes 1,768 checks. The executor scope has **413 passes and the same 24
verified unchanged-source image-guidance fixture failures**. Neither full backend
release is green.
Existing published profiles, original upstream sources and unrelated staged
image/voice work remain preserved.

The live CLI preflight rejected SQL writes and executed four SELECTs. It reports
the five new catalog tables absent, one target/connection planned and nothing
created/imported. The inspected executor env file has inference disabled, no
trusted-client/custody entries, and the existing provider credential reference
present. Running-process overrides were not inspected; this is not a live
configuration/activation claim. No credential values were copied into a bundle,
table, profile or source archive.

**Next:** provider-specific parameter/format parity and shared inline/chat execution;
reviewed additive provisioning and coordinated source/config activation; both-service
SQL/domain/ledger acceptance, interrupted continuation and fenced execution claims;
stop/terminal usage and retention/erasure; Studio lifecycle and source/context/pin-bound
refine/apply/undo. Remaining D1/D2 acceptance and all D4–D6 remain required. No reset,
reseed, orphan/file cleanup, paid provider call, dependency reinstall or service
restart occurred. Recovered content and valid missing-file records remain protected.


## D3 provider-format preparation — 2026-10-17

**Prepared only; the running source/schema/config remain unchanged.** Executor
admission and private SDK formatting now mirror the BFF's existing model rules:
Claude default-sampling combinations, forced-tool normalization and OpenRouter
Haiku's explicit thinking-off representation. Existing official GPT-6 Responses
and Google fixed-sampling behavior is normalized before intermediate payload
guards. These are wire transformations; saved profiles, plans, graph hashes,
source text and tool schemas are not rewritten. No model/adapter is rediscovered
from an alias. The execution-owned binding checks engine, approved route and
endpoint before payload formatting; Google's existing root normalization remains
valid. Unused capabilities still allocate no SDK and resolve no key.

All **45 saved role configurations across 15 revisions / 9 profiles** were
compared through the actual BFF renderer, legacy SDK serializers, executor
admission and private SDK serializers. Provider controls, messages and schemas
match. Nine revisions contain the standard ephemeral cache setting: SQL returned
only counts/shape flags, and all 27 corresponding role options remain exact.
Explicit private extensions are `store=false`, stream usage inclusion and the
executor's pre-existing default Claude cache policy. This comparison performs
no provider/model request and does not prove remote provider acceptance.

**218 SDK checks, 35 scoped agent checks and 103 focused executor checks passed.**
The policy mirror compares model-name variants, sampling combinations, tool
choices and gateway boundaries. The expanded executor scope has **432 passes
and the same 24 image-guidance fixture failures**. The small agent scope excludes
its unrelated root test-support fixture; no full agent/backend release pass is
claimed. BFF runtime source is unchanged since its prior 14,970-pass / 17-baseline-
failure unit run; that complete scope was not repeated for these SDK/API changes.

**28 protected HTTP/native MySQL cases passed** in the retained isolated schema:
OpenAI Chat Completions/Responses, Anthropic and Google, both payer modes and both
outer stream modes, plus Claude sampling/reasoning/tool-format variants. They use
actual admission, SQL catalog/native storage and compiled BFF novel packets;
authentication/identity and provider HTTP are controlled. Each execution performs
one fake provider operation with one usage fact, keyless completed replay, exact
source/plan retention and credential retirement. No quoted template expression
is evaluated. Cohere remains the existing plain-writer contract; no tool support
is invented. This does not qualify BFF domain/credit settlement or paid providers.

**Next:** shared inline/chat execution preserving streaming-only writing profiles;
both-service SQL/domain/ledger acceptance, interrupted continuation/fenced claims,
stop/terminal usage and retention/erasure races; Studio source/context/pin-bound
refine/apply/undo and lifecycle handoff. Reviewed additive provisioning, delegated
trust/custody configuration and coordinated activation remain pending. Other native
model/parameter combinations still need their own evidence before being advertised
as qualified. D1/D2 acceptance and all D4–D6 remain in the full 136-capability scope.
No project data write, reset, reseed, file cleanup, paid provider call, dependency
installation or service restart occurred. Recovered records, including valid
records without physical files, remain preserved.


## D3 shared inline execution preparation — 2026-10-17

**Prepared only; feature source, schema/config and the running service remain
unchanged.** Fresh inline writing and novel-assistant turns now share protected
transport, execution ownership and retained-result recovery. Writing profiles
still require only chat/streaming. A digest-verified five-node/four-edge JSON
artifact supplies the plain writer. The BFF inserts the compiled manuscript into
the existing v3 artifact's fixed wrapper once, preserving exact system/user text,
UTF-16 cursor context, trace and base/scene/chapter revisions. No parser, tools,
Python, inner graph, hook or fetch executes quoted manuscript text.

The frozen plan exclusively owns sampling and provider controls. Executor
validation permits only the reviewed plain graph and one literal user input.
Unknown versions in this graph family cannot fall back to the legacy key-bearing
renderer. Already-retained v3 graphs and plan serialization remain unchanged.
Both inline writing and assistant turns use the same uncertainty-preserving
lifecycle: a lost/aborted dispatch or failed domain commit retains the original
plan and ledger. Unit checks cover keyless completed reconciliation and exact
version/key requirements for continuation. Native interrupted continuation,
concurrent SQL claims and both-service settlement are still separate gates.

**20 protected HTTP/native MySQL cases passed** across OpenAI Chat Completions,
Responses, Anthropic, Google and Cohere, both payer modes and both outer stream
modes. These use compiled BFF packets, real SQL catalog/admission/native runtime/
storage and controlled identity/provider HTTP. Each execution records one fake
provider operation and one usage fact, with exact source/plan retention, keyless
completed replay and retired credentials. All **4,248 prior fixture rows across
37 tables** remain exact. No fixture was deleted. A Gemini adapter regression
was fixed so early text chunks can precede usage metadata; final counts survive.

Validation: **220 SDK checks passed**. The complete BFF unit scope has
**14,994 passes and the same 17 baseline failures**; the expanded executor
scope has **492 passes and the same 24 image-guidance baseline failures**. Both
have zero new failures/errors after updating the reviewed artifact inventory and
protected HTTP fixtures. This is not a full backend release pass, paid-provider
acceptance, BFF SQL settlement or author-usefulness evidence.

**Next:** retained both-service SQL/domain/credit qualification, native interrupted
continuation and fenced claims; stop/terminal usage and retention/erasure races;
Studio source/context/pin-bound refine/apply/undo and lifecycle handoff. Existing
story SQL fixtures still describe legacy transport/refund behavior and need this
migration; their auto-dropping socket harness was not run. Coordinated additive
provisioning, trusted-client/custody configuration and activation remain pending.
D1/D2 acceptance and all D4–D6 stay in the full 136-capability objective. No project
data write, reset, reseed, file cleanup, paid provider call, dependency installation
or service restart occurred. Recovered records, including records without files,
remain preserved.


## D3 inline candidate and credit recovery preparation — 2026-10-17

**Prepared only; the feature remains uninstalled.** Real BFF and executor SQL
now qualify inline candidate/credit reconciliation through the protected HTTP
path. The final 32 cases cover normal completion, lost replies, candidate-insert
rollback, lost commit acknowledgement, cancellation during commit, six concurrent
keyless recovery attempts, later author edits and domain-validation failure.
Both payer modes and both outer stream modes are covered. Identity and provider
HTTP are controlled; admission, profiles/catalog, native execution/storage,
candidates, quotas and credit ledgers use their actual MySQL implementations.

Each case leaves one candidate and one native usage fact from one fake model
operation. Recovery adds no debit, quota use or provider call. BYOK changes no
financial records. Platform admission keeps its one original credit reservation.
Plans/payloads stay exact, credentials retire, and later author writing survives;
stale candidates retain their original base revision. Concurrent completed-result
reconciliation uses the original SQL claim and never inserts a second candidate.
This does not qualify native partial/resumable-provider continuation.

The native rejection case exposed a real prepared-path bug: after a confirmed
model response, local validation could mark the BFF plan failed/released and
refund its credit while the executor retained a completed result and usage fact.
The lifecycle now retains the original plan/ledger before safety checks,
validation, projection and persistence. **Ten regressions failed before this fix**
and pass afterward for both inline and assistant workflows. No installed service
or project data contained this new prepared-path change.

The legacy story SQL fixtures now use the protected versioned protocol and expect
uncertain work to remain recoverable. Their new opt-in harness accepts connection
settings without a database name, creates a random isolated schema and retains
it on success or failure. **All 16 migrated SQL cases passed.** The BFF complete
unit scope has **15,004 passes and the same 17 baseline failures**, with no new
failures/errors. The final native run preserved all **10,880 prior
upstream-fixture rows across 37 tables** exactly. Every test schema/record is
retained. The temporary loopback worker shut down gracefully; the project API
and database were not changed.

**Next D3:** both-service SQL qualification of assistant conversations/proposals;
source/context/pin-bound Studio refine/apply/undo and lifecycle handoff; native
interrupted continuation and fenced resumable claims; stop/terminal usage,
late/unknown physical effects and retention/erasure races. Coordinated additive
provisioning, delegated trust/custody configuration and activation remain pending.
D1/D2 acceptance and all D4–D6 remain in the full 136-capability objective. No paid
provider call, project test write, reset, reseed, project-file cleanup, dependency
installation or project-service restart occurred.


## D3 assistant turn and source-bound acceptance preparation — 2026-10-17

**Prepared only; conversation/proposal source and schema remain uninstalled.**
The assistant now passes 32 real BFF/executor SQL and HTTP cases: Ask/Suggest,
both payer modes, normal completion, lost replies, rolled-back terminal writes,
lost commit acknowledgement, cancellation during commit, concurrent keyless
recovery, later author writing and rejected completed output. Identity and
provider HTTP are controlled; catalog/profile admission, conversation/messages,
candidate/turn storage, quotas, financial ledgers and native execution use their
actual MySQL implementations. Ask stores no candidate. Suggest stores one
unapplied candidate atomically with its two messages and retained turn snapshot.
Recovery preserves the frozen sources/plan, original user-message identity and
financial/quota rows, with one fake model operation and native usage fact per
case. Concurrent completed-result reads create no additional candidate or debit.

This exposed a prepared handler mismatch: shared tool transport returns a
message/usage envelope, while the novel handler attempted to parse that envelope
as the message. The handler now consumes the actual projection and retains its
validated usage. Both transport regressions failed before the correction.

Native acceptance also reproduced stale-context application: novel context could
change while the target scene's text revision stayed the same. The prepared
scene writer now checks the original execution's frozen source packet under the
same novel lock and transaction as acceptance. Five stale-source regressions
failed before this guard. Eight real SQL acceptance cases verify current/stashed
acceptance; exact original receipt replay after later prose/context changes;
rejection after novel/scene metadata, context settings or Codex pin changes;
and existing archived-target/later-prose guards. Rejected acceptance leaves the
candidate, prose, checkpoints and receipts exact. No model or financial operation
is added. The retained packet, rather than chat display state, supplies the guard.

Validation: **44 focused checks; 15,018 complete-scope BFF unit passes plus the
same 17 baseline failures**, with no new failures/errors. The native fixture's
graceful shutdown preserved **13,312 prior rows across 37 tables**.
All synthetic schemas/records remain retained. Frontend, executor, Agents and SDK
source are unchanged in this checkpoint; their earlier results are carried
forward rather than reported as new runs.

**Next D3:** connect Studio's source-bound proposal handoff, refine/apply/undo
and lifecycle controls; align output-size contracts; qualify multi-turn/source/
profile/account/workspace and retention/erasure boundaries; native interrupted
continuation, fenced resumable claims and stop/terminal usage/ledger settlement.
Coordinated additive provisioning, delegated trust/custody configuration and
activation remain pending. D1/D2 acceptance and all D4–D6 remain in the full
136-capability objective. The project database, running API and application
source were not changed; only these owned status documents are installed. No
paid provider call, reset, reseed, application-file cleanup or dependency change
occurred.


## D3 Studio saved-suggestion handoff preparation — 2026-10-17

**Prepared only; feature source/schema/config remain uninstalled.** A saved
assistant suggestion now enters Studio's existing in-place review and revision-
checked acceptance queue. The handoff re-reads the owned index and live generation,
checks frozen source version, target revision/hash, proposal text/instruction/
selection and current candidate/stashed status, then passes the normal save and
selection barriers. The inspected evidence remains immutable; today's generation
status is read independently. Archived/read-only targets and unavailable or
changed sources are blocked. Staged suggestions make no new model request.

The target scene and its draft session must both be mounted at the checked saved
head. Exact canonical JSON and UTF-16 range checks protect rich text, mentions
and surrogate boundaries. Selection replacement, complete-scene replacement and
append—including an empty scene—remain decorations until explicit acceptance.
Accept uses the same draft queue and generation identity as inline writing;
decline preserves the manuscript, and stashed candidates can return to review.
Source/account/workspace/book changes, author input during reads and closed
inspectors fence late staging. Cancellation now reaches the scene read itself:
a before-failing regression proved that the former loader could navigate after
its review was closed. Cancelled reads preserve the current seed and allow a
later deliberate selection.

Three before-failing regressions also exposed an undo boundary: assigning new
block IDs after acceptance could create a second history event. Identity
normalization now occurs inside the accepted transaction. One undo restores the
exact original rich document and stable IDs for selection/scene/append changes.
Saved-review announcements name only available actions. Suggestion previews use
content height instead of inheriting the editor canvas minimum or typewriter
tail; the controlled one-line preview measures 33px while its canvas stays 560px.
Proposal controls and
failure feedback use the shared modal footer so long evidence remains scrollable
while decisions stay reachable; frozen inspectors disappear on owner changes.

Validation: **5,279 frontend tests passed, two skipped; 577 files passed and one
file skipped.** Production build, Storybook typecheck and targeted lint passed.
The final focused navigation/coordination scope passed 55 checks. Controlled
browser examples verified normal/stashed review, explicit acceptance, decline,
one-step undo, changed-source rejection, manuscript focus return, focus wrapping
and Escape restoration. At 320×740, the dialog and decision footer remain inside
the viewport. These fictional/local-callback examples do not establish signed-in
author, real-device, complete assistive-technology or model-quality acceptance.

Backend/executor/Agents/SDK code is unchanged from the preceding native SQL
checkpoint; those results are carried forward, not presented as new runs. The
temporary Storybook closed, its viewport override was reset, and package/lock
files remain exact. Installed application code, project schema/data, staged
patches and running API are preserved; only these owned status documents are
installed. No project CRUD, paid provider call, reset, reseed or application-file
cleanup occurred.

**Next D3:** implement real refine with an explicit retained-parent/source binding;
align output-size contracts; finish source-specific acceptance-conflict feedback
and recovery, shared inline/chat source policy/lineage, multi-turn/profile/owner/
lifecycle and retention/erasure acceptance, native partial/resumable continuation
and stop/terminal usage/ledger settlement. Coordinated additive schema/catalog/
trust/custody activation remains pending. Remaining D1/D2 gates and all D4–D6
stay within the original 136-capability objective; this checkpoint closes no phase.


## D3 novel reply size and commit boundary preparation — 2026-10-17

**Prepared and verified; feature source/schema/config remain uninstalled.** Novel
replies retain the declared 20,000-code-point answer and 120,000-code-point staged
proposal. The BFF now selects a novel-only tool contract from frozen admission:
2 MiB of serialized arguments and 4 MiB event/completion envelopes accommodate
escaped supplementary characters. Other assistant contracts retain their prior
bounds. The novel domain still checks the semantic limits, exact evidence and
author-selected target before persisting a candidate. The executor's live and
keyless retained-output projections now use the same 4 MiB bound only for the
validated frozen novel-assistant feature; corrupt retained envelopes fail closed.

The maximum-size native test also exposed two failures beyond the BFF. The
credential-output scanner copied an entire remaining string for each escaped
surrogate pair; bounded six-character lookahead preserves the original bytes
and echo/prefix protections. One controlled 1,680,104-character scan fell from
1.71 s to 0.11 s; this is not a general performance acceptance result. Cancellation
could also finish SQL while discarding the recorder's local receipt/version.
Native commits and lease renewals now join receipt consumption before exposing
cancellation. Three before-failing task/repeated-task/AnyIO regressions pass.
This does not close complete native partial-continuation, Stop or settlement.

Validation: **5,285 frontend tests passed, two skipped; production build,
Storybook typecheck and targeted lint passed.** The complete BFF scope has
**15,044 passes and the same 17 baseline failures**; the expanded executor scope
has **508 passes and the same 24 image-writer fixture failures**, with no new
failure IDs or errors. There are **225 SDK / 35 scoped Agent passes**, plus 175
focused BFF and 128 focused executor passes. A concurrent frontend run exposed
one unrelated attestation timing failure; the full unchanged-source rerun passed.

Eight real two-service SQL cases cover Ask/Suggest × both payers × normal/lost
reply at the declared Unicode sizes. Each has one fake operation and one native
usage fact; keyless recovery adds no operation/quota/debit, and Ask creates no
candidate. A 1.3 MiB fictional public response passes strict frontend and split-
UTF-8 SSE parsing. The size matrix uses separately published 60-second fixture
profiles and a 90-second test transport; product timeouts were not widened.
Earlier 15-second-profile and 20-second-transport interruption trials are retained
separately. One pre-fix stuck test worker needed forced exit; an independent
read-only audit preserved all 17,026 prior rows. The final worker closed cleanly
and preserved all 17,558 prior rows across 37 executor-fixture tables. No test
schema or failed-trial record was removed. No real provider call, project CRUD,
reset, reseed, application-file cleanup, installation or project restart occurred.

**Next:** real refinement with an explicit retained parent and current-source
binding; source-specific acceptance-conflict recovery and shared inline/chat
lineage; native interrupted/concurrent continuation, Stop/terminal settlement,
retention/erasure and author/lifecycle acceptance; coordinated additive schema/
catalog/trust/custody activation. Remaining D1/D2 gates and all D4–D6 retain the
original 136-capability scope. This checkpoint closes no phase or release gate.


## D3 retained-parent refinement preparation — 2026-10-17

**Prepared and verified; feature source/schema/config remain uninstalled.** A
saved candidate or stashed writing generation can become explicit refinement
input. The provider-free reader returns its exact output/instruction, original
target/revision/range hash and one parent-generation lineage pointer. The author
request carries only generation ID and immutable parent hash; fresh preview and
admission reread the owned parent under the novel lock. Status/timestamps do not
change that hash. Terminal, foreign, corrupt or changed parents cannot admit a
new execution. The normal unrefined request and historical record shapes remain
unchanged.

The new prompt includes the full retained writing as protected literal input,
independently of prunable chat history, alongside freshly compiled saved sources
and the author's new instruction. Parent text is never truncated to fit a
profile. A stale base can be refined against a newer current scene; selections
must be freshly validated and never widen automatically. Inline `continue`
parents require append; other parents use the reviewed selection/scene. The new
candidate has a distinct execution identity and current-source base, preserves
the parent and changes no canonical prose. Frozen recovery uses the admitted
parent/source packet even after later parent rejection or independent writing.

Studio's saved-suggestion inspector adds Refine. It retains unsent text and
profile choices, shows the prior writing separately from current sources,
requires a new prompt review and returns focus to the composer after selection
or removal. Scoped device drafts retain the exact inspected parent while pending
requests freeze only its reference. Late/aborted reads cannot overwrite newer
input. The additive public record retains explicit lineage; it does not copy
recursive ancestor bundles.

Validation: **5,297 frontend passes, two skips; production build, Storybook
typecheck and targeted lint pass.** The complete BFF unit scope has **15,065
passes and the same 17 baseline failures**, without new failure IDs/errors;
88 focused BFF checks pass. A captured native SQL record passes the frontend
guard. Executor/Agent/SDK sources are hash-identical to the preceding checkpoint;
their earlier qualified checks were carried forward, not rerun.

Ten real two-service SQL cases cover both payers across normal/chained refine,
newer saved text with lost-reply/keyless recovery after parent rejection, inline
append parents, freshly recaptured selections and terminal rejection before
admission. They verify owned book/workspace reads, exact literal provider input,
stable hashes after stash, distinct child identities, preserved prose and no
recovery operation/quota/debit. Including the short smoke, 23 fake operations
each produced one native usage fact. The worker exited cleanly and preserved
all **18,270 prior rows across 37 executor-fixture tables**. Synthetic records and
schemas are retained. Controlled desktop/320px browser checks verify retained
input, exact-parent reading, review gating, footer reachability, Escape and focus.
They do not establish authenticated author/device/assistive or model quality.

**Next:** source-specific acceptance-conflict feedback/recovery; complete shared
inline/chat UI and source/lineage behavior; native interruption/concurrent resume,
Stop/terminal settlement, retention/erasure and owner/profile/lifecycle acceptance;
coordinated additive schema/catalog/trust/custody activation. Assisted planning/
summaries/canon, remaining D1/D2 gates and all D4–D6 retain the original
136-capability scope. No real provider call, project CRUD/reset/reseed, file
cleanup, feature installation or project restart occurred.

The read-only project audit verifies 3,401 unrelated source files, the existing
API PID/health and the unchanged 112-table / 157-FK schema. The frontend staged
patch differs from the original staging baseline; its cause is not established.
The original hash is retained, the current staged patch/index entries have a
private verified snapshot, and no Git entries were rewritten. The backend and
upstream staged baselines still match. This staging drift is recorded explicitly
in the checkpoint rather than treated as an unchanged original patch.


## D3 application-conflict recovery preparation — 2026-10-17

**Prepared and verified; feature source/schema/config remain uninstalled.** A
definitely rejected application previously lost its generation identity and left
the proposed text as ordinary dirty writing. The queue now retains a strict
`applicationRejection` record with the original candidate/request/revision,
approved document/edit trace and typed reason. Confirmed source, manuscript,
candidate and lifecycle conflicts pause ordinary saves, including after later
typing and reload. An application cannot dispatch until its original intent is
durably journaled. Unsupported rejection metadata preserves readable writing
while preventing replay.

Only recognized domain errors/statuses from the server's receipt-first branch
prove rejection. A later auth, routing, validation, rate-limit or transport error
cannot prove an earlier uncertain request failed: its original generation intent
remains pending, and later typing cannot replace it or cause an ordinary save.
Permission failures pause automatic attempts; explicit recovery uses the same
request. The confirmed-error notice distinguishes changed sources/context from
changed prose/candidate/lifecycle. The source-check handoff also reports a source
conflict to the saved-evidence inspector while leaving Refine available.

The comparison reads current owned account writing and shows it separately from
the device version, including later edits; the exact rejected submission stays
inspectable. It does not offer an ordinary save/merge of that rejected candidate.
Returning to account writing requires a verified separate device copy retaining
the application identity. Storage failure or changed review leaves the original
blocked draft intact. Saved comparisons, retained copies and their downloads
keep the rejection metadata; exact retirement preserves other/newer writers.
The saved server candidate is unchanged and remains available for refinement.

Validation: **5,311 frontend passes, two skips; production build, Storybook
typecheck and targeted lint of 27 files pass.** There are 120 focused passes before
the final status-pair guard, which is covered by the full final run. Five original
regressions failed before the change. Controlled desktop/320px browser review
verifies the separate versions, source-specific explanation, exact submission,
reachable account choice and focus return. Fifteen native browser checks verify
LocalStorage checkpoint and retained-copy recovery plus IndexedDB comparison
identity/isolation; synthetic browser records are retained and none are removed.

All **155 prepared backend/executor/Agent/SDK source entries** match the previous
checkpoint, so its qualified SQL and backend checks are carried forward, not
rerun. The 17 BFF and 24 executor baseline failures remain. No project mutation or model
request, project CRUD/reset/reseed, file cleanup, feature installation or project
restart occurred. Frontend and backend staged patches differ from their original baselines;
the cause is not established. Both current patches/index entries are privately
captured without rewriting Git, while all 3,401 unrelated source hashes match.

**Next:** complete shared inline/chat UI, source policy and lineage, including
refinement entry from inline history and reviewed author-edited variants; native
interruption/concurrent resume, Stop/terminal settlement, retention/erasure and
owner/profile/lifecycle acceptance; coordinated additive schema/catalog/trust/
custody activation. Assisted planning/summaries/canon, remaining D1/D2 gates and
all D4–D6 retain the original 136-capability scope. This closes no phase or release.


## D3 inline-history refinement preparation — 2026-10-17

**Prepared and verified; feature source/schema/config remain uninstalled.** Full
generation history now offers Refine for candidate/stashed writing. It reads the
owned retained-parent projection and full generation detail again, checking the
inspected identity, original command/instruction/output/range and active target.
Critiques, terminal statuses and known inactive targets stay readable without
this action. Refreshed archive/Trash location also survives merging a cached
full result, so a local cache cannot discard that lifecycle signal.

One retained assistant model is mounted per owned novel scope. The handoff keeps
the unsent instruction, conversation and public profile selection, selects the
prior writing as explicit context, invalidates the old prompt review, closes
history only on success and focuses the composer. It creates no conversation or
model request by itself. A fresh saved-source/profile/target review and explicit
Send remain required; accepting new manuscript writing is still separate.

Continue remains an append target. An unranged rewrite keeps its scene target;
any original non-null range remains a selected passage, even when it covered the
whole original scene. Its quote/UTF-16 offsets are proven against the exact
immutable base checkpoint and hash. The reader never searches for a repeated
quote, truncates a long target, or silently widens a failed selection. The author
can explicitly select current text in the same scene: the existing save barrier
and saved-document/token/quote checks capture that fresh revision first. Missing,
changed, or over-bound original selections stay readable in history and require
an explicit current passage/target choice before further review.

Owner changes, aborted reads, closed inspectors, later draft input, read-only
transitions and uncertain active turns cannot overwrite the retained draft or
open a late handoff. A failed selection keeps the complete original writing,
Copy and explicit Retry, with guidance to refresh status or select current text.
The parent context uses the existing strict reference contract; no backend wire
or project schema change is introduced by this UI work.

Validation: **5,363 frontend passes / 582 passing files, two skipped tests in one
skipped file; 133 focused passes / nine files.** Production build and Storybook
typecheck pass. Twenty changed TypeScript files have no new lint errors: the 19
feature/test files are clear and the shared API file retains exactly its 41
existing errors, compared with the preceding verified source archive. The known
large-bundle build warning remains part of performance acceptance. An earlier
full run hit an unchanged interaction-test observation timing failure; its
component/test hashes match baseline and all 69 tests pass in isolation. The
failed log is retained alongside the final verification.

Nine controlled browser checks cover full original reads, unsent instruction and
profile retention, exact prior writing, composer focus, fresh-review gating,
selected-passage scope/quote, and failed-handoff recovery. At 320×720 the document
has no horizontal overflow and both failed-handoff actions remain reachable.
These stories exercise the production history reader/target loader and assistant
view with fictional local callbacks; the assistant model is controlled. The
production hook and final cached-location guard are covered by the final tests.
This is not authenticated-author, real-device, assistive-technology or provider
quality evidence.

All 155 prepared backend/executor/Agent/SDK entries remain unchanged, so their
qualified SQL and runtime evidence is carried forward without rerunning it. The
17 BFF and 24 executor baseline failures remain. This checkpoint makes no project
test CRUD, model request, reset/reseed, file cleanup, feature installation or
project restart. The temporary Storybook worker exited cleanly and its port is
closed. Existing frontend/backend staging drift remains separately recorded;
the current private snapshots are preserved without rewriting Git.

**Next:** reviewed author-edited variants and complete shared inline/chat source
policy/lineage; detailed changed-source comparison; native interruption/concurrent
resume, Stop/terminal settlement, retention/erasure and owner/profile/lifecycle
acceptance; coordinated additive schema/catalog/trust/custody activation.
Assisted planning/summaries/canon, remaining D1/D2 catalog/performance/offline/
device/retention/accessibility/author gates and all D4–D6 retain the original
136-capability scope. This closes no phase or release.


## D3 author-variant backend and application preparation — 2026-10-17

**Prepared and verified; feature source/schema/config remain uninstalled.**
Authored versions now have separate immutable records and IDs for the version,
original model generation, reviewed operation, creation request and application
request. Preview is provider-free. The digest binds the full original parent,
base scene, final rich document and exact nullable annotation mapping. The
original model output is never replaced with the author's edits.

Strict owned APIs cover preview, receipt-first creation, full reads, bounded
metadata history, stash/reject and exact request-result recovery. Current-base
candidate/stashed parents and their existing execution/source policy are required
again before an application. One explicit whole-scene snapshot is supported by
this slice. Automatic rebase, terminal-parent reuse, reusable insertion and
multi-scene/dependency operations remain open requirements.

The existing atomic scene writer accepts the version ID/hash and the exact
reviewed JSON/mapping. Scene prose, revision lineage, original-generation and
version application statuses, statistics and receipt commit together. The editor
uses a decoration until explicit acceptance, without parsing the edited version
through Markdown or changing reviewed block IDs. Acceptance is one isolated undo
event; redo restores the same JSON. Closing this review retains the saved version
and original generation; explicit rejection remains a separate version decision.

API guards accept native SQL fixtures and reject foreign targets, authority,
identity reuse, inconsistent status/lineage and changed operation mappings.
Pending applications retain the exact reference/document/mapping/request through
offline/reload and transport uncertainty. A definite receipt-first rejection is
kept separately from later typing, comparison choices and retained device copies;
it cannot fall through to automatic ordinary saves. Existing baseline APIs and
non-versioned checkpoints remain readable. Novel-erasure review now counts
variants and binds their digest/lifecycle heads; frontend/backend activation of
that strict preview extension must be coordinated.

Prepared schema **`2026_10_novel_variants`: 113 tables / 159 foreign keys**.
Its three-step additive upgrade starts from the exact 112-table/158-FK assistant
predecessor. The assistant upgrade retains its own six-step frozen contract;
each stage requires a fresh verified private backup. A retained synthetic MySQL
fixture preserved all **59 original content rows across 112 predecessor tables**,
verified replay/hash/status conflicts and injected late rollback, and converged
four concurrent identical accept calls on one applied revision. Three authored
versions, the original generation, other alternatives and unrelated sentinel
writing remain present. Erasure preview ran; erasure did not.

Validation: **5,403 frontend passes / 584 files, two skipped tests in one file;
118 focused passes / ten files; build and Storybook typecheck pass**. All 31
changed TypeScript files have no new lint errors; the shared API's 41 baseline
errors match the preceding archive after accounting for inserted lines. Full
BFF: **15,131 passes, 17 unchanged failing test IDs, three skips/four deselected**.
The failed sandbox frontend attempt retained 5,400 passes and three unchanged Git
subprocess `EPERM` failures; the native rerun above passed completely. Earlier
focused domain/schema/native-helper logs remain qualified separately.

Native variant SQL used an inline candidate without a provider plan. It does
**not** qualify the assistant-execution source path, paid model quality, all
interruption/settlement/lifecycle races, actual-author or accessibility acceptance.
The 69 prepared executor/Agent/SDK entries are unchanged and their prior qualified
checks are carried forward; the 24 executor baseline failures remain. No current
browser or authoring-dialog evidence is claimed.

The installed API/source/schema are preserved: project marker remains
`2026_10_novel_erase` (112 tables / 157 FKs). There was no project test CRUD,
provider call, reset/reseed, file cleanup, Git write, feature installation or API
restart. Existing frontend/backend staging drift remains recorded against both
the original hashes and current private snapshots, without rewriting the index.

**Next:** implement the private author-editing dialog, retained creation/decision
journals and receipt-first UI recovery, discoverable saved versions, and the
source-checked Studio handoff from inline history/chat. Finish source policy and
detailed changed-source comparison; native interruption/concurrent resume, Stop,
terminal settlement, retention/erasure and owner/profile/lifecycle acceptance;
coordinated additive schema/catalog/trust/custody activation. Assisted planning,
summaries/canon, remaining D1/D2 catalog/performance/offline/device/retention/
accessibility/author gates and all D4–D6 retain the full 136-capability scope.


## D3 private authoring and saved-version UI preparation — 2026-10-17

**Prepared and verified; feature source/schema/config remain uninstalled.**
Original model output, saved authored versions and private writing have separate
readers and identities. The private rich editor preserves the source manuscript;
range-based seeds require the exact saved quote and UTF-16 boundaries. Unsupported
seeds require deliberate whole-scene authoring. Saving a version does not apply
it. A fresh source check and the normal Studio save barrier precede a decoration;
only explicit acceptance changes the manuscript, in one undoable event.

Private journals retain independent writers, later typing, exact reviewed intent
and frozen creation/decision requests. Receipt lookup precedes any identical
retry. Definite source/candidate refusals remain separately recoverable rather
than becoming ordinary saves; uncertain, corrupt or unauthorized responses keep
the pending request intact. Storage failure blocks remote mutation and unsafe
navigation; private JSON remains downloadable. Read-only access retains original,
private and saved-version readers. Mutability follows the original generation's
scene and ancestors independently of the currently selected editor. That final
Studio guard has unit coverage; the browser checks do not qualify the full
authenticated Studio lifecycle.

The dialog has a bounded editor, persistent review/save/recovery feedback, named
actions and English/Spanish copy. Version metadata loads in bounded pages. The
controlled browser exercised thirteen checks, including later-edit invalidation,
reload retention, separate original output, source refusal without lost input,
explicit apply/undo, read-only controls and 320×720 reflow/reachable review. It
uses production UI over a fictional in-memory transport with opaque test hashes;
it is not native HTTP, real-device, assistive-technology or actual-author evidence.

Validation: **5,466 frontend passes / 590 files, two skipped tests in one file;
133 focused passes / eleven files; build and Storybook typecheck pass**. All
thirty changed TypeScript files pass targeted lint. The unchanged shared API
retains its 41 baseline lint errors. The 166 preceding backend/runtime source
entries are hash-identical and two prepared backend guides were updated. Their
prior qualified checks are carried: BFF **15,131 passes / 17 same failing IDs**;
executor **508 passes / 24 baseline failures**; SDK 225 and Agents 35 passes.
These suites and native SQL were not rerun for this UI-only checkpoint. The
earlier retained native variant proof still qualifies an inline parent without a
provider plan, not an assistant-execution-backed authored version.

**Next:** qualify assistant-backed authored versions against native storage;
complete reviewed source/rebase policy, authored refinement, reusable insertion
and dependency groups; finish interruption/Stop/settlement and multi-turn,
profile/owner/workspace, retention/erasure acceptance. Shared-device/root-lifecycle
recovery and storage ceilings remain open. Reviewed additive upgrades, catalog,
delegated trust/custody configuration and coordinated installation remain open.
Assisted planning/summaries/canon, D1/D2 catalog/context/performance/offline/device/
retention/accessibility/author gates and all D4–D6 retain the full 136-capability
scope. This closes no phase or release.

The project remains at `2026_10_novel_erase` (112 tables / 157 foreign keys).
This preparation made no project test write, provider request, reset/reseed,
cleanup, feature installation, Git write or API restart. Existing staging drift
remains recorded against original and current private snapshots. The owned
Storybook preview was stopped and its browser tab/viewport cleaned up.


## D3 native assistant-authored version qualification — 2026-10-17

**Prepared source remains uninstalled.** The retained assistant-plan origin is now
qualified through native BFF/MySQL admission, completion, version storage and
explicit application. Two fresh, retained synthetic schemas passed exact
`2026_10_novel_variants` verification (113 tables / 159 foreign keys). Fictional
Ask/Suggest replies pass the production completion parser; no upstream executor
or provider was called. This closes the earlier native BFF assistant-parent gap,
not the broader upstream execution/settlement or source-policy requirements.

Each case retains three independent authored versions and the original model
result. Four identical concurrent creates and decisions replay the same receipts;
four identical accepts converge on one revision with the original generation ID
and authored version ID. Unreviewed document/mapping changes reject without a
write. A failure injected after the application receipt rolls back every table,
including prose, checkpoint and both statuses. Separate candidate/rejected
alternatives and original model text remain unchanged. Archived roots retain
exact creation/application receipts and full saved-version readers.

A metadata-only source change leaves scene text/revision intact but blocks fresh
preview, creation and application with `STORY_ASSISTANT_SOURCE_CHANGED`. All 113
table fingerprints remain unchanged by those refusals. Known receipts and all
private/version writing remain readable. Version creation changes only its table
and operation receipts. All **52 execution, credit, quota and related table
fingerprints** remain unchanged during version operations in both cases.

Reproduce with prepared BFF `scripts/smoke_novel_assistant_variants.py`. It only
allocates new uniquely named synthetic schemas and retains them. An initial
outdated smoke fixture passed a raw message to a handler requiring the strict
message/usage envelope; the fixture now runs the production transport parser.
That diagnostic schema/log and preceding successful fixtures remain retained.

Frontend validation: **5,473 passes / 591 files, two skipped tests in one file;
13 native-wire contract passes / two files; build and Storybook typecheck pass**.
The new test file passes lint; the thirty previously qualified changed TypeScript
files are hash-identical. The shared API retains 41 baseline lint errors. All 165
preceding backend/upstream entries outside the changed smoke helper and two
guides are unchanged. Prior BFF **15,131 passes / 17 same failing IDs**, executor
**508 / 24 baseline failures**, SDK 225 and Agents 35 are carried without reruns.
Native returned version/decision/history payloads pass the actual frontend guards.

**Remaining:** full reviewed source/rebase and terminal-parent policy, authored
refinement, reusable insertion/dependency groups, device/root retention,
multi-turn/profile/owner/workspace and erasure races; upstream interrupted-provider
resume, Stop, late effects and terminal usage/ledger settlement. Reviewed additive
upgrades, trusted-client/custody/catalog configuration and coordinated activation
remain pending. Assisted planning/summaries/canon, D1/D2 acceptance and all D4–D6
retain the full 136-capability scope. No phase or release is complete.

No project test CRUD, provider request, reset/reseed, cleanup, Git write, feature
installation or API restart occurred. Recovered content, current novels and
records without files remain protected; the installed project schema stays at
`2026_10_novel_erase` (112 tables / 157 foreign keys).


## D3 private author-version device recovery — 2026-10-17

**Prepared and verified; source/schema/config remain uninstalled.** The device
library now lists this account/API origin's private authored-version writers
independently of confirmed manuscript caches and remote generation reads.
Canonical keys must agree with the stored novel/generation/workspace identities.
Exact selection never substitutes a neighbouring writer. Invalid matching data
is retained and downloadable in an unverified diagnostic envelope that preserves
even malformed UTF-16 without granting replay authority. Legacy drafts remain
readable; optional protected-default-workspace hints never enter remote intent.

Inspection and original-model/base readers are separate from continuing a
private copy. Continuing durably creates another scoped writer before editing;
it keeps the original copy, frozen uncertain request, prior refusal, model parent
and later text independently. No account write, AI execution or implicit apply
occurs. Quota failures retain the last keystroke in memory and expose download;
close/navigation guards require retention. The account return is explicit,
online and workspace-bound, refreshes ownership and never synchronizes writing
automatically. Retired-owner callbacks cannot complete navigation.

Existing monotonic workspace and novel/unit lifecycle storage governs local
editing. Newer archive/Trash pauses editing, older active observations cannot
unlock it, and newer restore permits continuation. Missing/ambiguous/unavailable
lifecycle stays read-only. An observed erased root cannot be revived by restore;
its private writing remains readable/downloadable. Default-only mode hides
other-workspace input, including an already open inspection. Studio exposes a
recovery entry and passes the exact chosen writer into its existing private
editor; fresh source review and normal explicit manuscript acceptance remain
mandatory. Existing application/creation/decision recovery identities are kept.

Validation: **5,500 frontend passes / 594 files, two skipped tests in one file;
91 focused passes / nine files; build and Storybook typecheck pass**. All eighteen
changed TypeScript files pass lint with no new warnings; the two remaining
warnings match the prior archive. A native browser fixture exercised fourteen
checks using actual browser journals/lifecycle storage and no manuscript cache:
separate writers, reload, archive/older-state/newer-restore, novel Trash and erased
readers, separate model output and 320×720 reflow/action access. A long action
label overflowed its card initially; wrapping and focused-heading scrolling
corrected it. The final measured phone view has no horizontal overflow. The
fixture's erased marker only writes fictional browser metadata; no server erase
or deletion occurred.

The browser proof covers valid drafts. A later equivalent memo-factory lint fix
does not change the flow; lossless malformed-data export is covered separately
by an actual Blob/FileReader test. No native account/HTTP synchronization,
screen-reader, virtual-keyboard, real-device or actual-author claim follows.
The 8,300,000-character journal format bound is not a browser capacity guarantee;
lower browser quotas fail visibly without eviction. All 170 preceding BFF/
executor/Agent/SDK entries are hash-identical. Their native BFF qualification and
**15,131 BFF passes / 17 baseline failures**, executor **508 / 24 baseline
failures**, SDK 225 and Agents 35 remain carried without reruns.

**Remaining:** complete reviewed source/rebase and terminal-parent policy,
authored refinement, reusable insertion/dependency groups, native account/lifecycle
races, upstream interruption/Stop/late effects/terminal settlement; capacity,
retention, browser eviction and general logout/shared-device acceptance. Reviewed
additive upgrades, catalog/trust/custody configuration and coordinated activation
remain pending. Assisted planning/summaries/canon, remaining D1/D2 gates and all
D4–D6 retain the full 136-capability scope. No phase or release is complete.

The temporary preview and its tab were closed and the viewport reset. No project
database write, provider request, reset/reseed, file cleanup, Git write, feature
installation or API restart occurred. Existing records without files remain
valid. The installed schema remains `2026_10_novel_erase` (112 tables / 157 FKs).


## D3 saved authored-version refinement — 2026-10-17

**Prepared and verified; source remains uninstalled.** A saved author-edited
version can now become explicit quoted input for another AI suggestion. The
request carries both the original generation/hash and exact version ID/hash.
The server rereads the owned immutable version and its original-model binding;
null/changed authored references cannot fall back to model output. The chosen
canonical document is projected into the refinement prompt, while complete
finite original/version provenance remains in frozen execution metadata. Input
limits fail before admission without dropping the chosen writing.

Candidate, stashed, accepted and rejected writing can be quoted as a source.
This is a source-only terminal policy: old candidate/stashed and exact-base
requirements still govern version creation/application. An authored version is
a whole-scene quotation even when its original command was Continue. The new
proposal replaces the currently reviewed scene or explicit current passage; it
does not append the whole version or reuse old selection/application coordinates.
Its execution/generation identity and current manuscript base remain independent
from the original generation, authored version and authored operation.

Studio stages the exact saved version in the retained assistant draft without
sending, replacing an unsent instruction/profile choice or applying prose.
Separate readers show authored input and original model output. History details
expose a small owned frozen `refinementSource` reference, with an explicit source
reader; no execution payload is exposed. Existing generation-only wire records
and bounded history summaries retain their shapes. This extension adds no new
schema revision beyond the prepared variants schema.

The complete source remains in scoped drafts/downloads and pending requests
freeze its exact reference. Storage failure keeps writing in memory, blocks
dispatch/resume and unsafe navigation, and permits a storage retry. The
integration test caught and corrected an older adapter that dropped the authored
reference. Owner/abort/read-only changes fence late selection and UI handoff.

Validation: **5,531 frontend passes / 597 files, two skipped tests in one file;
107 focused frontend passes / eight files; 96 focused BFF passes; production
build and Storybook typecheck pass.** All 37 changed TypeScript files pass lint
with no errors or new warnings; the changed dialog retains one existing warning.
The full BFF suite has **15,150 passes, the exact same 17 baseline failing IDs,
three skips and four deselections**. All 69 prepared upstream entries remain
hash-identical; executor 508 / 24 baseline failures, SDK 225 and Agents 35 are
carried without reruns. These known failures and performance gates remain open.

The native BFF smoke retained a new synthetic database,
`magic_worlds_novel_assistrefine_test_76462af81e03`, with all 113 tables verified.
It performs Ask/Suggest, creates and explicitly accepts an authored version,
then refines that accepted source against the newer saved scene. Twelve checks
cover distinct execution/current revision, unchanged original/version/prose,
owned history lineage, wrong-hash and changed-source refusals before admission,
and exact keyless recovery without new operation/accounting writes. Late
completion rollback and 113-table read-only-preview checks also pass. Two earlier
diagnostic databases are retained; no cleanup/reset occurred. Output is fictional
and parsed through production completion handling; no upstream/provider request
or model-quality qualification is claimed.

Eight native-browser fixture checks cover distinct source selection, separate
readers, retained instruction, unchanged manuscript and 320×720 access/reflow.
The phone action is 44 pixels high and reachable inside the viewport, with no
horizontal overflow or console errors. This controlled transport is in memory;
native assistant/account HTTP, real devices, keyboard/assistive-technology and
actual-author acceptance are still open. Initial sandbox restrictions blocked
Git-read tests and stalled an owned test process; corrected process/socket
permissions completed the suites. The temporary UI tab/viewport/server are closed.

**Remaining:** full reviewed source/rebase and reusable insertion/dependency
groups; native account/profile/owner/workspace/erasure races; upstream provider
interruption/fenced resume, Stop, late effects and terminal usage/ledger settlement;
capacity/retention/eviction/shared-device/logout/author/accessibility acceptance.
Reviewed additive upgrades, catalog/trust/custody configuration and coordinated
activation remain pending. Assisted planning/summaries/canon, remaining D1/D2
gates and all D4–D6 retain the full 136-capability objective. No phase or release
is complete.

Recovered non-novel content, current novels, missing-file records, actual source
and staging remain preserved. No project test write, provider request, source
installation or API restart occurred. The running project retains
`2026_10_novel_erase` (112 tables / 157 FKs).


## D3 durable Stop and terminal accounting — 2026-10-17

**Backend/executor behavior is prepared and qualified; browser integration and
installation remain pending.** Explicit Stop now has an owned novel request
receipt. A connection loss continues to preserve recoverable work. Stop before
admission prevents that same request from later consuming quota or creating an
execution. For an admitted turn, the original project/domain/account locks fence
its lease, close its conversation guard and release capacity. Original input and
source snapshots remain. A success committed before Stop is returned unchanged;
a later provider response cannot publish a candidate after Stop wins.

The protected executor adds a credential-free versioned Stop endpoint. It either
cancels the retained native execution or records a pre-snapshot admission fence.
Service, project and user ownership are rechecked without resolving a current
profile or provider key. A missing historical snapshot blocks future dispatch but
does not prove that earlier work was free. Terminal observations carry bounded
numeric usage, physical-attempt counts and an integrity digest. Unknown facts stay
unknown; late confirmed usage changes accounting evidence without restoring a
lease, output or execution authority.

A separate typed receipt in the existing novel operation-receipt table records
local termination and settlement. The successful execution-result column remains
success-only, and this extension changes no schema. Proven undispatched work
releases quota and refunds the original platform charge exactly once. Confirmed
consumed work keeps its original charge; uncertainty retains a pending settlement.
An older concurrent observation cannot erase newer confirmed facts. Failed or
cancelled native recovery closes the original domain turn without a new execution,
provider dispatch, quota increment or debit. Repeated terminal reconciliation
preserves the original reason/status. Pending settlement or incomplete usage
protects the conversation and erasure review from deleting the required evidence.

Validation: **461 focused BFF checks pass**. The full BFF suite
has **15,185 passes, the exact same 17 baseline failing IDs, three skips
and four deselections**. Prepared executor workflow/protocol checks have
**529 passes and the same 24 existing image-writer failures**, with no new
failure IDs or setup errors. Frontend implementation is hash-unchanged from the
previous 5,531-pass/build/Storybook checkpoint; those results are carried rather
than rerun. Existing suite failures remain release work.

Eighteen cases run through real BFF/executor HTTP and SQL with controlled provider
responses in retained `mw_novel_domain_it_e4078456079f4d7c87244675e16ad887` and
`mw_novel_exec_it_667fc96dd1a14cf2a553eb5c69e49093`. Both payer modes cover Stop before admission,
before dispatch, before the native snapshot, before a provider attempt, during a
provider response, after a lost Stop reply, before local completion, after committed
completion, and failed-provider reconciliation. Cases verify exact credit/quota
deltas, repeated Stop, rejected workspace/body input, disabled dispatch/key removal,
late usage, unchanged manuscript/input, no late candidate and pending-accounting
conversation protection. Erasure qualification uses the production SQL preview
compiler with a synthetic Trash view; no user erasure is performed. Native fixture
preservation checks retain its nine prior rows across 36 tables, including the
missing-file marker. Earlier diagnostic schemas are retained.

**Remaining:** persist and recover the browser Stop intent, extend strict client
response guards and show stopping/stopped/usage-pending states; qualify UI reload,
account and navigation races. Full native partial continuation/concurrent resume,
source/rebase and reusable insertion/dependency groups, broader account/profile/
workspace transfer/erasure races, retention/storage/shared-device/accessibility/
author acceptance, assisted planning/summaries/canon and coordinated activation
remain required. Remaining D1/D2 gates and all D4–D6 keep the full 136-capability
scope. No phase or release is complete.

The project API remains healthy at its original PID and the project database stays
at `2026_10_novel_erase` (112 tables / 157 FKs). Recovered non-novel content, current
novels, valid missing-file records, source and existing staging remain preserved.
There were no project database writes, real provider calls, feature installations,
dependency changes, API restarts, Git writes or file/media cleanup.


## D3 browser Stop and retained recovery — 2026-10-17

**Prepared and verified; feature source remains uninstalled.** Novel Stop now
saves intent against the original pending request before aborting the browser
stream. Explicit Stop is separate from closing the drawer or losing its connection.
The new scoped client checks the bound novel and current account before sending an
empty Stop body; no profile resolution, provider key or new request identity is
introduced. Strict response guards distinguish running work, committed success,
confirmed termination, unconfirmed upstream Stop and incomplete usage. They reject
foreign request/novel bindings, extra fields, invalid totals and invented zero use.

The device journal keeps the complete original message/source/profile intent and
an optional Stop flag/terminal observation. Lost replies, close/reopen, remount,
read-only transitions and account retirement retain or safely ignore the original
request. Stopped/terminal work cannot use Resume. Checking a retained Stop or late
usage calls the same Stop identity; it never dispatches another generation. Only
a qualified complete outcome retires the active pending request. Its message and
refinement sources survive, and a fresh reviewed prompt is required for new work.
A completion that won before Stop remains a saved reply, with no implicit proposal
application or claim that it was cancelled.

Storage failure keeps the Stop intent in RAM and blocks sending it until a device
save succeeds. The UI explicitly says Stop has not been sent; it does not present
a local disconnect as a confirmed server Stop. Pending Stop/accounting journals
cannot be discarded without a qualified outcome for the same conversation/request.
A recovered copy may provide that proof for deliberate removal of the original;
exact-content retirement still protects later edits and other writers. Recovery
never silently deletes another writer's draft.

The drawer uses existing controls and English/Spanish copy for Stop pending,
stopped, failed, pending usage, confirmed usage and unused/refunded work. The
composer keeps next-question text. Stopped work exposes status/usage checks in
place of Resume; the live conversation head is reloaded without replacing newer
history with an old frozen result.

Validation: **5,587 frontend passes / 600 files, two skipped tests in one file;
production build and Storybook typecheck pass.** Seventy-four focused checks cover
the contract, journal, hook and controls; the full suite also includes the later
read-only and drawer-close regressions. All 20 changed TypeScript files have zero
new lint findings. The shared API module retains its same 41 existing `any` errors,
verified against its previous archived bytes; the other changed files are clean.
All 187 prepared backend/upstream source entries are hash-unchanged, so the prior
15,185 BFF passes / 17 baseline failures, 529 executor passes / 24 baseline failures
and 18 controlled two-service SQL cases are carried without rerunning them.

A read-only pass through the retained synthetic BFF reconciler exported 18 actual
public states to `novelAssistantStopNative.json`. Frontend guards accept each,
including uncertain snapshot/failure usage and completed replies. No project DB
was selected for that export, and no provider or mutation was invoked. Native
browser inspection uses the production drawer view with a controlled in-memory
model: the next question survives Stop and usage confirmation, Resume disappears,
and Tab/Enter reaches and activates Check usage. At 320×720 that action is 44 pixels
high and inside the viewport, with zero horizontal overflow or console errors.
Screenshots are retained; viewport/tab/server cleanup is verified. This is not an
authenticated browser-to-BFF/provider test, real-device test or complete keyboard/
assistive-technology/author acceptance.

**Remaining:** qualify the authenticated browser/BFF Stop lifecycle; audit ordinary
completed-output replay when usage is missing/partial; finish native partial
continuation/concurrent resume and broader account/profile/workspace-transfer/
erasure/retention policy. Full source/rebase, reusable insertion/dependencies,
planning/summaries/canon, storage/shared-device/accessibility/author acceptance and
coordinated installation/activation remain required. Remaining D1/D2 gates and all
D4–D6 retain the full 136-capability goal; no phase or release is complete.

Recovered non-novel content, current novels, valid missing-file records, actual
source and existing staging remain preserved. The original API is healthy and the
project schema remains `2026_10_novel_erase` (112 tables / 157 FKs). No project data
writes, real provider calls, dependency changes, Git writes, API restart, feature
installation, or media/file cleanup occurred.
