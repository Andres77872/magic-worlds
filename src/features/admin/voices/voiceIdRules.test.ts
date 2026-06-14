import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { validateVoiceId } from './voiceIdRules'

// Echoes the translation key so assertions can match on the failure mode.
const t = ((key: string) => key) as unknown as TFunction

describe('validateVoiceId', () => {
    it.each([
        ['NarratorVoice1', true],
        ['Good_Voice-1', true],
        ['abcdefgh', true],
        ['', false], // empty
        ['short', false], // < 8 chars
        ['1abcdefgh', false], // must start with a letter
        ['abcdefg_', false], // cannot end with _
        ['abcdefg-', false], // cannot end with -
        ['abcdef gh', false], // no spaces
        ['abcdef.gh', false], // illegal char
    ])('validates %s -> %s', (value, ok) => {
        expect(validateVoiceId(value, t).ok).toBe(ok)
    })

    it('returns a reason key for each failure mode', () => {
        expect(validateVoiceId('short', t).reason).toMatch(/length/)
        expect(validateVoiceId('1abcdefgh', t).reason).toMatch(/startLetter/)
        expect(validateVoiceId('abcdefg-', t).reason).toMatch(/endChar/)
    })
})
