import { describe, expect, it } from 'vitest'
import { parseTurnState } from './turnState'

describe('parseTurnState', () => {
    it('parses canonical projection turns', () => {
        const raw = JSON.stringify({
            source: 'canonical_projection',
            turns: [
                { id: '1', type: 'user', content: 'Hello', timestamp: '' },
                { id: '2', type: 'ai', content: 'Well met.', timestamp: '' },
            ],
        })
        const turns = parseTurnState(raw)
        expect(turns).toHaveLength(2)
        expect(turns[1].content).toBe('Well met.')
    })

    it('returns [] on malformed payloads', () => {
        expect(parseTurnState(undefined)).toEqual([])
        expect(parseTurnState('')).toEqual([])
        expect(parseTurnState('not json')).toEqual([])
        expect(parseTurnState('{"turns": "nope"}')).toEqual([])
    })

    it('flattens raw voice markup on AI turns that carry no parsed segments (interrupted turns)', () => {
        const raw = JSON.stringify({
            turns: [
                {
                    id: '2',
                    type: 'ai',
                    content: '<response><narrator>The door creaks.</narrator><say speaker_id="aria">Who goes',
                    timestamp: '',
                },
            ],
        })
        const [turn] = parseTurnState(raw)
        expect(turn.content).toBe('The door creaks.\nWho goes')
        expect(turn.content).not.toContain('<say')
    })

    it('keeps markup-shaped content untouched when parsed segments exist', () => {
        const raw = JSON.stringify({
            turns: [
                {
                    id: '2',
                    type: 'ai',
                    content: 'Aria: Who goes there?',
                    segments: [{ kind: 'speech', speaker_id: 'aria', speaker_name: 'Aria', content: 'Who goes there?' }],
                    timestamp: '',
                },
            ],
        })
        const [turn] = parseTurnState(raw)
        expect(turn.segments).toHaveLength(1)
        expect(turn.content).toBe('Aria: Who goes there?')
    })

    it('never rewrites user turns', () => {
        const raw = JSON.stringify({
            turns: [{ id: '1', type: 'user', content: 'I typed <say> literally', timestamp: '' }],
        })
        const [turn] = parseTurnState(raw)
        expect(turn.content).toBe('I typed <say> literally')
    })
})
