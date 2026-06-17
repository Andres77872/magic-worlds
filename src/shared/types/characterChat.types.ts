/**
 * Character chat types.
 *
 * Character chat is a lean conversation with one or more Character cards
 * (character.ai style). It reuses the shared chat transport
 * (`ChatSocketServerMessage`) and the generic `TurnEntry` shape — only the
 * session envelope is its own type.
 */

import type { Character } from './character.types'
import type { TurnEntry } from './adventure.types'

export type CharacterChatCodexCardKind = 'character' | 'world' | 'item' | 'adventure_template'

export interface CharacterChatCodexCard {
    /** Snapshot row id inside the chat's codex_cards array. */
    id: string
    kind: CharacterChatCodexCardKind
    /** Source library card id. */
    cardId: string
    enabled: boolean
    precedence: number
    /** Frozen private copy used by the backend prompt. */
    snapshot: Record<string, unknown>
}

export interface CharacterChatSession {
    /** Chat session id (string form of the backend chat_id). */
    id: string
    /** Backend discriminator. */
    kind?: 'character' | 'character_group'
    /** Source library character this chat was started from. */
    character_id?: string
    /** Source library characters this group chat was started from. */
    character_ids?: string[]
    /** Source library card used as the player's persona for this chat. */
    persona_id?: string
    /** Generated title for multi-character rooms. */
    title?: string
    /** The frozen character (name/description/greeting/persona) for the sidebar. */
    character?: Character
    /** Frozen AI cast for group chats. */
    characters?: Character[]
    /** The frozen user/player persona card used in the chat prompt. */
    persona?: Character
    /** Persistent library-card snapshots attached to this chat's private model context. */
    codexCards?: CharacterChatCodexCard[]
    /** Conversation turns (greeting + history), parsed from the session's last_turn. */
    turns?: TurnEntry[]
    createdAt?: string
    updatedAt?: string
}
