/**
 * Applies one approved story fact to an entry of this novel's Codex after a
 * field-level review: the cited passage, an explicitly chosen entry and its
 * description before and after. Only the novel's snapshot changes; the
 * library card and other novels keep their versions.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryPlanItem } from '@/shared'
import { Button, Callout, Field, Modal, Select, Textarea } from '@/ui/primitives'
import { factCodexText, suggestedFactEntry, type FactCodexEntry } from '../utils/factCodex'
import type { FactLibrary } from './NovelFactLibraryStage'

export type { FactCodexEntry }

export type FactCodexResult = { ok: true; revision: number } | { ok: false; reason: 'conflict' | 'failed' | 'unavailable' }
export interface FactCodex {
    entries: FactCodexEntry[]
    readOnly: boolean
    /** An earlier Codex write is still unconfirmed; a new one must wait for it. */
    busy: boolean
    /** Writes the reviewed description to the entry, checked against the Codex revision it was reviewed at. */
    apply: (entryId: string, description: string) => Promise<FactCodexResult>
    /** Stages an applied fact in the entry's library card draft; absent where the library cannot be written. */
    library?: FactLibrary
}

type Fact = StoryPlanItem<'fact'>
type Status = 'idle' | 'applying' | 'conflict' | 'failed' | 'recordFailed'

export function NovelFactCodexReview({ fact, codex, sceneTitle, onClose, onApplied }: {
    fact: Fact; codex: FactCodex; sceneTitle: (id: string | undefined) => string | undefined
    onClose: () => void
    /** Records the provenance on the fact; false when that write failed. */
    onApplied: (entryId: string, revision: number) => Promise<boolean>
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.facts.codex.' + key, values)
    const [target, setTarget] = useState(() => suggestedFactEntry(fact, codex.entries))
    const [draft, setDraft] = useState<{ key: string; text: string } | null>(null)
    const [status, setStatus] = useState<Status>('idle')
    const [applied, setApplied] = useState<{ id: string; revision: number } | null>(null)
    const entry = codex.entries.find((row) => row.id === target)
    const before = entry?.description ?? ''
    // A changed entry (another choice, or a newer Codex after a conflict) starts again from its current text.
    const key = target + '\u0000' + before
    const text = draft?.key === key ? draft.text : entry ? factCodexText(before, fact) : ''
    const blocked = codex.readOnly || codex.busy
    const apply = async () => {
        if (!entry || blocked || status === 'applying' || !text.trim() || text === before) return
        setStatus('applying')
        const result = await codex.apply(entry.id, text)
        if (!result.ok) { setStatus(result.reason === 'conflict' ? 'conflict' : 'failed'); return }
        setApplied({ id: entry.id, revision: result.revision })
        await link(entry.id, result.revision)
    }
    // The Codex already holds the text; only the fact's link is retried, never a second append.
    const link = async (id: string, revision: number) => {
        setStatus('applying')
        if (await onApplied(id, revision)) onClose()
        else setStatus('recordFailed')
    }
    const scene = sceneTitle(fact.data.sourceSceneId)
    return (
        <Modal open onClose={onClose} title={copy('title')} size="lg" footer={<div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{copy('cancel')}</Button>
            <Button disabled={!entry || blocked || status === 'applying' || Boolean(applied) || !text.trim() || text === before} onClick={() => void apply()}>
                {copy(status === 'applying' ? 'applying' : 'apply')}
            </Button>
        </div>}>
            <div className="flex flex-col gap-3">
                <p className="text-caption text-parchment-300">{copy('help')}</p>
                <section aria-label={copy('fact')} className="flex flex-col gap-1">
                    <p className="text-label">{fact.data.subject}</p>
                    <p className="font-narrative text-body text-parchment-100">{fact.data.statement}</p>
                    {fact.data.quote
                        ? <>
                            <blockquote className="border-l-2 border-parchment-50/20 pl-2 font-narrative text-caption text-parchment-300">{fact.data.quote}</blockquote>
                            <p className="text-caption text-parchment-400">{copy('source', { scene: scene ?? '—', revision: fact.data.sourceRevision ?? '—' })}</p>
                        </>
                        : <p className="text-caption text-parchment-400">{copy('noSource')}</p>}
                </section>
                {codex.readOnly && <Callout tone="info">{copy('readOnly')}</Callout>}
                {!codex.readOnly && codex.busy && <Callout tone="warning" role="status">{copy('busy')}</Callout>}
                {!codex.entries.length
                    ? <Callout tone="info">{copy('noEntries')}</Callout>
                    : <>
                        <Field label={copy('destination')}>
                            <Select value={target} onChange={(value) => { setTarget(value); setStatus('idle') }} placeholder={copy('choose')}
                                options={codex.entries.map((row) => ({ value: row.id, label: row.scopeLabel ? `${row.label} · ${row.scopeLabel}` : row.label }))} />
                        </Field>
                        {entry && <>
                            <p className="text-caption text-parchment-300">{copy('field')}</p>
                            <section aria-label={copy('before')} className="flex flex-col gap-1">
                                <p className="text-caption text-parchment-400">{copy('before')}</p>
                                <p className="whitespace-pre-wrap rounded-md border border-parchment-50/10 px-3 py-2 text-body text-parchment-200">{before || copy('empty')}</p>
                            </section>
                            <Field label={copy('after')}>
                                <Textarea rows={6} value={text} disabled={status === 'applying'} onChange={(event) => { setDraft({ key, text: event.target.value }); if (status !== 'applying') setStatus('idle') }} />
                            </Field>
                        </>}
                    </>}
                {status === 'conflict' && <Callout tone="warning" role="alert">{copy('conflict')}</Callout>}
                {status === 'failed' && <Callout tone="warning" role="alert">{copy('failed')}</Callout>}
                {status === 'recordFailed' && applied && <Callout tone="warning" role="alert">{copy('recordFailed')}
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => void link(applied.id, applied.revision)}>{copy('retryLink')}</Button></Callout>}
            </div>
        </Modal>
    )
}
