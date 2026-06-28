/**
 * API infrastructure - centralized API request handling
 */

import type {
    AdminVoiceCloneRequest,
    AdminVoiceCloneResponse,
    AdminVoiceClonePurpose,
    AdminVoiceCloneUploadResponse,
    AdminVoiceConcreteType,
    AdminVoiceDeleteResponse,
    AdminVoiceDesignRequest,
    AdminVoiceDesignResponse,
    AdminVoiceListResponse,
    AdminVoiceQueryType,
    AdminVoiceTestRequest,
    AdminVoiceTestResponse,
} from '../../shared/types/adminVoice.types'
import type {
    VoicePreset,
    VoicePresetCreatePayload,
    VoicePresetPreviewRequest,
    VoicePresetUpdatePayload,
} from '../../shared/types/voicePreset.types'
import type {
    AgentCreateRequest,
    AgentDetail,
    AgentModelsResponse,
    AgentSummary,
    AgentTestRequest,
    AgentTestResponse,
    AgentUpdateDraftRequest,
    AgentVersionsResponse,
} from '../../shared/types/agent.types'
import type {
    BrowserAuthResponse,
    ChangePasswordResponse,
    EmailListResponse,
    GenericMessageResponse,
    LoginCredentials,
    LoginResponse,
    RegisterData,
    RegisterResponse,
    UserPreferences,
    UserPreferencesUpdate,
    UserProfile,
} from '../../shared/types/auth.types'
import type {
    BillingCheckoutSessionResponse,
    BillingPlanCatalogResponse,
    BillingPortalSessionResponse,
    BillingReconcileResponse,
    CreditCodeGrant,
    CreditCodeGrantCreateRequest,
    CreditCodeGrantListResponse,
    CreditCodeGrantUpdateRequest,
    CreditGrantListParams,
    CreditGrantSummaryResponse,
    CreditCodeRedeemResponse,
    EmailCreditGrant,
    EmailCreditGrantClaimResponse,
    EmailCreditGrantCreateRequest,
    EmailCreditGrantListResponse,
    EmailCreditGrantOfferListResponse,
    EmailCreditGrantUpdateRequest,
    QuotaResetRequest,
    QuotaResetResponse,
} from '../../shared/types/billing.types'
import type {
    PatreonLinkRequest,
    PatreonLinkStatusResponse,
    PatreonProofConfirmRequest,
    PatreonProofRequestResponse,
    PatreonUnlinkRequest,
    PatreonUnlinkResponse,
} from '../../shared/types/patreon.types'
import { API_BASE_URL } from './baseUrl'
import { getProtectedMediaPath } from './mediaUrl'
import { isPatreonFeatureEnabled } from '../../shared/patreonFeatureFlag'
import { makeRequestId } from '../../utils/uuid'
import { configureChatSocketAuthRefresh } from './chatSocket'
import { configureVoiceSocketAuthRefresh } from './voiceSocket'
import type { ChatImageAsset, ChatImageError, ChatTtsAsset, ChatTtsError, ImageLifecycleStatus, TtsLifecycleStatus } from '../../shared/types/interaction.types'
import type { VoiceCallLimits, VoiceCallListResponse, VoiceCallTranscriptResponse, VoiceSegmentUploadRequest, VoiceSegmentUploadResponse } from '../../shared/types/voice.types'
import type { AdventureSnapshot } from '../../shared/types/adventure.types'
import type {
    LoreActivationPreviewRequest,
    LoreActivationPreviewResponse,
    Lorebook,
    LorebookAttachment,
    LorebookAssistantConversationListResponse,
    LorebookAssistantConversationResponse,
    LorebookAssistantRequestOptions,
    LorebookAssistantStreamEvent,
    LorebookAssistantTurnResponse,
    LorebookDraft,
    LorebookEntry,
    LorebookEntryDraft,
    LorebookIssue,
    LorebookResource,
    LorebookTargetKind,
} from '../../shared/types/lorebook.types'
import type {
    AdventureTemplateCardResponse,
    AiCardErrorEnvelope,
    AiCardPublicError,
    AiCardRequestOptions,
    CardAssistantConversationListResponse,
    CardAssistantConversationResponse,
    CardAssistantCardType,
    CardAssistantRequestOptions,
    CardAssistantStreamEvent,
    CardAssistantTurnResponse,
    CharacterCardResponse,
    ItemCardResponse,
    WorldCardResponse,
} from '../../shared/types/aiCard.types'
import type {
    CardCloneResponse,
    CardShareLinkResponse,
    SharedCardListResponse,
    SharedCardResource,
    ShareableCardType,
} from '../../shared/types/cardSharing.types'
import type {
    CardDraftDocument,
    CardHistoricalDocument,
    CardPublishResult,
    CardUsage,
    CardVersion,
    CardVersionList,
    VersionableCardType,
} from '../../shared/types/cardVersion.types'
import type {
    CardMediaTargetType,
    CardPortraitRequest,
    ImageJobListResponse,
    ImageUploadResponse,
    ThemeSongCreateRequest,
    ThemeSongJobPublic,
    ThemeSongJobStatus,
    ThemeSongListResponse,
    UserThemeSongListResponse,
} from '../../shared/types/media.types'
import { THEME_SONG_NON_TERMINAL_STATUSES } from '../../shared/types/media.types'
import type {
    BackgroundTaskListResponse,
    BackgroundTaskOperation,
    BackgroundTaskPublic,
    BackgroundTaskState,
} from '../../shared/types/task.types'
import type {
    Story,
    StoryCardRef,
    StoryChapter,
    StoryContextTrace,
    StoryCreateRequest,
    StoryGenerateRequest,
    StoryGenerateResponse,
} from '../../shared/types/story.types'

export interface AdventureSessionMessagesResponse {
    adventure_id: number
    version: number
    messages: Array<Record<string, unknown>>
}

export interface ImageJobPublicResponse {
    job_id: string
    status: ImageLifecycleStatus
    status_url: string
    result_url: string
    assets?: ChatImageAsset[]
    error?: ChatImageError | null
}

export interface TtsJobPublicResponse {
    job_id: string
    status: TtsLifecycleStatus
    status_url: string
    result_url: string
    assets?: ChatTtsAsset[]
    error?: ChatTtsError | null
}

export interface ApiHealthResponse {
    status: string
}

export type ApiDependencyStatus = 'ok' | 'offline'

export interface ApiDependencyService {
    id: string
    label: string
    status: ApiDependencyStatus | string
    message?: string | null
    latency_ms?: number | null
    components?: ApiDependencyService[]
}

export interface ApiDependencyHealthResponse {
    status: 'ok' | 'offline' | string
    checked_at?: string
    services: ApiDependencyService[]
}

export interface VoiceConsentResponse {
    status: 'accepted'
    consent_version: string
    limits: VoiceCallLimits
}

export interface VoiceEndResponse {
    status: 'ended' | 'not_found'
    voice_session_id: string | null
    reason: string
}

export type CardExportType = 'character' | 'world' | 'adventure_template' | 'item'
export type CardShareType = ShareableCardType

const TOKEN_STORAGE_KEY = 'magic_worlds:token'
const USER_STORAGE_KEY = 'magic_worlds:user'

type AuthRefreshedDetail = BrowserAuthResponse & { token: string }

let refreshInFlight: Promise<string> | null = null

/**
 * Error thrown for non-2xx HTTP responses, carrying the status code so callers
 * can distinguish a transient backend outage (5xx — e.g. the auth service is
 * briefly down and the API returns 503) from a real client-side error. Transient
 * failures should be handled gently (retry, empty state) rather than surfaced as
 * alarming error UI.
 */
export class ApiError extends Error {
    readonly status: number
    readonly category?: string
    readonly code?: string
    readonly requestId?: string
    readonly retryable?: boolean
    readonly retryAfterSeconds?: number
    readonly action?: string
    /** The raw structured `detail` object, when the server returned one (e.g. a 409 already-imported conflict). */
    readonly details?: Record<string, unknown>

    constructor(status: number, message: string, metadata: Partial<Pick<ApiError, 'category' | 'code' | 'requestId' | 'retryable' | 'retryAfterSeconds' | 'action' | 'details'>> = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.category = metadata.category
        this.code = metadata.code
        this.requestId = metadata.requestId
        this.retryable = metadata.retryable
        this.retryAfterSeconds = metadata.retryAfterSeconds
        this.action = metadata.action
        this.details = metadata.details
    }

    /** A transient server-side failure (502/503/504, or any 5xx) worth retrying. */
    get isTransient(): boolean {
        return this.status >= 500 || this.retryable === true
    }
}

interface ParsedApiError {
    message: string
    category?: string
    code?: string
    requestId?: string
    retryable?: boolean
    retryAfterSeconds?: number
    action?: string
    details?: Record<string, unknown>
}

type ApiRequestOptions = RequestInit & {
    timeoutMs?: number
    rejectAccepted?: boolean
}

type HeaderRecord = Record<string, string>

export interface LorebookResourceMetadataSaveOptions {
    extractMetadata?: boolean
    requestId?: string
    idempotencyKey?: string
}

class ApiService {
    private baseUrl: string

    constructor() {
        this.baseUrl = API_BASE_URL
    }

    /**
     * Generic fetch wrapper with common configuration
     */
    private async request<T>(
        endpoint: string,
        options: ApiRequestOptions = {},
        parseAsJson: boolean = true,
        isAuthEndpoint: boolean = false
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        const { timeoutMs, rejectAccepted, ...fetchOptions } = options
        
        // Handle JSON serialization if body is an object
        let body = fetchOptions.body
        if (body && typeof body === 'object' && (typeof FormData === 'undefined' || !(body instanceof FormData))) {
            body = JSON.stringify(body)
        }

        let didTimeout = false
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined
        let signal = fetchOptions.signal
        if (timeoutMs && timeoutMs > 0) {
            const controller = new AbortController()
            signal = controller.signal
            if (fetchOptions.signal) {
                if (fetchOptions.signal.aborted) {
                    controller.abort(fetchOptions.signal.reason)
                } else {
                    fetchOptions.signal.addEventListener('abort', () => controller.abort(fetchOptions.signal?.reason), { once: true })
                }
            }
            timeoutHandle = setTimeout(() => {
                didTimeout = true
                controller.abort(new DOMException('AI card request timed out locally', 'AbortError'))
            }, timeoutMs)
        }
         
        // Multipart uploads must NOT carry a JSON content type — the browser sets
        // `multipart/form-data; boundary=…` itself, and forcing application/json
        // (or any explicit value) strips the boundary and breaks server parsing.
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
        const headers: HeaderRecord = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            'Accept': 'application/json',
            ...this.toHeaderRecord(fetchOptions.headers)
        }
        if (isFormData) delete headers['Content-Type']
        const config: RequestInit = {
            ...fetchOptions,
            headers,
            body,
            signal
        }
        const skipAuthRecovery = isAuthEndpoint || this.isAuthLifecycleEndpoint(endpoint)

        try {
            let response = await fetch(url, config)
            if (timeoutHandle) clearTimeout(timeoutHandle)

            // Session-expiry handling applies ONLY to already-authenticated
            // requests — never to login/register, whose 401/400/422 responses
            // must surface to the user as the real error message.
            if (response.status === 401 && !skipAuthRecovery) {
                try {
                    const nextToken = await this.refreshAccessToken(this.getStoredToken())
                    response = await fetch(url, this.withAuthorization(config, nextToken))
                } catch (error) {
                    if (this.isTerminalAuthError(error)) {
                        return this.terminalAuthResult<T>(config, parseAsJson)
                    }
                    throw error
                }

                // If refresh succeeded but the retried endpoint still rejects the
                // request, keep the session intact and surface that endpoint's
                // error below. Login is forced only when /auth/refresh itself is
                // denied.
            }

            if (rejectAccepted && response.status === 202) {
                throw new ApiError(502, 'AI card generation returned an unsupported async response.', {
                    category: 'configuration_unavailable',
                    code: 'ai_card_unexpected_async_contract',
                    requestId: response.headers.get('X-Request-Id') || undefined,
                    retryable: true,
                    action: 'try_again_later',
                })
            }

            if (!response.ok) {
                const parsed = await this.extractError(response)
                // 5xx is a transient backend outage (e.g. the auth service is
                // briefly down → 503) — log quietly. Other statuses are real
                // errors worth an error-level log.
                const log = response.status >= 500 ? console.warn : console.error
                log('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    message: parsed.message,
                    category: parsed.category,
                    code: parsed.code,
                    requestId: parsed.requestId,
                })
                throw new ApiError(response.status, parsed.message, parsed)
            }

