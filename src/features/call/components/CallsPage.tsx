/**
 * CallsPage — the dedicated hub for character VOICE calls.
 *
 * Top: an image-forward gallery of the user's characters to start a call from.
 * Below: the user's recent calls, each opening a saved transcript (with the character's
 * spoken audio). Selecting a call swaps the page into a master/detail transcript view.
 * "Call again" continues the call's own chat when it is still in the chat list, so the
 * character keeps the conversation instead of a new chat being created per call.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, PhoneCall, PhoneOff, Search, Users, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { resolveMediaUrl } from '@/infrastructure/api'
import type { CallSummary, Character } from '@/shared'
import { hasAssignedVoice } from '@/shared/voice'
import { EmptyState, CardGrid, GalleryCard, PersonaPickerDialog } from '@/ui/components'
import { Badge, Button, Callout, Icon, IconButton, IconTile, PageHeader, controlClass } from '@/ui/primitives'
import { useStartCall } from '../useStartCall'
import { useWorkspaceReadOnly } from '@/shared/hooks/useWorkspaceReadOnly'
import { CallHistoryRow } from './CallHistoryRow'
import { CallTranscriptView } from './CallTranscriptView'

const CALLS_PAGE_SIZE = 30

/** Any assigned voice (D35), read through the shared stored-voice parser. */
function hasVoice(character: Character): boolean {
    return hasAssignedVoice(character.voice)
}

