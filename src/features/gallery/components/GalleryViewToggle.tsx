/**
 * GalleryViewToggle — the segmented control that switches a gallery between the
 * large grid, compact grid, and list views. Thin wrapper over the
 * `SegmentedControl` primitive that maps `GALLERY_VIEW_OPTIONS` to localized,
 * icon-bearing segments so every gallery page renders the same control.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon, SegmentedControl } from '@/ui/primitives'
import { GALLERY_VIEW_OPTIONS, type GalleryView } from '../galleryView'

interface GalleryViewToggleProps {
    value: GalleryView
    onChange: (view: GalleryView) => void
    className?: string
}

export function GalleryViewToggle({ value, onChange, className }: GalleryViewToggleProps) {
    const { t } = useTranslation()
    const options = useMemo(
        () =>
            GALLERY_VIEW_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
                icon: <Icon icon={option.icon} size={16} />,
            })),
        [t],
    )
    return (
        <SegmentedControl
            aria-label={t('gallery.view.label')}
            options={options}
            value={value}
            onChange={onChange}
            className={className}
            data-testid="gallery-view-toggle"
        />
    )
}
