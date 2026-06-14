/**
 * CreateBand — the dashboard's fast creation-access band, sitting right under
 * the resume carousel. A raised surface (ember hairline shimmer on top) holding
 * six vertical "make one of these" tiles — character, world, item, adventure,
 * novel, lorebook — each an IconTile over a title + one-breath hook. The guest
 * front door uses the larger AccessMenu variant of the same actions.
 */

import { useTranslation } from 'react-i18next'
import { Eyebrow, IconTile, cx } from '@/ui/primitives'
import { CREATE_ACTIONS, type CreateAction } from './landingContent'

export interface CreateBandProps {
    onAction: (key: CreateAction['key']) => void
}

export function CreateBand({ onAction }: CreateBandProps) {
    const { t } = useTranslation()
    return (
        <section data-testid="create-band">
            <div className="relative overflow-hidden rounded-xl border border-parchment-50/10 bg-ink-800 p-6 shadow-sm sm:p-7">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ember-500/40 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-parchment-50/[.025] to-transparent" />
                <div className="relative flex flex-col gap-1.5">
                    <Eyebrow tone="ember">{t('landing.create.eyebrow')}</Eyebrow>
                    <h2 className="m-0 font-display text-h3 font-semibold text-parchment-50">{t('landing.create.title')}</h2>
                </div>
                <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {CREATE_ACTIONS.map((action) => (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() => onAction(action.key)}
                            className={cx(
                                'group flex cursor-pointer flex-col items-start gap-2.5 rounded-lg border border-parchment-50/[.08] bg-ink-700 p-4',
                                'text-left transition-all hover:-translate-y-[2px]',
                                action.tone === 'arcane'
                                    ? 'hover:border-arcane-500/45 hover:shadow-glow-arcane'
                                    : 'hover:border-ember-500/45 hover:shadow-card-hover',
                            )}
                        >
                            <IconTile icon={action.icon} tone={action.tone} size="md" glow />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="font-ui text-[14px] font-semibold text-parchment-50">{t(action.titleKey)}</span>
                                <span className="font-ui text-[12px] leading-snug text-parchment-400">{t(action.shortDescKey)}</span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    )
}
