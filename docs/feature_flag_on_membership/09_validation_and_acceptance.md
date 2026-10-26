# Validation and acceptance

**Status:** required future evidence. Writing this dossier does not establish that these tests pass. Use isolated databases, Redis namespaces and provider stubs; do not run destructive acceptance against a shared environment.

## Acceptance boundaries

Test both halves of the lifecycle: an active feature must deny a missing grant, and a graduated feature must work without consulting the flag system. A test that changes an evaluator to return true proves neither deletion nor independence.

| Suite | Requirements | Work packages | Required evidence |
|---|---|---|---|
| Contract | FFM-01, 07, 10, 12 | MFF-02/03 | DTO, normalization, dependency and compatibility fixtures |
| Backend coverage | FFM-02, 11 | MFF-06 | Route/service/socket/worker matrix linked from map 02 |
| Cache and mutations | FFM-03 | MFF-04/05/09 | Real Redis/MySQL, races, crash recovery, multiple instances |
| Frontend | FFM-02, 04, 08 | MFF-07/08/09 | Component/API tests and browser acceptance |
| Retirement | FFM-05, 06, 08, 09, 10 | MFF-10/12 | Deletion scan plus direct-path execution evidence |

Each row in the [feature map](02_feature_flag_map.md) needs a test reference for its entry points, generic aliases and removal work. A passing pure evaluator is insufficient coverage for the feature.

## C — Contract and storage

| ID | Case | Expected result |
|---|---|---|
| C01 | Create a plan with feature_flags omitted, null or an empty map | All active flags off |
| C02 | Active key omitted, null, false or missing its SQL row | Off in effective snapshot and protected operation |
| C03 | Active key is exactly true with all active parents true | Eligible for the feature; normal domain authorization still applies |
| C04 | Values are strings, integers, arrays or objects | Reject input; never apply truthiness coercion |
| C05 | PATCH omits feature_flags | Preserve grants; changing a label does not clear them |
| C06 | PATCH sends feature_flags null or an empty map | Revoke all active grants |
| C07 | PATCH sends a sparse map | Replace active grant map; absent active entries off |
| C08 | Mutation includes an unknown/removed key or stale catalog revision | Reject; no partial mutation, grants or cache publication |
| C09 | Child true while an active required parent is absent/null/false | Dependency validation error; no automatic parent grant |
| C10 | Malformed/inconsistent stored dependency data | Deny affected child and report integrity failure |
| C11 | Null, false and absent normalize to the same effective denial | No feature revision increment or invalidation for an equivalent save |
| C12 | Invalid dependency cycle, duplicate key or dependency on an unknown key | Catalog fails validation before serving active scope |
| C13 | New client expects a key absent on an older backend | Catalog mismatch and blocked action, never global release |
| C14 | Older client expects a removed key | Catalog mismatch/update path; no synthetic true tombstone |
| C15 | Server adds keys that an older client does not use | Existing supported keys work; new keys default off |
| C16 | Last active key removed | Valid empty-catalog variant with null binding metadata; no flag SQL/Redis resolution or zero-validity refresh loop |

Exercise JSON parsing and the actual SQL representation, not only an in-memory map. Assert that plan creation defaults and SQL nullability agree with the wire contract. Audit records may preserve historical keys; current grant rows may not become a second registry of active keys.

Contract fixtures must distinguish an absent permissions map in a valid snapshot (known active keys off) from an absent/invalid catalog (protocol failure). Authentication failure, a broken catalog and denied grants must not share an accidental allow fallback.

## B — Hard backend validation

For every registered key, run the same denial matrix through public HTTP routes, shared services, persisted resource lookups, generic dispatch and queued work. Include GET/list/detail/download paths as well as writes.

