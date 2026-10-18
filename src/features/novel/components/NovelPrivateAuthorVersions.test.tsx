import { createRef } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { scopedNovelMutationKey } from '@/shared/novelMutationJournal'
import { documentText } from '@/shared/storyDocument'
import { manuscript } from '@/test/fixtures/story'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { AUTHOR_VARIANT_DOMAIN, authorVariantIntent, newAuthorVariantDraft, readRetainedAuthorVariant, writeAuthorVariantDraft, type RetainedAuthorVariant } from '../persistence/authorVariantJournal'
import { novelLifecycleObservation } from '../persistence/novelDeviceLifecycle'
import { notifyDeviceReads } from '../persistence/deviceReadDatabase'
import { NovelPrivateAuthorVersions, type PrivateAuthorVersionsHandle } from './NovelPrivateAuthorVersions'

const mocks = vi.hoisted(() => ({ current: true, workspace: {} as unknown, novel: {} as unknown, download: vi.fn() }))
vi.mock('../persistence/deviceWorkspaceStorage', async original => ({ ...await original<typeof import('../persistence/deviceWorkspaceStorage')>(), listDeviceWorkspaces: async () => mocks.workspace }))
vi.mock('../persistence/deviceNovelStorage', async original => ({ ...await original<typeof import('../persistence/deviceNovelStorage')>(), readDeviceNovel: async () => mocks.novel }))
vi.mock('@/utils/download', async original => ({ ...await original<typeof import('@/utils/download')>(), downloadBlob: mocks.download }))
vi.mock('../editor/NovelEditor', () => ({ NovelEditor: ({ initialDocument, onDocumentChange, readOnly, aiDisabled }: {
    initialDocument: ReturnType<typeof manuscript>; onDocumentChange: (document: ReturnType<typeof manuscript>) => void; readOnly: boolean; aiDisabled: boolean;
}) => <textarea aria-label="Device private writing" defaultValue={documentText(initialDocument)} readOnly={readOnly} data-ai-disabled={String(aiDisabled)}
    onChange={event => onDocumentChange(manuscript(event.target.value))} /> }))

const scope = { apiOrigin: 'https://retained-writer.example', userHash: 'private-device-author' }, workspaceId = 'private-desk'
const current = () => mocks.current
function fixture(title = 'Private candlelight') {
    const f = authorVariantFixture(), value = { ...newAuthorVariantDraft(f.context, true), title, seeded: true }
    const draft = { ...value, pending: { kind: 'create' as const, sequence: 0,
        write: { requestId: 'uncertain-create-' + title.replace(/ /g, '-'), reviewedHash: 'a'.repeat(64), intent: authorVariantIntent(value) } } }
    const key = scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, { ...scope, workspaceId, storyId: value.storyId }, f.generation.id, title)!
    writeAuthorVariantDraft(key, draft)
    const state = novelLifecycleObservation({ ...f.index, organization: { workspace_id: workspaceId } }, workspaceId)!
    expect(state).not.toBeNull()
    mocks.novel = { state, unavailable: false, unreadable: false }
    return { ...f, draft, key, state }
}
async function inspect(title?: string) {
    const target = title ? within(screen.getByText(title).parentElement!.parentElement!).getByRole('button', { name: 'Inspect private draft' }) : screen.getByRole('button', { name: 'Inspect private draft' })
    await act(async () => { fireEvent.click(target) })
}
async function begin() {
    const button = screen.getByRole('button', { name: 'Continue in a separate device copy' })
    await waitFor(() => expect(button).toBeEnabled())
    await act(async () => { fireEvent.click(button) })
}
beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks(); mocks.current = true
    mocks.workspace = { states: { [workspaceId]: { id: workspaceId, name: 'Writing desk', isDefault: true, archived: false, rowVersion: 1 } }, unreadableIds: [], unreadable: 0, unavailable: false }
})
afterEach(() => { vi.restoreAllMocks() })

