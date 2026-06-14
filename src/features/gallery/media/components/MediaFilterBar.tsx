/**
 * MediaFilterBar — the media gallery's filter row: media-type chips
 * (All / Images / Themes), card-type chips (All types / Characters / Worlds /
 * Adventures), and the specific-card picker. Selecting a card narrows the type
 * scope to the card's own; switching type clears the picked card (enforced by
 * useMediaGallery — this bar is purely presentational).
 */

import { Gem, Globe, Image as ImageIcon, Music2, Swords, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Chip, Icon } from '@/ui/primitives'
import type { CardRef, CardTypeFilter, MediaGalleryFilters, MediaTypeFilter } from '../mediaGalleryTypes'
import { CardPicker } from './CardPicker'

export interface MediaFilterBarProps {
    filters: MediaGalleryFilters
    onMediaType: (t: MediaTypeFilter) => void
    onCardType: (t: CardTypeFilter) => void
    onCard: (c: CardRef | undefined) => void
}

const MEDIA_CHIPS: Array<{ key: MediaTypeFilter; icon?: typeof ImageIcon }> = [
    { key: 'all' },
    { key: 'images', icon: ImageIcon },
    { key: 'themes', icon: Music2 },
]

const CARD_TYPE_CHIPS: Array<{ key: CardTypeFilter; icon?: typeof Users }> = [
    { key: 'all' },
    { key: 'character', icon: Users },
    { key: 'world', icon: Globe },
    { key: 'item', icon: Gem },
    { key: 'adventure_template', icon: Swords },
]

export function MediaFilterBar({ filters, onMediaType, onCardType, onCard }: MediaFilterBarProps) {
    const { t } = useTranslation()
    const showLegacyHint = filters.mediaType !== 'themes' && (filters.cardType !== 'all' || Boolean(filters.card))

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <div role="group" aria-label={t('mediaGallery.filters.mediaType')} className="flex items-center gap-2">
                    {MEDIA_CHIPS.map((chip) => (
                        <Chip
                            key={chip.key}
                            active={filters.mediaType === chip.key}
                            icon={chip.icon ? <Icon icon={chip.icon} size={13} /> : undefined}
                            onClick={() => onMediaType(chip.key)}
                            data-testid={`media-filter-${chip.key}`}
                        >
                            {t(`mediaGallery.filters.media.${chip.key}`)}
                        </Chip>
                    ))}
                </div>

                <span className="mx-1 hidden h-5 w-px bg-parchment-50/10 sm:block" aria-hidden="true" />

                <div role="group" aria-label={t('mediaGallery.filters.cardType')} className="flex flex-wrap items-center gap-2">
                    {CARD_TYPE_CHIPS.map((chip) => (
                        <Chip
                            key={chip.key}
                            active={filters.cardType === chip.key}
                            icon={chip.icon ? <Icon icon={chip.icon} size={13} /> : undefined}
                            onClick={() => onCardType(chip.key)}
                            data-testid={`card-type-filter-${chip.key}`}
                        >
                            {t(`mediaGallery.filters.card.${chip.key}`)}
                        </Chip>
                    ))}
                </div>

                <div className="ml-auto">
                    <CardPicker cardType={filters.cardType} value={filters.card} onChange={onCard} />
                </div>
            </div>

            {showLegacyHint && (
                <p className="font-narrative text-xs text-parchment-500">
                    {t('mediaGallery.filters.legacyHint')}
                </p>
            )}
        </div>
    )
}
