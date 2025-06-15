export type Character = {
  id: string
  name: string
  race: string
  stats: Record<string, string>
}

export type World = {
  id: string
  name: string
  type: string
  details: Record<string, string>
}

export type Adventure = {
  id: string
  scenario: string
  characters: Character[]
  worlds: World[]
}

/**
 * A complete turn of user input and AI response in an adventure.
 */
export interface TurnEntry {
  number: number
  user: string
  assistant: string
}

/**
 * A single chat message in the adventure conversation.
 */
export interface Message {
  role: 'user' | 'assistant'
  content: string
}