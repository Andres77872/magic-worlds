import { describe, expect, it } from 'vitest'
import {
    resolveSegmentIdentity,
    safeResponseSegments,
    segmentsToPlainText,
    streamingXmlToPlainText,
    streamingXmlToSegments,
} from './chatSegments'
import type { ChatResponseSegment, ChatSpeakerRosterEntry } from '@/shared'

describe('streamingXmlToSegments', () => {
    it('parses a complete response into ordered segments with none streaming', () => {
        const raw =
            '<response><narrator>The door creaks open.</narrator>' +
            '<say speaker_id="aria">Who\'s there?</say>' +
            '<think speaker_id="borin">Stay alert.</think></response>'
        const { segments, fallbackText } = streamingXmlToSegments(raw)
        expect(fallbackText).toBeUndefined()
        expect(segments).toEqual([
            { kind: 'narrator', content: 'The door creaks open.' },
            { kind: 'speech', content: "Who's there?", speaker_id: 'aria' },
            { kind: 'thought', content: 'Stay alert.', speaker_id: 'borin' },
        ])
        expect(segments.every((s) => !s.streaming)).toBe(true)
    })

    it('marks the final unclosed tag as the streaming segment', () => {
        const raw =
            '<response><narrator>The door creaks open.</narrator>' +
            '<say speaker_id="aria">Who\'s the'
        const { segments } = streamingXmlToSegments(raw)
        expect(segments).toEqual([
            { kind: 'narrator', content: 'The door creaks open.' },
            { kind: 'speech', content: "Who's the", speaker_id: 'aria', streaming: true },
        ])
    })

    it('does not open a segment when an attribute is split across chunks', () => {
        const raw = '<response><narrator>Hi.</narrator><say speaker_id="ar'
        const { segments } = streamingXmlToSegments(raw)
        // Only the closed narrator; the half-arrived <say has no closing '>'.
        expect(segments).toEqual([{ kind: 'narrator', content: 'Hi.' }])
    })

    it('trims a trailing partial tag from the streaming segment content', () => {
        const raw = '<response><say speaker_id="aria">Hello there <'
        const { segments } = streamingXmlToSegments(raw)
        expect(segments).toEqual([
            { kind: 'speech', content: 'Hello there', speaker_id: 'aria', streaming: true },
        ])
    })

    it('strips private <think> (no attr) but keeps visible <think speaker_id>', () => {
        const raw =
            '<response><think>secret chain of thought</think>' +
            '<say speaker_id="aria">Hi.</say>' +
            '<think speaker_id="aria">I wonder.</think></response>'
        const { segments } = streamingXmlToSegments(raw)
        expect(segments).toEqual([
            { kind: 'speech', content: 'Hi.', speaker_id: 'aria' },
            { kind: 'thought', content: 'I wonder.', speaker_id: 'aria' },
        ])
    })

    it('decodes XML entities in segment content', () => {
        const raw = '<response><say speaker_id="aria">&quot;Run&quot; &amp; hide &lt;now&gt;</say></response>'
        const { segments } = streamingXmlToSegments(raw)
        expect(segments[0].content).toBe('"Run" & hide <now>')
    })

    it('falls back to flattened plain text when there are no structured segments', () => {
        const raw = 'Just some prose with no tags yet'
        const { segments, fallbackText } = streamingXmlToSegments(raw)
        expect(segments).toEqual([])
        expect(fallbackText).toBe(streamingXmlToPlainText(raw))
        expect(fallbackText).toBe('Just some prose with no tags yet')
    })

    it('parity: a complete stream yields the same kinds/speakers/order as the authoritative parse', () => {
        const raw =
            '<response><narrator>Scene.</narrator>' +
            '<say speaker_id="aria">Line one.</say>' +
            '<say speaker_id="borin">Line two.</say></response>'
        const { segments } = streamingXmlToSegments(raw)
        // Authoritative-shaped segments (speaker_name present) for comparison.
        const authoritative = safeResponseSegments([
            { kind: 'narrator', content: 'Scene.' },
            { kind: 'speech', content: 'Line one.', speaker_id: 'aria', speaker_name: 'Aria' },
            { kind: 'speech', content: 'Line two.', speaker_id: 'borin', speaker_name: 'Borin' },
        ])
        expect(segments.map((s) => [s.kind, s.speaker_id, s.content])).toEqual(
            authoritative.map((s) => [s.kind, s.speaker_id, s.content]),
        )
    })
})

describe('resolveSegmentIdentity', () => {
    const roster = new Map<string, ChatSpeakerRosterEntry>([
        ['aria', { speaker_id: 'aria', name: 'Aria', image_url: 'https://x/aria.png', has_voice: true }],
    ])

    it('adds speaker_name + portrait from the roster and leaves narrator untouched', () => {
        const segments: ChatResponseSegment[] = [
            { kind: 'narrator', content: 'Scene.' },
            { kind: 'speech', content: 'Hi.', speaker_id: 'aria', streaming: true },
            { kind: 'thought', content: 'Hmm.', speaker_id: 'unknown' },
        ]
        const resolved = resolveSegmentIdentity(segments, roster)
        expect(resolved[0]).toEqual({ kind: 'narrator', content: 'Scene.' })
        expect(resolved[1]).toMatchObject({ speaker_name: 'Aria', image_url: 'https://x/aria.png', streaming: true })
        // Unknown speaker falls back to the id and a null portrait.
        expect(resolved[2]).toMatchObject({ speaker_name: 'unknown', image_url: null })
    })

    it('keeps an existing authoritative speaker_name and only adds the portrait', () => {
        const segments: ChatResponseSegment[] = [
            { kind: 'speech', content: 'Hi.', speaker_id: 'aria', speaker_name: 'Aria the Bold' },
        ]
        const [resolved] = resolveSegmentIdentity(segments, roster)
        expect(resolved.speaker_name).toBe('Aria the Bold')
        expect(resolved.image_url).toBe('https://x/aria.png')
    })
})

describe('segmentsToPlainText (regression)', () => {
    it('formats speech and thought with speaker prefixes', () => {
        expect(
            segmentsToPlainText([
                { kind: 'narrator', content: 'Scene.' },
                { kind: 'speech', content: 'Hi.', speaker_id: 'aria', speaker_name: 'Aria' },
                { kind: 'thought', content: 'Hmm.', speaker_id: 'aria', speaker_name: 'Aria' },
            ]),
        ).toBe('Scene.\nAria: Hi.\nAria thinks: Hmm.')
    })
})
