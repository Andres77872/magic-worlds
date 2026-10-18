import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { existsSync,readFileSync } from 'node:fs'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { isReplacementRequest,isReplacementWrite,verifyReplacementPreview,verifyReplacementAck } from './storyReplacementContract'
import { replacementAck,replacementPreview,replacementWrite } from '@/test/fixtures/storyReplacement'
import { replacementIntent,isReplacementIntent } from '@/features/novel/persistence/replacementJournal'
const fetchMock=vi.fn(),response=(value:unknown)=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}})
const preview=replacementPreview(),query=preview.operation.op==='replace'?preview.operation.preview:null!
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','replace-token');vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()})
it('binds bounded literal intent, previews and exact receipts in private POST bodies',async()=>{
    const write=replacementWrite(),ack=replacementAck(write)
    fetchMock.mockResolvedValueOnce(response(preview)).mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(ack)).mockResolvedValueOnce(response(null))
    const api=apiService.withWorkspace('11111111-1111-4111-8111-111111111111')
    expect(await api.previewStoryReplacement('story-1',query)).toEqual(preview)
    expect(await api.replaceStoryManuscript('story-1',write)).toEqual(ack)
    expect(await api.getStoryReplacementResult('story-1',write)).toEqual(ack)
    expect(await api.getStoryReplacementResult('story-1',write)).toBeNull()
    for(const [url,init] of fetchMock.mock.calls){expect(String(url)).not.toContain('gate');expect(init.method).toBe('POST');expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111',Authorization:'Bearer replace-token'})}
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(write)
})
it('rejects extra/private fields, duplicate or foreign targets, bad offsets, counts, fragments and echoed intent',()=>{
    expect(isReplacementRequest(query)).toBe(true);expect(isReplacementWrite(replacementWrite())).toBe(true)
    expect(verifyReplacementPreview(preview,'story-1',query)).toBe(true)
    for(const value of [{...preview,storyId:'other'},{...preview,document:{}},{...preview,canApply:false},{...preview,counts:{...preview.counts,changed:2}},
        {...preview,changes:[...preview.changes,...preview.changes]}, {...preview,changes:[{...preview.changes[0],quote:'near'}]},
        {...preview,changes:[{...preview.changes[0],proposed:[{type:'text',text:'WRONG'}]}]},
        {...preview,changes:[{...preview.changes[0],original:[{type:'text',text:'gate',marks:[{type:'script'}]}]}]},
        {...preview,operation:{op:'replace',preview:{...query,replacement:'different'}}},
        {...preview,scenes:[{...preview.scenes[0],sceneId:'foreign'}]}])expect(verifyReplacementPreview(value,'story-1',query)).toBe(false)
    expect(isReplacementRequest({...query,targets:[...query.targets,...query.targets]})).toBe(false)
    expect(isReplacementRequest({...query,replacement:'\ud800'})).toBe(false)
    expect(isReplacementWrite({...replacementWrite(),operation:{op:'replace',preview:{...query,document:{}}}})).toBe(false)
})
it('checks every reviewed scene hash and match before retaining a confirmed journal',()=>{
    const write=replacementWrite(),ack=replacementAck(write),intent=replacementIntent(preview,write.requestId)
    expect(verifyReplacementAck(ack,'story-1',write)).toBe(true);expect(isReplacementIntent({...intent,ack})).toBe(true)
    for(const value of [{...ack,originRequestId:'other'},{...ack,scenes:[]},{...ack,scenes:[{...ack.scenes[0],revision:4}]},{...ack,matches:[]},
        {...ack,matches:[{...ack.matches[0],position:5}]}])expect(verifyReplacementAck(value,'story-1',write)).toBe(false)
    expect(isReplacementIntent({...intent,ack:{...ack,scenes:[{...ack.scenes[0],contentHash:'e'.repeat(64)}]}})).toBe(false)
})
const wire=process.env.NOVEL_REPLACE_PERSISTENCE
it.skipIf(!wire||!existsSync(wire))('validates native ICU, protected preview, exact receipt, undo and redo HTTP/MySQL outputs',()=>{
    const value=JSON.parse(readFileSync(wire!,'utf8'))
    expect(verifyReplacementPreview(value.preview,value.storyId,value.previewRequest)).toBe(true)
    expect(verifyReplacementAck(value.ack,value.storyId,value.write)).toBe(true)
    expect(isReplacementIntent({...replacementIntent(value.preview,value.write.requestId),ack:value.ack})).toBe(true)
    const blockedRequest={...value.previewRequest,targets:value.blocked.changes.map(({sceneId,position}:{sceneId:string;position:number})=>({sceneId,position}))}
    expect(verifyReplacementPreview(value.blocked,value.storyId,blockedRequest)).toBe(true)
    for(const item of value.reversals){expect(verifyReplacementPreview(item.preview,value.storyId,{originRequestId:item.write.operation.originRequestId,direction:item.write.operation.direction})).toBe(true);expect(verifyReplacementAck(item.ack,value.storyId,item.write)).toBe(true);expect(isReplacementIntent({...replacementIntent(item.preview,item.write.requestId),ack:item.ack})).toBe(true)}
    expect(verifyReplacementPreview(value.sharpPreview,value.storyId,value.sharpRequest)).toBe(true)
})
