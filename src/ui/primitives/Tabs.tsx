/**
 * Reverie Tabs — an accessible text-label tab bar implementing the WAI-ARIA
 * tabs pattern. `Tabs` renders only the `role="tablist"` of buttons; pair it
 * with {@link TabPanel} for the panels so the consumer owns panel mounting
 * (e.g. keep every panel mounted to preserve on-mount fetches/effects).
 *
 * Both orientations are supported: `horizontal` (an underline or pill bar) and
 * `vertical` (a left-aligned sidebar nav). The active tab lights ember; the
 * global focus-visible ring is preserved. Roving tabindex with arrow/Home/End
 * keys — selection follows focus, mirroring {@link SegmentedControl}.
 */
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'

export interface TabOption<T extends string> {
    value: T
    /** Visible label (also the accessible name). */
    label: string
    /** Optional leading glyph, e.g. `<Icon icon={...} size={16} />`. */
    icon?: ReactNode
    /** Optional trailing node (count/badge), pushed to the end of the tab. */
    trailing?: ReactNode
    disabled?: boolean
}

export type TabsOrientation = 'horizontal' | 'vertical'
export type TabsVariant = 'underline' | 'pill'
export type TabsSize = 'sm' | 'md'

interface TabsProps<T extends string> {
    options: readonly TabOption<T>[]
    value: T
    onChange: (value: T) => void
    /** Stable base id; `tabId`/`tabPanelId` derive the per-tab ids from it. */
    idBase: string
    'aria-label': string
    /** `vertical` ignores `variant` and renders the sidebar-nav row style. */
    orientation?: TabsOrientation
    variant?: TabsVariant
    size?: TabsSize
    className?: string
    'data-testid'?: string
}

/** id of the `role="tab"` button for a value — shared with its panel via `aria-controls`. */
export function tabId(idBase: string, value: string) {
    return `${idBase}-tab-${value}`
}

/** id of the `role="tabpanel"` for a value — paired with its tab via `aria-labelledby`. */
export function tabPanelId(idBase: string, value: string) {
    return `${idBase}-panel-${value}`
}

const SIZE: Record<TabsSize, string> = {
    sm: 'text-[13px]',
    md: 'text-sm',
}

export function Tabs<T extends string>({
    options,
    value,
    onChange,
    idBase,
    'aria-label': ariaLabel,
    orientation = 'horizontal',
    variant = 'underline',
    size = 'md',
    className,
    'data-testid': testId,
}: TabsProps<T>) {
    const refs = useRef<(HTMLButtonElement | null)[]>([])
    const vertical = orientation === 'vertical'
    const isPill = !vertical && variant === 'pill'

    // Only enabled tabs participate in roving focus.
    const enabledIndexes = options.flatMap((option, index) => (option.disabled ? [] : [index]))

    const moveTo = (index: number) => {
        refs.current[index]?.focus()
        onChange(options[index].value)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const forwardKey = vertical ? 'ArrowDown' : 'ArrowRight'
        const backKey = vertical ? 'ArrowUp' : 'ArrowLeft'
        const pos = enabledIndexes.indexOf(index)
        let nextPos: number
        switch (event.key) {
            case forwardKey:
                nextPos = (pos + 1) % enabledIndexes.length
                break
            case backKey:
                nextPos = (pos - 1 + enabledIndexes.length) % enabledIndexes.length
                break
            case 'Home':
                nextPos = 0
                break
            case 'End':
                nextPos = enabledIndexes.length - 1
                break
            default:
                return
        }
        event.preventDefault()
        moveTo(enabledIndexes[nextPos])
    }

    const containerClass = vertical
        ? cx('flex flex-col gap-0.5', isPill && 'rounded-lg border border-line-faint bg-surface-raised p-1')
        : isPill
          ? 'flex items-center gap-1 rounded-lg border border-line-faint bg-surface-raised p-1'
          : 'flex items-center gap-1 border-b border-line-faint'

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            aria-orientation={orientation}
            className={cx(containerClass, className)}
            data-testid={testId}
        >
            {options.map((option, index) => {
                const selected = option.value === value
                let state: string
                let layout: string
                if (vertical) {
                    layout = 'w-full justify-start rounded-md px-3 py-2'
                    state = selected
                        ? 'bg-ember-500/12 text-ember-300'
                        : 'text-parchment-400 hover:text-parchment-200 hover:bg-parchment-50/[.04]'
                } else if (isPill) {
                    layout = 'justify-center rounded-md px-3 py-2'
                    state = selected
                        ? 'bg-ember-500/15 text-ember-300 ring-1 ring-inset ring-ember-500/35'
                        : 'text-parchment-400 hover:text-parchment-200'
                } else {
                    layout = '-mb-px justify-center border-b-2 px-3 py-2.5'
                    state = selected
                        ? 'border-ember-500 text-ember-300'
                        : 'border-transparent text-parchment-400 hover:text-parchment-200'
                }
                return (
                    <button
                        key={option.value}
                        ref={(node) => {
                            refs.current[index] = node
                        }}
                        type="button"
                        role="tab"
                        id={tabId(idBase, option.value)}
                        aria-selected={selected}
                        aria-controls={tabPanelId(idBase, option.value)}
                        tabIndex={selected ? 0 : -1}
                        disabled={option.disabled}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                        className={cx(
                            'inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-ui font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                            SIZE[size],
                            layout,
                            state,
                        )}
                    >
                        {option.icon}
                        <span>{option.label}</span>
                        {option.trailing != null && <span className="ml-auto pl-2">{option.trailing}</span>}
                    </button>
                )
            })}
        </div>
    )
}

interface TabPanelProps {
    /** Must match a {@link TabOption} value. */
    value: string
    /** Must match the owning {@link Tabs} `idBase`. */
    idBase: string
    /** Currently-selected tab value; the panel is `hidden` unless it matches. */
    active: string
    children: ReactNode
    className?: string
    /**
     * When true the panel mounts only once it becomes active (lazy). Default
     * `false` keeps it mounted and toggles `hidden`, so on-mount effects inside
     * inactive panels still run on first render (the Profile page relies on this
     * to preserve the email-credit auto-claim and the email-list prefetch).
     */
    mountOnEnter?: boolean
}

export function TabPanel({ value, idBase, active, children, className, mountOnEnter = false }: TabPanelProps) {
    const isActive = value === active
    if (mountOnEnter && !isActive) return null
    return (
        <div
            role="tabpanel"
            id={tabPanelId(idBase, value)}
            aria-labelledby={tabId(idBase, value)}
            hidden={!isActive}
            className={className}
        >
            {children}
        </div>
    )
}
