import { useMemo, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AuthContext } from '@/app/providers/AuthProvider'
import { FloatingWindowsProvider } from '@/app/providers/FloatingWindowsProvider'
import { Button, Callout, PageHeader } from '@/ui/primitives'
import { scopedNovelMutationKey } from '@/shared/novelMutationJournal'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { manuscript } from '@/test/fixtures/story'
import { AUTHOR_VARIANT_DOMAIN, authorVariantIntent, newAuthorVariantDraft, writeAuthorVariantDraft } from '../persistence/authorVariantJournal'
import { deviceCacheScope, type StudioReadStorage } from '../persistence/studioReadStorage'
import { rememberDeviceWorkspaces } from '../persistence/deviceWorkspaceStorage'
import { rememberDeviceNovelErased, rememberDeviceNovelRoot, rememberDeviceNovelSource } from '../persistence/deviceNovelStorage'
import { NovelDeviceLibraryView } from './NovelDeviceLibrary'

const current = () => true
const emptyReads: StudioReadStorage = { list: async () => ({ items: [], bytes: 0, unavailable: false, unreadable: 0 }), remember: async () => ({ status: 'unavailable' }), subscribe: () => () => {} }
function PrivateDeviceRoom({ erased = false }: { erased?: boolean }) {
    const f = useMemo(() => authorVariantFixture(), []), account = deviceCacheScope('fictional-private-device-recovery-' + (erased ? 'erased' : 'active') + '-20261017')
    const workspace = { id: 'fictional-private-writing-desk', name: 'The writing desk', isDefault: true, archived: false, rowVersion: 1 }
    const scope = { ...account, workspaceId: workspace.id, storyId: f.context.parent.parent.storyId }
    const auth = { userHash: account.userHash, isAuthenticated: true, accountKey: account.userHash, sessionPhase: 'authenticated' } as NonNullable<ComponentProps<typeof AuthContext.Provider>['value']>
    const [notice, setNotice] = useState(''), [open, setOpen] = useState(false), [libraryEpoch, setLibraryEpoch] = useState(0)
    const retain = async () => {
        const value = { ...newAuthorVariantDraft(f.context, true), title: 'Private candlelight version', seeded: true,
            document: manuscript('The letter stayed sealed beside the candle.', 'private-device-candle'), anchorEdits: null }
        const pending = { kind: 'create' as const, sequence: value.sequence,
            write: { requestId: 'fictional-uncertain-version-request', reviewedHash: 'a'.repeat(64), intent: authorVariantIntent(value) } }
        const key = scopedNovelMutationKey(AUTHOR_VARIANT_DOMAIN, scope, f.generation.id, 'fictional-original-writer')!
        if (localStorage.getItem(key) === null && !writeAuthorVariantDraft(key, { ...value, pending })) { setNotice('The fictional device draft could not be retained.'); return }
        const workspaceResult = await rememberDeviceWorkspaces(account, [workspace])
        const novelResult = await rememberDeviceNovelSource(scope, { ...f.index, organization: { workspace_id: workspace.id } })
        if (erased) await rememberDeviceNovelErased(scope)
        setNotice('Fictional device recovery is ready. Workspace: ' + workspaceResult.status + '; novel: ' + novelResult.status + '. No manuscript cache was created.')
        setLibraryEpoch(epoch => epoch + 1); setOpen(true)
    }
    return <AuthContext.Provider value={auth}><FloatingWindowsProvider><div className="mx-auto max-w-4xl space-y-4 p-4">
        <PageHeader title="Private writing kept on this device" subtitle="Recover an authored suggestion without a cached novel." />
        <Callout>These controls retain only fictional browser records for this example. No account, API, model request or project database is used. Original uncertain requests stay separate from later device edits.</Callout>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => void retain()}>Retain fictional private draft</Button>
            <Button variant="secondary" onClick={() => { setLibraryEpoch(epoch => epoch + 1); setOpen(true) }}>Open device library</Button>
            <Button variant="secondary" onClick={() => void rememberDeviceWorkspaces(account, [{ ...workspace, rowVersion: 9, archived: true }])}>Archive workspace v9</Button>
            <Button variant="secondary" onClick={() => void rememberDeviceWorkspaces(account, [{ ...workspace, rowVersion: 8 }])}>Replay older active workspace v8</Button>
            <Button variant="secondary" onClick={() => void rememberDeviceWorkspaces(account, [{ ...workspace, rowVersion: 10 }])}>Restore workspace v10</Button>
            <Button variant="secondary" onClick={() => void rememberDeviceNovelRoot(scope, 20, true)}>Retain novel Trash v20</Button>
            <Button variant="secondary" onClick={() => void rememberDeviceNovelRoot(scope, 21, false)}>Restore novel v21</Button>
        </div>
        {notice && <p role="status">{notice}</p>}
        {open && <NovelDeviceLibraryView key={libraryEpoch} scope={account} current={current} store={emptyReads} initialOpen showEntry={false} />}
    </div></FloatingWindowsProvider></AuthContext.Provider>
}
const meta = { title: 'Novel/Private version device recovery', component: PrivateDeviceRoom, tags: ['autodocs'], args: { erased: false },
    parameters: { layout: 'fullscreen', docs: { description: { component: 'The real device library, native browser journals/lifecycle storage and private rich editor over fictional retained input. Ember marks author actions. No manuscript cache, account client, server mutation or model is present; this does not qualify real-account or assistive-technology acceptance.' } } },
} satisfies Meta<typeof PrivateDeviceRoom>
export default meta
type Story = StoryObj<typeof meta>
export const NativeDeviceRecovery: Story = {}
export const ErasedNovelRetainsPrivateWriting: Story = { args: { erased: true } }
