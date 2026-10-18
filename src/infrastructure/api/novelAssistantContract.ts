import { assertEffectiveLlmProfile,assertPublicLlmData } from './llmProfileContract'
import { isRecord } from '@/shared/novelMutationJournal'
import type { NovelAssistantRecord,NovelAssistantTurnPreview,StoryAssistantContext,StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { canonicalJson } from '@/utils/json'
import { verifyAssistantContext,verifyFrozenAssistantContext } from './storyAssistantContextContract'
import { verifyNovelRefinementSource,refinementSourceReference } from './variantRefinementContract'
import { isPresetSnapshot,presetReference } from './storyAssistantPresetContract'
import type { NovelPresetReference,NovelRefinementReference } from '@/shared/types/storyAssistant.types'

const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>k in v)
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const scalar=(v:unknown,max:number):v is string=>typeof v==='string'&&Array.from(v).length<=max&&!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)
const nonempty=(v:unknown,max:number):v is string=>scalar(v,max)&&Boolean(v.trim())

const FACT_KINDS=['knowledge','relationship','possession','location','state','trait','event']
const trimmed=(v:unknown,max:number):v is string=>nonempty(v,max)&&v===v.trim()

type Sources=StoryAssistantContext['packet']['sources']
/** One retained passage, its saved scene revision and an excerpt taken verbatim from it. */
function cited(v:Record<string,unknown>,sources:Sources):boolean {
    const source=sources.find(s=>s.passages.some(p=>p.id===v.passage)),passage=source?.passages.find(p=>p.id===v.passage)
    return Boolean(source&&passage)&&v.sceneId===source!.sceneId&&v.revision===source!.revision
        &&(v.excerpt===null||typeof v.excerpt==='string'&&Boolean(v.excerpt.trim())&&passage!.quote.includes(v.excerpt))
}

function verifyFacts(v:unknown,sources:Sources):boolean {
    if(!Array.isArray(v)||v.length<1||v.length>40)return false
    return v.every(fact=>isRecord(fact)&&exact(fact,['subject','kind','statement','object','passage','sceneId','revision','excerpt'])&&cited(fact,sources)
        &&trimmed(fact.subject,255)&&trimmed(fact.statement,2000)&&FACT_KINDS.includes(String(fact.kind))&&(fact.object===null||trimmed(fact.object,255)))
}

function verifyIssues(v:unknown,sources:Sources,facts:ReadonlySet<string>):boolean {
    if(!Array.isArray(v)||v.length<1||v.length>20)return false
    return v.every(issue=>isRecord(issue)&&exact(issue,['title','detail','certainty','evidence',...('facts'in issue?['facts']:[])])&&trimmed(issue.title,200)&&trimmed(issue.detail,2000)
        &&(!('facts'in issue)||Array.isArray(issue.facts)&&issue.facts.length>=1&&issue.facts.length<=4&&new Set(issue.facts).size===issue.facts.length&&issue.facts.every(id=>facts.has(String(id))))
        &&['certain','likely','possible'].includes(String(issue.certainty))&&Array.isArray(issue.evidence)&&issue.evidence.length>=1&&issue.evidence.length<=4
        &&issue.evidence.every(row=>isRecord(row)&&exact(row,['passage','sceneId','revision','excerpt'])&&cited(row,sources)))
}

const ASPECTS=['pacing','causality','purpose','exposition','character','dialogue','clarity']
function verifyNotes(v:unknown,sources:Sources):boolean {
    if(!Array.isArray(v)||v.length<1||v.length>12)return false
    return v.every(note=>isRecord(note)&&exact(note,['aspect','title','observation','evidence','options'])&&ASPECTS.includes(String(note.aspect))
        &&trimmed(note.title,200)&&trimmed(note.observation,2000)&&Array.isArray(note.evidence)&&note.evidence.length>=1&&note.evidence.length<=4
        &&note.evidence.every(row=>isRecord(row)&&exact(row,['passage','sceneId','revision','excerpt'])&&cited(row,sources))
        &&Array.isArray(note.options)&&note.options.length>=1&&note.options.length<=3&&note.options.every(option=>trimmed(option,500)))
}

