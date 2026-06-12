/**
 * Reverie section header — optional accent icon + display-serif title, with an
 * optional right-aligned slot (count, action, etc.).
 */
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'
import { Icon } from './Icon'

interface SectionHeaderProps {
    icon?: LucideIcon
    title: ReactNode
    tone?: 'ember' | 'arcane'
    right?: ReactNode
    className?: string
}

export function SectionHeader({ icon, title, tone = 'ember', right, className }: SectionHeaderProps) {
    return (
        <div className={cx('flex items-center gap-2 text-parchment-200', className)}>
            {icon && <Icon icon={icon} size={16} className={tone === 'arcane' ? 'text-arcane-400' : 'text-ember-400'} />}
            <h4 className="font-display text-[18px] font-semibold text-parchment-50">{title}</h4>
            {right && <div className="ml-auto">{right}</div>}
        </div>
    )
}
