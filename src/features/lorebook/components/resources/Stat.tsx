import type { ReactNode } from 'react'
import { cx } from '@/ui/primitives'

/** Compact labelled metric box shared by the lorebook + resource cards. */
export function Stat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
    return (
        <div className="rounded-md bg-ink-800 px-2.5 py-2">
            {icon}
            <div className={cx('font-ui text-meta text-parchment-400', icon ? 'mt-1' : undefined)}>{label}</div>
            <div className="font-display text-lg font-semibold text-parchment-50">{value}</div>
        </div>
    )
}
