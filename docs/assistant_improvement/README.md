# Main assistant improvement

**Reviewed:** 2026-10-15. **Delivery:** research and design documents only. **Implementation:** proposed; no application, backend, schema, configuration, or runtime changes are included.

Give the main Assistant page access to the existing card and lorebook tools through one shared implementation. Select available tools from the enabled knowledge sources, product capabilities, user scope, selected target, and model capabilities. Add focused retrieval so the assistant can find the information needed for an answer or an edit.

## Recommended direction

Use a backend tool registry shared by all three assistant surfaces. Extract the existing schemas, validation, document planning, and transactional mutations into shared components; keep the six existing tool names. The main assistant orchestrates them through a server-resolved editing context. It does not copy the editor handlers, impersonate another conversation kind, or bypass their validation.

Reuse the existing roleplay `mw_read_card` contract and card-context projection for card reads as well. The proposed generic detail tool covers non-card sources, avoiding two overlapping card-read tools.

Provide a general-assistant tools master switch and separate toolset switches for guide, card reads/edits, lorebook reads/edits, resource reads, and novel reads. These settings affect only the general assistant; editor assistants keep their independent availability. [Toolset controls](14_toolset_controls.md) define the grouping and enforcement.

For the first editing release, allow one explicitly selected card or lorebook per turn. Preserve the existing replace / patch / no-change behavior and compare-and-swap checks. Add a bounded search/read workflow separately. Source selection constrains accessible data; it does not grant write authority. The user selects an editing target and mode once for the bounded task, avoiding repeated confirmations for already authorized ordinary edits.

These are proposed application decisions, not claims that current code implements them. See the [decision register](13_decisions_and_open_questions.md).

## Reading map

| Document | Purpose |
| --- | --- |
| [00 — Current status and evidence](00_current_status_and_evidence.md) | Maintained status for this initiative; observed implementation and verification limits |
| [01 — Gaps and requirements](01_gaps_and_requirements.md) | Prioritized gaps, requirements, and closure conditions |
| [02 — Research and sources](02_research_and_sources.md) | Dated primary-source research, applicability, and limits |
| [03 — Best practices](03_best_practices.md) | Engineering practices translated into this application's constraints |
| [04 — Architecture and reuse](04_architecture_and_reuse.md) | Proposed ADR, alternatives, shared execution boundaries, and reuse map |
| [05 — Source availability and permissions](05_source_availability_and_permissions.md) | Availability matrix, target grants, source switches, and feature gates |
| [06 — Tool catalog and contracts](06_tool_catalog_and_contracts.md) | Existing tools to reuse and new retrieval/preparation tools |
| [07 — Execution, persistence, and recovery](07_execution_persistence_and_recovery.md) | Versioning, action receipts, transactions, cancellation, billing, and retry |
| [08 — Context, retrieval, and citations](08_context_retrieval_and_citations.md) | Search strategy, provenance, budgets, history, and guide publishing |
| [09 — User experience and workflows](09_user_experience_and_workflows.md) | Source controls, editing target, receipts, and concrete task examples |
| [10 — Security, privacy, and risks](10_security_privacy_and_risks.md) | Risk register, retention obligations, existing dependencies, and mitigations |
| [11 — Implementation plan](11_implementation_plan.md) | Dependency-ordered milestones, affected repositories, and rollout gates |
| [12 — Evaluation and acceptance](12_evaluation_and_acceptance.md) | Deterministic tests, model evaluations, adversarial cases, and release evidence |
| [13 — Decisions and open questions](13_decisions_and_open_questions.md) | Recommended decisions, unresolved product choices, and required owners |
| [14 — Toolset controls](14_toolset_controls.md) | General-assistant master/per-toolset switches, independent scope, persistence, defaults, and dispatch rules |

## Scope and authority

This dossier is the proposed improvement plan for the main assistant. The [existing assistant contract](../app_assistant/README.md) remains the authority for current behavior. [Lorebook status](../lorebook/README.md), [workspace integrity](../workspace_r1/04_gaps_and_priorities.md), [LLM profiles](../llm_profiles/16_current_status_and_roadmap.md), and [security findings](../security/README.md) retain ownership of their respective backlogs. Cross-references here are dependencies, not duplicate closure registers.

The [novel assistant plan](../novel_refactor/08_ai_assistant_context_and_tools.md) owns manuscript editing and multi-document writing changesets. This plan permits novel/resource reads when their sources are enabled, but does not add manuscript writes, publishing, account administration, arbitrary HTTP/shell tools, or media generation in its first releases.

No new agent framework, MCP server, vector database, or direct frontend-to-provider integration is required by this proposal. Existing service boundaries and published LLM profiles remain in use.

All example endpoints, type names, state names, new tool names, and budgets in this dossier are proposed unless explicitly labeled current. Owners and delivery dates are unassigned.
