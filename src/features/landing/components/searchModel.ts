/**
 * Dashboard global search — case-insensitive substring matching across every
 * in-memory list the dashboard already holds (sessions, adventure templates,
 * characters, worlds, items, novels). Pure functions so the grouping and caps
 * are unit-testable; the page just memoizes `searchDashboard`.
 */

import type { Character, Item, Story, World } from '@/shared'
import type { ResumeSession } from './resumeModel'
import type { Scene } from './sceneModel'
import { sceneMatchesQuery } from './sceneModel'

/** Per-group render cap — a dashboard teases, the galleries exhaust. */
export const SEARCH_GROUP_CAP = 8

export type DashboardSearchGroup =
    | { key: 'sessions'; labelKey: string; total: number; items: ResumeSession[] }
    | { key: 'adventures'; labelKey: string; total: number; items: Scene[] }
    | { key: 'cast'; labelKey: string; total: number; items: Character[] }
    | { key: 'personas'; labelKey: string; total: number; items: Character[] }
    | { key: 'worlds'; labelKey: string; total: number; items: World[] }
    | { key: 'items'; labelKey: string; total: number; items: Item[] }
    | { key: 'novels'; labelKey: string; total: number; items: Story[] }

export interface DashboardSearchResults {
    active: boolean
    query: string
    /** Total matches across all groups (before per-group caps). */
    total: number
    /** Non-empty groups only, in dashboard intent order. */
    groups: DashboardSearchGroup[]
}

export interface DashboardSearchInput {
    sessions: ResumeSession[]
    scenes: Scene[]
    cast: Character[]
    personas: Character[]
    worlds: World[]
    items: Item[]
    stories: Story[]
}

function matchesAny(q: string, values: Array<string | null | undefined>): boolean {
    return values.some((value) => Boolean(value) && value!.toLowerCase().includes(q))
}

export function sessionMatchesQuery(session: ResumeSession, q: string): boolean {
    return matchesAny(q, [session.title, session.context, session.playingAs, session.snippet])
}

export function characterMatchesQuery(character: Character, q: string): boolean {
    return matchesAny(q, [
        character.name,
        character.race,
        character.class,
        character.description,
        ...(character.triggers ?? []),
    ])
}

export function worldMatchesQuery(world: World, q: string): boolean {
    return matchesAny(q, [world.name, world.type, world.place_type, world.description, ...(world.triggers ?? [])])
}

export function itemMatchesQuery(item: Item, q: string): boolean {
    return matchesAny(q, [item.name, item.alias, item.type, item.rarity, item.description, ...(item.triggers ?? [])])
}

export function storyMatchesQuery(story: Story, q: string): boolean {
    return matchesAny(q, [story.title, story.description])
}

const EMPTY_RESULTS: DashboardSearchResults = { active: false, query: '', total: 0, groups: [] }

export function searchDashboard(query: string, input: DashboardSearchInput): DashboardSearchResults {
    const q = query.trim().toLowerCase()
    if (!q) return EMPTY_RESULTS

    const sessions = input.sessions.filter((session) => sessionMatchesQuery(session, q))
    const scenes = input.scenes.filter((scene) => sceneMatchesQuery(scene, q))
    const cast = input.cast.filter((character) => characterMatchesQuery(character, q))
    const personas = input.personas.filter((character) => characterMatchesQuery(character, q))
    const worlds = input.worlds.filter((world) => worldMatchesQuery(world, q))
    const items = input.items.filter((item) => itemMatchesQuery(item, q))
    const stories = input.stories.filter((story) => storyMatchesQuery(story, q))

    const groups: DashboardSearchGroup[] = []
    if (sessions.length > 0)
        groups.push({ key: 'sessions', labelKey: 'landing.search.groupSessions', total: sessions.length, items: sessions.slice(0, SEARCH_GROUP_CAP) })
    if (scenes.length > 0)
        groups.push({ key: 'adventures', labelKey: 'landing.search.groupAdventures', total: scenes.length, items: scenes.slice(0, SEARCH_GROUP_CAP) })
    if (cast.length > 0)
        groups.push({ key: 'cast', labelKey: 'landing.search.groupCast', total: cast.length, items: cast.slice(0, SEARCH_GROUP_CAP) })
    if (personas.length > 0)
        groups.push({ key: 'personas', labelKey: 'landing.search.groupPersonas', total: personas.length, items: personas.slice(0, SEARCH_GROUP_CAP) })
    if (worlds.length > 0)
        groups.push({ key: 'worlds', labelKey: 'landing.search.groupWorlds', total: worlds.length, items: worlds.slice(0, SEARCH_GROUP_CAP) })
    if (items.length > 0)
        groups.push({ key: 'items', labelKey: 'landing.search.groupItems', total: items.length, items: items.slice(0, SEARCH_GROUP_CAP) })
    if (stories.length > 0)
        groups.push({ key: 'novels', labelKey: 'landing.search.groupNovels', total: stories.length, items: stories.slice(0, SEARCH_GROUP_CAP) })

    const total = sessions.length + scenes.length + cast.length + personas.length + worlds.length + items.length + stories.length

    return { active: true, query: query.trim(), total, groups }
}
