/**
 * Library browser (D09, D19, 05 §8.7, AC-R6): live shared-voice search with
 * the D09 filters always applied, root-only upstream previews, and "Add to
 * catalog" behind the terms checklist and root attestations.
 */
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Library, Plus } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { LibrarySort, LibraryVoice, LibraryVoicePage, LibraryVoiceQuery } from '@/shared'
import { Badge, Button, Callout, Field, Icon, Input, Select, Tag } from '@/ui/primitives'
import { AGE_BUCKETS, GENDERS, LIBRARY_PAGE_SIZE, LIBRARY_SORTS } from '../../constants'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { ConsoleAudioPlayer } from '../shell/ConsoleAudioPlayer'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { AddLibraryVoiceDialog } from './AddLibraryVoiceDialog'

interface LibraryFilters {
    search: string
    language: string
    locale: string
    gender: string
    age: string
    accent: string
    use_case: string
    sort: LibrarySort
}

const EMPTY: LibraryFilters = { search: '', language: '', locale: '', gender: '', age: '', accent: '', use_case: '', sort: 'trending' }

const toQuery = (filters: LibraryFilters): LibraryVoiceQuery => ({
    search: filters.search.trim() || undefined,
    language: filters.language.trim().toLowerCase() || undefined,
    locale: filters.locale.trim() || undefined,
    gender: filters.gender || undefined,
    age: filters.age || undefined,
    accent: filters.accent.trim() || undefined,
    use_case: filters.use_case.trim() || undefined,
    sort: filters.sort,
    page_size: LIBRARY_PAGE_SIZE,
})

