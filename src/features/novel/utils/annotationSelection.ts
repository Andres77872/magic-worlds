import type { StoryAnnotationSelection,StorySceneDocument } from '@/shared'
import { documentSignature,documentText } from '@/shared/storyDocument'
import { resolveAnnotationRange } from '@/shared/storyAnnotationAnchors'
import type { NovelEditorHandle } from '../editor/types'

interface Capture {
    editor:()=>Pick<NovelEditorHandle,'getDocument'|'getSelection'|'getInstanceToken'|'hasActiveSuggestion'>&Partial<Pick<NovelEditorHandle,'getSplitCursor'>>|null
    sceneId:()=>string|null;isCurrent:()=>boolean;readOnly:()=>boolean
    beforeWrite:()=>Promise<boolean>;savedScene:(sceneId:string)=>Promise<StorySceneDocument>
}
/** Freeze the selected target before flushing, then prove it matches the saved head. */
export async function captureAnnotationSelection(context:Capture):Promise<StoryAnnotationSelection|null>{
    return capture(context,false)
}
/** A bookmark may identify a saved passage or one exact stable cursor point. */
export async function captureBookmarkSelection(context:Capture):Promise<StoryAnnotationSelection|null>{
    return capture(context,true)
}
async function capture(context:Capture,bookmark:boolean):Promise<StoryAnnotationSelection|null>{
    if(!context.isCurrent()||context.readOnly())return null
    const editor=context.editor(),sceneId=context.sceneId()
    if(!editor||!sceneId||editor.hasActiveSuggestion())return null
    const token=editor.getInstanceToken()
    if(!token)return null
    const document=editor.getDocument(),selection=editor.getSelection()
    const rawCursor=!selection&&bookmark?editor.getSplitCursor?.():null,cursor=rawCursor?{...rawCursor}:null
    if(!document||(!selection&&!cursor)||selection&&(!bookmark&&!selection.text.trim()||Array.from(selection.text).length>20_000))return null
    const signature=documentSignature(document)
    if(!await context.beforeWrite()||!context.isCurrent()||context.readOnly())return null
    const saved=await context.savedScene(sceneId)
    const latest=context.editor()
    if(!context.isCurrent()||context.readOnly()||context.sceneId()!==sceneId||!latest||latest.getInstanceToken()!==token||latest.hasActiveSuggestion())return null
    const after=latest.getDocument()
    if(!after||saved.id!==sceneId||saved.inheritance?.readOnly||saved.status==='archived'||saved.trashedAt||documentSignature(after)!==signature||documentSignature(saved.document)!==signature)return null
    if(!selection&&cursor){
        const range=resolveAnnotationRange(saved,{schemaVersion:1,sceneId,revision:saved.revision,contentHash:saved.contentHash,start:cursor,end:cursor,quote:''})
        return range?{sceneId,expectedRevision:saved.revision,expectedContentHash:saved.contentHash,startOffset:range.startOffset,endOffset:range.endOffset,quote:''}:null
    }
    if(!selection)return null
    const {startOffset,endOffset,text}=selection
    if(!Number.isSafeInteger(startOffset)||!Number.isSafeInteger(endOffset)||startOffset<0||endOffset<=startOffset||documentText(saved.document).slice(startOffset,endOffset)!==text)return null
    return {sceneId,expectedRevision:saved.revision,expectedContentHash:saved.contentHash,startOffset,endOffset,quote:text}
}
