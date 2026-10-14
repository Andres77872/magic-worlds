/**
 * Impact view (D19, D20, AC-R2): required before Retire and Set replacement.
 * Reference counts per `ref_type`, distinct owners, up to 20 examples and the
 * D33 collision count (computed for the stored replacement until 05 §8.2 A6).
 */
import { useTranslation } from 'react-i18next'
import { apiService } from '@/infrastructure/api'
import type { AdminCatalogImpact, AdminCatalogVoice, VoiceReferenceType } from '@/shared'
import { Button, Callout, Modal } from '@/ui/primitives'
import { formatNumber } from '../../format'
import { useAbortableLoad } from '../../hooks/useAbortableLoad'
import { useLoadErrorMessage, useVoiceConsole } from '../shell/VoiceConsoleContext'

const REF_TYPES: VoiceReferenceType[] = ['card', 'card_draft', 'card_version', 'preset', 'template_cast', 'session_snapshot']

export type ImpactMode = 'retire' | 'replacement'

interface ImpactDialogProps {
    voice: AdminCatalogVoice
    mode: ImpactMode
    processing: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ImpactDialog({ voice, mode, processing, onConfirm, onCancel }: ImpactDialogProps) {
    const { t } = useTranslation()
    const impact = useAbortableLoad<AdminCatalogImpact>((signal) => apiService.getAdminCatalogImpact(voice.voice_key, signal), voice.voice_key)
    const errorMessage = useLoadErrorMessage(impact.error)
    const title =
        mode === 'retire'
            ? t('admin.voices.catalog.impact.retireTitle', { name: voice.display_name })
            : t('admin.voices.catalog.impact.replacementTitle', { name: voice.display_name })

    return (
        <Modal
            open
            onClose={() => {
                if (!processing) onCancel()
            }}
            title={title}
            size="lg"
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={onCancel} disabled={processing}>
                        {t('admin.voices.common.cancel')}
                    </Button>
                    <Button variant={mode === 'retire' ? 'danger' : 'primary'} onClick={onConfirm} disabled={processing || !impact.data}>
                        {processing
                            ? t('admin.voices.common.saving')
                            : mode === 'retire'
                              ? t('admin.voices.catalog.impact.confirmRetire')
                              : t('admin.voices.catalog.impact.confirmReplacement')}
                    </Button>
                </div>
            }
        >
            <ImpactSummary impact={impact.data} loading={impact.loading} error={errorMessage} onRetry={impact.reload} />
        </Modal>
    )
}

interface ImpactSummaryProps {
    impact: AdminCatalogImpact | null
    loading: boolean
    error: string | null
    onRetry: () => void
}

export function ImpactSummary({ impact, loading, error, onRetry }: ImpactSummaryProps) {
    const { t } = useTranslation()
    const { locale } = useVoiceConsole()

    if (error) {
        return (
            <Callout tone="danger" role="alert" action={<Button variant="secondary" size="sm" onClick={onRetry}>{t('admin.voices.common.retry')}</Button>}>
                {error}
            </Callout>
        )
    }
    if (loading || !impact) return <p role="status" className="font-ui text-sm text-fg-muted">{t('admin.voices.catalog.impact.loading')}</p>

    return (
        <div className="flex flex-col gap-4">
            <p className="font-ui text-sm text-parchment-200">{t('admin.voices.catalog.impact.intro')}</p>
            <dl className="grid grid-cols-3 gap-3">
                {[
                    { label: t('admin.voices.catalog.impact.total'), value: impact.total_references },
                    { label: t('admin.voices.catalog.impact.owners'), value: impact.distinct_owners },
                    { label: t('admin.voices.catalog.impact.collisions'), value: impact.collision_count },
                ].map((item) => (
                    <div key={item.label} className="rounded-md border border-line-faint bg-ink-900 p-3">
                        <dt className="font-ui text-caption text-fg-muted">{item.label}</dt>
                        <dd className="font-display text-xl font-semibold tabular-nums text-fg">{formatNumber(item.value, locale)}</dd>
                    </div>
                ))}
            </dl>
            <p className="font-ui text-caption text-fg-muted">{t('admin.voices.catalog.impact.collisionsNote')}</p>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse font-ui text-sm">
                    <caption className="mb-2 text-left font-ui text-label font-semibold text-fg">{t('admin.voices.catalog.impact.refTypeCaption')}</caption>
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-parchment-400">
                            <th scope="col" className="border-b border-line-faint pb-2 pr-3 font-semibold">{t('admin.voices.catalog.impact.refTypeColumn')}</th>
                            <th scope="col" className="border-b border-line-faint pb-2 text-right font-semibold">{t('admin.voices.catalog.impact.countColumn')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REF_TYPES.map((refType) => (
                            <tr key={refType}>
                                <th scope="row" className="border-b border-line-faint py-2 pr-3 text-left font-normal text-parchment-100">
                                    {t(`admin.voices.catalog.impact.refType.${refType}`)}
                                </th>
                                <td className="border-b border-line-faint py-2 text-right tabular-nums text-parchment-200">
                                    {formatNumber(impact.reference_counts[refType] ?? 0, locale)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-col gap-2">
                <p className="font-ui text-label font-semibold text-fg">{t('admin.voices.catalog.impact.examples')}</p>
                <p className="font-ui text-caption text-fg-muted">{t('admin.voices.catalog.impact.examplesNote')}</p>
                {impact.examples.length === 0 ? (
                    <p className="font-ui text-sm text-fg-muted">{t('admin.voices.catalog.impact.noExamples')}</p>
                ) : (
                    <ul className="flex flex-col divide-y divide-line-faint">
                        {impact.examples.slice(0, 20).map((example) => (
                            <li key={`${example.ref_type}-${example.ref_id}`} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5 font-ui text-sm">
                                <span className="text-parchment-100">
                                    {example.label ??
                                        t('admin.voices.catalog.impact.exampleLabel', {
                                            type: t(`admin.voices.catalog.impact.refType.${example.ref_type}`),
                                            id: example.ref_id,
                                        })}
                                </span>
                                <span className="font-mono text-[11px] text-fg-muted">{example.ref_id}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
