import { describe, expect, it } from 'vitest'

import type { Lorebook, LorebookEntry, StoryCardRef } from '@/shared'
import { clonedEntryIds, lorebookEntrySnapshot, snapshotDescription, snapshotLabel } from './codexUtils'

function ref(overrides: Partial<StoryCardRef> = {}): StoryCardRef {
    return {
        id: 'ref-1',
        storyId: 'story-1',
        kind: 'character',
        cardId: 'card-1',
        source: 'manual',
        enabled: true,
        precedence: 0,
        snapshot: null,
        ...overrides,
    }
}

describe('snapshotLabel', () => {
    it('prefers name, then title, then alias, then cardId', () => {
        expect(snapshotLabel(ref({ snapshot: { name: 'Aria', title: 'The Ranger' } }))).toBe('Aria')
        expect(snapshotLabel(ref({ snapshot: { title: 'The Ranger' } }))).toBe('The Ranger')
        expect(snapshotLabel(ref({ snapshot: { alias: 'Shadow' } }))).toBe('Shadow')
        expect(snapshotLabel(ref({ snapshot: {} }))).toBe('card-1')
        expect(snapshotLabel(ref())).toBe('card-1')
    })
})

describe('snapshotDescription', () => {
    it('falls back description → content → race/type → empty', () => {
        expect(snapshotDescription(ref({ snapshot: { description: 'A ranger', content: 'lore' } }))).toBe('A ranger')
        expect(snapshotDescription(ref({ snapshot: { content: 'An oath of mirrors' } }))).toBe('An oath of mirrors')
        expect(snapshotDescription(ref({ snapshot: { race: 'elf' } }))).toBe('elf')
        expect(snapshotDescription(ref())).toBe('')
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

    it('clones entry content into both description and content', () => {
        const snapshot = lorebookEntrySnapshot(lorebook, entry)
        expect(snapshot.name).toBe('The Glass Pact')
        expect(snapshot.title).toBe('The Glass Pact')
        expect(snapshot.description).toBe('An oath sworn on shattered mirrors.')
        expect(snapshot.content).toBe('An oath sworn on shattered mirrors.')
        expect(snapshot.keys).toEqual(['pact', 'mirrors'])
        expect(snapshot.entry_type).toBe('rule')
        expect(snapshot.source_lorebook_id).toBe('lb-1')
        expect(snapshot.source_entry_id).toBe('entry-1')
        expect(snapshot.story_card_kind).toBe('lorebook_entry')
    })
})

describe('clonedEntryIds', () => {
    it('collects source_entry_id values from snapshots', () => {
        const refs = [
            ref({ id: 'a', snapshot: { source_entry_id: 'entry-1' } }),
            ref({ id: 'b', snapshot: { name: 'Aria' } }),
            ref({ id: 'c', snapshot: { source_entry_id: 'entry-2' } }),
        ]
        expect(clonedEntryIds(refs)).toEqual(new Set(['entry-1', 'entry-2']))
    })
})
