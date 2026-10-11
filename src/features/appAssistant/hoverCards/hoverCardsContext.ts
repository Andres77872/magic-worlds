import { createContext } from 'react'
import type { FocusRef } from '../appKnowledge'
import type { HoverCardController } from './hoverCardController'

export interface HoverCardsContextValue {
    controller: HoverCardController
    /** Whether the record is on the assistant's focus shelf (links show a dot). */
    isInFocus: (ref: FocusRef) => boolean
}

/** Present inside `HoverCardsProvider`; links outside it render as plain links. */
export const HoverCardsContext = createContext<HoverCardsContextValue | null>(null)
