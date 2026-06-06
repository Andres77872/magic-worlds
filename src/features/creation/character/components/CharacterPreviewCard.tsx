/**
 * CharacterPreviewCard — live preview of the character card being created.
 * Thin wrapper over the shared EntityPreviewCard.
 */

import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { EntityPreviewCard } from '../../common/components'
import type { AttrMap } from '../../common/hooks'

export interface CharacterPreviewCardProps {
    name: string
    race: string
    description?: string
    triggers: string[]
    attributes: AttrMap
    categories: AttributeCategory[]
}

export function CharacterPreviewCard({ name, race, description, triggers, attributes, categories }: CharacterPreviewCardProps) {
    return (
        <EntityPreviewCard
            name={name}
            unnamedLabel="Unnamed Character"
            badge={race}
            badgePlaceholder="Add a race…"
            description={description}
            triggers={triggers}
            attributes={attributes}
            categories={categories}
        />
    )
}
