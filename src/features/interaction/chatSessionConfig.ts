/**
 * ChatSessionConfig — the small set of differences between an adventure (multi-card,
 * game-master) chat and a 1:1 character chat. The InteractionCenterPanel chat engine
 * is otherwise identical for both: same socket transport, streaming, TTS/image job
 * polling, edit/regenerate/delete. Everything mode-specific is captured here so the
 * ~700-line engine stays single-sourced.
 */

import type {
    StoredConversationMessage,
    ChatImageAsset,
    ChatImageError,
    ChatResponseSegment,
    ChatTtsSegmentClip,
    ForwardOption,
    TurnEntry,
} from '../../shared'
import { apiService } from '../../infrastructure/api'

export type SessionKind = 'adventure' | 'character'

export interface ChatSessionCopy {
    /** Empty-state heading + body + hint chip shown before the first turn. */
    emptyTitle: string
    emptyBody: string
    emptyHint: string
    /** "Waiting for a response" affordance (when the last turn is the user's). */
    waitingTitle: string
    waitingHint: string
    /** Composer input placeholder. */
    placeholder: string
    /** Streaming hint shown under the composer. */
    loadingHint: string
    /** Confirmation copy for the Reset button. */
    resetConfirm: string
}

export interface ChatSessionConfig {
    kind: SessionKind
    /** WS path segment — must match the backend route ('adventure-sessions' | 'character-chats'). */
    basePath: string
    /** Load + normalize the conversation turns for a session id. */
    loadTurns: (sessionId: number) => Promise<TurnEntry[]>
    /** Update one stored message, then return the authoritative history. */
    updateMessage: (sessionId: number, messageId: number, content: string) => Promise<TurnEntry[]>
    /** Delete one stored message, then return the authoritative history. */
    deleteMessage: (sessionId: number, messageId: number) => Promise<TurnEntry[]>
    /** Clear all stored messages, then return the authoritative history. */
    clearMessages: (sessionId: number) => Promise<TurnEntry[]>
    /** Label shown on AI turns ("Game Master" or the character's name). */
    aiLabel: string
    /** Render the suggested-replies (forwardOptions) UI. */
    showForwardOptions: boolean
    /** Render per-turn generated images. */
    showImages: boolean
    /** localStorage prefix for the auto-narrate toggle (namespaced per kind to avoid id collisions). */
    autoNarrateKeyPrefix: string
    copy: ChatSessionCopy
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
}

/** Project durable conversation rows into the view model consumed by the chat UI. */
export function storedMessagesToTurns(messages: StoredConversationMessage[]): TurnEntry[] {
    return [...messages]
        .sort((left, right) => left.sequence_no - right.sequence_no)
        .map((message) => {
            const metadata = record(message.metadata)
            const turnMetadata = record(metadata.turn_metadata)
            const imageJob = record(metadata.image_job)
            const imageAssets = Array.isArray(metadata.image_assets)
                ? metadata.image_assets as ChatImageAsset[]
                : undefined
            const ttsSegmentsValue = record(metadata.tts_segments)
            const ttsSegments = Object.values(ttsSegmentsValue)
                .filter((value): value is ChatTtsSegmentClip => Boolean(value && typeof value === 'object'))
                .sort((left, right) => left.segment_index - right.segment_index)
            const segments = Array.isArray(metadata.response_segments)
                ? metadata.response_segments as ChatResponseSegment[]
                : undefined
            const displayText = typeof metadata.response_display_text === 'string'
                ? metadata.response_display_text.trim()
                : ''
            const forwardOptions = Array.isArray(turnMetadata.forwardOptions)
                ? turnMetadata.forwardOptions as ForwardOption[]
                : undefined
            const imagePrompt = typeof turnMetadata.imagePrompt === 'string'
                ? turnMetadata.imagePrompt
                : undefined

            return {
                id: String(message.message_id),
                type: message.role === 'assistant' ? 'ai' : message.role,
                content: displayText || message.content,
                timestamp: message.completed_at ?? message.updated_at ?? message.created_at,
                metadata,
                isStreaming: message.status === 'pending' || message.status === 'streaming',
                turnId: message.turn_id,
                ...(message.role === 'assistant' ? { assistantMessageId: message.message_id } : {}),
                ...(segments?.length ? { segments } : {}),
                ...(forwardOptions?.length ? { forwardOptions } : {}),
                ...(imagePrompt ? { imagePrompt } : {}),
                ...(typeof imageJob.job_id === 'string' ? { imageJobId: imageJob.job_id } : {}),
                ...(typeof metadata.image_job_status === 'string' ? { imageStatus: metadata.image_job_status as TurnEntry['imageStatus'] } : {}),
                ...(typeof imageJob.status_url === 'string' ? { imageStatusUrl: imageJob.status_url } : {}),
                ...(typeof imageJob.result_url === 'string' ? { imageResultUrl: imageJob.result_url } : {}),
                ...(imageAssets?.length ? { imageAssets, imageUrl: imageAssets[0]?.url } : {}),
                ...(metadata.image_job_error && typeof metadata.image_job_error === 'object'
                    ? { imageError: metadata.image_job_error as ChatImageError }
                    : {}),
                ...(ttsSegments.length ? { ttsSegments } : {}),
            } satisfies TurnEntry & { forwardOptions?: ForwardOption[] }
        })
}

