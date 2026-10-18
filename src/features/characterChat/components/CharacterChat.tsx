import { useFeatureFlags } from '@/shared/hooks/useFeatureFlags'
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
import { characterChatConfig } from '../../interaction/chatSessionConfig'
import { useSessionWorkspace } from '../../interaction/hooks/useSessionWorkspace'
import { organizationWorkspaceId } from '@/shared/hooks/useScopedApi'
import { LoadingSpinner } from '../../../ui/components'
import { isCallsFeatureEnabled } from '@/shared/featureFlags'
import { InteractionCenterPanel, InteractionTopBar, SidePanelDrawer } from '../../interaction/components'
import { CallScreen } from '../../call'
import { chatDisplayTitle } from '@/utils/chatTitle'
import { CharacterChatSidebar } from './CharacterChatSidebar'
import { SessionSceneNarration } from '@/features/interaction/components/SceneNarrationPanel'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'

export function CharacterChat() {
    useFeatureFlags()
    const { goBack, setPage } = useNavigation()
    const {
        activeCharacterChat,
        activeCharacterChatMode,
        editCharacter,
        resumeCharacterChat,
        ensureCharacterChatSession,
        addCharacterChatCodexCards,
        toggleCharacterChatCodexCard,
        removeCharacterChatCodexCard,
    } = useData()
    const { isAuthenticated } = useAuth()
    const activeCast = activeCharacterChat?.characters?.length
        ? activeCharacterChat.characters
        : activeCharacterChat?.character
          ? [activeCharacterChat.character]
          : []
    const hasActiveChat = Boolean(activeCharacterChat && activeCast.length > 0)

    // Detail route fallback: page navigation is allowed, but an active chat is
    // required before mounting the socket-backed chat surface. An empty cast is
    // also unavailable, not an in-flight load that a spinner could wait for.
    useEffect(() => {
        if (!isAuthenticated || !hasActiveChat) {
            setPage('chatroom')
        }
    }, [isAuthenticated, hasActiveChat, setPage])

    if (!isAuthenticated || !activeCharacterChat || activeCast.length === 0) {
        return null
    }

    const handleBack = () => goBack('landing')
    const handleEditCharacter = (character: CharacterChatSession['character']) => {
        if (!character) return
        editCharacter(character)
        setPage('character')
    }
    const voiceEnabled = isCallsFeatureEnabled()
    // Calls are 1:1 (group calls are planned): a group chat always opens as text,
    // even when a stale voice intent survives.
    const isGroupChat = activeCharacterChat.kind === 'character_group' || activeCast.length > 1
    const mode = activeCharacterChatMode === 'voice' && voiceEnabled && !isGroupChat ? 'voice' : 'text'
    // Flip the active chat between text and voice — text renders the chat engine, voice
    // renders the immersive CallScreen (below), each keyed so they mount/unmount cleanly.
    const handleSetMode = (next: 'text' | 'voice') => resumeCharacterChat(activeCharacterChat, { mode: next })

    // Voice mode is its own immersive, hands-free surface — it never mounts the text
    // chat engine or socket. Keyed by id so changing character remounts cleanly.
    if (mode === 'voice') {
        return (
            <CallScreen
                key={`${activeCharacterChat.draftId ?? activeCharacterChat.id}:voice`}
                character={activeCast[0]}
                sessionId={Number(activeCharacterChat.id)}
                workspaceId={organizationWorkspaceId(activeCharacterChat)}
                ensureSession={activeCharacterChat.isDraft ? () => ensureCharacterChatSession(activeCharacterChat) : undefined}
                onSwitchToText={() => handleSetMode('text')}
            />
        )
    }

    // Keyed by chat id: switching characters remounts the view so its `turns` seed
    // (and the socket) reset cleanly — no derived-state effect needed.
    return (
        <CharacterChatView
            key={`${activeCharacterChat.draftId ?? activeCharacterChat.id}:text`}
            chat={activeCharacterChat}
            voiceEnabled={voiceEnabled}
            ensureSession={activeCharacterChat.isDraft ? () => ensureCharacterChatSession(activeCharacterChat) : undefined}
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
    ensureSession?: () => Promise<number>
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
    ensureSession,
    onAddCodexCards,
    onToggleCodexCard,
    onRemoveCodexCard,
    onSetMode,
    onBack,
    onEditCharacter,
}: CharacterChatViewProps) {
    useFeatureFlags()
    const { t } = useTranslation()
    const cast = useMemo(
        () => (chat.characters?.length ? chat.characters : chat.character ? [chat.character] : []),
        [chat.characters, chat.character],
    )
    const isGroup = chat.kind === 'character_group' || cast.length > 1
    const chatTitle = chatDisplayTitle(chat) || t('characterChat.fallbackTitle')
    // Seed from the chat the provider built (greeting + history); the center panel
    // re-hydrates from the server on socket open too.
    const [turns, setTurns] = useState<TurnEntry[]>(chat.turns ?? [])
    const [sidebarOpen, setSidebarOpen] = useState(false)
    // Workspace R1: the chat keeps its own workspace (this view remounts per chat).
    const { workspaceId: sessionWorkspaceId, api: sessionApi } = useSessionWorkspace(organizationWorkspaceId(chat))
    const readOnly = useWorkspaceReadOnly(sessionWorkspaceId)

    // Text-only here — voice is its own CallScreen surface. Stable config per character.
    const chatConfig = useMemo(
        () => (sessionWorkspaceId && sessionApi
            ? characterChatConfig({ workspaceId: sessionWorkspaceId, api: sessionApi }, chatTitle, { group: isGroup })
            : null),
        [chatTitle, isGroup, sessionApi, sessionWorkspaceId],
    )
    // Cast identities for segment attribution: persisted turns only keep
    // speaker_id/speaker_name, so portraits resolve from this roster (segment
    // speaker_id is the card id on both sides).
    const speakerRoster = useMemo(
        () => cast.map((character) => ({
            speaker_id: character.id,
            name: character.name,
            image_url: character.image_url ?? null,
        })),
        [cast],
    )

    return (
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-ink-800 lg:flex-row">
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
                        sessionId={chat.isDraft ? undefined : chat.id}
                        sessionWorkspaceId={sessionWorkspaceId}
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
                        sceneNarration={sessionApi && !chat.isDraft ? <SessionSceneNarration api={sessionApi} basePath="character-chats"
                            sessionId={Number(chat.id)} turns={turns} revision={JSON.stringify(cast.map(card => [card.id, card.voice]))} readOnly={readOnly} /> : null}
                    />
                </SidePanelDrawer>

                {/* Center: the shared chat engine, in character mode */}
                <div className="min-w-0 flex-1">
                    {chatConfig ? <InteractionCenterPanel
                        sessionId={Number(chat.id)}
                        ensureSession={ensureSession}
                        turns={turns}
                        setTurns={setTurns}
                        config={chatConfig}
                        llmFeature={chat.kind === 'character_group' ? 'chat_group' : 'chat_character'}
                        speakerRoster={speakerRoster}
                        isGroupChat={chat.kind === 'character_group'}
                    /> : <LoadingSpinner />}
                </div>
            </div>
        </div>
    )
}
