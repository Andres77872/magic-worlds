import wire from './storyAssistantContext.json'
import type { StoryStudioIndex } from '@/shared/types/storyStudio.types'
import type { StoryAssistantContext,StoryAssistantContextRequest } from '@/shared/types/storyAssistant.types'
import { verifyStoryStudioIndex } from '@/infrastructure/api/storyStudioContract'
import { isAssistantContextRequest,verifyAssistantContext } from '@/infrastructure/api/storyAssistantContextContract'

/** Fictional sources exported by the Python compiler, with no project data or provider execution. */
export function assistantContextFixture():{index:StoryStudioIndex;request:StoryAssistantContextRequest;result:StoryAssistantContext}{
    const index:unknown=structuredClone(wire.index),request:unknown=structuredClone(wire.request),result:unknown=structuredClone(wire.result)
    if(!verifyStoryStudioIndex(index)||!isAssistantContextRequest(request)||!verifyAssistantContext(result,index,request))throw new Error('Invalid assistant source fixture')
    return {index,request,result}
}

export function assistantContextVariants(){
    const {index}=assistantContextFixture()
    return wire.variants.map(({request,result})=>{
        const query:unknown=structuredClone(request),value:unknown=structuredClone(result)
        if(!isAssistantContextRequest(query)||!verifyAssistantContext(value,index,query))throw new Error('Invalid assistant source variant')
        return {request:query,result:value}
    })
}
