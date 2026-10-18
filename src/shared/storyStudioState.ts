import type { Story,StoryCardRef,StoryCodexAcknowledgement,StoryInheritance,StoryScene,StoryUnitMetadata } from './types/story.types'
import type { StoryOutline,StoryStudioIndex,StoryStudioSource,StoryStudioState,StorySceneStatistics,StorySceneDocument,StoryChapterOutline,StorySceneOutline } from './types/storyStudio.types'
import { canonicalJson } from '@/utils/json'

const metadataKeys=['title','status','wordGoal','povCardId','locationCardId','details','metadataRevision'] as const
export function isStudioSource(value:StoryOutline):value is StoryStudioSource {
    return 'projection' in value&&(value.projection==='studio_index'||value.projection==='studio_state')
}
export function loadedStoryScene(value:unknown):value is StoryScene {
    return Boolean(value&&typeof value==='object'&&'document' in value&&'plainText' in value&&'generationHistory' in value)
}
export function sceneReferences(story:StoryOutline,scene:Pick<StoryScene,'id'|'chapterId'>):StoryCardRef[] {
    return [...story.activeCardRefs.filter((ref)=>ref.chapterId===null&&ref.sceneId===null),
        ...story.activeCardRefs.filter((ref)=>ref.chapterId===scene.chapterId),...story.activeCardRefs.filter((ref)=>ref.sceneId===scene.id)]
}
export function studioInheritance(story:StoryOutline,chapter:StoryChapterOutline,scene?:StorySceneOutline):StoryInheritance {
    const part=story.parts.find((part)=>part.id===chapter.partId)
    const chain:Array<readonly ['novel'|'part'|'chapter'|'scene',StoryOutline|StoryUnitMetadata]>=[['novel',story],...(part?[['part',part] as const]:[]),['chapter',chapter],...(scene?[['scene',scene] as const]:[])]
    const values:StoryInheritance['values']={includeInAI:true,includeInExport:true},origins:StoryInheritance['origins']={}
    for(const [scope,unit] of chain){
        for(const key of ['status','povCardId','locationCardId'] as const){
            const value=scope==='novel'&&key==='povCardId'?story.details.povCardId:key in unit?unit[key as keyof typeof unit]:null
            if(value!=null){Object.assign(values,{[key]:value});origins[key]=scope}
        }
        for(const key of ['narrator','tense','includeInAI','includeInExport'] as const){
            const value=unit.details[key as keyof typeof unit.details]
            if(value!=null){Object.assign(values,{[key]:value});origins[key]=scope}
        }
    }
    return {values,origins,readOnly:chain.some(([,unit])=>unit.status==='archived'||Boolean(unit.trashedAt))}
}
function decorate<T extends StoryStudioSource>(story:T):T {
    return {...story,chapters:story.chapters.map((chapter)=>({...chapter,inheritance:studioInheritance(story,chapter),
        scenes:chapter.scenes.map((scene)=>({...scene,inheritance:studioInheritance(story,chapter,scene)}))}))}
}
function metadata<T extends StoryUnitMetadata>(incoming:T,current:T|undefined):T {
    if(!current||incoming.metadataRevision>=current.metadataRevision)return incoming
    const result={...incoming};for(const key of metadataKeys)Object.assign(result,{[key]:current[key]})
    return result
}
export function validSceneStatistics(value:StorySceneStatistics|null|undefined,scene:Pick<StoryScene,'revision'|'contentHash'>):value is StorySceneStatistics {
    return Boolean(value&&value.sourceRevision===scene.revision&&value.contentHash===scene.contentHash)
}
function heads(story:StoryStudioSource){
    return canonicalJson({metadataRevision:story.metadataRevision,contextRevision:story.contextRevision,structureRevision:story.structureRevision,
        parts:story.parts.map(({id,metadataRevision})=>({id,metadataRevision})),
        chapters:story.chapters.map((chapter)=>({id:chapter.id,partId:chapter.partId,metadataRevision:chapter.metadataRevision,
            scenes:chapter.scenes.map(({id,chapterId,revision,metadataRevision,contentHash})=>({id,chapterId,revision,metadataRevision,contentHash}))}))})
}
/** Merge independent saved heads without introducing any manuscript payload. */
export function mergeStudioIndex(incoming:StoryStudioIndex,current:StoryStudioSource|null|undefined):StoryStudioSource {
    if(!current||current.id!==incoming.id)return decorate(incoming)
    const structure=incoming.structureRevision>=current.structureRevision?incoming:current
    const root=incoming.metadataRevision>=current.metadataRevision?incoming:current
    const context=incoming.contextRevision>=current.contextRevision?incoming:current
    const local=new Map(current.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>[scene.id,scene]))
    const remote=new Map(incoming.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>[scene.id,scene]))
    const chapters=structure.chapters.map((chapter)=>{
        const counterpart=(structure===incoming?current:incoming).chapters.find((item)=>item.id===chapter.id)
        return {...metadata(chapter,counterpart),scenes:chapter.scenes.map((head)=>{
            const next=remote.get(head.id)??head,previous=local.get(head.id)
            const prose=previous&&previous.revision>next.revision?previous:next
            const merged=metadata(next,previous)
            const statistics=validSceneStatistics(prose.statistics,prose)?prose.statistics:null
            return {...merged,chapterId:chapter.id,order:head.order,trashedAt:head.trashedAt,revision:prose.revision,contentHash:prose.contentHash,statistics}
        })}
    })
    const merged:StoryStudioState={...root,projection:'studio_state',sourceVersion:null,structureRevision:structure.structureRevision,
        contextRevision:context.contextRevision,activeCardRefs:context.activeCardRefs,chapters,
        parts:structure.parts.map((part)=>metadata(part,(structure===incoming?current:incoming).parts.find((item)=>item.id===part.id)))}
    const currentHeads=heads(merged),sameIncoming=currentHeads===heads(incoming),sameCurrent=currentHeads===heads(current)
    const statistics=sameIncoming?incoming.statistics:sameCurrent?current.statistics:null
    return decorate(sameIncoming?{...merged,projection:'studio_index',sourceVersion:incoming.sourceVersion,statistics}:{...merged,statistics})
}
export function applyStudioSceneAcknowledgement(story:StoryStudioSource,scene:StorySceneDocument):StoryStudioSource {
    let changed=false
    const chapters=story.chapters.map((chapter)=>({...chapter,scenes:chapter.scenes.map((head)=>{
        if(head.id!==scene.id)return head
        const newerProse=scene.revision>head.revision,sameProse=scene.revision===head.revision&&scene.contentHash===head.contentHash
        if(!newerProse&&!sameProse)return head
        const next={...head}
        if(scene.metadataRevision>head.metadataRevision)for(const key of metadataKeys)Object.assign(next,{[key]:scene[key]})
        if(newerProse){next.revision=scene.revision;next.contentHash=scene.contentHash}
        next.statistics=validSceneStatistics(scene.statistics,next)?scene.statistics:validSceneStatistics(head.statistics,next)?head.statistics:null
        if(canonicalJson(next)!==canonicalJson(head))changed=true
        return next
    })}))
    if(!changed)return story
    const next:StoryStudioState={...story,projection:'studio_state',sourceVersion:null,chapters,statistics:null}
    return decorate(next)
}
export function applyStudioCodexAcknowledgement(story:StoryStudioSource,ack:StoryCodexAcknowledgement):StoryStudioSource {
    return ack.contextRevision>story.contextRevision?decorate({...story,projection:'studio_state',sourceVersion:null,contextRevision:ack.contextRevision,activeCardRefs:ack.refs}):story
}
export function applyStudioGroupAcknowledgement(story:StoryStudioSource,unit:StoryUnitMetadata,kind:'part'|'chapter'):StoryStudioSource {
    const current=kind==='part'?story.parts.find((item)=>item.id===unit.id):story.chapters.find((item)=>item.id===unit.id)
    if(!current||unit.metadataRevision<=current.metadataRevision)return story
    const updated={...current};for(const key of metadataKeys)Object.assign(updated,{[key]:unit[key]})
    const changed:StoryStudioState={...story,projection:'studio_state',sourceVersion:null,
        parts:kind==='part'?story.parts.map((item)=>item.id===unit.id?{...item,...updated}:item):story.parts,
        chapters:kind==='chapter'?story.chapters.map((item)=>item.id===unit.id?{...item,...updated,scenes:item.scenes}:item):story.chapters}
    return decorate(changed)
}
export function mergeStorySummary(incoming:Story,current:Story|undefined):Story {
    if(!current||current.id!==incoming.id)return incoming
    const root=incoming.metadataRevision>=current.metadataRevision?incoming:current
    const structure=incoming.structureRevision>=current.structureRevision?incoming:current
    const context=incoming.contextRevision>=current.contextRevision?incoming:current
    return {...root,summary:true,parts:[],chapters:[],activeCardRefs:[],structureRevision:structure.structureRevision,
        chapterCount:structure.chapterCount,sceneCount:structure.sceneCount,statistics:structure.statistics,
        contextRevision:context.contextRevision,activeContext:context.activeContext}
}
/** Library entries retain metadata only; an opened manuscript lives separately. */
export function storyOutlineSummary(story:StoryOutline):Story {
    if(story.summary)return story as Story
    const parts=new Set(story.parts.filter((part)=>part.trashedAt).map((part)=>part.id))
    const chapters=story.chapters.filter((chapter)=>!chapter.trashedAt&&!parts.has(chapter.partId??''))
    const result:Story&Record<string,unknown>={...story,summary:true,chapterCount:chapters.length,
        sceneCount:chapters.reduce((sum,chapter)=>sum+chapter.scenes.filter((scene)=>!scene.trashedAt).length,0),parts:[],chapters:[],activeCardRefs:[]}
    delete result.schemaVersion;delete result.projection;delete result.sourceVersion
    return result
}

