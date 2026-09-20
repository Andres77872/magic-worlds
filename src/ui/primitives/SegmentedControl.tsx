/**
 * Reverie segmented control — a compact pill of mutually-exclusive icon
 * segments (e.g. a grid/list view switch). Built on `IconButton`: the selected
 * segment lights ember (`tone="active"`), the rest stay quiet. Exposed as a
 * `radiogroup` with arrow-key roving so it's keyboard- and screen-reader-friendly.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import { IconButton, type IconButtonSize } from './IconButton'

export interface SegmentedControlOption<T extends string> {
    value: T
    /** Accessible label + tooltip for the segment. */
    label: string
    icon: ReactNode
}

interface SegmentedControlProps<T extends string> {
    options: readonly SegmentedControlOption<T>[]
    value: T
    onChange: (value: T) => void
    size?: IconButtonSize
    /** Show option names when an icon alone cannot explain the choice. */
    showLabels?: boolean
    'aria-label': string
    className?: string
    'data-testid'?: string
}

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    size = 'sm',
    showLabels = false,
    'aria-label': ariaLabel,
    className,
    'data-testid': testId,
}: SegmentedControlProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([])

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
        const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        if (!forward && !back) return
        event.preventDefault()
        const delta = forward ? 1 : -1
        const next = (index + delta + options.length) % options.length
        onChange(options[next].value)
        refs.current[next]?.focus()
    }

    return (
        <div
            role="radiogroup"
            aria-label={ariaLabel}
            className={cx('inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-line-faint bg-surface-raised p-1', className)}
            data-testid={testId}
        >
            {options.map((option, index) => {
                const selected = option.value === value
                return (
                    showLabels ? (
                    <button
                        key={option.value}
                        ref={(node) => { refs.current[index] = node }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={cx(
                            'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 font-ui text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400',
                            selected ? 'bg-ember-500/10 text-ember-300' : 'text-parchment-300 hover:bg-parchment-50/[.04] hover:text-parchment-100',
                        )}
                    >
                        <span aria-hidden="true" className="shrink-0">{option.icon}</span>
                        <span>{option.label}</span>
                    </button>
                    ) : <IconButton
                        key={option.value}
                        ref={(node) => {
                            refs.current[index] = node
                        }}
                        label={option.label}
                        size={size}
                        tone={selected ? 'active' : 'default'}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                    >
                        {option.icon}
                    </IconButton>
                )
            })}
        </div>
    )
}
