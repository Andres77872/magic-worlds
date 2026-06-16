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

// A lit glyph-plate: a candlelit gradient fill + inset ring + a soft resting
// halo, so tiles read as glowing runes rather than flat tinted squares.
const TONE = {
    ember: 'bg-gradient-to-br from-ember-500/25 to-ember-500/[.06] text-ember-300 ring-1 ring-inset ring-ember-500/25 shadow-[0_0_20px_-8px_var(--color-ember-500)]',
    arcane: 'bg-gradient-to-br from-arcane-500/28 to-arcane-500/[.08] text-arcane-300 ring-1 ring-inset ring-arcane-500/25 shadow-[0_0_20px_-7px_var(--color-arcane-500)]',
} as const

const GLOW = {
    ember: 'group-hover:shadow-glow-ember group-hover:ring-ember-500/45 group-hover:text-ember-200',
    arcane: 'group-hover:shadow-glow-arcane group-hover:ring-arcane-500/45 group-hover:text-arcane-200',
} as const

export function IconTile({ icon, tone = 'ember', size = 'md', glow = false, className }: IconTileProps) {
    const dims = SIZE[size]
    return (
        <span
            className={cx(
                'inline-flex shrink-0 items-center justify-center transition-all duration-300',
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
