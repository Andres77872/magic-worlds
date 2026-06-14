import { describe, expect, it } from 'vitest'
import type { PageType } from '@/shared'
import {
    buildGalleryModeHash,
    buildGalleryViewHash,
    buildSharedCardHash,
    pageFromHash,
    pageHash,
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
