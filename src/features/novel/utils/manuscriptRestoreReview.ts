import type { StorySnapshotManifest } from '@/shared'
import { canonicalJson } from '@/utils/json'

export const restoreFieldLabel=(key:string)=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ')
export function restoreFieldChanges(a:object,b:object,fields:string[]) {
    const before=a as Record<string,unknown>,after=b as Record<string,unknown>
    const rows:Array<{key:string;before:unknown;after:unknown}>=[]
    for(const field of fields){
        const x=before[field],y=after[field]
        if(['details','activeContext','snapshot'].includes(field)&&x&&y&&typeof x==='object'&&typeof y==='object'){
            const old=x as Record<string,unknown>,next=y as Record<string,unknown>
            for(const key of new Set([...Object.keys(old),...Object.keys(next)]))if(canonicalJson(old[key])!==canonicalJson(next[key]))rows.push({key:field+'.'+key,before:old[key],after:next[key]})
        }else rows.push({key:field,before:x,after:y})
    }
    return rows
}
export function restoreReadableValue(value:unknown):string {
    if(value===null||value===undefined)return '—'
    if(typeof value==='object')return Array.isArray(value)?value.map(restoreReadableValue).join(', '):Object.entries(value).map(([key,item])=>restoreFieldLabel(key)+': '+restoreReadableValue(item)).join('\n')
    return String(value)
}
export function restoreRelatedValue(field:string,value:unknown,manifest:StorySnapshotManifest):unknown {
    if(Array.isArray(value))return value.map((item)=>restoreRelatedValue(field,item,manifest))
    if(typeof value!=='string')return value
    const key=field.split('.').slice(-1)[0]
    if(['partId','chapterId','sceneId','mergedInto'].includes(key??'')){
        return [...manifest.parts,...manifest.chapters,...manifest.chapters.flatMap((chapter)=>chapter.scenes)].find((unit)=>unit.id===value)?.title??value
    }
    if(['povCardId','locationCardId','castIds'].includes(key??'')){
        const ref=manifest.references.find((item)=>item.cardId===value)
        return ref?.snapshot.name??ref?.snapshot.alias??value
    }
    return value
}
