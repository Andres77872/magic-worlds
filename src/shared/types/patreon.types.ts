/**
 * Patreon link / entitlement API types.
 *
 * Patreon is an entitlement source only. These DTOs mirror the BFF-safe
 * projection from api.auth and intentionally exclude provider identifiers,
 * emails, proof material, and local auth/session tokens.
 */

export type PatreonLinkStatus = 'none' | 'pending' | 'linked' | 'unlinked' | 'revoked' | 'stale' | string

export interface PatreonSafeEntitlement {
    external_source?: 'patreon' | null
    status: string
    plan_code: string
    tier_code?: string | null
    tier_name?: string | null
    link_status: PatreonLinkStatus
    next_renewal_at?: string | null
    grace_period_until?: string | null
    last_synced_at?: string | null
    stale_after?: string | null
    classification_version?: number
}

export interface PatreonLinkRequest {
    patreon_email_hint?: string | null
    explicit_user_intent: boolean
    confirm_email_match?: boolean
}

export interface PatreonProofConfirmRequest {
    token?: string | null
    lookup_id?: string | null
    secret?: string | null
    explicit_user_intent: boolean
}

export interface PatreonUnlinkRequest {
    explicit_user_intent?: boolean
    confirm_unlink?: boolean
}

export interface PatreonBaseResponse {
    success?: boolean
    message?: string | null
}

export interface PatreonProofRequestResponse extends PatreonBaseResponse {
    accepted?: boolean
    link_status?: PatreonLinkStatus | null
    retry_after_seconds?: number | null
}

export interface PatreonLinkStatusResponse extends PatreonBaseResponse {
    link_status: PatreonLinkStatus
    entitlement?: PatreonSafeEntitlement | null
    retry_after_seconds?: number | null
}

export interface PatreonUnlinkResponse extends PatreonBaseResponse {
    link_status: PatreonLinkStatus
    entitlement?: PatreonSafeEntitlement | null
}
