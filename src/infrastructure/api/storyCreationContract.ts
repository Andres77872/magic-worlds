import type { StoryCreateWrite,StoryCreationAcknowledgement } from '@/shared/types/story.types'
import { isNovelRequestId,isRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import { verifyStoryContext } from './storyContract'
import { isStoryWritingTemplate } from '@/shared/storyWritingTemplate'
import { isCreationSourcesSelection } from './storyCreationSourcesContract'

const fields=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every((key)=>keys.includes(key))
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&Array.from(value).length<=max
const title=(value:unknown,max=255):value is string=>text(value,max)&&Boolean(value)&&value===value.trim()
const nullableId=(value:unknown)=>value===undefined||value===null||title(value,64)
export function isStoryCreateWrite(value:unknown):value is StoryCreateWrite {
    if(!isRecord(value)||!fields(value,['requestId','title','description','source','chapters','template','cardRefs','activeContext','approvedMaterials','expectedSourceVersion'])
        ||!isNovelRequestId(value.requestId)||!title(value.title)
        ||value.description!==undefined&&value.description!==null&&!text(value.description,60_000))return false
    if(value.template!==undefined){
        if(value.chapters!==undefined||!isStoryWritingTemplate(value.template))return false
    }else if(!Array.isArray(value.chapters)||value.chapters.length<1||value.chapters.length>2000||!value.chapters.every((chapter)=>isRecord(chapter)&&fields(chapter,['title','status','wordGoal','povCardId','locationCardId'])&&title(chapter.title)
        &&(chapter.status===undefined||chapter.status===null||['draft','revising','complete','archived'].includes(String(chapter.status)))
        &&(chapter.wordGoal===undefined||chapter.wordGoal===null||Number.isSafeInteger(chapter.wordGoal)&&Number(chapter.wordGoal)>0&&Number(chapter.wordGoal)<=2_147_483_647)
        &&nullableId(chapter.povCardId)&&nullableId(chapter.locationCardId)))return false
    if(!isCreationSourcesSelection({source:value.source,cardRefs:value.cardRefs,approvedMaterials:value.approvedMaterials})
        ||value.expectedSourceVersion!==undefined&&(typeof value.expectedSourceVersion!=='string'||!/^[0-9a-f]{64}$/.test(value.expectedSourceVersion))
        ||Array.isArray(value.approvedMaterials)&&value.approvedMaterials.length>0&&value.expectedSourceVersion===undefined)return false
    if(value.activeContext!==undefined&&(!isRecord(value.activeContext)||!fields(value.activeContext,['includeSelectedCards','includeLorebooks','includeRecentChapters','tokenBudget','styleSource','customStyleInstruction'])||!verifyStoryContext(value.activeContext)))return false
    try{return new TextEncoder().encode(JSON.stringify(value)).length<=1_000_000}catch{return false}
}
export function verifyStoryCreationAcknowledgement(value:unknown,write:StoryCreateWrite):value is StoryCreationAcknowledgement {
    return isRecord(value)&&fields(value,['kind','requestId','storyId','write'])&&Object.keys(value).length===4
        &&value.kind==='novel_create'&&value.requestId===write.requestId&&title(value.storyId,64)
        &&isStoryCreateWrite(value.write)&&canonicalJson(value.write)===canonicalJson(write)
}