export function adventureChatConfig(): ChatSessionConfig {
    return {
        kind: 'adventure',
        basePath: 'adventure-sessions',
        loadTurns: async (sessionId) => {
            const history = await apiService.getAdventureSessionMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        updateMessage: async (sessionId, messageId, content) => {
            await apiService.updateAdventureSessionMessage(sessionId, messageId, content)
            const history = await apiService.getAdventureSessionMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        deleteMessage: async (sessionId, messageId) => {
            await apiService.deleteAdventureSessionMessage(sessionId, messageId)
            const history = await apiService.getAdventureSessionMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        clearMessages: async (sessionId) => {
            await apiService.clearAdventureSessionMessages(sessionId)
            const history = await apiService.getAdventureSessionMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        aiLabel: 'Game Master',
        showForwardOptions: true,
        showImages: true,
        autoNarrateKeyPrefix: 'mw:autonarrate:adv:',
        copy: {
            emptyTitle: 'Welcome to your adventure',
            emptyBody: 'Your Game Master narrates the world; describe what your persona does. What will your first action be?',
            emptyHint: 'Be descriptive in your actions to create a more immersive experience.',
            waitingTitle: 'Waiting for Game Master response',
            waitingHint: 'Click to generate an AI response (optional)',
            placeholder: 'What do you do next?',
            loadingHint: 'The Game Master is weaving the tale…',
            resetConfirm: 'Start this adventure over? All story turns will be cleared — your cast, world, and persona are kept.',
        },
    }
}

export function characterChatConfig(characterName: string, opts?: { group?: boolean }): ChatSessionConfig {
    const name = characterName?.trim() || (opts?.group ? 'the group' : 'this character')
    const subject = opts?.group ? 'the group' : name
    return {
        kind: 'character',
        basePath: 'character-chats',
        loadTurns: async (sessionId) => {
            const history = await apiService.getCharacterChatMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        updateMessage: async (sessionId, messageId, content) => {
            await apiService.updateCharacterChatMessage(sessionId, messageId, content)
            const history = await apiService.getCharacterChatMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        deleteMessage: async (sessionId, messageId) => {
            await apiService.deleteCharacterChatMessage(sessionId, messageId)
            const history = await apiService.getCharacterChatMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        clearMessages: async (sessionId) => {
            await apiService.clearCharacterChatMessages(sessionId)
            const history = await apiService.getCharacterChatMessages(sessionId)
            return storedMessagesToTurns(history.messages)
        },
        aiLabel: name,
        showForwardOptions: true,
        showImages: true,
        autoNarrateKeyPrefix: 'mw:autonarrate:char:',
        copy: {
            emptyTitle: opts?.group ? `Group chat with ${name}` : `Chat with ${name}`,
            emptyBody: opts?.group ? `Say hello to ${name} to begin the conversation.` : `Say hello to ${name} to begin your conversation.`,
            emptyHint: opts?.group ? 'Speak naturally — the cast will answer in character.' : 'Speak naturally — this is a one-on-one conversation.',
            waitingTitle: `Waiting for ${subject}`,
            waitingHint: 'Click to generate a reply (optional)',
            placeholder: opts?.group ? 'Message the group…' : `Message ${name}…`,
            loadingHint: opts?.group ? 'The group is responding…' : `${name} is typing…`,
            resetConfirm: `Clear your chat with ${name}? All messages will be deleted.`,
        },
    }
}
