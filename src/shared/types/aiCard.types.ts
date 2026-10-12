import type { TextGenerationOptions } from './textGeneration.types'
import type { LlmRequest, LlmExecutionProvenance } from './llm.types'
import type { CardOrganization, OrganizationWarning } from './workspace.types'
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

export interface AiCardRequestOptions extends TextGenerationOptions {
    signal?: AbortSignal
    requestId?: string
    idempotencyKey?: string
    timeoutMs?: number
    llm?: LlmRequest
}

export type AiCardGeneratedResult<T> = T & {
    request_id: string
    llm_execution: LlmExecutionProvenance
    /** Workspace R1: where the saved card landed (server-owned; never written back). */
    organization?: CardOrganization
    /** Requested initial collections deleted while generating; normally empty. */
    organization_warnings?: OrganizationWarning[]
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
    role?: 'character' | 'persona'
    is_default_persona?: boolean
    default_persona_id?: string | null
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
    /** Workspace R1: server-owned placement (read-only; never written back). */
    organization?: CardOrganization
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
    /** Workspace R1: server-owned placement (read-only; never written back). */
    organization?: CardOrganization
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
    /** Workspace R1: server-owned placement (read-only; never written back). */
    organization?: CardOrganization
    [key: string]: unknown
}

export interface ItemCardResponse {
    id: string
    uuid?: string
    name: string
    alias?: string | null
    type?: string | null
    rarity?: string | null
    description: string
    effects?: string[]
    requirements?: string[]
    limitations?: string[]
    origin?: string | null
    value?: string | null
    category?: AiCardCategory[] | null
    triggers?: string[]
    image_url?: string
    theme_song_url?: string
    /** Workspace R1: server-owned placement (read-only; never written back). */
    organization?: CardOrganization
    [key: string]: unknown
}
