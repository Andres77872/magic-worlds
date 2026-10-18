import type { StoryAnnotation,StoryDocumentRevision } from '@/shared'
import type { AnnotationIntent } from '../persistence/annotationJournal'
import { annotationIntentKind } from '../persistence/annotationJournal'
import { resolveDocumentAnnotationRange } from '@/shared/storyAnnotationAnchors'

/** Verify a bookmark receipt's location before retiring its durable journal. */
export async function verifyBookmarkConfirmation(value:StoryAnnotation,intent:AnnotationIntent,checkpoint:(sceneId:string,revision:number,hash:string)=>Promise<StoryDocumentRevision>):Promise<boolean>{
    if((value.kind??'note')!==annotationIntentKind(intent))return false
    if(value.kind!=='bookmark')return true
    const op=intent.write.operation,ack=intent.ack
    if(!ack)return false
    const anchor=op.op==='create'?value.origin:op.op==='reanchor'&&value.anchorVersion===ack.anchorVersion?value.lastAnchor:null
    if(!anchor||op.op!=='create'&&op.op!=='reanchor')return true
    const selection=op.anchor
    if(anchor.sceneId!==selection.sceneId||anchor.revision!==selection.expectedRevision||anchor.contentHash!==selection.expectedContentHash||anchor.quote!==selection.quote)return false
    const source=await checkpoint(anchor.sceneId,anchor.revision,anchor.contentHash)
    if(source.sceneId!==anchor.sceneId||source.revision!==anchor.revision||source.contentHash!==anchor.contentHash)return false
    const range=resolveDocumentAnnotationRange(source.document,anchor)
    return range!==null&&range.startOffset===selection.startOffset&&range.endOffset===selection.endOffset&&range.text===selection.quote
}
