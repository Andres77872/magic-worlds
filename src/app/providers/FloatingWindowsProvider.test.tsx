import { useContext } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FloatingWindowDescriptor } from '@/features/floatingWindows/floatingWindow.types'
import {
    createWorkspaceTestState,
    OTHER_WORKSPACE_ID,
    WorkspaceTestProvider,
} from '@/shared/hooks/testing/workspaceTestUtils'
import { FloatingWindowsProvider } from './FloatingWindowsProvider'
import { FloatingWindowsContext } from './floatingWindowsContext'
import { MAX_FLOATING_WINDOWS, floatingWindowsReducer } from './floatingWindowsReducer'

function win(id: string, dedupKey = id): FloatingWindowDescriptor {
    return { id, dedupKey, title: dedupKey, content: { kind: 'card', preview: { id: dedupKey } as never } }
}

const keys = (state: FloatingWindowDescriptor[]) => state.map((w) => w.dedupKey)

describe('floatingWindowsReducer', () => {
    it('opens a window', () => {
        const next = floatingWindowsReducer([], { type: 'OPEN', descriptor: win('1', 'card:a') })
        expect(keys(next)).toEqual(['card:a'])
    })

    it('re-opening the same content focuses (moves to top), keeps id, no duplicate', () => {
        const state = [win('1', 'card:a'), win('2', 'card:b')]
        const next = floatingWindowsReducer(state, { type: 'OPEN', descriptor: win('99', 'card:a') })
        expect(keys(next)).toEqual(['card:b', 'card:a']) // 'a' moved to the end (top)
        expect(next).toHaveLength(2)
        expect(next[1].id).toBe('1') // existing id preserved
    })

    it('caps the stack and evicts the oldest', () => {
        let state: FloatingWindowDescriptor[] = []
        for (let i = 0; i < MAX_FLOATING_WINDOWS + 2; i++) {
            state = floatingWindowsReducer(state, { type: 'OPEN', descriptor: win(`${i}`, `card:${i}`) })
        }
        expect(state).toHaveLength(MAX_FLOATING_WINDOWS)
        expect(keys(state)).toEqual(['card:2', 'card:3', 'card:4', 'card:5', 'card:6', 'card:7'])
    })

    it('closes a window by id', () => {
        const state = [win('1', 'card:a'), win('2', 'card:b')]
        expect(keys(floatingWindowsReducer(state, { type: 'CLOSE', id: '1' }))).toEqual(['card:b'])
    })

    it('focuses (reorders to top) a window by id', () => {
        const state = [win('1', 'card:a'), win('2', 'card:b'), win('3', 'card:c')]
        expect(keys(floatingWindowsReducer(state, { type: 'FOCUS', id: '1' }))).toEqual(['card:b', 'card:c', 'card:a'])
    })

    it('focusing the topmost window is a no-op', () => {
        const state = [win('1', 'card:a'), win('2', 'card:b')]
        expect(floatingWindowsReducer(state, { type: 'FOCUS', id: '2' })).toBe(state)
    })

    it('closes all windows', () => {
        const state = [win('1', 'card:a'), win('2', 'card:b')]
        expect(floatingWindowsReducer(state, { type: 'CLOSE_ALL' })).toEqual([])
    })
})

describe('FloatingWindowsProvider', () => {
    function Probe() {
        const context = useContext(FloatingWindowsContext)
        return (
            <div>
                <span data-testid="window-count">{context?.windows.length ?? 0}</span>
                <button onClick={() => context?.openWindow({ dedupKey: 'card:a', title: 'A', content: { kind: 'card', preview: { id: 'a' } as never } })}>
                    open
                </button>
            </div>
        )
    }

    it('closes every window when the workspace switch commits', () => {
        const workspace = createWorkspaceTestState()
        const tree = () => (
            <WorkspaceTestProvider state={workspace}>
                <FloatingWindowsProvider><Probe /></FloatingWindowsProvider>
            </WorkspaceTestProvider>
        )
        const view = render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'open' }))
        expect(screen.getByTestId('window-count')).toHaveTextContent('1')

        // A re-render without a switch keeps them.
        view.rerender(tree())
        expect(screen.getByTestId('window-count')).toHaveTextContent('1')

        act(() => workspace.switchTo(OTHER_WORKSPACE_ID))
        view.rerender(tree())
        expect(screen.getByTestId('window-count')).toHaveTextContent('0')
    })

    it('mounts without a workspace provider (stories, isolated surfaces)', () => {
        render(<FloatingWindowsProvider><Probe /></FloatingWindowsProvider>)
        fireEvent.click(screen.getByRole('button', { name: 'open' }))
        expect(screen.getByTestId('window-count')).toHaveTextContent('1')
    })
})
