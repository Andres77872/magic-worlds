/**
 * Legacy mapping (03 §5.2, D21, D33, 05 §8.6, AC-R5): forward mapping of every
 * stored legacy voice id to a catalog voice with ordered alternates, coverage
 * and the legacy-ids-per-target metric. The mapping is pure data: stored V1
 * voices play through it (unmapped ones through the defaults), and the R5
 * rewrite reads it. No provider call is made from this module (I-68).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Map as MapIcon } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { LegacyMappingCoverage, LegacyMappingListResponse, LegacyMappingRow } from '@/shared'
import { Badge, Button, Callout, Field, Input, Select } from '@/ui/primitives'
import { formatDate, formatNumber } from '../../format'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { voiceName } from '../../voiceOptions'
import { CheckboxField } from '../shell/CheckboxField'
import { ConsoleSection } from '../shell/ConsoleSection'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'
import { CoverageReport } from './CoverageReport'
import { MappingEditorDrawer } from './MappingEditorDrawer'

const loadMapping = (signal: AbortSignal) => apiService.listLegacyMapping(signal)
const loadCoverage = (signal: AbortSignal) => apiService.getLegacyMappingCoverage(signal)

const cell = 'border-b border-line-faint py-2 pr-3 align-top'

export function LegacyMappingModule() {
    const { t } = useTranslation()
    const { catalog, languageName, locale } = useVoiceConsole()
    const mapping = useAbortableLoad<LegacyMappingListResponse>(loadMapping, 'legacy-mapping')
    const coverage = useAbortableLoad<LegacyMappingCoverage>(loadCoverage, 'legacy-coverage')
    const mappingError = useLoadErrorMessage(mapping.error ?? coverage.error)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [unmappedOnly, setUnmappedOnly] = useState(false)
    const [editing, setEditing] = useState<string | null>(null)

    const mappingRows = useMemo(() => new Map((mapping.data?.items ?? []).map((row) => [row.legacy_voice_id, row])), [mapping.data])

    const needle = search.trim().toLowerCase()
    const rows = (mapping.data?.items ?? []).filter((row) => {
        if (unmappedOnly && row.voice_key) return false
        if (status && row.status !== status) return false
        if (!needle) return true
        return row.legacy_voice_id.toLowerCase().includes(needle)
    })
    const editingRow = editing ? mappingRows.get(editing) : undefined

    const applySaved = (saved: LegacyMappingRow) => {
        mapping.setData((previous) =>
            previous ? { items: previous.items.map((row) => (row.legacy_voice_id === saved.legacy_voice_id ? saved : row)) } : previous,
        )
        coverage.reload()
        setEditing(null)
    }

    return (
        <ConsoleSection icon={MapIcon} title={t('admin.voices.mapping.title')} description={t('admin.voices.mapping.description')}>
            {mappingError && (
                <Callout
                    tone="danger"
                    role="alert"
                    action={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                mapping.reload()
                                coverage.reload()
                            }}
                        >
                            {t('admin.voices.common.retry')}
                        </Button>
                    }
                >
                    {mappingError}
                </Callout>
            )}

            {coverage.data && <CoverageReport coverage={coverage.data} byKey={catalog.byKey} />}

            <section aria-labelledby="mapping-table-heading" className="flex flex-col gap-3">
                <h3 id="mapping-table-heading" className="font-display text-base font-semibold text-fg">
                    {t('admin.voices.mapping.columns.caption')}
                </h3>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
                    <Field label={t('admin.voices.mapping.filters.search')}>
                        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </Field>
                    <Field label={t('admin.voices.mapping.filters.status')}>
                        <Select
                            size="sm"
                            options={[
                                { value: '', label: t('admin.voices.common.any') },
                                ...(['proposed', 'approved', 'retired'] as const).map((value) => ({ value, label: t(`admin.voices.mapping.status.${value}`) })),
                            ]}
                            value={status}
                            onChange={setStatus}
                        />
                    </Field>
                    <CheckboxField label={t('admin.voices.mapping.filters.unmappedOnly')} checked={unmappedOnly} onChange={setUnmappedOnly} className="pb-2" />
                </div>
                {mapping.loading && !mapping.data ? (
                    <p role="status" className="font-ui text-sm text-fg-muted">{t('admin.voices.common.loading')}</p>
                ) : rows.length === 0 ? (
                    <p className="font-ui text-sm text-fg-muted">{t('admin.voices.mapping.empty')}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] border-collapse font-ui text-sm">
                            <caption className="sr-only">{t('admin.voices.mapping.columns.caption')}</caption>
                            <thead>
                                <tr className="text-left text-meta uppercase tracking-[0.08em] text-parchment-400">
                                    {(['legacyVoice', 'language', 'references', 'status', 'target', 'alternates', 'reviewed', 'actions'] as const).map((column) => (
                                        <th key={column} scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">
                                            {t(`admin.voices.mapping.columns.${column}`)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.legacy_voice_id}>
                                        <th scope="row" className={`${cell} text-left font-normal font-mono text-xs text-parchment-50`}>
                                            {row.legacy_voice_id}
                                        </th>
                                        <td className={`${cell} text-parchment-200`}>{row.legacy_language ? languageName(row.legacy_language) : '—'}</td>
                                        <td className={`${cell} tabular-nums text-parchment-200`}>{formatNumber(row.reference_count, locale)}</td>
                                        <td className={cell}>
                                            <Badge tone={row.status === 'approved' ? 'live' : row.status === 'retired' ? 'neutral' : 'warning'}>
                                                {t(`admin.voices.mapping.status.${row.status}`)}
                                            </Badge>
                                        </td>
                                        <td className={`${cell} text-parchment-100`}>
                                            {row.voice_key ? voiceName(catalog.byKey.get(row.voice_key), row.voice_key, t) : <Badge tone="danger">{t('admin.voices.mapping.unmapped')}</Badge>}
                                        </td>
                                        <td className={`${cell} tabular-nums text-parchment-200`}>{row.alternate_voice_keys.length}</td>
                                        <td className={`${cell} text-parchment-300`}>{formatDate(row.reviewed_at, locale)}</td>
                                        <td className={cell}>
                                            <Button
                                                variant="secondary"
                                                size="xs"
                                                aria-label={t('admin.voices.mapping.edit', { id: row.legacy_voice_id })}
                                                onClick={() => setEditing(row.legacy_voice_id)}
                                            >
                                                {t('admin.voices.mapping.editShort')}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {editingRow && (
                <MappingEditorDrawer
                    key={editingRow.legacy_voice_id}
                    row={editingRow}
                    onClose={() => setEditing(null)}
                    onSaved={applySaved}
                />
            )}
        </ConsoleSection>
    )
}
