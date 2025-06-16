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
    createdAt?: string
    updatedAt?: string
    status?: AdventureStatus
}

export type AdventureStatus = 'draft' | 'in-progress' | 'completed' | 'archived'

export interface TurnEntry {
    number: number
    userInput: string
    assistantResponse: string
    timestamp?: string
    metadata?: Record<string, any>
}

export interface AdventureFormData {
    scenario: string
    characters: Character[]
    world?: World
}
