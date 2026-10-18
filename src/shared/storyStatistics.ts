import type { StorySceneStatistics,StoryOutline } from './types/storyStudio.types'
import type { StorySectionStatistics,StoryStatistics } from './types/story.types'
import { isRecord } from './novelMutationJournal'

const buckets=['active','archived','trashed'] as const
const measures=['wordCount','characterCount','textBytes','parts','chapters','scenes'] as const
export function isStoryStatistics(value:unknown,structureRevision:number):value is StoryStatistics {
    if(!isRecord(value)||Object.keys(value).length!==7||value.schemaVersion!==1||value.algorithm!=='icu-word-en-v1'||value.complete!==true||value.sourceStructureRevision!==structureRevision)return false
    return buckets.every((bucket)=>{
        const counts=value[bucket]
        return isRecord(counts)&&Object.keys(counts).length===measures.length&&measures.every((key)=>
            key==='wordCount'&&counts[key]===null||Number.isSafeInteger(counts[key])&&Number(counts[key])>=0)
    })&&measures.every((key)=>buckets.reduce((sum,bucket)=>sum+Number((value[bucket] as unknown as StorySectionStatistics)[key]??0),0)<=Number.MAX_SAFE_INTEGER)
}
export function savedStoryStatistics(story:StoryOutline,includeArchived=false):StorySectionStatistics|null {
    const value=story.statistics
    if(!value||!isStoryStatistics(value,story.structureRevision))return null
    const a=value.active,b=value.archived
    if(!includeArchived)return a
    return {...a,wordCount:a.wordCount===null||b.wordCount===null?null:a.wordCount+b.wordCount,
        characterCount:a.characterCount+b.characterCount,textBytes:a.textBytes+b.textBytes,
        parts:a.parts+b.parts,chapters:a.chapters+b.chapters,scenes:a.scenes+b.scenes}
}

/** Counts are authoritative only for this exact canonical scene head. */
export function isStorySceneStatistics(value:unknown,scene:{revision:number;contentHash:string}):value is StorySceneStatistics {
    if(!isRecord(value)||Object.keys(value).length!==7||value.schemaVersion!==1||value.algorithm!=='icu-word-en-v1'||value.sourceRevision!==scene.revision||value.contentHash!==scene.contentHash)return false
    return (value.wordCount===null||Number.isSafeInteger(value.wordCount)&&Number(value.wordCount)>=0)
        &&['characterCount','textBytes'].every((key)=>Number.isSafeInteger(value[key])&&Number(value[key])>=0)
}
