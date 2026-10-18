import type { StoryOutline,StorySceneOutline,StoryStudioExcerpts,StoryStudioExcerptsRequest } from '@/shared'
import { canonicalJson } from '@/utils/json'

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value))
export function studioExcerptsRequest(source:StoryOutline,scenes:StorySceneOutline[]):StoryStudioExcerptsRequest|null {
    if(!scenes.length||scenes.length>20||new Set(scenes.map((scene)=>scene.id)).size!==scenes.length)return null
    const known=new Map(source.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>[scene.id,scene]))
    if(scenes.some((scene)=>{const head=known.get(scene.id);return !head||scene.storyId!==source.id||head.revision!==scene.revision||head.metadataRevision!==scene.metadataRevision||head.contentHash!==scene.contentHash}))return null
    return {sourceMetadataRevision:source.metadataRevision,sourceStructureRevision:source.structureRevision,sourceContextRevision:source.contextRevision,
        scenes:scenes.map((scene)=>({sceneId:scene.id,revision:scene.revision,metadataRevision:scene.metadataRevision,contentHash:scene.contentHash}))}
}
export function verifyStudioExcerpts(value:unknown,storyId:string,request:StoryStudioExcerptsRequest):value is StoryStudioExcerpts {
    return record(value)&&Object.keys(value).length===5&&value.schemaVersion===1&&value.projection==='scene_excerpts'&&value.storyId===storyId
        &&canonicalJson(value.source)===canonicalJson(request)&&Array.isArray(value.items)&&value.items.length===request.scenes.length
        &&value.items.every((item,index)=>record(item)&&Object.keys(item).length===6
            &&(['sceneId','revision','metadataRevision','contentHash'] as const).every((key)=>item[key]===request.scenes[index][key])
            &&typeof item.text==='string'&&Array.from(item.text).length<=240&&typeof item.truncated==='boolean')
}
