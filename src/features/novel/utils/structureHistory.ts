import type { StoryStructureKind,StoryStructureOutlineUnit,StoryStructureRevision,StoryStructureSnapshot } from '@/shared'
import { canonicalJson } from '@/utils/json'

export interface StructureHistoryChange {
    id:string
    kind:StoryStructureKind
    before:StoryStructureOutlineUnit|null
    after:StoryStructureOutlineUnit|null
    beforeParent:string|null
    afterParent:string|null
    textChanged:boolean
    defaultsChanged:boolean
}
export function structureHistoryOutline(snapshot:StoryStructureSnapshot) {
    return [...snapshot.parts.map((unit)=>({unit,kind:'part' as const})),...snapshot.chapters.flatMap((unit)=>[
        {unit,kind:'chapter' as const},...(unit.scenes??[]).map((scene)=>({unit:scene,kind:'scene' as const})),
    ])]
}
const logical=(unit:StoryStructureOutlineUnit|null)=>unit?.logicalRevision??unit?.revision
const defaults=(unit:StoryStructureOutlineUnit|null)=>unit&&({status:unit.status,pov:unit.povCardId,location:unit.locationCardId,...unit.inheritedDetails})
const comparable=(unit:StoryStructureOutlineUnit)=>({...unit,scenes:undefined,revision:logical(unit),logicalRevision:undefined,metadataRevision:undefined})
export function structureHistoryChanges(detail:StoryStructureRevision,inverse=false):StructureHistoryChange[] {
    if(!detail.before)return []
    const before=inverse?detail.after:detail.before,after=inverse?detail.before:detail.after
    const previous=new Map(structureHistoryOutline(before).map((item)=>[item.unit.id,item])),next=new Map(structureHistoryOutline(after).map((item)=>[item.unit.id,item]))
    const beforeParents=new Map([...before.parts,...before.chapters].map((unit)=>[unit.id,unit.title??unit.id])),afterParents=new Map([...after.parts,...after.chapters].map((unit)=>[unit.id,unit.title??unit.id]))
    function parent(parents:Map<string,string>,unit:StoryStructureOutlineUnit|null) {
        if(!unit)return null
        const id=unit.chapterId??unit.partId
        if(!id)return null
        return parents.get(id)??id
    }
    return [...new Set([...previous.keys(),...next.keys()])].flatMap((id)=>{
        const old=previous.get(id),current=next.get(id),a=old?.unit??null,b=current?.unit??null
        if(a&&b&&canonicalJson(comparable(a))===canonicalJson(comparable(b)))return []
        return [{id,kind:(current??old)!.kind,before:a,after:b,beforeParent:parent(beforeParents,a),afterParent:parent(afterParents,b),
            textChanged:Boolean(a&&b&&logical(a)!==logical(b)),defaultsChanged:Boolean(a&&b&&canonicalJson(defaults(a))!==canonicalJson(defaults(b)))}]
    })
}
