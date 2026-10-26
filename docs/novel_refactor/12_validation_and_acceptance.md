# Validation, evaluations, and acceptance

**Source/lifecycle and deep cleanup review:** 2026-10-15. **Status:** Open release gates; see [Gate status — audit 2026-10-18](#gate-status--audit-2026-10-18). The historical October 14 record reports 211 focused tests. The subsequent deep review passed 221 frontend tests and 290 backend unit/mock-contract tests, as recorded in [01](01_current_state_and_evidence.md#deep-migration-and-cleanup-revalidation--2026-10-15). Product implementation/validation remains open. Database migration validation now follows the lean development-reset checks below; the former production rollout/backfill matrix is superseded. Novel rollout is disabled in the example configuration and enabled in the dated local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

**UI/UX acceptance update:** 2026-10-15. The UX-01–UX-12 matrix below translates the [demo findings and interaction contracts](06_ui_ux_and_accessibility.md) into planned release checks. Passing prototype assertions does not complete those checks in the application.

**Database preservation correction:** 2026-10-16. Preserve recovered non-novel content and current novels; whole-database resets are disabled. Use scoped schema changes with a verified backup, the three short DEV checks and relevant product tests, without a production rollout program.

## Gate status — audit 2026-10-18

Which release gates have recorded evidence today. The detail is in [14 — Release gates](14_status_and_roadmap.md#release-gates).

| Gate | Evidence recorded | Missing |
|---|---|---|
| Availability (grant on/off) | Per-plan grant `novels`; live signed-in journeys 2026-10-17/18 | Auth-expiry, missing-profile and archived-workspace runs; any deployed evidence |
| Defect regressions (NE) | D1 set passes in the checkout | NE-017 has none; NE-010, 016, 018, 020, 023 partial |
| DEV-01–03 per upgrade | A verified backup and unchanged-row fingerprints for every schema upgrade through `2026_10_novel_export_jobs` | Migration-chain tests green again on 2026-10-20 (the chain now reverses the later revisions); isolated-copy rehearsal recorded only for statistics, bookmarks and erase |
| Test suites | Frontend 5,848 passed (75 failures, all outside novels); BFF novel scope 1,661 passed, 0 failed (2026-10-20) | A clean full BFF run (see [14](14_status_and_roadmap.md#p0-fixes--2026-10-20)) |
| Performance | Development build: p95 key latency 40 ms, save about 76 ms, heap stable over 60 scene switches on 1,500 scenes | Production build, CPU throttling, low-end devices, phones, 500/2,000 Codex entries, large libraries; timeline and matrix render every scene |
| Screen reader | **None** | Everything |
| Keyboard-only journey | Per-feature checks only | Write → revise → undo → recover without a mouse |
| Contrast, zoom, text spacing, forced colors | **None measured** | Everything (the 2.1:1 status hints were fixed on 2026-10-20) |
| Device matrix | 320×720 dialogs, 375 px, 1,030 and 1,600 px windows | 768/1024/1440 px, a real phone, IME and mobile keyboard |
| Offline | Cold offline app, reconnect, device lifecycle (controlled browsers) | Cross-browser and mobile eviction |
| Retention | **None** | Needs decisions 5 and 6 |
| Export validation | SHA-256 manifests; LibreOffice conversions; strict XML parse and browser render for EPUB | EPUBCheck (needs approval to download), Microsoft Word, e-readers, output accessibility |
| AI evaluation | Retrieval policy evaluation (`evaluate_story_retrieval.py`) | Human scoring; flashback, unreliable-narrator and hostile-research fixtures; the intermittent invalid result |
| Failure drills | Stop, lost-turn and offline drills (live) | BFF restart during an export job; provider timeout and quota exhaustion |
| Author acceptance (UX-12) | **None** | A study (decision 13) |

## Evidence already collected

The 2026-10-14 documentation review reran `pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts`: **27 frontend test files and 211 tests passed in 6.52 seconds**. Ten prior controlled check results are preserved in [01](01_current_state_and_evidence.md); those fixtures were not rerun and are not part of the pass count. Their current source mechanisms were rechecked. This sub-review does not claim a full application build, backend integration test, live model evaluation, performance benchmark, or accessibility certification. No roadmap phase is accepted by this test result alone.

On 2026-10-15, the separate [HTML demo](novel-studio-demo.html) passed **26 scripted assertions** in a temporary jsdom run, including exact accepted-edit undo, stale-proposal blocking, structure operations, sample recovery, reopening browser storage, and exclusion of unaccepted text from export. Dialog/download behavior used doubles; this script is not a retained regression fixture. Browser inspection covered the default size, 390px phone width, and 1440px desktop width, including acceptance/undo and planning navigation. The final 390px page-width check found no horizontal overflow. These are prototype checks, not real-device, 320px, zoom, screen-reader, or full-app-shell evidence.

`pnpm build` also passed during demo creation, with the chunk-size warning. The demo is outside the application bundle, so that pass establishes application build compatibility, not execution or integration of the proposed UI. AI responses, account synchronization, context counts, and recovery scenarios in the demo are simulated. The earlier UI/UX documentation reconciliation did not rerun the product suite or close NE findings.

The subsequent deep migration/cleanup review ran the source-focused checks listed in [01](01_current_state_and_evidence.md#deep-migration-and-cleanup-revalidation--2026-10-15): **28 frontend files / 221 tests passed (2.84s)** and **7 BFF files / 290 tests passed (6.11s)**. The initial frontend command also discovered a nested checkout and failed there; the scoped rerun explicitly excluded `.claude/**`. These passing checks cover the present foundation, exact-schema verifier and existing migration pattern. They are historical baseline results, not a reason to rerun those suites for documentation edits or add migration-preservation tests.

## Availability and release validation

Verify a user whose plan grants `novels` and one whose plan does not (since 2026-10-18 the frontend `VITE_FEATURE_NOVELS_ENABLED` variable is gone; access comes from `GET /user/me/features` and the membership plan). Without the grant, navigation entries must be hidden, direct story/gallery routes must follow the documented disabled-page behavior, and frontend story methods must reject before network work. With exact `true`, verify gallery → create → editor → generate → review → save → reopen against the BFF, including archived workspace, authentication expiry, missing profile, and offline/error recovery. A test account's grant and component tests are insufficient to mark the feature shipped. If the product adopts a WIP placeholder, document and test that intentional router change; current source renders Not Found.

For development, use the matching current frontend/BFF and seeded schema. No cohort/version compatibility matrix is required. Keep public release readiness distinct from this authorized test-DB reset; [14](14_status_and_roadmap.md) records feature status.

## Defect regression matrix

The NE/UX/AI tables are a feature backlog: choose checks for product behavior changed by the implementation slice. They do not require rerunning every suite for each scoped schema change.

| Finding | Test scenario | Required result |
|---|---|---|
| NE-001 | Delay/reorder save responses; manual Save while saving; two clients | Stale write rejected; displayed revision only marked saved after its acknowledgement |
| NE-002 | Accept/reject/regenerate rewrite across paragraphs, lists, marks, mentions | Undo restores exact original; redo restores accepted variant; no duplicated or resurrected candidate |
| NE-003 | Fail body save, lose acceptance response, retry | No false accepted/saved claim; recover same operation without duplicating content |
| NE-004 | Ctrl/Cmd+Z in pending/reviewing/idle | Pending cancellation and reviewing rejection match documented behavior; ordinary history works when idle |
| NE-005 | Continue at chapter beginning/middle/end and in flashback | Correct insertion scope and surrounding context; no ending continuation inserted into unrelated position |
| NE-006 | Select second repeated sentence; normalize whitespace; select formatted fragments | Exact target identity and quote; correct mapped offsets or explicit unsupported mapping |
| NE-007 | Turkish dotted I, combining marks, mixed scripts and repeated replace-all | Original positions preserved; only intended text changes |
| NE-008 | Equal names, renamed/removed entry, paste/duplicate/split/merge | Stable ID preserved or explicit unresolved reference; no silent relinking |
| NE-009 | Beat comments, headings, notes, Latin/CJK/Thai prose | Prose-only, documented locale-aware count; annotations excluded |
| NE-010 | Links, lists, hard breaks, comments, images, footnotes, unsupported nodes | Preserve supported content; explicit conversion report and recoverable source for losses |
| NE-011 | Whole-story style and changed context toggles | Trace exactly matches selected prompt sources/revisions; past and prospective values labeled |
| NE-012 | Input near cap in multiple scripts and with large Codex | Budget enforced with output reservation; deterministic exclusions or explicit failure |
| NE-013/014 | Crash/reload offline; restore old revision; trash parent/child | Recover latest supported checkpoint and retain previous content/history |
| NE-019 | Tab through review; edit an unrelated passage | No accidental acceptance; focus and author intent preserved |
| NE-020 | Reload rejected/regenerated/custom requests | Exact allowlisted prompt/provenance retained; no credential leakage |
| NE-022 | Blank/invalid title; rejected metadata save; rapid title edits | Visible value reconciled or retained as unsaved with actionable error |

## Chapter/novel contracts

Test novel and scene creation, duplicate/fork, insert-before/after, reorder, cross-parent move, split, merge, archive, trash/restore and bulk operations. Assert exact text, stable identity, ordering, source pins, comments, generation history, and resulting revision vector.

Exercise concurrent reorder, missing/deleted parents, duplicate IDs, cycles, invalid owner/workspace, last remaining scene, and archived workspace. Verify keyboard/menu operations reach the same result as drag. A restore must not erase later unrelated prose edits. A new series version must not silently alter prior novels.

## Document and API tests

- Validate node/mark allowlists, unknown schema versions, nesting/body limits, canonical hashing and reference ownership.
- Verify revision CAS and idempotency with real database transactions and more than one connection.
- Test manual editing and changeset application through the same domain service.
- Test partial acceptance dependency closure and atomic failure across affected resources.
- Reconcile dropped streams and commit responses using retained IDs; repeated requests do not regenerate or duplicate application.
- Verify request/profile/graph/context provenance and source revision freezing.
- Remove obsolete callers/writers and check the current document contract. Old-client support and production rollout matrices are unnecessary in development; subsequent schema changes must preserve installed novels and recovered non-novel content through the scoped workflow in [15](15_database_migration_and_legacy_cleanup.md).
- Validate smaller list/save DTOs and paginated history without changing authorization.

Scale checks to the slice actually changed. Reuse meaningful existing regressions; add a focused test only for a new failure mode. After application implementation, run the relevant targeted tests and `pnpm build`; run `pnpm typecheck:stories` only when stories change. For a database reset, use the three lean checks below instead of adding a large migration suite. Documentation-only edits need link/consistency checks, not another application test run.

## Database migration and cleanup acceptance

**Current preservation rule:** the user required recovery of all non-novel content after the earlier full resets. [15](15_database_migration_and_legacy_cleanup.md) now requires a verified backup and scoped schema changes that preserve recovered content and current novels. Whole-database resets are disabled. The earlier DB-01–DB-18 production matrix remains retired.

Use three short checks for each scoped schema change. One smoke script or manual flow can cover them; no new test framework is needed.

| Check | Minimal action | Expected result |
|---|---|---|
| DEV-01 · Schema and preservation | Verify a private backup, rehearse the scoped change in an isolated copy, then apply it to the identified project DB | Exact schema/marker/seed verification succeeds; non-novel rows and current novels are preserved; unrelated databases/services are untouched |
| DEV-02 · Fresh-data flow | Seed one account/workspace and a small novel; create/edit/save/reopen it and exercise the scene/metadata action changed by the slice | Current data round-trips through the new model; the displayed saved revision matches persisted content |
| DEV-03 · Cleanup/current contract | Check obsolete callers/imports/routes and exercise the replacement path; for an AI slice, use a fixture to check acceptance writes once | No live legacy body/status writer remains; current enums/DTOs agree. Existing meaningful regressions can supply this evidence |

Do not add old-data conversion corpora, migration interruption/stress suites, mixed-version worker/client matrices, repeated full-suite runs, production observation thresholds or recovery support windows as prerequisites. If a smoke fails, repair the scoped change without resetting the project DB. Runtime CAS, undo, ownership, trash and AI correctness are checked when their implementation changes, rather than duplicated in a migration test program.

## Consolidated writing requirements

These are planned acceptance checks for details retained from the June 2026 storytelling brief (consolidated 2026-10-15), not new features or passing test results. Existing catalog IDs and D1–D6 assignments remain authoritative.

| Existing capabilities | Acceptance task | Required result |
|---|---|---|
| R11 / A11 / R12 · Reusable stash | Save manual clippings, an idea, critique notes, cut text, and two generated alternatives; filter/search by novel and scene; insert one twice and reopen | Source labels and available passage/revision/generation lineage remain. Explicit insertion targets the chosen revision, follows review/undo rules, and leaves the stash original intact. No drag-only action or silent acceptance |
| E14 / K02 / K03 / K10 · Mention/context inspection | Use duplicate names/aliases, a renamed pinned source, a recent reference, empty content, and a detected-but-excluded mention; inspect with pointer and keyboard | Stable references and explicit disambiguation survive. Active/pinned/recent choices are prioritized; detection alone does not include full content. Preview shows actual ordered sources, warnings, skips and estimates without executing generation |
| K01 / K03 / K05 / K10 / K11 / K14 · Precedence and spoilers | Change a library source behind a novel pin; contradict an automatic suggestion with explicit selection; compare scene drafting and an explicit future-revelation analysis | Approved novel state/pins are retained until reviewed update. Manual priority cannot bypass access or reveal policy. Scene drafting excludes future knowledge; analysis is labeled and does not leak its scope into later drafts. Trace equals execution |
| A18 / K04 / K11 / K12 / R07 / R12 · Editorial feedback | Extract a supported fact and an uncertain claim; edit one proposed field, reject another, select an authorized target, then change that target's version and retry application | Passage/revision, before/after and destination are visible. No prose action silently promotes facts or mutates a library. Stale acceptance is blocked; an approved independent selection applies the exact variant idempotently with evidence and revision provenance; other novels' pins remain unchanged |
| A20 / U11 · AI context disclosure | Start ordinary writing without AI, then inspect a request's context and applicable provider data policy | Writing remains usable. Shared content, execution route and verified retention/training policy are understandable before the request; no unsupported guarantee or fabricated token certainty |

## AI evaluation corpus

Use author-approved or synthetic manuscripts, with a frozen model/profile/graph version for each run. Include at least:

| Fixture | What it measures |
|---|---|
| Repeated passage and equal character names | Target and reference accuracy |
| Flashback plus future revelation | Narrative-time knowledge and spoiler handling |
| Item transfer, relationship shift and injury | Temporal canon and continuity |
| Deliberate unreliable narrator | Avoid treating all prose assertions as author-approved fact |
| Outline intentionally diverges from draft | Preserve discovery writing and expose disagreements |
| Character-specific dialogue/style samples | Voice adherence without flattening characters |
| Local edited target during model execution | Conflict detection and reviewed rebase |
| Missing canon evidence | Admit uncertainty instead of inventing facts |
| Long novel with relevant fact in beginning/middle/end | Retrieval/context-position sensitivity |
| English, Spanish, CJK, mixed scripts and RTL | Language behavior, token estimation and editing fidelity |
| Imported research containing hostile instructions | Source-as-data/tool authorization boundaries |
| Large multi-scene instruction | Bounded plan, progress, partial failure and reviewable results |

Compare focused-context single requests, validated drafting, bounded planner/writer/critic workflows, and retrieval with summaries against full-text context. Keep prompts and fixtures equivalent and account for all helper calls. No real provider call was made by this research.

## AI scoring and release criteria

Deterministic contracts are hard gates: correct resource/anchor, valid schema, allowed scope, enforced limits, no duplicate application, recoverable state, and correct revision acknowledgements.

Human evaluation assesses instruction adherence, continuity, usefulness, voice preservation, originality/appropriateness for genre, and author control. Reviewers should see anonymized alternatives where practical. Model critics supplement that process and need calibration against human decisions; they are not final literary judges.

Track task completion, retained edits after author revision, correction effort, accidental acceptance/rejection, latency, execution cost, and uncertainty accuracy. Acceptance rate or word volume alone cannot establish quality. Define thresholds per task and language after a pilot; this dossier sets no invented universal model ranking.

## UX and accessibility validation

Use automated accessibility checks plus keyboard, screen-reader and touch sessions. Cover editor, scene tree, slash/mention menu, inspector, review controls, changeset list, recovery dialog, revision history, and export flow.

Test 200% text enlargement and 400% browser zoom/reflow, mobile keyboards, long translations, user spacing overrides, reduced motion and forced/high-contrast modes. Text-spacing checks test tolerance of overrides rather than imposing those values as default styling. [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)

Use NVDA with a supported Windows browser and VoiceOver with Safari, supplemented by other supported combinations. Validate naming, active-option announcements, meaningful save/error state, focus return, toolbar/menu interaction and non-drag structure controls. [W3C dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

Recruit discovery writers, outline-first writers, experienced editors and assistive-technology users. Observe the essential author journeys in [06](06_ui_ux_and_accessibility.md). Record problems with comprehension, accidental commits, position loss, and recovery, not just satisfaction scores.

## UI/UX acceptance matrix

These are **planned application checks**, not results obtained from the standalone demo. Link each implementation change to its UX row and relevant NE regressions. Run cross-cutting focus, reflow, status, and draft-preservation checks again when a later phase changes their behavior.

| Work item | Acceptance task | Required result / evidence |
|---|---|---|
| UX-01 · Responsive workspace | Use 320, 390, 768, 1024, and 1440 CSS-pixel test widths; vary the app sidebar and studio panels; test 400% zoom at a suitable starting viewport and an actual mobile keyboard | Ordinary prose and essential controls remain accessible without page-level horizontal reading. Rails collapse before prose becomes cramped; narrow drawers do not stack above the manuscript. A matrix's necessary horizontal scrolling stays local. Record container dimensions and screenshots. |
| UX-02 · Reading hierarchy | Load fallback fonts, enlarge text to 200%, apply custom text spacing, change reading presets, and show long English/Spanish titles and status labels | No clipped prose, lost controls, essential micro-only labels, or text shrinking just to retain panels. Typography/width/spacing use registered tokens. Readability preferences survive view changes. |
| UX-03 · Review reachability | Compare long, multi-paragraph proposals at phone and short desktop heights; navigate by Tab through the comparison and decision controls | The author can identify target, original, proposed, and chosen operation. Controls stay reachable; fixed actions/notifications do not hide focused content. Narrow comparisons have a readable labeled alternative. No accidental acceptance occurs through focus navigation. |
| UX-04 · Saving and recovery | Delay acknowledgement, deny local storage, expire auth, interrupt a save, and reopen; let a success toast expire before seeking undo/history | Device and account states match the owning revision. Errors/field validation and recovery remain accessible after transient notices vanish. Both conflict texts remain available until a durable choice; copy/export still works where allowed. |
| UX-05 · Names and focus | Use keyboard and assistive technology through panel toggles, inspector tabs, dialogs, and overlays at both sides of each layout transition | Names survive hidden visual labels. A modal moves/contains focus and makes its background unavailable; a docked panel does not trap focus. Close/Escape and breakpoint collapse leave focus on a visible logical target. Active tab/panel associations are announced correctly. |
| UX-06 · Interaction continuity | Type an unsent assistant message and select the second repeated passage; switch scope/tab/view, toggle rails, receive a response, and resize | No composer text, caret/selection anchor, draft, proposal, or scene position is lost. The response retains its original request target. Reopening a panel restores the working state; a keyboard viewport resize does not silently discard a panel draft. |
| UX-07 · Structure discoverability | Without a tutorial or dragging, move a scene within/across chapters, split a formatted passage, archive/restore, then undo; inspect all planning views | Labeled click/tap controls and keyboard controls reach the same result. Structure identity, prose, references/history, and current scene remain intact. Reading order changes do not silently alter story time or rewrite prose. Observe whether authors find the actions unaided. |
| UX-08 · AI intent and scope | Ask a factual question, request an edit, change target while pending, refine/stash/reject, review a bounded plan, and independently accept its final proposals | Ask makes no edits; context matches execution; evidence and inference are distinct. Refine/rebase does not apply changes. Stale acceptance is blocked with an explanation. Stop/retry reconciles the real job. Dependency-safe batch scope and local/remote acceptance state are clear. |
| UX-09 · Memory and planning | Move a flashback, edit source prose, inspect a stale summary, follow a continuity citation and return, approve a fact, and review a series version update | Outline, summary, speculation, and approved canon remain distinguishable. Stale derived data is disclosed/excluded according to policy. POV knowledge does not follow a naive date/reading-position shortcut. Citations preserve the return position; prior version pins remain stable. |
| UX-10 · Delivery | Import supported/unsupported content, inspect losses, choose scenes/notes and an available format, edit after compilation starts, then cancel/retry an export | Source/loss report is retained before commit. Unsupported formats are explained rather than presented as working. Export identifies frozen inputs and exclusions. Progress and owned download reflect actual results; export never silently publishes. |
| UX-11 · First use and failures | Start with a blank novel and no Codex, then exercise loading, archived read-only, missing profile/quota, offline, provider error, and interrupted generation | Ordinary writing starts without required planning/AI setup. Retained content, restrictions, and a useful next action are explicit. Read-only access preserves allowed history/export. No fabricated progress or unbounded paid retry is introduced. |
| UX-12 · Author/accessibility validation | Run the essential author journeys with discovery/outline-first writers, an editor, and assistive-technology users, with English/Spanish copy and real-device input | Retain task observations, author explanations of target/context/save state, focus/contrast/zoom results, and mistakes. Any observed lost writing or unintended commit blocks that workflow's release. Define usefulness/efficiency thresholds after the pilot, not from prototype pass counts. |

Use browser assertions for state/identity/selection and accessible names, automated accessibility tooling for detectable violations, and manual keyboard/screen-reader/touch sessions for behavior they cannot establish. A keyboard-only alternative to a drag operation is insufficient for users who need click/tap controls. Review sticky controls against [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) and movement alternatives against [Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

An acceptance record identifies build/commit, browser/OS, actual studio dimensions, zoom/input/assistive technology, manuscript fixture, expected and actual result, retained evidence, and unresolved limitations. Recreate the temporary demo assertions as appropriate retained product regressions when implementing; the existing 211 tests and the 26 prototype assertions are distinct evidence sets.

## Performance and storage benchmarks

Proposed benchmark sizes are test fixtures, not current supported limits or measured results: 5k/25k/50k-word active documents; 100k/200k-word novels with many scenes; 500/2,000 Codex entries; large comment/history sets; a library with many novel summaries.

Measure transaction-to-paint latency, long tasks, selection/typing latency, serialization and decoration cost, React renders, heap growth, initial scene load, manuscript search, save latency and database query counts/plans. Test constrained hardware and CPU throttling, not only a development desktop.

Suggested initial engineering targets, subject to measured hardware/profile agreement: p95 ordinary local edit processing under 50ms for the representative active scene, no work proportional to the entire novel per keystroke, bounded save payload/query size, and stable memory after repeated scene switches. These are proposed acceptance targets, not claims about existing performance.

**Measured 2026-10-18 (development build, desktop):** on a 1,500-scene, 1.1-million-word novel, key latency is p50 24–32 ms and p95 40 ms in narrow and wide windows; nothing proportional to the whole novel runs per keystroke in the outline or planning drawer any more; the heap and DOM stayed stable over 60 scene switches; a scene switch is p95 134 ms; search answers in about 200 ms and a save in about 76 ms. The production build, CPU throttling and low-end devices were not measured, so no supported manuscript size is claimed. Details and before/after numbers: [large-manuscript performance](14_status_and_roadmap.md#d2-slice--large-manuscript-performance-2026-10-18).

## Failure and operational drills

Run airplane mode/reconnect, browser termination, IndexedDB denial/quota, expired authentication, account/workspace switch, workspace archive, target deletion, stale AI response, provider timeout, exhausted quota, service restart and cancellation mid-plan. Verify recoverable text and accurate job states.

For later development schema changes, use a verified backup, scoped upgrades and the short DEV checks above; preserve non-novel content and current novels. A production migration program is unnecessary. Test runtime reconnect/conflicts, local undo, stale AI targets and reviewed recovery when those behaviors change. Collaboration is out of scope; there are no coeditor, presence, invitation, or shared-review release gates. Export validation checks frozen input hashes, semantic EPUB structure, output accessibility, supported personal/AI review annotations, and PDF layout fixtures.

## Traceability and completion

Every catalog item needs a named acceptance task and evidence entry before being called delivered. Documentation checks establish link/structure quality only. Implemented, tested, user-validated and shipped are separate states; update evidence as those states are achieved.


## Execution evidence update — 2026-10-16

D1 retained regressions now exercise the previously controlled save ordering,
failed/atomic acceptance, rich replacement undo/redo and immediate next-typing
history, pending undo/cancel, repeated and Unicode range mapping, Unicode
Find/Replace, annotation-free/unspaced counts, recoverable local checkpoints,
quota/auth/workspace guards, concurrent MySQL CAS, manuscript restore and exact
application replay. Further review added journaling of ordinary edits during AI
review, remapping after a slow flush, multi-step target protection, late-history
isolation and restore-response races. Source links, current counts and actual
DB evidence are maintained in [14](14_status_and_roadmap.md) and [01](01_current_state_and_evidence.md#execution-evidence--2026-10-16).

Prepared D2 document/organization helper tests do not establish an integrated
scene workflow. The full UX matrix, assistive technology/contrast, real-device
keyboard, large-project measurements, author/model evaluation and D2–D6 gates
remain open. Existing Storybook fixtures provide limited reflow/focus evidence;
they are not live account persistence evidence.


**D2 integration checkpoint, 2026-10-16:** The earlier prepared-helper limitation
has been superseded by connected scene schema/API/editor/organization evidence.
The approved development DB uses `2026_10_novel_scenes`; actual MySQL smoke
checks canonical writes, CAS/replay, acceptance, history/undo, structure/lifecycle
and stable scoped references. This closes the slice's DEV startup/save/operation
checks, not every D2/catalog/UX gate. [01](01_current_state_and_evidence.md#d2-scene-integration-evidence--2026-10-16) records current commands and limits;
[14](14_status_and_roadmap.md#d2-scene-integration--2026-10-16) lists remaining work.


### D2 mutation recovery checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-mutation-recovery-evidence--2026-10-16)
adds exact metadata/goal/lifecycle/Codex retry, final-keystroke retention,
account/device field comparison, original summary revision pins, transferred
writer retirement, context-CAS batch rollback, immutable source pins, complete
reference heads and acknowledgement rejection. Actual MySQL smoke and its
frontend wire guard passed. Metadata summaries are never editable manuscripts.
This verifies those current paths. The copy checkpoint below adds whole-novel
copy/provenance evidence; the following checkpoints add creation recovery and
reviewed unit-copy choices. Remaining nested/undo/history/annotation/comment-copy contracts, measured size limits and D3–D6 still
require their matching acceptance evidence.

### D2 novel copy checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-novel-copy-evidence--2026-10-16)
verifies reviewed notes/Codex/lifecycle choices, exact rich prose with new
identities, immutable snapshot/version pins, frozen provenance and source
preservation. An isolated real MySQL/API smoke verifies all-or-nothing creation,
concurrent exact replay, stale-source/changed-intent and identity-collision
rejection, rollback and archived read recovery. No project database mutation or
schema change was required.

Frontend checks cover lost-response/reload recovery, original-intent retry,
owner/workspace isolation, explicit library opening, save/review barriers,
runtime acknowledgement/provenance guards and unverified summary pins. The
desktop Storybook dialog was inspected; full author, assistive-technology,
mobile, storage-policy and size acceptance remain open. This establishes the
local whole-novel copy slice, not named edition comparisons, complete unit-copy
options, all D2 gates or phase completion.

### D2 creation recovery checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-creation-recovery-evidence--2026-10-16)
verifies atomic creation/initial checkpoints/receipt, same-result concurrent
first requests, exact replay after later edits, changed-intent rejection,
collision rejection and rollback. Source reads stay on the owning transaction
cursor, including an actual pool-saturation fixture. The new isolated synthetic
database preserved the project database and required no schema change.

Frontend evidence covers journal-before-POST, reload/uncertain-response recovery
by receipt read, original-intent retry, confirmed-result retention when the
manuscript read fails, archived read recovery, stale-owner isolation, old-writer
adoption and device-storage failure. Recovery notices expose explicit Open novel
and the Studio save/review barrier. The controlled desktop dialog was inspected;
the general author, mobile/accessibility, storage-policy and size acceptance
gates remain open. D2 and D3–D6 are not complete.

### D2 unit copy options checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-unit-copy-options-evidence--2026-10-16)
verifies explicit notes/local Codex/archive/Trash choices, saved-source review,
source text/metadata/structure/context guards, new identities, exact rich prose,
independent goals, current/stale summary pins and stored-candidate separation.
Historical/current Codex pins coexist; required snapshots remain disabled and
readable when optional local context is excluded. Annotation/comment copy is
not yet implemented.

The isolated actual MySQL/API fixture verifies atomic copy/replay, stale-source
rejection, concurrent identical requests, late failure rollback, cross-novel
identity collision rejection and archived result reads. Frontend guards check
the complete acknowledged copy intent and fresh target identity. Reload and
post-acknowledgement read-failure recovery read the original result before POST;
missing results cannot create while archived. UI tests/browser fixtures verify
choices, changing counts, explicit refresh, frozen pending intent and save/review
barriers. Full author/mobile/accessibility, supported source-vector size,
annotation and remaining D2 history/undo acceptance stay open.


### D2 organization history checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-organization-history-evidence--2026-10-16)
verifies small cursor-paginated event summaries, action/date filters, owned
before/after reads and reviewed multi-step undo/redo. The transactional before-image
must include prose/metadata saves made after the preceding organization event.
Move undo/redo retains writing both before and after the move. Split/merge reversal
restores exact rich checkpoints under new heads; trusted history lineage permits
another undo/redo while independent affected edits remain blocked. Later unrelated
titles/notes/context survive; newly hidden units guard later author work.

The isolated HTTP/MySQL fixture verifies concurrent identical replay, changed
intent, stale reviewed heads, pending-candidate and relevant-reference rejection,
unrelated Codex preservation, late rollback, copied-root provenance, pagination,
filters and archived reads. Runtime guards validate actual page/detail/receipt
fixtures. UI checks cover both save/review barriers, immutable reviewed intent,
archived/pending restrictions, refreshed review after conflict, older read failure,
late-scope isolation, newer-manuscript refresh and readable older before-image-less
events. Browser inspection uses a desktop fixture. Named manuscript snapshots,
full scene-history/filter contracts, annotation/comment copy, further nested
acceptance, full author/mobile/accessibility and long-project measurement remain
open. D2 and D3–D6 are not complete.

### D2 named manuscript capture checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-named-manuscript-capture-evidence--2026-10-16)
verifies named capture, summary-only pagination, manifest comparison and exact
frozen scene/pin reads. Capturing must preserve canonical prose/metadata/context,
undo/redo heads and document lineage. Review binds the full saved source vector
and structure head; all scene checkpoints must exist before any event insert.
The manifest/hash, next event head and exact immutable receipt commit together.

The isolated real HTTP/MySQL fixture verifies concurrent replay, changed intent,
stale review, late rollback, original rich prose/notes/version pins after later
edits, capture between successive undo operations, pagination, archived reads
and foreign exclusion. Missing/corrupt checkpoints and future formats cannot
fall back to current content. Frontend guards validate actual wire fixtures;
UI checks include both save barriers, original pending intent, late scope changes,
current-head revalidation, refreshed review and unsent/over-limit input retention.
Controlled browser evidence includes review/capture and the saved/current reader.

**At this capture checkpoint, R04 remained partial:** reviewed in-place whole-manuscript restore still needed
explicit later-unit choices, stale-source checks, recoverable new revisions and
text/metadata/organization/context acceptance. Scene-history/filter, annotations,
nested/compound, author/mobile/accessibility and performance gates remain open.
No schema change or project database mutation was required. D2–D6 remain WIP
or planned; the 136-capability scope is unchanged.

### D2 manuscript restore checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-manuscript-restore-evidence--2026-10-16)
verifies a reviewed in-place restore across text, details, organization and context.
Options and source selectors must be exact; unselected categories remain intact.
Every later unit is reviewed. Keeping newer units cannot hide them through restored
ancestors; Trash cannot hide earlier writing inside a newer container. Text/notes
and history survive explicit later-unit Trash and undo.

The real isolated HTTP/MySQL fixture verifies new exact rich checkpoints,
metadata/goals/notes and original pin bodies/versions, context swaps, summary
revision mapping, concurrent exact replay, changed-intent/stale-source rejection,
late receipt rollback, owned archived review/recovery and pending-proposal guards.
Undo/redo restores full touched metadata, novel state and references while retaining
later unrelated notes/context/writing. Independent affected prose/pins block it.
Missing/corrupt checkpoints cannot substitute current content; new history hashes
also reject a self-consistent but altered older undo checkpoint.

Runtime guards verify actual review/receipt/history payloads and reject omitted
author changes, lost units, rewound heads and mismatched choices. UI checks cover
both barriers, exact single-flight intent, archived uncertain recovery, late-scope
reads, retained choices, refreshed review and recorded root/reference comparisons.
Controlled browser evidence includes exact notes/prose review and completion.
Broader scene-history/filter/retention, annotation, nested/compound, author/mobile/
accessibility and measured performance gates remain open. No phase or full-goal
completion is implied.

### D2 scene history checkpoint — 2026-10-16

[Current evidence](01_current_state_and_evidence.md#d2-scene-history-evidence--2026-10-16)
verifies bounded metadata pages and source/actor/date filters, owned verified
checkpoint details, original/current saved-text comparison, selected Unicode
excerpt copy/download and explicit scene-only restore review. Both barriers and
the final metadata-only head check precede a hash-bound request. Stale sources
require a refreshed review; unsupported/corrupt checkpoints cannot replace text.

Actual isolated HTTP/MySQL verification covers concurrent exact replay, current
and source hash guards, transaction rollback, current metadata preservation,
retained later writing, pending/stashed proposal guards, foreign scene rejection
and archived detail/receipt reads. The existing broader persistence smoke also
passes after adopting the reviewed restore contract. Neither writes to the
project database or changes its schema.

Frontend checks include actual smoke JSON through the runtime guards, durable
request-before-POST, reload receipt-first recovery, confirmed-but-unhydrated
recovery without another POST, stale hydration rejection, separate writer
retirement, device-storage failure, late scope isolation and stable scene/snapshot
sources through provider callback replacement. The focused relevant run passed
**494 tests / 76 files with one conditional fixture skipped**; the BFF run passed
**326 tests**. Build, Storybook typecheck and targeted lint passed.

Controlled desktop Storybook inspection verified the before/after review,
reachable confirmation and confirmed new checkpoint. Full author/mobile/
assistive-technology acceptance, annotation/comment copy, nested/compound context
cases, retention/offline guarantees and measured project-size limits remain open.
D2 and the full 136-capability D1–D6 goal remain incomplete.

## Link and typing acceptance — 2026-10-16

The [link/typing checkpoint](14_status_and_roadmap.md#d2-links-and-typing-preferences--2026-10-16)
has local regression, actual synthetic persistence and controlled desktop
evidence; full author/device/assistive-technology acceptance remains open.

| Case | Required outcome / local evidence |
|---|---|
| Guarded link edits | Freeze the editor/document/range. Preserve text, marks and block identity; reject stale/destroyed/foreign targets, review/recovery/read-only and over-limit output. Explicit removal keeps captions; one-step undo restores the old link. Regression and desktop checks pass |
| Paste URL retention | Preserve supported complete destinations and titles. Unsupported/relative/invalid metadata keeps destination and caption as text with feedback. Empty safe captions retain the URL. Actual paste pipeline → native HTTP/MySQL save/reopen agrees on JSON, projections and hash |
| Readable references | Token-styled link appearance, Ctrl/Cmd+K, pointer reader inspection, explicit opening/copying and honest unavailable-target guidance. Read-only editor announces its state and offers no writes. Controlled desktop and component checks pass |
| Typing choices | Quote style, punctuation and symbols operate independently; literal typing preserves typed characters. Recognized Spanish settings choose angle double quotes, unknown settings use the disclosed curly fallback and explicit overrides win. Existing text/paste and manual undo/selection/editor instance remain intact; regression and desktop checks pass |
| Device storage | Separate bounded reading/typing records under the existing owner/novel scope. Keep malformed/future data untouched; current-room settings survive unavailable storage; old-scope/unmounted setters are retired. Existing reading and new typing tests pass |
| Remaining work | Wider locale, mobile/zoom/font/author/assistive-technology acceptance; complete HTML/import/loss reporting; saved Codex reference keyboard/disambiguation and block movement remain open |

## Saved manuscript search acceptance — 2026-10-16

The [search checkpoint](14_status_and_roadmap.md#d2-manuscript-search-and-result-navigation--2026-10-16)
implements the saved search/navigation portion of S17. It does not close D2 or
the scoped replacement/bookmark requirements.

| Case | Required result / current evidence |
|---|---|
| Saved prose versus working material | Search saved canonical scene text/visible mention labels; exclude unsaved drafts, personal notes, current card contents and AI proposals. Actual owned read-only HTTP/MySQL smoke and source inspection pass |
| Unicode and literal query | Retain spaces/punctuation/newlines. Use actual native quote/codepoint/UTF-16 locations, including emoji and insensitive `ss` matching `ß`. Do not lower-case prose or reseek a nearby equal phrase. Native smoke and client/editor regressions pass |
| Source and pagination changes | An edited/moved/renamed/lifecycle/context source invalidates cursor/resolve. Query-mismatched cursors fail; no duplicate appended rows or navigation after conflict. Focused service/store/transport/drawer checks pass |
| Ownership and readers | No cross-account/workspace/path reads. Ancestor Trash excluded; archived sections opt-in, root lifecycle independent, archived workspaces readable. Actual synthetic MySQL checks pass |
| Draft/review protection | Flush current writing before resolving; preserve and explain unresolved AI review/recovery/conflict. Verify the exact canonical document before revealing. Late responses cannot navigate another room. Source/cache/drawer/editor checks pass; broader author acceptance remains |
| Exact visible passage | Navigate a later scene and a long document's final paragraph. Keep a collapsed caret, view-only highlight and manual undo; partial mention hits preserve their whole atom. Edits clear decorations. Desktop preview verified final passage and inserted `old ` beside `gate` rather than replacing it |
| Deferred scroll | Closing the drawer/status layout may require one guarded frame. User wheel/pointer/key/touch, changed selection/document/target, or an unmounted editor wins. Cancellation regression and live layout inspection pass |
| Bounded reads | Pages contain bounded excerpts; resolve hydrates one document projection without pretending omitted pins/history are empty. A stale full-tree cache may use its existing reader/revalidation. The synthetic 1,000-scene case is evidence only; complete memory/latency/query-plan/large-project acceptance remains open |
| Full S17 and release | Scoped replacement preview/bookmarks, mobile/zoom/font loading, keyboard/screen-reader app-shell workflows and author acceptance remain required future work |

## Saved-reference inspection checkpoint — 2026-10-16

| Check | Current local evidence |
|---|---|
| Equal names, nested matches and aliases | Overlapping detection identities retained; explicit source choice, searchable aliases/description/source/version and current/recent/pinned ranking |
| Saved pin identity | Exact ID survives rename/removal; unavailable identity is disclosed without matching another source by label |
| Keyboard and reader | Alt+Enter in writer and focusable reader; More action and reader pointer alternative; reader has no context write controls |
| Intentional context | No write during inspection/insertion; explicit selected-pin toggle uses current context revision; stale/outside/removed/overridden/review/reader cases refuse |
| Document preservation | Native TipTap and React tests compare actual documents before/after inspection; existing wire schema and save contract unchanged |
| Native desktop review | Duplicate source/version chooser; keyboard inclusion in synthetic state; reader removed-pin preview; second autocomplete choice reopens the selected version |
| Remaining acceptance | Full author, mobile/zoom/font/assistive-technology and large-project evaluation; wider context retrieval and remaining D2/D3–D6 gates |

Commands and qualification are in [01](01_current_state_and_evidence.md#d2-saved-reference-inspection-evidence--2026-10-16).

## Manuscript block movement checkpoint — 2026-10-16

| Check | Local evidence |
|---|---|
| Pointer/keyboard movement | Alt+Shift+Up/Down, reviewed sibling destination and click up/down; no drag required |
| Exact content and identity | Rich Unicode/marks/links/mentions, repeated paragraphs, nested items, quotations, breaks/beats and complete container selections retain node/reference IDs |
| Selection/history | Forward/reversed ranges and atom/container selections preserved; previous/later typing and successive moves undo independently |
| Canonical editor boundary | Only neutral ordered-list `type: null` removed; meaningful unsupported attributes rejected; selecting/moving/undoing final non-paragraph blocks adds no trailing prose |
| Guards/focus | Stale document/selection, reader/recovery/review, foreign/boundary targets refuse; focus returns after successful dialog movement and newer input cancels delayed focus |
| Persistence/notes | Actual frontend move/undo/redo JSON saved/reopened in a new retained synthetic database; note IDs/quotes, exact undo attachment recovery and later review text/resolution preserved; stale/replay checks do not move heads |
| Size fixture | 1,000 blocks / 200 moved with all nodes and selected points preserved; not a general latency or complete author acceptance result |
| Remaining | Wider author/mobile/zoom/font/assistive-technology/performance and other D2/D3–D6 gates |

Commands, native proof images and limits are in [01](01_current_state_and_evidence.md#d2-manuscript-block-movement-evidence--2026-10-16).


### Unit planning acceptance — 2026-10-16

- Save/reopen optional tags and ordered multiline beats on parts, chapters and scenes. Preserve Unicode, duplicate entries, order, summaries, personal notes, canonical prose/hash/revision and prior frozen manifest bytes.
- Recover unfinished/over-limit entries after inspector closure; block invalid network writes without losing draft text. Compare/rebase the changed list independently of later account tags, notes and other fields. Retry the original uncertain request; reject stale or mismatched acknowledgements.
- Add/edit/move/remove and immediately undo removal with named keyboard controls; focus the moved text. Reader/archive forms must not mutate. Lists allow 100 entries, tags 255 codepoints, beats 2,000; total metadata remains 100,000 UTF-8 JSON bytes.
- Carry plans through identity-free template creation and independent copies, including copies that exclude personal notes. Restore saved planning metadata as a new revision while retaining prose. Search unit tags and text after character 255 in a beat without expanding the root-only tag filter.

Focused automated and controlled desktop evidence is recorded in 01/14; full author/mobile/assistive-technology/performance/offline acceptance remains open.


### Continuous saved reading acceptance — 2026-10-16

- Read every visible scene in canonical manuscript order across page and chapter/part boundaries. Support novel/part/chapter/scene scopes, empty containers and archive opt-in; ancestor Trash always excludes content. Root/workspace archive stays read only.
- Keep the writing editor, unsent drafts, selection/scroll, recovery/review and undo independent of reader opening/scope changes. Persist only optional scoped device choices. Opening a writing scene must pass the save/review barrier, revalidate the exact source and preserve later input/closed-owner guards.
- Validate the exact public prose projection. Retain Unicode, rich marks, list starts, links, scene breaks and saved mention identities; hide planning instructions. Never pretend omitted author metadata/pins/history are empty. Read-only reference inspection must use the exact cached snapshot/context version or report unavailable.
- Load bounded source-bound batches continuously with a manual fallback. Reject stale/foreign/mismatched/duplicate continuations without replacing earlier loaded pages. Explicit refresh begins a new source; owner changes/unmount retire old requests.
- Compare actual HTTP/MySQL reader behavior with the frontend runtime guard. The 1,000-scene fixture must hydrate only two scene documents for its initial requested batch; read calls must preserve current manuscript/prose/metadata heads.

The initial controlled proof covers chapter loading, reference inspection and stale-source refresh. The later bounded-reader checkpoint adds DOM windowing and paragraph resume. The Studio loading checkpoint replaces initial full-tree loading. Upper resource limits, mobile/font/zoom/assistive-technology and author validation remain required gates.


## Reviewed replacement acceptance checkpoint — 2026-10-16

These checks support the installed literal replacement slice; they do not close
S17 bookmarks, full D2 acceptance or D3–D6. Commands, exact results and browser
images are recorded in [01](01_current_state_and_evidence.md#d2-reviewed-replacement-evidence--2026-10-16).

| Contract | Evidence and result |
|---|---|
| Exact native occurrence and Unicode quote | Fresh isolated HTTP/MySQL search/replacement uses actual ICU spans, including `ss` matching `ß`; frontend wire guards validate the captured review/receipt/reversal payloads |
| Formatting and identity | Compiler regressions and native reopen retain Unicode, block/reference identities, marks, links, list starts, unselected text and literal multiline/deletion behavior; static prose preserves literal newlines |
| Protected/unchanged targets | Reference atoms, structural separators, read-only/proposal/work limits are explicit; blocked selected occurrences prevent apply, and exact no-ops do not create revisions |
| Atomic multi-scene commit | Injected second-checkpoint failure rolls back the first scene and anchor event; concurrent identical requests return one exact receipt and one revision advance per changed scene |
| Preview changes and deliberate action | Component/native-browser checks show invalidation after changing selection/text, no apply on review or blocked draft/AI barrier, and another barrier before explicit commit |
| Durable uncertainty and owner isolation | Hook regressions cover pre-POST journals, reload receipt-first recovery, null-result identical retry, confirmed-read failure, stale cache retention, archive refusal, storage faults and old-owner response isolation |
| Grouped undo/redo | Native immutable-checkpoint reversals retain later metadata/private-note content/resolution, recover or orphan exact attachments appropriately, replay receipts, and refuse later conflicting prose; browser controls require another explicit apply |
| Whole-checkout verification | Installed frontend suite/build/story gate and scoped BFF checks are recorded in 01; changed-source lint is distinguished from existing shared API client diagnostics |

Controlled desktop Storybook is interaction evidence with synthetic in-memory
matches and receipts. The separate fresh retained synthetic database establishes
native persistence semantics. Neither establishes signed-in author/mobile,
assistive-technology, general offline policy, upper resource ceilings, release
readiness or model quality. No project database test write, schema mutation,
file/media/record cleanup or provider execution was needed for this slice.


## Bounded reader acceptance checkpoint — 2026-10-16

The following checks establish the installed reading window/resume slice;
they do not close whole-product performance, author/device/accessibility,
bookmark, retention/offline or D3–D6 acceptance. [01](01_current_state_and_evidence.md#d2-bounded-reader-evidence--2026-10-16)
records commands, exact results and controlled browser evidence.

| Invariant | Evidence/result |
|---|---|
| Direct owned seeking | Fresh native 1,000-scene fixture seeks scene 991 and hydrates only its requested two documents; foreign, scope-excluded, archive-excluded and Trash targets are refused |
| Bounded bidirectional reading | Controller tests retain at most three batches/six active scenes; forward/backward cursors preserve contiguous order and original source identity |
| Visible reading preservation | Automatic eviction guards run before fetching and again before commit; a changed visible passage during the read leaves the old window intact |
| Identity-bound resume | Helper/component tests require scene/hash/block identity, reject equal-looking foreign targets, and preserve old positions across a changed scene and subsequent loading until an explicit reading gesture |
| Layout/device handling | Paragraph geometry tests cover preceding-content removal and width/appearance/font-height changes; device records are bounded, scoped and contain no prose |
| Native browser recovery | Controlled reading around scene 995 closes/reopens at the same block with a 0.125-CSS-px difference; forward/backward loading remains bounded and a preview reload retains the device position |
| Read-only persistence | Native before/after rows remain exact, including 1,000 scene documents, revisions, metadata and timestamps; tests use a new retained database and never select the project database |

The shared Drawer gained only an optional reference to its existing body scroller.
Its existing lint diagnostic is compared against an exactly reconstructed
baseline; it is not treated as new or silently fixed. No nested editor, schema
migration, provider run, file/media/record cleanup or project database test write
is required. The existing Studio tree still hydrates all scenes, so a bounded
reader does not prove a global memory or latency ceiling.

## Bookmark completion gates

The [local bookmark installation](14_status_and_roadmap.md#d2-bookmark-installation--2026-10-16)
implements these product paths. Installed unit/integration, native MySQL/wire
and controlled desktop evidence is recorded in [01](01_current_state_and_evidence.md#d2-bookmark-installation-evidence--2026-10-16).
Retain these regression requirements; complete author/mobile/font/zoom and
assistive-technology acceptance before release. S17 local implementation does
not close all of E18 or D2:

1. Create a labelled bookmark from a saved writer selection/cursor and a verified
   reader paragraph, including an empty scene; retain the writer and its undo,
   draft and selection. Block creation during unresolved review or failed flush.
2. Browse/filter note and bookmark lists separately. Navigate to the owned saved
   scene and exact anchor; detached, changed, archived/Trash or unavailable targets
   retain their evidence and offer deliberate review rather than text matching.
3. Edit labels, move attachments and Trash/restore through independent CAS and
   exact durable receipts. Pending requests and newer device drafts survive
   network/reload failures, while stale account/workspace callbacks do not act.
4. Preserve bookmarks across validated edits, boundary splits, merges, block
   moves, copies, checkpoint/snapshot restore and guarded structure undo/redo.
   Later label/state edits remain current. Notes never acquire point anchors.
5. Keep bookmark/comment copy choices and frozen snapshot review explicit and
   distinct; old note requests/manifests retain their exact hashes and receipt
   shapes. Verify wire guards against new synthetic MySQL output.
6. Verify keyboard/focus/status behavior and English/Spanish copy. Rehearse the
   additive upgrade in a new retained synthetic DB, then back up and preserve
   every original project column before installing. No file or orphan cleanup.

The installed upgrade verified all original project columns/rows after a private
backup; test CRUD stayed in a fresh retained synthetic database. Desktop cursor,
reattachment focus and receipt recovery were observed directly. This evidence
does not substitute for screen-reader, phone/IME or full author-task validation.

## Studio index integration gates

The installed integration in [ADR 18](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#studio-index-document-seeds-and-bounded-history)
locally checks the opening/cache/source flows below. Retain their regressions and
the broader measurement/author/device gates; implementation is not full D2 acceptance:

1. Initial opening downloads organization heads and only the selected canonical
   scene. Never turn omitted prose/history into empty values. Show failed/stale
   reads explicitly and retain the prior writer until its replacement verifies.
2. A bounded confirmed-scene cache stays stable through repeated switching.
   Drafts, in-flight writes, local recovery and pending AI review remain separately
   retained. Index refreshes preserve independent metadata/context/document CAS.
3. Late reads after account/workspace/novel/selection changes cannot activate a
   scene, retire input or contaminate another cache. Archive/Trash readers remain
   readable while every write uses the existing guards.
4. Copy review, complete generation history, source navigation, notes/bookmarks,
   structure/scene/snapshot recovery and creation/copy result opening retain
   their capabilities through explicit on-demand reads.
5. Verify actual HTTP/MySQL reads hydrate zero/all-requested scene bodies as
   appropriate and preserve row fingerprints. The retained 1,001-scene fixture
   provides scoped bytes/timing evidence; typing/selection latency, repeated-switch
   heap growth, constrained devices and complete author/accessibility acceptance
   still require measurement.

The loading checkpoint checks a three-scene / 16 MiB confirmed cache, separate
20-row generation summaries/full detail, 20-scene / 240-codepoint excerpts,
retained writer/retry, creation-read failure and retired-owner callbacks. Saving
between review and apply requires rereview. Actual synthetic wire guards and
zero/one hydration plus row fingerprints pass. Controlled browser proof covers
new typing during a delayed read, cache reuse, failure/retry, old history access
and later excerpt pages. Repeated-switch heap, typing latency under load, offline
policy and full author/mobile/assistive-technology work remain open.


## Highlight and invisible-character acceptance

| Behavior | Current evidence / remaining gate |
|---|---|
| Saved highlight | Attribute-free canonical mark; exact rich JSON/projections through actual editor → MySQL save/reopen, Studio/reader, snapshot, checkpoint/restore and independent copy. Unknown styling/duplicates reject. Native receipt replay and invalid-write preservation pass |
| Ordinary editing | Toolbar state, Ctrl/Cmd+Shift+H, one-step undo/redo, block IDs and UTF-16 range preservation pass. Phase/read-only guards refuse formatting; controlled browser checks verify toolbar, shortcut, undo and read-only display |
| View preference | Dedicated existing novel-device scope, default off, no rewriting other preferences, old-scope refusal and storage-failure fallback pass |
| No text pollution | CSS-only glyphs in aria-hidden/noneditable widgets; original JSON/plain text/DOM text/clipboard selection, editor identity, caret, autosave count and manual undo remain unchanged. Actual whitespace is retained |
| Bounded painting | A visible range plus buffer is capped at 20,000 document positions; regex work is sliced to that range. Disabled mode reads no viewport geometry. Scroll/resize/reflow coalesce, composition defers repaint, and destruction cancels listeners/frames |
| Wider acceptance | Full screen-reader/phone/IME/RTL and author-task evaluation, measured long-document typing/scrolling/heap, and D5 format/loss reporting remain open. Source/unit/controlled-desktop evidence does not close these gates |

## Deliberate root-novel erasure acceptance

[ADR 19](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/stories.md#explicit-permanent-novel-erasure) resolves N07's explicit root action.
Installed regression/native/browser and project preservation evidence passes;
broader release gates remain in [14](14_status_and_roadmap.md#d2-deliberate-novel-erasure--2026-10-16).

| Boundary | Required behavior and current evidence |
|---|---|
| Deliberate review | Only a trashed root; exact title, current source digest and explicit action. Changed title/head, active jobs, foreign owner/workspace and archived writes refuse without content changes. Unicode and fresh-review UI tests pass |
| Atomic erasure | Real forced rollback restores prompts, receipt and all root content. Successful native erasure removes only the selected novel's cascading content and redacts its terminal prompt payloads; accounting headers and a same-title second novel remain |
| Replay barriers | Concurrent identical requests recover one receipt. Changed intent conflicts. Original deterministic creation and both generic execution retained-read/admission replay refuse after erasure; no provider request is recovered |
| Device uncertainty | Pre-POST immutable journal; check first, explicit identical retry after a missing result; confirmed-but-missing receipt never reposts. Archive/owner/storage-failure/newer-input cases pass. Recovery and manual copy remain outside the closed dialog |
| Cache and focus | Retire only the confirmed root; late reads/pages cannot reintroduce it. Owner changes cannot clear another workspace. Keyboard activation/Escape and archived read recovery pass in controlled browser fixtures |
| Installation preservation | Fresh private exact-predecessor backup, one empty table and marker; all original row counts/hashes before and after. Synthetic proof and actual project installation pass; all 4,449 original content rows are unchanged, target 112 tables / 157 FKs, health/routes and zero erasure records verified |
| Explicit limits | Device drafts, other novels, source cards, shared media, downloads, backups/provider copies and valid missing-file records are preserved. No automatic purge, unit erase or broad storage/privacy guarantee is implied |

These checks do not close full author/mobile/assistive-technology acceptance,
non-erased revision/device retention, offline/reconciliation, supported manuscript
limits, remaining D2 catalog cases or D3–D6.

## Open-scene reconnect and reconciliation acceptance

[ADR 20](20_offline_and_reconciliation.md) implements the current writer/review
layer. Full persistent cached entry/reload and broad D2 acceptance remain open.

| Boundary | Evidence and required behavior |
|---|---|
| Browser offline | Open scene remains editable and checkpointed; no write/accept request is queued offline; pending-sync and checking labels are distinct |
| Reconnect | Verify current workspace/archive and scene independently before an unsent write. An exact uncertain request replays first, then a newer account head blocks its local tail |
| Canonical review | Independent stable blocks combine; ambiguous block edits/deletions/order/title need choices. Marks, links, mentions and stable identities survive; invalid mixed documents cannot apply |
| Stale/foreign controls | Local sequence, owner and reviewed account head bind the action. Later typing, another review/account/workspace or server revision cannot silently replace prose |
| Retained alternatives | Retain a separate device copy before adoption; quota/storage failure refuses and exposes copy/download. Account versions remain immutable history; unknown attachments are explicit orphans |
| Journal ownership | Reopened/concurrent queues use independent keys. Late old acknowledgements preserve new prose; retirement checks exact base revisions/intent. Malformed neighbors do not hide valid drafts; unsupported requests remain manual and raw records remain |
| Keyboard/read-only | Controlled browser fixture covers choices, Escape/return focus, reopen, apply, selectable recovery, archive and retention failure; EN/ES component tests pass |
| Actual persistence | New retained native database reaches revision 5 with real stale refusal, original receipt replay after newer prose, immutable history, preserved note content/origin and other-novel isolation |
| Remaining | Persistent scene/index cache entry, cold reload, durable unfinished review forms, shared-device/logout/quota policy, measured limits and full author/mobile/assistive-technology acceptance |


### Persistent device-entry evidence — 2026-10-16

The installed checkpoint in [14](14_status_and_roadmap.md#d2-persistent-device-entry--2026-10-16)
passes 5,134 frontend tests / one conditional skip (553 files), production build,
Storybook typecheck and no-added-diagnostics lint comparison. Native browser
checks cover atomic scene retention/usage, owner isolation/retirement, malformed
read refusal and controlled allowance failure preserving earlier copies.
Keyboard entry, return focus, checkpoint, full page reload and explicit draft
resume into the editor pass in a fictional account with no server client.
The existing actual HTTP/MySQL Studio wire passes the cache runtime validator.

This is evidence for persistent copies and local entry after assets load.
It does not establish offline app-shell cold loading, full reload recovery of
unsent reconciliation choices, mobile termination/eviction behavior, authenticated
author acceptance or a full assistive-technology/performance release gate.
R13 and D2–D6 remain open; no project database operation is required here.

### Durable reconciliation-choice evidence — 2026-10-16

The [checkpoint](14_status_and_roadmap.md#d2-durable-reconciliation-choices--2026-10-16)
adds exact-source reload recovery and a direct saved-review entry independent of
confirmed-read caching. Native browser verification covers retained choice
recovery after full reload, saved snapshot editing with account actions disabled,
and 13 IndexedDB isolation/order/refusal checks preserving earlier records.
Focused regressions cover source/owner changes, late callbacks, independent
writer keys, storage-failed close with retained choices/export, successful retry,
archive/default-workspace visibility and navigation checkpoint state.

This establishes local review progress, not offline app-shell loading, current
account authorization or permission to apply a saved snapshot. Full source/CAS
checks and separate device-copy retention remain mandatory. Broader storage,
mobile termination/eviction, author and assistive-technology/performance gates
remain open with R13/D2/D3–D6. [01](01_current_state_and_evidence.md#d2-durable-reconciliation-choice-evidence--2026-10-16)
records commands, counts, native proof and installation artifacts.

### Cold offline app acceptance evidence — 2026-10-17

The [checkpoint](14_status_and_roadmap.md#d2-cold-offline-app-loading--2026-10-17)
adds opt-in production app download and a normal waiting-worker update lifecycle.
Native checks prove these distinct boundaries:

| Case | Verified result |
|---|---|
| Actual built app after server stop | App code/styles/render load from verified files; API is unavailable, not fabricated ready. First-use legal/age gates are observed without accepting them. |
| Fictional device writer after server stop | A complete page reload, cached scene entry, deliberate exact-draft resume and new retained local writing work without that server. |
| Open writing during a new download | The older build and full manuscript remain unchanged; the new build is explicitly waiting. |
| Closing old app tabs | Normal activation opens the new build; no skip-waiting command or forced reload is used. |
| Mismatched candidate | Installation fails and the earlier complete build remains usable. |
| Native reservations | Ten real CacheStorage/IndexedDB checks cover source isolation, preserved earlier copies and concurrent ceiling refusal; invalid large candidates are refused without downloading large bodies. |
| Private boundaries | Auth, account/media, version, query, range and write traffic are excluded; foreign covering workers are preserved. |
| UI/status | Explicit opt-in, busy/focus preservation, duplicate-action refusal, unavailable LAN/development states, waiting/failure copy and unchanged-copy status have regressions. |

This is controlled desktop evidence. It does not establish real-author login/
permission, cross-browser/mobile eviction, full assistive-technology/font/zoom,
long-project performance or broad retention/shared-device policy acceptance.
Those and the remaining R13/D2/D3–D6 gates remain open. [01](01_current_state_and_evidence.md#d2-cold-offline-app-evidence--2026-10-17)
records commands, source hashes, artifact integrity and browser images.

## D2 retained workspace lifecycle acceptance — 2026-10-17

[The checkpoint](14_status_and_roadmap.md#d2-retained-workspace-lifecycle--2026-10-17)
adds these focused results:

| Case | Verified result |
|---|---|
| Overlapping checked workspace responses | Newer archive wins; older active and equal-head active cannot unlock it. A newer real restore can. Legacy unknown-version archives stay conservative. |
| Independent workspace-only retention | Two retained manuscript copies and their byte counter remain unchanged. Actual schema 1 and both existing stores remain. |
| Native allowance refusal | A 600-row oversized batch aborts atomically, including its preceding archive change; no prior restriction or record is removed. |
| Corrupt metadata | Unreadable workspace is identified, manuscript copies remain readable and automatic replacement is refused. |
| Captured ownership | Caller mutation during an await cannot move an owned copy or invent a version; another author/API sees no metadata. Retired/overlapping refresh results are ignored. |
| Live two-tab writer | Archive locks the existing editor with unsent prose intact; a late old active observation leaves it locked; newer restore permits continued retained writing in the same draft. |
| Open saved review | A later known archive blocks new choices while preserving the compared source, existing choices and download recovery. |
| Existing app copy | The previously retained fictional cold-app manuscript remains unchanged; no storage version upgrade or cleanup runs. |

Twenty-two native transaction checks and targeted UI/provider regressions cover
this boundary. They do not establish full unit/root lifecycle overlays, real-author
permission acceptance, cross-browser/mobile eviction, broad logout/shared-device
policy, long-project performance or complete font/zoom/assistive-technology
acceptance. Full R13/D2 and D3–D6 remain open.

## D2 novel and unit device lifecycle acceptance — 2026-10-17

| Case | Verified result |
|---|---|
| Root and unit revision independence | Newer root restore retains a separately archived ancestor; equal/older active observations cannot unlock known restrictions. |
| Structure membership and movement | Current parent placement determines ancestor restrictions; removed scenes stay read-only, earlier metadata survives and a newer valid membership can restore editing. Equal contradictory placement freezes editing. |
| Confirmed erase receipt | Retained device copies, drafts and saved-review sources survive; the terminal observation cannot be undone by later source responses. |
| Native storage | Thirty checks cover real schema-1 transactions, record-size refusal, an explicitly seeded fictional reserved account ceiling, corrupt-record refusal, usage consistency and unchanged manuscript/cold-app copies. |
| Cross-tab and reload | A known Trash/chapter archive locks the existing editor with its prose intact; applicable newer restores permit continued writing. Terminal state and explicit read-only draft inspection survive reload. |
| Owner retirement | Delayed reads, old mutation callbacks, disabled/unmounted publishers and replaced account/workspace scopes cannot publish under the new owner. Loaded-data ownership is checked independently from session readiness. |
| Storage failure | Existing content remains available for manual recovery; a visible warning accompanies current publication failure, and corrupt/unavailable lifecycle state blocks device editing. |

The [checkpoint](14_status_and_roadmap.md#d2-novel-and-unit-device-lifecycle--2026-10-17)
does not prove receipt of remote changes before any checked read, OS quota/eviction
reliability, broad shared-device/logout policy, supported large-project limits or
complete author/browser/mobile/font/zoom/assistive-technology acceptance. Those,
remaining D2 cases and all D3–D6 stay open. No project data or files were removed.
