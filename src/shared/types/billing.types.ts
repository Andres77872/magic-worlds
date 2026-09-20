/**
 * Billing / promotional credit grant types. Credit codes are shareable one-time
 * grants; email credit grants attach credits to addresses and are claimable from
 * Profile after the address is known to the account.
 */

import type { Membership } from './auth.types'

export type CreditGrantStatus = 'active' | 'disabled' | 'claimed'

/**
 * The state a grant is presented as in the admin console. Unlike the stored
 * `CreditGrantStatus`, this folds in the computed `expired` state (an `active`
 * grant whose `expires_at` is in the past).
 */
export type CreditGrantViewStatus = 'active' | 'claimed' | 'expired' | 'disabled'

/** Which inventory the unified console is showing. */
export type CreditGrantKind = 'code' | 'email'

/** Server-side filter for admin grant listings. `undefined` = all states. */
export type CreditGrantListStatus = 'active' | 'claimed' | 'expired' | 'disabled'

/** Server-side ordering for admin grant listings. */
export type CreditGrantListSort = 'recent' | 'credits' | 'expiry'

export interface CreditGrantListParams {
    status?: CreditGrantListStatus
    search?: string
    sort?: CreditGrantListSort
    limit?: number
    offset?: number
}

/** Per-state counts + summed credits for one grant inventory. */
export interface CreditGrantStateCounts {
    active: number
    active_credits: number
    claimed: number
    claimed_credits: number
    expired: number
    expired_credits: number
    disabled: number
    disabled_credits: number
    total: number
    total_credits: number
}

export interface CreditGrantSummaryResponse {
    codes: CreditGrantStateCounts
    emails: CreditGrantStateCounts
}

export type QuotaResetTarget = 'user' | 'all'
export type QuotaResetPeriod = 'daily' | 'monthly'

export interface QuotaResetRequest {
    target: QuotaResetTarget
    user_id?: number | null
    user_hash?: string | null
    periods: QuotaResetPeriod[]
    reason?: string | null
}

export interface QuotaResetDailyCounts {
    membership_usage_days: number
    membership_operation_usage_days: number
    ai_card_quota_days: number
}

export interface QuotaResetMonthlyResult {
    reset_id: number
    effective_month: string
    reset_at?: string | null
}

export interface QuotaResetResponse {
    outcome: string
    target: QuotaResetTarget
    target_user_id?: number | null
    target_user_hash?: string | null
    periods: QuotaResetPeriod[]
    reset_at?: string | null
    daily?: QuotaResetDailyCounts | null
    monthly?: QuotaResetMonthlyResult | null
    membership?: Membership | null
}

/**
 * A one-time redeemable code that grants `credits`. The raw `code` string is
 * present only on create; list / get responses omit it because the backend
 * stores only a hash.
 */
export interface CreditCodeGrant {
    code_id: number
    label: string | null
    credits: number
    status: CreditGrantStatus
    expires_at: string | null
    claimed_by_user_id: number | null
    claimed_at: string | null
    created_by_user_id: number | null
    reason: string | null
    created_at: string | null
    updated_at: string | null
    /** Computed server-side: an `active` grant whose `expires_at` has passed. */
    is_expired?: boolean
    code?: string | null
}

export interface CreditCodeGrantCreateRequest {
    credits: number
    label?: string | null
    expires_at?: string | null
    reason?: string | null
}

export interface CreditCodeGrantUpdateRequest {
    credits?: number | null
    label?: string | null
    status?: 'active' | 'disabled'
    expires_at?: string | null
    reason?: string | null
}

export interface CreditCodeGrantListResponse {
    items: CreditCodeGrant[]
    limit: number
    offset: number
    next_offset: number | null
    total?: number | null
}

