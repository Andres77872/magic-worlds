import type { StoryCardRef,StoryCardSnapshot,StoryCodexReferenceInput,StorySource,StorySourceInput } from './story.types'

export interface StoryApprovedMaterial {
    key:string
    kind:'approved_adventure_material'
    title:string
    text:string
    enabled?:boolean
}
export interface StoryCreationSourcesSelection {
    source?:StorySourceInput
    cardRefs?:Array<Omit<StoryCodexReferenceInput,'snapshot'>&{snapshot?:StoryCardSnapshot|null}>
    approvedMaterials?:StoryApprovedMaterial[]
}
export type StoryCreationSourceReference=Pick<StoryCardRef,'kind'|'cardId'|'source'|'enabled'|'precedence'|'snapshot'>&{materialKey?:string;origin?:'library'|'saved_adventure'|'provided'|'approved_material'}
export interface StoryCreationSourcesPreview {
    schemaVersion:1
    sourceVersion:string
    source:StorySource
    references:StoryCreationSourceReference[]
}
export interface StoryCreationSources extends StoryCreationSourcesPreview {storyId:string;createdAt:string}
