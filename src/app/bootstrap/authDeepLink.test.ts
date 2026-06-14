import { beforeEach, describe, expect, it } from 'vitest'
import { clearAuthDeepLink, consumeAuthDeepLink, readAuthDeepLinkToken } from './authDeepLink'
import { parseAuthToken } from '@/features/gallery/galleryLinks'

describe('authDeepLink', () => {
    beforeEach(() => {
        clearAuthDeepLink()
        window.sessionStorage.clear()
        window.history.replaceState(null, '', '/')
    })

    it('consumes a password-reset link, strips the token, and routes to the internal hash', () => {
        window.history.replaceState(null, '', '/auth/password/reset?token=lid.secret')
        const kind = consumeAuthDeepLink()
        expect(kind).toBe('password-reset')
        expect(window.location.hash).toBe('#/password-reset')
        expect(window.location.search).toBe('')
        expect(readAuthDeepLinkToken('password-reset')).toBe('lid.secret')
        expect(parseAuthToken('password-reset')).toBe('lid.secret')
    })

    it('consumes an email-verify link', () => {
        window.history.replaceState(null, '', '/auth/email/verify?token=abc.def')
        expect(consumeAuthDeepLink()).toBe('verify-email')
        expect(window.location.hash).toBe('#/verify-email')
        expect(readAuthDeepLinkToken('verify-email')).toBe('abc.def')
    })

    it('ignores non-deep-link paths', () => {
        window.history.replaceState(null, '', '/#/profile')
        expect(consumeAuthDeepLink()).toBeNull()
    })

    it('clearAuthDeepLink drops the stashed token so it cannot be replayed', () => {
        window.history.replaceState(null, '', '/auth/password/reset?token=x.y')
        consumeAuthDeepLink()
        clearAuthDeepLink()
        expect(readAuthDeepLinkToken('password-reset')).toBeNull()
    })

    it('parseAuthToken falls back to the in-app hash query form', () => {
        clearAuthDeepLink()
        expect(parseAuthToken('password-reset', '#/password-reset?token=fromhash')).toBe('fromhash')
    })
})
