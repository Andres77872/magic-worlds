import {describe,expect,it} from 'vitest'
import normal from '@/test/fixtures/novelAssistantTurn.json'
import wire from '@/test/fixtures/novelAssistantRefinement.json'
import native from '@/test/fixtures/novelAssistantRefinementNative.json'
import type {StoryStudioIndex} from '@/shared/types/storyStudio.types'
import type {StoryAssistantContextRequest,NovelRefinementContext} from '@/shared/types/storyAssistant.types'
import {verifyNovelRefinement,refinementReference} from './novelRefinementContract'
import {verifyNovelAssistantPreview,verifyNovelAssistantRecord} from './novelAssistantContract'

const index=normal.index as unknown as StoryStudioIndex
const parent=wire.parent as unknown as NovelRefinementContext
const request=wire.preview.context.request as StoryAssistantContextRequest

describe('retained-parent refinement boundary',()=>{
    it('accepts the actual two-service SQL record without changing the parent or execution identities',()=>{
        expect(verifyNovelAssistantRecord(native.record,native.record.context.storyId,native.executionId)).toBe(true)
        expect(native.record.refinement.parent.id).toBe(native.parentId)
        expect(native.record.result.proposal!.id).toBe(native.executionId)
        expect(native.record.refinement.parent.output).toContain('{{env.FAKE_JOINT_LITERAL}}')
        expect(native.record.result.proposal!.id).not.toBe(native.parentId)
    })
    it('accepts the Python-owned parent, reviewed prompt and new candidate lineage',()=>{
        expect(verifyNovelRefinement(parent,index.id)).toBe(true)
        expect(verifyNovelAssistantPreview(wire.preview,7,index,request,refinementReference(parent))).toBe(true)
        expect(verifyNovelAssistantRecord(wire.record,index.id,'22222222-2222-4222-8222-222222222222')).toBe(true)
        expect(verifyNovelAssistantPreview(wire.preview,7,index,request)).toBe(false)
    })
    it('rejects foreign targets, parent identity reuse and unreviewed parent references',()=>{
        const same=structuredClone(wire.record);same.result.proposal!.id=parent.parent.id
        expect(verifyNovelAssistantRecord(same,index.id)).toBe(false)
        const foreign=structuredClone(wire.record);foreign.refinement.parent.sceneId='another-scene'
        expect(verifyNovelAssistantRecord(foreign,index.id)).toBe(false)
        expect(verifyNovelAssistantPreview(wire.preview,7,index,request,{...refinementReference(parent),parentHash:'0'.repeat(64)})).toBe(false)
        const changed=structuredClone(wire.preview);changed.refinement.parent.output='Unreviewed writing'
        expect(verifyNovelAssistantPreview(changed,7,index,request,refinementReference(parent))).toBe(false)
    })
    it('keeps old records readable and rejects extra authority or malformed parent data',()=>{
        expect(verifyNovelAssistantRecord(normal.records.suggest,index.id)).toBe(true)
        for(const value of [{...parent,credentials:{api_key:'unowned'}},{...parent,parent:{...parent.parent,apply:true}},
            {...parent,parent:{...parent.parent,parentGenerationId:parent.parent.id}},
            {...parent,parent:{...parent.parent,output:'\ud800'}}])expect(verifyNovelRefinement(value,index.id)).toBe(false)
    })
})
