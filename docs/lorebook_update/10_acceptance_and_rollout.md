# Acceptance and rollout

**Status:** proposed acceptance gates. No migration, deployment, feature graduation, or production acceptance occurred in this documentation task.

## Finding acceptance

| Gate | Required observable result | Finding |
|---|---|---|
| AC01 | History window and recursive pass count have separate named semantics in every consumer and preview | F01 |
| AC02 | Embedded/shared resources survive real preview/snapshot contract round-trips; authority stays server-owned | F02 |
| AC03 | Book ordering cannot change budget/rank except through accepted explicit precedence; recursion obeys scope | F03 |
| AC04 | Constant/key/recursive/resource paths obey the accepted disclosure policy | F04 |
| AC05 | Accepted regex dialect agrees and matching work is bounded on frontend/backend | F05 |
| AC06 | Delayed responses and resource mutations preserve edits made after dispatch | F06 |
| AC07 | Non-root resource activation checks the correct grant, including revocation cases | F07 |
| AC08 | Complete request accounting stays within input/output allowances with a labeled fallback | F08 |
| AC09 | Actual provider-bound message capture confirms every offered placement | F09 |
| AC10 | Default inheritance and explicit overrides behave as explained | F10 |
| AC11 | All six logic modes, English/Spanish labels, and assistant descriptions agree | F11 |
| AC12 | Session view explains inherited, linked/frozen, fresh/stale sources and updates immediately | F12 |
| AC13 | Preview identifies its input version and shows exclusion reasons even after a key match | F13 |
| AC14 | Supported Unicode fixtures agree across matching paths | F14 |
| AC15 | Stale writes are rejected without losing the user's draft | F15 |
| AC16 | Story Studio copy mode and audience behavior are explicit and tested | F16 |
| AC17 | Measured list/activation cost meets approved targets with no freshness/scope regression | F17 |

All gates relevant to the selected release slice need dated evidence. P1 exceptions require an explicit scope/disposition; hiding a failing flow behind a rollout flag does not fix it.

## Compatibility intake

Before modifying persisted interpretation:

1. Inventory book/attachment/resource shapes, identities, stored matching options, and snapshots.
2. Identify regex patterns and reveal conditions needing migration review.
3. Compare legacy and proposed activation outcomes on synthetic and appropriately authorized representative data.
4. Count affected objects and explain changed outcomes to reviewers.
5. Decide how existing sessions and Story Studio copies retain their policy.
6. Verify source/schema compatibility with the exact frontend/BFF pair.
7. Prepare a reversible migration and a verified backup of affected data.

No mass deletion, automatic author-content rewriting, or broad snapshot replacement is authorized by this dossier.

## Migration rules

- Keep scanDepth's historical meaning under a legacy policy until an explicit migration maps it.
- Never use current linked content to silently fill an old snapshot.
- Preserve entry/resource/source IDs where required by Story Studio, execution recovery, and references; otherwise provide a complete remap.
- Do not trust client-provided extraction metadata during a migration.
- Preserve explicit matching choices; disclose any default/inheritance conversion.
- Unsupported regex or incomplete secret configuration needs an actionable disposition.
- Dry-run changes before writes and retain an affected-record manifest.
- A rollback must account for edits created after migration; blindly restoring an old database snapshot can lose new work.

## Proposed rollout stages

| Stage | Activities | Required evidence |
|---|---|---|
| Local correctness | Controlled fixtures, contracts, request capture, editing races | WP00–WP08 applicable tests and triaged failures |
| Integrated environment | Matching frontend/BFF/schema; non-root grants; archive/workspace modes | AC matrix with actual revisions/configuration |
| Limited author trial | Selected participants using existing permission controls; inspectable policy/version | Multi-turn, resource, secret, and draft-preservation journeys |
| Controlled inference | Authorized provider use on synthetic scenarios | Continuity, source faithfulness, spoiler, usage/cost observations |
| Wider use | Expand only the accepted release slice | Monitoring baseline, rollback proof, unresolved P2 dispositions |
| Optional retrieval trial | Separate semantic/hybrid experiment | Fixed baseline comparison and index permission/freshness tests |

Current feature access follows membership grants. Do not reintroduce Vite feature environment variables or invent permanent bypass grants to make rollout easier. Environment-specific provider/extraction configuration still requires verification.

## Operational signals

Measure:

- Pattern rejections, execution deadline breaches, and activation errors.
- Unexpected source/snapshot validation failures.
- Context exclusions by stable reason and used/available budget.
- Permission denials and stale permission/source decisions.
- Conflict responses, draft recovery, and failed saves.
- Preview fingerprint mismatches and stale response suppression.
- Resource extraction freshness, recovery, and reviewed changes.
- List/activation queries, response bytes, latency, and memory at measured sizes.

Restrict diagnostic access. Avoid routine raw prompt, secret text, source document, credential, or private-message logging. Titles and matched keys can themselves disclose lore and need the accepted viewer policy.

No numeric service-level objective is claimed here. Establish targets from the baseline and operational requirements.

## Rollback triggers

A release needs an immediate investigation/containment path for:

- Cross-owner/workspace access or missing active grant enforcement.
- Silent author-edit loss or a stale write accepted as current.
- Frozen resources changing with live content or disappearing from snapshots.
- Unbounded matching work or repeated worker/browser stalls.
- Disallowed secret content in the generation packet.
- Preview/trace claiming a different source revision or policy than the built packet.
- Material context-budget or latency regression beyond the approved threshold.

## Rollback procedure to prepare

1. Stop further rollout and identify the exact frontend/BFF/schema/policy versions.
2. Disable the affected optional path through existing controls if that preserves critical permissions and data.
3. Preserve failed drafts, operation receipts, source revisions, and the migration manifest.
4. Roll application/policy code back only to a schema-compatible version.
5. Restore or compensate affected records using the prepared plan, preserving subsequent legitimate edits.
6. Verify permission enforcement, linked/frozen behavior, and recovery after rollback.
7. Record the incident/disposition and reopen affected finding gates.

This is a procedure to make concrete during implementation; it is not an executed rollback or permission to perform one.

## Release evidence record

Complete this template for an accepted release:

~~~text
Release slice:
Frontend commit:
Backend commit:
Schema/migration version:
Activation policy version:
Permission/extraction configuration reviewed:
Accepted decisions:
Automated checks and counts:
Request-capture parity:
Manual journeys and viewers:
Controlled model evaluation and usage:
Performance measurements:
Migration dry-run and backup verification:
Rollback test:
Known limitations and finding dispositions:
Reviewer/date:
~~~

Do not fill unknown fields with “passed” or call a locally implemented feature deployed.
