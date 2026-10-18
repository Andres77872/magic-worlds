/**
 * Applies one approved story fact to this novel's Codex after a field-level review: the cited passage, an explicitly
 * chosen destination and each detail before and after. The destination is an existing entry (only the novel's copy
 * changes), a new reference that only this novel has, or, as a separate deliberate choice, a new private library card
 * or a new entry in a chosen library lorebook, copied into this Codex in the same change (K12).
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryCodexDiscoveryFields, StoryFactCodexCreation, StoryFactCodexField, StoryPlanItem } from '@/shared'
import { Button, Callout, Field, Input, Modal, Select, Textarea } from '@/ui/primitives'
import { FACT_KEYS_NEW, changedFactFields, factCodexFields, initialFactFields, parseFactKeys, suggestedFactEntry,
    type FactCodexDestination, type FactCodexEntry, type FactFieldDraft, type FactFieldRow } from '../utils/factCodex'
import type { FactLibrary } from './NovelFactLibraryStage'
import { NovelFactFieldRows } from './NovelFactFieldRows'

export type { FactCodexEntry }

export type FactCodexResult = { ok: true; revision: number } | { ok: false; reason: 'conflict' | 'failed' | 'unavailable' }
export type FactCodexCreateResult = { ok: true; entryId: string; revision: number } | { ok: false; reason: 'conflict' | 'failed' | 'unavailable' | 'lorebookMissing' }
export interface FactCodexLorebook { id: string; title: string }
export interface FactCodex {
    entries: FactCodexEntry[]
    readOnly: boolean
    /** An earlier Codex write is still unconfirmed; a new one must wait for it. */
    busy: boolean
    /** Writes the reviewed details to the entry, checked against the Codex revision it was reviewed at. */
    apply: (entryId: string, fields: Partial<Record<StoryFactCodexField, string>>) => Promise<FactCodexResult>
    /** Creates the reviewed destination and its Codex copy as one change; absent where nothing can be created. */
    create?: (destination: FactCodexDestination, fields: StoryCodexDiscoveryFields, lorebookId?: string) => Promise<FactCodexCreateResult>
    /** Library card kinds that can be created here (feature-gated). */
    cardKinds?: Array<'character' | 'world' | 'item'>
    /** The workspace's lorebooks a new entry can go into; absent while lorebooks are off. */
    lorebooks?: () => Promise<FactCodexLorebook[]>
    /** Stages an applied fact in the entry's library card draft; absent where the library cannot be written. */
    library?: FactLibrary
}
/** What the fact records: the entry, the revision the write produced, and the details changed or what was created. */
export interface FactCodexLink { fields?: StoryFactCodexField[]; created?: StoryFactCodexCreation }

type Fact = StoryPlanItem<'fact'>
type Status = 'idle' | 'applying' | 'conflict' | 'failed' | 'recordFailed' | 'lorebookMissing'
type Mode = 'entry' | FactCodexDestination
type Lorebooks = { state: 'loading' } | { state: 'ready'; items: FactCodexLorebook[] } | { state: 'failed' }

const entryRows = (entry: FactCodexEntry): FactFieldRow[] => factCodexFields(entry.kind).map((key) => ({
    key, multiline: key === 'description', before: key === 'description' ? entry.description : key === 'name' ? entry.values?.name ?? entry.label : entry.values?.[key] ?? '' }))