export function CallsPage() {
    const { t } = useTranslation()
    const { isAuthenticated } = useAuth()
    const { characters, characterChats, loadingState, loadData } = useData()
    const { setPage } = useNavigation()
    // Workspace R1: call history is workspace-local; the account's one-live-call policy is not.
    const { api, capture, isCurrent, workspaceEpoch } = useWorkspace()
    const call = useStartCall()
    // An archived workspace keeps its call history readable; a new call is new work there.
    const readOnly = useWorkspaceReadOnly()
    // 09 §7: calls switched off for this account (`capabilities.status`, account level,
    // fail open): call buttons are disabled with copy; history stays readable.
    const callsUnavailable = call.callsUnavailable

    const [query, setQuery] = useState('')
    const [recentCalls, setRecentCalls] = useState<CallSummary[]>([])
    const [loadingCalls, setLoadingCalls] = useState(isAuthenticated)
    const [callsError, setCallsError] = useState(false)
    const [reloadCalls, setReloadCalls] = useState(0)
    const [selectedCall, setSelectedCall] = useState<CallSummary | null>(null)
    const [hasMoreCalls, setHasMoreCalls] = useState(false)
    const [loadingMoreCalls, setLoadingMoreCalls] = useState(false)
    const [moreCallsError, setMoreCallsError] = useState(false)

    // A committed switch shows the new workspace's history: drop the open transcript.
    const [historyEpoch, setHistoryEpoch] = useState(workspaceEpoch)
    if (historyEpoch !== workspaceEpoch) {
        setHistoryEpoch(workspaceEpoch)
        setSelectedCall(null)
        setRecentCalls([])
        setHasMoreCalls(false)
    }

    useEffect(() => {
        if (!isAuthenticated) {
            setRecentCalls([])
            setSelectedCall(null)
            setLoadingCalls(false)
            setCallsError(false)
            setHasMoreCalls(false)
            return
        }
        if (!api) return
        let cancelled = false
        const scope = capture()
        setLoadingCalls(true)
        setCallsError(false)
        setMoreCallsError(false)
        api
            .getRecentVoiceCalls({ limit: CALLS_PAGE_SIZE })
            .then((response) => {
                if (cancelled || !isCurrent(scope)) return
                const items = response.items ?? []
                setRecentCalls(items)
                setHasMoreCalls(items.length >= CALLS_PAGE_SIZE)
            })
            .catch((error) => {
                console.error('Failed to load recent calls:', error)
                if (!cancelled) setCallsError(true)
            })
            .finally(() => {
                if (!cancelled) setLoadingCalls(false)
            })
        return () => {
            cancelled = true
        }
        // A committed switch (new epoch, new scoped `api`) reloads the history.
    }, [api, capture, isAuthenticated, isCurrent, reloadCalls, workspaceEpoch])

    const loadMoreCalls = async () => {
        if (loadingMoreCalls || !api) return
        const scope = capture()
        setLoadingMoreCalls(true)
        setMoreCallsError(false)
        try {
            const response = await api.getRecentVoiceCalls({ skip: recentCalls.length, limit: CALLS_PAGE_SIZE })
            if (!isCurrent(scope)) return
            const items = response.items ?? []
            setRecentCalls((current) => {
                const seen = new Set(current.map((entry) => entry.voice_session_id))
                return [...current, ...items.filter((entry) => !seen.has(entry.voice_session_id))]
            })
            setHasMoreCalls(items.length >= CALLS_PAGE_SIZE)
        } catch (error) {
            console.error('Failed to load more calls:', error)
            if (isCurrent(scope)) setMoreCallsError(true)
        } finally {
            setLoadingMoreCalls(false)
        }
    }

    /** Continue the call's own chat when we still have it; otherwise start a fresh one. */
    const callAgainHandler = (entry: CallSummary) => {
        if (readOnly || callsUnavailable) return undefined
        const chat = entry.chat_id != null
            ? (characterChats ?? []).find((candidate) => candidate.id === String(entry.chat_id) && candidate.kind !== 'character_group')
            : undefined
        if (chat) return () => call.resumeCall(chat)
        const character = entry.character_card_id
            ? (characters ?? []).find((candidate) => candidate.id === entry.character_card_id)
            : undefined
        return character ? () => call.startCall(character) : undefined
    }

    // Callable characters: real characters (not personas), voice-configured first.
    const callableCharacters = useMemo(() => {
        const list = (characters ?? []).filter((character) => character.role !== 'persona')
        return [...list].sort((a, b) => Number(hasVoice(b)) - Number(hasVoice(a)))
    }, [characters])

    const normalizedQuery = query.trim().toLowerCase()
    const filteredCharacters = useMemo(() => {
        if (!normalizedQuery) return callableCharacters
        return callableCharacters.filter((character) =>
            [character.name, character.race, ...(character.triggers ?? [])]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery),
        )
    }, [callableCharacters, normalizedQuery])

    if (selectedCall) {
        return (
            <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10" data-testid="calls-page">
                <CallTranscriptView
                    call={selectedCall}
                    characters={characters ?? []}
                    onBack={() => setSelectedCall(null)}
                />
            </div>
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10" data-testid="calls-page">
            <PageHeader
                eyebrow={t('call.page.eyebrow')}
                eyebrowTone="ember"
                icon={<IconTile icon={PhoneCall} tone="ember" />}
                title={t('call.page.title')}
                subtitle={t('call.page.subtitle')}
                size="lg"
            />

            <section className="flex flex-col gap-3" aria-labelledby="calls-launch-heading">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h2 id="calls-launch-heading" className="font-display text-h3 font-semibold text-parchment-100">
                            {t('call.page.callHeading')}
                        </h2>
                        <p className="text-caption text-parchment-400">{t('call.page.callHelper')}</p>
                    </div>
                    <div className="relative flex w-full items-center sm:w-[300px]">
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
                            placeholder={t('call.page.searchPlaceholder')}
                            aria-label={t('call.page.searchAria')}
                            className={`${controlClass} rounded-full pl-10 pr-12`}
                        />
                        {query.trim() && (
                            <IconButton size="sm" label={t('call.page.clearSearch')} onClick={() => setQuery('')} className="absolute right-2">
                                <Icon icon={X} size={16} />
                            </IconButton>
                        )}
                    </div>
                </div>

                {/* The live region stays mounted (out of the flex flow), so a switch-off that lands while
                    the page is open is announced; the visible callout carries no role of its own. */}
                <p aria-live="polite" className="sr-only" data-testid="calls-availability-status">
                    {callsUnavailable ? t('call.page.unavailable') : ''}
                </p>
                {callsUnavailable && (
                    <Callout tone="info" icon={<Icon icon={PhoneOff} size={16} />} data-testid="calls-unavailable">
                        {t('call.page.unavailable')}
                    </Callout>
                )}

                {filteredCharacters.length > 0 ? (
                    <CardGrid
                        items={filteredCharacters}
                        layout="rail"
                        getItemKey={(character) => character.id}
                        renderCard={(character) => (
                            <GalleryCard
                                id={character.id}
                                title={character.name}
                                imageUrl={character.image_url ? resolveMediaUrl(character.image_url) : undefined}
                                badge={hasVoice(character) ? t('call.page.voiceSet') : undefined}
                                description={character.description || undefined}
                                tags={character.triggers?.slice(0, 2)}
                                footer={
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="w-full"
                                        aria-label={t('call.page.callName', { name: character.name })}
                                        iconLeft={<Icon icon={Phone} size={15} />}
                                        onClick={() => call.startCall(character)}
                                        disabled={readOnly || callsUnavailable || call.startingId === character.id}
                                    >
                                        {call.startingId === character.id ? t('call.page.starting') : t('call.page.call')}
                                    </Button>
                                }
                            />
                        )}
                    />
                ) : loadingState?.isLoading && callableCharacters.length === 0 ? (
                    <p role="status" className="py-8 text-body text-parchment-300">{t('common.loading')}</p>
                ) : loadingState?.error && callableCharacters.length === 0 ? (
                    <div role="alert" className="flex flex-wrap items-center gap-3 py-8 text-body text-parchment-300">
                        <p>{t('common.loadError')}</p>
                        <Button variant="secondary" size="sm" onClick={() => void loadData({ silent: true })}>{t('common.tryAgain')}</Button>
                    </div>
                ) : (
                    <EmptyState
                        icon={<Icon icon={Users} size={40} />}
                        message={query.trim() ? t('call.page.noMatch', { query: query.trim() }) : t('call.page.noCharacters')}
                        secondaryText={query.trim() ? t('call.page.tryAnotherName') : t('call.page.createToCall')}
                    >
                        <Button variant="primary" size="sm" iconLeft={<Icon icon={Users} size={15} />} onClick={() => setPage('gallery-characters')}>
                            {t('call.page.findCharacters')}
                        </Button>
                    </EmptyState>
                )}
            </section>

            <section className="flex flex-col gap-3" aria-labelledby="calls-recent-heading">
                <div className="flex items-center justify-between gap-2">
                    <h2 id="calls-recent-heading" className="font-display text-h3 font-semibold text-parchment-100">
                        {t('call.page.recentHeading')}
                    </h2>
                    {recentCalls.length > 0 && <Badge tone="glass">{hasMoreCalls ? `${recentCalls.length}+` : recentCalls.length}</Badge>}
                </div>

                {loadingCalls ? (
                    <div className="flex flex-col gap-2" aria-busy="true">
                        {[0, 1, 2].map((index) => (
                            <div key={index} className="image-shimmer h-16 rounded-md bg-ink-700/50" />
                        ))}
                    </div>
                ) : callsError ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-l-2 border-blood-500/40 py-3 pl-4 text-body text-parchment-200">
                        <p>{t('common.loadError')}</p>
                        <Button variant="secondary" size="sm" onClick={() => setReloadCalls((value) => value + 1)}>{t('common.tryAgain')}</Button>
                    </div>
                ) : recentCalls.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {recentCalls.map((entry) => (
                            <CallHistoryRow
                                key={entry.voice_session_id}
                                call={entry}
                                characters={characters ?? []}
                                onView={() => setSelectedCall(entry)}
                                onCallAgain={callAgainHandler(entry)}
                            />
                        ))}
                        {moreCallsError && (
                            <p role="alert" className="text-caption text-blood-500">{t('common.loadError')}</p>
                        )}
                        {hasMoreCalls && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="self-center"
                                onClick={() => void loadMoreCalls()}
                                disabled={loadingMoreCalls}
                                aria-busy={loadingMoreCalls}
                            >
                                {loadingMoreCalls ? t('common.loading') : t('call.page.loadMore')}
                            </Button>
                        )}
                    </div>
                ) : (
                    <EmptyState icon={<Icon icon={PhoneCall} size={40} />} message={t('call.page.noCallsYet')} secondaryText={t('call.page.noCallsHelper')} />
                )}
            </section>

            <PersonaPickerDialog
                open={call.personaPickOpen}
                title={t('call.page.personaTitle')}
                actionLabel={t('call.page.personaAction')}
                description={t('call.page.personaDescription')}
                error={call.personaPickError}
                isConfirming={call.personaPickConfirming}
                characters={characters ?? []}
                onConfirm={call.confirmPersonaPick}
                onClose={call.closePersonaPick}
            />
        </div>
    )
}
