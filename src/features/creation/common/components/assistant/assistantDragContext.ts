import { createContext, useContext, type KeyboardEvent, type PointerEvent } from 'react'

export interface AssistantDragContextValue {
    dragging: boolean
    dragHandleProps: {
        onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
        onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void
        onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void
        onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void
        onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
    }
}

export const AssistantDragContext = createContext<AssistantDragContextValue | null>(null)

export function useAssistantDragHandle(): AssistantDragContextValue | null {
    return useContext(AssistantDragContext)
}
