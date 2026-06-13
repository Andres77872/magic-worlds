/**
 * Discovery greeting — a time-of-day eyebrow, the night's prompt, and the
 * global dashboard search (everything you own: sessions, adventures, cast,
 * worlds, items, novels). Built on the shared PageHeader so the logged-in
 * masthead matches the guest hero's candlelight instead of reading as a plain
 * heading.
 */

import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { controlClass, cx, Icon, PageHeader } from '@/ui/primitives'

function greeting(): string {
    const hour = new Date().getHours()
    if (hour < 5) return 'Good night'
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

export interface GreetingHeaderProps {
    query: string
    onQueryChange: (query: string) => void
    /** Match count while a search is active — shown inside the field's edge. */
    resultsCount?: number
    /** Optional action rendered beside the search (e.g. a "Continue" button). */
    action?: ReactNode
}

export function GreetingHeader({ query, onQueryChange, resultsCount, action }: GreetingHeaderProps) {
    const searching = query.trim() !== ''
    return (
        <PageHeader
            eyebrow={greeting()}
            title="Who will you become tonight?"
            size="md"
            actions={
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
                    {action}
                    <div className="relative flex w-full items-center sm:w-[360px]">
                        <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                            <Icon icon={Search} size={16} />
                        </span>
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') onQueryChange('')
                            }}
                            placeholder="Search everything — characters, worlds, adventures…"
                            aria-label="Search your library"
                            className={cx(
                                `${controlClass} rounded-full pl-10`,
                                searching && 'border-ember-500/45 pr-20 shadow-glow-ember',
                            )}
                        />
                        {searching && resultsCount !== undefined && (
                            <span
                                className="pointer-events-none absolute right-4 font-mono text-[11px] text-ember-300"
                                data-testid="greeting-search-count"
                            >
                                {resultsCount} found
                            </span>
                        )}
                        <span className="sr-only" aria-live="polite">
                            {searching && resultsCount !== undefined
                                ? `${resultsCount} results for ${query.trim()}`
                                : ''}
                        </span>
                    </div>
                </div>
            }
        />
    )
}
