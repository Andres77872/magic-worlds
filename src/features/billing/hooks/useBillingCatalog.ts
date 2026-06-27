/**
 * Loads the billing catalog from `GET /billing/plans` for the signed-in user.
 *
 * `enabled` is the single signal the SPA uses to decide whether to surface the
 * Stripe purchase flows (the "Plans & credits" entry + the purchase actions on
 * {@link BillingPage}). It is intentionally conservative: while the catalog is
 * loading, when the request fails, or when the user is signed out, `enabled`
 * stays `false` so the UI never advertises billing it can't actually offer (no
 * show-then-hide flash). Billing turned off server-side still resolves
 * successfully with `{ enabled: false, ... }`.
 *
 * The frontend env kill-switch ({@link isBillingFeatureEnabled}) gates this
 * entirely: when off (the default) the hook short-circuits to `enabled: false`
 * without fetching the catalog, so no purchase UI is offered and no network call
 * fires. When on, the server `enabled` flag still has the final say.
 *
 * The promo-credit features (redeem code, email-grant claim, the admin Credit
 * Codes console) are independent of this flag — they work without billing.
 */
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/app/hooks'
import { apiService } from '@/infrastructure/api'
import { isBillingFeatureEnabled } from '@/shared/billingFeatureFlag'
import type { BillingPlanCatalogResponse } from '@/shared/types/billing.types'

interface UseBillingCatalogResult {
    catalog: BillingPlanCatalogResponse | null
    /** True only once the server confirms billing is enabled. */
    enabled: boolean
    loading: boolean
    error: string | null
    /** Re-fetch the catalog on demand (e.g. a retry button). */
    reload: () => void
}

export function useBillingCatalog(): UseBillingCatalogResult {
    const { isAuthenticated } = useAuth()
    const [catalog, setCatalog] = useState<BillingPlanCatalogResponse | null>(null)
    // Start loading so the first render is "not yet known" rather than a
    // premature "disabled" flash; the effect resolves it.
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // Bumping this re-runs the effect to refetch on demand.
    const [reloadKey, setReloadKey] = useState(0)

    // Invoked from event handlers (not an effect), so setting state here is safe.
    const reload = useCallback(() => {
        setLoading(true)
        setError(null)
        setReloadKey((k) => k + 1)
    }, [])

    useEffect(() => {
        // Billing disabled at the frontend, or signed-out users who can't
        // purchase — treat as not-enabled without a fetch.
        if (!isBillingFeatureEnabled() || !isAuthenticated) {
            setCatalog(null)
            setError(null)
            setLoading(false)
            return
        }

        let cancelled = false
        setLoading(true)
        apiService
            .getBillingPlans()
            .then((data) => {
                if (cancelled) return
                setError(null)
                setCatalog(data)
            })
            .catch((err) => {
                if (cancelled) return
                // A failed catalog load must not advertise billing — leave it disabled.
                setCatalog(null)
                setError(err instanceof Error ? err.message : 'Could not load plans.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [isAuthenticated, reloadKey])

    return { catalog, enabled: catalog?.enabled ?? false, loading, error, reload }
}
