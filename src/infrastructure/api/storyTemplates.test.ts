import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory } from './storyContract'
import { isStoryCreateWrite,verifyStoryCreationAcknowledgement } from './storyCreationContract'
const file='/tmp/novel-template-wire.json'
it.skipIf(!existsSync(file))('verifies actual template creation, recovery and reopened writing against frontend contracts',()=>{
    const {write,ack,story,current}=JSON.parse(readFileSync(file,'utf8'))
    expect(isStoryCreateWrite(write)).toBe(true)
    expect(verifyStoryCreationAcknowledgement(ack,write)).toBe(true)
    expect(verifyStory(story,ack.storyId)).toBe(true)
    expect(verifyStory(current,ack.storyId)).toBe(true)
})
