import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { manuscript, storyScene } from '@/test/fixtures/story'
import { reconciliationKey, reconciliationSceneScope, type ReconciliationCheckpoint } from '../persistence/reconciliationJournal'
import { reconciliationSource } from '../hooks/useReconciliationProgress'
import { notifyDeviceReads } from '../persistence/deviceReadDatabase'
import { emptyNovelLifecycle } from '../persistence/novelDeviceLifecycle'
const mocks = vi.hoisted(() => ({ list: vi.fn(), load: vi.fn(), save: vi.fn(), lifecycle: vi.fn(), novel: vi.fn(), current: true }))
vi.mock('../persistence/deviceWorkspaceStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceWorkspaceStorage')>(), listDeviceWorkspaces: mocks.lifecycle }))
vi.mock('../persistence/deviceNovelStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceNovelStorage')>(), readDeviceNovel: mocks.novel }))
vi.mock('../persistence/reconciliationJournal', async (original) => ({ ...await original<typeof import('../persistence/reconciliationJournal')>(),
    listSavedReconciliations: mocks.list, reconciliationJournal: { load: mocks.load, save: mocks.save } }))
import { NovelSavedSceneReviews } from './NovelSavedSceneReview'
const scope = { apiOrigin: 'https://writing.example', userHash: 'author', workspaceId: 'desk' }
const source = reconciliationSource({ id: 'saved-source', ownerKey: 'older-owner', sequence: 2, deviceTitle: 'The letter',
    baseDocument: manuscript('A letter waited.', 'letter'), deviceDocument: manuscript('My letter.', 'letter'), account: storyScene({ title: 'The letter', revision: 2, document: manuscript('Their letter.', 'letter') }) })
const checkpoint: ReconciliationCheckpoint = { schema: 1, key: reconciliationKey(scope, 'old-writer'), sceneScope: reconciliationSceneScope(scope, source.storyId, source.sceneId), source,
    value: { choices: { letter: 'device' }, order: 'device', title: 'device' }, sequence: 1, writtenAt: 1, isDefaultWorkspace: true }
const current = () => mocks.current
beforeEach(() => { vi.clearAllMocks(); mocks.current = true; mocks.lifecycle.mockResolvedValue({ states: {}, unreadableIds: [], unreadable: 0, unavailable: false }); mocks.novel.mockResolvedValue({ state: null, unavailable: false, unreadable: false }); mocks.list.mockResolvedValue({ items: [{ scope, checkpoint }], unavailable: false, unreadable: 0 }); mocks.load.mockResolvedValue({ checkpoint, unavailable: false, unreadable: 0 }); mocks.save.mockResolvedValue('saved') })
it('opens saved source and choices independently of any scene cache and prevents every account mutation', async () => {
    const onCheckpointState = vi.fn()
    render(<NovelSavedSceneReviews scope={scope} current={current} allWorkspaces={false} onCheckpointState={onCheckpointState} />)
    fireEvent.click(await screen.findByRole('button', { name: 'The letter · account revision 2' }))
    expect(await screen.findByText(/Saved review choices recovered/)).toBeInTheDocument()
    expect(screen.getByText(/This review uses a saved account snapshot/)).toBeInTheDocument()
    for (const name of ['Use reviewed merge', 'Use account version', 'Use device version', 'Refresh comparison']) expect(screen.getByRole('button', { name })).toBeDisabled()
    fireEvent.click(screen.getByRole('combobox', { name: 'Block 1' })); fireEvent.click(screen.getByRole('option', { name: /^Account version$/ }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][1]).toMatchObject({ source, value: { choices: { letter: 'account' } } })
    expect(onCheckpointState).toHaveBeenCalledWith(false)
    await waitFor(() => expect(onCheckpointState).toHaveBeenLastCalledWith(true))
})
it('withholds nondefault workspaces and discards a retired owner’s delayed list', async () => {
    mocks.list.mockResolvedValueOnce({ items: [{ scope, checkpoint: { ...checkpoint, isDefaultWorkspace: false } }], unavailable: false, unreadable: 0 })
    const first = render(<NovelSavedSceneReviews scope={scope} current={current} allWorkspaces={false} onCheckpointState={vi.fn()} />)
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(1)); expect(screen.queryByText('Saved reconciliations')).not.toBeInTheDocument(); first.unmount()
    let resolve!: (value: Awaited<ReturnType<typeof mocks.list>>) => void; mocks.list.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    render(<NovelSavedSceneReviews scope={scope} current={current} allWorkspaces onCheckpointState={vi.fn()} />)
    mocks.current = false
    await act(async () => resolve({ items: [{ scope, checkpoint }], unavailable: false, unreadable: 0 }))
    expect(screen.queryByText('Saved reconciliations')).not.toBeInTheDocument()
})
it('locks saved choices after a retained workspace archive without losing their source or recovery controls', async () => {
    render(<NovelSavedSceneReviews scope={scope} current={current} allWorkspaces onCheckpointState={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'The letter · account revision 2' }))
    await screen.findByText(/Saved review choices recovered/)
    mocks.lifecycle.mockResolvedValue({ states: { desk: { id: 'desk', name: 'Writing desk', isDefault: false, rowVersion: 9, archived: true } }, unreadableIds: [], unreadable: 0, unavailable: false })
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Block 1' })).toBeDisabled())
    expect(screen.getByRole('dialog')).toHaveTextContent('My letter.')
    expect(screen.getByRole('button', { name: 'Download review and choices' })).toBeEnabled()
    expect(mocks.save).not.toHaveBeenCalled()
})
it('keeps source and export after confirmed erasure blocks an already-open saved review', async () => {
    render(<NovelSavedSceneReviews scope={scope} current={current} allWorkspaces onCheckpointState={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'The letter · account revision 2' }))
    await screen.findByText(/Saved review choices recovered/)
    mocks.novel.mockResolvedValue({ state: { ...emptyNovelLifecycle(), erased: true }, unavailable: false, unreadable: false })
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Block 1' })).toBeDisabled())
    expect(screen.getByRole('dialog')).toHaveTextContent('My letter.')
    expect(screen.getByRole('button', { name: 'Download review and choices' })).toBeEnabled()
    expect(mocks.save).not.toHaveBeenCalled()
})
