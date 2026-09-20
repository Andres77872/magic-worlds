import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { LoreActivationPreviewResponse, Lorebook } from '@/shared'
import { isLorebookResourcesFeatureEnabled } from '@/shared/featureFlags'
import { Badge, Button, Callout, Field, Icon, Textarea } from '@/ui/primitives'
import { lorebookResourceStats, lorebookResourcesFromMetadata, withoutLorebookResourceMetadata } from '../lorebookResources'
import { previewLocally } from '../lorebookTransforms'

interface ActivationPreviewPanelProps {
    lorebook: Lorebook
    saved: boolean
}

export function ActivationPreviewPanel({ lorebook, saved: _saved }: ActivationPreviewPanelProps) {
    const { t } = useTranslation()
    const resourceFeaturesEnabled = isLorebookResourcesFeatureEnabled()
    const previewLorebook = useMemo(() => (
        resourceFeaturesEnabled ? lorebook : withoutLorebookResourceMetadata(lorebook)
    ), [lorebook, resourceFeaturesEnabled])
    const [sample, setSample] = useState('')
    const [preview, setPreview] = useState<LoreActivationPreviewResponse>(() => previewLocally(previewLorebook, ''))
    const [loading, setLoading] = useState(false)
    const [source, setSource] = useState<'backend' | 'local'>('local')
    const [error, setError] = useState<string | null>(null)
    const resourceStats = useMemo(() => (
        resourceFeaturesEnabled ? lorebookResourceStats(lorebookResourcesFromMetadata(previewLorebook.metadata)) : null
    ), [previewLorebook.metadata, resourceFeaturesEnabled])

    const activated = useMemo(() => preview.results.filter((result) => result.status === 'activated'), [preview.results])
    const skipped = preview.results.length - activated.length

    useEffect(() => {
        if (source === 'local') setPreview(previewLocally(previewLorebook, sample))
    }, [previewLorebook, sample, source])

    const runPreview = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await apiService.previewLoreActivation({
                targetKind: 'global',
                messages: [{ role: 'user', content: sample }],
                includePromptPreview: true,
                overrides: { lorebooks: [previewLorebook] },
            })
            setPreview(result)
            setSource('backend')
        } catch (e) {
            setPreview(previewLocally(previewLorebook, sample))
            setSource('local')
            setError(e instanceof Error ? e.message : t('lorebookStudio.activationPreview.backendUnavailable'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <section aria-label={t('lorebookStudio.activationPreview.title')} className="flex min-w-0 flex-col gap-4 border-t border-parchment-50/10 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-display text-h3 font-semibold text-parchment-50">{t('lorebookStudio.activationPreview.title')}</h3>
                    <p className="mt-1 font-narrative text-sm text-parchment-300">
                        {t('lorebookStudio.activationPreview.description')}
                    </p>
                </div>
                <Badge tone={source === 'backend' ? 'live' : 'neutral'}>{source === 'backend' ? t('lorebookStudio.activationPreview.sourceBackend') : t('lorebookStudio.activationPreview.sourceLocal')}</Badge>
            </div>

            <Field label={t('lorebookStudio.activationPreview.sampleLabel')}>
                <Textarea
                    value={sample}
                    onChange={(event) => setSample(event.target.value)}
                    placeholder={t('lorebookStudio.activationPreview.samplePlaceholder')}
                    className="min-h-[100px]"
                />
            </Field>

            <Button
                variant="primary"
                iconLeft={loading ? <Loader2 size={16} className="animate-spin" /> : <Icon icon={Play} size={16} />}
                onClick={runPreview}
                disabled={loading || !sample.trim()}
            >
                {t('lorebookStudio.activationPreview.run')}
            </Button>

            {error && (
                <Callout tone="danger" role="alert">
                    {error}
                </Callout>
            )}

            {resourceStats && resourceStats.pending > 0 && (
                <Callout tone="info">
                    {t('lorebookStudio.activationPreview.pendingResources', { count: resourceStats.pending })}
                </Callout>
            )}

            <dl className="grid grid-cols-2 gap-4 border-y border-parchment-50/10 py-4 sm:grid-cols-3">
                <div className="min-w-0">
                    <dt className="font-ui text-caption font-medium text-parchment-400">{t('lorebookStudio.activationPreview.statActivated')}</dt>
                    <dd className="mt-1 font-display text-2xl font-semibold text-parchment-50">{activated.length}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="font-ui text-caption font-medium text-parchment-400">{t('lorebookStudio.activationPreview.statSkipped')}</dt>
                    <dd className="mt-1 font-display text-2xl font-semibold text-parchment-50">{skipped}</dd>
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                    <dt className="font-ui text-caption font-medium text-parchment-400">{t('lorebookStudio.activationPreview.statTokens')}</dt>
                    <dd className="mt-1 font-display text-2xl font-semibold text-parchment-50">
                        {preview.totalEstimatedTokens}<span className="text-sm text-parchment-400">/{preview.tokenBudget}</span>
                    </dd>
                </div>
            </dl>

            <div className="min-w-0">
                <div className="border-b border-parchment-50/10 pb-3 font-ui text-body font-semibold text-parchment-50">
                    {t('lorebookStudio.activationPreview.traceTitle')}
                </div>
                <div className="max-h-[260px] overflow-y-auto divide-y divide-parchment-50/[.06]">
                    {preview.results.length === 0 ? (
                        <div className="px-4 py-6 text-center font-narrative text-sm text-parchment-300">{t('lorebookStudio.activationPreview.empty')}</div>
                    ) : (
                        preview.results.map((result) => (
                            <div key={`${result.lorebookId}-${result.entryId}`} className="py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-ui text-sm font-semibold text-parchment-50">{result.title}</span>
                                    <Badge tone={result.status === 'activated' ? 'live' : 'neutral'}>
                                        {result.status === 'activated'
                                            ? t('lorebookStudio.activationPreview.statusActivated')
                                            : t('lorebookStudio.activationPreview.statusSkipped')}
                                    </Badge>
                                </div>
                                {result.matchedKeys.length > 0 ? (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {result.matchedKeys.map((key) => (
                                            <span key={key} className="rounded-full bg-arcane-500/15 px-2 py-0.5 font-ui text-meta text-arcane-300">{key}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-1 font-ui text-xs text-parchment-400">{result.reason}</p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {preview.promptPreview && (
                <Callout tone="info" icon={<Icon icon={Sparkles} size={15} />}>
                    <div className="mb-2 font-ui text-sm font-semibold text-arcane-300">
                        {t('lorebookStudio.activationPreview.promptPreview')}
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-parchment-200">{preview.promptPreview}</pre>
                </Callout>
            )}
        </section>
    )
}
