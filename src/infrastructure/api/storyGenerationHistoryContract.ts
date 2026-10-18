import type { StoryGenerationDetail,StoryGenerationHistoryPage,StoryGenerationSummary } from '@/shared'
import { verifyStoryGeneration } from './storyContract'
import { isNovelRefinementReference } from './novelRefinementContract'
const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
const text=(value:unknown,max:number)=>typeof value==='string'&&Array.from(value).length<=max
const id=(value:unknown)=>text(value,64)&&String(value).length>0
const revision=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0
const location=(value:unknown)=>['active','archived','trashed'].includes(String(value))
export function verifyGenerationSummary(value:unknown,storyId:string):value is StoryGenerationSummary {
    return record(value)&&Object.keys(value).length===16&&id(value.id)&&value.storyId===storyId&&id(value.chapterId)&&id(value.sceneId)
        &&['continue','rewrite','expand','condense','describe','critique','custom'].includes(String(value.command))&&['candidate','accepted','rejected','stashed'].includes(String(value.status))
        &&revision(value.baseRevision)&&(value.appliedRevision===null||revision(value.appliedRevision))&&text(value.createdAt,64)&&Number.isFinite(Date.parse(String(value.createdAt)))
        &&text(value.chapterTitle,255)&&text(value.sceneTitle,255)&&location(value.location)&&(value.instructionPreview===null||text(value.instructionPreview,240))
        &&typeof value.instructionTruncated==='boolean'&&text(value.outputPreview,240)&&typeof value.outputTruncated==='boolean'
}
export function verifyGenerationHistoryPage(value:unknown,storyId:string,before:string|null):value is StoryGenerationHistoryPage {
    return record(value)&&Object.keys(value).length===5&&value.schemaVersion===1&&value.storyId===storyId&&value.before===before
        &&Array.isArray(value.items)&&value.items.length<=20&&value.items.every((item)=>verifyGenerationSummary(item,storyId))&&new Set(value.items.map((item)=>item.id)).size===value.items.length
        &&(value.nextBefore===null||id(value.nextBefore)&&value.items.length>0&&value.nextBefore===value.items[value.items.length-1].id&&value.nextBefore!==before)
}
export function verifyGenerationDetail(value:unknown,storyId:string,id:string):value is StoryGenerationDetail {
    return record(value)&&Object.keys(value).length===('refinementSource'in value?7:6)&&value.schemaVersion===1&&value.storyId===storyId&&verifyStoryGeneration(value.generation,storyId,id)
        &&text(value.chapterTitle,255)&&text(value.sceneTitle,255)&&location(value.location)
        &&(!('refinementSource'in value)||isNovelRefinementReference(value.refinementSource)&&value.refinementSource.generationId!==id)
}
