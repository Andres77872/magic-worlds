/**
 * useStartCall — the single shared entry point for launching a character VOICE call.
 *
 * Used by the Calls page, character gallery cards, and the chat header so every "Call"
 * affordance behaves identically. A call reuses the 1:1 character-chats session: it
 * ensures a session exists, flips it into voice mode, and navigates to the chat page
 * (which mounts the immersive CallScreen). Final call transcripts are saved server-side
 * and surfaced in the Calls history.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { Character, CharacterChatSession } from '@/shared'
import { defaultPersona } from '@/utils/characterRoles'

export interface UseStartCall {
    /** Start (or resume) a voice call with a character. Opens the persona picker first
     *  when the user has no default persona. */
    startCall: (character: Character) => void
    /** Resume an existing chat session directly in voice mode (no persona picker). */
    resumeCall: (chat: CharacterChatSession) => void
    /** Id of the character whose call is currently being started (for button spinners). */
    startingId: string | null
    /** Last error message from a failed start, or null. */
    error: string | null
    /** Persona-picker state — wire into <PersonaPickerDialog>. */
    personaPickOpen: boolean
    personaPickConfirming: boolean
    personaPickError: string | null
    confirmPersonaPick: (persona: Character) => Promise<void>
    closePersonaPick: () => void
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() ? error.message : fallback
}

export function useStartCall(): UseStartCall {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { characters, startCharacterChat, resumeCharacterChat } = useData()
    const { setPage } = useNavigation()

    const [startingId, setStartingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pendingCharacter, setPendingCharacter] = useState<Character | null>(null)
    const [personaPickConfirming, setPersonaPickConfirming] = useState(false)
    const [personaPickError, setPersonaPickError] = useState<string | null>(null)

    // Open the call in voice mode. startCharacterChat resets the mode to 'text', so the
    // voice flip MUST happen after it resolves and before navigation (keyed remount).
    const launchVoice = (chat: CharacterChatSession) => {
        resumeCharacterChat(chat, { mode: 'voice' })
        setPage('character-chat')
    }

    const beginCall = async (character: Character) => {
        const persona = defaultPersona(characters)
        if (!persona) {
            setPendingCharacter(character)
            return
        }
        if (startingId) return
        setError(null)
        setStartingId(character.id)
        try {
            const chat = await startCharacterChat(character, persona)
            launchVoice(chat)
        } catch (err) {
            console.error('Failed to start voice call:', err)
            setError(errorMessage(err, t('call.start.error')))
        } finally {
            setStartingId((current) => (current === character.id ? null : current))
        }
    }

    const startCall = (character: Character) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        void beginCall(character)
    }

    const resumeCall = (chat: CharacterChatSession) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        launchVoice(chat)
    }

    const confirmPersonaPick = async (persona: Character) => {
        const character = pendingCharacter
        if (!character || personaPickConfirming) return
        setPersonaPickError(null)
        setPersonaPickConfirming(true)
        try {
            const chat = await startCharacterChat(character, persona)
            setPendingCharacter(null)
            launchVoice(chat)
        } catch (err) {
            setPersonaPickError(errorMessage(err, t('call.start.error')))
        } finally {
            setPersonaPickConfirming(false)
        }
    }

    const closePersonaPick = () => {
        if (personaPickConfirming) return
        setPendingCharacter(null)
        setPersonaPickError(null)
    }

    return {
        startCall,
        resumeCall,
        startingId,
        error,
        personaPickOpen: pendingCharacter !== null,
        personaPickConfirming,
        personaPickError,
        confirmPersonaPick,
        closePersonaPick,
    }
}
