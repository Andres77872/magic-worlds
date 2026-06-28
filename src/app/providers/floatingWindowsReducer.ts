/**
 * Reducer + cap for the floating preview windows. Kept in its own module so the
 * provider file only exports components (Fast-Refresh friendly) and the reducer
 * stays unit-testable in isolation.
 */
import type { FloatingWindowDescriptor } from '@/features/floatingWindows/floatingWindow.types'

export const MAX_FLOATING_WINDOWS = 6

export type FloatingWindowsAction =
    | { type: 'OPEN'; descriptor: FloatingWindowDescriptor }
    | { type: 'CLOSE'; id: string }
    | { type: 'FOCUS'; id: string }
    | { type: 'CLOSE_ALL' }

export function floatingWindowsReducer(
    state: FloatingWindowDescriptor[],
    action: FloatingWindowsAction,
): FloatingWindowDescriptor[] {
    switch (action.type) {
        case 'OPEN': {
            const existing = state.find((w) => w.dedupKey === action.descriptor.dedupKey)
            if (existing) {
                // Re-opening refreshes content/onEdit and brings it to the front,
                // keeping the existing window id so its on-screen instance stays put.
                const refreshed: FloatingWindowDescriptor = { ...action.descriptor, id: existing.id }
                return [...state.filter((w) => w.id !== existing.id), refreshed]
            }
            const next = [...state, action.descriptor]
            // Cap the stack; evict the oldest (front of the list).
            return next.length > MAX_FLOATING_WINDOWS ? next.slice(next.length - MAX_FLOATING_WINDOWS) : next
        }
        case 'CLOSE':
            return state.filter((w) => w.id !== action.id)
        case 'FOCUS': {
            const index = state.findIndex((w) => w.id === action.id)
            if (index === -1 || index === state.length - 1) return state
            const target = state[index]
            return [...state.slice(0, index), ...state.slice(index + 1), target]
        }
        case 'CLOSE_ALL':
            return state.length === 0 ? state : []
        default:
            return state
    }
}
