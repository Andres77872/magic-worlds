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
export { GuidedFieldRow, type GuidedFieldRowProps } from './GuidedFieldRow'
export { FieldPalette, type FieldPaletteProps } from './FieldPalette'
export { GuidedSection, type GuidedSectionProps } from './GuidedSection'
export { UseExampleLink, type UseExampleLinkProps } from './UseExampleLink'
