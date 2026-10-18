import type { StoryStudioIndex,StoryStudioSource,StorySceneHeader,StoryStudioScene,StoryStudioSceneRequest } from '@/shared/types/storyStudio.types'
import { canonicalJson } from '@/utils/json'
import { verifyStory,verifyStoryMetadata,verifyStoryStudioDocument } from './storyContract'

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
const positive=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0
const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const omitted=(value:Record<string,unknown>,keys:string[])=>keys.every((key)=>!(key in value))

function statistics(value:unknown,scene:Record<string,unknown>):boolean {
    return value===null||record(value)&&Object.keys(value).length===7&&value.schemaVersion===1&&value.algorithm==='icu-word-en-v1'
        &&value.sourceRevision===scene.revision&&value.contentHash===scene.contentHash
        &&(value.wordCount===null||count(value.wordCount))&&count(value.characterCount)&&count(value.textBytes)
}
function verifyOutline(value:unknown,storyId?:string):value is StoryStudioSource {
    if(!record(value)||!omitted(value,['summary','chapterCount','sceneCount','document','body','plainText','generationHistory'])||!Array.isArray(value.chapters)||!Array.isArray(value.parts))return false
    // Reuse root validators only. This temporary validation object is never
    // stored or exposed as a full manuscript; original headers stay unloaded.
    if(!verifyStory({...value,parts:[],chapters:[]},storyId))return false
    const parts=new Set<string>(),chapters=new Set<string>(),scenes=new Set<string>()
    for(const part of value.parts){
        if(!record(part)||!verifyStoryMetadata(part,String(value.id))||parts.has(part.id)
            ||!omitted(part,['document','body','plainText','activeCardRefs','generationHistory']))return false
        parts.add(part.id)
    }
    for(const chapter of value.chapters){
        if(!record(chapter)||!verifyStoryMetadata(chapter,String(value.id))||chapters.has(chapter.id)
            ||chapter.partId!==null&&(typeof chapter.partId!=='string'||!parts.has(chapter.partId))||!Array.isArray(chapter.scenes)
            ||!omitted(chapter,['document','body','plainText','activeCardRefs','generationHistory']))return false
        chapters.add(chapter.id)
        for(const scene of chapter.scenes){
            if(!record(scene)||!verifyStoryMetadata(scene,String(value.id))||scenes.has(scene.id)||scene.chapterId!==chapter.id
                ||!positive(scene.revision)||!hash(scene.contentHash)||!statistics(scene.statistics,scene)
                ||scene.copiedFromRevision!==null&&!positive(scene.copiedFromRevision)
                ||!omitted(scene,['document','body','plainText','activeCardRefs','generationHistory']))return false
            scenes.add(scene.id)
        }
    }
    return Array.isArray(value.activeCardRefs)&&value.activeCardRefs.every((ref)=>record(ref)
        &&(ref.chapterId===null||typeof ref.chapterId==='string'&&chapters.has(ref.chapterId))
        &&(ref.sceneId===null||typeof ref.sceneId==='string'&&scenes.has(ref.sceneId)))
}
export function verifyStoryStudioIndex(value:unknown,storyId?:string):value is StoryStudioIndex {
    return record(value)&&value.schemaVersion===1&&value.projection==='studio_index'&&hash(value.sourceVersion)&&verifyOutline(value,storyId)
}
export function verifyStoryStudioSource(value:unknown,storyId?:string):value is StoryStudioSource {
    return record(value)&&value.schemaVersion===1&&(value.projection==='studio_index'&&hash(value.sourceVersion)
        ||value.projection==='studio_state'&&value.sourceVersion===null)&&verifyOutline(value,storyId)
}
export function storyStudioSceneRequest(index:StoryStudioSource,scene:StorySceneHeader):StoryStudioSceneRequest|null {
    const chapter=index.chapters.find((item)=>item.id===scene.chapterId)
    const stored=chapter?.scenes.find((item)=>item.id===scene.id)
    if(scene.storyId!==index.id||!chapter||!stored||stored.revision!==scene.revision||stored.metadataRevision!==scene.metadataRevision||stored.contentHash!==scene.contentHash)return null
    const part=index.parts.find((item)=>item.id===chapter.partId)
    if(chapter.partId!==null&&!part)return null
    return {sourceMetadataRevision:index.metadataRevision,sourceStructureRevision:index.structureRevision,sourceContextRevision:index.contextRevision,
        chapterMetadataRevision:chapter.metadataRevision,partMetadataRevision:part?.metadataRevision??null,
        revision:scene.revision,metadataRevision:scene.metadataRevision,contentHash:scene.contentHash}
}
export function verifyStoryStudioScene(value:unknown,index:StoryStudioSource,scene:StorySceneHeader):value is StoryStudioScene {
    const expected=storyStudioSceneRequest(index,scene)
    const refs=[...index.activeCardRefs.filter((ref)=>ref.chapterId===null&&ref.sceneId===null),
        ...index.activeCardRefs.filter((ref)=>ref.chapterId===scene.chapterId),...index.activeCardRefs.filter((ref)=>ref.sceneId===scene.id)]
    return Boolean(expected&&record(value)&&Object.keys(value).length===5&&value.schemaVersion===2&&value.projection==='studio_scene'
        &&value.storyId===index.id&&record(value.source)&&canonicalJson(value.source)===canonicalJson(expected)&&verifyStoryStudioDocument(value.scene,index.id,scene.id)
        &&value.scene.chapterId===scene.chapterId&&value.scene.revision===scene.revision&&value.scene.metadataRevision===scene.metadataRevision&&value.scene.contentHash===scene.contentHash
        &&canonicalJson(value.scene.activeCardRefs)===canonicalJson(refs))
}