/** Steps name writable scenes of the packet at their saved revisions. */
function verifyPlan(v:unknown,sources:Sources):boolean {
    if(!isRecord(v)||!exact(v,['title','steps'])||!trimmed(v.title,200)||!Array.isArray(v.steps)||v.steps.length<1||v.steps.length>8)return false
    return v.steps.every(step=>{
        const source=isRecord(step)?sources.find(row=>row.sceneId===step.sceneId):undefined
        return isRecord(step)&&exact(step,['sceneId','revision','instruction'])&&Boolean(source)&&!source!.readOnly&&step.revision===source!.revision&&trimmed(step.instruction,2000)
    })
}

/**
 * Outline changes name writable packet scenes at their saved revisions and the chapters of writable packet scenes;
 * a split starts a later paragraph of a saved passage, and chapters merge or move within their part.
 */
function verifyStructure(v:unknown,sources:Sources):boolean {
    if(!Array.isArray(v)||v.length<1||v.length>6)return false
    const writable=(id:unknown,revision:unknown)=>{const source=sources.find(row=>row.sceneId===id);return source&&!source.readOnly&&source.revision===revision?source:null}
    const parts=new Map(sources.filter(row=>!row.readOnly).map(row=>[row.chapterId,row.partId] as const))
    const chapters=new Set(parts.keys())
    const chapter=(id:unknown):id is string=>typeof id==='string'&&chapters.has(id)
    return v.every(change=>{
        if(!isRecord(change)||!trimmed(change.reason,1000))return false
        if(change.kind==='merge_chapters')return exact(change,['kind','chapterId','otherChapterId','reason'])&&chapter(change.chapterId)&&chapter(change.otherChapterId)
            &&change.chapterId!==change.otherChapterId&&parts.get(change.chapterId)===parts.get(change.otherChapterId)
        if(change.kind==='move_chapter')return exact(change,['kind','chapterId','partId','beforeChapterId','reason'])&&chapter(change.chapterId)
            &&(change.beforeChapterId===null?change.partId===parts.get(change.chapterId):chapter(change.beforeChapterId)&&change.beforeChapterId!==change.chapterId&&change.partId===parts.get(change.beforeChapterId))
        if(change.kind==='new_part')return exact(change,['kind','chapterId','partId','title','reason'])&&chapter(change.chapterId)&&change.partId===parts.get(change.chapterId)&&trimmed(change.title,255)
        if(change.kind==='new_chapter'){
            const ids=change.sceneIds
            return exact(change,['kind','chapterId','partId','title','sceneIds','reason'])&&chapter(change.chapterId)&&change.partId===parts.get(change.chapterId)&&trimmed(change.title,255)
                &&Array.isArray(ids)&&ids.length>=1&&ids.length<=20&&new Set(ids).size===ids.length&&ids.every(id=>sources.some(row=>row.sceneId===id&&!row.readOnly))
        }
        const source=writable(change.sceneId,change.revision)
        if(change.kind==='split_chapter')return exact(change,['kind','chapterId','sceneId','revision','title','reason'])&&Boolean(source)&&source!.chapterId===change.chapterId&&trimmed(change.title,255)
        if(!source)return false
        if(change.kind==='move_scene'){
            const before=change.beforeSceneId===null?null:sources.find(row=>row.sceneId===change.beforeSceneId)
            return exact(change,['kind','sceneId','revision','chapterId','beforeSceneId','reason'])&&chapters.has(String(change.chapterId))
                &&(before===null||Boolean(before)&&!before!.readOnly&&before!.sceneId!==source.sceneId&&before!.chapterId===change.chapterId)
        }
        if(change.kind==='merge_scenes'){
            const other=writable(change.otherSceneId,change.otherRevision)
            return exact(change,['kind','sceneId','revision','otherSceneId','otherRevision','reason'])&&Boolean(other)&&other!.sceneId!==source.sceneId&&other!.chapterId===source.chapterId
        }
        if(change.kind!=='split_scene'||!exact(change,['kind','sceneId','revision','offset','excerpt','title','reason'])||!trimmed(change.title,255)||!nonempty(change.excerpt,4000)
            ||!Number.isSafeInteger(change.offset)||(change.offset as number)<1)return false
        const offset=change.offset as number,excerpt=change.excerpt as string
        return source.passages.some(passage=>{
            const at=offset-passage.startOffset
            return at>=0&&passage.quote.startsWith(excerpt,at)&&(at===0||passage.quote[at-1]==='\n')
        })
    })
}

