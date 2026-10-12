import { describe, expect, it } from 'vitest'
import { OTHER_WORKSPACE_ID, TEST_COLLECTION_ID, TEST_WORKSPACE_ID } from '@/shared/hooks/testing/workspaceTestUtils'
import {
    buildLibraryHash,
    EMPTY_LIBRARY_ROUTE,
    libraryLocationFor,
    libraryQueryFor,
    libraryQueryKey,
    libraryRouteFromLocation,
    parseLibraryHash,
    typeFilterMatches,
    type LibraryRoute,
} from './libraryUrl'

describe('library URLs (Workspace R1)', () => {
    it('round-trips every field through a canonical hash', () => {
        const route: LibraryRoute = {
            workspaceId: TEST_WORKSPACE_ID,
            collectionId: TEST_COLLECTION_ID,
            query: 'moon dragon',
            typeFilter: 'persona',
            uncollected: false,
            reveal: { cardType: 'character', cardId: 'char_42' },
        }
        const hash = buildLibraryHash(route)
        expect(hash).toBe(
            `#/library?workspace=${TEST_WORKSPACE_ID}&collection=${TEST_COLLECTION_ID}&q=moon+dragon&card_type=character&character_role=persona&reveal=character%3Achar_42`,
        )
        expect(parseLibraryHash(hash)).toEqual(route)
        expect(buildLibraryHash(parseLibraryHash(hash)!)).toBe(hash)
    })

    it('keeps the root minimal and only serializes uncollected at the root', () => {
        expect(buildLibraryHash({ workspaceId: TEST_WORKSPACE_ID })).toBe(`#/library?workspace=${TEST_WORKSPACE_ID}`)
        expect(buildLibraryHash({ workspaceId: null })).toBe('#/library')
        expect(buildLibraryHash({ workspaceId: TEST_WORKSPACE_ID, uncollected: true }))
            .toBe(`#/library?workspace=${TEST_WORKSPACE_ID}&uncollected=true`)
        // A folder and "Only uncollected" are exclusive: the folder wins.
        expect(buildLibraryHash({ workspaceId: TEST_WORKSPACE_ID, collectionId: TEST_COLLECTION_ID, uncollected: true }))
            .toBe(`#/library?workspace=${TEST_WORKSPACE_ID}&collection=${TEST_COLLECTION_ID}`)
        expect(parseLibraryHash(`#/library?collection=${TEST_COLLECTION_ID}&uncollected=true`)?.uncollected).toBe(false)
    })

    it('parses strictly: invalid ids, unknown types and other routes are dropped', () => {
        expect(parseLibraryHash('#/gallery/characters')).toBeNull()
        expect(parseLibraryHash('#/library?workspace=not-a-uuid&collection=nope&card_type=spaceship&reveal=bogus:1')).toEqual({
            ...EMPTY_LIBRARY_ROUTE,
        })
        expect(parseLibraryHash(`#/library?workspace=${OTHER_WORKSPACE_ID}&card_type=adventure_template`)).toMatchObject({
            workspaceId: OTHER_WORKSPACE_ID,
            typeFilter: 'adventure',
        })
        expect(parseLibraryHash(`#/library?q=${'x'.repeat(300)}`)?.query).toHaveLength(200)
    })

    it('sends the server the type pair, search and exclusive collection/uncollected scope', () => {
        expect(libraryQueryFor({ collectionId: null, query: ' elf ', typeFilter: 'character', uncollected: true })).toEqual({
            card_type: 'character',
            character_role: 'character',
            q: 'elf',
            uncollected: true,
        })
        expect(libraryQueryFor({ collectionId: TEST_COLLECTION_ID, query: '', typeFilter: 'adventure', uncollected: true })).toEqual({
            card_type: 'adventure_template',
            collection_id: TEST_COLLECTION_ID,
        })
        const key = libraryQueryKey(TEST_WORKSPACE_ID, { collectionId: null, query: 'elf', typeFilter: 'all', uncollected: false })
        expect(libraryQueryKey(OTHER_WORKSPACE_ID, { collectionId: null, query: 'elf', typeFilter: 'all', uncollected: false })).not.toBe(key)
        expect(libraryQueryKey(TEST_WORKSPACE_ID, { collectionId: null, query: ' elf ', typeFilter: 'all', uncollected: false })).toBe(key)
    })

    it('captures and restores a creation return location', () => {
        const route: LibraryRoute = { ...EMPTY_LIBRARY_ROUTE, workspaceId: TEST_WORKSPACE_ID, query: 'knight', typeFilter: 'world', uncollected: true }
        const location = libraryLocationFor(route, 480)
        expect(location).toEqual({ collectionId: null, query: 'knight', typeFilter: 'world', uncollected: true, scrollY: 480 })
        expect(libraryRouteFromLocation(TEST_WORKSPACE_ID, location)).toEqual({ ...route, reveal: null })
    })

    it('matches type filters for the hidden-by-filter check', () => {
        expect(typeFilterMatches('persona', 'character', 'persona')).toBe(true)
        expect(typeFilterMatches('character', 'character', 'persona')).toBe(false)
        expect(typeFilterMatches('adventure', 'adventure_template')).toBe(true)
        expect(typeFilterMatches('all', 'item')).toBe(true)
        expect(typeFilterMatches('world', 'item')).toBe(false)
    })
})
