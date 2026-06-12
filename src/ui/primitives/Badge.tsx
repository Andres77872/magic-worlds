/**
 * Reverie status badge. Tones: ember, arcane, live (success), danger (errors),
 * nsfw (sensitive content), neutral.
 */
import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

export type BadgeTone = 'ember' | 'arcane' | 'live' | 'danger' | 'nsfw' | 'neutral' | 'glass'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone
    icon?: ReactNode
}

const TONE: Record<BadgeTone, string> = {
    ember: 'bg-ember-500/15 text-ember-300',
    arcane: 'bg-arcane-500/15 text-arcane-300',
    live: 'bg-verdant-500/15 text-verdant-500',
    danger: 'bg-blood-500/15 text-[#F0938B]',
    nsfw: 'bg-blood-500/15 text-[#F0938B]',
    neutral: 'bg-ink-600 text-parchment-200',
    glass: 'bg-ink-900/60 text-arcane-300 backdrop-blur',
}

export function Badge({ tone = 'ember', icon, className, children, ...rest }: BadgeProps) {
    return (
        <span
            className={cx(
                'inline-flex items-center gap-1.5 text-[11px] font-semibold font-ui px-2.5 py-1 rounded-full tracking-[0.02em] whitespace-nowrap',
                TONE[tone],
                className,
            )}
            {...rest}
        >
            {icon}
            {children}
        </span>
    )
}