/** Writer seeds merge canonical prose independently; historical outputs stay in their reader. */
export function mergeStudioDocument(incoming:StorySceneDocument,current:StorySceneDocument):StorySceneDocument {
    const stripped=(scene:StorySceneDocument)=>{
        const result={...scene} as StorySceneDocument&{generationHistory?:unknown}
        delete result.generationHistory
        return result
    }
    const next=stripped(incoming),previous=stripped(current),head=metadata(next,previous)
    const prose=previous.revision>next.revision?previous:next
    return {...previous,...head,document:prose.document,body:prose.body,plainText:prose.plainText,revision:prose.revision,contentHash:prose.contentHash,
        activeCardRefs:previous.activeCardRefs,latestGenerationTrace:next.latestGenerationTrace===undefined?previous.latestGenerationTrace:next.latestGenerationTrace}
}

/** Review-only head vector; never includes prose or changes an immutable intent. */
export function studioReviewVersion(story:StoryOutline):string {
    return JSON.stringify([story.id,story.metadataRevision,story.structureRevision,story.contextRevision,
        story.parts.map((part)=>[part.id,part.metadataRevision]),
        story.chapters.map((chapter)=>[chapter.id,chapter.metadataRevision,chapter.scenes.map((scene)=>[scene.id,scene.metadataRevision,scene.revision,scene.contentHash])])])
}
