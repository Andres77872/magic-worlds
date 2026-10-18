import { expect,it } from 'vitest'
import { historyDetail } from '@/test/fixtures/storyHistory'
import { structureHistoryChanges } from './structureHistory'

it('compares only affected units and reverses the saved parent paths for undo review',()=>{
    const detail=historyDetail(),forward=structureHistoryChanges(detail),inverse=structureHistoryChanges(detail,true)
    expect(forward).toHaveLength(1)
    expect(forward[0]).toMatchObject({id:'scene-1',beforeParent:'Opening',afterParent:'Beyond the gate',textChanged:false})
    expect(inverse[0]).toMatchObject({id:'scene-1',beforeParent:'Beyond the gate',afterParent:'Opening',textChanged:false})
})
it('uses verified document lineage rather than a physical restore counter to label changed prose',()=>{
    const detail=historyDetail()
    const scene=detail.after.chapters[1].scenes![0]
    scene.revision=6
    expect(structureHistoryChanges(detail)[0].textChanged).toBe(false)
    scene.logicalRevision=5
    expect(structureHistoryChanges(detail)[0].textChanged).toBe(true)
    expect(structureHistoryChanges({...detail,before:null})).toEqual([])
})
