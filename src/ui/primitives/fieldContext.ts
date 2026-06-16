/**
 * Context shared between the Field wrapper and its form controls: the control
 * id (for the real <label htmlFor>) and validity (for aria-invalid styling).
 * Lives outside Field.tsx so component files only export components.
 */
import { createContext, useContext } from 'react'

export interface FieldContextValue {
    id: string
    invalid: boolean
    /** id of the active error/helper text, wired to the control's aria-describedby. */
    describedById?: string
}

export const FieldContext = createContext<FieldContextValue | null>(null)

/** Control id + validity provided by the nearest Field wrapper, if any. */
export function useFieldContext(): FieldContextValue | null {
    return useContext(FieldContext)
}