/** Scene summaries name writable packet scenes once each, at the revision, content and completeness they read. */
function verifySummaries(v:unknown,sources:Sources):boolean {
    if(!Array.isArray(v)||v.length<1||v.length>20)return false
    const seen=new Set<string>()
    return v.every(row=>{
        const source=isRecord(row)?sources.find(s=>s.sceneId===row.sceneId):undefined
        if(!isRecord(row)||!exact(row,['sceneId','revision','contentHash','complete','text'])||!source||source.readOnly||seen.has(source.sceneId)
            ||row.revision!==source.revision||row.contentHash!==source.contentHash||row.complete!==source.complete||!trimmed(row.text,2000))return false
        seen.add(source.sceneId);return true
    })
}

/** What a chapter or book summary read of the scenes it covers: their `sceneId@revision`, and whether it read all of them whole. */
function summaryRead(sceneIds:string[],sources:Sources,total=sceneIds.length):{basis:string[];complete:boolean} {
    const read=sceneIds.map(id=>sources.find(s=>s.sceneId===id)).filter((s):s is Sources[number]=>Boolean(s))
    return {basis:read.map(s=>`${s.sceneId}@${s.revision}`),complete:read.length>0&&read.length===total&&read.every(s=>s.complete)}
}
/** Since part summaries, a Summary packet records what each unit covers: read whole, or behind a summary it sent. */
const covering=(unit:{scenes:number;covered:string[]})=>({basis:unit.covered,complete:unit.covered.length>0&&unit.covered.length===unit.scenes})
/** Chapter summaries name chapters the summary packet lists, once each, with exactly the basis and completeness they covered. */
function verifyChapterSummaries(v:unknown,context:StoryAssistantContext):boolean {
    const packet=context.packet,coverage=context.trace.summaryCoverage
    if(!packet.chapters||!Array.isArray(v)||v.length<1||v.length>20)return false
    const seen=new Set<string>()
    return v.every(row=>{
        const chapter=isRecord(row)?packet.chapters!.find(c=>c.chapterId===row.chapterId):undefined
        const expected=chapter&&(coverage?covering(coverage.chapters.find(c=>c.chapterId===chapter.chapterId)!):summaryRead(chapter.sceneIds,packet.sources))
        if(!isRecord(row)||!exact(row,['chapterId','basis','complete','text'])||!chapter||seen.has(chapter.chapterId)||!trimmed(row.text,4000)
            ||canonicalJson({basis:row.basis,complete:row.complete})!==canonicalJson(expected))return false
        seen.add(chapter.chapterId);return true
    })
}
/** Part summaries name parts the packet lists whose saved summary was not sent, once each, with exactly what they covered. */
function verifyPartSummaries(v:unknown,context:StoryAssistantContext):boolean {
    const packet=context.packet,coverage=context.trace.summaryCoverage?.parts,sent=new Set((packet.partSummaries??[]).map(row=>row.partId))
    if(!packet.parts||!coverage||!Array.isArray(v)||v.length<1||v.length>20)return false
    const seen=new Set<string>()
    return v.every(row=>{
        const part=isRecord(row)?coverage.find(c=>c.partId===row.partId):undefined
        if(!isRecord(row)||!exact(row,['partId','basis','complete','text'])||!part||seen.has(part.partId)||sent.has(part.partId)||!trimmed(row.text,4000)
            ||canonicalJson({basis:row.basis,complete:row.complete})!==canonicalJson(covering(part)))return false
        seen.add(part.partId);return true
    })
}
/** A book summary is complete only when it covered every scene the book's summary covers. */
function verifyBookSummary(v:unknown,context:StoryAssistantContext):boolean {
    const packet=context.packet,coverage=context.trace.summaryCoverage
    return Boolean(packet.chapters)&&typeof packet.bookScenes==='number'&&isRecord(v)&&exact(v,['basis','complete','text'])&&trimmed(v.text,4000)
        &&canonicalJson({basis:v.basis,complete:v.complete})===canonicalJson(coverage?covering(coverage.book):summaryRead(packet.chapters!.flatMap(c=>c.sceneIds),packet.sources,packet.bookScenes))
}

