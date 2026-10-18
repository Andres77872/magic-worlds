import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import type { PlanItems } from '../hooks/usePlanItems'
import { assistantFactData, assistantFactRef, sentAssistantFacts } from '../utils/assistantFacts'

/** Facts a saved reply proposes. Sending stages them as proposed; only the author approves them in Facts. */
export function NovelAssistantFacts({ record, messageId, facts, readOnly, sceneTitle }: {
    record: NovelAssistantRecord; messageId: number; facts?: PlanItems<'fact'>; readOnly: boolean; sceneTitle: (sceneId: string) => string | null
}) {
    const { t } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.facts.' + key, values)
    const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState<{ sent: number; failed: boolean } | null>(null)
    const proposed = record.result.facts ?? []
    if (!proposed.length) return null
    const sent = sentAssistantFacts(facts?.items ?? [])
    const pending = proposed.map((_, index) => index).filter((index) => !sent.has(assistantFactRef(messageId, index)))
    async function send() {
        if (!facts || readOnly || busy || facts.loading || facts.error || !pending.length) return
        setBusy(true); setOutcome(null)
        let count = 0, failed = false
        for (const index of pending) {
            try { await facts.create(assistantFactData(record, messageId, index), 'proposed'); count++ } catch { failed = true }
        }
        setOutcome({ sent: count, failed }); setBusy(false)
    }
    return <section aria-label={text('title')} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-h3">{text('title')}</h3>
            {facts && !readOnly && <Button size="sm" variant="secondary" disabled={busy || facts.loading || facts.error || !pending.length} onClick={() => void send()}>
                {pending.length ? text('send', { count: pending.length }) : text('allSent')}
            </Button>}
        </div>
        <p className="text-caption text-parchment-300">{text('help')}</p>
        {outcome && (outcome.failed
            ? <Callout tone="warning" role="alert">{text('failed', { count: outcome.sent })}</Callout>
            : <p role="status" className="text-caption text-parchment-200">{text('sent', { count: outcome.sent })}</p>)}
        <ul className="space-y-2">
            {proposed.map((fact, index) => <li key={index}><Card className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="arcane">{t('novelEditor.planningViews.facts.kinds.' + fact.kind)}</Badge>
                    <span className="text-label">{fact.subject}</span>
                    {fact.object && <span className="text-caption text-parchment-300">→ {fact.object}</span>}
                    {sent.has(assistantFactRef(messageId, index)) && <Badge tone="neutral">{text('inFacts')}</Badge>}
                </div>
                <p className="text-body">{fact.statement}</p>
                <p className="text-caption text-parchment-300">{sceneTitle(fact.sceneId) ?? text('missingScene')}</p>
                {fact.excerpt && <blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{fact.excerpt}</blockquote>}
            </Card></li>)}
        </ul>
    </section>
}
