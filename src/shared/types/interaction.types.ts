/**
 * Interaction and messaging types
 */

export interface Message {
    isLoading?: boolean
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp?: string
    metadata?: Record<string, any>
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatState {
    messages: Message[]
    isLoading: boolean
    error?: string
}
