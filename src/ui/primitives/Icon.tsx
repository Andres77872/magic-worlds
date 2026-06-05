/**
 * Reverie icon wrapper around lucide-react.
 * Functional icons only, 1.75 stroke (Reverie spec). Pass any lucide icon:
 *   import { Flame } from 'lucide-react'
 *   <Icon icon={Flame} size={18} />
 */
import type { LucideIcon } from 'lucide-react'

interface IconProps {
    icon: LucideIcon
    size?: number
    strokeWidth?: number
    className?: string
}

export function Icon({ icon: LucideGlyph, size = 18, strokeWidth = 1.75, className }: IconProps) {
    return <LucideGlyph size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
}
