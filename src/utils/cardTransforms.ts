/**
 * Raw API card rows → typed local entities. Shared by DataProvider (dashboard
 * lists) and the gallery pages (server-searched/paginated lists) so both
 * produce identical objects.
 */

import type { Adventure, Character, Item, World } from '../shared'
import type { CardActor, CardVisibility } from '../shared'
import type { StoredCharacterVoice } from '../shared/types/voicePreset.types'
import type { CardOrganization } from '../shared/types/workspace.types'
import { readCardOrganization } from '../infrastructure/api/workspaceContract'
import { keepStoredVoice } from '../shared/voice/parseStoredVoice'
import { readEffectiveVoice } from '../shared/voice/effectiveVoice'

/**
 * Guard list transforms at the boundary so malformed responses never reach
 * component `.map` calls.
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
    default_persona_id?: string | null
    race?: string
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
    voice?: unknown
    /** Read-only projection of `voice` (D35); absent when the server sends none (I-16). */
    effective_voice?: unknown
    visibility?: CardVisibility
    original_creator?: CardActor
    latest_version_id?: string | null
    latest_version_number?: number
    has_draft?: boolean
    draft_updated_at?: string | null
    persona?: Character
    characters?: Character[]
    world?: World[]
    /** Workspace R1 server-owned metadata; kept only when it validates. */
    organization?: unknown
    createdAt?: string
    updatedAt?: string
    created_at?: string
    updated_at?: string
}

/**
 * Preserve a validated read organization on the local entity. It is
 * server-owned: writers build bodies field by field and the API client strips
 * it at the write boundary, so it never reaches drafts, versions or exports.
 */
function organizationOf(row: RawCardRow): { organization?: CardOrganization } {
    const organization = readCardOrganization(row.organization)
    return organization ? { organization } : {}
}

/**
 * Keep the WHOLE stored voice, V1 or V2 (03 §5.1.2): the same object, never a
 * whitelist or a trim, so an unchanged card save re-sends it byte-identical (D32).
 * A non-null voice the client does not recognise is kept too (09 §3.2): display
 * reads it as "no voice", but a save never turns it into `null`.
 */
function readCharacterVoice(value: unknown): StoredCharacterVoice | undefined {
    return keepStoredVoice(value)
}

/** The read-only voice projection (D35), kept for display; the API client strips it before any write. */
function effectiveVoiceOf(row: RawCardRow): { effective_voice?: Character['effective_voice'] } {
    const effective = readEffectiveVoice(row.effective_voice)
    return effective ? { effective_voice: effective } : {}
}

export function transformCharacters(raw: unknown): Character[] {
    return (asArray(raw) as RawCardRow[]).map((char) => ({
        id: (char.id || char.uuid) as string,
        name: char.name as string,
        role: char.role === 'persona' ? 'persona' : 'character',
        is_default_persona: Boolean(char.is_default_persona),
        default_persona_id: char.role !== 'persona' && typeof char.default_persona_id === 'string' && char.default_persona_id.trim()
            ? char.default_persona_id.trim()
            : null,
        race: char.race || '',
        description: char.description || '',
        stats: {},
        category: char.category,
        triggers: char.triggers ?? [],
        greeting: char.greeting,
        system_instructions: char.system_instructions,
        image_url: char.image_url,
        theme_song_url: char.theme_song_url,
        voice: readCharacterVoice(char.voice),
        // Only present when the server sent a projection, so entities without one keep their exact shape.
        ...effectiveVoiceOf(char),
        visibility: char.visibility,
        original_creator: char.original_creator,
        latest_version_id: char.latest_version_id,
        latest_version_number: char.latest_version_number,
        has_draft: char.has_draft,
        draft_updated_at: char.draft_updated_at,
        ...organizationOf(char),
        createdAt: char.createdAt ?? char.created_at,
        updatedAt: char.updatedAt ?? char.updated_at,
    }))
}

export function transformWorlds(raw: unknown): World[] {
    return (asArray(raw) as RawCardRow[]).map((world) => ({
        id: (world.id || world.uuid) as string,
        name: world.name as string,
        type: world.type || '',
        description: world.description || '',
        details: {},
        category: world.category,
        triggers: world.triggers ?? [],
        image_url: world.image_url,
        theme_song_url: world.theme_song_url,
        visibility: world.visibility,
        original_creator: world.original_creator,
        latest_version_id: world.latest_version_id,
        latest_version_number: world.latest_version_number,
        ...organizationOf(world),
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
        visibility: template.visibility,
        original_creator: template.original_creator,
        ...organizationOf(template),
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
        visibility: item.visibility,
        original_creator: item.original_creator,
        latest_version_id: item.latest_version_id,
        latest_version_number: item.latest_version_number,
        ...organizationOf(item),
        createdAt: item.createdAt ?? item.created_at,
        updatedAt: item.updatedAt ?? item.updated_at,
    }))
}
