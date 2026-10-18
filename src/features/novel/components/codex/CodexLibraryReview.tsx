/**
 * CodexLibraryReview — a field-by-field review of the library card's newer version, or of an adventure template's or
 * lorebook entry's changed details, against this novel's copy. Each differing detail shows both wordings and who
 * changed it since the copy was taken; only details the novel never changed start on the library wording. Approved
 * story facts already applied to the entry are listed, since taking the library's description leaves them out.
 * Applying takes the chosen details and records the reviewed version (or library state), in one Codex change. The
 * library and other novels never change.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenText, Library } from 'lucide-react'
import { ApiError } from '@/infrastructure/api'
import type { StoryCardSnapshot, StoryCodexLibraryField, StoryCodexLibraryReview, StoryPlanItem } from '@/shared'
import { useScopedApi } from '@/shared/hooks/useScopedApi'
import { canonicalJson } from '@/utils/json'
import { Badge, Button, Callout, Icon, Modal, SegmentedControl } from '@/ui/primitives'
import type { CodexEntry } from '../../hooks/useCodex'
import { codexFieldReviews, keepsDisplayName, takenByDefault, type CodexFieldChange } from '../../utils/codexLibrary'

const CHANGE_TONE: Record<Exclude<CodexFieldChange, 'same'>, 'arcane' | 'ember' | 'warning' | 'neutral'> = { updated: 'arcane', edited: 'ember', both: 'warning', differs: 'neutral' }

export interface CodexLibraryScope { scope: 'novel' | 'chapter' | 'scene'; title?: string }

interface CodexLibraryReviewProps {
    entry: CodexEntry | null
    scope: CodexLibraryScope
    workspaceId?: string | null
    busy: boolean
    readOnly: boolean
    onClose: () => void
    onApply: (entry: CodexEntry, sourceVersionId: string, take: StoryCodexLibraryField[]) => Promise<void>
}

export function CodexLibraryReview(props: CodexLibraryReviewProps) {
    if (!props.entry) return null
    return <Review key={props.entry.id} {...props} entry={props.entry} />
}

type Load = { state: 'loading' } | { state: 'ready'; review: StoryCodexLibraryReview } | { state: 'missing' | 'failed' }
/** Facts listed in the impact summary before the rest are counted. */
const FACTS_SHOWN = 5

