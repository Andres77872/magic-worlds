# Temporary feature flags on membership plans

**Requirements and source review:** 2026-10-18, America/Mexico_City.
**Status:** implemented locally with scoped acceptance and separate deployment gates; see [implementation status](13_implementation_status.md). Requirements below include the implementation steering received on 2026-10-18: root bypasses all temporary flags and workspaces is globally available.

Use membership plans to select the users who can use a feature during its temporary rollout. While a flag is active, the backend enforces its plan grant and the frontend blocks unavailable actions. After graduation, remove the flag and its checks so the feature follows the ordinary application path.

**An absent grant is off. A removed flag is no longer evaluated. These are different states.** Do not implement global release by returning true for missing keys.

## Binding requirements

| ID | Requirement |
|---|---|
| FFM-01 | Flag grants are optional. Missing plan fields, missing keys, missing rows and explicit null grants resolve to off for an active flag. Only boolean true grants access. |
| FFM-02 | Every active flag has hard backend enforcement and reactive frontend blocking for non-root users, including existing resources, generic endpoints, sockets and queued work. Trusted root accounts bypass rollout checks before cache access. |
| FFM-03 | Redis caches permission payloads for 900 seconds. A plan feature change invalidates the permission decisions of all members immediately after the acknowledged update. |
| FFM-04 | Remove frontend feature environment variables and their readers. The target design has no Vite flag ceiling, environment fallback or browser override. |
| FFM-05 | Every flag is temporary and enters with an owner, scope map, measurable graduation criteria, review deadline and removal work item. |
| FFM-06 | Global release deletes the flag-specific code branches, validators, filters, permission calls, revision checks, storage and UI controls. An always-true evaluator is not completion. |
| FFM-07 | Unknown keys, an unsupported catalog and a broken permission service cannot silently release a gated feature. |
| FFM-08 | Global features do not wait for the flag provider or Redis. Other active flags may still use the shared infrastructure. |
| FFM-09 | The feature map in document 02 is part of every addition, scope change and retirement. Registration and removal CI checks keep it aligned with code. |
| FFM-10 | Flag keys are immutable and never reused. Removal history is retained in documentation/audit storage, outside the request evaluation path. |
| FFM-11 | Ordinary authentication, ownership, workspace isolation, safety, consent, billing and quota rules remain after a rollout flag is removed. |
| FFM-12 | Initial migration grants must be explicit. Frontend env values, plan names and custom-plan voice ranks do not imply grants. |

## Reading order and authority

| Document | Owns |
|---|---|
| [02 — Feature flag map](02_feature_flag_map.md) | Current keys, env migration, pages/types/operations, per-flag removal cards |
| [07 — Lifecycle and removal](07_lifecycle_and_removal.md) | Registration, global release, compatibility and complete deletion |
| [09 — Validation and acceptance](09_validation_and_acceptance.md) | Security, concurrency, frontend and zero-flag-overhead proof |
| [10 — Operations and rollout](10_operations_and_rollout.md) | Deployment, recovery, monitoring and retirement operations |
| [13 — Implementation status](13_implementation_status.md) | Phase progress, tests, user steering and removal work items |
| [12 — Registry templates](12_registry_templates.md) | Reusable registration, migration, graduation and removal records |

Requirements in this README take precedence. The implemented wire and cache contract is the BFF [plan feature permissions](../../../../PycharmProjects/magic-worlds-api/docs/api_usage/platform.md) section and [configuration guide](../../../../PycharmProjects/magic-worlds-api/docs/configuration.md), with the frontend in [`featureFlagContract.ts`](../../src/infrastructure/api/featureFlagContract.ts) and [`FeatureFlagProvider.tsx`](../../src/app/providers/FeatureFlagProvider.tsx). 07 owns retirement. Document 02 is the scope inventory rather than a separate runtime authorization engine; `scripts/sync-feature-flags.mjs` reads 02 and 13, so keep their paths.

Implemented and removed on 2026-10-26 (they were never committed to git): 01 current state, 03 contract proposal, 04 backend enforcement, 05 frontend migration, 06 Redis and invalidation, 08 implementation plan, 11 research and 14 acceptance evidence. Their open items live in 09 (graduation gates G01–G10), 10 (production rollout and monitoring) and 13 (removal tasks and acceptance commands).

## Changes from the earlier conversation plan

- A complete feature map is no longer required on plan creation: omission/null safely grants nothing.
- Runtime access no longer intersects with frontend environment flags. Those flags are removed during implementation.
- A flag is a temporary release control, even though membership selects its audience. It is not a permanent product entitlement.
- A stable feature is not represented by a permanent true grant, global allow entry or retired-key lookup.
- The framework applies only where an active flag is attached. Global routes, queries and components use their normal paths.
- New keys default off; removal requires a deliberate release/code change. A missing key cannot stand in for that change.

## Scope and boundaries

This folder plans work in the frontend and sibling BFF at `/home/andres/PycharmProjects/magic-worlds-api`. It does not require changes to identity tokens or the internal agent runtime. Proposed files, endpoints and CI checks are labeled as future work.

Nine product flags remain temporary migration candidates. Workspaces is already deployed and globally available by explicit user instruction: delete its flag and all guards, with no always-true replacement. At implementation intake, either register each candidate with its removal card or graduate an already stable feature directly. Production stability of the nine remaining previews is not established. Cleanup tasks are assigned to the repository maintainer; this does not block root or global workspace access.

The legacy billing, Patreon and streaming toggles are also mapped for env removal. They must not accidentally become permanent plan rights or block a user from upgrading.

Global availability means all applicable users can reach the feature without a temporary flag permission. It does not make private documents anonymous or waive provider credentials, age consent or account limits.

## Definition of completion

For the infrastructure: active flags obey the optional-off contract, use hard server validation, cache for 900 seconds and invalidate all affected members without waiting for expiration.

For each graduated feature: compatible clients execute the ordinary path; no request for that feature evaluates the retired key, fetches its permissions, applies a flag-specific filter, checks its flag revisions or depends on Redis for flag access. Durable historical audit records may retain the old key.

For the last retired flag: no flag-specific bootstrap, worker, connection or application blocking is required until a new temporary flag is registered.

[13 — Implementation status](13_implementation_status.md#focused-acceptance-commands) records the focused acceptance commands and their practical limits. Free is explicitly configured with all nine grants; custom plans use the same evaluator and default to off.
