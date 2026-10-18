import { isRecord } from '@/shared/novelMutationJournal'
import { isSnapshotHash } from '@/shared/storySnapshotOperation'
import { studioInheritance } from '@/shared/storyStudioState'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import type { StoryAssistantAction,StoryAssistantActionKind,StoryAssistantContext,StoryAssistantContextRequest,StoryAssistantLineEditFocus,StoryAssistantSource,StoryAssistantCard,StoryAssistantConflict,StoryAssistantPacketFact,StoryAssistantPacketSummary,StoryAssistantSummaryExclusion,StoryAssistantPacketChapter,StoryAssistantPacketChapterSummary,StoryAssistantPacketPart,StoryAssistantPacketPartSummary,StoryAssistantSummaryCoverage } from '@/shared/types/storyAssistant.types'
import { canonicalJson } from '@/utils/json'
import { isAnnotationAnchor,isAnnotationSelection } from './storyAnnotationContract'
import { isPacketStyle,packetStyle } from '@/shared/storyStyleSheet'
import { isAssistantPreferences } from '@/shared/storyAssistantPreferences'
import { orderedParts,partBases,readingRows,sameBasis,summaryBases } from '@/shared/storySummaryBasis'

const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(key=>keys.includes(key))
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&Array.from(v).length<=max&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)
const id=(v:unknown):v is string=>text(v,64)&&Boolean(v)&&v===v.trim()
const unique=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(id)&&new Set(v).size===v.length
const kinds=['character','world','item','adventure_template','lorebook','lorebook_entry','snapshot_card']
const FACT_KINDS=['knowledge','relationship','possession','location','state','trait','event']
const PACKET=['schemaVersion','storyId','sourceVersion','task','message','scope','revealPolicy','novel','anchorSceneId','readOnly','sources','cards','conflicts']
const TRACE=['estimator','inputEstimate','outputReserve','contextWindow','eligibleScenes','consideredScenes','includedScenes','excluded','cardExclusions','conflicts']
const optional=(v:Record<string,unknown>,keys:string[],...extras:string[])=>exact(v,[...keys,...extras.filter(extra=>extra in v)])
const filled=(v:unknown,max:number):v is string=>text(v,max)&&Boolean(v.trim())
// Saved scene summaries (K09), as the BFF compiler bounds them.
export const MAX_CONTEXT_SUMMARIES=40,MAX_SUMMARY_CHARS=4000
const SUMMARY_REASONS:StoryAssistantSummaryExclusion[]=['stale','unverified','too_long','limit','budget','chapter','part']
// Saved chapter, part and book summaries (rest of K09/A14), as the BFF compiler bounds them.
export const MAX_CONTEXT_CHAPTER_SUMMARIES=20,MAX_CONTEXT_PART_SUMMARIES=20
const WIDE_REASONS=['stale','unverified','too_long','limit','budget'],CHAPTER_REASONS=[...WIDE_REASONS,'part']
const PACKET_EXTRAS=['facts','action','readingOrder','style','preferences','summaries','chapters','bookScenes','bookSummary','chapterSummaries','parts','partSummaries']
const TRACE_EXTRAS=['factExclusions','styleOmitted','summaryExclusions','chapterSummaryExclusions','bookSummaryOmitted','partSummaryExclusions','summaryCoverage']
const BASIS_ENTRY=/^[A-Za-z0-9._:-]{1,128}@[1-9][0-9]{0,9}$/
const sceneOf=(entry:string)=>entry.slice(0,entry.lastIndexOf('@'))
/** With the summary action: each read chapter that has covered scenes, in reading order, and the book's count of covered scenes. */
function chaptersShape(p:Record<string,unknown>,q:StoryAssistantContextRequest):boolean {
    // Replies saved before chapter summaries existed have summary packets without these rows; they stay valid.
    if('chapters'in p!=='bookScenes'in p)return false
    if(!('chapters'in p))return true
    if(q.action?.kind!=='summary')return false
    const sources=Array.isArray(p.sources)?p.sources as StoryAssistantSource[]:[],expected:string[]=[]
    for(const scene of (p.readingOrder??[]) as string[]){const chapter=sources.find(s=>s.sceneId===scene)?.chapterId;if(chapter&&!expected.includes(chapter))expected.push(chapter)}
    if(!Array.isArray(p.chapters)||!p.chapters.every(row=>isRecord(row)&&exact(row,['chapterId','title','sceneIds'])&&text(row.title,255)&&unique(row.sceneIds)&&row.sceneIds.length>0))return false
    const named=(p.chapters as StoryAssistantPacketChapter[]).map(row=>row.chapterId)
    if(canonicalJson(expected.filter(chapter=>named.includes(chapter)))!==canonicalJson(named)
        ||!integer(p.bookScenes)||(p.chapters as StoryAssistantPacketChapter[]).reduce((n,row)=>n+row.sceneIds.length,0)>p.bookScenes)return false
    // Each part with covered scenes and its chapters (rest of K09); absent in a novel without parts and in earlier replies.
    if(!('parts'in p))return true
    if(!Array.isArray(p.parts)||!p.parts.length||!p.parts.every(row=>isRecord(row)&&exact(row,['partId','title','chapterIds'])&&id(row.partId)&&text(row.title,255)&&unique(row.chapterIds)&&row.chapterIds.length>0))return false
    const parts=p.parts as StoryAssistantPacketPart[],owner=new Map<string,string>()
    if(new Set(parts.map(row=>row.partId)).size!==parts.length)return false
    for(const row of parts)for(const chapter of row.chapterIds){if(owner.has(chapter))return false;owner.set(chapter,row.partId)}
    // A read chapter with covered scenes is listed under the part its sources name.
    return sources.every(s=>(owner.get(s.chapterId)??s.partId)===s.partId&&!(named.includes(s.chapterId)&&s.partId!==null&&!owner.has(s.chapterId)))
}
/** With the summary action (since part summaries): what each chapter, part and book summary from the reply covers, in reading order. */
function coverageShape(p:Record<string,unknown>,t:Record<string,unknown>):boolean {
    if(!('summaryCoverage'in t))return !('parts'in p)  // Replies saved before part summaries carry neither.
    const coverage=t.summaryCoverage
    if(!('chapters'in p)||!isRecord(coverage)||!exact(coverage,['book','chapters',...('parts'in p?['parts']:[])])||!isRecord(coverage.book)||!exact(coverage.book,['scenes','covered']))return false
    const book=coverage.book,chapters=p.chapters as StoryAssistantPacketChapter[]
    if(book.scenes!==p.bookScenes||!Array.isArray(book.covered)||book.covered.length>Number(book.scenes)||!book.covered.every(entry=>typeof entry==='string'&&BASIS_ENTRY.test(entry))
        ||new Set(book.covered).size!==book.covered.length)return false
    const covered=book.covered as string[],order=new Map(covered.map((entry,n)=>[entry,n])),held=new Map(covered.map(entry=>[sceneOf(entry),entry]))
    const unit=(row:Record<string,unknown>)=>integer(row.scenes,1)&&Array.isArray(row.covered)&&row.covered.length<=row.scenes&&row.covered.every(entry=>order.has(entry as string))
        &&row.covered.every((entry,n,all)=>n===0||order.get(entry as string)!>order.get(all[n-1] as string)!)
    if(!Array.isArray(coverage.chapters)||coverage.chapters.length!==chapters.length)return false
    const sources=p.sources as StoryAssistantSource[],summaries=(p.summaries??[]) as StoryAssistantPacketSummary[]
    for(const [n,row] of coverage.chapters.entries()){
        const chapter=chapters[n]
        if(!isRecord(row)||!exact(row,['chapterId','scenes','covered'])||row.chapterId!==chapter.chapterId||row.scenes!==chapter.sceneIds.length||!unit(row)
            ||canonicalJson(row.covered)!==canonicalJson(covered.filter(entry=>chapter.sceneIds.includes(sceneOf(entry)))))return false
        // A scene read whole or standing behind a sent scene summary is always covered.
        if(sources.some(s=>chapter.sceneIds.includes(s.sceneId)&&s.complete&&held.get(s.sceneId)!==`${s.sceneId}@${s.revision}`)
            ||summaries.some(s=>chapter.sceneIds.includes(s.sceneId)&&held.get(s.sceneId)!==`${s.sceneId}@${s.revision}`))return false
    }
    if(!('parts'in p))return true
    const parts=p.parts as StoryAssistantPacketPart[]
    return Array.isArray(coverage.parts)&&coverage.parts.length===parts.length
        &&coverage.parts.every((row,n)=>isRecord(row)&&exact(row,['partId','scenes','covered'])&&row.partId===parts[n].partId&&unit(row))
}
/** The book summary (whole-novel author analysis) and chapter summaries of chapters none of whose scenes were read. */
function wideSummariesShape(p:Record<string,unknown>,t:Record<string,unknown>,q:StoryAssistantContextRequest):boolean {
    const read=new Set((Array.isArray(p.sources)?p.sources as StoryAssistantSource[]:[]).map(s=>s.chapterId)),named=new Set<string>()
    if('bookSummary'in p||'bookSummaryOmitted'in t){
        if(q.scope!=='novel'||q.revealPolicy!=='author_analysis'||'bookSummary'in p&&'bookSummaryOmitted'in t)return false
        if('bookSummary'in p&&!(isRecord(p.bookSummary)&&exact(p.bookSummary,['text'])&&text(p.bookSummary.text,MAX_SUMMARY_CHARS)&&p.bookSummary.text))return false
        if('bookSummaryOmitted'in t&&!['stale','unverified','too_long','budget'].includes(String(t.bookSummaryOmitted)))return false
    }
    const readParts=new Set((Array.isArray(p.sources)?p.sources as StoryAssistantSource[]:[]).map(s=>s.partId)),partsNamed=new Set<string>()
    if('partSummaries'in p){
        if(!Array.isArray(p.partSummaries)||p.partSummaries.length<1||p.partSummaries.length>MAX_CONTEXT_PART_SUMMARIES)return false
        for(const row of p.partSummaries){
            if(!isRecord(row)||!exact(row,['partId','title','text'])||!id(row.partId)||!text(row.title,255)||!text(row.text,MAX_SUMMARY_CHARS)||!row.text
                ||partsNamed.has(row.partId)||readParts.has(row.partId))return false
            partsNamed.add(row.partId)
        }
    }
    if('partSummaryExclusions'in t){
        if(!Array.isArray(t.partSummaryExclusions)||!t.partSummaryExclusions.length)return false
        for(const row of t.partSummaryExclusions){
            if(!isRecord(row)||!exact(row,['partId','reason'])||!id(row.partId)||!WIDE_REASONS.includes(String(row.reason))||partsNamed.has(row.partId)||readParts.has(row.partId))return false
            partsNamed.add(row.partId)
        }
    }
    if('chapterSummaries'in p){
        if(!Array.isArray(p.chapterSummaries)||p.chapterSummaries.length<1||p.chapterSummaries.length>MAX_CONTEXT_CHAPTER_SUMMARIES)return false
        for(const row of p.chapterSummaries){
            if(!isRecord(row)||!exact(row,['chapterId','title','text'])||!id(row.chapterId)||!text(row.title,255)||!text(row.text,MAX_SUMMARY_CHARS)||!row.text
                ||named.has(row.chapterId)||read.has(row.chapterId))return false
            named.add(row.chapterId)
        }
    }
    if('chapterSummaryExclusions'in t){
        if(!Array.isArray(t.chapterSummaryExclusions)||!t.chapterSummaryExclusions.length)return false
        for(const row of t.chapterSummaryExclusions){
            if(!isRecord(row)||!exact(row,['chapterId','reason'])||!id(row.chapterId)||!CHAPTER_REASONS.includes(String(row.reason))||named.has(row.chapterId)||read.has(row.chapterId))return false
            named.add(row.chapterId)
        }
    }
    return true
}
/** Summaries and their exclusions are optional; when present they are nonempty, bounded, name each scene once and never a source. */
function summariesShape(p:Record<string,unknown>,t:Record<string,unknown>,scenes:ReadonlySet<string>):boolean {
    const named=new Set<string>()
    if('summaries'in p){
        if(!Array.isArray(p.summaries)||p.summaries.length<1||p.summaries.length>MAX_CONTEXT_SUMMARIES)return false
        for(const row of p.summaries){
            if(!isRecord(row)||!exact(row,['sceneId','title','revision','text'])||!id(row.sceneId)||!integer(row.revision,1)||!text(row.title,255)
                ||!text(row.text,MAX_SUMMARY_CHARS)||!row.text||named.has(row.sceneId)||scenes.has(row.sceneId))return false
            named.add(row.sceneId)
        }
    }
    if('summaryExclusions'in t){
        if(!Array.isArray(t.summaryExclusions)||!t.summaryExclusions.length)return false
        for(const row of t.summaryExclusions){
            if(!isRecord(row)||!exact(row,['sceneId','reason'])||!id(row.sceneId)||!SUMMARY_REASONS.includes(row.reason as StoryAssistantSummaryExclusion)
                ||named.has(row.sceneId)||scenes.has(row.sceneId))return false
            named.add(row.sceneId)
        }
    }
    return true
}

