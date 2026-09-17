/**
 * Chatroom — start a conversation or return to a saved character chat.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { MessageCircle, MessageCirclePlus, Search, Users, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { Character, CharacterChatSession } from '@/shared'
import { EmptyState, ConfirmDialog, LoadingSpinner } from '@/ui/components'
import { Button, Icon, IconButton, IconTile, Input, PageHeader, Toast } from '@/ui/primitives'
import { ResumeCard } from '@/features/landing/components/ResumeCard'
import { toResumeSessions, type ResumeSession } from '@/features/landing/components/resumeModel'
import { buildGalleryModeHash } from '@/features/gallery/galleryLinks'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'
import { isGroupChatsFeatureEnabled } from '@/shared/featureFlags'
import { chatDisplayTitle } from '@/utils/chatTitle'
import { searchableText } from '@/features/landing/components/resumeModel'
import { NewCharacterChatDialog } from './NewCharacterChatDialog'

interface ActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

function chatTitle(chat: CharacterChatSession | null, t: TFunction): string {
    return chatDisplayTitle(chat) || t('characterChat.room.thisChat')
}

export function ChatroomPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        characters,
        characterChats,
        startCharacterChat,
        resumeCharacterChat,
        deleteCharacterChat,
        loadData,
        loadingState,
    } = useData()
    const [query, setQuery] = useState('')
    const [newChatOpen, setNewChatOpen] = useState(false)
    const [refreshing, setRefreshing] = useState(isAuthenticated)
    const [pendingDelete, setPendingDelete] = useState<CharacterChatSession | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)
    const mountedRef = useRef(false)
    const voiceModeEnabled = isFrontendVoiceModeEnabled()
    const groupChatsEnabled = isGroupChatsFeatureEnabled()

    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [])

    useEffect(() => {
        let current = true
        if (isAuthenticated) {
            void loadData({ silent: true }).finally(() => {
                if (current) setRefreshing(false)
            })
        }
        // Refresh the gallery on entry without swapping the whole app to loading.
        return () => { current = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated])

    const refreshLibrary = async () => {
        setRefreshing(true)
        try {
            await loadData({ silent: true })
        } finally {
            setRefreshing(false)
        }
    }

    const requireAuth = (action: () => void) => {
        if (!isAuthenticated) {
            openLoginModal()
            return
        }
        action()
    }

    const visibleChats = useMemo(
        () => groupChatsEnabled ? characterChats : characterChats.filter((chat) => chat.kind !== 'character_group'),
        [characterChats, groupChatsEnabled],
    )
    const sessions = useMemo(() => toResumeSessions([], visibleChats), [visibleChats])
    const normalizedQuery = query.trim().toLowerCase()
    const filteredSessions = useMemo(() => {
        if (!normalizedQuery) return sessions
        return sessions.filter((session) => searchableText(session).includes(normalizedQuery))
    }, [normalizedQuery, sessions])

    const openChat = (session: ResumeSession) => {
        requireAuth(() => {
            resumeCharacterChat(session.source as CharacterChatSession)
            setPage('character-chat')
        })
    }

    const openVoiceChat = (session: ResumeSession) => {
        requireAuth(() => {
            resumeCharacterChat(session.source as CharacterChatSession, { mode: 'voice' })
            setPage('character-chat')
        })
    }

    const startGroupChat = () => {
        if (!groupChatsEnabled) return
        requireAuth(() => setPage('gallery-characters', { hash: buildGalleryModeHash('character', 'group-chat') }))
    }

    const openNewChat = () => requireAuth(() => setNewChatOpen(true))

    const startNewChat = async (character: Character, persona: Character) => {
        await startCharacterChat(character, persona)
        if (!mountedRef.current) return
        setNewChatOpen(false)
        setPage('character-chat')
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        setDeletingId(target.id)
        setActionNotice(null)
        try {
            await deleteCharacterChat(target.id)
            setActionNotice({
                tone: 'success',
                title: t('characterChat.room.chatDeleted'),
                message: chatTitle(target, t),
            })
        } catch (error) {
            console.error('Failed to delete character chat:', error)
            setActionNotice({
                tone: 'error',
                title: t('characterChat.room.deleteFailed'),
                message: error instanceof Error && error.message.trim() ? error.message : t('characterChat.room.tryAgain'),
            })
        } finally {
            setDeletingId(null)
        }
    }

    const hasQuery = query.trim().length > 0
    const emptyAction = hasQuery ? (
        <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
            {t('characterChat.room.clearSearch')}
        </Button>
    ) : isAuthenticated ? (
        <Button variant="primary" size="sm" iconLeft={<Icon icon={MessageCirclePlus} size={15} />} onClick={openNewChat}>
            {t('characterChat.room.newChat')}
        </Button>
    ) : (
        <Button
            variant="primary"
            size="sm"
            iconLeft={<Icon icon={Users} size={15} />}
            onClick={() => setPage('gallery-characters')}
        >
            {t('characterChat.room.findCharacters')}
        </Button>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10" data-testid="chatroom-page">
            <PageHeader
                eyebrow={t('characterChat.room.eyebrow')}
                eyebrowTone="arcane"
                icon={<IconTile icon={MessageCircle} tone="arcane" />}
                title={t('characterChat.room.title')}
                subtitle={t('characterChat.room.subtitle')}
                size="lg"
                actions={
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="primary"
                            iconLeft={<Icon icon={MessageCirclePlus} size={16} />}
                            onClick={openNewChat}
                            aria-haspopup="dialog"
                        >
                            {t('characterChat.room.newChat')}
                        </Button>
                        {groupChatsEnabled && (
                            <Button
                                variant="secondary"
                                iconLeft={<Icon icon={Users} size={16} />}
                                onClick={startGroupChat}
                                className="shrink-0"
                            >
                                {t('characterChat.room.newGroupChat')}
                            </Button>
                        )}
                    </div>
                }
            />

            <div className="relative flex w-full items-center sm:max-w-sm">
                <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                    <Icon icon={Search} size={16} />
                </span>
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setQuery('')
                    }}
                    placeholder={t('characterChat.room.searchPlaceholder')}
                    aria-label={t('characterChat.room.searchLabel')}
                    className="rounded-full pl-10 pr-12"
                />
                {hasQuery && (
                    <IconButton
                        size="sm"
                        label={t('characterChat.room.clearSearch')}
                        onClick={() => setQuery('')}
                        className="absolute right-2"
                    >
                        <Icon icon={X} size={16} />
                    </IconButton>
                )}
            </div>

            <Toast
                open={Boolean(actionNotice)}
                tone={actionNotice?.tone ?? 'success'}
                title={actionNotice?.title}
                message={actionNotice?.message}
                autoCloseMs={actionNotice?.tone === 'success' ? 3200 : false}
                onClose={() => setActionNotice(null)}
            />

            {filteredSessions.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2" data-testid="chatroom-gallery">
                    {filteredSessions.map((session) => (
                        <ResumeCard
                            key={session.id}
                            session={session}
                            onContinue={() => openChat(session)}
                            onCall={voiceModeEnabled && !session.isGroupChat ? () => openVoiceChat(session) : undefined}
                            onDelete={() => requireAuth(() => setPendingDelete(session.source as CharacterChatSession))}
                            deleting={deletingId === session.id}
                        />
                    ))}
                </div>
            ) : isAuthenticated && refreshing && !hasQuery ? (
                <LoadingSpinner message={t('characterChat.room.loading')} />
            ) : loadingState.error && !hasQuery ? (
                // An empty list during a load failure is a misleading "false empty" —
                // show an error with a retry instead of "no chats yet".
                <EmptyState
                    icon={<Icon icon={MessageCircle} size={44} />}
                    message={t('common.loadError')}
                    button={{ label: t('common.tryAgain'), onClick: () => void refreshLibrary() }}
                />
            ) : (
                <EmptyState
                    icon={<Icon icon={MessageCircle} size={44} />}
                    message={hasQuery ? t('characterChat.room.noMatch', { query: query.trim() }) : t('characterChat.room.empty')}
                    secondaryText={hasQuery ? t('characterChat.room.emptyMatchHint') : t('characterChat.room.emptyHint')}
                >
                    {emptyAction}
                </EmptyState>
            )}

            {newChatOpen && isAuthenticated && (
                <NewCharacterChatDialog
                    characters={characters}
                    loading={refreshing || loadingState.isLoading}
                    // Other library endpoints can fail independently. Keep usable
                    // character cards available when their cached list is populated.
                    loadError={characters.length === 0 ? loadingState.error : undefined}
                    onRetry={() => void refreshLibrary()}
                    onStart={startNewChat}
                    onClose={() => setNewChatOpen(false)}
                    onBrowseCharacters={() => {
                        setNewChatOpen(false)
                        setPage('gallery-characters')
                    }}
                />
            )}

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('characterChat.room.deleteTitle')}
                message={t('characterChat.room.deleteConfirm', { name: chatTitle(pendingDelete, t) })}
                confirmLabel={t('common.delete')}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    )
}
