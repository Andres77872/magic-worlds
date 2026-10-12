/**
 * Workspace R1 creation origin (document 08, "Creation from the unified library").
 *
 * The Library New menu captures where a new card will be saved before it opens
 * an existing creator: the workspace, the optional collection the user was in,
 * and the library location to return to. Creators read it to show
 * "Will be saved in Workspace / Collection" and to save through
 * `apiService.withWorkspace(origin.workspaceId, { initialCollectionIds })`.
 * A delayed result keeps this origin even if the user switches workspace.
 *
 *     const { origin } = useCreationOrigin()
 *     const client = origin && apiService.withWorkspace(origin.workspaceId, {
 *         initialCollectionIds: origin.collectionId ? [origin.collectionId] : [],
 *     })
 *
 * Without a captured origin (a legacy creator link, a type gallery) the
 * destination is the selected workspace root.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useWorkspace } from '@/app/hooks/useWorkspace'

export type LibraryTypeFilter = 'all' | 'character' | 'persona' | 'world' | 'item' | 'adventure'

/** Where Back to Library returns: root or folder, query, filters and a scroll hint. */
export interface LibraryLocation {
    collectionId: string | null
    query: string
    typeFilter: LibraryTypeFilter
    uncollected: boolean
    scrollY: number | null
}

export interface CreationOrigin {
    workspaceId: string
    /** Root creation has none; a folder preselects itself as the initial collection. */
    collectionId: string | null
    returnTo: LibraryLocation | null
}

/** A saved card the Library should reveal/highlight after returning. */
export interface CreatedCardRef {
    cardType: 'character' | 'world' | 'item' | 'adventure_template'
    cardId: string
}

/**
 * Registered by the Library feature. Returns true when it navigated back to
 * `origin.returnTo` (and will highlight `created`); false leaves the creator's
 * existing post-save behavior in charge.
 */
export type ReturnToLibraryHandler = (origin: CreationOrigin, created: CreatedCardRef | null) => boolean

interface CreationOriginContextValue {
    captured: CreationOrigin | null
    capture: (origin: CreationOrigin) => void
    clear: () => void
    registerReturnHandler: (handler: ReturnToLibraryHandler) => () => void
    returnToLibrary: (created: CreatedCardRef | null) => boolean
}

const CreationOriginContext = createContext<CreationOriginContextValue | null>(null)

export function CreationOriginProvider({ children }: { children: ReactNode }) {
    const [captured, setCaptured] = useState<CreationOrigin | null>(null)
    const [handler, setHandler] = useState<{ current: ReturnToLibraryHandler } | null>(null)
    const capture = useCallback((origin: CreationOrigin) => setCaptured({ ...origin }), [])
    const clear = useCallback(() => setCaptured(null), [])
    const registerReturnHandler = useCallback((next: ReturnToLibraryHandler) => {
        const entry = { current: next }
        setHandler(entry)
        return () => setHandler((current) => (current === entry ? null : current))
    }, [])
    const returnToLibrary = useCallback((created: CreatedCardRef | null) => {
        if (!captured?.returnTo || !handler) return false
        const handled = handler.current(captured, created)
        if (handled) setCaptured(null)
        return handled
    }, [captured, handler])
    const value = useMemo(() => ({ captured, capture, clear, registerReturnHandler, returnToLibrary }),
        [captured, capture, clear, registerReturnHandler, returnToLibrary])
    return <CreationOriginContext.Provider value={value}>{children}</CreationOriginContext.Provider>
}

export interface CreationOriginState {
    /** The captured origin, else the selected workspace root; null before the handshake. */
    origin: CreationOrigin | null
    /** True when the Library captured this origin (vs. the selected-workspace fallback). */
    isCaptured: boolean
    capture: (origin: CreationOrigin) => void
    clear: () => void
    /** Library-only: install the Back to Library navigation. */
    registerReturnHandler: (handler: ReturnToLibraryHandler) => () => void
    /** After a successful manual save: go back to the captured location; false = not handled. */
    returnToLibrary: (created: CreatedCardRef | null) => boolean
}

const NOOP = () => {}
const NOOP_REGISTER = () => NOOP
const NOT_HANDLED = () => false

export function useCreationOrigin(): CreationOriginState {
    const context = useContext(CreationOriginContext)
    const { selectedWorkspaceId } = useWorkspace()
    const captured = context?.captured ?? null
    const origin = useMemo<CreationOrigin | null>(() => {
        if (captured) return captured
        return selectedWorkspaceId ? { workspaceId: selectedWorkspaceId, collectionId: null, returnTo: null } : null
    }, [captured, selectedWorkspaceId])
    return {
        origin,
        isCaptured: captured !== null,
        capture: context?.capture ?? NOOP,
        clear: context?.clear ?? NOOP,
        registerReturnHandler: context?.registerReturnHandler ?? NOOP_REGISTER,
        returnToLibrary: context?.returnToLibrary ?? NOT_HANDLED,
    }
}

/** Initial memberships for a save from this origin (`X-Initial-Collection-Ids`). */
export function initialCollectionIds(origin: CreationOrigin | null): readonly string[] {
    return origin?.collectionId ? [origin.collectionId] : []
}
