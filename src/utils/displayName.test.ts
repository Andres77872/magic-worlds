import { describe, it, expect } from 'vitest'
import { effectiveName } from './displayName'

describe('effectiveName', () => {
    it('prefers a non-empty display_name over username', () => {
        expect(effectiveName('The Loremaster', 'lyra_bard')).toBe('The Loremaster')
        expect(effectiveName({ display_name: 'The Loremaster', username: 'lyra_bard' })).toBe('The Loremaster')
    })

    it('trims the display_name', () => {
        expect(effectiveName('  Aria  ', 'aria99')).toBe('Aria')
    })

    it('falls back to username when display_name is null/undefined', () => {
        expect(effectiveName(null, 'lyra_bard')).toBe('lyra_bard')
        expect(effectiveName(undefined, 'lyra_bard')).toBe('lyra_bard')
        expect(effectiveName({ username: 'lyra_bard' })).toBe('lyra_bard')
    })

    it('falls back to username when display_name is empty/whitespace', () => {
        expect(effectiveName('', 'lyra_bard')).toBe('lyra_bard')
        expect(effectiveName('   ', 'lyra_bard')).toBe('lyra_bard')
        expect(effectiveName({ display_name: '   ', username: 'lyra_bard' })).toBe('lyra_bard')
    })

    it('works across User / UserProfile / CardActor shapes', () => {
        // CardActor: { user_id, username, display_name }
        expect(effectiveName({ display_name: 'Mapmaker', username: 'creator_7' })).toBe('Mapmaker')
        expect(effectiveName({ username: 'creator_7' })).toBe('creator_7')
    })

    it('returns an empty string when both are empty/absent', () => {
        expect(effectiveName(null, null)).toBe('')
        expect(effectiveName({})).toBe('')
        expect(effectiveName(undefined)).toBe('')
    })
})
