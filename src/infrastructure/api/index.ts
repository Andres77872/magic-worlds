/**
 * API infrastructure - centralized API request handling
 */

import type {
    BrowserAuthResponse,
    LoginCredentials,
    LoginResponse,
    RegisterData,
    RegisterResponse,
    UserProfile,
} from '../../shared/types/auth.types'
import { API_BASE_URL } from './baseUrl'
import { configureChatSocketAuthRefresh } from './chatSocket'
import type { ChatImageAsset, ChatImageError, ChatTtsAsset, ChatTtsError, ImageLifecycleStatus, TtsLifecycleStatus } from '../../shared/types/interaction.types'
import type { AdventureSnapshot } from '../../shared/types/adventure.types'
import type {
    LoreActivationPreviewRequest,
    LoreActivationPreviewResponse,
    Lorebook,
    LorebookAttachment,
    LorebookDraft,
    LorebookEntry,
    LorebookEntryDraft,
    LorebookIssue,
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
    WorldCardResponse,
} from '../../shared/types/aiCard.types'
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

    constructor(status: number, message: string, metadata: Partial<Pick<ApiError, 'category' | 'code' | 'requestId' | 'retryable' | 'retryAfterSeconds' | 'action'>> = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.category = metadata.category
        this.code = metadata.code
        this.requestId = metadata.requestId
        this.retryable = metadata.retryable
        this.retryAfterSeconds = metadata.retryAfterSeconds
        this.action = metadata.action
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
}

type ApiRequestOptions = RequestInit & {
    timeoutMs?: number
    rejectAccepted?: boolean
}

type HeaderRecord = Record<string, string>

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
                const message =
                    typeof envelope.detail === 'string'
                        ? envelope.detail
                        : publicError?.message
                          ? String(publicError.message)
                          : typeof (body as { message?: unknown }).message === 'string'
                            ? String((body as { message: string }).message)
                            : undefined
                if (message) {
                    return {
                        message,
                        category: publicError?.category,
                        code: publicError?.code,
                        requestId: publicError?.request_id || envelope.request_id || requestIdHeader,
                        retryable: publicError?.retryable,
                        retryAfterSeconds: publicError?.retry_after_seconds ?? (Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined),
                        action: publicError?.action,
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
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `${prefix}-${crypto.randomUUID()}`
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
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

    private parseCardAssistantStreamFrame(frame: string): CardAssistantStreamEvent | null {
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
        return { ...data, type: eventType } as CardAssistantStreamEvent
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
            const event = this.parseCardAssistantStreamFrame(frame)
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

    /** Build the shared list query string; `q` searches name/alias/triggers server-side. */
    private listQuery(skip: number, limit: number, q?: string): string {
        const term = q?.trim()
        return `?skip=${skip}&limit=${limit}${term ? `&q=${encodeURIComponent(term)}` : ''}`
    }

    /**
     * Get characters list with pagination and optional search
     */
    async getCharacters(skip: number = 0, limit: number = 100, q?: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/${this.listQuery(skip, limit, q)}`, token, {
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

    async createLorebook(lorebook: LorebookDraft | Record<string, unknown>): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/lorebooks', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: lorebook as unknown as BodyInit,
        })
    }

    async updateLorebook(lorebookId: string, lorebook: Partial<LorebookDraft> | Record<string, unknown>): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: lorebook as unknown as BodyInit,
        })
    }

    async deleteLorebook(lorebookId: string): Promise<void> {
        const token = this.getStoredToken()
        await this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}`, token, {
            method: 'DELETE',
        })
    }

    async createLorebookEntry(lorebookId: string, entry: LorebookEntryDraft | Record<string, unknown>): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries`, token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: entry as unknown as BodyInit,
        })
    }

    async updateLorebookEntry(lorebookId: string, entryId: string, entry: Partial<LorebookEntry> | Record<string, unknown>): Promise<unknown> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/lorebooks/${encodeURIComponent(lorebookId)}/entries/${encodeURIComponent(entryId)}`, token, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: entry as unknown as BodyInit,
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
            body: attachment as unknown as BodyInit,
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
        const requestUrl = /^https?:/i.test(url) ? url : `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`
        const fetchOnce = (token: string) => fetch(requestUrl, {
            method: 'GET',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        })
        let response = await fetchOnce(this.getStoredToken())
        if (response.status === 401) {
            const nextToken = await this.refreshAccessToken(this.getStoredToken())
            response = await fetchOnce(nextToken)
        }
        if (!response.ok) {
            throw new ApiError(response.status, 'Narration audio could not be loaded.', {
                category: 'tts_audio',
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
        const nonTerminal = new Set(['pending', 'in_progress', 'synthesizing', 'mirroring'])
        const interval = opts.intervalMs ?? 2_000
        const deadline = Date.now() + (opts.maxWaitMs ?? 120_000)
        for (;;) {
            const job = await this.getTtsJob(jobId)
            opts.onUpdate?.(job)
            if (!nonTerminal.has(job.status)) return job
            if (Date.now() >= deadline) return job
            await this.delay(interval, opts.signal)
        }
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
        const nonTerminal = new Set(['pending', 'in_progress', 'mirroring'])
        const interval = opts.intervalMs ?? 2_500
        const deadline = Date.now() + (opts.maxWaitMs ?? 180_000)
        for (;;) {
            const job = await this.getImageJob(jobId)
            opts.onUpdate?.(job)
            if (!nonTerminal.has(job.status)) return job
            if (Date.now() >= deadline) return job
            await this.delay(interval, opts.signal)
        }
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
        const nonTerminal = new Set<string>(THEME_SONG_NON_TERMINAL_STATUSES)
        const interval = opts.intervalMs ?? 3_000
        const deadline = Date.now() + (opts.maxWaitMs ?? 240_000)
        for (;;) {
            const job = await this.getThemeSongJob(jobId)
            opts.onUpdate?.(job)
            if (!nonTerminal.has(job.status)) return job
            if (Date.now() >= deadline) return job
            await this.delay(interval, opts.signal)
        }
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
    async createAdventureSession(adventureTemplate: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-sessions/', token, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: { adventure_template: adventureTemplate } as unknown as BodyInit
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
     * Start (or resume) a 1:1 character chat. The backend is idempotent per
     * (user, character): it returns the existing chat if one exists, otherwise
     * creates one and seeds the character's greeting as the first turn.
     */
    async createCharacterChat(characterId: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/character-chats/', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { character_id: characterId } as unknown as BodyInit
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

/**
 * Resolve a media asset URL for use in `<img>` / `<audio>`. The backend returns
 * generated assets as root-relative paths (`/generated-images/...`,
 * `/generated-audio/...`) unless a public CDN base is configured; prefix those
 * with the API base. Absolute/data/blob URLs pass through unchanged.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
    if (!url) return undefined
    if (/^(https?:|data:|blob:)/i.test(url)) return url
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

export const refreshAccessToken = (oldToken?: string): Promise<string> => apiService.refreshAccessToken(oldToken)
export type { ApiService }

export { ChatSocket, AdventureChatSocket, configureChatSocketAuthRefresh } from './chatSocket'
export type { ChatSocketStatus, ChatSocketHandlers } from './chatSocket'
