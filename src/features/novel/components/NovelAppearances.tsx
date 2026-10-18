/**
 * Appearances — where a name occurs in the saved manuscript, scene by scene,
 * with each passage opening in Write through the studio's save barrier.
 */

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorySearchMatch, StorySearchPage } from '@/shared/types/storySearch.types'
import { Button, Callout, Field, Input } from '@/ui/primitives'

export interface AppearanceSearch {
    find: (q: string) => Promise<StorySearchPage>
    /** Resolves false when the writer's current change blocks leaving the scene. */
    open: (q: string, page: StorySearchPage, match: StorySearchMatch) => Promise<boolean>
}

export interface AppearanceState { q: string; page: StorySearchPage | null; status: 'loading' | 'ready' | 'failed' | 'blocked' }

export function NovelAppearances({ search, value, onSearch, onOpened }: {
    search: AppearanceSearch; value: AppearanceState | null; onSearch: (q: string) => void; onOpened: () => void
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.planningViews.appearances.' + key, values)
    const [draft, setDraft] = useState<{ for: string | null; q: string }>({ for: null, q: '' })
    // A new search from a matrix row replaces what was typed for the previous one.
    const q = draft.for === (value?.q ?? null) ? draft.q : value?.q ?? ''
    const [opening, setOpening] = useState<string | null>(null), [blocked, setBlocked] = useState(false)
    const submit = (event: FormEvent) => { event.preventDefault(); if (q.trim()) onSearch(q.trim()) }
    const open = async (match: StorySearchMatch) => {
        if (!value?.page || opening) return
        const key = match.sceneId + ':' + match.position
        setOpening(key); setBlocked(false)
        try { if (await search.open(value.q, value.page, match)) onOpened(); else setBlocked(true) }
        catch { setBlocked(true) }
        finally { setOpening(null) }
    }
    const items = value?.page?.items ?? []
    return (
        <section aria-label={copy('title')} className="flex flex-col gap-2">
            <h3 className="font-display text-h3">{copy('title')}</h3>
            <p className="text-caption text-parchment-400">{copy('help')}</p>
            <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
                <Field label={copy('term')} className="min-w-48 flex-1">
                    <Input value={q} maxLength={255} onChange={(event) => setDraft({ for: value?.q ?? null, q: event.target.value })} />
                </Field>
                <Button type="submit" size="sm" variant="secondary" disabled={!q.trim() || value?.status === 'loading'}>{copy('find')}</Button>
            </form>
            {value?.status === 'loading' && <p role="status" className="text-caption text-parchment-300">{copy('loading')}</p>}
            {value?.status === 'failed' && <Callout tone="warning" role="alert">{copy('failed')}</Callout>}
            {blocked && <Callout tone="warning" role="alert">{copy('blocked')}</Callout>}
            {value?.page && <>
                <p role="status" className="text-caption text-parchment-300">{items.length
                    ? copy('summary', { count: items.length, scenes: value.page.matchingScenes, q: value.q }) + (value.page.nextCursor ? ' ' + copy('more') : '')
                    : copy('none', { q: value.q })}</p>
                <ol className="flex flex-col gap-1">
                    {items.map((match) => {
                        const key = match.sceneId + ':' + match.position
                        return <li key={key}>
                            <button type="button" disabled={opening !== null} onClick={() => void open(match)}
                                className="w-full cursor-pointer rounded-md border border-parchment-50/10 px-3 py-2 text-left hover:bg-parchment-50/[.04] disabled:cursor-wait">
                                <span className="block text-caption text-parchment-300">{match.chapterTitle} · {match.title}</span>
                                <span className="block font-narrative text-body text-parchment-200">
                                    {match.beforeCut && '…'}{match.before}<mark className="bg-ember-500/15 text-parchment-50">{match.quote}</mark>{match.after}{match.afterCut && '…'}
                                </span>
                            </button>
                        </li>
                    })}
                </ol>
            </>}
        </section>
    )
}
