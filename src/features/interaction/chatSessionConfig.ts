/**
 * ChatSessionConfig — the small set of differences between an adventure (multi-card,
 * game-master) chat and a 1:1 character chat. The InteractionCenterPanel chat engine
 * is otherwise identical for both: same socket transport, streaming, TTS/image job
 * polling, edit/regenerate/delete. Everything mode-specific is captured here so the
 * ~700-line engine stays single-sourced.
 */

import type { TurnEntry } from '../../shared'
import { apiService } from '../../infrastructure/api'
import { parseTurnState } from '../../utils/turnState'

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
    /** Persist the client's turn mirror for a session id. */
    saveTurns: (sessionId: number, turns: TurnEntry[]) => Promise<void>
    /** Delete one canonical message and return the server-projected turns. */
    deleteMessage: (sessionId: number, messageId: number) => Promise<TurnEntry[]>
    /** Clear all canonical messages and return the server-projected turns. */
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

export function adventureChatConfig(): ChatSessionConfig {
    return {
        kind: 'adventure',
        basePath: 'adventure-sessions',
        loadTurns: async (sessionId) => {
            const session = await apiService.getAdventureSession(sessionId)
            return parseTurnState(session.adventure_last_turn)
        },
        saveTurns: async (sessionId, turns) => {
            await apiService.updateAdventureSession(sessionId, JSON.stringify({ turns }))
        },
        deleteMessage: async (sessionId, messageId) => {
            const session = await apiService.deleteAdventureSessionMessage(sessionId, messageId)
            return parseTurnState(session.adventure_last_turn)
        },
        clearMessages: async (sessionId) => {
            const session = await apiService.clearAdventureSessionMessages(sessionId)
            return parseTurnState(session.adventure_last_turn)
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
            const session = await apiService.getCharacterChat(sessionId)
            return parseTurnState(session.last_turn)
        },
        saveTurns: async (sessionId, turns) => {
            await apiService.updateCharacterChat(sessionId, JSON.stringify({ turns }))
        },
        deleteMessage: async (sessionId, messageId) => {
            const session = await apiService.deleteCharacterChatMessage(sessionId, messageId)
            return parseTurnState(session.last_turn)
        },
        clearMessages: async (sessionId) => {
            const session = await apiService.clearCharacterChatMessages(sessionId)
            return parseTurnState(session.last_turn)
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