function contextFact(v:unknown):v is StoryAssistantPacketFact {
    return isRecord(v)&&exact(v,['id','revision','subject','kind','statement','object','fromSceneId','untilSceneId'])&&id(v.id)&&integer(v.revision,1)
        &&FACT_KINDS.includes(String(v.kind))&&filled(v.subject,255)&&filled(v.statement,2000)&&(v.object===null||text(v.object,255))
        &&(v.fromSceneId===null||id(v.fromSceneId))&&(v.untilSceneId===null||id(v.untilSceneId))
}
/** Approved facts and their exclusions are optional; when present they are nonempty, unique and bounded. */
function factsShape(p:Record<string,unknown>,t:Record<string,unknown>):boolean {
    if('facts'in p&&(!Array.isArray(p.facts)||p.facts.length<1||p.facts.length>120||!p.facts.every(contextFact)||new Set(p.facts.map(f=>f.id)).size!==p.facts.length))return false
    return !('factExclusions'in t)||Array.isArray(t.factExclusions)&&t.factExclusions.length>0
        &&t.factExclusions.every(r=>isRecord(r)&&exact(r,['factId','reason'])&&id(r.factId)&&['limit','budget'].includes(String(r.reason)))
}

/** The packet lists its source scenes in reading order; replies saved before every packet did lack it only without an action. */
function readingOrder(p:Record<string,unknown>):boolean {
    if(!('readingOrder'in p))return !('action'in p)
    const sources=Array.isArray(p.sources)?p.sources.map(s=>isRecord(s)?s.sceneId:null):[]
    return unique(p.readingOrder)&&p.readingOrder.length===sources.length&&p.readingOrder.every(id=>sources.includes(id))
}
/** Writing actions return a reviewable proposal (Suggest); the others answer in prose (Ask). */
export const ASSISTANT_ACTION_TASKS:Record<StoryAssistantActionKind,StoryAssistantContextRequest['task']>={transform:'suggest',line_edit:'suggest',dialogue:'suggest',bridge:'suggest',brainstorm:'ask',outline:'ask',summary:'ask'}
export const LINE_EDIT_FOCUS:readonly StoryAssistantLineEditFocus[]=['grammar','clarity','repetition','rhythm','word_choice']
export function isAssistantAction(v:unknown):v is StoryAssistantAction {
    if(!isRecord(v))return false
    switch(v.kind){
        case 'transform':return exact(v,['kind','pov','tense'])&&[null,'first','second','third'].includes(v.pov as string|null)&&[null,'past','present'].includes(v.tense as string|null)&&(v.pov!==null||v.tense!==null)
        case 'line_edit':return exact(v,['kind','focus'])&&Array.isArray(v.focus)&&v.focus.length>0&&v.focus.every(f=>LINE_EDIT_FOCUS.includes(f))&&new Set(v.focus).size===v.focus.length
        case 'dialogue':return exact(v,['kind','speaker'])&&filled(v.speaker,120)&&v.speaker===v.speaker.trim()
        case 'brainstorm':return exact(v,['kind','topic'])&&['premise','conflict','stakes','names','what_if'].includes(String(v.topic))
        case 'outline':return exact(v,['kind','target'])&&['synopsis','beats','chapter_plan'].includes(String(v.target))
        case 'bridge':case 'summary':return exact(v,['kind'])
        default:return false
    }
}
export function isAssistantContextRequest(v:unknown):v is StoryAssistantContextRequest {
    if(!isRecord(v)||!optional(v,['sourceVersion','anchorSceneId','scope','sceneIds','selection','task','message','revealPolicy','includeArchived','includeCodex','limits'],'action')
        ||'action'in v&&(!isAssistantAction(v.action)||ASSISTANT_ACTION_TASKS[v.action.kind]!==v.task)
        ||!isSnapshotHash(v.sourceVersion)||!id(v.anchorSceneId)||!['selection','scene','chapter','novel','scenes'].includes(String(v.scope))
        ||!unique(v.sceneIds)||v.sceneIds.length>20||!['ask','suggest'].includes(String(v.task))||!text(v.message,4000)||!v.message.trim()||v.message!==v.message.trim()
        ||!['through_anchor','author_analysis'].includes(String(v.revealPolicy))||typeof v.includeArchived!=='boolean'||typeof v.includeCodex!=='boolean'
        ||!isRecord(v.limits)||!exact(v.limits,['contextWindow','outputTokens','maxSources','maxPassages']))return false
    const l=v.limits
    return integer(l.contextWindow,1024,262144)&&integer(l.outputTokens,1,65536)&&l.outputTokens<l.contextWindow&&integer(l.maxSources,1,20)&&integer(l.maxPassages,1,80)
        &&(v.scope==='scenes'?v.sceneIds.includes(v.anchorSceneId):v.sceneIds.length===0)
        &&(v.scope==='selection'?isAnnotationSelection(v.selection)&&v.selection.sceneId===v.anchorSceneId&&Boolean(v.selection.quote):v.selection===null)
}
function source(v:unknown):v is StoryAssistantSource {
    if(!isRecord(v)||!exact(v,['sceneId','chapterId','partId','title','chapterTitle','revision','metadataRevision','contentHash','chapterMetadataRevision','partMetadataRevision','readOnly','writing','complete','passages'])
        ||!id(v.sceneId)||!id(v.chapterId)||!text(v.title,255)||!text(v.chapterTitle,255)||!integer(v.revision,1)||!integer(v.metadataRevision,1)||!isSnapshotHash(v.contentHash)
        ||!integer(v.chapterMetadataRevision,1)||(v.partId===null?v.partMetadataRevision!==null:!id(v.partId)||!integer(v.partMetadataRevision,1))
        ||!isRecord(v.writing)||!Object.entries(v.writing).every(([key,value])=>['status','povCardId','locationCardId','narrator','tense'].includes(key)&&typeof value==='string')
        ||typeof v.readOnly!=='boolean'||typeof v.complete!=='boolean'||!Array.isArray(v.passages)||v.passages.length>80)return false
    let end=-1
    return v.passages.every(p=>{
        if(!isRecord(p)||!exact(p,['id','startOffset','endOffset','quote','anchor'])||!isSnapshotHash(p.id)||!integer(p.startOffset)||!integer(p.endOffset,p.startOffset+1)
            ||p.startOffset<end||!text(p.quote,262144)||p.quote.length!==p.endOffset-p.startOffset)return false
        end=p.endOffset
        return p.anchor===null||isAnnotationAnchor(p.anchor)&&p.anchor.sceneId===v.sceneId&&p.anchor.revision===v.revision&&p.anchor.contentHash===v.contentHash&&p.anchor.quote===p.quote
    })
}
function card(v:unknown):v is StoryAssistantCard {
    return isRecord(v)&&exact(v,['referenceId','kind','cardId','title','text','snapshotHash','sourceVersionId','appliesTo'])&&id(v.referenceId)&&kinds.includes(String(v.kind))&&id(v.cardId)
        &&text(v.title,255)&&text(v.text,262144)&&Boolean(v.text)&&isSnapshotHash(v.snapshotHash)&&(v.sourceVersionId===null||id(v.sourceVersionId))&&unique(v.appliesTo)&&v.appliesTo.length>0
}
function conflict(v:unknown):v is StoryAssistantConflict {
    return isRecord(v)&&exact(v,['kind','cardId','referenceIds'])&&kinds.includes(String(v.kind))&&id(v.cardId)&&unique(v.referenceIds)&&v.referenceIds.length>1
}
/** Verify one source-bound preview, including the actual messages and conservative byte count. */
export function verifyAssistantContext(v:unknown,index:StoryStudioIndex,request:StoryAssistantContextRequest):v is StoryAssistantContext {
    if(!isAssistantContextRequest(request)||request.sourceVersion!==index.sourceVersion||!isRecord(v)||!exact(v,['schemaVersion','projection','storyId','sourceVersion','request','packet','messages','packetHash','trace'])
        ||v.schemaVersion!==1||v.projection!=='assistant_context'||v.storyId!==index.id||v.sourceVersion!==index.sourceVersion||canonicalJson(v.request)!==canonicalJson(request)||!isSnapshotHash(v.packetHash)
        ||!isRecord(v.packet)||!optional(v.packet,PACKET,...PACKET_EXTRAS))return false
    const p=v.packet
    if(canonicalJson(p.action??null)!==canonicalJson(request.action??null)||!readingOrder(p)||p.schemaVersion!==1||p.storyId!==index.id||p.sourceVersion!==index.sourceVersion||p.task!==request.task||p.message!==request.message||p.scope!==request.scope||p.revealPolicy!==request.revealPolicy
        ||p.anchorSceneId!==request.anchorSceneId||typeof p.readOnly!=='boolean'||!isRecord(p.novel)||!exact(p.novel,['title','metadataRevision','structureRevision','contextRevision','writing'])
        ||p.novel.title!==index.title||p.novel.metadataRevision!==index.metadataRevision||p.novel.structureRevision!==index.structureRevision||p.novel.contextRevision!==index.contextRevision)return false
    const writing=Object.fromEntries(['language','genre','styleGuide','narrator','tense'].filter(k=>index.details[k as keyof typeof index.details]!=null).map(k=>[k,index.details[k as keyof typeof index.details]]))
    if(canonicalJson(p.novel.writing)!==canonicalJson(writing)||!Array.isArray(p.sources)||!p.sources.every(source)||p.sources.length<1||p.sources.length>request.limits.maxSources
        ||p.sources[0].sceneId!==request.anchorSceneId||new Set(p.sources.map(s=>s.sceneId)).size!==p.sources.length||!Array.isArray(p.cards)||!p.cards.every(card)
        ||new Set(p.cards.map(c=>c.referenceId)).size!==p.cards.length||!Array.isArray(p.conflicts)||!p.conflicts.every(conflict))return false
    const parts=new Map([...index.parts].sort((a,b)=>a.order-b.order||(a.id<b.id?-1:a.id>b.id?1:0)).map((part,n)=>[part.id,{part,position:n+1}]))
    const ordered=[...index.chapters].sort((a,b)=>(parts.get(a.partId??'')?.position??0)-(parts.get(b.partId??'')?.position??0)||a.order-b.order||(a.id<b.id?-1:a.id>b.id?1:0))
        .flatMap(chapter=>[...chapter.scenes].sort((a,b)=>a.order-b.order||(a.id<b.id?-1:a.id>b.id?1:0)).map(scene=>({chapter,scene,part:parts.get(chapter.partId??'')?.part,inheritance:studioInheritance(index,chapter,scene)})))
    const anchor=ordered.find(row=>row.scene.id===request.anchorSceneId),anchorPosition=ordered.findIndex(row=>row===anchor)
    if(!anchor||index.trashedAt||anchor.inheritance.readOnly&&!p.readOnly||!request.sceneIds.every(id=>ordered.some(row=>row.scene.id===id)))return false
    const scoped=ordered.filter(row=>request.scope==='scene'||request.scope==='selection'?row===anchor:request.scope==='chapter'?row.chapter.id===anchor.chapter.id:request.scope==='scenes'?request.sceneIds.includes(row.scene.id):true)
    const eligible=scoped.filter(row=>!row.scene.trashedAt&&!row.chapter.trashedAt&&!row.part?.trashedAt&&!row.scene.mergedInto&&!row.chapter.mergedInto&&!row.part?.mergedInto
        &&(request.includeArchived||!row.inheritance.readOnly)&&row.inheritance.values.includeInAI&&(request.revealPolicy==='author_analysis'||ordered.indexOf(row)<=anchorPosition))
    const included=new Set(p.sources.map(s=>s.sceneId)),passageIds=new Set<string>();let passageCount=0
    for(const s of p.sources){
        const row=eligible.find(row=>row.scene.id===s.sceneId)
        if(!row||s.chapterId!==row.chapter.id||s.partId!==row.chapter.partId||s.title!==row.scene.title||s.chapterTitle!==row.chapter.title||s.revision!==row.scene.revision||s.contentHash!==row.scene.contentHash
            ||s.metadataRevision!==row.scene.metadataRevision||s.chapterMetadataRevision!==row.chapter.metadataRevision||s.partMetadataRevision!==(row.part?.metadataRevision??null)||s.readOnly!==row.inheritance.readOnly
            ||canonicalJson(s.writing)!==canonicalJson(Object.fromEntries(Object.entries(row.inheritance.values).filter(([key])=>['status','povCardId','locationCardId','narrator','tense'].includes(key)))))return false
        for(const passage of s.passages){if(passageIds.has(passage.id))return false;passageIds.add(passage.id);passageCount++}
        if(s.sceneId!==request.anchorSceneId&&!s.passages.length)return false
    }
    if(passageCount>request.limits.maxPassages)return false
    const target=p.sources[0]
    if(request.selection){const span=target.passages[0],selection=request.selection
        if(target.passages.length!==1||!span.anchor||span.startOffset!==selection.startOffset||span.endOffset!==selection.endOffset||span.quote!==selection.quote
            ||target.revision!==selection.expectedRevision||target.contentHash!==selection.expectedContentHash)return false
    }else if(!target.complete||target.passages.length>1||target.passages[0]&&target.passages[0].startOffset!==0)return false
    const sources=p.sources
    for(const c of p.cards){
        const ref=index.activeCardRefs.find(ref=>ref.id===c.referenceId)
        if(!request.includeCodex||!index.activeContext.includeSelectedCards||!ref||!ref.enabled||ref.removedAt||ref.kind!==c.kind||ref.cardId!==c.cardId
            ||c.sourceVersionId!==(ref.snapshot.source_card_version_id??null)||c.appliesTo.some(sceneId=>!included.has(sceneId)||ref.sceneId!==null&&ref.sceneId!==sceneId
                ||ref.sceneId===null&&ref.chapterId!==null&&ref.chapterId!==sources.find(s=>s.sceneId===sceneId)?.chapterId))return false
        for(const sceneId of c.appliesTo){
            const chapterId=sources.find(s=>s.sceneId===sceneId)?.chapterId
            const effective=index.activeCardRefs.filter(r=>!r.removedAt&&r.kind===c.kind&&r.cardId===c.cardId&&(r.sceneId===sceneId||r.sceneId===null&&(r.chapterId===null||r.chapterId===chapterId)))
                .sort((a,b)=>(b.sceneId?2:b.chapterId?1:0)-(a.sceneId?2:a.chapterId?1:0)||a.precedence-b.precedence||(a.id<b.id?-1:a.id>b.id?1:0))[0]
            if(effective?.id!==c.referenceId)return false
        }
        if((['lorebook','lorebook_entry'].includes(c.kind)||ref.snapshot.source_lorebook_id)&&(!index.activeContext.includeLorebooks||request.revealPolicy!=='author_analysis'))return false
    }
    const groups=new Map<string,StoryAssistantCard[]>()
    for(const c of p.cards){const key=canonicalJson([c.kind,c.cardId]);groups.set(key,[...(groups.get(key)??[]),c])}
    const conflicts=[...groups.values()].filter(cards=>new Set(cards.map(c=>c.snapshotHash)).size>1).map(cards=>({kind:cards[0].kind,cardId:cards[0].cardId,referenceIds:cards.map(c=>c.referenceId)}))
    if(canonicalJson(p.conflicts)!==canonicalJson(conflicts)||!Array.isArray(v.messages)||v.messages.length!==2||!isRecord(v.messages[0])||!isRecord(v.messages[1])
        ||!v.messages.every(m=>exact(m,['role','content']))||v.messages[0].role!=='system'||!text(v.messages[0].content,20000)||!v.messages[0].content||v.messages[1].role!=='user'||v.messages[1].content!==canonicalJson(p)
        ||!isRecord(v.trace)||!optional(v.trace,TRACE,...TRACE_EXTRAS)||!factsShape(p,v.trace)||!summariesShape(p,v.trace,included)||!chaptersShape(p,request)||!wideSummariesShape(p,v.trace,request)||!coverageShape(p,v.trace))return false
    // Exactly the compiler's style part: the sheet's conventions, its examples unless left out for room, and the cited characters' voices.
    const sheet=index.details.styleSheet??null,omitted=v.trace.styleOmitted
    if(omitted!==undefined&&!(omitted==='all'&&sheet||omitted==='examples'&&sheet?.examples.length)
        ||canonicalJson(p.style??null)!==canonicalJson(omitted==='all'?null:packetStyle(sheet,p.cards,omitted!=='examples')))return false
    // The account's reply preferences come from the server's own read; only their exact shape is checked here.
    if('preferences'in p&&!isAssistantPreferences(p.preferences))return false
    const facts=p.facts as StoryAssistantPacketFact[]|undefined // Shape checked by factsShape above.
    if(facts){
        // Exactly the compiler's rule: holds at an included scene, never begins after the anchor through it, in reading order.
        const position=new Map(ordered.map((row,n)=>[row.scene.id,n])),at=p.sources.map(s=>position.get(s.sceneId)??-2)
        let previous:[number,string]|null=null
        for(const f of facts){
            const start=f.fromSceneId===null?-1:position.get(f.fromSceneId),end=f.untilSceneId===null?ordered.length:position.get(f.untilSceneId)
            if(start===undefined||end===undefined||request.revealPolicy==='through_anchor'&&start>anchorPosition||!at.some(n=>start<=n&&n<end)
                ||previous&&(previous[0]>start||previous[0]===start&&previous[1]>=f.id))return false
            previous=[start,f.id]
        }
    }
    // Exactly the compiler's chapter rows for the summary action: today's covered scenes of each read chapter, and of the book.
    const bases=summaryBases(index),partBasis=partBases(index)
    if(request.action?.kind==='summary'!=='chapters'in p||request.action?.kind==='summary'!=='summaryCoverage'in v.trace)return false
    if(request.action?.kind==='summary'){
        const read=[...new Set((p.readingOrder as string[]).map(scene=>sources.find(s=>s.sceneId===scene)!.chapterId))]
        const chapters=read.filter(chapter=>bases.chapters.has(chapter)).map(chapter=>({chapterId:chapter,title:index.chapters.find(c=>c.id===chapter)?.title,sceneIds:bases.chapters.get(chapter)!.map(sceneOf)}))
        if(canonicalJson(p.chapters)!==canonicalJson(chapters)||p.bookScenes!==bases.book.length)return false
        const partChapters=new Map<string,string[]>()
        for(const chapter of bases.chapters.keys()){
            const partId=index.chapters.find(c=>c.id===chapter)?.partId
            if(partId&&partBasis.has(partId))partChapters.set(partId,[...(partChapters.get(partId)??[]),chapter])
        }
        const parts=orderedParts(index.parts).filter(part=>partChapters.has(part.id)).map(part=>({partId:part.id,title:part.title,chapterIds:partChapters.get(part.id)}))
        if(canonicalJson(p.parts??[])!==canonicalJson(parts)||'parts'in p!==parts.length>0)return false
    }
    // Exactly the compiler's book summary: whole-novel author analysis with unread in-scope scenes, only while written for today's scenes.
    const book=index.details.summary,bookOmitted=v.trace.bookSummaryOmitted
    if(request.scope==='novel'&&request.revealPolicy==='author_analysis'&&typeof book==='string'&&book&&eligible.some(row=>!included.has(row.scene.id))){
        const written=index.details.summaryBasis,reason=written==null?'unverified':!sameBasis(written,bases.book)?'stale':Array.from(book).length>MAX_SUMMARY_CHARS?'too_long':null
        if(reason===null?!(canonicalJson(p.bookSummary)===canonicalJson({text:book})&&bookOmitted===undefined||!('bookSummary'in p)&&bookOmitted==='budget')
            :'bookSummary'in p||bookOmitted!==reason)return false
    }else if('bookSummary'in p||bookOmitted!==undefined)return false
    // Exactly the compiler's part summaries: wholly in-scope parts none of whose scenes were read, in reading order, while written for today's scenes.
    const eligibleIds=new Set(eligible.map(row=>row.scene.id)),readChapters=new Set(sources.map(s=>s.chapterId)),readParts=new Set(sources.map(s=>s.partId))
    const partSummaries=(p.partSummaries??[]) as StoryAssistantPacketPartSummary[],coveredParts=new Set<string>()
    const partsLeft=new Map(((v.trace.partSummaryExclusions??[]) as Array<{partId:string;reason:string}>).map(row=>[row.partId,row.reason]))
    let partsTaken=0,partsLeftOut=0
    for(const part of orderedParts(index.parts)){
        const basis=partBasis.get(part.id),summary=part.details.summary,written=part.details.summaryBasis
        if(!basis||readParts.has(part.id)||typeof summary!=='string'||!summary||basis.some(entry=>!eligibleIds.has(sceneOf(entry))))continue
        const reason=written==null?'unverified':!sameBasis(written,basis)?'stale':Array.from(summary).length>MAX_SUMMARY_CHARS?'too_long':partsTaken>=MAX_CONTEXT_PART_SUMMARIES?'limit':null
        const entry=partSummaries[partsTaken]
        if(reason===null&&entry?.partId===part.id){
            if(entry.title!==part.title||entry.text!==summary)return false
            partsTaken++;coveredParts.add(part.id);continue
        }
        if(partsLeft.get(part.id)!==(reason??'budget'))return false
        partsLeftOut++
    }
    if(partsTaken!==partSummaries.length||partsLeftOut!==partsLeft.size)return false
    // Exactly the compiler's chapter summaries: wholly in-scope chapters none of whose scenes were read, in reading order, while written for today's scenes.
    const chapterSummaries=(p.chapterSummaries??[]) as StoryAssistantPacketChapterSummary[],covered=new Set<string>()
    const chaptersLeft=new Map(((v.trace.chapterSummaryExclusions??[]) as Array<{chapterId:string;reason:string}>).map(row=>[row.chapterId,row.reason]))
    let chaptersTaken=0,chaptersLeftOut=0
    for(const chapter of [...new Set(readingRows(index).map(row=>row.chapter))]){
        const basis=bases.chapters.get(chapter.id),summary=chapter.details.summary,written=chapter.details.summaryBasis
        if(!basis||readChapters.has(chapter.id)||typeof summary!=='string'||!summary||basis.some(entry=>!eligibleIds.has(sceneOf(entry))))continue
        const reason=chapter.partId&&coveredParts.has(chapter.partId)?'part':written==null?'unverified':!sameBasis(written,basis)?'stale'
            :Array.from(summary).length>MAX_SUMMARY_CHARS?'too_long':chaptersTaken>=MAX_CONTEXT_CHAPTER_SUMMARIES?'limit':null
        const entry=chapterSummaries[chaptersTaken]
        if(reason===null&&entry?.chapterId===chapter.id){
            if(entry.title!==chapter.title||entry.text!==summary)return false
            chaptersTaken++;covered.add(chapter.id);continue
        }
        if(chaptersLeft.get(chapter.id)!==(reason??'budget'))return false
        chaptersLeftOut++
    }
    if(chaptersTaken!==chapterSummaries.length||chaptersLeftOut!==chaptersLeft.size)return false
    // Exactly the compiler's summaries: in reading order, for eligible scenes outside the sources, and only while written for the saved revision.
    const summaries=(p.summaries??[]) as StoryAssistantPacketSummary[]
    const left=new Map(((v.trace.summaryExclusions??[]) as Array<{sceneId:string;reason:string}>).map(row=>[row.sceneId,row.reason]))
    let taken=0,leftOut=0
    for(const row of eligible){
        const summary=row.scene.details.summary,written=row.scene.details.summaryRevision
        if(included.has(row.scene.id)||typeof summary!=='string'||!summary)continue
        const reason=row.chapter.partId&&coveredParts.has(row.chapter.partId)?'part':covered.has(row.chapter.id)?'chapter':written==null?'unverified':written!==row.scene.revision?'stale':Array.from(summary).length>MAX_SUMMARY_CHARS?'too_long':taken>=MAX_CONTEXT_SUMMARIES?'limit':null
        const entry=summaries[taken]
        if(reason===null&&entry?.sceneId===row.scene.id){
            if(entry.title!==row.scene.title||entry.revision!==row.scene.revision||entry.text!==summary)return false
            taken++;continue
        }
        if(left.get(row.scene.id)!==(reason??'budget'))return false
        leftOut++
    }
    if(taken!==summaries.length||leftOut!==left.size)return false
    // Exactly the compiler's coverage: each scene read whole, or standing behind a scene, chapter or part summary it sent.
    if(request.action?.kind==='summary'){
        const whole=new Set(sources.filter(s=>s.complete).map(s=>s.sceneId)),summarized=new Set(summaries.map(s=>s.sceneId)),held:string[]=[],book=new Set(bases.book)
        for(const {chapter,scene} of readingRows(index)){
            const entry=`${scene.id}@${scene.revision}`
            if(book.has(entry)&&(whole.has(scene.id)||summarized.has(scene.id)||covered.has(chapter.id)||chapter.partId&&coveredParts.has(chapter.partId)))held.push(entry)
        }
        const unit=(basis:string[])=>{const within=new Set(basis);return {scenes:basis.length,covered:held.filter(entry=>within.has(entry))}}
        const expected:StoryAssistantSummaryCoverage={book:unit(bases.book),chapters:(p.chapters as StoryAssistantPacketChapter[]).map(row=>({chapterId:row.chapterId,...unit(bases.chapters.get(row.chapterId)!)})),
            ...('parts'in p?{parts:(p.parts as StoryAssistantPacketPart[]).map(row=>({partId:row.partId,...unit(partBasis.get(row.partId)!)}))}:{})}
        if(canonicalJson(v.trace.summaryCoverage)!==canonicalJson(expected))return false
    }
    const trace=v.trace
    if(trace.estimator!=='utf8-message-bytes-v1'||trace.inputEstimate!==new TextEncoder().encode(canonicalJson(v.messages)).length+64||trace.outputReserve!==request.limits.outputTokens
        ||trace.contextWindow!==request.limits.contextWindow||!integer(trace.inputEstimate)||trace.inputEstimate+request.limits.outputTokens>request.limits.contextWindow
        ||trace.eligibleScenes!==eligible.length||trace.consideredScenes!==Math.min(eligible.length,request.limits.maxSources)||trace.includedScenes!==p.sources.length||canonicalJson(trace.conflicts)!==canonicalJson(conflicts)
        ||!Array.isArray(trace.excluded)||!Array.isArray(trace.cardExclusions))return false
    const exclusions=new Set<string>()
    for(const row of trace.excluded){
        if(!isRecord(row)||!exact(row,['sceneId','reason'])||!id(row.sceneId)||!scoped.some(s=>s.scene.id===row.sceneId)||included.has(row.sceneId)||exclusions.has(row.sceneId)
            ||!['trashed','merged','archived','excluded_from_ai','later_scene','source_limit','empty','passage_limit','budget'].includes(String(row.reason)))return false
        exclusions.add(row.sceneId)
    }
    return included.size+exclusions.size===scoped.length&&trace.cardExclusions.every(row=>isRecord(row)&&exact(row,['referenceId','sceneId','reason'])&&id(row.referenceId)&&included.has(String(row.sceneId))
        &&index.activeCardRefs.some(ref=>ref.id===row.referenceId)&&['settings','disabled','reveal_unverified','empty','budget'].includes(String(row.reason)))
}

