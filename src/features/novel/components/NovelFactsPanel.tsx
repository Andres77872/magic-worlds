/**
 * Story facts over reading order: what each character knows, has, is and where
 * they are at a chosen scene. Proposed facts stay visibly unconfirmed until the
 * author approves them, and conflicting approved facts are flagged, never fixed.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryFactData, StoryFactKind, StoryPlanItem } from '@/shared'
import { Badge, Button, Callout, Field, Input, Select, Textarea } from '@/ui/primitives'
import type { PlanItems } from '../hooks/usePlanItems'
import { factConflicts, factsAt, type PlanningScene } from '../utils/planningViews'
import { NovelFactCodexReview, type FactCodex, type FactCodexLink } from './NovelFactCodexReview'
import { NovelFactLibraryStage } from './NovelFactLibraryStage'

export interface PassageSelection { sceneId: string; quote: string; revision: number }

const KINDS: StoryFactKind[] = ['knowledge', 'relationship', 'possession', 'location', 'state', 'trait', 'event']
type Fact = StoryPlanItem<'fact'>
interface Draft { subject: string; kind: StoryFactKind; statement: string; object: string; from: string; until: string; cite: boolean }
const EMPTY: Draft = { subject: '', kind: 'knowledge', statement: '', object: '', from: '', until: '', cite: false }

export function NovelFactsPanel({ scenes, facts, readOnly, activeSceneId, subjects, getSelection, codex }: {
    scenes: PlanningScene[]
    facts: PlanItems<'fact'>
    readOnly: boolean
    activeSceneId: string | null
    /** Known subject names (cast cards first) offered while typing. */
    subjects: string[]
    getSelection?: () => PassageSelection | null
    /** This novel's Codex, where an approved fact can be applied after review. */
    codex?: FactCodex
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.facts.' + key, values)
    const [asOf, setAsOf] = useState<string>(activeSceneId ?? '')
    const [subject, setSubject] = useState('')
    const [draft, setDraft] = useState<Draft | null>(null)
    const [selection, setSelection] = useState<PassageSelection | null>(null)
    const [busy, setBusy] = useState(false)
    const [failed, setFailed] = useState(false)
    const [reviewing, setReviewing] = useState<string | null>(null)
    const reviewed = facts.items.find((fact) => fact.id === reviewing && fact.state === 'approved' && !fact.data.codexRefId)
    const [staging, setStaging] = useState<string | null>(null)
    const staged = facts.items.find((fact) => fact.id === staging && fact.state === 'approved')
    const stagedEntry = staged?.data.codexRefId ? codex?.entries.find((entry) => entry.id === staged.data.codexRefId) : undefined
    const stageable = (fact: Fact) => Boolean(fact.state === 'approved' && fact.data.codexRefId && codex?.library && !codex.readOnly
        && codex.entries.some((entry) => entry.id === fact.data.codexRefId) && (codex.library.linked(fact.data.codexRefId) || Boolean(codex.library.lorebook?.linked(fact.data.codexRefId))))
    // The fact records where it went: the entry, the Codex revision the write produced and what changed or was created.
    const recordCodex = async (fact: Fact, codexRefId: string, codexRevision: number, link?: FactCodexLink) => {
        const data = { ...fact.data, codexRefId, codexRevision, ...(link?.fields?.length ? { codexFields: link.fields } : {}), ...(link?.created ? { codexCreated: link.created } : {}) }
        try { await facts.update(fact, { data }); return true } catch { return false }
    }
    const title = (id: string | undefined) => scenes.find((scene) => scene.id === id)?.title
    const placed = factsAt(facts.items, scenes, asOf || null)
    const shown = placed.holding.filter((fact) => !subject || fact.data.subject === subject)
    const conflicts = factConflicts(shown)
    const conflictWith = (fact: Fact) => conflicts.filter((pair) => pair.includes(fact)).map((pair) => pair[0] === fact ? pair[1] : pair[0])
    const names = [...new Set([...subjects, ...facts.items.map((fact) => fact.data.subject)])]
    const run = async (action: () => Promise<unknown>) => {
        setBusy(true); setFailed(false)
        try { await action(); return true } catch { setFailed(true); return false } finally { setBusy(false) }
    }
    const startDraft = () => {
        const selected = getSelection?.() ?? null
        setSelection(selected)
        setDraft({ ...EMPTY, from: asOf || activeSceneId || '', subject })
    }
    const save = async () => {
        if (!draft) return
        const data: StoryFactData = {
            subject: draft.subject.trim(), kind: draft.kind, statement: draft.statement.trim(), origin: 'author',
            ...(draft.object.trim() ? { object: draft.object.trim() } : {}),
            ...(draft.from ? { fromSceneId: draft.from } : {}), ...(draft.until ? { untilSceneId: draft.until } : {}),
            ...(draft.cite && selection ? { sourceSceneId: selection.sceneId, quote: selection.quote.slice(0, 2000), sourceRevision: selection.revision } : {}),
        }
        if (await run(() => facts.create(data, 'approved'))) setDraft(null)
    }
    const sceneOptions = scenes.map((scene) => ({ value: scene.id, label: `${scene.reading}. ${scene.title}` }))
    const draftValid = Boolean(draft && draft.subject.trim() && draft.statement.trim() && draft.from !== draft.until
        && (!draft.from || !draft.until || (scenes.find((s) => s.id === draft.from)?.reading ?? 0) < (scenes.find((s) => s.id === draft.until)?.reading ?? 0)))

    const row = (fact: Fact) => {
        const against = conflictWith(fact)
        return (
            <li key={fact.id} className="flex min-w-0 flex-col gap-1.5 rounded-md border border-parchment-50/10 bg-ink-800/60 px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{copy('kinds.' + fact.data.kind)}</Badge>
                    <span className="font-ui text-label font-semibold text-parchment-100">{fact.data.subject}</span>
                    {fact.data.object && <span className="text-caption text-parchment-300">· {fact.data.object}</span>}
                    {fact.state === 'proposed' && <Badge tone="warning">{copy('proposed')}</Badge>}
                    {fact.data.origin === 'assistant' && <Badge tone="arcane">{copy('origins.assistant')}</Badge>}
                    {fact.data.codexRefId && codex && <Badge tone="ember">{(() => { const entry = codex.entries.find((row) => row.id === fact.data.codexRefId)
                        return entry ? copy('codex.inCodex', { label: entry.label }) : copy('codex.inCodexMissing') })()}</Badge>}
                    {fact.data.codexRefId && fact.data.codexCreated && <Badge tone="neutral">{copy('codex.created.' + fact.data.codexCreated)}</Badge>}
                </div>
                {fact.data.codexRefId && Boolean(fact.data.codexFields?.length) && <p className="text-caption text-parchment-400">
                    {copy('codex.changed', { fields: (fact.data.codexFields ?? []).map((field) => copy('fields.names.' + field)).join(', ') })}</p>}
                <p className="font-narrative text-body text-parchment-100">{fact.data.statement}</p>
                <p className="text-caption text-parchment-400">{copy('range', { from: title(fact.data.fromSceneId) ?? copy('beginning'), until: title(fact.data.untilSceneId) ?? copy('end') })}</p>
                {fact.data.quote && <p className="border-l-2 border-parchment-50/20 pl-2 font-narrative text-caption text-parchment-300">{copy('evidence', { quote: fact.data.quote })}</p>}
                {against.map((other) => <Callout key={other.id} tone="warning" role="note">{copy('conflict', { statement: other.data.statement })}</Callout>)}
                {!readOnly && (
                    <div className="flex flex-wrap gap-1.5">
                        {fact.state === 'proposed' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void run(() => facts.update(fact, { state: 'approved' }))}>{copy('approve')}</Button>}
                        {fact.state === 'proposed' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => facts.update(fact, { state: 'rejected' }))}>{copy('reject')}</Button>}
                        {fact.state === 'approved' && codex && !fact.data.codexRefId && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReviewing(fact.id)}>{copy('codex.open')}</Button>}
                        {stageable(fact) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => setStaging(fact.id)}>
                            {copy(codex?.library?.linked(fact.data.codexRefId!) ? 'library.open' : 'library.entry.open')}</Button>}
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => facts.update(fact, { state: 'trashed' }))}>{copy('trash')}</Button>
                    </div>
                )}
            </li>
        )
    }

    return (
        <div className="flex flex-col gap-3" data-testid="novel-facts">
            {reviewed && codex && !readOnly && <NovelFactCodexReview fact={reviewed} codex={codex} sceneTitle={title} onClose={() => setReviewing(null)}
                onApplied={(entryId, revision, link) => recordCodex(reviewed, entryId, revision, link)} />}
            {staged && stagedEntry && codex?.library && !readOnly && <NovelFactLibraryStage fact={staged} entry={stagedEntry} library={codex.library} onClose={() => setStaging(null)} />}
            <p className="text-caption text-parchment-400">{copy('help')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label={copy('asOf')}>
                    <Select size="sm" value={asOf} onChange={setAsOf} options={[{ value: '', label: copy('everything') }, ...sceneOptions]} />
                </Field>
                <Field label={copy('subject')}>
                    <Select size="sm" value={subject} onChange={setSubject} options={[{ value: '', label: copy('allSubjects') }, ...names.map((name) => ({ value: name, label: name }))]} />
                </Field>
            </div>
            {facts.error && <Callout tone="warning" role="alert">{copy('loadFailed')} <Button size="sm" variant="secondary" onClick={() => void facts.refresh()}>{copy('retry')}</Button></Callout>}
            {failed && <Callout tone="warning" role="alert">{copy('saveFailed')}</Callout>}
            {conflicts.length > 0 && <Callout tone="warning" role="status">{copy('conflicts', { count: conflicts.length })}</Callout>}
            {!readOnly && !draft && <div><Button size="sm" variant="secondary" onClick={startDraft}>{copy('add')}</Button></div>}
            {draft && (
                <form className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3" onSubmit={(event) => { event.preventDefault(); if (draftValid) void save() }}>
                    <Field label={copy('subjectLabel')}>
                        <Input value={draft.subject} maxLength={255} list="novel-fact-subjects" onChange={(event) => setDraft({ ...draft, subject: event.target.value })} />
                    </Field>
                    <datalist id="novel-fact-subjects">{names.map((name) => <option key={name} value={name} />)}</datalist>
                    <Field label={copy('kindLabel')}>
                        <Select size="sm" value={draft.kind} onChange={(value) => setDraft({ ...draft, kind: value as StoryFactKind })} options={KINDS.map((kind) => ({ value: kind, label: copy('kinds.' + kind) }))} />
                    </Field>
                    <Field label={copy('statementLabel')}>
                        <Textarea rows={2} maxLength={2000} value={draft.statement} onChange={(event) => setDraft({ ...draft, statement: event.target.value })} />
                    </Field>
                    <Field label={copy('objectLabel')}>
                        <Input value={draft.object} maxLength={255} onChange={(event) => setDraft({ ...draft, object: event.target.value })} />
                    </Field>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Field label={copy('fromLabel')}><Select size="sm" value={draft.from} onChange={(value) => setDraft({ ...draft, from: value })} options={[{ value: '', label: copy('beginning') }, ...sceneOptions]} /></Field>
                        <Field label={copy('untilLabel')}><Select size="sm" value={draft.until} onChange={(value) => setDraft({ ...draft, until: value })} options={[{ value: '', label: copy('end') }, ...sceneOptions]} /></Field>
                    </div>
                    {selection
                        ? <label className="flex items-center gap-2 text-caption text-parchment-200"><input type="checkbox" checked={draft.cite} onChange={(event) => setDraft({ ...draft, cite: event.target.checked })} />{copy('sourceLabel')}</label>
                        : <p className="text-caption text-parchment-400">{copy('noSelection')}</p>}
                    <div className="flex gap-2">
                        <Button size="sm" type="submit" disabled={!draftValid || busy}>{copy('save')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>{copy('cancel')}</Button>
                    </div>
                </form>
            )}
            <section aria-label={copy('holding')} className="flex flex-col gap-2">
                <h3 className="font-ui text-label font-semibold text-parchment-200">{copy('holding')}</h3>
                {shown.length ? <ul className="flex flex-col gap-2">{shown.map(row)}</ul> : !facts.loading && <p className="text-caption text-parchment-400">{copy('noneHolding')}</p>}
            </section>
            {placed.unplaced.length > 0 && (
                <section aria-label={copy('unplaced')} className="flex flex-col gap-2">
                    <h3 className="font-ui text-label font-semibold text-parchment-200">{copy('unplaced')}</h3>
                    <ul className="flex flex-col gap-2">{placed.unplaced.map(row)}</ul>
                </section>
            )}
        </div>
    )
}
