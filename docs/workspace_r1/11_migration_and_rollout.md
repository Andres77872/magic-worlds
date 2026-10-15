# Migration, coordinated rollout, and recovery

> **Lifecycle: active R1 contract. Documentation reconciliation: 2026-10-15.** The foundation is implemented; rollout and specific integrity acceptance remain open. [02](02_current_status_and_findings.md) owns source/status and schema compatibility; [04](04_gaps_and_priorities.md) owns remaining work. Normative requirements below remain acceptance/regression contracts, not claims that every guarantee has runtime evidence. Dated implementation/validation records are in git history.

**Status: WIP rollout.** Migration/resume tooling exists and dated 2026-10-12 dev/rehearsal runs were recorded locally (baseline under W-05 in [04](04_gaps_and_priorities.md); full record in git history); production migration/deployment is not established. The `.90` test database was migrated 2026-10-12 and serves the 2026-10-14 test deployment, outside this production runbook; production still requires every step below.
**Source/documentation reconciliation:** 2026-10-15.
**Supported starting revision:** Frozen `2026_10_image_profiles` plus the resource-task predecessor contract. **R1 target:** Frozen `2026_10_workspace_r1`. **Current source bootstrap revision:** the revision named by `CONTENT_SCHEMA_REVISION` in the BFF bootstrap (owned by the active Fish/voice execution; not asserted here). Supported later revisions verify as `superseded`, without reapplying R1. Verification does not upgrade an R1 database through subsequent migrations. The workspace capability marker remains stable at R1.

## Current constraints and prerequisites

The [bootstrap verifier](/home/andres/PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py) and [database guide](/home/andres/PycharmProjects/magic-worlds-api/docs/database.md) require exact schema metadata/seeds. Runtime never repairs it. Preserve the existing [image-profile upgrade](/home/andres/PycharmProjects/magic-worlds-api/scripts/migrations/20261012_image_profiles.py), unified assistants, profile/payer/provider fields, and data.

If deployed marker is older, report unsupported workspace-migration baseline and use the existing documented upgrade chain first. Do not silently chain upgrades: the historical unified-assistant cutover has destructive history semantics and its earlier owner authorization is not blanket authorization for this feature. Unsupported revisions stop without mutation; explicitly supported later revisions are verified without applying R1.

Before an apply:
- Record deployed marker, MySQL version/storage metadata, table/owner counts and relationship validation.
- Verify database and owned-blob backups through an isolated restore rehearsal.
- Use the implemented workspace tool and frozen preceding/target schema contracts; rerun environment-specific checks rather than deriving R1 from the changed canonical `db.sql`.
- If the target database lacks `resource_task` (an image-profiles schema from before `21127be`), run `scripts/migrations/20261012_resource_tasks.py --apply` first. The R1 tool stops before any change with that instruction, and the resource-task script refuses databases that already have the R1 schema.
- Ship the frontend compatibility release (document 08, Stale browser tabs) before the window and confirm it is live. Its changes are currently uncommitted in worktree `magic-worlds-compat` (branch `workspace-r1-compat`); commit them and build from that commit first.
- Stop admitting all content writes, socket/voice turns, extraction/assistant/story requests, media submissions/uploads, imports and copies; drain/terminalize existing work as below.
- Deploy the R1 frontend with `VITE_FEATURE_WORKSPACES_ENABLED=false` and the matching API/schema in the order below, inside one maintenance window.

## Migration tool interface

Implemented in the current BFF source (original work recorded on `workspace-r1`):
- `scripts/migrations/20261012_workspace_r1.py` is the CLI.
- `src/database/mysql/workspace_cutover.py` holds `upgrade_workspace_r1(pool, apply=False)`.
- `tests/integration/test_workspace_cutover_database.py` covers it on MySQL 8.

How the tool works:
- **Statements.** It derives each table's statements from the frozen predecessor DDL and frozen `migrations/2026_10_workspace_r1.sql`, independent of later voice revisions in canonical `db.sql`. Each root gets one `ADD COLUMN … NULL` and one atomic finalizing `ALTER`. The finalizing `ALTER` drops changed FKs and the now-redundant implicit FK indexes, makes `workspace_id` `NOT NULL`, and adds the final keys and FKs.
- **Resume.** It recognizes these resume phases, each verified against its own exact contract: `predecessor`, `tables`, `columns`, `backfill`, `constraints`, `constraints_applied`.
- **Fingerprint.** The fingerprint is a row count plus two SHA-256 aggregates per predecessor table, over the original columns only. It is printed by the check and re-checked before the marker advances. Keep the check output: its digest must equal the apply output's.
- **Timestamps.** Backfill `UPDATE`s explicitly keep `ON UPDATE CURRENT_TIMESTAMP` columns, so assignment does not look like an edit.