/** Historical evidence keeps its saved heads; it must not be checked against today's outline. */
export function verifyFrozenAssistantContext(v:unknown,storyId:string):v is StoryAssistantContext {
    if(!isRecord(v)||!exact(v,['schemaVersion','projection','storyId','sourceVersion','request','packet','messages','packetHash','trace'])
        ||v.schemaVersion!==1||v.projection!=='assistant_context'||v.storyId!==storyId||!isAssistantContextRequest(v.request)
        ||v.sourceVersion!==v.request.sourceVersion||!isSnapshotHash(v.packetHash)||!isRecord(v.packet))return false
    const q=v.request,p=v.packet
    if(!optional(p,PACKET,...PACKET_EXTRAS)||'preferences'in p&&!isAssistantPreferences(p.preferences)||canonicalJson(p.action??null)!==canonicalJson(q.action??null)||!readingOrder(p)
        ||p.schemaVersion!==1||p.storyId!==storyId||p.sourceVersion!==q.sourceVersion||p.task!==q.task||p.message!==q.message||p.scope!==q.scope||p.revealPolicy!==q.revealPolicy
        ||p.anchorSceneId!==q.anchorSceneId||typeof p.readOnly!=='boolean'||!isRecord(p.novel)||!exact(p.novel,['title','metadataRevision','structureRevision','contextRevision','writing'])
        ||!text(p.novel.title,255)||!['metadataRevision','structureRevision','contextRevision'].every(k=>integer((p.novel as Record<string,unknown>)[k],1))
        ||!isRecord(p.novel.writing)||!Object.entries(p.novel.writing).every(([k,value])=>['language','genre','styleGuide','narrator','tense'].includes(k)&&text(value,262144))
        ||!Array.isArray(p.sources)||p.sources.length<1||p.sources.length>q.limits.maxSources||!p.sources.every(source)||p.sources[0].sceneId!==q.anchorSceneId
        ||new Set(p.sources.map(s=>s.sceneId)).size!==p.sources.length||!Array.isArray(p.cards)||!p.cards.every(card)||new Set(p.cards.map(c=>c.referenceId)).size!==p.cards.length
        ||!Array.isArray(p.conflicts)||!p.conflicts.every(conflict))return false
    const scenes=new Set(p.sources.map(s=>s.sceneId)),passages=p.sources.flatMap(s=>s.passages)
    if(passages.length>q.limits.maxPassages||new Set(passages.map(p=>p.id)).size!==passages.length
        ||p.sources.some(s=>s.complete&&s.passages.length>0&&(s.passages.length!==1||s.passages[0].startOffset!==0))
        ||p.cards.some(c=>c.appliesTo.some(id=>!scenes.has(id))))return false
    const anchor=p.sources[0]
    if(q.selection){const span=anchor.passages[0],selection=q.selection
        if(anchor.passages.length!==1||!span.anchor||span.startOffset!==selection.startOffset||span.endOffset!==selection.endOffset||span.quote!==selection.quote
            ||anchor.revision!==selection.expectedRevision||anchor.contentHash!==selection.expectedContentHash)return false
    }else if(!anchor.complete)return false
    const groups=new Map<string,StoryAssistantCard[]>()
    for(const c of p.cards){const key=canonicalJson([c.kind,c.cardId]);groups.set(key,[...(groups.get(key)??[]),c])}
    const conflicts=[...groups.values()].filter(cards=>new Set(cards.map(c=>c.snapshotHash)).size>1).map(cards=>({kind:cards[0].kind,cardId:cards[0].cardId,referenceIds:cards.map(c=>c.referenceId)}))
    if(canonicalJson(p.conflicts)!==canonicalJson(conflicts)||!Array.isArray(v.messages)||v.messages.length!==2||!v.messages.every(m=>isRecord(m)&&exact(m,['role','content']))
        ||v.messages[0].role!=='system'||!text(v.messages[0].content,20000)||!v.messages[0].content||v.messages[1].role!=='user'||v.messages[1].content!==canonicalJson(p)
        ||!isRecord(v.trace)||!optional(v.trace,TRACE,...TRACE_EXTRAS)||!factsShape(p,v.trace)||!summariesShape(p,v.trace,scenes)||!chaptersShape(p,q)||!wideSummariesShape(p,v.trace,q)||!coverageShape(p,v.trace)
        ||'style'in p&&!isPacketStyle(p.style,p.cards)||'styleOmitted'in v.trace&&!['examples','all'].includes(String(v.trace.styleOmitted))
        ||v.trace.styleOmitted==='all'&&'style'in p||v.trace.styleOmitted==='examples'&&isRecord(p.style)&&Array.isArray(p.style.examples)&&p.style.examples.length>0)return false
    const t=v.trace
    return t.estimator==='utf8-message-bytes-v1'&&t.inputEstimate===new TextEncoder().encode(canonicalJson(v.messages)).length+64
        &&t.outputReserve===q.limits.outputTokens&&t.contextWindow===q.limits.contextWindow&&integer(t.inputEstimate)&&t.inputEstimate+t.outputReserve<=t.contextWindow
        &&integer(t.eligibleScenes,scenes.size)&&t.consideredScenes===Math.min(t.eligibleScenes,q.limits.maxSources)&&t.includedScenes===scenes.size
        &&canonicalJson(t.conflicts)===canonicalJson(conflicts)&&Array.isArray(t.excluded)&&Array.isArray(t.cardExclusions)
        &&t.excluded.every(r=>isRecord(r)&&exact(r,['sceneId','reason'])&&id(r.sceneId)&&!scenes.has(r.sceneId)&&['trashed','merged','archived','excluded_from_ai','later_scene','source_limit','empty','passage_limit','budget'].includes(String(r.reason)))
        &&t.cardExclusions.every(r=>isRecord(r)&&exact(r,['referenceId','sceneId','reason'])&&id(r.referenceId)&&scenes.has(String(r.sceneId))&&['settings','disabled','reveal_unverified','empty','budget'].includes(String(r.reason)))
}
