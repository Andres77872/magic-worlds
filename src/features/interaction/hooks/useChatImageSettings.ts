/**
 * The composer's scene image choice for one chat, kept in this browser: images
 * on or off, and the image profile they run on (null = the account default).
 *
 * Stored per chat under `mw:chat-image:<kind>:<sessionId>`. Every change is also
 * remembered as the kind's last-used choice (`mw:chat-image:<kind>:default`),
 * which a chat without its own entry starts from — so a new chat, or a draft
 * that just got its server id, keeps what the player last picked. Images start
 * on. Storage failures (private mode, blocked site data) fall back to memory.
 */
import { useState } from 'react'
import type { ImageProfile } from '@/shared'
import type { ChatImageChoice } from './useAdventureChatSocket'

export type ChatImageSessionKind = 'adventure' | 'character'

export interface ChatImageSettings {
    enabled: boolean
    /** A chosen image profile; null runs on the account default. */
    profileId: string | null
}

export const DEFAULT_CHAT_IMAGE_SETTINGS: ChatImageSettings = { enabled: true, profileId: null }

const PREFIX = 'mw:chat-image:'
// Profile ids are UUIDs; anything else in storage is ignored.
const PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function chatImageSettingsKey(kind: ChatImageSessionKind, sessionId: string): string {
    return `${PREFIX}${kind}:${sessionId}`
}

function lastUsedKey(kind: ChatImageSessionKind): string {
    return `${PREFIX}${kind}:default`
}

function parse(raw: string | null): ChatImageSettings | null {
    if (!raw) return null
    try {
        const value: unknown = JSON.parse(raw)
        if (!value || typeof value !== 'object') return null
        const { enabled, profileId } = value as Record<string, unknown>
        if (typeof enabled !== 'boolean') return null
        return { enabled, profileId: typeof profileId === 'string' && PROFILE_ID.test(profileId) ? profileId : null }
    } catch {
        return null
    }
}

function readKey(key: string): ChatImageSettings | null {
    try {
        return parse(localStorage.getItem(key))
    } catch {
        return null
    }
}

/** The stored choice of a chat, else the kind's last-used one, else images on with the default profile. */
export function readChatImageSettings(kind: ChatImageSessionKind, sessionId: string | null): ChatImageSettings {
    return (sessionId ? readKey(chatImageSettingsKey(kind, sessionId)) : null)
        ?? readKey(lastUsedKey(kind))
        ?? DEFAULT_CHAT_IMAGE_SETTINGS
}

export function writeChatImageSettings(kind: ChatImageSessionKind, sessionId: string | null, settings: ChatImageSettings): void {
    const raw = JSON.stringify(settings)
    try {
        if (sessionId) localStorage.setItem(chatImageSettingsKey(kind, sessionId), raw)
        localStorage.setItem(lastUsedKey(kind), raw)
    } catch {
        // Kept in memory for this visit only.
    }
}

/**
 * The image choice new turns are sent with. A chosen profile that is no longer
 * offered (archived, OpenRouter, gone) falls back to the default instead of
 * sending a stale id; while the profiles are not loaded (`null`) the chosen id
 * is sent as it is. A personal (BYOK) profile names its provider: the socket
 * attaches the key held for it as the frame leaves; without one the server
 * answers `provider_credentials_missing` and the turn offers to add the key.
 */
export function chatImageChoice(settings: ChatImageSettings, profiles: readonly ImageProfile[] | null): ChatImageChoice {
    if (!settings.enabled) return { generate: false }
    if (settings.profileId && profiles === null) return { generate: true, image_profile_id: settings.profileId }
    const profile = settings.profileId ? profiles?.find(item => item.profile_id === settings.profileId) : undefined
    if (!profile) return { generate: true }
    return {
        generate: true,
        image_profile_id: profile.profile_id,
        ...(profile.credential_mode === 'user_byok' ? { byok_provider: profile.provider } : {}),
    }
}

export interface ChatImageSettingsState extends ChatImageSettings {
    setEnabled: (enabled: boolean) => void
    setProfileId: (profileId: string | null) => void
}

/**
 * The chat's image choice. Unlike a lazy `useState` initializer alone, it
 * re-reads storage when the chat changes under a mounted composer.
 */
export function useChatImageSettings(kind: ChatImageSessionKind, sessionId: string | null): ChatImageSettingsState {
    const key = `${kind}|${sessionId ?? ''}`
    const [state, setState] = useState(() => ({ key, settings: readChatImageSettings(kind, sessionId) }))
    let current = state
    if (state.key !== key) {
        current = { key, settings: readChatImageSettings(kind, sessionId) }
        setState(current)
    }

    const update = (patch: Partial<ChatImageSettings>) => {
        const settings = { ...current.settings, ...patch }
        writeChatImageSettings(kind, sessionId, settings)
        setState({ key, settings })
    }

    return {
        ...current.settings,
        setEnabled: enabled => update({ enabled }),
        setProfileId: profileId => update({ profileId }),
    }
}
