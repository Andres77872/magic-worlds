import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import type { AdminVoiceEntry } from '@/shared'
import { Badge, Button, Icon, IconButton, Input, Select, cx } from '@/ui/primitives'
import { SYSTEM_VOICE_PAGE_SIZE } from '@/features/admin/voices/constants'
import { buildLanguageOptions, deriveVoiceLanguage } from '@/features/admin/voices/voiceLanguage'

interface SystemVoicePickerProps {
    voices: AdminVoiceEntry[]
    loading: boolean
    selectedVoiceId?: string
    onSelect: (voice: AdminVoiceEntry) => void
}

/** Browse the MiniMax system voice catalog (search + language filter + paging)
 * and pick one as a base voice. Presentational — voices are fetched by the host. */
export function SystemVoicePicker({ voices, loading, selectedVoiceId, onSelect }: SystemVoicePickerProps) {
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
    const start = (safePage - 1) * SYSTEM_VOICE_PAGE_SIZE
    const end = Math.min(start + SYSTEM_VOICE_PAGE_SIZE, filtered.length)
    const visible = filtered.slice(start, end)

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex flex-1 items-center">
                    <span className="pointer-events-none absolute left-3 z-[1] flex items-center text-parchment-400">
                        <Icon icon={Search} size={16} />
                    </span>
                    <Input
                        type="text"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value)
                            setPage(1)
                        }}
                        placeholder={t('voices.systemPicker.searchPlaceholder')}
                        aria-label={t('voices.systemPicker.searchAria')}
                        className="pl-10 pr-10"
                    />
                    {query && (
                        <IconButton
                            label={t('voices.systemPicker.clearSearch')}
                            size="sm"
                            className="absolute right-2 z-[2]"
                            onClick={() => {
                                setQuery('')
                                setPage(1)
                            }}
                        >
                            <Icon icon={X} size={16} />
                        </IconButton>
                    )}
                </div>
                <div className="sm:w-52">
                    <Select
                        options={languageOptions}
                        value={language}
                        onChange={(value) => {
                            setLanguage(value)
                            setPage(1)
                        }}
                        size="sm"
                        aria-label={t('voices.systemPicker.filterLanguage')}
                    />
                </div>
            </div>

            {visible.length > 0 ? (
                <div className="flex flex-col gap-2">
                    {visible.map((voice) => {
                        const selected = voice.voice_id === selectedVoiceId
                        const description = voice.description.filter(Boolean).join(' ')
                        return (
                            <div
                                key={voice.voice_id}
                                className={cx(
                                    'flex items-start justify-between gap-3 rounded-lg border px-4 py-3',
                                    selected ? 'border-ember-500/60 bg-parchment-50/[.05]' : 'border-parchment-50/[.08] bg-ink-800/70',
                                )}
                            >
                                <div className="min-w-0">
                                    <p className="font-ui text-sm font-semibold text-parchment-50">{voice.voice_name || voice.voice_id}</p>
                                    <code className="mt-1 block truncate font-mono text-xs text-parchment-400">{voice.voice_id}</code>
                                    {description && <p className="mt-1 line-clamp-2 font-ui text-xs text-parchment-300">{description}</p>}
                                </div>
                                <Button
                                    kind={selected ? 'primary' : 'secondary'}
                                    size="sm"
                                    iconLeft={selected ? <Icon icon={Check} size={14} /> : undefined}
                                    onClick={() => onSelect(voice)}
                                >
                                    {selected ? t('voices.systemPicker.selected') : t('voices.systemPicker.select')}
                                </Button>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="rounded-lg border border-parchment-50/[.08] bg-ink-800/70 px-4 py-3 font-ui text-sm text-parchment-300">
                    {loading ? t('voices.systemPicker.loading') : t('voices.systemPicker.noMatch')}
                </div>
            )}

            {filtered.length > SYSTEM_VOICE_PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs text-parchment-400">
                        {t('voices.systemPicker.showing', { start: start + 1, end, total: filtered.length })}
                    </p>
                    <div className="flex items-center gap-2">
                        <IconButton label={t('voices.systemPicker.previousPage')} size="sm" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                            <Icon icon={ChevronLeft} size={16} />
                        </IconButton>
                        <span className="font-mono text-xs text-parchment-300">
                            {safePage} / {totalPages}
                        </span>
                        <IconButton label={t('voices.systemPicker.nextPage')} size="sm" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                            <Icon icon={ChevronRight} size={16} />
                        </IconButton>
                    </div>
                </div>
            )}

            <Badge tone="neutral">{t('voices.systemPicker.count', { count: voices.length })}</Badge>
        </div>
    )
}
