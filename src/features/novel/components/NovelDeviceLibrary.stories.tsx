import { useState, type ContextType } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button, Callout } from '@/ui/primitives'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { studioIndex, studioSceneRead } from '@/test/fixtures/storyStudio'
import { deviceCacheScope, studioReadStorage, mergeCachedRead, type StudioReadStorage } from '../persistence/studioReadStorage'
import { NovelDeviceLibraryView } from './NovelDeviceLibrary'
import { proveNativeDeviceCache } from '@/test/fixtures/novelDeviceNativeProof'
import { proveNativeWorkspaceLifecycle } from '@/test/fixtures/novelWorkspaceNativeProof'
import { listDeviceWorkspaces, rememberDeviceWorkspaces } from '../persistence/deviceWorkspaceStorage'

const userHash = 'novel-device-cache-fixture-r13'
const workspace = { id: 'novel-device-fixture-desk', name: 'The writing room', isDefault: true, archived: false }
const scene = storyScene({ id: 'novel-device-fixture-scene', title: 'The sealed letter', document: manuscript('Mara turned the letter toward the candle. The seal was still warm.', 'device-fixture-letter') })
const index = studioIndex(novel({ title: 'The glass archivist', organization: { workspace_id: workspace.id }, chapters: [storyChapter({ title: 'A message after midnight', scenes: [scene] })] }))
const read = studioSceneRead(index, scene)
const auth = { userHash, accountKey: 'novel-device-fixture-owner', isAuthenticated: true, sessionPhase: 'authenticated', openLoginModal: () => {} } as ContextType<typeof AuthContext>
const data = {} as ContextType<typeof DataContext>
const current = () => true

function DeviceCopies({ native = false, unavailable = false, archived = false, lifecycle = false }: { native?: boolean; unavailable?: boolean; archived?: boolean; lifecycle?: boolean }) {
    const [notice, setNotice] = useState<string | null>(null)
    const actor = lifecycle ? userHash + '-workspace-lifecycle' : userHash, actorScope = deviceCacheScope(actor)
    const observed = { ...workspace, archived, ...(lifecycle ? { isDefault: false, rowVersion: 1 } : {}) }
    const saved = mergeCachedRead(actorScope, observed, index, read, null)!
    const memory: StudioReadStorage = { list: async () => ({ items: unavailable ? [] : [saved], unavailable, unreadable: 0, bytes: 4096 }), remember: async () => ({ status: 'saved' }), subscribe: () => () => {} }
    const retainWorkspace = async (rowVersion: number, archived: boolean) => {
        const result = await rememberDeviceWorkspaces(actorScope, [{ ...observed, rowVersion, archived }])
        const known = await listDeviceWorkspaces(actorScope)
        setNotice('Workspace observation: ' + JSON.stringify({ status: result.status, known: known.states[workspace.id] }))
    }
    return <AuthContext.Provider value={lifecycle ? { ...auth!, userHash: actor, accountKey: actor + ':owner' } : auth}><DataContext.Provider value={data}><FloatingWindowsProvider>
        <div className="space-y-4 p-4">
            <Callout>Fictional device copies. This fixture has no account client, provider calls or server writes. The native variant retains only its own fictional author’s browser copies and drafts.</Callout>
            {native && <Button variant="secondary" onClick={() => void studioReadStorage.remember(actorScope, observed, index, read).then((result) => setNotice('Native confirmed read: ' + result.status))}>Retain fictional scene</Button>}
            {native && <Button variant="secondary" onClick={() => { setNotice('Checking native transactions and allowance…'); void proveNativeDeviceCache().then((result) => setNotice('Native checks passed: ' + JSON.stringify(result))).catch((error: unknown) => setNotice('Native check failed: ' + String(error))) }}>Verify native cache</Button>}
            {lifecycle && <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => void retainWorkspace(9, true)}>Retain archived workspace v9</Button>
                <Button variant="secondary" onClick={() => void retainWorkspace(8, false)}>Retain older active workspace v8</Button>
                <Button variant="secondary" onClick={() => void retainWorkspace(10, false)}>Retain restored workspace v10</Button>
                <Button variant="secondary" onClick={() => { setNotice('Checking native workspace retention…'); void proveNativeWorkspaceLifecycle().then((result) => setNotice('Native workspace checks passed: ' + JSON.stringify(result))).catch((error: unknown) => setNotice('Native workspace check failed: ' + String(error))) }}>Verify native workspace retention</Button>
            </div>}
            {notice && <p role="status">{notice}</p>}
            <NovelDeviceLibraryView scope={actorScope} current={current} store={native ? studioReadStorage : memory} initialOpen={!native} />
        </div>
    </FloatingWindowsProvider></DataContext.Provider></AuthContext.Provider>
}
const meta = { title: 'Novel/Device copies', component: DeviceCopies, tags: ['autodocs'], parameters: {
    layout: 'padded', docs: { description: { component: 'Explicit author-owned device entry using the canonical editor and its existing local queue. Ember marks author actions; AI and server operations are paused. Native storage is opt-in through a button and uses only a fictional account namespace.' } },
} } satisfies Meta<typeof DeviceCopies>
export default meta
type Story = StoryObj<typeof meta>
export const CachedScene: Story = {}
export const Archived: Story = { args: { archived: true } }
export const StorageUnavailable: Story = { args: { unavailable: true } }
export const NativeReloadRecovery: Story = { args: { native: true } }
export const NativeWorkspaceLifecycle: Story = { args: { native: true, lifecycle: true } }
