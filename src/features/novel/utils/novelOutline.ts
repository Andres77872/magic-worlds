import type { StoryChapterOutline,StoryPart,StorySceneOutline,StoryUnitMetadata,StoryCardRef } from '@/shared'
import { loadedStoryScene } from '@/shared/storyStudioState'
import { plainTextWordCount } from './novelUtils'
import { snapshotLabel } from './codexUtils'

export interface OutlineView {numbers:boolean;details:boolean}
export const DEFAULT_OUTLINE_VIEW:OutlineView={numbers:true,details:false}
export interface OutlineScene {unit:StorySceneOutline;number:string|null;words:number|null;archived:boolean}
export interface OutlineChapter {unit:StoryChapterOutline;number:number|null;words:number|null;archived:boolean;scenes:OutlineScene[]}
export interface OutlinePart {unit:StoryPart;number:number|null;words:number|null;archived:boolean;chapters:OutlineChapter[]}
const order=(a:StoryUnitMetadata,b:StoryUnitMetadata)=>{
    if(a.order!==b.order)return a.order-b.order
    const first=Array.from(a.id),second=Array.from(b.id)
    for(let index=0;index<Math.min(first.length,second.length);index++){const difference=first[index].codePointAt(0)!-second[index].codePointAt(0)!;if(difference)return difference}
    return first.length-second.length
}
const counts=new WeakMap<StorySceneOutline,{text:string;words:number}>()
export function sceneWords(scene:StorySceneOutline):number|null {
    const saved=scene.statistics
    if(saved&&saved.sourceRevision===scene.revision&&saved.contentHash===scene.contentHash)return saved.wordCount
    if(!loadedStoryScene(scene))return null
    const cached=counts.get(scene)
    if(cached?.text===scene.plainText)return cached.words
    const words=plainTextWordCount(scene.plainText);counts.set(scene,{text:scene.plainText,words});return words
}
export function sumSceneWords(scenes:StorySceneOutline[]):number|null {
    return sumWords(scenes.map(sceneWords))
}
function sumWords(counts:Array<number|null>):number|null {return counts.some((value)=>value===null)?null:counts.reduce<number>((sum,value)=>sum+(value??0),0)}
/** Ordinals are derived; author titles, stable IDs and manuscript data never change. */
export function novelOutline(chapters:StoryChapterOutline[],parts:StoryPart[]=[]){
    const visibleParts=[...parts].filter((part)=>!part.trashedAt).sort(order),partIds=new Set(visibleParts.map((part)=>part.id))
    const visibleChapters=chapters.filter((chapter)=>!chapter.trashedAt&&(chapter.partId===null||partIds.has(chapter.partId)))
    const byParent=new Map<string|null,StoryChapterOutline[]>()
    for(const chapter of visibleChapters){const group=byParent.get(chapter.partId)??[];group.push(chapter);byParent.set(chapter.partId,group)}
    let chapterNumber=0,partNumber=0
    const group=(parentId:string|null,parentArchived=false):OutlineChapter[]=>[...(byParent.get(parentId)??[])].sort(order).map((unit)=>{
        const archived=parentArchived||unit.status==='archived',number=archived?null:++chapterNumber
        let sceneNumber=0
        const scenes=[...unit.scenes].filter((scene)=>!scene.trashedAt).sort(order).map((scene)=>{
            const inactive=archived||scene.status==='archived'
            return {unit:scene,number:inactive?null:number+'.'+(++sceneNumber),words:sceneWords(scene),archived:inactive}
        })
        return {unit,number,scenes,archived,words:sumWords(scenes.filter((scene)=>scene.unit.status!=='archived').map((scene)=>scene.words))}
    })
    const ungrouped=group(null)
    const grouped:OutlinePart[]=visibleParts.map((unit)=>{
        const archived=unit.status==='archived',chapters=group(unit.id,archived)
        return {unit,archived,number:archived?null:++partNumber,chapters,words:sumWords(chapters.filter((chapter)=>chapter.unit.status!=='archived').map((chapter)=>chapter.words))}
    })
    const ordered=[...ungrouped,...grouped.flatMap((part)=>part.chapters)]
    return {ungrouped,parts:grouped,chapters:ordered,words:sumWords(ordered.filter((chapter)=>!chapter.archived).map((chapter)=>chapter.words))}
}
/** Resolve author relationships using the same local → chapter → novel precedence. */
export function outlineCard(refs:StoryCardRef[],cardId:string,kind:'character'|'world',chapterId?:string,sceneId?:string){
    const eligible=refs.filter((ref)=>ref.cardId===cardId&&ref.kind===kind&&(ref.chapterId===null||ref.chapterId===chapterId)&&(ref.sceneId===null||ref.sceneId===sceneId))
        .sort((a,b)=>Number(Boolean(a.removedAt))-Number(Boolean(b.removedAt))||(b.sceneId?2:b.chapterId?1:0)-(a.sceneId?2:a.chapterId?1:0)||a.precedence-b.precedence||a.id.localeCompare(b.id))
    const ref=eligible[0]
    return ref?{label:snapshotLabel(ref),removed:Boolean(ref.removedAt)}:null
}
export function outlineExcerpt(value:string,limit=240){const points=Array.from(value);return points.length<=limit?value:points.slice(0,limit).join('')+'…'}
