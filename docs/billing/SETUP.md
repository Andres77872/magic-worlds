# Billing setup and actual availability

**Reviewed 2026-10-14. Status: WIP — purchase UI disabled in this local configuration.** `VITE_BILLING_ENABLED` is absent from local `.env`, so the frontend helper returns false. `.env.example` explicitly sets it to `true`; the code default for an unset value is false. Local backend provider-sync flags are true, but that does not enable the frontend or establish provider/catalog readiness. See [status register](../FEATURE_STATUS.md).

The [pricing document](README.md) is historical research and a schema proposal. This file describes current source/configuration, not a claim that checkout was exercised.

## Independent systems

| Layer | Implementation / gate |
| --- | --- |
| Purchase plans / PAYG credits | SPA `VITE_BILLING_ENABLED` plus configured BFF/api.auth billing catalog and checkout/portal routes |
| Membership/credit display and usage | MySQL membership/ledger models and `/user/me`; independent of checkout gate |
| Promo code and email grants | Redemption/claim routes and root credit-token console; independent of checkout gate |
| Patreon entitlements | Backend reconciliation is independently gated. Frontend `VITE_PATREON_ENABLED` is scaffolding; no link/connect UI ships |

## Frontend gate and server behavior

[isBillingFeatureEnabled](../../src/shared/billingFeatureFlag.ts) requires the exact string `true`. [useBillingCatalog](../../src/features/billing/hooks/useBillingCatalog.ts) skips fetching when the gate is off or the user is signed out. While loading or on failure it reports `enabled:false`; this is client state, not necessarily a successful disabled catalog response.

The current BFF [GET /billing/plans](../../../../PycharmProjects/magic-worlds-api/src/routes/billing_subscriptions.py) calls `_require_billing_enabled`: when provider sync is off it returns **HTTP 503 “Billing is not available.”** A configured, validated catalog returns `enabled:true`. The earlier documented `200 {enabled:false}` disabled-server response is not the current BFF contract; the frontend can still consume that shape if a server supplies it.

When the frontend gate is off, Profile hides “Plans & credits”; a direct `#/billing` renders its unavailable state without fetching the catalog. With it on, failures render the page's error/retry state, and purchase actions require a successfully enabled catalog. Promo grants and quotas keep their own behavior.

## BFF startup configuration

Source of truth: [BillingRuntimeConfig](../../../../PycharmProjects/magic-worlds-api/src/services/billing_config.py), backend `.env.example`, and its runtime-config tests. Configuration is validated once at startup. Restart the BFF after changing it; build/restart the Vite client after changing its flag.

| Variable | Current requirement |
| --- | --- |
| `BILLING_PROVIDER_SYNC_ENABLED` | Defaults false. Enables Stripe catalog/checkout/portal and Stripe facts reconciliation |
| `PATREON_PROVIDER_SYNC_ENABLED` | Defaults false. Enables Patreon entitlement reads during reconciliation |
| `BILLING_PROJECT_HASH` | **Required** when either provider-sync gate is on; no fallback to `PROJECT_HASH` or request session |
| `BILLING_S2S_BEARER_TOKEN` | **Required** when either provider is on, including Patreon-only reconciliation; dedicated api.auth S2S secret |
| `PATREON_S2S_BEARER_TOKEN` | Additionally required for Patreon sync; must be absent when its gate is off |
| `FRONTEND_PUBLIC_BASE_URL` | Exact HTTP(S) origin with no path, required for Stripe return URLs. Fixed return paths derive from it |

When both provider gates are off, provider-specific settings must be absent according to the startup orphan-setting rules; keeping credentials configured while a gate is off can be a startup error. Consult the loader rather than treating malformed/incomplete configuration as a quiet disabled state.

**Retired and rejected variables:** `BILLING_SUCCESS_URL`, `BILLING_CANCEL_URL`, `BILLING_PORTAL_RETURN_URL`, `EMAIL_CREDIT_GRANT_ACTION_URL`. Use `FRONTEND_PUBLIC_BASE_URL`. Derived paths are `/#/profile?billing=success`, `cancel`, `portal`, and `/#/profile?claimEmailCredits=1`.

The BFF reads validated plan/pack lookup keys from api.auth's remote catalog; the old guide's BFF `BILLING_LOOKUP_KEY_*` tuning and hardcoded catalog advice are superseded. Stripe secrets and provider setup remain owned by api.auth. This review did not configure or verify that service's live account.

## Release verification — WIP / TBD

1. Validate BFF startup configuration and api.auth project/catalog/S2S agreement in the intended environment. Confirm the exact return origin is permitted upstream.
2. Explicitly choose `VITE_BILLING_ENABLED=true` for that build and verify signed-in `/billing/plans` succeeds with the current contract.
3. In a payment sandbox, verify subscription checkout, credit checkout, portal, cancellation and return reconciliation through Profile. Verify repeated reconciliation cannot grant duplicate credits.
4. Verify off-mode hides purchases and makes no catalog request; redemption, profile usage and root membership/credit consoles remain functional.
5. Record provider/refund/reconciliation evidence before closing [BILL-01](../ROADMAP.md). Connecting Patreon UI is a separate **TBD** product scope.

No payments, provider requests, environment changes or deployment were performed by this documentation review.
