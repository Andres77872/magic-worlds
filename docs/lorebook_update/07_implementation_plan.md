# Implementation plan

**Status:** proposed work packages; none implemented by this documentation task. Ownership labels are roles, not assignments to named people. Effort and delivery dates require estimation after policy decisions and baseline restoration.

## Sequence

~~~text
WP00 baseline + WP01 decisions
  -> WP02 resource contracts
  -> WP03 permissions/regex and WP04 editing reliability
  -> WP05 activation policy + WP06 disclosure + WP07 accounting/placement
  -> WP08 effective context/preview + WP09 usage consistency
  -> WP10 performance + WP11 authoring/extraction/portability
  -> WP12 optional retrieval experiment
  -> WP13 staged acceptance/rollout
~~~

Independent packages may proceed concurrently only after interfaces are agreed. This is a planning dependency graph, not an instruction to spawn agents or start application work.

## WP00 — Restore a trustworthy validation baseline

**Role:** backend/frontend maintainers.
**Scope:** retain existing passing frontend coverage; isolate current-workspace tests; classify the backend failures.

Tasks:

- Reproduce the route dependency setup failure without running against production data.
- Make test feature-grant/shadow-user dependencies deterministic under controlled fixtures.
- Reconcile the assistant request_credentials expectation with the intended transport contract.
- Run selected route, persistence, loader, extraction, and consumer-context tests.
- Record commits, environments, exclusions, counts, and remaining failures.

**Exit:** either green affected suites or explicitly triaged unrelated failures with a reliable targeted baseline. Do not label 361/113 as a pass.

## WP01 — Accept policy decisions and capture current examples

**Role:** product + backend/frontend maintainers.
**Depends:** review, not implementation.

Tasks:

- Resolve D01–D10 as needed by each downstream package.
- Preserve legacy examples for history, order, budget, reveal, snapshots, and Story Studio copy behavior.
- Approve the first release's scope and defer optional features explicitly.
- Define compatibility, diagnostics, and migration behavior.

**Exit:** decisions have owners, dates, rationale, versioning, and concrete expected outputs.

## WP02 — Repair resource preview and snapshot contracts

**Role:** backend + frontend API maintainers.
**Findings:** F02; decisions D03/D04.

Tasks:

- Introduce separate source-write, preview, and snapshot representations.
- Resolve owned derivatives and linked resource versions server-side.
- Preserve unsaved draft edits under the accepted preview/snapshot policy.
- Validate new entry identities without requiring a saved-entry identity by accident.
- Update serializers/parsers and errors as one coordinated contract change.
- Keep source freshness, execution recovery, and archive guards.

**Exit:** embedded, shared-only, mixed, stale, pending, failed, new-draft, and frozen resource cases pass end-to-end contract tests.

## WP03 — Enforce permissions and bound matching work

**Role:** backend + frontend runtime maintainers.
**Findings:** F05/F07; decisions D05/D08.

Tasks:

- Derive resource permission needs from actual nested/hydrated candidates.
- Cover non-root grants, root exemptions, revocation, and existing attachments.
- Select a supported regex dialect/engine and execution-bound strategy after documentation review.
- Set configurable limits on patterns, keys, input text, candidates, recursion, and elapsed work.
- Validate before persistence and surface unsupported legacy patterns.
- Avoid a frozen UI or indefinitely blocked worker on invalid patterns.

**Exit:** no disallowed resource candidate reaches context; hostile fixtures are bounded; accepted patterns agree across paths.

## WP04 — Preserve drafts and reject stale writes

**Role:** frontend editor + backend persistence maintainers.
**Findings:** F06/F15; decision D04.

Tasks:

- Keep base revision, local draft, and acknowledged save separate.
- Merge attach/detach/extraction results by their affected domain fields.
- Protect keystrokes made after save dispatch.
- Add compare-and-swap inside book/entry/resource mutation transactions.
- Preserve rejected drafts and provide conflict/recovery feedback.
- Add dirty navigation/reload recovery without weakening workspace/account guards.
- Review immediate-delete behavior alongside full-book saves for consistent acknowledgement.

**Exit:** slow-response and two-client matrices preserve content, reject stale intent, and show accurate saved/dirty state.

## WP05 — Implement one deterministic activation policy

**Role:** backend context owner + frontend preview maintainer.
**Findings:** F01/F03/F10/F11/F14; decisions D01/D02/D05.

Tasks:

- Pass the authorized bounded message window from each consumer.
- Separate history and recursion fields/semantics.
- Resolve scope and snapshot/live precedence.
- Rank before admission; distinguish selection rank from insertion order.
- Enforce accepted entry/book/conversation budget ownership.
- Apply book defaults/overrides and correct both languages' logic copy.
- Define Unicode literal matching and common fixture parity.
- Produce versioned structured exclusion reasons.

**Exit:** permutation, multi-turn, recursion-cycle, six-mode logic, Unicode, and compatibility fixtures pass; preview uses the same policy.

## WP06 — Make reveal and audience behavior explicit

