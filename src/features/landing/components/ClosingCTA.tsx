/**
 * Closing call-to-action — a centered, candlelit send-off. One soft ember→arcane
 * glow, the brand flame, a big invitation, and a single action. Honest footer
 * line links the open-source repo (no pricing / age gates).
 */

import { Feather, Flame } from 'lucide-react'
import { Button, GlowBackdrop, Icon, IconTile } from '@/ui/primitives'
import { CLOSING_COPY, GITHUB_URL } from './landingContent'

export interface ClosingCTAProps {
    onAction: () => void
    actionLabel?: string
}

export function ClosingCTA({ onAction, actionLabel = CLOSING_COPY.action }: ClosingCTAProps) {
    return (
        <section className="relative w-full px-5 py-20 text-center sm:px-8 sm:py-24">
            <GlowBackdrop variant="center" />
            <div className="relative mx-auto max-w-[680px]">
                <IconTile icon={Flame} tone="ember" size="lg" className="mb-6" />
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
