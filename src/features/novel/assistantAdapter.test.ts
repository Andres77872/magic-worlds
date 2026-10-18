import { expect,it } from 'vitest'
import wire from '@/test/fixtures/novelAssistantTurn.json'
import type { NovelAssistantTurnPreview } from '@/shared/types/storyAssistant.types'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import { novelAssistantAdapter as adapter } from './assistantAdapter'

it('uses the shared chat lifecycle and sends exactly the reviewed sources/profile without an editable document',()=>{
    const preview=structuredClone(wire.preview) as unknown as NovelAssistantTurnPreview
    const binding={storyId:wire.index.id,title:wire.index.title,preview}
    const bound={target:wire.index as unknown as StoryStudioIndex,cas:{revision:preview.context.sourceVersion,content_hash:preview.context.sourceVersion},conversation:{kind:'novel' as const,story_id:preview.storyId,conversation_id:preview.conversationId,conversation_version:preview.conversationVersion}}
    const turn=adapter.turnBody(binding,preview.context.request.message,bound)
    expect(turn).toEqual({kind:'novel',message:preview.context.request.message,source:preview.context.request,
        expected_packet_hash:preview.context.packetHash,expected_conversation_version:preview.conversationVersion,expected_prompt_hash:preview.promptHash})
    expect(turn).not.toHaveProperty('current')
    expect(turn.source).not.toBe(preview.context.request)
    expect(adapter.scope(binding)).toEqual({kind:'novel',story_id:binding.storyId})
    expect(adapter.lifecycle).toBe('panel')
    for(const change of [{...binding,preview:null},{...binding,storyId:'another-book'}])expect(()=>adapter.turnBody(change,preview.context.request.message,bound)).toThrow()
    expect(()=>adapter.turnBody(binding,'A changed question',bound)).toThrow()
    expect(()=>adapter.turnBody(binding,preview.context.request.message,{...bound,cas:{...bound.cas,revision:'b'.repeat(64)}})).toThrow()
    expect(()=>adapter.turnBody(binding,preview.context.request.message,{...bound,conversation:{...bound.conversation,conversation_id:preview.conversationId+1}})).toThrow()
    expect(()=>adapter.turnBody(binding,preview.context.request.message,{...bound,conversation:{...bound.conversation,conversation_version:preview.conversationVersion+1}})).toThrow()
})
