import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import type { SceneSummaryOutcome, SceneSummaryWriter } from './NovelAssistantSummaries'
import { partState, wideState, type ReplySummaryState } from '../utils/replySummaryState'

const TONE = { ready: 'arcane', saved: 'ember', changed: 'warning', partial: 'neutral', unavailable: 'neutral' } as const
type Kind = 'chapter' | 'part' | 'book'
interface Row { key: string; kind: Kind; id: string | null; basis: string[]; complete: boolean; text: string }

/** A summary-action reply's chapter, part and book summaries. Each is saved separately, bound to the scene revisions it covered. */
export function NovelAssistantWideSummaries({ record, story, writer, readOnly }: {
    record: NovelAssistantRecord; story: StoryOutline; readOnly: boolean
    /** Absent where chapter, part and novel details cannot change. */
    writer?: SceneSummaryWriter
}) {
    const { t } = useTranslation()
    const [working, setWorking] = useState<string | null>(null), [outcome, setOutcome] = useState<{ key: string; value: SceneSummaryOutcome } | null>(null)
    const chapters: Row[] = (record.result.chapterSummaries ?? []).map(({ chapterId, ...row }) => ({ key: 'chapter:' + chapterId, kind: 'chapter', id: chapterId, ...row }))
    const parts: Row[] = (record.result.partSummaries ?? []).map(({ partId, ...row }) => ({ key: 'part:' + partId, kind: 'part', id: partId, ...row }))
    const book: Row[] = record.result.bookSummary ? [{ key: 'book', kind: 'book', id: null, ...record.result.bookSummary }] : []
    if (!chapters.length && !parts.length && !book.length) return null
    const stateOf = (row: Row): ReplySummaryState => row.kind === 'part' ? partState(story, { partId: row.id!, basis: row.basis, complete: row.complete, text: row.text })
        : wideState(story, { chapterId: row.id, basis: row.basis, complete: row.complete, text: row.text })
    const storeOf = (row: Row) => row.kind === 'chapter' ? writer?.saveChapter && ((text: string, basis: string[]) => writer.saveChapter!(row.id!, text, basis))
        : row.kind === 'part' ? writer?.savePart && ((text: string, basis: string[]) => writer.savePart!(row.id!, text, basis)) : writer?.saveBook
    async function save(row: Row) {
        const store = storeOf(row)
        if (!store || readOnly || working !== null || stateOf(row) !== 'ready') return
        setWorking(row.key); setOutcome(null)
        const value = await store(row.text, row.basis)
        setWorking(null); setOutcome({ key: row.key, value })
    }
    const section = (kind: Kind, rows: Row[]) => {
        const text = (key: string, values?: Record<string, unknown>) => t(`novelEditor.assistantSummaries.${kind}.${key}`, values)
        return rows.length > 0 && <section aria-label={text('title')} className="space-y-3">
            <h3 className="font-display text-h3">{text('title')}</h3>
            <p className="text-caption text-parchment-300">{text('help')}</p>
            <ul className="space-y-2">
                {rows.map(row => {
                    const state = stateOf(row), result = outcome?.key === row.key ? outcome.value : null
                    const unit = row.kind === 'chapter' ? story.chapters.find(chapter => chapter.id === row.id) : row.kind === 'part' ? story.parts.find(part => part.id === row.id) : null
                    const name = row.kind === 'book' ? story.title : unit?.title ?? text('missing')
                    const existing = row.kind === 'book' ? story.details.summary : unit?.details.summary
                    const store = storeOf(row)
                    return <li key={row.key}><Card className="space-y-2 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-label text-parchment-50">{name}</h4>
                            <Badge tone={TONE[state]}>{text('state.' + state)}</Badge>
                        </div>
                        <p className="text-caption text-parchment-400">{text('covers', { count: row.basis.length })}</p>
                        <p className="whitespace-pre-wrap break-words text-body text-parchment-200">{row.text}</p>
                        {state !== 'ready' && state !== 'saved' && result !== 'saved' && <p className="text-caption text-parchment-400">{text(state + 'Help')}</p>}
                        {state === 'ready' && existing && <p className="text-caption text-parchment-400">{text('replaces')}</p>}
                        {result && <Callout tone={result === 'saved' ? 'info' : 'warning'} role={result === 'saved' ? 'status' : 'alert'}>{result === 'failed' ? t('novelEditor.assistantSummaries.failed') : text(result, { name })}</Callout>}
                        {store && !readOnly && state === 'ready' && <div>
                            <Button size="sm" variant="secondary" disabled={working !== null} onClick={() => void save(row)}>{t(working === row.key ? 'novelEditor.assistantSummaries.saving' : `novelEditor.assistantSummaries.${kind}.save`)}</Button>
                        </div>}
                    </Card></li>
                })}
            </ul>
        </section>
    }
    return <>{section('chapter', chapters)}{section('part', parts)}{section('book', book)}</>
}
