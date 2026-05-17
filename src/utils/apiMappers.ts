/**
 * Utility functions to map API data structures to local application types
 */

import type { Adventure, Character, World } from '../shared/types'

/**
 * Map API adventure template to local Adventure type
 */
export function mapApiTemplateToAdventure(apiTemplate: any): Adventure {
    return {
        id: apiTemplate.id || apiTemplate.uuid || '',
        scenario: apiTemplate.name || apiTemplate.description || 'Untitled Adventure',
        characters: mapApiCharacters(apiTemplate.characters || []) || [],
        world: mapApiWorld(apiTemplate.world),
        turns: [],
        status: 'draft',
        createdAt: apiTemplate.created_at,
        updatedAt: apiTemplate.updated_at
    }
}

/**
 * Map API character to local Character type
 */
export function mapApiCharacter(apiCharacter: any): Character {
    return {
        id: apiCharacter.id || apiCharacter.uuid || '',
        name: apiCharacter.name || 'Unknown',
        race: apiCharacter.race || '',
        stats: {},
        description: apiCharacter.description || ''
    }
}

/**
 * Map array of API characters to local Character type
 */
export function mapApiCharacters(apiCharacters: any[]): Character[] {
    return apiCharacters.map(mapApiCharacter)
}

/**
 * Map API world to local World type
 */
export function mapApiWorld(apiWorld: any): World | undefined {
    if (!apiWorld) return undefined
    
    // API returns array of worlds, take the first one
    if (Array.isArray(apiWorld)) {
        if (apiWorld.length === 0) return undefined
        apiWorld = apiWorld[0]
    }
    
    return {
        id: apiWorld.id || apiWorld.uuid || '',
        name: apiWorld.name || 'Unknown World',
        type: apiWorld.type || '',
        description: apiWorld.description || '',
        details: {}
    }
}

/**
 * Map array of API adventure templates to local Adventure type
 */
export function mapApiTemplatesToAdventures(apiTemplates: any[]): Adventure[] {
    return apiTemplates.map(mapApiTemplateToAdventure)
}