it('finds private writing without a cached novel, keeps model output separate and downloads the frozen request', async () => {
    const f = fixture(), before = localStorage.getItem(f.key)
    render(<NovelPrivateAuthorVersions scope={scope} current={current} />)
    await inspect()
    expect(screen.getByLabelText('Device private writing')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Device private writing')).toHaveAttribute('data-ai-disabled', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Original model result' }))
    expect(screen.getByText(f.generation.output)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download private draft' }))
    expect(mocks.download.mock.calls[0][1]).toBe('Private-candlelight.json')
    const file = mocks.download.mock.calls[0][0] as Blob
    const raw = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(file) })
    expect(JSON.parse(raw).write.pending).toEqual(f.draft.pending)
    expect(localStorage.getItem(f.key)).toBe(before)
})

it('keeps later device writing and the original request through monotonic workspace archive and restore', async () => {
    const f = fixture(), ref = createRef<PrivateAuthorVersionsHandle>(), original = localStorage.getItem(f.key)
    render(<NovelPrivateAuthorVersions ref={ref} scope={scope} current={current} />)
    await inspect(); await begin()
    fireEvent.change(screen.getByLabelText('Device private writing'), { target: { value: 'Private text across archive and restore.' } })
    const workspace = (rowVersion: number, archived: boolean) => ({ states: { [workspaceId]: { id: workspaceId, name: 'Writing desk', isDefault: true, rowVersion, archived } }, unreadableIds: [], unreadable: 0, unavailable: false })
    mocks.workspace = workspace(9, true)
    await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(screen.getByLabelText('Device private writing')).toHaveAttribute('readonly'))
    expect(screen.getByLabelText('Device private writing')).toHaveValue('Private text across archive and restore.')
    mocks.workspace = workspace(8, false); await act(async () => { notifyDeviceReads() })
    expect(screen.getByLabelText('Device private writing')).toHaveAttribute('readonly')
    mocks.workspace = workspace(10, false); await act(async () => { notifyDeviceReads() })
    await waitFor(() => expect(screen.getByLabelText('Device private writing')).not.toHaveAttribute('readonly'))
    act(() => { expect(ref.current!.preserve()).toBe(true) })
    expect(localStorage.getItem(f.key)).toBe(original)
    const other = Object.keys(localStorage).find(key => key !== f.key)!
    expect(readRetainedAuthorVariant(other, scope)?.record.write.pending).toEqual(f.draft.pending)
})

it('keeps an erased novel’s private text readable and downloadable while blocking edits and account return', async () => {
    const f = fixture(), open = vi.fn(async () => {})
    mocks.novel = { state: { ...f.state, erased: true }, unavailable: false, unreadable: false }
    render(<NovelPrivateAuthorVersions scope={scope} current={current} canOpenAccount={() => true} onOpenAccount={open} />)
    await inspect()
    await screen.findByText('The novel was erased. Its private device writing remains readable and downloadable; returning it to that novel is paused.')
    expect(screen.getByRole('button', { name: 'Continue in a separate device copy' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Open novel to recover' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Download writing as Markdown' }))
    expect(mocks.download.mock.calls[0][1]).toBe('Private-candlelight.md')
    expect(open).not.toHaveBeenCalled()
    expect(localStorage.getItem(f.key)).not.toBeNull()
})

it('retains the final keystroke in memory and blocks leaving when a device copy cannot be checkpointed', async () => {
    fixture(); const ref = createRef<PrivateAuthorVersionsHandle>()
    render(<NovelPrivateAuthorVersions ref={ref} scope={scope} current={current} />)
    await inspect(); await begin()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    fireEvent.change(screen.getByLabelText('Version name'), { target: { value: 'Final private keystroke' } })
    act(() => { expect(ref.current!.preserve()).toBe(false) })
    fireEvent.click(screen.getByRole('button', { name: 'Back to private drafts' }))
    expect(screen.getByLabelText('Version name')).toHaveValue('Final private keystroke')
    expect(screen.getByRole('button', { name: 'Download private draft' })).toBeEnabled()
})

