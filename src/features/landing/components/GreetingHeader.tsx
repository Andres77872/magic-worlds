/**
 * Discovery greeting — a time-of-day eyebrow, the night's prompt, and a search
 * field that filters the scene gallery by name, world, or tag.
 */

import { Search } from 'lucide-react'
import { controlClass, Eyebrow, Icon } from '@/ui/primitives'

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
}

export function GreetingHeader({ query, onQueryChange }: GreetingHeaderProps) {
    return (
        <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
            <div className="flex flex-col gap-2">
                <Eyebrow>{greeting()}</Eyebrow>
                <h1 className="font-display text-[clamp(30px,4vw,46px)] font-semibold leading-[1.05] tracking-tight text-parchment-50">
                    Who will you become tonight?
                </h1>
            </div>

            <div className="relative flex w-full items-center md:max-w-[320px]">
                <span className="pointer-events-none absolute left-3 flex items-center text-parchment-400">
                    <Icon icon={Search} size={16} />
                </span>
                <input
                    type="search"
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Search by name, world, or vibe…"
                    aria-label="Search scenes"
                    className={`${controlClass} rounded-full pl-10`}
                />
            </div>
        </header>
    )
}