| ID | Probe | Required assertion |
|---|---|---|
| B01 | Direct request with no UI, valid token and no grant | Protected feature returns the documented denial |
| B02 | Same account has credits, PAYG or BYOK configured | Grant is still required; zero provider calls and zero new charge/job on denial |
| B03 | Resource existed before revocation | Reads, exports, copies and further work follow the mapped policy; ownership is not a grant |
| B04 | Client spoofs a generic type/session kind/model operation | Server resolves persisted target/context; cannot bypass a child feature through a baseline alias |
| B05 | Query returns mixed types | Forbidden types are filtered before pagination and counts; allowed next pages remain reachable |
| B06 | Alternate assistant/profile-test/media/import route | Same active policy applies before provider dispatch and accounting admission |
| B07 | WebSocket connected before revocation | Next protected action is denied; a live socket does not preserve permission |
| B08 | Work queued before revocation, not yet dispatched | Worker checks current policy before the next protected dispatch |
| B09 | Provider unit admitted before revocation | Settlement and the documented bounded in-flight policy remain correct; no unauthorized next unit |
| B10 | Root user uses a normal consumer route | Root bypasses rollout checks before cache access; ordinary ownership and safety remain |
| B11 | Cancellation, refund, safe cleanup or upgrade | Remains reachable through its explicitly mapped independent path |
| B12 | Global workspaces without a flag runtime | Workspace transport, switching and management run directly without a workspace grant or flag service |
| B13 | Revocation races between revision read and side effect | Serialized current revision/admission boundary prevents check-then-act race; no orphan debit/job |
| B14 | Feature globally released, ordinary ownership fails | Ordinary domain denial remains; flag removal does not remove tenant isolation |
| B15 | Anonymous/public preview route reaches an active product | Deny protected scope unless an exact limited baseline projection has been explicitly mapped; public routing is not an implicit grant |

Inventory tests should detect an added route or dispatch alias without a mapped policy decision. Use exact operation identities and explicit baseline exceptions. Do not force every application request through a flag middleware merely to simplify test enumeration.

## R — Redis, concurrency and recovery

Unit tests use a controlled clock. Real Redis tests inspect PTTL and expiry with bounded waits; they do not need a fifteen-minute wall-clock sleep. Allow command/network timing tolerance while proving the configured lifetime is 900 seconds, not a sliding window.

| ID | Scenario | Required assertion |
|---|---|---|
| R01 | First allowed or denied payload cached | Expiration is installed atomically with value; cache hits do not extend it |
| R02 | Many concurrent misses for one revision | Bounded fill; losing loader cannot release another loader's lease |
| R03 | Old loader finishes after a plan edit | Cannot publish stale data or clear a newer fence |
| R04 | Two members, same plan, two backend instances, warm allowed caches | One plan update denies both members through either instance before TTL expiry |
| R05 | Member of an unrelated plan | No unnecessary binding invalidation or changed decision |
| R06 | Large membership count | Publication uses shared plan revision; does not enumerate/delete every member key |
| R07 | Equivalent normalized grants saved | No feature invalidation; ordinary plan field revision can change independently |
| R08 | User assignment races old binding fill and plan edit | Final binding/plan pair passes current SQL checks or retries/denies safely |
| R09 | Cannot install pre-commit fence | SQL permission change does not commit |
| R10 | Crash after fence but before SQL/outbox commit | Pending-index recovery confirms SQL outcome and restores current state |
| R11 | SQL rolls back after fence | Matching token cleared after confirmed rollback; no stale token clears another edit |
| R12 | SQL commits, Redis publication fails | Remains fenced; committed/pending response; idempotent outbox recovery finishes |
| R13 | Duplicate retry or out-of-order event | One effective mutation; revisions never move backward |
| R14 | Redis timeout, eviction or missing control | Active scope unavailable/denied; no unversioned cached allow fallback |
| R15 | SQL unavailable during recovery | Fence remains; no inferred rollback or automatic timeout release |
| R16 | Redis failover/restore resurrects older allowed data | Final SQL revision assertion rejects new protected admission |
| R17 | Pub/Sub hint dropped; SSE disconnect/reconnect | Backend revocation remains correct; client reconnect/focus/expiry repairs display |
| R18 | Registration races initial snapshot/subscription | Post-subscribe revision check catches intervening change |
| R19 | Billing reconcile rolls back its outer transaction | No premature membership publication or duplicate credit fulfillment |
| R20 | Permission service crashes after commit, before acknowledgement | Same mutation ID recovers authoritative result; UI does not issue an unrelated retry |

The multi-instance R04 test must capture the mutation acknowledgement boundary, user/plan revisions, requests made after that boundary and provider/admission counters. Hiding a button or waiting for a TTL is not revocation evidence.

Test lock ordering and retry limits under MySQL's actual isolation level. Exercise current reads versus pre-existing repeatable-read snapshots. Test primary Redis reads and the supported topology; a single-process fake is insufficient evidence for failover or Cluster behavior.

## F — Frontend behavior and env deletion

