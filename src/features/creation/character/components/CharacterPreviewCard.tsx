/**
 * CharacterPreviewCard — live preview of the character card being created.
 * Thin wrapper over the shared EntityPreviewCard.
 */

import { useTranslation } from 'react-i18next'
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
    imageUrl?: string
}

export function CharacterPreviewCard({ name, race, description, triggers, attributes, categories, imageUrl }: CharacterPreviewCardProps) {
    const { t } = useTranslation()
    return (
        <EntityPreviewCard
            name={name}
            unnamedLabel={t('creation.character.preview.unnamed')}
            badge={race}
            badgePlaceholder={t('creation.character.preview.badgePlaceholder')}
            description={description}
            triggers={triggers}
            attributes={attributes}
            categories={categories}
            imageUrl={imageUrl}
        />
    )
}
