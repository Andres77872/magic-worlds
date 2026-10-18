import { expect,it } from 'vitest'
import { noteWrite } from '@/test/fixtures/storyAnnotations'
import { isAnnotationDraft,isAnnotationIntent,type AnnotationDraft } from './annotationJournal'

function draft():AnnotationDraft{return {storyId:'story-1',annotationId:'bookmark-1',kind:'bookmark',body:'Return here',sequence:0,mode:'create',
    selection:{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:9,endOffset:9,quote:''},baseRevision:null,originalBody:null}}
it('retains bounded point bookmark drafts without admitting point notes or unknown kind markers',()=>{
    const value=draft();expect(isAnnotationDraft(value)).toBe(true)
    expect(isAnnotationDraft({...value,body:''})).toBe(true)
    const {kind,...note}=value;expect(kind).toBe('bookmark')
    for(const patch of [note,{...value,kind:undefined},{...value,kind:'note'},{...value,kind:null},{...value,body:'🌒'.repeat(256)}])expect(isAnnotationDraft(patch)).toBe(false)
    expect(isAnnotationDraft({...value,body:'🌒'.repeat(255)})).toBe(true)
})
it('binds draft kind, exact selection and body to the immutable bookmark request while retaining old note intents',()=>{
    const value=draft(),operation={op:'create' as const,id:value.annotationId,body:value.body,anchor:value.selection!,kind:'bookmark' as const}
    const intent={storyId:'story-1',kind:'bookmark',write:{requestId:'bookmark-write',operation},draft:{schema:1,write:value}}
    expect(isAnnotationIntent(intent)).toBe(true)
    expect(isAnnotationIntent({storyId:'story-1',write:noteWrite()})).toBe(true)
    for(const patch of [{...intent,kind:'note'},{...intent,write:{...intent.write,operation:{...operation,kind:undefined}}},
        {...intent,draft:{schema:1,write:{...value,body:'A different label'}}},
        {...intent,write:{...intent.write,operation:{...operation,anchor:{...operation.anchor,startOffset:0,endOffset:0}}}}])expect(isAnnotationIntent(patch)).toBe(false)
})
it('requires an explicit bookmark kind for edits, state changes and attachment recovery',()=>{
    for(const operation of [{op:'edit',id:'bookmark-1',kind:'bookmark',body:'Changed label',expectedRevision:2},
        {op:'set_state',id:'bookmark-1',kind:'bookmark',state:'trashed',expectedRevision:2},
        {op:'reanchor',id:'bookmark-1',kind:'bookmark',anchor:draft().selection,expectedRevision:2,expectedAnchorVersion:3}]){
        const intent={storyId:'story-1',kind:'bookmark',write:{requestId:'bookmark-write',operation}}
        expect(isAnnotationIntent(intent)).toBe(true)
        expect(isAnnotationIntent({...intent,write:{...intent.write,operation:{...operation,kind:undefined}}})).toBe(false)
    }
})
