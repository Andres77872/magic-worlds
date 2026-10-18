import { beforeEach as beforeEachGrantedFeatures } from 'vitest'
import { setAllTestFeatureFlags as grantFixtureFeatures } from '@/shared/hooks/testing/featureFlagTestUtils'
beforeEachGrantedFeatures(() => grantFixtureFeatures(true))
import { setTestFeatureFlags } from '@/shared/hooks/testing/featureFlagTestUtils'
import { readFileSync } from 'node:fs'
import { verifyStoryStudioIndex } from './storyStudioContract'
import { createHash } from 'node:crypto'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import { apiService } from './index'
import { canonicalJson } from '@/utils/json'
import { assistantContextFixture } from '@/test/fixtures/storyAssistantContext'
import { isAssistantContextRequest,verifyAssistantContext,verifyFrozenAssistantContext } from './storyAssistantContextContract'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import type { StoryAssistantContext,StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'

const fetchMock=vi.fn()
beforeEach(()=>{setTestFeatureFlags({ novels: true });localStorage.setItem('magic_worlds:token','context-token');vi.stubGlobal('fetch',fetchMock);fetchMock.mockReset()})
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();localStorage.clear()})
it('verifies the actual Python packet, exact UTF-16 quote lengths, message bytes, citations and hash',()=>{
    const {index,request,result}=assistantContextFixture()
    expect(verifyAssistantContext(result,index,request)).toBe(true)
    expect(result.packet.sources.flatMap(s=>s.passages).some(p=>p.quote.includes('🌒'))).toBe(true)
    expect(createHash('sha256').update(canonicalJson(result.messages)).digest('hex')).toBe(result.packetHash)
    expect(result.trace.inputEstimate).toBe(new TextEncoder().encode(canonicalJson(result.messages)).length+64)
    expect(result.packet.conflicts).toHaveLength(1)
})
it('prepares an authenticated source-bound read in the captured workspace, without LLM or write authority',async()=>{
    const {index,request,result}=assistantContextFixture(),controller=new AbortController()
    fetchMock.mockResolvedValue(new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}}))
    expect(await apiService.withWorkspace('11111111-1111-4111-8111-111111111111').previewStoryAssistantContext(index,request,{signal:controller.signal})).toEqual(result)
    const [url,init]=fetchMock.mock.calls[0]
    expect(url).toContain('/stories/story-1/assistant-context');expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({'X-Workspace-Id':'11111111-1111-4111-8111-111111111111',Authorization:'Bearer context-token'})
    expect(JSON.parse(init.body)).toEqual(request);expect(JSON.parse(init.body)).not.toHaveProperty('llm')
    expect(fetchMock).toHaveBeenCalledOnce()
})
it('rejects changed identity, actual messages, source heads, policy, omissions and counter corruption',()=>{
    const {index,request,result}=assistantContextFixture()
    const corruptions=[
        {...result,storyId:'foreign'}, {...result,sourceVersion:'c'.repeat(64)}, {...result,request:{...request,message:'Other question'}},
        {...result,messages:[result.messages[0],{role:'user',content:'Other source text'}]},
        {...result,packet:{...result.packet,readOnly:undefined}},
        {...result,packet:{...result.packet,sources:[{...result.packet.sources[0],revision:99},...result.packet.sources.slice(1)]}},
        {...result,packet:{...result.packet,scope:'novel',sources:[...result.packet.sources,result.packet.sources[0]]}},
        {...result,trace:{...result.trace,excluded:[]}}, {...result,trace:{...result.trace,includedScenes:9}},
        {...result,trace:{...result.trace,inputEstimate:1}}, {...result,trace:{...result.trace,conflicts:[]}}, {...result,rawProviderPayload:{}},
    ]
    for(const corrupted of corruptions)expect(verifyAssistantContext(corrupted,index,request)).toBe(false)
    const changed=structuredClone(index);changed.chapters[0].scenes[0].metadataRevision++
    expect(verifyAssistantContext(result,changed,request)).toBe(false)
    expect(verifyAssistantContext(result,index,{...request,revealPolicy:'author_analysis'})).toBe(false)
})
it('rejects mutation fields, ambiguous selection, foreign explicit scenes and invalid budgets before sending',async()=>{
    const {index,request}=assistantContextFixture()
    for(const patch of [{llm:{}},{task:'apply'},{sceneIds:['scene-0']},{scope:'selection'},{message:' '},{limits:{...request.limits,maxSources:true}},{limits:{...request.limits,outputTokens:16000}}]){
        expect(isAssistantContextRequest({...request,...patch})).toBe(false)
    }
    await expect(apiService.previewStoryAssistantContext(index,{...request,sourceVersion:'c'.repeat(64)})).rejects.toMatchObject({code:'STORY_ASSISTANT_SOURCE_CHANGED'})
    expect(fetchMock).not.toHaveBeenCalled()
})
it('surfaces a malformed server packet without presenting a prepared result',async()=>{
    const {index,request,result}=assistantContextFixture()
    fetchMock.mockResolvedValue(new Response(JSON.stringify({...result,packetHash:'short'}),{status:200,headers:{'Content-Type':'application/json'}}))
    await expect(apiService.previewStoryAssistantContext(index,request)).rejects.toMatchObject({code:'story_assistant_context_contract'})
})

