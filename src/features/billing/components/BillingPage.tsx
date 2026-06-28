/**
 * Plans & credits page (`#/billing`). Reads the billing catalog and the current
 * membership, then drives the api.auth-backed purchase flows:
 *
 *   - subscription Checkout  -> Stripe hosted page, returns to `#/profile?billing=...`
 *   - credit-pack Checkout   -> Stripe hosted page (one-time)
 *   - manage subscription    -> restricted Stripe Portal (cancel / payment method)
 *
 * Fulfillment is server-side: on return, ProfilePage calls `reconcileBilling()` which
 * upgrades the plan and credits the wallet. This page only starts the hosted flows.
 */
import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Coins, Crown, Loader2, Rocket, Settings, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import { useAuth, useNavigation } from '@/app/hooks'
import { isBillingFeatureEnabled } from '@/shared/billingFeatureFlag'
import type { UserProfile } from '@/shared'
import type { BillingPlanCatalogResponse } from '@/shared/types/billing.types'
import { Badge, Button, Callout, Card, Eyebrow, Icon, IconTile, SectionHeader, Toast } from '@/ui/primitives'
import { cx } from '@/ui/primitives/cx'
import { LoadingSpinner } from '@/ui/components/LoadingSpinner'

const PLAN_ICON: Record<string, LucideIcon> = {
    free: Sparkles,
    plus: Rocket,
    pro: Crown,
}

function formatPrice(cents: number): string {
    if (!cents) return 'Free'
    const dollars = cents / 100
    return `$${dollars.toFixed(dollars % 1 === 0 ? 0 : 2)}`
}

