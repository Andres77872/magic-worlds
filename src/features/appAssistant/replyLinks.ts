/**
 * Where a link in an assistant reply opens. Library records (cards, lorebooks)
 * preview over the thread; every other working link (an app page, a novel, a
 * resource, the web) opens in a new tab so the conversation stays where it is.
 * A hash no route knows stays in place, where the page explains it is missing.
 */
import { pageFromHash } from '@/features/gallery/galleryLinks'
import { parseHoverCardHref } from './hoverCards/hoverCardModel'
import { isAppLinkFeatureEnabled } from '@/app/router/linkAvailability'

export { isAppLinkFeatureEnabled as isAssistantLinkFeatureEnabled } from '@/app/router/linkAvailability'

const WEB_LINK = /^https?:\/\//i

export function replyLinkOpensInNewTab(href: string | null | undefined): boolean {
    if (!href) return false
    if (!isAppLinkFeatureEnabled(href)) return false
    if (WEB_LINK.test(href)) return true
    if (!href.startsWith('#/') || parseHoverCardHref(href)) return false
    return pageFromHash(href) !== null
}
