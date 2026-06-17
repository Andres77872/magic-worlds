/**
 * Chatroom — full gallery of saved one-on-one character conversations.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { MessageCircle, Search, Users, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { CharacterChatSession } from '@/shared'
import { EmptyState, ConfirmDialog } from '@/ui/components'
import { Button, Icon, IconButton, IconTile, PageHeader, Toast, controlClass } from '@/ui/primitives'
import { ResumeCard } from '@/features/landing/components/ResumeCard'
import { toResumeSessions, type ResumeSession } from '@/features/landing/components/resumeModel'
import { buildGalleryModeHash } from '@/features/gallery/galleryLinks'
import { isFrontendVoiceModeEnabled } from '@/shared/voiceFeatureFlag'

interface ActionNotice {
    tone: 'success' | 'error'
    title: string
    message?: string
}

function searchableText(session: ResumeSession): string {
    return [
        session.title,
        session.context,
        session.playingAs,
        session.snippet,
        session.meta,
    ].filter(Boolean).join(' ').toLowerCase()
}

function chatTitle(chat: CharacterChatSession | null, t: TFunction): string {
    return chat?.character?.name?.trim() || t('characterChat.room.thisChat')
}

export function ChatroomPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        characterChats,
        resumeCharacterChat,
        deleteCharacterChat,
        loadData,
    } = useData()
    const [query, setQuery] = useState('')
    const [pendingDelete, setPendingDelete] = useState<CharacterChatSession | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)
    const voiceModeEnabled = isFrontendVoiceModeEnabled()

    useEffect(() => {
        if (!isAuthenticated) {
            openLoginModal()
            setPage('landing')
        }
    }, [isAuthenticated, openLoginModal, setPage])

    useEffect(() => {
        if (isAuthenticated) void loadData({ silent: true })
        // Refresh the gallery on entry without swapping the whole app to loading.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated])

    const sessions = useMemo(() => toResumeSessions([], characterChats), [characterChats])
    const normalizedQuery = query.trim().toLowerCase()
    const filteredSessions = useMemo(() => {
        if (!normalizedQuery) return sessions
        return sessions.filter((session) => searchableText(session).includes(normalizedQuery))
    }, [normalizedQuery, sessions])

    if (!isAuthenticated) return null

    const openChat = (session: ResumeSession) => {
        resumeCharacterChat(session.source as CharacterChatSession)
        setPage('character-chat')
    }

    const openVoiceChat = (session: ResumeSession) => {
        resumeCharacterChat(session.source as CharacterChatSession, { mode: 'voice' })
        setPage('character-chat')
    }

    const startGroupChat = () => {
        setPage('gallery-characters', { hash: buildGalleryModeHash('character', 'group-chat') })
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
    ) : (
        <Button
            variant="arcane"
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
                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
                        <Button
                            variant="primary"
                            iconLeft={<Icon icon={Users} size={16} />}
                            onClick={startGroupChat}
                            className="shrink-0"
                        >
                            {t('characterChat.room.newGroupChat')}
                        </Button>
                        <div className="relative flex w-full items-center sm:w-[320px]">
                            <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                                <Icon icon={Search} size={16} />
                            </span>
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') setQuery('')
                                }}
                                placeholder={t('characterChat.room.searchPlaceholder')}
                                aria-label={t('characterChat.room.searchLabel')}
                                className={`${controlClass} rounded-full pl-10 pr-12`}
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
                    </div>
                }
            />

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
                            onDelete={() => setPendingDelete(session.source as CharacterChatSession)}
                            deleting={deletingId === session.id}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState
                    icon={<Icon icon={MessageCircle} size={44} />}
                    message={hasQuery ? t('characterChat.room.noMatch', { query: query.trim() }) : t('characterChat.room.empty')}
                    secondaryText={hasQuery ? t('characterChat.room.emptyMatchHint') : t('characterChat.room.emptyHint')}
                >
                    {emptyAction}
                </EmptyState>
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
