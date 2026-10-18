import {expect,it,vi} from 'vitest'
import type {ApiService} from '@/infrastructure/api'
import type {StoryAnnotationSelection} from '@/shared'
import type {NovelRefinementContext} from '@/shared/types/storyAssistant.types'
import {novelAssistantReviewFixture} from '@/test/fixtures/novelAssistantReview'
import {sceneRevision} from '@/test/fixtures/storyRevisions'
import {manuscript} from '@/test/fixtures/story'
import refined from '@/test/fixtures/novelAssistantRefinement.json'
import {readGenerationRefinement} from './novelRefinementTarget'

function setup(){
    const fixture=novelAssistantReviewFixture(),generation=structuredClone(fixture.detail.generation)
    const parent=structuredClone(refined.parent) as unknown as NovelRefinementContext
    const revision=sceneRevision({storyId:fixture.index.id,sceneId:generation.sceneId,revision:generation.baseRevision!,parentRevision:null,
        document:fixture.scene.document,contentHash:fixture.scene.contentHash})
    let current=true
    const api={getStoryRefinementParent:vi.fn<ApiService['getStoryRefinementParent']>(async()=>parent),
        getStoryGenerationHistoryDetail:vi.fn<ApiService['getStoryGenerationHistoryDetail']>(async()=>fixture.detail),
        getStoryRevision:vi.fn<ApiService['getStoryRevision']>(async()=>revision)}
    const controller=new AbortController(),context={api,storyId:fixture.index.id,isCurrent:()=>current}
    const read=(selection:StoryAnnotationSelection|null=null)=>readGenerationRefinement(context,generation,controller.signal,selection)
    return {...fixture,generation,parent,revision,api,controller,context,read,retire:()=>{current=false}}
}

it('binds an original ranged suggestion to its exact immutable checkpoint, even when it covered the whole old scene',async()=>{
    const f=setup(),before=structuredClone(f.generation)
    const result=await f.read()
    expect(result).toEqual({refinement:f.parent,selection:{sceneId:f.generation.sceneId,expectedRevision:f.generation.baseRevision,
        expectedContentHash:f.revision.contentHash,startOffset:0,endOffset:25,quote:'The sealed letter waited.'}})
    expect(f.api.getStoryRevision).toHaveBeenCalledExactlyOnceWith(f.index.id,f.generation.sceneId,1,undefined,{signal:f.controller.signal})
    expect(f.generation).toEqual(before)
    result.refinement.parent.output+=' Detached copy.'
    expect(f.parent.parent.output).toBe(before.output)
})

it('keeps the inspected target immutable while its owned readers are pending',async()=>{
    const f=setup(),before=structuredClone(f.generation)
    const pending=f.read()
    f.generation.output='A newer list entry.'
    expect((await pending).refinement.parent.output).toBe(before.output)
    expect(f.generation.output).toBe('A newer list entry.')
})

it.each(['continue','rewrite'] as const)('keeps an unranged %s target without reading an unrelated checkpoint',async command=>{
    const f=setup()
    for(const g of [f.generation,f.detail.generation]){g.command=command;g.inputRange=null}
    Object.assign(f.parent.parent,{command,range:null})
    expect((await f.read()).selection).toBeNull()
    expect(f.api.getStoryRevision).not.toHaveBeenCalled()
})

it('uses an explicitly captured current passage without silently substituting an old target',async()=>{
    const f=setup(),selection:StoryAnnotationSelection={sceneId:f.generation.sceneId,expectedRevision:9,expectedContentHash:'d'.repeat(64),startOffset:5,endOffset:10,quote:'other'}
    expect((await f.read(selection)).selection).toEqual(selection)
    expect(f.api.getStoryRevision).not.toHaveBeenCalled()
})

it('refuses a selection from another scene instead of silently falling back to the old quote',async()=>{
    const f=setup()
    await expect(f.read({sceneId:'another-scene',expectedRevision:9,expectedContentHash:'d'.repeat(64),startOffset:0,endOffset:5,quote:'Other'}))
        .rejects.toMatchObject({code:'NOVEL_REFINEMENT_PARENT_CHANGED'})
    expect(f.api.getStoryRevision).not.toHaveBeenCalled()
})

