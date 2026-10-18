import { expect,it,vi } from 'vitest'
import type { ApiService } from '@/infrastructure/api'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { readVariantRefinement } from './novelRefinementTarget'

function setup(){
    const f=authorVariantFixture(),saved=structuredClone(f.record)
    let current=true
    const api={getStoryRefinementParent:vi.fn<ApiService['getStoryRefinementParent']>(async()=>structuredClone(f.snapshot.parent)),
        getStoryVariant:vi.fn<ApiService['getStoryVariant']>(async()=>saved),
        getStoryGenerationHistoryDetail:vi.fn<ApiService['getStoryGenerationHistoryDetail']>(async()=>f.detail),
        getStoryRevision:vi.fn<ApiService['getStoryRevision']>()}
    const controller=new AbortController()
    return {...f,saved,api,controller,retire:()=>{current=false},
        read:()=>readVariantRefinement({api,storyId:f.index.id,isCurrent:()=>current},f.record,controller.signal)}
}

it.each(['candidate','stashed','accepted','rejected'] as const)('quotes a %s authored source without adopting its old coordinates or application authority',async status=>{
    const f=setup(),before=structuredClone(f.record)
    f.saved.status=status;f.saved.appliedRevision=status==='accepted'?f.snapshot.operation.expectedRevision+1:null
    f.detail.generation.status=status
    const value=await f.read()
    expect(value).toEqual({refinement:{...f.snapshot.parent,variant:f.saved.variant},selection:null})
    expect(f.api.getStoryRevision).not.toHaveBeenCalled()
    expect(f.record).toEqual(before)
    if('variant'in value.refinement)value.refinement.variant.title='Detached view'
    expect(f.saved.variant.title).toBe(f.snapshot.title)
})

it.each(['hash','body','original','story','scene','location'] as const)('refuses changed %s without falling back to the original model output',async change=>{
    const f=setup(),before=structuredClone(f.record)
    if(change==='hash')f.saved.variant.variantHash='0'.repeat(64)
    if(change==='body')f.saved.variant.operation.document=f.snapshot.baseDocument
    if(change==='original')f.saved.variant.parent.parent.output='A different original.'
    if(change==='story')f.saved.storyId='another-novel'
    if(change==='scene')f.detail.generation.sceneId='another-scene'
    if(change==='location')f.detail.location='archived'
    await expect(f.read()).rejects.toMatchObject({code:'NOVEL_REFINEMENT_VARIANT_CHANGED'})
    expect(f.record).toEqual(before)
    expect(f.api.getStoryRevision).not.toHaveBeenCalled()
})

it.each(['abort','owner'] as const)('retires a late authored read after %s changes',async reason=>{
    const f=setup();let finish!:(v:typeof f.saved)=>void
    f.api.getStoryVariant.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const pending=f.read()
    if(reason==='abort')f.controller.abort();else f.retire()
    finish(f.saved)
    await expect(pending).rejects.toThrow()
})
