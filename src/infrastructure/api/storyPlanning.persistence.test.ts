import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory,verifyStoryScene } from './storyContract'
import { isStoryWritingTemplate } from '@/shared/storyWritingTemplate'
import { verifyStoryCreationAcknowledgement } from './storyCreationContract'

it.skipIf(!process.env.NOVEL_PLANNING_PERSISTENCE)('reads actual reopened MySQL plans and the exact template creation receipt through frontend guards',()=>{
    const value=JSON.parse(readFileSync(process.env.NOVEL_PLANNING_PERSISTENCE!,'utf8'))
    expect(verifyStory(value.story)).toBe(true)
    expect(verifyStoryScene(value.scene,value.story.id,value.scene.id)).toBe(true)
    expect(isStoryWritingTemplate(value.template)).toBe(true)
    expect(verifyStoryCreationAcknowledgement(value.creation,value.creation.write)).toBe(true)
})
