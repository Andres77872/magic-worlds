import { useState } from 'react'
import type { StoryAnnotation } from '@/shared'
import type { AnnotationIntent } from '../persistence/annotationJournal'
import type { StoryWorkspace } from './useStoryWorkspace'
import { useAnnotationSource } from './useAnnotationSource'
import { useAnnotationDrafts } from './useAnnotationDrafts'
import { useAnnotationMutations } from './useAnnotationMutations'

export interface AnnotationConfirmation {scopeKey:string;intent:AnnotationIntent;note:StoryAnnotation}
export function usePersonalAnnotations(storyId:string|null,workspace:StoryWorkspace,readOnly:boolean){
    const source=useAnnotationSource(storyId,workspace),drafts=useAnnotationDrafts(storyId,workspace)
    const [confirmation,setConfirmation]=useState<AnnotationConfirmation|null>(null)
    const mutations=useAnnotationMutations(storyId,workspace,readOnly,(intent,note)=>{
        drafts.confirm(intent)
        if(source?.isCurrent())setConfirmation({scopeKey:source.key,intent,note})
    })
    return {source,drafts,mutations,confirmation:confirmation?.scopeKey===source?.key?confirmation:null}
}
export type PersonalAnnotations=ReturnType<typeof usePersonalAnnotations>
