# Temporary lifecycle and complete removal

**Status:** required protocol for each flag. Graduation is a code and compatibility release, not changing a default or waiting for a cache TTL.

## Lifecycle

~~~mermaid
stateDiagram-v2
    [*] --> Candidate
    Candidate --> Active: owner + map + removal plan + tests
    Active --> Graduating: stable evidence and release decision
    Graduating --> Active: release preparation withdrawn
    Graduating --> Removed: direct paths deployed and cleanup proven
    Removed --> [*]
~~~

Candidate is documentation/intake state. Active and graduating retain exactly the same default-off permission semantics until the corresponding direct code is released. Removed is documentation/audit history; it is absent from runtime catalogs.

There is no runtime permanent, always-on or removed-returning-true state.

## Before a new key is admitted

Complete template 12 and map 02:

1. Identify the new capability and the stable baseline it must not restrict.
2. Assign a named owner, removal task, review date and escalation/review responsibility.
3. Define backend/frontend scope, generic targets, sockets, workers and dependencies.
4. Define measurable graduation criteria and representative rollout/acceptance evidence.
5. Plan exact code, schema, cache, UI, test and documentation deletion.
6. Add optional/null-off and direct-global-path tests before rollout.
7. Establish catalog compatibility and migrate any necessary existing data explicitly.

Age is a cleanup signal, never authorization. Passing the review date does not enable the feature or delete its guards automatically. Overdue flags require an explicit reviewed extension/removal plan; they cannot silently become permanent.

The project's metadata applies to the nine remaining migration candidates and future flags. Workspaces is already global under the explicit user instruction.

## Preparing graduation

The owner demonstrates product stability, data integrity, normal authorization, recovery and provider/transport readiness for the feature's scope. Evidence must include direct APIs and generic/alternate entry points, not only a visible page.

Decide that the behavior will be available to every applicable user regardless of plan grants. No per-plan true backfill is required to implement that decision; the direct code path is what makes it global. Optional broader soak cohorts can be configured explicitly before this release.

Prepare the removal patch in both repositories and the targeted cleanup migration. Do not delete registration data first while evaluators still default off.

## Required source deletion

| Area | Remove |
|---|---|
| Backend routes | Opt-in rollout dependencies, active key annotations and flag-only parameters |
| Services/admission | Guard calls, required-key sets and flag-only membership/feature revision predicates |
| Read queries | Flag-specific exclusions, permission joins/predicates and hidden totals for the retired type |
| Sockets/jobs | Retired preflight calls and flag-only socket/dispatch refusals |
| Frontend routes/navigation | Flag wrappers, hidden/locked alternatives and flag annotations |
| Frontend API/loaders | Retired assertions, permission waits, subscriptions and scope-generation dependencies used only by that key |
| Projection | Retired picker/Codex/media/task/notification filters and counter suppression |
| Catalog/types | Active definition, generated key type, dependency edges and flag-specific messages |
| Plan administration | The key's editor controls, presets and serialized current values |
| Configuration | Old env variables, aliases, build configuration and fallback readers |
| Tests/stories | Obsolete on/off variants; replace with ordinary global behavior tests |

If a wrapper has no remaining active purpose, delete the wrapper rather than keeping it as a no-op. Remove imports and unreachable alternate branches.

The feature's domain service becomes the direct target of the endpoint/action. Do not rename the same rollout permission into another permanent layer.

## Dependency retirement

| Case | Required result |
|---|---|
| Parent graduates, child stays active | Remove the parent key and dependency edge. The child still requires its own grant |
| Parent and child graduate together | Remove both definitions, edges and all affected guards |
| Child would graduate while parent remains active | Block graduation unless the child ships an independent global path; otherwise graduate the parent first/in the same release |
| New experimental work extends a global feature | Gate only the new capability; keep the already-global behavior directly accessible |

Concrete order constraints: resources cannot become globally available behind an active lorebooks prerequisite, and calls cannot become global behind an active voices prerequisite. Voices/lorebooks may graduate first while calls/resources remain temporary.

Do not retain a phantom parent that always returns true. Once voices is baseline, normal voice readiness and consent still apply without being a voices rollout grant.

