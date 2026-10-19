import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { ChatSpeakerRosterEntry } from '@/shared'
import { ChatJsonPreview, finalizeResponseSegments, resolveSegmentIdentity, safeResponseSegments, segmentsToPlainText } from './chatSegments'

const roster = new Map<string, ChatSpeakerRosterEntry>([
    ['aria', { speaker_id: 'aria', name: 'Aria', image_url: '/images/aria.webp' }],
    ['bram', { speaker_id: 'bram', name: 'Bram', image_url: null }],
])
const entries = [
    { kind: 'narrator', content: 'The lantern flickers.\n\nFootsteps stop.' },
    { kind: 'speech', speaker_id: 'aria', content: 'Wait. **Listen.** "Who?" \\ 😀' },
    { kind: 'thought', speaker_id: 'bram', content: 'That sound again.' },
]

describe('ChatJsonPreview', () => {
    it('releases an unfinished body with complete identity and preserves pending word/paragraph spaces', () => {
        const parser = new ChatJsonPreview(roster)
        let segments = parser.feed('{"segments":[{"kind":"speech","speaker_id":"aria","content":"Hello ')
        expect(segments).toEqual([{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', image_url: '/images/aria.webp', content: 'Hello', streaming: true }])
        segments = parser.feed('there.\\n\\nSecond ')
        expect(segments[0].content).toBe('Hello there.\n\nSecond')
        segments = parser.feed('paragraph."}]}')
        expect(segments[0].content).toBe('Hello there.\n\nSecond paragraph.')
        expect(segments[0].streaming).toBeUndefined()
    })

    it.each([false, true])('agrees at every split boundary (escaped Unicode=%s)', (ascii) => {
        const original = JSON.stringify({ segments: entries })
        const source = ascii ? original.replace('😀', '\\ud83d\\ude00') : original
        const expected = new ChatJsonPreview(roster).feed(source)
        for (let split = 0; split <= source.length; split++) {
            const parser = new ChatJsonPreview(roster)
            parser.feed(source.slice(0, split))
            expect(parser.feed(source.slice(split))).toEqual(expected)
        }
        expect(expected.map((entry) => entry.content)).toEqual(entries.map((entry) => entry.content))
    })

    it('holds body-first entries until both identity strings have closed', () => {
        const parser = new ChatJsonPreview(roster)
        expect(parser.feed('{"segments":[{"content":"Hello","kind":"speech","speaker_id":"aria')).toEqual([])
        expect(parser.feed('"').map((s) => s.speaker_name)).toEqual(['Aria'])
        expect(parser.feed('}]}')[0].content).toBe('Hello')
    })

    it('does not confuse an unfinished ID prefix with an allowed ID', () => {
        const parser = new ChatJsonPreview(roster)
        expect(parser.feed('{"segments":[{"kind":"speech","content":"Private","speaker_id":"aria')).toEqual([])
        expect(() => parser.feed('nne"}]}')).toThrow()
    })

    it('keeps completed segment identity stable and does not duplicate it at a comma', () => {
        const parser = new ChatJsonPreview(roster)
        const first = parser.feed('{"segments":[{"kind":"narrator","content":"First."}')[0]
        expect(parser.feed(',')).toEqual([first])
        const next = parser.feed('{"kind":"speech","speaker_id":"bram","content":"Second')
        expect(next).toHaveLength(2)
        expect(next[0]).toBe(first)
        expect(parser.feed(' word"}]}')[0]).toBe(first)
    })

    it('never displays unfinished Unicode escapes or a half surrogate', () => {
        const parser = new ChatJsonPreview(roster)
        expect(parser.feed('{"segments":[{"kind":"narrator","content":"Moon \\uD83D')[0].content).toBe('Moon')
        expect(parser.feed('\\uDE00"}]}')[0].content).toBe('Moon 😀')
    })

    it.each([
        'ordinary prose',
        '{"segments":[{"kind":"speech","speaker_id":"persona","content":"No"}]}',
        '{"segments":[{"kind":"speech","speaker_id":"unknown","content":"No"}]}',
        '{"segments":[{"kind":"other","content":"No"}]}',
        '{"segments":[{"kind":"narrator","content":5}]}',
        '{"segments":[{"kind":"narrator","content":"Hi","content":"No"}]}',
        '{"segments":[{"kind":"narrator","content":"Hi","extra":"No"}]}',
        '{"segments":[{"kind":"narrator","content":"\\ud800x"}]}',
        '{"segments":[{"kind":"narrator","content":"Hi"},]}',
    ])('rejects invalid content without a prose fallback: %s', (text) => {
        expect(() => new ChatJsonPreview(roster).feed(text)).toThrow()
    })

    it('applies decoded point and entry budgets', () => {
        expect(() => new ChatJsonPreview(roster).feed(JSON.stringify({ segments: [{ kind: 'narrator', content: 'x'.repeat(4_001) }] }))).toThrow()
        expect(() => new ChatJsonPreview(roster).feed(JSON.stringify({ segments: Array.from({ length: 33 }, () => ({ kind: 'narrator', content: 'x' })) }))).toThrow()
        expect(new ChatJsonPreview(roster).feed(JSON.stringify({ segments: [{ kind: 'narrator', content: '😀'.repeat(3_000) }] }))[0].content).toHaveLength(6_000)
    })
})

describe('readable chat projections', () => {
    it('preserves paragraphs and uses the current localization for thoughts', () => {
        const t = ((_key: string, options: { name: string }) => `${options.name} piensa`) as unknown as TFunction
        expect(segmentsToPlainText([{ kind: 'narrator', content: 'One\n\nTwo' }, { kind: 'thought', speaker_id: 'aria', speaker_name: 'Aria', content: 'Otra vez.' }], t))
            .toBe('One\n\nTwo\n\nAria piensa: Otra vez.')
    })

    it('resolves roster identity once and keeps stable records stable', () => {
        const initial = [{ kind: 'speech' as const, speaker_id: 'aria', content: 'Hi' }]
        const resolved = resolveSegmentIdentity(initial, roster)
        expect(resolved[0]).toMatchObject({ speaker_name: 'Aria', image_url: '/images/aria.webp' })
        expect(resolveSegmentIdentity(resolved, roster)[0]).toBe(resolved[0])
        expect(finalizeResponseSegments(resolved)?.[0]).toBe(resolved[0])
    })

    it('removes streaming only and preserves complete Unicode content', () => {
        expect(finalizeResponseSegments([{ kind: 'narrator', content: 'Hi', streaming: true }])).toEqual([{ kind: 'narrator', content: 'Hi' }])
        expect(safeResponseSegments([{ kind: 'narrator', content: '😀'.repeat(4_001) }])[0].content).toBe('😀'.repeat(4_000))
    })
})
