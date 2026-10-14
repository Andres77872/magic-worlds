import { describe, expect, it } from 'vitest'
import type { ChatTtsSegmentClip, VoiceSubstitutionReason } from '@/shared/types'
import { NO_VOICE_NOTES, REPLACED_REASONS, isCallVoiceReason, isReplacedReason, isStandardFallback, turnVoiceNotes } from './substitution'

const ALL_REASONS: VoiceSubstitutionReason[] = [
    'voice_removed',
    'voice_unavailable',
    'voice_blocked',
    'not_call_eligible',
    'default_voice',
    'distinct_voice',
    'language_unsupported',
    'tier_fallback',
]

const clip = (overrides: Partial<ChatTtsSegmentClip>): ChatTtsSegmentClip => ({ segment_index: 0, ...overrides })

describe('substitution reasons', () => {
    it('classifies all eight reasons', () => {
        const table = Object.fromEntries(ALL_REASONS.map((reason) => [reason, [isReplacedReason(reason), isStandardFallback(reason), isCallVoiceReason(reason)]]))
        expect(table).toEqual({
            voice_removed: [true, false, false],
            voice_unavailable: [true, false, false],
            voice_blocked: [true, false, false],
            not_call_eligible: [false, false, true],
            default_voice: [false, false, false],
            distinct_voice: [false, false, false],
            language_unsupported: [true, false, false],
            tier_fallback: [false, true, false],
        })
    })

    it('mirrors the BFF resolver set (R-7): default_voice is not a replacement', () => {
        expect([...REPLACED_REASONS].sort()).toEqual(['language_unsupported', 'voice_blocked', 'voice_removed', 'voice_unavailable'])
    })

    it('ignores unknown and non-string reasons (forward compatible)', () => {
        for (const value of ['voice_retired_2027', '', null, undefined, 3, {}]) {
            expect(isReplacedReason(value)).toBe(false)
            expect(isStandardFallback(value)).toBe(false)
            expect(isCallVoiceReason(value)).toBe(false)
        }
    })
})

describe('turnVoiceNotes', () => {
    it('gives nothing for clips stored without voice fields', () => {
        expect(turnVoiceNotes([clip({ kind: 'narrator' }), clip({ segment_index: 1, kind: 'speech', speaker_id: 'card-1' })])).toBe(NO_VOICE_NOTES)
        expect(turnVoiceNotes(undefined)).toBe(NO_VOICE_NOTES)
        expect(turnVoiceNotes([])).toBe(NO_VOICE_NOTES)
    })

    it('tier_fallback gives the standard note only', () => {
        expect(turnVoiceNotes([clip({ substitution_reason: 'tier_fallback', voice_name: 'Ava' })])).toEqual({ standardFallback: true, replaced: [] })
    })

    it('distinct_voice, default_voice and not_call_eligible give no narration badge', () => {
        expect(turnVoiceNotes([
            clip({ substitution_reason: 'distinct_voice' }),
            clip({ segment_index: 1, substitution_reason: 'default_voice' }),
            clip({ segment_index: 2, substitution_reason: 'not_call_eligible' }),
            clip({ segment_index: 3, substitution_reason: 'mystery_reason' as VoiceSubstitutionReason }),
        ])).toBe(NO_VOICE_NOTES)
    })

    it('lists each replaced speaker once, with names and the card id for a targeted refresh', () => {
        const notes = turnVoiceNotes([
            clip({ kind: 'narrator', substitution_reason: 'voice_removed', voice_name: 'Ava', original_voice_name: 'Mia' }),
            clip({ segment_index: 1, kind: 'speech', speaker_id: 'card-1', speaker_name: 'Rook', substitution_reason: 'voice_blocked', voice_name: 'Theo' }),
            clip({ segment_index: 2, kind: 'speech', speaker_id: 'card-1', speaker_name: 'Rook', substitution_reason: 'voice_blocked', voice_name: 'Theo' }),
            clip({ segment_index: 3, kind: 'narrator', substitution_reason: 'voice_removed', voice_name: 'Ava', original_voice_name: 'Mia' }),
            clip({ segment_index: 4, kind: 'thought', speaker_id: 'card-2', speaker_name: 'Wren', substitution_reason: 'tier_fallback' }),
        ])
        expect(notes.standardFallback).toBe(true)
        expect(notes.replaced).toEqual([
            { speaker: 'narrator', kind: 'narrator', cardId: null, speakerName: null, voiceName: 'Ava', originalVoiceName: 'Mia', reason: 'voice_removed' },
            { speaker: 'card-1', kind: 'speech', cardId: 'card-1', speakerName: 'Rook', voiceName: 'Theo', originalVoiceName: null, reason: 'voice_blocked' },
        ])
    })

    it('keys an id-less speaker by name, and blank names read as missing', () => {
        const notes = turnVoiceNotes([
            clip({ kind: 'speech', speaker_name: 'Rook', substitution_reason: 'voice_unavailable', voice_name: '  ', original_voice_name: '' }),
            clip({ segment_index: 1, kind: 'speech', speaker_name: 'Rook', substitution_reason: 'voice_unavailable' }),
        ])
        expect(notes.replaced).toEqual([
            { speaker: 'Rook', kind: 'speech', cardId: null, speakerName: 'Rook', voiceName: null, originalVoiceName: null, reason: 'voice_unavailable' },
        ])
    })
})
