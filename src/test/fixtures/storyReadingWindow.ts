import { ApiError } from '@/infrastructure/api'
import type { StoryReadingRequest } from '@/shared/types/storyReading.types'
import { readingItem,readingWindow } from './storyReading'
export const readerSceneId=(index:number)=>'scene-'+String(index).padStart(4,'0')
export function indexedReadingWindow(query:StoryReadingRequest,total=1000,snapshot='b'.repeat(64)){
    if(query.sourceSnapshot&&query.sourceSnapshot!==snapshot)throw new ApiError(409,'Changed',{code:'STORY_READING_SOURCE_CHANGED'})
    const position=query.startSceneId??query.afterSceneId??query.beforeSceneId
    const index=position?Number(position.slice(6)):0
    if(position&&(!Number.isSafeInteger(index)||index<0||index>=total||position!==readerSceneId(index)))throw new ApiError(422,'Unavailable',{code:'STORY_READING_POSITION_INVALID'})
    if(query.beforeSceneId&&index===0)throw new ApiError(422,'Unavailable',{code:'STORY_READING_POSITION_INVALID'})
    const limit=query.limit??2,offset=query.afterSceneId?index+1:query.beforeSceneId?Math.max(0,index-limit):index
    const end=Math.min(total,offset+limit,query.beforeSceneId?index:total),items=Array.from({length:end-offset},(_,n)=>readingItem(readerSceneId(offset+n),'Scene '+(offset+n)+' · saved prose.'))
    return readingWindow({sourceSnapshot:snapshot,scope:query.scope??'novel',unitId:query.unitId??null,includeArchived:query.includeArchived??false,afterSceneId:query.afterSceneId??null,
        offset,totalScenes:total,items,nextAfterSceneId:end<total?items[items.length-1]?.header.sceneId??null:null,
        navigation:{startSceneId:query.startSceneId??null,beforeSceneId:query.beforeSceneId??null,previousBeforeSceneId:offset>0?items[0]?.header.sceneId??null:null,previousChapterId:offset>0?'chapter-1':null,previousPartId:null}})
}
