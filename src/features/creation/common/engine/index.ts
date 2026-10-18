/** Guided-field engine — config-driven enriched card creation over the same `category` contract. */
export {
    hydrate,
    makeCategory,
    rowsFromApi,
    toCategoryPayload,
    type ApiCategory,
    type AttrMap,
    type AttrRow,
    type EntityWithCategory,
} from './categorySerialization'
export type {
    CardFieldDefinition,
    CardTemplate,
    GuidedBinding,
    GuidedInputKind,
    GuidedMirror,
    GuidedSectionDefinition,
} from './types'
export { useGuidedCard, readCategoryAttribute, type GuidedCardApi } from './useGuidedCard'
export {
    useCardDraft,
    isDraftChanged,
    type CardDraftConflict,
    type CardDraftState,
    type UseCardDraftApi,
    type UseCardDraftOptions,
} from './useCardDraft'
export {
    useCardEditorRoute,
    type UseCardEditorRouteOptions,
    type UseCardEditorRouteResult,
} from './useCardEditorRoute'
export { useDirtyPayload, type DirtyPayloadApi } from './useDirtyPayload'
export { useCreatorWorkspace, workspaceSaveErrorKey, type CreatorWorkspaceApi } from './useCreatorWorkspace'
export { GuidedFieldRow, type GuidedFieldRowProps } from './GuidedFieldRow'
export { FieldPalette, type FieldPaletteProps } from './FieldPalette'
export { GuidedSection, type GuidedSectionProps } from './GuidedSection'
export { UseExampleLink, type UseExampleLinkProps } from './UseExampleLink'
