/**
 * Access menu — the prominent in-page way to start creating on the guest /
 * empty-account front door: a row of large IconTile cards. (Returning users
 * get the CreateBand workbench instead.) All actions route through the
 * caller's gated handler.
 */

import type { KeyboardEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, Eyebrow, Icon, IconTile } from '@/ui/primitives'
import { CREATE_ACTIONS, type CreateAction } from './landingContent'

export interface AccessMenuProps {
    /** Eyebrow + title (varies by guest vs empty-account). */
    eyebrow?: string
    title?: string
    onAction: (key: CreateAction['key']) => void
}

function activateOnKey(handler: () => void) {
    return (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handler()
        }
    }
}

export function AccessMenu({
    eyebrow,
    title,
    onAction,
}: AccessMenuProps) {
    const { t } = useTranslation()
    return (
        <section className="w-full px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-12">
            <div className="mx-auto max-w-[1160px]">
                <div className="flex flex-col gap-2">
                    <Eyebrow tone="ember">{eyebrow ?? t('landing.access.defaultEyebrow')}</Eyebrow>
                    <h2 className="font-display text-h3 font-semibold text-parchment-50">{title ?? t('landing.access.defaultTitle')}</h2>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {CREATE_ACTIONS.map((action) => (
                        <Card
                            key={action.key}
                            interactive
                            role="button"
                            tabIndex={0}
                            aria-label={t(action.titleKey)}
                            onClick={() => onAction(action.key)}
                            onKeyDown={activateOnKey(() => onAction(action.key))}
                            className="group p-7"
                        >
                            <IconTile icon={action.icon} tone={action.tone} glow className="mb-5" />
                            <h3 className="font-ui text-[19px] font-semibold tracking-[-0.01em] text-parchment-50">
                                {t(action.titleKey)}
                            </h3>
                            <p className="mt-2 font-narrative text-[15.5px] leading-[1.55] text-parchment-400">
                                {t(action.descKey)}
                            </p>
                            <span className="mt-4 inline-flex items-center gap-1.5 font-ui text-sm font-semibold text-ember-400">
                                {t('landing.access.begin')}
                                <Icon
                                    icon={ArrowRight}
                                    size={15}
                                    className="transition-transform group-hover:translate-x-0.5"
                                />
                            </span>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    )
}
