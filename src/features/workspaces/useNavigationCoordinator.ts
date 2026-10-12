/**
 * The Workspace R1 switch coordinator owned by NavigationProvider: one async
 * path for the switcher, origin links, library URLs naming another workspace
 * and browser history.
 *
 *     const { navigate } = useNavigationCoordinator()
 *     const outcome = await navigate({ page: 'library', workspace })   // guards → end call → revalidate → commit
 *
 * Outside a NavigationProvider coordinator (stories, isolated tests) it falls
 * back to a plain same-workspace `setPage` (when a navigation context exists)
 * and reports other workspaces as unavailable.
 */
import { useCallback, useContext, useMemo } from 'react'
import {
    NavigationContext,
    NavigationCoordinatorContext,
    type NavigateOutcome,
    type NavigateTarget,
    type NavigationCoordinatorValue,
} from '@/app/providers/NavigationProvider'
import { WorkspaceContext } from '@/app/providers/workspaceContext'

const NOOP = () => {}

export function useNavigationCoordinator(): NavigationCoordinatorValue {
    const context = useContext(NavigationCoordinatorContext)
    const workspace = useContext(WorkspaceContext)
    const setPage = useContext(NavigationContext)?.setPage
    const selectedWorkspaceId = workspace?.selectedWorkspaceId ?? null
    const fallbackNavigate = useCallback(async (target: NavigateTarget): Promise<NavigateOutcome> => {
        const targetId = target.workspace?.id ?? target.workspaceId ?? null
        if (!setPage || (targetId && targetId !== selectedWorkspaceId)) return 'unavailable'
        setPage(target.page, { hash: target.hash, replace: target.replace })
        return 'navigated'
    }, [selectedWorkspaceId, setPage])
    const fallback = useMemo<NavigationCoordinatorValue>(() => ({
        navigate: fallbackNavigate,
        switchingTo: null,
        switchFailure: null,
        dismissSwitchFailure: NOOP,
        routeStatus: 'ready',
    }), [fallbackNavigate])
    return context ?? fallback
}
