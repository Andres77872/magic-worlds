/**
 * The novel's summaries against today's scenes (rest of K09). Nothing is rewritten automatically: the author either
 * confirms a saved summary still holds (*Still accurate*), or primes one reviewed assistant request over the chosen
 * scenes and saves what the reply proposes.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StoryOutline } from '@/shared'
import { Badge, Button, Callout, Chip, cx } from '@/ui/primitives'
import { MAX_REFRESH_SCENES, bookFromSummaries, refreshScenes, summaryCounts, summaryRows, type SummaryRow, type SummaryStatus } from '../utils/summaryStatus'
import type { SceneSummaryOutcome, SceneSummaryWriter } from './NovelAssistantSummaries'

const TONE = { current: 'live', stale: 'warning', unpinned: 'neutral', missing: 'neutral' } as const
const STATUSES: SummaryStatus[] = ['stale', 'unpinned', 'missing', 'current']

export interface SummaryRefresh {
    /** Opens the assistant with a Summary request over these scenes; the whole book uses the novel scope, from summaries through one scene. */
    open: (sceneIds: string[], book: boolean, fromSummaries?: boolean) => void
    /** False while the assistant cannot take a new request (another in flight, no profile, read-only). */
    available: boolean
}

export function NovelSummaryStatus({ story, readOnly, writer, refresh, onOpenScene, onEditScene }: {
    story: StoryOutline; readOnly: boolean
    /** Re-ties a saved summary to today's scenes; absent where details cannot change. */
    writer?: SceneSummaryWriter
    refresh?: SummaryRefresh
    onOpenScene: (sceneId: string) => void
    onEditScene?: (sceneId: string) => void
}) {
    const { t } = useTranslation(), copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.summaries.' + key, values)
    const [attention, setAttention] = useState(false)
    const [chosen, setChosen] = useState<Set<string>>(new Set())
    const [confirming, setConfirming] = useState<string | null>(null)
    const [working, setWorking] = useState<string | null>(null)
    const [outcome, setOutcome] = useState<{ key: string; value: SceneSummaryOutcome } | null>(null)
    const rows = summaryRows(story, readOnly)
    if (!rows.length) return <p className="text-caption text-parchment-400">{copy('empty')}</p>
    const counts = summaryCounts(rows), book = rows[0]
    const valid = new Set(rows.map((row) => row.key)), picked = new Set([...chosen].filter((key) => valid.has(key)))
    const scenes = refreshScenes(rows, picked)
    const toggle = (key: string) => setChosen((old) => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next })
    const shown = (row: SummaryRow) => !attention || row.status !== 'current'

    async function keep(row: SummaryRow) {
        if (!writer || working !== null || !row.text) return
        if (confirming !== row.key) { setConfirming(row.key); setOutcome(null); return }
        setConfirming(null); setWorking(row.key)
        const value = row.kind === 'scene' ? await writer.save(row.id!, row.text, row.revision!)
            : row.kind === 'chapter' ? await writer.saveChapter?.(row.id!, row.text, row.basis!) ?? 'unavailable'
                : row.kind === 'part' ? await writer.savePart?.(row.id!, row.text, row.basis!) ?? 'unavailable'
                    : await writer.saveBook?.(row.text, row.basis!) ?? 'unavailable'
        setWorking(null); setOutcome({ key: row.key, value })
    }
    const statusBadge = (row: SummaryRow) => <Badge tone={TONE[row.status]}>{copy(`status.${row.kind === 'scene' ? 'scene' : 'wide'}.${row.status}`)}</Badge>
    const item = (row: SummaryRow) => {
        // Scene titles repeat across chapters ("Scene 1"), so a scene's controls name its chapter too.
        const name = row.chapterTitle ? row.chapterTitle + ' · ' + row.title : row.title
        const selectable = Boolean(refresh) && !readOnly && row.kind !== 'book'
        const result = outcome?.key === row.key ? outcome.value : null
        const canKeep = writer && row.writable && row.text && (row.status === 'stale' || row.status === 'unpinned')
        // Scenes sit under their chapter, and a part's chapters under the part.
        const indent = row.kind === 'scene' ? (row.partId ? 'ml-8' : 'ml-4') : row.kind === 'chapter' && row.partId ? 'ml-4' : undefined
        return <li key={row.key} className={cx('flex min-w-0 flex-col gap-2 rounded-md border border-parchment-50/10 bg-ink-800/60 p-3', indent)}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                {selectable && <input type="checkbox" className="shrink-0" checked={picked.has(row.key)} disabled={!row.writable}
                    aria-label={copy('choose', { title: name })} onChange={() => toggle(row.key)} />}
                {row.kind === 'scene'
                    ? <button type="button" onClick={() => onOpenScene(row.id!)} aria-label={copy('openScene', { title: name })}
                        className="min-w-0 cursor-pointer truncate text-left font-display font-semibold text-parchment-50 underline-offset-4 hover:underline">{row.title}</button>
                    : <h4 className={cx('min-w-0 truncate font-display font-semibold text-parchment-50', row.kind === 'book' ? 'text-h3' : 'text-body')}>{row.title}</h4>}
                {statusBadge(row)}
                {row.kind !== 'scene' && <span className="text-caption text-parchment-400">{copy('covers', { count: row.sceneIds.length })}</span>}
            </div>
            {row.text && <p className="line-clamp-3 whitespace-pre-wrap break-words text-caption text-parchment-200">{row.text}</p>}
            {row.status !== 'current' && <p className="text-caption text-parchment-400">{copy(`why.${row.kind}.${row.status}`)}</p>}
            {confirming === row.key && <Callout tone="info">{copy('keepHelp')}</Callout>}
            {result && <Callout tone={result === 'saved' ? 'info' : 'warning'} role={result === 'saved' ? 'status' : 'alert'}>{copy('kept.' + result)}</Callout>}
            <div className="flex flex-wrap gap-2">
                {canKeep && <Button size="sm" variant="secondary" disabled={working !== null} onClick={() => void keep(row)}>
                    {working === row.key ? copy('keeping') : copy(confirming === row.key ? 'keepConfirm' : 'keep')}</Button>}
                {confirming === row.key && <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>{t('common.cancel')}</Button>}
                {row.kind === 'scene' && onEditScene && <Button size="sm" variant="ghost" aria-label={copy('detailsFor', { title: name })} onClick={() => onEditScene(row.id!)}>{copy('details')}</Button>}
            </div>
        </li>
    }
    const bookFits = book.sceneIds.length <= MAX_REFRESH_SCENES
    // Past one request's scenes, the book summary is built from the current summaries of everything but one scene.
    const plan = !bookFits && book.writable && refresh && !readOnly ? bookFromSummaries(story) : null
    return <div className="flex flex-col gap-4">
        <p className="text-caption text-parchment-300">{copy('help')}</p>
        <div className="flex flex-wrap items-center gap-2" aria-label={copy('countsLabel')} role="group">
            {STATUSES.map((status) => <Badge key={status} tone={TONE[status]}>{copy('count.' + status, { count: counts[status] })}</Badge>)}
        </div>
        <div><Chip active={attention} aria-pressed={attention} onClick={() => setAttention(!attention)}>{copy('attention')}</Chip></div>
        {refresh && !readOnly && <section aria-label={copy('refreshLabel')} className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3">
            <p className="text-caption text-parchment-300">{copy('refreshHelp', { count: MAX_REFRESH_SCENES })}</p>
            <p className="text-caption text-parchment-200" role="status">{copy('chosen', { count: scenes.length })}</p>
            {scenes.length > MAX_REFRESH_SCENES && <p className="text-caption text-amber-500">{copy('tooMany', { count: MAX_REFRESH_SCENES })}</p>}
            {!refresh.available && <p className="text-caption text-parchment-400">{copy('refreshUnavailable')}</p>}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!refresh.available || !scenes.length || scenes.length > MAX_REFRESH_SCENES} onClick={() => refresh.open(scenes, false)}>{copy('refresh', { count: scenes.length })}</Button>
                {picked.size > 0 && <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())}>{copy('clear')}</Button>}
                {book.writable && bookFits && <Button size="sm" variant="secondary" disabled={!refresh.available} onClick={() => refresh.open(book.sceneIds, true)}>{copy('refreshBook')}</Button>}
                {plan && <Button size="sm" variant="secondary" disabled={!refresh.available || !plan.anchorSceneId} onClick={() => plan.anchorSceneId && refresh.open([plan.anchorSceneId], true, true)}>{copy('refreshFromSummaries')}</Button>}
            </div>
            {plan && <p className="text-caption text-parchment-400">{copy('bookTooLong', { count: book.sceneIds.length, max: MAX_REFRESH_SCENES })} {copy('fromSummariesHelp')}</p>}
            {plan && !plan.anchorSceneId && <p className="text-caption text-amber-500">{copy('fromSummariesBlocked', { count: plan.uncovered })}</p>}
        </section>}
        <ul className="flex flex-col gap-2" aria-label={copy('listLabel')}>
            {rows.filter(shown).map(item)}
        </ul>
        {attention && rows.every((row) => !shown(row)) && <p className="text-caption text-parchment-400">{copy('allCurrent')}</p>}
    </div>
}
