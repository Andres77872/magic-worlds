# Implementation status

**Started:** 2026-10-18. **Authority:** this ledger records implementation evidence; the other documents remain the specification.

## Implemented decisions

- Nine active temporary flags; missing fields, keys, rows and null are off. Only exact booleans are accepted.
- **Free has all nine explicit stored grants.** This is the requested initial configuration, using the same evaluator and mutation protocol as custom plans. There is no Free-name bypass. New custom plans default off.
- Root bypasses all temporary restrictions before permission Redis access. Administration still uses normal version/fence/publication rules for writes.
- Workspaces is global: its flag, env reader, runtime key, default-only restrictions and permission UI have been removed. Authentication, ownership, selectors and archive rules remain.
- Preserve administrator plan assignments during billing reconciliation. Credits and permanent voice eligibility remain independent.
- Use the same Redis connection and **database 1** as api.magic_llm, with the separate `mw:featureflags` namespace. No credentials belong in documentation.
- Tests create new custom plans and users in an isolated `mff_` MySQL database and isolated Redis namespace. They never move existing application users.
- Published image/song file URLs remain a bounded public projection: only an asset actually referenced by a currently public/shared card is downloadable. Full discovery/import/card access still requires its active permissions.
- Stored approved novel snapshots remain novel-owned content. Reading or refreshing a live source composes its active adventure/lorebook permission; a novel grant alone does not unlock another product.

## Phase ledger

| Work | State | Evidence / release boundary |
|---|---|---|
| MFF-01 | Implemented | Nine-key catalog, explicit Free grant matrix, root bypass, global workspaces and removal cards |
| MFF-02 | Implemented and tested | Strict optional-off DTOs, generated TypeScript keys, snapshot parser, unknown/removal rejection, additive compatibility |
| MFF-03 | Implemented and tested locally | Fresh schema, resumable additive upgrade, version/revision/source columns, sparse grants and durable audit/outbox; actual local schema upgraded after private backup |
| MFF-04 | Implemented and tested | Fixed 900-second payload TTL, shared plan revision, fenced fills, token CAS, rollback/orphan recovery and real Redis acceptance |
| MFF-05 | Implemented and tested | Unified admin/billing assignment, version conflicts, idempotent plan-feature edits, committed/pending status endpoint, recovery without repeating the write |
| MFF-06 | Implemented; acceptance evidence scoped below | HTTP families, live novel sources, generic copy/export/media targets, mixed query filters before pagination, LLM admission, stored socket kinds and each new socket unit |
| MFF-07 | Implemented and tested | Account-scoped runtime, reactive route/action blocking, SSE/focus/expiry repair, token/account isolation; baseline tree remains mounted |
| MFF-08 | Implemented and tested | Nine server-catalog switches in root editor, plan-card summaries, env readers/declarations removed, normal billing/transport paths, workspace retirement |
| MFF-09 | Implemented and tested | Two service instances sharing Redis/MySQL, two new members, immediate revocation, one pubsub subscription serving 40 subscribers and unrelated-plan isolation |
| MFF-10 | Local checks implemented | `pnpm check:feature-flags` validates manifest/map/removal metadata and rejects retired env/workspace readers; empty-catalog and future-flag tests exist. Configure this command in the deployment CI environment with both checkouts |
| MFF-11 | Local rollout verified | Local API/schema/Redis and real Free editor verified. A production fleet rollout and operational monitoring are separate deployment gates |
| MFF-12 | Per-feature future work | No active preview is declared stable. Execute its removal card when it graduates; workspaces is already removed/global |

## Operational record

The earlier shared `mff_preview_test` plan and its three application projections were removed. Existing users were not reassigned. External authentication test identities remain private QA identities; do not log them into the shared BFF to recreate projections. Subsequent acceptance creates disposable database users only in isolated infrastructure.

The application database was backed up before the additive upgrade (120 tables, 149907 rows in the consistent private backup). The backup and private QA credentials stay in the ignored backend `.dev/feature-flags-20261018/` directory.

The unavailable banner shown during rollout came from an older running API returning **404** for the new `/user/me/features` endpoint. Restarting the updated development API installed the snapshot/catalog routes. This is a deployment-order requirement: updated frontend code cannot use an older API. The real root panel now shows Free **9/9 enabled**, including Story Studio; inspecting the editor did not save or change Free.

## Implemented scope attachments

