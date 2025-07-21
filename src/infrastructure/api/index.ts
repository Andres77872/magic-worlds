/**
 * API infrastructure - centralized API request handling
 */

// Get API base URL from environment, fallback to default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8010'

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
        const config: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        }

        try {
            const response = await fetch(url, config)
            
            if (!response.ok) {
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
     * Get a provisional access token
     */
    async getProvisionalToken(): Promise<string> {
        return this.request<string>('/auth/provisional-token', {
            method: 'POST'
        }, false)
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
                'Authorization': `Bearer ${token}`,
                ...options.headers
            }
        })
    }
}

export const apiService = new ApiService()
export type { ApiService } 