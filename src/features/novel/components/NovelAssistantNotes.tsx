import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import type { PlanItems } from '../hooks/usePlanItems'
import { assistantNoteRef, assistantNoteTask, sentAssistantTasks } from '../utils/assistantFacts'

/** Developmental notes a saved reply makes. Sending makes open critique tasks; nothing in the manuscript changes. */
export function NovelAssistantNotes({ record, messageId, tasks, readOnly, sceneTitle }: {
    record: NovelAssistantRecord; messageId: number; tasks?: PlanItems<'task'>; readOnly: boolean; sceneTitle: (sceneId: string) => string | null
}) {
    const { t } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.notes.' + key, values)
    const [busy, setBusy] = useState(false), [outcome, setOutcome] = useState<{ sent: number; failed: boolean } | null>(null)
    const notes = record.result.notes ?? []
    if (!notes.length) return null
    const scene = (sceneId: string) => sceneTitle(sceneId) ?? text('missingScene')
    const sent = sentAssistantTasks(tasks?.items ?? [], 'critique')
    const pending = notes.map((_, index) => index).filter((index) => !sent.has(assistantNoteRef(messageId, index)))
    async function send() {
        if (!tasks || readOnly || busy || tasks.loading || tasks.error || !pending.length) return
        setBusy(true); setOutcome(null)
        let count = 0, failed = false
        for (const index of pending) {
            const label = { aspect: text('aspectLine', { value: text('aspect.' + notes[index].aspect) }), option: (option: string) => text('optionLine', { option }),
                also: (title: string, quote: string) => text('alsoLine', { scene: title, quote }), scene }
            try { await tasks.create(assistantNoteTask(record, messageId, index, label)); count++ } catch { failed = true }
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
            {notes.map((note, index) => <li key={index}><Card className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="arcane">{text('aspect.' + note.aspect)}</Badge>
                    <span className="text-label">{note.title}</span>
                    {sent.has(assistantNoteRef(messageId, index)) && <Badge tone="neutral">{text('inTasks')}</Badge>}
                </div>
                <p className="whitespace-pre-wrap text-body">{note.observation}</p>
                <div>
                    <p className="text-caption text-parchment-300">{text('options')}</p>
                    <ul className="list-disc space-y-0.5 pl-5 text-body text-parchment-200">{note.options.map((option, at) => <li key={at}>{option}</li>)}</ul>
                </div>
                <ul className="space-y-1">
                    {note.evidence.map((row, at) => <li key={at} className="space-y-0.5">
                        <p className="text-caption text-parchment-300">{scene(row.sceneId)}</p>
                        {row.excerpt && <blockquote className="whitespace-pre-wrap break-words font-narrative text-body text-parchment-200">{row.excerpt}</blockquote>}
                    </li>)}
                </ul>
            </Card></li>)}
        </ul>
    </section>
}