it('passes the explicitly selected writer to Studio even when another writer is newer', async () => {
    const first = fixture('Selected older draft'), other = fixture('Newer other draft'), resume = vi.fn((item: RetainedAuthorVariant) => Boolean(item.record))
    for (const [key, writtenAt] of [[first.key, 1], [other.key, 2]] as const) {
        const record = JSON.parse(localStorage.getItem(key)!); localStorage.setItem(key, JSON.stringify({ ...record, writtenAt }))
    }
    render(<NovelPrivateAuthorVersions scope={scope} current={current} onResumeInStudio={resume} />)
    await inspect('Selected older draft')
    fireEvent.click(screen.getByRole('button', { name: 'Resume this copy in Studio' }))
    expect(resume.mock.calls[0][0].record.storageKey).toBe(first.key)
    expect(resume.mock.calls[0][0].record.write.title).toBe('Selected older draft')
})

it('does not expose the old account’s opened private writing after a scope change', async () => {
    fixture(); const view = render(<NovelPrivateAuthorVersions scope={scope} current={current} />)
    await inspect()
    view.rerender(<NovelPrivateAuthorVersions scope={{ ...scope, userHash: 'another-author' }} current={current} />)
    expect(screen.queryByLabelText('Device private writing')).not.toBeInTheDocument()
    expect(screen.queryByText('Private candlelight')).not.toBeInTheDocument()
})

it('does not finish an account handoff after its owner has retired', async () => {
    fixture(); let finish!: () => void
    const opened = vi.fn(), open = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    const view = render(<NovelPrivateAuthorVersions scope={scope} current={current} canOpenAccount={() => true} onOpenAccount={open} onAccountOpened={opened} />)
    await inspect()
    fireEvent.click(screen.getByRole('button', { name: 'Open novel to recover' }))
    expect(open).toHaveBeenCalledOnce()
    mocks.current = false
    view.rerender(<NovelPrivateAuthorVersions scope={scope} current={current} canOpenAccount={() => true} onOpenAccount={open} onAccountOpened={opened} />)
    await act(async () => { finish() })
    expect(opened).not.toHaveBeenCalled()
})

it('keeps account access paused offline while local private continuation remains available', async () => {
    fixture(); vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    const open = vi.fn(async () => {})
    render(<NovelPrivateAuthorVersions scope={scope} current={current} canOpenAccount={() => true} onOpenAccount={open} />)
    await inspect(); await begin()
    expect(screen.getByRole('button', { name: 'Open novel to recover' })).toBeDisabled()
    expect(screen.getByLabelText('Device private writing')).not.toHaveAttribute('readonly')
    expect(open).not.toHaveBeenCalled()
})

it('hides a non-default workspace’s opened writing when the feature changes to default-only', async () => {
    fixture()
    mocks.workspace = { states: { [workspaceId]: { id: workspaceId, name: 'Another desk', isDefault: false, archived: false, rowVersion: 1 } }, unreadableIds: [], unreadable: 0, unavailable: false }
    const view = render(<NovelPrivateAuthorVersions scope={scope} current={current} allWorkspaces />)
    await inspect()
    view.rerender(<NovelPrivateAuthorVersions scope={scope} current={current} allWorkspaces={false} />)
    await waitFor(() => expect(screen.queryByLabelText('Device private writing')).not.toBeInTheDocument())
})

it('exports malformed matching data losslessly, including an unpaired UTF-16 unit, without creating a manuscript or request', async () => {
    const f = fixture(), raw = '{unreadable private fragment' + '\ud800'; localStorage.setItem(f.key, raw)
    render(<NovelPrivateAuthorVersions scope={scope} current={current} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download unreadable draft 1' }))
    expect(mocks.download).toHaveBeenCalledOnce()
    expect(screen.queryByLabelText('Device private writing')).not.toBeInTheDocument()
    const file = mocks.download.mock.calls[0][0] as Blob
    const exported = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(file) })
    expect(JSON.parse(exported)).toEqual({ schema: 1, kind: 'unverified_private_version', storageKey: f.key, raw })
    expect(localStorage.getItem(f.key)).toBe(raw)
})
