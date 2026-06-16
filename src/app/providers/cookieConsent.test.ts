import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
    COOKIE_CONSENT_KEY,
    COOKIE_CONSENT_VERSION,
    clearConsent,
    hasConsent,
    makeConsent,
    readConsent,
    writeConsent,
} from './cookieConsent'

describe('cookieConsent helpers', () => {
    beforeEach(() => localStorage.clear())
    afterEach(() => localStorage.clear())

    it('returns null when nothing is stored', () => {
        expect(readConsent()).toBeNull()
    })

    it('round-trips a written consent record', () => {
        writeConsent(makeConsent('all', { essential: true, analytics: true }))
        const read = readConsent()
        expect(read?.decision).toBe('all')
        expect(read?.categories.analytics).toBe(true)
        expect(read?.version).toBe(COOKIE_CONSENT_VERSION)
    })

    it('always forces the essential category on', () => {
        const consent = makeConsent('essential', { essential: false as unknown as boolean, analytics: false })
        expect(consent.categories.essential).toBe(true)
    })

    it('ignores a stored record with a mismatched version', () => {
        localStorage.setItem(
            COOKIE_CONSENT_KEY,
            JSON.stringify({ version: 999, decision: 'all', categories: { essential: true, analytics: true } }),
        )
        expect(readConsent()).toBeNull()
    })

    it('ignores malformed JSON', () => {
        localStorage.setItem(COOKIE_CONSENT_KEY, 'not json')
        expect(readConsent()).toBeNull()
    })

    it('clears the stored decision', () => {
        writeConsent(makeConsent('all', { essential: true, analytics: true }))
        clearConsent()
        expect(readConsent()).toBeNull()
    })

    it('hasConsent: essential always allowed, analytics needs an opt-in', () => {
        expect(hasConsent(null, 'essential')).toBe(true)
        expect(hasConsent(null, 'analytics')).toBe(false)
        expect(hasConsent(makeConsent('essential', { essential: true, analytics: false }), 'analytics')).toBe(false)
        expect(hasConsent(makeConsent('all', { essential: true, analytics: true }), 'analytics')).toBe(true)
    })
})
