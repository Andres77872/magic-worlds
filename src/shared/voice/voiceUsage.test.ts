import { describe, expect, it } from 'vitest'
import type { Membership } from '@/shared/types/auth.types'
import { readVoiceUsage } from './voiceUsage'

function membership(fields: Partial<Membership>): Membership {
    return fields as Membership
}

describe('readVoiceUsage', () => {
    it('returns null for a server without the usage fields', () => {
        expect(readVoiceUsage(null)).toBeNull()
        expect(readVoiceUsage(membership({}))).toBeNull()
        expect(readVoiceUsage(membership({ voice_usage: null }))).toBeNull()
    })

    it('reads the flat fields first (03 §5.16 I-1), the nested block only per missing field', () => {
        const usage = readVoiceUsage(membership({
            voice_usage: { narration_chars_used: 100, narration_chars_limit: 2500, previews_left: 9 },
            narration_chars_used: 999,
            call_seconds_used: 60,
            call_seconds_limit: 180,
            previews_left: 3,
        }))
        expect(usage).toEqual({
            // Flat `narration_chars_used` wins; the limit exists only nested, so it is the fallback.
            narration: { used: 999, limit: 2500, remaining: 1501 },
            call: { used: 60, limit: 180, remaining: 120 },
            previewsLeft: 3,
        })
    })

    it('reads a server that sends only the flat fields', () => {
        expect(readVoiceUsage(membership({ narration_chars_used: 500, narration_chars_limit: 2500, previews_left: 0 }))).toEqual({
            narration: { used: 500, limit: 2500, remaining: 2000 },
            call: null,
            previewsLeft: 0,
        })
    })

    it('still reads the nested block alone (fallback for the dropped 09 §1.8 shape)', () => {
        expect(readVoiceUsage(membership({ voice_usage: { call_seconds_used: 30, call_seconds_limit: 180 } }))?.call)
            .toEqual({ used: 30, limit: 180, remaining: 150 })
    })

    it('ignores an invalid flat value and falls back to the nested one', () => {
        expect(readVoiceUsage(membership({ previews_left: -1, voice_usage: { previews_left: 2 } }))?.previewsLeft).toBe(2)
    })

    it('needs both halves of a meter and never goes below zero', () => {
        expect(readVoiceUsage(membership({ narration_chars_used: 10 }))).toBeNull()
        expect(readVoiceUsage(membership({ call_seconds_used: 200, call_seconds_limit: 180 }))?.call).toEqual({ used: 200, limit: 180, remaining: 0 })
        expect(readVoiceUsage(membership({ previews_left: -1, narration_chars_limit: Number.NaN }))).toBeNull()
    })
})
