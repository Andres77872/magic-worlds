# Validation, evaluations, and acceptance

**Source/lifecycle reconciliation:** 2026-10-15. **Status:** Open release gates. The October 14 record reports 211 focused tests passing; that result was not rerun by this cleanup. Backend, end-to-end, migration, AI-quality, and live accessibility gates remain open. Novel rollout is disabled in the example configuration and enabled in the dated local override. See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

**UI/UX acceptance update:** 2026-10-15. The UX-01–UX-12 matrix below translates the [demo findings and interaction contracts](06_ui_ux_and_accessibility.md) into planned release checks. Passing prototype assertions does not complete those checks in the application.

## Evidence already collected

The 2026-10-14 documentation review reran `pnpm exec vitest run src/features/novel src/infrastructure/api/storyChapters.test.ts`: **27 frontend test files and 211 tests passed in 6.52 seconds**. Ten prior controlled check results are preserved in [01](01_current_state_and_evidence.md); those fixtures were not rerun and are not part of the pass count. Their current source mechanisms were rechecked. This sub-review does not claim a full application build, backend integration test, live model evaluation, performance benchmark, or accessibility certification. No roadmap phase is accepted by this test result alone.

On 2026-10-15, the separate [HTML demo](novel-studio-demo.html) passed **26 scripted assertions** in a temporary jsdom run, including exact accepted-edit undo, stale-proposal blocking, structure operations, sample recovery, reopening browser storage, and exclusion of unaccepted text from export. Dialog/download behavior used doubles; this script is not a retained regression fixture. Browser inspection covered the default size, 390px phone width, and 1440px desktop width, including acceptance/undo and planning navigation. The final 390px page-width check found no horizontal overflow. These are prototype checks, not real-device, 320px, zoom, screen-reader, or full-app-shell evidence.

`pnpm build` also passed during demo creation, with the chunk-size warning. The demo is outside the application bundle, so that pass establishes application build compatibility, not execution or integration of the proposed UI. AI responses, account synchronization, context counts, and recovery scenarios in the demo are simulated. The present documentation update does not rerun the product suite or close NE findings.

## Availability and release validation

Verify an enabled and disabled build. With `VITE_FEATURE_NOVELS_ENABLED=false` or omitted, navigation entries must be hidden, direct story/gallery routes must follow the documented disabled-page behavior, and frontend story methods must reject before network work. With exact `true`, verify gallery → create → editor → generate → review → save → reopen against the BFF, including archived workspace, authentication expiry, missing profile, and offline/error recovery. A local `.env` opt-in and component tests are insufficient to mark the feature shipped. If the product adopts a WIP placeholder, document and test that intentional router change; current source renders Not Found.

Before enabling a release cohort, record the build's flag, deployed client/BFF/profile versions, migration compatibility, NE-001–NE-014 disposition, and the gates in [14](14_status_and_roadmap.md). Unknown production values stay **unverified**.

## Defect regression matrix

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
- Test old-client read/write protection, migration interruption/resume and raw-source preservation.
- Validate smaller list/save DTOs and paginated history without changing authorization.

Frontend feature checks use pnpm. After implementation, run targeted tests, `pnpm build` as the primary frontend green/red signal, relevant lint with baseline attribution, and `pnpm typecheck:stories` when stories change. Run backend unit and real-database integration tests from its documented environment. Do not infer database correctness from mocked SQL calls alone.

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

## Failure and operational drills

Run airplane mode/reconnect, browser termination, IndexedDB denial/quota, expired authentication, account/workspace switch, workspace archive, target deletion, stale AI response, provider timeout, exhausted quota, service restart and cancellation mid-plan. Verify recoverable text and accurate job states.

Rehearse database/artifact backup restore, revision retention cleanup, schema migration resume and rollback with post-migration rich edits. Test reconnect and conflicts across the author's own tabs/devices, local undo, stale AI targets, and reviewed recovery. Collaboration is out of scope; there are no coeditor, presence, invitation, or shared-review release gates. Export validation checks frozen input hashes, semantic EPUB structure, output accessibility, supported personal/AI review annotations, and PDF layout fixtures.

## Traceability and completion

Every catalog item needs a named acceptance task and evidence entry before being called delivered. Documentation checks establish link/structure quality only. Implemented, tested, user-validated and shipped are separate states; update evidence as those states are achieved.
