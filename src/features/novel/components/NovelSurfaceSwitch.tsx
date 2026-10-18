/**
 * Write · Plan · Review (U01): one switch in the studio header chooses what the centre column shows. Write is the
 * quiet manuscript; Plan holds the board, timeline, matrix, facts and summaries; Review holds revision tasks and the
 * stash. The manuscript stays loaded behind the other two, so its draft, cursor and scroll position wait unchanged.
 */

import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, ListChecks, PenLine, type LucideIcon } from 'lucide-react'
import { Icon, cx } from '@/ui/primitives'

export type NovelSurface = 'write' | 'plan' | 'review'

export function NovelSurfaceSwitch({ value, onChange, review, reviewCount }: {
    value: NovelSurface
    onChange: (surface: NovelSurface) => void
    /** False while revision tasks and the stash are unavailable for this novel. */
    review: boolean
    /** Open revision tasks, once loaded. */
    reviewCount?: number
}) {
    const { t } = useTranslation()
    const copy = (key: string, values?: Record<string, unknown>) => t('novelEditor.surfaces.' + key, values)
    const refs = useRef<(HTMLButtonElement | null)[]>([])
    const options: { value: NovelSurface; icon: LucideIcon }[] = [
        { value: 'write', icon: PenLine }, { value: 'plan', icon: LayoutGrid },
        ...(review ? [{ value: 'review' as const, icon: ListChecks }] : []),
    ]
    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
        if (!step) return
        event.preventDefault()
        const next = (index + step + options.length) % options.length
        onChange(options[next].value)
        refs.current[next]?.focus()
    }
    return (
        <div role="radiogroup" aria-label={copy('label')} data-testid="novel-surface-switch"
            className="inline-flex items-center gap-0.5 rounded-lg border border-line-faint bg-surface-raised p-0.5">
            {options.map((option, index) => {
                const selected = option.value === value
                const count = option.value === 'review' && reviewCount ? reviewCount : 0
                const label = copy(option.value)
                return (
                    <button key={option.value} ref={(node) => { refs.current[index] = node }} type="button" role="radio"
                        aria-checked={selected} tabIndex={selected ? 0 : -1}
                        aria-label={count ? copy('reviewCount', { count }) : label} title={label}
                        onClick={() => onChange(option.value)} onKeyDown={(event) => move(event, index)}
                        className={cx(
                            'inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-ui text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400',
                            selected ? 'bg-ember-500/10 text-ember-300' : 'text-parchment-300 hover:bg-parchment-50/[.04] hover:text-parchment-100',
                        )}>
                        <Icon icon={option.icon} size={16} />
                        <span aria-hidden="true" className="hidden md:inline">{label}</span>
                        {count > 0 && <span aria-hidden="true" className="rounded-full bg-parchment-50/10 px-1.5 text-caption tabular-nums text-parchment-200">{count}</span>}
                    </button>
                )
            })}
        </div>
    )
}
