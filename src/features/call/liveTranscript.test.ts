import { describe, expect, it } from 'vitest'
import { LIVE_TRANSCRIPT_MAX_LINES, reduceLiveTranscript, type LiveTranscriptEvent, type LiveTranscriptLine } from './liveTranscript'

function run(events: LiveTranscriptEvent[], start: readonly LiveTranscriptLine[] = []): readonly LiveTranscriptLine[] {
    return events.reduce(reduceLiveTranscript, start)
}

const summary = (lines: readonly LiveTranscriptLine[]) => lines.map((line) => `${line.role}:${line.turnId}:${line.text}${line.interrupted ? ':cut' : ''}${line.streaming ? ':…' : ''}`)

describe('reduceLiveTranscript', () => {
    it('keeps the user line and the streamed reply of each turn, in order', () => {
        const lines = run([
            { type: 'user_final', turnId: 't1', text: ' Hello there ' },
            { type: 'assistant_start', turnId: 't1' },
            { type: 'assistant_delta', turnId: 't1', content: 'Well met' },
            { type: 'assistant_delta', turnId: 't1', content: ', traveler.' },
        ])
        expect(summary(lines)).toEqual(['user:t1:Hello there', 'assistant:t1:Well met, traveler.:…'])
        expect(summary(run([{ type: 'assistant_end', turnId: 't1', status: 'completed' }], lines))).toEqual([
            'user:t1:Hello there',
            'assistant:t1:Well met, traveler.',
        ])
    })

    it('replaces an unanswered utterance the server merged into the next turn', () => {
        const lines = run([
            { type: 'user_final', turnId: 't1', text: 'I was thinking' },
            { type: 'user_final', turnId: 't2', text: 'I was thinking we could go north' },
        ])
        expect(summary(lines)).toEqual(['user:t2:I was thinking we could go north'])
    })

    it('appends a new utterance that does not repeat the previous one', () => {
        const lines = run([
            { type: 'user_final', turnId: 't1', text: 'Wait' },
            { type: 'user_final', turnId: 't2', text: 'Never mind' },
        ])
        expect(summary(lines)).toEqual(['user:t1:Wait', 'user:t2:Never mind'])
    })

    it('cuts a reply where playback stopped and marks it interrupted', () => {
        const lines = run([
            { type: 'user_final', turnId: 't1', text: 'Tell me a story' },
            { type: 'assistant_start', turnId: 't1' },
            { type: 'assistant_delta', turnId: 't1', content: 'Once upon a time, in a café far away' },
            { type: 'assistant_interrupted', turnId: 't1' },
            { type: 'assistant_delta', turnId: 't1', content: ' late text' },
            { type: 'assistant_truncate', turnId: 't1', keptChars: 16 },
            { type: 'assistant_end', turnId: 't1', status: 'interrupted' },
        ])
        expect(summary(lines)).toEqual(['user:t1:Tell me a story', 'assistant:t1:Once upon a time:cut'])
    })

    it('drops the empty line of a failed reply but keeps a partial one', () => {
        const failedEmpty = run([
            { type: 'user_final', turnId: 't1', text: 'Hi' },
            { type: 'assistant_start', turnId: 't1' },
            { type: 'assistant_end', turnId: 't1', status: 'failed' },
        ])
        expect(summary(failedEmpty)).toEqual(['user:t1:Hi'])
        const failedPartial = run([
            { type: 'assistant_start', turnId: 't2' },
            { type: 'assistant_delta', turnId: 't2', content: 'Half a' },
            { type: 'assistant_end', turnId: 't2', status: 'failed' },
        ])
        expect(summary(failedPartial)).toEqual(['assistant:t2:Half a'])
    })

    it('ignores frames of unknown turns and returns the same array when nothing changed', () => {
        const lines = run([{ type: 'user_final', turnId: 't1', text: 'Hi' }])
        expect(reduceLiveTranscript(lines, { type: 'assistant_delta', turnId: 'nope', content: 'x' })).toBe(lines)
        expect(reduceLiveTranscript(lines, { type: 'user_final', turnId: 't9', text: '   ' })).toBe(lines)
        expect(reduceLiveTranscript([], { type: 'reset' })).toEqual([])
        expect(run([{ type: 'reset' }], lines)).toEqual([])
    })

    it('settles an older streaming reply when a new one starts and caps the length', () => {
        const lines = run([
            { type: 'assistant_start', turnId: 't1' },
            { type: 'assistant_start', turnId: 't2' },
        ])
        expect(lines.map((line) => line.streaming)).toEqual([false, true])
        expect(run([{ type: 'settle' }], lines).map((line) => line.streaming)).toEqual([false, false])
        let many: readonly LiveTranscriptLine[] = []
        for (let index = 0; index < LIVE_TRANSCRIPT_MAX_LINES + 10; index++) {
            many = reduceLiveTranscript(many, { type: 'user_final', turnId: `u${index}`, text: `line ${index} ${'x'.repeat(index % 3)}#${index}` })
        }
        expect(many).toHaveLength(LIVE_TRANSCRIPT_MAX_LINES)
        expect(many[many.length - 1].turnId).toBe(`u${LIVE_TRANSCRIPT_MAX_LINES + 9}`)
    })
})
