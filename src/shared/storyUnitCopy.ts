import type { StorySceneOutline } from './types/storyStudio.types'
import type { StoryOutline } from './types/storyStudio.types'
import type { StoryCopyOptions,StoryUnitCopyOperation,StoryUnitMetadata } from './types/story.types'
import { isStoryCopyOptions,isStoryCommentCopyChoice } from './storyCopyOptions'

export function unitCopySource(story:StoryOutline,kind:'chapter'|'scene',id:string):{unit:StoryUnitMetadata;scenes:StorySceneOutline[]}|null {
    for(const chapter of story.chapters){
        if(kind==='chapter'&&chapter.id===id)return {unit:chapter,scenes:chapter.scenes}
        if(kind==='scene'){
            const scene=chapter.scenes.find((scene)=>scene.id===id)
            if(scene)return {unit:scene,scenes:[scene]}
        }
    }
    return null
}
export const unitCopyScenes=(scenes:StorySceneOutline[],options:StoryCopyOptions)=>scenes.filter((scene)=>(options.includeArchived||scene.status!=='archived')&&(options.includeTrash||!scene.trashedAt))
export function unitCopyOperation(story:StoryOutline,kind:'chapter'|'scene',id:string,title:string,options:StoryCopyOptions,comments?:{included:boolean;revision:number;bookmarks?:boolean}):StoryUnitCopyOperation|null {
    const source=unitCopySource(story,kind,id)
    if(!source)return null
    return {op:'duplicate',kind,id,title,options:{...options},expectedMetadataRevision:source.unit.metadataRevision,expectedContextRevision:story.contextRevision,sourceStructureRevision:story.structureRevision,
        sourceScenes:source.scenes.map(({id,revision,metadataRevision})=>({id,revision,metadataRevision})).sort((a,b)=>a.id.localeCompare(b.id)),
        ...(comments?{includeComments:comments.included,sourceAnnotationRevision:comments.revision,...(comments.bookmarks!==undefined?{includeBookmarks:comments.bookmarks}:{})}:{})}
}
export function isStoryUnitCopyOperation(value:unknown):value is StoryUnitCopyOperation {
    if(!value||typeof value!=='object'||Array.isArray(value))return false
    const v=value as Record<string,unknown>,id=(value:unknown)=>typeof value==='string'&&value.length>0&&value.length<=64&&value===value.trim()
    const revision=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>0
    return Object.keys(v).every((key)=>['op','kind','id','title','options','expectedMetadataRevision','expectedContextRevision','sourceStructureRevision','sourceScenes','includeComments','includeBookmarks','sourceAnnotationRevision'].includes(key))&&isStoryCommentCopyChoice(v)
        &&v.op==='duplicate'&&['chapter','scene'].includes(String(v.kind))&&id(v.id)
        &&(v.title===undefined||typeof v.title==='string'&&v.title===v.title.trim()&&Array.from(v.title).length>0&&Array.from(v.title).length<=255)
        &&isStoryCopyOptions(v.options)&&revision(v.expectedMetadataRevision)&&revision(v.expectedContextRevision)&&revision(v.sourceStructureRevision)
        &&Array.isArray(v.sourceScenes)&&v.sourceScenes.length<=20_000&&v.sourceScenes.every((head)=>head&&typeof head==='object'&&!Array.isArray(head)
            &&Object.keys(head).length===3&&id(head.id)&&revision(head.revision)&&revision(head.metadataRevision))
        &&new Set(v.sourceScenes.map((head)=>head.id)).size===v.sourceScenes.length
}
