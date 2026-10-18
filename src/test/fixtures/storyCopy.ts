import type { StoryCopyAcknowledgement,StoryCopyPreview,StoryCopyProvenance,StoryCopyWrite } from '@/shared'
import { defaultStoryCopyOptions } from '@/infrastructure/api/storyCopyContract'

export const copyWrite=(patch:Partial<StoryCopyWrite>={}):StoryCopyWrite=>({requestId:'novel-copy-one',expectedSourceVersion:'a'.repeat(64),title:'Second draft',options:{...defaultStoryCopyOptions},...patch})
export const copyAck=(write=copyWrite()):StoryCopyAcknowledgement=>({kind:'novel_copy',requestId:write.requestId,sourceId:'story-1',storyId:'story-copy',sourceVersion:write.expectedSourceVersion,title:write.title,options:{...write.options},...(write.includeComments!==undefined?{includeComments:write.includeComments,sourceAnnotationRevision:write.sourceAnnotationRevision}:{})})
export function copyPreview(comments=false):StoryCopyPreview {
    const variants:StoryCopyPreview['variants']=[]
    for(const includeArchived of [false,true])for(const includeTrash of [false,true])for(const includeContext of [false,true])variants.push({includeArchived,includeTrash,includeContext,counts:{parts:0,chapters:1,scenes:1,references:includeContext?1:0}})
    return {sourceId:'story-1',sourceTitle:'The gate',sourceVersion:'a'.repeat(64),variants:comments?variants.map((variant)=>({...variant,comments:variant.includeTrash?4:3})):variants,...(comments?{annotationRevision:5}:{})}
}
export function copyProvenance():StoryCopyProvenance {
    return {schemaVersion:1,sourceId:'story-1',sourceTitle:'The gate',sourceVersion:'a'.repeat(64),createdAt:'2026-10-16T12:00:00Z',options:{...defaultStoryCopyOptions},counts:{parts:0,chapters:1,scenes:1,references:1},
        sourceRevisions:{metadataRevision:2,structureRevision:3,contextRevision:4,parts:[],chapters:[{id:'chapter-1',partId:null,metadataRevision:1}],scenes:[{id:'scene-1',chapterId:'chapter-1',title:'Opening',revision:7,metadataRevision:2,contentHash:'b'.repeat(64)}]},
        identityMap:{novel:{'story-1':'story-copy'},parts:{},chapters:{'chapter-1':'copy-chapter'},scenes:{'scene-1':'copy-scene'},references:{'ref-one':'copy-ref'},blocks:{'scene-1':{'block-1':'copy-block'}}}}
}
