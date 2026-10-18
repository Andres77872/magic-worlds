import type { StoryLibraryFilters } from './types/storyLibrary.types'
import { isRecord } from './novelMutationJournal'
export const storyLibrarySearchScopes=['all','title','manuscript','metadata'] as const
export const storyLibrarySorts=['updated_desc','updated_asc','created_desc','created_asc','title_asc','title_desc','words_asc','words_desc'] as const
const textFields=['genre','language','audience','tag'] as const
const dateFields=['updatedFrom','updatedThrough'] as const
function validDate(value:unknown):value is string {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value.startsWith('0000'))return false
    const stamp=Date.parse(value+'T00:00:00Z')
    return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value
}
export function isStoryLibraryFilters(value:unknown):value is StoryLibraryFilters {
    if(!isRecord(value)||Object.keys(value).some((key)=>!['searchIn','sort','status','includeArchivedSections','minWords','maxWords',...textFields,...dateFields].includes(key)))return false
    if(['minWords','maxWords'].some((key)=>value[key]!==undefined&&(!Number.isSafeInteger(value[key])||Number(value[key])<0))||typeof value.minWords==='number'&&typeof value.maxWords==='number'&&value.minWords>value.maxWords)return false
    if(value.searchIn!==undefined&&!storyLibrarySearchScopes.some((scope)=>scope===value.searchIn)
        ||value.sort!==undefined&&!storyLibrarySorts.some((sort)=>sort===value.sort)
        ||value.status!==undefined&&!['draft','revising','complete','archived'].some((status)=>status===value.status)
        ||value.includeArchivedSections!==undefined&&typeof value.includeArchivedSections!=='boolean')return false
    if(textFields.some((key)=>value[key]!==undefined&&(typeof value[key]!=='string'||!value[key]||value[key]!==value[key].trim()||Array.from(value[key]).length>255)))return false
    if(dateFields.some((key)=>value[key]!==undefined&&!validDate(value[key]))||value.updatedThrough==='9999-12-31')return false
    return !(typeof value.updatedFrom==='string'&&typeof value.updatedThrough==='string'&&value.updatedFrom>value.updatedThrough)
}
export function storyLibraryParams(filters:StoryLibraryFilters):URLSearchParams {
    const params=new URLSearchParams()
    for(const key of textFields)if(filters[key]!==undefined)params.set(key,filters[key])
    for(const [key,wire] of [['searchIn','search_in'],['sort','sort'],['status','status'],['updatedFrom','updated_from'],['updatedThrough','updated_through'],['includeArchivedSections','include_archived_sections'],['minWords','min_words'],['maxWords','max_words']] as const){
        if(filters[key]!==undefined)params.set(wire,String(filters[key]))
    }
    return params
}
