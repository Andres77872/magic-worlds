/**
 * Stages one approved fact in the library source behind a Codex entry, after a review of each detail before and after:
 * a card's name, alias, race or type and description, or a lorebook entry's title, keys and content. For a library card
 * it writes the card's private draft only: the owner publishes it from the card editor, and until then no chat,
 * adventure or other novel sees it. A lorebook entry has no draft, so the review says the write changes the library
 * entry at once. Either way a source changed in its own editor meanwhile is refused.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/infrastructure/api'
import type { StoryCodexLibraryDraft, StoryCodexLibraryDraftFields, StoryCodexLibraryEntry, StoryCodexLibraryEntryFields, StoryPlanItem } from '@/shared'
import { Button, Callout, Modal } from '@/ui/primitives'
import { FACT_KEYS_WRITE, changedFactFields, holdsFact, initialFactFields, parseFactKeys, type FactCodexEntry, type FactFieldDraft, type FactFieldRow } from '../utils/factCodex'
import { NovelFactFieldRows } from './NovelFactFieldRows'

export interface FactLorebookLibrary {
    /** Whether the entry copies a library lorebook entry that a reviewed discovery can be written into. */
    linked: (entryId: string) => boolean
    read: (entryId: string) => Promise<StoryCodexLibraryEntry>
    write: (entryId: string, fields: StoryCodexLibraryEntryFields, stamp: string) => Promise<StoryCodexLibraryEntry>
}

export interface FactLibrary {
    /** Whether the entry copies a library card that a reviewed discovery can be staged into. */
    linked: (entryId: string) => boolean
    read: (entryId: string) => Promise<StoryCodexLibraryDraft>
    stage: (entryId: string, fields: StoryCodexLibraryDraftFields, stamp: string) => Promise<StoryCodexLibraryDraft>
    /** The library lorebook entry behind a Codex lorebook entry; absent where lorebooks cannot be written. */
    lorebook?: FactLorebookLibrary
}

type Fact = StoryPlanItem<'fact'>
/** What the review starts from: the card's draft (else its published body) or the lorebook entry as stored. */
type Source = { rows: FactFieldRow[]; text: string; stamp: string; draft?: StoryCodexLibraryDraft }
type Load = { state: 'loading' } | { state: 'ready'; source: Source } | { state: 'missing' | 'failed' }
const fromDraft = (draft: StoryCodexLibraryDraft): Source => ({ stamp: draft.stamp, draft, text: draft.description, rows: [
    { key: 'name', before: draft.name }, { key: 'alias', before: draft.alias ?? '' },
    ...(draft.race !== undefined ? [{ key: 'race', before: draft.race ?? '' }] : draft.type !== undefined ? [{ key: 'type', before: draft.type ?? '' }] : []),
    { key: 'description', before: draft.description, multiline: true }] })
const fromEntry = (entry: StoryCodexLibraryEntry): Source => ({ stamp: entry.stamp, text: entry.content, rows: [
    { key: 'title', before: entry.title }, { key: 'keys', before: entry.keys.join(', ') }, { key: 'content', before: entry.content, multiline: true }] })
/** The Codex details a fact changed in the novel map onto the library ones, so they are proposed here as well. */
const LORE_FIELD: Record<string, string> = { name: 'title', description: 'content' }

