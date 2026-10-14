import { describe, expect, it } from 'vitest'
import { en } from '@/app/i18n/locales/en'
import { voiceWriteErrorKey } from './voiceWriteErrors'

const CODES = [
    ['voice_v1_not_allowed', 'voices.errors.v1NotAllowed'],
    ['voice_not_eligible', 'voices.picker.eligibilityError'],
    ['voice_plan_locked', 'voices.errors.planLocked'],
    ['voice_invalid', 'voices.errors.invalid'],
    ['voice_reload_required', 'voices.errors.reloadRequired'],
    ['voice_tier_unavailable', 'voices.errors.tierUnavailable'],
] as const

function lookup(path: string): unknown {
    return path.split('.').reduce<unknown>(
        (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
        en,
    )
}

describe('voiceWriteErrorKey', () => {
    it.each(CODES)('maps %s to %s', (code, key) => {
        expect(voiceWriteErrorKey(code)).toBe(key)
    })

    it('points every mapped code at an existing en string', () => {
        for (const [code] of CODES) {
            expect(typeof lookup(voiceWriteErrorKey(code) as string)).toBe('string')
        }
    })

    it('returns null for unknown codes and prototype keys', () => {
        expect(voiceWriteErrorKey('voice_unavailable')).toBeNull()
        // Never emitted after the voice purge (I-68): every authenticated caller may pick a V2 voice.
        expect(voiceWriteErrorKey('voice_v2_not_allowed')).toBeNull()
        expect(voiceWriteErrorKey('')).toBeNull()
        expect(voiceWriteErrorKey('toString')).toBeNull()
        expect(voiceWriteErrorKey('__proto__')).toBeNull()
    })
})
