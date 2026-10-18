import { studioInheritance } from './storyStudioState'
import type { StoryChapterOutline, StoryOutline, StorySceneOutline } from './types/storyStudio.types'

/**
 * What a chapter, part or book summary was written for (rest of K09/A14), as the BFF's story_summary_basis computes it:
 * `sceneId@revision` for every scene not in Trash, merged, archived or left out of AI, in reading order.
 * A saved summary is current only while its stored basis equals today's.
 */
export const MAX_CHAPTER_BASIS=1000,MAX_BOOK_BASIS=3000
const ENTRY=/^[A-Za-z0-9._:-]{1,128}@[1-9][0-9]{0,9}$/
export const isSummaryBasis=(value:unknown,limit:number):value is string[]=>Array.isArray(value)&&value.length<=limit
    &&value.every((entry)=>typeof entry==='string'&&ENTRY.test(entry))&&new Set(value).size===value.length
const byOrder=(a:{order:number;id:string},b:{order:number;id:string})=>a.order-b.order||(a.id<b.id?-1:a.id>b.id?1:0)

/** Every chapter and scene in reading order, Trash included, as the compiler orders them. */
export function readingRows(story:StoryOutline):Array<{chapter:StoryChapterOutline;scene:StorySceneOutline}> {
    const parts=new Map([...story.parts].sort(byOrder).map((part,n)=>[part.id,n+1]))
    return [...story.chapters].sort((a,b)=>(parts.get(a.partId??'')??0)-(parts.get(b.partId??'')??0)||byOrder(a,b))
        .flatMap((chapter)=>[...chapter.scenes].sort(byOrder).map((scene)=>({chapter,scene})))
}

/** Today's basis of each chapter that has covered scenes, and of the whole book. */
export function summaryBases(story:StoryOutline):{chapters:Map<string,string[]>;book:string[]} {
    const parts=new Map(story.parts.map((part)=>[part.id,part])),chapters=new Map<string,string[]>(),book:string[]=[]
    for(const {chapter,scene} of readingRows(story)){
        const part=parts.get(chapter.partId??'')
        if([part,chapter,scene].some((unit)=>unit&&(unit.trashedAt||unit.mergedInto)))continue
        const inheritance=studioInheritance(story,chapter,scene)
        if(inheritance.readOnly||!inheritance.values.includeInAI)continue
        const entry=`${scene.id}@${scene.revision}`
        chapters.set(chapter.id,[...(chapters.get(chapter.id)??[]),entry]);book.push(entry)
    }
    return {chapters,book}
}
/** Today's basis of every part that has covered scenes; a chapter outside any part belongs to none. */
export function partBases(story:StoryOutline):Map<string,string[]> {
    const parts=new Set(story.parts.map((part)=>part.id)),chapters=new Map(story.chapters.map((chapter)=>[chapter.id,chapter])),bases=new Map<string,string[]>()
    for(const [chapterId,basis] of summaryBases(story).chapters){
        const partId=chapters.get(chapterId)?.partId
        if(partId&&parts.has(partId))bases.set(partId,[...(bases.get(partId)??[]),...basis])
    }
    return bases
}
/** Parts in reading order, as the compiler orders them. */
export const orderedParts=<T extends {order:number;id:string}>(parts:readonly T[]):T[]=>[...parts].sort(byOrder)
export const sameBasis=(saved:unknown,today:readonly string[]):boolean=>Array.isArray(saved)&&saved.length===today.length&&saved.every((entry,n)=>entry===today[n])
