/**
 * "On this page" navigation for the Guide. Desktop: a sticky rail with a
 * scroll-spied current item (`aria-current` plus a left bar and weight, not
 * color alone). Narrow screens: a non-sticky disclosure at the top of the
 * content — a collapsed sticky TOC goes unnoticed, and section "Back to top"
 * buttons cover the return trip. Items search hides are dimmed, not removed.
 */
import { useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'
import type { NavSection } from '../docsContent'

interface GuideNavProps {
    id: string
    sections: NavSection[]
    activeId: string
    isMatch: (id: string) => boolean
    filtering: boolean
    onSelect: (id: string) => void
    ariaLabel: string
    heading: string
    desktop: boolean
}

export function GuideNav({ id, sections, activeId, isMatch, filtering, onSelect, ariaLabel, heading, desktop }: GuideNavProps) {
    const detailsRef = useRef<HTMLDetailsElement>(null)
    const activeLabel = sections.find((section) => section.id === activeId)?.label

    const list = (
        <ol className={cx('m-0 list-none p-0', desktop ? 'flex flex-col gap-0.5' : 'grid grid-cols-1 gap-1 pt-2 min-[420px]:grid-cols-2')}>
            {sections.map((section) => {
                const active = activeId === section.id
                const dim = filtering && !isMatch(section.id)
                return (
                    <li key={section.id}>
                        <button
                            type="button"
                            aria-current={active ? 'location' : undefined}
                            onClick={() => {
                                if (detailsRef.current) detailsRef.current.open = false
                                onSelect(section.id)
                            }}
                            className={cx(
                                'relative flex min-h-9 w-full items-center gap-2.5 rounded-md py-1.5 pl-3 pr-2 text-left font-ui text-[13px] transition-colors',
                                active
                                    ? 'bg-ember-500/12 font-semibold text-ember-200 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-ember-400'
                                    : 'font-medium text-parchment-300 hover:bg-parchment-50/[.05] hover:text-parchment-50',
                                dim && 'opacity-40',
                            )}
                        >
                            <Icon icon={section.icon} size={15} className="shrink-0" />
                            <span className="min-w-0">{section.label}</span>
                        </button>
                    </li>
                )
            })}
        </ol>
    )

    if (desktop) {
        return (
            <nav id={id} aria-label={ariaLabel} className="flex flex-col gap-2">
                <p className="m-0 px-3 font-ui text-eyebrow font-semibold uppercase text-fg-subtle">{heading}</p>
                {list}
            </nav>
        )
    }

    return (
        <nav id={id} aria-label={ariaLabel} className="scroll-mt-6">
            <details ref={detailsRef} className="group rounded-xl border border-line-faint bg-surface-raised px-3 py-2">
                <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 font-ui text-label [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold uppercase tracking-[0.12em] text-fg-subtle">{heading}</span>
                    {activeLabel && <span className="min-w-0 flex-1 truncate font-semibold text-ember-300">{activeLabel}</span>}
                    <Icon icon={ChevronDown} size={16} className="ml-auto shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                </summary>
                {list}
            </details>
        </nav>
    )
}
