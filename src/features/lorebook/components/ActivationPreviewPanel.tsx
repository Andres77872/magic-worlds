import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { LoreActivationPreviewResponse, Lorebook } from '@/shared'
import { Badge, Button, Field, Icon, Textarea } from '@/ui/primitives'
import { lorebookResourceStats, lorebookResourcesFromMetadata } from '../lorebookResources'
import { previewLocally } from '../lorebookTransforms'

interface ActivationPreviewPanelProps {
    lorebook: Lorebook
    saved: boolean
}

const DEFAULT_SAMPLE = 'I ask Mira about the Glass Market and show her the silver confession ring.'

export function ActivationPreviewPanel({ lorebook, saved: _saved }: ActivationPreviewPanelProps) {
    const { t } = useTranslation()
    const [sample, setSample] = useState(DEFAULT_SAMPLE)
    const [preview, setPreview] = useState<LoreActivationPreviewResponse>(() => previewLocally(lorebook, DEFAULT_SAMPLE))
    const [loading, setLoading] = useState(false)
    const [source, setSource] = useState<'backend' | 'local'>('local')
    const [error, setError] = useState<string | null>(null)
    const resourceStats = useMemo(() => lorebookResourceStats(lorebookResourcesFromMetadata(lorebook.metadata)), [lorebook.metadata])

    const activated = useMemo(() => preview.results.filter((result) => result.status === 'activated'), [preview.results])
    const skipped = preview.results.length - activated.length

    useEffect(() => {
        if (source === 'local') setPreview(previewLocally(lorebook, sample))
    }, [lorebook, sample, source])

    const runPreview = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await apiService.previewLoreActivation({
                targetKind: 'global',
                mode: 'continue',
                messages: [{ role: 'user', content: sample }],
                includePromptPreview: true,
                overrides: { lorebooks: [lorebook] },
            })
            setPreview(result)
            setSource('backend')
        } catch (e) {
            setPreview(previewLocally(lorebook, sample))
            setSource('local')
            setError(e instanceof Error ? e.message : t('lorebookStudio.activationPreview.backendUnavailable'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-display text-xl font-semibold text-parchment-50">{t('lorebookStudio.activationPreview.title')}</h3>
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
                variant="arcane"
                iconLeft={loading ? <Loader2 size={16} className="animate-spin" /> : <Icon icon={Play} size={16} />}
                onClick={runPreview}
                disabled={loading || !sample.trim()}
            >
                {t('lorebookStudio.activationPreview.run')}
            </Button>

            {error && (
                <div className="rounded-lg border border-ember-500/25 bg-ember-500/10 px-4 py-3 font-ui text-sm text-parchment-200">
                    {error}
                </div>
            )}

            {resourceStats.pending > 0 && (
                <div className="rounded-lg border border-arcane-500/25 bg-arcane-500/10 px-4 py-3 font-ui text-sm text-parchment-200">
                    {t('lorebookStudio.activationPreview.pendingResources', { count: resourceStats.pending })}
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-ink-700 px-4 py-3">
                    <div className="font-ui text-meta font-semibold uppercase tracking-[0.14em] text-parchment-400">{t('lorebookStudio.activationPreview.statActivated')}</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-parchment-50">{activated.length}</div>
                </div>
                <div className="rounded-lg bg-ink-700 px-4 py-3">
                    <div className="font-ui text-meta font-semibold uppercase tracking-[0.14em] text-parchment-400">{t('lorebookStudio.activationPreview.statSkipped')}</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-parchment-50">{skipped}</div>
                </div>
                <div className="rounded-lg bg-ink-700 px-4 py-3">
                    <div className="font-ui text-meta font-semibold uppercase tracking-[0.14em] text-parchment-400">{t('lorebookStudio.activationPreview.statTokens')}</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-parchment-50">
                        {preview.totalEstimatedTokens}<span className="text-sm text-parchment-400">/{preview.tokenBudget}</span>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-parchment-50/[.08]">
                <div className="border-b border-parchment-50/[.08] bg-ink-700 px-4 py-3 font-ui text-sm font-semibold text-parchment-50">
                    {t('lorebookStudio.activationPreview.traceTitle')}
                </div>
                <div className="max-h-[260px] overflow-y-auto divide-y divide-parchment-50/[.06]">
                    {preview.results.length === 0 ? (
                        <div className="px-4 py-6 text-center font-narrative text-sm text-parchment-300">{t('lorebookStudio.activationPreview.empty')}</div>
                    ) : (
                        preview.results.map((result) => (
                            <div key={`${result.lorebookId}-${result.entryId}`} className="px-4 py-3">
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
                <div className="rounded-lg border border-arcane-500/20 bg-arcane-500/10 p-4">
                    <div className="mb-2 inline-flex items-center gap-2 font-ui text-sm font-semibold text-arcane-300">
                        <Icon icon={Sparkles} size={15} />
                        {t('lorebookStudio.activationPreview.promptPreview')}
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-parchment-200">{preview.promptPreview}</pre>
                </div>
            )}
        </div>
    )
}
