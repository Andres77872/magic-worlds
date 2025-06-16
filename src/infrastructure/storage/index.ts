/**
 * Storage service - moved from services to infrastructure layer
 */

import type { Character, World, Adventure, TurnEntry } from '../../shared'

class StorageService {
    private readonly STORAGE_KEYS = {
        CHARACTERS: 'magic-worlds-characters',
        WORLDS: 'magic-worlds-worlds',
        TEMPLATE_ADVENTURES: 'magic-worlds-template-adventures',
        IN_PROGRESS_ADVENTURES: 'magic-worlds-in-progress-adventures'
    } as const

    // Character operations
    async loadCharacters(): Promise<Character[]> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEYS.CHARACTERS)
            return stored ? JSON.parse(stored) : []
        } catch (error) {
            console.error('Failed to load characters:', error)
            return []
        }
    }

    async saveCharacters(characters: Character[]): Promise<void> {
        try {
            localStorage.setItem(this.STORAGE_KEYS.CHARACTERS, JSON.stringify(characters))
        } catch (error) {
            console.error('Failed to save characters:', error)
            throw error
        }
    }

    async clearCharacters(): Promise<void> {
        localStorage.removeItem(this.STORAGE_KEYS.CHARACTERS)
    }

    // World operations
    async loadWorlds(): Promise<World[]> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEYS.WORLDS)
            return stored ? JSON.parse(stored) : []
        } catch (error) {
            console.error('Failed to load worlds:', error)
            return []
        }
    }

    async saveWorlds(worlds: World[]): Promise<void> {
        try {
            localStorage.setItem(this.STORAGE_KEYS.WORLDS, JSON.stringify(worlds))
        } catch (error) {
            console.error('Failed to save worlds:', error)
            throw error
        }
    }

    async clearWorlds(): Promise<void> {
        localStorage.removeItem(this.STORAGE_KEYS.WORLDS)
    }

    // Template adventure operations
    async loadTemplateAdventures(): Promise<Adventure[]> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEYS.TEMPLATE_ADVENTURES)
            return stored ? JSON.parse(stored) : []
        } catch (error) {
            console.error('Failed to load template adventures:', error)
            return []
        }
    }

    async saveTemplateAdventures(adventures: Adventure[]): Promise<void> {
        try {
            localStorage.setItem(this.STORAGE_KEYS.TEMPLATE_ADVENTURES, JSON.stringify(adventures))
        } catch (error) {
            console.error('Failed to save template adventures:', error)
            throw error
        }
    }

    async clearTemplateAdventures(): Promise<void> {
        localStorage.removeItem(this.STORAGE_KEYS.TEMPLATE_ADVENTURES)
    }

    // In-progress adventure operations
    async loadInProgressAdventures(): Promise<Adventure[]> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEYS.IN_PROGRESS_ADVENTURES)
            return stored ? JSON.parse(stored) : []
        } catch (error) {
            console.error('Failed to load in-progress adventures:', error)
            return []
        }
    }

    async saveInProgressAdventures(adventures: Adventure[]): Promise<void> {
        try {
            localStorage.setItem(this.STORAGE_KEYS.IN_PROGRESS_ADVENTURES, JSON.stringify(adventures))
        } catch (error) {
            console.error('Failed to save in-progress adventures:', error)
            throw error
        }
    }

    async clearInProgressAdventures(): Promise<void> {
        localStorage.removeItem(this.STORAGE_KEYS.IN_PROGRESS_ADVENTURES)
    }

    // Adventure turns operations
    async loadTurns(adventureId: string): Promise<TurnEntry[]> {
        try {
            const storageKey = `magic-worlds-turns-${adventureId}`
            const stored = localStorage.getItem(storageKey)
            return stored ? JSON.parse(stored) : []
        } catch (error) {
            console.error(`Failed to load turns for adventure ${adventureId}:`, error)
            return []
        }
    }

    async saveTurns(adventureId: string, turns: TurnEntry[]): Promise<void> {
        try {
            const storageKey = `magic-worlds-turns-${adventureId}`
            localStorage.setItem(storageKey, JSON.stringify(turns))
        } catch (error) {
            console.error(`Failed to save turns for adventure ${adventureId}:`, error)
            throw error
        }
    }

    async clearTurns(adventureId: string): Promise<void> {
        try {
            const storageKey = `magic-worlds-turns-${adventureId}`
            localStorage.removeItem(storageKey)
        } catch (error) {
            console.error(`Failed to clear turns for adventure ${adventureId}:`, error)
            throw error
        }
    }
}

export const storage = new StorageService()
