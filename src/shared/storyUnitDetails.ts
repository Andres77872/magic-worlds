import type { StoryExportRole, StoryUnitDetails } from './types/story.types'
import { isRecord } from './novelMutationJournal'
import { MAX_CHAPTER_BASIS,isSummaryBasis } from './storySummaryBasis'

const strings=['synopsis','summary','narrator','tense','narrativeTime','notes']
const text=(value:unknown,max:number):value is string=>typeof value==='string'&&Array.from(value).length<=max
    &&Array.from(value).every((character)=>{const code=character.codePointAt(0)!;return code<0xd800||code>0xdfff})
/** Front matter comes before the main text in exported books, back matter after it. */
export const STORY_FRONT_MATTER:readonly StoryExportRole[]=['copyright','dedication','epigraph','foreword','preface','introduction']
export const STORY_BACK_MATTER:readonly StoryExportRole[]=['afterword','acknowledgments','appendix','glossary','about_author']
export const isStoryExportRole=(value:unknown):value is StoryExportRole=>[...STORY_FRONT_MATTER,...STORY_BACK_MATTER].includes(value as StoryExportRole)
/** A scene's place in story chronology; lower happens earlier, null is unknown. */
export const isStoryTimeOrder=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1_000_000_000
/** Read and write the same optional fields; never normalize stored metadata. */
export function isStoryUnitDetails(value:unknown):value is StoryUnitDetails {
    if(!isRecord(value))return false
    for(const [key,item] of Object.entries(value)){
        if(![...strings,'summaryRevision','summaryBasis','storyTimeOrder','castIds','plotThreads','tags','plannedBeats','includeInAI','includeInExport','exportRole'].includes(key))return false
        if(item===null)continue
        if(strings.includes(key)){if(!text(item,20_000))return false}
        else if(key==='summaryRevision'){if(!Number.isSafeInteger(item)||Number(item)<1)return false}
        else if(key==='summaryBasis'){if(!isSummaryBasis(item,MAX_CHAPTER_BASIS))return false}
        else if(key==='storyTimeOrder'){if(!isStoryTimeOrder(item))return false}
        else if(key==='includeInAI'||key==='includeInExport'){if(typeof item!=='boolean')return false}
        else if(key==='exportRole'){if(!isStoryExportRole(item))return false}
        else if(!Array.isArray(item)||item.length>100||!item.every((entry)=>text(entry,key==='plannedBeats'?2000:255)&&entry.length>0&&(!['tags','plannedBeats'].includes(key)||Boolean(entry.trim()))))return false
    }
    try{return new TextEncoder().encode(JSON.stringify(value)).length<=100_000}catch{return false}
}
