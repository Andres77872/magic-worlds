import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline } from '@/shared'
import type { NovelAssistantRecord, NovelAssistantStructureChange } from '@/shared/types/storyAssistant.types'
import { Badge, Button, Callout, Card } from '@/ui/primitives'
import type { BulkScenes } from './NovelBulkScenes'
import { newPartChapters, structureChangeOperation, structureChangesetOperation, structureChangeState, structureFailure } from '../utils/structureChanges'

const STATE_TONE = { ready: 'arcane', done: 'ember', changed: 'warning', unavailable: 'neutral' } as const
type Outcome = { indexes: number[]; together: boolean; revision: number; undo: 'idle' | 'working' | 'done' | 'failed' }

/**
 * A saved reply's proposed outline changes, for scenes and chapters. Each one applies on its own, or every ready one
 * together, at the revisions it was proposed for; either way it is one organization change that can be undone here
 * or from Organization history.
 */
export function NovelAssistantStructure({ record, story, structure, readOnly, sceneTitle }: {
    record: NovelAssistantRecord; story: StoryOutline; readOnly: boolean
    /** Runs one structure write behind the studio's save barrier; absent where the outline cannot change. */
    structure?: BulkScenes
    sceneTitle: (sceneId: string) => string | null
}) {
    const { t } = useTranslation()
    const text = (key: string, values?: Record<string, unknown>) => t('novelEditor.assistant.structure.' + key, values)
    const [working, setWorking] = useState<number[] | null>(null), [failed, setFailed] = useState<{ indexes: number[]; together: boolean } | null>(null)
    const [outcome, setOutcome] = useState<Outcome | null>(null)
    const changes = record.result.structure ?? [], omitted = record.result.structureOmitted ?? 0
    const savedHash = (sceneId: string) => record.context.packet.sources.find((source) => source.sceneId === sceneId)?.contentHash
    if (!changes.length && !omitted) return null
    const scene = (id: string) => sceneTitle(id) ?? text('missingScene')
    // A merged chapter keeps its title in Trash, so a finished merge still reads naturally.
    const chapter = (id: string) => story.chapters.find((row) => row.id === id)?.title || text('missingChapter')
    const describe = (change: NovelAssistantStructureChange) => {
        switch (change.kind) {
            case 'move_scene': return change.beforeSceneId ? text('move', { scene: scene(change.sceneId), chapter: chapter(change.chapterId), before: scene(change.beforeSceneId) })
                : text('moveEnd', { scene: scene(change.sceneId), chapter: chapter(change.chapterId) })
            case 'split_scene': return text('split', { scene: scene(change.sceneId), title: change.title })
            case 'merge_scenes': return text('merge', { scene: scene(change.sceneId), other: scene(change.otherSceneId) })
            case 'split_chapter': return text('splitChapter', { chapter: chapter(change.chapterId), scene: scene(change.sceneId), title: change.title })
            case 'merge_chapters': return text('mergeChapters', { chapter: chapter(change.chapterId), other: chapter(change.otherChapterId) })
            case 'move_chapter': return change.beforeChapterId ? text('moveChapter', { chapter: chapter(change.chapterId), before: chapter(change.beforeChapterId) })
                : text(change.partId ? 'moveChapterEnd' : 'moveChapterLast', { chapter: chapter(change.chapterId) })
            case 'new_chapter': return text('newChapter', { title: change.title, chapter: chapter(change.chapterId), scenes: change.sceneIds.map(scene).join(', '), count: change.sceneIds.length })
            case 'new_part': {
                const taken = newPartChapters(story, change).map((row) => row.title || text('missingChapter'))
                if (!taken.length) taken.push(chapter(change.chapterId))
                return text('newPart', { title: change.title, chapters: taken.join(', '), count: taken.length })
            }
        }
    }
    // Where a ready new part goes among the parts already there: after the part it splits, or before them for chapters
    // outside any part. With no parts yet there is nothing to place it against.
    const placement = (change: NovelAssistantStructureChange) => {
        if (change.kind !== 'new_part' || !story.parts?.some((part) => !part.trashedAt)) return null
        const current = story.chapters.find((row) => row.id === change.chapterId)?.partId ?? null
        return current === null ? text('newPartFirst') : text('newPartAfter', { part: story.parts?.find((row) => row.id === current)?.title || text('missingPart') })
    }
    const states = changes.map((change) => structureChangeState(story, change, savedHash))
    const ready = states.flatMap((state, index) => state === 'ready' ? [index] : [])
    const idle = Boolean(structure && !readOnly && !structure.busy && working === null && outcome?.undo !== 'working')
    async function apply(indexes: number[]) {
        if (!structure || !idle || !indexes.length || indexes.some((index) => states[index] !== 'ready')) return
        const together = indexes.length > 1
        setWorking(indexes); setFailed(null)
        const result = await structure.operate(together ? structureChangesetOperation(story, indexes.map((index) => changes[index])) : structureChangeOperation(story, changes[indexes[0]]))
        setWorking(null)
        if (result) setOutcome({ indexes, together, revision: result.structureRevision, undo: 'idle' })
        else setFailed({ indexes, together })
    }
    async function revert() {
        if (!structure || !outcome || !idle || story.structureRevision !== outcome.revision) return
        setOutcome({ ...outcome, undo: 'working' })
        const result = await structure.operate({ op: 'undo_structure', revision: outcome.revision, sourceStructureRevision: outcome.revision })
        setOutcome({ ...outcome, undo: result ? 'done' : 'failed' })
    }
    const result = (current: Outcome) => {
        const undoable = (current.undo === 'idle' || current.undo === 'working') && story.structureRevision === current.revision
        const done = current.together ? 'appliedTogether' : 'applied'
        return <Callout tone={current.undo === 'failed' ? 'warning' : 'info'} role="status">
            <p>{text(current.undo === 'done' ? 'undone' : current.undo === 'failed' ? 'undoFailed' : done, { count: current.indexes.length })}</p>
            {undoable && <Button size="sm" variant="secondary" className="mt-2" disabled={!idle} onClick={() => void revert()}>{text(current.undo === 'working' ? 'undoing' : 'undo')}</Button>}
            {!undoable && current.undo === 'idle' && <p className="mt-1 text-caption">{text('undoLater')}</p>}
        </Callout>
    }
    const failure = (together: boolean) => <Callout tone="warning" role="alert">{text('failure.' + structureFailure(structure?.error, together))}</Callout>
    return <section aria-label={text('title')} className="space-y-3">
        <h3 className="font-display text-h3">{text('title')}</h3>
        {changes.length > 0 && <p className="text-caption text-parchment-300">{text('help')}</p>}
        {omitted > 0 && <Callout tone="info" role="note">{text('omitted', { count: omitted })}</Callout>}
        {structure && !readOnly && ready.length > 1 && <div className="space-y-2">
            <Button size="sm" disabled={!idle} onClick={() => void apply(ready)}>{text(working && working.length > 1 ? 'applyingTogether' : 'applyTogether', { count: ready.length })}</Button>
            <p className="text-caption text-parchment-400">{text('togetherHelp')}</p>
        </div>}
        {failed?.together && failure(true)}
        {outcome?.together && result(outcome)}
        {changes.length > 0 && <ul className="space-y-2">
            {changes.map((change, index) => {
                const state = states[index]
                const own = outcome && !outcome.together && outcome.indexes[0] === index ? outcome : null
                return <li key={index}><Card className="space-y-2 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="arcane">{text('kind.' + change.kind)}</Badge>
                        <Badge tone={STATE_TONE[state]}>{text('state.' + state)}</Badge>
                    </div>
                    <p className="text-body">{describe(change)}</p>
                    {state === 'ready' && placement(change) && <p className="text-caption text-parchment-300">{placement(change)}</p>}
                    {change.kind === 'split_scene' && <blockquote className="whitespace-pre-wrap break-words border-l-2 border-parchment-50/20 pl-2 font-narrative text-body text-parchment-200">{change.excerpt}</blockquote>}
                    <p className="whitespace-pre-wrap text-caption text-parchment-300">{change.reason}</p>
                    {(state === 'changed' || state === 'unavailable') && !own && <p className="text-caption text-parchment-400">{text(state + 'Help')}</p>}
                    {failed && !failed.together && failed.indexes[0] === index && failure(false)}
                    {own && result(own)}
                    {structure && !readOnly && state === 'ready' && <div>
                        <Button size="sm" variant="secondary" disabled={!idle} onClick={() => void apply([index])}>{text(working?.length === 1 && working[0] === index ? 'applying' : 'apply')}</Button>
                    </div>}
                </Card></li>
            })}
        </ul>}
    </section>
}
