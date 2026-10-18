import type { StoryNovelDetails } from './types/story.types'
import { isRecord } from './novelMutationJournal'
import { ownedImageUrl } from './imageAssets'
import { isCalendarDate } from './calendarDate'
import { isStoryStyleSheet } from './storyStyleSheet'
import { MAX_BOOK_BASIS,isSummaryBasis } from './storySummaryBasis'
const strings=['language','genre','audience','synopsis','summary','styleGuide','narrator','tense','notes','coverAlt']
const relationship=(value:unknown):value is string=>typeof value==='string'&&Boolean(value)&&value===value.trim()&&Array.from(value).length<=64
export function isStoryNovelDetails(value:unknown):value is StoryNovelDetails {
    if(!isRecord(value))return false
    for(const [key,item] of Object.entries(value)){
        if(key==='povCardId'||key==='coverAssetId'){if(item!==null&&!relationship(item))return false}
        else if(key==='deadline'){if(item!==null&&!(isCalendarDate(item)&&item>='2000-01-01'))return false}
        else if(key==='styleSheet'){if(item!==null&&!isStoryStyleSheet(item))return false}
        else if(key==='summaryBasis'){if(item!==null&&!isSummaryBasis(item,MAX_BOOK_BASIS))return false}
        else if(key==='dailyWordGoal'){if(item!==null&&!(Number.isSafeInteger(item)&&Number(item)>=1&&Number(item)<=1_000_000))return false}
        else if(key==='tags'){
            if(!Array.isArray(item)||item.length>100||!item.every((tag)=>typeof tag==='string'&&Array.from(tag).length>0&&Array.from(tag).length<=255))return false
        }else if(!strings.includes(key)||item!==null&&(typeof item!=='string'||Array.from(item).length>(key==='coverAlt'?2000:20_000)))return false
    }
    try{return new TextEncoder().encode(JSON.stringify(value)).length<=250_000}catch{return false}
}
/** Private owned-media route; never accept an arbitrary remote URL as a cover. */
export const storyCoverUrl=(assetId:unknown):string|undefined=>relationship(assetId)?ownedImageUrl(assetId):undefined
