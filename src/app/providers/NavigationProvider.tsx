/**
 * Navigation state management provider, and the Workspace R1 switch
 * coordinator (document 08 "Workspace-switch state machine" and "Selected URL
 * and browser-history algorithm").
 *
 * In-app navigation (`setPage`/`goBack`) consults the registered interceptors
 * synchronously, as before. Everything that may change the workspace — the
 * switcher, origin links, library URLs naming another workspace, browser
 * back/forward and external hash changes — goes through one async
 * coordinator: resolve the owned destination, run the interceptors while the
 * source stays active, end a live voice call, revalidate the destination, then
 * commit the workspace and the route in one React update. A cancelled or
 * failed switch keeps the source workspace and URL; late results of an
 * obsolete request never commit.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PageType, NavigationState } from '../../shared'
import type { Workspace } from '../../shared/types'
import { ApiError, apiService, isWorkspaceApiError } from '../../infrastructure/api'
import { isWorkspacesFeatureEnabled } from '../../shared/featureFlags'
import { endActiveVoiceCall, hasActiveVoiceCall } from '../../features/call/activeVoiceCall'
import {
    legacyContentRef,
    pageFromHash,
    pageHash,
    parseCardEditHash,
    parseResourceEditHash,
    readHashWorkspace,
    withHashWorkspace,
    type CardEditHashTarget,
    type ResourceEditHashTarget,
} from '../../features/gallery/galleryLinks'
import {
    isWorkspaceContentPage,
    normalizeRoute,
    readNavigationStamp,
    stampedHistoryState,
    stampWorkspaceHash,
} from '../../features/workspaces/workspaceRouting'
import { WorkspaceContext, type WorkspaceContextValue } from './workspaceContext'

/**
 * Return `true` to intercept the navigation (it is held for now); the
 * interceptor later calls `proceed` to complete it (e.g. after the user
 * confirms an "unsaved changes" dialog) or `cancel` to drop it, so a waiting
 * workspace switch can settle.
 */
export type NavigationInterceptor = (proceed: () => void, cancel?: () => void) => boolean

interface NavigationContextValue extends NavigationState {
    /** `replace` rewrites the current history entry instead of pushing one. */
    setPage: (page: PageType, opts?: { hash?: string; replace?: boolean }) => void
    goBack: (fallback?: PageType) => void
    /** Parsed card-editor deep-link params (`?card=&version=`) for the current hash, or null. */
    cardEdit: CardEditHashTarget | null
    /** Parsed resource deep-link params (`?resource=&type=`) for the current hash, or null. */
    resourceEdit: ResourceEditHashTarget | null
    /** Rewrite the current page's hash in place (no history push) — e.g. to stamp a card id. */
    replaceHash: (hash: string) => void
    /** The live `window.location.hash`, kept reactive across setPage/goBack/hashchange/popstate. */
    currentHash: string
    /**
     * Register a guard consulted before a navigation commits: `setPage`,
     * `goBack`, browser back/forward and workspace switches. Returns an
     * unregister function. Pair with a `beforeunload` handler for reload/close.
     */
    registerNavigationInterceptor: (interceptor: NavigationInterceptor) => () => void
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined)

export interface NavigateTarget {
    page: PageType
    hash?: string
    /** The destination's workspace; omitted/null means the hash's `workspace=` or the committed one. */
    workspaceId?: string | null
    /** A DTO the caller already holds (switcher list, resolve-content): skips the first lookup. */
    workspace?: Workspace
    /** Rewrite the current history entry instead of pushing one. */
    replace?: boolean
}

/** navigated: committed; cancelled: a guard or a newer request kept the source; unavailable: unknown/hidden destination; failed: see `switchFailure`. */
export type NavigateOutcome = 'navigated' | 'cancelled' | 'unavailable' | 'failed'

export type SwitchFailureReason = 'call' | 'archived' | 'unavailable' | 'generic'

export interface SwitchFailure {
    reason: SwitchFailureReason
    /** The destination that could not be entered. */
    workspaceId: string
    /** Runs the same request again (guards included). */
    retry: () => void
}

