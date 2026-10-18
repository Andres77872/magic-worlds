import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { documentText } from '@/shared/storyDocument'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { studioIndex, studioSceneRead } from '@/test/fixtures/storyStudio'
import { draftJournalKey, readCheckpoint } from '../persistence/draftJournal'
import { mergeCachedRead, type StudioReadStorage } from '../persistence/studioReadStorage'
import { notifyDeviceReads } from '../persistence/deviceReadDatabase'
import type { DeviceWorkspaceStates } from '../persistence/deviceWorkspaceStorage'
import { emptyNovelLifecycle, novelLifecycleObservation } from '../persistence/novelDeviceLifecycle'

const mocks = vi.hoisted(() => ({ current: true, update: vi.fn(), accept: vi.fn(), lifecycle: vi.fn(), novel: vi.fn() }))
vi.mock('../persistence/deviceWorkspaceStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceWorkspaceStorage')>(), listDeviceWorkspaces: mocks.lifecycle }))
vi.mock('../persistence/deviceNovelStorage', async (original) => ({ ...await original<typeof import('../persistence/deviceNovelStorage')>(), readDeviceNovel: mocks.novel }))
vi.mock('@/app/hooks', () => ({
    useAuth: () => ({ isAuthenticated: true, sessionPhase: 'authenticated', userHash: 'device-author', accountKey: 'device-owner' }),
    useData: () => ({ updateStoryScene: mocks.update, acceptStoryGeneration: mocks.accept }), useNavigation: () => ({}),
}))
vi.mock('../editor/NovelEditor', () => ({ NovelEditor: ({ initialDocument, onDocumentChange, readOnly, aiDisabled }: {
    initialDocument: ReturnType<typeof manuscript>; onDocumentChange: (value: ReturnType<typeof manuscript>) => void; readOnly: boolean; aiDisabled: boolean;
}) => <textarea aria-label="Scene manuscript" readOnly={readOnly} data-ai-disabled={String(aiDisabled)} defaultValue={documentText(initialDocument)}
    onChange={(event) => onDocumentChange(manuscript(event.target.value, 'device-letter'))} /> }))
import { NovelDeviceLibraryView } from './NovelDeviceLibrary'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { scopedNovelMutationKey } from '@/shared/novelMutationJournal'
import { AUTHOR_VARIANT_DOMAIN, newAuthorVariantDraft, writeAuthorVariantDraft } from '../persistence/authorVariantJournal'

const scope = { apiOrigin: 'http://localhost:8010', userHash: 'device-author' }, workspace = { id: 'device-desk', name: 'Writing desk', isDefault: true, archived: false }
const scene = storyScene({ id: 'device-scene', document: manuscript('The saved letter.', 'device-letter') })
const index = studioIndex(novel({ organization: { workspace_id: workspace.id }, chapters: [storyChapter({ scenes: [scene, storyScene({ id: 'not-cached', order: 1, title: 'Another scene' })] })] }))
const record = () => mergeCachedRead(scope, workspace, index, studioSceneRead(index, scene), null)!
const current = () => mocks.current
function store(): StudioReadStorage {
    return { list: vi.fn(async () => ({ items: [record()], unavailable: false, unreadable: 0, bytes: 2048 })), remember: vi.fn(), subscribe: () => () => {} }
}
async function openScene() { const button = await screen.findByRole('button', { name: 'Scene 1 · saved revision 1' }); await act(async () => { fireEvent.click(button) }) }
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.current = true; mocks.lifecycle.mockResolvedValue({ states: {}, unreadableIds: [], unreadable: 0, unavailable: false }); mocks.novel.mockResolvedValue({ state: null, unavailable: false, unreadable: false }) })
afterEach(() => { vi.restoreAllMocks() })

it('lists and inspects retained private suggestions even when no manuscript has been cached', async () => {
    const f=authorVariantFixture(),value={...newAuthorVariantDraft(f.context,true),seeded:true,title:'Private writing without a cached novel',
        document:manuscript('My private letter is still here.'),anchorEdits:null}
    const key=scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN,{...scope,workspaceId:workspace.id,storyId:value.storyId},f.generation.id,'uncached-private-writer')!
    expect(writeAuthorVariantDraft(key,value)).toBe(true)
    const reads=store();vi.mocked(reads.list).mockResolvedValue({items:[],unavailable:false,unreadable:0,bytes:0})
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={reads}/>)
    expect(screen.getByText('Private writing without a cached novel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Inspect private draft'}))
    await waitFor(()=>expect(screen.getByLabelText('Scene manuscript')).toHaveValue('My private letter is still here.'))
    expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('readonly')
    expect(mocks.update).not.toHaveBeenCalled();expect(mocks.accept).not.toHaveBeenCalled()
    expect(localStorage.getItem(key)).not.toBeNull()
})

