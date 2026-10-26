# Registration, migration and removal templates

**Status:** reusable documentation/CI templates. Examples are illustrative and do not register flags or grant a real plan access. Replace placeholders with verifiable records before an active catalog entry is accepted.

## A. Flag admission card

Copy this card into the maintained map or its linked per-flag record. Metadata supports review/CI; it is not an alternate permission evaluator or the public snapshot payload.

~~~json
{
  "record_schema_version": 1,
  "key": "examplePreviewV1",
  "lifecycle": "candidate",
  "owner": "REPLACE_WITH_NAMED_OWNER",
  "domain": "REPLACE_WITH_DOMAIN",
  "introduced_by": "REPLACE_WITH_CHANGE_LINK",
  "review_on": "YYYY-MM-DD",
  "removal_work_item": "REPLACE_WITH_TRACKED_WORK_LINK",
  "purpose": "REPLACE_WITH_TEMPORARY_RELEASE_REASON",
  "global_baseline_to_preserve": "REPLACE_WITH_EXISTING_DIRECT_BEHAVIOR",
  "requires_active_keys": [],
  "scope_map": "REPLACE_WITH_MAP_ANCHOR",
  "grant_migration_record": "REPLACE_WITH_MATRIX_LINK",
  "graduation_criteria": [
    "REPLACE_WITH_MEASURABLE_STABILITY_CRITERION",
    "REPLACE_WITH_PRODUCT_GLOBAL_RELEASE_DECISION"
  ],
  "removal_proof_tests": ["G01", "G02", "G03", "G06", "G08"],
  "compatibility_record": "REPLACE_WITH_CLIENT_SERVER_WORKER_PLAN",
  "audit_history_record": "REPLACE_WITH_DOCS_ONLY_LEDGER_LINK"
}
~~~

Placeholder strings and invalid dates fail admission checks. The example key is not approved for use. A real key must be unique across active and removed history; once used, it cannot be recycled.

The runtime catalog contains only active definitions under the BFF plan-feature contract (`/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/platform.md`, Plan feature permissions). Do not publish candidate/removed metadata and then ask every request to interpret lifecycle state.

## B. Required scope and removal map

| Surface | Active enforcement or behavior | Exact source/operation references | Removal action and proof |
|---|---|---|---|
| UI/navigation | Route, menu, modal, direct URL, persisted navigation | Fill before registration | Delete wrapper/condition; direct path test |
| API dispatch | Handler, delayed factory, non-React bridge | Fill | Delete flag assertion; dispatch without provider |
| Backend HTTP | Read/write/export/import/download endpoints | Fill | Delete route/service dependency and flag-only metadata |
| Domain admission | Persisted types, shared execution, quota boundary | Fill | Delete flag key/revision predicates; ordinary rules retained |
| Generic query | Type aliases, list/count/page filters | Fill | Remove retired-type filter; prove allowed pagination/counts |
| Media/profile/assistant | Operation aliases and persisted target context | Fill | Remove flag attachment, not domain safety |
| Socket | Connection and per-action checks | Fill | Direct action after graduation; no permission refresh |
| Worker/job | Retry, next unit, cancellation and settlement | Fill | Drain/migrate flag-only metadata; no retired evaluation |
| Dependencies | Active parent/child edges | Fill, or explicitly none | Remove retired edge; no phantom true parent |
| Storage/cache | Grant rows, catalog revision, payload namespace | Fill | Remove current rows; invalidate scoped payloads; audit retained |
| Root editor | Catalog-generated control and validation | Fill | Control/key removed; no always-on UI replacement |
| Config/types/docs | Env readers, types, tests, stories, map | Fill | Executable references zero; history clearly marked |

Use concrete endpoints and dispatch identities, not only a directory name. A new path that can reach protected work must update this map. A source reference with no decision is an incomplete card.

## C. Explicit initial grant matrix

Prepare the matrix from intended rollout access. Do not copy an environment file or infer rights from names such as Pro, Plus or custom.

| Actual plan code | Active key | Desired grant | Evidence/owner | Mutation or migration record |
|---|---|---|---|---|
| REPLACE_WITH_PLAN | REPLACE_WITH_KEY | false | REPLACE | REPLACE |

Omitted row, omitted key, null or false all mean off. List every intended true explicitly. A missing grant record is not an unresolved permissive state.

For an API create example, this grants nothing:

~~~json
{
  "feature_flags": null
}
~~~

For a replacement PATCH, this revokes every active flag:

~~~json
{
  "feature_flags": {}
}
~~~

