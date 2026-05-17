/**
 * Token management service for provisional access tokens
 */

import { apiService } from '../api'

const PROVISIONAL_TOKEN_KEY = 'magic_worlds:access_token'
const DISCLAIMER_ACCEPTED_KEY = 'magic_worlds:disclaimer_accepted'

class TokenService {
    private tokenValidationPromise: Promise<string> | null = null
    private lastValidatedToken: string | null = null
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
     * Also verifies if the existing token is still valid by calling /user/me
     * Uses caching to prevent redundant API calls
     */
    async ensureProvisionalToken(): Promise<string> {
        const currentToken = this.getProvisionalToken()
        
        // If we already validated this token, return it immediately
        if (currentToken && currentToken === this.lastValidatedToken) {
            return currentToken
        }
        
        // If there's already a validation in progress, wait for it
        if (this.tokenValidationPromise) {
            return this.tokenValidationPromise
        }
        
        // Start new validation
        this.tokenValidationPromise = this.validateAndEnsureToken()
        
        try {
            const token = await this.tokenValidationPromise
            return token
        } finally {
            this.tokenValidationPromise = null
        }
    }
    
    private async validateAndEnsureToken(): Promise<string> {
        let token = this.getProvisionalToken()
        
        if (token) {
            try {
                // Verify token validity by calling /user/me
                await apiService.getUserData(token.replace(/^"(.*)"$/, '$1'))
                console.log('Existing provisional token is valid')
                this.lastValidatedToken = token
                return token
            } catch (error) {
                console.warn('Existing provisional token is invalid or user not found, fetching new one...')
                this.clearProvisionalToken()
                this.lastValidatedToken = null
                token = null
            }
        }
        
        if (!token) {
            try {
                console.log('Fetching new provisional token...')
                token = await apiService.getProvisionalToken()
                // Remove quotes if present
                token = token.replace(/^"(.*)"$/, '$1')
                this.setProvisionalToken(token)
                this.lastValidatedToken = token
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