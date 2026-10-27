# Lorebook update: audit, research, and remediation dossier

**Reviewed:** 2026-10-19
**Status:** audit complete; remediation and product decisions proposed; application changes not started.
**Scope:** lorebook authoring, resources, attachments, activation, and usage in roleplay, adventures, calls, and Story Studio.

The lorebook has substantial authoring and persistence support. Its highest-impact weaknesses are differences between user-visible controls and effective generation behavior, resource preview/snapshot contracts, secret handling, and editing reliability. This dossier preserves the full audit and turns it into reviewable implementation work.

This dossier records findings and proposed changes. Application code, schema, deployment, and permission configuration were not changed by this documentation task.

## Reading order

| Document | Purpose |
|---|---|
| [01 — Scope and current behavior](01_scope_and_current_behavior.md) | Revisions, audit method, architecture, workflow coverage, and existing strengths |
| [02 — Findings register](02_findings_register.md) | All 17 findings, evidence, examples, impact, and remediation direction |
| [03 — Impact and priorities](03_impact_and_priorities.md) | User journeys, technical consequences, risk ranking, and dependencies |
| [04 — Research and best practices](04_research_and_best_practices.md) | Primary sources, research conclusions, applicability, and limits |
| [05 — Gaps and improvements](05_gaps_and_improvements.md) | Product backlog beyond defect correction, including persona coverage and source quality |
| [06 — Proposed behavior and contracts](06_proposed_behavior_and_contracts.md) | Candidate activation pipeline, contract boundaries, invariants, and compatibility |
| [07 — Implementation plan](07_implementation_plan.md) | Phased work packages, ownership roles, dependencies, and completion evidence |
| [08 — Validation and evaluation](08_validation_and_evaluation.md) | Observed test results, future test matrix, quality metrics, and manual journeys |
| [09 — Reproductions and evidence](09_reproductions_and_evidence.md) | Local probe results and repeatable commands without application edits |
| [10 — Acceptance and rollout](10_acceptance_and_rollout.md) | Acceptance criteria, migration safeguards, deployment checks, and rollback |
| [11 — Decisions and tracking](11_decisions_and_tracking.md) | Unresolved policy decisions, finding-to-plan mapping, and status rules |
| [12 — Validation and fix plan](12_validation_and_fix_plan.md) | 2026-10-26 re-validation of every finding, re-rated priorities, new issues N1–N8, recommended decision defaults, and a PR-sized fix plan |

## Executive assessment

Prioritize:

1. Correct resource preview/snapshot contracts and prevent local draft loss.
2. Bound regex execution and close the resource permission gap.
3. Decide and implement history scanning, multi-book budgets, selection, and reveal semantics.
4. Make the session inspector and preview describe the context actually selected.
5. Improve authoring, portability, extraction review, and optional semantic retrieval after the deterministic path is dependable.

P1 findings are F01–F07. P2 findings are F08–F17; F16 is an explicit semantics gap rather than proof that Story Studio's copied-reference model is inherently wrong. No P0 incident, cross-owner data disclosure, or successful live prompt-injection exploit was established.

## Evidence and implementation status

The audit inspected the frontend and sibling backend, ran existing selected tests, and executed isolated local Python/Node probes. It did not edit application code, create migrations, run authenticated end-to-end chats, make live provider calls, or measure production performance.

Observed results:

- Frontend: 21 current-workspace test files, 161 tests passed after excluding nested worktree copies.
- Selected backend run: 361 passed, 113 failed. This is not a clean backend verification result.
- A route-failure spot check reached an uninitialized MySQL pool through a feature-flag dependency.
- One assistant test had a request_credentials expectation mismatch.
- Focused probes reproduced history-depth, multi-book, reveal, matching, resource-contract, feature-gate, and bounded-regex cases.

See [validation](08_validation_and_evaluation.md) for commands and limits. Do not reinterpret passing unit tests as proof that final provider context, narrative continuity, or deployment acceptance passed.

## Relationship to existing documentation

The existing [lorebook reference](../lorebook/README.md) remains the feature entry point. This directory is a dated audit and proposed remediation supplement, not a second implementation-status authority. Map this work to its LORE-R1–R5 backlog when implementation is approved.

Some older lorebook prose still refers to Vite environment flags. Current source and the [membership feature-flag dossier](../feature_flag_on_membership/README.md) take precedence for permission architecture. Existing configuration and deployed grants must be verified; this audit does not assert live access.

Frontend source links are repository-relative. Backend links assume the documented sibling checkout at /home/andres/PycharmProjects/magic-worlds-api. Line anchors refer to the reviewed revisions and may move.

## Change record

| Date | Change | Application implementation |
|---|---|---|
| 2026-10-19 | Preserved the read-only audit, research, findings, impact, gaps, design options, plan, and validation criteria | Not started by this documentation task |
| 2026-10-26 | Re-validated all 17 findings against current source (all confirmed; F05 raised to P0, F07/F08 lowered), added N1–N8 and a PR-sized fix plan in [12](12_validation_and_fix_plan.md) | Not started |
| 2026-10-26 | F04 closed by removing constant mode, the Secret flag and the reveal condition from both repos; D06 and PR9 dropped | Done (uncommitted) |
