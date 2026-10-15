# Membership management review — 2026-09-20

**Reconciled 2026-10-14:** root Membership & plans, credit-token administration, profile usage and promo grants are implemented independently of the Stripe purchase gate. Purchase UI is **WIP — locally disabled**; see [setup](billing/SETUP.md). The earlier eight-operation description below is historical: current `MEMBERSHIP_OPERATIONS` includes `voice_preview` (nine total), and admin validation follows that source set. The three default plans are seeds; mutable/free/custom values and remote paid facts are not certified by these example numbers.

Current evidence: `src/features/admin/membership`, BFF `membership_admin_models.py`, `models.py::MEMBERSHIP_OPERATIONS`, `bootstrap.py`, and `billing_catalog.py::PLAN_PRIORITY`. Follow-ups remain **WIP/TBD**: durable assignment audit (current writes log assignments), monthly reset semantics in admin aggregates, paid catalog beyond `plus/pro`, and public plan comparison. See **MEMBER-01** in [roadmap](ROADMAP.md). This review did not query memberships or run provider reconciliation.

Scope: how memberships and plans work end to end (frontend SPA + `magic-worlds-api`), what
happens to the three default plans, and what was missing for root users to create custom
plans and manage who is on what. The second half records what was built in response.

## 1. How it worked before this change

### Data model (`magic-worlds-api/src/database/mysql/db.sql`)

| Table | Role |
| --- | --- |
| `membership_plan` | Plan catalog: `plan_code` (PK, case-sensitive, ≤32), `display_name`, `credit_reset_period` (`daily` only), `daily_credit_limit`, `is_active`. |
| `membership_plan_limit` | Per-plan, per-operation quota: `daily_request_limit`, `max_in_flight`, `credit_cost`. Every plan must have a row for each of the 8 runtime operations. |
| `user_membership` | One row per account (`plan_code`, `status` = `active` only). Created lazily by `ensure_user_membership` on the first credit-related call. |
| `membership_usage_day`, `membership_operation_usage_day` | Today's included-credit and per-operation counters. |
| `membership_credit_ledger` | Every reservation/refund with its `credit_source` (`included`, `payg_free`, `payg_billed`). Source of truth for monthly usage. |
| `payg_credit_wallet`, `payg_credit_ledger` | Non-expiring PAYG credits (free vs billed buckets). |
| `membership_quota_reset` | Audit of admin daily/monthly resets. |

### The three default plans

`free` (50/day), `plus` (100/day) and `pro` (500/day) are inserted by `db.sql` and mirrored
in `bootstrap.py` (`MEMBERSHIP_PLAN_SEED_ROWS` / `MEMBERSHIP_PLAN_LIMIT_SEED_ROWS`).

Findings:

1. **The catalog was frozen at boot.** `bootstrap._verify_schema` compared the live
   `membership_plan` / `membership_plan_limit` rows with the seed tuples using an
   *exact* match. Adding a fourth plan, deactivating one, or changing a single limit
   value made the API refuse to start ("Valid MySQL seed mismatch"). This alone made
   custom plans impossible without editing Python constants and redeploying.
2. **Paid plan facts are owned by billing.** `billing_catalog.PLAN_PRIORITY` hard-codes
   `free < plus < pro`; api.auth's Stripe catalog is the only source of paid plan names,
   prices, and included credits. `MembershipModel.set_user_plan` refused to place a user
   on a paid plan unless the remote `display_name` / `daily_credit_limit` matched the
   local row *exactly*. Editing `plus` locally would therefore break `/billing/reconcile`
   for every subscriber. This is a correct integrity guard, but nothing in the product
   explained it.
3. **No admin assignment path.** The only way an account left `free` was a Stripe or
   Patreon entitlement. Root could not comp an account, run a beta cohort, or move a
   tester to a bigger allowance.
4. **Deactivating a plan with members would 500 their profile.** `_validate_plan_row`
   raises when the user's current plan has `is_active = 0`, and `/user/me` calls it.
5. **`/billing/reconcile` always downgraded to `free`** when remote facts showed no
   subscription, so even a hand-edited `user_membership` row would be reverted the next
   time the user opened the billing page.
6. **The public catalog's free entry was static** (`_FREE_PLAN_PUBLIC`, 50 credits) and
   would drift from the DB row if the free allowance were ever tuned.
7. **Zero visibility.** No endpoint listed accounts with their plan, today's usage,
   monthly consumption, or wallet balance; no per-plan aggregates existed.
8. **Naming confusion in the SPA.** The sidebar entry "Membership management" and the
   legacy hash `#/admin/membership-management` both pointed at the credit-tokens page,
   which manages promo codes and email grants, not memberships or plans. The quota reset
   tool lived there as well.