/** Credits attached to a target email address and optionally delivered by email. */
export interface EmailCreditGrant {
    grant_id: number
    email: string
    label: string | null
    credits: number
    status: CreditGrantStatus
    expires_at: string | null
    claimed_by_user_id: number | null
    claimed_at: string | null
    created_by_user_id: number | null
    reason: string | null
    created_at: string | null
    updated_at: string | null
    /** Computed server-side: an `active` grant whose `expires_at` has passed. */
    is_expired?: boolean
    email_message_id?: string | null
    email_delivery_status?: string | null
    email_delivery_checked_at?: string | null
}

export interface EmailCreditGrantCreateRequest {
    emails: string[]
    credits: number
    label?: string | null
    expires_at?: string | null
    reason?: string | null
}

export interface EmailCreditGrantUpdateRequest {
    email?: string | null
    credits?: number | null
    label?: string | null
    status?: 'active' | 'disabled'
    expires_at?: string | null
    reason?: string | null
}

export interface EmailCreditGrantListResponse {
    items: EmailCreditGrant[]
    limit: number
    offset: number
    next_offset: number | null
    total?: number | null
}

export interface CreditCodeRedeemRequest {
    code: string
}

export interface CreditCodeRedeemResponse {
    credits_added: number
    total_available_credits: number
    payg?: unknown
    membership?: unknown
}

/** Pending email grant visible to a signed-in user through activated account emails. */
export interface EmailCreditGrantOffer {
    grant_id: number
    email_masked?: string | null
    label?: string | null
    credits: number
    expires_at?: string | null
}

export interface EmailCreditGrantOfferListResponse {
    items: EmailCreditGrantOffer[]
    total_credits: number
}

export interface EmailCreditGrantClaimResponse {
    credits_added: number
    claimed_grants: EmailCreditGrantOffer[]
    total_available_credits: number
    payg?: unknown
    membership?: unknown
}

// --- Subscriptions & PAYG checkout (api.auth-backed billing) ----------------
//
// These wrap the BFF's /billing/{plans,subscription/checkout,credits/checkout,
// portal,reconcile} endpoints, which proxy api.auth's facts-only Stripe surface.

/** A purchasable recurring plan in the catalog (`GET /billing/plans`). */
export interface BillingPlanCatalogItem {
    plan_code: string
    display_name: string
    tier_code?: string
    tier_name?: string
    monthly_price_cents: number
    daily_credit_limit: number
    kind: 'subscription'
}

/** A one-time PAYG credit pack in the catalog. */
export interface BillingCreditPackCatalogItem {
    credit_product_code: string
    display_name: string
    credits: number
    price_cents: number
    kind: 'credit_pack'
}

/**
 * Catalog response. `enabled` is false when billing is turned off server-side —
 * the SPA should render pricing read-only and disable purchase actions.
 */
export interface BillingPlanCatalogResponse {
    enabled: boolean
    plans: BillingPlanCatalogItem[]
    credit_packs: BillingCreditPackCatalogItem[]
}

/** Hosted Checkout session — redirect the browser to `url`. */
export interface BillingCheckoutSessionResponse {
    url: string
    checkout_ref?: string | null
}

/** Hosted Portal session — redirect the browser to `url`. */
export interface BillingPortalSessionResponse {
    url: string
    portal_ref?: string | null
}

/** Normalised subscription statuses surfaced from api.auth billing facts. */
export type SubscriptionStatusValue =
    | 'free'
    | 'pending'
    | 'incomplete'
    | 'trialing'
    | 'active'
    | 'past_due'
    | 'unpaid'
    | 'paused'
    | 'canceled'
    | 'former'
    | 'stale'
    | 'unknown'

export interface BillingSubscriptionStatus {
    status: SubscriptionStatusValue | string
    plan_code?: string | null
    tier_code?: string | null
    tier_name?: string | null
    cancel_at_period_end: boolean
    current_period_end?: string | null
}

/**
 * Result of `POST /billing/reconcile`: the refreshed membership after applying
 * api.auth billing/Patreon facts, plus how many credits a paid purchase added.
 */
export interface BillingReconcileResponse {
    plan_code: string
    changed: boolean
    credits_added: number
    subscription?: BillingSubscriptionStatus | null
    membership: Membership
}