export function NovelFactLibraryStage({ fact, entry, library, onClose }: { fact: Fact; entry: FactCodexEntry; library: FactLibrary; onClose: () => void }) {
    const { t } = useTranslation()
    // The studio rebuilds `library` every render; the review keeps the one it opened with (it only names the entry).
    const [lore] = useState(() => !library.linked(entry.id) && library.lorebook?.linked(entry.id) ? library.lorebook : null)
    const [source] = useState(() => library)
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.facts.library.' + key, values)
    const own = (key: string, values?: Record<string, unknown>) => copy((lore ? 'entry.' : '') + key, values)
    const [load, setLoad] = useState<Load>({ state: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [edited, setEdited] = useState<{ stamp: string; draft: FactFieldDraft } | null>(null)
    const [status, setStatus] = useState<'idle' | 'saving' | 'changed' | 'failed' | 'done'>('idle')

    useEffect(() => {
        let live = true
        const read = lore ? lore.read(entry.id).then(fromEntry) : source.read(entry.id).then(fromDraft)
        read.then((loaded) => { if (live) setLoad({ state: 'ready', source: loaded }) })
            .catch((error: unknown) => { if (live) setLoad({ state: error instanceof ApiError && error.code === 'STORY_CODEX_SOURCE_MISSING' ? 'missing' : 'failed' }) })
        return () => { live = false }
    }, [lore, source, entry.id, attempt])

    const current = load.state === 'ready' ? load.source : null
    const textKey = lore ? 'content' : 'description'
    const already = Boolean(current && holdsFact(current.text, fact))
    // A newer source (after a refusal) starts again from its own details: the statement in the text, plus any other
    // detail the fact already changed in this novel's Codex copy.
    const start = (loaded: Source): FactFieldDraft => {
        const draft = initialFactFields(loaded.rows, fact, textKey)
        for (const field of fact.data.codexFields ?? []) {
            const key = lore ? LORE_FIELD[field] : field, row = loaded.rows.find((item) => item.key === key)
            const value = field === 'name' ? entry.values?.name ?? entry.label : entry.values?.[field]
            if (row && !row.multiline && value !== undefined && value !== row.before) draft[row.key] = { change: true, text: value }
        }
        return draft
    }
    const draft = current ? (edited && edited.stamp === current.stamp ? edited.draft : start(current)) : {}
    const changes = current ? changedFactFields(current.rows, draft) : {}
    if ('keys' in changes && current && parseFactKeys(changes.keys).join(', ') === current.rows.find((row) => row.key === 'keys')?.before) delete changes.keys
    const keysEmpty = 'keys' in changes && !parseFactKeys(changes.keys).length
    const keysOver = 'keys' in changes && parseFactKeys(changes.keys).length > FACT_KEYS_WRITE
    const ready = Boolean(current && Object.keys(changes).length && !keysEmpty && !keysOver)
    const reload = () => { setLoad({ state: 'loading' }); setAttempt((value) => value + 1) }
    const save = async () => {
        if (!current || status === 'saving' || status === 'done' || !ready) return
        setStatus('saving')
        try {
            const { keys, ...rest } = changes
            const saved = lore ? fromEntry(await lore.write(entry.id, { ...rest, ...(keys !== undefined ? { keys: parseFactKeys(keys) } : {}) } as StoryCodexLibraryEntryFields, current.stamp))
                : fromDraft(await source.stage(entry.id, rest as StoryCodexLibraryDraftFields, current.stamp))
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
            {status !== 'done' && <Button disabled={!ready || status === 'saving'} onClick={() => void save()}>
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
                    <p className="text-caption text-parchment-400">{lore ? own('basis') : current.draft?.basis === 'draft' ? copy('basisDraft') : current.draft?.versionNumber ? copy('basisPublished', { version: current.draft.versionNumber }) : copy('basisUnpublished')}</p>
                    {already && <Callout tone="info" role="status">{own('already')}</Callout>}
                    <p className="text-caption text-parchment-300">{own('fieldsHelp')}</p>
                    <NovelFactFieldRows rows={current.rows} value={draft} disabled={status === 'saving'}
                        onChange={(next) => { setEdited({ stamp: current.stamp, draft: next }); if (status !== 'saving') setStatus('idle') }} />
                    {keysEmpty && <Callout tone="warning" role="alert">{own('keysEmpty')}</Callout>}
                    {keysOver && <Callout tone="warning" role="alert">{t('novelEditor.planningViews.facts.fields.keysLimit', { count: FACT_KEYS_WRITE })}</Callout>}
                    {!Object.keys(changes).length && <p className="text-caption text-parchment-400" role="status">{t('novelEditor.planningViews.facts.codex.nothingChanged')}</p>}
                </>}
            </div>
        </Modal>
    )
}
