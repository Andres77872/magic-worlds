# Operations, rollout and recovery

**Status:** operational runbook. Local configuration, additive migration, explicit Free grants and API verification have been performed; see [status 13](13_implementation_status.md). Production rollout remains separate.

## Ownership and readiness

Assign a service owner for permission recovery and a domain owner/removal task for every active flag. An on-call operator needs access to mutation status, pending fence age, authoritative revisions and outbox delivery without needing to edit raw grant rows.

Active-flag health is a scoped capability. Report unavailable flags and deny their operations without making baseline/global application routes depend on flag readiness. Ordinary database/auth/provider health remains independently relevant to those routes.

Root administrators must be able to inspect plans, mutation status and integration health without their consumer plan granting the feature being administered. A failed permission infrastructure write must fail safely; root access is not permission to bypass transaction/revision protocols.

## Initial migration sequence

| Stage | Work | Exit gate |
|---|---|---|
| 1. Intake | Complete map, named owners, deadlines, removal tasks and plan grant matrix | Every migrating key explicitly approved as active; already stable keys take direct graduation |
| 2. Expand storage | Add sparse grants, revisions, mutation/audit/outbox structures and verifier support | Migration/recovery tested against current schema; no historical schema replay |
| 3. Prepare coordination | Configure shared Redis namespace, recovery and metrics | TTL/races/crash tests pass; fences cannot evaporate into allow |
| 4. Establish explicit state | Seed reviewed per-plan grants and user bindings through migration protocol | Missing/null remains off; no grant inferred from env, rank or plan name |
| 5. Replace backend fleet | Deploy complete enforcement and compatible catalog/snapshot contracts | Every serving instance and worker enforces the map; stale non-enforcing replicas drained |
| 6. Replace frontend | Deploy runtime permission state, blocking, server-derived auxiliary contracts and env deletion | Thirteen env readers/names gone from executable/build configuration; direct links covered |
| 7. Acceptance | Run multi-instance revoke, client refresh, billing/assignment and retirement rehearsal | Evidence from document 09 attached |
| 8. Operate and graduate | Review age/criteria and execute per-key removal tasks | Every active key has a next review; stable features lose all flag overhead |

Coordinate stages 4–6 to prevent an access surprise: denial is expected until a grant is explicit, and old browser bundles still have their old behavior until replaced. Do not let a mixed backend fleet route around enforcement. Where rolling replacement cannot preserve a safe compatibility window, use a controlled deployment boundary or blue/green promotion.

Do not ship a new frontend environment toggle to choose old versus new permission systems. Staged rollout is managed through deployment and explicit server state.

## Configuration boundaries

Permission grants live in MySQL and are cached in Redis. They do not live in environment variables. Server connection configuration may specify a dedicated Redis URL/namespace and bounded timeouts; final names should follow existing backend configuration conventions. The payload TTL is fixed to 900 seconds by contract and asserted in tests.

Keep provider credentials, auth settings, billing availability and transport capability configuration as their own server concerns. Removing frontend feature switches does not mean removing necessary FAL/voice/auth settings. Document 02 defines the separate migration of billing, Patreon and streaming toggles.

Use one shared production coordination namespace across serving instances. Preview/test installations get separate namespaces and databases. Application/database identity must prevent cross-environment grant reuse. Review Redis persistence, memory/eviction and failover settings against the BFF plan-feature contract (`/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/platform.md`, Plan feature permissions) and `src/services/feature_flags/cache.py`; do not assume TTL or replica acknowledgement alone supplies revocation correctness.

## Normal plan edits

1. Load the current plan, catalog and version preconditions in the root editor.
2. Show the exact active-grant replacement diff. Unselected/null/missing values mean off.
3. Submit one mutation ID and expected versions to the coordinating service.
4. On success, record the committed feature revision and completion. A no-op grant save does not invalidate members.
5. On committed/pending, retain that mutation ID and inspect/retry its status; do not create a second unrelated write.
6. Verify online invalidation and sample an affected user's protected operation. Event receipt is UI evidence; backend current-revision enforcement is the authorization evidence.

Direct SQL edits and ad hoc Redis deletion bypass the protocol and are not a normal administration path. Repair tooling must use the same locks/revisions/fence publication rules.

## Recovery playbook

| Symptom | Inspect | Safe response |
|---|---|---|
| Pending mutation grows old | Pending index token, mutation ID, SQL entity revision, audit/outbox, lock ownership | Recovery locks the entity, establishes committed outcome, republishes current state and clears only matching token |
| SQL committed but editor did not confirm | Idempotent mutation result and outbox state | Recover same mutation; display committed/pending until publication completes |
| Active operations return unavailable | Redis timeouts/control state, SQL freshness assertion, catalog validation | Restore infrastructure/recovery; keep active scope denied; baseline/global paths remain independent |
| Apparently stale access after failover | Redis revisions versus authoritative SQL, admission traces | SQL fence must reject; drain defective instance and repair current controls before reopening active scope |
| Frontend still shows an old button | Account/revision/expiry, SSE reconnect and recent denial handling | Refresh snapshot/reload supported build; do not change server grants to repair display |
| Catalog mismatch/reload loop | Asset version, expected keys, server catalog on all replicas | Finish compatible fleet/assets promotion; enforce bounded reload and usable update state |
| Billing assignment disagrees with admin custom plan | Assignment source, event ingestion, reconcile mutation/outbox | Follow recorded precedence; do not manually overwrite binding cache |
| Publication retries repeat | Input digest, token comparison, schema/namespace mismatch, lock conflicts | Fix underlying cause and resume idempotently; never release fence by elapsed time alone |

