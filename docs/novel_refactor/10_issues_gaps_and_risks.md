# Issues, gaps, and risks

**Source/lifecycle and deep cleanup review, 2026-10-15:** this remains an active issue register. Save ordering (NE-001), acceptance after a false flush (NE-003), lowercase offset mapping (NE-007), and missing scene/revision/novel-assistant contracts were rechecked in current source. The later migration/cleanup review passed the focused baseline suites in [01](01_current_state_and_evidence.md#deep-migration-and-cleanup-revalidation--2026-10-15), without rerunning the historical controlled defect fixtures or applying fixes. All NE-001–NE-023 retain their individual evidence class and remain open until their acceptance criteria are met.

**Documentation review:** 2026-10-14. **Status:** WIP audit backlog — open source concerns, prior controlled reports, target gaps, and unmeasured risks; no remediation shipped by this update. Overall novel availability is **WIP**; novels need the plan grant `novels` (since 2026-10-18).

**Current disposition (audit 2026-10-18):** the *Evidence* column below keeps each finding's original evidence. Today: **resolved in the checkout** (release unverified): NE-001–009, 011–014, 019, 022. **Built, acceptance open:** NE-015 (bound assistant, outline and multi-scene prose changesets) and NE-021 (import, export, packages; EPUBCheck, Word and e-reader checks and the *Tasks* drawer remain). **Partial:** NE-010 (links fixed and import loss reports exist; Word/EPUB acceptance remains), NE-016 (bulk actions, split and merge exist; drag holes and copies that drop planning remain), NE-018 (measured and fixed in a development build only), NE-020 (inline lineage and frozen presets exist; one inline/assistant lineage waits on CL-04), NE-023 (revision-bound summaries and as-of-scene facts exist; the POV and reveal policy is decision 10). **Open:** NE-017 (live regions added, but no assistive-technology audit, and contrast is unmeasured beyond the status hints raised to 5.29:1 on 2026-10-20). Details: [14](14_status_and_roadmap.md#execution-disposition-of-findings). See [actual status and roadmap](14_status_and_roadmap.md) for evidence, rollout gates, and TBDs.

**Reuse/provenance clarification, 2026-10-16:** [07](07_target_architecture.md#reuse-and-overlap-decisions) records existing foundations, two duplicated Codex helpers and adjacent-plan ownership. NE-020 is narrowed below: custom instructions are already embedded in the persisted frozen execution payload; safe history exposure and manuscript application lineage remain missing. No source fix or new defect reproduction was performed.

Research snapshot: 2026-10-14. Confidence definitions and reproduction evidence are in [01](01_current_state_and_evidence.md). P1 requires early remediation for manuscript integrity or reliable expanded AI; P2 is important correctness/workflow work; P3 is a later capability or optimization. A gap is not mislabeled as a current defect.

**Disposition at this review:** NE-001–NE-023 remain open; no fix was implemented by the documentation update. Their mechanisms or missing contracts were compared with current source. “Reproduced” in the index refers to the prior dossier's controlled checks, which were not rerun and have no standalone reproduction script retained here. Recreate those fixtures before closing a finding. Neither the historical 211-test pass nor the new 221-frontend/290-backend baseline resolves them. The prioritized next work and dependencies are in [14](14_status_and_roadmap.md).

**Execution update, 2026-10-16:** the historical mechanisms below describe the audited baseline. D1 fixes and retained regressions now exist; see [current disposition](14_status_and_roadmap.md#execution-disposition-of-findings) and [execution evidence](01_current_state_and_evidence.md#execution-evidence--2026-10-16). Basic revisions do not implement trash; link fidelity does not establish a complete document support contract; partial accessibility changes do not constitute an audit pass.

## Finding index

**UI/UX addendum, 2026-10-15:** [06](06_ui_ux_and_accessibility.md#prototype-findings-and-prioritized-uiux-work) adds UX-01–UX-12 as planned design work, with source/prototype/recommendation evidence distinguished. Save/recovery and metadata UX maps to NE-001/003/013/014/022; explicit AI targeting/review to NE-002/004/005/006/011/012/015/019/020; structure to NE-016; keyboard/reflow/focus to NE-017/019; memory/continuity to NE-023; and delivery to NE-021. These work items do not add production defect reproductions or close any NE finding. Corrected demo footer/naming issues and temporary prototype checks are qualified in [01](01_current_state_and_evidence.md#standalone-ui-prototype-evidence--2026-10-15).

| ID | Priority | Finding | Evidence |
|---|---|---|---|
| NE-001 | P1 | Overlapping saves can acknowledge stale manuscript content | Reproduced with controlled ordering; source-confirmed backend lacks chapter CAS |
| NE-002 | P1 | Accepted AI replacement has no reliable undo event | Reproduced |
| NE-003 | P1 | Acceptance status proceeds after failed body flush | Reproduced with controlled callbacks |
| NE-004 | P2 | Ctrl/Cmd+Z during pending generation fails to cancel through the current callback | Source-confirmed |
| NE-005 | P1 | Cursor insertion and chapter-ending generation context disagree | Source-confirmed |
| NE-006 | P1 | Selection offsets select first occurrence or normalized-string indexes | Reproduced |
| NE-007 | P1 | Unicode case conversion shifts Find/Replace ranges | Reproduced |
| NE-008 | P2 | Mention IDs disappear during Markdown persistence | Reproduced |
| NE-009 | P2 | Word counts include annotations and mishandle no-space languages | Reproduced |
| NE-010 | P2 | Unsupported document content loses information on normalization/save | Reproduced for links |
| NE-011 | P1 | Context trace can omit chapters actually sent for whole-story style | Source-confirmed |
| NE-012 | P1 | Story token budget is a prompt setting rather than an enforced assembly limit | Source-confirmed within reviewed assembly path |
| NE-013 | P1 | No durable recovery of the latest unsaved draft | Gap |
| NE-014 | P1 | No user-facing manuscript revisions or chapter trash/restore | Gap |
| NE-015 | P1 target gap | No novel-bound conversational assistant with changesets | Built (2026-10-18): bound assistant runs (D3); outline changesets and grouped multi-scene prose changesets with one undo run (D4 slices 15–16); acceptance remains |
| NE-016 | P2 | Chapter model/UI lacks full scene organization and structure operations | Gap |
| NE-017 | P2 | Status, autocomplete, toolbar, contrast, and focus need accessibility work | Source-confirmed concerns; live audit outstanding |
| NE-018 | P2 | Whole-document work occurs on hot editing/save paths | Measured 2026-10-18 on a 1,500-scene novel (development build): typing p95 40 ms and a 76 ms save after fixing whole-novel rendering and cache copies on the typing path; production and low-end hardware unmeasured. See [large-manuscript performance](14_status_and_roadmap.md#d2-slice--large-manuscript-performance-2026-10-18) |
| NE-019 | P2 | Unrelated edits and ordinary Tab can implicitly accept an AI proposal | Source-confirmed behavior; UX risk |
| NE-020 | P2 | Durable instructions lack safe history exposure; revision/application lineage is incomplete | Source-confirmed gap; frozen execution prompt already persists |
| NE-021 | P2 | No complete manuscript import/export workflow in current novel UI | Built (2026-10-18): D5 export (Word/EPUB/PDF/Markdown/text), import of six formats with loss reports, packages and export jobs; EPUBCheck and e-reader acceptance remain |
| NE-022 | P2 | Metadata failure paths and blank-title save feedback need reconciliation | Source-confirmed concern; focused runtime check needed |
| NE-023 | P2 target gap | No narrative-time canon and derived-memory invalidation contract | Gap |

## NE-001: stale save acknowledgements

Source: [useChapterDraft](../../src/features/novel/hooks/useSceneDraft.ts), `save()` around line 156; [DataProvider](../../src/app/providers/DataProvider.tsx), `updateStoryChapter`; backend `StoryModel.update_chapter()` in `src/database/mysql/models.py`.

The hook starts another request without waiting for `saveInFlightRef`. A controlled two-request fixture completed the newer write before the older write. The final visible content was newer, the simulated server content older, and the hook reported saved. The BFF locks rows but does not compare an expected chapter revision. Database locking serializes transactions; it does not establish the user's intended edit order.

Approach: per-document save queue, immutable snapshots, local/acknowledged revision tracking, server CAS, and a visible conflict-recovery flow. Correctness criterion: a saved indicator can only acknowledge the displayed revision, and stale writes cannot overwrite newer content. Conditional writes are an established HTTP mechanism for this problem. [RFC 9110, If-Match](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)

## NE-002 and NE-004: AI undo semantics

Source: [aiSuggestion](../../src/features/novel/editor/extensions/aiSuggestion.ts), replacement history around lines 338–346 and keymap around 437; [useInlineAI](../../src/features/novel/editor/hooks/useInlineAI.ts), `reject()` around 259.

Replacement insertion and acceptance both omit history. Accepting a replacement in a fresh editor left no operation to undo. Existing tests check continuation undo and avoid duplication after a regenerated replacement, but do not assert restoration of the replaced passage.

The pending undo binding invokes rejection; the hook immediately returns unless reviewing. The documented cancel behavior is absent from that callback path.

Approach: keep preview state separate from the committed document and record the accepted replacement as one undoable operation. Reject changes preview state only. Pending undo cancels the pending request. Redo must not restart generation or change billing/history status unexpectedly.

## NE-003: acceptance after a failed save

Source: [useInlineAI](../../src/features/novel/editor/hooks/useInlineAI.ts), `accept()` around 243; backend `accept_story_generation()` in `src/routes/stories.py` around 900.

The hook ignores the Boolean returned by the flush. The backend acceptance endpoint updates status only and assumes body persistence already succeeded. The controlled fixture recorded acceptance after a false flush result.

Approach: preferably commit body revision and accepted proposal status in one domain transaction. An interim two-request flow must check the flush result, retain a recoverable acceptance state, and reconcile a lost response. The writer sees whether the change is accepted locally, saved remotely, or waiting for retry.

## NE-005 and NE-006: target correctness

Source: [useInlineAI](../../src/features/novel/editor/hooks/useInlineAI.ts), anchor around 224; [markdownSelection](../../src/features/novel/editor/documentSelection.ts), lines 28–44; backend `StoryContextPayload` and `story_writer.v3.json`.

The client retains an insertion position but sends no cursor position. The writer graph tells Continue to extend the current chapter ending. Mid-chapter insertion therefore has incompatible prompt and application targets. Separately, `indexOf` locates the first repeated passage, and the compact-whitespace fallback returns indexes from a different string.

Approach: revision-bound document anchors, explicit cursor/prefix/suffix context, quote/hash checks, a documented offset unit, and a true serialization position map where Markdown offsets remain necessary. Incorrect offsets currently affect prompt/provenance; editor replacement uses a separate document range. Check edited target content again before applying a response.

## NE-007: Unicode Find/Replace

Source: [searchReplace](../../src/features/novel/editor/extensions/searchReplace.ts), `findMatches()` around 51.

Lowercasing can expand a character into multiple code points. Using those indexes in the original document changed `İzmir cat` to `İzmir cdog` when replacing cat with dog. Approach: preserve original indexes through matching and provide language-aware tests. Do not normalize the entire manuscript in place to simplify search.

## NE-008 through NE-010: document fidelity

Sources: [codexMention](../../src/features/novel/editor/extensions/codexMention.ts), [novelUtils](../../src/features/novel/utils/novelUtils.ts), [NovelEditor](../../src/features/novel/editor/NovelEditor.tsx).

Mentions retain an ID in memory but emit only `@Name`. Equal names resolve to the first entry after reload. Beat HTML comments contribute to raw Markdown word counts; unspaced Chinese prose counts as one token. Disabled links discard URLs during parsing/serialization, and the next ordinary edit persists the normalized body.

Approach: versioned structured documents with stable mention IDs; separate annotations from prose; locale-aware count rules; explicit import/export support and conversion-loss reports. Preserve current novels and recovered non-novel rows under [15](15_database_migration_and_legacy_cleanup.md); retain raw input for author import/conversion features that need it. See [07](07_target_architecture.md) and [09](09_persistence_revisions_and_recovery.md).

## NE-011 and NE-012: misleading context

Sources: backend `_context_trace()` in `src/routes/stories.py`, `_chapters_for_prompt()` and `build_story_writer_description()` in `src/services/story_generation.py`; [CodexPanel](../../src/features/novel/components/codex/CodexPanel.tsx).

The trace selects current/prior chapters. Whole-story style can send all chapters while keeping that trace. Token budgets are validated and put into JSON prompt settings, but the inspected story assembly path does not enforce a token cap. This finding does not assert that model/provider limits are absent elsewhere. The meter additionally combines current toggle counts with an earlier request's token estimate.

Approach: one resolved context bundle produces both prompt and trace; deterministic budget selection; profile/model-specific counting or conservative estimates; explicit reservation for output; labels for past versus prospective context. Future chapters and revelation state require deliberate inclusion rules.

## NE-013 through NE-016: recovery and authoring coverage

The current draft is memory-only; unload warnings and retries cannot recover it after process termination. The history drawer stores generated outputs, not whole-manuscript revisions. Chapter deletion is a delete endpoint with confirmation, not a documented trash/restore flow. Ordinary chapter management lacks reorder, duplicate, split/merge, scene metadata editing, and a distinct scene/part hierarchy. The assistant kind union has no novel kind.

These are implementation gaps against the expanded target, not proof of production incidents or absent infrastructure-level backups. Proposed coverage is specified in [04](04_novel_chapter_and_scene_management.md), [05](05_feature_catalog.md), [08](08_ai_assistant_context_and_tools.md), and [09](09_persistence_revisions_and_recovery.md).

## NE-017: accessibility concerns

- Save-state text lacks live status semantics in [StudioStatusStrip](../../src/features/novel/components/StudioStatusStrip.tsx).
- Slash and mention active options lack IDs and a relationship from focused editor to active option.
- Review toolbar semantics lack the associated arrow-key focus behavior.
- Tab accepts a live suggestion rather than moving focus out of the manuscript.
- Informative `parchment-500` text has approximately 2.11:1 contrast on `ink-800`; normal AA informational text needs 4.5:1.
- The editor suppresses the global focus treatment; test blank and read-only focus states before declaring conformance or a failure.

These source findings require the keyboard, screen-reader, zoom, reflow, and touch scenarios in [06](06_ui_ux_and_accessibility.md). Existing coarse-pointer enlargement of AI controls is a strength; 44px is a useful touch design target, not the WCAG 2.2 AA minimum.

## NE-018 through NE-023: additional gaps and risks

| ID | Mechanism or missing feature | Approach |
|---|---|---|
| NE-018 | Every ordinary update serializes the chapter; detection/search rescan it; the chapter rail counts all loaded bodies; saves reload story children/history | Profile first; cache revision-based statistics, scan changed blocks, return small save responses, paginate history |
| NE-019 | Any non-AI document change accepts a suggestion, even outside its passage | Require explicit acceptance or deliberately constrained edits within the suggestion; preserve focus navigation |
| NE-020 | Local history keeps the typed instruction, while backend `promptSummary` only describes command/context. The instruction also enters `build_story_execution_payload` and is persisted in `tb_llm_execution_plan.frozen_payload`; it is not absent from backend durability. Public generation history lacks an allowlisted instruction projection and source-revision/application lineage; inline prompts are not durable beat nodes | Extend the existing generation/execution projection with safe instruction fields, source revisions and changeset/result lineage. Reuse stored profile/graph/execution identities; never expose raw frozen payloads or add a second full-prompt archive |
| NE-021 | Header exposes Find/History but no full manuscript import/export; history copies individual outputs | Dedicated import preview and manuscript compiler with support/loss matrix |
| NE-022 | Blank chapter title is omitted from save while UI can stay blank; metadata/deletion call sites fire promises without a complete local feedback flow | Validate metadata separately, reconcile accepted server values, show actionable failure state and retain drafts; verify focused flows before implementation |
| NE-023 | No first-class scene summaries, temporal facts, or dependency invalidation for context | Version derived memory against source revisions; preserve author-approved canon; recompute on relevant edits/reorders |

## Risk register for the proposed refactor

These risks describe the proposed expanded system, not newly discovered vulnerabilities.

| Risk | Consequence | Mitigation and release evidence |
|---|---|---|
| Lossy author import or editor serialization | Future writing loses supported content/references | Preserve author import sources, report unsupported content and check the changed serializer; disposable test rows need no migration corpus |
| Two independently editable canonical bodies | Markdown/JSON drift and stale saves | One authority per schema version; derived formats generated from its revision |
| Unbounded agent operation | High latency/spend and broad unintended edits | Step/tool/token limits, explicit scope, stop/resume, proposal-only mutations |
| Stale AI target | Overwrites author edits made during generation | Base revisions, quotes/hashes, conflict invalidation, explicit rebase review |
| Hallucinated canon | New facts become authoritative without author intent | Evidence-linked fact suggestions and explicit promote-to-canon action |
| Timeline leakage | Future events spoil earlier POV scenes | Separate narrative order, story time, and character knowledge/reveal rules |
| Cross-workspace retrieval | Private content leaks into another story | Scope filtering before retrieval, server-owned ownership, isolation tests |
| Provider credential leakage | Secret persistence in graph data/prompts/logs/history | Browser/BFF transient input handling alone is insufficient; close the [actual transport/custody findings](../security/README.md) and verify end-to-end persistence/recovery before expanded novel execution; allowlist provenance |
| Prompt injection in imported research | External prose attempts to invoke tools or widen scope | Treat source material as data; server validates all operations and permissions |
| Scope expands into shared editing | Additional synchronization/permission work displaces manuscript reliability | Keep collaboration explicitly out of scope; review dependencies and acceptance gates against the single-author target |
| Licensing/hosting dependency | Budget or portability constraints | Verify package license and hosting terms before adoption; adapter boundaries |
| Format-heavy UI | Writing becomes slower and harder to learn | Quiet Write mode, progressive disclosure, author usability tasks |
| Automated critique overreach | False continuity/style advice erodes trust | Evidence-linked findings, uncertainty, user-dismissable rules, human evaluation |
| Metrics reward volume over usefulness | Models generate more words but worse assistance | Task success, retained edits, voice preservation, agency and cost metrics |
| Growing history/storage | Expensive queries and retention problems | Paginated revisions, checkpoints, explicit retention/export/erase policies |

## Migration and cleanup review additions

> **Superseded the same day** by the data-preservation correction ([15](15_database_migration_and_legacy_cleanup.md)): non-novel content was recovered, whole-database resets are disabled, and every schema change is an additive scoped upgrade with a verified backup. The "reset", "discard/reseed" and "destructive" responses below are historical and must not be followed.

**Policy revision, 2026-10-16:** the user confirmed a development project with no users and disposable test data, and authorizes destructive changes only to this project's test DB. The earlier production backfill/compatibility/observation obligations and eighteen migration scenarios are superseded by [15](15_database_migration_and_legacy_cleanup.md) and the three DEV checks in [12](12_validation_and_acceptance.md#database-migration-and-cleanup-acceptance).

| Source-backed concern | Development plan response |
|---|---|
| Exact-schema verification rejects mismatched columns/marker/seeds | Stop this project's workers, install the current schema/seed by reset and start matching code; no intermediate compatibility reader |
| Legacy writers mix body/order/metadata and acceptance updates status only | Remove/replace those paths with current services and callers; no old-client support program |
| Physical delete cannot supply product trash/restore | Implement lifecycle semantics for new data. The developer reset itself remains explicitly destructive |
| Old test chapters, generations, local goals and checkpoints use the former model | Discard/reseed project DB data and clear known obsolete project browser records; no historical mapping/backfill work |
| Novel assistant storage has constraints beyond its kind union | Update current enums, target/result checks, registry/profile contracts and fixtures together |
| Obsolete code/data can outlive its replacement | Use CL-01–CL-10 as the removal inventory and the short current-contract smoke; do not create a separate migration test program |

The product NE findings remain open until their implementations are corrected. Keep revision/undo/ownership/AI acceptance behavior for new writing, without making preservation of developer fixtures a delivery requirement.

## Decisions still needed

Retention duration, hosted versus self-hosted editor add-ons, import/export coverage, exact selection-anchor representation, and inheritance across the author's own series remain open. Collaboration is excluded and is not an open release decision. See [13](13_sources_and_open_decisions.md). Resolve the remaining decisions using fixtures and prototypes; this research does not require pausing documentation or asking the author to decide implementation details now.
