# Implementation plan

**Status:** proposed, 2026-10-15. No phase below is implemented by this documentation task. Owners are responsible areas; individuals, estimates, and delivery dates remain unassigned.

## Delivery sequence

~~~text
P0 decisions + baseline
  -> P1 shared tools/domain extraction
  -> P2 main-page single-target editing
  -> P3 bounded retrieval and orchestration
  -> P4 controlled release and evaluation

P5 optional extensions follow measured need and separate domain contracts.
~~~

P2 is intentionally useful before autonomous retrieval: the user selects one target on the main page and receives existing document edits there. P3 adds discovery and richer answers without copying write behavior.

## P0 — settle contracts and preserve the baseline

Responsible: product, BFF, persistence, frontend, executor/profile, privacy/billing.

- Accept or revise the [ADR](04_architecture_and_reuse.md), source policy, one-target release boundary, and exact app protocol versions.
- Define Ask/Edit selected and the user-created target grant. Decide replacement scope and creation destinations.
- Resolve privacy-copy/retention acceptance with the existing ASST-R3 owner. Record touched security/integrity gates; do not reopen them as duplicate tickets.
- Capture schema/behavior fixtures for six existing tools, four card types, bound/unbound behavior, voice/media preservation, drafts, memberships, and lorebook entries/settings.
- Record current environment/revisions and rerun relevant regression suites before the future refactor. The [earlier test evidence](00_current_status_and_evidence.md) is a baseline, not approval of new behavior.

Exit: explicit accepted contract and test/evidence plan; no claim of expanded availability.

## P1 — extract shared definitions and document commands

Responsible: BFF/domain/persistence.

Expected areas:

- BFF `src/services/assistants/card.py`, `lorebook.py`, `core.py`, graph loaders/runtime artifacts.
- BFF `src/database/mysql/models.py` document mutation/CAS helpers and `assistant_turn_store.py` adapters.
- Existing service/model/route and transaction tests.

Tasks:

1. Introduce one canonical tool specification per operation/type, including field policy and effect metadata. Generate graph projections rather than copy new schemas.
2. Extract pure document planning and explicit target-context validation.
3. Extract shared cursor-owned mutation commands from conversation-specific helpers. Preserve lock order and domain side effects.
4. Adapt existing editor handlers/stores to call the shared components.
5. Keep the main assistant text-only throughout this parity phase.
6. Resolve or restrict touched W-04b/W-04d behavior through the owning workspace/domain backlog.

Exit: unchanged editor behavior and wire shapes; generated/canonical schema parity; real transaction tests for CAS, creates, media/voices, memberships, persona defaults, and rollback. A wrapper around a copied helper is insufficient.

## P2 — main-page single-target document actions

Responsible: BFF, frontend, executor/profile, persistence, product.

Expected areas:

| Repository | Areas |
| --- | --- |
| magic-worlds-api | Assistant request/routes; app handler/controller; capability resolver; versioned app result/action persistence; feature/profile contracts |
| magic-worlds | Shared assistant types/verifier/API; hook adapter; main-page target/mode/action UI; knowledge source policy |
| api.magic_llm and profile catalog, as needed | Compatibility/feature verification for the versioned tool-capable app contract; no presumed executor support |

Tasks:

1. Add server capability projection, app-scoped tools master/per-toolset policy and preferences, dependency resolution, and source/target authorization. Client/source flags only narrow it. Personal settings must not change editor-assistant availability.
2. Implement the explicit app workflow version and single selected target/destination. Preserve legacy app and editor readers.
3. Add run/action identities and atomic document-command/receipt/terminal completion through the shared service.
4. Require a verified tool-capable published app profile; retain a visible text-only fallback without silently changing profiles.
5. Add target picker/chip, mode, Toolsets switches with persisted user/workspace preferences and availability reasons, honest direct-save wording, committed action cards, conflict UX, and list invalidation. Preserve dirty editors.
6. Add main-page creation only for types whose destination/default/media integrity gates pass.
7. Make source-off/focus/history and toolset-off semantics explicit and consistent. Apply read preferences to host snapshot preparation before model-facing discovery tools ship.
8. Verify replay/stop/dropped stream and single-operation billing.

Exit: one selected document can be edited or created from the main page with the exact shared tools, working independent toolset switches, no duplicate schemas/mutations, no new hidden editor thread, correct scoped receipt, no duplicate effect or debit, and feature-off fallback.

## P3 — focused search/read tools and bounded controller

Responsible: retrieval/BFF, frontend guide owner, executor/profile, billing/persistence.

Tasks:

1. Generate/publish a versioned localized guide artifact from existing guide content.
2. Add `mw_search_guide`, `mw_search_content`, `mw_get_content`, and `mw_prepare_edit` through shared scoped domain adapters. Reuse `mw_read_card` and card-context projection for card detail; restrict `mw_get_content` to non-card sources. Preserve roleplay snapshot-read behavior and add shared-read parity regressions.
3. Support opaque refs, paginated coverage, restricted nested projections, source lineage, and revision-aware citations. Filter shared search/get/preparation branches by the same existing toolset resolver.
4. Add a separately versioned app-step transport projection; keep current assistant/narrative parsers strict.
5. Construct a bounded typed trajectory from validated reads/results. Do not reuse tool-stripping legacy history as operational state.
6. Enforce model/read/write/time/context limits and stop conditions.
7. Implement the accepted run-level billing/capacity policy and aggregate execution provenance. No nested per-editor charge.
8. Add reference/history/cache invalidation on account/workspace/source changes.

Exit: representative discovery/answer/edit tasks pass retrieval and restraint evaluation, new persistence/billing is accepted, and no source-disabled or cross-scope reads occur. If billing/transport work is unfinished, retain P2 and do not imply P3 is shipped.

## P4 — controlled release

Responsible: release/ops, QA/evaluation, security/privacy, feature owners.

Suggested rollout order:

1. Internal Ask/retrieval with sanitized fixtures and platform profiles.
2. Selected-target patches for a limited type set.
3. All eligible saved card/lorebook types.
4. Creation and broad replacement only after their integrity/review gates pass.
5. Additional payers/providers only after corresponding compatibility and custody acceptance.

Introduce server-side switches for read tools and document-write capabilities, with frontend availability reflecting the server projection. These are proposed switches, not current env vars. Existing kind flags still apply.

The [master and seven toolset preferences](14_toolset_controls.md) are a required P2/P3 deliverable, not just operator rollout switches. Verify independent card/lorebook editor availability when a main-page toolset is off.

Run version/migration preflight, mixed-client compatibility, representative database tests, provider-backed contract tests, locale/browser acceptance, and load/lock tests. Record exact deployed artifacts, schema markers, profile/catalog revisions, payer, and retained evidence.

Exit: [release gates](12_evaluation_and_acceptance.md) pass, owners sign off, and rollback/reconciliation has been demonstrated.

## P5 — optional extensions

| Extension | Prerequisite | Reuse boundary |
| --- | --- | --- |
| Stable-ID lorebook entry operations | Identity/deletion/order contract and real need | Shared lorebook tools/domain service, usable by editor and main page |
| Deterministic lorebook validation/activation checks | Reuse actual activation engine and disclose current trace limits | Shared domain service; no fake “full audit” model tool |
| Body/semantic search | Measured metadata-search misses, index deletion/scope plan | Existing retrieval adapters with explicit new search semantics |
| Cross-document proposals | Changeset dependencies, review, checkpoints, billing, partial failure | Coordinate with novel/general changeset owners |
| Unsaved draft handoff | Explicit draft identity/base revision and dirty-editor contract | Shared planner, not ad hoc form scraping |
| Media/resource/attachment tools | Owned job/admission/permission/recovery contracts | Existing feature services, separately enabled and evaluated |

Do not turn this table into a promise that all tools are required for the first release.

## Dependency and ownership ledger

| Dependency | Owning authority | Impact |
| --- | --- | --- |
| ASST-R1/R2/R3 rollout, lifecycle, retention | [Current assistant contract](../app_assistant/README.md) | Preserve acceptance and resolve retention/copy before expansion |
| W-04b media references, W-04d default persona | [Workspace integrity](../workspace_r1/04_gaps_and_priorities.md) | Gate affected retained snapshots/creation paths |
| Executor/credential custody and diagnostics | [Security findings](../security/README.md), [LLM status](../llm_profiles/16_current_status_and_roadmap.md) | No new unsupported custody claims or BYOK release |
| Lorebook retrieval/activation/entry semantics | [Lorebook status](../lorebook/README.md) | Reuse domain behavior and its documented limits |
| Manuscript writes and broad writing changesets | [Novel assistant plan](../novel_refactor/08_ai_assistant_context_and_tools.md) | Separate initiative; do not duplicate tools or ownership |

## Operational rollback

Disable new tool dispatch, retain existing text Ask where supported, and keep authorized receipt readback/reconciliation available. Stop unstarted steps; do not delete or blindly replay committed actions. Preserve old graph/schema readers until retained executions expire under policy.

Database migrations need explicit compatibility and rollback plans; a runtime flag is not a database rollback. Profile/catalog rollback must not substitute a new revision into an admitted execution.

## Documentation maintenance during future implementation

Update [00](00_current_status_and_evidence.md) with bounded evidence per phase. Keep the existing assistant contract accurate when behavior actually changes. Update in-app guide/locales and feature availability only after implementation exists, using the same product-guide source.

Do not mark all phases complete because extraction tests pass or a local flag is true. Provider/database/deployment acceptance remain separate evidence.
