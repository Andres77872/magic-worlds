import type { StoryCopyOptions } from './types/story.types'
export const storyCopyOptionKeys=['includeNotes','includeContext','includeArchived','includeTrash'] as const
export const defaultStoryCopyOptions:StoryCopyOptions=Object.freeze({includeNotes:true,includeContext:true,includeArchived:false,includeTrash:false})
export function isStoryCommentCopyChoice(value:Record<string,unknown>):boolean {
    const choices=['includeComments','includeBookmarks'].filter((key)=>Object.prototype.hasOwnProperty.call(value,key)),revision=Object.prototype.hasOwnProperty.call(value,'sourceAnnotationRevision')
    return !choices.length&&!revision||choices.length>0&&revision&&choices.every((key)=>typeof value[key]==='boolean')&&Number.isSafeInteger(value.sourceAnnotationRevision)&&Number(value.sourceAnnotationRevision)>0
}
export function isStoryCopyOptions(value:unknown):value is StoryCopyOptions {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const record=value as Record<string,unknown>
    return Object.keys(record).length===4&&storyCopyOptionKeys.every((key)=>Object.prototype.hasOwnProperty.call(record,key)&&typeof record[key]==='boolean')
}
