/**
 * TemplateCard — one pickable starting shape in the template gallery: icon
 * tile, name, evocative tagline, and a few chips naming the fields it sets up.
 */
import { useTranslation } from 'react-i18next'
import { Feather } from 'lucide-react'
import { IconTile, Tag, cx } from '@/ui/primitives'
import type { CardFieldDefinition, CardTemplate } from '../engine'

export interface TemplateCardProps {
    template: CardTemplate
    /** Field registry — used to surface a few activated-field labels as chips. */
    fields: CardFieldDefinition[]
    onPick: () => void
    tone?: 'ember' | 'arcane'
}

const MAX_FIELD_CHIPS = 4

export function TemplateCard({ template, fields, onPick, tone = 'ember' }: TemplateCardProps) {
    const { t } = useTranslation()
    const fieldLabels = template.fieldIds
        .map((id) => fields.find((f) => f.id === id)?.label)
        .filter((label): label is string => Boolean(label))
    const shown = fieldLabels.slice(0, MAX_FIELD_CHIPS)
    const more = fieldLabels.length - shown.length
    const name = template.nameKey ? t(template.nameKey) : template.name
    const tagline = template.taglineKey ? t(template.taglineKey) : template.tagline

    return (
        <button
            type="button"
            onClick={onPick}
            className={cx(
                'group flex h-full flex-col items-start gap-3 rounded-xl border border-parchment-50/10 bg-ink-700 p-5 text-left',
                'transition-all hover:-translate-y-0.5 hover:border-ember-500/45 hover:shadow-[var(--shadow-glow-ember)]',
            )}
        >
            <IconTile icon={template.icon ?? Feather} tone={tone} size="sm" glow />
            <div className="min-w-0">
                <h3 className="font-display text-[19px] font-semibold leading-tight text-parchment-50">
                    {name}
                </h3>
                <p className="mt-1 font-narrative text-sm italic leading-snug text-parchment-300">
                    {tagline}
                </p>
            </div>
            {shown.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {shown.map((label) => (
                        <Tag key={label}>{label}</Tag>
                    ))}
                    {more > 0 && <Tag>{t('creation.common.templateGallery.moreFields', { count: more })}</Tag>}
                </div>
            )}
        </button>
    )
}

/** The dashed "start from nothing" tile that closes every gallery. */
export function EmptyCardTile({ noun, onPick }: { noun: string; onPick: () => void }) {
    const { t } = useTranslation()
    return (
        <button
            type="button"
            onClick={onPick}
            className={cx(
                'group flex h-full min-h-[150px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-parchment-50/20 bg-transparent p-5 text-center',
                'transition-all hover:border-arcane-500/50 hover:bg-arcane-500/[.04]',
            )}
        >
            <IconTile icon={Feather} tone="arcane" size="sm" glow />
            <div>
                <h3 className="font-display text-[19px] font-semibold leading-tight text-parchment-50">{t('creation.common.templateGallery.emptyCardTitle')}</h3>
                <p className="mt-1 font-narrative text-sm italic leading-snug text-parchment-300">
                    {t('creation.common.templateGallery.emptyCardDescription', { noun })}
                </p>
            </div>
        </button>
    )
}