function Review({ entry, scope, workspaceId, busy, readOnly, onClose, onApply }: CodexLibraryReviewProps & { entry: CodexEntry }) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.codexLibrary.' + key, values)
    // Adventure templates and lorebook entries keep no saved versions: the review names their library state instead.
    const unversioned = entry.kind === 'lorebook_entry' || entry.kind === 'adventure_template'
    const source = (key: string, values?: Record<string, unknown>) => copy(unversioned ? 'source.' + key : key, { ...values, source: copy('sourceKind.' + entry.kind) })
    const api = useScopedApi(workspaceId)
    const [facts, setFacts] = useState<{ items: StoryPlanItem<'fact'>[]; truncated: boolean } | null>(null)
    const [load, setLoad] = useState<Load>({ state: 'loading' })
    const [attempt, setAttempt] = useState(0)
    const [take, setTake] = useState<Set<StoryCodexLibraryField>>(new Set())
    const [applying, setApplying] = useState(false)
    const [failure, setFailure] = useState<'changedAgain' | 'missing' | 'conflict' | 'failed' | null>(null)
    // The copy as last read: a story refresh that leaves it unchanged keeps the choices; a changed copy (another
    // tab took an update) reads the library again.
    const key = entry.ref.id + '\u0000' + canonicalJson(entry.ref.snapshot)
    const [target, setTarget] = useState({ key, ref: entry.ref })
    if (target.key !== key) setTarget({ key, ref: entry.ref })
    const ref = target.ref

    useEffect(() => {
        if (!api) return
        let live = true
        api.getStoryCodexLibrary(target.ref).then((review) => {
            if (!live) return
            setLoad({ state: 'ready', review })
            setTake(new Set(codexFieldReviews(target.ref.snapshot, review).filter((row) => takenByDefault(row.change)).map((row) => row.field)))
        }).catch((error: unknown) => {
            if (live) setLoad({ state: error instanceof ApiError && error.code === 'STORY_CODEX_SOURCE_MISSING' ? 'missing' : 'failed' })
        })
        return () => { live = false }
    }, [api, target, attempt])

    // Approved facts applied to this entry live in its description; a failed read only leaves them unlisted.
    useEffect(() => {
        if (!api) return
        let live = true
        Promise.resolve().then(() => api.listStoryPlanItems(target.ref.storyId, 'fact', { state: 'approved' }))
            .then((page) => { if (live) setFacts({ items: page.items.filter((fact) => fact.data.codexRefId === target.ref.id), truncated: page.truncated }) })
            .catch(() => { if (live) setFacts(null) })
        return () => { live = false }
    }, [api, target])

    const review = load.state === 'ready' ? load.review : null
    const rows = review ? codexFieldReviews(ref.snapshot, review) : []
    const differing = rows.filter((row) => row.change !== 'same')
    // A detail neither side has (a lorebook entry has no race) is not a match worth counting.
    const matching = rows.filter((row) => row.change === 'same' && row.novel !== null).length
    const taken = differing.filter((row) => take.has(row.field)).map((row) => row.field)
    const named = keepsDisplayName(rows, new Set(taken))
    const to = review?.current.source_card_version_number ?? 0
    const from = ref.snapshot.source_card_version_number ?? 0
    const blocked = readOnly || busy || applying || !review || !named
    const descriptionDiffers = differing.some((row) => row.field === 'description')
    const linkedFacts = facts?.items ?? []

    const apply = async () => {
        if (!review || blocked) return
        setApplying(true); setFailure(null)
        try {
            await onApply(entry, review.sourceVersionId, taken)
            onClose()
        } catch (error) {
            const code = error instanceof ApiError ? error.code : undefined
            if (code === 'STORY_CODEX_SOURCE_CHANGED') { setFailure('changedAgain'); setLoad({ state: 'loading' }); setAttempt((value) => value + 1) }
            else if (code === 'STORY_CODEX_SOURCE_MISSING') setFailure('missing')
            else setFailure(error instanceof ApiError && error.status === 409 ? 'conflict' : 'failed')
        } finally { setApplying(false) }
    }

    return <Modal open onClose={onClose} title={copy('title', { label: entry.label })} size="lg" footer={<>
        <Button variant="ghost" onClick={onClose} disabled={applying}>{copy('cancel')}</Button>
        {review && !readOnly && <Button onClick={() => void apply()} disabled={blocked}>
            {applying ? copy('applying') : differing.length ? copy('apply', { count: taken.length }) : copy('markReviewed')}
        </Button>}
    </>}>
        <div className="flex flex-col gap-4">
            {load.state === 'loading' && <p role="status" className="text-body text-parchment-300">{source('loading')}</p>}
            {load.state === 'missing' && <Callout tone="warning" role="status">{source('missing')}</Callout>}
            {load.state === 'failed' && <Callout tone="warning" role="alert">
                <p>{source('loadFailed')}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => { setLoad({ state: 'loading' }); setAttempt((value) => value + 1) }}>{copy('retry')}</Button>
            </Callout>}
            {failure && <Callout tone="warning" role="alert">{unversioned && (failure === 'changedAgain' || failure === 'missing') ? source('failure.' + failure) : copy('failure.' + failure)}</Callout>}
            {review && <>
                <p className="text-body text-parchment-200">{unversioned ? source(ref.snapshot.source_base ? 'intro' : 'introUnpinned') : from > 0 ? copy('intro', { from, to }) : copy('introUnversioned', { to })}</p>
                <section aria-label={copy('impactTitle')} className="rounded-md border border-parchment-50/10 bg-ink-800/60 p-3">
                    <h3 className="font-ui text-label text-parchment-200">{copy('impactTitle')}</h3>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-caption text-parchment-300">
                        <li>{copy('impact.' + scope.scope, { title: scope.title ?? '' })}</li>
                        <li>{copy(entry.enabled ? 'impact.enabled' : 'impact.disabled')}</li>
                        <li>{unversioned ? source('impact.isolation') : copy('impact.isolation')}</li>
                        {linkedFacts.length > 0 && <li>
                            {copy(descriptionDiffers ? 'impact.factsAtRisk' : 'impact.facts', { count: linkedFacts.length })}
                            <ul className="mt-1 list-[circle] space-y-1 pl-5">
                                {linkedFacts.slice(0, FACTS_SHOWN).map((fact) => <li key={fact.id} className="break-words">{fact.data.statement}</li>)}
                            </ul>
                            {(linkedFacts.length > FACTS_SHOWN || facts?.truncated) && <p>{copy('impact.factsMore', { count: Math.max(linkedFacts.length - FACTS_SHOWN, 0) })}</p>}
                        </li>}
                    </ul>
                </section>
                {differing.length === 0 && <Callout tone="info" role="status">{unversioned ? source('allSame') : copy('allSame', { version: to })}</Callout>}
                {differing.map((row) => {
                    const field = copy('field.' + row.field)
                    const using = take.has(row.field)
                    return <section key={row.field} aria-label={field} className="space-y-2 rounded-md border border-parchment-50/10 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-ui text-label text-parchment-100">{field}</h3>
                            <Badge tone={CHANGE_TONE[row.change as Exclude<CodexFieldChange, 'same'>]}>{copy('change.' + row.change)}</Badge>
                        </div>
                        <p className="text-caption text-parchment-400">{unversioned && row.change === 'differs' ? source('changeHelp.differs') : copy('changeHelp.' + row.change)}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Wording heading={copy('novel')} value={row.novel} empty={copy('empty')} chosen={!using} />
                            <Wording heading={unversioned ? source('library') : copy('library', { version: to })} value={row.library} empty={copy('empty')} chosen={using} />
                        </div>
                        {!readOnly && <SegmentedControl aria-label={copy('choice', { field })} showLabels value={using ? 'take' : 'keep'}
                            onChange={(next) => setTake((current) => { const set = new Set(current); if (next === 'take') set.add(row.field); else set.delete(row.field); return set })}
                            options={[{ value: 'keep', label: copy('keep'), icon: <Icon icon={BookOpenText} size={14} /> }, { value: 'take', label: copy('take'), icon: <Icon icon={Library} size={14} /> }]} />}
                    </section>
                })}
                {differing.length > 0 && matching > 0 && <p className="text-caption text-parchment-400">{copy('same', { count: matching })}</p>}
                {!named && <Callout tone="warning" role="alert">{copy('needsName')}</Callout>}
            </>}
        </div>
    </Modal>
}

function Wording({ heading, value, empty, chosen }: { heading: string; value: StoryCardSnapshot[StoryCodexLibraryField]; empty: string; chosen: boolean }) {
    return <div className={'rounded-md border p-2 ' + (chosen ? 'border-ember-500/40 bg-ember-500/5' : 'border-parchment-50/10')}>
        <p className="font-ui text-caption text-parchment-400">{heading}</p>
        {value == null ? <p className="mt-1 text-body italic text-parchment-400">{empty}</p>
            : Array.isArray(value) ? <ul className="mt-1 space-y-1 text-body text-parchment-100">{value.map((item, index) => <li key={index} className="whitespace-pre-wrap break-words">
                {[item.name, item.description].filter(Boolean).join(': ')}{item.attributes?.length ? ' — ' + item.attributes.flatMap((attr) => Object.entries(attr).map(([key, text]) => key + ': ' + text)).join('; ') : ''}
            </li>)}</ul>
                : <p className="mt-1 max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-body text-parchment-100">{String(value)}</p>}
    </div>
}
