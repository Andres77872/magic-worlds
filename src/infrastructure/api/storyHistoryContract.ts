import type { StoryStructureHistoryOperation,StoryStructureHistoryPage,StoryStructureRevision,StoryStructureSnapshot } from '@/shared'
import { isRecord,isNovelRevision } from '@/shared/novelMutationJournal'
import { verifyStory,verifyStoryMetadata,verifyStoryReference } from './storyContract'

const id=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=64&&value===value.trim()
const nullableId=(value:unknown)=>value===null||id(value)
const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))
const action=(value:unknown)=>typeof value==='string'&&/^[a-z_]{1,32}$/.test(value)
const status=(value:unknown)=>value===null||['draft','revising','complete','archived'].includes(String(value))
function summary(value:unknown):boolean {
    return isRecord(value)&&isNovelRevision(value.revision)&&(value.parentRevision===null||isNovelRevision(value.parentRevision)&&value.parentRevision<value.revision)
        &&timestamp(value.createdAt)&&action(value.action)&&action(value.targetAction)&&isNovelRevision(value.operationRevision)&&value.operationRevision<=value.revision
        &&(value.kind===null||['part','chapter','scene'].includes(String(value.kind)))&&(value.title===null||typeof value.title==='string'&&Array.from(value.title).length<=255)
        &&['author','system'].includes(String(value.actor))&&typeof value.reversible==='boolean'
}
export function isStoryHistoryOperation(value:unknown):value is StoryStructureHistoryOperation {
    return isRecord(value)&&Object.keys(value).length===3&&['undo_structure','redo_structure'].includes(String(value.op))
        &&isNovelRevision(value.revision)&&isNovelRevision(value.sourceStructureRevision)&&value.revision<=value.sourceStructureRevision
}
export function verifyStoryStructureHistory(value:unknown,storyId:string,before?:number):value is StoryStructureHistoryPage {
    if(!isRecord(value)||value.storyId!==storyId||!isNovelRevision(value.structureRevision)||!Array.isArray(value.items)||value.items.length>50
        ||value.nextBefore!==null&&!isNovelRevision(value.nextBefore))return false
    for(const key of ['undo','redo']){
        const head=value[key]
        if(head!==null&&(!isRecord(head)||!isNovelRevision(head.revision)||head.revision>value.structureRevision
            ||!isNovelRevision(head.operationRevision)||head.operationRevision>head.revision||!action(head.action)))return false
    }
    let ceiling=Math.min(before??Number.MAX_SAFE_INTEGER,value.structureRevision+1)
    for(const row of value.items){
        if(!summary(row)||!isRecord(row)||Number(row.revision)>=ceiling||['snapshot','before','after','operation'].some((key)=>key in row))return false
        ceiling=Number(row.revision)
    }
    return value.nextBefore===null||value.items.length===50&&value.nextBefore===value.items[49].revision
}
function snapshot(value:unknown,storyId:string):value is StoryStructureSnapshot {
    if(!isRecord(value)||!isNovelRevision(value.structureRevision)||!Array.isArray(value.parts)||!Array.isArray(value.chapters)||value.chapters.length>2000)return false
    const seen=new Set<string>(),parts=new Set<string>()
    let sceneCount=0
    if(value.novel!==undefined&&(!isRecord(value.novel)||!verifyStory({...value.novel,source:{kind:'blank',id:null,title:null},metadataRevision:1,structureRevision:value.structureRevision,contextRevision:1,copiedFrom:null,parts:[],chapters:[],activeCardRefs:[]},storyId)))return false
    function unit(item:unknown,kind:'part'|'chapter'|'scene',chapterId?:string):boolean {
        if(!isRecord(item)||!id(item.id)||seen.has(item.id)||!Number.isSafeInteger(item.order)||Number(item.order)<0
            ||!status(item.status)||item.trashedAt!==null&&!timestamp(item.trashedAt)||!isNovelRevision(item.metadataRevision)
            ||!nullableId(item.povCardId)||!nullableId(item.locationCardId)||!isRecord(item.inheritedDetails))return false
        if(item.title!==undefined&&(typeof item.title!=='string'||Array.from(item.title).length>255))return false
        if(item.metadataHash!==undefined&&(typeof item.metadataHash!=='string'||!/^[a-f0-9]{64}$/.test(item.metadataHash)))return false
        if(item.contentHash!==undefined&&(typeof item.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(item.contentHash)))return false
        if(item.details!==undefined&&!verifyStoryMetadata({...item,storyId,wordGoal:item.wordGoal??null,copiedFrom:null},storyId))return false
        const details=item.inheritedDetails
        if(['narrator','tense'].some((key)=>details[key]!==undefined&&details[key]!==null&&typeof details[key]!=='string')
            ||['includeInAI','includeInExport'].some((key)=>details[key]!==undefined&&details[key]!==null&&typeof details[key]!=='boolean'))return false
        seen.add(item.id)
        if(kind==='part')parts.add(item.id)
        if(kind==='scene')return ++sceneCount<=20_000&&item.chapterId===chapterId&&isNovelRevision(item.revision)&&(item.logicalRevision===undefined||isNovelRevision(item.logicalRevision)&&item.logicalRevision<=item.revision)
        if(kind==='chapter')return nullableId(item.partId)&&(item.partId===null||parts.has(String(item.partId)))&&Array.isArray(item.scenes)&&item.scenes.every((scene)=>unit(scene,'scene',String(item.id)))
        return true
    }
    return value.parts.every((part)=>unit(part,'part'))&&value.chapters.every((chapter)=>unit(chapter,'chapter'))
}
export function verifyStoryStructureRevision(value:unknown,storyId:string,revision:number):value is StoryStructureRevision {
    if(!isRecord(value))return false
    if(value.referenceChanges!==undefined){
        if(!Array.isArray(value.referenceChanges)||value.referenceChanges.length>20_000)return false
        const seen=new Set<string>()
        for(const change of value.referenceChanges){
            if(!isRecord(change)||!id(change.id)||seen.has(change.id))return false
            seen.add(change.id)
            for(const key of ['before','after']){
                const state=change[key]
                if(key==='before'&&state===null)continue
                if(!isRecord(state)||typeof state.enabled!=='boolean'||state.removedAt!==null&&!timestamp(state.removedAt)
                    ||state.reference!==undefined&&(!verifyStoryReference(state.reference,storyId,change.id)||state.reference.enabled!==state.enabled||state.reference.removedAt!==state.removedAt))return false
            }
        }
    }
    return value.storyId===storyId&&value.revision===revision&&summary(value)&&isRecord(value.operation)
        &&value.operation.op===value.action&&!Object.keys(value.operation).some((key)=>key.startsWith('_'))
        &&snapshot(value.after,storyId)&&value.after.structureRevision===revision
        &&(value.before===null||snapshot(value.before,storyId)&&value.before.structureRevision===value.parentRevision)
        &&(value.reversible===false||value.before!==null)
}
