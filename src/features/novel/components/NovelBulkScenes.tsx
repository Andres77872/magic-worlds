/**
 * One reviewed action over several selected scenes: set status, move to a
 * chapter, archive or move to Trash. It is a single organization change, so
 * it is undone in one step here or later from Organization history.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline, StoryStructureOperation } from '@/shared'
import { Button, Callout, Field, Select } from '@/ui/primitives'
import { chaptersFor } from '../utils/novelUtils'
import { bulkSceneChanges, type BulkSceneAction } from '../utils/bulkScenes'
import { structureFailure } from '../utils/structureChanges'
type Status = 'draft' | 'revising' | 'complete'
const STATUSES: Status[] = ['draft', 'revising', 'complete']

export interface BulkScenes {
    /** Runs one structure write behind the studio's save barrier; null when it was not applied. */
    operate: (operation: StoryStructureOperation) => Promise<StoryOutline | null>
    busy: boolean
    /** The error code of the last refused write, when the studio has one. */
    error?: string | null
}

export function NovelBulkScenes({ story, selected, onClear, bulk }: { story: StoryOutline; selected: string[]; onClear: () => void; bulk: BulkScenes }) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.bulk.' + key, values)
    const [action, setAction] = useState<BulkSceneAction>('status')
    const [status, setStatus] = useState<Status>('revising')
    const [chapter, setChapter] = useState('')
    const [reviewing, setReviewing] = useState(false)
    const [failed, setFailed] = useState(false)
    const [outcome, setOutcome] = useState<{ revision: number; count: number; action: BulkSceneAction; value: string } | null>(null)
    const [undo, setUndo] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
    const chapters = chaptersFor(story).filter((unit) => !unit.trashedAt && !unit.inheritance?.readOnly)
    const value = action === 'status' ? status : action === 'move' ? chapter : ''
    const changes = bulkSceneChanges(story, selected, action, value)
    const ready = selected.length > 0 && (action !== 'move' || Boolean(chapter))
    const chapterTitle = (id: string) => chapters.find((unit) => unit.id === id)?.title ?? ''
    const describe = (kind: BulkSceneAction, target: string, count: number) => copy('applied.' + kind, {
        count, status: kind === 'status' ? t('novelEditor.structure.statuses.' + target) : '', chapter: kind === 'move' ? chapterTitle(target) : '' })
    const apply = async () => {
        if (!changes.length || bulk.busy) return
        setFailed(false)
        const ids = changes.map((scene) => scene.id)
        const operation: StoryStructureOperation = action === 'status' ? { op: 'bulk_scenes', action, ids, status }
            : action === 'move' ? { op: 'bulk_scenes', action, ids, parentId: chapter } : { op: 'bulk_scenes', action, ids }
        const result = await bulk.operate(operation)
        if (!result) { setFailed(true); return }
        setOutcome({ revision: result.structureRevision, count: ids.length, action, value }); setUndo('idle'); setReviewing(false); onClear()
    }
    const revert = async () => {
        if (!outcome || story.structureRevision !== outcome.revision || bulk.busy) return
        setUndo('working')
        const result = await bulk.operate({ op: 'undo_structure', revision: outcome.revision, sourceStructureRevision: outcome.revision })
        setUndo(result ? 'done' : 'failed')
    }
    const undoable = outcome && undo !== 'done' && story.structureRevision === outcome.revision
    return (
        <div className="flex flex-col gap-2">
            {outcome && <Callout tone={undo === 'failed' ? 'warning' : 'info'} role="status">
                <p>{undo === 'done' ? copy('undone') : undo === 'failed' ? copy('undoFailed') : describe(outcome.action, outcome.value, outcome.count)}</p>
                {undoable && <Button size="sm" variant="secondary" className="mt-2" disabled={bulk.busy || undo === 'working'} onClick={() => void revert()}>{copy(undo === 'working' ? 'undoing' : 'undo')}</Button>}
                {!undoable && undo === 'idle' && <p className="mt-1 text-caption">{copy('undoLater')}</p>}
            </Callout>}
            {selected.length > 0 && <section aria-label={copy('label')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 bg-ink-800/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p role="status" className="text-label">{copy('selected', { count: selected.length })}</p>
                    <Button size="sm" variant="ghost" onClick={() => { onClear(); setReviewing(false) }}>{copy('clear')}</Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label={copy('action')}>
                        <Select size="sm" value={action} onChange={(next) => { setAction(next as BulkSceneAction); setReviewing(false); setFailed(false) }}
                            options={(['status', 'move', 'archive', 'trash'] as const).map((kind) => ({ value: kind, label: copy('actions.' + kind) }))} />
                    </Field>
                    {action === 'status' && <Field label={copy('status')}>
                        <Select size="sm" value={status} onChange={(next) => { setStatus(next as Status); setReviewing(false) }}
                            options={STATUSES.map((item) => ({ value: item, label: t('novelEditor.structure.statuses.' + item) }))} />
                    </Field>}
                    {action === 'move' && <Field label={copy('chapter')}>
                        <Select size="sm" value={chapter} placeholder={copy('chooseChapter')} onChange={(next) => { setChapter(next); setReviewing(false) }}
                            options={chapters.map((unit) => ({ value: unit.id, label: unit.title }))} />
                    </Field>}
                </div>
                {!reviewing && <div><Button size="sm" variant="secondary" disabled={!ready || bulk.busy} onClick={() => { setReviewing(true); setFailed(false) }}>{copy('review')}</Button></div>}
                {reviewing && <div className="flex flex-col gap-2">
                    {changes.length
                        ? <>
                            <p className="text-caption text-parchment-200">{copy('changes', { count: changes.length })}</p>
                            <ul className="list-disc pl-5 text-caption text-parchment-200">{changes.map((scene) => <li key={scene.id}>{scene.title}</li>)}</ul>
                        </>
                        : <p className="text-caption text-parchment-300">{copy('nothing')}</p>}
                    {selected.length > changes.length && changes.length > 0 && <p className="text-caption text-parchment-400">{copy('unchanged', { count: selected.length - changes.length })}</p>}
                    <p className="text-caption text-parchment-400">{copy('help')}</p>
                    {failed && <Callout tone="warning" role="alert">{copy(structureFailure(bulk.error) === 'pendingProposal' ? 'pendingProposal' : 'failed')}</Callout>}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={action === 'trash' ? 'danger' : 'primary'} disabled={!changes.length || bulk.busy} onClick={() => void apply()}>{copy('apply', { count: changes.length })}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setReviewing(false)}>{copy('cancel')}</Button>
                    </div>
                </div>}
            </section>}
        </div>
    )
}
