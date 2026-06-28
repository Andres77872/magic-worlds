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
    className?: string
}

const TONE: Record<SectionHeaderTone, string> = {
    ember: 'text-ember-400',
    arcane: 'text-arcane-400',
}

export function SectionHeader({ icon, title, tone = 'ember', right, className }: SectionHeaderProps) {
    return (
        <div className={cx('flex items-center gap-2 text-fg-muted', className)}>
            {icon && <Icon icon={icon} size={16} className={TONE[tone]} />}
            <h4 className="font-display text-[18px] font-semibold text-fg">{title}</h4>
            {right && <div className="ml-auto">{right}</div>}
        </div>
    )
}