it('retains a large original range without truncating it or widening its failed selection',async()=>{
    const f=setup(),text='a'.repeat(20_001)
    f.generation.inputRange=f.detail.generation.inputRange={startOffset:0,endOffset:text.length,text}
    f.parent.parent.range={startOffset:0,endOffset:text.length,textHash:'a'.repeat(64)}
    f.api.getStoryRevision.mockResolvedValue(sceneRevision({...f.revision,document:manuscript(text)}))
    await expect(f.read()).rejects.toMatchObject({code:'NOVEL_REFINEMENT_PARENT_CHANGED'})
    expect(f.generation.inputRange.text).toBe(text)
})

it('retains UTF-16 offsets for the second occurrence of a repeated Unicode quote',async()=>{
    const f=setup(),text='🌒 same · 🌒 same',startOffset=text.lastIndexOf('🌒'),endOffset=text.length
    f.generation.inputRange=f.detail.generation.inputRange={startOffset,endOffset,text:'🌒 same'}
    f.parent.parent.range={startOffset,endOffset,textHash:'a'.repeat(64)}
    f.api.getStoryRevision.mockResolvedValue(sceneRevision({...f.revision,document:manuscript(text)}))
    expect((await f.read()).selection).toMatchObject({startOffset,endOffset,quote:'🌒 same'})
})

it.each(['critique','foreign'] as const)('rejects a cached %s before any reader is used',async invalid=>{
    const f=setup()
    if(invalid==='foreign')f.generation.storyId='another-book'
    else if(invalid==='critique')f.generation.command='critique'
    await expect(f.read()).rejects.toMatchObject({code:'NOVEL_REFINEMENT_PARENT_CHANGED'})
    expect(f.api.getStoryRefinementParent).not.toHaveBeenCalled()
})

it.each(['location','output','instruction','revision','scene','range','parent'] as const)('refuses a changed owned %s without replacing the saved writing',async invalid=>{
    const f=setup(),before=structuredClone(f.generation)
    if(invalid==='location')f.detail.location='archived'
    if(invalid==='output')f.detail.generation.output+=' Changed.'
    if(invalid==='instruction')f.detail.generation.instruction='Different instruction'
    if(invalid==='revision')f.detail.generation.baseRevision=99
    if(invalid==='scene')f.detail.generation.sceneId='another-scene'
    if(invalid==='range')f.detail.generation.inputRange=null
    if(invalid==='parent')f.parent.parent.output+=' Changed.'
    await expect(f.read()).rejects.toMatchObject({code:'NOVEL_REFINEMENT_PARENT_CHANGED'})
    expect(f.api.getStoryRevision).not.toHaveBeenCalled()
    expect(f.generation).toEqual(before)
})

it.each(['accepted','rejected'] as const)('reads %s original writing as quoted input while retaining its exact old selection',async status=>{
    const f=setup();f.generation.status=status;f.detail.generation.status=status
    expect((await f.read()).refinement).toEqual(f.parent)
    expect(f.detail.generation.status).toBe(status)
})

it.each(['quote','revision','scene','schema'] as const)('keeps a missing or corrupt original %s from widening the target',async invalid=>{
    const f=setup()
    if(invalid==='quote')f.api.getStoryRevision.mockResolvedValue(sceneRevision({...f.revision,document:manuscript('Different writing.')}))
    if(invalid==='revision')f.revision.revision=99
    if(invalid==='scene')f.revision.sceneId='another-scene'
    if(invalid==='schema')f.revision.schemaVersion=99
    await expect(f.read()).rejects.toMatchObject({code:'NOVEL_REFINEMENT_PARENT_CHANGED'})
})

it.each(['abort','owner'] as const)('fences a late checkpoint after an %s change',async change=>{
    const f=setup();let finish!:(value:typeof f.revision)=>void
    f.api.getStoryRevision.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const pending=f.read()
    await vi.waitFor(()=>expect(f.api.getStoryRevision).toHaveBeenCalledOnce())
    if(change==='abort')f.controller.abort();else f.retire()
    finish(f.revision)
    await expect(pending).rejects.toThrow()
})