## Catalog and browser compatibility

Ship the catalog mismatch/reload behavior before the first membership-flag rollout. The client knows the keys it expects to evaluate; the backend does not need a permanent retired-key list.

Prepare immutable next-version assets before backend promotion. Drain old backend/worker versions that still enforce the retiring key before the feature is declared globally released. Publish the matching frontend entry point and verify fresh navigation.

A compatible old client expecting the removed key receives FEATURE_FLAG_CATALOG_MISMATCH through the snapshot protocol. It reloads once per changed release/catalog or shows a reload-required/update-in-progress notice, rather than looping while the hosting entry still serves an older bundle.

Use a coordinated/blue-green release pair when hosting supports it. If deployment is sequential, document the brief old-client update window and declare graduation complete only when both the compatible backend fleet and new frontend entry are live.

An offline browser cannot have its cached JavaScript rewritten remotely. On reconnect/focus it must refresh/reload. Never accommodate it by keeping an always-true retired flag in the current permission API.

Compatibility validation is confined to the flag snapshot/control endpoint. Global feature routes do not acquire a permanent catalog-version middleware.

## Worker and stored-data compatibility

Inventory queued, retryable and retained work before deleting a key. Drain it or migrate separate flag-admission metadata under a reviewed protocol so no queued dispatcher needs an unknown-key exception.

Do not rewrite frozen business payloads, execution fingerprints or immutable result/audit history just to remove a flag. Historical required-key/revision data can remain in audit storage and is not the source of new authorization.

New dispatch derives requirements from current server-owned domain scope. A historical audit reference to a removed key does not create a runtime retired-key allow resolver.

## Storage/cache cleanup order

1. Verify the direct path and compatible fleet/worker cutover.
2. Advance catalog revision and send catalog-changed hints.
3. Remove current plan grant rows for the retired key with a scoped migration.
4. Invalidate old catalog-scoped Redis payloads; optionally reclaim them in namespace batches.
5. Remove obsolete control/pending records only after their mutations are reconciled.
6. Retain audit evidence and the docs removal ledger.
7. Verify current editors, snapshots and generated manifests no longer contain the key.

Strict schema verification and the application release must support this staged cleanup. Old storage rows temporarily left for migration are not active catalog entries and are not consulted to authorize global behavior.

Do not use FLUSHALL, a database-wide delete or an unscoped key search. Shared OAuth/billing/auth data is unrelated.

## Zero-overhead completion proof

Run the graduated feature for a user with missing/null/false old grants while the flag service and Redis client are configured to fail if called.

Verify:

- Ordinary feature endpoints/actions still work under normal auth/ownership.
- There are zero retired-key evaluations and flag-permission network calls attributable to the feature.
- Its SQL action has no flag-grant/revision join or predicate.
- Its lists/counters have no flag exclusion for that type.
- Its UI renders without a flag provider and uses no retired guard hook.
- Other active flags still deny missing/null grants.
- Source scans find the old key only in allowed docs/history/migration evidence, not executable paths.

Leaving an evaluator that returns true, a globally_enabled list lookup, a compatibility permission adapter or a hidden empty wrapper fails this proof.

## Never reuse or re-gate

Retired keys remain reserved in the documentation/build-time history ledger. A genuinely new experimental capability receives a new key and its own removal plan.

The new key cannot wrap the whole previously global product and recreate the same membership restriction. Acceptance tests for the global baseline remain when future flags are added.

After graduation, use a last-known-good global build or roll forward for recovery. Rolling back to an old plan-gated backend would break the global release contract. Existing operational/safety controls may still protect unavailable providers; do not resurrect the membership flag as an incident switch.

## Last active flag

After all current flags are removed and pending mutations are drained:

- Current snapshots/catalogs are empty without querying memberships or Redis for grants.
- Current clients need no flag bootstrap/event connection.
- No flag-specific worker/Redis client starts solely for global features.
- Plan editors have no rollout section until a new active catalog is released.
- The next new flag uses this same protocol without altering global baseline paths.

The general implementation can remain available as opt-in infrastructure. Its mere presence must not add a feature-specific layer to a global path.