// --- Membership plans & members (root console, /admin/billing/{plans,memberships}) --

/** Per-operation quota row of a plan (`membership_plan_limit`). */
export interface MembershipPlanLimit {
    daily_request_limit: number
    max_in_flight: number
    credit_cost: number
}

/**
 * A membership plan as the root console sees it. `is_default` marks the three
 * plans provisioned by the schema (`free`, `plus`, `pro`); `is_billing_synced`
 * marks the paid defaults whose name and included credits mirror api.auth's
 * Stripe catalog and therefore cannot be edited locally.
 */
export interface MembershipPlan {
    plan_code: string
    display_name: string
    credit_reset_period: 'daily' | string
    daily_credit_limit: number
    is_active: boolean
    is_default: boolean
    is_billing_synced: boolean
    member_count: number
    limits: Record<string, MembershipPlanLimit>
    created_at: string | null
    updated_at: string | null
}

export interface MembershipPlanListResponse {
    items: MembershipPlan[]
    /** Every runtime operation a plan must define a limit for, in display order. */
    operations: string[]
}

export interface MembershipPlanCreateRequest {
    plan_code: string
    display_name: string
    daily_credit_limit: number
    is_active?: boolean
    limits: Record<string, MembershipPlanLimit>
}

export interface MembershipPlanUpdateRequest {
    display_name?: string | null
    daily_credit_limit?: number | null
    is_active?: boolean | null
    limits?: Record<string, MembershipPlanLimit> | null
}

export type MembershipMemberSort = 'recent' | 'usage_today' | 'usage_month' | 'payg' | 'username'

export interface MembershipMemberListParams {
    plan_code?: string
    search?: string
    sort?: MembershipMemberSort
    limit?: number
    offset?: number
}

/** One account with its plan, today's included usage, month ledger usage, and PAYG balances. */
export interface MembershipMember {
    user_id: number
    user_hash: string
    username: string
    display_name: string | null
    user_type: string
    created_at: string | null
    plan_code: string
    plan_display_name: string
    daily_credit_limit: number
    is_default_plan: boolean
    /** True when the account has no membership row yet and is treated as `free`. */
    implicit_free: boolean
    membership_status: string
    started_at: string | null
    updated_at: string | null
    credits_used_today: number
    credits_used_month: number
    included_credits_used_month: number
    payg_credits_used_month: number
    payg_free_balance: number
    payg_billed_balance: number
    payg_balance: number
}

export interface MembershipMemberListResponse {
    items: MembershipMember[]
    limit: number
    offset: number
    next_offset: number | null
    total: number
    usage_date: string
    month: string
}

export interface MembershipAssignRequest {
    user_id?: number | null
    user_hash?: string | null
    plan_code: string
    reason?: string | null
}

export interface MembershipAssignResponse {
    outcome: 'accepted' | string
    user_id: number
    user_hash: string
    username: string
    plan_code: string
    previous_plan_code: string
    changed: boolean
    membership: Membership
}

export interface MembershipOverviewTotals {
    users: number
    plans: number
    active_plans: number
    custom_plans: number
    active_users_today: number
    credits_used_today: number
    active_users_month: number
    credits_used_month: number
    included_credits_used_month: number
    payg_credits_used_month: number
    payg_wallets: number
    payg_free_balance: number
    payg_billed_balance: number
}

export interface MembershipOverviewPlan {
    plan_code: string
    display_name: string
    is_active: boolean
    is_default: boolean
    is_billing_synced: boolean
    member_count: number
    active_users_today: number
    credits_used_today: number
    active_users_month: number
    credits_used_month: number
    included_credits_used_month: number
    payg_credits_used_month: number
}

export interface MembershipOverviewOperation {
    operation: string
    active_users: number
    used: number
    credits_used: number
}

export interface MembershipOverviewResponse {
    usage_date: string
    month: string
    month_start: string
    month_end: string
    totals: MembershipOverviewTotals
    plans: MembershipOverviewPlan[]
    operations_month: MembershipOverviewOperation[]
}