| ID | Scenario | Required assertion |
|---|---|---|
| F01 | Active permission loading, failed or expired | Protected route/action blocks and gives a recoverable state |
| F02 | Same states while opening a baseline/global feature | Normal route renders and runs without waiting for the flag provider |
| F03 | Direct URL, persisted navigation or saved Codex reference | No UI bypass of active permission checks |
| F04 | Account switches while snapshot/list requests are pending | Old replies cannot populate the new account's grants or data |
| F05 | Token refresh for the same account | Owner checks remain valid; stale grants are not restored |
| F06 | Revocation event, FEATURE_FLAG_OFF, reconnect, focus or TTL expiry | Coalesced refresh; stale UI invalidated; no refresh storm |
| F07 | Delayed LLM/media dispatch factory created before revocation | Rechecks current active permission before materializing the request |
| F08 | Blocked editor, running job, draft or workspace switch | Draft retained; cleanup reachable; loading does not reset remembered state |
| F09 | Filtered tasks initially empty but next page has allowed entries | Load-more remains reachable |
| F10 | Shared-card first page contains only filtered types | Scan reaches later allowed entries and keeps accurate pagination |
| F11 | Root plan editor sees a new active key | Generated control defaults off; null/omission and replacement semantics are clear |
| F12 | Root save returns committed/pending | Shows recoverable mutation state; same ID used for status/retry |
| F13 | Supported old/new browser and backend combinations | Catalog compatibility follows the BFF plan-feature contract (`/home/andres/PycharmProjects/magic-worlds-api/docs/api_usage/platform.md`, Plan feature permissions); bounded reload without loops |
| F14 | Billing, Patreon and streaming env removal | Upgrade remains available, integration state is server-derived, transport does not duplicate partial work |

Search source, env typings/examples, build/deployment configuration and fixtures for all thirteen variables listed in document 02. Expected executable references after migration: zero. Historical documentation may mention a removed name as history, with clear status. Do not substitute another browser environment variable or localStorage switch.

Run component/API tests and a real browser journey for navigation, root editing, invalidation and update-required recovery. Verify accessibility of loading, denied and pending states when the UI is implemented; reuse the repo's UI skills and primitives.

## G — Graduation and future flags

| ID | Case | Required proof |
|---|---|---|
| G01 | Graduate one flag with old grants absent/null/false | Same feature works through the ordinary path |
| G02 | Make the flag resolver, cache client and flag SQL repository throw | Graduated feature's route/service/action still succeeds |
| G03 | Inspect retired action traces and query construction | Zero flag evaluations, flag Redis reads, flag revision assertions and retired-type filters |
| G04 | Remove a parent while its child remains active | Parent runs directly; child requires only its remaining active dependencies |
| G05 | Attempt child graduation while parent still encloses its whole path | CI/review rejects incomplete graduation unless scope is separated or parent graduates too |
| G06 | One flag retired, another denied active flag remains | Retired feature works; active feature remains denied |
| G07 | Remove last flag and reconcile pending work | No flag bootstrap, SSE refresh, Redis connection or recovery worker required |
| G08 | Add a new temporary flag after all old ones were removed | New key defaults off; previously global features remain independent |
| G09 | Reuse/rename a retired key or wrap the global feature again | Registration checks reject key reuse and accidental re-gating of baseline scope |
| G10 | Old client requests removed key | Update-required behavior; server does not restore a retired evaluator |

For G02, scope instrumentation to the graduated operation. The application may have independent permission calls for other active features. Ordinary authentication, quota or ownership database queries are expected; the forbidden overhead is the removed flag's authorization path.

Combine runtime probes with an executable-reference scan. Search alone can miss dynamic dispatch; a successful happy path alone can miss export/list/worker guards. Allow historical migrations/audit fixtures where needed, but do not maintain runtime retired-key tombstones or true fallbacks.

## CI and evidence records

Required CI checks include catalog shape/dependencies, contract fixtures, manifest-to-map drift, unowned/overdue removal cards, scope coverage, retired-key executable references and deletion proofs. A deadline failure triggers review; it never enables a feature automatically.

Each acceptance record includes commit/build IDs, catalog/schema revisions, affected plan and test-account aliases, setup matrix, test IDs, observed results, trace/counter evidence and remaining exceptions with owners. Use synthetic IDs and redact tokens, provider keys and personal data.

Run the [focused acceptance commands](13_implementation_status.md#focused-acceptance-commands). Record actual command outputs and failures; do not relabel a stalled or skipped test as passing. This documentation change is validated for links, structure and consistency only.
