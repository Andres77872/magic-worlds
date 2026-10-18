import { useState, type ContextType } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { DataContext } from '@/app/providers/DataProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button, Callout } from '@/ui/primitives'
import { manuscript, novel, storyChapter, storyScene } from '@/test/fixtures/story'
import { studioIndex, studioSceneRead } from '@/test/fixtures/storyStudio'
import { proveNativeNovelLifecycle } from '@/test/fixtures/novelLifecycleNativeProof'
import { deviceCacheScope, studioReadStorage } from '../persistence/studioReadStorage'
import { readDeviceNovel, rememberDeviceNovel, rememberDeviceNovelErased, rememberDeviceNovelRoot, rememberDeviceNovelSource } from '../persistence/deviceNovelStorage'
import { emptyNovelLifecycle } from '../persistence/novelDeviceLifecycle'
import { NovelDeviceLibraryView } from './NovelDeviceLibrary'

const actor = 'novel-unit-device-fixture-20261017', scope = { ...deviceCacheScope(actor), workspaceId: 'unit-device-desk', storyId: 'unit-device-novel' }
const workspace = { id: scope.workspaceId, name: 'The writing room', isDefault: false, archived: false, rowVersion: 1 }
const scene = storyScene({ id: 'unit-device-scene', chapterId: 'unit-device-chapter', storyId: scope.storyId, title: 'The sealed letter', document: manuscript('Mara waited beside the unopened letter.', 'unit-device-letter') })
const source = studioIndex(novel({ id: scope.storyId, title: 'The glass archivist', organization: { workspace_id: scope.workspaceId }, chapters: [storyChapter({ id: scene.chapterId, storyId: scope.storyId, scenes: [scene] })] }))
const auth = { userHash: actor, accountKey: actor + ':owner', isAuthenticated: true, sessionPhase: 'authenticated', openLoginModal: () => {} } as ContextType<typeof AuthContext>
const data = {} as ContextType<typeof DataContext>
const current = () => true
function NativeLifecycle() {
    const [notice, setNotice] = useState('Fictional author; every action below uses device storage only.')
    const run = async (action: Promise<{ status: string }>) => { const result = await action; setNotice(JSON.stringify({ result, known: (await readDeviceNovel(scope)).state })) }
    return <AuthContext.Provider value={auth}><DataContext.Provider value={data}><FloatingWindowsProvider>
        <div className="space-y-4 p-4">
            <Callout>Fictional novel lifecycle. No account client, provider or project database operation is available.</Callout>
            <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => void run(studioReadStorage.remember(scope, workspace, source, studioSceneRead(source, scene)).then(async (result) => { await rememberDeviceNovelSource(scope, source); return result }))}>Retain fictional novel</Button>
                <Button variant="secondary" onClick={() => void run(rememberDeviceNovelRoot(scope, 9, true))}>Retain novel Trash v9</Button>
                <Button variant="secondary" onClick={() => void run(rememberDeviceNovelRoot(scope, 8, false))}>Retain older active novel v8</Button>
                <Button variant="secondary" onClick={() => void run(rememberDeviceNovelRoot(scope, 10, false))}>Retain restored novel v10</Button>
                <Button variant="secondary" onClick={() => void run(rememberDeviceNovel(scope, { ...emptyNovelLifecycle(), units: { [scene.chapterId]: { revision: 9, readOnly: true } } }))}>Retain archived chapter v9</Button>
                <Button variant="secondary" onClick={() => void run(rememberDeviceNovel(scope, { ...emptyNovelLifecycle(), units: { [scene.chapterId]: { revision: 10, readOnly: false } } }))}>Retain restored chapter v10</Button>
                <Button variant="secondary" onClick={() => void run(rememberDeviceNovelErased(scope))}>Retain fictional erase confirmation</Button>
                <Button variant="secondary" onClick={() => { setNotice('Checking native novel lifecycle…'); void proveNativeNovelLifecycle().then((result) => setNotice('Native novel checks passed: ' + JSON.stringify(result))).catch((error: unknown) => setNotice('Native novel check failed: ' + String(error))) }}>Verify native novel lifecycle</Button>
            </div>
            <p role="status">{notice}</p>
            <NovelDeviceLibraryView scope={scope} current={current} />
        </div>
    </FloatingWindowsProvider></DataContext.Provider></AuthContext.Provider>
}
const meta = { title: 'Novel/Device lifecycle', component: NativeLifecycle, tags: ['autodocs'], parameters: { layout: 'padded' } } satisfies Meta<typeof NativeLifecycle>
export default meta
type Story = StoryObj<typeof meta>
export const NativeNovelLifecycle: Story = {}