/**
 * Whether the current URL may load content: `resolving` while its workspace
 * or the record a legacy link names is validated, `unavailable` when it
 * belongs to a workspace this tab cannot open (missing, or hidden by the flag).
 */
export type RouteStatus = 'ready' | 'resolving' | 'unavailable'

export interface NavigationCoordinatorValue {
    navigate: (target: NavigateTarget) => Promise<NavigateOutcome>
    /** The destination while the coordinator ends a call / revalidates, else null. */
    switchingTo: string | null
    switchFailure: SwitchFailure | null
    dismissSwitchFailure: () => void
    routeStatus: RouteStatus
}

const NavigationCoordinatorContext = createContext<NavigationCoordinatorValue | null>(null)

interface NavigationProviderProps {
    children: ReactNode
}

interface NavigationEntry {
    page: PageType
    hash: string
}

type HistoryMode =
    | { kind: 'push' }
    | { kind: 'replace' }
    /** An unindexed external entry restored to the committed URL: approval replaces it. */
    | { kind: 'transient' }
    /** An indexed entry: approval traverses back to it with a one-use commit token. */
    | { kind: 'traverse'; index: number; rawHash: string }

interface RouteRequest {
    page: PageType
    hash: string
    workspaceId: string | null
    workspace?: Workspace
    history: HistoryMode
    /** The hash came from outside the app: validate its record after the commit. */
    verify?: boolean
}

interface Verification {
    hash: string
    status: 'pending' | 'resolving' | 'unavailable'
}

// Pure helpers (no component state) — module-scoped so setPage/goBack can be
// stable useCallback([]) refs without re-creating these each render.
const hashForPage = (page: PageType, hash?: string): string => {
    if (hash) return hash
    if (typeof window === 'undefined') return pageHash(page)
    const currentHash = window.location.hash
    return currentHash && pageFromHash(currentHash) === page ? currentHash : pageHash(page)
}

const sameEntry = (a: NavigationEntry, b: NavigationEntry) => a.page === b.page && a.hash === b.hash

const liveHash = () => (typeof window === 'undefined' ? '' : window.location.hash)

let entrySequence = 0
const nextEntryId = () => `${Date.now().toString(36)}-${(entrySequence += 1).toString(36)}`

const isMissingWorkspace = (error: unknown) =>
    isWorkspaceApiError(error, 'WORKSPACE_NOT_FOUND') || (error instanceof ApiError && error.status === 404)

/** How long an approved traversal waits for the restoration event before going on. */
const RESTORE_WAIT_MS = 500

