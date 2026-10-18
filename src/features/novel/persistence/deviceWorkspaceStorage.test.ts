import { expect, it, vi } from 'vitest'
import { preferWorkspaceState } from '@/shared/workspaceLifecycle'
import { listDeviceWorkspaces, newestCachedWorkspace, rememberDeviceWorkspaces, validCachedWorkspace } from './deviceWorkspaceStorage'

const scope = { apiOrigin: 'https://writing.example', userHash: 'fictional-author' }
const workspace = { id: 'desk', name: 'Writing desk', isDefault: false, archived: false }
it('keeps legacy copies readable without inventing a workspace version', () => {
    expect(validCachedWorkspace(workspace)).toBe(true)
    expect(validCachedWorkspace({ ...workspace, rowVersion: 0 })).toBe(false)
    expect(validCachedWorkspace({ ...workspace, rowVersion: '9' })).toBe(false)
    expect(newestCachedWorkspace({ ...workspace, archived: true }, workspace).archived).toBe(true)
    const legacyArchive = { ...workspace, archived: true }
    expect(newestCachedWorkspace(legacyArchive, { ...workspace, rowVersion: 10 })).toBe(legacyArchive)
    expect(newestCachedWorkspace(legacyArchive, { ...workspace, archived: true, rowVersion: 9 })).toMatchObject({ rowVersion: 9, archived: true })
    expect(newestCachedWorkspace({ ...workspace, rowVersion: 9, archived: true }, workspace)).toMatchObject({ rowVersion: 9, archived: true })
})
it('uses real version order and conservatively keeps an equal-version archive', () => {
    const archived = { ...workspace, rowVersion: 9, archived: true }
    expect(newestCachedWorkspace(archived, { ...workspace, rowVersion: 8 })).toBe(archived)
    expect(newestCachedWorkspace(archived, { ...workspace, rowVersion: 9 })).toBe(archived)
    expect(newestCachedWorkspace({ ...workspace, rowVersion: 9 }, archived)).toBe(archived)
    expect(newestCachedWorkspace(archived, { ...workspace, rowVersion: 10 }).archived).toBe(false)
    expect(preferWorkspaceState({ rowVersion: 9, archived: false }, { rowVersion: 8, archived: true })).toBe(false)
})
it('does not open storage for a retired owner or unversioned purported server list', async () => {
    const open = vi.fn(() => { throw new Error('Blocked') }); vi.stubGlobal('indexedDB', { open })
    try {
        expect(await rememberDeviceWorkspaces(scope, [{ ...workspace, rowVersion: 1 }], () => false)).toEqual({ status: 'retired' })
        expect(await rememberDeviceWorkspaces(scope, [workspace])).toEqual({ status: 'invalid' })
        expect(open).not.toHaveBeenCalled()
        expect(await rememberDeviceWorkspaces(scope, [{ ...workspace, rowVersion: 1 }])).toEqual({ status: 'unavailable' })
        expect(await listDeviceWorkspaces(scope)).toMatchObject({ unavailable: true, states: {} })
    } finally { vi.unstubAllGlobals() }
})
