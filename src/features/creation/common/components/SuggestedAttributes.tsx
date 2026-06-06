/**
 * SuggestedAttributes — one-click preset prop chips.
 *
 * Each chip appends a prefilled row (key only; value left for the user) to a
 * target attribute category, making common props instant to add. A chip whose
 * key already exists is shown as done (disabled). Feeds the existing attribute
 * engine only — it never changes the API payload shape.
 */

import { Check, Plus } from 'lucide-react'
import { Chip, Icon } from '@/ui/primitives'

export interface AttributePreset {
    key: string
    value?: string
}

export interface SuggestedAttributesProps {
    presets: AttributePreset[]
    /** Lower-cased keys already present in the target category. */
    existingKeys: string[]
    onAdd: (preset: AttributePreset) => void
}

export function SuggestedAttributes({ presets, existingKeys, onAdd }: SuggestedAttributesProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {presets.map((preset) => {
                const used = existingKeys.includes(preset.key.toLowerCase())
                return (
                    <Chip
                        key={preset.key}
                        active={used}
                        disabled={used}
                        onClick={() => !used && onAdd(preset)}
                        icon={<Icon icon={used ? Check : Plus} size={13} />}
                        title={used ? `${preset.key} added` : `Add ${preset.key}`}
                    >
                        {preset.key}
                    </Chip>
                )
            })}
        </div>
    )
}
