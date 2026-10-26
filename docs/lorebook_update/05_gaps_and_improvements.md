# Gaps and improvements

The 17 findings are in [document 02](02_findings_register.md). This file records additional product work and improvements, including ideas from the conversation that are not approved implementation requirements.

All items below are proposed. P1 correctness work takes precedence over broad feature expansion.

## G01 — Consistent persona attachment coverage

**Current evidence:** adventure construction inserts the persona among character targets. Character-chat and call lore target lists include AI character cards but omit the persona. See [adventure assembly](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L545), [chat assembly](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L664), and [call assembly](../../../../PycharmProjects/magic-worlds-api/src/routes/user/route_chat.py#L808).

**Impact:** lore attached to who the user plays may participate in one experience and be absent in another.

**Proposal:** decide whether persona attachments are part of the effective set in every roleplay mode. If included, keep the session's frozen card identity/workspace rules and provide an inheritance explanation.

**Acceptance:** the same persona-lore fixture is compared in adventure, solo/group chat, and call context assembly. This is source-supported; no live chat outcome was measured.

## G02 — Session pin, mute, and continuity controls

**Gap:** no explicit user control was established for keeping a relevant entry active for a scene or excluding inherited lore from one session.

**Proposal:** support a small session-level pin/mute model before adding probabilistic behavior. Decide whether a pin bypasses keyword matching, how it consumes budget, and how it expires. A pin must not bypass ownership, feature permissions, or audience eligibility.

**Acceptance:** pin/mute changes take effect in the next confirmed turn and appear in the effective-context inspector; history edits and branches have a defined policy.

## G03 — World state and character knowledge

**Gap:** entry types such as state, quest, and relationship categorize text but are not a structured event/state engine. Reveal text does not establish durable knowledge.

**Proposal:** first define canonical facts versus session-local state. If needed, add a narrow state journal with explicit author changes and branch semantics. Do not automatically write generated statements into global canon.

**Acceptance:** revisiting an earlier scene or branching a conversation cannot silently inherit future state. Different characters can have distinct knowledge without relying solely on prose instructions.

## G04 — Faithful extraction and review

**Current evidence:** snippets and summaries are schema-validated; hashes establish source identity/freshness. A snippet.source string is not verified against an exact passage. Completed results can become activation candidates immediately.

Evidence: [snippet validation](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_resources.py#L662), [extraction persistence](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_extraction_execution.py#L94), [candidate generation](../../../../PycharmProjects/magic-worlds-api/src/services/lorebook_activation.py#L274).

**Inferred risk:** unsupported facts, lost qualifications, leaked source instructions, or unclassified secrets can become apparent canon. This audit did not execute a model attack or score extraction faithfulness.

**Proposal:**

- Link snippets to source revision plus exact span/heading and a recoverable excerpt.
- Show added, changed, and removed generated material before author acceptance where the product chooses a review workflow.
- Distinguish extracted quotations, generated summaries, and authored instructions.
- Preserve recovery receipts and source-change conflict checks.
- Prevent broad document summaries from crowding out precise snippets without an intentional ranking rule.
- Validate output counts and sizes in code; instructions such as “max 16” are not themselves enforcement.

**Acceptance:** source edits invalidate the appropriate derivatives; accepted claims have inspectable support; review/retry does not duplicate inference or erase manual corrections.

## G05 — Authoring at campaign scale

**Gap:** the entry table is a scrollable list without a complete in-book search/filter/bulk-edit workspace.

**Proposal:** add text/type/status/key search, duplicate entry, bulk enable/disable, reorder, and grouping. Offer optional entry recipes and key-quality hints. Keep advanced fields discoverable without requiring every author to configure them.

**Acceptance:** a user can locate and safely modify a specific entry in a large synthetic book by keyboard. Reuse existing primitives and read the UI skills before implementation. A new wizard is optional, not required by this dossier.

## G06 — Native portability and compatibility adapters

**Gap:** importing text resources is not a portable lorebook interchange system.

**Proposal:** deliver versioned native JSON backup/restore first. Preserve stable identities or provide an explicit remapping manifest, complete settings, resource versions, and snapshot provenance. External format adapters are a later, separate decision.

**Acceptance:**

- A native export/import/export round-trip preserves supported content and meaning.
- Secrets and private source data are disclosed as part of export scope.
- Unknown external fields are retained in a bounded, namespaced inert form or rejected with a clear loss report.
- Unknown metadata is never executed as a graph, tool, or instruction configuration.
- Imports enforce size/count limits and require explicit review of unsupported semantics.
- No format compatibility is claimed without authoritative schema review and fixtures.

The older lorebook reference's adapter ideas remain design input, not acceptance of any particular adapter.

## G07 — Optional semantic and hybrid retrieval

**Gap:** keyword retrieval does not handle every paraphrase or alias automatically.

**Proposal:** establish an improved lexical baseline first. Then compare semantic-only and hybrid candidates under identical permissions, source versions, and context ceilings. Keep exact-key activation available and explain which retrieval path selected an entry.

**Acceptance:** measured gain on representative fiction cases without unacceptable noise, secret exposure, latency, cost, or stale-index behavior. No new database, embedding vendor, or service is selected by this document.

## G08 — Privacy-aware diagnostics and quality telemetry

**Gap:** stored activation metadata is not a complete accessible per-reply inspector, and no measured quality baseline was established.

**Proposal:** expose decisions to the authorized author while limiting player-facing secret detail. Measure activation/exclusion counts, context usage, stale preview incidents, extraction freshness, and lookup latency. Keep raw secret content and provider credentials out of routine telemetry.

**Acceptance:** a support/debug record identifies policy and revisions without requiring broad prompt-content logging. Diagnostic access follows the same workspace/owner boundaries.

## G09 — Clear product explanations and accessible feedback

**Proposal:** explain linked versus frozen content, explicit default inheritance, primary versus secondary keys, budget exclusion, reveal behavior, and the difference between a mention and an activated entry. Display fetching failures and retry controls instead of treating every failure as an empty lore set.

**Acceptance:** English and Spanish copy share the truth table; keyboard/focus/status behavior is tested in the actual lorebook surfaces. This audit did not perform a rendered WCAG review.

## G10 — Documentation and compatibility maintenance

**Gap:** the older feature reference includes stale environment-flag language and historical plans.

**Proposal:** update the maintained lorebook reference and in-app guide when each implementation change lands. Record policy/schema versions and migration results. Keep this dated audit as evidence rather than relabeling its old observations as current behavior.

**Acceptance:** maintained product claims, runtime permissions, controls, and test evidence agree. Do not broaden this into unrelated documentation cleanup.

## Improvement horizon

| Horizon | Work |
|---|---|
| Reliability first | F01–F15 as applicable, trustworthy resource contracts, persona policy decision |
| Author workflow | G02, G04, G05, G08, G09 |
| Portability | G06 after native contract/version decisions |
| Advanced continuity | G03 after audience and branch rules |
| Retrieval experiment | G07 after baseline/evaluation readiness |
| Ongoing upkeep | G10 and regression evidence |

There is no committed release date, staffing estimate, or delivery promise.
