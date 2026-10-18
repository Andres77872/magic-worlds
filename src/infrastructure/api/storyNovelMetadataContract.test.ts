import { existsSync,readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { verifyStory } from './storyContract'
import { verifySnapshotDetail } from './storySnapshotContract'
import { verifyWorkspaceMediaPage } from './workspaceContract'
const path='/tmp/novel-metadata-wire.json'
it.skipIf(!existsSync(path))('reads actual owned metadata, frozen cover/POV and retained missing-file media from MySQL',()=>{
    const wire=JSON.parse(readFileSync(path,'utf-8'))
    for(const key of ['saved','restored','copied'])expect(verifyStory(wire[key])).toBe(true)
    expect(verifySnapshotDetail(wire.snapshot,wire.saved.id,wire.snapshot.id)).toBe(true)
    expect(verifyWorkspaceMediaPage(wire.media,wire.saved.organization.workspace_id,'image')).toBe(true)
    expect(wire.restored.details).toEqual(wire.saved.details)
    expect(wire.copied.details.coverAssetId).toBe(wire.saved.details.coverAssetId)
    expect(wire.copied.activeCardRefs).toEqual(expect.arrayContaining([expect.objectContaining({cardId:'mira',chapterId:null,sceneId:null,enabled:false})]))
    expect(wire.media.items.some((item:{asset_id:string})=>item.asset_id===wire.saved.details.coverAssetId)).toBe(true)
})
