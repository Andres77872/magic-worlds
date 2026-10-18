import type { StoryPlanAcknowledgement,StoryPlanItem,StoryPlanKind,StoryPlanPage,StoryPlanWrite } from '@/shared/types/storyPlanning.types'
import { isNovelRequestId,isNovelRevision,isRecord } from '@/shared/novelMutationJournal'

const STATES:Record<StoryPlanKind,readonly string[]>={task:['open','done','dismissed','trashed'],fact:['proposed','approved','rejected','trashed'],stash:['kept','trashed']}
const FACT_KINDS=['knowledge','relationship','possession','location','state','trait','event']
const text=(value:unknown,max:number,required=false)=>typeof value==='string'&&Array.from(value).length<=max&&(!required||Boolean(value.trim()))
const optional=(value:unknown,max:number)=>value===undefined||text(value,max)
const id=(value:unknown)=>typeof value==='string'&&value.length>=1&&value.length<=64&&value===value.trim()
const optionalId=(value:unknown)=>value===undefined||id(value)
const optionalRevision=(value:unknown)=>value===undefined||isNovelRevision(value)
const only=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every((key)=>keys.includes(key))
const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))

function validData(kind:StoryPlanKind,data:unknown){
    if(!isRecord(data))return false
    if(kind==='task')return only(data,['title','body','sceneId','quote','sourceRevision','resolution','origin','originRef'])&&text(data.title,500,true)
        &&optional(data.body,8000)&&optionalId(data.sceneId)&&optional(data.quote,2000)&&optionalRevision(data.sourceRevision)&&optional(data.resolution,2000)
        &&['author','continuity','critique','plan'].includes(data.origin as string)&&optional(data.originRef,128)&&(data.quote===undefined||data.sceneId!==undefined)
    if(kind==='fact')return only(data,['subject','subjectCardId','kind','statement','object','fromSceneId','untilSceneId','sourceSceneId','quote','sourceRevision','origin','originRef','codexRefId','codexRevision'])
        &&optionalId(data.codexRefId)&&optionalRevision(data.codexRevision)&&(data.codexRefId===undefined)===(data.codexRevision===undefined)
        &&text(data.subject,255,true)&&optionalId(data.subjectCardId)&&FACT_KINDS.includes(data.kind as string)&&text(data.statement,2000,true)&&optional(data.object,255)
        &&optionalId(data.fromSceneId)&&optionalId(data.untilSceneId)&&optionalId(data.sourceSceneId)&&optional(data.quote,2000)&&optionalRevision(data.sourceRevision)
        &&['author','assistant'].includes(data.origin as string)&&optional(data.originRef,128)
    return only(data,['kind','title','text','sceneId','sourceRevision'])&&['cut','take'].includes(data.kind as string)&&text(data.title,255,true)&&text(data.text,100_000,true)
        &&optionalId(data.sceneId)&&optionalRevision(data.sourceRevision)
}

export function verifyPlanItem<K extends StoryPlanKind>(value:unknown,storyId:string,kind:K):value is StoryPlanItem<K> {
    return isRecord(value)&&only(value,['id','storyId','kind','state','sceneId','revision','data','createdAt','updatedAt'])&&id(value.id)&&value.storyId===storyId
        &&value.kind===kind&&STATES[kind].includes(value.state as string)&&(value.sceneId===null||id(value.sceneId))&&isNovelRevision(value.revision)
        &&validData(kind,value.data)&&timestamp(value.createdAt)&&timestamp(value.updatedAt)
}

export function verifyPlanPage<K extends StoryPlanKind>(value:unknown,storyId:string,kind:K):value is StoryPlanPage<K> {
    if(!isRecord(value)||!only(value,['storyId','kind','items','truncated'])||value.storyId!==storyId||value.kind!==kind||typeof value.truncated!=='boolean'||!Array.isArray(value.items)||value.items.length>500)return false
    const seen=new Set<string>()
    return value.items.every((item)=>{
        if(!verifyPlanItem(item,storyId,kind)||seen.has(item.id))return false
        seen.add(item.id);return true
    })
}

export function verifyPlanAck<K extends StoryPlanKind>(value:unknown,storyId:string,write:StoryPlanWrite<K>):value is StoryPlanAcknowledgement<K> {
    if(!isRecord(value)||!only(value,['kind','storyId','requestId','item'])||value.kind!=='plan_item'||value.storyId!==storyId||value.requestId!==write.requestId||!isNovelRequestId(value.requestId))return false
    const item=value.item,operation=write.operation
    if(!verifyPlanItem(item,storyId,operation.kind)||item.id!==operation.id)return false
    if(operation.op==='create')return item.revision===1&&(operation.state===undefined||item.state===operation.state)
    return item.revision===operation.expectedRevision+1&&(operation.state===undefined||item.state===operation.state)
}
