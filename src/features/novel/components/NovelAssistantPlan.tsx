import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import type { PlanItems } from '../hooks/usePlanItems'
import { assistantStepRef, assistantStepTask, sentAssistantTasks } from '../utils/assistantFacts'

export interface PlanStepDraft { sceneId: string; instruction: string; number: number }

const STATE_TONE = { open: 'arcane', done: 'ember', dismissed: 'neutral', trashed: 'neutral' } as const

/**
 * A saved reply's plan: ordered one-scene steps. Drafting a step hands its instruction to the composer
 * for that scene, so every change still goes through prompt review, Send and suggestion review.
 * Progress is the steps' tasks; the plan itself writes nothing.
 */
export function NovelAssistantPlan({ record, messageId, tasks, readOnly, sceneTitle, drafted, onDraftStep }: {
    record: NovelAssistantRecord; messageId: number; tasks?: PlanItems<'task'>; readOnly: boolean; sceneTitle: (sceneId: string) => string | null
    /** Whether a later reply in this conversation already holds a suggestion for the step. */
    drafted: (step: PlanStepDraft) => boolean
    onDraftStep?: (step: PlanStepDraft) => boolean
}) {
    const { t } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.plan.' + key, values)
    const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState<{ sent: number; failed: boolean } | null>(null)
    const [markFailed, setMarkFailed] = useState(false)
    const plan = record.result.plan
    if (!plan) return null
    const tracked = sentAssistantTasks(tasks?.items ?? [], 'plan')
    const task = (index: number) => tracked.get(assistantStepRef(messageId, index))
    const untracked = plan.steps.map((_, index) => index).filter((index) => !task(index))
    const done = plan.steps.filter((_, index) => task(index)?.state === 'done').length
    const ready = Boolean(tasks && !readOnly && !busy && !tasks.loading && !tasks.error)
    async function track() {
        if (!tasks || !ready || !untracked.length) return
        setBusy(true); setOutcome(null)
        let count = 0, failed = false
        for (const index of untracked) {
            const label = { title: (title: string, number: number, total: number) => text('taskTitle', { plan: title, number, total }), revision: (revision: number) => text('revisionLine', { revision }) }
            try { await tasks.create(assistantStepTask(record, messageId, index, label)); count++ } catch { failed = true }
        }
        setOutcome({ sent: count, failed }); setBusy(false)
    }
    async function markDone(index: number) {
        const item = task(index)
        if (!tasks || !ready || !item || item.state !== 'open') return
        setBusy(true); setMarkFailed(false)
        try { await tasks.update(item, { state: 'done' }) } catch { setMarkFailed(true) } finally { setBusy(false) }
    }
    return <section aria-label={text('title')} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-h3">{text('title')} · {plan.title}</h3>
            {tasks && !readOnly && <Button size="sm" variant="secondary" disabled={!ready || !untracked.length} onClick={() => void track()}>
                {untracked.length ? text('track', { count: untracked.length }) : text('allTracked')}
            </Button>}
        </div>
        <p className="text-caption text-parchment-300">{text('help')}</p>
        {untracked.length < plan.steps.length && <p role="status" className="text-label">{text('progress', { done, total: plan.steps.length })}</p>}
        {outcome && (outcome.failed
            ? <Callout tone="warning" role="alert">{text('failed', { count: outcome.sent })}</Callout>
            : <p role="status" className="text-caption text-parchment-200">{text('tracked', { count: outcome.sent })}</p>)}
        {markFailed && <Callout tone="warning" role="alert">{text('markFailed')}</Callout>}
        <ol className="space-y-2">
            {plan.steps.map((step, index) => {
                const item = task(index), title = sceneTitle(step.sceneId), value = { sceneId: step.sceneId, instruction: step.instruction, number: index + 1 }
                return <li key={index}><Card className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-label">{text('step', { number: index + 1 })}</span>
                        <span className="text-caption text-parchment-300">{title ?? text('missingScene')}</span>
                        {item && <Badge tone={STATE_TONE[item.state]}>{text('state.' + item.state)}</Badge>}
                        {drafted(value) && <Badge tone="neutral">{text('drafted')}</Badge>}
                    </div>
                    <p className="whitespace-pre-wrap text-body">{step.instruction}</p>
                    {!readOnly && <div className="flex flex-wrap gap-2">
                        {onDraftStep && <Button size="sm" variant="secondary" disabled={busy || !title} onClick={() => onDraftStep(value)}>{text('draft')}</Button>}
                        {item?.state === 'open' && <Button size="sm" variant="ghost" disabled={!ready} onClick={() => void markDone(index)}>{text('markDone')}</Button>}
                    </div>}
                </Card></li>
            })}
        </ol>
    </section>
}
