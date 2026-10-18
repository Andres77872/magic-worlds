import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NovelAssistantRecord } from '@/shared/types/storyAssistant.types'
import type { StoryOutline } from '@/shared/types/storyStudio.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import { summaryState } from '../utils/replySummaryState'

export type SceneSummaryOutcome = 'saved' | 'changed' | 'unavailable' | 'failed'
export interface SceneSummaryWriter {
    /** Saves the text as the scene's summary, written for the given prose revision, behind the studio's save barrier. */
    save: (sceneId: string, text: string, revision: number) => Promise<SceneSummaryOutcome>
    /** Saves a chapter's or the novel's summary, written for the `sceneId@revision` list it read (rest of K09/A14). */
    saveChapter?: (chapterId: string, text: string, basis: string[]) => Promise<SceneSummaryOutcome>
    saveBook?: (text: string, basis: string[]) => Promise<SceneSummaryOutcome>
    /** Saves a part's summary the same way (rest of K09). */
    savePart?: (partId: string, text: string, basis: string[]) => Promise<SceneSummaryOutcome>
}
const TONE = { ready: 'arcane', saved: 'ember', changed: 'warning', partial: 'neutral', unavailable: 'neutral' } as const

/** A reply's scene summaries. Each is saved separately as its scene's summary, bound to the revision the reply read. */
export function NovelAssistantSummaries({ record, story, writer, readOnly, sceneTitle }: {
    record: NovelAssistantRecord; story: StoryOutline; readOnly: boolean
    /** Absent where scene details cannot change. */
    writer?: SceneSummaryWriter
    sceneTitle: (sceneId: string) => string | null
}) {
    const { t } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistantSummaries.' + key, values)
    const [working, setWorking] = useState<number | null>(null), [outcome, setOutcome] = useState<{ index: number; value: SceneSummaryOutcome } | null>(null)
    const rows = record.result.summaries ?? []
    if (!rows.length) return null
    const current = (sceneId: string) => story.chapters.flatMap(chapter => chapter.scenes).find(scene => scene.id === sceneId)
    // Scene titles repeat across chapters ("Scene 1"), so each card names its chapter too.
    const label = (sceneId: string) => {
        const chapter = story.chapters.find(chapter => chapter.scenes.some(scene => scene.id === sceneId)), title = sceneTitle(sceneId)
        return title === null ? text('missingScene') : chapter ? chapter.title + ' · ' + title : title
    }
    async function save(index: number) {
        const row = rows[index]
        if (!writer || readOnly || working !== null || summaryState(story, row) !== 'ready') return
        setWorking(index); setOutcome(null)
        const value = await writer.save(row.sceneId, row.text, row.revision)
        setWorking(null); setOutcome({ index, value })
    }
    return <section aria-label={text('title')} className="space-y-3">
        <h3 className="font-display text-h3">{text('title')}</h3>
        <p className="text-caption text-parchment-300">{text('help')}</p>
        <ul className="space-y-2">
            {rows.map((row, index) => {
                const state = summaryState(story, row), scene = label(row.sceneId)
                const existing = current(row.sceneId)?.details.summary, result = outcome?.index === index ? outcome.value : null
                return <li key={row.sceneId}><Card className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-label text-parchment-50">{scene}</h4>
                        <Badge tone={TONE[state]}>{text('state.' + state)}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-body text-parchment-200">{row.text}</p>
                    {state !== 'ready' && state !== 'saved' && result !== 'saved' && <p className="text-caption text-parchment-400">{text(state + 'Help')}</p>}
                    {state === 'ready' && existing && <p className="text-caption text-parchment-400">{text('replaces')}</p>}
                    {result && <Callout tone={result === 'saved' ? 'info' : 'warning'} role={result === 'saved' ? 'status' : 'alert'}>{text(result, { scene })}</Callout>}
                    {writer && !readOnly && state === 'ready' && <div>
                        <Button size="sm" variant="secondary" disabled={working !== null} onClick={() => void save(index)}>{text(working === index ? 'saving' : 'save')}</Button>
                    </div>}
                </Card></li>
            })}
        </ul>
    </section>
}
