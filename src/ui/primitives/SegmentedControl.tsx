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
    'aria-label': string
    className?: string
    'data-testid'?: string
}

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    size = 'sm',
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
            className={cx('inline-flex items-center gap-0.5 rounded-lg border border-line-faint bg-surface-raised p-1', className)}
            data-testid={testId}
        >
            {options.map((option, index) => {
                const selected = option.value === value
                return (
                    <IconButton
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