export function LibraryBrowser() {
    const { t } = useTranslation()
    const { catalog, notify, reportError, languageName } = useVoiceConsole()
    const [draft, setDraft] = useState<LibraryFilters>(EMPTY)
    const [applied, setApplied] = useState<LibraryFilters>(EMPTY)
    const query = toQuery(applied)
    const key = JSON.stringify(query)
    const first = useAbortableLoad<LibraryVoicePage>((signal) => apiService.listAdminLibrary({ ...query, page: 0 }, signal), key)
    const errorMessage = useLoadErrorMessage(first.error)
    const [more, setMore] = useState<{ key: string; items: LibraryVoice[]; page: number; hasMore: boolean } | null>(null)
    const [loadingMore, setLoadingMore] = useState(false)
    const [adding, setAdding] = useState<LibraryVoice | null>(null)
    const [addedIds, setAddedIds] = useState<Record<string, string>>({})

    const extra = more && more.key === key ? more : null
    const items = [...(first.data?.items ?? []), ...(extra?.items ?? [])]
    const hasMore = extra ? extra.hasMore : Boolean(first.data?.has_more)

    const apply = (event: FormEvent) => {
        event.preventDefault()
        setApplied(draft)
        setMore(null)
    }

    const loadMore = async () => {
        const page = (extra?.page ?? first.data?.page ?? 0) + 1
        setLoadingMore(true)
        try {
            const result = await apiService.listAdminLibrary({ ...query, page })
            setMore({ key, items: [...(extra?.items ?? []), ...result.items], page: result.page, hasMore: result.has_more })
        } catch (error) {
            notify(reportError(error), 'error')
        } finally {
            setLoadingMore(false)
        }
    }

    const setField = (name: keyof LibraryFilters, value: string) => setDraft((previous) => ({ ...previous, [name]: value }))
    const anyOption = { value: '', label: t('admin.voices.common.any') }

    return (
        <ConsoleSection icon={Library} title={t('admin.voices.library.title')} description={t('admin.voices.library.description')}>
            <Callout tone="info" role="note">
                {t('admin.voices.library.enforcedFilters')}
            </Callout>
            <form onSubmit={apply} role="search" aria-label={t('admin.voices.library.filters.label')} className="grid gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={t('admin.voices.library.filters.search')}>
                    <Input type="search" value={draft.search} onChange={(event) => setField('search', event.target.value)} />
                </Field>
                <Field label={t('admin.voices.library.filters.language')}>
                    <Input value={draft.language} onChange={(event) => setField('language', event.target.value)} maxLength={3} />
                </Field>
                <Field label={t('admin.voices.library.filters.locale')}>
                    <Input value={draft.locale} onChange={(event) => setField('locale', event.target.value)} />
                </Field>
                <Field label={t('admin.voices.library.filters.accent')}>
                    <Input value={draft.accent} onChange={(event) => setField('accent', event.target.value)} />
                </Field>
                <Field label={t('admin.voices.library.filters.gender')}>
                    <Select size="sm" options={[anyOption, ...GENDERS.map((value) => ({ value, label: t(`admin.voices.gender.${value}`) }))]} value={draft.gender} onChange={(value) => setField('gender', value)} />
                </Field>
                <Field label={t('admin.voices.library.filters.age')}>
                    <Select size="sm" options={[anyOption, ...AGE_BUCKETS.map((value) => ({ value, label: t(`admin.voices.age.${value}`) }))]} value={draft.age} onChange={(value) => setField('age', value)} />
                </Field>
                <Field label={t('admin.voices.library.filters.useCase')}>
                    <Input value={draft.use_case} onChange={(event) => setField('use_case', event.target.value)} />
                </Field>
                <Field label={t('admin.voices.library.filters.sort')}>
                    <Select
                        size="sm"
                        options={LIBRARY_SORTS.map((value) => ({ value, label: t(`admin.voices.library.filters.sorts.${value}`) }))}
                        value={draft.sort}
                        onChange={(value) => setField('sort', value)}
                    />
                </Field>
                <div className="sm:col-span-2 lg:col-span-4">
                    <Button type="submit" variant="secondary">
                        {t('admin.voices.library.filters.apply')}
                    </Button>
                </div>
            </form>

            <div aria-live="polite" className="font-ui text-sm text-parchment-300">
                {first.loading ? t('admin.voices.library.loading') : first.data && items.length === 0 ? t('admin.voices.library.empty') : null}
            </div>
            {errorMessage && (
                <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={first.reload}>{t('admin.voices.common.retry')}</Button>}>
                    {errorMessage}
                </Callout>
            )}

            <ul className="grid gap-3 lg:grid-cols-2">
                {items.map((voice) => {
                    const catalogKey = voice.catalog_voice_key ?? addedIds[voice.library_voice_id] ?? null
                    return (
                        <li key={`${voice.public_owner_id}-${voice.library_voice_id}`} className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="font-display text-base font-semibold text-fg">{voice.name}</h3>
                                    {voice.description && <p className="font-ui text-sm text-parchment-300">{voice.description}</p>}
                                </div>
                                {catalogKey ? (
                                    <Badge tone="live">{t('admin.voices.library.inCatalog')}</Badge>
                                ) : (
                                    <Button variant="secondary" size="sm" iconLeft={<Icon icon={Plus} size={14} />} onClick={() => setAdding(voice)}>
                                        {t('admin.voices.library.add')}
                                    </Button>
                                )}
                            </div>
                            {Object.keys(voice.labels).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(voice.labels).map(([label, value]) => (
                                        <Tag key={label}>{`${label}: ${value}`}</Tag>
                                    ))}
                                </div>
                            )}
                            <ul className="flex flex-wrap gap-x-4 gap-y-1 font-ui text-caption text-parchment-300">
                                <li>
                                    {voice.notice_period_days !== null
                                        ? t('admin.voices.library.notice', { days: voice.notice_period_days })
                                        : t('admin.voices.library.noticeUnknown')}
                                </li>
                                {voice.rate !== null && <li>{t('admin.voices.library.rate', { rate: voice.rate })}</li>}
                                {voice.fiat_rate !== null && <li>{t('admin.voices.library.fiatRate')}</li>}
                                {voice.free_users_allowed && <li>{t('admin.voices.library.freeUsers')}</li>}
                                {voice.verified_languages.length > 0 && (
                                    <li>
                                        {t('admin.voices.library.verifiedLanguages', {
                                            languages: voice.verified_languages.map((entry) => languageName(entry.language)).join(', '),
                                        })}
                                    </li>
                                )}
                            </ul>
                            {voice.preview_url && (
                                <div className="flex flex-col gap-1">
                                    <ConsoleAudioPlayer path={voice.preview_url} title={t('admin.voices.library.previewTitle', { name: voice.name })} />
                                    <span className="font-ui text-[11px] text-fg-muted">{t('admin.voices.library.previewNote')}</span>
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            {hasMore && (
                <div>
                    <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                        {loadingMore ? t('admin.voices.common.loading') : t('admin.voices.library.loadMore')}
                    </Button>
                </div>
            )}

            {adding && (
                <AddLibraryVoiceDialog
                    voice={adding}
                    onCancel={() => setAdding(null)}
                    onAdded={(added) => {
                        catalog.upsert(added)
                        setAddedIds((previous) => ({ ...previous, [adding.library_voice_id]: added.voice_key }))
                        setAdding(null)
                        notify(t('admin.voices.toasts.libraryAdded'))
                    }}
                />
            )}
        </ConsoleSection>
    )
}
