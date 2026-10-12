import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authSession } from '@/infrastructure/api/authSession'
import { imageCredentialSession } from './imageCredentialSession'

vi.mock('@/infrastructure/api/baseUrl', () => ({ API_BASE_URL: 'https://api.test.invalid' }))
const KEY = 'FAKE_IMAGE_KEY_CANARY'
const token = () => `header.${btoa(JSON.stringify({ project_hash: 'project-one' }))}.signature`

describe('image provider key session', () => {
    beforeEach(() => { imageCredentialSession.clear(); authSession.continueSignedOut(); authSession.authenticate('alice', token()) })
    afterEach(() => { imageCredentialSession.clear(); authSession.continueSignedOut() })

    it('holds one key per provider in memory only', () => {
        imageCredentialSession.remember('openrouter', KEY)

        expect(imageCredentialSession.credentials('openrouter')).toEqual({ api_key: KEY })
        expect(imageCredentialSession.credentials('fal')).toBeUndefined()
        expect(JSON.stringify(localStorage)).not.toContain(KEY)
        expect(JSON.stringify(sessionStorage)).not.toContain(KEY)
        expect(JSON.stringify(imageCredentialSession)).not.toContain(KEY)
    })

    it('keeps the key across a token rotation for the same user', () => {
        imageCredentialSession.remember('fal', KEY)
        authSession.rotateToken(token(), 'alice')
        expect(imageCredentialSession.has('fal')).toBe(true)
    })

    it.each(['expiry', 'logout', 'account'] as const)('drops every key on %s', change => {
        imageCredentialSession.remember('fal', KEY)
        if (change === 'expiry') { authSession.expire(); authSession.authenticate('alice', token()) }
        else if (change === 'logout') { authSession.beginLogout(); authSession.authenticate('alice', token()) }
        else authSession.authenticate('bob', token())
        expect(imageCredentialSession.has('fal')).toBe(false)
    })

    it('drops keys when another tab changes the session', () => {
        imageCredentialSession.remember('fal', KEY)
        window.dispatchEvent(new StorageEvent('storage', { key: 'magic_worlds:token', newValue: 'other-session' }))
        expect(imageCredentialSession.has('fal')).toBe(false)
    })

    it.each(['', ' padded', 'line\nbreak', 'x'.repeat(4097)])('rejects a malformed key %#', key => {
        expect(() => imageCredentialSession.remember('fal', key)).toThrow('IMAGE_CREDENTIAL_INVALID')
    })

    it('refuses keys while signed out', () => {
        authSession.continueSignedOut()
        expect(() => imageCredentialSession.remember('fal', KEY)).toThrow('IMAGE_SESSION_UNAVAILABLE')
    })

    it('forgets one provider or all of them and notifies listeners', () => {
        const listener = vi.fn()
        const unsubscribe = imageCredentialSession.subscribe(listener)
        imageCredentialSession.remember('fal', KEY)
        imageCredentialSession.remember('openrouter', KEY)
        imageCredentialSession.forget('fal')
        expect([imageCredentialSession.has('fal'), imageCredentialSession.has('openrouter')]).toEqual([false, true])
        imageCredentialSession.forget()
        expect(imageCredentialSession.has('openrouter')).toBe(false)
        expect(listener).toHaveBeenCalledTimes(4)
        unsubscribe()
    })
})
