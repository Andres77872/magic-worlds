import { describe, expect, it } from 'vitest'
import type { LorebookEntry } from '@/shared'
import { buildTriggerMatcher, scanText, segmentText, type SessionLoreEntry } from './loreTriggers'

function entry(partial: Partial<LorebookEntry> & { keys: string[]; id?: string }): LorebookEntry {
    return {
        id: partial.id ?? 'e1',
        lorebookId: 'lb1',
        title: partial.title ?? 'Entry',
        entryType: 'other',
        content: '',
        secondaryKeys: [],
        selectiveLogic: 'any',
        enabled: true,
        constant: false,
        caseSensitive: false,
        matchWholeWords: true,
        regex: false,
        isSecret: false,
        insertionOrder: 0,
        priority: 0,
        insertionPosition: 'before_context',
        ...partial,
    }
}

function session(e: LorebookEntry, lorebookName = 'Glass Courts'): SessionLoreEntry {
    return { entry: e, lorebookId: e.lorebookId, lorebookName }
}

describe('loreTriggers.scanText', () => {
    it('finds a whole-word match with exact offsets and original casing', () => {
        const matcher = buildTriggerMatcher([session(entry({ keys: ['Iron Citadel'] }))])
        const matches = scanText('The Iron Citadel stands tall.', matcher)
        expect(matches).toHaveLength(1)
        expect(matches[0]).toMatchObject({ start: 4, end: 16, keyword: 'Iron Citadel', lorebookName: 'Glass Courts' })
    })

    it('respects whole-word boundaries', () => {
        const matcher = buildTriggerMatcher([session(entry({ keys: ['Iron'] }))])
        expect(scanText('Ironclad armor', matcher)).toHaveLength(0)
        expect(scanText('an Iron gate', matcher)).toHaveLength(1)
    })

    it('is case-insensitive by default but honors caseSensitive', () => {
        const insensitive = buildTriggerMatcher([session(entry({ keys: ['iron'] }))])
        expect(scanText('IRON', insensitive)).toHaveLength(1)
        const sensitive = buildTriggerMatcher([session(entry({ keys: ['iron'], caseSensitive: true }))])
        expect(scanText('IRON', sensitive)).toHaveLength(0)
    })

    it('prefers the longest match when keys overlap (non-overlapping result)', () => {
        const matcher = buildTriggerMatcher([
            session(entry({ id: 'a', keys: ['Iron'] })),
            session(entry({ id: 'b', keys: ['Iron Citadel'] })),
        ])
        const matches = scanText('Iron Citadel', matcher)
        expect(matches).toHaveLength(1)
        expect(matches[0].keyword).toBe('Iron Citadel')
    })

    it('supports regex keys', () => {
        const matcher = buildTriggerMatcher([session(entry({ keys: ['colou?r'], regex: true }))])
        expect(scanText('color and colour', matcher)).toHaveLength(2)
    })

    it('skips disabled, secret, and keyless entries', () => {
        const matcher = buildTriggerMatcher([
            session(entry({ id: 'off', keys: ['alpha'], enabled: false })),
            session(entry({ id: 'secret', keys: ['beta'], isSecret: true })),
            session(entry({ id: 'empty', keys: [] })),
        ])
        expect(scanText('alpha beta gamma', matcher)).toHaveLength(0)
    })

    it('returns nothing for a null/empty matcher', () => {
        expect(scanText('anything', null)).toEqual([])
        expect(scanText('', buildTriggerMatcher([session(entry({ keys: ['x'] }))]))).toEqual([])
    })
})

describe('loreTriggers.segmentText', () => {
    it('splits text into plain and matched segments', () => {
        const matcher = buildTriggerMatcher([session(entry({ keys: ['Iron'] }))])
        const text = 'go to Iron now'
        const segments = segmentText(text, scanText(text, matcher))
        expect(segments.map((s) => s.text)).toEqual(['go to ', 'Iron', ' now'])
        expect(segments[1].match?.keyword).toBe('Iron')
        expect(segments[0].match).toBeUndefined()
    })

    it('returns a single plain segment when there are no matches', () => {
        expect(segmentText('plain text', [])).toEqual([{ text: 'plain text' }])
    })
})
