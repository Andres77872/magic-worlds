import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory,verifyStoryScene } from './storyContract'
import { verifyAnnotation } from './storyAnnotationContract'
import { verifyStoryStructureHistory } from './storyHistoryContract'

const file='/tmp/novel-compound-structure-wire.json'
it.skipIf(!existsSync(file))('verifies actual nested/context/restore/undo wire records against the client contracts',()=>{
    const {story,scene,note,history}=JSON.parse(readFileSync(file,'utf8'))
    expect(verifyStory(story,story.id)).toBe(true)
    expect(verifyStoryScene(scene,story.id,scene.id)).toBe(true)
    expect(verifyAnnotation(note,story.id,note.id)).toBe(true)
    expect(verifyStoryStructureHistory(history,story.id)).toBe(true)
})
