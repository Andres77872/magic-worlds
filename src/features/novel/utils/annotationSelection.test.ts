import { expect,it,vi } from 'vitest'
import { manuscript } from '@/test/fixtures/story'
import { currentRevisionScene } from '@/test/fixtures/storyRevisions'
import { captureAnnotationSelection,captureBookmarkSelection } from './annotationSelection'

function setup(){
    const saved=currentRevisionScene(),token={},editor={getDocument:()=>saved.document,getSelection:()=>({startOffset:0,endOffset:8,text:'The gate'}),getInstanceToken:()=>token,hasActiveSuggestion:()=>false}
    return {editor:()=>editor,sceneId:()=>'scene-1',isCurrent:()=>true,readOnly:()=>false,beforeWrite:vi.fn(async()=>true),savedScene:vi.fn(async()=>saved)}
}
it('binds the selected passage to the fresh saved revision without retargeting a later selection',async()=>{
    const context=setup(),editor=context.editor()
    context.beforeWrite.mockImplementation(async()=>{editor.getSelection=()=>({startOffset:9,endOffset:14,text:'opens'});return true})
    expect(await captureAnnotationSelection(context)).toEqual({sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:8,quote:'The gate'})
    expect(context.savedScene).toHaveBeenCalledWith('scene-1')
})
it('refuses an interrupted flush, AI review or archived source before preparing a note',async()=>{
    const context=setup();context.beforeWrite.mockResolvedValue(false)
    expect(await captureAnnotationSelection(context)).toBeNull();expect(context.savedScene).not.toHaveBeenCalled()
    const active=setup();active.editor().hasActiveSuggestion=()=>true
    expect(await captureAnnotationSelection(active)).toBeNull();expect(active.beforeWrite).not.toHaveBeenCalled()
    const archived=setup();archived.savedScene.mockResolvedValue({...currentRevisionScene(),status:'archived'})
    expect(await captureAnnotationSelection(archived)).toBeNull()
})
it('retains the draft for explicit selection after prose, scene, editor or account changes during a flush',async()=>{
    for(const change of ['prose','scene','editor','account'] as const){
        const context=setup()
        context.beforeWrite.mockImplementation(async()=>{
            if(change==='prose')context.editor().getDocument=()=>manuscript('Changed text.','current-gate')
            if(change==='scene')context.sceneId=()=>'scene-2'
            if(change==='editor'){const replacement={...context.editor(),getInstanceToken:()=>({})};context.editor=()=>replacement}
            if(change==='account')context.isCurrent=()=>false
            return true
        })
        expect(await captureAnnotationSelection(context),change).toBeNull()
    }
})
it('refuses a mismatched saved document or quote without searching other occurrences',async()=>{
    const context=setup();context.savedScene.mockResolvedValue({...currentRevisionScene(),document:manuscript('The gate opens again.','other-block')})
    expect(await captureAnnotationSelection(context)).toBeNull()
    const wrong=setup();wrong.editor().getSelection=()=>({startOffset:1,endOffset:9,text:'The gate'})
    expect(await captureAnnotationSelection(wrong)).toBeNull()
})
it('allows React to refresh the handle during a save when the same editor and exact document remain',async()=>{
    const context=setup()
    context.beforeWrite.mockImplementation(async()=>{const refreshed={...context.editor()};context.editor=()=>refreshed;return true})
    expect(await captureAnnotationSelection(context)).toMatchObject({sceneId:'scene-1',startOffset:0,endOffset:8,quote:'The gate'})
})

it('captures a frozen cursor bookmark against the exact saved document without enabling point notes',async()=>{
    const base=setup(),cursor={nodeId:'current-gate',offset:9}
    const handle={...base.editor(),getSelection:()=>null,getSplitCursor:()=>cursor},context={...base,editor:()=>handle}
    context.beforeWrite.mockImplementation(async()=>{cursor.offset=0;return true})
    expect(await captureBookmarkSelection(context)).toEqual({sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:9,endOffset:9,quote:''})
    expect(await captureAnnotationSelection(context)).toBeNull()
})

it('supports a saved empty-scene bookmark and rejects missing or unverifiable point identities',async()=>{
    for(const nodeId of ['empty','missing']){
        const base=setup(),saved={...currentRevisionScene(),document:manuscript('','empty')}
        const handle={...base.editor(),getDocument:()=>saved.document,getSelection:()=>null,getSplitCursor:()=>({nodeId,offset:0})}
        const context={...base,editor:()=>handle,savedScene:vi.fn(async()=>saved)}
        expect(await captureBookmarkSelection(context)).toEqual(nodeId==='empty'?{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:0,endOffset:0,quote:''}:null)
    }
})

it('keeps bookmark capture behind the same writer flush, ownership and editor identity checks as personal notes',async()=>{
    for(const change of ['blocked','account','editor','prose'] as const){
        const base=setup(),handle={...base.editor(),getSelection:()=>null,getSplitCursor:()=>({nodeId:'current-gate',offset:0})}
        const context={...base,editor:()=>handle}
        context.beforeWrite.mockImplementation(async()=>{
            if(change==='account')context.isCurrent=()=>false
            if(change==='editor')handle.getInstanceToken=()=>({})
            if(change==='prose')handle.getDocument=()=>manuscript('Changed prose','current-gate')
            return change!=='blocked'
        })
        expect(await captureBookmarkSelection(context),change).toBeNull()
    }
})
