/**
 * Review surface: revision tasks linked to passages (open → done with an optional
 * resolution), and the stash of cut text and alternative takes. Items reference
 * scenes by identity and quote; the manuscript changes only through Write.
 *
 * Review takes the studio's centre column in place of the manuscript (U01); the
 * manuscript stays loaded behind it, so a selection made in Write can still be
 * stashed or turned into a task here.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks } from 'lucide-react'
import type { StoryPlanItem, StoryTaskState } from '@/shared'
import { Badge, Button, Callout, Field, Icon, Input, TabPanel, Tabs, Textarea } from '@/ui/primitives'
import { NovelSurfaceHeading } from './NovelSurfaceHeading'
import type { PlanItems } from '../hooks/usePlanItems'
import type { PassageSelection } from './NovelFactsPanel'

type View = 'tasks' | 'stash'
type Task = StoryPlanItem<'task'>
type Stashed = StoryPlanItem<'stash'>

export interface NovelReviewDrawerProps {
    /** Review is the chosen surface. */
    open: boolean
    /** Back to Write. */
    onClose: () => void
    tasks: PlanItems<'task'>
    stash: PlanItems<'stash'>
    readOnly: boolean
    sceneTitle: (sceneId: string) => string | null
    getSelection: () => PassageSelection | null
    /** Removes the selection from the manuscript only while it still reads `expected`. */
    cutSelection: (expected: string) => boolean
    /** Inserts text at the cursor of the open scene; false when Write cannot take it now. */
    insertText: (text: string) => boolean
    onOpenPassage: (sceneId: string, quote: string | undefined) => Promise<'opened' | 'scene' | 'blocked'>
}

export function NovelReviewDrawer({ open, onClose, tasks, stash, readOnly, sceneTitle, getSelection, cutSelection, insertText, onOpenPassage }: NovelReviewDrawerProps) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.review.' + key, values)
    const [view, setView] = useState<View>('tasks')
    const [notice, setNotice] = useState<{ tone: 'info' | 'warning'; text: string } | null>(null)
    const [busy, setBusy] = useState(false)
    const run = async (action: () => Promise<unknown>, done?: string) => {
        setBusy(true); setNotice(null)
        try { await action(); if (done) setNotice({ tone: 'info', text: done }); return true }
        catch { setNotice({ tone: 'warning', text: copy('saveFailed') }); return false }
        finally { setBusy(false) }
    }
    if (!open) return null
    return (
        <section aria-labelledby="novel-review-title" className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6" data-testid="novel-review-surface">
            <NovelSurfaceHeading id="novel-review-title" title={copy('title')} eyebrow={copy('eyebrow')} icon={<Icon icon={ListChecks} size={18} />} onBack={onClose} />
            <div className="flex flex-col gap-4" data-testid="novel-review">
                <Tabs idBase="novel-review" aria-label={copy('label')} value={view} onChange={(value) => { setView(value); setNotice(null) }}
                    options={(['tasks', 'stash'] as const).map((value) => ({ value, label: copy('tabs.' + value),
                        trailing: value === 'tasks' && tasks.items.some((task) => task.state === 'open') ? <span className="text-xs text-parchment-400">{tasks.items.filter((task) => task.state === 'open').length}</span> : undefined }))} />
                {readOnly && <Callout tone="info" role="status">{copy('readOnly')}</Callout>}
                {notice && <Callout tone={notice.tone} role={notice.tone === 'warning' ? 'alert' : 'status'}>{notice.text}</Callout>}
                <TabPanel value="tasks" idBase="novel-review" active={view}>
                    <TaskList tasks={tasks} readOnly={readOnly} busy={busy} run={run} sceneTitle={sceneTitle} getSelection={getSelection}
                        onOpenPassage={async (task) => {
                            if (!task.data.sceneId) return
                            const result = await onOpenPassage(task.data.sceneId, task.data.quote)
                            if (result === 'blocked') setNotice({ tone: 'warning', text: t('novelEditor.planningViews.blocked') })
                            else if (result === 'scene' && task.data.quote) setNotice({ tone: 'warning', text: copy('tasks.passageChanged') })
                        }} />
                </TabPanel>
                <TabPanel value="stash" idBase="novel-review" active={view}>
                    <StashList stash={stash} readOnly={readOnly} busy={busy} run={run} sceneTitle={sceneTitle} getSelection={getSelection}
                        cutSelection={cutSelection} insertText={insertText} notify={setNotice} />
                </TabPanel>
            </div>
        </section>
    )
}

type Run = (action: () => Promise<unknown>, done?: string) => Promise<boolean>

