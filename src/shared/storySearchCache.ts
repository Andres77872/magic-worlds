import type { Story } from './types'
import type { StorySearchResult } from './types/storySearch.types'
import { applySceneAcknowledgement } from './storyCache'
import type { StoryOutline } from './types/storyStudio.types'

/** A document-only result is never stored as a full scene in the Studio index. */
export function matchesStorySearchResult(story:StoryOutline,result:StorySearchResult):boolean {
    const match=result.match,chapter=story.chapters.find((item)=>item.id===match.chapterId),part=story.parts.find((item)=>item.id===match.partId)
    const scene=chapter?.scenes.find((item)=>item.id===match.sceneId)
    return story.id===result.storyId&&story.metadataRevision===result.sourceMetadataRevision&&story.structureRevision===result.sourceStructureRevision&&story.contextRevision===result.sourceContextRevision
        &&Boolean(chapter&&!chapter.trashedAt&&chapter.partId===match.partId&&chapter.metadataRevision===match.chapterMetadataRevision
            &&(match.partId===null||part&&!part.trashedAt&&part.metadataRevision===match.partMetadataRevision)
            &&scene&&!scene.trashedAt&&scene.revision===match.revision&&scene.metadataRevision===match.metadataRevision&&scene.contentHash===match.contentHash)
}

/** A document-only read cannot clear cached pins/history or move unknown units. */
export function mergeStorySearchResult(story:Story,result:StorySearchResult):Story|null {
    const match=result.match
    if(story.id!==result.storyId||story.metadataRevision!==result.sourceMetadataRevision||story.structureRevision!==result.sourceStructureRevision||story.contextRevision!==result.sourceContextRevision)return null
    const chapter=story.chapters.find((item)=>item.id===match.chapterId)
    const part=story.parts.find((item)=>item.id===match.partId)
    const scene=chapter?.scenes.find((item)=>item.id===match.sceneId)
    if(!chapter||!scene||chapter.trashedAt||chapter.partId!==match.partId||chapter.metadataRevision!==match.chapterMetadataRevision
        ||match.partId!==null&&(!part||part.trashedAt||part.metadataRevision!==match.partMetadataRevision)
        ||scene.metadataRevision>match.metadataRevision||scene.revision>match.revision||scene.revision===match.revision&&scene.contentHash!==match.contentHash)return null
    return applySceneAcknowledgement(story,{...scene,...result.scene,activeCardRefs:scene.activeCardRefs,generationHistory:scene.generationHistory})
}
