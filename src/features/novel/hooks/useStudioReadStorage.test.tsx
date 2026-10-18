import { type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WorkspaceContext, type WorkspaceContextValue } from '@/app/providers/workspaceContext'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { studioIndex, studioSceneRead } from '@/test/fixtures/storyStudio'
import { applyStudioSceneAcknowledgement } from '@/shared/storyStudioState'
import { studioReadStorage } from '../persistence/studioReadStorage'
import { useStudioReadStorage } from './useStudioReadStorage'
import type { SceneConfirmation } from './useStudioScene'

const auth = vi.hoisted(() => ({ userHash: 'cache-author', accountKey: 'cache-owner', isAuthenticated: true }))
vi.mock('@/app/hooks', () => ({ useAuth: () => auth }))
let current = true
const workspace = { workspaceId: 'cache-desk', isCurrent: () => current, detachedApi: () => null }
const desk = { id: workspace.workspaceId, name: 'Writing desk', description: null, preferred_use: 'writing' as const,
    is_default: true, archived_at: null, row_version: 1, created_at: '2026-10-16T00:00:00Z', updated_at: '2026-10-16T00:00:00Z' }
const context: WorkspaceContextValue = { status: 'ready', unavailableReason: null, staleReason: null, 
    workspaces: [desk], activeWorkspaces: [desk], defaultWorkspaceId: desk.id, selectedWorkspaceId: desk.id, selectedWorkspace: desk,
    workspaceEpoch: 1,  api: null, commitWorkspace: () => false, refreshWorkspaces: async () => {},
    capture: () => null, isCurrent: () => current }
const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceContext.Provider value={context}>{children}</WorkspaceContext.Provider>
const scene = storyScene({ document: manuscript('A confirmed letter.', 'cache-letter') })
const index = studioIndex(novel({ organization: { workspace_id: workspace.workspaceId }, chapters: [storyChapter({ scenes: [scene] })] }))
beforeEach(() => { current = true; Object.assign(auth, { userHash: 'cache-author', accountKey: 'cache-owner', isAuthenticated: true }) })
afterEach(() => vi.restoreAllMocks())

it('publishes the confirmed opening read and later acknowledged prose without fetching or storing an unsent editor draft', async () => {
    const remember = vi.spyOn(studioReadStorage, 'remember').mockResolvedValue({ status: 'saved' })
    const read = studioSceneRead(index, scene)
    const view = renderHook(({ source, confirmation }) => useStudioReadStorage(source, workspace, confirmation), {
        wrapper, initialProps: { source: index as ReturnType<typeof applyStudioSceneAcknowledgement>, confirmation: { scene: read.scene, read, sequence: 1 } as SceneConfirmation },
    })
    await waitFor(() => expect(view.result.current.status).toBe('saved'))
    expect(remember).toHaveBeenLastCalledWith(expect.objectContaining({ userHash: auth.userHash }), expect.objectContaining({ id: workspace.workspaceId }), index, read, expect.any(Function))
    const saved = storyScene({ ...scene, revision: 2, contentHash: 'c'.repeat(64), document: manuscript('The latest acknowledged letter.', 'cache-letter'), plainText: 'The latest acknowledged letter.', body: 'The latest acknowledged letter.' })
    view.rerender({ source: applyStudioSceneAcknowledgement(index, saved), confirmation: { scene: saved, read: undefined, sequence: 2 } })
    await waitFor(() => expect(remember.mock.calls[remember.mock.calls.length - 1]?.[3]).toMatchObject({ projection: 'acknowledged_scene', scene: { revision: 2, document: saved.document } }))
    expect(remember.mock.calls[remember.mock.calls.length - 1][3]!.scene).not.toHaveProperty('generationHistory')
})
it('retires publication when the owner changes and keeps device-only views out of the account cache writer', async () => {
    let resolve!: (value: { status: 'saved' }) => void
    const remember = vi.spyOn(studioReadStorage, 'remember').mockImplementation(() => new Promise((done) => { resolve = done }))
    const view = renderHook(() => useStudioReadStorage(index, workspace), { wrapper })
    await waitFor(() => expect(remember).toHaveBeenCalledTimes(1))
    const owns = remember.mock.calls[0][4]!
    expect(owns()).toBe(true)
    auth.accountKey = 'another-owner'; auth.userHash = 'another-author'; view.rerender()
    expect(owns()).toBe(false)
    await act(async () => resolve({ status: 'saved' }))
    expect(view.result.current.status).toBeNull()
    view.unmount(); remember.mockClear()
    renderHook(() => useStudioReadStorage(index, { ...workspace, deviceOnly: true }), { wrapper })
    expect(remember).not.toHaveBeenCalled()
})
