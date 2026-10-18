import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifyStoryStructureAcknowledgement } from './storyContract'
import { verifySnapshotRestorePreview } from './storySnapshotContract'
import { verifyStoryStructureRevision } from './storyHistoryContract'
import { snapshotRestoreOptions,snapshotRestorePreview } from '@/test/fixtures/storySnapshots'
import type { StorySnapshotRestoreOperation } from '@/shared'

const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','restore-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
const operation=():StorySnapshotRestoreOperation=>({op:'restore_snapshot',snapshotId:3,manifestHash:'d'.repeat(64),expectedSourceVersion:'c'.repeat(64),sourceStructureRevision:5,options:snapshotRestoreOptions()})
it('binds a read-only restore preview to the owned snapshot and exact selected options',async()=>{
    const preview=snapshotRestorePreview(),options=snapshotRestoreOptions()
    fetchMock.mockResolvedValueOnce(response(preview))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.previewStorySnapshotRestore('story-1',3,options)).toEqual(preview)
    const [url,init]=fetchMock.mock.calls[0]
    expect(String(url)).toContain('/stories/story-1/snapshots/3/restore-preview')
    expect(init.method).toBe('POST');expect(JSON.parse(init.body)).toEqual(options)
    expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111','Authorization':'Bearer restore-token'})
})
it('requires an exact restore receipt for both initial confirmation and uncertain recovery',async()=>{
    const op=operation(),write={requestId:'restore-1',expectedStructureRevision:5,operation:op}
    const ack={structureRevision:6,selectedId:'scene-1',restore:{requestId:write.requestId,storyId:'story-1',operation:op,snapshotId:3,manifestHash:op.manifestHash,sourceVersion:op.expectedSourceVersion,counts:snapshotRestorePreview().counts}}
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack))
    expect(await apiService.changeStoryStructure('story-1',write)).toEqual(ack)
    expect(await apiService.getStoryStructureResult('story-1',write)).toEqual(ack)
    for(const restore of [{...ack.restore,snapshotId:4},{...ack.restore,manifestHash:'f'.repeat(64)},{...ack.restore,operation:{...op,options:{...op.options,laterUnits:'trash'}}}]){
        expect(verifyStoryStructureAcknowledgement({...ack,restore},5,{storyId:'story-1',write})).toBe(false)
    }
    expect(verifyStoryStructureAcknowledgement({structureRevision:6,selectedId:null},5,{storyId:'story-1',write})).toBe(false)
})
it('rejects omitted author changes, hidden deletion, wrong options and inconsistent blockers',()=>{
    const preview=snapshotRestorePreview(),options=snapshotRestoreOptions()
    expect(verifySnapshotRestorePreview(preview,'story-1',3,options)).toBe(true)
    expect(verifySnapshotRestorePreview({...preview,changes:[]},'story-1',3,options)).toBe(false)
    expect(verifySnapshotRestorePreview({...preview,target:{...preview.target,chapters:[]}},'story-1',3,options)).toBe(false)
    expect(verifySnapshotRestorePreview({...preview,options:{...options,details:false}},'story-1',3,options)).toBe(false)
    expect(verifySnapshotRestorePreview({...preview,blockers:[{code:'STORY_PENDING_PROPOSAL',ids:['scene-1']}]},'story-1',3,options)).toBe(false)
    const rewound=structuredClone(preview);rewound.target.chapters[0].scenes[0].revision=1
    expect(verifySnapshotRestorePreview(rewound,'story-1',3,options)).toBe(false)
})
it('keeps restore review behind the novels flag',async()=>{
    setTestFeatureFlags({ novels: false })
    await expect(apiService.previewStorySnapshotRestore('story-1',3,snapshotRestoreOptions())).rejects.toThrow('Novels are disabled.')
    expect(fetchMock).not.toHaveBeenCalled()
})
const files=['preview','receipt','history'].map((name)=>'/tmp/novel-restore-smoke-'+name+'.json')
it.skipIf(files.some((path)=>!existsSync(path)))('verifies actual isolated MySQL restore review, receipt and retained history',()=>{
    const [preview,receipt,history]=files.map((path)=>JSON.parse(readFileSync(path,'utf-8')))
    expect(verifySnapshotRestorePreview(preview,receipt.storyId,receipt.write.operation.snapshotId,receipt.write.operation.options)).toBe(true)
    expect(verifyStoryStructureAcknowledgement(receipt.ack,receipt.write.expectedStructureRevision,{storyId:receipt.storyId,write:receipt.write})).toBe(true)
    expect(verifyStoryStructureRevision(history,receipt.storyId,receipt.ack.structureRevision)).toBe(true)
})
