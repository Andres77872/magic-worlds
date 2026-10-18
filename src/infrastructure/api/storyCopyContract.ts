import type { StoryCopyAcknowledgement,StoryCopyCounts,StoryCopyPreview,StoryCopyProvenance,StoryCopyWrite } from '@/shared/types/story.types'
import { defaultStoryCopyOptions,isStoryCopyOptions,isStoryCommentCopyChoice,storyCopyOptionKeys as optionKeys } from '@/shared/storyCopyOptions'
export { defaultStoryCopyOptions,isStoryCopyOptions }

const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every((k)=>Object.prototype.hasOwnProperty.call(v,k))
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=64&&v===v.trim()
const title=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=255&&v===v.trim()
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const revision=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0
const annotationFields=(v:Record<string,unknown>)=>['includeComments','includeBookmarks','sourceAnnotationRevision'].filter((key)=>Object.prototype.hasOwnProperty.call(v,key))
export function isStoryCopyWrite(v:unknown):v is StoryCopyWrite {
    return record(v)&&isStoryCommentCopyChoice(v)&&exact(v,['requestId','expectedSourceVersion','title','options',...annotationFields(v)])
        &&typeof v.requestId==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(v.requestId)&&hash(v.expectedSourceVersion)&&title(v.title)&&isStoryCopyOptions(v.options)
}
function counts(v:unknown):v is StoryCopyCounts {
    return record(v)&&exact(v,['parts','chapters','scenes','references'])&&Object.values(v).every((n)=>Number.isSafeInteger(n)&&Number(n)>=0)
}
export function verifyStoryCopyPreview(v:unknown,sourceId:string):v is StoryCopyPreview {
    if(!record(v)||!exact(v,['sourceId','sourceTitle','sourceVersion','variants',...('annotationRevision' in v?['annotationRevision']:[])])||v.sourceId!==sourceId||!title(v.sourceTitle)||!hash(v.sourceVersion)||!Array.isArray(v.variants)||v.variants.length!==8||'annotationRevision' in v&&!revision(v.annotationRevision))return false
    const seen=new Set<string>()
    const first=v.variants[0],metrics=record(first)?['comments','bookmarks'].filter((key)=>key in first):[]
    if(('annotationRevision' in v)!==(metrics.length>0))return false
    return v.variants.every((item)=>{
        if(!record(item)||!exact(item,['includeArchived','includeTrash','includeContext','counts',...metrics])||!counts(item.counts)||metrics.some((key)=>!Number.isSafeInteger(item[key])||Number(item[key])<0)
            ||!['includeArchived','includeTrash','includeContext'].every((key)=>typeof item[key]==='boolean'))return false
        const key=JSON.stringify([item.includeArchived,item.includeTrash,item.includeContext])
        if(seen.has(key))return false
        seen.add(key);return true
    })
}
export function verifyStoryCopyAcknowledgement(v:unknown,sourceId:string,write:StoryCopyWrite):v is StoryCopyAcknowledgement {
    if(!record(v)||!isStoryCopyOptions(v.options))return false
    const options=v.options
    return record(v)&&isStoryCommentCopyChoice(v)&&exact(v,['kind','requestId','storyId','sourceId','sourceVersion','title','options',...annotationFields(write as unknown as Record<string,unknown>)])&&v.kind==='novel_copy'
        &&id(v.storyId)&&v.storyId!==sourceId&&v.sourceId===sourceId&&v.requestId===write.requestId&&v.sourceVersion===write.expectedSourceVersion
        &&v.title===write.title&&optionKeys.every((key)=>options[key]===write.options[key])&&v.includeComments===write.includeComments&&v.includeBookmarks===write.includeBookmarks&&v.sourceAnnotationRevision===write.sourceAnnotationRevision
}
export function verifyStoryCopyProvenance(v:unknown,storyId:string):v is StoryCopyProvenance {
    if(!record(v)||!exact(v,['schemaVersion','sourceId','sourceTitle','sourceVersion','sourceRevisions','options','identityMap','counts','createdAt',...('annotations' in v?['annotations']:[])])
        ||v.schemaVersion!==1||!id(v.sourceId)||v.sourceId===storyId||!title(v.sourceTitle)||!hash(v.sourceVersion)||!isStoryCopyOptions(v.options)||!counts(v.counts)
        ||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||!record(v.sourceRevisions)||!record(v.identityMap))return false
    const heads=v.sourceRevisions,map=v.identityMap,newIds=new Set<string>()
    if(!exact(heads,['metadataRevision','structureRevision','contextRevision','parts','chapters','scenes'])||![heads.metadataRevision,heads.structureRevision,heads.contextRevision].every(revision)
        ||!exact(map,['novel','parts','chapters','scenes','references','blocks']))return false
    for(const kind of ['novel','parts','chapters','scenes','references']){
        const identities=map[kind]
        if(!record(identities)||!Object.entries(identities).every(([oldId,newId])=>{
            if(!id(oldId)||!id(newId)||oldId===newId||newIds.has(newId))return false
            newIds.add(newId);return true
        }))return false
        if(kind!=='novel'&&Object.keys(identities).length!==v.counts[kind as keyof StoryCopyCounts])return false
    }
    if(!record(map.novel)||!exact(map.novel,[v.sourceId])||map.novel[v.sourceId]!==storyId)return false
    const validVectors=(kind:'parts'|'chapters'|'scenes')=>{
        const values=heads[kind],identities=map[kind]
        if(!Array.isArray(values)||!record(identities))return false
        const all=new Set<string>()
        if(!values.every((item)=>{
            if(!record(item)||!id(item.id)||!revision(item.metadataRevision)||all.has(item.id))return false
            all.add(item.id)
            if(kind==='chapters')return (item.partId===null||id(item.partId))&&exact(item,['id','partId','metadataRevision'])
            if(kind==='scenes')return exact(item,['id','chapterId','title','revision','metadataRevision','contentHash'])&&id(item.chapterId)&&title(item.title)&&revision(item.revision)&&hash(item.contentHash)
            return exact(item,['id','metadataRevision'])
        }))return false
        return Object.keys(identities).every((key)=>all.has(key))
    }
    if(!validVectors('parts')||!validVectors('chapters')||!validVectors('scenes')||!record(map.blocks)||!record(map.scenes)||!exact(map.blocks,Object.keys(map.scenes)))return false
    if(!Object.values(map.blocks).every((blocks)=>record(blocks)&&Object.entries(blocks).every(([oldId,newId])=>{
        if(!id(oldId)||!id(newId)||oldId===newId||newIds.has(newId))return false
        newIds.add(newId);return true
    })))return false
    if(v.annotations!==undefined){
        const notes=v.annotations
        if(!record(notes)||!exact(notes,['sourceRevision','included','count','identityMap',...('bookmarksIncluded' in notes?['bookmarksIncluded','comments','bookmarks']:[])])||!revision(notes.sourceRevision)||typeof notes.included!=='boolean'||'bookmarksIncluded' in notes&&typeof notes.bookmarksIncluded!=='boolean'
            ||!Number.isSafeInteger(notes.count)||Number(notes.count)<0||!record(notes.identityMap)||Object.keys(notes.identityMap).length!==notes.count||!notes.included&&!notes.bookmarksIncluded&&notes.count!==0)return false
        if('bookmarksIncluded' in notes&&(![notes.comments,notes.bookmarks].every((value)=>Number.isSafeInteger(value)&&Number(value)>=0)||Number(notes.comments)+Number(notes.bookmarks)!==notes.count||!notes.included&&notes.comments!==0||!notes.bookmarksIncluded&&notes.bookmarks!==0))return false
        if(!Object.entries(notes.identityMap).every(([oldId,newId])=>{if(!id(oldId)||!id(newId)||oldId===newId||newIds.has(newId))return false;newIds.add(newId);return true}))return false
    }
    return true
}