For an unrelated label/price edit, omit feature_flags entirely to preserve grants. Do not reuse the revoke-all payload for an ordinary plan edit. Attach current catalog/plan version preconditions and a stable mutation ID as defined in the BFF plan-feature contract (`/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/platform.md`, Plan feature permissions).

Record effective assignment precedence separately:

| Assignment source | Can replace explicit custom assignment? | Event/source of truth | Reconcile/recovery evidence |
|---|---|---|---|
| Admin custom | Define intentionally | Root mutation | Fill |
| Paid membership | Recommended: no, until custom assignment released | Billing sync/reconcile | Fill |
| Default/free | Only through defined initialization/fallback | Membership initialization | Fill |

The recommended precedence is a proposed business decision, not a claim that current production implements it.

## D. Graduation readiness record

Complete this while the flag is still active. Being ready does not change runtime behavior by itself.

| Field | Required content |
|---|---|
| Key and map anchor | Immutable key and current full scope |
| Owner/reviewer | Named people responsible for release/removal |
| Stability evidence | Measured criteria, period, incidents and unresolved limitations |
| Global release decision | Date, rationale and affected applicable users |
| Parent/child resolution | Before/after active dependency graph and removal order |
| Direct-path changes | Backend/frontend/worker code changes and deletion list |
| Compatibility | Supported build/catalog versions, asset promotion, old tab/worker draining |
| In-flight policy | Pending jobs, admission boundary and safe settlement/cancellation |
| Storage/cache cleanup | Current grant rows, catalog/payload revisions, pending mutation recovery |
| Acceptance | C/B/R/F/G test references with actual results |
| Rollback | Build that preserves global access and avoids restoring the retired key |

If a child remains active after its parent graduates, record an edge removal, not a new always-true parent. If the child is proposed for global release but still sits entirely inside an active parent guard, separate its scope or graduate the parent in the same release.

## E. Completed removal record

Append a record only after evidence exists. The example below is a field template, not evidence that a current candidate has graduated.

~~~json
{
  "record_schema_version": 1,
  "key": "examplePreviewV1",
  "state": "removed",
  "removed_on": "YYYY-MM-DD",
  "owner": "REPLACE_WITH_NAMED_OWNER",
  "global_release_change": "REPLACE_WITH_CHANGE_LINK",
  "frontend_build": "REPLACE_WITH_BUILD_ID",
  "backend_build": "REPLACE_WITH_BUILD_ID",
  "worker_build": "REPLACE_WITH_BUILD_ID_OR_NOT_APPLICABLE",
  "catalog_revision_after": "REPLACE_WITH_REVISION",
  "current_grant_rows_remaining": 0,
  "retired_key_runtime_references": 0,
  "retired_action_flag_evaluations": 0,
  "retired_action_flag_cache_reads": 0,
  "retired_action_flag_revision_assertions": 0,
  "retired_action_flag_filters": 0,
  "resolver_failure_probe": "REPLACE_WITH_G02_EVIDENCE",
  "other_active_flag_denial_probe": "REPLACE_WITH_G06_OR_NO_OTHER_ACTIVE_KEYS",
  "future_flag_baseline_probe": "REPLACE_WITH_G08_EVIDENCE",
  "pending_work_resolution": "REPLACE_WITH_DRAIN_OR_MIGRATION_RECORD",
  "rollback_build": "REPLACE_WITH_GLOBAL_SAFE_BUILD_ID"
}
~~~

Do not emit this record into the public active catalog or query it per request. CI can read documentation/history to reserve keys. Historical audits and historical migrations may retain the identifier; active grant/editor code may not.

The zero values require runtime and source/query evidence. They cannot be filled solely because one menu item renders. When another feature remains active, identify trace scope so its unrelated calls are not incorrectly attributed to the retired feature.

## F. Empty catalog and later registration record

When removing the last active key, record pending mutation/job reconciliation, stopped flag-only connections/workers/bootstrap, and successful global operation with the permission infrastructure unavailable.

When adding a later preview, record its new key, narrow experimental scope, preserved global baseline and default-off matrix. Run G08 to prove the new framework activity does not re-gate old released features. Do not copy a removed wrapper around the whole product to save implementation effort.

## G. Review/deadline update record

If a review date arrives before graduation, record the evidence, named owner, next date and concrete remaining removal work. CI may block an unreviewed/overdue card; it must never flip access or auto-graduate a feature.

Keep the card and map synchronized in the same change. A new key or scope change is incomplete until its backend routes, frontend paths, aliases, dependencies and removal proof are mapped.
