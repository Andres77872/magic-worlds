import type {Adventure, Character, TurnEntry, World} from '../types'

// Storage keys
const KEY_CHARACTERS = 'mw_characters'
const KEY_WORLDS = 'mw_worlds'
const KEY_TEMPLATES = 'mw_templates'
const KEY_IN_PROGRESS = 'mw_inProgress'
const KEY_TURNS = 'mw_turns'

// Helper to safely parse JSON
function safeParse<T>(data: string | null, fallback: T): T {
    if (!data) return fallback
    try {
        return JSON.parse(data) as T
    } catch (error) {
        console.error('Error parsing data:', error)
        return fallback
    }
}

/**
 * Storage provider abstraction. Uses localStorage for now,
 * but methods return Promises so they can be swapped
 * out for API calls in the future.
 */
export const storage = {
    // Character operations
    async loadCharacters(): Promise<Character[]> {
        const data = localStorage.getItem(KEY_CHARACTERS)
        const chars = safeParse<Character[]>(data, [])
        return Array.isArray(chars) ? chars : []
    },

    async saveCharacters(chars: Character[]): Promise<void> {
        try {
            localStorage.setItem(KEY_CHARACTERS, JSON.stringify(chars))
        } catch (error) {
            console.error('Failed to save characters:', error)
            throw error
        }
    },

    // World operations
    async loadWorlds(): Promise<World[]> {
        const data = localStorage.getItem(KEY_WORLDS)
        const worlds = safeParse<World[]>(data, [])
        return Array.isArray(worlds) ? worlds : []
    },

    async saveWorlds(worlds: World[]): Promise<void> {
        try {
            localStorage.setItem(KEY_WORLDS, JSON.stringify(worlds))
        } catch (error) {
            console.error('Failed to save worlds:', error)
            throw error
        }
    },

    // Template Adventure operations
    async loadTemplateAdventures(): Promise<Adventure[]> {
        const data = localStorage.getItem(KEY_TEMPLATES)
        const adventures = safeParse<Adventure[]>(data, [])
        return Array.isArray(adventures) ? adventures : []
    },

    async saveTemplateAdventures(advs: Adventure[]): Promise<void> {
        try {
            localStorage.setItem(KEY_TEMPLATES, JSON.stringify(advs))
        } catch (error) {
            console.error('Failed to save template adventures:', error)
            throw error
        }
    },

    // In-progress Adventure operations
    async loadInProgressAdventures(): Promise<Adventure[]> {
        const data = localStorage.getItem(KEY_IN_PROGRESS)
        const adventures = safeParse<Adventure[]>(data, [])
        return Array.isArray(adventures) ? adventures : []
    },

    async saveInProgressAdventures(advs: Adventure[]): Promise<void> {
        try {
            localStorage.setItem(KEY_IN_PROGRESS, JSON.stringify(advs))
        } catch (error) {
            console.error('Failed to save in-progress adventures:', error)
            throw error
        }
    },

    // Turn operations
    async loadTurns(adventureId: string): Promise<TurnEntry[]> {
        try {
            const raw = localStorage.getItem(KEY_TURNS)
            if (!raw) return []

            const all = safeParse<Record<string, TurnEntry[]>>(raw, {})
            return Array.isArray(all[adventureId]) ? all[adventureId] : []
        } catch (error) {
            console.error('Error loading turns:', error)
            return []
        }
    },

    async saveTurns(adventureId: string, turns: TurnEntry[]): Promise<void> {
        try {
            const raw = localStorage.getItem(KEY_TURNS)
            const all = safeParse<Record<string, TurnEntry[]>>(raw, {})
            all[adventureId] = turns
            localStorage.setItem(KEY_TURNS, JSON.stringify(all))
        } catch (error) {
            console.error('Failed to save turns:', error)
            throw error
        }
    },

    /** Remove all stored data for this app */
    async clearAll(): Promise<void> {
        try {
            localStorage.removeItem(KEY_CHARACTERS)
            localStorage.removeItem(KEY_WORLDS)
            localStorage.removeItem(KEY_TEMPLATES)
            localStorage.removeItem(KEY_IN_PROGRESS)
            localStorage.removeItem(KEY_TURNS)
        } catch (error) {
            console.error('Failed to clear storage:', error)
            throw error
        }
    },
}