import { describe, expect, it } from 'vitest'

import type { Lorebook, LorebookEntry, StoryCardRef, StoryCardSnapshot } from '@/shared'
import { clonedEntryIds, lorebookEntrySnapshot, snapshotDescription, snapshotLabel } from './codexUtils'

function snapshot(overrides: Partial<StoryCardSnapshot> = {}): StoryCardSnapshot {
    return {
        id: 'card-1',
        name: 'Aria',
        description: 'A ranger',
        story_card_kind: 'character',
        ...overrides,
    }
}

function ref(overrides: Partial<StoryCardRef> = {}): StoryCardRef {
    return {
        id: 'ref-1',
        storyId: 'story-1',
        chapterId: null,
        kind: 'character',
        cardId: 'card-1',
        source: 'manual',
        enabled: true,
        precedence: 0,
        snapshot: snapshot(),
        ...overrides,
    }
}

describe('snapshotLabel', () => {
    it('prefers name, then alias, then cardId', () => {
        expect(snapshotLabel(ref({ snapshot: snapshot({ name: 'Aria', alias: 'Shadow' }) }))).toBe('Aria')
        expect(snapshotLabel(ref({ snapshot: snapshot({ name: null, alias: 'Shadow' }) }))).toBe('Shadow')
        expect(snapshotLabel(ref({ snapshot: snapshot({ name: null, alias: null }) }))).toBe('card-1')
    })
})

describe('snapshotDescription', () => {
    it('reads the stored description', () => {
        expect(snapshotDescription(ref({ snapshot: snapshot({ description: 'A ranger of the gate' }) }))).toBe('A ranger of the gate')
    })
})

describe('lorebookEntrySnapshot', () => {
    const lorebook = { id: 'lb-1', name: 'Twin Courts' } as Lorebook
    const entry = {
        id: 'entry-1',
        lorebookId: 'lb-1',
        title: 'The Glass Pact',
        entryType: 'rule',
        content: 'An oath sworn on shattered mirrors.',
        keys: ['pact', 'mirrors'],
    } as LorebookEntry

    it('produces the exact strict StoryCardSnapshot shape', () => {
        expect(lorebookEntrySnapshot(lorebook, entry)).toEqual({
            id: 'entry-1',
            name: 'The Glass Pact',
            description: 'An oath sworn on shattered mirrors.',
            source_lorebook_id: 'lb-1',
            story_card_kind: 'lorebook_entry',
        })
    })
})

describe('clonedEntryIds', () => {
    it('collects stored snapshot ids for lorebook-entry refs only', () => {
        const refs = [
            ref({
                id: 'a',
                kind: 'lorebook_entry',
                cardId: 'entry-1',
                snapshot: snapshot({ id: 'entry-1', story_card_kind: 'lorebook_entry', source_lorebook_id: 'lb-1' }),
            }),
            ref({ id: 'b' }),
            ref({
                id: 'c',
                kind: 'lorebook_entry',
                cardId: 'entry-2',
                snapshot: snapshot({ id: 'entry-2', story_card_kind: 'lorebook_entry', source_lorebook_id: 'lb-1' }),
            }),
        ]
        expect(clonedEntryIds(refs)).toEqual(new Set(['entry-1', 'entry-2']))
    })
})
