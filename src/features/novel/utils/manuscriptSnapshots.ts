import type { StorySnapshotManifest,StoryUnitMetadata } from '@/shared'
import { canonicalJson } from '@/utils/json'

export type SnapshotChangeKind='novel'|'part'|'chapter'|'scene'|'reference'
export type SnapshotChangeField='added'|'missing'|'text'|'details'|'organization'|'context'
export interface SnapshotChange {id:string;kind:SnapshotChangeKind;title:string;fields:SnapshotChangeField[]}
const pick=(item:object,keys:string[])=>Object.fromEntries(keys.map((key)=>[key,(item as Record<string,unknown>)[key]]))
const different=(a:unknown,b:unknown)=>canonicalJson(a)!==canonicalJson(b)
export function snapshotScenes(manifest:StorySnapshotManifest) {
    const partOrder=new Map([...manifest.parts].sort((a,b)=>a.order-b.order).map((part,index)=>[part.id,index+1]))
    const parts=new Map(manifest.parts.map((part)=>[part.id,part]))
    return [...manifest.chapters].sort((a,b)=>(partOrder.get(a.partId??'')??0)-(partOrder.get(b.partId??'')??0)||a.order-b.order)
        .flatMap((chapter)=>[...chapter.scenes].sort((a,b)=>a.order-b.order).map((scene)=>({part:parts.get(chapter.partId??''),chapter,scene})))
}
export function manuscriptSnapshotChanges(saved:StorySnapshotManifest,current:StorySnapshotManifest):SnapshotChange[] {
    const changes:SnapshotChange[]=[]
    const rootDetails=['title','description','source','status','wordGoal','details','trashedAt','copiedFrom']
    const rootFields:SnapshotChangeField[]=[]
    if(different(pick(saved.novel,rootDetails),pick(current.novel,rootDetails)))rootFields.push('details')
    if(different(saved.novel.activeContext,current.novel.activeContext))rootFields.push('context')
    if(rootFields.length)changes.push({id:saved.storyId,kind:'novel',title:current.novel.title,fields:rootFields})
    function compare<T extends StoryUnitMetadata>(kind:'part'|'chapter'|'scene',oldItems:T[],newItems:T[]){
        const old=new Map(oldItems.map((item)=>[item.id,item])),next=new Map(newItems.map((item)=>[item.id,item]))
        for(const id of new Set([...old.keys(),...next.keys()])){
            const a=old.get(id),b=next.get(id),fields:SnapshotChangeField[]=[]
            if(!a)fields.push('added')
            else if(!b)fields.push('missing')
            else {
                if(different(pick(a,['title','wordGoal','povCardId','locationCardId','details']),pick(b,['title','wordGoal','povCardId','locationCardId','details'])))fields.push('details')
                if(different(pick(a,['partId','chapterId','order','status','previousStatus','trashedAt','mergedInto']),pick(b,['partId','chapterId','order','status','previousStatus','trashedAt','mergedInto'])))fields.push('organization')
                if(kind==='scene'&&different(pick(a,['contentHash']),pick(b,['contentHash'])))fields.push('text')
            }
            if(fields.length)changes.push({id,kind,title:(b??a)!.title,fields})
        }
    }
    compare('part',saved.parts,current.parts);compare('chapter',saved.chapters,current.chapters)
    compare('scene',saved.chapters.flatMap((chapter)=>chapter.scenes),current.chapters.flatMap((chapter)=>chapter.scenes))
    const refs=new Map(saved.references.map((ref)=>[ref.id,ref])),nextRefs=new Map(current.references.map((ref)=>[ref.id,ref]))
    for(const id of new Set([...refs.keys(),...nextRefs.keys()])){
        const a=refs.get(id),b=nextRefs.get(id)
        if(different(a,b)){
            const ref=(b??a)!
            changes.push({id,kind:'reference',title:ref.snapshot.name??ref.snapshot.alias??ref.cardId,fields:[!a?'added':!b?'missing':'context']})
        }
    }
    return changes
}
