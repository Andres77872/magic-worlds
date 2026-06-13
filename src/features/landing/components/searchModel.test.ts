import { describe, expect, it } from 'vitest'
import type { Character, Item, Story, World } from '@/shared'
import type { ResumeSession } from './resumeModel'
import type { Scene } from './sceneModel'
import { SEARCH_GROUP_CAP, searchDashboard, type DashboardSearchInput } from './searchModel'

function character(name: string, overrides: Partial<Character> = {}): Character {
    return { id: name, name, race: 'human', stats: {}, ...overrides } as Character
}

function world(name: string, overrides: Partial<World> = {}): World {
    return { id: name, name, type: 'forest', details: {}, ...overrides } as World
}

function item(name: string, overrides: Partial<Item> = {}): Item {
    return { id: name, name, description: '', effects: [], requirements: [], limitations: [], ...overrides } as Item
}

function story(title: string): Story {
    return { id: title, title, scenes: [], activeCardRefs: [], activeContext: {} } as unknown as Story
}

function scene(title: string): Scene {
    return { template: { id: title } as Scene['template'], title, description: '', tags: [], monogram: 'X' }
}

function session(title: string, overrides: Partial<ResumeSession> = {}): ResumeSession {
    return {
        kind: 'adventure',
        id: title,
        title,
        meta: '',
        updatedAtMs: 0,
        source: { id: title } as ResumeSession['source'],
        ...overrides,
    }
}

function input(overrides: Partial<DashboardSearchInput> = {}): DashboardSearchInput {
    return { sessions: [], scenes: [], cast: [], personas: [], worlds: [], items: [], stories: [], ...overrides }
}

describe('searchModel', () => {
    it('is inactive for blank queries', () => {
        const results = searchDashboard('   ', input({ cast: [character('Lyra')] }))
        expect(results.active).toBe(false)
        expect(results.groups).toEqual([])
        expect(results.total).toBe(0)
    })

    it('matches across groups case-insensitively and omits empty groups', () => {
        const results = searchDashboard('EMBER', input({
            sessions: [session('The ember road'), session('Quiet harbor')],
            cast: [character('Emberlyn')],
            worlds: [world('The Ember Coast')],
            items: [item('Plain dagger')],
        }))
        expect(results.active).toBe(true)
        expect(results.groups.map((group) => group.key)).toEqual(['sessions', 'cast', 'worlds'])
        expect(results.total).toBe(3)
    })

    it('matches characters by triggers and items by rarity', () => {
        const byTrigger = searchDashboard('moonlit', input({ cast: [character('Wren', { triggers: ['moonlit grove'] })] }))
        expect(byTrigger.groups[0]?.items).toHaveLength(1)

        const byRarity = searchDashboard('legendary', input({ items: [item('Old key', { rarity: 'Legendary' })] }))
        expect(byRarity.groups[0]?.items).toHaveLength(1)
    })

    it('matches sessions by snippet and persona', () => {
        const results = searchDashboard('stranger', input({
            sessions: [session('Inn at dusk', { snippet: 'A stranger waits by the fire.' })],
        }))
        expect(results.total).toBe(1)
    })

    it('caps rendered items per group but reports the full total', () => {
        const many = Array.from({ length: SEARCH_GROUP_CAP + 4 }, (_, i) => scene(`Ember tale ${i}`))
        const results = searchDashboard('ember', input({ scenes: many }))
        expect(results.groups[0]?.items).toHaveLength(SEARCH_GROUP_CAP)
        expect(results.groups[0]?.total).toBe(SEARCH_GROUP_CAP + 4)
        expect(results.total).toBe(SEARCH_GROUP_CAP + 4)
    })

    it('keeps groups in dashboard intent order', () => {
        const results = searchDashboard('a', input({
            stories: [story('A tale')],
            items: [item('Amulet')],
            worlds: [world('Avalon')],
            personas: [character('Ava')],
            cast: [character('Aram')],
            scenes: [scene('A quiet start')],
            sessions: [session('An open door')],
        }))
        expect(results.groups.map((group) => group.key)).toEqual([
            'sessions', 'adventures', 'cast', 'personas', 'worlds', 'items', 'novels',
        ])
    })
})
