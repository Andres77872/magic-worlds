/**
 * Always-mounted wiring between the workspace switch coordinator and the
 * contracts other features call (rendered once by AppRouter):
 *
 * - `registerOriginNavigator`: notifications, tasks, assistant history and
 *   links open their record's workspace through the coordinator.
 * - `registerReturnHandler`: a creator opened from the Library returns to the
 *   captured location after a manual save and the Library highlights the card
 *   (it stays registered while the Library itself is unmounted).
 * - A captured creation origin is dropped once the user leaves the creators
 *   or the workspace changes, so a later creator falls back to the root.
 */
import { useContext, useEffect } from 'react'
import { useNavigation } from '@/app/hooks/useNavigation'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { NavigationContext } from '@/app/providers/NavigationProvider'
import { WorkspaceContext } from '@/app/providers/workspaceContext'
import type { PageType } from '@/shared'
import { useCreationOrigin } from '@/features/library/creationOrigin'
import { buildLibraryHash, libraryRouteFromLocation } from '@/features/library/libraryUrl'
import { rememberLibraryReturn } from '@/features/library/libraryReturn'
import { useNavigationCoordinator } from './useNavigationCoordinator'
import { useOriginNavigation } from './originNavigation'

const CREATOR_PAGES: ReadonlySet<PageType> = new Set<PageType>(['character', 'world', 'item', 'adventure'])

export function WorkspaceNavigationBridge() {
    // Inert outside the app providers (isolated router tests, stories).
    const navigation = useContext(NavigationContext)
    const workspace = useContext(WorkspaceContext)
    if (!navigation || !workspace) return null
    return <ConnectedNavigationBridge />
}

function ConnectedNavigationBridge() {
    const { currentPage, setPage } = useNavigation()
    const { selectedWorkspaceId } = useWorkspace()
    const { navigate } = useNavigationCoordinator()
    const { registerOriginNavigator } = useOriginNavigation()
    const { origin, isCaptured, clear, registerReturnHandler } = useCreationOrigin()

    useEffect(() => registerOriginNavigator(async (target) => {
        if (!target.workspaceId) return 'unavailable'
        const outcome = await navigate({ page: target.page, hash: target.hash, workspaceId: target.workspaceId })
        if (outcome === 'navigated' || outcome === 'unavailable') return outcome
        return 'cancelled'
    }), [navigate, registerOriginNavigator])

    // Creators call this synchronously right after a successful manual save.
    useEffect(() => registerReturnHandler((captured, created) => {
        if (!captured.returnTo || captured.workspaceId !== selectedWorkspaceId) return false
        // `created` is null on Back: restore the location without a highlight.
        rememberLibraryReturn(captured.workspaceId, { created, scrollY: captured.returnTo.scrollY })
        setPage('library', { hash: buildLibraryHash(libraryRouteFromLocation(captured.workspaceId, captured.returnTo)) })
        return true
    }), [registerReturnHandler, selectedWorkspaceId, setPage])

    const capturedWorkspaceId = isCaptured ? origin?.workspaceId ?? null : null
    useEffect(() => {
        if (!capturedWorkspaceId) return
        if (capturedWorkspaceId !== selectedWorkspaceId || !CREATOR_PAGES.has(currentPage)) clear()
    }, [capturedWorkspaceId, clear, currentPage, selectedWorkspaceId])

    return null
}