- Family dependencies cover stories and every included manuscript, annotation, planning, import/export and novel AI route; lorebooks/resources/extraction; adventure templates/sessions; voice/TTS/catalog/presets/previews/performance; and community sharing.
- Dynamic checks cover assistant kind/target, LLM feature/profile/recovery paths, stored character/group conversation kinds, direct generic targets, library/source resolution, Codex live sources, PNG exports, cross-workspace copies and attached lorebook cloning/injection.
- Mixed library, assistant history, recent chat, media and task queries filter active products before pagination/counts. Owned asset reads derive the product from server-owned job/session metadata.
- LLM/media/resource/TTS admission uses current SQL revisions. Committed work may settle; new units must re-enter admission. Cancel/end/archive/refund and exposure withdrawal remain ordinary owner controls. Public withdrawal returns a bounded acknowledgement; it cannot return a gated full card.
- Chat sockets reject gated stored kinds at handshake and recheck each fresh chat/TTS unit. Code 4453 is a permission refusal, with no auth refresh/reconnect loop. Calls use current SQL revision assertions as well as their independent voice access rules.

## Removal work items

| Task | Key | Owner | Review | Required outcome |
|---|---|---|---|---|
| MFF-REMOVE-01 | communityCards | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-02 | lorebooks | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-03 | lorebookResources | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-04 | voices | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-05 | calls | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-06 | novels | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-07 | groupChats | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-08 | adventures | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-09 | appAssistant | Repository maintainer | 2026-11-17 | Execute map 02 card and G01–G10; delete all flag-specific paths |
| MFF-REMOVE-10 | workspaces | Repository maintainer | 2026-10-18 | Removed/global. No plan grant or true-valued replacement |

## Validation and practical limits

Focused permission, novel, membership, media and frontend checks are below. A passing focused suite is not a claim that every unrelated test in these shared working trees passes.

### Focused acceptance commands

Carried from the removed acceptance record on 2026-10-26; three frontend test paths it listed never existed and are dropped. From the backend checkout, point these integration variables only at disposable infrastructure. The fixture refuses a database name outside `mff_`; provision it from the current `src/database/mysql/db.sql` first. The fixture creates and removes its own plan, members, workspaces and cache keys, and calls no auth, LLM, payment or generation provider.

```bash
MFF_TEST_MYSQL_PORT=13387 MFF_TEST_MYSQL_DATABASE=mff_test \
MFF_TEST_MYSQL_PASSWORD='<isolated test password>' \
MFF_TEST_REDIS_URL=redis://127.0.0.1:16387/0 \
.venv/bin/python -m pytest \
  tests/integration/test_membership_feature_mysql.py \
  tests/integration/test_feature_flag_redis.py \
  tests/services/test_membership_feature_flags.py \
  tests/test_mysql_connection_queries.py -q --tb=short
```

From the frontend checkout:

```bash
pnpm check:feature-flags
pnpm test run src/features/novel src/features/admin/membership \
  src/shared/featureFlags.test.ts \
  src/infrastructure/api/__tests__/featureFlagContract.test.ts \
  src/infrastructure/api/__tests__/featureFlags.integration.test.ts \
  src/infrastructure/api/__tests__/membershipFeatureMutations.test.ts \
  src/app/providers/FeatureFlagProvider.test.tsx \
  --exclude '**/.claude/**' --exclude '**/.codex/**' --exclude '**/.dev/**'
pnpm build
pnpm typecheck:stories
```

`pnpm check:feature-flags` needs the sibling backend checkout or an explicit `MFF_BACKEND_ROOT`. It is not installed in any CI pipeline yet; the committed `package.json` runs `scripts/sync-feature-flags.mjs`, which is untracked as of 2026-10-26.

The broad frontend run found 5743 passing tests, 70 failures and 14 skipped, before the final Sidebar/documentation fixture corrections. Remaining failures include concurrent voice/Fish contract and component work, chat hydration expectations, and stale fixtures. They are recorded rather than hidden or bypassed. The feature-specific frontend suite passes, and the final production build and story typecheck are required separately.

No production deployment, new monitoring service, or automatic graduation has been performed. Retained rollout guards must be deleted through document 07 when a feature is released globally.

Final local API verification: snapshot and mutation-status routes are mounted and return 401 without authentication; the updated API is serving on 8010. The two disposable test containers were stopped after acceptance. Final build, story typecheck and catalog check pass. Sharing cleanup/target regressions additionally pass (59 backend; 46 frontend).
