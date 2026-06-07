/**
 * API infrastructure - centralized API request handling
 */

import type {
    LoginCredentials,
    LoginResponse,
    RegisterData,
    RegisterResponse,
    UserProfile,
} from '../../shared/types/auth.types'

// Get API base URL from environment, fallback to the backend's default port
// (magic-worlds-api binds to APP_PORT, default 8000).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/**
 * Error thrown for non-2xx HTTP responses, carrying the status code so callers
 * can distinguish a transient backend outage (5xx — e.g. the auth service is
 * briefly down and the API returns 503) from a real client-side error. Transient
 * failures should be handled gently (retry, empty state) rather than surfaced as
 * alarming error UI.
 */
export class ApiError extends Error {
    readonly status: number

    constructor(status: number, message: string) {
        super(message)
        this.name = 'ApiError'
        this.status = status
    }

    /** A transient server-side failure (502/503/504, or any 5xx) worth retrying. */
    get isTransient(): boolean {
        return this.status >= 500
    }
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
        options: RequestInit = {},
        parseAsJson: boolean = true,
        isAuthEndpoint: boolean = false
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`
        
        // Handle JSON serialization if body is an object
        let body = options.body
        if (body && typeof body === 'object' && !(body instanceof FormData)) {
            body = JSON.stringify(body)
        }
        
        const config: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            },
            ...options,
            body
        }

        try {
            const response = await fetch(url, config)

            // Session-expiry handling applies ONLY to already-authenticated
            // requests — never to login/register, whose 401/400/422 responses
            // must surface to the user as the real error message.
            if (response.status === 401 && !isAuthEndpoint) {
                localStorage.removeItem('magic_worlds:token')
                localStorage.removeItem('magic_worlds:user')
                window.dispatchEvent(new CustomEvent('auth:expired'))
                // Safe reads degrade gracefully to an empty response. Mutations
                // (POST/PUT/DELETE) must NOT silently resolve — otherwise a
                // create/update during an expired session looks successful while
                // nothing was persisted. Throw so the caller surfaces the error.
                const method = (config.method ?? 'GET').toString().toUpperCase()
                if (method === 'GET') {
                    return (parseAsJson ? {} : '') as T
                }
                throw new Error('Your session has expired. Please log in again.')
            }

            if (!response.ok) {
                const message = await this.extractErrorMessage(response)
                // 5xx is a transient backend outage (e.g. the auth service is
                // briefly down → 503) — log quietly. Other statuses are real
                // errors worth an error-level log.
                const log = response.status >= 500 ? console.warn : console.error
                log('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    message
                })
                throw new ApiError(response.status, message)
            }

            if (parseAsJson) {
                return await response.json()
            } else {
                return await response.text() as T
            }
        } catch (error) {
            // ApiError was already logged above with the right level; only log
            // genuine network/unexpected failures here (and keep it gentle).
            if (!(error instanceof ApiError)) {
                console.warn(`API request error for ${endpoint}:`, error)
            }
            throw error
        }
    }

    /**
     * Extract a human-readable error message from a failed response.
     * Mirrors the API's error shapes: FastAPI `{detail}`, the provider
     * `{error: {message}}` envelope, or a plain `{message}` — falling back to
     * raw text, then the status code.
     */
    private async extractErrorMessage(response: Response): Promise<string> {
        try {
            const body = await response.clone().json()
            if (body && typeof body === 'object') {
                if (typeof body.detail === 'string') return body.detail
                if (body.error?.message) return String(body.error.message)
                if (typeof body.message === 'string') return body.message
            }
        } catch {
            // Body is not JSON — fall through to text.
        }
        try {
            const text = (await response.text()).trim()
            if (text) return text.slice(0, 300)
        } catch {
            // Body already consumed or unreadable.
        }
        return `Request failed (${response.status})`
    }

    /**
     * Make authenticated requests with token
     */
    async authenticatedRequest<T>(
        endpoint: string,
        token: string,
        options: RequestInit = {}
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
            body: credentials as unknown as BodyInit
        }, true, true)
    }

    /**
     * Register via the API proxy
     */
    async register(data: RegisterData): Promise<RegisterResponse> {
        return this.request<RegisterResponse>('/auth/register', {
            method: 'POST',
            body: data as unknown as BodyInit
        }, true, true)
    }

    /**
     * Get the stored token from localStorage
     */
    private getStoredToken(): string {
        const token = localStorage.getItem('magic_worlds:token')
        if (!token) {
            return ''
        }
        return token.replace(/"/g, '') // Remove quotes from token
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
    async createCharacterAI(description: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/characters/ai/', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { description } as unknown as BodyInit
        })
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
    async createWorldAI(description: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/worlds/ai/', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { description } as unknown as BodyInit
        })
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
     * Get characters list with pagination
     */
    async getCharacters(skip: number = 0, limit: number = 100): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/characters/?skip=${skip}&limit=${limit}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get worlds list with pagination
     */
    async getWorlds(skip: number = 0, limit: number = 100): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/worlds/?skip=${skip}&limit=${limit}`, token, {
            method: 'GET'
        })
    }

    /**
     * Get adventure templates list with pagination
     */
    async getAdventureTemplates(skip: number = 0, limit: number = 100): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-templates/?skip=${skip}&limit=${limit}`, token, {
            method: 'GET'
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
    async createAdventureTemplateAI(description: string): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest('/adventure-templates/ai/', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { description } as unknown as BodyInit
        })
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
     * Delete an adventure session
     */
    async deleteAdventureSession(sessionId: number): Promise<any> {
        const token = this.getStoredToken()
        return this.authenticatedRequest(`/adventure-sessions/${sessionId}`, token, {
            method: 'DELETE'
        })
    }
}

export const apiService = new ApiService()
export type { ApiService }

export { AdventureChatSocket } from './chatSocket'
export type { ChatSocketStatus, ChatSocketHandlers } from './chatSocket'
