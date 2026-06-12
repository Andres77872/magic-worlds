import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const addStoryCardRefs = vi.fn().mockResolvedValue(undefined)
const updateStoryCardRef = vi.fn().mockResolvedValue(undefined)
const deleteStoryCardRef = vi.fn().mockResolvedValue(undefined)

vi.mock('@/app/hooks', () => ({
    useData: () => ({ addStoryCardRefs, updateStoryCardRef, deleteStoryCardRef }),
}))

import type { Lorebook, Story, StoryCardRef } from '@/shared'
import { useCodex } from './useCodex'

function ref(overrides: Partial<StoryCardRef>): StoryCardRef {
    return {
        id: 'ref-x',
        storyId: 's1',
        kind: 'character',
        cardId: 'card-x',
        source: 'manual',
        enabled: true,
        precedence: 0,
        snapshot: null,
        ...overrides,
    }
}

function story(refs: StoryCardRef[]): Story {
    return {
        id: 's1',
        title: 'Glass War',
        scenes: [],
        chapters: [],
        activeCardRefs: refs,
        activeContext: {
            includeSelectedCards: true,
            includeMentionedCards: true,
            includeLorebooks: true,
            includeRecentScenes: 2,
            tokenBudget: 6000,
        },
    }
}

const LOREBOOK = {
    id: 'lb-1',
    name: 'Twin Courts',
    description: null,
    tags: [],
    enabled: true,
    settings: { scanDepth: 8, tokenBudget: 1200, recursiveScanning: false, matchWholeWords: true, caseSensitive: false },
    entries: [
        {
            id: 'entry-1',
            lorebookId: 'lb-1',
            title: 'The Glass Pact',
            entryType: 'rule',
            content: 'An oath sworn on shattered mirrors.',
            keys: ['pact'],
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
        },
        {
            id: 'entry-2',
            lorebookId: 'lb-1',
            title: 'The Mirror Court',
            entryType: 'place',
            content: 'A palace of reflective halls.',
            keys: ['court'],
            secondaryKeys: [],
            selectiveLogic: 'any',
            enabled: false,
            constant: false,
            caseSensitive: false,
            matchWholeWords: true,
            regex: false,
            isSecret: false,
            insertionOrder: 1,
            priority: 0,
            insertionPosition: 'before_context',
        },
    ],
    attachments: [],
} as Lorebook

describe('useCodex', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('derives entries from story-level refs only, sorted by precedence', () => {
        const refs = [
            ref({ id: 'a', precedence: 2, snapshot: { name: 'Aria' } }),
            ref({ id: 'chapter-scoped', chapterId: 'ch1', snapshot: { name: 'Hidden' } }),
            ref({ id: 'b', precedence: 1, kind: 'world', snapshot: { name: 'Eldoria', description: 'A kingdom' } }),
        ]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        expect(result.current.entries.map((entry) => entry.id)).toEqual(['b', 'a'])
        expect(result.current.entries[0]).toMatchObject({ label: 'Eldoria', description: 'A kingdom', kind: 'world' })
        expect(result.current.groups.map((group) => group.label)).toEqual(['Characters', 'Worlds'])
        expect(result.current.existingCardKeys.has('character:card-x')).toBe(true)
    })

    it('addCards posts one batch with continuing precedence and no snapshots', async () => {
        const refs = [ref({ id: 'a', precedence: 4, snapshot: { name: 'Aria' } })]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        await result.current.addCards([
            { kind: 'world', cardId: 'w1' },
            { kind: 'item', cardId: 'i1' },
        ])

        expect(addStoryCardRefs).toHaveBeenCalledTimes(1)
        expect(addStoryCardRefs).toHaveBeenCalledWith('s1', [
            { kind: 'world', cardId: 'w1', source: 'manual', enabled: true, precedence: 5, chapterId: null },
            { kind: 'item', cardId: 'i1', source: 'manual', enabled: true, precedence: 6, chapterId: null },
        ])
    })

    it('cloneLorebookEntries builds one self-contained snapshot per entry', async () => {
        const { result } = renderHook(() => useCodex({ story: story([]) }))

        await result.current.cloneLorebookEntries(LOREBOOK, ['entry-1', 'entry-2'])

        expect(addStoryCardRefs).toHaveBeenCalledTimes(1)
        const [, payloads] = addStoryCardRefs.mock.calls[0]
        expect(payloads).toHaveLength(2)
        expect(payloads[0]).toMatchObject({
            kind: 'lorebook_entry',
            cardId: 'entry-1',
            source: 'manual',
            enabled: true,
            precedence: 0,
            chapterId: null,
        })
        expect(payloads[0].snapshot).toMatchObject({
            name: 'The Glass Pact',
            title: 'The Glass Pact',
            description: 'An oath sworn on shattered mirrors.',
            content: 'An oath sworn on shattered mirrors.',
            keys: ['pact'],
            entry_type: 'rule',
            source_lorebook_id: 'lb-1',
            source_entry_id: 'entry-1',
        })
        // Disabled source entries clone as disabled codex entries.
        expect(payloads[1]).toMatchObject({ cardId: 'entry-2', enabled: false, precedence: 1 })
    })

    it('exposes already-cloned entry ids for the picker', () => {
        const refs = [ref({ id: 'a', kind: 'lorebook_entry', cardId: 'entry-1', snapshot: { source_entry_id: 'entry-1' } })]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        expect(result.current.existingEntryIds).toEqual(new Set(['entry-1']))
    })

    it('toggleEntry flips enabled via a card-ref PUT', async () => {
        const refs = [ref({ id: 'a', enabled: true, snapshot: { name: 'Aria' } })]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        await result.current.toggleEntry(result.current.entries[0])

        expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', { enabled: false })
    })

    it('saveSnapshot merges into the existing snapshot, preserving card fields', async () => {
        const refs = [ref({ id: 'a', snapshot: { name: 'Aria', race: 'elf', image_url: '/aria.png' } })]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        await result.current.saveSnapshot(result.current.entries[0], { label: 'Aria the Red', description: 'A ranger of the gate.' })

        expect(updateStoryCardRef).toHaveBeenCalledWith('s1', 'a', {
            snapshot: {
                name: 'Aria the Red',
                title: 'Aria the Red',
                description: 'A ranger of the gate.',
                race: 'elf',
                image_url: '/aria.png',
            },
        })
    })

    it('saveSnapshot mirrors content for lorebook entries', async () => {
        const refs = [ref({ id: 'a', kind: 'lorebook_entry', cardId: 'entry-1', snapshot: { name: 'Pact', content: 'old', keys: ['pact'] } })]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        await result.current.saveSnapshot(result.current.entries[0], { label: 'Pact', description: 'new text' })

        const [, , payload] = updateStoryCardRef.mock.calls[0]
        expect(payload.snapshot).toMatchObject({ description: 'new text', content: 'new text', keys: ['pact'] })
    })

    it('removeEntry deletes the card ref', async () => {
        const refs = [ref({ id: 'a', snapshot: { name: 'Aria' } })]
        const { result } = renderHook(() => useCodex({ story: story(refs) }))

        await result.current.removeEntry(result.current.entries[0])

        expect(deleteStoryCardRef).toHaveBeenCalledWith('s1', 'a')
    })
})
