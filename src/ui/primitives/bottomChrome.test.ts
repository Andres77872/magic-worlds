import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { setBottomChromeHeight, useBottomChromeInset } from './bottomChrome'

afterEach(() => {
    setBottomChromeHeight('banner', null)
    setBottomChromeHeight('dock', null)
    setBottomChromeHeight('launcher', null)
})

describe('bottomChrome', () => {
    it('gives an empty corner a zero inset', () => {
        const { result } = renderHook(() => useBottomChromeInset('toast'))
        expect(result.current).toBe(0)
    })

    it('stacks each slot above the ones below it, and never counts itself', () => {
        setBottomChromeHeight('banner', 100)
        setBottomChromeHeight('dock', 50)

        const dock = renderHook(() => useBottomChromeInset('dock'))
        const launcher = renderHook(() => useBottomChromeInset('launcher'))
        const toast = renderHook(() => useBottomChromeInset('toast'))

        // The dock clears the banner but not its own 50px.
        expect(dock.result.current).toBe(112)
        expect(launcher.result.current).toBe(174)
        expect(toast.result.current).toBe(174)
    })

    it('drops a retracted slot out of the stack', () => {
        setBottomChromeHeight('dock', 80)
        const { result, rerender } = renderHook(() => useBottomChromeInset('toast'))
        expect(result.current).toBe(92)

        setBottomChromeHeight('dock', null)
        rerender()
        expect(result.current).toBe(0)
    })
})
