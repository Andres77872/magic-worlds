/**
 * Authentication types
 */

export type AvatarVariantId = 'A' | 'B' | 'C' | 'D'

export interface User {
    user_hash: string
    username: string
    /** Optional public-facing name. Null/absent → fall back to {@link username}. */
    display_name?: string | null
    /** Protected root-relative avatar URL (e.g. `/user/me/avatar/variant_A/512.webp`). */
    avatar_url?: string | null
    email?: string | null
    user_type: string
    created_at: string | null
    updated_at: string | null
}

/**
 * Per-type counts of cards the user has authored, as returned inside the
 * `/user/me` response (magic-worlds-api `UserCardCounts`).
 */
export interface UserCardCounts {
    character: number
    world: number
    adventure_template: number
    item: number
}

export interface MembershipCredits {
    period: string
    max: number
    used: number
    remaining: number
    usage_date: string
}

export interface MembershipOperationLimit {
    daily_limit: number
    used_today: number
    max_in_flight: number
    in_flight: number
    credit_cost: number
    billing_unit?: 'action' | 'audio_seconds' | string
    seconds_per_credit?: number
    billable_seconds_today?: number
}

export interface MembershipPayg {
    balance: number
    free_balance: number
    billed_balance: number
}

export interface MembershipMonthlyOperationUsage {
    used: number
    credits_used: number
    included_credits_used: number
    payg_credits_used: number
    payg_free_credits_used: number
    payg_billed_credits_used: number
    billable_seconds?: number
}

export interface MembershipMonthlyUsage {
    period: 'calendar_month' | string
    month: string
    start_date: string
    end_date: string
    credits_used: number
    included_credits_used: number
    payg_credits_used: number
    payg_free_credits_used: number
    payg_billed_credits_used: number
    operations: Record<string, MembershipMonthlyOperationUsage>
}

export interface MembershipProfileCardVisual {
    tone: 'current' | 'locked' | 'payg' | string
    icon: 'sparkles' | 'rocket' | 'crown' | 'coins' | string
}

export interface MembershipProfileCardAction {
    state: 'active' | 'disabled' | 'reference_only' | string
    label: string
    enabled: boolean
}

export interface MembershipProfileCardCredits {
    period: string
    max: number
    used: number
    remaining: number
    usage_date?: string | null
    preview: boolean
}

export interface MembershipProfileCardLimit {
    daily_limit: number
    used_today: number
    max_in_flight: number
    in_flight: number
    credit_cost: number
    preview: boolean
}

export interface MembershipTierProfileCard {
    plan_code: string
    display_name: string
    status: 'current' | 'locked' | string
    available: boolean
    reference_only: boolean
    badge: string
    description: string
    highlights: string[]
    credits: MembershipProfileCardCredits
    limits: Record<string, MembershipProfileCardLimit>
    visual: MembershipProfileCardVisual
    action: MembershipProfileCardAction
}

export interface MembershipPaygProfileCard {
    balance: number
    free_balance: number
    billed_balance: number
    credit_cost: number
    covered_operations: string[]
    non_expiring: boolean
    available: boolean
    reference_only: boolean
    badge: string
    description: string
    highlights: string[]
    visual: MembershipProfileCardVisual
    action: MembershipProfileCardAction
}

export interface MembershipProfileCards {
    current_plan_code: string
    tiers: MembershipTierProfileCard[]
    payg: MembershipPaygProfileCard
}

/**
 * Today's voice usage against the plan's daily caps (D24, D18). Narration
 * characters are Standard-equivalent (Expressive counts twice); call time is
 * in seconds. Every field is optional: servers before the R0 usage DTO send
 * none of them, and the UI shows a row only when its fields are present.
 */
export interface MembershipVoiceUsage {
    narration_chars_used?: number | null
    narration_chars_limit?: number | null
    call_seconds_used?: number | null
    call_seconds_limit?: number | null
    /** Recipe previews (`voice_preview`) still allowed today. */
    previews_left?: number | null
}

export interface Membership extends MembershipVoiceUsage {
    plan_code: string
    display_name: string
    credits: MembershipCredits
    payg: MembershipPayg
    total_available_credits: number
    /** Per operation, including `voice_preview` (D18) once the server seeds it. */
    limits: Record<string, MembershipOperationLimit>
    monthly_usage?: MembershipMonthlyUsage | null
    profile_cards: MembershipProfileCards
    /**
     * Voice usage block. **Proposal (09 §1.8):** nested here; 08 §1.10 lists the
     * same fields on the membership itself, so readers accept both placements
     * (`readVoiceUsage`).
     */
    voice_usage?: MembershipVoiceUsage | null
}

/**
 * Shape of `GET /user/me` (magic-worlds-api `UserMeResponse`). Distinct from
 * {@link User}: the profile endpoint carries usage + content stats rather than
 * the email/timestamps returned at login. This API is read-only — username,
 * email and password are owned by the external auth provider.
 */
