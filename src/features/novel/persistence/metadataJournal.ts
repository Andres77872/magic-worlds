import type { StoryOutline, StoryScene, StoryUnitMetadata, StoryUnitWrite } from '@/shared'
import { isNovelRequestId, isNovelRevision, isRecord, readNovelMutation, type NovelJournalRecord } from '@/shared/novelMutationJournal'
import { canonicalJson } from '@/utils/json'
import { isStoryNovelDetails } from '@/shared/storyNovelDetails'
import { isStoryUnitDetails } from '@/shared/storyUnitDetails'

export type MetadataKind = 'novel' | 'part' | 'chapter' | 'scene'
export type MetadataUnit = StoryOutline | StoryUnitMetadata
export interface MetadataForm {
    title: string
    description: string
    status: string
    goal: string
    details: Record<string, unknown>
    pov: string
    location: string
}
export interface MetadataCheckpoint {
    kind: MetadataKind
    unitId: string
    baseRevision: number
    sourceRevision: number | null
    base: MetadataForm
    form: MetadataForm
    pending: StoryUnitWrite | null
}
export function metadataForm(unit: MetadataUnit): MetadataForm {
    return {
        title: unit.title, description: 'description' in unit ? unit.description ?? '' : '',
        status: unit.status ?? '', goal: unit.wordGoal?.toString() ?? '', details: structuredClone({...unit.details}),
        pov: 'povCardId' in unit ? unit.povCardId ?? '' : '', location: 'locationCardId' in unit ? unit.locationCardId ?? '' : '',
    }
}
export function metadataSeed(unit: MetadataUnit, kind: MetadataKind): MetadataCheckpoint {
    const form = metadataForm(unit)
    return {kind,unitId:unit.id,baseRevision:unit.metadataRevision,sourceRevision:kind==='scene'?(unit as StoryScene).revision:null,base:form,form:structuredClone(form),pending:null}
}
export const metadataDirty = (checkpoint: MetadataCheckpoint): boolean => canonicalJson(checkpoint.form)!==canonicalJson(checkpoint.base)
function isForm(value:unknown):value is MetadataForm {
    return isRecord(value)&&Object.keys(value).length===7&&['title','description','status','goal','pov','location'].every((key)=>typeof value[key]==='string')&&isRecord(value.details)
}
export function readMetadataJournal(key:string|null,kind:MetadataKind,unitId:string):NovelJournalRecord<MetadataCheckpoint>|null {
    return readNovelMutation(key,(value):value is MetadataCheckpoint=>isRecord(value)&&value.kind===kind&&value.unitId===unitId&&isNovelRevision(value.baseRevision)
        &&(value.sourceRevision===null||isNovelRevision(value.sourceRevision))&&isForm(value.base)&&isForm(value.form)
        &&(value.pending===null||(isRecord(value.pending)&&isNovelRequestId(value.pending.requestId)&&isNovelRevision(value.pending.expectedMetadataRevision)
            &&canonicalJson(metadataPatch(value as unknown as MetadataCheckpoint,value.pending.requestId,pendingBasis(value.pending)))===canonicalJson(value.pending))))
}
/** The basis a pending chapter, part or novel write tied its hand-edited summary to; a cleared summary has none. */
function pendingBasis(pending:Record<string,unknown>):string[]|undefined {
    const basis=isRecord(pending.details)?pending.details.summaryBasis:undefined
    return Array.isArray(basis)&&basis.every((entry)=>typeof entry==='string')?basis:basis===null?[]:undefined
}
/** Rebase only the author's changed fields onto the freshly read account version. */
export function rebaseMetadata(previous:MetadataCheckpoint,account:MetadataCheckpoint):MetadataCheckpoint {
    const form=structuredClone(account.form)
    for(const key of ['title','description','status','goal','pov','location'] as const){
        if(previous.form[key]!==previous.base[key])form[key]=previous.form[key]
    }
    for(const key of new Set([...Object.keys(previous.base.details),...Object.keys(previous.form.details)])){
        if(canonicalJson(previous.form.details[key])===canonicalJson(previous.base.details[key]))continue
        if(key in previous.form.details)form.details[key]=structuredClone(previous.form.details[key])
        else delete form.details[key]
    }
    return {...account,form,sourceRevision:previous.form.details.summary!==previous.base.details.summary?previous.sourceRevision:account.sourceRevision}
}
/** `summaryBasis` is today's covered scenes of the chapter, part or novel: a summary edited by hand is written for them (rest of K09/A14). */
export function metadataPatch(checkpoint:MetadataCheckpoint,requestId:string,summaryBasis?:string[]):StoryUnitWrite|null {
    const {base,form,kind}=checkpoint
    if(kind!=='novel'&&!checkpoint.pending&&!isStoryUnitDetails(form.details))return null
    if(kind==='novel'&&!checkpoint.pending&&(!isStoryNovelDetails(form.details)||form.description!==base.description&&new TextEncoder().encode(form.description).length>60_000))return null
    const wordGoal=form.goal.trim()===''?null:Number(form.goal)
    if(!form.title.trim()||Array.from(form.title.trim()).length>255||wordGoal!==null&&(!Number.isInteger(wordGoal)||wordGoal<1||wordGoal>2_147_483_647))return null
    if(!['draft','revising','complete',...(kind==='novel'?[]:[''])].includes(form.status))return null
    const write:Record<string,unknown>={requestId,expectedMetadataRevision:checkpoint.baseRevision}
    if(form.title!==base.title)write.title=form.title.trim()
    if(form.status!==base.status)write.status=form.status||null
    if(form.goal!==base.goal)write.wordGoal=wordGoal
    if(kind==='novel'){
        if(form.description!==base.description)write.description=form.description||null
    }else{
        if(form.pov!==base.pov)write.povCardId=form.pov||null
        if(form.location!==base.location)write.locationCardId=form.location||null
    }
    if(canonicalJson(form.details)!==canonicalJson(base.details)){
        const edited=form.details.summary!==base.details.summary
        write.details={...form.details,...(kind==='scene'&&edited?{summaryRevision:checkpoint.sourceRevision}:{}),
            ...((kind==='chapter'||kind==='part'||kind==='novel')&&edited&&summaryBasis?{summaryBasis:form.details.summary?summaryBasis:null}:{})}
    }
    return Object.keys(write).length>2?write as unknown as StoryUnitWrite:null
}
export function metadataUnit(story:StoryOutline,kind:MetadataKind,id:string):MetadataUnit|null {
    if(kind==='novel')return story.id===id?story:null
    if(kind==='part')return story.parts.find((unit)=>unit.id===id)??null
    if(kind==='chapter')return story.chapters.find((unit)=>unit.id===id)??null
    return story.chapters.flatMap((chapter)=>chapter.scenes).find((unit)=>unit.id===id)??null
}
