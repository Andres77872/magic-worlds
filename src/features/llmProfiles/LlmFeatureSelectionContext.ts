import { createContext, useContext } from 'react'
import type { LlmFeature, LlmSelection } from '@/shared/types/llm.types'
import type { EffectiveLlmProfile } from '@/shared/types/llmProfile.types'

export interface LlmFeatureSelections {
    accountKey: string
    selections: Partial<Record<LlmFeature, LlmSelection>>
    select: (feature: LlmFeature, selection: LlmSelection, resolved: EffectiveLlmProfile) => void
}

/** Only public selection intent belongs in React state; credentials remain in the session vault. */
export const LlmFeatureSelectionContext = createContext<LlmFeatureSelections | null>(null)
export const useLlmFeatureSelections = () => useContext(LlmFeatureSelectionContext)
