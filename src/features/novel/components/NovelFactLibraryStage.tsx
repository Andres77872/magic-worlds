/**
 * Stages one approved fact in the library source behind a Codex entry, after a review of its text before and after.
 * For a library card it writes the card's private draft only: the owner publishes it from the card editor, and until
 * then no chat, adventure or other novel sees it. A lorebook entry has no draft, so the review says the write changes
 * the library entry at once. Either way a source changed in its own editor meanwhile is refused.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryCodexLibraryDraft, StoryCodexLibraryEntry, StoryPlanItem } from '@/shared'
import { Button, Callout, Field, Modal, Textarea } from '@/ui/primitives'
import { factCodexText, type FactCodexEntry } from '../utils/factCodex'

export interface FactLorebookLibrary {
    /** Whether the entry copies a library lorebook entry that a reviewed discovery can be written into. */
    linked: (entryId: string) => boolean
    read: (entryId: string) => Promise<StoryCodexLibraryEntry>
    write: (entryId: string, content: string, stamp: string) => Promise<StoryCodexLibraryEntry>
}

export interface FactLibrary {
    /** Whether the entry copies a library card that a reviewed discovery can be staged into. */
    linked: (entryId: string) => boolean
    read: (entryId: string) => Promise<StoryCodexLibraryDraft>
    stage: (entryId: string, description: string, stamp: string) => Promise<StoryCodexLibraryDraft>
    /** The library lorebook entry behind a Codex lorebook entry; absent where lorebooks cannot be written. */
    lorebook?: FactLorebookLibrary
}

type Fact = StoryPlanItem<'fact'>
/** What the review starts from: the card's draft (else its published body) or the lorebook entry as stored. */
type Source = { text: string; stamp: string; draft?: StoryCodexLibraryDraft }
type Load = { state: 'loading' } | { state: 'ready'; source: Source } | { state: 'missing' | 'failed' }
const fold = (value: string) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const fromDraft = (draft: StoryCodexLibraryDraft): Source => ({ text: draft.description, stamp: draft.stamp, draft })
const fromEntry = (entry: StoryCodexLibraryEntry): Source => ({ text: entry.content, stamp: entry.stamp })

export function NovelFactLibraryStage({ fact, entry, library, onClose }: { fact: Fact; entry: FactCodexEntry; library: FactLibrary; onClose: () => void }) {
    const { t } = useTranslation()
    // The studio rebuilds `library` every render; the review keeps the one it opened with (it only names the entry).
    const [lore] = useState(() => !library.linked(entry.id) && library.lorebook?.linked(entry.id) ? library.lorebook : null)
    const [source] = useState(() => library)
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.facts.library.' + key, values)
    const own = (key: string, values?: Record<string, unknown>) => copy((lore ? 'entry.' : '') + key, values)
    const [load, setLoad] = useState<Load>({ state: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [edited, setEdited] = useState<{ stamp: string; text: string } | null>(null)
    const [status, setStatus] = useState<'idle' | 'saving' | 'changed' | 'failed' | 'done'>('idle')

    useEffect(() => {
        let live = true
        const read = lore ? lore.read(entry.id).then(fromEntry) : source.read(entry.id).then(fromDraft)
        read.then((loaded) => { if (live) setLoad({ state: 'ready', source: loaded }) })
            .catch((error: unknown) => { if (live) setLoad({ state: error instanceof ApiError && error.code === 'STORY_CODEX_SOURCE_MISSING' ? 'missing' : 'failed' }) })
        return () => { live = false }
    }, [lore, source, entry.id, attempt])

    const current = load.state === 'ready' ? load.source : null
    const before = current?.text ?? ''
    const already = Boolean(current && fold(before).includes(fold(fact.data.statement)))
    // A newer source (after a refusal) starts again from its own text.
    const text = edited && edited.stamp === current?.stamp ? edited.text : current ? (already ? before : factCodexText(before, fact)) : ''
    const reload = () => { setLoad({ state: 'loading' }); setAttempt((value) => value + 1) }
    const save = async () => {
        if (!current || status === 'saving' || status === 'done' || !text.trim() || text === before) return
        setStatus('saving')
        try {
            const saved = lore ? fromEntry(await lore.write(entry.id, text, current.stamp)) : fromDraft(await source.stage(entry.id, text, current.stamp))
            setLoad({ state: 'ready', source: saved }); setEdited(null); setStatus('done')
        } catch (error) {
            if (error instanceof ApiError && (error.code === 'STORY_LIBRARY_DRAFT_CHANGED' || error.code === 'STORY_LIBRARY_ENTRY_CHANGED')) { setStatus('changed'); reload() }
            else if (error instanceof ApiError && error.code === 'STORY_CODEX_SOURCE_MISSING') { setStatus('idle'); setLoad({ state: 'missing' }) }
            else setStatus('failed')
        }
    }

    return (
        <Modal open onClose={onClose} title={own('title')} size="lg" footer={<div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{copy(status === 'done' ? 'close' : 'cancel')}</Button>
            {status !== 'done' && <Button disabled={!current || status === 'saving' || !text.trim() || text === before} onClick={() => void save()}>
                {own(status === 'saving' ? 'applying' : 'apply')}
            </Button>}
        </div>}>
            <div className="flex flex-col gap-3">
                {lore ? <Callout tone="warning" role="note">{own('help', { label: entry.label })}</Callout>
                    : <p className="text-caption text-parchment-300">{own('help', { label: entry.label })}</p>}
                <section aria-label={t('novelEditor.planningViews.facts.codex.fact')} className="flex flex-col gap-1">
                    <p className="text-label">{fact.data.subject}</p>
                    <p className="font-narrative text-body text-parchment-100">{fact.data.statement}</p>
                    {fact.data.quote && <blockquote className="border-l-2 border-parchment-50/20 pl-2 font-narrative text-caption text-parchment-300">{fact.data.quote}</blockquote>}
                </section>
                {load.state === 'loading' && <p role="status" className="text-caption text-parchment-300">{own('loading')}</p>}
                {load.state === 'missing' && <Callout tone="warning" role="status">{own('missing')}</Callout>}
                {load.state === 'failed' && <Callout tone="warning" role="alert"><p>{own('loadFailed')}</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={reload}>{copy('retry')}</Button></Callout>}
                {status === 'changed' && <Callout tone="warning" role="alert">{own('changed')}</Callout>}
                {status === 'failed' && <Callout tone="warning" role="alert">{own('failed')}</Callout>}
                {status === 'done' && <Callout tone="info" role="status">{own('done', { label: entry.label })}</Callout>}
                {current && status !== 'done' && <>
                    <p className="text-caption text-parchment-400">{lore ? own('basis') : current.draft?.basis === 'draft' ? copy('basisDraft') : copy('basisPublished', { version: current.draft?.versionNumber })}</p>
                    {already && <Callout tone="info" role="status">{own('already')}</Callout>}
                    <section aria-label={own('before')} className="flex flex-col gap-1">
                        <p className="text-caption text-parchment-400">{own('before')}</p>
                        <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-parchment-50/10 px-3 py-2 text-body text-parchment-200">{before}</p>
                    </section>
                    <Field label={own('after')}>
                        <Textarea rows={6} value={text} disabled={status === 'saving'} onChange={(event) => { setEdited({ stamp: current.stamp, text: event.target.value }); if (status !== 'saving') setStatus('idle') }} />
                    </Field>
                </>}
            </div>
        </Modal>
    )
}
