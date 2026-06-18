/**
 * SelectionCheck — the corner check badge for the app-wide "ring + corner check"
 * selection affordance. Rendered only when `selected`; the parent surface owns
 * the ember ring (`SELECTED_CARD_CLASS`) and `aria-pressed`, so this badge is
 * purely decorative. Position it in the corner via `className`
 * (e.g. `absolute right-2 top-2`).
 */
import { Check } from 'lucide-react'
import { cx } from './cx'
import { Icon } from './Icon'

interface SelectionCheckProps {
    selected: boolean
    className?: string
}

export function SelectionCheck({ selected, className }: SelectionCheckProps) {
    if (!selected) return null
    return (
        <span
            aria-hidden="true"
            className={cx(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember-500 text-on-ember shadow-md',
                className,
            )}
        >
            <Icon icon={Check} size={13} />
        </span>
    )
}
