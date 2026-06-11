export const AI_CARD_DESCRIPTION_MIN_CHARS = 5
export const AI_CARD_DESCRIPTION_MAX_CHARS = 4000
export const AI_CARD_CLIENT_TIMEOUT_MS = Number(import.meta.env.VITE_AI_CARD_CLIENT_TIMEOUT_MS || 90_000)

export type AiCardPublicCategory =
    | 'description_invalid'
    | 'quota_exceeded'
    | 'generation_in_flight'
    | 'generation_in_progress'
    | 'idempotency_conflict'
    | 'upstream_unavailable'
    | 'timeout'
    | 'invalid_generated_output'
    | 'persistence_failed'
    | 'configuration_unavailable'
    | 'internal'
    | string

export interface AiCardRequestOptions {
    signal?: AbortSignal
    requestId?: string
    idempotencyKey?: string
    timeoutMs?: number
}

export interface AiCardPublicError {
    category: AiCardPublicCategory
    code: string
    message: string
    request_id?: string
    retryable?: boolean
    retry_after_seconds?: number
    action?: string
}

export interface AiCardErrorEnvelope {
    detail: string
    request_id?: string
    error?: AiCardPublicError
}

export interface AiCardCategory {
    name: string
    description?: string
    attributes?: Array<Record<string, string>>
}

export interface CharacterCardResponse {
    id: string
    uuid?: string
    name: string
    race?: string
    description?: string
    /** In-character opening line for 1:1 chat (AI-generated drafts may include it). */
    greeting?: string
    /** Roleplay/system direction for 1:1 chat. */
    system_instructions?: string
    category?: AiCardCategory[] | null
    triggers?: string[]
    image_url?: string
    theme_song_url?: string
    [key: string]: unknown
}

export interface WorldCardResponse {
    id: string
    uuid?: string
    name: string
    type?: string
    description?: string
    category?: AiCardCategory[] | null
    triggers?: string[]
    image_url?: string
    theme_song_url?: string
    [key: string]: unknown
}

export interface AdventureTemplateCardResponse {
    id: string
    uuid?: string
    name: string
    description?: string
    persona?: CharacterCardResponse | null
    characters?: CharacterCardResponse[]
    world?: WorldCardResponse[] | null
    category?: AiCardCategory[] | null
    triggers?: string[]
    image_url?: string
    theme_song_url?: string
    [key: string]: unknown
}

export type CardAssistantCardType = 'character' | 'world' | 'adventure_template'
export type CardAssistantRole = 'system' | 'user' | 'assistant' | 'tool'
export type CardAssistantStatus = 'pending' | 'completed' | 'failed'
export type CardAssistantCardResponse = CharacterCardResponse | WorldCardResponse | AdventureTemplateCardResponse

export interface CardAssistantConversation {
    id?: number
    conversation_id: number
    card_type: CardAssistantCardType
    card_id?: string | null
    title?: string | null
    conversation_version?: number
    active_request_id?: string | null
    active_request_started_at?: string | null
    created_at?: string
    updated_at?: string
}

export interface CardAssistantMessage {
    id?: number
    message_id: number
    conversation_id: number
    sequence_no: number
    sequence?: number
    role: CardAssistantRole
    status: CardAssistantStatus
    content: string
    tool_calls?: unknown
    tool_call_id?: string | null
    tool_name?: string | null
    metadata?: Record<string, unknown>
    created_at?: string
    updated_at?: string
    completed_at?: string | null
}

export interface CardAssistantConversationResponse {
    conversation: CardAssistantConversation
    messages: CardAssistantMessage[]
    card?: CardAssistantCardResponse | null
}

export interface CardAssistantConversationListResponse {
    conversations: CardAssistantConversation[]
}

export interface CardAssistantTurnResponse {
    conversation: CardAssistantConversation
    user_message?: CardAssistantMessage
    assistant_message?: CardAssistantMessage
    tool_message?: CardAssistantMessage | null
    messages?: CardAssistantMessage[]
    card?: CardAssistantCardResponse | null
    applied_actions?: Array<Record<string, unknown>>
}

export type CardAssistantStreamEvent =
    | {
        type: 'user_message'
        request_id?: string
        user_message?: CardAssistantMessage
    }
    | {
        type: 'assistant_delta'
        request_id?: string
        delta: string
    }
    | ({
        type: 'final'
        request_id?: string
    } & CardAssistantTurnResponse)
    | {
        type: 'error'
        request_id?: string
        detail?: string
        error?: {
            category?: string
            code?: string
            message?: string
            request_id?: string
            retryable?: boolean
        }
    }
    | {
        type: 'done'
        request_id?: string
    }

export interface CardAssistantRequestOptions {
    signal?: AbortSignal
    requestId?: string
    timeoutMs?: number
}
