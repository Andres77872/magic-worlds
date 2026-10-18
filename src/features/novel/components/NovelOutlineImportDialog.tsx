/**
 * Import an outline into the open novel (S18). The server reads pasted or file text as parts, chapters, scenes and
 * planned beats without saving anything; the author picks the chapters to keep and where loose chapters go, and the
 * reviewed plan is added as one organization change — undone in one step here or later from Organization history.
 * Outlines add planning (titles, synopses, planned beats), never prose.
 */

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { ApiError } from '@/infrastructure/api'
import { STORY_OUTLINE_MAX_TEXT, selectOutlineChapters } from '@/infrastructure/api/storyOutlineContract'
import type { StoryOutline, StoryStructureOperation } from '@/shared'
import type { StoryOutlinePlan, StoryOutlinePreview } from '@/shared/types/storyOutline.types'
import { Button, Callout, Field, Icon, Modal, Select, Textarea } from '@/ui/primitives'
import { structureFailure } from '../utils/structureChanges'

const LEVELS = ['auto', 1, 2, 3, 4, 5, 6] as const
type Level = typeof LEVELS[number]
const ERRORS = ['STORY_OUTLINE_EMPTY', 'STORY_OUTLINE_TOO_LARGE']
const ACCEPT = '.md,.markdown,.txt,.text'
const reason = (error: unknown) => error instanceof ApiError && ERRORS.includes(String(error.code)) ? String(error.code) : 'preview'
// A UTF-16 length within the limit is always within it in characters too, so most texts skip the count.
const tooLong = (value: string) => value.length > STORY_OUTLINE_MAX_TEXT && [...value].length > STORY_OUTLINE_MAX_TEXT

type Source = { text: string; level: number | null }
type Preview = { state: 'idle' } | ({ state: 'ready'; preview: StoryOutlinePreview } & Source) | ({ state: 'failed'; reason: string } & Source)

export interface OutlineImportStructure {
    /** Runs one structure write behind the studio's save barrier; null when it was not applied. */
    operate: (operation: StoryStructureOperation) => Promise<StoryOutline | null>
    busy: boolean
    error?: string | null
}
interface Props { open: boolean; onClose: () => void; story: StoryOutline; structure: OutlineImportStructure; initialText?: string }

const sceneCount = (plan: StoryOutlinePlan) => plan.chapters.reduce((total, chapter) => total + chapter.scenes.length, 0)

