/**
 * 1:1 character chat screen.
 *
 * Reuses the adventure chat engine (InteractionCenterPanel) via a character-mode
 * ChatSessionConfig, collapsed to two panels: a single-character sidebar + the chat.
 * No card-management or adventure-log panels. The active chat is read from DataProvider
 * (mirrors `editingInProgress` for adventures).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterChatCodexCard, CharacterChatSession, TurnEntry } from '../../../shared'
import type { CodexLibraryCardSelection } from '@/features/codex'
import { useNavigation, useData, useAuth } from '../../../app/hooks'
import { LoadingSpinner } from '../../../ui/components'
import { characterChatConfig } from '../../interaction/chatSessionConfig'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { InteractionCenterPanel, InteractionTopBar, SidePanelDrawer } from '../../interaction/components'
import { CallScreen } from '../../call'
import { CharacterChatSidebar } from './CharacterChatSidebar'

export function CharacterChat() {
    const { t } = useTranslation()
    const { goBack, setPage } = useNavigation()
    const {
        activeCharacterChat,
        activeCharacterChatMode,
        editCharacter,
        resumeCharacterChat,
        addCharacterChatCodexCards,
        toggleCharacterChatCodexCard,
        removeCharacterChatCodexCard,
    } = useData()
    const { isAuthenticated, openLoginModal } = useAuth()

    // Gate behind auth — unauthenticated users cannot access chat.
    useEffect(() => {
        if (!isAuthenticated) {
            openLoginModal()
            setPage('landing')
        }
    }, [isAuthenticated, openLoginModal, setPage])

    // No active chat (e.g. deep link / refresh) → back to the dashboard.
    useEffect(() => {
        if (isAuthenticated && !activeCharacterChat) {
            setPage('landing')
        }
    }, [isAuthenticated, activeCharacterChat, setPage])

    if (!isAuthenticated) {
        return null
    }
    const activeCast = activeCharacterChat?.characters?.length
        ? activeCharacterChat.characters
        : activeCharacterChat?.character
          ? [activeCharacterChat.character]
          : []
    if (!activeCharacterChat || activeCast.length === 0) {
        return <LoadingSpinner message={t('characterChat.loading')} />
    }

    const handleBack = () => goBack('landing')
    const handleEditCharacter = (character: CharacterChatSession['character']) => {
        if (!character) return
        editCharacter(character)
        setPage('character')
    }
    const voiceEnabled = isFrontendVoiceModeEnabled()
    const mode = activeCharacterChatMode === 'voice' && voiceEnabled ? 'voice' : 'text'
    // Flip the active chat between text and voice — text renders the chat engine, voice
    // renders the immersive CallScreen (below), each keyed so they mount/unmount cleanly.
    const handleSetMode = (next: 'text' | 'voice') => resumeCharacterChat(activeCharacterChat, { mode: next })

    // Voice mode is its own immersive, hands-free surface — it never mounts the text
    // chat engine or socket. Keyed by id so changing character remounts cleanly.
    if (mode === 'voice') {
        return (
            <CallScreen
                key={`${activeCharacterChat.id}:voice`}
                character={activeCast[0]}
                persona={activeCharacterChat.persona}
                sessionId={Number(activeCharacterChat.id)}
                onSwitchToText={() => handleSetMode('text')}
            />
        )
    }

    // Keyed by chat id: switching characters remounts the view so its `turns` seed
    // (and the socket) reset cleanly — no derived-state effect needed.
    return (
        <CharacterChatView
            key={`${activeCharacterChat.id}:text`}
            chat={activeCharacterChat}
            voiceEnabled={voiceEnabled}
            onAddCodexCards={(cards) => addCharacterChatCodexCards(activeCharacterChat.id, cards)}
            onToggleCodexCard={(card, enabled) => toggleCharacterChatCodexCard(activeCharacterChat.id, card.id, enabled)}
            onRemoveCodexCard={(card) => removeCharacterChatCodexCard(activeCharacterChat.id, card.id)}
            onSetMode={handleSetMode}
            onBack={handleBack}
            onEditCharacter={handleEditCharacter}
        />
    )
}

interface CharacterChatViewProps {
    chat: CharacterChatSession
    voiceEnabled: boolean
    onAddCodexCards: (cards: CodexLibraryCardSelection[]) => Promise<unknown>
    onToggleCodexCard: (card: CharacterChatCodexCard, enabled: boolean) => Promise<unknown>
    onRemoveCodexCard: (card: CharacterChatCodexCard) => Promise<unknown>
    onSetMode: (mode: 'text' | 'voice') => void
    onBack: () => void
    onEditCharacter: (character: CharacterChatSession['character']) => void
}

function CharacterChatView({
    chat,
    voiceEnabled,
    onAddCodexCards,
    onToggleCodexCard,
    onRemoveCodexCard,
    onSetMode,
    onBack,
    onEditCharacter,
}: CharacterChatViewProps) {
    const { t } = useTranslation()
    const cast = chat.characters?.length ? chat.characters : chat.character ? [chat.character] : []
    const isGroup = chat.kind === 'character_group' || cast.length > 1
    const chatTitle = chat.title?.trim() || cast.map((character) => character.name).filter(Boolean).join(', ') || t('characterChat.fallbackTitle')
    // Seed from the chat the provider built (greeting + history); the center panel
    // re-hydrates from the server on socket open too.
    const [turns, setTurns] = useState<TurnEntry[]>(chat.turns ?? [])
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // Text-only here — voice is its own CallScreen surface. Stable config per character.
    const chatConfig = useMemo(
        () => characterChatConfig(chatTitle, { group: isGroup }),
        [chatTitle, isGroup],
    )

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-ink-800 lg:flex-row">
            <InteractionTopBar
                title={chatTitle}
                mode="chat"
                onToggleLeft={() => setSidebarOpen((v) => !v)}
                leftOpen={sidebarOpen}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden lg:flex-row">
                {/* Left: single-character sidebar */}
                <SidePanelDrawer side="left" open={sidebarOpen} onClose={() => setSidebarOpen(false)} label={t('characterChat.sidebarLabel')}>
                    <CharacterChatSidebar
                        sessionId={chat.id}
                        character={cast[0]}
                        characters={cast}
                        title={chatTitle}
                        isGroup={isGroup}
                        persona={chat.persona}
                        mode="text"
                        voiceEnabled={voiceEnabled}
                        codexCards={chat.codexCards ?? []}
                        onAddCodexCards={onAddCodexCards}
                        onToggleCodexCard={onToggleCodexCard}
                        onRemoveCodexCard={onRemoveCodexCard}
                        onSetMode={onSetMode}
                        onBack={onBack}
                        onEditCharacter={onEditCharacter}
                    />
                </SidePanelDrawer>

                {/* Center: the shared chat engine, in character mode */}
                <div className="min-w-0 flex-1">
                    <InteractionCenterPanel
                        sessionId={Number(chat.id)}
                        turns={turns}
                        setTurns={setTurns}
                        config={chatConfig}
                    />
                </div>
            </div>
        </div>
    )
}
