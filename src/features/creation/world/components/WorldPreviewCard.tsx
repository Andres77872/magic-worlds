/**
 * WorldPreviewCard — live preview of the world card being created.
 * Thin wrapper over the shared EntityPreviewCard.
 */

import { useTranslation } from 'react-i18next'
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
    const { t } = useTranslation()
    return (
        <EntityPreviewCard
            name={name}
            unnamedLabel={t('creation.world.preview.unnamed')}
            badge={placeType}
            secondaryBadge={type}
            badgePlaceholder={t('creation.world.preview.badgePlaceholder')}
            description={description}
            triggers={triggers}
            attributes={attributes}
            categories={categories}
            imageUrl={imageUrl}
        />
    )
}