export function NovelOutlineImportDialog({ open, onClose, story, structure, initialText = '' }: Props) {
    const { t } = useTranslation(), copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.outlineImport.' + key, values)
    const { api, capture, isCurrent } = useWorkspace()
    const input = useRef<HTMLInputElement>(null)
    const [text, setText] = useState(initialText)
    const [level, setLevel] = useState<Level>('auto')
    const [destination, setDestination] = useState('')
    const [preview, setPreview] = useState<Preview>({ state: 'idle' })
    const [attempt, setAttempt] = useState(0)
    // Chapters left out belong to one preview; a new preview starts with every chapter chosen.
    const [excluded, setExcluded] = useState<{ preview: StoryOutlinePreview | null; indexes: ReadonlySet<number> }>({ preview: null, indexes: new Set() })
    const [fileError, setFileError] = useState<'file' | 'tooLong' | null>(null)
    const [failed, setFailed] = useState(false)
    const [outcome, setOutcome] = useState<{ revision: number; chapters: number; scenes: number } | null>(null)
    const [undo, setUndo] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
    const chapterLevel = level === 'auto' ? null : level
    const long = tooLong(text)
    const readable = Boolean(text.trim()) && !long

    useEffect(() => {
        if (!open || !api || !readable || outcome) return
        const controller = new AbortController(), scope = capture()
        // Typing settles before the outline is read again.
        const timer = window.setTimeout(() => {
            api.previewStoryOutline(text, chapterLevel, { signal: controller.signal })
                .then((value) => { if (!controller.signal.aborted && isCurrent(scope)) setPreview({ state: 'ready', preview: value, text, level: chapterLevel }) })
                .catch((error) => { if (!controller.signal.aborted && isCurrent(scope)) setPreview({ state: 'failed', reason: reason(error), text, level: chapterLevel }) })
        }, 400)
        return () => { window.clearTimeout(timer); controller.abort() }
    }, [open, api, text, chapterLevel, readable, outcome, attempt, capture, isCurrent])

    const settled = preview.state !== 'idle' && preview.text === text && preview.level === chapterLevel
    const current = settled && preview.state === 'ready' ? preview.preview : null
    const failure = settled && preview.state === 'failed' ? preview.reason : null
    const loading = readable && !settled
    const plan = current?.outline ?? null
    const left = excluded.preview === current ? excluded.indexes : new Set<number>()
    const chosen = new Set(plan ? plan.chapters.map((_, index) => index).filter((index) => !left.has(index)) : [])
    const selected = plan ? selectOutlineChapters(plan, chosen) : null
    const parts = [...story.parts].filter((part) => !part.trashedAt && part.status !== 'archived' && !part.inheritance?.readOnly).sort((a, b) => a.order - b.order)
    const parentId = parts.some((part) => part.id === destination) ? destination : null

    const exclude = (indexes: Iterable<number>) => setExcluded({ preview: current, indexes: new Set(indexes) })
    const toggle = (index: number, on: boolean) => exclude(on ? [...left].filter((value) => value !== index) : [...left, index])
    const choose = async (file: File | null) => {
        if (!file) return
        setFileError(null)
        // Four bytes per character is the most UTF-8 needs, so a larger file is certainly too long.
        if (file.size > STORY_OUTLINE_MAX_TEXT * 4) { setFileError('tooLong'); return }
        try { setText(await file.text()) } catch { setFileError('file') }
    }
    const apply = async () => {
        if (!selected || !selected.chapters.length || structure.busy) return
        setFailed(false)
        const result = await structure.operate({ op: 'add_outline', parentId, outline: selected })
        if (!result) { setFailed(true); return }
        setOutcome({ revision: result.structureRevision, chapters: selected.chapters.length, scenes: sceneCount(selected) }); setUndo('idle')
    }
    const revert = async () => {
        if (!outcome || story.structureRevision !== outcome.revision || structure.busy) return
        setUndo('working')
        const result = await structure.operate({ op: 'undo_structure', revision: outcome.revision, sourceStructureRevision: outcome.revision })
        setUndo(result ? 'done' : 'failed')
    }
    const counted = (name: string, count: number) => copy('count.' + name, { count })
    const levelLabel = (value: Level) => value !== 'auto' ? copy('levels.heading', { level: value })
        : current && level === 'auto' ? current.chapterLevel ? copy('levels.auto_detected', { level: current.chapterLevel }) : copy('levels.auto_none') : copy('levels.auto')
    const undoable = outcome && undo !== 'done' && story.structureRevision === outcome.revision

    return <Modal open={open} onClose={onClose} title={copy('title')} size="lg" footer={outcome
        ? <Button variant="ghost" onClick={onClose}>{copy('close')}</Button>
        : <>
            <Button variant="ghost" onClick={onClose}>{copy('cancel')}</Button>
            <Button disabled={!selected?.chapters.length || structure.busy} onClick={() => void apply()}>
                {structure.busy ? copy('applying') : copy('apply', { count: chosen.size })}</Button>
        </>}>
        {outcome ? <Callout tone={undo === 'failed' ? 'warning' : 'info'} role="status">
            <p>{undo === 'done' ? copy('undone') : undo === 'failed' ? copy('undoFailed')
                : copy('applied', { chapters: counted('chapters', outcome.chapters), scenes: counted('scenes', outcome.scenes) })}</p>
            {undoable && <Button size="sm" variant="secondary" className="mt-2" disabled={structure.busy || undo === 'working'} onClick={() => void revert()}>{copy(undo === 'working' ? 'undoing' : 'undo')}</Button>}
            {!undoable && undo === 'idle' && <p className="mt-1 text-caption">{copy('undoLater')}</p>}
        </Callout> : <div className="flex flex-col gap-4">
            <p className="text-body text-parchment-200">{copy('help')}</p>
            <Field label={copy('text')} error={long ? copy('errors.tooLong') : undefined}>
                <Textarea value={text} rows={8} spellCheck={false} placeholder={copy('placeholder')} onChange={(event) => { setText(event.target.value); setFileError(null) }} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
                <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={copy('choose')}
                    onChange={(event) => { const next = event.target.files?.[0] ?? null; event.target.value = ''; void choose(next) }} />
                <Button variant="secondary" size="sm" iconLeft={<Icon icon={FileUp} size={14} />} onClick={() => input.current?.click()}>{copy('choose')}</Button>
                <span className="text-caption text-parchment-400">{copy('fileHelp')}</span>
            </div>
            {fileError && <Callout tone="warning" role="alert">{copy(fileError === 'tooLong' ? 'errors.tooLong' : 'errors.file')}</Callout>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label={copy('chapterLevel')} helper={copy('chapterLevelHelp')}>
                    <Select value={String(level)} onChange={(value) => setLevel(value === 'auto' ? 'auto' : Number(value) as Level)}
                        options={LEVELS.map((value) => ({ value: String(value), label: levelLabel(value) }))} />
                </Field>
                <Field label={copy('destination')} helper={copy('destinationHelp')}>
                    <Select value={parentId ?? ''} onChange={setDestination}
                        options={[{ value: '', label: copy('topLevel') }, ...parts.map((part) => ({ value: part.id, label: part.title }))]} />
                </Field>
            </div>
            {loading && <p role="status" className="text-caption text-parchment-300">{copy('loading')}</p>}
            {failure && <Callout tone="warning" role="alert"><p>{copy('errors.' + failure)}</p>
                {failure === 'preview' && <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setPreview({ state: 'idle' }); setAttempt((value) => value + 1) }}>{copy('retry')}</Button>}
            </Callout>}
            {current && plan && selected && <section aria-label={copy('preview')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3">
                <h3 className="font-ui text-label text-parchment-100">{copy('preview')}</h3>
                <p className="text-body text-parchment-200">
                    {copy(selected.parts.length ? 'holdsParts' : 'holds', { parts: counted('parts', selected.parts.length), chapters: counted('chapters', selected.chapters.length), scenes: counted('scenes', sceneCount(selected)) })}
                    {' · '}{copy('beats', { count: selected.chapters.flatMap((chapter) => chapter.scenes).reduce((total, scene) => total + scene.beats.length, 0) })}
                </p>
                {Object.keys(current.notes).length > 0 && <ul className="list-disc space-y-1 pl-5 text-caption text-parchment-300">
                    {Object.entries(current.notes).map(([note, count]) => <li key={note}>{copy('notes.' + note, { count })}</li>)}</ul>}
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1 text-label text-parchment-200">{copy('chapters')}</legend>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost" disabled={!left.size} onClick={() => exclude([])}>{copy('all')}</Button>
                        <Button size="sm" variant="ghost" disabled={!chosen.size} onClick={() => exclude(plan.chapters.map((_, index) => index))}>{copy('none')}</Button>
                        <span role="status" className="text-caption text-parchment-400">{copy('chosen', { count: chosen.size, total: plan.chapters.length })}</span>
                    </div>
                    <ol className="max-h-80 space-y-2 overflow-y-auto pr-1 text-caption text-parchment-300">
                        {plan.chapters.map((chapter, index) => <li key={index}>
                            {chapter.part !== null && (index === 0 || plan.chapters[index - 1].part !== chapter.part)
                                && <p className="mb-1 font-ui text-eyebrow text-parchment-400">{copy('newPart', { title: plan.parts[chapter.part].title })}</p>}
                            <label className="flex items-start gap-2 text-parchment-100">
                                <input type="checkbox" className="mt-0.5 shrink-0" checked={chosen.has(index)} onChange={(event) => toggle(index, event.target.checked)} />
                                <span className="min-w-0 break-words">{chapter.title}</span>
                            </label>
                            <div className="ml-6">
                                {chapter.synopsis && <p className="line-clamp-2 text-parchment-400">{chapter.synopsis}</p>}
                                <ul className="mt-0.5 space-y-0.5">{chapter.scenes.map((scene, position) => <li key={position} className="min-w-0">
                                    <span className="break-words">{scene.title}</span>
                                    {scene.beats.length > 0 && <span className="text-parchment-400"> · {copy('beats', { count: scene.beats.length })}</span>}
                                    {scene.synopsis && <span className="block truncate text-parchment-400">{scene.synopsis}</span>}
                                </li>)}</ul>
                            </div>
                        </li>)}
                    </ol>
                </fieldset>
                <p className="text-caption text-parchment-400">{copy('planning')}</p>
            </section>}
            {failed && <Callout tone="warning" role="alert">{copy(structureFailure(structure.error) === 'pendingProposal' ? 'pendingProposal' : 'failed')}</Callout>}
        </div>}
    </Modal>
}
