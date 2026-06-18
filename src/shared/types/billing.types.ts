/**
 * Billing / credit-code types — mirror the magic-worlds-api `/admin/billing`
 * endpoints (root-only free-credit tokens + email invites) and the user-facing
 * `POST /billing/credits/redeem` redemption.
 *
 * A "credit code" grants a numeric `credits` amount (free PAYG credits), not a
 * membership tier or user group. Email invites grant the same credits to a given
 * address and are claimable by users who own / activate that email.
 */

export type FreeCreditStatus = 'active' | 'disabled' | 'redeemed'

/**
 * A one-time redeem code that grants `credits`. The raw `token` string is only
 * present on the create response — list / get responses omit it (the backend
 * stores it hashed and can never show it again).
 */
export interface FreeCreditToken {
    token_id: number
    label: string | null
    credits: number
    status: FreeCreditStatus
    expires_at: string | null
    redeemed_by_user_id: number | null
    redeemed_at: string | null
    created_by_user_id: number | null
    reason: string | null
    created_at: string | null
    updated_at: string | null
    /** Raw redeemable code — populated only on the create response. */
    token?: string | null
}

export interface FreeCreditTokenCreateRequest {
    credits: number
    label?: string | null
    expires_at?: string | null
    reason?: string | null
}

export interface FreeCreditTokenUpdateRequest {
    credits?: number | null
    label?: string | null
    status?: 'active' | 'disabled'
    expires_at?: string | null
    reason?: string | null
}

export interface FreeCreditTokenListResponse {
    items: FreeCreditToken[]
    limit: number
    offset: number
    next_offset: number | null
}

/** An email-targeted credit grant, auto-redeemed at the recipient's next login. */
export interface FreeCreditInvite {
    invite_id: number
    email: string
    label: string | null
    credits: number
    status: FreeCreditStatus
    expires_at: string | null
    redeemed_by_user_id: number | null
    redeemed_at: string | null
    created_by_user_id: number | null
    reason: string | null
    created_at: string | null
    updated_at: string | null
    claim_status?: string | null
    email_message_id?: string | null
    email_delivery_status?: string | null
    email_delivery_checked_at?: string | null
}

export interface FreeCreditInviteCreateRequest {
    emails: string[]
    credits: number
    label?: string | null
    expires_at?: string | null
    reason?: string | null
}

export interface FreeCreditInviteUpdateRequest {
    email?: string | null
    credits?: number | null
    label?: string | null
    status?: 'active' | 'disabled'
    expires_at?: string | null
    reason?: string | null
}

export interface FreeCreditInviteListResponse {
    items: FreeCreditInvite[]
    limit: number
    offset: number
    next_offset: number | null
}

export interface CreditRedeemRequest {
    token: string
}

/**
 * Result of redeeming a code. The UI only needs `credits_added` and the refreshed
 * `total_available_credits`; `payg` and `membership` are backend passthrough
 * objects (the profile re-fetch surfaces their detail) and are left loose.
 */
export interface CreditRedeemResponse {
    credits_added: number
    total_available_credits: number
    payg?: unknown
    membership?: unknown
}

/** Pending invite visible to a signed-in user through activated account emails. */
export interface EmailCreditInvite {
    invite_id: number
    email_masked?: string | null
    label?: string | null
    credits: number
    expires_at?: string | null
}

export interface EmailCreditInviteListResponse {
    items: EmailCreditInvite[]
    total_credits: number
}

export interface EmailCreditInviteClaimResponse {
    credits_added: number
    claimed_invites: EmailCreditInvite[]
    total_available_credits: number
    payg?: unknown
    membership?: unknown
}
