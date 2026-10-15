/**
 * Catalog manager (05 §8.3, AC-R2): the server-filtered catalog list, sync
 * jobs (with the Job B mass-removal override, D19 item 7), and the detail
 * drawer with publish, retire, replacement and provider delete. Root may see
 * the provider voice id only in the drawer.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ListChecks, RefreshCw } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogPage, AdminCatalogQuery, AdminCatalogVoice, AdminVoiceSyncResponse, VoiceSyncJob } from '@/shared'
import { Button, Callout, Field, Icon, Input, Select } from '@/ui/primitives'
import { EmptyState } from '@/ui/components/common/EmptyState'
import { CATALOG_PAGE_SIZE, CATALOG_STATUSES, CATALOG_VISIBILITIES, SOURCE_KINDS } from '../../constants'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { confirmRemovalCounts, massRemovalAbort } from '../../massRemoval'
import { replacementOrphans } from '../../replacementDependents'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { CatalogDetailDrawer } from './CatalogDetailDrawer'
import { CatalogTable } from './CatalogTable'
import { MassRemovalDialog } from './MassRemovalDialog'
import { FishInventoryPanel } from './FishInventoryPanel'

interface CatalogFilterState {
    provider: string
    q: string
    status: string
    visibility: string
    source_kind: string
    primary_language: string
    call_eligible: string
    acceptance: string
}

const EMPTY_FILTERS: CatalogFilterState = { provider: '', q: '', status: '', visibility: '', source_kind: '', primary_language: '', call_eligible: '', acceptance: '' }

function toQuery(filters: CatalogFilterState): AdminCatalogQuery {
    return {
        provider: (filters.provider || undefined) as AdminCatalogQuery['provider'],
        q: filters.q.trim() || undefined,
        status: (filters.status || undefined) as AdminCatalogQuery['status'],
        visibility: (filters.visibility || undefined) as AdminCatalogQuery['visibility'],
        source_kind: (filters.source_kind || undefined) as AdminCatalogQuery['source_kind'],
        primary_language: filters.primary_language.trim().toLowerCase() || undefined,
        call_eligible: filters.call_eligible === '' ? undefined : filters.call_eligible === 'true',
        acceptance: (filters.acceptance || undefined) as AdminCatalogQuery['acceptance'],
    }
}


/** `initialVoiceKey`: a deep link (`?module=catalog&voice=<key>`) opens that voice's drawer. */
export function CatalogManager({ initialVoiceKey = null }: { initialVoiceKey?: string | null } = {}) {
    const { t } = useTranslation()
    const { catalog, limits, notify, reportError } = useVoiceConsole()
    const [filters, setFilters] = useState<CatalogFilterState>(EMPTY_FILTERS)
    const [textDraft, setTextDraft] = useState({ q: '', primary_language: '' })
    const query = useMemo(() => toQuery(filters), [filters])
    const key = JSON.stringify(query)
    const [revision, setRevision] = useState(0)
    const requestKey = `${revision}:${key}`
    const first = useAbortableLoad<AdminCatalogPage>((signal) => apiService.listAdminCatalog({ ...query, limit: CATALOG_PAGE_SIZE }, signal), requestKey)
    const [more, setMore] = useState<{ key: string; items: AdminCatalogVoice[]; cursor: string | null; loading: boolean } | null>(null)
    const moreRequest = useRef<AbortController | null>(null)
    const [openKey, setOpenKey] = useState<string | null>(initialVoiceKey)
    const [syncJob, setSyncJob] = useState<VoiceSyncJob>('A')
    const [syncing, setSyncing] = useState(false)
    /** `replacement_orphans` of the last sync answer (I-34): voices left naming a removed voice as their replacement. */
    const [orphans, setOrphans] = useState(0)
    const [reviewingRemovals, setReviewingRemovals] = useState(false)
    const errorMessage = useLoadErrorMessage(first.error)
    const removalAbort = massRemovalAbort(limits.data)

    // Old rows and cursors belong to the previous query until this first page settles.
    const page = !first.loading && !first.error ? first.data : null
    const extra = more && more.key === requestKey ? more : null
    const items = [...new Map([...(page?.items ?? []), ...(page ? extra?.items ?? [] : [])].map((voice) => [voice.voice_key, voice])).values()]
    const cursor = page ? (extra ? extra.cursor : page.next_cursor) : null
    const loadingMore = extra?.loading ?? false
    const openVoice = openKey ? (items.find((voice) => voice.voice_key === openKey) ?? catalog.byKey.get(openKey)) : undefined

    useEffect(() => () => {
        moreRequest.current?.abort()
        moreRequest.current = null
    }, [requestKey])

    const resetPages = () => {
        moreRequest.current?.abort()
        moreRequest.current = null
        setMore(null)
    }

    const reloadList = () => {
        resetPages()
        setRevision((value) => value + 1)
    }

    const setFilter = (name: keyof CatalogFilterState, value: string) => {
        setFilters((previous) => ({ ...previous, [name]: value }))
        resetPages()
    }

    const applyText = (event: FormEvent) => {
        event.preventDefault()
        setFilters((previous) => ({ ...previous, ...textDraft }))
        resetPages()
    }

    const loadMore = async () => {
        if (!cursor || first.loading || moreRequest.current) return
        const controller = new AbortController()
        moreRequest.current = controller
        const previousItems = extra?.items ?? []
        setMore({ key: requestKey, items: previousItems, cursor, loading: true })
        try {
            const next = await apiService.listAdminCatalog({ ...query, limit: CATALOG_PAGE_SIZE, after: cursor }, controller.signal)
            if (controller.signal.aborted) return
            setMore({ key: requestKey, items: [...previousItems, ...next.items], cursor: next.next_cursor, loading: false })
        } catch (error) {
            if (!controller.signal.aborted) {
                setMore((previous) => previous ? { ...previous, loading: false } : previous)
                notify(reportError(error), 'error')
            }
        } finally {
            if (moreRequest.current === controller) moreRequest.current = null
        }
    }

    const applyUpdate = (voice: AdminCatalogVoice) => {
        const replace = (list: AdminCatalogVoice[]) => list.map((item) => (item.voice_key === voice.voice_key ? voice : item))
        first.setData((previous) => (previous ? { ...previous, items: replace(previous.items) } : previous))
        setMore((previous) => (previous ? { ...previous, items: replace(previous.items) } : previous))
        catalog.upsert(voice)
    }

    /** A re-point moved voices the client cannot list exactly (I-34): refetch the page and the index. */
    const refetchAfterRepoint = () => {
        reloadList()
        catalog.reload()
    }

    const runSync = async () => {
        setSyncing(true)
        try {
            const result = await apiService.syncAdminCatalog({ job: syncJob })
            setOrphans(replacementOrphans(result?.detail))
            notify(t('admin.voices.toasts.syncQueued', { job: syncJob }))
            limits.reload()
        } catch (error) {
            notify(reportError(error), 'error')
        } finally {
            setSyncing(false)
        }
    }

    /** The mass-removal override finished (I-29/I-34): report it and reload everything it may have changed. */
    const removalsConfirmed = (result: AdminVoiceSyncResponse) => {
        setReviewingRemovals(false)
        const counts = confirmRemovalCounts(result?.detail)
        setOrphans(counts?.replacement_orphans ?? replacementOrphans(result?.detail))
        notify(counts ? t('admin.voices.catalog.massRemoval.result', { ...counts }) : t('admin.voices.toasts.syncQueued', { job: 'B' }))
        limits.reload()
        refetchAfterRepoint()
    }

    const filterOptions = (values: readonly string[], prefix: string) => [
        { value: '', label: t('admin.voices.common.any') },
        ...values.map((value) => ({ value, label: t(`${prefix}.${value}`) })),
    ]

    return (
        <ConsoleSection
            icon={ListChecks}
            title={t('admin.voices.catalog.title')}
            description={t('admin.voices.catalog.description')}
            right={
                <div className="flex flex-wrap items-end gap-2">
                    <Select
                        size="sm"
                        aria-label={t('admin.voices.catalog.sync.label')}
                        options={(['A', 'B', 'C'] as const).map((job) => ({ value: job, label: t(`admin.voices.catalog.sync.jobs.${job}`) }))}
                        value={syncJob}
                        onChange={(value) => setSyncJob(value as VoiceSyncJob)}
                    />
                    <Button
                        variant="secondary"
                        size="sm"
                        iconLeft={<Icon icon={RefreshCw} size={14} className={syncing ? 'animate-spin' : undefined} />}
                        onClick={() => void runSync()}
                        disabled={syncing}
                    >
                        {syncing ? t('admin.voices.catalog.sync.running') : t('admin.voices.catalog.sync.run')}
                    </Button>
                </div>
            }
        >
            <FishInventoryPanel onImported={refetchAfterRepoint} />
            <div role="search" aria-label={t('admin.voices.catalog.filters.label')} className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                <form onSubmit={applyText} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
                    <Field label={t('admin.voices.catalog.filters.search')}>
                        <Input
                            type="search"
                            value={textDraft.q}
                            placeholder={t('admin.voices.catalog.filters.searchPlaceholder')}
                            onChange={(event) => setTextDraft((previous) => ({ ...previous, q: event.target.value }))}
                        />
                    </Field>
                    <Field label={t('admin.voices.catalog.filters.language')}>
                        <Input
                            value={textDraft.primary_language}
                            placeholder={t('admin.voices.catalog.filters.languagePlaceholder')}
                            maxLength={3}
                            onChange={(event) => setTextDraft((previous) => ({ ...previous, primary_language: event.target.value }))}
                        />
                    </Field>
                    <Button type="submit" variant="secondary">
                        {t('admin.voices.library.filters.apply')}
                    </Button>
                </form>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label={t('voices.providers.filter')}>
                        <Select size="sm" options={[
                            { value: '', label: t('voices.providers.all') },
                            { value: 'elevenlabs', label: 'ElevenLabs' },
                            { value: 'fish_audio', label: 'Fish Audio' },
                        ]} value={filters.provider} onChange={(value) => setFilter('provider', value)} />
                    </Field>
                    <Field label={t('admin.voices.catalog.filters.status')}>
                        <Select size="sm" options={filterOptions(CATALOG_STATUSES, 'admin.voices.status')} value={filters.status} onChange={(value) => setFilter('status', value)} />
                    </Field>
                    <Field label={t('admin.voices.catalog.filters.visibility')}>
                        <Select size="sm" options={filterOptions(CATALOG_VISIBILITIES, 'admin.voices.visibility')} value={filters.visibility} onChange={(value) => setFilter('visibility', value)} />
                    </Field>
                    <Field label={t('admin.voices.catalog.filters.sourceKind')}>
                        <Select size="sm" options={filterOptions(SOURCE_KINDS, 'admin.voices.sourceKind')} value={filters.source_kind} onChange={(value) => setFilter('source_kind', value)} />
                    </Field>
                    <Field label={t('admin.voices.catalog.filters.callEligible')}>
                        <Select
                            size="sm"
                            options={[
                                { value: '', label: t('admin.voices.common.any') },
                                { value: 'true', label: t('admin.voices.common.yes') },
                                { value: 'false', label: t('admin.voices.common.no') },
                            ]}
                            value={filters.call_eligible}
                            onChange={(value) => setFilter('call_eligible', value)}
                        />
                    </Field>
                    <Field label={t('admin.voices.catalog.filters.acceptance')}>
                        <Select
                            size="sm"
                            options={filterOptions(['untested', 'accepted', 'failed'], 'admin.voices.catalog.filters.acceptanceStates')}
                            value={filters.acceptance}
                            onChange={(value) => setFilter('acceptance', value)}
                        />
                    </Field>
                </div>
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setFilters(EMPTY_FILTERS)
                            setTextDraft({ q: '', primary_language: '' })
                            resetPages()
                        }}
                    >
                        {t('admin.voices.catalog.filters.clear')}
                    </Button>
                </div>
            </div>

            <p aria-live="polite" className="font-ui text-sm text-parchment-300">
                {first.loading ? t('admin.voices.catalog.loading') : page ? t('admin.voices.catalog.count', { count: items.length }) : null}
            </p>

            {removalAbort && (
                <Callout
                    tone="warning"
                    role="alert"
                    data-testid="sync-mass-removal"
                    icon={<Icon icon={AlertTriangle} size={16} />}
                    action={
                        <Button variant="secondary" size="sm" onClick={() => setReviewingRemovals(true)}>
                            {t('admin.voices.catalog.massRemoval.review')}
                        </Button>
                    }
                >
                    <p className="font-semibold text-fg">{t('admin.voices.catalog.massRemoval.banner')}</p>
                    <p>{t('admin.voices.catalog.massRemoval.bannerHint')}</p>
                </Callout>
            )}

            {orphans > 0 && (
                <Callout
                    tone="warning"
                    role="alert"
                    data-testid="sync-replacement-orphans"
                    action={<Button variant="ghost" size="sm" onClick={() => setOrphans(0)}>{t('admin.voices.common.close')}</Button>}
                >
                    {t('admin.voices.catalog.sync.orphans', { count: orphans })}
                </Callout>
            )}

            {errorMessage && (
                <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={reloadList}>{t('admin.voices.common.retry')}</Button>}>
                    {errorMessage}
                </Callout>
            )}

            {page && items.length === 0 ? (
                <EmptyState message={t('admin.voices.catalog.empty')} secondaryText={t('admin.voices.catalog.emptyHint')} />
            ) : (
                items.length > 0 && <CatalogTable voices={items} onManage={setOpenKey} />
            )}

            {cursor && (
                <div>
                    <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
                        {loadingMore ? t('admin.voices.common.loading') : t('admin.voices.catalog.loadMore')}
                    </Button>
                </div>
            )}

            {openVoice && (
                <CatalogDetailDrawer
                    key={openVoice.voice_key}
                    voice={openVoice}
                    onClose={() => setOpenKey(null)}
                    onUpdated={applyUpdate}
                    onDependentsMoved={refetchAfterRepoint}
                />
            )}

            {reviewingRemovals && removalAbort && <MassRemovalDialog onClose={() => setReviewingRemovals(false)} onConfirmed={removalsConfirmed} />}
        </ConsoleSection>
    )
}