function TaskList({ tasks, readOnly, busy, run, sceneTitle, getSelection, onOpenPassage }: {
    tasks: PlanItems<'task'>; readOnly: boolean; busy: boolean; run: Run; sceneTitle: (id: string) => string | null
    getSelection: () => PassageSelection | null; onOpenPassage: (task: Task) => Promise<void>
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.review.tasks.' + key, values)
    const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')
    const [draft, setDraft] = useState<{ title: string; body: string; link: boolean; selection: PassageSelection | null } | null>(null)
    const [resolving, setResolving] = useState<{ id: string; text: string } | null>(null)
    const shown = tasks.items.filter((task) => filter === 'all' ? task.state !== 'trashed' : filter === 'open' ? task.state === 'open' : task.state === 'done' || task.state === 'dismissed')
    const setState = (task: Task, state: StoryTaskState, resolution?: string) =>
        run(() => tasks.update(task, resolution === undefined ? { state } : { state, data: { ...task.data, ...(resolution ? { resolution } : {}) } }))
    const save = async () => {
        if (!draft?.title.trim()) return
        const link = draft.link && draft.selection
        const ok = await run(() => tasks.create({ title: draft.title.trim(), origin: 'author', ...(draft.body.trim() ? { body: draft.body.trim() } : {}),
            ...(link && draft.selection ? { sceneId: draft.selection.sceneId, quote: draft.selection.quote.slice(0, 2000), sourceRevision: draft.selection.revision } : {}) }))
        if (ok) setDraft(null)
    }
    return (
        <div className="flex flex-col gap-3">
            <p className="text-caption text-parchment-400">{copy('help')}</p>
            {tasks.error && <Callout tone="warning" role="alert">{t('novelEditor.review.loadFailed')} <Button size="sm" variant="secondary" onClick={() => void tasks.refresh()}>{t('novelEditor.review.retry')}</Button></Callout>}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label={copy('filter')}>
                {(['open', 'done', 'all'] as const).map((value) => (
                    <Button key={value} size="sm" variant={filter === value ? 'secondary' : 'ghost'} aria-pressed={filter === value} onClick={() => setFilter(value)}>{copy('filters.' + value)}</Button>
                ))}
                {!readOnly && !draft && <Button size="sm" className="ml-auto" onClick={() => { const selection = getSelection(); setDraft({ title: '', body: '', link: Boolean(selection), selection }) }}>{copy('new')}</Button>}
            </div>
            {draft && (
                <form className="flex flex-col gap-2 rounded-md border border-parchment-50/10 p-3" onSubmit={(event) => { event.preventDefault(); void save() }}>
                    <Field label={copy('titleLabel')}><Input value={draft.title} maxLength={500} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
                    <Field label={copy('bodyLabel')}><Textarea rows={2} maxLength={8000} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></Field>
                    {draft.selection
                        ? <label className="flex items-center gap-2 text-caption text-parchment-200"><input type="checkbox" checked={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.checked })} />{copy('linkSelection')}</label>
                        : <p className="text-caption text-parchment-400">{copy('noSelection')}</p>}
                    {draft.link && draft.selection && <p className="border-l-2 border-parchment-50/20 pl-2 font-narrative text-caption text-parchment-300">“{draft.selection.quote.slice(0, 280)}”</p>}
                    <div className="flex gap-2">
                        <Button size="sm" type="submit" disabled={busy || !draft.title.trim()}>{copy('add')}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>{copy('cancel')}</Button>
                    </div>
                </form>
            )}
            {!shown.length && !tasks.loading && <p className="text-caption text-parchment-400">{copy('empty')}</p>}
            <ul className="flex flex-col gap-2">
                {shown.map((task) => {
                    const scene = task.data.sceneId ? sceneTitle(task.data.sceneId) : null
                    return (
                        <li key={task.id} className="flex min-w-0 flex-col gap-1.5 rounded-md border border-parchment-50/10 bg-ink-800/60 px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="min-w-0 font-ui text-label font-semibold text-parchment-50">{task.data.title}</span>
                                <Badge tone={task.state === 'open' ? 'ember' : 'neutral'}>{copy('states.' + task.state)}</Badge>
                                {task.data.origin !== 'author' && <Badge tone="arcane">{copy('origins.' + task.data.origin)}</Badge>}
                            </div>
                            {task.data.body && <p className="whitespace-pre-wrap text-caption text-parchment-200">{task.data.body}</p>}
                            {task.data.sceneId && <p className="text-caption text-parchment-400">{scene ?? copy('sceneMissing')}</p>}
                            {task.data.quote && <p className="border-l-2 border-parchment-50/20 pl-2 font-narrative text-caption text-parchment-300">“{task.data.quote}”</p>}
                            {task.data.resolution && <p className="text-caption text-parchment-300">{copy('resolution', { text: task.data.resolution })}</p>}
                            {resolving?.id === task.id ? (
                                <div className="flex flex-col gap-2">
                                    <Field label={copy('resolutionLabel')}><Textarea rows={2} maxLength={2000} value={resolving.text} onChange={(event) => setResolving({ id: task.id, text: event.target.value })} /></Field>
                                    <div className="flex gap-2">
                                        <Button size="sm" disabled={busy} onClick={() => void setState(task, 'done', resolving.text.trim()).then((ok) => { if (ok) setResolving(null) })}>{copy('confirmDone')}</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setResolving(null)}>{copy('cancel')}</Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {task.data.sceneId && scene && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void onOpenPassage(task)}>{copy(task.data.quote ? 'goTo' : 'openScene')}</Button>}
                                    {!readOnly && task.state === 'open' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setResolving({ id: task.id, text: '' })}>{copy('done')}</Button>}
                                    {!readOnly && task.state === 'open' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setState(task, 'dismissed')}>{copy('dismiss')}</Button>}
                                    {!readOnly && task.state !== 'open' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setState(task, 'open')}>{copy('reopen')}</Button>}
                                    {!readOnly && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setState(task, 'trashed')}>{copy('trash')}</Button>}
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

function StashList({ stash, readOnly, busy, run, sceneTitle, getSelection, cutSelection, insertText, notify }: {
    stash: PlanItems<'stash'>; readOnly: boolean; busy: boolean; run: Run; sceneTitle: (id: string) => string | null
    getSelection: () => PassageSelection | null; cutSelection: (expected: string) => boolean; insertText: (text: string) => boolean
    notify: (notice: { tone: 'info' | 'warning'; text: string } | null) => void
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.review.stash.' + key, values)
    const [query, setQuery] = useState('')
    const [copied, setCopied] = useState<string | null>(null)
    const needle = query.trim().toLocaleLowerCase()
    const shown = stash.items.filter((item) => item.state === 'kept' && (!needle || (item.data.title + '\n' + item.data.text).toLocaleLowerCase().includes(needle)))
    const keep = async (kind: 'cut' | 'take') => {
        const selection = getSelection()
        if (!selection?.quote.trim()) { notify({ tone: 'warning', text: copy('needSelection') }); return }
        const title = selection.quote.trim().split(/\s+/).slice(0, 8).join(' ').slice(0, 255)
        const saved = await run(() => stash.create({ kind, title, text: selection.quote.slice(0, 100_000), sceneId: selection.sceneId, sourceRevision: selection.revision }))
        // The text leaves the manuscript only after the stash holds it.
        if (saved && kind === 'cut') notify(!cutSelection(selection.quote) ? { tone: 'warning', text: copy('insertBlocked') } : { tone: 'info', text: copy('cutDone') })
    }
    const insert = (item: Stashed) => notify(insertText(item.data.text) ? { tone: 'info', text: copy('inserted') } : { tone: 'warning', text: copy('insertBlocked') })
    return (
        <div className="flex flex-col gap-3">
            <p className="text-caption text-parchment-400">{copy('help')}</p>
            {stash.error && <Callout tone="warning" role="alert">{t('novelEditor.review.loadFailed')} <Button size="sm" variant="secondary" onClick={() => void stash.refresh()}>{t('novelEditor.review.retry')}</Button></Callout>}
            {!readOnly && (
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => void keep('cut')}>{copy('cut')}</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void keep('take')}>{copy('take')}</Button>
                </div>
            )}
            <Field label={copy('search')}><Input type="search" value={query} maxLength={128} onChange={(event) => setQuery(event.target.value)} /></Field>
            {!shown.length && !stash.loading && <p className="text-caption text-parchment-400">{copy(needle ? 'noMatch' : 'empty')}</p>}
            <ul className="flex flex-col gap-2">
                {shown.map((item) => (
                    <li key={item.id} className="flex min-w-0 flex-col gap-1.5 rounded-md border border-parchment-50/10 bg-ink-800/60 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Badge tone="neutral">{copy('kinds.' + item.data.kind)}</Badge>
                            <span className="min-w-0 truncate font-ui text-label font-semibold text-parchment-50">{item.data.title}</span>
                        </div>
                        {item.data.sceneId && <p className="text-caption text-parchment-400">{copy('from', { scene: sceneTitle(item.data.sceneId) ?? '—' })}</p>}
                        <p className="line-clamp-4 whitespace-pre-wrap font-narrative text-caption text-parchment-200">{item.data.text}</p>
                        <div className="flex flex-wrap gap-1.5">
                            {!readOnly && <Button size="sm" variant="secondary" onClick={() => insert(item)}>{copy('insert')}</Button>}
                            <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(item.data.text).then(() => setCopied(item.id), () => setCopied(null)) }}>{copied === item.id ? copy('copied') : copy('copy')}</Button>
                            {!readOnly && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => stash.update(item, { state: 'trashed' }))}>{copy('trash')}</Button>}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    )
}
