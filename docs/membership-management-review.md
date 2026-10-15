# Membership administration and remaining acceptance

**Source/lifecycle review: 2026-10-15.** Membership/credit accounting and root administration are implemented independently of purchase availability. The [billing setup](billing/SETUP.md) owns checkout configuration and release acceptance. This reference owns membership administration boundaries and MEMBER-01.

## Implemented boundary

| Area | Current source contract | Evidence |
|---|---|---|
| Root plans/members | Root-only plan CRUD, membership search/assignment and overview; strict DTOs | [Admin routes](../../../PycharmProjects/magic-worlds-api/src/routes/admin_membership.py), [repository](../../../PycharmProjects/magic-worlds-api/src/database/mysql/membership_admin_models.py), [frontend console](../src/features/admin/membership) |
| Runtime operation coverage | Nine operations, including `voice_preview`; derive required limits from the source tuple. `tts_generation` and `voice_call` additionally require a `daily_quantity_limit` (next row) | [MEMBERSHIP_OPERATIONS](../../../PycharmProjects/magic-worlds-api/src/database/mysql/models.py) |
| Voice quantity caps | Since BFF 6d6138d (2026-10-14) every plan must carry `daily_quantity_limit` for `tts_generation` (Standard-equivalent narration characters per day) and `voice_call` (call seconds per day), null for all other operations; root API callers get 422 `daily_quantity_limit_required` without it, and the caps are enforced at runtime. The root plan editor supports the field. Working tree (uncommitted, 2026-10-15): the plan editor and usage breakdown hide operations whose frontend feature is disabled, so with voices off (the default; `false` in `.env.example`) root cannot edit the voice rows or caps from the UI: new plans copy those limits and caps from the default plan and edits keep the existing values (`voice_call` also needs calls enabled) | [Admin repository](../../../PycharmProjects/magic-worlds-api/src/database/mysql/membership_admin_models.py), [admin routes](../../../PycharmProjects/magic-worlds-api/src/routes/admin_membership.py), [PlanEditorDialog](../src/features/admin/membership/components/PlanEditorDialog.tsx), [operation feature filter](../src/shared/featureFlags.ts) |
| Mutable local catalog | Free/custom plans have local controls; paid sync and deactivation retain their guards | [Admin repository](../../../PycharmProjects/magic-worlds-api/src/database/mysql/membership_admin_models.py), [bootstrap](../../../PycharmProjects/magic-worlds-api/src/database/mysql/bootstrap.py) |
| Paid catalog reconciliation | Current paid priority codes are `plus` and `pro`; arbitrary root plans are not automatically checkout products | [Billing catalog](../../../PycharmProjects/magic-worlds-api/src/services/billing_catalog.py) |
| Credits and grants | Included/PAYG accounting, quota limits, promo/email grants and profile usage retain independent behavior | [Billing reference](billing/README.md), [profile membership](../src/features/profile/components/MembershipSection.tsx) |

Seed numbers and historical plan fixtures are not an inventory of live customer entitlements. Read authorized current APIs for an environment-specific plan/usage view; no membership/database/provider call was made by this cleanup.

## MEMBER-01 — open work

| Item | Current disposition | Acceptance |
|---|---|---|
| Durable membership assignment audit | Writes log assignment details; no durable assignment history contract established | Versioned durable actor/reason/previous/new assignment record and access/retention tests |
| Admin monthly totals after manual reset | Admin month aggregates and per-user reset semantics need reconciliation | Agreed accounting contract and fixtures for reset/repeated reset/ledger boundaries |
| Expanded paid catalog | `PLAN_PRIORITY` still limits paid reconciliation to the supported paid codes | Coordinated api.auth catalog, BFF priority/entitlement and checkout/reconciliation tests |
| Plan comparison | Existing current-plan display does not establish a public supported comparison API | Product-approved scope and truthful free/custom/paid presentation |
| Membership lifecycle | Current local status model is not a general pause/cancel subscription system | Separate schema/behavior decision before advertising those operations |

Named owners and dates are TBD in [the roadmap](ROADMAP.md). A full-suite pass does not close the audit/reset/catalog items. Rechecked 2026-10-15: the api.auth 2026-10-13 group/billing-scope commits do not address MEMBER-01; the BFF still has no durable assignment-history table and `PLAN_PRIORITY` is still `free`/`plus`/`pro`.
