import { canonicalJson } from '@/utils/json'
import { isNovelRequestId,isNovelRevision,isRecord } from '@/shared/novelMutationJournal'
import { isStoryDocument } from '@/shared/storyDocument'
import type { StoryDocumentNode } from '@/shared'
import type { StoryReplacementAck,StoryReplacementOperation,StoryReplacementPreview,StoryReplacementRequest,StoryReplacementReverseRequest,StoryReplacementWrite } from '@/shared/types/storyReplacement.types'

const keys=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).every((key)=>fields.includes(key))
const exact=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).length===fields.length&&keys(v,fields)
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:-]{1,64}$/.test(v)
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
const bounded=(v:unknown,max:number)=>{try{return new TextEncoder().encode(JSON.stringify(v)).length<=max}catch{return false}}
const text=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&Array.from(v).length>=min&&Array.from(v).length<=max&&Array.from(v).every((c)=>c.length!==1||c.charCodeAt(0)<0xd800||c.charCodeAt(0)>0xdfff)
const point=(v:unknown):v is {sceneId:string;position:number}=>isRecord(v)&&exact(v,['sceneId','position'])&&id(v.sceneId)&&int(v.position,1,2_000_001)
const identity=(v:{sceneId:string;position:number})=>v.sceneId+':'+v.position
const unique=(v:Array<{sceneId:string;position:number}>)=>new Set(v.map(identity)).size===v.length
export function isReplacementRequest(v:unknown):v is StoryReplacementRequest {
    return isRecord(v)&&keys(v,['q','caseSensitive','includeArchived','partId','chapterId','sceneId','status','sourceSnapshot','replacement','targets'])
        &&text(v.q,1,255)&&new TextEncoder().encode(v.q).length<=1024&&text(v.replacement,0,2000)&&hash(v.sourceSnapshot)
        &&['caseSensitive','includeArchived'].every((key)=>v[key]===undefined||typeof v[key]==='boolean')
        &&['partId','chapterId','sceneId'].every((key)=>v[key]===undefined||v[key]===null||id(v[key]))
        &&(v.status===undefined||v.status===null||['draft','revising','complete','archived'].includes(String(v.status)))
        &&Array.isArray(v.targets)&&v.targets.length>0&&v.targets.length<=100&&v.targets.every(point)&&unique(v.targets)
}
export function isReplacementOperation(v:unknown):v is StoryReplacementOperation {
    return isRecord(v)&&(v.op==='replace'?exact(v,['op','preview'])&&isReplacementRequest(v.preview):
        v.op==='reverse'&&exact(v,['op','originRequestId','direction','sourceSnapshot'])&&isNovelRequestId(v.originRequestId)&&['undo','redo'].includes(String(v.direction))&&hash(v.sourceSnapshot))
}
export function isReplacementWrite(v:unknown):v is StoryReplacementWrite {
    return isRecord(v)&&exact(v,['requestId','previewHash','operation'])&&isNovelRequestId(v.requestId)&&hash(v.previewHash)&&isReplacementOperation(v.operation)
}
function fragments(v:unknown):v is StoryDocumentNode[] {
    return Array.isArray(v)&&v.every((item)=>isRecord(item)&&['text','hardBreak'].includes(String(item.type)))
        &&isStoryDocument({schemaVersion:1,content:{type:'doc',content:[{type:'paragraph',attrs:{nodeId:'review'},...(v.length?{content:v}:{})}]}})
}
const fragmentText=(v:StoryDocumentNode[])=>v.map((item)=>item.type==='text'?item.text:'\n').join('')
function match(v:unknown,allowEmpty=false):v is Record<string,unknown>&{sceneId:string;position:number;startOffset:number;endOffset:number;quote:string} {
    return isRecord(v)&&id(v.sceneId)&&int(v.position,1,2_000_001)&&int(v.startOffset,0,2_000_000)&&int(v.endOffset,1,2_000_000)&&v.endOffset>v.startOffset
        &&text(v.quote,allowEmpty?0:1,4096)
}
export function verifyReplacementPreview(v:unknown,storyId:string,request:StoryReplacementRequest|StoryReplacementReverseRequest):v is StoryReplacementPreview {
    const fields=['schemaVersion','kind','algorithm','storyId','sourceSnapshot','sourceStructureRevision','sourceMetadataRevision','sourceContextRevision','operation','previewHash','scenes','changes','counts','canApply']
    if(!isRecord(v)||!bounded(v,1_500_100)||!exact(v,fields)||v.schemaVersion!==1||v.kind!=='manuscript_replace_preview'||v.algorithm!=='canonical-inline-literal-v1'||v.storyId!==storyId
        ||!hash(v.sourceSnapshot)||!hash(v.previewHash)||!isNovelRevision(v.sourceStructureRevision)||!isNovelRevision(v.sourceMetadataRevision)||!isNovelRevision(v.sourceContextRevision)
        ||!isReplacementOperation(v.operation)||!Array.isArray(v.scenes)||!v.scenes.length||v.scenes.length>100||!Array.isArray(v.changes)||!v.changes.length||v.changes.length>100||!isRecord(v.counts)||!exact(v.counts,['selected','changed','unchanged','blocked','scenes']))return false
    const op=v.operation,changes=v.changes,scenes=v.scenes
    if('targets' in request?(op.op!=='replace'||canonicalJson(op.preview)!==canonicalJson(request)||v.sourceSnapshot!==request.sourceSnapshot):
        (op.op!=='reverse'||op.originRequestId!==request.originRequestId||op.direction!==request.direction||op.sourceSnapshot!==v.sourceSnapshot))return false
    const seen=new Set<string>(),sceneIds=new Set<string>()
    for(const scene of v.scenes){
        if(!isRecord(scene)||!exact(scene,['sceneId','title','revision','metadataRevision','contentHash','targetHash','changed'])||!id(scene.sceneId)||sceneIds.has(scene.sceneId)||!text(scene.title,1,255)
            ||!isNovelRevision(scene.revision)||!isNovelRevision(scene.metadataRevision)||!hash(scene.contentHash)||!hash(scene.targetHash)||!int(scene.changed,0,100))return false
        sceneIds.add(scene.sceneId)
    }
    for(const change of v.changes){
        if(!match(change,op.op==='reverse')||!isRecord(change)||!exact(change,['sceneId','position','startOffset','endOffset','quote','reason','original','proposed','replacement'])||!sceneIds.has(change.sceneId)||seen.has(identity(change))
            ||!text(change.replacement,0,4096)||![null,'unchanged','reference','structure','read_only','proposal','limit','changed'].includes(change.reason as null|string)
            ||!fragments(change.original)||!fragments(change.proposed))return false
        seen.add(identity(change))
        if(op.op==='replace'&&(change.replacement!==op.preview.replacement||change.quote.length!==change.endOffset-change.startOffset||op.preview.caseSensitive&&change.quote!==op.preview.q))return false
        if(change.reason===null&&(fragmentText(change.original)!==change.quote||fragmentText(change.proposed)!==change.replacement))return false
    }
    if(op.op==='replace'&&(op.preview.targets.length!==seen.size||op.preview.targets.some((item)=>!seen.has(identity(item)))))return false
    const changed=v.changes.filter((item)=>item.reason===null).length,unchanged=v.changes.filter((item)=>item.reason==='unchanged').length
    const actual={selected:v.changes.length,changed,unchanged,blocked:v.changes.length-changed-unchanged,scenes:v.scenes.filter((item)=>item.changed>0).length}
    return canonicalJson(v.counts)===canonicalJson(actual)&&v.canApply===(changed>0&&actual.blocked===0)
        &&scenes.every((scene)=>scene.changed===changes.filter((item)=>item.sceneId===scene.sceneId&&item.reason===null).length)
}
export function verifyReplacementAck(v:unknown,storyId:string,write:StoryReplacementWrite):v is StoryReplacementAck {
    if(!isReplacementWrite(write)||!isRecord(v)||!bounded(v,2_000_000)||!exact(v,['kind','algorithm','storyId','write','originRequestId','scenes','matches'])||v.kind!=='manuscript_replace'||v.algorithm!=='canonical-inline-literal-v1'||v.storyId!==storyId||canonicalJson(v.write)!==canonicalJson(write)
        ||v.originRequestId!==(write.operation.op==='replace'?write.requestId:write.operation.originRequestId)||!Array.isArray(v.scenes)||!v.scenes.length||v.scenes.length>100||!Array.isArray(v.matches)||v.matches.length>100)return false
    const scenes=new Set<string>()
    if(!v.scenes.every((scene)=>{
        if(!isRecord(scene)||!exact(scene,['sceneId','fromRevision','fromHash','revision','contentHash','changed'])||!id(scene.sceneId)||scenes.has(scene.sceneId)||!isNovelRevision(scene.fromRevision)||!isNovelRevision(scene.revision)||scene.revision!==scene.fromRevision+1||!hash(scene.fromHash)||!hash(scene.contentHash)||!int(scene.changed,1,100))return false
        scenes.add(scene.sceneId);return true
    }))return false
    if(write.operation.op==='reverse')return v.matches.length===0
    if(!v.matches.every((item)=>match(item)&&isRecord(item)&&exact(item,['sceneId','position','startOffset','endOffset','quote'])&&item.quote.length===item.endOffset-item.startOffset&&scenes.has(item.sceneId))||!unique(v.matches))return false
    const targets=new Set(write.operation.preview.targets.map(identity)),matches=v.matches
    return matches.length>0&&matches.every((item)=>targets.has(identity(item)))&&v.scenes.every((scene)=>scene.changed===matches.filter((item)=>item.sceneId===scene.sceneId).length)
}
