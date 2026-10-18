import type { Story,StoryScene } from '@/shared/types/story.types'
import type { StoryStudioIndex,StoryStudioSource,StoryStudioScene } from '@/shared/types/storyStudio.types'
import { storyStudioSceneRequest } from '@/infrastructure/api/storyStudioContract'
import { sceneReferences } from '@/shared/storyStudioState'
import type { StoryGenerationSummary,StoryGenerationDetail } from '@/shared/types/storyStudio.types'
import { storyGeneration,novel } from './story'

/** Explicit test projection; stripped content never becomes an editor seed. */
export function studioIndex(story:Story=novel()):StoryStudioIndex {
    return {...story,schemaVersion:1,projection:'studio_index',sourceVersion:'b'.repeat(64),chapters:story.chapters.map((chapter)=>{
        const {body,activeCardRefs,generationHistory,...metadata}=chapter
        void [body,activeCardRefs,generationHistory]
        return {...metadata,scenes:chapter.scenes.map((scene)=>{
            const {document,plainText,body,activeCardRefs,generationHistory,...header}=scene
            void [document,plainText,body,activeCardRefs,generationHistory]
            return {...header,copiedFromRevision:scene.copiedFromRevision??null,statistics:scene.statistics??null}
        })}
    })}
}
export function studioSceneRead(index:StoryStudioSource,scene:StoryScene):StoryStudioScene {
    const header=index.chapters.flatMap((chapter)=>chapter.scenes).find((item)=>item.id===scene.id)!
    const {generationHistory,...document}=scene
    return {schemaVersion:2,projection:'studio_scene',storyId:index.id,source:storyStudioSceneRequest(index,header)!,
        scene:{...document,projection:'scene_document',latestGenerationTrace:generationHistory[0]?.contextTrace??null,activeCardRefs:sceneReferences(index,scene)}}
}

export function generationSummary(patch:Partial<StoryGenerationSummary>={}):StoryGenerationSummary {
    return {id:'generation-1',storyId:'story-1',chapterId:'chapter-1',sceneId:'scene-1',command:'continue',status:'candidate',
        baseRevision:1,appliedRevision:null,createdAt:'2026-10-16T00:00:00Z',chapterTitle:'Opening',sceneTitle:'The gate',location:'active',
        instructionPreview:'Continue the scene',instructionTruncated:false,outputPreview:'The gate opened.',outputTruncated:false,...patch}
}
export function generationDetail():StoryGenerationDetail {
    return {schemaVersion:1,storyId:'story-1',generation:storyGeneration({instruction:'Continue the scene',appliedRevision:null,createdAt:'2026-10-16T00:00:00Z',output:'The complete saved output.'}),
        chapterTitle:'Opening',sceneTitle:'The gate',location:'active'}
}
