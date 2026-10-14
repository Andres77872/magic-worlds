import { useTranslation } from 'react-i18next'
import type { AdminCatalogVoice, LegacyMappingCoverage } from '@/shared'
import { Badge } from '@/ui/primitives'
import { percent } from '../../format'
import { voiceName } from '../../voiceOptions'

interface CoverageReportProps {
    coverage: LegacyMappingCoverage
    byKey: Map<string, AdminCatalogVoice>
}

const UNMAPPED_SHOWN = 20

/** Forward coverage of the referenced legacy ids (C-1) plus legacy-ids-per-target (C-4; 05 §8.6, AC-R5). */
export function CoverageReport({ coverage, byKey }: CoverageReportProps) {
    const { t } = useTranslation()
    const rows = [{ id: 'referenced', label: t('admin.voices.mapping.coverage.referenced'), ...coverage.referenced }]
    const hiddenUnmapped = Math.max(0, coverage.unmapped_ids.length - UNMAPPED_SHOWN)

    return (
        <div className="flex flex-col gap-5">
            <section aria-labelledby="mapping-coverage-heading" className="flex flex-col gap-3 rounded-lg border border-line-faint bg-ink-800/70 p-4">
                <h3 id="mapping-coverage-heading" className="font-display text-base font-semibold text-fg">
                    {t('admin.voices.mapping.coverage.title')}
                </h3>
                <dl className="grid gap-3 sm:grid-cols-3">
                    {rows.map((row) => {
                        const met = row.total === 0 || row.mapped >= row.total
                        return (
                            <div key={row.id} className="flex flex-col gap-1 rounded-md border border-line-faint bg-ink-900 p-3">
                                <dt className="font-ui text-caption text-fg-muted">{row.label}</dt>
                                <dd className="flex flex-col gap-1">
                                    <span className="font-display text-lg font-semibold tabular-nums text-fg">
                                        {t('admin.voices.mapping.coverage.value', { mapped: row.mapped, total: row.total, percent: row.total ? percent(row.mapped, row.total) : 100 })}
                                    </span>
                                    <Badge tone={met ? 'live' : 'danger'}>
                                        {met ? t('admin.voices.mapping.coverage.gateMet') : t('admin.voices.mapping.coverage.gateOpen')}
                                    </Badge>
                                </dd>
                            </div>
                        )
                    })}
                </dl>
                <div className="flex flex-col gap-1.5">
                    <p className="font-ui text-label font-semibold text-fg">{t('admin.voices.mapping.coverage.unmapped')}</p>
                    {coverage.unmapped_ids.length === 0 ? (
                        <p className="font-ui text-sm text-fg-muted">{t('admin.voices.mapping.coverage.noUnmapped')}</p>
                    ) : (
                        <p className="font-mono text-xs leading-relaxed text-parchment-200">
                            {coverage.unmapped_ids.slice(0, UNMAPPED_SHOWN).join(', ')}
                            {hiddenUnmapped > 0 && ` ${t('admin.voices.mapping.coverage.more', { count: hiddenUnmapped })}`}
                        </p>
                    )}
                </div>
            </section>

            <section aria-labelledby="mapping-per-target-heading" className="flex flex-col gap-2">
                <h3 id="mapping-per-target-heading" className="font-display text-base font-semibold text-fg">
                    {t('admin.voices.mapping.legacyPerTarget.title')}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse font-ui text-sm">
                        <caption className="sr-only">{t('admin.voices.mapping.legacyPerTarget.caption')}</caption>
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.voices.mapping.legacyPerTarget.target')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 text-right font-semibold">{t('admin.voices.mapping.legacyPerTarget.legacyIds')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 pr-3 text-right font-semibold">{t('admin.voices.mapping.legacyPerTarget.coOccurring')}</th>
                                <th scope="col" className="border-b border-line-faint pb-2 text-right font-semibold">{t('admin.voices.mapping.legacyPerTarget.alternates')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coverage.legacy_ids_per_target.map((metric) => {
                                const needsAlternates = metric.alternates < Math.max(0, metric.co_occurring_ids - 1)
                                return (
                                    <tr key={metric.voice_key}>
                                        <th scope="row" className="border-b border-line-faint py-2 pr-3 text-left font-normal text-parchment-100">
                                            {voiceName(byKey.get(metric.voice_key), metric.voice_key, t)}
                                            {needsAlternates && (
                                                <Badge tone="warning" className="ml-2">
                                                    {t('admin.voices.mapping.legacyPerTarget.needsAlternates')}
                                                </Badge>
                                            )}
                                        </th>
                                        <td className="border-b border-line-faint py-2 pr-3 text-right tabular-nums text-parchment-200">{metric.legacy_ids}</td>
                                        <td className="border-b border-line-faint py-2 pr-3 text-right tabular-nums text-parchment-200">{metric.co_occurring_ids}</td>
                                        <td className="border-b border-line-faint py-2 text-right tabular-nums text-parchment-200">{metric.alternates}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
