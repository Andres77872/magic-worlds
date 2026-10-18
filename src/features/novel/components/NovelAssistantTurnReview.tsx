import { useTranslation } from 'react-i18next'
import type { NovelAssistantTurnPreview } from '@/shared/types/storyAssistant.types'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import { Badge, Callout, Card } from '@/ui/primitives'
import { NovelAssistantSources } from './NovelAssistantSources'
import { NovelRefinementSummary } from './NovelRefinementSummary'
import { NovelPresetProvenance } from './NovelPresetProvenance'

/** Exact published profile, eligible history, source packet and symbolic provider payload. */
export function NovelAssistantTurnReview({ preview, story, current }: { preview: NovelAssistantTurnPreview; story: StoryOutline; current: boolean }) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.' + key, values)
    return <section aria-label={text('review')} className="space-y-4">
        <Callout role="status" tone={current ? 'success' : 'warning'}>{text(current ? 'reviewCurrent' : 'reviewStale')}</Callout>
        <Card className="space-y-2 p-4">
            <h3 className="font-display text-h3">{text('review')}</h3>
            <Badge tone="arcane">{preview.profile.roles.primary.provider_model_id}</Badge>
            <p className="text-label text-parchment-200">{text('profileRevision', { revision: preview.profile.revision_id })}</p>
            <p className="text-label text-parchment-200">{text('estimate', { input: preview.inputEstimate, output: preview.context.trace.outputReserve })}</p>
            <p className="text-caption text-parchment-300">{text('historyCount', { count: preview.history.included.length })}</p>
            {preview.history.excluded.map(row => <p key={row.messageId} className="text-caption text-parchment-300">{text('historyExcluded', { id: row.messageId, reason: text('historyReasons.' + row.reason) })}</p>)}
            <p className="break-all font-mono text-caption text-parchment-300">{text('promptHash', { hash: preview.promptHash })}</p>
        </Card>
        <NovelAssistantSources value={preview.context} story={story} current={current} />
        {preview.refinement&&<NovelRefinementSummary value={preview.refinement} />}
        {preview.preset&&<NovelPresetProvenance value={preview.preset} />}
        <details className="space-y-2"><summary className="cursor-pointer text-label">{text('fullPayload')}</summary><pre className="whitespace-pre-wrap break-words rounded-md bg-ink-900 p-3 font-mono text-caption text-parchment-200">{JSON.stringify(preview.payload, null, 2)}</pre></details>
        <details className="space-y-2"><summary className="cursor-pointer text-label">{text('profileDetails')}</summary><pre className="whitespace-pre-wrap break-words rounded-md bg-ink-900 p-3 font-mono text-caption text-parchment-200">{JSON.stringify(preview.profile, null, 2)}</pre></details>
    </section>
}
