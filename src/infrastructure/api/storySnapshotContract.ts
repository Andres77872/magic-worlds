import type { StorySnapshotManifest,StorySnapshotPage,StorySnapshotSummary,StorySnapshotDetail,StorySnapshotComparison,StorySnapshotPreview,StorySnapshotSceneView,StorySnapshotScene,StorySnapshotRestoreOptions,StorySnapshotRestorePreview } from '@/shared'
import { canonicalJson } from '@/utils/json'
import { isRecord,isNovelRevision } from '@/shared/novelMutationJournal'
import { isSnapshotCounts,isSnapshotHash,isSnapshotRestoreOptions } from '@/shared/storySnapshotOperation'
import { verifyStory,verifyStoryMetadata,verifyStoryReference,verifyStoryScene } from './storyContract'
import { verifySnapshotAnnotationCollection } from './storySnapshotAnnotationContract'

const timestamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))
const title=(value:unknown)=>typeof value==='string'&&value.length>0&&value===value.trim()&&Array.from(value).length<=255
export function verifySnapshotSummary(value:unknown,storyId:string):value is StorySnapshotSummary {
    return isRecord(value)&&value.storyId===storyId&&isNovelRevision(value.id)&&title(value.name)
        &&(value.note===null||typeof value.note==='string'&&Array.from(value.note).length<=2000)
        &&isSnapshotHash(value.sourceVersion)&&isSnapshotHash(value.manifestHash)&&isSnapshotCounts(value.counts)&&timestamp(value.createdAt)
}
export function verifySnapshotManifest(value:unknown,storyId:string):value is StorySnapshotManifest {
    if(!isRecord(value)||Object.keys(value).some((key)=>!['schemaVersion','storyId','sourceVersion','novel','parts','chapters','references','annotations'].includes(key))||value.schemaVersion!==1||value.storyId!==storyId||!isSnapshotHash(value.sourceVersion)||!isRecord(value.novel)
        ||!verifyStory({...value.novel,parts:[],chapters:[],activeCardRefs:[]},storyId)||!Array.isArray(value.parts)||!Array.isArray(value.chapters)||!Array.isArray(value.references)||value.chapters.length>2000)return false
    const all=new Set<string>(),parts=new Set<string>(),chapters=new Set<string>(),scenes=new Set<string>(),refs=new Set<string>()
    const unit=(item:unknown)=>{
        if(!verifyStoryMetadata(item,storyId)||all.has(item.id)||!isRecord(item)||['document','body','plainText','generationHistory','activeCardRefs'].some((key)=>key in item))return false
        all.add(item.id);return true
    }
    for(const part of value.parts){if(!unit(part))return false;parts.add(part.id)}
    for(const chapter of value.chapters){
        if(!unit(chapter)||!isRecord(chapter)||chapter.partId!==null&&!parts.has(String(chapter.partId))||!Array.isArray(chapter.scenes))return false
        chapters.add(String(chapter.id))
        for(const scene of chapter.scenes){
            if(!unit(scene)||!isRecord(scene)||scene.chapterId!==chapter.id||!isNovelRevision(scene.revision)||!isSnapshotHash(scene.contentHash)
                ||scene.copiedFromRevision!==null&&!isNovelRevision(scene.copiedFromRevision))return false
            scenes.add(String(scene.id))
        }
    }
    if(scenes.size>20_000)return false
    for(const ref of value.references){
        if(!verifyStoryReference(ref,storyId)||refs.has(ref.id)||ref.chapterId!==null&&!chapters.has(ref.chapterId)||ref.sceneId!==null&&!scenes.has(ref.sceneId))return false
        refs.add(ref.id)
    }
    return !('annotations' in value)||verifySnapshotAnnotationCollection(value.annotations,scenes)
}
export function verifySnapshotPage(value:unknown,storyId:string,before?:number):value is StorySnapshotPage {
    if(!isRecord(value)||value.storyId!==storyId||!Array.isArray(value.items)||value.items.length>50||value.nextBefore!==null&&!isNovelRevision(value.nextBefore))return false
    let ceiling=before??Number.MAX_SAFE_INTEGER
    for(const item of value.items){if(!verifySnapshotSummary(item,storyId)||item.id>=ceiling||'manifest' in item)return false;ceiling=item.id}
    return value.nextBefore===null||value.items.length===50&&value.nextBefore===value.items[49].id
}
export function verifySnapshotDetail(value:unknown,storyId:string,id:number):value is StorySnapshotDetail {
    if(!verifySnapshotSummary(value,storyId)||value.id!==id||!isRecord(value)||!verifySnapshotManifest(value.manifest,storyId))return false
    const manifest=value.manifest
    return manifest.sourceVersion===value.sourceVersion&&manifest.novel.structureRevision+1===id&&value.counts.parts===manifest.parts.length&&value.counts.chapters===manifest.chapters.length
        &&value.counts.scenes===manifest.chapters.reduce((sum,chapter)=>sum+chapter.scenes.length,0)&&value.counts.references===manifest.references.length
}
export function verifySnapshotComparison(value:unknown,storyId:string,id:number):value is StorySnapshotComparison {
    return verifySnapshotDetail(value,storyId,id)&&isRecord(value)&&verifySnapshotManifest(value.current,storyId)
}
export function verifySnapshotPreview(value:unknown,storyId:string):value is StorySnapshotPreview {
    return isRecord(value)&&value.storyId===storyId&&title(value.title)&&isSnapshotHash(value.sourceVersion)&&isNovelRevision(value.structureRevision)&&isSnapshotCounts(value.counts)
        &&(!('annotations' in value)||isRecord(value.annotations)&&Object.keys(value.annotations).length===2&&isNovelRevision(value.annotations.revision)&&Number.isSafeInteger(value.annotations.count)&&Number(value.annotations.count)>=0)
}
export function verifySnapshotScene(value:unknown,storyId:string,snapshotId:number,expected:StorySnapshotScene,manifestHash:string):value is StorySnapshotSceneView {
    if(!isRecord(value))return false
    const scene=value.scene
    return value.storyId===storyId&&value.snapshotId===snapshotId&&value.manifestHash===manifestHash&&verifyStoryScene(scene,storyId,expected.id)
        &&isRecord(scene)&&Object.entries(expected).every(([key,item])=>canonicalJson(scene[key])===canonicalJson(item))
}

