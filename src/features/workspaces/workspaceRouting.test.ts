import { setTestFeatureFlags, setAllTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OTHER_WORKSPACE_ID, TEST_WORKSPACE_ID, testWorkspace } from '@/shared/hooks/testing/workspaceTestUtils'
import {
    normalizeRoute,
    preferredLandingPage,
    readNavigationStamp,
    stampedHistoryState,
    stampWorkspaceHash,
    switchDestination,
    NAV_STATE_KEY,
} from './workspaceRouting'

const other = testWorkspace(OTHER_WORKSPACE_ID, 'Novel A', { preferred_use: 'writing' })

describe('workspace routing helpers', () => {
    beforeEach(() => setAllTestFeatureFlags(true))
    afterEach(() => vi.unstubAllEnvs())

    it('maps baseline legacy galleries without any workspace flag', () => {
        setAllTestFeatureFlags(false)
        expect(normalizeRoute('gallery-characters', '#/gallery/characters?card=abc')).toEqual({
            page: 'library', hash: '#/library?card_type=character&character_role=character&reveal=character%3Aabc',
        })
        expect(stampWorkspaceHash('gallery-characters', '#/gallery/characters', TEST_WORKSPACE_ID)).toContain('workspace=')
    })

    it('does not normalize a disabled adventure route into the enabled Library', () => {

        setTestFeatureFlags({ adventures: false })
        expect(normalizeRoute('gallery-adventures', '#/gallery/adventures?card=tpl_1')).toEqual({
            page: 'gallery-adventures', hash: '#/gallery/adventures?card=tpl_1',
        })
    })

    it('maps owned type galleries to the Library with the type filter and a reveal', () => {

        expect(normalizeRoute('gallery-worlds', '#/gallery/worlds')).toEqual({ page: 'library', hash: '#/library?card_type=world' })
        expect(normalizeRoute('gallery-personas', `#/gallery/personas?workspace=${OTHER_WORKSPACE_ID}`)).toEqual({
            page: 'library',
            hash: `#/library?workspace=${OTHER_WORKSPACE_ID}&card_type=character&character_role=persona`,
        })
        expect(normalizeRoute('gallery-adventures', '#/gallery/adventures?card=tpl_1').hash)
            .toBe('#/library?card_type=adventure_template&reveal=adventure_template%3Atpl_1')
        // Public and group-chat views stay galleries.
        expect(normalizeRoute('gallery-characters', '#/gallery/characters?view=public').page).toBe('gallery-characters')
        expect(normalizeRoute('gallery-stories', '#/gallery/stories').page).toBe('gallery-stories')
    })

    it('stamps the workspace on content pages only, never over an existing one', () => {

        expect(stampWorkspaceHash('library', '#/library?q=elf', TEST_WORKSPACE_ID)).toBe(`#/library?workspace=${TEST_WORKSPACE_ID}&q=elf`)
        expect(stampWorkspaceHash('library', `#/library?workspace=${OTHER_WORKSPACE_ID}`, TEST_WORKSPACE_ID))
            .toBe(`#/library?workspace=${OTHER_WORKSPACE_ID}`)
        expect(stampWorkspaceHash('profile', '#/profile', TEST_WORKSPACE_ID)).toBe('#/profile')
    })

    it('lands a switch on list pages in place, records on the preferred page, account pages stay', () => {

        setTestFeatureFlags({ novels: true })
        expect(switchDestination('library', other)).toEqual({ page: 'library', hash: `#/library?workspace=${OTHER_WORKSPACE_ID}` })
        expect(switchDestination('character', other)?.page).toBe(preferredLandingPage(other))
        expect(switchDestination('profile', other)).toBeNull()
        expect(preferredLandingPage(testWorkspace(OTHER_WORKSPACE_ID, 'Play', { preferred_use: 'roleplay' }))).toBe('active-adventures')
        expect(preferredLandingPage(testWorkspace(OTHER_WORKSPACE_ID, 'Sandbox', { preferred_use: 'sandbox' }))).toBe('library')
    })

    it('reads and writes only its own namespaced history state', () => {
        const stamp = { id: 'a', index: 3, workspaceId: TEST_WORKSPACE_ID, hash: '#/library' }
        const state = stampedHistoryState({ other: 1 }, stamp, true)
        expect(state).toEqual({ other: 1, [NAV_STATE_KEY]: stamp })
        expect(stampedHistoryState({ other: 1 }, stamp, false)).toEqual({ [NAV_STATE_KEY]: stamp })
        expect(readNavigationStamp(state)).toEqual(stamp)
        expect(readNavigationStamp({ [NAV_STATE_KEY]: { id: 'a', index: 1.5, hash: '#/' } })).toBeNull()
        expect(readNavigationStamp(null)).toBeNull()
    })
})
