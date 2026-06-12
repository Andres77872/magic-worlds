/**
 * TemplateGallery — the create-mode intro step: a serif heading over a grid of
 * starting shapes plus the dashed "Empty card" tile, with a quiet skip link
 * that continues with the standard field set.
 */
import type { CardFieldDefinition, CardTemplate } from '../engine'
import { TemplateCard, EmptyCardTile } from './TemplateCard'

export interface TemplateGalleryProps {
    templates: CardTemplate[]
    fields: CardFieldDefinition[]
    /** Lower-case noun for copy: 'character', 'world', 'adventure', 'item'. */
    noun: string
    heading: string
    subheading: string
    /** A template, or null for the empty card. */
    onPick: (template: CardTemplate | null) => void
    /** Continue with the standard (default-active) field set. */
    onSkip: () => void
}

export function TemplateGallery({ templates, fields, noun, heading, subheading, onPick, onSkip }: TemplateGalleryProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="text-center">
                <h2 className="font-display text-h3 font-semibold text-parchment-50">{heading}</h2>
                <p className="mx-auto mt-1.5 max-w-xl font-narrative text-[15px] italic leading-snug text-parchment-300">
                    {subheading}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        fields={fields}
                        onPick={() => onPick(template)}
                    />
                ))}
                <EmptyCardTile noun={noun} onPick={() => onPick(null)} />
            </div>
            <div className="text-center">
                <button
                    type="button"
                    onClick={onSkip}
                    className="font-ui text-[13px] font-medium text-parchment-300 underline-offset-4 transition-colors hover:text-parchment-50 hover:underline"
                >
                    Skip — start with the standard fields
                </button>
            </div>
        </div>
    )
}
