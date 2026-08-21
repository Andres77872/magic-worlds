/**
 * ItemPreviewCard — live preview of the item/object card being created.
 */

import { useTranslation } from 'react-i18next'
import type { AttributeCategory } from '@/ui/components/common/AttributeList'
import { EntityPreviewCard } from '../../common/components'
import type { AttrMap } from '../../common/hooks'

export interface ItemPreviewCardProps {
    name: string
    type?: string
    rarity?: string
    description?: string
    triggers: string[]
    attributes: AttrMap
    categories: AttributeCategory[]
    imageUrl?: string
}

export function ItemPreviewCard({ name, type, rarity, description, triggers, attributes, categories, imageUrl }: ItemPreviewCardProps) {
    const { t } = useTranslation()
    return (
        <EntityPreviewCard
            name={name}
            unnamedLabel={t('creation.item.preview.unnamed')}
            badge={type ?? ''}
            secondaryBadge={rarity ?? ''}
            badgePlaceholder={t('creation.item.preview.badgePlaceholder')}
            description={description}
            triggers={triggers}
            attributes={attributes}
            categories={categories}
            imageUrl={imageUrl}
        />
    )
}