/** Check expanded evidence against the retained source packet, never current prose. */
export function verifyNovelAssistantRecord(v:unknown,storyId:string,executionId?:string):v is NovelAssistantRecord {
    if(!isRecord(v)||!exact(v,['context','result',...['refinement','preset'].filter(k=>k in v)])||!verifyFrozenAssistantContext(v.context,storyId)||!isRecord(v.result))return false
    const c=v.context,r=v.result,p=c.packet
    if('preset'in v&&!isPresetSnapshot(v.preset,c.request))return false
    if(!exact(r,['schemaVersion','storyId','sourceVersion','packetHash','answer','citations','proposal',...['facts','issues','notes','plan','structure','structureOmitted','summaries','chapterSummaries','partSummaries','bookSummary','copy'].filter(k=>k in r)])||r.schemaVersion!==1||r.storyId!==storyId||r.sourceVersion!==c.sourceVersion
        ||r.packetHash!==c.packetHash||!nonempty(r.answer,20000)||r.answer!==r.answer.trim()||!Array.isArray(r.citations)||r.citations.length>80)return false
    const seen=new Set<string>()
    for(const citation of r.citations){
        if(!isRecord(citation))return false
        const key=canonicalJson(citation);if(seen.has(key))return false;seen.add(key)
        if(citation.type==='passage'){
            const source=p.sources.find(s=>s.passages.some(p=>p.id===citation.id)),passage=source?.passages.find(p=>p.id===citation.id)
            if(!source||!passage||canonicalJson(citation)!==canonicalJson({type:'passage',id:passage.id,sceneId:source.sceneId,revision:source.revision,contentHash:source.contentHash,
                startOffset:passage.startOffset,endOffset:passage.endOffset,quote:passage.quote,anchor:passage.anchor}))return false
        }else if(citation.type==='pin'){
            const pin=p.cards.find(pin=>pin.referenceId===citation.referenceId)
            if(!pin||canonicalJson(citation)!==canonicalJson({type:'pin',referenceId:pin.referenceId,snapshotHash:pin.snapshotHash,title:pin.title,text:pin.text,sourceVersionId:pin.sourceVersionId,appliesTo:pin.appliesTo}))return false
        }else return false
    }
    if('facts'in r&&!verifyFacts(r.facts,p.sources))return false
    if('issues'in r&&!verifyIssues(r.issues,p.sources,new Set((p.facts??[]).map(f=>f.id))))return false
    if('notes'in r&&!verifyNotes(r.notes,p.sources))return false
    if('plan'in r&&!verifyPlan(r.plan,p.sources))return false
    if('structure'in r&&!verifyStructure(r.structure,p.sources))return false
    // Proposed outline changes left out because they did not fit; never more than a reply holds besides the kept ones.
    if('structureOmitted'in r&&(!Number.isSafeInteger(r.structureOmitted)||(r.structureOmitted as number)<1
        ||(r.structureOmitted as number)>6-(Array.isArray(r.structure)?r.structure.length:0)))return false
    if('summaries'in r&&!verifySummaries(r.summaries,p.sources))return false
    if('chapterSummaries'in r&&!verifyChapterSummaries(r.chapterSummaries,c))return false
    if('partSummaries'in r&&!verifyPartSummaries(r.partSummaries,c))return false
    if('bookSummary'in r&&!verifyBookSummary(r.bookSummary,c))return false
    // Book copy alone (A26), only for the copy action.
    if('copy'in r&&(c.request.action?.kind!=='copy'||!nonempty(r.copy,20000)||r.copy!==r.copy.trim()))return false
    const candidate=r.proposal
    if('refinement'in v&&(!verifyNovelRefinementSource(v.refinement,storyId,c.request.anchorSceneId)||c.request.task!=='suggest'||p.readOnly||candidate===null))return false
    if(candidate===null)return true
    if(p.task!=='suggest'||p.readOnly||!isRecord(candidate)||!exact(candidate,['id','schemaVersion','storyId','sourceVersion','sceneId','chapterId','baseRevision','baseContentHash','operation','selection','markdown','instruction','packetHash','status'])
        ||!uuid(candidate.id)||(executionId!==undefined&&candidate.id!==executionId)||candidate.schemaVersion!==1||candidate.storyId!==storyId||candidate.sourceVersion!==c.sourceVersion
        ||candidate.sceneId!==p.sources[0].sceneId||candidate.chapterId!==p.sources[0].chapterId||candidate.baseRevision!==p.sources[0].revision||candidate.baseContentHash!==p.sources[0].contentHash
        ||candidate.status!=='candidate'||candidate.packetHash!==c.packetHash||candidate.instruction!==c.request.message||!nonempty(candidate.markdown,120000)
        ||'refinement'in v&&verifyNovelRefinementSource(v.refinement,storyId)&&v.refinement.parent.id===candidate.id)return false
    if('refinement'in v&&verifyNovelRefinementSource(v.refinement,storyId)){
        if('variant'in v.refinement&&[v.refinement.variant.id,v.refinement.variant.operation.id].includes(candidate.id))return false
        const append=!('variant'in v.refinement)&&v.refinement.parent.command==='continue'
        const operation=append?'append_scene':c.request.selection?'replace_selection':'replace_scene'
        if(candidate.operation!==operation||append&&c.request.selection)return false
    }
    return c.request.selection?candidate.operation==='replace_selection'&&canonicalJson(candidate.selection)===canonicalJson(c.request.selection)
        :candidate.selection===null&&p.sources[0].complete&&['replace_scene','append_scene'].includes(String(candidate.operation))
}