Real MySQL tests, interruption/restore rehearsals and the dev-database migration ran locally on 2026-10-12 (baseline under W-05 in [04](04_gaps_and_priorities.md); full record in git history). These are dated local evidence; the production revision inventory, backup/restore and quiescence/restart checks remain open.

| Invocation | Required behavior |
|---|---|
| Default, no apply flag | Acquire existing database-scoped migration advisory lock; verify supported exact/known partial state; print a redacted check-only report; no schema/data mutation |
| `--apply` | Apply/resume the reviewed supported state; verify preservation and exact target |
| Run on exact R1 target or a supported later revision | Verify the corresponding schema only; later revisions report `superseded`; create no new default workspaces or data |
| Unknown revision/partial drift | Stop with redacted state/reason, preserving all data |

Use the existing `mw-llm-schema-` advisory-lock naming convention, bounded metadata-lock timeout, and connection-discard cleanup on uncertain state. No startup migration, hidden repair, provider submission, or secret output.

The report must include starting/target marker, recognized phase, remaining statements/backfill counts, owner/application scopes, default mappings, legacy-operation assignments, inconsistent links, active operations, fingerprint summaries, and checks still needed. Store/report no raw prompts, resource text, credentials, or blob paths.

## Owner-scope and origin backfill rules

Form the distinct nonempty owner/project/group tuple set from content roots, media jobs, owned image/theme-song assets, operation reservations/receipts, and other retained content-operation records. Include accounts whose cards were deleted but jobs/results remain. Skip global notification/voice-preset rows with empty scope. Empty tb_user accounts cannot identify a project/group; initialize their default atomically on first authenticated workspace access.

Create one default per tuple with a stable scope pointer. Resume reuses it; names never identify a migration-created default. Existing roots for that tuple go there with no invented collections.

| Existing data | Workspace/origin rule |
|---|---|
| Cards/books/resources/stories/sessions/assistants | Their root's validated owner/application default |
| Same-owner live book/resource/assistant targets | Validate tuple equality first; assign the same default and preserve target IDs |
| Historical card/session/story lineage/snapshots | Leave JSON/IDs byte-equivalent; do not reinterpret as live targets |
| Jobs with valid same-scope parents | Parent default; verify it agrees with the job tuple |
| Detached jobs or deleted targets | Job owner/application default; target remains absent |
| Retained executions with reservation/group data | Reservation's validated default; add BFF context without changing intent/graph/effective-config hashes |
| Historical card receipts/results after target deletion | Retained receipt/reservation owner/application default |
| A retained execution with no reconstructible group | Check-only reports it; stop apply pending an explicit validated mapping; never guess from user/project alone |
| Existing owned assets and retained snapshots | Add default-workspace associations by asset owner/reference tuple; TTS through job ownership |
| Legacy content notices | Owned job resolves origin; no surviving job leaves an originless legacy notice with unavailable-target behavior |

Materialize historical operation organization metadata as a migration-derived empty membership/warning result. Historical request fingerprints remain untouched; recovery checks the context's default origin instead of recalculating an old intent with new fields. New admissions include organization in their fingerprint. Resolve explicit global profile-test/admin records through their trusted stored operation family; lack of workspace context by itself is never a global-access exemption. Test that this compatibility branch cannot admit a new operation without explicit context.

Stop on cross-owner/application live links, missing required parents, duplicate/inconsistent defaults, invalid JSON/contracts, or unsupported unfinished operations. Do not silently clear links or rewrite published bodies to make the backfill pass.

## Defined migration phases and resume states

1. Freeze a manifest of source IDs/counts and preservation hashes plus the exact predecessor schema contract.
2. Create workspace/scope, collection/membership, context/copy/media-association tables in deterministic parent order.
3. Add nullable workspace fields and supporting compatible parent keys to current roots/links/jobs.
4. Create default mappings; backfill roots in owner/ID chunks, then live relationship columns, operation contexts, and media associations. Each chunk commits independently and is resumable.
5. Verify all assignments, live link equality, source manifest coverage, and unchanged protected-content/accounting hashes.
6. Add owned-workspace/composite FKs and final indexes; make required columns NOT NULL. Preserve old FK checks until their replacements exist.
7. Verify exact final structures/seeds while marker is still the predecessor. Recheck preservation.
8. Advance marker in a short transaction, then run canonical target/bootstrap verification and write the redacted completion report.

