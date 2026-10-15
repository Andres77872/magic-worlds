import { pageFromHash, parseGalleryHash } from '@/features/gallery/galleryLinks'
import { isPageFeatureEnabled, isCommunityCardsFeatureEnabled, isGroupChatsFeatureEnabled } from '@/shared/featureFlags'

/** History keeps its prose; disabled destinations have no navigation or preview action. */
export function isAppLinkFeatureEnabled(href: string | null | undefined): boolean {
    if (!href) return true
    let hash = href
    if (!href.startsWith('#/')) {
        if (typeof window === 'undefined') return true
        try {
            const url = new URL(href, window.location.href)
            if (url.origin !== window.location.origin) return true
            hash = url.hash
        } catch { return true }
    }
    const gallery = parseGalleryHash(hash)
    if (gallery?.view === 'public' && !isCommunityCardsFeatureEnabled()) return false
    if (gallery?.mode === 'group-chat' && !isGroupChatsFeatureEnabled()) return false
    const page = pageFromHash(hash)
    return !page || isPageFeatureEnabled(page)
}
