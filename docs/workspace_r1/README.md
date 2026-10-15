# Workspace R1: implementation specification

**Original review:** 2026-10-11. **Source/documentation reconciliation:** 2026-10-15, America/Mexico_City.

**Current status: implemented foundation, committed on master (BFF `f37eefd`, SPA `c7307c6`, 2026-10-12); WIP rollout/integrity acceptance.** Product UI defaults to disabled in `.env.example`; private workspace transport remains active when UI is disabled. The `.90` test database was cut over to R1 on 2026-10-12 and serves the 2026-10-14 test deployment ([voice evidence ledger](../voice_refactor/00_current_status_and_roadmap.md#evidence-ledger)); that deployment's startup schema was `2026_10_voice_native`, where R1 is a superseded predecessor, and its deployed commits and product-UI flag values were not recorded. Production deployment/configuration is unverified. Start with [02 — Current status](02_current_status_and_findings.md) and [04 — Remaining roadmap](04_gaps_and_priorities.md). Source bootstrap expects the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (owned by the active Fish/voice execution; not asserted here); the stable workspace capability marker remains `2026_10_workspace_r1`.

**Historical evidence:** The dated 2026-10-12 implementation and validation records were removed on 2026-10-15 (git history); the acceptance guarantees live in [10](10_risks_and_decisions.md#acceptance-guarantees-a01-a27) and the local performance/migration baseline in [04](04_gaps_and_priorities.md).\
**Scope:** Personal workspaces, flat mixed-card collections, independent reuse, and workspace-local content/activity.

A card has one home workspace and may belong to several collections there. Copy to workspace creates an independent private card. Collections organize the library; they do not automatically add novel Codex entries or change AI activation.

The main implementation work belongs to the frontend and `magic-worlds-api`. Existing authentication, graph runtime, provider abstraction, billing, LLM/image profiles, and credentials retain their boundaries.

**Approved UX (2026-10-12):** The user approved the revised unified-library prototype and requested that these decisions be recorded in this specification. One Library/Biblioteca sidebar entry replaces the private character/world/item/adventure entries. Inside it, compact collection folders and unchanged existing cards of every supported type share one browser grid/list. Preserve the current gallery search and view modes; its New menu opens the existing creators/import flow, including direct generation and the card assistant. Document 08 is the authoritative UX contract; the old screenshot and first explanatory mockup are superseded as target UI.

## Start here

1. Read 01 for the selected release scope and 10/15 for the selected decisions.
2. Use 15 as the authoritative API/lifecycle/operation contract and 16 as the source-path inventory.
3. Use 04 for open work and closure evidence and 10 for the A01-A27 acceptance guarantees.
4. Use 11 for coordinated rollout only after verifying the intended build/schema chain and environment prerequisites. Tooling exists; this cleanup does not execute it or certify production readiness.

## Reading map

| Document | Purpose |
|---|---|
| [01 — Objectives and scope](01_objectives_and_scope.md) | Selected R1 boundary, invariants, deferred work |
| [02 — Current status and findings](02_current_status_and_findings.md) | Current source evidence, flags, schema compatibility, release gaps |
| [04 — Gaps and priorities](04_gaps_and_priorities.md) | Implemented-gap ledger, remaining roadmap and release gates |
| [06 — Database model and changes](06_database_model_and_changes.md) | Tables, roots, constraints, durable origin, preservation |
| [08 — Frontend UX impact](08_frontend_ux_impact.md) | Approved library/folder browser, persistent search, creation/assistant compatibility, navigation/history, release compatibility and rollout UI |
| [09 — Copy, export, and dependencies](09_copy_export_and_dependencies.md) | All-or-nothing copies, resource remapping, lineage, media |
| [10 — Risks and decisions](10_risks_and_decisions.md) | Resolved choices, remaining release evidence and A01-A27 acceptance guarantees |
| [11 — Migration and rollout](11_migration_and_rollout.md) | Frozen baseline, implemented tooling, resume/cutover/recovery |
| [15 — Execution contracts](15_execution_contracts.md) | Exact selectors, DTOs, errors, idempotency, lifecycle and bounds |
| [16 — Scope inventory](16_scope_inventory.md) | Every current content route family and frontend ownership integration |

## Current baseline and precedence

The R1 cutover starts from frozen `2026_10_image_profiles` plus the resource-task predecessor contract and produces frozen `2026_10_workspace_r1`. Current BFF startup expects the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (owned by the active Fish/voice execution; not asserted here); the R1 tool recognizes supported later revisions as superseded and verifies the appropriate contracts without replaying R1. It does not upgrade a new R1 target through every later schema. Consult [bootstrap](../../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py), [the database guide](../../../../PycharmProjects/magic-worlds-api/docs/database.md) and the [active Fish suite](../fish_audio_support/README.md) for the intended release chain. Verify the deployed marker independently; earlier assistant-history deletion does not authorize discarding current data.

Documents 08, 10, and 15 record active selected R1 decisions. Document 08 owns the approved library UX; document 15 owns exact API/lifecycle contracts and takes precedence over illustrative API sketches. Generated body/schema/prompt contracts stay content-only. Source-backed facts belong in 02 and 16; open work and closure evidence belong in 04. Approval of the UX reference is not approval to replace existing card/editor designs or proof of runtime acceptance.

The source review includes unrelated working-tree changes. Refresh a changed integration point before implementing it, especially image profiles, voice lifecycle, and strict DTOs. No production availability is inferred from local files.

## Readiness and validation

Design alternatives affecting R1 are resolved; the local performance/migration baseline is summarized under W-05 in [04](04_gaps_and_priorities.md). Remaining gates include W-03/W-04 integrity findings (including the source-confirmed W-04d default-persona path), deployed-version checks, representative query plans, a tested backup/restore and the document 11 rollout.

The October 15 cleanup changes documentation only. Source and existing tests were inspected; no application source, configuration, SQL, database, provider or deployment was changed, and no new runtime-test result is claimed. The active Fish documentation is owned separately and was left unchanged.