9. **Profile plan cards only show the current tier.** `_build_membership_profile_cards`
   returns a single tier card; the SPA's `MembershipSection` is ready to render several.
   Not a blocker, noted for later.
10. **No durable audit of plan changes.** `membership_quota_reset` records resets, but
    there is no table for "who moved this account to which plan and why".

## 2. What was built

### Backend (`magic-worlds-api`)

- **`src/database/mysql/membership_admin_models.py`** — new `MembershipPlanAdminModel`:
  `list_plans`, `get_plan`, `create_plan`, `update_plan`, `list_memberships`,
  `assign_user_plan`, `current_custom_plan_code`, `overview`. All writes run inside one
  transaction; every plan write re-validates the full 8-operation limit contract so the
  runtime can never be handed a half-provisioned plan.
- **Ownership rules** (returned as outcomes, mapped to HTTP 409 by the routes):
  - `free` — tunable, never deactivated (it is the fallback).
  - `plus` / `pro` — *billing-synced*: name and daily credits are read-only locally
    (only per-operation limits are editable) and they cannot be deactivated.
  - Custom plans — fully local; deactivation refused while members remain; never
    hard-deleted (ledger rows reference them).
- **`src/routes/admin_membership.py`** — root-only routes under `/admin/billing`:
  `GET/POST /plans`, `GET/PATCH /plans/{code}`, `GET /memberships` (plan / search / sort /
  pagination), `POST /memberships/assign`, `GET /membership-overview`. Strict DTOs
  (`extra="forbid"`, `strict=True`).
- **`bootstrap.py`** — the seed verifier now enforces runtime invariants instead of exact
  values: every seeded plan code exists with the `daily` reset period, `free` is active,
  and every plan (seeded or custom) carries exactly the seeded operation set. Tuned values
  and extra plans pass; a plan missing an operation limit still fails closed.
- **`MembershipModel.set_user_plan`** — "billing-synced" is now a property of
  `MEMBERSHIP_BILLING_PLAN_CODES` (`plus`, `pro`); `free` and custom plans are local facts
  and reject remote plan fields.
- **`/billing/reconcile`** — when remote facts resolve to "no subscription", an active
  admin-assigned custom plan is preserved. A paid Stripe/Patreon entitlement still wins.
  Assigning `plus`/`pro` by hand remains a temporary override (documented in the UI).
- **`GET /billing/plans`** — the free entry now mirrors the live local `free` row.
- Tests: `tests/models/test_membership_admin.py`, `tests/routes/test_admin_membership.py`,
  plus updated bootstrap / billing-sync / subscription / catalog tests.
- Docs: `docs/api_usage/billing.md` → "Membership plans and members".

### Frontend (this repo)

- New root console **Membership & plans** at `#/admin/membership`
  (`src/features/admin/membership/`), reachable from the account menu. The legacy hash
  `#/admin/membership-management` now lands here.
  - KPI tiles: accounts, active today (+ credits), this month (included / PAYG split),
    PAYG wallets.
  - **Plans** tab: catalog cards (default / custom / billing-synced / inactive badges,
    allowance, member count, collapsible limits) and a create/edit dialog with the full
    per-operation limit table and a "start from" preset.
  - **Members** tab: search (username / display name / hash / `#id`), plan filter, sort,
    per-row today usage bar vs allowance, month credits, PAYG balance, and a "Change plan"
    dialog that explains billing-synced vs custom consequences.
  - **Usage** tab: per-plan table with bars, per-operation month totals, and the quota
    reset tool (moved here from the credit-tokens page).
- The former "Membership management" entry is now **Credit tokens** and only manages
  promo codes and email grants.
- Types in `src/shared/types/billing.types.ts`, API methods on `apiService`, i18n in
  `en` + `es`, stories under `Admin/Membership/*`, and `AdminMembershipPage.test.tsx`.

## 3. Known limits / follow-ups

- **Audit trail.** Plan assignments are logged (`membership plan assigned …`) but not
  persisted. A `membership_plan_change` table needs a schema revision + migration.
- **Monthly figures in the admin views are raw ledger totals** for the calendar month and
  ignore manual monthly resets (the per-user profile view respects them).
- **Paid plans are still only `plus` and `pro`.** A custom plan cannot be sold through
  Stripe; that requires adding it to api.auth's catalog and to `PLAN_PRIORITY`.
- **Profile tier cards** still show only the current plan; a comparison view could reuse
  the new `GET /admin/billing/plans` shape for a public variant.
- The `user_membership.status` enum only has `active`; pausing/cancelling locally is not
  modelled and would need a schema change.
