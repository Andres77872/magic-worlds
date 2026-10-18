import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { isStoryEraseWrite,verifyStoryEraseAcknowledgement,verifyStoryErasePreview } from './storyEraseContract'

const file=process.env.NOVEL_ERASE_PERSISTENCE
it.skipIf(!file)('recovers actual isolated erasure receipts and refreshes previews that predate novel chat and authored-variant counts',()=>{
    const wire=JSON.parse(readFileSync(file!,'utf8'))
    expect(wire.projectDatabaseTestWrites).toBe(false)
    expect(isStoryEraseWrite(wire.write)).toBe(true)
    const hasChatCounts='conversations' in wire.preview.counts && 'assistantMessages' in wire.preview.counts && 'variants' in wire.preview.counts
    expect(verifyStoryErasePreview(wire.preview,wire.acknowledgement.storyId)).toBe(hasChatCounts)
    expect(verifyStoryEraseAcknowledgement(wire.acknowledgement,wire.preview.storyId,wire.write)).toBe(true)
    expect(wire.otherNovel).not.toBe(wire.preview.storyId)
    expect(wire.concurrentReceiptReplay).toBe(true)
    expect(wire.creationReplayBlocked).toBe(true)
    expect(wire.executionPayloadsRedacted).toBe(true)
    expect(wire.upgrade.preservedRows).toBeGreaterThan(0)
})