it('keeps unsent prose while a newer novel Trash locks its writer, then accepts only a newer restore', async () => {
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} />)
    await openScene()
    const editor = screen.getByLabelText('Scene manuscript')
    fireEvent.change(editor, { target: { value: 'The draft survives novel Trash and restoration.' } })
    const observation = (revision: number, readOnly: boolean) => ({ state: { ...emptyNovelLifecycle(), root: { revision, readOnly } }, unavailable: false, unreadable: false })
    mocks.novel.mockResolvedValue(observation(9, true))
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(editor).toHaveAttribute('readonly'))
    expect(editor).toHaveValue('The draft survives novel Trash and restoration.')
    fireEvent.click(screen.getByRole('button', { name: 'Retain draft on device' }))
    expect(documentText(readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!.document)).toBe('The draft survives novel Trash and restoration.')
    mocks.novel.mockResolvedValue(observation(8, false))
    await act(async () => { notifyDeviceReads() })
    expect(editor).toHaveAttribute('readonly')
    mocks.novel.mockResolvedValue(observation(10, false))
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(editor).not.toHaveAttribute('readonly'))
    expect(editor).toHaveValue('The draft survives novel Trash and restoration.')
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.accept).not.toHaveBeenCalled()
})

it('locks an open writer on a newer archive without replacing its draft and unlocks only for a newer restore', async () => {
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} />)
    await openScene()
    const editor = screen.getByLabelText('Scene manuscript')
    fireEvent.change(editor, { target: { value: 'My writing survives the workspace update.' } })
    const state = (rowVersion: number, archived: boolean): DeviceWorkspaceStates => ({ states: { [workspace.id]: { ...workspace, rowVersion, archived } }, unreadableIds: [], unreadable: 0, unavailable: false })
    mocks.lifecycle.mockResolvedValue(state(9, true))
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(editor).toHaveAttribute('readonly'))
    expect(editor).toHaveValue('My writing survives the workspace update.')
    fireEvent.click(screen.getByRole('button', { name: 'Retain draft on device' }))
    expect(documentText(readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!.document)).toBe('My writing survives the workspace update.')
    mocks.lifecycle.mockResolvedValue(state(8, false))
    await act(async () => { notifyDeviceReads() })
    expect(editor).toHaveAttribute('readonly')
    mocks.lifecycle.mockResolvedValue(state(10, false))
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(editor).not.toHaveAttribute('readonly'))
    expect(editor).toHaveValue('My writing survives the workspace update.')
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.accept).not.toHaveBeenCalled()
})