The implementation defines an expected schema contract for every phase/recognized statement prefix. A nullable-backfill state resumes only missing assignments using stable scope pointers. A constraints-applied state skips completed statements after exact verification. Unexpected columns/constraints, missing predecessor roots, or out-of-order new tables stop for inspection. Crash after marker advance enters target verification rather than reapplying data.

Use source-ID inventories as well as counts so equal-count substitutions cannot pass. Fingerprint existing card bodies/drafts/versions, book/resource payloads, session/message/voice/story snapshots, assistants/messages, asset identities/storage content hashes, execution frozen/effective/result payloads, image-profile/payer fields, and billing/credit/quota records. Exclude only explicitly added scope/index fields from equality checks.

MySQL DDL can implicitly commit, so one transaction cannot make this sequence reversible. Preserve and test each partial state. [MySQL reference](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)

## Quiescence, deploy order, and activation

End live calls through the existing engine to release quotas. Drain active sockets/assistant/story/extraction requests. Let admitted provider jobs and their planned child writer stages reach terminal persisted state where feasible; if a provider is still running, retain its durable state and pause local callbacks/workers until context backfill is verified. Do not mark a provider success as a failure solely to speed maintenance, and never resubmit blindly.

Do not migrate while a handler can finalize against the old schema. Persisted jobs resume with their validated origin only after the matching API is running. BYOK jobs requiring a transient key keep existing failure/recovery rules; the migration never stores that key.

The frontend and API must never run a mismatched pair with users on it. Ordered steps:

1. **Before the window:** the compatibility release is live (prerequisite above).
2. **Quiesce and stop the API** as described above. Open tabs show the existing services-down banner.
3. **Deploy the R1 frontend with `VITE_FEATURE_WORKSPACES_ENABLED=false`** while the API is stopped. It waits in its "updating" state and sends no private request and no `X-Workspace-Id` until the handshake succeeds, so it is safe against a stopped or predecessor API.
4. **Apply the migration and start the R1 API** after exact schema/startup readiness.
5. **Verify the handshake:** the capability endpoint reports `workspace_r1` and the supported contract version, and a flag-`false` tab passes it and loads the default workspace.
6. **Smoke-check with the flag `false`:** default-workspace transport on the existing galleries/editors, scoped direct-ID/list, manual/AI destination, persona/lore, assistant, media/notice, voice-history and legacy links. Also check that a pre-R1 tab receiving `WORKSPACE_REQUIRED` shows the reload dialog.
7. **Verify** preserved preexisting snapshots and account cleanup on the isolated rehearsal.
8. **Resume admission** intentionally.
9. **Enable the UI** by redeploying the frontend with the flag `true`, only after the [release acceptance guarantees A01–A27](10_risks_and_decisions.md#acceptance-guarantees-a01-a27) have passed in rehearsal. Then smoke-check the R1 UI:
   - the single Library sidebar entry, compact collection folders and mixed cards, and persistent root/folder search;
   - all enabled New-menu types/persona/imports, direct generation/card-assistant destination, and the same saved identity after editor save;
   - legacy type links resolving to library filters;
   - collections, plus a copy that succeeds, a copy forced to fail (nothing created), and a replayed request ID.

   Compare cards/creator fields with the current components, not the prototype's abbreviated walkthrough.

The implemented read-only `GET /workspaces/capabilities` response is `{workspace_r1:true,contract_version:1,schema_revision:"2026_10_workspace_r1"}`. Register it before the workspace-ID route. It is the frontend's startup handshake (document 08), not permission to relax database verification.

## Recovery and rollback

Before activation, resume from a verified partial phase or restore the tested database/blob backup with write admission still stopped. A source backup plus preserved migration manifest is the recovery authority; dropping new columns/tables is not a recovery procedure. If the predecessor API is restored, also redeploy the pre-R1 frontend build; the R1 build keeps private pages blocked against a predecessor API by design.

After multi-workspace writes, prefer forward repair with the UI disabled (frontend redeployed with the flag `false`) and content admission controlled. Users then see only the default workspace plus the "temporarily unavailable" notice; content in other workspaces is preserved and reappears when the flag is turned back on. Older account-wide APIs both fail schema verification and collapse the intended organization. Restoring an older database loses later writes unless a tested reconciliation exports/reapplies them; document that concrete data-loss/reconciliation decision before restoring.

The implementation gate is a tested tool plus fixtures for interruption at each phase, unsupported revisions, old in-flight records, restart, and full target verification. No apply/deploy commands were executed in this documentation pass.
