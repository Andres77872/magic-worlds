import { expect,it } from 'vitest'
import wire from '@/test/fixtures/novelVariantRefinementNative.json'
import type { NovelAssistantRecord,NovelRefinementReference,StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { verifyNovelAssistantPreview,verifyNovelAssistantRecord } from './novelAssistantContract'
import { verifyGenerationDetail } from './storyGenerationHistoryContract'
import { verifyNovelRefinementSource,refinementSourceReference } from './variantRefinementContract'
import { verifyStoryVariantRecord } from './storyVariantContract'

const index=wire.index as unknown as StoryStudioIndex,storyId=index.id
const record=wire.turn.assistant_message.metadata.novel as unknown as NovelAssistantRecord
const reference=wire.sourceReference as NovelRefinementReference

it('reads the accepted native authored source with its immutable original and newer manuscript base kept separate',()=>{
    expect(verifyStoryVariantRecord(wire.sourceRecord,storyId)).toBe(true)
    expect(wire.sourceRecord.status).toBe('accepted')
    expect(wire.originalGeneration.generation.status).toBe('accepted')
    expect(verifyNovelRefinementSource(record.refinement,storyId)).toBe(true)
    expect(refinementSourceReference(record.refinement!)).toEqual(reference)
    expect(wire.preview.refinement.variant).toEqual(wire.sourceRecord.variant)
    expect(wire.preview.context.packet.sources[0].revision).toBe(wire.sceneBefore.revision)
    expect(wire.sceneBefore.revision).toBe(wire.sourceRecord.variant.operation.expectedRevision+1)
})

it('accepts the actual native prompt and new candidate while refusing a generation-only downgrade',()=>{
    const request=wire.preview.context.request as StoryAssistantContextRequest
    expect(verifyNovelAssistantPreview(wire.preview,wire.preview.conversationId,index,request,reference)).toBe(true)
    expect(verifyNovelAssistantRecord(record,storyId,wire.history.generation.id)).toBe(true)
    expect(verifyNovelAssistantPreview(wire.preview,wire.preview.conversationId,index,request,
        {generationId:reference.generationId,parentHash:reference.parentHash})).toBe(false)
    expect(verifyNovelAssistantPreview(wire.preview,wire.preview.conversationId,index,request,
        {...reference,variant:{id:reference.variant!.id,variantHash:'0'.repeat(64)}})).toBe(false)
    expect(record.result.proposal?.id).not.toBe(reference.generationId)
    expect(record.result.proposal?.id).not.toBe(reference.variant?.id)
    expect(record.result.proposal?.operation).toBe('replace_scene')
})

it('keeps the history source reference inspectable without exposing the frozen execution payload',()=>{
    expect(verifyGenerationDetail(wire.history,storyId,wire.history.generation.id)).toBe(true)
    expect(wire.history.refinementSource).toEqual(reference)
    expect(Object.keys(wire.history)).toHaveLength(7)
    expect(wire.history).not.toHaveProperty('payload')
    expect(wire.refinementParent.parent.parentGenerationId).toBe(reference.generationId)
})

it('retains the full selected version in keyless recovery without inventing another output or execution',()=>{
    const restored=wire.recoveredStatus.turn.assistant_message.metadata.novel
    expect(verifyNovelAssistantRecord(restored,storyId,wire.history.generation.id)).toBe(true)
    expect(restored).toEqual(record)
    expect(wire.request.refinement).toEqual(reference)
    expect(wire.request).not.toHaveProperty('variant')
    expect(wire.providerRequests).toBe(0)
    expect(wire.projectDatabaseWrites).toBe(0)
    expect(Object.values(wire.checks).every(Boolean)).toBe(true)
})

it('refuses author-source identity reuse or a recursively expanded original',()=>{
    const raw=wire.turn.assistant_message.metadata.novel
    for(const id of [reference.generationId,reference.variant!.id,wire.sourceRecord.variant.operation.id]){
        const changed=structuredClone(raw);changed.result.proposal!.id=id
        expect(verifyNovelAssistantRecord(changed,storyId)).toBe(false)
    }
    const changed=structuredClone(raw)
    Object.assign(changed.refinement.variant.parent,{variant:structuredClone(changed.refinement.variant)})
    expect(verifyNovelAssistantRecord(changed,storyId)).toBe(false)
})
