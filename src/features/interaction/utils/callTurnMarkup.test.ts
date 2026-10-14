import { describe, expect, it } from 'vitest'
import type { ChatResponseSegment, TurnEntry } from '@/shared'
import { LEGACY_CALL_TTS_PROVIDER } from '@/test/fixtures/legacyMinimax'
import { callTurnDisplay, isCallReply, isElevenLabsCallReply } from './callTurnMarkup'

const SPOKEN = 'Hold on. <#0.4#> (sighs) The door is open.'
const SHOWN = 'Hold on. The door is open.'

/** The metadata the BFF stores on a call reply (callbot_execution), whichever provider spoke it. */
function callMetadata(ttsProvider: string): Record<string, unknown> {
    return {
        conversation_mode: 'voice_call',
        voice: { voice_session_id: 7, segment_seq: 2, stt_provider: 'groq', tts_provider: ttsProvider, partial: false },
        response_display_text: SPOKEN,
    }
}

function turn(overrides: Partial<TurnEntry> = {}): TurnEntry {
    return { id: '1', type: 'ai', content: SPOKEN, timestamp: '2026-10-14T10:00:00Z', ...overrides }
}

describe('isElevenLabsCallReply (D23 gate: the turn\'s own provenance)', () => {
    it('is true only for a reply the ElevenLabs streaming client spoke', () => {
        expect(isElevenLabsCallReply(turn({ metadata: callMetadata('elevenlabs_streaming') }))).toBe(true)
        expect(isElevenLabsCallReply(turn({ metadata: { ...callMetadata('elevenlabs_streaming'), voice: { tts_provider: 'elevenlabs_streaming', truncated: true, played_ms: 900 } } }))).toBe(true)
    })

    it.each([
        ['a call reply stored before the voice purge', turn({ metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) })],
        ['a call reply without a provider', turn({ metadata: { conversation_mode: 'voice_call', voice: {} } })],
        ['a call reply with a malformed voice', turn({ metadata: { conversation_mode: 'voice_call', voice: 'elevenlabs_streaming' } })],
        ['a text reply', turn({ metadata: { voice: { tts_provider: 'elevenlabs_streaming' } } })],
        ['a live reply (no metadata)', turn()],
        ['the player\'s call turn', turn({ type: 'user', metadata: callMetadata('elevenlabs_streaming') })],
    ])('is false for %s', (_label, entry) => {
        expect(isElevenLabsCallReply(entry)).toBe(false)
    })
})

describe('callTurnDisplay', () => {
    const segments: ChatResponseSegment[] = [{ kind: 'speech', content: SPOKEN, speaker_id: 'c1', speaker_name: 'Lyra' }]

    it('strips speech markup v1 from an ElevenLabs call reply and its segments', () => {
        const display = callTurnDisplay(turn({ metadata: callMetadata('elevenlabs_streaming'), segments }))
        expect(display.content).toBe(SHOWN)
        expect(display.segments).toEqual([{ ...segments[0], content: SHOWN }])
        // The stored turn is not written to.
        expect(segments[0].content).toBe(SPOKEN)
    })

    it('hides a token cut mid-way while the reply streams', () => {
        const display = callTurnDisplay(turn({
            metadata: callMetadata('elevenlabs_streaming'),
            isStreaming: true,
            content: 'Hold on <#0.',
            segments: [{ kind: 'speech', content: 'Hold on (lau', streaming: true }],
        }))
        expect(display.content).toBe('Hold on')
        expect(display.segments?.[0].content).toBe('Hold on')
    })

    it.each([
        ['a call reply stored before the voice purge', turn({ metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments })],
        ['a text reply', turn({ segments })],
        ['the player\'s call turn', turn({ type: 'user', metadata: callMetadata('elevenlabs_streaming'), segments })],
    ])('passes %s through as stored: the same string and segment array', (_label, entry) => {
        const display = callTurnDisplay(entry)
        expect(display.content).toBe(entry.content)
        expect(display.segments).toBe(entry.segments)
    })
})

describe('callTurnDisplay with allCallReplies (10 §2.4 #16-#17)', () => {
    const segments: ChatResponseSegment[] = [{ kind: 'speech', content: SPOKEN, speaker_id: 'c1', speaker_name: 'Lyra' }]

    it('strips a call reply stored before the voice purge and its segments too', () => {
        const display = callTurnDisplay(turn({ metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments }), { allCallReplies: true })
        expect(display.content).toBe(SHOWN)
        expect(display.segments).toEqual([{ ...segments[0], content: SHOWN }])
        expect(segments[0].content).toBe(SPOKEN)
    })

    it('strips a call reply without a provider', () => {
        expect(callTurnDisplay(turn({ metadata: { conversation_mode: 'voice_call', voice: {} } }), { allCallReplies: true }).content).toBe(SHOWN)
    })

    it.each([
        ['a text reply', turn({ segments })],
        ['a text reply with a voice', turn({ metadata: { voice: { tts_provider: LEGACY_CALL_TTS_PROVIDER } }, segments })],
        ['the player\'s call turn', turn({ type: 'user', metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments })],
        ['a live reply (no metadata)', turn({ segments })],
    ])('still passes %s through as stored', (_label, entry) => {
        const display = callTurnDisplay(entry, { allCallReplies: true })
        expect(display.content).toBe(entry.content)
        expect(display.segments).toBe(entry.segments)
    })

    it('isCallReply is the provider-blind gate', () => {
        expect(isCallReply(turn({ metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }))).toBe(true)
        expect(isCallReply(turn({ metadata: callMetadata('elevenlabs_streaming') }))).toBe(true)
        expect(isCallReply(turn())).toBe(false)
        expect(isCallReply(turn({ type: 'user', metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER) }))).toBe(false)
    })

    it('without the option a call reply stored before the voice purge stays as stored', () => {
        const entry = turn({ metadata: callMetadata(LEGACY_CALL_TTS_PROVIDER), segments })
        const display = callTurnDisplay(entry, { allCallReplies: false })
        expect(display.content).toBe(entry.content)
        expect(display.segments).toBe(entry.segments)
    })
})
