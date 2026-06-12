/**
 * Reverie Switch — accessible boolean toggle (role=switch) with the ember-on
 * track, plus SwitchRow: the labelled, bordered row used for settings lists
 * (label + optional description on the left, switch on the right).
 */
import { useId, type ReactNode } from 'react'
import { cx } from './cx'
import { useFieldContext } from './fieldContext'

export type SwitchSize = 'sm' | 'md'

interface SwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    size?: SwitchSize
    id?: string
    className?: string
    'aria-label'?: string
    'aria-describedby'?: string
}

const TRACK_SIZE: Record<SwitchSize, string> = {
    sm: 'h-5 w-9',
    md: 'h-6 w-[42px]',
}

const THUMB_SIZE: Record<SwitchSize, string> = {
    sm: 'h-4 w-4 translate-x-0.5',
    md: 'h-[18px] w-[18px] translate-x-[3px]',
}

const THUMB_ON: Record<SwitchSize, string> = {
    sm: 'translate-x-[18px]',
    md: 'translate-x-[21px]',
}

export function Switch({
    checked,
    onChange,
    disabled = false,
    size = 'md',
    id,
    className,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
}: SwitchProps) {
    const ctx = useFieldContext()
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            aria-describedby={ariaDescribedBy}
            id={id ?? ctx?.id}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cx(
                'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors',
                TRACK_SIZE[size],
                checked ? 'border border-transparent bg-ember-500' : 'border border-parchment-50/15 bg-ink-600',
                'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(232,162,74,.25)]',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
        >
            <span
                aria-hidden
                className={cx(
                    'rounded-full bg-parchment-50 shadow-sm transition-transform',
                    THUMB_SIZE[size],
                    checked && THUMB_ON[size],
                )}
            />
        </button>
    )
}

interface SwitchRowProps {
    label: ReactNode
    description?: ReactNode
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
}

export function SwitchRow({ label, description, checked, onChange, disabled = false, className }: SwitchRowProps) {
    const id = useId()
    const switchId = `switch-${id}`
    const descriptionId = description ? `switch-desc-${id}` : undefined
    return (
        <div
            className={cx(
                'flex items-start justify-between gap-4 rounded-lg border border-parchment-50/[.08] bg-ink-700/70 px-3.5 py-3',
                className,
            )}
        >
            <span className="min-w-0">
                <label htmlFor={switchId} className="block cursor-pointer font-ui text-sm font-semibold text-parchment-50">
                    {label}
                </label>
                {description && (
                    <span id={descriptionId} className="mt-1.5 block font-ui text-xs leading-snug text-parchment-300">
                        {description}
                    </span>
                )}
            </span>
            <Switch
                id={switchId}
                size="sm"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                aria-describedby={descriptionId}
                className="mt-0.5"
            />
        </div>
    )
}
