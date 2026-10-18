import type { StoryOutline } from './types/storyStudio.types'
import type { StoryReadingPage,StoryReadingItem } from './types/storyReading.types'

/** Only an exact saved head can become the selected writing scene. */
export function matchesReadingScene(story:StoryOutline,page:StoryReadingPage,item:StoryReadingItem):boolean {
    const h=item.header,c=story.chapters.find((unit)=>unit.id===h.chapterId),p=story.parts.find((unit)=>unit.id===h.partId),s=c?.scenes.find((unit)=>unit.id===h.sceneId)
    return story.id===page.storyId&&story.structureRevision===page.sourceStructureRevision&&story.metadataRevision===page.sourceMetadataRevision&&story.contextRevision===page.sourceContextRevision
        &&Boolean(c&&!c.trashedAt&&c.partId===h.partId&&c.metadataRevision===h.chapterMetadataRevision
            &&(h.partId===null||p&&!p.trashedAt&&p.metadataRevision===h.partMetadataRevision)
            &&s&&!s.trashedAt&&s.revision===h.revision&&s.metadataRevision===h.metadataRevision&&s.contentHash===h.contentHash)
}
