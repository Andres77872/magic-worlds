import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import { Button, Callout } from '@/ui/primitives'
import { partState, summaryState, wideState } from '../utils/replySummaryState'
import type { SceneSummaryOutcome, SceneSummaryWriter } from './NovelAssistantSummaries'

/**
 * Saves every summary of a reply that is ready today, one after another through the same guarded writers as the
 * single saves (rest of K09): scenes, then chapters, then parts, then the book. It is the author's one step after
 * review; a summary that changed meanwhile is skipped.
 */
export function NovelAssistantSaveAll({ record, story, writer, readOnly }: {
    record: NovelAssistantRecord; story: StoryOutline; readOnly: boolean; writer?: SceneSummaryWriter
}) {
    const { t } = useTranslation(), text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistantSummaries.saveAll.' + key, values)
    const [working, setWorking] = useState(false)
    const [result, setResult] = useState<{ saved: number; skipped: number } | null>(null)
    if (!writer || readOnly) return null
    const reply = record.result
    const saves: Array<() => Promise<SceneSummaryOutcome>> = [
        ...(reply.summaries ?? []).filter((row) => summaryState(story, row) === 'ready').map((row) => () => writer.save(row.sceneId, row.text, row.revision)),
        ...(writer.saveChapter ? (reply.chapterSummaries ?? []).filter((row) => wideState(story, row) === 'ready')
            .map((row) => () => writer.saveChapter!(row.chapterId, row.text, row.basis)) : []),
        ...(writer.savePart ? (reply.partSummaries ?? []).filter((row) => partState(story, row) === 'ready')
            .map((row) => () => writer.savePart!(row.partId, row.text, row.basis)) : []),
        ...(writer.saveBook && reply.bookSummary && wideState(story, { chapterId: null, ...reply.bookSummary }) === 'ready'
            ? [() => writer.saveBook!(reply.bookSummary!.text, reply.bookSummary!.basis)] : []),
    ]
    if (saves.length < 2 && !result) return null
    async function saveAll() {
        if (working) return
        setWorking(true); setResult(null)
        let saved = 0
        for (const save of saves) if (await save() === 'saved') saved++
        setWorking(false); setResult({ saved, skipped: saves.length - saved })
    }
    return <div className="space-y-2">
        {saves.length >= 2 && <Button size="sm" disabled={working} onClick={() => void saveAll()}>{working ? text('saving') : text('save', { count: saves.length })}</Button>}
        {result && <Callout tone={result.skipped ? 'warning' : 'info'} role={result.skipped ? 'alert' : 'status'}>
            {text('saved', { count: result.saved })}{result.skipped > 0 && ' ' + text('skipped', { count: result.skipped })}</Callout>}
    </div>
}
