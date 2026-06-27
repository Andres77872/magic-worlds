/**
 * Frontend kill-switch for the Stripe billing purchase surface (the
 * "Plans & credits" entry and the {@link BillingPage} checkout / credit-pack /
 * manage-subscription actions).
 *
 * Default OFF: an unset/absent `VITE_BILLING_ENABLED` resolves to `false`, so
 * billing is hidden unless the env var is explicitly the string `'true'`.
 * Purchases still also require the server catalog to be enabled
 * (`GET /billing/plans` `enabled`). The credits system — usage, deductions,
 * wallet balance, promo-code redemption and email-grant claims — is independent
 * of this flag and works regardless.
 */
export function isBillingFeatureEnabled(): boolean {
    return import.meta.env.VITE_BILLING_ENABLED === 'true'
}
