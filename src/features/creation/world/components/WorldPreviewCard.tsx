/**
 * WorldPreviewCard — live preview of the world card being created.
 * Thin wrapper over the shared EntityPreviewCard.
 */

import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { EntityPreviewCard } from '../../common/components'
import type { AttrMap } from '../../common/hooks'

export interface WorldPreviewCardProps {
    name: string
    placeType: string
    type: string
    description?: string
    triggers: string[]
    attributes: AttrMap
    categories: AttributeCategory[]
    imageUrl?: string
}

export function WorldPreviewCard({ name, placeType, type, description, triggers, attributes, categories, imageUrl }: WorldPreviewCardProps) {
    return (
        <EntityPreviewCard
            name={name}
            unnamedLabel="Unnamed World"
            badge={placeType}
            secondaryBadge={type}
            badgePlaceholder="Choose a place type…"
            description={description}
            triggers={triggers}
            attributes={attributes}
            categories={categories}
            imageUrl={imageUrl}
        />
    )
}