            if (parseAsJson) {
                // 204 No Content (e.g. asset deletes) and other empty bodies have no
                // JSON to parse — calling response.json() on them throws. Treat as success.
                if (response.status === 204 || response.headers.get('content-length') === '0') {
                    return undefined as T
                }
                return await response.json()
            } else {
                return await response.text() as T
            }
        } catch (error) {
            if (timeoutHandle) clearTimeout(timeoutHandle)
            if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
                throw new ApiError(0, 'Local wait timed out. The server may still finish and save the card; retrying uses the same key to avoid duplicates.', {
                    category: 'timeout',
                    code: 'ai_card_client_timeout',
                    retryable: true,
                    action: 'retry_with_same_idempotency_key',
                })
            }
            // ApiError was already logged above with the right level; only log
            // genuine network/unexpected failures here (and keep it gentle).
            if (!(error instanceof ApiError)) {
                console.warn(`API request error for ${endpoint}:`, error)
            }
            throw error
        }
    }

    private toHeaderRecord(headers?: HeadersInit): HeaderRecord {
        const result: HeaderRecord = {}
        if (!headers) return result
        if (headers instanceof Headers) {
            headers.forEach((value, key) => {
                result[key] = value
            })
            return result
        }
        if (Array.isArray(headers)) {
            for (const [key, value] of headers) {
                result[key] = value
            }
            return result
        }
        return { ...headers }
    }

    private isAuthLifecycleEndpoint(endpoint: string): boolean {
        const path = endpoint.split('?')[0].replace(/\/+$/, '')
        return path === '/auth/login'
            || path === '/auth/register'
            || path === '/auth/platform/login'
            || path === '/auth/refresh'
            || path === '/auth/logout'
            || path === '/auth/provider-init/google'
            || path === '/auth/google/exchange'
    }

    private withAuthorization(config: RequestInit, token: string): RequestInit {
        return {
            ...config,
            headers: {
                ...this.toHeaderRecord(config.headers),
                Authorization: `Bearer ${token}`,
            },
        }
    }

    private terminalAuthResult<T>(config: RequestInit, parseAsJson: boolean): T {
        // Safe reads degrade gracefully to an empty response. Mutations
        // (POST/PUT/DELETE) must NOT silently resolve — otherwise a
        // create/update during an expired session looks successful while
        // nothing was persisted. Throw so the caller surfaces the error.
        const method = (config.method ?? 'GET').toString().toUpperCase()
        if (method === 'GET') {
            return (parseAsJson ? {} : '') as T
        }
        throw new ApiError(401, 'Your session has expired. Please log in again.')
    }

    private expireAuth(): void {
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
        window.dispatchEvent(new CustomEvent('auth:expired'))
    }

    private selectAccessToken(response: BrowserAuthResponse): string {
        return response.session_token || response.access_token || ''
    }

    private sanitizeAuthResponse(response: BrowserAuthResponse & Record<string, unknown>, token: string): AuthRefreshedDetail {
        const sanitized = { ...response }
        delete sanitized.refresh_token
        return { ...sanitized, token }
    }

    private isTerminalAuthError(error: unknown): boolean {
        return error instanceof ApiError
            && (error.status === 401 || (error.status === 403 && !this.isForbiddenOriginError(error.status, error.message)))
    }

    private isForbiddenOriginError(status: number, message: string): boolean {
        return status === 403 && /origin not allowed/i.test(message)
    }

    private async performRefresh(oldToken: string = this.getStoredToken()): Promise<string> {
        const headers: HeaderRecord = {
            'Accept': 'application/json',
        }
        if (oldToken) {
            headers.Authorization = `Bearer ${oldToken}`
        }

        const response = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers,
        })

        if (!response.ok) {
            const parsed = await this.extractError(response)
            const error = new ApiError(response.status, parsed.message, parsed)
            if ((response.status === 401 || response.status === 403) && !this.isForbiddenOriginError(response.status, parsed.message)) {
                this.expireAuth()
            }
            throw error
        }

        const body = await response.json() as BrowserAuthResponse & Record<string, unknown>
        const nextToken = this.selectAccessToken(body)
        if (!nextToken) {
            throw new ApiError(503, 'Authentication service returned no access token', {
                category: 'authentication_unavailable',
                code: 'auth_refresh_missing_access_token',
                retryable: true,
            })
        }

        localStorage.setItem(TOKEN_STORAGE_KEY, nextToken)
        if (body.user) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(body.user))
        }
        const detail = this.sanitizeAuthResponse(body, nextToken)
        window.dispatchEvent(new CustomEvent<AuthRefreshedDetail>('auth:refreshed', { detail }))
        return nextToken
    }

    async refreshAccessToken(oldToken: string = this.getStoredToken()): Promise<string> {
        if (!refreshInFlight) {
            refreshInFlight = this.performRefresh(oldToken).finally(() => {
                refreshInFlight = null
            })
        }
        return refreshInFlight
    }

    /**
     * Extract a human-readable error message from a failed response.
     * Mirrors the API's error shapes: FastAPI `{detail}`, the provider
     * `{error: {message}}` envelope, or a plain `{message}` — falling back to
     * raw text, then the status code.
     */
    private async extractError(response: Response): Promise<ParsedApiError> {
        const requestIdHeader = response.headers.get('X-Request-Id') || undefined
        const retryAfterHeader = response.headers.get('Retry-After')
        const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : undefined
        try {
            const body = await response.clone().json()
            if (body && typeof body === 'object') {
                const envelope = body as Partial<AiCardErrorEnvelope>
                const publicError = envelope.error as AiCardPublicError | undefined
                const detail = envelope.detail
                const voiceError = detail && typeof detail === 'object'
                    ? detail as { type?: unknown; category?: unknown; message?: unknown; detail?: unknown; retry_after_seconds?: unknown; fatal?: unknown }
                    : null
                const structuredDetail = detail && typeof detail === 'object' && !Array.isArray(detail)
                    ? detail as Record<string, unknown>
                    : undefined
                const message =
                    typeof detail === 'string'
                        ? detail
                        : voiceError?.type === 'voice_error' && typeof voiceError.message === 'string'
                          ? voiceError.message
                        : typeof voiceError?.detail === 'string'
                          ? voiceError.detail
                        : publicError?.message
                          ? String(publicError.message)
                          : typeof (body as { message?: unknown }).message === 'string'
                            ? String((body as { message: string }).message)
                            : undefined
                if (message) {
                    return {
                        message,
                        category: typeof voiceError?.category === 'string' ? voiceError.category : publicError?.category,
                        code: publicError?.code,
                        requestId: publicError?.request_id || envelope.request_id || requestIdHeader,
                        retryable: publicError?.retryable,
                        retryAfterSeconds: typeof voiceError?.retry_after_seconds === 'number'
                            ? voiceError.retry_after_seconds
                            : publicError?.retry_after_seconds ?? (Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined),
                        action: publicError?.action,
                        details: structuredDetail,
                    }
                }
            }
        } catch {
            // Body is not JSON — fall through to text.
        }
        try {
            const text = (await response.text()).trim()
            if (text) return { message: text.slice(0, 300), requestId: requestIdHeader, retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined }
        } catch {
            // Body already consumed or unreadable.
        }
        return { message: `Request failed (${response.status})`, requestId: requestIdHeader, retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined }
    }

    /**
     * Make authenticated requests with token
     */
    async authenticatedRequest<T>(
        endpoint: string,
        token: string,
        options: ApiRequestOptions = {}
    ): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            headers: {
                ...options.headers,
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        })
    }

    private async authenticatedBlob(endpoint: string, errorMessage: string, accept: string): Promise<Blob> {
        const url = `${this.baseUrl}${endpoint}`
        const fetchOnce = (token: string) => fetch(url, {
            method: 'GET',
            headers: {
                Accept: accept,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        })

        let response = await fetchOnce(this.getStoredToken())
        if (response.status === 401) {
            const nextToken = await this.refreshAccessToken(this.getStoredToken())
            response = await fetchOnce(nextToken)
        }
        if (!response.ok) {
            const parsed = await this.extractError(response)
            throw new ApiError(response.status, parsed.message || errorMessage, parsed)
        }
        return response.blob()
    }

    /**
     * Login via the API proxy
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        return this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            credentials: 'include',
            body: credentials as unknown as BodyInit
        }, true, true)
    }

    /**
     * Register via the API proxy
     */
    async register(data: RegisterData): Promise<RegisterResponse> {
        return this.request<RegisterResponse>('/auth/register', {
            method: 'POST',
            credentials: 'include',
            body: data as unknown as BodyInit
        }, true, true)
    }

    /**
     * Platform login via the API proxy. The BFF sets the HttpOnly refresh cookie.
     */
    async platformLogin(credentials: LoginCredentials): Promise<LoginResponse> {
        return this.request<LoginResponse>('/auth/platform/login', {
            method: 'POST',
            credentials: 'include',
            body: credentials as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Logout through the BFF so the HttpOnly refresh cookie is deleted.
     */
    async logout(): Promise<{ success?: boolean; message?: string }> {
        const token = this.getStoredToken()
        return this.request<{ success?: boolean; message?: string }>('/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }, true, true)
    }

    /**
     * Mint an opaque Google provider-init token (step 1 of "Continue with Google").
     *
     * The BFF binds the strict project/group scope server-side and returns only the
     * opaque token. We then navigate the browser top-level to the BFF start-shim
     * (see {@link buildGoogleStartUrl}). `returnOrigin` must equal the origin used
     * here so the provider-init binding validates on redeem.
     */
    async createGoogleProviderInit(returnOrigin: string): Promise<{ provider_init_token: string; expires_in: number; provider?: string }> {
        return this.request<{ provider_init_token: string; expires_in: number; provider?: string }>('/auth/provider-init/google', {
            method: 'POST',
            credentials: 'include',
            body: { return_origin: returnOrigin, purpose: 'login' } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Build the top-level navigation URL to the BFF Google start-shim (step 2).
     *
     * api.auth's /auth/google/start is POST+JSON, so the browser cannot navigate to
     * it directly; the BFF shim accepts this GET and 303-redirects to Google. Use
     * with `window.location.assign(...)` — this is a full navigation, not a fetch.
     */
    buildGoogleStartUrl(providerInitToken: string, rememberMe: boolean, returnOrigin: string): string {
        const params = new URLSearchParams({
            pit: providerInitToken,
            return_origin: returnOrigin,
            remember_me: String(rememberMe),
        })
        return `${this.baseUrl}/auth/google/start/shim?${params.toString()}`
    }

    /**
     * Redeem the one-time delivery code from the Google return (final step).
     *
     * After the OAuth dance the BFF set the HttpOnly refresh cookie and redirected
     * the browser to the SPA with an opaque single-use code. This exchanges it for
     * the sanitized auth body (access token + user), the same shape as /auth/login.
     */
    async exchangeGoogleReturn(code: string): Promise<LoginResponse> {
        return this.request<LoginResponse>('/auth/google/exchange', {
            method: 'POST',
            credentials: 'include',
            body: { code } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Request a password-reset email by email or username. The BFF always
     * returns a generic accepted body (it never discloses whether the account
     * exists), so this resolves rather than throwing for an unknown identifier.
     */
    async requestPasswordReset(emailOrUsername: string): Promise<GenericMessageResponse> {
        return this.request<GenericMessageResponse>('/auth/password/forgot', {
            method: 'POST',
            body: { email_or_username: emailOrUsername } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Consume a password-reset link token and set a new password. Unauthenticated
     * and cookie-free; a weak password surfaces as a 422 ApiError. On success the
     * provider revokes all sessions and mints none, so the user must sign in after.
     */
    async resetPassword(token: string, newPassword: string): Promise<GenericMessageResponse> {
        return this.request<GenericMessageResponse>('/auth/password/reset', {
            method: 'POST',
            body: { token, new_password: newPassword } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Change the signed-in user's password. `isAuthEndpoint=true` skips the auto
     * refresh-and-retry on 401, so a wrong-current-password 401 (AUTH_1001)
     * surfaces as a form error instead of logging the user out. The provider
     * preserves the current session, so the user stays signed in on success.
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
        const token = this.getStoredToken()
        return this.request<ChangePasswordResponse>('/auth/password/change', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: { current_password: currentPassword, new_password: newPassword } as unknown as BodyInit,
        }, true, true)
    }

    /**
     * Consume an email-activation link token. Unauthenticated; generic accepted
     * body. On success the provider activates the address AND revokes the user's
     * sessions, so the caller must clear local auth and sign in again.
     */
    async verifyEmail(token: string): Promise<GenericMessageResponse> {
        return this.request<GenericMessageResponse>('/auth/email/verify', {
            method: 'POST',
            body: { token } as unknown as BodyInit,
        }, true, true)
    }

    /** List the signed-in user's email addresses (masked). */
    async listEmails(): Promise<EmailListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailListResponse>('/user/me/emails', token, {
            method: 'GET',
        })
    }

    /** Add an email address and enqueue an activation link. */
    async addEmail(email: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>('/user/me/emails', token, {
            method: 'POST',
            body: { email } as unknown as BodyInit,
        })
    }

    /** Resend the activation link for a pending email address. */
    async resendEmailActivation(emailId: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>(
            `/user/me/emails/${encodeURIComponent(emailId)}/resend`, token, { method: 'POST' },
        )
    }

    /** Remove one of the user's email addresses. */
    async removeEmail(emailId: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>(
            `/user/me/emails/${encodeURIComponent(emailId)}`, token, { method: 'DELETE' },
        )
    }

    /** Mark an activated email as the user's primary address. */
    async setPrimaryEmail(emailId: string): Promise<GenericMessageResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<GenericMessageResponse>(
            `/user/me/emails/${encodeURIComponent(emailId)}/primary`, token, { method: 'POST' },
        )
    }

    /**
     * Get the stored token from localStorage
     */
    private getStoredToken(): string {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY)
        if (!token) {
            return ''
        }
        return token.replace(/"/g, '') // Remove quotes from token
    }

    private createClientId(prefix: string): string {
        return makeRequestId(prefix)
    }

    private aiHeaders(options: AiCardRequestOptions): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'X-Request-Id': options.requestId || this.createClientId('mw-ai-card-req'),
            'Idempotency-Key': options.idempotencyKey || this.createClientId('mw-ai-card-idem'),
        }
    }

    private assertAiCardSynchronousContract(value: unknown): void {
        if (!value || typeof value !== 'object') return
        const body = value as Record<string, unknown>
        if ('job_id' in body || 'status_url' in body || body.status === 'pending' || body.status === 'in_progress') {
            throw new ApiError(502, 'AI card generation returned an unsupported async response.', {
                category: 'configuration_unavailable',
                code: 'ai_card_unexpected_async_contract',
                retryable: true,
                action: 'try_again_later',
            })
        }
    }

    private aiRequestOptions(options: AiCardRequestOptions): Pick<ApiRequestOptions, 'signal' | 'timeoutMs' | 'rejectAccepted'> {
        return {
            signal: options.signal,
            timeoutMs: options.timeoutMs,
            rejectAccepted: true,
        }
    }

    private cardAssistantHeaders(options: CardAssistantRequestOptions = {}): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'X-Request-Id': options.requestId || this.createClientId('mw-card-assistant-req'),
        }
    }

    private cardAssistantRequestOptions(options: CardAssistantRequestOptions): Pick<ApiRequestOptions, 'signal' | 'timeoutMs'> {
        return {
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        }
    }

    private lorebookAssistantHeaders(options: LorebookAssistantRequestOptions = {}): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'X-Request-Id': options.requestId || this.createClientId('mw-lorebook-assistant-req'),
        }
    }

    private lorebookAssistantRequestOptions(options: LorebookAssistantRequestOptions): Pick<ApiRequestOptions, 'signal' | 'timeoutMs'> {
        return {
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        }
    }

    // Shared SSE-frame parser for the card- and lorebook-assistant streams
    // (identical wire format; the caller picks the event union via <T>).
    private parseAssistantStreamFrame<T>(frame: string): T | null {
        let eventType = 'message'
        const dataLines: string[] = []
        for (const rawLine of frame.split('\n')) {
            const line = rawLine.trimEnd()
            if (!line || line.startsWith(':')) continue
            if (line.startsWith('event:')) {
                eventType = line.slice(6).trim()
                continue
            }
            if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart())
            }
        }
        if (!dataLines.length) return null
        const data = JSON.parse(dataLines.join('\n')) as Record<string, unknown>
        if (!data || typeof data !== 'object') return null
        return { ...data, type: eventType } as T
    }

    private async readCardAssistantStream(
        response: Response,
        onEvent: (event: CardAssistantStreamEvent) => void,
    ): Promise<void> {
        if (!response.body) {
            throw new ApiError(502, 'Card assistant stream returned no response body.', {
                category: 'upstream_contract',
                code: 'card_assistant_stream_body_missing',
                requestId: response.headers.get('X-Request-Id') || undefined,
                retryable: true,
            })
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const flushFrame = (frame: string) => {
            const event = this.parseAssistantStreamFrame<CardAssistantStreamEvent>(frame)
            if (event) onEvent(event)
        }

        try {
            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
                let separator = buffer.indexOf('\n\n')
                while (separator >= 0) {
                    const frame = buffer.slice(0, separator)
                    buffer = buffer.slice(separator + 2)
                    flushFrame(frame)
                    separator = buffer.indexOf('\n\n')
                }
            }
            buffer += decoder.decode().replace(/\r\n/g, '\n')
            if (buffer.trim()) flushFrame(buffer)
        } finally {
            reader.releaseLock()
        }
    }

    private async readLorebookAssistantStream(
        response: Response,
        onEvent: (event: LorebookAssistantStreamEvent) => void,
    ): Promise<void> {
        if (!response.body) {
            throw new ApiError(502, 'Lorebook assistant stream returned no response body.', {
                category: 'upstream_contract',
                code: 'lorebook_assistant_stream_body_missing',
                requestId: response.headers.get('X-Request-Id') || undefined,
                retryable: true,
            })
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        const flushFrame = (frame: string) => {
            const event = this.parseAssistantStreamFrame<LorebookAssistantStreamEvent>(frame)
            if (event) onEvent(event)
        }

        try {
            while (true) {
                const { value, done } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
                let separator = buffer.indexOf('\n\n')
                while (separator >= 0) {
                    const frame = buffer.slice(0, separator)
                    buffer = buffer.slice(separator + 2)
                    flushFrame(frame)
                    separator = buffer.indexOf('\n\n')
                }
            }
            buffer += decoder.decode().replace(/\r\n/g, '\n')
            if (buffer.trim()) flushFrame(buffer)
        } finally {
            reader.releaseLock()
        }
    }

    /**
     * Lightweight API liveness check. This intentionally avoids auth recovery:
     * the sidebar needs to know whether the API process is reachable even before login.
     */
    async getHealth(options: { signal?: AbortSignal } = {}): Promise<ApiHealthResponse> {
        const response = await fetch(`${this.baseUrl}/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: options.signal,
        })
        if (!response.ok) {
            throw new ApiError(response.status, `Health check failed (${response.status})`)
        }
        return await response.json() as ApiHealthResponse
    }

    /**
     * Detailed health view used by the sidebar monitor. The backend aggregates
     * this API, its local engines, and upstream services owned by adjacent projects.
     */
    async getDependencyHealth(options: { signal?: AbortSignal } = {}): Promise<ApiDependencyHealthResponse> {
        const response = await fetch(`${this.baseUrl}/health/dependencies`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: options.signal,
        })
        if (!response.ok) {
            throw new ApiError(response.status, `Dependency health check failed (${response.status})`)
        }
        return await response.json() as ApiDependencyHealthResponse
    }

    /**
     * Fetch the current user's profile (`GET /user/me`): identity, role, usage
     * quota, and per-type counts of authored cards. Read-only on this API.
     */
    async getUserProfile(): Promise<UserProfile> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserProfile>('/user/me', token, {
            method: 'GET',
        })
    }

    /**
     * Update the current user's public-facing display name (`PATCH /user/me`).
     * Pass `null` (or whitespace, which the backend normalises to null) to clear
     * it and fall back to the username. Returns the refreshed profile.
     */
    async updateDisplayName(displayName: string | null): Promise<UserProfile> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserProfile>('/user/me', token, {
            method: 'PATCH',
            body: { display_name: displayName } as unknown as BodyInit,
        })
    }

    async getUserPreferences(): Promise<UserPreferences> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserPreferences>('/user/preferences', token, {
            method: 'GET',
        })
    }

    async updateUserPreferences(body: UserPreferencesUpdate): Promise<UserPreferences> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<UserPreferences>('/user/preferences', token, {
            method: 'PATCH',
            body: body as unknown as BodyInit,
        })
    }

    async listAdminVoices(voiceType: AdminVoiceQueryType = 'all'): Promise<AdminVoiceListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceListResponse>(
            `/admin/voices?voice_type=${encodeURIComponent(voiceType)}`,
            token,
            { method: 'GET' },
        )
    }

    async designAdminVoice(body: AdminVoiceDesignRequest): Promise<AdminVoiceDesignResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceDesignResponse>('/admin/voices/design', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async deleteAdminVoice(
        voiceType: Exclude<AdminVoiceConcreteType, 'system'>,
        voiceId: string,
    ): Promise<AdminVoiceDeleteResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceDeleteResponse>(
            `/admin/voices/${encodeURIComponent(voiceType)}/${encodeURIComponent(voiceId)}`,
            token,
            { method: 'DELETE' },
        )
    }

    async testAdminVoice(body: AdminVoiceTestRequest): Promise<AdminVoiceTestResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceTestResponse>('/admin/voices/test', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    // --- Billing / promotional credit grants -------------------------------

    /** Serialise admin grant list filters into a query string (omitting empties). */
    private creditGrantQuery(params: CreditGrantListParams = {}): string {
        const search = new URLSearchParams()
        if (params.status) search.set('status', params.status)
        if (params.search?.trim()) search.set('search', params.search.trim())
        if (params.sort) search.set('sort', params.sort)
        search.set('limit', String(params.limit ?? 100))
        search.set('offset', String(params.offset ?? 0))
        return search.toString()
    }

    /** Per-state counts (codes + email grants) for the console KPI tiles. Root only. */
    async getCreditGrantsSummary(): Promise<CreditGrantSummaryResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditGrantSummaryResponse>(
            '/admin/billing/credit-grants/summary',
            token,
            { method: 'GET' },
        )
    }

    /** Reset daily and/or monthly included-membership quota counters. Root only. */
    async resetMembershipQuotas(body: QuotaResetRequest): Promise<QuotaResetResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<QuotaResetResponse>('/admin/billing/quota-resets', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** List one-time credit code grants, filtered / sorted / paginated. Root only. */
    async listCreditCodeGrants(params: CreditGrantListParams = {}): Promise<CreditCodeGrantListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrantListResponse>(
            `/admin/billing/credit-codes?${this.creditGrantQuery(params)}`,
            token,
            { method: 'GET' },
        )
    }

    /** Create a one-time credit code. The response includes the raw `code` once. Root only. */
    async createCreditCodeGrant(body: CreditCodeGrantCreateRequest): Promise<CreditCodeGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrant>('/admin/billing/credit-codes', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Update an unclaimed credit code (credits / label / status / expiry / reason). Root only. */
    async updateCreditCodeGrant(codeId: number, body: CreditCodeGrantUpdateRequest): Promise<CreditCodeGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrant>(
            `/admin/billing/credit-codes/${encodeURIComponent(codeId)}`,
            token,
            { method: 'PATCH', body: body as unknown as BodyInit },
        )
    }

    /** Disable an unclaimed credit code. Root only. */
    async disableCreditCodeGrant(codeId: number): Promise<CreditCodeGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeGrant>(
            `/admin/billing/credit-codes/${encodeURIComponent(codeId)}`,
            token,
            { method: 'DELETE' },
        )
    }

    /** List email-address credit grants, filtered / sorted / paginated. Root only. */
    async listEmailCreditGrants(params: CreditGrantListParams = {}): Promise<EmailCreditGrantListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrantListResponse>(
            `/admin/billing/email-credit-grants?${this.creditGrantQuery(params)}`,
            token,
            { method: 'GET' },
        )
    }

    /** Create email-address credit grants for a batch of addresses. Root only. */
    async createEmailCreditGrants(body: EmailCreditGrantCreateRequest): Promise<EmailCreditGrant[]> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrant[]>('/admin/billing/email-credit-grants', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Update an unclaimed email-address credit grant. Root only. */
    async updateEmailCreditGrant(grantId: number, body: EmailCreditGrantUpdateRequest): Promise<EmailCreditGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrant>(
            `/admin/billing/email-credit-grants/${encodeURIComponent(grantId)}`,
            token,
            { method: 'PATCH', body: body as unknown as BodyInit },
        )
    }

    /** Disable an unclaimed email-address credit grant. Root only. */
    async disableEmailCreditGrant(grantId: number): Promise<EmailCreditGrant> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrant>(
            `/admin/billing/email-credit-grants/${encodeURIComponent(grantId)}`,
            token,
            { method: 'DELETE' },
        )
    }

    /** Redeem a credit code for the signed-in user. Any authed user. */
    async redeemCreditCode(code: string): Promise<CreditCodeRedeemResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CreditCodeRedeemResponse>('/billing/credit-codes/redeem', token, {
            method: 'POST',
            body: { code } as unknown as BodyInit,
        })
    }

    /** List credit grants attached to the signed-in user's activated emails. */
    async listEmailCreditGrantOffers(): Promise<EmailCreditGrantOfferListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrantOfferListResponse>('/billing/email-credit-grants', token, {
            method: 'GET',
        })
    }

    /** Claim credit grants attached to the signed-in user's activated emails. */
    async claimEmailCreditGrants(): Promise<EmailCreditGrantClaimResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<EmailCreditGrantClaimResponse>('/billing/email-credit-grants/claim', token, {
            method: 'POST',
        })
    }

    // --- Subscriptions & PAYG checkout (api.auth-backed billing) -----------

    /** Static plan + credit-pack catalog with a live `enabled` flag. Any authed user. */
    async getBillingPlans(): Promise<BillingPlanCatalogResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingPlanCatalogResponse>('/billing/plans', token, {
            method: 'GET',
        })
    }

    /** Start a Stripe subscription Checkout. Redirect the browser to the returned `url`. */
    async createSubscriptionCheckout(planCode: string): Promise<BillingCheckoutSessionResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingCheckoutSessionResponse>('/billing/subscription/checkout', token, {
            method: 'POST',
            body: { plan_code: planCode } as unknown as BodyInit,
        })
    }

    /** Start a Stripe one-time Checkout for a PAYG credit pack. Redirect to the returned `url`. */
    async createCreditCheckout(creditProductCode: string): Promise<BillingCheckoutSessionResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingCheckoutSessionResponse>('/billing/credits/checkout', token, {
            method: 'POST',
            body: { credit_product_code: creditProductCode } as unknown as BodyInit,
        })
    }

    /** Create a restricted Stripe Portal session (cancel / payment method). Redirect to `url`. */
    async createBillingPortal(returnUrl?: string): Promise<BillingPortalSessionResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingPortalSessionResponse>('/billing/portal', token, {
            method: 'POST',
            body: { return_url: returnUrl ?? null } as unknown as BodyInit,
        })
    }

    /**
     * Pull api.auth billing/Patreon facts and apply them to the local membership.
     * Idempotent — safe to call on checkout return and whenever the billing UI opens.
     */
    async reconcileBilling(): Promise<BillingReconcileResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<BillingReconcileResponse>('/billing/reconcile', token, {
            method: 'POST',
        })
    }

    /** Start the Patreon email-loop proof for the signed-in user. */
    async requestPatreonLink(body: PatreonLinkRequest): Promise<PatreonProofRequestResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonProofRequestResponse>('/patreon/link/request', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Consume a Patreon proof token/parts for the signed-in user. */
    async confirmPatreonLink(body: PatreonProofConfirmRequest): Promise<PatreonLinkStatusResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonLinkStatusResponse>('/patreon/link/confirm', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /** Read the signed-in user's safe Patreon link and entitlement projection. */
    async getPatreonLinkStatus(): Promise<PatreonLinkStatusResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonLinkStatusResponse>('/patreon/link/status', token, {
            method: 'GET',
        })
    }

    /** Soft-unlink Patreon entitlement state for the signed-in user. */
    async unlinkPatreon(body?: PatreonUnlinkRequest): Promise<PatreonUnlinkResponse> {
        if (!isPatreonFeatureEnabled()) throw new Error('Patreon integration is disabled.')
        const token = this.getStoredToken()
        return this.authenticatedRequest<PatreonUnlinkResponse>('/patreon/link', token, {
            method: 'DELETE',
            body: body ? body as unknown as BodyInit : undefined,
        })
    }

    // --- Voice presets (user-facing) ---------------------------------------

    async listVoicePresets(q?: string): Promise<VoicePreset[]> {
        const token = this.getStoredToken()
        const query = q && q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
        return this.authenticatedRequest<VoicePreset[]>(`/voice-presets${query}`, token, { method: 'GET' })
    }

    async createVoicePreset(body: VoicePresetCreatePayload): Promise<VoicePreset> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePreset>('/voice-presets', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async updateVoicePreset(presetId: string, body: VoicePresetUpdatePayload): Promise<VoicePreset> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoicePreset>(`/voice-presets/${encodeURIComponent(presetId)}`, token, {
            method: 'PUT',
            body: body as unknown as BodyInit,
        })
    }

    async deleteVoicePreset(presetId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/voice-presets/${encodeURIComponent(presetId)}`, token, { method: 'DELETE' })
    }

    /** Authenticated (non-root) catalog of MiniMax system voices for the studio + picker. */
    async listSystemVoices(): Promise<AdminVoiceListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceListResponse>('/voice-presets/system-voices', token, { method: 'GET' })
    }

    /** Ephemeral, non-root preview synthesis of a system voice + recipe (hex audio). */
    async previewVoice(body: VoicePresetPreviewRequest): Promise<AdminVoiceTestResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceTestResponse>('/voice-presets/preview', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    // --- Agent Studio (root-only) ------------------------------------------

    async listAgents(): Promise<AgentSummary[]> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentSummary[]>('/admin/agents', token, { method: 'GET' })
    }

    async getAgent(workflowKey: string): Promise<AgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentDetail>(`/admin/agents/${encodeURIComponent(workflowKey)}`, token, {
            method: 'GET',
        })
    }

    async createAgent(body: AgentCreateRequest): Promise<AgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentDetail>('/admin/agents', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async updateAgentDraft(workflowKey: string, body: AgentUpdateDraftRequest): Promise<AgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentDetail>(`/admin/agents/${encodeURIComponent(workflowKey)}/draft`, token, {
            method: 'PUT',
            body: body as unknown as BodyInit,
        })
    }

    async publishAgent(workflowKey: string): Promise<AgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentDetail>(`/admin/agents/${encodeURIComponent(workflowKey)}/publish`, token, {
            method: 'POST',
        })
    }

    async listAgentVersions(workflowKey: string): Promise<AgentVersionsResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentVersionsResponse>(
            `/admin/agents/${encodeURIComponent(workflowKey)}/versions`,
            token,
            { method: 'GET' },
        )
    }

    async rollbackAgentVersion(workflowKey: string, versionId: string): Promise<AgentDetail> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentDetail>(
            `/admin/agents/${encodeURIComponent(workflowKey)}/rollback/${encodeURIComponent(versionId)}`,
            token,
            { method: 'POST' },
        )
    }

    async deleteAgent(workflowKey: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/admin/agents/${encodeURIComponent(workflowKey)}`, token, {
            method: 'DELETE',
        })
    }

    async testAgent(workflowKey: string, body: AgentTestRequest): Promise<AgentTestResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentTestResponse>(`/admin/agents/${encodeURIComponent(workflowKey)}/test`, token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    async listAgentModels(): Promise<AgentModelsResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AgentModelsResponse>('/admin/agents/models', token, { method: 'GET' })
    }

    /** Step 1 of cloning: upload an audio sample (multipart). The browser sets the boundary. */
    async uploadAdminVoiceCloneSample(
        file: File,
        purpose: AdminVoiceClonePurpose = 'voice_clone',
        options: { signal?: AbortSignal } = {},
    ): Promise<AdminVoiceCloneUploadResponse> {
        const token = this.getStoredToken()
        const form = new FormData()
        form.append('file', file)
        form.append('purpose', purpose)
        return this.authenticatedRequest<AdminVoiceCloneUploadResponse>('/admin/voices/clone-file', token, {
            method: 'POST',
            body: form as unknown as BodyInit,
            signal: options.signal,
        })
    }

    /** Step 2 of cloning: create the custom voice from an uploaded sample reference. */
    async cloneAdminVoice(body: AdminVoiceCloneRequest): Promise<AdminVoiceCloneResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<AdminVoiceCloneResponse>('/admin/voices/clone', token, {
            method: 'POST',
            body: body as unknown as BodyInit,
        })
    }

    /**
     * Create a new character
     */
    async createCharacter(characterData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/characters/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: characterData
        })
    }

    /**
     * Generate + persist a new character from a description via the AI endpoint.
     * The backend creates the card and returns it.
     */
    async createCharacterAI(description: string, options: AiCardRequestOptions = {}): Promise<CharacterCardResponse> {
        const token = this.getStoredToken()
        const result = await this.authenticatedRequest<CharacterCardResponse>('/characters/ai/', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: { description: description.trim() } as unknown as BodyInit,
            ...this.aiRequestOptions(options),
        })
        this.assertAiCardSynchronousContract(result)
        return result
    }

    /**
     * Update an existing character
     */
    async updateCharacter(characterId: string, characterData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/${characterId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: characterData
        })
    }

    async exportCardImage(cardType: CardExportType, cardId: string): Promise<Blob> {
        return this.authenticatedBlob(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/export.png`,
            'Card image could not be exported.',
            'image/png',
        )
    }

    async createCardShareLink(cardType: CardShareType, cardId: string): Promise<CardShareLinkResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardShareLinkResponse>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/share`,
            token,
            { method: 'POST' },
        )
    }

    async getSharedCard(shareToken: string): Promise<SharedCardResource> {
        return this.request<SharedCardResource>(`/cards/shared/${encodeURIComponent(shareToken)}`, {
            method: 'GET',
        })
    }

    async importSharedCard(shareToken: string, opts?: { force?: boolean }): Promise<CardCloneResponse> {
        const token = this.getStoredToken()
        const query = opts?.force ? '?force=true' : ''
        return this.authenticatedRequest<CardCloneResponse>(
            `/cards/shared/${encodeURIComponent(shareToken)}/import${query}`,
            token,
            { method: 'POST' },
        )
    }

    async revokeSharedCardLink(shareToken: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/cards/shared/${encodeURIComponent(shareToken)}`, token, {
            method: 'DELETE',
        })
    }

    async publishCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/public`,
            token,
            { method: 'POST' },
        )
    }

    async unpublishCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/public`,
            token,
            { method: 'DELETE' },
        )
    }

    async cloneCard(cardType: CardShareType, cardId: string, opts?: { force?: boolean }): Promise<CardCloneResponse> {
        const token = this.getStoredToken()
        const query = opts?.force ? '?force=true' : ''
        return this.authenticatedRequest<CardCloneResponse>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/clone${query}`,
            token,
            { method: 'POST' },
        )
    }

    async duplicateCard(cardType: CardShareType, cardId: string): Promise<CardCloneResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardCloneResponse>(
            `/cards/${cardType}/${encodeURIComponent(cardId)}/duplicate`,
            token,
            { method: 'POST' },
        )
    }

    // --- Explicit card versioning + usage (character / world / item only) --------------

    /** Route prefix for the versionable card type (characters/worlds/items). */
    private versionBasePath(cardType: VersionableCardType): string {
        if (cardType === 'world') return '/worlds'
        if (cardType === 'item') return '/items'
        return '/characters'
    }

    /** List a card's saved versions (newest first) plus its current latest pointer. */
    async listCardVersions(cardType: VersionableCardType, cardId: string): Promise<CardVersionList> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardVersionList>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions`,
            token,
            { method: 'GET' },
        )
    }

    /** Snapshot the card's current content as a new immutable version ("Save version"). */
    async saveCardVersion(cardType: VersionableCardType, cardId: string, label?: string): Promise<CardVersion> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardVersion>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions`,
            token,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { label: label?.trim() || null } as unknown as BodyInit,
            },
        )
    }

    /** Restore an earlier version into the live card (in place). Returns the updated card. */
    async restoreCardVersion(cardType: VersionableCardType, cardId: string, versionNumber: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}/restore`,
            token,
            { method: 'POST' },
        )
    }

    /** Derived usage for a card: distinct sessions (adventures + chats) and stories. */
    async getCardUsage(cardType: VersionableCardType, cardId: string): Promise<CardUsage> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardUsage>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/usage`,
            token,
            { method: 'GET' },
        )
    }

    // --- Draft buffer + publish (character / world / item only) -------------------------
    // Editing writes to a PRIVATE draft; Publish promotes it to the live card + a new version.
    // Sessions/clones/public viewers always see the published body, never the draft.

    /** Fetch the editable body: the private draft if present, else the published body. */
    async getCardDraft(cardType: VersionableCardType, cardId: string): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            { method: 'GET' },
        )
    }

    /** Write the editor's payload into the private draft (does not touch the live card). */
    async saveCardDraft(cardType: VersionableCardType, cardId: string, body: unknown): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: body as unknown as BodyInit,
            },
        )
    }

    /** Discard the draft, reverting to the published version. Idempotent. */
    async discardCardDraft(
        cardType: VersionableCardType,
        cardId: string,
    ): Promise<{ card_id: string; discarded: boolean; has_draft: boolean }> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/draft`,
            token,
            { method: 'DELETE' },
        )
    }

    /** Promote the draft → live and cut a new version (v{n+1}). 409 when there's nothing to publish. */
    async publishCardDraft(cardType: VersionableCardType, cardId: string, label?: string): Promise<CardPublishResult> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardPublishResult>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/publish`,
            token,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { label: label?.trim() || null } as unknown as BodyInit,
            },
        )
    }

    /** Load an earlier version into the draft for review (the live card is unchanged until publish). */
    async restoreVersionIntoDraft(
        cardType: VersionableCardType,
        cardId: string,
        versionNumber: number,
    ): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}/restore`,
            token,
            { method: 'POST' },
        )
    }

    /**
     * Read-only load of a single historical version's body for display in the editor — does NOT
     * touch the private draft (unlike {@link restoreVersionIntoDraft}). Flagged `is_historical`.
     */
    async getCardVersion(
        cardType: VersionableCardType,
        cardId: string,
        versionNumber: number,
    ): Promise<CardHistoricalDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardHistoricalDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/versions/${versionNumber}`,
            token,
            { method: 'GET' },
        )
    }

    /** Fetch the latest PUBLISHED body for a versionable card (ignores any private draft). */
    async getPublishedBody(cardType: VersionableCardType, cardId: string): Promise<CardDraftDocument> {
        if (cardType === 'world') return (await this.getWorld(cardId)) as CardDraftDocument
        if (cardType === 'item') return (await this.getItem(cardId)) as CardDraftDocument
        return (await this.getCharacter(cardId)) as CardDraftDocument
    }

    /**
     * Patch published-body media (image_url / theme_song_url) directly — media is a
     * published-level property persisted immediately, so a generated portrait/theme shows
     * without a publish and is never staged as unpublished authored content.
     */
    async setCardMedia(
        cardType: VersionableCardType,
        cardId: string,
        media: { image_url?: string | null; theme_song_url?: string | null },
    ): Promise<CardDraftDocument> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardDraftDocument>(
            `${this.versionBasePath(cardType)}/${encodeURIComponent(cardId)}/media`,
            token,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: media as unknown as BodyInit,
            },
        )
    }

    /**
     * Create a new world
     */
    async createWorld(worldData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/worlds/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: worldData
        })
    }

    /**
     * Generate + persist a new world from a description via the AI endpoint.
     * The backend creates the card and returns it.
     */
    async createWorldAI(description: string, options: AiCardRequestOptions = {}): Promise<WorldCardResponse> {
        const token = this.getStoredToken()
        const result = await this.authenticatedRequest<WorldCardResponse>('/worlds/ai/', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: { description: description.trim() } as unknown as BodyInit,
            ...this.aiRequestOptions(options),
        })
        this.assertAiCardSynchronousContract(result)
        return result
    }

    /**
     * Update an existing world
     */
    async updateWorld(worldId: string, worldData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${worldId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: worldData
        })
    }

    /**
     * Create a new item/object
     */
    async createItem(itemData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/items/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: itemData
        })
    }

    /**
     * Generate + persist a new item/object from a description via the AI endpoint.
     */
    async createItemAI(description: string, options: AiCardRequestOptions = {}): Promise<ItemCardResponse> {
        const token = this.getStoredToken()
        const result = await this.authenticatedRequest<ItemCardResponse>('/items/ai/', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: { description: description.trim() } as unknown as BodyInit,
            ...this.aiRequestOptions(options),
        })
        this.assertAiCardSynchronousContract(result)
        return result
    }

    /**
     * Update an existing item/object
     */
    async updateItem(itemId: string, itemData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${itemId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: itemData
        })
    }

    /** Build the shared list query string; `q` searches name/alias/triggers server-side. */
    private listQuery(skip: number, limit: number, q?: string): string {
        const term = q?.trim()
        return `?skip=${skip}&limit=${limit}${term ? `&q=${encodeURIComponent(term)}` : ''}`
    }

    private lorebookEntryPayload(entry: Partial<LorebookEntry | LorebookEntryDraft> | Record<string, unknown>): Record<string, unknown> {
        if ('entry_type' in entry || 'secondary_keys' in entry) return entry as Record<string, unknown>
        const item = entry as Partial<LorebookEntry | LorebookEntryDraft>
        const id = 'id' in item && typeof item.id === 'string' && !item.id.startsWith('draft-entry-') ? item.id : undefined
        return {
            ...(id ? { id } : {}),
            title: item.title ?? '',
            entry_type: item.entryType ?? 'other',
            content: item.content ?? '',
            keys: item.keys ?? [],
            secondary_keys: item.secondaryKeys ?? [],
            selective_logic: item.selectiveLogic ?? 'any',
            enabled: item.enabled ?? true,
            constant: item.constant ?? false,
            case_sensitive: item.caseSensitive ?? false,
            match_whole_words: item.matchWholeWords ?? true,
            regex: item.regex ?? false,
            is_secret: item.isSecret ?? false,
            reveal_condition: item.revealCondition || null,
            insertion_order: item.insertionOrder ?? 0,
            priority: item.priority ?? 0,
            insertion_position: item.insertionPosition ?? 'before_context',
            token_budget: item.tokenBudget ?? null,
            metadata: item.metadata ?? {},
        }
    }

    private lorebookAttachmentPayload(attachment: Partial<LorebookAttachment> | Record<string, unknown>): Record<string, unknown> {
        if ('lorebook_id' in attachment || 'target_kind' in attachment) return attachment as Record<string, unknown>
        const item = attachment as Partial<LorebookAttachment>
        return {
            ...(item.id ? { id: item.id } : {}),
            lorebook_id: item.lorebookId,
            target_kind: item.targetKind ?? 'global',
            target_id: item.targetId || null,
            mode: item.mode ?? 'linked',
            snapshot: item.snapshot ?? null,
        }
    }

    private lorebookResourceMetadataHeaders(options: LorebookResourceMetadataSaveOptions = {}): Record<string, string> {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (options.extractMetadata || options.requestId || options.idempotencyKey) {
            const requestId = options.requestId || this.createClientId('mw-lorebook-resource-req')
            headers['X-Request-Id'] = requestId
            headers['Idempotency-Key'] = options.idempotencyKey || requestId
        }
        return headers
    }

    private extractMetadataQuery(shouldExtract?: boolean): string {
        return shouldExtract ? '?extractMetadata=true' : ''
    }

    private lorebookResourcePayload(resource: Partial<LorebookResource> | Record<string, unknown>): Record<string, unknown> {
        if ('fileName' in resource || 'file_name' in resource) {
            const item = resource as Partial<LorebookResource> & Record<string, unknown>
            return {
                ...(typeof item.id === 'string' ? { id: item.id } : {}),
                title: typeof item.title === 'string' ? item.title : '',
                description: typeof item.description === 'string' && item.description.trim() ? item.description : null,
                triggers: Array.isArray(item.triggers) ? item.triggers : [],
                fileName: typeof item.fileName === 'string' ? item.fileName : typeof item.file_name === 'string' ? item.file_name : 'resource.txt',
                fileType: item.fileType === 'md' || item.fileType === 'txt' ? item.fileType : item.file_type === 'md' || item.file_type === 'txt' ? item.file_type : 'txt',
                content: typeof item.content === 'string' ? item.content : '',
                contentLength: typeof item.contentLength === 'number'
                    ? item.contentLength
                    : typeof item.content_length === 'number'
                      ? item.content_length
                      : typeof item.content === 'string'
                        ? item.content.length
                        : 0,
            }
        }
        return resource as Record<string, unknown>
    }

    private sharedCardListQuery(
        skip: number,
        limit: number,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): string {
        const params = new URLSearchParams()
        params.set('skip', String(skip))
        params.set('limit', String(limit))
        if (q?.trim()) params.set('q', q.trim())
        if (cardType) params.set('card_type', cardType)
        if (role) params.set('role', role)
        return `?${params.toString()}`
    }

    async listPublicCards(
        skip: number = 0,
        limit: number = 100,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): Promise<SharedCardListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/public${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    async getPublicCard(cardType: CardShareType, cardId: string): Promise<SharedCardResource> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardResource>(
            `/cards/public/${cardType}/${encodeURIComponent(cardId)}`,
            token,
            { method: 'GET' },
        )
    }

    async listMyPublicCards(
        skip: number = 0,
        limit: number = 100,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): Promise<SharedCardListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/me/public${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    async listMyShareLinks(
        skip: number = 0,
        limit: number = 100,
        q?: string,
        cardType?: CardShareType,
        role?: 'character' | 'persona',
    ): Promise<SharedCardListResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<SharedCardListResponse>(
            `/cards/me/share-links${this.sharedCardListQuery(skip, limit, q, cardType, role)}`,
            token,
            { method: 'GET' },
        )
    }

    /**
     * Get characters list with pagination and optional search
     */
    async getCharacters(skip: number = 0, limit: number = 100, q?: string, role?: 'character' | 'persona'): Promise<any> {
        const token = this.getStoredToken()
        const query = this.listQuery(skip, limit, q)
        const roleQuery = role ? `${query}&role=${encodeURIComponent(role)}` : query
        return this.authenticatedRequest(`/characters/${roleQuery}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get worlds list with pagination and optional search
     */
    async getWorlds(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get items list with pagination and optional search
     */
    async getItems(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get adventure templates list with pagination and optional search
     */
    async getAdventureTemplates(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET'
        })
    }

    /**
     * List lorebooks with pagination and optional search.
     */
    async getLorebooks(skip: number = 0, limit: number = 100, q?: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET',
        })
    }

    async getLorebook(lorebookId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'GET',
        })
    }

    async createLorebook(lorebook: LorebookDraft | Record<string, unknown>, options: LorebookResourceMetadataSaveOptions = {}): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks${this.extractMetadataQuery(options.extractMetadata)}`, token, {
            method: 'POST',
            headers: this.lorebookResourceMetadataHeaders(options),
            body: lorebook as unknown as BodyInit,
        })
    }

    async updateLorebook(lorebookId: string, lorebook: Partial<LorebookDraft> | Record<string, unknown>, options: LorebookResourceMetadataSaveOptions = {}): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}${this.extractMetadataQuery(options.extractMetadata)}`, token, {
            method: 'PUT',
            headers: this.lorebookResourceMetadataHeaders(options),
            body: lorebook as unknown as BodyInit,
        })
    }

    async deleteLorebook(lorebookId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'DELETE',
        })
    }

    async getLorebookResources(skip: number = 0, limit: number = 100, q?: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET',
        })
    }

    async getLorebookResource(resourceId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'GET',
        })
    }

    async createLorebookResource(resource: LorebookResource | Record<string, unknown>, options: LorebookResourceMetadataSaveOptions = {}): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources${this.extractMetadataQuery(options.extractMetadata)}`, token, {
            method: 'POST',
            headers: this.lorebookResourceMetadataHeaders(options),
            body: this.lorebookResourcePayload(resource) as unknown as BodyInit,
        })
    }

    async updateLorebookResource(resourceId: string, resource: Partial<LorebookResource> | Record<string, unknown>, options: LorebookResourceMetadataSaveOptions = {}): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}${this.extractMetadataQuery(options.extractMetadata)}`, token, {
            method: 'PUT',
            headers: this.lorebookResourceMetadataHeaders(options),
            body: this.lorebookResourcePayload(resource) as unknown as BodyInit,
        })
    }

    async syncLorebookResourceMetadata(resourceId: string, options: LorebookResourceMetadataSaveOptions = {}): Promise<unknown> {
        const token = this.getStoredToken()
        const requestOptions = { ...options, extractMetadata: true }
        return this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}/metadata-sync`, token, {
            method: 'POST',
            headers: this.lorebookResourceMetadataHeaders(requestOptions),
            body: {} as unknown as BodyInit,
        })
    }

    async deleteLorebookResource(resourceId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebook-resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'DELETE',
        })
    }

    async getLorebookLinkedResources(lorebookId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/resources`, token, {
            method: 'GET',
        })
    }

    async attachLorebookResource(lorebookId: string, resourceId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'PUT',
        })
    }

    async detachLorebookResource(lorebookId: string, resourceId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/resources/${encodeURIComponent(resourceId)}`, token, {
            method: 'DELETE',
        })
    }

    async createLorebookEntry(lorebookId: string, entry: LorebookEntryDraft | Record<string, unknown>): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: this.lorebookEntryPayload(entry) as unknown as BodyInit,
        })
    }

    async updateLorebookEntry(lorebookId: string, entryId: string, entry: Partial<LorebookEntry> | Record<string, unknown>): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries/${encodeURIComponent(entryId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: this.lorebookEntryPayload(entry) as unknown as BodyInit,
        })
    }

    async deleteLorebookEntry(lorebookId: string, entryId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries/${encodeURIComponent(entryId)}`, token, {
            method: 'DELETE',
        })
    }

    async listLorebookAttachments(targetKind?: LorebookTargetKind, targetId?: string): Promise<LorebookAttachment[]> {
        const token = this.getStoredToken()
        const params = new URLSearchParams()
        if (targetKind) params.set('target_kind', targetKind)
        if (targetId) params.set('target_id', targetId)
        const suffix = params.toString() ? `?${params.toString()}` : ''
        return this.authenticatedRequest<LorebookAttachment[]>(`/lorebook-attachments${suffix}`, token, {
            method: 'GET',
        })
    }

    async putLorebookAttachment(attachment: Partial<LorebookAttachment> | Record<string, unknown>): Promise<LorebookAttachment> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<LorebookAttachment>('/lorebook-attachments', token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: this.lorebookAttachmentPayload(attachment) as unknown as BodyInit,
        })
    }

    async deleteLorebookAttachment(attachmentId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebook-attachments/${encodeURIComponent(attachmentId)}`, token, {
            method: 'DELETE',
        })
    }

    async validateLorebook(lorebook: Lorebook | LorebookDraft | Record<string, unknown>): Promise<{ issues: LorebookIssue[] }> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<{ issues: LorebookIssue[] }>('/lorebooks/validate', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: lorebook as unknown as BodyInit,
        })
    }

    async previewLoreActivation(request: LoreActivationPreviewRequest): Promise<LoreActivationPreviewResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<LoreActivationPreviewResponse>('/lorebooks/activation-preview', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: request as unknown as BodyInit,
        })
    }

    async getStories(skip: number = 0, limit: number = 100, q?: string): Promise<Story[]> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story[]>(`/stories${this.listQuery(skip, limit, q)}`, token, {
            method: 'GET',
        })
    }

    async getStory(storyId: string): Promise<Story> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>(`/stories/${encodeURIComponent(storyId)}`, token, {
            method: 'GET',
        })
    }

    async createStory(story: StoryCreateRequest | Record<string, unknown>): Promise<Story> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>('/stories', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: story as unknown as BodyInit,
        })
    }

    async updateStory(storyId: string, story: Partial<Story> | Record<string, unknown>): Promise<Story> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>(`/stories/${encodeURIComponent(storyId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: story as unknown as BodyInit,
        })
    }

    async deleteStory(storyId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}`, token, {
            method: 'DELETE',
        })
    }

    async createStoryChapter(storyId: string, chapter: Partial<StoryChapter> | Record<string, unknown>): Promise<StoryChapter> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryChapter>(`/stories/${encodeURIComponent(storyId)}/scenes`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: chapter as unknown as BodyInit,
        })
    }

    async updateStoryChapter(storyId: string, chapterId: string, chapter: Partial<StoryChapter> | Record<string, unknown>): Promise<StoryChapter> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryChapter>(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(chapterId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: chapter as unknown as BodyInit,
        })
    }

    async deleteStoryChapter(storyId: string, chapterId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/scenes/${encodeURIComponent(chapterId)}`, token, {
            method: 'DELETE',
        })
    }

    async addStoryCardRef(storyId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryCardRef>(`/stories/${encodeURIComponent(storyId)}/card-refs`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: ref as unknown as BodyInit,
        })
    }

    async updateStoryCardRef(storyId: string, refId: string, ref: Partial<StoryCardRef> | Record<string, unknown>): Promise<StoryCardRef> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryCardRef>(`/stories/${encodeURIComponent(storyId)}/card-refs/${encodeURIComponent(refId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: ref as unknown as BodyInit,
        })
    }

    async deleteStoryCardRef(storyId: string, refId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/card-refs/${encodeURIComponent(refId)}`, token, {
            method: 'DELETE',
        })
    }

    async previewStoryContext(storyId: string, request: StoryGenerateRequest): Promise<StoryContextTrace> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<StoryContextTrace>(`/stories/${encodeURIComponent(storyId)}/context-preview`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: request as unknown as BodyInit,
        })
    }

    async generateStory(storyId: string, request: StoryGenerateRequest): Promise<StoryGenerateResponse> {
        const token = this.getStoredToken()
        const requestId = request.requestId || this.createClientId('mw-story-generate')
        return this.authenticatedRequest<StoryGenerateResponse>(`/stories/${encodeURIComponent(storyId)}/generate`, token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-Id': requestId,
            },
            body: { ...request, requestId } as unknown as BodyInit,
        })
    }

    async acceptStoryGeneration(storyId: string, generationId: string): Promise<Story> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<Story>(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/accept`, token, {
            method: 'POST',
        })
    }

    async stashStoryGeneration(storyId: string, generationId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/stash`, token, {
            method: 'POST',
        })
    }

    async discardStoryGeneration(storyId: string, generationId: string): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/stories/${encodeURIComponent(storyId)}/generations/${encodeURIComponent(generationId)}/discard`, token, {
            method: 'POST',
        })
    }

    /**
     * Get adventure sessions list
     */
    async getAdventureSessions(): Promise<any> {
        const token = this.getStoredToken()
        try {
            return await this.authenticatedRequest('/adventure-sessions/', token, {
                method: 'GET'
            })
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                // Return empty array if user has no sessions or user not found yet
                return []
            }
            throw error
        }
    }

    /**
     * Create a new adventure template
     */
    async createAdventureTemplate(templateData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-templates/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: templateData
        })
    }

    /**
     * Generate + persist a new adventure template from a description via the AI
     * endpoint. The backend creates the card and returns it.
     */
    async createAdventureTemplateAI(description: string, options: AiCardRequestOptions = {}): Promise<AdventureTemplateCardResponse> {
        const token = this.getStoredToken()
        const result = await this.authenticatedRequest<AdventureTemplateCardResponse>('/adventure-templates/ai/', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: { description: description.trim() } as unknown as BodyInit,
            ...this.aiRequestOptions(options),
        })
        this.assertAiCardSynchronousContract(result)
        return result
    }

    async createCardAssistantConversation(
        body: {
            card_type: CardAssistantCardType
            card_id?: string | null
            title?: string | null
            current_card?: Record<string, unknown> | null
        },
        options: CardAssistantRequestOptions = {},
    ): Promise<CardAssistantConversationResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardAssistantConversationResponse>('/card-assistant/conversations', token, {
            method: 'POST',
            headers: this.cardAssistantHeaders(options),
            body: body as unknown as BodyInit,
            ...this.cardAssistantRequestOptions(options),
        })
    }

    async listCardAssistantConversations(
        cardType: CardAssistantCardType,
        cardId?: string | null,
        options: CardAssistantRequestOptions = {},
    ): Promise<CardAssistantConversationListResponse> {
        const token = this.getStoredToken()
        const params = new URLSearchParams({ card_type: cardType })
        if (cardId) params.set('card_id', cardId)
        return this.authenticatedRequest<CardAssistantConversationListResponse>(`/card-assistant/conversations?${params.toString()}`, token, {
            method: 'GET',
            headers: this.cardAssistantHeaders(options),
            ...this.cardAssistantRequestOptions(options),
        })
    }

    async getCardAssistantConversation(
        conversationId: number,
        options: CardAssistantRequestOptions = {},
    ): Promise<CardAssistantConversationResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<CardAssistantConversationResponse>(`/card-assistant/conversations/${conversationId}`, token, {
            method: 'GET',
            headers: this.cardAssistantHeaders(options),
            ...this.cardAssistantRequestOptions(options),
        })
    }

    /** Delete an assistant conversation and its messages. 409 while a turn is in flight. */
    async deleteCardAssistantConversation(
        conversationId: number,
        options: CardAssistantRequestOptions = {},
    ): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest<void>(`/card-assistant/conversations/${conversationId}`, token, {
            method: 'DELETE',
            headers: this.cardAssistantHeaders(options),
            ...this.cardAssistantRequestOptions(options),
        })
    }

    async sendCardAssistantMessage(
        conversationId: number,
        body: {
            message: string
            card_type?: CardAssistantCardType
            current_card?: Record<string, unknown> | null
            request_id?: string
        },
        options: CardAssistantRequestOptions = {},
    ): Promise<CardAssistantTurnResponse> {
        const token = this.getStoredToken()
        const requestId = options.requestId || body.request_id || this.createClientId('mw-card-assistant-turn')
        return this.authenticatedRequest<CardAssistantTurnResponse>(`/card-assistant/conversations/${conversationId}/messages`, token, {
            method: 'POST',
            headers: this.cardAssistantHeaders({ ...options, requestId }),
            body: { ...body, request_id: requestId } as unknown as BodyInit,
            ...this.cardAssistantRequestOptions(options),
        })
    }

    async streamCardAssistantMessage(
        conversationId: number,
        body: {
            message: string
            card_type?: CardAssistantCardType
            current_card?: Record<string, unknown> | null
            request_id?: string
        },
        onEvent: (event: CardAssistantStreamEvent) => void,
        options: CardAssistantRequestOptions = {},
    ): Promise<void> {
        const token = this.getStoredToken()
        const requestId = options.requestId || body.request_id || this.createClientId('mw-card-assistant-turn')
        const endpoint = `/card-assistant/conversations/${conversationId}/messages/stream`
        const url = `${this.baseUrl}${endpoint}`
        const payload = JSON.stringify({ ...body, request_id: requestId })

        let didTimeout = false
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined
        let signal = options.signal
        if (options.timeoutMs && options.timeoutMs > 0) {
            const controller = new AbortController()
            signal = controller.signal
            if (options.signal) {
                if (options.signal.aborted) {
                    controller.abort(options.signal.reason)
                } else {
                    options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true })
                }
            }
            timeoutHandle = setTimeout(() => {
                didTimeout = true
                controller.abort(new DOMException('Card assistant stream timed out locally', 'AbortError'))
            }, options.timeoutMs)
        }

        const config: RequestInit = {
            method: 'POST',
            headers: {
                ...this.cardAssistantHeaders({ ...options, requestId }),
                Accept: 'text/event-stream',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: payload,
            signal,
        }

        try {
            let response = await fetch(url, config)
            if (response.status === 401) {
                const nextToken = await this.refreshAccessToken(token)
                response = await fetch(url, this.withAuthorization(config, nextToken))
            }
            if (!response.ok) {
                const parsed = await this.extractError(response)
                throw new ApiError(response.status, parsed.message, parsed)
            }
            await this.readCardAssistantStream(response, onEvent)
        } catch (error) {
            if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
                throw new ApiError(0, 'Local wait timed out. The assistant may still finish and save the conversation.', {
                    category: 'timeout',
                    code: 'card_assistant_client_timeout',
                    retryable: true,
                    action: 'reload_conversation',
                })
            }
            if (!(error instanceof ApiError)) {
                console.warn(`Card assistant stream error for ${endpoint}:`, error)
            }
            throw error
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle)
        }
    }

    async createLorebookAssistantConversation(
        body: {
            lorebook_id?: string | null
            title?: string | null
            current_lorebook?: Record<string, unknown> | null
        },
        options: LorebookAssistantRequestOptions = {},
    ): Promise<LorebookAssistantConversationResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<LorebookAssistantConversationResponse>('/lorebook-assistant/conversations', token, {
            method: 'POST',
            headers: this.lorebookAssistantHeaders(options),
            body: body as unknown as BodyInit,
            ...this.lorebookAssistantRequestOptions(options),
        })
    }

    async listLorebookAssistantConversations(
        lorebookId?: string | null,
        options: LorebookAssistantRequestOptions = {},
    ): Promise<LorebookAssistantConversationListResponse> {
        const token = this.getStoredToken()
        const params = new URLSearchParams()
        if (lorebookId) params.set('lorebook_id', lorebookId)
        const suffix = params.toString() ? `?${params.toString()}` : ''
        return this.authenticatedRequest<LorebookAssistantConversationListResponse>(`/lorebook-assistant/conversations${suffix}`, token, {
            method: 'GET',
            headers: this.lorebookAssistantHeaders(options),
            ...this.lorebookAssistantRequestOptions(options),
        })
    }

    async getLorebookAssistantConversation(
        conversationId: number,
        options: LorebookAssistantRequestOptions = {},
    ): Promise<LorebookAssistantConversationResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<LorebookAssistantConversationResponse>(`/lorebook-assistant/conversations/${conversationId}`, token, {
            method: 'GET',
            headers: this.lorebookAssistantHeaders(options),
            ...this.lorebookAssistantRequestOptions(options),
        })
    }

    async deleteLorebookAssistantConversation(
        conversationId: number,
        options: LorebookAssistantRequestOptions = {},
    ): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest<void>(`/lorebook-assistant/conversations/${conversationId}`, token, {
            method: 'DELETE',
            headers: this.lorebookAssistantHeaders(options),
            ...this.lorebookAssistantRequestOptions(options),
        })
    }

    async sendLorebookAssistantMessage(
        conversationId: number,
        body: {
            message: string
            current_lorebook?: Record<string, unknown> | null
            request_id?: string
        },
        options: LorebookAssistantRequestOptions = {},
    ): Promise<LorebookAssistantTurnResponse> {
        const token = this.getStoredToken()
        const requestId = options.requestId || body.request_id || this.createClientId('mw-lorebook-assistant-turn')
        return this.authenticatedRequest<LorebookAssistantTurnResponse>(`/lorebook-assistant/conversations/${conversationId}/messages`, token, {
            method: 'POST',
            headers: this.lorebookAssistantHeaders({ ...options, requestId }),
            body: { ...body, request_id: requestId } as unknown as BodyInit,
            ...this.lorebookAssistantRequestOptions(options),
        })
    }

    async streamLorebookAssistantMessage(
        conversationId: number,
        body: {
            message: string
            current_lorebook?: Record<string, unknown> | null
            request_id?: string
        },
        onEvent: (event: LorebookAssistantStreamEvent) => void,
        options: LorebookAssistantRequestOptions = {},
    ): Promise<void> {
        const token = this.getStoredToken()
        const requestId = options.requestId || body.request_id || this.createClientId('mw-lorebook-assistant-turn')
        const endpoint = `/lorebook-assistant/conversations/${conversationId}/messages/stream`
        const url = `${this.baseUrl}${endpoint}`
        const payload = JSON.stringify({ ...body, request_id: requestId })

        let didTimeout = false
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined
        let signal = options.signal
        if (options.timeoutMs && options.timeoutMs > 0) {
            const controller = new AbortController()
            signal = controller.signal
            if (options.signal) {
                if (options.signal.aborted) {
                    controller.abort(options.signal.reason)
                } else {
                    options.signal.addEventListener('abort', () => controller.abort(options.signal?.reason), { once: true })
                }
            }
            timeoutHandle = setTimeout(() => {
                didTimeout = true
                controller.abort(new DOMException('Lorebook assistant stream timed out locally', 'AbortError'))
            }, options.timeoutMs)
        }

        const config: RequestInit = {
            method: 'POST',
            headers: {
                ...this.lorebookAssistantHeaders({ ...options, requestId }),
                Accept: 'text/event-stream',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: payload,
            signal,
        }

        try {
            let response = await fetch(url, config)
            if (response.status === 401) {
                const nextToken = await this.refreshAccessToken(token)
                response = await fetch(url, this.withAuthorization(config, nextToken))
            }
            if (!response.ok) {
                const parsed = await this.extractError(response)
                throw new ApiError(response.status, parsed.message, parsed)
            }
            await this.readLorebookAssistantStream(response, onEvent)
        } catch (error) {
            if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
                throw new ApiError(0, 'Local wait timed out. The assistant may still finish and save the conversation.', {
                    category: 'timeout',
                    code: 'lorebook_assistant_client_timeout',
                    retryable: true,
                    action: 'reload_conversation',
                })
            }
            if (!(error instanceof ApiError)) {
                console.warn(`Lorebook assistant stream error for ${endpoint}:`, error)
            }
            throw error
        } finally {
            if (timeoutHandle) clearTimeout(timeoutHandle)
        }
    }

    /**
     * Update an existing adventure template
     */
    async updateAdventureTemplate(templateId: string, templateData: any): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: templateData
        })
    }

    /**
     * Delete an adventure template
     */
    async deleteAdventureTemplate(templateId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific character by ID
     */
    async getCharacter(characterId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/${characterId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Delete a character
     */
    async deleteCharacter(characterId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/${characterId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific world by ID
     */
    async getWorld(worldId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${worldId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Delete a world
     */
    async deleteWorld(worldId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/${worldId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific item/object by ID
     */
    async getItem(itemId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${itemId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Delete an item/object
     */
    async deleteItem(itemId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/items/${itemId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Delete all of the current user's data (cards, adventures, generated media).
     * The account itself — username, role and credits — stays active.
     */
    async deleteAllUserData(): Promise<{ message: string; deleted: Record<string, number> }> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/user/data', token, {
            method: 'DELETE'
        })
    }

    /**
     * Get a specific adventure template by ID
     */
    async getAdventureTemplate(templateId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/${templateId}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get a specific adventure session by ID
     */
    async getAdventureSession(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'GET'
        })
    }

    async getAdventureSessionMessages(sessionId: number): Promise<AdventureSessionMessagesResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages`, token, {
            method: 'GET'
        })
    }

    async deleteAdventureSessionMessage(sessionId: number, messageId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages/${messageId}`, token, {
            method: 'DELETE'
        })
    }

    async clearAdventureSessionMessages(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/messages`, token, {
            method: 'DELETE'
        })
    }

    async getImageJob(jobId: string): Promise<ImageJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/images/jobs/${encodeURIComponent(jobId)}`, token, {
            method: 'GET'
        })
    }

    async getImageResult(jobId: string): Promise<ImageJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/images/jobs/${encodeURIComponent(jobId)}/result`, token, {
            method: 'GET'
        })
    }

    /* ------------------------------ voice call ------------------------------ */

    async saveVoiceConsent(sessionId: number, options: { signal?: AbortSignal } = {}): Promise<VoiceConsentResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceConsentResponse>(`/character-chats/${sessionId}/voice-consent`, token, {
            method: 'POST',
            body: {} as unknown as BodyInit,
            signal: options.signal,
        })
    }

    async uploadVoiceSegment(
        sessionId: number,
        body: VoiceSegmentUploadRequest,
        options: { signal?: AbortSignal } = {},
    ): Promise<VoiceSegmentUploadResponse> {
        const token = this.getStoredToken()
        const form = new FormData()
        form.append('voice_session_id', body.voice_session_id)
        form.append('client_call_id', body.client_call_id)
        form.append('seq', String(body.seq))
        form.append('started_at_ms', String(body.started_at_ms))
        form.append('duration_ms', String(body.duration_ms))
        form.append('encoding', body.encoding)
        form.append('sample_rate', String(body.sample_rate))
        form.append('channels', String(body.channels))
        form.append('audio_sha256', body.audio_sha256)
        form.append('vad_json', JSON.stringify(body.vad))
        form.append('audio', body.audio, `voice-segment-${body.seq}`)
        const idempotencyKey = `voice:${body.voice_session_id}:${body.seq}:${body.audio_sha256}`

        return this.authenticatedRequest<VoiceSegmentUploadResponse>(`/character-chats/${sessionId}/voice-segments`, token, {
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey },
            body: form as unknown as BodyInit,
            signal: options.signal,
        })
    }

    async endVoiceCall(
        sessionId: number,
        body: { voiceSessionId?: string | null; reason?: 'user' | 'navigation' | 'permission_lost' | string } = {},
        options: { signal?: AbortSignal } = {},
    ): Promise<VoiceEndResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceEndResponse>(`/character-chats/${sessionId}/voice-end`, token, {
            method: 'POST',
            body: {
                voice_session_id: body.voiceSessionId ?? null,
                reason: body.reason ?? 'user',
            } as unknown as BodyInit,
            signal: options.signal,
        })
    }

    /* ------------------------------ chat tts ------------------------------ */

    async getTtsJob(jobId: string): Promise<TtsJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tts/jobs/${encodeURIComponent(jobId)}`, token, {
            method: 'GET'
        })
    }

    /**
     * Fetch an owned narration audio asset (`/tts/assets/{asset_id}.mp3`) as a
     * Blob. The download route is ownership-checked, and `<audio>`/`Audio()`
     * requests can't carry an Authorization header — so callers fetch through
     * here and play from an object URL instead.
     */
    async fetchTtsAudioBlob(url: string): Promise<Blob> {
        return this.fetchProtectedMediaBlob(url, 'audio/mpeg')
    }

    async fetchProtectedMediaBlob(url: string, accept: string = '*/*'): Promise<Blob> {
        const protectedPath = getProtectedMediaPath(url)
        const requestUrl = protectedPath
            ? `${this.baseUrl}${protectedPath}`
            : /^https?:/i.test(url)
              ? url
              : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
        // Only attach the bearer token when the request targets our own API origin.
        // An absolute, foreign URL (e.g. a community card or a future external CDN)
        // must never receive the access token.
        const isSameOrigin = (() => {
            try {
                return new URL(requestUrl, window.location.href).origin === new URL(this.baseUrl, window.location.href).origin
            } catch {
                return false
            }
        })()
        const fetchOnce = (token: string) => fetch(requestUrl, {
            method: 'GET',
            headers: {
                Accept: accept,
                ...(token && isSameOrigin ? { 'Authorization': `Bearer ${token}` } : {}),
            },
        })
        let response = await fetchOnce(this.getStoredToken())
        if (isSameOrigin && response.status === 401) {
            const nextToken = await this.refreshAccessToken(this.getStoredToken())
            response = await fetchOnce(nextToken)
        }
        if (!response.ok) {
            throw new ApiError(response.status, 'Protected media could not be loaded.', {
                category: 'protected_media',
                retryable: response.status >= 500,
            })
        }
        return response.blob()
    }

    /** Poll a chat TTS job until it reaches a terminal status (or the deadline). */
    async waitForTts(
        jobId: string,
        opts: { signal?: AbortSignal; onUpdate?: (job: TtsJobPublicResponse) => void; intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<TtsJobPublicResponse> {
        return this.pollUntilTerminal(
            () => this.getTtsJob(jobId),
            ['pending', 'in_progress', 'synthesizing', 'mirroring'],
            opts,
            { intervalMs: 2_000, maxWaitMs: 120_000 },
        )
    }

    /* ---------------------------- card media ---------------------------- */

    /** Resolve after `ms`, or reject early if `signal` aborts. */
    private delay(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(new DOMException('Aborted', 'AbortError'))
                return
            }
            const timer = setTimeout(() => {
                cleanup()
                resolve()
            }, ms)
            const onAbort = () => {
                cleanup()
                reject(new DOMException('Aborted', 'AbortError'))
            }
            const cleanup = () => {
                clearTimeout(timer)
                signal?.removeEventListener('abort', onAbort)
            }
            signal?.addEventListener('abort', onAbort, { once: true })
        })
    }

    /**
     * Poll `fetchJob` until its `status` leaves `nonTerminalStatuses` or the
     * deadline passes, returning the last job either way. Shared by the TTS,
     * image, and theme-song waiters (each supplies its own statuses + cadence).
     */
    private async pollUntilTerminal<T extends { status: string }>(
        fetchJob: () => Promise<T>,
        nonTerminalStatuses: Iterable<string>,
        opts: { signal?: AbortSignal; onUpdate?: (job: T) => void; intervalMs?: number; maxWaitMs?: number },
        defaults: { intervalMs: number; maxWaitMs: number },
    ): Promise<T> {
        const nonTerminal = new Set<string>(nonTerminalStatuses)
        const interval = opts.intervalMs ?? defaults.intervalMs
        const deadline = Date.now() + (opts.maxWaitMs ?? defaults.maxWaitMs)
        for (;;) {
            const job = await fetchJob()
            opts.onUpdate?.(job)
            if (!nonTerminal.has(job.status)) return job
            if (Date.now() >= deadline) return job
            await this.delay(interval, opts.signal)
        }
    }

    /**
     * Generate a profile portrait from a card's own information. The client sends
     * only the card template (+ optional art direction); the backend builds the
     * private prompt. Returns the job (200 = already done, 202 = poll it).
     */
    async generateCardPortrait(body: CardPortraitRequest, options: AiCardRequestOptions = {}): Promise<ImageJobPublicResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<ImageJobPublicResponse>('/images/card-portrait', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: body as unknown as BodyInit,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        })
    }

    /**
     * Upload a user-supplied custom card image. Returns the stored asset's URL,
     * which is set onto the card's `image_url` and persisted on save — mirroring
     * the generate flow. Stateless (no card id), so it works for unsaved cards too.
     */
    async uploadCardImage(file: File, options: { signal?: AbortSignal } = {}): Promise<ImageUploadResponse> {
        const token = this.getStoredToken()
        const form = new FormData()
        form.append('file', file)
        // No Content-Type header — request() lets the browser set the multipart boundary.
        return this.authenticatedRequest<ImageUploadResponse>('/images/upload', token, {
            method: 'POST',
            body: form as unknown as BodyInit,
            signal: options.signal,
        })
    }

    /** Poll an image job until it reaches a terminal status (or the deadline). */
    async waitForImageJob(
        jobId: string,
        opts: { signal?: AbortSignal; onUpdate?: (job: ImageJobPublicResponse) => void; intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<ImageJobPublicResponse> {
        return this.pollUntilTerminal(
            () => this.getImageJob(jobId),
            ['pending', 'in_progress', 'mirroring'],
            opts,
            { intervalMs: 2_500, maxWaitMs: 180_000 },
        )
    }

    /**
     * List the caller's own generated image jobs (newest first) — the user gallery.
     * Image jobs are owned per user (not attached to a card), so this is a user-wide
     * gallery the card editor picks a default image from. Defaults to completed jobs
     * (the only ones with renderable assets). Offset-based pagination.
     */
    async listImageJobs(
        opts: {
            status?: 'completed' | 'failed' | 'canceled' | 'pending' | 'in_progress' | 'mirroring'
            limit?: number
            offset?: number
            /** Narrow to jobs tagged with a card at creation (legacy jobs are untagged). */
            cardType?: CardMediaTargetType
            cardId?: string
        } = {},
    ): Promise<ImageJobListResponse> {
        const token = this.getStoredToken()
        const status = opts.status ?? 'completed'
        const limit = opts.limit ?? 24
        const offset = opts.offset ?? 0
        let query = `status=${encodeURIComponent(status)}&limit=${limit}&offset=${offset}`
        if (opts.cardType) query += `&card_type=${encodeURIComponent(opts.cardType)}`
        if (opts.cardId) query += `&card_id=${encodeURIComponent(opts.cardId)}`
        return this.authenticatedRequest(`/images/jobs?${query}`, token, { method: 'GET' })
    }

    /** Soft-delete a generated image asset (removes it from the gallery). */
    async deleteImageAsset(assetId: string, options: { signal?: AbortSignal } = {}): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/images/assets/${encodeURIComponent(assetId)}`, token, {
            method: 'DELETE',
            signal: options.signal,
        })
    }

    /**
     * Create a card theme song. Requires an owned, persisted card (`target_id`);
     * the backend derives the private prompt from the card + the `description`
     * direction. Returns the job (200 = done, 202 = poll it).
     */
    async generateThemeSong(body: ThemeSongCreateRequest, options: AiCardRequestOptions = {}): Promise<ThemeSongJobPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<ThemeSongJobPublic>('/theme-songs', token, {
            method: 'POST',
            headers: this.aiHeaders(options),
            body: body as unknown as BodyInit,
            signal: options.signal,
            timeoutMs: options.timeoutMs,
        })
    }

    async getThemeSongJob(jobId: string): Promise<ThemeSongJobPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/theme-songs/jobs/${encodeURIComponent(jobId)}`, token, { method: 'GET' })
    }

    async getThemeSongResult(jobId: string): Promise<ThemeSongJobPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/theme-songs/jobs/${encodeURIComponent(jobId)}/result`, token, { method: 'GET' })
    }

    /** List the theme songs attached to a given card (most recent first). */
    async listThemeSongs(targetType: CardMediaTargetType, targetId: string, limit = 20, offset = 0): Promise<ThemeSongListResponse> {
        const token = this.getStoredToken()
        const query = `target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}&limit=${limit}&offset=${offset}`
        return this.authenticatedRequest(`/theme-songs?${query}`, token, { method: 'GET' })
    }

    /**
     * List the user's theme songs across all cards (most recent first) — the media
     * gallery. Each item carries its own `target` ref; optional filters narrow to a
     * card type or a single card.
     */
    async listUserThemeSongs(
        opts: {
            targetType?: CardMediaTargetType
            targetId?: string
            status?: ThemeSongJobStatus
            limit?: number
            offset?: number
        } = {},
    ): Promise<UserThemeSongListResponse> {
        const token = this.getStoredToken()
        const limit = opts.limit ?? 20
        const offset = opts.offset ?? 0
        let query = `limit=${limit}&offset=${offset}`
        if (opts.targetType) query += `&target_type=${encodeURIComponent(opts.targetType)}`
        if (opts.targetId) query += `&target_id=${encodeURIComponent(opts.targetId)}`
        if (opts.status) query += `&status=${encodeURIComponent(opts.status)}`
        return this.authenticatedRequest(`/theme-songs/user?${query}`, token, { method: 'GET' })
    }

    /** Soft-delete a theme-song audio asset (removes it from the card's history). */
    async deleteThemeSongAsset(assetId: string, options: { signal?: AbortSignal } = {}): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/theme-songs/assets/${encodeURIComponent(assetId)}`, token, {
            method: 'DELETE',
            signal: options.signal,
        })
    }

    /** Poll a theme-song job until it reaches a terminal status (or the deadline). */
    async waitForThemeSong(
        jobId: string,
        opts: { signal?: AbortSignal; onUpdate?: (job: ThemeSongJobPublic) => void; intervalMs?: number; maxWaitMs?: number } = {},
    ): Promise<ThemeSongJobPublic> {
        return this.pollUntilTerminal(
            () => this.getThemeSongJob(jobId),
            THEME_SONG_NON_TERMINAL_STATUSES,
            opts,
            { intervalMs: 3_000, maxWaitMs: 240_000 },
        )
    }

    async listTasks(
        opts: {
            state?: BackgroundTaskState
            operation?: BackgroundTaskOperation
            statuses?: ThemeSongJobStatus[]
            limit?: number
            offset?: number
        } = {},
    ): Promise<BackgroundTaskListResponse> {
        const token = this.getStoredToken()
        const state = opts.state ?? 'active'
        const operation = opts.operation ?? 'theme_song'
        const limit = opts.limit ?? 20
        const offset = opts.offset ?? 0
        const params = new URLSearchParams({
            state,
            operation,
            limit: String(limit),
            offset: String(offset),
        })
        for (const status of opts.statuses ?? []) {
            params.append('status', status)
        }
        const query = params.toString()
        return this.authenticatedRequest(`/tasks?${query}`, token, { method: 'GET' })
    }

    async getTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}`, token, { method: 'GET' })
    }

    async cancelTask(operation: BackgroundTaskOperation, taskId: string): Promise<BackgroundTaskPublic> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/tasks/${encodeURIComponent(operation)}/${encodeURIComponent(taskId)}`, token, { method: 'DELETE' })
    }

    /**
     * Create a new adventure session
     */
    async createAdventureSession(adventureTemplate: string, personaId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-sessions/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: { adventure_template: adventureTemplate, persona_id: personaId } as unknown as BodyInit
        })
    }

    /**
     * Update an adventure session's game state
     */
    async updateAdventureSession(sessionId: number, adventureLastTurn: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: { adventure_last_turn: adventureLastTurn } as unknown as BodyInit
        })
    }

    /**
     * Persist edits to an adventure's cloned cards (persona/cast/world/scenario).
     * Writes only to this session's own snapshot — the original template and
     * library cards are never touched. The chat AI reads its context from here.
     */
    async updateAdventureSnapshot(sessionId: number, snapshot: AdventureSnapshot): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}/template-snapshot`, token, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: { template_snapshot: snapshot } as unknown as BodyInit
        })
    }

    /**
     * Delete an adventure session
     */
    async deleteAdventureSession(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Start a fresh 1:1 character chat and seed the character's greeting as the first turn.
     */
    async createCharacterChat(characterId: string, personaId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/character-chats/', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { character_id: characterId, persona_id: personaId } as unknown as BodyInit
        })
    }

    /**
     * Start a new group character chat with 2-6 AI character cards.
     * Unlike 1:1 chat, this intentionally creates a fresh room every time.
     */
    async createCharacterGroupChat(characterIds: string[], personaId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/character-chats/groups', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { character_ids: characterIds, persona_id: personaId } as unknown as BodyInit
        })
    }

    /** List the user's 1:1 character chats (most recent state per chat). */
    async getCharacterChats(): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/character-chats/', token, {
            method: 'GET'
        })
    }

    /** Fetch a character chat (with its projected `last_turn`). */
    async getCharacterChat(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}`, token, {
            method: 'GET'
        })
    }

    async getCharacterChatCodexCards(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards`, token, {
            method: 'GET',
        })
    }

    /** Recent voice calls across all of the user's character chats (call-history feed). */
    async getRecentVoiceCalls(params: { skip?: number; limit?: number } = {}): Promise<VoiceCallListResponse> {
        const token = this.getStoredToken()
        const query = this.listQuery(params.skip ?? 0, params.limit ?? 20)
        return this.authenticatedRequest<VoiceCallListResponse>(`/voice-calls${query}`, token, { method: 'GET' })
    }

    /** Voice calls that belong to one character chat, newest first. */
    async getCharacterChatCalls(chatId: number, params: { skip?: number; limit?: number } = {}): Promise<VoiceCallListResponse> {
        const token = this.getStoredToken()
        const query = this.listQuery(params.skip ?? 0, params.limit ?? 20)
        return this.authenticatedRequest<VoiceCallListResponse>(`/character-chats/${chatId}/calls${query}`, token, { method: 'GET' })
    }

    /** Ordered transcript for one call (user STT lines + character lines with saved audio). */
    async getVoiceCallTranscript(voiceSessionId: string): Promise<VoiceCallTranscriptResponse> {
        const token = this.getStoredToken()
        return this.authenticatedRequest<VoiceCallTranscriptResponse>(
            `/voice-calls/${encodeURIComponent(voiceSessionId)}/transcript`,
            token,
            { method: 'GET' },
        )
    }

    async deleteCharacterChatMessage(chatId: number, messageId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/messages/${messageId}`, token, {
            method: 'DELETE'
        })
    }

    async clearCharacterChatMessages(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/messages`, token, {
            method: 'DELETE'
        })
    }

    /**
     * Persist the client's turn mirror for a character chat. Belt-and-suspenders:
     * the server already records every turn, so this only refreshes the legacy cache.
     */
    async updateCharacterChat(chatId: number, lastTurn: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: { last_turn: lastTurn } as unknown as BodyInit
        })
    }

    async addCharacterChatCodexCards(chatId: number, cards: Array<{ kind: string; cardId: string }>): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { cards: cards.map((card) => ({ kind: card.kind, card_id: card.cardId })) } as unknown as BodyInit,
        })
    }

    async updateCharacterChatCodexCard(chatId: number, codexCardId: string, enabled: boolean): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards/${encodeURIComponent(codexCardId)}`, token, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: { enabled } as unknown as BodyInit,
        })
    }

    async deleteCharacterChatCodexCard(chatId: number, codexCardId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}/codex-cards/${encodeURIComponent(codexCardId)}`, token, {
            method: 'DELETE',
        })
    }

    /** Delete a character chat. */
    async deleteCharacterChat(chatId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/character-chats/${chatId}`, token, {
            method: 'DELETE'
        })
    }
}

export const apiService = new ApiService()
configureChatSocketAuthRefresh(() => apiService.refreshAccessToken())
configureVoiceSocketAuthRefresh(() => apiService.refreshAccessToken())

export const refreshAccessToken = (oldToken?: string): Promise<string> => apiService.refreshAccessToken(oldToken)
export type { ApiService }

export { isProtectedMediaUrl, isPublicMediaUrl, resolveMediaUrl } from './mediaUrl'
export { ChatSocket, AdventureChatSocket, configureChatSocketAuthRefresh } from './chatSocket'
export type { ChatSocketStatus, ChatSocketHandlers } from './chatSocket'
export { VoiceSocket, configureVoiceSocketAuthRefresh } from './voiceSocket'
export type { VoiceSocketStatus, VoiceSocketHandlers } from './voiceSocket'
