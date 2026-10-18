import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useStudioLayout } from './useStudioLayout'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('collapses inspector before outline using available studio width and keeps the editor mounted', () => {
    let width = 1400
    let resize!: () => void
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width, height: 700, top: 0, left: 0, right: width, bottom: 700, x: 0, y: 0, toJSON: () => ({}) }))
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
    function Studio() {
        const layout = useStudioLayout()
        return <div ref={layout.containerRef} data-testid="layout" data-outline={layout.outlineDocked} data-inspector={layout.inspectorDocked}>
            <textarea aria-label="Writing" />
        </div>
    }
    render(<Studio />)
    const editor = screen.getByRole('textbox', { name: 'Writing' })
    fireEvent.change(editor, { target: { value: 'Keep this draft' } })
    expect(screen.getByTestId('layout')).toHaveAttribute('data-inspector', 'true')
    width = 900
    act(() => resize())
    expect(screen.getByTestId('layout')).toHaveAttribute('data-inspector', 'false')
    expect(screen.getByTestId('layout')).toHaveAttribute('data-outline', 'true')
    width = 320
    act(() => resize())
    expect(screen.getByTestId('layout')).toHaveAttribute('data-outline', 'false')
    expect(screen.getByRole('textbox', { name: 'Writing' })).toBe(editor)
    expect(editor).toHaveValue('Keep this draft')
})

it('rechecks available room when reading width changes without a browser resize', () => {
    let measure = '640px'
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ getPropertyValue: () => measure }) as unknown as CSSStyleDeclaration)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1200 } as DOMRect)
    function Studio({ width }: { width: string }) {
        const layout = useStudioLayout(width)
        return <div ref={layout.containerRef} data-testid="layout" data-inspector={layout.inspectorDocked}><textarea aria-label="Writing" /></div>
    }
    const view = render(<Studio width="standard" />)
    const editor = screen.getByRole('textbox')
    expect(screen.getByTestId('layout')).toHaveAttribute('data-inspector', 'true')
    measure = '800px'
    view.rerender(<Studio width="wide" />)
    expect(screen.getByTestId('layout')).toHaveAttribute('data-inspector', 'false')
    expect(screen.getByRole('textbox')).toBe(editor)
})