export function NavigationProvider({ children }: NavigationProviderProps) {
    const workspace = useContext(WorkspaceContext)
    const workspaceRef = useRef<WorkspaceContextValue | undefined>(workspace)
    useLayoutEffect(() => {
        workspaceRef.current = workspace
    })

    // Unknown/broken hashes resolve to the 404 page (pageFromHash returns null only
    // for genuinely-unknown routes; empty/`#/` normalizes to landing inside it).
    // With the R1 UI on, an owned type-gallery hash opens the Library instead.
    const [initialRoute] = useState(() => {
        const hash = liveHash()
        const page = pageFromHash(hash)
        return page ? normalizeRoute(page, hash) : { page: 'not-found' as PageType, hash: pageHash('not-found') }
    })
    const [currentPage, setCurrentPage] = useState<PageType>(initialRoute.page)
    const [backStack, setBackStack] = useState<NavigationEntry[]>([])
    // Mirror the live hash into state so card-editor params (`?card=&version=`) stay reactive
    // across setPage / goBack / hashchange / popstate.
    const [currentHash, setCurrentHash] = useState(liveHash)
    const currentPageRef = useRef(currentPage)
    const backStackRef = useRef(backStack)
    // The committed entry and its history index: what a cancelled request restores.
    const committedRef = useRef<NavigationEntry>({ page: initialRoute.page, hash: liveHash() })
    const committedIndexRef = useRef(0)

    // A URL from outside the app (initial load, typed/pasted link) is validated
    // before its page may load: a `workspace=` param, or the record a legacy link names.
    const [verification, setVerification] = useState<Verification | null>(() =>
        isWorkspaceContentPage(initialRoute.page) ? { hash: initialRoute.hash, status: 'pending' } : null)

    const [switchingTo, setSwitchingTo] = useState<string | null>(null)
    const [switchFailure, setSwitchFailure] = useState<SwitchFailure | null>(null)
    // Every request takes a generation; only the latest may commit.
    const generationRef = useRef(0)
    // The restoration event a guarded history request triggered (not a navigation).
    const suppressRef = useRef<{ hash: string; done: () => void } | null>(null)
    // The approved traversal: when its event arrives, it commits.
    const commitTokenRef = useRef<{ hash: string; apply: () => void } | null>(null)
    // The external hash a guarded request is handling (its duplicate events are ignored).
    const pendingExternalRef = useRef<string | null>(null)

    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    useEffect(() => {
        backStackRef.current = backStack
    }, [backStack])

    const interceptorsRef = useRef(new Set<NavigationInterceptor>())

    const registerNavigationInterceptor = useCallback((interceptor: NavigationInterceptor) => {
        interceptorsRef.current.add(interceptor)
        return () => {
            interceptorsRef.current.delete(interceptor)
        }
    }, [])

    // Consult registered guards; the first one that returns true owns the
    // navigation and may complete it later via `proceed`.
    const intercept = useCallback((proceed: () => void): boolean => {
        for (const interceptor of interceptorsRef.current) {
            if (interceptor(proceed, () => {})) return true
        }
        return false
    }, [])

    // The same guard pass for the async coordinator: resolves true on proceed, false on cancel.
    const runGuards = useCallback((): Promise<boolean> => new Promise((resolve) => {
        let settled = false
        const settle = (approved: boolean) => {
            if (settled) return
            settled = true
            resolve(approved)
        }
        for (const interceptor of interceptorsRef.current) {
            if (interceptor(() => settle(true), () => settle(false))) return
        }
        settle(true)
    }), [])

    const selectedWorkspace = useCallback(() => {
        const current = workspaceRef.current
        return current?.status === 'ready' ? current.selectedWorkspaceId : null
    }, [])

    /** Writes the URL with the namespaced stamp (entry ID, monotonic index, workspace, hash). */
    const writeUrl = useCallback((hash: string, mode: 'push' | 'replace') => {
        if (typeof window === 'undefined') return
        if (mode === 'push' && window.location.hash === hash) return
        const index = mode === 'push' ? committedIndexRef.current + 1 : committedIndexRef.current
        const stamp = { id: nextEntryId(), index, workspaceId: readHashWorkspace(hash) ?? selectedWorkspace(), hash }
        try {
            const state = stampedHistoryState(window.history.state, stamp, mode === 'replace')
            if (mode === 'replace') window.history.replaceState(state, '', hash)
            else window.history.pushState(state, '', hash)
            committedIndexRef.current = index
        } catch {
            window.location.hash = hash
        }
    }, [selectedWorkspace])

    const markCommitted = useCallback((page: PageType) => {
        currentPageRef.current = page
        committedRef.current = { page, hash: liveHash() }
        setCurrentPage(page)
        setCurrentHash(liveHash())
    }, [])

    /** Commits an in-app route: push/replace/transient keep today's back-stack semantics. */
    const applyRoute = useCallback((page: PageType, hash: string, mode: 'push' | 'replace' | 'transient', switched: boolean) => {
        const currentEntry = { page: committedRef.current.page, hash: committedRef.current.hash }
        if (switched) setBackStack([])
        else if (mode !== 'replace' && !sameEntry(currentEntry, { page, hash })) setBackStack((stack) => [...stack, currentEntry])
        writeUrl(hash, mode === 'push' ? 'push' : 'replace')
        markCommitted(page)
    }, [markCommitted, writeUrl])

    /** Commits a traversal/external entry already in the address bar (back stack pops when it matches). */
    const applyExternal = useCallback((page: PageType, hash: string, index: number, switched: boolean) => {
        const nextEntry = { page, hash }
        const currentEntry = { page: committedRef.current.page, hash: committedRef.current.hash }
        if (switched) setBackStack([])
        else if (!sameEntry(nextEntry, currentEntry)) {
            setBackStack((stack) => {
                const top = stack[stack.length - 1]
                if (top && top.page === page && (top.hash === hash || top.hash === liveHash())) return stack.slice(0, -1)
                return [...stack, currentEntry]
            })
        }
        committedIndexRef.current = index
        writeUrl(hash, 'replace')
        markCommitted(page)
    }, [markCommitted, writeUrl])

    const runRequestRef = useRef<(request: RouteRequest) => Promise<NavigateOutcome>>(async () => 'cancelled')

    const runRequest = useCallback(async (request: RouteRequest): Promise<NavigateOutcome> => {
        const generation = (generationRef.current += 1)
        const live = () => generationRef.current === generation
        setSwitchFailure(null)
        setSwitchingTo(null)
        const fail = (reason: SwitchFailureReason, workspaceId: string) => {
            if (!live()) return
            setSwitchingTo(null)
            setSwitchFailure({ reason, workspaceId, retry: () => void runRequestRef.current(request) })
        }

        const ws = workspaceRef.current
        const source = ws?.status === 'ready' ? ws.selectedWorkspaceId : null
        const targetId = request.workspace?.id ?? request.workspaceId ?? source
        const switching = targetId !== null && targetId !== source

        // 1. Resolve the requested owned workspace before asking anything.
        let destination: Workspace | null = null
        if (switching && targetId) {
            if (!ws || ws.status !== 'ready') return 'unavailable'
            if (!isWorkspacesFeatureEnabled() && targetId !== ws.defaultWorkspaceId) return 'unavailable'
            destination = request.workspace ?? ws.workspaces.find((item) => item.id === targetId) ?? null
            if (!destination) {
                try {
                    destination = await apiService.getWorkspace(targetId)
                } catch (error) {
                    if (!live()) return 'cancelled'
                    if (isMissingWorkspace(error)) return 'unavailable'
                    fail('generic', targetId)
                    return 'failed'
                }
                if (!live()) return 'cancelled'
            }
        }

        // 2. Editor guards (unsaved changes, the novel flush) while the source stays active.
        const approved = await runGuards()
        if (!approved || !live()) return 'cancelled'

        if (switching && destination) {
            setSwitchingTo(destination.id)
            // 3. A live voice call ends (and its quota is released) before the commit.
            try {
                if (hasActiveVoiceCall()) await endActiveVoiceCall()
            } catch {
                fail('call', destination.id)
                return live() ? 'failed' : 'cancelled'
            }
            if (!live()) return 'cancelled'
            // 4. Revalidate: archived/deleted elsewhere while the guards ran keeps the source.
            let fresh: Workspace
            try {
                fresh = await apiService.getWorkspace(destination.id)
            } catch (error) {
                if (!live()) return 'cancelled'
                if (isMissingWorkspace(error)) {
                    fail('unavailable', destination.id)
                    return 'unavailable'
                }
                fail('generic', destination.id)
                return 'failed'
            }
            if (!live()) return 'cancelled'
            setSwitchingTo(null)
            if (!destination.archived_at && fresh.archived_at) {
                fail('archived', destination.id)
                return 'failed'
            }
            destination = fresh
        }

        // An external hash keeps its own params until its record is validated.
        const finalHash = destination && isWorkspacesFeatureEnabled() && isWorkspaceContentPage(request.page)
            ? withHashWorkspace(request.hash, destination.id)
            : request.verify ? request.hash : stampWorkspaceHash(request.page, request.hash, source)

        // 5. Commit the workspace and the route together (one batched React update).
        const commitWorkspace = (): boolean => {
            if (!switching || !destination) return true
            const current = workspaceRef.current
            if (current && current.commitWorkspace(destination)) return true
            fail('generic', destination.id)
            return false
        }
        const afterCommit = () => {
            setVerification(request.verify && isWorkspaceContentPage(request.page) ? { hash: liveHash(), status: 'pending' } : null)
        }

        const history = request.history
        if (history.kind === 'traverse' && typeof window !== 'undefined') {
            const delta = history.index - committedIndexRef.current
            if (delta !== 0) {
                // Let the restoration land first, then traverse with a one-use commit token.
                const restoring = suppressRef.current
                if (restoring) {
                    await new Promise<void>((resolve) => {
                        const timer = window.setTimeout(resolve, RESTORE_WAIT_MS)
                        restoring.done = () => {
                            window.clearTimeout(timer)
                            resolve()
                        }
                    })
                    if (!live()) return 'cancelled'
                }
                commitTokenRef.current = {
                    hash: history.rawHash,
                    apply: () => {
                        if (!live() || !commitWorkspace()) return
                        applyExternal(request.page, finalHash, history.index, switching)
                        afterCommit()
                    },
                }
                window.history.go(delta)
                return 'navigated'
            }
        }
        if (!commitWorkspace()) return 'failed'
        const mode = history.kind === 'traverse' ? 'transient' : history.kind
        applyRoute(request.page, finalHash, mode, switching)
        afterCommit()
        return 'navigated'
    }, [applyExternal, applyRoute, runGuards])

    useEffect(() => {
        runRequestRef.current = runRequest
    }, [runRequest])

    const setPage = useCallback((page: PageType, opts?: { hash?: string; replace?: boolean }) => {
        const route = normalizeRoute(page, opts?.hash ?? '')
        const nextPage = route.page
        const explicitHash = route.page !== page ? route.hash : opts?.hash
        const selected = selectedWorkspace()
        const hashWorkspace = explicitHash && isWorkspaceContentPage(nextPage) ? readHashWorkspace(explicitHash) : null
        const otherWorkspace = selected !== null && hashWorkspace !== null && hashWorkspace !== selected
        if (otherWorkspace && isWorkspacesFeatureEnabled()) {
            void runRequestRef.current({
                page: nextPage,
                hash: explicitHash ?? pageHash(nextPage),
                workspaceId: hashWorkspace,
                history: { kind: opts?.replace ? 'replace' : 'push' },
            })
            return
        }
        const commit = () => {
            // A committed in-app navigation supersedes any request still waiting.
            generationRef.current += 1
            const currentEntry = { page: currentPageRef.current, hash: hashForPage(currentPageRef.current) }
            const nextEntry = { page: nextPage, hash: hashForPage(nextPage, explicitHash) }
            if (!opts?.replace && !sameEntry(currentEntry, nextEntry)) {
                setBackStack((stack) => [...stack, currentEntry])
            }
            writeUrl(stampWorkspaceHash(nextPage, explicitHash ?? pageHash(nextPage), selected), opts?.replace ? 'replace' : 'push')
            markCommitted(nextPage)
            // Flag off: a link into another workspace shows the unavailable state, never this workspace's data.
            setVerification(otherWorkspace ? { hash: liveHash(), status: 'unavailable' } : null)
        }
        if (intercept(commit)) return
        commit()
    }, [intercept, markCommitted, selectedWorkspace, writeUrl])

    const goBack = useCallback((fallback: PageType = 'landing') => {
        const commit = () => {
            generationRef.current += 1
            const fallbackRoute = normalizeRoute(fallback, '')
            const target = backStackRef.current[backStackRef.current.length - 1]
                ?? { page: fallbackRoute.page, hash: fallbackRoute.page !== fallback ? fallbackRoute.hash : pageHash(fallback) }
            setBackStack((stack) => stack.slice(0, -1))
            writeUrl(stampWorkspaceHash(target.page, target.hash, selectedWorkspace()), 'replace')
            markCommitted(target.page)
            setVerification(null)
        }
        if (intercept(commit)) return
        commit()
    }, [intercept, markCommitted, selectedWorkspace, writeUrl])

    // Rewrite the active page's hash in place (replaceState) without a history push —
    // used to stamp the card id into the URL after a create→edit transition, etc.
    const replaceHash = useCallback((hash: string) => {
        writeUrl(stampWorkspaceHash(currentPageRef.current, hash, selectedWorkspace()), 'replace')
        committedRef.current = { page: currentPageRef.current, hash: liveHash() }
        setCurrentHash(liveHash())
    }, [selectedWorkspace, writeUrl])

    // Browser back/forward and external hash changes. The popstate/hashchange pair
    // is coalesced by hash identity; restoration events never navigate or guard again.
    const handleLocationChange = useCallback(() => {
        const raw = liveHash()
        const token = commitTokenRef.current
        if (token && token.hash === raw) {
            commitTokenRef.current = null
            token.apply()
            return
        }
        const restoring = suppressRef.current
        if (restoring && restoring.hash === raw) {
            suppressRef.current = null
            restoring.done()
            return
        }
        if (raw === committedRef.current.hash || raw === pendingExternalRef.current) return

        const stamp = readNavigationStamp(window.history.state)
        const page = pageFromHash(raw) ?? 'not-found'
        const route = normalizeRoute(page, raw)
        const ws = workspaceRef.current
        const selected = ws?.status === 'ready' ? ws.selectedWorkspaceId : null
        const routeWorkspace = isWorkspaceContentPage(route.page) ? (readHashWorkspace(route.hash) ?? stamp?.workspaceId ?? null) : null
        const switching = isWorkspacesFeatureEnabled() && selected !== null && routeWorkspace !== null && routeWorkspace !== selected
        const indexed = stamp && stamp.index !== committedIndexRef.current ? stamp.index : null

        if (!switching && interceptorsRef.current.size === 0) {
            generationRef.current += 1
            commitTokenRef.current = null
            const external = indexed === null
            applyExternal(route.page, route.hash, indexed ?? committedIndexRef.current + 1, false)
            setVerification(external && isWorkspaceContentPage(route.page) ? { hash: liveHash(), status: 'pending' } : null)
            return
        }

        // Restore the committed entry before any content state changes; the source
        // workspace and its editors stay active while the guards are presented.
        const committed = committedRef.current
        if (indexed !== null) {
            suppressRef.current = { hash: committed.hash, done: () => {} }
            window.history.go(committedIndexRef.current - indexed)
        } else {
            // Unknown entry: no history delta is inferred. It becomes a transient
            // entry showing the committed URL until the guards decide.
            committedIndexRef.current += 1
            const state = stampedHistoryState(window.history.state, {
                id: nextEntryId(),
                index: committedIndexRef.current,
                workspaceId: selected,
                hash: committed.hash,
            }, true)
            window.history.replaceState(state, '', committed.hash)
        }
        pendingExternalRef.current = raw
        void runRequestRef.current({
            page: route.page,
            hash: route.hash,
            workspaceId: switching ? routeWorkspace : null,
            history: indexed !== null ? { kind: 'traverse', index: indexed, rawHash: raw } : { kind: 'transient' },
            verify: indexed === null,
        }).finally(() => {
            if (pendingExternalRef.current === raw) pendingExternalRef.current = null
        })
    }, [applyExternal])

    useEffect(() => {
        if (typeof window === 'undefined') return
        // Stamp the entry we started on (keeping its index across reloads) and
        // normalize an unknown or legacy hash in place.
        const stamp = readNavigationStamp(window.history.state)
        committedIndexRef.current = stamp?.index ?? 0
        const page = pageFromHash()
        writeUrl(page ? initialRoute.hash || window.location.hash : pageHash(currentPageRef.current), 'replace')
        committedRef.current = { page: currentPageRef.current, hash: liveHash() }
        setCurrentHash(liveHash())
        setVerification((current) => current && { ...current, hash: liveHash() })
        const onChange = () => handleLocationChange()
        window.addEventListener('hashchange', onChange)
        window.addEventListener('popstate', onChange)
        return () => {
            window.removeEventListener('hashchange', onChange)
            window.removeEventListener('popstate', onChange)
        }
        // Only install the URL listeners once; setPage/goBack own normal writes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Validate a URL from outside the app once the workspace handshake is ready.
    const workspaceStatus = workspace?.status
    const selectedWorkspaceId = workspace?.selectedWorkspaceId ?? null
    useEffect(() => {
        if (!verification || verification.status !== 'pending') return
        if (workspaceStatus !== 'ready' || !selectedWorkspaceId) return
        const { hash } = verification
        const page = committedRef.current.page
        if (committedRef.current.hash !== hash || !isWorkspaceContentPage(page)) {
            setVerification(null)
            return
        }
        const settle = (status: Verification['status'] | null) =>
            setVerification((current) => (current && current.hash === hash ? (status ? { hash, status } : null) : current))
        const stillHere = () => committedRef.current.hash === hash
        void (async () => {
            let target = readHashWorkspace(hash)
            if (!target) {
                const ref = legacyContentRef(page, hash)
                if (ref) {
                    settle('resolving')
                    try {
                        target = (await apiService.resolveContent(ref)).workspace_id
                    } catch {
                        // Missing or unreadable: the page shows its own not-found state.
                        target = null
                    }
                    if (!stillHere()) return
                }
            }
            const current = workspaceRef.current
            const selected = current?.status === 'ready' ? current.selectedWorkspaceId : null
            if (!target || target === selected) {
                const stamped = stampWorkspaceHash(page, hash, selected)
                if (stamped !== hash) {
                    writeUrl(stamped, 'replace')
                    committedRef.current = { page, hash: liveHash() }
                    setCurrentHash(liveHash())
                }
                settle(null)
                return
            }
            if (!isWorkspacesFeatureEnabled()) {
                settle(target === current?.defaultWorkspaceId ? null : 'unavailable')
                return
            }
            settle('resolving')
            const outcome = await runRequestRef.current({
                page,
                hash: withHashWorkspace(hash, target),
                workspaceId: target,
                history: { kind: 'replace' },
            })
            if (outcome === 'navigated') return
            if (stillHere()) settle('unavailable')
        })()
    }, [selectedWorkspaceId, verification, workspaceStatus, writeUrl])

    const navigate = useCallback((target: NavigateTarget): Promise<NavigateOutcome> => {
        const route = normalizeRoute(target.page, target.hash ?? '')
        const hash = route.page !== target.page ? route.hash : (target.hash ?? pageHash(target.page))
        return runRequest({
            page: route.page,
            hash,
            workspaceId: target.workspace?.id ?? target.workspaceId ?? (isWorkspaceContentPage(route.page) ? readHashWorkspace(hash) : null),
            workspace: target.workspace,
            history: { kind: target.replace ? 'replace' : 'push' },
        })
    }, [runRequest])

    const dismissSwitchFailure = useCallback(() => setSwitchFailure(null), [])

    const cardEdit = useMemo(() => parseCardEditHash(currentHash), [currentHash])
    const resourceEdit = useMemo(() => parseResourceEditHash(currentHash), [currentHash])

    const routeStatus: RouteStatus = verification && verification.hash === currentHash && workspaceStatus === 'ready'
        && isWorkspaceContentPage(currentPage)
        ? (verification.status === 'unavailable' ? 'unavailable' : 'resolving')
        : 'ready'

    const value: NavigationContextValue = useMemo(() => ({
        currentPage,
        previousPage: backStack[backStack.length - 1]?.page,
        setPage,
        goBack,
        cardEdit,
        resourceEdit,
        replaceHash,
        currentHash,
        registerNavigationInterceptor,
    }), [currentPage, backStack, setPage, goBack, cardEdit, resourceEdit, replaceHash, currentHash, registerNavigationInterceptor])

    const coordinator = useMemo<NavigationCoordinatorValue>(() => ({
        navigate,
        switchingTo,
        switchFailure,
        dismissSwitchFailure,
        routeStatus,
    }), [dismissSwitchFailure, navigate, routeStatus, switchFailure, switchingTo])

    return (
        <NavigationContext.Provider value={value}>
            <NavigationCoordinatorContext.Provider value={coordinator}>
                {children}
            </NavigationCoordinatorContext.Provider>
        </NavigationContext.Provider>
    )
}

// Export the contexts for use in hooks
export { NavigationContext, NavigationCoordinatorContext }
