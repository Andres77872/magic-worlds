/**
 * The assistant model shared by every assistant surface: the card creators'
 * and lorebook studio's floating panels and the `#/assistant` page. A kind
 * plugs into `useAssistant` through an adapter of pure functions; the hook owns
 * the conversation, streaming, CAS snapshot, and recovery state.
 */
import type { NovelAssistantTurnPreview } from '@/shared/types/storyAssistant.types'
import type { Lorebook } from '@/shared/types/lorebook.types'
import type {
    AssistantCardType,
    AssistantConversation,
    AssistantConversationScope,
    AssistantKind,
    AssistantTargetCas,
    AssistantTargetOf,
    AssistantTurnRequest,
} from '@/shared/types/assistant.types'
import type { AssistantTurnBase } from './appliedActions'

export type AssistantStatus = 'idle' | 'initializing' | 'switching' | 'streaming'

export interface AssistantNotice {
    kind: 'error' | 'info'
    message: string
    canRetry?: boolean
    canReload?: boolean
}

/** One visible chat turn (user or assistant) as the message list renders it. */
export interface AssistantTurn extends AssistantTurnBase {
    isStreaming: boolean
    isInterrupted: boolean
}

/** What each kind's surface hands the hook on every render. */
export interface AssistantBindings {
    novel:{storyId:string;title:string;preview:NovelAssistantTurnPreview|null}
    card: {
        cardType: AssistantCardType
        /** The saved card being edited; null while it is still a draft form. */
        targetId: string | null
        title: string
        /** The live form payload, including unsaved edits. */
        current: Record<string, unknown>
    }
    lorebook: {
        targetId: string | null
        title: string
        current: Lorebook
    }
    app: {
        /** Markdown knowledge sent with each question (see appKnowledge.ts). */
        context: string
        locale: 'en' | 'es'
        /** Hash route the reader opened the assistant from. */
        page: string | null
    }
}

/** The saved target as the server holds it, read right before a turn is sent. */
export interface AssistantBoundTarget<K extends AssistantKind> {
    target: AssistantTargetOf<K> | null
    cas: AssistantTargetCas
    /** The exact history head read beside this source snapshot. */
    conversation?: AssistantConversation
}

/** Per-kind behavior for `useAssistant`. Module-level constants of pure functions. */
export interface AssistantAdapter<K extends AssistantKind> {
    kind: K
    /**
     * `panel` opens on demand, lists its own scope and resumes the newest (or a
     * handed-off) conversation; `page` is always open, lists every assistant's
     * history and honours a deep link.
     */
    lifecycle: 'panel' | 'page'
    scope: (binding: AssistantBindings[K]) => AssistantConversationScope<K>
    /** Title for a conversation created by the first message. */
    title: (binding: AssistantBindings[K], firstMessage: string) => string
    /** The turn body; `bound` is set when the conversation edits a saved target. */
    turnBody: (binding: AssistantBindings[K], message: string, bound: AssistantBoundTarget<K> | null) => AssistantTurnRequest<K>
}

export function conversationKey(conversation: { conversation_id: number } | null | undefined): number | null {
    return conversation?.conversation_id ?? null
}

/** The saved document a conversation is bound to (only one of the ids is ever set). */
export function conversationTargetId(conversation: AssistantConversation | null | undefined): string | null {
    return conversation?.card_id ?? conversation?.lorebook_id ?? conversation?.story_id ?? null
}

export function scopeTargetId(scope: AssistantConversationScope): string | null {
    if (scope.kind === 'card') return scope.card_id ?? null
    if (scope.kind === 'lorebook') return scope.lorebook_id ?? null
    if (scope.kind === 'novel') return scope.story_id
    return null
}
