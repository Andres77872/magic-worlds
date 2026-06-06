/**
 * Closing call-to-action — a centered, candlelit send-off. One soft ember→arcane
 * glow, the brand flame, a big invitation, and a single action. Honest footer
 * line links the open-source repo (no pricing / age gates).
 */

import { Feather, Flame } from 'lucide-react'
import { Button, Icon } from '@/ui/primitives'
import { CLOSING_COPY, GITHUB_URL } from './landingContent'

export interface ClosingCTAProps {
    onAction: () => void
    actionLabel?: string
}

export function ClosingCTA({ onAction, actionLabel = CLOSING_COPY.action }: ClosingCTAProps) {
    return (
        <section className="relative w-full overflow-hidden px-5 py-20 text-center sm:px-8 sm:py-[104px]">
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[760px] max-w-full -translate-x-1/2 -translate-y-1/2"
                style={{
                    background:
                        'radial-gradient(circle, rgba(232,162,74,.18), rgba(143,111,227,.10) 45%, transparent 68%)',
                }}
            />
            <div className="relative mx-auto max-w-[680px]">
                <span className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ember-500/15 text-ember-400">
                    <Icon icon={Flame} size={28} />
                </span>
                <h2 className="mb-[18px] font-display text-[clamp(40px,5.5vw,68px)] font-semibold leading-[1.02] text-parchment-50">
                    {CLOSING_COPY.title}
                </h2>
                <p className="mb-8 font-narrative text-[19px] leading-[1.5] text-parchment-200">
                    {CLOSING_COPY.subtitle}
                </p>
                <div className="flex flex-wrap justify-center gap-3.5">
                    <Button
                        kind="primary"
                        size="lg"
                        iconLeft={<Icon icon={Feather} size={19} />}
                        onClick={onAction}
                    >
                        {actionLabel}
                    </Button>
                </div>
                <p className="mt-[18px] font-ui text-[13px] text-parchment-500">
                    Free &amp; open source ·{' '}
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-parchment-400 underline-offset-2 transition-colors hover:text-ember-400 hover:underline"
                    >
                        view it on GitHub
                    </a>
                </p>
            </div>
        </section>
    )
}
