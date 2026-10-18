import { expect,it,vi } from 'vitest'
import { currentRevisionScene,sceneRevision } from '@/test/fixtures/storyRevisions'
import { noteAck,noteAnchor,personalNote } from '@/test/fixtures/storyAnnotations'
import type { StoryAnnotationWrite } from '@/shared'
import type { AnnotationIntent } from '../persistence/annotationJournal'
import { verifyBookmarkConfirmation } from './annotationConfirmation'

const point=(offset=9)=>noteAnchor({quote:'',start:{nodeId:'current-gate',offset},end:{nodeId:'current-gate',offset}})
const bookmark=()=>personalNote({id:'bookmark-1',kind:'bookmark',body:'Return here',revision:1,anchorVersion:1,origin:point(),anchor:point(),lastAnchor:point()})
function intent():AnnotationIntent{
    const write:StoryAnnotationWrite={requestId:'bookmark-create',operation:{op:'create',kind:'bookmark',id:'bookmark-1',body:'Return here',
        anchor:{sceneId:'scene-1',expectedRevision:3,expectedContentHash:'c'.repeat(64),startOffset:9,endOffset:9,quote:''}}}
    return {storyId:'story-1',kind:'bookmark',write,ack:noteAck(write)}
}
const checkpoint=()=>vi.fn(async()=>sceneRevision({revision:3,contentHash:'c'.repeat(64),document:currentRevisionScene().document}))
it('verifies the exact source checkpoint and point before retiring a confirmed bookmark request',async()=>{
    const load=checkpoint();expect(await verifyBookmarkConfirmation(bookmark(),intent(),load)).toBe(true)
    expect(load).toHaveBeenCalledWith('scene-1',3,'c'.repeat(64))
    expect(await verifyBookmarkConfirmation({...bookmark(),origin:point(0)},intent(),load)).toBe(false)
    const unavailable=checkpoint();unavailable.mockRejectedValueOnce(new Error('Checkpoint unavailable'))
    await expect(verifyBookmarkConfirmation(bookmark(),intent(),unavailable)).rejects.toThrow('Checkpoint unavailable')
})
it('keeps creation proof immutable after later independent bookmark edits or attachment remaps',async()=>{
    expect(await verifyBookmarkConfirmation({...bookmark(),revision:8,anchorVersion:10,anchor:null,anchorState:'orphaned',orphanReason:'passage_changed',body:'Later label'},intent(),checkpoint())).toBe(true)
    const load=checkpoint();expect(await verifyBookmarkConfirmation({...bookmark(),kind:undefined},intent(),load)).toBe(false);expect(load).not.toHaveBeenCalled()
    const wrong=checkpoint();wrong.mockResolvedValueOnce(sceneRevision({revision:3,contentHash:'b'.repeat(64),document:currentRevisionScene().document}))
    expect(await verifyBookmarkConfirmation(bookmark(),intent(),wrong)).toBe(false)
})