export function BillingPage() {
    const { isAuthenticated, openLoginModal } = useAuth()
    const { setPage } = useNavigation()
    // Frontend kill-switch: when off (the default) we never fetch the catalog and
    // the page degrades to the "not available" callout, so a direct #/billing
    // visit can't reach any purchase action.
    const featureEnabled = isBillingFeatureEnabled()

    const [catalog, setCatalog] = useState<BillingPlanCatalogResponse | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    // Start in the loading state so the first fetch shows a spinner without
    // calling setState synchronously inside the effect (mirrors useUserProfile).
    // When billing is off there is nothing to fetch, so start resolved and let
    // the render fall straight through to the "not available" callout.
    const [loading, setLoading] = useState(featureEnabled)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState<string | null>(null)
    const [toast, setToast] = useState<{ tone: 'error'; title: string } | null>(null)
    // Bumping this re-runs the effect to refetch on demand (from event handlers).
    const [reloadKey, setReloadKey] = useState(0)

    const retry = () => {
        setLoading(true)
        setError(null)
        setReloadKey((k) => k + 1)
    }

    useEffect(() => {
        // Nothing to fetch when signed out or billing is off; `loading` already
        // starts resolved in those cases (no setState-in-effect needed).
        if (!isAuthenticated || !featureEnabled) return
        let cancelled = false
        Promise.all([apiService.getBillingPlans(), apiService.getUserProfile()])
            .then(([plans, me]) => {
                if (cancelled) return
                setError(null)
                setCatalog(plans)
                setProfile(me)
            })
            .catch((err) => {
                if (cancelled) return
                setError(err instanceof Error ? err.message : 'Could not load plans. Please try again.')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [isAuthenticated, featureEnabled, reloadKey])

    const redirectTo = (url: string) => {
        // Leaving the SPA for Stripe's hosted page; the browser returns to
        // `#/profile?billing=...` where ProfilePage reconciles the result.
        window.location.assign(url)
    }

    const startSubscription = async (planCode: string) => {
        setPending(`sub:${planCode}`)
        try {
            const { url } = await apiService.createSubscriptionCheckout(planCode)
            redirectTo(url)
        } catch (err) {
            setToast({ tone: 'error', title: err instanceof Error ? err.message : 'Could not start checkout.' })
            setPending(null)
        }
    }

    const buyCredits = async (productCode: string) => {
        setPending(`pack:${productCode}`)
        try {
            const { url } = await apiService.createCreditCheckout(productCode)
            redirectTo(url)
        } catch (err) {
            setToast({ tone: 'error', title: err instanceof Error ? err.message : 'Could not start checkout.' })
            setPending(null)
        }
    }

    const manageSubscription = async () => {
        setPending('portal')
        try {
            const { url } = await apiService.createBillingPortal()
            redirectTo(url)
        } catch (err) {
            setToast({ tone: 'error', title: err instanceof Error ? err.message : 'Could not open the billing portal.' })
            setPending(null)
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8">
                <Card className="flex flex-col items-start gap-3 p-6">
                    <h1 className="font-display text-h2 font-semibold text-parchment-50">Plans &amp; credits</h1>
                    <p className="font-ui text-[14px] text-parchment-300">Sign in to view plans and manage your subscription.</p>
                    <Button variant="primary" size="sm" onClick={openLoginModal}>Sign in</Button>
                </Card>
            </div>
        )
    }

    const currentPlan = profile?.membership?.plan_code ?? 'free'
    const billingEnabled = featureEnabled && (catalog?.enabled ?? false)
    const isPaid = currentPlan === 'plus' || currentPlan === 'pro'

    return (
        <div className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8">
            <div className="mb-6 flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setPage('profile')}>
                    <Icon icon={ArrowLeft} size={16} /> Back
                </Button>
            </div>

            <SectionHeader
                icon={Coins}
                title="Plans & credits"
                right={isPaid ? (
                    <Button variant="secondary" size="sm" onClick={manageSubscription} disabled={!billingEnabled || pending !== null}>
                        {pending === 'portal' ? <Icon icon={Loader2} size={14} className="animate-spin" /> : <Icon icon={Settings} size={14} />}
                        Manage subscription
                    </Button>
                ) : undefined}
            />

            {loading && !catalog ? (
                <div className="py-16"><LoadingSpinner /></div>
            ) : error ? (
                <div className="mt-4 flex flex-col gap-3">
                    <div className="rounded-md border border-blood-500/30 bg-blood-500/10 px-4 py-3 text-[14px] text-blood-500">{error}</div>
                    <div><Button variant="secondary" size="sm" onClick={retry}>Try again</Button></div>
                </div>
            ) : !billingEnabled ? (
                <div className="mt-4">
                    <Callout tone="info">
                        Plans &amp; credits aren&apos;t available right now. You can still add credits by redeeming a code from your profile.
                    </Callout>
                </div>
            ) : (
                <div className="mt-4 flex flex-col gap-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        {(catalog?.plans ?? []).map((plan) => {
                            const isCurrent = plan.plan_code === currentPlan
                            const purchasable = plan.plan_code !== 'free' && !isCurrent && billingEnabled
                            const icon = PLAN_ICON[plan.plan_code] ?? Sparkles
                            return (
                                <Card
                                    key={plan.plan_code}
                                    className={cx('flex flex-col gap-5 p-5', isCurrent ? 'border-ember-500/45 shadow-glow-ember' : 'bg-ink-700/75')}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        {isCurrent
                                            ? <IconTile icon={icon} tone="ember" size="sm" />
                                            : <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink-600 text-parchment-300"><Icon icon={icon} size={20} /></span>}
                                        {isCurrent && <Badge tone="ember">Current</Badge>}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="font-display text-h3 font-semibold text-parchment-50">{plan.display_name}</h3>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="font-display text-h2 font-semibold leading-none text-parchment-50">{formatPrice(plan.monthly_price_cents)}</span>
                                            {plan.monthly_price_cents > 0 && <span className="font-ui text-[12px] text-parchment-400">/ month</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 font-ui text-[13px] text-parchment-200">
                                        <Icon icon={Check} size={14} className="text-ember-400" />
                                        {plan.daily_credit_limit} included credits / day
                                    </div>

                                    {isCurrent ? (
                                        <Button variant="secondary" size="sm" disabled full className="mt-auto">Current plan</Button>
                                    ) : plan.plan_code === 'free' ? (
                                        <Button variant="ghost" size="sm" disabled full className="mt-auto">Included free</Button>
                                    ) : (
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            full
                                            className="mt-auto"
                                            disabled={!purchasable || pending !== null}
                                            onClick={() => startSubscription(plan.plan_code)}
                                        >
                                            {pending === `sub:${plan.plan_code}` && <Icon icon={Loader2} size={14} className="animate-spin" />}
                                            {currentPlan === 'free' ? `Upgrade to ${plan.display_name}` : `Switch to ${plan.display_name}`}
                                        </Button>
                                    )}
                                </Card>
                            )
                        })}
                    </div>

                    <section className="flex flex-col gap-3">
                        <Eyebrow tone="muted">Credit packs (one-time, non-expiring)</Eyebrow>
                        <div className="grid gap-4 sm:grid-cols-3">
                            {(catalog?.credit_packs ?? []).map((pack) => (
                                <Card key={pack.credit_product_code} className="flex flex-col gap-4 p-5">
                                    <div className="flex items-center gap-3">
                                        <IconTile icon={Coins} tone="ember" size="sm" />
                                        <div className="flex flex-col">
                                            <span className="font-display text-h3 font-semibold text-parchment-50">{pack.credits} credits</span>
                                            <span className="font-ui text-[12px] text-parchment-400">{formatPrice(pack.price_cents)} one-time</span>
                                        </div>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        full
                                        className="mt-auto"
                                        disabled={!billingEnabled || pending !== null}
                                        onClick={() => buyCredits(pack.credit_product_code)}
                                    >
                                        {pending === `pack:${pack.credit_product_code}` && <Icon icon={Loader2} size={14} className="animate-spin" />}
                                        Buy
                                    </Button>
                                </Card>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            <Toast
                open={toast !== null}
                tone={toast?.tone ?? 'error'}
                title={toast?.title ?? ''}
                onClose={() => setToast(null)}
                autoCloseMs={6000}
            />
        </div>
    )
}
