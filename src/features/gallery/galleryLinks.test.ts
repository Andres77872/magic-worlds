import { describe, expect, it } from 'vitest'
import type { PageType } from '@/shared'
import { pageFromHash, pageHash } from './galleryLinks'

const STATIC_PAGE_HASHES: Array<[PageType, string]> = [
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
