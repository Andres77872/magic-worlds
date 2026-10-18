import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import type { PlanItems } from '../hooks/usePlanItems'
import { assistantIssueRef, assistantIssueTask, sentAssistantIssues } from '../utils/assistantFacts'

const TONE = { certain: 'warning', likely: 'arcane', possible: 'neutral' } as const

/** Continuity issues a saved reply raises. Sending makes open continuity tasks; nothing in the manuscript changes. */
export function NovelAssistantIssues({ record, messageId, tasks, readOnly, sceneTitle }: {
    record: NovelAssistantRecord; messageId: number; tasks?: PlanItems<'task'>; readOnly: boolean; sceneTitle: (sceneId: string) => string | null
}) {
    const { t } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.issues.' + key, values)
    const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState<{ sent: number; failed: boolean } | null>(null)
    const issues = record.result.issues ?? []
    if (!issues.length) return null
    const scene = (sceneId: string) => sceneTitle(sceneId) ?? text('missingScene')
    const factStatement = (id: string) => { const fact = record.context.packet.facts?.find((row) => row.id === id); return fact ? `${fact.subject}: ${fact.statement}` : id }
    const sent = sentAssistantIssues(tasks?.items ?? [])
    const pending = issues.map((_, index) => index).filter((index) => !sent.has(assistantIssueRef(messageId, index)))
    async function send() {
        if (!tasks || readOnly || busy || tasks.loading || tasks.error || !pending.length) return
        setBusy(true); setOutcome(null)
        let count = 0, failed = false
        for (const index of pending) {
            const label = { certainty: text('certaintyLine', { value: text('certainty.' + issues[index].certainty) }), scene, also: (title: string, quote: string) => text('alsoLine', { scene: title, quote }),
                fact: (id: string) => text('contradicts', { statement: factStatement(id) }) }
            try { await tasks.create(assistantIssueTask(record, messageId, index, label)); count++ } catch { failed = true }
        }
        setOutcome({ sent: count, failed }); setBusy(false)
    }
    return <section aria-label={text('title')} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-h3">{text('title')}</h3>
            {tasks && !readOnly && <Button size="sm" variant="secondary" disabled={busy || tasks.loading || tasks.error || !pending.length} onClick={() => void send()}>
                {pending.length ? text('send', { count: pending.length }) : text('allSent')}
            </Button>}
        </div>
        <p className="text-caption text-parchment-300">{text('help')}</p>
        {outcome && (outcome.failed
            ? <Callout tone="warning" role="alert">{text('failed', { count: outcome.sent })}</Callout>
            : <p role="status" className="text-caption text-parchment-200">{text('sent', { count: outcome.sent })}</p>)}
        <ul className="space-y-2">
            {issues.map((issue, index) => <li key={index}><Card className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[issue.certainty]}>{text('certainty.' + issue.certainty)}</Badge>
                    <span className="text-label">{issue.title}</span>
                    {sent.has(assistantIssueRef(messageId, index)) && <Badge tone="neutral">{text('inTasks')}</Badge>}
                </div>
                <p className="whitespace-pre-wrap text-body">{issue.detail}</p>
                {issue.facts?.map((id) => <p key={id} className="text-caption text-parchment-200">{text('contradicts', { statement: factStatement(id) })}</p>)}
                <ul className="space-y-1">
                    {issue.evidence.map((row, at) => <li key={at} className="space-y-0.5">
                        <p className="text-caption text-parchment-300">{scene(row.sceneId)}</p>
                        {row.excerpt && <blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{row.excerpt}</blockquote>}
                    </li>)}
                </ul>
            </Card></li>)}
        </ul>
    </section>
}
