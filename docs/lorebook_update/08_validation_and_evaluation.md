# Validation and evaluation

## Observed audit results

These results were obtained during the 2026-10-19 read-only audit at the revisions in [document 01](01_scope_and_current_behavior.md). They are not results for the proposed fixes.

| Check | Observed result | Interpretation |
|---|---|---|
| Current-workspace frontend selection | 21 files, 161 tests passed | Existing selected unit/component coverage passed |
| Initial unfiltered frontend selection | Also discovered nested .claude/worktrees tests; failures included duplicate React/hook behavior | Not accepted as the current-workspace result; rerun excluded nested copies |
| Selected backend run | 361 passed, 113 failed | Not a clean backend validation result |
| Route failure spot check | Uninitialized MySQL pool reached through feature-flag/shadow-user dependency | Test dependency setup must be repaired/classified |
| Assistant failure | Test expected a request body without request_credentials | Intended transport contract and expectation need reconciliation |
| Pure activation probes | Budget, recursion, reveal, defaults, boundaries, identity, logic, and token cases reproduced | Controlled engine-level evidence |
| Cross-wire resource probes | Embedded preview rejected; snapshot validation rejected; shared resources omitted | Serializer-to-route/model evidence without DB insertion |
| Loader permission probe | Only lorebooks requested while a resource snippet activated | Missing resource permission request reproduced |
| Regex children | Python and Node cases exceeded a 0.5-second deadline and were terminated | Bounded local evidence, not production load measurement |
| Production build, authenticated browser flows, live provider calls, production load | Not performed | No corresponding readiness claim |

Runtime versions observed: Node 24.16.0, pnpm 11.5.1, Vitest 4.1.8, Python 3.13.16. Existing tests emitted expected simulated “Network lost” stderr in recovery cases; the accepted frontend run still passed.

The full broad backend output was returned in the audit session and is summarized here; a durable complete raw backend log was not saved. Do not invent a per-failure root-cause attribution. One route-failure spot check does not prove that all 113 failures share the same cause.

## Commands used

From the frontend root:

~~~bash
pnpm exec vitest run \
  src/features/lorebook \
  src/infrastructure/api/__tests__/lorebookWire.test.ts \
  src/infrastructure/api/__tests__/lorebookExtraction.test.ts \
  src/infrastructure/api/lorebookResources.test.ts \
  --exclude '**/.claude/**' \
  --exclude '**/.codex/**' \
  --reporter=dot
~~~

From the backend root, using the existing virtual environment:

~~~bash
.venv/bin/python -m pytest -q \
  tests/services/test_lorebook_activation.py \
  tests/services/test_lorebook_loader.py \
  tests/services/test_lorebook_resources.py \
  tests/services/test_lorebook_extraction_workspace.py \
  tests/services/test_lorebook_extraction_profiles.py \
  tests/services/test_assistant_lorebook.py \
  tests/routes/test_lorebook_routes.py \
  tests/routes/test_lorebook_pdf_import.py \
  tests/models/test_lorebook_aggregate_persistence.py \
  tests/models/test_lorebook_attachment_persistence.py \
  tests/models/test_lorebook_story_models.py
~~~

Route setup spot check:

~~~bash
.venv/bin/python -m pytest -q \
  tests/routes/test_lorebook_routes.py \
  --maxfail=1 --tb=short
~~~

These commands may produce incidental test caches. They do not require adding application tests during a documentation-only task. Future implementation must run the project's appropriate checks, including pnpm build for application changes and story typechecking if stories change.

## Required future test matrix

