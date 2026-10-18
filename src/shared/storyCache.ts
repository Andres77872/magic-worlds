import type { Story, StoryChapter, StoryCodexAcknowledgement, StoryGeneration, StoryInheritance, StoryScene, StoryUnitMetadata } from './types/story.types'

const metadataKeys = ['title','status','wordGoal','povCardId','locationCardId','details','metadataRevision'] as const
function freshMetadata<T extends StoryUnitMetadata>(incoming:T,current:T|undefined):T {
    if (!current || incoming.metadataRevision >= current.metadataRevision) return incoming
    const result = { ...incoming }
    for (const key of metadataKeys) Object.assign(result,{[key]:current[key]})
    return result
}
function generations(incoming:StoryGeneration[],current:StoryGeneration[]):StoryGeneration[] {
    const items = new Map(current.map((generation)=>[generation.id,generation]))
    for (const generation of incoming) {
        const previous=items.get(generation.id)
        items.set(generation.id,previous?.status==='accepted' ? previous : generation)
    }
    return [...items.values()]
}
export function mergeScene(incoming:StoryScene,current:StoryScene|undefined):StoryScene {
    const result=freshMetadata(incoming,current)
    if (!current) return result
    const prose=current.revision>incoming.revision ? {
        document:current.document,body:current.body,plainText:current.plainText,revision:current.revision,contentHash:current.contentHash,
    } : {}
    return {...result,...prose,activeCardRefs:current.activeCardRefs,generationHistory:generations(incoming.generationHistory,current.generationHistory)}
}
function inheritance(story:Story,chapter:StoryChapter,scene?:StoryScene):StoryInheritance {
    const part=story.parts.find((part)=>part.id===chapter.partId)
    const chain: Array<readonly ['novel'|'part'|'chapter'|'scene',Story|StoryUnitMetadata]> = [['novel',story],...(part ? [['part',part] as const] : []),['chapter',chapter],...(scene ? [['scene',scene] as const] : [])]
    const values:StoryInheritance['values']={includeInAI:true,includeInExport:true}
    const origins:StoryInheritance['origins']={}
    for (const [scope,unit] of chain) {
        for (const key of ['status','povCardId','locationCardId'] as const) {
            const value=scope==='novel'&&key==='povCardId'?story.details.povCardId:key in unit ? unit[key as keyof typeof unit] : null
            if (value != null) {Object.assign(values,{[key]:value});origins[key]=scope}
        }
        for (const key of ['narrator','tense','includeInAI','includeInExport'] as const) {
            const value=unit.details[key as keyof typeof unit.details]
            if (value != null) {Object.assign(values,{[key]:value});origins[key]=scope}
        }
    }
    return {values,origins,readOnly:chain.some(([,unit])=>unit.status==='archived'||Boolean(unit.trashedAt))}
}
export function decorateStory(story:Story):Story {
    const chapters=story.chapters.map((chapter)=>{
        const inherited=story.activeCardRefs.filter((ref)=>ref.sceneId===null&&(ref.chapterId===null||ref.chapterId===chapter.id))
        const scenes=chapter.scenes.map((scene)=>({...scene,inheritance:inheritance(story,chapter,scene),activeCardRefs:[...inherited,...story.activeCardRefs.filter((ref)=>ref.sceneId===scene.id)]}))
        return {...chapter,scenes,inheritance:inheritance(story,chapter),activeCardRefs:inherited,
            body:scenes.filter((scene)=>!scene.trashedAt&&scene.status!=='archived').map((scene)=>scene.body).join('\n\n'),
            generationHistory:scenes.flatMap((scene)=>scene.generationHistory)}
    })
    return {...story,chapters}
}
/** A cache belongs to the exact saved tree it accompanied, never merged newer prose. */
function statisticsForTree(story:Story,candidates:Story[]):Story['statistics'] {
    if(story.summary)return undefined
    const scenes=new Map(story.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>[scene.id,scene]))
    for(const source of candidates){
        if(source.summary||!source.statistics||source.statistics.sourceStructureRevision!==story.structureRevision)continue
        const original=source.chapters.flatMap((chapter)=>chapter.scenes)
        if(original.length===scenes.size&&original.every((scene)=>{const current=scenes.get(scene.id);return current?.revision===scene.revision&&current.contentHash===scene.contentHash}))return source.statistics
    }
    return undefined
}
/** Separate root metadata, organization, Codex and document revision authorities. */
export function mergeStoryResponse(incoming:Story,current:Story|null|undefined):Story {
    if (!current||current.id!==incoming.id) return decorateStory(incoming)
    const structure=incoming.summary ? current : incoming.structureRevision>=current.structureRevision ? incoming : current
    const meta=incoming.metadataRevision>=current.metadataRevision ? incoming : current
    const context=incoming.contextRevision>=current.contextRevision ? incoming : current
    const localScenes=new Map(current.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>[scene.id,scene]))
    const remoteScenes=new Map(incoming.chapters.flatMap((chapter)=>chapter.scenes).map((scene)=>[scene.id,scene]))
    const chapters=structure.chapters.map((chapter)=>{
        const counterpart=(structure===incoming ? current : incoming).chapters.find((item)=>item.id===chapter.id)
        const metadata=freshMetadata(chapter,counterpart)
        return {...metadata,scenes:chapter.scenes.map((scene)=>{
            const remote=remoteScenes.get(scene.id)??scene
            const merged=mergeScene(remote,localScenes.get(scene.id))
            // Parent identity belongs to organization, never a late text acknowledgement.
            return {...merged,chapterId:chapter.id,order:scene.order,trashedAt:scene.trashedAt}
        })}
    })
    const merged=decorateStory({...meta,summary:structure.summary,structureRevision:structure.structureRevision,
        contextRevision:context.contextRevision,activeCardRefs:context.activeCardRefs,chapters,
        parts:structure.parts.map((part)=>freshMetadata(part,(structure===incoming?current:incoming).parts.find((item)=>item.id===part.id)))})
    return {...merged,statistics:statisticsForTree(merged,[incoming,current])}
}
export function applySceneAcknowledgement(story:Story,updated:StoryScene,generationId?:string):Story {
    const chapters=story.chapters.map((chapter)=>({...chapter,scenes:chapter.scenes.map((scene)=>{
        if (scene.id!==updated.id) return scene
        const merged=mergeScene(updated,scene)
        return {...merged,chapterId:chapter.id,order:scene.order,trashedAt:scene.trashedAt,
            generationHistory:merged.generationHistory.map((generation)=>generation.id===generationId ? {...generation,status:'accepted' as const,appliedRevision:updated.revision} : generation)}
    })}))
    const merged=decorateStory({...story,chapters})
    return {...merged,statistics:statisticsForTree(merged,[story])}
}
export function applyCodexAcknowledgement(story:Story,ack:StoryCodexAcknowledgement):Story {
    if(ack.contextRevision<=story.contextRevision)return story
    return decorateStory({...story,contextRevision:ack.contextRevision,activeCardRefs:ack.refs})
}
