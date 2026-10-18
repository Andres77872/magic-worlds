import type { StorySceneDocument,StoryStudioDocument } from '@/shared/types/storyStudio.types'
import type { Story, StoryCardRef, StoryCodexAcknowledgement, StoryCodexLibraryDraft, StoryCodexLibraryEntry, StoryCodexLibraryReview, StoryCodexLibraryNotices, StoryCodexWrite, StoryContextSettings, StoryScene, StoryGeneration, StoryStructureAcknowledgement, StoryStructureWrite, StoryUnitMetadata } from '@/shared/types/story.types'
import { isStoryUnitCopyOperation } from '@/shared/storyUnitCopy'
import { isStoryHistoryOperation } from './storyHistoryContract'
import { isSnapshotCreateOperation,isSnapshotRestoreOperation,isSnapshotCounts,isSnapshotHash } from '@/shared/storySnapshotOperation'
import { documentMarkdown, documentText, isStoryDocument } from '@/shared/storyDocument'
import { canonicalJson } from '@/utils/json'
import { isStoryNovelDetails } from '@/shared/storyNovelDetails'
import { isStoryUnitDetails } from '@/shared/storyUnitDetails'
import { isStoryStatistics,isStorySceneStatistics } from '@/shared/storyStatistics'

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
const revision=(value:unknown):value is number=>Number.isSafeInteger(value)&&Number(value)>0
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max
const text=(value:unknown,max=20_000):value is string=>typeof value==='string'&&(value.length<=max||Array.from(value).length<=max)
const id=(value:unknown):value is string=>text(value,64)&&value.length>0
const nullableId=(value:unknown)=>value===null||id(value)
const nullableText=(value:unknown,max=20_000)=>value===null||text(value,max)
const timestamp=(value:unknown)=>value===null||typeof value==='string'&&Number.isFinite(Date.parse(value))
const statuses=['draft','revising','complete','archived']
const cardKinds=['character','world','item','adventure_template','lorebook','lorebook_entry','snapshot_card']
const refSources=['manual','mention','suggested','source','lore_activation']