it.skipIf(!process.env.NOVEL_ASSISTANT_CONTEXT_PERSISTENCE)('guards actual retained MySQL/HTTP packets, bounded lexical ranking and archived workspace reads',()=>{
    const wire=JSON.parse(readFileSync(process.env.NOVEL_ASSISTANT_CONTEXT_PERSISTENCE!,'utf8'))
    expect(wire.projectDatabaseWrites).toBe(0)
    for(const row of wire.cases){
        expect(verifyStoryStudioIndex(row.index)).toBe(true)
        expect(isAssistantContextRequest(row.request)).toBe(true)
        expect(verifyAssistantContext(row.result,row.index,row.request)).toBe(true)
        expect(createHash('sha256').update(canonicalJson(row.result.messages)).digest('hex')).toBe(row.result.packetHash)
    }
})

it('refuses an inherited pin shadowed by a local pin even when the actual message and estimate agree',()=>{
    const {index,request,result}=assistantContextFixture()
    result.packet.cards.find(card=>card.referenceId==='root')!.appliesTo.push('scene-0')
    result.messages[1].content=canonicalJson(result.packet)
    result.trace.inputEstimate=new TextEncoder().encode(canonicalJson(result.messages)).length+64
    expect(verifyAssistantContext(result,index,request)).toBe(false)
})

it('verifies the Python style part and refuses a style the saved sheet does not give, even with matching messages and hash',async()=>{
    const wire=(await import('@/test/fixtures/storyAssistantContextStyle.json')).default as unknown as {index:StoryStudioIndex;request:StoryAssistantContextRequest;result:StoryAssistantContext}
    const {index,request}=wire
    expect(verifyStoryStudioIndex(index)).toBe(true);expect(isAssistantContextRequest(request)).toBe(true)
    expect(verifyAssistantContext(wire.result,index,request)).toBe(true)
    // The voice of a reference outside the novel is kept in the sheet but never sent.
    expect(wire.result.packet.style?.voices.map(voice=>voice.name)).toEqual(['Aria'])
    const signed=(edit:(result:StoryAssistantContext)=>void)=>{
        const result=structuredClone(wire.result);edit(result)
        result.messages[1].content=canonicalJson(result.packet)
        result.packetHash=createHash('sha256').update(canonicalJson(result.messages)).digest('hex')
        result.trace.inputEstimate=new TextEncoder().encode(canonicalJson(result.messages)).length+64
        return result
    }
    for(const edit of [
        (result:StoryAssistantContext)=>{delete result.packet.style},
        (result:StoryAssistantContext)=>{result.packet.style!.conventions[0].rule='Gray is fine.'},
        (result:StoryAssistantContext)=>{result.packet.style!.examples=[]},
        (result:StoryAssistantContext)=>{result.packet.style!.voices[0].name='Someone else'},
        (result:StoryAssistantContext)=>{result.trace.styleOmitted='all'},
        (result:StoryAssistantContext)=>{result.trace.styleOmitted='examples'},
    ])expect(verifyAssistantContext(signed(edit),index,request)).toBe(false)
    // Leaving the examples out for room is allowed when the trace says so.
    expect(verifyAssistantContext(signed((result)=>{result.packet.style!.examples=[];result.trace.styleOmitted='examples'}),index,request)).toBe(true)
    expect(verifyAssistantContext(signed((result)=>{delete result.packet.style;result.trace.styleOmitted='all'}),index,request)).toBe(true)
})

