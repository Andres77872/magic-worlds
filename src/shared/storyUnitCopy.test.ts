import { expect,it } from 'vitest'
import { unitCopyStory } from '@/test/fixtures/storyUnitCopy'
import { defaultStoryCopyOptions } from './storyCopyOptions'
import { isStoryUnitCopyOperation,unitCopyOperation } from './storyUnitCopy'
import { verifyStoryStructureAcknowledgement } from '@/infrastructure/api/storyContract'

it('pins every source scene, including excluded lifecycle states, without sharing mutable options',()=>{
    const story=unitCopyStory(),options={...defaultStoryCopyOptions},operation=unitCopyOperation(story,'chapter','chapter-1','Another gate',options)!
    expect(operation.sourceScenes).toHaveLength(3)
    expect(operation.expectedMetadataRevision).toBe(3);expect(operation.expectedContextRevision).toBe(4)
    options.includeNotes=false
    expect(operation.options.includeNotes).toBe(true)
    expect(isStoryUnitCopyOperation(operation)).toBe(true)
    expect(isStoryUnitCopyOperation({...operation,options:{includeNotes:true}})).toBe(false)
    expect(isStoryUnitCopyOperation({...operation,sourceScenes:[operation.sourceScenes[0],operation.sourceScenes[0]]})).toBe(false)
})
it('requires a fresh selected identity and acknowledgement of the complete reviewed copy intent',()=>{
    const operation=unitCopyOperation(unitCopyStory(),'chapter','chapter-1','Another gate',{...defaultStoryCopyOptions})!
    const write={requestId:'copy-one',expectedStructureRevision:8,operation},intent={storyId:'story-1',write}
    const ack={structureRevision:9,selectedId:'new-chapter',copy:{storyId:'story-1',requestId:'copy-one',operation}}
    expect(verifyStoryStructureAcknowledgement(ack,8,intent)).toBe(true)
    expect(verifyStoryStructureAcknowledgement({...ack,selectedId:null},8,intent)).toBe(false)
    expect(verifyStoryStructureAcknowledgement({...ack,selectedId:'chapter-1'},8,intent)).toBe(false)
    expect(verifyStoryStructureAcknowledgement({...ack,copy:{...ack.copy,storyId:'other-story'}},8,intent)).toBe(false)
    expect(verifyStoryStructureAcknowledgement({...ack,copy:{...ack.copy,operation:{...operation,title:'Wrong title'}}},8,intent)).toBe(false)
    expect(verifyStoryStructureAcknowledgement({structureRevision:9,selectedId:'new-chapter'},8,intent)).toBe(false)
    const retained:Partial<typeof operation>={...operation}
    delete retained.sourceStructureRevision
    const retainedWrite={...write,operation:retained} as unknown as typeof write
    expect(verifyStoryStructureAcknowledgement({...ack,copy:{...ack.copy,operation:retained}},8,{storyId:'story-1',write:retainedWrite})).toBe(true)
})
