import { describe, expect, it } from 'vitest'
import type { PageType } from '@/shared'
import {
    buildCardEditHash,
    buildGalleryModeHash,
    buildGalleryViewHash,
    buildSharedCardHash,
    pageFromHash,
    pageHash,
    parseCardEditHash,
    parseGalleryHash,
    parseSharedCardToken,
} from './galleryLinks'

const STATIC_PAGE_HASHES: Array<[PageType, string]> = [
    ['chatroom', '#/chatroom'],
    ['active-adventures', '#/active-adventures'],
    ['community', '#/community'],
    ['admin-voices', '#/admin/voices'],
    ['about', '#/about'],
    ['contact', '#/contact'],
    ['privacy', '#/privacy'],
    ['disclaimer', '#/disclaimer'],
]

describe('galleryLinks static page routes', () => {
    it.each(STATIC_PAGE_HASHES)('maps %s to %s and back', (page, hash) => {
        expect(pageHash(page)).toBe(hash)
        expect(pageFromHash(hash)).toBe(page)
    })
})

describe('galleryLinks gallery routes', () => {
    it('parses shared card links without dropping the card id', () => {
        expect(parseGalleryHash('#/gallery/characters?card=c99')).toEqual({
            type: 'character',
            page: 'gallery-characters',
            cardId: 'c99',
            mode: undefined,
            view: undefined,
        })
    })

    it('builds and parses character group selection mode links', () => {
        const hash = buildGalleryModeHash('character', 'group-chat')

        expect(hash).toBe('#/gallery/characters?mode=group-chat')
        expect(parseGalleryHash(hash)).toEqual({
            type: 'character',
            page: 'gallery-characters',
            cardId: undefined,
            mode: 'group-chat',
            view: undefined,
        })
    })

    it('builds and parses public gallery view links', () => {
        const hash = buildGalleryViewHash('world', 'public')

        expect(hash).toBe('#/gallery/worlds?view=public')
        expect(parseGalleryHash(hash)).toEqual({
            type: 'world',
            page: 'gallery-worlds',
            cardId: undefined,
            mode: undefined,
            view: 'public',
        })
    })

    it('builds and parses unlisted shared card tokens', () => {
        const hash = buildSharedCardHash('token/with spaces')

        expect(hash).toBe('#/shared/token%2Fwith%20spaces')
        expect(parseSharedCardToken(hash)).toBe('token/with spaces')
        expect(pageFromHash(hash)).toBe('shared-card')
    })
})

describe('galleryLinks card-editor routes', () => {
    it('builds and parses a bare card-edit hash', () => {
        const hash = buildCardEditHash('character', 'char-1')
        expect(hash).toBe('#/character?card=char-1')
        expect(parseCardEditHash(hash)).toEqual({
            page: 'character',
            cardType: 'character',
            cardId: 'char-1',
            version: undefined,
        })
        // The page still resolves to the bare creator page.
        expect(pageFromHash(hash)).toBe('character')
    })

    it('round-trips the version selector (draft / latest / number)', () => {
        for (const [version, raw] of [['draft', 'draft'], ['latest', 'latest'], [7, '7']] as const) {
            const hash = buildCardEditHash('world', 'w-1', version)
            expect(hash).toBe(`#/world?card=w-1&version=${raw}`)
            expect(parseCardEditHash(hash)).toMatchObject({ cardType: 'world', cardId: 'w-1', version })
        }
    })

    it('normalizes a bad version to undefined and ignores non-card-edit hashes', () => {
        expect(parseCardEditHash('#/item?card=i-1&version=garbage')?.version).toBeUndefined()
        expect(parseCardEditHash('#/item?card=i-1&version=0')?.version).toBeUndefined()
        // No `card` param → not a card-edit route (the bare create page).
        expect(parseCardEditHash('#/character')).toBeNull()
        // `#/character-chat` must not be mistaken for the character editor.
        expect(parseCardEditHash('#/character-chat?card=x')).toBeNull()
        expect(parseCardEditHash('#/gallery/characters?card=c1')).toBeNull()
    })

    it('keeps the bare creator page resolving to "character" (create mode)', () => {
        expect(pageFromHash('#/character')).toBe('character')
        expect(pageFromHash('#/character?card=char-1')).toBe('character')
    })
})
