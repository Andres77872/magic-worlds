import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { verifyStoryStructureAcknowledgement } from './storyContract'
import { verifyStoryStructureHistory,verifyStoryStructureRevision } from './storyHistoryContract'
import { historyDetail,historyPage } from '@/test/fixtures/storyHistory'
const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','history-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('reads paginated filtered history and one checkpoint through the owned workspace',async()=>{
    fetchMock.mockResolvedValueOnce(response(historyPage())).mockResolvedValueOnce(response(historyDetail()))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.getStoryStructureRevisions('story-1',{before:4,action:'move',fromDate:'2026-10-01',throughDate:'2026-10-16'})).toEqual(historyPage())
    expect(await api.getStoryStructureRevision('story-1',3)).toEqual(historyDetail())
    expect(String(fetchMock.mock.calls[0][0])).toContain('/structure/revisions?before=4&action=move&from_date=2026-10-01&through_date=2026-10-16')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/structure/revisions/3')
    for(const [,init] of fetchMock.mock.calls)expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111','Authorization':'Bearer history-token'})
})
it('rejects foreign, unordered, partial or private history contracts',async()=>{
    expect(verifyStoryStructureHistory({...historyPage(),storyId:'another-story'},'story-1')).toBe(false)
    expect(verifyStoryStructureHistory({...historyPage(),items:[...historyPage().items,...historyPage().items]},'story-1')).toBe(false)
    expect(verifyStoryStructureHistory({...historyPage(),nextBefore:3},'story-1')).toBe(false)
    expect(verifyStoryStructureHistory({...historyPage(),undo:{revision:4,operationRevision:4,action:'move'}},'story-1')).toBe(false)
    expect(verifyStoryStructureRevision({...historyDetail(),before:null},'story-1',3)).toBe(false)
    expect(verifyStoryStructureRevision({...historyDetail(),operation:{op:'move',_before:{}}},'story-1',3)).toBe(false)
    fetchMock.mockResolvedValueOnce(response({...historyDetail(),after:{...historyDetail().after,structureRevision:2}}))
    await expect(apiService.getStoryStructureRevision('story-1',3)).rejects.toMatchObject({code:'story_contract'})
})
it('requires the exact undo/redo request receipt before accepting success or recovery',async()=>{
    const write={requestId:'undo-1',expectedStructureRevision:3,operation:{op:'undo_structure' as const,revision:3,sourceStructureRevision:3}}
    const ack={structureRevision:4,selectedId:'scene-1',history:{storyId:'story-1',requestId:write.requestId,operation:write.operation,operationRevision:3}}
    fetchMock.mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack))
    expect(await apiService.changeStoryStructure('story-1',write)).toEqual(ack)
    expect(await apiService.getStoryStructureResult('story-1',write)).toEqual(ack)
    expect(verifyStoryStructureAcknowledgement({...ack,history:{...ack.history,operation:{...write.operation,revision:2}}},3,{storyId:'story-1',write})).toBe(false)
    expect(verifyStoryStructureAcknowledgement({structureRevision:4,selectedId:'scene-1'},3,{storyId:'story-1',write})).toBe(false)
})
const pagePath='/tmp/novel-history-smoke-page.json',detailPath='/tmp/novel-history-smoke-detail.json'
const receiptPath='/tmp/novel-history-smoke-receipt.json'
it.skipIf(!existsSync(pagePath)||!existsSync(detailPath)||!existsSync(receiptPath))('accepts the actual isolated MySQL history page, detail and exact receipt',()=>{
    const page=JSON.parse(readFileSync(pagePath,'utf-8')),detail=JSON.parse(readFileSync(detailPath,'utf-8'))
    expect(verifyStoryStructureHistory(page,page.storyId)).toBe(true)
    expect(verifyStoryStructureRevision(detail,detail.storyId,detail.revision)).toBe(true)
    const {storyId,write,ack}=JSON.parse(readFileSync(receiptPath,'utf-8'))
    expect(verifyStoryStructureAcknowledgement(ack,write.expectedStructureRevision,{storyId,write})).toBe(true)
})
