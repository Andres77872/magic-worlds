import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory,verifyStoryStructureAcknowledgement } from './storyContract'

const file='/tmp/novel-insertions-wire.json'
it.skipIf(!existsSync(file))('verifies actual after-anchor creation and original receipt replay after later reordering',()=>{
    const {storyId,story,write,ack}=JSON.parse(readFileSync(file,'utf8'))
    expect(write.operation.afterId).toBeTypeOf('string');expect(write.operation).not.toHaveProperty('beforeId')
    expect(verifyStory(story,storyId)).toBe(true)
    expect(verifyStoryStructureAcknowledgement(ack,write.expectedStructureRevision,{storyId,write})).toBe(true)
    expect(story.structureRevision).toBeGreaterThan(ack.structureRevision)
})
