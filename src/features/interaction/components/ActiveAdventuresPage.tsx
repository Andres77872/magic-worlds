/**
 * Active adventures - full list of started adventure sessions.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CirclePlay, Search, Swords, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import type { Adventure } from '@/shared'
import { ConfirmDialog, EmptyState } from '@/ui/components'
import { Button, Icon, IconButton, IconTile, PageHeader, Toast, controlClass } from '@/ui/primitives'
import { ResumeCard } from '@/features/landing/components/ResumeCard'
import { toResumeSessions, type ResumeSession } from '@/features/landing/components/resumeModel'

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

export function ActiveAdventuresPage() {
    const { t } = useTranslation()
    const { setPage } = useNavigation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const {
        inProgressAdventures,
        editInProgress,
        deleteInProgress,
        loadData,
        loadingState,
    } = useData()
    const [query, setQuery] = useState('')
    const [pendingDelete, setPendingDelete] = useState<ResumeSession | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [actionNotice, setActionNotice] = useState<ActionNotice | null>(null)

    useEffect(() => {
        if (!isAuthenticated) {
            openLoginModal()
            setPage('landing')
        }
    }, [isAuthenticated, openLoginModal, setPage])

    useEffect(() => {
        if (isAuthenticated) void loadData({ silent: true })
        // Refresh the session list on entry without replacing the page with the global loader.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated])

    const sessions = useMemo(() => toResumeSessions(inProgressAdventures, []), [inProgressAdventures])
    const normalizedQuery = query.trim().toLowerCase()
    const filteredSessions = useMemo(() => {
        if (!normalizedQuery) return sessions
        return sessions.filter((session) => searchableText(session).includes(normalizedQuery))
    }, [normalizedQuery, sessions])

    if (!isAuthenticated) return null

    const openAdventure = (session: ResumeSession) => {
        editInProgress(session.source as Adventure)
        setPage('interaction')
    }

    const confirmDelete = async () => {
        const target = pendingDelete
        setPendingDelete(null)
        if (!target) return
        const adventure = target.source as Adventure
        const index = inProgressAdventures.findIndex((item) => item.id === adventure.id)
        if (index < 0) {
            setActionNotice({
                tone: 'error',
                title: t('interaction.adventures.deleteErrorTitle'),
                message: t('interaction.adventures.deleteErrorGone'),
            })
            return
        }

        setDeletingId(target.id)
        setActionNotice(null)
        try {
            await deleteInProgress(index)
            setActionNotice({
                tone: 'success',
                title: t('interaction.adventures.deletedTitle'),
                message: target.title,
            })
        } catch (error) {
            console.error('Failed to delete adventure session:', error)
            setActionNotice({
                tone: 'error',
                title: t('interaction.adventures.deleteErrorTitle'),
                message: error instanceof Error && error.message.trim() ? error.message : t('interaction.adventures.tryAgain'),
            })
        } finally {
            setDeletingId(null)
        }
    }

    const hasQuery = query.trim().length > 0
    const emptyAction = hasQuery ? (
        <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
            {t('interaction.adventures.clearSearch')}
        </Button>
    ) : (
        <Button
            variant="primary"
            size="sm"
            iconLeft={<Icon icon={Swords} size={15} />}
            onClick={() => setPage('gallery-adventures')}
        >
            {t('interaction.adventures.browse')}
        </Button>
    )

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10" data-testid="active-adventures-page">
            <PageHeader
                eyebrow={t('interaction.adventures.eyebrow')}
                eyebrowTone="ember"
                icon={<IconTile icon={CirclePlay} tone="ember" />}
                title={t('interaction.adventures.title')}
                subtitle={t('interaction.adventures.subtitle')}
                size="lg"
                actions={
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
                            placeholder={t('interaction.adventures.searchPlaceholder')}
                            aria-label={t('interaction.adventures.searchLabel')}
                            className={`${controlClass} rounded-full pl-10 pr-12`}
                        />
                        {hasQuery && (
                            <IconButton
                                size="sm"
                                label={t('interaction.adventures.clearSearch')}
                                onClick={() => setQuery('')}
                                className="absolute right-2"
                            >
                                <Icon icon={X} size={16} />
                            </IconButton>
                        )}
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
                <div className="grid gap-4 md:grid-cols-2" data-testid="active-adventures-gallery">
                    {filteredSessions.map((session) => (
                        <ResumeCard
                            key={session.id}
                            session={session}
                            onContinue={() => openAdventure(session)}
                            onDelete={() => setPendingDelete(session)}
                            deleting={deletingId === session.id}
                        />
                    ))}
                </div>
            ) : loadingState.error && !hasQuery ? (
                // An empty list during a load failure is a misleading "false empty" —
                // show an error with a retry instead of "no adventures yet".
                <EmptyState
                    icon={<Icon icon={CirclePlay} size={44} />}
                    message={t('common.loadError')}
                    button={{ label: t('common.tryAgain'), onClick: () => void loadData() }}
                />
            ) : (
                <EmptyState
                    icon={<Icon icon={CirclePlay} size={44} />}
                    message={hasQuery ? t('interaction.adventures.noMatch', { query: query.trim() }) : t('interaction.adventures.emptyTitle')}
                    secondaryText={hasQuery ? t('interaction.adventures.noMatchHint') : t('interaction.adventures.emptyHint')}
                >
                    {emptyAction}
                </EmptyState>
            )}

            <ConfirmDialog
                visible={pendingDelete !== null}
                title={t('interaction.adventures.deleteTitle')}
                message={pendingDelete ? t('interaction.adventures.deleteConfirm', { title: pendingDelete.title }) : ''}
                confirmLabel={t('interaction.adventures.deleteAction')}
                variant="danger"
                onConfirm={() => void confirmDelete()}
                onCancel={() => setPendingDelete(null)}
            />
        </div>
    )
}