| ID | Case | Layers | Findings/gaps |
|---|---|---|---|
| T01 | Recent user key, assistant-introduced key, indirect follow-up, depth boundary | Engine + consumer context | F01 |
| T02 | History edits, deletion, regeneration, and branches | Engine + integration | F01, G03 |
| T03 | Reordered books, distinct caps, empty/disabled first book, stable ties | Engine + persistence input | F03 |
| T04 | Recursion off/on per scope, cycles, negative secondaries, pass/text limits | Engine | F03/F05 |
| T05 | Embedded/shared/mixed resources through serializers and route models | Contract + persistence | F02 |
| T06 | New draft IDs, pending/stale/failed extraction, frozen source updates | Contract + integration | F02, G04 |
| T07 | Constant/key/recursive/pinned secrets with allowed and denied reveal | Engine + final packet | F04 |
| T08 | Common regex acceptance, invalid dialect, pathological patterns | Isolated process + contract | F05 |
| T09 | Non-root grant combinations, root exemption, revocation after attach | Permission + consumer integration | F07 |
| T10 | Delayed save with intervening edits; attach/detach/extraction while dirty | Component + integration | F06 |
| T11 | Concurrent tabs, assistant/manual write, resource/manual write, retry | Persistence + component | F15 |
| T12 | Model accounting, wrappers/tools/history/output reserve, no-space content | Compiler/transport capture | F08 |
| T13 | Every supported placement in actual request messages | Prompt capture | F09 |
| T14 | Inherit/explicit defaults, new/reloaded/imported/generated entries | Engine + editor | F10 |
| T15 | Truth table for all six logical modes in English and Spanish copy | Engine + component | F11 |
| T16 | Effective inherited attachments, linked/snapshot view, immediate invalidation | API + component + browser | F12 |
| T17 | Stale preview fingerprint, late response, matched-but-excluded reason | Component + contract | F13 |
| T18 | Query count, bytes, memory, latency across library sizes | Benchmark | F17 |
| T19 | Accents, combining marks, punctuation, case policy, unspaced text | Shared fixtures | F14 |
| T20 | Story copy/reload/source review/audience semantics | Story integration + browser | F16 |
| T21 | Persona lore across adventure, solo/group chat, and calls | Context assembly | G01 |
| T22 | Source-supported snippets, unsupported claims, source instructions, removed facts | Extraction evaluation | G04 |
| T23 | Native round-trip, malformed/oversized import, unknown fields, ID remap | Contract + browser | G06 |
| T24 | Search/filter/duplicate/bulk operation and keyboard/focus paths | Component + browser | G05/G09 |
| T25 | Permission/source/version changes with any retrieval cache/index | Integration | G07/G08 |
| T26 | Fixed lexical baseline versus optional semantic/hybrid candidate | Offline + controlled model evaluation | G07 |

A matching unit test is not enough for F02, F09, or F12: they cross serializer, assembler, or consumer boundaries. Capture the actual constructed request without a provider call before adding model-level tests.

## Gold dataset design

Use original synthetic fiction fixtures with:

- Book, attachment, entry, resource, and source-version identities.
- Conversation mode/workspace and authorized permissions.
- Input messages plus policy version and relevant session state.
- Expected selected entries, forbidden entries, exclusion reasons, and protected facts.
- Exact source passages for extraction claims.
- Expected output constraints where a model response is evaluated.

Include English and Spanish, indirect references, alias ambiguity, GM-only facts, contradictory versions, old snapshots, broad summaries, and tight budgets. Have a human review expected outcomes before tuning retrieval. Separate a fixed regression set from an exploration set.

Do not use raw private user conversations as a convenient dataset without an appropriate data decision.

## Metrics and proposed gates

| Metric | Definition/use | Gate policy |
|---|---|---|
| Required-fact recall | Required facts present in selected context divided by expected facts | Set a baseline and agreed target by scenario |
| Irrelevant-context rate | Selected content judged unrelated to the current scenario | Compare against baseline under equal budgets |
| Forbidden-fact inclusion | Disallowed secret/tenant/workspace facts in selected context | Zero in controlled policy fixtures |
| Decision parity | Preview/runtime decisions for identical authorized inputs | Exact for deterministic policy fixtures |
| Budget compliance | Final accounted request versus allowed input/output reserve | No overrun in tested supported configurations |
| Source support | Accepted generated claims linked to supporting source spans | Review required for sampled/critical cases |
| Edit integrity | Preserved edits and conflict detection in race fixtures | No silent loss in the defined matrix |
| Retrieval latency/query/payload | Measured resource usage at approved fixture sizes | Thresholds selected after baseline measurement |
| Model continuity/faithfulness | Output respects required facts and exceptions | Human-reviewed rubric; no fabricated score |
| Generation cost | Observed input/output usage under equal tasks | Record actual usage, not word estimates |

Do not set a cosmetic “95% pass” gate that permits a disclosure or data-loss fixture to fail. Quality targets for ordinary recall/noise remain decisions until measured.

## Manual acceptance journeys

1. Create a book, save it, edit it, and preserve later keystrokes through a delayed save.
2. Attach and detach a shared resource while the entry draft is dirty.
3. Run preview on a new book, new entry, completed embedded source, and shared-only source.
4. Create a snapshot, change the live book/resource, and verify the frozen content.
5. Continue a multi-turn scene using a pronoun or follow-up and inspect its selected lore.
6. Combine multiple books under a tight budget; explain every exclusion.
7. Verify secret handling as author, narrator, and target character under the accepted policy.
8. Exercise global/card/template/session inheritance and persona policy.
9. Switch/archive workspaces and rotate/re-authenticate sessions during async work.
10. Inspect a Story Studio copy and understand its distinct behavior.
11. Complete keyboard/narrow-screen authoring, including visible errors and retry.
12. Export/import a native book only after that feature is implemented.

These journeys are planned, not recorded as completed.