export function snapshotRestoreItems(manifest:StorySnapshotManifest):Map<string,Record<string,unknown>> {
    const rows:Array<[string,object]>=[['novel:'+manifest.storyId,manifest.novel]]
    for(const part of manifest.parts)rows.push(['part:'+part.id,part])
    for(const chapter of manifest.chapters){rows.push(['chapter:'+chapter.id,chapter]);for(const scene of chapter.scenes)rows.push(['scene:'+scene.id,scene])}
    for(const ref of manifest.references)rows.push(['reference:'+ref.id,ref])
    return new Map(rows.map(([id,item])=>[id,item as Record<string,unknown>]))
}
export function verifySnapshotRestorePreview(value:unknown,storyId:string,snapshotId:number,options:StorySnapshotRestoreOptions):value is StorySnapshotRestorePreview {
    if(!isRecord(value)||value.storyId!==storyId||value.snapshotId!==snapshotId||!title(value.name)||!isSnapshotHash(value.manifestHash)||!isSnapshotHash(value.sourceVersion)
        ||!isNovelRevision(value.structureRevision)||snapshotId>value.structureRevision||!isSnapshotRestoreOptions(value.options)||canonicalJson(value.options)!==canonicalJson(options)
        ||!verifySnapshotManifest(value.current,storyId)||!verifySnapshotManifest(value.target,storyId)||!isSnapshotCounts(value.counts)
        ||value.current.sourceVersion!==value.sourceVersion||value.current.novel.structureRevision!==value.structureRevision||value.target.novel.structureRevision!==value.structureRevision+1
        ||!Array.isArray(value.changes)||!Array.isArray(value.laterUnits)||!Array.isArray(value.blockers)||typeof value.canRestore!=='boolean')return false
    const old=snapshotRestoreItems(value.current),next=snapshotRestoreItems(value.target),seen=new Set<string>()
    if(old.size!==next.size||[...old.keys()].some((key)=>!next.has(key)))return false
    const expected=new Map<string,string[]>()
    const metadata=['title','wordGoal','povCardId','locationCardId','details']
    for(const [key,a] of old){
        const b=next.get(key)!,kind=key.split(':')[0]
        const fields=kind==='novel'?['title','description','wordGoal','details','status','trashedAt','activeContext']:kind==='reference'?['chapterId','sceneId','removedAt','kind','cardId','source','enabled','precedence','snapshot']:[...metadata,'order','status','trashedAt','previousStatus','mergedInto',...(kind==='chapter'?['partId']:kind==='scene'?['chapterId','contentHash']:[])]
        const changed=fields.filter((field)=>canonicalJson(a[field])!==canonicalJson(b[field]))
        if(changed.length)expected.set(key,changed)
        if(kind==='scene'&&b.revision!==Number(a.revision)+(a.contentHash!==b.contentHash?1:0))return false
    }
    const counts={parts:0,chapters:0,scenes:0,references:0}
    for(const change of value.changes){
        if(!isRecord(change)||!['novel','part','chapter','scene','reference'].includes(String(change.kind))||typeof change.id!=='string'||!title(change.title)||!Array.isArray(change.fields)||!change.fields.length)return false
        const key=change.kind+':'+change.id,a=old.get(key),b=next.get(key)
        if(!a||!b||seen.has(key)||new Set(change.fields).size!==change.fields.length||!change.fields.every((field)=>typeof field==='string'&&expected.get(key)?.includes(field))||change.fields.length!==expected.get(key)?.length)return false
        if(change.kind!=='novel')counts[(change.kind+'s') as keyof typeof counts]++
        seen.add(key)
    }
    if(seen.size!==expected.size||canonicalJson(counts)!==canonicalJson(value.counts))return false
    const later=new Set<string>()
    for(const unit of value.laterUnits){
        if(!isRecord(unit)||!['part','chapter','scene'].includes(String(unit.kind))||typeof unit.id!=='string'||!title(unit.title))return false
        const key=unit.kind+':'+unit.id
        if(later.has(key)||!old.has(key)||!next.has(key))return false
        later.add(key)
    }
    const allowed=['STORY_SNAPSHOT_LATER_UNITS_HIDDEN','STORY_SNAPSHOT_EXISTING_UNITS_HIDDEN','STORY_SNAPSHOT_REFERENCE_MISSING','STORY_CODEX_DUPLICATE','STORY_PENDING_PROPOSAL']
    if(!value.blockers.every((block)=>isRecord(block)&&allowed.includes(String(block.code))&&Array.isArray(block.ids)&&block.ids.length>0&&block.ids.every((id)=>typeof id==='string'&&id.length>0&&id.length<=64)))return false
    return value.canRestore===(value.changes.length>0&&value.blockers.length===0)
}