**Role:** product + backend context owner.
**Finding:** F04; gaps G03/G04; decision D06.

Tasks:

- Separate relevance from disclosure eligibility.
- Apply the chosen reveal gate after every activation route, including constants and pins.
- Decide missing/legacy reveal-condition handling.
- Add only the required session/branch state model.
- Classify or require review of secret-bearing imported snippets.
- Define author-facing versus player-facing trace redaction.

**Exit:** disallowed facts are absent from selected packets in the policy fixtures; model-level spoiler tests are recorded separately.

## WP07 — Account for final prompt cost and supported placement

**Role:** backend prompt/runtime owner.
**Findings:** F08/F09; decisions D02/D07.

Tasks:

- Choose model-compatible accounting with a conservative labeled fallback.
- Reserve complete base request, protected history, and output capacity.
- Implement actual approved insertion locations or simplify the UI contract.
- Capture provider-bound messages for tests without calling a provider.
- Define behavior when protected context cannot fit.
- Prevent a broad summary from taking precedence accidentally over precise facts.

**Exit:** rendered message captures and accounting match the trace across model-profile fixtures, including no-space text and wrappers.

## WP08 — Deliver effective-context inspection and fresh previews

**Role:** frontend + backend API maintainers.
**Findings:** F12/F13; gap G08.

Tasks:

- Share one effective target/attachment projection with live resolution.
- Show inheritance, linked/frozen mode, source revision, and fetch failures.
- Invalidate session markers after attach/detach/source changes.
- Bind preview responses to inputs and reject stale responses.
- Always display exclusion reasons, even when keys matched.
- Explain that mention decoration is not proof of budget admission.
- Expose an authorized per-reply trace with appropriate secret redaction.

**Exit:** inspector, preview, and captured live packet agree for equivalent inputs; late/error states are visible and recoverable.

## WP09 — Align consumer and copied-reference semantics

**Role:** roleplay/call/Story Studio maintainers + product.
**Finding:** F16; gap G01; decision D09.

Tasks:

- Decide persona attachment coverage and test every mode.
- Preserve the correct session workspace and frozen card identities.
- Explain Story Studio pinned-copy behavior and preserve approved audience metadata.
- Add conditional mode only if accepted; do not silently convert existing copies.
- Preserve source-change review and content-stamp protections.

**Exit:** adventure, solo/group chat, call, and Story Studio mode matrices pass with no accidental cross-context inheritance.

## WP10 — Reduce measured loading cost

**Role:** backend persistence + frontend data maintainers.
**Finding:** F17; decision D10.

Tasks:

- Measure query count, payload, memory, and latency at small/typical/large fixtures.
- Introduce summary DTOs for lists/pickers and lazy source text reads.
- Batch entry/attachment/resource reads for effective activation.
- Cache only with owner/workspace/permission/source/policy-aware keys.
- Preserve consistent snapshots across concurrent updates.
- Set benchmark targets from measurements, not invented requirements.

**Exit:** approved limits are met and permission/freshness/concurrency tests remain green.

## WP11 — Improve authoring, extraction review, and native portability

**Role:** product + frontend/backend maintainers.
**Gaps:** G04/G05/G06/G09/G10.

Tasks:

- Add source anchors and reviewable generated changes under the accepted workflow.
- Enforce extraction output limits in code.
- Add in-book search/filter/duplicate/bulk operations using existing UI primitives.
- Implement native versioned export/import and loss reporting.
- Treat external adapters as separately scoped work.
- Update maintained Markdown and in-app English/Spanish guide claims.

**Exit:** author workflow, extraction faithfulness, native round-trip, malformed import, and keyboard journeys pass.

## WP12 — Evaluate optional semantic retrieval

**Role:** retrieval/evaluation maintainer.
**Gap:** G07.
**Depends:** stable policy, authorization, provenance, budgeting, and a fixed gold dataset.

Tasks:

- Compare improved lexical baseline with semantic and hybrid candidates.
- Measure factual recall, irrelevant context, secrecy, latency, and cost.
- Test stale index/version changes and permission revocation.
- Keep the path optional and its provenance inspectable.
- Select infrastructure only if results justify it.

**Exit:** a written experiment decision, including “do not ship,” is valid. No vendor or infrastructure choice is pre-approved.

## WP13 — Acceptance, compatibility, and staged rollout

**Role:** release owner + affected maintainers.
**Depends:** required earlier packages and [document 10](10_acceptance_and_rollout.md).

Tasks:

- Complete source/schema/policy compatibility checks and migration dry runs.
- Run the matching frontend/BFF/schema and non-root permission matrix.
- Record controlled live inference results only after provider use is authorized.
- Verify actual rendered desktop/narrow/keyboard journeys.
- Record rollback triggers, restore procedure, and final release evidence.

**Exit:** the defined release slice meets acceptance with dated evidence. An implemented source path alone is not release acceptance.

## Scope exclusions

No automatic rewriting of users' books, mass data deletion, provider/model changes, new direct frontend service calls, general app redesign, or production migration is included. Such work requires separate concrete scope.
