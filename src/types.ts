export interface Character {
  id: string
  name: string
  race: string
  class?: string
  stats: Record<string, string | number>
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface World {
  id: string
  name: string
  type: string
  description?: string
  details: Record<string, string>
  createdAt?: string
  updatedAt?: string
}

export interface Adventure {
  id: string
  scenario: string
  characters: Character[]
  world?: World  // Single world reference instead of array
  turns?: TurnEntry[]
  createdAt?: string
  updatedAt?: string
  status?: 'draft' | 'in-progress' | 'completed' | 'archived'
}

/**
 * A complete turn of user input and AI response in an adventure.
 */
export interface TurnEntry {
  number: number
  userInput: string
  assistantResponse: string
  timestamp?: string
  metadata?: Record<string, any>
}

/**
 * A single chat message in the adventure conversation.
 */
export interface Message {
  isLoading?: boolean;
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  metadata?: Record<string, any>
}

/**
 * Options for card actions in list views
 */
export interface CardOption {
  type: 'custom' | 'edit' | 'delete' | 'start' | 'open'
  icon?: React.ReactNode
  label?: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}