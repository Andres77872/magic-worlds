import type { StoryReplacementAck,StoryReplacementPreview,StoryReplacementWrite } from '@/shared/types/storyReplacement.types'
export function replacementPreview(patch:Partial<StoryReplacementPreview>={}):StoryReplacementPreview {
    return {schemaVersion:1,kind:'manuscript_replace_preview',algorithm:'canonical-inline-literal-v1',storyId:'story-1',sourceSnapshot:'b'.repeat(64),
        sourceStructureRevision:1,sourceMetadataRevision:1,sourceContextRevision:1,previewHash:'c'.repeat(64),
        operation:{op:'replace',preview:{q:'gate',caseSensitive:false,includeArchived:false,sourceSnapshot:'b'.repeat(64),replacement:'Door',targets:[{sceneId:'scene-1',position:4}]}},
        scenes:[{sceneId:'scene-1',title:'Scene 1',revision:1,metadataRevision:1,contentHash:'a'.repeat(64),targetHash:'d'.repeat(64),changed:1}],
        changes:[{sceneId:'scene-1',position:4,startOffset:4,endOffset:8,quote:'gate',replacement:'Door',reason:null,original:[{type:'text',text:'gate',marks:[{type:'italic'}]}],proposed:[{type:'text',text:'Door',marks:[{type:'italic'}]}]}],
        counts:{selected:1,changed:1,blocked:0,unchanged:0,scenes:1},canApply:true,...patch}
}
export function replacementWrite(review=replacementPreview(),requestId='replace-original'):StoryReplacementWrite {
    return {requestId,previewHash:review.previewHash,operation:review.operation}
}
export function replacementAck(write=replacementWrite(),review=replacementPreview()):StoryReplacementAck {
    return {kind:'manuscript_replace',algorithm:'canonical-inline-literal-v1',storyId:review.storyId,write,originRequestId:write.operation.op==='replace'?write.requestId:write.operation.originRequestId,
        scenes:review.scenes.filter((item)=>item.changed>0).map((item)=>({sceneId:item.sceneId,fromRevision:item.revision,fromHash:item.contentHash,revision:item.revision+1,contentHash:item.targetHash,changed:item.changed})),
        matches:write.operation.op==='replace'?review.changes.filter((item)=>item.reason===null).map(({sceneId,position,startOffset,endOffset,quote})=>({sceneId,position,startOffset,endOffset,quote})):[]}
}
