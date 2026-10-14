import { useId, type ReactNode } from 'react'
import { cx } from '@/ui/primitives'

interface CheckboxFieldProps {
    label: ReactNode
    checked: boolean
    onChange: (checked: boolean) => void
    description?: ReactNode
    disabled?: boolean
    className?: string
}

/** A native checkbox with a visible label (keyboard and screen-reader native). */
export function CheckboxField({ label, checked, onChange, description, disabled = false, className }: CheckboxFieldProps) {
    const id = useId()
    const descriptionId = description ? `${id}-description` : undefined
    return (
        <div className={cx('flex items-start gap-2.5', className)}>
            <input
                id={id}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                aria-describedby={descriptionId}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-ember-500 disabled:cursor-not-allowed"
            />
            <div className="min-w-0">
                <label htmlFor={id} className={cx('font-ui text-sm text-parchment-100', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                    {label}
                </label>
                {description && (
                    <span id={descriptionId} className="block font-ui text-caption text-fg-muted">
                        {description}
                    </span>
                )}
            </div>
        </div>
    )
}