function details(value:unknown,novel=false):boolean {
    return novel?isStoryNovelDetails(value):isStoryUnitDetails(value)
}
export function verifyStoryMetadata(value:unknown,storyId?:string,unitId?:string):value is StoryUnitMetadata {
    if(!record(value)||!id(value.id)||!id(value.storyId)||(storyId!==undefined&&value.storyId!==storyId)||(unitId!==undefined&&value.id!==unitId)
        ||!text(value.title,255)||!value.title.trim()||!revision(value.metadataRevision)||!integer(value.order)
        ||value.status!==null&&!statuses.includes(String(value.status))||value.wordGoal!==null&&!integer(value.wordGoal,1,2_147_483_647)
        ||!nullableId(value.povCardId)||!nullableId(value.locationCardId)||!details(value.details)
        ||!timestamp(value.trashedAt)||!nullableId(value.copiedFrom))return false
    if(value.previousStatus!==undefined&&value.previousStatus!==null&&!statuses.includes(String(value.previousStatus)))return false
    if(value.mergedInto!==undefined&&!nullableId(value.mergedInto))return false
    if(value.inheritance!==undefined){
        const inheritance=value.inheritance
        if(!record(inheritance)||!record(inheritance.values)||!record(inheritance.origins)||typeof inheritance.readOnly!=='boolean'
            ||typeof inheritance.values.includeInAI!=='boolean'||typeof inheritance.values.includeInExport!=='boolean'
            ||Object.values(inheritance.origins).some((origin)=>!['novel','part','chapter','scene'].includes(String(origin))))return false
    }
    return true
}
export function verifyStoryReference(value:unknown,storyId?:string,refId?:string):value is StoryCardRef {
    if(!record(value)||!id(value.id)||!id(value.storyId)||(storyId!==undefined&&value.storyId!==storyId)||(refId!==undefined&&value.id!==refId)
        ||!nullableId(value.chapterId)||!nullableId(value.sceneId)||value.chapterId!==null&&value.sceneId!==null||!timestamp(value.removedAt)
        ||!cardKinds.includes(String(value.kind))||!id(value.cardId)||!refSources.includes(String(value.source))
        ||typeof value.enabled!=='boolean'||!integer(value.precedence)||!record(value.snapshot))return false
    const snapshot=value.snapshot
    return snapshot.id===value.cardId&&text(snapshot.description,2_000_000)&&snapshot.story_card_kind===value.kind
        &&(text(snapshot.name,255)&&snapshot.name.length>0||text(snapshot.alias,255)&&snapshot.alias.length>0)
        &&(snapshot.source_card_version_id===undefined||nullableId(snapshot.source_card_version_id))
        &&(snapshot.source_card_version_number===undefined||snapshot.source_card_version_number===null||integer(snapshot.source_card_version_number))
        &&(snapshot.source_base===undefined||snapshot.source_base===null||sourceBase(snapshot.source_base))
}
const libraryFields=['name','alias','description','race','type','category']
const stateId=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value)
function sourceBase(value:unknown):boolean {
    return record(value)&&stateId(value.state_id)&&Object.keys(value).every((key)=>key==='state_id'||libraryFields.includes(key))
}
function references(value:unknown,storyId:string):boolean {
    return Array.isArray(value)&&value.every((ref)=>verifyStoryReference(ref,storyId))&&new Set(value.map((ref)=>ref.id)).size===value.length
}
function generations(value:unknown,storyId:string):boolean {
    return Array.isArray(value)&&value.every((item)=>record(item)&&id(item.id)&&item.storyId===storyId&&id(item.sceneId)&&id(item.chapterId)
        &&['continue','rewrite','expand','condense','describe','critique','custom'].includes(String(item.command))
        &&['candidate','accepted','rejected','stashed'].includes(String(item.status))&&typeof item.output==='string'
        &&record(item.contextTrace)&&Array.isArray(item.contextTrace.scenes)&&Array.isArray(item.contextTrace.cards)&&Array.isArray(item.contextTrace.loreEntries))
}
export function verifyStoryGeneration(value:unknown,storyId:string,generationId?:string):value is StoryGeneration {
    return record(value)&&generations([value],storyId)&&(generationId===undefined||value.id===generationId)
        &&revision(value.baseRevision)&&(value.appliedRevision===null||revision(value.appliedRevision))
        &&(value.instruction===null||text(value.instruction,60_000))&&(value.promptSummary===null||text(value.promptSummary,60_000))
        &&(value.inputRange===null||record(value.inputRange)&&integer(value.inputRange.startOffset)&&integer(value.inputRange.endOffset)
            &&Number(value.inputRange.endOffset)>Number(value.inputRange.startOffset)&&typeof value.inputRange.text==='string')
}
export function verifyStorySceneDocument(value:unknown,storyId?:string,sceneId?:string):value is StorySceneDocument {
    if(!verifyStoryMetadata(value,storyId,sceneId))return false
    const scene=value as unknown as Record<string,unknown>
    return id(scene.chapterId)&&revision(scene.revision)&&isStoryDocument(scene.document)
        &&typeof scene.contentHash==='string'&&/^[a-f0-9]{64}$/.test(scene.contentHash)
        &&scene.plainText===documentText(scene.document)&&scene.body===documentMarkdown(scene.document)
        &&references(scene.activeCardRefs,value.storyId)
        &&(scene.copiedFromRevision===undefined||scene.copiedFromRevision===null||revision(scene.copiedFromRevision))
        &&(scene.statistics===undefined||scene.statistics===null||isStorySceneStatistics(scene.statistics,{revision:Number(scene.revision),contentHash:String(scene.contentHash)}))
}
export function verifyStoryScene(value:unknown,storyId?:string,sceneId?:string):value is StoryScene {
    return verifyStorySceneDocument(value,storyId,sceneId)&&'generationHistory' in value&&generations(value.generationHistory,value.storyId)
}
export function verifyStoryStudioDocument(value:unknown,storyId?:string,sceneId?:string):value is StoryStudioDocument {
    if(!verifyStorySceneDocument(value,storyId,sceneId)||!('projection' in value)||value.projection!=='scene_document'||'generationHistory' in value||!('latestGenerationTrace' in value))return false
    const trace=value.latestGenerationTrace
    return trace===null||record(trace)&&Array.isArray(trace.cards)&&Array.isArray(trace.loreEntries)&&Array.isArray(trace.scenes)
        &&revision(trace.structureRevision)&&revision(trace.novelMetadataRevision)&&revision(trace.contextRevision)&&integer(trace.totalEstimatedTokens)
}
export function verifyStoryContext(value:unknown):value is StoryContextSettings {
    return record(value)&&typeof value.includeSelectedCards==='boolean'&&typeof value.includeLorebooks==='boolean'
        &&integer(value.includeRecentChapters,0,100)&&integer(value.tokenBudget,1,100_000)
        &&(value.styleSource===null||['current_scene','whole_story','card','custom'].includes(String(value.styleSource)))
        &&nullableText(value.customStyleInstruction,60_000)
}
export function verifyStory(value:unknown,storyId?:string,allowSummary=false):value is Story {
    if(!record(value)||!id(value.id)||(storyId!==undefined&&value.id!==storyId)||!text(value.title,255)||!value.title.trim()
        ||!nullableText(value.description,60_000)||!record(value.source)||!['blank','character','world','item','adventure_template','adventure_session'].includes(String(value.source.kind))
        ||!nullableId(value.source.id)||!nullableText(value.source.title,255)||!statuses.includes(String(value.status))
        ||value.wordGoal!==null&&!integer(value.wordGoal,1,2_147_483_647)||!timestamp(value.trashedAt)||!nullableId(value.copiedFrom)
        ||!revision(value.metadataRevision)||!revision(value.structureRevision)||!revision(value.contextRevision)
        ||!Array.isArray(value.parts)||!Array.isArray(value.chapters)||!details(value.details,true)||!verifyStoryContext(value.activeContext)||!references(value.activeCardRefs,value.id))return false
    if(value.summary!==undefined&&(value.summary!==true||!allowSummary))return false
    if(value.statistics!==undefined&&value.statistics!==null&&!isStoryStatistics(value.statistics,Number(value.structureRevision)))return false
    if(value.summary===true&&(!(integer(value.chapterCount)&&integer(value.sceneCount)||value.statistics===null&&value.chapterCount===null&&value.sceneCount===null)||value.chapters.length!==0||value.parts.length!==0))return false
    if(value.organization!==undefined&&(!record(value.organization)||!id(value.organization.workspace_id)))return false
    const partIds=new Set<string>()
    const chapterIds=new Set<string>()
    const sceneIds=new Set<string>()
    for(const part of value.parts){
        if(!verifyStoryMetadata(part,value.id)||partIds.has(part.id))return false
        partIds.add(part.id)
    }
    for(const chapter of value.chapters){
        if(!verifyStoryMetadata(chapter,value.id)||chapterIds.has(chapter.id)||!record(chapter)||!nullableId(chapter.partId)
            ||chapter.partId!==null&&!partIds.has(chapter.partId)||!Array.isArray(chapter.scenes)||typeof chapter.body!=='string'
            ||!references(chapter.activeCardRefs,value.id)||!generations(chapter.generationHistory,value.id))return false
        chapterIds.add(chapter.id)
        for(const scene of chapter.scenes){
            if(!verifyStoryScene(scene,value.id)||scene.chapterId!==chapter.id||sceneIds.has(scene.id))return false
            sceneIds.add(scene.id)
        }
    }
    return true
}
export function verifyStoryStructureAcknowledgement(value:unknown,expectedRevision:number,intent?:{storyId:string;write:StoryStructureWrite}):value is StoryStructureAcknowledgement {
    if(!record(value)||value.structureRevision!==expectedRevision+1||!nullableId(value.selectedId))return false
    const operation=intent?.write.operation
    if(operation?.op==='restore_snapshot'){
        return isSnapshotRestoreOperation(operation)&&operation.sourceStructureRevision===expectedRevision&&Object.keys(value).length===3
            &&record(value.restore)&&Object.keys(value.restore).length===7&&value.restore.requestId===intent!.write.requestId&&value.restore.storyId===intent!.storyId
            &&value.restore.snapshotId===operation.snapshotId&&value.restore.manifestHash===operation.manifestHash&&value.restore.sourceVersion===operation.expectedSourceVersion
            &&isSnapshotCounts(value.restore.counts)&&canonicalJson(value.restore.operation)===canonicalJson(operation)
    }
    if(operation?.op==='create_snapshot'){
        return isSnapshotCreateOperation(operation)&&operation.sourceStructureRevision===expectedRevision&&Object.keys(value).length===3&&value.selectedId===null
            &&record(value.snapshot)&&Object.keys(value.snapshot).length===7&&value.snapshot.requestId===intent!.write.requestId&&value.snapshot.storyId===intent!.storyId
            &&value.snapshot.id===expectedRevision+1&&value.snapshot.sourceVersion===operation.expectedSourceVersion&&isSnapshotHash(value.snapshot.manifestHash)
            &&isSnapshotCounts(value.snapshot.counts)&&canonicalJson(value.snapshot.operation)===canonicalJson(operation)
    }
    if(operation&&['undo_structure','redo_structure'].includes(operation.op)){
        return isStoryHistoryOperation(operation)&&operation.sourceStructureRevision===expectedRevision&&Object.keys(value).length===3&&record(value.history)&&Object.keys(value.history).length===4
            &&value.history.requestId===intent!.write.requestId&&value.history.storyId===intent!.storyId&&revision(value.history.operationRevision)
            &&value.history.operationRevision<=operation.revision&&canonicalJson(value.history.operation)===canonicalJson(operation)
    }
    // Older retained receipts can still replay, but a new guarded copy must
    // acknowledge every reviewed option and source head before it selects a unit.
    if(operation?.op==='duplicate'&&'sourceScenes' in operation){
        const retained=operation as unknown as Record<string,unknown>
        const checked='sourceStructureRevision' in retained?retained:{...retained,sourceStructureRevision:expectedRevision}
        return Object.keys(value).length===3&&isStoryUnitCopyOperation(checked)&&id(value.selectedId)&&value.selectedId!==operation.id
            &&record(value.copy)&&Object.keys(value.copy).length===3&&value.copy.requestId===intent!.write.requestId&&value.copy.storyId===intent!.storyId
            &&canonicalJson(value.copy.operation)===canonicalJson(operation)
    }
    return true
}
export function verifyStoryLifecycleAcknowledgement(value:unknown,storyId:string,expectedRevision:number):boolean {
    return record(value)&&value.id===storyId&&value.metadataRevision===expectedRevision+1
}
export function verifyStoryCodexAcknowledgement(value:unknown,storyId:string,write:StoryCodexWrite):value is StoryCodexAcknowledgement {
    if(!record(value)||value.contextRevision!==write.expectedContextRevision+1||!references(value.refs,storyId)||!Array.isArray(value.refs))return false
    const operation=write.operation
    const refs=value.refs as StoryCardRef[]
    if(operation.op==='add')return operation.refs.every((item)=>refs.some((ref)=>ref.kind===item.kind&&ref.cardId===item.cardId&&ref.chapterId===(item.chapterId??null)&&ref.sceneId===(item.sceneId??null)&&ref.removedAt===null))
    // The created card or entry is copied with the reviewed name and text, pinned to its own library source.
    if(operation.op==='discover')return refs.some((ref)=>ref.kind===operation.destination&&ref.removedAt===null&&ref.chapterId===null&&ref.sceneId===null
        &&ref.snapshot.name===operation.fields.name&&ref.snapshot.description===operation.fields.description
        &&(operation.destination==='lorebook_entry'?ref.snapshot.source_lorebook_id===operation.lorebookId&&ref.snapshot.id===ref.cardId:ref.snapshot.source_card_id===ref.cardId))
    const ref=refs.find((item)=>item.id===operation.id)
    // A card records the reviewed version; a template or lorebook entry records the reviewed library state.
    if(operation.op==='refresh')return Boolean(ref&&ref.removedAt===null&&(ref.snapshot.source_card_version_id===operation.sourceVersionId||ref.snapshot.source_base?.state_id===operation.sourceVersionId))
    return Boolean(ref&&(operation.op==='remove'?ref.removedAt!==null&&ref.enabled===false:operation.op==='restore'?ref.removedAt===null&&ref.enabled===false:true))
}
export function verifyStoryCodexLibraryVersions(value:unknown):value is StoryCodexLibraryNotices {
    if(!record(value)||Object.keys(value).length!==2||!Array.isArray(value.versions)||!Array.isArray(value.changed))return false
    const ids=[...value.versions,...value.changed].map((item)=>record(item)?item.refId:null)
    return value.versions.every((item)=>record(item)&&Object.keys(item).length===2&&id(item.refId)&&integer(item.latestVersionNumber))
        &&value.changed.every((item)=>record(item)&&Object.keys(item).length===2&&id(item.refId)&&stateId(item.sourceVersionId))&&new Set(ids).size===ids.length
}
export function verifyStoryCodexLibraryDraft(value:unknown,ref:Pick<StoryCardRef,'id'|'kind'>):value is StoryCodexLibraryDraft {
    // A character has a race; a setting or item a type.
    const detail=ref.kind==='character'?'race':'type'
    const optionalLine=(item:unknown)=>item===null||text(item,255)
    return record(value)&&Object.keys(value).length===8&&value.refId===ref.id&&(value.basis==='draft'||value.basis==='published')
        &&text(value.name,255)&&optionalLine(value.alias)&&detail in value&&optionalLine(value[detail])
        &&text(value.description,200_000)&&typeof value.stamp==='string'&&/^[0-9a-f]{64}$/.test(value.stamp)&&integer(value.versionNumber)
}
export function verifyStoryCodexLibraryEntry(value:unknown,ref:StoryCardRef):value is StoryCodexLibraryEntry {
    return record(value)&&Object.keys(value).length===7&&value.refId===ref.id&&value.lorebookId===ref.snapshot.source_lorebook_id&&value.entryId===ref.cardId
        &&text(value.title,255)&&Array.isArray(value.keys)&&value.keys.every((key)=>text(key,255))&&typeof value.content==='string'&&value.content.length<=200_000&&typeof value.stamp==='string'&&/^[0-9a-f]{64}$/.test(value.stamp)
}
export function verifyStoryCodexLibraryReview(value:unknown,ref:StoryCardRef):value is StoryCodexLibraryReview {
    if(!record(value)||Object.keys(value).length!==4||value.refId!==ref.id||!record(value.current))return false
    const current=value.current
    if(!verifyStoryReference({...ref,snapshot:current},ref.storyId,ref.id))return false
    if(ref.kind==='lorebook_entry'||ref.kind==='adventure_template'){
        // An unversioned source: the same template or lorebook entry, named by the id of its current library state.
        if(ref.kind==='lorebook_entry'?current.source_lorebook_id!==ref.snapshot.source_lorebook_id:current.source_card_id!==ref.cardId)return false
        if(!stateId(value.sourceVersionId)||current.source_card_version_id!=null)return false
    }
    // A card: the current version is a story snapshot of the same library card, pinned to a saved version.
    else if(current.source_card_id!==ref.cardId||!id(current.source_card_version_id)||!integer(current.source_card_version_number,1)||value.sourceVersionId!==current.source_card_version_id)return false
    return value.base===null||record(value.base)&&Object.keys(value.base).every((key)=>libraryFields.includes(key))
}
/** A receipt must acknowledge this exact write, including the independent counters it advances. */
export function matchesStoryWrite(value:unknown,write:object):boolean {
    if(!record(value))return false
    const fields=write as Record<string,unknown>
    if(fields.expectedMetadataRevision!==undefined&&value.metadataRevision!==Number(fields.expectedMetadataRevision)+1)return false
    if(fields.expectedRevision!==undefined&&value.revision!==Number(fields.expectedRevision)+1)return false
    return ['document','title','description','status','wordGoal','povCardId','locationCardId','details','activeContext'].every((key)=>fields[key]===undefined||canonicalJson(value[key])===canonicalJson(fields[key]))
}
