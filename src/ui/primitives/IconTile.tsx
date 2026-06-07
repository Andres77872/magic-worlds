/**
 * Reverie icon tile — a square, tinted glyph plate that anchors section headers,
 * create/feature cards, and empty states. Ember by default; arcane for AI/magic.
 *
 * Extracted from the inline copies that lived in the landing sections
 * (AccessMenu / HowItWorksSection / ClosingCTA) so every screen shares one tile.
 * Pass `glow` to have it light up on parent `:hover` (place inside a `group`).
 */
import type { LucideIcon } from 'lucide-react'
import { cx } from './cx'
import { Icon } from './Icon'

export type IconTileTone = 'ember' | 'arcane'
export type IconTileSize = 'sm' | 'md' | 'lg'

interface IconTileProps {
    icon: LucideIcon
    tone?: IconTileTone
    size?: IconTileSize
    /** Light up with the matching candlelight glow on parent `group` hover. */
    glow?: boolean
    className?: string
}

const SIZE = {
    sm: { box: 'h-10 w-10 rounded-md', glyph: 20 },
    md: { box: 'h-[52px] w-[52px] rounded-md', glyph: 24 },
    lg: { box: 'h-14 w-14 rounded-2xl', glyph: 28 },
} as const

const TONE = {
    ember: 'bg-ember-500/[.12] text-ember-400',
    arcane: 'bg-arcane-500/15 text-arcane-400',
} as const

const GLOW = {
    ember: 'group-hover:shadow-glow-ember',
    arcane: 'group-hover:shadow-glow-arcane',
} as const

export function IconTile({ icon, tone = 'ember', size = 'md', glow = false, className }: IconTileProps) {
    const dims = SIZE[size]
    return (
        <span
            className={cx(
                'inline-flex shrink-0 items-center justify-center transition-all',
                dims.box,
                TONE[tone],
                glow && GLOW[tone],
                className,
            )}
        >
            <Icon icon={icon} size={dims.glyph} />
        </span>
    )
}
