/**
 * Token management service for provisional access tokens
 */

import { apiService } from '../api'

const PROVISIONAL_TOKEN_KEY = 'magic_access_token'
const DISCLAIMER_ACCEPTED_KEY = 'magic_disclaimer_accepted'

class TokenService {
    /**
     * Get the current provisional token from localStorage
     */
    getProvisionalToken(): string | null {
        return localStorage.getItem(PROVISIONAL_TOKEN_KEY)
    }

    /**
     * Store provisional token in localStorage
     */
    setProvisionalToken(token: string): void {
        localStorage.setItem(PROVISIONAL_TOKEN_KEY, token)
    }

    /**
     * Remove provisional token from localStorage
     */
    clearProvisionalToken(): void {
        localStorage.removeItem(PROVISIONAL_TOKEN_KEY)
    }

    /**
     * Check if disclaimer has been accepted
     */
    hasAcceptedDisclaimer(): boolean {
        return localStorage.getItem(DISCLAIMER_ACCEPTED_KEY) === 'true'
    }

    /**
     * Mark disclaimer as accepted
     */
    setDisclaimerAccepted(): void {
        localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, 'true')
    }

    /**
     * Check if disclaimer has been accepted, and if provisional token exists
     */
    shouldShowDisclaimer(): boolean {
        return !this.hasAcceptedDisclaimer() || !this.getProvisionalToken()
    }

    /**
     * Check if provisional token exists, if not fetch a new one
     */
    async ensureProvisionalToken(): Promise<string> {
        let token = this.getProvisionalToken()
        
        if (!token) {
            try {
                console.log('No provisional token found, fetching new one...')
                token = await apiService.getProvisionalToken()
                // Remove quotes if present
                token = token.replace(/^"(.*)"$/, '$1')
                this.setProvisionalToken(token)
                console.log('Provisional token fetched and stored successfully')
            } catch (error) {
                console.error('Failed to fetch provisional token:', error)
                throw new Error('Failed to initialize provisional access token')
            }
        }
        
        return token
    }
}

export const tokenService = new TokenService() 