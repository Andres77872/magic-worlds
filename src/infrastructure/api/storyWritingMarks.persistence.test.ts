import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { isStoryDocument,documentMarkdown,documentText } from '@/shared/storyDocument'
import { verifyStory,verifyStoryScene } from './storyContract'
import { verifyReadingPage } from './storyReadingContract'
import { verifySceneRevision,verifySceneRestoreAck } from './storyRevisionContract'
import { verifyStoryStudioIndex,verifyStoryStudioScene } from './storyStudioContract'
import type { StoryStudioIndex } from '@/shared'

it.skipIf(!process.env.NOVEL_WRITING_MARKS_PERSISTENCE)('accepts actual saved highlight JSON across Studio, reader, copy, checkpoint and restore contracts',()=>{
    const wire=JSON.parse(readFileSync(process.env.NOVEL_WRITING_MARKS_PERSISTENCE!,'utf8'))
    const storyId=wire.reopened.storyId,sceneId=wire.reopened.id
    expect(isStoryDocument(wire.marked)).toBe(true)
    expect(documentText(wire.marked)).toBe(documentText(wire.unmarked))
    expect(documentMarkdown(wire.marked)).toBe(wire.reopened.body)
    for(const scene of [wire.saved,wire.reopened,wire.restored,wire.snapshotScene.scene]){
        expect(verifyStoryScene(scene,storyId,sceneId)).toBe(true)
        expect(scene.document).toEqual(wire.marked)
    }
    expect(verifyStory(wire.copied,wire.copied.id)).toBe(true)
    expect(verifyStoryStudioIndex(wire.index,storyId)).toBe(true)
    const head=(wire.index as StoryStudioIndex).chapters.flatMap(chapter=>chapter.scenes).find(scene=>scene.id===sceneId)!
    expect(verifyStoryStudioScene(wire.selected,wire.index,head)).toBe(true)
    expect(verifyReadingPage(wire.reader,storyId,{scope:'scene',unitId:sceneId,limit:1})).toBe(true)
    expect(verifySceneRevision(wire.checkpoint,storyId,sceneId,wire.saved.revision,wire.saved.contentHash)).toBe(true)
    expect(verifySceneRestoreAck(wire.restoreAck,storyId,sceneId,wire.saved.revision,wire.restoreWrite)).toBe(true)
    expect(wire.annotation.anchorState).toBe('attached')
    expect(wire.invalidWritePreserved).toBe(true)
    expect(wire.projectDatabaseTestWrites).toBe(false)
})
