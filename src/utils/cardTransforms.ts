/**
 * Raw API card rows → typed local entities. Shared by DataProvider (dashboard
 * lists) and the gallery pages (server-searched/paginated lists) so both
 * produce identical objects.
 */

import type { Adventure, Character, Item, World } from '../shared'
import { readWorldPlaceType } from '../shared'

/**
 * List endpoints return arrays, but a non-array can slip through (e.g. terminal
 * auth expiry degrades a GET to `{}`); guard so `.map` never throws and callers
 * render an empty state.
 */
export const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

/** The raw API row fields the transforms read (cards share one body shape). */
interface RawCardRow {
    id?: string
    uuid?: string
    name?: string
    description?: string
    alias?: string | null
    role?: Character['role']
    is_default_persona?: boolean
    race?: string
    place_type?: string
    placeType?: string
    type?: string
    rarity?: string | null
    effects?: string[]
    requirements?: string[]
    limitations?: string[]
    origin?: string | null
    value?: string | null
    category?: Character['category']
    triggers?: string[]
    greeting?: string
    system_instructions?: string
    image_url?: string
    theme_song_url?: string
    persona?: Character
    characters?: Character[]
    world?: World[]
    createdAt?: string
    updatedAt?: string
    created_at?: string
    updated_at?: string
}

export function transformCharacters(raw: unknown): Character[] {
    return (asArray(raw) as RawCardRow[]).map((char) => ({
        id: (char.id || char.uuid) as string,
        name: char.name as string,
        role: char.role === 'persona' ? 'persona' : 'character',
        is_default_persona: Boolean(char.is_default_persona),
        race: char.race || '',
        description: char.description || '',
        stats: {},
        category: char.category,
        triggers: char.triggers ?? [],
        greeting: char.greeting,
        system_instructions: char.system_instructions,
        image_url: char.image_url,
        theme_song_url: char.theme_song_url,
        createdAt: char.createdAt ?? char.created_at,
        updatedAt: char.updatedAt ?? char.updated_at,
    }))
}

export function transformWorlds(raw: unknown): World[] {
    return (asArray(raw) as RawCardRow[]).map((world) => ({
        id: (world.id || world.uuid) as string,
        name: world.name as string,
        place_type: readWorldPlaceType(world),
        type: world.type || '',
        description: world.description || '',
        details: {},
        category: world.category,
        triggers: world.triggers ?? [],
        image_url: world.image_url,
        theme_song_url: world.theme_song_url,
        createdAt: world.createdAt ?? world.created_at,
        updatedAt: world.updatedAt ?? world.updated_at,
    }))
}

export function transformTemplates(raw: unknown): Adventure[] {
    return (asArray(raw) as RawCardRow[]).map((template) => ({
        id: (template.id || template.uuid) as string,
        scenario: (template.description || template.name) as string,
        persona: template.persona || undefined,
        characters: template.characters || [],
        world: template.world?.[0] || undefined,
        objectives: {},
        notes: {},
        category: template.category,
        triggers: template.triggers ?? [],
        image_url: template.image_url,
        theme_song_url: template.theme_song_url,
        createdAt: template.createdAt ?? template.created_at,
        updatedAt: template.updatedAt ?? template.updated_at,
    }))
}

export function transformItems(raw: unknown): Item[] {
    return (asArray(raw) as RawCardRow[]).map((item) => ({
        id: (item.id || item.uuid) as string,
        name: item.name as string,
        alias: item.alias ?? null,
        type: item.type ?? '',
        rarity: item.rarity ?? '',
        description: item.description || '',
        effects: item.effects ?? [],
        requirements: item.requirements ?? [],
        limitations: item.limitations ?? [],
        origin: item.origin ?? '',
        value: item.value ?? '',
        category: item.category,
        triggers: item.triggers ?? [],
        image_url: item.image_url,
        theme_song_url: item.theme_song_url,
        createdAt: item.createdAt ?? item.created_at,
        updatedAt: item.updatedAt ?? item.updated_at,
    }))
}
