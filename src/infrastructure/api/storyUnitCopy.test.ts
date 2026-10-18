import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { unitCopyStory } from '@/test/fixtures/storyUnitCopy'
import { defaultStoryCopyOptions } from '@/shared/storyCopyOptions'
import { unitCopyOperation } from '@/shared/storyUnitCopy'
import { verifyStory,verifyStoryStructureAcknowledgement } from './storyContract'
const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
const operation=unitCopyOperation(unitCopyStory(),'chapter','chapter-1','Another gate',{...defaultStoryCopyOptions})!
const write={requestId:'chapter-copy',expectedStructureRevision:8,operation}
const ack={structureRevision:9,selectedId:'fresh-chapter',copy:{requestId:write.requestId,storyId:'story-1',operation}}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','unit-copy-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('sends reviewed source heads/options and recovers an exact acknowledgement with an owned GET',async()=>{
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(null))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.changeStoryStructure('story-1',write)).toEqual(ack)
    expect(await api.getStoryStructureResult('story-1',write)).toEqual(ack)
    expect(await api.getStoryStructureResult('story-1',{...write,requestId:'absent'})).toBeNull()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(write)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/stories/story-1/structure-requests/chapter-copy')
    expect(fetchMock.mock.calls[1][1].method??'GET').toBe('GET')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111','Authorization':'Bearer unit-copy-token'})
})
it('rejects a partial or mismatched copy confirmation instead of retiring the pending intent',async()=>{
    fetchMock.mockResolvedValueOnce(response({structureRevision:9,selectedId:'fresh-chapter'}))
    await expect(apiService.changeStoryStructure('story-1',write)).rejects.toMatchObject({code:'story_contract'})
    fetchMock.mockResolvedValueOnce(response({...ack,copy:{...ack.copy,operation:{...operation,options:{...operation.options,includeNotes:false}}}}))
    await expect(apiService.getStoryStructureResult('story-1',write)).rejects.toMatchObject({code:'story_contract'})
})
const receiptPath='/tmp/novel-unit-copy-smoke-receipt.json',storyPath='/tmp/novel-unit-copy-smoke-story.json'
const annotationReceipt='/tmp/novel-annotations-smoke-unit-copy.json'
it.skipIf(!existsSync(annotationReceipt))('accepts the actual guarded comment-copy operation and immutable receipt',()=>{
    const {storyId,write,ack}=JSON.parse(readFileSync(annotationReceipt,'utf-8'))
    expect(write.operation.includeComments).toBe(true)
    expect(verifyStoryStructureAcknowledgement(ack,write.expectedStructureRevision,{storyId,write})).toBe(true)
    const changed={...ack,copy:{...ack.copy,operation:{...ack.copy.operation,sourceAnnotationRevision:write.operation.sourceAnnotationRevision+1}}}
    expect(verifyStoryStructureAcknowledgement(changed,write.expectedStructureRevision,{storyId,write})).toBe(false)
})
it.skipIf(!existsSync(receiptPath)||!existsSync(storyPath))('accepts the actual isolated unit copy receipt and full manuscript',()=>{
    const {storyId,write,ack}=JSON.parse(readFileSync(receiptPath,'utf-8'))
    expect(verifyStoryStructureAcknowledgement(ack,write.expectedStructureRevision,{storyId,write})).toBe(true)
    expect(verifyStory(JSON.parse(readFileSync(storyPath,'utf-8')),storyId)).toBe(true)
})
