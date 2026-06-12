import { useMemo, useState } from 'react'
import { Loader2, Play, Sparkles } from 'lucide-react'
import { apiService } from '@/infrastructure/api'
import type { LoreActivationPreviewResponse, Lorebook } from '@/shared'
import { Badge, Button, Field, Icon, Textarea } from '@/ui/primitives'
import { previewLocally } from '../lorebookTransforms'

interface ActivationPreviewPanelProps {
    lorebook: Lorebook
    saved: boolean
}

const DEFAULT_SAMPLE = 'I ask Mira about the Glass Market and show her the silver confession ring.'

export function ActivationPreviewPanel({ lorebook, saved }: ActivationPreviewPanelProps) {
    const [sample, setSample] = useState(DEFAULT_SAMPLE)
    const [preview, setPreview] = useState<LoreActivationPreviewResponse>(() => previewLocally(lorebook, DEFAULT_SAMPLE))
    const [loading, setLoading] = useState(false)
    const [source, setSource] = useState<'backend' | 'local'>('local')
    const [error, setError] = useState<string | null>(null)

    const activated = useMemo(() => preview.results.filter((result) => result.status === 'activated'), [preview.results])
    const skipped = preview.results.length - activated.length

    const runPreview = async () => {
        setLoading(true)
        setError(null)
        try {
            if (saved) {
                const result = await apiService.previewLoreActivation({
                    targetKind: 'global',
                    mode: 'continue',
                    messages: [{ role: 'user', content: sample }],
                    includePromptPreview: true,
                    overrides: { lorebookIds: [lorebook.id] },
                })
                setPreview(result)
                setSource('backend')
            } else {
                setPreview(previewLocally(lorebook, sample))
                setSource('local')
            }
        } catch (e) {
            setPreview(previewLocally(lorebook, sample))
            setSource('local')
            setError(e instanceof Error ? e.message : 'Backend preview unavailable')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-parchment-50/10 bg-ink-800 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-display text-xl font-semibold text-parchment-50">Activation test</h3>
                    <p className="mt-1 font-narrative text-sm text-parchment-300">
                        Test whether the current keys would retrieve useful lore from a sample turn.
                    </p>
                </div>
                <Badge tone={source === 'backend' ? 'live' : 'neutral'}>{source === 'backend' ? 'backend trace' : 'local draft'}</Badge>
            </div>

            <Field label="Sample chat text">
                <Textarea
                    value={sample}
                    onChange={(event) => setSample(event.target.value)}
                    className="min-h-[100px]"
                />
            </Field>

            <Button
                kind="arcane"
                iconLeft={loading ? <Loader2 size={16} className="animate-spin" /> : <Icon icon={Play} size={16} />}
                onClick={runPreview}
                disabled={loading || !sample.trim()}
            >
                Run preview
            </Button>

            {error && (
                <div className="rounded-lg border border-ember-500/25 bg-ember-500/10 px-4 py-3 font-ui text-sm text-parchment-200">
                    {error}
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-ink-700 px-4 py-3">
                    <div className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-parchment-400">Activated</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-parchment-50">{activated.length}</div>
                </div>
                <div className="rounded-lg bg-ink-700 px-4 py-3">
                    <div className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-parchment-400">Skipped</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-parchment-50">{skipped}</div>
                </div>
                <div className="rounded-lg bg-ink-700 px-4 py-3">
                    <div className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-parchment-400">Tokens</div>
                    <div className="mt-1 font-display text-2xl font-semibold text-parchment-50">
                        {preview.totalEstimatedTokens}<span className="text-sm text-parchment-400">/{preview.tokenBudget}</span>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-parchment-50/[.08]">
                <div className="border-b border-parchment-50/[.08] bg-ink-700 px-4 py-3 font-ui text-sm font-semibold text-parchment-50">
                    Trace
                </div>
                <div className="max-h-[260px] overflow-y-auto divide-y divide-parchment-50/[.06]">
                    {preview.results.length === 0 ? (
                        <div className="px-4 py-6 text-center font-narrative text-sm text-parchment-300">No entries to evaluate.</div>
                    ) : (
                        preview.results.map((result) => (
                            <div key={`${result.lorebookId}-${result.entryId}`} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-ui text-sm font-semibold text-parchment-50">{result.title}</span>
                                    <Badge tone={result.status === 'activated' ? 'live' : 'neutral'}>{result.status}</Badge>
                                </div>
                                {result.matchedKeys.length > 0 ? (
                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                        {result.matchedKeys.map((key) => (
                                            <span key={key} className="rounded-full bg-arcane-500/15 px-2 py-0.5 font-ui text-[11px] text-arcane-300">{key}</span>
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
                        Prompt preview
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-parchment-200">{preview.promptPreview}</pre>
                </div>
            )}
        </div>
    )
}
