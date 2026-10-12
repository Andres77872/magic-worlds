/**
 * What the Library restores after a creator returns to it (document 08
 * "Creation from the unified library"): the saved card to highlight (none on
 * Back) and the captured scroll hint. The always-mounted navigation bridge
 * records it while the creator is still open; the Library takes it once.
 */
import type { CreatedCardRef } from './creationOrigin'

export interface LibraryReturn {
    created: CreatedCardRef | null
    scrollY: number | null
}

let pending: (LibraryReturn & { workspaceId: string }) | null = null

export function rememberLibraryReturn(workspaceId: string, value: LibraryReturn): void {
    pending = { workspaceId, ...value }
}

/** This workspace's pending return, once; null otherwise. */
export function takeLibraryReturn(workspaceId: string): LibraryReturn | null {
    if (!pending || pending.workspaceId !== workspaceId) return null
    const { created, scrollY } = pending
    pending = null
    return { created, scrollY }
}
