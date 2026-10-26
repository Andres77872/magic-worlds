# Decisions and tracking

## Decision status

All decisions below are open. Recommendations are defaults for discussion, not accepted product requirements. Resolve the minimum decisions needed by a work package and continue independent work only within its authorized scope.

| ID | Decision | Recommendation to review | Owner role | Status |
|---|---|---|---|---|
| D01 | History window, message roles/counting, names, edits/branches/regeneration | Separate history depth from recursion; define a versioned window policy | Product + context maintainer | Open |
| D02 | Conversation/book/entry budget ownership, rank, mandatory entries, recursion scope | One explicit conversation ceiling, documented book caps and stable selection; recursion boundaries independent of incidental book order | Product + runtime maintainer | Open |
| D03 | Snapshot closure, source revisions, unsaved draft preview/snapshot authority | Server-constructed immutable resource closure; preview hydrates owned derivatives | Backend API + product | Open |
| D04 | Revision/CAS granularity, retry identity, dirty recovery, merge behavior | Preserve draft/base/acknowledged states and compare expected revision transactionally | Persistence + editor maintainers | Open |
| D05 | Default inheritance, Unicode/case rules, regex dialect and bounds, enum compatibility | Explicit inherit/override, shared fixtures, restricted bounded regex; preserve old enum meaning | Runtime + frontend maintainers | Open |
| D06 | Secret/reveal semantics, missing conditions, narrator/character/player audiences, branch state | Separate relevance from disclosure; do not infer narrative authorization from a phrase | Product + context maintainer | Open |
| D07 | Supported insertion slots, model accounting, fallback behavior | Offer only locations the assembler supports; account for complete request with labeled fallback | Prompt/runtime maintainer | Open |
| D08 | Optional-feature revocation, existing attachments, root exemptions, failure/degradation | Enforce grants consistently; choose explicit blocked/degraded behavior instead of accidental bypass | Product + permission maintainer | Open |
| D09 | Story Studio pinned-copy versus conditional mode; persona coverage across consumers | Explain existing pinned copies; preserve audience policy; align persona rules deliberately | Product + consumer maintainers | Open |
| D10 | Typical/max library sizes, performance budgets, cache/index lifecycle, semantic experiment gate | Measure before selecting infrastructure or numeric thresholds | Backend/data + evaluation maintainers | Open |

If a decision becomes large, create a focused ADR and link it here. Do not replace an unresolved choice with an undocumented implementation default.

## Finding-to-work mapping

All findings remain open.

| Finding | Main work packages | Validation | Acceptance |
|---|---|---|---|
| F01 | WP01/WP05 | T01/T02 | AC01 |
| F02 | WP02 | T05/T06 | AC02 |
| F03 | WP01/WP05/WP07 | T03/T04 | AC03 |
| F04 | WP06 | T07/T22 | AC04 |
| F05 | WP03 | T04/T08 | AC05 |
| F06 | WP04 | T10 | AC06 |
| F07 | WP03 | T09/T25 | AC07 |
| F08 | WP07 | T12 | AC08 |
| F09 | WP07 | T13 | AC09 |
| F10 | WP05 | T14 | AC10 |
| F11 | WP05/WP11 | T15 | AC11 |
| F12 | WP08/WP09 | T16/T21 | AC12 |
| F13 | WP08 | T17 | AC13 |
| F14 | WP05 | T19 | AC14 |
| F15 | WP04 | T11 | AC15 |
| F16 | WP09 | T20 | AC16 |
| F17 | WP10 | T18/T25 | AC17 |

Work packages: [document 07](07_implementation_plan.md). Tests: [document 08](08_validation_and_evaluation.md). Acceptance: [document 10](10_acceptance_and_rollout.md).

## Gap-to-work mapping

| Gap | Work packages | Requirement before shipping |
|---|---|---|
| G01 — Persona coverage | WP09 | Accepted consumer target policy and T21 |
| G02 — Pin/mute/continuity | WP05/WP06/WP08 | Budget, audience, expiration/branch rules |
| G03 — World state/knowledge | WP06, separately scoped extension if needed | State ownership and timeline model |
| G04 — Extraction faithfulness/review | WP02/WP06/WP11 | Source support and review/recovery policy |
| G05 — Campaign authoring | WP11 | Agreed operations and keyboard usability |
| G06 — Portability | WP02/WP11 | Native schema/version and loss reporting |
| G07 — Semantic/hybrid retrieval | WP12 | Stable baseline, permissions, quality/cost/latency evidence |
| G08 — Diagnostics/telemetry | WP08/WP10 | Viewer/redaction and measured baseline |
| G09 — Explanations/accessibility | WP08/WP11 | Truthful copy, focus/error/keyboard acceptance |
| G10 — Documentation drift | WP11/WP13 | Maintained reference and in-app claims updated |

## Existing lorebook-roadmap alignment

The [maintained lorebook reference](../lorebook/README.md) already has LORE-R1–R5. This dossier expands the evidence rather than inventing another completed roadmap.

| Existing item | Dossier coverage |
|---|---|
| LORE-R1 — Release/attachment/activation matrix | F02/F07/F12/F16, G01; WP02/WP03/WP08/WP09/WP13 |
| LORE-R2 — Budget/trace policy | F01/F03/F08/F09/F10/F11/F13/F14; WP05/WP07/WP08 |
| LORE-R3 — Resource/assistant lifecycle | F02/F06/F15, G04; WP02/WP04/WP11 |
| LORE-R4 — Portable import/export | G06; WP11 |
| LORE-R5 — Retrieval/reveal semantics | F04/F16, G02/G03/G07; WP06/WP09/WP12 |

## Closure checklist

- [ ] Baseline failures are classified and the affected validation setup is reliable.
- [ ] Required policy decisions are accepted with rationale and compatibility handling.
- [ ] Each implemented finding has an application change and meaningful regression evidence.
- [ ] Serializer/model/runtime boundaries are tested together.
- [ ] Final request capture matches trace and budget claims.
- [ ] Owner/workspace/grant/audience negative cases pass.
- [ ] Dirty drafts and stale-client writes preserve author content.
- [ ] Linked/frozen resources and consumer modes have matching acceptance evidence.
- [ ] Migration dry run, restore plan, and rollback checks are recorded.
- [ ] Actual browser journeys and any authorized model evaluation are recorded.
- [ ] Maintained Markdown/in-app claims reflect the shipped slice.
- [ ] Optional gaps are explicitly accepted, deferred, or rejected.

These boxes intentionally remain unchecked.

## Tracking rules

- Preserve original finding IDs even if implementation splits or combines tasks.
- Add source and test revisions to closure records; “fixed” requires evidence.
- A decision can be accepted while implementation remains open.
- An implementation can be merged while deployment acceptance remains open.
- An intentional behavior can resolve a semantics gap only when its UI/documentation and tests agree.
- Record residual limitations instead of removing an awkward finding.
- Changes in code after the audit may invalidate a line anchor; recheck the named symbol and commit.
- Keep this dated evidence separate from future status updates.

## Suggested handoff record

~~~text
Work package:
Findings/gaps:
Accepted decisions and ADRs:
Frontend/backend changes:
Data/schema/policy compatibility:
Tests and relevant failures:
Manual/request-capture evidence:
Migration/rollback evidence:
Unresolved risks:
Status: proposed / implementing / implemented locally / accepted / deployed
Maintainer/reviewer/date:
~~~

The documentation request created a concrete audit and plan. It did not start these application work packages.
