/**
 * Reverie section header — optional accent icon + display-serif title, with an
 * optional right-aligned slot (count, action, etc.).
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'
import { Icon } from './Icon'

type SectionHeaderTone = 'ember' | 'arcane'

interface SectionHeaderProps {
    icon?: LucideIcon
    title: ReactNode
    tone?: SectionHeaderTone
    right?: ReactNode
    /** Match the document outline when the section is nested. */
    as?: 'h2' | 'h3' | 'h4'
    className?: string
}

const TONE: Record<SectionHeaderTone, string> = {
    ember: 'text-ember-400',
    arcane: 'text-arcane-400',
}

export function SectionHeader({ icon, title, tone = 'ember', right, as: Heading = 'h2', className }: SectionHeaderProps) {
    return (
        <div className={cx('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-fg-muted', className)}>
            <Heading className="flex min-w-0 w-40 max-w-full flex-auto items-center gap-2 break-words font-display text-lg font-semibold text-fg">
                {icon && <Icon icon={icon} size={16} className={cx('shrink-0', TONE[tone])} />}
                <span className="min-w-0 break-words">{title}</span>
            </Heading>
            {right && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{right}</div>}
        </div>
    )
}
