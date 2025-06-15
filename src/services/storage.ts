import type { Character, World, Adventure } from '../types'

const KEY_CHARACTERS = 'mw_characters'
const KEY_WORLDS = 'mw_worlds'
const KEY_TEMPLATES = 'mw_templates'
const KEY_IN_PROGRESS = 'mw_inProgress'
const KEY_TURNS = 'mw_turns'

/**
 * Storage provider abstraction. Uses localStorage for now,
 * but methods return Promises so they can be swapped
 * out for API calls in the future.
 */
export const storage = {
  async loadCharacters(): Promise<Character[]> {
    const raw = localStorage.getItem(KEY_CHARACTERS)
    return raw ? JSON.parse(raw) : []
  },
  async saveCharacters(chars: Character[]): Promise<void> {
    localStorage.setItem(KEY_CHARACTERS, JSON.stringify(chars))
  },

  async loadWorlds(): Promise<World[]> {
    const raw = localStorage.getItem(KEY_WORLDS)
    return raw ? JSON.parse(raw) : []
  },
  async saveWorlds(worlds: World[]): Promise<void> {
    localStorage.setItem(KEY_WORLDS, JSON.stringify(worlds))
  },

  async loadTemplateAdventures(): Promise<Adventure[]> {
    const raw = localStorage.getItem(KEY_TEMPLATES)
    return raw ? JSON.parse(raw) : []
  },
  async saveTemplateAdventures(advs: Adventure[]): Promise<void> {
    localStorage.setItem(KEY_TEMPLATES, JSON.stringify(advs))
  },

  async loadInProgressAdventures(): Promise<Adventure[]> {
    const raw = localStorage.getItem(KEY_IN_PROGRESS)
    return raw ? JSON.parse(raw) : []
  },
  async saveInProgressAdventures(advs: Adventure[]): Promise<void> {
    localStorage.setItem(KEY_IN_PROGRESS, JSON.stringify(advs))
  },

  /** Remove all stored data for this app */
  async clearAll(): Promise<void> {
    localStorage.removeItem(KEY_CHARACTERS)
    localStorage.removeItem(KEY_WORLDS)
    localStorage.removeItem(KEY_TEMPLATES)
    localStorage.removeItem(KEY_IN_PROGRESS)
    localStorage.removeItem(KEY_TURNS)
  },
  /**
   * Load saved turns (user/assistant exchanges) for a given adventure.
   */
  async loadTurns(adventureId: string): Promise<any[]> {
    const raw = localStorage.getItem(KEY_TURNS)
    const all = raw ? JSON.parse(raw) : {}
    return all[adventureId] ?? []
  },
  /**
   * Persist turns for a given adventure.
   */
  async saveTurns(adventureId: string, turns: any[]): Promise<void> {
    const raw = localStorage.getItem(KEY_TURNS)
    const all = raw ? JSON.parse(raw) : {}
    all[adventureId] = turns
    localStorage.setItem(KEY_TURNS, JSON.stringify(all))
  },
}