# Workspace R1: implementation specification

**Original review:** 2026-10-11. **Source/status review:** 2026-10-14, America/Mexico_City.

**Current status: WIP rollout.** Implemented in the current frontend/BFF; product UI defaults to disabled in `.env.example`, with local opt-in enabled. Private workspace transport remains active when UI is disabled. Production deployment/configuration is unverified. Start with [02 — Current status](02_current_status_and_findings.md) and [04 — Remaining roadmap](04_gaps_and_priorities.md). The canonical BFF schema is now `2026_10_voice_native`; the stable workspace capability marker remains `2026_10_workspace_r1`.

**Historical implementation record (2026-10-12):** Implemented and integrated, uncommitted, into the main API and frontend checkouts (2026-10-12). This covers the API, frontend and migration tooling; a compatibility release is built separately. The owner's local dev database is migrated to `2026_10_workspace_r1`, and the local frontend flag is `true`. Not committed, shipped or deployed. Progress and remaining owner steps are in document 12; test evidence is in document 13.\
**Scope:** Personal workspaces, flat mixed-card collections, independent reuse, and workspace-local content/activity.

A card has one home workspace and may belong to several collections there. Copy to workspace creates an independent private card. Collections organize the library; they do not automatically add novel Codex entries or change AI activation.

The main implementation work belongs to the frontend and `magic-worlds-api`. Existing authentication, graph runtime, provider abstraction, billing, LLM/image profiles, and credentials retain their boundaries.

**Approved UX (2026-10-12):** The user approved the revised unified-library prototype and requested that these decisions be recorded in this specification. One Library/Biblioteca sidebar entry replaces the private character/world/item/adventure entries. Inside it, compact collection folders and unchanged existing cards of every supported type share one browser grid/list. Preserve the current gallery search and view modes; its New menu opens the existing creators/import flow, including direct generation and the card assistant. Document 08 is the authoritative UX contract; the old screenshot and first explanatory mockup are superseded as target UI.

## Start here

1. Read 01 for the selected release scope and 05 for the architecture.
2. Use 15 as the authoritative API/lifecycle/operation contract and 16 as the source-path inventory.
3. Implement the phases in 12; prove the acceptance scenarios in 13.
4. Use 11 only after building and testing its planned migration tooling. Documentation readiness does not authorize running a migration or certify production readiness.

## Reading map

| Document | Purpose |
|---|---|
| [01 — Objectives and scope](01_objectives_and_scope.md) | Selected R1 boundary, invariants, deferred work |
| [02 — Current status and findings](02_current_status_and_findings.md) | Current source evidence, flags, schema compatibility, release gaps |
| [03 — Uses and workflows](03_use_cases_and_workflows.md) | Writing, roleplay, sandbox, reuse, and lifecycle outcomes |
| [04 — Gaps and priorities](04_gaps_and_priorities.md) | Implemented-gap ledger, remaining roadmap and release gates |
| [05 — Architecture and repository impact](05_architecture_and_repo_impact.md) | Selected ADR and service boundaries |
| [06 — Database model and changes](06_database_model_and_changes.md) | Tables, roots, constraints, durable origin, preservation |
| [07 — API and backend impact](07_api_and_backend_impact.md) | Integration of current routes with the selected contracts |
| [08 — Frontend UX impact](08_frontend_ux_impact.md) | Approved library/folder browser, persistent search, creation/assistant compatibility, navigation/history, release compatibility and rollout UI |
| [09 — Copy, export, and dependencies](09_copy_export_and_dependencies.md) | All-or-nothing copies, resource remapping, lineage, media |
| [10 — Risks and decisions](10_risks_and_decisions.md) | Resolved choices and remaining release evidence |
| [11 — Migration and rollout](11_migration_and_rollout.md) | Frozen baseline, implemented tooling, resume/cutover/recovery |
| [12 — Plan and acceptance](12_implementation_plan_and_acceptance.md) | Actual implementation progress, residuals and remaining release steps |
| [13 — Validation and coverage](13_validation_and_coverage.md) | Expected outcomes, tests, integration and release gates |
| [14 — Research and sources](14_research_and_sources.md) | Local/primary references and verification limits |
| [15 — Execution contracts](15_execution_contracts.md) | Exact selectors, DTOs, errors, idempotency, lifecycle and bounds |
| [16 — Scope inventory](16_scope_inventory.md) | Every current content route family and frontend ownership integration |

## Current baseline and precedence

The R1 cutover starts from frozen `2026_10_image_profiles` plus the resource-task predecessor contract and produces frozen `2026_10_workspace_r1`. Current BFF startup expects `2026_10_voice_native`; the R1 tool verifies supported later voice schemas as superseded. Unified `assistant_conversation`/`assistant_message` storage remains current, and image profiles add schema requirements beyond that earlier revision. Verify deployed revision independently; earlier assistant-history deletion does not authorize discarding current data.

Documents 05, 08, 10, and 15 record selected R1 decisions. Document 08 owns the approved library UX; document 15 owns exact API/lifecycle contracts and takes precedence over earlier illustrative API sketches. Generated body/schema/prompt contracts stay content-only. Source-backed facts belong in 02 and 16; actual progress belongs in 12. Approval of the UX reference is not approval to replace existing card/editor designs or proof of application implementation.

The source review includes unrelated working-tree changes. Refresh a changed integration point before implementing it, especially image profiles, voice lifecycle, and strict DTOs. No production availability is inferred from local files.

## Readiness and validation

Design alternatives affecting implementation are resolved. Implementation evidence (real MySQL constraints/transactions, navigation races, source preservation, migration resume) is recorded in document 13. Remaining gates need the real environment: deployed-version checks, representative query plans, a tested backup/restore, and the document 11 rollout.

This specification pass changes Markdown in this folder. A separate, self-contained local UX prototype reuses existing frontend components with fixture data; its simulated creation and abbreviated editor walkthrough are not application implementation. No application source, SQL, application configuration, migration execution, provider calls, or deployment were changed/performed by this work. Document checks and prototype build/navigation checks are separate from feature-runtime validation. The later implementation pass (2026-10-12), its integration into the main checkouts and the dev-database migration are recorded separately in documents 12 and 13.
