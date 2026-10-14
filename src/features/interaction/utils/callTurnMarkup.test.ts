import { describe, expect, it } from 'vitest'
import type { ChatResponseSegment, TurnEntry } from '@/shared'
import { callTurnDisplay, isCallReply } from './callTurnMarkup'

const SPOKEN = 'Hold on. <#0.4#> (sighs) The door is open.'
const SHOWN = 'Hold on. The door is open.'

/** The metadata the BFF stores on a call reply (callbot_execution). */
function callMetadata(): Record<string, unknown> {
    return {
        conversation_mode: 'voice_call',
        voice: { voice_session_id: 7, segment_seq: 2, stt_provider: 'groq', tts_provider: 'elevenlabs_streaming', partial: false },
        response_display_text: SPOKEN,
    }
}

function turn(overrides: Partial<TurnEntry> = {}): TurnEntry {
    return { id: '1', type: 'ai', content: SPOKEN, timestamp: '2026-10-14T10:00:00Z', ...overrides }
}

describe('isCallReply (D23 gate: the turn\'s own provenance)', () => {
    it('is true for a reply of a voice call', () => {
        expect(isCallReply(turn({ metadata: callMetadata() }))).toBe(true)
        expect(isCallReply(turn({ metadata: { ...callMetadata(), voice: { tts_provider: 'elevenlabs_streaming', truncated: true, played_ms: 900 } } }))).toBe(true)
        expect(isCallReply(turn({ metadata: { conversation_mode: 'voice_call', voice: {} } }))).toBe(true)
    })

    it.each([
        ['a text reply', turn({ metadata: { voice: { tts_provider: 'elevenlabs_streaming' } } })],
        ['a live reply (no metadata)', turn()],
        ['the player\'s call turn', turn({ type: 'user', metadata: callMetadata() })],
    ])('is false for %s', (_label, entry) => {
        expect(isCallReply(entry)).toBe(false)
    })
})

describe('callTurnDisplay', () => {
    const segments: ChatResponseSegment[] = [{ kind: 'speech', content: SPOKEN, speaker_id: 'c1', speaker_name: 'Lyra' }]

    it('strips speech markup v1 from a call reply and its segments', () => {
        const display = callTurnDisplay(turn({ metadata: callMetadata(), segments }))
        expect(display.content).toBe(SHOWN)
        expect(display.segments).toEqual([{ ...segments[0], content: SHOWN }])
        // The stored turn is not written to.
        expect(segments[0].content).toBe(SPOKEN)
    })

    it('strips a call reply without a provider', () => {
        expect(callTurnDisplay(turn({ metadata: { conversation_mode: 'voice_call', voice: {} } })).content).toBe(SHOWN)
    })

    it('hides a token cut mid-way while the reply streams', () => {
        const display = callTurnDisplay(turn({
            metadata: callMetadata(),
            isStreaming: true,
            content: 'Hold on <#0.',
            segments: [{ kind: 'speech', content: 'Hold on (lau', streaming: true }],
        }))
        expect(display.content).toBe('Hold on')
        expect(display.segments?.[0].content).toBe('Hold on')
    })

    it.each([
        ['a text reply', turn({ segments })],
        ['a text reply with a voice', turn({ metadata: { voice: { tts_provider: 'elevenlabs_streaming' } }, segments })],
        ['the player\'s call turn', turn({ type: 'user', metadata: callMetadata(), segments })],
        ['a live reply (no metadata)', turn({ segments })],
    ])('passes %s through as stored: the same string and segment array', (_label, entry) => {
        const display = callTurnDisplay(entry)
        expect(display.content).toBe(entry.content)
        expect(display.segments).toBe(entry.segments)
    })
})