it('keeps an unverifiable workspace copy read-only with intact manual recovery', async () => {
    mocks.lifecycle.mockResolvedValue({ states: {}, unreadableIds: [workspace.id], unreadable: 1, unavailable: false })
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} />)
    await openScene()
    expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('readonly')
    expect(screen.getByText(/saved workspace state could not be verified/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show copyable manuscript' }))
    expect(screen.getByLabelText('Copyable device manuscript')).toHaveValue('The saved letter.')
})
it('follows newer chapter archive and scene removal without replacing open prose, and keeps erasure terminal', async () => {
    const openAccount = vi.fn(async () => {})
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} canOpenAccount={() => true} onOpenAccount={openAccount} />)
    await openScene()
    const editor = screen.getByLabelText('Scene manuscript')
    fireEvent.change(editor, { target: { value: 'Keep the same open scene draft.' } })
    const base = novelLifecycleObservation(index, workspace.id)!
    const observed = (state: typeof base) => ({ state, unavailable: false, unreadable: false })
    mocks.novel.mockResolvedValue(observed({ ...emptyNovelLifecycle(), units: { [scene.chapterId]: { revision: 3, readOnly: true } } }))
    await act(async () => { notifyDeviceReads() }); expect(editor).toHaveAttribute('readonly')
    mocks.novel.mockResolvedValue(observed({ ...emptyNovelLifecycle(), units: { [scene.chapterId]: { revision: 4, readOnly: false } } }))
    await act(async () => { notifyDeviceReads() }); expect(editor).not.toHaveAttribute('readonly')
    mocks.novel.mockResolvedValue(observed({ ...emptyNovelLifecycle(), structure: { ...base.structure!, revision: 5, scenes: [] } }))
    await act(async () => { notifyDeviceReads() }); expect(editor).toHaveAttribute('readonly')
    mocks.novel.mockResolvedValue(observed({ ...base, structure: { ...base.structure!, revision: 6 }, units: { [scene.chapterId]: { revision: 4, readOnly: false } } }))
    await act(async () => { notifyDeviceReads() }); expect(editor).not.toHaveAttribute('readonly')
    mocks.novel.mockResolvedValue(observed({ ...emptyNovelLifecycle(), erased: true }))
    await act(async () => { notifyDeviceReads() }); expect(editor).toHaveAttribute('readonly')
    mocks.novel.mockResolvedValue(observed({ ...base, root: { revision: 99, readOnly: false } }))
    await act(async () => { notifyDeviceReads() }); expect(editor).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Open current account version' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Open current account version' })); expect(openAccount).not.toHaveBeenCalled()
    expect(screen.getByText(/device copies have been kept for manual recovery/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retain draft on device' }))
    expect(documentText(readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!.document)).toBe('Keep the same open scene draft.')
    expect(mocks.update).not.toHaveBeenCalled()
})
it('blocks edits when novel lifecycle cannot be verified and preserves manual recovery after retention failure', async () => {
    mocks.novel.mockResolvedValue({ state: null, unavailable: false, unreadable: true })
    render(<NovelDeviceLibraryView initialOpen lifecycleRetentionFailed scope={scope} current={current} store={store()} />)
    await openScene()
    expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('readonly')
    expect(screen.getByText(/Some current novel states could not be retained/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show copyable manuscript' }))
    expect(screen.getByLabelText('Copyable device manuscript')).toHaveValue('The saved letter.')
})

it('reopens a confirmed scene and its real draft queue across a full component remount without account writes', async () => {
    const storage = store(), first = render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={storage} />)
    expect(await screen.findByRole('button', { name: /Another scene · Not retained/ })).toBeDisabled()
    await openScene()
    const editor = screen.getByLabelText('Scene manuscript')
    expect(editor).toHaveAttribute('data-ai-disabled', 'true')
    fireEvent.change(editor, { target: { value: 'The author wrote this while offline.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retain draft on device' }))
    const saved = readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!
    expect(documentText(saved.document)).toBe('The author wrote this while offline.')
    first.unmount()
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={storage} />)
    await openScene()
    expect(screen.getByText(/A device draft is available/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Resume device draft' }))
    expect(screen.getByLabelText('Scene manuscript')).toHaveValue('The author wrote this while offline.')
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.accept).not.toHaveBeenCalled()
})

it('keeps the editor open when checkpoint storage fails and provides manual copy recovery', async () => {
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} />)
    await openScene()
    fireEvent.change(screen.getByLabelText('Scene manuscript'), { target: { value: 'Keep this unsaved private writing.' } })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
    fireEvent.click(screen.getByRole('button', { name: 'Back to device novels' }))
    expect(screen.getByLabelText('Scene manuscript')).toHaveValue('Keep this unsaved private writing.')
    expect(screen.getByRole('alert')).toHaveTextContent('The browser could not retain')
    fireEvent.click(screen.getByRole('button', { name: 'Show copyable manuscript' }))
    expect(screen.getByLabelText('Copyable device manuscript')).toHaveValue('Keep this unsaved private writing.')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(mocks.update).not.toHaveBeenCalled()
})

