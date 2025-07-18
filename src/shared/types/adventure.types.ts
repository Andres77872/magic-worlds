/**
 * Adventure domain types and interfaces
 */

import type { Character } from './character.types'
import type { World } from './world.types'

export interface Adventure {
    id: string
    scenario: string
    characters: Character[]
    world?: World
    turns?: TurnEntry[]
    objectives?: Record<string, string>
    notes?: Record<string, string>
    createdAt?: string
    updatedAt?: string
    status?: AdventureStatus
}

export type AdventureStatus = 'draft' | 'in-progress' | 'completed' | 'archived'

export interface TurnEntry {
    id: string
    type: 'user' | 'ai' | 'system'
    content: string
    timestamp: string
    isStreaming?: boolean
    metadata?: Record<string, unknown>
}

export interface AdventureFormData {
    scenario: string
    characters: string[]
    world?: string
}