it('accepts saved reply preferences in the packet only in their exact shape',()=>{
    const {index,request,result}=assistantContextFixture()
    const signed=(preferences:unknown)=>{
        const value=structuredClone(result);(value.packet as {preferences?:unknown}).preferences=preferences
        value.messages[1].content=canonicalJson(value.packet)
        value.packetHash=createHash('sha256').update(canonicalJson(value.messages)).digest('hex')
        value.trace.inputEstimate=new TextEncoder().encode(canonicalJson(value.messages)).length+64
        return value
    }
    expect(verifyAssistantContext(signed({length:'brief',format:'lists',tone:'direct',replyLanguage:'novel',note:'Call me Sam.'}),index,request)).toBe(true)
    for(const bad of [{length:'brief'},{length:'endless',format:'lists',tone:'direct',replyLanguage:'novel',note:''},null])expect(verifyAssistantContext(signed(bad),index,request)).toBe(false)
})

it('reads, saves and clears the account reply preferences at the version read and checks every answer',async()=>{
    const preferences={length:'brief',format:'lists',tone:'direct',replyLanguage:'novel',note:'Sam'} as const
    const respond=(value:unknown,status=200)=>fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}}))
    respond({schemaVersion:1,preferences:null,version:0})
    expect(await apiService.getStoryAssistantPreferences()).toEqual({schemaVersion:1,preferences:null,version:0})
    respond({schemaVersion:1,preferences,version:1})
    expect((await apiService.saveStoryAssistantPreferences(preferences,0)).version).toBe(1)
    const [url,init]=fetchMock.mock.calls[1]
    expect(url).toContain('/stories/assistant-preferences');expect(init.method).toBe('PUT');expect(JSON.parse(init.body)).toEqual({preferences,expectedVersion:0})
    respond({schemaVersion:1,preferences:{...preferences,length:'detailed'},version:2})
    await expect(apiService.saveStoryAssistantPreferences(preferences,1)).rejects.toMatchObject({code:'story_assistant_preferences_contract'})
    respond({detail:{code:'STORY_ASSISTANT_PREFERENCES_CHANGED'}},409)
    await expect(apiService.saveStoryAssistantPreferences(preferences,1)).rejects.toMatchObject({status:409})
    respond({schemaVersion:1,preferences:null,version:0})
    await apiService.clearStoryAssistantPreferences(2)
    const [clearUrl,clearInit]=fetchMock.mock.calls[fetchMock.mock.calls.length-1]
    expect(clearUrl).toContain('/stories/assistant-preferences?expectedVersion=2');expect(clearInit.method).toBe('DELETE')
    const calls=fetchMock.mock.calls.length
    await expect(apiService.saveStoryAssistantPreferences({...preferences,tone:'rude'} as never,1)).rejects.toMatchObject({code:'story_assistant_preferences_request'})
    await expect(apiService.clearStoryAssistantPreferences(0)).rejects.toMatchObject({code:'story_assistant_preferences_request'})
    expect(fetchMock.mock.calls.length).toBe(calls)
})

