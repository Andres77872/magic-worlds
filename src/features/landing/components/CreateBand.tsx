/**
 * CreateBand — the dashboard's terminal "workbench" panel. A raised surface
 * with an ember hairline shimmer on top and IconTile row tiles, visibly a
 * place to make things rather than another content shelf. Replaces the old
 * compact AccessMenu button row (the guest page keeps its full variant).
 */

import { Eyebrow, IconTile, cx } from '@/ui/primitives'
import { CREATE_ACTIONS, type CreateAction } from './landingContent'

export interface CreateBandProps {
    onAction: (key: CreateAction['key']) => void
}

export function CreateBand({ onAction }: CreateBandProps) {
    return (
        <section data-testid="create-band">
            <div className="relative overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 p-6 shadow-sm sm:p-7">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember-500/40 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-parchment-50/[.025] to-transparent" />
                <div className="relative flex flex-col gap-1.5">
                    <Eyebrow tone="ember">Step behind the curtain</Eyebrow>
                    <h2 className="m-0 font-display text-h3 font-semibold text-parchment-50">Make something new</h2>
                </div>
                <div className="relative mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {CREATE_ACTIONS.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() => onAction(action.key)}
                            className={cx(
                                'group flex cursor-pointer items-center gap-3 rounded-lg border border-parchment-50/[.08] bg-ink-700 p-3.5',
                                'text-left transition-all hover:-translate-y-[2px]',
                                action.tone === 'arcane'
                                    ? 'hover:border-arcane-500/45 hover:shadow-glow-arcane'
                                    : 'hover:border-ember-500/45 hover:shadow-card-hover',
                            )}
                        >
                            <IconTile icon={action.icon} tone={action.tone} size="sm" glow />
                            <span className="flex min-w-0 flex-col">
                                <span className="font-ui text-[14px] font-semibold text-parchment-50">{action.title}</span>
                                <span className="truncate font-ui text-[12px] text-parchment-400">{action.shortDesc}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    )
}
