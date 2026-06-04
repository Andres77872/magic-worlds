/**
 * API infrastructure - centralized API request handling
 */

// User data types
export interface UserData {
    user_usage: number
    card_counts: {
        character: number
        adventure_template: number
        world: number
    }
}

import type {
    LoginCredentials,
    LoginResponse,
    RegisterData,
    RegisterResponse,
    ChatMessage,
} from '../../shared/types/auth.types'

// Get API base URL from environment, fallback to default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8010'

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
        parseAsJson: boolean = true
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

            // Centralized 401 handling
            if (response.status === 401) {
                localStorage.removeItem('magic_worlds:token')
                localStorage.removeItem('magic_worlds:user')
                window.dispatchEvent(new CustomEvent('auth:expired'))
                // Return empty typed response for data-fetching methods
                if (parseAsJson) {
                    return {} as T
                }
                return '' as T
            }

            if (!response.ok) {
                const errorText = await response.text()
                console.error('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                })
                throw new Error(`API request failed: ${response.status} ${response.statusText}`)
            }

            if (parseAsJson) {
                return await response.json()
            } else {
                return await response.text() as T
            }
        } catch (error) {
            console.error(`API request error for ${endpoint}:`, error)
            throw error
        }
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
     * Get user data from /user/me endpoint
     */
    async getUserData(token: string): Promise<UserData> {
        return this.authenticatedRequest<UserData>('/user/me', token, {
            method: 'GET'
        })
    }

    /**
     * Login via the API proxy
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        return this.request<LoginResponse>('/auth/login', {
            method: 'POST',
            body: credentials as unknown as BodyInit
        })
    }

    /**
     * Register via the API proxy
     */
    async register(data: RegisterData): Promise<RegisterResponse> {
        return this.request<RegisterResponse>('/auth/register', {
            method: 'POST',
            body: data as unknown as BodyInit
        })
    }

    /**
     * Send a chat message via the API proxy (SSE streaming)
     */
    async sendChatMessage(sessionId: number, messages: ChatMessage[]): Promise<Response> {
        const token = this.getStoredToken()
        const url = `${this.baseUrl}/adventure-sessions/${sessionId}/chat`
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ messages })
        })
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