it('verifies the Python summaries part and refuses summaries the saved outline does not give, even with matching messages and hash',async()=>{
    const wire=(await import('@/test/fixtures/storyAssistantContextSummaries.json')).default as unknown as {index:StoryStudioIndex;request:StoryAssistantContextRequest;result:StoryAssistantContext}
    const {index,request}=wire
    expect(verifyAssistantContext(wire.result,index,request)).toBe(true)
    expect(verifyFrozenAssistantContext(wire.result,index.id)).toBe(true)
    expect(wire.result.packet.summaries?.map(row=>row.sceneId)).toEqual(['scene-0'])
    expect(wire.result.trace.summaryExclusions).toEqual([{sceneId:'scene-1',reason:'stale'}])
    const signed=(edit:(result:StoryAssistantContext)=>void)=>{
        const result=structuredClone(wire.result);edit(result)
        result.messages[1].content=canonicalJson(result.packet)
        result.packetHash=createHash('sha256').update(canonicalJson(result.messages)).digest('hex')
        result.trace.inputEstimate=new TextEncoder().encode(canonicalJson(result.messages)).length+64
        return result
    }
    for(const edit of [
        (result:StoryAssistantContext)=>{delete result.packet.summaries},
        (result:StoryAssistantContext)=>{delete result.packet.summaries;result.trace.summaryExclusions!.unshift({sceneId:'scene-0',reason:'limit'})},
        (result:StoryAssistantContext)=>{result.packet.summaries![0].text='Aria is twelve.'},
        (result:StoryAssistantContext)=>{result.packet.summaries![0].revision+=1},
        (result:StoryAssistantContext)=>{result.packet.summaries!.push({sceneId:'scene-1',title:'Scene 1',revision:1,text:'Aria learns the gate.'});delete result.trace.summaryExclusions},
        (result:StoryAssistantContext)=>{result.trace.summaryExclusions![0].reason='unverified'},
        (result:StoryAssistantContext)=>{delete result.trace.summaryExclusions},
        (result:StoryAssistantContext)=>{result.packet.summaries!.push({sceneId:'scene-3',title:'Scene 3',revision:1,text:'A later secret.'})},
    ])expect(verifyAssistantContext(signed(edit),index,request)).toBe(false)
    // Leaving a current summary out for room is allowed when the trace says so.
    expect(verifyAssistantContext(signed(result=>{delete result.packet.summaries;result.trace.summaryExclusions!.unshift({sceneId:'scene-0',reason:'budget'})}),index,request)).toBe(true)
    for(const edit of [
        (result:StoryAssistantContext)=>{result.packet.summaries=[]},
        (result:StoryAssistantContext)=>{result.packet.summaries![0].sceneId=result.packet.sources[0].sceneId},
        (result:StoryAssistantContext)=>{result.packet.summaries![0].text='x'.repeat(4001)},
        (result:StoryAssistantContext)=>{result.trace.summaryExclusions=[]},
        (result:StoryAssistantContext)=>{result.trace.summaryExclusions![0].sceneId='scene-0'},
    ])expect(verifyFrozenAssistantContext(signed(edit),index.id)).toBe(false)
})

it('accepts reply summaries only for writable packet scenes at the revision, content and completeness they read',async()=>{
    const {verifyNovelAssistantRecord}=await import('./novelAssistantContract')
    const wire=(await import('@/test/fixtures/storyAssistantContextSummaries.json')).default as unknown as {index:StoryStudioIndex;result:StoryAssistantContext}
    const context=wire.result,source=context.packet.sources[0]
    const record=(summaries:unknown)=>({context,result:{schemaVersion:1,storyId:context.storyId,sourceVersion:context.sourceVersion,packetHash:context.packetHash,
        answer:'One scene.',citations:[],proposal:null,summaries}})
    const row={sceneId:source.sceneId,revision:source.revision,contentHash:source.contentHash,complete:source.complete,text:'The sealed letter waits.'}
    expect(verifyNovelAssistantRecord(record([row]),wire.index.id)).toBe(true)
    for(const bad of [[],[row,row],[{...row,revision:row.revision+1}],[{...row,complete:!row.complete}],[{...row,contentHash:'0'.repeat(64)}],
        [{...row,sceneId:'scene-0'}],[{...row,text:' padded '}],[{...row,text:'x'.repeat(2001)}],[{...row,saved:true}]])
        expect(verifyNovelAssistantRecord(record(bad),wire.index.id)).toBe(false)
})
