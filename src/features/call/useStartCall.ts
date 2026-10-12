/**
 * useStartCall — the single shared entry point for launching a character VOICE call.
 *
 * Used by the Calls page, character gallery cards, and the chat header. Character-card
 * calls open a local 1:1 character-chat draft, then flip it into voice mode and
 * navigate to the chat page (which mounts the immersive CallScreen). Saved chat/call
 * surfaces can resume an existing session in voice mode. Final call transcripts are
 * saved server-side and surfaced in the Calls history. The chat is created after
 * the user accepts consent and grants microphone access.
 */

import { useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { WorkspaceContext, type WorkspaceScopeCapture } from '@/app/providers/workspaceContext'
import type { Character, CharacterChatSession } from '@/shared'
import { isCallsFeatureEnabled } from '@/shared/featureFlags'
import { defaultPersonaForCharacter } from '@/utils/characterRoles'
import { errorMessage } from '@/utils/errors'

export interface UseStartCall {
    /** Start a fresh voice call with a character. Opens the persona picker first
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


export function useStartCall(): UseStartCall {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { characters, startCharacterChat, resumeCharacterChat } = useData()
    const { setPage } = useNavigation()
    // Workspace R1: a launch captures its workspace before any async work; a call
    // whose chat finished creating after a switch never opens in the new workspace.
    // The context is optional: call buttons also render in isolated surfaces
    // (stories, page tests) with no workspace, where there is nothing to switch.
    const workspace = useContext(WorkspaceContext)
    const workspaceEpoch = workspace?.workspaceEpoch ?? 0
    const capture = (): WorkspaceScopeCapture | null => workspace?.capture() ?? null
    const isCurrent = (scope: WorkspaceScopeCapture | null): boolean => (workspace ? workspace.isCurrent(scope) : true)

    const [startingId, setStartingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pendingCharacter, setPendingCharacter] = useState<Character | null>(null)
    const [personaPickConfirming, setPersonaPickConfirming] = useState(false)
    const [personaPickError, setPersonaPickError] = useState<string | null>(null)

    // A committed switch closes a pending persona pick of the previous workspace.
    const [launchEpoch, setLaunchEpoch] = useState(workspaceEpoch)
    if (launchEpoch !== workspaceEpoch) {
        setLaunchEpoch(workspaceEpoch)
        setPendingCharacter(null)
        setPersonaPickError(null)
        setError(null)
    }

    // Open the call in voice mode. startCharacterChat resets the mode to 'text', so the
    // voice flip MUST happen after it resolves and before navigation (keyed remount).
    const launchVoice = (chat: CharacterChatSession) => {
        if (!isCallsFeatureEnabled()) {
            setError(t('call.start.error'))
            return
        }
        resumeCharacterChat(chat, { mode: 'voice' })
        setPage('character-chat')
    }

    const beginCall = async (character: Character) => {
        const persona = defaultPersonaForCharacter(character, characters)
        if (!persona) {
            setPendingCharacter(character)
            return
        }
        if (startingId) return
        const scope = capture()
        setError(null)
        setStartingId(character.id)
        try {
            const chat = await startCharacterChat(character, persona)
            if (isCurrent(scope)) launchVoice(chat)
        } catch (err) {
            console.error('Failed to start voice call:', err)
            if (isCurrent(scope)) setError(errorMessage(err, t('call.start.error')))
        } finally {
            setStartingId((current) => (current === character.id ? null : current))
        }
    }

    const startCall = (character: Character) => {
        if (!isCallsFeatureEnabled()) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        void beginCall(character)
    }

    const resumeCall = (chat: CharacterChatSession) => {
        if (!isCallsFeatureEnabled()) return
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        launchVoice(chat)
    }

    const confirmPersonaPick = async (persona: Character) => {
        const character = pendingCharacter
        if (!character || personaPickConfirming) return
        const scope = capture()
        setPersonaPickError(null)
        setPersonaPickConfirming(true)
        try {
            const chat = await startCharacterChat(character, persona)
            if (!isCurrent(scope)) return
            setPendingCharacter(null)
            launchVoice(chat)
        } catch (err) {
            if (isCurrent(scope)) setPersonaPickError(errorMessage(err, t('call.start.error')))
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