/** The profile-free source packet and the actual symbolic execution payload are both inspectable. */
export function verifyNovelAssistantPreview(v:unknown,conversationId:number,index:StoryStudioIndex,request:StoryAssistantContextRequest,refinement:NovelRefinementReference|null=null,preset:NovelPresetReference|null=null):v is NovelAssistantTurnPreview {
    if(!isRecord(v)||!exact(v,['schemaVersion','kind','conversationId','conversationVersion','storyId','context','profile','payload','promptHash','inputEstimate','history',...(refinement?['refinement']:[]),...(preset?['preset']:[])])
        ||v.schemaVersion!==1||v.kind!=='novel_turn_preview'||v.conversationId!==conversationId||!Number.isSafeInteger(v.conversationVersion)||Number(v.conversationVersion)<0||v.storyId!==index.id
        ||!verifyAssistantContext(v.context,index,request)||!isRecord(v.profile)||!isRecord(v.payload)||!exact(v.payload,['agt','messages'])||!isRecord(v.payload.agt)
        ||typeof v.promptHash!=='string'||!/^[a-f0-9]{64}$/.test(v.promptHash)||!Number.isSafeInteger(v.inputEstimate)||Number(v.inputEstimate)<v.context.trace.inputEstimate
        ||!isRecord(v.history)||!exact(v.history,['included','excluded'])||!Array.isArray(v.history.included)||!v.history.included.every(id=>Number.isSafeInteger(id)&&id>0)
        ||!Array.isArray(v.history.excluded)||!v.history.excluded.every(r=>isRecord(r)&&exact(r,['messageId','reason'])&&Number.isSafeInteger(r.messageId)&&Number(r.messageId)>0&&['scope','source_changed','source_unavailable','budget'].includes(String(r.reason))))return false
    const {provider_options,...profile}=v.profile
    try{assertEffectiveLlmProfile({...profile,project_hash:'novel-preview'});assertPublicLlmData(provider_options)}catch{return false}
    if(!isRecord(provider_options)||!isRecord(profile.roles)||Object.keys(profile.roles).join(',')!=='primary'||!isRecord(profile.roles.primary)||!isRecord(profile.roles.primary.settings))return false
    const settings=profile.roles.primary.settings
    if(Number(settings.max_output_tokens)>request.limits.outputTokens||Number(v.inputEstimate)>Math.min(Number(settings.max_input_tokens),request.limits.contextWindow-request.limits.outputTokens)
        ||v.history.included.length%2!==0||new Set(v.history.included).size!==v.history.included.length||v.history.included.length+3>Number(settings.max_messages))return false
    const metadata=v.payload.agt.metadata
    if(refinement&&(!verifyNovelRefinementSource(v.refinement,index.id,request.anchorSceneId)||request.task!=='suggest'
        ||canonicalJson(refinementSourceReference(v.refinement))!==canonicalJson(refinement)))return false
    if(preset&&(!isPresetSnapshot(v.preset,request)||canonicalJson(presetReference(v.preset))!==canonicalJson(preset)))return false
    return isRecord(metadata)&&canonicalJson(metadata.novel_context)===canonicalJson(v.context)&&canonicalJson(metadata.novel_history)===canonicalJson(v.history)
        &&canonicalJson(metadata.novel_refinement??null)===canonicalJson(v.refinement??null)
        &&canonicalJson(metadata.novel_preset??null)===canonicalJson(v.preset??null)
        &&metadata.novel_input_estimate===v.inputEstimate&&canonicalJson(v.payload.messages)===canonicalJson([{role:'user',content:request.message}])
}
