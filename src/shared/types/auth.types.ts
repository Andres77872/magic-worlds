/**
 * Authentication types
 */

export interface User {
    user_hash: string
    username: string
    /** Optional public-facing name. Null/absent → fall back to {@link username}. */
    display_name?: string | null
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
}

export interface MembershipMonthlyOperationUsage {
    used: number
    credits_used: number
    included_credits_used: number
    payg_credits_used: number
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

export interface Membership {
    plan_code: string
    display_name: string
    credits: MembershipCredits
    payg: MembershipPayg
    total_available_credits: number
    limits: Record<string, MembershipOperationLimit>
    monthly_usage?: MembershipMonthlyUsage
    profile_cards?: MembershipProfileCards
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
    user_type: string
    /** Total available credits: remaining included credits plus PAYG balance. */
    user_usage: number
    /** Membership + PAYG credit details. Optional for safe rollout against older API responses. */
    membership?: Membership
    card_counts: UserCardCounts
}

export type PreferredLanguage = 'en' | 'es'

export interface UserPreferences {
    preferred_language: PreferredLanguage
    has_preference: boolean
}

export interface UserPreferencesUpdate {
    preferred_language: PreferredLanguage
}

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
