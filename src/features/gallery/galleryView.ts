/**
 * Gallery view modes — the single source of truth for how the user-facing
 * "view type" maps onto the layout primitives. A gallery offers three views:
 *
 *   - `grid`         — large, comfortable-density card grid (the default).
 *   - `grid-compact` — same grid, smaller cards (denser scan).
 *   - `list`         — a vertical stack of rich rows.
 *
 * These map onto the existing `CardGrid` `layout`/`density` props and the
 * `GalleryCard`/`LorebookCard` `view` prop so the mapping lives in exactly one
 * place and every gallery page stays consistent.
 */
import type { LucideIcon } from 'lucide-react'
import { Grid3x3, LayoutGrid, List } from 'lucide-react'

export type GalleryView = 'grid' | 'grid-compact' | 'list'

export interface GalleryViewOption {
    value: GalleryView
    /** i18n key for the control's label / tooltip. */
    labelKey: string
    icon: LucideIcon
}

/** Display order of the segmented control: largest → densest → list. */
export const GALLERY_VIEW_OPTIONS: readonly GalleryViewOption[] = [
    { value: 'grid', labelKey: 'gallery.view.largeGrid', icon: LayoutGrid },
    { value: 'grid-compact', labelKey: 'gallery.view.compactGrid', icon: Grid3x3 },
    { value: 'list', labelKey: 'gallery.view.list', icon: List },
]

export const DEFAULT_GALLERY_VIEW: GalleryView = 'grid'

export function isGalleryView(value: unknown): value is GalleryView {
    return value === 'grid' || value === 'grid-compact' || value === 'list'
}

/** `CardGrid.layout` for a view. */
export function cardGridLayout(view: GalleryView): 'grid' | 'list' {
    return view === 'list' ? 'list' : 'grid'
}

/** `CardGrid.density` for a view (irrelevant in list mode — returns the default). */
export function cardGridDensity(view: GalleryView): 'comfortable' | 'compact' {
    return view === 'grid-compact' ? 'compact' : 'comfortable'
}

/** `GalleryCard`/`LorebookCard` `view` for a gallery view. */
export function galleryCardView(view: GalleryView): 'card' | 'row' {
    return view === 'list' ? 'row' : 'card'
}
