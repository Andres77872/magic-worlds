/**
 * 1:1 character chat screen.
 *
 * Reuses the adventure chat engine (InteractionCenterPanel) via a character-mode
 * ChatSessionConfig, collapsed to two panels: a single-character sidebar + the chat.
 * No card-management or adventure-log panels. The active chat is read from DataProvider
 * (mirrors `editingInProgress` for adventures).
 */

import { useEffect, useMemo, useState } from 'react'
import type { CharacterChatSession, TurnEntry } from '../../../shared'
import { Menu } from 'lucide-react'
import { useNavigation, useData, useAuth } from '../../../app/hooks'
import { LoadingSpinner } from '../../../ui/components'
import { cx, IconButton } from '../../../ui/primitives'
import { characterChatConfig } from '../../interaction/chatSessionConfig'
import { InteractionCenterPanel } from '../../interaction/components'
import { CharacterChatSidebar } from './CharacterChatSidebar'

export function CharacterChat() {
    const { previousPage, setPage } = useNavigation()
    const { activeCharacterChat, editCharacter } = useData()
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
    if (!activeCharacterChat || !activeCharacterChat.character) {
        return <LoadingSpinner message="Loading chat..." />
    }

    const handleBack = () => setPage(previousPage || 'landing')
    const handleEdit = () => {
        editCharacter(activeCharacterChat.character!)
        setPage('character')
    }

    // Keyed by chat id: switching characters remounts the view so its `turns` seed
    // (and the socket) reset cleanly — no derived-state effect needed.
    return (
        <CharacterChatView
            key={activeCharacterChat.id}
            chat={activeCharacterChat}
            onBack={handleBack}
            onEdit={handleEdit}
        />
    )
}

interface CharacterChatViewProps {
    chat: CharacterChatSession
    onBack: () => void
    onEdit: () => void
}

function CharacterChatView({ chat, onBack, onEdit }: CharacterChatViewProps) {
    const character = chat.character!
    // Seed from the chat the provider built (greeting + history); the center panel
    // re-hydrates from the server on socket open too.
    const [turns, setTurns] = useState<TurnEntry[]>(chat.turns ?? [])
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    // Stable per-character config so the chat engine's callbacks/effects don't churn.
    const chatConfig = useMemo(() => characterChatConfig(character.name ?? ''), [character.name])

    // Close sidebar on escape (mobile drawer).
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsSidebarOpen(false)
        }
        document.addEventListener('keydown', handleEscape)
        return () => document.removeEventListener('keydown', handleEscape)
    }, [])

    const toggleBtn = 'absolute top-3 left-3 z-30 border border-parchment-50/10 bg-ink-700/80 backdrop-blur lg:hidden'
    const panelBase =
        'character-chat__panel fixed inset-0 z-20 bg-ink-900/60 backdrop-blur-sm transition-opacity ' +
        'lg:static lg:inset-auto lg:z-auto lg:w-[320px] lg:shrink-0 lg:bg-transparent lg:backdrop-blur-none lg:opacity-100 lg:pointer-events-auto'
    const panelContent =
        'h-full w-[320px] max-w-[85%] overflow-y-auto bg-ink-900 transition-transform lg:max-w-none lg:translate-x-0'

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (window.innerWidth <= 768) {
            const target = e.target as HTMLElement
            if (target.classList.contains('character-chat__panel')) setIsSidebarOpen(false)
        }
    }

    return (
        <div className="relative flex h-full overflow-hidden bg-ink-800">
            <IconButton
                label="Toggle character details"
                className={cx(toggleBtn, isSidebarOpen && 'border-ember-500/45 text-ember-400')}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                aria-expanded={isSidebarOpen}
            >
                <Menu size={18} strokeWidth={1.75} />
            </IconButton>

            {/* Left: single-character sidebar */}
            <div
                className={cx(panelBase, isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0 lg:opacity-100 lg:pointer-events-auto')}
                onClick={handleBackdropClick}
            >
                <div className={cx(panelContent, 'border-r border-parchment-50/10', isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
                    <CharacterChatSidebar character={character} onBack={onBack} onEdit={onEdit} />
                </div>
            </div>

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
    )
}
