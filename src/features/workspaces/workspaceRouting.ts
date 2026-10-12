/**
 * Workspace R1 routing helpers (document 08 "Selected URL and browser-history
 * algorithm"): the namespaced history-state stamp, the legacy type-gallery to
 * Library mapping, and where a workspace switch lands.
 *
 * Pure functions only; the coordinator itself lives in NavigationProvider.
 */
import type { PageType } from '@/shared'
import type { Workspace, WorkspaceCardType, WorkspacePreferredUse } from '@/shared/types'
import { isPageFeatureEnabled, isWorkspacesFeatureEnabled } from '@/shared/featureFlags'
import { PAGE_ACCESS } from '@/app/router/pageAccess'
import { legacyGalleryTarget, pageHash, readHashWorkspace, withHashWorkspace } from '@/features/gallery/galleryLinks'
import type { GalleryType } from '@/features/gallery/galleryConfig'
import { buildLibraryHash } from '@/features/library/libraryUrl'
import type { LibraryTypeFilter } from '@/features/library/creationOrigin'

/** The history-state key this app owns; other fields of `history.state` are preserved. */
export const NAV_STATE_KEY = 'magicWorldsNavigation'

/** One owned history entry: a stable ID, its monotonic index, its workspace and canonical hash. */
export interface NavigationStamp {
    id: string
    index: number
    workspaceId: string | null
    hash: string
}

export function readNavigationStamp(state: unknown): NavigationStamp | null {
    if (!state || typeof state !== 'object') return null
    const raw = (state as Record<string, unknown>)[NAV_STATE_KEY]
    if (!raw || typeof raw !== 'object') return null
    const { id, index, workspaceId, hash } = raw as Record<string, unknown>
    if (typeof id !== 'string' || typeof hash !== 'string' || typeof index !== 'number' || !Number.isInteger(index)) return null
    return { id, index, workspaceId: typeof workspaceId === 'string' ? workspaceId : null, hash }
}

/** The state to write: `preserve` keeps the entry's unrelated fields (replace); a push starts clean. */
export function stampedHistoryState(previous: unknown, stamp: NavigationStamp, preserve: boolean): Record<string, unknown> {
    const base = preserve && previous && typeof previous === 'object' && !Array.isArray(previous)
        ? { ...(previous as Record<string, unknown>) }
        : {}
    base[NAV_STATE_KEY] = { ...stamp }
    return base
}

/** Whether the page shows workspace content (and so carries `workspace=` in its hash). */
export function isWorkspaceContentPage(page: PageType): boolean {
    return PAGE_ACCESS[page] === 'private'
}

/** The hash with the workspace stamped when the R1 UI is on and the page holds content. */
export function stampWorkspaceHash(page: PageType, hash: string, workspaceId: string | null): string {
    if (!workspaceId || !isWorkspacesFeatureEnabled() || !isWorkspaceContentPage(page)) return hash
    return readHashWorkspace(hash) ? hash : withHashWorkspace(hash, workspaceId)
}

const GALLERY_TYPE_FILTER: Record<GalleryType, LibraryTypeFilter> = {
    character: 'character',
    persona: 'persona',
    world: 'world',
    item: 'item',
    adventure: 'adventure',
}

const GALLERY_CARD_TYPE: Record<GalleryType, WorkspaceCardType> = {
    character: 'character',
    persona: 'character',
    world: 'world',
    item: 'item',
    adventure: 'adventure_template',
}

/**
 * With the R1 UI on, an owned type-gallery hash opens the Library with that
 * type filter (and reveals a linked card); public and group-chat views stay
 * galleries. Returns the route unchanged otherwise.
 */
export function normalizeRoute(page: PageType, hash: string): { page: PageType; hash: string } {
    if (!isWorkspacesFeatureEnabled()) return { page, hash }
    if (page !== 'gallery-characters' && page !== 'gallery-personas' && page !== 'gallery-worlds'
        && page !== 'gallery-items' && page !== 'gallery-adventures') return { page, hash }
    const legacy = legacyGalleryTarget(hash || pageHash(page))
    if (!legacy) return { page, hash }
    return {
        page: 'library',
        hash: buildLibraryHash({
            workspaceId: readHashWorkspace(hash),
            typeFilter: GALLERY_TYPE_FILTER[legacy.typeFilter],
            reveal: legacy.cardId ? { cardType: GALLERY_CARD_TYPE[legacy.typeFilter], cardId: legacy.cardId } : null,
        }),
    }
}

const PREFERRED_LANDING: Record<WorkspacePreferredUse, PageType> = {
    library: 'library',
    writing: 'gallery-stories',
    roleplay: 'active-adventures',
    sandbox: 'library',
}

/** Preferred use only picks the first page of a workspace; it never restricts features. */
export function preferredLandingPage(workspace: Pick<Workspace, 'preferred_use'>): PageType {
    const page = PREFERRED_LANDING[workspace.preferred_use] ?? 'library'
    return isPageFeatureEnabled(page) ? page : 'library'
}

/** Browsing pages that exist in every workspace: a switch keeps the user on them. */
const WORKSPACE_LIST_PAGES: ReadonlySet<PageType> = new Set<PageType>([
    'library',
    'gallery-lorebooks',
    'gallery-resources',
    'gallery-media',
    'gallery-stories',
    'active-adventures',
    'chatroom',
    'calls',
])

/**
 * Where the switcher lands in `workspace`: `null` keeps the current account,
 * public or home page; workspace browsing pages reopen at their root in the
 * destination; record pages (editors, sessions, chats) go to the destination's
 * preferred landing page, since the record belongs to the source workspace.
 */
export function switchDestination(currentPage: PageType, workspace: Workspace): { page: PageType; hash: string } | null {
    if (!isWorkspaceContentPage(currentPage)) return null
    const page = WORKSPACE_LIST_PAGES.has(currentPage) ? currentPage : preferredLandingPage(workspace)
    return { page, hash: withHashWorkspace(pageHash(page), workspace.id) }
}
