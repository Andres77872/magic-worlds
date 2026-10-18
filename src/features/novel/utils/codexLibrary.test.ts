import { describe, expect, it } from 'vitest'
import type { StoryCardSnapshot, StoryCodexLibraryReview } from '@/shared'
import { codexFieldReviews, keepsDisplayName, newerLibraryVersion, takenByDefault } from './codexLibrary'

const novel: StoryCardSnapshot = { id: 'c', name: 'Mira', alias: 'The Red', description: 'A ranger', race: 'Elf', type: '', story_card_kind: 'character', source_card_version_number: 3 }
const review = (base: StoryCodexLibraryReview['base']): StoryCodexLibraryReview => ({ refId: 'r', base, sourceVersionId: 'v5',
    current: { id: 'c', name: 'Mira', alias: 'The Bold', description: 'A ranger of the north', race: 'Human', category: [], story_card_kind: 'character', source_card_version_id: 'v5', source_card_version_number: 5 } })

describe('codex library review', () => {
    it('says who changed each detail since the copy was taken', () => {
        const rows = codexFieldReviews(novel, review({ name: 'Mira', alias: 'The Red', description: 'A ranger of the north', race: 'Half-elf' }))
        expect(Object.fromEntries(rows.map((row) => [row.field, row.change]))).toEqual({
            name: 'same', alias: 'updated', description: 'edited', race: 'both', type: 'same', category: 'same' })
        expect(rows.filter((row) => takenByDefault(row.change)).map((row) => row.field)).toEqual(['alias'])
    })

    it('cannot tell who changed a detail once the copied version is gone, so it takes nothing by default', () => {
        const rows = codexFieldReviews(novel, review(null))
        expect(rows.filter((row) => row.change !== 'same').map((row) => row.change)).toEqual(['differs', 'differs', 'differs'])
        expect(rows.some((row) => takenByDefault(row.change))).toBe(false)
    })

    it('keeps a name or an alias and only offers a version newer than the copy', () => {
        const rows = codexFieldReviews({ ...novel, alias: null }, { ...review(null), current: { ...review(null).current, name: null, alias: null } })
        expect(keepsDisplayName(rows, new Set())).toBe(true)
        expect(keepsDisplayName(rows, new Set(['name']))).toBe(false)
        expect(newerLibraryVersion(novel, 5)).toBe(5)
        expect(newerLibraryVersion(novel, 3)).toBeNull()
        expect(newerLibraryVersion(novel, undefined)).toBeNull()
        expect(newerLibraryVersion({ ...novel, source_card_version_number: null }, 1)).toBe(1)
    })
})
