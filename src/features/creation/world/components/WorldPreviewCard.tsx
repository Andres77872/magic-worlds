/**
 * WorldPreviewCard — live preview of the world card being created.
 * Thin wrapper over the shared EntityPreviewCard.
 */

import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { EntityPreviewCard } from '../../common/components'
import type { AttrMap } from '../../common/hooks'

export interface WorldPreviewCardProps {
    name: string
    type: string
    description?: string
    triggers: string[]
    attributes: AttrMap
    categories: AttributeCategory[]
    imageUrl?: string
}

export function WorldPreviewCard({ name, type, description, triggers, attributes, categories, imageUrl }: WorldPreviewCardProps) {
    return (
        <EntityPreviewCard
            name={name}
            unnamedLabel="Unnamed World"
            badge={type}
            badgePlaceholder="Add a type…"
            description={description}
            triggers={triggers}
            attributes={attributes}
            categories={categories}
            imageUrl={imageUrl}
        />
    )
}
