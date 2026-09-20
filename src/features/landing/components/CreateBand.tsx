/**
 * CreateBand — the dashboard's fast creation-access band, sitting right under
 * the resume carousel. An open section holding
 * six compact creation actions — character, world, item, adventure,
 * novel, lorebook — each an IconTile over a title + one-breath hook. The guest
 * front door uses the larger AccessMenu variant of the same actions.
 */

import { useTranslation } from 'react-i18next'
import { Eyebrow, IconTile, cx } from '@/ui/primitives'
import { CREATE_ACTIONS, isCreateActionEnabled, type CreateAction } from './landingContent'

export interface CreateBandProps {
    onAction: (key: CreateAction['key']) => void
}

export function CreateBand({ onAction }: CreateBandProps) {
    const { t } = useTranslation()
    return (
        <section data-testid="create-band" className="border-t border-line-faint pt-6">
            <div className="flex flex-col gap-1.5">
                <Eyebrow tone="ember">{t('landing.create.eyebrow')}</Eyebrow>
                <h2 className="m-0 font-display text-h3 font-semibold text-parchment-50">{t('landing.create.title')}</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {CREATE_ACTIONS.filter(isCreateActionEnabled).map((action) => (
                    <button
                        key={action.key}
                        type="button"
                        onClick={() => onAction(action.key)}
                        className={cx(
                            'group flex min-w-0 cursor-pointer flex-col items-start gap-3 rounded-lg p-3',
                            'text-left transition-colors hover:bg-surface-raised',
                            action.tone === 'arcane'
                                ? 'hover:text-arcane-300'
                                : 'hover:text-ember-300',
                        )}
                    >
                        <IconTile icon={action.icon} tone={action.tone} size="sm" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="font-ui text-sm font-semibold text-parchment-50">{t(action.titleKey)}</span>
                            <span className="font-ui text-caption leading-snug text-parchment-400">{t(action.shortDescKey)}</span>
                        </span>
                    </button>
                ))}
            </div>
        </section>
    )
}
