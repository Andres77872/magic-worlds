import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import type { AdminVoiceEntry } from '@/shared'
import { Badge, Icon, IconButton, Input, Select } from '@/ui/primitives'
import { SYSTEM_VOICE_PAGE_SIZE, VOICE_TYPE_META } from '../constants'
import { buildLanguageOptions, deriveVoiceLanguage } from '../voiceLanguage'
import { VoiceRow } from './VoiceRow'

interface SystemVoiceBrowserProps {
    voices: AdminVoiceEntry[]
    loading: boolean
    deletingVoiceId: string | null
    onTest: (voice: AdminVoiceEntry) => void
    onDelete: (voice: AdminVoiceEntry) => void
}

/**
 * Browsable view of the (large) MiniMax system-voice inventory: live search,
 * a language filter, and client-side pagination so only one page renders.
 */
export function SystemVoiceBrowser({ voices, loading, deletingVoiceId, onTest, onDelete }: SystemVoiceBrowserProps) {
    const { t } = useTranslation()
    const [query, setQuery] = useState('')
    const [language, setLanguage] = useState('')
    const [page, setPage] = useState(1)

    const languageOptions = useMemo(() => buildLanguageOptions(voices, t), [voices, t])

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return voices.filter((voice) => {
            if (language && deriveVoiceLanguage(voice) !== language) return false
            if (!needle) return true
            const haystack = `${voice.voice_id} ${voice.voice_name ?? ''} ${voice.description.join(' ')}`.toLowerCase()
            return haystack.includes(needle)
        })
    }, [voices, query, language])

    const totalPages = Math.max(1, Math.ceil(filtered.length / SYSTEM_VOICE_PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const startIndex = (safePage - 1) * SYSTEM_VOICE_PAGE_SIZE
    const endIndex = Math.min(startIndex + SYSTEM_VOICE_PAGE_SIZE, filtered.length)
    const visible = filtered.slice(startIndex, endIndex)
    const isFiltered = query.trim().length > 0 || language.length > 0

    const meta = VOICE_TYPE_META.system

    const onQueryChange = (value: string) => {
        setQuery(value)
        setPage(1)
    }

    const onLanguageChange = (value: string) => {
        setLanguage(value)
        setPage(1)
    }

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-display text-h3 font-semibold text-parchment-50">{t(meta.labelKey)}</h3>
                    <p className="font-ui text-sm text-parchment-300">{t(meta.descriptionKey)}</p>
                </div>
                <Badge tone="neutral">
                    {isFiltered ? t('admin.voices.systemBrowser.filteredCount', { shown: filtered.length, total: voices.length }) : voices.length}
                </Badge>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex flex-1 items-center">
                    <span className="pointer-events-none absolute left-3 z-[1] flex items-center text-parchment-400">
                        <Icon icon={Search} size={16} />
                    </span>
                    <Input
                        type="text"
                        value={query}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder={t('admin.voices.systemBrowser.searchPlaceholder')}
                        aria-label={t('admin.voices.systemBrowser.searchAria')}
                        className="pl-10 pr-10"
                    />
                    {query && (
                        <IconButton label={t('admin.voices.systemBrowser.clearSearch')} size="sm" className="absolute right-2 z-[2]" onClick={() => onQueryChange('')}>
                            <Icon icon={X} size={16} />
                        </IconButton>
                    )}
                </div>
                <div className="sm:w-52">
                    <Select
                        options={languageOptions}
                        value={language}
                        onChange={onLanguageChange}
                        size="sm"
                        aria-label={t('admin.voices.systemBrowser.languageAria')}
                    />
                </div>
            </div>

            {visible.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {visible.map((voice) => (
                        <VoiceRow
                            key={`${voice.voice_type}:${voice.voice_id}`}
                            voice={voice}
                            deleting={deletingVoiceId === voice.voice_id}
                            onTest={onTest}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3 font-ui text-sm text-parchment-300">
                    {loading && voices.length === 0
                        ? t('admin.voices.library.loading')
                        : isFiltered
                          ? t('admin.voices.systemBrowser.noMatch')
                          : t('admin.voices.systemBrowser.emptyGroup')}
                </div>
            )}

            {filtered.length > SYSTEM_VOICE_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 pt-1">
                    <p className="font-mono text-xs text-parchment-400">
                        {t('admin.voices.systemBrowser.showing', { start: startIndex + 1, end: endIndex, total: filtered.length })}
                    </p>
                    <div className="flex items-center gap-2">
                        <IconButton
                            label={t('admin.voices.systemBrowser.previousPage')}
                            size="sm"
                            disabled={safePage <= 1}
                            onClick={() => setPage((current) => Math.max(1, current - 1))}
                        >
                            <Icon icon={ChevronLeft} size={16} />
                        </IconButton>
                        <span className="font-mono text-xs text-parchment-300">
                            {safePage} / {totalPages}
                        </span>
                        <IconButton
                            label={t('admin.voices.systemBrowser.nextPage')}
                            size="sm"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        >
                            <Icon icon={ChevronRight} size={16} />
                        </IconButton>
                    </div>
                </div>
            )}
        </section>
    )
}