it('preserves local writing when a current account scene is missing and never enters its account editor', async () => {
    const onOpenAccount = vi.fn(async () => { throw new Error('Removed scene') }), onAccountOpened = vi.fn()
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} canOpenAccount={() => true} onOpenAccount={onOpenAccount} onAccountOpened={onAccountOpened} />)
    await openScene()
    fireEvent.change(screen.getByLabelText('Scene manuscript'), { target: { value: 'The removed scene still has this device draft.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open current account version' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The current account scene could not be opened'))
    expect(onOpenAccount).toHaveBeenCalledWith(expect.objectContaining({ key: record().key }), scene.id)
    expect(onAccountOpened).not.toHaveBeenCalled()
    expect(documentText(readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!.document)).toContain('still has this device draft')
    expect(screen.getByLabelText('Scene manuscript')).toBeInTheDocument()
})

it('checkpoints writing typed during a current-head read before handing off to account recovery', async () => {
    let resolve!: () => void
    const onOpenAccount = vi.fn(() => new Promise<void>((done) => { resolve = done })), entered = vi.fn()
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} canOpenAccount={() => true} onOpenAccount={onOpenAccount} onAccountOpened={entered} />)
    await openScene()
    fireEvent.change(screen.getByLabelText('Scene manuscript'), { target: { value: 'First device draft.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Open current account version' }))
    fireEvent.change(screen.getByLabelText('Scene manuscript'), { target: { value: 'A newer tail written while checking.' } })
    await act(async () => resolve())
    expect(entered).toHaveBeenCalledTimes(1)
    expect(documentText(readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!.document)).toBe('A newer tail written while checking.')
})
it('keeps the device view and its final draft when confirmed erasure arrives during account handoff', async () => {
    let finish!: () => void
    const entered = vi.fn(), opening = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={store()} canOpenAccount={() => true} onOpenAccount={opening} onAccountOpened={entered} />)
    await openScene()
    fireEvent.click(screen.getByRole('button', { name: 'Open current account version' }))
    fireEvent.change(screen.getByLabelText('Scene manuscript'), { target: { value: 'Keep the final tail after erasure.' } })
    mocks.novel.mockResolvedValue({ state: { ...emptyNovelLifecycle(), erased: true }, unavailable: false, unreadable: false })
    await act(async () => { notifyDeviceReads() })
    await act(async () => finish())
    expect(entered).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Scene manuscript')).toHaveValue('Keep the final tail after erasure.')
    expect(screen.getByLabelText('Scene manuscript')).toHaveAttribute('readonly')
    expect(documentText(readCheckpoint(draftJournalKey(scope.userHash, workspace.id, index.id, scene.id))!.document)).toBe('Keep the final tail after erasure.')
})

it('withholds a late list from a retired account and distinguishes blocked storage from an empty library', async () => {
    let resolve!: (value: Awaited<ReturnType<StudioReadStorage['list']>>) => void
    const storage = store(); vi.mocked(storage.list).mockImplementation(() => new Promise((done) => { resolve = done }))
    const view = render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={storage} />)
    mocks.current = false
    await act(async () => resolve({ items: [record()], unavailable: false, unreadable: 0, bytes: 2048 }))
    expect(screen.queryByText(/The Glass War/)).not.toBeInTheDocument()
    view.unmount(); mocks.current = true
    vi.mocked(storage.list).mockResolvedValue({ items: [], unavailable: true, unreadable: 0, bytes: 0 })
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={storage} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Device copies could not be read')
    expect(screen.queryByText(/No confirmed scenes/)).not.toBeInTheDocument()
})

it('keeps removed scenes as explicit earlier device copies and applies the workspace feature boundary', async () => {
    const saved = record(), removed = mergeCachedRead(scope, workspace, { ...index, structureRevision: 2, chapters: [] }, undefined, saved)!
    const privateWorkspace = { ...workspace, id: 'other-desk', name: 'Other desk', isDefault: false }
    const otherIndex = { ...index, organization: { workspace_id: privateWorkspace.id } }, other = mergeCachedRead(scope, privateWorkspace, otherIndex, studioSceneRead(otherIndex, scene), null)!
    const storage = store(); vi.mocked(storage.list).mockResolvedValue({ items: [removed, other], unavailable: false, unreadable: 0, bytes: 4096 })
    render(<NovelDeviceLibraryView initialOpen scope={scope} current={current} store={storage} allWorkspaces={false} />)
    expect(await screen.findByText('Earlier scene copies')).toBeInTheDocument()
    expect(screen.queryByText(/Other desk/)).not.toBeInTheDocument()
    await openScene()
    expect(screen.getByLabelText('Scene manuscript')).toHaveValue('The saved letter.')
    expect(screen.getByRole('button', { name: 'Open current account version' })).toBeDisabled()
})
