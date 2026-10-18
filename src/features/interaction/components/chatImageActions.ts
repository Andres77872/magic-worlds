import { createContext, useContext } from 'react'
import type { ImageProvider } from '../../../shared'
import type { ChatImageRegenerateOptions } from '../hooks/useChatImages'

/** A personal (BYOK) profile that needs the user's provider key before it can run. */
export interface ChatImageKeyRequest {
    provider: ImageProvider
    imageProfileId?: string | null
}

/**
 * What a turn's scene images may do, shared by the chat panel so the memoized
 * `ChatTurn` only takes its `images` view. Without a provider the images render
 * read-only.
 */
export interface ChatImageActions {
    /** New images can be requested: the server supports it and the session is writable. */
    canGenerate: boolean
    regenerate: (assistantMessageId: number, options?: ChatImageRegenerateOptions) => void
    select: (assistantMessageId: number, jobId: string) => void
    /** Asks for the provider key when none is held, then generates on that profile. */
    addKeyAndGenerate?: (assistantMessageId: number, request: ChatImageKeyRequest) => void
    /** Opens one image's prompt, model and metadata. */
    openDetails?: (assistantMessageId: number, jobId: string) => void
}

export const ChatImageActionsContext = createContext<ChatImageActions | null>(null)

export function useChatImageActions(): ChatImageActions | null {
    return useContext(ChatImageActionsContext)
}