export function NovelFactCodexReview({ fact, codex, sceneTitle, onClose, onApplied }: {
    fact: Fact; codex: FactCodex; sceneTitle: (id: string | undefined) => string | undefined
    onClose: () => void
    /** Records the provenance on the fact; false when that write failed. */
    onApplied: (entryId: string, revision: number, link?: FactCodexLink) => Promise<boolean>
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.facts.codex.' + key, values)
    const [mode, setMode] = useState<Mode>(() => codex.entries.length || !codex.create ? 'entry' : 'reference')
    const [target, setTarget] = useState(() => suggestedFactEntry(fact, codex.entries))
    const [edited, setEdited] = useState<{ key: string; draft: FactFieldDraft } | null>(null)
    const [created, setCreated] = useState<StoryCodexDiscoveryFields & { keysText: string }>(() =>
        ({ name: fact.data.subject, alias: '', race: '', type: '', description: fact.data.statement, keysText: fact.data.subject }))
    const [lorebookId, setLorebookId] = useState('')
    const [lorebooks, setLorebooks] = useState<Lorebooks | null>(null)
    const [lorebookAttempt, setLorebookAttempt] = useState(0)
    // The studio rebuilds `codex` every render; the review keeps the lorebook reader it opened with.
    const [readLorebooks] = useState(() => codex.lorebooks)
    const [status, setStatus] = useState<Status>('idle')
    const [applied, setApplied] = useState<{ id: string; revision: number; link: FactCodexLink } | null>(null)
    const entry = mode === 'entry' ? codex.entries.find((row) => row.id === target) : undefined
    const rows = entry ? entryRows(entry) : []
    // A changed entry (another choice, or a newer Codex after a conflict) starts again from its current details.
    const key = target + '\u0000' + JSON.stringify(rows)
    const draft = edited?.key === key ? edited.draft : initialFactFields(rows, fact, 'description')
    const changes = changedFactFields(rows, draft) as Partial<Record<StoryFactCodexField, string>>
    const blocked = codex.readOnly || codex.busy

    const wantsLorebooks = mode === 'lorebook_entry'
    useEffect(() => {
        if (!wantsLorebooks || !readLorebooks) return
        let live = true
        readLorebooks().then((items) => { if (live) { setLorebooks({ state: 'ready', items }); if (items.length === 1) setLorebookId(items[0].id) } })
            .catch(() => { if (live) setLorebooks({ state: 'failed' }) })
        return () => { live = false }
    }, [wantsLorebooks, readLorebooks, lorebookAttempt])
    const loadLorebooks = () => { setLorebooks({ state: 'loading' }); setLorebookAttempt((value) => value + 1) }

    const discovery = (): StoryCodexDiscoveryFields | null => {
        const name = created.name.trim(), description = created.description.trim(), extra = (value?: string) => value?.trim() || undefined
        if (!name || !description) return null
        if (mode === 'lorebook_entry') { const keys = parseFactKeys(created.keysText); return keys.length && keys.length <= FACT_KEYS_NEW ? { name, description, keys } : null }
        return { name, description, alias: extra(created.alias),
            ...(mode === 'character' ? { race: extra(created.race) } : mode === 'world' || mode === 'item' ? { type: extra(created.type) } : {}) }
    }
    const fields = mode === 'entry' ? null : discovery()
    const ready = mode === 'entry' ? Boolean(entry && Object.keys(changes).length) : Boolean(fields && codex.create && (mode !== 'lorebook_entry' || lorebookId))

    const apply = async () => {
        if (blocked || status === 'applying' || applied || !ready) return
        setStatus('applying')
        if (mode === 'entry' && entry) {
            const result = await codex.apply(entry.id, changes)
            if (!result.ok) { setStatus(result.reason === 'conflict' ? 'conflict' : 'failed'); return }
            const link = { fields: Object.keys(changes) as StoryFactCodexField[] }
            setApplied({ id: entry.id, revision: result.revision, link })
            await record(entry.id, result.revision, link)
            return
        }
        // The destination is chosen explicitly; the copy and anything new in the library are written as one change.
        const value = JSON.parse(JSON.stringify(fields)) as StoryCodexDiscoveryFields
        const result = await codex.create!(mode as FactCodexDestination, value, mode === 'lorebook_entry' ? lorebookId : undefined)
        if (!result.ok) { setStatus(result.reason === 'conflict' ? 'conflict' : result.reason === 'lorebookMissing' ? 'lorebookMissing' : 'failed'); return }
        const link = { created: mode as StoryFactCodexCreation }
        setApplied({ id: result.entryId, revision: result.revision, link })
        await record(result.entryId, result.revision, link)
    }
    // The Codex already holds the change; only the fact's link is retried, never a second write.
    const record = async (id: string, revision: number, link: FactCodexLink) => {
        setStatus('applying')
        if (await onApplied(id, revision, link)) onClose()
        else setStatus('recordFailed')
    }
    const choose = (next: Mode) => {
        if (next === mode) return
        setMode(next); setStatus('idle')
        if (next === 'lorebook_entry') loadLorebooks()
    }
    const scene = sceneTitle(fact.data.sourceSceneId)
    const destinations: Array<{ value: Mode; label: string }> = [
        ...(codex.entries.length ? [{ value: 'entry' as const, label: copy('to.entry') }] : []),
        ...(codex.create ? [{ value: 'reference' as const, label: copy('to.reference') }] : []),
        ...(codex.create ? (codex.cardKinds ?? []).map((kind) => ({ value: kind, label: copy('to.' + kind) })) : []),
        ...(codex.create && readLorebooks ? [{ value: 'lorebook_entry' as const, label: copy('to.lorebook_entry') }] : []),
    ]
    const set = (patch: Partial<typeof created>) => { setCreated((current) => ({ ...current, ...patch })); if (status !== 'applying') setStatus('idle') }
    const line = (name: 'name' | 'alias' | 'race' | 'type', optional = false) =>
        <Field label={t('novelEditor.planningViews.facts.fields.names.' + name) + (optional ? ' · ' + copy('optional') : '')}>
            <Input value={created[name] ?? ''} maxLength={255} disabled={status === 'applying'} onChange={(event) => set({ [name]: event.target.value })} />
        </Field>
    const lorebook = lorebooks?.state === 'ready' ? lorebooks.items.find((item) => item.id === lorebookId) : undefined

    return (
        <Modal open onClose={onClose} title={copy('title')} size="lg" footer={<div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>{copy('cancel')}</Button>
            <Button disabled={blocked || !ready || status === 'applying' || Boolean(applied)} onClick={() => void apply()}>
                {copy(status === 'applying' ? 'applying' : mode === 'entry' ? 'apply' : 'create.' + mode)}
            </Button>
        </div>}>
            <div className="flex flex-col gap-3">
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
                {!destinations.length
                    ? <Callout tone="info">{copy('noEntries')}</Callout>
                    : <>
                        {destinations.length > 1 && <Field label={copy('where')}>
                            <Select value={mode} onChange={(value) => choose(value as Mode)} options={destinations} />
                        </Field>}
                        {mode === 'entry' && <>
                            <p className="text-caption text-parchment-300">{copy('help')}</p>
                            <Field label={copy('destination')}>
                                <Select value={target} onChange={(value) => { setTarget(value); setStatus('idle') }} placeholder={copy('choose')}
                                    options={codex.entries.map((row) => ({ value: row.id, label: row.scopeLabel ? `${row.label} · ${row.scopeLabel}` : row.label }))} />
                            </Field>
                            {entry && <>
                                <p className="text-caption text-parchment-300">{copy('fieldsHelp')}</p>
                                <NovelFactFieldRows rows={rows} value={draft} disabled={status === 'applying'}
                                    onChange={(next) => { setEdited({ key, draft: next }); if (status !== 'applying') setStatus('idle') }} />
                                {!Object.keys(changes).length && <p className="text-caption text-parchment-400" role="status">{copy('nothingChanged')}</p>}
                            </>}
                        </>}
                        {mode !== 'entry' && <>
                            <Callout tone={mode === 'reference' ? 'info' : 'warning'} role="note">
                                {copy('impact.' + mode, { lorebook: lorebook?.title ?? copy('chosenLorebook') })}</Callout>
                            {mode === 'lorebook_entry' && <>
                                {lorebooks?.state === 'loading' && <p role="status" className="text-caption text-parchment-300">{copy('lorebooksLoading')}</p>}
                                {lorebooks?.state === 'failed' && <Callout tone="warning" role="alert"><p>{copy('lorebooksFailed')}</p>
                                    <Button size="sm" variant="secondary" className="mt-2" onClick={loadLorebooks}>{copy('retry')}</Button></Callout>}
                                {lorebooks?.state === 'ready' && (lorebooks.items.length
                                    ? <Field label={copy('lorebook')}>
                                        <Select value={lorebookId} onChange={(value) => { setLorebookId(value); setStatus('idle') }} placeholder={copy('chooseLorebook')}
                                            options={lorebooks.items.map((item) => ({ value: item.id, label: item.title }))} />
                                    </Field>
                                    : <Callout tone="info">{copy('noLorebooks')}</Callout>)}
                            </>}
                            {line('name')}
                            {mode !== 'lorebook_entry' && line('alias', true)}
                            {mode === 'character' && line('race', true)}
                            {(mode === 'world' || mode === 'item') && line('type', true)}
                            {mode === 'lorebook_entry' && <Field label={t('novelEditor.planningViews.facts.fields.names.keys')} helper={t('novelEditor.planningViews.facts.fields.keysHelp')}>
                                <Input value={created.keysText} maxLength={2000} disabled={status === 'applying'} onChange={(event) => set({ keysText: event.target.value })} />
                            </Field>}
                            {mode === 'lorebook_entry' && parseFactKeys(created.keysText).length > FACT_KEYS_NEW && <Callout tone="warning" role="alert">
                                {t('novelEditor.planningViews.facts.fields.keysLimit', { count: FACT_KEYS_NEW })}</Callout>}
                            <Field label={t('novelEditor.planningViews.facts.fields.names.' + (mode === 'lorebook_entry' ? 'content' : 'description'))}>
                                <Textarea rows={6} value={created.description} disabled={status === 'applying'} onChange={(event) => set({ description: event.target.value })} />
                            </Field>
                        </>}
                    </>}
                {status === 'conflict' && <Callout tone="warning" role="alert">{copy(mode === 'entry' ? 'conflict' : 'conflictCreate')}</Callout>}
                {status === 'failed' && <Callout tone="warning" role="alert">{copy('failed')}</Callout>}
                {status === 'lorebookMissing' && <Callout tone="warning" role="alert">{copy('lorebookMissing')}</Callout>}
                {status === 'recordFailed' && applied && <Callout tone="warning" role="alert">{copy('recordFailed')}
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => void record(applied.id, applied.revision, applied.link)}>{copy('retryLink')}</Button></Callout>}
            </div>
        </Modal>
    )
}
