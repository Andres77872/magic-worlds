import type { AssistantAdapter } from '@/features/creation/common/components/assistant/assistantModel'
import { refinementSourceReference } from '@/infrastructure/api/variantRefinementContract'
import { presetReference } from '@/infrastructure/api/storyAssistantPresetContract'

/** The shared chat hook owns history/streaming; a novel target stays a read source. */
export const novelAssistantAdapter:AssistantAdapter<'novel'>={
    kind:'novel',lifecycle:'panel',
    scope:binding=>({kind:'novel',story_id:binding.storyId}),
    title:(_binding,firstMessage)=>Array.from(firstMessage.trim()).slice(0,255).join(''),
    turnBody(binding,message,bound){
        const preview=binding.preview,context=preview?.context
        if(!preview||!context||preview.storyId!==binding.storyId||context.storyId!==binding.storyId||context.request.message!==message
            ||!bound?.target||bound.target.id!==binding.storyId||bound.target.sourceVersion!==context.sourceVersion
            ||bound.conversation?.kind!=='novel'||bound.conversation.story_id!==binding.storyId
            ||bound.conversation.conversation_id!==preview.conversationId||bound.conversation.conversation_version!==preview.conversationVersion
            ||bound.cas.revision!==context.sourceVersion||bound.cas.content_hash!==context.sourceVersion){
            throw new Error('Review a current source and profile preview before sending this novel turn.')
        }
        return {kind:'novel',message,source:structuredClone(context.request),expected_packet_hash:context.packetHash,
            ...(preview.refinement?{refinement:refinementSourceReference(preview.refinement)}:{}),
            ...(preview.preset?{preset:presetReference(preview.preset)}:{}),
            expected_conversation_version:preview.conversationVersion,expected_prompt_hash:preview.promptHash}
    },
}
