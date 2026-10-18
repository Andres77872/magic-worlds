import { documentMarkdown,documentText,isStoryDocument } from '@/shared/storyDocument'
import type { StoryReadingHeader,StoryReadingItem,StoryReadingPage,StoryReadingRequest } from '@/shared/types/storyReading.types'

const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const integer=(v:unknown,min=0):v is number=>Number.isSafeInteger(v)&&Number(v)>=min
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(v)
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const title=(v:unknown)=>typeof v==='string'&&v.length>0&&Array.from(v).length<=255
export function verifyReadingHeader(v:unknown):v is StoryReadingHeader {
    const fields=['sceneId','chapterId','partId','title','chapterTitle','partTitle','chapterMetadataRevision','partMetadataRevision','revision','metadataRevision','contentHash','status','archived','readOnly']
    return record(v)&&Object.keys(v).length===fields.length&&Object.keys(v).every((key)=>fields.includes(key))
        &&id(v.sceneId)&&id(v.chapterId)&&title(v.title)&&title(v.chapterTitle)&&integer(v.chapterMetadataRevision,1)
        &&(v.partId===null?v.partTitle===null&&v.partMetadataRevision===null:id(v.partId)&&title(v.partTitle)&&integer(v.partMetadataRevision,1))
        &&integer(v.revision,1)&&integer(v.metadataRevision,1)&&hash(v.contentHash)&&['draft','revising','complete','archived'].includes(String(v.status))
        &&typeof v.archived==='boolean'&&typeof v.readOnly==='boolean'&&(!v.archived||v.readOnly)
}
export function verifyReadingItem(v:unknown,request:StoryReadingRequest):v is StoryReadingItem {
    if(!record(v)||Object.keys(v).length!==2||!verifyReadingHeader(v.header)||!record(v.scene))return false
    const h=v.header,s=v.scene,fields=['id','chapterId','revision','metadataRevision','contentHash','document','plainText','body']
    return Object.keys(s).length===fields.length&&Object.keys(s).every((key)=>fields.includes(key))
        &&s.id===h.sceneId&&s.chapterId===h.chapterId&&s.revision===h.revision&&s.metadataRevision===h.metadataRevision&&s.contentHash===h.contentHash
        &&isStoryDocument(s.document)&&s.plainText===documentText(s.document)&&s.body===documentMarkdown(s.document)
        &&(request.includeArchived===true||!h.archived)
        &&(!request.scope||request.scope==='novel'||(request.scope==='part'?h.partId:request.scope==='chapter'?h.chapterId:h.sceneId)===request.unitId)
}
export function verifyReadingPage(v:unknown,storyId:string,request:StoryReadingRequest):v is StoryReadingPage {
    const fields=['schemaVersion','storyId','sourceSnapshot','sourceStructureRevision','sourceMetadataRevision','sourceContextRevision','scope','unitId','includeArchived','afterSceneId','offset','totalScenes','nextAfterSceneId','items',...(request.windowed?['navigation']:[])]
    if(!record(v)||Object.keys(v).length!==fields.length||!Object.keys(v).every((key)=>fields.includes(key))||v.schemaVersion!==1||v.storyId!==storyId||!hash(v.sourceSnapshot)
        ||request.sourceSnapshot!=null&&request.sourceSnapshot!==v.sourceSnapshot||!integer(v.sourceStructureRevision,1)||!integer(v.sourceMetadataRevision,1)||!integer(v.sourceContextRevision,1)
        ||v.scope!==(request.scope??'novel')||v.unitId!==(request.unitId??null)||v.includeArchived!==(request.includeArchived??false)||v.afterSceneId!==(request.afterSceneId??null)
        ||!integer(v.offset)||!integer(v.totalScenes)||v.offset>v.totalScenes||!Array.isArray(v.items)||v.items.length>Math.min(request.limit??2,v.totalScenes-v.offset)
        ||!v.items.every((item)=>verifyReadingItem(item,request))||new Set(v.items.map((item)=>item.header.sceneId)).size!==v.items.length
        ||v.afterSceneId===null&&!request.startSceneId&&!request.beforeSceneId&&v.offset!==0||v.afterSceneId!==null&&v.offset===0)return false
    if(request.windowed){
        const n=v.navigation,nav=['startSceneId','beforeSceneId','previousBeforeSceneId','previousChapterId','previousPartId']
        if(!record(n)||Object.keys(n).length!==nav.length||!Object.keys(n).every((key)=>nav.includes(key))||!nav.every((key)=>n[key]===null||id(n[key]))
            ||n.startSceneId!==(request.startSceneId??null)||n.beforeSceneId!==(request.beforeSceneId??null)
            ||n.previousBeforeSceneId!==(v.offset>0&&v.items.length?v.items[0].header.sceneId:null)
            ||(v.offset>0?!id(n.previousChapterId):n.previousChapterId!==null||n.previousPartId!==null))return false
        if(request.startSceneId&&v.items[0]?.header.sceneId!==request.startSceneId)return false
        if(request.beforeSceneId&&(!v.items.length||v.items.some((item)=>item.header.sceneId===request.beforeSceneId)||v.items.length<(request.limit??2)&&v.offset!==0))return false
    }
    if(!request.beforeSceneId&&v.items.length!==Math.min(request.limit??2,v.totalScenes-v.offset))return false
    return v.offset+v.items.length<v.totalScenes?v.nextAfterSceneId===v.items[v.items.length-1]?.header.sceneId&&v.nextAfterSceneId!==v.afterSceneId:v.nextAfterSceneId===null
}
