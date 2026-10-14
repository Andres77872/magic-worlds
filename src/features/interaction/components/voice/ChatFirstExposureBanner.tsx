/**
 * "Voices have a new engine" in chat (R1-FE-03; 03 §5.12, 05 §7.6, D35): the
 * Studio's one-time first-exposure notice, shown in a chat or adventure when
 * the session holds a stored V1 voice that now plays through an ElevenLabs
 * projection. It is `VoiceNoticeStack` itself, so the
 * dismissal key (`magic_worlds:voice_first_exposure:v1:{user_hash}`) is the
 * Studio's: dismissing it in either place hides it in both.
 *
 * Renders nothing when the session has no converted voice, or signed out.
 */
import { useMemo } from 'react'
import { useAuth, useData } from '@/app/hooks'
import { VoiceNoticeStack } from '@/features/voices/components/VoiceNoticeStack'
import type { Adventure, CharacterChatSession } from '@/shared/types'
import { hasConvertedVoice, type StoredVoicePair } from './sessionVoiceDrift'

export interface ChatFirstExposureBannerProps {
    kind: 'adventure' | 'character'
    sessionId: number
    className?: string
}

function chatVoices(chat: CharacterChatSession | null | undefined, sessionId: number): StoredVoicePair[] {
    if (!chat || chat.id !== String(sessionId)) return []
    const cast = chat.characters?.length ? chat.characters : chat.character ? [chat.character] : []
    return cast.map((character) => ({ voice: character.voice, effective: character.effective_voice }))
}

function adventureVoices(adventure: Adventure | null | undefined, sessionId: number): StoredVoicePair[] {
    if (!adventure || adventure.id !== String(sessionId)) return []
    const snapshot = adventure.snapshot
    const cast = Array.isArray(snapshot?.template?.characters) ? snapshot.template.characters : []
    return [
        { voice: snapshot?.narrator_voice, effective: snapshot?.effective_narrator_voice },
        ...cast.map((card) => ({ voice: card?.voice, effective: card?.effective_voice })),
    ]
}

export function ChatFirstExposureBanner({ kind, sessionId, className }: ChatFirstExposureBannerProps) {
    const { userHash } = useAuth()
    const { activeCharacterChat, editingInProgress } = useData()
    const converted = useMemo(
        () => hasConvertedVoice(kind === 'adventure' ? adventureVoices(editingInProgress, sessionId) : chatVoices(activeCharacterChat, sessionId)),
        [activeCharacterChat, editingInProgress, kind, sessionId],
    )
    return (
        <VoiceNoticeStack
            userHash={userHash}
            hasConvertedVoice={converted}
            className={className}
        />
    )
}
