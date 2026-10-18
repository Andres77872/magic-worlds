import type { StoryAnchorEdit } from './storyAnnotation.types'
import type { StoryManuscriptDocument } from './story.types'
import type { NovelRefinementContext, NovelGenerationReference } from './storyAssistant.types'

/** An authored version never replaces the immutable model result. */
export interface StoryVariantReference { id: string; variantHash: string }
export interface StoryVariantOperation {
    id: string
    type: 'replace_scene_snapshot'
    sceneId: string
    expectedRevision: number
    expectedContentHash: string
    document: StoryManuscriptDocument
    anchorEdits: StoryAnchorEdit[] | null
}
export interface StoryVariantIntent {
    id: string
    title: string
    parent: NovelGenerationReference
    operation: StoryVariantOperation
}
export interface StoryVariantSnapshot {
    schemaVersion: 1
    projection: 'generation_variant'
    authorship: 'author_edited'
    storyId: string
    id: string
    title: string
    parent: NovelRefinementContext
    operation: StoryVariantOperation
    baseDocument: StoryManuscriptDocument
    documentHash: string
    variantHash: string
}
export type StoryVariantStatus = 'candidate' | 'stashed' | 'accepted' | 'rejected'
export interface StoryVariantRecord {
    schemaVersion: 1
    storyId: string
    variant: StoryVariantSnapshot
    status: StoryVariantStatus
    appliedRevision: number | null
    createdAt: string
    updatedAt: string
}
export interface StoryVariantSummary {
    id: string
    storyId: string
    sceneId: string
    generationId: string
    variantHash: string
    title: string
    baseRevision: number
    status: StoryVariantStatus
    appliedRevision: number | null
    createdAt: string
    updatedAt: string
}
export interface StoryVariantQuery { generationId?: string; before?: string; limit?: number }
export interface StoryVariantPage {
    schemaVersion: 1
    storyId: string
    generationId: string | null
    before: string | null
    items: StoryVariantSummary[]
    nextBefore: string | null
}
export interface StoryVariantCreate { requestId: string; reviewedHash: string; intent: StoryVariantIntent }
export interface StoryVariantDecision {
    requestId: string
    reference: StoryVariantReference
    expectedStatus: 'candidate' | 'stashed'
    decision: 'stash' | 'reject'
}
