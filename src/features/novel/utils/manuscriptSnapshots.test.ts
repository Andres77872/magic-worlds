import { expect,it } from 'vitest'
import { snapshotManifest } from '@/test/fixtures/storySnapshots'
import { manuscriptSnapshotChanges } from './manuscriptSnapshots'

it('ignores new capture counters and identical prose heads while detecting actual metadata, prose and pin changes',()=>{
    const original=snapshotManifest(),same=structuredClone(original)
    same.novel.structureRevision=20;same.novel.contextRevision=10;same.novel.metadataRevision=7
    same.chapters[0].scenes[0].revision=50;same.chapters[0].scenes[0].metadataRevision=8
    expect(manuscriptSnapshotChanges(original,same)).toEqual([])
    const changes=manuscriptSnapshotChanges(original,snapshotManifest(true))
    expect(changes).toEqual(expect.arrayContaining([
        expect.objectContaining({kind:'scene',fields:expect.arrayContaining(['text','details'])}),
        expect.objectContaining({kind:'reference',fields:['context']}),
    ]))
})
it('distinguishes new later units from a missing saved unit without rewriting either side',()=>{
    const original=snapshotManifest(),current=structuredClone(original)
    current.chapters[0].scenes[0].id='later-scene'
    const changes=manuscriptSnapshotChanges(original,current)
    expect(changes).toEqual(expect.arrayContaining([
        expect.objectContaining({id:'scene-1',fields:['missing']}),
        expect.objectContaining({id:'later-scene',fields:['added']}),
    ]))
    expect(original.chapters[0].scenes[0].id).toBe('scene-1')
})