export interface UserProfile {
    user_hash: string
    username: string
    /** Optional public-facing name. Null/absent → fall back to {@link username}. */
    display_name?: string | null
    /** Protected root-relative URL for the active profile avatar variant. */
    avatar_url?: string | null
    /** Currently active variant ('A' | 'B' | 'C' | 'D'), or null if none ready yet. */
    active_avatar_variant?: AvatarVariantId | null
    /** Variants ready on disk for selection ('A'..'D'). */
    available_avatar_variants?: AvatarVariantId[]
    user_type: string
    membership: Membership
    card_counts: UserCardCounts
}

export type PreferredLanguage = 'en' | 'es'

/** Narration quality tier (D05). Tier names, never provider model ids. */
export type NarrationTier = 'standard' | 'expressive'

/** `user_preferences.narration_tier` until the account picks another (D05, 08 §5.2). */
export const DEFAULT_NARRATION_TIER: NarrationTier = 'standard'

/**
 * `GET`/`PATCH /user/preferences` (08 §5.2, 09 §2). The API client fills
 * `narration_tier` with {@link DEFAULT_NARRATION_TIER} when a server before R0
 * leaves it out, so it is always present. The stored tier is returned as is:
 * `GET /voices/capabilities` clamps it to `tiers_allowed`. No UI writes it in
 * R0 (09: the toggle ships in R1).
 */
export interface UserPreferences {
    preferred_language: PreferredLanguage
    has_preference: boolean
    /** The account's narration tier (D05); `standard` by default. Expressive needs Plus or Pro. */
    narration_tier: NarrationTier
}

/**
 * `PATCH /user/preferences` (08 §5.2, 09 §2): a partial update; only the fields
 * sent are written. At least one field is required, as the server refuses an
 * empty body and an explicit null (422). `narration_tier: 'expressive'` is
 * refused with 422 `{detail: {code, message, path: 'narration_tier'}}` and
 * nothing is written: `voice_plan_locked` below Plus, and
 * `voice_tier_unavailable` when the plan allows it but the Expressive model is
 * unavailable (I-32: plan ∩ healthy models); copy in `voices.errors.tierUnavailable`.
 *
 * A tier-only body updates an existing row only: with no row yet (the account
 * never saved a language) the server answers FastAPI's validation 422 for a
 * missing `preferred_language` instead of storing a default language. So the
 * R1 tier toggle must always send the current `preferred_language` together
 * with `narration_tier`, which also covers a first write.
 */
export type UserPreferencesUpdate =
    | { preferred_language: PreferredLanguage; narration_tier?: NarrationTier }
    | { preferred_language?: PreferredLanguage; narration_tier: NarrationTier }

export interface Project {
    project_hash: string
    project_name: string
    project_description: string
    created_at: string | null
    updated_at: string | null
}

export interface UserGroupInfo {
    group_hash: string
    group_name: string
    description?: string
}

export interface BrowserAuthResponse {
    success: boolean
    message: string
    access_token?: string
    session_token?: string
    token_type?: string
    expires_in?: number
    expires_at?: string | null
    refresh_expires_in?: number
    refresh_expires_at?: string | null
    user?: User
    project?: Project | null
    accessible_projects?: Project[]
    user_groups?: UserGroupInfo[]
    user_id?: number | string
}

export type LoginResponse = BrowserAuthResponse

export interface LoginCredentials {
    username: string
    password: string
}

export interface RegisterData {
    username: string
    password: string
    email?: string
}

export type RegisterResponse = BrowserAuthResponse

export interface ChatMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface AuthState {
    isAuthenticated: boolean
    user: User | null
    token: string | null
    projects: Project[]
    isLoading: boolean
    error: string | null
}

/**
 * Generic accepted body returned by the BFF password/email proxy routes.
 * Forgot-password and email-verify always return this (no account enumeration);
 * change-password returns it on success.
 */
export interface GenericMessageResponse {
    success: boolean
    message: string
}

export type ChangePasswordResponse = GenericMessageResponse

export interface PasswordForgotRequest {
    email_or_username: string
}

export interface PasswordResetRequest {
    token: string
    new_password: string
}

export interface PasswordChangeRequest {
    current_password: string
    new_password: string
}

export interface EmailVerifyRequest {
    token: string
}

export type EmailStatus = 'activated' | 'pending' | 'removed' | 'suppressed'

/** One of a user's email addresses (owner view; provider returns masked values). */
export interface UserEmail {
    id: string
    email?: string | null
    email_masked?: string | null
    status: EmailStatus | string
    is_primary: boolean
    added_at?: string | null
    activated_at?: string | null
    last_activation_sent_at?: string | null
}

export interface EmailListResponse {
    success: boolean
    message?: string
    emails: UserEmail[]
}
