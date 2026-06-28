/**
 * Persists the user's chosen gallery view mode (large grid / compact grid /
 * list) in localStorage so the choice sticks across pages and sessions. One
 * shared key for every gallery surface — a user who prefers lists gets lists
 * everywhere. Mirrors the safe try/catch storage style of `cookieConsent.ts`.
 */
import { useCallback, useState } from 'react'
import { DEFAULT_GALLERY_VIEW, isGalleryView, type GalleryView } from '../galleryView'

export const GALLERY_VIEW_KEY = 'magic_worlds:gallery-view:v1'

function readGalleryView(): GalleryView {
    if (typeof localStorage === 'undefined') return DEFAULT_GALLERY_VIEW
    try {
        const raw = localStorage.getItem(GALLERY_VIEW_KEY)
        return isGalleryView(raw) ? raw : DEFAULT_GALLERY_VIEW
    } catch {
        return DEFAULT_GALLERY_VIEW
    }
}

function writeGalleryView(view: GalleryView): void {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(GALLERY_VIEW_KEY, view)
    } catch {
        // localStorage can be unavailable in private browsing or locked-down embeds.
    }
}

export function useGalleryView(): [GalleryView, (view: GalleryView) => void] {
    const [view, setView] = useState<GalleryView>(readGalleryView)
    const update = useCallback((next: GalleryView) => {
        setView(next)
        writeGalleryView(next)
    }, [])
    return [view, update]
}
