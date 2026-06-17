/**
 * Lorebook domain types.
 *
 * Lorebooks are prompt-retrieval workbooks: metadata controls how a book is
 * considered, entries define activation, and attachments decide where a book
 * participates.
 */

export type LorebookEntryType =
    | 'character'
    | 'world'
    | 'faction'
    | 'place'
    | 'item'
    | 'rule'
    | 'secret'
    | 'quest'
    | 'state'
    | 'relationship'
    | 'other'

export type LorebookSelectiveLogic = 'any' | 'all' | 'and_any' | 'and_all' | 'not_any' | 'not_all'

export type LorebookInsertionPosition = 'before_context' | 'after_context' | 'author_note' | 'system'

export type LorebookTargetKind =
    | 'global'
    | 'character'
    | 'world'
    | 'adventure_template'
    | 'adventure_session'
    | 'character_chat'

export type LorebookAttachmentMode = 'linked' | 'snapshot'

export interface LorebookSettings {
    scanDepth: number
    tokenBudget: number
    recursiveScanning: boolean
    matchWholeWords: boolean
    caseSensitive: boolean
}

export interface LorebookEntry {
    id: string
    lorebookId: string
    title: string
    entryType: LorebookEntryType
    content: string
    keys: string[]
    secondaryKeys: string[]
    selectiveLogic: LorebookSelectiveLogic
    enabled: boolean
    constant: boolean
    caseSensitive: boolean
    matchWholeWords: boolean
    regex: boolean
    isSecret: boolean
    revealCondition?: string | null
    insertionOrder: number
    priority: number
    insertionPosition: LorebookInsertionPosition
    tokenBudget?: number | null
    metadata?: Record<string, unknown>
    createdAt?: string
    updatedAt?: string
}

export interface LorebookAttachment {
    id: string
    lorebookId: string
    targetKind: LorebookTargetKind
    targetId?: string | null
    mode: LorebookAttachmentMode
    snapshot?: Lorebook | null
    createdAt?: string
    updatedAt?: string
}

export interface Lorebook {
    id: string
    name: string
    description?: string | null
    tags: string[]
    enabled: boolean
    settings: LorebookSettings
    entries: LorebookEntry[]
    attachments: LorebookAttachment[]
    metadata?: Record<string, unknown>
    createdAt?: string
    updatedAt?: string
}

export interface LorebookIssue {
    severity: 'info' | 'warning' | 'error'
    code: string
    /** English fallback message; UI prefers a localized lookup keyed by `code` + `messageParams`. */
    message: string
    /** Structured interpolation values (entry titles, keys) for localized message templates. */
    messageParams?: Record<string, string>
    entryId?: string
    fixAction?: string
}

export interface LoreActivationPreviewMessage {
    role: 'user' | 'assistant' | 'system'
    name?: string
    content: string
}

export interface LoreActivationResult {
    entryId: string
    lorebookId: string
    title: string
    matchedKeys: string[]
    status: 'activated' | 'skipped'
    reason?: string
    estimatedTokens: number
    insertionOrder: number
    priority: number
}

export interface LoreActivationPreviewRequest {
    targetKind: LorebookTargetKind
    targetId?: string
    mode: 'adventure' | 'character_chat' | 'continue' | 'regenerate' | 'background'
    messages: LoreActivationPreviewMessage[]
    includePromptPreview?: boolean
    overrides?: {
        lorebookIds?: string[]
        lorebooks?: Lorebook[]
        scanDepth?: number
        tokenBudget?: number
        includeDisabled?: boolean
    }
}

export interface LoreActivationPreviewResponse {
    targetKind: LorebookTargetKind
    targetId?: string
    activeAttachments: LorebookAttachment[]
    results: LoreActivationResult[]
    totalEstimatedTokens: number
    tokenBudget: number
    promptPreview?: string
    issues: LorebookIssue[]
}

export type LorebookEntryDraft = Omit<LorebookEntry, 'id' | 'lorebookId' | 'createdAt' | 'updatedAt'>

export type LorebookDraft = Omit<Lorebook, 'id' | 'entries' | 'attachments' | 'createdAt' | 'updatedAt'> & {
    entries?: LorebookEntryDraft[]
}

export type LorebookAssistantRole = 'system' | 'user' | 'assistant' | 'tool'
export type LorebookAssistantStatus = 'pending' | 'completed' | 'failed'

export interface LorebookAssistantConversation {
    id?: number
    conversation_id: number
    lorebook_id?: string | null
    title?: string | null
    conversation_version?: number
    active_request_id?: string | null
    active_request_started_at?: string | null
    created_at?: string
    updated_at?: string
}

export interface LorebookAssistantMessage {
    id?: number
    message_id: number
    conversation_id: number
    sequence_no: number
    sequence?: number
    role: LorebookAssistantRole
    status: LorebookAssistantStatus
    content: string
    tool_calls?: unknown
    tool_call_id?: string | null
    tool_name?: string | null
    metadata?: Record<string, unknown>
    created_at?: string
    updated_at?: string
    completed_at?: string | null
}

export interface LorebookAssistantConversationResponse {
    conversation: LorebookAssistantConversation
    messages: LorebookAssistantMessage[]
    lorebook?: Lorebook | null
}

export interface LorebookAssistantConversationListResponse {
    conversations: LorebookAssistantConversation[]
}

export interface LorebookAssistantAppliedAction {
    type?: string
    lorebook_id?: string
    fields?: string[]
}

export interface LorebookAssistantTurnResponse {
    conversation: LorebookAssistantConversation
    user_message?: LorebookAssistantMessage
    assistant_message?: LorebookAssistantMessage
    tool_message?: LorebookAssistantMessage | null
    messages?: LorebookAssistantMessage[]
    lorebook?: Lorebook | null
    applied_actions?: LorebookAssistantAppliedAction[]
}

export type LorebookAssistantStreamEvent =
    | {
        type: 'user_message'
        request_id?: string
        user_message?: LorebookAssistantMessage
    }
    | {
        type: 'assistant_delta'
        request_id?: string
        delta: string
    }
    | ({
        type: 'final'
        request_id?: string
    } & LorebookAssistantTurnResponse)
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

export interface LorebookAssistantRequestOptions {
    signal?: AbortSignal
    requestId?: string
    timeoutMs?: number
}
