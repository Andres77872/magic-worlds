import type { StoryWritingTemplate } from './types/storyTemplate.types'
import { isRecord } from './novelMutationJournal'
import { isStoryUnitDetails } from './storyUnitDetails'

const fields=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).every((key)=>keys.includes(key))
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&Array.from(value).length<=max
const title=(value:unknown)=>text(value,255)&&Boolean(value)&&value===value.trim()
const positive=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<=2_147_483_647
const defaults=['language','genre','audience','narrator','tense','styleGuide']
const detailFields=['synopsis','narrator','tense','narrativeTime','plotThreads','tags','plannedBeats','notes','includeInAI','includeInExport']
const metadataSize=(value:Record<string,unknown>)=>{
    try{return new TextEncoder().encode(JSON.stringify(Object.fromEntries(Object.entries(value).filter(([,item])=>item!==null)))).length<=100_000}catch{return false}
}
function details(value:unknown):boolean {
    return isRecord(value)&&fields(value,detailFields)&&isStoryUnitDetails(Object.fromEntries(Object.entries(value).filter(([,item])=>item!==null)))
}
function unit(value:unknown,chapter=false):value is Record<string,unknown> {
    return isRecord(value)&&fields(value,['title','status','wordGoal','details',...(chapter?['partIndex','scenes']:[])])&&title(value.title)
        &&(value.status===undefined||value.status===null||['draft','revising','complete'].includes(String(value.status)))
        &&(value.wordGoal===undefined||value.wordGoal===null||positive(value.wordGoal))
        &&(value.details===undefined||details(value.details))
}
export function isStoryWritingTemplate(value:unknown):value is StoryWritingTemplate {
    if(!isRecord(value)||!fields(value,['schemaVersion','key','version','name','defaults','parts','chapters'])||value.schemaVersion!==1
        ||typeof value.key!=='string'||! /^[A-Za-z0-9._:-]{1,64}$/.test(value.key)||!positive(value.version)||!title(value.name)
        ||value.defaults!==undefined&&(!isRecord(value.defaults)||!fields(value.defaults,defaults)||!metadataSize(value.defaults)||!Object.values(value.defaults).every((item)=>item===null||text(item,20_000)))
        ||value.parts!==undefined&&(!Array.isArray(value.parts)||value.parts.length>2000||!value.parts.every((item)=>unit(item)))
        ||!Array.isArray(value.chapters)||value.chapters.length<1||value.chapters.length>2000)return false
    const partCount=Array.isArray(value.parts)?value.parts.length:0
    let sceneCount=0
    for(const chapter of value.chapters){
        if(!unit(chapter,true)||chapter.partIndex!==undefined&&chapter.partIndex!==null&&(!Number.isSafeInteger(chapter.partIndex)||Number(chapter.partIndex)<0||Number(chapter.partIndex)>=partCount)
            ||!Array.isArray(chapter.scenes)||chapter.scenes.length<1||chapter.scenes.length>20_000||!chapter.scenes.every((scene)=>unit(scene)))return false
        sceneCount+=chapter.scenes.length
    }
    return sceneCount<=20_000&&new TextEncoder().encode(JSON.stringify(value)).length<=1_000_000
}