If SQL outcome cannot be established, keep affected active scope unavailable. A pending authorization fence does not have an automatic allow expiry. A short cache-fill lock can expire because it is not an authorization fence.

If revocation appears to have admitted new work after an acknowledged update, treat it as an enforcement defect. Preserve revision/admission evidence, contain affected active scope and inspect every serving replica/worker. Do not mask the defect by shortening TTL.

## Observability and alerts

Collect cache hit/miss/refill latency, revision conflicts, stale publication rejections, pending fence age, outbox lag/retries, denied/unavailable decisions and client catalog mismatch rate. Track active flag owner, age, review deadline and removal task state in CI/release reporting.

Use bounded-cardinality labels such as active flag key and outcome. Avoid user IDs, tokens or arbitrary plan names as metric labels. Audit plan/assignment mutations durably; sample request diagnostics instead of writing SQL audit rows for every cache hit.

Set alert thresholds from the deployment's observed baseline and recovery objectives. This design does not invent an unmeasured latency SLO. Any persistent fence or outbox lag that prevents expected access needs an owner and investigation.

For a graduated action, counters and traces must show zero flag evaluations, flag-cache reads and flag revision checks. Ordinary billing/auth metrics do not count as flag overhead. If no flags remain, flag-specific connection/worker/bootstrap activity must stop after pending work is reconciled.

## Per-feature global release

Follow the deletion protocol in document 07, not a root toggle. Before promotion, attach stability evidence, parent/child resolution, the global-safe build and old-client/worker transition plan.

Stage frontend assets, promote a compatible backend/worker fleet, publish the matching direct-path frontend and drain unsupported versions as documented. Remove runtime catalog/grant/editor entries and scoped stale cache payloads after compatible code is live. Retain immutable docs/audit history, outside authorization.

Use targeted namespace/key cleanup after authoritative revision change. Never use FLUSHALL or broad deletion of shared OAuth/application Redis data. Physical cache deletion is cleanup; revocation correctness comes from revisions/fences.

Do not roll back global release to an old build that reinstates removed permission checks or denies users with absent grants. Prepare a rollback build that preserves the direct path. Existing operational safety measures can still address a provider incident; they must not resurrect the retired plan key.

## Review cadence and final shutdown

Each active key has a review deadline and removal work item. Review readiness at that deadline, then graduate, explicitly revise the plan with evidence, or stop the incomplete experiment. Passing a date does not automatically enable a feature.

After the last key is removed, verify no pending old mutations/jobs require flag metadata, then disable flag-only recovery/bootstrap/connections through the empty-catalog lifecycle. Keep generic source/migration history for future registration without running an idle permission dependency for global features.

A later new flag follows a fresh registration card and starts off for every omitted/null plan grant. It must not reintroduce checks around an already global baseline. This runbook creates no scheduled automation; implementing a review process is a future repository/operations task.

## Implemented local commands and recovery

Backend configuration: `FEATURE_FLAG_REDIS_URL` uses the api.magic_llm Redis connection/database 1; `FEATURE_FLAG_REDIS_PREFIX=mw:featureflags`. The permission payload TTL is fixed at 900 seconds, not an operator-adjustable entitlement rule. Never print or commit the URL credentials.

From the backend checkout, check the scoped expansion with `.venv/bin/python scripts/migrations/20261018_membership_feature_flags.py`; after verifying a private backup, `--apply` resumes its additive expansion and runs the schema verifier. Its predecessor is `2026_10_novel_import_formats`. The migration itself does not infer grants. Fresh databases contain nine explicit Free grants; existing installations use normal plan administration to enter their reviewed grant matrix.

Root plan writes use catalog revision, expected plan version and a stable mutation ID. A committed/pending response is checked through `GET /admin/billing/feature-mutations/{mutation_id}`. The frontend polls publication without replaying the write. A retry of the same committed feature mutation remains pending until recovery publishes it, then returns the saved plan without another revision increment.

Recovery polls the durable SQL outbox and Redis pending index every five seconds. An orphan creation fence is removed only after a locked SQL read proves the entity absent and a Redis token CAS still matches; elapsed time alone never clears a denial fence.

Run `pnpm check:feature-flags` with the sibling backend checkout available, or set `MFF_BACKEND_ROOT` explicitly in CI. Isolated acceptance commands are in [13](13_implementation_status.md#focused-acceptance-commands). Never seed test accounts or test plans in the shared application as a prerequisite for testing; the integration fixtures create and clean their own users/plans.
