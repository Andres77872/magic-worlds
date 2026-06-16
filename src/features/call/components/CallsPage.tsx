/**
 * CallsPage — the dedicated hub for character VOICE calls.
 *
 * Top: an image-forward gallery of the user's characters to start a call from.
 * Below: the user's recent calls, each opening a saved transcript (with the character's
 * spoken audio). Selecting a call swaps the page into a master/detail transcript view.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Phone, PhoneCall, Search, Users, X } from 'lucide-react'
import { useAuth, useData, useNavigation } from '@/app/hooks'
import { apiService, resolveMediaUrl } from '@/infrastructure/api'
import type { CallSummary, Character } from '@/shared'
import { EmptyState, CardGrid, GalleryCard, PersonaPickerDialog } from '@/ui/components'
import { Badge, Button, Icon, IconButton, IconTile, PageHeader, controlClass } from '@/ui/primitives'
import { useStartCall } from '../useStartCall'
import { CallHistoryRow } from './CallHistoryRow'
import { CallTranscriptView } from './CallTranscriptView'

function hasVoice(character: Character): boolean {
    return Boolean(character.voice?.voice_id)
}

export function CallsPage() {
    const { t } = useTranslation()
    const { isAuthenticated, openLoginModal } = useAuth()
    const { characters } = useData()
    const { setPage } = useNavigation()
    const call = useStartCall()

    const [query, setQuery] = useState('')
    const [recentCalls, setRecentCalls] = useState<CallSummary[]>([])
    const [loadingCalls, setLoadingCalls] = useState(true)
    const [selectedCall, setSelectedCall] = useState<CallSummary | null>(null)

    useEffect(() => {
        if (!isAuthenticated) {
            openLoginModal()
            setPage('landing')
        }
    }, [isAuthenticated, openLoginModal, setPage])

    useEffect(() => {
        if (!isAuthenticated) return
        let cancelled = false
        setLoadingCalls(true)
        apiService
            .getRecentVoiceCalls({ limit: 30 })
            .then((response) => {
                if (!cancelled) setRecentCalls(response.items ?? [])
            })
            .catch((error) => {
                console.error('Failed to load recent calls:', error)
                if (!cancelled) setRecentCalls([])
            })
            .finally(() => {
                if (!cancelled) setLoadingCalls(false)
            })
        return () => {
            cancelled = true
        }
    }, [isAuthenticated])

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

    if (!isAuthenticated) return null

    if (selectedCall) {
        return (
            <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-5 py-8 sm:px-8 sm:py-10" data-testid="calls-page">
                <CallTranscriptView call={selectedCall} characters={characters ?? []} onBack={() => setSelectedCall(null)} />
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
                                onClick={() => call.startCall(character)}
                                actionLabel={t('call.page.callName', { name: character.name })}
                                footer={
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="w-full"
                                        iconLeft={<Icon icon={Phone} size={15} />}
                                        onClick={() => call.startCall(character)}
                                        disabled={call.startingId === character.id}
                                    >
                                        {call.startingId === character.id ? t('call.page.starting') : t('call.page.call')}
                                    </Button>
                                }
                            />
                        )}
                    />
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
                    {recentCalls.length > 0 && <Badge tone="glass">{recentCalls.length}</Badge>}
                </div>

                {loadingCalls ? (
                    <div className="flex flex-col gap-2" aria-busy="true">
                        {[0, 1, 2].map((index) => (
                            <div key={index} className="image-shimmer h-[66px] rounded-xl border border-parchment-50/10 bg-ink-800/60" />
                        ))}
                    </div>
                ) : recentCalls.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {recentCalls.map((entry) => {
                            const match = entry.character_card_id
                                ? (characters ?? []).find((character) => character.id === entry.character_card_id)
                                : undefined
                            return (
                                <CallHistoryRow
                                    key={entry.voice_session_id}
                                    call={entry}
                                    characters={characters ?? []}
                                    onView={() => setSelectedCall(entry)}
                                    onCallAgain={match ? () => call.startCall(match) : undefined}
                                />
                            )
                        })}
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
