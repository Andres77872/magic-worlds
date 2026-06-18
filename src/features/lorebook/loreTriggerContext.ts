/**
 * Carries the active session trigger matcher down into the markdown subtree so the
 * `ProseMarkdown`/`SegmentMarkdown` renderers can wire up `rehypeLoreTriggers` without
 * threading the matcher through every nested component. Null = nothing to mark.
 */
import { createContext } from 'react'
import type { TriggerMatcher } from './loreTriggers'

export const LoreTriggerContext = createContext<TriggerMatcher | null>(null)
