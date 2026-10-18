import { expect,it } from 'vitest'
import { authorVariantFixture } from '@/test/fixtures/authorVariants'
import { isNovelGenerationReference,isNovelRefinementReference,verifyNovelRefinement } from './novelRefinementContract'
import { isStoryVariantIntent } from './storyVariantContract'
import { refinementSourceReference,verifyNovelRefinementSource } from './variantRefinementContract'
import { verifyGenerationDetail } from './storyGenerationHistoryContract'

it('keeps a finite original parent and selects the exact authored version without broadening author-version creation',()=>{
    const f=authorVariantFixture(),source={...f.snapshot.parent,variant:f.snapshot},before=structuredClone(source)
    const reference=refinementSourceReference(source)
    expect(verifyNovelRefinementSource(source,f.index.id)).toBe(true)
    expect(verifyNovelRefinement(source,f.index.id)).toBe(false)
    expect(reference).toEqual({generationId:f.generation.id,parentHash:f.snapshot.parent.parentHash,variant:{id:f.snapshot.id,variantHash:f.snapshot.variantHash}})
    expect(isNovelRefinementReference(reference)).toBe(true)
    expect(isNovelGenerationReference(reference)).toBe(false)
    expect(isStoryVariantIntent({id:'another-version',title:'Another version',parent:reference,operation:{...f.snapshot.operation,id:'another-operation'}})).toBe(false)
    expect(source).toEqual(before)
})

it.each(['null','missingHash','nestedParent','differentOriginal','differentScene','extra'] as const)('rejects an invalid authored %s without stripping its version',change=>{
    const f=authorVariantFixture(),source:Record<string,unknown>={...structuredClone(f.snapshot.parent),variant:structuredClone(f.snapshot)}
    if(change==='null')source.variant=null
    if(change==='missingHash')delete (source.variant as Record<string,unknown>).variantHash
    if(change==='nestedParent')(source.variant as typeof f.snapshot).parent={...f.snapshot.parent,variant:f.snapshot} as typeof f.snapshot.parent
    if(change==='differentOriginal')source.parent={...f.snapshot.parent.parent,output:'Another original result.'}
    if(change==='differentScene')source.parent={...f.snapshot.parent.parent,sceneId:'another-scene'}
    if(change==='extra')source.implicitApply=true
    expect(verifyNovelRefinementSource(source,f.index.id)).toBe(false)
})

it('keeps generation-only wire references unchanged and refuses explicit empty authored references',()=>{
    const f=authorVariantFixture(),base=refinementSourceReference(f.snapshot.parent)
    expect(Object.keys(base)).toEqual(['generationId','parentHash'])
    for(const variant of [null,undefined,{}, {id:f.snapshot.id,variantHash:f.snapshot.variantHash,apply:true}])
        expect(isNovelRefinementReference({...base,variant})).toBe(false)
})

it('accepts a small history source reference and refuses opaque payloads or self-refinement',()=>{
    const f=authorVariantFixture(),reference=refinementSourceReference({...f.snapshot.parent,variant:f.snapshot})
    const value={...f.detail,generation:{...f.generation,id:'55555555-5555-4555-8555-555555555555',appliedRevision:null},refinementSource:reference}
    expect(verifyGenerationDetail(value,f.index.id,value.generation.id)).toBe(true)
    for(const ref of [null,{...reference,credentials:{}},{...reference,generationId:value.generation.id}])
        expect(verifyGenerationDetail({...value,refinementSource:ref},f.index.id,value.generation.id)).toBe(false)
})
