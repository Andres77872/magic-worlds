/**
 * Workspace R1 guarded origin navigation (document 08, "Workspace-switch state
 * machine" and "Lifecycle and origin interactions").
 *
 * Notifications, task actions, assistant history and links open content in
 * the workspace it belongs to. They call `navigateToOrigin`; the workspace
 * switch coordinator (installed by the workspace feature through
 * `registerOriginNavigator`) runs the editor guards, ends an active call,
 * commits the workspace and route together, or reports why it could not.
 *
 *     const { navigateToOrigin } = useOriginNavigation()
 *     const outcome = await navigateToOrigin({ workspaceId: notice.metadata.workspace_id, page: 'gallery-media' })
 *     if (outcome === 'unavailable') showUnavailableTarget()
 *
 * Before a coordinator is registered, a same-workspace target navigates
 * directly and any other workspace is 'unavailable' (never the active one).
 */
import { isPageFeatureEnabled } from '@/shared/featureFlags'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { PageType } from '@/shared'
import { useNavigation } from '@/app/hooks/useNavigation'
import { useWorkspace } from '@/app/hooks/useWorkspace'

export interface OriginTarget {
    /** The record's origin workspace; null for a legacy record without one. */
    workspaceId: string | null
    page: PageType
    hash?: string
}

/** navigated: done; cancelled: a guard kept the user here; unavailable: missing/hidden/unknown origin. */
export type OriginNavigationOutcome = 'navigated' | 'cancelled' | 'unavailable'
export type OriginNavigator = (target: OriginTarget) => Promise<OriginNavigationOutcome>

interface OriginNavigationContextValue {
    navigator: OriginNavigator | null
    registerOriginNavigator: (navigator: OriginNavigator) => () => void
}

const OriginNavigationContext = createContext<OriginNavigationContextValue | null>(null)

export function OriginNavigationProvider({ children }: { children: ReactNode }) {
    const [entry, setEntry] = useState<{ current: OriginNavigator } | null>(null)
    const registerOriginNavigator = useCallback((next: OriginNavigator) => {
        const registered = { current: next }
        setEntry(registered)
        return () => setEntry((current) => (current === registered ? null : current))
    }, [])
    const value = useMemo(() => ({ navigator: entry?.current ?? null, registerOriginNavigator }),
        [entry, registerOriginNavigator])
    return <OriginNavigationContext.Provider value={value}>{children}</OriginNavigationContext.Provider>
}

export function useOriginNavigation(): {
    navigateToOrigin: OriginNavigator
    registerOriginNavigator: (navigator: OriginNavigator) => () => void
} {
    const context = useContext(OriginNavigationContext)
    const { setPage } = useNavigation()
    const { selectedWorkspaceId } = useWorkspace()
    const registered = context?.navigator ?? null
    const navigateToOrigin = useCallback<OriginNavigator>(async (target) => {
        if (!isPageFeatureEnabled(target.page)) return 'unavailable'
        if (registered) return registered(target)
        if (!target.workspaceId || target.workspaceId !== selectedWorkspaceId) return 'unavailable'
        setPage(target.page, target.hash ? { hash: target.hash } : undefined)
        return 'navigated'
    }, [registered, selectedWorkspaceId, setPage])
    return {
        navigateToOrigin,
        registerOriginNavigator: context?.registerOriginNavigator ?? (() => () => {}),
    }
}
