/**
 * Assistant conversations — one contract for every assistant kind.
 *
 * `card` and `lorebook` edit a saved document through tool calls; `app` is the
 * app-wide guide at `#/assistant` and only answers in Markdown. All of them live
 * under `/assistant/conversations`. The envelope is snake_case; the documents
 * inside `current`/`target` keep their domain shape (the lorebook stays
 * camelCase). Contract: docs/app_assistant/README.md.
 */
import type {
    AdventureTemplateCardResponse,
    CharacterCardResponse,
    ItemCardResponse,
    WorldCardResponse,
} from './aiCard.types'
import type { LlmExecutionProvenance, LlmRequest } from './llm.types'
import type { Lorebook } from './lorebook.types'
import type { StoryStudioIndex } from './storyStudio.types'
import type { StoryAssistantContextRequest } from './storyAssistant.types'
import type { OrganizationWarning, RootOrganization } from './workspace.types'

export type AssistantKind = 'card' | 'lorebook' | 'app' | 'novel'
/** Kinds that edit a saved document and answer with a tool message. */
export type AssistantDocumentKind = 'card' | 'lorebook'
export type AssistantCardType = 'character' | 'world' | 'adventure_template' | 'item'
export type AssistantLlmFeature = `${AssistantKind}_assistant`
export type AssistantCardDocument = CharacterCardResponse | WorldCardResponse | AdventureTemplateCardResponse | ItemCardResponse

interface AssistantTargets {
    card: AssistantCardDocument
    lorebook: Lorebook
    app: never
    novel: StoryStudioIndex
}

/** The saved document a conversation of kind K is bound to. */
export type AssistantTargetOf<K extends AssistantKind> = AssistantTargets[K]

export interface AssistantConversation {
    conversation_id: number
    kind: AssistantKind
    /** Only set for `card`. */
    card_type?: AssistantCardType | null
    card_id?: string | null
    /** Only set for `lorebook`. */
    lorebook_id?: string | null
    /** Required only for a novel-bound conversation. */
    story_id?: string | null
    title?: string | null
    conversation_version?: number
    active_request_id?: string | null
    active_request_started_at?: string | null
    /** Workspace R1: the owning workspace (server-owned; never written back). */
    organization?: RootOrganization
    created_at?: string
    updated_at?: string
}

/** One stored message. `tool` rows only exist for the document kinds. */
export interface AssistantChatMessage {
    message_id: number
    conversation_id: number
    sequence_no: number
    role: 'system' | 'user' | 'assistant' | 'tool'
    status: 'pending' | 'completed' | 'failed'
    content: string
    tool_calls?: unknown
    tool_call_id?: string | null
    tool_name?: string | null
    metadata?: Record<string, unknown>
    created_at?: string
    updated_at?: string
    completed_at?: string | null
}

/** Server snapshot used to reject edits saved by another request during a turn. */
export interface AssistantTargetCas {
    revision: string
    content_hash: string
}

interface AssistantScopes {
    card: { kind: 'card'; card_type: AssistantCardType; card_id?: string | null }
    lorebook: { kind: 'lorebook'; lorebook_id?: string | null }
    app: { kind: 'app' }
    novel: { kind: 'novel'; story_id: string }
}

/** Which conversations a list shows; without a target id it lists the unbound ones. */
export type AssistantConversationScope<K extends AssistantKind = AssistantKind> = AssistantScopes[K]

export type AssistantConversationCreate<K extends AssistantKind = AssistantKind> = AssistantConversationScope<K> & {
    title?: string | null
} & (K extends 'novel' ? { creation_request_id: string } : { creation_request_id?: never })

export interface AssistantConversationResponse<K extends AssistantKind = AssistantKind> {
    conversation: AssistantConversation
    messages: AssistantChatMessage[]
    target: AssistantTargetOf<K> | null
    target_cas: AssistantTargetCas | null
}

export interface AssistantConversationListResponse {
    conversations: AssistantConversation[]
}

/** The part of a completed turn every kind returns. */
export interface AssistantTurnCore {
    request_id: string
    llm_execution: LlmExecutionProvenance
    conversation: AssistantConversation
    user_message: AssistantChatMessage
    assistant_message: AssistantChatMessage
    /** History up to and including the terminal message of this turn. */
    messages: AssistantChatMessage[]
}

/** One mutation the backend performed for a turn (replace/patch of the card or lorebook). */
export interface AssistantAppliedAction {
    type?: string
    target_id?: string
    fields?: string[]
}

interface AssistantDocumentTurn<K extends AssistantDocumentKind> extends AssistantTurnCore {
    tool_message: AssistantChatMessage
    target: AssistantTargetOf<K> | null
    target_cas: AssistantTargetCas | null
    applied_actions: AssistantAppliedAction[]
}

interface AssistantTurns {
    /** Workspace R1: initial collections that were removed before the first card was created. */
    card: AssistantDocumentTurn<'card'> & { organization_warnings?: OrganizationWarning[] }
    lorebook: AssistantDocumentTurn<'lorebook'>
    app: AssistantTurnCore
    novel: AssistantTurnCore
}

export type AssistantTurnResponse<K extends AssistantKind = AssistantKind> = AssistantTurns[K]

interface AssistantTurnBodies {
    novel: {
        kind:'novel'
        refinement?:import('./storyAssistant.types').NovelRefinementReference
        preset?:import('./storyAssistant.types').NovelPresetReference
        source:StoryAssistantContextRequest
        expected_packet_hash:string
        expected_conversation_version:number
        expected_prompt_hash:string
    }
    card: {
        kind: 'card'
        card_type: AssistantCardType
        current?: Record<string, unknown> | null
        expected_revision?: string
        expected_content_hash?: string
    }
    lorebook: {
        kind: 'lorebook'
        current?: Record<string, unknown> | null
        expected_revision?: string
        expected_content_hash?: string
    }
    app: {
        kind: 'app'
        /** Markdown knowledge for this turn only (guide + library digests); never persisted. */
        context: string
        /** Reply language. */
        locale: 'en' | 'es'
        /** Hash route the user opened the assistant from, when known. */
        page?: string | null
    }
}

/** A turn body without `llm`, which the API client adds per attempt. */
export type AssistantTurnRequest<K extends AssistantKind = AssistantKind> = AssistantTurnBodies[K] & {
    /** The user's message, 1–4000 characters. */
    message: string
}

export type AssistantStreamEvent<K extends AssistantKind = AssistantKind> =
    | { type: 'progress'; request_id?: string; stage: 'generating' | 'validating' | 'saving' }
    | { type: 'user_message'; request_id?: string; conversation?: AssistantConversation; user_message?: AssistantChatMessage }
    | { type: 'assistant_delta'; request_id?: string; delta: string }
    | ({ type: 'final'; request_id?: string } & AssistantTurnResponse<K>)
    | {
        type: 'error'
        request_id?: string
        detail?: string
        status_code?: number
        error?: {
            category?: string
            code?: string
            message?: string
            request_id?: string
            retryable?: boolean
        }
    }

/** Reconciliation of one request: `turn` once it completed. */
export interface AssistantTurnStatus<K extends AssistantKind = AssistantKind> {
    status: string
    request_id: string
    recovery_required?: boolean
    execution_id?: string
    turn?: AssistantTurnResponse<K>
}

export interface AssistantRequestOptions {
    llm?: LlmRequest
    signal?: AbortSignal
    requestId?: string
    timeoutMs?: number
}
