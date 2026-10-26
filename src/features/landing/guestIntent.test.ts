import { afterEach, describe, expect, it } from 'vitest'
import { clearGuestIntent, rememberGuestIntent, takeGuestIntent } from './guestIntent'

describe('guestIntent', () => {
    afterEach(() => clearGuestIntent())

    it('hands a remembered create action over exactly once', () => {
        rememberGuestIntent('character', 1_000)

        expect(takeGuestIntent(2_000)).toBe('character')
        expect(takeGuestIntent(2_000)).toBeNull()
    })

    it('forgets a stale intent so a later sign-in never replays it', () => {
        rememberGuestIntent('world', 0)

        expect(takeGuestIntent(16 * 60 * 1000)).toBeNull()
    })

    it('ignores cleared and tampered values', () => {
        rememberGuestIntent('item', 0)
        clearGuestIntent()
        expect(takeGuestIntent(1)).toBeNull()

        sessionStorage.setItem('magic_worlds:guest-intent:v1', JSON.stringify({ key: 'admin', at: 0 }))
        expect(takeGuestIntent(1)).toBeNull()
        sessionStorage.setItem('magic_worlds:guest-intent:v1', '{not json')
        expect(takeGuestIntent(1)).toBeNull()
    })
})
