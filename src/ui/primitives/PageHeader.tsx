/**
 * Reverie page header — the one masthead used across the app's top-level screens
 * (creation studio, dashboard greeting, profile). Eyebrow + display-serif title
 * (+ optional subtitle) on the left, actions on the right. This is the core of a
 * "consolidated" look: every screen opens the same way instead of each rolling
 * its own header.
 *
 * Renders an <h1> by default (each screen owns one); pass `as="h2"` when the page
 * already has an <h1> elsewhere.
 *
 * Deliberately no background glow: a radial wash clipped to a short, wide header
 * reads as a hard-edged box behind the title. Candlelight belongs in tall heroes
 * (LandingHero / ClosingCTA) and on cards, not here — keep app headers crisp.
 */
import type { ReactNode } from 'react'
import { cx } from './cx'
import { Eyebrow } from './Eyebrow'

interface PageHeaderProps {
    eyebrow?: ReactNode
    eyebrowTone?: 'ember' | 'arcane' | 'muted'
    title: ReactNode
    subtitle?: ReactNode
    /** Leading element before the title (an emoji string or an <IconTile>). */
    icon?: ReactNode
    /** Right-aligned actions (buttons, a search field, etc.). */
    actions?: ReactNode
    /** Title scale: `md` = section heading (default), `lg` = page hero. */
    size?: 'md' | 'lg'
    /** Heading level for the title element. */
    as?: 'h1' | 'h2'
    /** Bottom hairline + padding, matching the old studio header. */
    divider?: boolean
    className?: string
}

const TITLE_SIZE = {
    md: 'text-h2 max-sm:text-[26px]',
    lg: 'text-h1',
} as const

export function PageHeader({
    eyebrow,
    eyebrowTone = 'ember',
    title,
    subtitle,
    icon,
    actions,
    size = 'md',
    as: Heading = 'h1',
    divider = false,
    className,
}: PageHeaderProps) {
    return (
        <header className={cx(divider && 'border-b border-parchment-50/10 pb-5', className)}>
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
                <div className="flex min-w-0 flex-col gap-2.5">
                    {eyebrow && <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>}
                    <div className="flex items-center gap-3">
                        {icon}
                        <Heading
                            className={cx(
                                'm-0 font-display font-semibold tracking-tight text-parchment-50',
                                TITLE_SIZE[size],
                            )}
                        >
                            {title}
                        </Heading>
                    </div>
                    {subtitle && (
                        <p className="max-w-[60ch] font-narrative text-[17px] leading-snug text-parchment-300">
                            {subtitle}
                        </p>
                    )}
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
            </div>
        </header>
    )
}
