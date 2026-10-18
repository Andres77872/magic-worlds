import { generateUUID } from '@/utils/uuid'
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import type { StoryManuscriptDocument } from '@/shared'
import { Button, Callout } from '@/ui/primitives'
import { manuscript, storyScene } from '@/test/fixtures/story'
import type { SceneConflictReview } from '../hooks/useSceneDraft'
import { NovelSceneConflictModal } from './NovelSceneConflictModal'
import { NovelRetainedSceneDrafts } from './NovelRetainedSceneDrafts'
import { StudioStatusStrip } from './StudioStatusStrip'
import { ManuscriptProse } from './ManuscriptProse'
import { proveNativeReviewProgress } from '@/test/fixtures/novelReviewNativeProof'
import { NovelSavedSceneReviews } from './NovelSavedSceneReview'
import {proveNativeRejectedApplication} from '@/test/fixtures/novelApplicationNativeProof'

const pair = (first: string, second: string): StoryManuscriptDocument => {
    const value = manuscript(first, 'gate')
    value.content.content!.push(...manuscript(second, 'letter').content.content!)
    return value
}
const base = pair('The gate stood open.', 'A letter waited by the window.')
const device = pair('The gate had been barred from inside.', 'A letter waited by the window.')
const account = pair('Someone had broken the gate.', 'Mara recognized the seal.')
const reviewed: SceneConflictReview = { id: 'controlled-reconciliation', ownerKey: 'fictional-author/workspace/scene', sequence: 1,
    baseDocument: base, deviceDocument: device, deviceTitle: 'The sealed letter',
    account: storyScene({ id: 'controlled-scene', storyId: 'controlled-novel', title: 'The sealed letter', revision: 2, document: account }) }

function ReconnectReview({ readOnly = false, storageFailure = false, missingBase = false, durable = false }: { readOnly?: boolean; storageFailure?: boolean; missingBase?: boolean; durable?: boolean }) {
    const [open, setOpen] = useState(true), [chosen, setChosen] = useState<StoryManuscriptDocument | null>(null)
    const [retentionFailed, setRetentionFailed] = useState(false)
    const [nativeId] = useState(() => 'native-review-' + generateUUID()), [nativeResult, setNativeResult] = useState<string | null>(null)
    return <div className="space-y-4 p-4">
        <Callout tone="warning">The account scene changed while this fictional device was offline. Review both versions before synchronizing.</Callout>
        <Button variant="secondary" onClick={() => setOpen(true)}>Compare device and account</Button>
        {durable && <Button variant="secondary" onClick={() => { setNativeResult('Checking native review persistence…'); void proveNativeReviewProgress().then((result) => setNativeResult('Native review checks passed: ' + JSON.stringify(result))).catch((error: unknown) => setNativeResult('Native review check failed: ' + String(error))) }}>Verify native review journal</Button>}
        {nativeResult && <p role="status">{nativeResult}</p>}
        {durable && <NovelSavedSceneReviews scope={{ apiOrigin: 'https://novel-review-fixture.example', userHash: 'native-review-reload-fixture' }} current={() => true} allWorkspaces onCheckpointState={() => {}} />}
        <StudioStatusStrip words={24} goal={null} saveState={chosen ? 'saved' : 'conflict'} lastSavedAt={null} onSetGoal={() => {}} onRetrySave={() => {}} readOnly />
        <NovelSceneConflictModal open={open} review={durable ? { ...reviewed, id: nativeId, recoveryScope: { apiOrigin: 'https://novel-review-fixture.example', userHash: 'native-review-reload-fixture', workspaceId: 'native-review-desk' } } : missingBase ? { ...reviewed, baseDocument: null } : reviewed} readOnly={readOnly}
            retentionFailed={retentionFailed} onClose={() => setOpen(false)} onRefresh={async () => {}}
            onResolve={(choice, candidate) => {
                if (storageFailure) { setRetentionFailed(true); return false }
                setChosen(choice === 'local' ? device : choice === 'server' ? account : candidate!.document)
                setOpen(false); return true
            }} />
        {chosen && <><Callout tone="success">The reviewed version is visible below. This fixture performs no account or storage writes.</Callout><ManuscriptProse document={chosen} />
            <NovelRetainedSceneDrafts items={[{ schema: 1, title: 'The sealed letter', document: device, baseRevision: 1, baseMetadataRevision: 1,
                retainedAt: 1, reason: 'reconciliation', storageKey: 'controlled-device-copy' }]} /></>}
    </div>
}
function RejectedApplication() {
    const [open,setOpen]=useState(true),[retained,setRetained]=useState(false)
    const [native,setNative]=useState<string|null>(null)
    const applicationRejection={reason:'sources_changed' as const,generationId:'fictional-unapplied-suggestion',
        write:{requestId:'fictional-accept',expectedRevision:1,document:pair('A proposed watchman barred the gate.','A letter waited by the window.')}}
    return <div className="space-y-4 p-4"><Button variant="secondary" onClick={()=>setOpen(true)}>Review unapplied suggestion</Button>
        <Button variant="secondary" onClick={()=>{setNative('Checking native rejected-application recovery…');void proveNativeRejectedApplication().then(result=>setNative('Native rejected-application checks passed: '+JSON.stringify(result))).catch(error=>setNative('Native rejected-application checks failed: '+String(error)))}}>Verify native rejected-application recovery</Button>
        {native&&<p role="status">{native}</p>}
        {retained&&<Callout tone="info" role="status">Controlled example: the device version and suggestion identity remain separate; the current account writing is shown. No request was sent.</Callout>}
        {retained&&<ManuscriptProse document={account} />}
        <NovelSceneConflictModal open={open} review={{...reviewed,applicationRejection}} onClose={()=>setOpen(false)} onRefresh={async()=>{}}
            onResolve={choice=>{if(choice!=='server')return false;setRetained(true);setOpen(false);return true}} />
    </div>
}
const meta = { title: 'Novel/Offline reconciliation', component: ReconnectReview, tags: ['autodocs'],
    parameters: { layout: 'padded', docs: { description: { component: 'Controlled rich manuscript review and retained-copy recovery. Ordinary variants keep choices in React state. NativeReviewReload deliberately retains fictional review choices in IndexedDB and offers opt-in native preservation checks; no variant calls an account API, provider or project database.' } } },
} satisfies Meta<typeof ReconnectReview>
export default meta
type Story = StoryObj<typeof meta>
export const RejectedSuggestion:Story={render:()=> <RejectedApplication />}
export const ConflictingBlocks: Story = {}
export const Archived: Story = { args: { readOnly: true } }
export const StorageUnavailable: Story = { args: { storageFailure: true } }
export const OriginalBaseUnavailable: Story = { args: { missingBase: true } }
export const NativeReviewReload: Story = { args: { durable: true } }
